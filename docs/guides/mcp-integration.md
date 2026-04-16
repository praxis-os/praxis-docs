---
title: "MCP Server Integration"
description: "Wire stdio and HTTP Model Context Protocol servers into a praxis orchestrator with credential injection, response caps, filtering, and observability."
sidebar_label: "MCP Integration"
sidebar_position: 9
keywords: [mcp, model-context-protocol, stdio, http, streamable, credentials, PostToolFilter, trust-boundary, metrics, namespacing, composition]
rag_section: "guides"
rag_packages: ["mcp", "credentials", "hooks", "tools"]
rag_interfaces: ["mcp.Invoker", "credentials.Resolver", "hooks.PostToolFilter", "tools.Invoker"]
rag_difficulty: "advanced"
---

# MCP Server Integration

This guide walks through wiring one or more Model Context Protocol (MCP) servers into a praxis orchestrator via the [`mcp` sub-module](../api-reference/mcp.md). By the end you will have a running `Invoker` with credential injection, response caps, a mandatory `PostToolFilter`, and metrics flowing.

## Prerequisites

Add the sub-module to your project:

```bash title="terminal"
go get github.com/praxis-os/praxis/mcp@v0.7.0
```

You need at least one MCP server to target. For local development, reach for a community server binary (anything that speaks MCP over stdio). For remote servers, have the URL and a bearer token ready.

## Step 1: Declare Servers

A `Server` is a pure value type. The three fields are `LogicalName` (your identifier, used as the routing prefix), `Transport` (either `TransportStdio` or `TransportHTTP`), and `CredentialRef` (opaque string passed to your resolver; empty means unauthenticated).

```go title="Declaring servers"
servers := []mcp.Server{
    {
        LogicalName: "github",
        Transport:   mcp.TransportStdio{Command: "mcp-github"},
    },
    {
        LogicalName:   "remote-tools",
        CredentialRef: "mcp-bearer",
        Transport: mcp.TransportHTTP{
            URL:    "https://mcp.example.com/v1",
            Header: map[string]string{"X-Tenant": "acme"},
        },
    },
}
```

`LogicalName` must match `^[a-zA-Z0-9_-]{1,64}$`. The `__` sequence is reserved as the namespacing separator and is rejected by validation. At most 32 servers per `Invoker`.

## Step 2: Choose the Transport

| Transport | Use when | Notes |
|---|---|---|
| `TransportStdio` | Running a local MCP server binary, dev loops, CLI-style tools. | Binary resolved via `exec.LookPath` at construction time (D119). Unix processes isolated into their own process group. Credentials injected via `CredentialEnv` environment variable and zeroed after copy. |
| `TransportHTTP` | Hosted MCP servers over https. | Only `http://` or `https://` URLs accepted (D108). The `Authorization` header is forbidden in `Header` — send credentials via `CredentialRef` so they flow through the resolver and are zeroed. |

### Stdio specifics

```go
mcp.TransportStdio{
    Command:       "mcp-github",
    Args:          []string{"--mode", "readonly"},
    Env:           map[string]string{"LOG_LEVEL": "info"},
    CredentialEnv: "GITHUB_TOKEN", // receives resolved credential bytes
}
```

If `CredentialRef` is set on the `Server`, `CredentialEnv` on the `TransportStdio` must also be set; otherwise validation fails.

### HTTP specifics

```go
mcp.TransportHTTP{
    URL:    "https://mcp.example.com/v1",
    Header: map[string]string{"X-Custom-Header": "value"},
}
```

Bearer tokens from `CredentialRef` are applied as `Authorization: Bearer <token>` on every request. Custom `Header` entries are merged via `http.Header.Add` and cannot override `Authorization`.

## Step 3: Wire a Credentials Resolver

The `mcp` sub-module never reads credentials from the environment directly. It delegates to a `credentials.Resolver`, which you inject with `WithResolver`. Typically you share the same resolver you already pass to the orchestrator.

```go title="Minimal env-backed resolver"
type envResolver struct{}

func (envResolver) Fetch(_ context.Context, ref string) (credentials.Credential, error) {
    val := os.Getenv(strings.ToUpper(strings.ReplaceAll(ref, "-", "_")))
    if val == "" {
        return credentials.Credential{}, fmt.Errorf("missing credential for %q", ref)
    }
    return credentials.Credential{Value: []byte(val)}, nil
}
```

Production deployments should back the resolver with KMS/HSM or a secret manager. See the [`credentials` package](../api-reference/credentials.md) for the full contract.

## Step 4: Construct the Invoker

```go title="Building the Invoker"
inv, err := mcp.New(ctx, servers,
    mcp.WithResolver(envResolver{}),
    mcp.WithMetricsRecorder(myRecorder),
    mcp.WithTracerProvider(otel.GetTracerProvider()),
    mcp.WithMaxResponseBytes(16*1024*1024),
)
if err != nil {
    return err
}
defer inv.Close()
```

`mcp.New` validates the server slice, resolves credentials, opens one session per server eagerly, and builds the routing table. A failure at any stage closes already-opened sessions in LIFO order and returns a typed `SystemError` — never a partially constructed `Invoker`.

`Close()` is idempotent and safe to call from a defer.

## Step 5: Compose with Native Tools

`mcp.Invoker` satisfies `tools.Invoker`. If you only expose MCP tools, wire it directly:

```go title="MCP-only orchestrator"
orch, err := orchestrator.New(provider,
    orchestrator.WithToolInvoker(inv),
)

result, err := orch.Invoke(ctx, praxis.InvocationRequest{
    Messages: []llm.Message{...},
    Tools:    inv.Definitions(),
})
```

To mix MCP tools with native tools, implement a composite invoker that routes by name prefix. Tools emitted by `mcp.Invoker` are namespaced as `{logicalName}__{mcpToolName}` (D111), so the prefix check is unambiguous:

```go title="Composite invoker"
type compositeInvoker struct {
    mcp    tools.Invoker
    native tools.Invoker
    prefixes map[string]struct{} // set of known MCP logical names
}

func (c *compositeInvoker) Invoke(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
    if i := strings.Index(call.Name, "__"); i > 0 {
        if _, ok := c.prefixes[call.Name[:i]]; ok {
            return c.mcp.Invoke(ctx, ic, call)
        }
    }
    return c.native.Invoke(ctx, ic, call)
}
```

Merge the tool-definition slices before passing them to the LLM request: `append(inv.Definitions(), nativeDefs...)`.

## Step 6: Enforce the Trust Boundary

:::warning

MCP tool results cross a trust boundary (D116). The server is a separate process or remote service, potentially third-party. You **must** register a `PostToolFilter` that sanitises MCP output before it reaches the LLM. Content flattening is defence in depth, not a replacement for filtering.

:::

```go title="Redacting sensitive tokens from MCP output"
type redactTokens struct{}

func (redactTokens) FilterPostTool(ctx context.Context, ic hooks.InvocationContext, result tools.ToolResult) (hooks.FilterDecision, error) {
    if strings.Contains(result.Content, "sk-") {
        return hooks.FilterDecision{Action: hooks.FilterActionRedact, Content: "[REDACTED]"}, nil
    }
    return hooks.FilterDecision{Action: hooks.FilterActionPass}, nil
}

orch, err := orchestrator.New(provider,
    orchestrator.WithToolInvoker(inv),
    orchestrator.WithPostToolFilters(redactTokens{}),
)
```

See the [policy-hooks core concept](../core-concepts/policy-hooks.md) and the [filter-chains guide](./filter-chains.md) for deeper treatment.

## Step 7: Handle Failure Modes

Dispatch errors are mapped to `ToolSubKind`:

| Symptom | `ToolSubKind` | Typical remedy |
|---|---|---|
| Network timeout, TLS error, `io.EOF` | `Network` | Retry with back-off (the framework's retry policy covers this). |
| HTTP 401/403, session gone | `CircuitOpen` | Refresh credentials; this does not auto-retry. |
| Malformed response JSON | `SchemaViolation` | Surface to the caller; indicates a server bug. |
| JSON-RPC error, tool-level `IsError=true`, response too large | `ServerError` | Model sees the error as tool output; may retry or change approach. |

Construction-time failures (validation, credential resolution, transport build) are `ErrorKindSystem` and should be treated as configuration bugs.

## Step 8: Observe

Inject a `telemetry.MetricsRecorder` that also satisfies `mcp.MCPMetricsRecorder` (D115). If the assertion fails, MCP metrics are silently dropped while core metrics continue. Three metrics land:

- `praxis_mcp_calls_total{server,transport,status}`
- `praxis_mcp_call_duration_seconds{server,transport,status}`
- `praxis_mcp_transport_errors_total{server,transport,kind}`

Label cardinality is bounded by construction: `server` ≤ 32, `transport ∈ {"stdio","http"}`, `status ∈ {"ok","error"}`, `kind ∈ {"network","server_error","schema_violation","circuit_open"}`.

Inject an OpenTelemetry `TracerProvider` via `WithTracerProvider`; every `CallTool` opens a child `praxis.mcp.toolcall` span that nests under the orchestrator's invocation span.

## Worked Example

See the [stdio example](../examples/mcp-stdio.md) for a complete local server wire-up, and the [HTTP example](../examples/mcp-http.md) for a credentialed remote server.

## Full API Reference

For complete type and method documentation, see [mcp on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/mcp).

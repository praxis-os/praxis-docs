---
title: "mcp Package"
description: "The mcp package is an independently versioned sub-module that fronts Model Context Protocol servers behind the standard tools.Invoker seam with stdio and Streamable HTTP transports."
sidebar_label: "mcp"
sidebar_position: 13
keywords: [praxis, mcp, model-context-protocol, tools, invoker, transport, stdio, http, streamable, namespacing, trust-boundary, D116, sub-module]
rag_section: "api-reference"
rag_packages: ["mcp"]
rag_interfaces: ["mcp.Invoker", "mcp.Transport", "mcp.MCPMetricsRecorder"]
rag_difficulty: "advanced"
---

# mcp Package

## Purpose

The `mcp` package is an **independently versioned Go sub-module** (`github.com/praxis-os/praxis/mcp`) that adapts Model Context Protocol (MCP) servers to the praxis `tools.Invoker` contract. Once constructed, an `mcp.Invoker` exposes every tool advertised by one or more MCP servers as if they were native praxis tools, with credential injection, response-size caps, error classification, and observability wired in.

MCP servers are bound at construction time; there is no runtime plugin discovery. Two transports ship: stdio (for local process-per-server binaries) and Streamable HTTP (for remote hosted servers). The sealed `Transport` interface keeps the audit surface closed.

:::note

The `mcp` sub-module has its own `go.mod` and is released on its own `praxis/mcp/vX.Y.Z` SemVer track. You add it independently: `go get github.com/praxis-os/praxis/mcp@v0.7.0`. Current state: stable-v0.x-candidate, target freeze at `praxis/mcp/v1.0.0`.

:::

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Invoker` | Interface | Embeds `tools.Invoker` + `io.Closer`, plus `Definitions() []llm.ToolDefinition`. Safe for concurrent use; `Close()` is idempotent. |
| `New(ctx, servers, opts...)` | Constructor | Validates servers, resolves credentials, opens sessions eagerly, builds the routing table. Returns a typed `SystemError` on any failure; never returns a partially constructed invoker. |
| `Server` | Struct | `LogicalName`, `Transport`, `CredentialRef`. Validated at `New` time. |
| `Transport` | Sealed interface | Only `TransportStdio` and `TransportHTTP` satisfy it. Sealed by an unexported sentinel method so the trust-boundary classification stays exhaustive. |
| `TransportStdio` | Struct | `Command`, `Args`, `Env`, `CredentialEnv` (env var name that receives the resolved credential). |
| `TransportHTTP` | Struct | `URL` (http/https only), `Header` (custom headers; `Authorization` is rejected — credentials flow through `CredentialRef`). |
| `CredentialRef` | String | Opaque reference passed to `credentials.Resolver.Fetch`. Empty = unauthenticated. |
| `Option` | Function type | `WithResolver`, `WithMetricsRecorder`, `WithTracerProvider`, `WithMaxResponseBytes`. |
| `MCPMetricsRecorder` | Interface | Optional extension on `telemetry.MetricsRecorder`. Detected via type assertion at construction time (D115). |

### Constants

- `MaxServers = 32` — maximum number of MCP servers per `Invoker`.
- `DefaultMaxResponseBytes = 16 * 1024 * 1024` — 16 MiB response cap.

## Usage Patterns

### Construction

Build an `Invoker` by passing a slice of `Server` values plus optional configuration. Credentials resolve eagerly; if any session fails to open, already-opened sessions are closed in LIFO order and `New` returns a typed system error.

```go title="Constructing an mcp.Invoker"
servers := []mcp.Server{
    {
        LogicalName: "github",
        Transport:   mcp.TransportStdio{Command: "mcp-github"},
    },
    {
        LogicalName:   "remote-tools",
        CredentialRef: "mcp-bearer",
        Transport:     mcp.TransportHTTP{URL: "https://mcp.example.com/v1"},
    },
}

inv, err := mcp.New(ctx, servers,
    mcp.WithResolver(myResolver),
    mcp.WithMaxResponseBytes(16*1024*1024),
)
if err != nil {
    return err
}
defer inv.Close()
```

### Tool Namespacing

Every tool advertised by an MCP server is exposed to the orchestrator under the composed name `{LogicalName}__{mcpToolName}` (D111). The double-underscore separator is unambiguous, LLM-safe, and reversible — dispatch splits on the leftmost `__` so server tool names that themselves contain `__` still route correctly.

`LogicalName` must match `^[a-zA-Z0-9_-]{1,64}$` and must not contain `__` (reserved separator). Collisions across the composed namespace are detected at `New` time and surface as `SystemError`.

```text
Server{LogicalName: "github"} exposes "list_issues"
-> tool is advertised to the LLM as "github__list_issues"
```

### Wiring into the Orchestrator

`mcp.Invoker` satisfies `tools.Invoker`, so you pass it to `orchestrator.WithToolInvoker`. Tool definitions come from `inv.Definitions()`, which returns a deterministic, sorted slice suitable for `praxis.InvocationRequest.Tools`.

```go title="Composition with the orchestrator"
defs := inv.Definitions()
orch, err := orchestrator.New(provider,
    orchestrator.WithToolInvoker(inv),
)

result, err := orch.Invoke(ctx, praxis.InvocationRequest{
    Messages: []llm.Message{...},
    Tools:    defs,
})
```

To mix MCP tools with native tools, implement a composite `tools.Invoker` that dispatches on tool name prefix (`{logicalName}__` → `mcp.Invoker`, anything else → your native invoker). See the [MCP Integration guide](/docs/guides/mcp-integration) for a worked example.

### Trust Boundary (D116)

:::warning

MCP tool output crosses a trust boundary: the server is a separate process or remote service, potentially operated by a third party. All `ToolResult.Content` emitted by an `mcp.Invoker` must pass through a `PostToolFilter` before it reaches the LLM. Content flattening (text-only, `\n\n`-joined) is defence in depth, not a substitute for filtering.

:::

No `identity.Signer` JWT is forwarded to MCP servers (D118). If an MCP call requires a downstream identity assertion, inject it via `CredentialRef` + `Resolver` and treat it as a credential.

### Error Classification (D113)

Dispatch-path failures are mapped to `ToolSubKind` in this order (first match wins):

| Cause | `ToolSubKind` |
|---|---|
| Context cancellation, deadline, transport disconnect, `io.EOF`, `net.Error`, `tls:`/`x509:` errors | `Network` |
| Session gone (`sdkmcp.ErrSessionMissing`), HTTP 401/403 | `CircuitOpen` |
| JSON schema violations (`*json.SyntaxError`, `*json.UnmarshalTypeError`) | `SchemaViolation` |
| Everything else (JSON-RPC protocol errors, server-defined codes, tool-level `IsError=true`) | `ServerError` |

Construction failures (validation, credential resolution, session open) are `ErrorKindSystem` on the typed error taxonomy. Dispatches after `Close()` also return `ErrorKindSystem`.

### Content Flattening (D114)

MCP responses can contain multiple content blocks of varying types. The adapter filters to `TextContent` blocks only and joins them with a double newline (`\n\n`). Non-text blocks (image, audio, resource references) are silently dropped in the current release. Empty content is a valid success outcome; `PostToolFilter` implementations must not treat it as failure.

### Response-Size Cap

`WithMaxResponseBytes(n)` caps the estimated payload size of any single tool call. The estimator counts large-payload fields (text, image data, audio data) only; exceeding the cap returns `ToolStatusError` + `ToolSubKindServerError`. Default: 16 MiB. This is a resource guard, not a budget dimension (see the [budget package](./budget.md) for token/wall-clock/cost enforcement).

### Observability

`mcp` emits three metrics when the injected `MetricsRecorder` also satisfies the `MCPMetricsRecorder` extension:

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `praxis_mcp_calls_total` | Counter | `server`, `transport`, `status` | One increment per dispatched `CallTool` |
| `praxis_mcp_call_duration_seconds` | Histogram | `server`, `transport`, `status` | Wall-clock time from send to return |
| `praxis_mcp_transport_errors_total` | Counter | `server`, `transport`, `kind` | Transport-layer failures, separated from tool-level errors |

Label cardinality is bounded: `server` ≤ 32, `transport ∈ {"stdio", "http"}`, `status ∈ {"ok", "error"}`, `kind ∈ {"network", "server_error", "schema_violation", "circuit_open"}`.

A child OpenTelemetry span `praxis.mcp.toolcall` is started around every `CallTool`; inject a provider via `WithTracerProvider`.

## Full API Reference

For complete type and method documentation, see [mcp on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/mcp).

See also: the [MCP Integration guide](/docs/guides/mcp-integration) and the [stdio](/docs/examples/mcp-stdio) and [HTTP](/docs/examples/mcp-http) examples.

---
title: "MCP HTTP Example"
description: "Demonstrates wiring a remote Streamable HTTP MCP server into a praxis orchestrator with bearer-token credential resolution."
sidebar_label: "MCP (HTTP)"
sidebar_position: 8
keywords: [mcp, http, TransportHTTP, bearer-token, credentials, resolver, streamable, remote, anthropic]
rag_section: "examples"
rag_packages: ["orchestrator", "mcp", "credentials", "llm", "llm/anthropic"]
rag_interfaces: ["mcp.Invoker", "credentials.Resolver"]
rag_difficulty: "advanced"
---

# MCP HTTP Example

This example wires a remote Streamable HTTP MCP server into a praxis orchestrator via the [`mcp` sub-module](../api-reference/mcp.md) and resolves a bearer token through a `credentials.Resolver`. Swap the URL, `CredentialRef`, and resolver implementation for your own deployment.

## Source Code

```go title="examples/mcp/http/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
    "context"
    "fmt"
    "log"
    "os"

    "github.com/praxis-os/praxis"
    "github.com/praxis-os/praxis/credentials"
    "github.com/praxis-os/praxis/llm"
    "github.com/praxis-os/praxis/llm/anthropic"
    "github.com/praxis-os/praxis/mcp"
    "github.com/praxis-os/praxis/orchestrator"
)

// envResolver is a minimal credentials.Resolver that reads tokens
// from environment variables. Production deployments should use a
// KMS-backed resolver; this is a demo.
type envResolver struct{}

func (envResolver) Fetch(_ context.Context, ref string) (credentials.Credential, error) {
    token := os.Getenv("MCP_TOKEN")
    if token == "" {
        return credentials.Credential{}, fmt.Errorf("MCP_TOKEN not set for ref %q", ref)
    }
    return credentials.Credential{Value: []byte(token)}, nil
}

func main() {
    ctx := context.Background()

    // 1. Build the MCP Invoker fronting one HTTP server with
    //    bearer-token authentication.
    servers := []mcp.Server{
        {
            LogicalName:   "remote-tools",
            CredentialRef: "mcp-bearer",
            Transport: mcp.TransportHTTP{
                URL: "https://mcp.example.com/v1",
                Header: map[string]string{
                    "X-Custom-Header": "praxis-mcp-example",
                },
            },
        },
    }

    inv, err := mcp.New(ctx, servers,
        mcp.WithResolver(envResolver{}),
        mcp.WithMaxResponseBytes(16*1024*1024), // 16 MiB (default)
    )
    if err != nil {
        log.Fatalf("mcp.New: %v", err)
    }
    defer inv.Close()

    // 2. Feed the MCP tool definitions to the LLM request.
    defs := inv.Definitions()
    fmt.Printf("MCP adapter fronts %d tools:\n", len(defs))
    for _, d := range defs {
        fmt.Printf("  %s -- %s\n", d.Name, d.Description)
    }

    // 3. Build the orchestrator with the MCP Invoker.
    provider := anthropic.New(os.Getenv("ANTHROPIC_API_KEY"))
    orch, err := orchestrator.New(provider,
        orchestrator.WithToolInvoker(inv),
    )
    if err != nil {
        log.Fatalf("orchestrator.New: %v", err)
    }

    // 4. Run an invocation.
    result, err := orch.Invoke(ctx, praxis.InvocationRequest{
        Messages: []llm.Message{{
            Role:  llm.RoleUser,
            Parts: []llm.MessagePart{llm.TextPart("What tools do you have?")},
        }},
        Tools: defs,
    })
    if err != nil {
        log.Fatalf("orchestrator.Invoke: %v", err)
    }

    fmt.Printf("\nFinal state: %s\n", result.FinalState)
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/mcp/http/main.go)

## Running

Requires both environment variables:

```bash title="terminal"
ANTHROPIC_API_KEY=sk-ant-... MCP_TOKEN=<token> go run examples/mcp/http/main.go
```

## Expected Output

```
MCP adapter fronts 4 tools:
  remote-tools__search -- Search the knowledge base
  remote-tools__fetch -- Fetch a document by ID
  remote-tools__summarise -- Summarise a document
  remote-tools__translate -- Translate text

Final state: Completed
```

Tool count and names depend on the MCP server you target.

## What This Demonstrates

1. **`TransportHTTP` wiring** -- the `URL` must be `http://` or `https://`; custom `Header` entries are merged, but `Authorization` is rejected in headers and must flow through `CredentialRef`.
2. **`credentials.Resolver` integration** -- `CredentialRef: "mcp-bearer"` is passed to `envResolver.Fetch`, which returns the bearer token. The credential buffer is zeroed after the string materialises into the round-tripper.
3. **Custom headers** -- `X-Custom-Header` is merged via `http.Header.Add`; it does not replace `Authorization`.
4. **Default response cap** -- `WithMaxResponseBytes(16*1024*1024)` matches the default (`DefaultMaxResponseBytes`). Pass a smaller value to tighten the guard; non-positive values fall back to the default.
5. **Metrics-ready** -- inject a `MetricsRecorder` that also satisfies `mcp.MCPMetricsRecorder` to emit `praxis_mcp_calls_total`, `praxis_mcp_call_duration_seconds`, and `praxis_mcp_transport_errors_total` with bounded labels.

## Next Steps

- See the [stdio example](./mcp-stdio.md) for a local-binary transport.
- Read the [MCP Integration guide](../guides/mcp-integration.md) for credentialing, composite invokers, trust-boundary enforcement, and failure-mode mapping.

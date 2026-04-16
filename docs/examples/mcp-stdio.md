---
title: "MCP Stdio Example"
description: "Demonstrates wiring a local stdio-based MCP server into a praxis orchestrator through the mcp sub-module and dispatching tool calls."
sidebar_label: "MCP (stdio)"
sidebar_position: 7
keywords: [mcp, stdio, TransportStdio, Invoker, tools, namespacing, github, anthropic]
rag_section: "examples"
rag_packages: ["orchestrator", "mcp", "llm", "llm/anthropic", "tools"]
rag_interfaces: ["mcp.Invoker", "tools.Invoker"]
rag_difficulty: "advanced"
---

# MCP Stdio Example

This example wires a local stdio-based MCP server into a praxis orchestrator via the [`mcp` sub-module](../api-reference/mcp.md). It assumes a server binary on `PATH` called `mcp-github` that exposes GitHub tools (`list_issues`, `create_issue`, etc.) over MCP stdio. Swap the `Command` and `LogicalName` for your own server.

## Source Code

```go title="examples/mcp/stdio/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
    "context"
    "fmt"
    "log"
    "os"

    "github.com/praxis-os/praxis"
    "github.com/praxis-os/praxis/llm"
    "github.com/praxis-os/praxis/llm/anthropic"
    "github.com/praxis-os/praxis/mcp"
    "github.com/praxis-os/praxis/orchestrator"
)

func main() {
    ctx := context.Background()

    // 1. Build the MCP Invoker fronting one stdio server.
    servers := []mcp.Server{
        {
            LogicalName: "github",
            Transport: mcp.TransportStdio{
                Command: "mcp-github",
            },
        },
    }

    inv, err := mcp.New(ctx, servers,
        mcp.WithMaxResponseBytes(8*1024*1024), // 8 MiB cap
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

    // 4. Run an invocation. The orchestrator routes MCP-namespaced
    //    tool calls (e.g., "github__list_issues") through the MCP
    //    adapter automatically.
    result, err := orch.Invoke(ctx, praxis.InvocationRequest{
        Messages: []llm.Message{{
            Role:  llm.RoleUser,
            Parts: []llm.MessagePart{llm.TextPart("List open issues on praxis-os/praxis")},
        }},
        Tools: defs,
    })
    if err != nil {
        log.Fatalf("orchestrator.Invoke: %v", err)
    }

    fmt.Printf("\nFinal state: %s\n", result.FinalState)
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/mcp/stdio/main.go)

## Running

Requires an MCP stdio server binary on `PATH` and an Anthropic API key:

```bash title="terminal"
ANTHROPIC_API_KEY=sk-ant-... go run examples/mcp/stdio/main.go
```

## Expected Output

```
MCP adapter fronts 3 tools:
  github__list_issues -- List issues on a repository
  github__create_issue -- Create an issue on a repository
  github__list_pulls -- List pull requests on a repository

Final state: Completed
```

The exact tool count and names depend on the MCP server you target.

## What This Demonstrates

1. **Constructing an `mcp.Invoker`** with a single stdio server via `mcp.New`.
2. **Implicit credential skip** -- no `CredentialRef` is set, so the session opens unauthenticated.
3. **Response cap** -- `WithMaxResponseBytes(8*1024*1024)` halves the default 16 MiB cap.
4. **Tool namespacing** -- every tool is exposed to the LLM as `github__<tool>` following the `{LogicalName}__{mcpToolName}` rule (D111).
5. **Seamless composition** -- `mcp.Invoker` satisfies `tools.Invoker`, so `orchestrator.WithToolInvoker(inv)` is all the wiring needed.
6. **Idempotent teardown** -- `defer inv.Close()` flushes sessions in LIFO order.

## Next Steps

- See the [HTTP example](./mcp-http.md) for a credentialed remote server.
- Read the [MCP Integration guide](../guides/mcp-integration.md) for mixing MCP tools with native tools and enforcing the trust boundary via `PostToolFilter`.

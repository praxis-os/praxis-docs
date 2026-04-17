---
title: "tools Package"
description: "The tools package defines the tool execution abstraction, including the Invoker interface, tool call types, and the agent-as-tool composition pattern."
sidebar_label: "tools"
sidebar_position: 4
keywords: [praxis, tools, invoker, tool-call, tool-result, invocation-context, agent-as-tool, composition, null-invoker]
rag_section: "api-reference"
rag_packages: ["tools"]
rag_interfaces: ["tools.Invoker"]
rag_difficulty: "intermediate"
---

# tools Package

## Purpose

The `tools` package defines how praxis executes tool calls requested by an LLM. When a model responds with a tool-call instruction, the orchestrator delegates to the registered `Invoker` implementation. This package provides the interface contract, the data types that flow through it, and a `NullInvoker` default that rejects all tool calls gracefully.

The package also defines `InvocationContext`, a read-only container that gives tool implementations access to framework state -- the current invocation ID, budget snapshot, and identity token -- without coupling them to orchestrator internals.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Invoker` | Interface | Executes a tool call and returns a result. Single method: `InvokeTool`. |
| `ToolCall` | Struct | Describes a tool invocation requested by the LLM. Contains name, ID, and JSON arguments. |
| `ToolResult` | Struct | The outcome of a tool execution. Contains output content, status, and optional error. |
| `ToolStatus` | Enum | Terminal status: `ToolStatusSuccess`, `ToolStatusDenied`, `ToolStatusNotImplemented`, `ToolStatusError`. |
| `InvocationContext` | Struct | Read-only container for framework state passed to tools. Includes invocation ID, budget snapshot, identity token. |
| `NullInvoker` | Struct | Default invoker that returns `ToolStatusNotImplemented` for every tool call. |

For Model Context Protocol servers, use the [`mcp` package](./mcp.md), which implements `tools.Invoker` over stdio and Streamable HTTP transports.

## Struct Field Reference

### ToolCall

| Field | Type | Description |
|---|---|---|
| `CallID` | `string` | Unique identifier assigned by the LLM. Echoed back in `ToolResult.CallID` for correlation. |
| `Name` | `string` | Tool name as declared in the `ToolDefinition`. |
| `ArgumentsJSON` | `[]byte` | Raw JSON arguments produced by the LLM. Parse into your tool's argument struct. |

### ToolResult

| Field | Type | Description |
|---|---|---|
| `Status` | `ToolStatus` | `ToolStatusSuccess`, `ToolStatusDenied`, `ToolStatusNotImplemented`, or `ToolStatusError`. |
| `Content` | `string` | Tool output presented to the LLM on the next turn. |
| `Err` | `error` | Typed error from the invocation. May be non-nil even when `Status` is `ToolStatusSuccess` (e.g., nested-invocation errors that were handled). |
| `CallID` | `string` | Echo of the `ToolCall.CallID`. |

### InvocationContext

Read-only ambient state passed to `Invoker.InvokeTool`. Used for budget-aware decisions, tracing, and identity propagation.

| Field | Type | Description |
|---|---|---|
| `Metadata` | `map[string]string` | Caller-supplied key-value pairs from `InvocationRequest.Metadata`. |
| `Budget` | `budget.BudgetSnapshot` | Current resource consumption. |
| `InvocationID` | `string` | Unique identifier for the current invocation. |
| `SignedIdentity` | `string` | Ed25519-signed JWT identity for downstream authentication. See [identity package](./identity.md). |
| `SpanContext` | `trace.SpanContext` | OpenTelemetry span context for child span creation. |

## Usage Patterns

### Implementing an Invoker

An `Invoker` receives a `ToolCall` and an `InvocationContext` and returns a `ToolResult`. The implementation dispatches on the tool name, executes the logic, and returns structured output.

```go title="Simple invoker implementation"
type MyInvoker struct{}

func (i *MyInvoker) InvokeTool(ctx context.Context, call tools.ToolCall, ic tools.InvocationContext) (tools.ToolResult, error) {
    switch call.Name {
    case "get_weather":
        result, err := fetchWeather(ctx, call.ArgumentsJSON)
        if err != nil {
            return tools.ToolResult{
                Status: tools.ToolStatusError,
                Err:    err,
                CallID: call.CallID,
            }, nil
        }
        return tools.ToolResult{
            Status:  tools.ToolStatusSuccess,
            Content: result,
            CallID:  call.CallID,
        }, nil
    default:
        return tools.ToolResult{Status: tools.ToolStatusNotImplemented, CallID: call.CallID}, nil
    }
}
```

Return a `ToolResult` with `ToolStatusError` for domain-level failures (e.g., API returned 404). Return a Go error for infrastructure-level failures (e.g., network timeout). The orchestrator classifies Go errors through the error taxonomy; `ToolResult` errors are passed back to the LLM as tool output.

### Using InvocationContext

`InvocationContext` gives tools read-only access to framework state. Tools can use the invocation ID for correlation, the budget snapshot to make cost-aware decisions, and the identity token for downstream authentication.

```go title="Accessing invocation context"
func (i *MyInvoker) InvokeTool(ctx context.Context, call tools.ToolCall, ic tools.InvocationContext) (tools.ToolResult, error) {
    log.Printf("invocation=%s tool=%s in_tokens_used=%d",
        ic.InvocationID, call.Name, ic.Budget.InputTokensUsed)
    // ...
}
```

### Agent-as-Tool Composition

A powerful pattern in praxis is registering another `Orchestrator` as a tool. The outer agent's `Invoker` calls `Invoke` on an inner orchestrator, passing the tool arguments as the user message. This creates hierarchical agent systems where a planning agent delegates to specialized sub-agents.

```go title="Agent-as-tool pattern"
func (i *AgentToolInvoker) InvokeTool(ctx context.Context, call tools.ToolCall, ic tools.InvocationContext) (tools.ToolResult, error) {
    innerResult, err := i.innerOrch.Invoke(ctx, praxis.InvocationRequest{
        Messages: []llm.Message{
            {Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart(string(call.ArgumentsJSON))}},
        },
        ParentToken: ic.SignedIdentity,
    })
    if err != nil {
        return tools.ToolResult{Status: tools.ToolStatusError, Err: err, CallID: call.CallID}, nil
    }
    var content string
    if innerResult.Response != nil {
        for _, p := range innerResult.Response.Parts {
            if p.Type == llm.PartTypeText {
                content += p.Text
            }
        }
    }
    return tools.ToolResult{Status: tools.ToolStatusSuccess, Content: content, CallID: call.CallID}, nil
}
```

Identity chaining propagates the parent invocation's identity token into the child via the `praxis.parent_token` JWT claim. See the [identity package](./identity.md) for details.

## Full API Reference

For complete type and method documentation, see [tools on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/tools).

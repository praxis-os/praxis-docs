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
| `ToolStatus` | Enum | Terminal status of a tool call: `StatusSuccess`, `StatusError`, `StatusDenied`. |
| `InvocationContext` | Struct | Read-only container for framework state passed to tools. Includes invocation ID, budget snapshot, identity token. |
| `NullInvoker` | Struct | Default invoker that returns `StatusDenied` for every tool call. |

## Usage Patterns

### Implementing an Invoker

An `Invoker` receives a `ToolCall` and an `InvocationContext` and returns a `ToolResult`. The implementation dispatches on the tool name, executes the logic, and returns structured output.

```go title="Simple invoker implementation"
type MyInvoker struct{}

func (i *MyInvoker) InvokeTool(ctx context.Context, call tools.ToolCall, ic tools.InvocationContext) (tools.ToolResult, error) {
    switch call.Name {
    case "get_weather":
        result, err := fetchWeather(ctx, call.Arguments)
        if err != nil {
            return tools.ToolResult{Status: tools.StatusError, Error: err.Error()}, nil
        }
        return tools.ToolResult{Status: tools.StatusSuccess, Content: result}, nil
    default:
        return tools.ToolResult{Status: tools.StatusDenied}, nil
    }
}
```

Return a `ToolResult` with `StatusError` for domain-level failures (e.g., API returned 404). Return a Go error for infrastructure-level failures (e.g., network timeout). The orchestrator classifies Go errors through the error taxonomy; `ToolResult` errors are passed back to the LLM as tool output.

### Using InvocationContext

`InvocationContext` gives tools read-only access to framework state. Tools can use the invocation ID for correlation, the budget snapshot to make cost-aware decisions, and the identity token for downstream authentication.

```go title="Accessing invocation context"
func (i *MyInvoker) InvokeTool(ctx context.Context, call tools.ToolCall, ic tools.InvocationContext) (tools.ToolResult, error) {
    log.Printf("invocation=%s tool=%s budget_remaining=%d",
        ic.InvocationID, call.Name, ic.BudgetSnapshot.RemainingTokens)
    // ...
}
```

### Agent-as-Tool Composition

A powerful pattern in praxis is registering another `Orchestrator` as a tool. The outer agent's `Invoker` calls `Invoke` on an inner orchestrator, passing the tool arguments as the user message. This creates hierarchical agent systems where a planning agent delegates to specialized sub-agents.

```go title="Agent-as-tool pattern"
func (i *AgentToolInvoker) InvokeTool(ctx context.Context, call tools.ToolCall, ic tools.InvocationContext) (tools.ToolResult, error) {
    innerResult, err := i.innerOrch.Invoke(ctx, orchestrator.InvocationRequest{
        Messages: []llm.Message{
            {Role: llm.RoleUser, Parts: []llm.MessagePart{{Type: llm.PartTypeText, Text: call.Arguments}}},
        },
    })
    if err != nil {
        return tools.ToolResult{Status: tools.StatusError, Error: err.Error()}, nil
    }
    return tools.ToolResult{Status: tools.StatusSuccess, Content: innerResult.Message.Text()}, nil
}
```

Identity chaining propagates the parent invocation's identity token into the child via the `praxis.parent_token` JWT claim. See the [identity package](./identity.md) for details.

## Full API Reference

For complete type and method documentation, see [tools on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/tools).

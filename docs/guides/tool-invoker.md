---
title: "Writing a Tool Invoker"
description: "How to implement the tools.Invoker interface for custom tool execution and the agent-as-tool composition pattern."
sidebar_label: "Tool Invoker"
sidebar_position: 3
keywords: [praxis, tools, Invoker, ToolCall, ToolResult, agent-as-tool, composition, InvocationContext]
rag_section: "guides"
rag_packages: ["tools"]
rag_interfaces: ["tools.Invoker"]
rag_difficulty: "advanced"
---

# Writing a Tool Invoker

Tools are the mechanism by which LLM agents interact with external systems. This guide walks through implementing the `tools.Invoker` interface, routing tool calls to handlers, handling errors correctly, and composing agents using the agent-as-tool pattern.

## The Invoker Interface

The `tools.Invoker` interface has a single method that the orchestrator calls whenever the LLM requests a tool invocation.

```go title="tools.Invoker interface"
type Invoker interface {
    Invoke(ctx context.Context, ic InvocationContext, call ToolCall) (ToolResult, error)
}
```

`InvocationContext` provides read-only access to metadata about the current invocation. It is constructed by the orchestrator and passed to the invoker on every tool call.

```go title="tools.InvocationContext fields"
type InvocationContext struct {
    InvocationID string          // Unique identifier for this invocation
    Budget       BudgetSnapshot  // Current budget consumption (read-only snapshot)
    Identity     IdentityToken   // Identity token for this invocation (if configured)
}
```

`ToolCall` contains the tool name and arguments as requested by the LLM:

```go title="tools.ToolCall fields"
type ToolCall struct {
    ID        string          // Unique ID assigned by the LLM
    Name      string          // Tool name matching a registered ToolDef
    Arguments json.RawMessage // JSON arguments from the LLM
}
```

The invoker returns a `ToolResult` with a status and content, or an error for system-level failures that should halt the invocation.

## Routing Tool Calls

A typical invoker routes tool calls by name to specific handler functions. This pattern keeps each tool's logic isolated and testable.

```go title="tools/router.go"
type Router struct {
    handlers map[string]func(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error)
}

func NewRouter() *Router {
    return &Router{handlers: make(map[string]func(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error))}
}

func (r *Router) Register(name string, handler func(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error)) {
    r.handlers[name] = handler
}

func (r *Router) Invoke(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
    handler, ok := r.handlers[call.Name]
    if !ok {
        return tools.ToolResult{
            Status:  tools.Error,
            Content: fmt.Sprintf("unknown tool: %s", call.Name),
        }, nil
    }
    return handler(ctx, ic, call)
}
```

Register the router with the orchestrator:

```go title="main.go"
router := tools.NewRouter()
router.Register("get_weather", handleGetWeather)
router.Register("search_docs", handleSearchDocs)

orch := orchestrator.New(provider,
    orchestrator.WithInvoker(router),
)
```

:::tip
Return a `ToolResult` with `Status: tools.Error` for unknown tool names rather than returning a Go error. This lets the LLM see the error and potentially self-correct, rather than terminating the entire invocation.
:::

## Error Handling

There are two distinct categories of tool failures, and they must be handled differently.

**Tool-level errors** are expected failures from the tool's domain logic -- a search returning no results, an API returning a 404, or invalid arguments from the LLM. Return these as a `ToolResult` with `Status: tools.Error`. The LLM sees the error message and can decide how to proceed.

```go title="Tool-level error"
func handleGetWeather(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
    var args struct {
        City string `json:"city"`
    }
    if err := json.Unmarshal(call.Arguments, &args); err != nil {
        return tools.ToolResult{
            Status:  tools.Error,
            Content: "invalid arguments: expected {\"city\": \"string\"}",
        }, nil
    }

    weather, err := fetchWeather(ctx, args.City)
    if err != nil {
        return tools.ToolResult{
            Status:  tools.Error,
            Content: fmt.Sprintf("could not fetch weather for %s: %s", args.City, err),
        }, nil
    }

    return tools.ToolResult{
        Status:  tools.Success,
        Content: weather,
    }, nil
}
```

**System-level errors** are unexpected failures that indicate a bug in the tool implementation or infrastructure -- a nil pointer, database connection failure, or panic recovery. Return these as a Go `error` (the second return value). The orchestrator classifies this as a `tool` error kind and transitions the invocation to the `Failed` terminal state.

```go title="System-level error"
func handleSearchDocs(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
    conn, err := getDBConnection(ctx)
    if err != nil {
        // System failure -- invocation should not continue
        return tools.ToolResult{}, fmt.Errorf("database connection failed: %w", err)
    }
    // ...
}
```

The `ToolResult.Status` field has three values:

| Status | Meaning |
|--------|---------|
| `Success` | Tool executed successfully; content contains the result |
| `Error` | Tool encountered a domain error; content contains the error message for the LLM |
| `Partial` | Tool produced partial results (e.g., truncated output); content contains what was produced |

## Agent-as-Tool Pattern

One of the most powerful composition patterns in praxis is wrapping another orchestrator as a tool. The outer agent delegates a subtask to a specialized inner agent by invoking it as a tool call.

```go title="tools/agent_tool.go"
type AgentTool struct {
    inner *orchestrator.Orchestrator
}

func NewAgentTool(inner *orchestrator.Orchestrator) *AgentTool {
    return &AgentTool{inner: inner}
}

func (t *AgentTool) Invoke(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
    var args struct {
        Task string `json:"task"`
    }
    if err := json.Unmarshal(call.Arguments, &args); err != nil {
        return tools.ToolResult{Status: tools.Error, Content: "invalid arguments"}, nil
    }

    result, err := t.inner.Invoke(ctx, orchestrator.InvocationRequest{
        Model:    "claude-sonnet-4-20250514",
        Messages: []llm.Message{{Role: "user", Parts: []llm.MessagePart{{Type: "text", Text: args.Task}}}},
    })
    if err != nil {
        return tools.ToolResult{Status: tools.Error, Content: err.Error()}, nil
    }

    return tools.ToolResult{
        Status:  tools.Success,
        Content: result.Message.Parts[0].Text,
    }, nil
}
```

The agent-as-tool pattern preserves six composition properties that ensure the nested invocation integrates cleanly with the outer agent:

| Property | Code | Behavior |
|----------|------|----------|
| Child spans | CP1 | The inner invocation creates a new root span with a `SpanLink` back to the outer span, not a parent-child relationship |
| Event correlation | CP2 | Inner lifecycle events include the outer invocation ID in metadata for cross-invocation tracing |
| Shared budget | CP3 | The inner invocation shares the outer budget guard; tokens and cost consumed by the inner agent count against the outer budget |
| Cancel propagation | CP4 | Context cancellation propagates from outer to inner via the shared `context.Context` |
| Typed error propagation | CP5 | Errors from the inner invocation are classified and surfaced as tool-level errors to the outer agent |
| Identity chaining | CP6 | The inner invocation's identity token includes a `praxis.parent_token` claim linking to the outer agent's identity |

:::note
Child spans use `SpanLink` rather than parent-child because the inner invocation is a logically separate trace root. This prevents the inner agent's spans from inflating the outer agent's span tree while maintaining causal correlation.
:::

## Example: Calculator Tool

A complete, minimal tool invoker that handles basic arithmetic.

```go title="tools/calculator.go"
package tools

import (
    "context"
    "encoding/json"
    "fmt"
    "math"

    "github.com/praxis-os/praxis/tools"
)

type Calculator struct{}

func (c *Calculator) Invoke(ctx context.Context, ic tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
    if call.Name != "calculate" {
        return tools.ToolResult{
            Status:  tools.Error,
            Content: fmt.Sprintf("unknown tool: %s", call.Name),
        }, nil
    }

    var args struct {
        Operation string  `json:"operation"`
        A         float64 `json:"a"`
        B         float64 `json:"b"`
    }
    if err := json.Unmarshal(call.Arguments, &args); err != nil {
        return tools.ToolResult{
            Status:  tools.Error,
            Content: "expected {\"operation\": \"add|sub|mul|div\", \"a\": number, \"b\": number}",
        }, nil
    }

    var result float64
    switch args.Operation {
    case "add":
        result = args.A + args.B
    case "sub":
        result = args.A - args.B
    case "mul":
        result = args.A * args.B
    case "div":
        if args.B == 0 {
            return tools.ToolResult{
                Status:  tools.Error,
                Content: "division by zero",
            }, nil
        }
        result = args.A / args.B
    default:
        return tools.ToolResult{
            Status:  tools.Error,
            Content: fmt.Sprintf("unknown operation: %s", args.Operation),
        }, nil
    }

    if math.IsNaN(result) || math.IsInf(result, 0) {
        return tools.ToolResult{
            Status:  tools.Error,
            Content: "result is not a finite number",
        }, nil
    }

    return tools.ToolResult{
        Status:  tools.Success,
        Content: fmt.Sprintf("%.6f", result),
    }, nil
}
```

Register it with the orchestrator alongside the tool definition that the LLM sees:

```go title="main.go"
orch := orchestrator.New(provider,
    orchestrator.WithInvoker(&Calculator{}),
    orchestrator.WithTools([]llm.ToolDef{{
        Name:        "calculate",
        Description: "Perform basic arithmetic operations",
        Parameters: json.RawMessage(`{
            "type": "object",
            "properties": {
                "operation": {"type": "string", "enum": ["add", "sub", "mul", "div"]},
                "a": {"type": "number"},
                "b": {"type": "number"}
            },
            "required": ["operation", "a", "b"]
        }`),
    }}),
)
```

For the full `tools` package API, see [pkg.go.dev/github.com/praxis-os/praxis/tools](https://pkg.go.dev/github.com/praxis-os/praxis/tools).

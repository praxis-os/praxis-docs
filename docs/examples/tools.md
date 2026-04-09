---
title: "Tools Example"
description: "Demonstrates a custom tools.Invoker that dispatches tool calls to a weather function using the Anthropic provider."
sidebar_label: "Tools"
sidebar_position: 6
keywords: [tools, Invoker, tool-call, weather, ToolDefinition, ToolResult, ToolStatusSuccess, ToolStatusNotImplemented, InputSchema]
rag_section: "examples"
rag_packages: ["orchestrator", "tools", "llm", "llm/anthropic"]
rag_interfaces: ["tools.Invoker"]
rag_difficulty: "intermediate"
---

# Tools Example

The tools example shows a custom `tools.Invoker` that handles a `get_weather` tool call. It uses the real Anthropic provider, demonstrating the full tool-use cycle where the LLM decides to call a tool and the orchestrator feeds the result back.

## Source Code

```go title="examples/tools/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/anthropic"
	"github.com/praxis-os/praxis/orchestrator"
	"github.com/praxis-os/praxis/tools"
)

// weatherInvoker handles "get_weather" tool calls.
type weatherInvoker struct{}

func (weatherInvoker) Invoke(_ context.Context, _ tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
	switch call.Name {
	case "get_weather":
		var args struct {
			City string `json:"city"`
		}
		_ = json.Unmarshal(call.ArgumentsJSON, &args)
		return tools.ToolResult{
			CallID:  call.CallID,
			Status:  tools.ToolStatusSuccess,
			Content: fmt.Sprintf(`{"city":%q,"temp":"18°C","condition":"cloudy"}`, args.City),
		}, nil
	default:
		return tools.ToolResult{
			CallID:  call.CallID,
			Status:  tools.ToolStatusNotImplemented,
			Content: fmt.Sprintf("unknown tool: %s", call.Name),
		}, nil
	}
}

func main() {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "ANTHROPIC_API_KEY not set")
		os.Exit(1)
	}

	orch, err := orchestrator.New(
		anthropic.New(apiKey),
		orchestrator.WithToolInvoker(weatherInvoker{}),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	result, err := orch.Invoke(context.Background(), praxis.InvocationRequest{
		Model: "claude-haiku-4-20250514",
		Messages: []llm.Message{
			{Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("What's the weather in Berlin?")}},
		},
		Tools: []llm.ToolDefinition{{
			Name:        "get_weather",
			Description: "Get current weather for a city",
			InputSchema: []byte(`{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}`),
		}},
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if result.Response != nil {
		for _, part := range result.Response.Parts {
			if part.Type == llm.PartTypeText {
				fmt.Println(part.Text)
			}
		}
	}
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/tools/main.go)

## Running

This example requires an Anthropic API key:

```bash title="terminal"
ANTHROPIC_API_KEY=sk-ant-... go run examples/tools/main.go
```

## Expected Output

```
The weather in Berlin is currently 18°C and cloudy.
```

The exact wording varies because the LLM generates a natural language summary from the tool result.

## What This Demonstrates

1. **Implementing the `tools.Invoker` interface** -- `weatherInvoker` implements `Invoke(ctx, InvocationContext, ToolCall) (ToolResult, error)`
2. **Providing `ToolDefinition` with JSON Schema** -- the `InputSchema` field tells the LLM what arguments the tool accepts
3. **Deserializing `call.ArgumentsJSON`** -- the LLM sends arguments as raw JSON; the invoker unmarshals them
4. **Returning structured `ToolResult` values** -- `ToolStatusSuccess` for handled tools, `ToolStatusNotImplemented` for unknown tools
5. **The orchestrator's tool-use loop** -- the LLM requests a tool call, the invoker executes it, the result is fed back to the LLM for a final response

## State Machine Trace

`Created` -> `Initializing` -> `PreHook` -> `LLMCall` -> `ToolDecision` -> `ToolCall` -> `PostToolFilter` -> `LLMContinuation` -> `LLMCall` -> `ToolDecision` -> `PostHook` -> `Completed`.

See [Tool Invoker Guide](/docs/guides/tool-invoker) for the full guide on building custom tool invokers.

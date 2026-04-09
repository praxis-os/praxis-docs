---
title: "Streaming Example"
description: "Demonstrates InvokeStream() by draining lifecycle events from the event channel and printing each event as it arrives."
sidebar_label: "Streaming"
sidebar_position: 5
keywords: [streaming, InvokeStream, events, channel, lifecycle, event-type, terminal, IsTerminal, tool-call]
rag_section: "examples"
rag_packages: ["orchestrator", "event", "tools", "llm", "llm/mock"]
rag_interfaces: ["orchestrator.Orchestrator"]
rag_difficulty: "intermediate"
---

# Streaming Example

The streaming example uses `InvokeStream` to observe every lifecycle event in real time. It sets up a mock provider that triggers a tool call, creating a richer event stream that exercises the full tool-use cycle.

## Source Code

```go title="examples/streaming/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/event"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/mock"
	"github.com/praxis-os/praxis/orchestrator"
	"github.com/praxis-os/praxis/tools"
)

func main() {
	tc := &llm.LLMToolCall{CallID: "c1", Name: "greet", ArgumentsJSON: []byte(`{"name":"World"}`)}

	provider := mock.New(
		mock.Response{LLMResponse: llm.LLMResponse{
			Message: llm.Message{Role: llm.RoleAssistant, Parts: []llm.MessagePart{
				llm.ToolCallPart(tc),
			}},
			StopReason: llm.StopReasonToolUse,
			Usage:      llm.TokenUsage{InputTokens: 100, OutputTokens: 20},
		}},
		mock.Response{LLMResponse: llm.LLMResponse{
			Message:    llm.Message{Role: llm.RoleAssistant, Parts: []llm.MessagePart{llm.TextPart("Hello, World!")}},
			StopReason: llm.StopReasonEndTurn,
			Usage:      llm.TokenUsage{InputTokens: 150, OutputTokens: 10},
		}},
	)

	inv := tools.InvokerFunc(func(_ context.Context, _ tools.InvocationContext, call tools.ToolCall) (tools.ToolResult, error) {
		return tools.ToolResult{CallID: call.CallID, Status: tools.ToolStatusSuccess, Content: "Hello!"}, nil
	})

	orch, err := orchestrator.New(
		provider,
		orchestrator.WithDefaultModel("demo-model"),
		orchestrator.WithToolInvoker(inv),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	ch := orch.InvokeStream(context.Background(), praxis.InvocationRequest{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("Say hello")}}},
	})

	fmt.Println("=== Event Stream ===")
	for e := range ch {
		marker := "  "
		if e.Type.IsTerminal() {
			marker = "→ "
		}
		detail := ""
		if e.ToolCallID != "" {
			detail = fmt.Sprintf(" [tool=%s call=%s]", e.ToolName, e.ToolCallID)
		}
		if e.Err != nil {
			detail += fmt.Sprintf(" err=%v", e.Err)
		}
		fmt.Printf("%s%-40s state=%-18s%s\n", marker, e.Type, e.State, detail)

		if e.Type == event.EventTypeInvocationCompleted {
			fmt.Println("\n=== Done ===")
		}
	}
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/streaming/main.go)

## Running

No API key is required -- this example uses a mock provider.

```bash title="terminal"
go run examples/streaming/main.go
```

## Expected Output

```
=== Event Stream ===
  invocation.started                       state=Initializing
  invocation.initialized                   state=PreHook
  prehook.started                          state=PreHook
  prehook.completed                        state=LLMCall
  llmcall.started                          state=LLMCall
  llmcall.completed                        state=ToolDecision
  tooldecision.started                     state=ToolDecision
  toolcall.started                         state=ToolCall         [tool=greet call=c1]
  toolcall.completed                       state=PostToolFilter   [tool=greet call=c1]
  posttoolfilter.started                   state=PostToolFilter   [tool=greet call=c1]
  posttoolfilter.completed                 state=LLMContinuation  [tool=greet call=c1]
  llmcontinuation.started                  state=LLMContinuation
  llmcall.started                          state=LLMCall
  llmcall.completed                        state=ToolDecision
  tooldecision.started                     state=ToolDecision
  posthook.started                         state=PostHook
  posthook.completed                       state=Completed
→ invocation.completed                     state=Completed

=== Done ===
```

## What This Demonstrates

1. **`InvokeStream` returns a channel** that delivers `InvocationEvent` values in lifecycle order
2. **The channel closes after the terminal event** -- `range ch` exits naturally when the invocation ends
3. **`IsTerminal()` distinguishes terminal from non-terminal events** -- used here to prefix terminal events with `→`
4. **Tool-related events carry `ToolCallID` and `ToolName`** -- enabling correlation of tool events in logs and traces
5. **`InvokerFunc` adapter** -- wraps a plain function as a `tools.Invoker` for inline tool implementations

## State Machine Trace

This example exercises the full tool-use cycle: `Created` -> `Initializing` -> `PreHook` -> `LLMCall` -> `ToolDecision` -> `ToolCall` -> `PostToolFilter` -> `LLMContinuation` -> `LLMCall` -> `ToolDecision` -> `PostHook` -> `Completed`.

See [Streaming Guide](/docs/guides/streaming) for more on consuming event streams.

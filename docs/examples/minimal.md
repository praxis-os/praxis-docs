---
title: "Minimal Example"
description: "A minimal runnable praxis example that demonstrates a single invocation using the Anthropic provider with zero-wiring defaults."
sidebar_label: "Minimal"
sidebar_position: 2
keywords: [minimal, example, anthropic, invoke, zero-wiring, InvocationRequest, quick-start]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/anthropic"]
rag_interfaces: ["orchestrator.Orchestrator", "llm.Provider"]
rag_difficulty: "beginner"
---

# Minimal Example

The minimal example demonstrates a single praxis invocation using the Anthropic provider. It uses zero-wiring defaults -- no policy hooks, no budget guard, no tool invoker.

## Source Code

```go title="examples/minimal/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/anthropic"
	"github.com/praxis-os/praxis/orchestrator"
)

func main() {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "error: ANTHROPIC_API_KEY environment variable is not set")
		os.Exit(1)
	}

	provider := anthropic.New(apiKey)

	orch, err := orchestrator.New(provider)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to create orchestrator: %v\n", err)
		os.Exit(1)
	}

	req := praxis.InvocationRequest{
		Model: "claude-haiku-4-20250514",
		Messages: []llm.Message{
			{
				Role:  llm.RoleUser,
				Parts: []llm.MessagePart{llm.TextPart("What is the capital of France?")},
			},
		},
	}

	result, err := orch.Invoke(context.Background(), req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: invocation failed: %v\n", err)
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

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/minimal/main.go)

## Running

```bash title="terminal"
ANTHROPIC_API_KEY=sk-ant-... go run examples/minimal/main.go
```

## Expected Output

```
The capital of France is Paris.
```

## What This Demonstrates

This example covers the core praxis workflow:

1. **Create an LLM provider** -- `anthropic.New(apiKey)` returns an `llm.Provider` implementation
2. **Create the orchestrator** -- `orchestrator.New(provider)` with zero-wiring defaults (no hooks, no budget, no tools)
3. **Build a request** -- `praxis.InvocationRequest` with model and messages
4. **Invoke** -- synchronous `orch.Invoke(ctx, req)` drives the state machine through all phases
5. **Read the response** -- iterate over `result.Response.Parts` for text content

## State Machine Trace

For this simple request, the state machine traverses: `Created` -> `Initializing` -> `PreHook` -> `LLMCall` -> `ToolDecision` -> `PostHook` -> `Completed`.

See [Your First Invocation](/docs/getting-started/first-invocation) for a detailed walkthrough of each state, and [State Machine](/docs/core-concepts/state-machine) for the full diagram.

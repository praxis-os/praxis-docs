---
title: "Quick Start"
description: "Run your first praxis invocation in under 5 minutes. A minimal example that creates an Anthropic provider, builds an orchestrator, and invokes Claude."
sidebar_label: "Quick Start"
sidebar_position: 3
keywords: [quick-start, minimal, example, invoke, anthropic, orchestrator, InvocationRequest, InvocationResult]
rag_section: "getting-started"
rag_packages: ["orchestrator", "llm", "llm/anthropic"]
rag_interfaces: ["orchestrator.Orchestrator", "llm.Provider"]
rag_difficulty: "beginner"
---

# Quick Start

This guide walks through a minimal praxis invocation using the Anthropic provider. By the end, you will have a working Go program that sends a prompt to Claude and prints the response.

## The minimal example

```go title="main.go"
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

## Running the example

```bash title="terminal"
ANTHROPIC_API_KEY=sk-ant-... go run main.go
```

Expected output:

```
The capital of France is Paris.
```

## What just happened

Let's walk through the code step by step.

### 1. Create an LLM provider

```go title="provider-setup"
provider := anthropic.New(apiKey)
```

`anthropic.New` returns an `llm.Provider` implementation that talks to the Anthropic API. praxis is provider-agnostic -- the orchestrator only sees the `llm.Provider` interface.

### 2. Create the orchestrator

```go title="orchestrator-setup"
orch, err := orchestrator.New(provider)
```

`orchestrator.New` accepts an `llm.Provider` and optional functional options. With no options, you get the **zero-wiring** defaults: no policy hooks, no budget guard, no tool invoker, no identity signer. All optional components have safe null defaults.

### 3. Build the request

```go title="request-setup"
req := praxis.InvocationRequest{
    Model: "claude-haiku-4-20250514",
    Messages: []llm.Message{
        {
            Role:  llm.RoleUser,
            Parts: []llm.MessagePart{llm.TextPart("What is the capital of France?")},
        },
    },
}
```

`InvocationRequest` specifies the model, messages, and optionally tools, budget configuration, and metadata. Messages use structured `llm.Message` types with a role and parts (text, tool use, tool results).

### 4. Invoke

```go title="invoke"
result, err := orch.Invoke(context.Background(), req)
```

`Invoke` is the synchronous entry point. It creates a fresh state machine, drives it through all states (`Created` -> `Initializing` -> `PreHook` -> `LLMCall` -> `ToolDecision` -> `PostHook` -> `Completed`), and returns the terminal result. The orchestrator is safe for concurrent use.

### 5. Read the response

```go title="response"
for _, part := range result.Response.Parts {
    if part.Type == llm.PartTypeText {
        fmt.Println(part.Text)
    }
}
```

`InvocationResult` contains the terminal state, the LLM response, a budget snapshot, and all lifecycle events emitted during the invocation.

## Next steps

- Learn about [error handling and the state machine trace](/docs/getting-started/first-invocation) in a deeper walkthrough
- Understand the [Architecture](/docs/core-concepts/architecture) and how components connect
- Add [budget enforcement](/docs/guides/budget-config) or [policy hooks](/docs/guides/policy-hook) to the orchestrator

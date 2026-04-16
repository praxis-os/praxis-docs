---
title: "Gemini Example"
description: "A minimal runnable praxis example using the Google Gemini provider for a single invocation."
sidebar_label: "Gemini"
sidebar_position: 9
keywords: [gemini, example, google, invoke, provider, generateContent]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/gemini"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "beginner"
---

# Gemini Example

This example demonstrates a single praxis invocation using the Google Gemini provider. It uses zero-wiring defaults -- no policy hooks, no budget guard, no tool invoker.

## Source Code

```go title="examples/gemini/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/gemini"
	"github.com/praxis-os/praxis/orchestrator"
)

func main() {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "error: GEMINI_API_KEY environment variable is not set")
		os.Exit(1)
	}

	provider := gemini.New(apiKey)

	orch, err := orchestrator.New(provider)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to create orchestrator: %v\n", err)
		os.Exit(1)
	}

	req := praxis.InvocationRequest{
		Model: "gemini-2.0-flash",
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

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/gemini/main.go)

## Running

```bash title="terminal"
GEMINI_API_KEY=AI... go run examples/gemini/main.go
```

## Expected Output

```
The capital of France is Paris.
```

## What This Demonstrates

1. **Native Gemini implementation** -- `gemini.New(apiKey)` creates a provider with its own request/response mapping to the `generateContent` endpoint
2. **API key as query parameter** -- unlike Anthropic/OpenAI which use headers, Gemini sends the API key as a `?key=` query parameter
3. **Provider-agnostic orchestration** -- the orchestrator code is identical regardless of which provider is used
4. **1M context window** -- Gemini reports `MaxContextTokens: 1048576`, the largest context window among shipped adapters

## Gemini-Specific Behavior

The Gemini adapter handles several API differences transparently:

- **Role mapping**: `user` and `tool` roles map to `"user"`, `assistant` maps to `"model"`
- **System instructions**: extracted from the message list into the `systemInstruction` field
- **Synthetic call IDs**: Gemini does not use call IDs for tool calls; the adapter generates them as `gemini-{name}-{index}`
- **Stop reason normalization**: Gemini uses `"STOP"` even for function calls; the adapter detects tool calls in response parts and reports `StopReasonToolUse`

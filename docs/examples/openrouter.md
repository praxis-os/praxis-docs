---
title: "OpenRouter Example"
description: "A minimal runnable praxis example using the OpenRouter provider to access multiple model vendors through a single gateway."
sidebar_label: "OpenRouter"
sidebar_position: 10
keywords: [openrouter, example, multi-model, gateway, invoke, provider]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/openrouter"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "beginner"
---

# OpenRouter Example

This example demonstrates a single praxis invocation using the OpenRouter provider, which acts as a gateway to multiple model vendors through a unified API.

## Source Code

```go title="examples/openrouter/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/openrouter"
	"github.com/praxis-os/praxis/orchestrator"
)

func main() {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "error: OPENROUTER_API_KEY environment variable is not set")
		os.Exit(1)
	}

	provider := openrouter.New(apiKey,
		openrouter.WithModel("anthropic/claude-sonnet-4-20250514"),
		openrouter.WithReferer("https://myapp.example.com"),
		openrouter.WithTitle("My App"),
	)

	orch, err := orchestrator.New(provider)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to create orchestrator: %v\n", err)
		os.Exit(1)
	}

	req := praxis.InvocationRequest{
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

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/openrouter/main.go)

## Running

```bash title="terminal"
OPENROUTER_API_KEY=sk-or-... go run examples/openrouter/main.go
```

## Expected Output

```
The capital of France is Paris.
```

## What This Demonstrates

1. **Multi-model gateway** -- OpenRouter provides access to models from Anthropic, OpenAI, Google, Meta, and others through a single API key
2. **App identification headers** -- `WithReferer` and `WithTitle` set `HTTP-Referer` and `X-Title` headers for dashboard tracking on OpenRouter
3. **Thin wrapper pattern** -- `openrouter.New(apiKey)` returns `*openai.Provider` with OpenRouter-specific base URL and headers
4. **Model selection** -- use vendor-prefixed model names like `"anthropic/claude-sonnet-4-20250514"` or `"openai/gpt-4o"`

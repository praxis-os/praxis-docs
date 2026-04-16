---
title: "Groq Example"
description: "A minimal runnable praxis example using the Groq provider for fast inference with open-source models."
sidebar_label: "Groq"
sidebar_position: 11
keywords: [groq, example, llama, invoke, provider, fast-inference]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/groq"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "beginner"
---

# Groq Example

This example demonstrates a single praxis invocation using the Groq provider for fast inference with open-source models.

## Source Code

```go title="examples/groq/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/groq"
	"github.com/praxis-os/praxis/orchestrator"
)

func main() {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "error: GROQ_API_KEY environment variable is not set")
		os.Exit(1)
	}

	provider := groq.New(apiKey,
		groq.WithModel("llama-3.3-70b-versatile"),
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

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/groq/main.go)

## Running

```bash title="terminal"
GROQ_API_KEY=gsk_... go run examples/groq/main.go
```

## Expected Output

```
The capital of France is Paris.
```

## What This Demonstrates

1. **Thin wrapper pattern** -- `groq.New(apiKey)` returns `*openai.Provider` configured for Groq's API
2. **OpenAI-compatible API** -- Groq implements the Chat Completions API, so the OpenAI adapter handles all request/response mapping
3. **Provider-agnostic orchestration** -- swap `groq.New` for `anthropic.New` or `openai.New` and the orchestration code stays identical

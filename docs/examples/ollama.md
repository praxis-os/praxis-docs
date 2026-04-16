---
title: "Ollama Example"
description: "A minimal runnable praxis example using the Ollama provider for local model serving without an API key."
sidebar_label: "Ollama"
sidebar_position: 12
keywords: [ollama, example, local, invoke, provider, llama, self-hosted]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/ollama"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "beginner"
---

# Ollama Example

This example demonstrates a single praxis invocation using a locally-running Ollama model. No API key is required.

## Prerequisites

Install and start Ollama, then pull a model:

```bash title="terminal"
# Install Ollama (macOS)
brew install ollama

# Start the server
ollama serve

# Pull a model (in another terminal)
ollama pull llama3.2
```

## Source Code

```go title="examples/ollama/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/ollama"
	"github.com/praxis-os/praxis/orchestrator"
)

func main() {
	provider := ollama.New(
		ollama.WithModel("llama3.2"),
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

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/ollama/main.go)

## Running

Ensure Ollama is running locally, then:

```bash title="terminal"
go run examples/ollama/main.go
```

## Expected Output

```
The capital of France is Paris.
```

## What This Demonstrates

1. **No API key required** -- `ollama.New()` takes no API key parameter; the OpenAI adapter skips the authorization header when the key is empty
2. **Local model serving** -- default base URL is `http://localhost:11434`
3. **Conservative capabilities** -- the adapter reports `SupportsParallelToolCalls: false`, `SupportsStreaming: false`, and `MaxContextTokens: 8192` as safe defaults for local models
4. **Thin wrapper pattern** -- returns `*openai.Provider` configured with Ollama-specific base URL and capabilities

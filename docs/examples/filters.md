---
title: "Filters Example"
description: "Demonstrates a PreLLMFilter that redacts PII (SSN patterns) before messages reach the LLM provider."
sidebar_label: "Filters"
sidebar_position: 3
keywords: [filters, PreLLMFilter, PII, redaction, FilterDecision, FilterActionRedact, hooks, mock]
rag_section: "examples"
rag_packages: ["orchestrator", "hooks", "llm", "llm/mock"]
rag_interfaces: ["hooks.PreLLMFilter"]
rag_difficulty: "intermediate"
---

# Filters Example

The filters example demonstrates a `PreLLMFilter` that replaces SSN patterns with `[REDACTED]` before the LLM sees them. It uses a mock provider so you can see exactly what the LLM received after filtering.

## Source Code

```go title="examples/filters/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"
	"regexp"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/hooks"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/mock"
	"github.com/praxis-os/praxis/orchestrator"
)

var ssnPattern = regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`)

// piiRedactFilter replaces SSN-like patterns with [REDACTED].
type piiRedactFilter struct{}

func (piiRedactFilter) Filter(_ context.Context, messages []llm.Message) ([]llm.Message, []hooks.FilterDecision, error) {
	var decisions []hooks.FilterDecision
	filtered := make([]llm.Message, len(messages))

	for i, msg := range messages {
		parts := make([]llm.MessagePart, len(msg.Parts))
		for j, part := range msg.Parts {
			if part.Type == llm.PartTypeText && ssnPattern.MatchString(part.Text) {
				parts[j] = llm.TextPart(ssnPattern.ReplaceAllString(part.Text, "[REDACTED]"))
				decisions = append(decisions, hooks.FilterDecision{
					Action: hooks.FilterActionRedact,
					Field:  fmt.Sprintf("messages[%d].parts[%d].text", i, j),
					Reason: "SSN pattern detected",
				})
			} else {
				parts[j] = part
			}
		}
		filtered[i] = llm.Message{Role: msg.Role, Parts: parts}
	}

	return filtered, decisions, nil
}

func main() {
	// Mock provider that echoes back what it receives.
	provider := mock.New(mock.Response{
		LLMResponse: llm.LLMResponse{
			Message:    llm.Message{Role: llm.RoleAssistant, Parts: []llm.MessagePart{llm.TextPart("I processed your data safely.")}},
			StopReason: llm.StopReasonEndTurn,
		},
	})

	orch, err := orchestrator.New(
		provider,
		orchestrator.WithDefaultModel("demo-model"),
		orchestrator.WithPreLLMFilter(piiRedactFilter{}),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	result, err := orch.Invoke(context.Background(), praxis.InvocationRequest{
		Messages: []llm.Message{{
			Role:  llm.RoleUser,
			Parts: []llm.MessagePart{llm.TextPart("My SSN is 123-45-6789, please process my application.")},
		}},
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Show the LLM received redacted content.
	calls := provider.Calls()
	fmt.Println("=== What the LLM received ===")
	for _, part := range calls[0].Messages[0].Parts {
		if part.Type == llm.PartTypeText {
			fmt.Println(part.Text)
		}
	}

	fmt.Println("\n=== Response ===")
	if result.Response != nil {
		for _, part := range result.Response.Parts {
			if part.Type == llm.PartTypeText {
				fmt.Println(part.Text)
			}
		}
	}
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/filters/main.go)

## Running

No API key is required -- this example uses a mock provider.

```bash title="terminal"
go run examples/filters/main.go
```

## Expected Output

```
=== What the LLM received ===
My SSN is [REDACTED], please process my application.

=== Response ===
I processed your data safely.
```

## What This Demonstrates

1. **Implementing the `PreLLMFilter` interface** -- the `piiRedactFilter` struct implements `Filter(ctx, messages)` which returns filtered messages and a list of `FilterDecision` values
2. **Returning `FilterDecision` for audit trails** -- each redaction produces a `FilterDecision` with `Action`, `Field`, and `Reason` for downstream observability
3. **Registering the filter** -- `orchestrator.WithPreLLMFilter(piiRedactFilter{})` installs the filter at construction time
4. **Using `mock.New()` for testing** -- the mock provider makes it possible to inspect what the LLM actually received via `provider.Calls()`

## State Machine Trace

The filter runs during the `LLMCall` state, before the actual provider call: `Created` -> `Initializing` -> `PreHook` -> `LLMCall` (filter applied here) -> `ToolDecision` -> `PostHook` -> `Completed`.

See [Filter Chains](/docs/guides/filter-chains) for the full guide on pre- and post-filters.

---
title: "Policy Example"
description: "Demonstrates a PolicyHook that returns Allow, Deny, or RequireApproval decisions based on message content."
sidebar_label: "Policy"
sidebar_position: 4
keywords: [policy, PolicyHook, Allow, Deny, RequireApproval, hooks, pre-invocation, Decision, mock]
rag_section: "examples"
rag_packages: ["orchestrator", "hooks", "llm", "llm/mock"]
rag_interfaces: ["hooks.PolicyHook"]
rag_difficulty: "intermediate"
---

# Policy Example

The policy example demonstrates a `PolicyHook` that inspects message content and returns all three decision types: `Allow`, `Deny`, and `RequireApproval`.

## Source Code

```go title="examples/policy/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/praxis-os/praxis"
	"github.com/praxis-os/praxis/hooks"
	"github.com/praxis-os/praxis/llm"
	"github.com/praxis-os/praxis/llm/mock"
	"github.com/praxis-os/praxis/orchestrator"
)

// contentPolicyHook denies requests containing "forbidden" and requires
// approval for requests containing "sensitive".
type contentPolicyHook struct{}

func (contentPolicyHook) Evaluate(_ context.Context, _ hooks.Phase, input hooks.PolicyInput) (hooks.Decision, error) {
	for _, msg := range input.Messages {
		for _, part := range msg.Parts {
			if part.Type == llm.PartTypeText {
				lower := strings.ToLower(part.Text)
				if strings.Contains(lower, "forbidden") {
					return hooks.Deny("message contains forbidden content"), nil
				}
				if strings.Contains(lower, "sensitive") {
					return hooks.RequireApproval("message contains sensitive content",
						map[string]any{"flagged_word": "sensitive"}), nil
				}
			}
		}
	}
	return hooks.Allow(), nil
}

func main() {
	// Use a mock provider for demonstration.
	provider := mock.NewSimple("Policy check passed — here is your response.")

	orch, err := orchestrator.New(
		provider,
		orchestrator.WithDefaultModel("demo-model"),
		orchestrator.WithPolicyHook(contentPolicyHook{}),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Test 1: allowed request
	fmt.Println("=== Test 1: Normal request ===")
	result, err := orch.Invoke(context.Background(), praxis.InvocationRequest{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("Hello!")}}},
	})
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
	} else {
		fmt.Printf("  State: %v\n", result.FinalState)
	}

	// Test 2: denied request
	fmt.Println("=== Test 2: Forbidden request ===")
	_, err = orch.Invoke(context.Background(), praxis.InvocationRequest{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("Tell me about forbidden topics")}}},
	})
	fmt.Printf("  Error: %v\n", err)

	// Test 3: approval required
	fmt.Println("=== Test 3: Sensitive request ===")
	result, err = orch.Invoke(context.Background(), praxis.InvocationRequest{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("Process this sensitive data")}}},
	})
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
	}
	fmt.Printf("  State: %v\n", result.FinalState)
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/policy/main.go)

## Running

No API key is required -- this example uses a mock provider.

```bash title="terminal"
go run examples/policy/main.go
```

## Expected Output

```
=== Test 1: Normal request ===
  State: Completed
=== Test 2: Forbidden request ===
  Error: policy denied: message contains forbidden content
=== Test 3: Sensitive request ===
  State: ApprovalRequired
```

## What This Demonstrates

1. **Implementing the `PolicyHook` interface** -- `contentPolicyHook` implements `Evaluate(ctx, Phase, PolicyInput) (Decision, error)`
2. **Returning `hooks.Allow()`** -- the request passes through to the LLM and completes normally
3. **Returning `hooks.Deny(reason)`** -- the invocation terminates with an error; the LLM is never called
4. **Returning `hooks.RequireApproval(reason, metadata)`** -- the invocation enters the `ApprovalRequired` terminal state with metadata for downstream approval workflows

## State Machine Trace

- **Allowed**: `Created` -> `Initializing` -> `PreHook` -> `LLMCall` -> `ToolDecision` -> `PostHook` -> `Completed`
- **Denied**: `Created` -> `Initializing` -> `PreHook` -> `Failed` (policy denied)
- **Approval required**: `Created` -> `Initializing` -> `PreHook` -> `ApprovalRequired`

See [Policy Hook Guide](/docs/guides/policy-hook) for the full guide on building policy hooks.

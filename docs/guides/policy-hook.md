---
title: "Implementing a Policy Hook"
description: "How to implement the hooks.PolicyHook interface to enforce custom governance rules at invocation lifecycle phases."
sidebar_label: "Policy Hook"
sidebar_position: 2
keywords: [praxis, policy, hooks, PolicyHook, governance, security, PreInvocation, PostInvocation, Decision, Allow, Deny]
rag_section: "guides"
rag_packages: ["hooks"]
rag_interfaces: ["hooks.PolicyHook"]
rag_difficulty: "advanced"
---

# Implementing a Policy Hook

Policy hooks give you control over which invocations are allowed to proceed and under what conditions. This guide walks through implementing the `hooks.PolicyHook` interface, handling each lifecycle phase, using decision verdicts, and composing multiple hooks.

## The PolicyHook Contract

The `PolicyHook` interface has a single method that receives the current phase, phase-appropriate input, and returns a decision.

```go title="hooks.PolicyHook interface"
type PolicyHook interface {
    Evaluate(ctx context.Context, phase Phase, input PolicyInput) (Decision, error)
}
```

`Phase` is an enum with two values that correspond to the invocation-level policy checkpoints:

| Phase | When it fires | What `PolicyInput` contains |
|-------|--------------|----------------------------|
| `PreInvocation` | Before the first LLM call | The full `InvocationRequest` (model, messages, tools, metadata) |
| `PostInvocation` | After the invocation reaches a terminal state | The full `InvocationResult` including final message and metrics |

The `PolicyInput` struct provides the phase-appropriate data. At `PreInvocation`, `input.Request` is populated. At `PostInvocation`, `input.Result` is populated. The unused field is `nil` in each case.

:::note
Fine-grained per-message and per-tool-output inspection happens through `PreLLMFilter` and `PostToolFilter`, not through `PolicyHook`. See [Creating Filter Chains](/docs/guides/filter-chains) for those interfaces.
:::

## Phase-Specific Logic

A typical `PolicyHook` switches on the phase to apply different rules at different points in the lifecycle.

```go title="hooks/multi_phase_hook.go"
type MultiPhaseHook struct {
    allowedModels map[string]bool
    maxMessages   int
    logger        *slog.Logger
}

func (h *MultiPhaseHook) Evaluate(
    ctx context.Context,
    phase hooks.Phase,
    input hooks.PolicyInput,
) (hooks.Decision, error) {
    switch phase {
    case hooks.PreInvocation:
        return h.evaluatePreInvocation(ctx, input)
    case hooks.PostInvocation:
        return h.evaluatePostInvocation(ctx, input)
    default:
        return hooks.Decision{Verdict: hooks.Allow}, nil
    }
}

func (h *MultiPhaseHook) evaluatePreInvocation(
    ctx context.Context,
    input hooks.PolicyInput,
) (hooks.Decision, error) {
    req := input.Request

    // Validate the requested model is in the allow-list
    if !h.allowedModels[req.Model] {
        return hooks.Decision{
            Verdict: hooks.Deny,
            Reason:  fmt.Sprintf("model %q is not in the allow-list", req.Model),
        }, nil
    }

    // Validate message count to prevent oversized conversations
    if len(req.Messages) > h.maxMessages {
        return hooks.Decision{
            Verdict: hooks.Deny,
            Reason:  fmt.Sprintf("message count %d exceeds limit %d", len(req.Messages), h.maxMessages),
        }, nil
    }

    return hooks.Decision{Verdict: hooks.Allow}, nil
}

func (h *MultiPhaseHook) evaluatePostInvocation(
    ctx context.Context,
    input hooks.PolicyInput,
) (hooks.Decision, error) {
    result := input.Result

    // Log completion metrics for audit
    h.logger.Info("invocation completed",
        "terminal_state", result.TerminalState,
        "tokens_used", result.BudgetSnapshot.InputTokens+result.BudgetSnapshot.OutputTokens,
        "tool_calls", result.BudgetSnapshot.ToolCalls,
    )

    return hooks.Decision{Verdict: hooks.Log}, nil
}
```

**PreInvocation** is the strongest guard. A `Deny` here means the LLM provider is never called, no tokens are consumed, and no tools are invoked. Use it for authorization checks, request validation, and rate limiting.

**PostInvocation** fires after the invocation reaches any terminal state, including `Failed` and `BudgetExceeded`. Use it for audit logging, compliance recording, and cost alerting. A `Deny` at this phase is unusual but valid -- it marks the result as failed even if the LLM call succeeded.

## Decision Verdicts

The `Decision` type carries a `Verdict` and an optional `Reason` string.

| Verdict | Effect | State Machine Impact |
|---------|--------|---------------------|
| `Allow` | The invocation proceeds normally | No impact -- continues to next state |
| `Deny` | The invocation stops immediately | Transitions to `Failed` terminal state |
| `RequireApproval` | The invocation is paused for external approval | Transitions to `ApprovalRequired` terminal state |
| `Log` | The invocation proceeds, but the decision is recorded | No impact -- event emitted via telemetry |

`Deny` requires a `Reason` string. This reason is included in the `TypedError` attached to the `InvocationResult`, making it available to the caller for logging and user-facing error messages.

`RequireApproval` pauses the invocation in the `ApprovalRequired` terminal state. The caller is responsible for implementing the approval workflow (human-in-the-loop, Slack notification, ticket creation) and resubmitting the invocation after approval.

```go title="RequireApproval example"
func (h *ApprovalHook) Evaluate(
    ctx context.Context,
    phase hooks.Phase,
    input hooks.PolicyInput,
) (hooks.Decision, error) {
    if phase != hooks.PreInvocation {
        return hooks.Decision{Verdict: hooks.Allow}, nil
    }

    if containsSensitiveTool(input.Request.Tools) {
        return hooks.Decision{
            Verdict: hooks.RequireApproval,
            Reason:  "invocation uses sensitive tools requiring human approval",
        }, nil
    }

    return hooks.Decision{Verdict: hooks.Allow}, nil
}
```

## Chaining Multiple Hooks

Multiple policy hooks can be registered with the orchestrator. They execute in the order they are provided. The first `Deny` verdict short-circuits the chain -- subsequent hooks are not evaluated.

```go title="Chaining hooks"
orch := orchestrator.New(provider,
    orchestrator.WithPolicyHooks(
        &AuthorizationHook{},    // Runs first: checks tenant permissions
        &ContentPolicyHook{},    // Runs second: validates content
        &AuditLogHook{},         // Runs third: logs all decisions
    ),
)
```

Evaluation order for the chain:

1. `AuthorizationHook.Evaluate()` returns `Allow` -- continue to next hook.
2. `ContentPolicyHook.Evaluate()` returns `Deny` -- chain stops immediately, invocation transitions to `Failed`.
3. `AuditLogHook.Evaluate()` is **never called** because the chain was short-circuited.

`Log` verdicts do not short-circuit. If a hook returns `Log`, the event is recorded and evaluation continues to the next hook. `RequireApproval` does short-circuit, just like `Deny`.

:::tip
Order your hooks from most restrictive to least restrictive. Place authorization checks first and audit logging last. This ensures that denied requests are caught early without wasting compute on downstream checks.
:::

## Example: Content Safety Hook

This complete example demonstrates a policy hook that checks incoming messages for disallowed content patterns and returns a `Deny` verdict with a descriptive reason.

```go title="hooks/content_safety.go"
package hooks

import (
    "context"
    "fmt"
    "regexp"

    "github.com/praxis-os/praxis/hooks"
)

// ContentSafetyHook checks messages against a set of disallowed patterns.
type ContentSafetyHook struct {
    patterns []*regexp.Regexp
    labels   []string // Human-readable label for each pattern
}

// NewContentSafetyHook creates a hook with the given pattern-label pairs.
func NewContentSafetyHook(rules map[string]string) *ContentSafetyHook {
    h := &ContentSafetyHook{}
    for pattern, label := range rules {
        h.patterns = append(h.patterns, regexp.MustCompile(pattern))
        h.labels = append(h.labels, label)
    }
    return h
}

func (h *ContentSafetyHook) Evaluate(
    ctx context.Context,
    phase hooks.Phase,
    input hooks.PolicyInput,
) (hooks.Decision, error) {
    if phase != hooks.PreInvocation {
        return hooks.Decision{Verdict: hooks.Allow}, nil
    }

    for _, msg := range input.Request.Messages {
        for _, part := range msg.Parts {
            if part.Type != "text" {
                continue
            }
            for i, pattern := range h.patterns {
                if pattern.MatchString(part.Text) {
                    return hooks.Decision{
                        Verdict: hooks.Deny,
                        Reason:  fmt.Sprintf("content policy violation: %s", h.labels[i]),
                    }, nil
                }
            }
        }
    }

    return hooks.Decision{Verdict: hooks.Allow}, nil
}
```

Register it with the orchestrator:

```go title="main.go"
safetyHook := NewContentSafetyHook(map[string]string{
    `(?i)ignore\s+previous\s+instructions`: "prompt injection attempt",
    `(?i)system\s*:\s*you\s+are`:            "role override attempt",
})

orch := orchestrator.New(provider,
    orchestrator.WithPolicyHooks(safetyHook),
)
```

:::warning
Pattern-based content safety is a defense-in-depth measure, not a complete solution. Sophisticated prompt injection attacks may evade simple regex patterns. Combine policy hooks with `PostToolFilter` for defense at multiple trust boundaries.
:::

For the full `hooks` package API, see [pkg.go.dev/github.com/praxis-os/praxis/hooks](https://pkg.go.dev/github.com/praxis-os/praxis/hooks).

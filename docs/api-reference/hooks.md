---
title: "hooks Package"
description: "The hooks package provides policy evaluation and content filtering at four lifecycle phases, giving callers fine-grained control over what the agent can do."
sidebar_label: "hooks"
sidebar_position: 5
keywords: [praxis, hooks, policy, filter, pre-llm, post-tool, decision, block, redact, pass, log, lifecycle]
rag_section: "api-reference"
rag_packages: ["hooks"]
rag_interfaces: ["hooks.PolicyHook", "hooks.PreLLMFilter", "hooks.PostToolFilter"]
rag_difficulty: "intermediate"
---

# hooks Package

## Purpose

The `hooks` package defines two complementary extension points: policy hooks that make allow/deny decisions at lifecycle phases, and content filters that inspect and transform data flowing between the LLM and tools. Together, they let callers enforce organizational policy, regulatory requirements, and data governance rules without modifying orchestration logic.

Policy hooks operate at two invocation-level phases (`PreInvocation` and `PostInvocation`) through a single `Evaluate` method. Content filters run in chains at two data-flow boundaries (`PreLLMFilter` before each LLM call, `PostToolFilter` after each tool execution), where each filter sees the output of the previous one. The framework ships `AllowAllPolicyHook` as the default policy, which permits everything.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `PolicyHook` | Interface | Evaluates policy at invocation lifecycle phases. Single method: `Evaluate`. Returns a `Decision`. |
| `Phase` | Enum | Lifecycle checkpoint: `PreInvocation`, `PostInvocation`. |
| `PolicyInput` | Struct | Phase-appropriate data container. `Request` populated at `PreInvocation`, `Result` populated at `PostInvocation`. |
| `Decision` | Struct | A policy verdict with a reason string. |
| `Verdict` | Enum | Policy outcome: `Allow`, `Deny`, `RequireApproval`, `Log`. |
| `PreLLMFilter` | Interface | Inspects or transforms the `LLMRequest` before it reaches the LLM provider. Single method: `Filter`. |
| `PostToolFilter` | Interface | Inspects or transforms tool results before they re-enter the conversation. Single method: `Filter`. Applies uniformly to native tool results and to results from the [`mcp` package](./mcp.md), since both flow through the same `tools.Invoker` seam. |
| `FilterDecision` | Struct | Filter outcome with an action and reason. |
| `FilterAction` | Enum | Filter outcome: `Pass`, `Redact`, `Log`, `Block`. |
| `ToolOutput` | Struct | Raw tool output passed to `PostToolFilter`. Content and status fields. |
| `AllowAllPolicyHook` | Struct | Default policy hook that returns `Allow` for every phase. |

## Struct Field Reference

### Decision

| Field | Type | Description |
|---|---|---|
| `Verdict` | `Verdict` | One of `Allow`, `Deny`, `RequireApproval`, `Log`. |
| `Reason` | `string` | Human-readable explanation. Required for `Deny` and `RequireApproval`. Included in `TypedError` and telemetry events. |

### FilterDecision

| Field | Type | Description |
|---|---|---|
| `Action` | `FilterAction` | One of `Pass`, `Redact`, `Log`, `Block`. |
| `Reason` | `string` | Human-readable explanation. Required for `Block`; recommended for `Redact` and `Log`. Appears in telemetry events. |

### PolicyInput

| Field | Type | Description |
|---|---|---|
| `Request` | `*orchestrator.InvocationRequest` | Populated at `PreInvocation` phase. `nil` otherwise. |
| `Result` | `*orchestrator.InvocationResult` | Populated at `PostInvocation` phase. `nil` otherwise. |

### ToolOutput

| Field | Type | Description |
|---|---|---|
| `Content` | `string` | Raw tool output content. |
| `Status` | `string` | Terminal status: `Success`, `Error`, or `Partial`. |

## Usage Patterns

### Four Lifecycle Phases

The hooks system covers four phases of every invocation. Two are handled by `PolicyHook` (invocation-level decisions) and two by filter chains (data-flow inspection).

| Phase | Interface | When | Typical Use |
|---|---|---|---|
| `PreInvocation` | `PolicyHook` | Before any LLM call | Validate caller identity, check rate limits, enforce access control |
| `PreLLMInput` | `PreLLMFilter` | Before each LLM call (including continuations) | PII detection in prompts, prompt injection guards |
| `PostToolOutput` | `PostToolFilter` | After each tool execution | Sensitive data redaction, output size limits, injection detection |
| `PostInvocation` | `PolicyHook` | After terminal state | Audit logging, compliance recording, cost alerting |

:::note
`PreLLMInput` and `PostToolOutput` are handled by filter chain interfaces (`PreLLMFilter` and `PostToolFilter`), not by `PolicyHook`. This separation exists because filters need fine-grained per-field control (redact, pass) while lifecycle hooks make coarse-grained decisions (allow, deny).
:::

### PolicyHook

The `PolicyHook` interface has a single `Evaluate` method that receives the current phase and phase-appropriate input.

```go title="PolicyHook interface"
type PolicyHook interface {
    Evaluate(ctx context.Context, phase Phase, input PolicyInput) (Decision, error)
}
```

`Phase` is an enum with values `PreInvocation` and `PostInvocation`. At `PreInvocation`, `input.Request` is populated. At `PostInvocation`, `input.Result` is populated. The unused field is `nil`.

When a hook returns `Deny`, the orchestrator transitions to the `Failed` terminal state and emits a `PolicyDeniedError` with the hook's reason string.

#### Verdict Effects

| Verdict | Effect | State Machine Impact |
|---------|--------|---------------------|
| `Allow` | The invocation proceeds normally | No impact -- continues to next state |
| `Deny` | The invocation is stopped immediately | Transitions to `Failed` terminal state |
| `RequireApproval` | The invocation is paused for external approval | Transitions to `ApprovalRequired` terminal state |
| `Log` | The invocation proceeds, but the decision is recorded | No impact -- event emitted via telemetry |

### Content Filter Chains

Filters run in sequence. Each filter receives the content and returns a `FilterDecision` that tells the framework what to do.

- **Pass** -- Forward the content unchanged.
- **Redact** -- The filter has modified the data in place. The invocation continues with the redacted data.
- **Log** -- Pass the content through but emit a telemetry event for audit.
- **Block** -- Halt the invocation. Transitions to `Failed` terminal state.

#### PreLLMFilter

```go title="PreLLMFilter interface"
type PreLLMFilter interface {
    Filter(ctx context.Context, req *LLMRequest) (FilterDecision, error)
}
```

The `LLMRequest` is passed by pointer, allowing the filter to modify messages in place before they reach the LLM provider. This is the mechanism for redaction.

```go title="PreLLMFilter implementation"
type PIIRedactionFilter struct{}

func (f *PIIRedactionFilter) Filter(ctx context.Context, req *hooks.LLMRequest) (hooks.FilterDecision, error) {
    redactPII(req.Messages)
    return hooks.FilterDecision{Action: hooks.Redact, Reason: "PII detected and redacted"}, nil
}
```

#### PostToolFilter

```go title="PostToolFilter interface"
type PostToolFilter interface {
    Filter(ctx context.Context, toolName string, input any, output *ToolOutput) (FilterDecision, error)
}
```

The filter receives the tool name, the original input, and the raw output by pointer for in-place modification.

Filters are registered via orchestrator options and execute in registration order. A `Block` decision from any filter short-circuits the chain.

```go title="Registering filter chains"
orch := orchestrator.New(
    provider,
    orchestrator.WithPreLLMFilters(piiFilter, profanityFilter),
    orchestrator.WithPostToolFilters(auditFilter),
)
```

### Combining Policy and Filters

Policy hooks and filters serve different roles. Policy hooks make binary allow/deny decisions at lifecycle boundaries. Filters inspect and transform content inline. A typical setup uses a policy hook for access control and filters for data governance.

The evaluation order within a single phase is: policy hook first, then filters. If the policy hook denies, filters do not run.

## Full API Reference

For complete type and method documentation, see [hooks on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/hooks).

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

Policy hooks operate at four discrete phases of every invocation. Content filters run in chains, where each filter sees the output of the previous one. The framework ships `AllowAllPolicyHook` as the default policy, which permits everything.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `PolicyHook` | Interface | Evaluates policy at four lifecycle phases. Returns a `Decision`. |
| `Decision` | Struct | A policy verdict with a reason string. Verdicts: `Allow`, `Deny`. |
| `PreLLMFilter` | Interface | Inspects or transforms messages before they reach the LLM provider. |
| `PostToolFilter` | Interface | Inspects or transforms tool results before they re-enter the conversation. |
| `FilterDecision` | Struct | Filter outcome. Actions: `Pass`, `Redact`, `Log`, `Block`. |
| `AllowAllPolicyHook` | Struct | Default policy hook that returns `Allow` for every phase. |

## Usage Patterns

### PolicyHook Phases

A `PolicyHook` is called at four points during an invocation. Each phase receives context relevant to that moment in the lifecycle.

| Phase | When | Typical Use |
|---|---|---|
| `PreInvocation` | Before any LLM call | Validate caller identity, check rate limits, enforce access control |
| `PreLLMInput` | After filters, before LLM | Inspect final prompt, block sensitive queries |
| `PostToolOutput` | After tool execution | Audit tool results, block data exfiltration |
| `PostInvocation` | After terminal state | Log outcome, trigger alerts on policy violations |

```go title="PolicyHook interface"
type PolicyHook interface {
    PreInvocation(ctx context.Context, req InvocationInfo) (Decision, error)
    PreLLMInput(ctx context.Context, messages []llm.Message) (Decision, error)
    PostToolOutput(ctx context.Context, call tools.ToolCall, result tools.ToolResult) (Decision, error)
    PostInvocation(ctx context.Context, result InvocationInfo) (Decision, error)
}
```

When a hook returns `Deny`, the orchestrator transitions to the `PolicyDenied` terminal state and emits a `PolicyDeniedError` with the hook's reason string.

### Content Filter Chains

Filters run in sequence. Each filter receives the content and returns a `FilterDecision` that tells the framework what to do.

- **Pass** -- Forward the content unchanged.
- **Redact** -- Replace sensitive content with a placeholder. The filter provides the redacted version.
- **Log** -- Pass the content through but emit a telemetry event for audit.
- **Block** -- Halt the invocation. Equivalent to a policy denial.

```go title="PreLLMFilter implementation"
type PIIRedactionFilter struct{}

func (f *PIIRedactionFilter) FilterPreLLM(ctx context.Context, messages []llm.Message) (FilterDecision, []llm.Message, error) {
    redacted := redactPII(messages)
    return FilterDecision{Action: Redact, Reason: "PII detected and redacted"}, redacted, nil
}
```

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

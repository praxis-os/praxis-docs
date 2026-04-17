---
title: "hooks Package"
description: "Types and interfaces for policy evaluation and content filtering. Deep-dive explanations of engine mechanics live in the Policy Engine concept page."
sidebar_label: "hooks"
sidebar_position: 5
keywords: [praxis, hooks, policy, filter, pre-llm, pre-tool, post-tool, decision, block, redact, pass, log, lifecycle]
rag_section: "api-reference"
rag_packages: ["hooks"]
rag_interfaces: ["hooks.PolicyHook", "hooks.PreLLMFilter", "hooks.PreToolFilter", "hooks.PostToolFilter"]
rag_difficulty: "intermediate"
---

# hooks Package

## Purpose

The `hooks` package defines the policy-evaluation and content-filtering contracts used by the orchestrator. It is a type-only package — behaviour lives in the orchestrator, which dispatches these interfaces across the invocation lifecycle.

- `PolicyHook` — one method (`Evaluate`) called at four lifecycle phases for coarse-grained `Allow`/`Deny`/`RequireApproval`/`Log`/`Continue` decisions.
- `PreLLMFilter` / `PreToolFilter` / `PostToolFilter` — three data-flow filter contracts for fine-grained per-field inspection and redaction.

All interfaces in this package are **frozen at v1.0** and must be safe for concurrent use. The framework ships `AllowAllPolicyHook` as the default policy hook.

:::info Conceptual coverage
This page is the package surface: types, interfaces, and field tables. For how the engine dispatches phases, verdict semantics, and worked examples, see the [Policy Engine concept page](../core-concepts/policy-engine.md). For trust boundaries and filter-chain defensive patterns, see [Policy Hooks and Filters](../core-concepts/policy-hooks.md).
:::

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `PolicyHook` | Interface | Single method `Evaluate(ctx, phase, input) (Decision, error)` called at each lifecycle phase. |
| `Phase` | Enum (string) | Lifecycle checkpoint. Four values: `PhasePreInvocation`, `PhasePreLLMInput`, `PhasePostToolOutput`, `PhasePostInvocation`. |
| `PolicyInput` | Struct | Carries invocation state to `Evaluate`. Same struct at every phase; certain fields are only populated at certain phases (see below). |
| `Decision` | Struct | Policy verdict with metadata and reason. |
| `Verdict` | Enum (string) | Five values: `VerdictAllow`, `VerdictDeny`, `VerdictRequireApproval`, `VerdictLog`, `VerdictContinue`. |
| `PreLLMFilter` | Interface | `Filter(ctx, []llm.Message) ([]llm.Message, []FilterDecision, error)`. Runs before each LLM call. |
| `PreToolFilter` | Interface | `Filter(ctx, tools.ToolCall) (tools.ToolCall, []FilterDecision, error)`. Runs before each tool dispatch. |
| `PostToolFilter` | Interface | `Filter(ctx, tools.ToolResult) (tools.ToolResult, []FilterDecision, error)`. Runs after each tool execution (including MCP). |
| `FilterDecision` | Struct | Per-field action record. Filters return a slice — one entry per field touched. |
| `FilterAction` | Enum (string) | Four values: `FilterActionPass`, `FilterActionRedact`, `FilterActionLog`, `FilterActionBlock`. |
| `AllowAllPolicyHook` | Struct | Default `PolicyHook` implementation that returns `Allow` everywhere. |

## Struct Field Reference

### PolicyInput

Populated by the orchestrator before each `Evaluate` call. Fields marked *phase-conditional* are `nil` or empty outside their populating phase — see the [Policy Engine phase table](../core-concepts/policy-engine.md#policyinput-what-each-phase-sees) for the full matrix.

| Field | Type | Description |
|---|---|---|
| `InvocationID` | `string` | Unique identifier for the current invocation. |
| `Model` | `string` | LLM model identifier in use. |
| `SystemPrompt` | `string` | System prompt, if any. |
| `Messages` | `[]llm.Message` | Conversation history. Empty at `PhasePreInvocation` (no turns yet). |
| `ToolResult` | `*tools.ToolResult` | Most recent tool result. **Non-nil only at `PhasePostToolOutput`.** |
| `LLMResponse` | `*llm.LLMResponse` | Final LLM response. **Non-nil only at `PhasePostInvocation`.** |
| `Metadata` | `map[string]string` | Caller-supplied key-value pairs from `InvocationRequest.Metadata`. |

### Decision

Decisions are usually built with helpers rather than struct literals: `hooks.Allow()`, `hooks.Deny(reason)`, `hooks.RequireApproval(reason, metadata)`, `hooks.Log(reason)`, `hooks.Continue(reason)`.

| Field | Type | Description |
|---|---|---|
| `Verdict` | `Verdict` | Policy outcome. |
| `Metadata` | `map[string]any` | Arbitrary data forwarded to telemetry and the `ApprovalSnapshot` for `RequireApproval`. |
| `Reason` | `string` | Human-readable explanation. Required for `Deny` and `RequireApproval`. |

### FilterDecision

Filters return a **slice** of `FilterDecision` values — one per field touched. An empty slice means "nothing changed."

| Field | Type | Description |
|---|---|---|
| `Action` | `FilterAction` | What the filter did (`Pass`, `Redact`, `Log`, `Block`). |
| `Field` | `string` | Dotted-path identifier of the field (e.g., `messages[2].text`, `tool_call.arguments`). |
| `Reason` | `string` | Human-readable explanation. Required for `FilterActionBlock`. |

## Interface Signatures

```go title="PolicyHook"
type PolicyHook interface {
    Evaluate(ctx context.Context, phase Phase, input PolicyInput) (Decision, error)
}
```

```go title="PreLLMFilter"
type PreLLMFilter interface {
    Filter(ctx context.Context, messages []llm.Message) (
        filtered []llm.Message,
        decisions []FilterDecision,
        err error,
    )
}
```

```go title="PreToolFilter"
type PreToolFilter interface {
    Filter(ctx context.Context, call tools.ToolCall) (
        filtered tools.ToolCall,
        decisions []FilterDecision,
        err error,
    )
}
```

```go title="PostToolFilter"
type PostToolFilter interface {
    Filter(ctx context.Context, result tools.ToolResult) (
        filtered tools.ToolResult,
        decisions []FilterDecision,
        err error,
    )
}
```

`PostToolFilter` applies uniformly to results from the [`mcp` package](./mcp.md) since MCP servers flow through the same `tools.Invoker` seam.

## Registering with the Orchestrator

```go
orch, err := orchestrator.New(provider,
    orchestrator.WithPolicyHook(myPolicyHook),
    orchestrator.WithPreLLMFilter(piiRedactor),
    orchestrator.WithPreToolFilter(argValidator),
    orchestrator.WithPostToolFilter(outputSanitizer),
)
```

Filter options accept one value per call but may be passed multiple times to build a chain. `WithPolicyHook` may also be called multiple times; hooks execute in registration order.

## Full API Reference

For complete type and method documentation, see [hooks on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/hooks).

**Companion pages:**

- [Policy Engine](../core-concepts/policy-engine.md) — phase dispatch, verdict semantics, chaining, worked examples
- [Policy Hooks and Filters](../core-concepts/policy-hooks.md) — trust boundaries, filter defensive patterns
- [Implementing a Policy Hook](../guides/policy-hook.md) — step-by-step guide
- [Creating Filter Chains](../guides/filter-chains.md) — step-by-step filter guide

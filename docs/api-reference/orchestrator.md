---
title: "orchestrator Package"
description: "The orchestrator package provides the public facade for praxis, driving each agent invocation through its complete lifecycle with a fresh state machine per call."
sidebar_label: "orchestrator"
sidebar_position: 2
keywords: [praxis, orchestrator, invoke, stream, options, functional-options, concurrent, lifecycle, state-machine]
rag_section: "api-reference"
rag_packages: ["orchestrator"]
rag_interfaces: ["orchestrator.Orchestrator"]
rag_difficulty: "intermediate"
---

# orchestrator Package

## Purpose

The `orchestrator` package is the single entry point to the praxis framework. It exposes the `Orchestrator` type, which callers construct once and reuse across many invocations. Each call to `Invoke` or `InvokeStream` creates a fresh state machine, so one `Orchestrator` instance safely serves concurrent requests without shared mutable state.

The orchestrator coordinates every subsystem -- LLM provider, policy hooks, budget enforcement, tool invocation, telemetry, credentials, and identity signing -- through the interfaces they expose. It never reaches into a component's internals. All wiring happens at construction time via functional options.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Orchestrator` | Struct | Public facade. Holds references to all injected components. Safe for concurrent use. |
| `Option` | Function type | Functional option for configuring the orchestrator at construction time. |
| `InvocationRequest` | Struct | Input to `Invoke` and `InvokeStream`. Contains messages, tool definitions, and per-call overrides. |
| `InvocationResult` | Struct | Output of a completed invocation. Contains the final message, token usage, budget snapshot, and terminal state. |

## Struct Field Reference

`InvocationRequest` and `InvocationResult` live in the root `praxis` package (not `orchestrator`). Import them as `praxis.InvocationRequest` / `praxis.InvocationResult`.

### InvocationRequest

| Field | Type | Description |
|---|---|---|
| `Metadata` | `map[string]string` | Caller-supplied key-value pairs propagated to `PolicyInput.Metadata` and telemetry attributes. |
| `Model` | `string` | Model identifier override. Empty string falls back to the orchestrator default. |
| `SystemPrompt` | `string` | System prompt for this invocation. Prepended as a system message. |
| `ParentToken` | `string` | Signed identity token from the parent invocation (agent-as-tool composition). Empty for top-level calls. |
| `Messages` | `[]llm.Message` | Conversation turns. Typically at least one user message. |
| `Tools` | `[]llm.ToolDefinition` | Tool definitions exposed to the LLM for this invocation. |
| `BudgetConfig` | `budget.Config` | Per-call budget limits (wall-clock, tokens, tool calls, cost). Zero values mean unlimited. |
| `MaxTurns` | `int` | Maximum LLM turns before forced termination. Zero uses the orchestrator default. |

### InvocationResult

| Field | Type | Description |
|---|---|---|
| `Response` | `*llm.Message` | Final assistant message. `nil` on early termination before any LLM response. |
| `BudgetSnapshot` | `budget.BudgetSnapshot` | Resource consumption at completion. |
| `InvocationID` | `string` | Unique identifier for this invocation. Stable across events and telemetry. |
| `SignedIdentity` | `string` | Ed25519-signed JWT identity token for downstream propagation. Empty if no signer is configured. |
| `Events` | `[]event.InvocationEvent` | Ordered lifecycle events (synchronous `Invoke` only; `InvokeStream` delivers via channel). |
| `FinalState` | `state.State` | Terminal state reached (`Completed`, `Failed`, `BudgetExceeded`, `ApprovalRequired`, `Cancelled`). |

## Usage Patterns

### Construction with Functional Options

Create an `Orchestrator` by passing a required `llm.Provider` and zero or more `Option` values to `orchestrator.New`. Every dependency has a sensible default: `NullInvoker` for tools, `AllowAllPolicyHook` for policy, `NullGuard` for budget, and so on.

```go title="Minimal orchestrator construction"
orch, err := orchestrator.New(anthropicProvider)
```

`orchestrator.New` returns `(*Orchestrator, error)`. Override defaults by stacking options. Options are applied in order; later options win if they target the same dependency. Filter options (`WithPreLLMFilter`, `WithPreToolFilter`, `WithPostToolFilter`) and `WithPolicyHook` accept a single value per call but may be passed multiple times to build a chain.

```go title="Orchestrator with all components"
orch, err := orchestrator.New(
    anthropicProvider,
    orchestrator.WithDefaultModel("claude-sonnet-4-5"),
    orchestrator.WithMaxTurns(10),
    orchestrator.WithToolInvoker(myInvoker),
    orchestrator.WithPolicyHook(myPolicyHook),
    orchestrator.WithBudgetGuard(myGuard),
    orchestrator.WithPriceProvider(myPricing),
    orchestrator.WithCredentialResolver(myResolver),
    orchestrator.WithIdentitySigner(mySigner),
    orchestrator.WithLifecycleEmitter(myEmitter),
    orchestrator.WithAttributeEnricher(myEnricher),
    orchestrator.WithPreLLMFilter(redactFilter),
    orchestrator.WithPreLLMFilter(logFilter),
    orchestrator.WithPostToolFilter(auditFilter),
)
```

### Synchronous Invocation

`Invoke` runs the full state machine to completion and returns the final result. The provided `context.Context` controls cancellation and deadline propagation.

```go title="Synchronous invocation"
result, err := orch.Invoke(ctx, praxis.InvocationRequest{
    Messages: []llm.Message{
        {Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("Summarize this document.")}},
    },
})
```

### Streaming Invocation

`InvokeStream` returns a channel of `event.InvocationEvent` values, allowing callers to observe each state transition as it happens. The channel closes when the invocation reaches a terminal state.

```go title="Streaming invocation"
eventCh, err := orch.InvokeStream(ctx, praxis.InvocationRequest{
    Messages: []llm.Message{
        {Role: llm.RoleUser, Parts: []llm.MessagePart{llm.TextPart("Analyze this dataset.")}},
    },
})
for evt := range eventCh {
    fmt.Printf("state=%s event=%s\n", evt.State, evt.Type)
}
```

### Concurrency

A single `Orchestrator` instance is safe for concurrent use. Each `Invoke` or `InvokeStream` call creates its own state machine and invocation context. Shared components (provider, hooks, budget guard) must themselves be safe for concurrent use, which all shipped implementations guarantee.

## Full API Reference

For complete type and method documentation, see [orchestrator on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/orchestrator).

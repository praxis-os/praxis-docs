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

## Usage Patterns

### Construction with Functional Options

Create an `Orchestrator` by passing a required `llm.Provider` and zero or more `Option` values to `orchestrator.New`. Every dependency has a sensible default: `NullInvoker` for tools, `AllowAllPolicyHook` for policy, `NullGuard` for budget, and so on.

```go title="Minimal orchestrator construction"
orch := orchestrator.New(
    anthropicProvider,
)
```

Override defaults by stacking options. Options are applied in order; later options win if they target the same dependency.

```go title="Orchestrator with all components"
orch := orchestrator.New(
    anthropicProvider,
    orchestrator.WithToolInvoker(myInvoker),
    orchestrator.WithPolicyHook(myPolicyHook),
    orchestrator.WithBudgetGuard(myGuard),
    orchestrator.WithPriceProvider(myPricing),
    orchestrator.WithCredentialResolver(myResolver),
    orchestrator.WithIdentitySigner(mySigner),
    orchestrator.WithEventEmitter(myEmitter),
    orchestrator.WithAttributeEnricher(myEnricher),
    orchestrator.WithPreLLMFilters(redactFilter, logFilter),
    orchestrator.WithPostToolFilters(auditFilter),
)
```

### Synchronous Invocation

`Invoke` runs the full state machine to completion and returns the final result. The provided `context.Context` controls cancellation and deadline propagation.

```go title="Synchronous invocation"
result, err := orch.Invoke(ctx, orchestrator.InvocationRequest{
    Messages: []llm.Message{
        {Role: llm.RoleUser, Parts: []llm.MessagePart{{Type: llm.PartTypeText, Text: "Summarize this document."}}},
    },
})
```

### Streaming Invocation

`InvokeStream` returns a channel of `event.InvocationEvent` values, allowing callers to observe each state transition as it happens. The channel closes when the invocation reaches a terminal state.

```go title="Streaming invocation"
eventCh, err := orch.InvokeStream(ctx, orchestrator.InvocationRequest{
    Messages: []llm.Message{
        {Role: llm.RoleUser, Parts: []llm.MessagePart{{Type: llm.PartTypeText, Text: "Analyze this dataset."}}},
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

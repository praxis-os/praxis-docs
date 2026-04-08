---
title: "budget Package"
description: "The budget package enforces four-dimensional resource limits on agent invocations, tracking wall-clock time, tokens, tool calls, and estimated cost."
sidebar_label: "budget"
sidebar_position: 6
keywords: [praxis, budget, guard, price-provider, tokens, cost, wall-clock, tool-calls, micro-dollars, enforcement]
rag_section: "api-reference"
rag_packages: ["budget"]
rag_interfaces: ["budget.Guard", "budget.PriceProvider"]
rag_difficulty: "intermediate"
---

# budget Package

## Purpose

The `budget` package provides resource enforcement for agent invocations. Every invocation can be constrained across four independent dimensions: wall-clock duration, LLM token consumption, tool-call count, and estimated monetary cost. When any single dimension is breached, the orchestrator transitions the invocation to the `BudgetExceeded` terminal state.

The package defines two interfaces. `Guard` tracks consumption and checks limits. `PriceProvider` maps token usage to monetary cost so the guard can enforce cost budgets. Both have null implementations that impose no limits, which serve as the default when no budget is configured.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Guard` | Interface | Tracks resource consumption and enforces limits. Called by the orchestrator after each LLM response and tool call. |
| `PriceProvider` | Interface | Maps (provider name, model name, token direction) to a per-token price in micro-dollars. |
| `BudgetSnapshot` | Value type | Point-in-time view of consumption and remaining capacity across all four dimensions. |
| `TokenDirection` | Enum | `Input` or `Output`. Used by `PriceProvider` to distinguish input and output token pricing. |
| `NullGuard` | Struct | Default guard that never enforces limits. All checks return within budget. |
| `NullPriceProvider` | Struct | Default price provider that returns zero cost for all queries. |

## Usage Patterns

### Configuring a Budget Guard

Pass a `Guard` implementation to the orchestrator via the `WithBudgetGuard` option. The guard receives consumption updates after each LLM call and tool execution.

```go title="Setting up budget enforcement"
guard := budget.NewDefaultGuard(budget.Limits{
    MaxDuration:   30 * time.Second,
    MaxTokens:     50_000,
    MaxToolCalls:  20,
    MaxCostMicros: 500_000, // $0.50
})

orch := orchestrator.New(
    provider,
    orchestrator.WithBudgetGuard(guard),
    orchestrator.WithPriceProvider(myPriceProvider),
)
```

### Implementing a PriceProvider

A `PriceProvider` translates token counts into monetary cost. The orchestrator calls it after each LLM response, passing the provider name, model name, and token counts for both input and output directions.

```go title="PriceProvider interface"
type PriceProvider interface {
    PricePerToken(providerName, modelName string, direction TokenDirection) int64
}
```

The returned value is in micro-dollars (millionths of a dollar). For example, if a model charges $3.00 per million input tokens, the `PricePerToken` call for `Input` returns `3`.

### Reading Budget Snapshots

A `BudgetSnapshot` provides a point-in-time view of consumption. It is available through `InvocationContext` in tool implementations and through `InvocationResult` after completion.

```go title="Inspecting budget after invocation"
result, err := orch.Invoke(ctx, req)
if err != nil {
    // handle
}
snap := result.BudgetSnapshot
fmt.Printf("tokens_used=%d cost_micros=%d tool_calls=%d duration=%s\n",
    snap.TokensUsed, snap.CostMicros, snap.ToolCallCount, snap.Elapsed)
```

### Four-Dimensional Independence

Each dimension is tracked independently. A breach in any single dimension halts the invocation immediately. The framework does not wait for multiple dimensions to be exceeded. This means a fast invocation that burns through tokens will stop on the token limit even if the wall-clock and cost budgets have ample room.

When a budget is breached, the orchestrator emits a `BudgetExceededError` and the invocation transitions to the `BudgetExceeded` terminal state. The error includes which dimension was breached and the snapshot at the moment of breach.

## Full API Reference

For complete type and method documentation, see [budget on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/budget).

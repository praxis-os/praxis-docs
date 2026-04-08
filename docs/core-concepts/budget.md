---
title: Budget Enforcement
description: Budget enforcement in praxis tracks four resource dimensions and transitions agents to a terminal state when any limit is breached.
sidebar_label: Budget Enforcement
sidebar_position: 5
keywords:
  - budget
  - cost tracking
  - token limits
  - wall clock
  - rate limiting
  - micro-dollars
rag_section: core-concepts
rag_packages:
  - budget
rag_interfaces:
  - budget.Guard
  - budget.PriceProvider
rag_difficulty: intermediate
---

# Budget Enforcement

Every agent invocation can be constrained by a budget that caps resource consumption across four independent dimensions. When any single dimension is breached, the agent transitions to the **BudgetExceeded** terminal state immediately.

## Four Dimensions

Budget enforcement tracks four orthogonal resource dimensions during an agent invocation.

| Dimension | Unit | Example Limit |
|-----------|------|---------------|
| Wall-clock duration | `time.Duration` | `30 * time.Second` |
| LLM token consumption | Integer (input + output combined) | `50_000` |
| Tool call count | Integer | `20` |
| Estimated cost | Micro-dollars (`int64`) | `500_000` (= $0.50) |

Each dimension is tracked independently. A breach in **any single dimension** is sufficient to halt the agent. The framework does not wait for multiple dimensions to be exceeded --- the first breach wins.

When a budget limit is breached, the orchestrator emits an error of kind `budget_exceeded` and the invocation transitions to the `BudgetExceeded` terminal state. See [Error Taxonomy](/docs/core-concepts/error-taxonomy) for details on error kinds.

:::note
Token consumption counts both input and output tokens from every LLM call within the invocation, not just the final turn.
:::

## The Guard Interface

The `budget.Guard` interface is the central abstraction for recording and checking resource consumption.

```go title="budget/guard.go"
type Guard interface {
    RecordTokens(ctx context.Context, input, output int) error
    RecordToolCall(ctx context.Context) error
    RecordCost(ctx context.Context, microDollars int64) error
    Check(ctx context.Context) error
    Snapshot(ctx context.Context) BudgetSnapshot
}
```

The orchestrator calls `RecordTokens`, `RecordToolCall`, and `RecordCost` at the appropriate points during an invocation. After each recording call, the framework invokes `Check` to determine whether any dimension has been exceeded. If `Check` returns a non-nil error, the invocation halts.

:::tip
You do not need to call `Check` manually in most cases. The orchestrator calls it automatically after every recording operation. Use `Check` directly only when you need to inspect budget status from a custom tool or hook.
:::

For full method-level documentation, see the [budget package on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/budget).

## BudgetSnapshot

A `BudgetSnapshot` is a value type that captures consumed resources at a specific point in time.

```go title="budget/snapshot.go"
type BudgetSnapshot struct {
    WallClock   time.Duration
    InputTokens int
    OutputTokens int
    ToolCalls   int
    CostMicro   int64
}
```

The snapshot is available on `InvocationResult` after every invocation completes, regardless of whether the invocation succeeded or exceeded its budget. This makes snapshots useful for logging, billing, and post-hoc analysis.

```go title="example_snapshot_test.go"
result, err := orch.Invoke(ctx, request)
snap := result.BudgetSnapshot
log.Printf("used %d tokens, %d tool calls, cost $%.4f",
    snap.InputTokens+snap.OutputTokens,
    snap.ToolCalls,
    float64(snap.CostMicro)/1_000_000,
)
```

:::note
A snapshot reflects consumption at the moment it was taken. If you call `Snapshot` mid-invocation from a hook, it will not include resources consumed after that point.
:::

## Price Provider

The `budget.PriceProvider` interface maps a combination of provider, model, and direction (input or output) to a per-token price in micro-dollars.

```go title="budget/price_provider.go"
type PriceProvider interface {
    PricePerToken(provider, model string, direction TokenDirection) int64
}
```

No commercial prices are hardcoded into the framework. Pricing is entirely caller-provided. This keeps the library vendor-neutral and avoids stale pricing data.

```go title="example_price_provider_test.go"
pp := budget.NewStaticPriceProvider(map[budget.PriceKey]int64{
    {Provider: "openai", Model: "gpt-4o", Direction: budget.Input}:  250,  // $0.00025 per token
    {Provider: "openai", Model: "gpt-4o", Direction: budget.Output}: 1000, // $0.001 per token
})

orch := orchestrator.New(provider,
    orchestrator.WithPriceProvider(pp),
    orchestrator.WithBudgetGuard(budget.NewGuard(budget.Limits{
        CostMicro: 500_000, // $0.50 max
    })),
)
```

:::warning
If you set a cost limit on your `budget.Guard` but do not provide a `PriceProvider`, cost will never be recorded and the cost dimension will never trigger. Always pair cost limits with a price provider.
:::

## Wall-Clock Boundary

Wall-clock tracking starts when the invocation enters the **Initializing** state and stops when it reaches any terminal state (Completed, Failed, BudgetExceeded, Cancelled, or ApprovalRequired).

The wall-clock dimension is measured against real elapsed time, not CPU time. This means that network latency, LLM response times, and tool execution time all count toward the wall-clock budget.

:::tip
Wall-clock budgets are particularly useful for user-facing agents where response latency matters. Combine a wall-clock limit with a token limit to constrain both time and cost.
:::

## Default Behavior

When no budget components are configured, the orchestrator uses safe null defaults.

| Component | Null Default | Behavior |
|-----------|-------------|----------|
| `budget.Guard` | `NullGuard` | No limits enforced on any dimension |
| `budget.PriceProvider` | `NullPriceProvider` | No cost tracking; `RecordCost` is a no-op |

Both null defaults are safe for zero-wiring. An orchestrator constructed with only an `llm.Provider` will not enforce any budget constraints. See [Zero-Wiring Defaults](/docs/core-concepts/zero-wiring) for more on this design principle.

```go title="example_null_guard_test.go"
// This is perfectly valid — no budget enforcement, no panics.
orch := orchestrator.New(provider)
result, err := orch.Invoke(ctx, request)
```

For the complete API reference, see the [budget package on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/budget).

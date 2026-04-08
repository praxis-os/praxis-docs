---
title: "Budget Configuration"
description: "How to implement budget.Guard and budget.PriceProvider to enforce multi-dimensional cost limits on praxis invocations."
sidebar_label: "Budget Configuration"
sidebar_position: 6
keywords: [budget, guard, PriceProvider, cost, tokens, wall-clock, tool-calls, micro-dollars, BudgetExceeded, BudgetSnapshot]
rag_section: "guides"
rag_packages: ["budget"]
rag_interfaces: ["budget.Guard", "budget.PriceProvider"]
rag_difficulty: "advanced"
---

# Budget Configuration

This guide shows how to implement `budget.Guard` and `budget.PriceProvider` to enforce cost limits across praxis invocations. Budget enforcement prevents runaway costs from unbounded tool-use loops or expensive model calls.

## Implementing budget.Guard

The `budget.Guard` interface tracks consumption across four dimensions and reports when any limit is breached.

```go title="simple_guard.go"
type SimpleGuard struct {
    mu           sync.Mutex
    maxTokens    int64
    maxToolCalls int64
    maxCost      int64 // micro-dollars
    maxDuration  time.Duration
    consumed     budget.BudgetSnapshot
    startTime    time.Time
}

func NewSimpleGuard(maxTokens, maxToolCalls, maxCost int64, maxDuration time.Duration) *SimpleGuard {
    return &SimpleGuard{
        maxTokens:    maxTokens,
        maxToolCalls: maxToolCalls,
        maxCost:      maxCost,
        maxDuration:  maxDuration,
        startTime:    time.Now(),
    }
}
```

The guard must be safe for concurrent use since tool calls may execute in parallel.

## Setting Limits

Each dimension has a specific unit and purpose:

| Dimension | Unit | Example Limit | Protects Against |
|-----------|------|---------------|-----------------|
| Wall-clock duration | `time.Duration` | `30 * time.Second` | Runaway invocations |
| Token consumption | count (input + output) | `10000` | Expensive completions |
| Tool call count | count | `20` | Infinite tool loops |
| Estimated cost | micro-dollars (1/1,000,000 USD) | `500000` (= $0.50) | Budget overruns |

:::tip

Start with generous limits and tighten based on observed usage. The `BudgetSnapshot` in invocation results gives you the data to calibrate.

:::

## Implementing PriceProvider

The `budget.PriceProvider` interface maps LLM usage to cost. praxis hardcodes no commercial prices -- pricing is entirely caller-supplied.

```go title="price_provider.go"
type MyPriceProvider struct{}

func (p *MyPriceProvider) PriceForToken(
    provider string,
    model string,
    direction budget.TokenDirection,
) int64 {
    // Return price in micro-dollars per token
    if provider == "anthropic" && model == "claude-sonnet-4-20250514" {
        if direction == budget.Input {
            return 3 // $3 per million tokens = 3 micro-dollars per token
        }
        return 15 // $15 per million tokens
    }
    return 0 // unknown model: no cost tracking
}
```

Register both with the orchestrator:

```go title="orchestrator_setup.go"
orch, err := orchestrator.New(provider,
    orchestrator.WithBudgetGuard(NewSimpleGuard(10000, 20, 500000, 30*time.Second)),
    orchestrator.WithPriceProvider(&MyPriceProvider{}),
)
```

## Inspecting BudgetSnapshot

After an invocation completes, the `BudgetSnapshot` in the result shows consumed resources:

```go title="inspect_budget.go"
result, err := orch.Invoke(ctx, req)
if err != nil {
    // handle error
}

snap := result.BudgetSnapshot
fmt.Printf("Duration:   %v\n", snap.WallClock)
fmt.Printf("Tokens:     %d (in: %d, out: %d)\n", snap.TotalTokens, snap.InputTokens, snap.OutputTokens)
fmt.Printf("Tool calls: %d\n", snap.ToolCalls)
fmt.Printf("Cost:       $%.6f\n", float64(snap.CostMicroDollars)/1_000_000)
```

:::note

`BudgetSnapshot` is a value type -- it captures a point-in-time view of consumed resources. It is always populated in the result, even when using `NullGuard`.

:::

## Handling BudgetExceeded

When any budget dimension is breached, the state machine transitions to `BudgetExceeded` and the invocation terminates cleanly with all lifecycle events emitted:

```go title="handle_budget_exceeded.go"
result, err := orch.Invoke(ctx, req)
if err != nil {
    var te praxiserrors.TypedError
    if errors.As(err, &te) && te.Kind() == praxiserrors.BudgetExceeded {
        snap := result.BudgetSnapshot
        fmt.Printf("Budget exceeded after %d tokens, %d tool calls, $%.6f\n",
            snap.TotalTokens, snap.ToolCalls, float64(snap.CostMicroDollars)/1_000_000)
    }
}
```

The `BudgetExceeded` terminal state is distinct from `Failed` -- it signals a cost control boundary, not a system failure.

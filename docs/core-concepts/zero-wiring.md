---
title: Zero-Wiring Defaults
description: The praxis orchestrator is constructible with only an LLM provider because every optional component ships with a safe null default.
sidebar_label: Zero-Wiring Defaults
sidebar_position: 7
keywords:
  - zero wiring
  - defaults
  - null defaults
  - minimal setup
  - configuration
  - functional options
rag_section: core-concepts
rag_packages:
  - orchestrator
rag_interfaces:
  - orchestrator.Orchestrator
rag_difficulty: beginner
---

# Zero-Wiring Defaults

The praxis orchestrator requires exactly one dependency to construct: an `llm.Provider`. Every other component has a safe, well-defined null default. This is a deliberate design decision, not an accident.

## The Principle

A valid orchestrator can be built with a single line of code.

```go title="example_minimal_test.go"
orch := orchestrator.New(provider)
result, err := orch.Invoke(ctx, request)
```

This works because every optional component in the orchestrator ships with a null implementation that does nothing and returns no errors. The null defaults are not stubs or placeholders --- they are intentional, production-safe implementations that represent the "off" state for each capability.

:::note
The zero-wiring principle means you can start using praxis in under a minute and incrementally enable capabilities as your requirements grow. You never have to satisfy a dependency you do not need.
:::

## Null Defaults

The following table lists every optional component, its null default, and the behavior when the null default is active.

| Component | Null Default | Behavior |
|-----------|-------------|----------|
| `tools.Invoker` | `NullInvoker` | No tool execution; tool calls are not dispatched |
| `hooks.PolicyHook` | `AllowAllPolicyHook` | Allows all LLM requests without inspection |
| `hooks.PreLLMFilter` | (none configured) | No request filtering before LLM calls |
| `hooks.PostToolFilter` | (none configured) | No result filtering after tool execution |
| `budget.Guard` | `NullGuard` | No budget limits enforced on any dimension |
| `budget.PriceProvider` | `NullPriceProvider` | No cost tracking; cost recording is a no-op |
| `telemetry.LifecycleEventEmitter` | `NullEmitter` | No lifecycle events emitted |
| `telemetry.AttributeEnricher` | `NullEnricher` | No extra attributes added to telemetry spans |
| `credentials.Resolver` | `NullResolver` | No credential fetching; tools receive no credentials |
| `identity.Signer` | `NullSigner` | No identity tokens generated or attached |

:::tip
Every null default is exported from its package (for example, `budget.NullGuard`). You can use them directly in tests or when building partially-configured orchestrators.
:::

## Progressive Wiring

Start minimal and add capabilities one at a time using `orchestrator.WithXxx` functional options.

**Step 1: Minimal --- just an LLM provider**

```go title="example_step1_test.go"
orch := orchestrator.New(provider)
```

This orchestrator can call an LLM and return results. It has no tools, no budget, no policy enforcement, and no telemetry.

**Step 2: Add tools**

```go title="example_step2_test.go"
orch := orchestrator.New(provider,
    orchestrator.WithTools(invoker),
)
```

The agent can now execute tool calls. All other components remain at their null defaults.

**Step 3: Add budget enforcement**

```go title="example_step3_test.go"
orch := orchestrator.New(provider,
    orchestrator.WithTools(invoker),
    orchestrator.WithBudgetGuard(budget.NewGuard(budget.Limits{
        MaxTokens:  50_000,
        MaxCost:    500_000, // $0.50
        MaxToolCalls: 20,
        WallClock:  30 * time.Second,
    })),
    orchestrator.WithPriceProvider(priceProvider),
)
```

See [Budget Enforcement](/docs/core-concepts/budget) for details on configuring budget dimensions and price providers.

**Step 4: Add policy hooks and identity**

```go title="example_step4_test.go"
orch := orchestrator.New(provider,
    orchestrator.WithTools(invoker),
    orchestrator.WithBudgetGuard(guard),
    orchestrator.WithPriceProvider(priceProvider),
    orchestrator.WithPolicyHook(policyHook),
    orchestrator.WithPreLLMFilter(sanitizer),
    orchestrator.WithPostToolFilter(redactor),
    orchestrator.WithIdentitySigner(signer),
    orchestrator.WithCredentialsResolver(resolver),
    orchestrator.WithLifecycleEmitter(emitter),
    orchestrator.WithAttributeEnricher(enricher),
)
```

:::warning
Order of `WithXxx` options does not affect behavior. The orchestrator applies them during construction, not at call time. However, the order of hooks within a category (for example, multiple `PreLLMFilter` instances) is preserved and executed sequentially.
:::

## Why Zero-Wiring Matters

Zero-wiring is not a convenience shortcut. It is a design principle with concrete benefits.

**Smoke tests and examples.** Documentation code samples and integration smoke tests should not require elaborate setup. A reader should be able to copy a code block, provide an LLM provider, and see it work.

```go title="example_smoke_test.go"
func TestSmoke(t *testing.T) {
    provider := testutil.NewMockProvider(t)
    orch := orchestrator.New(provider)

    result, err := orch.Invoke(context.Background(), orchestrator.Request{
        SystemPrompt: "You are a helpful assistant.",
        UserMessage:  "Say hello.",
    })
    require.NoError(t, err)
    require.NotEmpty(t, result.Output)
}
```

**Local development.** Developers iterating on tool logic or prompt engineering should not be forced to configure budget guards, policy hooks, or telemetry pipelines just to test a change locally.

**Incremental adoption.** Teams adopting praxis in an existing system can start with the minimal configuration and progressively enable capabilities as they build out infrastructure (policy services, billing pipelines, observability backends).

:::note
Zero-wiring guarantees that the framework never forces unnecessary complexity on the caller. If you do not need a capability, you do not pay for it in configuration, dependencies, or cognitive overhead.
:::

**No hidden requirements.** Because null defaults are explicit and well-defined, there are no surprises. A `NullGuard` does not secretly enforce limits. An `AllowAllPolicyHook` does not quietly log requests. The "off" state is truly off.

For the full component model and how these pieces fit together, see the [Architecture Overview](/docs/core-concepts/architecture).

For method-level API documentation, see the [orchestrator package on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/orchestrator).

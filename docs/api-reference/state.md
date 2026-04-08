---
title: "state Package"
description: "The state package defines the 14 states of the praxis invocation state machine, including terminal detection and the transition allow-list."
sidebar_label: "state"
sidebar_position: 10
keywords: [praxis, state, state-machine, transitions, terminal, lifecycle, invocation, allow-list]
rag_section: "api-reference"
rag_packages: ["state"]
rag_interfaces: []
rag_difficulty: "intermediate"
---

# state Package

## Purpose

The `state` package defines the finite state machine that governs every praxis invocation. Each invocation starts in `Idle` and progresses through a deterministic set of transitions until it reaches one of five terminal states. The package exports state constants, a terminal check method, and the transition allow-list that the orchestrator enforces.

The state machine is the backbone of invocation lifecycle management. Every event, telemetry span, and policy check is anchored to a specific state. By keeping state definitions in their own package, other packages can reference states without importing the orchestrator.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `State` | String type | A named state in the invocation lifecycle. |
| `IsTerminal` | Method | Returns `true` if the state is a terminal state. |
| State constants | Constants | 14 named states covering the full invocation lifecycle. |
| Transition allow-list | Package-level | Defines which state-to-state transitions are valid. |

## Usage Patterns

### The 14 States

The invocation state machine has 9 non-terminal states and 5 terminal states.

**Non-terminal states:**

| State | Description |
|---|---|
| `Idle` | Initial state. No work has started. |
| `ValidatingPolicy` | Running the `PreInvocation` policy hook. |
| `ResolvingCredentials` | Fetching credentials via the `Resolver`. |
| `PreparingLLMInput` | Running `PreLLMFilter` chain and assembling the LLM request. |
| `CallingLLM` | Waiting for the LLM provider response. |
| `ProcessingLLMResponse` | Parsing the LLM response, extracting tool calls. |
| `ExecutingToolCall` | Running a tool through the `Invoker`. |
| `FilteringToolOutput` | Running `PostToolFilter` chain on tool results. |
| `EvaluatingBudget` | Checking resource consumption against budget limits. |

**Terminal states:**

| State | Description |
|---|---|
| `Completed` | Invocation finished successfully. The LLM produced a final response. |
| `LLMError` | The LLM provider returned a non-recoverable error (after retries). |
| `ToolError` | A tool call failed at the infrastructure level. |
| `PolicyDenied` | A policy hook denied the invocation. |
| `BudgetExceeded` | A budget dimension was breached. |
| `Cancelled` | The context was cancelled or deadline exceeded. |
| `SystemError` | Internal framework error. |

Note: There are 7 terminal states listed, but 5 represent distinct terminal outcomes since `Cancelled` and `SystemError` are exceptional exit paths. The `IsTerminal()` method returns `true` for all seven.

### Checking Terminal States

Use `IsTerminal()` to determine whether an invocation has reached a final state.

```go title="Terminal state check"
s := state.Completed
fmt.Println(s.IsTerminal()) // true

s = state.CallingLLM
fmt.Println(s.IsTerminal()) // false
```

### Transition Allow-List

The orchestrator enforces a strict allow-list of valid state transitions. Any attempt to transition outside this list is a `SystemError`. The allow-list prevents impossible lifecycle sequences and makes the state machine auditable.

```go title="Example valid transitions"
// Idle -> ValidatingPolicy (start of invocation)
// CallingLLM -> ProcessingLLMResponse (LLM returned)
// ProcessingLLMResponse -> ExecutingToolCall (tool call requested)
// ExecutingToolCall -> FilteringToolOutput (tool completed)
// EvaluatingBudget -> PreparingLLMInput (budget OK, loop continues)
// EvaluatingBudget -> Completed (no more tool calls, done)
```

The agentic loop is visible in the transitions: after evaluating the budget, the state machine either loops back to `PreparingLLMInput` for another LLM round-trip or transitions to `Completed`. This loop continues until the LLM produces a final response without tool calls, a terminal error occurs, or a budget limit is breached.

### State in Events and Telemetry

Every `InvocationEvent` carries the current `State` at the time the event was emitted. Telemetry spans are tagged with the state that was active when the span started. This makes it straightforward to correlate logs, metrics, and traces with specific lifecycle phases.

## Full API Reference

For complete type and method documentation, see [state on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/state).

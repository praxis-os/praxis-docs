---
title: "event Package"
description: "The event package defines the InvocationEvent type and 19 event types that represent every observable moment in a praxis invocation lifecycle."
sidebar_label: "event"
sidebar_position: 11
keywords: [praxis, event, invocation-event, event-type, lifecycle, terminal, streaming, telemetry, state-transition]
rag_section: "api-reference"
rag_packages: ["event"]
rag_interfaces: []
rag_difficulty: "intermediate"
---

# event Package

## Purpose

The `event` package defines the structured events emitted during a praxis invocation. Every state transition, LLM interaction, tool call, and terminal outcome produces an `InvocationEvent`. These events are the primary mechanism for observing invocation behavior -- they drive streaming responses, telemetry pipelines, and audit logs.

The package defines 19 event types: 14 non-terminal events that correspond to lifecycle transitions and 5 terminal events that mark how an invocation ended. Events are emitted through the `telemetry.LifecycleEventEmitter` interface and delivered to streaming callers through the channel returned by `InvokeStream`.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `InvocationEvent` | Struct | A single lifecycle event with type, identifiers, state, timestamp, and optional context. |
| `EventType` | String type | One of 19 named event types. |

## Usage Patterns

### Event Fields

Every `InvocationEvent` carries a consistent set of fields.

| Field | Type | Description |
|---|---|---|
| `Type` | `EventType` | Which event occurred. |
| `ID` | `string` | Unique event identifier. |
| `InvocationID` | `string` | The invocation this event belongs to. |
| `State` | `state.State` | The state at the time of emission. |
| `Timestamp` | `time.Time` | When the event was emitted. |
| `Error` | `TypedError` | Present only on error events. `nil` otherwise. |
| `ToolContext` | `*ToolEventContext` | Present only on tool-related events. Contains tool call details. |
| `BudgetSnapshot` | `*BudgetSnapshot` | Present on budget-related events. Point-in-time resource consumption. |

### The 19 Event Types

**Non-terminal events (14):**

| Event Type | Emitted When |
|---|---|
| `InvocationStarted` | Invocation begins, state enters `Idle`. |
| `PolicyValidationStarted` | `PreInvocation` policy hook evaluation begins. |
| `PolicyValidationPassed` | Policy hook returned `Allow`. |
| `CredentialResolutionStarted` | Credential resolver called. |
| `CredentialResolutionCompleted` | Credentials resolved successfully. |
| `LLMInputPrepared` | PreLLM filters ran and LLM request is assembled. |
| `LLMCallStarted` | Request sent to LLM provider. |
| `LLMCallCompleted` | LLM provider returned a response. |
| `LLMResponseProcessed` | Response parsed, tool calls extracted (if any). |
| `ToolCallStarted` | Tool invocation dispatched to the `Invoker`. |
| `ToolCallCompleted` | Tool returned a result. |
| `ToolOutputFiltered` | PostTool filters ran on tool result. |
| `BudgetEvaluated` | Budget check passed, invocation continues. |
| `PostInvocationHookRan` | `PostInvocation` policy hook completed. |

**Terminal events (5):**

| Event Type | Emitted When |
|---|---|
| `InvocationCompleted` | Invocation finished successfully. |
| `InvocationFailed` | Invocation ended due to an LLM or tool error. |
| `InvocationPolicyDenied` | A policy hook denied the invocation. |
| `InvocationBudgetExceeded` | A budget dimension was breached. |
| `InvocationCancelled` | The context was cancelled. |

### Consuming Events via Streaming

When using `InvokeStream`, events arrive on a channel in emission order. The channel closes after the terminal event.

```go title="Streaming event consumption"
eventCh, err := orch.InvokeStream(ctx, req)
if err != nil {
    // handle
}
for evt := range eventCh {
    switch evt.Type {
    case event.ToolCallStarted:
        fmt.Printf("tool=%s id=%s\n", evt.ToolContext.ToolName, evt.ToolContext.CallID)
    case event.InvocationCompleted:
        fmt.Println("done")
    case event.InvocationFailed:
        fmt.Printf("failed: %s\n", evt.Error)
    }
}
```

### Events and Telemetry

The `LifecycleEventEmitter` receives every event before it reaches the streaming channel. Emitter implementations typically forward events to structured logging, distributed tracing, or metrics systems. See the [telemetry package](./telemetry.md) for details on how events map to spans and metrics.

### Event Ordering Guarantees

Events are emitted in strict lifecycle order within a single invocation. The orchestrator does not emit events concurrently for the same invocation. Consumers can rely on the sequence: `InvocationStarted` is always first, and exactly one terminal event is always last.

## Full API Reference

For complete type and method documentation, see [event on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/event).

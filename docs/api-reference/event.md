---
title: "event Package"
description: "The event package defines the InvocationEvent type and 21 event types that represent every observable moment in a praxis invocation lifecycle."
sidebar_label: "event"
sidebar_position: 11
keywords: [praxis, event, invocation-event, event-type, lifecycle, terminal, streaming, telemetry, state-transition, AuditNote, ApprovalSnapshot, content-analysis]
rag_section: "api-reference"
rag_packages: ["event"]
rag_interfaces: []
rag_difficulty: "intermediate"
---

# event Package

## Purpose

The `event` package defines the structured events emitted during a praxis invocation. Every state transition, LLM interaction, tool call, and terminal outcome produces an `InvocationEvent`. These events are the primary mechanism for observing invocation behavior -- they drive streaming responses, telemetry pipelines, and audit logs.

The package defines 21 event types: 14 non-terminal lifecycle events, 2 content-analysis events, and 5 terminal events that mark how an invocation ended. Events are emitted through the `telemetry.LifecycleEventEmitter` interface and delivered to streaming callers through the channel returned by `InvokeStream`.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `InvocationEvent` | Struct | A single lifecycle event with type, identifiers, state, timestamp, and optional context. |
| `EventType` | String type | One of 21 named event types. Has an `IsTerminal()` method. |

## Usage Patterns

### Event Fields

Every `InvocationEvent` carries a consistent set of fields.

| Field | Type | Description |
|---|---|---|
| `Type` | `EventType` | Which event occurred. |
| `InvocationID` | `string` | The invocation this event belongs to. |
| `State` | `state.State` | The state at the time of emission. |
| `At` | `time.Time` | When the event was emitted. |
| `Err` | `error` | Present only on failure/cancellation terminal events. `nil` otherwise. |
| `ToolCallID` | `string` | Tool call identifier, populated for tool-related events. |
| `ToolName` | `string` | Tool name, populated for tool-related events. |
| `BudgetSnapshot` | `budget.BudgetSnapshot` | Budget consumption at the time of the event. |
| `ApprovalSnapshot` | `*errors.ApprovalSnapshot` | Populated only for `EventTypeApprovalRequired`. Contains the resumption packet. |
| `AuditNote` | `string` | Optional human-readable annotation attached by policy hooks or filters. Empty when no annotation was provided. |

### The 21 Event Types

**Non-terminal events (14):**

| Constant | Event String | Emitted When |
|---|---|---|
| `EventTypeInvocationStarted` | `invocation.started` | Invocation begins, `Created` -> `Initializing`. |
| `EventTypeInitialized` | `invocation.initialized` | `Initializing` -> `PreHook`; PriceProvider snapshot taken, wall-clock started. |
| `EventTypePreHookStarted` | `prehook.started` | `PreHook` state entry. |
| `EventTypePreHookCompleted` | `prehook.completed` | `PreHook` -> `LLMCall`; all hooks returned `Allow`. |
| `EventTypeLLMCallStarted` | `llmcall.started` | `LLMCall` state entry; pre-LLM filters applied. |
| `EventTypeLLMCallCompleted` | `llmcall.completed` | `LLMCall` -> `ToolDecision`; LLM response received. |
| `EventTypeToolDecisionStarted` | `tooldecision.started` | `ToolDecision` state entry. No matching *Completed event (synchronous). |
| `EventTypeToolCallStarted` | `toolcall.started` | `ToolDecision` -> `ToolCall`. `ToolCallID` and `ToolName` are set. |
| `EventTypeToolCallCompleted` | `toolcall.completed` | `ToolCall` -> `PostToolFilter`. `ToolCallID` is set. |
| `EventTypePostToolFilterStarted` | `posttoolfilter.started` | `PostToolFilter` state entry. `ToolCallID` is set. |
| `EventTypePostToolFilterCompleted` | `posttoolfilter.completed` | `PostToolFilter` -> `LLMContinuation`. `ToolCallID` is set. |
| `EventTypeLLMContinuationStarted` | `llmcontinuation.started` | `LLMContinuation` state entry; tool results injected. |
| `EventTypePostHookStarted` | `posthook.started` | `PostHook` state entry. |
| `EventTypePostHookCompleted` | `posthook.completed` | `PostHook` -> terminal; post-hook chain passed. |

**Content-analysis events (2):**

| Constant | Event String | Emitted When |
|---|---|---|
| `EventTypePIIRedacted` | `filter.pii_redacted` | A filter redacted PII from content. |
| `EventTypePromptInjectionSuspected` | `filter.prompt_injection_suspected` | A filter detected a suspected prompt injection attempt. |

**Terminal events (5):**

| Constant | Event String | Emitted When |
|---|---|---|
| `EventTypeInvocationCompleted` | `invocation.completed` | Invocation finished successfully. |
| `EventTypeInvocationFailed` | `invocation.failed` | Invocation ended due to an error. `Err` is set. |
| `EventTypeInvocationCancelled` | `invocation.cancelled` | The context was cancelled. |
| `EventTypeBudgetExceeded` | `budget.exceeded` | A budget dimension was breached. `BudgetSnapshot.ExceededDimension` identifies the breach. |
| `EventTypeApprovalRequired` | `approval.required` | A policy hook returned `RequireApproval`. `ApprovalSnapshot` is set. |

### Consuming Events via Streaming

When using `InvokeStream`, events arrive on a channel in emission order. The channel closes after the terminal event.

```go title="Streaming event consumption"
ch := orch.InvokeStream(ctx, req)
for evt := range ch {
    switch evt.Type {
    case event.EventTypeToolCallStarted:
        fmt.Printf("tool=%s call=%s\n", evt.ToolName, evt.ToolCallID)
    case event.EventTypeInvocationCompleted:
        fmt.Println("done")
    case event.EventTypeInvocationFailed:
        fmt.Printf("failed: %v\n", evt.Err)
    }
}
```

### Events and Telemetry

The `LifecycleEventEmitter` receives every event before it reaches the streaming channel. Emitter implementations typically forward events to structured logging, distributed tracing, or metrics systems. See the [telemetry package](./telemetry.md) for details on how events map to spans and metrics.

### Event Ordering Guarantees

Events are emitted in strict lifecycle order within a single invocation. The orchestrator does not emit events concurrently for the same invocation. Consumers can rely on the sequence: `invocation.started` is always first, and exactly one terminal event is always last.

## Full API Reference

For complete type and method documentation, see [event on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/event).

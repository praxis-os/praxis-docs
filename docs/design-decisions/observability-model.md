---
title: "Observability Model"
description: "Key design decisions on praxis observability: OpenTelemetry span tree, 10 Prometheus metrics, RedactingHandler for structured logging, and error-to-terminal-event mapping."
sidebar_label: "Observability Model"
sidebar_position: 5
keywords: [observability, opentelemetry, spans, prometheus, metrics, RedactingHandler, slog, error-mapping, D53, D57, D58, D61]
rag_section: "design-decisions"
rag_packages: ["telemetry"]
rag_interfaces: ["telemetry.LifecycleEventEmitter", "telemetry.AttributeEnricher"]
rag_difficulty: "intermediate"
---

# Observability Model

These decisions define how praxis exposes telemetry, metrics, and logging.

## D53: OpenTelemetry Span Tree

Each invocation produces a root span `praxis.invocation` with child spans for I/O-bound phases: `prehook`, `llmcall`, `toolcall`, `posttoolfilter`, `llmcontinuation`, `posthook`. Synchronous phases like `ToolDecision` do not get spans (they add no I/O latency).

Nested invocations (agent-as-tool) create a **new root span with a SpanLink** rather than a parent-child hierarchy. This was a deliberate choice: parent-child would create unbounded trace depth and couple the inner invocation's lifecycle to the outer one. SpanLinks preserve correlation without coupling.

## D57: Ten Bounded Prometheus Metrics

praxis exposes exactly 10 Prometheus metrics with the `praxis_` prefix. The cardinality is bounded at approximately 1,032 time series in the worst case. This bound was calculated by analyzing the label space:

- Terminal states (5 values) x invocation metrics
- Provider x model combinations (bounded by configured providers)
- Tool names (bounded by registered tools)
- Error kinds (7 values)
- Budget dimensions (4 values)

No unbounded labels (like invocation IDs or user IDs) appear in metrics. High-cardinality data flows through `AttributeEnricher` to spans and events only.

## D58: slog RedactingHandler

The `telemetry/slog` package provides a `RedactingHandler` that wraps any `slog.Handler` and strips sensitive data before it reaches the underlying handler. Redaction targets:

- Credential material (matched by key patterns)
- Raw LLM response bodies (these may contain PII)
- Values matching configurable PII marker patterns

This handler is opt-in but strongly recommended. Without it, debug-level logging could leak sensitive data into log aggregators.

## D61: Error-to-Terminal-Event Mapping

Every `ErrorKind` maps 1:1 to a terminal state, and every terminal state maps to a specific event type. This triple mapping is deterministic:

| ErrorKind | Terminal State | Event Type |
|-----------|---------------|------------|
| `transient_llm` | Failed | InvocationFailed |
| `permanent_llm` | Failed | InvocationFailed |
| `tool` | Failed | InvocationFailed |
| `policy_denied` | Failed | InvocationFailed |
| `budget_exceeded` | BudgetExceeded | BudgetExceeded |
| `cancellation` | Cancelled | InvocationCancelled |
| `system` | Failed | InvocationFailed |
| `approval_required` | ApprovalRequired | ApprovalRequired |

This determinism means that monitoring dashboards, alerting rules, and log queries can rely on consistent event types for each class of outcome.

See [OpenTelemetry Setup](/docs/guides/otel-setup) for practical integration instructions.

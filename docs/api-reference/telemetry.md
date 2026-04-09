---
title: "telemetry"
description: "The telemetry package provides OpenTelemetry integration, Prometheus metrics recording, and structured logging with redaction for praxis invocations."
sidebar_label: "telemetry"
sidebar_position: 12
keywords: [telemetry, opentelemetry, otel, prometheus, metrics, spans, tracing, slog, redaction, LifecycleEventEmitter, AttributeEnricher, MetricsRecorder]
rag_section: "api-reference"
rag_packages: ["telemetry", "telemetry/slog", "telemetry/metrics"]
rag_interfaces: ["telemetry.LifecycleEventEmitter", "telemetry.AttributeEnricher", "telemetry.MetricsRecorder"]
rag_difficulty: "intermediate"
---

# telemetry

The `telemetry` package provides the observability layer for praxis invocations. It defines interfaces for lifecycle event emission, span attribute enrichment, and metrics recording, with sub-packages for structured logging and Prometheus instrumentation.

## Purpose

Observability in praxis is mandatory by design -- silent paths are considered a bug. The telemetry package defines three core interfaces that allow callers to integrate with their existing observability stack without the framework imposing specific backends.

The package follows a strict separation: the framework emits neutral events and records metrics through interfaces; the caller decides where those signals go.

## Key Interfaces and Types

| Interface / Type | Description |
|---|---|
| `LifecycleEventEmitter` | Emits `InvocationEvent` at each state machine transition. Default: `NullEmitter`. |
| `AttributeEnricher` | Contributes caller-specific key-value attributes to spans and events. Framework has no awareness of attribute names. Default: `NullEnricher`. |
| `MetricsRecorder` | Records Prometheus-style metrics for invocations, LLM calls, tool calls, budget breaches, and errors. |
| `ErrorClassifier` | Classifies framework errors for metric labeling. |

## Sub-Packages

### telemetry/slog

Package `slogredact` (`github.com/praxis-os/praxis/telemetry/slog`) provides a `RedactingHandler` that wraps any `slog.Handler` and redacts sensitive attribute values before forwarding log records to the inner handler.

**Constructor:**

```go
import slogredact "github.com/praxis-os/praxis/telemetry/slog"

handler := slogredact.NewRedactingHandler(slog.NewJSONHandler(os.Stderr, nil))
```

**Matching behavior:** any slog attribute whose key contains a deny-list substring (case-insensitive) has its value replaced with a placeholder. The default deny list covers common secret-bearing key names:

`token`, `key`, `secret`, `password`, `credential`, `authorization`

**Configuration options:**

| Option | Description |
|---|---|
| `WithDenyList(keys ...string)` | Replace the default deny list entirely. |
| `WithAdditionalDenyKeys(keys ...string)` | Extend the default deny list with additional substrings. |
| `WithRedactedValue(v string)` | Override the placeholder (default: `[REDACTED]`). |

```go title="Custom configuration"
handler := slogredact.NewRedactingHandler(inner,
    slogredact.WithAdditionalDenyKeys("ssn", "cvv"),
    slogredact.WithRedactedValue("<REMOVED>"),
)
```

The handler is safe for concurrent use. It holds no mutable state after construction. Group attributes are handled recursively.

### telemetry/metrics

Provides Prometheus instrumentation with 10 bounded metrics using the `praxis_` prefix:

| Metric | Labels | Description |
|--------|--------|-------------|
| `praxis_invocation_completions_total` | terminal_state | Counter of completed invocations |
| `praxis_invocation_duration_seconds` | terminal_state | Histogram of invocation duration |
| `praxis_llm_calls_total` | provider, model | Counter of LLM API calls |
| `praxis_llm_duration_seconds` | provider, model | Histogram of LLM call duration |
| `praxis_llm_tokens_total` | provider, model, direction | Counter of tokens consumed |
| `praxis_tool_invocations_total` | tool_name, status | Counter of tool invocations |
| `praxis_tool_duration_seconds` | tool_name | Histogram of tool execution duration |
| `praxis_budget_breaches_total` | dimension | Counter of budget breaches |
| `praxis_errors_total` | kind | Counter of errors by ErrorKind |
| `praxis_active_invocations` | -- | Gauge of in-flight invocations |

Worst-case cardinality is bounded at approximately 1,032 time series.

## Usage Patterns

### Span Tree Structure

Each invocation produces a root span `praxis.invocation` with child spans for I/O phases: `prehook`, `llmcall`, `toolcall`, `posttoolfilter`, `llmcontinuation`, `posthook`. Synchronous phases like `ToolDecision` do not get their own spans.

Nested invocations (agent-as-tool) create a new root span with a `SpanLink` to the parent -- not a parent-child hierarchy. This keeps trace boundaries clean and avoids unbounded trace depth.

### AttributeEnricher

Enricher attributes flow to spans and events only -- never to metric labels. This prevents cardinality explosion. The framework has zero awareness of what attributes the enricher adds; this is entirely caller-controlled.

## Full API Reference

For complete type and method documentation, see [`telemetry` on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/telemetry).

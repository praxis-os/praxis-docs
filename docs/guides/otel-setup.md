---
title: "OpenTelemetry Setup"
description: "How to configure OpenTelemetry tracing, Prometheus metrics, and structured logging with praxis."
sidebar_label: "OpenTelemetry Setup"
sidebar_position: 5
keywords: [praxis, opentelemetry, otel, tracing, prometheus, metrics, logging, slog, spans, telemetry, AttributeEnricher]
rag_section: "guides"
rag_packages: ["telemetry"]
rag_interfaces: ["telemetry.LifecycleEventEmitter", "telemetry.AttributeEnricher"]
rag_difficulty: "advanced"
---

# OpenTelemetry Setup

praxis produces OpenTelemetry traces, Prometheus metrics, and structured logs for every invocation. Tracing is mandatory -- every invocation creates a span tree. This guide covers the span structure, OTel SDK wiring, attribute enrichment, Prometheus metrics, and structured logging configuration.

## Span Tree

Every invocation creates a root span named `praxis.invocation` that contains child spans for each phase of the lifecycle. The span tree mirrors the state machine transitions.

```text title="Span tree for a single invocation with one tool call"
praxis.invocation (root)
  |-- praxis.prehook
  |-- praxis.llmcall
  |-- praxis.toolcall
  |-- praxis.posttoolfilter
  |-- praxis.llmcontinuation
  |-- praxis.posthook
```

Child spans are created only for asynchronous phases that involve I/O or significant computation. Synchronous phases like `ToolDecision` do not get their own spans because they execute inline without meaningful duration.

In the tool-use cycle, `praxis.toolcall`, `praxis.posttoolfilter`, and `praxis.llmcontinuation` repeat for each cycle iteration. Each repetition is a new child span under the same root.

**Nested orchestrators** (agent-as-tool pattern) create a new `praxis.invocation` root span with a `SpanLink` back to the outer span. This is deliberately not a parent-child relationship -- the inner invocation is a logically separate trace that can be correlated with the outer one through the link.

```text title="Span tree with nested agent-as-tool"
praxis.invocation (outer root)
  |-- praxis.prehook
  |-- praxis.llmcall
  |-- praxis.toolcall
  |       |
  |       +-- [SpanLink to inner root]
  |
  |-- praxis.posthook

praxis.invocation (inner root, linked to outer toolcall)
  |-- praxis.prehook
  |-- praxis.llmcall
  |-- praxis.posthook
```

## Setting Up the OTel SDK

Configure the standard OpenTelemetry SDK and pass a `TracerProvider` to the orchestrator via the `AttributeEnricher` interface. The framework obtains its tracer from the enricher's context.

```go title="main.go — OTel SDK setup"
package main

import (
    "context"

    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"

    "github.com/praxis-os/praxis/orchestrator"
)

func main() {
    ctx := context.Background()

    exporter, err := otlptracegrpc.New(ctx)
    if err != nil {
        log.Fatal(err)
    }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String("my-agent-service"),
        )),
    )
    defer tp.Shutdown(ctx)
    otel.SetTracerProvider(tp)

    orch := orchestrator.New(provider,
        orchestrator.WithAttributeEnricher(&RequestEnricher{}),
    )

    // Invocations now produce OTel traces automatically.
}
```

The orchestrator uses the globally registered `TracerProvider` (via `otel.GetTracerProvider()`) to create its tracer with the name `praxis`. All spans are created under this tracer.

## AttributeEnricher

The `telemetry.AttributeEnricher` interface lets you attach caller-specific attributes to every span in the invocation's span tree. The framework has no awareness of what attributes you add -- it calls `Enrich` at the start of the root span and propagates the returned attributes.

```go title="telemetry.AttributeEnricher interface"
type AttributeEnricher interface {
    Enrich(ctx context.Context, req InvocationRequest) []attribute.KeyValue
}
```

Implement an enricher to add request-scoped metadata:

```go title="telemetry/enricher.go"
type RequestEnricher struct{}

func (e *RequestEnricher) Enrich(ctx context.Context, req orchestrator.InvocationRequest) []attribute.KeyValue {
    attrs := []attribute.KeyValue{
        attribute.String("request.id", extractRequestID(ctx)),
        attribute.String("user.id", extractUserID(ctx)),
        attribute.String("tenant.id", extractTenantID(ctx)),
        attribute.String("model", req.Model),
    }
    return attrs
}
```

These attributes appear on the root `praxis.invocation` span and are inherited by child spans through the standard OTel context propagation. This makes it straightforward to filter traces by user, tenant, or request in your observability backend.

:::tip
Keep enricher attributes to essential correlation identifiers. Every attribute is added to every span in the tree, so high-cardinality attributes increase storage costs in your tracing backend.
:::

## Prometheus Metrics

praxis exposes ten Prometheus metrics with the `praxis_` prefix. These metrics cover invocation outcomes, LLM usage, tool execution, budget enforcement, and errors.

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `praxis_invocations_total` | Counter | `terminal_state` | Total invocations by terminal state |
| `praxis_invocation_duration_seconds` | Histogram | `terminal_state` | Invocation duration by terminal state |
| `praxis_llm_calls_total` | Counter | `provider`, `model` | Total LLM calls by provider and model |
| `praxis_llm_call_duration_seconds` | Histogram | `provider`, `model` | LLM call duration by provider and model |
| `praxis_llm_tokens_total` | Counter | `provider`, `model`, `direction` | Tokens consumed by provider, model, and direction (input/output) |
| `praxis_tool_invocations_total` | Counter | `tool`, `status` | Tool invocations by tool name and status |
| `praxis_tool_invocation_duration_seconds` | Histogram | `tool`, `status` | Tool invocation duration by tool name and status |
| `praxis_budget_breaches_total` | Counter | `dimension` | Budget breaches by dimension (duration, tokens, tool_calls, cost) |
| `praxis_errors_total` | Counter | `kind` | Errors by error kind |
| `praxis_active_invocations` | Gauge | -- | Currently running invocations |

The maximum cardinality across all metrics is approximately 1,032 time series, assuming reasonable label values (5 terminal states, 3 providers, 5 models, 2 directions, 20 tools, 3 statuses, 4 dimensions, 7 error kinds). This keeps Prometheus scraping efficient even at scale.

```go title="main.go — Prometheus endpoint"
import (
    "net/http"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
    // praxis registers metrics automatically when the orchestrator is created.
    // Expose the standard Prometheus endpoint.
    http.Handle("/metrics", promhttp.Handler())
    go http.ListenAndServe(":9090", nil)
}
```

:::note
praxis registers its metrics with the default Prometheus registerer. If you use a custom registry, pass it via `orchestrator.WithPrometheusRegisterer(registry)`.
:::

## Structured Logging

praxis uses Go's standard `slog` package for structured logging. The framework provides a `RedactingHandler` that wraps any `slog.Handler` and strips sensitive data from log output.

```go title="telemetry/redacting_handler.go"
handler := telemetry.NewRedactingHandler(slog.NewJSONHandler(os.Stdout, nil))
logger := slog.New(handler)
slog.SetDefault(logger)
```

The `RedactingHandler` automatically strips three categories of sensitive data:

| Category | What is redacted | Replacement |
|----------|-----------------|-------------|
| Credentials | API keys, bearer tokens, authorization headers | `[CREDENTIAL_REDACTED]` |
| Raw LLM responses | Full response bodies from LLM providers | `[LLM_RESPONSE_REDACTED]` |
| PII markers | Fields tagged with the `pii` log attribute key | `[PII_REDACTED]` |

```go title="Logging with PII markers"
logger.Info("processing request",
    "user_email", slog.String("pii", "user@example.com"),
    "request_id", requestID,
)
// Output: {"msg":"processing request","user_email":"[PII_REDACTED]","request_id":"abc123"}
```

The redacting handler ensures that even if your code logs sensitive data, it does not appear in log output. This is a defense-in-depth measure -- the handler catches sensitive data that slips past code review.

:::warning
The `RedactingHandler` uses pattern matching and field name heuristics. It is not a substitute for careful log hygiene in your application code. Avoid logging raw user input or tool output at debug level in production.
:::

For the full `telemetry` package API, see [pkg.go.dev/github.com/praxis-os/praxis/telemetry](https://pkg.go.dev/github.com/praxis-os/praxis/telemetry).

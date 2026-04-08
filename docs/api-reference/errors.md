---
title: "errors Package"
description: "The errors package defines a seven-kind error taxonomy with typed error interfaces and a classifier that drives retry policy decisions."
sidebar_label: "errors"
sidebar_position: 9
keywords: [praxis, errors, typed-error, error-kind, classifier, retry, transient, permanent, policy-denied, budget-exceeded]
rag_section: "api-reference"
rag_packages: ["errors"]
rag_interfaces: ["errors.TypedError", "errors.Classifier"]
rag_difficulty: "intermediate"
---

# errors Package

## Purpose

The `errors` package provides a structured error taxonomy for the praxis framework. Every error that flows through the orchestrator implements the `TypedError` interface, which exposes an `ErrorKind` that drives retry decisions, state transitions, and telemetry classification. The `Classifier` interface maps raw Go errors into typed errors, giving callers control over how unknown errors are categorized.

Rather than inspecting error strings or using type assertions scattered across calling code, consumers check the error kind and respond accordingly. The orchestrator uses error kinds to decide whether to retry, which terminal state to enter, and what telemetry to emit.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `TypedError` | Interface | Extends `error` with `Kind() ErrorKind` and `Retryable() bool`. |
| `ErrorKind` | Enum | Seven discrete error categories. |
| `Classifier` | Interface | Maps a raw `error` into a `TypedError`. |
| `TransientLLMError` | Struct | Retryable LLM provider failure (rate limit, temporary outage). |
| `PermanentLLMError` | Struct | Non-retryable LLM failure (invalid request, model not found). |
| `ToolError` | Struct | Infrastructure-level tool execution failure. |
| `PolicyDeniedError` | Struct | A policy hook returned `Deny`. |
| `BudgetExceededError` | Struct | A budget dimension was breached. |
| `CancellationError` | Struct | The context was cancelled or deadline exceeded. |
| `SystemError` | Struct | Internal framework error (should not occur in normal operation). |

## Usage Patterns

### The Seven Error Kinds

Each error kind maps to a specific retry policy and terminal state.

| Kind | Retryable | Terminal State | Typical Cause |
|---|---|---|---|
| `TransientLLM` | Yes | `LLMError` (after retries exhausted) | Rate limit, 503, network timeout |
| `PermanentLLM` | No | `LLMError` | Invalid request, unsupported model |
| `Tool` | No | `ToolError` | Tool infrastructure failure |
| `PolicyDenied` | No | `PolicyDenied` | Hook returned `Deny` |
| `BudgetExceeded` | No | `BudgetExceeded` | Any budget dimension breached |
| `Cancellation` | No | `Cancelled` | Context cancelled or deadline exceeded |
| `System` | No | `SystemError` | Internal framework bug |

### Implementing a Classifier

A `Classifier` receives a raw Go error and returns a `TypedError`. This is how the framework handles errors from LLM providers and tools that do not natively return typed errors.

```go title="Classifier interface"
type Classifier interface {
    Classify(err error) TypedError
}
```

The default classifier uses heuristics: HTTP 429 and 503 errors become `TransientLLMError`, HTTP 400 errors become `PermanentLLMError`, context errors become `CancellationError`, and everything else becomes `SystemError`.

```go title="Custom classifier"
type MyClassifier struct{}

func (c *MyClassifier) Classify(err error) errors.TypedError {
    if isRateLimit(err) {
        return errors.TransientLLMError{Cause: err}
    }
    return errors.PermanentLLMError{Cause: err}
}
```

### Checking Error Kinds

Callers inspect errors returned from `Invoke` by checking the kind.

```go title="Handling typed errors"
result, err := orch.Invoke(ctx, req)
if err != nil {
    var typed errors.TypedError
    if stderrors.As(err, &typed) {
        switch typed.Kind() {
        case errors.TransientLLM:
            // Upstream was temporarily unavailable
        case errors.BudgetExceeded:
            // Invocation ran out of budget
        case errors.PolicyDenied:
            // A policy hook blocked the invocation
        default:
            // Handle other kinds
        }
    }
}
```

### Retry Behavior

The orchestrator retries only `TransientLLM` errors. Retry count and backoff are configured via orchestrator options. All other error kinds cause an immediate transition to a terminal state. This keeps the retry surface small and predictable.

## Full API Reference

For complete type and method documentation, see [errors on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/errors).

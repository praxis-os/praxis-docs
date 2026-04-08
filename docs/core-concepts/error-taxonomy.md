---
title: Error Taxonomy
description: The praxis error taxonomy classifies every framework error into one of seven kinds, each with defined retry semantics and terminal state mappings.
sidebar_label: Error Taxonomy
sidebar_position: 6
keywords:
  - errors
  - error handling
  - retry
  - backoff
  - TypedError
  - ErrorKind
  - error classification
rag_section: core-concepts
rag_packages:
  - errors
rag_interfaces:
  - errors.TypedError
  - errors.Classifier
rag_difficulty: intermediate
---

# Error Taxonomy

Praxis defines a closed set of error kinds that determine retry behavior and terminal state transitions. Every error produced by the framework implements the `TypedError` interface, making it straightforward to handle errors programmatically.

## TypedError Interface

Every error returned by praxis implements the `TypedError` interface, which augments the standard Go `error` with structured metadata.

```go title="errors/typed_error.go"
type TypedError interface {
    error
    Kind() ErrorKind
    HTTPStatusCode() int
    Unwrap() error
}
```

`TypedError` is fully compatible with the Go standard library. You can use `errors.Is` and `errors.As` to inspect and unwrap praxis errors just like any other Go error.

```go title="example_typed_error_test.go"
var te errors.TypedError
if stderrors.As(err, &te) {
    log.Printf("error kind: %s, HTTP status: %d", te.Kind(), te.HTTPStatusCode())
}
```

:::note
The `HTTPStatusCode()` method returns a suggested HTTP status code for surfacing the error to callers over HTTP. It does not imply that the error originated from an HTTP call.
:::

For full method-level documentation, see the [errors package on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/errors).

## Error Kinds

Praxis defines seven `ErrorKind` values. Each kind maps to a specific retry policy and terminal state.

| Kind | Retryable | Terminal State | Description |
|------|-----------|----------------|-------------|
| `transient_llm` | Yes (3x jittered backoff) | Failed | Rate limits, HTTP 5xx, network timeouts |
| `permanent_llm` | No | Failed | HTTP 4xx, malformed requests, invalid model |
| `tool` | No | Failed | Tool invocation returned an error |
| `policy_denied` | No | Failed | A policy hook rejected the request |
| `budget_exceeded` | No | BudgetExceeded | A budget dimension limit was breached |
| `cancellation` | No | Cancelled | Context was cancelled or deadline exceeded |
| `system` | No | Failed | Internal framework bug or invariant violation |

:::warning
The `system` error kind indicates a bug in praxis itself, not in your code. If you encounter a `system` error, please report it as an issue.
:::

**Special case: `approval_required`**

The `approval_required` kind is not a failure. It is a checkpoint signal indicating that the agent requires human approval before proceeding. It maps to the **ApprovalRequired** terminal state, which allows the invocation to be resumed after approval is granted. See [Budget Enforcement](/docs/core-concepts/budget) for related terminal states.

## Retry Semantics

Only `transient_llm` errors are retried. All other error kinds are terminal and cause immediate state transition.

The retry policy for `transient_llm` errors uses the following parameters:

| Parameter | Value |
|-----------|-------|
| Maximum attempts | 3 |
| Backoff strategy | Exponential with jitter |
| Initial delay | 500ms |
| Maximum delay | 10s |

```go title="retry_behavior_example.go"
// The orchestrator handles retries automatically.
// You do not need to implement retry logic yourself.
// A transient_llm error on the first LLM call will be
// retried up to 2 more times before transitioning to Failed.
result, err := orch.Invoke(ctx, request)
```

After all retry attempts are exhausted, the error is promoted to terminal and the invocation transitions to the **Failed** state with the last `transient_llm` error attached.

:::tip
If you need custom retry behavior (for example, more attempts or different backoff), implement a wrapper around your `llm.Provider` that performs retries before returning the error to the orchestrator.
:::

## Error Classification

The `errors.Classifier` interface allows the framework to map raw errors from LLM providers and tools into `TypedError` values.

```go title="errors/classifier.go"
type Classifier interface {
    Classify(err error) TypedError
}
```

Praxis ships with a default classifier that handles common HTTP status codes and well-known provider error patterns automatically. The default classifier maps:

- HTTP 429, 500, 502, 503, 504 to `transient_llm`
- HTTP 400, 401, 403, 404, 422 to `permanent_llm`
- Context cancellation and deadline exceeded to `cancellation`

If your LLM provider or tool returns domain-specific errors that the default classifier cannot handle, you can supply a custom classifier:

```go title="example_custom_classifier_test.go"
type myClassifier struct{}

func (c *myClassifier) Classify(err error) errors.TypedError {
    if isThrottled(err) {
        return errors.New(errors.TransientLLM, "provider throttled", err)
    }
    return errors.New(errors.PermanentLLM, "unknown provider error", err)
}

orch := orchestrator.New(provider,
    orchestrator.WithErrorClassifier(&myClassifier{}),
)
```

:::note
Custom classifiers are invoked only when the default classifier returns `nil`. If the default classifier can already handle the error, your custom classifier is not called.
:::

## Using TypedError

The standard pattern for handling praxis errors is to use `errors.As` to extract the `TypedError`, then switch on `Kind()`.

```go title="example_error_handling_test.go"
result, err := orch.Invoke(ctx, request)
if err != nil {
    var te errors.TypedError
    if stderrors.As(err, &te) {
        switch te.Kind() {
        case errors.TransientLLM:
            // All retries exhausted — log and alert
            log.Printf("LLM temporarily unavailable: %v", te)
        case errors.BudgetExceeded:
            // Agent ran out of budget — check snapshot for details
            log.Printf("budget exceeded: %v", te)
        case errors.PolicyDenied:
            // Policy hook blocked the request
            log.Printf("policy denied: %v", te)
        case errors.Cancellation:
            // Caller cancelled — usually not an error
            log.Printf("invocation cancelled")
        default:
            log.Printf("invocation failed (%s): %v", te.Kind(), te)
        }
    }
}
```

:::danger
Do not match on error strings. Always use `errors.As` with `TypedError` and switch on `Kind()`. Error messages may change between releases; error kinds are part of the public API and follow semantic versioning.
:::

For the complete API reference, see the [errors package on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/errors).

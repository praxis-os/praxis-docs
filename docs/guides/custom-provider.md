---
title: "Building a Custom LLM Provider"
description: "How to implement the llm.Provider interface to integrate a custom or unsupported LLM provider with praxis."
sidebar_label: "Custom Provider"
sidebar_position: 1
keywords: [praxis, llm, provider, custom, adapter, streaming, error-classification, TypedError, ErrorKind]
rag_section: "guides"
rag_packages: ["llm"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "advanced"
---

# Building a Custom LLM Provider

praxis ships with an Anthropic adapter, but the `llm.Provider` interface is designed for straightforward implementation against any LLM backend. This guide walks through building a complete custom provider from scratch, covering the four required methods, error classification, streaming support, and testing.

## Implementing the Interface

The `llm.Provider` interface requires four methods. Every custom provider must implement all four to satisfy the contract.

```go title="llm.Provider interface"
type Provider interface {
    Complete(ctx context.Context, req LLMRequest) (LLMResponse, error)
    Stream(ctx context.Context, req LLMRequest) (<-chan LLMStreamChunk, error)
    Name() string
    Capabilities() ProviderCapabilities
}
```

Here is a skeleton implementation for a hypothetical provider called "acme":

```go title="acme/provider.go"
package acme

import (
    "context"
    "net/http"

    "github.com/praxis-os/praxis/llm"
)

type Provider struct {
    apiKey  string
    baseURL string
    client  *http.Client
}

func NewProvider(apiKey, baseURL string) *Provider {
    return &Provider{
        apiKey:  apiKey,
        baseURL: baseURL,
        client:  &http.Client{},
    }
}

func (p *Provider) Name() string {
    return "acme"
}

func (p *Provider) Capabilities() llm.ProviderCapabilities {
    return llm.ProviderCapabilities{
        SupportsParallelToolCalls: false,
    }
}

func (p *Provider) Complete(ctx context.Context, req llm.LLMRequest) (llm.LLMResponse, error) {
    // 1. Convert llm.LLMRequest to vendor wire format
    body, err := marshalRequest(req)
    if err != nil {
        return llm.LLMResponse{}, llm.NewPermanentError("invalid request", err)
    }

    // 2. Send HTTP request to vendor API
    resp, err := p.doRequest(ctx, body)
    if err != nil {
        return llm.LLMResponse{}, classifyHTTPError(err, resp)
    }

    // 3. Convert vendor response to llm.LLMResponse
    return unmarshalResponse(resp)
}
```

The `Name()` method returns a stable identifier used in telemetry spans and budget price lookups. The `Capabilities()` struct tells the orchestrator about provider-specific feature support -- when `SupportsParallelToolCalls` is `false`, the orchestrator processes tool calls sequentially even if the model returns multiple tool calls in one turn.

## Error Classification

Correct error classification is critical because the orchestrator uses it to decide whether to retry. Every error returned from `Complete` or `Stream` must be either a `TransientLLMError` or a `PermanentLLMError`.

**TransientLLMError** signals that the request can be retried. The orchestrator will retry up to three times with jittered exponential backoff. Use this for rate limits (HTTP 429), server errors (HTTP 5xx), and network timeouts.

**PermanentLLMError** signals that the request should not be retried. The orchestrator transitions immediately to the `Failed` terminal state. Use this for client errors (HTTP 4xx except 429), authentication failures, and malformed requests.

```go title="acme/errors.go"
package acme

import (
    "net/http"

    "github.com/praxis-os/praxis/llm"
)

func classifyHTTPError(err error, resp *http.Response) error {
    if resp == nil {
        // Network-level failure (DNS, connection refused, timeout)
        return llm.NewTransientError("network error", err)
    }

    switch {
    case resp.StatusCode == http.StatusTooManyRequests:
        return llm.NewTransientError("rate limited", err)
    case resp.StatusCode >= 500:
        return llm.NewTransientError("server error", err)
    case resp.StatusCode == http.StatusUnauthorized:
        return llm.NewPermanentError("invalid API key", err)
    case resp.StatusCode >= 400:
        return llm.NewPermanentError("client error", err)
    default:
        return llm.NewPermanentError("unexpected status", err)
    }
}
```

:::warning
Misclassifying a permanent error as transient wastes budget on doomed retries. Misclassifying a transient error as permanent causes unnecessary failures. When in doubt, map network-level failures to transient and all HTTP 4xx (except 429) to permanent.
:::

## Streaming Support

The `Stream` method returns a receive-only channel of `LLMStreamChunk` values. The orchestrator reads from this channel until it is closed.

```go title="acme/stream.go"
package acme

import (
    "context"
    "sync"

    "github.com/praxis-os/praxis/llm"
)

func (p *Provider) Stream(ctx context.Context, req llm.LLMRequest) (<-chan llm.LLMStreamChunk, error) {
    // Open SSE connection to vendor API
    conn, err := p.openSSEConnection(ctx, req)
    if err != nil {
        return nil, classifyHTTPError(err, nil)
    }

    ch := make(chan llm.LLMStreamChunk, 16)
    var once sync.Once

    go func() {
        defer once.Do(func() { close(ch) })
        for {
            select {
            case <-ctx.Done():
                ch <- llm.LLMStreamChunk{Error: ctx.Err()}
                return
            default:
                event, err := conn.ReadEvent()
                if err != nil {
                    ch <- llm.LLMStreamChunk{Error: classifyHTTPError(err, nil)}
                    return
                }
                if event.Done {
                    ch <- llm.LLMStreamChunk{
                        TokenUsage: event.TokenUsage,
                        EndOfStream: true,
                    }
                    return
                }
                ch <- llm.LLMStreamChunk{
                    Delta: event.Text,
                }
            }
        }
    }()

    return ch, nil
}
```

Key points for the streaming contract:

- The channel must be closed exactly once. Use a `sync.Once` guard to prevent double-close panics.
- Errors are delivered as the final chunk with the `Error` field set, not returned from `Stream` directly. The initial `Stream` call only returns an error if the connection cannot be established at all.
- The channel should be buffered (16 is the convention) to allow the producer to stay ahead of the consumer.
- If your provider does not support streaming, return an error immediately:

```go title="No streaming support"
func (p *Provider) Stream(ctx context.Context, req llm.LLMRequest) (<-chan llm.LLMStreamChunk, error) {
    return nil, llm.NewPermanentError("streaming not supported by acme provider", nil)
}
```

## Registration

Pass your provider to `orchestrator.New` as the first argument. The provider is the only required argument -- all other components have safe defaults.

```go title="main.go"
package main

import (
    "github.com/praxis-os/praxis/orchestrator"
    "example.com/acme"
)

func main() {
    provider := acme.NewProvider(
        os.Getenv("ACME_API_KEY"),
        "https://api.acme.ai/v1",
    )

    orch := orchestrator.New(provider)

    // The orchestrator is ready to use with zero-wiring defaults:
    // AllowAllPolicyHook, no filters, no budget enforcement.
}
```

You can also combine the custom provider with other praxis components:

```go title="main.go — with budget and policy"
orch := orchestrator.New(provider,
    orchestrator.WithBudgetGuard(guard),
    orchestrator.WithPolicyHook(policyHook),
    orchestrator.WithPreLLMFilters(piiFilter),
)
```

## Testing

Test your provider implementation by verifying that it correctly converts requests, classifies errors, and handles streaming edge cases.

```go title="acme/provider_test.go"
package acme_test

import (
    "context"
    "net/http"
    "net/http/httptest"
    "testing"

    "example.com/acme"
)

func TestComplete_Success(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"message": "hello", "usage": {"input": 10, "output": 5}}`))
    }))
    defer server.Close()

    provider := acme.NewProvider("test-key", server.URL)
    resp, err := provider.Complete(context.Background(), llm.LLMRequest{
        Model:    "acme-v1",
        Messages: []llm.Message{{Role: "user", Parts: []llm.MessagePart{{Type: "text", Text: "hello"}}}},
    })
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if resp.TokenUsage.Input != 10 {
        t.Errorf("expected 10 input tokens, got %d", resp.TokenUsage.Input)
    }
}

func TestComplete_RateLimitReturnsTransient(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusTooManyRequests)
    }))
    defer server.Close()

    provider := acme.NewProvider("test-key", server.URL)
    _, err := provider.Complete(context.Background(), llm.LLMRequest{})

    var transient *llm.TransientLLMError
    if !errors.As(err, &transient) {
        t.Fatalf("expected TransientLLMError, got %T: %v", err, err)
    }
}

func TestComplete_AuthFailureReturnsPermanent(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusUnauthorized)
    }))
    defer server.Close()

    provider := acme.NewProvider("bad-key", server.URL)
    _, err := provider.Complete(context.Background(), llm.LLMRequest{})

    var permanent *llm.PermanentLLMError
    if !errors.As(err, &permanent) {
        t.Fatalf("expected PermanentLLMError, got %T: %v", err, err)
    }
}
```

The test pattern follows a conformance suite approach: test each error classification boundary explicitly. For production providers, also test streaming close behavior (context cancellation mid-stream), empty responses, and malformed vendor payloads.

:::tip
Use `httptest.NewServer` to create mock HTTP backends. This lets you test the full request/response cycle without hitting a real API. Test both the happy path and every error classification boundary.
:::

For the full `llm.Provider` API surface, see [pkg.go.dev/github.com/praxis-os/praxis/llm](https://pkg.go.dev/github.com/praxis-os/praxis/llm).

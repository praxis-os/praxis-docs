---
title: "Provider Abstraction"
description: "The llm.Provider interface decouples praxis orchestration from any specific LLM vendor, enabling provider-agnostic agent orchestration with typed error classification and structured retries."
sidebar_label: "Provider Abstraction"
sidebar_position: 3
keywords: [praxis, llm, provider, anthropic, openai, abstraction, adapter, error-classification, streaming, LLMRequest, LLMResponse]
rag_section: "core-concepts"
rag_packages: ["llm", "llm/anthropic"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "intermediate"
---

# Provider Abstraction

praxis separates orchestration logic from LLM vendor specifics through the `llm.Provider` interface. The orchestrator never knows which model vendor it is talking to -- it sends an `LLMRequest` and receives an `LLMResponse` through a uniform contract.

## The Provider Interface

The `llm.Provider` interface defines four methods that every adapter must implement.

```go title="llm.Provider interface"
type Provider interface {
    // Complete sends a request and returns the full response.
    Complete(ctx context.Context, req LLMRequest) (LLMResponse, error)

    // Stream sends a request and returns a channel of incremental chunks.
    Stream(ctx context.Context, req LLMRequest) (<-chan LLMStreamChunk, error)

    // Name returns a human-readable identifier for this provider (e.g., "anthropic").
    Name() string

    // Capabilities reports what this provider supports.
    Capabilities() ProviderCapabilities
}
```

`ProviderCapabilities` is a struct that communicates provider-specific feature support to the orchestrator. The most important field is `SupportsParallelToolCalls`, which tells the orchestrator whether the model can request multiple tool calls in a single response turn. When `false`, the orchestrator processes tool calls sequentially even if the model returns multiple.

```go title="ProviderCapabilities"
type ProviderCapabilities struct {
    SupportsParallelToolCalls bool
}
```

The orchestrator uses `Complete` for standard invocations and `Stream` when the caller has requested streaming output. Both methods share the same request type and error contract.

## Request and Response Types

All communication between the orchestrator and the provider uses a set of shared types defined in the `llm` package.

### LLMRequest

```go title="LLMRequest structure"
type LLMRequest struct {
    Model    string         // Model identifier (e.g., "claude-sonnet-4-20250514")
    Messages []Message      // Conversation history
    Tools    []ToolDef      // Available tool definitions
    System   string         // System prompt
}
```

The orchestrator constructs the `LLMRequest` from the caller's `InvocationRequest`, injecting tool definitions from the registered tool set and applying any `PreLLMFilter` modifications before the request reaches the provider.

### LLMResponse

```go title="LLMResponse structure"
type LLMResponse struct {
    Message    Message    // The model's response message
    TokenUsage TokenUsage // Input and output token counts
    StopReason string     // Why the model stopped (e.g., "end_turn", "tool_use")
}
```

### Message and MessagePart

Messages use a parts-based model to represent mixed content (text, tool calls, tool results).

```go title="Message types"
type Message struct {
    Role  string        // "user", "assistant", or "tool"
    Parts []MessagePart // Ordered content parts
}

type MessagePart struct {
    Type       string          // "text", "tool_call", "tool_result"
    Text       string          // For text parts
    ToolCall   *ToolCallPart   // For tool call parts
    ToolResult *ToolResultPart // For tool result parts
}
```

This parts-based design supports multi-modal responses where the model interleaves text explanations with tool call requests in a single message.

:::note
The `llm` package defines the canonical message types. Provider adapters are responsible for converting vendor-specific wire formats to and from these types. The orchestrator never sees vendor-specific types.
:::

## Shipped Adapters

praxis ships with production-ready adapters for major LLM providers.

| Adapter | Package | Status | Notes |
|---------|---------|--------|-------|
| Anthropic Claude | `llm/anthropic` | Available | Supports Claude model family, parallel tool calls, streaming |
| OpenAI | `llm/openai` | Planned for v0.3.0 | GPT-4 and successors |

### Anthropic Adapter

The Anthropic adapter is the reference implementation of `llm.Provider`. It handles API key authentication, request serialization to the Anthropic Messages API format, response deserialization, and error mapping.

```go title="Creating an Anthropic provider"
import "github.com/praxis-os/praxis/llm/anthropic"

provider := anthropic.NewProvider(anthropic.Config{
    APIKey: os.Getenv("ANTHROPIC_API_KEY"),
})
```

The adapter reports `SupportsParallelToolCalls: true`, enabling the orchestrator to process multiple tool calls concurrently when the model requests them.

:::tip
For a complete working example using the Anthropic adapter, see the [Quick Start](/docs/getting-started/quick-start) guide.
:::

## Error Classification

Providers return typed errors that the orchestrator uses to make retry decisions. Every error from a provider is classified into one of two categories.

### TransientLLMError

Returned for rate limits (HTTP 429), server errors (HTTP 5xx), and network timeouts. The orchestrator retries transient errors up to **three times** with jittered exponential backoff.

```go title="Transient error handling"
// The orchestrator handles this automatically.
// Retry sequence: attempt 1 -> jittered backoff -> attempt 2 -> jittered backoff -> attempt 3
// If all three attempts fail, the error is promoted to permanent and the state machine
// transitions to Failed.
```

### PermanentLLMError

Returned for client errors (HTTP 4xx except 429), invalid request payloads, authentication failures, and model-not-found errors. Permanent errors are **never retried**. The state machine transitions immediately to `Failed`.

```go title="Error type checking"
import "github.com/praxis-os/praxis/llm"

result, err := orch.Invoke(ctx, request)
if err != nil {
    var permErr *llm.PermanentLLMError
    if errors.As(err, &permErr) {
        // Request was fundamentally invalid -- do not retry
        log.Error("permanent LLM error", "status", permErr.StatusCode, "msg", permErr.Message)
    }
}
```

:::warning
A `401 Unauthorized` from the LLM vendor is classified as `PermanentLLMError`. If you see this error, verify your API key configuration in the provider constructor rather than adding retry logic.
:::

The error taxonomy is defined in the `llm` package. Provider adapters map vendor-specific HTTP status codes and error responses to these two categories. Custom provider implementations must follow the same classification contract.

## Implementing Your Own Provider

The `llm.Provider` interface is designed for straightforward implementation. Your adapter needs to:

1. Accept vendor-specific configuration (API keys, base URLs, timeouts).
2. Convert `LLMRequest` to the vendor's wire format.
3. Convert the vendor's response to `LLMResponse`.
4. Map vendor errors to `TransientLLMError` or `PermanentLLMError`.
5. Implement `Stream` to return a channel of `LLMStreamChunk` values that the orchestrator consumes incrementally.

For a step-by-step walkthrough with code examples, see the [Building a Custom LLM Provider](/docs/guides/custom-provider) guide.

For the full API surface of the llm package, see [pkg.go.dev/github.com/praxis-os/praxis/llm](https://pkg.go.dev/github.com/praxis-os/praxis/llm).

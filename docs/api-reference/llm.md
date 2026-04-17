---
title: "llm Package"
description: "The llm package defines the provider-agnostic abstraction layer that lets praxis work with any LLM backend through a single typed interface."
sidebar_label: "llm"
sidebar_position: 3
keywords: [praxis, llm, provider, complete, stream, message, anthropic, openai, gemini, groq, ollama, openrouter, abstraction, model, capabilities]
rag_section: "api-reference"
rag_packages: ["llm", "llm/anthropic", "llm/openai", "llm/gemini", "llm/groq", "llm/ollama", "llm/openrouter"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "intermediate"
---

# llm Package

## Purpose

The `llm` package defines the abstraction boundary between praxis and any LLM backend. Rather than coding against a specific provider's SDK, callers and framework internals program against the `Provider` interface. This makes it possible to swap providers, add new ones, or build test doubles without changing orchestration logic.

The package ships six production implementations: `anthropic.Provider`, `openai.Provider`, `gemini.Provider` (native), plus three thin wrappers over `openai.Provider` for OpenRouter, Groq, and Ollama. Adding support for a new provider means implementing four methods on the `Provider` interface -- or wrapping `openai.Provider` if the target uses an OpenAI-compatible API.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Provider` | Interface | The core abstraction. Methods: `Complete`, `Stream`, `Name`, `Capabilities`. |
| `LLMRequest` | Struct | Input to `Complete` and `Stream`. Contains messages, model identifier, tool definitions, and generation parameters. |
| `LLMResponse` | Struct | Synchronous output from `Complete`. Contains the assistant message, token usage, and model metadata. |
| `LLMStreamChunk` | Struct | A single piece of a streaming response. May contain partial text, tool-call fragments, or usage deltas. |
| `Message` | Struct | A single conversation turn. Has `Role` and `Parts`. |
| `MessagePart` | Struct | A typed content fragment within a message. The `Type` field determines which payload field is populated. |
| `Role` | String type | One of `RoleUser`, `RoleAssistant`, or `RoleSystem`. |
| `PartType` | String type | Content type discriminator. `PartTypeText` is the most common. |

## Struct Field Reference

### LLMRequest

| Field | Type | Description |
|---|---|---|
| `ExtraParams` | `map[string]any` | Provider-specific passthrough parameters (e.g., `"top_p"`, `"reasoning_effort"`). Adapters forward keys they recognize. |
| `Model` | `string` | Model identifier (e.g., `"claude-sonnet-4-5"`). Empty string uses the provider default. |
| `SystemPrompt` | `string` | System prompt. Providers that use a dedicated system field map this accordingly. |
| `Messages` | `[]Message` | Conversation turns. |
| `Tools` | `[]ToolDefinition` | Tool definitions for function calling. |
| `MaxTokens` | `int` | Maximum tokens in the response. Zero uses the provider default. |
| `Temperature` | `float64` | Sampling temperature. Zero means "use provider default" (not "deterministic"). |

### LLMResponse

| Field | Type | Description |
|---|---|---|
| `StopReason` | `StopReason` | Why generation stopped: `end_turn`, `tool_use`, `max_tokens`, `stop_sequence`. |
| `Message` | `Message` | Assistant response message (may contain tool-call parts). |
| `Usage` | `TokenUsage` | Token counts for this call. |

### TokenUsage

| Field | Type | Description |
|---|---|---|
| `InputTokens` | `int64` | Input tokens consumed on this call. |
| `OutputTokens` | `int64` | Output tokens generated on this call. |
| `CachedInputTokens` | `int64` | Input tokens served from prompt cache. Zero if the provider does not support/report caching. |

### Message

| Field | Type | Description |
|---|---|---|
| `Role` | `Role` | One of `RoleUser`, `RoleAssistant`, `RoleSystem`, `RoleTool`. |
| `Parts` | `[]MessagePart` | Content fragments within the message. |

### MessagePart

Exactly one content field is populated, determined by `Type`.

| Field | Type | Populated when |
|---|---|---|
| `Type` | `PartType` | — (discriminator: `PartTypeText`, `PartTypeToolCall`, `PartTypeToolResult`, `PartTypeImageURL`) |
| `Text` | `string` | `Type == PartTypeText` |
| `ToolCall` | `*LLMToolCall` | `Type == PartTypeToolCall` |
| `ToolResult` | `*LLMToolResult` | `Type == PartTypeToolResult` |
| `ImageURL` | `string` | `Type == PartTypeImageURL` |

Convenience constructors: `llm.TextPart(text)`, `llm.ToolCallPart(call)`, `llm.ToolResultPart(result)`.

## Usage Patterns

### Building Messages

Messages are composed from typed parts. Each `MessagePart` has a `Type` that tells consumers which field to read.

```go title="Building a user message"
msg := llm.Message{
    Role: llm.RoleUser,
    Parts: []llm.MessagePart{
        {Type: llm.PartTypeText, Text: "What is the capital of France?"},
    },
}
```

System instructions use `RoleSystem` and are typically placed first in the message list.

### Implementing a Provider

A custom provider must satisfy four methods. `Complete` handles synchronous round-trips. `Stream` returns a channel for incremental delivery. `Name` returns a stable identifier for telemetry. `Capabilities` reports feature support so the orchestrator can adapt behavior.

```go title="Provider interface shape"
type Provider interface {
    Complete(ctx context.Context, req LLMRequest) (LLMResponse, error)
    Stream(ctx context.Context, req LLMRequest) (<-chan LLMStreamChunk, error)
    Name() string
    Capabilities() ProviderCapabilities
}
```

Errors returned from `Complete` or `Stream` are classified by the `errors.Classifier` to determine retry behavior. Providers should return descriptive errors; the framework wraps them into `TypedError` values automatically.

### Using the Shipped Anthropic Provider

The `llm/anthropic` sub-package provides a ready-to-use implementation. It handles authentication, request mapping, streaming SSE parsing, and token counting.

```go title="Creating the Anthropic provider"
provider := anthropic.NewProvider(
    anthropic.WithModel("claude-sonnet-4-20250514"),
)
```

The provider resolves API credentials through the `credentials.Resolver` passed to the orchestrator, not through its own constructor. This keeps secret material out of long-lived objects.

### Using the OpenAI Provider

The `llm/openai` sub-package provides a Chat Completions API adapter. It uses only the Go standard library for HTTP transport -- no third-party SDK.

```go title="Creating the OpenAI provider"
import "github.com/praxis-os/praxis/llm/openai"

provider := openai.New(os.Getenv("OPENAI_API_KEY"),
    openai.WithDefaultModel("gpt-4o"),
)
```

Available options:

| Option | Description |
|---|---|
| `WithDefaultModel(model)` | Default model when `LLMRequest.Model` is empty. Default: `"gpt-4o"`. |
| `WithBaseURL(url)` | Override the API base URL. Useful for Azure OpenAI or proxies. Default: `"https://api.openai.com"`. |
| `WithHTTPClient(c)` | Replace the default `http.Client` for API requests. |
| `WithName(name)` | Override provider name for telemetry and budget lookups. Default: `"openai"`. |
| `WithExtraHeaders(headers)` | Add custom HTTP headers to every API request. |
| `WithCapabilities(caps)` | Override default capabilities. Used by thin wrappers to set provider-specific limits. |

:::note
The OpenAI provider does not yet implement native streaming. `Stream()` delegates to `Complete()` and delivers the result as a single final chunk.
:::

### Using the Gemini Provider

The `llm/gemini` sub-package provides a native implementation for Google's Gemini API. It handles API key authentication via query parameter, request mapping to the `generateContent` endpoint, and synthetic tool call ID generation.

```go title="Creating the Gemini provider"
import "github.com/praxis-os/praxis/llm/gemini"

provider := gemini.New(os.Getenv("GEMINI_API_KEY"),
    gemini.WithDefaultModel("gemini-2.0-flash"),
)
```

Available options:

| Option | Description |
|---|---|
| `WithDefaultModel(model)` | Default model. Default: `"gemini-2.0-flash"`. |
| `WithBaseURL(url)` | Override API base URL. Default: `"https://generativelanguage.googleapis.com"`. |
| `WithHTTPClient(c)` | Replace the default `http.Client`. |

### Using the OpenRouter Provider

The `llm/openrouter` sub-package wraps `openai.Provider` for the OpenRouter multi-model gateway.

```go title="Creating the OpenRouter provider"
import "github.com/praxis-os/praxis/llm/openrouter"

provider := openrouter.New(os.Getenv("OPENROUTER_API_KEY"),
    openrouter.WithModel("anthropic/claude-sonnet-4-20250514"),
    openrouter.WithReferer("https://myapp.example.com"),
    openrouter.WithTitle("My App"),
)
```

### Using the Groq Provider

The `llm/groq` sub-package wraps `openai.Provider` for the Groq inference API.

```go title="Creating the Groq provider"
import "github.com/praxis-os/praxis/llm/groq"

provider := groq.New(os.Getenv("GROQ_API_KEY"),
    groq.WithModel("llama-3.3-70b-versatile"),
)
```

### Using the Ollama Provider

The `llm/ollama` sub-package wraps `openai.Provider` for local Ollama model serving. No API key needed.

```go title="Creating the Ollama provider"
import "github.com/praxis-os/praxis/llm/ollama"

provider := ollama.New(
    ollama.WithModel("llama3.2"),
    ollama.WithBaseURL("http://localhost:11434"),
)
```

### Test Doubles

Because `Provider` is an interface, test code can substitute a mock that returns canned responses without network calls. This is the recommended approach for unit testing orchestration logic.

## Full API Reference

For complete type and method documentation, see [llm on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/llm).

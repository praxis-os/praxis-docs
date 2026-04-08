---
title: "llm Package"
description: "The llm package defines the provider-agnostic abstraction layer that lets praxis work with any LLM backend through a single typed interface."
sidebar_label: "llm"
sidebar_position: 3
keywords: [praxis, llm, provider, complete, stream, message, anthropic, abstraction, model, capabilities]
rag_section: "api-reference"
rag_packages: ["llm"]
rag_interfaces: ["llm.Provider"]
rag_difficulty: "intermediate"
---

# llm Package

## Purpose

The `llm` package defines the abstraction boundary between praxis and any LLM backend. Rather than coding against a specific provider's SDK, callers and framework internals program against the `Provider` interface. This makes it possible to swap providers, add new ones, or build test doubles without changing orchestration logic.

The package ships one production implementation -- `anthropic.Provider` -- in the `llm/anthropic` sub-package. Adding support for a new provider means implementing four methods on the `Provider` interface.

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

### Test Doubles

Because `Provider` is an interface, test code can substitute a mock that returns canned responses without network calls. This is the recommended approach for unit testing orchestration logic.

## Full API Reference

For complete type and method documentation, see [llm on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/llm).

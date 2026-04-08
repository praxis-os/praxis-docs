---
title: "Streaming Invocations"
description: "How to use InvokeStream for real-time LLM response streaming with praxis, including channel protocol, backpressure, and error handling."
sidebar_label: "Streaming"
sidebar_position: 8
keywords: [streaming, InvokeStream, LLMStreamChunk, channel, backpressure, real-time, SSE, text-delta, tool-use]
rag_section: "guides"
rag_packages: ["orchestrator", "llm"]
rag_interfaces: ["orchestrator.Orchestrator", "llm.Provider"]
rag_difficulty: "advanced"
---

# Streaming Invocations

This guide covers real-time LLM response streaming using `InvokeStream`. Streaming delivers response tokens as they are generated rather than waiting for the complete response, enabling responsive user interfaces and lower time-to-first-token.

## Using InvokeStream

`InvokeStream` is the asynchronous counterpart to `Invoke`. It returns a channel that delivers `LLMStreamChunk` values in real time:

```go title="stream_basic.go"
ch, err := orch.InvokeStream(ctx, req)
if err != nil {
    log.Fatal(err)
}

for chunk := range ch {
    if chunk.Error != nil {
        log.Printf("stream error: %v", chunk.Error)
        break
    }
    if chunk.Type == llm.ChunkTypeTextDelta {
        fmt.Print(chunk.Text)
    }
}
fmt.Println() // newline after stream completes
```

The orchestrator drives the same state machine as `Invoke` -- all policy hooks, budget checks, and lifecycle events still execute. The only difference is that LLM response content is delivered incrementally.

## Channel Close Protocol

The stream channel is closed via a `sync.Once` guard, guaranteeing exactly one close regardless of cancellation or error conditions. The consumer must drain the channel to avoid goroutine leaks:

```go title="drain_channel.go"
// Always drain with range -- it handles close automatically
for chunk := range ch {
    // process chunk
}
// Channel is now closed, all resources released
```

:::warning

Do not read from the channel after it has been closed and drained. The `range` loop handles this correctly. Avoid manual `<-ch` reads in a select without a done signal.

:::

## Backpressure

The stream channel has a buffer of 16 elements. If the consumer is slower than the producer, the producer blocks after filling the buffer. This provides natural backpressure:

- **Fast consumer**: chunks flow through without delay
- **Slow consumer**: producer pauses, limiting memory growth
- **Cancelled context**: producer stops generating, channel closes

The buffer size is fixed at 16 and not configurable. For most use cases (SSE to browser, WebSocket relay), this provides sufficient buffering without excessive memory.

## LLMStreamChunk Types

Each chunk has a `Type` field indicating what it contains:

| Type | Description |
|------|-------------|
| `ChunkTypeTextDelta` | Incremental text content in `chunk.Text` |
| `ChunkTypeToolUseStart` | Beginning of a tool call (tool name, ID) |
| `ChunkTypeToolUseDelta` | Incremental tool call arguments |
| `ChunkTypeEnd` | End of stream marker |

```go title="chunk_handling.go"
for chunk := range ch {
    if chunk.Error != nil {
        handleError(chunk.Error)
        break
    }
    switch chunk.Type {
    case llm.ChunkTypeTextDelta:
        fmt.Print(chunk.Text)
    case llm.ChunkTypeToolUseStart:
        fmt.Printf("\n[tool call: %s]\n", chunk.ToolName)
    case llm.ChunkTypeToolUseDelta:
        // accumulate tool arguments
    case llm.ChunkTypeEnd:
        // stream complete
    }
}
```

## Error Handling in Streams

Errors are delivered as the final chunk before channel close. Always check `chunk.Error` before processing content:

```go title="stream_errors.go"
for chunk := range ch {
    if chunk.Error != nil {
        var te praxiserrors.TypedError
        if errors.As(chunk.Error, &te) {
            switch te.Kind() {
            case praxiserrors.TransientLLM:
                // Provider had a transient failure during streaming
            case praxiserrors.Cancellation:
                // Context was cancelled
            case praxiserrors.BudgetExceeded:
                // Budget limit hit mid-stream
            }
        }
        break
    }
    // process chunk normally
}
```

:::note

Transient LLM errors are retried automatically by the orchestrator before being surfaced as stream errors. If an error reaches the stream, all retry attempts have been exhausted.

:::

## Lifecycle Events During Streaming

Streaming invocations emit the same lifecycle events as synchronous invocations. On a happy-path single-turn invocation, 10 events are emitted regardless of whether `Invoke` or `InvokeStream` is used. This ensures observability is consistent across both modes.

For complete API documentation, see [`orchestrator` on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/orchestrator).

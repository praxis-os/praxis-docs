---
title: "Examples Overview"
description: "Index of runnable praxis examples demonstrating common usage patterns from minimal setup to advanced compositions."
sidebar_label: "Overview"
sidebar_position: 1
keywords: [examples, minimal, filters, policy, streaming, tools, runnable, code, demo, ANTHROPIC_API_KEY, mock]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/anthropic", "llm/mock", "hooks", "tools", "event"]
rag_interfaces: []
rag_difficulty: "beginner"
---

# Examples

Runnable examples demonstrating praxis usage patterns. All examples live in the [`examples/`](https://github.com/praxis-os/praxis/tree/main/examples) directory of the praxis repository.

## Available Examples

| Example | Description | Key Concepts |
|---------|-------------|-------------|
| [Minimal](/docs/examples/minimal) | Single invocation with Anthropic provider | Zero-wiring, `Invoke`, basic request/response |
| [Filters](/docs/examples/filters) | PreLLMFilter PII redaction with mock provider | `PreLLMFilter`, `FilterDecision`, regex redaction |
| [Policy](/docs/examples/policy) | PolicyHook with three decision types | `PolicyHook`, `Allow`, `Deny`, `RequireApproval` |
| [Streaming](/docs/examples/streaming) | InvokeStream event channel draining | `InvokeStream`, event channel, `IsTerminal` |
| [Tools](/docs/examples/tools) | Custom tools.Invoker with weather tool | `Invoker`, `ToolDefinition`, `ToolResult`, tool-use loop |

## Running Examples

Most examples use a mock provider and need no API key. The `minimal` and `tools` examples require an Anthropic API key:

```bash title="terminal"
# For examples that need an API key:
export ANTHROPIC_API_KEY=sk-ant-...

cd examples/<name>
go run main.go
```

## Contributing Examples

New examples are welcome. Each example should:

1. Live in its own directory under `examples/`
2. Include a `main.go` with the `SPDX-License-Identifier: Apache-2.0` header
3. Be self-contained and runnable with `go run`
4. Demonstrate a single concept clearly

See [Contributing](/docs/contributing) for the full contribution guide.

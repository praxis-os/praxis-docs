---
title: "Examples Overview"
description: "Index of runnable praxis examples demonstrating common usage patterns from minimal setup to advanced compositions."
sidebar_label: "Overview"
sidebar_position: 1
keywords: [examples, minimal, runnable, code, demo, ANTHROPIC_API_KEY]
rag_section: "examples"
rag_packages: ["orchestrator", "llm", "llm/anthropic"]
rag_interfaces: []
rag_difficulty: "beginner"
---

# Examples

Runnable examples demonstrating praxis usage patterns. All examples live in the [`examples/`](https://github.com/praxis-os/praxis/tree/main/examples) directory of the praxis repository.

## Available Examples

| Example | Description | Key Concepts |
|---------|-------------|-------------|
| [Minimal](/docs/examples/minimal) | Single invocation with Anthropic provider | Zero-wiring, `Invoke`, basic request/response |

## Running Examples

All examples require an Anthropic API key:

```bash title="terminal"
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

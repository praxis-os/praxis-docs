---
title: "Installation"
description: "How to install the praxis Go library, set up prerequisites, and configure LLM provider credentials."
sidebar_label: "Installation"
sidebar_position: 2
keywords: [install, go-get, prerequisites, go-1.23, anthropic-api-key, setup]
rag_section: "getting-started"
rag_packages: ["llm/anthropic"]
rag_interfaces: []
rag_difficulty: "beginner"
---

# Installation

praxis is a standard Go module. This page covers prerequisites, installation, and provider credential setup.

## Prerequisites

- **Go 1.23** or later
- An LLM provider API key (Anthropic is the shipped adapter)

## Install the module

Add praxis to your Go project:

```bash title="terminal"
go get github.com/praxis-os/praxis
```

This pulls the core library and all sub-packages (`orchestrator`, `llm`, `tools`, `hooks`, `budget`, `errors`, `state`, `event`, `telemetry`, `credentials`, `identity`).

## Configure your LLM provider

praxis ships with an Anthropic adapter. Set your API key as an environment variable:

```bash title="terminal"
export ANTHROPIC_API_KEY=sk-ant-...
```

:::tip

Never hardcode API keys in source code. Use environment variables, a secrets manager, or the `credentials.Resolver` interface for production deployments.

:::

## Verify the installation

Create a simple `main.go` to verify everything works:

```go title="verify.go"
package main

import (
	"fmt"

	"github.com/praxis-os/praxis/orchestrator"
	"github.com/praxis-os/praxis/llm/anthropic"
)

func main() {
	provider := anthropic.New("test")
	_, err := orchestrator.New(provider)
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println("praxis installed successfully")
}
```

```bash title="terminal"
go run verify.go
```

## What's included

The `go get` command installs the full praxis module. Key packages:

| Package | Purpose |
|---------|---------|
| `orchestrator` | Public facade for creating and running invocations |
| `llm` | Provider-agnostic LLM abstraction |
| `llm/anthropic` | Anthropic Claude adapter |
| `tools` | Tool execution interface |
| `hooks` | Policy hooks and filter chains |
| `budget` | Multi-dimensional budget enforcement |
| `errors` | Typed error taxonomy |
| `telemetry` | OpenTelemetry integration |
| `credentials` | Secure credential management |
| `identity` | Per-call identity signing |
| `state` | Invocation state machine types |
| `event` | Lifecycle event definitions |

## Next steps

- Follow the [Quick Start](/docs/getting-started/quick-start) to make your first LLM call
- Read about the [Zero-Wiring Principle](/docs/core-concepts/zero-wiring) to understand why praxis needs minimal configuration

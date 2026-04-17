---
title: "API Reference Overview"
description: "The praxis API reference covers all public packages, interfaces, and types that make up the v1.0 interface surface for enterprise LLM agent orchestration."
sidebar_label: "Overview"
sidebar_position: 1
keywords: [praxis, api, reference, interfaces, packages, orchestrator, llm, tools, hooks, budget, credentials, identity, errors, state, event, telemetry, mcp, skills, sub-modules]
rag_section: "api-reference"
rag_packages: ["orchestrator", "llm", "tools", "hooks", "budget", "credentials", "identity", "errors", "state", "event", "telemetry", "mcp", "skills"]
rag_interfaces: ["orchestrator.Orchestrator", "llm.Provider", "tools.Invoker", "hooks.PolicyHook", "budget.Guard", "credentials.Resolver", "identity.Signer", "errors.TypedError", "telemetry.LifecycleEventEmitter", "mcp.Invoker"]
rag_difficulty: "intermediate"
---

# API Reference Overview

This section documents the public Go packages that make up the praxis invocation kernel. Each page explains purpose, key interfaces, and usage patterns for a single package. For complete type signatures and method documentation, every page links to the canonical source on pkg.go.dev.

## V1.0 Interface Surface

The following table is the complete set of public interfaces that define the v1.0 contract. Callers program against these interfaces; the framework ships default implementations where noted.

| Package | Interface | Purpose |
|---|---|---|
| `orchestrator` | `Orchestrator` | Public facade. `Invoke`. Fresh state machine per call. Safe for concurrent use. |
| `llm` | `Provider` | Provider-agnostic adapter. `Complete`, `Stream`, `Name`, `Capabilities`. Shipped: `anthropic.Provider`, `openai.Provider`. |
| `tools` | `Invoker` | Generic tool execution seam. Default: `NullInvoker`. |
| `hooks` | `PolicyHook` | Policy evaluation at invocation lifecycle phases. Default: `AllowAllPolicyHook`. |
| `hooks` | `PreLLMFilter`, `PostToolFilter` | Input/output filter chains. Decisions: `Pass`, `Redact`, `Log`, `Block`. |
| `budget` | `Guard` | Four-dimensional enforcement: wall-clock, tokens, tool-call count, cost. |
| `budget` | `PriceProvider` | Maps (provider, model, direction) to per-token micro-dollars. |
| `errors` | `TypedError`, `Classifier` | Seven error types + classifier driving retry policy. |
| `telemetry` | `LifecycleEventEmitter` | Emits events at each state transition. |
| `telemetry` | `AttributeEnricher` | Caller-specific span/event attributes. |
| `credentials` | `Resolver` | Per-call credential fetch with zeroing. |
| `identity` | `Signer` | Per-tool-call Ed25519 JWT identity assertion. |

## Type Index

The following table lists all major value types across packages, with links to their detailed field documentation.

| Type | Package | Kind | Documented In |
|---|---|---|---|
| `InvocationRequest` | `praxis` (root) | Struct | [orchestrator](./orchestrator.md) |
| `InvocationResult` | `praxis` (root) | Struct | [orchestrator](./orchestrator.md) |
| `LLMRequest` | `llm` | Struct | [llm](./llm.md) |
| `LLMResponse` | `llm` | Struct | [llm](./llm.md) |
| `TokenUsage` | `llm` | Struct | [llm](./llm.md) |
| `Message` | `llm` | Struct | [llm](./llm.md) |
| `MessagePart` | `llm` | Struct | [llm](./llm.md) |
| `ToolCall` | `tools` | Struct | [tools](./tools.md) |
| `ToolResult` | `tools` | Struct | [tools](./tools.md) |
| `ToolStatus` | `tools` | Enum | [tools](./tools.md) |
| `InvocationContext` | `tools` | Struct | [tools](./tools.md) |
| `PolicyHook` | `hooks` | Interface | [hooks](./hooks.md) |
| `PreLLMFilter` | `hooks` | Interface | [hooks](./hooks.md) |
| `PreToolFilter` | `hooks` | Interface | [hooks](./hooks.md) |
| `PostToolFilter` | `hooks` | Interface | [hooks](./hooks.md) |
| `PolicyInput` | `hooks` | Struct | [hooks](./hooks.md) |
| `Decision` | `hooks` | Struct | [hooks](./hooks.md) |
| `Phase` | `hooks` | Enum (4 values) | [hooks](./hooks.md) |
| `Verdict` | `hooks` | Enum (5 values) | [hooks](./hooks.md) |
| `FilterDecision` | `hooks` | Struct | [hooks](./hooks.md) |
| `FilterAction` | `hooks` | Enum (4 values) | [hooks](./hooks.md) |
| `BudgetSnapshot` | `budget` | Struct | [budget](./budget.md) |
| `Config` | `budget` | Struct | [budget](./budget.md) |
| `BudgetDimension` | `budget` | Enum | [budget](./budget.md) |
| `InvocationEvent` | `event` | Struct | [event](./event.md) |
| `EventType` | `event` | Enum (21 values) | [event](./event.md) |

## Package Map

Most public packages live under the root `github.com/praxis-os/praxis` Go module. Two packages — `mcp` and `skills` — are **independently versioned Go sub-modules** with their own `go.mod`. You add them separately (`go get github.com/praxis-os/praxis/mcp@v0.7.x`, `go get github.com/praxis-os/praxis/skills@v0.9.x`) so they can evolve without forcing a root minor bump.

| Package | Import Path | Module | Role |
|---|---|---|---|
| `orchestrator` | `github.com/praxis-os/praxis/orchestrator` | `praxis` (root) | Entry point and lifecycle driver |
| `llm` | `github.com/praxis-os/praxis/llm` | `praxis` (root) | LLM provider abstraction |
| `llm/anthropic` | `github.com/praxis-os/praxis/llm/anthropic` | `praxis` (root) | Anthropic provider adapter |
| `llm/openai` | `github.com/praxis-os/praxis/llm/openai` | `praxis` (root) | OpenAI provider adapter |
| `tools` | `github.com/praxis-os/praxis/tools` | `praxis` (root) | Tool invocation abstraction |
| `hooks` | `github.com/praxis-os/praxis/hooks` | `praxis` (root) | Policy and filter hooks |
| `budget` | `github.com/praxis-os/praxis/budget` | `praxis` (root) | Resource enforcement |
| `credentials` | `github.com/praxis-os/praxis/credentials` | `praxis` (root) | Secret material lifecycle |
| `identity` | `github.com/praxis-os/praxis/identity` | `praxis` (root) | Cryptographic identity assertion |
| `errors` | `github.com/praxis-os/praxis/errors` | `praxis` (root) | Typed error taxonomy |
| `state` | `github.com/praxis-os/praxis/state` | `praxis` (root) | State machine constants and transitions |
| `event` | `github.com/praxis-os/praxis/event` | `praxis` (root) | Lifecycle event types |
| `telemetry` | `github.com/praxis-os/praxis/telemetry` | `praxis` (root) | Observability primitives |
| `mcp` | `github.com/praxis-os/praxis/mcp` | `praxis/mcp` (v0.7.x, independent) | Model Context Protocol client behind the `tools.Invoker` seam |
| `skills` | `github.com/praxis-os/praxis/skills` | `praxis/skills` (v0.9.x, independent) | `SKILL.md` bundle loader and system-prompt composer |

## Stability Tiers

praxis uses a three-tier stability model to communicate what callers can rely on.

**Frozen (v1.0)** -- These interfaces will not change in any v1.x release. All interfaces listed in the v1.0 surface table above are frozen. Adding methods to a frozen interface requires a new major version. Callers can depend on these for production use without risk of breakage during minor or patch upgrades.

**Stable (v0.x candidate)** -- These packages have settled APIs that are expected to be promoted to frozen in a future minor release. Breaking changes are possible but will be communicated in release notes with a migration path. The `mcp` and `skills` sub-modules are in this tier on their own SemVer tracks (`praxis/mcp/v0.7.x`, `praxis/skills/v0.9.x`); sub-packages like `telemetry/slog` and `telemetry/metrics` also fall into this tier.

**Post-v1** -- Packages or interfaces introduced after the v1.0 release. These follow standard semantic versioning: they may change in minor releases until explicitly promoted to frozen. New packages will be clearly marked in their documentation.

## How to Use This Reference

Each package page in this section follows a consistent structure:

- **Purpose** -- What the package does and why it exists.
- **Key Interfaces and Types** -- A table of the main contracts and value types.
- **Usage Patterns** -- Narrative explanation of how to wire and use the package, with code examples.
- **Full API Reference** -- A link to the canonical pkg.go.dev documentation for complete type signatures.

These pages are narrative companions to godoc, not replacements for it. They explain the *why* and *how*; pkg.go.dev covers the *what*.

For the complete module documentation, see [praxis on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis).

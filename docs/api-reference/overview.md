---
title: "API Reference Overview"
description: "The praxis API reference covers all public packages, interfaces, and types that make up the v1.0 interface surface for enterprise LLM agent orchestration."
sidebar_label: "Overview"
sidebar_position: 1
keywords: [praxis, api, reference, interfaces, packages, orchestrator, llm, tools, hooks, budget, credentials, identity, errors, state, event, telemetry]
rag_section: "api-reference"
rag_packages: ["orchestrator", "llm", "tools", "hooks", "budget", "credentials", "identity", "errors", "state", "event", "telemetry"]
rag_interfaces: ["orchestrator.Orchestrator", "llm.Provider", "tools.Invoker", "hooks.PolicyHook", "budget.Guard", "credentials.Resolver", "identity.Signer", "errors.TypedError", "telemetry.LifecycleEventEmitter"]
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

## Package Map

Every public package lives under the `github.com/praxis-os/praxis` module path. The table below shows each package, its import path, and its role in the framework.

| Package | Import Path | Role |
|---|---|---|
| `orchestrator` | `github.com/praxis-os/praxis/orchestrator` | Entry point and lifecycle driver |
| `llm` | `github.com/praxis-os/praxis/llm` | LLM provider abstraction |
| `llm/openai` | `github.com/praxis-os/praxis/llm/openai` | OpenAI provider adapter |
| `tools` | `github.com/praxis-os/praxis/tools` | Tool invocation abstraction |
| `hooks` | `github.com/praxis-os/praxis/hooks` | Policy and filter hooks |
| `budget` | `github.com/praxis-os/praxis/budget` | Resource enforcement |
| `credentials` | `github.com/praxis-os/praxis/credentials` | Secret material lifecycle |
| `identity` | `github.com/praxis-os/praxis/identity` | Cryptographic identity assertion |
| `errors` | `github.com/praxis-os/praxis/errors` | Typed error taxonomy |
| `state` | `github.com/praxis-os/praxis/state` | State machine constants and transitions |
| `event` | `github.com/praxis-os/praxis/event` | Lifecycle event types |
| `telemetry` | `github.com/praxis-os/praxis/telemetry` | Observability primitives |

## Stability Tiers

praxis uses a three-tier stability model to communicate what callers can rely on.

**Frozen (v1.0)** -- These interfaces will not change in any v1.x release. All interfaces listed in the v1.0 surface table above are frozen. Adding methods to a frozen interface requires a new major version. Callers can depend on these for production use without risk of breakage during minor or patch upgrades.

**Stable (v0.x candidate)** -- These packages have settled APIs that are expected to be promoted to frozen in a future minor release. Breaking changes are possible but will be communicated in release notes with a migration path. Sub-packages like `telemetry/slog` and `telemetry/metrics` fall into this tier.

**Post-v1** -- Packages or interfaces introduced after the v1.0 release. These follow standard semantic versioning: they may change in minor releases until explicitly promoted to frozen. New packages will be clearly marked in their documentation.

## How to Use This Reference

Each package page in this section follows a consistent structure:

- **Purpose** -- What the package does and why it exists.
- **Key Interfaces and Types** -- A table of the main contracts and value types.
- **Usage Patterns** -- Narrative explanation of how to wire and use the package, with code examples.
- **Full API Reference** -- A link to the canonical pkg.go.dev documentation for complete type signatures.

These pages are narrative companions to godoc, not replacements for it. They explain the *why* and *how*; pkg.go.dev covers the *what*.

For the complete module documentation, see [praxis on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis).

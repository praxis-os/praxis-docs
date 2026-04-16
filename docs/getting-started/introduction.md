---
title: "Introduction"
description: "What praxis is, who it is for, and when to use it. praxis is a production-grade Go library for orchestrating LLM agents with enterprise guardrails built in."
sidebar_label: "Introduction"
sidebar_position: 1
keywords: [praxis, go, llm, agent, orchestration, enterprise, invocation-kernel, introduction]
rag_section: "getting-started"
rag_packages: []
rag_interfaces: []
rag_difficulty: "beginner"
---

# Introduction

praxis is a production-grade Go library for orchestrating LLM agents with enterprise guardrails built in rather than bolted on. It provides a typed invocation state machine, a provider-agnostic LLM interface, policy hooks at every security-sensitive boundary, four-dimensional budget enforcement, a typed error taxonomy, mandatory OpenTelemetry observability, and optional per-call identity signing.

## What praxis is

praxis is the **invocation kernel**: the component that owns a single agent call from request to terminal state, with every security, cost, and observability contract enforced by construction. It is deliberately narrower than a general agent framework and deliberately wider than a direct SDK wrapper.

It is the library a team reaches for when "call an LLM in a loop" is not enough, and when ad-hoc glue around a raw provider SDK would compromise auditability, cost control, or security.

**What it gives you out of the box:**

- A typed, eleven-state invocation finite state machine with allow-listed transitions and property-based tests
- A provider-agnostic `llm.Provider` interface with six shipped adapters (Anthropic, OpenAI, Gemini, OpenRouter, Groq, Ollama)
- A four-phase policy hook model (`PreInvocation`, `PreLLMInput`, `PostToolOutput`, `PostInvocation`) plus pre-LLM and post-tool filter chains that can `Pass`, `Redact`, `Log`, or `Block`
- Four-dimensional budget enforcement: wall-clock duration, LLM tokens, tool call count, cost estimate in micro-dollars
- A typed error taxonomy driving a differentiated retry policy
- Mandatory OpenTelemetry spans and a neutral lifecycle event stream
- Optional per-tool-call identity assertion via `identity.Signer` (Ed25519 JWT reference impl)
- A Model Context Protocol client (`praxis/mcp` sub-module) that fronts stdio and Streamable HTTP MCP servers behind the standard `tools.Invoker` seam, with credential injection, response-size caps, and bounded-cardinality metrics
- Skill packs (`praxis/skills` sub-module) for loading `SKILL.md` capability bundles from `fs.FS` and composing them into the system prompt

## What praxis is NOT

praxis has a deliberately narrow scope. It does **not** provide:

- **HTTP or SSE handler** -- the caller owns the transport
- **Plugin system** -- no WebAssembly host, no reflection magic. Extension is by Go interface implementation at build time
- **Hardcoded LLM pricing** -- pricing is a caller-provided interface
- **Prompt template engine** -- prompt construction is the caller's responsibility
- **Multi-agent coordination** -- praxis manages a single invocation; multi-agent composition is achieved by wrapping an orchestrator as a tool (agent-as-tool pattern)
- **Vector store or RAG pipeline** -- praxis is an invocation kernel, not a retrieval system
- **Knowledge of any specific consumer's identity model** -- tenant IDs, organization IDs, and agent IDs are all caller-provided via interfaces

## When to use praxis

**Use praxis if your team needs:**

- An auditable invocation kernel with policy hooks as framework-level guarantees
- Cost enforcement across multiple dimensions (not just token counting)
- Structured telemetry that cannot be accidentally disabled
- A provider-agnostic abstraction that decouples orchestration from specific LLM vendors

**Use a direct SDK wrapper instead if you:**

- Want to call an LLM API directly without governance overhead
- Are prototyping and do not need policy enforcement or budget controls
- Need a minimal dependency for simple request/response interactions

For direct SDK access, reach for [`anthropic-sdk-go`](https://github.com/anthropics/anthropic-sdk-go) or [`go-openai`](https://github.com/sashabaranov/go-openai) instead.

## Versioning and stability

praxis follows semantic versioning. The current version is **v0.x** (unstable).

:::warning

All public APIs in v0.x are unstable and may change without notice on any minor release. Consumers pinning to v0.x accept breakage risk as the price of early access.

:::

**Stability tiers:**

| Tier | Meaning |
|------|---------|
| `frozen-v1.0` | Interface will not change after v1.0 release |
| `stable-v0.x-candidate` | Interface shape is likely final but not yet committed |
| `post-v1` | Feature planned for after v1.0 |

Once v1.0 is released, the interface surface is frozen. Adding a method to an existing interface is a breaking change and requires a new interface embedding the old one. Breaking changes after v1.0 require a `v2` module path.

## Next steps

- [Install praxis](/docs/getting-started/installation) and set up your environment
- Follow the [Quick Start](/docs/getting-started/quick-start) to run your first invocation
- Read the [Architecture Overview](/docs/core-concepts/architecture) to understand the component model

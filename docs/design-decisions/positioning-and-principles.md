---
title: "Positioning & Principles"
description: "Key design decisions on praxis positioning as an invocation kernel, its 8 design principles, target consumers, explicit non-goals, and the zero-wiring promise."
sidebar_label: "Positioning & Principles"
sidebar_position: 2
keywords: [positioning, invocation-kernel, design-principles, non-goals, zero-wiring, D01, D02, D03, D05, D12, anti-persona]
rag_section: "design-decisions"
rag_packages: ["orchestrator"]
rag_interfaces: []
rag_difficulty: "intermediate"
---

# Positioning & Principles

These decisions define what praxis is, who it is for, and the principles that guide every API design choice.

## D01: Positioning Statement

praxis positions itself as an **invocation kernel** -- the component that owns a single agent call from request to terminal state. It is deliberately narrower than a general agent framework (no multi-agent coordination, no prompt templates, no vector stores) and deliberately wider than a direct SDK wrapper (typed state machine, policy hooks, budget enforcement, observability).

This positioning prevents scope creep in both directions: praxis will never grow into a framework, and it will never shrink into a thin HTTP client.

## D02: Eight Design Principles

Every API decision is evaluated against these principles:

1. **Typed safety** -- the state machine enforces valid transitions at compile time and runtime
2. **Provider agnosticism** -- orchestration logic is independent of any specific LLM vendor
3. **Policy at every boundary** -- hooks and filters exist at every point where untrusted data enters or security-sensitive actions occur
4. **Four-dimensional budget** -- cost control is a first-class concern, not an afterthought
5. **Observable by default** -- silent paths are a bug; every state transition emits telemetry
6. **Zero-wiring start** -- the orchestrator is constructible with just an `llm.Provider`
7. **No plugins, no reflection** -- extension is by Go interface implementation at build time
8. **Caller-owned transport** -- praxis never binds to HTTP, gRPC, or any specific transport

## D03: Target Consumer and Anti-Personas

The target consumer is a Go backend team that needs auditable, cost-controlled LLM agent orchestration as a library dependency.

The **anti-persona test**: if a team would be happy calling an LLM SDK directly and adding governance as an afterthought, praxis is the wrong tool. praxis adds value only when governance, observability, and cost control are requirements rather than nice-to-haves.

## D05: Explicit Non-Goals

Seven capabilities that praxis will never provide:

1. HTTP/SSE/WebSocket transport handling
2. Plugin system or runtime loading
3. Prompt template engine
4. Multi-agent coordination protocols
5. Vector store or RAG pipeline
6. Hardcoded commercial LLM pricing
7. Consumer-specific identity or event models

These non-goals are load-bearing -- they prevent the framework from growing beyond its invocation kernel scope.

## D12: Zero-Wiring Promise

The orchestrator must be constructible with `orchestrator.New(provider)` and no other arguments. Every optional component ships with a safe null default. This is not a convenience feature -- it is a design invariant that ensures:

- Examples and tests can create orchestrators without ceremony
- The framework never forces unnecessary complexity on the caller
- Progressive wiring (adding budget, then hooks, then tools) is the natural adoption path

See [Zero-Wiring Principle](/docs/core-concepts/zero-wiring) for the full null defaults table.

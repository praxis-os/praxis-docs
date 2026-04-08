---
title: "Interface Contracts"
description: "Key design decisions on the praxis API surface: v1.0 freeze commitment, stability tiers, functional options constructor, Provider method surface, and package layout."
sidebar_label: "Interface Contracts"
sidebar_position: 4
keywords: [interface, freeze, stability-tiers, functional-options, constructor, package-layout, D04, D13, D37, D41, D51]
rag_section: "design-decisions"
rag_packages: ["orchestrator", "llm"]
rag_interfaces: ["orchestrator.Orchestrator", "llm.Provider"]
rag_difficulty: "intermediate"
---

# Interface Contracts

These decisions define the public API surface, stability commitments, and package architecture.

## D04: v1.0 Freeze Surface

Fourteen public interfaces are committed to freezing at v1.0. After the freeze, adding a method to any of these interfaces is a breaking change that requires a new interface embedding the old one (e.g., `ProviderV2` embedding `Provider`).

This commitment enables consumers to implement praxis interfaces without fear of breakage. The freeze is load-bearing for the ecosystem -- custom providers, hooks, and tools built against v1.0 interfaces will continue to compile indefinitely.

## D13: Three-Tier Stability Policy

Every public interface is tagged with a stability tier:

| Tier | Meaning | Change Policy |
|------|---------|---------------|
| `frozen-v1.0` | Will not change after v1.0 | New methods require versioned interface |
| `stable-v0.x-candidate` | Shape is likely final | May change in v0.x, frozen at v1.0 |
| `post-v1` | Planned for after v1.0 | Not yet designed |

This gives consumers clear expectations about which interfaces are safe to implement today versus which may still evolve.

## D37: Functional Options Constructor

The orchestrator uses the functional options pattern: `orchestrator.New(provider, ...Option)`. This was chosen over config structs because:

- The only required argument (`llm.Provider`) is positionally enforced
- Optional components are added incrementally with type-safe option functions
- New options can be added without breaking existing call sites
- Zero-wiring is the natural default (no options = all null defaults)

## D41: Provider Method Surface

`llm.Provider` exposes exactly four methods: `Complete`, `Stream`, `Name`, and `Capabilities`. This minimal surface was deliberately chosen to keep the implementation burden low for custom providers. `Capabilities` returns a struct indicating feature support (e.g., `SupportsParallelToolCalls`), allowing the orchestrator to adapt behavior without provider-specific branching.

## D51: Package Layout with Cycle Breaker

The package architecture uses a root `praxis` package as a cycle breaker -- it holds cross-cutting types (`InvocationRequest`, `InvocationResult`) that would otherwise create import cycles between `orchestrator`, `llm`, and `tools`.

The public facade lives in `orchestrator/` (not the root package) to keep the root package small and focused on shared types. Internal packages (`internal/loop`, `internal/retry`, `internal/ctxutil`) are not part of the public API.

See [Architecture Overview](/docs/core-concepts/architecture) for the full package map.

---
title: "Design Decisions Overview"
description: "An overview of praxis design decisions: 103 architectural decisions across 6 phases, covering positioning, runtime, interfaces, observability, security, and governance."
sidebar_label: "Overview"
sidebar_position: 1
keywords: [design-decisions, architecture, ADR, decisions-log, phase, D01, D105, amendment]
rag_section: "design-decisions"
rag_packages: []
rag_interfaces: []
rag_difficulty: "intermediate"
---

# Design Decisions

praxis was designed through a structured six-phase process that produced 103 adopted architectural decisions (D01--D105). This section highlights the most significant decisions grouped by theme.

## The Decision Process

Each design phase focused on a specific area and produced a decisions log with formal entries. Every decision includes an ID, status (Adopted, Amended, or Rejected), rationale, and references to related decisions.

| Phase | Focus | Decisions |
|-------|-------|-----------|
| Phase 1: API Scope | Positioning, non-goals, interface surface | D01--D14 |
| Phase 2: Core Runtime | State machine, context, concurrency | D15--D28 |
| Phase 3: Interface Contracts | Package layout, constructors, method signatures | D29--D51 |
| Phase 4: Observability & Errors | Telemetry, metrics, error taxonomy | D52--D66 |
| Phase 5: Security & Trust | Credentials, identity, trust boundaries | D67--D80 |
| Phase 6: Release Governance | Versioning, CI, deprecation, release gates | D81--D105 |

## Amendment Protocol

Decisions can be amended by new decisions that reference the original via a `Supersedes:` field. Two classes of decisions are exempt from amendment: frozen interface contracts (changing them requires a new major version) and decoupling invariants (the framework must never contain consumer-specific identifiers).

## What's Documented Here

This section presents approximately 20 of the most significant decisions, selected for their impact on how developers use and extend praxis. They are grouped into six themes:

- [Positioning & Principles](/docs/design-decisions/positioning-and-principles) -- what praxis is and what it deliberately is not
- [State Machine Design](/docs/design-decisions/state-machine-design) -- the invocation FSM and its invariants
- [Interface Contracts](/docs/design-decisions/interface-contracts) -- package layout and API surface
- [Observability Model](/docs/design-decisions/observability-model) -- spans, metrics, and error mapping
- [Security & Trust](/docs/design-decisions/security-and-trust) -- credentials, identity, and trust boundaries
- [Release Governance](/docs/design-decisions/release-governance) -- versioning, CI gates, and deprecation

For the complete decisions logs, see the [`docs/`](https://github.com/praxis-os/praxis/tree/main/docs) directory in the praxis repository.

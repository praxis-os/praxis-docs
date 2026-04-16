---
title: "Security & Trust"
description: "Key design decisions on praxis security: credential zeroing, Ed25519 reference implementation, untrusted tool output model, filter trust boundaries, and security invariants."
sidebar_label: "Security & Trust"
sidebar_position: 6
keywords: [security, credentials, zeroing, Ed25519, trust-boundary, PostToolFilter, untrusted, invariants, mcp, D67, D73, D77, D78, D80, D116]
rag_section: "design-decisions"
rag_packages: ["credentials", "identity", "hooks", "mcp"]
rag_interfaces: ["credentials.Resolver", "identity.Signer", "hooks.PostToolFilter", "mcp.Invoker"]
rag_difficulty: "advanced"
---

# Security & Trust

These decisions define the security architecture, trust boundaries, and credential handling model.

## D67: Credential Zeroing

Credentials fetched via `credentials.Resolver` are zeroed immediately after use. The `Credential` type has a `Close()` method that overwrites secret material in memory using `runtime.KeepAlive` to prevent the garbage collector from collecting the buffer before zeroing completes.

Credentials are never cached, logged, serialized into errors, or stored in telemetry spans. This is enforced by the API design -- the `Credential` type provides no serialization methods, and the `Close()` contract is documented as mandatory.

## D73: Ed25519 Reference Implementation

The `identity` package ships an `Ed25519Signer` as a reference implementation. Ed25519 was chosen over RSA or ECDSA because it offers small key/signature sizes, fast signing, and deterministic signatures (no random nonce needed).

:::warning

The reference `Ed25519Signer` holds the private key in memory and does not zero it during garbage collection. For production environments with strict key hygiene, implement a custom `identity.Signer` backed by a Key Management Service (KMS) or Hardware Security Module (HSM).

:::

## D77: Untrusted Tool Output Model

All tool output is treated as untrusted by contract. This is the foundational security assumption: tools execute arbitrary external code and their output may contain prompt injection attempts, PII, or malicious content.

The `PostToolFilter` is the mandatory inspection point for tool output before it flows back to the LLM. Even if no filter is configured (zero-wiring default), the framework architecturally treats tool output as crossing a trust boundary -- this affects how errors are classified and how telemetry records the data flow.

## D78: Filter Trust Boundary Classification

Filters are classified by trust boundary position:

| Filter | Input Source | Trust Level | Implication |
|--------|------------|-------------|-------------|
| `PreLLMFilter` | Framework-controlled messages | Trusted | Filter errors are framework bugs |
| `PostToolFilter` | External tool output | Untrusted | Filter errors may indicate injection attempts |

This distinction affects error severity: a `PostToolFilter` error on untrusted input is treated as more critical than a `PreLLMFilter` error on framework-controlled input. Security monitoring should prioritize `PostToolFilter` blocks and errors.

## D116: MCP Output Trust Boundary

The `praxis/mcp` sub-module classifies the MCP transport edge as a Phase 5 untrusted-output boundary equivalent to D77. MCP servers are separate processes (stdio) or remote services (Streamable HTTP), often operated by third parties; their `ToolResult.Content` is transitively untrusted regardless of which transport carries it.

Two consequences follow from this classification:

1. **PostToolFilter is mandatory in practice.** All MCP results must pass `PostToolFilter` before reuse. The framework does not introduce a new MCP-specific filter tier; the existing D77/D78 contracts apply uniformly to MCP `tools.Invoker` results.
2. **Content flattening is defence in depth, not a substitute.** MCP responses are flattened to text-only blocks joined by `\n\n` (D114) before the result reaches the filter chain. This shrinks the attack surface but does not sanitise the content; filters remain the authoritative inspection point.

`SignedIdentity` JWTs are **not** forwarded to MCP servers (D118). If an MCP call needs a downstream identity assertion, inject it as a credential through `CredentialRef` and `credentials.Resolver` so the standard zeroing contract (D67) applies.

## D80: Twenty-Six Security Invariants

The security model is backed by 26 documented invariants covering credential handling, identity token generation, trust boundary enforcement, and telemetry redaction. These invariants are the security contract that the framework commits to maintaining across releases.

Key invariants include:
- Credentials never appear in logs, spans, events, or error messages
- Tool output always flows through the `PostToolFilter` inspection point
- Identity tokens have bounded lifetimes (max 300 seconds)
- Cancelled invocations still emit terminal events (no silent audit gaps)
- The framework contains no consumer-specific identifiers (enforced by CI)

See [Identity Signing](/docs/guides/identity-signing) for Ed25519 JWT setup and [Filter Chains](/docs/guides/filter-chains) for trust boundary implementation.

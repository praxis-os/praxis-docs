---
title: "identity Package"
description: "The identity package provides cryptographic identity assertion for tool calls using Ed25519-signed JWTs with short lifetimes and invocation-scoped claims."
sidebar_label: "identity"
sidebar_position: 8
keywords: [praxis, identity, signer, ed25519, jwt, tool-call, assertion, chaining, parent-token, claims]
rag_section: "api-reference"
rag_packages: ["identity"]
rag_interfaces: ["identity.Signer"]
rag_difficulty: "intermediate"
---

# identity Package

## Purpose

The `identity` package gives each tool call a cryptographic identity assertion. Before the orchestrator dispatches a tool call, it asks the registered `Signer` to produce a signed JWT. The tool receives this token through `InvocationContext` and can forward it to downstream services as proof that the call originated from a praxis invocation.

The reference implementation uses Ed25519 signing with short-lived tokens. This keeps the trust window narrow and avoids the complexity of certificate chains or key rotation during a single invocation.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Signer` | Interface | Produces a signed JWT for a given tool call. Single method: `Sign`. |
| `Ed25519Signer` | Struct | Reference implementation using Ed25519 keys. |
| `TokenClaims` | Struct | The JWT claim set, including both registered and custom claims. |

## Usage Patterns

### JWT Claim Set

Every identity token contains five registered JWT claims and two custom claims scoped to praxis.

| Claim | Type | Description |
|---|---|---|
| `iss` | Registered | Issuer identifier. Typically the service or orchestrator name. |
| `sub` | Registered | Subject. Identifies the caller or agent. |
| `exp` | Registered | Expiration timestamp. |
| `iat` | Registered | Issued-at timestamp. |
| `jti` | Registered | Unique token ID for replay prevention. |
| `praxis.invocation_id` | Custom | The invocation ID from the current state machine. |
| `praxis.tool_name` | Custom | The name of the tool being called. |

### Token Lifetime

Token lifetime is configurable between 5 and 300 seconds, with a default of 60 seconds. Short lifetimes limit the window in which a captured token can be replayed. The orchestrator generates a fresh token for each tool call, so there is no reuse across calls within a single invocation.

```go title="Configuring token lifetime"
signer := identity.NewEd25519Signer(
    privateKey,
    identity.WithIssuer("my-service"),
    identity.WithTokenLifetime(30 * time.Second),
)
```

### Signing and Verification

The `Signer` interface has a single method that receives the invocation ID, tool name, and optional additional claims. It returns a compact JWT string.

```go title="Signer interface"
type Signer interface {
    Sign(ctx context.Context, invocationID string, toolName string) (string, error)
}
```

Downstream services verify the token using the corresponding Ed25519 public key. The `praxis.invocation_id` and `praxis.tool_name` claims allow the verifier to confirm which invocation and tool call produced the request.

### Identity Chaining

When using the agent-as-tool composition pattern, the parent invocation's identity token is included in the child invocation's JWT as the `praxis.parent_token` claim. This creates a verifiable chain of trust from the outermost agent down to the innermost tool call.

```text title="Identity chain structure"
Parent invocation (token A)
  -> Child invocation (token B, with praxis.parent_token = A)
    -> Grandchild invocation (token C, with praxis.parent_token = B)
```

Verifiers can walk the `praxis.parent_token` chain to reconstruct the full delegation path. Each token in the chain is independently verifiable with its issuer's public key.

### Registration

Pass a `Signer` to the orchestrator at construction time. If no signer is provided, the orchestrator skips identity assertion and the `InvocationContext.IdentityToken` field is empty.

```go title="Registering an identity signer"
orch := orchestrator.New(
    provider,
    orchestrator.WithIdentitySigner(signer),
)
```

## Full API Reference

For complete type and method documentation, see [identity on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/identity).

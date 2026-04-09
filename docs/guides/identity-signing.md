---
title: "Identity Signing (Ed25519 JWT)"
description: "How to configure per-tool-call identity assertion using Ed25519 JWT tokens for secure agent identification in praxis."
sidebar_label: "Identity Signing"
sidebar_position: 7
keywords: [identity, signer, Ed25519, JWT, EdDSA, RFC8037, UUIDv7, claims, token, kid, parent_token, invocation_id, tool_name, key-management, stdlib]
rag_section: "guides"
rag_packages: ["identity"]
rag_interfaces: ["identity.Signer"]
rag_difficulty: "advanced"
---

# Identity Signing (Ed25519 JWT)

This guide covers how to set up per-tool-call identity assertion using short-lived Ed25519 JWT tokens. Identity signing provides a cryptographic proof of which agent and invocation made a tool call, enabling audit trails and downstream service authentication.

## Overview

When an `identity.Signer` is configured, praxis generates a signed JWT token for every tool call. The token is available to the `tools.Invoker` via `InvocationContext` and can be forwarded to downstream services as a bearer token or audit record.

Identity signing is optional -- the default `NullSigner` generates no tokens. This feature is typically needed when tool calls access external services that require caller identity verification.

## JWT Claims

Each identity token contains 5 registered claims and 2 custom praxis claims:

| Claim | Type | Description |
|-------|------|-------------|
| `iss` | registered | Issuer identifier (caller-configured) |
| `sub` | registered | Subject identifier (caller-configured) |
| `exp` | registered | Expiration time |
| `iat` | registered | Issued-at time |
| `jti` | registered | Unique token ID (UUIDv7 per RFC 9562) |
| `praxis.invocation_id` | custom | The invocation that generated this token |
| `praxis.tool_name` | custom | The tool being called |

Token lifetime is configurable between 5 and 300 seconds, with a default of 60 seconds. Short lifetimes limit the blast radius of token leakage.

## Setting Up Ed25519Signer

The reference implementation uses Ed25519 keys for signing:

```go title="identity_setup.go"
import (
    "crypto/ed25519"
    "crypto/rand"

    "github.com/praxis-os/praxis/identity"
    "github.com/praxis-os/praxis/orchestrator"
)

// Generate a key pair (in production, load from KMS/HSM)
pub, priv, err := ed25519.GenerateKey(rand.Reader)
if err != nil {
    log.Fatal(err)
}

signer, err := identity.NewEd25519Signer(priv)
if err != nil {
    log.Fatal(err)
}

orch, err := orchestrator.New(provider,
    orchestrator.WithIdentitySigner(signer),
)
```

`NewEd25519Signer` accepts functional options of type `SignerOption` for customisation. The default issuer is `"praxis"` and the default token lifetime is 60 seconds.

The `Ed25519Signer` uses only stdlib packages (`crypto/ed25519`, `encoding/json`, `encoding/base64`, `crypto/rand`) with an internal JWT encoder -- no external JWT library is imported. Each token's `jti` is a UUIDv7 (RFC 9562) value generated with a millisecond-precision timestamp prefix and `crypto/rand` for the remaining bits.

## Key Management

For production deployments, consider these practices:

- **Use KMS or HSM** for private key storage rather than in-memory keys
- **Rotate keys regularly** -- the `kid` header enables seamless rotation by allowing multiple valid keys simultaneously
- **Distribute public keys** to downstream services that need to verify tokens

:::warning

The `Ed25519Signer` reference implementation does not zero private key material during garbage collection. For environments with strict key hygiene requirements, implement a custom `identity.Signer` backed by KMS or HSM.

:::

## Identity Chaining

In agent-as-tool compositions, the outer agent's identity token can be forwarded to the inner agent via the `praxis.parent_token` claim. This creates an auditable chain of identity across nested invocations.

```go title="identity_chain.go"
// The inner orchestrator's Signer receives the outer token via InvocationContext.
// When generating the inner agent's token, it includes:
//   "praxis.parent_token": "<outer-agent-jwt>"
//
// Downstream services can verify the full chain:
//   Outer Agent → Inner Agent → Tool Call
```

This enables downstream services to answer: "Which agent initiated this chain of calls, and through what path did the request travel?"

## Verifying Tokens

Token consumers (downstream services) verify with the Ed25519 public key:

```go title="verify_token.go"
import "github.com/golang-jwt/jwt/v5"

token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
    kid := t.Header["kid"].(string)
    return lookupPublicKey(kid) // resolve Ed25519 public key by kid
})
if err != nil {
    // token invalid or expired
}

claims := token.Claims.(jwt.MapClaims)
invocationID := claims["praxis.invocation_id"].(string)
toolName := claims["praxis.tool_name"].(string)
```

For complete API documentation, see [`identity` on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/identity).

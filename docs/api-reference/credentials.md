---
title: "credentials Package"
description: "The credentials package manages secret material lifecycle with per-call resolution and automatic zeroing to prevent credential leakage."
sidebar_label: "credentials"
sidebar_position: 7
keywords: [praxis, credentials, resolver, secret, zeroing, ZeroBytes, security, api-key, per-call, lifecycle]
rag_section: "api-reference"
rag_packages: ["credentials"]
rag_interfaces: ["credentials.Resolver"]
rag_difficulty: "intermediate"
---

# credentials Package

## Purpose

The `credentials` package manages the lifecycle of secret material -- API keys, tokens, and other sensitive values -- that praxis needs to communicate with external services. The central design principle is that credentials are never cached, logged, or serialized. Each invocation resolves credentials fresh, and the framework zeroes secret bytes as soon as they are no longer needed.

This approach eliminates an entire class of credential leakage risks. Credentials do not live in long-lived objects, do not appear in structured logs, and do not survive beyond the invocation that requested them.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Resolver` | Interface | Resolves credentials for a given service and context. Called once per invocation, not cached. |
| `Credential` | Struct | Holds secret material and metadata. Implements `Close()` which zeroes the secret bytes. |
| `ZeroBytes` | Function | Utility that overwrites a byte slice with zeros. Used internally by `Credential.Close()`. |

## Usage Patterns

### Implementing a Resolver

A `Resolver` fetches credentials on demand. It might read from environment variables, a vault service, a secrets manager, or any other source. The key contract: return a fresh `Credential` each time, and the caller will `Close()` it when done.

```go title="Resolver from environment"
type EnvResolver struct{}

func (r *EnvResolver) Resolve(ctx context.Context, service string) (credentials.Credential, error) {
    key := os.Getenv("ANTHROPIC_API_KEY")
    if key == "" {
        return credentials.Credential{}, fmt.Errorf("no credential for service %s", service)
    }
    return credentials.Credential{
        Service: service,
        Secret:  []byte(key),
    }, nil
}
```

For production use, a vault-backed resolver is recommended. The resolver is called once per invocation, so vault round-trips happen at most once per agent call.

### Credential Lifecycle

The orchestrator calls `Resolve` at the start of an invocation, passes the credential to the LLM provider for authentication, and calls `Close()` on the credential when the invocation completes or errors. The `Close()` method overwrites the secret bytes with zeros using `credentials.ZeroBytes`.

```go title="Credential lifecycle"
cred, err := resolver.Resolve(ctx, "anthropic")
if err != nil {
    return err
}
defer cred.Close() // zeroes secret material

// Use cred.Secret for API authentication
```

### Security Guarantees

The credentials package enforces three invariants:

1. **Never cached.** The framework does not store credentials between invocations. Each call resolves fresh.
2. **Never logged.** The `Credential` type has no `String()` or `MarshalJSON()` method. Structured loggers cannot accidentally serialize it.
3. **Never serialized.** Credentials are passed by value within a single invocation and zeroed on completion.

The `ZeroBytes` utility is also exported for callers who manage their own secret material outside the framework.

```go title="Manual zeroing"
secret := []byte("sensitive-value")
defer credentials.ZeroBytes(secret)
```

### Registration

Pass a `Resolver` to the orchestrator at construction time. If no resolver is provided, the orchestrator will return an error when the LLM provider attempts to authenticate.

```go title="Registering a credential resolver"
orch := orchestrator.New(
    provider,
    orchestrator.WithCredentialResolver(myVaultResolver),
)
```

## Full API Reference

For complete type and method documentation, see [credentials on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/credentials).

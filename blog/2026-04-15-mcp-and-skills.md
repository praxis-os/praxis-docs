---
title: "praxis/mcp and praxis/skills sub-modules"
description: "praxis ships two new sub-modules: praxis/mcp v0.7 brings Model Context Protocol clients behind the standard tools.Invoker seam, and praxis/skills v0.9 loads SKILL.md bundles into the system prompt."
slug: mcp-and-skills
authors:
  - name: praxis team
tags: [release, mcp, skills, sub-modules]
---

# praxis/mcp and praxis/skills sub-modules

The root `praxis` module sits at v0.9.0 today, and two integration surfaces are now available as **independently versioned sub-modules**: `praxis/mcp` v0.7 and `praxis/skills` v0.9. Both are stable-v0.x-candidate and ship with their own `go.mod`, their own SemVer track, and their own coverage gate — which means they can evolve without forcing a root minor bump.

{/* truncate */}

## praxis/mcp — Model Context Protocol client

`praxis/mcp` adapts MCP servers to the praxis [`tools.Invoker`](/docs/api-reference/tools) seam. You declare a slice of `mcp.Server`, pick a transport (stdio or Streamable HTTP), wire a `credentials.Resolver`, and call `mcp.New`. The returned `mcp.Invoker` exposes every tool advertised by the configured servers under the namespaced name `{LogicalName}__{mcpToolName}` and plugs straight into `orchestrator.WithToolInvoker`.

Highlights:

- **Two transports, sealed surface.** `TransportStdio` for local server binaries (process-per-server, isolated process group, credential injected via env var and zeroed after copy). `TransportHTTP` for hosted servers (https-only by default, bearer tokens flowed through `CredentialRef` so they are never written into headers manually).
- **Trust boundary built in.** MCP output is classified as untrusted (D116). All `ToolResult.Content` from MCP must pass `PostToolFilter` before it reaches the LLM.
- **Bounded-cardinality metrics.** Three metrics — `praxis_mcp_calls_total`, `praxis_mcp_call_duration_seconds`, `praxis_mcp_transport_errors_total` — with labels capped by construction (`server` ≤ 32, fixed `transport`, `status`, `kind` enums).
- **Response cap, error classification, content flattening.** `WithMaxResponseBytes` guards against runaway servers. Dispatch errors fan out to `Network`, `CircuitOpen`, `SchemaViolation`, `ServerError`. Multi-block responses flatten to text-only joined by `\n\n` (D114).

Add it to your project:

```bash
go get github.com/praxis-os/praxis/mcp@v0.7.0
```

Start here: [MCP Integration guide](/docs/guides/mcp-integration), [stdio example](/docs/examples/mcp-stdio), [HTTP example](/docs/examples/mcp-http), [`mcp` package reference](/docs/api-reference/mcp).

## praxis/skills — SKILL.md bundles

`praxis/skills` loads filesystem skill bundles — a directory containing a `SKILL.md` file with YAML frontmatter and a Markdown body — and composes their instructions into the orchestrator's system prompt. Bundles are immutable, opaque values: load once, share across goroutines, wire with `WithSkill`.

Highlights:

- **Two loaders.** `Open(fs.FS, root)` for hermetic loading from `embed.FS`; `Load(path)` for the host filesystem.
- **Forward-compatible frontmatter.** Required fields (`name`, `description`) plus optional `license`, `compatibility`, `metadata`, `allowed-tools`. Unknown fields are preserved under their original keys via `Skill.Extensions()` and emit a `WarnExtensionField` warning rather than failing the load.
- **Composition with markers.** Multiple `WithSkill(s)` calls compose in order, joined by `--- Skills ---` separators. Duplicate names panic at orchestrator construction (D127).
- **AllowedTools as defence in depth.** The package never enforces tool access — it surfaces `Skill.AllowedTools()` for downstream `PolicyHook` enforcement, keeping authoritative policy where it belongs.

Non-goals (D133): no downloads, no runtime discovery, no hot-reload, no script execution, no sandboxing. Skills are static instruction fragments composed at build time.

Add it to your project:

```bash
go get github.com/praxis-os/praxis/skills@v0.9.0
```

Start here: [Skill Authoring guide](/docs/guides/skills-authoring), [Skills example](/docs/examples/skills), [`skills` package reference](/docs/api-reference/skills).

## Why independent sub-modules

Both packages live in the same repository as the root `praxis` module, but each ships its own `go.mod` and is tagged on its own SemVer track (`praxis/mcp/vX.Y.Z`, `praxis/skills/vX.Y.Z`). This decouples integration-surface evolution from the root invocation-kernel freeze: a breaking change in `praxis/mcp` does not force a root minor bump, and the planned root `v1.0.0` interface freeze does not block experimentation in either sub-module. The shared rules — D81 deprecation window, D83 conventional commits, D86 85% coverage, D92 DCO sign-off — still apply per-module. See [release governance D106](/docs/design-decisions/release-governance#d106-sub-module-versioning) for the full rationale.

## What's next

- The `mcp` sub-module is targeting `praxis/mcp/v1.0.0` once the public API has settled across at least one production deployment.
- The `skills` sub-module is targeting `praxis/skills/v1.0.0` after the same gate; the `MetricsRecorder` interface remains marked experimental until then.
- Root `praxis` v1.0.0 follows the existing D91 first-production-consumer gate.

Pin sub-module versions independently in your `go.mod`:

```text
require (
    github.com/praxis-os/praxis v0.9.0
    github.com/praxis-os/praxis/mcp v0.7.0
    github.com/praxis-os/praxis/skills v0.9.0
)
```

Browse the full release notes on [GitHub](https://github.com/praxis-os/praxis/releases).

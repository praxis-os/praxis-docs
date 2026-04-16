---
title: "skills Package"
description: "The skills package is an independently versioned sub-module that loads SKILL.md bundles and composes their instructions into a praxis system prompt."
sidebar_label: "skills"
sidebar_position: 14
keywords: [praxis, skills, skill, SKILL.md, frontmatter, system-prompt, composition, allowed-tools, sub-module, D127, D130, D133]
rag_section: "api-reference"
rag_packages: ["skills"]
rag_interfaces: ["skills.MetricsRecorder"]
rag_difficulty: "intermediate"
---

# skills Package

## Purpose

The `skills` package is an **independently versioned Go sub-module** (`github.com/praxis-os/praxis/skills`) that loads filesystem skill bundles and composes their instruction text into the orchestrator's system prompt. A skill bundle is a directory containing a `SKILL.md` file — YAML frontmatter plus a Markdown instruction body — that packages a capability (code review, triage, data extraction) as a reusable artefact.

The loader parses frontmatter, validates required fields, preserves unknown fields as extensions, and returns an immutable `*Skill` value. Composition is opt-in via `WithSkill(s)` at orchestrator construction time.

:::note

The `skills` sub-module has its own `go.mod` and is released on its own `praxis/skills/vX.Y.Z` SemVer track. You add it independently: `go get github.com/praxis-os/praxis/skills@v0.9.0`. Current state: stable-v0.x-candidate; `MetricsRecorder` is marked experimental.

:::

**Non-goals (D133).** The package does not download bundles, does not discover them at runtime, does not hot-reload, does not execute scripts, and does not sandbox tool calls. Skills are static instruction fragments composed at build time.

## Key Interfaces and Types

| Name | Kind | Description |
|---|---|---|
| `Skill` | Struct (opaque) | Immutable loaded bundle. Safe to share across goroutines. All accessors return zero values for absent optional fields. |
| `Open(fsys fs.FS, root string)` | Function | Hermetic load from an `fs.FS` (useful with `embed.FS` for tests). Returns `(*Skill, []SkillWarning, error)`. |
| `Load(path string)` | Function | Convenience wrapper that reads from the host filesystem. Path may point to a directory or directly to a `SKILL.md`. |
| `WithSkill(s *Skill)` | Function | Returns an `orchestrator.Option` that appends the skill's instructions to the system prompt. |
| `ComposedInstructions(base string, skills ...*Skill)` | Function | Debug/test helper. Returns the system prompt that would be composed for the given base prompt and skills. |
| `SkillWarning` / `WarnKind` | Struct / Enum | Non-fatal diagnostics (`extension_field`, `empty_instructions`) emitted during load. |
| `LoadError` / `SkillSubKind` | Struct / Enum | Typed load failure: `skill_bundle_missing`, `skill_bundle_malformed_yaml`, `skill_bundle_invalid_field`, `skill_bundle_path_escape`. Implements `errors.TypedError`. |
| `MetricsRecorder` | Interface (experimental) | Optional `RecordSkillLoaded(name, status string)`. Skill names MUST NOT be used as metric labels (D130 — bounded cardinality). |

### Skill Accessors

| Method | Type | Notes |
|---|---|---|
| `Name()` | `string` | Required; matches `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`. |
| `Description()` | `string` | Required; non-empty. |
| `License()` | `string` | Optional; SPDX ID or free-text. |
| `Compatibility()` | `string` | Optional; free-text (e.g., model family). |
| `Metadata()` | `map[string]any` | Optional; author-defined. |
| `AllowedTools()` | `[]string` | Optional; advisory allowlist for downstream enforcement. |
| `Instructions()` | `string` | Verbatim Markdown body (frontmatter stripped). |
| `Extensions()` | `map[string]any` | Unknown frontmatter fields preserved under original keys. |

## SKILL.md Format

```yaml
---
name: code-reviewer
description: |
  Reviews staged changes for correctness, test coverage, and style.
license: Apache-2.0
compatibility: "claude-sonnet-4-6, claude-opus-4-6"
metadata:
  author: team-platform
  maintainer: platform@example.com
allowed-tools:
  - read_file
  - grep
---

You are a code reviewer. When invoked, read the currently staged
changes and produce a review organised by severity: Blocker,
Important, Nitpick. End with a one-line "READY / BLOCK" verdict.
```

Size limits: `SKILL.md` ≤ 256 KiB; frontmatter ≤ 64 KiB (YAML anchor-expansion guard, D124). Unknown frontmatter fields emit a `WarnExtensionField` and are preserved in `Extensions()`. An empty instruction body emits `WarnEmptyInstructions`.

## Usage Patterns

### Loading

```go title="Loading a skill bundle"
sk, warnings, err := skills.Load("./skills/code-reviewer")
if err != nil {
    return err
}
for _, w := range warnings {
    log.Printf("skill warning [%s]: %s", w.Kind, w.Message)
}
```

For hermetic tests or embedded bundles, use `Open` with an `fs.FS`:

```go title="Loading from embed.FS"
//go:embed skills/code-reviewer/*
var bundleFS embed.FS

sk, _, err := skills.Open(bundleFS, "skills/code-reviewer")
```

### Composition into the System Prompt

`WithSkill(sk)` returns an `orchestrator.Option` that appends the skill's `Instructions()` text to the system prompt. Multiple skills compose in call order, separated by a `--- Skills ---` marker. Duplicate names across registered skills cause a panic at orchestrator construction (D127).

```go title="Wiring skills into the orchestrator"
orch, err := orchestrator.New(
    provider,
    orchestrator.WithDefaultModel("claude-sonnet-4-6"),
    skills.WithSkill(reviewer),
    skills.WithSkill(triage),
)
```

`ComposedInstructions(base, skills...)` returns the exact string that would result from composition — useful in tests to assert prompt shape without instantiating an orchestrator.

### AllowedTools (Defence in Depth)

`AllowedTools()` is an **advisory allowlist**: the `skills` package itself does not enforce tool access. Enforcement is the caller's responsibility, typically implemented as a `hooks.PolicyHook` that intersects the registered skill allowlists with the tool being called. Treat this as a defence-in-depth layer; authoritative policy belongs in `hooks.PolicyHook`.

### Observability

Implement `MetricsRecorder` to record load outcomes:

```go title="Opting into skill metrics"
type myRecorder struct{}

func (myRecorder) RecordSkillLoaded(name, status string) {
    // status is "success" or a SkillSubKind string; name is the skill name.
    // Bounded-cardinality reminder: emit the name as a log field, not a
    // metric label. Use only `status` as a metric label.
    skillsLoadedTotal.WithLabelValues(status).Inc()
}
```

Suggested Prometheus counter: `praxis_skills_loaded_total{status="..."}`.

## Full API Reference

For complete type and method documentation, see [skills on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/skills).

See also: the [Skills Authoring guide](/docs/guides/skills-authoring) and the [Skills example](/docs/examples/skills).

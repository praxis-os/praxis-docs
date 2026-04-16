---
title: "Skill Authoring"
description: "Author SKILL.md bundles, load them with fs.FS or the host filesystem, compose them into a system prompt, and enforce allowed-tools as defence in depth."
sidebar_label: "Skill Authoring"
sidebar_position: 10
keywords: [skills, SKILL.md, frontmatter, authoring, embed, fs.FS, composition, allowed-tools, policy-hook, warnings]
rag_section: "guides"
rag_packages: ["skills", "orchestrator", "hooks"]
rag_interfaces: ["skills.MetricsRecorder", "hooks.PolicyHook"]
rag_difficulty: "intermediate"
---

# Skill Authoring

This guide walks through authoring a skill bundle, loading it into a praxis orchestrator via the [`skills` sub-module](../api-reference/skills.md), and pairing it with a policy hook for authoritative tool enforcement.

## Prerequisites

Add the sub-module to your project:

```bash title="terminal"
go get github.com/praxis-os/praxis/skills@v0.9.0
```

A skill bundle is a filesystem directory containing a single `SKILL.md`. Pick a directory layout that fits your repo — typically `skills/<skill-name>/SKILL.md`.

## Step 1: Lay Out the Bundle

```text
skills/
  code-reviewer/
    SKILL.md
  triage/
    SKILL.md
```

One directory per skill, one `SKILL.md` per directory. Additional files (fixtures, examples) may live alongside; the loader only reads `SKILL.md`.

## Step 2: Write SKILL.md

```yaml title="skills/code-reviewer/SKILL.md"
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

You are a code reviewer. When invoked:

1. Read the currently staged changes.
2. Organise findings by severity:
   - **Blocker** -- bugs, regressions, security issues.
   - **Important** -- missing tests, missing documentation, inconsistent style.
   - **Nitpick** -- cosmetic suggestions.
3. End with a one-line `READY / BLOCK` verdict.
```

### Frontmatter Fields

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Matches `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`. Used to deduplicate skills at orchestrator construction (D127). |
| `description` | Yes | Non-empty string. Appears in logs and metrics. |
| `license` | No | SPDX identifier or free-text statement. |
| `compatibility` | No | Free-text compatibility hint (typically model IDs). |
| `metadata` | No | Author-defined map. Surfaces via `Skill.Metadata()`. |
| `allowed-tools` | No | Advisory list of tool names. Surfaces via `Skill.AllowedTools()`. |

Unknown frontmatter fields are **preserved**, not rejected — they surface via `Skill.Extensions()` and emit a `WarnExtensionField` warning. This gives you forward compatibility for house-specific fields (e.g., `team: platform`, `risk: high`).

### Size Limits

- `SKILL.md` ≤ 256 KiB total.
- Frontmatter ≤ 64 KiB (YAML anchor-expansion guard, D124).

## Step 3: Load the Bundle

Two loaders ship. `Load` reads from the host filesystem; `Open` reads from an `fs.FS`.

### Host Filesystem

```go title="Load from host filesystem"
sk, warnings, err := skills.Load("./skills/code-reviewer")
if err != nil {
    return fmt.Errorf("load skill: %w", err)
}
for _, w := range warnings {
    log.Printf("skill warning [%s]: %s", w.Kind, w.Message)
}
```

`Load` accepts either a directory (it appends `SKILL.md`) or a direct path to `SKILL.md`.

### Embedded Filesystem

For hermetic tests and shipping bundles inside your binary:

```go title="Load from embed.FS"
import "embed"

//go:embed skills/code-reviewer/*
var bundleFS embed.FS

sk, _, err := skills.Open(bundleFS, "skills/code-reviewer")
```

`Open` rejects paths containing `..` or absolute prefixes (returns `LoadError` with `SkillSubKindPathEscape`).

### Handling Warnings

`SkillWarning` is non-fatal diagnostic output. Two kinds ship:

| Kind | Meaning |
|---|---|
| `extension_field` | Frontmatter contains an unknown field. Preserved in `Extensions()`. |
| `empty_instructions` | The SKILL.md body (after frontmatter) is empty. |

Log them or surface them in CI, but loading succeeds. Fatal problems return a typed `LoadError` with a `SkillSubKind` value (`skill_bundle_missing`, `skill_bundle_malformed_yaml`, `skill_bundle_invalid_field`, `skill_bundle_path_escape`).

## Step 4: Compose into the System Prompt

`WithSkill(sk)` returns an `orchestrator.Option`. Multiple skills compose in call order, joined by a `--- Skills ---` separator. Duplicate `Name()` values across registered skills cause a panic at `orchestrator.New` time — the loader cannot enforce this because deduplication spans multiple loads.

```go title="Composing multiple skills"
reviewer, _, _ := skills.Load("./skills/code-reviewer")
triage, _, _ := skills.Load("./skills/triage")

orch, err := orchestrator.New(
    provider,
    orchestrator.WithDefaultModel("claude-sonnet-4-6"),
    skills.WithSkill(reviewer),
    skills.WithSkill(triage),
)
```

Order matters: later skills are appended after earlier ones in the composed prompt. Put broader role prompts first, sharper task instructions last.

### Previewing the Composed Prompt

`ComposedInstructions` returns the exact string that composition would produce. Useful in tests and for snapshot validation:

```go title="Snapshot-testing composed prompts"
got := skills.ComposedInstructions("You are helpful.", reviewer, triage)
if got != want {
    t.Errorf("composed prompt drift:\n%s", got)
}
```

## Step 5: Enforce AllowedTools (Defence in Depth)

`Skill.AllowedTools()` is **advisory**. The `skills` package does not enforce it because enforcement needs context the package does not have: which tools the orchestrator actually registered, what the active policy is, whether an individual call is authorised. Move authoritative enforcement into a `hooks.PolicyHook`:

```go title="PolicyHook that respects skill allowlists"
type skillGate struct {
    allowed map[string]struct{}
}

func newSkillGate(skills ...*skills.Skill) *skillGate {
    g := &skillGate{allowed: map[string]struct{}{}}
    for _, s := range skills {
        for _, t := range s.AllowedTools() {
            g.allowed[t] = struct{}{}
        }
    }
    return g
}

func (g *skillGate) EvaluateToolCall(ctx context.Context, ic hooks.InvocationContext, call tools.ToolCall) (hooks.PolicyDecision, error) {
    if _, ok := g.allowed[call.Name]; !ok {
        return hooks.PolicyDecision{Action: hooks.PolicyActionDeny, Reason: "tool not in any loaded skill's allowlist"}, nil
    }
    return hooks.PolicyDecision{Action: hooks.PolicyActionAllow}, nil
}
```

Treat `AllowedTools()` as a layer, not the last line of defence. Combine it with your organisational policy hook.

## Step 6: Observability (Experimental)

Opt into skill metrics by implementing `MetricsRecorder`. Skill names MUST NOT be metric labels (D130 — bounded cardinality); emit the name as a log field and use `status` only as a metric label.

```go title="Skill metrics recorder"
type recorder struct{}

func (recorder) RecordSkillLoaded(name, status string) {
    log.Printf("skill=%s status=%s", name, status)
    skillsLoadedTotal.WithLabelValues(status).Inc()
}
```

## Testing Skills

Use `embed.FS` with `Open` for hermetic tests that travel with the package:

```go title="Hermetic skill test"
//go:embed testdata/valid-bundle/*
var testBundle embed.FS

func TestBundle(t *testing.T) {
    sk, warnings, err := skills.Open(testBundle, "testdata/valid-bundle")
    if err != nil {
        t.Fatalf("load: %v", err)
    }
    if got := sk.Name(); got != "code-reviewer" {
        t.Errorf("name = %q, want code-reviewer", got)
    }
    if len(warnings) != 0 {
        t.Errorf("unexpected warnings: %v", warnings)
    }
}
```

## Full API Reference

For complete type and method documentation, see [skills on pkg.go.dev](https://pkg.go.dev/github.com/praxis-os/praxis/skills).

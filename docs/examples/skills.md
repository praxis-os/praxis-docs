---
title: "Skills Example"
description: "Demonstrates loading a SKILL.md bundle, previewing the composed system prompt, and wiring the skill into a praxis orchestrator."
sidebar_label: "Skills"
sidebar_position: 9
keywords: [skills, SKILL.md, composed-prompt, ComposedInstructions, WithSkill, code-reviewer, anthropic]
rag_section: "examples"
rag_packages: ["orchestrator", "skills", "llm", "llm/anthropic"]
rag_interfaces: []
rag_difficulty: "intermediate"
---

# Skills Example

This example loads a `SKILL.md` bundle with the [`skills` sub-module](../api-reference/skills.md), prints the composed system prompt, and invokes the orchestrator with the skill wired in. The bundle used is `skills/testdata/valid-bundle` inside the praxis repository — a simple `code-reviewer` skill.

## Source Code

```go title="examples/skills/main.go"
// SPDX-License-Identifier: Apache-2.0

package main

import (
    "context"
    "fmt"
    "log"
    "os"

    "github.com/praxis-os/praxis"
    "github.com/praxis-os/praxis/llm"
    "github.com/praxis-os/praxis/llm/anthropic"
    "github.com/praxis-os/praxis/orchestrator"
    "github.com/praxis-os/praxis/skills"
)

func main() {
    apiKey := os.Getenv("ANTHROPIC_API_KEY")
    if apiKey == "" {
        fmt.Fprintln(os.Stderr, "error: ANTHROPIC_API_KEY environment variable is not set")
        os.Exit(1)
    }

    // 1. Load the skill bundle.
    sk, warnings, err := skills.Load("./skills/testdata/valid-bundle")
    if err != nil {
        log.Fatalf("skill load: %v", err)
    }
    for _, w := range warnings {
        log.Printf("skill warning [%s]: %s", w.Kind, w.Message)
    }

    fmt.Printf("Loaded skill: %s\n", sk.Name())
    fmt.Printf("Description:  %s\n", sk.Description())
    fmt.Printf("License:      %s\n", sk.License())
    if md := sk.Metadata(); md != nil {
        fmt.Printf("Metadata:     %v\n", md)
    }
    if tools := sk.AllowedTools(); tools != nil {
        fmt.Printf("AllowedTools: %v\n", tools)
    }

    // 2. Preview composed instructions (debug helper).
    composed := skills.ComposedInstructions("You are helpful.", sk)
    fmt.Printf("\nComposed system prompt:\n%s\n\n", composed)

    // 3. Wire orchestrator with skill.
    provider := anthropic.New(apiKey)
    orch, err := orchestrator.New(
        provider,
        orchestrator.WithDefaultModel("claude-sonnet-4-6"),
        skills.WithSkill(sk),
    )
    if err != nil {
        log.Fatalf("orchestrator: %v", err)
    }

    // 4. Invoke.
    result, err := orch.Invoke(context.Background(), praxis.InvocationRequest{
        SystemPrompt: "You are helpful.",
        Messages: []llm.Message{{
            Role:  llm.RoleUser,
            Parts: []llm.MessagePart{llm.TextPart("Review this Go code: func add(a, b int) int { return a - b }")},
        }},
    })
    if err != nil {
        log.Fatalf("invoke: %v", err)
    }

    if result.Response != nil {
        for _, p := range result.Response.Parts {
            if p.Type == llm.PartTypeText {
                fmt.Println(p.Text)
            }
        }
    }
}
```

> [View source on GitHub](https://github.com/praxis-os/praxis/blob/main/examples/skills/main.go)

## Running

Requires an Anthropic API key. Run from the root of the praxis repository so the relative bundle path resolves:

```bash title="terminal"
ANTHROPIC_API_KEY=sk-ant-... go run examples/skills/main.go
```

## Expected Output

```
Loaded skill: code-reviewer
Description:  Reviews staged changes for correctness, test coverage, and style.
License:      Apache-2.0
Metadata:     map[author:team-platform maintainer:platform@example.com]
AllowedTools: [read_file grep]

Composed system prompt:
You are helpful.

--- Skills ---

You are a code reviewer. When invoked, read the currently staged
changes and produce a review organised by severity: ...

[LLM's review of the `add` function, flagging the `-` typo as a Blocker]
```

The model's natural-language review varies by run.

## What This Demonstrates

1. **`skills.Load`** -- loading a bundle from the host filesystem with non-fatal warnings surfaced separately from the fatal `LoadError` path.
2. **`Skill` accessors** -- `Name`, `Description`, `License`, `Metadata`, `AllowedTools` returning zero values for absent optional fields.
3. **`ComposedInstructions`** -- debug/test helper that returns the exact system prompt composition would produce, with `--- Skills ---` separators.
4. **`WithSkill` wiring** -- the orchestrator option that appends the skill's `Instructions()` to the system prompt at construction time.
5. **Immutability** -- the loaded `*Skill` is safe to share across goroutines; no mutation API exists.

## Next Steps

- Read the [Skill Authoring guide](../guides/skills-authoring.md) for the full `SKILL.md` schema, composition order, `AllowedTools` enforcement patterns, and testing with `embed.FS`.
- Read the [skills package reference](../api-reference/skills.md) for the full API surface.

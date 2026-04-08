---
title: "Creating Filter Chains"
description: "How to implement PreLLMFilter and PostToolFilter interfaces to inspect and transform messages at trust boundaries."
sidebar_label: "Filter Chains"
sidebar_position: 4
keywords: [praxis, filters, PreLLMFilter, PostToolFilter, FilterDecision, redaction, PII, trust-boundary, security]
rag_section: "guides"
rag_packages: ["hooks"]
rag_interfaces: ["hooks.PreLLMFilter", "hooks.PostToolFilter"]
rag_difficulty: "advanced"
---

# Creating Filter Chains

Filter chains provide fine-grained, per-field control over data flowing through the invocation lifecycle. Unlike policy hooks that make coarse allow/deny decisions, filters can selectively redact, log, or block individual content fields. This guide covers both filter interfaces, decision types, composition, and a complete PII redaction example.

## PreLLMFilter

PreLLMFilter runs before each LLM call, including continuation calls during the tool-use cycle. It operates on the `LLMRequest` that the orchestrator has constructed from the caller's input and any previous tool results.

```go title="hooks.PreLLMFilter interface"
type PreLLMFilter interface {
    Filter(ctx context.Context, req *LLMRequest) (FilterDecision, error)
}
```

The `LLMRequest` is passed by pointer, allowing the filter to modify messages in place before they reach the LLM provider. This is the mechanism for redaction -- the filter replaces sensitive content with placeholder tokens and returns a `Redact` decision.

```go title="Example PreLLMFilter: system prompt guard"
type SystemPromptGuard struct {
    injectionPatterns []*regexp.Regexp
}

func (f *SystemPromptGuard) Filter(ctx context.Context, req *hooks.LLMRequest) (hooks.FilterDecision, error) {
    for _, msg := range req.Messages {
        for _, part := range msg.Parts {
            if part.Type != "text" {
                continue
            }
            for _, pattern := range f.injectionPatterns {
                if pattern.MatchString(part.Text) {
                    return hooks.FilterDecision{
                        Action: hooks.Block,
                        Reason: "prompt injection detected in user message",
                    }, nil
                }
            }
        }
    }
    return hooks.FilterDecision{Action: hooks.Pass}, nil
}
```

PreLLMFilter operates on **framework-controlled input**. The data passing through this filter was constructed by the orchestrator from the caller's `InvocationRequest` and previous model responses. While the content may include user-provided text, the structure is controlled by the framework.

## PostToolFilter

PostToolFilter runs after each tool execution, before the tool output is sent back to the model for continuation. This is the most security-sensitive boundary in the invocation lifecycle.

```go title="hooks.PostToolFilter interface"
type PostToolFilter interface {
    Filter(ctx context.Context, toolName string, input any, output *ToolOutput) (FilterDecision, error)
}
```

The filter receives the tool name, the original input sent to the tool, and the raw output. The `output` parameter is a pointer, allowing in-place modification for redaction.

```go title="PostToolFilter contract"
type ToolOutput struct {
    Content string // Raw tool output content
    Status  string // Success, Error, or Partial
}
```

:::danger
PostToolFilter operates on **untrusted input**. Tool output comes from external systems -- HTTP APIs, databases, file systems, or arbitrary code execution. This output has not been validated by any part of the praxis framework. Never skip PostToolFilter in production.
:::

Tool output is the primary vector for indirect prompt injection attacks, where an external system returns content designed to manipulate the model's behavior. A PostToolFilter that detects and blocks injection attempts is a critical security control.

## FilterDecision Actions

Both `PreLLMFilter` and `PostToolFilter` return a `FilterDecision` with one of four actions.

| Action | Effect | Invocation Impact |
|--------|--------|-------------------|
| `Pass` | Data flows through unchanged | None -- continues normally |
| `Redact` | The filter has modified the data in place | Continues with redacted data; original data is not preserved |
| `Log` | Data flows through unchanged, but the action is recorded | None -- telemetry event emitted via `LifecycleEventEmitter` |
| `Block` | The invocation is stopped immediately | Transitions to `Failed` terminal state with `policy_denied` error kind |

`Redact` requires that the filter has already modified the `*LLMRequest` or `*ToolOutput` before returning. The orchestrator does not perform any modification itself -- it trusts that the filter has done its work.

`Block` is the nuclear option. It terminates the entire invocation, not just the current tool call. Use it only when the content is dangerous enough that continuing would be a security risk.

```go title="FilterDecision structure"
type FilterDecision struct {
    Action FilterAction
    Reason string // Required for Block; recommended for Redact and Log
}
```

:::tip
Always include a `Reason` string with `Redact`, `Log`, and `Block` decisions. The reason appears in telemetry events and makes it possible to audit why data was modified or an invocation was stopped.
:::

## Composing Filters

Multiple filters are registered as ordered chains. Each filter in the chain receives the output of the previous filter. A `Block` from any filter short-circuits the remaining filters and terminates the invocation.

```go title="Registering filter chains"
orch := orchestrator.New(provider,
    orchestrator.WithPreLLMFilters(
        &SystemPromptGuard{},   // Blocks prompt injection attempts
        &PIIDetector{},         // Redacts PII tokens in messages
    ),
    orchestrator.WithPostToolFilters(
        &OutputSizeLimiter{},   // Blocks outputs exceeding 100KB
        &CredentialRedactor{},  // Redacts API keys and secrets
        &InjectionDetector{},   // Blocks indirect prompt injection
    ),
)
```

Execution order matters. In the `PostToolFilter` chain above:

1. `OutputSizeLimiter` runs first. If the tool output exceeds the size threshold, it returns `Block` and the chain stops.
2. `CredentialRedactor` runs second on the (potentially large but within-limits) output. It modifies the `ToolOutput.Content` in place, replacing credential patterns with `[REDACTED]`.
3. `InjectionDetector` runs third on the already-redacted output. It checks for prompt injection patterns in the remaining content.

If no filters are configured, the orchestrator passes data through unchanged. This is the zero-wiring default -- safe for development, but not recommended for production.

## Example: PII Redaction Filter

This complete example implements a `PostToolFilter` that redacts email addresses and phone numbers from tool output before the data reaches the LLM.

```go title="filters/pii_redactor.go"
package filters

import (
    "context"
    "regexp"

    "github.com/praxis-os/praxis/hooks"
)

var (
    emailPattern = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
    phonePattern = regexp.MustCompile(`(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}`)
)

// PIIRedactionFilter scans tool output for PII patterns and replaces them
// with placeholder tokens before the output reaches the LLM.
type PIIRedactionFilter struct {
    patterns     []*regexp.Regexp
    replacements []string
}

// NewPIIRedactionFilter returns a filter with default email and phone patterns.
func NewPIIRedactionFilter() *PIIRedactionFilter {
    return &PIIRedactionFilter{
        patterns:     []*regexp.Regexp{emailPattern, phonePattern},
        replacements: []string{"[EMAIL_REDACTED]", "[PHONE_REDACTED]"},
    }
}

func (f *PIIRedactionFilter) Filter(
    ctx context.Context,
    toolName string,
    input any,
    output *hooks.ToolOutput,
) (hooks.FilterDecision, error) {
    original := output.Content
    modified := original

    for i, pattern := range f.patterns {
        modified = pattern.ReplaceAllString(modified, f.replacements[i])
    }

    if modified != original {
        output.Content = modified
        return hooks.FilterDecision{
            Action: hooks.Redact,
            Reason: "PII patterns detected and redacted from tool output",
        }, nil
    }

    return hooks.FilterDecision{Action: hooks.Pass}, nil
}
```

Register the filter with the orchestrator:

```go title="main.go"
piiFilter := filters.NewPIIRedactionFilter()

orch := orchestrator.New(provider,
    orchestrator.WithPostToolFilters(piiFilter),
)
```

The filter modifies `output.Content` in place before returning `Redact`. After this filter runs, the LLM sees `[EMAIL_REDACTED]` and `[PHONE_REDACTED]` instead of actual PII. The original data is never sent to the model.

To test the filter:

```go title="filters/pii_redactor_test.go"
func TestPIIRedaction(t *testing.T) {
    f := filters.NewPIIRedactionFilter()
    output := &hooks.ToolOutput{
        Content: "Contact john@example.com or call 555-123-4567",
        Status:  "Success",
    }

    decision, err := f.Filter(context.Background(), "search", nil, output)
    if err != nil {
        t.Fatal(err)
    }
    if decision.Action != hooks.Redact {
        t.Errorf("expected Redact, got %v", decision.Action)
    }
    if output.Content != "Contact [EMAIL_REDACTED] or call [PHONE_REDACTED]" {
        t.Errorf("unexpected content: %s", output.Content)
    }
}
```

:::warning
Regex-based PII detection catches common formats but is not comprehensive. For production systems handling regulated data (HIPAA, GDPR), consider using a dedicated PII detection service as the backend for your filter implementation.
:::

For the full `hooks` package API, see [pkg.go.dev/github.com/praxis-os/praxis/hooks](https://pkg.go.dev/github.com/praxis-os/praxis/hooks).

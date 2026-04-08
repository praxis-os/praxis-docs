---
title: "Contributing"
description: "How to contribute to praxis: development setup, code standards, testing requirements, commit conventions, and the PR review process."
sidebar_label: "Contributing"
sidebar_position: 100
keywords: [contributing, development, setup, testing, commits, conventional-commits, DCO, PR, pull-request, golangci-lint, coverage]
rag_section: "contributing"
rag_packages: []
rag_interfaces: []
rag_difficulty: "beginner"
---

# Contributing

Thank you for your interest in contributing to praxis. This guide covers the development setup, code standards, and review process.

## Prerequisites

- **Go 1.23** or later
- **make** (GNU Make)
- **golangci-lint** -- `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`
- **commitsar** -- `go install github.com/aevea/commitsar/cmd/commitsar@latest`

## Getting Started

```bash title="terminal"
git clone https://github.com/praxis-os/praxis.git
cd praxis
make check
```

`make check` runs the full validation suite: lint, tests with race detector, coverage check, banned-identifier scan, SPDX header verification, and commit format validation.

## Code Standards

### SPDX Headers

Every Go file must start with the Apache 2.0 SPDX header:

```go title="header.go"
// SPDX-License-Identifier: Apache-2.0
```

### Formatting and Linting

- All code must pass `gofmt` formatting
- All code must pass `golangci-lint` without exceptions
- Follow standard Go patterns: interfaces as inputs, concrete types as outputs, explicit error handling, context propagation

### Banned Identifiers

A CI job (`make banned-grep`) scans the codebase for consumer-specific identifiers that must never appear in the framework. This enforces the [decoupling contract](/docs/core-concepts/architecture) at the CI level.

## Testing Requirements

- **85% coverage** per package (enforced in CI)
- **Table-driven tests** using subtests (`t.Run`)
- **Race detector** enabled: all tests run with `go test -race`
- **Benchmarks** for hot paths
- **Shared test utilities** must declare `t.Helper()`
- **Property-based tests** for the state machine: 10,000 iterations on PRs, 100,000 nightly

## Commit Conventions

All commits follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

Optional body.

Signed-off-by: Your Name <your@email.com>
```

### Types

`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`

### Breaking Changes

Use the `BREAKING CHANGE:` footer (not the `!` suffix):

```
feat(budget): change Guard interface to support async checks

BREAKING CHANGE: Guard.Check now returns (bool, error) instead of error.

Signed-off-by: Your Name <your@email.com>
```

### DCO Sign-Off

Every commit requires a `Signed-off-by` line certifying the [Developer Certificate of Origin v1.1](https://developercertificate.org/):

```bash title="terminal"
git commit -s -m "feat(tools): add InvocationContext to Invoker"
```

## Pull Request Process

### CI Gates

All of these must pass before merge:

1. **Lint** -- `golangci-lint run`
2. **Test** -- `go test -race -coverprofile=...`
3. **Coverage** -- 85% per package
4. **Commitsar** -- conventional commit format
5. **Banned-grep** -- no consumer-specific identifiers
6. **SPDX** -- Apache 2.0 headers on all Go files
7. **DCO** -- `Signed-off-by` on every commit

### Review Policy

- During v0.x: one maintainer approval required
- PRs that change exported symbols trigger a 24-hour hold for broader review
- Interface-changing PRs cannot be self-merged
- Squash-merge only (clean history)

### Design Changes

Any change that touches a public interface requires a decisions-log entry in the relevant phase directory. See [Design Decisions](/docs/design-decisions/overview) for the process.

## Security

Please report security vulnerabilities through GitHub's private vulnerability reporting feature. Do **not** open public issues for security concerns. See [`SECURITY.md`](https://github.com/praxis-os/praxis/blob/main/SECURITY.md) for the full disclosure policy.

## License

All contributions are under the Apache 2.0 license. No CLA is required.

---
title: "Release Governance"
description: "Key design decisions on praxis release process: deprecation windows, conventional commits, coverage gates, production consumer requirement, and DCO sign-off."
sidebar_label: "Release Governance"
sidebar_position: 7
keywords: [release, governance, deprecation, conventional-commits, coverage, 85-percent, DCO, sign-off, production-consumer, D81, D83, D86, D91, D92]
rag_section: "design-decisions"
rag_packages: []
rag_interfaces: []
rag_difficulty: "intermediate"
---

# Release Governance

These decisions define how praxis is versioned, released, and maintained.

## D81: Deprecation Window

A deprecated symbol must remain functional for at least **2 minor releases and 6 calendar months**, whichever is longer. This gives consumers a predictable migration window.

Deprecation is signaled via Go's `// Deprecated:` comment convention, which is surfaced by `go vet`, IDEs, and pkg.go.dev. The deprecated symbol continues to compile and function correctly throughout the window.

## D83: Conventional Commits

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) format: `type(scope): description`. Types include `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`.

Breaking changes use the `BREAKING CHANGE:` footer (not the `!` suffix). This format is enforced by `commitsar` in CI and drives automated changelog generation via `release-please`.

## D86: 85% Coverage Gate

Every package must maintain **85% test coverage**, enforced in CI. This threshold was chosen as a balance between meaningful coverage and practical maintenance burden.

Additional quality requirements:
- Table-driven tests using subtests (`t.Run`)
- Race detector enabled (`go test -race`)
- Hot paths include benchmarks
- State machine verified by property-based tests (10k iterations on PR, 100k nightly)
- Shared test utilities declare `t.Helper()`

## D91: First-Production-Consumer Gate

v1.0.0 will not be tagged until a real production deployment runs against v0.5.x or later. This gate ensures that the API surface has been validated under real-world conditions before the interface freeze.

The v1.0 release also requires:
- GitHub organization acquisition complete
- Trademark review complete
- All 14 frozen interfaces stable for at least one minor release
- 85% coverage gate passing across all packages

## D92: DCO Sign-Off

Every commit requires a `Signed-off-by` line (via `git commit -s`), certifying the [Developer Certificate of Origin v1.1](https://developercertificate.org/). This replaces a Contributor License Agreement (CLA) -- inbound contributions are under the Apache 2.0 license.

DCO is enforced in CI. Commits without sign-off are rejected at the PR gate.

See [Contributing](/docs/contributing) for the full development workflow.

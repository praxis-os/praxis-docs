---
title: "State Machine Design"
description: "Key design decisions on the praxis invocation state machine: 14 states, transition allow-list, ApprovalRequired terminal state, goroutine model, and property-based invariants."
sidebar_label: "State Machine Design"
sidebar_position: 3
keywords: [state-machine, FSM, transitions, ApprovalRequired, goroutine, property-based-tests, invariants, D15, D16, D17, D24, D28]
rag_section: "design-decisions"
rag_packages: ["state"]
rag_interfaces: []
rag_difficulty: "intermediate"
---

# State Machine Design

These decisions define the invocation finite state machine -- the core runtime model of praxis.

## D15: Fourteen-State Machine

The invocation lifecycle is modeled as an explicit finite state machine with 9 non-terminal and 5 terminal states. This was chosen over a procedural loop because:

- State transitions are visible, testable, and auditable
- Invalid transitions can be detected and rejected at runtime
- Each state maps cleanly to telemetry spans and lifecycle events
- Property-based tests can verify the machine exhaustively

The machine is intentionally flat (no nested states) to keep reasoning simple.

## D16: Transition Allow-List

Only explicitly listed transitions are permitted. Any transition not in the allow-list causes a panic -- this is a framework bug, not a user error. The allow-list is the single source of truth for valid state flow.

This strict model means that adding a new state or transition requires updating the allow-list and passing all property-based tests. Accidental state corruption is impossible through the public API.

## D17: ApprovalRequired as Distinct Terminal State

Human-in-the-loop approval checkpoints get their own terminal state (`ApprovalRequired`) rather than being modeled as a special case of `Failed`. This decision was significant because:

- `ApprovalRequired` is not a failure -- it is an intentional pause point
- The invocation can be resumed after approval (with a resumption packet)
- Error handling code that catches `Failed` should not accidentally catch approval requests
- Metrics and alerts can distinguish between failures and approval checkpoints

## D24: One Goroutine Per Invocation

Each invocation runs on a single goroutine that drives the state machine loop. Tool calls within an invocation may execute concurrently via `errgroup`, but the state machine itself is single-threaded per invocation. This simplifies reasoning about state transitions and eliminates data races on the invocation state.

The orchestrator is safe for concurrent use -- multiple invocations run independently on separate goroutines.

## D28: Twenty-One Property-Based Invariants

The state machine is verified by 21 property-based invariants that run 10,000 iterations on PRs and 100,000 iterations in nightly CI. These invariants verify:

- Only allow-listed transitions are accepted
- Terminal states are truly terminal (no outbound transitions)
- Every non-terminal state has at least one path to a terminal state
- The tool-use cycle terminates (no infinite loops in the FSM)
- Cancellation is reachable from every non-terminal state

This level of verification provides high confidence that the state machine behaves correctly under arbitrary input sequences.

See [State Machine](/docs/core-concepts/state-machine) for the full state diagram and transition rules.

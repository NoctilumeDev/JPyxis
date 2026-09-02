# M0 Architecture Review Gate

Status: `FROZEN FOR M1 ENTRY`

Freeze coordinate: `m0-blueprint-v1`

This record closes the architecture-blueprint stage. It does not claim that a framework implementation, executable prototype, performance result, or clean-machine reproduction exists.

## Review outcome

M0 is accepted as a sufficiently bounded construction blueprint for M1. The architecture now names its problem, proof boundary, ownership, dependency direction, state machines, failure model, contract obligations, first reference slice, evidence policy, stop conditions, and non-binding evolution paths.

The review deliberately stops adding architecture surface. Further ideas enter M1 only when required by the accepted contract corpus or return to a later review as a separately justified change.

## Gate checklist

- [x] Project identity and current evidence boundary are visible on the README first screen.
- [x] Prior art is credited through primary specifications, project documentation, and original papers.
- [x] No novelty, production, performance, GPU, distributed, or reproducibility claim is inferred from diagrams.
- [x] Control, Definition, Runtime, Contract Core, and Host Application authority are distinct.
- [x] Every named persisted fact has one final authority.
- [x] Producer or reporter is distinguished from final authority.
- [x] Compile-time dependency direction is distinct from runtime request flow.
- [x] Core cannot import concrete plugin implementations.
- [x] Artifact, plugin-instance, deployment, and invocation state machines are separate.
- [x] Failure categories name their reporter, decision owner, and invariant.
- [x] The first reference vertical slice is fixed by [ADR-0004](../adr/0004-first-reference-vertical-slice.md).
- [x] M1 has a bounded question, corpus direction, acceptance conditions, and rejection signal.
- [x] M0-M6 delivery milestones are separate from E1-E5 evolution directions.
- [x] The single-node 16 GB target remains `INFERRED` until M6 measurements.
- [x] Repository verification checks required documents, local links, hygiene, boundary statements, and absence of framework implementation.

## Frozen invariants

M1 may refine representations, names, fields, and implementation structure. It may not silently change:

- role authority;
- one-fact/one-final-authority ownership;
- event-versus-state separation;
- immutable artifact identity and separate activation state;
- contract validation before accepted success;
- dependency direction toward Core-owned semantics and ports;
- Definition and Runtime denial of business authority;
- evidence states and claim boundaries;
- the single-node reference topology in ADR-0004.

Changing one of these requires a new ADR that names the affected evidence and reopens the relevant M0 review section.

## Deliberately deferred decisions

The following items do not block M0 because their decision belongs to a named later experiment:

| Decision | Owning stage |
| --- | --- |
| Canonical contract model versus Protobuf-descriptor profile | M1 |
| Exact Java mapper declaration or generation mechanism | M1 |
| Numeric, dynamic-shape, optionality, and compatibility policies | M1 |
| Authoritative timeout and cancellation race rule | M2 |
| Second Runtime conformance implementation | M3 |
| Durable persistence boundary for lifecycle evidence | M4-M6 |
| Payload threshold for a specialized data plane | M6 evidence before E1 |

Deferred does not mean unconstrained. Each decision must preserve the frozen invariants and meet its milestone acceptance test.

## M1 entry boundary

The next accepted work is contract design for `example.affine-batch`:

1. define the smallest canonical semantic model needed by the reference workload;
2. build a language-neutral acceptance corpus before transport code;
3. specify deterministic identity and compatibility verdicts;
4. specify Java and Python validator behavior;
5. reject untyped escape hatches and runtime-native public values;
6. record where Protobuf is carrier and where JPyxis semantics remain authoritative.

No M2 invocation implementation should begin until those M1 decisions and acceptance cases are reviewed.

## Evidence boundary

The freeze is represented by the protected Git tag named above, the public repository revision it resolves to, and a successful `Verify blueprint repository` check. The tag freezes documents, not runtime behavior.

## Post-freeze acceptance addendum

[ADR-0005](../adr/0005-first-verifiable-end-to-end-closure.md) was accepted after the M0 freeze to
make the first slice's evidence boundary explicit. It does not validate executable behavior, replace
the `m0-blueprint-v1` coordinate, or change the frozen role, topology, dependency, and state owners.
It requires M1 to specify the minimum evidence semantics and M2 to retain a bundle that an external
offline verifier can judge without trusting invocation success.

If implementing that boundary requires moving final authority into a plugin, exposing private process
state to the verifier, or changing an M0 invariant, the affected M0 section must be reopened under a
new decision rather than weakened through an M1 compatibility patch.

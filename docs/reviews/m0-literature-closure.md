# M0 Literature Closure

Status: `CLOSED · EVIDENCE ADDENDUM · NO SEMANTIC RE-FREEZE`

Closure date: 2026-09-03

This record closes the literature-evidence gap identified after the architecture freeze. It adds
traceability to `m0-blueprint-v1`; it does not change the frozen invariants, claim implementation,
or replace the M0 architecture review.

## Outcome

- 40 primary sources have stable local identifiers and evidence classes.
- The review scope, search boundary, inclusion criteria, synthesis method, and maintenance rule are
  recorded in the [Literature Review Protocol](../research/review-protocol.md).
- RQ1-RQ7 each identify supporting evidence, unresolved project hypotheses, and an owning milestone
  in [Research Evidence Traceability](../research/evidence-traceability.md).
- The [Prior-art Matrix](../research/prior-art-matrix.md) remains the comparative synthesis; the
  bibliography is no longer expected to carry that meaning by itself.

## Findings

The review found no basis for claiming invention of Java/Python interoperation, language-neutral
workers, Java-native inference, model serving, lifecycle operations, model registries, portable IR,
tensor exchange, RPC, plugin discovery, or build provenance. Those capabilities already have strong
primary baselines.

The unproven project hypothesis is narrower: whether a thin Core can preserve typed contract
meaning, one-final-authority state transitions, replaceable definition and runtime capabilities,
and attributable cross-layer failure while remaining simpler than direct established alternatives.

## M1 decision inputs

M1 must use this evidence to decide, rather than assume:

1. the smallest canonical semantic model for `example.affine-batch`;
2. which meaning belongs to JPyxis and which encoding belongs only to Protobuf;
3. numeric, shape, optionality, identity, and compatibility verdicts;
4. the public typed mapper surface and its rejection of unvalidated escape hatches;
5. exact upstream versions when a living document affects a decision;
6. control comparisons against direct gRPC and direct Java runtime use.

## Link-audit boundary

Repository-local links and required evidence markers are deterministic verification targets.
External link reachability was observed during this review but is not a hard CI gate: a transient
network route cannot invalidate repository structure, and an HTTP success cannot prove source
quality. Version-sensitive decisions must pin an upstream release, revision, or commit in their ADR
or experiment record.

## Freeze relationship

The protected coordinate `m0-blueprint-v1` continues to identify the original architecture freeze.
This addendum is deliberately additive evidence and causes no semantic re-freeze. A contradiction
that changes authority, ownership, dependency direction, state semantics, or the reference slice
requires a new ADR and reopens the affected M0 section.

The literature baseline is closed for M1 entry. JPyxis remains a blueprint-only repository until
later milestone evidence demonstrates implementation behavior.

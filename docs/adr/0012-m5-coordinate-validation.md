# ADR-0012: M5 Coordinate Validation Addendum

Status: `REVIEWED CONTRACT · PUBLICATION GATE REQUIRED · IMPLEMENTATION NOT QUALIFIED`

## Context

The [retained productization audit](../reviews/productization-reference-path-audit-review.md)
falsified the assumption that the existing public M5 consumers completely validate their operands.
At audit base `9632a4f45c2190da6440e455667090fdd88e4a69`, changed attempt epoch and policy copies
were accepted as success, and a foreign returned worker handle could become eligible under the
requested identity. The first receipt remains immutable. The accepted audit publication is main
`11e13099a9b81cf019844c8e4d1d1786ed913c53`; it contains no runtime repair.

[ADR-0010](0010-m5-resilience-authority-and-recovery.md) already assigns validation and decisions
to Control owners. A wrapper cannot close an obligation at public M5 entrances that it does not
control. This addendum therefore reopens only returned-handle admission, retained-plan validation,
and their recovery/late-report treatment within those owners.

## Decision

Adopt the [coordinate-validation contract](../spec/m5-coordinate-validation-contract.md) as a
versioned clarification of the M5 owner boundary. Preserve the original M5 profile, review, manifest,
and tag as historical bounded qualification. Their green fixture evidence does not prove the newly
exposed guards. An additive review record carries the new contract and later implementation evidence.

The retained logical request remains the sole policy authority. A plan's idempotency mode and scope
are copies that must agree with that request; they cannot grant a retry. Worker identity consists of
worker, instance, and originating Control epoch. Process identifiers and current liveness state are
observations, not substitute identity or equality requirements for historical reports.

Full-plan observations must be validated before either normal admission or late association. Replay
preserves each historical attempt's originating identity, fences live eligibility in the new epoch,
and continues to use the retained request and immutable budget. The association-only late API cannot
establish submitted worker provenance and cannot authorize execution or a new decision.

## Qualification and exclusions

Contract acceptance and runtime qualification are separate gates. This documentation change carries
no runtime implementation. Only a protected merge, exact-main predecessor gates, and independent
artifact readback may freeze this contract for the separate guard implementation. Guard qualification
then needs the directed matrix plus the unchanged predecessor gates and its own exact-main readback.

No new lifecycle state, retry mode, journal authority, worker adoption, general cleanup guarantee,
M2/M4 association, Environment identity, Runtime product, scheduler, resource grant, or façade is
introduced. A broader contradiction must be classified before extending this boundary.

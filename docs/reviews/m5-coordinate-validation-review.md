# M5 Coordinate Validation Review

Status: `REVIEWED CONTRACT · PUBLICATION GATE PENDING · RUNTIME GUARDS NOT QUALIFIED`

## Review scope and disposition

Contract base: `11e13099a9b81cf019844c8e4d1d1786ed913c53`. The original
[M5 review](m5-resilience-review.md), `m5-resilience-v1`, and its immutable manifest remain historical
qualification of the declared fixtures. This record reopens only their complete-public-coordinate-
validation expectation. It does not erase first failures or infer implementation from documentation.

The reviewed public APIs, accepted-request owner, retained attempts, `samePlan`, terminal bypass,
Supervisor start/probe consumers, replay constructors, and ADR-0010 support the
[addendum](../spec/m5-coordinate-validation-contract.md). An outer guard is insufficient because
the public owners remain callable without it. Field-by-field identity and provenance checks within
those owners are the selected minimum disposition. Whole-snapshot equality is rejected because PID
and live state change during fencing and are not retained historical identity.

Idempotency remains accepted-request policy. Comparing its copied plan fields checks provenance;
it does not move policy authority to an attempt. Valid historical reports compare to the historical
reservation, whereas new reservations require the current qualified epoch. The association-only
late API cannot claim a submitted worker tuple it never receives.

## Round record

| Required record | Contract round |
| --- | --- |
| Did | Bound the published audit, reread public M5 consumers and frozen ownership, specified equality/admission/recovery rules and the directed implementation matrix. |
| Why | Repair the falsified premise through an explicit minimal contract before changing runtime behavior. |
| Original plan | Consider an outer composition guard or reopen the affected M5 expectation. |
| Actual | Select an additive M5 owner-boundary contract; no runtime code, fixture, dependency, gate threshold, or old freeze manifest changed. |
| Failed premise | Existing full-plan/returned-handle consumers already enforce every carried coordinate. The original receipt remains the witness. |
| Final state | Reviewable candidate contract. Public gates, protected merge, and exact-main artifact readback for this contract are pending. Runtime guards and productization remain unqualified. |
| Next authority | Once this contract's protected publication and exact-main readback close, implement only its directed guards in a separate branch/PR. Then qualify that implementation and rerun audit A. |

## Contract publication gate

Local repository hygiene and immutable first-receipt readback are required before publication.
Both required public jobs rerun the unchanged M1-M5 and M6 matrices. Downloaded M5/M6 artifacts
must pass the independent verifiers, all eight M6 mutations must retain their declared non-PASS
verdicts, source revisions must bind the executed PR merge and exact main, and runtime shutdown
must be observed. Green CI alone does not freeze the contract or qualify its runtime obligations.

The later implementation record must retain this contract's head, PR, executed merge revision,
protected merge, main run, artifact IDs/hashes, and independent readback before claiming entry.
A versioned protected annotated contract tag may then bind the accepted main; old tags are not moved.

Local verification on the contract-only working candidate passed on 2026-10-01: repository hygiene,
`git diff --check`, immutable first-receipt readback against base main, the existing 15 Java M5 tests,
12 executable M5 scenarios, all four declared evidence-mutation verdicts, and offline M5 bundle
readback. Host process inspection found no remaining M5 worker. This does not execute the new
directed matrix against repaired guards; no runtime source has changed.

## Explicitly outstanding

The directed matrix has not run against repaired code. No real M2/M4/M5 path, pre-dispatch lifecycle
association, Environment construction, cleanup guarantee, Spring entry, or product verdict is
established. The original audit STOP remains effective until the separate qualified repair and a
fresh audit disposition.

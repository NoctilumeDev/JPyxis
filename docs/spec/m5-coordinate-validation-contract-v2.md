# M5 Coordinate Validation and Owner Effect Contract v2

Status: `ACCEPTED v2 · CONTRACT ONLY · GUARD IMPLEMENTATION PENDING`

This contract belongs to [ADR-0012](../adr/0012-m5-instance-identity-conservation.md) and the
[v2 review](../reviews/m5-coordinate-validation-review-v2.md). It supersedes the unmerged PR #19
candidate. It conserves M5 instance identity through admission and the next state owner's effect;
it does not establish M2/M4/M5 productization continuity.

## Operands and retained authority

| Operand | Authority | Consumer obligation |
| --- | --- | --- |
| Logical invocation ID | Manager's accepted-request map | Resolve one existing logical invocation; caller text is not acceptance. |
| Attempt ID and number | Manager's retained reservation | Resolve an attempt of that invocation and compare its number. |
| Logical trace ID | Accepted `InvocationRequest` | Full-plan trace equals the retained request trace; operation/context traces may differ. |
| Worker ID, instance ID, originating Control epoch | Supervisor at reservation, then retained attempt | Full-plan tuple equals that reservation. Instance-name spelling cannot replace explicit epoch comparison. |
| Idempotency mode and deduplication scope | Accepted `InvocationRequest` | Full-plan copies agree, including `NONE` and its empty scope. Copies never authorize policy. |
| Maximum attempts | Accepted `InvocationRequest` | Existing immutable bounded budget governs normal/recovered decisions; no report increases it. |
| Worker state and PID | Supervisor/capability observations | Eligibility is required at reservation and positive PID shape at handle return. State/PID are not full-plan historical identity equality; replay can have fenced state and PID zero. |

Presence/type shape alone is insufficient. Null or malformed full-plan operands fail closed with
typed input rejection rather than incidental dereference or decision admission. Existing typed
not-found errors remain valid for unresolved logical IDs. Public record layouts need not change.
Manager and Supervisor share one nonblank current epoch; an assembly mismatch fails with
`CONTROL_EPOCH_MISMATCH` before accepting invocations or making recovery decisions.

## Returned-handle admission

Supervisor retains requested `(workerId, instanceId, controlEpoch)` before `WorkerControl.start`.
Returned values must match all three before installing the handle, recording a qualified pin,
probing it or routing work. A malformed or foreign return is an observation followed by a
Supervisor-owned rejection with `WORKER_COORDINATE_MISMATCH`. The requested entry becomes `FAILED`
without adopting the handle or its PID; a healthy Boolean cannot override rejection.

Retain requested and returned tuples separately. Capability events cannot declare `ELIGIBLE`.
Do not pass a foreign handle to `stop` as though it belonged to the request, or infer that any foreign
process stopped. This guard establishes admission only; it does not prove orphan reclamation or a
general cleanup guarantee. Honest starts/probes retain their existing sequence and observations.

## Full-plan observation admission

Before recording accepted `ATTEMPT_OBSERVED` or `LATE_ATTEMPT_OBSERVED`, applying an observation,
affecting a worker, considering retry or committing logical terminal state, Manager compares all
identity and policy-copy operands above with its retained request/reservation. Terminal state does
not bypass this validation. Comparison uses the attempt's originating epoch, not current worker
health, PID or a later Control epoch.

A mismatch yields `ATTEMPT_COORDINATE_MISMATCH` and a Manager-owned rejection diagnostic naming
fields and retained/submitted coordinates without `newState`. It is not an accepted capability
observation. Rejection preserves invocation state, policy, history, budget, worker state, digest and
terminal decision. Failure to append a required diagnostic cannot permit admission. Existing
nonterminal current-attempt/duplicate rules remain; a matching historical terminal report is late
and ignored, without becoming new execution authority.

The terminal-only `recordLateObservation(logicalInvocationId, attemptId, observation, context)` API
has association IDs but no submitted worker/policy tuple. Retained diagnostics identify this
association-only provenance. It cannot substitute for full-plan validation at execution admission,
authorize retry, modify worker eligibility, or replace terminal state.

## Instance-scoped owner effects

An observation arising from an attempt is scoped to its retained originating
`(workerId, instanceId, controlEpoch)`. Manager carries that tuple to Supervisor for any worker-state
effect; it must not call the worker-ID-only action or first check a snapshot and later mutate by ID.
This applies to failure, unknown and exit-derived observations, including future branches with the
same meaning. It does not give all conclusive failures a new eligibility effect where none exists.

Supervisor compares the originating tuple with its current entry inside its synchronized/atomic
state ownership boundary. If liveness work occurs outside that boundary, it must compare again at
the actual apply boundary. Identity continuity cannot be decided by a capability's Boolean or a
stale caller snapshot.

- For a matching tuple, preserve existing instance-failure behavior and stopped/stopping protections.
  Authoritative transition is durable before its in-memory publication.
- For a superseded tuple, retain a Supervisor-owned diagnostic with originating/current tuples and
  stable reason `SUPERSEDED_WORKER_INSTANCE`, with no state transition. Preserve the replacement's
  state, eligibility, PID and handle. Do not probe or stop an unqualified originating handle as a
  current binding. A previously started health check is only a report about its captured instance.
- Rejection of the effect is not rejection or promotion of the old logical observation. Manager
  still decides success/failure/unknown and retry/budget using that old attempt and retained request.
  In particular a non-idempotent unknown still becomes `OUTCOME_UNKNOWN`, not inferred success.
- Intentional logical-worker-wide operator/Control actions remain distinct. The existing worker-ID
  action may retain that meaning, explicitly identified in diagnostics. It cannot be used by an
  attempt report to widen scope. This contract introduces no security-principal or access-control
  mechanism; it fixes the public semantic call and ownership boundary.

## Existing Manager-to-Supervisor paths

| Path at the contract base | Existing effect | Required v2 treatment |
| --- | --- | --- |
| `prepareAttempt` | Select eligible current worker; reserve tuple | Common current epoch and eligible selection; no old tuple becomes current eligibility. |
| Normal unknown observation | `observeFailure(workerId, ...)` | Replace this attempt-originated call with a tuple-bearing instance-scoped owner call. |
| Normal success / failed-before / failed-after | Logical decision only | Preserve existing absence of worker mutation; preserve policy/budget. |
| Full-plan terminal / association-only late report | Retain/ignore logical report | No worker mutation or terminal rewrite; distinguish provenance. |
| Manager recovery `applyObservation` | Recovered logical retry/terminal decision | Preserve historical tuple/policy and absence of direct worker mutation; no poisoning a new instance. |
| Supervisor recovery | Fence historical live eligibility | Existing owner establishes the new epoch; historical observations cannot restore eligibility. |

The reference assembly's explicit warmup/drain fault actions and start/probe/stop commands are not
Manager attempt reports. Their legitimate Control scope remains separate. Review must inventory
every Manager call and every newly added observation route rather than patch only one enum case.

## Replay, new epoch, and late reports

Journal chain integrity remains the prerequisite. Replay preserves accepted request policy and each
reservation's historical tuple. A reservation's worker epoch agrees with its originating event's
Control epoch; dispatch copies of worker identity, number, mode and scope agree with the retained
reservation/request. The legacy dispatch record does not carry a second worker-epoch field; its
originating event epoch and retained reservation supply that existing check without inventing one.
Any added epoch copy must agree too. Inconsistent retained tuples fail with typed journal/replay
rejection before logical recovery decisions; this is not a new general event-language validator.

Recovery may replay old epochs but never equates them to the new current epoch. New reservations
require newly qualified current instances; historical reports keep their originating identities.
Missing observations after durable dispatch remain unknown, `NONE` never retries, deduplication
requires accepted scope and remaining budget, and pre-dispatch recovery remains distinct. Rejection
diagnostics and late reports never replay as accepted observations. A valid old-epoch late report
cannot gain current eligibility, poison a replacement or rewrite terminal state.

## Directed matrix for the separate implementation

| Case | Required witness |
| --- | --- |
| Honest start/plan | Qualified start and one unchanged success. |
| Plan worker/instance/epoch separately | Typed rejection before accepted observation/state/retry. |
| Plan trace/number/malformed presence | Typed rejection and identified field, no incidental exception. |
| Mode change and same-mode scope change | Provenance rejection; retained policy and budget unchanged. |
| Foreign start worker/instance/epoch separately | Failed admission, no adopted pin/probe/routing, requested/returned diagnostics. |
| Foreign full plan after terminal | Rejected before late admission; terminal/digest unchanged. |
| Matching historical terminal plan / changed state or PID | Retained late/ignored despite changed liveness observations; no second decision. |
| Association-only late API | Explicit weaker provenance, terminal-only, no eligibility/retry/decision effect. |
| Same-tuple failure/unknown | Existing current-instance ineligibility and correct logical policy outcome. |
| Superseded old success / failed-before / failed-after / unknown | Orthogonal logical outcomes; replacement's tuple/state/PID/handle conserved. |
| Replacement between check and apply | Deterministic interleaving proves owner-boundary recheck prevents stale effect; no timing-only sleeps. |
| Worker-wide intentional action | Existing legitimate worker action works independently and has explicit scope. |
| Manager/Supervisor epoch mismatch | Assembly rejection before authoritative invocation/recovery activity. |
| Inconsistent replay identity or policy copy | Fail before logical recovery decision; retain the first malformed candidate. |
| Valid new-epoch recovery and old historical report | Old policy/history retained, new eligibility fenced, unknown/budget semantics preserved. |
| Deduplicated unknown, budget exhausted, `NONE` failure | Existing bounded retry/denial retained in normal/recovery paths. |
| Required diagnostic append failure | Fail closed without unauthorized transition or accepted decision. |

Tests assert absence of accepted observations and wrong-owner/foreign-instance transitions, not just
exception labels. Existing M1-M5 matrices, M6 clean baseline, hygiene, retained evidence/mutations and
shutdown remain gates. Guard qualification needs its own protected merge and exact-main readback.
Only then rerun productization audit A; closing these guards alone does not close real continuity.

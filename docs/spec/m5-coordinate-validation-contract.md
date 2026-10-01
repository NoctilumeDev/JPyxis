# M5 Coordinate Validation Contract

Status: `REVIEWED v1 · CONTRACT ONLY · GUARD IMPLEMENTATION PENDING`

This addendum belongs to [ADR-0012](../adr/0012-m5-coordinate-validation.md). It narrows the exposed
validation obligation of [M5](m5-resilience-profile.md); it does not close the productization audit.
The [review record](../reviews/m5-coordinate-validation-review.md) separates contract acceptance,
guard implementation, and subsequent audit A.

## Operands, owners, and equality

| Operand | Authority | Required validation | Meaning excluded from equality |
| --- | --- | --- | --- |
| Logical invocation ID | Manager's accepted-request map | Submitted ID resolves one accepted invocation; it cannot select a different request's policy. | Caller text alone is not acceptance. |
| Attempt ID and number | Manager's retained reservation | ID resolves an attempt of that invocation and number equals that reservation. | A caller cannot create or consume another attempt. |
| Logical trace ID | Accepted `InvocationRequest` | Full-plan trace equals the retained request trace. | The current event/context trace may identify a later operation. |
| Worker ID, instance ID, worker epoch | Supervisor at reservation; retained attempt thereafter | Full-plan tuple equals the reserved tuple. New reservations use an eligible instance in the Manager/Supervisor's common current epoch. | Instance-name spelling does not replace explicit epoch comparison. |
| Idempotency mode and deduplication scope | Accepted `InvocationRequest` | Full-plan copies equal the retained mode and scope, including the empty scope of `NONE`. | Copies never grant policy; retry still uses the retained request. |
| Maximum attempts | Accepted `InvocationRequest` | Existing immutable bounded budget remains authoritative during normal decisions and recovery. | No plan or observation can increase it. |
| Worker state and PID | Supervisor/capability observations | Eligibility is required at reservation; returned handle PID retains its existing positive-shape rule. | Neither current state nor PID is full-plan identity equality; replay may have PID zero and a fenced state. |

Presence and type shape are necessary but insufficient. Null or malformed nested operands must fail
closed at the consumer with a typed input rejection rather than an incidental dereference or accepted
decision. Existing typed not-found errors remain valid for unresolved logical IDs. This contract does
not require changing public record layouts or rejecting all constructed values at their constructors.

## Worker-handle admission

1. Supervisor retains the requested `(workerId, instanceId, controlEpoch)` before `WorkerControl.start`.
2. The returned handle must match all three values before it is installed, used for a health probe,
   offered to routing, or published as a qualified handle.
3. A mismatch is a capability observation followed by a Supervisor-owned rejection with stable code
   `WORKER_COORDINATE_MISMATCH`. The requested worker becomes `FAILED`, with no adopted handle and
   no published PID from the rejected operand. `selectEligible` cannot route it.
4. Diagnostics retain requested and returned coordinates separately. No capability event declares
   `ELIGIBLE`, and no rejection event claims a foreign process has stopped. The foreign handle must
   not be passed to `stop` as though it belonged to the requested instance. Resource reclamation or
   orphan adoption is not established by this guard; the capability remains responsible for its
   allocation observations and normal assembly shutdown.
5. A healthy Boolean cannot override admission failure. Existing honest starts and probes retain
   their current state sequence and positive PID observations.

## Full-plan observation admission

Manager validates the table's full-plan tuple before recording an accepted `ATTEMPT_OBSERVED` or
`LATE_ATTEMPT_OBSERVED`, applying the observation, changing worker eligibility, considering retry,
or committing a logical terminal decision. The terminal branch cannot bypass this check.

An unequal or malformed plan produces `ATTEMPT_COORDINATE_MISMATCH`. A Manager-owned diagnostic
records the rejected field names and retained/submitted coordinates without `newState`. It is not
an accepted capability observation. Rejection leaves invocation state, accepted policy, attempt
history, retry budget, worker state, result digest, and prior terminal decision unchanged. Failure
to retain a required diagnostic must also fail closed; it cannot permit admission.

For a nonterminal invocation the existing current-attempt and duplicate-observation rules still
apply. For a terminal invocation a matching earlier attempt may be retained as late and ignored.
Validation uses that attempt's reserved epoch, not the Supervisor's current epoch or health; a valid
historical report does not become an eligible worker or a new execution authorization.

`recordLateObservation(logicalInvocationId, attemptId, observation, context)` resolves existing
association IDs and requires a terminal invocation. It supplies no worker/policy tuple and therefore
proves only report association, not full submitted-plan provenance. Its retained diagnostic must
identify this association-only mode. It cannot change a terminal decision, authorize retry, or
replace a validated full-plan admission at an execution boundary.

## Current epoch and recovery

- Manager and Supervisor must have the same nonblank current Control epoch at assembly, including
  recovery. An assembly mismatch fails before accepting invocations or recording recovery decisions.
- Durable journal integrity remains the existing journal's prerequisite. Replay retains accepted
  request policy and each reservation's worker tuple. A reservation's worker epoch must agree with
  the originating reservation event's Control epoch; dispatch identity/policy copies must agree with
  the retained request and reservation. An inconsistent retained tuple is rejected before recovery
  applies observations or commits retry/terminal decisions. This is a coordinate check, not a new
  general event-language or production-store validator.
- Recovery may replay old epochs without equating them to the new epoch. It resets live eligibility
  through the existing Supervisor owner; a new attempt requires a new qualified current instance.
- Missing observations after durable dispatch remain unknown. `NONE` still denies retry, accepted
  deduplication still consumes a new identity and remaining budget, and the pre-dispatch recovery
  distinction remains unchanged. No success is manufactured from a recovered tuple.
- Rejection diagnostics and late association reports do not become accepted observations on replay.
  Valid late reports from an old attempt remain late after recovery and cannot rewrite its logical
  terminal state.

## Directed acceptance matrix for the separate implementation

| Case | Required witness |
| --- | --- |
| Honest plan/start | Qualified start and one unchanged logical success. |
| Attempt worker/instance/epoch substitutions separately | Typed rejection before observation/state/retry; retained tuple unchanged. |
| Plan trace/number/presence substitutions | Typed rejection with identified field; no incidental exception or authoritative decision. |
| Mode substitution and same-mode scope substitution | Typed provenance rejection; retained policy and budget unchanged. |
| `NONE` failure/unknown and deduplicated retry/budget | Existing denial/authorization semantics preserved, including recovery. |
| Foreign start worker/instance/epoch separately | `FAILED`, no handle pin/probe/routing, separate tuple diagnostic, no foreign stop claim. |
| Foreign full plan after terminal | Rejected before late admission; terminal/digest unchanged. |
| Matching old attempt after terminal | Retained late/ignored; no second terminal, including after a new Control epoch. |
| Changed PID/state in a matching historical plan | Does not substitute tuple identity or invalidate legitimate association. |
| Association-only late API | Explicit weaker provenance, terminal-only, no decision/retry change. |
| Current Manager/Supervisor epoch mismatch | Assembly rejected before authoritative invocation/recovery activity. |
| Replay coordinate inconsistency | Rejected before recovery decision; first malformed candidate retained. |
| Valid replay | Old identity/policy preserved, new eligibility fenced, unknown and budget rules unchanged. |

Directed tests must assert absence of accepted observation and unauthorized owner transitions, not
only an exception string. Existing M5 executable/mutation matrices, M1-M4 suites, M6 clean baseline,
and independent retained-artifact verifiers remain gates. Passing this matrix repairs only these M5
guards. Audit A must run again from the newly qualified exact main before any product contract.

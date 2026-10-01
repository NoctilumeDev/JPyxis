# M5 Superseded-Instance Failure Counterexample

Status: `STOP_NEW_MODEL_COUNTEREXAMPLE · CONTRACT FREEZE BLOCKED · NO RUNTIME REPAIR`

Client review date: 2026-10-01. Runtime source base:
`11e13099a9b81cf019844c8e4d1d1786ed913c53`. Contract candidate head:
`3960255e4324c0396ec58991c570526a18bced0d`.

## Disposition

A complete full-plan comparison is insufficient to conserve worker-instance identity through the
following owner effect. Manager admits an unmodified historical plan, then forwards an unknown
outcome to Supervisor using only `workerId`. Supervisor acts on that worker's current entry, which
can already represent a different healthy instance. The first public-model probe reproduced a
transition of the replacement instance from `ELIGIBLE` to `INELIGIBLE` under the old attempt's fault.

This is a second model-level boundary counterexample. It is not a submitted-plan substitution,
an unauthorized retry, success promotion, a real process leak, a production exploit, or proof of
an actual computation. The logical outcome remains the correct `OUTCOME_UNKNOWN` under accepted
`NONE`; the incorrect effect is the old instance's failure being assigned to the new instance.

The user's continuation instruction explicitly requires stopping on another model-level
counterexample. The candidate contract is therefore not frozen and runtime implementation does not
begin. [PR #19](https://github.com/NoctilumeDev/JPyxis/pull/19) was made a draft at this first STOP,
retaining its exact initial head and green CI as historical observations. It has no protected merge, exact-main readback, tag,
or guard-entry qualification. Current main remains the audit publication base above.

## Exact public path

- `ResilientInvocationManager.recordObservation` resolves the retained invocation and attempt.
  For `UNKNOWN_REMOTE_OUTCOME` it calls `supervisor.observeFailure(attempt.worker.workerId(), ...)`.
- `WorkerSupervisor.observeFailure` resolves the current entry by logical worker ID, probes its
  current handle, and transitions that entry to `INELIGIBLE`. It receives no originating instance
  or epoch and cannot distinguish the old observation from a report about the replacement.
- No submitted operand was changed. Comparing every carried plan field would still admit this
  valid plan and would not supply the missing identity to the next owner.
- ADR-0010 and the M5 profile separate logical invocation state from worker-instance state and give
  each started instance a fresh identity. A healthy current-instance probe does not establish that
  an earlier attempt's fault belongs to it.

## First retained run

The [receipt](../../evidence/productization-audit/first-instance-failure/receipt.json) has SHA-256
`969d63ff66c181e5a902bf0dea35af34aa704b2286261ca4af2581d38ebc11b4`.
Java 17 compiled a fresh class directory. Every compiled predecessor was bound to its exact-base
Git blob before compilation; each case ran in a fresh JVM. No Maven target, installed binding,
Runtime, carrier, Python process, or reused class directory participated.

The capability reports synthetic health through the public port, and the journal is an in-memory
public-port implementation. Replacing the first instance uses only public Supervisor operations:
`observeFailure`, `start`, and `probe`. These operations are permitted by the existing state machine.
The probe does not claim that any operating-system process was started, stopped, or adopted.

| Case | First observed result | Probe exit |
| --- | --- | --- |
| `same_instance_failure_control` | A current-instance unknown outcome makes that same instance ineligible; logical unknown and no retry. | 0 |
| `replacement_success_control` | A valid old-instance success produces logical success while the replacement remains eligible. | 0 |
| `replacement_instance_failure` | A valid old-instance unknown outcome makes the healthy replacement ineligible; logical unknown and no retry. | 2 |

For the failing case the attempt pins `worker-a@epoch-1-1`; the before/after current entry pins
`worker-a@epoch-1-2`. The retained `WORKER_FAILURE_OBSERVED` records `processAlive=true`, then the
Supervisor-owned `WORKER_INELIGIBLE` names instance 2 with the old attempt's fault code. The
current capability remains healthy after this transition. The report is delayed within an open
logical invocation, rather than the terminal-only late-report API.

Raw stdout/stderr and compile outputs are retained as binary bytes alongside the exact probe and
first harness. Their archive mapping is in
[retention.json](../../evidence/productization-audit/first-instance-failure/retention.json).
The first receipt and first output directory are never overwritten or recomputed.

Committed storage at `4441d9e82ad821f6c6e729757eaeba340bd8479c` passed both the new instance-probe
readback and the unchanged original coordinate-probe readback. The
[storage record](../../evidence/productization-audit/first-instance-failure/storage-readback.json)
retains that narrower result and the unchanged original checkout hashes.

Read back immutable committed storage with:

```text
node experiments/productization-audit/verify-instance-receipt.mjs <retention-commit-sha>
```

`VERIFIED` here means storage and parsed observations agree; the model audit still stops.
To reproduce in a fresh checkout containing these records, create `build/coordinate-contract`, copy
the archived `InstanceFailureProbe.java` there, copy `first-runner.mjs` there as
`run-instance-probe.mjs`, and run `node build/coordinate-contract/run-instance-probe.mjs`. The runner
refuses an existing first-output directory and verifies the base blobs before compilation.

## Minimum proposed review boundary

Reopen the instance/epoch association of the Manager-to-Supervisor attempt-failure report in addition
to returned-handle and full-plan admission. The proposed obligation is: a valid old attempt may
retain its logical observation and policy outcome, while an instance-scoped failure can affect only
the Supervisor binding with the same worker/instance/epoch tuple. A superseded tuple must retain a
diagnostic and leave the replacement's eligibility unchanged. Supervisor must make this comparison
at its owner boundary; a caller-side snapshot check alone is vulnerable to replacement between
checking and applying the effect.

This proposal has not been accepted or implemented. Review must distinguish instance-scoped attempt
failure from an intentional logical-worker-wide operator action. It must also preserve unknown
outcomes, existing retry/budget semantics, recovery fencing, and valid historical reports. No new
cleanup, scheduling, adoption, lifecycle, Environment, or Runtime authority is requested.

## Round record

| Required record | This round |
| --- | --- |
| Did | Published the minimal contract candidate as PR #19, observed both required jobs succeed, examined the follow-on owner effect, and retained the first three-case public-model probe. |
| Why | Determine whether the proposed minimum contract actually conserves instance identity through the complete decision path. |
| Original plan | Qualify/freeze the coordinate contract, then implement its directed guards separately. |
| Actual | An unmodified plan still causes an effect on a different instance. Contract qualification stopped before merge/readback/tag. PR #19 became a draft. |
| Failed premise | Full-plan admission and returned-handle checks alone close the affected M5 instance-identity boundary. |
| Final state | New model counterexample retained; no runtime repair, contract freeze, guard qualification, or productization advance. Original audit failures and dirty checkout remain preserved. |
| Next authority | User review of the proposed additional instance-scoped failure-report boundary. No automatic expansion or implementation while this STOP is effective. |

## Reviewed disposition and separate publication

The continuation review accepted this as the same bounded M5 instance-identity conservation
obligation, rather than a new product direction. Its disposition is to publish this second failure
first, close PR #19 as superseded without merging it, then draft contract v2 from the newly qualified
exact main. The subsequent contract must carry the originating worker/instance/epoch through the
Manager-to-Supervisor boundary and require comparison within Supervisor's atomic state ownership.
Caller-side snapshot comparison cannot replace that owner check. Runtime remains a later gate.

The publication branch starts directly from main
`11e13099a9b81cf019844c8e4d1d1786ed913c53`. It copies only this report, the exact first probe/receipt
archives, their storage verifier, and the original audit's minimal reference. It does not copy
ADR-0012, the candidate coordinate contract or its review. Original local commits
`4441d9e82ad821f6c6e729757eaeba340bd8479c` and
`f78287156a124c2799c6d12aca9ff19caf328a9d` remain preserved as provenance of the first capture and
storage observation, although they descend from the unaccepted candidate. The copied bytes and
runtime source binding do not change.

[PR #20](https://github.com/NoctilumeDev/JPyxis/pull/20) is the separate audit-only publication.
PR #19 was closed unmerged at `2026-10-01T10:01:17Z` as superseded by this counterexample; its remote
head remains `3960255e4324c0396ec58991c570526a18bced0d`. This is not a failed runtime implementation
or an accepted contract. The [supersession record](../../evidence/productization-audit/pr19-supersession.json)
retains the candidate and replacement coordinates.

| Required record | Second-publication round |
| --- | --- |
| Did | Reconstructed a main-based audit-only diff while preserving the candidate, original local commits and first observations. |
| Why | Publish the second model fact without importing a contract that the fact showed to be incomplete. |
| Original plan | Freeze the initial contract after its green run. |
| Actual | Preserve that candidate as superseded and publish the new fact independently before contract v2. |
| Failed premise | Operand admission alone conserves identity through subsequent owner effects. |
| Final state | Reviewable second audit publication; required checks, protected merge and exact-main artifact readback are pending. No runtime or contract promotion. |
| Next authority | After publication qualifies, draft only contract v2 for admission, replay/late reports and instance-scoped owner-effect continuity. |

## Completed publication readback

PR #20 protected-merged to main `54846ec612ff00417d73052e9f4fb0f0edc602a7`. Required PR run
`36846602653` and exact-main run `36847395525` both succeeded. Downloaded M5/M6 bundles passed
independent verification, all eight M6 mutations retained their declared non-PASS verdicts, the
resource predicate was accepted and recorded runtime processes had exited. Both first model receipts
also passed immutable Git-blob storage readback. The
[publication manifest](../../evidence/productization-audit/publication-second.json) retains source,
parents, tree, runs, artifact IDs and readback hashes. The original local capture branch is also
retained remotely; its unaccepted contract remains outside main.

Only the second counterexample's publication is qualified. Runtime guards, contract freeze and
productization audit A are not promoted. The separately reviewed minimum now permits
[contract v2](m5-coordinate-validation-review-v2.md) construction from that exact main.

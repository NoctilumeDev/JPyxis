# M4 Lifecycle Review

Status: `FROZEN FOR M5 ENTRY`

M4 is accepted only for the bounded single-process lifecycle claim described by
[ADR-0009](../adr/0009-m4-lifecycle-authority-and-cutover.md) and the
[M4 Lifecycle Profile](../spec/m4-lifecycle-profile.md). It does not widen the frozen M1-M3 claims.

## Implemented boundary

- one Registry-owned immutable artifact identity, content, digest, and validation state;
- one Deployment-Manager-owned state machine and active binding per slot;
- one narrow Runtime lifecycle capability for load, warm, and unload observations;
- slow capability calls outside the state lock;
- precondition-checked, lock-protected active-version cutover;
- immutable invocation pins that preserve accepted drain obligations;
- explicit separation between a lifecycle forced-termination requirement and an Invocation Manager
  terminal outcome;
- rollback through a new deployment of a previously validated artifact coordinate;
- retained owner-tagged transition evidence and an offline verifier independent of the Java process.

The M4 module does not depend on the M2/M3 invocation module. The invocation module also does not
depend backwards on lifecycle. Their future composition must occur in a Control assembly through the
two stable boundaries rather than by merging state ownership.

## Acceptance matrix

| Scenario | Accepted observation |
| --- | --- |
| `activate_v1` | validated v1 reaches `ACTIVE` through the complete transition sequence |
| `unvalidated_artifact_rejected` | a registered but unvalidated artifact creates no deployment fact |
| `artifact_identity_conflict` | conflicting bytes cannot replace an existing identity or digest |
| `warm_failure_preserves_active` | v2 becomes `FAILED`, releases its handle, and leaves v1 active |
| `activation_precondition_preserves_active` | an unwarmed candidate cannot change the active binding |
| `atomic_cutover_and_pinning` | old work remains on v1, new work enters v2, and drained v1 retires |
| `draining_rejects_new` | no new work enters a draining slot while accepted work completes |
| `forced_termination_defined` | timeout precedes a recorded termination requirement and then unload |
| `rollback_immutable` | rollback creates a new v1 deployment with the original bytes and digest |
| `bundle_missing` | missing required lifecycle evidence is `INCONCLUSIVE` |
| `bundle_corrupt` | changed artifact bytes are `FAIL` |

## Verification

The final local candidate ran, in order:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
node scripts/verify-m2.mjs
node scripts/verify-m3.mjs
node scripts/verify-m4.mjs
node scripts/verify-m4-evidence.mjs build/m4
```

Observed results:

```text
M1: 38 cross-binding cases PASS
M2: 24 invocation and evidence cases produce their declared verdicts
M3: 10 Runtime and evidence cases produce their declared verdicts
M4: 9 executable lifecycle cases PASS
M4: missing bundle evidence INCONCLUSIVE
M4: corrupt artifact evidence FAIL
M4 retained evidence: PASS
Java lifecycle tests: 8 tests, 0 failures, 0 errors, 0 skipped
Concurrent activation/admission test: 10 repeated local runs PASS
```

The PR and merged-main M4 artifacts were downloaded separately after both Java processes had exited.
Both passed the offline verifier and their `conformance-summary.json` files had the same SHA-256:

```text
206b7478d8cb94988b855482f9310d79fff5d31d04663a95f2664462324b575e
```

## Authority and dependency review

- `ArtifactRegistry` alone changes artifact state and returns defensive content copies;
- `DeploymentManager` alone changes deployment state, active bindings, and drain accounting;
- lifecycle capability reports contain no authoritative previous/new state;
- a Runtime handle contains only generic provider coordinates and an opaque handle;
- a forced pin release is named `FORCED_TERMINATION_REQUIRED`, not an invocation success or failure;
- the lifecycle Core imports no reference fixture, evidence encoding, gRPC, Protobuf, Spring, Python,
  NumPy, ONNX Runtime, Torch, host API, or invocation implementation;
- the frozen invocation module imports no M4 lifecycle implementation;
- no database, queue, durable recovery, scheduler, supervisor, or M5 implementation entered M4;
- M1-M3 tags, review records, and evidence manifests remain unchanged.

## Review corrections

- unvalidated-artifact rejection was promoted from a unit test to an independently retained
  executable evidence scenario before public review;
- candidate load, warm, and unload operations were kept outside the manager state lock, and a
  blocking-warm test proved admissions to the current active version remain possible;
- a concurrent admission/cutover test was repeated ten times locally before the reviewed commit;
- failed warmup now releases its acquired reference handle while preserving the current active
  binding;
- activation records immediate drain completion when the replaced deployment has no outstanding
  pins;
- PR and main artifacts were both downloaded and checked instead of treating a green check as the
  retained-evidence verdict.

## Closure gate

- [x] Only a validated immutable artifact can enter loading.
- [x] One identity cannot resolve to changed bytes or digest.
- [x] Failed warmup and invalid activation leave the current active version unchanged.
- [x] Active binding cutover and pin admission have no observable empty or dual-active window.
- [x] Existing work remains pinned while new work stops entering a draining deployment.
- [x] Unload requires completed obligations or explicit forced-termination requirements.
- [x] Rollback uses a new deployment and a previously validated immutable artifact.
- [x] Capability observations cannot write Registry or deployment state.
- [x] M1-M3 frozen regression suites remain green.
- [x] Completed M4 bundles remain independently verifiable offline.
- [x] Missing or corrupt evidence cannot produce `PASS`.
- [x] Reviewed-head and merged-main public checks and artifact readbacks agree.
- [x] The protected annotated tag is created only from the accepted closure commit.

## Public evidence coordinates

- implementation PR: [#12](https://github.com/NoctilumeDev/JPyxis/pull/12);
- reviewed head: `ba22022067aa5415a3da056bac6d4cdac571378f`;
- reviewed-head CI: [run 33874834785](https://github.com/NoctilumeDev/JPyxis/actions/runs/33874834785),
  artifact `9937509164`;
- GitHub reviewed merge revision inside that artifact:
  `8bb5a51bfda025fa0815a1b88c47195bb0de39ed`;
- implementation merge: `9658aba368302f594505be9aa51854fd683227bf`;
- merged-main CI: [run 33875311460](https://github.com/NoctilumeDev/JPyxis/actions/runs/33875311460),
  artifact `9937685623`;
- both public conformance-summary SHA-256 values:
  `206b7478d8cb94988b855482f9310d79fff5d31d04663a95f2664462324b575e`;
- retained evidence index: [`evidence/m4/freeze-manifest.json`](../../evidence/m4/freeze-manifest.json).

The annotated tag `m4-lifecycle-v1` identifies the closure commit after this record itself passes the
required public gate and lands on `main`. Tag protection prevents update or deletion through the
normal repository path.

## Explicitly unproven

- durable lifecycle state or recovery after Control process restart;
- real worker supervision, process termination, or resource reclamation;
- multi-worker placement, routing, or health eligibility;
- retry, idempotency, or uncertain remote-outcome safety;
- arbitrary third-party lifecycle or ArtifactStore plugin compatibility;
- clean-machine reproducibility and the 16 GB resource claim;
- performance or production readiness;
- security isolation;
- accelerators, high-performance data planes, or multi-host behavior;
- business success.

# M4 Runtime Handle Ownership Contract v2

Status: `REVIEWED v2 · CONTRACT ONLY · FREEZE GATE PENDING`

This minimum addendum belongs to [ADR-0013](../adr/0013-m4-runtime-handle-conservation.md) and the
[separate v2 review](../reviews/m4-handle-ownership-review-v2.md). It disposes of the published
retired-handle counterexample and the reviewed pre-contract ownership variants. The old
`m4-lifecycle-v1` coordinate and its bounded eleven-scenario qualification remain historical.
This contract does not establish implemented guards or M2/M4/M5 product continuity.

## Canonical identity and owner lifetime

The canonical identity is the complete immutable
`RuntimeHandle(providerIdentity, providerVersion, opaqueHandle)` tuple. Compare all three exact
strings using record equality. A cloned Java record with the same tuple is the same identity.
No trimming, case folding, numeric version equivalence, object identity or new deployment ID
substitutes for that comparison. Preserve existing constructor rejection of null/blank fields and
load rejection of null or malformed returns before warmup or cleanup.

The authority is one DeploymentManager instance for its in-memory lifetime. Within that owner,
one tuple may be admitted to at most one deployment, across all slots and all states. Its admission
history is monotone: no unload, retirement, failed warmup, cleanup success/failure or rollback
erases the identity. A spent tuple never becomes eligible for a new deployment in that lifetime.
There is no cross-Manager, Control-restart, durable journal or multi-node freshness guarantee.

DeploymentRuntime reports a returned tuple and callback outcomes. The Manager decides admission,
deployment state, active binding, pin obligations and release. New request/load/warm success and
immutable artifact identity do not prove handle freshness. The existing load port has no expected
provider tuple; a foreign alias here means identity already assigned to another deployment in
this owner. This addendum does not introduce M3 provider-resolution authority at that port.

## Atomic returned-handle admission

Slow load remains outside the state lock. After it returns, the Manager compares the canonical
tuple against retained owner history inside the same synchronized decision that reserves history,
records the required owner admission and installs the handle. Caller checks, snapshots and
separate check/install calls do not suffice. Two concurrent equal returns admit at most one owner.
Honest loads and unrelated active-slot pin admissions retain their existing behavior.

Retain requested deployment/slot/artifact and returned tuple separately. `LOAD_SUCCEEDED` is a
capability observation with no lifecycle transition. An accepted tuple additionally receives a
Manager-owned `RUNTIME_HANDLE_ADMITTED` diagnostic before it can be warmed, activated or pinned.
Failure to record required admission cannot install the handle or permit warmup; an uncertain
history reservation remains spent instead of silently becoming available again.

An already admitted tuple yields typed `RUNTIME_HANDLE_IDENTITY_CONFLICT`. Retain a Manager-owned
`RUNTIME_HANDLE_REJECTED` diagnostic with requested deployment/artifact, returned provider/version/
opaque tuple, prior owner deployment/state and rejection reason. It has no state transition. The
candidate follows the existing `LOADING -> FAILED` transition with stage `HANDLE_ADMISSION` and
the same code. It has no installed handle or qualified handle-admission fact. Rejection does not
call warm or unload on the alias, does not activate or commit rollback, and does not change current
active bindings, original owner handles or outstanding/forced pin obligations.

The original owner's independently authorized slow operation may complete concurrently. Its
completion is not caused by rejection and does not authorize re-admitting the rejected identity.
Do not reclaim a rejected/foreign alias as though the candidate owned it. No orphan reclamation or
general physical cleanup guarantee is established by rejecting the return.

## Release conservation and uncertainty

Only the deployment that admitted a tuple may pass it to warm or to its retained Runtime's unload
callback. Normal unload and failed-warmup cleanup both retain that owner identity. A duplicate
rejected at load never reaches those release paths. Rollback requests a new deployment and requires
a never-admitted tuple before cutover. A same-artifact rollback with a spent tuple fails before
cutover; actual process freshness is outside this contract's public-model qualification.

Successful unload remains a capability report. It permits the existing Control retirement decision
but does not prove a real process exited or permit tuple reuse. A failed normal unload preserves
the existing FAILED state. Failed-warmup cleanup failure also preserves FAILED. Each cleanup
failure retains a Manager-owned release diagnostic whose release observation is `UNKNOWN` and
whose tuple remains spent. UNKNOWN is a release observation, not a new deployment state or an
invocation terminal outcome. It cannot be upgraded to released, fresh, ACTIVE or reclaimed by a
new request, warm Boolean, final snapshot or emitter assertion.

## Directed implementation matrix

The separate implementation must preserve the old M4 eleven-scenario matrix, M1-M6 inputs,
dependencies, M5 v2 guard matrix, resource predicates and clean public reproduction profile.
The additional independent matrix must reconstruct at least:

1. a fresh same-artifact rollback loads, warms, becomes ACTIVE and issues a different canonical pin;
2. a retired same-object return and a distinct record with its retired tuple both fail before warm;
3. aliases of owners in LOADING, WARMING, STANDBY, ACTIVE, DRAINING and UNLOADING all fail;
4. a live alias configured to fail warm is rejected before warm/unload; its owner and pins survive;
5. a handle released after honest warmup failure stays spent and cannot reenter;
6. failed warmup cleanup and failed normal unload retain UNKNOWN release facts and reject reentry;
7. two deterministically overlapping slow loads of equal tuples admit one owner at most, reject the
   loser without warm/unload, and leave unrelated active work available during the slow calls;
8. every rejected load preserves preexisting active bindings and pin release obligations, and a
   rollback rejection records failure without a commit;
9. changing exactly provider, version or opaque component gives a distinct tuple under exact
   comparison; all three null/blank component variants and a null return remain rejected;
10. another independent Manager lifetime has no inherited admission history; this proves only the
    declared scope, not restart safety or externally shared handle ownership;
11. required owner admission/rejection and release diagnostics remain distinct from callback facts;
    no capability event writes deployment state; an injected required-admission-record failure
    installs no handle, preserves active/pins and keeps its uncertain tuple unavailable to a retry;
12. missing raw case evidence is INCONCLUSIVE; rehashed duplicate/foreign cleanup and self-declared
    adoption success are FAIL. Raw observations and semantic replay, not labels, own acceptance.

Use public APIs and fresh exact-source compilation for the guard emitter. Retain original raw
stdout/stderr, source/harness coordinates, callback arguments, actual pins, transitions and hashes.
The emitter does not return its own qualification verdict. Reader mutations must repair hashes
when changing semantics so that rejection is demonstrated independently of storage corruption.

## Qualification and stop lines

Content publication must pass protected PR gates, downloaded artifact readback, protected merge,
exact-main gates and independent readback. Its separate retained closure and protected annotated
`m4-handle-contract-v2` tag must close before runtime implementation. This tag qualifies contract
authority only. Guard implementation is a separate branch/PR and must independently qualify its
directed raw-model evidence and unchanged predecessors at PR and exact main. Retain first failed
candidates and receipts. Only after guard qualification may Productization Audit A rerun.

A newly different lifecycle/authority conflict, a need for unexpressible identity, durable or
cross-node ownership, a public RuntimeRegistry service, environment builder, resource scheduler,
new product meaning or irreversible external action is outside this contract and requires STOP.
Known duplicate/release/concurrent identity variants remain inside this reviewed repair boundary.
Product contract B, real Python path C-G, process reclamation, production readiness and general
Evidence/Verdict authority remain unqualified.

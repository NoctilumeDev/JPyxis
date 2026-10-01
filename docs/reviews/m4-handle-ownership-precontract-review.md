# M4 Handle Ownership Pre-contract Review

Status: `KNOWN IDENTITY GAP CONFIRMED · MINIMUM OWNER BOUNDARY REVIEWED · NO CONTRACT FREEZE`

## Exact entry and observations

The audit-only [PR #25](https://github.com/NoctilumeDev/JPyxis/pull/25) completed protected merge at
`fa1991da1c08de1242a805a749a5acffb1c88d05`, tree `5b5b3d1ed05977b4c58580c5fd3b3f87b9297dc9`.
Downloaded PR/main artifacts independently passed M5, M6, 35 coordinate cases, five durable
fixtures, three coordinate mutations and eight M6 mutations, with resources accepted and recorded
Runtime processes stopped. This is the entry for the present audit, not a qualification of a repair.
The [publication entry](../../evidence/m4-handle-ownership-audit/publication-entry.json) retains
the exact runs, artifact IDs and predecessor readbacks.

The public probe candidate `e4af4c4d5bbbf0ea202b67404b0ce564cb3e5c6d` was committed before execution.
Fresh Java 17 compilation used exact API/Core/port/evidence Git blobs from that entry. Twenty-five
model processes exited normally and emitted raw observations without a verdict. The separate
[reader](../../experiments/m4-handle-ownership-audit/verify-ownership-audit.mjs) checks hashes,
source bindings, owner-tagged transition replay, active bindings, actual pins, release outcomes,
callback arguments and deterministic concurrency barriers. The [first receipt](../../evidence/m4-handle-ownership-audit/first/receipt.json)
and raw bytes are retained without repair or replacement.

| Model family | Actual entry behavior | Minimum consequence |
| --- | --- | --- |
| Retired tuple, same object or cloned record | Both rollback candidates become ACTIVE and receive the old tuple in a new public pin. | Java reference identity cannot be the guard. |
| Owner in LOADING, WARMING, STANDBY, ACTIVE, DRAINING or UNLOADING | Each alias becomes another ACTIVE deployment. | Adoption needs atomic owner admission across every live state and slot. |
| Live alias whose warmup fails | The alias reaches warmup and calls unload on the active owner's tuple. | Rejected aliases must never enter candidate cleanup. |
| Warmup failure followed by successful release | A cloned released tuple becomes ACTIVE again. | Spent identity outlives release and FAILED state. |
| Failed warmup cleanup or failed normal unload | The same uncertain tuple becomes ACTIVE again. | Cleanup failure cannot prove release or freshness. |
| Two slow loads return equal tuples as different objects | Both deployments become ACTIVE; two actual pins carry one canonical tuple. | Compare and install inside the Manager's ownership lock. |
| Fresh rollback or a changed provider, version or opaque component | Each distinct tuple becomes ACTIVE. | Exact record/string equality expresses the bounded identity. |
| Null return or null/blank constructor components | Existing load failure rejects all seven cases and preserves active/pin obligations. | Preserve shape rejection before warmup or cleanup. |
| A separate Manager lifetime receives the same tuple | Its own admission succeeds. | This audit provides no shared or restart-persistent identity authority. |

Thirteen cases reproduce variants of the already published M4 identity/ownership gap; twelve are
bounded controls. This is one reviewed model family, not an additional lifecycle-state conflict.
The first retired-handle receipt and original M4 tag, manifest, profile, review and fixture results
remain unchanged. M5 v2 qualification is unaffected. Productization Audit A remains STOP.

## Minimum boundary and authority

`RuntimeHandle(providerIdentity, providerVersion, opaqueHandle)` is an immutable record whose
constructor already rejects null/blank components. Equality includes all three exact strings; the
API specifies no trimming, case folding, numeric version equivalence or provider alias mapping.
No new public identity carrier is necessary.

DeploymentRuntime reports a returned handle and callback outcomes. DeploymentManager owns
admission, lifecycle state, active bindings, pin obligations and release decisions. A fresh
deployment ID, another load, successful warmup, or the same immutable artifact cannot prove a
returned tuple is fresh. The existing port carries no separately authoritative expected provider
binding. In this bounded repair, a foreign alias means a returned tuple already assigned to another
deployment in the same owner; it does not invent M3 provider validation at this port.

The minimum repair boundary is a monotone admission history inside one DeploymentManager instance.
An admitted tuple has one deployment owner for that instance's lifetime and remains spent after
normal retirement, failed warmup release or failed cleanup. All release paths leave that admission
history intact. Slow callbacks remain outside the state lock; tuple comparison, required owner
diagnostic and handle installation share one atomic owner decision. Rejection records requested
deployment/artifact, returned tuple, prior owner/state and reason; it leaves the alias unadopted,
does not warm or unload it, and preserves the current active binding and existing pins.

Cleanup success remains a capability report. Cleanup failure retains an UNKNOWN release observation
and a spent tuple; it cannot be promoted to physical reclamation or future freshness. Existing
FAILED lifecycle state suffices. This audit requires no new deployment state, public RuntimeRegistry
service, environment builder, scheduler, OS grant, durable restart service or multi-node authority.

## Next qualification boundary

A separate minimum M4 v2 contract must declare canonical comparison, owner lifetime, atomic
duplicate admission, retired/live/failed-release rejection, safe cleanup and its directed matrix.
It must qualify through protected merge, exact-main gates and independent readback before repair
implementation. Implementation qualification must keep the old M4 eleven-scenario matrix, all
M0-M6 inputs, resource predicates and dependencies intact and add independent raw-model guard
readback with missing/forged/rehashed evidence mutations. Only after those guards qualify may
Productization Audit A rerun; product contract B and real path C-G remain gated.

| Required record | Pre-contract audit round |
| --- | --- |
| Did | Bound accepted main, inspected every handle release/adoption path and ran 25 fresh public model cases. |
| Why | Determine the smallest guard boundary that conserves identity through retirement, cleanup and concurrent owner admission. |
| Original plan | Review minimum M4 ownership before freezing a separate repair contract. |
| Actual | Thirteen known-gap variants and twelve controls were independently reconstructed; the existing tuple and lifecycle states express the minimum repair. |
| Failed premise | A new load/warm or release fact establishes fresh identity without retained owner admission. |
| Final state | Minimum owner boundary reviewed; no runtime repair, contract freeze or product qualification. |
| Next authority | Qualify this audit publication, then freeze only the separate minimum M4 v2 contract within the reviewed boundary. |

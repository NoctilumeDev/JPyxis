# M4 Runtime Handle Ownership Review v2

Status: `REVIEWED CONTRACT CONTENT · FREEZE RECORD GATE PENDING · GUARDS UNQUALIFIED`

## Evidence and minimum reopen

Accepted audit main is `db866d2a997188c50bd3cf5c14852fc5a7d9cbe0`, tree
`994d497b01a4f279bc1d43d30413681dd6120190`, after protected
[PR #26](https://github.com/NoctilumeDev/JPyxis/pull/26) and independent exact-main readback.

The separate pre-contract audit binds the accepted counterexample-publication main and a first
committed candidate. Independent raw/source/hash/transition/pin/callback readback reconstructs 13
known ownership-gap variants and 12 bounded controls. The existing RuntimeHandle record expresses
canonical identity, and the existing LOADING-to-FAILED path expresses rejection. No larger
lifecycle or authority contradiction was found in the reviewed paths.

The accepted entry coordinates and PR/main independent readbacks are retained in this contract's
[entry manifest](../../evidence/m4-handle-validation/v2/entry-manifest.json). The original
retired-handle receipt, pre-contract receipt, mixed branch candidate,
M0-M6 tags/manifests/profile/review and qualified M5 v2 evidence stay unchanged. This review does
not qualify a runtime repair or change the original fixture's historical interpretation.

## Reviewed contract decision

The [new ADR](../adr/0013-m4-runtime-handle-conservation.md) and
[contract](../spec/m4-handle-ownership-contract-v2.md) reopen only owner admission and identity conservation at the existing
DeploymentManager. Equality is the complete provider/version/opaque tuple, even for a new Java
object. The tuple's history spans normal retirement, warmup failure release, cleanup failure and
all live states. History and installation share one owner decision after slow load returns; the
pre-contract concurrent model rules out a separate caller check followed by installation.

A rejected alias has no candidate owner, therefore no candidate warm/unload authority. A failed
cleanup report cannot free an identity or demonstrate physical release. UNKNOWN remains a release
observation and FAILED remains the existing lifecycle state. Pins are immutable obligations and
rejection cannot rewrite them. The complete directed matrix includes equal concurrent returns,
same/cloned retired tuples, live and released aliases, malformed shapes, exact component
comparisons, scoped lifetime and independent evidence mutations.

The existing port has no expected provider-binding operand. This contract guards prior ownership
within the Manager; it does not invent a provider mismatch oracle or introduce M3 authority at M4.
It requires neither a new public identity type nor a public RuntimeRegistry service. It does not
reopen environment construction, durable recovery, resource authority or product path semantics.

## Publication, freeze and implementation

Contract content requires local repository/whitespace/archive checks, both protected public jobs,
downloaded independent M5/M6/coordinate readback, protected merge, exact-main gates and a separate
independent main readback. The retained closure then binds those exact coordinates before a
protected annotated `m4-handle-contract-v2` tag grants entry to a separate implementation branch.
The content's green run or a document status does not establish implemented guards.

Implementation must keep all old counts, thresholds, input coordinates and dependencies intact.
It adds public exact-source raw-model observations and a separate semantic reader, including
hash-repaired semantic mutations. Required gates, protected merge, exact-main execution and
independent reconciliation qualify the guard boundary separately. Only then can Productization
Audit A rerun; contract B and real path C-G remain gated by that rerun.

| Required record | Contract content round |
| --- | --- |
| Did | Bound the accepted audit and specified canonical identity, monotone owner history, atomic admission, safe rejection and release uncertainty. |
| Why | Correct the retired-handle premise at the owning consumer without importing a larger runtime service or lifecycle state. |
| Original plan | Freeze only the minimum reviewed M4 boundary after its pre-contract audit qualifies. |
| Actual | This is a separate contract-content candidate; no runtime guard is implemented. |
| Failed premise | Fresh deployment/load/warm or reported release implies fresh identity. The original failures remain retained. |
| Final state | Reviewed content; publication, closure and contract tag gates pending. Guards and productization unqualified. |
| Next authority | Qualify content and its retained closure/tag, then implement this matrix in a separate branch/PR. |

# M4 Handle Validation Implementation Review

Status: `QUALIFIED BOUNDED M4 V2 GUARDS · PRODUCTIZATION AUDIT A RERUN ENTRY`

## Qualified contract entry

The separate minimum M4 v2 contract content qualified through PR #27 and exact main
`58082992dbe29d6302b2c427dcad9aebd75ace0a`. Its separate PR #28 closure completed protected
merge at `43df2cc678d60bb8a8ddf7f23f1aa82bbcca898e`, tree
`71a4a20390929c47b7b6f8b8dba9b0a06df0efb2`, and its own exact-main run and independent
M5/M6/coordinate/first-audit readbacks. Resources were accepted and recorded Runtime processes
stopped. The protected annotated `m4-handle-contract-v2` tag object
`30d0ccdf709a1501dabe39d6e7786d30b27750a4` peels to that closure main; live remote readback
matched both. Main/tag rules remain active without bypass, and all eight old tag objects match.
The [closure manifest](../../evidence/m4-handle-validation/v2/closure-manifest.json) retains these
coordinates and limits. This is contract authority only.

## Implementation candidate and directed witnesses

DeploymentManager keeps canonical RuntimeHandle reservations for its own lifetime. It reserves,
records the returned observation and required owner diagnostic, and installs under one lock after
the slow callback returns. A reserved alias receives a typed rejection before warmup, activation
or cleanup. Record failures leave an uninstalled, spent reservation. Ownership is checked before
warm, pin/activation and normal/failed-warmup release. Cleanup failures retain a Manager-owned
UNKNOWN release observation. No release path removes identity history.

The [public emitter](../../experiments/m4-handle-validation/HandleValidationMain.java) uses fresh
Java 17 compilation of exact source, public APIs, callback arguments, actual pins and journal
events. It emits observations without a verdict. The
[separate reader](../../scripts/verify-m4-handle-evidence.mjs) reconstructs owner/transition replay,
binding/pin conservation, safe callback counts, uncertainty and source/raw hashes. Its 28 cases
cover the frozen matrix plus required admission/load-observation record failures and a
cross-artifact alias. The latter prevents artifact identity from substituting for handle identity.

The original M4 eleven-scenario matrix remains unchanged. Its runner additionally executes this
separate matrix; M6 keeps thirteen phases, the existing clean profile and resource predicates.
The workflow retains new raw M4 evidence without altering thresholds, dependencies or M5 guards.
The clean M6 VM uploads a separate `m4-handle-clean` artifact because its original frozen bundle
copy contains only predecessor summaries/runs. This preserves new raw guard readback from that
fresh VM without changing the old M6 bundle, phase matrix or predicates.
Missing stdout must be INCONCLUSIVE; hash-repaired foreign cleanup and self-declared alias
adoption must be FAIL. Both immutable PR and exact-main executions supplied these witnesses.

## Retained local execution

The first committed candidate `6d4bd737bae53cf16525a83dbca2aced9227dd0c` compiled fresh exact
source and passed all 28 directed cases and three guard mutations. Its full M4 run kept all eleven
legacy scenarios and expected mutations, and its full M5 run kept all sixteen scenarios, 35
coordinate cases, five durable fixtures and three coordinate mutations. Both processes exited
zero with empty stderr; separate raw M5/coordinate readback passed.

Candidate `8dbec86c4065f4c7066c231e10f14d6067a6a65c` strengthened only the independent reader to
check every observed Runtime's callback arguments against its admitted owner. The first raw
evidence remained unchanged and passed this additional readback. Fresh immutable execution at
the newer candidate again passed 28 cases and three mutations. Runtime code and predecessor
inputs were unchanged between those candidates; no broader local suite was repeated.

The [local checks](../../evidence/m4-handle-validation/v2/local-checks.json),
[retention ledger](../../evidence/m4-handle-validation/v2/local-retention.json) and separate
candidate archives retain the first manifests, raw stdout/stderr, mutation inputs and full local
M4/M5 logs. No first failure occurred. These are local checks, not public-clean M6 or exact-main
guard qualification. No real process freshness or product-path result is inferred.

## Qualification limit

Commit the complete candidate before first execution, retain any first failure, and run directed
readback and unchanged relevant predecessors. Required PR gates, independently downloaded M4
guard/M5/M6 artifacts, protected merge, exact-main gates and separate artifact readback must all
close before guards qualify. Retain first failed candidates and original receipt bytes; read older
model receipts at their bound source rather than treating the repaired source as their input.

No public RuntimeRegistry service, durable/cross-Manager ownership, environment builder, provider
binding oracle, resource authority, actual process freshness/cleanup or product path is established.
The old frozen normative files/tags/fixtures and both first M4 receipt archives stay intact.
The historical Audit A STOP remains intact. These qualified guards permit a new Audit A rerun
after this separate qualification record completes its own publication gates; they do not permit B.

## Public qualification

PR #29 reviewed head `b070c158622671dc5fda74c950d01c4f9a5446cd` executed at
`99e6e5ed934ad1a3c1662b133b8ddd71fd664075` and merged through the protected path to
`a5fc73b8d0b2f7724338873d14377af8a26e3021`, tree `eefb640ac987cc09333ecd49ce76f4e0d5f0b09d`.
PR run `36880640714` and exact-main run `36882074318` both passed required gates.
Separate downloaded M4, clean-VM M4, M5 and M6 artifacts passed independent source-bound
readback: eleven legacy M4 scenarios, 28 handle cases and three mutations on each VM, 35 M5
coordinate cases, five durable fixtures, three coordinate mutations, thirteen M6 phases and eight
M6 mutations. Both resource decisions were ACCEPT and all recorded Runtime processes stopped.

The [implementation manifest](../../evidence/m4-handle-validation/v2/implementation-manifest.json)
binds reviewed, executed and accepted coordinates. Both exact-main guard input sets and their
mutation inputs are retained byte-for-byte with a separate ledger. All original audit archive trees,
local candidate receipts and frozen normative blobs remain unchanged. No first guard failure was
observed. Qualification covers the declared in-memory model; it supplies no real product-path or
actual process-freshness result. This PR publishes only that qualification closure, without new
Audit A probes or a contract B candidate.

# M4 Handle Validation Implementation Review

Status: `LOCAL DIRECTED/PREDECESSOR CHECKS VERIFIED · PUBLIC GUARD QUALIFICATION PENDING`

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
Missing stdout must be INCONCLUSIVE; hash-repaired foreign cleanup and self-declared alias
adoption must be FAIL. This review describes planned witnesses until immutable execution completes.

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
Productization Audit A remains STOP until this separate guard qualification permits its rerun.

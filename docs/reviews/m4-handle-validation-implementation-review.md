# M4 Handle Validation Implementation Review

Status: `CANDIDATE GUARDS · IMMUTABLE DIRECTED EXECUTION AND PUBLIC QUALIFICATION PENDING`

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

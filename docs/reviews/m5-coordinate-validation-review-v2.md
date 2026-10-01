# M5 Coordinate and Owner Effect Review v2

Status: `REVIEWED CONTRACT v2 · PUBLICATION GATE PENDING · RUNTIME GUARDS NOT QUALIFIED`

## Bound evidence and minimum reopen

Base main: `54846ec612ff00417d73052e9f4fb0f0edc602a7`, tree
`60ebe98a10c73de15ec70cabeb59e789683c9a12`. The
[second-publication manifest](../../evidence/productization-audit/publication-second.json) and
separate PR/main readbacks bind its qualification. Both original model receipts remain unchanged.
The [supersession record](../../evidence/productization-audit/pr19-supersession.json) preserves the
unmerged v1 candidate and successful checks; v2 does not rewrite that history.

The frozen M0 ownership/failure/state documents, ADR-0010, M5 profile/review and public consumers
remain byte-identical across the audit publication merges. Their bounded qualification remains
historical. The [new addendum](../adr/0012-m5-instance-identity-conservation.md) reopens only operand
admission, following instance-scoped Supervisor effects, and their replay/late-report continuity.
The public role map remains exact revision `cb67c33d4ba44c1b216c1f1cb7f6e45ef45fe329`; no resource
or external Verdict authority is imported.

## Reviewed decision

Use guards inside the existing public owners. Request policy remains Manager-owned; equality of
plan copies checks provenance. Worker identity is the explicit worker/instance/epoch tuple, not
PID, live state or instance-name spelling. Valid historical identity remains valid for association
without acquiring present eligibility. Both admission and subsequent owner effect need their own
checks; comparing a caller snapshot before worker-ID-only mutation leaves a replacement race.

The [v2 contract](../spec/m5-coordinate-validation-contract-v2.md) requires Supervisor to compare
originating/current tuples at its apply boundary. Intentional worker-wide actions remain distinct.
The complete Manager path inventory found selection in `prepareAttempt` and one mutation in normal
unknown admission. Success, failed-before/after, late reports and Manager recovery have no direct
Supervisor mutation. Reference warmup/drain actions are separate assembly Control operations.
These findings constrain implementation and the directed matrix rather than create new effects.

## Round record

| Required record | Contract v2 round |
| --- | --- |
| Did | Qualified the second audit publication, reconstructed exact base, inventoried every Manager/Supervisor path and specified v2 admission, owner effects and recovery/late-report matrix. |
| Why | Conserve instance identity through the next state owner rather than fix only a submitted-plan comparison. |
| Original plan | Publish the second fact first, then revise only the minimum M5 contract. |
| Actual | The second publication closed protected merge and exact-main independent readback. V2 is a separate documentation candidate with no runtime change. |
| Failed premise | V1 admission checks alone close the identity boundary; its initial candidate and first failure stay preserved. |
| Final state | Reviewed contract content; this contract's public gates, merge, exact-main readback and tag remain pending. Guard implementation and productization remain unqualified. |
| Next authority | Only after contract publication/freeze qualifies, implement this directed boundary in a separate branch/PR; then qualify exact main and rerun audit A. |

## Publication and implementation gates

Verify local hygiene and both immutable receipt archives, then both required public predecessor jobs.
Independently download/reverify M5/M6 artifacts, all eight M6 mutations, exact source/tree, resource
decision and shutdown for PR and main. Preserve first failures. A protected annotated
`m5-coordinate-contract-v2` tag binds the accepted contract main only after that loop closes; it
never states that guard behavior is implemented. Old frozen tags and manifests are not updated.

The subsequent implementation record must bind contract head/PR/executed merge/main/run/artifacts,
tag and readback before claiming entry. Directed guard evidence and unchanged predecessor evidence
then qualify separately. This document's reviewed matrix is not a test result.

Local candidate review passed repository hygiene and whitespace checks. Both original receipt
archives remain byte-identical and pass immutable storage readback at the qualified base. Runtime,
predecessor suites, workflow, thresholds and dependency files are unchanged; their fresh public
exact-main evidence is the predecessor, not execution of newly implemented v2 guards.

No M2/M4 real composition, Environment construction, general process cleanup, worker adoption,
Spring façade, scheduler/resource grant or product verdict is established here.

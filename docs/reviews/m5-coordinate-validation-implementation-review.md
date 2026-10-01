# M5 Coordinate Validation Implementation Review

Status: `IMPLEMENTATION CANDIDATE · QUALIFICATION PENDING · PRODUCTIZATION AUDIT A STOP`

## Entry authority

The [v2 contract](../spec/m5-coordinate-validation-contract-v2.md) is frozen at protected annotated
tag `m5-coordinate-contract-v2`, object `283df71ca3cf7d439d038557532c9e1d6e2772f2`, targeting
`2ac2715b994f519fbad4afb73b1f80ea0852dd55`. This implementation starts from that exact main.
The [closure manifest](../../evidence/m5-coordinate-validation/v2/closure-manifest.json) binds
PR #22, reviewed head, executed PR merge, protected main, required runs and artifact identifiers.
Separate downloaded [PR](../../evidence/m5-coordinate-validation/v2/pr22-readback.json) and
[main](../../evidence/m5-coordinate-validation/v2/main22-readback.json) evidence passed independent
M5/M6 readback, all eight M6 mutations, resource acceptance and shutdown inspection.
The tag grants entry to this bounded implementation, not acceptance of its behavior.

## Implemented boundary

Manager validates the retained full plan tuple and policy copies before any accepted or late
observation. It marks association-only late reports distinctly and derives retry policy solely
from the accepted request and budget. Current Manager/Supervisor epochs must agree. Replay checks
reservation and dispatch copies before recovery decisions and preserves prior recovered attempt
observations across repeated recovery; old historical identity never grants current eligibility.

Supervisor rejects foreign returned handles before pinning or health probing. A new start clears
the preceding handle from routing. Attempt-scoped unknown effects carry the originating worker,
instance and epoch to Supervisor; its locked apply boundary compares that tuple and handle again
after the capability health call. A superseded instance retains a diagnostic and leaves the new
instance unchanged. The existing intentional worker-wide action has separate provenance.

These changes stay inside the existing state owners. Capability observations cannot own
transitions. No M2/M4 API, dependency, old conformance count, resource predicate or frozen milestone
manifest changes. Both original counterexample receipts, failed candidates and the unmerged v1
contract remain retained.

## Directed evidence and required gates

The supplemental Java matrix covers substituted and malformed inputs, terminal and historical
reports, same-instance and old-instance results, constructor epoch mismatch, deterministic
replacement races, fail-closed required appends, hash-valid contradictory replay tuples and
repeated durable recovery. The model emitter produces 35 public-API observations from fresh JDK
compilation. It uses an in-memory journal and synthetic WorkerControl; it asserts no real compute
or process qualification. Five separate fixtures come from actual DurableResilienceJournal tests.
They retain valid sequence/digest chains and contradictory copies, with no Manager recovery
decision admitted.

The independent supplemental reader checks raw observations, owners, source/tree bindings and
durable input chains. Evidence mutations include missing raw stdout (`INCONCLUSIVE`), poisoned
replacement state (`FAIL`) and a self-declared substituted-plan success (`FAIL`), including
recomputed file digests for the two semantic mutations. Existing M5 cases and four mutations stay
unchanged. The required M5 job retains this additive matrix with its raw outputs and mutations.
The existing M6 ordered chain executes the full M5 gate without adding phases or changing its
frozen thirteen-phase/eight-mutation criteria.

First development execution passed 31 new Java test invocations plus the original 15, and the
first model execution passed all 35 cases. Those runs were from an uncommitted candidate; the
model manifest explicitly records `LOCAL_DIRTY_CANDIDATE`. They remain local development evidence,
not an immutable qualification claim. The later durable-export and mutation retention additions
must be exercised by a clean committed candidate before publication.

The first full M5 candidate `2a49066c07a29e4600e0c218b14247d49fb9bb4e` failed before compilation:
the Windows wrapper rejected the quoted absolute evidence-directory argument (exit 255). Its
commit, first log and partial output remain retained. This is parameter transport failure, not
behavioral execution or a new model counterexample. A fixed module-relative Surefire directory
removes that shell quoting dependency; a later candidate must rerun the entire gate.

Candidate `064c2f9e236983e09a0bd0191ceadf0ab4241bc9` then passed the complete local M5 gate:
the original sixteen cases/four mutations and supplemental 35 cases, five durable replay fixtures
and three mutations. A separate reader reran the supplemental bundle with that exact source and
also returned `PASS`. Its serial local M6 clean build completed all thirteen phases and eight
mutations, with recorded Runtime processes stopped. The final local verdict is `INCONCLUSIVE`,
as required for an absent public-clean coordinate and unavailable Windows swap-growth observation;
the resource decision is `PROVISIONAL`. Neither limitation is overridden or reported as acceptance.
The [first integration failure](../../evidence/m5-coordinate-validation/v2/first-implementation/receipt.json)
preserves its original raw log bytes and candidate coordinate. Public PR/main qualification remains
pending; fresh jobs must run from the final published candidate rather than inherit these local
results across a documentation commit.

Required acceptance is serial local hygiene and M5/M6 gates, protected PR checks, independent
downloaded PR artifact readback bound to the executed merge source, protected merge of the exact
reviewed head, then fresh exact-main checks and independent artifact readback. Guard readback must
pass the supplemental 35 cases, five durable fixtures and three mutations in addition to the
unchanged predecessor readbacks. A green run alone cannot accept this boundary. Because the old
second-receipt checker intentionally binds predecessor runtime source, its storage check uses the
frozen closure revision and archive tree/blob equality proves preservation at the new candidate;
the old checker and raw first receipts are not rewritten to follow repaired source.

## Round record

| Required record | Implementation candidate round |
| --- | --- |
| Did | Implemented v2 admission, qualified-handle and atomic originating-instance effects, with replay continuity and additive directed evidence. |
| Why | Close both published identity counterexamples without giving historical identity authority over a replacement. |
| Original plan | Implement only after contract closure, then qualify the guards before productization audit A. |
| Actual | Contract closure/tag is complete; local development checks passed; immutable full and public gates remain pending. |
| Failed premise | Both original model failures remain archived; no new out-of-bound model counterexample has been observed in this implementation round. |
| Final state | Guard implementation candidate. Contract frozen; guard behavior and productization unqualified. |
| Next authority | Complete this implementation's acceptance loop, then rerun audit A from qualified main; no direct real-path or facade promotion. |

# Evidence Retention and Externalization Pre-Contract Audit

Status: `PRE-CONTRACT AUDITED · EXACT-MAIN QUALIFIED · NO BYTES MOVED · NO DELETION AUTHORIZED`

Audit base: `main@6d388de497ff993af97a06dbf83a4296f59ce50e`

Qualification coordinate: `main@a6665bc1eaab409f1ebc0f9c93a99735c0191f2d`

## Qualification record

The bounded audit entered the protected repository through
[PR #44](https://github.com/NoctilumeDev/JPyxis/pull/44):

- reviewed head: `a091678b238ee703472d0f5d93f8a4df7ff93785`;
- merge revision: `a6665bc1eaab409f1ebc0f9c93a99735c0191f2d`;
- pull-request Repository Gates: run `37190392966`, all four required jobs succeeded;
- pull-request Observatory demo: run `37190392972`, build verification succeeded;
- exact-main Repository Gates: run `37216713138`, all four jobs succeeded at the merge revision;
- exact-main Observatory demo: run `37216713130`, build and deployment succeeded at the merge
  revision.

The qualified state means that the problem statement, inventory and next contract question may be
used as construction input. It does not publish an external object, qualify a provider, migrate a
consumer, authorize deletion, implement a hygiene gate or rewrite Git history.

## Purpose

JPyxis deliberately retains first failures, raw observations, independent readbacks and qualification
inputs. That discipline has protected the project from replacing execution facts with summaries.
It has also made retained evidence the dominant cost of the source repository.

This audit asks one bounded question:

> Which storage and retrieval contract must exist before large retained evidence may leave the current
> Git tree without weakening, relabelling or deleting the claims it supports?

The audit does not select a storage provider, publish an evidence object, move or delete a tracked
file, rewrite Git history, change a required check, or authorize implementation. Existing evidence
coordinates and verifiers remain authoritative until a later contract is separately qualified.

## Frozen boundaries retained

- invocation outcome, acceptance verdict and project evidence state remain separate;
- a summary, digest or passing exit code may index retained evidence but cannot replace evidence that
  an acceptance verdict needs;
- an original failure remains an original failure after a later repair succeeds;
- absence of a textual reference does not make an observation disposable;
- artifact identity is distinct from activation state, and evidence identity is distinct from a
  transport locator;
- a runtime, verifier, migration tool or storage provider cannot promote its own output to a project
  evidence state;
- no storage optimization may transfer general Evidence or Verdict authority into JPyxis;
- the first historical-residual pass remains a navigation classification, not evidence
  externalization and not Git-history reduction.

## Why this audit is now qualified to exist

At the audit base, the tracked working tree contains 4,711 files and 603.65 MiB. The `evidence/`
tree alone contains 4,373 files and 580.01 MiB. It therefore represents about 96 percent of tracked
working-tree bytes.

The growth is not an abstract future concern. The historical table uses committed Git blob sizes;
working-tree text normalization accounts for the small difference between the current 579.98 MiB
Git total and the 580.01 MiB working-tree total:

| Coordinate | Retained evidence files | Retained evidence size | What had entered the tree |
| --- | ---: | ---: | --- |
| `9632a4f` | 6 | 0.01 MiB | M1-M6 freeze indexes |
| `b50495a` | 3,379 | 30.37 MiB | actual reference-path evidence |
| `151785c` | 3,518 | 99.17 MiB | qualified risk-scoring host inputs |
| `09ac1d4` | 4,365 | 601.12 MiB | retained visual Design QA and raw observations |
| `5f9af1` | 4,373 | 579.98 MiB | first historical-residual classification |
| `6d388de` | 4,373 | 579.98 MiB | current audit base |

The first archive pass moved about 22 MiB of non-authoritative visual references from `evidence/`
to `archive/`. It improved navigation and preserved historical meaning. It did not reduce the total
tracked tree or the existing Git history, exactly as that pass declared.

## What actually happened in this audit

### A normal Windows worktree path failed

The first attempt used an ordinary project-root path ending in
`JPyxis-evidence-retention-audit`. Git reached the retained reference-path candidates and failed to
create multiple files with `Filename too long`, then could not complete the worktree reset. The
observed base path was 70 characters. The longest tracked relative path is 221 characters, producing
a 292-character full path. Repeating the checkout at a nine-character temporary root succeeded; the
same longest full path was 231 characters there.

The failure is not evidence corruption and does not invalidate the retained candidates. It is a real
repository-usability cost caused by the current evidence representation. A contributor should not
need to know that JPyxis requires an unusually short checkout root before creating a worktree.

### Bytes are concentrated in containers, not exact duplicate files

The retained evidence types at the audit base are:

| Type | Files | Tracked size |
| --- | ---: | ---: |
| ZIP containers | 44 | 495.81 MiB |
| PNG observations and references | 290 | 45.73 MiB |
| JSON ledgers, manifests and observations | 1,001 | 23.56 MiB |
| binary stdout/stderr and other `.bin` records | 1,654 | 8.19 MiB |
| JSONL observations | 353 | 2.81 MiB |

Whole-file SHA-256 grouping finds 355 exact duplicate groups but only 8.87 MiB of removable duplicate
payload after retaining one copy of each hash. Therefore an exact-file deduplication pass cannot
solve the repository-size problem.

The ZIP contents show a different concentration. Twenty-one retained ZIPs embed an
`artifacts/host.jar` member. Those embedded members account for 427.84 MiB of compressed payload and
459.30 MiB uncompressed. They contain 18 distinct JAR hashes because several observations bind
different source revisions, while three hashes each occur twice. The current immutable containers
must not be repacked: changing their members would create different evidence. For future evidence,
however, the result shows that a content-addressed object referenced by multiple observation bundles
may preserve stronger identity with substantially less repeated packaging.

### The current large families have different meanings

| Current family | Files | Size | Present qualification role |
| --- | ---: | ---: | --- |
| `risk-scoring-reference/v1/design-qa` | 903 | 406.05 MiB | source-bound screenshots, raw browser observations, independent product reviews and first failures |
| `risk-scoring-reference/v1/qualification-inputs` | 19 | 89.71 MiB | implementation-PR, exact-main and installed-product qualification inputs |
| `reference-path/v1/qualification` | 37 | 30.82 MiB | protected-merge and exact-main qualification inputs |
| `risk-scoring-reference/v1/rejected-candidates` | 25 | 21.92 MiB | original rejected candidates and repair provenance |
| `reference-path/v1/local-candidates` | 1,864 | 8.00 MiB | five first-failure candidate trees; also the source of the path-length failure |
| `reference-path/v1/public-candidates` | 13 | 8.05 MiB | original public qualification failures |
| `reference-path/v1/local-observations` | 3 | 6.91 MiB | original retained local observation container |
| `m4-handle-validation/v2` | 978 | 6.29 MiB | bounded handle contract and implementation witnesses |
| `m5-coordinate-validation/v2` | 325 | 1.38 MiB | bounded coordinate contract and implementation witnesses |

Size alone cannot decide which family leaves Git. The Design QA tree, qualification inputs and first
failures support different claims and have different consumers. A storage contract must preserve
those distinctions rather than assign one blanket retention rule to `evidence/`.

### Current repository gates consume retained bytes

The large files are not merely parked beside the product:

- `scripts/verify-risk-host-retention.py` opens rejected candidates, visual observation containers
  and all three risk-host qualification containers, recomputes their digests, verifies every member
  and checks their source and shutdown facts;
- `experiments/reference-path/verify-local-candidates.mjs` verifies every retained local-candidate
  file against both its retention ledger and original Git blob;
- `experiments/reference-path/verify-retained-qualification.mjs` extracts and independently verifies
  the retained PR and main qualification containers;
- `scripts/verify-reference-path.mjs` runs both retained-history checks before executing the current
  reference path;
- review documents link to the compact ledgers and selected first-failure records.

Removing bytes before replacing these consumers would weaken required verification, not clean the
repository. Conversely, continuing to re-read immutable historical containers in every current
candidate gate may be redundant work. The audit does not decide that question; it identifies it as a
separate gate-identity and evidence-reuse contract.

GitHub Actions artifacts in the current workflows use a 14-day retention period. They are useful
transport and diagnostic outputs, but they cannot serve as the permanent store for frozen evidence.

## Invalidated assumptions

The audit invalidates five tempting shortcuts:

1. **Exact duplicate removal is enough.** It can recover at most about 8.87 MiB from the current
   evidence tree and cannot explain the repeated payload inside distinct qualified containers.
2. **Moving files into `archive/` reduces repository cost.** It changes current classification but
   does not reduce total tracked bytes or historical objects.
3. **A normal checkout location is always viable.** The observed Windows worktree failure disproves
   that assumption for the current tree.
4. **A CI artifact is a durable evidence coordinate.** The present 14-day retention policy disproves
   that assumption.
5. **Deleting large files from current `main` shrinks existing Git history.** It reduces a future
   checkout of the current tree, but the current object database still contains about 474.53 MiB of
   packed objects. Rewriting history would change commit identities and is not authorized by this
   audit.

## Required semantic separation

A later contract must keep at least these identities separate:

```text
Evidence object identity
    content digest + byte length + media type

Evidence claim binding
    which claim, source, run, failure or qualification the object supports

Storage locator
    where bytes may currently be retrieved

Retrieval observation
    what a particular anonymous or authenticated readback actually received

Migration state
    whether Git and external bytes are both retained, externally qualified, or still provisional
```

Therefore:

```text
locator equality       != evidence identity
successful upload      != qualified retention
successful readback    != claim validity
digest-only index      != sufficient evidence for a claim that requires retained raw bytes
current-tree removal   != history reduction
```

## Candidate retention classes

These classes are audit candidates, not yet a frozen schema.

### `KEEP_IN_GIT`

The likely Git-resident minimum is:

- evidence policy, contracts, reviews and claim boundaries;
- compact freeze, closure, entry and implementation manifests;
- source, PR, main, workflow and artifact coordinates;
- content digest, byte length, media type and member-manifest digest for every retained object;
- compact first-failure facts and the reason later success did not erase them;
- migration and anonymous-readback receipts;
- enough deterministic verifier code to reject missing, changed or mismatched external bytes.

`KEEP_IN_GIT` does not mean that every current JSON ledger is already minimal. Several ledgers embed
full member inventories and are themselves multi-megabyte objects. The later contract must decide
which member inventory remains beside the claim and which is part of the immutable external object.

### `EXTERNALIZE_CANDIDATE`

The first families worthy of a contract-level migration experiment are:

1. raw Design QA observation ZIPs and non-current native capture cohorts;
2. risk-host and reference-path qualification input containers;
3. rejected-candidate raw observation containers;
4. the deep reference-path local-candidate trees that prevent a normal Windows worktree checkout.

This ordering reflects observed user cost and retained size. It does not grant permission to move
any member of those families.

### `KEEP_IN_PLACE_FOR_NOW`

The M4 and M5 bounded validation trees are small relative to the dominant families and remain active
inputs to current verification. They should stay in place until one general externalization contract
has been proven on a smaller pilot object and its consumer path.

### `CI_EPHEMERAL`

Per-commit build output that is not promoted to a named failure or qualification may remain a
time-bounded CI artifact. Expiry must be explicit and cannot be used for a later frozen claim.

### `DELETE_CANDIDATE`

No current retained-evidence family is certified for deletion by this audit. Exact duplicate bytes,
superseded visuals and unreferenced paths may still record a distinct observation, review input or
historical decision. Deletion needs its own reference, claim and build audit after externalization is
available; storage pressure alone is not evidence that the bytes are disposable.

## Minimum externalization contract question

The next contract should answer only this question:

> Can one immutable retained evidence object be published outside the source tree, bound to its
> original claim and Git provenance, anonymously or otherwise explicitly read back from a clean
> environment, verified byte-for-byte, and consumed fail-closed before the corresponding current-tree
> bytes become eligible for removal?

The minimum candidate record needs to bind:

```text
external evidence schema version
evidence object ID
original Git path
original Git blob and first retaining commit
source / reviewed-head / accepted-main coordinates as applicable
claim or failure IDs
media type and byte length
SHA-256 of the complete object
member-manifest identity when the object is a container
storage locator and locator type
publication observation
clean readback observation
consumer/verifier version
migration state
```

The locator must not be the object identity. If the locator changes while the object digest and claim
binding remain stable, the move is a transport update. If the bytes change, it is a new object and
cannot inherit the old qualification.

## Candidate migration state machine

The later contract should make migration monotonic and fail-closed:

```text
IN_GIT
    -> EXTERNAL_PUBLICATION_CANDIDATE
    -> EXTERNAL_READBACK_VERIFIED
    -> DUAL_RETAINED
    -> CONSUMERS_MIGRATED
    -> CURRENT_TREE_REMOVAL_ELIGIBLE
    -> EXTERNALIZED
```

At every state before `CURRENT_TREE_REMOVAL_ELIGIBLE`, failure leaves the original Git bytes in
place. `EXTERNALIZED` means that the current main tree uses the qualified external object; it does
not mean that historical commits were rewritten.

Minimum removal eligibility must include:

1. external publication under a stable named coordinate;
2. independent readback of the complete bytes from a clean environment;
3. size and SHA-256 equality with the original tracked file;
4. container-member verification when applicable;
5. preservation of original Git path, blob and retaining-commit provenance;
6. migration of every build, test, documentation and verifier consumer;
7. fail-closed behavior when the external object is absent, unavailable or mismatched;
8. protected merge and exact-main verification of the migrated consumer;
9. an explicit human authorization for current-tree removal.

## Storage-provider requirements, not a provider decision

The provider is deliberately unresolved. A qualifying destination must support the contract rather
than redefine it. At minimum it must offer:

- stable retrieval coordinates with a documented lifecycle;
- access semantics recorded as public-anonymous or explicitly authenticated;
- byte-for-byte retrieval without transparent content rewriting;
- objects large enough for current retained containers;
- a way to prevent or detect overwrite and deletion;
- independent readback from a fresh environment;
- retention and recovery semantics that do not depend on one developer workstation;
- predictable cost and quota behavior.

A mutable download URL can be a locator only when the Git-resident digest remains authoritative and
readback rejects changed bytes. A provider that requires an expiring CI artifact, hidden local cache
or undocumented credential cannot satisfy the permanent-retention role.

## Gate question left open

The current required gates re-verify some immutable historical inputs on every PR and main push. A
future design may separate:

```text
candidate conformance
    current source and current behavior

historical integrity
    immutable evidence object and claim binding

external availability
    current locator still retrieves the qualified bytes
```

That separation is not automatically a weakening, but it is not automatically equivalent either.
Before changing workflows, a later audit must identify which present check proves each fact, how
often that fact can change, and what gate still fails when an external object is lost or corrupted.
No required check is changed by this audit.

## History boundary

The first externalization implementation must not rewrite published Git history. Rewriting would
change the exact commit coordinates used throughout JPyxis reviews, manifests and public CI records.
It would therefore be a repository-identity migration, not evidence cleanup.

Removing qualified objects from the current tree can still:

- restore normal checkout and worktree path behavior;
- reduce current-tree disk use;
- reduce shallow and filtered checkout transfer;
- stop future growth;
- make evidence ownership and retrieval explicit.

It cannot make existing published commits forget their blobs. Any later proposal for a new repository
or rewritten history requires a separate continuity contract and is outside this audit.

## Counterexamples that stop the next contract

The externalization contract must stop if any proposed design:

- treats a URL, release name or provider object key as the evidence identity;
- permits replacement of bytes behind an old qualified identity;
- deletes Git bytes before independent readback and consumer migration;
- converts an unavailable external object into a passing or silently skipped gate;
- retains only a summary for a claim whose acceptance requires raw observations;
- requires one developer's local cache, account session or undocumented secret for recovery;
- rewrites first-failure history after a repaired object succeeds;
- weakens a required gate merely to avoid downloading retained evidence;
- claims ordinary clone-size reduction without accounting for already published Git history.

## Audit disposition

The current problem is real and narrower than “too many files”:

> JPyxis has a qualified evidence-retention discipline, but no qualified separation between evidence
> identity, durable external storage and source-repository residency.

The repository has already crossed a user-visible boundary: retained evidence dominates its bytes
and can prevent a normal Windows worktree checkout. Exact duplicate deletion and internal archiving
cannot solve that problem without weakening or merely relocating it.

This audit is independently accepted and qualified on exact main. The next authorized work is a
separate, provider-aware **external evidence identity, publication and readback contract** for one
bounded pilot object. It may compare storage candidates and specify a migration ledger. It may not
move existing evidence, modify current consumers, remove current-tree bytes, rewrite history or
change required checks until that contract has passed its own qualification.

Current state:

```text
EVIDENCE_RETENTION_EXTERNALIZATION_PRECONTRACT_AUDITED
EXTERNAL_EVIDENCE_CONTRACT_NOT_STARTED
NO_BYTES_MOVED
NO_DELETION_AUTHORIZED
NO_HISTORY_REWRITE_AUTHORIZED
```

## Iteration record

### Intended work

Classify repository evidence pressure and determine whether a safe cleanup could begin.

### Why it was attempted

The project had accumulated a large Design QA and qualification history, while the existing archive
policy explicitly required an externalization contract before size reduction.

### Planned method

Bind exact main, inventory retained bytes, inspect references and current gate consumers, distinguish
retention from repository residency, and authorize only the smallest supported next boundary.

### Actual observations

- a normal Windows worktree path failed on deep retained-evidence filenames;
- evidence occupies 580.01 MiB of a 603.65 MiB tracked tree;
- ZIP containers occupy 495.81 MiB;
- embedded host JARs account for 427.84 MiB of compressed ZIP payload;
- exact whole-file duplicates account for only 8.87 MiB;
- current required paths actively verify retained evidence;
- CI artifacts expire after 14 days;
- current Git packs remain about 474.53 MiB even if current-tree paths later move.

### Corrections made to the starting model

The task cannot be treated as duplicate cleanup, an archive move, or deletion of old screenshots.
The first missing object is a durable external evidence identity and migration contract. Gate reuse
and history reduction are separate later questions.

### Final state and stopping line

This document records a pre-contract audit candidate only. No retained byte, verifier, workflow,
effective project state or public coordinate changes in this iteration. After independent review,
protected merge and exact-main qualification, a later iteration may draft only the bounded external
evidence contract; implementation remains unauthorized.

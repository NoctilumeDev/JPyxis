# Residual Hygiene Closeout Contract

Status: `CANDIDATE · CONTRACT ONLY · GATE NOT IMPLEMENTED · CURRENT CLOSEOUT HELD`

Contract base: `main@b9f2fe46745b5c93c599f505a46912d3054f21d8`

## Purpose

JPyxis needs a bounded stage-exit rule for material created during implementation, qualification,
documentation and product review. The rule exists so that a completed stage does not carry files,
local state or representations that no longer serve the product, a consumer or a proof obligation.

This is a project-owned closeout contract. It is not a new JPyxis runtime capability, a general
evidence system, a repository-size target or a VeriTrail responsibility.

The gate answers one question:

> After a named stage has finished its substantive verification, is every material item that remains
> reachable still owned, consumed or required, and have all authorized removals occurred without
> weakening the product or its evidence?

## Place in the stage lifecycle

Residual hygiene runs after the stage's implementation and substantive qualification, but before the
project publishes the final state projection for that stage:

```text
implementation
    -> tests and qualification
    -> inventory
    -> classification
    -> authorized remediation
    -> regression and readback
    -> Residual Hygiene Gate
    -> README / site / milestone projection
    -> stage closeout
```

The gate does not prove business correctness. It consumes the stage's existing verification results
and checks that closeout did not leave misleading, harmful or ownerless residuals.

## Trigger and scope

The complete gate is required for a milestone, release, product-surface replacement or other explicit
stage closeout. It is not a demand to produce a permanent cleanup report for every commit.

Each invocation must name:

- the exact source coordinate being closed;
- the stage or product surface in scope;
- the inventory boundary;
- the verification commands or public gates that witness non-regression;
- the current public projections that may change only after the gate passes.

An inventory may inspect the whole repository while remediating only the named scope. Observing an
unrelated issue does not authorize widening the current cleanup.

## Required sequence

### 1. Inventory

Inventory records what exists before deciding what it means. At minimum it asks:

- what source, generated output, evidence, documentation, image, archive and local environment state
  the stage produced;
- which product, build, workflow, test, document, manifest, receipt or human review consumes it;
- whether it is reproducible from retained source and locks;
- whether it is the only retained copy of a fact or observation;
- whether its path, size, format or lifetime causes a current user or contributor cost.

Absence of a textual reference is not proof that an item is disposable.

### 2. Classification

Every in-scope item or coherent family receives exactly one proposed disposition:

| Class | Meaning | Closeout consequence |
| --- | --- | --- |
| `KEEP_IN_PLACE` | Current product material, active documentation, or evidence with a named owner, consumer or proof obligation. | Remains at its current qualified coordinate. |
| `ARCHIVE` | Superseded non-authoritative material with continuing historical or design value and no active product or evidence coordinate. | May move only with enough provenance to preserve its meaning. |
| `DELETE_CANDIDATE` | Reproducible or duplicated material with no remaining product, evidence, documentation or historical responsibility. | May be deleted only after reference and non-regression checks. |
| `EXTERNALIZE_CANDIDATE` | Retained material whose current repository residence causes real cost but whose bytes still carry a proof or historical obligation. | Requires a separate identity, publication, readback and consumer-migration contract. |
| `UNKNOWN` | Ownership, consumption, reproducibility or proof responsibility is unresolved. | Blocks `PASS`; uncertainty may not be converted into deletion. |

Classification is semantic. File extension, age, directory name, lack of imports and byte size may
trigger inspection, but none of them grants a disposition by itself.

### 3. Authorized remediation

Only a reviewed classification authorizes a move or deletion. Remediation must preserve these
boundaries:

- original failure is not erased by a later successful run;
- evidence identity is not replaced by a summary or locator;
- `ARCHIVE` does not become a default destination for material whose value is unknown;
- an `EXTERNALIZE_CANDIDATE` stays in place until its separate migration reaches removal eligibility;
- deleting current-tree bytes is distinct from rewriting published Git history;
- disposable local state is removed only after confirming that no unique database, volume, credential,
  artifact or observation lives there.

When no item qualifies for safe remediation, the correct action is to change no bytes.

### 4. Regression and readback

The closeout must run verification proportional to the affected responsibilities. Candidate checks
include:

- repository and local-link verification;
- build and automated tests;
- product or browser verification for changed presentation assets;
- retained-evidence verification for changed evidence consumers;
- clean or installed-product readback when the stage normally requires it;
- local process, container or volume shutdown checks when dormancy is in scope.

The contract does not require every project gate for an unrelated documentation-only classification.
The closeout record must state which checks were selected and why they cover the change.

## Gate result

The gate has three terminal results:

### `PASS`

`PASS` requires all of the following:

1. the inventory and exact source coordinate are closed;
2. no item remains `UNKNOWN`;
3. every `KEEP_IN_PLACE` item has a current owner, consumer or proof obligation;
4. every `ARCHIVE` item satisfies the archive admission rule and has retained provenance;
5. every authorized deletion or move is complete;
6. every blocking `EXTERNALIZE_CANDIDATE` has reached its separately defined removal or accepted
   retention state;
7. required references, builds, tests and readbacks pass after remediation;
8. no public projection claims a stronger state than the observed closeout.

An `EXTERNALIZE_CANDIDATE` is blocking when the named closeout intends to resolve its repository cost
or when the current representation already causes a reproduced user or contributor failure. Merely
recording that failure does not turn it into `PASS`.

### `HELD`

`HELD` means the inventory and classification are usable, but at least one known item still requires
an authorized migration, decision or repair. It is an honest stopping state, not a failed cleanup and
not permission to publish the stage as closed.

### `FAIL`

`FAIL` means the proposed closeout is invalid or caused a regression. Examples include a broken
reference, missing retained bytes, digest mismatch, failed product check, unclassified deletion,
premature public state projection or a supposedly dormant environment with unique live state.

A later `PASS` does not rewrite the historical fact that an earlier invocation returned `FAIL` or
`HELD`.

## Minimal output

The gate must not create a second evidence-retention problem. Its durable output should normally be
limited to a short result tied to Git, PR and CI coordinates:

```text
Residual Hygiene: PASS | HELD | FAIL
Source: <exact revision>
Scope: <stage or product surface>

KEEP_IN_PLACE          <count>
ARCHIVED               <count>
DELETED                <count>
EXTERNALIZE_CANDIDATE  <count>
UNKNOWN                <count>

Verification: <named checks>
Blocking reason: <none or concise reason>
```

The Git diff records removed or moved paths. The PR records review. Existing tests and CI record
non-regression. The hygiene gate must not generate screenshots, duplicate all deleted-file hashes or
retain every intermediate scan merely to prove that cleanup occurred.

The first failure or counterexample is retained only when it changes the project model, invalidates a
claim or is otherwise required by an existing evidence contract. Ordinary failed glob scans are not
automatically permanent evidence.

## Automation boundary

A future repository-local verifier may mechanically reject:

- tracked build, cache, editor, test-output or temporary paths forbidden by project policy;
- archived cohorts without their required provenance record;
- missing or broken current-document references;
- a closeout result whose stated source coordinate or counts do not match the candidate tree;
- a `PASS` result that still names `UNKNOWN` or blocking externalization work;
- a public project-state projection that precedes the qualified gate result.

Automation may propose classifications and count files. It cannot decide historical value, evidence
responsibility or deletion authority. No script may turn `UNKNOWN` into `DELETE_CANDIDATE` simply to
make the gate green.

## No size KPI

Repository size, file count, path depth and local disk use are audit signals. They are not success
thresholds.

A small unreferenced asset may be a deletion candidate. A large qualified observation may need to
remain. Conversely, a large retained family that prevents an ordinary checkout is a real contributor
cost and cannot be dismissed merely because its evidence remains valid.

## Local dormancy profile

When a stage explicitly places a local application into dormancy, its scoped closeout may also check:

```text
source + locks + migrations + reproducible scripts retained
    -> no unique local state
    -> disposable processes stopped
    -> disposable containers, images, volumes and dependencies removed
    -> LOCAL_DORMANT
```

This profile is optional and project-specific. It must never remove a volume or local database until
the absence of unique state is established.

## Current JPyxis disposition

At the contract base:

- the first historical-residual pass archived 17 superseded visual references with provenance;
- the current tree contains no tracked `node_modules`, `target`, `build`, `dist`, coverage,
  Playwright-output, temporary-suffix, editor-cache or root-binary residual detected by the bounded
  closeout scan;
- no additional retained family currently has sufficient authority for deletion;
- retained evidence occupies about 580 MiB of the roughly 604 MiB tracked tree;
- a normal Windows worktree path has reproduced `Filename too long` failures;
- the external evidence identity, publication, readback and consumer-migration contract has not
  started.

Therefore the honest current result is:

```text
RESIDUAL_HYGIENE_CONTRACT_CANDIDATE
RESIDUAL_HYGIENE_GATE_NOT_IMPLEMENTED
RESIDUAL_HYGIENE_CLOSEOUT_HELD
BLOCKER: QUALIFIED_EXTERNAL_EVIDENCE_PATH_NOT_ESTABLISHED
NO_NEW_DELETE_CANDIDATES
NO_PUBLIC_STATE_PROJECTION_AUTHORIZED
```

The known checkout failure makes the unresolved externalization family blocking for this repository
closeout. A gate that ignores it and returns `PASS` would optimize the status label rather than the
user experience.

## Qualification and next authority

This candidate may become a JPyxis closeout contract only after review, protected merge and exact-main
verification. That qualification still does not implement the gate or authorize evidence migration.

After qualification, the next bounded work is the separately identified external evidence contract
for one pilot object. A successful pilot proves only that one externalization mechanism is eligible
for wider use. It does not close the repository-wide hygiene result. The gate may return `PASS` only
after every blocking family in the named closeout has completed its authorized remediation and
post-remediation verification.

README, the public Observatory, Project Charter and Vision must remain unchanged during this
candidate. They may project a hygiene closeout state only after the real gate passes.

## Stop conditions

Stop and reopen the minimum affected boundary if any proposal:

- uses repository size or a target file count as deletion authority;
- makes `ARCHIVE` a default sink for unresolved material;
- deletes or repacks retained evidence before its consumers migrate;
- weakens a required build, test, readback or evidence check to obtain `PASS`;
- treats an expired CI artifact or one developer's local cache as durable retention;
- claims that current-tree deletion rewrites published history;
- lets the cleanup producer award its own evidence or product verdict;
- generates a larger permanent cleanup dossier than the residuals it removes;
- updates the public project state before the qualified gate result exists.

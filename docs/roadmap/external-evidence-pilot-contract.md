# External Evidence Pilot Contract

Status: `CONTRACT FROZEN · PROVIDER PRECONDITION UNSATISFIED · NO BYTES MOVED`

Contract base: `main@8e773a216b1b12ef2ab81b02f9e9ae0e3113f4a8`

Qualification coordinate: `main@60ae50247f9da60c22d1798e2ccac9048319aa37`

## Qualification record

The contract entered the protected repository through
[PR #48](https://github.com/NoctilumeDev/JPyxis/pull/48):

- reviewed head: `5e1ba7236630e355711d55312003c30e4d9b02b9`;
- merge revision: `60ae50247f9da60c22d1798e2ccac9048319aa37`;
- pull-request Repository Gates: run `37219940544`, all four jobs succeeded;
- pull-request Observatory demo: run `37219940605`, build verification succeeded;
- exact-main Repository Gates: run `37220255027`, all four jobs succeeded at the merge revision;
- exact-main Observatory demo: run `37220254985`, build and deployment succeeded at the merge
  revision.

Independent reconciliation at the qualification coordinate re-observed the pilot as 156507 bytes,
SHA-256 `1fb9d9fd4254ef51a190881cc76e784e4548e55cd93aa091399e7dfc12db7ee0` and Git blob
`b7b6fd73946ab814289fc7c63442f569eec89213`. It also re-observed repository immutable Releases as
`enabled: false`, `enforced_by_owner: false`.

These coordinates freeze the object identity, provider prerequisites, authority boundaries,
publication/readback ordering, migration states and removal-eligibility rules. They do not satisfy
the provider prerequisite, change a repository setting, create a Release or tag, publish an asset,
modify a consumer, move bytes or authorize removal.

## Purpose

This contract defines one bounded external-evidence pilot for JPyxis. It exists to answer one
question before any repository evidence is removed:

> Can one already-retained ZIP be given a content identity independent of its storage locator,
> published under an immutable provider coordinate, retrieved without repository credentials from a
> clean environment, verified byte-for-byte and member-for-member, and consumed fail-closed while
> the original Git copy remains available?

The pilot is a storage and consumer-continuity experiment. It does not requalify the risk-scoring
reference host, redesign evidence in general, close the repository-wide Residual Hygiene Gate, or
authorize removal merely because an upload succeeds.

## Upstream authority

This contract consumes, and does not reopen:

- the independently qualified
  [Evidence Retention and Externalization Pre-Contract Audit](evidence-retention-externalization-precontract-audit.md);
- the frozen
  [Residual Hygiene Closeout Contract](residual-hygiene-closeout-contract.md);
- the existing risk-host qualification claim and its retained byte/member verification.

The upstream audit authorizes a provider-aware contract for one pilot. It does not authorize a
Release, repository setting change, consumer edit, evidence removal, tag creation or history rewrite.

## Pilot object

The pilot is deliberately small but exercises the same identity, container and consumer boundaries
as the larger retained families.

| Field | Frozen candidate value |
| --- | --- |
| role | first superseded visual-polish observation container |
| original Git path | `evidence/risk-scoring-reference/v1/design-qa/polish-v2/raw-observations.zip` |
| media type | `application/zip` |
| byte length | `156507` |
| SHA-256 | `1fb9d9fd4254ef51a190881cc76e784e4548e55cd93aa091399e7dfc12db7ee0` |
| Git blob | `b7b6fd73946ab814289fc7c63442f569eec89213` |
| first retaining commit | `a4136cb022d4bffe67ea182dd4a9ae5b4075bd32` |
| observed source revision | `16e769f3dfc8aae30aa2f1bd61a6a839e7e94a4e` |
| observed source tree | `23506fb40bcc9b63bb4c5629aaeeda3428fd691f` |
| disposition before this pilot | `IN_GIT` and `SUPERSEDED`, with retention verdict `PASS` |

The existing member ledger remains in Git at
`evidence/risk-scoring-reference/v1/design-qa/polish-v2/raw-retention.json` and is bound as:

```text
bytes       16140
sha256      19fe1549043e5b7cf748168ed12fa9f357dbf09fc17aa03ec4461ec71cbffbda
git blob    fb997629d567bd938d22c3a1fdd8f5fb8fa8024f
```

The existing iteration record remains in Git at
`evidence/risk-scoring-reference/v1/design-qa/polish-v2/iteration.json`, records the P2 flex-card and
P3 motto-spacing findings, and binds the same source revision and tree. Externalization must preserve
that first-failure meaning; the later polish success does not erase it.

## Identity model

The canonical evidence-object identity is content based:

```text
schema       jpyxis.io/external-evidence-object/v1
algorithm    sha256
digest       1fb9d9fd4254ef51a190881cc76e784e4548e55cd93aa091399e7dfc12db7ee0
bytes        156507
mediaType    application/zip
```

The compact object ID is:

```text
sha256:1fb9d9fd4254ef51a190881cc76e784e4548e55cd93aa091399e7dfc12db7ee0
```

The byte length and media type remain required validation fields even though they are not repeated
inside the compact ID. The Git-resident member ledger is the member-manifest authority for this
pilot. A provider-computed digest is corroborating transport metadata, not the source of the object
identity.

These identities must remain distinct:

```text
Evidence object identity
    complete bytes + digest + length + media type

Claim binding
    original Git provenance + source observation + first-failure meaning

Provider locator
    repository + release/tag + release ID + asset ID + asset name + download URL

Publication observation
    what the provider reported after immutable publication

Readback observation
    what a fresh anonymous consumer actually received
```

Therefore:

```text
same URL              != same evidence object
upload succeeded      != immutable publication
immutable publication != anonymous readback
readback succeeded    != member or claim validation
```

If the complete bytes change, the result is a new evidence object. It cannot inherit this object's
ID, qualification or removal eligibility. If only a locator changes while the verified object ID and
claim binding remain stable, that is a transport update and requires a new locator/readback record.

## Provider decision for the pilot

The bounded provider candidate is a **GitHub immutable Release asset in the same public repository**.
This selection applies only to the pilot. It is not a universal JPyxis storage abstraction or a
decision for every retained-evidence family.

The provider is suitable in principle because a published immutable Release locks its assets and
tag, exposes asset size and SHA-256 metadata, supports public retrieval, and can be independently
verified. GitHub Actions artifacts are not eligible for this permanent-retention role because they
expire under configured retention and their lifecycle is tied to workflow runs.

Release immutability does not make every Release field an identity field. GitHub still permits edits
to the title and notes and permits changing pre-release/latest presentation flags. Those values must
not participate in evidence identity or claim qualification. Immutability also does not make the
repository indestructible. The retained original Git blob and first-retaining commit remain the
pilot's recovery origin; this is another reason history rewrite stays outside this contract.

The repository does not currently satisfy the provider precondition. At the candidate base, the
GitHub repository API reported:

```text
GET /repos/NoctilumeDev/JPyxis/immutable-releases
enabled: false
enforced_by_owner: false
```

An ordinary mutable Release is insufficient. No publication may begin until a separately authorized
operator action enables immutable Releases and an independent readback observes `enabled: true`.
Enabling this setting affects all future releases in the repository; the pilot contract does not
silently grant that repository-wide policy mutation.

Provider facts used by this candidate are documented by GitHub in:

- [Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases);
- [Preventing changes to your releases](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes);
- [Verifying the integrity of a release](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity);
- [Release assets REST API](https://docs.github.com/en/rest/releases/assets);
- [GitHub Actions artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts).

Provider documentation is an input to the contract, not evidence that this repository has already
enabled or exercised the capability.

## Provider coordinate

The publication implementation must use a dedicated evidence-only Release namespace. It must not
reuse a product or milestone release and must not become the product's latest-release claim.

Candidate naming rules are:

```text
release tag     evidence-pilot-v1
release title   JPyxis external evidence pilot v1
release class   evidence-only; prerelease; not latest
asset name      polish-v2-raw-observations-1fb9d9fd4254ef51a190881cc76e784e4548e55cd93aa091399e7dfc12db7ee0.zip
```

The tag must target the exact qualified main revision from which publication is authorized. The
later migration ledger must record the actual tag target, release ID, asset ID and URLs. Those fields
locate the object; they do not replace its content identity.

If a published immutable Release contains wrong bytes or metadata, the publication is rejected and a
new release namespace is required. The old tag or asset name must not be reused to make the failed
publication appear repaired.

## Authority boundaries

| Actor or artifact | May do | Must not do |
| --- | --- | --- |
| Existing risk-host qualification | Own the claim and first-failure meaning. | Derive storage availability from an upload. |
| Git-resident retention ledger | Bind complete-object and member identities. | Claim that a locator is durable or currently reachable. |
| Publisher | Create a draft, upload the candidate bytes and publish after checks. | Qualify its own publication or authorize Git removal. |
| GitHub Release provider | Store bytes and report release/asset metadata. | Become the authority for JPyxis claim identity. |
| Independent readback verifier | Retrieve without repository credentials and compare bytes, digest, size and members. | Turn an unavailable or mismatched object into `PASS`. |
| Existing retention verifier | Re-evaluate the ZIP contents and risk-host provenance. | Silently skip the pilot because the provider is unavailable. |
| Human reviewer | Authorize the repository setting change and, later, current-tree removal. | Retroactively erase failed publication/readback attempts. |
| Residual Hygiene Gate | Consume the qualified migration state. | Grant migration or deletion authority to itself. |

## Publication protocol

Publication is a separate implementation closure after this contract is frozen. It must proceed in
this order:

1. re-bind exact main and confirm that the pilot Git blob, length, SHA-256, member ledger and first
   retaining commit still match this contract;
2. obtain explicit human authorization for the repository-wide immutable-Release setting;
3. enable immutability and independently read back `enabled: true` before creating the pilot Release;
4. create an unpublished draft targeting the authorized exact-main revision;
5. upload exactly one content-addressed pilot asset;
6. before publication, compare local bytes, provider size and provider digest; a mismatch destroys
   the draft candidate and advances no migration state;
7. publish the draft as evidence-only and observe the resulting release as immutable;
8. preserve the publication coordinate and first publication failure, if any, in a compact migration
   ledger;
9. perform fresh anonymous readback before changing any consumer or Git-resident byte.

The draft is staging state, not durable evidence. The published immutable release is still only a
publication candidate until independent readback succeeds.

## Anonymous readback contract

The first readback must run from a clean temporary environment with:

- no GitHub token, authenticated `gh` session, browser session or local evidence cache available to
  the retrieval process;
- no fallback to the current Git-resident ZIP;
- a bounded absolute retrieval deadline and bounded retry policy for explicit transient transport or
  server failures;
- retained attempt facts that preserve the first HTTP or transport failure rather than replacing it
  with a later success;
- exact byte-length and SHA-256 comparison;
- ZIP member-name, member-length and member-SHA-256 comparison against the Git-resident ledger;
- source revision, source tree, five-request receipt and owned-worker shutdown checks equivalent to
  the current `scripts/verify-risk-host-retention.py` consumer.

A later successful readback may establish current availability. It does not rewrite an earlier
failed attempt. Provider unavailability is an availability failure; a digest/member mismatch is an
integrity failure; an invalid claim binding is a provenance failure. They must not be collapsed into
one generic download error.

## Migration state machine

The pilot state is monotonic:

```text
IN_GIT
    -> PROVIDER_PRECONDITION_SATISFIED
    -> EXTERNAL_PUBLICATION_CANDIDATE
    -> EXTERNAL_READBACK_VERIFIED
    -> DUAL_RETAINED
    -> CONSUMERS_MIGRATED
    -> CURRENT_TREE_REMOVAL_ELIGIBLE
    -> EXTERNALIZED
```

Meaning:

- `IN_GIT`: the current state; the ZIP and its consumer remain unchanged;
- `PROVIDER_PRECONDITION_SATISFIED`: immutable Releases are independently observed as enabled;
- `EXTERNAL_PUBLICATION_CANDIDATE`: a published immutable release exposes the expected asset
  coordinate and metadata;
- `EXTERNAL_READBACK_VERIFIED`: a clean anonymous process retrieved and verified the complete ZIP;
- `DUAL_RETAINED`: Git and external copies coexist and the compact migration ledger is qualified;
- `CONSUMERS_MIGRATED`: every current consumer uses the external object fail-closed and passes its
  protected PR and exact-main checks;
- `CURRENT_TREE_REMOVAL_ELIGIBLE`: all technical preconditions hold and a human has explicitly
  authorized a separate removal change;
- `EXTERNALIZED`: the current main tree no longer carries the ZIP, the external consumer is
  qualified, and post-removal exact-main checks have passed.

No failure before `CURRENT_TREE_REMOVAL_ELIGIBLE` changes the current Git copy. Eligibility is not
removal, and removal is not history rewrite.

## Consumer migration contract

The first consumer in scope is `scripts/verify-risk-host-retention.py`. Migration must be a separate
change after publication and anonymous readback qualification. It must:

- read the compact migration ledger from Git;
- download to a unique temporary file rather than the final cache path;
- validate the complete object before exposing it to ZIP/member verification;
- never fall back to the removed current-tree path after externalization;
- fail closed for missing, unavailable, truncated, oversized, mismatched or malformed bytes;
- clean partial files and avoid treating a previous successful cache entry as a fresh readback;
- preserve the existing `polish-v2` claim, member checks and `SUPERSEDED` classification;
- leave `polish-v3` and every unrelated evidence family unchanged.

A cache may be added only under a later explicit cache-identity contract. The pilot does not gain a
cache merely for convenience.

## Compact migration ledger

An implemented pilot may add one ledger under
`archive/historical-residuals/migration-ledgers/`. Its minimum fields are:

```text
schemaVersion
objectId
mediaType
bytes
sha256
memberLedgerPath
memberLedgerSha256
originalGitPath
originalGitBlob
firstRetainingCommit
claimRecordPath
claimRecordSha256
sourceRevision
sourceTree
provider
repository
releaseTag
releaseId
releaseTarget
releaseImmutable
originalRecoveryCommit
originalRecoveryGitBlob
assetId
assetName
browserDownloadUrl
providerDigest
publicationObservedAt
publicationRevision
anonymousReadbackObservedAt
readbackVerifierRevision
migrationState
```

The ledger records facts; it does not make a release immutable, prove current availability, or grant
removal eligibility by assertion. State transitions must be witnessed by the corresponding provider,
readback, consumer and exact-main evidence.

## Removal eligibility

The pilot ZIP becomes technically eligible for a separate removal proposal only after all of these
are true:

1. this contract is frozen through protected merge and exact-main gates;
2. immutable Releases were explicitly enabled and independently observed;
3. publication produced the exact object under an immutable evidence-only release;
4. a fresh anonymous process verified complete bytes and every ZIP member;
5. the compact migration ledger entered main through protected review;
6. the migrated consumer fails closed under absence, transport failure, digest mismatch, member
   mismatch and wrong locator mutations;
7. the original required Repository Gates and Observatory checks succeed on consumer-migration main;
8. a second clean anonymous readback succeeds from that exact main;
9. a human explicitly authorizes the independent current-tree removal PR.

Removal then requires its own protected merge, exact-main verification and post-removal readback. A
successful pilot does not authorize migration or deletion of the other 43 retained ZIPs.

## Qualification boundary

This contract is frozen through:

```text
final contract bytes
    -> repository/link verification
    -> original pull-request Repository Gates and Observatory build
    -> protected merge
    -> new exact-main Repository Gates and Observatory deployment
    -> independent reconciliation of the provider setting and pilot identities
```

Contract qualification does not enable immutable Releases, create a tag or Release, upload an asset,
modify `scripts/verify-risk-host-retention.py`, move bytes or authorize removal.

Current frozen state:

```text
EXTERNAL_EVIDENCE_PILOT_CONTRACT_FROZEN
PILOT_OBJECT_IDENTITY_BOUND
PROVIDER_CANDIDATE_GITHUB_IMMUTABLE_RELEASE
PROVIDER_PRECONDITION_UNSATISFIED
PILOT_BYTES_IN_GIT
NO_PUBLICATION_AUTHORIZED
NO_CONSUMER_MIGRATION_AUTHORIZED
NO_REMOVAL_AUTHORIZED
NO_HISTORY_REWRITE_AUTHORIZED
```

## Stop conditions

Stop and reopen the minimum affected boundary if any implementation:

- treats the release tag, asset ID, asset name or URL as the evidence identity;
- publishes while repository immutability is disabled or unobserved;
- uploads directly to a published mutable release;
- uses an Actions artifact, developer machine or undocumented credential as permanent retention;
- lets publisher success replace independent anonymous readback;
- deletes or changes the Git copy before consumer migration and explicit removal authorization;
- silently falls back to Git or cache when the external object is unavailable;
- retries integrity, provenance or semantic failures as if they were transient transport failures;
- marks a later success as erasing a failed publication or readback attempt;
- changes the original risk-host claim, `SUPERSEDED` meaning or member ledger to simplify migration;
- turns this one-object pilot into authority for repository-wide evidence deletion;
- updates README, Observatory, Project Charter, Vision or milestone state before the real Residual
  Hygiene Gate passes.

## Next authority after qualification

The next bounded work is a provider-activation and publication candidate for this one object.
Because immutable Releases are currently disabled and enabling them changes the lifecycle of all
future repository releases, that next step still requires explicit human authorization before the
setting is changed.

# Historical Residuals

This directory classifies material that is no longer part of the current product surface but still
has historical or design value. It is not a dumping ground and it is not an alternative evidence
store.

## Admission question

Before moving or deleting anything, ask:

> If this material remains where it is, will it harm a user or contributor experience, misstate the
> current project, enter a product/release build, or create a real maintenance risk?

If the answer is no, leave it alone unless classification materially improves navigation. A cleaner
tree is not enough reason to invalidate an existing coordinate.

## Classification gate

| Class | Meaning | Allowed action |
| --- | --- | --- |
| `KEEP_IN_PLACE` | Active product material or retained evidence referenced by a contract, report, digest, manifest, CI/readback record, or public document. | Do not move or delete. |
| `ARCHIVE` | Non-authoritative planning/design material that has been superseded, is not consumed by the product, and has no active evidence coordinate. | Move here with provenance and byte digests. |
| `DELETE_CANDIDATE` | Generated or duplicated material with no product, evidence, documentation, or historical value. | Delete only after an explicit reference and build audit. |
| `EXTERNALIZE_CANDIDATE` | Large raw evidence that affects repository use but still has retention value. | Migrate only under a separate immutable-storage and readback contract. |

Absence of a textual reference is not sufficient for deletion. Original failures, raw observations,
independent review inputs, qualification artifacts, and anything covered by a retention ledger remain
evidence even when they are visually obsolete.

## Categories

- [`plans/`](plans/): superseded, non-normative planning material that is safe to detach from the
  current documentation path.
- [`design-references/`](design-references/): visual directions and comparison composites, not
  executable product assets or acceptance evidence.
- [`superseded-prototypes/`](superseded-prototypes/): prototypes whose replacement is established and
  whose original coordinates are not evidence dependencies.
- [`unused-assets/`](unused-assets/): verified deletion candidates awaiting or recording removal.
- [`migration-ledgers/`](migration-ledgers/): future externalization records for large retained bytes.

## Current boundary

The first archive pass moves only 17 unreferenced Observatory visual-direction/comparison images.
Their bytes and SHA-256 values are preserved in the category ledger. No runtime source, public-demo
asset, raw observation archive, first-failure record, qualification input, or retention-bound image is
moved or deleted.

The large `evidence/risk-scoring-reference/v1/design-qa` tree remains in place. Moving those files into
this directory would not reduce Git history and would break documented coordinates. Any future size
reduction requires a separately qualified externalization contract rather than an ad hoc cleanup
commit.

The stage-exit ordering, disposition meanings and `PASS / HELD / FAIL` boundary are frozen by the
[Residual Hygiene Closeout Contract](../../docs/roadmap/residual-hygiene-closeout-contract.md). The
contract is qualified, but the current closeout remains `HELD` until its blocking external-evidence
path is closed. This archive is a classification aid, not evidence that repository hygiene passed.

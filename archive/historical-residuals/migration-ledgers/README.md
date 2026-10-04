# Migration Ledgers

No evidence was externalized in the first archive pass.

Large raw browser-observation archives affect clone size, but they are currently covered by retained
byte ledgers and review records. A future migration must name an immutable destination, preserve
SHA-256 and original coordinates, prove anonymous/readable retrieval where applicable, update every
consumer, and retain a readback record before Git paths are removed. Moving files within the same Git
history is not size reduction.

The qualified pre-contract findings are recorded in the
[Evidence Retention and Externalization Pre-Contract Audit](../../../docs/roadmap/evidence-retention-externalization-precontract-audit.md).
The audit reached exact-main qualification at
`a6665bc1eaab409f1ebc0f9c93a99735c0191f2d`, but authorizes no migration, deletion, workflow change
or history rewrite. The first bounded successor is the
[External Evidence Pilot Contract](../../../docs/roadmap/external-evidence-pilot-contract.md), which
is frozen at `main@60ae50247f9da60c22d1798e2ccac9048319aa37`. Its provider precondition was
unsatisfied at qualification; the separately authorized implementation that followed enabled the
provider and produced the first compact record,
[`external-evidence-pilot-v1.json`](external-evidence-pilot-v1.json).

That record reached `DUAL_RETAINED` after PR #50 entered protected main at
`4854196f3905a487866388550a901377ff633fea`, that exact main passed Repository Gates and Observatory,
and a fresh anonymous byte/member readback passed. The immutable Release asset and original Git ZIP
then coexist under the qualified compact ledger.

It reached `CONSUMERS_MIGRATED` after PR #52 entered protected main at
`28419d0ecbbd3b212c893f39db72458d4448a807`, that exact main passed Repository Gates and Observatory,
and the sole `polish-v2` consumer passed a fresh readback while the local Git ZIP was deliberately
absent. The original ZIP remains in Git. The ledger does not claim removal eligibility,
repository-wide closeout or history reduction.

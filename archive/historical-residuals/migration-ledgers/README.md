# Migration Ledgers

No evidence is externalized in the first archive pass.

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
is a candidate until its own protected-merge and exact-main qualification finishes. This directory
remains empty until a separately qualified external evidence contract produces an actual migration
ledger.

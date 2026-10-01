# ADR-0013: M4 Runtime Handle Conservation

Status: `REVIEWED FOR MINIMUM M4 v2 CONTRACT · IMPLEMENTATION ENTRY GATED`

## Context

ADR-0009 assigns deployment transitions, active binding, pin accounting and Runtime release to
DeploymentManager. Its frozen rollback rule says retired handles are not resurrected. The first
published public-model counterexample shows a faulty Runtime returning a retired tuple to a new
deployment: Core adopts it, commits rollback and pins it again. The separate pre-contract audit
confirms the same identity gap for live owners, failed-release paths and concurrent equal returns.

Those observations do not invalidate the old bounded M4 fixture results or establish actual
process resurrection. They invalidate treating a fresh deployment/load/warm sequence as universal
handle freshness proof for a new product contract.

## Decision

Reopen only returned-handle owner admission and identity conservation through every release path.
Use the existing immutable RuntimeHandle canonical tuple and the existing Manager owner. One
Manager instance retains monotone, in-memory history of identities assigned to deployments.
Every returned tuple is checked atomically with required owner recording and installation, after
the slow callback returns. Equal concurrent returns admit at most one deployment owner.

Rejected live, spent, retired or foreign aliases never enter warmup or candidate cleanup. Rejection
preserves the current active binding and existing pin obligations. Normal unload, successful
failed-warmup release and failed cleanup never erase spent identity. Failed cleanup retains an
UNKNOWN release observation, without introducing a new deployment state or invoking another
owner's handle as a candidate resource.

The separate v2 contract declares the matrix and qualification gates. Its protected annotated
`m4-handle-contract-v2` coordinate qualifies contract authority only. Implementation and its raw
guard evidence must qualify separately before Productization Audit A reruns.

## Conserved boundaries

DeploymentRuntime reports facts; DeploymentManager owns admission, state and release decisions.
ArtifactRegistry still owns immutable bytes, digest and validation. The old M4 state graph, eleven
scenarios, frozen tags/manifests and the qualified M5 v2 boundary remain unchanged. No public
RuntimeRegistry service, M3 binding reinterpretation, environment builder, scheduler or external
Evidence/Verdict authority is added.

The new history belongs only to one Manager lifetime. It does not survive Control restart or
establish cross-Manager/multi-node ownership, physical process reclamation, arbitrary capability
honesty, production readiness or M2/M4/M5 real composition. The first failures and original mixed
candidate remain retained. Larger lifecycle or authority changes require a separate STOP.

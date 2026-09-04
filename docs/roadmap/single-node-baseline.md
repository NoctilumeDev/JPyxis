# Single-node Baseline

Status: `M0 FROZEN · M1 PROTOTYPE IN REVIEW · M2 BLOCKED`

M0-M6 are delivery milestones. Each milestone proves one architecture hypothesis and defines what remains unproven. The sequence is serial: later work may not use an earlier document or prototype as if it were validated evidence.

## Boundary

The baseline targets a bounded CPU-only topology on one physical development machine. Multiple local worker processes may be used to exercise supervision and routing, but they do not establish multi-host behavior.

The reference environment hypothesis is:

```text
16 GB RAM target
commodity x86-64 CPU
no required GPU
one host/control process
bounded local worker processes
one documented bootstrap path
```

Every resource claim remains `INFERRED` until measured and recorded at M6.

## M0 — Architecture

Question: do we know what we are building and what must never be crossed?

Required artifacts:

- project charter and explicit non-goals;
- scoped primary-source prior-art matrix;
- architecture constitution;
- ownership and truth map;
- dependency and plugin rules;
- artifact, plugin, deployment, and invocation state models;
- failure taxonomy and recovery ownership;
- contract principles;
- first vertical-slice decision;
- experiment and evidence plan;
- unresolved questions and rejection conditions.

Exit gate:

- every Core responsibility has a reason it cannot be a plugin;
- every accepted plugin boundary names a capability rather than a product;
- every persisted fact has one final authority;
- prohibited dependency edges are explicit;
- state transitions identify their owner;
- the next milestone has a bounded acceptance test;
- no concrete API is falsely presented as frozen.

Outcome: frozen for M1 entry by the [M0 Architecture Review Gate](../reviews/m0-review-gate.md). The first reference construction boundary is [ADR-0004](../adr/0004-first-reference-vertical-slice.md).

## M1 — Contract

Question: can two runtime bindings agree on the same type and compatibility facts?

Candidate scope:

- deterministic contract identity;
- scalar and record values;
- representative tensor dtype, rank, shape, layout, optionality, and batch constraints;
- stable error categories;
- Java and Python binding or validator fixtures;
- compatibility verdicts for selected schema changes;
- minimum evidence-envelope identities and acceptance-verdict semantics required by ADR-0005.

Acceptance:

- both bindings accept and reject the same contract corpus;
- invalid input is rejected before execution;
- invalid output cannot become success;
- untyped values do not bypass validation;
- exact commands and corpus are reproducible;
- invocation outcome, acceptance verdict, and project evidence state cannot collapse into one field;
- incomplete or conflicting evidence metadata cannot produce an acceptance `PASS`.

Not proven:

- network invocation, runtime replacement, lifecycle, performance, or distributed behavior.

Current evidence: the candidate implementation, shared 38-case corpus, and pending closure checklist
are recorded in the [M1 Contract Review](../reviews/m1-contract-review.md). That record does not
authorize M2 until its public gate and review coordinate are complete.

## M2 — Invocation

Question: can one real invocation complete correctly or fail correctly across the selected process boundary?

Candidate scope:

- typed Java host interface and mapper;
- one control transport;
- one Python definition capability;
- one deterministic CPU algorithm;
- version-pinned dispatch;
- deadline, cancellation, and stable error propagation;
- trace correlation;
- a versioned evidence bundle and an Acceptance Harness outside Core;
- an offline verifier for the deterministic reference workload.

Acceptance:

- success returns a contract-valid typed result;
- bad input never reaches the runtime;
- definition, transport, runtime, timeout, and cancellation cases remain distinguishable;
- exactly one invocation terminal state is authoritative;
- the host does not expose transport- or Python-specific types.
- invocation outcome, acceptance verdict, and project evidence state remain separate;
- a completed bundle can be verified after both runtime processes exit;
- missing, corrupt, reordered, or conflicting evidence cannot produce `PASS`;
- the happy path and named failure cases in ADR-0005 retain independently checkable evidence.

This is the first point at which JPyxis may be called an executable prototype.

## M3 — Runtime Abstraction

Question: can execution implementation change while host and Core semantics remain unchanged?

Candidate scope:

- a conformance fixture or second runtime implementation;
- runtime capability metadata;
- no implementation-name branching in Core;
- contract-stable result and failure behavior.

Acceptance:

- the same host contract passes against two conforming runtime fixtures;
- runtime-specific values remain inside the adapter;
- replacement does not alter state ownership or public error meaning;
- unsupported capabilities fail during resolution rather than mid-execution when knowable in advance.

Not proven:

- arbitrary third-party plugin compatibility or ecosystem maturity.

## M4 — Lifecycle

Question: can immutable versions load, warm, activate, drain, unload, and roll back without ambiguous ownership?

Candidate scope:

- immutable artifact registry semantics;
- deployment state machine;
- active-version binding;
- failed candidate preservation of the current version;
- in-flight invocation pinning;
- rollback and evidence.

Acceptance:

- a failed warmup cannot activate;
- candidate failure leaves the current active version available;
- new work stops entering a draining deployment;
- accepted work receives a defined completion or forced-termination outcome;
- rollback returns to a previously validated artifact without mutating it.

## M5 — Resilience

Question: do named failures preserve invariants and remain explainable?

Candidate scope:

- bounded multiple local workers;
- failure injection across load, warmup, invocation, drain, and unload;
- worker supervision and eligibility changes;
- transport uncertainty and retry safety;
- process restart and authoritative-state recovery;
- required metrics, logs, traces, and state-transition evidence.

Acceptance:

- each injected fault maps to the expected owner and terminal outcome;
- ambiguous remote outcomes are not reported as success;
- retries require explicit idempotency evidence;
- plugin failure does not rewrite unrelated facts;
- recovery can be explained from retained evidence without relying on author memory.

Not proven:

- independent-machine failure, network partition across hosts, or cluster consensus.

## M6 — Reproducibility

Question: does the baseline belong to the project rather than one prepared machine?

Required chain:

```text
clean clone
→ bootstrap
→ build
→ launch
→ register
→ load
→ warm
→ activate
→ invoke
→ observe
→ inject failure
→ recover
→ rollback
→ verify final state
→ stop all runtime processes
→ verify retained evidence offline
```

Required observations:

- toolchain and dependency versions;
- idle and peak process memory;
- build peak memory;
- one-worker and bounded multi-worker memory;
- failure-test resource peak;
- startup and invocation baseline for the declared workload;
- CPU, OS, topology, and absence or use of containers;
- public checks and local-lab proof boundaries;
- known limits and unproven claims.

Exit gate:

- a clean environment follows one documented path;
- every M0-M5 claim links to evidence at an immutable revision;
- each accepted run records an independent verdict without deriving it from invocation success alone;
- the 16 GB target is accepted, narrowed, or rejected from observations;
- the baseline is tagged and frozen only if all required evidence is present.

## Stop conditions

- If direct DJL or ONNX Runtime use meets the selected requirements with lower complexity, narrow or reject the framework scope.
- If ordinary contracts require unvalidated objects or hidden runtime types, narrow the supported domain rather than weaken the boundary.
- If a second implementation cannot use a proposed SPI without Core branching, the plugin boundary is not established.
- If a performance bottleneck is not observed, do not begin E1.
- If the reference machine crosses its defined resource stop line, reduce the active profile rather than claim instability.

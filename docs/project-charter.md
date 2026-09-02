# Project Charter

Status: `M0 FROZEN · M1 ENTRY`

## Purpose

JPyxis studies a contract-driven architecture for heterogeneous compute. It asks whether a host system can keep governance, lifecycle, authorization, and failure decisions explicit while definitions and execution remain replaceable capabilities.

The first reference profile is intentionally small:

```text
Java host and control implementation
→ contract-governed invocation
→ Python definition adapter
→ existing CPU runtime
```

This profile is a proving ground, not the permanent identity of the framework.

## Intended users

The initial user is an engineering team whose business system is governed from a strongly typed host application but whose algorithms or models are most naturally defined in another ecosystem. The team wants to avoid either of these outcomes:

- moving business authority into dynamic definition code;
- hard-coding one language, transport, data representation, or runtime into the application.

## Candidate value

JPyxis may be valuable if it can provide all of the following together:

- mapper-like host ergonomics without hiding version or failure semantics;
- one explicit meaning for scalar, record, and tensor values across boundaries;
- immutable definition artifacts and separately governed activation state;
- replaceable definition, transport, runtime, storage, scheduling, and telemetry capabilities;
- failures that remain attributable to the layer that owns them;
- a bounded single-node path that can be reproduced outside the author's machine.

This is a hypothesis. Existing systems already provide many individual pieces, and the project must demonstrate that its composition adds value rather than merely wrapping them.

## Current proof boundary

M0-M6 target a bounded, CPU-only, single-node baseline. The baseline may simulate more than one local worker, but it does not claim multi-host behavior.

Within the boundary, a capability is not complete until it has implementation, automated checks, observable evidence, failure coverage, and clean-environment reproduction appropriate to its milestone.

Outside the boundary, documentation may preserve an attachment point and an entry condition. It must not imply implementation.

## First reference vertical slice

The accepted first slice is one deterministic, stateless invocation with a small payload:

```text
typed Java host call
→ mapper
→ control and invocation contract
→ local transport
→ Python definition adapter
→ NumPy CPU runtime
→ validated typed result
```

The reference workload is the bounded batch affine transform defined by [ADR-0004](adr/0004-first-reference-vertical-slice.md). gRPC and Protobuf are the selected wire mechanisms; the canonical contract representation remains an M1 decision.

## Non-goals

The single-node baseline does not build or claim:

- a new tensor library, autograd system, numerical kernel, compiler, model framework, or distributed communication stack;
- model training or large-model serving;
- GPU, RDMA, NCCL, CUDA IPC, Kubernetes, or multi-host scheduling;
- arbitrary remote code execution or arbitrary object deserialization;
- direct access from definition code to application databases, credentials, or authorization facts;
- a universal schema for every possible algorithm;
- performance superiority without a controlled benchmark.

## Decisions deliberately deferred beyond M0

The M0 review assigns these questions to evidence-producing later stages:

1. M1 chooses the canonical contract model and exact host binding mechanism.
2. M1 defines numeric, tensor-shape, compatibility, and optionality policies for the accepted corpus.
3. M2 defines the authoritative deadline and cancellation race rule.
4. M3 supplies the second Runtime conformance fixture needed to prove replacement.
5. M6 measurements decide whether a later data-plane experiment has an entry condition.

## Completion meaning

JPyxis is considered born when M2 produces a correctly succeeding and correctly failing end-to-end invocation. The single-node baseline is considered established only when M6 reproduces the complete documented path in a clean environment.

The M0 architecture review and freeze record is [M0 Architecture Review Gate](reviews/m0-review-gate.md).

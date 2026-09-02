# Project Charter

Status: `PLANNED · M0 DRAFT`

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

## First vertical slice under consideration

The candidate first slice is one deterministic, stateless invocation with a small payload:

```text
typed Java host call
→ mapper
→ control and invocation contract
→ local transport
→ Python definition adapter
→ NumPy or another minimal CPU runtime
→ validated typed result
```

The exact algorithm, contract carrier, and runtime are M0 decisions. They are not frozen by this draft.

## Non-goals

The single-node baseline does not build or claim:

- a new tensor library, autograd system, numerical kernel, compiler, model framework, or distributed communication stack;
- model training or large-model serving;
- GPU, RDMA, NCCL, CUDA IPC, Kubernetes, or multi-host scheduling;
- arbitrary remote code execution or arbitrary object deserialization;
- direct access from definition code to application databases, credentials, or authorization facts;
- a universal schema for every possible algorithm;
- performance superiority without a controlled benchmark.

## M0 decisions still open

The following unknowns are deliberate M0 work, not permission to improvise during implementation:

1. Which deterministic use case is representative enough for the first invocation proof?
2. Is the first canonical contract best represented by Protobuf descriptors plus JPyxis metadata, or by a separate canonical model with generated Protobuf transport?
3. Should the first runtime proof use NumPy, ONNX Runtime, or two deliberately different runtimes to establish replaceability?
4. What payload size, latency, memory, and process-count observations justify a later data-plane experiment?
5. Which plugin capabilities must exist in the first SPI, and which should remain ordinary internal modules until a second implementation proves replacement is real?

## Completion meaning

JPyxis is considered born when M2 produces a correctly succeeding and correctly failing end-to-end invocation. The single-node baseline is considered established only when M6 reproduces the complete documented path in a clean environment.

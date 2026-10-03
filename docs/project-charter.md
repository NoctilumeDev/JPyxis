# Project Charter

Status: `M0–M6 FROZEN · SINGLE-NODE BASELINE COMPLETE · BOUNDED ACTUAL REFERENCE PATH PROVEN · SYNTHETIC RISK HOST QUALIFIED`

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

## Bounded value and remaining hypothesis

The frozen single-node baseline, bounded actual reference path and qualified synthetic reference host
now demonstrate the following properties together inside their recorded scope:

- mapper-like host ergonomics without hiding version or failure semantics;
- one explicit meaning for scalar, record, and tensor values across boundaries;
- immutable definition artifacts and separately governed activation state;
- bounded Runtime replacement through two project-owned fixtures, with attachment points—but no
  general replacement proof—for definition, transport, storage, scheduling and telemetry;
- failures that remain attributable to the layer that owns them;
- a bounded single-node path that can be reproduced outside the author's machine.

That bounded composition is no longer only a proposed value: it has retained implementations, first
failures, public gates and independent readbacks. Whether the same architecture remains worthwhile
for broader workloads, third-party plugins, production security, distribution or an ecosystem is
still a hypothesis. Existing systems already provide many individual pieces, so later work must
continue to justify composition rather than merely wrapping them.

## Current proof boundary

M0–M6 establish a bounded, CPU-only, single-node baseline. The baseline may use more than one local
worker to exercise supervision and routing, but it does not claim multi-host behavior. A separately
qualified actual path and synthetic risk-scoring host compose the frozen boundaries for one trusted
local workload; they do not widen those boundaries into production authority.

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

The reference workload is the bounded batch affine transform defined by
[ADR-0004](adr/0004-first-reference-vertical-slice.md). gRPC and Protobuf are the selected first wire
mechanisms; the canonical contract representation is frozen by M1 and does not belong to either
carrier.

## Non-goals

The single-node baseline does not build or claim:

- a new tensor library, autograd system, numerical kernel, compiler, model framework, or distributed communication stack;
- model training or large-model serving;
- GPU, RDMA, NCCL, CUDA IPC, Kubernetes, or multi-host scheduling;
- arbitrary remote code execution or arbitrary object deserialization;
- direct access from definition code to application databases, credentials, or authorization facts;
- a universal schema for every possible algorithm;
- performance superiority without a controlled benchmark.

## M0 deferrals and current disposition

The M0 review assigned these questions to evidence-producing later stages. Their current disposition
is part of project state; the original M0 records remain unchanged.

1. M1 froze the canonical contract model, host bindings and the accepted numeric, tensor-shape,
   compatibility and optionality subset at `m1-contract-v1`.
2. M2 froze deadline, cancellation and single-terminal-outcome authority at `m2-invocation-v1`.
3. M3 supplied NumPy and dependency-free reference providers and froze the bounded replacement claim
   at `m3-runtime-v1`.
4. M4–M5 froze bounded lifecycle and resilience ownership without widening the contract layer.
5. M6 accepted the recorded 16 GB-class single-node boundary after clean public reproduction. Its
   measurements do not by themselves authorize the E1 data-plane experiment.

## Completion meaning

JPyxis became an executable prototype when M2 produced correctly succeeding and correctly failing
end-to-end invocations. The single-node baseline became established when M6 reproduced the complete
documented path in clean public environments. The later
[actual reference-path qualification closure](reviews/reference-path-qualification-closure-v1.md)
and [risk-scoring reference-host qualification](reviews/risk-scoring-reference-host-qualification-v1.md)
prove one bounded composition and one bounded application; neither establishes production readiness,
distribution, arbitrary workloads or a public general-purpose SDK.

The M0 architecture review and freeze record is [M0 Architecture Review Gate](reviews/m0-review-gate.md).

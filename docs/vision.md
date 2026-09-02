# Long-horizon Vision

Status: `LONG-HORIZON HYPOTHESIS · NOT A DELIVERY CLAIM`

JPyxis is a small current project with a long-horizon architectural hypothesis. This document explains that hypothesis without expanding the single-node baseline.

## The convergence behind the idea

The long-term case for JPyxis is not simply that more compute will exist. It is that three pressures may continue to grow together:

1. compute resources become more heterogeneous;
2. model definitions become deployable artifacts rather than inseparable Python services;
3. governance and lifecycle complexity grow faster than algorithm source code.

Existing systems already expose parts of this direction. [ONNX Runtime execution providers](https://onnxruntime.ai/docs/execution-providers/) place different hardware implementations behind a common runtime API. [StableHLO](https://openxla.org/stablehlo/spec) defines a portability layer between frameworks and compilers. [DLPack](https://dmlc.github.io/dlpack/latest/) standardizes tensor exchange concerns across frameworks and devices. [NVIDIA Triton](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/architecture.html) separates repositories, schedulers, backends, model management, and serving APIs.

These are prior art, not proof that JPyxis is necessary.

## A model is not a service

A model or algorithm definition may be represented as:

```text
artifact
+ definition semantics
+ contract
+ provenance
```

A production compute service additionally requires:

```text
deployment
+ routing
+ resource policy
+ authorization
+ version activation
+ service objective
+ lifecycle
+ observability
+ failure recovery
```

Small systems often let one Python process own both groups because the coordination cost is low. JPyxis studies the point at which keeping them fused makes authority, compatibility, and failure harder to reason about.

## The architectural bet

The bet is that a stable boundary between definition and governance remains useful as languages, formats, runtimes, and accelerators change.

```text
Python / Rust / DSL / graph IR / portable model format
                         ↓
                versioned contract
                         ↓
             replaceable runtime capabilities
                         ↓
              CPU / GPU / NPU / other device
```

The Control Plane governs which accepted capability runs, under which version, policy, resource, and lifecycle state. Definition frontends describe computation. Runtime plugins execute it. None of those mechanisms may silently acquire another role's authority.

## “Compute operating system” is an analogy

As compute infrastructure matures, it may accumulate operating-system-like responsibilities: scheduling, isolation, resource allocation, lifecycle, observability, failure handling, and policy. JPyxis is not an operating system and the single-node baseline does not implement cluster or hardware management.

The analogy explains governance pressure; it does not authorize operating-system scope.

## Why Python becomes less central

Python is the first planned Definition plugin because it has a rich algorithm and model ecosystem. The architectural value would come from preserving contract and authority when that plugin or its runtime changes, not from making Python callable from Java.

If a future definition uses Rust, a DSL, ONNX, StableHLO, or another representation, it qualifies only by satisfying the same capability, contract, and ownership rules. Future diversity cannot change the meaning of an existing baseline contract by accident.

## Present-value requirement

The long horizon cannot excuse a weak current project. M0-M6 must demonstrate present value on one machine:

- clearer ownership than an ad hoc Python service;
- stronger contract and failure semantics than a raw RPC client;
- real replacement of at least one execution capability;
- safe immutable-version lifecycle;
- independent reproduction within the declared resource boundary.

If those properties do not justify their complexity today, future fragmentation is not evidence that the framework should continue unchanged.

## Falsification and narrowing conditions

The long-horizon hypothesis weakens if:

- established Java runtimes or model servers provide the required authority and lifecycle model with less integration cost;
- portable model and compiler standards remove the need for a separate JPyxis contract layer;
- representative algorithms cannot fit a stable contract without frequent untyped escape hatches;
- plugin substitution changes Core semantics in practice;
- the intended users prefer direct runtime integration and have no independent governance problem;
- heterogeneous hardware remains a runtime concern that does not require host-level ownership or policy.

In those cases, JPyxis should narrow to a contract profile, mapper library, integration toolkit, or documented experiment. Becoming smaller is an acceptable research result.

## Current consequence

The vision imposes only one obligation on the baseline:

> Do not hard-code the first language, transport, runtime, data carrier, storage mechanism, scheduler, or telemetry exporter into Core semantics.

It does not require implementing their future replacements.

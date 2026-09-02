# Contract Principles

Status: `PROPOSED · M0`

M0 defines what the contract must mean. It does not freeze Protobuf field numbers, Java annotations, Python decorators, or a canonical storage encoding.

## Contract responsibilities

One contract version must make the following categories explicit where relevant.

### Identity

- namespace and algorithm name;
- contract version;
- immutable artifact identity and content digest;
- callable or operation identity;
- required capability set.

### Values

- scalar types and numeric width;
- records, fields, optionality, and collections;
- tensor dtype, rank, dimensions, and symbolic or dynamic constraints;
- layout and axis meaning;
- batch semantics;
- device and memory-space requirements where they affect correctness;
- ownership, lifetime, and mutability for handles or shared buffers.

### Invocation

- request and response schemas;
- deadline and cancellation semantics;
- synchronous or asynchronous result model;
- idempotency, deduplication key, and attempt identity;
- side-effect classification;
- determinism expectations where claimed;
- size and resource bounds;
- stable error categories.

### Lifecycle

- validation requirements;
- compatible runtime and plugin capabilities;
- load, warmup, health, drain, and unload obligations;
- activation compatibility and rollback requirements;
- evidence required for a transition.

### Observability

- trace and invocation correlation;
- artifact, deployment, and plugin coordinates;
- required metrics and lifecycle events;
- redaction rules for data and diagnostic payloads.

## Compatibility

Compatibility is an explicit verdict over two named contract versions. It is not inferred from successful deserialization alone.

The policy must eventually distinguish:

- wire compatibility;
- semantic compatibility;
- host-source compatibility;
- definition compatibility;
- runtime capability compatibility;
- deployment compatibility.

For example, changing a tensor dimension from `[B, 128, 768]` to `[B, *, 768]` may remain representable on the wire while changing validation, batching, memory, and runtime assumptions.

## No universal escape hatch

The baseline rejects public signatures whose meaning is only `Object`, `dict`, `Any`, or raw bytes. Extensible values require a registered type identity and validation contract.

Opaque handles may be used by a future data plane only if the contract defines:

- who created the handle;
- which plugin may consume it;
- dtype, shape, layout, device, and memory space;
- ownership transfer or borrowing;
- synchronization obligations;
- expiry and cleanup;
- failure behavior when the producer disappears.

## Contract carrier remains open

Protobuf and gRPC are strong candidates for the first control-plane carrier, but they do not automatically encode every JPyxis semantic rule. M0 must compare at least:

1. Protobuf descriptors plus JPyxis custom metadata;
2. a canonical JPyxis contract model that generates Protobuf and host bindings;
3. a deliberately smaller baseline contract with later compatible extension.

The decision must consider deterministic identity, code generation, reflection, compatibility checks, language support, and avoidance of duplicated truth.

## Control plane versus data plane

Small baseline values may travel through the control transport. This is a bounded first implementation, not a declaration that Protobuf is the permanent large-tensor carrier.

A later data plane may use Arrow, shared memory, DLPack, CUDA IPC, or another mechanism only after measurement establishes the need. Its carrier cannot redefine contract meaning or acquire lifecycle authority.

## Mapper semantics

The host mapper is an ergonomic projection of a contract, not an RPC convenience wrapper. It must not hide:

- selected contract and artifact version;
- timeout and cancellation behavior;
- retry safety;
- output validation;
- stable failure categories;
- trace identity.

Its responsibility is broader than object conversion or method lookup. A complete mapper binding may project interface, type, tensor-shape, version, invocation, error, lifecycle, and capability semantics into a host-language API while leaving their authority in the Contract Core.

The comparison with MyBatis is structural rather than an API promise: a mapper isolates two semantic worlds so neither side must absorb the other's transport and execution machinery. JPyxis does not assume that database mapping semantics can be copied directly into heterogeneous compute.

The exact annotation or proxy API remains an M1 experiment.

## Contract acceptance tests planned for M1

- identical contract produces deterministic identity;
- valid scalar and record values round-trip across two language bindings;
- representative fixed and dynamic tensor shapes are accepted or rejected consistently;
- unknown fields and version changes receive an explicit compatibility verdict;
- invalid input is rejected before runtime invocation;
- invalid output cannot become invocation success;
- opaque or untyped values cannot bypass declared semantics;
- error categories survive transport without binding Core to vendor exceptions.

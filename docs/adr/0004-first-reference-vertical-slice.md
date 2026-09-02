# ADR-0004: First Reference Vertical Slice

Status: `ACCEPTED · M0`

## Context

M0 cannot close with only replaceable boxes and future options. M1 needs one deliberately small path that is concrete enough to test contract semantics without importing databases, clusters, accelerators, or deployment machinery into the first proof.

The slice must exercise all of the following at once:

- a typed host-facing mapper;
- a version-bound cross-process contract;
- a Definition plugin that does not acquire control authority;
- an existing Runtime behind a capability boundary;
- input and output validation;
- stable failure attribution;
- one observable end-to-end trace.

## Decision

The first reference slice is fixed as follows.

| Concern | M0 decision |
| --- | --- |
| Host language | Java |
| Host boundary | Typed Java interface exposed through the Algorithm Mapper |
| Control assembly | Runs in the Java host process |
| Wire transport | gRPC over loopback |
| Wire carrier | Protocol Buffers for bounded control and value messages |
| Definition frontend | Python in one separate worker process |
| Runtime | NumPy on CPU |
| Topology | One Java process and one Python worker on one physical machine |
| Workload | Deterministic, stateless batch affine transform |
| External side effects | None |
| Required result | Typed output accepted only after contract validation |

gRPC and Protobuf are reference mechanisms, not Core semantics. This decision does not yet choose whether the canonical JPyxis contract is expressed as Protobuf descriptors with metadata or as a separate semantic model that generates wire bindings. M1 must settle that question before freezing field identities.

## Reference workload

Logical algorithm identity:

```text
example.affine-batch
```

Input record:

```text
values: float32 tensor [B, 4], where 1 <= B <= 32
scale:  finite float32 scalar
bias:   finite float32 scalar
```

Output record:

```text
values: float32 tensor [B, 4]
rows:   int32 equal to B
```

Execution semantics:

```text
output.values = input.values * input.scale + input.bias
output.rows   = B
```

The M1 corpus will use exactly representable reference values for the first cross-language verdicts. General floating-point tolerance, overflow, and non-finite-value policy remain explicit M1 contract decisions rather than accidental NumPy behavior.

This workload is intentionally ordinary. Its purpose is to expose mapping, record, scalar, tensor, dynamic-batch, validation, version, and failure boundaries without allowing algorithm complexity to become an explanation for framework failure.

## Required M2 outcomes

The slice must eventually demonstrate:

- valid input produces the expected typed and validated result;
- invalid rank, shape, dtype, batch bound, or scalar value is rejected before Runtime execution;
- a deliberately malformed output cannot become success;
- definition preparation failure remains distinct from Runtime failure;
- an unavailable worker remains distinct from invalid input;
- Runtime exception, deadline, and cancellation retain stable categories and causal evidence;
- exactly one Invocation Manager terminal decision becomes authoritative;
- no Python, NumPy, gRPC, or generated Protobuf type leaks into the Host Application API.

## Explicit exclusions

The first slice includes none of the following:

- Spring Cloud;
- Redis, a relational database, or any other business persistence;
- a message queue;
- a GPU or accelerator requirement;
- Docker as a required execution path;
- more than one worker;
- dynamic plugin installation;
- arbitrary Python hot reload;
- Arrow, shared memory, DLPack, or CUDA IPC;
- model training, model serving, or external network calls.

Optional development tooling may later wrap the same bare-process path, but it cannot become the only way to reproduce the slice.

## Consequences

- M1 has a bounded corpus instead of a universal type-system ambition.
- M2 can test real process and transport failures without distributed-system claims.
- NumPy proves reuse of an external Runtime while keeping local resource cost low.
- M3 still needs a second conforming Runtime fixture or implementation before runtime replaceability is established.
- Success of this slice does not prove performance, production readiness, plugin ecosystem maturity, GPU support, or multi-host behavior.

## Rejection rule

If this small workload cannot preserve typed semantics, ownership, and attributable failure without generic escape hatches or implementation-name branches in Core, the architecture must narrow before adding a more complex algorithm.

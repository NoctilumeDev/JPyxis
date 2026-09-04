# ADR-0006: M1 Canonical Contract Profile

Status: `ACCEPTED FOR M1 IMPLEMENTATION`

## Context

M1 must let Java and Python agree on contract identity, value validity, compatibility, and minimum
evidence semantics before M2 adds a process boundary. Protobuf descriptors alone cannot carry every
JPyxis rule without custom metadata, and making generated Protobuf classes authoritative would bind
Core semantics to the first transport carrier.

The first contract is deliberately small. It needs records, scalar values, one representative tensor,
symbolic batch bounds, strict optionality, stable validation codes, and a directional compatibility
answer. It does not need a universal model format or an invocation protocol.

## Decision

M1 uses a canonical JPyxis semantic model that is independent of Protobuf. The accepted model is
serialized for fixtures as `jpyxis.io/contract/v1alpha1` JSON. JSON is the M1 authoring and
conformance encoding; it is not declared to be the permanent wire carrier.

Contract identity is:

```text
jpyxis:contract:<namespace>/<name>@<version>#sha256:<canonical-document-digest>
```

The digest input follows the restricted canonical JSON profile in
[M1 Contract Profile](../spec/m1-contract-profile.md). The profile admits only the JSON constructs
needed by M1 and rejects floating-point numbers inside contract documents. Runtime values may contain
finite float32 values, but those values do not participate in contract identity.

Java and Python bindings independently implement:

- strict contract parsing;
- canonical identity;
- input and output value validation;
- symbolic dimension binding;
- compatibility as a relation between accepted value sets;
- the minimum evidence-envelope rules required by ADR-0005.

The shared conformance corpus is the authority for M1 examples. Neither binding invokes the other.
A third harness compares their reports and fails if either disagrees with the corpus or with its peer.

## Compatibility vocabulary

M1 reports one of:

- `EQUIVALENT`;
- `CANDIDATE_ACCEPTS_SUPERSET`;
- `CANDIDATE_ACCEPTS_SUBSET`;
- `OVERLAPS`;
- `DISJOINT`.

This is a semantic value-set relation, not a deployment, wire, source, or rolling-upgrade decision.
Later policy may consume it, but it may not silently rename it as general compatibility.

## Consequences

- Contract meaning remains independent of gRPC and generated Protobuf types.
- M1 can reject bad values before a runtime exists.
- The two bindings duplicate a small amount of validation logic intentionally; this is what makes
  cross-language disagreement observable.
- The v1alpha1 model is deliberately incomplete and must be narrowed or versioned rather than opened
  through `Object`, `dict`, `Any`, or raw byte escape hatches.
- M2 may generate or map Protobuf messages from this model, but cannot make those messages the new
  semantic authority without a new ADR.

## Explicit exclusions

This decision adds no mapper proxy, gRPC service, Python worker, NumPy execution, plugin loader,
artifact registry, lifecycle coordinator, or evidence recorder. Those belong to later milestones.

## Rejection rule

If Java and Python cannot produce the same identity and verdicts from the bounded corpus without
implementation-specific exceptions or untyped bypasses, M1 does not close and M2 remains blocked.

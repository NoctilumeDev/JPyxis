# M3 Runtime Abstraction Profile

Status: `M3 FROZEN · IMPLEMENTATION-BACKED`

## Frozen inputs

M3 treats `m1-contract-v1` and `m2-invocation-v1` as immutable evidence coordinates. It may evolve
the current implementation only while the full M1 and M2 suites continue to pass. Their tags and
retained evidence are not rewritten.

## Capability requirement

The reference host requires:

```text
capability: jpyxis.capability/affine-float32@1
operation:  jpyxis.operation/affine-batch@1
dtype:      float32
layout:     ROW_MAJOR
```

The requirement is a capability coordinate, not a product name. A probe response binds it to one
runtime identity and version for a single attempt.

## Definition plan

The M3 definition artifact returns exactly this bounded shape:

```json
{
  "schemaVersion": "jpyxis.io/affine-definition-plan/v1alpha1",
  "operationIdentity": "jpyxis.operation/affine-batch@1"
}
```

Unknown keys, missing keys, non-string values, or an unsupported operation make definition
preparation fail. The plan carries no Runtime object and grants no lifecycle or control authority.

## Runtime SPI values

The SPI accepts an immutable request containing row-major shape, finite float32 values, scale, and
bias, plus the validated operation identity. It returns immutable row-major shape and float32
values. Generated Protobuf messages and provider-native values are converted at outer boundaries.

## Resolution order

```text
worker composition selects installed provider
→ provider advertises capability metadata
→ transport probe returns metadata
→ Control validates product-neutral requirement
→ Control pins resolved binding
→ invoke carries pinned binding
→ worker checks binding against current provider
→ runtime starts
```

A mismatch at any step before runtime start cannot produce `RUNTIME_STARTED`.

## Required executable scenarios

1. NumPy provider returns the exact affine oracle result.
2. Python reference provider returns the same exact result.
3. Multiple accepted input shapes agree exactly across both providers.
4. Both providers map execution exceptions to the same public failure.
5. A provider with incompatible advertised metadata is rejected before dispatch.
6. A mismatched runtime binding in an invoke request is rejected before runtime start.
7. Runtime-specific types do not appear in host, Core, SPI, wire-neutral, or definition-plan code.
8. M1 and M2 suites remain green.
9. A completed evidence bundle is independently verifiable offline.

## Evidence boundary

M3 evidence must identify source revision, dirty state, environment, definition digest, contract
identity, both runtime identities and versions, scenario results, and retained file digests. The
verifier compares both runtime outputs independently and does not trust either provider's verdict.

Passing M3 proves only the first bounded runtime replacement boundary on one CPU machine. It does
not establish an open plugin ecosystem, dynamic installation, broad numerical portability,
performance, production readiness, security isolation, lifecycle, distribution, or clean-machine
reproducibility.

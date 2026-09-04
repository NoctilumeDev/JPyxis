# ADR-0008: Runtime Capability Resolution

Status: `ACCEPTED FOR M3 CONSTRUCTION`

## Context

M2 proved one typed Java-to-Python invocation through a NumPy-backed worker. That path does not
prove runtime replaceability: the worker currently loads a Python definition, constructs NumPy
values, invokes it, and reports the result in one implementation unit. A second class behind an
interface would only rename that coupling.

M3 must answer one narrower question: can the same host contract and invocation authority execute
through two runtime implementations without exposing implementation types or changing public
result and failure meaning?

## Decision

The first M3 profile introduces a Core-owned runtime request/result boundary and a worker-local
Runtime Provider SPI. Runtime providers declare typed capability metadata and accept only the
bounded M3 semantic values. NumPy arrays and other provider-native values remain inside provider
implementations.

The reference definition artifact describes the selected affine operation through a validated,
bounded definition plan. It does not import or name either runtime. This plan is a fixture for the
first slice, not a general graph IR or compiler.

The reference worker is assembled from a registry at its composition root. Selecting a provider by
deployment configuration is allowed there. Core and the host mapper may compare capability facts,
but they may not branch on provider names.

Before dispatch, Control obtains a probe report and validates these facts:

- capability identity and version;
- operation identity;
- accepted dtype and layout;
- resolved runtime identity and version.

The resolved runtime binding is pinned into the invocation attempt. The worker rejects an invoke
whose pinned binding differs from the provider that actually receives it. This prevents a successful
probe for one runtime from silently dispatching to another.

## Authority and failure

- the provider reports capability and execution observations;
- the registry resolves a deployment-configured provider;
- Control decides whether advertised capability satisfies the reference requirement;
- the Invocation Manager remains the only owner of the public terminal invocation state;
- a knowable capability mismatch fails before `DISPATCH_STARTED` as
  `RUNTIME_FAULT / RUNTIME_CAPABILITY_UNSUPPORTED`;
- an exception after `RUNTIME_STARTED` remains
  `RUNTIME_FAULT / RUNTIME_EXECUTION_FAILED`;
- provider diagnostics cannot become public error semantics.

## Reference fixtures

M3 uses two CPU-only runtime fixtures:

1. `numpy.cpu`, which performs explicit float32 vector operations inside the NumPy adapter;
2. `python.reference`, which performs a scalar reference loop and explicit IEEE-754 float32
   rounding inside its own adapter.

Both consume the same definition plan and the same M1 host contract. Exact agreement is required
for the bounded affine corpus. These fixtures do not prove arbitrary third-party plugin
compatibility, numerical equivalence for general algorithms, or performance.

## Dependency rule

The following edges are forbidden:

```text
Host API / Invocation Manager -> NumPy or Python reference implementation
Definition artifact           -> NumPy or Python reference implementation
Runtime Provider              -> Java host or generated Protobuf messages
Core runtime values           -> provider-native tensor values
```

Provider discovery and construction may know concrete provider classes because it is the outer
composition root. That knowledge may not leak inward.

## Rejection conditions

M3 does not pass if any of the following is true:

- the two fixtures require different host mapper signatures or different contract files;
- Core contains implementation-name branches;
- a NumPy value crosses the Runtime Provider boundary;
- a capability mismatch starts runtime execution;
- replacing the provider changes public failure category or code;
- the M1 or M2 frozen regression suites fail;
- retained M3 evidence cannot be verified after all runtime processes exit.

## Explicit exclusions

M3 does not add dynamic installation, remote registries, hot activation, deployment lifecycle,
multi-worker routing, retry policy, shared memory, accelerators, containers, or a general operation
IR. Those belong to later gates or evidence-gated evolution.

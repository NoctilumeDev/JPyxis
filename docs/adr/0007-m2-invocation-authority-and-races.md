# ADR-0007: M2 Invocation Authority and Race Rules

Status: `ACCEPTED FOR M2 CONSTRUCTION`

## Context

M1 froze the meaning of `example.affine-batch@1.0.0`, but it intentionally proved no process
invocation. M2 must cross a real process boundary without allowing gRPC, generated messages, Python,
or NumPy to redefine the M1 contract or promote a worker observation into an authoritative result.

The first slice also needs one explicit rule for deadline, cancellation, and late-result races. A
transport status alone cannot decide those races because delivery, acknowledgement, execution stop,
and terminal-state commitment are different observations.

## Decision

M2 uses this bounded path:

```text
typed Java AffineBatchMapper
→ Java Invocation Manager
→ M1 input validation
→ Protobuf carrier mapping
→ gRPC loopback transport
→ Python worker and M1 validation
→ NumPy affine execution
→ Protobuf carrier mapping
→ M1 output validation
→ one Java-owned invocation terminal decision
```

The Java host API contains only JPyxis host records, scalar values, and checked exceptions. Generated
Protobuf classes, gRPC status types, Python values, and NumPy arrays remain behind adapters.

Protobuf is an M2 carrier. The canonical contract document and M1 validators remain authoritative for
type, shape, symbol, finite-value, and result-validity semantics. The wire schema may be stricter than
the canonical contract but may not silently widen it.

The Invocation Manager depends on one narrow invocation-transport port; the gRPC adapter alone knows
generated carrier types. This enforces dependency direction, but one interface plus one implementation
does not prove transport replaceability or a plugin ecosystem.

## Authority

The Python worker reports one of these execution observations:

- a raw computed value;
- a definition preparation failure;
- a runtime failure;
- a request-contract rejection observed at the worker boundary.

None is an invocation terminal state. The Java Invocation Manager is the only component allowed to
commit `SUCCEEDED`, `FAILED`, `TIMED_OUT`, or `CANCELLED`. It commits exactly once.

A worker-produced value is eligible for `SUCCEEDED` only after its coordinates match the pinned
request and M1 output validation accepts it. A malformed or mismatched result is recorded as
`FAILED / OUTPUT_REJECTED`, even if the worker labelled its execution successful.

## Terminal winner rule

For one invocation, terminal commitment is a single compare-and-set decision over the Java-owned
invocation state.

1. If a contract-valid response is completely mapped and output-validated before a deadline or
   cancellation observation wins the terminal decision, the invocation becomes `SUCCEEDED`.
2. If the Invocation Manager observes its deadline first, it becomes `TIMED_OUT`.
3. If it observes an accepted caller-cancellation request first, it becomes `CANCELLED`.
4. Any later response, transport status, cancellation acknowledgement, or worker completion is
   retained as a late observation and cannot rewrite the terminal state.
5. Timeout or cancellation never claims that remote execution stopped or that side effects rolled
   back. The M2 workload is side-effect-free, but the evidence still records whether execution may
   have continued.

A non-positive deadline is decided before dispatch and therefore produces `TIMED_OUT` with no worker
attempt. During-dispatch deadline and cancellation cases use the same winner rule; transport-native
deadline or cancellation codes are observations mapped by the Invocation Manager, not public API.

## Failure mapping

| Observation | Public category | Stable M2 code | Execution may continue |
| --- | --- | --- | --- |
| Host input violates M1 | `CONTRACT_FAULT` | original M1 validation code | no |
| Worker rejects incompatible coordinates or input | `CONTRACT_FAULT` | `WORKER_CONTRACT_REJECTED` | no |
| Definition cannot prepare | `DEFINITION_FAULT` | `DEFINITION_PREPARATION_FAILED` | no |
| Worker cannot be reached or carrier breaks | `TRANSPORT_FAULT` | `WORKER_UNAVAILABLE` or `TRANSPORT_INTERRUPTED` | unknown |
| NumPy execution raises | `RUNTIME_FAULT` | `RUNTIME_EXECUTION_FAILED` | no after report; unknown after disconnect |
| Worker value fails host validation | `INVOCATION_FAULT` | `OUTPUT_REJECTED` | no |
| Deadline wins | `INVOCATION_FAULT` | `DEADLINE_EXCEEDED` | recorded from observations |
| Cancellation wins | `INVOCATION_FAULT` | `CANCELLED_BY_CALLER` | recorded from observations |

Vendor messages and stack traces may be retained as diagnostics but are never the stable public code.
M2 performs no automatic retries because it has no retry policy or ambiguity-proof deduplication
model.

## Evidence boundary

The host recorder and worker recorder append observations under separate ownership. After the
processes exit, the Acceptance Harness assembles immutable copies into a versioned bundle and invokes
an offline verifier. The verifier recomputes the deterministic affine oracle and evidence integrity;
it does not call the worker and cannot modify the authoritative invocation outcome.

Invocation outcome, acceptance verdict, and milestone evidence state remain separate. Recorder or
verifier failure leaves the invocation fact unchanged and prevents `PASS`.

## Explicit exclusions

This decision adds no lifecycle engine, deployment activation, runtime-replacement claim, dynamic
plugin loading, persistence service, retry engine, business transaction, container requirement,
accelerator, shared-memory data plane, multi-worker routing, or remote topology. Those belong to later
milestones.

## Rejection rule

M2 must be narrowed or redesigned if exactly one Java-owned terminal state cannot be demonstrated,
if a generated carrier type leaks into the host API, if the worker can self-promote execution into
invocation success, or if a completed bundle cannot be judged after both runtime processes exit.

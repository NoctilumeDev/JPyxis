# ADR-0005: First Verifiable End-to-End Closure

Status: `ACCEPTED · M1 ENTRY ADDENDUM · NO M0 SEMANTIC RE-FREEZE`

## Context

[ADR-0004](0004-first-reference-vertical-slice.md) fixes the first real construction path from a
typed Java mapper through a Python definition plugin to a NumPy runtime. That path is necessary but
not sufficient evidence by itself. A runtime response, a contract-valid value, an acceptance verdict,
and a project-level validated claim are different facts with different owners.

The first executable slice must therefore carry enough evidence for a verifier outside the invocation
process to decide what the run proves. This addendum does not change the M0 authority, dependency,
contract, or topology decisions. It fixes the acceptance boundary that M1 must describe and M2 must
execute.

## Decision

The first executable closure is:

```text
immutable source coordinate
→ documented build and launch
→ typed Java request
→ host-side contract validation
→ version-pinned mapper dispatch
→ gRPC / Protobuf transport
→ Python definition validation
→ NumPy execution
→ raw result tied to invocation and attempt identities
→ host-side output contract validation
→ independent acceptance oracle
→ retained evidence bundle
→ offline verification from that bundle
→ explicit acceptance verdict
```

No step may use the next step's success as a substitute for its own evidence. In particular:

```text
authorization ≠ dispatch ≠ execution ≠ observation ≠ acceptance ≠ validated project claim
```

The reference affine workload has no external side effects. Its independent readback is therefore a
deterministic acceptance oracle over canonical input, contract semantics, and expected output—not a
second call to the same worker and not trust in the runtime's success flag.

## Three separate outcome axes

The following facts must never be collapsed into one `status`:

| Axis | Example states | Final authority |
| --- | --- | --- |
| Invocation outcome | `SUCCEEDED`, `FAILED`, `TIMED_OUT`, `CANCELLED` | Invocation Manager |
| Acceptance verdict | `PASS`, `FAIL`, `INCONCLUSIVE` | Acceptance Harness |
| Project evidence state | `PROTOTYPE`, `VALIDATED`, `REJECTED`, `FROZEN` | Milestone review under the Evidence Policy |

An invocation may time out while a fault-handling acceptance case passes. An invocation may return a
contract-valid value while the oracle rejects its semantics. Missing or conflicting evidence yields
`INCONCLUSIVE`; it must not be rounded into success or failure to finish a run.

The Acceptance Harness is test and evidence infrastructure outside JPyxis Core. It cannot modify the
worker, runtime result, invocation terminal state, or authoritative lifecycle state to manufacture a
passing verdict.

## Minimum evidence bundle

M1 must define a versioned evidence schema. M2 may choose its concrete encoding, but every retained
bundle must contain or reference at least:

- immutable source revision and build identity;
- operating system, architecture, toolchain, dependency, and launch coordinates;
- contract identity and digest;
- definition artifact identity and digest;
- selected plugin and runtime identities and versions;
- invocation, attempt, and trace identities;
- canonical input or a declared privacy-preserving digest;
- ordered dispatch, execution, validation, and terminal observations;
- raw or canonical output and output-validation result;
- oracle identity, expected result, comparison policy, and verdict;
- stable failure category and causal references when any step fails;
- evidence completeness and integrity result;
- explicitly unproven claims and known environmental limits.

Raw observations are retained even when validation or acceptance fails. A later summary may point to
them but cannot replace or rewrite them.

## Independent verifier

M2 must provide one non-interactive verifier entry point that receives only a completed evidence
bundle and the public verification fixtures required by its version. It must not depend on Java or
Python process memory, author recollection, mutable branch names, hidden local caches, or access to the
original worker.

For the first workload, the verifier must check:

1. required coordinates and identities are present and mutually consistent;
2. the contract and definition artifact digests match the recorded bytes;
3. state and observation ordering contains no impossible transition;
4. the output satisfies the declared type, shape, row-count, and finite-value rules;
5. the independent affine oracle reaches the recorded acceptance verdict;
6. missing, corrupt, reordered, or conflicting evidence produces `INCONCLUSIVE` or `FAIL`, never
   `PASS`;
7. the verdict does not claim performance, production readiness, accelerator support, distribution,
   or business success.

The verifier is independent by authority and input path. M2 does not claim organizational independence
or formal verification.

## Required M2 acceptance cases

The first closure is incomplete until retained bundles and offline verification cover at least:

- valid deterministic input and exact expected output;
- invalid rank, shape, dtype, batch bound, and non-finite scalar rejected before runtime execution;
- deliberately malformed runtime output rejected before invocation success;
- definition preparation failure;
- unavailable worker and transport interruption;
- runtime exception;
- deadline before dispatch and during execution;
- cancellation and late-result race under the authoritative M2 winner rule;
- missing, truncated, reordered, corrupt, and mutually conflicting evidence;
- evidence recorder or verifier failure that leaves the invocation fact intact but prevents a passing
  acceptance verdict.

## M6 closure

M2 proves one evidence-carrying invocation slice on a prepared single machine. M3-M5 add runtime
replacement, lifecycle, recovery, and fault evidence without changing the separation above. M6 closes
the single-node baseline only when a clean environment can reproduce the entire documented chain and
an offline verifier can read the retained bundles at an immutable revision.

Therefore:

- M2 may establish `PROTOTYPE` evidence for the first vertical slice;
- no local run alone establishes `VALIDATED` or `FROZEN`;
- M6 may promote only the claims its clean-environment evidence actually supports.

## Explicit exclusions

This decision does not introduce a database, message queue, container requirement, remote evidence
service, signing infrastructure, model service, GPU, or distributed verifier. It also does not move
business acceptance into JPyxis. A host application remains responsible for its own authorization,
transaction, and domain truth.

## Rejection rule

If the first slice cannot be independently checked without reading private process state, trusting the
runtime's own verdict, or accepting an untyped evidence payload, the slice remains a demo and cannot
advance the corresponding evidence claim.

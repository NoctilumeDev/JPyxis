# M1 Contract Review

Status: `CLOSURE REVIEW PENDING · PROTOTYPE EVIDENCE ONLY`

M1 now has a bounded implementation candidate. This record does not close M1, promote the work to
`VALIDATED`, or authorize M2. Remote repository gates and review still have to accept the same result
at an immutable revision.

## Implemented boundary

- canonical `jpyxis.io/contract/v1alpha1` semantic document;
- locked SHA-256 contract identity for `example.affine-batch@1.0.0`;
- strict Java 17 parser, validator, normalizer, compatibility checker, and evidence-envelope checker;
- independent Python 3.10+ implementation of the same responsibilities;
- one language-neutral corpus with 36 cases;
- one cross-binding harness that compares complete report bodies;
- static repository checks that reject named M2 dependencies and modules.

The two bindings share only the contract, identity lock, corpus, and report schema. Neither binding
loads, embeds, invokes, generates, or imports the other.

## Corpus coverage

| Group | Cases | Boundary exercised |
| --- | ---: | --- |
| Value and type validation | 20 | records, required and optional fields, unknown-field rejection, float32 and int32, tensor dtype, rank, fixed and symbolic shape, batch bounds, layout, flattened value count, non-finite and overflow values, cross-input/output symbol binding |
| Compatibility | 7 | equivalent, widening, narrowing, overlap, disjoint dtype, optional-field addition, required-field addition |
| Evidence metadata | 9 | success and expected-failure PASS, incomplete INCONCLUSIVE, incomplete/conflicting/mismatched PASS rejection, missing coordinate, malformed identity, collapsed status rejection |

Accepted value cases also emit a typed normalized projection. Java and Python must produce identical
projections, so conformance is not reduced to comparing two booleans.

## Exact local verification

From the repository root:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
git diff --check
```

`verify-m1.mjs` uses the checked-in Maven wrapper, runs Java tests and the Java corpus, runs Python
tests and the Python corpus, independently recomputes the canonical digest in the harness, checks all
three identities against `identity.lock.json`, compares the two language-neutral reports, and writes
a disposable summary under `build/m1`.

The current local observation was made on Windows 11 x86-64 with Java 17.0.12, the checked-in Maven
3.9.11 wrapper, Node.js 24.14.0, and both Python 3.10.6 and Python 3.13. It is useful prototype
evidence, not a clean-machine or public-CI closure coordinate.

## Acceptance mapping

| M1 acceptance condition | Current candidate evidence |
| --- | --- |
| Both bindings accept and reject the same corpus | Full report equality is enforced by `verify-m1.mjs`. |
| Invalid input is rejected before execution | Input cases emit `accepted: false`; no Runtime dependency exists in M1. |
| Invalid output cannot become success | Output cases emit `accepted: false`; success eligibility is not produced. |
| Untyped values do not bypass validation | Unknown fields, wrong scalar types, wrong tensor metadata, and collapsed evidence status are rejected. |
| Identity is deterministic | Both bindings match one checked-in digest and identity lock. |
| Compatibility is explicit | Seven fixtures use the named semantic value-set relations. |
| Outcome axes remain separate | Evidence fixtures require three distinct fields and allow expected-failure acceptance. |
| Incomplete or conflicting evidence cannot PASS | Dedicated negative cases reject both conditions. |

## Pending closure checks

- the branch must pass the public repository gate;
- the implementation and ADR must receive review at the same revision;
- the final merged revision and CI run must be recorded here before changing status;
- the README must continue to state that no process invocation or Runtime execution exists.

Until these checks close, **M2 remains blocked**.

## Explicitly unproven

- typed Java mapper ergonomics;
- Protobuf generation or wire compatibility;
- gRPC transport and worker availability;
- Python definition preparation;
- NumPy execution;
- deadline, cancellation, or retry behavior;
- lifecycle, replacement, resilience, performance, security, and clean-machine reproducibility.

These are not omissions to patch inside M1. They belong to later named gates.

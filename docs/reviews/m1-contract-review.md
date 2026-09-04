# M1 Contract Review

Status: `FROZEN FOR M2 ENTRY`

Freeze coordinate: `m1-contract-v1`

M1 is accepted as a validated, bounded contract layer. This record authorizes only the M2 invocation
experiment defined by the roadmap. It does not promote any process boundary, Runtime execution,
lifecycle, performance, production, or clean-machine claim.

## Implemented boundary

- canonical `jpyxis.io/contract/v1alpha1` semantic document;
- locked SHA-256 contract identity for `example.affine-batch@1.0.0`;
- strict Java 17 parser, validator, normalizer, compatibility checker, and evidence-envelope checker;
- independent Python 3.10+ implementation of the same responsibilities;
- one language-neutral corpus with 38 cases;
- one cross-binding harness that compares complete report bodies;
- static repository checks that reject named M2 dependencies and modules.

The two bindings share only the contract, identity lock, corpus, and report schema. Neither binding
loads, embeds, invokes, generates, or imports the other.

## Corpus coverage

| Group | Cases | Boundary exercised |
| --- | ---: | --- |
| Value and type validation | 20 | records, required and optional fields, unknown-field rejection, float32 and int32, tensor dtype, rank, fixed and symbolic shape, batch bounds, layout, flattened value count, non-finite and overflow values, cross-input/output symbol binding |
| Compatibility | 9 | equivalent, widening, narrowing, overlap, disjoint dtype, optional-field addition, required-field addition, and explicit rejection of two correlated-symbol forms that M1 cannot soundly classify |
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

The supporting local observation was made on Windows 11 x86-64 with Java 17.0.12, the checked-in
Maven 3.9.11 wrapper, Node.js 24.14.0, and both Python 3.10.6 and Python 3.13. Public verification
repeated the complete gate on GitHub Actions `ubuntu-latest`, Java 17, Python 3.12, and the same Maven
wrapper. Neither environment is presented as M6 clean-machine reproduction.

## Acceptance mapping

| M1 acceptance condition | Accepted evidence |
| --- | --- |
| Both bindings accept and reject the same corpus | Full report equality is enforced by `verify-m1.mjs`. |
| Invalid input is rejected before execution | Input cases emit `accepted: false`; no Runtime dependency exists in M1. |
| Invalid output cannot become success | Output cases emit `accepted: false`; success eligibility is not produced. |
| Untyped values do not bypass validation | Unknown fields, wrong scalar types, wrong tensor metadata, and collapsed evidence status are rejected. |
| Identity is deterministic | Both bindings match one checked-in digest and identity lock. |
| Compatibility is explicit | Seven fixtures use named semantic value-set relations; two prove that correlated constraints return `COMPATIBILITY_PROFILE_UNSUPPORTED` rather than a false relation. |
| Outcome axes remain separate | Evidence fixtures require three distinct fields and allow expected-failure acceptance. |
| Incomplete or conflicting evidence cannot PASS | Dedicated negative cases reject both conditions. |

## Public evidence coordinates

- implementation PR: [#6](https://github.com/NoctilumeDev/JPyxis/pull/6);
- reviewed head: `ad5eb370d47d8a8b6b858d9316349641e986ff1c`;
- reviewed-head CI: [run 33852163865](https://github.com/NoctilumeDev/JPyxis/actions/runs/33852163865), artifact `9928750853`;
- implementation merge: `8051f6d252fbbee4fb53341aadfe9e4a173e81ec`;
- merged-main CI: [run 33852395736](https://github.com/NoctilumeDev/JPyxis/actions/runs/33852395736), artifact `9928835115`;
- retained evidence index: [`evidence/m1/freeze-manifest.json`](../../evidence/m1/freeze-manifest.json).

Both downloaded public artifacts reported 38 cases, the locked contract digest, Java/Python report
equality, typed normalized-value equality, and the same explicitly unproven list as the local result.

## Review correction

The first PR revision passed its public gate, but semantic review still found two defects before
merge: compatibility ignored correlations created by repeated symbols, and `equalsSymbol` could
refer to a forward or optional-only binder even though validation consumed fields in order. The
accepted revision rejects correlated compatibility as `COMPATIBILITY_PROFILE_UNSUPPORTED`, requires
previous guaranteed symbol binding, and carries Java and Python regression coverage. This is why a
passing earlier run was not treated as a substitute for review.

## Closure gate

- [x] Both bindings agree on all 38 corpus cases.
- [x] A third implementation independently confirms the locked canonical digest.
- [x] Invalid input and output produce distinct eligibility facts.
- [x] Unsupported correlated compatibility cannot be reported as a valid relation.
- [x] Outcome, verdict, and project evidence state remain separate.
- [x] The reviewed head passed the required public status check.
- [x] The merge commit passed the same check on `main`.
- [x] The repository retains exact source, corpus, commands, coordinates, and an evidence manifest.
- [x] README and roadmap preserve every unproven claim.

M1 is therefore frozen for M2 entry. M2 must consume the contract through a carrier mapping; it may
not redefine M1 semantics inside gRPC, Protobuf, the mapper, or the Python worker.

## Explicitly unproven

- typed Java mapper ergonomics;
- Protobuf generation or wire compatibility;
- gRPC transport and worker availability;
- Python definition preparation;
- NumPy execution;
- deadline, cancellation, or retry behavior;
- lifecycle, replacement, resilience, performance, security, and clean-machine reproducibility.

These are not omissions to patch inside M1. They belong to later named gates.

# M1 Contract Profile

Status: `M1 CANDIDATE · IMPLEMENTATION-BACKED`

This document defines the bounded semantic surface implemented during M1. It is normative only for
the M1 corpus and the `example.affine-batch` reference contract.

## Separation of facts

The following are separate artifacts and authorities:

```text
contract document  → cross-boundary meaning
value document     → one candidate input or output
evidence envelope  → coordinates and three independent outcome axes
conformance report → one binding's observations over the shared corpus
```

A conformance report cannot rewrite the contract, and a passing invocation outcome cannot manufacture
an acceptance verdict.

## Contract document

An M1 contract has exactly these root fields:

```text
apiVersion: jpyxis.io/contract/v1alpha1
kind:       AlgorithmContract
metadata:   namespace, name, version
spec:       determinism, sideEffects, operation
```

The operation has one name, one input record, and one output record. Unknown contract fields are
rejected. Names and versions use an ASCII identifier profile so filesystem, Java, Python, and future
wire bindings do not normalize them differently.

## Types

M1 supports three semantic type constructors:

- `scalar`: `float32` or `int32`, with optional finite and symbol-equality constraints;
- `record`: ordered unique fields, explicit `required`, and `unknownFields: REJECT`;
- `tensor`: `float32` or `int32`, `ROW_MAJOR`, a bounded rank, and fixed or symbolic dimensions.

A symbolic dimension declares one ASCII name and inclusive integer bounds. Repeated uses of the same
symbol must bind to the same observed size. The reference contract binds `B` from input tensor shape
and reuses it for output tensor shape and `rows`.

Input fields are traversed in declared order, followed by output fields. A scalar `equalsSymbol` may
refer only to a symbol already introduced through required fields on that path. A forward reference,
or a reference whose only earlier binder is optional, makes the contract invalid; otherwise the
parser could accept a document whose validation result depends on field presence or traversal order.

The M1 JSON value carrier represents a tensor as:

```json
{
  "dtype": "float32",
  "shape": [2, 4],
  "layout": "ROW_MAJOR",
  "values": [1, 2, 3, 4, 5, 6, 7, 8]
}
```

The flattened value count must equal the shape product. JSON numbers admitted for float32 are rounded
by the binding to IEEE 754 binary32 after range and finiteness checks. The M1 reference verdicts use
exactly representable values; general numeric tolerance remains outside M1.

## Canonical identity

Contract identity is the SHA-256 digest of a canonical UTF-8 serialization. The admitted contract
document profile uses:

- objects, arrays, strings, booleans, and signed integers only;
- unique ASCII object keys;
- no `null` and no floating-point number in a contract document;
- lexicographically sorted object keys;
- preserved array order;
- JSON string escaping, no insignificant whitespace, and no trailing newline;
- decimal integers with no leading zero.

These restrictions form an RFC 8785-compatible subset for the admitted data model while avoiding
cross-language floating-number and property-order ambiguity. A later general canonical model must be
versioned rather than silently widening this profile.

## Validation phases

Input and output validation use the same type rules but produce different eligibility facts:

- rejected input is not `executionEligible`;
- rejected output is not `invocationSuccessEligible`.

No runtime is present in M1. These eligibility facts prove only that the contract layer can prevent a
later stage from treating invalid data as executable or successful.

Validation failures carry a stable category `CONTRACT_FAULT` and one stable M1 code. Language stack
traces and parser exception classes are diagnostic details and do not enter conformance reports.

## Compatibility

Compatibility compares the typed normalized values accepted by two named type definitions. Carrier
lexemes are converted before this relation is considered, so the JSON number `1` may be admitted as
input for both an int32 and a float32 parser while the resulting typed values remain distinct.

The M1 compatibility checker is sound only for the uncorrelated subset: a symbolic dimension may
occur at most once within each compared type, and scalar `equalsSymbol` constraints are excluded.
Those constructs remain valid for contract and value validation, but their compatibility requires
reasoning across multiple value positions. M1 returns the explicit non-relation
`COMPATIBILITY_PROFILE_UNSUPPORTED` for them instead of guessing a relation.

| Verdict | Meaning |
| --- | --- |
| `EQUIVALENT` | Both definitions accept the same values. |
| `CANDIDATE_ACCEPTS_SUPERSET` | Every base value is accepted by the candidate, plus additional values. |
| `CANDIDATE_ACCEPTS_SUBSET` | Every candidate value is accepted by the base, while some base values are rejected. |
| `OVERLAPS` | Some values are shared, but neither accepted set contains the other. |
| `DISJOINT` | No value is accepted by both definitions under the M1 rules. |

The verdict intentionally says nothing about Protobuf wire compatibility, Java source compatibility,
artifact activation, or safe rolling deployment.

## Minimum evidence envelope

M1 validates only the coordinates and outcome separation needed to enter M2. The envelope keeps:

```text
invocationOutcome
acceptanceVerdict
projectEvidenceState
```

as distinct required fields. It also records contract and definition digests, invocation, attempt and
trace identities, the expected invocation outcome for the acceptance case, completeness, integrity,
and explicit conflicts.

`PASS` is legal only when required coordinates are present, the envelope is complete, integrity is
verified, conflicts are empty, and the observed invocation outcome equals the case's expected outcome.
An expected-failure case may therefore receive `PASS` while its invocation outcome is `FAILED`; the
two axes are not collapsed.

## Corpus authority

The corpus under `spec/m1/corpus` contains the accepted positive and negative examples. Special
non-finite float sentinels exist only in the test-fixture encoding because standards-compliant JSON
cannot represent NaN or infinity. A binding must materialize the sentinel before validation; the
sentinel is not a public JPyxis value representation.

Both bindings emit the same language-neutral report body. The top-level verification command checks:

1. each binding agrees with every expected relation or explicit unsupported result;
2. both bindings compute the locked contract identity;
3. accepted scalar, record, and tensor values produce the same typed normalized projection;
4. both report bodies are identical after removing the binding label;
5. no M2 dependency or implementation has entered the repository.

## References

- [RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [IEEE 754-2019](https://standards.ieee.org/ieee/754/6210/)

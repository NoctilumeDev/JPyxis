# Literature Review Protocol

Status: `M0 LITERATURE PROTOCOL · CLOSED 2026-09-03`

This protocol records how the M0 prior-art baseline was assembled. It is a scoped engineering
review for architecture decisions, not a systematic literature review, a complete history of the
field, or a novelty opinion.

## Review question

The review asks which existing systems already solve parts of JPyxis and which claims still require
project-specific evidence. Its unit of analysis is an architectural capability or constraint, not a
product name.

## Search boundary

- Cut-off date: 2026-09-03.
- Search surfaces: official specifications, official project documentation and API references,
  maintainer-owned repositories, and original publication pages.
- Discovery terms covered Java/Python interoperability, cross-language workers, Java inference,
  model serving and registries, intermediate representations, tensor exchange, RPC semantics,
  plugin loading, provenance, and reproducible builds.
- Backward and forward citation discovery was used only to locate primary evidence. Secondary
  summaries were not accepted as decision evidence.

## Inclusion and exclusion

A source was included when it directly specified or reported a capability relevant to at least one
research question and could be attributed to its standard body, maintainer, or original authors.

The baseline excludes marketing comparisons without a technical primary source, unsourced
benchmarks, tutorials that merely restate upstream documentation, and claims whose only support is
the JPyxis proposal itself. Absence from the bibliography does not mean that a system is irrelevant.

## Evidence classes

| Class | Meaning | Permitted use |
| --- | --- | --- |
| `SPEC` | Normative protocol, format, or interface specification | Establish required semantics of an adopted standard |
| `API` | Official language or platform API contract | Establish callable platform behavior at the named version |
| `DOC` | Official project documentation | Establish maintained project behavior, subject to version pinning |
| `PAPER` | Original research or systems publication | Establish what the authors designed, evaluated, and reported |
| `ARTIFACT` | Maintainer-owned runnable source or repository | Establish inspectable implementation scope, not production quality |

No evidence class proves that the integrated JPyxis hypothesis is correct. That requires the staged
acceptance evidence defined by the roadmap.

## Synthesis method

1. Assign each source a stable local key in [Primary References](references.md).
2. Compare capabilities by architectural area in the [Prior-art Matrix](prior-art-matrix.md).
3. Map sources and remaining uncertainty to RQ1-RQ7 in
   [Evidence Traceability](evidence-traceability.md).
4. Record both positive evidence and narrowing or rejection evidence. Existing systems that satisfy
   the use case with less complexity are controls, not competitors to dismiss.
5. Keep observed fact, project inference, and future hypothesis separate.

## Version and link policy

Stable publication pages and versioned specifications are preferred. A living documentation URL is
acceptable for discovery, but any ADR or experiment depending on its exact behavior must record the
resolved release, page revision, or source commit. Link availability is observed during review but
is not a deterministic CI gate because network reachability is not repository correctness.

## Maintenance rule

M0 closes the baseline; it does not freeze the world. M1 and later stages may add evidence when a
decision introduces a new mechanism or when an upstream contract changes. Each addition must keep a
stable key, evidence class, access date, owning research question, and the decision or experiment
that uses it. Material contradiction reopens the affected decision, not the entire blueprint.

# Evidence Policy

Status: `PROPOSED · M0`

## Evidence states

| State | Meaning |
| --- | --- |
| `IDEA` | A possibility with no accepted investigation commitment. |
| `PLANNED` | Accepted for investigation but not yet fully designed. |
| `DESIGNED` | Invariants, boundaries, and acceptance conditions are specified. |
| `PROTOTYPE` | Executable behavior exists but is not yet validated for the claimed boundary. |
| `VALIDATED` | Reproducible evidence supports the claim within a stated environment and scope. |
| `REJECTED` | Evidence or scope analysis shows the direction should not proceed. |
| `FROZEN` | A validated stage is preserved at a named, immutable project coordinate. |

Documentation does not promote itself from `PLANNED` to `VALIDATED`.

## Claim rules

- A diagram proves intended structure, not implementation conformance.
- A passing unit test proves only its stated behavior under its test environment.
- A local invocation proves neither clean installation nor public reproducibility.
- A clean build proves neither fault recovery nor state correctness.
- A single-node result proves neither multi-host nor accelerator behavior.
- A plugin interface proves neither replaceability nor ecosystem compatibility.
- A benchmark proves only its recorded workload, versions, hardware, and method.

## Evidence layers

| Layer | Question answered |
| --- | --- |
| Static architecture checks | Do declared dependencies and schemas obey structural rules? |
| Contract and state tests | Do validators and transition rules produce expected verdicts? |
| End-to-end single-node run | Does one real invocation succeed or fail correctly across processes? |
| Fault injection | Do named failures preserve invariants and causal evidence? |
| Clean-environment reproduction | Can the project establish itself without hidden local state? |
| Frozen release evidence | What exactly was proven at one immutable revision? |

## Milestone evidence record

Every completed milestone must state:

- commit and release coordinate;
- environment and dependency versions;
- exact commands or automated entry points;
- topology and resource boundary;
- expected and observed results;
- negative and fault cases;
- retained logs, reports, or artifacts;
- known unknowns and explicitly unproven claims.

## M0 rule

M0 may contain research, diagrams, proposed invariants, decision records, and experiment designs. It contains no framework production code. M0 completes only when the next construction layer has a reviewed scope, protected invariants, acceptance method, and stop conditions.

## M6 reproduction chain

The target chain is:

```text
clean clone
→ documented bootstrap
→ build
→ launch
→ register immutable artifact
→ load
→ warm
→ activate
→ invoke
→ inspect trace and state
→ inject named failure
→ recover
→ rollback
→ verify final invariants
```

The exact automation may evolve. Missing steps must remain visible rather than being replaced by a narrative claim.

# M2 Invocation Review

Status: `READY FOR PUBLIC REVIEW`

M2 is locally accepted as a bounded invocation candidate. This record does not freeze M2 or authorize
M3. Public reviewed-head and merged-main evidence must still be obtained and read back before a freeze
coordinate can be created.

## Implemented boundary

- one typed Java `AffineBatchMapper` host boundary with no gRPC, Protobuf, Python, or NumPy types;
- one Java-owned Invocation Manager that commits exactly one terminal outcome;
- one internal invocation transport port and one loopback gRPC/Protobuf carrier implementation;
- one separately started Python Worker and one pinned Python definition artifact;
- one deterministic NumPy CPU affine execution path;
- M1 validation before dispatch and again at the Worker boundary;
- M1 output validation before a Worker observation can become host success;
- stable host-owned failure categories and codes;
- monotonic deadline and caller-cancellation races with late-result rejection;
- separate host and Worker observation streams;
- a retained evidence bundle and an offline Acceptance Harness that runs after both processes stop.

The transport port isolates the selected carrier from invocation semantics. It is not evidence of a
general plugin boundary: M2 has only one carrier implementation and makes no transport-replacement
claim.

## Local acceptance matrix

| Group | Cases | Accepted behavior |
| --- | ---: | --- |
| Success | 1 | exact float32 result matches an independently recomputed affine oracle |
| Contract rejection | 5 | rank, shape, dtype, batch bound, and non-finite scalar fail before Worker request |
| Boundary and Worker reports | 5 | malformed output, definition preparation, definition identity, invalid failure envelope, and mismatched report coordinates remain distinguishable |
| Transport and Runtime | 3 | unavailable Worker, interrupted transport, and Runtime failure remain distinguishable |
| Races | 3 | expired deadline prevents dispatch; execution deadline and caller cancellation cannot be rewritten by late completion |
| Recorder degradation | 1 | invocation may succeed, but acceptance becomes `INCONCLUSIVE` when host evidence cannot be retained |
| Evidence mutation | 5 | missing and truncated bundles are `INCONCLUSIVE`; reordered, corrupt, and conflicting bundles are `FAIL` |
| Verifier failure | 1 | verifier failure is non-zero, cannot rewrite invocation truth, and is recorded as `INCONCLUSIVE` in the matrix |

The complete matrix therefore contains 24 scenarios: 18 executable, five evidence-mutation, and one
verifier-failure case.

## Exact local verification

From the repository root:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
node scripts/verify-m2.mjs
git diff --check
```

`verify-m2.mjs` builds the checked-in Java modules, prepares an ignored Python virtual environment,
generates both carrier bindings from the one Proto source, starts and stops real Worker processes
serially, retains each bundle, and invokes the offline verifier. Disposable output remains under
`build/m2`; it is not source-controlled milestone evidence.

## Authority and dependency review

- M1 remains independent of gRPC, Protobuf, NumPy, and cross-language process execution.
- Generated carrier types and gRPC imports are restricted to the gRPC adapter package.
- The Java host API contains only JPyxis types and Java standard-library types.
- The Worker reports observations; it cannot publish an invocation terminal state or acceptance verdict.
- Arbitrary Worker failure codes and mismatched coordinates are rejected at the host boundary.
- The Acceptance Harness reads completed evidence and cannot mutate the authoritative outcome.
- No Spring, database, queue, Torch, ONNX Runtime, Arrow, lifecycle, registry, routing, or M3 module has
  entered the M2 implementation.

## Review corrections

Passing builds were not treated as sufficient evidence. Review and repeated real-process runs found
and corrected these defects before public review:

- the shaded Java executable originally omitted ServiceLoader metadata and passed compilation while
  failing at runtime;
- a malformed definition failure branch became unreachable during an edit and was caught by the
  end-to-end matrix;
- the independent oracle initially compared JSON object insertion order and was corrected to compare
  values structurally;
- incomplete evidence initially lost precedence to later semantic checks and was corrected so absence
  cannot become false certainty;
- the Invocation Manager originally scheduled its deadline from a stale remaining duration after
  carrier setup; it now preserves the absolute deadline and has a focused regression test;
- initialization failure now closes the carrier and recorder;
- one failing cancellation observer can no longer block the framework cancellation observer;
- the harness now stops a started Worker even when a scenario fails before ordinary cleanup.

## Closure gate

- [x] The typed success path crosses a real process boundary and matches the independent oracle.
- [x] Bad input is rejected before Worker execution.
- [x] Definition, transport, Runtime, deadline, cancellation, and output faults remain distinct.
- [x] Exactly one Java-owned invocation terminal state is retained when recording is healthy.
- [x] Late completion cannot rewrite timeout or cancellation.
- [x] Host API and M1 dependency boundaries remain intact.
- [x] Offline bundle verification distinguishes `PASS`, `FAIL`, and `INCONCLUSIVE`.
- [x] Missing, corrupt, reordered, and conflicting evidence cannot produce `PASS`.
- [ ] The reviewed head passes the required public status check.
- [ ] The reviewed-head artifact is downloaded or read back and agrees with the local matrix.
- [ ] The merge commit passes the same required status check on `main`.
- [ ] The merged-main artifact is downloaded or read back and agrees with the reviewed head.
- [ ] Exact public coordinates and a freeze manifest are retained in the repository.
- [ ] An annotated M2 freeze tag resolves to the accepted closure commit.

## Explicitly unproven

- general Runtime or transport replaceability;
- deployment lifecycle, registry, routing, retries, and durable recovery;
- multi-Worker or multi-host behavior;
- performance and resource limits;
- security isolation;
- accelerators or high-performance data planes;
- clean-machine reproduction;
- production readiness or business success.

These claims belong to later named gates. They must not be inferred from the M2 candidate.

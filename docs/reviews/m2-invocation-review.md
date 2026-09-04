# M2 Invocation Review

Status: `FROZEN FOR M3 ENTRY`

Freeze coordinate: `m2-invocation-v1`

M2 is accepted as a validated, bounded invocation prototype. This record authorizes only the M3
Runtime-abstraction experiment defined by the roadmap. It does not promote lifecycle, retry,
routing, recovery, performance, security, accelerator, multi-host, clean-machine, production, or
business-success claims.

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

Public verification repeated the complete repository, M1, and M2 gates on GitHub Actions
`ubuntu-latest`, Java 17.0.20.1, Python 3.12.14, Node.js 22.23.2, and the checked-in Maven wrapper.
The downloaded reviewed-head and merged-main M2 summaries were byte-identical and each reported the
same 24-scenario matrix and explicitly unproven list as the local result. The offline verifier was
also rerun against the downloaded merged-main success bundle and returned `PASS`.

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
- [x] The reviewed head passes the required public status check.
- [x] The reviewed-head artifact is downloaded and agrees with the local matrix.
- [x] The merge commit passes the same required status check on `main`.
- [x] The merged-main artifact is downloaded and agrees with the reviewed head.
- [x] Exact public coordinates and a freeze manifest are retained in the repository.
- [x] The annotated M2 freeze coordinate is defined; the protected tag is created from the accepted
  closure commit, never from the implementation branch.

## Public evidence coordinates

- implementation PR: [#8](https://github.com/NoctilumeDev/JPyxis/pull/8);
- reviewed head: `36a1870a400c5bf3da1de0e0954bbd177b421b8b`;
- reviewed-head CI: [run 33859575101](https://github.com/NoctilumeDev/JPyxis/actions/runs/33859575101), artifact `9931642374`;
- GitHub reviewed merge revision inside that artifact: `4ffb6eabc55a12274067917852d1770f9dede4ed`;
- implementation merge: `67870a1cacb216450817d401727f929c086d729c`;
- merged-main CI: [run 33859986888](https://github.com/NoctilumeDev/JPyxis/actions/runs/33859986888), artifact `9931793483`;
- both public conformance-summary SHA-256 values: `99977d50098b62c2c3e6f77e8a5baa9a45056012cd6aa2ca07b9da1239af65a0`;
- retained evidence index: [`evidence/m2/freeze-manifest.json`](../../evidence/m2/freeze-manifest.json).

The reviewed-head artifact records GitHub's temporary pull-request merge revision rather than the
branch head. Both coordinates are retained instead of treating one as the other.

## Explicitly unproven

- general Runtime or transport replaceability;
- deployment lifecycle, registry, routing, retries, and durable recovery;
- multi-Worker or multi-host behavior;
- performance and resource limits;
- security isolation;
- accelerators or high-performance data planes;
- clean-machine reproduction;
- production readiness or business success.

These claims belong to later named gates. They must not be inferred from the M2 prototype.

M2 is therefore frozen for M3 entry. M3 must add a second conforming Runtime fixture or implementation
without changing the frozen host contract, authority rules, or public failure meaning.

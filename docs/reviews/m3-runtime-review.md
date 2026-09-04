# M3 Runtime Review

Status: `FROZEN FOR M4 ENTRY`

Freeze coordinate: `m3-runtime-v1`

M3 is accepted as a validated, bounded runtime-replacement prototype. This record authorizes only
the M4 lifecycle experiment defined by the roadmap. It does not promote an open plugin ecosystem,
arbitrary operation portability, dynamic installation, lifecycle, routing, performance, security,
accelerator, multi-host, clean-machine, production, or business-success claims.

## Implemented boundary

- one product-neutral capability requirement and operation coordinate owned outside Runtime providers;
- one immutable runtime binding resolved before dispatch and pinned to the invocation attempt;
- one narrow Worker-local Runtime Provider SPI that accepts and returns only M3 semantic values;
- one NumPy CPU provider and one dependency-free Python reference provider;
- one runtime-neutral affine definition plan shared by both providers;
- provider-native values contained inside provider implementations;
- capability incompatibility rejected before dispatch;
- changed binding rejected before runtime start;
- stable host-owned result and failure meaning across both providers;
- retained per-scenario evidence bundles and an offline verifier independent of provider verdicts.

The two providers are bounded conformance fixtures. They establish one real replacement boundary;
they do not establish that arbitrary third-party runtimes are plugins.

## Acceptance matrix

| Group | Cases | Accepted behavior |
| --- | ---: | --- |
| Exact execution | 4 | integer-like and fractional float32 inputs agree exactly across NumPy and reference providers |
| Runtime failure | 2 | both providers map an execution exception to `RUNTIME_EXECUTION_FAILED` |
| Resolution boundary | 1 | an incompatible capability becomes `RUNTIME_CAPABILITY_UNSUPPORTED` before dispatch |
| Binding boundary | 1 | a changed resolved binding becomes `RUNTIME_BINDING_MISMATCH` before Runtime start |
| Evidence mutation | 2 | missing evidence is `INCONCLUSIVE`; corrupt evidence is `FAIL` |

The complete matrix contains ten scenarios: eight executable and two evidence-mutation cases.

## Verification

The serial local gate was repeated from the repository root:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
node scripts/verify-m2.mjs
node scripts/verify-m3.mjs
git diff --check
```

The complete M1, M2, and M3 gates then ran on the reviewed pull-request revision and again on the
merged `main` revision. Both M3 artifacts were downloaded after their Runtime processes had exited,
and `verify-m3-evidence.mjs` returned `PASS` for all ten scenarios. Their conformance summaries were
byte-identical.

The merged-main evidence records GitHub Actions `ubuntu-latest`, Linux
`6.17.0-1022-azure` x64, Java 17.0.20.1, Python 3.12.14, Node.js 22.23.2, Maven Wrapper 3.9.11,
NumPy 2.2.6, and reference Runtime 3.12.14. These observations describe that run; they are not a
clean-machine or resource-capacity claim.

## Authority and dependency review

- the Java host API still exposes no gRPC, Protobuf, Python, NumPy, or provider types;
- generated carrier types remain inside the gRPC adapter package;
- the definition plan, Invocation Manager, M3 server, and Runtime SPI do not name either provider;
- provider implementations do not import host or generated carrier types;
- capability resolution remains a Control decision; provider advertisements are observations;
- Worker reports cannot commit the host terminal state or acceptance verdict;
- M1 and M2 suites remain green and their immutable tags and evidence manifests are unchanged;
- no Spring, database, queue, Torch, ONNX Runtime, Arrow, lifecycle, registry, routing, or M4
  implementation entered the M3 boundary.

## Review corrections

Passing builds were not treated as sufficient evidence. Review corrected these issues before freeze:

- the cross-runtime oracle now applies explicit float32 normalization rather than host double semantics;
- both providers validate that the runtime-neutral definition names the operation they implement;
- blank runtime binding coordinates are rejected instead of being accepted as partial metadata;
- the offline verifier proves one shared contract and definition coordinate and requires both named
  Runtime identities;
- Worker observation recording was extracted into one shared boundary to avoid divergent M2/M3 logic;
- missing capability reports are rejected explicitly rather than producing an incidental null failure;
- repository actions were upgraded and pinned to Node 24-capable releases before public freeze;
- the main protection rule was advanced from the frozen M2 check to the required M3 check before merge.
- both workers now start their gRPC server before publishing `WORKER_LISTENING`;
  [public run 33868616055](https://github.com/NoctilumeDev/JPyxis/actions/runs/33868616055)
  exposed that the earlier observation could race ahead of actual readiness and produce
  `WORKER_UNAVAILABLE`.

## Closure gate

- [x] One unchanged host contract and definition execute through two Runtime fixtures.
- [x] Exact success values agree with an independently recomputed float32 oracle.
- [x] Public Runtime failure meaning is stable across both providers.
- [x] Capability mismatch fails before dispatch.
- [x] Runtime binding mismatch fails before Runtime start.
- [x] Runtime-native values and implementation identities do not leak into neutral layers.
- [x] M1 and M2 frozen regression suites remain green.
- [x] Completed bundles remain independently verifiable offline.
- [x] Missing or corrupt evidence cannot produce `PASS`.
- [x] The reviewed head passes the required public check and its artifact is read back.
- [x] The implementation merge passes the same required check on `main` and its artifact is read back.
- [x] Both public conformance summaries have the same SHA-256 digest.
- [x] Exact public coordinates and the freeze manifest are retained in the repository.
- [x] The protected annotated tag is created only from the accepted closure commit.

## Public evidence coordinates

- implementation PR: [#10](https://github.com/NoctilumeDev/JPyxis/pull/10);
- reviewed head: `8c54840733335be18cbe006f273e5994d3a931eb`;
- reviewed-head CI: [run 33866645415](https://github.com/NoctilumeDev/JPyxis/actions/runs/33866645415), artifact `9934292628`;
- GitHub reviewed merge revision inside that artifact: `87e69a442dfcb5df1d9db04bfce31aeaaba274e0`;
- implementation merge: `eb5950576168c872e0014b2fb27901de7081bcc4`;
- merged-main CI: [run 33867080260](https://github.com/NoctilumeDev/JPyxis/actions/runs/33867080260), artifact `9934464719`;
- both public conformance-summary SHA-256 values: `878a5c91cf765dae16b9a3a39a719c7ae9bee43d0bffc94f4fd6687af56d837f`;
- retained evidence index: [`evidence/m3/freeze-manifest.json`](../../evidence/m3/freeze-manifest.json).

The pull-request artifact records GitHub's temporary merge revision, while the run itself also
identifies the reviewed branch head. Both coordinates are retained because neither substitutes for
the other.

## Explicitly unproven

- arbitrary third-party plugin compatibility or dynamic plugin installation;
- general operation or numerical portability;
- deployment lifecycle, immutable registry, activation, drain, rollback, routing, or recovery;
- performance and resource limits;
- production readiness or security isolation;
- accelerators, high-performance data planes, or multi-host behavior;
- clean-machine reproduction;
- business success.

M3 is therefore frozen for M4 entry. M4 may add deployment lifecycle only through new state and
artifact boundaries; it may not weaken M1 contract meaning, M2 invocation authority, or M3 Runtime
capability and binding semantics.

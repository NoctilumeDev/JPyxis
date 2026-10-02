# Versioned Risk Scoring Reference Host

Status: `REFERENCE HOST CANDIDATE · ACTUAL QUALIFICATION REQUIRED`

This private application is a second host integration over the already qualified bounded affine
reference composition. It is not a public SDK or a new Core profile. Java prepares synthetic
normalized exposure, activity, velocity and concentration features. The frozen tensor contract
requires four columns. Python/NumPy computes four finite float32 affine values; the first is RiskScore
and the other three are computation signals. Java alone applies the sealed
policy: score below 0.55 is ALLOW, below 0.80 is REVIEW, otherwise REJECT. Any non-success withholds
the decision. The policy is a demonstration over synthetic inputs, not a financial model.

## Precontract and seam audit

Entry main: `9b0002c0591978a76a23eead1872c2b4e01997e3`. README's qualification closure is present
in that tree. Main protection is strict, has no bypass actor, and retains the actual-path, M5 and
M6 required jobs. The original dirty checkout is outside this worktree and is not a build input.
No applicable AGENTS.md was found. Current authority is the
[completed bounded path](../../docs/reviews/reference-path-qualification-closure-v1.md), the frozen
[outer contract](../../docs/spec/productization-reference-path-contract-v1.md) and its
[ADR](../../docs/adr/0014-reference-path-realization-and-dispatch.md).

The concrete ReferenceControl, OwnedPythonWorkers, M2/M3 carrier/Runtime, M4 DeploymentManager and
M5 invocation owners already express this lifecycle. They remain unchanged. The application uses
the existing private composition package; it introduces no public AlgorithmSlot. Two definition
snapshots carry an inert JSON calibration comment and the existing M3 affine plan. The private Java
mapper reads only that bounded JSON, binds its scale/bias to the retained definition and supplies
them as typed computation inputs. The actual Python Runtime computes score and signal. Version,
definition, Environment and worker facts come from the qualified realization and dispatch receipt,
not from a score payload. These versions calibrate the same affine operation; they do not claim
a new general Risk Runtime capability.

The existing JDK 17 HTTP server serves the PC-first observatory and a private loopback operation
surface. Static DOM/CSS/JS and all business logic live in this isolated application. No Spring or
frontend dependency is required. Requests select named synthetic cases; Python reads no database,
business API, session or current time as an algorithm input. Its witness timestamps are observations.

## Page state matrix

| Actual state | Qualified action | Execution report | Central binding | Java decision |
| --- | --- | --- | --- | --- |
| No installed artifact | Install and warm v1 | No execution | No active binding | WITHHELD |
| v1 STANDBY, qualified | Activate v1 | Representative is separate | ELIGIBLE FOR ACTIVATION | WITHHELD |
| v1 ACTIVE | Invoke; install and warm v2 | Actual bound worker | ACTIVE BINDING ESTABLISHED | Only after SUCCEEDED |
| A held on v1, v2 STANDBY | Activate v2; release A | Actual M3 barrier, not busy NumPy | A's pin remains v1 | WITHHELD until completion |
| v2 ACTIVE, A on v1 DRAINING | Invoke B; release A | A uses v1; B uses v2 | Active route and request pin shown separately | Per-request policy only |
| v2 crashes after dispatch | Fresh rollback to prior artifact | OUTCOME_UNKNOWN | AUTHORITY HELD | WITHHELD, no automatic retry |
| Fresh rollback | Select prior bytes; new launch; representative warm; qualify; activate | New original Process/nonce | New realization, never revived handle | Future success only |
| Close completed | Export receipt | Physical shutdown observations | No routable workers | Historical decision preserved |

Invoke cannot install, warm, activate, change version or retry. At most one pending request per
realization avoids sharing diagnostic gates between invocations. The optional held request uses
the existing real M3 witness barrier with a 15-second limit, explicitly labelled in the UI. Crash
is an explicit diagnostic action that exits the actual worker after Runtime entry. Neither is a
mocked score or a production fault-control API. A logical UNKNOWN does not release its physical
obligation; final close follows existing forced-drain/owned-process boundaries. Receipt export is
sealed only after close. It proves this bounded execution/control contract, not a generic Verdict.

## Run and verification

From the repository root, with Java 17, Maven wrapper and native CPython 3.12 available:

```text
node scripts/run-risk-scoring-host.mjs
node scripts/run-risk-scoring-host.mjs --scenario
```

Set `JPYXIS_PYTHON` to the native interpreter when needed. Bootstrap installs only the existing
pinned M2/M3 requirements into a private environment and retains construction/source facts under
`build/risk/`. Its short directory names avoid Windows MAX_PATH without changing machine settings.
The live server binds loopback; stop it with Ctrl+C after closing
workers and exporting the receipt. The scenario uses the same HTTP operations and real separate
workers. Public qualification additionally requires fresh-VM gates, protected merge, exact-main
replay and downloaded independent readback. First failed candidates are retained before repair.

The observatory uses an ivory/navy/brass/burgundy palette, a stable central charter and two wings.
Score and business decision have separate visual treatments. UNKNOWN is amber and WITHHELD, never
a success decision or a red toast. No landmarks, heraldry or decorative assets carry application
state. All actions, lifecycle states, request records and receipt layers are accessible DOM.

This slice does not establish production readiness, general algorithms, durable host restart,
arbitrary environments, multi-node control, resource scheduling, untrusted-code isolation, FlowKernel
integration or VeriTrail authority. Any missing frozen semantic seam requires STOP before repair.

## First retained failures

The first install candidate `594ba2dd179ed47bbccb46bf0d8bb2dc97bdbeb4` hit Windows MAX_PATH before
any business worker launched. Its unchanged 181-member original archive is retained under
`evidence/risk-scoring-reference/v1/rejected-candidates/594ba2d-first-install`. The path repair
candidate `69ca5225af42d25b636c81848dfaefc0e2e9b8a3` then reached real HTTP/worker execution but its
two-column mapper was rejected against the frozen four-column input, and Java withheld the decision.
Its 228-member original archive and independently stopped processes remain under
`evidence/risk-scoring-reference/v1/rejected-candidates/69ca522-first-mapper`. The initial archive
metadata transcribed that complete source SHA incorrectly; its separate coordinate correction
derives the exact SHA/tree from original contained source facts without rewriting the initial ledger.
The mapper repair expands only application features, not the frozen contract.

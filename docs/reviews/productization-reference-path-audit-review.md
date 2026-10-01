# Productization Reference Path Audit Review

Status: `PUBLISHED AUDIT STOP · MODEL COUNTEREXAMPLE OBSERVED · NO PRODUCT CONTRACT FREEZE`

Client review date: 2026-10-01. Audit base: `9632a4f45c2190da6440e455667090fdd88e4a69`.
Source tree: `815c1af197cd1e430f49b64de4784605b1f720f0`.

## Disposition

Gate A stops before contract construction. The missing M2/M4/M5 realization continuity remains a
supported question, but the candidate overstates the existing local M5 coordinate guard. At the
exact base, a submitted attempt plan with a substituted epoch or idempotency declaration can become
authoritative logical `SUCCEEDED`. A capability can return a handle for different worker/instance/epoch
coordinates while Supervisor publishes the originally requested instance as `ELIGIBLE`.

These are model-level boundary probes with synthetic capability observations. They establish an
operand-validation counterexample, not a real computation, an unsafe retry, an actual stale-epoch
execution, a process leak, or production exploit. The first counterexample is retained without a
runtime fix or rerun. The existing bounded M5/M6 fixture evidence is preserved; it cannot be expanded
into proof that these substituted operands are rejected.

## Reconstructed coordinates

- the initial checkout was on `docs/productization-reference-path-audit`, with one README insertion
  and an untracked candidate audit; HEAD and cached `origin/main` were the audit base;
- the first direct fetch failed with `Could not resolve host: github.com`; the initial open-PR query
  also failed to connect; these failures were classified as transport/environment observations;
- a fetch through the already running local proxy succeeded; `git ls-remote` independently reported
  the same exact main SHA, and the current open-PR list was empty;
- origin is `https://github.com/NoctilumeDev/JPyxis.git`; the original checkout initially had no other
  worktree; the audit then created an isolated worktree on `docs/productization-reference-path-falsifiers`;
- main uses active ruleset `22108847`, with no bypass actors, a required PR, strict required checks
  `Verify M5 resilience repository` and `Verify M6 single-node baseline`, and resolved review threads;
- the legacy branch-protection endpoint returns 404 because protection is implemented by a ruleset;
  this is not evidence that main is unprotected;
- both required checks on the exact audit base succeeded in
  [run 33896108109](https://github.com/NoctilumeDev/JPyxis/actions/runs/33896108109);
  no artifact readback or new qualification is inferred from these checks;
- the public role map was read and its current main resolved to
  `cb67c33d4ba44c1b216c1f1cb7f6e45ef45fe329`, with map Git blob
  `0dd3fc2678de83c88bfbf234559bdf6a484fff46`. The
  [immutable role map](https://github.com/NoctilumeDev/NoctilumeDev/blob/cb67c33d4ba44c1b216c1f1cb7f6e45ef45fe329/docs/repository-system-map.md)
  constrains repository responsibilities, not JPyxis milestone qualification.

The original dirty checkout was preserved. Its README SHA-256 is
`64a1afafec7483e1e3db485b6ab7dfd583b3f6b734ad4fb786bc0daa697059b7`, and candidate SHA-256 is
`6f935df1ae541a9295b43df6ae758c5544c873d980f68b09793020e2745ceaeb`.
The [original candidate bytes](../../evidence/productization-audit/original-candidate.txt) are retained
separately from the revised STOP candidate.

## Frozen contract and executable boundary audit

The complete README, baseline, evolution map, candidate, M0 constitution/ownership/dependency/state/
failure/contract/blueprint documents, ADR-0001 through ADR-0011, M0 review and literature closure,
M1-M6 profiles and reviews were read. The runtime coordinate values and their producers/consumers
were compared with those documents. No later document was treated as a replacement for earlier
frozen ownership.

| Boundary | Frozen authority and executable witness | Audit result |
| --- | --- | --- |
| M0 | Roles own facts; Contract owns meaning; events cannot mutate another owner's state | Retained. Language/product choices remain reference witnesses. No FlowKernel resource grant or VeriTrail Verdict authority is introduced. |
| M1 | Canonical contract identity and independent Java/Python validation | Reuse exact contract and digest. Do not turn M4's contract string or a runtime advertisement into an independent contract authority. |
| M2 | InvocationManager validates contract/definition/runtime coordinates and owns one local terminal decision | It generates fresh invocation/attempt/trace IDs internally; no public entry binds them to an M4 pin or M5 plan. A later contract would need explicit pre-dispatch association, not a post-hoc receipt join. |
| M3 | Product-neutral capability requirement and one Control-pinned resolved Runtime binding | Reuse this binding. Environment construction/provenance cannot mint a second runtime identity. |
| M4 | Registry immutable artifact/contract association; DeploymentManager load/warm/activate/pin/drain/unload/rollback | Candidate correction: `load(ArtifactPayload)` already carries artifact coordinate, contract identity and defensive bytes. The pin lacks the M5 worker/epoch and exact M2 runtime association. The shipped capability is a deterministic fixture. |
| M5 | Supervisor owns worker eligibility; ResilientInvocationManager owns plans, retry and logical terminal decisions | `AttemptPlan` carries epoch/idempotency fields, but the observation gate does not compare them. Returned worker handle coordinates are not matched to the start request. First probes reproduced unexpected acceptance. |
| M6 | Outer lab composes ordered frozen gates; independent retained-bundle verification after shutdown | Preserves the bounded baseline. It does not make the M4 fixture, M5 child/executor fixture and real M2/M3 worker one realization. No fresh public-clean or product readback was performed in this stopped audit. |

M2 terminal outcomes and M5 logical terminal outcomes remain separate. `TIMED_OUT` or `CANCELLED`
must not be mapped to conclusive execution failure without matching attempt observations. A late
result cannot rewrite a terminal decision. These seams remain unclosed; no new terminal mapping,
Environment schema, lifecycle state, general algorithm surface or façade was frozen.

`CONTRIBUTING.md` still speaks of M0-M3 and M4 as next work, while exact-main's M4-M6 profiles,
reviews, tags and manifests record later freezes. This is stale guidance, not authorization to
restart M4 or widen productization. It was recorded and left outside the minimal counterexample
change. Historical stage-entry phrases in the baseline are read against each named stage's later
freeze, not as a current resource or implementation decision.

## First executable counterexample

The probe was compiled with Java 17.0.12 from the exact base's public M5 APIs, Core and port models.
Every compiled predecessor file was checked against its base Git blob before `javac --release 17`.
No target JAR, Maven cache, installed binding, Python path, generated carrier or previously built
class was imported. The probe class output was new, and each case ran in a separate fresh JVM.

The journal fixture implements the existing public journal port in memory. It does not claim
hash-chain durability or journal recovery. The capability fixture provides a deterministic synthetic
success observation, as the existing M5 model tests do. This isolates the coordinate gate from process,
compute, storage and transport questions. Compilation succeeded on the first run.

| Case | Required gate behavior | First observed behavior | Probe exit |
| --- | --- | --- | ---: |
| `honest_plan_control` | accept an unchanged plan | `SUCCEEDED` | 0 |
| `worker_instance_substitution` | reject changed worker instance | `ATTEMPT_COORDINATE_MISMATCH` | 0 |
| `worker_epoch_substitution` | reject changed worker epoch | `SUCCEEDED` | 2 |
| `idempotency_substitution` | reject changed mode/scope | `SUCCEEDED` | 2 |
| `worker_handle_substitution` | reject foreign handle before eligibility | `ELIGIBLE` under original published coordinates | 2 |

The idempotency case does **not** establish an unauthorized retry: the manager's authoritative request
remains `NONE`. It establishes that a plan submitted to the executor and then observation gate can
carry a different declaration without rejection or retained disclosure of that mismatch.

The epoch case keeps the original instance ID and changes its epoch field. That tuple is inconsistent
with the retained plan; its rejection cannot be inferred from an instance ID that happens to contain
epoch text. The public record does not enforce that relationship.

The handle case returns a fault-injected, valid-shaped `WorkerHandle` for different worker, instance
and epoch values. A healthy observation on that returned handle is accepted under the requested
coordinates. It does not show that the shipped LocalWorkerProcessControl returns a foreign handle;
that fixture validates its own READY handshake. It shows that Supervisor's general public consumer
does not independently enforce the expected coordinate binding.

Exact consumers at the immutable base:

- [ResilientInvocationManager.java, lines 147-182 and 394-399](https://github.com/NoctilumeDev/JPyxis/blob/9632a4f45c2190da6440e455667090fdd88e4a69/resilience/java/src/main/java/io/jpyxis/resilience/core/ResilientInvocationManager.java#L147)
  checks only part of the submitted plan before applying the observation;
- [WorkerSupervisor.java, lines 99-129 and 148-170](https://github.com/NoctilumeDev/JPyxis/blob/9632a4f45c2190da6440e455667090fdd88e4a69/resilience/java/src/main/java/io/jpyxis/resilience/core/WorkerSupervisor.java#L99)
  retains a returned handle and later compares that handle to itself, not to the requested coordinates;
- [M5 profile, lines 69-72 and 138-140](https://github.com/NoctilumeDev/JPyxis/blob/9632a4f45c2190da6440e455667090fdd88e4a69/docs/spec/m5-resilience-profile.md#L69)
  requires coordinate validation and Control epoch fencing; a field's presence is insufficient proof.

The [first receipt](../../evidence/productization-audit/first-coordinate-probe/receipt.json) contains
source, probe and harness hashes, toolchain observations, raw journal projections and each child exit.
Its SHA-256 is `0b6ce408ba543c119ddcc93f3bb8e5be2c7f06b5fbe7ef35d2899a1dba07eb0d`.
The individual first stdout and stderr files are retained beside it.

The first audit-saving commit `0808b70cbd986586893afe97ce9707b6e7da6c3e` applied the repository's
ordinary JSON newline normalization to all five raw stdout files. Git-blob readback then failed
their first-observation hashes. This is a separately retained storage-integrity failure, not another
product-model run. The [failure record](../../evidence/productization-audit/storage-first-failure.json)
names each original and normalized digest. A local `.gitattributes` rule disables text normalization
only for this retained audit subtree; the original CRLF stdout bytes are re-added from the unchanged
first-run files. Neither the failed saving commit nor the first receipt is amended or recomputed.
The raw-byte saving commit `d3c4860294aff9754c44bb5218ef00390feadecc` passed storage readback, but
`git diff --check` treated the raw carriage returns in the text `.json` archives as whitespace
failures. The final archive therefore stores the identical raw bytes as `*.stdout.bin` with binary
diff treatment, while the parsed JSON projection remains in `receipt.json`. This changes the storage
representation rather than the hash target, source hygiene threshold, or observed result. The first
run's ignored `.stdout.json` files remain untouched.

Read back a final immutable audit commit's stored bytes with:

```text
node experiments/productization-audit/verify-retained-receipt.mjs <audit-commit-sha>
```

`VERIFIED` from this command means only that the first audit receipt and raw retained bytes agree.
The product audit decision remains `STOP_MODEL_COUNTEREXAMPLE`.

Reproduce from a checkout containing this audit with JDK 17 and Node, choosing a new output directory:

```text
node experiments/productization-audit/run-coordinate-gate-probe.mjs build/productization-audit/reproduction-01
```

Exit 2 is the observed counterexample, not a passing product qualification gate. The runner refuses to
overwrite an existing run directory. The first receipt stays immutable when reproducing later runs.

## Falsifier disposition

| Candidate falsifier | Current disposition |
| --- | --- |
| Existing coordinates already prove full continuity | Not established by the inspected public values, consumers and frozen fixtures. Existing M4 contract association is retained rather than duplicated. |
| Environment coordinate duplicates M3 binding | Still a contract-design rejection condition. No Environment schema was selected at this STOP. |
| Qualification trusts worker self-verdict | Still prohibited. The foreign-handle probe additionally disproves treating coordinate shape plus a healthy observation as sufficient consumer validation. |
| Workload requires excluded features | No such requirement observed; the existing stateless affine profile remains the narrow witness. No new workload was implemented. |
| Silent change to a frozen meaning | Any correction or stronger composition guard needs an explicit disposition of the affected M5 coordinate-validation expectation. No frozen source or semantic record was changed here. |
| Each local operand already has a complete authority guard | Falsified for the inspected M5 public boundary. Candidate downgraded to STOP. |

## Round record and next boundary

| Required record | This round |
| --- | --- |
| Did | Fetched and rebound exact coordinates, read frozen contracts, checked executable consumers, corrected the M4 payload premise, compiled fresh public-model probes and retained their first results. |
| Why | Determine whether the candidate is qualified input for the next contract rather than infer authority from object shape or green predecessor CI. |
| Original plan | Close audit A, then draft one bounded deployment-realization/dispatch/terminal contract before implementation. |
| Actual | Three substituted-operand cases crossed the current public guard. Audit A stopped. |
| Failed premise | A locally carried epoch/idempotency/worker coordinate is already completely checked by its Control owner. |
| Final state | Local reviewable audit STOP; no product contract, product runtime, PR, merge, new CI, tag or exact-main promotion. Original dirty checkout preserved. |
| Next authority | Report and review the counterexample. Explicitly decide the minimum M5 coordinate-validation disposition before reopening audit A. No automatic permission to patch M5 or continue B-G. |

The minimum review boundary is M5's returned worker-handle validation and retained-plan comparison,
with its declared epoch/idempotency meaning and affected gate coverage. A later accepted decision
must determine whether a versioned outer composition guard closes the obligation or whether the
affected frozen M5 review section must be reopened. Neither is silently selected here. General
scheduling, runtime ecosystems, OS resource authority, Evidence adapters, façades and Spring Boot
remain outside this boundary.

## Second instance-identity counterexample

The subsequent [superseded-instance report](m5-instance-failure-counterexample.md) records a distinct
failure of the proposed minimum repair: an unmodified old attempt's unknown outcome can make a
healthy replacement worker instance ineligible. Its first receipt, raw bytes, probe, controls and
storage readback remain immutable. PR #19's initial contract candidate is preserved as an unmerged
superseded candidate; it is not part of this audit-only publication or a runtime qualification.
The productization audit remains `STOP_MODEL_COUNTEREXAMPLE`. The next reviewed minimum is M5
identity conservation through both operand admission and the following Supervisor-owned effect.

## First-publication reconciliation

The original local STOP round above remains historical. [PR #18](https://github.com/NoctilumeDev/JPyxis/pull/18)
published its final head `c1c629a71ea2998e52fbc23fd5e31110a3f06848` without runtime repair and
protected-merged to `11e13099a9b81cf019844c8e4d1d1786ed913c53`. Required PR run `36841706762`
and exact-main run `36842471936` passed; their separately downloaded M5/M6 bundles and all eight
M6 mutations were independently read back. The
[manifest](../../evidence/productization-audit/publication.json) and retained PR/main readbacks
bind that publication. It promoted only the counterexample into main. The normalized-storage
candidate, raw-text hygiene failure and first raw receipt were preserved.

The initial M5 contract candidate was then superseded unmerged by the second counterexample.
Second publication and the separately reviewed
[M5 contract v2](m5-coordinate-validation-review-v2.md) do not qualify guard implementation or close
productization audit A. This record remains an effective product audit STOP until the separate
guard qualification and fresh audit.

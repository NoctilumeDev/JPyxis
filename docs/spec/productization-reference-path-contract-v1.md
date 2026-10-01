# Productization Reference Path Contract v1

Status: `REVIEWED CANDIDATE · CONTRACT QUALIFICATION PENDING · RUNTIME NOT AUTHORIZED`

## Qualified premise and first profile

This contract consumes qualified Audit A v3 at main
`42005e30e999242518a7435189e26269888c6750`. Its separate entry record binds protected PR #31,
exact-main gates, independent artifact readback and the first thirteen public-model rechecks.
M4 handle conservation and M5 coordinate validation remain separately qualified bounded inputs.
They supply no actual deployment-realization or cross-module dispatch proof by themselves.

The first profile is one trusted, local CPU host, one Control assembly and one concrete reference
slot. The workload is the existing stateless affine operation with finite, row-major float32 typed
input/output and the frozen computation contract. NumPy is the first real Runtime witness. Two
project-owned, M3-conformant definition artifacts exercise cutover and rollback; the old M4 v2
fixture is not automatically a real M3 definition. Java, CPython, NumPy and gRPC instantiate roles
for this profile and do not define the architecture's identity.

Every new deployment uses a new real Python process. No worker restart, module reload or new
instance may inherit an old deployment's qualification. Ownership is in memory for this assembly
lifetime; durable Control restart, multiple hosts and adversarial host attestation are unproven.

## Immutable operands and Environment

Control retains bytes before validation, construction or launch. A filename, current directory or
endpoint is a locator, not an operand snapshot. Definition preparation must use the exact retained
bytes whose SHA-256 is recorded, with the existing M3 plan shape and operation requirement. Hashing
a file and later loading unbound current contents does not satisfy this rule.

One deployment operand binds:

| Coordinate | Required meaning |
| --- | --- |
| Artifact | Existing M4 identity and digest; Registry-computed digest equals the retained definition bytes. |
| Computation contract | Existing contract identity and semantic digest derived by the frozen Contract parser; retain its exact input bytes separately. |
| Definition | Definition identity and digest equal the validated artifact and the worker's actually prepared byte snapshot. |
| Environment specification | Immutable first-profile fields below and their canonical digest. |
| Runtime requirement | Existing M3 affine-float32 capability/version, operation, dtype and layout. |
| Execution build | Exact committed source and retained adapter/build inputs, including the immutable construction-receipt digest, used to launch this realization. |

Artifact validation must associate the actual definition plan with the exact computation contract,
without replacing ArtifactRegistry's ownership. Execution qualification is a later decision.

The first `EnvironmentSpec` contains only these fields, under a versioned reference-profile schema:

| Field | Rule and workload reason |
| --- | --- |
| `pythonImplementation` | Exact `CPython` for this witness; the native packages use its interpreter ABI. |
| `pythonMajorMinor` | Exact `3.12`, already exercised by the clean predecessor profile; the full observed patch version remains a source fact. |
| `platform` | Exact observer `sys.platform` string selected before candidate construction; NumPy/gRPC native distributions are platform-specific. |
| `architecture` | Exact observer `platform.machine()` string selected before construction; no guessed equivalence or portability claim. |
| `requirementsClosureDigest` | SHA-256 of the canonical inventory of both existing M2/M3 requirements-file byte digests, including the included file. |
| `runtimePackages` | Exact versions of `numpy`, `grpcio` and `protobuf` required by the selected computation/transport, taken from the retained pinned inputs. |

Unknown fields, missing fields, null/non-string scalar fields, empty scalar fields, a package map
with different keys, or unsupported versions are rejected. The specification is UTF-8 JSON with
recursively sorted object keys, no insignificant whitespace and these exact values; SHA-256 of
those bytes is its identity. Local Linux and Windows specifications are distinct. Specification
values precede the candidate; a candidate report cannot supply its own expected specification.
No native ABI catalogue, wheel portability, dependency solver or environment-builder ecosystem is
introduced. Existing dependency versions and predecessor thresholds are not changed by this contract.

The construction receipt retains exact interpreter selection, requirements bytes, install/build
observations and the observed installed package inventory. A separate fresh interpreter probe uses
the same selected executable and immutable launch environment as the worker and records actual
implementation/version/platform/architecture/packages. The worker separately reports its actual
prepared definition, contract, environment observations and Runtime binding. Control compares
these source facts to the retained specification/build and known host launch. Worker `READY`, health,
or a self-declared PASS cannot qualify the realization.

## Realization and state ownership

The immutable realization association binds deployment ID, all operands, canonical M4 RuntimeHandle,
M5 worker/instance/Control epoch, the resolved M3 RuntimeBinding and one host-owned process launch.
The process locator and observed birth/liveness facts remain physical observations; a PID number
alone is not semantic identity or freshness proof. Control must demonstrate an actual new launch
and retain the exact owned process reference/birth observation used for later cleanup. Capability
returns cannot redirect ownership to an unrelated process.

| Owner | Authority |
| --- | --- |
| ArtifactRegistry | Immutable artifact registration, digest and validated artifact fact. |
| DeploymentManager | Existing handle admission, deployment graph, active binding, pins, drain and retirement. |
| WorkerSupervisor | Existing requested worker tuple, handle validation, health and instance eligibility. |
| M2 InvocationManager | Existing input/output and report-coordinate validation, resolved binding and caller terminal interpretation. |
| ResilientInvocationManager | Retained invocation policy, validated attempt association and authoritative logical terminal decision. |
| Reference composition Control | Expected operands, realization association, computation-domain qualification, exact pre-dispatch admission and interpretation of bound facts across those owners. |
| Execution capabilities | Launch/probe/warm/invoke/release observations and raw reports; no Control-owned activation, qualification or logical-terminal decisions. |

Composition Control retains the module owners privately and invokes their public boundaries.
There is no general public Runtime registry or AlgorithmSlot API. A deployment-specific M5 assembly
may contain only its corresponding worker so existing M5 selection remains meaningful; its plan
must still be compared to the pinned realization before actual dispatch. M5 eligibility and M4
STANDBY each retain their original meanings and do not independently establish product eligibility.

Candidate construction and qualification happen before M4 admission/activation. Qualification
requires independently bound construction/host observations, worker observations, the existing M3
probe/binding checks, and a real representative M2 invocation validated against the computation
contract and independent affine oracle. That invocation has a recorded qualification purpose and
cannot masquerade as an active product invocation with an M4 pin.

Only a positive Control decision for the exact unchanged realization permits M4 request/load/warm,
STANDBY and activation. Its load/warm capabilities report facts; Control invokes the transitions.
Early activation is rejected before the active binding changes. Qualification failure disposes only
the actual launch owned by the candidate's construction and keeps the prior active binding intact.
This requires no new M4 state or abort transition. If a later M4 admission fails, it cannot grant
cleanup authority over the rejected alias; independent ownership of a newly launched candidate
process remains separately traceable.

## Exact dispatch association

For an active product invocation, Control allocates the logical request, obtains the actual M4 pin,
and prepares the M5 plan from the corresponding realization's assembly. The first profile uses
`NONE`, empty deduplication scope and one attempt; it makes no automatic retry or exactly-once claim.

Immediately before transport dispatch, one immutable association binds:

```text
deployment operands + qualification decision + realization/launch
+ complete M4 InvocationPin
+ complete retained M5 AttemptPlan and request policy
+ complete generated M2 InvocationAttempt and resolved RuntimeBinding
```

The active binding selects a new pin only at acceptance. A legitimately retained old pin may still
dispatch/complete while its deployment is DRAINING. Check its outstanding obligation and captured
qualified owner; do not resolve the current slot again or require the old deployment to remain ACTIVE.

M2-generated invocation/attempt/trace IDs retain their frozen meaning. They may differ from M5 IDs;
the explicit association binds both without rewriting either report. M4's pin invocation ID names
the logical request. An ID string, equal artifact, repeated probe or endpoint lookup cannot replace
this association. The outer carrier may be versioned separately while keeping frozen M2 messages
and coordinates intact. Narrow factory/byte-snapshot/transport composition seams may be added to
reuse existing modules; the invocation Core, plan semantics and terminal meanings are not rebuilt.

Under the composition owner's atomic boundary, compare the actual pin, retained plan, qualification,
current worker/instance/epoch, actual owned launch/liveness, exact operands and expected Runtime
binding before admitting dispatch to that captured realization. Replacement between preparation
and dispatch must be rejected before transport/Runtime start. Do not release a lock and resolve a
new worker or endpoint after checking an old one. Reserve actual dispatch at most once for the
retained attempt and record the required association before transport invocation. Duplicate admission
or failure to retain the required owner record must not send work. Missing facts cannot become a
positive qualification claim. An external process death after admission can
still produce uncertainty; identity admission is not a guarantee that execution completes.

Worker-side outer checks compare the launch-bound deployment/artifact/contract/environment,
worker/instance/epoch and Runtime binding before delegating to existing M2/M3 coordinate/input/
definition/Runtime validation and real affine execution. The returned or retained source report
must identify that same association and its M2 report. A worker reports its observations and
execution stage, without an eligibility verdict or logical terminal state. Control validates the
full association before mapping any report into an M5 observation. Hash validity alone is insufficient.

## Waiting, execution knowledge and logical outcome

| Bound fact | Interpretation for this one-attempt profile |
| --- | --- |
| Host validation/admission ends before any transport dispatch | Known failed-before-execution; existing M5 rules yield FAILED. Retain the actual no-dispatch witness. |
| Fully matched completed report and M2 validated success | Existing M5 success observation yields SUCCEEDED. |
| Fully matched completed execution with known contract/Runtime failure or rejected result | Appropriate existing failed observation yields FAILED; distinguish completed execution from pre-execution rejection. |
| Deadline/cancellation, transport loss, crash or unbound response after dispatch without sufficient completion facts | UNKNOWN_REMOTE_OUTCOME; existing M5 rules yield OUTCOME_UNKNOWN. Preserve possible continued execution. |
| Validated late source success/failure after logical terminal decision | Record through the bound historical plan/late boundary; do not reopen terminal authority or poison a replacement instance. |

M2 TIMED_OUT/CANCELLED remain caller waiting outcomes. Their `executionMayContinue` information
and actual dispatch facts must be retained. M5 dispatch intent is intent, not proof of wire dispatch
or Runtime start. A cancellation request, child-stop request or missing response proves no physical
cessation. New positive completion evidence cannot rewrite a previously terminal logical result.
Late source observations must themselves retain matching coordinates and typed output/failure facts.

## Cutover, rollback and cleanup

Cutover uses M4's actual activation and pin accounting: old pins remain on the old realization and
new pins select the new active binding. Qualification and dispatch cannot silently rebind either.
Rollback preconstructs and qualifies a new actual worker from the previously validated immutable
operands, then uses the existing M4 rollback operation. Its deployment, worker instance, launch and
canonical handle are fresh. Same or cloned retired/spent tuples remain rejected by M4 v2 without
warming/unloading the alias or changing the current binding.

Pin accounting and physical execution obligations remain explicit. A logical UNKNOWN does not
prove remote completion. Drain/forced-termination requirements use existing M4 public actions;
they create lifecycle obligations, not invocation terminal facts. Release only through the
corresponding obligation, retaining any unresolved execution/termination knowledge.

Cleanup targets only host launches actually owned by this Control assembly. It records the request,
capability report and independent host observation of those exact processes after the request.
An unload callback may report success to M4 only after physical cessation is established for the
admitted realization. A still-live process or insufficient observation must fail closed and retain
UNKNOWN cleanup knowledge; it cannot establish successful physical release/retirement. M4's
existing failed-release state and monotone handle history remain unchanged. Exceptional containment
may later stop an owned process, but cannot rewrite an earlier false release observation or make
the first candidate pass. Record all actual candidate launches, including failures before admission,
and verify no child remains alive after the completed journey.

## Required actual witnesses and qualification

| Actual-path case | Required derived witness |
| --- | --- |
| Successful typed affine invocation | One joined M4 pin/M5 plan/M2 dispatch reaches real NumPy; exact validated result and SUCCEEDED. |
| Contract/definition mismatch | Bound expected operands reject before activation/Runtime start; current binding preserved. |
| Same artifact, different Environment | Control rejects qualification; source reports cannot redefine expected values. |
| Wrong resolved Runtime binding | Rejected before Runtime start, with existing M3 binding authority. |
| M4 pin A, worker/deployment B | Rejected before dispatch; actual pin and owner remain unchanged. |
| Instance changes after preparation | Deterministic check/apply witness rejects stale dispatch against the new instance. |
| Deadline before dispatch | No wire/Runtime start; waiting and known non-execution stay distinct. |
| Deadline with continuing execution | Caller wait ends; independent live/process and worker-start/completion observations establish continuation; logical UNKNOWN stays terminal. |
| Cancellation with possible continuation | Cancellation is a request; retain uncertainty until bound physical/completion facts exist. |
| Late success after UNKNOWN | Actual late result is bound and recorded; logical outcome does not upgrade and replacement state is conserved. |
| Real worker crash after dispatch | Independent owned-process death observation plus missing sufficient result; OUTCOME_UNKNOWN. |
| Warm/health success, representative validation failure | Qualification rejected, without activation or prior-binding mutation. |
| Activation before qualification | Owner rejection before lifecycle cutover. |
| Cutover with retained old pin | Old/new actual invocations use their respective captured workers and artifacts. |
| Fresh rollback and retired alias attempt | New actual launch/instance/handle succeeds; retired alias fails without foreign cleanup. |
| Release success report with worker still alive | No physical-release success; UNKNOWN/failed release is retained, followed by separately recorded containment. |
| Completed cleanup | Independent readback identifies every launched process and finds none alive. |
| Clean reproduction | Fresh Ubuntu CPU VM, no dependency/environment cache, exact committed inputs and retained actual-process receipts. |

The complete source-bound raw journey includes both owner decisions and physically separate child
observations, byte inventories, qualified inputs, oracle/output checks, dispatch association,
process birth/liveness/shutdown and resource observations. Emitters supply facts; an independent
reader after processes exit derives the bounded result. Missing required facts yield INCONCLUSIVE;
hash-repaired worker substitution, false cleanup and self-declared qualification must yield FAIL.

Contract content and its separate freeze record must pass repository/diff/retention checks,
protected PR gates, independently downloaded unchanged predecessors, protected merge, exact-main
gates and independent readback. Freeze authority is the accepted main and exact normative blobs;
no new M0-M6 milestone or unprotected tag supplies authority. Runtime work begins only after that
separate closure qualifies. Implementation then requires all old gates/counts/dependencies plus
its own actual-path gate, public clean execution, protected merge, exact-main replay and independent
reconciliation. Preserve and classify the first failure before any repair or new candidate.

This contract establishes no implementation result. A new model-level contradiction, larger frozen
lifecycle/authority conflict, required new product choice or unexpressible identity triggers STOP.
Spring shell/façade evaluation follows a proved path and is not default scope. General CLI/API/SPI,
model registry, environment ecosystem, distributed execution, accelerators, untrusted-code isolation,
resource grants/scheduling and external Evidence/Verdict/Adapter authority remain outside this slice.

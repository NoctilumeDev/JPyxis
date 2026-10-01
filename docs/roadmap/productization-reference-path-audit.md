# Productization Reference Path Audit

Status: `CANDIDATE · AUDIT STOP · MODEL COUNTEREXAMPLE OBSERVED · IMPLEMENTATION NOT AUTHORIZED`

Audit base: `main@9632a4f45c2190da6440e455667090fdd88e4a69`

Audit disposition: the missing cross-layer continuity remains a supported question, but the candidate
does not pass gate A. Fresh model probes accepted substituted M5 epoch and idempotency operands and
a substituted worker handle. See the [audit review](../reviews/productization-reference-path-audit-review.md)
and [first retained receipt](../../evidence/productization-audit/first-coordinate-probe/receipt.json).
Contract drafting/freezing and product runtime implementation remain blocked by that counterexample.

## Purpose

M0-M6 prove a bounded single-node research baseline. They do not yet prove that one real Python
algorithm can be constructed, qualified, activated, invoked, replaced, failed, rolled back, cleaned
up, and verified through one continuous product path.

This audit selects the next contract question. It does not define a public product API, add a new
milestone, authorize implementation, or widen any frozen M0-M6 claim.

## Frozen facts retained

- Java, Python, NumPy, and gRPC are the first reference implementations of architectural roles; they
  are not the identity of those roles.
- the Contract remains the cross-boundary source of semantic meaning;
- Control owns policy, activation, attempt eligibility, and authoritative terminal decisions;
- Definition describes an algorithm but does not activate itself;
- Runtime capabilities report observations and do not write Control-owned state;
- artifact identity, active binding, invocation outcome, and acceptance verdict remain distinct;
- an uncertain remote execution cannot be inferred to have failed or succeeded;
- M4 rollback creates a new deployment from a previously validated artifact and does not revive a
  retired Runtime handle;
- M6 remains an outer reproduction and evidence layer, not a product runtime.

## Cross-repository role constraint

The public
[Repository System Map](https://github.com/NoctilumeDev/NoctilumeDev/blob/main/docs/repository-system-map.md)
is the stable cross-repository role map. It is not the authority for JPyxis milestone status, but a
JPyxis candidate must not silently contradict its ownership boundaries.

For this audit, the relevant division is:

```text
JPyxis
    computation contract
    artifact and deployment identity
    invocation lifecycle
    Runtime binding
    source-owned execution facts

FlowKernel (planned)
    Principal and system Capability
    resource grants and hard resource boundaries
    privileged transitions and resource recovery

VeriTrail
    Plan and Evidence contracts
    integrity and sufficiency checks
    deterministic Verdict derivation
```

Consequently, JPyxis may declare the execution requirements needed by one computation and may decide
whether reported observations satisfy its computation-domain contract. It must not grant itself OS
Capabilities, become a general resource scheduler, own container or cgroup policy, or arbitrate
resources among unrelated principals. When FlowKernel is absent, a host or operator may provide the
required resources without transferring resource authority into JPyxis.

JPyxis may retain immutable execution receipts needed to explain its own deployment, invocation,
cutover, and recovery decisions. Those receipts remain JPyxis source facts. They are not automatically
standard VeriTrail Evidence and cannot produce a VeriTrail Verdict. A future read-only Evidence
Adapter remains a separate cross-repository contract and is outside this productization slice.

Every later productization proposal must therefore pass three questions:

1. does it make the Control / Execution boundary more concrete and testable?
2. does it accidentally move system resource or Capability authority into JPyxis?
3. does it turn JPyxis receipts into a general evidence-qualification or Verdict system?

If the first answer is no, or either later answer is yes, the proposal stops at audit.

## The composition audit

The frozen modules currently prove different parts of the intended path with different bounded
fixtures:

```text
M2 / M3
real Java -> gRPC -> Python -> Runtime invocation

M4
artifact and deployment lifecycle through a deterministic lifecycle capability

M5
worker supervision, retry, recovery, and UNKNOWN outcomes through bounded local fixtures
```

Running these gates in one ordered M6 journey proves that all frozen claims remain reproducible. It
does not prove that M2, M4, and M5 refer to the same deployment realization during one invocation.

### M2 invocation coordinate

M2 pins:

```text
contract identity + digest
definition identity + digest
invocation / attempt / trace
resolved Runtime binding
```

It does not carry an M4 deployment ID, lifecycle pin, M5 worker instance, or desired-intent revision.
Its `InvocationManager` also remains the affine reference implementation rather than a general
product façade.

### M4 lifecycle pin

M4 pins:

```text
slot
deployment ID
artifact coordinate
Runtime handle
invocation ID
```

The pin itself does not carry the M2 contract or exact M2 Runtime binding, M5 attempt, or M5 worker
instance. However, `ArtifactRegistry` immutably associates the artifact with a `contractIdentity`,
and `DeploymentRuntime.load()` receives an `ArtifactPayload` containing that contract identity,
the artifact coordinate, and defensive content bytes. This existing contract association must be
reused. The frozen reference capability remains separate from the real Python worker path.

### M5 attempt plan

M5 `AttemptPlan` carries:

```text
logical invocation / attempt / trace
worker instance + Control epoch
idempotency mode + deduplication scope
```

It does not identify the M4 deployment and lifecycle pin, artifact coordinate, M2 contract,
definition digest, or resolved Runtime binding. The frozen worker child and attempt executor are
fault-injection fixtures, not the M2 Python worker.

Carrying the fields does not establish complete operand validation. At the audit base,
`ResilientInvocationManager.samePlan()` compares trace, attempt number, worker ID, and instance ID,
but omits the worker epoch, idempotency mode, and deduplication scope. `WorkerSupervisor.start()`
also accepts a returned `WorkerHandle` without matching its worker/instance/epoch to the requested
coordinates. Fresh audit probes reached `SUCCEEDED` with a substituted epoch or idempotency
declaration, and reached `ELIGIBLE` after a substituted handle. These observations block treating
the current public boundary as a sufficient identity/authority guard for the product path.

### Resulting gap

The existing objects cannot yet prove this statement:

> The exact deployment selected and pinned by lifecycle Control is the same worker realization,
> artifact, contract, and Runtime binding used by the attempt that produced the reported result.

The frozen gates establish their declared fixture outcomes. They do not establish complete
coordinate rejection at every public boundary. The composition needs an exact operand continuity
rule, and the observed local M5 guard counterexample must be disposed of before that rule may be
drafted as qualified construction input. This is an identity and authority question, not merely
missing adapter code.

## Terminal-state seam

M2 exposes `SUCCEEDED`, `FAILED`, `TIMED_OUT`, and `CANCELLED`. A timed-out or cancelled M2 result may
also state that execution can continue. M5 exposes `SUCCEEDED`, `FAILED`, and `OUTCOME_UNKNOWN` as
authoritative logical terminal states.

No generic mapping is currently frozen. In particular:

```text
M2 TIMED_OUT + executionMayContinue
!= automatically M5 FAILED
!= automatically M5 OUTCOME_UNKNOWN without matching attempt evidence
```

The product path must distinguish the caller's waiting outcome, the attempt observation, and the
logical invocation decision. A transport deadline remains a bound on waiting authority; it is not
proof that Python execution stopped.

## Executable-environment seam

M4 currently identifies bounded definition bytes. The same bytes may execute under different Python
versions, dependency sets, native ABIs, platforms, or Runtime providers. Therefore artifact identity
alone cannot qualify a real product deployment.

The audit retains four candidate concepts without freezing their schemas:

```text
Environment specification
    Control-owned expected execution constraints

Environment construction evidence
    how a concrete environment was assembled

Environment realization observation
    what the launched worker and independent probes observed

Environment qualification decision
    JPyxis Control's computation-domain decision that the realization satisfies the specification
```

The M3 capability requirement and Control-pinned resolved Runtime binding remain authoritative. A
future environment contract must compose with them rather than introduce a second Runtime identity.
Worker self-report alone cannot qualify its own environment.

Environment requirements must remain requirements on an execution capability. They must not encode
who may receive host resources, how unrelated workloads are scheduled, or which privileged OS
mechanism enforces a grant. Those belong to the host today and to a possible FlowKernel composition
in the future.

The minimum Environment specification is deliberately unresolved. Candidate fields such as Python
version, platform, architecture, dependency lock, wheel hashes, or native ABI profile acquire
normative status only when the first real reference workload demonstrates that they are required.

## Lifecycle interpretation for the first reference profile

The first real product profile should investigate one fresh Python worker realization per new M4
deployment. This avoids in-place `importlib.reload()`, module-cache reuse, native-extension global
state, and hidden cleanup assumptions.

This is a candidate rule for the first reference profile, not a universal architecture invariant.
Another Runtime may later demonstrate an equally strong isolation and cleanup boundary without one
OS process per deployment.

M4 `STANDBY` remains the lifecycle state reached after successful warmup. This audit does not add a
new `READY` state. Environment qualification, Runtime probe, and representative invocation are
candidate activation-eligibility evidence whose exact relationship to `STANDBY` must be frozen by a
later contract.

Rollback remains a new deployment from previously validated operands. Under the candidate
one-worker-per-deployment profile, that implies a fresh worker realization rather than resurrection
of a retired process or Runtime handle. Warm-standby and cold rollback latency are not yet claimed.

## External counterexamples retained

The following primary-source observations constrain the first profile:

- CPython sub-interpreters share a process and do not provide perfect resource or extension-module
  isolation: <https://docs.python.org/3/c-api/subinterpreters.html>
- GraalPy documents that native extensions may bypass JVM protections, abort the process, retain
  global state, and prevent repeated context loading:
  <https://www.graalvm.org/jdk23/reference-manual/python/Native-Extensions/>
- gRPC documents that the server application must stop work spawned for a cancelled call, and that a
  deadline can be observed even when a state-changing operation completed:
  <https://grpc.io/docs/guides/deadlines/> and <https://grpc.io/docs/guides/status-codes/>
- TensorFlow Serving does not normally move a version label to an unavailable model, avoiding a
  mutable binding that points at an unready realization:
  <https://www.tensorflow.org/tfx/serving/serving_config>
- Python virtual environments are disposable and not movable; repeatable wheel bundles remain
  platform-specific:
  <https://docs.python.org/3/library/venv.html> and
  <https://pip.pypa.io/en/latest/topics/repeatable-installs/>

These sources constrain the candidate profile. They do not by themselves prove JPyxis behavior.

## Selected contract question, blocked at audit

The next minimal contract should answer:

> How does Control define one bounded deployment operand, qualify one real worker realization, pin a
> logical invocation and attempt to that realization, and preserve the same artifact, contract,
> Runtime binding, deployment, worker, and attempt coordinates through execution and terminal
> interpretation?

Here `qualify` is limited to JPyxis computation-domain eligibility. It does not authorize host
resources, attest an untrusted machine, or issue a cross-system acceptance Verdict.

The contract should close only the first reference path:

```text
validated definition artifact
+ exact contract
+ bounded Environment specification
+ M3 Runtime capability requirement
        ↓
fresh real Python worker realization
        ↓
qualification observations
        ↓
M4 STANDBY / activation eligibility
        ↓
M4 invocation pin
        ↓
M5 attempt plan
        ↓
M2 real invocation
        ↓
attempt observation
        ↓
M5 logical terminal decision
```

The contract must not yet define a Spring Boot façade, CLI, arbitrary algorithm schema, general
plugin SPI, distributed topology, model registry, environment builder ecosystem, or production
security boundary. It must also not define an OS resource scheduler, Capability issuer, general
Evidence model, Evidence Adapter, or Verdict engine.

## Required counterexamples for the contract

At minimum, the next contract must reject or preserve uncertainty for:

1. artifact identity matches but the Environment specification differs;
2. worker reports a Runtime binding other than the Control-pinned binding;
3. M4 pin names deployment A while M5 dispatches a worker for deployment B;
4. a worker instance changes after attempt preparation but before dispatch;
5. a deadline ends caller waiting while the Python process continues;
6. a late successful result arrives after the logical invocation became terminal;
7. warmup succeeds but the representative invocation fails contract validation;
8. activation occurs before environment and Runtime qualification close;
9. rollback tries to reuse a retired Runtime handle or hidden old process state;
10. cleanup reports success while the worker process remains alive.

## Falsifiers and stop lines

The selected contract must be reconsidered if:

- an existing frozen coordinate already proves full M2/M4/M5 operand continuity without extension;
- the proposed environment coordinate duplicates the M3 resolved Runtime binding;
- qualification requires trusting a worker's own verdict rather than validating observations;
- the first workload requires side effects, distribution, accelerators, or untrusted-code isolation;
- implementation would silently change a frozen M1-M6 meaning instead of composing through public
  boundaries.

The 2026-10-01 audit observed a model counterexample in the public M5 coordinate gate. The original
premise that each local coordinate was already fully guarded is withdrawn. This does not erase the
accepted bounded M5 fixture evidence or reopen a freeze tag automatically. It requires an explicit,
bounded disposition of the affected M5 coordinate-validation expectation before gate A can close.
No frozen document, manifest, tag, Core implementation, or predecessor test was changed in this audit.

Until a later contract is reviewed and frozen:

```text
gate A candidate qualification             STOP / COUNTEREXAMPLE OBSERVED
productization reference path contract     BLOCKED / NOT STARTED
real M2 + M4 + M5 composition              NOT AUTHORIZED
Environment specification schema           NOT FROZEN
new lifecycle state                         NOT AUTHORIZED
Spring Boot façade / CLI                    NOT AUTHORIZED
production-readiness claim                  NOT AUTHORIZED
```

## Next authorized action

Retain and review the first counterexample, then determine the minimum affected M5
coordinate-validation boundary and its required disposition. A later accepted decision must state
whether a versioned composition guard suffices or a frozen M5 review section must be reopened.
Do not silently strengthen M5, draft a frozen product contract, or implement the reference path
while the audit remains at STOP.

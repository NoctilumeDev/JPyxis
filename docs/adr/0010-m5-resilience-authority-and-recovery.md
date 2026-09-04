# ADR-0010: M5 Resilience Authority and Recovery

Status: `ACCEPTED FOR M5 CONSTRUCTION`

## Context

M2 proves one authoritative invocation outcome, M3 proves a bounded Runtime replacement boundary,
and M4 proves immutable artifacts plus atomic deployment cutover. None of those milestones decides
whether a worker remains eligible after a crash, whether an uncertain remote attempt may be retried,
or what a restarted Control process may safely reconstruct.

Treating all three questions as one generic `recovery` operation would collapse independent facts.
A worker heartbeat cannot rewrite a deployment, a transport exception cannot authorize a retry, and
replaying a stale `ACTIVE` label cannot recreate a valid Runtime handle.

## Decision

M5 introduces a separate resilience semantic layer and a reference Control assembly. The layer has
three bounded authorities:

- `WorkerSupervisor` owns worker instance state and routing eligibility;
- `ResilientInvocationManager` owns logical invocation state, attempt lineage, retry decisions, and
  the single terminal outcome for the M5 reference profile;
- `ControlIntentRegistry` owns the desired deployment intent used during restart reconciliation.

Existing authorities remain unchanged:

- `ArtifactRegistry` owns immutable artifact identity and validation;
- `DeploymentManager` owns actual deployment state and active bindings;
- Runtime and transport capabilities report observations only;
- the Acceptance Harness alone owns the verdict for a retained evidence bundle.

The M5 module may compose M4 through a reference assembly. M4 and the frozen invocation module may
not import M5, and M5 Core may not import lifecycle implementations, transport products, process
fixtures, or evidence encodings.

## Durable decision order

An attempt is recorded before a capability may observe it:

```text
logical invocation accepted
→ attempt identity reserved and durably recorded
→ eligible worker instance pinned
→ dispatch intent durably recorded
→ capability invoked
→ observation durably recorded
→ Invocation Manager decision durably recorded
```

If Control restarts after dispatch intent but before a conclusive observation, recovery records an
unknown remote outcome. It never manufactures success or assumes that cancellation rolled back
execution.

The reference durable journal is append-only, sequence checked, and hash chained. A truncated,
reordered, or digest-invalid journal fails closed. Optional telemetry export occurs only after the
authoritative event is durable; exporter failure cannot rewrite worker, invocation, retry, desired
deployment, or M4 facts.

## Retry rule

Retry is a Control decision, not a transport default. Every retry requires all of the following:

- an explicit idempotency evidence mode understood by the reference profile;
- one stable logical invocation identity and a new attempt identity;
- a bounded maximum attempt count;
- a currently eligible worker instance;
- retained evidence linking the preceding observation, retry decision, and new attempt.

The first reference evidence mode is `DEDUPLICATED_BY_LOGICAL_INVOCATION`. `NONE` never permits a
retry, including after a failure known to occur before execution. This deliberately strict rule
keeps the M5 claim small and reviewable.

An uncertain attempt without accepted idempotency evidence ends as `OUTCOME_UNKNOWN`, not success.
An uncertain attempt with evidence may move to `RETRY_PENDING` while budget remains. A late report
from an earlier attempt is retained but cannot rewrite a terminal logical invocation.

## Worker epoch and eligibility

Every started local worker receives a new instance identity and Control epoch. A process reporting
ready is still only an observation; `WorkerSupervisor` decides `ELIGIBLE` after a successful probe.

After Control restart, persisted registration and prior observations may be recovered, but live
eligibility is reset to `INELIGIBLE`. A worker must start or reattach under the new epoch and pass a
new probe before routing. The reference profile does not claim safe adoption of an arbitrary orphan
process.

## Restart reconciliation

Desired deployment intent and actual active deployment are separate facts. Recovery proceeds as:

```text
verify durable journal
→ recover Control-owned desired intent and attempt history
→ fence prior worker eligibility with a new Control epoch
→ resolve the immutable artifact by identity and digest
→ ask a new ArtifactRegistry and DeploymentManager to validate, load, warm, and activate
→ record the new active deployment observation
```

The recovery layer never writes an `ACTIVE` state directly and never resurrects a retired or
process-local Runtime handle. Failure to re-establish the deployment remains an explicit recovery
failure while the desired intent stays intact.

## Evidence boundary

The independent M5 verifier replays the hash chain, owner transitions, worker epochs, logical
invocation attempts, retry prerequisites, terminal uniqueness, and scenario-specific recovery
facts. Java exit status, a final snapshot, a Runtime success label, or telemetry output cannot
self-promote the evidence bundle to `PASS`.

## Explicit exclusions

M5 does not establish:

- multi-host failure detection, network partition handling, consensus, or leader election;
- durable adoption of orphan Runtime processes or operating-system resource reclamation;
- arbitrary side-effect safety beyond the one declared deduplication evidence mode;
- production storage, production telemetry backends, or crash consistency under power loss;
- performance, clean-machine reproducibility, the 16 GB resource claim, or production readiness;
- security isolation, accelerators, high-performance data planes, or business success.

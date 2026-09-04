# M5 Resilience Profile

Status: `M5 FROZEN · IMPLEMENTATION-BACKED`

This profile freezes the bounded failure, supervision, retry, restart, and evidence questions that
M5 must answer. It does not widen the M1-M4 claims.

## Reference topology

```text
one Java Control assembly
├── WorkerSupervisor
├── ResilientInvocationManager
├── ControlIntentRegistry
├── append-only local state journal
├── two bounded local worker processes
├── M4 ArtifactRegistry + DeploymentManager composition
└── independent Node.js Acceptance Harness after Java exits
```

The worker child is a deterministic liveness and fault-injection fixture. M2 and M3 remain the
evidence for the real Java → gRPC → Python → Runtime computation path and are rerun unchanged.

## Owned state

### Worker instance

Owner: `WorkerSupervisor`.

```text
REGISTERED → STARTING → ELIGIBLE
                    ↘ FAILED
ELIGIBLE → INELIGIBLE → STARTING
ELIGIBLE | INELIGIBLE → STOPPING → STOPPED
```

Only `ELIGIBLE` instances may receive a new attempt. Each start creates a new instance identity in
the current Control epoch. Recovery never copies an earlier `ELIGIBLE` state into a new epoch.

### Logical invocation

Owner: `ResilientInvocationManager`.

```text
ACCEPTED → ATTEMPTING → SUCCEEDED
              │       → FAILED
              │       → OUTCOME_UNKNOWN
              └────── → RETRY_PENDING → ATTEMPTING
```

`SUCCEEDED`, `FAILED`, and `OUTCOME_UNKNOWN` are terminal for the reference profile. Exactly one is
authoritative. Attempts have separate identities and never become logical invocation state.

### Desired deployment

Owner: `ControlIntentRegistry`.

A desired binding contains a slot, immutable artifact identity and digest, and intent revision. It
does not contain an `ACTIVE` state or Runtime handle. Only M4 `DeploymentManager` may establish the
actual active binding after reconciliation.

## Attempt observations

The bounded executor reports one of:

- `SUCCEEDED`: a deterministic result and result digest are available;
- `FAILED_BEFORE_EXECUTION`: execution is known not to have started;
- `FAILED_AFTER_EXECUTION`: execution started and failed conclusively;
- `UNKNOWN_REMOTE_OUTCOME`: execution may have occurred and no conclusive result is available.

These are capability observations. The manager validates coordinates, records them, and makes the
logical decision.

## Idempotency and budget

The profile accepts two declarations:

- `NONE` — no retry is allowed;
- `DEDUPLICATED_BY_LOGICAL_INVOCATION` — the executor declares a named deduplication scope and may
  receive another attempt for the same logical invocation.

The maximum attempt count is fixed when the logical invocation is accepted. It cannot be raised by
a worker or transport observation. A retry consumes a new attempt identity and must avoid an
ineligible worker when another eligible worker exists.

## Durable journal

Every authoritative event contains:

- contiguous sequence;
- previous event digest and current digest;
- event owner and event type;
- Control epoch and trace identity;
- logical invocation, attempt, and worker coordinates when applicable;
- sorted, typed string details needed for deterministic replay.

The journal is forced to disk before a state-changing capability call. Recovery validates the full
chain before applying any event. There is no best-effort partial replay.

## Required executable scenarios

1. `two_workers_eligible_route` — two real local worker processes pass probes and receive bounded
   work without one worker declaring its own eligibility;
2. `load_failure_preserves_active` — candidate load failure leaves the current M4 active deployment
   and artifact facts unchanged;
3. `warmup_crash_preserves_active` — a worker loss during candidate warmup makes the worker
   ineligible and cannot activate the candidate;
4. `unknown_outcome_retry_denied` — an interrupted dispatched attempt without idempotency evidence
   becomes `OUTCOME_UNKNOWN` and is never retried;
5. `deduplicated_retry_succeeds` — an uncertain first attempt with accepted deduplication evidence
   retries on another eligible instance and produces one logical success;
6. `drain_crash_requires_termination` — worker loss during drain produces an explicit M4 forced
   termination obligation before unload;
7. `unload_failure_preserves_active` — failure to unload the drained deployment cannot rewrite the
   replacement active binding or artifact facts;
8. `retry_budget_exhausted` — accepted idempotency evidence does not bypass the immutable attempt
   budget and an uncertain final attempt ends `OUTCOME_UNKNOWN`;
9. `restart_blocks_unsafe_retry` — restart recovers a dispatched attempt without an observation,
   resets prior worker eligibility, and commits `OUTCOME_UNKNOWN` without retry;
10. `restart_reconciles_and_retries` — restart verifies desired intent and attempt history,
    re-establishes a new M4 deployment through public actions, probes a new worker instance, and
    safely retries under accepted deduplication evidence;
11. `telemetry_failure_isolated` — telemetry export failure is retained and counted but cannot
    rewrite a successful invocation, worker eligibility, desired intent, or active binding;
12. `late_observation_cannot_rewrite_terminal` — a late earlier-attempt report is retained after
    terminal success and cannot create another terminal state.

## Required evidence mutations

13. `bundle_missing` — a missing required evidence file is `INCONCLUSIVE`;
14. `journal_truncated` — a truncated durable journal is `FAIL` and cannot be partially recovered;
15. `journal_reordered` — reordered journal events are `FAIL`;
16. `bundle_corrupt` — changed retained state or artifact bytes are `FAIL`.

## Acceptance assertions

- injected faults map to the declared reporter, owner, and logical outcome;
- ambiguous remote outcomes never become success by inference;
- every retry has accepted idempotency evidence, a new attempt identity, and remaining budget;
- worker eligibility is Supervisor-owned and fenced by Control epoch;
- plugin and telemetry failure do not rewrite unrelated facts;
- restart recovery is derived from a verified durable chain and reconciles through M4 public
  actions rather than private state mutation;
- required metrics, structured events, trace coordinates, and state snapshots remain available for
  offline explanation;
- M1-M4 frozen suites and evidence manifests remain unchanged.

## Explicitly unproven

- multi-host networking, partitions, consensus, leader election, or split-brain prevention;
- production worker supervision, orphan adoption, cgroups, containers, or resource isolation;
- general side-effect safety or idempotency modes beyond the bounded deduplication fixture;
- arbitrary plugin compatibility;
- power-loss crash consistency, production databases, or production telemetry systems;
- clean-machine reproducibility and the 16 GB resource claim;
- performance, production readiness, security isolation, accelerators, or business success.

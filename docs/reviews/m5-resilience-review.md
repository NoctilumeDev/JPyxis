# M5 Resilience Review

Status: `FROZEN FOR M6 ENTRY`

M5 is accepted only for the bounded single-host resilience claim described by
[ADR-0010](../adr/0010-m5-resilience-authority-and-recovery.md) and the
[M5 Resilience Profile](../spec/m5-resilience-profile.md). It does not widen the frozen M1-M4
claims and does not establish M6 reproducibility.

## Implemented boundary

- `WorkerSupervisor` alone owns local worker instance state and routing eligibility;
- every started worker receives a new instance identity in the current Control epoch;
- restart fences every previously live worker until a new start or attachment and probe succeeds;
- `ResilientInvocationManager` separates one logical invocation from its bounded attempts;
- attempt reservation and dispatch intent are durable before the reference capability runs;
- a reserved but undispatched attempt is distinguishable from an uncertain dispatched attempt;
- retry requires `DEDUPLICATED_BY_LOGICAL_INVOCATION`, a stable logical identity, a new attempt
  identity, remaining budget, and a currently eligible worker;
- `OUTCOME_UNKNOWN` is a real terminal state and cannot be promoted to success by inference;
- late observations are retained but cannot rewrite an existing terminal decision;
- `ControlIntentRegistry` owns desired deployment intent while M4 continues to own actual artifact,
  deployment, and active-binding state;
- restart reconciliation uses M4 public registration, validation, load, warm, and activation actions;
- the local journal is append-only, forced to disk, contiguous, and hash chained;
- telemetry export follows the durable event and cannot rewrite semantic state;
- the independent verifier replays retained facts after every reference process exits.

The M5 semantic packages do not import M4 lifecycle implementation, process fixtures, transport
products, Spring, Python, or a concrete Runtime. M4 composition and real local process supervision
remain in separate assembly and reference packages. Frozen M1-M4 modules do not depend forward on
M5.

## Acceptance matrix

| Scenario | Accepted observation |
| --- | --- |
| `two_workers_eligible_route` | two real local processes become eligible and receive round-robin work |
| `load_failure_preserves_active` | a failed candidate load leaves v1 active |
| `warmup_crash_preserves_active` | only the crashed worker and candidate become ineligible/failed |
| `unknown_outcome_retry_denied` | an unsafe uncertain attempt terminates `OUTCOME_UNKNOWN` once |
| `deduplicated_retry_succeeds` | accepted evidence permits one new attempt on another worker |
| `drain_crash_requires_termination` | forced termination is recorded before unload |
| `unload_failure_preserves_active` | a failed old-version unload leaves replacement v2 active |
| `retry_budget_exhausted` | accepted idempotency evidence cannot exceed the immutable budget |
| `restart_blocks_unsafe_retry` | restart fences the worker and does not retry unsafe work |
| `restart_reconciles_and_retries` | desired intent is rebuilt through M4 and safe retry succeeds |
| `telemetry_failure_isolated` | exporter failure leaves invocation, worker, intent, and deployment facts intact |
| `late_observation_cannot_rewrite_terminal` | a late report cannot replace terminal success |
| `bundle_missing` | a missing required evidence file is `INCONCLUSIVE` |
| `journal_truncated` | a truncated or boundary-incomplete journal is `FAIL` |
| `journal_reordered` | a reordered journal is `FAIL` |
| `bundle_corrupt` | changed retained bytes are `FAIL` |

## Verification

The final local candidate ran, in order:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
node scripts/verify-m2.mjs
node scripts/verify-m3.mjs
node scripts/verify-m4.mjs
node scripts/verify-m5.mjs
node scripts/verify-m3-evidence.mjs build/m3
node scripts/verify-m4-evidence.mjs build/m4
node scripts/verify-m5-evidence.mjs build/m5
```

Observed results:

```text
M1: 38 cross-binding cases PASS
M2: 24 invocation and evidence cases produce their declared verdicts
M3: 10 Runtime and evidence cases produce their declared verdicts
M4: 11 lifecycle and evidence cases produce their declared verdicts
M5: 12 executable resilience cases PASS
M5: missing evidence INCONCLUSIVE
M5: truncated journal, reordered journal, and corrupt bytes FAIL
M3, M4, and M5 retained evidence: PASS
Java M5 tests: 15 tests, 0 failures, 0 errors, 0 skipped
Surviving M5 local worker processes after the gate: 0
```

The PR and merged-main M5 artifacts were downloaded separately after all reference processes had
exited. Both passed the offline verifier and their `conformance-summary.json` files had the same
SHA-256:

```text
ee3e82cba98b44f0344a3c4316aab367ccc7183b0e0084fb9094f9c290fdf8e9
```

## Authority and dependency review

- only Supervisor-owned events change worker state or eligibility;
- worker readiness and health are observations, not self-declared authority;
- only Invocation-Manager-owned events change logical invocation state or authorize retry;
- an attempt cannot consume an earlier retry decision intended for another attempt;
- every retained attempt has either a durable dispatch intent or an explicit pre-dispatch recovery;
- only `ControlIntentRegistry` advances desired-binding revision;
- desired intent contains no M4 `ACTIVE` state or Runtime handle;
- recovery verifies artifact identity and digest before calling M4 public actions;
- telemetry contains only ordered identities of durable events and remains non-authoritative;
- the M5 Core owns no filesystem, JSON encoding, process launcher, lifecycle implementation, carrier,
  framework, language adapter, or Runtime product;
- M1-M4 tags, review records, evidence manifests, and regression suites remain unchanged.

## Review corrections

- evidence comparison was made JSON-key-order independent without weakening semantic equality;
- unreadable retained JSON is classified as corruption (`FAIL`), while only absent required evidence
  is `INCONCLUSIVE`;
- retry authorization is consumed per attempt instead of acting as an unlimited historical flag;
- every reserved attempt must have a durable dispatch intent or an explicit pre-dispatch recovery;
- restart now distinguishes a crash before dispatch from an uncertain result after dispatch;
- semantic state is published in memory only after its decision event is durably appended;
- recovery rejects a complete JSON record that lacks the final durable record boundary;
- failed worker readiness closes its process output reader, and the full gate leaves no child process;
- telemetry readback must be an ordered subset of durable event identities even when export fails;
- PR and main artifacts were both downloaded and checked rather than treating green CI as the
  retained-evidence verdict.

## Closure gate

- [x] Worker eligibility has one owner and is fenced by Control epoch.
- [x] Logical invocation state and attempt lineage remain separate.
- [x] Ambiguous remote outcomes never become success by inference.
- [x] Retry requires explicit idempotency evidence, a new attempt identity, and remaining budget.
- [x] Pre-dispatch restart and post-dispatch uncertainty remain distinguishable.
- [x] Late reports cannot produce a second terminal decision.
- [x] Desired intent cannot directly write M4 active deployment state.
- [x] Recovery re-establishes actual deployment through M4 public actions.
- [x] Telemetry failure cannot rewrite worker, invocation, intent, or lifecycle facts.
- [x] Durable state is replayed only after sequence, boundary, and hash-chain validation.
- [x] M1-M4 frozen regression suites remain green.
- [x] Completed M5 bundles remain independently verifiable offline.
- [x] Missing, corrupt, truncated, or reordered evidence cannot produce `PASS`.
- [x] Reviewed-head and merged-main public checks and artifact readbacks agree.
- [x] The protected annotated tag is created only from the accepted closure commit.

## Public evidence coordinates

- implementation PR: [#14](https://github.com/NoctilumeDev/JPyxis/pull/14);
- reviewed head: `49f4baf9025d8a0d3290ddcfee2221ed0ae38d2b`;
- reviewed-head CI: [run 33882755890](https://github.com/NoctilumeDev/JPyxis/actions/runs/33882755890),
  artifact `9940660473`;
- GitHub reviewed merge revision inside that artifact:
  `61541915db47748d48226aa048ff0472d6fda05a`;
- implementation merge: `5097d5dbfbe431bdc1f9480e70fca58e0274912c`;
- merged-main CI: [run 33883312634](https://github.com/NoctilumeDev/JPyxis/actions/runs/33883312634),
  artifact `9940898688`;
- both public conformance-summary SHA-256 values:
  `ee3e82cba98b44f0344a3c4316aab367ccc7183b0e0084fb9094f9c290fdf8e9`;
- retained evidence index: [`evidence/m5/freeze-manifest.json`](../../evidence/m5/freeze-manifest.json).

The annotated tag `m5-resilience-v1` identifies the closure commit after this record itself passes
the required public gate and lands on `main`. Tag protection prevents update or deletion through the
normal repository path.

## Explicitly unproven

- power-loss crash consistency or a production durable store;
- operating-system or hardware security isolation;
- arbitrary third-party plugin compatibility;
- multi-host scheduling, network partitions, consensus, or leader election;
- accelerators or zero-copy/high-throughput data planes;
- production telemetry backends;
- clean-machine reproducibility and the 16 GB resource claim;
- performance or production readiness;
- business transaction success.

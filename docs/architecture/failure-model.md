# Failure Model

Status: `ACCEPTED · M0 FROZEN`

The failure model exists to prevent every boundary problem from collapsing into `INTERNAL_ERROR`.

## Failure classes

| Class | Typical cause | Primary owner | Examples |
| --- | --- | --- | --- |
| Application Fault | Host policy or business rule rejects the request | Host application | authorization denied, transaction precondition failed |
| Contract Fault | Declared meaning is absent, incompatible, or violated | Contract Core | version mismatch, invalid shape, unsupported dtype |
| Definition Fault | Definition cannot be validated or prepared | Definition capability | syntax/import error, invalid preprocessing declaration |
| Plugin Fault | A capability cannot load, negotiate, or honor its SPI | Plugin Manager | incompatible SPI version, undeclared capability |
| Transport Fault | A carrier cannot deliver or decode a bounded message | Transport capability | connection loss, malformed frame, unavailable endpoint |
| Runtime Fault | Execution environment fails before producing a valid result | Runtime capability | worker crash, runtime exception, resource exhaustion |
| Invocation Fault | One request cannot complete under its contract | Invocation Manager | deadline exceeded, cancellation, rejected output |
| Deployment Fault | A deployment attempt cannot reach or preserve a valid state | Deployment Manager | load failure, warmup failure, activation conflict |
| Control Fault | The coordinator cannot safely decide or persist a transition | Control Plane | invariant violation, durable state unavailable |

A single incident may produce several observations. The final error exposed at each boundary must preserve causal links rather than duplicate one failure as unrelated errors.

## Error envelope requirements

A cross-boundary failure should carry, where applicable:

- stable failure category and code;
- human-readable summary without secret leakage;
- retryability as a policy hint, not an unconditional command;
- contract, artifact, deployment, plugin instance, invocation, and trace identities;
- originating layer and observing layer;
- deadline or cancellation context;
- whether execution may still be running;
- whether any result was produced but rejected;
- a causal reference to lower-level evidence.

Stack traces and vendor messages are diagnostic attachments. They are not the stable public contract.

## Recovery ownership

| Failure | Reporter | Recovery decision | Non-negotiable invariant |
| --- | --- | --- | --- |
| Bad input | Contract validator | Invocation Manager rejects | Runtime is not invoked. |
| Invalid output | Contract validator | Invocation Manager fails invocation | Invalid value is not recorded as success. |
| Definition preparation error | Definition plugin | Deployment Manager | Existing active version remains unchanged. |
| Warmup worker crash | Runtime supervisor | Deployment Manager | Candidate version does not self-activate. |
| Transport disconnect | Transport plugin | Invocation Manager | Retry cannot create ambiguous success without idempotency evidence. |
| Deadline exceeded | Local clock/transport/runtime signal | Invocation Manager | Timeout does not claim remote rollback. |
| Telemetry exporter failure | Telemetry plugin | Telemetry owner | Compute or business result is not rewritten. |
| Artifact-store outage | ArtifactStore plugin | Registry coordinator | Existing content identity cannot resolve to different bytes. |
| Evidence recorder failure | Evidence capability | Acceptance Harness | Invocation state remains intact; the acceptance verdict cannot become `PASS`. |
| Evidence missing, corrupt, or conflicting | Offline verifier | Acceptance Harness | The run remains `INCONCLUSIVE` or fails the declared evidence check. |

## Retry rules

Retries are not a transport default. A retry decision requires:

- a contract-declared idempotency or deduplication model;
- knowledge of whether the previous attempt may have executed;
- a stable invocation identity or explicit attempt identity;
- a bounded policy owned by the relevant coordinator;
- evidence linking all attempts to one logical request.

If those conditions are absent, fail explicitly rather than manufacture an ambiguous success.

## Cancellation and deadline

Cancellation and timeout are distributed observations, even on one physical machine when processes are separated. The baseline must distinguish:

- caller stopped waiting;
- cancellation request was delivered;
- runtime acknowledged cancellation;
- execution actually stopped;
- a late result arrived and was discarded;
- an external side effect, if ever permitted by contract, may remain.

M2 must define an authoritative terminal-state race rule before claiming cancellation support.

## Security boundary

Definition and runtime capabilities are not automatically trusted because they run locally. The single-node baseline must not hand them host database credentials or implicit filesystem/network authority. Concrete sandboxing is a later implementation question and must not be claimed from interface separation alone.

## Failure-injection matrix required before M5

The M5 plan must cover at least:

- invalid input and invalid output;
- incompatible contract and plugin versions;
- worker failure during load, warmup, active execution, drain, and unload;
- timeout before dispatch, during execution, and after a late result;
- cancellation races;
- transport interruption with unknown remote outcome;
- artifact-store and telemetry-exporter unavailability;
- process restart with recovery of authoritative state;
- failure of a candidate version while an older version remains active.
- missing, truncated, reordered, corrupt, and conflicting evidence;
- evidence-recorder and offline-verifier failure without rewriting the invocation result.

The matrix will define exact expected outcomes before fault-injection implementation begins.

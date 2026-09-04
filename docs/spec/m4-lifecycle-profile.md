# M4 Lifecycle Profile

Status: `M4 CONSTRUCTION PROFILE · REVIEW PENDING`

## Frozen inputs

M4 treats `m1-contract-v1`, `m2-invocation-v1`, and `m3-runtime-v1` as immutable evidence
coordinates. The complete M1-M3 verification chain must remain green.

## Artifact profile

The reference Registry stores bounded definition bytes in memory and computes SHA-256 itself. One
artifact identity may be registered repeatedly only when the bytes and digest are identical. The
Registry exposes defensive copies and separates registration, validation, rejection, and
deprecation facts.

Only `VALIDATED` artifacts may enter deployment loading. M4 does not claim durable ArtifactStore
recovery.

## Deployment profile

One deployment slot has at most one active binding. The accepted transition graph is:

```text
REQUESTED → LOADING → WARMING → STANDBY → ACTIVE
                                            ↓
                                         DRAINING → UNLOADING → RETIRED

LOADING | WARMING | UNLOADING → FAILED
```

Each authoritative transition records sequence, owner, actor, cause, trace coordinate, deployment,
artifact coordinate, and previous/new state. Capability observations contain no authoritative state
transition.

## Cutover and drain rules

- every activation precondition is checked before the active binding changes;
- failed load, warmup, or activation preserves the prior active binding;
- activating a candidate atomically moves the previous active deployment to `DRAINING`;
- existing pins remain bound to the deployment and artifact they received;
- new pins resolve only through the current `ACTIVE` binding;
- unload requires zero outstanding pins or an explicit forced-termination requirement for each
  outstanding pin;
- releasing a forced pin reports a lifecycle obligation, not an invocation terminal state.

## Rollback rule

Rollback creates a new deployment from a previously validated artifact coordinate. It never mutates
artifact bytes, changes the digest, or reuses a retired Runtime handle.

## Required executable scenarios

1. a validated v1 artifact loads, warms, and becomes active;
2. an unvalidated artifact cannot create a deployment fact;
3. re-registering one identity with different bytes is rejected without changing the first bytes;
4. v2 warmup failure leaves active v1 available and v2 never becomes active;
5. an invalid activation precondition leaves active v1 unchanged;
6. cutover pins old in-flight work to v1 and new work to v2;
7. draining rejects new work while accepted work can complete before unload;
8. a drain timeout records a forced-termination requirement before unload;
9. rollback returns to v1 by immutable identity and digest through a new deployment;
10. a missing required evidence file cannot produce `PASS`;
11. corrupt artifact bytes cannot produce `PASS`.

## Reference topology

```text
one Java lifecycle process
→ ArtifactRegistry semantics
→ DeploymentManager semantics
→ deterministic lifecycle capability fixture
→ retained evidence bundle
→ independent Node.js verifier after Java exits
```

The deterministic capability fixture proves ownership, transition, cutover, and concurrency rules.
It does not replace the separately rerun M2/M3 Java-to-Python invocation and Runtime evidence.

## Explicitly unproven

- durable state and restart recovery;
- real worker process supervision or forced termination;
- multi-worker placement and routing;
- retry and idempotency policy;
- arbitrary plugin compatibility;
- clean-machine reproducibility;
- performance, production readiness, security isolation, accelerators, or multi-host behavior;
- business success.

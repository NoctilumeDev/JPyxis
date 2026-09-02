# State Machines

Status: `ACCEPTED · M0 FROZEN`

This document freezes distinct state ownership and critical invariants. Exact enum names and persistence fields remain M1 implementation decisions.

## Why states are separated

Artifact validity, deployment readiness, plugin availability, and one invocation's outcome are different facts with different owners and lifetimes. Combining them into one status would make a worker crash appear to invalidate immutable artifact content or make a successful runtime call imply that a business transaction succeeded.

## Artifact lifecycle

Owner: Artifact Registry.

```text
REGISTERED
    ↓
VALIDATING
   ↙ ↘
VALIDATED  REJECTED
    ↓
DEPRECATED
```

Frozen invariants:

- an artifact identity resolves to immutable content and digest;
- validation is against a named contract and compatibility policy;
- rejection does not rewrite content or replace evidence;
- deprecation prevents new activation according to policy but does not erase history;
- a worker crash does not change artifact validity.

## Plugin instance lifecycle

Owner: Plugin Manager within the Control Plane.

```text
DISCOVERED
    ↓
RESOLVING
   ↙    ↘
READY  INCOMPATIBLE
  ↓
STOPPING
  ↓
STOPPED

READY or RESOLVING → FAILED
```

Frozen invariants:

- a plugin declares identity, SPI compatibility, capabilities, and constraints before selection;
- an incompatible plugin is never used merely because its classes can be loaded;
- Core state transitions do not depend on a plugin's concrete name;
- plugin readiness is separate from a model or deployment being ready;
- unload cannot silently abandon owned handles or in-flight obligations.

The baseline may implement only statically configured plugins. Dynamic installation is not implied by the word plugin.

## Deployment lifecycle

Owner: Deployment Manager.

```text
REQUESTED
    ↓
LOADING
    ↓
WARMING
   ↙   ↘
STANDBY  FAILED
    ↓
ACTIVE
    ↓
DRAINING
    ↓
UNLOADING
    ↓
RETIRED
```

Frozen invariants:

- only a validated artifact can enter loading;
- warmup success is an observation, not an activation decision;
- at most one artifact is active for one baseline deployment slot;
- an invocation is pinned to a concrete artifact and deployment identity;
- failed activation leaves the previous active deployment unchanged;
- draining accepts no new invocation but preserves obligations for accepted work;
- unload happens only after drain completion or an explicitly recorded forced termination;
- every transition records actor, cause, previous state, new state, and trace coordinate.

## Invocation lifecycle

Owner: Invocation Manager.

```text
ACCEPTED
    → DISPATCHED
         → RUNNING
              → SUCCEEDED

Any non-terminal phase may instead end as:
FAILED | TIMED_OUT | CANCELLED
```

The diagram shows terminal categories, not every race. Timeout and cancellation require an explicit winner rule during M2 design.

Frozen invariants:

- acceptance validates authorization context, contract identity, and bounded request metadata;
- dispatch pins the invocation to one artifact version and one eligible runtime target;
- a successful runtime response becomes `SUCCEEDED` only after output contract validation;
- exactly one terminal state is authoritative;
- cancellation is a request and observation until the Invocation Manager records the terminal result;
- timeout does not assert that remote execution stopped or that side effects were rolled back;
- business transaction state is outside this machine.

## Cross-state-machine invariants

The state machines may exchange typed events, but one cannot directly write another's state.

Example: a worker crash while version `v2` is warming.

Required outcome:

- `v2` does not become active;
- the current active version remains active;
- existing invocations retain their pinned version;
- the artifact remains immutable and does not become rejected solely because a worker crashed;
- the deployment attempt records a runtime-related failure;
- retry policy, if any, is applied by the owning coordinator.

Retry count, backoff, and target selection are policies to be tested later. The invariants above do not depend on those choices.

## M0 review questions

- Is one active version per deployment slot sufficient for the single-node baseline?
- Does `STANDBY` mean fully warmed and eligible, or merely loaded but inactive?
- Which cancellation races must be decided before M2?
- Which transitions require durable storage before M6?
- Can a plugin be restarted without changing its logical identity, or must every instance receive a new identity?

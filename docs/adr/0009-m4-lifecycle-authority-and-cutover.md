# ADR-0009: M4 Lifecycle Authority and Cutover

Status: `ACCEPTED FOR M4 CONSTRUCTION`

## Context

M3 proves that one invocation can resolve and pin a product-neutral Runtime capability. It does not
decide which immutable definition version may receive new work, whether a candidate has completed
warmup, or when an old deployment may release its Runtime handle.

Those are lifecycle facts. Folding them into the M3 `InvocationManager`, a Runtime provider, or a
single shared `status` would merge independent authorities and make a candidate failure capable of
rewriting an accepted invocation or the current active version.

## Decision

M4 adds a separate lifecycle semantic module with two authorities:

- `ArtifactRegistry` owns artifact identity, bytes, digest, and validation state;
- `DeploymentManager` owns deployment transitions, the active binding for one slot, drain
  obligations, and Runtime-handle release decisions.

Runtime lifecycle capabilities report the outcome of `load`, `warm`, and `unload`. They do not write
artifact state, deployment state, active bindings, invocation outcomes, or acceptance verdicts.

The reference cutover is:

```text
validated immutable artifact
→ REQUESTED
→ LOADING
→ WARMING
→ STANDBY
→ Deployment Manager atomic decision
→ ACTIVE
```

If another deployment is active in the same slot, one lock-protected decision changes the old
deployment to `DRAINING`, the candidate to `ACTIVE`, and the slot binding to the candidate. All
preconditions are checked before the decision mutates any of those facts.

## Invocation pin boundary

M4 does not own an invocation terminal state. It issues an immutable lifecycle pin containing:

```text
slot
deployment identity
artifact identity and digest
Runtime handle coordinate
invocation identity
```

The pin records which deployment owes service to already accepted work. Releasing a pin tells the
Deployment Manager that the drain obligation ended. Forced drain records that the Invocation
Manager must choose a defined terminal outcome; it does not let lifecycle code manufacture that
outcome.

New pins may be issued only from the current `ACTIVE` binding. A deployment in `DRAINING` therefore
keeps existing obligations but receives no new work.

## Rollback

Rollback is a new deployment attempt that resolves a previously validated artifact by identity and
expected digest. It performs load and warmup before the atomic cutover. It never rewrites the prior
artifact or resurrects a retired Runtime handle.

A failed rollback candidate leaves the current active deployment unchanged.

## Slow capability calls

`load`, `warm`, and `unload` execute outside the manager's state lock. Only precondition checks,
state decisions, active-binding changes, and pin accounting occur under that lock. A slow candidate
therefore cannot block admissions to an unrelated current active version.

## Evidence boundary

The M4 Acceptance Harness independently checks retained artifact bytes, digests, ordered owner-tagged
transitions, active-binding uniqueness, pin ordering, cutover results, and rollback identity. A
capability success report, final snapshot, or Java process exit code cannot promote itself to an
acceptance `PASS`.

## Explicit exclusions

M4 does not claim:

- durable recovery after Control process restart;
- multi-worker routing or supervision;
- retry safety or uncertain remote-outcome recovery;
- arbitrary ArtifactStore or lifecycle-plugin compatibility;
- real process termination from a forced-drain record;
- performance, production readiness, security isolation, or multi-host behavior.

Those boundaries remain for M5 and M6.

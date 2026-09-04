# Contributing

JPyxis has frozen M0 through M3. The next construction boundary is M4 lifecycle. Contributions must
preserve the frozen layers; resilience and Evolution implementation remain premature until their
preceding gates are satisfied.

## Evidence labels

Every proposal must identify its state:

- `IDEA`: an untested possibility;
- `PLANNED`: accepted for investigation but not yet designed;
- `DESIGNED`: specified with invariants and acceptance conditions;
- `PROTOTYPE`: executable but not yet validated;
- `VALIDATED`: supported by reproducible evidence within a stated boundary;
- `REJECTED`: investigated and deliberately not adopted;
- `FROZEN`: a validated stage preserved as a named baseline.

Do not describe a document, diagram, interface sketch, or roadmap item as implemented.

## M0 change requirements

An architecture change should state:

1. which problem it solves;
2. which owner and fact it affects;
3. which dependency edges it adds or removes;
4. which invariant could be broken;
5. which prior art already covers part of the proposal;
6. what future experiment could validate or reject it;
7. what is explicitly unchanged.

Prefer primary sources. A project page can establish what that project claims or exposes; it cannot by itself prove that JPyxis is novel, correct, or faster.

## Boundary rules

- Do not introduce `Any`, generic `Object`, arbitrary dictionaries, or raw bytes as undocumented semantic escape hatches.
- Do not let a worker or runtime self-promote a deployment to `ACTIVE`.
- Do not let definition code own application authorization or business persistence.
- Do not couple internal domain objects to generated wire objects.
- Do not implement an Evolution item merely because an attachment point exists.
- Do not alter frozen M1 semantics through an M2 transport shortcut.
- Do not add M5 resilience or later-stage implementation before the M4 exit criteria are met.
- Do not branch on Runtime implementation names inside Host API, Control, or Core.
- Do not let provider-native values cross the Runtime Provider boundary.
- Do not treat provider registration alone as proof of runtime replaceability.

## M1 verification

M1 changes must keep the language-neutral contract and corpus authoritative while the Java and Python
bindings remain independent implementations. Run:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
git diff --check
```

A new corpus case must name its expected stable result. A binding-specific exception, generated wire
type, runtime object, or generic value cannot become the shared answer merely to make both reports
agree.

## M3 verification

M3 changes must keep M1 and M2 green and then pass the independent runtime gate:

```text
node scripts/verify-repository.mjs
node scripts/verify-m1.mjs
node scripts/verify-m2.mjs
node scripts/verify-m3.mjs
node scripts/verify-m3-evidence.mjs build/m3
git diff --check
```

The two M3 fixtures must use the same host contract and runtime-neutral definition. Capability
mismatch must fail before dispatch when knowable, and a pinned-binding mismatch must fail before
runtime execution. Product-specific types and names belong only to the outer composition root and
provider implementation.

## Review posture

Design review is sceptical by default. Open questions are acceptable; hidden assumptions are not.

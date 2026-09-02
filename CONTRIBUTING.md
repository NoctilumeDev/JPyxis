# Contributing

JPyxis has frozen its M0 blueprint and is entering M1 contract design. Contributions must remain inside the current milestone; invocation, runtime, lifecycle, and Evolution implementation is premature until its preceding gate is satisfied.

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
- Do not add M2 invocation or later-stage implementation before the M1 exit criteria are met.

## Review posture

Design review is sceptical by default. Open questions are acceptable; hidden assumptions are not.

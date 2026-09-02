# ADR-0002: Definition Frontends Declare but Do Not Govern

Status: `ACCEPTED · M0`

## Context

Bidirectional language bridges make it technically easy for Python or another frontend to call host services. Technical reachability would allow definition code to acquire business authority, mutate lifecycle state, or depend on application internals.

## Decision

Definition plugins may:

- declare algorithms and preprocessing/postprocessing semantics;
- package immutable artifacts;
- validate or prepare a definition;
- return typed results and typed observations.

They may not:

- grant business authorization;
- access production persistence or credentials by default;
- command host controllers;
- advance Core-owned lifecycle state;
- create undeclared side channels to other plugins.

## Consequences

- callbacks are admitted only as contract-declared result or event channels;
- host capabilities are deny-by-default rather than inherited from process location;
- an in-process implementation must preserve the same authority boundary as a separate process;
- interface separation alone does not prove sandboxing.

## Validation

M2 and M5 must show that definition failures and observations remain bounded and cannot mutate application or deployment facts directly.

# ADR-0001: Role-based Control Authority

Status: `ACCEPTED · M0`

## Context

The first profile uses Java for control and Python for definition. Treating language names as architectural owners would bind the framework to its first adapters and contradict the heterogeneous-compute goal.

## Decision

Authority belongs to roles:

- Control Plane owns control decisions;
- Definition Frontend owns declarative compute meaning;
- Runtime owns execution;
- Contract Core owns cross-boundary semantics;
- Host Application owns business authorization and truth.

Java, Python, and selected runtimes are reference implementations of roles.

## Consequences

- documentation can describe the first Java/Python profile without defining JPyxis as a Python bridge;
- future language adapters do not require a constitutional change;
- Core may be implemented in Java but cannot depend on Spring or application-domain types;
- role ownership must remain visible in every state and failure decision.

## Validation

M3 must demonstrate at least runtime replacement. A later second definition frontend is an Evolution entry condition, not a current milestone.

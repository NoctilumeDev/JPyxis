# Security Policy

## Current status

JPyxis is in a blueprint-only M0 phase and has no runnable framework release. Security claims are therefore design requirements, not verified properties.

## Threat boundary under design

The first-stage architecture assumes that definition artifacts and runtime workers may fail, hang, report malformed data, or attempt to exceed declared capabilities. The host application remains authoritative for business authorization and must not delegate production credentials or database authority to definition code.

The M0 security boundary requires:

- explicit artifact identity and digest verification;
- capability-scoped definition and runtime adapters;
- bounded request size, deadline, and resource declarations;
- separation of control-plane state from worker self-report;
- traceable activation, invocation, failure, and recovery decisions;
- no implicit deserialization of arbitrary executable objects;
- no claim of sandboxing until isolation has been implemented and tested.

## Reporting

Until a public implementation exists, use GitHub private vulnerability reporting if enabled, or contact the repository owner through the profile's documented channel. Do not publish credentials, private infrastructure details, or exploit material in a public issue.

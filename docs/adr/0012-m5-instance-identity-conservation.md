# ADR-0012: M5 Instance Identity Conservation

Status: `REVIEWED CONTRACT v2 · PUBLICATION GATE REQUIRED · IMPLEMENTATION NOT QUALIFIED`

## Context

Two independently retained model probes expose one bounded M5 obligation. The
[first audit](../reviews/productization-reference-path-audit-review.md) showed incomplete admission
of submitted attempt plans and returned worker handles. The
[second audit](../reviews/m5-instance-failure-counterexample.md) showed that an unmodified admitted
plan can still assign an old instance's unknown outcome to a healthy replacement through a
worker-ID-only owner call. Both facts are now published; no runtime repair is part of their evidence.

The initial contract in [PR #19](https://github.com/NoctilumeDev/JPyxis/pull/19) was closed unmerged
as superseded. Its head and successful checks remain historical candidate evidence. This v2 starts
from independently read-back main `54846ec612ff00417d73052e9f4fb0f0edc602a7`, after the second audit
publication. It does not silently repair or freeze the original candidate.

## Decision

Adopt the [v2 contract](../spec/m5-coordinate-validation-contract-v2.md). Reopen only the affected
M5 admission, instance-scoped owner effect, and associated recovery/late-report expectations within
the existing [ADR-0010](0010-m5-resilience-authority-and-recovery.md) owners. An outer wrapper is
insufficient because the public owners remain callable and replacement can occur after a caller's
snapshot check.

Supervisor owns requested/qualified worker identity and every eligibility change. Manager owns the
retained request, reserved attempts, policy/budget, and logical outcome. A plan carries copies that
must agree with retained authority. Any attempt-scoped failure effect carries the originating
worker/instance/epoch to Supervisor, which compares it with its current binding atomically before
changing that binding. Superseded observations remain diagnostic without poisoning a replacement;
the old logical outcome is still decided by Manager.

Intentional logical-worker-wide actions remain a separate public meaning. An old attempt cannot
obtain that wider scope. PID and liveness state remain observations, rather than historical identity
equality or replacement authority.

## Qualification boundary

This is a contract-only change. The [v2 review](../reviews/m5-coordinate-validation-review-v2.md)
binds predecessor publication and separates contract acceptance from implementation. Required public
jobs, protected merge, exact-main source/evidence readback, and a protected annotated contract tag
must close before a separate guard implementation enters. Its directed matrix and predecessor
qualification then close independently before productization audit A restarts.

The original M5 profile, review, manifest and tag retain their historical fixture qualification.
They do not prove the newly exposed guards. No M0-M4 authority, retry mode, lifecycle state,
Environment, Runtime identity, resource grant, adoption/cleanup guarantee, scheduler, façade or
external Evidence/Verdict adapter is added.

# ADR-0011: M6 Clean Reproduction Boundary

Status: `ACCEPTED FOR M6 CONSTRUCTION`

## Context

M1-M5 establish bounded contract, invocation, runtime-replacement, lifecycle, and resilience claims.
Their local and public gates do not by themselves prove that the baseline belongs to the repository
rather than to one prepared development machine. Reusing an author's Maven repository, Python
environment, generated carrier, build output, process state, or remembered recovery sequence would
leave that question unanswered.

M6 is therefore an evidence and assembly milestone. It must reproduce the frozen stages from tracked
source at one immutable revision, exercise the complete documented baseline journey, measure the
declared single-node resource boundary, stop every runtime process, and let an offline verifier reach
an independent verdict.

## Decision

M6 introduces a **Reference Reproduction Lab** outside JPyxis Core. It may depend on the public
interfaces and reference adapters delivered by M1-M5. No frozen predecessor may import the Lab or
special-case M6.

```text
tracked immutable source
        |
        v
Reproduction Harness -------> environment and resource observer
        |
        v
Reference Lab assembly ------> M1-M5 public entry points and adapters
        |
        v
retained M6 bundle ----------> offline M6 verifier
        |
        v
AcceptanceVerdict            != invocation success
```

The Lab is composition and evidence infrastructure, not a new semantic authority. Contract,
invocation, artifact, deployment, worker, desired-intent, and acceptance facts retain the owners
frozen in earlier milestones.

## One parent journey, bounded child processes

One M6 reproduction run owns a single parent run identity and executes this ordered journey:

```text
source check
-> bootstrap
-> clean build
-> contract conformance
-> launch
-> register
-> load
-> warm
-> activate
-> invoke
-> observe
-> inject failure
-> recover
-> roll back
-> verify final state
-> stop all runtime processes
-> verify retained evidence offline
```

Specialized child processes may still execute the frozen M1-M5 scenarios. The parent bundle must
link every phase to its input revision, command, result, retained evidence digest, and resource
observation. A list of unrelated successful commands without those links is not a complete M6 run.

The journey does not claim that every earlier fixture has become one production daemon. It proves
that the staged baseline can be established and checked as one documented project-owned procedure.

## Clean-environment proof

The authoritative clean-environment evidence comes from a dedicated job on a standard public
GitHub-hosted `ubuntu-24.04` runner:

- the job starts from `actions/checkout` at the reviewed immutable revision;
- Maven and Python dependency caches are disabled for the reproduction job;
- generated files, the Maven local repository, Python virtual environment, and all evidence output
  live under an isolated M6 workspace created by the run;
- no Docker daemon, database, message queue, GPU, or pre-existing project service is required;
- the job records the runner image, OS, CPU, memory, toolchain, dependency, source, and workflow
  coordinates rather than inferring them from the workflow label.

GitHub documents that a GitHub-hosted job runs in a fresh runner instance and that a standard public
`ubuntu-24.04` runner currently provides 4 vCPUs and 16 GB RAM. Those service properties support the
public proof boundary but do not replace the run's own observations:

- <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#choosing-github-hosted-runners>
- <https://docs.github.com/en/actions/reference/runners/github-hosted-runners#supported-runners-and-hardware-resources>

A local Windows or Linux run is a candidate diagnostic. It cannot self-declare clean-environment
acceptance, even when it passes the same script.

## Resource observation rules

M6 records observations, not benchmark promises. All byte counts and durations name their method.

- build peak: maximum sampled resident memory of the build process tree;
- idle process memory: sampled resident memory after the reference processes report ready and before
  the first invocation;
- one-worker peak: maximum sampled resident memory for the one-worker invocation phase;
- bounded multi-worker peak: maximum sampled resident memory for the two-worker phase;
- failure peak: maximum sampled resident memory during the named resilience phase;
- startup baseline: process launch to the retained ready observation;
- invocation baseline: authoritative invocation acceptance to terminal decision for the deterministic
  reference workload;
- host pressure: physical memory total, minimum available memory, and swap totals/deltas when the OS
  exposes them.

Sampling gaps and OS accounting limitations remain visible in the evidence. The observations cannot
be described as throughput, latency SLA, capacity, or production performance.

## 16 GB decision rule

The 16 GB single-machine target is accepted only if the public clean run first records physical
memory in the predeclared 14–18 GiB machine class and then:

1. executes the complete M6 journey on that runner without an OOM, forced job retry,
   container, or external project service;
2. records at most 12 GiB peak resident memory for the relevant process tree;
3. records at least 2 GiB minimum host-available memory;
4. records no positive swap-use growth attributable to the journey; and
5. independently verifies every required evidence file after all runtime processes exit.

If any value is unavailable, the verdict is `INCONCLUSIVE`. If a limit is crossed, the target is
narrowed or rejected; the verifier must not round it into acceptance.

## Evidence authority and failure behavior

The Reproduction Harness records observations. The offline M6 verifier owns the bundle verdict. The
milestone review alone may promote the baseline to `FROZEN`.

Missing phases, a dirty or mutable source coordinate, reused project caches, an incomplete process
shutdown record, a digest mismatch, an unverified predecessor bundle, or absent resource facts cannot
produce `PASS`. Invocation success and zero exit status remain inputs, never acceptance authority.

## Explicit exclusions

M6 does not establish:

- production readiness, performance guarantees, capacity limits, or comparative superiority;
- multi-host behavior, partitions, consensus, leader election, or distributed scheduling;
- GPU, NPU, accelerator, zero-copy, shared-memory, Arrow, DLPack, or CUDA IPC behavior;
- production persistence, power-loss guarantees, security isolation, or sandbox escape resistance;
- arbitrary third-party plugins, dynamic installation, or ecosystem maturity;
- business transaction success.

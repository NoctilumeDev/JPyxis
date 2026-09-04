# M6 Reproducibility Profile

Status: `M6 FROZEN · SINGLE-NODE BASELINE COMPLETE`

This profile fixes the construction and acceptance boundary for the single-node baseline closure. It
does not widen the semantics frozen by M1-M5.

## Responsibility boundary

M6 adds no Core state and no new final authority.

| Responsibility | Owner |
| --- | --- |
| Contract, invocation, lifecycle, and resilience facts | Existing M1-M5 owners |
| Process launch and ordered phase execution | Reference Reproduction Lab |
| Environment and resource observations | External Reproduction Harness |
| One retained-bundle verdict | Offline M6 verifier |
| Promotion to `VALIDATED` or `FROZEN` | M6 milestone review |

The Lab may import predecessor APIs and reference adapters. Dependencies in the opposite direction
are forbidden.

## Required public topology

```text
one fresh GitHub-hosted Ubuntu VM
├── one checked-out immutable revision
├── one isolated Maven repository
├── one newly created Python virtual environment
├── one Java host/control process at a time
├── one Python worker for the real invocation slice
├── up to two bounded local workers for resilience evidence
├── no required container
└── one offline verifier after runtime shutdown
```

The workflow must not configure Maven or pip caches for the clean reproduction job. A normal cached
regression job may remain separate and cannot substitute for this job.

## Required toolchain contract

- Java: feature release 17;
- Maven wrapper: 3.9.11 with the recorded distribution digest;
- Python: feature release 3.12 for the public clean proof;
- Node.js: feature release 22 for the public clean proof;
- Python dependencies: exact versions from `requirements-m2.txt` and its M3 extension;
- Java dependencies and build plugins: versions resolved from the tracked Maven model.

Unexpected feature releases are a bootstrap failure rather than an implicit compatibility claim.

## Required parent phases

Every accepted bundle contains one ordered phase record for:

1. `source_check`;
2. `bootstrap`;
3. `clean_build`;
4. `contract_conformance`;
5. `invocation_success_and_failure`;
6. `runtime_replacement`;
7. `lifecycle_register_load_warm_activate`;
8. `resilience_failure_and_recovery`;
9. `resource_observation`;
10. `rollback_and_final_state`;
11. `runtime_shutdown`;
12. `offline_predecessor_verification`;
13. `m6_offline_verification`.

Each phase records its monotonic order, start/end instants, command identity, exit result, evidence
paths and digests, and resource samples. The verifier rejects duplicate, missing, reordered, or
contradictory phase records.

## Retained bundle

The M6 bundle uses a versioned schema and contains at least:

- immutable source revision, tree identity, workflow identity, and dirty-state observation;
- OS, architecture, CPU, physical memory, swap, container observation, and toolchain versions;
- exact dependency inputs and resolved-version reports;
- ordered phase journal with file digests;
- M1-M5 conformance summaries and retained evidence trees;
- process identities and an explicit final no-live-runtime observation;
- build, idle, one-worker, multi-worker, and failure resource observations;
- startup and invocation baseline observations with method labels;
- the predeclared 16 GB decision and its individual predicates;
- explicitly unproven claims;
- an independently generated verdict.

The M6 summary may index these files. It cannot replace them.

## Required negative cases

The verifier must demonstrate that none of the following can produce `PASS`:

1. missing required phase;
2. reordered phase journal;
3. dirty or mutable source coordinate;
4. changed predecessor summary or evidence file;
5. missing resource observation;
6. claimed runtime shutdown while a recorded child remains live;
7. a claimed 16 GB acceptance with a failed or unavailable predicate;
8. a summary whose verdict is copied from invocation success.

These are evidence mutations. They do not rerun or rewrite predecessor semantic facts.

## Acceptance assertions

- one documented command drives the complete ordered baseline journey;
- the public proof begins on a fresh hosted VM and uses no project dependency cache;
- tracked source and all generated state remain distinguishable;
- predecessor suites pass unchanged and their retained evidence passes its independent verifier;
- every runtime child is stopped before the M6 offline verifier runs;
- the M6 verifier reaches its verdict from retained inputs only;
- resource observations cover every category required by the roadmap;
- the authoritative resource decision was observed on a 14–18 GiB host rather than inferred from
  the runner label;
- the 16 GB decision follows ADR-0011 without narrative override;
- M1-M5 freeze coordinates remain immutable and unchanged.

## Explicitly unproven

- repeatability across arbitrary operating systems, architectures, package mirrors, or future runner
  images;
- bit-for-bit reproducible Java or Python build artifacts;
- production performance, capacity, availability, or durability;
- multi-host and accelerator behavior;
- production security isolation;
- arbitrary plugins or dynamic installation;
- business success or application transaction semantics.

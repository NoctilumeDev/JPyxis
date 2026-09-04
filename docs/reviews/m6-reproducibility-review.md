# M6 Reproducibility Review

Status: `SINGLE-NODE BASELINE FROZEN`

M6 is accepted only for the bounded clean-reproduction claim described by
[ADR-0011](../adr/0011-m6-clean-reproduction-boundary.md) and the
[M6 Reproducibility Profile](../spec/m6-reproducibility-profile.md). It closes the M0-M6
single-node baseline without widening any M1-M5 semantic claim.

## Implemented boundary

- M6 is an outer Reference Reproduction Lab, not a new Core or control-plane owner;
- frozen M1-M5 implementation modules do not depend forward on M6 scripts or evidence types;
- one command starts from inspected source, creates isolated project dependencies, executes the
  ordered M1-M6 journey, stops every recorded runtime process, and retains an offline bundle;
- the GitHub-hosted proof runs on a fresh `ubuntu-24.04` VM without restored Maven or pip dependency
  caches and records actual environment values rather than trusting a runner label;
- the reproduction summary remains `PENDING`; only the independent M6 verifier returns the bundle
  verdict;
- resource observations are bounded measurements of the reference slice, not throughput,
  performance, capacity, security, or production-readiness claims.

## Ordered acceptance chain

```text
source_check
→ bootstrap
→ clean_build
→ contract_conformance
→ invocation_success_and_failure
→ runtime_replacement
→ lifecycle_register_load_warm_activate
→ resilience_failure_and_recovery
→ resource_observation
→ rollback_and_final_state
→ runtime_shutdown
→ offline_predecessor_verification
→ m6_offline_verification
```

Both public runs completed all 13 phases. Each copied and digested M1-M5 retained evidence before
the M6 offline verifier ran. The verifier reached `PASS` only after the recorded Worker processes
had exited.

## Negative evidence matrix

| Mutation | Required verdict | Observed |
| --- | --- | --- |
| missing required phase | `INCONCLUSIVE` | `INCONCLUSIVE` |
| reordered phase journal | `FAIL` | `FAIL` |
| dirty source | `INCONCLUSIVE` | `INCONCLUSIVE` |
| changed predecessor evidence | `FAIL` | `FAIL` |
| missing resource observation | `INCONCLUSIVE` | `INCONCLUSIVE` |
| false runtime-shutdown claim | `FAIL` | `FAIL` |
| failed 16 GiB predicate | `FAIL` | `FAIL` |
| summary copies invocation success | `FAIL` | `FAIL` |

No evidence mutation can produce `PASS`.

## Resource decision

The reference hypothesis was declared before the public observations: run the complete bounded
slice on a fresh 14-18 GiB host, keep the relevant process-tree peak at or below 12 GiB, retain at
least 2 GiB host-available memory, record no positive swap-use growth, and pass offline evidence
verification.

| Observation | PR run | merged-main run |
| --- | ---: | ---: |
| physical memory | 16,765,378,560 bytes | 16,766,414,848 bytes |
| process-tree peak | 683,585,536 bytes | 668,938,240 bytes |
| minimum host-available memory | 14,934,568,960 bytes | 15,255,392,256 bytes |
| swap-use growth | 0 bytes | 0 bytes |
| recorded runtime processes still live | 0 | 0 |
| mechanical resource decision | `ACCEPT` | `ACCEPT` |
| independent retained-bundle verdict | `PASS` | `PASS` |

The statement accepted here is deliberately narrow: the bounded M0-M6 CPU reference slice is
reproducible on the two observed fresh 16 GB-class hosted machines. This is not a general hardware
minimum or production-capacity statement.

## Review corrections

- signal-based child termination now considers both Node `exitCode` and `signalCode`, preventing a
  stopped Worker from being reported as live;
- the M1 offline comparison ignores only the intentionally different binding identity while still
  requiring complete semantic report equality;
- Linux process-tree measurement includes the M6 orchestrator and every descendant rather than only
  the immediate phase child;
- the 16 GB conclusion requires an observed 14-18 GiB physical-memory value, so a larger machine
  cannot accidentally prove the smaller-machine claim;
- high-frequency memory samples are reduced to auditable per-phase summaries while peak, minimum,
  swap endpoints, sample count, duration, and method remain retained;
- the PR and merged-main summaries intentionally have different digests because their immutable
  source coordinates and observations differ; each digest was checked independently.

## Closure gate

- [x] One documented command drives the complete ordered reference journey.
- [x] Public proof starts from fresh GitHub-hosted Ubuntu VMs without project dependency caches.
- [x] Source SHA, tree, dirty state, generated residue, toolchain, and dependency inputs are retained.
- [x] M1-M5 suites pass unchanged and their copied evidence passes independent offline verification.
- [x] Real Java-to-Python invocation succeeds with a contract-validated typed result.
- [x] Runtime replacement, lifecycle, resilience, recovery, and rollback observations remain linked.
- [x] Every recorded runtime process is stopped before the final verifier runs.
- [x] Missing, reordered, altered, or self-authorizing evidence cannot produce `PASS`.
- [x] PR and merged-main public jobs pass and both downloaded artifacts pass offline readback.
- [x] The bounded 16 GB reference target is accepted from predeclared mechanical predicates.
- [x] M1-M5 freeze tags, manifests, reviews, ownership, and dependency directions remain unchanged.
- [x] The protected annotated tag is created only from the accepted closure commit.

## Public evidence coordinates

- implementation PR: [#16](https://github.com/NoctilumeDev/JPyxis/pull/16);
- reviewed head: `d18b273f640aec459a4fdb71d0c3af7440841cb2`;
- reviewed-head CI: [run 33893320414](https://github.com/NoctilumeDev/JPyxis/actions/runs/33893320414),
  artifact `9944832354`;
- GitHub reviewed merge revision inside that artifact:
  `0476063b3579d93bfe00d77d4123f0404e53a39c`;
- reviewed-head summary SHA-256:
  `3d31fbb40a611de2e06caee58401645de73415dd87147ee196eb3b0ff0da57fc`;
- implementation merge: `d2738ef2429399aac849b6114898d53fc4cdcb18`;
- merged-main CI: [run 33894052160](https://github.com/NoctilumeDev/JPyxis/actions/runs/33894052160),
  artifact `9945122089`;
- merged-main summary SHA-256:
  `e9794d8d614535e96506711eb788ba353edc274a5e1584bf7990e242a8dd35ce`;
- retained evidence index: [`evidence/m6/freeze-manifest.json`](../../evidence/m6/freeze-manifest.json).

The annotated tag `m6-reproducibility-v1` identifies the closure commit after this record itself
passes both public gates and lands on `main`. The repository tag ruleset prevents update or deletion
through the normal path.

## Explicitly unproven

- production readiness, throughput, latency SLA, capacity, or comparative performance;
- operating-system or hardware security isolation;
- GPU, NPU, accelerator, zero-copy, or high-throughput data-plane behavior;
- multi-host scheduling, network partitions, consensus, leader election, or cluster recovery;
- arbitrary third-party plugins, dynamic installation, or ecosystem maturity;
- reproducibility across arbitrary operating systems, architectures, package mirrors, or future
  runner images;
- bit-for-bit reproducible Java or Python artifacts;
- business transaction success.

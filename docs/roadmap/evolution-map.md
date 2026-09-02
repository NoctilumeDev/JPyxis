# Evolution Map

Status: `DIRECTION ONLY · NOT COMMITTED`

Evolution items are not milestones, releases, or promises. They preserve architectural direction and define the evidence that would justify new construction.

```text
M0-M6 Single-node Baseline
          │
          └────── FREEZE
                    │
        ┌───────────┼───────────┐
        │           │           │
 E1 Data Plane  E2 Accelerator  E4 Polyglot Definition
        │           │           │
        └──────┬────┘           │
               │                │
       E3 Distributed Control   │
               │                │
               └────────┬───────┘
                        │
                E5 Runtime Ecosystem
```

The arrows indicate plausible dependency, not a required order.

## E1 — High-performance Data Plane

Possible capabilities:

- Arrow-based batch exchange;
- local shared memory;
- typed buffer handles and lifetime tracking;
- copy and serialization reduction.

Entry condition:

- M6 measurements show that the baseline carrier is a material bottleneck for a named workload;
- ownership, cleanup, crash behavior, and synchronization can remain contract-visible.

Current obligation:

- keep control transport and data carrier conceptually separate;
- do not implement Arrow or shared memory.

## E2 — Accelerator Runtime

Possible capabilities:

- GPU-backed runtime plugins;
- DLPack exchange;
- CUDA IPC where process topology warrants it;
- device placement and accelerator resource declarations.

Entry condition:

- a real accelerator workload cannot be represented or served acceptably by the CPU baseline;
- suitable hardware and a reproducible test environment exist;
- device memory ownership and synchronization rules are specified.

Current obligation:

- contract semantics may describe device and memory requirements without requiring GPU implementation.

## E3 — Distributed Control Plane

Possible capabilities:

- remote workers;
- cluster scheduler plugin;
- service discovery and lease semantics;
- multi-host failure and partition handling;
- durable control state and leader/consensus integration where required.

Entry condition:

- a single-node topology is insufficient for a real accepted use case;
- network, lease, identity, and split-brain semantics have explicit acceptance tests;
- adequate multi-host evidence infrastructure exists.

Current obligation:

- do not embed local process identifiers or filesystem paths into semantic identity;
- do not simulate multi-host proof with local ports and call it distributed validation.

## E4 — Polyglot Definition Frontend

Possible capabilities:

- Rust, Java, Lua, a DSL, or another definition frontend;
- language-neutral packaging and validation;
- frontend conformance fixtures.

Entry condition:

- a concrete second frontend use case exists;
- the Python implementation has not leaked into contract or Core semantics;
- a second implementation can satisfy the same capability contract.

Current obligation:

- call Python the first Definition plugin, not the architecture itself.

## E5 — Runtime Ecosystem

Possible capabilities:

- versioned third-party SPI;
- plugin compatibility and conformance tooling;
- registry and discovery mechanisms;
- runtime, transport, data-plane, scheduler, storage, and telemetry plugin catalogues.

Entry condition:

- more than project-owned fixtures need independent release and compatibility;
- governance, signing, compatibility, and deprecation costs are understood;
- the Core contract has demonstrated stability across real replacements.

Current obligation:

- keep capability ports narrow;
- do not claim an ecosystem from a directory named `plugins`.

## Evolution rule

Each Evolution item must become a newly accepted milestone with scope, non-goals, environment, evidence plan, and stop conditions before implementation begins.

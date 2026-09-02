# Research Evidence Traceability

Status: `M0 TRACEABILITY BASELINE`

This matrix connects the M0 bibliography to the questions that construction must answer. A source
can establish an available mechanism or prior result; it cannot substitute for JPyxis acceptance
tests.

## Question matrix

| Question | Primary evidence | What the evidence establishes | JPyxis hypothesis still open | Owning evidence stage |
| --- | --- | --- | --- | --- |
| RQ1 — mapper usefulness | `INT-01`-`INT-04`, `XWK-01`, `XWK-02`, `JVM-01`, `JVM-04`, `WIRE-01` | Multiple in-process, worker, RPC, and direct-Java integration mechanisms already exist. | Whether a typed mapper adds contract and governance value without hiding transport or failure semantics. | M1 contract review; M2 direct-gRPC and direct-runtime controls |
| RQ2 — shared value meaning | `IR-01`, `IR-02`, `IR-07`, `DATA-01`-`DATA-03`, `WIRE-02`-`WIRE-04` | Existing formats define typed graphs, shapes, tensor exchange, fields, and compatibility constraints. | Whether Java and Python validators reach identical verdicts for the accepted corpus. | M1 language-neutral corpus and dual-validator conformance |
| RQ3 — runtime replacement | `JVM-01`, `JVM-02`, `JVM-04`, `JVM-06`, `SRV-01`, `PLUGIN-01` | Engine and provider abstractions are established patterns; Java can discover providers without naming implementations. | Whether replacement survives JPyxis lifecycle and failure semantics without Core branching on runtime names. | M3 two conforming runtime fixtures and dependency audit |
| RQ4 — lifecycle authority | `SRV-01`-`SRV-06` | Serving and registry systems already implement loading, versioning, routing, health, and model lifecycle operations. | Whether JPyxis can centralize final authority while retaining truthful plugin observations and rollback. | M4 state-transition, crash, drain, and rollback evidence |
| RQ5 — failure attribution | `WIRE-05`-`WIRE-07`, `SRV-02`-`SRV-04` | RPC status, deadlines, cancellation, reload, controller, and replica failures have established semantics. | Whether cross-layer faults remain distinguishable and race outcomes have one authoritative owner. | M2 error corpus; M4-M5 fault injection and recovery |
| RQ6 — carrier limit | `XWK-04`, `DATA-01`-`DATA-03`, `WIRE-01`, `WIRE-02` | Batch exchange and zero-copy interfaces exist, each with explicit process, ownership, memory, or synchronization boundaries. | At what measured payload and concurrency the baseline carrier ceases to be sufficient. | M6 recorded workload and environment before any E1 proposal |
| RQ7 — independent reproduction | `EVID-01`, `EVID-02` | Provenance and reproducible-build practice require recorded inputs, environment, process, and comparison. | Whether a clean machine can reproduce the full accepted single-node lifecycle without hidden state. | M6 clean-environment reproduction record |

Source keys resolve in [Primary References](references.md). Detailed capability comparisons and
project-level controls are in the [Prior-art Matrix](prior-art-matrix.md).

## Negative evidence and stop conditions

- Direct ONNX Runtime Java or DJL use is the control for an unnecessary mapper or framework.
- Protobuf and gRPC are carriers and transport semantics; they do not prove JPyxis type meaning,
  truth ownership, lifecycle authority, or retry safety.
- ONNX, StableHLO, MLIR, and TVM are evidence against inventing another graph or compiler IR.
- Triton, TensorFlow Serving, Ray Serve, MLflow, and Clipper are evidence against relabelling model
  serving, versioning, routing, or registries as a JPyxis invention.
- Arrow and DLPack are later data-plane candidates, not justification for adding a fast path before
  measurement.

The project narrows to a specification or thin integration library if established systems satisfy
the selected use case with equivalent contract clarity, authority, failure semantics, and lower
complexity.

## Unproven integrated hypothesis

No source in this baseline proves that one thin, contract-driven Core can combine typed host
mapping, single-authority lifecycle governance, replaceable definition and runtime capabilities,
and attributable failure semantics at acceptable complexity. That is the JPyxis hypothesis, and it
remains `PLANNED` until milestone evidence answers it.

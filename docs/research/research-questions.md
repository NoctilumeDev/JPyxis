# Research Questions

Status: `PLANNED · M0`

Each milestone must answer a bounded question rather than accumulate features.

## RQ1: Is a mapper abstraction useful?

Can a typed host interface remain ergonomic while preserving explicit contract version, timeout, cancellation, retry safety, error category, artifact identity, and trace context?

Control comparison: direct gRPC client and direct ONNX Runtime Java or DJL use.

## RQ2: Can two language bindings agree on one value meaning?

Can Java and Python validators reach the same verdict for representative scalar, record, fixed-shape tensor, dynamic-shape tensor, optional, batch, and incompatible-version cases?

Failure signal: the design requires generic unvalidated objects for ordinary cases.

## RQ3: Is runtime replacement real?

Can the same host contract and invocation behavior execute through two conforming runtime fixtures without Core branching on runtime names?

Failure signal: runtime-specific types or policies leak into the host API or Core state machine.

## RQ4: Can lifecycle authority remain centralized without hiding runtime truth?

Can load, warm, activate, drain, unload, and rollback use plugin observations while only the owning coordinator advances authoritative state?

Failure signal: workers must directly mutate deployment state for the system to function.

## RQ5: Are failures attributable and recoverable?

Can contract, definition, plugin, transport, runtime, invocation, deployment, control, and application faults remain distinguishable through transport and recovery?

Failure signal: meaningful cross-layer failures collapse into generic internal errors or ambiguous success.

## RQ6: Where does the baseline data carrier stop being sufficient?

For representative payloads, where do serialization, copies, latency, or memory pressure justify an E1 data-plane experiment?

No threshold is fixed until the reference environment and workload corpus are defined.

## RQ7: Does the single-node baseline reproduce independently?

Can a clean environment follow one documented path through build, launch, artifact registration, load, warm, activation, invocation, observation, fault injection, recovery, and rollback?

Failure signal: success depends on undocumented global tools, cached state, manual repair, or the author's memory.

## Project-level rejection condition

If established Java runtime libraries or serving systems satisfy the selected use case with equivalent contract clarity, lifecycle ownership, failure semantics, and lower complexity, JPyxis should narrow to a specification or thin integration library rather than continue as a framework.

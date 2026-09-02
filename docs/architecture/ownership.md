# Ownership and Truth Map

Status: `PROPOSED · M0`

The distinction between producer and final authority prevents a component from promoting its own observation into a system fact.

## Facts

| Fact | Producer or reporter | Final authority | Required invariant |
| --- | --- | --- | --- |
| Contract definition and compatibility result | Contract tooling | Contract Core | The same inputs produce the same compatibility verdict for a fixed contract version. |
| Artifact bytes and digest | Definition packaging path | Artifact Registry | Existing artifact identity never resolves to different content. |
| Artifact validation outcome | Definition and runtime validators | Artifact Registry | Rejection never mutates an earlier validated artifact. |
| Desired deployment | Host or operator request | Control Plane | Intent is distinct from observed worker state. |
| Active artifact binding | Deployment events | Deployment Manager | At most one active version per baseline deployment slot. |
| Warmup observation | Runtime plugin | Deployment Manager | A successful report is necessary but not sufficient for activation. |
| Worker heartbeat | Worker/runtime plugin | Runtime Supervisor | A worker does not define its own authoritative health. |
| Raw computed value | Runtime plugin | Runtime for production of bytes/value | The result remains tied to runtime, artifact, contract, and invocation identities. |
| Accepted invocation result | Runtime plugin | Invocation Manager after contract validation | Invalid output cannot be recorded as a successful invocation. |
| Invocation terminal state | Transport/runtime observations | Invocation Manager | Exactly one terminal outcome is recorded. |
| Business authorization | Host application | Host application | JPyxis cannot grant application authority that the host denied. |
| Business transaction result | Host application | Host application | Compute success does not commit a business transaction. |
| Trace identity | Control Plane | Control Plane | All derived spans retain the originating invocation coordinate. |
| Telemetry export result | Telemetry plugin | Evidence record owned by the invoking coordinator | Export failure cannot rewrite the business or compute result. |

## Semantic owner versus capability provider

Several words occur in both Core and plugin discussions. They must not collapse into one component:

| Semantic responsibility in Core | Replaceable capability |
| --- | --- |
| Registry identity, immutability, and compatibility rules | `ArtifactStore` persistence implementation |
| Routing eligibility and version-pinning rules | local or future cluster scheduler |
| Lifecycle state-transition invariants | runtime-specific load, warm, and unload operations |
| Telemetry event meaning and required coordinates | Micrometer, OpenTelemetry, or another exporter |
| Data ownership and lifetime rules | Protobuf, Arrow, shared-memory, or accelerator carrier |

Core decides what a valid fact means. A plugin supplies the mechanism used to obtain, store, transport, or export it.

## State authority rule

Every state transition follows this pattern:

```text
plugin observation
→ typed event
→ contract validation
→ owning coordinator decision
→ persisted transition
→ observable evidence
```

Direct writes from a plugin to another owner's state are prohibited.

## Open ownership questions

- Whether Artifact Registry and Deployment Manager are separate modules or separate responsibilities inside one single-node process.
- Whether Runtime Supervisor belongs inside the first Control implementation or behind a scheduler capability.
- Which evidence records must be durable in M2-M5 and which may remain process-local until M6.

These are packaging and persistence decisions. They do not weaken the single-authority rule.

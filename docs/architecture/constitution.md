# Architecture Constitution

Status: `ACCEPTED · M0 FROZEN`

This document freezes architectural invariants, not concrete Java interfaces, Protobuf field numbers, package names, or deployment products. These invariants are normative for M1 construction after the M0 review.

## Article 1: roles own responsibilities

- The **Control Plane** owns policy and state-transition decisions.
- A **Definition Frontend** owns declarative algorithm meaning.
- A **Runtime** owns execution of an accepted request.
- The **Contract Core** owns cross-boundary meaning.
- The **Host Application** retains business authorization and business truth.

Java, Python, and NumPy are the first reference implementations of their roles. ONNX Runtime remains a comparison baseline and possible later Runtime provider. Languages and products do not own architectural authority merely by being selected first.

## Article 2: the contract is the only semantic boundary

Every value, capability, version, failure, and lifecycle signal crossing a boundary must have explicit contract meaning. Shared memory, RPC libraries, generated classes, and process-local objects are carriers; none of them becomes the semantic authority.

## Article 3: one fact has one final authority

Multiple components may observe or report an event. Exactly one component accepts it as a persisted fact and advances the associated state machine. A worker may report successful warmup; it cannot declare its deployment active.

## Article 4: events cross boundaries; state ownership does not

Plugins emit typed outcomes and observations. Core coordinators decide state transitions. A plugin cannot mutate lifecycle state owned by another role.

## Article 5: Core defines semantics; plugins provide capabilities

Core contains only rules that must remain invariant when implementations change:

- contract semantics and compatibility rules;
- lifecycle invariants;
- truth and state ownership;
- dependency direction;
- failure taxonomy and attribution;
- capability selection rules.

Replaceable capabilities belong behind explicit ports. Candidate capability families include definition, runtime, transport, data plane, artifact storage, scheduling, and telemetry.

## Article 6: replaceability must be real

Adding an interface does not prove a plugin boundary. A capability qualifies as replaceable only when:

- Core does not import implementation-specific types;
- the plugin declares its capabilities and compatibility;
- lifecycle and failure behavior are contract-visible;
- at least one replacement or conformance fixture can exercise the same port;
- selection does not devolve into implementation-name conditionals in Core.

## Article 7: plugins cannot redefine semantics

A plugin may provide a capability, optimize a carrier, or support a runtime. It may not silently change tensor layout meaning, version compatibility, lifecycle transitions, authorization, or error ownership.

## Article 8: artifacts are immutable; activation is separate

A definition artifact is identified by immutable content and version metadata. Deployment and routing records decide whether that artifact receives work. Updating an artifact creates a new identity; it does not mutate bytes behind an existing identity.

## Article 9: control and data planes remain separable

Control operations exchange identities, decisions, metadata, status, and bounded payloads. Large data may later move through a specialized data plane, but the data plane cannot acquire lifecycle or authorization authority.

## Article 10: no untyped semantic escape hatch

Generic objects, arbitrary dictionaries, opaque bytes, and unconstrained `Any` values cannot replace the contract. Opaque payloads or handles are allowed only when their producer, consumer, type identity, ownership, lifetime, and validation rules are explicit.

## Article 11: business authority does not enter definition code

Definition and runtime plugins do not own application users, permissions, transactions, or production database facts. They receive only the bounded inputs and capabilities declared by contract.

## Article 12: invocation granularity remains bounded

The baseline governs algorithm- or job-level invocation. It does not make a remote call per mathematical operator. Finer-grained execution requires separate evidence and must not leak into the host API by accident.

## Article 13: existing runtimes remain external

JPyxis coordinates existing execution systems. It does not reimplement kernels, tensor engines, compilers, autograd, device libraries, or distributed collectives unless a future, separately justified project boundary says otherwise.

## Article 14: evidence precedes capability claims

Architecture diagrams prove intent only. A capability becomes `VALIDATED` only through evidence at the correct platform and topology. A local success cannot establish distributed, GPU, security, or performance claims.

## Article 15: future direction cannot tax the baseline

Evolution directions may require stable attachment points. They cannot require current implementation work until an entry condition is observed and a new milestone is explicitly accepted.

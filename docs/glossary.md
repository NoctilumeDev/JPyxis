# Glossary

Status: `M0 FROZEN`

The glossary keeps role names separate from their first implementations.

| Term | Meaning |
| --- | --- |
| JPyxis Core | The invariant rules for contract meaning, ownership, lifecycle, routing eligibility, failure attribution, and capability negotiation. |
| Contract Core | The part of Core that defines cross-boundary types, identities, compatibility, and validation semantics. |
| Control Plane | The role that accepts intent, applies policy, selects eligible capabilities, and owns authoritative lifecycle decisions. Java is the first planned implementation. |
| Host Application | The business system using JPyxis. It retains business authorization, transactions, and domain truth. |
| Host API / Algorithm Mapper | A typed projection of an algorithm contract into the host language. It is not merely an RPC stub or object converter. |
| Capability Port | A Core-owned semantic interface through which a replaceable mechanism participates. Exact programming-language interfaces are not frozen in M0. |
| Plugin | A provider of one or more declared capabilities behind a port. “Plugin” does not necessarily mean dynamic installation. |
| Adapter | Boundary code that converts between an external system's representation and JPyxis semantics. A plugin commonly contains an adapter. |
| Definition Frontend | The role that declares algorithm, preprocessing, postprocessing, or model meaning. Python is the first planned frontend. |
| Definition Plugin | A provider implementing Definition Frontend capabilities without acquiring control-plane or business authority. |
| Runtime | An existing system that performs accepted computation. |
| Runtime Plugin | The adapter and capability metadata through which Core coordinates an external Runtime. |
| Artifact | Immutable, content-identified definition or model material plus contract and provenance metadata. |
| Artifact Registry | The semantic authority for artifact identity, immutability, validation facts, and history. Persistence may be supplied by an `ArtifactStore` plugin. |
| Deployment | A control-plane attempt to make a validated artifact ready and eligible for invocation through selected capabilities. |
| Deployment Slot | The baseline routing scope within which at most one version is active. Its exact key is an M0 decision. |
| Invocation | One contract-bound request pinned to a specific artifact, deployment, and attempt identity. |
| Control Path | Identities, policy decisions, lifecycle events, routing, and bounded request metadata. |
| Data Path | Validated values or typed handles moving to and from execution. It never owns authorization or lifecycle decisions. |
| Observation | A typed report from a plugin or external system. It becomes authoritative state only after the owning coordinator validates and accepts it. |
| Evolution item | A non-committed future direction identified by `E`, with an entry condition but no current delivery promise. |

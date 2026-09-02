# Dependency Rules

Status: `ACCEPTED · M0 FROZEN`

## Compile-time direction

The architecture is not one vertical chain of implementation imports. Contract semantics and capability ports form the inward boundary.

```text
Host Application
      ↓
Host API / Mapper ───────────────→ Contract Core
      ↓
Control API

Control Engine ──────────────────→ Contract Core + Ports
Definition Plugin ───────────────→ Contract Core + Ports
Runtime Plugin ──────────────────→ Contract Core + Ports
Transport Plugin ────────────────→ Contract Core + Ports
Data-plane Plugin ───────────────→ Contract Core + Ports
Artifact-store Plugin ───────────→ Contract Core + Ports
Scheduler Plugin ────────────────→ Contract Core + Ports
Telemetry Plugin ────────────────→ Contract Core + Ports

External systems ← their owning adapter only
```

The Control Engine invokes ports. It does not import plugin implementation packages.

## Runtime flow is not dependency direction

A request may flow through several capabilities:

```text
Application
→ Mapper
→ Control
→ Transport
→ Definition / Runtime capability
→ Data carrier
→ validated result
```

This does not authorize Definition to import Control, Runtime to import application models, or one plugin to bypass Core and command another plugin.

## Proposed module responsibilities

Names are illustrative and are not frozen Java modules:

```text
jpyxis-contract   semantic model, compatibility, identifiers
jpyxis-core       lifecycle, routing, ownership, failure decisions
jpyxis-spi        narrow capability ports and plugin metadata
jpyxis-control    first control-plane assembly
jpyxis-host-java  Java-facing mapper and host API

plugins/
  definition-python
  transport-grpc
  runtime-numpy-or-onnx
  data-protobuf
  store-local
  scheduler-local
  telemetry-otel-or-micrometer
```

Core may be implemented in Java while remaining independent of Spring, Python, gRPC, ONNX, CUDA, Kubernetes, and vendor-specific classes.

## Wire models and internal models

Generated Protobuf classes, Arrow schemas, runtime tensors, and host DTOs are boundary representations. Each adapter converts them to or from JPyxis semantic types at its boundary.

Prohibited shortcuts include:

- passing generated wire messages through every internal layer;
- storing runtime-native tensor objects as registry facts;
- exposing Python dictionaries or Java `Object` as a public algorithm signature;
- inspecting plugin implementation names in Core to decide semantics;
- letting a transport exception directly choose a deployment transition.

## Plugin interaction

Plugins advertise capabilities and constraints through metadata understood by Core. Core selects a compatible set and coordinates it through ports. If two plugins must cooperate, their interaction is mediated by a typed Core-owned capability or handle contract, not a private side channel.

## Enforcement candidates

M1 and later may test:

- build-module dependency rules;
- architecture tests that reject forbidden imports;
- SPI conformance fixtures;
- package visibility or module-system boundaries;
- runtime checks that reject undeclared capability combinations.

The specific mechanism remains open until the implementation structure is selected.

# Conceptual Origin

Status: `HISTORICAL CONTEXT · M0`

This document records how the project question changed. It is not evidence of implementation or novelty.

## The original question

The early idea was a Java/Python mapping layer:

```text
Java
  ↕
Mapping Layer
  ↕
Python
```

The immediate concern was developer ergonomics: could a Java application call Python algorithms without spreading process management, transport details, and manual conversion throughout business code?

That problem is old and well served by existing technologies. JNI, JEP, GraalPy, Py4J, gRPC, and other systems already demonstrate several forms of Java/Python interoperability. JPyxis therefore does not treat language calling or object conversion as a new contribution.

## The abstraction shift

The design question expanded from language interoperability to architectural authority:

- Who may initiate an execution?
- Who defines the computation?
- Who may advance lifecycle state?
- Who owns each persisted fact?
- Who performs the execution?
- How can implementations change without changing those answers?

The current reference profile answers:

```text
Control Plane       governs execution and lifecycle decisions
Definition Frontend describes what should be computed
Runtime             performs accepted computation
Contract Core       defines cross-boundary meaning
JPyxis Core         preserves ownership, state, routing, and failure rules
```

Java, Python, and native runtimes are the first intended implementations of these roles. The roles are architectural; the languages are replaceable.

## The mapper changed meaning

The original mapper could have been understood as:

```text
Java object ↔ Python object
```

The current mapper hypothesis is broader:

```text
interface binding
+ value and tensor contract
+ version binding
+ invocation semantics
+ error semantics
+ lifecycle visibility
+ capability discovery
```

Its purpose is not merely to find and call a Python method. It projects a dynamically supplied compute capability into a statically governed host API without granting that capability business authority.

## The MyBatis analogy

MyBatis is an inspiration because a mapper separates two semantic systems:

```text
Java business semantics
→ mapper boundary
→ SQL and relational semantics
```

The business layer does not need to own JDBC mechanics, and SQL does not need to understand controllers or HTTP. JPyxis studies a similar form of heterogeneous semantic isolation:

```text
host system semantics
→ algorithm mapper
→ definition semantics
→ runtime contract
→ compute semantics
```

The analogy is limited. JPyxis is not a database mapper, does not copy MyBatis internals, and must account for tensor structure, asynchronous failure, runtime lifecycle, resource ownership, and version activation.

## Authority is intentionally directional

Technical bridges often permit bidirectional calls. JPyxis distinguishes technical reachability from architectural permission.

A definition capability may return a typed result or emit a typed observation. It may not call back into business control, acquire application authorization, mutate production facts, or advance a Core-owned state machine.

```text
Control → bounded capability request       allowed
Plugin  → typed result or observation     allowed
Plugin  → business command or state write prohibited
```

This is the point where the idea stopped being merely a bridge.

## Design evolution

The conceptual path can be summarized as:

```text
V0  Java/Python bridge
 ↓
V1  Java/Python mapping layer
 ↓
V2  strong contract mapping
 ↓
V3  control/definition/execution separation
 ↓
Current hypothesis: contract-driven pluggable compute architecture
```

These labels describe the evolution of thought, not released versions.

## Present identity

Python is no longer the center of the architecture. It is the first Definition plugin. A future Rust frontend, DSL, or another language may participate only if it obeys the same contract and authority rules.

JPyxis is therefore not principally a bridge between two languages. It studies the admission rules for capabilities that want to attach to a governed compute system.

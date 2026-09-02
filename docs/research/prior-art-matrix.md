# Prior-art Matrix

Status: `M0 RESEARCH BASELINE`

This is a scoped engineering review, not a systematic literature review and not a novelty opinion. It identifies direct baselines that already solve parts of the problem so JPyxis does not rename existing work as an invention.

Only primary project documentation, specifications, API references, maintainer artifacts, or
original papers are used in the current matrix. Full links and stable source keys are collected in
[Primary References](references.md). The collection method is recorded in the
[Literature Review Protocol](review-protocol.md), and question-level use is recorded in
[Research Evidence Traceability](evidence-traceability.md).

## Matrix

| Area | Primary prior art | What it already establishes | Question it does not settle for JPyxis |
| --- | --- | --- | --- |
| In-process Java/Python interoperability | JNI, JEP, GraalPy, Py4J | Java and Python can share a process or exchange calls and objects through established bridges. | Whether business authority, lifecycle, immutable artifacts, failure ownership, and runtime replacement can be governed through one contract. |
| Cross-language worker execution | Apache Beam portability, PyFlink | A language-neutral control model can coordinate SDK harnesses or Python workers through Protobuf/gRPC; process and thread modes expose real isolation/overhead trade-offs. | Whether a mapper-oriented host API and one truth-ownership model can remain stable across definition and runtime plugins. |
| JVM/Python data exchange | Apache Spark Arrow integration | Arrow can efficiently transfer batches between JVM and Python processes, with explicit batch and memory considerations. | Where JPyxis should switch carriers, and how carrier ownership integrates with invocation and lifecycle semantics. |
| Java-native model use | ONNX Runtime Java, Deep Java Library | Java applications can already load and run portable models, and DJL exposes engine-agnostic Java abstractions. | Whether a separate definition frontend and control-plane lifecycle add value beyond direct Java inference. |
| Model serving and lifecycle | NVIDIA Triton, TensorFlow Serving, Ray Serve, MLflow Model Registry | Existing systems cover model repositories, loading, serving, versioning, routing, health, batching, and lifecycle operations. | Whether JPyxis needs to exist as a framework, a thin host library, or only a contract profile; experiments must answer this. |
| Portable model and compiler IR | ONNX IR, StableHLO, MLIR, TVM | Typed graphs, versioned operator semantics, multi-level IR, and portable optimization infrastructures already exist. | Whether JPyxis should consume existing artifacts instead of defining a graph IR; current presumption is yes. |
| Tensor exchange | Arrow C Data Interface, DLPack | Stable C-level structures can exchange arrays or tensors with explicit dtype, shape, device, ownership, and synchronization constraints. | How a later JPyxis data-plane plugin preserves contract and lifecycle authority across process or device boundaries. |
| RPC contracts | gRPC and Protocol Buffers | Language-neutral services and generated bindings already provide mature control transport. | Protobuf alone does not define JPyxis tensor semantics, state ownership, retry safety, or artifact activation rules. |

## Direct comparisons

### JNI, JEP, GraalPy, and Py4J

The [JNI specification](https://docs.oracle.com/en/java/javase/26/docs/specs/jni/index.html) defines native interoperability for Java. [JEP](https://github.com/ninia/jep) embeds CPython in the JVM through JNI. [GraalPy](https://www.graalvm.org/reference-manual/graalpy/) embeds a Python 3 runtime in Java through GraalVM's polyglot facilities. [Py4J](https://www.py4j.org/contents.html) provides bidirectional Java/Python object access.

These are alternatives for an interoperability mechanism. JPyxis must not claim that embedding or calling Python is new. Its first experiments should compare process isolation, lifecycle ownership, native-extension compatibility, error attribution, and operational cost before selecting a default definition adapter.

### Beam, PyFlink, and Spark

The [Apache Beam portability model](https://beam.apache.org/roadmap/portability/) separates a language-neutral runner API from SDK harnesses and uses Protobuf/gRPC contracts. [PyFlink's process and thread modes](https://flink.apache.org/2022/05/06/exploring-the-thread-mode-in-pyflink/) document both separate Python workers and in-JVM execution, including serialization and latency trade-offs. [Spark's Arrow integration](https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html) uses Arrow for JVM/Python batch transfer.

These systems are strong controls for any claim about cross-language scheduling or data movement. JPyxis must show a distinct, narrower contribution in host contract ergonomics, state authority, and replaceable compute capabilities.

### DJL and ONNX Runtime

[Deep Java Library](https://docs.djl.ai/master/index.html) already provides an engine-agnostic Java API, while its [engine model](https://docs.djl.ai/master/docs/engine.html) imports models trained in Python and delegates execution to established engines. [ONNX Runtime's Java binding](https://onnxruntime.ai/docs/get-started/with-java.html) already supports direct inference from Java, and its [execution-provider architecture](https://onnxruntime.ai/docs/execution-providers/) partitions work across hardware-specific implementations.

These are the most important controls against building an unnecessary framework. If the first use case is fully served by direct DJL or ONNX Runtime use, JPyxis should narrow to a contract/lifecycle library or be rejected.

### Triton, TensorFlow Serving, Ray Serve, and MLflow

[NVIDIA Triton](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/architecture.html) provides schedulers, backends, model repositories, HTTP/gRPC/C APIs, and model-management operations. Its [model-management documentation](https://docs.nvidia.com/deeplearning/triton-inference-server/archives/triton-inference-server-2280/user-guide/docs/user_guide/model_management.html) describes explicit loading and preservation of an older model when reload fails. [TensorFlow Serving](https://research.google/pubs/tensorflow-serving-flexible-high-performance-ml-serving/) addresses model lifecycle and high-performance serving. [Ray Serve](https://docs.ray.io/en/latest/serve/architecture.html) provides controllers, replicas, routing, and autoscaling. [MLflow Model Registry](https://mlflow.org/docs/latest/ml/model-registry/) provides version, alias, lineage, and lifecycle metadata.

JPyxis must not relabel model serving or registries as original. Its question is whether application-owned control and mapper semantics justify a smaller embedded or adjacent control layer, and where delegation to these systems is preferable.

### ONNX, StableHLO, MLIR, and TVM

The [ONNX IR specification](https://onnx.ai/onnx/repo-docs/IR.html) defines typed, versioned computational graphs. [StableHLO](https://openxla.org/stablehlo/spec) defines portable operation semantics between frameworks and compilers. [MLIR](https://mlir.llvm.org/docs/LangRef/) provides extensible multi-level intermediate representations, and the [TVM paper](https://www.usenix.org/conference/osdi18/presentation/chen) demonstrates end-to-end compilation across frameworks and hardware.

The current JPyxis presumption is that graph and compiler IRs should be reused, not recreated. Its contract may reference or constrain an existing artifact without becoming another compiler IR.

### Arrow C Data and DLPack

The [Arrow C Data Interface](https://arrow.apache.org/docs/format/CDataInterface.html) specifies a small C ABI for in-process Arrow data exchange and explicitly separates that concern from cross-process transport. [DLPack](https://dmlc.github.io/dlpack/latest/) defines a stable tensor exchange ABI across frameworks and devices, including ownership and synchronization obligations.

These are candidate future data-plane building blocks. Their existence does not justify implementing them in the single-node baseline before measurement establishes a bottleneck.

## Candidate JPyxis hypothesis

No novelty claim is made. The working hypothesis is:

> A thin Core that owns contract meaning, lifecycle invariants, truth ownership, and failure attribution may let host applications govern heterogeneous compute while definition, runtime, transport, data-plane, storage, scheduling, and telemetry implementations remain replaceable plugins.

The hypothesis fails or narrows if existing direct Java runtimes or serving systems deliver the same required properties with less complexity.

## Required next research

- Compare direct ONNX Runtime Java and DJL against the accepted reference mapper path for the first use case.
- Compare separate-process Python with GraalPy/JEP for isolation, compatibility, and operational behavior.
- Define a representative contract corpus before selecting the canonical schema carrier.
- Establish payload and latency measurements before accepting E1 data-plane work.
- Review plugin compatibility/versioning patterns before freezing the SPI.

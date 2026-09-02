# Primary References

Status: `M0 BIBLIOGRAPHY BASELINE`

Accessed 2026-09-03 unless noted otherwise. Stable identifiers are local bibliography keys, not
claims of endorsement or novelty. Evidence classes are `SPEC` (normative specification), `API`
(official API reference), `DOC` (official project documentation), `PAPER` (original publication),
and `ARTIFACT` (maintainer-owned runnable source or repository).

## Language interoperability and portable execution

- **INT-01 · SPEC** — Oracle. [Java Native Interface Specification, Java SE 26](https://docs.oracle.com/en/java/javase/26/docs/specs/jni/index.html).
- **INT-02 · ARTIFACT** — JEP Project. [JEP: Java Embedded Python](https://github.com/ninia/jep).
- **INT-03 · DOC** — GraalVM. [GraalPy Reference Manual](https://www.graalvm.org/reference-manual/graalpy/).
- **INT-04 · DOC** — Py4J Project. [Py4J Documentation](https://www.py4j.org/contents.html).
- **XWK-01 · DOC** — Apache Beam. [Portability Framework Roadmap](https://beam.apache.org/roadmap/portability/).
- **XWK-02 · DOC** — Apache Flink. [Exploring the Thread Mode in PyFlink](https://flink.apache.org/2022/05/06/exploring-the-thread-mode-in-pyflink/), 2022.
- **XWK-03 · DOC** — Apache Flink. [Introducing Python Support for UDFs in Flink's Table API](https://flink.apache.org/2020/04/09/pyflink-introducing-python-support-for-udfs-in-flinks-table-api/), 2020.
- **XWK-04 · DOC** — Apache Spark. [Apache Arrow in PySpark](https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html).

## Java and native runtime integration

- **JVM-01 · DOC** — Deep Java Library. [DJL Documentation](https://docs.djl.ai/master/index.html).
- **JVM-02 · DOC** — Deep Java Library. [DJL Engine Model](https://docs.djl.ai/master/docs/engine.html).
- **JVM-03 · DOC** — Deep Java Library. [Model Loading](https://docs.djl.ai/master/docs/load_model.html).
- **JVM-04 · DOC** — ONNX Runtime. [Get Started with Java](https://onnxruntime.ai/docs/get-started/with-java.html).
- **JVM-05 · DOC** — ONNX Runtime. [High-level Design](https://onnxruntime.ai/docs/reference/high-level-design.html).
- **JVM-06 · DOC** — ONNX Runtime. [Execution Providers](https://onnxruntime.ai/docs/execution-providers/).
- **PLUGIN-01 · API** — Oracle. [ServiceLoader, Java SE 26](https://docs.oracle.com/en/java/javase/26/docs/api/java.base/java/util/ServiceLoader.html).

## Serving, lifecycle, and registry systems

- **SRV-01 · DOC** — NVIDIA. [Triton Inference Server Architecture](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/architecture.html).
- **SRV-02 · DOC** — NVIDIA. [Triton Model Management](https://docs.nvidia.com/deeplearning/triton-inference-server/archives/triton-inference-server-2280/user-guide/docs/user_guide/model_management.html).
- **SRV-03 · PAPER** — Olston, C. et al. [TensorFlow-Serving: Flexible, High-Performance ML Serving](https://research.google/pubs/tensorflow-serving-flexible-high-performance-ml-serving/), 2017.
- **SRV-04 · DOC** — Ray Project. [Ray Serve Architecture](https://docs.ray.io/en/latest/serve/architecture.html).
- **SRV-05 · DOC** — MLflow. [Model Registry](https://mlflow.org/docs/latest/ml/model-registry/).
- **SRV-06 · PAPER** — Crankshaw, D. et al. [Clipper: A Low-Latency Online Prediction Serving System](https://www.usenix.org/conference/nsdi17/technical-sessions/presentation/crankshaw), NSDI 2017.

## Intermediate representations and compilers

- **IR-01 · SPEC** — ONNX. [Open Neural Network Exchange Intermediate Representation](https://onnx.ai/onnx/repo-docs/IR.html).
- **IR-02 · SPEC** — OpenXLA. [StableHLO Specification](https://openxla.org/stablehlo/spec).
- **IR-03 · SPEC** — LLVM Project. [MLIR Language Reference](https://mlir.llvm.org/docs/LangRef/).
- **IR-04 · PAPER** — Lattner, C. et al. [MLIR: Scaling Compiler Infrastructure for Domain Specific Computation](https://arxiv.org/abs/2002.11054), 2020/2021.
- **IR-05 · PAPER** — Chen, T. et al. [TVM: An Automated End-to-End Optimizing Compiler for Deep Learning](https://www.usenix.org/conference/osdi18/presentation/chen), OSDI 2018.
- **IR-06 · PAPER** — Abadi, M. et al. [TensorFlow: Large-Scale Machine Learning on Heterogeneous Distributed Systems](https://download.tensorflow.org/paper/whitepaper2015.pdf), 2015.
- **IR-07 · SPEC** — ONNX. [Semantics of Shape Annotations](https://onnx.ai/onnx/repo-docs/ShapeAnnotationSemantics.html).

## Data exchange and RPC

- **DATA-01 · SPEC** — Apache Arrow. [The Arrow C Data Interface](https://arrow.apache.org/docs/format/CDataInterface.html).
- **DATA-02 · SPEC** — DLPack Project. [DLPack Specification](https://dmlc.github.io/dlpack/latest/).
- **DATA-03 · SPEC** — DLPack Project. [Python Array API Interchange](https://dmlc.github.io/dlpack/latest/python_spec.html).
- **WIRE-01 · DOC** — gRPC Authors. [Core Concepts](https://grpc.io/docs/what-is-grpc/core-concepts/).
- **WIRE-02 · DOC** — Protocol Buffers. [Overview](https://protobuf.dev/overview/).
- **WIRE-03 · SPEC** — Protocol Buffers. [Edition 2024 Language Guide](https://protobuf.dev/programming-guides/editions/).
- **WIRE-04 · DOC** — Protocol Buffers. [Version Support](https://protobuf.dev/support/version-support/).
- **WIRE-05 · DOC** — gRPC Authors. [Status Codes](https://grpc.io/docs/guides/status-codes/).
- **WIRE-06 · DOC** — gRPC Authors. [Deadlines](https://grpc.io/docs/guides/deadlines/).
- **WIRE-07 · DOC** — gRPC Authors. [Cancellation](https://grpc.io/docs/guides/cancellation/).

## Reproducibility and evidence

- **EVID-01 · SPEC** — SLSA. [Build Provenance, v1.2](https://slsa.dev/spec/v1.2/build-provenance).
- **EVID-02 · DOC** — Reproducible Builds. [Making Plans](https://reproducible-builds.org/docs/plans/).

## Citation policy

- These sources establish what existing projects specify or report; they do not establish JPyxis novelty or correctness.
- Version-sensitive technical decisions must cite the exact version used by the later experiment.
- Living documentation paths such as `latest` and `master` are discovery baselines only. An ADR or experiment must record the resolved project version, page revision, or source commit that informed its decision.
- Secondary articles may help discovery but cannot replace a primary source in an architecture decision.
- A future claim of comparative value requires a controlled baseline, recorded environment, and reproducible result.
- The review method and question-level use of these sources are recorded in [Review Protocol](review-protocol.md) and [Evidence Traceability](evidence-traceability.md).

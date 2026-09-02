# Primary References

Status: `M0 BIBLIOGRAPHY DRAFT`

Accessed 2026-09-02 unless noted otherwise. Links point to official specifications, project documentation, or original publication pages.

## Language interoperability and portable execution

1. Oracle. [Java Native Interface Specification, Java SE 26](https://docs.oracle.com/en/java/javase/26/docs/specs/jni/index.html).
2. JEP Project. [JEP: Java Embedded Python](https://github.com/ninia/jep).
3. GraalVM. [GraalPy Reference Manual](https://www.graalvm.org/reference-manual/graalpy/).
4. Py4J Project. [Py4J Documentation](https://www.py4j.org/contents.html).
5. Apache Beam. [Portability Framework Roadmap](https://beam.apache.org/roadmap/portability/).
6. Apache Flink. [Exploring the Thread Mode in PyFlink](https://flink.apache.org/2022/05/06/exploring-the-thread-mode-in-pyflink/), 2022.
7. Apache Flink. [Introducing Python Support for UDFs in Flink's Table API](https://flink.apache.org/2020/04/09/pyflink-introducing-python-support-for-udfs-in-flinks-table-api/), 2020.
8. Apache Spark. [Apache Arrow in PySpark](https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html).

## Java and native runtime integration

9. Deep Java Library. [DJL Documentation](https://docs.djl.ai/master/index.html).
10. Deep Java Library. [DJL Engine Model](https://docs.djl.ai/master/docs/engine.html).
11. Deep Java Library. [Model Loading](https://docs.djl.ai/master/docs/load_model.html).
12. ONNX Runtime. [Get Started with Java](https://onnxruntime.ai/docs/get-started/with-java.html).
13. ONNX Runtime. [High-level Design](https://onnxruntime.ai/docs/reference/high-level-design.html).
14. ONNX Runtime. [Execution Providers](https://onnxruntime.ai/docs/execution-providers/).

## Serving, lifecycle, and registry systems

15. NVIDIA. [Triton Inference Server Architecture](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/architecture.html).
16. NVIDIA. [Triton Model Management](https://docs.nvidia.com/deeplearning/triton-inference-server/archives/triton-inference-server-2280/user-guide/docs/user_guide/model_management.html).
17. Olston, C. et al. [TensorFlow-Serving: Flexible, High-Performance ML Serving](https://research.google/pubs/tensorflow-serving-flexible-high-performance-ml-serving/), 2017.
18. Ray Project. [Ray Serve Architecture](https://docs.ray.io/en/latest/serve/architecture.html).
19. MLflow. [Model Registry](https://mlflow.org/docs/latest/ml/model-registry/).
20. Crankshaw, D. et al. [Clipper: A Low-Latency Online Prediction Serving System](https://www.usenix.org/conference/nsdi17/technical-sessions/presentation/crankshaw), NSDI 2017.

## Intermediate representations and compilers

21. ONNX. [Open Neural Network Exchange Intermediate Representation](https://onnx.ai/onnx/repo-docs/IR.html).
22. OpenXLA. [StableHLO Specification](https://openxla.org/stablehlo/spec).
23. LLVM Project. [MLIR Language Reference](https://mlir.llvm.org/docs/LangRef/).
24. Lattner, C. et al. [MLIR: Scaling Compiler Infrastructure for Domain Specific Computation](https://arxiv.org/abs/2002.11054), 2020/2021.
25. Chen, T. et al. [TVM: An Automated End-to-End Optimizing Compiler for Deep Learning](https://www.usenix.org/conference/osdi18/presentation/chen), OSDI 2018.
26. Abadi, M. et al. [TensorFlow: Large-Scale Machine Learning on Heterogeneous Distributed Systems](https://download.tensorflow.org/paper/whitepaper2015.pdf), 2015.

## Data exchange and RPC

27. Apache Arrow. [The Arrow C Data Interface](https://arrow.apache.org/docs/format/CDataInterface.html).
28. DLPack Project. [DLPack Specification](https://dmlc.github.io/dlpack/latest/).
29. DLPack Project. [Python Array API Interchange](https://dmlc.github.io/dlpack/latest/python_spec.html).
30. gRPC Authors. [Core Concepts](https://grpc.io/docs/what-is-grpc/core-concepts/).
31. Protocol Buffers. [Overview](https://protobuf.dev/overview/).

## Citation policy

- These sources establish what existing projects specify or report; they do not establish JPyxis novelty or correctness.
- Version-sensitive technical decisions must cite the exact version used by the later experiment.
- Secondary articles may help discovery but cannot replace a primary source in an architecture decision.
- A future claim of comparative value requires a controlled baseline, recorded environment, and reproducible result.

"""M3 worker with a runtime-neutral definition and replaceable execution provider."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import platform
from concurrent import futures
from pathlib import Path
from types import ModuleType
from typing import Any

import grpc

from jpyxis_contract.parser import parse_contract
from jpyxis_contract.validation import validate_value
from jpyxis_worker.runtime_spi import (
    AFFINE_PLAN_SCHEMA,
    DefinitionPlan,
    RuntimeBinding,
    RuntimeCapability,
    RuntimeRequest,
    supports_affine_profile,
)
from jpyxis_worker.runtimes import create_runtime_registry
from jpyxis_worker.worker_common import ObservationRecorder

import jpyxis_invocation_v1_pb2 as wire
import jpyxis_invocation_v1_pb2_grpc as wire_grpc

WORKER_IDENTITY = "jpyxis.worker.python-runtime"
WORKER_VERSION = "m3-v1alpha1"


class DefinitionArtifact:
    def __init__(self, path: Path, identity: str) -> None:
        self.path = path
        self.identity = identity
        self.digest = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        self.plan: DefinitionPlan | None = None
        self.preparation_failure: str | None = None
        try:
            module = _load_module(path)
            if getattr(module, "DEFINITION_IDENTITY", None) != identity:
                raise RuntimeError("definition identity does not match the selected artifact")
            describe = getattr(module, "describe", None)
            if not callable(describe):
                raise RuntimeError("definition does not expose describe")
            description = describe()
            if not isinstance(description, dict) or set(description) != {
                "schemaVersion", "operationIdentity"
            }:
                raise RuntimeError("definition plan shape is outside the M3 profile")
            if not all(isinstance(value, str) for value in description.values()):
                raise RuntimeError("definition plan values must be strings")
            if description["schemaVersion"] != AFFINE_PLAN_SCHEMA:
                raise RuntimeError("definition plan schema is unsupported")
            self.plan = DefinitionPlan(
                schema_version=description["schemaVersion"],
                operation_identity=description["operationIdentity"],
            )
        except Exception as error:  # stable envelope owns public meaning
            self.preparation_failure = type(error).__name__


class RuntimeInvocationWorker(wire_grpc.InvocationWorkerServicer):
    def __init__(
        self,
        contract_path: Path,
        definition_path: Path,
        definition_identity: str,
        runtime_provider: str,
        recorder: ObservationRecorder,
        fault_mode: str,
    ) -> None:
        self.contract = parse_contract(contract_path)
        self.definition = DefinitionArtifact(definition_path, definition_identity)
        self.provider = create_runtime_registry().resolve(runtime_provider)
        self.recorder = recorder
        self.fault_mode = fault_mode

    def Probe(
        self, request: wire.TransportProbeRequest, context: grpc.ServicerContext
    ) -> wire.TransportProbeReport:
        del request, context
        binding = self._advertised_binding()
        self.recorder.record(
            "RUNTIME_CAPABILITY_ADVERTISED",
            details={
                "runtimeIdentity": binding.runtime_identity,
                "capabilityIdentity": binding.capability.capability_identity,
            },
        )
        return _probe_report(binding)

    def Invoke(self, request: wire.InvokeRequest, context: grpc.ServicerContext) -> wire.WorkerReport:
        del context
        coordinates = request.coordinates
        self.recorder.record("WORKER_REQUEST_OBSERVED", coordinates)

        coordinate_error = self._coordinate_error(coordinates)
        if coordinate_error is not None:
            self.recorder.record(
                "WORKER_INPUT_REJECTED", coordinates, {"code": coordinate_error}
            )
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_CONTRACT,
                "WORKER_CONTRACT_REJECTED",
                coordinate_error,
                "PYTHON_DEFINITION_BOUNDARY",
                "worker-coordinate-validation",
            )

        binding_error = self._binding_error(coordinates)
        if binding_error is not None:
            self.recorder.record(
                "RUNTIME_BINDING_REJECTED", coordinates, {"code": binding_error}
            )
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_RUNTIME,
                "RUNTIME_BINDING_MISMATCH",
                "The pinned runtime binding no longer matches the worker provider",
                "RUNTIME_REGISTRY",
                "runtime-binding-validation",
            )

        canonical_input = _input_to_canonical(request.input)
        validation = validate_value(self.contract.operation.input, canonical_input)
        if not validation.accepted:
            self.recorder.record(
                "WORKER_INPUT_REJECTED", coordinates, {"code": validation.code}
            )
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_CONTRACT,
                "WORKER_CONTRACT_REJECTED",
                validation.code,
                "CONTRACT_CORE_PYTHON_BINDING",
                "worker-input-validation",
            )
        self.recorder.record(
            "WORKER_INPUT_VALIDATED", coordinates, {"bindings": dict(validation.bindings)}
        )

        if self.definition.preparation_failure is not None or self.definition.plan is None:
            self.recorder.record("DEFINITION_PREPARATION_FAILED", coordinates)
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_DEFINITION,
                "DEFINITION_PREPARATION_FAILED",
                "The selected definition artifact could not be prepared",
                "PYTHON_DEFINITION_CAPABILITY",
                "definition-preparation",
            )

        if not supports_affine_profile(self.provider.binding, self.definition.plan):
            self.recorder.record("RUNTIME_CAPABILITY_REJECTED", coordinates)
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_RUNTIME,
                "RUNTIME_CAPABILITY_UNSUPPORTED",
                "The selected runtime does not satisfy the definition requirement",
                "RUNTIME_REGISTRY",
                "runtime-capability-resolution",
            )

        tensor = canonical_input["values"]
        runtime_request = RuntimeRequest(
            definition=self.definition.plan,
            shape=tuple(tensor["shape"]),
            values=tuple(float(value) for value in tensor["values"]),
            scale=float(canonical_input["scale"]),
            bias=float(canonical_input["bias"]),
        )
        self.recorder.record(
            "RUNTIME_STARTED",
            coordinates,
            {"runtimeIdentity": self.provider.binding.runtime_identity},
        )
        try:
            if self.fault_mode == "runtime_failure":
                raise RuntimeError("intentional M3 runtime failure")
            result = self.provider.execute(runtime_request)
        except Exception as error:
            self.recorder.record(
                "RUNTIME_FAILED", coordinates, {"diagnosticType": type(error).__name__}
            )
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_RUNTIME,
                "RUNTIME_EXECUTION_FAILED",
                "The selected runtime failed during execution",
                "RUNTIME_PROVIDER",
                "runtime-execution",
            )

        self.recorder.record("RUNTIME_COMPLETED", coordinates)
        output = wire.AffineOutput(
            values=wire.TensorValue(
                dtype=wire.DTYPE_FLOAT32,
                shape=result.shape,
                layout=wire.LAYOUT_ROW_MAJOR,
                float_values=result.values,
            ),
            rows=result.shape[0],
        )
        self.recorder.record("WORKER_REPORT_EMITTED", coordinates, {"observation": "OUTPUT"})
        return self._report(coordinates, output=output)

    def _advertised_binding(self) -> RuntimeBinding:
        binding = self.provider.binding
        if self.fault_mode != "incompatible_capability":
            return binding
        return RuntimeBinding(
            runtime_identity=binding.runtime_identity,
            runtime_version=binding.runtime_version,
            capability=RuntimeCapability(
                capability_identity="jpyxis.capability/incompatible-fixture",
                capability_version="1",
                operation_identity="jpyxis.operation/incompatible@1",
                dtypes=("float32",),
                layouts=("ROW_MAJOR",),
            ),
        )

    def _coordinate_error(self, coordinates: Any) -> str | None:
        expected = {
            "contract_identity": self.contract.identity,
            "contract_digest": self.contract.digest,
            "definition_identity": self.definition.identity,
            "definition_digest": self.definition.digest,
        }
        for name, value in expected.items():
            if getattr(coordinates, name) != value:
                return f"{name} mismatch"
        if not coordinates.invocation_id or not coordinates.attempt_id or not coordinates.trace_id:
            return "invocation, attempt, and trace identities are required"
        return None

    def _binding_error(self, coordinates: Any) -> str | None:
        binding = self.provider.binding
        expected = {
            "runtime_identity": binding.runtime_identity,
            "runtime_version": binding.runtime_version,
            "runtime_capability_identity": binding.capability.capability_identity,
            "runtime_capability_version": binding.capability.capability_version,
        }
        if self.fault_mode == "runtime_binding_mismatch":
            expected["runtime_version"] = f"{binding.runtime_version}-changed"
        for name, value in expected.items():
            if getattr(coordinates, name) != value:
                return f"{name} mismatch"
        return None

    def _failure(
        self,
        coordinates: Any,
        category: int,
        code: str,
        summary: str,
        origin_layer: str,
        causal_reference: str,
    ) -> wire.WorkerReport:
        self.recorder.record(
            "WORKER_REPORT_EMITTED", coordinates, {"observation": "FAILURE", "code": code}
        )
        return self._report(
            coordinates,
            failure=wire.WorkerFailure(
                category=category,
                code=code,
                summary=summary,
                retryable=False,
                origin_layer=origin_layer,
                causal_reference=causal_reference,
            ),
        )

    def _report(
        self,
        coordinates: Any,
        *,
        output: wire.AffineOutput | None = None,
        failure: wire.WorkerFailure | None = None,
    ) -> wire.WorkerReport:
        observed = wire.InvocationCoordinates()
        observed.CopyFrom(coordinates)
        binding = self.provider.binding
        report = wire.WorkerReport(
            observed_coordinates=observed,
            worker_identity=WORKER_IDENTITY,
            worker_version=WORKER_VERSION,
            runtime_identity=binding.runtime_identity,
            runtime_version=binding.runtime_version,
        )
        if output is not None:
            report.output.CopyFrom(output)
        if failure is not None:
            report.failure.CopyFrom(failure)
        return report


def _load_module(path: Path) -> ModuleType:
    specification = importlib.util.spec_from_file_location("jpyxis_m3_definition", path)
    if specification is None or specification.loader is None:
        raise RuntimeError("definition module has no loader")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def _probe_report(binding: RuntimeBinding) -> wire.TransportProbeReport:
    capability = binding.capability
    dtype_by_name = {"float32": wire.DTYPE_FLOAT32, "int32": wire.DTYPE_INT32}
    layout_by_name = {"ROW_MAJOR": wire.LAYOUT_ROW_MAJOR}
    return wire.TransportProbeReport(
        worker_identity=WORKER_IDENTITY,
        worker_version=WORKER_VERSION,
        runtime_identity=binding.runtime_identity,
        runtime_version=binding.runtime_version,
        runtime_capability_identity=capability.capability_identity,
        runtime_capability_version=capability.capability_version,
        operation_identity=capability.operation_identity,
        supported_dtypes=[dtype_by_name[item] for item in capability.dtypes],
        supported_layouts=[layout_by_name[item] for item in capability.layouts],
    )


def _input_to_canonical(value: wire.AffineInput) -> dict[str, Any]:
    tensor = value.values
    dtype = "float32" if tensor.dtype == wire.DTYPE_FLOAT32 else "int32"
    layout = "ROW_MAJOR" if tensor.layout == wire.LAYOUT_ROW_MAJOR else "UNSPECIFIED"
    values = list(tensor.float_values) if tensor.dtype == wire.DTYPE_FLOAT32 else list(tensor.int_values)
    return {
        "values": {
            "dtype": dtype,
            "shape": list(tensor.shape),
            "layout": layout,
            "values": values,
        },
        "scale": value.scale,
        "bias": value.bias,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--definition", type=Path, required=True)
    parser.add_argument("--definition-identity", required=True)
    parser.add_argument("--runtime-provider", required=True)
    parser.add_argument("--observations", type=Path, required=True)
    parser.add_argument(
        "--fault-mode",
        choices=(
            "normal",
            "incompatible_capability",
            "runtime_binding_mismatch",
            "runtime_failure",
        ),
        default="normal",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    recorder = ObservationRecorder(
        arguments.observations,
        "jpyxis.io/m3-observation/v1alpha1",
    )
    try:
        worker = RuntimeInvocationWorker(
            arguments.contract,
            arguments.definition,
            arguments.definition_identity,
            arguments.runtime_provider,
            recorder,
            arguments.fault_mode,
        )
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
        wire_grpc.add_InvocationWorkerServicer_to_server(worker, server)
        bound_port = server.add_insecure_port(f"127.0.0.1:{arguments.port}")
        if bound_port == 0:
            raise RuntimeError("worker could not bind the requested loopback port")
        recorder.record(
            "WORKER_LISTENING",
            details={
                "port": bound_port,
                "python": platform.python_version(),
                "runtime": worker.provider.binding.runtime_identity,
                "recorderHealthy": recorder.healthy,
            },
        )
        server.start()
        server.wait_for_termination()
        return 0
    finally:
        recorder.close()


if __name__ == "__main__":
    raise SystemExit(main())

"""Separate-process M2 Python worker for the affine reference slice."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
import platform
import sys
import threading
import time
from concurrent import futures
from pathlib import Path
from types import ModuleType
from typing import Any

import grpc
import numpy as np

from jpyxis_contract.parser import parse_contract
from jpyxis_contract.validation import validate_value

import jpyxis_invocation_v1_pb2 as wire
import jpyxis_invocation_v1_pb2_grpc as wire_grpc

WORKER_IDENTITY = "jpyxis.worker.python-affine"
WORKER_VERSION = "m2-v1alpha1"
RUNTIME_IDENTITY = "numpy.cpu"


class ObservationRecorder:
    def __init__(self, path: Path) -> None:
        self._sequence = 0
        self._lock = threading.Lock()
        self._healthy = True
        self._failure: str | None = None
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._stream = path.open("w", encoding="utf-8", newline="\n")
        except OSError as error:
            self._stream = None
            self._healthy = False
            self._failure = type(error).__name__

    @property
    def healthy(self) -> bool:
        return self._healthy

    @property
    def failure(self) -> str | None:
        return self._failure

    def record(
        self,
        event: str,
        coordinates: Any | None = None,
        details: dict[str, Any] | None = None,
        *,
        late: bool = False,
    ) -> None:
        with self._lock:
            if not self._healthy or self._stream is None:
                return
            self._sequence += 1
            item = {
                "schemaVersion": "jpyxis.io/m2-observation/v1alpha1",
                "sequence": self._sequence,
                "observedAt": _utc_now(),
                "source": "WORKER",
                "event": event,
                "late": late,
                "invocationId": getattr(coordinates, "invocation_id", ""),
                "attemptId": getattr(coordinates, "attempt_id", ""),
                "traceId": getattr(coordinates, "trace_id", ""),
                "details": details or {},
            }
            try:
                self._stream.write(json.dumps(item, separators=(",", ":"), sort_keys=True))
                self._stream.write("\n")
                self._stream.flush()
            except OSError as error:
                self._healthy = False
                self._failure = type(error).__name__

    def close(self) -> None:
        if self._stream is None:
            return
        try:
            self._stream.close()
        except OSError as error:
            self._healthy = False
            self._failure = type(error).__name__


class DefinitionArtifact:
    def __init__(self, path: Path, identity: str) -> None:
        self.path = path
        self.identity = identity
        self.digest = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        self.module: ModuleType | None = None
        self.preparation_failure: str | None = None
        try:
            specification = importlib.util.spec_from_file_location("jpyxis_m2_definition", path)
            if specification is None or specification.loader is None:
                raise RuntimeError("definition module has no loader")
            module = importlib.util.module_from_spec(specification)
            specification.loader.exec_module(module)
            declared_identity = getattr(module, "DEFINITION_IDENTITY", None)
            if declared_identity != identity:
                raise RuntimeError("definition identity does not match the selected artifact")
            if not callable(getattr(module, "execute", None)):
                raise RuntimeError("definition does not expose execute")
            self.module = module
        except Exception as error:  # boundary converts diagnostics into a stable report
            self.preparation_failure = type(error).__name__

    def execute(self, values: np.ndarray, scale: np.float32, bias: np.float32) -> np.ndarray:
        if self.module is None:
            raise RuntimeError("definition is not prepared")
        return self.module.execute(values, scale, bias)


class InvocationWorker(wire_grpc.InvocationWorkerServicer):
    def __init__(
        self,
        contract_path: Path,
        definition_path: Path,
        definition_identity: str,
        recorder: ObservationRecorder,
        fault_mode: str,
        delay_ms: int,
    ) -> None:
        self.contract = parse_contract(contract_path)
        self.definition = DefinitionArtifact(definition_path, definition_identity)
        self.recorder = recorder
        self.fault_mode = fault_mode
        self.delay_ms = delay_ms

    def Probe(
        self, request: wire.TransportProbeRequest, context: grpc.ServicerContext
    ) -> wire.TransportProbeReport:
        self.recorder.record("TRANSPORT_PROBED")
        return wire.TransportProbeReport(
            worker_identity=WORKER_IDENTITY,
            worker_version=WORKER_VERSION,
            runtime_identity=RUNTIME_IDENTITY,
            runtime_version=np.__version__,
        )

    def Invoke(self, request: wire.InvokeRequest, context: grpc.ServicerContext) -> wire.WorkerReport:
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

        if self.definition.preparation_failure is not None:
            self.recorder.record(
                "DEFINITION_PREPARATION_FAILED",
                coordinates,
                {"diagnosticType": self.definition.preparation_failure},
            )
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_DEFINITION,
                "DEFINITION_PREPARATION_FAILED",
                "The selected definition artifact could not be prepared",
                "PYTHON_DEFINITION_CAPABILITY",
                "definition-preparation",
            )

        if self.fault_mode == "invalid_failure":
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_UNSPECIFIED,
                "UNTRUSTED_WORKER_CODE",
                "This worker-controlled message must not become public API",
                "",
                "",
            )

        if self.fault_mode == "terminate":
            self.recorder.record("WORKER_TERMINATING", coordinates)
            self.recorder.close()
            os._exit(86)

        cancellation_observed = self._delay_and_observe_cancellation(context, coordinates)
        self.recorder.record("RUNTIME_STARTED", coordinates)
        try:
            if self.fault_mode == "runtime_failure":
                raise RuntimeError("intentional M2 runtime failure")
            shape = tuple(request.input.values.shape)
            values = np.asarray(request.input.values.float_values, dtype=np.float32).reshape(shape)
            result = self.definition.execute(
                values, np.float32(request.input.scale), np.float32(request.input.bias)
            )
            if not isinstance(result, np.ndarray):
                raise TypeError("definition result is not an ndarray")
            result = np.asarray(result, dtype=np.float32)
        except Exception as error:  # runtime diagnostics remain behind a stable envelope
            self.recorder.record(
                "RUNTIME_FAILED", coordinates, {"diagnosticType": type(error).__name__}
            )
            return self._failure(
                coordinates,
                wire.WORKER_FAILURE_CATEGORY_RUNTIME,
                "RUNTIME_EXECUTION_FAILED",
                "The selected runtime failed during execution",
                "NUMPY_RUNTIME",
                "runtime-execution",
            )

        self.recorder.record(
            "RUNTIME_COMPLETED",
            coordinates,
            {"cancellationObserved": cancellation_observed},
            late=cancellation_observed,
        )
        output_shape = list(result.shape)
        rows = output_shape[0]
        if self.fault_mode == "malformed_output":
            rows += 1
        output = wire.AffineOutput(
            values=wire.TensorValue(
                dtype=wire.DTYPE_FLOAT32,
                shape=output_shape,
                layout=wire.LAYOUT_ROW_MAJOR,
                float_values=result.reshape(-1).tolist(),
            ),
            rows=rows,
        )
        self.recorder.record(
            "WORKER_REPORT_EMITTED", coordinates, {"observation": "OUTPUT"}, late=cancellation_observed
        )
        return self._report(coordinates, output=output)

    def _delay_and_observe_cancellation(
        self, context: grpc.ServicerContext, coordinates: Any
    ) -> bool:
        if self.delay_ms <= 0:
            return not context.is_active()
        end = time.monotonic() + self.delay_ms / 1000
        cancellation_observed = False
        while time.monotonic() < end:
            if not context.is_active() and not cancellation_observed:
                cancellation_observed = True
                self.recorder.record("CANCELLATION_OBSERVED", coordinates)
            time.sleep(min(0.01, max(0, end - time.monotonic())))
        return cancellation_observed

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

    def _failure(
        self,
        coordinates: Any,
        category: int,
        code: str,
        summary: str,
        origin_layer: str,
        causal_reference: str,
    ) -> wire.WorkerReport:
        self.recorder.record("WORKER_REPORT_EMITTED", coordinates, {"observation": "FAILURE", "code": code})
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
        observed_coordinates = wire.InvocationCoordinates()
        observed_coordinates.CopyFrom(coordinates)
        if self.fault_mode == "mismatched_coordinates":
            observed_coordinates.trace_id = f"{coordinates.trace_id}-mismatch"
        report = wire.WorkerReport(
            observed_coordinates=observed_coordinates,
            worker_identity=WORKER_IDENTITY,
            worker_version=WORKER_VERSION,
            runtime_identity=RUNTIME_IDENTITY,
            runtime_version=np.__version__,
        )
        if output is not None:
            report.output.CopyFrom(output)
        if failure is not None:
            report.failure.CopyFrom(failure)
        return report


def _input_to_canonical(value: wire.AffineInput) -> dict[str, Any]:
    tensor = value.values
    dtype = "float32" if tensor.dtype == wire.DTYPE_FLOAT32 else "int32"
    layout = "ROW_MAJOR" if tensor.layout == wire.LAYOUT_ROW_MAJOR else "UNSPECIFIED"
    values: list[float] | list[int]
    if tensor.dtype == wire.DTYPE_FLOAT32:
        values = list(tensor.float_values)
    else:
        values = list(tensor.int_values)
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


def _utc_now() -> str:
    milliseconds = math.floor(time.time() * 1000)
    seconds, fraction = divmod(milliseconds, 1000)
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(seconds)) + f".{fraction:03d}Z"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--definition", type=Path, required=True)
    parser.add_argument("--definition-identity", required=True)
    parser.add_argument("--observations", type=Path, required=True)
    parser.add_argument(
        "--fault-mode",
        choices=(
            "normal",
            "invalid_failure",
            "malformed_output",
            "mismatched_coordinates",
            "runtime_failure",
            "terminate",
        ),
        default="normal",
    )
    parser.add_argument("--delay-ms", type=int, default=0)
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    recorder = ObservationRecorder(arguments.observations)
    try:
        worker = InvocationWorker(
            arguments.contract,
            arguments.definition,
            arguments.definition_identity,
            recorder,
            arguments.fault_mode,
            arguments.delay_ms,
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
                "runtime": np.__version__,
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

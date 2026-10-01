"""Bounded outer carrier around the frozen M2/M3 worker; emits execution facts only."""
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.metadata
import json
import os
import platform
import struct
import sys
import threading
import time
from concurrent import futures
from pathlib import Path

import grpc
from google.protobuf.json_format import MessageToDict
from jpyxis_worker.m3_server import RuntimeInvocationWorker
from jpyxis_worker.runtime_spi import RuntimeResult
from jpyxis_worker.worker_common import ObservationRecorder
import jpyxis_invocation_v1_pb2_grpc as wire_grpc


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def digest(value):
    return "sha256:" + hashlib.sha256(value).hexdigest()


class SourceFacts:
    def __init__(self, path):
        self.stream = path.open("w", encoding="utf-8", newline="\n")
        self.lock = threading.Lock()
        self.sequence = 0

    def record(self, event, **details):
        with self.lock:
            self.sequence += 1
            item = {"schemaVersion": "jpyxis.io/reference-worker-source/v1alpha1",
                "sequence": self.sequence, "observedUnixNanos": time.time_ns(), "owner": "EXECUTION",
                "event": event, "pid": os.getpid(), "details": details}
            self.stream.write(json.dumps(item, sort_keys=True, separators=(",", ":")) + "\n")
            self.stream.flush()
            return item


def actual_facts(worker, descriptor):
    import numpy as np
    from google import protobuf
    binding = worker.provider.binding
    closure = {name: digest(base64.b64decode(content)) for name, content in descriptor["requirementsBytes"].items()}
    environment = {"schemaVersion": "jpyxis.io/reference-environment/v1alpha1",
        "pythonImplementation": platform.python_implementation(),
        "pythonMajorMinor": f"{sys.version_info.major}.{sys.version_info.minor}",
        "platform": sys.platform, "architecture": platform.machine(),
        "requirementsClosureDigest": digest(canonical(closure)),
        "runtimePackages": {"numpy": np.__version__, "grpcio": grpc.__version__, "protobuf": protobuf.__version__}}
    plan = worker.definition.plan
    return {"environment": environment, "pythonFullVersion": platform.python_version(),
        "executable": sys.executable,
        "moduleOrigins": {"numpy": np.__file__, "grpcio": grpc.__file__, "protobuf": protobuf.__file__},
        "installedRuntimePackages": {name: importlib.metadata.version(name) for name in ("numpy", "grpcio", "protobuf")},
        "contractIdentity": worker.contract.identity,
        "contractDigest": worker.contract.digest, "definitionIdentity": worker.definition.identity,
        "definitionDigest": worker.definition.digest,
        "definitionPlan": None if plan is None else {"schemaVersion": plan.schema_version, "operationIdentity": plan.operation_identity},
        "preparationFailure": worker.definition.preparation_failure,
        "runtimeBinding": {"runtimeIdentity": binding.runtime_identity, "runtimeVersion": binding.runtime_version,
            "capabilityIdentity": binding.capability.capability_identity, "capabilityVersion": binding.capability.capability_version}}


class WitnessProvider:
    def __init__(self, inner, root, facts):
        self.inner, self.root, self.facts = inner, root, facts

    @property
    def binding(self):
        return self.inner.binding

    def execute(self, request):
        command_path = self.root / "execution-control.json"
        command = json.loads(command_path.read_text()) if command_path.exists() else {}
        mode = command.get("mode", "normal")
        self.facts.record("ACTUAL_RUNTIME_ENTERED", mode=mode)
        (self.root / "runtime-entered.json").write_bytes(canonical({"pid": os.getpid(), "mode": mode}))
        if mode == "crash":
            os._exit(43)
        if mode == "wait":
            until = time.monotonic() + 15
            while not (self.root / "release-execution").exists():
                if time.monotonic() >= until:
                    raise RuntimeError("bounded witness barrier expired")
                time.sleep(0.01)
            self.facts.record("ACTUAL_RUNTIME_RELEASED")
        result = self.inner.execute(request)
        if mode == "wrong_result":
            return RuntimeResult(shape=result.shape, values=tuple(v + 100 for v in result.values))
        return result


class BoundWorker(RuntimeInvocationWorker):
    def __init__(self, descriptor, root, recorder, facts):
        super().__init__(root / "contract.json", root / "definition.py", descriptor["definitionIdentity"],
            descriptor.get("runtimeProvider", "numpy.cpu"), recorder, "normal", contract_snapshot=base64.b64decode(descriptor["contractBytes"]),
            definition_snapshot=base64.b64decode(descriptor["definitionBytes"]))
        self.descriptor, self.facts, self.root = descriptor, facts, root
        self.actual = actual_facts(self, descriptor)
        self.provider = WitnessProvider(self.provider, root, facts)

    def Invoke(self, request, context):
        header = dict(context.invocation_metadata()).get("jpyxis-reference-association", "")
        try:
            association = json.loads(header)
            if association["schemaVersion"] != "jpyxis.io/reference-dispatch/v1alpha1":
                raise ValueError("association schema")
            realization = association["realization"]
            for name in ("deploymentId", "workerId", "instanceId", "controlEpoch", "launchNonce", "operandsDigest"):
                if realization[name] != self.descriptor[name]:
                    raise ValueError("launch association " + name)
            if realization["processId"] != os.getpid() or realization["runtimeBinding"] != self.actual["runtimeBinding"]:
                raise ValueError("actual launch/binding")
            if realization["environmentDigest"] != digest(canonical(self.actual["environment"])):
                raise ValueError("actual environment")
            expected = association["m2"]["coordinates"]
            c = request.coordinates
            for key, attr in (("contractIdentity", "contract_identity"), ("definitionIdentity", "definition_identity"),
                    ("invocationId", "invocation_id"), ("attemptId", "attempt_id"), ("traceId", "trace_id")):
                if expected[key] != getattr(c, attr):
                    raise ValueError("M2 coordinate " + key)
            for key, attr in (("contractDigest", "contract_digest"), ("definitionDigest", "definition_digest")):
                if association["m2"][key] != getattr(c, attr):
                    raise ValueError("M2 digest " + key)
            original_input = association["m2"]["input"]
            if (original_input["values"]["shape"] != list(request.input.values.shape)
                    or [struct.unpack("<f", struct.pack("<f", value))[0] for value in original_input["values"]["values"]] != list(request.input.values.float_values)
                    or struct.unpack("<f", struct.pack("<f", original_input["scale"]))[0] != request.input.scale
                    or struct.unpack("<f", struct.pack("<f", original_input["bias"]))[0] != request.input.bias):
                raise ValueError("M2 typed input")
            if association["purpose"] == "PRODUCT":
                pin, plan = association["pin"], association["plan"]
                if pin["deploymentId"] != realization["deploymentId"] or pin["invocationId"] != plan["logicalInvocationId"]:
                    raise ValueError("pin-plan association")
                for name in ("workerId", "instanceId", "controlEpoch", "processId"):
                    if plan["worker"][name] != realization[name]:
                        raise ValueError("plan realization " + name)
        except (ValueError, KeyError, TypeError) as error:
            self.facts.record("OUTER_REQUEST_REJECTED", reason=str(error), metadata=header)
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "launch association rejected")
        self.facts.record("OUTER_REQUEST_ADMITTED", association=association)
        report = super().Invoke(request, context)
        fact = self.facts.record("BOUND_REPORT_RETAINED", association=association,
            associationBytesBase64=base64.b64encode(header.encode("utf-8")).decode(),
            report=MessageToDict(report, preserving_proto_field_name=True),
            wireReportBase64=base64.b64encode(report.SerializeToString()).decode(), callerStillWaiting=context.is_active())
        report_path = self.root / ("retained-report-" + request.coordinates.attempt_id + ".json")
        temporary = report_path.with_suffix(".tmp")
        temporary.write_bytes(canonical(fact))
        os.replace(temporary, report_path)
        context.set_trailing_metadata((("jpyxis-reference-association-digest", digest(header.encode("utf-8"))),))
        return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("descriptor", type=Path)
    parser.add_argument("--probe", action="store_true")
    args = parser.parse_args()
    descriptor = json.loads(args.descriptor.read_bytes())
    root = args.descriptor.parent
    if args.probe:
        root = root / "independent-probe"
        root.mkdir()
    facts = SourceFacts(root / "worker-source.jsonl")
    recorder = ObservationRecorder(root / "m3-observations.jsonl")
    worker = BoundWorker(descriptor, root, recorder, facts)
    observed = {"pid": os.getpid(), "launchNonce": descriptor["launchNonce"], "actual": worker.actual}
    facts.record("PROCESS_OPERANDS_OBSERVED", **observed)
    (root / "worker-facts.json").write_bytes(canonical(observed))
    if args.probe:
        recorder.close()
        return
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    wire_grpc.add_InvocationWorkerServicer_to_server(worker, server)
    port = server.add_insecure_port("127.0.0.1:0")
    if port == 0:
        raise RuntimeError("local transport bind failed")
    server.start()
    facts.record("TRANSPORT_LISTENING", port=port)
    (root / "transport-address.json").write_bytes(canonical({"port": port, "pid": os.getpid()}))
    server.wait_for_termination()


if __name__ == "__main__":
    main()

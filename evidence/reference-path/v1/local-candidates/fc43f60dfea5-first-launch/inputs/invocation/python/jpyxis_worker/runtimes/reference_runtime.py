"""Dependency-free scalar reference runtime for M3 replacement evidence."""

from __future__ import annotations

import platform
import struct

from jpyxis_worker.runtime_spi import (
    AFFINE_CAPABILITY_IDENTITY,
    AFFINE_CAPABILITY_VERSION,
    AFFINE_OPERATION_IDENTITY,
    RuntimeBinding,
    RuntimeCapability,
    RuntimeRequest,
    RuntimeResult,
    supports_affine_profile,
)


def _float32(value: float) -> float:
    return struct.unpack("!f", struct.pack("!f", value))[0]


class ReferenceRuntimeProvider:
    @property
    def binding(self) -> RuntimeBinding:
        return RuntimeBinding(
            runtime_identity="python.reference",
            runtime_version=platform.python_version(),
            capability=RuntimeCapability(
                capability_identity=AFFINE_CAPABILITY_IDENTITY,
                capability_version=AFFINE_CAPABILITY_VERSION,
                operation_identity=AFFINE_OPERATION_IDENTITY,
                dtypes=("float32",),
                layouts=("ROW_MAJOR",),
            ),
        )

    def execute(self, request: RuntimeRequest) -> RuntimeResult:
        if not supports_affine_profile(self.binding, request.definition):
            raise ValueError("definition plan is not supported by this runtime")
        scale = _float32(request.scale)
        bias = _float32(request.bias)
        result = tuple(
            _float32(_float32(_float32(value) * scale) + bias)
            for value in request.values
        )
        return RuntimeResult(shape=request.shape, values=result)

"""NumPy-backed runtime provider; NumPy values do not leave this module."""

from __future__ import annotations

import numpy as np

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


class NumPyRuntimeProvider:
    @property
    def binding(self) -> RuntimeBinding:
        return RuntimeBinding(
            runtime_identity="numpy.cpu",
            runtime_version=np.__version__,
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
        values = np.asarray(request.values, dtype=np.float32).reshape(request.shape)
        result = np.add(
            np.multiply(values, np.float32(request.scale), dtype=np.float32),
            np.float32(request.bias),
            dtype=np.float32,
        )
        return RuntimeResult(
            shape=tuple(int(dimension) for dimension in result.shape),
            values=tuple(float(value) for value in result.reshape(-1).tolist()),
        )

"""Runtime-provider composition root for the bounded single-node profile."""

from __future__ import annotations

from jpyxis_worker.runtime_spi import RuntimeRegistry
from jpyxis_worker.runtimes.numpy_runtime import NumPyRuntimeProvider
from jpyxis_worker.runtimes.reference_runtime import ReferenceRuntimeProvider


def create_runtime_registry() -> RuntimeRegistry:
    return RuntimeRegistry((NumPyRuntimeProvider(), ReferenceRuntimeProvider()))


__all__ = ["create_runtime_registry"]

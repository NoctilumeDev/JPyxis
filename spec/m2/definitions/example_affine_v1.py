"""Pinned M2 definition artifact for the deterministic affine reference workload."""

from __future__ import annotations

import numpy as np

DEFINITION_IDENTITY = "jpyxis:definition:example/affine-batch@1.0.0"


def execute(values: np.ndarray, scale: np.float32, bias: np.float32) -> np.ndarray:
    """Return the stateless affine transform using explicit float32 operations."""
    return np.add(np.multiply(values, scale, dtype=np.float32), bias, dtype=np.float32)

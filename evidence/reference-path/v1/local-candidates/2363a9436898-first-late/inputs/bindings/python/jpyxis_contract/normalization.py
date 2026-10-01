"""Typed value projection used to compare Java and Python M1 round trips."""

from __future__ import annotations

import struct

from .model import RawJsonValue, RecordSpec, ScalarSpec, TensorSpec, TypeSpec


def normalize_value(type_spec: TypeSpec, value: RawJsonValue) -> RawJsonValue:
    if isinstance(type_spec, ScalarSpec):
        return int(value) if type_spec.scalar_type == "int32" else _float32(value)
    if isinstance(type_spec, RecordSpec):
        return {
            field.name: normalize_value(field.type_spec, value[field.name])
            for field in type_spec.fields
            if field.name in value
        }
    if isinstance(type_spec, TensorSpec):
        normalize_element = int if type_spec.dtype == "int32" else _float32
        return {
            "dtype": type_spec.dtype,
            "shape": [int(size) for size in value["shape"]],
            "layout": type_spec.layout,
            "values": [normalize_element(item) for item in value["values"]],
        }
    raise TypeError(f"Unhandled type: {type_spec!r}")


def _float32(value: RawJsonValue) -> float:
    return struct.unpack("!f", struct.pack("!f", float(value)))[0]

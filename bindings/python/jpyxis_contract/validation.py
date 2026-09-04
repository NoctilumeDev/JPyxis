"""Value validation for the independent Python binding."""

from __future__ import annotations

import math

from .model import RawJsonValue, RecordSpec, ScalarSpec, TensorSpec, TypeSpec, ValidationResult

FLOAT32_MAX = 3.4028234663852886e38


def validate_value(
    type_spec: TypeSpec,
    value: RawJsonValue,
    initial_bindings: dict[str, int] | None = None,
) -> ValidationResult:
    bindings = dict(sorted((initial_bindings or {}).items()))
    code = _validate(type_spec, value, bindings)
    return ValidationResult.accept(bindings) if code is None else ValidationResult.reject(code, bindings)


def _validate(type_spec: TypeSpec, value: RawJsonValue, bindings: dict[str, int]) -> str | None:
    if isinstance(type_spec, ScalarSpec):
        return _validate_scalar(type_spec, value, bindings)
    if isinstance(type_spec, RecordSpec):
        return _validate_record(type_spec, value, bindings)
    if isinstance(type_spec, TensorSpec):
        return _validate_tensor(type_spec, value, bindings)
    raise TypeError(f"Unhandled type: {type_spec!r}")


def _validate_scalar(
    type_spec: ScalarSpec, value: RawJsonValue, bindings: dict[str, int]
) -> str | None:
    if type_spec.scalar_type == "int32":
        if type(value) is not int:
            return "VALUE_TYPE_MISMATCH"
        if value < -2_147_483_648 or value > 2_147_483_647:
            return "VALUE_SCALAR_OUT_OF_RANGE"
        if type_spec.equals_symbol is not None:
            expected = bindings.get(type_spec.equals_symbol)
            if expected is None or expected != value:
                return "SYMBOL_BINDING_MISMATCH"
        return None

    if type(value) not in {int, float}:
        return "VALUE_TYPE_MISMATCH"
    observed = float(value)
    if type_spec.finite and not math.isfinite(observed):
        return "VALUE_NON_FINITE"
    if math.isfinite(observed) and abs(observed) > FLOAT32_MAX:
        return "VALUE_SCALAR_OUT_OF_RANGE"
    return None


def _validate_record(
    type_spec: RecordSpec, value: RawJsonValue, bindings: dict[str, int]
) -> str | None:
    if not isinstance(value, dict):
        return "VALUE_TYPE_MISMATCH"
    known = {field.name for field in type_spec.fields}
    if set(value) - known:
        return "VALUE_UNKNOWN_FIELD"
    for field in type_spec.fields:
        if field.name not in value:
            if field.required:
                return "VALUE_MISSING_FIELD"
            continue
        code = _validate(field.type_spec, value[field.name], bindings)
        if code is not None:
            return code
    return None


def _validate_tensor(
    type_spec: TensorSpec, value: RawJsonValue, bindings: dict[str, int]
) -> str | None:
    if not isinstance(value, dict):
        return "VALUE_TYPE_MISMATCH"
    expected_keys = {"dtype", "shape", "layout", "values"}
    if set(value) - expected_keys:
        return "VALUE_UNKNOWN_FIELD"
    if not expected_keys.issubset(value):
        return "VALUE_MISSING_FIELD"
    if value["dtype"] != type_spec.dtype:
        return "TENSOR_DTYPE_MISMATCH"
    if value["layout"] != type_spec.layout:
        return "TENSOR_LAYOUT_MISMATCH"
    shape = value["shape"]
    if not isinstance(shape, list):
        return "VALUE_TYPE_MISMATCH"
    if len(shape) != len(type_spec.dimensions):
        return "TENSOR_RANK_MISMATCH"

    value_count = 1
    for size, dimension in zip(shape, type_spec.dimensions, strict=True):
        if type(size) is not int:
            return "VALUE_TYPE_MISMATCH"
        if dimension.fixed is not None and size != dimension.fixed:
            return "TENSOR_SHAPE_MISMATCH"
        if dimension.symbol is not None:
            if size < dimension.minimum or size > dimension.maximum:
                return "TENSOR_DIMENSION_OUT_OF_RANGE"
            previous = bindings.setdefault(dimension.symbol, size)
            if previous != size:
                return "SYMBOL_BINDING_MISMATCH"
        value_count *= size
        if value_count > 2_147_483_647:
            return "TENSOR_VALUE_COUNT_MISMATCH"

    values = value["values"]
    if not isinstance(values, list):
        return "VALUE_TYPE_MISMATCH"
    if len(values) != value_count:
        return "TENSOR_VALUE_COUNT_MISMATCH"
    element = ScalarSpec(type_spec.dtype, type_spec.dtype == "float32", None)
    for item in values:
        code = _validate_scalar(element, item, bindings)
        if code is not None:
            return code
    return None

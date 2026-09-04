"""Strict parser for jpyxis.io/contract/v1alpha1."""

from __future__ import annotations

import re
from pathlib import Path

from .codec import canonicalize, load_json, sha256
from .model import (
    AlgorithmContract,
    ContractError,
    DimensionSpec,
    FieldSpec,
    Metadata,
    Operation,
    RawJsonValue,
    RecordSpec,
    ScalarSpec,
    TensorSpec,
    TypeSpec,
)

IDENTIFIER = re.compile(r"[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*\Z")
FIELD_NAME = re.compile(r"[a-z][a-z0-9_]*\Z")
SYMBOL = re.compile(r"[A-Z][A-Z0-9_]*\Z")
VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+\Z")


def parse_contract(path_or_value: Path | dict[str, RawJsonValue]) -> AlgorithmContract:
    root = load_json(path_or_value) if isinstance(path_or_value, Path) else path_or_value
    root = _object(root, "contract")
    _exact_keys(root, {"apiVersion", "kind", "metadata", "spec"}, "contract")
    api_version = _text(root, "apiVersion", "contract")
    kind = _text(root, "kind", "contract")
    if api_version != "jpyxis.io/contract/v1alpha1" or kind != "AlgorithmContract":
        _invalid("Unsupported contract apiVersion or kind")

    metadata_value = _object(root["metadata"], "metadata")
    _exact_keys(metadata_value, {"namespace", "name", "version"}, "metadata")
    namespace = _text(metadata_value, "namespace", "metadata")
    name = _text(metadata_value, "name", "metadata")
    version = _text(metadata_value, "version", "metadata")
    _pattern(namespace, IDENTIFIER, "metadata.namespace")
    _pattern(name, IDENTIFIER, "metadata.name")
    _pattern(version, VERSION, "metadata.version")

    spec = _object(root["spec"], "spec")
    _exact_keys(spec, {"determinism", "sideEffects", "operation"}, "spec")
    determinism = _text(spec, "determinism", "spec")
    side_effects = _text(spec, "sideEffects", "spec")
    if determinism != "DETERMINISTIC" or side_effects != "NONE":
        _invalid("The M1 profile admits only deterministic, side-effect-free contracts")

    operation_value = _object(spec["operation"], "spec.operation")
    _exact_keys(operation_value, {"name", "input", "output"}, "spec.operation")
    operation_name = _text(operation_value, "name", "spec.operation")
    _pattern(operation_name, FIELD_NAME, "spec.operation.name")
    input_type = parse_type(operation_value["input"])
    output_type = parse_type(operation_value["output"])
    if not isinstance(input_type, RecordSpec) or not isinstance(output_type, RecordSpec):
        _invalid("Contract input and output must be records")
    _validate_symbols(input_type, output_type)

    digest = sha256(canonicalize(root))
    identity = f"jpyxis:contract:{namespace}/{name}@{version}#{digest}"
    return AlgorithmContract(
        api_version,
        kind,
        Metadata(namespace, name, version),
        determinism,
        side_effects,
        Operation(operation_name, input_type, output_type),
        digest,
        identity,
    )


def parse_type(value: RawJsonValue) -> TypeSpec:
    item = _object(value, "type")
    kind = _text(item, "kind", "type")
    if kind == "scalar":
        return _parse_scalar(item)
    if kind == "record":
        return _parse_record(item)
    if kind == "tensor":
        return _parse_tensor(item)
    raise ContractError("CONTRACT_DOCUMENT_INVALID", f"Unsupported type kind: {kind}")


def _parse_scalar(item: dict[str, RawJsonValue]) -> ScalarSpec:
    _allowed_keys(
        item,
        {"kind", "scalarType", "finite", "equalsSymbol"},
        {"kind", "scalarType"},
        "scalar",
    )
    scalar_type = _text(item, "scalarType", "scalar")
    if scalar_type not in {"float32", "int32"}:
        _invalid(f"Unsupported scalar type: {scalar_type}")
    finite = _boolean(item, "finite", "scalar") if "finite" in item else False
    equals_symbol = _text(item, "equalsSymbol", "scalar") if "equalsSymbol" in item else None
    if equals_symbol is not None:
        _pattern(equals_symbol, SYMBOL, "scalar.equalsSymbol")
    if scalar_type == "float32" and "finite" not in item:
        _invalid("float32 scalar types must declare finite explicitly")
    if scalar_type == "int32" and "finite" in item:
        _invalid("int32 scalar types cannot declare finite")
    return ScalarSpec(scalar_type, finite, equals_symbol)


def _parse_record(item: dict[str, RawJsonValue]) -> RecordSpec:
    _exact_keys(item, {"kind", "unknownFields", "fields"}, "record")
    unknown_fields = _text(item, "unknownFields", "record")
    if unknown_fields != "REJECT":
        _invalid("The M1 profile requires unknownFields=REJECT")
    fields_value = item["fields"]
    if not isinstance(fields_value, list):
        _invalid("record.fields must be an array")
    fields: list[FieldSpec] = []
    names: set[str] = set()
    for field_value in fields_value:
        field = _object(field_value, "record.field")
        _exact_keys(field, {"name", "required", "type"}, "record.field")
        name = _text(field, "name", "record.field")
        _pattern(name, FIELD_NAME, "record.field.name")
        if name in names:
            _invalid(f"Duplicate record field: {name}")
        names.add(name)
        fields.append(FieldSpec(name, _boolean(field, "required", "record.field"), parse_type(field["type"])))
    return RecordSpec(unknown_fields, tuple(fields))


def _parse_tensor(item: dict[str, RawJsonValue]) -> TensorSpec:
    _exact_keys(item, {"kind", "dtype", "layout", "dimensions"}, "tensor")
    dtype = _text(item, "dtype", "tensor")
    layout = _text(item, "layout", "tensor")
    if dtype not in {"float32", "int32"}:
        _invalid(f"Unsupported tensor dtype: {dtype}")
    if layout != "ROW_MAJOR":
        _invalid("The M1 profile admits only ROW_MAJOR tensor contracts")
    dimensions_value = item["dimensions"]
    if not isinstance(dimensions_value, list) or not dimensions_value:
        _invalid("tensor.dimensions must be a non-empty array")
    dimensions: list[DimensionSpec] = []
    for dimension_value in dimensions_value:
        dimension = _object(dimension_value, "tensor.dimension")
        if "fixed" in dimension:
            _exact_keys(dimension, {"fixed"}, "tensor.dimension")
            fixed = _positive_int(dimension, "fixed", "tensor.dimension")
            dimensions.append(DimensionSpec(fixed, None, fixed, fixed))
        else:
            _exact_keys(dimension, {"symbol", "min", "max"}, "tensor.dimension")
            symbol = _text(dimension, "symbol", "tensor.dimension")
            _pattern(symbol, SYMBOL, "tensor.dimension.symbol")
            minimum = _positive_int(dimension, "min", "tensor.dimension")
            maximum = _positive_int(dimension, "max", "tensor.dimension")
            if maximum < minimum:
                _invalid("tensor dimension max must be greater than or equal to min")
            dimensions.append(DimensionSpec(None, symbol, minimum, maximum))
    return TensorSpec(dtype, layout, tuple(dimensions))


def _validate_symbols(input_type: RecordSpec, output_type: RecordSpec) -> None:
    symbols: dict[str, tuple[int, int]] = {}

    def collect(type_spec: TypeSpec) -> None:
        if isinstance(type_spec, TensorSpec):
            for dimension in type_spec.dimensions:
                if dimension.symbol is None:
                    continue
                bounds = (dimension.minimum, dimension.maximum)
                if dimension.symbol in symbols and symbols[dimension.symbol] != bounds:
                    _invalid(f"Symbol {dimension.symbol} has inconsistent bounds")
                symbols[dimension.symbol] = bounds
        elif isinstance(type_spec, RecordSpec):
            for field in type_spec.fields:
                collect(field.type_spec)

    def validate(type_spec: TypeSpec) -> None:
        if isinstance(type_spec, ScalarSpec) and type_spec.equals_symbol is not None:
            if type_spec.equals_symbol not in symbols:
                _invalid(f"Unknown scalar equalsSymbol: {type_spec.equals_symbol}")
        elif isinstance(type_spec, RecordSpec):
            for field in type_spec.fields:
                validate(field.type_spec)

    collect(input_type)
    collect(output_type)
    validate(input_type)
    validate(output_type)


def _object(value: RawJsonValue, label: str) -> dict[str, RawJsonValue]:
    if not isinstance(value, dict):
        raise ContractError("CONTRACT_DOCUMENT_INVALID", f"{label} must be an object")
    return value


def _text(value: dict[str, RawJsonValue], field: str, label: str) -> str:
    item = value.get(field)
    if not isinstance(item, str) or not item:
        raise ContractError(
            "CONTRACT_DOCUMENT_INVALID", f"{label}.{field} must be a non-empty string"
        )
    return item


def _boolean(value: dict[str, RawJsonValue], field: str, label: str) -> bool:
    item = value.get(field)
    if type(item) is not bool:
        raise ContractError("CONTRACT_DOCUMENT_INVALID", f"{label}.{field} must be a boolean")
    return item


def _positive_int(value: dict[str, RawJsonValue], field: str, label: str) -> int:
    item = value.get(field)
    if type(item) is not int or item < 1 or item > 2_147_483_647:
        raise ContractError(
            "CONTRACT_DOCUMENT_INVALID", f"{label}.{field} must be a positive int32"
        )
    return item


def _exact_keys(value: dict[str, RawJsonValue], expected: set[str], label: str) -> None:
    _allowed_keys(value, expected, expected, label)


def _allowed_keys(
    value: dict[str, RawJsonValue], allowed: set[str], required: set[str], label: str
) -> None:
    unknown = set(value) - allowed
    if unknown:
        _invalid(f"{label} contains unknown fields: {sorted(unknown)}")
    missing = required - set(value)
    if missing:
        _invalid(f"{label} is missing fields: {sorted(missing)}")


def _pattern(value: str, pattern: re.Pattern[str], label: str) -> None:
    if pattern.fullmatch(value) is None:
        _invalid(f"{label} does not match the M1 ASCII identifier profile")


def _invalid(message: str) -> None:
    raise ContractError("CONTRACT_DOCUMENT_INVALID", message)

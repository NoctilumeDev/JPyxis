"""Bounded semantic value-set compatibility for M1."""

from __future__ import annotations

from enum import Enum

from .model import ContractError, RecordSpec, ScalarSpec, TensorSpec, TypeSpec


class CompatibilityRelation(str, Enum):
    EQUIVALENT = "EQUIVALENT"
    CANDIDATE_ACCEPTS_SUPERSET = "CANDIDATE_ACCEPTS_SUPERSET"
    CANDIDATE_ACCEPTS_SUBSET = "CANDIDATE_ACCEPTS_SUBSET"
    OVERLAPS = "OVERLAPS"
    DISJOINT = "DISJOINT"


def compare_types(base: TypeSpec, candidate: TypeSpec) -> CompatibilityRelation:
    _require_supported(base)
    _require_supported(candidate)
    return _compare_supported(base, candidate)


def _compare_supported(base: TypeSpec, candidate: TypeSpec) -> CompatibilityRelation:
    if type(base) is not type(candidate):
        return CompatibilityRelation.DISJOINT
    if isinstance(base, ScalarSpec) and isinstance(candidate, ScalarSpec):
        return _compare_scalar(base, candidate)
    if isinstance(base, TensorSpec) and isinstance(candidate, TensorSpec):
        return _compare_tensor(base, candidate)
    if isinstance(base, RecordSpec) and isinstance(candidate, RecordSpec):
        return _compare_record(base, candidate)
    raise TypeError("Unhandled type pair")


def _combine(
    left: CompatibilityRelation, right: CompatibilityRelation
) -> CompatibilityRelation:
    if CompatibilityRelation.DISJOINT in {left, right}:
        return CompatibilityRelation.DISJOINT
    if CompatibilityRelation.OVERLAPS in {left, right}:
        return CompatibilityRelation.OVERLAPS
    if left is CompatibilityRelation.EQUIVALENT:
        return right
    if right is CompatibilityRelation.EQUIVALENT or left is right:
        return left
    return CompatibilityRelation.OVERLAPS


def _compare_scalar(base: ScalarSpec, candidate: ScalarSpec) -> CompatibilityRelation:
    if base.scalar_type != candidate.scalar_type:
        return CompatibilityRelation.DISJOINT
    result = CompatibilityRelation.EQUIVALENT
    if base.scalar_type == "float32" and base.finite != candidate.finite:
        result = (
            CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET
            if candidate.finite
            else CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET
        )
    return result


def _compare_tensor(base: TensorSpec, candidate: TensorSpec) -> CompatibilityRelation:
    if (
        base.dtype != candidate.dtype
        or base.layout != candidate.layout
        or len(base.dimensions) != len(candidate.dimensions)
    ):
        return CompatibilityRelation.DISJOINT
    result = CompatibilityRelation.EQUIVALENT
    for base_dimension, candidate_dimension in zip(
        base.dimensions, candidate.dimensions, strict=True
    ):
        result = _combine(result, _compare_interval(base_dimension, candidate_dimension))
        if result is CompatibilityRelation.DISJOINT:
            return result
    return result


def _compare_interval(base, candidate) -> CompatibilityRelation:
    if candidate.upper_bound < base.lower_bound or base.upper_bound < candidate.lower_bound:
        return CompatibilityRelation.DISJOINT
    if (
        candidate.lower_bound == base.lower_bound
        and candidate.upper_bound == base.upper_bound
    ):
        return CompatibilityRelation.EQUIVALENT
    if (
        candidate.lower_bound <= base.lower_bound
        and candidate.upper_bound >= base.upper_bound
    ):
        return CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET
    if (
        candidate.lower_bound >= base.lower_bound
        and candidate.upper_bound <= base.upper_bound
    ):
        return CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET
    return CompatibilityRelation.OVERLAPS


def _compare_record(base: RecordSpec, candidate: RecordSpec) -> CompatibilityRelation:
    if base.unknown_fields != candidate.unknown_fields:
        return CompatibilityRelation.OVERLAPS
    base_fields = {field.name: field for field in base.fields}
    candidate_fields = {field.name: field for field in candidate.fields}
    result = CompatibilityRelation.EQUIVALENT

    for name, base_field in base_fields.items():
        candidate_field = candidate_fields.get(name)
        if candidate_field is None:
            if base_field.required:
                return CompatibilityRelation.DISJOINT
            result = _combine(result, CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET)
            continue
        field_relation = _compare_supported(base_field.type_spec, candidate_field.type_spec)
        if base_field.required != candidate_field.required:
            field_relation = _combine(
                field_relation,
                CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET
                if candidate_field.required
                else CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET,
            )
        if (
            field_relation is CompatibilityRelation.DISJOINT
            and not base_field.required
            and not candidate_field.required
        ):
            field_relation = CompatibilityRelation.OVERLAPS
        result = _combine(result, field_relation)

    for name, candidate_field in candidate_fields.items():
        if name in base_fields:
            continue
        if candidate_field.required:
            return CompatibilityRelation.DISJOINT
        result = _combine(result, CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET)
    return result


def _require_supported(type_spec: TypeSpec) -> None:
    symbol_occurrences: dict[str, int] = {}

    def collect(current: TypeSpec) -> None:
        if isinstance(current, ScalarSpec):
            if current.equals_symbol is not None:
                _unsupported("equalsSymbol creates a cross-value correlation")
            return
        if isinstance(current, TensorSpec):
            for dimension in current.dimensions:
                if dimension.symbol is None:
                    continue
                occurrences = symbol_occurrences.get(dimension.symbol, 0) + 1
                symbol_occurrences[dimension.symbol] = occurrences
                if occurrences > 1:
                    _unsupported(
                        "repeated symbol creates a cross-value correlation: "
                        f"{dimension.symbol}"
                    )
            return
        if isinstance(current, RecordSpec):
            for field in current.fields:
                collect(field.type_spec)

    collect(type_spec)


def _unsupported(message: str) -> None:
    raise ContractError("COMPATIBILITY_PROFILE_UNSUPPORTED", message)

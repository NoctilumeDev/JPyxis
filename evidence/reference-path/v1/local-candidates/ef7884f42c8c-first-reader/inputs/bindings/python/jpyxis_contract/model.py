"""Semantic model for the M1 profile; no wire or runtime types belong here."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias, Union


RawJsonValue: TypeAlias = Union[
    None,
    bool,
    int,
    float,
    str,
    list["RawJsonValue"],
    dict[str, "RawJsonValue"],
]


@dataclass(frozen=True)
class ScalarSpec:
    scalar_type: str
    finite: bool
    equals_symbol: str | None


@dataclass(frozen=True)
class DimensionSpec:
    fixed: int | None
    symbol: str | None
    minimum: int
    maximum: int

    @property
    def lower_bound(self) -> int:
        return self.fixed if self.fixed is not None else self.minimum

    @property
    def upper_bound(self) -> int:
        return self.fixed if self.fixed is not None else self.maximum


@dataclass(frozen=True)
class TensorSpec:
    dtype: str
    layout: str
    dimensions: tuple[DimensionSpec, ...]


@dataclass(frozen=True)
class FieldSpec:
    name: str
    required: bool
    type_spec: "TypeSpec"


@dataclass(frozen=True)
class RecordSpec:
    unknown_fields: str
    fields: tuple[FieldSpec, ...]


TypeSpec = Union[ScalarSpec, TensorSpec, RecordSpec]


@dataclass(frozen=True)
class Metadata:
    namespace: str
    name: str
    version: str


@dataclass(frozen=True)
class Operation:
    name: str
    input: RecordSpec
    output: RecordSpec


@dataclass(frozen=True)
class AlgorithmContract:
    api_version: str
    kind: str
    metadata: Metadata
    determinism: str
    side_effects: str
    operation: Operation
    digest: str
    identity: str


@dataclass(frozen=True)
class ValidationResult:
    accepted: bool
    code: str
    bindings: dict[str, int]

    @classmethod
    def accept(cls, bindings: dict[str, int] | None = None) -> "ValidationResult":
        return cls(True, "OK", dict(sorted((bindings or {}).items())))

    @classmethod
    def reject(
        cls, code: str, bindings: dict[str, int] | None = None
    ) -> "ValidationResult":
        return cls(False, code, dict(sorted((bindings or {}).items())))


class ContractError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code

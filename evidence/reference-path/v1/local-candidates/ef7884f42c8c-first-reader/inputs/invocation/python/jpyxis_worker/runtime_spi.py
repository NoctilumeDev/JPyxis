"""Core-owned values and capability port for the bounded M3 runtime experiment."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

AFFINE_CAPABILITY_IDENTITY = "jpyxis.capability/affine-float32"
AFFINE_CAPABILITY_VERSION = "1"
AFFINE_OPERATION_IDENTITY = "jpyxis.operation/affine-batch@1"
AFFINE_PLAN_SCHEMA = "jpyxis.io/affine-definition-plan/v1alpha1"


@dataclass(frozen=True)
class DefinitionPlan:
    schema_version: str
    operation_identity: str


@dataclass(frozen=True)
class RuntimeCapability:
    capability_identity: str
    capability_version: str
    operation_identity: str
    dtypes: tuple[str, ...]
    layouts: tuple[str, ...]


@dataclass(frozen=True)
class RuntimeBinding:
    runtime_identity: str
    runtime_version: str
    capability: RuntimeCapability


@dataclass(frozen=True)
class RuntimeRequest:
    definition: DefinitionPlan
    shape: tuple[int, ...]
    values: tuple[float, ...]
    scale: float
    bias: float


@dataclass(frozen=True)
class RuntimeResult:
    shape: tuple[int, ...]
    values: tuple[float, ...]


class RuntimeProvider(Protocol):
    @property
    def binding(self) -> RuntimeBinding:
        """Return immutable identity and capability facts for this provider."""

    def execute(self, request: RuntimeRequest) -> RuntimeResult:
        """Execute through provider-private values and return Core-owned values."""


class RuntimeRegistry:
    """Outer composition registry; Core receives only the resolved provider port."""

    def __init__(self, providers: tuple[RuntimeProvider, ...]) -> None:
        self._providers: dict[str, RuntimeProvider] = {}
        for provider in providers:
            identity = provider.binding.runtime_identity
            if not identity or identity in self._providers:
                raise ValueError("runtime provider identities must be unique and non-empty")
            self._providers[identity] = provider

    def resolve(self, runtime_identity: str) -> RuntimeProvider:
        try:
            return self._providers[runtime_identity]
        except KeyError as error:
            raise ValueError("configured runtime provider is not installed") from error


def supports_affine_profile(binding: RuntimeBinding, definition: DefinitionPlan) -> bool:
    capability = binding.capability
    return (
        capability.capability_identity == AFFINE_CAPABILITY_IDENTITY
        and capability.capability_version == AFFINE_CAPABILITY_VERSION
        and capability.operation_identity == definition.operation_identity
        and "float32" in capability.dtypes
        and "ROW_MAJOR" in capability.layouts
    )

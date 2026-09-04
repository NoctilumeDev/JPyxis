from __future__ import annotations

import math
import unittest

from jpyxis_worker.runtime_spi import (
    AFFINE_OPERATION_IDENTITY,
    AFFINE_PLAN_SCHEMA,
    DefinitionPlan,
    RuntimeRequest,
    RuntimeRegistry,
    supports_affine_profile,
)
from jpyxis_worker.runtimes.numpy_runtime import NumPyRuntimeProvider
from jpyxis_worker.runtimes.reference_runtime import ReferenceRuntimeProvider


class RuntimeConformanceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.plan = DefinitionPlan(AFFINE_PLAN_SCHEMA, AFFINE_OPERATION_IDENTITY)
        self.providers = (NumPyRuntimeProvider(), ReferenceRuntimeProvider())

    def test_two_providers_conform_to_same_profile_and_exact_result(self) -> None:
        request = RuntimeRequest(
            definition=self.plan,
            shape=(1, 4),
            values=(0.1, -0.25, 1000.125, -1000.125),
            scale=0.5,
            bias=-1.25,
        )
        results = []
        for provider in self.providers:
            self.assertTrue(supports_affine_profile(provider.binding, self.plan))
            result = provider.execute(request)
            self.assertEqual(request.shape, result.shape)
            self.assertTrue(all(math.isfinite(value) for value in result.values))
            results.append(result)
        self.assertEqual(results[0], results[1])

    def test_registry_rejects_duplicate_and_unknown_provider_identities(self) -> None:
        with self.assertRaises(ValueError):
            RuntimeRegistry((self.providers[0], self.providers[0]))
        registry = RuntimeRegistry(self.providers)
        with self.assertRaises(ValueError):
            registry.resolve("not-installed")

    def test_each_provider_rejects_an_unsupported_definition_plan(self) -> None:
        request = RuntimeRequest(
            definition=DefinitionPlan(AFFINE_PLAN_SCHEMA, "jpyxis.operation/not-affine@1"),
            shape=(1, 4),
            values=(1.0, 2.0, 3.0, 4.0),
            scale=2.0,
            bias=1.0,
        )
        for provider in self.providers:
            with self.assertRaises(ValueError):
                provider.execute(request)


if __name__ == "__main__":
    unittest.main()

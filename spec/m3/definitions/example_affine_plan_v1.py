"""Runtime-neutral M3 definition plan for the existing affine host contract."""

DEFINITION_IDENTITY = "jpyxis:definition:example/affine-batch-plan@1.0.0"


def describe() -> dict[str, str]:
    return {
        "schemaVersion": "jpyxis.io/affine-definition-plan/v1alpha1",
        "operationIdentity": "jpyxis.operation/affine-batch@1",
    }

"""Second immutable M3-conformant affine definition for real cutover witnesses."""

DEFINITION_IDENTITY = "jpyxis:definition:example/affine-batch-plan@2.0.0"


def describe() -> dict[str, str]:
    return {
        "schemaVersion": "jpyxis.io/affine-definition-plan/v1alpha1",
        "operationIdentity": "jpyxis.operation/affine-batch@1",
    }

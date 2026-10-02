"""Pure affine exposure calibration v1; business decisions belong to Java."""
# RISK_CALIBRATION {"scale":0.8,"bias":0.01}
DEFINITION_IDENTITY = "jpyxis:definition:reference/risk-affine@1.0.0"


def describe() -> dict[str, str]:
    return {
        "schemaVersion": "jpyxis.io/affine-definition-plan/v1alpha1",
        "operationIdentity": "jpyxis.operation/affine-batch@1",
    }

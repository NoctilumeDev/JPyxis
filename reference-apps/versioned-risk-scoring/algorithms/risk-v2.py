"""Pure affine exposure calibration v2; business decisions belong to Java."""
# RISK_CALIBRATION {"scale":0.9,"bias":0.04}
DEFINITION_IDENTITY = "jpyxis:definition:reference/risk-affine@2.0.0"


def describe() -> dict[str, str]:
    return {
        "schemaVersion": "jpyxis.io/affine-definition-plan/v1alpha1",
        "operationIdentity": "jpyxis.operation/affine-batch@1",
    }

"""M4 fixture: a second immutable definition artifact coordinate.

The M4 lifecycle fixture treats these bytes as an artifact. Runtime execution remains covered by
the independently rerun M2 and M3 profiles.
"""


def definition_plan():
    return {
        "schemaVersion": "jpyxis.io/affine-definition-plan/v1alpha1",
        "operationIdentity": "jpyxis.operation/affine-batch@1",
    }

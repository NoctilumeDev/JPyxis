"""Minimum M1 evidence-envelope checks required before M2."""

from __future__ import annotations

import re

from .model import RawJsonValue, ValidationResult

REQUIRED = {
    "schemaVersion",
    "contractIdentity",
    "contractDigest",
    "definitionArtifactIdentity",
    "definitionArtifactDigest",
    "invocationId",
    "attemptId",
    "traceId",
    "invocationOutcome",
    "expectedInvocationOutcome",
    "acceptanceVerdict",
    "projectEvidenceState",
    "completeness",
    "integrity",
    "conflicts",
}
OUTCOMES = {"SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED"}
VERDICTS = {"PASS", "FAIL", "INCONCLUSIVE"}
EVIDENCE_STATES = {
    "IDEA",
    "PLANNED",
    "DESIGNED",
    "PROTOTYPE",
    "VALIDATED",
    "REJECTED",
    "FROZEN",
}
COMPLETENESS = {"COMPLETE", "INCOMPLETE"}
INTEGRITY = {"VERIFIED", "FAILED", "UNKNOWN"}
DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
CONTRACT_IDENTITY = re.compile(
    r"jpyxis:contract:[a-z][a-z0-9._-]*/[a-z][a-z0-9._-]*@"
    r"[0-9]+\.[0-9]+\.[0-9]+#sha256:[0-9a-f]{64}\Z"
)
ARTIFACT_IDENTITY = re.compile(
    r"artifact:[a-z][a-z0-9._-]*@[0-9]+\.[0-9]+\.[0-9]+\Z"
)


def validate_evidence_envelope(value: RawJsonValue) -> ValidationResult:
    if not isinstance(value, dict):
        return _reject("EVIDENCE_TYPE_MISMATCH")
    if set(value) - REQUIRED:
        return _reject("EVIDENCE_UNKNOWN_FIELD")
    if not REQUIRED.issubset(value):
        return _reject("EVIDENCE_MISSING_FIELD")
    for name in REQUIRED - {"conflicts"}:
        if not isinstance(value[name], str) or not value[name].strip():
            return _reject("EVIDENCE_TYPE_MISMATCH")
    if value["schemaVersion"] != "jpyxis.io/evidence-envelope/v1alpha1":
        return _reject("EVIDENCE_SCHEMA_UNSUPPORTED")
    if DIGEST.fullmatch(value["contractDigest"]) is None or DIGEST.fullmatch(
        value["definitionArtifactDigest"]
    ) is None:
        return _reject("EVIDENCE_DIGEST_INVALID")
    if CONTRACT_IDENTITY.fullmatch(value["contractIdentity"]) is None or ARTIFACT_IDENTITY.fullmatch(
        value["definitionArtifactIdentity"]
    ) is None:
        return _reject("EVIDENCE_IDENTITY_INVALID")
    if not value["contractIdentity"].endswith("#" + value["contractDigest"]):
        return _reject("EVIDENCE_IDENTITY_CONFLICT")
    if (
        value["invocationOutcome"] not in OUTCOMES
        or value["expectedInvocationOutcome"] not in OUTCOMES
        or value["acceptanceVerdict"] not in VERDICTS
        or value["projectEvidenceState"] not in EVIDENCE_STATES
        or value["completeness"] not in COMPLETENESS
        or value["integrity"] not in INTEGRITY
    ):
        return _reject("EVIDENCE_ENUM_INVALID")
    conflicts = value["conflicts"]
    if not isinstance(conflicts, list) or any(
        not isinstance(conflict, str) or not conflict.strip() for conflict in conflicts
    ):
        return _reject("EVIDENCE_TYPE_MISMATCH")

    if value["acceptanceVerdict"] == "PASS":
        if value["completeness"] != "COMPLETE":
            return _reject("EVIDENCE_PASS_REQUIRES_COMPLETE")
        if value["integrity"] != "VERIFIED":
            return _reject("EVIDENCE_PASS_REQUIRES_VERIFIED_INTEGRITY")
        if conflicts:
            return _reject("EVIDENCE_CONFLICT")
        if value["invocationOutcome"] != value["expectedInvocationOutcome"]:
            return _reject("EVIDENCE_OUTCOME_MISMATCH")
    return ValidationResult.accept()


def _reject(code: str) -> ValidationResult:
    return ValidationResult.reject(code)

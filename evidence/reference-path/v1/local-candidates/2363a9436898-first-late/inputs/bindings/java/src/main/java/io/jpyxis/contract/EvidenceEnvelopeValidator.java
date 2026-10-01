package io.jpyxis.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public final class EvidenceEnvelopeValidator {
    private static final Set<String> REQUIRED = Set.of(
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
            "conflicts");
    private static final Set<String> OUTCOMES = Set.of("SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED");
    private static final Set<String> VERDICTS = Set.of("PASS", "FAIL", "INCONCLUSIVE");
    private static final Set<String> EVIDENCE_STATES = Set.of(
            "IDEA", "PLANNED", "DESIGNED", "PROTOTYPE", "VALIDATED", "REJECTED", "FROZEN");
    private static final Set<String> COMPLETENESS = Set.of("COMPLETE", "INCOMPLETE");
    private static final Set<String> INTEGRITY = Set.of("VERIFIED", "FAILED", "UNKNOWN");
    private static final Pattern DIGEST = Pattern.compile("sha256:[0-9a-f]{64}");
    private static final Pattern CONTRACT_IDENTITY = Pattern.compile(
            "jpyxis:contract:[a-z][a-z0-9._-]*/[a-z][a-z0-9._-]*@[0-9]+\\.[0-9]+\\.[0-9]+#sha256:[0-9a-f]{64}");
    private static final Pattern ARTIFACT_IDENTITY = Pattern.compile(
            "artifact:[a-z][a-z0-9._-]*@[0-9]+\\.[0-9]+\\.[0-9]+");

    public ValidationResult validate(JsonNode value) {
        if (!value.isObject()) {
            return reject("EVIDENCE_TYPE_MISMATCH");
        }
        ObjectNode object = (ObjectNode) value;
        Set<String> actual = new HashSet<>();
        object.fieldNames().forEachRemaining(actual::add);
        Set<String> unknown = new HashSet<>(actual);
        unknown.removeAll(REQUIRED);
        if (!unknown.isEmpty()) {
            return reject("EVIDENCE_UNKNOWN_FIELD");
        }
        if (!actual.containsAll(REQUIRED)) {
            return reject("EVIDENCE_MISSING_FIELD");
        }

        for (String name : REQUIRED) {
            if (name.equals("conflicts")) {
                continue;
            }
            JsonNode node = object.get(name);
            if (!node.isTextual() || node.textValue().isBlank()) {
                return reject("EVIDENCE_TYPE_MISMATCH");
            }
        }
        if (!object.path("schemaVersion").textValue().equals("jpyxis.io/evidence-envelope/v1alpha1")) {
            return reject("EVIDENCE_SCHEMA_UNSUPPORTED");
        }
        if (!DIGEST.matcher(object.path("contractDigest").textValue()).matches()
                || !DIGEST.matcher(object.path("definitionArtifactDigest").textValue()).matches()) {
            return reject("EVIDENCE_DIGEST_INVALID");
        }
        if (!CONTRACT_IDENTITY.matcher(object.path("contractIdentity").textValue()).matches()
                || !ARTIFACT_IDENTITY.matcher(
                        object.path("definitionArtifactIdentity").textValue()).matches()) {
            return reject("EVIDENCE_IDENTITY_INVALID");
        }
        if (!object.path("contractIdentity").textValue().endsWith(
                "#" + object.path("contractDigest").textValue())) {
            return reject("EVIDENCE_IDENTITY_CONFLICT");
        }
        if (!OUTCOMES.contains(object.path("invocationOutcome").textValue())
                || !OUTCOMES.contains(object.path("expectedInvocationOutcome").textValue())
                || !VERDICTS.contains(object.path("acceptanceVerdict").textValue())
                || !EVIDENCE_STATES.contains(object.path("projectEvidenceState").textValue())
                || !COMPLETENESS.contains(object.path("completeness").textValue())
                || !INTEGRITY.contains(object.path("integrity").textValue())) {
            return reject("EVIDENCE_ENUM_INVALID");
        }
        JsonNode conflicts = object.get("conflicts");
        if (!conflicts.isArray()) {
            return reject("EVIDENCE_TYPE_MISMATCH");
        }
        for (JsonNode conflict : conflicts) {
            if (!conflict.isTextual() || conflict.textValue().isBlank()) {
                return reject("EVIDENCE_TYPE_MISMATCH");
            }
        }

        if (object.path("acceptanceVerdict").textValue().equals("PASS")) {
            if (!object.path("completeness").textValue().equals("COMPLETE")) {
                return reject("EVIDENCE_PASS_REQUIRES_COMPLETE");
            }
            if (!object.path("integrity").textValue().equals("VERIFIED")) {
                return reject("EVIDENCE_PASS_REQUIRES_VERIFIED_INTEGRITY");
            }
            if (!conflicts.isEmpty()) {
                return reject("EVIDENCE_CONFLICT");
            }
            if (!object.path("invocationOutcome").textValue().equals(
                    object.path("expectedInvocationOutcome").textValue())) {
                return reject("EVIDENCE_OUTCOME_MISMATCH");
            }
        }
        return ValidationResult.accepted(Map.of());
    }

    private ValidationResult reject(String code) {
        return ValidationResult.rejected(code, Map.of());
    }
}

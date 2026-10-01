package io.jpyxis.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.ContractModel.AlgorithmContract;
import io.jpyxis.contract.ContractModel.TypeSpec;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

public final class ConformanceMain {
    private ConformanceMain() {
    }

    public static void main(String[] args) throws Exception {
        Map<String, String> options = parseArgs(args);
        Path contractPath = requiredPath(options, "--contract");
        Path corpusPath = requiredPath(options, "--corpus");
        Path outputPath = requiredPath(options, "--output");

        ContractParser parser = new ContractParser();
        AlgorithmContract contract = parser.parse(contractPath);
        JsonNode corpus = JsonSupport.read(corpusPath);
        if (!corpus.path("schemaVersion").asText().equals("jpyxis.io/conformance-corpus/v1alpha1")
                || !corpus.path("cases").isArray()) {
            throw new ContractException("CORPUS_INVALID", "Unsupported or malformed conformance corpus");
        }

        ValueValidator valueValidator = new ValueValidator();
        ValueNormalizer valueNormalizer = new ValueNormalizer();
        CompatibilityChecker compatibilityChecker = new CompatibilityChecker();
        EvidenceEnvelopeValidator evidenceValidator = new EvidenceEnvelopeValidator();
        ArrayNode reportCases = JsonSupport.MAPPER.createArrayNode();
        List<String> mismatches = new ArrayList<>();

        for (JsonNode caseNode : corpus.path("cases")) {
            String id = caseNode.path("id").asText();
            String kind = caseNode.path("kind").asText();
            ObjectNode actual = switch (kind) {
                case "input" -> validationResult(valueValidator.validate(
                        contract.operation().input(),
                        JsonSupport.decodeFixtureValues(caseNode.get("value")),
                        readBindings(caseNode.get("bindings"))));
                case "output" -> validationResult(valueValidator.validate(
                        contract.operation().output(),
                        JsonSupport.decodeFixtureValues(caseNode.get("value")),
                        readBindings(caseNode.get("bindings"))));
                case "type" -> validationResult(valueValidator.validate(
                        parser.parseType(caseNode.get("type")),
                        JsonSupport.decodeFixtureValues(caseNode.get("value")),
                        readBindings(caseNode.get("bindings"))));
                case "compatibility" -> compatibilityResult(compatibilityChecker,
                        parser.parseType(caseNode.get("baseType")),
                        parser.parseType(caseNode.get("candidateType")));
                case "evidence" -> validationResultWithoutBindings(
                        evidenceValidator.validate(caseNode.get("value")));
                default -> throw new ContractException("CORPUS_INVALID", "Unknown case kind: " + kind);
            };

            ObjectNode reportCase = JsonSupport.MAPPER.createObjectNode();
            reportCase.put("id", id);
            reportCase.put("kind", kind);
            reportCase.set("result", actual);
            if (Set.of("input", "output", "type", "evidence").contains(kind)
                    && actual.has("accepted")
                    && !actual.path("accepted").asBoolean()) {
                reportCase.put("failureCategory", "CONTRACT_FAULT");
            }
            if (kind.equals("input")) {
                reportCase.put("executionEligible", actual.path("accepted").asBoolean(false));
            } else if (kind.equals("output")) {
                reportCase.put(
                        "invocationSuccessEligible", actual.path("accepted").asBoolean(false));
            }
            if (actual.path("accepted").asBoolean(false)
                    && Set.of("input", "output", "type").contains(kind)) {
                TypeSpec type = switch (kind) {
                    case "input" -> contract.operation().input();
                    case "output" -> contract.operation().output();
                    case "type" -> parser.parseType(caseNode.get("type"));
                    default -> throw new IllegalStateException("Unreachable validation kind");
                };
                reportCase.set(
                        "normalizedValue",
                        valueNormalizer.normalize(
                                type, JsonSupport.decodeFixtureValues(caseNode.get("value"))));
            }
            reportCases.add(reportCase);

            JsonNode expected = caseNode.get("expected");
            if (expected == null || !expected.equals(actual)) {
                mismatches.add(id + ": expected " + expected + " but got " + actual);
            }
        }

        ObjectNode report = JsonSupport.MAPPER.createObjectNode();
        report.put("schemaVersion", "jpyxis.io/conformance-report/v1alpha1");
        report.put("binding", "java");
        report.put("contractIdentity", contract.identity());
        report.put("contractDigest", contract.digest());
        report.set("cases", reportCases);
        JsonSupport.write(outputPath, report);

        if (!mismatches.isEmpty()) {
            mismatches.forEach(System.err::println);
            throw new IllegalStateException("Java binding disagreed with " + mismatches.size() + " corpus case(s)");
        }
        System.out.println("Java M1 conformance passed: " + reportCases.size() + " cases");
    }

    private static ObjectNode validationResult(ValidationResult result) {
        ObjectNode node = validationResultWithoutBindings(result);
        if (result.accepted()) {
            ObjectNode bindings = JsonSupport.MAPPER.createObjectNode();
            result.bindings().forEach(bindings::put);
            node.set("bindings", bindings);
        }
        return node;
    }

    private static ObjectNode validationResultWithoutBindings(ValidationResult result) {
        ObjectNode node = JsonSupport.MAPPER.createObjectNode();
        node.put("accepted", result.accepted());
        node.put("code", result.code());
        return node;
    }

    private static ObjectNode compatibilityResult(
            CompatibilityChecker checker, TypeSpec base, TypeSpec candidate) {
        ObjectNode node = JsonSupport.MAPPER.createObjectNode();
        try {
            node.put("supported", true);
            node.put("relation", checker.compare(base, candidate).name());
        } catch (ContractException exception) {
            if (!exception.code().equals("COMPATIBILITY_PROFILE_UNSUPPORTED")) {
                throw exception;
            }
            node.put("supported", false);
            node.put("code", exception.code());
        }
        return node;
    }

    private static Map<String, Integer> readBindings(JsonNode node) {
        if (node == null || node.isMissingNode()) {
            return Map.of();
        }
        if (!node.isObject()) {
            throw new ContractException("CORPUS_INVALID", "bindings must be an object");
        }
        Map<String, Integer> result = new TreeMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            if (!entry.getValue().isIntegralNumber() || !entry.getValue().canConvertToInt()) {
                throw new ContractException("CORPUS_INVALID", "binding values must be int32");
            }
            result.put(entry.getKey(), entry.getValue().intValue());
        }
        return result;
    }

    private static Map<String, String> parseArgs(String[] args) {
        if (args.length % 2 != 0) {
            throw new IllegalArgumentException("Arguments must be --name value pairs");
        }
        Map<String, String> result = new TreeMap<>();
        for (int index = 0; index < args.length; index += 2) {
            result.put(args[index], args[index + 1]);
        }
        return result;
    }

    private static Path requiredPath(Map<String, String> options, String name) {
        String value = options.get(name);
        if (value == null) {
            throw new IllegalArgumentException("Missing required argument " + name);
        }
        return Path.of(value);
    }
}

package io.jpyxis.contract;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class JsonSupport {
    public static final ObjectMapper MAPPER = new ObjectMapper(
            JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build());

    private JsonSupport() {
    }

    public static JsonNode read(Path path) throws IOException {
        return MAPPER.readTree(Files.readString(path, StandardCharsets.UTF_8));
    }

    public static void write(Path path, JsonNode value) throws IOException {
        Path parent = path.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        String rendered = MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value) + "\n";
        Files.writeString(path, rendered, StandardCharsets.UTF_8);
    }

    public static String canonicalize(JsonNode node) {
        StringBuilder builder = new StringBuilder();
        appendCanonical(node, builder);
        return builder.toString();
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte item : bytes) {
                hex.append(String.format("%02x", item));
            }
            return "sha256:" + hex;
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public static JsonNode decodeFixtureValues(JsonNode node) {
        if (node.isObject() && node.size() == 1 && node.has("$fixtureFloat")) {
            String token = node.path("$fixtureFloat").asText();
            return switch (token) {
                case "NaN" -> MAPPER.getNodeFactory().numberNode(Double.NaN);
                case "+Infinity" -> MAPPER.getNodeFactory().numberNode(Double.POSITIVE_INFINITY);
                case "-Infinity" -> MAPPER.getNodeFactory().numberNode(Double.NEGATIVE_INFINITY);
                default -> throw new ContractException(
                        "CORPUS_INVALID_SENTINEL", "Unknown fixture float token: " + token);
            };
        }
        if (node.isObject()) {
            ObjectNode result = MAPPER.createObjectNode();
            node.fields().forEachRemaining(entry ->
                    result.set(entry.getKey(), decodeFixtureValues(entry.getValue())));
            return result;
        }
        if (node.isArray()) {
            ArrayNode result = MAPPER.createArrayNode();
            node.forEach(item -> result.add(decodeFixtureValues(item)));
            return result;
        }
        return node.deepCopy();
    }

    private static void appendCanonical(JsonNode node, StringBuilder builder) {
        if (node.isObject()) {
            builder.append('{');
            List<String> names = new ArrayList<>();
            node.fieldNames().forEachRemaining(names::add);
            names.sort(Comparator.naturalOrder());
            for (int index = 0; index < names.size(); index++) {
                if (index > 0) {
                    builder.append(',');
                }
                String name = names.get(index);
                if (!name.matches("[\\x20-\\x7E]+")) {
                    throw new ContractException(
                            "CONTRACT_DOCUMENT_INVALID", "Canonical object keys must be printable ASCII");
                }
                appendString(name, builder);
                builder.append(':');
                appendCanonical(node.get(name), builder);
            }
            builder.append('}');
            return;
        }
        if (node.isArray()) {
            builder.append('[');
            for (int index = 0; index < node.size(); index++) {
                if (index > 0) {
                    builder.append(',');
                }
                appendCanonical(node.get(index), builder);
            }
            builder.append(']');
            return;
        }
        if (node.isTextual()) {
            appendString(node.textValue(), builder);
            return;
        }
        if (node.isBoolean()) {
            builder.append(node.booleanValue());
            return;
        }
        if (node.isIntegralNumber()) {
            BigInteger value = node.bigIntegerValue();
            builder.append(value.toString());
            return;
        }
        throw new ContractException(
                "CONTRACT_DOCUMENT_INVALID",
                "Canonical contract documents admit only objects, arrays, strings, booleans, and integers");
    }

    private static void appendString(String value, StringBuilder builder) {
        try {
            builder.append(MAPPER.writeValueAsString(value));
        } catch (JsonProcessingException exception) {
            throw new ContractException("CONTRACT_DOCUMENT_INVALID", "Cannot canonicalize string");
        }
    }
}

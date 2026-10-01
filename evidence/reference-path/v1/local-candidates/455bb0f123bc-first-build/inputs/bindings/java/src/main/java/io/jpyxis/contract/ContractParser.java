package io.jpyxis.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.ContractModel.AlgorithmContract;
import io.jpyxis.contract.ContractModel.DimensionSpec;
import io.jpyxis.contract.ContractModel.FieldSpec;
import io.jpyxis.contract.ContractModel.Metadata;
import io.jpyxis.contract.ContractModel.Operation;
import io.jpyxis.contract.ContractModel.RecordSpec;
import io.jpyxis.contract.ContractModel.ScalarSpec;
import io.jpyxis.contract.ContractModel.TensorSpec;
import io.jpyxis.contract.ContractModel.TypeSpec;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public final class ContractParser {
    private static final Pattern IDENTIFIER = Pattern.compile("[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*");
    private static final Pattern FIELD_NAME = Pattern.compile("[a-z][a-z0-9_]*");
    private static final Pattern SYMBOL = Pattern.compile("[A-Z][A-Z0-9_]*");
    private static final Pattern VERSION = Pattern.compile("[0-9]+\\.[0-9]+\\.[0-9]+");

    public AlgorithmContract parse(Path path) throws IOException {
        return parse(JsonSupport.read(path));
    }

    public AlgorithmContract parse(JsonNode rootNode) {
        ObjectNode root = requireObject(rootNode, "contract");
        requireExactKeys(root, Set.of("apiVersion", "kind", "metadata", "spec"), "contract");

        String apiVersion = requireText(root, "apiVersion", "contract");
        String kind = requireText(root, "kind", "contract");
        if (!apiVersion.equals("jpyxis.io/contract/v1alpha1") || !kind.equals("AlgorithmContract")) {
            invalid("Unsupported contract apiVersion or kind");
        }

        ObjectNode metadataNode = requireObject(root.get("metadata"), "metadata");
        requireExactKeys(metadataNode, Set.of("namespace", "name", "version"), "metadata");
        String namespace = requireText(metadataNode, "namespace", "metadata");
        String name = requireText(metadataNode, "name", "metadata");
        String version = requireText(metadataNode, "version", "metadata");
        requirePattern(namespace, IDENTIFIER, "metadata.namespace");
        requirePattern(name, IDENTIFIER, "metadata.name");
        requirePattern(version, VERSION, "metadata.version");

        ObjectNode specNode = requireObject(root.get("spec"), "spec");
        requireExactKeys(specNode, Set.of("determinism", "sideEffects", "operation"), "spec");
        String determinism = requireText(specNode, "determinism", "spec");
        String sideEffects = requireText(specNode, "sideEffects", "spec");
        if (!determinism.equals("DETERMINISTIC") || !sideEffects.equals("NONE")) {
            invalid("The M1 profile admits only deterministic, side-effect-free contracts");
        }

        ObjectNode operationNode = requireObject(specNode.get("operation"), "spec.operation");
        requireExactKeys(operationNode, Set.of("name", "input", "output"), "spec.operation");
        String operationName = requireText(operationNode, "name", "spec.operation");
        requirePattern(operationName, FIELD_NAME, "spec.operation.name");
        RecordSpec input = requireRecord(parseType(operationNode.get("input")), "input");
        RecordSpec output = requireRecord(parseType(operationNode.get("output")), "output");

        validateSymbols(input, output);

        String digest = JsonSupport.sha256(JsonSupport.canonicalize(root));
        String identity = "jpyxis:contract:" + namespace + "/" + name + "@" + version + "#" + digest;
        return new AlgorithmContract(
                apiVersion,
                kind,
                new Metadata(namespace, name, version),
                determinism,
                sideEffects,
                new Operation(operationName, input, output),
                digest,
                identity);
    }

    public TypeSpec parseType(JsonNode node) {
        ObjectNode object = requireObject(node, "type");
        String kind = requireText(object, "kind", "type");
        return switch (kind) {
            case "scalar" -> parseScalar(object);
            case "record" -> parseRecord(object);
            case "tensor" -> parseTensor(object);
            default -> throw new ContractException(
                    "CONTRACT_DOCUMENT_INVALID", "Unsupported type kind: " + kind);
        };
    }

    private ScalarSpec parseScalar(ObjectNode object) {
        requireAllowedKeys(
                object,
                Set.of("kind", "scalarType", "finite", "equalsSymbol"),
                Set.of("kind", "scalarType"),
                "scalar");
        String scalarType = requireText(object, "scalarType", "scalar");
        if (!Set.of("float32", "int32").contains(scalarType)) {
            invalid("Unsupported scalar type: " + scalarType);
        }

        boolean finite = object.has("finite") && requireBoolean(object, "finite", "scalar");
        String equalsSymbol = object.has("equalsSymbol")
                ? requireText(object, "equalsSymbol", "scalar")
                : null;
        if (equalsSymbol != null) {
            requirePattern(equalsSymbol, SYMBOL, "scalar.equalsSymbol");
        }
        if (scalarType.equals("float32") && !object.has("finite")) {
            invalid("float32 scalar types must declare finite explicitly");
        }
        if (scalarType.equals("int32") && object.has("finite")) {
            invalid("int32 scalar types cannot declare finite");
        }
        return new ScalarSpec(scalarType, finite, equalsSymbol);
    }

    private RecordSpec parseRecord(ObjectNode object) {
        requireExactKeys(object, Set.of("kind", "unknownFields", "fields"), "record");
        String unknownFields = requireText(object, "unknownFields", "record");
        if (!unknownFields.equals("REJECT")) {
            invalid("The M1 profile requires unknownFields=REJECT");
        }
        JsonNode fieldsNode = object.get("fields");
        if (fieldsNode == null || !fieldsNode.isArray()) {
            invalid("record.fields must be an array");
        }

        List<FieldSpec> fields = new ArrayList<>();
        Set<String> names = new HashSet<>();
        for (JsonNode fieldNode : fieldsNode) {
            ObjectNode field = requireObject(fieldNode, "record.field");
            requireExactKeys(field, Set.of("name", "required", "type"), "record.field");
            String name = requireText(field, "name", "record.field");
            requirePattern(name, FIELD_NAME, "record.field.name");
            if (!names.add(name)) {
                invalid("Duplicate record field: " + name);
            }
            boolean required = requireBoolean(field, "required", "record.field");
            fields.add(new FieldSpec(name, required, parseType(field.get("type"))));
        }
        return new RecordSpec(unknownFields, fields);
    }

    private TensorSpec parseTensor(ObjectNode object) {
        requireExactKeys(object, Set.of("kind", "dtype", "layout", "dimensions"), "tensor");
        String dtype = requireText(object, "dtype", "tensor");
        String layout = requireText(object, "layout", "tensor");
        if (!Set.of("float32", "int32").contains(dtype)) {
            invalid("Unsupported tensor dtype: " + dtype);
        }
        if (!layout.equals("ROW_MAJOR")) {
            invalid("The M1 profile admits only ROW_MAJOR tensor contracts");
        }

        JsonNode dimensionsNode = object.get("dimensions");
        if (dimensionsNode == null || !dimensionsNode.isArray() || dimensionsNode.isEmpty()) {
            invalid("tensor.dimensions must be a non-empty array");
        }
        List<DimensionSpec> dimensions = new ArrayList<>();
        for (JsonNode dimensionNode : dimensionsNode) {
            ObjectNode dimension = requireObject(dimensionNode, "tensor.dimension");
            if (dimension.has("fixed")) {
                requireExactKeys(dimension, Set.of("fixed"), "tensor.dimension");
                int fixed = requirePositiveInt(dimension, "fixed", "tensor.dimension");
                dimensions.add(new DimensionSpec(fixed, null, fixed, fixed));
            } else {
                requireExactKeys(dimension, Set.of("symbol", "min", "max"), "tensor.dimension");
                String symbol = requireText(dimension, "symbol", "tensor.dimension");
                requirePattern(symbol, SYMBOL, "tensor.dimension.symbol");
                int min = requirePositiveInt(dimension, "min", "tensor.dimension");
                int max = requirePositiveInt(dimension, "max", "tensor.dimension");
                if (max < min) {
                    invalid("tensor dimension max must be greater than or equal to min");
                }
                dimensions.add(new DimensionSpec(null, symbol, min, max));
            }
        }
        return new TensorSpec(dtype, layout, dimensions);
    }

    private void validateSymbols(RecordSpec input, RecordSpec output) {
        Map<String, DimensionSpec> symbols = new HashMap<>();
        collectDimensions(input, symbols);
        collectDimensions(output, symbols);
        Set<String> guaranteedBindings = new HashSet<>();
        validateSymbolOrder(input, symbols, guaranteedBindings, true);
        validateSymbolOrder(output, symbols, guaranteedBindings, true);
    }

    private void collectDimensions(TypeSpec type, Map<String, DimensionSpec> symbols) {
        if (type instanceof TensorSpec tensor) {
            for (DimensionSpec dimension : tensor.dimensions()) {
                if (dimension.symbol() == null) {
                    continue;
                }
                DimensionSpec previous = symbols.putIfAbsent(dimension.symbol(), dimension);
                if (previous != null
                        && (previous.min() != dimension.min() || previous.max() != dimension.max())) {
                    invalid("Symbol " + dimension.symbol() + " has inconsistent bounds");
                }
            }
        } else if (type instanceof RecordSpec record) {
            record.fields().forEach(field -> collectDimensions(field.type(), symbols));
        }
    }

    private void validateSymbolOrder(
            TypeSpec type,
            Map<String, DimensionSpec> symbols,
            Set<String> guaranteedBindings,
            boolean requiredPath) {
        if (type instanceof ScalarSpec scalar && scalar.equalsSymbol() != null) {
            if (!symbols.containsKey(scalar.equalsSymbol())) {
                invalid("Unknown scalar equalsSymbol: " + scalar.equalsSymbol());
            }
            if (!guaranteedBindings.contains(scalar.equalsSymbol())) {
                invalid("scalar.equalsSymbol must refer to a previously guaranteed symbol: "
                        + scalar.equalsSymbol());
            }
        } else if (type instanceof TensorSpec tensor) {
            if (requiredPath) {
                tensor.dimensions().stream()
                        .map(DimensionSpec::symbol)
                        .filter(symbol -> symbol != null)
                        .forEach(guaranteedBindings::add);
            }
        } else if (type instanceof RecordSpec record) {
            for (FieldSpec field : record.fields()) {
                validateSymbolOrder(
                        field.type(),
                        symbols,
                        guaranteedBindings,
                        requiredPath && field.required());
            }
        }
    }

    private RecordSpec requireRecord(TypeSpec type, String label) {
        if (type instanceof RecordSpec record) {
            return record;
        }
        throw new ContractException("CONTRACT_DOCUMENT_INVALID", label + " must be a record");
    }

    private static ObjectNode requireObject(JsonNode node, String label) {
        if (node == null || !node.isObject()) {
            throw new ContractException("CONTRACT_DOCUMENT_INVALID", label + " must be an object");
        }
        return (ObjectNode) node;
    }

    private static String requireText(ObjectNode object, String field, String label) {
        JsonNode node = object.get(field);
        if (node == null || !node.isTextual() || node.textValue().isEmpty()) {
            throw new ContractException(
                    "CONTRACT_DOCUMENT_INVALID", label + "." + field + " must be a non-empty string");
        }
        return node.textValue();
    }

    private static boolean requireBoolean(ObjectNode object, String field, String label) {
        JsonNode node = object.get(field);
        if (node == null || !node.isBoolean()) {
            throw new ContractException(
                    "CONTRACT_DOCUMENT_INVALID", label + "." + field + " must be a boolean");
        }
        return node.booleanValue();
    }

    private static int requirePositiveInt(ObjectNode object, String field, String label) {
        JsonNode node = object.get(field);
        if (node == null || !node.isIntegralNumber() || !node.canConvertToInt() || node.intValue() < 1) {
            throw new ContractException(
                    "CONTRACT_DOCUMENT_INVALID", label + "." + field + " must be a positive int32");
        }
        return node.intValue();
    }

    private static void requireExactKeys(ObjectNode object, Set<String> expected, String label) {
        requireAllowedKeys(object, expected, expected, label);
    }

    private static void requireAllowedKeys(
            ObjectNode object, Set<String> allowed, Set<String> required, String label) {
        Set<String> actual = new HashSet<>();
        object.fieldNames().forEachRemaining(actual::add);
        Set<String> unknown = new HashSet<>(actual);
        unknown.removeAll(allowed);
        if (!unknown.isEmpty()) {
            invalid(label + " contains unknown fields: " + unknown);
        }
        Set<String> missing = new HashSet<>(required);
        missing.removeAll(actual);
        if (!missing.isEmpty()) {
            invalid(label + " is missing fields: " + missing);
        }
    }

    private static void requirePattern(String value, Pattern pattern, String label) {
        if (!pattern.matcher(value).matches()) {
            invalid(label + " does not match the M1 ASCII identifier profile");
        }
    }

    private static void invalid(String message) {
        throw new ContractException("CONTRACT_DOCUMENT_INVALID", message);
    }
}

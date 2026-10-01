package io.jpyxis.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.ContractModel.DimensionSpec;
import io.jpyxis.contract.ContractModel.FieldSpec;
import io.jpyxis.contract.ContractModel.RecordSpec;
import io.jpyxis.contract.ContractModel.ScalarSpec;
import io.jpyxis.contract.ContractModel.TensorSpec;
import io.jpyxis.contract.ContractModel.TypeSpec;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

public final class ValueValidator {
    private static final double FLOAT32_MAX = Float.MAX_VALUE;

    public ValidationResult validate(TypeSpec type, JsonNode value) {
        return validate(type, value, Map.of());
    }

    public ValidationResult validate(TypeSpec type, JsonNode value, Map<String, Integer> initialBindings) {
        TreeMap<String, Integer> bindings = new TreeMap<>(initialBindings);
        String code = validateValue(type, value, bindings);
        return code == null
                ? ValidationResult.accepted(bindings)
                : ValidationResult.rejected(code, bindings);
    }

    private String validateValue(TypeSpec type, JsonNode value, Map<String, Integer> bindings) {
        if (type instanceof ScalarSpec scalar) {
            return validateScalar(scalar, value, bindings);
        }
        if (type instanceof RecordSpec record) {
            return validateRecord(record, value, bindings);
        }
        if (type instanceof TensorSpec tensor) {
            return validateTensor(tensor, value, bindings);
        }
        throw new IllegalStateException("Unhandled type: " + type);
    }

    private String validateScalar(ScalarSpec scalar, JsonNode value, Map<String, Integer> bindings) {
        if (!value.isNumber()) {
            return "VALUE_TYPE_MISMATCH";
        }
        if (scalar.scalarType().equals("int32")) {
            if (!value.isIntegralNumber()) {
                return "VALUE_TYPE_MISMATCH";
            }
            if (!value.canConvertToInt()) {
                return "VALUE_SCALAR_OUT_OF_RANGE";
            }
            int observed = value.intValue();
            if (scalar.equalsSymbol() != null) {
                Integer expected = bindings.get(scalar.equalsSymbol());
                if (expected == null || expected != observed) {
                    return "SYMBOL_BINDING_MISMATCH";
                }
            }
            return null;
        }

        double observed = value.doubleValue();
        if (scalar.finite() && !Double.isFinite(observed)) {
            return "VALUE_NON_FINITE";
        }
        if (Double.isFinite(observed) && Math.abs(observed) > FLOAT32_MAX) {
            return "VALUE_SCALAR_OUT_OF_RANGE";
        }
        return null;
    }

    private String validateRecord(RecordSpec record, JsonNode value, Map<String, Integer> bindings) {
        if (!value.isObject()) {
            return "VALUE_TYPE_MISMATCH";
        }
        ObjectNode object = (ObjectNode) value;
        Set<String> known = new HashSet<>();
        record.fields().forEach(field -> known.add(field.name()));
        Set<String> actual = new HashSet<>();
        object.fieldNames().forEachRemaining(actual::add);
        actual.removeAll(known);
        if (!actual.isEmpty()) {
            return "VALUE_UNKNOWN_FIELD";
        }
        for (FieldSpec field : record.fields()) {
            JsonNode fieldValue = object.get(field.name());
            if (fieldValue == null) {
                if (field.required()) {
                    return "VALUE_MISSING_FIELD";
                }
                continue;
            }
            String code = validateValue(field.type(), fieldValue, bindings);
            if (code != null) {
                return code;
            }
        }
        return null;
    }

    private String validateTensor(TensorSpec tensor, JsonNode value, Map<String, Integer> bindings) {
        if (!value.isObject()) {
            return "VALUE_TYPE_MISMATCH";
        }
        ObjectNode object = (ObjectNode) value;
        Set<String> keys = new HashSet<>();
        object.fieldNames().forEachRemaining(keys::add);
        Set<String> expectedKeys = Set.of("dtype", "shape", "layout", "values");
        if (!expectedKeys.containsAll(keys)) {
            return "VALUE_UNKNOWN_FIELD";
        }
        if (!keys.containsAll(expectedKeys)) {
            return "VALUE_MISSING_FIELD";
        }
        if (!object.path("dtype").isTextual()
                || !object.path("dtype").textValue().equals(tensor.dtype())) {
            return "TENSOR_DTYPE_MISMATCH";
        }
        if (!object.path("layout").isTextual()
                || !object.path("layout").textValue().equals(tensor.layout())) {
            return "TENSOR_LAYOUT_MISMATCH";
        }
        JsonNode shape = object.get("shape");
        if (!shape.isArray()) {
            return "VALUE_TYPE_MISMATCH";
        }
        if (shape.size() != tensor.dimensions().size()) {
            return "TENSOR_RANK_MISMATCH";
        }

        long valueCount = 1;
        for (int index = 0; index < shape.size(); index++) {
            JsonNode sizeNode = shape.get(index);
            if (!sizeNode.isIntegralNumber() || !sizeNode.canConvertToInt()) {
                return "VALUE_TYPE_MISMATCH";
            }
            int size = sizeNode.intValue();
            DimensionSpec dimension = tensor.dimensions().get(index);
            if (dimension.fixed() != null && size != dimension.fixed()) {
                return "TENSOR_SHAPE_MISMATCH";
            }
            if (dimension.symbol() != null) {
                if (size < dimension.min() || size > dimension.max()) {
                    return "TENSOR_DIMENSION_OUT_OF_RANGE";
                }
                Integer previous = bindings.putIfAbsent(dimension.symbol(), size);
                if (previous != null && previous != size) {
                    return "SYMBOL_BINDING_MISMATCH";
                }
            }
            valueCount *= size;
            if (valueCount > Integer.MAX_VALUE) {
                return "TENSOR_VALUE_COUNT_MISMATCH";
            }
        }

        JsonNode values = object.get("values");
        if (!values.isArray()) {
            return "VALUE_TYPE_MISMATCH";
        }
        if (values.size() != valueCount) {
            return "TENSOR_VALUE_COUNT_MISMATCH";
        }
        ScalarSpec element = new ScalarSpec(tensor.dtype(), tensor.dtype().equals("float32"), null);
        for (JsonNode item : values) {
            String code = validateScalar(element, item, bindings);
            if (code != null) {
                return code;
            }
        }
        return null;
    }
}

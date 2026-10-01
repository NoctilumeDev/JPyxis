package io.jpyxis.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.ContractModel.RecordSpec;
import io.jpyxis.contract.ContractModel.ScalarSpec;
import io.jpyxis.contract.ContractModel.TensorSpec;
import io.jpyxis.contract.ContractModel.TypeSpec;

public final class ValueNormalizer {
    public JsonNode normalize(TypeSpec type, JsonNode value) {
        if (type instanceof ScalarSpec scalar) {
            return scalar.scalarType().equals("int32")
                    ? JsonSupport.MAPPER.getNodeFactory().numberNode(value.intValue())
                    : JsonSupport.MAPPER.getNodeFactory().numberNode(value.floatValue());
        }
        if (type instanceof RecordSpec record) {
            ObjectNode result = JsonSupport.MAPPER.createObjectNode();
            record.fields().forEach(field -> {
                JsonNode fieldValue = value.get(field.name());
                if (fieldValue != null) {
                    result.set(field.name(), normalize(field.type(), fieldValue));
                }
            });
            return result;
        }
        if (type instanceof TensorSpec tensor) {
            ObjectNode result = JsonSupport.MAPPER.createObjectNode();
            result.put("dtype", tensor.dtype());
            ArrayNode shape = JsonSupport.MAPPER.createArrayNode();
            value.path("shape").forEach(item -> shape.add(item.intValue()));
            result.set("shape", shape);
            result.put("layout", tensor.layout());
            ArrayNode values = JsonSupport.MAPPER.createArrayNode();
            value.path("values").forEach(item -> {
                if (tensor.dtype().equals("int32")) {
                    values.add(item.intValue());
                } else {
                    values.add(item.floatValue());
                }
            });
            result.set("values", values);
            return result;
        }
        throw new IllegalStateException("Unhandled type: " + type);
    }
}

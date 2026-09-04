package io.jpyxis.contract;

import java.util.List;

public final class ContractModel {
    private ContractModel() {
    }

    public sealed interface TypeSpec permits ScalarSpec, RecordSpec, TensorSpec {
    }

    public record ScalarSpec(String scalarType, boolean finite, String equalsSymbol) implements TypeSpec {
    }

    public record FieldSpec(String name, boolean required, TypeSpec type) {
    }

    public record RecordSpec(String unknownFields, List<FieldSpec> fields) implements TypeSpec {
        public RecordSpec {
            fields = List.copyOf(fields);
        }
    }

    public record DimensionSpec(Integer fixed, String symbol, int min, int max) {
        public int lowerBound() {
            return fixed == null ? min : fixed;
        }

        public int upperBound() {
            return fixed == null ? max : fixed;
        }
    }

    public record TensorSpec(String dtype, String layout, List<DimensionSpec> dimensions)
            implements TypeSpec {
        public TensorSpec {
            dimensions = List.copyOf(dimensions);
        }
    }

    public record Metadata(String namespace, String name, String version) {
    }

    public record Operation(String name, RecordSpec input, RecordSpec output) {
    }

    public record AlgorithmContract(
            String apiVersion,
            String kind,
            Metadata metadata,
            String determinism,
            String sideEffects,
            Operation operation,
            String digest,
            String identity) {
    }
}

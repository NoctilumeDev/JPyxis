package io.jpyxis.contract;

import io.jpyxis.contract.ContractModel.DimensionSpec;
import io.jpyxis.contract.ContractModel.FieldSpec;
import io.jpyxis.contract.ContractModel.RecordSpec;
import io.jpyxis.contract.ContractModel.ScalarSpec;
import io.jpyxis.contract.ContractModel.TensorSpec;
import io.jpyxis.contract.ContractModel.TypeSpec;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

public final class CompatibilityChecker {
    public CompatibilityRelation compare(TypeSpec base, TypeSpec candidate) {
        requireSupported(base);
        requireSupported(candidate);
        return compareSupported(base, candidate);
    }

    private CompatibilityRelation compareSupported(TypeSpec base, TypeSpec candidate) {
        if (base.getClass() != candidate.getClass()) {
            return CompatibilityRelation.DISJOINT;
        }
        if (base instanceof ScalarSpec baseScalar && candidate instanceof ScalarSpec candidateScalar) {
            return compareScalar(baseScalar, candidateScalar);
        }
        if (base instanceof TensorSpec baseTensor && candidate instanceof TensorSpec candidateTensor) {
            return compareTensor(baseTensor, candidateTensor);
        }
        if (base instanceof RecordSpec baseRecord && candidate instanceof RecordSpec candidateRecord) {
            return compareRecord(baseRecord, candidateRecord);
        }
        throw new IllegalStateException("Unhandled type pair");
    }

    private CompatibilityRelation compareScalar(ScalarSpec base, ScalarSpec candidate) {
        if (!base.scalarType().equals(candidate.scalarType())) {
            return CompatibilityRelation.DISJOINT;
        }
        CompatibilityRelation result = CompatibilityRelation.EQUIVALENT;
        if (base.scalarType().equals("float32") && base.finite() != candidate.finite()) {
            result = candidate.finite()
                    ? CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET
                    : CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET;
        }
        return result;
    }

    private CompatibilityRelation compareTensor(TensorSpec base, TensorSpec candidate) {
        if (!base.dtype().equals(candidate.dtype())
                || !base.layout().equals(candidate.layout())
                || base.dimensions().size() != candidate.dimensions().size()) {
            return CompatibilityRelation.DISJOINT;
        }
        CompatibilityRelation result = CompatibilityRelation.EQUIVALENT;
        for (int index = 0; index < base.dimensions().size(); index++) {
            result = result.combine(compareInterval(
                    base.dimensions().get(index), candidate.dimensions().get(index)));
            if (result == CompatibilityRelation.DISJOINT) {
                return result;
            }
        }
        return result;
    }

    private CompatibilityRelation compareInterval(DimensionSpec base, DimensionSpec candidate) {
        int baseMin = base.lowerBound();
        int baseMax = base.upperBound();
        int candidateMin = candidate.lowerBound();
        int candidateMax = candidate.upperBound();
        if (candidateMax < baseMin || baseMax < candidateMin) {
            return CompatibilityRelation.DISJOINT;
        }
        if (candidateMin == baseMin && candidateMax == baseMax) {
            return CompatibilityRelation.EQUIVALENT;
        }
        if (candidateMin <= baseMin && candidateMax >= baseMax) {
            return CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET;
        }
        if (candidateMin >= baseMin && candidateMax <= baseMax) {
            return CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET;
        }
        return CompatibilityRelation.OVERLAPS;
    }

    private CompatibilityRelation compareRecord(RecordSpec base, RecordSpec candidate) {
        if (!base.unknownFields().equals(candidate.unknownFields())) {
            return CompatibilityRelation.OVERLAPS;
        }
        Map<String, FieldSpec> baseFields = fieldsByName(base);
        Map<String, FieldSpec> candidateFields = fieldsByName(candidate);
        CompatibilityRelation result = CompatibilityRelation.EQUIVALENT;

        for (Map.Entry<String, FieldSpec> entry : baseFields.entrySet()) {
            FieldSpec baseField = entry.getValue();
            FieldSpec candidateField = candidateFields.get(entry.getKey());
            if (candidateField == null) {
                if (baseField.required()) {
                    return CompatibilityRelation.DISJOINT;
                }
                result = result.combine(CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET);
                continue;
            }
            CompatibilityRelation fieldRelation = compareSupported(
                    baseField.type(), candidateField.type());
            if (baseField.required() != candidateField.required()) {
                fieldRelation = fieldRelation.combine(candidateField.required()
                        ? CompatibilityRelation.CANDIDATE_ACCEPTS_SUBSET
                        : CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET);
            }
            if (fieldRelation == CompatibilityRelation.DISJOINT
                    && !baseField.required()
                    && !candidateField.required()) {
                fieldRelation = CompatibilityRelation.OVERLAPS;
            }
            result = result.combine(fieldRelation);
        }

        for (Map.Entry<String, FieldSpec> entry : candidateFields.entrySet()) {
            if (baseFields.containsKey(entry.getKey())) {
                continue;
            }
            if (entry.getValue().required()) {
                return CompatibilityRelation.DISJOINT;
            }
            result = result.combine(CompatibilityRelation.CANDIDATE_ACCEPTS_SUPERSET);
        }
        return result;
    }

    private void requireSupported(TypeSpec type) {
        Map<String, Integer> symbolOccurrences = new HashMap<>();
        collectCompatibilitySymbols(type, symbolOccurrences);
    }

    private void collectCompatibilitySymbols(TypeSpec type, Map<String, Integer> symbolOccurrences) {
        if (type instanceof ScalarSpec scalar) {
            if (scalar.equalsSymbol() != null) {
                unsupported("equalsSymbol creates a cross-value correlation");
            }
            return;
        }
        if (type instanceof TensorSpec tensor) {
            for (DimensionSpec dimension : tensor.dimensions()) {
                if (dimension.symbol() == null) {
                    continue;
                }
                int occurrences = symbolOccurrences.merge(dimension.symbol(), 1, Integer::sum);
                if (occurrences > 1) {
                    unsupported("repeated symbol creates a cross-value correlation: "
                            + dimension.symbol());
                }
            }
            return;
        }
        if (type instanceof RecordSpec record) {
            record.fields().forEach(field -> collectCompatibilitySymbols(
                    field.type(), symbolOccurrences));
        }
    }

    private static void unsupported(String message) {
        throw new ContractException("COMPATIBILITY_PROFILE_UNSUPPORTED", message);
    }

    private Map<String, FieldSpec> fieldsByName(RecordSpec record) {
        Map<String, FieldSpec> result = new LinkedHashMap<>();
        record.fields().forEach(field -> result.put(field.name(), field));
        return result;
    }
}

package io.jpyxis.contract;

public enum CompatibilityRelation {
    EQUIVALENT,
    CANDIDATE_ACCEPTS_SUPERSET,
    CANDIDATE_ACCEPTS_SUBSET,
    OVERLAPS,
    DISJOINT;

    public CompatibilityRelation combine(CompatibilityRelation other) {
        if (this == DISJOINT || other == DISJOINT) {
            return DISJOINT;
        }
        if (this == OVERLAPS || other == OVERLAPS) {
            return OVERLAPS;
        }
        if (this == EQUIVALENT) {
            return other;
        }
        if (other == EQUIVALENT || this == other) {
            return this;
        }
        return OVERLAPS;
    }
}

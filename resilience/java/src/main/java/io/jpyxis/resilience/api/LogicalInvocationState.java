package io.jpyxis.resilience.api;

public enum LogicalInvocationState {
    ACCEPTED,
    ATTEMPTING,
    RETRY_PENDING,
    SUCCEEDED,
    FAILED,
    OUTCOME_UNKNOWN;

    public boolean terminal() {
        return this == SUCCEEDED || this == FAILED || this == OUTCOME_UNKNOWN;
    }
}

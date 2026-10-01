package io.jpyxis.resilience.api;

public enum AttemptObservationKind {
    SUCCEEDED,
    FAILED_BEFORE_EXECUTION,
    FAILED_AFTER_EXECUTION,
    UNKNOWN_REMOTE_OUTCOME
}

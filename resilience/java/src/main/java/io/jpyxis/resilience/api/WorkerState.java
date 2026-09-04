package io.jpyxis.resilience.api;

public enum WorkerState {
    REGISTERED,
    STARTING,
    ELIGIBLE,
    INELIGIBLE,
    STOPPING,
    STOPPED,
    FAILED
}

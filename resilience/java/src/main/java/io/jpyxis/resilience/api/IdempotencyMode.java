package io.jpyxis.resilience.api;

public enum IdempotencyMode {
    NONE,
    DEDUPLICATED_BY_LOGICAL_INVOCATION
}

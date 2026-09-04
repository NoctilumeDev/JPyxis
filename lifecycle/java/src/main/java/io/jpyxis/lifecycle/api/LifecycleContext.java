package io.jpyxis.lifecycle.api;

import java.util.Objects;

public record LifecycleContext(String actor, String cause, String traceId) {
    public LifecycleContext {
        actor = requireText(actor, "actor");
        cause = requireText(cause, "cause");
        traceId = requireText(traceId, "traceId");
    }

    private static String requireText(String value, String label) {
        Objects.requireNonNull(value, label);
        if (value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
        return value;
    }
}

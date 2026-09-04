package io.jpyxis.resilience.api;

public record ResilienceContext(String actor, String cause, String traceId) {
    public ResilienceContext {
        requireText(actor, "actor");
        requireText(cause, "cause");
        requireText(traceId, "traceId");
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }
}

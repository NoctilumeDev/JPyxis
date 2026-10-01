package io.jpyxis.resilience.api;

public record InvocationRequest(
        String logicalInvocationId,
        String traceId,
        IdempotencyMode idempotencyMode,
        String deduplicationScope,
        int maximumAttempts) {
    public InvocationRequest {
        requireText(logicalInvocationId, "logicalInvocationId");
        requireText(traceId, "traceId");
        if (idempotencyMode == null) {
            throw new IllegalArgumentException("idempotencyMode is required");
        }
        deduplicationScope = deduplicationScope == null ? "" : deduplicationScope;
        if (idempotencyMode == IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION
                && deduplicationScope.isBlank()) {
            throw new IllegalArgumentException("deduplicationScope is required");
        }
        if (idempotencyMode == IdempotencyMode.NONE && !deduplicationScope.isBlank()) {
            throw new IllegalArgumentException("NONE cannot declare deduplicationScope");
        }
        if (maximumAttempts < 1 || maximumAttempts > 3) {
            throw new IllegalArgumentException("maximumAttempts must be between 1 and 3");
        }
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }
}

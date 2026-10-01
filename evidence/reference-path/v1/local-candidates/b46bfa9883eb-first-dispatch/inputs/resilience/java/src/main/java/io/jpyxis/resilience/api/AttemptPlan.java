package io.jpyxis.resilience.api;

public record AttemptPlan(
        String logicalInvocationId,
        String attemptId,
        String traceId,
        int attemptNumber,
        WorkerSnapshot worker,
        IdempotencyMode idempotencyMode,
        String deduplicationScope) {
}

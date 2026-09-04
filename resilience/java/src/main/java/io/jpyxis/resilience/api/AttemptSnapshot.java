package io.jpyxis.resilience.api;

public record AttemptSnapshot(
        String attemptId,
        int attemptNumber,
        String workerId,
        String workerInstanceId,
        AttemptObservationKind observation,
        String code,
        String resultDigest) {
}

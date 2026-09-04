package io.jpyxis.invocation.transport;

public record WorkerCoordinates(
        String contractIdentity,
        String contractDigest,
        String definitionIdentity,
        String definitionDigest,
        String invocationId,
        String attemptId,
        String traceId) {
}

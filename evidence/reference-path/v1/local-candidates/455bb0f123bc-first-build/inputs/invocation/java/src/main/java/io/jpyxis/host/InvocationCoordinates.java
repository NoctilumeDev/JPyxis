package io.jpyxis.host;

public record InvocationCoordinates(
        String invocationId,
        String attemptId,
        String traceId,
        String contractIdentity,
        String definitionIdentity) {
}

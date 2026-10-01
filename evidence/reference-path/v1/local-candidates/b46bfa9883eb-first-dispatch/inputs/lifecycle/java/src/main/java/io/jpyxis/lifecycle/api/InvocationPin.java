package io.jpyxis.lifecycle.api;

public record InvocationPin(
        String pinId,
        String invocationId,
        String slot,
        String deploymentId,
        ArtifactCoordinate artifact,
        RuntimeHandle runtimeHandle) {
}

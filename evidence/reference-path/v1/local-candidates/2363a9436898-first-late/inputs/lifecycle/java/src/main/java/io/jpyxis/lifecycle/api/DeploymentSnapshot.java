package io.jpyxis.lifecycle.api;

public record DeploymentSnapshot(
        String deploymentId,
        String slot,
        ArtifactCoordinate artifact,
        DeploymentState state,
        String runtimeProviderIdentity,
        String runtimeProviderVersion,
        int outstandingPins) {
}

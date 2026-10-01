package io.jpyxis.lifecycle.api;

public record ArtifactSnapshot(
        ArtifactCoordinate coordinate,
        String contractIdentity,
        int contentLength,
        ArtifactState state,
        String validationEvidence) {
}

package io.jpyxis.lifecycle.api;

import java.util.Arrays;
import java.util.Objects;

public record ArtifactPayload(
        ArtifactCoordinate coordinate,
        String contractIdentity,
        byte[] content) {
    public ArtifactPayload {
        Objects.requireNonNull(coordinate, "coordinate");
        Objects.requireNonNull(contractIdentity, "contractIdentity");
        if (contractIdentity.isBlank()) {
            throw new IllegalArgumentException("contractIdentity must not be blank");
        }
        Objects.requireNonNull(content, "content");
        content = Arrays.copyOf(content, content.length);
    }

    @Override
    public byte[] content() {
        return Arrays.copyOf(content, content.length);
    }
}

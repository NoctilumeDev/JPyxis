package io.jpyxis.lifecycle.api;

import java.util.Objects;

public record ArtifactCoordinate(String identity, String digest) {
    public ArtifactCoordinate {
        identity = requireText(identity, "identity");
        digest = requireText(digest, "digest");
        if (!digest.matches("sha256:[0-9a-f]{64}")) {
            throw new IllegalArgumentException("digest must be a lowercase SHA-256 coordinate");
        }
    }

    private static String requireText(String value, String label) {
        Objects.requireNonNull(value, label);
        if (value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
        return value;
    }
}

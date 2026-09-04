package io.jpyxis.resilience.api;

public record DesiredBinding(
        String slot,
        String artifactIdentity,
        String artifactDigest,
        long revision) {
    public DesiredBinding {
        requireText(slot, "slot");
        requireText(artifactIdentity, "artifactIdentity");
        requireText(artifactDigest, "artifactDigest");
        if (!artifactDigest.startsWith("sha256:")) {
            throw new IllegalArgumentException("artifactDigest must use sha256");
        }
        if (revision < 1) {
            throw new IllegalArgumentException("revision must be positive");
        }
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }
}

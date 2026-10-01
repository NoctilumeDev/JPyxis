package io.jpyxis.lifecycle.core;

import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.ArtifactPayload;
import io.jpyxis.lifecycle.api.ArtifactSnapshot;
import io.jpyxis.lifecycle.api.ArtifactState;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.api.LifecycleException;
import io.jpyxis.lifecycle.evidence.EventOwner;
import io.jpyxis.lifecycle.evidence.LifecycleEventDraft;
import io.jpyxis.lifecycle.evidence.LifecycleJournal;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class ArtifactRegistry {
    private final Map<String, ArtifactEntry> artifacts = new LinkedHashMap<>();
    private final LifecycleJournal journal;

    public ArtifactRegistry(LifecycleJournal journal) {
        this.journal = Objects.requireNonNull(journal, "journal");
    }

    public synchronized ArtifactSnapshot register(
            String identity,
            String contractIdentity,
            byte[] content,
            LifecycleContext context) {
        requireText(identity, "identity");
        requireText(contractIdentity, "contractIdentity");
        Objects.requireNonNull(content, "content");
        Objects.requireNonNull(context, "context");

        byte[] immutableContent = Arrays.copyOf(content, content.length);
        String digest = digest(immutableContent);
        ArtifactEntry existing = artifacts.get(identity);
        if (existing != null) {
            if (!existing.coordinate.digest().equals(digest)
                    || !Arrays.equals(existing.content, immutableContent)
                    || !existing.contractIdentity.equals(contractIdentity)) {
                record(
                        "ARTIFACT_IDENTITY_CONFLICT",
                        context,
                        existing,
                        null,
                        null,
                        Map.of("candidateDigest", digest));
                throw new LifecycleException(
                        LifecycleException.Code.ARTIFACT_IDENTITY_CONFLICT,
                        "artifact identity already resolves to different immutable content: " + identity);
            }
            record("ARTIFACT_REGISTRATION_REUSED", context, existing, null, null, Map.of());
            return snapshot(existing);
        }

        ArtifactEntry created = new ArtifactEntry(
                new ArtifactCoordinate(identity, digest),
                contractIdentity,
                immutableContent,
                ArtifactState.REGISTERED,
                null);
        artifacts.put(identity, created);
        record("ARTIFACT_REGISTERED", context, created, null, ArtifactState.REGISTERED, Map.of());
        return snapshot(created);
    }

    public synchronized ArtifactSnapshot beginValidation(String identity, LifecycleContext context) {
        ArtifactEntry entry = requireArtifact(identity);
        requireState(entry, ArtifactState.REGISTERED);
        transition(entry, ArtifactState.VALIDATING, "ARTIFACT_VALIDATION_STARTED", context, Map.of());
        return snapshot(entry);
    }

    public synchronized ArtifactSnapshot acceptValidation(
            String identity,
            String validationEvidence,
            LifecycleContext context) {
        requireText(validationEvidence, "validationEvidence");
        ArtifactEntry entry = requireArtifact(identity);
        requireState(entry, ArtifactState.VALIDATING);
        entry.validationEvidence = validationEvidence;
        transition(
                entry,
                ArtifactState.VALIDATED,
                "ARTIFACT_VALIDATED",
                context,
                Map.of("validationEvidence", validationEvidence));
        return snapshot(entry);
    }

    public synchronized ArtifactSnapshot rejectValidation(
            String identity,
            String validationEvidence,
            LifecycleContext context) {
        requireText(validationEvidence, "validationEvidence");
        ArtifactEntry entry = requireArtifact(identity);
        requireState(entry, ArtifactState.VALIDATING);
        entry.validationEvidence = validationEvidence;
        transition(
                entry,
                ArtifactState.REJECTED,
                "ARTIFACT_REJECTED",
                context,
                Map.of("validationEvidence", validationEvidence));
        return snapshot(entry);
    }

    public synchronized ArtifactSnapshot deprecate(String identity, LifecycleContext context) {
        ArtifactEntry entry = requireArtifact(identity);
        requireState(entry, ArtifactState.VALIDATED);
        transition(entry, ArtifactState.DEPRECATED, "ARTIFACT_DEPRECATED", context, Map.of());
        return snapshot(entry);
    }

    public synchronized ArtifactPayload requireValidated(ArtifactCoordinate coordinate) {
        Objects.requireNonNull(coordinate, "coordinate");
        ArtifactEntry entry = requireArtifact(coordinate.identity());
        if (!entry.coordinate.equals(coordinate)) {
            throw new LifecycleException(
                    LifecycleException.Code.ARTIFACT_COORDINATE_MISMATCH,
                    "artifact coordinate does not match the Registry fact: " + coordinate.identity());
        }
        if (entry.state != ArtifactState.VALIDATED) {
            throw new LifecycleException(
                    LifecycleException.Code.ARTIFACT_NOT_VALIDATED,
                    "artifact is not validated: " + coordinate.identity());
        }
        return new ArtifactPayload(entry.coordinate, entry.contractIdentity, entry.content);
    }

    public synchronized ArtifactSnapshot snapshot(String identity) {
        return snapshot(requireArtifact(identity));
    }

    public synchronized byte[] readContent(String identity) {
        ArtifactEntry entry = requireArtifact(identity);
        return Arrays.copyOf(entry.content, entry.content.length);
    }

    public synchronized java.util.List<ArtifactSnapshot> snapshots() {
        ArrayList<ArtifactSnapshot> result = new ArrayList<>();
        artifacts.values().stream()
                .sorted(Comparator.comparing(entry -> entry.coordinate.identity()))
                .map(this::snapshot)
                .forEach(result::add);
        return java.util.List.copyOf(result);
    }

    private void transition(
            ArtifactEntry entry,
            ArtifactState next,
            String event,
            LifecycleContext context,
            Map<String, String> details) {
        ArtifactState previous = entry.state;
        entry.state = next;
        record(event, context, entry, previous, next, details);
    }

    private void record(
            String event,
            LifecycleContext context,
            ArtifactEntry entry,
            ArtifactState previous,
            ArtifactState next,
            Map<String, String> details) {
        journal.record(new LifecycleEventDraft(
                EventOwner.ARTIFACT_REGISTRY,
                event,
                context,
                entry.coordinate.identity(),
                entry.coordinate.digest(),
                null,
                null,
                previous == null ? null : previous.name(),
                next == null ? null : next.name(),
                details));
    }

    private ArtifactEntry requireArtifact(String identity) {
        ArtifactEntry entry = artifacts.get(identity);
        if (entry == null) {
            throw new LifecycleException(
                    LifecycleException.Code.ARTIFACT_NOT_FOUND,
                    "artifact is not registered: " + identity);
        }
        return entry;
    }

    private void requireState(ArtifactEntry entry, ArtifactState expected) {
        if (entry.state != expected) {
            throw new LifecycleException(
                    LifecycleException.Code.INVALID_ARTIFACT_TRANSITION,
                    "artifact " + entry.coordinate.identity() + " is " + entry.state
                            + ", expected " + expected);
        }
    }

    private ArtifactSnapshot snapshot(ArtifactEntry entry) {
        return new ArtifactSnapshot(
                entry.coordinate,
                entry.contractIdentity,
                entry.content.length,
                entry.state,
                entry.validationEvidence);
    }

    private static String digest(byte[] content) {
        try {
            return "sha256:" + HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static void requireText(String value, String label) {
        Objects.requireNonNull(value, label);
        if (value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }

    private static final class ArtifactEntry {
        private final ArtifactCoordinate coordinate;
        private final String contractIdentity;
        private final byte[] content;
        private ArtifactState state;
        private String validationEvidence;

        private ArtifactEntry(
                ArtifactCoordinate coordinate,
                String contractIdentity,
                byte[] content,
                ArtifactState state,
                String validationEvidence) {
            this.coordinate = coordinate;
            this.contractIdentity = contractIdentity;
            this.content = content;
            this.state = state;
            this.validationEvidence = validationEvidence;
        }
    }
}

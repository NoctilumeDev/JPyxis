package io.jpyxis.lifecycle.core;

import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.ArtifactState;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.api.LifecycleException;
import io.jpyxis.lifecycle.evidence.InMemoryLifecycleJournal;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

final class ArtifactRegistryTest {
    private final InMemoryLifecycleJournal journal = new InMemoryLifecycleJournal();
    private final ArtifactRegistry registry = new ArtifactRegistry(journal);

    @Test
    void artifactBytesRemainImmutableAcrossInputAndReadCopies() {
        byte[] source = new byte[] {1, 2, 3};
        ArtifactCoordinate coordinate = registry.register(
                "artifact:v1", "contract:v1", source, context("register")).coordinate();
        source[0] = 9;
        byte[] firstRead = registry.readContent(coordinate.identity());
        firstRead[1] = 9;

        assertArrayEquals(new byte[] {1, 2, 3}, registry.readContent(coordinate.identity()));
    }

    @Test
    void identityConflictCannotReplaceTheFirstArtifact() {
        ArtifactCoordinate original = registry.register(
                "artifact:v1", "contract:v1", new byte[] {1, 2, 3}, context("register")).coordinate();

        LifecycleException failure = assertThrows(LifecycleException.class, () -> registry.register(
                "artifact:v1", "contract:v1", new byte[] {1, 2, 4}, context("conflict")));

        assertEquals(LifecycleException.Code.ARTIFACT_IDENTITY_CONFLICT, failure.code());
        assertEquals(original, registry.snapshot("artifact:v1").coordinate());
        assertArrayEquals(new byte[] {1, 2, 3}, registry.readContent("artifact:v1"));
    }

    @Test
    void validationHasItsOwnStateMachine() {
        registry.register("artifact:v1", "contract:v1", new byte[] {1}, context("register"));
        registry.beginValidation("artifact:v1", context("begin"));
        var validated = registry.acceptValidation("artifact:v1", "evidence:v1", context("accept"));

        assertEquals(ArtifactState.VALIDATED, validated.state());
        assertEquals("evidence:v1", validated.validationEvidence());
        assertEquals(3, journal.events().size());
    }

    private LifecycleContext context(String cause) {
        return new LifecycleContext("test", cause, "trace-" + cause);
    }
}

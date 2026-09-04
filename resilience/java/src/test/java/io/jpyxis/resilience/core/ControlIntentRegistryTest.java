package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.DesiredBinding;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.evidence.DurableResilienceJournal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ControlIntentRegistryTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void acceptsOnlyContiguousRevisionsAndRecoversDesiredIntent() {
        Path file = temporaryDirectory.resolve("intent.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { })) {
            ControlIntentRegistry registry = new ControlIntentRegistry(journal, "epoch-1");
            registry.set(binding(1, "@1.0.0", "sha256:one"), context("set-one"));

            ResilienceException conflict = assertThrows(
                    ResilienceException.class,
                    () -> registry.set(binding(3, "@3.0.0", "sha256:three"), context("skip-two")));
            assertEquals(ResilienceException.Code.DESIRED_BINDING_REVISION_CONFLICT, conflict.code());
            registry.set(binding(2, "@2.0.0", "sha256:two"), context("set-two"));
        }

        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { })) {
            ControlIntentRegistry recovered = ControlIntentRegistry.recover(journal, "epoch-2");
            DesiredBinding desired = recovered.require("production");
            assertEquals(2L, desired.revision());
            assertEquals("jpyxis:definition:example/plan@2.0.0", desired.artifactIdentity());
            assertEquals("sha256:two", desired.artifactDigest());
        }
    }

    private DesiredBinding binding(long revision, String version, String digest) {
        return new DesiredBinding(
                "production",
                "jpyxis:definition:example/plan" + version,
                digest,
                revision);
    }

    private ResilienceContext context(String cause) {
        return new ResilienceContext("test", cause, "trace-" + cause);
    }
}

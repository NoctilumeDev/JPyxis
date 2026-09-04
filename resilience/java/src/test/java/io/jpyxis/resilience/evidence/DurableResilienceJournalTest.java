package io.jpyxis.resilience.evidence;

import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DurableResilienceJournalTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void reloadsACompleteHashChainedJournal() {
        Path file = temporaryDirectory.resolve("state.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { })) {
            journal.record(event("FIRST"));
            journal.record(event("SECOND"));
        }

        try (DurableResilienceJournal recovered = new DurableResilienceJournal(file, event -> { })) {
            assertEquals(2, recovered.events().size());
            assertEquals(recovered.events().get(0).digest(), recovered.events().get(1).previousDigest());
            assertEquals(2L, recovered.metrics().get("events.total"));
        }
    }

    @Test
    void rejectsTamperedJournal() throws IOException {
        Path file = temporaryDirectory.resolve("tampered.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { })) {
            journal.record(event("ORIGINAL"));
        }
        Files.writeString(file, Files.readString(file).replace("ORIGINAL", "CHANGED"));

        ResilienceException failure = assertThrows(
                ResilienceException.class,
                () -> new DurableResilienceJournal(file, event -> { }));
        assertEquals(ResilienceException.Code.DURABLE_JOURNAL_INVALID, failure.code());
    }

    @Test
    void rejectsTruncatedJournal() throws IOException {
        Path file = temporaryDirectory.resolve("truncated.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { })) {
            journal.record(event("COMPLETE"));
        }
        byte[] bytes = Files.readAllBytes(file);
        Files.write(file, java.util.Arrays.copyOf(bytes, bytes.length - 9));

        ResilienceException failure = assertThrows(
                ResilienceException.class,
                () -> new DurableResilienceJournal(file, event -> { }));
        assertEquals(ResilienceException.Code.DURABLE_JOURNAL_INVALID, failure.code());
    }

    @Test
    void rejectsACompleteJsonRecordWithoutItsDurableBoundary() throws IOException {
        Path file = temporaryDirectory.resolve("missing-boundary.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { })) {
            journal.record(event("COMPLETE_JSON"));
        }
        Files.writeString(file, Files.readString(file).stripTrailing());

        ResilienceException failure = assertThrows(
                ResilienceException.class,
                () -> new DurableResilienceJournal(file, event -> { }));
        assertEquals(ResilienceException.Code.DURABLE_JOURNAL_INVALID, failure.code());
    }

    @Test
    void telemetryFailureIsAppendedWithoutRewritingTheOriginalEvent() {
        Path file = temporaryDirectory.resolve("telemetry.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(
                file,
                event -> { throw new IllegalStateException("offline"); })) {
            ResilienceEvent original = journal.record(event("STATE_COMMITTED"));

            assertEquals("STATE_COMMITTED", original.event());
            assertEquals(2, journal.events().size());
            assertEquals("TELEMETRY_EXPORT_FAILED", journal.events().get(1).event());
            assertEquals(EventOwner.OBSERVABILITY_COORDINATOR, journal.events().get(1).owner());
            assertEquals(1L, journal.metrics().get("telemetry.export_failures"));
        }
    }

    private ResilienceEventDraft event(String name) {
        return new ResilienceEventDraft(
                EventOwner.RECOVERY_COORDINATOR,
                name,
                "epoch-1",
                new ResilienceContext("test", "test durable journal", "trace-journal"),
                "",
                "",
                "",
                Map.of("fact", "retained"));
    }
}

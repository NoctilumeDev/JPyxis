package io.jpyxis.resilience.evidence;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.port.TelemetrySink;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

public final class DurableResilienceJournal implements ResilienceJournal {
    public static final String GENESIS_DIGEST = "sha256:genesis";

    private final Path path;
    private final TelemetrySink telemetry;
    private final ObjectMapper json = new ObjectMapper();
    private final ArrayList<ResilienceEvent> events = new ArrayList<>();
    private final ResilienceMetrics metrics = new ResilienceMetrics();
    private boolean closed;

    public DurableResilienceJournal(Path path, TelemetrySink telemetry) {
        this.path = Objects.requireNonNull(path, "path").toAbsolutePath().normalize();
        this.telemetry = Objects.requireNonNull(telemetry, "telemetry");
        loadExisting();
    }

    @Override
    public synchronized ResilienceEvent record(ResilienceEventDraft draft) {
        requireOpen();
        ResilienceEvent event = append(draft);
        try {
            telemetry.publish(event);
        } catch (Exception failure) {
            append(new ResilienceEventDraft(
                    EventOwner.OBSERVABILITY_COORDINATOR,
                    "TELEMETRY_EXPORT_FAILED",
                    draft.controlEpoch(),
                    new ResilienceContext(
                            "m5-observability-coordinator",
                            "telemetry export failed after durable event",
                            draft.context().traceId()),
                    draft.logicalInvocationId(),
                    draft.attemptId(),
                    draft.workerId(),
                    Map.of(
                            "failedEventSequence", Long.toString(event.sequence()),
                            "failureType", failure.getClass().getSimpleName())));
        }
        return event;
    }

    @Override
    public synchronized List<ResilienceEvent> events() {
        return List.copyOf(events);
    }

    public synchronized Map<String, Long> metrics() {
        return metrics.snapshot();
    }

    public Path path() {
        return path;
    }

    @Override
    public synchronized void close() {
        closed = true;
    }

    private ResilienceEvent append(ResilienceEventDraft draft) {
        validateText(draft);
        long sequence = events.size() + 1L;
        String previous = events.isEmpty() ? GENESIS_DIGEST : events.get(events.size() - 1).digest();
        Map<String, String> details = Map.copyOf(new TreeMap<>(draft.details()));
        String digest = digest(
                sequence,
                previous,
                draft.owner(),
                draft.event(),
                draft.controlEpoch(),
                draft.context().actor(),
                draft.context().cause(),
                draft.context().traceId(),
                draft.logicalInvocationId(),
                draft.attemptId(),
                draft.workerId(),
                details);
        ResilienceEvent event = new ResilienceEvent(
                sequence,
                previous,
                digest,
                draft.owner(),
                draft.event(),
                draft.controlEpoch(),
                draft.context().actor(),
                draft.context().cause(),
                draft.context().traceId(),
                draft.logicalInvocationId(),
                draft.attemptId(),
                draft.workerId(),
                details);
        persist(event);
        events.add(event);
        metrics.observe(event);
        return event;
    }

    private void loadExisting() {
        try {
            if (!Files.exists(path)) {
                Path parent = path.getParent();
                if (parent != null) Files.createDirectories(parent);
                return;
            }
            String retained = Files.readString(path, StandardCharsets.UTF_8);
            if (!retained.isEmpty() && !retained.endsWith("\n")) {
                throw invalid("durable journal lacks a final record boundary", null);
            }
            String records = retained.isEmpty() ? "" : retained.substring(0, retained.length() - 1);
            List<String> lines = records.isEmpty() ? List.of() : List.of(records.split("\\R", -1));
            String previous = GENESIS_DIGEST;
            long expectedSequence = 1L;
            for (String line : lines) {
                if (line.isBlank()) {
                    throw invalid("durable journal contains a blank record", null);
                }
                ResilienceEvent event;
                try {
                    event = json.readValue(line, ResilienceEvent.class);
                } catch (IOException failure) {
                    throw invalid("durable journal contains unreadable JSON", failure);
                }
                if (event.sequence() != expectedSequence) {
                    throw invalid("durable journal sequence is not contiguous", null);
                }
                if (!previous.equals(event.previousDigest())) {
                    throw invalid("durable journal previous digest does not match", null);
                }
                String actual = digest(
                        event.sequence(),
                        event.previousDigest(),
                        event.owner(),
                        event.event(),
                        event.controlEpoch(),
                        event.actor(),
                        event.cause(),
                        event.traceId(),
                        event.logicalInvocationId(),
                        event.attemptId(),
                        event.workerId(),
                        event.details());
                if (!actual.equals(event.digest())) {
                    throw invalid("durable journal event digest does not match", null);
                }
                events.add(event);
                metrics.observe(event);
                previous = event.digest();
                expectedSequence++;
            }
        } catch (IOException failure) {
            throw invalid("durable journal could not be read", failure);
        }
    }

    private void persist(ResilienceEvent event) {
        try {
            byte[] bytes = (json.writeValueAsString(event) + "\n").getBytes(StandardCharsets.UTF_8);
            try (FileChannel channel = FileChannel.open(
                    path,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.WRITE,
                    StandardOpenOption.APPEND)) {
                ByteBuffer buffer = ByteBuffer.wrap(bytes);
                while (buffer.hasRemaining()) channel.write(buffer);
                channel.force(true);
            }
        } catch (IOException failure) {
            throw new ResilienceException(
                    ResilienceException.Code.CAPABILITY_FAILED,
                    "durable resilience event could not be appended",
                    failure);
        }
    }

    private void validateText(ResilienceEventDraft draft) {
        ArrayList<String> values = new ArrayList<>(List.of(
                draft.event(), draft.controlEpoch(), draft.context().actor(), draft.context().cause(),
                draft.context().traceId(), draft.logicalInvocationId(), draft.attemptId(), draft.workerId()));
        draft.details().entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    values.add(entry.getKey());
                    values.add(entry.getValue());
                });
        if (values.stream().anyMatch(value -> value == null || value.contains("\n") || value.contains("\r"))) {
            throw new IllegalArgumentException("journal fields must be non-null single-line text");
        }
    }

    public static String digest(
            long sequence,
            String previousDigest,
            EventOwner owner,
            String event,
            String controlEpoch,
            String actor,
            String cause,
            String traceId,
            String logicalInvocationId,
            String attemptId,
            String workerId,
            Map<String, String> details) {
        StringBuilder canonical = new StringBuilder();
        canonical.append(sequence).append('\n')
                .append(previousDigest).append('\n')
                .append(owner.name()).append('\n')
                .append(event).append('\n')
                .append(controlEpoch).append('\n')
                .append(actor).append('\n')
                .append(cause).append('\n')
                .append(traceId).append('\n')
                .append(logicalInvocationId).append('\n')
                .append(attemptId).append('\n')
                .append(workerId).append('\n');
        details.entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .forEach(entry -> canonical.append(entry.getKey())
                        .append('=')
                        .append(entry.getValue())
                        .append('\n'));
        try {
            return "sha256:" + HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException("SHA-256 is unavailable", failure);
        }
    }

    private ResilienceException invalid(String message, Throwable cause) {
        return new ResilienceException(ResilienceException.Code.DURABLE_JOURNAL_INVALID, message, cause);
    }

    private void requireOpen() {
        if (closed) throw new IllegalStateException("journal is closed");
    }
}

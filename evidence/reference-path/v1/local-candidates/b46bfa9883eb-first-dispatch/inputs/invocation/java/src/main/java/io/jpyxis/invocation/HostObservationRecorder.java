package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.host.InvocationCoordinates;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

public final class HostObservationRecorder implements AutoCloseable {
    private final BufferedWriter writer;
    private final AtomicLong sequence = new AtomicLong();
    private volatile boolean healthy;
    private volatile String failureSummary;

    private HostObservationRecorder(BufferedWriter writer, String openingFailure) {
        this.writer = writer;
        this.failureSummary = openingFailure;
        this.healthy = writer != null;
    }

    public static HostObservationRecorder open(Path path) {
        try {
            Path parent = path.toAbsolutePath().getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            BufferedWriter writer = Files.newBufferedWriter(
                    path,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
            return new HostObservationRecorder(writer, null);
        } catch (IOException exception) {
            return new HostObservationRecorder(null, exception.getClass().getSimpleName());
        }
    }

    public synchronized void record(
            String event, InvocationCoordinates coordinates, JsonNode details, boolean late) {
        if (!healthy || writer == null) {
            return;
        }
        ObjectNode observation = JsonSupport.MAPPER.createObjectNode();
        observation.put("schemaVersion", "jpyxis.io/m2-observation/v1alpha1");
        observation.put("sequence", sequence.incrementAndGet());
        observation.put("observedAt", Instant.now().toString());
        observation.put("source", "HOST");
        observation.put("event", event);
        observation.put("late", late);
        observation.put("invocationId", coordinates.invocationId());
        observation.put("attemptId", coordinates.attemptId());
        observation.put("traceId", coordinates.traceId());
        observation.set("details", details == null
                ? JsonSupport.MAPPER.createObjectNode()
                : details.deepCopy());
        try {
            writer.write(JsonSupport.MAPPER.writeValueAsString(observation));
            writer.newLine();
            writer.flush();
        } catch (IOException exception) {
            healthy = false;
            failureSummary = exception.getClass().getSimpleName();
        }
    }

    public boolean healthy() {
        return healthy;
    }

    public String failureSummary() {
        return failureSummary;
    }

    @Override
    public synchronized void close() {
        if (writer == null) {
            return;
        }
        try {
            writer.close();
        } catch (IOException exception) {
            healthy = false;
            failureSummary = exception.getClass().getSimpleName();
        }
    }
}

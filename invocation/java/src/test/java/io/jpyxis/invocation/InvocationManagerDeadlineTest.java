package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.invocation.transport.InvocationAttempt;
import io.jpyxis.invocation.transport.InvocationTransport;
import io.jpyxis.invocation.transport.RuntimeBinding;
import io.jpyxis.invocation.transport.RuntimeCapabilityReport;
import io.jpyxis.invocation.transport.TransportCall;
import io.jpyxis.invocation.transport.WorkerCoordinates;
import io.jpyxis.invocation.transport.WorkerExecutionReport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InvocationManagerDeadlineTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void transportSetupCannotExtendTheAbsoluteInvocationDeadline() throws Exception {
        Path root = Path.of("..", "..").toAbsolutePath().normalize();
        AtomicBoolean cancelled = new AtomicBoolean();
        InvocationTransport slowTransport = new InvocationTransport() {
            @Override
            public RuntimeCapabilityReport probe(Duration timeout) {
                // Transport discovery is already complete for this focused race test.
                return capability();
            }

            @Override
            public TransportCall invoke(InvocationAttempt attempt, Duration timeout) {
                try {
                    Thread.sleep(timeout.toMillis() + 25);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
                WorkerExecutionReport report = successfulReport(attempt);
                return new TransportCall(
                        CompletableFuture.completedFuture(report),
                        () -> cancelled.set(true));
            }

            @Override
            public void close() {
                // No carrier resources in the focused test double.
            }
        };

        Path contract = root.resolve("spec/m1/contracts/example.affine-batch.v1.json");
        Path definition = root.resolve("spec/m2/definitions/example_affine_v1.py");
        Path observations = temporaryDirectory.resolve("host-observations.jsonl");
        JsonNode input = JsonSupport.decodeFixtureValues(
                JsonSupport.read(root.resolve("spec/m2/cases/success_exact.json")));

        try (InvocationManager manager = new InvocationManager(
                slowTransport,
                contract,
                definition,
                "jpyxis:definition:example/affine-batch@1.0.0",
                HostObservationRecorder.open(observations))) {
            InvocationExecution execution = manager.invokeCanonical(
                    input,
                    InvocationOptions.withTimeout(Duration.ofMillis(100)));

            assertEquals(TerminalState.TIMED_OUT, execution.state());
            assertEquals("DEADLINE_EXCEEDED", execution.failure().code());
            assertTrue(execution.workerDispatched());
            assertTrue(cancelled.get());
        }
    }

    private static WorkerExecutionReport successfulReport(InvocationAttempt attempt) {
        ObjectNode output = JsonSupport.MAPPER.createObjectNode();
        ObjectNode tensor = output.putObject("values");
        tensor.put("dtype", "float32");
        tensor.putArray("shape").add(2).add(2);
        tensor.put("layout", "ROW_MAJOR");
        tensor.putArray("values").add(3.5f).add(6.5f).add(9.5f).add(12.5f);
        output.put("rows", 2);
        return new WorkerExecutionReport(
                new WorkerCoordinates(
                        attempt.coordinates().contractIdentity(),
                        attempt.contractDigest(),
                        attempt.coordinates().definitionIdentity(),
                        attempt.definitionDigest(),
                        attempt.coordinates().invocationId(),
                        attempt.coordinates().attemptId(),
                        attempt.coordinates().traceId(),
                        attempt.runtimeBinding()),
                "test.worker",
                "test",
                "test.runtime",
                "test",
                output,
                null,
                JsonSupport.MAPPER.createObjectNode());
    }

    private static RuntimeCapabilityReport capability() {
        return new RuntimeCapabilityReport(
                new RuntimeBinding(
                        "test.runtime",
                        "test",
                        "jpyxis.capability/affine-float32",
                        "1"),
                "jpyxis.operation/affine-batch@1",
                Set.of("float32"),
                Set.of("ROW_MAJOR"));
    }
}

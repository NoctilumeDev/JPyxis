package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.JsonNode;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.invocation.transport.InvocationAttempt;
import io.jpyxis.invocation.transport.InvocationTransport;
import io.jpyxis.invocation.transport.RuntimeBinding;
import io.jpyxis.invocation.transport.RuntimeCapabilityReport;
import io.jpyxis.invocation.transport.TransportCall;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class RuntimeCapabilityResolutionTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void blankRuntimeCoordinateCannotSatisfyCapabilityRequirement() {
        RuntimeCapabilityReport report = new RuntimeCapabilityReport(
                new RuntimeBinding(
                        "",
                        "",
                        "jpyxis.capability/affine-float32",
                        "1"),
                "jpyxis.operation/affine-batch@1",
                Set.of("float32"),
                Set.of("ROW_MAJOR"));

        assertFalse(report.supports(
                "jpyxis.capability/affine-float32",
                "1",
                "jpyxis.operation/affine-batch@1",
                "float32",
                "ROW_MAJOR"));
    }

    @Test
    void knowableCapabilityMismatchFailsBeforeDispatch() throws Exception {
        Path root = Path.of("..", "..").toAbsolutePath().normalize();
        AtomicBoolean invoked = new AtomicBoolean();
        InvocationTransport incompatible = new InvocationTransport() {
            @Override
            public RuntimeCapabilityReport probe(Duration timeout) {
                return new RuntimeCapabilityReport(
                        new RuntimeBinding(
                                "fixture.runtime",
                                "1",
                                "jpyxis.capability/not-affine",
                                "1"),
                        "jpyxis.operation/not-affine@1",
                        Set.of("float32"),
                        Set.of("ROW_MAJOR"));
            }

            @Override
            public TransportCall invoke(InvocationAttempt attempt, Duration timeout) {
                invoked.set(true);
                throw new AssertionError("incompatible runtime must not receive a dispatch");
            }

            @Override
            public void close() {
                // No carrier resources in this focused test double.
            }
        };

        JsonNode input = JsonSupport.decodeFixtureValues(
                JsonSupport.read(root.resolve("spec/m2/cases/success_exact.json")));
        try (InvocationManager manager = new InvocationManager(
                incompatible,
                root.resolve("spec/m1/contracts/example.affine-batch.v1.json"),
                root.resolve("spec/m3/definitions/example_affine_plan_v1.py"),
                "jpyxis:definition:example/affine-batch-plan@1.0.0",
                HostObservationRecorder.open(temporaryDirectory.resolve("host.jsonl")))) {
            InvocationExecution execution = manager.invokeCanonical(
                    input,
                    InvocationOptions.withTimeout(Duration.ofSeconds(1)));

            assertEquals(TerminalState.FAILED, execution.state());
            assertEquals("RUNTIME_CAPABILITY_UNSUPPORTED", execution.failure().code());
            assertFalse(execution.workerDispatched());
            assertFalse(invoked.get());
        }
    }
}

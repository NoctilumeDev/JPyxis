package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.host.CancellationToken;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.invocation.transport.grpc.GrpcInvocationTransport;

import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class M2InvocationMain {
    private M2InvocationMain() {
    }

    public static void main(String[] arguments) throws Exception {
        Map<String, String> options = parse(arguments);
        Path contract = requiredPath(options, "contract");
        Path definition = requiredPath(options, "definition");
        Path input = requiredPath(options, "input");
        Path observations = requiredPath(options, "host-observations");
        Path outcomePath = requiredPath(options, "outcome");
        Path rawReportPath = requiredPath(options, "raw-report");
        int port = Integer.parseInt(required(options, "port"));
        long timeoutMillis = Long.parseLong(required(options, "timeout-ms"));
        long cancelAfterMillis = Long.parseLong(options.getOrDefault("cancel-after-ms", "-1"));

        JsonNode canonicalInput = JsonSupport.decodeFixtureValues(JsonSupport.read(input));
        HostObservationRecorder recorder = HostObservationRecorder.open(observations);
        CancellationToken cancellationToken = new CancellationToken();
        ScheduledExecutorService cancellationScheduler = Executors.newSingleThreadScheduledExecutor();
        if (cancelAfterMillis >= 0) {
            cancellationScheduler.schedule(cancellationToken::cancel, cancelAfterMillis, TimeUnit.MILLISECONDS);
        }

        InvocationExecution execution;
        try (InvocationManager manager = new InvocationManager(
                new GrpcInvocationTransport(port),
                contract,
                definition,
                required(options, "definition-identity"),
                recorder)) {
            execution = manager.invokeCanonical(
                    canonicalInput,
                    new InvocationOptions(Duration.ofMillis(timeoutMillis), cancellationToken));
            JsonSupport.write(outcomePath, toJson(execution, recorder.failureSummary()));
            JsonSupport.write(rawReportPath, rawReport(execution));
        } finally {
            cancellationScheduler.shutdownNow();
        }

        System.out.printf(
                "M2 invocation %s: %s%s%n",
                execution.coordinates().invocationId(),
                execution.state(),
                execution.failure() == null ? "" : " / " + execution.failure().code());
    }

    private static ObjectNode toJson(InvocationExecution execution, String recorderFailure) {
        ObjectNode root = JsonSupport.MAPPER.createObjectNode();
        root.put("schemaVersion", "jpyxis.io/m2-invocation-outcome/v1alpha1");
        root.put("state", execution.state().name());
        root.put("workerDispatched", execution.workerDispatched());
        root.put("evidenceRecorderHealthy", execution.evidenceRecorderHealthy());
        if (recorderFailure != null) {
            root.put("evidenceRecorderFailure", recorderFailure);
        }
        ObjectNode coordinates = root.putObject("coordinates");
        coordinates.put("invocationId", execution.coordinates().invocationId());
        coordinates.put("attemptId", execution.coordinates().attemptId());
        coordinates.put("traceId", execution.coordinates().traceId());
        coordinates.put("contractIdentity", execution.coordinates().contractIdentity());
        coordinates.put("definitionIdentity", execution.coordinates().definitionIdentity());
        if (execution.result() != null) {
            ObjectNode result = root.putObject("result");
            result.put("rows", execution.result().rows());
            ObjectNode tensor = result.putObject("values");
            tensor.put("dtype", "float32");
            tensor.put("layout", "ROW_MAJOR");
            ArrayNode shape = tensor.putArray("shape");
            execution.result().values().shape().forEach(shape::add);
            ArrayNode values = tensor.putArray("values");
            execution.result().values().values().forEach(values::add);
        }
        if (execution.failure() != null) {
            InvocationFailure failure = execution.failure();
            ObjectNode node = root.putObject("failure");
            node.put("category", failure.category().name());
            node.put("code", failure.code());
            node.put("summary", failure.summary());
            node.put("retryable", failure.retryable());
            node.put("executionMayContinue", failure.executionMayContinue());
            node.put("resultProducedButRejected", failure.resultProducedButRejected());
            node.put("originLayer", failure.originLayer());
            node.put("causalReference", failure.causalReference());
        }
        return root;
    }

    private static ObjectNode rawReport(InvocationExecution execution) {
        if (execution.rawWorkerReport() != null) {
            return execution.rawWorkerReport();
        }
        ObjectNode absent = JsonSupport.MAPPER.createObjectNode();
        absent.put("schemaVersion", "jpyxis.io/m2-worker-report/v1alpha1");
        absent.put("present", false);
        return absent;
    }

    private static Map<String, String> parse(String[] arguments) {
        if (arguments.length % 2 != 0) {
            throw new IllegalArgumentException("Every M2 CLI option requires a value");
        }
        Map<String, String> result = new HashMap<>();
        for (int index = 0; index < arguments.length; index += 2) {
            String option = arguments[index];
            if (!option.startsWith("--") || option.length() == 2) {
                throw new IllegalArgumentException("Invalid option: " + option);
            }
            String previous = result.put(option.substring(2), arguments[index + 1]);
            if (previous != null) {
                throw new IllegalArgumentException("Duplicate option: " + option);
            }
        }
        return result;
    }

    private static String required(Map<String, String> options, String name) {
        String value = options.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required option --" + name);
        }
        return value;
    }

    private static Path requiredPath(Map<String, String> options, String name) {
        return Path.of(required(options, name));
    }
}

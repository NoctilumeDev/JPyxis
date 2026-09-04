package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.ContractModel.AlgorithmContract;
import io.jpyxis.contract.ContractParser;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.contract.ValidationResult;
import io.jpyxis.contract.ValueValidator;
import io.jpyxis.host.AffineBatchInput;
import io.jpyxis.host.AffineBatchResult;
import io.jpyxis.host.CancellationToken;
import io.jpyxis.host.FailureCategory;
import io.jpyxis.host.Float32Tensor;
import io.jpyxis.host.InvocationCoordinates;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.invocation.transport.InvocationAttempt;
import io.jpyxis.invocation.transport.InvocationTransport;
import io.jpyxis.invocation.transport.TransportCall;
import io.jpyxis.invocation.transport.TransportException;
import io.jpyxis.invocation.transport.WorkerExecutionReport;
import io.jpyxis.invocation.transport.WorkerFailureObservation;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public final class InvocationManager implements AutoCloseable {
    private static final Duration PROBE_LIMIT = Duration.ofSeconds(1);
    private final InvocationTransport transport;
    private final AlgorithmContract contract;
    private final String definitionIdentity;
    private final String definitionDigest;
    private final HostObservationRecorder recorder;
    private final ScheduledExecutorService scheduler;
    private final ValueValidator validator = new ValueValidator();

    InvocationManager(
            InvocationTransport transport,
            Path contractPath,
            Path definitionArtifact,
            String definitionIdentity,
            HostObservationRecorder recorder) throws IOException {
        this.transport = transport;
        this.contract = new ContractParser().parse(contractPath);
        this.definitionIdentity = definitionIdentity;
        this.definitionDigest = digest(definitionArtifact);
        this.recorder = recorder;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "jpyxis-m2-terminal-races");
            thread.setDaemon(true);
            return thread;
        });
    }

    public InvocationExecution invokeCanonical(JsonNode canonicalInput, InvocationOptions options) {
        InvocationCoordinates coordinates = coordinates();
        AtomicReference<InvocationExecution> terminal = new AtomicReference<>();
        ObjectNode empty = JsonSupport.MAPPER.createObjectNode();
        recorder.record("INVOCATION_ACCEPTED", coordinates, empty, false);

        ValidationResult inputValidation = validator.validate(contract.operation().input(), canonicalInput);
        if (!inputValidation.accepted()) {
            recorder.record("INPUT_REJECTED", coordinates, detail("code", inputValidation.code()), false);
            return commitFailure(
                    terminal,
                    TerminalState.FAILED,
                    coordinates,
                    new InvocationFailure(
                            FailureCategory.CONTRACT_FAULT,
                            inputValidation.code(),
                            "Input violates the frozen M1 contract",
                            false,
                            false,
                            false,
                            "CONTRACT_CORE",
                            "host-input-validation"),
                    false,
                    null);
        }
        recorder.record("INPUT_VALIDATED", coordinates, bindings(inputValidation), false);

        if (options.timeout().isZero() || options.timeout().isNegative()) {
            return commitFailure(
                    terminal,
                    TerminalState.TIMED_OUT,
                    coordinates,
                    deadlineFailure(false),
                    false,
                    null);
        }
        if (options.cancellationToken().isCancellationRequested()) {
            return commitFailure(
                    terminal,
                    TerminalState.CANCELLED,
                    coordinates,
                    cancellationFailure(false),
                    false,
                    null);
        }

        long deadlineNanos = System.nanoTime() + options.timeout().toNanos();
        long deadlineUnixMillis = Instant.now().plus(options.timeout()).toEpochMilli();
        recorder.record("ATTEMPT_PINNED", coordinates, pinnedDetails(), false);

        try {
            long probeNanos = Math.max(
                    1,
                    Math.min(PROBE_LIMIT.toNanos(), Math.max(1, deadlineNanos - System.nanoTime())));
            transport.probe(Duration.ofNanos(probeNanos));
            recorder.record("TRANSPORT_READY", coordinates, empty, false);
        } catch (TransportException exception) {
            if (exception.kind() == TransportException.Kind.DEADLINE_EXCEEDED
                    && System.nanoTime() >= deadlineNanos) {
                return commitFailure(
                        terminal,
                        TerminalState.TIMED_OUT,
                        coordinates,
                        deadlineFailure(false),
                        false,
                        null);
            }
            return commitFailure(
                    terminal,
                    TerminalState.FAILED,
                    coordinates,
                    transportFailure("WORKER_UNAVAILABLE", false),
                    false,
                    null);
        }

        if (options.cancellationToken().isCancellationRequested()) {
            return commitFailure(
                    terminal,
                    TerminalState.CANCELLED,
                    coordinates,
                    cancellationFailure(false),
                    false,
                    null);
        }
        long remainingNanos = deadlineNanos - System.nanoTime();
        if (remainingNanos <= 0) {
            return commitFailure(
                    terminal,
                    TerminalState.TIMED_OUT,
                    coordinates,
                    deadlineFailure(false),
                    false,
                    null);
        }

        InvocationAttempt attempt = new InvocationAttempt(
                coordinates,
                contract.digest(),
                definitionDigest,
                deadlineUnixMillis,
                toTypedInput(canonicalInput));
        recorder.record("DISPATCH_STARTED", coordinates, empty, false);
        TransportCall call = transport.invoke(attempt, Duration.ofNanos(remainingNanos));
        recorder.record("DISPATCHED", coordinates, empty, false);

        long terminalDelayNanos = deadlineNanos - System.nanoTime();
        if (terminalDelayNanos <= 0) {
            InvocationExecution timedOut = commitFailure(
                    terminal,
                    TerminalState.TIMED_OUT,
                    coordinates,
                    deadlineFailure(true),
                    true,
                    null);
            call.cancel().run();
            return timedOut;
        }

        ScheduledFuture<?> deadlineTask = scheduler.schedule(() -> {
            InvocationExecution candidate = failureExecution(
                    TerminalState.TIMED_OUT,
                    coordinates,
                    deadlineFailure(true),
                    true,
                    null);
            if (terminal.compareAndSet(null, candidate)) {
                recorder.record("TERMINAL_TIMED_OUT", coordinates, failureDetails(candidate.failure()), false);
                call.cancel().run();
            }
        }, terminalDelayNanos, TimeUnit.NANOSECONDS);

        AutoCloseable cancellationRegistration = registerCancellation(
                options.cancellationToken(), terminal, coordinates, call);
        try {
            WorkerExecutionReport report = call.completion().get();
            boolean late = terminal.get() != null;
            recorder.record("RESPONSE_OBSERVED", coordinates, reportDetails(report), late);
            if (late) {
                recorder.record("LATE_RESPONSE_DISCARDED", coordinates, empty, true);
                return withRecorderHealth(terminal.get());
            }

            InvocationExecution candidate = evaluateReport(report, inputValidation, coordinates);
            if (terminal.compareAndSet(null, candidate)) {
                recorder.record(
                        terminalEvent(candidate.state()),
                        coordinates,
                        candidate.failure() == null
                                ? detail("code", "OK")
                                : failureDetails(candidate.failure()),
                        false);
            } else {
                recorder.record("LATE_RESPONSE_DISCARDED", coordinates, empty, true);
            }
        } catch (CancellationException exception) {
            if (terminal.get() == null) {
                InvocationExecution candidate = failureExecution(
                        TerminalState.CANCELLED,
                        coordinates,
                        cancellationFailure(true),
                        true,
                        null);
                terminal.compareAndSet(null, candidate);
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            InvocationExecution candidate = failureExecution(
                    TerminalState.CANCELLED,
                    coordinates,
                    cancellationFailure(true),
                    true,
                    null);
            if (terminal.compareAndSet(null, candidate)) {
                recorder.record("TERMINAL_CANCELLED", coordinates, failureDetails(candidate.failure()), false);
            }
        } catch (ExecutionException exception) {
            handleTransportCompletionFailure(
                    exception.getCause(), options, terminal, coordinates);
        } finally {
            deadlineTask.cancel(false);
            try {
                cancellationRegistration.close();
            } catch (Exception ignored) {
                // Registration removal has no invocation semantics.
            }
        }

        if (terminal.get() == null) {
            InvocationExecution missing = failureExecution(
                    TerminalState.FAILED,
                    coordinates,
                    new InvocationFailure(
                            FailureCategory.CONTROL_FAULT,
                            "TERMINAL_DECISION_MISSING",
                            "Invocation ended without an authoritative terminal decision",
                            false,
                            true,
                            false,
                            "INVOCATION_MANAGER",
                            "terminal-state-guard"),
                    true,
                    null);
            if (terminal.compareAndSet(null, missing)) {
                recorder.record("TERMINAL_FAILED", coordinates, failureDetails(missing.failure()), false);
            }
        }
        return withRecorderHealth(terminal.get());
    }

    private void handleTransportCompletionFailure(
            Throwable cause,
            InvocationOptions options,
            AtomicReference<InvocationExecution> terminal,
            InvocationCoordinates coordinates) {
        if (terminal.get() != null) {
            return;
        }
        TransportException.Kind kind = cause instanceof TransportException transportException
                ? transportException.kind()
                : TransportException.Kind.INTERRUPTED;
        InvocationExecution candidate;
        if (kind == TransportException.Kind.DEADLINE_EXCEEDED) {
            candidate = failureExecution(
                    TerminalState.TIMED_OUT,
                    coordinates,
                    deadlineFailure(true),
                    true,
                    null);
        } else if (kind == TransportException.Kind.CANCELLED
                && options.cancellationToken().isCancellationRequested()) {
            candidate = failureExecution(
                    TerminalState.CANCELLED,
                    coordinates,
                    cancellationFailure(true),
                    true,
                    null);
        } else {
            candidate = failureExecution(
                    TerminalState.FAILED,
                    coordinates,
                    transportFailure("TRANSPORT_INTERRUPTED", true),
                    true,
                    null);
        }
        if (terminal.compareAndSet(null, candidate)) {
            recorder.record(
                    terminalEvent(candidate.state()),
                    coordinates,
                    failureDetails(candidate.failure()),
                    false);
        }
    }

    private AutoCloseable registerCancellation(
            CancellationToken token,
            AtomicReference<InvocationExecution> terminal,
            InvocationCoordinates coordinates,
            TransportCall call) {
        return token.onCancellation(() -> {
            InvocationExecution candidate = failureExecution(
                    TerminalState.CANCELLED,
                    coordinates,
                    cancellationFailure(true),
                    true,
                    null);
            if (terminal.compareAndSet(null, candidate)) {
                recorder.record("CANCELLATION_REQUESTED", coordinates, failureDetails(candidate.failure()), false);
                recorder.record("TERMINAL_CANCELLED", coordinates, failureDetails(candidate.failure()), false);
                call.cancel().run();
            }
        });
    }

    private InvocationExecution evaluateReport(
            WorkerExecutionReport report,
            ValidationResult inputValidation,
            InvocationCoordinates coordinates) {
        if (!coordinatesMatch(report, coordinates)) {
            return failureExecution(
                    TerminalState.FAILED,
                    coordinates,
                    new InvocationFailure(
                            FailureCategory.CONTRACT_FAULT,
                            "WORKER_COORDINATE_MISMATCH",
                            "Worker report coordinates do not match the pinned attempt",
                            false,
                            false,
                            report.canonicalOutput() != null,
                            "CONTRACT_CORE",
                            "worker-report-coordinates"),
                    true,
                    report.rawReport());
        }
        if (report.failure() != null) {
            return failureExecution(
                    TerminalState.FAILED,
                    coordinates,
                    mapWorkerFailure(report.failure()),
                    true,
                    report.rawReport());
        }
        if (report.canonicalOutput() == null) {
            return outputRejected(
                    coordinates,
                    report.rawReport(),
                    "Worker report contains no observation",
                    false);
        }

        ValidationResult outputValidation = validator.validate(
                contract.operation().output(), report.canonicalOutput(), inputValidation.bindings());
        if (!outputValidation.accepted()) {
            recorder.record(
                    "OUTPUT_REJECTED",
                    coordinates,
                    detail("code", outputValidation.code()),
                    false);
            return outputRejected(
                    coordinates, report.rawReport(), outputValidation.code(), true);
        }
        recorder.record("OUTPUT_VALIDATED", coordinates, bindings(outputValidation), false);
        JsonNode output = report.canonicalOutput();
        return new InvocationExecution(
                TerminalState.SUCCEEDED,
                coordinates,
                new AffineBatchResult(
                        new Float32Tensor(
                                jsonIntegers(output.path("values").path("shape")),
                                jsonFloats(output.path("values").path("values"))),
                        output.path("rows").intValue()),
                null,
                report.rawReport(),
                true,
                recorder.healthy());
    }

    private InvocationExecution outputRejected(
            InvocationCoordinates coordinates,
            ObjectNode rawReport,
            String reason,
            boolean resultProduced) {
        return failureExecution(
                TerminalState.FAILED,
                coordinates,
                new InvocationFailure(
                        FailureCategory.INVOCATION_FAULT,
                        "OUTPUT_REJECTED",
                        "Worker output did not satisfy the frozen M1 contract: " + reason,
                        false,
                        false,
                        resultProduced,
                        "INVOCATION_MANAGER",
                        "host-output-validation"),
                true,
                rawReport);
    }

    private InvocationFailure mapWorkerFailure(WorkerFailureObservation failure) {
        String expectedCode = switch (failure.kind()) {
            case CONTRACT -> "WORKER_CONTRACT_REJECTED";
            case DEFINITION -> "DEFINITION_PREPARATION_FAILED";
            case RUNTIME -> "RUNTIME_EXECUTION_FAILED";
            case UNSPECIFIED -> null;
        };
        if (expectedCode == null
                || !failure.code().equals(expectedCode)
                || failure.retryable()
                || failure.originLayer().isBlank()
                || failure.causalReference().isBlank()) {
            return new InvocationFailure(
                    FailureCategory.CONTRACT_FAULT,
                    "WORKER_FAILURE_ENVELOPE_INVALID",
                    "Worker failure report is outside the bounded M2 carrier profile",
                    false,
                    false,
                    false,
                    "CONTRACT_CORE",
                    "worker-failure-envelope-validation");
        }
        FailureCategory category = switch (failure.kind()) {
            case CONTRACT -> FailureCategory.CONTRACT_FAULT;
            case DEFINITION -> FailureCategory.DEFINITION_FAULT;
            case RUNTIME -> FailureCategory.RUNTIME_FAULT;
            case UNSPECIFIED -> throw new IllegalStateException("validated worker failure kind changed");
        };
        return new InvocationFailure(
                category,
                expectedCode,
                publicWorkerSummary(category),
                false,
                false,
                false,
                failure.originLayer(),
                failure.causalReference());
    }

    private boolean coordinatesMatch(WorkerExecutionReport report, InvocationCoordinates expected) {
        var actual = report.coordinates();
        return actual.contractIdentity().equals(contract.identity())
                && actual.contractDigest().equals(contract.digest())
                && actual.definitionIdentity().equals(definitionIdentity)
                && actual.definitionDigest().equals(definitionDigest)
                && actual.invocationId().equals(expected.invocationId())
                && actual.attemptId().equals(expected.attemptId())
                && actual.traceId().equals(expected.traceId());
    }

    private AffineBatchInput toTypedInput(JsonNode input) {
        JsonNode tensor = input.path("values");
        return new AffineBatchInput(
                new Float32Tensor(
                        jsonIntegers(tensor.path("shape")),
                        jsonFloats(tensor.path("values"))),
                input.path("scale").floatValue(),
                input.path("bias").floatValue());
    }

    private ArrayList<Integer> jsonIntegers(JsonNode values) {
        ArrayList<Integer> result = new ArrayList<>();
        values.forEach(item -> result.add(item.intValue()));
        return result;
    }

    private ArrayList<Float> jsonFloats(JsonNode values) {
        ArrayList<Float> result = new ArrayList<>();
        values.forEach(item -> result.add(item.floatValue()));
        return result;
    }

    private InvocationExecution commitFailure(
            AtomicReference<InvocationExecution> terminal,
            TerminalState state,
            InvocationCoordinates coordinates,
            InvocationFailure failure,
            boolean dispatched,
            ObjectNode rawReport) {
        InvocationExecution candidate = failureExecution(
                state, coordinates, failure, dispatched, rawReport);
        if (terminal.compareAndSet(null, candidate)) {
            recorder.record(terminalEvent(state), coordinates, failureDetails(failure), false);
        }
        return withRecorderHealth(terminal.get());
    }

    private InvocationExecution withRecorderHealth(InvocationExecution execution) {
        if (execution == null || execution.evidenceRecorderHealthy() == recorder.healthy()) {
            return execution;
        }
        return new InvocationExecution(
                execution.state(),
                execution.coordinates(),
                execution.result(),
                execution.failure(),
                execution.rawWorkerReport(),
                execution.workerDispatched(),
                recorder.healthy());
    }

    private InvocationExecution failureExecution(
            TerminalState state,
            InvocationCoordinates coordinates,
            InvocationFailure failure,
            boolean dispatched,
            ObjectNode rawReport) {
        return new InvocationExecution(
                state,
                coordinates,
                null,
                failure,
                rawReport,
                dispatched,
                recorder.healthy());
    }

    private InvocationFailure deadlineFailure(boolean dispatched) {
        return new InvocationFailure(
                FailureCategory.INVOCATION_FAULT,
                "DEADLINE_EXCEEDED",
                "The authoritative invocation deadline elapsed",
                false,
                dispatched,
                false,
                "INVOCATION_MANAGER",
                "host-deadline");
    }

    private InvocationFailure cancellationFailure(boolean dispatched) {
        return new InvocationFailure(
                FailureCategory.INVOCATION_FAULT,
                "CANCELLED_BY_CALLER",
                "Caller cancellation won the terminal-state race",
                false,
                dispatched,
                false,
                "INVOCATION_MANAGER",
                "caller-cancellation");
    }

    private InvocationFailure transportFailure(String code, boolean dispatched) {
        return new InvocationFailure(
                FailureCategory.TRANSPORT_FAULT,
                code,
                code.equals("WORKER_UNAVAILABLE")
                        ? "The pinned worker endpoint was unavailable"
                        : "The established worker transport was interrupted",
                false,
                dispatched,
                false,
                "TRANSPORT_CAPABILITY",
                "transport-observation");
    }

    private String publicWorkerSummary(FailureCategory category) {
        return switch (category) {
            case CONTRACT_FAULT -> "Worker rejected the pinned contract or request coordinates";
            case DEFINITION_FAULT -> "The selected definition artifact could not be prepared";
            case RUNTIME_FAULT -> "The selected runtime failed during execution";
            default -> "Worker reported a bounded failure";
        };
    }

    private ObjectNode reportDetails(WorkerExecutionReport report) {
        ObjectNode details = JsonSupport.MAPPER.createObjectNode();
        details.put(
                "observation",
                report.canonicalOutput() != null ? "OUTPUT" : report.failure() != null ? "FAILURE" : "NONE");
        details.put("workerIdentity", report.workerIdentity());
        details.put("runtimeIdentity", report.runtimeIdentity());
        return details;
    }

    private ObjectNode pinnedDetails() {
        ObjectNode details = JsonSupport.MAPPER.createObjectNode();
        details.put("contractIdentity", contract.identity());
        details.put("contractDigest", contract.digest());
        details.put("definitionIdentity", definitionIdentity);
        details.put("definitionDigest", definitionDigest);
        return details;
    }

    private ObjectNode bindings(ValidationResult result) {
        ObjectNode details = JsonSupport.MAPPER.createObjectNode();
        ObjectNode node = details.putObject("bindings");
        result.bindings().forEach(node::put);
        return details;
    }

    private ObjectNode failureDetails(InvocationFailure failure) {
        ObjectNode details = JsonSupport.MAPPER.createObjectNode();
        details.put("category", failure.category().name());
        details.put("code", failure.code());
        details.put("executionMayContinue", failure.executionMayContinue());
        details.put("resultProducedButRejected", failure.resultProducedButRejected());
        return details;
    }

    private ObjectNode detail(String key, String value) {
        ObjectNode details = JsonSupport.MAPPER.createObjectNode();
        details.put(key, value);
        return details;
    }

    private String terminalEvent(TerminalState state) {
        return "TERMINAL_" + state.name();
    }

    private InvocationCoordinates coordinates() {
        return new InvocationCoordinates(
                "inv-" + UUID.randomUUID(),
                "att-" + UUID.randomUUID(),
                "trc-" + UUID.randomUUID(),
                contract.identity(),
                definitionIdentity);
    }

    private static String digest(Path path) throws IOException {
        try {
            return "sha256:" + HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
        transport.close();
        recorder.close();
    }
}

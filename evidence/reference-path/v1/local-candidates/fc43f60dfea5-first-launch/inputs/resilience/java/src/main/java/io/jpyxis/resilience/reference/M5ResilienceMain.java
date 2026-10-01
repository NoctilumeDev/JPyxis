package io.jpyxis.resilience.reference;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.DeploymentSnapshot;
import io.jpyxis.lifecycle.api.InvocationPin;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.api.LifecycleException;
import io.jpyxis.lifecycle.api.PinReleaseOutcome;
import io.jpyxis.lifecycle.core.ArtifactRegistry;
import io.jpyxis.lifecycle.core.DeploymentManager;
import io.jpyxis.lifecycle.evidence.InMemoryLifecycleJournal;
import io.jpyxis.resilience.api.AttemptObservation;
import io.jpyxis.resilience.api.AttemptPlan;
import io.jpyxis.resilience.api.DesiredBinding;
import io.jpyxis.resilience.api.IdempotencyMode;
import io.jpyxis.resilience.api.InvocationRequest;
import io.jpyxis.resilience.api.InvocationSnapshot;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.WorkerSnapshot;
import io.jpyxis.resilience.assembly.ControlRecoveryCoordinator;
import io.jpyxis.resilience.core.ControlIntentRegistry;
import io.jpyxis.resilience.core.ResilientInvocationManager;
import io.jpyxis.resilience.core.WorkerSupervisor;
import io.jpyxis.resilience.evidence.DurableResilienceJournal;
import io.jpyxis.resilience.evidence.EventOwner;
import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class M5ResilienceMain {
    private static final String SLOT = "affine-production";
    private static final String CONTRACT_IDENTITY = "jpyxis:contract:example/affine-batch@1.0.0";
    private static final String V1_IDENTITY = "jpyxis:definition:example/affine-batch-plan@1.0.0";
    private static final String V2_IDENTITY = "jpyxis:definition:example/affine-batch-plan@2.0.0";
    private static final ObjectMapper JSON = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private final String scenario;
    private final Path output;
    private final byte[] v1Bytes;
    private final byte[] v2Bytes;
    private final Map<String, Object> facts = new LinkedHashMap<>();
    private final List<ResilienceEvent> exportedTelemetry = new ArrayList<>();
    private int contextSequence;
    private int epochSequence;

    private String epoch;
    private ReferenceTelemetrySink telemetry;
    private DurableResilienceJournal journal;
    private LocalWorkerProcessControl processes;
    private WorkerSupervisor workers;
    private ControlIntentRegistry intents;
    private ResilientInvocationManager invocations;
    private InMemoryLifecycleJournal lifecycleJournal;
    private ArtifactRegistry artifacts;
    private DeploymentManager deployments;

    private M5ResilienceMain(String scenario, Path output, byte[] v1Bytes, byte[] v2Bytes) {
        this.scenario = scenario;
        this.output = output;
        this.v1Bytes = v1Bytes.clone();
        this.v2Bytes = v2Bytes.clone();
    }

    public static void main(String[] arguments) throws Exception {
        Map<String, String> args = parseArguments(arguments);
        M5ResilienceMain lab = new M5ResilienceMain(
                require(args, "scenario"),
                requiredPath(args, "out"),
                Files.readAllBytes(requiredPath(args, "artifact-v1")),
                Files.readAllBytes(requiredPath(args, "artifact-v2")));
        lab.run();
    }

    private void run() throws Exception {
        Files.createDirectories(output);
        openFreshControl(scenario.equals("telemetry_failure_isolated"));
        resetLifecycle();
        try {
            switch (scenario) {
                case "two_workers_eligible_route" -> twoWorkersEligibleRoute();
                case "load_failure_preserves_active" -> loadFailurePreservesActive();
                case "warmup_crash_preserves_active" -> warmupCrashPreservesActive();
                case "unknown_outcome_retry_denied" -> unknownOutcomeRetryDenied();
                case "deduplicated_retry_succeeds" -> deduplicatedRetrySucceeds();
                case "drain_crash_requires_termination" -> drainCrashRequiresTermination();
                case "unload_failure_preserves_active" -> unloadFailurePreservesActive();
                case "retry_budget_exhausted" -> retryBudgetExhausted();
                case "restart_blocks_unsafe_retry" -> restartBlocksUnsafeRetry();
                case "restart_reconciles_and_retries" -> restartReconcilesAndRetries();
                case "telemetry_failure_isolated" -> telemetryFailureIsolated();
                case "late_observation_cannot_rewrite_terminal" -> lateObservationCannotRewriteTerminal();
                default -> throw new IllegalArgumentException("unknown M5 scenario: " + scenario);
            }
        } finally {
            captureTelemetryAndCloseControl();
        }
        writeEvidence();
    }

    private void twoWorkersEligibleRoute() {
        startWorker("worker-a");
        startWorker("worker-b");
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        accept("route-a", IdempotencyMode.NONE, "", 1);
        AttemptPlan first = executeNext("route-a", executor);
        accept("route-b", IdempotencyMode.NONE, "", 1);
        AttemptPlan second = executeNext("route-b", executor);
        facts.put("firstWorkerId", first.worker().workerId());
        facts.put("secondWorkerId", second.worker().workerId());
        facts.put("bothWereEligible", first.worker().eligible() && second.worker().eligible());
        facts.put("liveProcessCount", processes.liveProcessCount());
        stopWorker("worker-a");
        stopWorker("worker-b");
    }

    private void loadFailurePreservesActive() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        FaultInjectingLifecycleRuntime stable = runtime("stable-load", FaultInjectingLifecycleRuntime.Stage.NONE);
        prepareAndActivate("dep-v1", v1, stable);
        FaultInjectingLifecycleRuntime failing = runtime("failing-load", FaultInjectingLifecycleRuntime.Stage.LOAD);
        deployments.request("dep-v2-load-failed", SLOT, v2, failing, lifecycle("request load-failing candidate"));
        String code = "NONE";
        try {
            deployments.load("dep-v2-load-failed", lifecycle("inject candidate load failure"));
        } catch (LifecycleException failure) {
            code = failure.code().name();
        }
        facts.put("failureCode", code);
        facts.put("activeDeploymentId", deployments.activeBindings().get(SLOT));
        facts.put("candidateState", deployments.snapshot("dep-v2-load-failed").state().name());
        facts.put("artifactCount", artifacts.snapshots().size());
    }

    private void warmupCrashPreservesActive() {
        startWorker("worker-a");
        startWorker("worker-b");
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        prepareAndActivate("dep-v1", v1, runtime("stable-warm", FaultInjectingLifecycleRuntime.Stage.NONE));
        FaultInjectingLifecycleRuntime failing = new FaultInjectingLifecycleRuntime(
                "failing-warm",
                FaultInjectingLifecycleRuntime.Stage.WARMUP,
                () -> processes.crashWorker("worker-a"));
        deployments.request("dep-v2-warm-failed", SLOT, v2, failing, lifecycle("request warm-failing candidate"));
        deployments.load("dep-v2-warm-failed", lifecycle("load warm-failing candidate"));
        String code = "NONE";
        try {
            deployments.warm("dep-v2-warm-failed", lifecycle("inject worker loss during warmup"));
        } catch (LifecycleException failure) {
            code = failure.code().name();
        }
        workers.observeFailure("worker-a", "WARMUP", "WORKER_PROCESS_EXITED", context("observe warmup crash"));
        facts.put("failureCode", code);
        facts.put("activeDeploymentId", deployments.activeBindings().get(SLOT));
        facts.put("candidateState", deployments.snapshot("dep-v2-warm-failed").state().name());
        facts.put("failedWorkerState", workers.snapshot("worker-a").state().name());
        facts.put("otherWorkerState", workers.snapshot("worker-b").state().name());
    }

    private void unknownOutcomeRetryDenied() {
        startWorker("worker-a");
        startWorker("worker-b");
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        executor.script("unsafe", new ReferenceAttemptExecutor.Step(
                AttemptObservation.unknown("TRANSPORT_INTERRUPTED"), true));
        accept("unsafe", IdempotencyMode.NONE, "", 2);
        AttemptPlan plan = executeNext("unsafe", executor);
        InvocationSnapshot snapshot = invocations.snapshot("unsafe");
        facts.put("attemptedWorkerId", plan.worker().workerId());
        facts.put("logicalState", snapshot.state().name());
        facts.put("attemptCount", snapshot.attempts().size());
        facts.put("failedWorkerState", workers.snapshot(plan.worker().workerId()).state().name());
        facts.put("remainingEligibleWorkers", workers.snapshots().stream().filter(WorkerSnapshot::eligible).count());
    }

    private void deduplicatedRetrySucceeds() {
        startWorker("worker-a");
        startWorker("worker-b");
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        String result = ReferenceAttemptExecutor.resultDigest("dedupe");
        executor.script(
                "dedupe",
                new ReferenceAttemptExecutor.Step(AttemptObservation.unknown("TRANSPORT_INTERRUPTED"), true),
                new ReferenceAttemptExecutor.Step(AttemptObservation.succeeded(result), false));
        accept("dedupe", IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION, "affine-result-v1", 2);
        AttemptPlan first = executeNext("dedupe", executor);
        AttemptPlan second = executeNext("dedupe", executor);
        InvocationSnapshot snapshot = invocations.snapshot("dedupe");
        facts.put("firstWorkerId", first.worker().workerId());
        facts.put("secondWorkerId", second.worker().workerId());
        facts.put("logicalState", snapshot.state().name());
        facts.put("attemptCount", snapshot.attempts().size());
        facts.put("resultDigest", snapshot.resultDigest());
    }

    private void drainCrashRequiresTermination() {
        startWorker("worker-a");
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        prepareAndActivate("dep-v1", v1, runtime("drain-runtime", FaultInjectingLifecycleRuntime.Stage.NONE));
        InvocationPin pin = deployments.pinInvocation(
                SLOT, "pin-drain", "inv-drain", lifecycle("pin accepted work"));
        deployments.drain("dep-v1", lifecycle("begin drain"));
        processes.crashWorker("worker-a");
        workers.observeFailure("worker-a", "DRAIN", "WORKER_PROCESS_EXITED", context("observe drain crash"));
        boolean drained = deployments.awaitDrain("dep-v1", Duration.ZERO, lifecycle("bounded drain wait"));
        int forced = deployments.requireForcedTermination("dep-v1", lifecycle("require forced termination"));
        deployments.unload("dep-v1", lifecycle("unload after forced requirement"));
        PinReleaseOutcome outcome = deployments.releasePin(pin.pinId(), lifecycle("acknowledge forced pin"));
        facts.put("drainedBeforeForce", drained);
        facts.put("forcedTerminationCount", forced);
        facts.put("pinReleaseOutcome", outcome.name());
        facts.put("workerState", workers.snapshot("worker-a").state().name());
    }

    private void unloadFailurePreservesActive() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        FaultInjectingLifecycleRuntime failing = runtime(
                "failing-unload", FaultInjectingLifecycleRuntime.Stage.UNLOAD);
        prepareAndActivate("dep-v1", v1, failing);
        prepareAndActivate("dep-v2", v2, runtime("stable-replacement", FaultInjectingLifecycleRuntime.Stage.NONE));
        String code = "NONE";
        try {
            deployments.unload("dep-v1", lifecycle("inject old deployment unload failure"));
        } catch (LifecycleException failure) {
            code = failure.code().name();
        }
        facts.put("failureCode", code);
        facts.put("oldDeploymentState", deployments.snapshot("dep-v1").state().name());
        facts.put("activeDeploymentId", deployments.activeBindings().get(SLOT));
        facts.put("activeArtifactIdentity", deployments.snapshot("dep-v2").artifact().identity());
    }

    private void retryBudgetExhausted() {
        startWorker("worker-a");
        startWorker("worker-b");
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        executor.script(
                "budget",
                new ReferenceAttemptExecutor.Step(AttemptObservation.unknown("TRANSPORT_INTERRUPTED_A"), true),
                new ReferenceAttemptExecutor.Step(AttemptObservation.unknown("TRANSPORT_INTERRUPTED_B"), true));
        accept("budget", IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION, "affine-result-v1", 2);
        executeNext("budget", executor);
        executeNext("budget", executor);
        InvocationSnapshot snapshot = invocations.snapshot("budget");
        facts.put("logicalState", snapshot.state().name());
        facts.put("attemptCount", snapshot.attempts().size());
        facts.put("terminalCode", snapshot.terminalCode());
        facts.put("eligibleWorkerCount", workers.snapshots().stream().filter(WorkerSnapshot::eligible).count());
    }

    private void restartBlocksUnsafeRetry() {
        startWorker("worker-a");
        accept("restart-unsafe", IdempotencyMode.NONE, "", 2);
        AttemptPlan pending = invocations.prepareAttempt(
                "restart-unsafe", context("persist unsafe dispatch intent"));
        String previousEpoch = epoch;
        restartControl();
        InvocationSnapshot recovered = invocations.snapshot("restart-unsafe");
        facts.put("previousEpoch", previousEpoch);
        facts.put("recoveredEpoch", epoch);
        facts.put("pendingAttemptId", pending.attemptId());
        facts.put("logicalState", recovered.state().name());
        facts.put("attemptCount", recovered.attempts().size());
        facts.put("workerStateAfterRecovery", workers.snapshot("worker-a").state().name());
    }

    private void restartReconcilesAndRetries() {
        ArtifactCoordinate original = registerValidated(V1_IDENTITY, v1Bytes);
        prepareAndActivate("dep-v1-before-restart", original,
                runtime("before-restart", FaultInjectingLifecycleRuntime.Stage.NONE));
        intents.set(
                new DesiredBinding(SLOT, V1_IDENTITY, original.digest(), 1),
                context("set desired v1 binding"));
        startWorker("worker-a");
        startWorker("worker-b");
        accept(
                "restart-safe",
                IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION,
                "affine-result-v1",
                2);
        AttemptPlan pending = invocations.prepareAttempt(
                "restart-safe", context("persist safe dispatch intent"));
        String previousEpoch = epoch;
        restartControl();
        resetLifecycle();
        DesiredBinding recoveredIntent = intents.require(SLOT);
        ControlRecoveryCoordinator recovery = new ControlRecoveryCoordinator(journal, epoch);
        DeploymentSnapshot active = recovery.reconcile(
                recoveredIntent,
                v1Bytes,
                CONTRACT_IDENTITY,
                "dep-v1-recovered",
                artifacts,
                deployments,
                runtime("after-restart", FaultInjectingLifecycleRuntime.Stage.NONE),
                context("reconcile desired binding after restart"));
        workers.start("worker-b", context("start worker-b in new epoch"));
        workers.probe("worker-b", context("probe worker-b in new epoch"));
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        executeNext("restart-safe", executor);
        InvocationSnapshot recovered = invocations.snapshot("restart-safe");
        facts.put("previousEpoch", previousEpoch);
        facts.put("recoveredEpoch", epoch);
        facts.put("pendingAttemptId", pending.attemptId());
        facts.put("logicalState", recovered.state().name());
        facts.put("attemptCount", recovered.attempts().size());
        facts.put("activeDeploymentId", active.deploymentId());
        facts.put("activeArtifactIdentity", active.artifact().identity());
        facts.put("desiredRevision", recoveredIntent.revision());
    }

    private void telemetryFailureIsolated() {
        startWorker("worker-a");
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        intents.set(new DesiredBinding(SLOT, V1_IDENTITY, v1.digest(), 1), context("set desired binding"));
        prepareAndActivate("dep-v1", v1, runtime("telemetry-runtime", FaultInjectingLifecycleRuntime.Stage.NONE));
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        accept("telemetry", IdempotencyMode.NONE, "", 1);
        executeNext("telemetry", executor);
        facts.put("logicalState", invocations.snapshot("telemetry").state().name());
        facts.put("workerState", workers.snapshot("worker-a").state().name());
        facts.put("activeDeploymentId", deployments.activeBindings().get(SLOT));
        facts.put("desiredRevision", intents.require(SLOT).revision());
        facts.put("telemetryFailureCount", journal.metrics().getOrDefault("telemetry.export_failures", 0L));
    }

    private void lateObservationCannotRewriteTerminal() {
        startWorker("worker-a");
        startWorker("worker-b");
        ReferenceAttemptExecutor executor = new ReferenceAttemptExecutor(processes);
        String result = ReferenceAttemptExecutor.resultDigest("late");
        executor.script(
                "late",
                new ReferenceAttemptExecutor.Step(AttemptObservation.unknown("TRANSPORT_INTERRUPTED"), true),
                new ReferenceAttemptExecutor.Step(AttemptObservation.succeeded(result), false));
        accept("late", IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION, "affine-result-v1", 2);
        AttemptPlan first = executeNext("late", executor);
        executeNext("late", executor);
        InvocationSnapshot before = invocations.snapshot("late");
        invocations.recordLateObservation(
                "late",
                first.attemptId(),
                AttemptObservation.succeeded(result),
                context("observe late first attempt result"));
        InvocationSnapshot after = invocations.snapshot("late");
        facts.put("stateBeforeLate", before.state().name());
        facts.put("stateAfterLate", after.state().name());
        facts.put("resultBeforeLate", before.resultDigest());
        facts.put("resultAfterLate", after.resultDigest());
    }

    private void openFreshControl(boolean failTelemetry) {
        epoch = "control-epoch-" + (++epochSequence);
        telemetry = new ReferenceTelemetrySink(failTelemetry);
        journal = new DurableResilienceJournal(output.resolve("control-state.jsonl"), telemetry);
        recordEpochStarted("open M5 reference control");
        processes = new LocalWorkerProcessControl();
        workers = new WorkerSupervisor(journal, processes, epoch);
        intents = new ControlIntentRegistry(journal, epoch);
        invocations = new ResilientInvocationManager(journal, workers, epoch);
    }

    private void restartControl() {
        captureTelemetryAndCloseControl();
        epoch = "control-epoch-" + (++epochSequence);
        telemetry = new ReferenceTelemetrySink(false);
        journal = new DurableResilienceJournal(output.resolve("control-state.jsonl"), telemetry);
        recordEpochStarted("restart M5 reference control");
        processes = new LocalWorkerProcessControl();
        workers = WorkerSupervisor.recover(journal, processes, epoch, context("fence recovered workers"));
        intents = ControlIntentRegistry.recover(journal, epoch);
        invocations = ResilientInvocationManager.recover(
                journal, workers, epoch, context("recover logical invocations"));
    }

    private void captureTelemetryAndCloseControl() {
        if (telemetry != null) exportedTelemetry.addAll(telemetry.exported());
        if (workers != null) workers.close();
        if (journal != null) journal.close();
    }

    private void resetLifecycle() {
        lifecycleJournal = new InMemoryLifecycleJournal();
        artifacts = new ArtifactRegistry(lifecycleJournal);
        deployments = new DeploymentManager(artifacts, lifecycleJournal);
    }

    private void recordEpochStarted(String cause) {
        ResilienceContext context = context(cause);
        journal.record(new ResilienceEventDraft(
                EventOwner.RECOVERY_COORDINATOR,
                "CONTROL_EPOCH_STARTED",
                epoch,
                context,
                "",
                "",
                "",
                Map.of("epochSequence", Integer.toString(epochSequence))));
    }

    private WorkerSnapshot startWorker(String workerId) {
        workers.register(workerId, context("register " + workerId));
        workers.start(workerId, context("start " + workerId));
        return workers.probe(workerId, context("probe " + workerId));
    }

    private void stopWorker(String workerId) {
        workers.stop(workerId, context("stop " + workerId));
    }

    private InvocationSnapshot accept(
            String logicalId,
            IdempotencyMode mode,
            String deduplicationScope,
            int maximumAttempts) {
        return invocations.accept(
                new InvocationRequest(
                        logicalId,
                        "trace-" + scenario + "-invocation-" + logicalId,
                        mode,
                        deduplicationScope,
                        maximumAttempts),
                context("accept " + logicalId));
    }

    private AttemptPlan executeNext(String logicalId, ReferenceAttemptExecutor executor) {
        AttemptPlan plan = invocations.prepareAttempt(logicalId, context("prepare " + logicalId));
        AttemptObservation observation = executor.execute(plan);
        invocations.recordObservation(plan, observation, context("record " + plan.attemptId()));
        return plan;
    }

    private ArtifactCoordinate registerValidated(String identity, byte[] bytes) {
        LifecycleContext context = lifecycle("register and validate " + identity);
        artifacts.register(identity, CONTRACT_IDENTITY, bytes, context);
        artifacts.beginValidation(identity, context);
        return artifacts.acceptValidation(identity, "jpyxis.m5.reference-validation/v1", context).coordinate();
    }

    private DeploymentSnapshot prepareAndActivate(
            String deploymentId,
            ArtifactCoordinate artifact,
            FaultInjectingLifecycleRuntime runtime) {
        deployments.request(deploymentId, SLOT, artifact, runtime, lifecycle("request " + deploymentId));
        deployments.load(deploymentId, lifecycle("load " + deploymentId));
        deployments.warm(deploymentId, lifecycle("warm " + deploymentId));
        return deployments.activate(deploymentId, lifecycle("activate " + deploymentId));
    }

    private FaultInjectingLifecycleRuntime runtime(
            String identity,
            FaultInjectingLifecycleRuntime.Stage stage) {
        return new FaultInjectingLifecycleRuntime(identity, stage, null);
    }

    private ResilienceContext context(String cause) {
        return new ResilienceContext(
                "m5-reference-control",
                cause,
                "trace-" + scenario + "-" + (++contextSequence));
    }

    private LifecycleContext lifecycle(String cause) {
        return new LifecycleContext(
                "m5-reference-control",
                cause,
                "trace-" + scenario + "-lifecycle-" + (++contextSequence));
    }

    private void writeEvidence() throws IOException {
        List<ResilienceEvent> events = readDurableEvents();
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("schemaVersion", "jpyxis.io/m5-authoritative-state/v1alpha1");
        state.put("scenarioId", scenario);
        state.put("controlEpoch", epoch);
        state.put("workers", workers.snapshots());
        state.put("invocations", invocations.snapshots());
        state.put("desiredBindings", intents.snapshots());
        state.put("resilienceMetrics", deriveMetrics(events));
        state.put("artifacts", artifacts.snapshots());
        state.put("deployments", deployments.snapshots());
        state.put("activeBindings", deployments.activeBindings());
        state.put("facts", facts);
        JSON.writeValue(output.resolve("authoritative-state.json").toFile(), state);
        JSON.writeValue(output.resolve("resilience-events.json").toFile(), events);
        JSON.writeValue(output.resolve("lifecycle-events.json").toFile(), lifecycleJournal.events());
        JSON.writeValue(output.resolve("telemetry-events.json").toFile(), exportedTelemetry);
    }

    private List<ResilienceEvent> readDurableEvents() {
        DurableResilienceJournal verifier = new DurableResilienceJournal(
                output.resolve("control-state.jsonl"), event -> { });
        try {
            return verifier.events();
        } finally {
            verifier.close();
        }
    }

    private Map<String, Long> deriveMetrics(List<ResilienceEvent> events) {
        io.jpyxis.resilience.evidence.ResilienceMetrics metrics =
                new io.jpyxis.resilience.evidence.ResilienceMetrics();
        events.forEach(metrics::observe);
        return metrics.snapshot();
    }

    private static Map<String, String> parseArguments(String[] arguments) {
        Map<String, String> values = new LinkedHashMap<>();
        for (int index = 0; index < arguments.length; index += 2) {
            if (index + 1 >= arguments.length || !arguments[index].startsWith("--")) {
                throw new IllegalArgumentException("arguments must be --name value pairs");
            }
            values.put(arguments[index].substring(2), arguments[index + 1]);
        }
        return values;
    }

    private static Path requiredPath(Map<String, String> arguments, String name) {
        return Path.of(require(arguments, name)).toAbsolutePath().normalize();
    }

    private static String require(Map<String, String> arguments, String name) {
        String value = arguments.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("missing --" + name);
        }
        return value;
    }
}

package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.*;
import io.jpyxis.resilience.evidence.*;
import io.jpyxis.resilience.port.WorkerControl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Path;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class CoordinateValidationTest {
    private static final ResilienceContext CONTEXT = new ResilienceContext("coordinate-test", "v2 boundary", "trace-test");
    @TempDir Path temporaryDirectory;

    @ParameterizedTest
    @ValueSource(strings = {"worker", "instance", "epoch", "trace", "number", "mode", "scope", "nullWorker", "nullMode", "nullScope"})
    void substitutedPlanCannotRecordObservationOrChangeOwnedState(String field) {
        try (Fixture fixture = fixture(IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION, 2)) {
            AttemptPlan plan = fixture.plan;
            InvocationSnapshot before = fixture.manager.snapshot("logical");
            WorkerSnapshot workerBefore = fixture.workers.snapshot("worker-a");
            int boundary = fixture.journal.events().size();
            ResilienceException rejected = assertThrows(ResilienceException.class, () -> fixture.manager.recordObservation(
                    substitute(plan, field), AttemptObservation.succeeded("sha256:result"), CONTEXT));
            assertEquals(ResilienceException.Code.ATTEMPT_COORDINATE_MISMATCH, rejected.code());
            assertEquals(before, fixture.manager.snapshot("logical"));
            assertEquals(workerBefore, fixture.workers.snapshot("worker-a"));
            List<ResilienceEvent> effects = fixture.journal.events().subList(boundary, fixture.journal.events().size());
            assertEquals(1, effects.size());
            assertEquals("ATTEMPT_INPUT_REJECTED", effects.get(0).event());
            assertEquals(EventOwner.RESILIENT_INVOCATION_MANAGER, effects.get(0).owner());
            assertFalse(effects.get(0).details().containsKey("newState"));
            assertEquals(LogicalInvocationState.SUCCEEDED, fixture.manager.recordObservation(
                    plan, AttemptObservation.succeeded("sha256:honest"), CONTEXT).state());
        }
    }

    @Test
    void nullPlanHasTypedRejectionWithoutAStateChange() {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            InvocationSnapshot before = fixture.manager.snapshot("logical");
            ResilienceException rejected = assertThrows(ResilienceException.class, () -> fixture.manager.recordObservation(
                    null, AttemptObservation.unknown("LOST"), CONTEXT));
            assertEquals(ResilienceException.Code.ATTEMPT_COORDINATE_MISMATCH, rejected.code());
            assertEquals(before, fixture.manager.snapshot("logical"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"worker", "instance", "epoch", "null"})
    void foreignStartIsRejectedBeforePinProbeRoutingOrForeignStop(String field) {
        MemoryJournal journal = new MemoryJournal();
        Control control = new Control();
        control.foreignField = field;
        try (WorkerSupervisor workers = new WorkerSupervisor(journal, control, "epoch-1")) {
            workers.register("worker-a", CONTEXT);
            WorkerSnapshot failed = workers.start("worker-a", CONTEXT);
            assertEquals(WorkerState.FAILED, failed.state());
            assertEquals(0, failed.processId());
            assertThrows(ResilienceException.class, () -> workers.probe("worker-a", CONTEXT));
            assertThrows(ResilienceException.class, workers::selectEligible);
            assertEquals(0, control.probes);
            assertEquals(0, control.stops);
            assertFalse(journal.events().stream().anyMatch(event -> event.event().equals("WORKER_HANDLE_PINNED")));
            assertTrue(journal.events().stream().anyMatch(event -> event.event().equals("WORKER_HANDLE_REJECTED")
                    && event.details().get("code").equals("WORKER_COORDINATE_MISMATCH")));
        }
    }

    @Test
    void terminalBranchRejectsForeignPlanButAcceptsMatchingHistoricalLivenessChanges() {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            InvocationSnapshot terminal = fixture.manager.recordObservation(
                    fixture.plan, AttemptObservation.succeeded("sha256:stable"), CONTEXT);
            long lateBefore = count(fixture.journal, "LATE_ATTEMPT_OBSERVED");
            ResilienceException rejected = assertThrows(ResilienceException.class, () -> fixture.manager.recordObservation(
                    substitute(fixture.plan, "epoch"), AttemptObservation.unknown("LATE"), CONTEXT));
            assertEquals(ResilienceException.Code.ATTEMPT_COORDINATE_MISMATCH, rejected.code());
            assertEquals(lateBefore, count(fixture.journal, "LATE_ATTEMPT_OBSERVED"));
            assertEquals(terminal, fixture.manager.snapshot("logical"));
            WorkerSnapshot original = fixture.plan.worker();
            AttemptPlan historical = copy(fixture.plan, new WorkerSnapshot(original.workerId(), WorkerState.INELIGIBLE,
                    original.instanceId(), original.controlEpoch(), 0), fixture.plan.traceId(), fixture.plan.attemptNumber(),
                    fixture.plan.idempotencyMode(), fixture.plan.deduplicationScope());
            assertEquals(terminal, fixture.manager.recordObservation(historical, AttemptObservation.unknown("LATE"), CONTEXT));
            assertEquals(lateBefore + 1, count(fixture.journal, "LATE_ATTEMPT_OBSERVED"));
            assertEquals(1, count(fixture.journal, "INVOCATION_TERMINAL_SUCCEEDED"));
            fixture.manager.recordLateObservation("logical", fixture.plan.attemptId(), AttemptObservation.unknown("ASSOCIATED"), CONTEXT);
            assertTrue(fixture.journal.events().stream().anyMatch(event -> event.event().equals("LATE_ATTEMPT_OBSERVED")
                    && "ASSOCIATION_ONLY".equals(event.details().get("provenance"))));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"success", "before", "after", "unknown"})
    void oldReportKeepsLogicalMeaningWithoutPoisoningReplacement(String observation) {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            replace(fixture.workers);
            WorkerSnapshot replacement = fixture.workers.snapshot("worker-a");
            int boundary = fixture.journal.events().size();
            InvocationSnapshot result = fixture.manager.recordObservation(fixture.plan, observation(observation), CONTEXT);
            LogicalInvocationState expected = switch (observation) {
                case "success" -> LogicalInvocationState.SUCCEEDED;
                case "unknown" -> LogicalInvocationState.OUTCOME_UNKNOWN;
                default -> LogicalInvocationState.FAILED;
            };
            assertEquals(expected, result.state());
            assertEquals(replacement, fixture.workers.snapshot("worker-a"));
            assertEquals(WorkerState.ELIGIBLE, replacement.state());
            assertTrue(fixture.journal.events().subList(boundary, fixture.journal.events().size()).stream()
                    .noneMatch(event -> event.owner() == EventOwner.WORKER_SUPERVISOR && event.details().containsKey("newState")));
            if (observation.equals("unknown")) assertTrue(fixture.journal.events().stream().anyMatch(event ->
                    event.event().equals("WORKER_INSTANCE_OBSERVATION_IGNORED")
                    && fixture.plan.worker().instanceId().equals(event.details().get("originatingInstanceId"))
                    && replacement.instanceId().equals(event.details().get("currentInstanceId"))));
        }
    }

    @Test
    void sameInstanceUnknownAndWorkerWideActionRetainTheirSeparateEffects() {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            assertEquals(LogicalInvocationState.OUTCOME_UNKNOWN, fixture.manager.recordObservation(
                    fixture.plan, AttemptObservation.unknown("LOST"), CONTEXT).state());
            assertEquals(WorkerState.INELIGIBLE, fixture.workers.snapshot("worker-a").state());
            assertTrue(fixture.journal.events().stream().anyMatch(event -> event.event().equals("WORKER_INELIGIBLE")
                    && "INSTANCE_SCOPED".equals(event.details().get("scope"))));
            fixture.workers.start("worker-a", CONTEXT);
            fixture.workers.probe("worker-a", CONTEXT);
            fixture.workers.observeFailure("worker-a", "OPERATOR", "EXPLICIT_ACTION", CONTEXT);
            assertEquals(WorkerState.INELIGIBLE, fixture.workers.snapshot("worker-a").state());
            assertTrue(fixture.journal.events().stream().anyMatch(event -> event.event().equals("WORKER_INELIGIBLE")
                    && "LOGICAL_WORKER_ACTION".equals(event.details().get("scope"))));
        }
    }

    @Test
    void replacementBetweenHealthCheckAndApplyIsComparedInsideSupervisor() throws Exception {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            CountDownLatch healthEntered = new CountDownLatch(1);
            CountDownLatch healthReleased = new CountDownLatch(1);
            AtomicBoolean first = new AtomicBoolean(true);
            fixture.control.beforeHealth = () -> {
                if (first.getAndSet(false)) {
                    healthEntered.countDown();
                    try { assertTrue(healthReleased.await(5, TimeUnit.SECONDS)); }
                    catch (InterruptedException interrupted) { throw new IllegalStateException(interrupted); }
                }
            };
            var executor = Executors.newSingleThreadExecutor();
            try {
                var effect = executor.submit(() -> fixture.workers.observeInstanceFailure(
                        fixture.plan.worker(), "INVOCATION", "OLD_FAULT", CONTEXT));
                assertTrue(healthEntered.await(5, TimeUnit.SECONDS));
                replace(fixture.workers);
                WorkerSnapshot replacement = fixture.workers.snapshot("worker-a");
                healthReleased.countDown();
                assertEquals(replacement, effect.get(5, TimeUnit.SECONDS));
                assertEquals(replacement, fixture.workers.snapshot("worker-a"));
                assertEquals(WorkerState.ELIGIBLE, replacement.state());
            } finally {
                healthReleased.countDown();
                executor.shutdownNow();
                assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
            }
        }
    }

    @Test
    void anInProgressStartCannotProbeThePreviousInstancesHandle() throws Exception {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            fixture.workers.observeFailure("worker-a", "OPERATOR", "REPLACE", CONTEXT);
            CountDownLatch startEntered = new CountDownLatch(1);
            CountDownLatch startReleased = new CountDownLatch(1);
            fixture.control.beforeStart = () -> {
                startEntered.countDown();
                try { assertTrue(startReleased.await(5, TimeUnit.SECONDS)); }
                catch (InterruptedException interrupted) { throw new IllegalStateException(interrupted); }
            };
            var executor = Executors.newSingleThreadExecutor();
            try {
                var start = executor.submit(() -> fixture.workers.start("worker-a", CONTEXT));
                assertTrue(startEntered.await(5, TimeUnit.SECONDS));
                int probes = fixture.control.probes;
                assertThrows(ResilienceException.class, () -> fixture.workers.probe("worker-a", CONTEXT));
                assertThrows(ResilienceException.class, fixture.workers::selectEligible);
                assertEquals(probes, fixture.control.probes);
                startReleased.countDown();
                assertEquals(WorkerState.STARTING, start.get(5, TimeUnit.SECONDS).state());
            } finally {
                startReleased.countDown();
                executor.shutdownNow();
                assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
            }
        }
    }

    @Test
    void failedRequiredDiagnosticCannotAdmitOrChangeState() {
        try (Fixture fixture = fixture(IdempotencyMode.NONE, 1)) {
            InvocationSnapshot before = fixture.manager.snapshot("logical");
            fixture.journal.failEvent = "ATTEMPT_INPUT_REJECTED";
            assertThrows(IllegalStateException.class, () -> fixture.manager.recordObservation(
                    substitute(fixture.plan, "epoch"), AttemptObservation.succeeded("sha256:bad"), CONTEXT));
            assertEquals(before, fixture.manager.snapshot("logical"));
            fixture.journal.failEvent = "";
            replace(fixture.workers);
            WorkerSnapshot replacement = fixture.workers.snapshot("worker-a");
            fixture.journal.failEvent = "WORKER_INSTANCE_OBSERVATION_IGNORED";
            assertThrows(IllegalStateException.class, () -> fixture.workers.observeInstanceFailure(
                    fixture.plan.worker(), "INVOCATION", "OLD_FAULT", CONTEXT));
            assertEquals(replacement, fixture.workers.snapshot("worker-a"));
        }
    }

    @Test
    void currentEpochMismatchFailsBeforeAcceptanceOrRecoveryActivity() {
        MemoryJournal journal = new MemoryJournal();
        try (WorkerSupervisor workers = new WorkerSupervisor(journal, new Control(), "epoch-1")) {
            assertEquals(ResilienceException.Code.CONTROL_EPOCH_MISMATCH, assertThrows(ResilienceException.class,
                    () -> new ResilientInvocationManager(journal, workers, "epoch-2")).code());
            assertEquals(ResilienceException.Code.CONTROL_EPOCH_MISMATCH, assertThrows(ResilienceException.class,
                    () -> ResilientInvocationManager.recover(journal, workers, "epoch-2", CONTEXT)).code());
            assertTrue(journal.events().isEmpty());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"workerEpoch", "workerInstanceId", "idempotencyMode", "deduplicationScope", "attemptNumber"})
    void verifiedDurableChainWithInconsistentReplayCopiesFailsBeforeRecoveryDecision(String field) throws Exception {
        String retainedRoot = System.getProperty("jpyxis.coordinate.evidenceRoot");
        Path directory = retainedRoot == null ? temporaryDirectory : Path.of(retainedRoot);
        Files.createDirectories(directory);
        Path file = directory.resolve("replay-" + field + ".jsonl");
        assertFalse(Files.exists(file), "retain a prior replay fixture; do not overwrite it");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor workers = new WorkerSupervisor(journal, new Control(), "epoch-1")) {
            eligible(workers);
            ResilienceJournal corrupted = new ResilienceJournal() {
                public ResilienceEvent record(ResilienceEventDraft draft) {
                    String target = field.equals("workerEpoch") ? "INVOCATION_ATTEMPTING" : "ATTEMPT_DISPATCH_INTENT";
                    if (draft.event().equals(target)) {
                        Map<String, String> details = new LinkedHashMap<>(draft.details());
                        details.put(field, field.equals("attemptNumber") ? "3"
                                : field.equals("idempotencyMode") ? "DEDUPLICATED_BY_LOGICAL_INVOCATION" : "foreign");
                        draft = new ResilienceEventDraft(draft.owner(), draft.event(), draft.controlEpoch(), draft.context(),
                                draft.logicalInvocationId(), draft.attemptId(), draft.workerId(), details);
                    }
                    return journal.record(draft);
                }
                public List<ResilienceEvent> events() { return journal.events(); }
                public void close() { }
            };
            ResilientInvocationManager manager = new ResilientInvocationManager(corrupted, workers, "epoch-1");
            manager.accept(new InvocationRequest("logical", "logical-trace", IdempotencyMode.NONE, "", 1), CONTEXT);
            manager.prepareAttempt("logical", CONTEXT);
        }
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor workers = WorkerSupervisor.recover(journal, new Control(), "epoch-2", CONTEXT)) {
            int before = journal.events().size();
            assertEquals(ResilienceException.Code.DURABLE_JOURNAL_INVALID, assertThrows(ResilienceException.class,
                    () -> ResilientInvocationManager.recover(journal, workers, "epoch-2", CONTEXT)).code());
            assertEquals(before, journal.events().size());
        }
    }

    @Test
    void repeatedRecoveryKeepsUnknownHistoryAndValidOldReportWithoutNewEligibility() {
        Path file = temporaryDirectory.resolve("repeated-recovery.jsonl");
        AttemptPlan old;
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor workers = new WorkerSupervisor(journal, new Control(), "epoch-1")) {
            eligible(workers);
            ResilientInvocationManager manager = new ResilientInvocationManager(journal, workers, "epoch-1");
            manager.accept(new InvocationRequest("logical", "logical-trace", IdempotencyMode.NONE, "", 1), CONTEXT);
            old = manager.prepareAttempt("logical", CONTEXT);
        }
        for (String epoch : List.of("epoch-2", "epoch-3")) {
            try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
                 WorkerSupervisor workers = WorkerSupervisor.recover(journal, new Control(), epoch, CONTEXT)) {
                ResilientInvocationManager manager = ResilientInvocationManager.recover(journal, workers, epoch, CONTEXT);
                assertEquals(LogicalInvocationState.OUTCOME_UNKNOWN, manager.snapshot("logical").state());
                assertEquals(AttemptObservationKind.UNKNOWN_REMOTE_OUTCOME,
                        manager.snapshot("logical").attempts().get(0).observation());
                workers.start("worker-a", CONTEXT);
                workers.probe("worker-a", CONTEXT);
                WorkerSnapshot replacement = workers.snapshot("worker-a");
                manager.recordObservation(old, AttemptObservation.succeeded("sha256:late"), CONTEXT);
                assertEquals(LogicalInvocationState.OUTCOME_UNKNOWN, manager.snapshot("logical").state());
                assertEquals(replacement, workers.snapshot("worker-a"));
            }
        }
    }

    private Fixture fixture(IdempotencyMode mode, int budget) {
        MemoryJournal journal = new MemoryJournal();
        Control control = new Control();
        WorkerSupervisor workers = new WorkerSupervisor(journal, control, "epoch-1");
        eligible(workers);
        ResilientInvocationManager manager = new ResilientInvocationManager(journal, workers, "epoch-1");
        manager.accept(new InvocationRequest("logical", "logical-trace", mode,
                mode == IdempotencyMode.NONE ? "" : "scope-original", budget), CONTEXT);
        return new Fixture(journal, control, workers, manager, manager.prepareAttempt("logical", CONTEXT));
    }

    private static void eligible(WorkerSupervisor workers) {
        workers.register("worker-a", CONTEXT);
        workers.start("worker-a", CONTEXT);
        workers.probe("worker-a", CONTEXT);
    }

    private static void replace(WorkerSupervisor workers) {
        workers.observeFailure("worker-a", "OPERATOR", "REPLACE", CONTEXT);
        workers.start("worker-a", CONTEXT);
        workers.probe("worker-a", CONTEXT);
    }

    private static AttemptObservation observation(String kind) {
        return switch (kind) {
            case "success" -> AttemptObservation.succeeded("sha256:result");
            case "before" -> AttemptObservation.failedBeforeExecution("BEFORE");
            case "after" -> AttemptObservation.failedAfterExecution("AFTER");
            default -> AttemptObservation.unknown("UNKNOWN");
        };
    }

    private static AttemptPlan substitute(AttemptPlan plan, String field) {
        WorkerSnapshot worker = plan.worker();
        WorkerSnapshot changed = new WorkerSnapshot(field.equals("worker") ? "foreign" : worker.workerId(), worker.state(),
                field.equals("instance") ? "foreign" : worker.instanceId(),
                field.equals("epoch") ? "foreign" : worker.controlEpoch(), worker.processId());
        return copy(plan, field.equals("nullWorker") ? null : changed,
                field.equals("trace") ? "foreign" : plan.traceId(), field.equals("number") ? 2 : plan.attemptNumber(),
                field.equals("nullMode") ? null : field.equals("mode") ? IdempotencyMode.NONE : plan.idempotencyMode(),
                field.equals("nullScope") ? null : field.equals("scope") ? "foreign" : plan.deduplicationScope());
    }

    private static AttemptPlan copy(AttemptPlan plan, WorkerSnapshot worker, String trace, int number,
                                    IdempotencyMode mode, String scope) {
        return new AttemptPlan(plan.logicalInvocationId(), plan.attemptId(), trace, number, worker, mode, scope);
    }

    private static long count(ResilienceJournal journal, String event) {
        return journal.events().stream().filter(item -> item.event().equals(event)).count();
    }

    private record Fixture(MemoryJournal journal, Control control, WorkerSupervisor workers,
                           ResilientInvocationManager manager, AttemptPlan plan) implements AutoCloseable {
        public void close() { workers.close(); journal.close(); }
    }

    private static final class MemoryJournal implements ResilienceJournal {
        private final List<ResilienceEvent> events = new ArrayList<>();
        private String failEvent = "";
        public synchronized ResilienceEvent record(ResilienceEventDraft draft) {
            if (failEvent.equals(draft.event())) throw new IllegalStateException("required append failed");
            ResilienceEvent event = new ResilienceEvent(events.size() + 1, "test-only", "test-only", draft.owner(),
                    draft.event(), draft.controlEpoch(), draft.context().actor(), draft.context().cause(),
                    draft.context().traceId(), draft.logicalInvocationId(), draft.attemptId(), draft.workerId(), draft.details());
            events.add(event);
            return event;
        }
        public synchronized List<ResilienceEvent> events() { return List.copyOf(events); }
        public void close() { }
    }

    private static final class Control implements WorkerControl {
        private String foreignField = "";
        private long pid = 100;
        private int probes;
        private int stops;
        private Runnable beforeHealth = () -> { };
        private Runnable beforeStart = () -> { };
        public WorkerHandle start(String worker, String instance, String epoch) {
            beforeStart.run();
            if (foreignField.equals("null")) return null;
            return new WorkerHandle(foreignField.equals("worker") ? "foreign" : worker,
                    foreignField.equals("instance") ? "foreign" : instance,
                    foreignField.equals("epoch") ? "foreign" : epoch, ++pid);
        }
        public boolean isHealthy(WorkerHandle handle) { probes++; beforeHealth.run(); return true; }
        public void stop(WorkerHandle handle) { stops++; }
        public void close() { }
    }
}

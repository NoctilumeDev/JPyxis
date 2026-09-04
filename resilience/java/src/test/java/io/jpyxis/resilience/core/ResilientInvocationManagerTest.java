package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.AttemptObservation;
import io.jpyxis.resilience.api.AttemptObservationKind;
import io.jpyxis.resilience.api.AttemptPlan;
import io.jpyxis.resilience.api.IdempotencyMode;
import io.jpyxis.resilience.api.InvocationRequest;
import io.jpyxis.resilience.api.InvocationSnapshot;
import io.jpyxis.resilience.api.LogicalInvocationState;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.evidence.DurableResilienceJournal;
import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;
import io.jpyxis.resilience.evidence.ResilienceJournal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResilientInvocationManagerTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void uncertainNonIdempotentAttemptIsNotRetried() {
        try (Fixture fixture = fixture("unsafe", "epoch-1", 2)) {
            ResilientInvocationManager manager = fixture.manager();
            manager.accept(request("unsafe", IdempotencyMode.NONE, "", 2), context("accept"));
            AttemptPlan first = manager.prepareAttempt("unsafe", context("dispatch"));

            InvocationSnapshot result = manager.recordObservation(
                    first,
                    AttemptObservation.unknown("CHANNEL_LOST"),
                    context("observe"));

            assertEquals(LogicalInvocationState.OUTCOME_UNKNOWN, result.state());
            assertEquals(1, result.attempts().size());
            assertEquals(1L, fixture.journal().metrics().get("retries.denied"));
        }
    }

    @Test
    void acceptedDeduplicationAllowsOneBoundedRetry() {
        try (Fixture fixture = fixture("dedupe", "epoch-1", 2)) {
            ResilientInvocationManager manager = fixture.manager();
            manager.accept(request(
                    "dedupe",
                    IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION,
                    "logical-invocation-id",
                    2), context("accept"));
            AttemptPlan first = manager.prepareAttempt("dedupe", context("dispatch-one"));
            InvocationSnapshot pending = manager.recordObservation(
                    first,
                    AttemptObservation.unknown("CHANNEL_LOST"),
                    context("observe-one"));
            assertEquals(LogicalInvocationState.RETRY_PENDING, pending.state());

            AttemptPlan second = manager.prepareAttempt("dedupe", context("dispatch-two"));
            assertEquals(2, second.attemptNumber());
            assertNotEquals(first.attemptId(), second.attemptId());
            assertNotEquals(first.worker().workerId(), second.worker().workerId());
            InvocationSnapshot complete = manager.recordObservation(
                    second,
                    AttemptObservation.succeeded("sha256:result"),
                    context("observe-two"));

            assertEquals(LogicalInvocationState.SUCCEEDED, complete.state());
            assertEquals(2, complete.attempts().size());
            assertEquals(1L, fixture.journal().metrics().get("retries.allowed"));
        }
    }

    @Test
    void retryBudgetCannotBeExceeded() {
        try (Fixture fixture = fixture("budget", "epoch-1", 1)) {
            ResilientInvocationManager manager = fixture.manager();
            manager.accept(request(
                    "budget",
                    IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION,
                    "logical-invocation-id",
                    1), context("accept"));
            AttemptPlan attempt = manager.prepareAttempt("budget", context("dispatch"));

            InvocationSnapshot result = manager.recordObservation(
                    attempt,
                    AttemptObservation.unknown("TIMEOUT"),
                    context("observe"));

            assertEquals(LogicalInvocationState.OUTCOME_UNKNOWN, result.state());
            assertEquals(1, result.attempts().size());
            assertEquals(1L, fixture.journal().metrics().get("retries.denied"));
        }
    }

    @Test
    void lateObservationIsRetainedButCannotRewriteTerminalSuccess() {
        try (Fixture fixture = fixture("late", "epoch-1", 1)) {
            ResilientInvocationManager manager = fixture.manager();
            manager.accept(request("late", IdempotencyMode.NONE, "", 1), context("accept"));
            AttemptPlan attempt = manager.prepareAttempt("late", context("dispatch"));
            InvocationSnapshot succeeded = manager.recordObservation(
                    attempt,
                    AttemptObservation.succeeded("sha256:stable"),
                    context("success"));

            InvocationSnapshot afterLate = manager.recordLateObservation(
                    "late",
                    attempt.attemptId(),
                    AttemptObservation.failedAfterExecution("LATE_FAILURE"),
                    context("late"));

            assertEquals(succeeded.state(), afterLate.state());
            assertEquals(succeeded.resultDigest(), afterLate.resultDigest());
            assertTrue(fixture.journal().events().stream()
                    .anyMatch(event -> event.event().equals("LATE_ATTEMPT_IGNORED")));
        }
    }

    @Test
    void restartTurnsUnobservedDispatchIntoRetryOnlyWithEvidence() {
        Path file = temporaryDirectory.resolve("restart.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor supervisor = eligibleSupervisor(journal, new TestWorkerControl(), "epoch-1", 1)) {
            ResilientInvocationManager manager = new ResilientInvocationManager(journal, supervisor, "epoch-1");
            manager.accept(request(
                    "restart",
                    IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION,
                    "logical-invocation-id",
                    2), context("accept"));
            manager.prepareAttempt("restart", context("dispatch"));
        }

        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor supervisor = WorkerSupervisor.recover(
                     journal, new TestWorkerControl(), "epoch-2", context("fence"))) {
            supervisor.start("worker-a", context("restart-worker"));
            supervisor.probe("worker-a", context("reprobe"));
            ResilientInvocationManager recovered = ResilientInvocationManager.recover(
                    journal, supervisor, "epoch-2", context("recover"));

            InvocationSnapshot pending = recovered.snapshot("restart");
            assertEquals(LogicalInvocationState.RETRY_PENDING, pending.state());
            assertEquals(1, pending.attempts().size());
            AttemptPlan retry = recovered.prepareAttempt("restart", context("retry"));
            assertEquals(2, retry.attemptNumber());
        }
    }

    @Test
    void restartDistinguishesReservedAttemptFromDurableDispatchIntent() {
        Path file = temporaryDirectory.resolve("pre-dispatch.jsonl");
        try (DurableResilienceJournal durable = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor supervisor = eligibleSupervisor(durable, new TestWorkerControl(), "epoch-1", 1)) {
            ResilientInvocationManager manager = new ResilientInvocationManager(
                    new FailBeforeDispatchJournal(durable), supervisor, "epoch-1");
            manager.accept(request("not-dispatched", IdempotencyMode.NONE, "", 1), context("accept"));
            assertThrows(
                    IllegalStateException.class,
                    () -> manager.prepareAttempt("not-dispatched", context("reserve")));
        }

        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor supervisor = WorkerSupervisor.recover(
                     journal, new TestWorkerControl(), "epoch-2", context("fence"))) {
            ResilientInvocationManager recovered = ResilientInvocationManager.recover(
                    journal, supervisor, "epoch-2", context("recover"));
            InvocationSnapshot result = recovered.snapshot("not-dispatched");

            assertEquals(LogicalInvocationState.FAILED, result.state());
            assertEquals("CONTROL_RESTART_BEFORE_DISPATCH", result.terminalCode());
            assertEquals(AttemptObservationKind.FAILED_BEFORE_EXECUTION, result.attempts().get(0).observation());
            assertTrue(journal.events().stream()
                    .anyMatch(event -> event.event().equals("ATTEMPT_RECOVERED_NOT_DISPATCHED")));
        }
    }

    private Fixture fixture(String name, String epoch, int workerCount) {
        DurableResilienceJournal journal = new DurableResilienceJournal(
                temporaryDirectory.resolve(name + ".jsonl"), event -> { });
        WorkerSupervisor supervisor = eligibleSupervisor(journal, new TestWorkerControl(), epoch, workerCount);
        return new Fixture(journal, supervisor, new ResilientInvocationManager(journal, supervisor, epoch));
    }

    private WorkerSupervisor eligibleSupervisor(
            DurableResilienceJournal journal,
            TestWorkerControl control,
            String epoch,
            int workerCount) {
        WorkerSupervisor supervisor = new WorkerSupervisor(journal, control, epoch);
        for (int index = 0; index < workerCount; index++) {
            String workerId = "worker-" + (char) ('a' + index);
            supervisor.register(workerId, context("register-" + workerId));
            supervisor.start(workerId, context("start-" + workerId));
            supervisor.probe(workerId, context("probe-" + workerId));
        }
        return supervisor;
    }

    private InvocationRequest request(
            String id,
            IdempotencyMode mode,
            String scope,
            int maximumAttempts) {
        return new InvocationRequest(id, "logical-trace-" + id, mode, scope, maximumAttempts);
    }

    private ResilienceContext context(String cause) {
        return new ResilienceContext("test", cause, "trace-" + cause);
    }

    private record Fixture(
            DurableResilienceJournal journal,
            WorkerSupervisor supervisor,
            ResilientInvocationManager manager) implements AutoCloseable {
        @Override
        public void close() {
            supervisor.close();
            journal.close();
        }
    }

    private record FailBeforeDispatchJournal(ResilienceJournal delegate) implements ResilienceJournal {
        @Override
        public ResilienceEvent record(ResilienceEventDraft draft) {
            if (draft.event().equals("ATTEMPT_DISPATCH_INTENT")) {
                throw new IllegalStateException("injected durable append failure");
            }
            return delegate.record(draft);
        }

        @Override
        public List<ResilienceEvent> events() {
            return delegate.events();
        }

        @Override
        public void close() {
        }
    }
}

package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.api.WorkerSnapshot;
import io.jpyxis.resilience.api.WorkerState;
import io.jpyxis.resilience.evidence.DurableResilienceJournal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkerSupervisorTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void routesOnlyAcrossEligibleWorkersAndIsolatesFailure() {
        try (DurableResilienceJournal journal = journal("routing");
             WorkerSupervisor supervisor = new WorkerSupervisor(journal, new TestWorkerControl(), "epoch-1")) {
            makeEligible(supervisor, "worker-a");
            makeEligible(supervisor, "worker-b");

            WorkerSnapshot first = supervisor.selectEligible();
            WorkerSnapshot second = supervisor.selectEligible();
            assertNotEquals(first.workerId(), second.workerId());

            supervisor.observeFailure(first.workerId(), "INVOKE", "CHANNEL_LOST", context("fault"));
            assertEquals(WorkerState.INELIGIBLE, supervisor.snapshot(first.workerId()).state());
            assertEquals(second.workerId(), supervisor.selectEligible().workerId());
        }
    }

    @Test
    void restartFencesEveryPreviouslyLiveWorkerUntilANewProbe() {
        Path file = temporaryDirectory.resolve("recovery.jsonl");
        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor original = new WorkerSupervisor(journal, new TestWorkerControl(), "epoch-1")) {
            makeEligible(original, "worker-a");
        }

        try (DurableResilienceJournal journal = new DurableResilienceJournal(file, event -> { });
             WorkerSupervisor recovered = WorkerSupervisor.recover(
                     journal,
                     new TestWorkerControl(),
                     "epoch-2",
                     context("recover"))) {
            WorkerSnapshot fenced = recovered.snapshot("worker-a");
            assertEquals(WorkerState.INELIGIBLE, fenced.state());
            assertEquals("epoch-2", fenced.controlEpoch());
            assertEquals(0L, fenced.processId());
            assertThrows(ResilienceException.class, recovered::selectEligible);

            recovered.start("worker-a", context("restart"));
            WorkerSnapshot reprobed = recovered.probe("worker-a", context("reprobe"));
            assertEquals(WorkerState.ELIGIBLE, reprobed.state());
        }
    }

    private DurableResilienceJournal journal(String name) {
        return new DurableResilienceJournal(temporaryDirectory.resolve(name + ".jsonl"), event -> { });
    }

    private void makeEligible(WorkerSupervisor supervisor, String workerId) {
        supervisor.register(workerId, context("register"));
        supervisor.start(workerId, context("start"));
        supervisor.probe(workerId, context("probe"));
        assertTrue(supervisor.snapshot(workerId).eligible());
    }

    private ResilienceContext context(String cause) {
        return new ResilienceContext("test", cause, "trace-" + cause);
    }
}

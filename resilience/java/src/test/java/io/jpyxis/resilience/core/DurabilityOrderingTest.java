package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.DesiredBinding;
import io.jpyxis.resilience.api.IdempotencyMode;
import io.jpyxis.resilience.api.InvocationRequest;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;
import io.jpyxis.resilience.evidence.ResilienceJournal;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DurabilityOrderingTest {
    @Test
    void failedDurableAppendDoesNotPublishNewAuthoritativeStateInMemory() {
        ResilienceJournal failed = new FailingJournal();
        ResilienceContext context = new ResilienceContext("test", "disk unavailable", "trace-durable");

        ControlIntentRegistry intents = new ControlIntentRegistry(failed, "epoch-1");
        assertThrows(IllegalStateException.class, () -> intents.set(
                new DesiredBinding("production", "artifact@1", "sha256:one", 1), context));
        assertTrue(intents.snapshots().isEmpty());

        WorkerSupervisor workers = new WorkerSupervisor(failed, new TestWorkerControl(), "epoch-1");
        assertThrows(IllegalStateException.class, () -> workers.register("worker-a", context));
        assertTrue(workers.snapshots().isEmpty());

        ResilientInvocationManager invocations = new ResilientInvocationManager(failed, workers, "epoch-1");
        assertThrows(IllegalStateException.class, () -> invocations.accept(
                new InvocationRequest("logical", "logical-trace", IdempotencyMode.NONE, "", 1),
                context));
        assertTrue(invocations.snapshots().isEmpty());
    }

    private static final class FailingJournal implements ResilienceJournal {
        @Override
        public ResilienceEvent record(ResilienceEventDraft draft) {
            throw new IllegalStateException("durable append failed");
        }

        @Override
        public List<ResilienceEvent> events() {
            return List.of();
        }

        @Override
        public void close() {
        }
    }
}

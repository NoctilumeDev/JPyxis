import io.jpyxis.resilience.api.*;
import io.jpyxis.resilience.core.ResilientInvocationManager;
import io.jpyxis.resilience.core.WorkerSupervisor;
import io.jpyxis.resilience.evidence.*;
import io.jpyxis.resilience.port.WorkerControl;
import io.jpyxis.resilience.port.AttemptExecutor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Audit-only model probe. No computation, real process, durability, or product claim. */
public final class CoordinateGateProbe {
    private static final String EPOCH = "control-epoch-original";
    private static final String DIGEST = "sha256:" + "ab".repeat(32);

    public static void main(String[] args) {
        String testCase = args[0];
        boolean substitutedHandle = testCase.equals("worker_handle_substitution");
        MemoryJournal journal = new MemoryJournal();
        ProbeWorkerControl capability = new ProbeWorkerControl(substitutedHandle);
        ResilienceContext context = new ResilienceContext("audit-probe", testCase, "audit-trace");
        try (WorkerSupervisor supervisor = new WorkerSupervisor(journal, capability, EPOCH)) {
            supervisor.register("worker-original", context);
            WorkerSnapshot starting = supervisor.start("worker-original", context);
            WorkerSnapshot eligible = supervisor.probe("worker-original", context);
            if (substitutedHandle) {
                boolean accepted = eligible.eligible();
                Map<String, Object> result = result(testCase, "REJECT_BEFORE_ELIGIBLE", accepted);
                result.put("requestedWorkerId", "worker-original");
                result.put("expectedInstanceId", starting.instanceId());
                result.put("expectedEpoch", EPOCH);
                result.put("returnedWorkerId", capability.lastHandle.workerId());
                result.put("returnedInstanceId", capability.lastHandle.instanceId());
                result.put("returnedEpoch", capability.lastHandle.controlEpoch());
                result.put("publishedWorkerId", eligible.workerId());
                result.put("publishedInstanceId", eligible.instanceId());
                result.put("publishedEpoch", eligible.controlEpoch());
                result.put("observedState", eligible.state().name());
                result.put("journal", journal.projection());
                System.out.println(json(result));
                if (accepted) System.exit(2);
                return;
            }

            ResilientInvocationManager manager = new ResilientInvocationManager(journal, supervisor, EPOCH);
            manager.accept(new InvocationRequest("logical-original", "logical-trace", IdempotencyMode.NONE, "", 1), context);
            AttemptPlan retained = manager.prepareAttempt("logical-original", context);
            WorkerSnapshot submittedWorker = retained.worker();
            IdempotencyMode submittedMode = retained.idempotencyMode();
            String submittedScope = retained.deduplicationScope();
            if (testCase.equals("worker_epoch_substitution")) {
                submittedWorker = new WorkerSnapshot(submittedWorker.workerId(), submittedWorker.state(),
                        submittedWorker.instanceId(), "control-epoch-substituted", submittedWorker.processId());
            } else if (testCase.equals("worker_instance_substitution")) {
                submittedWorker = new WorkerSnapshot(submittedWorker.workerId(), submittedWorker.state(),
                        "instance-substituted", submittedWorker.controlEpoch(), submittedWorker.processId());
            } else if (testCase.equals("idempotency_substitution")) {
                submittedMode = IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION;
                submittedScope = "scope-substituted";
            }
            AttemptPlan submitted = new AttemptPlan(retained.logicalInvocationId(), retained.attemptId(),
                    retained.traceId(), retained.attemptNumber(), submittedWorker, submittedMode, submittedScope);
            boolean honest = testCase.equals("honest_plan_control");
            Map<String, Object> result = result(testCase, honest ? "SUCCEEDED" : "ATTEMPT_COORDINATE_MISMATCH", false);
            result.put("retainedEpoch", retained.worker().controlEpoch());
            result.put("submittedEpoch", submitted.worker().controlEpoch());
            result.put("retainedInstanceId", retained.worker().instanceId());
            result.put("submittedInstanceId", submitted.worker().instanceId());
            result.put("retainedIdempotencyMode", retained.idempotencyMode().name());
            result.put("submittedIdempotencyMode", submitted.idempotencyMode().name());
            result.put("retainedDeduplicationScope", retained.deduplicationScope());
            result.put("submittedDeduplicationScope", submitted.deduplicationScope());
            boolean accepted;
            try {
                // The same submitted plan crosses the executor and manager boundaries. The
                // synthetic success observation matches the existing frozen model-test style.
                AttemptExecutor executor = plan -> AttemptObservation.succeeded(DIGEST);
                AttemptObservation observation = executor.execute(submitted);
                InvocationSnapshot observed = manager.recordObservation(submitted, observation, context);
                accepted = observed.state() == LogicalInvocationState.SUCCEEDED;
                result.put("observedState", observed.state().name());
                result.put("authoritativeIdempotencyMode", observed.idempotencyMode().name());
            } catch (ResilienceException rejected) {
                accepted = false;
                result.put("observedException", rejected.code().name());
            }
            result.put("unexpectedAcceptance", !honest && accepted);
            result.put("journal", journal.projection());
            System.out.println(json(result));
            if (honest ? !accepted : accepted) System.exit(2);
        }
    }

    private static Map<String, Object> result(String testCase, String expected, boolean unexpectedAcceptance) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("case", testCase);
        result.put("expected", expected);
        result.put("unexpectedAcceptance", unexpectedAcceptance);
        result.put("scope", "M5 public model coordinate gate only; synthetic observation; no real execution");
        return result;
    }

    private static final class ProbeWorkerControl implements WorkerControl {
        private final boolean substitute;
        private WorkerHandle lastHandle;
        private ProbeWorkerControl(boolean substitute) { this.substitute = substitute; }
        public WorkerHandle start(String workerId, String instanceId, String epoch) {
            lastHandle = substitute
                    ? new WorkerHandle("worker-substituted", "instance-substituted", "epoch-substituted", 2)
                    : new WorkerHandle(workerId, instanceId, epoch, 1);
            return lastHandle;
        }
        public boolean isHealthy(WorkerHandle handle) { return true; }
        public void stop(WorkerHandle handle) { }
        public void close() { }
    }

    private static final class MemoryJournal implements ResilienceJournal {
        private final List<ResilienceEvent> events = new ArrayList<>();
        public ResilienceEvent record(ResilienceEventDraft draft) {
            ResilienceEvent event = new ResilienceEvent(events.size() + 1, "audit-only", "audit-only",
                    draft.owner(), draft.event(), draft.controlEpoch(), draft.context().actor(), draft.context().cause(),
                    draft.context().traceId(), draft.logicalInvocationId(), draft.attemptId(), draft.workerId(), draft.details());
            events.add(event);
            return event;
        }
        public List<ResilienceEvent> events() { return List.copyOf(events); }
        public void close() { }
        private List<Map<String, Object>> projection() {
            return events.stream().map(event -> {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("owner", event.owner().name());
                result.put("event", event.event());
                result.put("controlEpoch", event.controlEpoch());
                result.put("workerId", event.workerId());
                result.put("details", event.details());
                return result;
            }).toList();
        }
    }

    private static String json(Object value) {
        if (value instanceof Map<?, ?> map) {
            return "{" + String.join(",", map.entrySet().stream()
                    .map(entry -> json(entry.getKey().toString()) + ":" + json(entry.getValue())).toList()) + "}";
        }
        if (value instanceof List<?> list) return "[" + String.join(",", list.stream().map(CoordinateGateProbe::json).toList()) + "]";
        if (value instanceof String string) return "\"" + string.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        return String.valueOf(value);
    }
}

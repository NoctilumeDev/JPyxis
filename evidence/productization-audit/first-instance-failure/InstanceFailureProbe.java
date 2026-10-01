import io.jpyxis.resilience.api.*;
import io.jpyxis.resilience.core.*;
import io.jpyxis.resilience.evidence.*;
import io.jpyxis.resilience.port.WorkerControl;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Public-model probe only: no real processes, computation or durable journal. */
public final class InstanceFailureProbe {
    public static void main(String[] args) {
        String testCase = args[0];
        boolean replace = !testCase.equals("same_instance_failure_control");
        boolean success = testCase.equals("replacement_success_control");
        MemoryJournal journal = new MemoryJournal();
        Control capability = new Control();
        ResilienceContext context = new ResilienceContext("instance-audit", testCase, "audit-trace");
        try (WorkerSupervisor supervisor = new WorkerSupervisor(journal, capability, "epoch-1")) {
            supervisor.register("worker-a", context);
            supervisor.start("worker-a", context);
            supervisor.probe("worker-a", context);
            ResilientInvocationManager manager = new ResilientInvocationManager(journal, supervisor, "epoch-1");
            manager.accept(new InvocationRequest("logical-a", "logical-trace", IdempotencyMode.NONE, "", 1), context);
            AttemptPlan oldPlan = manager.prepareAttempt("logical-a", context);
            if (replace) {
                supervisor.observeFailure("worker-a", "AUDIT_REPLACE", "OLD_INSTANCE_FAULT", context);
                supervisor.start("worker-a", context);
                supervisor.probe("worker-a", context);
            }
            WorkerSnapshot before = supervisor.snapshot("worker-a");
            int beforeSequence = journal.events().size();
            AttemptObservation observation = success
                    ? AttemptObservation.succeeded("sha256:" + "ab".repeat(32))
                    : AttemptObservation.unknown("OLD_ATTEMPT_CHANNEL_LOST");
            InvocationSnapshot outcome = manager.recordObservation(oldPlan, observation, context);
            WorkerSnapshot after = supervisor.snapshot("worker-a");
            boolean unexpected = replace && after.state() != before.state();
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("case", testCase);
            output.put("scope", "M5 public model only; synthetic capability and in-memory journal");
            output.put("submittedPlanUnmodified", true);
            output.put("attemptInstance", oldPlan.worker().instanceId());
            output.put("beforeInstance", before.instanceId());
            output.put("afterInstance", after.instanceId());
            output.put("beforeState", before.state().name());
            output.put("afterState", after.state().name());
            output.put("currentCapabilityStillHealthy", capability.isHealthy(new WorkerHandle(
                    after.workerId(), after.instanceId(), after.controlEpoch(), after.processId())));
            output.put("logicalOutcome", outcome.state().name());
            output.put("unexpectedReplacementMutation", unexpected);
            output.put("eventsAfterOldObservation", journal.events().subList(beforeSequence, journal.events().size())
                    .stream().map(event -> {
                        Map<String, Object> projection = new LinkedHashMap<>();
                        projection.put("owner", event.owner().name());
                        projection.put("event", event.event());
                        projection.put("workerId", event.workerId());
                        projection.put("attemptId", event.attemptId());
                        projection.put("details", event.details());
                        return projection;
                    }).toList());
            System.out.println(json(output));
            if (unexpected) System.exit(2);
            if (replace ? after.state() != WorkerState.ELIGIBLE : after.state() != WorkerState.INELIGIBLE) System.exit(3);
        }
    }

    private static final class Control implements WorkerControl {
        private final Map<String, Boolean> alive = new LinkedHashMap<>();
        private long pid = 100;
        public WorkerHandle start(String worker, String instance, String epoch) {
            alive.put(instance, true);
            return new WorkerHandle(worker, instance, epoch, ++pid);
        }
        public boolean isHealthy(WorkerHandle handle) { return alive.getOrDefault(handle.instanceId(), false); }
        public void stop(WorkerHandle handle) { alive.put(handle.instanceId(), false); }
        public void close() { alive.clear(); }
    }

    private static final class MemoryJournal implements ResilienceJournal {
        private final List<ResilienceEvent> events = new ArrayList<>();
        public ResilienceEvent record(ResilienceEventDraft draft) {
            ResilienceEvent event = new ResilienceEvent(events.size() + 1, "model-only", "model-only", draft.owner(),
                    draft.event(), draft.controlEpoch(), draft.context().actor(), draft.context().cause(),
                    draft.context().traceId(), draft.logicalInvocationId(), draft.attemptId(), draft.workerId(), draft.details());
            events.add(event);
            return event;
        }
        public List<ResilienceEvent> events() { return List.copyOf(events); }
        public void close() { }
    }

    private static String json(Object value) {
        if (value instanceof Map<?, ?> map) return "{" + String.join(",", map.entrySet().stream()
                .map(entry -> json(entry.getKey().toString()) + ":" + json(entry.getValue())).toList()) + "}";
        if (value instanceof List<?> list) return "[" + String.join(",", list.stream().map(InstanceFailureProbe::json).toList()) + "]";
        if (value instanceof String text) return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        return String.valueOf(value);
    }
}

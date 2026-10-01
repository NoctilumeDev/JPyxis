import io.jpyxis.resilience.api.*;
import io.jpyxis.resilience.core.*;
import io.jpyxis.resilience.evidence.*;
import io.jpyxis.resilience.port.WorkerControl;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Emits public-model observations only. The separate retained-data verifier owns verdicts. */
public final class CoordinateValidationMain {
    private static final ResilienceContext CONTEXT = new ResilienceContext("coordinate-reference", "v2 model gate", "event-trace");
    private static final String DIGEST = "sha256:" + "ab".repeat(32);

    public static void main(String[] args) {
        String testCase = args[0];
        MemoryJournal journal = new MemoryJournal();
        Control control = new Control();
        WorkerSupervisor workers = new WorkerSupervisor(journal, control, "epoch-1");
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("case", testCase);
        row.put("scope", "public M5 model; synthetic capability; in-memory journal; no process, compute or durability claim");
        try {
            if (testCase.startsWith("handle_")) {
                control.foreign = testCase.substring("handle_".length());
                workers.register("worker-a", CONTEXT);
                row.put("workerBefore", workers.snapshot("worker-a"));
                int boundary = journal.events().size();
                row.put("workerAfter", workers.start("worker-a", CONTEXT));
                try { workers.selectEligible(); row.put("routingException", ""); }
                catch (ResilienceException error) { row.put("routingException", error.code().name()); }
                row.put("eventsAfter", journal.events().subList(boundary, journal.events().size()));
                row.put("journal", journal.events());
                row.put("healthCalls", control.healthCalls);
                row.put("stopCalls", control.stopCalls);
                System.out.println(json(row));
                return;
            }
            eligible(workers, "worker-a");
            if (testCase.equals("deduplicated_retry")) eligible(workers, "worker-b");
            boolean deduplicated = testCase.equals("plan_scope") || testCase.equals("deduplicated_retry")
                    || testCase.equals("budget_unknown") || testCase.equals("recovery_deduplicated");
            int budget = testCase.equals("deduplicated_retry") || testCase.equals("recovery_deduplicated")
                    || testCase.equals("none_before") ? 2 : 1;
            ResilientInvocationManager manager = new ResilientInvocationManager(journal, workers, "epoch-1");
            manager.accept(new InvocationRequest("logical", "logical-trace",
                    deduplicated ? IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION : IdempotencyMode.NONE,
                    deduplicated ? "scope-original" : "", budget), CONTEXT);
            if (testCase.startsWith("replay_bad_")) journal.corruptField = testCase.substring("replay_bad_".length());
            AttemptPlan plan = manager.prepareAttempt("logical", CONTEXT);
            row.put("retainedPlan", plan);
            if (testCase.startsWith("old_")) replace(workers);
            if (testCase.startsWith("terminal_") || testCase.startsWith("late_")) {
                manager.recordObservation(plan, AttemptObservation.succeeded(DIGEST), CONTEXT);
            }
            if (testCase.equals("recovery_none") || testCase.equals("recovery_deduplicated")) {
                workers.close();
                workers = WorkerSupervisor.recover(journal, new Control(), "epoch-2", CONTEXT);
                manager = ResilientInvocationManager.recover(journal, workers, "epoch-2", CONTEXT);
                workers.start("worker-a", CONTEXT);
                workers.probe("worker-a", CONTEXT);
            }
            if (testCase.startsWith("replay_bad_")) {
                workers.close();
                workers = WorkerSupervisor.recover(journal, new Control(), "epoch-2", CONTEXT);
            }
            row.put("invocationBefore", manager.snapshot("logical"));
            row.put("workerBefore", workers.snapshot("worker-a"));
            int boundary = journal.events().size();
            WorkerSupervisor currentWorkers = workers;
            if (testCase.equals("replacement_race")) {
                control.beforeHealth = () -> {
                    control.beforeHealth = () -> { };
                    replace(currentWorkers);
                    row.put("replacementAtApply", currentWorkers.snapshot("worker-a"));
                };
            }
            try {
                if (testCase.startsWith("plan_") || testCase.equals("terminal_foreign_epoch")) {
                    String field = testCase.startsWith("plan_") ? testCase.substring("plan_".length()) : "epoch";
                    manager.recordObservation(substitute(plan, field), AttemptObservation.succeeded(DIGEST), CONTEXT);
                } else if (testCase.equals("late_liveness")) {
                    WorkerSnapshot worker = plan.worker();
                    AttemptPlan historical = copy(plan, new WorkerSnapshot(worker.workerId(), WorkerState.INELIGIBLE,
                            worker.instanceId(), worker.controlEpoch(), 0), plan.traceId(), plan.attemptNumber(),
                            plan.idempotencyMode(), plan.deduplicationScope());
                    manager.recordObservation(historical, AttemptObservation.unknown("LATE"), CONTEXT);
                } else if (testCase.equals("late_association")) {
                    manager.recordLateObservation("logical", plan.attemptId(), AttemptObservation.unknown("LATE"), CONTEXT);
                } else if (testCase.equals("worker_wide_action")) {
                    workers.observeFailure("worker-a", "OPERATOR", "EXPLICIT_ACTION", CONTEXT);
                } else if (testCase.equals("epoch_mismatch")) {
                    new ResilientInvocationManager(journal, workers, "foreign-epoch");
                } else if (testCase.startsWith("replay_bad_")) {
                    ResilientInvocationManager.recover(journal, workers, "epoch-2", CONTEXT);
                } else if (testCase.equals("recovery_none")) {
                    manager.recordObservation(plan, AttemptObservation.succeeded(DIGEST), CONTEXT);
                } else if (testCase.equals("recovery_deduplicated")) {
                    AttemptPlan retry = manager.prepareAttempt("logical", CONTEXT);
                    row.put("retryPlan", retry);
                    manager.recordObservation(retry, AttemptObservation.succeeded(DIGEST), CONTEXT);
                } else {
                    AttemptObservation observation = testCase.equals("honest") || testCase.equals("old_success")
                            ? AttemptObservation.succeeded(DIGEST)
                            : testCase.equals("old_before") || testCase.equals("none_before")
                            ? AttemptObservation.failedBeforeExecution("BEFORE")
                            : testCase.equals("old_after") ? AttemptObservation.failedAfterExecution("AFTER")
                            : AttemptObservation.unknown("CHANNEL_LOST");
                    manager.recordObservation(plan, observation, CONTEXT);
                    if (testCase.equals("deduplicated_retry")) {
                        AttemptPlan retry = manager.prepareAttempt("logical", CONTEXT);
                        row.put("retryPlan", retry);
                        manager.recordObservation(retry, AttemptObservation.succeeded(DIGEST), CONTEXT);
                    }
                }
                row.put("exceptionCode", "");
            } catch (ResilienceException error) {
                row.put("exceptionCode", error.code().name());
            } catch (RuntimeException error) {
                row.put("exceptionCode", error.getClass().getSimpleName());
            }
            row.put("invocationAfter", manager.snapshot("logical"));
            row.put("workerAfter", workers.snapshot("worker-a"));
            row.put("eventsAfter", journal.events().subList(boundary, journal.events().size()));
            row.put("journal", journal.events());
            row.put("healthCalls", control.healthCalls);
            row.put("stopCalls", control.stopCalls);
            System.out.println(json(row));
        } finally {
            workers.close();
        }
    }

    private static void eligible(WorkerSupervisor workers, String worker) {
        workers.register(worker, CONTEXT);
        workers.start(worker, CONTEXT);
        workers.probe(worker, CONTEXT);
    }
    private static void replace(WorkerSupervisor workers) {
        workers.observeFailure("worker-a", "OPERATOR", "REPLACE", CONTEXT);
        workers.start("worker-a", CONTEXT);
        workers.probe("worker-a", CONTEXT);
    }
    private static AttemptPlan substitute(AttemptPlan plan, String field) {
        if (field.equals("null")) return null;
        WorkerSnapshot worker = plan.worker();
        WorkerSnapshot changed = new WorkerSnapshot(field.equals("worker") ? "foreign" : worker.workerId(), worker.state(),
                field.equals("instance") ? "foreign" : worker.instanceId(),
                field.equals("epoch") ? "foreign" : worker.controlEpoch(), worker.processId());
        return copy(plan, field.equals("null_worker") ? null : changed,
                field.equals("trace") ? "foreign" : plan.traceId(), field.equals("number") ? 3 : plan.attemptNumber(),
                field.equals("mode") ? IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION : plan.idempotencyMode(),
                field.equals("mode") || field.equals("scope") ? "scope-foreign" : plan.deduplicationScope());
    }
    private static AttemptPlan copy(AttemptPlan plan, WorkerSnapshot worker, String trace, int number,
                                    IdempotencyMode mode, String scope) {
        return new AttemptPlan(plan.logicalInvocationId(), plan.attemptId(), trace, number, worker, mode, scope);
    }
    private static final class Control implements WorkerControl {
        private String foreign = "";
        private long pid = 100;
        private int healthCalls;
        private int stopCalls;
        private Runnable beforeHealth = () -> { };
        public WorkerHandle start(String worker, String instance, String epoch) {
            if (foreign.equals("null")) return null;
            return new WorkerHandle(foreign.equals("worker") ? "foreign" : worker,
                    foreign.equals("instance") ? "foreign" : instance,
                    foreign.equals("epoch") ? "foreign" : epoch, ++pid);
        }
        public boolean isHealthy(WorkerHandle handle) { healthCalls++; beforeHealth.run(); return true; }
        public void stop(WorkerHandle handle) { stopCalls++; }
        public void close() { }
    }
    private static final class MemoryJournal implements ResilienceJournal {
        private final List<ResilienceEvent> events = new ArrayList<>();
        private String corruptField = "";
        public ResilienceEvent record(ResilienceEventDraft draft) {
            Map<String, String> details = new LinkedHashMap<>(draft.details());
            if (!corruptField.isEmpty()) {
                String target = corruptField.equals("workerEpoch") ? "INVOCATION_ATTEMPTING" : "ATTEMPT_DISPATCH_INTENT";
                if (draft.event().equals(target)) details.put(corruptField, corruptField.equals("attemptNumber") ? "3"
                        : corruptField.equals("idempotencyMode") ? "DEDUPLICATED_BY_LOGICAL_INVOCATION" : "foreign");
            }
            ResilienceEvent event = new ResilienceEvent(events.size() + 1, "model-only", "model-only", draft.owner(),
                    draft.event(), draft.controlEpoch(), draft.context().actor(), draft.context().cause(),
                    draft.context().traceId(), draft.logicalInvocationId(), draft.attemptId(), draft.workerId(), details);
            events.add(event);
            return event;
        }
        public List<ResilienceEvent> events() { return List.copyOf(events); }
        public void close() { }
    }
    private static String json(Object value) {
        if (value != null && value.getClass().isRecord()) {
            Map<String, Object> fields = new LinkedHashMap<>();
            try {
                for (var component : value.getClass().getRecordComponents()) fields.put(component.getName(), component.getAccessor().invoke(value));
            } catch (ReflectiveOperationException failure) { throw new IllegalStateException(failure); }
            return json(fields);
        }
        if (value instanceof Enum<?> item) return json(item.name());
        if (value instanceof Map<?, ?> map) return "{" + String.join(",", map.entrySet().stream()
                .map(entry -> json(entry.getKey().toString()) + ":" + json(entry.getValue())).toList()) + "}";
        if (value instanceof List<?> list) return "[" + String.join(",", list.stream().map(CoordinateValidationMain::json).toList()) + "]";
        if (value instanceof String text) return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t") + "\"";
        return String.valueOf(value);
    }
}

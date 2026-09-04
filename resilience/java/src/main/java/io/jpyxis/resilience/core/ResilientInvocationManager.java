package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.AttemptObservation;
import io.jpyxis.resilience.api.AttemptObservationKind;
import io.jpyxis.resilience.api.AttemptPlan;
import io.jpyxis.resilience.api.AttemptSnapshot;
import io.jpyxis.resilience.api.IdempotencyMode;
import io.jpyxis.resilience.api.InvocationRequest;
import io.jpyxis.resilience.api.InvocationSnapshot;
import io.jpyxis.resilience.api.LogicalInvocationState;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.api.WorkerSnapshot;
import io.jpyxis.resilience.evidence.EventOwner;
import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;
import io.jpyxis.resilience.evidence.ResilienceJournal;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class ResilientInvocationManager {
    private final ResilienceJournal journal;
    private final WorkerSupervisor supervisor;
    private final String controlEpoch;
    private final Map<String, InvocationEntry> invocations = new LinkedHashMap<>();

    public ResilientInvocationManager(
            ResilienceJournal journal,
            WorkerSupervisor supervisor,
            String controlEpoch) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.supervisor = Objects.requireNonNull(supervisor, "supervisor");
        this.controlEpoch = requireText(controlEpoch, "controlEpoch");
    }

    public static ResilientInvocationManager recover(
            ResilienceJournal journal,
            WorkerSupervisor supervisor,
            String controlEpoch,
            ResilienceContext context) {
        ResilientInvocationManager manager = new ResilientInvocationManager(journal, supervisor, controlEpoch);
        manager.record(
                EventOwner.RECOVERY_COORDINATOR,
                "RECOVERY_STARTED",
                context,
                "",
                "",
                "",
                Map.of("priorEventCount", Integer.toString(journal.events().size())));
        manager.replay(journal.events());
        for (InvocationEntry entry : new ArrayList<>(manager.invocations.values())) {
            if (entry.state == LogicalInvocationState.ATTEMPTING) {
                AttemptEntry attempt = entry.attempts.get(entry.attempts.size() - 1);
                if (attempt.observation == null) {
                    AttemptObservation recovered = attempt.dispatchIntent
                            ? AttemptObservation.unknown("CONTROL_RESTART_AFTER_DISPATCH")
                            : AttemptObservation.failedBeforeExecution("CONTROL_RESTART_BEFORE_DISPATCH");
                    manager.record(
                            EventOwner.RECOVERY_COORDINATOR,
                            attempt.dispatchIntent
                                    ? "ATTEMPT_RECOVERED_UNKNOWN"
                                    : "ATTEMPT_RECOVERED_NOT_DISPATCHED",
                            context,
                            entry.request.logicalInvocationId(),
                            attempt.attemptId,
                            attempt.worker.workerId(),
                            observationDetails(entry, recovered));
                    attempt.observation = recovered;
                }
                manager.applyObservation(entry, attempt, attempt.observation, context, true);
            }
        }
        manager.record(
                EventOwner.RECOVERY_COORDINATOR,
                "RECOVERY_COMPLETED",
                context,
                "",
                "",
                "",
                Map.of("recoveredInvocationCount", Integer.toString(manager.invocations.size())));
        return manager;
    }

    public synchronized InvocationSnapshot accept(InvocationRequest request, ResilienceContext context) {
        Objects.requireNonNull(request, "request");
        if (invocations.containsKey(request.logicalInvocationId())) {
            throw new ResilienceException(
                    ResilienceException.Code.INVOCATION_ALREADY_EXISTS,
                    "logical invocation already exists: " + request.logicalInvocationId());
        }
        InvocationEntry entry = new InvocationEntry(request);
        recordManager(entry, "INVOCATION_ACCEPTED", context, "", "", Map.of(
                "previousState", "",
                "newState", LogicalInvocationState.ACCEPTED.name(),
                "idempotencyMode", request.idempotencyMode().name(),
                "deduplicationScope", request.deduplicationScope(),
                "maximumAttempts", Integer.toString(request.maximumAttempts())));
        invocations.put(request.logicalInvocationId(), entry);
        return snapshot(entry);
    }

    public synchronized AttemptPlan prepareAttempt(String logicalInvocationId, ResilienceContext context) {
        InvocationEntry entry = requireInvocation(logicalInvocationId);
        if (entry.state != LogicalInvocationState.ACCEPTED
                && entry.state != LogicalInvocationState.RETRY_PENDING) {
            throw invalidTransition(entry, "prepare attempt");
        }
        if (entry.attempts.size() >= entry.request.maximumAttempts()) {
            throw new ResilienceException(
                    ResilienceException.Code.INVALID_INVOCATION_TRANSITION,
                    "attempt budget already exhausted: " + logicalInvocationId);
        }
        WorkerSnapshot worker = supervisor.selectEligible();
        int number = entry.attempts.size() + 1;
        String attemptId = logicalInvocationId + "/attempt-" + number;
        AttemptEntry attempt = new AttemptEntry(attemptId, number, worker);
        LogicalInvocationState previous = entry.state;
        recordManager(entry, "INVOCATION_ATTEMPTING", context, attemptId, worker.workerId(), Map.of(
                "previousState", previous.name(),
                "newState", LogicalInvocationState.ATTEMPTING.name(),
                "attemptNumber", Integer.toString(number),
                "workerInstanceId", worker.instanceId(),
                "workerEpoch", worker.controlEpoch()));
        entry.attempts.add(attempt);
        entry.state = LogicalInvocationState.ATTEMPTING;
        recordManager(entry, "ATTEMPT_DISPATCH_INTENT", context, attemptId, worker.workerId(), Map.of(
                "attemptNumber", Integer.toString(number),
                "workerInstanceId", worker.instanceId(),
                "idempotencyMode", entry.request.idempotencyMode().name(),
                "deduplicationScope", entry.request.deduplicationScope()));
        attempt.dispatchIntent = true;
        return new AttemptPlan(
                logicalInvocationId,
                attemptId,
                entry.request.traceId(),
                number,
                worker,
                entry.request.idempotencyMode(),
                entry.request.deduplicationScope());
    }

    public synchronized InvocationSnapshot recordObservation(
            AttemptPlan plan,
            AttemptObservation observation,
            ResilienceContext context) {
        Objects.requireNonNull(plan, "plan");
        Objects.requireNonNull(observation, "observation");
        InvocationEntry entry = requireInvocation(plan.logicalInvocationId());
        AttemptEntry attempt = requireAttempt(entry, plan.attemptId());
        if (entry.state.terminal()) {
            record(
                    EventOwner.ATTEMPT_CAPABILITY,
                    "LATE_ATTEMPT_OBSERVED",
                    context,
                    entry.request.logicalInvocationId(),
                    attempt.attemptId,
                    attempt.worker.workerId(),
                    observationDetails(entry, observation));
            recordManager(entry, "LATE_ATTEMPT_IGNORED", context, attempt.attemptId, attempt.worker.workerId(), Map.of(
                    "terminalState", entry.state.name(),
                    "observation", observation.kind().name()));
            return snapshot(entry);
        }
        if (entry.state != LogicalInvocationState.ATTEMPTING
                || !samePlan(entry, attempt, plan)
                || attempt.observation != null) {
            throw new ResilienceException(
                    ResilienceException.Code.ATTEMPT_COORDINATE_MISMATCH,
                    "attempt observation does not match the current pinned attempt");
        }
        record(
                EventOwner.ATTEMPT_CAPABILITY,
                "ATTEMPT_OBSERVED",
                context,
                entry.request.logicalInvocationId(),
                attempt.attemptId,
                attempt.worker.workerId(),
                observationDetails(entry, observation));
        attempt.observation = observation;
        if (observation.kind() == AttemptObservationKind.UNKNOWN_REMOTE_OUTCOME) {
            supervisor.observeFailure(
                    attempt.worker.workerId(),
                    "INVOCATION",
                    observation.code(),
                    context);
        }
        applyObservation(entry, attempt, observation, context, false);
        return snapshot(entry);
    }

    public synchronized InvocationSnapshot recordLateObservation(
            String logicalInvocationId,
            String attemptId,
            AttemptObservation observation,
            ResilienceContext context) {
        InvocationEntry entry = requireInvocation(logicalInvocationId);
        AttemptEntry attempt = requireAttempt(entry, attemptId);
        if (!entry.state.terminal()) {
            throw invalidTransition(entry, "record late observation");
        }
        record(
                EventOwner.ATTEMPT_CAPABILITY,
                "LATE_ATTEMPT_OBSERVED",
                context,
                logicalInvocationId,
                attemptId,
                attempt.worker.workerId(),
                observationDetails(entry, observation));
        recordManager(entry, "LATE_ATTEMPT_IGNORED", context, attemptId, attempt.worker.workerId(), Map.of(
                "terminalState", entry.state.name(),
                "observation", observation.kind().name()));
        return snapshot(entry);
    }

    public synchronized InvocationSnapshot snapshot(String logicalInvocationId) {
        return snapshot(requireInvocation(logicalInvocationId));
    }

    public synchronized List<InvocationSnapshot> snapshots() {
        return invocations.values().stream()
                .sorted(Comparator.comparing(entry -> entry.request.logicalInvocationId()))
                .map(this::snapshot)
                .toList();
    }

    private void applyObservation(
            InvocationEntry entry,
            AttemptEntry attempt,
            AttemptObservation observation,
            ResilienceContext context,
            boolean recovered) {
        switch (observation.kind()) {
            case SUCCEEDED -> terminal(
                    entry,
                    LogicalInvocationState.SUCCEEDED,
                    "OK",
                    observation.resultDigest(),
                    context,
                    attempt,
                    recovered);
            case FAILED_BEFORE_EXECUTION, FAILED_AFTER_EXECUTION -> {
                if (retryAllowed(entry, attempt, observation, context, recovered)) return;
                terminal(
                        entry,
                        LogicalInvocationState.FAILED,
                        observation.code(),
                        "",
                        context,
                        attempt,
                        recovered);
            }
            case UNKNOWN_REMOTE_OUTCOME -> {
                if (retryAllowed(entry, attempt, observation, context, recovered)) return;
                terminal(
                        entry,
                        LogicalInvocationState.OUTCOME_UNKNOWN,
                        observation.code(),
                        "",
                        context,
                        attempt,
                        recovered);
            }
        }
    }

    private boolean retryAllowed(
            InvocationEntry entry,
            AttemptEntry attempt,
            AttemptObservation observation,
            ResilienceContext context,
            boolean recovered) {
        String deniedReason = null;
        if (entry.request.idempotencyMode() != IdempotencyMode.DEDUPLICATED_BY_LOGICAL_INVOCATION) {
            deniedReason = "IDEMPOTENCY_EVIDENCE_REQUIRED";
        } else if (entry.attempts.size() >= entry.request.maximumAttempts()) {
            deniedReason = "ATTEMPT_BUDGET_EXHAUSTED";
        }
        if (deniedReason != null) {
            recordManager(entry, "RETRY_DENIED", context, attempt.attemptId, attempt.worker.workerId(), Map.of(
                    "reason", deniedReason,
                    "observation", observation.kind().name(),
                    "recovered", Boolean.toString(recovered)));
            return false;
        }
        recordManager(entry, "RETRY_ALLOWED", context, attempt.attemptId, attempt.worker.workerId(), Map.of(
                "idempotencyMode", entry.request.idempotencyMode().name(),
                "deduplicationScope", entry.request.deduplicationScope(),
                "remainingAttempts", Integer.toString(entry.request.maximumAttempts() - entry.attempts.size()),
                "observation", observation.kind().name(),
                "recovered", Boolean.toString(recovered)));
        LogicalInvocationState previous = entry.state;
        recordManager(entry, "INVOCATION_RETRY_PENDING", context, attempt.attemptId, attempt.worker.workerId(), Map.of(
                "previousState", previous.name(),
                "newState", LogicalInvocationState.RETRY_PENDING.name()));
        entry.state = LogicalInvocationState.RETRY_PENDING;
        return true;
    }

    private void terminal(
            InvocationEntry entry,
            LogicalInvocationState state,
            String code,
            String resultDigest,
            ResilienceContext context,
            AttemptEntry attempt,
            boolean recovered) {
        if (!state.terminal() || entry.state.terminal()) {
            throw invalidTransition(entry, "commit terminal " + state);
        }
        LogicalInvocationState previous = entry.state;
        String event = switch (state) {
            case SUCCEEDED -> "INVOCATION_TERMINAL_SUCCEEDED";
            case FAILED -> "INVOCATION_TERMINAL_FAILED";
            case OUTCOME_UNKNOWN -> "INVOCATION_TERMINAL_UNKNOWN";
            default -> throw new IllegalArgumentException("not terminal: " + state);
        };
        recordManager(entry, event, context, attempt.attemptId, attempt.worker.workerId(), Map.of(
                "previousState", previous.name(),
                "newState", state.name(),
                "code", code,
                "resultDigest", resultDigest,
                "recovered", Boolean.toString(recovered)));
        entry.state = state;
        entry.terminalCode = code;
        entry.resultDigest = resultDigest;
    }

    private void replay(List<ResilienceEvent> events) {
        for (ResilienceEvent event : events) {
            if (event.owner() == EventOwner.RESILIENT_INVOCATION_MANAGER) replayManagerEvent(event);
            if (event.owner() == EventOwner.ATTEMPT_CAPABILITY
                    && event.event().equals("ATTEMPT_OBSERVED")) replayObservation(event);
        }
    }

    private void replayManagerEvent(ResilienceEvent event) {
        Map<String, String> details = event.details();
        switch (event.event()) {
            case "INVOCATION_ACCEPTED" -> {
                InvocationRequest request = new InvocationRequest(
                        event.logicalInvocationId(),
                        details.get("logicalTraceId"),
                        IdempotencyMode.valueOf(details.get("idempotencyMode")),
                        details.getOrDefault("deduplicationScope", ""),
                        Integer.parseInt(details.get("maximumAttempts")));
                invocations.put(event.logicalInvocationId(), new InvocationEntry(request));
            }
            case "INVOCATION_ATTEMPTING" -> {
                InvocationEntry entry = requireInvocation(event.logicalInvocationId());
                WorkerSnapshot worker = new WorkerSnapshot(
                        event.workerId(),
                        io.jpyxis.resilience.api.WorkerState.INELIGIBLE,
                        details.get("workerInstanceId"),
                        details.get("workerEpoch"),
                        0L);
                entry.attempts.add(new AttemptEntry(
                        event.attemptId(),
                        Integer.parseInt(details.get("attemptNumber")),
                        worker));
                entry.state = LogicalInvocationState.ATTEMPTING;
            }
            case "ATTEMPT_DISPATCH_INTENT" -> {
                InvocationEntry entry = requireInvocation(event.logicalInvocationId());
                requireAttempt(entry, event.attemptId()).dispatchIntent = true;
            }
            case "INVOCATION_RETRY_PENDING" ->
                    requireInvocation(event.logicalInvocationId()).state = LogicalInvocationState.RETRY_PENDING;
            case "INVOCATION_TERMINAL_SUCCEEDED", "INVOCATION_TERMINAL_FAILED", "INVOCATION_TERMINAL_UNKNOWN" -> {
                InvocationEntry entry = requireInvocation(event.logicalInvocationId());
                entry.state = LogicalInvocationState.valueOf(details.get("newState"));
                entry.terminalCode = details.getOrDefault("code", "");
                entry.resultDigest = details.getOrDefault("resultDigest", "");
            }
            default -> { }
        }
    }

    private void replayObservation(ResilienceEvent event) {
        InvocationEntry entry = requireInvocation(event.logicalInvocationId());
        AttemptEntry attempt = requireAttempt(entry, event.attemptId());
        Map<String, String> details = event.details();
        attempt.observation = new AttemptObservation(
                AttemptObservationKind.valueOf(details.get("kind")),
                details.getOrDefault("code", ""),
                details.getOrDefault("resultDigest", ""),
                Boolean.parseBoolean(details.getOrDefault("executionMayContinue", "false")));
    }

    private boolean samePlan(InvocationEntry entry, AttemptEntry attempt, AttemptPlan plan) {
        return entry.request.traceId().equals(plan.traceId())
                && attempt.attemptNumber == plan.attemptNumber()
                && attempt.worker.workerId().equals(plan.worker().workerId())
                && attempt.worker.instanceId().equals(plan.worker().instanceId());
    }

    private InvocationEntry requireInvocation(String logicalInvocationId) {
        InvocationEntry entry = invocations.get(logicalInvocationId);
        if (entry == null) {
            throw new ResilienceException(
                    ResilienceException.Code.INVOCATION_NOT_FOUND,
                    "logical invocation not found: " + logicalInvocationId);
        }
        return entry;
    }

    private AttemptEntry requireAttempt(InvocationEntry entry, String attemptId) {
        return entry.attempts.stream()
                .filter(attempt -> attempt.attemptId.equals(attemptId))
                .findFirst()
                .orElseThrow(() -> new ResilienceException(
                        ResilienceException.Code.ATTEMPT_COORDINATE_MISMATCH,
                        "attempt not found: " + attemptId));
    }

    private ResilienceException invalidTransition(InvocationEntry entry, String action) {
        return new ResilienceException(
                ResilienceException.Code.INVALID_INVOCATION_TRANSITION,
                "cannot " + action + " logical invocation "
                        + entry.request.logicalInvocationId() + " from " + entry.state);
    }

    private InvocationSnapshot snapshot(InvocationEntry entry) {
        return new InvocationSnapshot(
                entry.request.logicalInvocationId(),
                entry.request.traceId(),
                entry.request.idempotencyMode(),
                entry.request.deduplicationScope(),
                entry.request.maximumAttempts(),
                entry.state,
                entry.attempts.stream().map(attempt -> new AttemptSnapshot(
                        attempt.attemptId,
                        attempt.attemptNumber,
                        attempt.worker.workerId(),
                        attempt.worker.instanceId(),
                        attempt.observation == null ? null : attempt.observation.kind(),
                        attempt.observation == null ? "" : attempt.observation.code(),
                        attempt.observation == null ? "" : attempt.observation.resultDigest())).toList(),
                entry.resultDigest,
                entry.terminalCode);
    }

    private void recordManager(
            InvocationEntry entry,
            String event,
            ResilienceContext context,
            String attemptId,
            String workerId,
            Map<String, String> details) {
        Map<String, String> combined = new LinkedHashMap<>(details);
        combined.put("logicalTraceId", entry.request.traceId());
        record(
                EventOwner.RESILIENT_INVOCATION_MANAGER,
                event,
                context,
                entry.request.logicalInvocationId(),
                attemptId,
                workerId,
                combined);
    }

    private void record(
            EventOwner owner,
            String event,
            ResilienceContext context,
            String logicalInvocationId,
            String attemptId,
            String workerId,
            Map<String, String> details) {
        journal.record(new ResilienceEventDraft(
                owner,
                event,
                controlEpoch,
                context,
                logicalInvocationId,
                attemptId,
                workerId,
                details));
    }

    private static Map<String, String> observationDetails(
            InvocationEntry entry,
            AttemptObservation observation) {
        return Map.of(
                "kind", observation.kind().name(),
                "code", observation.code(),
                "resultDigest", observation.resultDigest(),
                "executionMayContinue", Boolean.toString(observation.executionMayContinue()),
                "logicalTraceId", entry.request.traceId());
    }

    private static String requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
        return value;
    }

    private static final class InvocationEntry {
        private final InvocationRequest request;
        private final List<AttemptEntry> attempts = new ArrayList<>();
        private LogicalInvocationState state = LogicalInvocationState.ACCEPTED;
        private String resultDigest = "";
        private String terminalCode = "";

        private InvocationEntry(InvocationRequest request) {
            this.request = request;
        }
    }

    private static final class AttemptEntry {
        private final String attemptId;
        private final int attemptNumber;
        private final WorkerSnapshot worker;
        private boolean dispatchIntent;
        private AttemptObservation observation;

        private AttemptEntry(String attemptId, int attemptNumber, WorkerSnapshot worker) {
            this.attemptId = attemptId;
            this.attemptNumber = attemptNumber;
            this.worker = worker;
        }
    }
}

package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.api.WorkerHandle;
import io.jpyxis.resilience.api.WorkerSnapshot;
import io.jpyxis.resilience.api.WorkerState;
import io.jpyxis.resilience.evidence.EventOwner;
import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;
import io.jpyxis.resilience.evidence.ResilienceJournal;
import io.jpyxis.resilience.port.WorkerControl;
import io.jpyxis.resilience.port.WorkerControlException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class WorkerSupervisor implements AutoCloseable {
    private final ResilienceJournal journal;
    private final WorkerControl control;
    private final String controlEpoch;
    private final Map<String, WorkerEntry> workers = new LinkedHashMap<>();
    private long instanceSequence;
    private int routingCursor;

    public WorkerSupervisor(ResilienceJournal journal, WorkerControl control, String controlEpoch) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.control = Objects.requireNonNull(control, "control");
        this.controlEpoch = requireText(controlEpoch, "controlEpoch");
    }

    public static WorkerSupervisor recover(
            ResilienceJournal journal,
            WorkerControl control,
            String newControlEpoch,
            ResilienceContext context) {
        WorkerSupervisor supervisor = new WorkerSupervisor(journal, control, newControlEpoch);
        for (ResilienceEvent event : journal.events()) {
            if (event.owner() != EventOwner.WORKER_SUPERVISOR || event.workerId().isBlank()) continue;
            String next = event.details().get("newState");
            if (next == null || next.isBlank()) continue;
            WorkerEntry entry = supervisor.workers.computeIfAbsent(event.workerId(), WorkerEntry::new);
            entry.state = WorkerState.valueOf(next);
            entry.instanceId = event.details().getOrDefault("instanceId", entry.instanceId);
            entry.epoch = event.details().getOrDefault("workerEpoch", entry.epoch);
            entry.processId = parseLong(event.details().get("processId"), entry.processId);
        }
        for (WorkerEntry entry : supervisor.workers.values()) {
            WorkerState previous = entry.state;
            entry.handle = null;
            entry.instanceId = "";
            entry.epoch = newControlEpoch;
            entry.processId = 0L;
            if (previous != WorkerState.STOPPED) {
                supervisor.recordTransition(
                        entry,
                        previous,
                        WorkerState.INELIGIBLE,
                        "WORKER_RECOVERY_FENCED",
                        context,
                        Map.of("reason", "NEW_CONTROL_EPOCH_REQUIRES_PROBE"));
                entry.state = WorkerState.INELIGIBLE;
            }
        }
        return supervisor;
    }

    public synchronized WorkerSnapshot register(String workerId, ResilienceContext context) {
        requireText(workerId, "workerId");
        if (workers.containsKey(workerId)) {
            throw new ResilienceException(
                    ResilienceException.Code.WORKER_ALREADY_REGISTERED,
                    "worker already registered: " + workerId);
        }
        WorkerEntry entry = new WorkerEntry(workerId);
        entry.state = WorkerState.REGISTERED;
        entry.epoch = controlEpoch;
        recordTransition(entry, null, WorkerState.REGISTERED, "WORKER_REGISTERED", context, Map.of());
        workers.put(workerId, entry);
        return snapshot(entry);
    }

    public WorkerSnapshot start(String workerId, ResilienceContext context) {
        WorkerEntry entry;
        String instanceId;
        synchronized (this) {
            entry = requireWorker(workerId);
            if (entry.state != WorkerState.REGISTERED
                    && entry.state != WorkerState.INELIGIBLE
                    && entry.state != WorkerState.FAILED
                    && entry.state != WorkerState.STOPPED) {
                throw invalidTransition(entry, "start");
            }
            WorkerState previous = entry.state;
            instanceId = workerId + "@" + controlEpoch + "-" + (++instanceSequence);
            entry.instanceId = instanceId;
            entry.epoch = controlEpoch;
            entry.processId = 0L;
            transition(entry, WorkerState.STARTING, "WORKER_STARTING", context, Map.of(
                    "previousLifecycleState", previous.name()));
        }

        WorkerHandle handle;
        try {
            handle = control.start(workerId, instanceId, controlEpoch);
            recordCapability(entry, "WORKER_START_OBSERVED", context, Map.of(
                    "instanceId", handle.instanceId(),
                    "processId", Long.toString(handle.processId())));
        } catch (WorkerControlException | RuntimeException failure) {
            recordCapability(entry, "WORKER_START_FAILED", context, Map.of(
                    "code", capabilityCode(failure)));
            synchronized (this) {
                requireState(entry, WorkerState.STARTING);
                transition(entry, WorkerState.FAILED, "WORKER_FAILED", context, Map.of(
                        "code", capabilityCode(failure)));
                return snapshot(entry);
            }
        }

        synchronized (this) {
            requireState(entry, WorkerState.STARTING);
            entry.handle = handle;
            entry.processId = handle.processId();
            recordSupervisor(entry, "WORKER_HANDLE_PINNED", context, Map.of(
                    "instanceId", handle.instanceId(),
                    "processId", Long.toString(handle.processId())));
            return snapshot(entry);
        }
    }

    public WorkerSnapshot probe(String workerId, ResilienceContext context) {
        WorkerEntry entry;
        WorkerHandle handle;
        synchronized (this) {
            entry = requireWorker(workerId);
            if (entry.state != WorkerState.STARTING && entry.state != WorkerState.INELIGIBLE) {
                throw invalidTransition(entry, "probe");
            }
            handle = requireHandle(entry);
        }

        boolean healthy;
        try {
            healthy = control.isHealthy(handle);
            recordCapability(entry, "WORKER_PROBE_OBSERVED", context, Map.of(
                    "healthy", Boolean.toString(healthy),
                    "instanceId", handle.instanceId()));
        } catch (WorkerControlException | RuntimeException failure) {
            healthy = false;
            recordCapability(entry, "WORKER_PROBE_FAILED", context, Map.of(
                    "code", capabilityCode(failure),
                    "instanceId", handle.instanceId()));
        }

        synchronized (this) {
            if (entry.handle == null || !entry.handle.instanceId().equals(handle.instanceId())) {
                throw new ResilienceException(
                        ResilienceException.Code.INVALID_WORKER_TRANSITION,
                        "worker instance changed during probe: " + workerId);
            }
            WorkerState next = healthy ? WorkerState.ELIGIBLE : WorkerState.INELIGIBLE;
            transition(entry, next, healthy ? "WORKER_ELIGIBLE" : "WORKER_INELIGIBLE", context, Map.of(
                    "reason", healthy ? "SUPERVISOR_PROBE_ACCEPTED" : "SUPERVISOR_PROBE_REJECTED"));
            return snapshot(entry);
        }
    }

    public WorkerSnapshot observeFailure(
            String workerId,
            String stage,
            String code,
            ResilienceContext context) {
        WorkerEntry entry;
        WorkerHandle handle;
        synchronized (this) {
            entry = requireWorker(workerId);
            handle = entry.handle;
        }
        boolean alive = false;
        if (handle != null) {
            try {
                alive = control.isHealthy(handle);
            } catch (WorkerControlException | RuntimeException ignored) {
                alive = false;
            }
        }
        recordCapability(entry, "WORKER_FAILURE_OBSERVED", context, Map.of(
                "stage", requireText(stage, "stage"),
                "code", requireText(code, "code"),
                "processAlive", Boolean.toString(alive)));
        synchronized (this) {
            if (entry.state == WorkerState.STOPPED || entry.state == WorkerState.STOPPING) {
                return snapshot(entry);
            }
            transition(entry, WorkerState.INELIGIBLE, "WORKER_INELIGIBLE", context, Map.of(
                    "stage", stage,
                    "code", code));
            return snapshot(entry);
        }
    }

    public WorkerSnapshot stop(String workerId, ResilienceContext context) {
        WorkerEntry entry;
        WorkerHandle handle;
        synchronized (this) {
            entry = requireWorker(workerId);
            if (entry.state == WorkerState.STOPPED) return snapshot(entry);
            if (entry.state == WorkerState.STOPPING || entry.state == WorkerState.REGISTERED) {
                throw invalidTransition(entry, "stop");
            }
            handle = entry.handle;
            transition(entry, WorkerState.STOPPING, "WORKER_STOPPING", context, Map.of());
        }
        if (handle != null) {
            try {
                control.stop(handle);
                recordCapability(entry, "WORKER_STOP_OBSERVED", context, Map.of(
                        "instanceId", handle.instanceId()));
            } catch (WorkerControlException | RuntimeException failure) {
                recordCapability(entry, "WORKER_STOP_FAILED", context, Map.of(
                        "code", capabilityCode(failure)));
                synchronized (this) {
                    transition(entry, WorkerState.FAILED, "WORKER_FAILED", context, Map.of(
                            "code", capabilityCode(failure)));
                    return snapshot(entry);
                }
            }
        }
        synchronized (this) {
            entry.handle = null;
            entry.processId = 0L;
            transition(entry, WorkerState.STOPPED, "WORKER_STOPPED", context, Map.of());
            return snapshot(entry);
        }
    }

    public synchronized WorkerSnapshot selectEligible() {
        List<WorkerEntry> eligible = workers.values().stream()
                .filter(entry -> entry.state == WorkerState.ELIGIBLE)
                .sorted(Comparator.comparing(entry -> entry.workerId))
                .toList();
        if (eligible.isEmpty()) {
            throw new ResilienceException(
                    ResilienceException.Code.NO_ELIGIBLE_WORKER,
                    "no worker is currently eligible");
        }
        WorkerEntry selected = eligible.get(Math.floorMod(routingCursor, eligible.size()));
        routingCursor++;
        return snapshot(selected);
    }

    public synchronized WorkerSnapshot snapshot(String workerId) {
        return snapshot(requireWorker(workerId));
    }

    public synchronized List<WorkerSnapshot> snapshots() {
        return workers.values().stream()
                .sorted(Comparator.comparing(entry -> entry.workerId))
                .map(this::snapshot)
                .toList();
    }

    public String controlEpoch() {
        return controlEpoch;
    }

    @Override
    public void close() {
        control.close();
    }

    private void transition(
            WorkerEntry entry,
            WorkerState next,
            String event,
            ResilienceContext context,
            Map<String, String> details) {
        WorkerState previous = entry.state;
        recordTransition(entry, previous, next, event, context, details);
        entry.state = next;
    }

    private void recordTransition(
            WorkerEntry entry,
            WorkerState previous,
            WorkerState next,
            String event,
            ResilienceContext context,
            Map<String, String> details) {
        Map<String, String> combined = new LinkedHashMap<>(details);
        combined.put("previousState", previous == null ? "" : previous.name());
        combined.put("newState", next.name());
        combined.put("instanceId", entry.instanceId);
        combined.put("workerEpoch", entry.epoch);
        combined.put("processId", Long.toString(entry.processId));
        journal.record(new ResilienceEventDraft(
                EventOwner.WORKER_SUPERVISOR,
                event,
                controlEpoch,
                context,
                "",
                "",
                entry.workerId,
                combined));
    }

    private void recordSupervisor(
            WorkerEntry entry,
            String event,
            ResilienceContext context,
            Map<String, String> details) {
        journal.record(new ResilienceEventDraft(
                EventOwner.WORKER_SUPERVISOR,
                event,
                controlEpoch,
                context,
                "",
                "",
                entry.workerId,
                details));
    }

    private void recordCapability(
            WorkerEntry entry,
            String event,
            ResilienceContext context,
            Map<String, String> details) {
        journal.record(new ResilienceEventDraft(
                EventOwner.WORKER_CAPABILITY,
                event,
                controlEpoch,
                context,
                "",
                "",
                entry.workerId,
                details));
    }

    private WorkerEntry requireWorker(String workerId) {
        WorkerEntry entry = workers.get(workerId);
        if (entry == null) {
            throw new ResilienceException(
                    ResilienceException.Code.WORKER_NOT_FOUND,
                    "worker not found: " + workerId);
        }
        return entry;
    }

    private WorkerHandle requireHandle(WorkerEntry entry) {
        if (entry.handle == null) {
            throw new ResilienceException(
                    ResilienceException.Code.INVALID_WORKER_TRANSITION,
                    "worker has no live handle: " + entry.workerId);
        }
        return entry.handle;
    }

    private void requireState(WorkerEntry entry, WorkerState expected) {
        if (entry.state != expected) throw invalidTransition(entry, "expected " + expected);
    }

    private ResilienceException invalidTransition(WorkerEntry entry, String action) {
        return new ResilienceException(
                ResilienceException.Code.INVALID_WORKER_TRANSITION,
                "cannot " + action + " worker " + entry.workerId + " from " + entry.state);
    }

    private WorkerSnapshot snapshot(WorkerEntry entry) {
        return new WorkerSnapshot(
                entry.workerId,
                entry.state,
                entry.instanceId,
                entry.epoch,
                entry.processId);
    }

    private String capabilityCode(Throwable failure) {
        return failure instanceof WorkerControlException controlFailure
                ? controlFailure.code()
                : failure.getClass().getSimpleName();
    }

    private static long parseLong(String value, long fallback) {
        if (value == null || value.isBlank()) return fallback;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
        return value;
    }

    private static final class WorkerEntry {
        private final String workerId;
        private WorkerState state;
        private String instanceId = "";
        private String epoch = "";
        private long processId;
        private WorkerHandle handle;

        private WorkerEntry(String workerId) {
            this.workerId = workerId;
        }
    }
}

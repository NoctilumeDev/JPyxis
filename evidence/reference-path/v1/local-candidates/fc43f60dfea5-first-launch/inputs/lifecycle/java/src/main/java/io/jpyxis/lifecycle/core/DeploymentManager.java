package io.jpyxis.lifecycle.core;

import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.ArtifactPayload;
import io.jpyxis.lifecycle.api.DeploymentSnapshot;
import io.jpyxis.lifecycle.api.DeploymentState;
import io.jpyxis.lifecycle.api.InvocationPin;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.api.LifecycleException;
import io.jpyxis.lifecycle.api.PinReleaseOutcome;
import io.jpyxis.lifecycle.api.RuntimeHandle;
import io.jpyxis.lifecycle.evidence.EventOwner;
import io.jpyxis.lifecycle.evidence.LifecycleEventDraft;
import io.jpyxis.lifecycle.evidence.LifecycleJournal;
import io.jpyxis.lifecycle.port.DeploymentRuntime;
import io.jpyxis.lifecycle.port.LifecycleCapabilityException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

public final class DeploymentManager {
    private final ArtifactRegistry artifactRegistry;
    private final LifecycleJournal journal;
    private final Map<String, DeploymentEntry> deployments = new LinkedHashMap<>();
    private final Map<String, String> activeBySlot = new LinkedHashMap<>();
    private final Map<String, PinEntry> outstandingPins = new LinkedHashMap<>();
    private final Map<String, PinEntry> forcedPins = new LinkedHashMap<>();
    // Reservations survive every release path, including uncertain admission diagnostics.
    private final Map<RuntimeHandle, DeploymentEntry> handleIdentityOwners = new LinkedHashMap<>();

    public DeploymentManager(ArtifactRegistry artifactRegistry, LifecycleJournal journal) {
        this.artifactRegistry = Objects.requireNonNull(artifactRegistry, "artifactRegistry");
        this.journal = Objects.requireNonNull(journal, "journal");
    }

    public DeploymentSnapshot request(
            String deploymentId,
            String slot,
            ArtifactCoordinate artifact,
            DeploymentRuntime runtime,
            LifecycleContext context) {
        requireText(deploymentId, "deploymentId");
        requireText(slot, "slot");
        Objects.requireNonNull(runtime, "runtime");
        Objects.requireNonNull(context, "context");
        ArtifactPayload payload = artifactRegistry.requireValidated(artifact);

        synchronized (this) {
            if (deployments.containsKey(deploymentId)) {
                throw new LifecycleException(
                        LifecycleException.Code.DEPLOYMENT_ALREADY_EXISTS,
                        "deployment already exists: " + deploymentId);
            }
            DeploymentEntry entry = new DeploymentEntry(
                    deploymentId,
                    slot,
                    payload,
                    runtime,
                    DeploymentState.REQUESTED);
            deployments.put(deploymentId, entry);
            recordTransition(entry, null, DeploymentState.REQUESTED, "DEPLOYMENT_REQUESTED", context, Map.of());
            return snapshot(entry);
        }
    }

    public DeploymentSnapshot load(String deploymentId, LifecycleContext context) {
        DeploymentEntry entry;
        synchronized (this) {
            entry = requireDeployment(deploymentId);
            requireState(entry, DeploymentState.REQUESTED);
            transition(entry, DeploymentState.LOADING, "DEPLOYMENT_LOADING", context, Map.of());
        }

        RuntimeHandle handle;
        try {
            handle = Objects.requireNonNull(entry.runtime.load(entry.artifact), "Runtime load returned null handle");
        } catch (LifecycleCapabilityException | RuntimeException exception) {
            String code = capabilityCode(exception, "LOAD_FAILED");
            recordCapability(entry, "LOAD_FAILED", context, Map.of("code", code));
            synchronized (this) {
                requireState(entry, DeploymentState.LOADING);
                transition(entry, DeploymentState.FAILED, "DEPLOYMENT_FAILED", context, Map.of(
                        "stage", "LOAD",
                        "code", code));
            }
            throw capabilityFailure("load", deploymentId, exception);
        }

        synchronized (this) {
            requireState(entry, DeploymentState.LOADING);
            DeploymentEntry priorOwner = handleIdentityOwners.get(handle);
            if (priorOwner == null) {
                handleIdentityOwners.put(handle, entry);
            }
            try {
                recordCapability(entry, "LOAD_SUCCEEDED", context, Map.of(
                        "providerIdentity", handle.providerIdentity(),
                        "providerVersion", handle.providerVersion(),
                        "opaqueHandle", handle.opaqueHandle()));
            } catch (RuntimeException diagnosticFailure) {
                transition(entry, DeploymentState.FAILED, "DEPLOYMENT_FAILED", context, Map.of(
                        "stage", "HANDLE_ADMISSION",
                        "code", "REQUIRED_LOAD_OBSERVATION_RECORD_FAILED"));
                throw capabilityFailure("load observation", deploymentId, diagnosticFailure);
            }
            if (priorOwner != null) {
                recordManager(entry, "RUNTIME_HANDLE_REJECTED", context, Map.of(
                        "providerIdentity", handle.providerIdentity(),
                        "providerVersion", handle.providerVersion(),
                        "opaqueHandle", handle.opaqueHandle(),
                        "priorOwnerDeploymentId", priorOwner.deploymentId,
                        "priorOwnerState", priorOwner.state.name(),
                        "priorOwnerArtifactIdentity", priorOwner.artifact.coordinate().identity(),
                        "priorOwnerArtifactDigest", priorOwner.artifact.coordinate().digest(),
                        "priorAdmissionDisposition", priorOwner.handle == null ? "UNKNOWN" : "ADMITTED",
                        "priorReleaseObservation", priorOwner.releaseObservation,
                        "reason", "CANONICAL_IDENTITY_ALREADY_RESERVED"));
                transition(entry, DeploymentState.FAILED, "DEPLOYMENT_FAILED", context, Map.of(
                        "stage", "HANDLE_ADMISSION",
                        "code", LifecycleException.Code.RUNTIME_HANDLE_IDENTITY_CONFLICT.name()));
                throw new LifecycleException(
                        LifecycleException.Code.RUNTIME_HANDLE_IDENTITY_CONFLICT,
                        "Runtime handle identity already belongs to deployment: " + priorOwner.deploymentId);
            }
            try {
                recordManager(entry, "RUNTIME_HANDLE_ADMITTED", context, Map.of(
                        "providerIdentity", handle.providerIdentity(),
                        "providerVersion", handle.providerVersion(),
                        "opaqueHandle", handle.opaqueHandle()));
            } catch (RuntimeException diagnosticFailure) {
                transition(entry, DeploymentState.FAILED, "DEPLOYMENT_FAILED", context, Map.of(
                        "stage", "HANDLE_ADMISSION",
                        "code", "REQUIRED_ADMISSION_RECORD_FAILED"));
                throw capabilityFailure("handle admission", deploymentId, diagnosticFailure);
            }
            entry.handle = handle;
            return snapshot(entry);
        }
    }

    public DeploymentSnapshot warm(String deploymentId, LifecycleContext context) {
        DeploymentEntry entry;
        RuntimeHandle handle;
        synchronized (this) {
            entry = requireDeployment(deploymentId);
            requireState(entry, DeploymentState.LOADING);
            handle = requireOwnedHandle(entry);
            transition(entry, DeploymentState.WARMING, "DEPLOYMENT_WARMING", context, Map.of());
        }

        try {
            entry.runtime.warm(handle);
            recordCapability(entry, "WARMUP_SUCCEEDED", context, Map.of(
                    "providerIdentity", handle.providerIdentity(),
                    "providerVersion", handle.providerVersion()));
        } catch (LifecycleCapabilityException | RuntimeException exception) {
            String code = capabilityCode(exception, "WARMUP_FAILED");
            recordCapability(entry, "WARMUP_FAILED", context, Map.of("code", code));
            synchronized (this) {
                requireState(entry, DeploymentState.WARMING);
                transition(entry, DeploymentState.FAILED, "DEPLOYMENT_FAILED", context, Map.of(
                        "stage", "WARMUP",
                        "code", code));
            }
            releaseFailedHandle(entry, handle, context);
            throw capabilityFailure("warmup", deploymentId, exception);
        }

        synchronized (this) {
            requireState(entry, DeploymentState.WARMING);
            transition(entry, DeploymentState.STANDBY, "DEPLOYMENT_STANDBY", context, Map.of());
            return snapshot(entry);
        }
    }

    public synchronized DeploymentSnapshot activate(String deploymentId, LifecycleContext context) {
        DeploymentEntry candidate = requireDeployment(deploymentId);
        requireState(candidate, DeploymentState.STANDBY);
        requireOwnedHandle(candidate);

        String currentId = activeBySlot.get(candidate.slot);
        DeploymentEntry current = currentId == null ? null : requireDeployment(currentId);
        if (current != null) {
            requireState(current, DeploymentState.ACTIVE);
            if (current.deploymentId.equals(candidate.deploymentId)) {
                throw new LifecycleException(
                        LifecycleException.Code.INVALID_DEPLOYMENT_TRANSITION,
                        "candidate is already the active deployment: " + deploymentId);
            }
        }

        if (current != null) {
            transition(current, DeploymentState.DRAINING, "DEPLOYMENT_DRAINING", context, Map.of(
                    "replacementDeploymentId", candidate.deploymentId));
            recordDrainClearedIfNeeded(current, context);
        }
        transition(candidate, DeploymentState.ACTIVE, "DEPLOYMENT_ACTIVE", context, Map.of(
                "replacedDeploymentId", current == null ? "" : current.deploymentId));
        activeBySlot.put(candidate.slot, candidate.deploymentId);
        recordManager(candidate, "ACTIVE_BINDING_CHANGED", context, Map.of(
                "previousDeploymentId", current == null ? "" : current.deploymentId,
                "activeDeploymentId", candidate.deploymentId));
        return snapshot(candidate);
    }

    public synchronized InvocationPin pinInvocation(
            String slot,
            String pinId,
            String invocationId,
            LifecycleContext context) {
        requireText(slot, "slot");
        requireText(pinId, "pinId");
        requireText(invocationId, "invocationId");
        if (outstandingPins.containsKey(pinId) || forcedPins.containsKey(pinId)) {
            throw new LifecycleException(
                    LifecycleException.Code.PIN_ALREADY_EXISTS,
                    "pin already exists: " + pinId);
        }

        String activeId = activeBySlot.get(slot);
        if (activeId == null) {
            throw new LifecycleException(
                    LifecycleException.Code.NO_ACTIVE_DEPLOYMENT,
                    "slot has no active deployment: " + slot);
        }
        DeploymentEntry deployment = requireDeployment(activeId);
        requireState(deployment, DeploymentState.ACTIVE);
        InvocationPin pin = new InvocationPin(
                pinId,
                invocationId,
                slot,
                deployment.deploymentId,
                deployment.artifact.coordinate(),
                requireOwnedHandle(deployment));
        PinEntry pinEntry = new PinEntry(pin, deployment);
        outstandingPins.put(pinId, pinEntry);
        deployment.pins.put(pinId, pinEntry);
        recordManager(deployment, "INVOCATION_PINNED", context, Map.of(
                "pinId", pinId,
                "invocationId", invocationId,
                "runtimeProviderIdentity", pin.runtimeHandle().providerIdentity(),
                "runtimeProviderVersion", pin.runtimeHandle().providerVersion()));
        return pin;
    }

    public synchronized PinReleaseOutcome releasePin(String pinId, LifecycleContext context) {
        PinEntry pin = outstandingPins.remove(pinId);
        if (pin != null) {
            pin.deployment.pins.remove(pinId);
            recordManager(pin.deployment, "INVOCATION_PIN_RELEASED", context, Map.of(
                    "pinId", pinId,
                    "invocationId", pin.pin.invocationId(),
                    "outcome", PinReleaseOutcome.OBLIGATION_COMPLETED.name()));
            recordDrainClearedIfNeeded(pin.deployment, context);
            notifyAll();
            return PinReleaseOutcome.OBLIGATION_COMPLETED;
        }

        PinEntry forced = forcedPins.remove(pinId);
        if (forced != null) {
            recordManager(forced.deployment, "FORCED_PIN_ACKNOWLEDGED", context, Map.of(
                    "pinId", pinId,
                    "invocationId", forced.pin.invocationId(),
                    "outcome", PinReleaseOutcome.FORCED_TERMINATION_REQUIRED.name()));
            return PinReleaseOutcome.FORCED_TERMINATION_REQUIRED;
        }
        throw new LifecycleException(LifecycleException.Code.PIN_NOT_FOUND, "pin is unknown: " + pinId);
    }

    public synchronized DeploymentSnapshot drain(String deploymentId, LifecycleContext context) {
        DeploymentEntry entry = requireDeployment(deploymentId);
        requireState(entry, DeploymentState.ACTIVE);
        if (!entry.deploymentId.equals(activeBySlot.get(entry.slot))) {
            throw new LifecycleException(
                    LifecycleException.Code.INVALID_DEPLOYMENT_TRANSITION,
                    "deployment is not the authoritative active binding: " + deploymentId);
        }
        activeBySlot.remove(entry.slot);
        transition(entry, DeploymentState.DRAINING, "DEPLOYMENT_DRAINING", context, Map.of(
                "replacementDeploymentId", ""));
        recordDrainClearedIfNeeded(entry, context);
        return snapshot(entry);
    }

    public synchronized boolean awaitDrain(String deploymentId, Duration timeout, LifecycleContext context) {
        Objects.requireNonNull(timeout, "timeout");
        if (timeout.isNegative()) {
            throw new IllegalArgumentException("timeout must not be negative");
        }
        DeploymentEntry entry = requireDeployment(deploymentId);
        requireState(entry, DeploymentState.DRAINING);
        long remainingNanos = timeout.toNanos();
        long deadline = System.nanoTime() + remainingNanos;
        while (!entry.pins.isEmpty() && remainingNanos > 0L) {
            long millis = remainingNanos / 1_000_000L;
            int nanos = (int) (remainingNanos % 1_000_000L);
            try {
                wait(millis, nanos);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new LifecycleException(
                        LifecycleException.Code.CONTROL_INTERRUPTED,
                        "drain wait was interrupted: " + deploymentId,
                        exception);
            }
            remainingNanos = deadline - System.nanoTime();
        }
        boolean drained = entry.pins.isEmpty();
        recordManager(entry, drained ? "DRAIN_WAIT_COMPLETED" : "DRAIN_WAIT_TIMED_OUT", context, Map.of(
                "outstandingPins", Integer.toString(entry.pins.size())));
        return drained;
    }

    public synchronized int requireForcedTermination(String deploymentId, LifecycleContext context) {
        DeploymentEntry entry = requireDeployment(deploymentId);
        requireState(entry, DeploymentState.DRAINING);
        ArrayList<PinEntry> pins = new ArrayList<>(entry.pins.values());
        for (PinEntry pin : pins) {
            outstandingPins.remove(pin.pin.pinId());
            forcedPins.put(pin.pin.pinId(), pin);
            recordManager(entry, "FORCED_TERMINATION_REQUIRED", context, Map.of(
                    "pinId", pin.pin.pinId(),
                    "invocationId", pin.pin.invocationId()));
        }
        entry.pins.clear();
        recordDrainClearedIfNeeded(entry, context);
        notifyAll();
        return pins.size();
    }

    public DeploymentSnapshot unload(String deploymentId, LifecycleContext context) {
        DeploymentEntry entry;
        RuntimeHandle handle;
        synchronized (this) {
            entry = requireDeployment(deploymentId);
            requireState(entry, DeploymentState.DRAINING);
            if (!entry.pins.isEmpty()) {
                throw new LifecycleException(
                        LifecycleException.Code.OUTSTANDING_PINS,
                        "deployment still owes accepted work: " + deploymentId);
            }
            handle = requireOwnedHandle(entry);
            transition(entry, DeploymentState.UNLOADING, "DEPLOYMENT_UNLOADING", context, Map.of());
        }

        try {
            entry.runtime.unload(handle);
            recordCapability(entry, "UNLOAD_SUCCEEDED", context, Map.of(
                    "providerIdentity", handle.providerIdentity(),
                    "providerVersion", handle.providerVersion()));
        } catch (LifecycleCapabilityException | RuntimeException exception) {
            String code = capabilityCode(exception, "UNLOAD_FAILED");
            recordCapability(entry, "UNLOAD_FAILED", context, Map.of("code", code));
            synchronized (this) {
                requireState(entry, DeploymentState.UNLOADING);
                transition(entry, DeploymentState.FAILED, "DEPLOYMENT_FAILED", context, Map.of(
                        "stage", "UNLOAD",
                        "code", code));
                recordUnknownRelease(entry, handle, "UNLOAD", code, context);
            }
            throw capabilityFailure("unload", deploymentId, exception);
        }

        synchronized (this) {
            requireState(entry, DeploymentState.UNLOADING);
            entry.releaseObservation = "REPORTED_RELEASED";
            transition(entry, DeploymentState.RETIRED, "DEPLOYMENT_RETIRED", context, Map.of());
            return snapshot(entry);
        }
    }

    public DeploymentSnapshot rollback(
            String deploymentId,
            String slot,
            ArtifactCoordinate targetArtifact,
            DeploymentRuntime runtime,
            LifecycleContext context) {
        Objects.requireNonNull(targetArtifact, "targetArtifact");
        synchronized (this) {
            String current = activeBySlot.get(slot);
            recordManager(
                    current == null ? null : requireDeployment(current),
                    "ROLLBACK_REQUESTED",
                    context,
                    Map.of(
                            "rollbackDeploymentId", deploymentId,
                            "targetArtifactIdentity", targetArtifact.identity(),
                            "targetArtifactDigest", targetArtifact.digest(),
                            "currentDeploymentId", current == null ? "" : current));
        }
        request(deploymentId, slot, targetArtifact, runtime, context);
        try {
            load(deploymentId, context);
            warm(deploymentId, context);
        } catch (LifecycleException failure) {
            synchronized (this) {
                DeploymentEntry failed = requireDeployment(deploymentId);
                recordManager(failed, "ROLLBACK_FAILED", context, Map.of("code", failure.code().name()));
                return snapshot(failed);
            }
        }
        DeploymentSnapshot active = activate(deploymentId, context);
        synchronized (this) {
            recordManager(requireDeployment(deploymentId), "ROLLBACK_COMMITTED", context, Map.of(
                    "targetArtifactIdentity", targetArtifact.identity(),
                    "targetArtifactDigest", targetArtifact.digest()));
        }
        return active;
    }

    public synchronized DeploymentSnapshot snapshot(String deploymentId) {
        return snapshot(requireDeployment(deploymentId));
    }

    public synchronized java.util.List<DeploymentSnapshot> snapshots() {
        return deployments.values().stream()
                .sorted(Comparator.comparing(entry -> entry.deploymentId))
                .map(this::snapshot)
                .toList();
    }

    public synchronized Map<String, String> activeBindings() {
        return Map.copyOf(new TreeMap<>(activeBySlot));
    }

    private void releaseFailedHandle(
            DeploymentEntry entry,
            RuntimeHandle handle,
            LifecycleContext context) {
        synchronized (this) {
            if (!requireOwnedHandle(entry).equals(handle)) {
                throw new LifecycleException(LifecycleException.Code.CAPABILITY_FAILURE,
                        "failed-handle release does not match the admitted owner");
            }
        }
        try {
            entry.runtime.unload(handle);
            recordCapability(entry, "FAILED_HANDLE_RELEASED", context, Map.of());
            synchronized (this) {
                entry.releaseObservation = "REPORTED_RELEASED";
            }
        } catch (LifecycleCapabilityException | RuntimeException cleanupFailure) {
            String code = capabilityCode(cleanupFailure, "FAILED_HANDLE_RELEASE_FAILED");
            recordCapability(entry, "FAILED_HANDLE_RELEASE_FAILED", context, Map.of(
                    "code", code));
            synchronized (this) {
                recordUnknownRelease(entry, handle, "FAILED_WARMUP", code, context);
            }
        }
    }

    private void recordUnknownRelease(
            DeploymentEntry entry, RuntimeHandle handle, String stage, String code, LifecycleContext context) {
        entry.releaseObservation = "UNKNOWN";
        recordManager(entry, "RUNTIME_HANDLE_RELEASE_UNCERTAIN", context, Map.of(
                "providerIdentity", handle.providerIdentity(),
                "providerVersion", handle.providerVersion(),
                "opaqueHandle", handle.opaqueHandle(),
                "stage", stage,
                "code", code,
                "releaseObservation", "UNKNOWN"));
    }

    private void recordDrainClearedIfNeeded(DeploymentEntry entry, LifecycleContext context) {
        if (entry.state == DeploymentState.DRAINING && entry.pins.isEmpty() && !entry.drainClearedRecorded) {
            entry.drainClearedRecorded = true;
            recordManager(entry, "DRAIN_OBLIGATIONS_CLEARED", context, Map.of());
        }
    }

    private void transition(
            DeploymentEntry entry,
            DeploymentState next,
            String event,
            LifecycleContext context,
            Map<String, String> details) {
        DeploymentState previous = entry.state;
        entry.state = next;
        recordTransition(entry, previous, next, event, context, details);
    }

    private void recordTransition(
            DeploymentEntry entry,
            DeploymentState previous,
            DeploymentState next,
            String event,
            LifecycleContext context,
            Map<String, String> details) {
        journal.record(new LifecycleEventDraft(
                EventOwner.DEPLOYMENT_MANAGER,
                event,
                context,
                entry.artifact.coordinate().identity(),
                entry.artifact.coordinate().digest(),
                entry.deploymentId,
                entry.slot,
                previous == null ? null : previous.name(),
                next == null ? null : next.name(),
                details));
    }

    private void recordManager(
            DeploymentEntry entry,
            String event,
            LifecycleContext context,
            Map<String, String> details) {
        journal.record(new LifecycleEventDraft(
                EventOwner.DEPLOYMENT_MANAGER,
                event,
                context,
                entry == null ? details.get("targetArtifactIdentity") : entry.artifact.coordinate().identity(),
                entry == null ? details.get("targetArtifactDigest") : entry.artifact.coordinate().digest(),
                entry == null ? details.get("rollbackDeploymentId") : entry.deploymentId,
                entry == null ? null : entry.slot,
                null,
                null,
                details));
    }

    private void recordCapability(
            DeploymentEntry entry,
            String event,
            LifecycleContext context,
            Map<String, String> details) {
        journal.record(new LifecycleEventDraft(
                EventOwner.LIFECYCLE_CAPABILITY,
                event,
                context,
                entry.artifact.coordinate().identity(),
                entry.artifact.coordinate().digest(),
                entry.deploymentId,
                entry.slot,
                null,
                null,
                details));
    }

    private DeploymentEntry requireDeployment(String deploymentId) {
        DeploymentEntry entry = deployments.get(deploymentId);
        if (entry == null) {
            throw new LifecycleException(
                    LifecycleException.Code.DEPLOYMENT_NOT_FOUND,
                    "deployment is unknown: " + deploymentId);
        }
        return entry;
    }

    private void requireState(DeploymentEntry entry, DeploymentState expected) {
        if (entry.state != expected) {
            throw new LifecycleException(
                    LifecycleException.Code.INVALID_DEPLOYMENT_TRANSITION,
                    "deployment " + entry.deploymentId + " is " + entry.state + ", expected " + expected);
        }
    }

    private RuntimeHandle requireHandle(DeploymentEntry entry) {
        if (entry.handle == null) {
            throw new LifecycleException(
                    LifecycleException.Code.INVALID_DEPLOYMENT_TRANSITION,
                    "deployment has no Runtime handle: " + entry.deploymentId);
        }
        return entry.handle;
    }

    private RuntimeHandle requireOwnedHandle(DeploymentEntry entry) {
        RuntimeHandle handle = requireHandle(entry);
        if (handleIdentityOwners.get(handle) != entry) {
            throw new LifecycleException(LifecycleException.Code.CAPABILITY_FAILURE,
                    "Runtime handle is not admitted to deployment: " + entry.deploymentId);
        }
        return handle;
    }

    private DeploymentSnapshot snapshot(DeploymentEntry entry) {
        return new DeploymentSnapshot(
                entry.deploymentId,
                entry.slot,
                entry.artifact.coordinate(),
                entry.state,
                entry.handle == null ? null : entry.handle.providerIdentity(),
                entry.handle == null ? null : entry.handle.providerVersion(),
                entry.pins.size());
    }

    private LifecycleException capabilityFailure(String operation, String deploymentId, Throwable cause) {
        return new LifecycleException(
                LifecycleException.Code.CAPABILITY_FAILURE,
                "Runtime lifecycle capability failed during " + operation + ": " + deploymentId,
                cause);
    }

    private String capabilityCode(Throwable failure, String fallback) {
        return failure instanceof LifecycleCapabilityException capabilityFailure
                ? capabilityFailure.code()
                : fallback;
    }

    private static void requireText(String value, String label) {
        Objects.requireNonNull(value, label);
        if (value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }

    private static final class DeploymentEntry {
        private final String deploymentId;
        private final String slot;
        private final ArtifactPayload artifact;
        private final DeploymentRuntime runtime;
        private final Map<String, PinEntry> pins = new LinkedHashMap<>();
        private DeploymentState state;
        private RuntimeHandle handle;
        private String releaseObservation = "NOT_OBSERVED";
        private boolean drainClearedRecorded;

        private DeploymentEntry(
                String deploymentId,
                String slot,
                ArtifactPayload artifact,
                DeploymentRuntime runtime,
                DeploymentState state) {
            this.deploymentId = deploymentId;
            this.slot = slot;
            this.artifact = artifact;
            this.runtime = runtime;
            this.state = state;
        }
    }

    private record PinEntry(InvocationPin pin, DeploymentEntry deployment) {
    }
}

package io.jpyxis.resilience.reference;

import io.jpyxis.lifecycle.api.ArtifactPayload;
import io.jpyxis.lifecycle.api.RuntimeHandle;
import io.jpyxis.lifecycle.port.DeploymentRuntime;
import io.jpyxis.lifecycle.port.LifecycleCapabilityException;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

public final class FaultInjectingLifecycleRuntime implements DeploymentRuntime {
    public enum Stage {
        NONE,
        LOAD,
        WARMUP,
        UNLOAD
    }

    private final String identity;
    private final Stage failureStage;
    private final Runnable onFailure;
    private final AtomicInteger sequence = new AtomicInteger();
    private final Set<String> handles = new LinkedHashSet<>();

    public FaultInjectingLifecycleRuntime(String identity, Stage failureStage, Runnable onFailure) {
        this.identity = identity;
        this.failureStage = failureStage;
        this.onFailure = onFailure == null ? () -> { } : onFailure;
    }

    @Override
    public synchronized RuntimeHandle load(ArtifactPayload artifact) throws LifecycleCapabilityException {
        failIf(Stage.LOAD);
        String handle = identity + ":" + sequence.incrementAndGet();
        handles.add(handle);
        return new RuntimeHandle(identity, "m5-reference", handle);
    }

    @Override
    public synchronized void warm(RuntimeHandle handle) throws LifecycleCapabilityException {
        requireHandle(handle);
        failIf(Stage.WARMUP);
    }

    @Override
    public synchronized void unload(RuntimeHandle handle) throws LifecycleCapabilityException {
        requireHandle(handle);
        failIf(Stage.UNLOAD);
        handles.remove(handle.opaqueHandle());
    }

    public synchronized int liveHandleCount() {
        return handles.size();
    }

    private void failIf(Stage stage) throws LifecycleCapabilityException {
        if (failureStage == stage) {
            onFailure.run();
            throw new LifecycleCapabilityException(
                    "INJECTED_" + stage.name() + "_FAILURE",
                    "injected M5 lifecycle failure");
        }
    }

    private void requireHandle(RuntimeHandle handle) throws LifecycleCapabilityException {
        if (!identity.equals(handle.providerIdentity()) || !handles.contains(handle.opaqueHandle())) {
            throw new LifecycleCapabilityException("UNKNOWN_HANDLE", "lifecycle handle is not live");
        }
    }
}

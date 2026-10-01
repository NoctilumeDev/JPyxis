package io.jpyxis.lifecycle.reference;

import io.jpyxis.lifecycle.api.ArtifactPayload;
import io.jpyxis.lifecycle.api.RuntimeHandle;
import io.jpyxis.lifecycle.port.DeploymentRuntime;
import io.jpyxis.lifecycle.port.LifecycleCapabilityException;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

public final class ReferenceLifecycleRuntime implements DeploymentRuntime {
    private final String identity;
    private final String version;
    private final boolean failWarmup;
    private final AtomicInteger handleSequence = new AtomicInteger();
    private final Set<String> liveHandles = new LinkedHashSet<>();

    public ReferenceLifecycleRuntime(String identity, String version, boolean failWarmup) {
        this.identity = identity;
        this.version = version;
        this.failWarmup = failWarmup;
    }

    @Override
    public synchronized RuntimeHandle load(ArtifactPayload artifact) throws LifecycleCapabilityException {
        if (artifact.content().length == 0) {
            throw new LifecycleCapabilityException("EMPTY_ARTIFACT", "artifact content is empty");
        }
        String handleId = identity + ":" + artifact.coordinate().digest().substring(7, 19)
                + ":" + handleSequence.incrementAndGet();
        liveHandles.add(handleId);
        return new RuntimeHandle(identity, version, handleId);
    }

    @Override
    public synchronized void warm(RuntimeHandle handle) throws LifecycleCapabilityException {
        requireLive(handle);
        if (failWarmup) {
            throw new LifecycleCapabilityException("REFERENCE_WARMUP_FAILED", "injected warmup failure");
        }
    }

    @Override
    public synchronized void unload(RuntimeHandle handle) throws LifecycleCapabilityException {
        requireLive(handle);
        liveHandles.remove(handle.opaqueHandle());
    }

    public synchronized int liveHandleCount() {
        return liveHandles.size();
    }

    private void requireLive(RuntimeHandle handle) throws LifecycleCapabilityException {
        if (!identity.equals(handle.providerIdentity())
                || !version.equals(handle.providerVersion())
                || !liveHandles.contains(handle.opaqueHandle())) {
            throw new LifecycleCapabilityException("UNKNOWN_HANDLE", "Runtime handle is not live");
        }
    }
}

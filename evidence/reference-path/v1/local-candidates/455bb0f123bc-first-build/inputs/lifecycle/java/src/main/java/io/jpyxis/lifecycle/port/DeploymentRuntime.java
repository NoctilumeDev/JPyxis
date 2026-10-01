package io.jpyxis.lifecycle.port;

import io.jpyxis.lifecycle.api.ArtifactPayload;
import io.jpyxis.lifecycle.api.RuntimeHandle;

public interface DeploymentRuntime {
    RuntimeHandle load(ArtifactPayload artifact) throws LifecycleCapabilityException;

    void warm(RuntimeHandle handle) throws LifecycleCapabilityException;

    void unload(RuntimeHandle handle) throws LifecycleCapabilityException;
}

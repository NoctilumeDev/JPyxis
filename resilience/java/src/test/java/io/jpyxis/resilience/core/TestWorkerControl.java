package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.WorkerHandle;
import io.jpyxis.resilience.port.WorkerControl;

import java.util.HashMap;
import java.util.Map;

final class TestWorkerControl implements WorkerControl {
    private final Map<String, Boolean> alive = new HashMap<>();
    private long processSequence = 1000L;

    @Override
    public WorkerHandle start(String workerId, String instanceId, String controlEpoch) {
        WorkerHandle handle = new WorkerHandle(workerId, instanceId, controlEpoch, ++processSequence);
        alive.put(instanceId, true);
        return handle;
    }

    @Override
    public boolean isHealthy(WorkerHandle handle) {
        return alive.getOrDefault(handle.instanceId(), false);
    }

    @Override
    public void stop(WorkerHandle handle) {
        alive.put(handle.instanceId(), false);
    }

    @Override
    public void close() {
        alive.replaceAll((instance, ignored) -> false);
    }
}

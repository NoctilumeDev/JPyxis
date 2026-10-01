package io.jpyxis.resilience.port;

import io.jpyxis.resilience.api.WorkerHandle;

public interface WorkerControl extends AutoCloseable {
    WorkerHandle start(String workerId, String instanceId, String controlEpoch) throws WorkerControlException;

    boolean isHealthy(WorkerHandle handle) throws WorkerControlException;

    void stop(WorkerHandle handle) throws WorkerControlException;

    @Override
    void close();
}

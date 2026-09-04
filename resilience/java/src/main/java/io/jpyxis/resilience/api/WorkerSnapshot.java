package io.jpyxis.resilience.api;

public record WorkerSnapshot(
        String workerId,
        WorkerState state,
        String instanceId,
        String controlEpoch,
        long processId) {
    public boolean eligible() {
        return state == WorkerState.ELIGIBLE;
    }
}

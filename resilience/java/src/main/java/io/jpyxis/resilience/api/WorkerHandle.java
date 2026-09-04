package io.jpyxis.resilience.api;

public record WorkerHandle(
        String workerId,
        String instanceId,
        String controlEpoch,
        long processId) {
    public WorkerHandle {
        requireText(workerId, "workerId");
        requireText(instanceId, "instanceId");
        requireText(controlEpoch, "controlEpoch");
        if (processId <= 0) {
            throw new IllegalArgumentException("processId must be positive");
        }
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }
}

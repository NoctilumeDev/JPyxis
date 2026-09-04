package io.jpyxis.resilience.evidence;

import java.util.Map;

public record ResilienceEvent(
        long sequence,
        String previousDigest,
        String digest,
        EventOwner owner,
        String event,
        String controlEpoch,
        String actor,
        String cause,
        String traceId,
        String logicalInvocationId,
        String attemptId,
        String workerId,
        Map<String, String> details) {
    public ResilienceEvent {
        details = Map.copyOf(details);
    }
}

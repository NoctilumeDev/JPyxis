package io.jpyxis.resilience.evidence;

import io.jpyxis.resilience.api.ResilienceContext;

import java.util.Map;

public record ResilienceEventDraft(
        EventOwner owner,
        String event,
        String controlEpoch,
        ResilienceContext context,
        String logicalInvocationId,
        String attemptId,
        String workerId,
        Map<String, String> details) {
    public ResilienceEventDraft {
        if (owner == null || context == null) {
            throw new IllegalArgumentException("owner and context are required");
        }
        requireText(event, "event");
        requireText(controlEpoch, "controlEpoch");
        logicalInvocationId = clean(logicalInvocationId);
        attemptId = clean(attemptId);
        workerId = clean(workerId);
        details = details == null ? Map.of() : Map.copyOf(details);
    }

    private static String clean(String value) {
        return value == null ? "" : value;
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
    }
}

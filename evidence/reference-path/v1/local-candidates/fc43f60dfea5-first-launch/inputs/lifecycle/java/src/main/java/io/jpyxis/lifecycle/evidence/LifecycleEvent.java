package io.jpyxis.lifecycle.evidence;

import java.util.Map;

public record LifecycleEvent(
        long sequence,
        EventOwner owner,
        String event,
        String actor,
        String cause,
        String traceId,
        String artifactIdentity,
        String artifactDigest,
        String deploymentId,
        String slot,
        String previousState,
        String newState,
        Map<String, String> details) {
}

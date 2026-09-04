package io.jpyxis.lifecycle.evidence;

import io.jpyxis.lifecycle.api.LifecycleContext;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public record LifecycleEventDraft(
        EventOwner owner,
        String event,
        LifecycleContext context,
        String artifactIdentity,
        String artifactDigest,
        String deploymentId,
        String slot,
        String previousState,
        String newState,
        Map<String, String> details) {
    public LifecycleEventDraft {
        Objects.requireNonNull(owner, "owner");
        Objects.requireNonNull(event, "event");
        Objects.requireNonNull(context, "context");
        details = Map.copyOf(new LinkedHashMap<>(details == null ? Map.of() : details));
    }
}

package io.jpyxis.resilience.evidence;

import java.util.Map;
import java.util.TreeMap;

public final class ResilienceMetrics {
    private final Map<String, Long> counters = new TreeMap<>();

    public synchronized void observe(ResilienceEvent event) {
        increment("events.total");
        increment("events.owner." + event.owner().name());
        increment("events.type." + event.event());
        switch (event.event()) {
            case "WORKER_ELIGIBLE" -> increment("workers.eligible.decisions");
            case "WORKER_INELIGIBLE", "WORKER_RECOVERY_FENCED" ->
                    increment("workers.ineligible.decisions");
            case "ATTEMPT_DISPATCH_INTENT" -> increment("attempts.dispatched");
            case "RETRY_ALLOWED" -> increment("retries.allowed");
            case "RETRY_DENIED" -> increment("retries.denied");
            case "INVOCATION_TERMINAL_UNKNOWN" -> increment("invocations.outcome_unknown");
            case "INVOCATION_TERMINAL_SUCCEEDED" -> increment("invocations.succeeded");
            case "INVOCATION_TERMINAL_FAILED" -> increment("invocations.failed");
            case "RECOVERY_STARTED" -> increment("recovery.started");
            case "TELEMETRY_EXPORT_FAILED" -> increment("telemetry.export_failures");
            default -> { }
        }
    }

    public synchronized Map<String, Long> snapshot() {
        return Map.copyOf(new TreeMap<>(counters));
    }

    private void increment(String name) {
        counters.merge(name, 1L, Long::sum);
    }
}

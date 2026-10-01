package io.jpyxis.resilience.port;

import io.jpyxis.resilience.evidence.ResilienceEvent;

@FunctionalInterface
public interface TelemetrySink {
    void publish(ResilienceEvent event) throws Exception;

    static TelemetrySink noOp() {
        return event -> { };
    }
}

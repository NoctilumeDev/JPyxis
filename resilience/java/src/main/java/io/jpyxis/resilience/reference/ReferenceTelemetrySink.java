package io.jpyxis.resilience.reference;

import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.port.TelemetrySink;

import java.util.ArrayList;
import java.util.List;

public final class ReferenceTelemetrySink implements TelemetrySink {
    private final boolean fail;
    private final List<ResilienceEvent> exported = new ArrayList<>();

    public ReferenceTelemetrySink(boolean fail) {
        this.fail = fail;
    }

    @Override
    public synchronized void publish(ResilienceEvent event) {
        if (fail) throw new IllegalStateException("injected telemetry export failure");
        exported.add(event);
    }

    public synchronized List<ResilienceEvent> exported() {
        return List.copyOf(exported);
    }
}

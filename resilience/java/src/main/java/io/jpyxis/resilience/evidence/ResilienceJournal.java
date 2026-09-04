package io.jpyxis.resilience.evidence;

import java.util.List;

public interface ResilienceJournal extends AutoCloseable {
    ResilienceEvent record(ResilienceEventDraft draft);

    List<ResilienceEvent> events();

    @Override
    void close();
}

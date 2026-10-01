package io.jpyxis.lifecycle.evidence;

import java.util.List;

public interface LifecycleJournal {
    void record(LifecycleEventDraft event);

    List<LifecycleEvent> events();
}

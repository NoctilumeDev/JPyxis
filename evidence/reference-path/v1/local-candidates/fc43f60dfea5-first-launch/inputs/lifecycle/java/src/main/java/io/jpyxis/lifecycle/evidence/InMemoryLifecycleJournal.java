package io.jpyxis.lifecycle.evidence;

import java.util.ArrayList;
import java.util.List;

public final class InMemoryLifecycleJournal implements LifecycleJournal {
    private final List<LifecycleEvent> events = new ArrayList<>();

    @Override
    public synchronized void record(LifecycleEventDraft draft) {
        events.add(new LifecycleEvent(
                events.size() + 1L,
                draft.owner(),
                draft.event(),
                draft.context().actor(),
                draft.context().cause(),
                draft.context().traceId(),
                draft.artifactIdentity(),
                draft.artifactDigest(),
                draft.deploymentId(),
                draft.slot(),
                draft.previousState(),
                draft.newState(),
                draft.details()));
    }

    @Override
    public synchronized List<LifecycleEvent> events() {
        return List.copyOf(events);
    }
}

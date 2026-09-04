package io.jpyxis.resilience.core;

import io.jpyxis.resilience.api.DesiredBinding;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.evidence.EventOwner;
import io.jpyxis.resilience.evidence.ResilienceEvent;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;
import io.jpyxis.resilience.evidence.ResilienceJournal;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class ControlIntentRegistry {
    private final ResilienceJournal journal;
    private final String controlEpoch;
    private final Map<String, DesiredBinding> desiredBySlot = new LinkedHashMap<>();

    public ControlIntentRegistry(ResilienceJournal journal, String controlEpoch) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.controlEpoch = Objects.requireNonNull(controlEpoch, "controlEpoch");
    }

    public static ControlIntentRegistry recover(ResilienceJournal journal, String controlEpoch) {
        ControlIntentRegistry registry = new ControlIntentRegistry(journal, controlEpoch);
        for (ResilienceEvent event : journal.events()) {
            if (event.owner() != EventOwner.CONTROL_INTENT_REGISTRY
                    || !event.event().equals("DESIRED_BINDING_SET")) continue;
            Map<String, String> details = event.details();
            DesiredBinding binding = new DesiredBinding(
                    details.get("slot"),
                    details.get("artifactIdentity"),
                    details.get("artifactDigest"),
                    Long.parseLong(details.get("revision")));
            registry.desiredBySlot.put(binding.slot(), binding);
        }
        return registry;
    }

    public synchronized DesiredBinding set(DesiredBinding binding, ResilienceContext context) {
        Objects.requireNonNull(binding, "binding");
        DesiredBinding current = desiredBySlot.get(binding.slot());
        long expected = current == null ? 1L : current.revision() + 1L;
        if (binding.revision() != expected) {
            throw new ResilienceException(
                    ResilienceException.Code.DESIRED_BINDING_REVISION_CONFLICT,
                    "desired binding revision must be " + expected + " for " + binding.slot());
        }
        journal.record(new ResilienceEventDraft(
                EventOwner.CONTROL_INTENT_REGISTRY,
                "DESIRED_BINDING_SET",
                controlEpoch,
                context,
                "",
                "",
                "",
                Map.of(
                        "slot", binding.slot(),
                        "artifactIdentity", binding.artifactIdentity(),
                        "artifactDigest", binding.artifactDigest(),
                        "revision", Long.toString(binding.revision()))));
        desiredBySlot.put(binding.slot(), binding);
        return binding;
    }

    public synchronized DesiredBinding require(String slot) {
        DesiredBinding binding = desiredBySlot.get(slot);
        if (binding == null) {
            throw new ResilienceException(
                    ResilienceException.Code.DESIRED_BINDING_REVISION_CONFLICT,
                    "desired binding is missing for " + slot);
        }
        return binding;
    }

    public synchronized List<DesiredBinding> snapshots() {
        return desiredBySlot.values().stream()
                .sorted(Comparator.comparing(DesiredBinding::slot))
                .toList();
    }
}

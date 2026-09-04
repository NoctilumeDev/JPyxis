package io.jpyxis.resilience.reference;

import io.jpyxis.resilience.api.AttemptObservation;
import io.jpyxis.resilience.api.AttemptPlan;
import io.jpyxis.resilience.port.AttemptExecutor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ReferenceAttemptExecutor implements AttemptExecutor {
    private final LocalWorkerProcessControl processes;
    private final Map<String, ArrayDeque<Step>> scripts = new LinkedHashMap<>();

    public ReferenceAttemptExecutor(LocalWorkerProcessControl processes) {
        this.processes = processes;
    }

    public synchronized void script(String logicalInvocationId, Step... steps) {
        ArrayDeque<Step> queue = new ArrayDeque<>();
        for (Step step : steps) queue.add(step);
        scripts.put(logicalInvocationId, queue);
    }

    @Override
    public synchronized AttemptObservation execute(AttemptPlan plan) {
        ArrayDeque<Step> queue = scripts.get(plan.logicalInvocationId());
        Step step = queue == null || queue.isEmpty()
                ? new Step(AttemptObservation.succeeded(resultDigest(plan.logicalInvocationId())), false)
                : queue.removeFirst();
        if (step.crashWorker()) processes.crashWorker(plan.worker().workerId());
        return step.observation();
    }

    public static String resultDigest(String logicalInvocationId) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(
                    ("m5-result:" + logicalInvocationId).getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException("SHA-256 is unavailable", failure);
        }
    }

    public record Step(AttemptObservation observation, boolean crashWorker) {
    }
}

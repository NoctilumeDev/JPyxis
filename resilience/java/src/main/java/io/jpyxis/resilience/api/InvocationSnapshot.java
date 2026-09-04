package io.jpyxis.resilience.api;

import java.util.List;

public record InvocationSnapshot(
        String logicalInvocationId,
        String traceId,
        IdempotencyMode idempotencyMode,
        String deduplicationScope,
        int maximumAttempts,
        LogicalInvocationState state,
        List<AttemptSnapshot> attempts,
        String resultDigest,
        String terminalCode) {
    public InvocationSnapshot {
        attempts = List.copyOf(attempts);
        resultDigest = resultDigest == null ? "" : resultDigest;
        terminalCode = terminalCode == null ? "" : terminalCode;
    }
}

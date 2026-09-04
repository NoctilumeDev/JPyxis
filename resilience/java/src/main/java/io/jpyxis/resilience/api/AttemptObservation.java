package io.jpyxis.resilience.api;

public record AttemptObservation(
        AttemptObservationKind kind,
        String code,
        String resultDigest,
        boolean executionMayContinue) {
    public AttemptObservation {
        if (kind == null) {
            throw new IllegalArgumentException("kind is required");
        }
        code = code == null ? "" : code;
        resultDigest = resultDigest == null ? "" : resultDigest;
        if (kind == AttemptObservationKind.SUCCEEDED && resultDigest.isBlank()) {
            throw new IllegalArgumentException("successful observation requires resultDigest");
        }
        if (kind != AttemptObservationKind.SUCCEEDED && code.isBlank()) {
            throw new IllegalArgumentException("failure observation requires code");
        }
    }

    public static AttemptObservation succeeded(String resultDigest) {
        return new AttemptObservation(AttemptObservationKind.SUCCEEDED, "OK", resultDigest, false);
    }

    public static AttemptObservation failedBeforeExecution(String code) {
        return new AttemptObservation(AttemptObservationKind.FAILED_BEFORE_EXECUTION, code, "", false);
    }

    public static AttemptObservation failedAfterExecution(String code) {
        return new AttemptObservation(AttemptObservationKind.FAILED_AFTER_EXECUTION, code, "", false);
    }

    public static AttemptObservation unknown(String code) {
        return new AttemptObservation(AttemptObservationKind.UNKNOWN_REMOTE_OUTCOME, code, "", true);
    }
}

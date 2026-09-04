package io.jpyxis.resilience.api;

public final class ResilienceException extends RuntimeException {
    public enum Code {
        WORKER_ALREADY_REGISTERED,
        WORKER_NOT_FOUND,
        INVALID_WORKER_TRANSITION,
        NO_ELIGIBLE_WORKER,
        INVOCATION_ALREADY_EXISTS,
        INVOCATION_NOT_FOUND,
        INVALID_INVOCATION_TRANSITION,
        ATTEMPT_COORDINATE_MISMATCH,
        DESIRED_BINDING_REVISION_CONFLICT,
        DURABLE_JOURNAL_INVALID,
        CAPABILITY_FAILED
    }

    private final Code code;

    public ResilienceException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public ResilienceException(Code code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public Code code() {
        return code;
    }
}

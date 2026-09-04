package io.jpyxis.lifecycle.api;

public final class LifecycleException extends RuntimeException {
    public enum Code {
        ARTIFACT_IDENTITY_CONFLICT,
        ARTIFACT_NOT_FOUND,
        ARTIFACT_NOT_VALIDATED,
        INVALID_ARTIFACT_TRANSITION,
        DEPLOYMENT_ALREADY_EXISTS,
        DEPLOYMENT_NOT_FOUND,
        INVALID_DEPLOYMENT_TRANSITION,
        NO_ACTIVE_DEPLOYMENT,
        PIN_ALREADY_EXISTS,
        PIN_NOT_FOUND,
        OUTSTANDING_PINS,
        ARTIFACT_COORDINATE_MISMATCH,
        CAPABILITY_FAILURE,
        CONTROL_INTERRUPTED
    }

    private final Code code;

    public LifecycleException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public LifecycleException(Code code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public Code code() {
        return code;
    }
}

package io.jpyxis.lifecycle.port;

public final class LifecycleCapabilityException extends Exception {
    private final String code;

    public LifecycleCapabilityException(String code, String message) {
        super(message);
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code must not be blank");
        }
        this.code = code;
    }

    public String code() {
        return code;
    }
}

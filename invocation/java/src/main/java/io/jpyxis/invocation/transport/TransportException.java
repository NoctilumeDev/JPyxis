package io.jpyxis.invocation.transport;

public final class TransportException extends Exception {
    public enum Kind {
        DEADLINE_EXCEEDED,
        CANCELLED,
        UNAVAILABLE,
        INTERRUPTED
    }

    private final Kind kind;

    public TransportException(Kind kind, Throwable cause) {
        super("Invocation transport reported " + kind, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }
}

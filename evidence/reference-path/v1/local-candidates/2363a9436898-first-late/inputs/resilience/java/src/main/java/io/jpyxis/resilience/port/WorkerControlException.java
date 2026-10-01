package io.jpyxis.resilience.port;

public final class WorkerControlException extends Exception {
    private final String code;

    public WorkerControlException(String code, String message) {
        super(message);
        this.code = code;
    }

    public WorkerControlException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}

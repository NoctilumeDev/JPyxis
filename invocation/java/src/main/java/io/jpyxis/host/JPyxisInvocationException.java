package io.jpyxis.host;

import java.util.Objects;

public final class JPyxisInvocationException extends Exception {
    private final FailureCategory category;
    private final String code;
    private final InvocationCoordinates coordinates;
    private final boolean retryable;
    private final boolean executionMayContinue;
    private final boolean resultProducedButRejected;

    public JPyxisInvocationException(
            FailureCategory category,
            String code,
            String message,
            InvocationCoordinates coordinates,
            boolean retryable,
            boolean executionMayContinue,
            boolean resultProducedButRejected) {
        super(message);
        this.category = Objects.requireNonNull(category, "category");
        this.code = Objects.requireNonNull(code, "code");
        this.coordinates = Objects.requireNonNull(coordinates, "coordinates");
        this.retryable = retryable;
        this.executionMayContinue = executionMayContinue;
        this.resultProducedButRejected = resultProducedButRejected;
    }

    public FailureCategory category() {
        return category;
    }

    public String code() {
        return code;
    }

    public InvocationCoordinates coordinates() {
        return coordinates;
    }

    public boolean retryable() {
        return retryable;
    }

    public boolean executionMayContinue() {
        return executionMayContinue;
    }

    public boolean resultProducedButRejected() {
        return resultProducedButRejected;
    }
}

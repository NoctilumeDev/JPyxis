package io.jpyxis.invocation.transport;

public record WorkerFailureObservation(
        Kind kind,
        String code,
        String summary,
        boolean retryable,
        String originLayer,
        String causalReference) {
    public enum Kind {
        CONTRACT,
        DEFINITION,
        RUNTIME,
        UNSPECIFIED
    }
}

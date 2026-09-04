package io.jpyxis.invocation;

import io.jpyxis.host.FailureCategory;

public record InvocationFailure(
        FailureCategory category,
        String code,
        String summary,
        boolean retryable,
        boolean executionMayContinue,
        boolean resultProducedButRejected,
        String originLayer,
        String causalReference) {
}

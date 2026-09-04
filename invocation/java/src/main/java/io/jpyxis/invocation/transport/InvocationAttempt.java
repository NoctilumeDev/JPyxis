package io.jpyxis.invocation.transport;

import io.jpyxis.host.AffineBatchInput;
import io.jpyxis.host.InvocationCoordinates;

public record InvocationAttempt(
        InvocationCoordinates coordinates,
        String contractDigest,
        String definitionDigest,
        long deadlineUnixMillis,
        AffineBatchInput input) {
}

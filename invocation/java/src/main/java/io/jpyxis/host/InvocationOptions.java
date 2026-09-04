package io.jpyxis.host;

import java.time.Duration;
import java.util.Objects;

public record InvocationOptions(Duration timeout, CancellationToken cancellationToken) {
    private static final Duration M2_MAXIMUM_TIMEOUT = Duration.ofMinutes(1);

    public InvocationOptions {
        Objects.requireNonNull(timeout, "timeout");
        Objects.requireNonNull(cancellationToken, "cancellationToken");
        if (timeout.compareTo(M2_MAXIMUM_TIMEOUT) > 0) {
            throw new IllegalArgumentException("M2 timeout must not exceed one minute");
        }
    }

    public static InvocationOptions withTimeout(Duration timeout) {
        return new InvocationOptions(timeout, new CancellationToken());
    }
}

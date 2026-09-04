package io.jpyxis.invocation.transport;

import java.time.Duration;

public interface InvocationTransport extends AutoCloseable {
    void probe(Duration timeout) throws TransportException;

    TransportCall invoke(InvocationAttempt attempt, Duration timeout);

    @Override
    void close();
}

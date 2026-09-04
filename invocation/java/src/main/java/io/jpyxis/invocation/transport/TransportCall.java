package io.jpyxis.invocation.transport;

import java.util.concurrent.CompletableFuture;

public record TransportCall(
        CompletableFuture<WorkerExecutionReport> completion,
        Runnable cancel) {
}

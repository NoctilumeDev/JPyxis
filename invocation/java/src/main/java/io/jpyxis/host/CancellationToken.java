package io.jpyxis.host;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

public final class CancellationToken {
    private final AtomicBoolean cancelled = new AtomicBoolean();
    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    public boolean isCancellationRequested() {
        return cancelled.get();
    }

    public boolean cancel() {
        if (!cancelled.compareAndSet(false, true)) {
            return false;
        }
        try {
            for (Runnable listener : listeners) {
                try {
                    listener.run();
                } catch (RuntimeException ignored) {
                    // One observer cannot prevent the cancellation signal reaching the others.
                }
            }
        } finally {
            listeners.clear();
        }
        return true;
    }

    public AutoCloseable onCancellation(Runnable listener) {
        if (cancelled.get()) {
            listener.run();
            return () -> { };
        }
        listeners.add(listener);
        if (cancelled.get() && listeners.remove(listener)) {
            listener.run();
        }
        return () -> listeners.remove(listener);
    }
}

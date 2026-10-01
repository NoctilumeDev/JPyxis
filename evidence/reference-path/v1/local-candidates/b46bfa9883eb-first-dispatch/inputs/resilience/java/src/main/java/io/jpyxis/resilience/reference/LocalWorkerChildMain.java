package io.jpyxis.resilience.reference;

public final class LocalWorkerChildMain {
    private LocalWorkerChildMain() {
    }

    public static void main(String[] arguments) throws Exception {
        if (arguments.length != 3) {
            throw new IllegalArgumentException("expected workerId, instanceId, and controlEpoch");
        }
        System.out.println("READY|" + arguments[0] + "|" + arguments[1] + "|" + arguments[2]);
        System.out.flush();
        while (!Thread.currentThread().isInterrupted()) {
            Thread.sleep(1_000L);
        }
    }
}

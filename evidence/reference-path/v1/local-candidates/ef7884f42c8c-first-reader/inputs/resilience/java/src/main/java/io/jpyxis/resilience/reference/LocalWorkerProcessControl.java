package io.jpyxis.resilience.reference;

import io.jpyxis.resilience.api.WorkerHandle;
import io.jpyxis.resilience.port.WorkerControl;
import io.jpyxis.resilience.port.WorkerControlException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public final class LocalWorkerProcessControl implements WorkerControl {
    private static final Duration START_TIMEOUT = Duration.ofSeconds(8);
    private static final Duration STOP_TIMEOUT = Duration.ofSeconds(3);
    private final Map<String, ManagedProcess> processes = new LinkedHashMap<>();

    @Override
    public synchronized WorkerHandle start(
            String workerId,
            String instanceId,
            String controlEpoch) throws WorkerControlException {
        if (processes.containsKey(instanceId)) {
            throw new WorkerControlException("INSTANCE_EXISTS", "worker instance already exists");
        }
        Process process;
        try {
            process = new ProcessBuilder(
                    javaExecutable(),
                    "-cp",
                    System.getProperty("java.class.path"),
                    LocalWorkerChildMain.class.getName(),
                    workerId,
                    instanceId,
                    controlEpoch)
                    .redirectErrorStream(true)
                    .start();
        } catch (IOException failure) {
            throw new WorkerControlException("PROCESS_START_FAILED", "could not start local worker", failure);
        }

        BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
        CompletableFuture<String> readyLine = CompletableFuture.supplyAsync(() -> {
            try {
                return reader.readLine();
            } catch (IOException failure) {
                throw new IllegalStateException(failure);
            }
        });
        String expected = "READY|" + workerId + "|" + instanceId + "|" + controlEpoch;
        try {
            String actual = readyLine.get(START_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            if (!expected.equals(actual) || !process.isAlive()) {
                terminate(process);
                closeReader(reader);
                throw new WorkerControlException("READY_HANDSHAKE_INVALID", "worker readiness handshake was invalid");
            }
        } catch (WorkerControlException failure) {
            throw failure;
        } catch (Exception failure) {
            terminate(process);
            closeReader(reader);
            throw new WorkerControlException("READY_HANDSHAKE_FAILED", "worker did not become ready", failure);
        }
        WorkerHandle handle = new WorkerHandle(workerId, instanceId, controlEpoch, process.pid());
        processes.put(instanceId, new ManagedProcess(handle, process, reader));
        return handle;
    }

    @Override
    public synchronized boolean isHealthy(WorkerHandle handle) throws WorkerControlException {
        ManagedProcess process = require(handle);
        return process.process.isAlive();
    }

    @Override
    public synchronized void stop(WorkerHandle handle) throws WorkerControlException {
        ManagedProcess managed = require(handle);
        terminate(managed.process);
        closeReader(managed.reader);
        processes.remove(handle.instanceId());
    }

    public synchronized void crashWorker(String workerId) {
        for (ManagedProcess managed : new ArrayList<>(processes.values())) {
            if (managed.handle.workerId().equals(workerId)) {
                managed.process.destroyForcibly();
                try {
                    managed.process.waitFor(STOP_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
                } catch (InterruptedException failure) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }

    public synchronized int liveProcessCount() {
        return (int) processes.values().stream().filter(item -> item.process.isAlive()).count();
    }

    @Override
    public synchronized void close() {
        for (ManagedProcess managed : new ArrayList<>(processes.values())) {
            terminate(managed.process);
            closeReader(managed.reader);
        }
        processes.clear();
    }

    private ManagedProcess require(WorkerHandle handle) throws WorkerControlException {
        ManagedProcess managed = processes.get(handle.instanceId());
        if (managed == null
                || !managed.handle.workerId().equals(handle.workerId())
                || !managed.handle.controlEpoch().equals(handle.controlEpoch())) {
            throw new WorkerControlException("UNKNOWN_WORKER_HANDLE", "worker handle is not owned here");
        }
        return managed;
    }

    private static String javaExecutable() {
        String executable = System.getProperty("os.name", "").toLowerCase().contains("win")
                ? "java.exe"
                : "java";
        return Path.of(System.getProperty("java.home"), "bin", executable).toString();
    }

    private static void terminate(Process process) {
        if (!process.isAlive()) return;
        process.destroy();
        try {
            if (!process.waitFor(STOP_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                process.waitFor(STOP_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            }
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
        }
    }

    private static void closeReader(BufferedReader reader) {
        try {
            reader.close();
        } catch (IOException ignored) {
            // Process cleanup has no semantic effect on an already recorded worker decision.
        }
    }

    private record ManagedProcess(WorkerHandle handle, Process process, BufferedReader reader) {
    }
}

package io.jpyxis.lifecycle.core;

import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.ArtifactPayload;
import io.jpyxis.lifecycle.api.DeploymentState;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.api.PinReleaseOutcome;
import io.jpyxis.lifecycle.api.RuntimeHandle;
import io.jpyxis.lifecycle.evidence.InMemoryLifecycleJournal;
import io.jpyxis.lifecycle.port.DeploymentRuntime;
import io.jpyxis.lifecycle.port.LifecycleCapabilityException;
import io.jpyxis.lifecycle.reference.ReferenceLifecycleRuntime;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

final class DeploymentManagerTest {
    private static final String SLOT = "production";
    private final InMemoryLifecycleJournal journal = new InMemoryLifecycleJournal();
    private final ArtifactRegistry registry = new ArtifactRegistry(journal);
    private final DeploymentManager manager = new DeploymentManager(registry, journal);

    @Test
    void candidateWarmupDoesNotHoldTheStateLockOrBlockCurrentAdmissions() throws Exception {
        ArtifactCoordinate v1 = validated("artifact:v1", new byte[] {1});
        ArtifactCoordinate v2 = validated("artifact:v2", new byte[] {2});
        ReferenceLifecycleRuntime stable = new ReferenceLifecycleRuntime("runtime", "1", false);
        activate("dep-v1", v1, stable);

        BlockingWarmRuntime blocking = new BlockingWarmRuntime();
        manager.request("dep-v2", SLOT, v2, blocking, context("request-v2"));
        manager.load("dep-v2", context("load-v2"));
        var executor = Executors.newSingleThreadExecutor();
        try {
            var warming = executor.submit(() -> manager.warm("dep-v2", context("warm-v2")));
            assertTrue(blocking.warmEntered.await(2, TimeUnit.SECONDS));

            var pin = manager.pinInvocation(SLOT, "pin-v1", "inv-v1", context("pin-v1"));
            assertEquals("dep-v1", pin.deploymentId());
            manager.releasePin(pin.pinId(), context("release-v1"));

            blocking.continueWarm.countDown();
            assertEquals(DeploymentState.STANDBY, warming.get(2, TimeUnit.SECONDS).state());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void cutoverKeepsOldPinsAndRoutesNewPinsToTheCandidate() {
        ArtifactCoordinate v1 = validated("artifact:v1", new byte[] {1});
        ArtifactCoordinate v2 = validated("artifact:v2", new byte[] {2});
        ReferenceLifecycleRuntime runtime = new ReferenceLifecycleRuntime("runtime", "1", false);
        activate("dep-v1", v1, runtime);
        var oldPin = manager.pinInvocation(SLOT, "pin-old", "inv-old", context("pin-old"));

        activate("dep-v2", v2, runtime);
        var newPin = manager.pinInvocation(SLOT, "pin-new", "inv-new", context("pin-new"));

        assertEquals("dep-v1", oldPin.deploymentId());
        assertEquals("dep-v2", newPin.deploymentId());
        assertEquals(DeploymentState.DRAINING, manager.snapshot("dep-v1").state());
        assertEquals(DeploymentState.ACTIVE, manager.snapshot("dep-v2").state());
        assertEquals("dep-v2", manager.activeBindings().get(SLOT));
    }

    @Test
    void forcedDrainRecordsAnObligationInsteadOfInventingAnInvocationTerminalState() {
        ArtifactCoordinate v1 = validated("artifact:v1", new byte[] {1});
        ReferenceLifecycleRuntime runtime = new ReferenceLifecycleRuntime("runtime", "1", false);
        activate("dep-v1", v1, runtime);
        var pin = manager.pinInvocation(SLOT, "pin", "inv", context("pin"));
        manager.drain("dep-v1", context("drain"));

        assertFalse(manager.awaitDrain("dep-v1", Duration.ZERO, context("wait")));
        assertEquals(1, manager.requireForcedTermination("dep-v1", context("force")));
        assertEquals(DeploymentState.RETIRED, manager.unload("dep-v1", context("unload")).state());
        assertEquals(
                PinReleaseOutcome.FORCED_TERMINATION_REQUIRED,
                manager.releasePin(pin.pinId(), context("acknowledge")));
    }

    @Test
    void anUnvalidatedArtifactCannotEnterLoading() {
        ArtifactCoordinate registered = registry.register(
                "artifact:unvalidated", "contract:v1", new byte[] {1}, context("register-only"))
                .coordinate();

        var failure = assertThrows(io.jpyxis.lifecycle.api.LifecycleException.class, () ->
                manager.request(
                        "dep-invalid",
                        SLOT,
                        registered,
                        new ReferenceLifecycleRuntime("runtime", "1", false),
                        context("request-invalid")));

        assertEquals(
                io.jpyxis.lifecycle.api.LifecycleException.Code.ARTIFACT_NOT_VALIDATED,
                failure.code());
        assertTrue(manager.snapshots().isEmpty());
    }

    @Test
    void concurrentAdmissionsObserveEitherSideOfOneAtomicCutoverWithoutAGap() throws Exception {
        ArtifactCoordinate v1 = validated("artifact:v1", new byte[] {1});
        ArtifactCoordinate v2 = validated("artifact:v2", new byte[] {2});
        ReferenceLifecycleRuntime runtime = new ReferenceLifecycleRuntime("runtime", "1", false);
        activate("dep-v1", v1, runtime);
        manager.request("dep-v2", SLOT, v2, runtime, context("request-dep-v2"));
        manager.load("dep-v2", context("load-dep-v2"));
        manager.warm("dep-v2", context("warm-dep-v2"));

        int invocationCount = 64;
        CountDownLatch start = new CountDownLatch(1);
        Set<String> observedDeployments = ConcurrentHashMap.newKeySet();
        var executor = Executors.newFixedThreadPool(8);
        var futures = new ArrayList<java.util.concurrent.Future<?>>();
        try {
            futures.add(executor.submit(() -> {
                await(start);
                manager.activate("dep-v2", context("concurrent-cutover"));
            }));
            for (int index = 0; index < invocationCount; index++) {
                int invocation = index;
                futures.add(executor.submit(() -> {
                    await(start);
                    var pin = manager.pinInvocation(
                            SLOT,
                            "pin-" + invocation,
                            "inv-" + invocation,
                            context("concurrent-pin-" + invocation));
                    observedDeployments.add(pin.deploymentId());
                    manager.releasePin(pin.pinId(), context("concurrent-release-" + invocation));
                }));
            }
            start.countDown();
            for (var future : futures) future.get(5, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }

        assertEquals(invocationCount, journal.events().stream()
                .filter(event -> event.event().equals("INVOCATION_PINNED"))
                .count());
        assertTrue(observedDeployments.stream().allMatch(
                deployment -> deployment.equals("dep-v1") || deployment.equals("dep-v2")));
        assertEquals("dep-v2", manager.activeBindings().get(SLOT));
    }

    private ArtifactCoordinate validated(String identity, byte[] content) {
        registry.register(identity, "contract:v1", content, context("register-" + identity));
        registry.beginValidation(identity, context("validate-" + identity));
        return registry.acceptValidation(identity, "evidence", context("accept-" + identity)).coordinate();
    }

    private void activate(
            String deploymentId,
            ArtifactCoordinate artifact,
            ReferenceLifecycleRuntime runtime) {
        manager.request(deploymentId, SLOT, artifact, runtime, context("request-" + deploymentId));
        manager.load(deploymentId, context("load-" + deploymentId));
        manager.warm(deploymentId, context("warm-" + deploymentId));
        manager.activate(deploymentId, context("activate-" + deploymentId));
    }

    private LifecycleContext context(String cause) {
        return new LifecycleContext("test", cause, "trace-" + cause);
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("test synchronization interrupted", exception);
        }
    }

    private static final class BlockingWarmRuntime implements DeploymentRuntime {
        private final CountDownLatch warmEntered = new CountDownLatch(1);
        private final CountDownLatch continueWarm = new CountDownLatch(1);
        private RuntimeHandle handle;

        @Override
        public RuntimeHandle load(ArtifactPayload artifact) {
            handle = new RuntimeHandle("blocking-runtime", "1", "handle-v2");
            return handle;
        }

        @Override
        public void warm(RuntimeHandle candidate) throws LifecycleCapabilityException {
            if (!candidate.equals(handle)) {
                throw new LifecycleCapabilityException("UNKNOWN_HANDLE", "unexpected handle");
            }
            warmEntered.countDown();
            try {
                if (!continueWarm.await(2, TimeUnit.SECONDS)) {
                    throw new LifecycleCapabilityException("TEST_TIMEOUT", "test did not release warmup");
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new LifecycleCapabilityException("INTERRUPTED", "warmup interrupted");
            }
        }

        @Override
        public void unload(RuntimeHandle candidate) {
        }
    }
}

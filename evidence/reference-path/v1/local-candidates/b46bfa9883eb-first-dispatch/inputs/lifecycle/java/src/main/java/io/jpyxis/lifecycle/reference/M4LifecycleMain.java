package io.jpyxis.lifecycle.reference;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.ArtifactSnapshot;
import io.jpyxis.lifecycle.api.DeploymentSnapshot;
import io.jpyxis.lifecycle.api.InvocationPin;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.api.LifecycleException;
import io.jpyxis.lifecycle.api.PinReleaseOutcome;
import io.jpyxis.lifecycle.core.ArtifactRegistry;
import io.jpyxis.lifecycle.core.DeploymentManager;
import io.jpyxis.lifecycle.evidence.InMemoryLifecycleJournal;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

public final class M4LifecycleMain {
    private static final String SLOT = "affine-production";
    private static final String CONTRACT_IDENTITY = "jpyxis:contract:example/affine-batch@1.0.0";
    private static final String V1_IDENTITY = "jpyxis:definition:example/affine-batch-plan@1.0.0";
    private static final String V2_IDENTITY = "jpyxis:definition:example/affine-batch-plan@2.0.0";
    private static final ObjectMapper JSON = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private final String scenario;
    private final Path output;
    private final byte[] v1Bytes;
    private final byte[] v2Bytes;
    private final InMemoryLifecycleJournal journal = new InMemoryLifecycleJournal();
    private final ArtifactRegistry registry = new ArtifactRegistry(journal);
    private final DeploymentManager deployments = new DeploymentManager(registry, journal);
    private final ReferenceLifecycleRuntime runtime =
            new ReferenceLifecycleRuntime("reference.lifecycle", "1.0.0", false);
    private final Map<String, Object> facts = new LinkedHashMap<>();
    private int contextSequence;

    private M4LifecycleMain(String scenario, Path output, byte[] v1Bytes, byte[] v2Bytes) {
        this.scenario = scenario;
        this.output = output;
        this.v1Bytes = Arrays.copyOf(v1Bytes, v1Bytes.length);
        this.v2Bytes = Arrays.copyOf(v2Bytes, v2Bytes.length);
    }

    public static void main(String[] arguments) throws Exception {
        Map<String, String> args = parseArguments(arguments);
        Path v1 = requiredPath(args, "artifact-v1");
        Path v2 = requiredPath(args, "artifact-v2");
        Path output = requiredPath(args, "out");
        String scenario = require(args, "scenario");
        M4LifecycleMain lab = new M4LifecycleMain(
                scenario,
                output,
                Files.readAllBytes(v1),
                Files.readAllBytes(v2));
        lab.run();
    }

    private void run() throws Exception {
        Files.createDirectories(output);
        switch (scenario) {
            case "activate_v1" -> activateV1();
            case "unvalidated_artifact_rejected" -> unvalidatedArtifactRejected();
            case "artifact_identity_conflict" -> artifactIdentityConflict();
            case "warm_failure_preserves_active" -> warmFailurePreservesActive();
            case "activation_precondition_preserves_active" -> activationPreconditionPreservesActive();
            case "atomic_cutover_and_pinning" -> atomicCutoverAndPinning();
            case "draining_rejects_new" -> drainingRejectsNew();
            case "forced_termination_defined" -> forcedTerminationDefined();
            case "rollback_immutable" -> rollbackImmutable();
            default -> throw new IllegalArgumentException("unknown M4 scenario: " + scenario);
        }
        writeEvidence();
    }

    private void activateV1() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        DeploymentSnapshot active = prepareAndActivate("dep-v1-a", v1, runtime);
        facts.put("activeDeploymentId", active.deploymentId());
        facts.put("activeArtifactIdentity", active.artifact().identity());
    }

    private void unvalidatedArtifactRejected() {
        ArtifactCoordinate registered = registry.register(
                V1_IDENTITY,
                CONTRACT_IDENTITY,
                v1Bytes,
                context("register unvalidated v1 artifact")).coordinate();
        String code = "NONE";
        try {
            deployments.request(
                    "dep-unvalidated",
                    SLOT,
                    registered,
                    runtime,
                    context("request unvalidated deployment"));
        } catch (LifecycleException exception) {
            code = exception.code().name();
        }
        facts.put("failureCode", code);
        facts.put("deploymentCount", deployments.snapshots().size());
        facts.put("artifactState", registry.snapshot(V1_IDENTITY).state().name());
    }

    private void artifactIdentityConflict() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        byte[] conflicting = Arrays.copyOf(v1Bytes, v1Bytes.length + 1);
        conflicting[conflicting.length - 1] = 0x7f;
        String code = "NONE";
        try {
            registry.register(V1_IDENTITY, CONTRACT_IDENTITY, conflicting, context("conflicting registration"));
        } catch (LifecycleException exception) {
            code = exception.code().name();
        }
        facts.put("conflictCode", code);
        facts.put("originalDigest", v1.digest());
        facts.put("originalContentPreserved", Arrays.equals(v1Bytes, registry.readContent(V1_IDENTITY)));
    }

    private void warmFailurePreservesActive() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        prepareAndActivate("dep-v1-a", v1, runtime);

        ReferenceLifecycleRuntime failing =
                new ReferenceLifecycleRuntime("reference.lifecycle", "1.0.0", true);
        deployments.request("dep-v2-failed", SLOT, v2, failing, context("request v2 candidate"));
        deployments.load("dep-v2-failed", context("load v2 candidate"));
        String code = "NONE";
        try {
            deployments.warm("dep-v2-failed", context("warm v2 candidate"));
        } catch (LifecycleException exception) {
            code = exception.code().name();
        }
        facts.put("failureCode", code);
        facts.put("activeDeploymentId", deployments.activeBindings().get(SLOT));
        facts.put("failedCandidateState", deployments.snapshot("dep-v2-failed").state().name());
        facts.put("failedCandidateLiveHandles", failing.liveHandleCount());
    }

    private void activationPreconditionPreservesActive() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        prepareAndActivate("dep-v1-a", v1, runtime);
        deployments.request("dep-v2-not-warm", SLOT, v2, runtime, context("request v2 candidate"));
        deployments.load("dep-v2-not-warm", context("load v2 candidate"));
        String code = "NONE";
        try {
            deployments.activate("dep-v2-not-warm", context("invalid activation attempt"));
        } catch (LifecycleException exception) {
            code = exception.code().name();
        }
        facts.put("failureCode", code);
        facts.put("activeDeploymentId", deployments.activeBindings().get(SLOT));
        facts.put("candidateState", deployments.snapshot("dep-v2-not-warm").state().name());
    }

    private void atomicCutoverAndPinning() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        prepareAndActivate("dep-v1-a", v1, runtime);
        InvocationPin oldPin = deployments.pinInvocation(
                SLOT, "pin-old", "inv-old", context("pin accepted v1 invocation"));

        DeploymentSnapshot v2Active = prepareAndActivate("dep-v2-a", v2, runtime);
        InvocationPin newPin = deployments.pinInvocation(
                SLOT, "pin-new", "inv-new", context("pin new v2 invocation"));
        PinReleaseOutcome oldRelease = deployments.releasePin(
                oldPin.pinId(), context("old invocation completed"));
        deployments.unload("dep-v1-a", context("unload drained v1"));
        PinReleaseOutcome newRelease = deployments.releasePin(
                newPin.pinId(), context("new invocation completed"));

        facts.put("oldPinDeploymentId", oldPin.deploymentId());
        facts.put("newPinDeploymentId", newPin.deploymentId());
        facts.put("activeDeploymentId", v2Active.deploymentId());
        facts.put("oldRelease", oldRelease.name());
        facts.put("newRelease", newRelease.name());
    }

    private void drainingRejectsNew() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        prepareAndActivate("dep-v1-a", v1, runtime);
        InvocationPin accepted = deployments.pinInvocation(
                SLOT, "pin-accepted", "inv-accepted", context("pin accepted invocation"));
        deployments.drain("dep-v1-a", context("operator requested drain"));
        String code = "NONE";
        try {
            deployments.pinInvocation(SLOT, "pin-rejected", "inv-rejected", context("late admission"));
        } catch (LifecycleException exception) {
            code = exception.code().name();
        }
        PinReleaseOutcome release = deployments.releasePin(
                accepted.pinId(), context("accepted invocation completed"));
        boolean drained = deployments.awaitDrain(
                "dep-v1-a", Duration.ZERO, context("verify drain completion"));
        deployments.unload("dep-v1-a", context("unload drained deployment"));
        facts.put("newPinFailureCode", code);
        facts.put("acceptedPinRelease", release.name());
        facts.put("drained", drained);
    }

    private void forcedTerminationDefined() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        prepareAndActivate("dep-v1-a", v1, runtime);
        InvocationPin pin = deployments.pinInvocation(
                SLOT, "pin-forced", "inv-forced", context("pin long invocation"));
        deployments.drain("dep-v1-a", context("operator requested drain"));
        boolean drainedBeforeForce = deployments.awaitDrain(
                "dep-v1-a", Duration.ZERO, context("bounded drain wait"));
        int forcedCount = deployments.requireForcedTermination(
                "dep-v1-a", context("operator forced bounded drain"));
        deployments.unload("dep-v1-a", context("unload after forced requirement"));
        PinReleaseOutcome release = deployments.releasePin(
                pin.pinId(), context("invocation manager acknowledged forced requirement"));
        facts.put("drainedBeforeForce", drainedBeforeForce);
        facts.put("forcedCount", forcedCount);
        facts.put("pinRelease", release.name());
    }

    private void rollbackImmutable() {
        ArtifactCoordinate v1 = registerValidated(V1_IDENTITY, v1Bytes);
        ArtifactCoordinate v2 = registerValidated(V2_IDENTITY, v2Bytes);
        prepareAndActivate("dep-v1-a", v1, runtime);
        prepareAndActivate("dep-v2-a", v2, runtime);
        deployments.unload("dep-v1-a", context("retire original v1 deployment"));

        DeploymentSnapshot rollback = deployments.rollback(
                "dep-v1-rollback",
                SLOT,
                v1,
                runtime,
                context("rollback to validated v1 artifact"));
        deployments.unload("dep-v2-a", context("retire replaced v2 deployment"));

        ArtifactSnapshot v1After = registry.snapshot(V1_IDENTITY);
        facts.put("activeDeploymentId", rollback.deploymentId());
        facts.put("activeArtifactIdentity", rollback.artifact().identity());
        facts.put("originalArtifactDigest", v1.digest());
        facts.put("rollbackArtifactDigest", rollback.artifact().digest());
        facts.put("registryArtifactDigest", v1After.coordinate().digest());
        facts.put("artifactContentPreserved", Arrays.equals(v1Bytes, registry.readContent(V1_IDENTITY)));
    }

    private ArtifactCoordinate registerValidated(String identity, byte[] content) {
        registry.register(identity, CONTRACT_IDENTITY, content, context("register " + identity));
        registry.beginValidation(identity, context("begin validation " + identity));
        return registry.acceptValidation(
                identity,
                "jpyxis.m4.reference-contract-validation/v1",
                context("accept validation " + identity)).coordinate();
    }

    private DeploymentSnapshot prepareAndActivate(
            String deploymentId,
            ArtifactCoordinate artifact,
            ReferenceLifecycleRuntime selectedRuntime) {
        deployments.request(deploymentId, SLOT, artifact, selectedRuntime, context("request " + deploymentId));
        deployments.load(deploymentId, context("load " + deploymentId));
        deployments.warm(deploymentId, context("warm " + deploymentId));
        return deployments.activate(deploymentId, context("activate " + deploymentId));
    }

    private LifecycleContext context(String cause) {
        contextSequence++;
        return new LifecycleContext(
                "m4-reference-control",
                cause,
                "trace-" + scenario + "-" + contextSequence);
    }

    private void writeEvidence() throws IOException {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("schemaVersion", "jpyxis.io/m4-authoritative-state/v1alpha1");
        state.put("scenarioId", scenario);
        state.put("artifacts", registry.snapshots());
        state.put("deployments", deployments.snapshots());
        state.put("activeBindings", deployments.activeBindings());
        state.put("facts", facts);
        JSON.writeValue(output.resolve("authoritative-state.json").toFile(), state);
        JSON.writeValue(output.resolve("lifecycle-events.json").toFile(), journal.events());
    }

    private static Map<String, String> parseArguments(String[] arguments) {
        Map<String, String> values = new LinkedHashMap<>();
        for (int index = 0; index < arguments.length; index += 2) {
            if (index + 1 >= arguments.length || !arguments[index].startsWith("--")) {
                throw new IllegalArgumentException("arguments must be --name value pairs");
            }
            values.put(arguments[index].substring(2), arguments[index + 1]);
        }
        return values;
    }

    private static Path requiredPath(Map<String, String> arguments, String name) {
        return Path.of(require(arguments, name)).toAbsolutePath().normalize();
    }

    private static String require(Map<String, String> arguments, String name) {
        String value = arguments.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("missing --" + name);
        }
        return value;
    }
}

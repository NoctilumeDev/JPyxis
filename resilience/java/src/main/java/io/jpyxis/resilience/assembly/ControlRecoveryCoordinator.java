package io.jpyxis.resilience.assembly;

import io.jpyxis.lifecycle.api.ArtifactCoordinate;
import io.jpyxis.lifecycle.api.DeploymentSnapshot;
import io.jpyxis.lifecycle.api.LifecycleContext;
import io.jpyxis.lifecycle.core.ArtifactRegistry;
import io.jpyxis.lifecycle.core.DeploymentManager;
import io.jpyxis.lifecycle.port.DeploymentRuntime;
import io.jpyxis.resilience.api.DesiredBinding;
import io.jpyxis.resilience.api.ResilienceContext;
import io.jpyxis.resilience.api.ResilienceException;
import io.jpyxis.resilience.evidence.EventOwner;
import io.jpyxis.resilience.evidence.ResilienceEventDraft;
import io.jpyxis.resilience.evidence.ResilienceJournal;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;

public final class ControlRecoveryCoordinator {
    private final ResilienceJournal journal;
    private final String controlEpoch;

    public ControlRecoveryCoordinator(ResilienceJournal journal, String controlEpoch) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.controlEpoch = Objects.requireNonNull(controlEpoch, "controlEpoch");
    }

    public DeploymentSnapshot reconcile(
            DesiredBinding desired,
            byte[] artifactBytes,
            String contractIdentity,
            String deploymentId,
            ArtifactRegistry artifacts,
            DeploymentManager deployments,
            DeploymentRuntime runtime,
            ResilienceContext context) {
        Objects.requireNonNull(desired, "desired");
        String actualDigest = digest(artifactBytes);
        if (!desired.artifactDigest().equals(actualDigest)) {
            record("RECOVERY_DEPLOYMENT_REJECTED", desired, context, Map.of(
                    "code", "ARTIFACT_DIGEST_MISMATCH",
                    "actualDigest", actualDigest));
            throw new ResilienceException(
                    ResilienceException.Code.CAPABILITY_FAILED,
                    "recovery artifact digest does not match desired intent");
        }
        LifecycleContext lifecycleContext = new LifecycleContext(
                "m5-recovery-control",
                "reconcile desired deployment revision " + desired.revision(),
                context.traceId());
        try {
            ArtifactCoordinate coordinate = artifacts.register(
                    desired.artifactIdentity(), contractIdentity, artifactBytes, lifecycleContext).coordinate();
            artifacts.beginValidation(desired.artifactIdentity(), lifecycleContext);
            artifacts.acceptValidation(
                    desired.artifactIdentity(),
                    "jpyxis.m5.recovery-validation/v1",
                    lifecycleContext);
            deployments.request(deploymentId, desired.slot(), coordinate, runtime, lifecycleContext);
            deployments.load(deploymentId, lifecycleContext);
            deployments.warm(deploymentId, lifecycleContext);
            DeploymentSnapshot active = deployments.activate(deploymentId, lifecycleContext);
            record("RECOVERY_DEPLOYMENT_RECONCILED", desired, context, Map.of(
                    "deploymentId", active.deploymentId(),
                    "activeArtifactIdentity", active.artifact().identity(),
                    "activeArtifactDigest", active.artifact().digest()));
            return active;
        } catch (RuntimeException failure) {
            record("RECOVERY_DEPLOYMENT_FAILED", desired, context, Map.of(
                    "code", failure.getClass().getSimpleName()));
            throw failure;
        }
    }

    private void record(
            String event,
            DesiredBinding desired,
            ResilienceContext context,
            Map<String, String> extra) {
        java.util.LinkedHashMap<String, String> details = new java.util.LinkedHashMap<>(extra);
        details.put("slot", desired.slot());
        details.put("artifactIdentity", desired.artifactIdentity());
        details.put("artifactDigest", desired.artifactDigest());
        details.put("intentRevision", Long.toString(desired.revision()));
        journal.record(new ResilienceEventDraft(
                EventOwner.RECOVERY_COORDINATOR,
                event,
                controlEpoch,
                context,
                "",
                "",
                "",
                details));
    }

    private static String digest(byte[] bytes) {
        try {
            return "sha256:" + HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException("SHA-256 is unavailable", failure);
        }
    }
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export function verifyM4Bundle(bundlePath, { writeVerdict = true } = {}) {
  const root = path.resolve(bundlePath);
  const failures = [];
  const checks = [];
  let incomplete = false;

  const manifest = readJson("manifest.json");
  const state = readJson("authoritative-state.json");
  const events = readJson("lifecycle-events.json");

  if (manifest && state && Array.isArray(events)) {
    check(manifest.schemaVersion === "jpyxis.io/m4-evidence-bundle/v1alpha1", "manifest schema");
    check(state.schemaVersion === "jpyxis.io/m4-authoritative-state/v1alpha1", "state schema");
    check(manifest.scenarioId === state.scenarioId, "scenario identity agrees");
    verifyFiles(manifest);
    verifyArtifacts(manifest, state);
    verifyEventAuthority(events, state);
    verifyScenario(manifest.profileScenarioId ?? manifest.scenarioId, state, events);
  }

  const verdict = incomplete ? "INCONCLUSIVE" : failures.length > 0 ? "FAIL" : "PASS";
  const result = {
    schemaVersion: "jpyxis.io/m4-acceptance-verdict/v1alpha1",
    scenarioId: manifest?.scenarioId ?? path.basename(root),
    verdict,
    checks,
    failures,
  };
  if (writeVerdict) {
    fs.writeFileSync(path.join(root, "verdict.json"), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;

  function readJson(relative) {
    const file = safeResolve(relative);
    if (!file || !fs.existsSync(file)) {
      incomplete = true;
      failures.push(`missing required evidence: ${relative}`);
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      incomplete = true;
      failures.push(`unreadable required evidence: ${relative}`);
      return null;
    }
  }

  function safeResolve(relative) {
    const candidate = path.resolve(root, relative);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      failures.push(`evidence path escapes bundle: ${relative}`);
      return null;
    }
    return candidate;
  }

  function check(condition, label) {
    checks.push({ label, passed: Boolean(condition) });
    if (!condition) failures.push(label);
  }

  function verifyFiles(value) {
    check(Array.isArray(value.files) && value.files.length >= 4, "manifest declares required files");
    for (const item of value.files ?? []) {
      const file = safeResolve(item.path);
      if (!file || !fs.existsSync(file)) {
        if (item.required) incomplete = true;
        failures.push(`manifest file missing: ${item.path}`);
        continue;
      }
      check(digestFile(file) === item.sha256, `file digest matches: ${item.path}`);
    }
  }

  function verifyArtifacts(value, authoritative) {
    const declared = new Map((value.artifacts ?? []).map((item) => [item.identity, item]));
    for (const artifact of authoritative.artifacts ?? []) {
      const expected = declared.get(artifact.coordinate?.identity);
      check(Boolean(expected), `artifact declared: ${artifact.coordinate?.identity}`);
      if (!expected) continue;
      const file = safeResolve(expected.file);
      if (!file || !fs.existsSync(file)) {
        incomplete = true;
        failures.push(`artifact bytes missing: ${expected.file}`);
        continue;
      }
      const digest = digestFile(file);
      check(digest === expected.digest, `manifest artifact digest: ${expected.identity}`);
      check(digest === artifact.coordinate?.digest, `Registry artifact digest: ${expected.identity}`);
      check(fs.statSync(file).size === artifact.contentLength, `artifact length: ${expected.identity}`);
    }
  }

  function verifyEventAuthority(items, authoritative) {
    const artifactStates = new Map();
    const deploymentStates = new Map();
    const activeBySlot = new Map();
    const artifactEdges = new Set([
      "null->REGISTERED",
      "REGISTERED->VALIDATING",
      "VALIDATING->VALIDATED",
      "VALIDATING->REJECTED",
      "VALIDATED->DEPRECATED",
    ]);
    const deploymentEdges = new Set([
      "null->REQUESTED",
      "REQUESTED->LOADING",
      "LOADING->WARMING",
      "LOADING->FAILED",
      "WARMING->STANDBY",
      "WARMING->FAILED",
      "STANDBY->ACTIVE",
      "ACTIVE->DRAINING",
      "DRAINING->UNLOADING",
      "UNLOADING->RETIRED",
      "UNLOADING->FAILED",
    ]);

    items.forEach((event, index) => {
      check(event.sequence === index + 1, `event sequence ${index + 1}`);
      check(nonBlank(event.actor) && nonBlank(event.cause) && nonBlank(event.traceId),
        `event coordinates ${index + 1}`);
      const hasTransition = event.previousState != null || event.newState != null;
      if (event.owner === "LIFECYCLE_CAPABILITY") {
        check(!hasTransition, `capability observation has no authority transition ${index + 1}`);
      }
      if (!hasTransition) return;

      const edge = `${event.previousState ?? "null"}->${event.newState}`;
      if (event.owner === "ARTIFACT_REGISTRY") {
        check(artifactEdges.has(edge), `valid artifact edge ${edge}`);
        const actualPrevious = artifactStates.get(event.artifactIdentity) ?? null;
        check(actualPrevious === (event.previousState ?? null),
          `artifact replay previous state ${event.artifactIdentity}`);
        artifactStates.set(event.artifactIdentity, event.newState);
      } else if (event.owner === "DEPLOYMENT_MANAGER") {
        check(deploymentEdges.has(edge), `valid deployment edge ${edge}`);
        const actualPrevious = deploymentStates.get(event.deploymentId) ?? null;
        check(actualPrevious === (event.previousState ?? null),
          `deployment replay previous state ${event.deploymentId}`);
        if (event.newState === "ACTIVE") {
          check(!activeBySlot.has(event.slot), `one active deployment in ${event.slot}`);
          activeBySlot.set(event.slot, event.deploymentId);
        }
        if (event.previousState === "ACTIVE" && event.newState === "DRAINING") {
          check(activeBySlot.get(event.slot) === event.deploymentId,
            `drain removes authoritative active ${event.deploymentId}`);
          activeBySlot.delete(event.slot);
        }
        deploymentStates.set(event.deploymentId, event.newState);
      } else {
        check(false, `only semantic owners record transitions ${index + 1}`);
      }
    });

    for (const artifact of authoritative.artifacts ?? []) {
      check(artifactStates.get(artifact.coordinate.identity) === artifact.state,
        `artifact replay matches snapshot: ${artifact.coordinate.identity}`);
    }
    for (const deployment of authoritative.deployments ?? []) {
      check(deploymentStates.get(deployment.deploymentId) === deployment.state,
        `deployment replay matches snapshot: ${deployment.deploymentId}`);
    }
    const finalBindings = Object.fromEntries([...activeBySlot.entries()].sort());
    check(deepEqual(finalBindings, authoritative.activeBindings ?? {}),
      "active bindings match transition replay");
  }

  function verifyScenario(scenario, authoritative, items) {
    const facts = authoritative.facts ?? {};
    const deployments = new Map(
      (authoritative.deployments ?? []).map((item) => [item.deploymentId, item]),
    );
    const active = authoritative.activeBindings?.["affine-production"];
    const event = (name, deployment) => items.findIndex((item) =>
      item.event === name && (deployment == null || item.deploymentId === deployment));

    switch (scenario) {
      case "activate_v1":
        check(active === "dep-v1-a", "v1 is active");
        check(deployments.get("dep-v1-a")?.state === "ACTIVE", "v1 deployment is ACTIVE");
        break;
      case "unvalidated_artifact_rejected":
        check(facts.failureCode === "ARTIFACT_NOT_VALIDATED", "unvalidated artifact is rejected");
        check(facts.deploymentCount === 0, "unvalidated artifact creates no deployment fact");
        check(facts.artifactState === "REGISTERED", "rejection does not rewrite artifact state");
        break;
      case "artifact_identity_conflict":
        check(facts.conflictCode === "ARTIFACT_IDENTITY_CONFLICT", "identity conflict is explicit");
        check(facts.originalContentPreserved === true, "identity conflict preserves original bytes");
        check(event("ARTIFACT_IDENTITY_CONFLICT") >= 0, "identity conflict is retained");
        break;
      case "warm_failure_preserves_active":
        check(active === "dep-v1-a", "warm failure preserves active v1");
        check(deployments.get("dep-v2-failed")?.state === "FAILED", "failed candidate is FAILED");
        check(!items.some((item) =>
          item.deploymentId === "dep-v2-failed" && item.newState === "ACTIVE"),
        "failed candidate never becomes active");
        check(facts.failedCandidateLiveHandles === 0, "failed candidate handle is released");
        break;
      case "activation_precondition_preserves_active":
        check(active === "dep-v1-a", "invalid activation preserves active v1");
        check(deployments.get("dep-v2-not-warm")?.state === "LOADING", "unwarmed candidate stays LOADING");
        check(facts.failureCode === "INVALID_DEPLOYMENT_TRANSITION", "activation precondition is explicit");
        break;
      case "atomic_cutover_and_pinning": {
        const oldPinned = event("INVOCATION_PINNED", "dep-v1-a");
        const oldDraining = event("DEPLOYMENT_DRAINING", "dep-v1-a");
        const newActive = event("DEPLOYMENT_ACTIVE", "dep-v2-a");
        const newPinned = event("INVOCATION_PINNED", "dep-v2-a");
        check(oldPinned >= 0 && oldPinned < oldDraining, "old work pins before cutover");
        check(oldDraining >= 0 && oldDraining < newActive, "old drain and new activation are ordered");
        check(newActive >= 0 && newActive < newPinned, "new work pins after activation");
        check(facts.oldPinDeploymentId === "dep-v1-a", "old work remains pinned to v1");
        check(facts.newPinDeploymentId === "dep-v2-a", "new work pins to v2");
        check(active === "dep-v2-a", "v2 owns the final active binding");
        check(deployments.get("dep-v1-a")?.state === "RETIRED", "drained v1 is retired");
        break;
      }
      case "draining_rejects_new":
        check(facts.newPinFailureCode === "NO_ACTIVE_DEPLOYMENT", "draining rejects new work");
        check(facts.acceptedPinRelease === "OBLIGATION_COMPLETED", "accepted work completes");
        check(facts.drained === true, "drain completes after accepted work");
        check(deployments.get("dep-v1-a")?.state === "RETIRED", "drained deployment unloads");
        break;
      case "forced_termination_defined": {
        const timedOut = event("DRAIN_WAIT_TIMED_OUT", "dep-v1-a");
        const forced = event("FORCED_TERMINATION_REQUIRED", "dep-v1-a");
        const unloading = event("DEPLOYMENT_UNLOADING", "dep-v1-a");
        check(timedOut >= 0 && timedOut < forced && forced < unloading,
          "force requirement precedes unload");
        check(facts.drainedBeforeForce === false, "bounded drain times out");
        check(facts.forcedCount === 1, "one outstanding obligation is forced");
        check(facts.pinRelease === "FORCED_TERMINATION_REQUIRED",
          "lifecycle reports a requirement, not invocation success");
        break;
      }
      case "rollback_immutable": {
        check(active === "dep-v1-rollback", "rollback v1 owns final active binding");
        check(facts.originalArtifactDigest === facts.rollbackArtifactDigest,
          "rollback reuses immutable artifact digest");
        check(facts.rollbackArtifactDigest === facts.registryArtifactDigest,
          "rollback digest agrees with Registry");
        check(facts.artifactContentPreserved === true, "rollback preserves artifact bytes");
        const v1Loads = items.filter((item) =>
          item.event === "LOAD_SUCCEEDED"
          && item.artifactIdentity === "jpyxis:definition:example/affine-batch-plan@1.0.0");
        check(v1Loads.length === 2, "rollback performs a new v1 load");
        check(v1Loads[0]?.details?.opaqueHandle !== v1Loads[1]?.details?.opaqueHandle,
          "rollback does not resurrect a retired Runtime handle");
        check(event("ROLLBACK_COMMITTED", "dep-v1-rollback") >= 0, "rollback commit is retained");
        break;
      }
      default:
        check(false, `unknown scenario profile: ${scenario}`);
    }
  }
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
if (invokedDirectly) {
  const bundle = process.argv[2];
  if (!bundle) {
    console.error("usage: node scripts/verify-m4-bundle.mjs <bundle>");
    process.exit(2);
  }
  const result = verifyM4Bundle(bundle);
  console.log(`${result.scenarioId}: ${result.verdict}`);
  if (result.verdict === "FAIL") process.exit(1);
}

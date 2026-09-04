import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const GENESIS = "sha256:genesis";

export function verifyM5Bundle(bundlePath, { writeVerdict = true } = {}) {
  const root = path.resolve(bundlePath);
  const failures = [];
  const checks = [];
  let incomplete = false;

  const manifest = readJson("manifest.json");
  const state = readJson("authoritative-state.json");
  const retainedEvents = readJson("resilience-events.json");
  const lifecycleEvents = readJson("lifecycle-events.json");
  const telemetryEvents = readJson("telemetry-events.json");
  const durableEvents = readJournal("control-state.jsonl");

  if (manifest && state && Array.isArray(retainedEvents)
      && Array.isArray(lifecycleEvents) && Array.isArray(telemetryEvents)
      && Array.isArray(durableEvents)) {
    check(manifest.schemaVersion === "jpyxis.io/m5-evidence-bundle/v1alpha1", "manifest schema");
    check(state.schemaVersion === "jpyxis.io/m5-authoritative-state/v1alpha1", "state schema");
    check(manifest.scenarioId === state.scenarioId, "scenario identity agrees");
    verifyFiles(manifest);
    check(deepEqual(retainedEvents, durableEvents), "retained events equal durable journal replay");
    verifyJournal(durableEvents, state);
    verifyLifecycle(lifecycleEvents, state);
    verifyTelemetry(durableEvents, telemetryEvents, state);
    verifyArtifacts(manifest, state);
    verifyScenario(manifest.profileScenarioId ?? manifest.scenarioId, state, durableEvents, lifecycleEvents);
  }

  const verdict = incomplete ? "INCONCLUSIVE" : failures.length > 0 ? "FAIL" : "PASS";
  const result = {
    schemaVersion: "jpyxis.io/m5-acceptance-verdict/v1alpha1",
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
      failures.push(`unreadable required evidence: ${relative}`);
      return null;
    }
  }

  function readJournal(relative) {
    const file = safeResolve(relative);
    if (!file || !fs.existsSync(file)) {
      incomplete = true;
      failures.push(`missing required evidence: ${relative}`);
      return null;
    }
    try {
      const text = fs.readFileSync(file, "utf8");
      if (!text.endsWith("\n")) {
        failures.push("durable journal is truncated or lacks a final record boundary");
      }
      return text.split(/\r?\n/).filter((line) => line.length > 0).map((line) => JSON.parse(line));
    } catch {
      failures.push("durable journal contains unreadable or truncated JSON");
      return [];
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
    check(Array.isArray(value.files) && value.files.length >= 7, "manifest declares required files");
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

  function verifyJournal(events, authoritative) {
    const workerStates = new Map();
    const invocationStates = new Map();
    const invocationPolicies = new Map();
    const attempts = new Map();
    const desired = new Map();
    const terminalCounts = new Map();
    const retryAllowances = new Map();
    const dispatchedAttempts = new Set();
    const recoveredBeforeDispatch = new Set();
    let previousDigest = GENESIS;
    let finalEpoch = null;

    events.forEach((event, index) => {
      check(event.sequence === index + 1, `journal sequence ${index + 1}`);
      check(event.previousDigest === previousDigest, `journal previous digest ${index + 1}`);
      check(event.digest === eventDigest(event), `journal digest ${index + 1}`);
      check(nonBlank(event.owner) && nonBlank(event.event) && nonBlank(event.controlEpoch),
        `journal owner coordinates ${index + 1}`);
      check(nonBlank(event.actor) && nonBlank(event.cause) && nonBlank(event.traceId),
        `journal trace coordinates ${index + 1}`);
      previousDigest = event.digest;
      if (event.event === "CONTROL_EPOCH_STARTED") finalEpoch = event.controlEpoch;

      const previousState = event.details?.previousState;
      const nextState = event.details?.newState;
      if (event.owner === "WORKER_CAPABILITY" || event.owner === "ATTEMPT_CAPABILITY") {
        check(previousState == null && nextState == null,
          `capability observation has no authority transition ${index + 1}`);
      }
      if (event.owner === "WORKER_SUPERVISOR" && nextState != null) {
        const actualPrevious = workerStates.get(event.workerId) ?? "";
        check(actualPrevious === previousState, `worker replay previous state ${event.workerId} at ${index + 1}`);
        workerStates.set(event.workerId, nextState);
        if (nextState === "ELIGIBLE") {
          check(event.details.workerEpoch === event.controlEpoch,
            `eligible worker is fenced by current epoch ${event.workerId}`);
          check(nonBlank(event.details.instanceId), `eligible worker has instance identity ${event.workerId}`);
        }
      }
      if (event.owner === "CONTROL_INTENT_REGISTRY" && event.event === "DESIRED_BINDING_SET") {
        const prior = desired.get(event.details.slot);
        const revision = Number(event.details.revision);
        check(revision === (prior?.revision ?? 0) + 1,
          `desired binding revision is contiguous for ${event.details.slot}`);
        desired.set(event.details.slot, {
          slot: event.details.slot,
          artifactIdentity: event.details.artifactIdentity,
          artifactDigest: event.details.artifactDigest,
          revision,
        });
      }
      if (event.owner === "RESILIENT_INVOCATION_MANAGER") {
        if (event.logicalInvocationId) {
          check(nonBlank(event.details?.logicalTraceId),
            `logical trace retained for ${event.logicalInvocationId} at ${index + 1}`);
        }
        if (event.event === "INVOCATION_ACCEPTED") {
          check(!invocationStates.has(event.logicalInvocationId),
            `logical invocation identity is unique ${event.logicalInvocationId}`);
          invocationStates.set(event.logicalInvocationId, "ACCEPTED");
          invocationPolicies.set(event.logicalInvocationId, {
            mode: event.details.idempotencyMode,
            maximumAttempts: Number(event.details.maximumAttempts),
            traceId: event.details.logicalTraceId,
          });
        }
        if (event.event === "INVOCATION_ATTEMPTING") {
          check(invocationStates.get(event.logicalInvocationId) === event.details.previousState,
            `invocation replay previous state ${event.logicalInvocationId}`);
          invocationStates.set(event.logicalInvocationId, "ATTEMPTING");
          const number = Number(event.details.attemptNumber);
          check(!attempts.has(event.attemptId), `attempt identity is unique ${event.attemptId}`);
          attempts.set(event.attemptId, {
            logicalInvocationId: event.logicalInvocationId,
            attemptNumber: number,
            workerId: event.workerId,
          });
          if (number > 1) {
            const allowance = retryAllowances.get(event.logicalInvocationId) ?? 0;
            check(allowance > 0,
              `attempt ${number} follows an accepted retry decision`);
            if (allowance > 0) retryAllowances.set(event.logicalInvocationId, allowance - 1);
          }
        }
        if (event.event === "ATTEMPT_DISPATCH_INTENT") {
          check(attempts.has(event.attemptId), `dispatch intent follows reserved attempt ${event.attemptId}`);
          check(!dispatchedAttempts.has(event.attemptId), `dispatch intent is unique ${event.attemptId}`);
          dispatchedAttempts.add(event.attemptId);
        }
        if (event.event === "RETRY_ALLOWED") {
          const policy = invocationPolicies.get(event.logicalInvocationId);
          check(policy?.mode === "DEDUPLICATED_BY_LOGICAL_INVOCATION",
            `retry has accepted idempotency evidence ${event.logicalInvocationId}`);
          retryAllowances.set(
            event.logicalInvocationId,
            (retryAllowances.get(event.logicalInvocationId) ?? 0) + 1,
          );
        }
        if (event.event === "INVOCATION_RETRY_PENDING") {
          check(invocationStates.get(event.logicalInvocationId) === event.details.previousState,
            `retry replay previous state ${event.logicalInvocationId}`);
          invocationStates.set(event.logicalInvocationId, "RETRY_PENDING");
        }
        if (event.event.startsWith("INVOCATION_TERMINAL_")) {
          check(invocationStates.get(event.logicalInvocationId) === event.details.previousState,
            `terminal replay previous state ${event.logicalInvocationId}`);
          invocationStates.set(event.logicalInvocationId, event.details.newState);
          terminalCounts.set(event.logicalInvocationId, (terminalCounts.get(event.logicalInvocationId) ?? 0) + 1);
        }
      }
      if (event.owner === "RECOVERY_COORDINATOR"
          && event.event === "ATTEMPT_RECOVERED_NOT_DISPATCHED") {
        check(attempts.has(event.attemptId),
          `pre-dispatch recovery follows reserved attempt ${event.attemptId}`);
        recoveredBeforeDispatch.add(event.attemptId);
      }
    });

    check(nonBlank(finalEpoch), "journal records at least one Control epoch");
    check(authoritative.controlEpoch === finalEpoch, "authoritative state uses final Control epoch");
    for (const attemptId of attempts.keys()) {
      check(dispatchedAttempts.has(attemptId) || recoveredBeforeDispatch.has(attemptId),
        `attempt has durable dispatch intent or explicit pre-dispatch recovery: ${attemptId}`);
    }
    for (const worker of authoritative.workers ?? []) {
      check(workerStates.get(worker.workerId) === worker.state,
        `worker replay matches snapshot: ${worker.workerId}`);
    }
    for (const invocation of authoritative.invocations ?? []) {
      check(invocationStates.get(invocation.logicalInvocationId) === invocation.state,
        `invocation replay matches snapshot: ${invocation.logicalInvocationId}`);
      if (isTerminal(invocation.state)) {
        check(terminalCounts.get(invocation.logicalInvocationId) === 1,
          `exactly one terminal decision: ${invocation.logicalInvocationId}`);
      }
      check(invocation.attempts.length <= invocation.maximumAttempts,
        `attempt budget respected: ${invocation.logicalInvocationId}`);
      check(invocation.attempts.every((attempt, index) => attempt.attemptNumber === index + 1),
        `attempt numbers are contiguous: ${invocation.logicalInvocationId}`);
      if (invocation.idempotencyMode === "NONE" && invocation.attempts.length > 1) {
        check(false, `invocation without idempotency was retried: ${invocation.logicalInvocationId}`);
      }
    }
    const desiredSnapshot = [...desired.values()].sort((a, b) => a.slot.localeCompare(b.slot));
    check(deepEqual(desiredSnapshot, authoritative.desiredBindings ?? []),
      "desired binding replay matches snapshot");
  }

  function verifyLifecycle(events, authoritative) {
    const artifactStates = new Map();
    const deploymentStates = new Map();
    const active = new Map();
    events.forEach((event, index) => {
      const transition = event.previousState != null || event.newState != null;
      if (event.owner === "LIFECYCLE_CAPABILITY") {
        check(!transition, `M4 capability observation has no transition ${index + 1}`);
      }
      if (!transition) return;
      if (event.owner === "ARTIFACT_REGISTRY") {
        const previous = artifactStates.get(event.artifactIdentity) ?? null;
        check(previous === (event.previousState ?? null),
          `M4 artifact replay previous state ${event.artifactIdentity}`);
        artifactStates.set(event.artifactIdentity, event.newState);
      } else if (event.owner === "DEPLOYMENT_MANAGER") {
        const previous = deploymentStates.get(event.deploymentId) ?? null;
        check(previous === (event.previousState ?? null),
          `M4 deployment replay previous state ${event.deploymentId}`);
        if (event.newState === "ACTIVE") {
          check(!active.has(event.slot), `one M4 active deployment in ${event.slot}`);
          active.set(event.slot, event.deploymentId);
        }
        if (event.previousState === "ACTIVE" && event.newState === "DRAINING") {
          check(active.get(event.slot) === event.deploymentId,
            `M4 drain removes current active ${event.deploymentId}`);
          active.delete(event.slot);
        }
        deploymentStates.set(event.deploymentId, event.newState);
      } else {
        check(false, `only M4 semantic owners record transitions ${index + 1}`);
      }
    });
    for (const artifact of authoritative.artifacts ?? []) {
      check(artifactStates.get(artifact.coordinate.identity) === artifact.state,
        `M4 artifact replay matches snapshot: ${artifact.coordinate.identity}`);
    }
    for (const deployment of authoritative.deployments ?? []) {
      check(deploymentStates.get(deployment.deploymentId) === deployment.state,
        `M4 deployment replay matches snapshot: ${deployment.deploymentId}`);
    }
    check(deepEqual(Object.fromEntries([...active.entries()].sort()), authoritative.activeBindings ?? {}),
      "M4 active binding replay matches snapshot");
  }

  function verifyTelemetry(events, exported, authoritative) {
    const metrics = deriveMetrics(events);
    check(deepEqual(metrics, authoritative.resilienceMetrics ?? {}), "metrics derive from durable events");
    const telemetryFailures = events.filter((event) => event.event === "TELEMETRY_EXPORT_FAILED");
    let searchFrom = 0;
    const exportedIsOrderedSubset = exported.every((event) => {
      const index = events.findIndex((durable, candidate) =>
        candidate >= searchFrom && durable.digest === event.digest);
      if (index < 0) return false;
      searchFrom = index + 1;
      return event.event !== "TELEMETRY_EXPORT_FAILED";
    });
    check(exportedIsOrderedSubset, "telemetry contains only ordered durable event identities");
    if (telemetryFailures.length === 0) {
      check(exported.length === events.length, "healthy telemetry exports every durable event");
      check(exported.length === events.length
        && exported.every((event, index) => event.digest === events[index]?.digest),
        "telemetry preserves durable event identity");
    } else {
      check(telemetryFailures.every((event) => event.owner === "OBSERVABILITY_COORDINATOR"),
        "telemetry failure is owned by observability coordinator");
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
      check(digestFile(file) === expected.digest, `manifest artifact digest: ${expected.identity}`);
      check(expected.digest === artifact.coordinate.digest,
        `Registry artifact digest: ${expected.identity}`);
      check(fs.statSync(file).size === artifact.contentLength, `artifact length: ${expected.identity}`);
    }
  }

  function verifyScenario(scenario, authoritative, events, lifecycle) {
    const facts = authoritative.facts ?? {};
    const invocation = (id) => (authoritative.invocations ?? [])
      .find((item) => item.logicalInvocationId === id);
    const worker = (id) => (authoritative.workers ?? []).find((item) => item.workerId === id);
    const deployment = (id) => (authoritative.deployments ?? []).find((item) => item.deploymentId === id);
    const eventIndex = (name, id = null) => events.findIndex((event) =>
      event.event === name && (id == null || event.logicalInvocationId === id || event.workerId === id));
    const lifecycleIndex = (name, id = null) => lifecycle.findIndex((event) =>
      event.event === name && (id == null || event.deploymentId === id));

    switch (scenario) {
      case "two_workers_eligible_route":
        check(facts.firstWorkerId === "worker-a" && facts.secondWorkerId === "worker-b",
          "round-robin routes across two workers");
        check(facts.bothWereEligible === true && facts.liveProcessCount === 2,
          "both local processes were live and eligible at dispatch");
        check(invocation("route-a")?.state === "SUCCEEDED" && invocation("route-b")?.state === "SUCCEEDED",
          "both routed invocations succeed");
        check(worker("worker-a")?.state === "STOPPED" && worker("worker-b")?.state === "STOPPED",
          "both local worker processes stop through Supervisor decisions");
        break;
      case "load_failure_preserves_active":
        check(facts.activeDeploymentId === "dep-v1", "load failure preserves active v1");
        check(facts.candidateState === "FAILED" && facts.artifactCount === 2,
          "load failure affects only candidate deployment");
        check(lifecycleIndex("LOAD_FAILED", "dep-v2-load-failed") >= 0,
          "load fault is retained as a capability observation");
        break;
      case "warmup_crash_preserves_active":
        check(facts.activeDeploymentId === "dep-v1" && facts.candidateState === "FAILED",
          "warmup crash preserves active v1");
        check(facts.failedWorkerState === "INELIGIBLE" && facts.otherWorkerState === "ELIGIBLE",
          "Supervisor isolates only the crashed worker");
        check(lifecycleIndex("WARMUP_FAILED", "dep-v2-warm-failed") >= 0,
          "warmup fault is retained");
        break;
      case "unknown_outcome_retry_denied":
        check(invocation("unsafe")?.state === "OUTCOME_UNKNOWN", "unsafe uncertainty is terminal unknown");
        check(invocation("unsafe")?.attempts.length === 1, "unsafe invocation is not retried");
        check(events.some((event) => event.event === "RETRY_DENIED"
          && event.details.reason === "IDEMPOTENCY_EVIDENCE_REQUIRED"),
        "retry denial names missing idempotency evidence");
        break;
      case "deduplicated_retry_succeeds":
        check(invocation("dedupe")?.state === "SUCCEEDED", "deduplicated retry succeeds once");
        check(invocation("dedupe")?.attempts.length === 2, "deduplicated invocation has two attempts");
        check(facts.firstWorkerId !== facts.secondWorkerId, "retry uses another eligible worker");
        check(eventIndex("RETRY_ALLOWED", "dedupe") >= 0, "retry decision is retained");
        break;
      case "drain_crash_requires_termination": {
        const timedOut = lifecycleIndex("DRAIN_WAIT_TIMED_OUT", "dep-v1");
        const forced = lifecycleIndex("FORCED_TERMINATION_REQUIRED", "dep-v1");
        const unloading = lifecycleIndex("DEPLOYMENT_UNLOADING", "dep-v1");
        check(facts.drainedBeforeForce === false && facts.forcedTerminationCount === 1,
          "drain crash creates one forced termination obligation");
        check(timedOut >= 0 && timedOut < forced && forced < unloading,
          "forced termination requirement precedes unload");
        break;
      }
      case "unload_failure_preserves_active":
        check(facts.oldDeploymentState === "FAILED" && facts.activeDeploymentId === "dep-v2",
          "unload failure preserves replacement active deployment");
        check(facts.activeArtifactIdentity?.endsWith("@2.0.0"), "replacement artifact remains active");
        break;
      case "retry_budget_exhausted":
        check(invocation("budget")?.state === "OUTCOME_UNKNOWN", "exhausted uncertainty remains unknown");
        check(invocation("budget")?.attempts.length === 2, "attempt budget is exact");
        check(events.some((event) => event.event === "RETRY_DENIED"
          && event.details.reason === "ATTEMPT_BUDGET_EXHAUSTED"),
        "budget denial is retained");
        break;
      case "restart_blocks_unsafe_retry":
        check(facts.previousEpoch !== facts.recoveredEpoch, "restart advances Control epoch");
        check(invocation("restart-unsafe")?.state === "OUTCOME_UNKNOWN", "recovered unsafe attempt is unknown");
        check(invocation("restart-unsafe")?.attempts.length === 1, "recovered unsafe attempt is not retried");
        check(facts.workerStateAfterRecovery === "INELIGIBLE", "old worker eligibility is fenced");
        check(eventIndex("ATTEMPT_RECOVERED_UNKNOWN", "restart-unsafe") >= 0,
          "unknown recovery decision is retained");
        break;
      case "restart_reconciles_and_retries":
        check(facts.previousEpoch !== facts.recoveredEpoch, "safe restart advances Control epoch");
        check(invocation("restart-safe")?.state === "SUCCEEDED"
          && invocation("restart-safe")?.attempts.length === 2,
        "recovered deduplicated invocation retries and succeeds");
        check(facts.activeDeploymentId === "dep-v1-recovered"
          && authoritative.activeBindings?.["affine-production"] === "dep-v1-recovered",
        "M4 public actions re-establish the active binding");
        check(eventIndex("RECOVERY_DEPLOYMENT_RECONCILED") >= 0,
          "deployment reconciliation is retained");
        break;
      case "telemetry_failure_isolated":
        check(invocation("telemetry")?.state === "SUCCEEDED", "telemetry failure does not rewrite success");
        check(facts.workerState === "ELIGIBLE" && facts.activeDeploymentId === "dep-v1"
          && facts.desiredRevision === 1,
        "telemetry failure preserves worker, deployment, and intent facts");
        check(facts.telemetryFailureCount > 0, "telemetry export failure is counted");
        break;
      case "late_observation_cannot_rewrite_terminal":
        check(facts.stateBeforeLate === "SUCCEEDED" && facts.stateAfterLate === "SUCCEEDED",
          "late observation cannot rewrite terminal state");
        check(facts.resultBeforeLate === facts.resultAfterLate, "late observation cannot rewrite result");
        check(eventIndex("LATE_ATTEMPT_IGNORED", "late") >= 0, "late observation is retained and ignored");
        break;
      default:
        check(false, `unknown M5 scenario: ${scenario}`);
    }
  }
}

function eventDigest(event) {
  let canonical = `${event.sequence}\n${event.previousDigest}\n${event.owner}\n${event.event}\n`
    + `${event.controlEpoch}\n${event.actor}\n${event.cause}\n${event.traceId}\n`
    + `${event.logicalInvocationId}\n${event.attemptId}\n${event.workerId}\n`;
  for (const key of Object.keys(event.details ?? {}).sort()) {
    canonical += `${key}=${event.details[key]}\n`;
  }
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

function deriveMetrics(events) {
  const counters = new Map();
  const increment = (name) => counters.set(name, (counters.get(name) ?? 0) + 1);
  for (const event of events) {
    increment("events.total");
    increment(`events.owner.${event.owner}`);
    increment(`events.type.${event.event}`);
    switch (event.event) {
      case "WORKER_ELIGIBLE": increment("workers.eligible.decisions"); break;
      case "WORKER_INELIGIBLE":
      case "WORKER_RECOVERY_FENCED": increment("workers.ineligible.decisions"); break;
      case "ATTEMPT_DISPATCH_INTENT": increment("attempts.dispatched"); break;
      case "RETRY_ALLOWED": increment("retries.allowed"); break;
      case "RETRY_DENIED": increment("retries.denied"); break;
      case "INVOCATION_TERMINAL_UNKNOWN": increment("invocations.outcome_unknown"); break;
      case "INVOCATION_TERMINAL_SUCCEEDED": increment("invocations.succeeded"); break;
      case "INVOCATION_TERMINAL_FAILED": increment("invocations.failed"); break;
      case "RECOVERY_STARTED": increment("recovery.started"); break;
      case "TELEMETRY_EXPORT_FAILED": increment("telemetry.export_failures"); break;
      default: break;
    }
  }
  return Object.fromEntries([...counters.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function nonBlank(value) {
  return typeof value === "string" && value.length > 0;
}

function isTerminal(state) {
  return state === "SUCCEEDED" || state === "FAILED" || state === "OUTCOME_UNKNOWN";
}

function deepEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
if (invokedDirectly) {
  const target = process.argv[2];
  if (!target) throw new Error("usage: node scripts/verify-m5-bundle.mjs <bundle>");
  const result = verifyM5Bundle(target);
  console.log(`${result.scenarioId}: ${result.verdict}`);
  for (const failure of result.failures) console.error(`- ${failure}`);
  if (result.verdict !== "PASS") process.exit(1);
}

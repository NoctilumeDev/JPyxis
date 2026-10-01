import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const coordinateCases = [
  "honest", "plan_worker", "plan_instance", "plan_epoch", "plan_trace", "plan_number", "plan_mode", "plan_scope",
  "plan_null", "plan_null_worker", "handle_worker", "handle_instance", "handle_epoch", "handle_null",
  "terminal_foreign_epoch", "late_liveness", "late_association", "same_instance_unknown",
  "old_success", "old_before", "old_after", "old_unknown", "worker_wide_action", "replacement_race", "epoch_mismatch",
  "recovery_none", "recovery_deduplicated", "deduplicated_retry", "budget_unknown", "none_before",
  "replay_bad_workerEpoch", "replay_bad_workerInstanceId", "replay_bad_idempotencyMode",
  "replay_bad_deduplicationScope", "replay_bad_attemptNumber",
];
const sha = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

export function verifyM5CoordinateEvidence(directory, options = {}) {
  const failures = [];
  const incomplete = [];
  const results = [];
  const read = relative => {
    const file = path.join(directory, relative);
    if (!fs.existsSync(file)) { incomplete.push(`missing ${relative}`); return null; }
    return fs.readFileSync(file);
  };
  const check = (label, action) => { try { action(); } catch (error) { failures.push(`${label}: ${error.message}`); } };
  const bytes = read("manifest.json");
  if (!bytes) return { verdict: "INCONCLUSIVE", failures, incomplete, results };
  let manifest;
  try { manifest = JSON.parse(bytes); }
  catch { return { verdict: "FAIL", failures: ["manifest is unreadable"], incomplete, results }; }
  check("source binding", () => {
    assert.equal(manifest.schemaVersion, "jpyxis.io/m5-coordinate-evidence/v1alpha1");
    assert.match(manifest.source.revision, /^[0-9a-f]{40}$/);
    assert.equal(manifest.compileExit, 0);
    assert.equal(manifest.sourcesUnchangedAtEnd, true);
    if (!options.allowDirty) assert.equal(manifest.source.scope, "IMMUTABLE_GIT_SOURCE");
    if (options.expectedSourceRevision) assert.equal(manifest.source.revision, options.expectedSourceRevision);
    assert.equal(git("rev-parse", `${manifest.source.revision}^{tree}`), manifest.source.tree);
    if (manifest.source.scope === "IMMUTABLE_GIT_SOURCE") {
      for (const source of manifest.sources) assert.equal(git("rev-parse", `${manifest.source.revision}:${source.path}`), source.gitBlob);
    }
    assert.equal(manifest.contractTag, "m5-coordinate-contract-v2");
    assert.equal(manifest.contractSource, "2ac2715b994f519fbad4afb73b1f80ea0852dd55");
    assert.deepEqual(manifest.runs.map(run => run.case), coordinateCases);
    if (!options.allowDirty) assert.deepEqual(manifest.durableReplayFixtures.map(file => file.field).sort(),
      ["attemptNumber", "deduplicationScope", "idempotencyMode", "workerEpoch", "workerInstanceId"]);
  });
  for (const testCase of coordinateCases) {
    const run = manifest.runs.find(item => item.case === testCase);
    if (!run) { incomplete.push(`missing case ${testCase}`); continue; }
    const stdout = read(run.stdout);
    const stderr = read(run.stderr);
    if (!stdout || !stderr) continue;
    const prior = failures.length;
    check(testCase, () => {
      assert.equal(sha(stdout), run.stdoutSha256);
      assert.equal(sha(stderr), run.stderrSha256);
      assert.equal(run.exitCode, 0, "model emitter did not complete");
      const row = JSON.parse(stdout);
      assert.equal(row.case, testCase);
      verifyObservation(row);
    });
    results.push({ id: testCase, verdict: failures.length === prior ? "PASS" : "FAIL" });
  }
  for (const file of manifest.durableReplayFixtures ?? []) {
    const input = read(file.path);
    if (!input) continue;
    check(file.path, () => {
      assert.equal(sha(input), file.sha256);
      verifyDurableFixture(input, file.field);
    });
  }
  const mutationResults = [];
  if (options.verifyMutations) {
    const expected = { missing_case_stdout: "INCONCLUSIVE", poisoned_replacement: "FAIL", self_declared_plan_success: "FAIL" };
    check("mutation matrix", () => assert.deepEqual(manifest.mutations.map(item => item.id).sort(), Object.keys(expected).sort()));
    for (const item of manifest.mutations ?? []) {
      const mutated = verifyM5CoordinateEvidence(path.resolve(directory, item.path), { ...options, verifyMutations: false });
      check(item.id, () => assert.equal(mutated.verdict, expected[item.id]));
      mutationResults.push({ id: item.id, verdict: mutated.verdict });
    }
  }
  return { verdict: failures.length ? "FAIL" : incomplete.length ? "INCONCLUSIVE" : "PASS", failures, incomplete, results, mutationResults,
    scope: "M5 v2 public-model guards; supplemental durable replay fixtures; no real computation or process qualification" };
}

function verifyObservation(row) {
  const events = row.eventsAfter;
  const of = name => events.filter(event => event.event === name);
  for (const event of events) {
    if (event.owner.endsWith("_CAPABILITY")) assert.equal(event.details.newState, undefined, "capability cannot transition owner state");
    if (event.details.newState && event.workerId && !event.logicalInvocationId) assert.equal(event.owner, "WORKER_SUPERVISOR");
    if (event.event.startsWith("INVOCATION_TERMINAL_")) assert.equal(event.owner, "RESILIENT_INVOCATION_MANAGER");
  }
  if (row.case.startsWith("handle_")) {
    assert.equal(row.workerAfter.state, "FAILED");
    assert.equal(row.workerAfter.processId, 0);
    assert.equal(row.routingException, "NO_ELIGIBLE_WORKER");
    assert.equal(row.healthCalls, 0);
    assert.equal(row.stopCalls, 0);
    assert.equal(of("WORKER_HANDLE_PINNED").length, 0);
    const rejected = of("WORKER_HANDLE_REJECTED");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].details.code, "WORKER_COORDINATE_MISMATCH");
    assert.equal(rejected[0].details.requestedWorkerId, row.workerAfter.workerId);
    assert.equal(rejected[0].details.requestedInstanceId, row.workerAfter.instanceId);
    assert.equal(rejected[0].details.requestedEpoch, row.workerAfter.controlEpoch);
    return;
  }
  if (row.case.startsWith("plan_") || row.case === "terminal_foreign_epoch") {
    assert.equal(row.exceptionCode, "ATTEMPT_COORDINATE_MISMATCH");
    assert.deepEqual(row.invocationAfter, row.invocationBefore);
    assert.deepEqual(row.workerAfter, row.workerBefore);
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "ATTEMPT_INPUT_REJECTED");
    assert.equal(events[0].owner, "RESILIENT_INVOCATION_MANAGER");
    assert.equal(events[0].details.newState, undefined);
    return;
  }
  if (row.case.startsWith("replay_bad_")) {
    assert.equal(row.exceptionCode, "DURABLE_JOURNAL_INVALID");
    assert.equal(events.length, 0, "bad tuple cannot begin logical recovery decisions");
    assert.deepEqual(row.workerAfter, row.workerBefore);
    const field = row.case.substring("replay_bad_".length);
    assertReplayContradiction(row.journal, field);
    return;
  }
  if (row.case === "epoch_mismatch") {
    assert.equal(row.exceptionCode, "CONTROL_EPOCH_MISMATCH");
    assert.equal(events.length, 0);
    assert.deepEqual(row.invocationAfter, row.invocationBefore);
    return;
  }
  assert.equal(row.exceptionCode, "");
  if (row.case.startsWith("late_") || row.case === "recovery_none") {
    assert.deepEqual(row.invocationAfter, row.invocationBefore);
    assert.deepEqual(row.workerAfter, row.workerBefore);
    assert.equal(of("LATE_ATTEMPT_OBSERVED").length, 1);
    assert.equal(of("LATE_ATTEMPT_IGNORED").length, 1);
    assert.equal(of("LATE_ATTEMPT_OBSERVED")[0].details.provenance,
      row.case === "late_association" ? "ASSOCIATION_ONLY" : "FULL_PLAN_VALIDATED");
    assert.equal(events.filter(event => event.event.startsWith("INVOCATION_TERMINAL_")).length, 0);
    if (row.case === "recovery_none") {
      assert.equal(row.invocationAfter.state, "OUTCOME_UNKNOWN");
      assert.equal(row.invocationAfter.attempts[0].observation, "UNKNOWN_REMOTE_OUTCOME");
      assert.equal(row.workerAfter.controlEpoch, "epoch-2");
      assert.equal(row.workerAfter.state, "ELIGIBLE");
    }
    return;
  }
  if (row.case === "worker_wide_action") {
    assert.deepEqual(row.invocationAfter, row.invocationBefore);
    assert.equal(row.workerAfter.state, "INELIGIBLE");
    assert.equal(of("WORKER_INELIGIBLE")[0].details.scope, "LOGICAL_WORKER_ACTION");
    return;
  }
  const expected = row.case === "old_before" || row.case === "old_after" || row.case === "none_before" ? "FAILED"
    : ["same_instance_unknown", "old_unknown", "replacement_race", "budget_unknown"].includes(row.case) ? "OUTCOME_UNKNOWN" : "SUCCEEDED";
  assert.equal(row.invocationAfter.state, expected);
  assert.equal(events.filter(event => event.event.startsWith("INVOCATION_TERMINAL_")).length, 1);
  assert.equal(row.invocationAfter.idempotencyMode, row.invocationBefore.idempotencyMode);
  assert.equal(row.invocationAfter.deduplicationScope, row.invocationBefore.deduplicationScope);
  assert.equal(row.invocationAfter.maximumAttempts, row.invocationBefore.maximumAttempts);
  if (row.case.startsWith("old_")) {
    assert.notEqual(row.retainedPlan.worker.instanceId, row.workerBefore.instanceId);
    assert.deepEqual(row.workerAfter, row.workerBefore);
    assert.equal(events.filter(event => event.owner === "WORKER_SUPERVISOR" && event.details.newState).length, 0);
  }
  if (row.case === "old_unknown" || row.case === "replacement_race") {
    const ignored = of("WORKER_INSTANCE_OBSERVATION_IGNORED");
    assert.equal(ignored.length, 1);
    assert.equal(ignored[0].details.reason, "SUPERSEDED_WORKER_INSTANCE");
    assert.equal(ignored[0].details.originatingInstanceId, row.retainedPlan.worker.instanceId);
    assert.equal(ignored[0].details.currentInstanceId, row.workerAfter.instanceId);
    assert.equal(ignored[0].details.code, "CHANNEL_LOST");
    assert.equal(ignored[0].details.newState, undefined);
  }
  if (row.case === "replacement_race") {
    assert.deepEqual(row.workerAfter, row.replacementAtApply);
    assert.equal(row.workerAfter.state, "ELIGIBLE");
    assert.equal(of("WORKER_INELIGIBLE").filter(event => event.details.scope === "INSTANCE_SCOPED").length, 0);
  }
  if (row.case === "same_instance_unknown" || row.case === "budget_unknown") {
    assert.equal(row.workerAfter.state, "INELIGIBLE");
    assert.equal(of("WORKER_INELIGIBLE")[0].details.scope, "INSTANCE_SCOPED");
  }
  if (row.case === "deduplicated_retry" || row.case === "recovery_deduplicated") {
    assert.equal(row.invocationAfter.attempts.length, 2);
    assert.equal(row.retryPlan.attemptNumber, 2);
    assert.notEqual(row.retryPlan.attemptId, row.retainedPlan.attemptId);
    if (row.case === "deduplicated_retry") assert.notEqual(row.retryPlan.worker.workerId, row.retainedPlan.worker.workerId);
    else assert.equal(row.retryPlan.worker.controlEpoch, "epoch-2");
  } else {
    assert.equal(row.invocationAfter.attempts.length, 1);
    assert.equal(of("RETRY_ALLOWED").length, 0);
  }
}

function assertReplayContradiction(events, field) {
  const request = events.find(event => event.event === "INVOCATION_ACCEPTED");
  const reservation = events.find(event => event.event === "INVOCATION_ATTEMPTING");
  const dispatch = events.find(event => event.event === "ATTEMPT_DISPATCH_INTENT");
  if (field === "workerEpoch") assert.notEqual(reservation.details.workerEpoch, reservation.controlEpoch);
  else if (field === "workerInstanceId" || field === "attemptNumber") assert.notEqual(dispatch.details[field], reservation.details[field]);
  else assert.notEqual(dispatch.details[field], request.details[field]);
}

function verifyDurableFixture(bytes, field) {
  const text = bytes.toString("utf8");
  assert.ok(text.endsWith("\n"), "durable record boundary missing");
  const events = text.trimEnd().split("\n").map(line => JSON.parse(line));
  let prior = "sha256:genesis";
  for (const [index, event] of events.entries()) {
    assert.equal(event.sequence, index + 1);
    assert.equal(event.previousDigest, prior);
    let canonical = `${event.sequence}\n${event.previousDigest}\n${event.owner}\n${event.event}\n`
      + `${event.controlEpoch}\n${event.actor}\n${event.cause}\n${event.traceId}\n`
      + `${event.logicalInvocationId}\n${event.attemptId}\n${event.workerId}\n`;
    for (const key of Object.keys(event.details).sort()) canonical += `${key}=${event.details[key]}\n`;
    assert.equal(event.digest, sha(canonical));
    prior = event.digest;
  }
  assertReplayContradiction(events, field);
  assert.equal(events.filter(event => event.event.startsWith("INVOCATION_TERMINAL_") || event.event === "RECOVERY_STARTED").length, 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyM5CoordinateEvidence(path.resolve(process.argv[2] ?? "build/m5/coordinate-validation"),
    { expectedSourceRevision: process.argv[3], verifyMutations: true });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === "PASS" ? 0 : 1);
}

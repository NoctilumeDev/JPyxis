import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const revision = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(revision ?? "")) throw new Error("Supply an immutable 40-character commit SHA");
const archive = "evidence/productization-audit/first-instance-failure";
const git = (...args) => {
  const result = spawnSync("git", args, { maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
};
const blob = file => git("show", `${revision}:${archive}/${file}`);
const sha = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const retention = JSON.parse(blob("retention.json"));
const receiptBytes = blob("receipt.json");
const receipt = JSON.parse(receiptBytes);
assert.equal(sha(receiptBytes), retention.firstReceiptSha256);
assert.equal(sha(blob(retention.probeArchive)), receipt.probeSource.sha256);
assert.equal(sha(blob(retention.harnessArchive)), receipt.harnessSource.sha256);
assert.equal(receipt.compileExit, 0);
assert.equal(receipt.auditDecision, "STOP_MODEL_COUNTEREXAMPLE");
for (const source of receipt.sources) {
  assert.equal(git("rev-parse", `${receipt.sourceBase}:${source.path}`).toString().trim(), source.gitBlob);
  assert.equal(git("rev-parse", `${revision}:${source.path}`).toString().trim(), source.gitBlob);
}
for (const run of receipt.runs) {
  const stdout = blob(`${run.case}.stdout.bin`);
  assert.equal(sha(stdout), run.stdoutSha256);
  assert.equal(sha(blob(`${run.case}.stderr.bin`)), run.stderrSha256);
  assert.deepEqual(JSON.parse(stdout), run.observed);
}
assert.deepEqual(receipt.runs.map(run => [run.case, run.exitCode]), [
  ["same_instance_failure_control", 0], ["replacement_success_control", 0], ["replacement_instance_failure", 2],
]);
const failure = receipt.runs[2].observed;
assert.notEqual(failure.attemptInstance, failure.beforeInstance);
assert.equal(failure.beforeInstance, failure.afterInstance);
assert.equal(failure.beforeState, "ELIGIBLE");
assert.equal(failure.afterState, "INELIGIBLE");
assert.equal(failure.currentCapabilityStillHealthy, true);
assert.equal(failure.logicalOutcome, "OUTCOME_UNKNOWN");
assert.equal(failure.submittedPlanUnmodified, true);
assert.equal(failure.unexpectedReplacementMutation, true);
assert.equal(failure.eventsAfterOldObservation.find(event => event.event === "WORKER_INELIGIBLE")
  .details.instanceId, failure.beforeInstance);
console.log(JSON.stringify({ revision, storageReadback: "VERIFIED", auditDecision: receipt.auditDecision,
  scope: "Immutable second model-probe storage only; no contract or runtime qualification" }, null, 2));

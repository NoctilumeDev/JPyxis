import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Storage readback for this bounded audit receipt only. It does not qualify product behavior.
const directory = "evidence/productization-audit/first-coordinate-probe";
const revision = process.argv[2];
const read = relative => {
  if (!revision) return fs.readFileSync(relative);
  const result = spawnSync("git", ["show", `${revision}:${relative}`]);
  assert.equal(result.status, 0, `Cannot read retained Git blob: ${relative}`);
  return result.stdout;
};
const digest = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const receipt = JSON.parse(read(`${directory}/receipt.json`).toString("utf8"));
const failures = [];
const check = (name, action) => {
  try { action(); } catch (error) { failures.push({ name, message: error.message }); }
};
check("compilation and source coordinate", () => {
  assert.equal(receipt.compileExit, 0);
  assert.equal(receipt.sourceBase, "9632a4f45c2190da6440e455667090fdd88e4a69");
  assert.equal(receipt.auditDecision, "STOP_MODEL_COUNTEREXAMPLE");
});
for (const source of [receipt.probeSource, receipt.harnessSource]) {
  check(source.path, () => assert.equal(digest(read(source.path)), source.sha256));
}
for (const run of receipt.runs) {
  check(run.case, () => {
    const stdout = read(path.posix.join(directory, `${run.case}.stdout.bin`));
    const stderr = read(path.posix.join(directory, `${run.case}.stderr.txt`));
    assert.equal(digest(stdout), run.stdoutSha256, "Retained stdout bytes differ from the first observation");
    assert.equal(digest(stderr), run.stderrSha256, "Retained stderr bytes differ from the first observation");
    assert.deepEqual(JSON.parse(stdout.toString("utf8")), run.observed);
  });
}
check("control and counterexample separation", () => {
  const runs = Object.fromEntries(receipt.runs.map(run => [run.case, run]));
  assert.equal(receipt.runs.length, 5);
  assert.equal(runs.honest_plan_control.exitCode, 0);
  assert.equal(runs.honest_plan_control.observed.observedState, "SUCCEEDED");
  assert.equal(runs.worker_instance_substitution.exitCode, 0);
  assert.equal(runs.worker_instance_substitution.observed.observedException, "ATTEMPT_COORDINATE_MISMATCH");
  for (const name of ["worker_epoch_substitution", "idempotency_substitution", "worker_handle_substitution"]) {
    assert.equal(runs[name].exitCode, 2);
    assert.equal(runs[name].observed.unexpectedAcceptance, true);
  }
});
check("original candidate bytes", () => assert.equal(
  digest(read("evidence/productization-audit/original-candidate.txt")),
  "sha256:6f935df1ae541a9295b43df6ae758c5544c873d980f68b09793020e2745ceaeb",
));
console.log(JSON.stringify({ scope: "First audit receipt storage integrity only; product audit remains STOP", revision: revision ?? "working-tree", storageReadback: failures.length ? "FAILED" : "VERIFIED", failures }, null, 2));
process.exit(failures.length ? 1 : 0);

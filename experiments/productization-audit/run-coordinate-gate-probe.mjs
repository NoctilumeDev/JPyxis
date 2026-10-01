import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const base = "9632a4f45c2190da6440e455667090fdd88e4a69";
const root = process.cwd();
const output = process.argv[2] ?? "build/productization-audit/first-coordinate-probe";
if (fs.existsSync(output)) throw new Error("Output already exists; retain it and choose a new run directory.");
const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8", cwd: root });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const digest = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const sourceRoot = "resilience/java/src/main/java/io/jpyxis/resilience";
const files = [
  ...fs.readdirSync(`${sourceRoot}/api`).filter(name => name.endsWith(".java")).sort().map(name => `${sourceRoot}/api/${name}`),
  ...["WorkerSupervisor", "ResilientInvocationManager"].map(name => `${sourceRoot}/core/${name}.java`),
  ...["EventOwner", "ResilienceJournal", "ResilienceEvent", "ResilienceEventDraft"].map(name => `${sourceRoot}/evidence/${name}.java`),
  ...["WorkerControl", "WorkerControlException", "AttemptExecutor"].map(name => `${sourceRoot}/port/${name}.java`),
];
const sources = files.map(file => {
  const expectedGitBlob = git("rev-parse", `${base}:${file}`);
  const actualGitBlob = git("hash-object", file);
  if (actualGitBlob !== expectedGitBlob) throw new Error(`Source differs from exact audit base: ${file}`);
  return { path: file, gitBlob: actualGitBlob, sha256: digest(fs.readFileSync(file)) };
});
const probe = "experiments/productization-audit/CoordinateGateProbe.java";
fs.mkdirSync(output, { recursive: true });
const classes = path.join(output, "classes");
fs.mkdirSync(classes);
const startedAt = new Date().toISOString();
const compile = spawnSync("javac", ["--release", "17", "-d", classes, ...files, probe], { encoding: "utf8", cwd: root });
fs.writeFileSync(path.join(output, "compile.stdout.txt"), compile.stdout ?? "");
fs.writeFileSync(path.join(output, "compile.stderr.txt"), compile.stderr ?? "");
const receipt = {
  schemaVersion: "jpyxis.io/productization-audit-probe/v1alpha1",
  scope: "Audit-only M5 public model coordinate gates; in-memory journal; synthetic execution observation; no durability or real worker claim",
  sourceBase: base,
  sourceTree: git("rev-parse", `${base}^{tree}`),
  checkoutHead: git("rev-parse", "HEAD"),
  dirtyState: git("status", "--porcelain"),
  sourceEquality: "Each compiled predecessor file matches the exact base Git blob before compilation",
  sources,
  probeSource: { path: probe, sha256: digest(fs.readFileSync(probe)) },
  harnessSource: { path: "experiments/productization-audit/run-coordinate-gate-probe.mjs", sha256: digest(fs.readFileSync("experiments/productization-audit/run-coordinate-gate-probe.mjs")) },
  environment: { os: os.type(), release: os.release(), architecture: os.arch(), node: process.version },
  startedAt,
  javac: spawnSync("javac", ["-version"], { encoding: "utf8" }).stdout.trim(),
  java: spawnSync("java", ["-version"], { encoding: "utf8" }).stderr.trim(),
  compileExit: compile.status,
  runs: [],
};
if (compile.status === 0) {
  for (const testCase of ["honest_plan_control", "worker_instance_substitution", "worker_epoch_substitution", "idempotency_substitution", "worker_handle_substitution"]) {
    const run = spawnSync("java", ["-cp", classes, "CoordinateGateProbe", testCase], { encoding: "utf8", cwd: root });
    fs.writeFileSync(path.join(output, `${testCase}.stdout.json`), run.stdout ?? "");
    fs.writeFileSync(path.join(output, `${testCase}.stderr.txt`), run.stderr ?? "");
    let observed;
    try { observed = JSON.parse(run.stdout); } catch { observed = { probeFailure: true }; }
    receipt.runs.push({ case: testCase, exitCode: run.status, stdoutSha256: digest(run.stdout ?? ""), stderrSha256: digest(run.stderr ?? ""), observed });
    console.log(JSON.stringify({ case: testCase, exitCode: run.status, expected: observed.expected, observedState: observed.observedState, observedException: observed.observedException, unexpectedAcceptance: observed.unexpectedAcceptance }));
  }
}
receipt.completedAt = new Date().toISOString();
receipt.auditDecision = compile.status !== 0 || receipt.runs.some(run => run.observed.probeFailure)
  ? "PROBE_INVALID"
  : receipt.runs.some(run => run.observed.unexpectedAcceptance) ? "STOP_MODEL_COUNTEREXAMPLE" : "NO_COUNTEREXAMPLE_OBSERVED";
fs.writeFileSync(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ auditDecision: receipt.auditDecision, receipt: path.join(output, "receipt.json"), receiptSha256: digest(fs.readFileSync(path.join(output, "receipt.json"))) }));
process.exit(receipt.auditDecision === "NO_COUNTEREXAMPLE_OBSERVED" ? 0 : 2);

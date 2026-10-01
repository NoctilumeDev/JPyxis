import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { coordinateCases, verifyM5CoordinateEvidence } from "./verify-m5-coordinate-evidence.mjs";

const root = process.cwd();
const allowDirty = process.argv.includes("--allow-dirty");
const outputArgument = process.argv.find((item, index) => index > 1 && !item.startsWith("--"));
const output = path.resolve(outputArgument ?? "build/m5/coordinate-validation");
const relative = path.relative(path.join(root, "build"), output);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must be inside this checkout's build directory");
if (fs.existsSync(output)) throw new Error("Retain the prior coordinate evidence and choose a new output directory");
const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const sha = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const sourceRoot = "resilience/java/src/main/java/io/jpyxis/resilience";
const sources = [
  ...fs.readdirSync(`${sourceRoot}/api`).filter(name => name.endsWith(".java")).sort().map(name => `${sourceRoot}/api/${name}`),
  ...["WorkerSupervisor", "ResilientInvocationManager"].map(name => `${sourceRoot}/core/${name}.java`),
  ...["EventOwner", "ResilienceJournal", "ResilienceEvent", "ResilienceEventDraft"].map(name => `${sourceRoot}/evidence/${name}.java`),
  ...["WorkerControl", "WorkerControlException"].map(name => `${sourceRoot}/port/${name}.java`),
];
const probe = "experiments/m5-coordinate-validation/CoordinateValidationMain.java";
const revision = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain");
if (dirty && !allowDirty) throw new Error("Commit the candidate before immutable coordinate qualification; --allow-dirty is local development only");
const inputs = [...sources, probe, "scripts/verify-m5-coordinates.mjs", "scripts/verify-m5-coordinate-evidence.mjs"]
  .map(file => ({ path: file, gitBlob: git("hash-object", file), sha256: sha(fs.readFileSync(file)) }));
fs.mkdirSync(output, { recursive: true });
const classes = path.join(output, "classes");
fs.mkdirSync(classes);
const compile = spawnSync("javac", ["--release", "17", "-d", classes, ...sources, probe]);
fs.writeFileSync(path.join(output, "compile.stdout.bin"), compile.stdout ?? "");
fs.writeFileSync(path.join(output, "compile.stderr.bin"), compile.stderr ?? "");
const manifest = {
  schemaVersion: "jpyxis.io/m5-coordinate-evidence/v1alpha1",
  contractTag: "m5-coordinate-contract-v2",
  contractSource: "2ac2715b994f519fbad4afb73b1f80ea0852dd55",
  source: { revision, tree: git("rev-parse", "HEAD^{tree}"), scope: dirty ? "LOCAL_DIRTY_CANDIDATE" : "IMMUTABLE_GIT_SOURCE", dirty },
  sources: inputs,
  java: spawnSync("java", ["-version"], { encoding: "utf8" }).stderr.trim(),
  compileExit: compile.status,
  runs: [],
  durableReplayFixtures: [],
  mutations: [],
  scope: "M5 public model admission/owner effects; fresh JDK compilation; no real compute or process claim",
};
if (compile.status === 0) for (const testCase of coordinateCases) {
  const run = spawnSync("java", ["-cp", classes, "CoordinateValidationMain", testCase]);
  const stdout = `${testCase}.stdout.bin`;
  const stderr = `${testCase}.stderr.bin`;
  fs.writeFileSync(path.join(output, stdout), run.stdout ?? "");
  fs.writeFileSync(path.join(output, stderr), run.stderr ?? "");
  manifest.runs.push({ case: testCase, exitCode: run.status, stdout, stderr,
    stdoutSha256: sha(run.stdout ?? ""), stderrSha256: sha(run.stderr ?? "") });
}
const replayRoot = path.join(root, "build", "m5", "coordinate-validation-journals");
if (fs.existsSync(replayRoot)) {
  fs.mkdirSync(path.join(output, "durable-replay"));
  for (const name of fs.readdirSync(replayRoot).sort()) {
    const bytes = fs.readFileSync(path.join(replayRoot, name));
    fs.writeFileSync(path.join(output, "durable-replay", name), bytes);
    manifest.durableReplayFixtures.push({ path: `durable-replay/${name}`, sha256: sha(bytes), field: name.replace(/^replay-/, "").replace(/\.jsonl$/, "") });
  }
}
manifest.sourcesUnchangedAtEnd = inputs.every(input => sha(fs.readFileSync(input.path)) === input.sha256);
fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const mutationRoot = `${output}-mutations`;
if (fs.existsSync(mutationRoot)) throw new Error("Retain prior mutations and choose a new output directory");
for (const id of ["missing_case_stdout", "poisoned_replacement", "self_declared_plan_success"]) {
  const target = path.join(mutationRoot, id);
  fs.cpSync(output, target, { recursive: true });
  const altered = JSON.parse(fs.readFileSync(path.join(target, "manifest.json"), "utf8"));
  if (id === "missing_case_stdout") {
    fs.rmSync(path.join(target, "honest.stdout.bin"));
  } else {
    const testCase = id === "poisoned_replacement" ? "old_unknown" : "plan_epoch";
    const run = altered.runs.find(item => item.case === testCase);
    const row = JSON.parse(fs.readFileSync(path.join(target, run.stdout), "utf8"));
    if (id === "poisoned_replacement") row.workerAfter.state = "INELIGIBLE";
    else { row.exceptionCode = ""; row.invocationAfter.state = "SUCCEEDED"; row.selfDeclaredVerdict = "PASS"; }
    const bytes = Buffer.from(JSON.stringify(row) + "\n");
    fs.writeFileSync(path.join(target, run.stdout), bytes);
    run.stdoutSha256 = sha(bytes);
    fs.writeFileSync(path.join(target, "manifest.json"), JSON.stringify(altered, null, 2) + "\n");
  }
  manifest.mutations.push({ id, path: path.relative(output, target).split(path.sep).join("/") });
}
fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const verified = verifyM5CoordinateEvidence(output, { allowDirty, verifyMutations: true });
fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(verified, null, 2) + "\n");
console.log(JSON.stringify({ verdict: verified.verdict, cases: verified.results.length,
  failures: verified.failures, incomplete: verified.incomplete, sourceScope: manifest.source.scope,
  durableReplayFixtures: manifest.durableReplayFixtures.length }, null, 2));
process.exit(verified.verdict === "PASS" ? 0 : 1);

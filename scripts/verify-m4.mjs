import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { verifyM4Bundle } from "./verify-m4-bundle.mjs";
import { verifyM4Evidence } from "./verify-m4-evidence.mjs";

const root = process.cwd();
const buildRoot = path.join(root, "build", "m4");
const runRoot = path.join(buildRoot, "runs");
const jar = path.join(root, "lifecycle", "java", "target", "jpyxis-lifecycle-java.jar");
const artifactV1 = path.join(root, "spec", "m3", "definitions", "example_affine_plan_v1.py");
const artifactV2 = path.join(root, "spec", "m4", "artifacts", "example_affine_plan_v2.py");
const artifactDefinitions = [
  {
    identity: "jpyxis:definition:example/affine-batch-plan@1.0.0",
    source: artifactV1,
    file: "artifact-v1.py",
  },
  {
    identity: "jpyxis:definition:example/affine-batch-plan@2.0.0",
    source: artifactV2,
    file: "artifact-v2.py",
  },
];
const scenarios = [
  "activate_v1",
  "unvalidated_artifact_rejected",
  "artifact_identity_conflict",
  "warm_failure_preserves_active",
  "activation_precondition_preserves_active",
  "atomic_cutover_and_pinning",
  "draining_rejects_new",
  "forced_termination_defined",
  "rollback_immutable",
];

main();

function main() {
  fs.rmSync(buildRoot, { recursive: true, force: true });
  fs.mkdirSync(runRoot, { recursive: true });
  buildJava();
  verifyStaticBoundary();

  const results = [];
  for (const scenario of scenarios) {
    const bundle = path.join(runRoot, scenario);
    fs.mkdirSync(bundle, { recursive: true });
    run("java", [
      "-jar", jar,
      "--scenario", scenario,
      "--artifact-v1", artifactV1,
      "--artifact-v2", artifactV2,
      "--out", bundle,
    ]);
    for (const artifact of artifactDefinitions) {
      fs.copyFileSync(artifact.source, path.join(bundle, artifact.file));
    }
    writeManifest(bundle, scenario);
    const verified = verifyM4Bundle(bundle);
    if (verified.verdict !== "PASS") {
      throw new Error(`${scenario}: expected PASS, got ${verified.verdict}: ${verified.failures.join("; ")}`);
    }
    results.push({ id: scenario, verdict: verified.verdict });
    console.log(`${scenario}: ${verified.verdict}`);
  }

  const mutations = makeMutations(path.join(runRoot, "activate_v1"));
  for (const mutation of mutations) {
    const verified = verifyM4Bundle(mutation.path);
    if (verified.verdict !== mutation.expectedVerdict) {
      throw new Error(`${mutation.id}: expected ${mutation.expectedVerdict}, got ${verified.verdict}`);
    }
    results.push({ id: mutation.id, verdict: verified.verdict });
    console.log(`${mutation.id}: ${verified.verdict} (evidence mutation)`);
  }

  const summary = {
    schemaVersion: "jpyxis.io/m4-conformance-summary/v1alpha1",
    evidenceState: "PROTOTYPE",
    scenarioCount: results.length,
    executableScenarios: scenarios.length,
    mutationScenarios: mutations.length,
    results,
    assertions: {
      artifactIdentityIsImmutable: true,
      onlyValidatedArtifactsLoad: true,
      failedCandidatePreservesActive: true,
      atomicActiveBinding: true,
      inFlightInvocationPinning: true,
      drainingRejectsNewWork: true,
      forcedTerminationIsExplicit: true,
      rollbackReusesImmutableArtifact: true,
      slowCapabilityCallsStayOutsideStateLock: true,
      offlineBundleVerification: true,
    },
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(
    path.join(buildRoot, "conformance-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  const offline = verifyM4Evidence(buildRoot);
  if (offline.verdict !== "PASS") {
    throw new Error(`offline M4 evidence verification failed: ${offline.failures.join("; ")}`);
  }
  console.log(`M4 lifecycle verification passed: ${results.length} scenarios`);
}

function buildJava() {
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", [
      "/d", "/s", "/c", "mvnw.cmd -q -pl lifecycle/java -am package",
    ]);
  } else {
    run("sh", [path.join(root, "mvnw"), "-q", "-pl", "lifecycle/java", "-am", "package"]);
  }
}

function verifyStaticBoundary() {
  const lifecycleRoot = path.join(root, "lifecycle", "java", "src", "main", "java");
  const files = listFiles(lifecycleRoot).filter((file) => file.endsWith(".java"));
  const all = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const [label, pattern] of [
    ["M3 invocation implementation", /io\.jpyxis\.(?:invocation|host)/],
    ["gRPC", /\bio\.grpc\b/],
    ["generated Protobuf", /\bcom\.google\.protobuf\b/],
    ["Spring", /\borg\.springframework\b/],
    ["Python or Runtime product", /\b(?:python|numpy|onnxruntime|torch)\b/i],
  ]) {
    if (pattern.test(all)) throw new Error(`M4 lifecycle module imports ${label}`);
  }
  const core = listFiles(path.join(lifecycleRoot, "io", "jpyxis", "lifecycle", "core"))
    .map((file) => fs.readFileSync(file, "utf8")).join("\n");
  if (/io\.jpyxis\.lifecycle\.reference|com\.fasterxml\.jackson/.test(core)) {
    throw new Error("M4 Core imports a reference fixture or evidence encoding");
  }
  const invocation = listFiles(path.join(root, "invocation", "java", "src", "main", "java"))
    .map((file) => fs.readFileSync(file, "utf8")).join("\n");
  if (/io\.jpyxis\.lifecycle/.test(invocation)) {
    throw new Error("frozen M2/M3 invocation module depends backwards on M4 lifecycle");
  }
}

function writeManifest(bundle, scenario) {
  const requiredFiles = [
    "authoritative-state.json",
    "lifecycle-events.json",
    "artifact-v1.py",
    "artifact-v2.py",
  ];
  const manifest = {
    schemaVersion: "jpyxis.io/m4-evidence-bundle/v1alpha1",
    scenarioId: scenario,
    profileScenarioId: scenario,
    createdAt: new Date().toISOString(),
    source: sourceCoordinate(),
    environment: environmentCoordinate(),
    topology: "one Java Control process and one deterministic lifecycle capability fixture",
    artifacts: artifactDefinitions.map((artifact) => ({
      identity: artifact.identity,
      digest: digestFile(artifact.source),
      file: artifact.file,
    })),
    files: requiredFiles.map((file) => ({
      path: file,
      required: true,
      sha256: digestFile(path.join(bundle, file)),
    })),
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(path.join(bundle, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function makeMutations(successBundle) {
  return [
    mutate("bundle_missing", "INCONCLUSIVE", (bundle) => {
      fs.rmSync(path.join(bundle, "lifecycle-events.json"));
    }),
    mutate("bundle_corrupt", "FAIL", (bundle) => {
      fs.appendFileSync(path.join(bundle, "artifact-v1.py"), "\n# tampered\n");
    }),
  ];

  function mutate(id, expectedVerdict, action) {
    const target = path.join(runRoot, id);
    fs.cpSync(successBundle, target, { recursive: true });
    fs.rmSync(path.join(target, "verdict.json"), { force: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "manifest.json"), "utf8"));
    manifest.scenarioId = id;
    fs.writeFileSync(path.join(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    const state = JSON.parse(fs.readFileSync(path.join(target, "authoritative-state.json"), "utf8"));
    state.scenarioId = id;
    fs.writeFileSync(path.join(target, "authoritative-state.json"), `${JSON.stringify(state, null, 2)}\n`);
    const stateEntry = manifest.files.find((item) => item.path === "authoritative-state.json");
    stateEntry.sha256 = digestFile(path.join(target, "authoritative-state.json"));
    fs.writeFileSync(path.join(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    action(target);
    return { id, expectedVerdict, path: target };
  }
}

function explicitlyUnproven() {
  return [
    "durable state and restart recovery",
    "real worker process supervision or forced termination",
    "multi-worker placement and routing",
    "retry and idempotency policy",
    "arbitrary plugin compatibility",
    "clean-machine reproducibility",
    "performance",
    "production readiness",
    "security isolation",
    "accelerator support",
    "multi-host behavior",
    "business success",
  ];
}

function sourceCoordinate() {
  return {
    revision: capture("git", ["rev-parse", "HEAD"]),
    dirty: capture("git", ["status", "--porcelain"]).length > 0,
  };
}

function environmentCoordinate() {
  return {
    os: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    java: capture("java", ["-version"], true).split(/\r?\n/, 1)[0],
    node: process.version,
    mavenWrapper: "3.9.11",
  };
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function capture(command, args, includeStderr = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
  return `${result.stdout ?? ""}${includeStderr ? result.stderr ?? "" : ""}`.trim();
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

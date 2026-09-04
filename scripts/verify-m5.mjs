import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { verifyM5Bundle } from "./verify-m5-bundle.mjs";
import { verifyM5Evidence } from "./verify-m5-evidence.mjs";

const root = process.cwd();
const buildRoot = path.join(root, "build", "m5");
const runRoot = path.join(buildRoot, "runs");
const jar = path.join(root, "resilience", "java", "target", "jpyxis-resilience-java.jar");
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
  "two_workers_eligible_route",
  "load_failure_preserves_active",
  "warmup_crash_preserves_active",
  "unknown_outcome_retry_denied",
  "deduplicated_retry_succeeds",
  "drain_crash_requires_termination",
  "unload_failure_preserves_active",
  "retry_budget_exhausted",
  "restart_blocks_unsafe_retry",
  "restart_reconciles_and_retries",
  "telemetry_failure_isolated",
  "late_observation_cannot_rewrite_terminal",
];

main();

function main() {
  assertSafeBuildRoot();
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
    copyArtifacts(bundle);
    writeManifest(bundle, scenario);
    const verified = verifyM5Bundle(bundle);
    if (verified.verdict !== "PASS") {
      throw new Error(`${scenario}: expected PASS, got ${verified.verdict}: ${verified.failures.join("; ")}`);
    }
    results.push({ id: scenario, verdict: verified.verdict });
    console.log(`${scenario}: ${verified.verdict}`);
  }

  const mutations = makeMutations(path.join(runRoot, "two_workers_eligible_route"));
  for (const mutation of mutations) {
    const verified = verifyM5Bundle(mutation.path);
    if (verified.verdict !== mutation.expectedVerdict) {
      throw new Error(`${mutation.id}: expected ${mutation.expectedVerdict}, got ${verified.verdict}: ${verified.failures.join("; ")}`);
    }
    results.push({ id: mutation.id, verdict: verified.verdict });
    console.log(`${mutation.id}: ${verified.verdict} (evidence mutation)`);
  }

  const summary = {
    schemaVersion: "jpyxis.io/m5-conformance-summary/v1alpha1",
    evidenceState: "PROTOTYPE",
    scenarioCount: results.length,
    executableScenarios: scenarios.length,
    mutationScenarios: mutations.length,
    results,
    assertions: {
      durableHashChainedJournal: true,
      workerEligibilityHasSingleAuthority: true,
      workerEpochFencingOnRestart: true,
      logicalInvocationAndAttemptsAreSeparate: true,
      retryRequiresIdempotencyEvidence: true,
      retryBudgetIsBounded: true,
      uncertainOutcomeIsExplicit: true,
      lateObservationCannotRewriteTerminal: true,
      desiredIntentAndActualDeploymentAreSeparate: true,
      restartReconcilesThroughM4PublicActions: true,
      telemetryFailureCannotRewriteState: true,
      realLocalWorkerProcessesAreSupervised: true,
      offlineBundleVerification: true,
    },
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(
    path.join(buildRoot, "conformance-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  const offline = verifyM5Evidence(buildRoot);
  if (offline.verdict !== "PASS") {
    throw new Error(`offline M5 evidence verification failed: ${offline.failures.join("; ")}`);
  }
  console.log(`M5 resilience verification passed: ${results.length} scenarios`);
}

function buildJava() {
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", [
      "/d", "/s", "/c", "mvnw.cmd -q -pl resilience/java -am package",
    ]);
  } else {
    run("sh", [path.join(root, "mvnw"), "-q", "-pl", "resilience/java", "-am", "package"]);
  }
}

function verifyStaticBoundary() {
  const resilienceRoot = path.join(root, "resilience", "java", "src", "main", "java");
  const semanticRoots = ["api", "core", "evidence", "port"].map((name) =>
    path.join(resilienceRoot, "io", "jpyxis", "resilience", name));
  const semantic = semanticRoots.flatMap(listFiles)
    .filter((file) => file.endsWith(".java"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  for (const [label, pattern] of [
    ["M4 lifecycle implementation", /io\.jpyxis\.lifecycle/],
    ["reference or assembly implementation", /io\.jpyxis\.resilience\.(?:reference|assembly)/],
    ["gRPC", /\bio\.grpc\b/],
    ["generated Protobuf", /\bcom\.google\.protobuf\b/],
    ["Spring", /\borg\.springframework\b/],
    ["Python or Runtime product", /\b(?:python|numpy|onnxruntime|torch)\b/i],
  ]) {
    if (pattern.test(semantic)) throw new Error(`M5 semantic boundary imports ${label}`);
  }

  const core = listFiles(path.join(resilienceRoot, "io", "jpyxis", "resilience", "core"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  if (/com\.fasterxml\.jackson|java\.nio\.file|ProcessBuilder/.test(core)) {
    throw new Error("M5 Core owns an evidence encoding, filesystem, or process implementation");
  }

  for (const frozen of ["invocation", "lifecycle"]) {
    const frozenRoot = path.join(root, frozen, "java", "src", "main", "java");
    const source = listFiles(frozenRoot)
      .filter((file) => file.endsWith(".java"))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    if (/io\.jpyxis\.resilience/.test(source)) {
      throw new Error(`frozen ${frozen} module depends forward on M5 resilience`);
    }
  }
}

function copyArtifacts(bundle) {
  for (const artifact of artifactDefinitions) {
    fs.copyFileSync(artifact.source, path.join(bundle, artifact.file));
  }
}

function writeManifest(bundle, scenario) {
  const requiredFiles = [
    "authoritative-state.json",
    "resilience-events.json",
    "control-state.jsonl",
    "lifecycle-events.json",
    "telemetry-events.json",
    "artifact-v1.py",
    "artifact-v2.py",
  ];
  const manifest = {
    schemaVersion: "jpyxis.io/m5-evidence-bundle/v1alpha1",
    scenarioId: scenario,
    profileScenarioId: scenario,
    createdAt: new Date().toISOString(),
    source: sourceCoordinate(),
    environment: environmentCoordinate(),
    topology: "one Java Control process supervising up to two real local Java worker processes",
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
      fs.rmSync(path.join(bundle, "resilience-events.json"));
    }),
    mutate("journal_truncated", "FAIL", (bundle) => {
      const journal = path.join(bundle, "control-state.jsonl");
      const bytes = fs.readFileSync(journal);
      fs.writeFileSync(journal, bytes.subarray(0, Math.max(1, bytes.length - 17)));
    }),
    mutate("journal_reordered", "FAIL", (bundle) => {
      const journal = path.join(bundle, "control-state.jsonl");
      const lines = fs.readFileSync(journal, "utf8").trimEnd().split(/\r?\n/);
      if (lines.length < 2) throw new Error("reference journal lacks two events");
      [lines[0], lines[1]] = [lines[1], lines[0]];
      fs.writeFileSync(journal, `${lines.join("\n")}\n`);
    }),
    mutate("bundle_corrupt", "FAIL", (bundle) => {
      fs.appendFileSync(path.join(bundle, "artifact-v1.py"), "\n# tampered\n");
    }),
  ];

  function mutate(id, expectedVerdict, action) {
    const target = path.join(runRoot, id);
    fs.cpSync(successBundle, target, { recursive: true });
    fs.rmSync(path.join(target, "verdict.json"), { force: true });
    const manifestPath = path.join(target, "manifest.json");
    const statePath = path.join(target, "authoritative-state.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    manifest.scenarioId = id;
    state.scenarioId = id;
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    const stateEntry = manifest.files.find((item) => item.path === "authoritative-state.json");
    stateEntry.sha256 = digestFile(statePath);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    action(target);
    return { id, expectedVerdict, path: target };
  }
}

function explicitlyUnproven() {
  return [
    "power-loss crash consistency and production durable stores",
    "operating-system or hardware security isolation",
    "arbitrary plugin compatibility",
    "multi-host scheduling and consensus",
    "accelerator support",
    "zero-copy or high-throughput data planes",
    "production telemetry backends",
    "clean-machine reproducibility",
    "performance",
    "production readiness",
    "business transaction success",
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

function assertSafeBuildRoot() {
  const expected = path.resolve(root, "build", "m5");
  if (path.resolve(buildRoot) !== expected || path.dirname(buildRoot) !== path.resolve(root, "build")) {
    throw new Error(`refusing to clean unexpected build root: ${buildRoot}`);
  }
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
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

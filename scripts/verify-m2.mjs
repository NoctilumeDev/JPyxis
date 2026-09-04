import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { verifyBundle } from "./verify-m2-bundle.mjs";

const root = process.cwd();
const buildRoot = path.join(root, "build", "m2");
const venv = path.join(buildRoot, "venv");
const generatedPython = path.join(buildRoot, "generated", "python");
const runRoot = path.join(buildRoot, "runs");
const contractSource = path.join(root, "spec", "m1", "contracts", "example.affine-batch.v1.json");
const identityLock = readJson(path.join(root, "spec", "m1", "identity.lock.json"));
const normalDefinition = path.join(root, "spec", "m2", "definitions", "example_affine_v1.py");
const brokenDefinition = path.join(root, "spec", "m2", "fixtures", "broken_definition.py");
const definitionIdentity = "jpyxis:definition:example/affine-batch@1.0.0";
const brokenDefinitionIdentity = "jpyxis:definition:example/broken-affine@1.0.0";
const javaJar = path.join(root, "invocation", "java", "target", "jpyxis-invocation-java.jar");
const basePython = process.env.JPYXIS_PYTHON || (process.platform === "win32" ? "python" : "python3");
const venvPython = process.platform === "win32"
  ? path.join(venv, "Scripts", "python.exe")
  : path.join(venv, "bin", "python");

const scenarios = [
  scenario("success_exact", "success_exact.json", { state: "SUCCEEDED", code: "OK" }),
  scenario("bad_rank", "bad_rank.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "TENSOR_RANK_MISMATCH", noWorkerRequest: true,
  }),
  scenario("bad_shape", "bad_shape.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "TENSOR_SHAPE_MISMATCH", noWorkerRequest: true,
  }),
  scenario("bad_dtype", "bad_dtype.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "TENSOR_DTYPE_MISMATCH", noWorkerRequest: true,
  }),
  scenario("bad_batch_bound", "bad_batch_bound.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "TENSOR_DIMENSION_OUT_OF_RANGE", noWorkerRequest: true,
  }),
  scenario("bad_non_finite_scalar", "bad_non_finite_scalar.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "VALUE_NON_FINITE", noWorkerRequest: true,
  }),
  scenario("malformed_output", "success_exact.json", {
    state: "FAILED", category: "INVOCATION_FAULT", code: "OUTPUT_REJECTED",
  }, { faultMode: "malformed_output" }),
  scenario("definition_failure", "success_exact.json", {
    state: "FAILED", category: "DEFINITION_FAULT", code: "DEFINITION_PREPARATION_FAILED",
  }, { definition: brokenDefinition, definitionIdentity: brokenDefinitionIdentity }),
  scenario("definition_identity_mismatch", "success_exact.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "WORKER_CONTRACT_REJECTED",
  }, { workerDefinitionIdentity: "jpyxis:definition:example/not-selected@1.0.0" }),
  scenario("invalid_worker_failure", "success_exact.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "WORKER_FAILURE_ENVELOPE_INVALID",
  }, { faultMode: "invalid_failure" }),
  scenario("worker_coordinate_mismatch", "success_exact.json", {
    state: "FAILED", category: "CONTRACT_FAULT", code: "WORKER_COORDINATE_MISMATCH",
  }, { faultMode: "mismatched_coordinates", allowRawCoordinateMismatch: true }),
  scenario("worker_unavailable", "success_exact.json", {
    state: "FAILED", category: "TRANSPORT_FAULT", code: "WORKER_UNAVAILABLE",
  }, { startWorker: false }),
  scenario("transport_interrupted", "success_exact.json", {
    state: "FAILED", category: "TRANSPORT_FAULT", code: "TRANSPORT_INTERRUPTED",
  }, { faultMode: "terminate" }),
  scenario("runtime_failure", "success_exact.json", {
    state: "FAILED", category: "RUNTIME_FAULT", code: "RUNTIME_EXECUTION_FAILED",
  }, { faultMode: "runtime_failure" }),
  scenario("deadline_before_dispatch", "success_exact.json", {
    state: "TIMED_OUT", category: "INVOCATION_FAULT", code: "DEADLINE_EXCEEDED", noWorkerRequest: true,
  }, { timeoutMs: 0 }),
  scenario("deadline_during_execution", "success_exact.json", {
    state: "TIMED_OUT", category: "INVOCATION_FAULT", code: "DEADLINE_EXCEEDED",
  }, { timeoutMs: 1500, delayMs: 2500, postWaitMs: 1300 }),
  scenario("cancel_late_result", "success_exact.json", {
    state: "CANCELLED", category: "INVOCATION_FAULT", code: "CANCELLED_BY_CALLER",
  }, { timeoutMs: 5000, cancelAfterMs: 1500, delayMs: 3000, postWaitMs: 1800 }),
  scenario("recorder_failure", "success_exact.json", {
    state: "SUCCEEDED", code: "OK",
  }, { recorderFailure: true, expectedVerdict: "INCONCLUSIVE" }),
];

await main();

async function main() {
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.rmSync(generatedPython, { recursive: true, force: true });
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.mkdirSync(generatedPython, { recursive: true });
  fs.mkdirSync(runRoot, { recursive: true });

  preparePython();
  generatePythonCarrier();
  buildJava();

  const results = [];
  for (const item of scenarios) {
    const result = await runScenario(item);
    results.push({ id: item.id, verdict: result.verdict, state: result.invocationOutcomeSnapshot?.state });
    if (result.verdict !== item.expectedVerdict) {
      throw new Error(`${item.id}: expected acceptance ${item.expectedVerdict}, got ${result.verdict}`);
    }
    console.log(`${item.id}: ${result.verdict} (${result.invocationOutcomeSnapshot?.state})`);
  }

  const mutations = makeMutationBundles(path.join(runRoot, "success_exact"));
  for (const mutation of mutations) {
    const result = verifyBundle(mutation.path);
    results.push({ id: mutation.id, verdict: result.verdict, state: result.invocationOutcomeSnapshot?.state });
    if (result.verdict !== mutation.expectedVerdict) {
      throw new Error(`${mutation.id}: expected ${mutation.expectedVerdict}, got ${result.verdict}`);
    }
    console.log(`${mutation.id}: ${result.verdict} (tamper fixture)`);
  }

  verifyVerifierFailureLeavesOutcomeUntouched(path.join(runRoot, "success_exact"));
  results.push({ id: "verifier_failure", verdict: "INCONCLUSIVE", state: "SUCCEEDED" });

  const summary = {
    schemaVersion: "jpyxis.io/m2-conformance-summary/v1alpha1",
    evidenceState: "PROTOTYPE",
    scenarioCount: results.length,
    executableScenarios: scenarios.length,
    mutationScenarios: mutations.length,
    verifierFailureScenarios: 1,
    results,
    assertions: {
      crossProcessInvocation: true,
      typedHostBoundary: true,
      oneAuthoritativeTerminalState: true,
      stableFailureCategories: true,
      lateResultCannotRewriteTerminal: true,
      offlineBundleVerification: true,
      tamperCannotPass: true,
    },
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(
    path.join(buildRoot, "conformance-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(`M2 invocation verification passed: ${results.length} scenarios`);
}

function scenario(id, input, expected, overrides = {}) {
  return {
    id,
    input: path.join(root, "spec", "m2", "cases", input),
    expected,
    definition: normalDefinition,
    definitionIdentity,
    workerDefinitionIdentity: null,
    startWorker: true,
    faultMode: "normal",
    delayMs: 0,
    timeoutMs: 3000,
    cancelAfterMs: -1,
    postWaitMs: 100,
    recorderFailure: false,
    allowRawCoordinateMismatch: false,
    expectedVerdict: "PASS",
    ...overrides,
  };
}

function preparePython() {
  if (!fs.existsSync(venvPython)) {
    run(basePython, ["-m", "venv", venv]);
  }
  run(venvPython, [
    "-m", "pip", "install", "--disable-pip-version-check", "-q", "-r",
    path.join(root, "invocation", "python", "requirements-m2.txt"),
  ]);
  run(venvPython, ["-m", "pip", "check"]);
}

function generatePythonCarrier() {
  run(venvPython, [
    "-m", "grpc_tools.protoc",
    "-I", path.join(root, "spec", "m2", "proto"),
    `--python_out=${generatedPython}`,
    `--grpc_python_out=${generatedPython}`,
    path.join(root, "spec", "m2", "proto", "jpyxis_invocation_v1.proto"),
  ]);
}

function buildJava() {
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", [
      "/d", "/s", "/c", "mvnw.cmd -q -pl invocation/java -am package",
    ]);
  } else {
    run("sh", [path.join(root, "mvnw"), "-q", "-pl", "invocation/java", "-am", "package"]);
  }
}

async function runScenario(item) {
  const bundle = path.join(runRoot, item.id);
  fs.mkdirSync(bundle, { recursive: true });
  const port = await reservePort();
  const workerObservations = path.join(bundle, "worker-observations.jsonl");
  const hostObservations = item.recorderFailure
    ? path.join(bundle, "blocked-parent", "host-observations.jsonl")
    : path.join(bundle, "host-observations.jsonl");
  if (item.recorderFailure) {
    fs.writeFileSync(path.join(bundle, "blocked-parent"), "intentional recorder failure fixture\n");
  }
  let worker = null;
  let javaResult;
  try {
    if (item.startWorker) {
      worker = startWorker(item, port, workerObservations, bundle);
      await waitForWorker(workerObservations, worker);
    } else {
      fs.writeFileSync(workerObservations, "");
    }

    javaResult = spawnSync("java", [
      "-jar", javaJar,
      "--port", String(port),
      "--contract", contractSource,
      "--definition", item.definition,
      "--definition-identity", item.definitionIdentity,
      "--input", item.input,
      "--host-observations", hostObservations,
      "--outcome", path.join(bundle, "authoritative-outcome.json"),
      "--raw-report", path.join(bundle, "raw-worker-report.json"),
      "--timeout-ms", String(item.timeoutMs),
      "--cancel-after-ms", String(item.cancelAfterMs),
    ], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    if (javaResult.error) throw javaResult.error;
    if (javaResult.status !== 0) {
      throw new Error(`${item.id}: Java client exited ${javaResult.status}: ${javaResult.stderr}`);
    }

    if (item.postWaitMs > 0) await wait(item.postWaitMs);
  } finally {
    if (worker) await stopWorker(worker);
  }
  fs.writeFileSync(path.join(bundle, "host.stdout"), javaResult.stdout ?? "");
  fs.writeFileSync(path.join(bundle, "host.stderr"), javaResult.stderr ?? "");
  if (!fs.existsSync(workerObservations)) fs.writeFileSync(workerObservations, "");

  fs.copyFileSync(contractSource, path.join(bundle, "contract.json"));
  fs.copyFileSync(item.definition, path.join(bundle, "definition-artifact.py"));
  fs.copyFileSync(item.input, path.join(bundle, "request.json"));
  const outcome = readJson(path.join(bundle, "authoritative-outcome.json"));
  const rawReport = readJson(path.join(bundle, "raw-worker-report.json"));
  const oracle = makeOracle(item, readJson(item.input), outcome);
  fs.writeFileSync(path.join(bundle, "oracle.json"), `${JSON.stringify(oracle, null, 2)}\n`);

  const requiredFiles = [
    "contract.json",
    "definition-artifact.py",
    "request.json",
    "host-observations.jsonl",
    "worker-observations.jsonl",
    "raw-worker-report.json",
    "authoritative-outcome.json",
    "oracle.json",
  ];
  const manifest = {
    schemaVersion: "jpyxis.io/m2-evidence-bundle/v1alpha1",
    scenarioId: item.id,
    createdAt: new Date().toISOString(),
    source: sourceCoordinate(),
    build: { javaJarDigest: digestFile(javaJar) },
    environment: environmentCoordinate(),
    dependencies: {
      grpcJava: "1.83.1",
      protobufJava: "4.36.1",
      grpcPython: "1.83.1",
      protobufPython: "7.35.1",
      numpy: "2.2.6",
    },
    launch: {
      topology: "one Java process and one Python worker process on loopback",
      javaEntryPoint: "java -jar invocation/java/target/jpyxis-invocation-java.jar",
      pythonEntryPoint: "python -m jpyxis_worker",
      containerRequired: false,
    },
    contract: {
      identity: identityLock.contractIdentity,
      digest: identityLock.contractDigest,
      file: "contract.json",
    },
    definition: {
      identity: item.definitionIdentity,
      digest: digestFile(item.definition),
      file: "definition-artifact.py",
    },
    capabilities: {
      transport: "grpc.loopback",
      carrier: "protobuf.jpyxis.invocation.v1",
      definition: "python.static-artifact",
      runtime: rawReport.runtimeIdentity ?? "numpy.cpu",
      runtimeVersion: rawReport.runtimeVersion ?? "2.2.6",
    },
    coordinates: outcome.coordinates,
    expected: item.expected,
    allowRawCoordinateMismatch: item.allowRawCoordinateMismatch,
    evidenceComplete: requiredFiles.every((file) => fs.existsSync(path.join(bundle, file))),
    files: requiredFiles.map((file) => ({
      path: file,
      required: true,
      sha256: fs.existsSync(path.join(bundle, file)) && fs.statSync(path.join(bundle, file)).isFile()
        ? digestFile(path.join(bundle, file))
        : null,
    })),
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(path.join(bundle, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyBundle(bundle);
}

function startWorker(item, port, observations, bundle) {
  const stdout = fs.openSync(path.join(bundle, "worker.stdout"), "w");
  const stderr = fs.openSync(path.join(bundle, "worker.stderr"), "w");
  const pythonPath = [
    path.join(root, "bindings", "python"),
    path.join(root, "invocation", "python"),
    generatedPython,
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter);
  const child = spawn(venvPython, [
    "-m", "jpyxis_worker",
    "--port", String(port),
    "--contract", contractSource,
    "--definition", item.definition,
    "--definition-identity", item.workerDefinitionIdentity ?? item.definitionIdentity,
    "--observations", observations,
    "--fault-mode", item.faultMode,
    "--delay-ms", String(item.delayMs),
  ], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: pythonPath },
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  return child;
}

async function waitForWorker(observations, worker) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error(`worker exited before readiness: ${worker.exitCode}`);
    if (fs.existsSync(observations)
        && fs.readFileSync(observations, "utf8").includes("WORKER_LISTENING")) {
      await wait(50);
      return;
    }
    await wait(50);
  }
  throw new Error("worker did not become ready within 10 seconds");
}

async function stopWorker(worker) {
  if (worker.exitCode !== null) return;
  worker.kill();
  const deadline = Date.now() + 3000;
  while (worker.exitCode === null && Date.now() < deadline) await wait(25);
  if (worker.exitCode === null) worker.kill("SIGKILL");
}

function makeOracle(item, request, outcome) {
  const observedMatchesExpected = outcome.state === item.expected.state
    && (outcome.failure?.category ?? null) === (item.expected.category ?? null)
    && (outcome.failure?.code ?? "OK") === item.expected.code;
  const oracle = {
    schemaVersion: "jpyxis.io/m2-oracle/v1alpha1",
    oracleIdentity: "jpyxis.m2.affine-exact.v1",
    scenarioId: item.id,
    expectedInvocation: item.expected,
    comparisonPolicy: outcome.state === "SUCCEEDED"
      ? "EXACT_FLOAT32"
      : "EXPECTED_TERMINAL_AND_BOUNDARY_EVIDENCE",
    matchesObserved: observedMatchesExpected,
    verdict: observedMatchesExpected ? "PASS" : "FAIL",
  };
  if (outcome.state === "SUCCEEDED") {
    const scale = Math.fround(request.scale);
    const bias = Math.fround(request.bias);
    oracle.expectedResult = {
      rows: request.values.shape[0],
      values: {
        dtype: "float32",
        shape: request.values.shape,
        layout: "ROW_MAJOR",
        values: request.values.values.map((value) =>
          Math.fround(Math.fround(Math.fround(value) * scale) + bias)),
      },
    };
    oracle.matchesObserved = oracle.matchesObserved
      && isDeepStrictEqual(oracle.expectedResult, outcome.result);
    oracle.verdict = oracle.matchesObserved ? "PASS" : "FAIL";
  }
  return oracle;
}

function makeMutationBundles(successBundle) {
  const mutations = [];

  mutations.push(mutate("bundle_missing", "INCONCLUSIVE", (bundle) => {
    fs.rmSync(path.join(bundle, "raw-worker-report.json"));
  }));
  mutations.push(mutate("bundle_truncated", "INCONCLUSIVE", (bundle, manifest) => {
    fs.writeFileSync(path.join(bundle, "host-observations.jsonl"), "{\"schemaVersion\":");
    updateFileDigest(manifest, bundle, "host-observations.jsonl");
  }));
  mutations.push(mutate("bundle_reordered", "FAIL", (bundle, manifest) => {
    const file = path.join(bundle, "host-observations.jsonl");
    const lines = fs.readFileSync(file, "utf8").trimEnd().split(/\r?\n/);
    [lines[0], lines[1]] = [lines[1], lines[0]];
    fs.writeFileSync(file, `${lines.join("\n")}\n`);
    updateFileDigest(manifest, bundle, "host-observations.jsonl");
  }));
  mutations.push(mutate("bundle_corrupt", "FAIL", (bundle) => {
    fs.appendFileSync(path.join(bundle, "definition-artifact.py"), "\n# tampered\n");
  }));
  mutations.push(mutate("bundle_conflicting", "FAIL", (bundle, manifest) => {
    const file = path.join(bundle, "authoritative-outcome.json");
    const outcome = readJson(file);
    outcome.coordinates.traceId = "trc-conflicting-evidence";
    fs.writeFileSync(file, `${JSON.stringify(outcome, null, 2)}\n`);
    updateFileDigest(manifest, bundle, "authoritative-outcome.json");
  }));
  return mutations;

  function mutate(id, expectedVerdict, action) {
    const bundle = path.join(runRoot, id);
    fs.cpSync(successBundle, bundle, { recursive: true });
    fs.rmSync(path.join(bundle, "verdict.json"), { force: true });
    const manifestPath = path.join(bundle, "manifest.json");
    const manifest = readJson(manifestPath);
    manifest.scenarioId = id;
    action(bundle, manifest);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return { id, expectedVerdict, path: bundle };
  }
}

function updateFileDigest(manifest, bundle, relative) {
  const entry = manifest.files.find((item) => item.path === relative);
  entry.sha256 = digestFile(path.join(bundle, relative));
}

function verifyVerifierFailureLeavesOutcomeUntouched(successBundle) {
  const outcome = path.join(successBundle, "authoritative-outcome.json");
  const before = digestFile(outcome);
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-m2-bundle.mjs"),
    path.join(runRoot, "does-not-exist"),
  ], { cwd: root, encoding: "utf8" });
  if (result.status === 0) throw new Error("verifier failure fixture unexpectedly passed");
  if (digestFile(outcome) !== before) throw new Error("verifier failure rewrote invocation evidence");
  fs.rmSync(path.join(runRoot, "does-not-exist"), { recursive: true, force: true });
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
    python: capture(venvPython, ["--version"], true),
    node: process.version,
  };
}

function explicitlyUnproven() {
  return [
    "general runtime replaceability",
    "deployment lifecycle",
    "retry safety",
    "multi-worker routing",
    "durable recovery",
    "performance",
    "production readiness",
    "security isolation",
    "accelerator support",
    "multi-host behavior",
    "clean-machine reproducibility",
    "business success",
  ];
}

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

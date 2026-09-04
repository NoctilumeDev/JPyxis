import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { verifyM3Bundle } from "./verify-m3-bundle.mjs";
import { verifyM3Evidence } from "./verify-m3-evidence.mjs";

const root = process.cwd();
const buildRoot = path.join(root, "build", "m3");
const venv = path.join(buildRoot, "venv");
const generatedPython = path.join(buildRoot, "generated", "python");
const runRoot = path.join(buildRoot, "runs");
const contractSource = path.join(root, "spec", "m1", "contracts", "example.affine-batch.v1.json");
const definitionSource = path.join(root, "spec", "m3", "definitions", "example_affine_plan_v1.py");
const definitionIdentity = "jpyxis:definition:example/affine-batch-plan@1.0.0";
const javaJar = path.join(root, "invocation", "java", "target", "jpyxis-invocation-java.jar");
const basePython = process.env.JPYXIS_PYTHON || (process.platform === "win32" ? "python" : "python3");
const venvPython = process.platform === "win32"
  ? path.join(venv, "Scripts", "python.exe")
  : path.join(venv, "bin", "python");

const cases = {
  exact: path.join(root, "spec", "m2", "cases", "success_exact.json"),
  fractional: path.join(root, "spec", "m3", "cases", "single_row_fractional.json"),
};
const scenarios = [
  scenario("numpy_exact", "numpy.cpu", cases.exact, success()),
  scenario("reference_exact", "python.reference", cases.exact, success()),
  scenario("numpy_fractional", "numpy.cpu", cases.fractional, success()),
  scenario("reference_fractional", "python.reference", cases.fractional, success()),
  scenario("numpy_runtime_failure", "numpy.cpu", cases.exact, runtimeFailure(), "runtime_failure"),
  scenario("reference_runtime_failure", "python.reference", cases.exact, runtimeFailure(), "runtime_failure"),
  scenario(
    "incompatible_capability",
    "numpy.cpu",
    cases.exact,
    {
      state: "FAILED",
      category: "RUNTIME_FAULT",
      code: "RUNTIME_CAPABILITY_UNSUPPORTED",
      noDispatch: true,
    },
    "incompatible_capability",
  ),
  scenario(
    "runtime_binding_mismatch",
    "python.reference",
    cases.exact,
    { state: "FAILED", category: "RUNTIME_FAULT", code: "RUNTIME_BINDING_MISMATCH" },
    "runtime_binding_mismatch",
  ),
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
  verifyStaticBoundary();
  runPythonConformance();

  const results = [];
  const outcomes = new Map();
  for (const item of scenarios) {
    const verified = await runScenario(item);
    if (verified.verdict !== "PASS") {
      throw new Error(`${item.id}: expected PASS, got ${verified.verdict}: ${verified.failures.join("; ")}`);
    }
    const outcome = readJson(path.join(runRoot, item.id, "authoritative-outcome.json"));
    outcomes.set(item.id, outcome);
    results.push({
      id: item.id,
      runtimeIdentity: item.runtimeIdentity,
      verdict: verified.verdict,
      state: outcome.state,
      code: outcome.failure?.code ?? "OK",
    });
    console.log(`${item.id}: ${verified.verdict} (${outcome.state})`);
  }

  comparePair(outcomes, "numpy_exact", "reference_exact");
  comparePair(outcomes, "numpy_fractional", "reference_fractional");
  compareFailurePair(outcomes, "numpy_runtime_failure", "reference_runtime_failure");

  const mutations = makeMutations(path.join(runRoot, "numpy_exact"));
  for (const mutation of mutations) {
    const result = verifyM3Bundle(mutation.path);
    if (result.verdict !== mutation.expectedVerdict) {
      throw new Error(`${mutation.id}: expected ${mutation.expectedVerdict}, got ${result.verdict}`);
    }
    results.push({ id: mutation.id, runtimeIdentity: "numpy.cpu", verdict: result.verdict });
    console.log(`${mutation.id}: ${result.verdict} (evidence mutation)`);
  }

  const summary = {
    schemaVersion: "jpyxis.io/m3-conformance-summary/v1alpha1",
    evidenceState: "PROTOTYPE",
    scenarioCount: results.length,
    executableScenarios: scenarios.length,
    mutationScenarios: mutations.length,
    runtimeFixtures: ["numpy.cpu", "python.reference"],
    results,
    assertions: {
      sameHostContract: true,
      sameDefinitionPlan: true,
      exactCrossRuntimeAgreement: true,
      stableCrossRuntimeFailureMeaning: true,
      capabilityMismatchFailsBeforeDispatch: true,
      bindingMismatchFailsBeforeRuntimeStart: true,
      runtimeNativeValuesRemainInProviders: true,
      offlineBundleVerification: true,
    },
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(
    path.join(buildRoot, "conformance-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  const offline = verifyM3Evidence(buildRoot);
  if (offline.verdict !== "PASS") throw new Error("offline M3 evidence verification did not pass");
  console.log(`M3 runtime verification passed: ${results.length} scenarios`);
}

function scenario(id, runtimeIdentity, input, expected, faultMode = "normal") {
  return { id, runtimeIdentity, input, expected, faultMode };
}

function success() {
  return { state: "SUCCEEDED", code: "OK" };
}

function runtimeFailure() {
  return { state: "FAILED", category: "RUNTIME_FAULT", code: "RUNTIME_EXECUTION_FAILED" };
}

function preparePython() {
  if (!fs.existsSync(venvPython)) run(basePython, ["-m", "venv", venv]);
  run(venvPython, [
    "-m", "pip", "install", "--disable-pip-version-check", "-q", "-r",
    path.join(root, "invocation", "python", "requirements-m3.txt"),
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

function runPythonConformance() {
  run(venvPython, [
    "-m", "unittest", "discover", "-s", path.join(root, "invocation", "python", "tests"), "-v",
  ], pythonEnvironment());
}

function verifyStaticBoundary() {
  const neutralFiles = [
    path.join(root, "invocation", "python", "jpyxis_worker", "runtime_spi.py"),
    path.join(root, "invocation", "python", "jpyxis_worker", "m3_server.py"),
    definitionSource,
    path.join(root, "invocation", "java", "src", "main", "java", "io", "jpyxis", "invocation", "InvocationManager.java"),
  ];
  const neutral = neutralFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n").toLowerCase();
  for (const forbidden of ["numpy.cpu", "python.reference", "import numpy", "from numpy"]) {
    if (neutral.includes(forbidden)) throw new Error(`runtime-specific value leaked into neutral boundary: ${forbidden}`);
  }
  const providerFiles = [
    path.join(root, "invocation", "python", "jpyxis_worker", "runtimes", "numpy_runtime.py"),
    path.join(root, "invocation", "python", "jpyxis_worker", "runtimes", "reference_runtime.py"),
  ];
  for (const file of providerFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (source.includes("jpyxis_invocation_v1_pb2") || source.includes("io.jpyxis.host")) {
      throw new Error(`provider imports an outer carrier or host type: ${file}`);
    }
  }
}

async function runScenario(item) {
  const bundle = path.join(runRoot, item.id);
  fs.mkdirSync(bundle, { recursive: true });
  const port = await reservePort();
  const workerObservations = path.join(bundle, "worker-observations.jsonl");
  const hostObservations = path.join(bundle, "host-observations.jsonl");
  const worker = startWorker(item, port, workerObservations, bundle);
  let javaResult;
  try {
    await waitForWorker(workerObservations, worker);
    javaResult = spawnSync("java", [
      "-jar", javaJar,
      "--port", String(port),
      "--contract", contractSource,
      "--definition", definitionSource,
      "--definition-identity", definitionIdentity,
      "--input", item.input,
      "--host-observations", hostObservations,
      "--outcome", path.join(bundle, "authoritative-outcome.json"),
      "--raw-report", path.join(bundle, "raw-worker-report.json"),
      "--timeout-ms", "3000",
    ], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    if (javaResult.error) throw javaResult.error;
    if (javaResult.status !== 0) {
      throw new Error(`${item.id}: Java exited ${javaResult.status}: ${javaResult.stderr}`);
    }
  } finally {
    await stopWorker(worker);
  }

  fs.writeFileSync(path.join(bundle, "host.stdout"), javaResult.stdout ?? "");
  fs.writeFileSync(path.join(bundle, "host.stderr"), javaResult.stderr ?? "");
  fs.copyFileSync(contractSource, path.join(bundle, "contract.json"));
  fs.copyFileSync(definitionSource, path.join(bundle, "definition-artifact.py"));
  fs.copyFileSync(item.input, path.join(bundle, "request.json"));

  const outcome = readJson(path.join(bundle, "authoritative-outcome.json"));
  const rawReport = readJson(path.join(bundle, "raw-worker-report.json"));
  const host = readJsonLines(hostObservations);
  const capabilityEvent = host.find((event) =>
    event.event === "RUNTIME_CAPABILITY_RESOLVED" || event.event === "RUNTIME_CAPABILITY_REJECTED");
  if (!capabilityEvent) throw new Error(`${item.id}: capability observation is missing`);
  const runtime = {
    runtimeIdentity: capabilityEvent.details.runtimeIdentity,
    runtimeVersion: capabilityEvent.details.runtimeVersion,
    capabilityIdentity: capabilityEvent.details.capabilityIdentity,
    capabilityVersion: capabilityEvent.details.capabilityVersion,
    operationIdentity: capabilityEvent.details.operationIdentity,
  };
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
    schemaVersion: "jpyxis.io/m3-evidence-bundle/v1alpha1",
    scenarioId: item.id,
    createdAt: new Date().toISOString(),
    source: sourceCoordinate(),
    environment: environmentCoordinate(),
    topology: "one Java process and one Python runtime worker on loopback",
    contract: {
      identity: outcome.coordinates.contractIdentity,
      digest: digestCanonicalContract(readJson(contractSource)),
      file: "contract.json",
    },
    definition: { identity: definitionIdentity, digest: digestFile(definitionSource), file: "definition-artifact.py" },
    runtime,
    coordinates: outcome.coordinates,
    expected: item.expected,
    files: requiredFiles.map((file) => ({ path: file, required: true, sha256: digestFile(path.join(bundle, file)) })),
    explicitlyUnproven: explicitlyUnproven(),
  };
  fs.writeFileSync(path.join(bundle, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyM3Bundle(bundle);
}

function startWorker(item, port, observations, bundle) {
  const stdout = fs.openSync(path.join(bundle, "worker.stdout"), "w");
  const stderr = fs.openSync(path.join(bundle, "worker.stderr"), "w");
  const child = spawn(venvPython, [
    "-m", "jpyxis_worker.m3_server",
    "--port", String(port),
    "--contract", contractSource,
    "--definition", definitionSource,
    "--definition-identity", definitionIdentity,
    "--runtime-provider", item.runtimeIdentity,
    "--observations", observations,
    "--fault-mode", item.faultMode,
  ], {
    cwd: root,
    env: pythonEnvironment(),
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  return child;
}

function pythonEnvironment() {
  const pythonPath = [
    path.join(root, "bindings", "python"),
    path.join(root, "invocation", "python"),
    generatedPython,
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter);
  return { ...process.env, PYTHONPATH: pythonPath };
}

function makeOracle(item, request, outcome) {
  const oracle = {
    schemaVersion: "jpyxis.io/m3-oracle/v1alpha1",
    oracleIdentity: "jpyxis.m3.affine-exact.v1",
    expectedInvocation: item.expected,
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
  }
  return oracle;
}

function comparePair(outcomes, left, right) {
  if (!isDeepStrictEqual(outcomes.get(left).result, outcomes.get(right).result)) {
    throw new Error(`${left} and ${right} produced different typed results`);
  }
}

function compareFailurePair(outcomes, left, right) {
  const select = (outcome) => ({ category: outcome.failure?.category, code: outcome.failure?.code });
  if (!isDeepStrictEqual(select(outcomes.get(left)), select(outcomes.get(right)))) {
    throw new Error(`${left} and ${right} changed public runtime failure meaning`);
  }
}

function makeMutations(successBundle) {
  return [
    mutate("bundle_missing", "INCONCLUSIVE", (bundle) => {
      fs.rmSync(path.join(bundle, "raw-worker-report.json"));
    }),
    mutate("bundle_corrupt", "FAIL", (bundle) => {
      fs.appendFileSync(path.join(bundle, "definition-artifact.py"), "\n# tampered\n");
    }),
  ];

  function mutate(id, expectedVerdict, action) {
    const target = path.join(runRoot, id);
    fs.cpSync(successBundle, target, { recursive: true });
    fs.rmSync(path.join(target, "verdict.json"), { force: true });
    const manifest = readJson(path.join(target, "manifest.json"));
    manifest.scenarioId = id;
    fs.writeFileSync(path.join(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    action(target);
    return { id, expectedVerdict, path: target };
  }
}

async function waitForWorker(observations, worker) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error(`worker exited before readiness: ${worker.exitCode}`);
    if (fs.existsSync(observations) && fs.readFileSync(observations, "utf8").includes("WORKER_LISTENING")) {
      await wait(50);
      return;
    }
    await wait(50);
  }
  throw new Error("M3 worker did not become ready within 10 seconds");
}

async function stopWorker(worker) {
  if (worker.exitCode !== null) return;
  worker.kill();
  const deadline = Date.now() + 3000;
  while (worker.exitCode === null && Date.now() < deadline) await wait(25);
  if (worker.exitCode === null) worker.kill("SIGKILL");
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
    "arbitrary third-party plugin compatibility",
    "dynamic plugin installation",
    "general operation portability",
    "deployment lifecycle",
    "multi-worker routing",
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

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function capture(command, args, includeStderr = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
  return `${result.stdout ?? ""}${includeStderr ? result.stderr ?? "" : ""}`.trim();
}

function digestCanonicalContract(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonLines(file) {
  const content = fs.readFileSync(file, "utf8").trim();
  return content ? content.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

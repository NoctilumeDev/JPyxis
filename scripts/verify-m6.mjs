import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { verifyBundle as verifyM2Bundle } from "./verify-m2-bundle.mjs";
import { verifyM3Evidence } from "./verify-m3-evidence.mjs";
import { verifyM4Evidence } from "./verify-m4-evidence.mjs";
import { verifyM5Evidence } from "./verify-m5-evidence.mjs";
import { verifyM6Evidence } from "./verify-m6-evidence.mjs";

const root = process.cwd();
const buildRoot = path.join(root, "build", "m6");
const bundleRoot = path.join(buildRoot, "bundle");
const logRoot = path.join(buildRoot, "logs");
const mutationRoot = path.join(buildRoot, "mutations");
const cacheRoot = path.join(buildRoot, "cache");
const publicClean = process.argv.includes("--public-clean");
const phaseJournal = [];
const phaseMetrics = [];

await main();

async function main() {
  assertRepositoryRoot();
  const sourceAtStart = captureSourceAtStart();
  assertPublicCoordinate(sourceAtStart);
  cleanGeneratedOutputs();
  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.mkdirSync(logRoot, { recursive: true });
  fs.mkdirSync(cacheRoot, { recursive: true });

  const isolatedEnvironment = {
    ...process.env,
    MAVEN_USER_HOME: path.join(cacheRoot, "maven-user-home"),
    MAVEN_OPTS: [process.env.MAVEN_OPTS, `-Dmaven.repo.local=${path.join(cacheRoot, "maven-repository")}`]
      .filter(Boolean).join(" "),
    PIP_NO_CACHE_DIR: "1",
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
    PYTHONDONTWRITEBYTECODE: "1",
  };

  await internalPhase("source_check", "git immutable-coordinate and clean-start inspection", () => {
    if (!/^[0-9a-f]{40}$/.test(sourceAtStart.revision)) throw new Error("HEAD is not an immutable SHA");
    if (!/^[0-9a-f]{40}$/.test(sourceAtStart.tree)) throw new Error("HEAD tree is not immutable");
  });

  let environment;
  let dependencies;
  await internalPhase("bootstrap", "record toolchain and isolated dependency inputs", () => {
    environment = captureEnvironment(isolatedEnvironment);
    dependencies = captureDependencies();
  });

  await commandPhase(
    "clean_build",
    process.platform === "win32" ? "mvnw.cmd -q clean package -DskipTests" : "./mvnw -q clean package -DskipTests",
    mavenCommand(["-q", "clean", "package", "-DskipTests"]),
    isolatedEnvironment,
  );
  await nodePhase("contract_conformance", "scripts/verify-m1.mjs", isolatedEnvironment);
  await nodePhase("invocation_success_and_failure", "scripts/verify-m2.mjs", isolatedEnvironment);
  await nodePhase("runtime_replacement", "scripts/verify-m3.mjs", isolatedEnvironment);
  await nodePhase("lifecycle_register_load_warm_activate", "scripts/verify-m4.mjs", isolatedEnvironment);
  await nodePhase("resilience_failure_and_recovery", "scripts/verify-m5.mjs", isolatedEnvironment);
  await nodePhase("resource_observation", "scripts/m6-resource-probe.mjs", isolatedEnvironment);

  await internalPhase("rollback_and_final_state", "verify retained rollback and restart-final-state scenarios", () => {
    assertScenarioVerdict(path.join(root, "build", "m4", "conformance-summary.json"), "rollback_immutable", "PASS");
    assertScenarioVerdict(path.join(root, "build", "m5", "conformance-summary.json"), "restart_reconciles_and_retries", "PASS");
  });

  let shutdown;
  await internalPhase("runtime_shutdown", "verify every resource-probe runtime identity has stopped", () => {
    const probe = readJson(path.join(buildRoot, "resource-probe", "resource-probe.json"));
    const recorded = probe.shutdown?.recordedProcessIds ?? [];
    const live = recorded.filter(isProcessAlive);
    shutdown = {
      schemaVersion: "jpyxis.io/m6-runtime-shutdown/v1alpha1",
      observedAt: new Date().toISOString(),
      recordedProcessIds: recorded,
      liveRecordedProcesses: live,
      allRuntimeProcessesStopped: live.length === 0 && probe.shutdown?.allRuntimeProcessesStopped === true,
      authority: "host process identity observation after resource probe",
    };
    if (!shutdown.allRuntimeProcessesStopped) throw new Error(`runtime processes remain live: ${live.join(", ")}`);
  });

  await internalPhase("offline_predecessor_verification", "copy, digest, and independently verify M1-M5 retained evidence", () => {
    copyPredecessorEvidence();
    verifyPredecessorEvidence();
  });

  writeJson(path.join(bundleRoot, "source.json"), sourceRecord(sourceAtStart));
  writeJson(path.join(bundleRoot, "environment.json"), environment);
  writeJson(path.join(bundleRoot, "dependencies.json"), dependencies);
  writeJson(path.join(bundleRoot, "runtime-shutdown.json"), shutdown);
  writeJson(path.join(bundleRoot, "resource-observations.json"), resourceObservations());
  writeJson(path.join(bundleRoot, "reproduction-summary.json"), reproductionSummary());
  writePredecessorIndex();
  writePhaseJournal();
  writeManifest(sourceAtStart.revision);

  await internalPhase("m6_offline_verification", "node scripts/verify-m6-evidence.mjs --preflight build/m6/bundle", () => {
    const preflight = verifyM6Evidence(bundleRoot, { preflight: true });
    assertExpectedBaseline(preflight, "preflight");
  });
  writePhaseJournal();
  writeManifest(sourceAtStart.revision);

  const baseline = verifyM6Evidence(bundleRoot);
  assertExpectedBaseline(baseline, "final");
  const mutations = verifyMutations(sourceAtStart.revision);
  const summary = {
    schemaVersion: "jpyxis.io/m6-conformance-summary/v1alpha1",
    evidenceState: "CANDIDATE",
    sourceRevision: sourceAtStart.revision,
    publicCleanEnvironment: publicClean,
    baselineVerdict: baseline.verdict,
    baselineFailures: baseline.failures,
    baselineIncomplete: baseline.incomplete,
    phaseCount: phaseJournal.length,
    mutationCount: mutations.length,
    mutations,
    sixteenGiBDecision: readJson(path.join(bundleRoot, "resource-observations.json")).sixteenGiBDecision,
    assertions: {
      orderedEndToEndJourney: phaseJournal.length === 13,
      predecessorEvidenceReverifiedOffline: true,
      retainedEvidenceSurvivesRuntimeShutdown: true,
      negativeEvidenceMutationsRejected: mutations.every((item) => item.verdict !== "PASS"),
      acceptanceVerdictOwnedByOfflineVerifier: true,
    },
  };
  writeJson(path.join(buildRoot, "conformance-summary.json"), summary);
  console.log(`M6 reproduction candidate: ${baseline.verdict} (${phaseJournal.length} phases, ${mutations.length} evidence mutations)`);
}

async function nodePhase(phase, script, environment) {
  return commandPhase(phase, `node ${script}`, {
    command: process.execPath,
    args: [path.join(root, script)],
  }, environment);
}

async function internalPhase(phase, command, operation) {
  const startedAt = new Date().toISOString();
  const startedNs = process.hrtime.bigint();
  const before = hostMemory();
  await operation();
  const after = hostMemory();
  const endedAt = new Date().toISOString();
  recordPhase(phase, command, startedAt, endedAt, 0);
  phaseMetrics.push({
    phase,
    durationMillis: nanosToMillis(process.hrtime.bigint() - startedNs),
    peakProcessTreeRssBytes: process.memoryUsage().rss,
    hostSamples: [before, after],
    method: "orchestrator-process observation around an internal deterministic check",
  });
  console.log(`${phase}: PASS`);
}

async function commandPhase(phase, commandIdentity, invocation, environment) {
  const startedAt = new Date().toISOString();
  const startedNs = process.hrtime.bigint();
  const stdoutPath = path.join(logRoot, `${String(phaseJournal.length + 1).padStart(2, "0")}-${phase}.stdout.log`);
  const stderrPath = path.join(logRoot, `${String(phaseJournal.length + 1).padStart(2, "0")}-${phase}.stderr.log`);
  const stdout = fs.openSync(stdoutPath, "w");
  const stderr = fs.openSync(stderrPath, "w");
  const child = spawn(invocation.command, invocation.args, {
    cwd: root,
    env: environment,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  const samples = [];
  const sample = () => samples.push(sampleProcessTree([process.pid, child.pid]));
  sample();
  const timer = setInterval(sample, 100);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  clearInterval(timer);
  sample();
  const endedAt = new Date().toISOString();
  if (exitCode !== 0) {
    const tail = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, "utf8").slice(-4000) : "";
    throw new Error(`${phase} exited ${exitCode}: ${tail}`);
  }
  recordPhase(phase, commandIdentity, startedAt, endedAt, exitCode);
  phaseMetrics.push({
    phase,
    durationMillis: nanosToMillis(process.hrtime.bigint() - startedNs),
    peakProcessTreeRssBytes: Math.max(0, ...samples.map((item) => item.totalRssBytes)),
    hostSamples: samples.map((item) => item.host),
    method: process.platform === "linux"
      ? "100 ms Linux /proc process-tree RSS sampling"
      : "100 ms host-specific known-process RSS sampling",
  });
  console.log(`${phase}: PASS`);
}

function recordPhase(phase, command, startedAt, endedAt, exitCode) {
  phaseJournal.push({
    schemaVersion: "jpyxis.io/m6-phase/v1alpha1",
    sequence: phaseJournal.length + 1,
    phase,
    command,
    startedAt,
    endedAt,
    exitCode,
  });
}

function captureSourceAtStart() {
  const revision = capture("git", ["rev-parse", "HEAD"]);
  const tree = capture("git", ["rev-parse", "HEAD^{tree}"]);
  const dirty = capture("git", ["status", "--porcelain"], true).length > 0;
  const generatedPaths = generatedOutputPaths().filter((entry) => fs.existsSync(entry));
  return { revision, tree, dirty, generatedPaths };
}

function sourceRecord(source) {
  return {
    schemaVersion: "jpyxis.io/m6-source/v1alpha1",
    revision: source.revision,
    tree: source.tree,
    dirtyAtStart: source.dirty,
    generatedResidueAtStart: source.generatedPaths.length > 0,
    generatedResiduePaths: source.generatedPaths.map((entry) => path.relative(root, entry).replaceAll("\\", "/")),
    cleanEnvironment: publicClean ? {
      kind: "github-hosted-fresh-vm",
      githubHosted: true,
      runnerEnvironment: process.env.RUNNER_ENVIRONMENT,
      runnerOs: process.env.RUNNER_OS,
      workflowSha: process.env.GITHUB_SHA,
      dependencyCachesEnabled: false,
      immutableRevision: process.env.GITHUB_SHA === source.revision,
    } : {
      kind: "local-candidate",
      githubHosted: false,
      dependencyCachesEnabled: false,
      immutableRevision: false,
    },
  };
}

function captureEnvironment(environment) {
  return {
    schemaVersion: "jpyxis.io/m6-environment/v1alpha1",
    observedAt: new Date().toISOString(),
    os: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    physicalMemoryBytes: os.totalmem(),
    java: capture("java", ["-version"], true, environment),
    python: capture(process.platform === "win32" ? "python" : "python3", ["--version"], true, environment),
    node: process.version,
    mavenWrapper: captureMavenVersion(environment),
    containerRequired: false,
    topology: "one orchestrator process; bounded Java/Python child processes; no external service",
    measurementMethod: process.platform === "linux"
      ? "Linux /proc plus os/proc/meminfo"
      : "host process identities plus Node OS counters",
  };
}

function captureDependencies() {
  const inputs = [
    "pom.xml",
    ".mvn/wrapper/maven-wrapper.properties",
    "spec/m1/contracts/example.affine-batch.v1.json",
    "spec/m2/proto/jpyxis_invocation_v1.proto",
    "invocation/python/requirements-m2.txt",
    "invocation/python/requirements-m3.txt",
    "spec/m3/definitions/example_affine_plan_v1.py",
  ].map((relative) => ({ path: relative, sha256: digestFile(path.join(root, relative)) }));
  return {
    schemaVersion: "jpyxis.io/m6-dependencies/v1alpha1",
    observedAt: new Date().toISOString(),
    mavenRepositoryIsolated: true,
    mavenRepository: "build/m6/cache/maven-repository",
    pipCacheDisabled: true,
    dependencyCacheRestoredByWorkflow: false,
    inputs,
  };
}

function resourceObservations() {
  const probe = readJson(path.join(buildRoot, "resource-probe", "resource-probe.json"));
  const allHostSamples = phaseMetrics.flatMap((item) => item.hostSamples ?? []).filter(Boolean);
  const minimumAvailableBytes = Math.min(...allHostSamples.map((item) => item.availableBytes).filter(Number.isFinite));
  const swapUsed = allHostSamples
    .filter((item) => Number.isFinite(item.swapTotalBytes) && Number.isFinite(item.swapFreeBytes))
    .map((item) => item.swapTotalBytes - item.swapFreeBytes);
  const swapGrowthBytes = swapUsed.length > 1 ? swapUsed.at(-1) - swapUsed[0] : null;
  const overallPeak = Math.max(...phaseMetrics.map((item) => item.peakProcessTreeRssBytes));
  const startup = probe.startup.map((item) => item.externalMillis);
  const invocation = probe.oneWorkerInvocation.runs.map((item) => item.retainedAcceptanceToTerminalMillis)
    .filter(Number.isFinite);
  const measurementComplete = process.platform === "linux"
    && Number.isFinite(minimumAvailableBytes)
    && Number.isFinite(swapGrowthBytes)
    && probe.complete === true;
  const predicates = [
    predicate("complete-journey", phaseJournal.length >= 12, `${phaseJournal.length} ordered phases completed before final offline verdict`),
    predicate(
      "host-memory-is-16-gib-class",
      os.totalmem() >= 14 * 1024 ** 3 && os.totalmem() <= 18 * 1024 ** 3,
      `${os.totalmem()} physical bytes observed; accepted band is 14-18 GiB`,
    ),
    predicate("process-tree-peak-at-most-12-gib", overallPeak <= 12 * 1024 ** 3, `${overallPeak} bytes observed`),
    predicate("minimum-host-available-at-least-2-gib", minimumAvailableBytes >= 2 * 1024 ** 3, `${minimumAvailableBytes} bytes observed`),
    predicate("no-positive-swap-growth", swapGrowthBytes === 0, `${swapGrowthBytes ?? "unavailable"} bytes observed`),
    predicate("offline-predecessor-evidence-pass", true, "M1-M5 evidence independently verified before this record"),
  ];
  const thresholdsMet = predicates.every((item) => item.observed);
  return {
    schemaVersion: "jpyxis.io/m6-resource-observations/v1alpha1",
    observedAt: new Date().toISOString(),
    method: "bounded child-process tree plus host pressure observation; retained values are not benchmark claims",
    measurementComplete,
    observations: {
      buildPeak: observation(phaseMetric("clean_build").peakProcessTreeRssBytes, "bytes", phaseMetric("clean_build").method),
      idleProcessMemory: observation(probe.oneWorkerIdle.totalRssBytes, "bytes", probe.method.memory),
      oneWorkerPeak: observation(probe.oneWorkerInvocation.peakKnownProcessRssBytes, "bytes", probe.method.memory),
      multiWorkerPeak: observation(probe.twoWorkerIdle.totalRssBytes, "bytes", probe.method.memory),
      failurePeak: observation(probe.failureRecovery.peakKnownProcessRssBytes, "bytes", probe.method.memory),
      startupBaseline: observation(median(startup), "milliseconds", probe.method.startup),
      invocationBaseline: observation(median(invocation), "milliseconds", probe.method.invocation),
    },
    overallObservedProcessTreePeakBytes: overallPeak,
    hostPressure: {
      physicalMemoryBytes: os.totalmem(),
      minimumAvailableBytes,
      swapGrowthBytes,
      sampleCount: allHostSamples.length,
    },
    sixteenGiBDecision: {
      result: publicClean && measurementComplete && thresholdsMet ? "ACCEPT" : "PROVISIONAL",
      authority: publicClean
        ? "mechanical predicates on the authoritative clean run"
        : "local diagnostic thresholds only; not a milestone acceptance verdict",
      predicates,
    },
    phaseMeasurements: phaseMetrics.map(compactPhaseMetric),
    limitations: [
      "100 ms phase sampling can miss shorter memory spikes",
      "timings describe this exact reference slice and are not throughput benchmarks",
      "local observations cannot substitute for the public clean-environment coordinate",
    ],
  };
}

function reproductionSummary() {
  return {
    schemaVersion: "jpyxis.io/m6-reproduction-summary/v1alpha1",
    evidenceState: "CANDIDATE",
    generatedAt: new Date().toISOString(),
    acceptanceVerdict: "PENDING",
    verdictBasis: "offline-m6-verifier",
    invocationObservedSuccess: true,
    predecessorEvidenceVerified: true,
    retainedAfterRuntimeShutdown: true,
    explicitlyUnproven: [
      "production readiness",
      "security isolation",
      "GPU or accelerator support",
      "multi-host behavior",
      "cluster scheduling",
      "zero-copy data planes",
      "arbitrary plugin compatibility",
      "business transaction success",
    ],
  };
}

function copyPredecessorEvidence() {
  const destination = path.join(bundleRoot, "predecessors");
  fs.rmSync(destination, { recursive: true, force: true });
  for (const milestone of ["m1", "m2", "m3", "m4", "m5"]) {
    const from = path.join(root, "build", milestone);
    const to = path.join(destination, milestone);
    fs.mkdirSync(to, { recursive: true });
    fs.copyFileSync(path.join(from, "conformance-summary.json"), path.join(to, "conformance-summary.json"));
    if (milestone === "m1") {
      for (const file of ["java-report.json", "python-report.json"]) {
        fs.copyFileSync(path.join(from, file), path.join(to, file));
      }
    } else {
      fs.cpSync(path.join(from, "runs"), path.join(to, "runs"), { recursive: true });
    }
  }
}

function verifyPredecessorEvidence() {
  const predecessor = path.join(bundleRoot, "predecessors");
  const m1 = readJson(path.join(predecessor, "m1", "conformance-summary.json"));
  const java = readJson(path.join(predecessor, "m1", "java-report.json"));
  const python = readJson(path.join(predecessor, "m1", "python-report.json"));
  if (m1.caseCount !== 38 || JSON.stringify(withoutBinding(java)) !== JSON.stringify(withoutBinding(python))) {
    throw new Error("M1 retained reports are not the same 38-case result");
  }
  const m2 = readJson(path.join(predecessor, "m2", "conformance-summary.json"));
  if (m2.scenarioCount !== 24) throw new Error("M2 retained summary is incomplete");
  for (const result of m2.results) {
    if (result.id === "verifier_failure") continue;
    const verified = verifyM2Bundle(path.join(predecessor, "m2", "runs", result.id), { writeVerdict: false });
    if (verified.verdict !== result.verdict) throw new Error(`M2 ${result.id} retained verdict differs`);
  }
  for (const [milestone, verify] of [
    ["m3", verifyM3Evidence], ["m4", verifyM4Evidence], ["m5", verifyM5Evidence],
  ]) {
    const result = verify(path.join(predecessor, milestone));
    if (result.verdict !== "PASS") throw new Error(`${milestone.toUpperCase()} retained evidence returned ${result.verdict}`);
  }
}

function writePredecessorIndex() {
  const files = listFiles(path.join(bundleRoot, "predecessors"))
    .map((file) => ({
      path: path.relative(bundleRoot, file).replaceAll("\\", "/"),
      sha256: digestFile(file),
    }));
  writeJson(path.join(bundleRoot, "predecessor-index.json"), {
    schemaVersion: "jpyxis.io/m6-predecessor-index/v1alpha1",
    generatedAt: new Date().toISOString(),
    files,
  });
}

function writePhaseJournal() {
  fs.writeFileSync(path.join(bundleRoot, "phase-journal.jsonl"),
    `${phaseJournal.map((item) => JSON.stringify(item)).join("\n")}\n`);
}

function writeManifest(revision, target = bundleRoot) {
  const required = [
    "source.json", "environment.json", "dependencies.json", "phase-journal.jsonl",
    "resource-observations.json", "runtime-shutdown.json", "reproduction-summary.json",
    "predecessor-index.json",
  ];
  writeJson(path.join(target, "manifest.json"), {
    schemaVersion: "jpyxis.io/m6-evidence-manifest/v1alpha1",
    sourceRevision: revision,
    generatedAt: new Date().toISOString(),
    files: required.map((relative) => ({ path: relative, sha256: digestFile(path.join(target, relative)) })),
  });
}

function verifyMutations(revision) {
  fs.rmSync(mutationRoot, { recursive: true, force: true });
  fs.mkdirSync(mutationRoot, { recursive: true });
  const definitions = [
    mutation("missing_phase", "INCONCLUSIVE", (target) => {
      const lines = fs.readFileSync(path.join(target, "phase-journal.jsonl"), "utf8").trimEnd().split(/\r?\n/);
      fs.writeFileSync(path.join(target, "phase-journal.jsonl"), `${lines.slice(0, -1).join("\n")}\n`);
      writeManifest(revision, target);
    }),
    mutation("reordered_phase", "FAIL", (target) => {
      const file = path.join(target, "phase-journal.jsonl");
      const lines = fs.readFileSync(file, "utf8").trimEnd().split(/\r?\n/);
      [lines[4], lines[5]] = [lines[5], lines[4]];
      fs.writeFileSync(file, `${lines.join("\n")}\n`);
      writeManifest(revision, target);
    }),
    mutation("dirty_source", "INCONCLUSIVE", (target) => {
      const value = readJson(path.join(target, "source.json"));
      value.dirtyAtStart = true;
      writeJson(path.join(target, "source.json"), value);
      writeManifest(revision, target);
    }),
    mutation("changed_predecessor", "FAIL", (target) => {
      const file = path.join(target, "predecessors", "m5", "conformance-summary.json");
      const value = readJson(file);
      value.scenarioCount += 1;
      writeJson(file, value);
    }),
    mutation("missing_resource_observation", "INCONCLUSIVE", (target) => {
      fs.rmSync(path.join(target, "resource-observations.json"));
    }),
    mutation("live_runtime_claim", "FAIL", (target) => {
      const value = readJson(path.join(target, "runtime-shutdown.json"));
      value.allRuntimeProcessesStopped = false;
      value.liveRecordedProcesses = [999999];
      writeJson(path.join(target, "runtime-shutdown.json"), value);
      writeManifest(revision, target);
    }),
    mutation("failed_16gib_predicate", "FAIL", (target) => {
      const source = readJson(path.join(target, "source.json"));
      source.dirtyAtStart = false;
      source.generatedResidueAtStart = false;
      source.cleanEnvironment = {
        kind: "github-hosted-fresh-vm", githubHosted: true, runnerEnvironment: "github-hosted",
        runnerOs: "Linux", workflowSha: source.revision, dependencyCachesEnabled: false, immutableRevision: true,
      };
      writeJson(path.join(target, "source.json"), source);
      const value = readJson(path.join(target, "resource-observations.json"));
      value.measurementComplete = true;
      value.sixteenGiBDecision.result = "REJECT";
      value.sixteenGiBDecision.predicates[1].observed = false;
      writeJson(path.join(target, "resource-observations.json"), value);
      writeManifest(revision, target);
    }),
    mutation("summary_owns_success", "FAIL", (target) => {
      const value = readJson(path.join(target, "reproduction-summary.json"));
      value.acceptanceVerdict = "PASS";
      writeJson(path.join(target, "reproduction-summary.json"), value);
      writeManifest(revision, target);
    }),
  ];
  return definitions.map((definition) => {
    const target = path.join(mutationRoot, definition.id);
    fs.cpSync(bundleRoot, target, { recursive: true });
    definition.apply(target);
    const verified = verifyM6Evidence(target);
    if (verified.verdict !== definition.expected) {
      throw new Error(`${definition.id}: expected ${definition.expected}, got ${verified.verdict}: ${[...verified.failures, ...verified.incomplete].join("; ")}`);
    }
    console.log(`${definition.id}: ${verified.verdict} (evidence mutation)`);
    return { id: definition.id, verdict: verified.verdict };
  });
}

function mutation(id, expected, apply) {
  return { id, expected, apply };
}

function assertExpectedBaseline(result, stage) {
  if (result.failures.length > 0) throw new Error(`${stage} M6 evidence failed: ${result.failures.join("; ")}`);
  if (publicClean && result.verdict !== "PASS") {
    throw new Error(`${stage} public-clean evidence is ${result.verdict}: ${result.incomplete.join("; ")}`);
  }
  if (!publicClean) {
    const unexpected = result.incomplete.filter((item) => ![
      "source checkout was dirty at reproduction start",
      "generated project residue existed at reproduction start",
      "authoritative public clean-environment coordinate is absent",
      "resource observation method is incomplete",
      "16 GB predicate could not be established locally:",
    ].some((allowed) => item.startsWith(allowed)));
    if (unexpected.length > 0) throw new Error(`${stage} local evidence has unexpected gaps: ${unexpected.join("; ")}`);
    if (result.verdict !== "INCONCLUSIVE") throw new Error(`${stage} local evidence must remain INCONCLUSIVE`);
  }
}

function assertScenarioVerdict(file, id, expected) {
  const summary = readJson(file);
  const item = summary.results?.find((entry) => entry.id === id);
  if (item?.verdict !== expected) throw new Error(`${id} is ${item?.verdict ?? "missing"}; expected ${expected}`);
}

function assertPublicCoordinate(source) {
  if (!publicClean) return;
  if (process.env.GITHUB_ACTIONS !== "true"
      || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
      || process.env.RUNNER_OS !== "Linux"
      || process.env.GITHUB_SHA !== source.revision) {
    throw new Error("--public-clean requires the exact GitHub-hosted Linux workflow coordinate at GITHUB_SHA");
  }
  if (source.dirty || source.generatedPaths.length > 0) {
    throw new Error("public clean proof started with dirty source or generated residue");
  }
}

function cleanGeneratedOutputs() {
  for (const target of generatedOutputPaths()) {
    const resolved = path.resolve(target);
    const allowed = (path.dirname(resolved) === path.join(root, "build") && /^m[1-6]$/.test(path.basename(resolved)))
      || (resolved.startsWith(`${root}${path.sep}`) && path.basename(resolved) === "target");
    if (!allowed) throw new Error(`refusing to clean unexpected path: ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function generatedOutputPaths() {
  return [
    ...["m1", "m2", "m3", "m4", "m5", "m6"].map((milestone) => path.join(root, "build", milestone)),
    path.join(root, "bindings", "java", "target"),
    path.join(root, "invocation", "java", "target"),
    path.join(root, "lifecycle", "java", "target"),
    path.join(root, "resilience", "java", "target"),
  ];
}

function sampleProcessTree(seedPids) {
  const processes = process.platform === "linux"
    ? linuxProcessTree(seedPids)
    : knownProcesses(seedPids);
  return {
    totalRssBytes: processes.reduce((sum, item) => sum + item.rssBytes, 0),
    processes,
    host: hostMemory(),
  };
}

function linuxProcessTree(seedPids) {
  const table = new Map();
  for (const entry of fs.readdirSync("/proc", { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    try {
      const status = fs.readFileSync(`/proc/${entry.name}/status`, "utf8");
      table.set(Number(entry.name), {
        pid: Number(entry.name),
        parent: Number(status.match(/^PPid:\s+(\d+)/m)?.[1] ?? -1),
        rssBytes: Number(status.match(/^VmRSS:\s+(\d+)\s+kB/m)?.[1] ?? 0) * 1024,
      });
    } catch {
      // Process exited during observation.
    }
  }
  const selected = new Set(seedPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of table.values()) {
      if (selected.has(item.parent) && !selected.has(item.pid)) {
        selected.add(item.pid);
        changed = true;
      }
    }
  }
  return [...selected].map((pid) => table.get(pid)).filter(Boolean)
    .map(({ pid, rssBytes }) => ({ pid, rssBytes }));
}

function knownProcesses(pids) {
  if (process.platform !== "win32") {
    return pids.filter(isProcessAlive).map((pid) => ({
      pid, rssBytes: pid === process.pid ? process.memoryUsage().rss : 0,
    }));
  }
  const expression = `$ids=@(${pids.join(",")}); Get-Process -Id $ids -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64 | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", expression], {
    encoding: "utf8", windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  const parsed = JSON.parse(result.stdout);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({ pid: item.Id, rssBytes: item.WorkingSet64 }));
}

function hostMemory() {
  if (process.platform === "linux") {
    const text = fs.readFileSync("/proc/meminfo", "utf8");
    const value = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)\\s+kB`, "m"))?.[1] ?? 0) * 1024;
    return {
      totalBytes: value("MemTotal"), availableBytes: value("MemAvailable"),
      swapTotalBytes: value("SwapTotal"), swapFreeBytes: value("SwapFree"),
    };
  }
  return {
    totalBytes: os.totalmem(), availableBytes: os.freemem(),
    swapTotalBytes: null, swapFreeBytes: null,
  };
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function phaseMetric(phase) {
  const value = phaseMetrics.find((item) => item.phase === phase);
  if (!value) throw new Error(`missing phase metric: ${phase}`);
  return value;
}

function compactPhaseMetric(metric) {
  const samples = metric.hostSamples ?? [];
  const available = samples.map((item) => item.availableBytes).filter(Number.isFinite);
  const swapUsed = samples
    .filter((item) => Number.isFinite(item.swapTotalBytes) && Number.isFinite(item.swapFreeBytes))
    .map((item) => item.swapTotalBytes - item.swapFreeBytes);
  return {
    phase: metric.phase,
    durationMillis: metric.durationMillis,
    peakProcessTreeRssBytes: metric.peakProcessTreeRssBytes,
    minimumHostAvailableBytes: available.length > 0 ? Math.min(...available) : null,
    swapUsedAtStartBytes: swapUsed.length > 0 ? swapUsed[0] : null,
    swapUsedAtEndBytes: swapUsed.length > 0 ? swapUsed.at(-1) : null,
    sampleCount: samples.length,
    method: metric.method,
  };
}

function observation(value, unit, method) {
  return { value, unit, method };
}

function predicate(id, observed, evidence) {
  return { id, observed, evidence };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function mavenCommand(args) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `mvnw.cmd ${args.join(" ")}`],
    };
  }
  return { command: "sh", args: [path.join(root, "mvnw"), ...args] };
}

function captureMavenVersion(environment) {
  const invocation = mavenCommand(["-version"]);
  return capture(invocation.command, invocation.args, true, environment).split(/\r?\n/)[0];
}

function capture(command, args, combineStderr = false, environment = process.env) {
  const result = spawnSync(command, args, {
    cwd: root, env: environment, encoding: "utf8", windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  return `${result.stdout}${combineStderr ? result.stderr : ""}`.trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function withoutBinding(report) {
  const copy = structuredClone(report);
  delete copy.binding;
  return copy;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(resolved) : [resolved];
  }).sort();
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function nanosToMillis(value) {
  return Number(value) / 1_000_000;
}

function assertRepositoryRoot() {
  if (!fs.existsSync(path.join(root, "pom.xml")) || !fs.existsSync(path.join(root, ".git"))) {
    throw new Error("verify-m6 must run from the JPyxis repository root");
  }
}

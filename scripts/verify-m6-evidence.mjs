import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verifyBundle as verifyM2Bundle } from "./verify-m2-bundle.mjs";
import { verifyM3Evidence } from "./verify-m3-evidence.mjs";
import { verifyM4Evidence } from "./verify-m4-evidence.mjs";
import { verifyM5Evidence } from "./verify-m5-evidence.mjs";

const requiredPhases = [
  "source_check",
  "bootstrap",
  "clean_build",
  "contract_conformance",
  "invocation_success_and_failure",
  "runtime_replacement",
  "lifecycle_register_load_warm_activate",
  "resilience_failure_and_recovery",
  "resource_observation",
  "rollback_and_final_state",
  "runtime_shutdown",
  "offline_predecessor_verification",
  "m6_offline_verification",
];

const expectedM2 = new Map([
  ["success_exact", "PASS"],
  ["bad_rank", "PASS"],
  ["bad_shape", "PASS"],
  ["bad_dtype", "PASS"],
  ["bad_batch_bound", "PASS"],
  ["bad_non_finite_scalar", "PASS"],
  ["malformed_output", "PASS"],
  ["definition_failure", "PASS"],
  ["definition_identity_mismatch", "PASS"],
  ["invalid_worker_failure", "PASS"],
  ["worker_coordinate_mismatch", "PASS"],
  ["worker_unavailable", "PASS"],
  ["transport_interrupted", "PASS"],
  ["runtime_failure", "PASS"],
  ["deadline_before_dispatch", "PASS"],
  ["deadline_during_execution", "PASS"],
  ["cancel_late_result", "PASS"],
  ["recorder_failure", "INCONCLUSIVE"],
  ["bundle_missing", "INCONCLUSIVE"],
  ["bundle_truncated", "INCONCLUSIVE"],
  ["bundle_reordered", "FAIL"],
  ["bundle_corrupt", "FAIL"],
  ["bundle_conflicting", "FAIL"],
]);

export function verifyM6Evidence(evidenceRoot, { preflight = false } = {}) {
  const root = path.resolve(evidenceRoot);
  const failures = [];
  const incomplete = [];
  const manifest = readJson(root, "manifest.json", incomplete);
  const source = readJson(root, "source.json", incomplete);
  const environment = readJson(root, "environment.json", incomplete);
  const dependencies = readJson(root, "dependencies.json", incomplete);
  const resources = readJson(root, "resource-observations.json", incomplete);
  const shutdown = readJson(root, "runtime-shutdown.json", incomplete);
  const summary = readJson(root, "reproduction-summary.json", incomplete);
  const predecessorIndex = readJson(root, "predecessor-index.json", incomplete);
  const phases = readJsonLines(root, "phase-journal.jsonl", incomplete);

  checkSchema(manifest, "jpyxis.io/m6-evidence-manifest/v1alpha1", "manifest", failures);
  checkSchema(source, "jpyxis.io/m6-source/v1alpha1", "source", failures);
  checkSchema(environment, "jpyxis.io/m6-environment/v1alpha1", "environment", failures);
  checkSchema(dependencies, "jpyxis.io/m6-dependencies/v1alpha1", "dependencies", failures);
  checkSchema(resources, "jpyxis.io/m6-resource-observations/v1alpha1", "resources", failures);
  checkSchema(shutdown, "jpyxis.io/m6-runtime-shutdown/v1alpha1", "shutdown", failures);
  checkSchema(summary, "jpyxis.io/m6-reproduction-summary/v1alpha1", "summary", failures);
  checkSchema(predecessorIndex, "jpyxis.io/m6-predecessor-index/v1alpha1", "predecessor index", failures);

  verifyManifest(root, manifest, failures, incomplete);
  verifyPredecessorIndex(root, predecessorIndex, failures, incomplete);
  verifyPhases(phases, preflight, failures, incomplete);
  verifySource(source, failures, incomplete);
  verifyEnvironment(environment, failures, incomplete);
  verifyDependencies(dependencies, failures, incomplete);
  verifyResources(resources, source, failures, incomplete);
  verifyShutdown(shutdown, failures, incomplete);
  verifySummary(summary, failures);
  verifyPredecessors(root, failures, incomplete);

  const verdict = failures.length > 0 ? "FAIL" : incomplete.length > 0 ? "INCONCLUSIVE" : "PASS";
  return { verdict, failures, incomplete };
}

function verifyManifest(root, manifest, failures, incomplete) {
  if (!manifest) return;
  if (manifest.sourceRevision !== readOptionalJson(root, "source.json")?.revision) {
    failures.push("manifest source revision conflicts with source record");
  }
  const files = manifest.files;
  if (!Array.isArray(files) || files.length < 8) {
    incomplete.push("manifest does not enumerate the required M6 files");
    return;
  }
  const seen = new Set();
  for (const entry of files) {
    if (!entry || typeof entry.path !== "string" || seen.has(entry.path)) {
      failures.push("manifest contains an invalid or duplicate file path");
      continue;
    }
    seen.add(entry.path);
    const resolved = safeResolve(root, entry.path, failures);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      incomplete.push(`manifest file is missing: ${entry.path}`);
      continue;
    }
    if (digestFile(resolved) !== entry.sha256) failures.push(`manifest digest mismatch: ${entry.path}`);
  }
  for (const required of [
    "source.json", "environment.json", "dependencies.json", "phase-journal.jsonl",
    "resource-observations.json", "runtime-shutdown.json", "reproduction-summary.json",
    "predecessor-index.json",
  ]) {
    if (!seen.has(required)) incomplete.push(`manifest omits required file: ${required}`);
  }
}

function verifyPredecessorIndex(root, index, failures, incomplete) {
  if (!index) return;
  if (!Array.isArray(index.files) || index.files.length < 8) {
    incomplete.push("predecessor index is incomplete");
    return;
  }
  const seen = new Set();
  for (const entry of index.files) {
    if (!entry || typeof entry.path !== "string" || !entry.path.startsWith("predecessors/")
        || seen.has(entry.path)) {
      failures.push("predecessor index contains an invalid or duplicate path");
      continue;
    }
    seen.add(entry.path);
    const resolved = safeResolve(root, entry.path, failures);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      incomplete.push(`indexed predecessor evidence is missing: ${entry.path}`);
      continue;
    }
    if (digestFile(resolved) !== entry.sha256) failures.push(`predecessor digest mismatch: ${entry.path}`);
  }
  for (const milestone of ["m1", "m2", "m3", "m4", "m5"]) {
    if (!seen.has(`predecessors/${milestone}/conformance-summary.json`)) {
      incomplete.push(`predecessor index omits ${milestone} summary`);
    }
  }
}

function verifyPhases(phases, preflight, failures, incomplete) {
  if (!phases) return;
  const expected = preflight ? requiredPhases.slice(0, -1) : requiredPhases;
  if (phases.length !== expected.length) {
    incomplete.push(`phase count is ${phases.length}; expected ${expected.length}`);
  }
  phases.forEach((phase, index) => {
    if (phase.schemaVersion !== "jpyxis.io/m6-phase/v1alpha1") failures.push(`phase ${index + 1} has wrong schema`);
    if (phase.sequence !== index + 1) failures.push(`phase ${index + 1} has non-contiguous sequence`);
    if (phase.phase !== expected[index]) failures.push(`phase ${index + 1} is ${phase.phase}; expected ${expected[index]}`);
    if (!phase.startedAt || !phase.endedAt || Date.parse(phase.endedAt) < Date.parse(phase.startedAt)) {
      failures.push(`phase ${phase.phase} has invalid timestamps`);
    }
    if (typeof phase.command !== "string" || phase.command.length === 0) failures.push(`phase ${phase.phase} lacks command identity`);
    if (phase.exitCode !== 0) failures.push(`phase ${phase.phase} did not exit successfully`);
  });
}

function verifySource(source, failures, incomplete) {
  if (!source) return;
  if (!/^[0-9a-f]{40}$/.test(source.revision ?? "")) failures.push("source revision is not immutable");
  if (!/^[0-9a-f]{40}$/.test(source.tree ?? "")) failures.push("source tree is not immutable");
  if (source.dirtyAtStart !== false) incomplete.push("source checkout was dirty at reproduction start");
  if (source.generatedResidueAtStart !== false) incomplete.push("generated project residue existed at reproduction start");
  if (source.cleanEnvironment?.kind !== "github-hosted-fresh-vm"
      || source.cleanEnvironment?.githubHosted !== true
      || source.cleanEnvironment?.dependencyCachesEnabled !== false
      || source.cleanEnvironment?.immutableRevision !== true) {
    incomplete.push("authoritative public clean-environment coordinate is absent");
  }
  if (source.cleanEnvironment?.workflowSha
      && source.cleanEnvironment.workflowSha !== source.revision) {
    failures.push("workflow SHA conflicts with checked-out revision");
  }
}

function verifyEnvironment(environment, failures, incomplete) {
  if (!environment) return;
  for (const field of ["os", "architecture", "cpuModel", "java", "python", "node", "mavenWrapper"]) {
    if (typeof environment[field] !== "string" || environment[field].length === 0) {
      incomplete.push(`environment omits ${field}`);
    }
  }
  if (!Number.isFinite(environment.logicalCpuCount) || environment.logicalCpuCount < 1) failures.push("invalid CPU count");
  if (!Number.isFinite(environment.physicalMemoryBytes) || environment.physicalMemoryBytes <= 0) failures.push("invalid physical memory");
  if (environment.containerRequired !== false) failures.push("M6 unexpectedly requires a container");
}

function verifyDependencies(dependencies, failures, incomplete) {
  if (!dependencies) return;
  if (dependencies.mavenRepositoryIsolated !== true || dependencies.pipCacheDisabled !== true) {
    failures.push("dependency isolation was not recorded");
  }
  if (!Array.isArray(dependencies.inputs) || dependencies.inputs.length < 6) {
    incomplete.push("dependency inputs are incomplete");
  }
  for (const input of dependencies.inputs ?? []) {
    if (!input.path || !/^sha256:[0-9a-f]{64}$/.test(input.sha256 ?? "")) {
      failures.push("dependency input lacks a stable path or digest");
    }
  }
}

function verifyResources(resources, source, failures, incomplete) {
  if (!resources) return;
  const observations = resources.observations ?? {};
  for (const name of ["buildPeak", "idleProcessMemory", "oneWorkerPeak", "multiWorkerPeak", "failurePeak", "startupBaseline", "invocationBaseline"]) {
    const item = observations[name];
    if (!item || !Number.isFinite(item.value) || item.value < 0 || !item.unit || !item.method) {
      incomplete.push(`resource observation is missing or invalid: ${name}`);
    }
  }
  const decision = resources.sixteenGiBDecision;
  if (!decision || !Array.isArray(decision.predicates)) {
    incomplete.push("16 GB decision is missing");
  } else {
    const authoritativePublicRun = source?.cleanEnvironment?.kind === "github-hosted-fresh-vm"
      && source.cleanEnvironment?.githubHosted === true;
    for (const predicate of decision.predicates) {
      if (predicate.observed !== true) {
        if (authoritativePublicRun) failures.push(`16 GB predicate failed: ${predicate.id}`);
        else incomplete.push(`16 GB predicate could not be established locally: ${predicate.id}`);
      }
    }
    if (authoritativePublicRun && decision.result !== "ACCEPT") {
      failures.push("authoritative 16 GB decision is not ACCEPT");
    } else if (!authoritativePublicRun && decision.result !== "PROVISIONAL") {
      failures.push("local 16 GB observation is not marked PROVISIONAL");
    }
  }
  if (!Number.isFinite(resources.hostPressure?.minimumAvailableBytes)) incomplete.push("minimum available memory was not recorded");
  if (resources.measurementComplete !== true) incomplete.push("resource observation method is incomplete");
}

function verifyShutdown(shutdown, failures, incomplete) {
  if (!shutdown) return;
  if (!Array.isArray(shutdown.recordedProcessIds)) incomplete.push("shutdown record omits process identities");
  if (!Array.isArray(shutdown.liveRecordedProcesses)) incomplete.push("shutdown record omits live-process result");
  if (shutdown.allRuntimeProcessesStopped !== true || (shutdown.liveRecordedProcesses ?? []).length !== 0) {
    failures.push("recorded runtime processes were not all stopped");
  }
}

function verifySummary(summary, failures) {
  if (!summary) return;
  if (summary.invocationObservedSuccess !== true) failures.push("reference invocation success was not observed");
  if (summary.predecessorEvidenceVerified !== true) failures.push("predecessor evidence was not verified");
  if (summary.acceptanceVerdict !== "PENDING" || summary.verdictBasis !== "offline-m6-verifier") {
    failures.push("reproduction summary attempts to own the acceptance verdict");
  }
  if (!Array.isArray(summary.explicitlyUnproven) || summary.explicitlyUnproven.length < 6) {
    failures.push("summary omits explicit unproven claims");
  }
}

function verifyPredecessors(root, failures, incomplete) {
  const predecessorRoot = path.join(root, "predecessors");
  try {
    verifyM1(path.join(predecessorRoot, "m1"));
  } catch (error) {
    failures.push(`M1 evidence failed: ${error.message}`);
  }
  try {
    verifyM2(path.join(predecessorRoot, "m2"));
  } catch (error) {
    failures.push(`M2 evidence failed: ${error.message}`);
  }
  for (const [milestone, verify] of [
    ["M3", verifyM3Evidence],
    ["M4", verifyM4Evidence],
    ["M5", verifyM5Evidence],
  ]) {
    try {
      const result = verify(path.join(predecessorRoot, milestone.toLowerCase()));
      if (result.verdict !== "PASS") failures.push(`${milestone} evidence returned ${result.verdict}`);
    } catch (error) {
      failures.push(`${milestone} evidence failed: ${error.message}`);
    }
  }
  if (!fs.existsSync(predecessorRoot)) incomplete.push("predecessor evidence root is missing");
}

function verifyM1(root) {
  const summary = JSON.parse(fs.readFileSync(path.join(root, "conformance-summary.json"), "utf8"));
  const java = JSON.parse(fs.readFileSync(path.join(root, "java-report.json"), "utf8"));
  const python = JSON.parse(fs.readFileSync(path.join(root, "python-report.json"), "utf8"));
  if (summary.schemaVersion !== "jpyxis.io/m1-conformance-summary/v1alpha1" || summary.caseCount !== 38) {
    throw new Error("wrong M1 summary or case count");
  }
  const javaWithoutBinding = structuredClone(java);
  const pythonWithoutBinding = structuredClone(python);
  delete javaWithoutBinding.binding;
  delete pythonWithoutBinding.binding;
  if (JSON.stringify(javaWithoutBinding) !== JSON.stringify(pythonWithoutBinding)) {
    throw new Error("Java and Python semantic reports differ");
  }
  if (summary.assertions?.crossBindingReportEquality !== true) throw new Error("cross-binding assertion missing");
}

function verifyM2(root) {
  const summary = JSON.parse(fs.readFileSync(path.join(root, "conformance-summary.json"), "utf8"));
  if (summary.schemaVersion !== "jpyxis.io/m2-conformance-summary/v1alpha1" || summary.scenarioCount !== 24) {
    throw new Error("wrong M2 summary or scenario count");
  }
  const recorded = new Map((summary.results ?? []).map((item) => [item.id, item.verdict]));
  for (const [scenario, expected] of expectedM2) {
    const result = verifyM2Bundle(path.join(root, "runs", scenario), { writeVerdict: false });
    if (result.verdict !== expected || recorded.get(scenario) !== expected) {
      throw new Error(`${scenario}: expected ${expected}, got ${result.verdict}/${recorded.get(scenario)}`);
    }
  }
  if (recorded.get("verifier_failure") !== "INCONCLUSIVE") throw new Error("verifier failure case missing");
}

function checkSchema(value, expected, label, failures) {
  if (value && value.schemaVersion !== expected) failures.push(`${label} schema is not recognized`);
}

function readJson(root, relative, incomplete) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  } catch (error) {
    incomplete.push(`${relative} cannot be read: ${error.message}`);
    return null;
  }
}

function readOptionalJson(root, relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  } catch {
    return null;
  }
}

function readJsonLines(root, relative, incomplete) {
  try {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    if (!text.endsWith("\n")) throw new Error("final record boundary is absent");
    return text.trimEnd().split(/\r?\n/).map((line) => JSON.parse(line));
  } catch (error) {
    incomplete.push(`${relative} cannot be read: ${error.message}`);
    return null;
  }
}

function safeResolve(root, relative, failures) {
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    failures.push(`evidence path escapes bundle: ${relative}`);
    return null;
  }
  return resolved;
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const preflight = args.includes("--preflight");
  const target = path.resolve(args.find((value) => value !== "--preflight")
    ?? path.join(process.cwd(), "build", "m6", "bundle"));
  const result = verifyM6Evidence(target, { preflight });
  console.log(`M6 retained evidence: ${result.verdict}`);
  result.failures.forEach((failure) => console.error(`- ${failure}`));
  result.incomplete.forEach((item) => console.error(`- ${item}`));
  if (result.verdict === "FAIL") process.exit(2);
}

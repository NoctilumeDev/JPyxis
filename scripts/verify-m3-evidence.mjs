import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { verifyM3Bundle } from "./verify-m3-bundle.mjs";

export function verifyM3Evidence(evidenceRoot) {
  const root = path.resolve(evidenceRoot);
  const summary = readJson(path.join(root, "conformance-summary.json"));
  if (summary.schemaVersion !== "jpyxis.io/m3-conformance-summary/v1alpha1") {
    throw new Error("M3 conformance summary schema is not recognized");
  }
  const expected = new Map([
    ["numpy_exact", "PASS"],
    ["reference_exact", "PASS"],
    ["numpy_fractional", "PASS"],
    ["reference_fractional", "PASS"],
    ["numpy_runtime_failure", "PASS"],
    ["reference_runtime_failure", "PASS"],
    ["incompatible_capability", "PASS"],
    ["runtime_binding_mismatch", "PASS"],
    ["bundle_missing", "INCONCLUSIVE"],
    ["bundle_corrupt", "FAIL"],
  ]);
  if (summary.scenarioCount !== expected.size || summary.results?.length !== expected.size) {
    throw new Error("M3 summary scenario count is incomplete");
  }
  const contractCoordinates = new Set();
  const definitionCoordinates = new Set();
  const runtimeIdentities = new Set();
  for (const [scenarioId, verdict] of expected) {
    const result = verifyM3Bundle(path.join(root, "runs", scenarioId), { writeVerdict: false });
    if (result.verdict !== verdict) {
      throw new Error(`${scenarioId}: offline verdict ${result.verdict}, expected ${verdict}`);
    }
    if (result.scenarioId !== scenarioId) {
      throw new Error(`${scenarioId}: bundle identity differs from directory`);
    }
    const summarized = summary.results.find((item) => item.id === scenarioId);
    if (!summarized || summarized.verdict !== verdict) {
      throw new Error(`${scenarioId}: conformance summary conflicts with offline verdict`);
    }
    if (!scenarioId.startsWith("bundle_")) {
      const manifest = readJson(path.join(root, "runs", scenarioId, "manifest.json"));
      contractCoordinates.add(`${manifest.contract.identity}|${manifest.contract.digest}`);
      definitionCoordinates.add(`${manifest.definition.identity}|${manifest.definition.digest}`);
      runtimeIdentities.add(manifest.runtime.runtimeIdentity);
    }
  }
  if (contractCoordinates.size !== 1) throw new Error("M3 scenarios did not retain one host contract");
  if (definitionCoordinates.size !== 1) throw new Error("M3 scenarios did not retain one definition plan");
  if (!isDeepStrictEqual([...runtimeIdentities].sort(), ["numpy.cpu", "python.reference"])) {
    throw new Error("M3 evidence does not contain the two named runtime fixtures");
  }
  if (!isDeepStrictEqual([...summary.runtimeFixtures].sort(), [...runtimeIdentities].sort())) {
    throw new Error("M3 summary runtime list conflicts with retained manifests");
  }
  compareResult(root, "numpy_exact", "reference_exact");
  compareResult(root, "numpy_fractional", "reference_fractional");
  compareFailure(root, "numpy_runtime_failure", "reference_runtime_failure");
  for (const assertion of [
    "sameHostContract",
    "sameDefinitionPlan",
    "exactCrossRuntimeAgreement",
    "stableCrossRuntimeFailureMeaning",
    "capabilityMismatchFailsBeforeDispatch",
    "bindingMismatchFailsBeforeRuntimeStart",
    "runtimeNativeValuesRemainInProviders",
    "offlineBundleVerification",
  ]) {
    if (summary.assertions?.[assertion] !== true) throw new Error(`M3 assertion is absent: ${assertion}`);
  }
  return { scenarioCount: expected.size, verdict: "PASS" };
}

function compareResult(root, left, right) {
  const leftOutcome = readOutcome(root, left);
  const rightOutcome = readOutcome(root, right);
  if (!isDeepStrictEqual(leftOutcome.result, rightOutcome.result)) {
    throw new Error(`${left} and ${right} retained different typed results`);
  }
}

function compareFailure(root, left, right) {
  const select = (outcome) => ({ category: outcome.failure?.category, code: outcome.failure?.code });
  if (!isDeepStrictEqual(select(readOutcome(root, left)), select(readOutcome(root, right)))) {
    throw new Error(`${left} and ${right} retained different public failure meaning`);
  }
}

function readOutcome(root, scenarioId) {
  return readJson(path.join(root, "runs", scenarioId, "authoritative-outcome.json"));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.length !== 3) {
    console.error("usage: node scripts/verify-m3-evidence.mjs <m3-evidence-root>");
    process.exit(64);
  }
  try {
    const result = verifyM3Evidence(process.argv[2]);
    console.log(`M3 offline evidence verification: ${result.verdict} (${result.scenarioCount} scenarios)`);
  } catch (error) {
    console.error(`M3 offline evidence verification failed: ${error.message}`);
    process.exit(2);
  }
}

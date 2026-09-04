import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export function verifyBundle(bundlePath, { writeVerdict = true } = {}) {
  const bundle = path.resolve(bundlePath);
  const incomplete = [];
  const failures = [];
  const checks = [];
  let manifest;
  let outcome;
  let request;
  let rawReport;
  let oracle;
  let hostObservations = [];
  let workerObservations = [];

  try {
    manifest = readJson(path.join(bundle, "manifest.json"));
    check(
      manifest.schemaVersion === "jpyxis.io/m2-evidence-bundle/v1alpha1",
      "manifest schema is recognized",
      failures,
      checks,
    );
  } catch (error) {
    incomplete.push(`manifest cannot be read: ${error.message}`);
  }

  if (manifest) {
    for (const file of manifest.files ?? []) {
      const resolved = safeResolve(bundle, file.path, failures);
      if (!resolved) continue;
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        if (file.required) incomplete.push(`required evidence file is missing: ${file.path}`);
        continue;
      }
      const actual = digestFile(resolved);
      if (file.sha256 !== actual) {
        failures.push(`evidence digest mismatch: ${file.path}`);
      } else {
        checks.push(`integrity:${file.path}`);
      }
    }

    outcome = readRequiredJson(bundle, "authoritative-outcome.json", incomplete);
    request = readRequiredJson(bundle, "request.json", incomplete);
    rawReport = readRequiredJson(bundle, "raw-worker-report.json", incomplete);
    oracle = readRequiredJson(bundle, "oracle.json", incomplete);
    hostObservations = readJsonLines(bundle, "host-observations.jsonl", incomplete);
    workerObservations = readJsonLines(bundle, "worker-observations.jsonl", incomplete);
  }

  if (manifest && outcome && request && rawReport && oracle) {
    verifyArtifactIdentity(bundle, manifest, failures, checks);
    verifyCoordinates(manifest, outcome, rawReport, hostObservations, workerObservations, failures, checks);
    verifyObservationSequence(hostObservations, "host", failures, checks);
    verifyObservationSequence(workerObservations, "worker", failures, checks);
    verifyObservationOrder(hostObservations, workerObservations, failures, checks);
    if (!incomplete.some((item) => item.startsWith("host-observations.jsonl cannot be read:"))) {
      verifyTerminalAuthority(manifest, outcome, hostObservations, failures, incomplete, checks);
    }
    verifyExpectedOutcome(manifest, outcome, workerObservations, failures, checks);
    verifyOracle(manifest, request, outcome, rawReport, oracle, failures, checks);
    verifyScenarioInvariant(manifest, outcome, hostObservations, workerObservations, failures, checks);
    if (outcome.evidenceRecorderHealthy !== true) {
      incomplete.push("host evidence recorder did not complete successfully");
    }
  }

  let verdict = "PASS";
  if (failures.length > 0) verdict = "FAIL";
  else if (incomplete.length > 0) verdict = "INCONCLUSIVE";

  const result = {
    schemaVersion: "jpyxis.io/m2-acceptance-verdict/v1alpha1",
    scenarioId: manifest?.scenarioId ?? "unknown",
    verdict,
    checks,
    failures,
    incomplete,
    invocationOutcomeSnapshot: outcome
      ? {
          state: outcome.state,
          category: outcome.failure?.category ?? null,
          code: outcome.failure?.code ?? "OK",
          invocationId: outcome.coordinates?.invocationId ?? null,
        }
      : null,
    explicitlyUnproven: manifest?.explicitlyUnproven ?? [
      "performance",
      "production readiness",
      "accelerator support",
      "distribution",
      "business success",
    ],
  };
  if (writeVerdict) {
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(path.join(bundle, "verdict.json"), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

function verifyArtifactIdentity(bundle, manifest, failures, checks) {
  try {
    const contract = readJson(path.join(bundle, manifest.contract.file));
    const canonicalDigest = `sha256:${crypto
      .createHash("sha256")
      .update(canonicalizeContract(contract), "utf8")
      .digest("hex")}`;
    if (canonicalDigest !== manifest.contract.digest) failures.push("canonical contract digest mismatch");
    const identity = `jpyxis:contract:${contract.metadata.namespace}/${contract.metadata.name}`
      + `@${contract.metadata.version}#${canonicalDigest}`;
    if (identity !== manifest.contract.identity) failures.push("canonical contract identity mismatch");
    if (digestFile(path.join(bundle, manifest.definition.file)) !== manifest.definition.digest) {
      failures.push("definition artifact digest mismatch");
    }
    checks.push("contract-and-definition-identity");
  } catch (error) {
    failures.push(`artifact identity cannot be recomputed: ${error.message}`);
  }
}

function verifyCoordinates(manifest, outcome, rawReport, host, worker, failures, checks) {
  const expected = manifest.coordinates;
  const actual = outcome.coordinates;
  for (const key of ["invocationId", "attemptId", "traceId", "contractIdentity", "definitionIdentity"]) {
    if (!actual || actual[key] !== expected?.[key]) failures.push(`outcome coordinate mismatch: ${key}`);
  }
  if (rawReport.present !== false) {
    const observed = rawReport.observedCoordinates;
    const rawMismatches = [];
    for (const key of ["invocationId", "attemptId", "traceId", "contractIdentity", "definitionIdentity"]) {
      if (!observed || observed[key] !== expected?.[key]) {
        rawMismatches.push(key);
      }
    }
    if (observed?.contractDigest !== manifest.contract.digest) {
      rawMismatches.push("contractDigest");
    }
    if (observed?.definitionDigest !== manifest.definition.digest) {
      rawMismatches.push("definitionDigest");
    }
    if (manifest.allowRawCoordinateMismatch === true) {
      if (rawMismatches.length === 0 || outcome.failure?.code !== "WORKER_COORDINATE_MISMATCH") {
        failures.push("coordinate-mismatch fixture did not produce a rejected mismatched report");
      } else {
        checks.push(`expected-worker-report-coordinate-mismatch:${rawMismatches.join(",")}`);
      }
    } else {
      rawMismatches.forEach((key) => failures.push(`worker report coordinate mismatch: ${key}`));
    }
  }
  for (const observation of [...host, ...worker]) {
    if (!observation.invocationId) continue;
    for (const key of ["invocationId", "attemptId", "traceId"]) {
      if (observation[key] !== expected[key]) failures.push(`observation coordinate mismatch: ${key}`);
    }
  }
  checks.push("coordinates-agree");
}

function verifyObservationSequence(observations, label, failures, checks) {
  for (let index = 0; index < observations.length; index += 1) {
    if (observations[index].sequence !== index + 1) {
      failures.push(`${label} observation sequence is not contiguous at position ${index + 1}`);
      return;
    }
  }
  checks.push(`${label}-sequence-contiguous`);
}

function verifyObservationOrder(host, worker, failures, checks) {
  verifyPartialOrder(host, "host", [
    ["INVOCATION_ACCEPTED", "INPUT_VALIDATED"],
    ["INVOCATION_ACCEPTED", "INPUT_REJECTED"],
    ["INPUT_VALIDATED", "ATTEMPT_PINNED"],
    ["ATTEMPT_PINNED", "TRANSPORT_READY"],
    ["TRANSPORT_READY", "DISPATCH_STARTED"],
    ["DISPATCH_STARTED", "DISPATCHED"],
    ["DISPATCHED", "RESPONSE_OBSERVED"],
    ["RESPONSE_OBSERVED", "OUTPUT_VALIDATED"],
    ["RESPONSE_OBSERVED", "OUTPUT_REJECTED"],
    ["OUTPUT_VALIDATED", "TERMINAL_SUCCEEDED"],
    ["OUTPUT_REJECTED", "TERMINAL_FAILED"],
  ], failures);
  verifyPartialOrder(worker, "worker", [
    ["WORKER_REQUEST_OBSERVED", "WORKER_INPUT_VALIDATED"],
    ["WORKER_REQUEST_OBSERVED", "WORKER_INPUT_REJECTED"],
    ["WORKER_INPUT_VALIDATED", "RUNTIME_STARTED"],
    ["WORKER_INPUT_VALIDATED", "DEFINITION_PREPARATION_FAILED"],
    ["RUNTIME_STARTED", "RUNTIME_COMPLETED"],
    ["RUNTIME_STARTED", "RUNTIME_FAILED"],
    ["RUNTIME_COMPLETED", "WORKER_REPORT_EMITTED"],
    ["RUNTIME_FAILED", "WORKER_REPORT_EMITTED"],
    ["DEFINITION_PREPARATION_FAILED", "WORKER_REPORT_EMITTED"],
    ["WORKER_INPUT_REJECTED", "WORKER_REPORT_EMITTED"],
  ], failures);
  checks.push("semantic-observation-order");
}

function verifyPartialOrder(observations, label, pairs, failures) {
  const first = new Map();
  observations.forEach((item, index) => {
    if (!first.has(item.event)) first.set(item.event, index);
  });
  for (const [before, after] of pairs) {
    if (first.has(before) && first.has(after) && first.get(before) >= first.get(after)) {
      failures.push(`${label} observation order is impossible: ${before} must precede ${after}`);
    }
  }
  if (first.has("DISPATCH_STARTED") && !first.has("INPUT_VALIDATED")) {
    failures.push("host dispatched without a successful input validation observation");
  }
  if (first.has("RUNTIME_STARTED") && !first.has("WORKER_INPUT_VALIDATED")) {
    failures.push("worker runtime started without input validation");
  }
}

function verifyTerminalAuthority(manifest, outcome, host, failures, incomplete, checks) {
  const terminals = host.filter((item) => item.event?.startsWith("TERMINAL_"));
  if (terminals.length !== 1) {
    if (outcome.evidenceRecorderHealthy === false) {
      incomplete.push("authoritative terminal observation is unavailable because recording failed");
      return;
    }
    failures.push(`expected exactly one host terminal observation, found ${terminals.length}`);
    return;
  }
  if (terminals[0].event !== `TERMINAL_${outcome.state}`) {
    failures.push("host terminal observation conflicts with authoritative outcome");
  }
  if (terminals[0].source !== "HOST") failures.push("terminal observation is not host-owned");
  if (manifest.expected.state !== outcome.state) failures.push("invocation state differs from scenario expectation");
  checks.push("one-host-owned-terminal-state");
}

function verifyExpectedOutcome(manifest, outcome, worker, failures, checks) {
  const expected = manifest.expected;
  if (outcome.state !== expected.state) failures.push(`expected state ${expected.state}, got ${outcome.state}`);
  const category = outcome.failure?.category ?? null;
  const code = outcome.failure?.code ?? "OK";
  if ((expected.category ?? null) !== category) {
    failures.push(`expected category ${expected.category ?? "none"}, got ${category ?? "none"}`);
  }
  if (expected.code !== code) failures.push(`expected code ${expected.code}, got ${code}`);
  if (expected.noWorkerRequest) {
    if (outcome.workerDispatched !== false) failures.push("pre-dispatch failure claims a worker dispatch");
    if (worker.some((item) => item.event === "WORKER_REQUEST_OBSERVED")) {
      failures.push("worker observed a request that was required to fail before dispatch");
    }
  }
  checks.push("expected-invocation-outcome");
}

function verifyOracle(manifest, request, outcome, rawReport, oracle, failures, checks) {
  if (oracle.schemaVersion !== "jpyxis.io/m2-oracle/v1alpha1"
      || oracle.oracleIdentity !== "jpyxis.m2.affine-exact.v1") {
    failures.push("oracle identity is not recognized");
  }
  if (!isDeepStrictEqual(oracle.expectedInvocation, manifest.expected)) {
    failures.push("oracle expected invocation conflicts with the manifest");
  }
  const observedMatchesExpected = outcome.state === manifest.expected.state
    && (outcome.failure?.category ?? null) === (manifest.expected.category ?? null)
    && (outcome.failure?.code ?? "OK") === manifest.expected.code;
  if (oracle.matchesObserved !== observedMatchesExpected) {
    failures.push("oracle outcome comparison flag is inconsistent");
  }
  if (oracle.verdict !== (oracle.matchesObserved ? "PASS" : "FAIL")) {
    failures.push("oracle verdict is inconsistent");
  }
  if (outcome.state !== "SUCCEEDED") {
    checks.push("fault-case-oracle-not-applicable");
    return;
  }
  const tensor = request.values;
  if (tensor?.dtype !== "float32" || tensor?.layout !== "ROW_MAJOR" || tensor?.shape?.length !== 2) {
    failures.push("success request is outside the affine oracle profile");
    return;
  }
  const scale = Math.fround(request.scale);
  const bias = Math.fround(request.bias);
  const expectedValues = tensor.values.map((value) =>
    Math.fround(Math.fround(Math.fround(value) * scale) + bias));
  const result = outcome.result;
  if (!result || result.rows !== tensor.shape[0]) failures.push("success row count differs from oracle");
  if (!sameArray(result?.values?.shape, tensor.shape)) failures.push("success output shape differs from oracle");
  if (!sameArray(result?.values?.values, expectedValues)) failures.push("success output values differ from oracle");
  if (!rawReport.output || !sameArray(rawReport.output.values?.values, expectedValues)) {
    failures.push("raw worker output differs from independently computed oracle");
  }
  const expectedResult = {
    rows: tensor.shape[0],
    values: { dtype: "float32", shape: tensor.shape, layout: "ROW_MAJOR", values: expectedValues },
  };
  if (!isDeepStrictEqual(oracle.expectedResult, expectedResult)) {
    failures.push("retained oracle result differs from independent recomputation");
  }
  if (oracle.comparisonPolicy !== "EXACT_FLOAT32") {
    failures.push("success oracle comparison policy is not EXACT_FLOAT32");
  }
  checks.push("independent-affine-oracle");
}

function verifyScenarioInvariant(manifest, outcome, host, worker, failures, checks) {
  const id = manifest.scenarioId;
  if (id === "malformed_output") {
    if (outcome.failure?.resultProducedButRejected !== true) failures.push("rejected output flag is missing");
    if (!host.some((item) => item.event === "OUTPUT_REJECTED")) failures.push("output rejection is not recorded");
  }
  if (id === "definition_failure") {
    if (!worker.some((item) => item.event === "DEFINITION_PREPARATION_FAILED")) {
      failures.push("definition preparation failure was not observed by the worker");
    }
  }
  if (id === "definition_identity_mismatch") {
    if (!worker.some((item) => item.event === "WORKER_INPUT_REJECTED")) {
      failures.push("definition identity mismatch was not rejected at the worker boundary");
    }
    if (worker.some((item) => item.event === "RUNTIME_STARTED")) {
      failures.push("runtime started after a definition identity mismatch");
    }
  }
  if (id === "invalid_worker_failure") {
    if (outcome.failure?.code !== "WORKER_FAILURE_ENVELOPE_INVALID") {
      failures.push("untrusted worker failure code reached the public outcome");
    }
  }
  if (id === "worker_coordinate_mismatch"
      && outcome.failure?.resultProducedButRejected !== true) {
    failures.push("coordinate-mismatched output was not marked as produced but rejected");
  }
  if (id === "runtime_failure") {
    if (!worker.some((item) => item.event === "RUNTIME_FAILED")) failures.push("runtime failure evidence is absent");
  }
  if (id === "transport_interrupted") {
    if (!worker.some((item) => item.event === "WORKER_TERMINATING")) failures.push("transport interruption fixture did not observe termination");
  }
  if (id === "deadline_during_execution" || id === "cancel_late_result") {
    if (!worker.some((item) => item.event === "RUNTIME_COMPLETED" && item.late === true)) {
      failures.push("late worker completion is not retained");
    }
    if (host.some((item) => item.event === "TERMINAL_SUCCEEDED")) {
      failures.push("late worker completion rewrote the terminal decision");
    }
  }
  checks.push(`scenario-invariant:${id}`);
}

function readRequiredJson(bundle, name, incomplete) {
  try {
    return readJson(path.join(bundle, name));
  } catch (error) {
    incomplete.push(`${name} cannot be read: ${error.message}`);
    return null;
  }
}

function readJsonLines(bundle, name, incomplete) {
  const file = path.join(bundle, name);
  try {
    const content = fs.readFileSync(file, "utf8");
    if (!content.trim()) return [];
    return content.trimEnd().split(/\r?\n/).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`line ${index + 1}: ${error.message}`);
      }
    });
  } catch (error) {
    incomplete.push(`${name} cannot be read: ${error.message}`);
    return [];
  }
}

function safeResolve(bundle, relative, failures) {
  if (typeof relative !== "string" || relative.length === 0) {
    failures.push("manifest contains an invalid evidence path");
    return null;
  }
  const resolved = path.resolve(bundle, relative);
  if (resolved !== bundle && !resolved.startsWith(`${bundle}${path.sep}`)) {
    failures.push(`manifest evidence path escapes bundle: ${relative}`);
    return null;
  }
  return resolved;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && Array.isArray(expected)
    && actual.length === expected.length
    && actual.every((value, index) => Object.is(value, expected[index]) || value === expected[index]);
}

function canonicalizeContract(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalizeContract).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    if (!keys.every((key) => /^[\x20-\x7e]+$/.test(key))) {
      throw new TypeError("contract key is outside the M1 canonical profile");
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeContract(value[key])}`).join(",")}}`;
  }
  if (typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isSafeInteger(value))) {
    return JSON.stringify(value);
  }
  throw new TypeError("contract value is outside the M1 canonical profile");
}

function check(condition, label, failures, checks) {
  if (condition) checks.push(label);
  else failures.push(label);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.length !== 3) {
    console.error("usage: node scripts/verify-m2-bundle.mjs <bundle-directory>");
    process.exit(64);
  }
  const result = verifyBundle(process.argv[2]);
  console.log(`${result.scenarioId}: ${result.verdict}`);
  if (result.failures.length) result.failures.forEach((failure) => console.error(`- ${failure}`));
  if (result.incomplete.length) result.incomplete.forEach((item) => console.error(`- ${item}`));
  process.exit(result.verdict === "PASS" ? 0 : 2);
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export function verifyM3Bundle(bundlePath, { writeVerdict = true } = {}) {
  const bundle = path.resolve(bundlePath);
  const checks = [];
  const failures = [];
  const incomplete = [];
  const manifest = readJsonSafe(path.join(bundle, "manifest.json"), incomplete, "manifest");

  if (manifest && manifest.schemaVersion !== "jpyxis.io/m3-evidence-bundle/v1alpha1") {
    failures.push("manifest schema is not the M3 profile");
  }
  if (manifest) {
    for (const file of manifest.files ?? []) {
      const resolved = safeResolve(bundle, file.path, failures);
      if (!resolved) continue;
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        if (file.required) incomplete.push(`required evidence file is missing: ${file.path}`);
        continue;
      }
      if (digestFile(resolved) !== file.sha256) failures.push(`evidence digest mismatch: ${file.path}`);
      else checks.push(`integrity:${file.path}`);
    }
  }

  const outcome = readJsonSafe(path.join(bundle, "authoritative-outcome.json"), incomplete, "outcome");
  const rawReport = readJsonSafe(path.join(bundle, "raw-worker-report.json"), incomplete, "raw report");
  const request = readJsonSafe(path.join(bundle, "request.json"), incomplete, "request");
  const oracle = readJsonSafe(path.join(bundle, "oracle.json"), incomplete, "oracle");
  const host = readJsonLines(path.join(bundle, "host-observations.jsonl"), incomplete);
  const worker = readJsonLines(path.join(bundle, "worker-observations.jsonl"), incomplete);

  if (manifest && outcome && rawReport && request && oracle) {
    verifyArtifactIdentity(bundle, manifest, failures, checks);
    verifyExpected(manifest, outcome, failures, checks);
    verifySequence(host, "host", failures, checks);
    verifySequence(worker, "worker", failures, checks);
    verifyTerminalAuthority(outcome, host, failures, checks);
    verifyCapabilityBoundary(manifest, outcome, rawReport, host, worker, failures, checks);
    verifyOracle(manifest, request, outcome, rawReport, oracle, failures, checks);
  }

  let verdict = "PASS";
  if (failures.length > 0) verdict = "FAIL";
  else if (incomplete.length > 0) verdict = "INCONCLUSIVE";
  const result = {
    schemaVersion: "jpyxis.io/m3-acceptance-verdict/v1alpha1",
    scenarioId: manifest?.scenarioId ?? "unknown",
    verdict,
    checks,
    failures,
    incomplete,
    invocationOutcomeSnapshot: outcome ? {
      state: outcome.state,
      category: outcome.failure?.category ?? null,
      code: outcome.failure?.code ?? "OK",
    } : null,
    explicitlyUnproven: manifest?.explicitlyUnproven ?? [],
  };
  if (writeVerdict) {
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(path.join(bundle, "verdict.json"), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

function verifyArtifactIdentity(bundle, manifest, failures, checks) {
  try {
    const contract = JSON.parse(fs.readFileSync(path.join(bundle, manifest.contract.file), "utf8"));
    const actualContractDigest = `sha256:${crypto
      .createHash("sha256")
      .update(canonicalize(contract), "utf8")
      .digest("hex")}`;
    if (actualContractDigest !== manifest.contract.digest) failures.push("canonical contract digest mismatch");
    if (manifest.definition.identity !== "jpyxis:definition:example/affine-batch-plan@1.0.0") {
      failures.push("definition identity is outside the bounded M3 profile");
    }
    if (digestFile(path.join(bundle, manifest.definition.file)) !== manifest.definition.digest) {
      failures.push("definition artifact digest mismatch");
    }
    checks.push("contract-and-definition-identity");
  } catch (error) {
    failures.push(`artifact identity cannot be recomputed: ${error.message}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function verifyExpected(manifest, outcome, failures, checks) {
  const expected = manifest.expected;
  if (outcome.state !== expected.state) failures.push(`expected state ${expected.state}, got ${outcome.state}`);
  if ((outcome.failure?.category ?? null) !== (expected.category ?? null)) {
    failures.push("public failure category differs from expectation");
  }
  if ((outcome.failure?.code ?? "OK") !== expected.code) {
    failures.push("public failure code differs from expectation");
  }
  if (expected.noDispatch === true && outcome.workerDispatched !== false) {
    failures.push("knowable capability mismatch was dispatched");
  }
  if (!isDeepStrictEqual(outcome.coordinates, manifest.coordinates)) {
    failures.push("authoritative outcome coordinates differ from manifest");
  }
  checks.push("expected-public-outcome");
}

function verifySequence(observations, label, failures, checks) {
  observations.forEach((item, index) => {
    if (item.sequence !== index + 1) failures.push(`${label} observation sequence is not contiguous`);
    if (item.source !== label.toUpperCase()) failures.push(`${label} observation has the wrong source owner`);
  });
  checks.push(`${label}-sequence-contiguous`);
}

function verifyTerminalAuthority(outcome, host, failures, checks) {
  const terminals = host.filter((item) => item.event?.startsWith("TERMINAL_"));
  if (terminals.length !== 1 || terminals[0].source !== "HOST") {
    failures.push("M3 evidence does not contain one host-owned terminal observation");
  } else if (terminals[0].event !== `TERMINAL_${outcome.state}`) {
    failures.push("host terminal observation conflicts with outcome");
  }
  checks.push("one-host-owned-terminal-state");
}

function verifyCapabilityBoundary(manifest, outcome, rawReport, host, worker, failures, checks) {
  const resolved = host.find((item) => item.event === "RUNTIME_CAPABILITY_RESOLVED");
  const rejected = host.find((item) => item.event === "RUNTIME_CAPABILITY_REJECTED");
  const pinned = host.find((item) => item.event === "ATTEMPT_PINNED");
  const started = worker.some((item) => item.event === "RUNTIME_STARTED");
  const requestObserved = worker.some((item) => item.event === "WORKER_REQUEST_OBSERVED");

  if (manifest.expected.noDispatch === true) {
    if (!rejected || resolved) failures.push("incompatible capability was not rejected during resolution");
    if (requestObserved || started) failures.push("incompatible capability reached worker execution");
    checks.push("capability-rejected-before-dispatch");
    return;
  }

  if (!resolved || !pinned) failures.push("runtime capability was not resolved and pinned");
  if (resolved && pinned) {
    for (const key of ["runtimeIdentity", "runtimeVersion"]) {
      if (resolved.details?.[key] !== pinned.details?.[key]) {
        failures.push(`resolved and pinned runtime differ: ${key}`);
      }
    }
    if (resolved.details?.capabilityIdentity !== "jpyxis.capability/affine-float32"
        || resolved.details?.capabilityVersion !== "1"
        || resolved.details?.operationIdentity !== "jpyxis.operation/affine-batch@1") {
      failures.push("resolved capability differs from the bounded M3 requirement");
    }
    verifyOrder(host, [
      "TRANSPORT_READY",
      "RUNTIME_CAPABILITY_RESOLVED",
      "ATTEMPT_PINNED",
      "DISPATCH_STARTED",
      "DISPATCHED",
    ], failures);
  }
  if (rawReport.present !== false) {
    if (rawReport.runtimeIdentity !== manifest.runtime.runtimeIdentity
        || rawReport.runtimeVersion !== manifest.runtime.runtimeVersion) {
      failures.push("worker report runtime differs from retained runtime coordinate");
    }
    const observed = rawReport.observedCoordinates;
    if (observed?.runtimeIdentity !== manifest.runtime.runtimeIdentity
        || observed?.runtimeVersion !== manifest.runtime.runtimeVersion
        || observed?.runtimeCapabilityIdentity !== manifest.runtime.capabilityIdentity
        || observed?.runtimeCapabilityVersion !== manifest.runtime.capabilityVersion) {
      failures.push("worker report does not echo the pinned runtime binding");
    }
  }
  if (manifest.scenarioId === "runtime_binding_mismatch" && started) {
    failures.push("mismatched runtime binding started execution");
  }
  if (manifest.expected.state === "SUCCEEDED" && !started) {
    failures.push("successful scenario has no runtime execution observation");
  }
  if (manifest.expected.code === "RUNTIME_EXECUTION_FAILED" && !started) {
    failures.push("runtime execution failure occurred before runtime start");
  }
  checks.push("runtime-binding-and-start-boundary");
}

function verifyOrder(observations, events, failures) {
  let previous = -1;
  for (const event of events) {
    const index = observations.findIndex((item) => item.event === event);
    if (index < 0 || index <= previous) {
      failures.push(`required observation order is absent at ${event}`);
      return;
    }
    previous = index;
  }
}

function verifyOracle(manifest, request, outcome, rawReport, oracle, failures, checks) {
  if (oracle.schemaVersion !== "jpyxis.io/m3-oracle/v1alpha1") {
    failures.push("oracle schema is not recognized");
    return;
  }
  if (!isDeepStrictEqual(oracle.expectedInvocation, manifest.expected)) {
    failures.push("oracle expectation conflicts with manifest");
  }
  if (outcome.state !== "SUCCEEDED") {
    checks.push("fault-oracle-not-applicable");
    return;
  }
  const tensor = request.values;
  const scale = Math.fround(request.scale);
  const bias = Math.fround(request.bias);
  const expected = {
    rows: tensor.shape[0],
    values: {
      dtype: "float32",
      shape: tensor.shape,
      layout: "ROW_MAJOR",
      values: tensor.values.map((value) =>
        Math.fround(Math.fround(Math.fround(value) * scale) + bias)),
    },
  };
  if (!isDeepStrictEqual(normalizeFloat32Result(outcome.result), expected)) {
    failures.push("host result differs from independent oracle");
  }
  if (!isDeepStrictEqual(normalizeFloat32Result(rawReport.output), expected)) {
    failures.push("runtime report differs from independent oracle");
  }
  if (!isDeepStrictEqual(oracle.expectedResult, expected)) failures.push("retained oracle is not independently reproducible");
  checks.push("independent-exact-float32-oracle");
}

function normalizeFloat32Result(result) {
  if (!result?.values || !Array.isArray(result.values.values)) return result;
  return {
    rows: result.rows,
    values: {
      dtype: result.values.dtype,
      shape: result.values.shape,
      layout: result.values.layout,
      values: result.values.values.map((value) => Math.fround(value)),
    },
  };
}

function readJsonSafe(file, incomplete, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    incomplete.push(`${label} cannot be read: ${error.message}`);
    return null;
  }
}

function readJsonLines(file, incomplete) {
  try {
    const content = fs.readFileSync(file, "utf8").trim();
    return content ? content.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
  } catch (error) {
    incomplete.push(`${path.basename(file)} cannot be read: ${error.message}`);
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

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.length !== 3) {
    console.error("usage: node scripts/verify-m3-bundle.mjs <bundle-directory>");
    process.exit(64);
  }
  const result = verifyM3Bundle(process.argv[2]);
  console.log(`${result.scenarioId}: ${result.verdict}`);
  result.failures.forEach((item) => console.error(`- ${item}`));
  result.incomplete.forEach((item) => console.error(`- ${item}`));
  process.exit(result.verdict === "PASS" ? 0 : 2);
}

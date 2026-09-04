import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const buildDirectory = path.join(root, "build", "m1");
const contract = path.join(root, "spec", "m1", "contracts", "example.affine-batch.v1.json");
const corpus = path.join(root, "spec", "m1", "corpus", "conformance.json");
const lockPath = path.join(root, "spec", "m1", "identity.lock.json");
const javaReportPath = path.join(buildDirectory, "java-report.json");
const pythonReportPath = path.join(buildDirectory, "python-report.json");
const summaryPath = path.join(buildDirectory, "conformance-summary.json");
const javaJar = path.join(root, "bindings", "java", "target", "jpyxis-contract-java.jar");
const pythonRoot = path.join(root, "bindings", "python");

fs.rmSync(buildDirectory, { recursive: true, force: true });
fs.mkdirSync(buildDirectory, { recursive: true });

const maven = process.platform === "win32"
  ? path.join(root, "mvnw.cmd")
  : path.join(root, "mvnw");
const python = process.env.JPYXIS_PYTHON || (process.platform === "win32" ? "python" : "python3");

if (process.platform === "win32") {
  run(process.env.ComSpec || "cmd.exe", [
    "/d",
    "/s",
    "/c",
    "mvnw.cmd -q -pl bindings/java -am clean package",
  ]);
} else {
  run("sh", [maven, "-q", "-pl", "bindings/java", "-am", "clean", "package"]);
}
run("java", [
  "-jar",
  javaJar,
  "--contract",
  contract,
  "--corpus",
  corpus,
  "--output",
  javaReportPath,
]);

const pythonEnvironment = {
  ...process.env,
  PYTHONPATH: [pythonRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
};
run(python, ["-m", "unittest", "discover", "-s", "bindings/python/tests", "-v"], pythonEnvironment);
run(python, [
  "-m",
  "jpyxis_contract.conformance",
  "--contract",
  contract,
  "--corpus",
  corpus,
  "--output",
  pythonReportPath,
], pythonEnvironment);

const identityLock = readJson(lockPath);
const contractDocument = readJson(contract);
const corpusDocument = readJson(corpus);
const javaReport = readJson(javaReportPath);
const pythonReport = readJson(pythonReportPath);

assert.equal(
  path.resolve(root, identityLock.contract),
  contract,
  "identity lock points to a different contract document",
);
const harnessDigest = `sha256:${crypto
  .createHash("sha256")
  .update(canonicalizeContract(contractDocument), "utf8")
  .digest("hex")}`;
const harnessIdentity = `jpyxis:contract:${contractDocument.metadata.namespace}/${contractDocument.metadata.name}@${contractDocument.metadata.version}#${harnessDigest}`;
assert.equal(harnessDigest, identityLock.contractDigest, "harness digest differs from the lock");
assert.equal(harnessIdentity, identityLock.contractIdentity, "harness identity differs from the lock");
assert.equal(corpusDocument.cases.length, 36, "M1 corpus size changed without review update");
const caseIds = corpusDocument.cases.map((item) => item.id);
assert.ok(caseIds.every((id) => typeof id === "string" && id.length > 0), "corpus case id is missing");
assert.equal(new Set(caseIds).size, caseIds.length, "corpus case ids must be unique");

for (const [label, expectedBinding, report] of [
  ["Java", "java", javaReport],
  ["Python", "python", pythonReport],
]) {
  assert.equal(report.schemaVersion, "jpyxis.io/conformance-report/v1alpha1");
  assert.equal(report.binding, expectedBinding, `${label} report has the wrong binding identity`);
  assert.equal(
    report.contractIdentity,
    identityLock.contractIdentity,
    `${label} contract identity differs from the lock`,
  );
  assert.equal(
    report.contractDigest,
    identityLock.contractDigest,
    `${label} contract digest differs from the lock`,
  );
  assert.equal(
    report.cases.length,
    corpusDocument.cases.length,
    `${label} report does not contain the complete M1 corpus`,
  );
}

assert.deepEqual(withoutBinding(javaReport), withoutBinding(pythonReport));

const summary = {
  schemaVersion: "jpyxis.io/m1-conformance-summary/v1alpha1",
  evidenceState: "PROTOTYPE",
  contractIdentity: identityLock.contractIdentity,
  contractDigest: identityLock.contractDigest,
  caseCount: javaReport.cases.length,
  bindings: ["java", "python"],
  assertions: {
    lockedIdentity: true,
    corpusExpectations: true,
    crossBindingReportEquality: true,
    typedNormalizedValueEquality: true,
  },
  explicitlyUnproven: [
    "network invocation",
    "gRPC or Protobuf mapping",
    "Python worker execution",
    "NumPy runtime execution",
    "lifecycle",
    "performance",
    "clean-machine reproducibility",
  ],
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(
  `M1 cross-binding conformance passed: ${summary.caseCount} cases, locked identity ${summary.contractDigest}`,
);

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function withoutBinding(report) {
  const copy = structuredClone(report);
  delete copy.binding;
  return copy;
}

function canonicalizeContract(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeContract).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      assert.match(key, /^[\x20-\x7e]+$/, "canonical object key is not printable ASCII");
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeContract(value[key])}`).join(",")}}`;
  }
  if (typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isSafeInteger(value))) {
    return JSON.stringify(value);
  }
  throw new TypeError("contract contains a value outside the bounded canonical profile");
}

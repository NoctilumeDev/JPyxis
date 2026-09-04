import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "pom.xml",
  "mvnw",
  "mvnw.cmd",
  ".mvn/wrapper/maven-wrapper.properties",
  "docs/architecture/constitution.md",
  "docs/architecture/ownership.md",
  "docs/architecture/dependency-rules.md",
  "docs/architecture/state-machines.md",
  "docs/architecture/failure-model.md",
  "docs/architecture/contract-principles.md",
  "docs/adr/0004-first-reference-vertical-slice.md",
  "docs/adr/0005-first-verifiable-end-to-end-closure.md",
  "docs/adr/0006-m1-canonical-contract-profile.md",
  "docs/adr/0007-m2-invocation-authority-and-races.md",
  "docs/spec/m1-contract-profile.md",
  "docs/spec/m2-invocation-profile.md",
  "docs/reviews/m0-review-gate.md",
  "docs/reviews/m1-contract-review.md",
  "docs/reviews/m2-invocation-review.md",
  "evidence/m1/freeze-manifest.json",
  "evidence/m2/freeze-manifest.json",
  "spec/m1/contracts/example.affine-batch.v1.json",
  "spec/m1/corpus/conformance.json",
  "spec/m1/identity.lock.json",
  "bindings/java/pom.xml",
  "bindings/java/src/main/java/io/jpyxis/contract/ContractParser.java",
  "bindings/python/jpyxis_contract/parser.py",
  "scripts/verify-m1.mjs",
  "scripts/verify-m2.mjs",
  "scripts/verify-m2-bundle.mjs",
  "spec/m2/proto/jpyxis_invocation_v1.proto",
  "spec/m2/definitions/example_affine_v1.py",
  "invocation/java/pom.xml",
  "invocation/java/src/main/java/io/jpyxis/host/AffineBatchMapper.java",
  "invocation/java/src/main/java/io/jpyxis/invocation/InvocationManager.java",
  "invocation/java/src/main/java/io/jpyxis/invocation/transport/InvocationTransport.java",
  "invocation/java/src/main/java/io/jpyxis/invocation/transport/grpc/GrpcInvocationTransport.java",
  "invocation/python/requirements-m2.txt",
  "invocation/python/jpyxis_worker/server.py",
];

const prematureM3Entries = [
  "plugins",
  "jpyxis-core",
  "jpyxis-control",
  "runtime-spi",
  "invocation/runtime",
];

function fail(message) {
  failures.push(message);
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "build" || entry.name === "target"
        || entry.name === "__pycache__") return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing required file: ${relative}`);
}

for (const relative of prematureM3Entries) {
  if (fs.existsSync(path.join(root, relative))) {
    fail(`M2 repository contains premature M3 implementation entry: ${relative}`);
  }
}

const files = listFiles(root);
const textExtensions = new Set([
  "", ".cmd", ".java", ".json", ".md", ".mjs", ".properties", ".proto", ".py", ".xml", ".yaml", ".yml",
]);
const textFiles = files.filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
const markdownFiles = textFiles.filter((file) => path.extname(file).toLowerCase() === ".md");
const localLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const sensitivePatterns = [
  { label: "Windows user path", pattern: /[A-Za-z]:[\\/]Users[\\/]/ },
  { label: "Unix home path", pattern: /\/(?:Users|home)\/[^/\s]+\// },
  { label: "private key", pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
];

for (const file of textFiles) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const content = fs.readFileSync(file, "utf8");
  if (!content.endsWith("\n")) fail(`${relative}: missing final newline`);
  content.split(/\r?\n/).forEach((line, index) => {
    if (/[ \t]+$/.test(line)) fail(`${relative}:${index + 1}: trailing whitespace`);
  });
  for (const { label, pattern } of sensitivePatterns) {
    if (pattern.test(content)) fail(`${relative}: contains ${label}`);
  }
}

for (const file of markdownFiles) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(localLinkPattern)) {
    const target = match[1].trim();
    if (/^(?:https?:\/\/|mailto:|#)/.test(target)) continue;
    const pathname = decodeURIComponent(target.split("#", 1)[0]);
    if (pathname && !fs.existsSync(path.resolve(path.dirname(file), pathname))) {
      fail(`${relative}: broken relative link ${target}`);
    }
  }
}

const m1Java = readTreeText("bindings/java", new Set([".java", ".xml"]));
const m1Python = readTreeText("bindings/python", new Set([".py"]));
for (const [label, pattern] of [
  ["gRPC", /\bio\.grpc\b|grpcio/],
  ["Protocol Buffers", /\bcom\.google\.protobuf\b|protobuf-java/],
  ["NumPy runtime", /(?:^|\n)\s*(?:import|from)\s+numpy\b/],
]) {
  if (pattern.test(`${m1Java}\n${m1Python}`)) fail(`frozen M1 binding acquired an M2 dependency: ${label}`);
}
if (/ProcessBuilder|Runtime\.getRuntime|jpyxis_contract|import\s+.*python/i.test(m1Java)) {
  fail("frozen Java M1 binding contains cross-binding execution");
}
if (/(?:^|\n)\s*(?:import|from)\s+(?:subprocess|jpype|py4j|java)\b|subprocess\./i.test(m1Python)) {
  fail("frozen Python M1 binding contains Java or subprocess execution");
}

const hostApi = readTreeText(
  "invocation/java/src/main/java/io/jpyxis/host", new Set([".java"]),
);
for (const [label, pattern] of [
  ["gRPC", /\bio\.grpc\b/],
  ["generated Protobuf", /\bcom\.google\.protobuf\b|invocation\.wire/],
  ["Python", /\bpython\b/i],
  ["NumPy", /\bnumpy\b/i],
]) {
  if (pattern.test(hostApi)) fail(`public Java host API leaks ${label}`);
}

const implementationText = readTreeText("invocation", new Set([".java", ".py", ".xml"]));
for (const [label, pattern] of [
  ["Spring", /\borg\.springframework\b/],
  ["database", /\b(?:jdbc|redis|mongodb|hibernate)\b/i],
  ["message queue", /\b(?:kafka|rabbitmq|activemq)\b/i],
  ["future runtime", /(?:^|\n)\s*(?:import|from)\s+(?:torch|onnxruntime|pyarrow)\b/],
]) {
  if (pattern.test(implementationText)) fail(`M2 implementation contains out-of-scope ${label} dependency`);
}

const invocationJavaRoot = path.join(root, "invocation/java/src/main/java");
for (const file of listFiles(invocationJavaRoot).filter((item) => item.endsWith(".java"))) {
  const relative = path.relative(invocationJavaRoot, file).replaceAll(path.sep, "/");
  const content = fs.readFileSync(file, "utf8");
  const isGrpcAdapter = relative.startsWith("io/jpyxis/invocation/transport/grpc/");
  if (!isGrpcAdapter && /\b(?:io\.grpc|com\.google\.protobuf|io\.jpyxis\.invocation\.wire)\b/.test(content)) {
    fail(`${relative}: carrier implementation leaked outside the gRPC adapter`);
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const statement of [
  "M2 INVOCATION FROZEN · M3 RUNTIME ABSTRACTION NEXT",
  "M2 invocation prototype",
  "Core defines semantics; plugins provide capabilities.",
  "M0 Architecture",
  "M1 Contract",
  "E1 High-performance Data Plane",
]) {
  if (!readme.includes(statement)) fail(`README.md: missing boundary statement: ${statement}`);
}

const workflowText = fs.readFileSync(path.join(root, ".github/workflows/repository-gates.yml"), "utf8");
for (const statement of [
  "Verify M2 invocation repository",
  "node scripts/verify-m2.mjs",
  "build/m2/runs",
]) {
  if (!workflowText.includes(statement)) fail(`repository workflow is missing: ${statement}`);
}

const wrapperProperties = fs.readFileSync(
  path.join(root, ".mvn/wrapper/maven-wrapper.properties"),
  "utf8",
);
for (const statement of [
  "apache-maven-3.9.11-bin.zip",
  "distributionSha256Sum=0d7125e8c91097b36edb990ea5934e6c68b4440eef4ea96510a0f6815e7eeadb",
]) {
  if (!wrapperProperties.includes(statement)) fail(`Maven wrapper lock is missing: ${statement}`);
}

for (const workflow of files.filter((file) => /\.github[\\/]workflows[\\/].+\.ya?ml$/.test(file))) {
  const content = fs.readFileSync(workflow, "utf8");
  content.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^\s*uses:\s*[^@\s]+@([^\s#]+)/);
    if (match && !/^[0-9a-f]{40}$/.test(match[1])) {
      fail(`${path.relative(root, workflow)}:${index + 1}: action is not pinned to a commit SHA`);
    }
  });
}

const review = fs.existsSync(path.join(root, "docs/reviews/m1-contract-review.md"))
  ? fs.readFileSync(path.join(root, "docs/reviews/m1-contract-review.md"), "utf8")
  : "";
for (const statement of [
  "FROZEN FOR M2 ENTRY",
  "m1-contract-v1",
  "38 cases",
  "8051f6d252fbbee4fb53341aadfe9e4a173e81ec",
  "33852395736",
]) {
  if (!review.includes(statement)) fail(`M1 review is missing: ${statement}`);
}

const evidenceManifest = fs.existsSync(path.join(root, "evidence/m1/freeze-manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "evidence/m1/freeze-manifest.json"), "utf8"))
  : {};
for (const [label, actual, expected] of [
  ["schema version", evidenceManifest.schemaVersion, "jpyxis.io/milestone-evidence/v1alpha1"],
  ["milestone", evidenceManifest.milestone, "M1"],
  ["evidence state", evidenceManifest.evidenceState, "VALIDATED"],
  ["freeze coordinate", evidenceManifest.freezeCoordinate, "m1-contract-v1"],
  ["case count", evidenceManifest.caseCount, 38],
  [
    "implementation merge",
    evidenceManifest.implementation?.mergeSha,
    "8051f6d252fbbee4fb53341aadfe9e4a173e81ec",
  ],
  ["main CI run", evidenceManifest.publicEvidence?.mainRun?.id, 33852395736],
]) {
  if (actual !== expected) fail(`M1 evidence manifest has wrong ${label}: ${actual}`);
}

const m2EvidenceManifest = fs.existsSync(path.join(root, "evidence/m2/freeze-manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "evidence/m2/freeze-manifest.json"), "utf8"))
  : {};
for (const [label, actual, expected] of [
  ["schema version", m2EvidenceManifest.schemaVersion, "jpyxis.io/milestone-evidence/v1alpha1"],
  ["milestone", m2EvidenceManifest.milestone, "M2"],
  ["evidence state", m2EvidenceManifest.evidenceState, "VALIDATED"],
  ["freeze coordinate", m2EvidenceManifest.freezeCoordinate, "m2-invocation-v1"],
  ["scenario count", m2EvidenceManifest.scenarioCount, 24],
  ["executable scenarios", m2EvidenceManifest.scenarioGroups?.executable, 18],
  ["mutation scenarios", m2EvidenceManifest.scenarioGroups?.evidenceMutation, 5],
  ["verifier-failure scenarios", m2EvidenceManifest.scenarioGroups?.verifierFailure, 1],
  [
    "implementation merge",
    m2EvidenceManifest.implementation?.mergeSha,
    "67870a1cacb216450817d401727f929c086d729c",
  ],
  ["main CI run", m2EvidenceManifest.publicEvidence?.mainRun?.id, 33859986888],
  [
    "public summary digest",
    m2EvidenceManifest.publicEvidence?.conformanceSummarySha256,
    "sha256:99977d50098b62c2c3e6f77e8a5baa9a45056012cd6aa2ca07b9da1239af65a0",
  ],
]) {
  if (actual !== expected) fail(`M2 evidence manifest has wrong ${label}: ${actual}`);
}

if (failures.length > 0) {
  console.error(`Repository verification failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Repository verification passed: ${textFiles.length} text files, ${markdownFiles.length} Markdown files, M1 freeze and M2 invocation boundaries intact.`,
);

function readTreeText(relative, extensions) {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return "";
  return listFiles(directory)
    .filter((file) => extensions.has(path.extname(file).toLowerCase()))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

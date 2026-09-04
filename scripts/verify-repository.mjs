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
  "docs/adr/0008-m3-runtime-capability-resolution.md",
  "docs/adr/0009-m4-lifecycle-authority-and-cutover.md",
  "docs/adr/0010-m5-resilience-authority-and-recovery.md",
  "docs/spec/m1-contract-profile.md",
  "docs/spec/m2-invocation-profile.md",
  "docs/spec/m3-runtime-profile.md",
  "docs/spec/m4-lifecycle-profile.md",
  "docs/spec/m5-resilience-profile.md",
  "docs/reviews/m0-review-gate.md",
  "docs/reviews/m1-contract-review.md",
  "docs/reviews/m2-invocation-review.md",
  "docs/reviews/m3-runtime-review.md",
  "docs/reviews/m4-lifecycle-review.md",
  "docs/reviews/m5-resilience-review.md",
  "evidence/m1/freeze-manifest.json",
  "evidence/m2/freeze-manifest.json",
  "evidence/m3/freeze-manifest.json",
  "evidence/m4/freeze-manifest.json",
  "evidence/m5/freeze-manifest.json",
  "spec/m1/contracts/example.affine-batch.v1.json",
  "spec/m1/corpus/conformance.json",
  "spec/m1/identity.lock.json",
  "bindings/java/pom.xml",
  "bindings/java/src/main/java/io/jpyxis/contract/ContractParser.java",
  "bindings/python/jpyxis_contract/parser.py",
  "scripts/verify-m1.mjs",
  "scripts/verify-m2.mjs",
  "scripts/verify-m2-bundle.mjs",
  "scripts/verify-m3.mjs",
  "scripts/verify-m3-bundle.mjs",
  "scripts/verify-m3-evidence.mjs",
  "spec/m2/proto/jpyxis_invocation_v1.proto",
  "spec/m2/definitions/example_affine_v1.py",
  "invocation/java/pom.xml",
  "invocation/java/src/main/java/io/jpyxis/host/AffineBatchMapper.java",
  "invocation/java/src/main/java/io/jpyxis/invocation/InvocationManager.java",
  "invocation/java/src/main/java/io/jpyxis/invocation/transport/InvocationTransport.java",
  "invocation/java/src/main/java/io/jpyxis/invocation/transport/grpc/GrpcInvocationTransport.java",
  "invocation/python/requirements-m2.txt",
  "invocation/python/jpyxis_worker/server.py",
  "invocation/python/jpyxis_worker/m3_server.py",
  "invocation/python/jpyxis_worker/runtime_spi.py",
  "invocation/python/jpyxis_worker/worker_common.py",
  "invocation/python/jpyxis_worker/runtimes/numpy_runtime.py",
  "invocation/python/jpyxis_worker/runtimes/reference_runtime.py",
  "invocation/python/requirements-m3.txt",
  "spec/m3/definitions/example_affine_plan_v1.py",
  "spec/m4/artifacts/example_affine_plan_v2.py",
  "lifecycle/java/pom.xml",
  "lifecycle/java/src/main/java/io/jpyxis/lifecycle/core/ArtifactRegistry.java",
  "lifecycle/java/src/main/java/io/jpyxis/lifecycle/core/DeploymentManager.java",
  "lifecycle/java/src/main/java/io/jpyxis/lifecycle/port/DeploymentRuntime.java",
  "scripts/verify-m4.mjs",
  "scripts/verify-m4-bundle.mjs",
  "scripts/verify-m4-evidence.mjs",
  "resilience/java/pom.xml",
  "resilience/java/src/main/java/io/jpyxis/resilience/core/WorkerSupervisor.java",
  "resilience/java/src/main/java/io/jpyxis/resilience/core/ResilientInvocationManager.java",
  "resilience/java/src/main/java/io/jpyxis/resilience/core/ControlIntentRegistry.java",
  "resilience/java/src/main/java/io/jpyxis/resilience/evidence/DurableResilienceJournal.java",
  "resilience/java/src/main/java/io/jpyxis/resilience/assembly/ControlRecoveryCoordinator.java",
  "scripts/verify-m5.mjs",
  "scripts/verify-m5-bundle.mjs",
  "scripts/verify-m5-evidence.mjs",
];

const prematureM6Entries = [
  "evidence/m6",
  "docs/reviews/m6-reproducibility-review.md",
  "scripts/verify-m6.mjs",
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

for (const relative of prematureM6Entries) {
  if (fs.existsSync(path.join(root, relative))) {
    fail(`M5 freeze contains premature M6 evidence entry: ${relative}`);
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
  if (pattern.test(implementationText)) fail(`M3 implementation contains out-of-scope ${label} dependency`);
}

const runtimeNeutralText = [
  "invocation/python/jpyxis_worker/runtime_spi.py",
  "invocation/python/jpyxis_worker/m3_server.py",
  "spec/m3/definitions/example_affine_plan_v1.py",
  "invocation/java/src/main/java/io/jpyxis/invocation/InvocationManager.java",
].map((relative) => fs.readFileSync(path.join(root, relative), "utf8")).join("\n");
for (const [label, pattern] of [
  ["NumPy provider identity", /numpy\.cpu/],
  ["reference provider identity", /python\.reference/],
  ["NumPy value", /(?:^|\n)\s*(?:import|from)\s+numpy\b/],
]) {
  if (pattern.test(runtimeNeutralText)) fail(`M3 neutral runtime boundary leaks ${label}`);
}
for (const relative of [
  "invocation/python/jpyxis_worker/runtimes/numpy_runtime.py",
  "invocation/python/jpyxis_worker/runtimes/reference_runtime.py",
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (/jpyxis_invocation_v1_pb2|io\.jpyxis\.host/.test(source)) {
    fail(`${relative}: runtime provider imports an outer carrier or host type`);
  }
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

const lifecycleText = readTreeText("lifecycle/java/src/main/java", new Set([".java"]));
for (const [label, pattern] of [
  ["M2/M3 invocation implementation", /io\.jpyxis\.(?:invocation|host)/],
  ["gRPC", /\bio\.grpc\b/],
  ["generated Protobuf", /\bcom\.google\.protobuf\b/],
  ["Spring", /\borg\.springframework\b/],
  ["Python or Runtime product", /\b(?:python|numpy|onnxruntime|torch)\b/i],
]) {
  if (pattern.test(lifecycleText)) fail(`M4 lifecycle module imports ${label}`);
}
const lifecycleCoreText = readTreeText(
  "lifecycle/java/src/main/java/io/jpyxis/lifecycle/core", new Set([".java"]),
);
if (/io\.jpyxis\.lifecycle\.reference|com\.fasterxml\.jackson/.test(lifecycleCoreText)) {
  fail("M4 Core imports a reference fixture or evidence encoding");
}
const invocationJavaText = readTreeText("invocation/java/src/main/java", new Set([".java"]));
if (/io\.jpyxis\.lifecycle/.test(invocationJavaText)) {
  fail("frozen M2/M3 invocation module depends backwards on M4 lifecycle");
}

const resilienceSemanticText = ["api", "core", "evidence", "port"]
  .map((name) => readTreeText(
    `resilience/java/src/main/java/io/jpyxis/resilience/${name}`, new Set([".java"]),
  ))
  .join("\n");
for (const [label, pattern] of [
  ["M4 lifecycle implementation", /io\.jpyxis\.lifecycle/],
  ["reference or assembly implementation", /io\.jpyxis\.resilience\.(?:reference|assembly)/],
  ["gRPC", /\bio\.grpc\b/],
  ["generated Protobuf", /\bcom\.google\.protobuf\b/],
  ["Spring", /\borg\.springframework\b/],
  ["Python or Runtime product", /\b(?:python|numpy|onnxruntime|torch)\b/i],
]) {
  if (pattern.test(resilienceSemanticText)) fail(`M5 semantic boundary imports ${label}`);
}
const resilienceCoreText = readTreeText(
  "resilience/java/src/main/java/io/jpyxis/resilience/core", new Set([".java"]),
);
if (/com\.fasterxml\.jackson|java\.nio\.file|ProcessBuilder/.test(resilienceCoreText)) {
  fail("M5 Core owns an evidence encoding, filesystem, or process implementation");
}
if (/io\.jpyxis\.resilience/.test(invocationJavaText) || /io\.jpyxis\.resilience/.test(lifecycleText)) {
  fail("a frozen predecessor depends forward on M5 resilience");
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const statement of [
  "M0–M5 FROZEN · M6 REPRODUCIBILITY NEXT",
  "M2 invocation prototype",
  "M3 runtime abstraction prototype",
  "M4 lifecycle prototype",
  "M5 resilience prototype",
  "Core defines semantics; plugins provide capabilities.",
  "M0 Architecture",
  "M1 Contract",
  "E1 High-performance Data Plane",
]) {
  if (!readme.includes(statement)) fail(`README.md: missing boundary statement: ${statement}`);
}

const workflowText = fs.readFileSync(path.join(root, ".github/workflows/repository-gates.yml"), "utf8");
for (const statement of [
  "Verify M5 resilience repository",
  "node scripts/verify-m2.mjs",
  "node scripts/verify-m3.mjs",
  "node scripts/verify-m4.mjs",
  "node scripts/verify-m5.mjs",
  "build/m2/runs",
  "build/m3/runs",
  "build/m4/runs",
  "build/m5/runs",
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

const m3EvidenceManifest = fs.existsSync(path.join(root, "evidence/m3/freeze-manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "evidence/m3/freeze-manifest.json"), "utf8"))
  : {};
const m3Review = fs.existsSync(path.join(root, "docs/reviews/m3-runtime-review.md"))
  ? fs.readFileSync(path.join(root, "docs/reviews/m3-runtime-review.md"), "utf8")
  : "";
for (const statement of [
  "FROZEN FOR M4 ENTRY",
  "m3-runtime-v1",
  "ten scenarios",
  "8c54840733335be18cbe006f273e5994d3a931eb",
  "33867080260",
]) {
  if (!m3Review.includes(statement)) fail(`M3 review is missing: ${statement}`);
}
for (const [label, actual, expected] of [
  ["schema version", m3EvidenceManifest.schemaVersion, "jpyxis.io/milestone-evidence/v1alpha1"],
  ["milestone", m3EvidenceManifest.milestone, "M3"],
  ["evidence state", m3EvidenceManifest.evidenceState, "VALIDATED"],
  ["freeze coordinate", m3EvidenceManifest.freezeCoordinate, "m3-runtime-v1"],
  ["scenario count", m3EvidenceManifest.scenarioCount, 10],
  ["executable scenarios", m3EvidenceManifest.scenarioGroups?.executable, 8],
  ["mutation scenarios", m3EvidenceManifest.scenarioGroups?.evidenceMutation, 2],
  [
    "implementation merge",
    m3EvidenceManifest.implementation?.mergeSha,
    "eb5950576168c872e0014b2fb27901de7081bcc4",
  ],
  ["main CI run", m3EvidenceManifest.publicEvidence?.mainRun?.id, 33867080260],
  ["pull-request CI run", m3EvidenceManifest.publicEvidence?.pullRequestRun?.id, 33866645415],
  ["first Runtime fixture", m3EvidenceManifest.runtimeFixtures?.[0], "numpy.cpu@2.2.6"],
  ["second Runtime fixture", m3EvidenceManifest.runtimeFixtures?.[1], "python.reference@3.12.14"],
  [
    "public summary digest",
    m3EvidenceManifest.publicEvidence?.conformanceSummarySha256,
    "sha256:878a5c91cf765dae16b9a3a39a719c7ae9bee43d0bffc94f4fd6687af56d837f",
  ],
]) {
  if (actual !== expected) fail(`M3 evidence manifest has wrong ${label}: ${actual}`);
}

const m4EvidenceManifest = fs.existsSync(path.join(root, "evidence/m4/freeze-manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "evidence/m4/freeze-manifest.json"), "utf8"))
  : {};
const m4Review = fs.existsSync(path.join(root, "docs/reviews/m4-lifecycle-review.md"))
  ? fs.readFileSync(path.join(root, "docs/reviews/m4-lifecycle-review.md"), "utf8")
  : "";
for (const statement of [
  "Status: `FROZEN FOR M5 ENTRY`",
  "`ArtifactRegistry` alone changes artifact state",
  "`DeploymentManager` alone changes deployment state",
  "206b7478d8cb94988b855482f9310d79fff5d31d04663a95f2664462324b575e",
  "m4-lifecycle-v1",
]) {
  if (!m4Review.includes(statement)) fail(`M4 review is missing: ${statement}`);
}
for (const [label, actual, expected] of [
  ["schema version", m4EvidenceManifest.schemaVersion, "jpyxis.io/milestone-evidence/v1alpha1"],
  ["milestone", m4EvidenceManifest.milestone, "M4"],
  ["evidence state", m4EvidenceManifest.evidenceState, "VALIDATED"],
  ["freeze coordinate", m4EvidenceManifest.freezeCoordinate, "m4-lifecycle-v1"],
  ["scenario count", m4EvidenceManifest.scenarioCount, 11],
  ["executable scenarios", m4EvidenceManifest.scenarioGroups?.executable, 9],
  ["mutation scenarios", m4EvidenceManifest.scenarioGroups?.evidenceMutation, 2],
  [
    "implementation merge",
    m4EvidenceManifest.implementation?.mergeSha,
    "9658aba368302f594505be9aa51854fd683227bf",
  ],
  ["main CI run", m4EvidenceManifest.publicEvidence?.mainRun?.id, 33875311460],
  ["pull-request CI run", m4EvidenceManifest.publicEvidence?.pullRequestRun?.id, 33874834785],
  [
    "v1 artifact digest",
    m4EvidenceManifest.artifacts?.[0]?.digest,
    "sha256:0b3eb8dff3b6cebf6945b100545b37cddb8e62c90664330c08ad3031321ed26b",
  ],
  [
    "v2 artifact digest",
    m4EvidenceManifest.artifacts?.[1]?.digest,
    "sha256:b520c6a2ee781613e93cd7d6e9fa428dbb8ae666772d15ca8eca0a7b5cf014f0",
  ],
  [
    "public summary digest",
    m4EvidenceManifest.publicEvidence?.conformanceSummarySha256,
    "sha256:206b7478d8cb94988b855482f9310d79fff5d31d04663a95f2664462324b575e",
  ],
]) {
  if (actual !== expected) fail(`M4 evidence manifest has wrong ${label}: ${actual}`);
}

const m5EvidenceManifest = fs.existsSync(path.join(root, "evidence/m5/freeze-manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "evidence/m5/freeze-manifest.json"), "utf8"))
  : {};
const m5Review = fs.existsSync(path.join(root, "docs/reviews/m5-resilience-review.md"))
  ? fs.readFileSync(path.join(root, "docs/reviews/m5-resilience-review.md"), "utf8")
  : "";
for (const statement of [
  "Status: `FROZEN FOR M6 ENTRY`",
  "`WorkerSupervisor` alone owns local worker instance state and routing eligibility",
  "`ResilientInvocationManager` separates one logical invocation from its bounded attempts",
  "ee3e82cba98b44f0344a3c4316aab367ccc7183b0e0084fb9094f9c290fdf8e9",
  "m5-resilience-v1",
]) {
  if (!m5Review.includes(statement)) fail(`M5 review is missing: ${statement}`);
}
for (const [label, actual, expected] of [
  ["schema version", m5EvidenceManifest.schemaVersion, "jpyxis.io/milestone-evidence/v1alpha1"],
  ["milestone", m5EvidenceManifest.milestone, "M5"],
  ["evidence state", m5EvidenceManifest.evidenceState, "VALIDATED"],
  ["freeze coordinate", m5EvidenceManifest.freezeCoordinate, "m5-resilience-v1"],
  ["scenario count", m5EvidenceManifest.scenarioCount, 16],
  ["executable scenarios", m5EvidenceManifest.scenarioGroups?.executable, 12],
  ["mutation scenarios", m5EvidenceManifest.scenarioGroups?.evidenceMutation, 4],
  ["Java test count", m5EvidenceManifest.testCount, 15],
  [
    "reviewed head",
    m5EvidenceManifest.implementation?.reviewedHeadSha,
    "49f4baf9025d8a0d3290ddcfee2221ed0ae38d2b",
  ],
  [
    "reviewed merge revision",
    m5EvidenceManifest.implementation?.reviewedMergeRevision,
    "61541915db47748d48226aa048ff0472d6fda05a",
  ],
  [
    "implementation merge",
    m5EvidenceManifest.implementation?.mergeSha,
    "5097d5dbfbe431bdc1f9480e70fca58e0274912c",
  ],
  ["pull-request CI run", m5EvidenceManifest.publicEvidence?.pullRequestRun?.id, 33882755890],
  ["pull-request artifact", m5EvidenceManifest.publicEvidence?.pullRequestRun?.artifactId, 9940660473],
  ["main CI run", m5EvidenceManifest.publicEvidence?.mainRun?.id, 33883312634],
  ["main artifact", m5EvidenceManifest.publicEvidence?.mainRun?.artifactId, 9940898688],
  [
    "public summary digest",
    m5EvidenceManifest.publicEvidence?.conformanceSummarySha256,
    "sha256:ee3e82cba98b44f0344a3c4316aab367ccc7183b0e0084fb9094f9c290fdf8e9",
  ],
]) {
  if (actual !== expected) fail(`M5 evidence manifest has wrong ${label}: ${actual}`);
}
for (const assertion of [
  "durableHashChainedJournal",
  "workerEligibilityHasSingleAuthority",
  "workerEpochFencingOnRestart",
  "logicalInvocationAndAttemptsAreSeparate",
  "retryRequiresIdempotencyEvidence",
  "retryBudgetIsBounded",
  "uncertainOutcomeIsExplicit",
  "lateObservationCannotRewriteTerminal",
  "desiredIntentAndActualDeploymentAreSeparate",
  "restartReconcilesThroughM4PublicActions",
  "telemetryFailureCannotRewriteState",
  "realLocalWorkerProcessesAreSupervised",
  "offlineBundleVerification",
]) {
  if (m5EvidenceManifest.assertions?.[assertion] !== true) {
    fail(`M5 evidence manifest is missing assertion: ${assertion}`);
  }
}

if (failures.length > 0) {
  console.error(`Repository verification failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Repository verification passed: ${textFiles.length} text files, ${markdownFiles.length} Markdown files, M1-M5 freezes intact and M6 remains unimplemented.`,
);

function readTreeText(relative, extensions) {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return "";
  return listFiles(directory)
    .filter((file) => extensions.has(path.extname(file).toLowerCase()))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

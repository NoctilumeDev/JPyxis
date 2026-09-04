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
  "docs/spec/m1-contract-profile.md",
  "docs/reviews/m0-review-gate.md",
  "docs/reviews/m1-contract-review.md",
  "spec/m1/contracts/example.affine-batch.v1.json",
  "spec/m1/corpus/conformance.json",
  "spec/m1/identity.lock.json",
  "bindings/java/pom.xml",
  "bindings/java/src/main/java/io/jpyxis/contract/ContractParser.java",
  "bindings/python/jpyxis_contract/parser.py",
  "scripts/verify-m1.mjs",
];

const prematureM2Entries = [
  "proto",
  "plugins",
  "jpyxis-core",
  "jpyxis-control",
  "jpyxis-host-java",
  "bindings/python/jpyxis_worker",
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

for (const relative of prematureM2Entries) {
  if (fs.existsSync(path.join(root, relative))) {
    fail(`M1 repository contains premature M2 implementation entry: ${relative}`);
  }
}

const files = listFiles(root);
const textExtensions = new Set([
  "", ".cmd", ".java", ".json", ".md", ".mjs", ".properties", ".py", ".xml", ".yaml", ".yml",
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

const implementationText = files
  .filter((file) => [".java", ".py", ".xml"].includes(path.extname(file).toLowerCase()))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
for (const [label, pattern] of [
  ["gRPC", /\bio\.grpc\b|grpcio/],
  ["Protocol Buffers", /\bcom\.google\.protobuf\b|protobuf-java/],
  ["NumPy runtime", /(?:^|\n)\s*(?:import|from)\s+numpy\b/],
  ["Spring", /\borg\.springframework\b/],
]) {
  if (pattern.test(implementationText)) fail(`premature M2 dependency detected: ${label}`);
}

const javaImplementation = files
  .filter((file) => path.extname(file).toLowerCase() === ".java")
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const pythonImplementation = files
  .filter((file) => path.extname(file).toLowerCase() === ".py")
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
if (/ProcessBuilder|Runtime\.getRuntime|jpyxis_contract|import\s+.*python/i.test(javaImplementation)) {
  fail("Java binding contains a cross-binding execution or Python dependency");
}
if (/(?:^|\n)\s*(?:import|from)\s+(?:subprocess|jpype|py4j|java)\b|subprocess\./i.test(
  pythonImplementation,
)) {
  fail("Python binding contains a cross-binding execution or Java dependency");
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const statement of [
  "M1 CONTRACT PROTOTYPE · CLOSURE REVIEW PENDING · M2 BLOCKED",
  "No cross-process invocation exists yet.",
  "Core defines semantics; plugins provide capabilities.",
  "M0 Architecture",
  "M1 Contract",
  "E1 High-performance Data Plane",
]) {
  if (!readme.includes(statement)) fail(`README.md: missing boundary statement: ${statement}`);
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
for (const statement of ["CLOSURE REVIEW PENDING", "M2 remains blocked", "38 cases"]) {
  if (!review.includes(statement)) fail(`M1 review is missing: ${statement}`);
}

if (failures.length > 0) {
  console.error(`Repository verification failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Repository verification passed: ${textFiles.length} text files, ${markdownFiles.length} Markdown files, M1-only implementation boundary intact.`,
);

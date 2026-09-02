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
  "docs/conceptual-origin.md",
  "docs/project-charter.md",
  "docs/vision.md",
  "docs/glossary.md",
  "docs/evidence-policy.md",
  "docs/architecture/system-blueprint.md",
  "docs/architecture/constitution.md",
  "docs/architecture/ownership.md",
  "docs/architecture/dependency-rules.md",
  "docs/architecture/state-machines.md",
  "docs/architecture/failure-model.md",
  "docs/architecture/contract-principles.md",
  "docs/research/prior-art-matrix.md",
  "docs/research/references.md",
  "docs/research/review-protocol.md",
  "docs/research/evidence-traceability.md",
  "docs/research/research-questions.md",
  "docs/roadmap/single-node-baseline.md",
  "docs/roadmap/evolution-map.md",
  "docs/adr/0004-first-reference-vertical-slice.md",
  "docs/reviews/m0-review-gate.md",
  "docs/reviews/m0-literature-closure.md",
];

const forbiddenImplementationEntries = [
  "src",
  "pom.xml",
  "build.gradle",
  "settings.gradle",
  "pyproject.toml",
  "requirements.txt",
  "package.json",
  "compose.yaml",
  "Dockerfile",
];

function fail(message) {
  failures.push(message);
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing required file: ${relative}`);
}

for (const relative of forbiddenImplementationEntries) {
  if (fs.existsSync(path.join(root, relative))) {
    fail(`M0 blueprint repository contains premature implementation entry: ${relative}`);
  }
}

const files = listFiles(root);
const textExtensions = new Set(["", ".md", ".mjs", ".yml", ".yaml", ".json"]);
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
    if (!pathname) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), pathname))) {
      fail(`${relative}: broken relative link ${target}`);
    }
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const requiredReadmeStatements = [
  "M0 FROZEN · M1 CONTRACT NEXT · BLUEPRINT ONLY",
  "No framework implementation exists in this repository.",
  "Core defines semantics; plugins provide capabilities.",
  "M0 Architecture",
  "E1 High-performance Data Plane",
];

for (const statement of requiredReadmeStatements) {
  if (!readme.includes(statement)) fail(`README.md: missing boundary statement: ${statement}`);
}

const evolution = fs.readFileSync(path.join(root, "docs/roadmap/evolution-map.md"), "utf8");
if (!evolution.includes("DIRECTION ONLY · NOT COMMITTED")) {
  fail("evolution map does not state its non-commitment boundary");
}

const m0Review = fs.readFileSync(path.join(root, "docs/reviews/m0-review-gate.md"), "utf8");
for (const statement of ["FROZEN FOR M1 ENTRY", "m0-blueprint-v1", "example.affine-batch"]) {
  if (!m0Review.includes(statement)) fail(`M0 review gate is missing: ${statement}`);
}

const literatureClosure = fs.readFileSync(
  path.join(root, "docs/reviews/m0-literature-closure.md"),
  "utf8",
);
for (const statement of [
  "CLOSED · EVIDENCE ADDENDUM · NO SEMANTIC RE-FREEZE",
  "40 primary sources",
  "no semantic re-freeze",
]) {
  if (!literatureClosure.includes(statement)) {
    fail(`M0 literature closure is missing: ${statement}`);
  }
}

const traceability = fs.readFileSync(
  path.join(root, "docs/research/evidence-traceability.md"),
  "utf8",
);
for (let index = 1; index <= 7; index += 1) {
  if (!traceability.includes(`RQ${index}`)) {
    fail(`evidence traceability is missing RQ${index}`);
  }
}

const references = fs.readFileSync(path.join(root, "docs/research/references.md"), "utf8");
for (const statement of ["WIRE-03", "WIRE-07", "EVID-02", "Living documentation"]) {
  if (!references.includes(statement)) fail(`primary references are missing: ${statement}`);
}

const constitution = fs.readFileSync(
  path.join(root, "docs/architecture/constitution.md"),
  "utf8",
);
for (const principle of [
  "one fact has one final authority",
  "Core defines semantics; plugins provide capabilities",
  "events cross boundaries; state ownership does not",
]) {
  if (!constitution.includes(principle)) {
    fail(`constitution is missing principle: ${principle}`);
  }
}

if (failures.length > 0) {
  console.error(`Blueprint verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Blueprint verification passed: ${textFiles.length} text files, ${markdownFiles.length} Markdown files, no framework implementation.`,
);

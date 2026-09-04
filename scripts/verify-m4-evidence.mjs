import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { verifyM4Bundle } from "./verify-m4-bundle.mjs";

const executableScenarios = [
  "activate_v1",
  "unvalidated_artifact_rejected",
  "artifact_identity_conflict",
  "warm_failure_preserves_active",
  "activation_precondition_preserves_active",
  "atomic_cutover_and_pinning",
  "draining_rejects_new",
  "forced_termination_defined",
  "rollback_immutable",
];

const mutationScenarios = new Map([
  ["bundle_missing", "INCONCLUSIVE"],
  ["bundle_corrupt", "FAIL"],
]);

export function verifyM4Evidence(buildRoot) {
  const failures = [];
  const summaryPath = path.join(buildRoot, "conformance-summary.json");
  if (!fs.existsSync(summaryPath)) {
    return { verdict: "INCONCLUSIVE", failures: ["missing M4 conformance summary"] };
  }
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  } catch {
    return { verdict: "INCONCLUSIVE", failures: ["unreadable M4 conformance summary"] };
  }

  if (summary.schemaVersion !== "jpyxis.io/m4-conformance-summary/v1alpha1") {
    failures.push("wrong M4 summary schema");
  }
  if (summary.scenarioCount !== 11
      || summary.executableScenarios !== 9
      || summary.mutationScenarios !== 2) {
    failures.push("wrong M4 scenario counts");
  }
  const expectedAssertions = [
    "artifactIdentityIsImmutable",
    "onlyValidatedArtifactsLoad",
    "failedCandidatePreservesActive",
    "atomicActiveBinding",
    "inFlightInvocationPinning",
    "drainingRejectsNewWork",
    "forcedTerminationIsExplicit",
    "rollbackReusesImmutableArtifact",
    "slowCapabilityCallsStayOutsideStateLock",
    "offlineBundleVerification",
  ];
  for (const assertion of expectedAssertions) {
    if (summary.assertions?.[assertion] !== true) failures.push(`missing assertion: ${assertion}`);
  }

  for (const scenario of executableScenarios) {
    const result = verifyM4Bundle(path.join(buildRoot, "runs", scenario), { writeVerdict: false });
    if (result.verdict !== "PASS") {
      failures.push(`${scenario}: expected PASS, got ${result.verdict}`);
    }
  }
  for (const [scenario, expected] of mutationScenarios) {
    const result = verifyM4Bundle(path.join(buildRoot, "runs", scenario), { writeVerdict: false });
    if (result.verdict !== expected) {
      failures.push(`${scenario}: expected ${expected}, got ${result.verdict}`);
    }
  }

  return { verdict: failures.length === 0 ? "PASS" : "FAIL", failures };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
if (invokedDirectly) {
  const target = path.resolve(process.argv[2] ?? path.join(process.cwd(), "build", "m4"));
  const result = verifyM4Evidence(target);
  console.log(`M4 retained evidence: ${result.verdict}`);
  for (const failure of result.failures) console.error(`- ${failure}`);
  if (result.verdict !== "PASS") process.exit(1);
}

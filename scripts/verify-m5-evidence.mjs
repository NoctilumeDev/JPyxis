import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { verifyM5Bundle } from "./verify-m5-bundle.mjs";

const executableScenarios = [
  "two_workers_eligible_route",
  "load_failure_preserves_active",
  "warmup_crash_preserves_active",
  "unknown_outcome_retry_denied",
  "deduplicated_retry_succeeds",
  "drain_crash_requires_termination",
  "unload_failure_preserves_active",
  "retry_budget_exhausted",
  "restart_blocks_unsafe_retry",
  "restart_reconciles_and_retries",
  "telemetry_failure_isolated",
  "late_observation_cannot_rewrite_terminal",
];

const mutationScenarios = new Map([
  ["bundle_missing", "INCONCLUSIVE"],
  ["journal_truncated", "FAIL"],
  ["journal_reordered", "FAIL"],
  ["bundle_corrupt", "FAIL"],
]);

export function verifyM5Evidence(buildRoot) {
  const failures = [];
  const summaryPath = path.join(buildRoot, "conformance-summary.json");
  if (!fs.existsSync(summaryPath)) {
    return { verdict: "INCONCLUSIVE", failures: ["missing M5 conformance summary"] };
  }

  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  } catch {
    return { verdict: "INCONCLUSIVE", failures: ["unreadable M5 conformance summary"] };
  }

  if (summary.schemaVersion !== "jpyxis.io/m5-conformance-summary/v1alpha1") {
    failures.push("wrong M5 summary schema");
  }
  if (summary.evidenceState !== "PROTOTYPE") failures.push("wrong M5 evidence state");
  if (summary.scenarioCount !== 16
      || summary.executableScenarios !== 12
      || summary.mutationScenarios !== 4) {
    failures.push("wrong M5 scenario counts");
  }

  const expectedAssertions = [
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
  ];
  for (const assertion of expectedAssertions) {
    if (summary.assertions?.[assertion] !== true) {
      failures.push(`missing assertion: ${assertion}`);
    }
  }

  const recorded = new Map((summary.results ?? []).map((result) => [result.id, result.verdict]));
  for (const scenario of executableScenarios) {
    if (recorded.get(scenario) !== "PASS") failures.push(`${scenario}: summary is not PASS`);
    const result = verifyM5Bundle(path.join(buildRoot, "runs", scenario), { writeVerdict: false });
    if (result.verdict !== "PASS") {
      failures.push(`${scenario}: expected PASS, got ${result.verdict}`);
    }
  }
  for (const [scenario, expected] of mutationScenarios) {
    if (recorded.get(scenario) !== expected) {
      failures.push(`${scenario}: summary does not retain ${expected}`);
    }
    const result = verifyM5Bundle(path.join(buildRoot, "runs", scenario), { writeVerdict: false });
    if (result.verdict !== expected) {
      failures.push(`${scenario}: expected ${expected}, got ${result.verdict}`);
    }
  }

  return { verdict: failures.length === 0 ? "PASS" : "FAIL", failures };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
if (invokedDirectly) {
  const target = path.resolve(process.argv[2] ?? path.join(process.cwd(), "build", "m5"));
  const result = verifyM5Evidence(target);
  console.log(`M5 retained evidence: ${result.verdict}`);
  for (const failure of result.failures) console.error(`- ${failure}`);
  if (result.verdict !== "PASS") process.exit(1);
}

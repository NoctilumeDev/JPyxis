import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const root = process.cwd();
const outputRoot = path.resolve(process.argv[2] ?? path.join(root, "build", "m6", "resource-probe"));
const m2Root = path.join(root, "build", "m2");
const venvPython = process.platform === "win32"
  ? path.join(m2Root, "venv", "Scripts", "python.exe")
  : path.join(m2Root, "venv", "bin", "python");
const generatedPython = path.join(m2Root, "generated", "python");
const javaJar = path.join(root, "invocation", "java", "target", "jpyxis-invocation-java.jar");
const contract = path.join(root, "spec", "m1", "contracts", "example.affine-batch.v1.json");
const definition = path.join(root, "spec", "m2", "definitions", "example_affine_v1.py");
const input = path.join(root, "spec", "m2", "cases", "success_exact.json");
const definitionIdentity = "jpyxis:definition:example/affine-batch@1.0.0";
const expectedValues = [3, 5, 7, 9, -1, -3, -5, -7];

await main();

async function main() {
  assertPrerequisites();
  assertSafeOutputRoot();
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  const workers = [];
  const startup = [];
  const invocationRuns = [];
  let oneWorkerIdle;
  let twoWorkerIdle;
  let failureRecovery;
  try {
    const first = await startWorker("worker-a");
    workers.push(first);
    startup.push(first.startup);
    await wait(200);
    oneWorkerIdle = sampleMemory([first.child.pid]);

    for (let index = 1; index <= 3; index += 1) {
      invocationRuns.push(await runInvocation(first, `baseline-${index}`));
    }

    const second = await startWorker("worker-b");
    workers.push(second);
    startup.push(second.startup);
    await wait(200);
    twoWorkerIdle = sampleMemory([first.child.pid, second.child.pid]);

    const failureSampleBefore = sampleMemory([first.child.pid, second.child.pid]);
    await stopWorker(first, true);
    const recovered = await runInvocation(second, "after-worker-a-failure");
    invocationRuns.push(recovered);
    const failureSampleAfter = sampleMemory([second.child.pid]);
    failureRecovery = {
      injectedFailure: "worker-a process terminated",
      failedWorkerPid: first.child.pid,
      failedWorkerStopped: childStopped(first.child),
      survivingWorkerPid: second.child.pid,
      survivingInvocationSucceeded: recovered.resultValid,
      peakKnownProcessRssBytes: Math.max(
        failureSampleBefore.totalRssBytes,
        failureSampleAfter.totalRssBytes,
        recovered.peakKnownProcessRssBytes,
      ),
    };
  } finally {
    for (const worker of workers) await stopWorker(worker, false);
  }

  const liveAfterStop = workers.filter((worker) => !childStopped(worker.child))
    .map((worker) => worker.child.pid);
  const complete = startup.length === 2
    && invocationRuns.length === 4
    && invocationRuns.every((item) => item.resultValid)
    && failureRecovery?.failedWorkerStopped === true
    && liveAfterStop.length === 0;
  const report = {
    schemaVersion: "jpyxis.io/m6-resource-probe/v1alpha1",
    observedAt: new Date().toISOString(),
    environment: {
      os: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      logicalCpuCount: os.cpus().length,
      physicalMemoryBytes: os.totalmem(),
    },
    method: {
      memory: process.platform === "linux"
        ? "Linux /proc resident pages for recorded process trees"
        : process.platform === "win32"
          ? "Windows WorkingSet64 for recorded process identities"
          : "Node process resource observation for recorded process identities",
      startup: "external monotonic wall time from process spawn to retained WORKER_LISTENING observation",
      invocation: "external monotonic wall time plus retained HOST acceptance-to-terminal timestamps",
      samplingLimitation: "short-lived peaks between samples may be missed; values are observations, not capacity claims",
    },
    startup,
    oneWorkerIdle: compactSample(oneWorkerIdle),
    oneWorkerInvocation: {
      repetitions: 3,
      runs: invocationRuns.slice(0, 3),
      peakKnownProcessRssBytes: Math.max(...invocationRuns.slice(0, 3)
        .map((item) => item.peakKnownProcessRssBytes)),
    },
    twoWorkerIdle: compactSample(twoWorkerIdle),
    failureRecovery,
    shutdown: {
      recordedProcessIds: workers.map((worker) => worker.child.pid),
      liveRecordedProcesses: liveAfterStop,
      allRuntimeProcessesStopped: liveAfterStop.length === 0,
    },
    assertions: {
      oneWorkerObserved: Boolean(oneWorkerIdle?.totalRssBytes),
      twoWorkersObserved: Boolean(twoWorkerIdle?.totalRssBytes),
      deterministicInvocationRepeated: invocationRuns.slice(0, 3).every((item) => item.resultValid),
      namedFailureInjected: failureRecovery?.failedWorkerStopped === true,
      survivingWorkerExecuted: failureRecovery?.survivingInvocationSucceeded === true,
      allRuntimeProcessesStopped: liveAfterStop.length === 0,
    },
    complete,
  };
  fs.writeFileSync(path.join(outputRoot, "resource-probe.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!complete) throw new Error("M6 resource probe did not complete every required observation");
  console.log("M6 resource probe passed");
}

async function startWorker(workerId) {
  const port = await reservePort();
  const workerRoot = path.join(outputRoot, workerId);
  fs.mkdirSync(workerRoot, { recursive: true });
  const observations = path.join(workerRoot, "worker-observations.jsonl");
  const stdout = fs.openSync(path.join(workerRoot, "stdout.log"), "w");
  const stderr = fs.openSync(path.join(workerRoot, "stderr.log"), "w");
  const pythonPath = [
    path.join(root, "bindings", "python"),
    path.join(root, "invocation", "python"),
    generatedPython,
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter);
  const startedNs = process.hrtime.bigint();
  const child = spawn(venvPython, [
    "-m", "jpyxis_worker",
    "--port", String(port),
    "--contract", contract,
    "--definition", definition,
    "--definition-identity", definitionIdentity,
    "--observations", observations,
    "--fault-mode", "normal",
    "--delay-ms", "0",
  ], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: pythonPath },
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  await waitForWorker(observations, child);
  const readyNs = process.hrtime.bigint();
  const readyObservation = readJsonLines(observations)
    .find((item) => item.event === "WORKER_LISTENING");
  return {
    workerId,
    port,
    child,
    observations,
    startup: {
      workerId,
      pid: child.pid,
      externalMillis: nanosToMillis(readyNs - startedNs),
      readyObservedAt: readyObservation?.observedAt ?? null,
    },
  };
}

async function runInvocation(worker, runId) {
  const runRoot = path.join(outputRoot, "invocations", runId);
  fs.mkdirSync(runRoot, { recursive: true });
  const hostObservations = path.join(runRoot, "host-observations.jsonl");
  const outcomePath = path.join(runRoot, "authoritative-outcome.json");
  const rawReportPath = path.join(runRoot, "raw-worker-report.json");
  const startedNs = process.hrtime.bigint();
  const child = spawn("java", [
    "-jar", javaJar,
    "--port", String(worker.port),
    "--contract", contract,
    "--definition", definition,
    "--definition-identity", definitionIdentity,
    "--input", input,
    "--host-observations", hostObservations,
    "--outcome", outcomePath,
    "--raw-report", rawReportPath,
    "--timeout-ms", "5000",
    "--cancel-after-ms", "-1",
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const samples = [];
  const sample = () => samples.push(sampleMemory([worker.child.pid, child.pid]));
  sample();
  const timer = setInterval(sample, 50);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  clearInterval(timer);
  sample();
  const endedNs = process.hrtime.bigint();
  fs.writeFileSync(path.join(runRoot, "stdout.log"), stdout);
  fs.writeFileSync(path.join(runRoot, "stderr.log"), stderr);
  if (exitCode !== 0) throw new Error(`${runId}: Java invocation exited ${exitCode}: ${stderr}`);

  const outcome = JSON.parse(fs.readFileSync(outcomePath, "utf8"));
  const hostEvents = readJsonLines(hostObservations);
  const accepted = hostEvents.find((item) => item.event === "INVOCATION_ACCEPTED");
  const terminal = hostEvents.find((item) => item.event === "TERMINAL_SUCCEEDED");
  const resultValid = outcome.state === "SUCCEEDED"
    && outcome.result?.rows === 2
    && outcome.result?.values?.dtype === "float32"
    && isDeepStrictEqual(outcome.result?.values?.shape, [2, 4])
    && isDeepStrictEqual(outcome.result?.values?.values, expectedValues);
  return {
    runId,
    workerId: worker.workerId,
    workerPid: worker.child.pid,
    hostPid: child.pid,
    externalMillis: nanosToMillis(endedNs - startedNs),
    retainedAcceptanceToTerminalMillis: durationBetween(accepted?.observedAt, terminal?.observedAt),
    sampleCount: samples.length,
    peakKnownProcessRssBytes: Math.max(0, ...samples.map((item) => item.totalRssBytes)),
    resultValid,
  };
}

function sampleMemory(seedPids) {
  const unique = [...new Set(seedPids.filter((pid) => Number.isInteger(pid) && pid > 0))];
  let processes = [];
  if (process.platform === "linux") {
    processes = linuxProcessTree(unique);
  } else if (process.platform === "win32") {
    processes = windowsKnownProcesses(unique);
  } else {
    processes = unique.map((pid) => ({ pid, rssBytes: pid === process.pid ? process.memoryUsage().rss : 0 }));
  }
  return {
    observedAt: new Date().toISOString(),
    totalRssBytes: processes.reduce((sum, item) => sum + item.rssBytes, 0),
    processes,
    host: hostMemory(),
  };
}

function linuxProcessTree(seedPids) {
  const table = new Map();
  for (const entry of fs.readdirSync("/proc", { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const pid = Number(entry.name);
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const parent = Number(status.match(/^PPid:\s+(\d+)/m)?.[1] ?? -1);
      const rssKiB = Number(status.match(/^VmRSS:\s+(\d+)\s+kB/m)?.[1] ?? 0);
      table.set(pid, { pid, parent, rssBytes: rssKiB * 1024 });
    } catch {
      // A process may exit between directory enumeration and status read.
    }
  }
  const selected = new Set(seedPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of table.values()) {
      if (selected.has(item.parent) && !selected.has(item.pid)) {
        selected.add(item.pid);
        changed = true;
      }
    }
  }
  return [...selected].map((pid) => table.get(pid)).filter(Boolean)
    .map(({ pid, rssBytes }) => ({ pid, rssBytes }));
}

function windowsKnownProcesses(pids) {
  if (pids.length === 0) return [];
  const expression = `$ids=@(${pids.join(",")}); Get-Process -Id $ids -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64 | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", expression], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  const parsed = JSON.parse(result.stdout);
  return (Array.isArray(parsed) ? parsed : [parsed])
    .map((item) => ({ pid: item.Id, rssBytes: item.WorkingSet64 }));
}

function hostMemory() {
  if (process.platform === "linux") {
    const text = fs.readFileSync("/proc/meminfo", "utf8");
    const value = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)\\s+kB`, "m"))?.[1] ?? 0) * 1024;
    return {
      totalBytes: value("MemTotal"),
      availableBytes: value("MemAvailable"),
      swapTotalBytes: value("SwapTotal"),
      swapFreeBytes: value("SwapFree"),
    };
  }
  return {
    totalBytes: os.totalmem(),
    availableBytes: os.freemem(),
    swapTotalBytes: null,
    swapFreeBytes: null,
  };
}

function compactSample(sample) {
  return {
    observedAt: sample.observedAt,
    totalRssBytes: sample.totalRssBytes,
    processCount: sample.processes.length,
    host: sample.host,
  };
}

async function waitForWorker(observations, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (childStopped(child)) {
      throw new Error(`worker exited before readiness: ${child.exitCode ?? child.signalCode}`);
    }
    if (fs.existsSync(observations)
        && fs.readFileSync(observations, "utf8").includes("WORKER_LISTENING")) {
      await wait(50);
      return;
    }
    await wait(50);
  }
  throw new Error("worker did not become ready within 10 seconds");
}

async function stopWorker(worker, force) {
  if (!worker || childStopped(worker.child)) return;
  worker.child.kill(force ? "SIGKILL" : undefined);
  const deadline = Date.now() + 3_000;
  while (!childStopped(worker.child) && Date.now() < deadline) await wait(25);
  if (!childStopped(worker.child)) worker.child.kill("SIGKILL");
  while (!childStopped(worker.child) && Date.now() < deadline + 1_000) await wait(25);
}

function childStopped(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function readJsonLines(file) {
  return fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean)
    .map((line) => JSON.parse(line));
}

function durationBetween(start, end) {
  if (!start || !end) return null;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

function nanosToMillis(value) {
  return Number(value) / 1_000_000;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertPrerequisites() {
  for (const required of [venvPython, generatedPython, javaJar, contract, definition, input]) {
    if (!fs.existsSync(required)) throw new Error(`M6 resource probe prerequisite is missing: ${required}`);
  }
}

function assertSafeOutputRoot() {
  const m6Root = path.resolve(root, "build", "m6");
  if (outputRoot !== path.join(m6Root, "resource-probe") || path.dirname(outputRoot) !== m6Root) {
    throw new Error(`refusing to clean unexpected resource-probe root: ${outputRoot}`);
  }
}

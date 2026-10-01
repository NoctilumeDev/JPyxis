import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {auditCases, verifyAuditProbe} from "./verify.mjs";

const base=process.argv[3];
if(!/^[0-9a-f]{40}$/.test(base??""))throw new Error("Require exact qualified base revision");
const root=process.cwd();
const output=path.resolve(process.argv[2] ?? "build/productization-audit-v3/first-probe");
const relative=path.relative(path.join(root,"build"),output);
if(!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must be inside this checkout's build directory");
if(fs.existsSync(output)) throw new Error("Retain the first run and use a new output directory");
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
if(git("status","--porcelain")) throw new Error("Commit the audit candidate before recording immutable inputs");
const sourceRoot="resilience/java/src/main/java/io/jpyxis/resilience";
const javaSources=[
  ...fs.readdirSync(`${sourceRoot}/api`).filter(n=>n.endsWith(".java")).sort().map(n=>`${sourceRoot}/api/${n}`),
  ...["WorkerSupervisor","ResilientInvocationManager"].map(n=>`${sourceRoot}/core/${n}.java`),
  ...["EventOwner","ResilienceJournal","ResilienceEvent","ResilienceEventDraft"].map(n=>`${sourceRoot}/evidence/${n}.java`),
  ...["WorkerControl","WorkerControlException","AttemptExecutor"].map(n=>`${sourceRoot}/port/${n}.java`),
  "experiments/productization-audit/CoordinateGateProbe.java",
  "evidence/productization-audit/first-instance-failure/InstanceFailureProbe.java",
  "experiments/m5-coordinate-validation/CoordinateValidationMain.java"
];
const sources=javaSources.map(file=>{
  const blob=git("hash-object",file);
  if(blob!==git("rev-parse",`${base}:${file}`))throw new Error(`Compiled source differs from qualified main: ${file}`);
  return {path:file,gitBlob:blob,sha256:sha(fs.readFileSync(file))};
});
fs.mkdirSync(output,{recursive:true});
const classes=path.join(output,"classes");fs.mkdirSync(classes);
const compile=spawnSync("javac",["--release","17","-d",classes,...javaSources]);
fs.writeFileSync(path.join(output,"compile.stdout.bin"),compile.stdout??"");
fs.writeFileSync(path.join(output,"compile.stderr.bin"),compile.stderr??"");
const receipt={schemaVersion:"jpyxis.io/productization-audit-v3-probe/v1alpha1",sourceBase:base,
  sourceTree:git("rev-parse",`${base}^{tree}`),candidateHead:git("rev-parse","HEAD"),
  startedAt:new Date().toISOString(),compileExit:compile.status,compileStdoutSha256:sha(compile.stdout??""),compileStderrSha256:sha(compile.stderr??""),sources,
  harness:["experiments/productization-audit-v3/run.mjs","experiments/productization-audit-v3/verify.mjs"]
    .map(file=>({path:file,gitBlob:git("hash-object",file),sha256:sha(fs.readFileSync(file))})),
  java:spawnSync("java",["-version"],{encoding:"utf8"}).stderr.trim(),runs:[],
  scope:"Audit A model rerun only; original plan/replacement fixtures plus guarded start observations; no real worker, durable recovery or composition claim"};
if(compile.status===0)for(const item of auditCases){
  const run=spawnSync("java",["-cp",classes,item.main,item.id],{timeout:20000});
  const stdout=`${item.id}.stdout.bin`,stderr=`${item.id}.stderr.bin`;
  fs.writeFileSync(path.join(output,stdout),run.stdout??"");fs.writeFileSync(path.join(output,stderr),run.stderr??"");
  receipt.runs.push({...item,exitCode:run.status,signal:run.signal,error:run.error?.code??null,stdout,stderr,stdoutSha256:sha(run.stdout??""),stderrSha256:sha(run.stderr??"")});
}
receipt.sourcesUnchangedAtEnd=sources.every(s=>sha(fs.readFileSync(s.path))===s.sha256);
receipt.completedAt=new Date().toISOString();
fs.writeFileSync(path.join(output,"receipt.json"),JSON.stringify(receipt,null,2)+"\n");
const readback=verifyAuditProbe(output,base);
fs.writeFileSync(path.join(output,"readback.json"),JSON.stringify(readback,null,2)+"\n");
console.log(JSON.stringify(readback,null,2));process.exit(readback.verdict==="PASS"?0:2);

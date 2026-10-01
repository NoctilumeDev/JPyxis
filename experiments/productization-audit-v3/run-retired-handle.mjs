import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {verifyRetiredHandleProbe} from "./verify-retired-handle.mjs";
const base=process.argv[3];
if(!/^[0-9a-f]{40}$/.test(base??""))throw new Error("Require exact qualified base revision");
const output=path.resolve(process.argv[2]??"build/productization-audit-v3/first-retired-handle");
const relative=path.relative(path.join(process.cwd(),"build"),output);
if(!relative||relative.startsWith("..")||path.isAbsolute(relative))throw new Error("Output must be inside this checkout's build directory");
if(fs.existsSync(output))throw new Error("Retain first evidence; use a new output directory");
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
if(git("status","--porcelain"))throw new Error("Commit candidate before recording immutable inputs");
const javaSources=["api","core","evidence","port"].flatMap(folder=>{
  const directory=`lifecycle/java/src/main/java/io/jpyxis/lifecycle/${folder}`;
  return fs.readdirSync(directory).filter(n=>n.endsWith(".java")).sort().map(n=>`${directory}/${n}`);
});
const sources=javaSources.map(file=>{const blob=git("hash-object",file);if(blob!==git("rev-parse",`${base}:${file}`))throw new Error(`Source differs: ${file}`);return {path:file,gitBlob:blob,sha256:sha(fs.readFileSync(file))};});
const probe="experiments/productization-audit-v3/RetiredHandleProbe.java";
const harness=[probe,"experiments/productization-audit-v3/run-retired-handle.mjs","experiments/productization-audit-v3/verify-retired-handle.mjs"]
  .map(file=>({path:file,gitBlob:git("hash-object",file),sha256:sha(fs.readFileSync(file))}));
fs.mkdirSync(output,{recursive:true});const classes=path.join(output,"classes");fs.mkdirSync(classes);
const compile=spawnSync("javac",["--release","17","-d",classes,...javaSources,probe]);
fs.writeFileSync(path.join(output,"compile.stdout.bin"),compile.stdout??"");fs.writeFileSync(path.join(output,"compile.stderr.bin"),compile.stderr??"");
const receipt={schemaVersion:"jpyxis.io/m4-retired-handle-audit-v3/v1alpha1",sourceBase:base,sourceTree:git("rev-parse",`${base}^{tree}`),
  candidateHead:git("rev-parse","HEAD"),sources,harness,compileExit:compile.status,compileStdoutSha256:sha(compile.stdout??""),compileStderrSha256:sha(compile.stderr??""),startedAt:new Date().toISOString(),runs:[],
  scope:"Audit A public M4 model only; synthetic capability, in-memory journal; no real Runtime/process/artifact-contract validation claim"};
if(compile.status===0)for(const id of ["fresh_handle_rollback_control","retired_handle_rollback","retired_cloned_tuple_rollback"]){
  const run=spawnSync("java",["-cp",classes,"RetiredHandleProbe",id],{timeout:20000});
  const stdout=`${id}.stdout.bin`,stderr=`${id}.stderr.bin`;
  fs.writeFileSync(path.join(output,stdout),run.stdout??"");fs.writeFileSync(path.join(output,stderr),run.stderr??"");
  receipt.runs.push({id,exitCode:run.status,signal:run.signal,error:run.error?.code??null,stdout,stderr,stdoutSha256:sha(run.stdout??""),stderrSha256:sha(run.stderr??"")});
}
receipt.sourcesUnchangedAtEnd=sources.every(s=>sha(fs.readFileSync(s.path))===s.sha256);receipt.completedAt=new Date().toISOString();
fs.writeFileSync(path.join(output,"receipt.json"),JSON.stringify(receipt,null,2)+"\n");
const readback=verifyRetiredHandleProbe(output,base);fs.writeFileSync(path.join(output,"readback.json"),JSON.stringify(readback,null,2)+"\n");
console.log(JSON.stringify(readback,null,2));process.exit(readback.auditDecision==="NO_COUNTEREXAMPLE_OBSERVED"?0:2);

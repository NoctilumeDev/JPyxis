import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {handleCases,verifyM4HandleEvidence} from "./verify-m4-handle-evidence.mjs";

const root=process.cwd(),output=path.resolve(process.argv[2]??"build/m4/handle-validation");
const relative=path.relative(path.join(root,"build"),output);
assert.ok(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative),"output must be inside this checkout's build directory");
assert.ok(!fs.existsSync(output),"retain prior evidence and choose a fresh output parent");
const mutationRoot=path.join(path.dirname(output),"handle-validation-mutations");
assert.ok(!fs.existsSync(mutationRoot),"retain prior mutations and choose a fresh output parent");
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const revision=git("rev-parse","HEAD"),dirty=git("status","--porcelain");assert.equal(dirty,"","commit the complete candidate before immutable qualification");
const javaSources=["api","core","evidence","port"].flatMap(folder=>{const directory=`lifecycle/java/src/main/java/io/jpyxis/lifecycle/${folder}`;return fs.readdirSync(directory).filter(n=>n.endsWith(".java")).sort().map(n=>`${directory}/${n}`);});
const probe="experiments/m4-handle-validation/HandleValidationMain.java";
const inputs=[...javaSources,probe,"scripts/verify-m4-handles.mjs","scripts/verify-m4-handle-evidence.mjs",
  "docs/spec/m4-handle-ownership-contract-v2.md","docs/adr/0013-m4-runtime-handle-conservation.md","evidence/m4-handle-validation/v2/contract-manifest.json"]
  .map(file=>{const gitBlob=git("hash-object",file);assert.equal(gitBlob,git("rev-parse",`${revision}:${file}`));return {path:file,gitBlob,sha256:sha(fs.readFileSync(file))};});
fs.mkdirSync(output,{recursive:true});const classes=path.join(output,"classes");fs.mkdirSync(classes);
const compile=spawnSync("javac",["--release","17","-d",classes,...javaSources,probe]);
const files=[];const retain=(name,b)=>{b=b??Buffer.alloc(0);fs.writeFileSync(path.join(output,name),b);files.push({path:name,sha256:sha(b),bytes:b.length});};
retain("compile.stdout.bin",compile.stdout);retain("compile.stderr.bin",compile.stderr);
const manifest={schemaVersion:"jpyxis.io/m4-handle-evidence/v1alpha1",contractTag:"m4-handle-contract-v2",contractSource:"43df2cc678d60bb8a8ddf7f23f1aa82bbcca898e",
  contractSpecBlob:"3445779836822cf033fb2fd9007486141f98339d",contractAdrBlob:"9a1b42474fce04dbe7678fc7c68c262be609a2e3",
  source:{revision,tree:git("rev-parse","HEAD^{tree}"),scope:"IMMUTABLE_GIT_SOURCE",dirty},sources:inputs,compileExit:compile.status,runs:[],files,mutations:[],
  startedAt:new Date().toISOString(),scope:"M4 canonical identity/owner/release public model; one in-memory owner; no real Runtime, process, restart or product proof"};
if(compile.status===0)for(const id of handleCases){
  const run=spawnSync("java",["-cp",classes,"HandleValidationMain",id],{timeout:20000});
  const stdout=`${id}.stdout.bin`,stderr=`${id}.stderr.bin`;retain(stdout,run.stdout);retain(stderr,run.stderr);
  manifest.runs.push({case:id,exitCode:run.status,signal:run.signal,error:run.error?.message??null,stdout,stderr});
}
manifest.sourcesUnchangedAtEnd=inputs.every(input=>sha(fs.readFileSync(input.path))===input.sha256);manifest.completedAt=new Date().toISOString();
const save=(target,value)=>fs.writeFileSync(path.join(target,"manifest.json"),JSON.stringify(value,null,2)+"\n");save(output,manifest);
if(compile.status===0&&manifest.runs.length===handleCases.length)for(const id of ["missing_case_stdout","rehashed_foreign_cleanup","self_declared_alias_adoption"]){
  const target=path.join(mutationRoot,id);fs.cpSync(output,target,{recursive:true});
  const mutated=JSON.parse(fs.readFileSync(path.join(target,"manifest.json"),"utf8"));
  const run=mutated.runs.find(r=>r.case==="live_alias_cleanup");
  if(id==="missing_case_stdout")fs.rmSync(path.join(target,run.stdout));
  else{
    const row=JSON.parse(fs.readFileSync(path.join(target,run.stdout),"utf8"));
    if(id==="rehashed_foreign_cleanup"){row.candidate.unloads=1;row.candidate.unloadArguments=[row.retainedPinBefore.runtimeHandle];}
    else{
      row.candidateError="";row.selfDeclaredVerdict="PASS";
      const candidate=row.snapshots.find(s=>s.deploymentId==="candidate");candidate.state="ACTIVE";candidate.runtimeProviderIdentity=row.candidate.returned.providerIdentity;candidate.runtimeProviderVersion=row.candidate.returned.providerVersion;
      row.activeAfter.slot="candidate";row.candidatePin={...row.retainedPinBefore,pinId:"forged-pin",deploymentId:"candidate",runtimeHandle:row.candidate.returned};
    }
    const b=Buffer.from(JSON.stringify(row)+"\n");fs.writeFileSync(path.join(target,run.stdout),b);
    const file=mutated.files.find(f=>f.path===run.stdout);file.sha256=sha(b);file.bytes=b.length;save(target,mutated);
  }
  manifest.mutations.push({id,path:`../handle-validation-mutations/${id}`});
}
save(output,manifest);
const verified=verifyM4HandleEvidence(output,{expectedSourceRevision:revision,verifyMutations:true});
fs.writeFileSync(path.join(output,"verification.json"),JSON.stringify(verified,null,2)+"\n");
console.log(JSON.stringify({verdict:verified.verdict,cases:verified.results.length,mutations:verified.mutationResults,failures:verified.failures,incomplete:verified.incomplete},null,2));
process.exit(verified.verdict==="PASS"?0:1);

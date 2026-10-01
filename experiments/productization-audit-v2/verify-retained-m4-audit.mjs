import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {verifyRetiredHandleProbe} from "./verify-retired-handle.mjs";

export function verifyRetainedM4Audit(revision) {
  const failures=[];
  try {
    assert.match(revision,/^(HEAD|[0-9a-f]{40})$/);
    const git=(...args)=>{const r=spawnSync("git",args);assert.equal(r.status,0,String(r.stderr));return r.stdout;};
    const root="evidence/productization-audit-v2/";
    const blob=p=>git("show",`${revision}:${root}${p}`);
    const ledger=JSON.parse(blob("retention.json"));
    assert.equal(ledger.files.length,15);
    assert.equal(new Set(ledger.files.map(f=>f.path)).size,15);
    for(const file of ledger.files){
      assert.ok(!file.path.includes("..")&&!path.isAbsolute(file.path));
      const b=blob(file.path);
      assert.equal(b.length,file.bytes,file.path);
      assert.equal("sha256:"+crypto.createHash("sha256").update(b).digest("hex"),file.sha256,file.path);
      assert.deepEqual(b,fs.readFileSync(root+file.path),file.path);
    }
    const receipt=JSON.parse(blob("first-retired-handle/receipt.json"));
    const expected="sha256:98845953495cc58fe224615b1a5735b56d1378cd01212f056a2f48eaea8a66d5";
    assert.equal("sha256:"+crypto.createHash("sha256").update(blob("first-retired-handle/receipt.json")).digest("hex"),expected);
    for(const source of [...receipt.sources,...receipt.harness])
      assert.equal(String(git("rev-parse",`${revision}:${source.path}`)).trim(),source.gitBlob,source.path);
    for(const directory of ["evidence/productization-audit","experiments/productization-audit"])
      assert.deepEqual(git("rev-parse",`${revision}:${directory}`),git("rev-parse",`2ac2715b994f519fbad4afb73b1f80ea0852dd55:${directory}`));
    for(const run of receipt.runs){
      const row=JSON.parse(blob(`first-retired-handle/${run.stdout}`));
      let previous=0;
      for(const event of row.eventsAfterRollbackRequest){
        assert.ok(event.sequence>previous);previous=event.sequence;
        assert.ok(["DEPLOYMENT_MANAGER","LIFECYCLE_CAPABILITY"].includes(event.owner));
        if(event.owner==="LIFECYCLE_CAPABILITY"){
          assert.equal(event.previousState,null);assert.equal(event.newState,null);
        }
      }
    }
    const result=verifyRetiredHandleProbe(`${root}first-retired-handle`);
    assert.equal(result.storageReadback,"VERIFIED");assert.equal(result.auditDecision,"STOP_MODEL_COUNTEREXAMPLE");
    return {storageReadback:"VERIFIED",auditDecision:result.auditDecision,retainedFiles:15,firstReceiptSha256:expected,
      observations:result.observations,failures,scope:"Immutable first M4 model facts and publication source binding; no repair or product qualification"};
  } catch(error) { failures.push(error.message); }
  return {storageReadback:"INVALID",auditDecision:"PROBE_INVALID",failures};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyRetainedM4Audit(process.argv[2]??"HEAD");console.log(JSON.stringify(result,null,2));
  process.exit(result.storageReadback==="VERIFIED"?0:1);
}

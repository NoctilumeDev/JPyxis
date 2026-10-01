import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
export function verifyRetiredHandleProbe(directory){
  const failures=[],observations=[];let counterexample=false;
  try{
    const receipt=JSON.parse(fs.readFileSync(path.join(directory,"receipt.json"),"utf8"));
    assert.equal(receipt.schemaVersion,"jpyxis.io/m4-retired-handle-audit/v1alpha1");
    assert.equal(receipt.sourceBase,"a5553d94136a46cb93ff31caa3e138a5b7ff8731");assert.equal(receipt.sourceTree,git("rev-parse",`${receipt.sourceBase}^{tree}`));
    assert.equal(receipt.compileExit,0);assert.equal(receipt.sourcesUnchangedAtEnd,true);
    assert.deepEqual(receipt.runs.map(r=>r.id),["fresh_handle_rollback_control","retired_handle_rollback"]);
    for(const source of receipt.sources)assert.equal(source.gitBlob,git("rev-parse",`${receipt.sourceBase}:${source.path}`));
    for(const source of receipt.harness)assert.equal(source.gitBlob,git("rev-parse",`${receipt.candidateHead}:${source.path}`));
    for(const run of receipt.runs){
      const out=fs.readFileSync(path.join(directory,run.stdout)),err=fs.readFileSync(path.join(directory,run.stderr));
      assert.equal(sha(out),run.stdoutSha256);assert.equal(sha(err),run.stderrSha256);
      const row=JSON.parse(out);assert.equal(row.case,run.id);
      assert.equal(row.retiredBeforeRollback.state,"RETIRED");assert.equal(row.retiredAfterRollback.state,"RETIRED");
      assert.equal(row.oldUnloadCalls,1);assert.equal(row.newLoadCalls,1);assert.equal(row.newWarmCalls,1);
      assert.equal(row.activeBefore.slot,"deployment-v2");assert.equal(row.rollbackSnapshot.deploymentId,"deployment-rollback");
      assert.equal(row.newPin.deploymentId,"deployment-rollback");assert.equal(row.newPin.artifact.identity,"artifact-v1");
      assert.equal(row.newPin.artifact.digest,row.retiredBeforeRollback.artifact.digest);
      for(const event of row.eventsAfterRollbackRequest)if(event.owner==="RUNTIME_CAPABILITY")assert.equal(event.newState,"");
      if(run.id==="fresh_handle_rollback_control"){
        assert.equal(run.exitCode,0);assert.equal(row.rollbackSnapshot.state,"ACTIVE");assert.equal(row.activeAfter.slot,"deployment-rollback");
        assert.notDeepEqual(row.oldHandle,row.newPin.runtimeHandle);assert.equal(row.samePinnedTupleAsRetired,false);
      }else{
        assert.deepEqual(row.oldHandle,row.returnedHandle);assert.equal(row.sameReturnedObjectAsRetired,true);
        counterexample=row.rollbackSnapshot.state==="ACTIVE"&&row.activeAfter.slot==="deployment-rollback"
          &&JSON.stringify(row.oldHandle)===JSON.stringify(row.newPin.runtimeHandle);
        if(counterexample){assert.equal(run.exitCode,2);assert.equal(row.samePinnedObjectAsRetired,true);assert.equal(row.samePinnedTupleAsRetired,true);
          assert.equal(row.eventsAfterRollbackRequest.filter(e=>e.event==="ROLLBACK_COMMITTED"&&e.owner==="DEPLOYMENT_MANAGER").length,1);}
      }
      observations.push({id:run.id,exitCode:run.exitCode,rollbackState:row.rollbackSnapshot.state,retiredState:row.retiredBeforeRollback.state,
        activeBefore:row.activeBefore.slot,activeAfter:row.activeAfter.slot,reusesRetiredTuple:row.samePinnedTupleAsRetired});
    }
  }catch(error){failures.push(error.message);}
  return {storageReadback:failures.length?"INVALID":"VERIFIED",auditDecision:failures.length?"PROBE_INVALID":counterexample?"STOP_MODEL_COUNTEREXAMPLE":"NO_COUNTEREXAMPLE_OBSERVED",
    failures,observations,scope:"M4 public model only; exact frozen rollback handle rule; no real worker/process or production claim"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyRetiredHandleProbe(path.resolve(process.argv[2]));console.log(JSON.stringify(result,null,2));process.exit(result.storageReadback==="VERIFIED"?0:1);
}

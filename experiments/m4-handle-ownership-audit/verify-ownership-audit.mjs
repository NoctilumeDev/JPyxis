import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const expectedCases=["fresh_rollback","retired_same_object","retired_cloned_tuple","live_loaded","live_warming","live_standby","live_active","live_draining","live_unloading","live_alias_cleanup","warm_failed_release_reentry","warm_failed_cleanup_reentry","unload_failed_reentry","concurrent_duplicate_returns","different_provider","different_version","different_opaque","null_return","malformed_provider_null","malformed_provider_blank","malformed_version_null","malformed_version_blank","malformed_opaque_null","malformed_opaque_blank","separate_owner_lifetime"];
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const tuple=h=>[h.providerIdentity,h.providerVersion,h.opaqueHandle];
const edges=new Set(["REQUESTED->LOADING","LOADING->WARMING","LOADING->FAILED","WARMING->STANDBY","WARMING->FAILED","STANDBY->ACTIVE","ACTIVE->DRAINING","DRAINING->UNLOADING","UNLOADING->RETIRED","UNLOADING->FAILED"]);
function replay(events){
  const states=new Map(),active=new Map();
  for(const [index,event] of events.entries()){
    assert.equal(event.sequence,index+1);assert.ok(event.actor&&event.cause&&event.traceId);
    assert.ok(["DEPLOYMENT_MANAGER","ARTIFACT_REGISTRY","LIFECYCLE_CAPABILITY"].includes(event.owner));
    if(event.owner==="LIFECYCLE_CAPABILITY"){assert.equal(event.previousState,null);assert.equal(event.newState,null);}
    if(event.owner!=="DEPLOYMENT_MANAGER"||event.newState===null)continue;
    assert.equal(event.previousState,states.get(event.deploymentId)??null);
    assert.ok(event.previousState===null&&event.newState==="REQUESTED"||edges.has(`${event.previousState}->${event.newState}`));
    if(event.previousState==="ACTIVE"){assert.equal(active.get(event.slot),event.deploymentId);active.delete(event.slot);}
    if(event.newState==="ACTIVE"){assert.equal(active.has(event.slot),false);active.set(event.slot,event.deploymentId);}
    states.set(event.deploymentId,event.newState);
  }
  return {states,active:Object.fromEntries([...active.entries()].sort())};
}
export function verifyOwnershipAudit(directory,expectedBase){
  const failures=[],observations=[];
  try{
    const receipt=JSON.parse(fs.readFileSync(path.join(directory,"receipt.json"),"utf8"));
    assert.equal(receipt.schemaVersion,"jpyxis.io/m4-handle-ownership-audit/v1alpha1");
    assert.equal(receipt.sourceBase,expectedBase);assert.equal(receipt.compileExit,0);assert.equal(receipt.sourcesUnchangedAtEnd,true);
    const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
    assert.equal(receipt.sourceTree,git("rev-parse",`${expectedBase}^{tree}`));
    for(const source of receipt.sources)assert.equal(source.gitBlob,git("rev-parse",`${expectedBase}:${source.path}`));
    for(const source of receipt.harness)assert.equal(source.gitBlob,git("rev-parse",`${receipt.candidateHead}:${source.path}`));
    assert.deepEqual(receipt.runs.map(r=>r.id),expectedCases);
    assert.equal(receipt.files.length,52);assert.equal(new Set(receipt.files.map(f=>f.path)).size,52);
    for(const file of receipt.files){assert.ok(!file.path.includes("..")&&!path.isAbsolute(file.path));const b=fs.readFileSync(path.join(directory,file.path));assert.equal(b.length,file.bytes,file.path);assert.equal(sha(b),file.sha256,file.path);}
    for(const run of receipt.runs){
      assert.equal(run.exitCode,0,run.id);assert.equal(run.signal,null);assert.equal(run.error,null);
      assert.equal(fs.readFileSync(path.join(directory,run.stderr)).length,0);
      const row=JSON.parse(fs.readFileSync(path.join(directory,run.stdout),"utf8"));assert.equal(row.case,run.id);
      const state=replay(row.events);const snapshots=new Map(row.snapshots.map(s=>[s.deploymentId,s]));
      for(const snapshot of row.snapshots)assert.equal(snapshot.state,state.states.get(snapshot.deploymentId));
      assert.deepEqual(row.activeAfter,state.active);
      assert.deepEqual(row.retainedPinAfter,row.retainedPinBefore);assert.equal(row.retainedPinReleaseOutcome,"OBLIGATION_COMPLETED");
      assert.equal(row.retainedPinBefore.deploymentId,"active");assert.deepEqual(row.retainedPinBefore.artifact,row.artifact);
      assert.ok(row.activeSnapshotAfter.outstandingPins>=1);
      const id=run.id,candidate=snapshots.get("candidate");let gap=false;
      if(id==="concurrent_duplicate_returns"){
        assert.deepEqual(row.loadErrors,["",""]);assert.equal(row.candidatePins.length,2);
        assert.equal(row.sameReturnedObject,false);assert.deepEqual(tuple(row.candidatePins[0].runtimeHandle),tuple(row.candidatePins[1].runtimeHandle));
        assert.deepEqual(row.duringLoadPin.runtimeHandle,row.retainedPinBefore.runtimeHandle);
        assert.equal(row.candidate.loads,1);assert.equal(row.secondCandidate.loads,1);gap=true;
      }else if(id==="live_alias_cleanup"){
        assert.equal(candidate.state,"FAILED");assert.equal(row.candidate.loads,1);assert.equal(row.candidate.warms,1);assert.equal(row.candidate.unloads,1);
        assert.deepEqual(tuple(row.candidate.unloadArguments[0]),tuple(row.retainedPinBefore.runtimeHandle));
        assert.deepEqual(row.activeAfter,row.activeBeforeCandidate);assert.equal(row.activeSnapshotAfter.state,"ACTIVE");gap=true;
      }else if(id.startsWith("retired_")||id.startsWith("live_")||id.startsWith("warm_failed_")||id==="unload_failed_reentry"){
        assert.equal(candidate.state,"ACTIVE");assert.equal(row.candidate.loads,1);assert.equal(row.candidate.warms,1);
        assert.equal(row.sameReturnedTuple,true);assert.deepEqual(tuple(row.candidatePin.runtimeHandle),tuple(row.originalHandle));
        if(id==="retired_same_object")assert.equal(row.sameReturnedObject,true);else assert.equal(row.sameReturnedObject,false);
        if(id.startsWith("retired_")){assert.equal(row.holderBeforeCandidate.state,"RETIRED");assert.equal(row.holderAfterCandidate.state,"RETIRED");assert.equal(row.holder.unloads,1);}
        if(id.startsWith("live_"))assert.equal(row.holderBeforeCandidate.state,id.substring(5).toUpperCase()==="LOADED"?"LOADING":id.substring(5).toUpperCase());
        if(id.startsWith("warm_failed_")||id==="unload_failed_reentry"){assert.equal(row.holderBeforeCandidate.state,"FAILED");assert.equal(row.holder.unloads,1);}
        if(id==="warm_failed_cleanup_reentry")assert.ok(row.events.some(e=>e.event==="FAILED_HANDLE_RELEASE_FAILED"&&e.owner==="LIFECYCLE_CAPABILITY"));
        if(id==="unload_failed_reentry")assert.ok(row.events.some(e=>e.event==="UNLOAD_FAILED"&&e.owner==="LIFECYCLE_CAPABILITY"));
        gap=true;
      }else if(id==="null_return"||id.startsWith("malformed_")){
        assert.equal(candidate.state,"FAILED");assert.equal(row.candidateError,"CAPABILITY_FAILURE");assert.equal(row.candidate.loads,1);
        assert.equal(row.candidate.warms,0);assert.equal(row.candidate.unloads,0);assert.deepEqual(row.activeAfter,row.activeBeforeCandidate);
        assert.equal(row.activeSnapshotAfter.state,"ACTIVE");
      }else if(id==="separate_owner_lifetime"){
        assert.equal(row.otherOwnerSnapshot.state,"ACTIVE");assert.deepEqual(tuple(row.otherOwnerPin.runtimeHandle),tuple(row.retainedPinBefore.runtimeHandle));replay(row.otherOwnerEvents);
        assert.deepEqual(row.activeAfter,row.activeBeforeCandidate);
      }else{
        assert.equal(candidate.state,"ACTIVE");assert.equal(row.candidate.loads,1);assert.equal(row.candidate.warms,1);
        assert.notDeepEqual(tuple(row.candidatePin.runtimeHandle),tuple(row.originalHandle));
        assert.equal(row.sameReturnedTuple,false);
      }
      if(candidate)assert.ok(row.events.some(e=>e.deploymentId==="candidate"&&e.event===(row.candidate.returned===null?"LOAD_FAILED":"LOAD_SUCCEEDED")&&e.owner==="LIFECYCLE_CAPABILITY"));
      observations.push({id,knownOwnershipGapObserved:gap,candidateState:candidate?.state??null,unloadCalls:row.candidate.unloads});
    }
    assert.equal(observations.filter(o=>o.knownOwnershipGapObserved).length,13);
  }catch(error){failures.push(error.message);}
  return {storageReadback:failures.length?"INVALID":"VERIFIED",modelAudit:failures.length?"INVALID":"KNOWN_HANDLE_OWNERSHIP_GAP_CONFIRMED",failures,observations,
    scope:"First pre-contract public model audit; 13 known identity-gap variants, 12 bounded controls; no repair or product qualification"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyOwnershipAudit(path.resolve(process.argv[2]),process.argv[3]);console.log(JSON.stringify(result,null,2));process.exit(result.storageReadback==="VERIFIED"?0:1);
}

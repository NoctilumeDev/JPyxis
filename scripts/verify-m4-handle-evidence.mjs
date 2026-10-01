import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

export const handleCases=["fresh_rollback","retired_same_object","retired_cloned_tuple","live_loaded","live_warming","live_standby","live_active","live_draining","live_unloading","live_alias_cleanup","warm_failed_release_reentry","warm_failed_cleanup_reentry","unload_failed_reentry","concurrent_duplicate_returns","different_provider","different_version","different_opaque","null_return","malformed_provider_null","malformed_provider_blank","malformed_version_null","malformed_version_blank","malformed_opaque_null","malformed_opaque_blank","separate_owner_lifetime","admission_record_failure","load_observation_record_failure","cross_artifact_alias"];
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const tuple=h=>[h.providerIdentity,h.providerVersion,h.opaqueHandle];
const key=h=>JSON.stringify(tuple(h));
const conflict="RUNTIME_HANDLE_IDENTITY_CONFLICT";
const edges=new Set(["REQUESTED->LOADING","LOADING->WARMING","LOADING->FAILED","WARMING->STANDBY","WARMING->FAILED","STANDBY->ACTIVE","ACTIVE->DRAINING","DRAINING->UNLOADING","UNLOADING->RETIRED","UNLOADING->FAILED"]);
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
function validTuple(h){for(const value of tuple(h))assert.ok(typeof value==="string"&&value.trim().length>0);}
function replay(events){
  const states=new Map(),active=new Map(),owners=new Map(),handles=new Map(),loadReports=new Map();
  for(const [index,e] of events.entries()){
    assert.equal(e.sequence,index+1);assert.ok(e.actor&&e.cause&&e.traceId);
    assert.ok(["DEPLOYMENT_MANAGER","ARTIFACT_REGISTRY","LIFECYCLE_CAPABILITY"].includes(e.owner));
    if(e.owner==="LIFECYCLE_CAPABILITY"){
      assert.equal(e.previousState,null);assert.equal(e.newState,null);
      if(e.event==="LOAD_SUCCEEDED"){validTuple(e.details);loadReports.set(e.deploymentId,e.details);}
    }
    if(e.owner!=="DEPLOYMENT_MANAGER")continue;
    if(e.event==="RUNTIME_HANDLE_ADMITTED"){
      assert.equal(e.previousState,null);assert.equal(e.newState,null);assert.equal(states.get(e.deploymentId),"LOADING");
      validTuple(e.details);assert.deepEqual(tuple(e.details),tuple(loadReports.get(e.deploymentId)));
      assert.equal(owners.has(key(e.details)),false,"one owner per canonical tuple, across slots and artifacts");
      owners.set(key(e.details),e.deploymentId);handles.set(e.deploymentId,e.details);
    }
    if(e.event==="RUNTIME_HANDLE_REJECTED"){
      assert.equal(e.previousState,null);assert.equal(e.newState,null);assert.equal(states.get(e.deploymentId),"LOADING");
      validTuple(e.details);assert.deepEqual(tuple(e.details),tuple(loadReports.get(e.deploymentId)));
      assert.equal(e.details.priorOwnerState,states.get(e.details.priorOwnerDeploymentId));
      assert.equal(e.details.reason,"CANONICAL_IDENTITY_ALREADY_RESERVED");
      assert.notEqual(e.details.priorOwnerDeploymentId,e.deploymentId);
      if(e.details.priorAdmissionDisposition==="ADMITTED")assert.equal(owners.get(key(e.details)),e.details.priorOwnerDeploymentId);
      else{assert.equal(e.details.priorAdmissionDisposition,"UNKNOWN");assert.equal(e.details.priorOwnerState,"FAILED");assert.equal(owners.has(key(e.details)),false);}
    }
    if(e.event==="RUNTIME_HANDLE_RELEASE_UNCERTAIN"){
      assert.equal(e.previousState,null);assert.equal(e.newState,null);assert.equal(states.get(e.deploymentId),"FAILED");
      assert.equal(e.details.releaseObservation,"UNKNOWN");assert.equal(owners.get(key(e.details)),e.deploymentId);
      const preceding=events.slice(0,index).findLast(item=>item.deploymentId===e.deploymentId&&item.owner==="LIFECYCLE_CAPABILITY"&&["UNLOAD_FAILED","FAILED_HANDLE_RELEASE_FAILED"].includes(item.event));
      assert.ok(preceding);assert.equal(e.details.code,preceding.details.code);
    }
    if(e.newState===null)continue;
    assert.equal(e.previousState,states.get(e.deploymentId)??null);
    assert.ok(e.previousState===null&&e.newState==="REQUESTED"||edges.has(`${e.previousState}->${e.newState}`));
    if(["WARMING","ACTIVE","UNLOADING"].includes(e.newState))assert.ok(handles.has(e.deploymentId),"state requires an admitted owner handle");
    if(e.previousState==="ACTIVE"){assert.equal(active.get(e.slot),e.deploymentId);active.delete(e.slot);}
    if(e.newState==="ACTIVE"){assert.equal(active.has(e.slot),false);active.set(e.slot,e.deploymentId);}
    states.set(e.deploymentId,e.newState);
  }
  return {states,handles,active:Object.fromEntries([...active.entries()].sort())};
}
function verifyRow(row){
  const replayed=replay(row.events),snapshots=new Map(row.snapshots.map(s=>[s.deploymentId,s]));
  for(const s of row.snapshots)assert.equal(s.state,replayed.states.get(s.deploymentId));
  assert.deepEqual(row.activeAfter,replayed.active);
  assert.deepEqual(row.retainedPinAfter,row.retainedPinBefore);assert.equal(row.retainedPinReleaseOutcome,"OBLIGATION_COMPLETED");
  assert.equal(row.retainedPinBefore.deploymentId,"active");assert.deepEqual(row.retainedPinBefore.artifact,row.artifact);
  assert.deepEqual(tuple(row.retainedPinBefore.runtimeHandle),tuple(replayed.handles.get("active")));
  assert.ok(row.activeSnapshotAfter.outstandingPins>=1);
  const c=row.candidate,id=row.case,candidate=snapshots.get("candidate");
  const verifyCallbacks=(model,deployment,events,owned)=>{
    assert.equal(model.loads,1);assert.equal(model.warms,model.warmArguments.length);assert.equal(model.unloads,model.unloadArguments.length);
    for(const h of [...model.warmArguments,...model.unloadArguments]){
      assert.deepEqual(tuple(h),tuple(model.returned));assert.deepEqual(tuple(h),tuple(owned.handles.get(deployment)));
    }
    if(model.returned!==null){
      const load=events.find(e=>e.owner==="LIFECYCLE_CAPABILITY"&&e.event==="LOAD_SUCCEEDED"&&e.deploymentId===deployment);
      if(id==="load_observation_record_failure"&&deployment==="candidate")assert.equal(load,undefined);
      else{assert.ok(load);assert.deepEqual(tuple(load.details),tuple(model.returned));}
    }
  };
  if(id==="separate_owner_lifetime")verifyCallbacks(c,"other-owner-deployment",row.otherOwnerEvents,replay(row.otherOwnerEvents));
  else verifyCallbacks(c,id==="concurrent_duplicate_returns"?"candidate-a":"candidate",row.events,replayed);
  if(row.secondCandidate)verifyCallbacks(row.secondCandidate,"candidate-b",row.events,replayed);
  if(row.holder)verifyCallbacks(row.holder,"holder",row.events,replayed);
  if(row.retry)verifyCallbacks(row.retry,"retry",row.events,replayed);
  const noCallbacks=()=>{assert.equal(c.warms,0);assert.equal(c.unloads,0);};
  const failedUnadopted=()=>{assert.equal(candidate.state,"FAILED");assert.equal(candidate.runtimeProviderIdentity,null);assert.equal(candidate.runtimeProviderVersion,null);
    assert.equal(candidate.outstandingPins,0);assert.equal(replayed.handles.has("candidate"),false);assert.equal(row.candidatePin,undefined);
    assert.deepEqual(row.activeAfter,row.activeBeforeCandidate);assert.equal(row.activeSnapshotAfter.state,"ACTIVE");noCallbacks();};
  const rejected=()=>{failedUnadopted();const diagnostic=row.events.find(e=>e.deploymentId==="candidate"&&e.event==="RUNTIME_HANDLE_REJECTED");assert.ok(diagnostic);
    assert.deepEqual(tuple(diagnostic.details),tuple(c.returned));const transition=row.events.find(e=>e.deploymentId==="candidate"&&e.newState==="FAILED");
    assert.equal(transition.details.stage,"HANDLE_ADMISSION");assert.equal(transition.details.code,conflict);
    assert.equal(diagnostic.artifactIdentity,candidate.artifact.identity);assert.equal(diagnostic.artifactDigest,candidate.artifact.digest);};
  if(id==="concurrent_duplicate_returns"){
    assert.deepEqual([...row.loadErrors].sort(),["",conflict]);assert.equal(row.candidatePins.length,1);assert.equal(row.sameReturnedObject,false);
    assert.deepEqual(tuple(c.returned),tuple(row.secondCandidate.returned));assert.equal(row.secondCandidate.loads,1);
    assert.equal(c.warms+row.secondCandidate.warms,1);assert.equal(c.unloads+row.secondCandidate.unloads,0);
    const rejectedSnapshot=[snapshots.get("candidate-a"),snapshots.get("candidate-b")].find(s=>s.state==="FAILED");
    assert.ok(rejectedSnapshot);assert.equal(rejectedSnapshot.runtimeProviderIdentity,null);assert.equal(rejectedSnapshot.runtimeProviderVersion,null);
    assert.equal(row.events.filter(e=>e.event==="RUNTIME_HANDLE_ADMITTED"&&e.deploymentId.startsWith("candidate-")).length,1);
    assert.equal(row.events.filter(e=>e.event==="RUNTIME_HANDLE_REJECTED"&&e.deploymentId.startsWith("candidate-")).length,1);
    const p=row.candidatePins[0];assert.deepEqual(tuple(p.runtimeHandle),tuple(replayed.handles.get(p.deploymentId)));
    assert.deepEqual(row.duringLoadPin.runtimeHandle,row.retainedPinBefore.runtimeHandle);assert.equal(row.activeAfter.slot,"active");assert.equal(row.activeSnapshotAfter.state,"ACTIVE");
  }else if(id==="separate_owner_lifetime"){
    const other=replay(row.otherOwnerEvents);assert.equal(row.otherOwnerSnapshot.state,"ACTIVE");
    assert.deepEqual(tuple(row.otherOwnerPin.runtimeHandle),tuple(row.retainedPinBefore.runtimeHandle));
    assert.deepEqual(tuple(row.otherOwnerPin.runtimeHandle),tuple(other.handles.get(row.otherOwnerPin.deploymentId)));
    assert.deepEqual(row.activeAfter,row.activeBeforeCandidate);
  }else if(id==="admission_record_failure"||id==="load_observation_record_failure"){
    failedUnadopted();assert.equal(row.diagnosticFailureInjected,true);assert.equal(row.candidateError,"CAPABILITY_FAILURE");
    const failed=row.events.find(e=>e.deploymentId==="candidate"&&e.newState==="FAILED");
    assert.equal(failed.details.stage,"HANDLE_ADMISSION");assert.equal(failed.details.code,id==="admission_record_failure"?"REQUIRED_ADMISSION_RECORD_FAILED":"REQUIRED_LOAD_OBSERVATION_RECORD_FAILED");
    assert.equal(snapshots.get("retry").state,"FAILED");assert.equal(snapshots.get("retry").runtimeProviderIdentity,null);
    assert.equal(row.retryError,conflict);assert.equal(row.retry.loads,1);assert.equal(row.retry.warms,0);assert.equal(row.retry.unloads,0);
    const diag=row.events.find(e=>e.event==="RUNTIME_HANDLE_REJECTED"&&e.deploymentId==="retry");assert.ok(diag);
    assert.equal(diag.details.priorAdmissionDisposition,"UNKNOWN");assert.equal(diag.details.priorOwnerDeploymentId,"candidate");
    assert.deepEqual(tuple(diag.details),tuple(c.returned));
  }else if(id.startsWith("retired_")||id.startsWith("live_")||id.startsWith("warm_failed_")||id==="unload_failed_reentry"||id==="cross_artifact_alias"){
    rejected();
    if(id.startsWith("retired_")){assert.equal(row.rollbackResult.state,"FAILED");assert.equal(row.holderBeforeCandidate.state,"RETIRED");assert.equal(row.holderAfterCandidate.state,"RETIRED");
      assert.equal(row.events.some(e=>e.deploymentId==="candidate"&&e.event==="ROLLBACK_COMMITTED"),false);
      assert.ok(row.events.some(e=>e.deploymentId==="candidate"&&e.event==="ROLLBACK_FAILED"&&e.details.code===conflict));
      assert.equal(row.sameReturnedObject,id==="retired_same_object");
    }else assert.equal(row.candidateError,conflict);
    if(row.originalHandle)assert.deepEqual(tuple(c.returned),tuple(row.originalHandle));
    if(id.startsWith("live_")&&id!=="live_alias_cleanup"){
      assert.equal(row.holderBeforeCandidate.state,id.substring(5).toUpperCase()==="LOADED"?"LOADING":id.substring(5).toUpperCase());
      assert.equal(row.holderAfterCandidate.state,id==="live_warming"?"STANDBY":id==="live_unloading"?"RETIRED":row.holderBeforeCandidate.state);
    }
    if(id.startsWith("warm_failed_")||id==="unload_failed_reentry"){
      assert.equal(row.holderBeforeCandidate.state,"FAILED");assert.equal(row.holderAfterCandidate.state,"FAILED");assert.equal(row.holder.unloads,1);
      if(id!=="warm_failed_release_reentry"){
        const unknown=row.events.find(e=>e.event==="RUNTIME_HANDLE_RELEASE_UNCERTAIN"&&e.deploymentId==="holder");assert.ok(unknown);
        assert.equal(unknown.details.releaseObservation,"UNKNOWN");
        assert.equal(row.events.find(e=>e.event==="RUNTIME_HANDLE_REJECTED"&&e.deploymentId==="candidate").details.priorReleaseObservation,"UNKNOWN");
      }
    }
    if(id==="cross_artifact_alias"){
      assert.notDeepEqual(row.requestedArtifact,row.artifact);assert.deepEqual(candidate.artifact,row.requestedArtifact);
      const rejected=row.events.find(e=>e.event==="RUNTIME_HANDLE_REJECTED"&&e.deploymentId==="candidate");
      assert.equal(rejected.details.priorOwnerArtifactIdentity,row.artifact.identity);assert.equal(rejected.details.priorOwnerArtifactDigest,row.artifact.digest);
    }
  }else if(id==="null_return"||id.startsWith("malformed_")){
    failedUnadopted();assert.equal(row.candidateError,"CAPABILITY_FAILURE");assert.equal(c.returned,null);
    assert.ok(row.events.some(e=>e.deploymentId==="candidate"&&e.event==="LOAD_FAILED"&&e.owner==="LIFECYCLE_CAPABILITY"));
  }else{
    assert.equal(candidate.state,"ACTIVE");assert.equal(c.warms,1);assert.equal(c.unloads,0);
    assert.equal(row.sameReturnedTuple,false);assert.notDeepEqual(tuple(c.returned),tuple(row.originalHandle));
    assert.deepEqual(tuple(row.candidatePin.runtimeHandle),tuple(c.returned));assert.deepEqual(tuple(row.candidatePin.runtimeHandle),tuple(replayed.handles.get("candidate")));
    assert.deepEqual(row.candidatePin.artifact,row.artifact);
    if(id==="fresh_rollback")assert.ok(row.events.some(e=>e.deploymentId==="candidate"&&e.event==="ROLLBACK_COMMITTED"));
  }
}
export function verifyM4HandleEvidence(directory,options={}){
  const failures=[],incomplete=[],results=[],mutationResults=[];
  const read=name=>{assert.ok(!name.includes("..")&&!path.isAbsolute(name));const p=path.join(directory,name);if(!fs.existsSync(p)){incomplete.push(`missing ${name}`);return null;}return fs.readFileSync(p);};
  const check=(label,fn)=>{try{fn();}catch(e){failures.push(`${label}: ${e.message}`);}};
  const bytes=read("manifest.json");if(!bytes)return {verdict:"INCONCLUSIVE",failures,incomplete,results,mutationResults};
  let manifest;try{manifest=JSON.parse(bytes);}catch{return {verdict:"FAIL",failures:["unreadable manifest"],incomplete,results,mutationResults};}
  check("source binding",()=>{
    assert.equal(manifest.schemaVersion,"jpyxis.io/m4-handle-evidence/v1alpha1");assert.match(manifest.source.revision,/^[0-9a-f]{40}$/);
    assert.equal(manifest.source.scope,"IMMUTABLE_GIT_SOURCE");assert.equal(manifest.source.dirty,"");assert.equal(manifest.compileExit,0);assert.equal(manifest.sourcesUnchangedAtEnd,true);
    if(options.expectedSourceRevision)assert.equal(manifest.source.revision,options.expectedSourceRevision);
    assert.equal(manifest.source.tree,git("rev-parse",`${manifest.source.revision}^{tree}`));
    for(const input of manifest.sources)assert.equal(input.gitBlob,git("rev-parse",`${manifest.source.revision}:${input.path}`));
    assert.equal(manifest.contractTag,"m4-handle-contract-v2");assert.equal(manifest.contractSource,"43df2cc678d60bb8a8ddf7f23f1aa82bbcca898e");
    assert.equal(manifest.contractSpecBlob,"3445779836822cf033fb2fd9007486141f98339d");assert.equal(manifest.contractAdrBlob,"9a1b42474fce04dbe7678fc7c68c262be609a2e3");
    assert.equal(git("rev-parse",`${manifest.source.revision}:docs/spec/m4-handle-ownership-contract-v2.md`),manifest.contractSpecBlob);
    assert.equal(git("rev-parse",`${manifest.source.revision}:docs/adr/0013-m4-runtime-handle-conservation.md`),manifest.contractAdrBlob);
    assert.deepEqual(manifest.runs.map(r=>r.case),handleCases);
    assert.equal(manifest.files.length,58);assert.equal(new Set(manifest.files.map(f=>f.path)).size,58);
  });
  for(const f of manifest.files??[]){const b=read(f.path);if(b)check(f.path,()=>{assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);});}
  for(const id of handleCases){
    const run=manifest.runs?.find(r=>r.case===id);if(!run){incomplete.push(`missing case ${id}`);continue;}
    const out=read(run.stdout),err=read(run.stderr);if(!out||!err)continue;
    const prior=failures.length;check(id,()=>{assert.equal(run.exitCode,0);assert.equal(run.signal,null);assert.equal(run.error,null);assert.equal(err.length,0);const row=JSON.parse(out);assert.equal(row.case,id);verifyRow(row);});
    results.push({id,verdict:failures.length===prior?"PASS":"FAIL"});
  }
  if(options.verifyMutations){
    const expected={missing_case_stdout:"INCONCLUSIVE",rehashed_foreign_cleanup:"FAIL",self_declared_alias_adoption:"FAIL"};
    check("mutation matrix",()=>assert.deepEqual(manifest.mutations.map(m=>m.id).sort(),Object.keys(expected).sort()));
    for(const m of manifest.mutations??[]){
      check(m.id,()=>{assert.ok(m.path===`../handle-validation-mutations/${m.id}`);const observed=verifyM4HandleEvidence(path.resolve(directory,m.path),{...options,verifyMutations:false});assert.equal(observed.verdict,expected[m.id]);mutationResults.push({id:m.id,verdict:observed.verdict});});
    }
  }
  return {verdict:incomplete.length?"INCONCLUSIVE":failures.length?"FAIL":"PASS",failures,incomplete,results,mutationResults,
    scope:"M4 canonical handle admission/release public model, one in-memory owner; no real process or product qualification"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyM4HandleEvidence(path.resolve(process.argv[2]),{expectedSourceRevision:process.argv[3],verifyMutations:true});console.log(JSON.stringify(result,null,2));process.exit(result.verdict==="PASS"?0:1);
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cases=['fresh_handle_rollback_control','retired_handle_rollback','retired_cloned_tuple_rollback'];
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const tuple=h=>[h.providerIdentity,h.providerVersion,h.opaqueHandle];
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
export function verifyRetiredHandleProbe(directory,expectedBase){
  const failures=[],incomplete=[],results=[];
  const read=name=>{assert.ok(!path.isAbsolute(name)&&!name.includes('..'));const p=path.join(directory,name);if(!fs.existsSync(p)){incomplete.push(`missing ${name}`);return null;}return fs.readFileSync(p);};
  const check=(name,fn)=>{try{fn();}catch(e){failures.push(`${name}: ${e.message}`);}};
  const bytes=read('receipt.json');if(!bytes)return {verdict:'INCONCLUSIVE',auditDecision:'INCONCLUSIVE',failures,incomplete,results};
  let receipt;try{receipt=JSON.parse(bytes);}catch{return {verdict:'FAIL',auditDecision:'INCONCLUSIVE',failures:['unreadable receipt'],incomplete,results};}
  check('immutable input binding',()=>{
    assert.match(expectedBase,/^[0-9a-f]{40}$/);assert.equal(receipt.sourceBase,expectedBase);
    assert.equal(receipt.schemaVersion,'jpyxis.io/m4-retired-handle-audit-v3/v1alpha1');
    assert.equal(receipt.sourceTree,git('rev-parse',`${expectedBase}^{tree}`));assert.equal(receipt.compileExit,0);assert.equal(receipt.sourcesUnchangedAtEnd,true);
    assert.deepEqual(receipt.runs.map(r=>r.id),cases);
    for(const input of receipt.sources)assert.equal(input.gitBlob,git('rev-parse',`${expectedBase}:${input.path}`));
    for(const input of receipt.harness)assert.equal(input.gitBlob,git('rev-parse',`${receipt.candidateHead}:${input.path}`));
    assert.equal(sha(read('compile.stdout.bin')),receipt.compileStdoutSha256);
    const err=read('compile.stderr.bin');assert.equal(sha(err),receipt.compileStderrSha256);assert.equal(err.length,0);
  });
  for(const id of cases){
    const run=receipt.runs.find(r=>r.id===id);if(!run){incomplete.push(`missing ${id}`);continue;}
    const out=read(run.stdout),err=read(run.stderr);if(!out||!err)continue;
    const prior=failures.length;
    check(id,()=>{
      assert.equal(sha(out),run.stdoutSha256);assert.equal(sha(err),run.stderrSha256);assert.equal(err.length,0);
      assert.equal(run.exitCode,0);assert.equal(run.signal,null);assert.equal(run.error,null);
      const row=JSON.parse(out);assert.equal(row.case,id);
      assert.equal(row.retiredBeforeRollback.state,'RETIRED');assert.equal(row.retiredAfterRollback.state,'RETIRED');
      assert.deepEqual(row.retiredBeforeRollback.artifact,row.retiredAfterRollback.artifact);assert.equal(row.oldUnloadCalls,1);
      assert.equal(row.newLoadCalls,1);assert.equal(row.newUnloadCalls,0);
      assert.equal(row.retainedCurrentPin.deploymentId,'deployment-v2');assert.equal(row.activeBefore.slot,'deployment-v2');
      const states=new Map(),handles=new Map(),owners=new Set(),active=new Map();
      for(const [n,event] of row.allEvents.entries()){
        assert.equal(event.sequence,n+1);
        if(event.owner==='LIFECYCLE_CAPABILITY'){assert.equal(event.previousState,null);assert.equal(event.newState,null);}
        if(event.owner!=='DEPLOYMENT_MANAGER')continue;
        if(event.event==='RUNTIME_HANDLE_ADMITTED'){
          const key=JSON.stringify(tuple(event.details));assert.equal(owners.has(key),false);owners.add(key);handles.set(event.deploymentId,event.details);
        }
        if(event.newState===null)continue;
        assert.equal(event.previousState,states.get(event.deploymentId)??null);
        if(event.previousState==='ACTIVE'){assert.equal(active.get(event.slot),event.deploymentId);active.delete(event.slot);}
        if(event.newState==='ACTIVE'){assert.equal(active.has(event.slot),false);active.set(event.slot,event.deploymentId);}
        states.set(event.deploymentId,event.newState);
      }
      assert.deepEqual(Object.fromEntries(active),row.activeAfter);
      assert.equal(states.get('deployment-v1'),'RETIRED');assert.equal(states.get('deployment-rollback'),row.rollbackSnapshot.state);
      assert.deepEqual(tuple(row.retainedCurrentPin.runtimeHandle),tuple(handles.get('deployment-v2')));
      assert.deepEqual(tuple(row.oldHandle),tuple(handles.get('deployment-v1')));
      const events=row.eventsAfterRollbackRequest;
      if(id==='fresh_handle_rollback_control'){
        assert.equal(row.rollbackSnapshot.state,'ACTIVE');assert.equal(row.activeAfter.slot,'deployment-rollback');assert.equal(row.newWarmCalls,1);
        assert.equal(row.newPin.deploymentId,'deployment-rollback');assert.deepEqual(row.newPin.artifact,row.retiredBeforeRollback.artifact);
        assert.deepEqual(tuple(row.newPin.runtimeHandle),tuple(row.returnedHandle));assert.notDeepEqual(tuple(row.returnedHandle),tuple(row.oldHandle));
        assert.equal(events.filter(e=>e.owner==='DEPLOYMENT_MANAGER'&&e.event==='ROLLBACK_COMMITTED').length,1);
      }else{
        assert.equal(row.rollbackSnapshot.state,'FAILED');assert.deepEqual(row.activeAfter,row.activeBefore);assert.equal(row.newWarmCalls,0);
        assert.deepEqual(row.newPin.runtimeHandle,row.retainedCurrentPin.runtimeHandle);assert.equal(row.newPin.deploymentId,'deployment-v2');
        assert.deepEqual(row.newPin.artifact,row.retainedCurrentPin.artifact);assert.deepEqual(tuple(row.returnedHandle),tuple(row.oldHandle));
        assert.equal(row.sameReturnedObjectAsRetired,id==='retired_handle_rollback');
        assert.equal(events.some(e=>e.event==='ROLLBACK_COMMITTED'||e.event==='RUNTIME_HANDLE_ADMITTED'||e.event==='WARMUP_STARTED'||e.event==='UNLOAD_STARTED'),false);
        const rejected=events.filter(e=>e.owner==='DEPLOYMENT_MANAGER'&&e.event==='RUNTIME_HANDLE_REJECTED');assert.equal(rejected.length,1);
        assert.equal(rejected[0].previousState,null);assert.equal(rejected[0].newState,null);assert.deepEqual(tuple(rejected[0].details),tuple(row.oldHandle));
        assert.equal(rejected[0].details.priorOwnerDeploymentId,'deployment-v1');assert.equal(rejected[0].details.priorOwnerState,'RETIRED');
        const failed=events.filter(e=>e.owner==='DEPLOYMENT_MANAGER'&&e.event==='ROLLBACK_FAILED');assert.equal(failed.length,1);
        assert.equal(failed[0].details.code,'RUNTIME_HANDLE_IDENTITY_CONFLICT');
      }
    });results.push({id,verdict:failures.length===prior?'PASS':'FAIL'});
  }
  const verdict=incomplete.length?'INCONCLUSIVE':failures.length?'FAIL':'PASS';
  return {verdict,auditDecision:verdict==='PASS'?'NO_COUNTEREXAMPLE_OBSERVED':'STOP_OR_INCONCLUSIVE',failures,incomplete,results,sourceBase:receipt.sourceBase,scope:'Three public M4 model rollback checks only; no real process, freshness or product-path proof'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const r=verifyRetiredHandleProbe(path.resolve(process.argv[2]),process.argv[3]);console.log(JSON.stringify(r,null,2));process.exit(r.verdict==='PASS'?0:2);
}

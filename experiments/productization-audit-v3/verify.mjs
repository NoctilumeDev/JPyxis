import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

export const auditCases=[
  ...["honest_plan_control","worker_instance_substitution","worker_epoch_substitution","idempotency_substitution"]
    .map(id=>({id,main:"CoordinateGateProbe"})),
  ...["replacement_instance_failure","same_instance_failure_control","replacement_success_control"]
    .map(id=>({id,main:"InstanceFailureProbe"})),
  ...["handle_worker","handle_instance","handle_epoch"].map(id=>({id,main:"CoordinateValidationMain"}))
];
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
export function verifyAuditProbe(directory,expectedBase){
  const failures=[],incomplete=[],results=[];
  const read=file=>{const p=path.join(directory,file);if(!fs.existsSync(p)){incomplete.push(`missing ${file}`);return null;}return fs.readFileSync(p);};
  const check=(label,fn)=>{try{fn();}catch(error){failures.push(`${label}: ${error.message}`);}};
  const bytes=read("receipt.json");if(!bytes)return {verdict:"INCONCLUSIVE",failures,incomplete,results};
  let receipt;try{receipt=JSON.parse(bytes);}catch{return {verdict:"FAIL",failures:["Unreadable receipt"],incomplete,results};}
  check("source binding",()=>{
    assert.equal(receipt.schemaVersion,"jpyxis.io/productization-audit-v3-probe/v1alpha1");
    assert.match(expectedBase,/^[0-9a-f]{40}$/);assert.equal(receipt.sourceBase,expectedBase);
    assert.equal(receipt.sourceTree,git("rev-parse",`${receipt.sourceBase}^{tree}`));
    assert.equal(receipt.compileExit,0);assert.equal(receipt.sourcesUnchangedAtEnd,true);
    assert.deepEqual(receipt.runs.map(({id,main})=>({id,main})),auditCases);
    for(const source of receipt.sources)assert.equal(source.gitBlob,git("rev-parse",`${receipt.sourceBase}:${source.path}`));
    for(const source of receipt.harness)assert.equal(source.gitBlob,git("rev-parse",`${receipt.candidateHead}:${source.path}`));
  });
  check("compile raw hashes",()=>{assert.equal(sha(read("compile.stdout.bin")),receipt.compileStdoutSha256);const err=read("compile.stderr.bin");assert.equal(sha(err),receipt.compileStderrSha256);assert.equal(err.length,0);});
  for(const item of auditCases){
    const run=receipt.runs.find(r=>r.id===item.id);if(!run){incomplete.push(`missing ${item.id}`);continue;}
    const out=read(run.stdout),err=read(run.stderr);if(!out||!err)continue;
    const count=failures.length;
    check(item.id,()=>{
      assert.equal(run.exitCode,0);assert.equal(run.signal,null);assert.equal(run.error,null);assert.equal(err.length,0);assert.equal(sha(out),run.stdoutSha256);assert.equal(sha(err),run.stderrSha256);
      const row=JSON.parse(out);assert.equal(row.case,item.id);
      if(item.main==="CoordinateGateProbe"){
        assert.equal(row.unexpectedAcceptance,false);
        if(item.id==="honest_plan_control"){assert.equal(row.observedState,"SUCCEEDED");assert.equal(row.authoritativeIdempotencyMode,"NONE");}
        else{assert.equal(row.observedException,"ATTEMPT_COORDINATE_MISMATCH");
          assert.equal(row.journal.filter(e=>e.event==="ATTEMPT_OBSERVED"||e.event.startsWith("INVOCATION_TERMINAL_")).length,0);
          const rejection=row.journal.filter(e=>e.event==="ATTEMPT_INPUT_REJECTED");assert.equal(rejection.length,1);
          assert.equal(rejection[0].owner,"RESILIENT_INVOCATION_MANAGER");assert.equal(rejection[0].details.newState,undefined);}
      }else if(item.main==="InstanceFailureProbe"){
        assert.equal(row.submittedPlanUnmodified,true);assert.equal(row.unexpectedReplacementMutation,false);
        assert.equal(row.beforeInstance,row.afterInstance);assert.equal(row.currentCapabilityStillHealthy,true);
        assert.equal(row.logicalOutcome,item.id==="replacement_success_control"?"SUCCEEDED":"OUTCOME_UNKNOWN");
        const effects=row.eventsAfterOldObservation;
        if(item.id==="same_instance_failure_control"){assert.equal(row.afterState,"INELIGIBLE");assert.equal(row.attemptInstance,row.afterInstance);}
        else{assert.equal(row.beforeState,"ELIGIBLE");assert.equal(row.afterState,"ELIGIBLE");assert.notEqual(row.attemptInstance,row.afterInstance);
          assert.equal(effects.filter(e=>e.owner==="WORKER_SUPERVISOR"&&e.details.newState).length,0);}
        if(item.id==="replacement_instance_failure"){
          const ignored=effects.filter(e=>e.event==="WORKER_INSTANCE_OBSERVATION_IGNORED");assert.equal(ignored.length,1);
          assert.equal(ignored[0].details.reason,"SUPERSEDED_WORKER_INSTANCE");
          assert.equal(ignored[0].details.originatingInstanceId,row.attemptInstance);assert.equal(ignored[0].details.currentInstanceId,row.afterInstance);
        }
      }else{
        assert.equal(row.workerAfter.state,"FAILED");assert.equal(row.workerAfter.processId,0);
        assert.equal(row.healthCalls,0);assert.equal(row.stopCalls,0);assert.equal(row.routingException,"NO_ELIGIBLE_WORKER");
        assert.equal(row.eventsAfter.filter(e=>e.event==="WORKER_HANDLE_PINNED").length,0);
        const rejected=row.eventsAfter.filter(e=>e.event==="WORKER_HANDLE_REJECTED");assert.equal(rejected.length,1);
        assert.equal(rejected[0].details.code,"WORKER_COORDINATE_MISMATCH");assert.equal(rejected[0].details.newState,undefined);
      }
    });results.push({id:item.id,verdict:failures.length===count?"PASS":"FAIL"});
  }
  return {verdict:failures.length?"FAIL":incomplete.length?"INCONCLUSIVE":"PASS",failures,incomplete,results,
    sourceBase:receipt.sourceBase,scope:"Ten fresh source-bound model checks only; no cross-module real execution or product qualification"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyAuditProbe(path.resolve(process.argv[2]),process.argv[3]);console.log(JSON.stringify(result,null,2));process.exit(result.verdict==="PASS"?0:2);
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {verifyRetainedWireReport} from './verify-reference-wire.mjs';
const sha=raw=>'sha256:'+crypto.createHash('sha256').update(raw).digest('hex');
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=v=>Buffer.from(JSON.stringify(sort(v)));
const eq=(a,b,message)=>assert.deepEqual(sort(a),sort(b),message);
export function verifyRiskHostEvidence(directory,{expectedSourceRevision,requirePublicClean=false}={}){
  const root=path.resolve(directory),failures=[],missing=[];let requestCount=0,actualWorkers=0;
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
  const lines=name=>fs.readFileSync(path.join(root,name),'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  try{
    const manifest=read('manifest.json');assert.equal(manifest.schemaVersion,'jpyxis.io/risk-host-evidence/v1alpha1');
    assert.equal(manifest.sourceRevision,expectedSourceRevision,'external exact source binding');
    for(const entry of manifest.files){
      assert.ok(!entry.path.includes('..')&&!path.isAbsolute(entry.path),'bounded artifact member');
      const file=path.join(root,entry.path);if(!fs.existsSync(file)){missing.push(entry.path);continue;}
      const bytes=fs.readFileSync(file);assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(sha(bytes),entry.sha256,entry.path);
    }
    if(missing.length)return{verdict:'INCONCLUSIVE',missing,failures:[],productizationQualified:false};
    const source=read('source.json'),inventory=read('input-inventory.json'),construction=read('construction.json'),config=read('config.json');
    assert.equal(source.revision,expectedSourceRevision);assert.equal(source.dirty,false);
    const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
    assert.equal(source.tree,git('rev-parse',`${expectedSourceRevision}^{tree}`));
    if(requirePublicClean){assert.equal(source.publicClean,true,'public clean source required');assert.equal(source.localMavenReuse,false);assert.equal(source.ci.provider,'github-actions');assert.equal(source.ci.sourceRevision,expectedSourceRevision);assert.equal(source.ci.pipCache,false);assert.equal(source.ci.mavenCache,false);assert.ok(source.ci.runId&&source.ci.runnerImageVersion);}
    eq(inventory.files.map(e=>e.path),git('ls-tree','-r','--name-only',expectedSourceRevision).split('\n').filter(name=>/^(reference-apps\/versioned-risk-scoring\/|reference\/|bindings\/(java\/src\/main|python\/)|invocation\/(java\/src\/main|python\/)|lifecycle\/java\/src\/main|resilience\/java\/src\/main|spec\/(m1\/contracts|m2\/(proto|cases))|scripts\/(run-risk-scoring-host|verify-risk-host|verify-reference-wire))/.test(name)||name==='pom.xml'||name==='.github/workflows/repository-gates.yml'||/\/java\/pom.xml$/.test(name)),'complete source input inventory');
    assert.equal(construction.javaArtifactSha256,sha(fs.readFileSync(path.join(root,'artifacts/host.jar'))),'actual retained Java artifact');
    const calibration=new Map();
    for(const version of ['v1','v2']){
      const raw=fs.readFileSync(path.join(root,'inputs/reference-apps/versioned-risk-scoring/algorithms',`risk-${version}.py`));
      eq(Buffer.from(config.definitions[version].bytes,'base64'),raw,'immutable definition source bytes');
      const marker=raw.toString('utf8').split(/\r?\n/).find(line=>line.startsWith('# RISK_CALIBRATION '));
      calibration.set(version,{...JSON.parse(marker.slice('# RISK_CALIBRATION '.length)),digest:sha(raw),identity:config.definitions[version].identity});
    }
    for(const command of construction.commands)assert.equal(command.exit.code,0,'construction command succeeded');
    eq(construction.installedInventory,{...construction.installedInventory,numpy:'2.2.6',grpcio:'1.83.1',protobuf:'7.35.1','grpcio-tools':'1.83.1'},'frozen actual installed packages');
    assert.equal(construction.inputInventoryDigest,sha(fs.readFileSync(path.join(root,'input-inventory.json'))));
    assert.equal(config.executionBuild.constructionReceiptDigest,sha(fs.readFileSync(path.join(root,'construction.json'))));
    assert.equal(config.executionBuild.sourceRevision,expectedSourceRevision);assert.equal(config.executionBuild.sourceTree,source.tree);
    for(const entry of inventory.files){
      const raw=fs.readFileSync(path.join(root,'inputs',entry.path));assert.equal(sha(raw),entry.sha256);assert.equal(raw.length,entry.bytes);
      const normalized=Buffer.from(new TextDecoder('utf-8',{fatal:true}).decode(raw).replaceAll('\r\n','\n'));
      const blob=crypto.createHash('sha1').update(Buffer.from(`blob ${normalized.length}\0`)).update(normalized).digest('hex');
      assert.equal(blob,entry.gitBlob,'source text differs beyond checkout line endings');assert.equal(entry.gitBlob,git('rev-parse',`${expectedSourceRevision}:${entry.path}`));
    }
    const control=lines('control-source.jsonl');control.forEach((r,i)=>assert.equal(r.sequence,i+1,'required owner chronology'));
    const positives=control.filter(r=>r.owner==='COMPOSITION_CONTROL'&&r.event==='QUALIFICATION_DECIDED'&&r.details.positive);
    assert.equal(positives.length,3,'three fresh qualified realizations');
    const workers=new Map();
    for(const entry of manifest.files.filter(e=>e.path.endsWith('/worker-source.jsonl')&&!e.path.includes('/independent-probe/'))){
      const records=lines(entry.path),base=path.dirname(entry.path),facts=read(`${base}/worker-facts.json`),descriptor=read(`${base}/descriptor.json`),probe=read(`${base}/independent-probe/worker-facts.json`);
      actualWorkers++;assert.equal(facts.pid,descriptor.processId??facts.pid);assert.equal(facts.launchNonce,descriptor.launchNonce);
      const launch=control.find(r=>r.owner==='HOST_LAUNCH'&&r.event==='ACTUAL_WORKER_STARTED'&&r.details.launchNonce===facts.launchNonce);assert.ok(launch,'original owned launch');
      assert.equal(facts.pid,launch.details.handle.processId);assert.ok(launch.details.birth);
      const qualification=positives.find(r=>r.details.realization.launchNonce===facts.launchNonce);assert.ok(qualification,'Control qualified actual launch');
      assert.ok(control.indexOf(launch)<control.indexOf(qualification),'launch precedes qualification');
      for(const actual of [facts.actual,probe.actual]){
        eq(actual.environment,config.environment,'expected immutable Environment');assert.equal(actual.executable,config.pythonExecutable);assert.equal(actual.pythonFullVersion,config.interpreterVersion);
        assert.equal(actual.definitionIdentity,descriptor.definitionIdentity);assert.equal(actual.definitionDigest,sha(Buffer.from(descriptor.definitionBytes,'base64')));
        eq(actual.installedRuntimePackages,config.environment.runtimePackages,'actual installation');
        eq(actual.runtimeBinding,qualification.details.realization.runtimeBinding,'bound Runtime');
      }
      const probeLaunch=control.find(r=>r.owner==='HOST_LAUNCH'&&r.event==='INDEPENDENT_INTERPRETER_STARTED'&&r.details.pid===probe.pid);assert.ok(probeLaunch);
      assert.ok(control.some(r=>r.event==='INDEPENDENT_INTERPRETER_EXITED'&&r.details.pid===probe.pid&&r.details.exitCode===0&&!r.details.alive));
      const qualifiedReports=records.filter(r=>r.event==='BOUND_REPORT_RETAINED'&&r.details.association.purpose==='QUALIFICATION');assert.equal(qualifiedReports.length,1);
      verifyRetainedWireReport(qualifiedReports[0].details.wireReportBase64,qualifiedReports[0].details.report);
      for(const r of records.filter(r=>r.event==='BOUND_REPORT_RETAINED')){
        assert.equal(r.pid,facts.pid);eq(JSON.parse(Buffer.from(r.details.associationBytesBase64,'base64')),r.details.association,'original metadata bytes');
        verifyRetainedWireReport(r.details.wireReportBase64,r.details.report);
      }
      workers.set(facts.launchNonce,{facts,records,descriptor,qualification});
    }
    assert.equal(actualWorkers,3);
    const receipt=read('receipt.json');eq(receipt,read('scenario-export.json'),'export is exact sealed receipt');
    assert.equal(receipt.schemaVersion,'jpyxis.io/risk-host-receipt/v1alpha1');assert.equal(receipt.source.sourceRevision,expectedSourceRevision);
    eq(receipt.policy,{identity:'jpyxis.reference/risk-policy@1.0.0',allowBelow:0.55,reviewBelow:0.80,nonSuccess:'WITHHELD'});
    assert.equal(receipt.policyDigest,sha(canonical(receipt.policy)));
    requestCount=receipt.requests.length;assert.equal(requestCount,7);
    for(const request of receipt.requests){
      eq(request,read(`risk-requests/${request.id}.json`),'required business record');
      const decided=control.find(r=>r.owner==='JAVA_HOST_POLICY'&&r.event==='RISK_DECISION_RETAINED'&&r.details.id===request.id);assert.ok(decided,'Java decision owner');eq(decided.details,request);
      assert.equal(request.policyDigest,receipt.policyDigest);
      if(request.executionState!=='SUCCEEDED'){
        assert.equal(request.decision,'WITHHELD','non-success cannot become business truth');assert.equal(request.score,null);
        if(request.executionState==='FAILED_BEFORE_EXECUTION')assert.equal(request.wireCalled,false);
      }
      if(request.version){
        const association=request.dispatchAssociation;assert.ok(association,'retained real dispatch');
        eq(association.realization,request.executionBinding.realization);eq(association.pin,request.executionBinding.pin);eq(association.plan,request.executionBinding.plan);
        const owned=workers.get(association.realization.launchNonce);assert.ok(owned);assert.equal(association.realization.processId,owned.facts.pid);
        const artifact=calibration.get(request.version);assert.ok(artifact);assert.equal(association.operands.definitionDigest,artifact.digest);assert.equal(association.operands.definitionIdentity,artifact.identity);
        const samples={LOW:[0.10,0.12,0.07,0.11],STANDARD:[0.90,0.35,0.20,0.45],HIGH:[0.99,0.85,0.76,0.94]},features=request.features;
        eq([features.normalizedExposure,features.activity,features.velocity,features.concentration],samples[features.sample],'independent synthetic feature preparation');
        const expectedInput={values:{dtype:'float32',shape:[1,4],layout:'ROW_MAJOR',values:samples[features.sample]},scale:Math.fround(artifact.scale),bias:Math.fround(artifact.bias)};
        const input=association.m2.input;eq(input.values,{shape:expectedInput.values.shape,values:expectedInput.values.values},'fixed four-column normalized carrier');assert.equal(Math.fround(input.scale),expectedInput.scale);assert.equal(Math.fround(input.bias),expectedInput.bias);
        assert.equal(association.operands.runtimeRequirement.dtype,'float32');assert.equal(association.operands.runtimeRequirement.layout,'ROW_MAJOR');
        const prepared=control.find(r=>r.owner==='JAVA_HOST'&&r.event==='RISK_REQUEST_PREPARED'&&r.details.requestId===request.id);assert.ok(prepared);eq(prepared.details.features,features);eq(prepared.details.input.values,expectedInput.values,'Java typed DTO retains metadata');assert.equal(Math.fround(prepared.details.input.scale),expectedInput.scale);assert.equal(Math.fround(prepared.details.input.bias),expectedInput.bias);
        const activation=control.find(r=>r.owner==='JAVA_HOST'&&r.event==='DEPLOYMENT_ACTIVATED'&&r.details.deploymentId===association.realization.deploymentId)||control.find(r=>r.owner==='JAVA_HOST'&&r.event==='HOST_CEREMONY'&&r.details.phase==='FRESH_ROLLBACK_ACTIVATED'&&r.details.deploymentId===association.realization.deploymentId);
        assert.ok(activation);assert.ok(owned.qualification.sequence<activation.sequence&&activation.sequence<prepared.sequence&&prepared.sequence<decided.sequence,'qualified, explicitly activated, prepared, then Java decision');
        eq(association.operands,request.executionBinding.definition);assert.equal(association.operands.definitionDigest,owned.facts.actual.definitionDigest);
        assert.equal(association.plan.logicalInvocationId,association.pin.invocationId);assert.equal(association.plan.worker.instanceId,association.realization.instanceId);
        const terminal=control.find(r=>r.owner==='COMPOSITION_CONTROL'&&r.event==='LOGICAL_TERMINAL_OBSERVED'&&r.details.plan.attemptId===association.plan.attemptId);assert.ok(terminal);
        assert.equal(terminal.details.snapshot.state,request.logicalOutcome.state);eq(terminal.details.m2,request.observedExecution);
        if(request.executionState==='SUCCEEDED'){
          const raw=owned.records.find(r=>r.event==='BOUND_REPORT_RETAINED'&&r.details.association.m2.coordinates.attemptId===association.m2.coordinates.attemptId);assert.ok(raw,'actual source result');
          eq(raw.details.association,association);const output=raw.details.report.output.values.float_values.map(Math.fround);
          const expected=input.values.values.map(x=>Math.fround(Math.fround(Math.fround(x)*Math.fround(input.scale))+Math.fround(input.bias)));
          eq(output,expected,'independent float32 computation oracle');assert.equal(Math.fround(request.score),output[0]);assert.equal(Math.fround(request.signal),output[1]);
          eq(request.signals.map(Math.fround),output.slice(1),'pure signals exclude RiskScore');
          assert.equal(request.decision,output[0]>=Math.fround(0.80)?'REJECT':output[0]>=Math.fround(0.55)?'REVIEW':'ALLOW','independent Java policy');
        }
      }
    }
    const [before,low,high,a,b,unknown,rolled]=receipt.requests;
    assert.equal(before.executionState,'FAILED_BEFORE_EXECUTION');assert.equal(low.decision,'ALLOW');assert.equal(high.decision,'REJECT');assert.equal(a.version,'v1');assert.equal(a.decision,'REVIEW');assert.equal(b.version,'v2');
    const cutover=read('cutover-state.json');assert.equal(cutover.activeVersion,'v2');assert.equal(cutover.requests.find(r=>r.id===a.id).executionState,'IN_FLIGHT');
    assert.ok(cutover.deployments.some(d=>d.version==='v1'&&d.state==='DRAINING'&&d.outstandingPins===1));
    assert.equal(unknown.executionState,'OUTCOME_UNKNOWN');assert.equal(unknown.wireCalled,true);
    const unknownState=read('unknown-state.json');eq(unknownState.requests.find(r=>r.id===unknown.id),unknown);assert.equal(unknownState.activeEligible,false);assert.equal(unknownState.eligibleWorkers,0);
    const crash=control.find(r=>r.owner==='HOST_PROCESS_OBSERVER'&&r.event==='RISK_CRASH_EXIT_OBSERVED'&&r.details.requestId===unknown.id);assert.ok(crash);assert.equal(crash.details.exitCode,43);assert.equal(crash.details.ownedProcess.alive,false);
    const rollback=read('rollback-state.json');assert.equal(rollback.activeVersion,'v1');assert.equal(rollback.deployments[2].purpose,'FRESH_ROLLBACK');
    assert.notEqual(rollback.deployments[0].realization.launchNonce,rollback.deployments[2].realization.launchNonce);assert.notEqual(rollback.deployments[0].realization.runtimeHandle.opaqueHandle,rollback.deployments[2].realization.runtimeHandle.opaqueHandle);
    assert.equal(rolled.version,'v1');assert.equal(rolled.decision,'REVIEW');
    const http=read('http-scenario.json');assert.ok(http.every(step=>step.httpStatus===200));
    assert.equal(http[0].operation.action,'invoke');assert.equal(http[0].response.executionState,'FAILED_BEFORE_EXECUTION');
    for(const step of http.filter(s=>s.operation.action==='install'))assert.notEqual(step.response.activeVersion,step.operation.version,'install never activates its candidate');
    assert.equal(receipt.allOwnedWorkersStopped,true);assert.ok(receipt.physicalShutdown.processes.every(p=>p.alive===false));
    const shutdown=read('independent-shutdown.json');assert.equal(shutdown.owner,'NODE_AFTER_JAVA_EXIT');assert.equal(shutdown.observations.length,6);assert.ok(shutdown.observations.every(p=>p.alive===false),'independent no-leaks');
  }catch(error){if(error.code==='ENOENT')missing.push(error.path);else failures.push(error.message);}
  return {verdict:failures.length?'FAIL':missing.length?'INCONCLUSIVE':'PASS',failures,missing,requests:requestCount,actualWorkers,scope:'private synthetic risk reference host; actual Control/Execution and Java policy separation',productizationQualified:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))){const result=verifyRiskHostEvidence(process.argv[2],{expectedSourceRevision:process.argv[3]});console.log(JSON.stringify(result));if(result.verdict!=='PASS')process.exitCode=1;}

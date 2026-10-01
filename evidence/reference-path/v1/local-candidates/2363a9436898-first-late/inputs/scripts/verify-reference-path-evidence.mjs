import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const same=(a,b,label)=>assert.deepEqual(a,b,label);
const cases=['lifecycle_journey','qualification_contract_mismatch','qualification_definition_mismatch','qualification_runtime_mismatch','qualification_environment_mismatch',
  'pin_worker_substitution','instance_changes_before_dispatch','deadline_before_dispatch','deadline_continuation','cancellation_continuation','late_after_replacement',
  'worker_crash','representative_failure','early_activation','false_cleanup','required_record_failure','duplicate_admission','snapshot_locator_mutation'];
const binding={runtimeIdentity:'numpy.cpu',runtimeVersion:'2.2.6',capabilityIdentity:'jpyxis.capability/affine-float32',capabilityVersion:'1'};
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
const canonical=v=>Buffer.from(JSON.stringify(sort(v)));
function oracle(input,output){
  assert.equal(output.values.dtype,'float32');assert.equal(output.values.layout,'ROW_MAJOR');same(output.values.shape,input.values.shape,'typed output shape');assert.equal(output.rows,input.values.shape[0]);
  same(output.values.values,input.values.values.map(v=>Math.fround(Math.fround(Math.fround(v)*Math.fround(input.scale))+Math.fround(input.bias))),'independent float32 affine oracle');
}
function wireOutput(report){return {values:{dtype:report.output.values.dtype==='DTYPE_FLOAT32'?'float32':'UNSUPPORTED',layout:report.output.values.layout==='LAYOUT_ROW_MAJOR'?'ROW_MAJOR':'UNSUPPORTED',shape:report.output.values.shape.map(Number),values:report.output.values.float_values},rows:Number(report.output.rows)};}
function reportCoordinates(report,association){
  const c=report.observed_coordinates,m=association.m2;
  for(const [key,wire] of Object.entries({contractIdentity:'contract_identity',definitionIdentity:'definition_identity',invocationId:'invocation_id',attemptId:'attempt_id',traceId:'trace_id'}))assert.equal(c[wire],m.coordinates[key],key);
  assert.equal(c.contract_digest,m.contractDigest);assert.equal(c.definition_digest,m.definitionDigest);
  for(const [key,wire] of Object.entries({runtimeIdentity:'runtime_identity',runtimeVersion:'runtime_version',capabilityIdentity:'runtime_capability_identity',capabilityVersion:'runtime_capability_version'}))assert.equal(c[wire],m.runtimeBinding[key],key);
  assert.equal(report.runtime_identity,binding.runtimeIdentity);assert.equal(report.runtime_version,binding.runtimeVersion);
}
export function verifyReferencePathEvidence(root,{expectedSourceRevision}={}){
  root=path.resolve(root);const failures=[],incomplete=[],results=[];
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
  const lines=name=>{const text=fs.readFileSync(path.join(root,name),'utf8');assert.ok(text.endsWith('\n'),`${name} complete final record`);return text.trimEnd().split(/\r?\n/).filter(Boolean).map(JSON.parse);};
  let manifest;try{manifest=read('manifest.json');}catch(e){return {verdict:'INCONCLUSIVE',cases:[],incomplete:[e.message],failures:[]};}
  for(const file of manifest.files??[]){
    const target=path.resolve(root,file.path);
    if(!target.startsWith(root+path.sep)){failures.push('retained file escaped bundle');continue;}
    try{const bytes=fs.readFileSync(target);if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)failures.push(`changed retained bytes: ${file.path}`);}catch{incomplete.push(`missing retained fact: ${file.path}`);}
  }
  if(failures.length||incomplete.length)return {verdict:failures.length?'FAIL':'INCONCLUSIVE',cases:[],failures,incomplete};
  try{
    assert.equal(manifest.schemaVersion,'jpyxis.io/reference-observations/v1alpha1');assert.equal(manifest.evidenceState,'OBSERVATIONS_RETAINED');
    const source=read('source.json'),inventory=read('input-inventory.json'),config=read('journey-config.json'),construction=read('construction-receipt.json');
    assert.equal(source.revision,expectedSourceRevision??manifest.sourceRevision);assert.equal(source.dirty,false);
    assert.equal(source.revision,inventory.sourceRevision);assert.equal(source.tree,inventory.sourceTree);
    const treeLines=execFileSync('git',['ls-tree','-r',source.revision],{encoding:'utf8'}).trim().split('\n');
    const gitBlobs=new Map(treeLines.map(line=>{const [meta,name]=line.split('\t');return [name,meta.split(' ')[2]];}));
    for(const f of inventory.files){
      assert.equal(gitBlobs.get(f.path),f.gitBlob,`input Git coordinate ${f.path}`);
      const bytes=fs.readFileSync(path.join(root,'inputs',f.path));assert.equal(sha(bytes),f.sha256);assert.equal(bytes.length,f.bytes);
      const blob=b=>crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
      if(blob(bytes)!==f.gitBlob){assert.match(f.path,/\.(?:java|py|xml|mjs|md)$/,'only declared text newline conversion permitted');assert.equal(blob(Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'))),f.gitBlob,'retained raw input does not match committed source');}
    }
    assert.equal(config.executionBuild.sourceRevision,source.revision);assert.equal(config.executionBuild.sourceTree,source.tree);
    assert.equal(config.executionBuild.inputInventoryDigest,sha(fs.readFileSync(path.join(root,'input-inventory.json'))));
    assert.equal(config.executionBuild.constructionReceiptDigest,sha(fs.readFileSync(path.join(root,'construction-receipt.json'))));
    assert.equal(construction.sourceRevision,source.revision);same(construction.launchEnvironment,config.launchEnvironment,'immutable launch environment');
    for(const command of construction.commands)assert.equal(command.exit.code,0,`construction command ${command.id}`);
    for(const [name,version] of Object.entries(config.environment.runtimePackages))assert.equal(construction.installedInventory[name],version,'installed package inventory');
    const entry=read('inputs/evidence/reference-path/v1/runtime-entry/entry-manifest.json');
    assert.equal(entry.state,'CONTRACT_FROZEN_BOUNDED_RUNTIME_ENTRY');assert.equal(entry.source.acceptedFreezeMain,'bd8cd9eff99f70f642c98571ed2390650320f222');
    assert.equal(gitBlobs.get('docs/spec/productization-reference-path-contract-v1.md'),entry.source.specBlob);assert.equal(gitBlobs.get('docs/adr/0014-reference-path-realization-and-dispatch.md'),entry.source.adrBlob);
    const resources=read('resource-observations.json');assert.ok(resources.samples.length>0,'actual resource samples missing');
    for(const sample of resources.samples){assert.ok(sample.knownRssBytes>0&&Number.isFinite(sample.availableMemoryBytes));assert.ok(sample.physicalMemoryBytes>=14*2**30&&sample.physicalMemoryBytes<=18*2**30,'actual 16 GiB host class');}
    if(source.publicClean){assert.equal(source.workflowSha,source.revision);assert.equal(source.cleanEnvironment.kind,'github-hosted-fresh-vm');assert.equal(source.cleanEnvironment.githubHosted,true);assert.equal(source.cleanEnvironment.pipCacheDisabled,true);assert.equal(source.cleanEnvironment.mavenRepositoryIsolated,true);}
    same(fs.readdirSync(path.join(root,'cases')).sort(),[...cases].sort(),'complete declared case set');
    const allPids=new Set();
    for(const id of cases){
      const base=`cases/${id}`,control=lines(`${base}/control-source.jsonl`),m4=read(`${base}/m4-events.json`),final=read(`${base}/final-state.json`);
      control.forEach((r,i)=>{assert.equal(r.sequence,i+1);assert.equal(r.schemaVersion,'jpyxis.io/reference-source/v1alpha1');if(r.event==='QUALIFICATION_DECIDED')assert.equal(r.owner,'COMPOSITION_CONTROL','worker self-qualification cannot own positive authority');});
      assert.ok(control.some(r=>r.event==='CASE_DRIVER_FINISHED'),'journey source incomplete');
      const ev=name=>control.filter(r=>r.event===name),starts=ev('ACTUAL_WORKER_STARTED'),expected=ev('CANDIDATE_EXPECTED_OPERANDS');
      const qualifications=new Map();const sourceAssociations=[];let actualRuntimeStarts=0;
      for(const start of starts){
        assert.equal(start.owner,'HOST_LAUNCH');const s=start.details;assert.ok(s.birth);assert.equal(s.descriptor.launchNonce,s.launchNonce);assert.equal(s.descriptor.instanceId,s.handle.instanceId);
        allPids.add(s.handle.processId);const index=path.basename(s.root),parent=path.basename(path.dirname(s.root));
        const launchBase=`${base}/${parent}/${index}`;
        const observed=read(`${launchBase}/worker-facts.json`),probe=read(`${launchBase}/independent-probe/worker-facts.json`),workers=lines(`${launchBase}/worker-source.jsonl`),m3=lines(`${launchBase}/m3-observations.jsonl`);
        assert.equal(observed.pid,s.handle.processId);assert.equal(observed.launchNonce,s.launchNonce);assert.notEqual(probe.pid,observed.pid);
        const operands=expected.find(r=>r.details.deploymentId===s.descriptor.deploymentId).details.operands;
        assert.equal(sha(Buffer.from(s.descriptor.definitionBytes,'base64')),observed.actual.definitionDigest,'actually prepared byte snapshot');
        assert.equal(sha(canonical(operands)),s.descriptor.operandsDigest);
        let matching=true;
        for(const facts of [observed.actual,probe.actual]){
          matching=matching&&facts.contractIdentity===operands.contractIdentity&&facts.contractDigest===operands.contractDigest&&facts.definitionIdentity===operands.definitionIdentity&&facts.definitionDigest===operands.definitionDigest&&
            JSON.stringify(sort(facts.environment))===JSON.stringify(sort(operands.environment))&&JSON.stringify(sort(facts.runtimeBinding))===JSON.stringify(sort(binding))&&
            JSON.stringify(sort(facts.definitionPlan))===JSON.stringify(sort({schemaVersion:'jpyxis.io/affine-definition-plan/v1alpha1',operationIdentity:'jpyxis.operation/affine-batch@1'}));
        }
        const q=ev('QUALIFICATION_DECIDED').find(r=>r.details.deploymentId===s.descriptor.deploymentId);
        const representative=ev('REPRESENTATIVE_RESULT_OBSERVED').find(r=>r.details.deploymentId===s.descriptor.deploymentId);
        let representativeCorrect=false;if(representative?.details.m2.state==='SUCCEEDED')try{oracle(config.representativeInput,representative.details.m2.rawWorkerReport.output);representativeCorrect=true;}catch{}
        // A replacement launch must not inherit the first instance's positive qualification.
        const isQualifiedInstance=q?.details.positive&&q.details.realization?.instanceId===s.handle.instanceId;
        if(isQualifiedInstance){assert.ok(matching&&representativeCorrect,'positive qualification lacks independent operand/oracle facts');qualifications.set(s.descriptor.deploymentId,q);}
        else if(q?.details.positive&&q.details.realization?.instanceId!==s.handle.instanceId)assert.ok(ev('INSTANCE_CHANGED_UNQUALIFIED').some(r=>r.details.currentWorker.instanceId===s.handle.instanceId&&r.details.inheritsQualification===false));
        else {assert.ok(q&&q.details.positive===false);assert.ok(!matching||!representativeCorrect,'negative qualification reason has no derived falsifier');}
        actualRuntimeStarts+=m3.filter(r=>r.event==='RUNTIME_STARTED').length;
        for(const worker of workers){assert.equal(worker.owner,'EXECUTION');assert.equal(worker.pid,s.handle.processId);
          if(worker.event==='OUTER_REQUEST_ADMITTED'||worker.event==='BOUND_REPORT_RETAINED'){
            const association=worker.details.association;
            const admission=control.find(r=>r.event===association.purpose+'_DISPATCH_ADMITTED'&&JSON.stringify(sort(r.details.association))===JSON.stringify(sort(association)));
            assert.ok(admission,'worker observation substituted the owner association');
            assert.equal(association.realization.launchNonce,s.launchNonce);assert.equal(association.realization.processId,s.handle.processId);
            same(association.operands,operands,'immutable operands');same(association.realization.runtimeBinding,binding,'actual provider binding');
            if(association.purpose==='PRODUCT'){
              const q=qualifications.get(association.realization.deploymentId);assert.ok(q&&q.sequence<admission.sequence,'product dispatch before owner qualification');
              same(association.realization,q.details.realization,'qualified realization changed');assert.equal(association.pin.deploymentId,s.descriptor.deploymentId);
              same(association.pin.artifact,operands.artifact);same(association.pin.runtimeHandle,association.realization.runtimeHandle);
              assert.equal(association.pin.invocationId,association.plan.logicalInvocationId);assert.equal(association.request.maximumAttempts,1);assert.equal(association.plan.idempotencyMode,'NONE');assert.equal(association.plan.deduplicationScope,'');
              for(const key of ['workerId','instanceId','controlEpoch','processId'])assert.equal(association.plan.worker[key],association.realization[key],`M5 worker ${key}`);
              const m2=association.m2;assert.equal(m2.contractDigest,operands.contractDigest);assert.equal(m2.definitionDigest,operands.definitionDigest);same(m2.runtimeBinding,binding);
              assert.ok(m3.some(r=>r.event==='RUNTIME_STARTED'&&r.invocationId===m2.coordinates.invocationId&&r.attemptId===m2.coordinates.attemptId&&r.traceId===m2.coordinates.traceId),'real M3 Runtime start missing');
            }
            if(worker.event==='BOUND_REPORT_RETAINED'){
              reportCoordinates(worker.details.report,association);
              const raw=Buffer.from(worker.details.associationBytesBase64,'base64');same(JSON.parse(raw),association,'retained outer metadata bytes');
              assert.ok(ev('WIRE_INVOKE_REQUESTED').some(r=>r.details.associationDigest===sha(raw)&&r.details.launchNonce===s.launchNonce),'transport metadata digest continuity');
              if(association.purpose==='PRODUCT')oracle({values:{shape:association.m2.input.values.shape,values:association.m2.input.values.values},scale:association.m2.input.scale,bias:association.m2.input.bias},wireOutput(worker.details.report));
            }
            sourceAssociations.push(worker);
          }
        }
      }
      for(const probe of ev('INDEPENDENT_INTERPRETER_STARTED')){allPids.add(probe.details.pid);assert.ok(ev('INDEPENDENT_INTERPRETER_EXITED').some(r=>r.details.pid===probe.details.pid&&r.details.exitCode===0&&r.details.alive===false));}
      for(const activation of ev('DEPLOYMENT_ACTIVATED').concat(ev('FRESH_ROLLBACK_ACTIVATED')))assert.ok(qualifications.has(activation.details.deploymentId),'activation without independent qualification');
      const product=ev('PRODUCT_DISPATCH_ADMITTED'),terminals=ev('LOGICAL_TERMINAL_OBSERVED'),late=ev('BOUND_LATE_OBSERVATION_RECORDED');
      const noWire=['pin_worker_substitution','instance_changes_before_dispatch','deadline_before_dispatch','required_record_failure'];
      if(noWire.includes(id)){assert.equal(product.length,0);assert.equal(terminals.at(-1).details.snapshot.state,'FAILED');assert.equal(terminals.at(-1).details.wireCalled,false);}
      if(['deadline_continuation','cancellation_continuation','late_after_replacement'].includes(id)){
        assert.equal(product.length,1);assert.equal(terminals.at(-1).details.snapshot.state,'OUTCOME_UNKNOWN');assert.equal(late.length,1);
        const continuation=ev('CONTINUATION_AFTER_CALLER_TERMINAL').at(-1);assert.equal(continuation.details.ownedProcess.alive,true);assert.equal(continuation.details.runtimeEntered.mode,'wait');
        assert.equal(late[0].details.snapshot.state,'OUTCOME_UNKNOWN');same(late[0].details.workerBefore,late[0].details.workerAfter,'late success poisoned replacement');
        assert.equal(late[0].details.lateSource.details.callerStillWaiting,false);assert.equal(late[0].details.lateSource.details.association.purpose,'PRODUCT');
      }
      if(id==='worker_crash'){assert.equal(product.length,1);assert.equal(terminals.at(-1).details.snapshot.state,'OUTCOME_UNKNOWN');const crash=ev('CRASH_EXIT_OBSERVED').at(-1);assert.equal(crash.details.exitCode,43);assert.equal(crash.details.alive,false);assert.ok(!sourceAssociations.some(r=>r.event==='BOUND_REPORT_RETAINED'&&r.details.association.purpose==='PRODUCT'));}
      if(id==='false_cleanup'){
        const rejected=ev('PHYSICAL_RELEASE_REJECTED').at(-1);assert.equal(rejected.details.cleanupKnowledge,'UNKNOWN');assert.equal(rejected.details.ownedProcess.alive,true);assert.equal(rejected.details.snapshot.state,'FAILED');
        assert.ok(ev('RELEASE_REPORTED').some(r=>r.details.reportedStopped===true));assert.equal(ev('SEPARATE_CONTAINMENT_OBSERVED').at(-1).details.alive,false);
        assert.ok(!m4.some(r=>r.event==='DEPLOYMENT_RETIRED'),'false release was rewritten as retirement');
      }
      if(id==='lifecycle_journey'){
        assert.equal(product.length,4);assert.ok(terminals.every(r=>r.details.snapshot.state==='SUCCEEDED'));
        assert.equal(product[0].details.association.pin.deploymentId,product[1].details.association.pin.deploymentId);assert.notEqual(product[1].details.association.pin.deploymentId,product[2].details.association.pin.deploymentId);
        same(product[0].details.association.pin.artifact,product[3].details.association.pin.artifact);assert.notEqual(product[0].details.association.realization.launchNonce,product[3].details.association.realization.launchNonce);
        assert.equal(ev('RETIRED_ALIAS_RESULT').at(-1).details.snapshot.state,'FAILED');assert.ok(m4.some(r=>r.event==='RUNTIME_HANDLE_REJECTED'||r.details?.code==='RUNTIME_HANDLE_IDENTITY_CONFLICT'),'M4 v2 canonical rejection witness missing');
      }
      if(id==='duplicate_admission'){assert.equal(product.length,1);assert.ok(ev('DISPATCH_REJECTED').length>0);assert.equal(terminals.at(-1).details.snapshot.state,'SUCCEEDED');}
      if(id==='snapshot_locator_mutation'){assert.equal(product.length,1);assert.equal(terminals.at(-1).details.snapshot.state,'SUCCEEDED');}
      if(id==='early_activation'){assert.equal(product.length,0);assert.equal(ev('ACTIVATION_REJECTED').length,1);}
      if(id.startsWith('qualification_')||id==='representative_failure'){assert.ok(ev('QUALIFICATION_DECIDED').some(r=>r.details.positive===false));assert.equal(ev('DEPLOYMENT_ACTIVATED').length,1);assert.equal(product.length,0);}
      assert.ok(final.processes.length>0);assert.ok(final.processes.every(p=>p.alive===false),'owned launch remains live');assert.equal(ev('ASSEMBLY_FINAL_PROCESSES').at(-1).details.allStopped,true);
      results.push({id,productDispatches:product.length,actualRuntimeStarts,derived:'PASS'});
    }
    const shutdown=read('independent-shutdown.json');assert.equal(shutdown.owner,'NODE_HOST_PROCESS_OBSERVER');same([...new Set(shutdown.recordedProcessIds)].sort((a,b)=>a-b),[...allPids].sort((a,b)=>a-b),'every actual launch and independent interpreter observed');
    assert.ok(shutdown.observations.length>0&&shutdown.observations.every(p=>p.alive===false),'independent physical no-leak observation failed');
  }catch(error){failures.push(error.message);}
  return {schemaVersion:'jpyxis.io/reference-independent-readback/v1alpha1',verdict:failures.length?'FAIL':incomplete.length?'INCONCLUSIVE':'PASS',cases:results,failures,incomplete,
    scope:'One trusted local CPU stateless typed reference path with actual M2/M3/M4/M5 continuity and owned-process observations; public clean and protected main qualification are separate retained gates',productizationQualified:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyReferencePathEvidence(process.argv[2],{expectedSourceRevision:process.argv[3]});console.log(JSON.stringify(result,null,2));if(result.verdict!=='PASS')process.exitCode=1;
}

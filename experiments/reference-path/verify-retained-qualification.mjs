import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {verifyReferencePathEvidence} from '../../scripts/verify-reference-path-evidence.mjs';
import {verifyM4Evidence} from '../../scripts/verify-m4-evidence.mjs';
import {verifyM4HandleEvidence} from '../../scripts/verify-m4-handle-evidence.mjs';
import {verifyM5Evidence} from '../../scripts/verify-m5-evidence.mjs';
import {verifyM5CoordinateEvidence} from '../../scripts/verify-m5-coordinate-evidence.mjs';
import {verifyM6Evidence} from '../../scripts/verify-m6-evidence.mjs';
const root='evidence/reference-path/v1/qualification',read=file=>JSON.parse(fs.readFileSync(file)),sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const manifest=read(`${root}/qualification-manifest.json`),retention=read(`${root}/retention.json`);
for(const file of retention.files){assert.ok(!file.path.includes('/')&&!file.path.includes('..'));const bytes=fs.readFileSync(`${root}/${file.path}`);assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);}
assert.equal(manifest.contract.freezeMain,'bd8cd9eff99f70f642c98571ed2390650320f222');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
assert.equal(git('rev-parse','HEAD:docs/spec/productization-reference-path-contract-v1.md'),manifest.contract.specBlob);assert.equal(git('rev-parse','HEAD:docs/adr/0014-reference-path-realization-and-dispatch.md'),manifest.contract.adrBlob);
const rules=read(`${root}/reference-ruleset-effective.json`);assert.equal(rules.enforcement,'active');assert.deepEqual(rules.bypass_actors,[]);
const required=rules.rules.find(r=>r.type==='required_status_checks').parameters;assert.equal(required.strict_required_status_checks_policy,true);
assert.deepEqual(required.required_status_checks.map(r=>r.context).sort(),['Verify M5 resilience repository','Verify M6 single-node baseline','Verify reference actual path'].sort());
const merged=read(`${root}/pr34-protected-merge.json`);assert.equal(merged.state,'MERGED');assert.equal(merged.headRefOid,manifest.implementation.reviewedHead);assert.equal(merged.mergeCommit.oid,manifest.implementation.acceptedMain);
const temporary=path.resolve('build',`reference-qualified-readback-${Date.now()}-${crypto.randomUUID()}`);const results=[];
for(const group of manifest.groups){
  const rawCommit=fs.readFileSync(`${root}/${group.sourceCommit}`),object=crypto.createHash('sha1').update(Buffer.from(`commit ${rawCommit.length}\0`)).update(rawCommit).digest('hex');assert.equal(object,group.executedSource);
  if(spawnSync('git',['cat-file','-e',`${group.executedSource}^{commit}`]).status!==0)assert.equal(execFileSync('git',['hash-object','-t','commit','-w','--stdin'],{input:rawCommit,encoding:'utf8'}).trim(),group.executedSource);
  assert.equal(git('rev-parse',`${group.executedSource}^{tree}`),group.executedTree);
  const ci=read(`${root}/${group.label}-ci.json`);assert.equal(ci.executedSha,group.executedSource);assert.equal(ci.run,group.run);assert.equal(ci.conclusion,'success');for(const name of required.required_status_checks.map(r=>r.context))assert.equal(ci.jobs.find(j=>j.name===name)?.conclusion,'success');
  assert.equal(ci.reviewedHead,group.reviewedHead);assert.equal(ci.event,group.label==='pr34'?'pull_request':'push');
  const dirs={};for(const [key,container] of Object.entries(group.containers)){
    dirs[key]=path.join(temporary,group.label,key);
    execFileSync(process.env.JPYXIS_PYTHON||(process.platform==='win32'?'python':'python3'),['experiments/reference-path/extract-verified-container.py',`${root}/${container.file}`,`${root}/${container.ledger}`,dirs[key]],{stdio:['ignore','pipe','pipe']});
  }
  const children=fs.readdirSync(dirs.reference).filter(n=>fs.existsSync(path.join(dirs.reference,n,'manifest.json')));assert.equal(children.length,1);const actualRoot=path.join(dirs.reference,children[0]);
  const actual=verifyReferencePathEvidence(actualRoot,{expectedSourceRevision:group.executedSource});assert.equal(actual.verdict,'PASS',JSON.stringify(actual));assert.equal(actual.cases.length,18);assert.equal(read(path.join(actualRoot,'source.json')).publicClean,true);
  const mutations=[];for(const [id,expected] of Object.entries({missing_worker_fact:'INCONCLUSIVE',rehashed_worker_substitution:'FAIL',rehashed_false_cleanup:'FAIL',self_declared_qualification:'FAIL',rehashed_binary_report:'FAIL'})){
    const result=verifyReferencePathEvidence(path.join(actualRoot,'mutations',id),{expectedSourceRevision:group.executedSource});assert.equal(result.verdict,expected);mutations.push({id,verdict:result.verdict});
  }
  const legacyM4=verifyM4Evidence(dirs.m4),m4=verifyM4HandleEvidence(path.join(dirs.m4,'handle-validation'),{expectedSourceRevision:group.executedSource,verifyMutations:true}),cleanM4=verifyM4HandleEvidence(path.join(dirs['m4-clean'],'handle-validation'),{expectedSourceRevision:group.executedSource,verifyMutations:true});
  const m5=verifyM5Evidence(dirs.m5),guardM5=verifyM5CoordinateEvidence(path.join(dirs.m5,'coordinate-validation'),{expectedSourceRevision:group.executedSource,verifyMutations:true}),m6=verifyM6Evidence(path.join(dirs.m6,'bundle'));
  for(const result of [legacyM4,m4,cleanM4,m5,guardM5,m6])assert.equal(result.verdict,'PASS');assert.equal(m4.results.length,28);assert.equal(cleanM4.results.length,28);assert.equal(guardM5.results.length,35);
  assert.equal(read(path.join(dirs.m4,'conformance-summary.json')).scenarioCount,11);assert.equal(read(path.join(dirs.m5,'coordinate-validation','manifest.json')).durableReplayFixtures.length,5);assert.equal(m4.mutationResults.length,3);assert.equal(cleanM4.mutationResults.length,3);assert.equal(guardM5.mutationResults.length,3);
  const summary=read(path.join(dirs.m6,'conformance-summary.json'));assert.equal(summary.sourceRevision,group.executedSource);assert.equal(summary.phaseCount,13);assert.equal(summary.mutations.length,8);assert.equal(summary.sixteenGiBDecision.result,'ACCEPT');
  for(const item of summary.mutations)assert.equal(verifyM6Evidence(path.join(dirs.m6,'mutations',item.id)).verdict,item.verdict);
  assert.equal(read(path.join(dirs.m6,'bundle','source.json')).revision,group.executedSource);
  results.push({label:group.label,source:group.executedSource,actualCases:18,mutations,m4:28,cleanM4:28,m5:35,m6Phases:13,m6Mutations:8,resources:'ACCEPT',allDerived:'PASS'});
}
assert.equal(manifest.groups[1].executedSource,manifest.implementation.acceptedMain);
console.log(JSON.stringify({verdict:'PASS',acceptedMain:manifest.implementation.acceptedMain,retainedFiles:retention.files.length,results,scope:'Independent retained qualification inputs; current publication gates and next-step authority remain separate'}));

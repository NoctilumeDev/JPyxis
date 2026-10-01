import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const revision=process.argv[2]??'HEAD',root='evidence/reference-path/v1';
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const read=name=>JSON.parse(fs.readFileSync(`${root}/${name}`,'utf8'));
const m=read('contract-manifest.json'),ledger=read('contract-retention.json');
const current=revision||git('write-tree');
assert.equal(m.evidenceState,'CONTRACT_CONTENT_QUALIFIED_FREEZE_RECORD_CANDIDATE');
assert.equal(m.productizationQualified,false);assert.equal(m.runtimeImplementationQualified,false);
assert.equal(m.source.acceptedTree,git('rev-parse',`${m.source.acceptedMain}^{tree}`));
for(const [file,blob] of Object.entries({
  'docs/spec/productization-reference-path-contract-v1.md':m.source.specBlob,
  'docs/adr/0014-reference-path-realization-and-dispatch.md':m.source.adrBlob})){
  assert.equal(git('rev-parse',`${m.source.acceptedMain}:${file}`),blob);
  assert.equal(git('rev-parse',`${current}:${file}`),blob);
}
assert.equal(git('merge-base',m.source.firstContentCandidate,m.source.reviewedHead),m.source.firstContentCandidate);
const batch=spawnSync('git',['cat-file','--batch'],{input:ledger.files.map(f=>`${revision}:${root}/${f.path}\n`).join(''),maxBuffer:8*1024*1024});
assert.equal(batch.status,0,batch.stderr.toString());let offset=0;
for(const file of ledger.files){
  const end=batch.stdout.indexOf(10,offset),parts=batch.stdout.subarray(offset,end).toString().split(' ');assert.equal(parts[1],'blob',file.path);
  const size=Number(parts[2]),bytes=batch.stdout.subarray(end+1,end+1+size);offset=end+size+2;
  assert.equal(bytes.length,file.bytes);assert.equal('sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  assert.deepEqual(fs.readFileSync(`${root}/${file.path}`),bytes);
}
for(const [label,source,evidence] of [['pr32',m.source.executedPrMerge,m.prEvidence],['main32',m.source.acceptedMain,m.mainEvidence]]){
  const c=read(`${label}-ci.json`),p=read(`${label}-readback.json`),g=read(`${label}-m4-readback.json`),e=read(`${label}-contract-entry-readback.json`),retention=read(`${label}-m4-qualification-readback.json`);
  assert.equal(c.run,evidence.run);assert.equal(c.executedSha,source);assert.equal(c.conclusion,'success');assert.deepEqual(c.artifacts,evidence.artifacts);
  for(const name of m.requiredChecks)assert.equal(c.jobs.find(j=>j.name===name)?.conclusion,'success');
  for(const result of [p.m5,p.m6,p.guard,g.legacy,g.guard,g.cleanGuard])assert.equal(result.verdict,'PASS');
  assert.equal(p.executedSource,source);assert.equal(g.executedSource,source);assert.equal(p.executedTree,git('rev-parse',`${source}^{tree}`));
  assert.equal(p.resourceDecision,'ACCEPT');assert.equal(p.shutdown.allRuntimeProcessesStopped,true);
  assert.equal(p.guard.results.length,35);assert.equal(g.guard.results.length,28);assert.equal(g.cleanGuard.results.length,28);
  assert.equal(e.verdict,'PASS');assert.equal(e.runtimeUnchanged,true);assert.equal(e.entryFiles,11);assert.equal(e.auditCases,13);
  assert.equal(retention.retainedFiles,473);assert.equal(retention.retainedGitBytes,'VERIFIED');
}
const entry=spawnSync('node',['experiments/reference-path/verify-contract-entry.mjs',revision],{encoding:'utf8'});assert.equal(entry.status,0,entry.stderr);
console.log(JSON.stringify({revision,verdict:'PASS',acceptedContentMain:m.source.acceptedMain,specBlob:m.source.specBlob,adrBlob:m.source.adrBlob,retainedContentFiles:ledger.files.length,normativeBlobsUnchanged:true,originalArchivesUnchanged:true,runtimeUnchanged:true,scope:'Independent content qualification and immutable separate freeze publication; runtime authority still requires this publication protected merge and exact-main readback'}));

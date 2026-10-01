import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const revision=process.argv[2]??'HEAD',root='evidence/reference-path/v1';
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const read=name=>JSON.parse(fs.readFileSync(`${root}/${name}`,'utf8'));
const entry=read('entry-manifest.json'),ledger=read('entry-retention.json');
const base='42005e30e999242518a7435189e26269888c6750';
assert.equal(entry.source.acceptedMain,base);assert.equal(entry.source.acceptedTree,git('rev-parse',`${base}^{tree}`));
assert.equal(entry.state,'AUDIT_A_QUALIFIED_MINIMUM_B_CONTENT_ENTRY');assert.equal(entry.contractQualified,false);assert.equal(entry.productizationQualified,false);
const batch=spawnSync('git',['cat-file','--batch'],{input:ledger.files.map(f=>`${revision}:${root}/${f.path}\n`).join(''),maxBuffer:4*1024*1024});
assert.equal(batch.status,0,batch.stderr.toString());let offset=0;
for(const file of ledger.files){
  const end=batch.stdout.indexOf(10,offset),parts=batch.stdout.subarray(offset,end).toString().split(' ');assert.equal(parts[1],'blob',file.path);
  const size=Number(parts[2]),bytes=batch.stdout.subarray(end+1,end+1+size);offset=end+size+2;
  assert.equal(bytes.length,file.bytes);assert.equal('sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.deepEqual(fs.readFileSync(`${root}/${file.path}`),bytes);
}
for(const label of ['pr31','main31']){
  const p=read(`${label}-readback.json`),g=read(`${label}-m4-readback.json`),a=read(`${label}-audit-readback.json`),retention=read(`${label}-m4-qualification-readback.json`);
  for(const r of [p.m5,p.m6,p.guard,g.legacy,g.guard,g.cleanGuard])assert.equal(r.verdict,'PASS');
  assert.equal(p.resourceDecision,'ACCEPT');assert.equal(p.shutdown.allRuntimeProcessesStopped,true);
  assert.equal(p.executedSource,label==='pr31'?entry.source.executedPrMerge:base);assert.equal(p.executedSource,g.executedSource);
  assert.equal(a.verdict,'PASS');assert.equal(a.m5Cases,10);assert.equal(a.m4Cases,3);assert.equal(a.retainedGitFiles,44);assert.equal(a.sourceFactFiles,28);
  assert.equal(retention.retainedFiles,473);assert.equal(retention.retainedGitBytes,'VERIFIED');
}
const current=revision||git('write-tree');
for(const archive of ['evidence/productization-audit','experiments/productization-audit','evidence/productization-audit-v2','experiments/productization-audit-v2','evidence/productization-audit-v3','experiments/productization-audit-v3','evidence/m4-handle-ownership-audit','experiments/m4-handle-ownership-audit','evidence/m4-handle-validation/v2/local-candidates','evidence/m4-handle-validation/v2/retained-main'])
  assert.equal(git('rev-parse',`${current}:${archive}`),git('rev-parse',`${base}:${archive}`));
for(const file of git('diff','--name-only',base,current).split('\n').filter(Boolean))
  assert.ok(file==='README.md'||file.startsWith('docs/')||file.startsWith('evidence/reference-path/')||file.startsWith('experiments/reference-path/'),`contract publication changed runtime/predecessor: ${file}`);
const audit=spawnSync('node',['experiments/productization-audit-v3/verify-retained-audit.mjs',current],{encoding:'utf8'});assert.equal(audit.status,0,audit.stderr);
console.log(JSON.stringify({revision,verdict:'PASS',entryFiles:ledger.files.length,auditCases:13,originalArchivesUnchanged:true,runtimeUnchanged:true,contractQualification:false,scope:'Independent qualified Audit A entry and contract-only publication readback'}));

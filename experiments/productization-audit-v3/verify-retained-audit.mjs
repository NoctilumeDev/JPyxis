import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {verifyAuditProbe} from './verify.mjs';
import {verifyRetiredHandleProbe} from './verify-retired-handle.mjs';
const revision=process.argv[2]??'HEAD',root='evidence/productization-audit-v3';
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const read=p=>JSON.parse(fs.readFileSync(`${root}/${p}`,'utf8'));
const entry=read('entry-manifest.json'),ledger=read('retention.json'),facts=read('source-facts.json');
assert.equal(entry.sourceBase,'a88d5988e8c9f4f56ccdafb167b5e9cc3a905dd7');
assert.equal(entry.sourceTree,git('rev-parse',`${entry.sourceBase}^{tree}`));
assert.equal(entry.state,'QUALIFIED_M4_M5_GUARDS_AUDIT_A_RERUN_ENTRY');
assert.equal(facts.sourceBase,entry.sourceBase);assert.equal(facts.sourceTree,entry.sourceTree);
for(const input of facts.files)assert.equal(input.gitBlob,git('rev-parse',`${entry.sourceBase}:${input.path}`));
const batch=spawnSync('git',['cat-file','--batch'],{input:ledger.files.map(file=>`${revision}:${root}/${file.path}\n`).join(''),maxBuffer:16*1024*1024});
assert.equal(batch.status,0,batch.stderr.toString());let offset=0;
for(const file of ledger.files){
  const end=batch.stdout.indexOf(10,offset);assert.ok(end>=offset);
  const header=batch.stdout.subarray(offset,end).toString().split(' ');assert.equal(header[1],'blob',file.path);
  const size=Number(header[2]),bytes=batch.stdout.subarray(end+1,end+1+size);offset=end+size+2;
  assert.equal(bytes.length,file.bytes,file.path);assert.equal('sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
  assert.deepEqual(fs.readFileSync(`${root}/${file.path}`),bytes,file.path);
}
const m5=verifyAuditProbe(path.resolve(root,'first-m5'),entry.sourceBase);
const m4=verifyRetiredHandleProbe(path.resolve(root,'first-m4'),entry.sourceBase);
assert.equal(m5.verdict,'PASS',JSON.stringify(m5));assert.equal(m4.verdict,'PASS',JSON.stringify(m4));
for(const label of ['pr30','main30']){
  const p=read(`entry-readbacks/${label}-readback.json`),g=read(`entry-readbacks/${label}-m4-readback.json`);
  for(const r of [p.m5,p.m6,p.guard,g.legacy,g.guard,g.cleanGuard])assert.equal(r.verdict,'PASS');
  assert.equal(p.resourceDecision,'ACCEPT');assert.equal(p.shutdown.allRuntimeProcessesStopped,true);
}
const archiveRevision=revision||git('write-tree');
for(const archive of ['evidence/productization-audit','experiments/productization-audit','evidence/productization-audit-v2','experiments/productization-audit-v2','evidence/m4-handle-ownership-audit','experiments/m4-handle-ownership-audit','evidence/m4-handle-validation/v2/local-candidates','evidence/m4-handle-validation/v2/local-retention.json','evidence/m4-handle-validation/v2/retained-main'])
  assert.equal(git('rev-parse',`${archiveRevision}:${archive}`),git('rev-parse',`${entry.sourceBase}:${archive}`));
console.log(JSON.stringify({revision,verdict:'PASS',retainedGitFiles:ledger.files.length,sourceFactFiles:facts.files.length,m5Cases:m5.results.length,m4Cases:m4.results.length,originalArchivesUnchanged:true,scope:'Bounded Audit A known guard rerun and exact-source composition finding; no real product path'}));

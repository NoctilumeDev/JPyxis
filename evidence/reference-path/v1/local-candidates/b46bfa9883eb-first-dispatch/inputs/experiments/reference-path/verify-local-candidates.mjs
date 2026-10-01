import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const root='evidence/reference-path/v1/local-candidates',results=[];
for(const name of fs.readdirSync(root).sort()){
  const base=`${root}/${name}`,retention=JSON.parse(fs.readFileSync(`${base}/retention.json`));
  const record=JSON.parse(fs.readFileSync(`${base}/failure-record.json`));
  assert.equal(JSON.parse(fs.readFileSync(`${base}/manifest.json`)).sourceRevision,record.candidate);
  execFileSync('git',['cat-file','-e',`${record.candidate}^{commit}`]);assert.equal(record.qualificationGranted,false);
  for(const file of retention.files){
    assert.ok(!file.path.includes('..')&&!file.path.startsWith('/'));const bytes=fs.readFileSync(`${base}/${file.path}`);
    assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);
    const blob=crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
    assert.equal(execFileSync('git',['rev-parse',`HEAD:${base}/${file.path}`],{encoding:'utf8'}).trim(),blob,'retained failure changed in committed source');
  }
  results.push({name,candidate:record.candidate,files:retention.files.length,classification:record.classification});
}
assert.ok(results.length>=3);console.log(JSON.stringify({verdict:'PASS',results},null,2));

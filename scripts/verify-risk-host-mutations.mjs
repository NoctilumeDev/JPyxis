import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRiskHostEvidence} from './verify-risk-host-evidence.mjs';
const sha=raw=>'sha256:'+crypto.createHash('sha256').update(raw).digest('hex');
const bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
export function verifyRiskHostMutations(directory,options,{replay=false}={}){
  const root=path.resolve(directory),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  const mutants=path.join(root,'mutations'),read=name=>JSON.parse(fs.readFileSync(path.join(root,name)));
  const worker=manifest.files.find(e=>e.path.endsWith('/worker-facts.json')&&!e.path.includes('/independent-probe/')).path;
  const source=manifest.files.find(e=>e.path.endsWith('/worker-source.jsonl')&&!e.path.includes('/independent-probe/')).path;
  const cases=[
    {id:'missing-owned-worker-facts',expected:'INCONCLUSIVE',remove:[worker],patches:{}},
    {id:'unknown-promoted-to-decision',expected:'FAIL',remove:[],patches:(()=>{
      const receipt=read('receipt.json'),unknown=receipt.requests.find(r=>r.executionState==='OUTCOME_UNKNOWN');unknown.decision='ALLOW';unknown.score=0.1;
      const control=fs.readFileSync(path.join(root,'control-source.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
      control.find(r=>r.owner==='JAVA_HOST_POLICY'&&r.details.id===unknown.id).details=unknown;
      const state=read('unknown-state.json');state.requests[state.requests.findIndex(r=>r.id===unknown.id)]=unknown;
      return {'receipt.json':bytes(receipt),'scenario-export.json':bytes(receipt),[`risk-requests/${unknown.id}.json`]:bytes(unknown),'unknown-state.json':bytes(state),'control-source.jsonl':Buffer.from(control.map(JSON.stringify).join('\n')+'\n')};
    })()},
    {id:'rehashed-worker-identity',expected:'FAIL',remove:[],patches:(()=>{const facts=read(worker);facts.actual.definitionIdentity='jpyxis:definition:unrelated@1.0.0';return {[worker]:bytes(facts)};})()},
    {id:'rehashed-live-physical-obligation',expected:'FAIL',remove:[],patches:(()=>{const stopped=read('independent-shutdown.json');stopped.observations[0].alive=true;return {'independent-shutdown.json':bytes(stopped)};})()},
    {id:'rehashed-wire-bytes',expected:'FAIL',remove:[],patches:(()=>{
      const records=fs.readFileSync(path.join(root,source),'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
      records.find(r=>r.event==='BOUND_REPORT_RETAINED').details.wireReportBase64=Buffer.from([0xff]).toString('base64');
      return {[source]:Buffer.from(records.map(JSON.stringify).join('\n')+'\n')};
    })()},
    {id:'rehashed-source-feature-substitution',expected:'FAIL',remove:[],patches:(()=>{
      const receipt=read('receipt.json'),r=receipt.requests.find(r=>r.executionState==='SUCCEEDED');r.features.normalizedExposure=0.91;
      const control=fs.readFileSync(path.join(root,'control-source.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
      control.find(x=>x.owner==='JAVA_HOST_POLICY'&&x.details.id===r.id).details=r;
      control.find(x=>x.owner==='JAVA_HOST'&&x.event==='RISK_REQUEST_PREPARED'&&x.details.requestId===r.id).details.features=r.features;
      return {'receipt.json':bytes(receipt),'scenario-export.json':bytes(receipt),[`risk-requests/${r.id}.json`]:bytes(r),'control-source.jsonl':Buffer.from(control.map(JSON.stringify).join('\n')+'\n')};
    })()}
  ];
  const outcomes=[];
  for(const mutation of cases){
    const overlay=path.join(mutants,mutation.id);
    if(!replay){
      fs.mkdirSync(overlay,{recursive:true});
      for(const [name,raw] of Object.entries(mutation.patches)){const file=path.join(overlay,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw,{flag:'wx'});}
      const revised=structuredClone(manifest);
      for(const entry of revised.files)if(mutation.patches[entry.path]){const raw=mutation.patches[entry.path];entry.bytes=raw.length;entry.sha256=sha(raw);}
      fs.writeFileSync(path.join(overlay,'manifest.json'),bytes(revised),{flag:'wx'});
      fs.writeFileSync(path.join(overlay,'mutation.json'),bytes({id:mutation.id,expected:mutation.expected,remove:mutation.remove,patches:Object.keys(mutation.patches),baseManifestSha256:sha(fs.readFileSync(path.join(root,'manifest.json')))}),{flag:'wx'});
    }
    const definition=JSON.parse(fs.readFileSync(path.join(overlay,'mutation.json')));
    assert.equal(definition.baseManifestSha256,sha(fs.readFileSync(path.join(root,'manifest.json'))));assert.equal(definition.expected,mutation.expected);
    const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'jpyxis-risk-mutant-'));
    try{
      for(const entry of manifest.files){
        if(definition.remove.includes(entry.path))continue;
        const target=path.join(temporary,entry.path);fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.copyFileSync(path.join(definition.patches.includes(entry.path)?overlay:root,entry.path),target);
      }
      fs.copyFileSync(path.join(overlay,'manifest.json'),path.join(temporary,'manifest.json'));
      const actual=verifyRiskHostEvidence(temporary,options);outcomes.push({id:definition.id,expected:definition.expected,actual});
      if(!replay)fs.writeFileSync(path.join(overlay,'observed-readback.json'),bytes(actual),{flag:'wx'});
    }finally{assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('jpyxis-risk-mutant-'));fs.rmSync(temporary,{recursive:true});}
  }
  return {verdict:outcomes.every(o=>o.actual.verdict===o.expected)?'PASS':'FAIL',mutations:outcomes};
}

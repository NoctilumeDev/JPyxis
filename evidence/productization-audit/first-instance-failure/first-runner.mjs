import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base='11e13099a9b81cf019844c8e4d1d1786ed913c53';
const output='build/coordinate-contract/first-instance-failure';
const probe='build/coordinate-contract/InstanceFailureProbe.java';
if(fs.existsSync(output)) throw new Error('Retain the first observation; output already exists');
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim()};
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const root='resilience/java/src/main/java/io/jpyxis/resilience';
const files=[...fs.readdirSync(root+'/api').filter(n=>n.endsWith('.java')).sort().map(n=>root+'/api/'+n),
 ...['WorkerSupervisor','ResilientInvocationManager'].map(n=>root+'/core/'+n+'.java'),
 ...['EventOwner','ResilienceJournal','ResilienceEvent','ResilienceEventDraft'].map(n=>root+'/evidence/'+n+'.java'),
 ...['WorkerControl','WorkerControlException'].map(n=>root+'/port/'+n+'.java')];
const sources=files.map(file=>{const blob=git('hash-object',file);if(blob!==git('rev-parse',`${base}:${file}`))throw new Error('Source differs: '+file);return {path:file,gitBlob:blob,sha256:sha(fs.readFileSync(file))}});
fs.mkdirSync(output,{recursive:true});
const classes=path.join(output,'classes');fs.mkdirSync(classes);
const compile=spawnSync('javac',['--release','17','-d',classes,...files,probe]);
fs.writeFileSync(path.join(output,'compile.stdout.bin'),compile.stdout??Buffer.alloc(0));
fs.writeFileSync(path.join(output,'compile.stderr.bin'),compile.stderr??Buffer.alloc(0));
const receipt={schemaVersion:'jpyxis.io/instance-failure-audit/v1alpha1',sourceBase:base,sourceTree:git('rev-parse',`${base}^{tree}`),checkoutHead:git('rev-parse','HEAD'),
 sources,probeSource:{path:probe,sha256:sha(fs.readFileSync(probe))},harnessSource:{path:'build/coordinate-contract/run-instance-probe.mjs',sha256:sha(fs.readFileSync('build/coordinate-contract/run-instance-probe.mjs'))},
 java:spawnSync('java',['-version'],{encoding:'utf8'}).stderr.trim(),startedAt:new Date().toISOString(),compileExit:compile.status,runs:[],scope:'public model only; no real worker, compute, durability or production claim'};
if(compile.status===0) for(const testCase of ['same_instance_failure_control','replacement_success_control','replacement_instance_failure']){
 const r=spawnSync('java',['-cp',classes,'InstanceFailureProbe',testCase]);
 fs.writeFileSync(path.join(output,testCase+'.stdout.bin'),r.stdout??Buffer.alloc(0));fs.writeFileSync(path.join(output,testCase+'.stderr.bin'),r.stderr??Buffer.alloc(0));
 let observed;try{observed=JSON.parse(r.stdout.toString('utf8'))}catch{observed={probeFailure:true}}
 receipt.runs.push({case:testCase,exitCode:r.status,stdoutSha256:sha(r.stdout??''),stderrSha256:sha(r.stderr??''),observed});
 console.log(JSON.stringify({case:testCase,exitCode:r.status,before:observed.beforeState,after:observed.afterState,unexpected:observed.unexpectedReplacementMutation}));
}
receipt.completedAt=new Date().toISOString();
receipt.auditDecision=compile.status!==0||receipt.runs.some(r=>r.observed.probeFailure||r.exitCode===3)?'PROBE_INVALID':receipt.runs.some(r=>r.observed.unexpectedReplacementMutation)?'STOP_MODEL_COUNTEREXAMPLE':'NO_COUNTEREXAMPLE_OBSERVED';
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({auditDecision:receipt.auditDecision,receiptSha256:sha(fs.readFileSync(path.join(output,'receipt.json')))}));
process.exit(receipt.auditDecision==='NO_COUNTEREXAMPLE_OBSERVED'?0:2);

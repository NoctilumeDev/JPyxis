import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {verifyReferencePathEvidence} from './verify-reference-path-evidence.mjs';
const project=process.cwd(),git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
assert.equal(git('status','--porcelain'),'','first complete candidate must be committed before execution');
const publicClean=process.argv.includes('--public-clean');
const runRoot=path.join(project,'build','reference-path',`${source.slice(0,12)}-${Date.now()}`);
fs.mkdirSync(runRoot,{recursive:true});fs.mkdirSync(path.join(runRoot,'logs'));
const write=(name,value)=>{const target=path.join(runRoot,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n');};
const read=name=>JSON.parse(fs.readFileSync(path.join(runRoot,name),'utf8'));
const sha=bytes=>'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=v=>Buffer.from(JSON.stringify(sort(v)));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
const commands=[],resources=[];let failure;
const basePython=process.env.JPYXIS_PYTHON||(process.platform==='win32'?'python':'python3');
const venv=path.join(runRoot,'environment'),python=path.join(venv,process.platform==='win32'?'Scripts/python.exe':'bin/python');
const generated=path.join(runRoot,'generated');fs.mkdirSync(generated);
const isolated={...process.env,PIP_NO_CACHE_DIR:'1',PIP_DISABLE_PIP_VERSION_CHECK:'1',PYTHONDONTWRITEBYTECODE:'1',
  MAVEN_USER_HOME:path.join(runRoot,'maven-user-home'),MAVEN_OPTS:[process.env.MAVEN_OPTS,`-Dmaven.repo.local=${path.join(runRoot,'maven-repository')}`].filter(Boolean).join(' ')};
async function command(id,exe,args,env=isolated,observe=false){
  console.log(`reference phase: ${id}`);const started=Date.now();
  const out=fs.openSync(path.join(runRoot,'logs',`${id}.stdout.bin`),'w'),err=fs.openSync(path.join(runRoot,'logs',`${id}.stderr.bin`),'w');
  const child=spawn(exe,args,{cwd:project,env,stdio:['ignore',out,err]});
  let timer;if(observe)timer=setInterval(()=>sample(child.pid),1000);
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>{clearInterval(timer);fs.closeSync(out);fs.closeSync(err);});
  commands.push({id,executable:exe,args,startedAt:new Date(started).toISOString(),endedAt:new Date().toISOString(),durationMs:Date.now()-started,exit});
  write('command-observations.json',commands);assert.equal(exit.code,0,`${id} failed; original logs retained at ${runRoot}`);
}
function walk(root){if(!fs.existsSync(root))return[];return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(root,e.name)):[path.join(root,e.name)]);}
function ownedProcessIds(){
  const pids=new Set();for(const file of walk(path.join(runRoot,'cases')).filter(p=>p.endsWith('control-source.jsonl'))){
    const lines=fs.readFileSync(file,'utf8').split('\n');lines.pop();for(const line of lines)try{
      const r=JSON.parse(line);if(r.owner==='HOST_LAUNCH'&&r.event==='ACTUAL_WORKER_STARTED')pids.add(r.details.handle.processId);
      if(r.owner==='HOST_LAUNCH'&&r.event==='INDEPENDENT_INTERPRETER_STARTED')pids.add(r.details.pid);
    }catch{}
  }return[...pids];
}
function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
function sample(javaPid){
  const ids=[javaPid,...ownedProcessIds()].filter(p=>Number.isSafeInteger(p)&&p>0&&alive(p));let resident=[],sampler=null;
  if(ids.length){
    if(process.platform==='win32'){
      const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-Process -Id @(${ids.join(',')}) -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64 | ConvertTo-Json -Compress`],{encoding:'utf8'});
      sampler={exitCode:r.status,stdoutBase64:Buffer.from(r.stdout).toString('base64'),stderrBase64:Buffer.from(r.stderr).toString('base64')};
      if(r.stdout.trim())try{resident=[JSON.parse(r.stdout)].flat().map(p=>({pid:p.Id,rssBytes:p.WorkingSet64}));}catch(error){sampler.parseFailure=error.message;}
    }else{
      const r=spawnSync('ps',['-o','pid=,rss=,stat=','-p',ids.join(',')],{encoding:'utf8'});
      sampler={exitCode:r.status,stdoutBase64:Buffer.from(r.stdout).toString('base64'),stderrBase64:Buffer.from(r.stderr).toString('base64')};
      resident=r.stdout.trim().split('\n').filter(Boolean).map(line=>{const [pid,rss,state]=line.trim().split(/\s+/);return {pid:Number(pid),rssBytes:Number(rss)*1024,psProcessState:state};});
    }
  }
  resources.push({observedAt:new Date().toISOString(),method:process.platform==='win32'?'Get-Process.WorkingSet64':'ps resident KiB',javaPid,ownedLiveProcessIds:ids,
    resident,sampler,residentCoverage:resident.length?'OBSERVED_RESIDENT_PROCESSES':'NO_RESIDENT_SAMPLE',knownRssBytes:resident.reduce((sum,p)=>sum+p.rssBytes,0),physicalMemoryBytes:os.totalmem(),availableMemoryBytes:os.freemem()});
  write('resource-observations.json',{samples:resources,scope:'sampled reference Java parent and host-owned worker/interpreter processes; sampling is not a capacity or performance promise'});
}
try{
  await command('preserved_first_failures','node',['experiments/reference-path/verify-local-candidates.mjs']);
  const entries=git('ls-tree','-r',source).split('\n').map(line=>{const [meta,name]=line.split('\t');return {name,blob:meta.split(' ')[2]};}).filter(e=>
    /^(?:reference\/|bindings\/(?:java\/src\/main\/|python\/)|invocation\/(?:java\/src\/main\/|python\/(?:jpyxis_worker\/|requirements))|lifecycle\/java\/src\/main\/|resilience\/java\/src\/main\/|spec\/(?:m1\/contracts\/|m2\/proto\/|m3\/definitions\/|reference\/)|scripts\/verify-reference|experiments\/reference-path\/|evidence\/reference-path\/v1\/runtime-entry\/|docs\/spec\/productization-reference-path-contract-v1\.md|docs\/adr\/0014-)/.test(e.name)||e.name==='pom.xml'||/^(?:bindings|invocation|lifecycle|resilience)\/java\/pom.xml$/.test(e.name));
  const inputs=entries.map(e=>{const bytes=fs.readFileSync(e.name);const target=path.join(runRoot,'inputs',e.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);return {path:e.name,gitBlob:e.blob,bytes:bytes.length,sha256:sha(bytes)};});
  write('input-inventory.json',{sourceRevision:source,sourceTree:tree,files:inputs});
  write('source.json',{revision:source,tree,dirty:false,publicClean,workflowSha:process.env.GITHUB_SHA||null,
    cleanEnvironment:publicClean?{kind:'github-hosted-fresh-vm',githubHosted:process.env.GITHUB_ACTIONS==='true',runnerImage:process.env.ImageOS||null,pipCacheDisabled:true,mavenRepositoryIsolated:true}:{kind:'local-candidate'},
    host:{platform:process.platform,architecture:os.arch(),physicalMemoryBytes:os.totalmem(),logicalCpuCount:os.cpus().length}});
  assert.ok(!publicClean||process.env.GITHUB_ACTIONS==='true','local process cannot grant public clean qualification');
  await command('selected_interpreter',basePython,['--version']);
  await command('retained_observation_containers',basePython,['experiments/reference-path/verify-retained-containers.py']);
  if(fs.existsSync('evidence/reference-path/v1/qualification/qualification-manifest.json'))await command('retained_qualification_inputs','node',['experiments/reference-path/verify-retained-qualification.mjs']);
  assert.match(fs.readFileSync(path.join(runRoot,'logs/selected_interpreter.stdout.bin'),'utf8')+fs.readFileSync(path.join(runRoot,'logs/selected_interpreter.stderr.bin'),'utf8'),/Python 3\.12\./);
  await command('selected_interpreter_metadata',basePython,['-S','-c','import sys,json; print(json.dumps({"executable":sys.executable,"nativeExecutable":sys._base_executable,"version":".".join(map(str,sys.version_info[:3]))}))']);
  const interpreter=JSON.parse(fs.readFileSync(path.join(runRoot,'logs/selected_interpreter_metadata.stdout.bin'),'utf8'));
  const workerExecutable=path.resolve(interpreter.nativeExecutable);
  await command('construct_environment',basePython,['-m','venv',venv]);
  await command('install_pinned_inputs',python,['-m','pip','install','--no-cache-dir','--disable-pip-version-check','-r',path.join(project,'invocation/python/requirements-m3.txt')]);
  await command('check_installation',python,['-m','pip','check']);
  await command('installed_inventory',python,['-c','import importlib.metadata,json; print(json.dumps({d.metadata["Name"]:d.version for d in importlib.metadata.distributions()},sort_keys=True))']);
  await command('generate_frozen_carrier',python,['-m','grpc_tools.protoc','-I',path.join(project,'spec/m2/proto'),`--python_out=${generated}`,`--grpc_python_out=${generated}`,path.join(project,'spec/m2/proto/jpyxis_invocation_v1.proto')]);
  if(process.platform==='win32')await command('build_reference',process.env.ComSpec||'cmd.exe',['/d','/s','/c','mvnw.cmd -q -pl reference/java -am package']);
  else await command('build_reference','sh',[path.join(project,'mvnw'),'-q','-pl','reference/java','-am','package']);
  const requirements=Object.fromEntries(['invocation/python/requirements-m2.txt','invocation/python/requirements-m3.txt'].map(name=>[name,fs.readFileSync(name)]));
  const closure=Object.fromEntries(Object.entries(requirements).map(([name,bytes])=>[name,sha(bytes)]));
  const environment={schemaVersion:'jpyxis.io/reference-environment/v1alpha1',pythonImplementation:'CPython',pythonMajorMinor:'3.12',
    platform:process.platform,architecture:process.platform==='win32'?'AMD64':'x86_64',requirementsClosureDigest:sha(canonical(closure)),runtimePackages:{numpy:'2.2.6',grpcio:'1.83.1',protobuf:'7.35.1'}};
  const packageDirectory=path.join(venv,process.platform==='win32'?'Lib/site-packages':'lib/python3.12/site-packages');
  const launchEnvironment={PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1',PYTHONHASHSEED:'0',
    PYTHONPATH:[packageDirectory,path.join(project,'bindings/python'),path.join(project,'invocation/python'),generated,path.join(project,'reference/python')].join(path.delimiter),
    PATH:process.platform==='win32'?[path.dirname(python),path.join(process.env.SystemRoot||'C:\\Windows','System32')].join(path.delimiter):'/usr/bin:/bin'};
  if(process.platform==='win32')Object.assign(launchEnvironment,{SystemRoot:process.env.SystemRoot||'C:\\Windows',TEMP:path.join(runRoot,'temporary'),TMP:path.join(runRoot,'temporary')});
  fs.mkdirSync(path.join(runRoot,'temporary'));
  const jar=path.join(project,'reference/java/target/jpyxis-reference-java.jar');
  const receipt={schemaVersion:'jpyxis.io/reference-construction/v1alpha1',sourceRevision:source,sourceTree:tree,
    selectedInterpreter:basePython,interpreter,installExecutable:python,workerExecutable,workerExecutableSha256:sha(fs.readFileSync(workerExecutable)),launchFlags:['-S'],packageDirectory,requirementsClosure:closure,commands:[...commands],
    installedInventory:JSON.parse(fs.readFileSync(path.join(runRoot,'logs/installed_inventory.stdout.bin'),'utf8')),
    launchEnvironment,javaArtifact:{path:jar,sha256:sha(fs.readFileSync(jar))},inputInventoryDigest:sha(fs.readFileSync(path.join(runRoot,'input-inventory.json')))};
  write('construction-receipt.json',receipt);
  const definitions={v1:{identity:'jpyxis:definition:example/affine-batch-plan@1.0.0',bytes:fs.readFileSync('spec/m3/definitions/example_affine_plan_v1.py').toString('base64')},
    v2:{identity:'jpyxis:definition:example/affine-batch-plan@2.0.0',bytes:fs.readFileSync('spec/reference/definitions/example_affine_plan_v2.py').toString('base64')}};
  write('journey-config.json',{evidenceRoot:runRoot,pythonExecutable:workerExecutable,pythonFlags:['-S'],packageDirectory,interpreterVersion:interpreter.version,workerScript:path.join(project,'reference/python/reference_worker.py'),launchEnvironment,environment,definitions,
    requirementsBytes:Object.fromEntries(Object.entries(requirements).map(([name,bytes])=>[name,bytes.toString('base64')])),
    contractBytes:fs.readFileSync('spec/m1/contracts/example.affine-batch.v1.json').toString('base64'),representativeInput:JSON.parse(fs.readFileSync('spec/m2/cases/success_exact.json','utf8')),
    executionBuild:{sourceRevision:source,sourceTree:tree,inputInventoryDigest:receipt.inputInventoryDigest,constructionReceiptDigest:sha(fs.readFileSync(path.join(runRoot,'construction-receipt.json')))}});
  await command('actual_journey','java',['-jar',jar,path.join(runRoot,'journey-config.json')],isolated,true);
}catch(error){failure=error;write('first-failure.json',{phase:commands.at(-1)?.id||'bootstrap',message:error.message,sourceRevision:source,classification:'unclassified actual candidate failure; no qualification granted'});}
finally{
  const pids=ownedProcessIds();write('independent-shutdown.json',{owner:'NODE_HOST_PROCESS_OBSERVER',observedAt:new Date().toISOString(),method:'OS process existence after Java journey exit',recordedProcessIds:pids,observations:pids.map(pid=>({pid,alive:alive(pid)}))});
  const files=walk(runRoot).filter(file=>!file.includes(`${path.sep}environment${path.sep}`)&&!file.includes(`${path.sep}maven-repository${path.sep}`)&&!file.includes(`${path.sep}maven-user-home${path.sep}`)&&!file.endsWith(`${path.sep}manifest.json`));
  write('manifest.json',{schemaVersion:'jpyxis.io/reference-observations/v1alpha1',evidenceState:'OBSERVATIONS_RETAINED',sourceRevision:source,files:files.map(file=>{const bytes=fs.readFileSync(file);return {path:path.relative(runRoot,file).split(path.sep).join('/'),bytes:bytes.length,sha256:sha(bytes)};})});
  fs.writeFileSync(path.join(project,'build/reference-path/latest.json'),JSON.stringify({root:runRoot,sourceRevision:source})+'\n');
}
if(failure){console.error(failure.message);process.exitCode=1;}
else{
  const result=verifyReferencePathEvidence(runRoot,{expectedSourceRevision:source});write('independent-readback.json',result);
  if(result.verdict!=='PASS'){
    write('reader-first-failure.json',{sourceRevision:source,stage:'independent-actual-reader',result});console.error(JSON.stringify({root:runRoot,verdict:result.verdict,failures:result.failures}));process.exitCode=1;
  }else{
    const mutationResults=[];
    for(const id of ['missing_worker_fact','rehashed_worker_substitution','rehashed_false_cleanup','self_declared_qualification','rehashed_binary_report']){
      const mutant=path.join(runRoot,'mutations',id),original=read('manifest.json');fs.mkdirSync(mutant,{recursive:true});
      for(const file of original.files){const target=path.join(mutant,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(runRoot,file.path),target);}
      let target;
      if(id==='missing_worker_fact'){
        target=original.files.find(f=>f.path.endsWith('launch-0/worker-facts.json')&&f.path.startsWith('cases/lifecycle_journey/')).path;fs.unlinkSync(path.join(mutant,target));
      }else if(id==='rehashed_worker_substitution'){
        target=original.files.find(f=>f.path.endsWith('launch-0/worker-source.jsonl')&&f.path.startsWith('cases/lifecycle_journey/')).path;
        const lines=fs.readFileSync(path.join(mutant,target),'utf8').trimEnd().split(/\r?\n/).map(JSON.parse);
        const report=lines.find(r=>r.event==='BOUND_REPORT_RETAINED'&&r.details.association.purpose==='PRODUCT');report.details.association.realization.instanceId='foreign-real-instance';
        fs.writeFileSync(path.join(mutant,target),lines.map(r=>JSON.stringify(r)).join('\n')+'\n');
      }else if(id==='rehashed_false_cleanup'){
        target='independent-shutdown.json';const record=JSON.parse(fs.readFileSync(path.join(mutant,target),'utf8'));record.observations[0].alive=true;fs.writeFileSync(path.join(mutant,target),JSON.stringify(record)+'\n');
      }else if(id==='rehashed_binary_report'){
        target=original.files.find(f=>f.path.endsWith('launch-0/worker-source.jsonl')&&f.path.startsWith('cases/lifecycle_journey/')).path;
        const lines=fs.readFileSync(path.join(mutant,target),'utf8').trimEnd().split(/\r?\n/).map(JSON.parse);
        const report=lines.find(r=>r.event==='BOUND_REPORT_RETAINED'&&r.details.association.purpose==='PRODUCT'),bytes=Buffer.from(report.details.wireReportBase64,'base64');
        bytes[bytes.length-1]^=1;report.details.wireReportBase64=bytes.toString('base64');fs.writeFileSync(path.join(mutant,target),lines.map(r=>JSON.stringify(r)).join('\n')+'\n');
      }else{
        target='cases/lifecycle_journey/control-source.jsonl';const lines=fs.readFileSync(path.join(mutant,target),'utf8').trimEnd().split(/\r?\n/).map(JSON.parse);
        lines.find(r=>r.event==='QUALIFICATION_DECIDED'&&r.details.positive).owner='EXECUTION';fs.writeFileSync(path.join(mutant,target),lines.map(r=>JSON.stringify(r)).join('\n')+'\n');
      }
      if(id!=='missing_worker_fact'){const bytes=fs.readFileSync(path.join(mutant,target)),entry=original.files.find(f=>f.path===target);entry.bytes=bytes.length;entry.sha256=sha(bytes);}
      fs.writeFileSync(path.join(mutant,'manifest.json'),JSON.stringify(original,null,2)+'\n');
      const observed=verifyReferencePathEvidence(mutant,{expectedSourceRevision:source}),expected=id==='missing_worker_fact'?'INCONCLUSIVE':'FAIL';
      fs.writeFileSync(path.join(mutant,'independent-readback.json'),JSON.stringify(observed,null,2)+'\n');
      mutationResults.push({id,verdict:observed.verdict,expected});assert.equal(observed.verdict,expected,`${id}: original mutated evidence retained`);
    }
    write('mutations-summary.json',{results:mutationResults,sourceRevision:source});console.log(JSON.stringify({root:runRoot,verdict:result.verdict,cases:result.cases.length,mutations:mutationResults}));
  }
}

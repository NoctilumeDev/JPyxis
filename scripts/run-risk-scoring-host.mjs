import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {verifyRiskHostEvidence} from './verify-risk-host-evidence.mjs';
import {verifyRiskHostMutations} from './verify-risk-host-mutations.mjs';
const project=process.cwd(),git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const revision=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
assert.equal(git('status','--porcelain'),'','Commit the complete candidate before running the source-bound host');
const scenario=process.argv.includes('--scenario'),publicClean=process.argv.includes('--public-clean');
assert.ok(!publicClean||(scenario&&process.env.GITHUB_ACTIONS==='true'),'A local run cannot grant fresh-VM qualification');
const root=path.join(project,'build/risk',`${revision.slice(0,8)}-${Date.now().toString(36)}`);
fs.mkdirSync(path.join(root,'logs'),{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
const sha=raw=>'sha256:'+crypto.createHash('sha256').update(raw).digest('hex');
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=v=>Buffer.from(JSON.stringify(sort(v)));
const commands=[],pythonBase=process.env.JPYXIS_PYTHON||(process.platform==='win32'?'python':'python3');
const venv=path.join(root,'e'),python=path.join(venv,process.platform==='win32'?'Scripts/python.exe':'bin/python'),generated=path.join(root,'generated');
fs.mkdirSync(generated);fs.mkdirSync(path.join(root,'temporary'));
assert.ok(!publicClean||!process.env.JPYXIS_LOCAL_MAVEN_REPO,'Public proof requires a fresh private Maven repository');
const mavenRepository=process.env.JPYXIS_LOCAL_MAVEN_REPO||path.join(root,'maven-repository');
const env={...process.env,PIP_NO_CACHE_DIR:'1',PIP_DISABLE_PIP_VERSION_CHECK:'1',PYTHONDONTWRITEBYTECODE:'1',MAVEN_USER_HOME:path.join(root,'maven-user-home'),MAVEN_OPTS:[process.env.MAVEN_OPTS,`-Dmaven.repo.local=${mavenRepository}`].filter(Boolean).join(' ')};
let failed;
async function stopLiveHost(){
  try{
    const {url}=JSON.parse(fs.readFileSync(path.join(root,'server.json')));
    const {token}=await (await fetch(url+'/api/session')).json();
    const action=async body=>{const reply=await fetch(url+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Reference-Token':token},body:JSON.stringify(body)});assert.ok(reply.ok,`Shutdown operation ${body.action} rejected`);return reply.json();};
    const deadline=Date.now()+30000;
    for(;;){
      const state=await (await fetch(url+'/api/state')).json();
      if(state.closed)break;
      for(const request of state.requests.filter(r=>r.canRelease))await action({action:'release',requestId:request.id});
      if(state.canClose){await action({action:'close'});break;}
      assert.ok(Date.now()<deadline,'Finish the pending operation and close owned workers in the UI');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    write('live-shutdown.json',{owner:'BOOTSTRAP_HTTP_SHUTDOWN',physicalState:await (await fetch(url+'/api/state')).json()});
    await action({action:'stop'});
  }catch(error){console.error(`Host remains owned; automatic shutdown could not finish: ${error.message}. Use the UI to close, then stop the host.`);}
}
async function run(id,executable,args,live=false){
  console.log(`Risk host: ${id}`);
  const stdout=fs.openSync(path.join(root,'logs',`${id}.stdout.bin`),'w'),stderr=fs.openSync(path.join(root,'logs',`${id}.stderr.bin`),'w');
  const start=Date.now(),child=spawn(executable,args,{cwd:project,env,stdio:['ignore',stdout,stderr]});
  if(live){const timer=setInterval(()=>{const file=path.join(root,'server.json');if(fs.existsSync(file)){clearInterval(timer);console.log(`Open ${JSON.parse(fs.readFileSync(file)).url}`);console.log('Close owned workers and export the sealed receipt before stopping the host.');}},200);
    child.on('exit',()=>clearInterval(timer));process.once('SIGINT',stopLiveHost);process.once('SIGTERM',stopLiveHost);
  }
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>{fs.closeSync(stdout);fs.closeSync(stderr);});
  commands.push({id,executable,args,startedAt:new Date(start).toISOString(),durationMs:Date.now()-start,exit});write('commands.json',commands);
  if(!live)assert.equal(exit.code,0,`${id} failed; original logs retained at ${root}`);
}
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]):[];
try{
  write('source.json',{revision,tree,dirty:false,publicClean,localMavenReuse:!!process.env.JPYXIS_LOCAL_MAVEN_REPO,scope:'private risk reference host',hostPlatform:process.platform,ci:publicClean?{provider:'github-actions',runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,sourceRevision:process.env.GITHUB_SHA,runnerImage:process.env.ImageOS,runnerImageVersion:process.env.ImageVersion,pipCache:false,mavenCache:false}:null});
  const inputFiles=git('ls-tree','-r','--name-only',revision).split('\n').filter(name=>/^(reference-apps\/versioned-risk-scoring\/|reference\/|bindings\/(java\/src\/main|python\/)|invocation\/(java\/src\/main|python\/)|lifecycle\/java\/src\/main|resilience\/java\/src\/main|spec\/(m1\/contracts|m2\/(proto|cases))|scripts\/(run-risk-scoring-host|verify-risk-host|verify-reference-wire))/.test(name)||name==='pom.xml'||name==='.github/workflows/repository-gates.yml'||/\/java\/pom.xml$/.test(name));
  const inventory=[];
  for(const name of inputFiles){const raw=fs.readFileSync(name),dest=path.join(root,'inputs',name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,raw);inventory.push({path:name,gitBlob:git('rev-parse',`${revision}:${name}`),bytes:raw.length,sha256:sha(raw)});}
  write('input-inventory.json',{revision,tree,files:inventory});
  await run('interpreter',pythonBase,['-S','-c','import sys,platform,json; print(json.dumps({"executable":sys._base_executable,"version":platform.python_version(),"platform":sys.platform,"architecture":platform.machine()}))']);
  const interpreter=JSON.parse(fs.readFileSync(path.join(root,'logs/interpreter.stdout.bin')));assert.match(interpreter.version,/^3\.12\./);
  await run('private_environment',pythonBase,['-m','venv',venv]);
  await run('pinned_requirements',python,['-m','pip','install','--no-cache-dir','-r',path.join(project,'invocation/python/requirements-m3.txt')]);
  await run('pip_check',python,['-m','pip','check']);
  await run('installed_inventory',python,['-c','import importlib.metadata,json; print(json.dumps({d.metadata["Name"]:d.version for d in importlib.metadata.distributions()},sort_keys=True))']);
  await run('frozen_carrier',python,['-m','grpc_tools.protoc','-I',path.join(project,'spec/m2/proto'),`--python_out=${generated}`,`--grpc_python_out=${generated}`,path.join(project,'spec/m2/proto/jpyxis_invocation_v1.proto')]);
  const module='reference-apps/versioned-risk-scoring/host-java';
  if(process.platform==='win32')await run('build_host',process.env.ComSpec||'cmd.exe',['/d','/s','/c',`mvnw.cmd -q -pl ${module} -am package`]);
  else await run('build_host','sh',[path.join(project,'mvnw'),'-q','-pl',module,'-am','package']);
  const requirements=Object.fromEntries(['invocation/python/requirements-m2.txt','invocation/python/requirements-m3.txt'].map(name=>[name,fs.readFileSync(name)]));
  const closure=Object.fromEntries(Object.entries(requirements).map(([name,raw])=>[name,sha(raw)]));
  const environment={schemaVersion:'jpyxis.io/reference-environment/v1alpha1',pythonImplementation:'CPython',pythonMajorMinor:'3.12',platform:interpreter.platform,architecture:interpreter.architecture,requirementsClosureDigest:sha(canonical(closure)),runtimePackages:{numpy:'2.2.6',grpcio:'1.83.1',protobuf:'7.35.1'}};
  const packageDirectory=path.join(venv,process.platform==='win32'?'Lib/site-packages':'lib/python3.12/site-packages');
  const launchEnvironment={PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1',PYTHONHASHSEED:'0',PYTHONPATH:[packageDirectory,path.join(project,'bindings/python'),path.join(project,'invocation/python'),generated,path.join(project,'reference/python')].join(path.delimiter),PATH:process.platform==='win32'?[path.dirname(python),path.join(process.env.SystemRoot||'C:\\Windows','System32')].join(path.delimiter):'/usr/bin:/bin'};
  if(process.platform==='win32')Object.assign(launchEnvironment,{SystemRoot:process.env.SystemRoot||'C:\\Windows',TEMP:path.join(root,'temporary'),TMP:path.join(root,'temporary')});
  const jar=path.join(project,module,'target/jpyxis-risk-scoring-host.jar');
  fs.mkdirSync(path.join(root,'artifacts'));fs.copyFileSync(jar,path.join(root,'artifacts/host.jar'));
  const construction={revision,tree,interpreter,workerExecutable:interpreter.executable,workerExecutableSha256:sha(fs.readFileSync(interpreter.executable)),requirementsClosure:closure,installedInventory:JSON.parse(fs.readFileSync(path.join(root,'logs/installed_inventory.stdout.bin'))),launchEnvironment,javaArtifactSha256:sha(fs.readFileSync(jar)),inputInventoryDigest:sha(fs.readFileSync(path.join(root,'input-inventory.json'))),commands:[...commands]};
  write('construction.json',construction);
  const definitions=Object.fromEntries(['v1','v2'].map((v,i)=>[v,{identity:`jpyxis:definition:reference/risk-affine@${i+1}.0.0`,bytes:fs.readFileSync(`reference-apps/versioned-risk-scoring/algorithms/risk-${v}.py`).toString('base64')}]));
  write('config.json',{evidenceRoot:root,pythonExecutable:interpreter.executable,pythonFlags:['-S'],interpreterVersion:interpreter.version,packageDirectory,workerScript:path.join(project,'reference/python/reference_worker.py'),launchEnvironment,environment,definitions,requirementsBytes:Object.fromEntries(Object.entries(requirements).map(([name,raw])=>[name,raw.toString('base64')])),contractBytes:fs.readFileSync('spec/m1/contracts/example.affine-batch.v1.json').toString('base64'),representativeInput:JSON.parse(fs.readFileSync('spec/m2/cases/success_exact.json')),executionBuild:{sourceRevision:revision,sourceTree:tree,inputInventoryDigest:construction.inputInventoryDigest,constructionReceiptDigest:sha(fs.readFileSync(path.join(root,'construction.json')))}});
  await run(scenario?'actual_http_scenario':'live_host','java',['-cp',jar,scenario?'io.jpyxis.reference.RiskHostScenarioMain':'io.jpyxis.reference.RiskHostServer',path.join(root,'config.json')],!scenario);
}catch(error){failed=error;write('first-failure.json',{revision,message:error.message,stage:commands.at(-1)?.id||'bootstrap',state:'ORIGINAL_FAILURE_RETAINED'});}
finally{
  const sourceFile=path.join(root,'control-source.jsonl'),records=fs.existsSync(sourceFile)?fs.readFileSync(sourceFile,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse):[];
  const pids=[...new Set(records.filter(r=>r.owner==='HOST_LAUNCH'&&['ACTUAL_WORKER_STARTED','INDEPENDENT_INTERPRETER_STARTED'].includes(r.event)).map(r=>r.details.pid||r.details.handle.processId))];
  const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
  write('independent-shutdown.json',{owner:'NODE_AFTER_JAVA_EXIT',observations:pids.map(pid=>({pid,alive:alive(pid)}))});
  const files=walk(root).filter(file=>!['e','maven-repository','maven-user-home','temporary'].some(name=>file.includes(`${path.sep}${name}${path.sep}`))&&!file.endsWith(`${path.sep}manifest.json`));
  write('manifest.json',{schemaVersion:'jpyxis.io/risk-host-evidence/v1alpha1',sourceRevision:revision,files:files.map(file=>{const raw=fs.readFileSync(file);return {path:path.relative(root,file).split(path.sep).join('/'),bytes:raw.length,sha256:sha(raw)};})});
  fs.writeFileSync(path.join(project,'build/risk/latest.json'),JSON.stringify({root,revision})+'\n');
}
if(failed){console.error(failed.message);process.exitCode=1;}
else if(scenario){const result=verifyRiskHostEvidence(root,{expectedSourceRevision:revision,requirePublicClean:publicClean});write('independent-readback.json',result);console.log(JSON.stringify({root,...result}));if(result.verdict!=='PASS')process.exitCode=1;else{const mutations=verifyRiskHostMutations(root,{expectedSourceRevision:revision,requirePublicClean:publicClean});write('mutation-readback.json',mutations);if(mutations.verdict!=='PASS')process.exitCode=1;}}

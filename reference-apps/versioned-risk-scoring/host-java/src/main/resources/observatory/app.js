'use strict';
const $=id=>document.getElementById(id);
let token='',state=null,selectedId='',busy=false,lastError='';
const short=value=>value?String(value).slice(0,16):'—';
const version=value=>value?`risk-${value}`:'NONE';
const text=(id,value)=>{$(id).textContent=value;};
function facts(target,rows){target.replaceChildren();for(const [label,value] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value??'—';dd.title=String(value??'');target.append(dt,dd);}}
function notice(value){$('message').hidden=!value;$('message').textContent=value||'';}
async function refresh(){
  const response=await fetch('/api/state');if(!response.ok)throw new Error('Host state unavailable');
  const next=await response.json();if(JSON.stringify(next)!==JSON.stringify(state)){state=next;render();}
}
async function act(action,extra={}){
  if(busy)return;busy=true;lastError='';render();
  try{
    const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Reference-Token':token},body:JSON.stringify({action,...extra})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Host operation rejected');
    if(action==='invoke')selectedId=data.id;
    await refresh();
  }catch(error){lastError=error.message;notice(lastError);}finally{busy=false;render();}
}
function addAction(label,action,extra,primary=false,disabled=false){const button=document.createElement('button');button.textContent=label;button.dataset.focusKey=`${action}:${extra?.version||''}`;button.className=primary?'primary':'';button.disabled=busy||disabled;button.addEventListener('click',()=>act(action,extra));$('lifecycle-actions').append(button);}
function requestSelected(){return state?.requests.find(r=>r.id===selectedId)||state?.requests.at(-1)||null;}
function render(){
  if(!state)return;
  const focusedKey=document.activeElement?.dataset.focusKey;
  const idle=state.operation==='IDLE'&&!state.closed&&!state.closing;
  const selected=requestSelected(),unknown=selected?.executionState==='OUTCOME_UNKNOWN';
  text('control-status',state.controlStatus);text('route',`${version(state.activeVersion)}${state.activeVersion&&!state.activeEligible?' · UNAVAILABLE':''}`);
  text('workers',`${state.eligibleWorkers} / ${state.observedLiveWorkers} live`);
  text('source-label',`SOURCE ${short(state.source?.sourceRevision)} · LOOPBACK SESSION`);
  const actions=$('lifecycle-actions');actions.replaceChildren();
  for(const d of state.definitions){
    if(!d.installed)addAction(`Install & warm ${d.version}`,'install',{version:d.version},d.version==='v1'&&!state.activeVersion,!idle);
  }
  const standby=state.deployments.filter(d=>d.state==='STANDBY'&&d.qualified&&d.alive);
  for(const d of standby)addAction(`Activate risk-${d.version}`,'activate',{version:d.version},true,!idle);
  if(state.canRollback)addAction(`Fresh rollback to ${state.activeVersion==='v2'?'v1':'v2'}`,'rollback',{},false,!idle);
  if(!idle&&!state.closed){const span=document.createElement('span');span.textContent=state.closing?'Closing owned processes…':state.operation;span.className='label';actions.append(span);}
  if(state.closed){const span=document.createElement('span');span.textContent='OWNED WORKERS STOPPED';span.className='label';actions.append(span);}
  const pendingOnActive=state.requests.some(r=>r.executionState==='IN_FLIGHT'&&r.executionBinding?.realization?.deploymentId===state.activeDeploymentId);
  $('invoke').disabled=busy||!state.activeEligible||state.closed||state.closing||pendingOnActive;
  $('close').disabled=busy||!state.canClose;$('export').disabled=!state.closed;
  const held=state.requests.find(r=>r.canRelease);$('release').hidden=!held;$('release').disabled=busy;
  $('release').onclick=()=>act('release',{requestId:held?.id});
  text('request-caption',selected?`${selected.id} · PINNED ${version(selected.version)}`:'No invocation yet');
  document.querySelectorAll('.wings .wing').forEach(el=>el.classList.toggle('unknown',unknown));
  if(selected){
    const binding=selected.executionBinding||{},definition=binding.definition||{},realization=binding.realization||{};
    const terminal=selected.executionState,pending=terminal==='IN_FLIGHT';
    text('score',unknown?'OUTCOME_UNKNOWN':selected.score==null?'—':Number(selected.score).toFixed(2));
    text('score-note',unknown?'Dispatch occurred; a sufficient result is unavailable.':pending?selected.observation:terminal==='SUCCEEDED'?`Pure computed signal: ${Number(selected.signal).toFixed(2)}`:'No qualified RiskScore is available.');
    text('terminal',terminal);$('terminal').className=`terminal ${terminal==='SUCCEEDED'?'succeeded':terminal==='FAILED_BEFORE_EXECUTION'||terminal==='FAILED'?'failed':''}`;
    facts($('execution-facts'),[['Request',selected.id],['Pinned version',version(selected.version)],['Worker',short(realization.workerId)],['Runtime',realization.runtimeBinding?.runtimeIdentity],['Attempt',short(binding.plan?.attemptId)],['Completed',selected.completedAt?new Date(selected.completedAt).toLocaleTimeString():'Awaiting completion']]);
    text('authority',unknown?'AUTHORITY HELD':pending?'CONTROL AUTHORIZED · REQUEST PIN HELD':terminal==='SUCCEEDED'?'CONTROL BINDING ESTABLISHED':'NO BUSINESS DECISION AUTHORITY');
    facts($('binding-facts'),[['Definition',definition.definitionIdentity],['Artifact digest',short(definition.definitionDigest)],['Environment',short(definition.environmentDigest)],['Qualification',short(binding.qualificationId)],['Request pin',short(binding.pin?.pinId)],['Current route',version(state.activeVersion)]]);
    text('features',`Exposure ${selected.features.normalizedExposure.toFixed(2)} / Activity ${selected.features.activity.toFixed(2)}\nVelocity ${selected.features.velocity.toFixed(2)} / Concentration ${selected.features.concentration.toFixed(2)}\nSynthetic case: ${selected.features.sample}`);
    text('decision',selected.decision);text('decision-note',unknown?'WITHHELD · uncertainty is never a business verdict.':selected.decision==='WITHHELD'?'Only validated successful execution may enter Java policy.':`Evaluated by Java policy · ${selected.id}`);
    $('receipt-layers').replaceChildren();
    for(const [name,rows] of [
      ['Execution Binding',[['Definition',definition.definitionIdentity],['Definition digest',definition.definitionDigest],['Environment',definition.environmentDigest],['Runtime',JSON.stringify(realization.runtimeBinding||{})],['Worker / instance',`${realization.workerId||'—'} / ${realization.instanceId||'—'}`],['Launch nonce',realization.launchNonce],['Request pin',binding.pin?.pinId]]],
      ['Observed Execution',[['Invocation',binding.plan?.logicalInvocationId],['Attempt',binding.plan?.attemptId],['Accepted',selected.acceptedAt],['Completed',selected.completedAt||'Not complete'],['Terminal',selected.executionState],['Wire invoked',selected.wireCalled===undefined?'Awaiting final observation':String(selected.wireCalled)]]],
      ['Java Decision',[['Policy',selected.javaPolicy?.identity],['Policy digest',selected.policyDigest],['Score',selected.score==null?'Unavailable':String(selected.score)],['Decision',selected.decision]]]
    ]){const layer=document.createElement('div'),h=document.createElement('h3'),dl=document.createElement('dl');layer.className='receipt-layer';h.textContent=name;facts(dl,rows);layer.append(h,dl);$('receipt-layers').append(layer);}
  }else{
    text('score','—');text('score-note','No computation has been delegated.');text('terminal','AWAITING REQUEST');text('decision','WITHHELD');text('decision-note','A validated success is required.');
    text('authority',standby.length?'ELIGIBLE FOR ACTIVATION':state.activeVersion?'ACTIVE BINDING ESTABLISHED':'NO ACTIVE BINDING');
    facts($('binding-facts'),[['Active route',version(state.activeVersion)],['Standby',standby.map(d=>version(d.version)).join(', ')||'NONE'],['Environment','Qualified per actual realization']]);
    facts($('execution-facts'),[['Source','Java-prepared synthetic features'],['Runtime','No invocation'],['Terminal','No outcome']]);
    text('features','Java will prepare the selected synthetic case.');$('receipt-layers').textContent='A request is required before an execution receipt exists.';
  }
  $('timeline').replaceChildren();
  if(!state.deployments.length)$('timeline').textContent='No deployment. Install and warm a retained artifact before activation.';
  for(const d of state.deployments){const card=document.createElement('article');card.className=`deployment ${d.state==='ACTIVE'?'active':''}`;const name=document.createElement('span'),status=document.createElement('span'),detail=document.createElement('p'),journey=document.createElement('p');name.className='version';name.textContent=version(d.version);status.className='state';status.textContent=d.state;detail.textContent=`${d.outstandingPins} outstanding pin${d.outstandingPins===1?'':'s'} · ${d.alive?'owned worker live':'owned worker stopped'}`;journey.className='journey';journey.textContent=`${d.purpose==='FRESH_ROLLBACK'?'FRESH REALIZATION · ':''}${[...new Set(d.history.map(e=>e.state))].join(' → ')||d.state} · nonce ${short(d.realization?.launchNonce)}`;card.append(name,status,detail,journey);$('timeline').append(card);}
  $('ceremony-events').replaceChildren();
  for(const event of state.ceremonies){const li=document.createElement('li');li.textContent=`${event.phase.replaceAll('_',' ')}${event.version?' · risk-'+event.version:''} · ${new Date(event.observedAt).toLocaleTimeString()}`;$('ceremony-events').append(li);}
  $('request-rows').replaceChildren();
  for(const r of [...state.requests].reverse()){const tr=document.createElement('tr');tr.className=r.id===selected?.id?'current':'';const cell=document.createElement('td'),button=document.createElement('button');button.textContent=r.id;button.dataset.focusKey=`request:${r.id}`;button.setAttribute('aria-label',`Inspect request ${r.id}`);button.onclick=()=>{selectedId=r.id;render();};cell.append(button);tr.append(cell);for(const value of [version(r.version),r.score==null?'—':Number(r.score).toFixed(2),r.decision,r.executionState]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('request-rows').append(tr);}
  text('shutdown-note',state.allOwnedWorkersStopped?'All owned workers observed stopped. Sealed receipt available.':'Shutdown is a separate physical observation.');
  notice(lastError||state.operationError||(unknown?'OUTCOME_UNKNOWN · AUTHORITY HELD · JAVA DECISION WITHHELD':selected?.mode==='hold'&&selected.executionState==='IN_FLIGHT'?'Actual M3 witness barrier: release within 15 seconds. Waiting is not a claim that NumPy is computing.':''));
  if(focusedKey){const restored=[...document.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===focusedKey);if(restored&&!restored.disabled)restored.focus({preventScroll:true});}
}
$('invoke').onclick=()=>act('invoke',{sample:$('sample').value,mode:$('mode').value});
$('close').onclick=()=>act('close');$('export').onclick=()=>{window.location.href='/api/receipt';};
async function initialize(){try{const response=await fetch('/api/session');token=(await response.json()).token;await refresh();setInterval(()=>refresh().catch(error=>notice(error.message)),650);}catch(error){notice(error.message);}}
initialize();

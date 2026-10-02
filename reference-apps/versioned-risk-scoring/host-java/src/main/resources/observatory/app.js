'use strict';
const $=id=>document.getElementById(id);
let token='',state=null,selectedId='',selectedDeploymentId='',busy=false,lastError='';
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
function addAction(label,action,extra,primary=false,disabled=false){const button=document.createElement('button');button.textContent=label;button.dataset.focusKey=`${action}:${extra?.version||''}`;button.className=[primary?'primary':'',action==='activate'?'authority-action':'',action==='rollback'?'recovery authority-action':''].filter(Boolean).join(' ');button.disabled=busy||disabled;button.addEventListener('click',()=>act(action,extra));$('lifecycle-actions').append(button);}
function requestSelected(){return state?.requests.find(r=>r.id===selectedId)||state?.requests.at(-1)||null;}
function render(){
  if(!state)return;
  const focusedKey=document.activeElement?.dataset.focusKey;
  const idle=state.operation==='IDLE'&&!state.closed&&!state.closing;
  const selected=requestSelected(),unknown=selected?.executionState==='OUTCOME_UNKNOWN';
  $('authority').classList.toggle('authorized',selected?['IN_FLIGHT','SUCCEEDED'].includes(selected.executionState):state.activeEligible);
  $('decision').classList.toggle('withheld',!selected||selected.decision==='WITHHELD');
  text('control-status',state.controlStatus);text('route',`${version(state.activeVersion)}${state.activeVersion&&!state.activeEligible?' · UNAVAILABLE':''}`);
  text('workers',`${state.eligibleWorkers} / ${state.observedLiveWorkers} live`);
  text('source-label',`SOURCE ${short(state.source?.sourceRevision)} · LOOPBACK SESSION`);
  const actions=$('lifecycle-actions');actions.replaceChildren();
  for(const d of state.definitions){
    if(!d.installed)addAction(`Install & warm ${d.version}`,'install',{version:d.version},d.version==='v1'&&!state.activeVersion,!idle);
  }
  const standby=state.deployments.filter(d=>d.state==='STANDBY'&&d.qualified&&d.alive);
  $('invoke').classList.toggle('primary',standby.length===0&&state.activeEligible&&!unknown);
  for(const d of standby)addAction(`Activate risk-${d.version}`,'activate',{version:d.version},true,!idle);
  if(state.canRollback)addAction(`Fresh rollback to ${state.rollbackVersion}`,'rollback',{},false,!idle);
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
    text('features',`Exposure ${selected.features.normalizedExposure.toFixed(2)} · Activity ${selected.features.activity.toFixed(2)}\nVelocity ${selected.features.velocity.toFixed(2)} · Case ${selected.features.sample}\nConcentration ${selected.features.concentration.toFixed(2)}`);
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
  $('timeline').classList.toggle('empty',!state.deployments.length);
  if(!state.deployments.length)$('timeline').textContent='No versions yet.';
  for(const d of [...state.deployments].reverse()){
    const button=document.createElement('button'),name=document.createElement('span');
    const current=navigationTarget()==='#lifecycle'&&deploymentSelected()?.deploymentId===d.deploymentId;
    button.className=`context-link ${current?'selected':''}`;button.dataset.focusKey=`version:${d.deploymentId}`;button.setAttribute('aria-label',`Inspect ${version(d.version)} realization ${short(d.realization?.launchNonce)}`);button.setAttribute('aria-pressed',String(current));
    button.onclick=()=>{selectedDeploymentId=d.deploymentId;navigate('#lifecycle');};
    name.textContent=version(d.version)+(d.purpose==='FRESH_ROLLBACK'?' · fresh':'');
    button.append(name);$('timeline').append(button);
  }
  $('ceremony-events').replaceChildren();
  for(const event of state.ceremonies){const li=document.createElement('li');li.textContent=`${event.phase.replaceAll('_',' ')}${event.version?' · risk-'+event.version:''} · ${new Date(event.observedAt).toLocaleTimeString()}`;$('ceremony-events').append(li);}
  $('request-rows').replaceChildren();
  $('request-rows').classList.toggle('empty',!state.requests.length);
  if(!state.requests.length)$('request-rows').textContent='No invocations yet.';
  for(const r of [...state.requests].reverse()){
    const button=document.createElement('button'),name=document.createElement('span');
    const current=['#overview','#workspace','#receipt'].includes(navigationTarget())&&r.id===selected?.id;
    button.className=`context-link ${current?'selected':''}`;button.dataset.focusKey=`request:${r.id}`;button.setAttribute('aria-label',`Inspect request ${r.id}`);button.setAttribute('aria-pressed',String(current));
    button.onclick=()=>{selectedId=r.id;navigate('#workspace');};name.textContent=r.id;
    button.append(name);$('request-rows').append(button);
  }
  text('shutdown-note',state.allOwnedWorkersStopped?'All owned workers observed stopped. Sealed receipt available.':'Shutdown is a separate physical observation.');
  notice(lastError||state.operationError||(unknown?'OUTCOME_UNKNOWN · AUTHORITY HELD · JAVA DECISION WITHHELD':selected?.mode==='hold'&&selected.executionState==='IN_FLIGHT'?'Hold barrier · release within 15s. Computation has not started.':''));
  renderCentralLists();reflectNavigation();
  if(focusedKey){const restored=[...document.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===focusedKey);if(restored&&!restored.disabled)restored.focus({preventScroll:true});}
}
$('invoke').classList.add('execution-action');$('invoke').onclick=()=>act('invoke',{sample:$('sample').value,mode:$('mode').value});
$('close').onclick=()=>act('close');$('export').onclick=()=>{window.location.href='/api/receipt';};
const selectors=[];
function enhanceSelect(select){
  const wrapper=document.createElement('div'),button=document.createElement('button'),label=document.createElement('span'),list=document.createElement('ul');
  wrapper.className='select-control';button.type='button';button.id=`${select.id}-control`;button.className='select-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-label',select.getAttribute('aria-label'));button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls',`${select.id}-options`);button.setAttribute('aria-expanded','false');
  list.id=`${select.id}-options`;list.className='select-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',select.getAttribute('aria-label'));list.hidden=true;
  const chevron=document.querySelector('[data-lucide="chevron-down"]').cloneNode(true);button.append(label,chevron);
  let active=select.selectedIndex,typed='',typedAt=0;
  const options=[...select.options].map((option,index)=>{
    const item=document.createElement('li');item.id=`${select.id}-option-${index}`;item.setAttribute('role','option');item.textContent=option.textContent;item.addEventListener('pointerdown',event=>event.preventDefault());item.addEventListener('click',()=>{active=index;close(true);button.focus({preventScroll:true});});list.append(item);return item;
  });
  function sync(){const option=select.options[select.selectedIndex];label.textContent=option.textContent.replace(' witness','').replace(' · diagnostic','');button.title=option.textContent;options.forEach((item,index)=>item.setAttribute('aria-selected',String(index===select.selectedIndex)));}
  function highlight(index){active=Math.max(0,Math.min(options.length-1,index));options.forEach((item,i)=>{item.classList.toggle('active',i===active);item.setAttribute('aria-selected',String(i===active));});button.setAttribute('aria-activedescendant',options[active].id);options[active].scrollIntoView({block:'nearest'});}
  function close(commit=false){if(list.hidden)return;if(commit){select.selectedIndex=active;select.dispatchEvent(new Event('change',{bubbles:true}));}list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');sync();}
  function open(){selectors.forEach(item=>item.close(true));list.hidden=false;button.setAttribute('aria-expanded','true');highlight(select.selectedIndex);}
  button.addEventListener('click',()=>list.hidden?open():close());
  button.addEventListener('keydown',event=>{
    const key=event.key;
    if(key==='Escape'){if(!list.hidden){event.preventDefault();close();}return;}
    if(key==='Tab'){close(true);return;}
    if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Enter',' '].includes(key)){
      event.preventDefault();const wasClosed=list.hidden;
      if(wasClosed)open();
      if(key==='Home'||key==='PageUp')highlight(0);
      else if(key==='End'||key==='PageDown')highlight(options.length-1);
      else if(key==='ArrowDown'&&!wasClosed)highlight(active+1);
      else if(key==='ArrowUp'){if(event.altKey&&!wasClosed)close(true);else highlight(wasClosed?0:active-1);}
      else if((key==='Enter'||key===' ')&&!wasClosed)close(true);
    }else if(key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      event.preventDefault();const now=Date.now();typed=now-typedAt>800?key.toLowerCase():typed+key.toLowerCase();typedAt=now;
      if(list.hidden)open();const repeated=[...typed].every(letter=>letter===typed[0]),query=repeated?typed[0]:typed;
      const order=options.map((_,i)=>(active+1+i)%options.length),match=order.find(i=>options[i].textContent.toLowerCase().startsWith(query));if(match!==undefined)highlight(match);
    }
  });
  button.addEventListener('blur',()=>close(true));document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))close(true);});select.addEventListener('change',sync);
  wrapper.append(button,list);select.after(wrapper);select.hidden=true;sync();selectors.push({close});
}
['sample','mode'].forEach(id=>enhanceSelect($(id)));
async function initialize(){try{const response=await fetch('/api/session');token=(await response.json()).token;await refresh();setInterval(()=>refresh().catch(error=>notice(error.message)),650);}catch(error){notice(error.message);}}
initialize();
function navigationTarget(){const target=window.location.hash;return ['#overview','#workspace','#lifecycle','#records','#receipt'].includes(target)?target:'#overview';}
function deploymentSelected(){return state?.deployments.find(d=>d.deploymentId===selectedDeploymentId)||state?.deployments.find(d=>d.deploymentId===state.activeDeploymentId)||state?.deployments.at(-1)||null;}
function navigate(target){selectors.forEach(item=>item.close(true));history.replaceState(null,'',target);if(state)render();else reflectNavigation();window.scrollTo({top:0,behavior:'instant'});$('view-title').focus({preventScroll:true});}
function reflectNavigation(){
  const target=navigationTarget(),overview=target==='#overview'||target==='#workspace';
  document.querySelectorAll('.rail nav a').forEach(link=>{const current=link.getAttribute('href')===target;link.classList.toggle('selected',current);if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  $('risk-panel').hidden=!overview;$('lifecycle').hidden=target!=='#lifecycle';$('records').hidden=target!=='#records';$('receipt').hidden=!(overview||target==='#receipt');
  text('view-title',({'#overview':'JPYXIS CONTROL OBSERVATORY','#workspace':'RISK SCORING OBSERVATORY','#lifecycle':'VERSION CONTINUITY','#records':'INVOCATION HISTORY','#receipt':'EXECUTION RECEIPT'})[target]);
  if(target==='#receipt')$('receipt-details').open=true;
}
function renderCentralLists(){
  const d=deploymentSelected();$('realization-history').replaceChildren();
  if(d){
    const r=d.realization||{},definition=state.definitions.find(item=>item.version===d.version);
    text('realization-title',`${version(d.version)}${d.purpose==='FRESH_ROLLBACK'?' · Fresh realization':''}`);
    text('realization-state',`${d.state} · owned worker ${d.alive?'live':'stopped'} · ${d.outstandingPins} outstanding pin${d.outstandingPins===1?'':'s'}`);
    facts($('realization-facts'),[['Definition',definition?.identity],['Artifact digest',definition?.digest],['Deployment',d.deploymentId],['Environment',r.environmentDigest],['Worker / instance',`${r.workerId||'—'} / ${r.instanceId||'—'}`],['Launch nonce',r.launchNonce],['Runtime',JSON.stringify(r.runtimeBinding||{})],['Control qualification',d.qualified?'Retained':'Not qualified'],['Current route',version(state.activeVersion)]]);
    for(const event of d.history){const li=document.createElement('li');li.textContent=`${event.state} · ${event.event} · sequence ${event.sequence}`;$('realization-history').append(li);}
  }else{text('realization-title','No deployment');text('realization-state','Install and warm a retained artifact before activation.');$('realization-facts').replaceChildren();}
  const rows=$('history-rows');rows.replaceChildren();
  if(!state.requests.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='No invocations in this actual session.';tr.append(td);rows.append(tr);}
  for(const request of [...state.requests].reverse()){
    const tr=document.createElement('tr'),cell=document.createElement('td'),button=document.createElement('button');tr.className=request.id===requestSelected()?.id?'current':'';
    button.textContent=request.id;button.dataset.focusKey=`history-request:${request.id}`;button.setAttribute('aria-label',`Open invocation ${request.id}`);button.onclick=()=>{selectedId=request.id;navigate('#workspace');};cell.append(button);tr.append(cell);
    for(const value of [version(request.version),request.score==null?'—':Number(request.score).toFixed(2),request.decision,request.executionState]){const td=document.createElement('td');td.textContent=value;tr.append(td);}rows.append(tr);
  }
}
document.querySelectorAll('.rail nav a,.rail-brand').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();navigate(link.getAttribute('href'));}));
window.addEventListener('hashchange',()=>{if(state)render();else reflectNavigation();});reflectNavigation();

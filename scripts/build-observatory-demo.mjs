import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const root = 'reference-apps/versioned-risk-scoring';
const assets = `${root}/host-java/src/main/resources/observatory`;
const destination = 'build/observatory-demo';
fs.mkdirSync(destination, {recursive: true});
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const write = (file, text) => fs.writeFileSync(path.join(destination, file), text);
const host = read(`${root}/host-java/src/main/java/io/jpyxis/reference/RiskScoringSlot.java`);
assert.ok(host.includes('score<0.55f?"ALLOW":score<0.80f?"REVIEW":"REJECT"'), 'Reconcile changed Java policy before publishing the demo');
const samples = Object.fromEntries([...host.matchAll(/case "(LOW|STANDARD|HIGH)" -> new RiskFeatures\(sample, ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/g)].map(m => [m[1], {
  sample: m[1], normalizedExposure: Number(m[2]), activity: Number(m[3]), velocity: Number(m[4]), concentration: Number(m[5]),
}]));
assert.equal(Object.keys(samples).length, 3, 'Demo samples must derive from the current host');
const definitions = ['v1', 'v2'].map(version => {
  const bytes = fs.readFileSync(`${root}/algorithms/risk-${version}.py`);
  const source = bytes.toString('utf8');
  const calibration = JSON.parse(source.match(/^# RISK_CALIBRATION (.+)$/m)[1]);
  const identity = source.match(/DEFINITION_IDENTITY = "([^"]+)"/)[1];
  return {version, identity, digest: `sha256:${sha(bytes)}`, ...calibration};
});
const catalog = {sourceRevision, policy: {review: 0.55, reject: 0.80}, samples, definitions};
write('catalog.json', JSON.stringify(catalog, null, 2) + '\n');

let html = read(`${assets}/index.html`);
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, `Expected one source seam: ${before.slice(0, 80)}`);
  return text.replace(before, after);
}
html = replaceOnce(html, 'href="/style.css"', 'href="./style.css"><link rel="stylesheet" href="./demo.css"');
html = replaceOnce(html, '<script src="/app.js" defer>', '<script type="module" src="./app.js">');
html = replaceOnce(html, 'JPyxis · Risk Scoring Reference Host</title>', 'JPyxis · Interactive Observatory Demo</title>');
html = replaceOnce(html, 'One local host.<br>Explicit authority.', 'Browser demo.<br>Explore the boundary.');
html = replaceOnce(html, 'RISK SCORING REFERENCE HOST<span', 'INTERACTIVE FRONTEND DEMO<span');
html = replaceOnce(html, 'Connecting to Java host…', 'Loading browser demo…');
html = replaceOnce(html, 'Widen this window to use controls.', 'Widen this window to try the demo controls.');
html = replaceOnce(html, '<main>', `<main>
<section class="demo-toolbar" aria-label="Demo information"><strong>INTERACTIVE DEMO · BROWSER ONLY</strong><button id="demo-reset">Reset demo</button><a href="https://github.com/NoctilumeDev/JPyxis/blob/main/docs/observatory-demo.md">Run the real host locally</a><a href="https://github.com/NoctilumeDev/JPyxis">GitHub</a><p>Install &amp; warm v1 → activate → invoke. All execution, lifecycle and receipts here are simulated; no Java or Python process runs.</p></section>`);
html = replaceOnce(html, 'Hold for cutover · 15s witness', 'Hold for cutover · demo');
html = replaceOnce(html, 'Crash after dispatch · diagnostic', 'Missing outcome · demo');
html = replaceOnce(html, 'Close owned workers</button>', 'Close demo session</button>');
html = replaceOnce(html, 'Export sealed receipt</button>', 'Download demo receipt</button>');
html = replaceOnce(html, '<h2>Actual invocations</h2>', '<h2>Demo invocations</h2>');
html = replaceOnce(html, 'aria-label="Live control status"', 'aria-label="Demo control status"');
html = replaceOnce(html, 'JPyxis reference witnesses: Java · Python · NumPy · gRPC', 'Browser simulation · real execution requires the local reference host');

let js = read(`${assets}/app.js`);
const refreshStart = js.indexOf('async function refresh(){');
const actionEnd = js.indexOf('function addAction(');
assert.ok(refreshStart >= 0 && actionEnd > refreshStart);
js = js.slice(0, refreshStart) + `async function refresh(){state=demo.update();render();}
async function act(action,extra={}){
  lastError='';
  try{const result=demo.act(action,extra);if(action==='invoke')selectedId=result.id;await refresh();}
  catch(error){lastError=error.message;notice(lastError);}
}
` + js.slice(actionEnd);
js = replaceOnce(js, "text('source-label',`SOURCE ${short(state.source?.sourceRevision)} · LOOPBACK SESSION`);", "text('source-label',`DEMO SOURCE ${short(state.source?.sourceRevision)} · BROWSER SIMULATION`);");
js = replaceOnce(js, "$('export').onclick=()=>{window.location.href='/api/receipt';};", `$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(demo.receipt(),null,2)+'\\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jpyxis-frontend-demo-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};`);
const initializeStart = js.indexOf('async function initialize(){');
const initializeEnd = js.indexOf('function navigationTarget(){');
assert.ok(initializeStart >= 0 && initializeEnd > initializeStart);
js = js.slice(0, initializeStart) + `$('demo-reset').onclick=()=>{demo.reset();selectedId='';selectedDeploymentId='';lastError='';for(const id of ['sample','mode']){$(id).selectedIndex=0;$(id).dispatchEvent(new Event('change',{bubbles:true}));}navigate('#overview');refresh();};
await refresh();
` + js.slice(initializeEnd);
js = js.replaceAll('OWNED WORKERS STOPPED', 'DEMO SESSION CLOSED')
  .replaceAll('All owned workers observed stopped. Sealed receipt available.', 'Demo session closed. Download the simulated receipt or reset to explore again.')
  .replaceAll('Shutdown is a separate physical observation.', 'Demo only. No real worker or physical shutdown is observed.')
  .replaceAll('owned worker', 'demo worker').replaceAll('within 15s', 'when ready')
  .replaceAll('Qualified per actual realization', 'Simulated eligibility only')
  .replaceAll('Control qualification', 'Demo eligibility')
  .replaceAll("d.qualified?'Retained':'Not qualified'", "d.qualified?'Simulated':'Unavailable'")
  .replaceAll('Evaluated by Java policy', 'Demo of Java policy')
  .replaceAll('Java will prepare the selected synthetic case.', 'The demo uses host synthetic cases.')
  .replaceAll('Dispatch occurred; a sufficient result is unavailable.', 'Simulated missing outcome; no result is available.')
  .replaceAll('No invocations in this actual session.', 'No invocations in this demo session.')
  .replaceAll('A validated success is required.', 'A simulated success is required.');
assert.ok(!js.includes('/api/'), 'Public demo must contain no host API routes');
js = `import {ObservatoryDemo} from './demo-engine.mjs';
const catalogResponse=await fetch('./catalog.json');
if(!catalogResponse.ok)throw new Error('Demo catalog unavailable');
const demo=new ObservatoryDemo(await catalogResponse.json());
` + js;
write('index.html', html); write('app.js', js); write('style.css', read(`${assets}/style.css`));
for (const name of ['demo-engine.mjs', 'demo.css']) write(name, read(`${root}/demo/${name}`));
write('.nojekyll', '');
write('publication.json', JSON.stringify({siteRevision: sourceRevision, mode: 'interactive-browser-simulation', sourceAssets: ['index.html', 'style.css', 'app.js'].map(name => ({path: `${assets}/${name}`, sha256Lf: sha(read(`${assets}/${name}`))}))}, null, 2) + '\n');
console.log(`Built interactive browser demo from ${sourceRevision} at ${destination}`);

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.hazard-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws, id = 0;
const pending = new Map(), errors = [];
const endpoint = await new Promise((yes, no) => {
  const timeout = setTimeout(() => no(new Error('Browser did not start within 20 seconds.')), 20000);
  child.on('error', no);
  child.stderr.on('data', data => { const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timeout); yes(match[1]); } });
});
try {
  const origin = endpoint.replace(/^ws:/, 'http:').split('/devtools')[0];
  const pages = await (await fetch(`${origin}/json/list`)).json();
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((yes, no) => { ws.onopen = yes; ws.onerror = no; });
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (p) { clearTimeout(p.timer); message.error ? p.no(new Error(message.error.message)) : p.yes(message.result); } }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + message.params.exceptionDetails.exception?.description);
  };
  const send = (method, params = {}) => new Promise((yes, no) => { const n = ++id; pending.set(n, { yes, no, timer: setTimeout(() => no(new Error(`CDP timeout: ${method}`)), 10000) }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const until = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`UI timeout: ${expression}`); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(resolve(artifacts, name), Buffer.from(data, 'base64')); };

  await send('Runtime.enable');await send('Page.enable');
  // Inject a test-only harness into the fetched module, never into shipped files.
  const originalOnMessage=ws.onmessage;
  ws.onmessage=async event=>{originalOnMessage(event);const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;const {requestId}=message.params;try{const response=await send('Fetch.getResponseBody',{requestId});const code=response.base64Encoded?Buffer.from(response.body,'base64').toString():response.body;await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(code+'\nwindow.hazardTest={get race(){return race},get recording(){return recording},render,renderer,performMove};').toString('base64')});}catch(error){errors.push(error.message);}};
  await send('Fetch.enable',{patterns:[{urlPattern:'*/app.js',requestStage:'Response'}]});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:resolve(artifacts,'video-downloads')});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});await until('!!window.hazardTest');
  await evaluate('localStorage.clear();location.reload()');await until('!!window.hazardTest');
  await click('.driver-setting:last-child .remove-driver');await click('#ambience');await click('#setup-form button[type="submit"]');
  assert.equal(await evaluate('document.querySelectorAll("#vehicle-condition meter").length'),3);
  const state=()=>evaluate('JSON.parse(JSON.stringify(hazardTest.race.cars[0]))');
  const drive=async(ax,ay)=>{await click('.destination[data-ax="'+ax+'"][data-ay="'+ay+'"]');await until('document.querySelector("#game").dataset.busy==="false"');};
  const start=await evaluate('({...hazardTest.race.track.start})');
  await evaluate('{const r=hazardTest.race,c=r.cars[0],s=r.track.start;c.vx=s.dx;c.vy=s.dy;r.track.oil.set((s.x+s.dx)+","+(s.y+s.dy),{x:s.x+s.dx,y:s.y+s.dy});hazardTest.render();}');
  await drive(0,0);assert.equal((await state()).oilTurns,3);assert.equal(await evaluate('document.querySelectorAll(".destination:not(:disabled)").length'),1);
  await screenshot('oil-penalty.png');
  await drive(0,0);assert.equal((await state()).oilTurns,2);
  await click('#replay-button');await click('#replay-toggle');
  await evaluate('{const s=document.querySelector("#replay-position");s.value="1.5";s.dispatchEvent(new Event("input"));}');
  await screenshot('oil-spin-replay.png');await click('#export-video');
  await until('!document.querySelector("#video-download").hidden');const filename=await evaluate('document.querySelector("#video-download").download');
  const {inspectVideo}=await import('./inspect-video.mjs');const video=await inspectVideo(resolve(artifacts,'video-downloads',filename),evaluate);assert.equal(video.fps,60);
  await click('#video-close');await until('!document.querySelector("#video-camera").disabled');await click('#replay-close');
  // Approach the actual generated service lane with damaged parts and penalties.
  const repair=await evaluate('{const r=hazardTest.race,c=r.cars[0],route=r.track.pitRoute,index=route.findIndex(p=>p.x+","+p.y===r.track.serviceCell),from=route[index-1],to=route[index];Object.assign(c,{...from,vx:to.x-from.x,vy:to.y-from.y,oilTurns:1,punctureTurns:1,slowTurns:1,health:{tires:1,engine:1,body:1}});hazardTest.renderer.focus(c,true);hazardTest.render();({from,to});}');
  await drive(0,0);let c=await state();assert.deepEqual(c.health,c.maxHealth);assert.equal(c.oilTurns+c.punctureTurns+c.slowTurns,0);assert.equal(c.x,repair.to.x);assert.equal(c.y,repair.to.y);
  await screenshot('pit-repair.png');
  // Use an existing deployed police strip and its clear neighboring road cell.
  await evaluate('{const r=hazardTest.race,c=r.cars[0],sp=[...r.track.spikes.values()][0],step=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dy])=>r.track.road.has((sp.x-dx)+","+(sp.y-dy)));Object.assign(c,{x:sp.x-step[0],y:sp.y-step[1],vx:step[0],vy:step[1],oilTurns:0,punctureTurns:0,slowTurns:0});r.track.hazardRound=2;hazardTest.renderer.focus(c,true);hazardTest.render();}');
  await drive(0,0);assert.equal((await state()).punctureTurns,3);await screenshot('police-puncture.png');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".destination")).find(el=>el.dataset.ax==="0"&&el.dataset.ay==="0").disabled'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await screenshot('vehicle-health-mobile.png');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await evaluate('{const r=hazardTest.race,c=r.cars[0],s=r.track.start;Object.assign(c,{x:s.x,y:s.y,vx:s.dx,vy:s.dy,oilTurns:0,punctureTurns:0,slowTurns:0,health:{...c.maxHealth,tires:1}});r.track.holes.add((s.x+s.dx)+","+(s.y+s.dy));hazardTest.render();}');
  await drive(0,0);assert.equal((await state()).wrecked,true);assert.equal(await evaluate('document.querySelector("#winner-banner").hidden'),false);assert.match(await evaluate('document.querySelector("#winner-name").textContent'),/No car/);await screenshot('retired-race.png');
  assert.deepEqual(errors,[]);const result={video,checks:['health-hud','oil-three-turns','locked-inputs','spin-replay','60fps-export','actual-pit-repair','police-spikes','mobile','retirement-without-winner'],errors};await writeFile(resolve(artifacts,'hazards-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();child.kill();}

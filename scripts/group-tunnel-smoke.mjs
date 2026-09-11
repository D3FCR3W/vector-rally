import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.group-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  ws.onmessage=async event=>{originalOnMessage(event);const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;const {requestId}=message.params;try{const response=await send('Fetch.getResponseBody',{requestId});const code=response.base64Encoded?Buffer.from(response.body,'base64').toString():response.body;await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(code+'\nwindow.hazardTest={get race(){return race},get recording(){return recording},render,renderer,performMove,get animation(){return animation}};').toString('base64')});}catch(error){errors.push(error.message);}};
  await send('Fetch.enable',{patterns:[{urlPattern:'*/app.js',requestStage:'Response'}]});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:resolve(artifacts,'video-downloads')});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});await until('!!window.hazardTest');
  await evaluate('localStorage.clear();location.reload()');await until('!!window.hazardTest');

  await click('#add-driver');await click('#add-driver');
  await evaluate('document.querySelectorAll(".driver-setting select").forEach((s,i)=>{s.value=i?"ai":"human";s.dispatchEvent(new Event("change"));})');
  await click('#ambience');await click('#setup-form button[type="submit"]');
  await evaluate('hazardTest.performMove({ax:0,ay:0})');
  await until('hazardTest.animation?.length===3');
  const pass=await evaluate('({ids:hazardTest.animation.map(m=>m.id),starts:hazardTest.animation.map(m=>m.start),anchor:document.querySelector("#game").dataset.humanAnchor,viewed:document.querySelector("#game").dataset.cameraDrivers,events:hazardTest.recording.events.length})');
  assert.deepEqual(pass.ids,[1,2,3]);assert.equal(new Set(pass.starts).size,1);assert.equal(pass.anchor,'0');assert.equal(pass.viewed,'0');assert.equal(pass.events,4);
  await screenshot('ai-one-pass.png');await until('!hazardTest.animation');
  await click('#camera-options summary');
  const mode=async value=>{await evaluate('document.querySelector("#camera-mode").value='+JSON.stringify(value)+';document.querySelector("#camera-mode").dispatchEvent(new Event("change"))');};
  await mode('nearby');assert.ok((await evaluate('document.querySelector("#game").dataset.cameraDrivers')).includes('0'));
  await mode('all');assert.equal(await evaluate('document.querySelector("#game").dataset.cameraDrivers'),'0,1,2,3');
  await mode('selected');await click('#camera-players input[value="0"]');await click('#camera-players input[value="3"]');assert.equal(await evaluate('document.querySelector("#game").dataset.cameraDrivers'),'1,2');await screenshot('camera-selected.png');
  await click('#camera-players input[value="1"]');await click('#camera-players input[value="2"]');assert.equal(await evaluate('document.querySelectorAll("#camera-players input:checked").length'),1);
  await click('#focus-car');await click('#camera-options summary');
  // Look at the covered mountain from outside without changing live geometry.
  await evaluate('{const r=hazardTest.race,t=r.track.tunnels[0],p=r.track.cells.get(t.cells[Math.floor(t.cells.length/2)]);window.tunnelPoint={x:p.x,y:p.y};Object.assign(hazardTest.renderer.camera,{x:(p.x+.5)*32,y:(p.y+.5)*32,zoom:1.5,following:false});hazardTest.render();}');
  assert.equal(await evaluate('document.querySelector("#track").dataset.revealedTunnels'),'0');await screenshot('mountain-outside.png');
  await evaluate('Object.assign(hazardTest.race.cars[0],window.tunnelPoint,{vx:0,vy:0});hazardTest.render()');assert.equal(await evaluate('document.querySelector("#track").dataset.revealedTunnels'),'1');await screenshot('mountain-inside.png');
  await evaluate('hazardTest.performMove({ax:0,ay:0})');await until('hazardTest.race.cars[0].turns===2&&!hazardTest.animation&&hazardTest.race.active===0');
  await click('#replay-button');await click('#replay-toggle');
  await evaluate('document.querySelector("#replay-position").value="1.9";document.querySelector("#replay-position").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelector("#track").dataset.revealedTunnels'),'1');await screenshot('tunnel-replay.png');
  await click('#export-video');await until('!document.querySelector("#video-download").hidden');
  const filename=await evaluate('document.querySelector("#video-download").download');const {inspectVideo}=await import('./inspect-video.mjs');const video=await inspectVideo(resolve(artifacts,'video-downloads',filename),evaluate);assert.equal(video.fps,60);
  await click('#video-close');await until('!document.querySelector("#video-camera").disabled');await click('#replay-close');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await click('#focus-car');await click('#camera-options summary');await mode('nearby');await screenshot('camera-mobile.png');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.deepEqual(errors,[]);const result={pass,video,errors,checks:['shared-ai-clock','human-only-follow','nearby','all','custom-ai-subset','nonempty-group','covered-mountain','interior-cutaway','replay-tunnel','60fps-video','mobile']};await writeFile(resolve(artifacts,'group-tunnel-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();child.kill();}

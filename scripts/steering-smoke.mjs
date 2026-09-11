import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.steering-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});
  await until('document.querySelectorAll(".driver-setting").length>0');
  await evaluate('localStorage.clear();location.reload()');
  await until('document.querySelectorAll(".driver-setting").length===2');
  await click('.driver-setting:last-child .remove-driver');
  await evaluate('(async()=>{const e=await import("./engine.js");for(let i=0;i<100;i++){const seed="RIGHT-UI-"+i,t=e.generateTrack(seed);if(t.start.dx===1){const input=document.querySelector("#seed");input.value=seed;input.dispatchEvent(new Event("change"));return;}}throw Error("No right-facing fixture");})()');
  await click('#setup-form button[type="submit"]');
  await evaluate('window.liveAngles=[];const ctx=document.querySelector("#track").getContext("2d"),rotate=ctx.rotate;ctx.rotate=function(angle){liveAngles.push(angle);return rotate.call(this,angle)};');
  await click('.destination[data-ax="0"][data-ay="1"]');
  await until('document.querySelector("#game").dataset.busy==="false"&&document.querySelector("#game").dataset.turns==="1"');
  const liveAngles=await evaluate('liveAngles');
  const intermediate=liveAngles.filter(angle=>angle>0&&angle<Math.PI/2);
  assert.ok(new Set(intermediate).size>=3,'Actual live input renders several intermediate steering angles.');
  assert.ok(Math.abs(liveAngles.at(-1)-Math.PI/2)<1e-9);
  await click('#replay-button');await click('#replay-toggle');
  const replayAngles=[];
  for(const t of [.75,.25,.5,0,1]){
    await evaluate('{liveAngles.length=0;const slider=document.querySelector("#replay-position");slider.value='+t+';slider.dispatchEvent(new Event("input"));}');
    const angle=await evaluate('liveAngles.at(-1)');
    assert.ok(Math.abs(angle-Math.PI/2*t*t*(3-2*t))<1e-9);replayAngles.push({t,angle});
  }
  // Force H.264 unavailable in a fresh module context, exercising real VP9/WebM.
  await evaluate('location.reload()');await until('document.querySelectorAll(".driver-setting").length>0');
  await evaluate('window.nativeVideoEncoder=VideoEncoder;VideoEncoder=class extends nativeVideoEncoder{static async isConfigSupported(config){return config.codec.startsWith("avc")?{supported:false,config}:nativeVideoEncoder.isConfigSupported(config)}}');
  await evaluate('(async()=>{const e=await import("./engine.js"),r=await import("./replay.js"),v=await import("./video-export.js");const race=e.createRace(e.generateTrack("WEBM"),[{}]),from=r.replayCar(race.cars[0]),rec=r.createReplay(race.cars,null),move=e.previewMove(race.track,from,{ax:1,ay:0},race.cars);const entry=e.takeTurn(race,{ax:1,ay:0});r.recordReplay(rec,1,from,race.cars[0],move,entry.type,null);window.webmDone=false;window.webmError=null;v.exportReplayVideo({race,recording:rec,themeId:"forest",seed:"WEBM",ambience:false,canvas:document.createElement("canvas")}).then(x=>{window.webmResult=x;webmDone=true}).catch(e=>webmError=e.message);})()');
  await until('webmDone||webmError');assert.equal(await evaluate('webmError'),null);
  const file=await evaluate('(async()=>{const {blob,filename}=webmResult,bytes=new Uint8Array(await blob.arrayBuffer());let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return {filename,type:blob.type,data:btoa(s)}})()');
  assert.equal(file.type,'video/webm');assert.ok(file.filename.endsWith('.webm'));
  const path=resolve(artifacts,file.filename);await writeFile(path,Buffer.from(file.data,'base64'));
  const {inspectVideo}=await import('./inspect-video.mjs');const webm=await inspectVideo(path,evaluate);
  assert.equal(webm.frames,195);assert.deepEqual(errors,[]);
  const result={intermediateAngles:new Set(intermediate).size,replayAngles,webm,errors};
  await writeFile(resolve(artifacts,'steering-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();child.kill();}

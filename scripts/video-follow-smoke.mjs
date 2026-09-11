import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.follow-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:resolve(artifacts,'video-downloads')});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});
  await until('document.querySelectorAll(".driver-setting").length>0');
  await evaluate('localStorage.clear();location.reload()');await until('document.querySelectorAll(".driver-setting").length===2');
  await evaluate('{let s=document.querySelectorAll(".driver-setting select")[0];s.value="ai";s.dispatchEvent(new Event("change"));s=document.querySelectorAll(".driver-setting select")[1];s.value="human";s.dispatchEvent(new Event("change"));}');
  await click('#setup-form button[type="submit"]');
  await until('document.querySelector("#game").dataset.turns==="1"&&document.querySelector("#game").dataset.busy==="false"');
  await click('#replay-button');await click('#replay-toggle');
  assert.equal(await evaluate('document.querySelector("#video-driver").value'),'1');
  await screenshot('video-follow-player.png');
  await click('#export-video');await until('document.querySelector("#video-progress").value>.1');
  assert.equal(await evaluate('document.querySelector("#video-preview").dataset.followedDriver'),'1');
  await until('!document.querySelector("#video-download").hidden');
  const filename=await evaluate('document.querySelector("#video-download").download');
  const {inspectVideo}=await import('./inspect-video.mjs');const video=await inspectVideo(resolve(artifacts,'video-downloads',filename),evaluate);
  assert.equal(video.fps,60);await click('#video-close');
  await until('!document.querySelector("#video-driver").disabled');
  await evaluate('{const s=document.querySelector("#video-driver");s.value="0";s.dispatchEvent(new Event("change"));}');
  assert.equal(await evaluate('document.querySelector("#winner-video-driver").value'),'0');
  await click('#export-video');await until('document.querySelector("#video-progress").value>.1');
  assert.equal(await evaluate('document.querySelector("#video-preview").dataset.followedDriver'),'0');
  await click('#video-close');await until('!document.querySelector("#video-dialog").open');
  await until('!document.querySelector("#video-driver").disabled');
  await evaluate('{const s=document.querySelector("#video-camera");s.value="all";s.dispatchEvent(new Event("change"));}');
  assert.equal(await evaluate('document.querySelector("#winner-video-camera").value'),'all');
  assert.equal(await evaluate('document.querySelector("#video-driver").disabled'),true);
  await click('#export-video');await until('document.querySelector("#video-progress").value>.1');
  assert.equal(await evaluate('document.querySelector("#video-preview").dataset.cameraMode'),'all');
  await click('#video-close');await until('!document.querySelector("#video-dialog").open');
  await until('!document.querySelector("#video-camera").disabled');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('video-follow-mobile.png');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await evaluate('{const s=document.querySelector("#video-camera");s.value="follow";s.dispatchEvent(new Event("change"));}');
  assert.equal(await evaluate('document.querySelector("#video-driver").value'),'0','Switching back preserves the individual choice.');
  await click('#replay-close');await click('#menu-button');await click('#new-race');
  assert.equal(await evaluate('document.querySelector("#video-driver").value'),'1','New race resets to the first human.');
  assert.equal(await evaluate('document.querySelector("#video-camera").value'),'follow');
  const completed=await evaluate('(async()=>{const e=await import("./engine.js"),r=await import("./replay.js"),v=await import("./video-export.js");const race=e.createRace(e.generateTrack("FOLLOW-FINISH",{length:"short"}),[{name:"Winner",control:"ai"},{name:"Player",control:"human"}]),rec=r.createReplay(race.cars,null);for(let n=0;n<500&&race.winner===null;n++){const car=race.cars[race.active],from=r.replayCar(car),round=race.round,choice=car.id===0?e.chooseAIMove(race):{ax:0,ay:0},move=e.previewMove(race.track,car,choice,race.cars),entry=e.takeTurn(race,choice);r.recordReplay(rec,round,from,car,move,entry.type,null);}const c=document.createElement("canvas"),seen=[];for(const id of [undefined,0,1,999]){const scene=v.createVideoScene({race,recording:rec,themeId:"forest",seed:"FOLLOW-FINISH",ambience:false,canvas:c,followedDriverId:id});for(const t of [0,1.2,scene.duration]){scene.draw(t);seen.push({id:id??"default",t,followed:c.dataset.followedDriver});}scene.dispose();}return {winner:race.winner,seen};})()');
  assert.equal(completed.winner,0);for(const s of completed.seen)assert.equal(s.followed,s.id===0?'0':'1');
  const adaptive=await evaluate('(async()=>{const e=await import("./engine.js"),r=await import("./replay.js"),v=await import("./video-export.js");const race=e.createRace(e.generateTrack("CAMERA-ALL"),[{},{},{},{}]);race.cars.forEach((car,i)=>{const p=race.track.path[Math.floor(race.track.path.length*i/4)];car.x=p.x;car.y=p.y;});const rec=r.createReplay(race.cars,null),c=document.createElement("canvas"),scene=v.createVideoScene({race,recording:rec,seed:"CAMERA-ALL",themeId:"forest",ambience:false,cameraMode:"all",canvas:c});rec.duration=4;scene.draw(1.5);const z=+c.dataset.zoom,x=+c.dataset.cameraX,y=+c.dataset.cameraY,positions=race.cars.map(car=>({x:640+((car.x+.5)*32-x)*z,y:360+((car.y+.5)*32-y)*z})),frame=c.toDataURL();scene.dispose();return {positions,zoom:z,frame};})()');
  for(const p of adaptive.positions)assert.ok(p.x>32&&p.x<968&&p.y>100&&p.y<580);
  await writeFile(resolve(artifacts,'video-all-drivers.png'),Buffer.from(adaptive.frame.split(',')[1],'base64'));delete adaptive.frame;
  assert.deepEqual(errors,[]);const result={video,completed,adaptive,errors};await writeFile(resolve(artifacts,'video-follow-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();child.kill();}

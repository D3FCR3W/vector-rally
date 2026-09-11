import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.video-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Browser.setDownloadBehavior', {behavior:'allow',downloadPath:resolve(artifacts,'video-downloads')});
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate', {url:'http://127.0.0.1:4173'});
  await until('document.querySelectorAll(".driver-setting").length >= 1');
  await evaluate('localStorage.clear();location.reload()');
  await until('document.querySelectorAll(".driver-setting").length === 2');
  await click('.driver-setting:last-child .remove-driver');
  await click('#setup-form button[type="submit"]');
  await click('.destination[data-ax="1"][data-ay="0"]');
  await until('document.querySelector("#game").dataset.busy === "false" && document.querySelector("#game").dataset.turns === "1"');
  await click('#replay-button'); await click('#replay-toggle');
  await evaluate('document.querySelector("#replay-position").value="0.4";document.querySelector("#replay-position").dispatchEvent(new Event("input"));document.querySelector("#replay-speed").value="2";document.querySelector("#replay-speed").dispatchEvent(new Event("change"));');
  const snapshot = () => evaluate('JSON.stringify({game:document.querySelector("#game").dataset, camera:[document.querySelector("#track").dataset.cameraX,document.querySelector("#track").dataset.cameraY,document.querySelector("#track").dataset.zoom], replay:document.querySelector("#replay-panel").dataset})');
  const before = await snapshot();
  await evaluate(`window.exportEncoders=[];window.nativeEncoder=VideoEncoder;window.VideoEncoder=class extends nativeEncoder {constructor(...args){super(...args);exportEncoders.push(this)}configure(config){if(window.failVideoEncoder)throw new Error('Encoder unavailable for test');super.configure(config)}};`);
  await send('Emulation.setCPUThrottlingRate',{rate:4});
  await click('#export-video');
  await until('document.querySelector("#video-progress").value > 0.08');
  await screenshot('video-export-progress.png');
  await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));');
  await until('document.querySelector("#video-status").textContent.includes("paused")');
  const pausedAt = await evaluate('document.querySelector("#video-progress").value');
  await new Promise(r=>setTimeout(r,700));
  assert.equal(await evaluate('document.querySelector("#video-progress").value'),pausedAt,'Hidden tabs pause export.');
  assert.match(await evaluate('document.querySelector("#video-status").textContent'),/paused/);
  await evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"));');
  await until('!document.querySelector("#video-download").hidden');
  await send('Emulation.setCPUThrottlingRate',{rate:1});
  const file = await evaluate(`(async()=>{
    const link=document.querySelector('#video-download'), blob=await (await fetch(link.href)).blob();
    const video=document.createElement('video');video.muted=true;video.src=link.href;document.body.append(video);
    await new Promise((yes,no)=>{video.onloadedmetadata=yes;video.onerror=()=>no(new Error('Export does not decode'));});
    const metadata={filename:link.download,type:blob.type,size:blob.size,width:video.videoWidth,height:video.videoHeight,duration:video.duration};
    video.remove();return metadata;
  })()`);
  console.log('Decoded video: '+JSON.stringify(file));
  assert.equal(file.width,1280); assert.equal(file.height,720); assert.ok(file.size>10000);
  assert.ok(Math.abs(file.duration-3.25)<.001,'Exact duration despite CPU throttling and hidden-tab pause.');
  const {inspectVideo}=await import('./inspect-video.mjs');
  file.encoding=await inspectVideo(resolve(artifacts,'video-downloads',file.filename),evaluate);
  await writeFile(resolve(artifacts,'video-native-decoded-frame.png'),Buffer.from((await evaluate('nativeDecodedFrame')).split(',')[1],'base64'));
  assert.equal(file.encoding.frames,195);
  assert.ok(file.filename.endsWith(file.type.startsWith('video/mp4')?'.mp4':'.webm'));
  await writeFile(resolve(artifacts,'video-decoded-frame.png'),Buffer.from((await evaluate('nativeDecodedFrame')).split(',')[1],'base64'));
  await screenshot('video-export-ready.png');
  assert.equal(await evaluate('exportEncoders.every(e=>e.state==="closed")'),true,'Encoders are closed.');
  await click('#video-close'); await until('!document.querySelector("#video-dialog").open');
  assert.equal(await snapshot(),before,'Export preserves live state and paused replay position, speed and camera.');
  await click('#export-video'); await until('document.querySelector("#video-dialog").open'); await click('#video-close');
  await until('!document.querySelector("#video-dialog").open');
  assert.equal(await snapshot(),before,'Cancellation restores the replay.');
  assert.equal(await evaluate('exportEncoders.every(e=>e.state==="closed")'),true);
  await evaluate('window.failVideoEncoder=true');
  await click('#export-video'); await until('document.querySelector("#video-status").textContent.includes("Encoder unavailable")');
  assert.equal(await evaluate('document.querySelector("#video-download").hidden'),true);
  assert.equal(await evaluate('exportEncoders.every(e=>e.state==="closed")'),true,'Encoder failures release resources.');
  await click('#video-close'); await until('!document.querySelector("#video-dialog").open');
  assert.equal(await snapshot(),before);
  await evaluate('window.failVideoEncoder=false;window.savedEncoder=VideoEncoder;window.VideoEncoder=undefined;');
  await click('#export-video'); await until('document.querySelector("#video-status").textContent.includes("unavailable in this browser")');
  await click('#video-close'); await until('!document.querySelector("#video-dialog").open');
  await evaluate('window.VideoEncoder=savedEncoder;');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('#export-video'); await until('document.querySelector("#video-progress").value>0.05');
  await screenshot('mobile-video-export.png');
  assert.equal(await evaluate('(()=>{const r=document.querySelector("#video-dialog").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'),true);
  await click('#video-close'); await until('!document.querySelector("#video-dialog").open');
  // Exercise the winner entry with a complete, legitimate solo AI race.
  await click('#replay-close'); await click('#menu-button'); await click('#new-race');
  await evaluate('document.querySelector("#circuit-length").value="short";document.querySelector("#circuit-length").dispatchEvent(new Event("change"));document.querySelector(".driver-setting select").value="ai";document.querySelector(".driver-setting select").dispatchEvent(new Event("change"));');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('window.nativeTimeout=setTimeout;window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===600?0:ms,...args);');
  await click('#setup-form button[type="submit"]');
  for(let i=0;i<200;i++){if(await evaluate('!document.querySelector("#winner-banner").hidden'))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate('document.querySelector("#winner-banner").hidden'),false);
  await evaluate('window.setTimeout=nativeTimeout;');
  const finishBefore=await snapshot();
  await screenshot('video-winner-button.png');
  await click('#export-winner-video');
  for(let i=0;i<120;i++){if(await evaluate('!document.querySelector("#video-download").hidden'))break;await new Promise(r=>setTimeout(r,1000));}
  assert.equal(await evaluate('document.querySelector("#video-download").hidden'),false,'Completed race exports directly from the finish screen.');
  const fullRace=await evaluate('({filename:document.querySelector("#video-download").download,status:document.querySelector("#video-status").textContent})');
  // Browsers may require a fresh user gesture for subsequent downloads.
  await send('Runtime.evaluate',{expression:'document.querySelector("#video-download").click()',userGesture:true});
  fullRace.encoding=await inspectVideo(resolve(artifacts,'video-downloads',fullRace.filename),evaluate);
  await click('#video-close');await until('!document.querySelector("#video-dialog").open');
  assert.equal(await snapshot(),finishBefore,'Winner state is preserved.');
  // Capture an independent completed race fixture for the exported end card.
  const endCard = await evaluate(`(async()=>{
    const e=await import('./engine.js'),r=await import('./replay.js'),v=await import('./video-export.js');
    const track=e.generateTrack('VIDEO-FINISH',{length:'short'}),race=e.createRace(track,[{name:'Atlas',control:'ai'}]);
    const rec=r.createReplay(race.cars,null);
    for(let i=0;i<300&&race.winner===null;i++){const car=race.cars[race.active],from=r.replayCar(car),round=race.round,choice=e.chooseAIMove(race),move=e.previewMove(track,car,choice,race.cars);const entry=e.takeTurn(race,choice);r.recordReplay(rec,round,from,car,move,entry.type,null);}
    const initial=JSON.stringify({race,rec}),c=document.createElement('canvas');
    const scene=v.createVideoScene({race,recording:rec,themeId:'forest',seed:'VIDEO-FINISH',ambience:false,canvas:c});
    scene.draw(2);const acceleratedTime=Number(c.dataset.replayTime);
    scene.draw(1+rec.duration/8);const closeup=c.toDataURL(),carSize=Number(c.dataset.carSize);
    scene.draw(1+rec.duration/4);const finishTime=Number(c.dataset.replayTime);
    scene.draw(scene.duration);
    const result={winner:race.winner,frame:c.toDataURL(),closeup,carSize,acceleratedTime,finishTime,recordedDuration:rec.duration,exportDuration:scene.duration,unchanged:initial===JSON.stringify({race,rec})};scene.dispose();return result;
  })()`);
  assert.equal(endCard.winner,0);assert.equal(endCard.unchanged,true);
  assert.equal(endCard.acceleratedTime,4,'One second of video after the title advances four replay seconds.');
  assert.equal(endCard.finishTime,endCard.recordedDuration,'4× export reaches the exact recorded finish.');
  assert.equal(endCard.exportDuration,endCard.recordedDuration/4+3,'Only the race is accelerated; titles remain readable.');
  assert.ok(endCard.carSize>=50,'Close-up cars remain readable at 720p.');
  await writeFile(resolve(artifacts,'video-closeup-frame.png'),Buffer.from(endCard.closeup.split(',')[1],'base64'));
  await writeFile(resolve(artifacts,'video-winner-frame.png'),Buffer.from(endCard.frame.split(',')[1],'base64'));
  // Reduced motion remains enabled for the live UI. The exported shader must
  // still survive composition AND encoding; compare against effects-on/off renders.
  await evaluate(`(async()=>{
    const e=await import('./engine.js'),r=await import('./replay.js'),v=await import('./video-export.js');
    const track=e.generateTrack('VIDEO-EFFECTS'),race=e.createRace(track,[{name:'Nova',control:'human'}]);
    const from={...race.cars[0]},to={...from,x:from.x+5,vx:0,slowTurns:3,crashes:1,turns:1};
    const rec=r.createReplay([from],null);r.recordReplay(rec,1,from,to,{vx:5,vy:0,crash:true,contact:{x:from.x+5.1,y:from.y}},'crash',null);race.cars=[to];
    const c=document.createElement('canvas'),options={race,recording:rec,themeId:'future',seed:'VIDEO-EFFECTS',ambience:false,canvas:c};
    window.effectReference={};
    for(const reduced of [true,false]){const scene=v.createVideoScene({...options,reduced});scene.draw(1.2);effectReference[reduced?'off':'on']=c.getContext('2d').getImageData(0,0,1280,720).data;effectReference.renderer=c.dataset.effectRenderer;scene.dispose();}
    window.effectsExportDone=false;window.effectsExportError=null;
    v.exportReplayVideo({...options,reduced:true}).then(async result=>{window.effectsBlob=result.blob;const a=document.createElement('a');a.href=URL.createObjectURL(result.blob);a.download=result.filename;a.click();window.effectsFilename=result.filename;effectsExportDone=true;}).catch(error=>effectsExportError=error.message);
  })()`);
  await until('effectsExportDone||effectsExportError');assert.equal(await evaluate('effectsExportError'),null);
  const effectsFile=await evaluate('effectsFilename');
  const effectsBytes=await evaluate('(async()=>{const bytes=new Uint8Array(await effectsBlob.arrayBuffer());let text="";for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text)})()');
  await writeFile(resolve(artifacts,'video-downloads',effectsFile),Buffer.from(effectsBytes,'base64'));
  const effectsEncoding=await inspectVideo(resolve(artifacts,'video-downloads',effectsFile),evaluate,1.2);
  const effectPixels=await evaluate(`(()=>{let count=0,onError=0,offError=0;const a=effectReference.on,b=effectReference.off,d=nativeDecodedPixels;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])<60)continue;count++;for(let c=0;c<3;c++){onError+=Math.abs(d[i+c]-a[i+c]);offError+=Math.abs(d[i+c]-b[i+c]);}}return {count,onError: onError/count/3,offError:offError/count/3,renderer:effectReference.renderer}})()`);
  assert.equal(effectPixels.renderer,'webgl');assert.ok(effectPixels.count>300,'Shader contributes visible pixels to the frame.');
  assert.ok(effectPixels.onError<effectPixels.offError*.5,'Decoded video retains shader colors with reduced motion enabled in the live UI.');
  await writeFile(resolve(artifacts,'video-effects-60fps.png'),Buffer.from((await evaluate('nativeDecodedFrame')).split(',')[1],'base64'));
  await writeFile(resolve(artifacts,'video-effects-check.json'),JSON.stringify({effectsFile,effectsEncoding,effectPixels},null,2));
  assert.deepEqual(errors,[]);
  await writeFile(resolve(artifacts,'video-export-check.json'),JSON.stringify({file,fullRace,camera:{carSize:endCard.carSize},timing:{acceleratedTime:endCard.acceleratedTime,recordedDuration:endCard.recordedDuration,exportDuration:endCard.exportDuration},checks:['download-and-decode','720p','hidden-tab-pause','live-state-preserved','cancel','encoder-failure','unsupported-browser','encoder-cleanup','60fps-all-frames-decoded','slow-cpu-no-frame-loss','mobile-layout','winner-card','full-race-export-from-winner','close-up-camera','4x-speed','exact-finish'],errors},null,2));
  console.log('Video export browser checks passed: '+JSON.stringify(file));
} finally { ws?.close();child.kill(); }

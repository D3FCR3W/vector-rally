import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.wildlife-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});
  await until('document.querySelector("#game")!==null');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('(async()=>{const e=await import("./engine.js"),r=await import("./replay.js"),t=await import("./themes.js"),v=await import("./video-export.js");const race=e.createRace(e.generateTrack("WILDLIFE-VIDEO"),[{name:"Still car",control:"human"}]);const scenery=t.createScenery(race.track,"forest"),recording=r.createReplay(race.cars,scenery);for(let i=0;i<8;i++){const from=r.replayCar(race.cars[0]),move=e.previewMove(race.track,from,{ax:0,ay:0},race.cars),entry=e.takeTurn(race,{ax:0,ay:0});r.recordReplay(recording,i+1,from,race.cars[0],move,entry.type,scenery);}const before=JSON.stringify({race,recording});const options={race,recording,themeId:"forest",seed:"WILDLIFE-VIDEO",ambience:true,canvas:document.createElement("canvas")};window.wildlifeRefs=[];const scene=v.createVideoScene(options);for(const time of [1.5,2.5]){scene.draw(time);wildlifeRefs.push(options.canvas.getContext("2d").getImageData(0,0,1280,720).data)}scene.draw(2.5);const first=options.canvas.toDataURL();scene.draw(1.5);scene.draw(2.5);window.seekStable=options.canvas.toDataURL()===first;scene.dispose();window.wildlifeDone=false;window.wildlifeError=null;v.exportReplayVideo(options).then(result=>{window.wildlifeBlob=result.blob;window.wildlifeUnchanged=before===JSON.stringify({race,recording});wildlifeDone=true}).catch(e=>wildlifeError=e.message);})()');
  await until('wildlifeDone||wildlifeError');assert.equal(await evaluate('wildlifeError'),null);
  const base64=await evaluate('(async()=>{const data=new Uint8Array(await wildlifeBlob.arrayBuffer());let text="";for(let i=0;i<data.length;i+=8192)text+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(text)})()');
  const file=resolve(artifacts,'wildlife-stationary-car-60fps.mp4');await writeFile(file,Buffer.from(base64,'base64'));
  const {inspectVideo}=await import('./inspect-video.mjs');
  const checks=[];
  for(const [index,time] of [1.5,2.5].entries()){
    const encoding=await inspectVideo(file,evaluate,time);
    const motion=await evaluate('(()=>{const own=wildlifeRefs['+index+'],other=wildlifeRefs['+(1-index)+'],decoded=nativeDecodedPixels;let pixels=0,ownError=0,otherError=0;for(let y=66;y<620;y++)for(let x=0;x<1280;x++){const i=(y*1280+x)*4;if(Math.abs(own[i]-other[i])+Math.abs(own[i+1]-other[i+1])+Math.abs(own[i+2]-other[i+2])<60)continue;pixels++;for(let c=0;c<3;c++){ownError+=Math.abs(decoded[i+c]-own[i+c]);otherError+=Math.abs(decoded[i+c]-other[i+c]);}}return {pixels,ownError:ownError/pixels/3,otherError:otherError/pixels/3}})()');
    assert.ok(motion.pixels>100,'Wildlife visibly changes while car and camera remain fixed.');
    assert.ok(motion.ownError<motion.otherError*.5,'The encoded frame contains the correct animated wildlife pose.');
    await writeFile(resolve(artifacts,'wildlife-decoded-'+index+'.png'),Buffer.from((await evaluate('nativeDecodedFrame')).split(',')[1],'base64'));
    checks.push({time,encoding,motion});
  }
  const unchanged=await evaluate('wildlifeUnchanged'),seekStable=await evaluate('seekStable');
  assert.equal(unchanged,true);assert.equal(seekStable,true);assert.deepEqual(errors,[]);
  const report={checks,unchanged,seekStable,errors};await writeFile(resolve(artifacts,'wildlife-video-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{ws?.close();child.kill();}

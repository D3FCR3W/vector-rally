import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  const until = async expression => { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`UI timeout: ${expression}`); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(resolve(artifacts, name), Buffer.from(data, 'base64')); };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:1440,height:900,deviceScaleFactor:1,mobile:false });
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});
  await until('document.querySelectorAll(".driver-setting").length > 0');
  const result = await evaluate(`(async()=>{
    const {generateTrack,createRace}=await import('/engine.js');
    const {createRenderer}=await import('/render.js');
    const {createReplay,recordReplay,sampleReplay}=await import('/replay.js');
    const canvas=document.createElement('canvas'),mini=document.createElement('canvas'),fx=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:1440px;height:900px';document.body.append(canvas,fx);
    mini.width=248;mini.height=168;
    const renderer=createRenderer(canvas,mini,fx);renderer.resize();
    const track=generateTrack('PERFORMANCE',{length:'long',turns:'technical'}),race=createRace(track,[{},{},{},{}]);
    renderer.setTrack(track,'forest');renderer.focus(race.cars[0],true);
    const rec=createReplay(race.cars,null);
    for(let round=1;round<=1000;round++)for(const car of race.cars)recordReplay(rec,round,car,{...car,x:car.x+2},null,'move',null);
    const measure=(fn,n=180)=>{for(let i=0;i<20;i++)fn(i);const times=[];for(let i=0;i<n;i++){const t=performance.now();fn(i);times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {medianMs:times[Math.floor(n*.5)],p95Ms:times[Math.floor(n*.95)]};};
    const replay=measure(i=>sampleReplay(rec,500+i/180));
    const draw=measure(()=>renderer.draw(race,{started:true}));
    const intervals=[];let last=0;await new Promise(resolve=>{function frame(t){if(last)intervals.push(t-last);last=t;renderer.draw(race,{started:true});if(intervals.length<90)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    const fps=1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length);
    canvas.remove();fx.remove();return {draw,replay,fps,viewport:'1440x900',track:'long/technical',historyEvents:4000};
  })()`);
  console.log(JSON.stringify(result,null,2));
  await writeFile(resolve(artifacts,process.env.PERF_LABEL || 'performance.json'),JSON.stringify(result,null,2)+'\n');
  assert.deepEqual(errors,[]);
} finally { ws?.close(); child.kill(); }

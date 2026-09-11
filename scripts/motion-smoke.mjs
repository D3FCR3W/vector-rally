import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.motion-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  ws.onmessage=async event=>{originalOnMessage(event);const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;const {requestId}=message.params;try{const response=await send('Fetch.getResponseBody',{requestId});const code=response.base64Encoded?Buffer.from(response.body,'base64').toString():response.body;await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(code+'\nwindow.hazardTest={get race(){return race},get recording(){return recording},render,renderer,performMove,refreshWildlifeTargets,get animation(){return animation}};').toString('base64')});}catch(error){errors.push(error.message);}};
  await send('Fetch.enable',{patterns:[{urlPattern:'*/app.js',requestStage:'Response'}]});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:resolve(artifacts,'video-downloads')});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});await until('!!window.hazardTest');
  await evaluate('localStorage.clear();location.reload()');await until('!!window.hazardTest');

  await click('#setup-form .start-button');
  const diagnosis=await evaluate(`(async()=>{
    const h=hazardTest,{previewMove}=await import('/engine.js');
    const button=[...document.querySelectorAll('.destination')].find(b=>!b.disabled&&!previewMove(h.race.track,h.race.cars[0],{ax:+b.dataset.ax,ay:+b.dataset.ay},h.race.cars,new Set()).crash);
    const original=h.renderer.wildlife,states=[];
    for(let i=0;i<8;i++){h.renderer.wildlife=()=>new Set(['-100,'+i]);h.refreshWildlifeTargets();states.push(button.classList.contains('danger'));}
    const landing=button.dataset.x+','+button.dataset.y;
    h.renderer.wildlife=()=>new Set([landing]);h.refreshWildlifeTargets();const occupied=button.classList.contains('danger');
    h.renderer.wildlife=()=>new Set();h.refreshWildlifeTargets();const cleared=button.classList.contains('danger');
    h.renderer.wildlife=original;
    return {states,occupied,cleared};
  })()`);
  assert.deepEqual(diagnosis.states,Array(8).fill(false));assert.equal(diagnosis.occupied,true);assert.equal(diagnosis.cleared,false);
  // Keep the real pointer over a landing while scenery and previews redraw.
  const point=await evaluate('(()=>{const b=document.querySelector(".destination:not(:disabled)"),r=b.getBoundingClientRect();window.originalTarget=b;return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  const hover=await evaluate(`new Promise(resolve=>{const initial={...hazardTest.renderer.camera};let count=0;const tick=()=>{if(++count<60)return requestAnimationFrame(tick);resolve({same:originalTarget===document.querySelector('.destination:not(:disabled)'),initial,final:{...hazardTest.renderer.camera}})};requestAnimationFrame(tick)})`);
  assert.equal(hover.same,true);assert.deepEqual(hover.final,hover.initial);
  const moves=[];
  for(let i=0;i<6;i++){
    await until('!hazardTest.animation&&!document.querySelector("#destinations").hidden');
    const move=await evaluate(`(async()=>{
      const h=hazardTest,{chooseAIMove}=await import('/engine.js');const a=chooseAIMove(h.race);
      const b=[...document.querySelectorAll('.destination')].find(b=>+b.dataset.ax===a.ax&&+b.dataset.ay===a.ay);
      const before={...h.renderer.camera};b.click();const after={...h.renderer.camera},samples=[];
      await new Promise(resolve=>{let start;const tick=t=>{start??=t;const c=h.renderer.camera,pad=h.renderer.controls(h.race.cars[h.race.active]),el=document.querySelector('#destinations');samples.push({t,x:c.x,y:c.y,zoom:c.zoom,anchor:document.querySelector('#game').dataset.humanAnchor,alignment:el.hidden?0:Math.hypot(parseFloat(el.style.left)-pad.x,parseFloat(el.style.top)-pad.y)});if(t-start<1400)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)});
      return {before,after,samples};
    })()`);
    assert.deepEqual(move.after,move.before,'click must not snap the camera');
    assert.ok(move.samples.every(s=>s.anchor==='0'),'AI must not steal camera');
    assert.ok(move.samples.every(s=>s.alignment<.01),'landing grid must track the camera');
    const steps=move.samples.slice(1).map((s,j)=>{const p=move.samples[j];return {dt:s.t-p.t,pixels:Math.hypot(s.x-p.x,s.y-p.y)*Math.max(s.zoom,p.zoom),zoom:Math.abs(Math.log(s.zoom/p.zoom))}});
    assert.ok(steps.filter(s=>s.dt<40).every(s=>s.pixels<30&&s.zoom<.06),'camera must remain continuous across turn boundaries');
    moves.push({frames:move.samples.length,maxPixels:Math.max(...steps.map(s=>s.pixels)),maxZoom:Math.max(...steps.map(s=>s.zoom)),fps:1000*steps.length/steps.reduce((n,s)=>n+s.dt,0)});
  }
  // Follow must settle even when scenery is switched off, and manual pan stays put.
  await evaluate('document.querySelector("#ambience").checked=false;document.querySelector("#ambience").dispatchEvent(new Event("change"))');
  await click('#overview');await click('#focus-car');
  await evaluate('new Promise(r=>setTimeout(r,1700))');
  const settled=await evaluate('({camera:{...hazardTest.renderer.camera},pad:hazardTest.renderer.controls(hazardTest.race.cars[0]),left:parseFloat(document.querySelector("#destinations").style.left)})');assert.ok(Math.abs(settled.pad.x-settled.left)<.01);
  await click('#zoom-out');
  const manual=await evaluate('({...hazardTest.renderer.camera})');await evaluate('new Promise(r=>setTimeout(r,250))');assert.deepEqual(await evaluate('({...hazardTest.renderer.camera})'),manual);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await click('#focus-car');await evaluate('new Promise(r=>setTimeout(r,1700))');
  await screenshot('motion-mobile.png');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.deepEqual(errors,[]);const result={diagnosis,hover,moves,errors};await writeFile(resolve(artifacts,'motion-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();child.kill();}



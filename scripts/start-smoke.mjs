import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the installed Edge browser and Node's native WebSocket; no dependencies.
const browser = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const child = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${resolve('.start-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
  const samples=await evaluate('(async()=>{const e=await import("./engine.js"),found=new Map();for(let i=0;i<80&&found.size<4;i++){const seed="NEW-START-"+i,t=e.generateTrack(seed);const direction=t.start.dx+","+t.start.dy;if(!found.has(direction))found.set(direction,{seed,start:t.start,cars:e.createRace(t,[{},{},{},{}]).cars.map(c=>({x:c.x,y:c.y,heading:c.heading}))});}return [...found.values()]})()');
  assert.equal(samples.length,4);
  await click('#add-driver');await click('#add-driver');
  await evaluate('document.querySelectorAll(".driver-setting select").forEach(el=>{el.value="human";el.dispatchEvent(new Event("change"))});');
  if(await evaluate('document.querySelector("#ambience").checked'))await click('#ambience');
  for(const [index,sample] of samples.entries()){
    const {dx,dy}=sample.start;
    await evaluate('{const seed=document.querySelector("#seed");seed.value='+JSON.stringify(sample.seed)+';seed.dispatchEvent(new Event("change"))}');
    await click('#setup-form button[type="submit"]');
    assert.match(await evaluate('document.querySelector("#announcement").textContent'),new RegExp(dx===1?'right':dx===-1?'left':dy===1?'down':'up'));
    await screenshot('start-'+index+'.png');
    for(let car=0;car<4;car++){
      const selector='.destination[data-ax="'+dx+'"][data-ay="'+dy+'"]';
      assert.equal(await evaluate('document.querySelector('+JSON.stringify(selector)+').disabled'),false);
      const dest=await evaluate('({...document.querySelector('+JSON.stringify(selector)+').dataset})');
      assert.equal(Number(dest.x),sample.cars[car].x+dx);assert.equal(Number(dest.y),sample.cars[car].y+dy);
      await click(selector);
      await until('document.querySelector("#game").dataset.busy==="false"&&document.querySelector("#game").dataset.turns==="'+(car+1)+'"');
    }
    await click('#replay-button');await click('#replay-toggle');
    await evaluate('{const p=document.querySelector("#replay-position");p.value="0.5";p.dispatchEvent(new Event("input"))}');
    assert.equal(await evaluate('document.querySelector("#replay-panel").dataset.time'),'0.5000');
    await click('#replay-close');await click('#menu-button');await click('#new-race');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('#setup-form button[type="submit"]');await screenshot('start-mobile.png');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  // Contact sheet uses the actual circuit renderer, with the start marked on each overview.
  const sheet=await evaluate('(async()=>{const e=await import("./engine.js"),r=await import("./render.js"),seeds='+JSON.stringify(samples.map(s=>s.seed))+';const out=document.createElement("canvas");out.width=1280;out.height=1040;const ctx=out.getContext("2d");ctx.fillStyle="#19282b";ctx.fillRect(0,0,out.width,out.height);for(let i=0;i<seeds.length;i++){const t=e.generateTrack(seeds[i]),race=e.createRace(t,[{},{},{},{}]),c=document.createElement("canvas"),m=document.createElement("canvas"),fx=document.createElement("canvas");m.width=248;m.height=168;const renderer=r.createRenderer(c,m,fx);renderer.resize({width:616,height:456});renderer.setTrack(t,"forest");renderer.fit();renderer.draw(race,{started:true,ambience:false,time:0});const x=12+(i%2)*640,y=44+Math.floor(i/2)*520;ctx.drawImage(c,x,y);const p=renderer.screen((t.start.x+.5)*r.CELL,(t.start.y+.5)*r.CELL);ctx.strokeStyle="#ffd172";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+p.x,y+p.y,12,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#ffd172";ctx.font="bold 20px monospace";ctx.fillText(seeds[i]+"  "+(t.start.dx===1?"RIGHT":t.start.dx===-1?"LEFT":t.start.dy===1?"DOWN":"UP"),x,y-14);renderer.dispose()}return out.toDataURL()})()');
  await writeFile(resolve(artifacts,'varied-starts.png'),Buffer.from(sheet.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);await writeFile(resolve(artifacts,'start-check.json'),JSON.stringify({samples,checks:['four-cardinal-directions','four-level-drivers','correct-heading-announcement','four-human-launches','replay','mobile-layout'],errors},null,2));console.log(JSON.stringify({samples:samples.map(s=>({seed:s.seed,start:s.start})),errors}));
}finally{ws?.close();child.kill();}

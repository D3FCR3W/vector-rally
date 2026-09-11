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

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173'});
  await until('document.querySelectorAll(".driver-setting").length>0');
  // Verify the real input path starts effects even with wildlife disabled.
  assert.equal(await evaluate('document.querySelectorAll(".theme-option").length'),7);
  const worldPreviews = new Set();
  for (const world of ['jungle','sky','sea','space']) {
    await click('[data-theme="'+world+'"]');
    assert.equal(await evaluate('document.querySelector("#track").dataset.theme'),world);
    worldPreviews.add(await evaluate('document.querySelector("#course-preview").toDataURL()'));
  }
  assert.equal(worldPreviews.size,4,'Each new world has distinct terrain artwork.');
  await screenshot('seven-worlds-setup.png');
  await click('#setup-form button[type="submit"]');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("vector-rally-settings")).themeId'),'space');
  await evaluate('location.reload()');await until('document.querySelectorAll(".theme-option").length===7');
  assert.equal(await evaluate('document.querySelector("#track").dataset.theme'),'space');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await screenshot('seven-worlds-mobile.png');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await click('[data-theme="future"]');
  assert.equal(await evaluate('document.querySelector("#neon-setting").hidden'),false);
  await evaluate('{const e=document.querySelector("#neon-trails");e.value="purple";e.dispatchEvent(new Event("change"));}');
  await click('#setup-form button[type="submit"]');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("vector-rally-settings")).trailStyle'),'purple');
  await evaluate('location.reload()');await until('document.querySelectorAll(".driver-setting").length>0');
  assert.equal(await evaluate('document.querySelector("#neon-trails").value'),'purple');
  await click('[data-theme="forest"]');
  assert.equal(await evaluate('document.querySelector("#neon-setting").hidden'),true);
  await click('#ambience');await click('#setup-form button[type="submit"]');
  await click('.destination[data-ax="1"][data-ay="0"]');
  await until('Number(document.querySelector("#effects").dataset.particles)>0');
  assert.equal(await evaluate('Number(document.querySelector("#effects").dataset.marks)'),0,'Road acceleration emits smoke without drawing a persistent path.');
  await click('#help-button');
  const frozen=await evaluate('document.querySelector("#effects").dataset.particles');
  await evaluate('new Promise(r=>setTimeout(r,150))');
  assert.equal(await evaluate('document.querySelector("#effects").dataset.particles'),frozen);
  await click('#got-it'); await until('document.querySelector("#game").dataset.busy==="false"');
  await click('#replay-button'); await click('#replay-toggle');
  assert.equal(await evaluate('document.querySelector("#replay-paths").checked'),false);
  const seek = value => evaluate(`{const e=document.querySelector('#replay-position');e.value=${value};e.dispatchEvent(new Event('input'));}`);
  await seek(.85);
  const withoutPaths = await evaluate('document.querySelector("#track").toDataURL()');
  await click('#replay-paths');
  assert.equal(await evaluate('document.querySelector("#track").dataset.pathsVisible'),'true');
  const withPaths = await evaluate('document.querySelector("#track").toDataURL()');
  assert.notEqual(withPaths,withoutPaths,'The replay checkbox draws a visible route.');
  await seek(.2); await seek(.85);
  assert.equal(await evaluate('document.querySelector("#track").toDataURL()'),withPaths,'Rewinding rebuilds exactly the travelled path.');
  await screenshot('replay-driven-paths.png');
  await click('#replay-paths');
  assert.equal(await evaluate('document.querySelector("#track").toDataURL()'),withoutPaths);
  await click('#replay-paths'); await click('#replay-close');
  assert.equal(await evaluate('document.querySelector("#track").dataset.pathsVisible'),'false','Driven paths never leak into live play.');

  // A deterministic visible fixture exercises crash timing, grass tracks and GPU fallback.
  await evaluate(`(async()=>{
    const {generateTrack,createRace}=await import('/engine.js');
    const {createRenderer}=await import('/render.js');
    const {createReplay,recordReplay}=await import('/replay.js');
    document.querySelector('#help-dialog').close();document.querySelector('#game').style.display='none';
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;background:#17282b';document.body.append(host);
    const canvas=document.createElement('canvas'),fx=document.createElement('canvas'),mini=document.createElement('canvas');
    canvas.style.cssText=fx.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    mini.width=248;mini.height=168;host.append(canvas,fx);
    const renderer=createRenderer(canvas,mini,fx);renderer.resize();
    const track=generateTrack('CIRCUIT-A',{turns:'technical'}),race=createRace(track,[{}]);
    let clock=0;
    const setup=(theme,grass=false)=>{
      renderer.setTrack(track,theme);const c=race.cars[0];
      let from={...c,x:track.start.x,y:track.start.y,vx:0,vy:0,slowTurns:0,trail:[]};
      let to={...from,x:from.x+5,vx:5},move={vx:5,vy:0,crash:true,contact:{x:from.x+5.1,y:from.y}};
      if(grass){const route=track.shortcuts[0];from={...from,x:route.from.x,y:route.from.y};to={...from,x:route.to.x,y:route.to.y,vx:route.to.x-route.from.x,vy:route.to.y-route.from.y};move={vx:to.vx,vy:to.vy};}
      race.cars[0]={...to,heading:Math.atan2(to.y-from.y,to.x-from.x),trail:[]};
      renderer.focus({...to,x:(from.x+to.x)/2,y:(from.y+to.y)/2,vx:0,vy:0},true);
      renderer.camera.zoom=Math.min(2.8,1000/(Math.hypot(to.x-from.x,to.y-from.y)*32+120));
      const recording=createReplay([from],null);recordReplay(recording,1,from,to,move,grass?'move':'crash',null);
      window.fxFixture={canvas,fx,renderer,track,race,recording,from,to,move,setup,clock:0};
      renderer.draw(race,{time:0,ambience:false});
      renderer.beginEffects(from,to,move,{duration:1000});
    };
    setup('forest');
    window.fxPaint=time=>{
      const f=window.fxFixture;
      while(f.clock<time){f.clock=Math.min(time,f.clock+50);f.renderer.draw(f.race,{time:f.clock,ambience:false});}
      const gl=f.fx.getContext('webgl');
      let visible=0,error=0;
      if(gl&&!gl.isContextLost()){const pixels=new Uint8Array(f.fx.width*f.fx.height*4);gl.readPixels(0,0,f.fx.width,f.fx.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;error=gl.getError();}
      return {mode:f.fx.dataset.renderer,particles:Number(f.fx.dataset.particles),marks:Number(f.fx.dataset.marks),visible,error};
    };
  })()`);
  const impact=await evaluate('fxPaint(850)');
  assert.ok(impact.particles>0);assert.equal(impact.marks,0,'A road crash leaves no drawn path.');
  if(impact.mode==='webgl'){assert.ok(impact.visible>100,'Compiled shader writes visible smoke and sparks.');assert.equal(impact.error,0);}
  await screenshot('effects-crash.png');
  await evaluate('fxFixture.setup("forest",true)');
  const grass=await evaluate('fxPaint(600)');assert.ok(grass.marks>0);assert.ok(grass.particles>0);
  await screenshot('effects-grass.png');
  await evaluate('fxFixture.setup("sand",true);fxPaint(600)');await screenshot('effects-sand.png');
  await evaluate('fxFixture.setup("future");fxPaint(850)');await screenshot('effects-future.png');
  await evaluate('fxFixture.setup("future",true);fxFixture.renderer.setTrailStyle("mixed");fxPaint(750)');await screenshot('effects-neon-mixed.png');
  await evaluate('fxFixture.renderer.setTrailStyle("purple");fxPaint(800)');await screenshot('effects-neon-purple.png');
  await evaluate('fxFixture.setup("future");fxPaint(850)');
  for(const world of ['jungle','sky','sea','space']){
    await evaluate('fxFixture.setup('+JSON.stringify(world)+')');
    const hit=await evaluate('fxPaint(850)');assert.ok(hit.particles>0);assert.equal(hit.marks,0);assert.equal(hit.error,0);
    await screenshot('effects-'+world+'-crash.png');
    await evaluate('fxFixture.setup('+JSON.stringify(world)+',true)');
    const trail=await evaluate('fxPaint(750)');assert.ok(trail.marks>0);assert.ok(trail.particles>0);assert.equal(trail.error,0);
    await screenshot('effects-'+world+'-trail.png');
  }
  await evaluate('fxFixture.setup("future");fxPaint(850)');
  await evaluate('fxFixture.renderer.draw(fxFixture.race,{time:900,ambience:false,replay:{time:0,scenery:null},recording:fxFixture.recording})');
  assert.equal(await evaluate('fxFixture.fx.dataset.marks'),'0','Rewinding removes future tire marks.');
  await evaluate('fxFixture.renderer.draw(fxFixture.race,{time:950,ambience:false,replay:{time:.85,scenery:null},recording:fxFixture.recording,reduced:true})');
  assert.equal(await evaluate('fxFixture.fx.dataset.particles'),'0','Reduced motion suppresses dynamic particles.');
  const hasLoss=await evaluate('(()=>{const gl=fxFixture.fx.getContext("webgl"),ext=gl?.getExtension("WEBGL_lose_context");if(ext){window.fxLoss=ext;ext.loseContext();return true;}return false;})()');
  if(hasLoss){
    await until('fxFixture.fx.dataset.renderer==="canvas"');
    await evaluate('fxFixture.renderer.draw(fxFixture.race,{time:1000,ambience:false,replay:{time:.85,scenery:null},recording:fxFixture.recording})');
    assert.ok(await evaluate('Number(fxFixture.fx.dataset.particles)')>0);
    await screenshot('effects-canvas-fallback.png');
    await evaluate('fxLoss.restoreContext()');await until('fxFixture.fx.dataset.renderer==="webgl"');
  }
  const active=await evaluate(`new Promise(resolve=>{
    const costs=[],intervals=[];let previous=0;
    function frame(t){
      if(previous)intervals.push(t-previous);previous=t;
      const f=fxFixture,start=performance.now();
      f.renderer.draw(f.race,{time:t,ambience:false,replay:{time:.85,scenery:null},recording:f.recording});
      costs.push(performance.now()-start);
      if(costs.length<90)requestAnimationFrame(frame);else{costs.sort((a,b)=>a-b);resolve({medianMs:costs[45],p95Ms:costs[85],fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),particles:Number(f.fx.dataset.particles)});}
    }requestAnimationFrame(frame);
  })`);
  await writeFile(resolve(artifacts,'effects-performance.json'),JSON.stringify({impact,grass,active},null,2)+'\n');
  assert.deepEqual(errors,[]);
  console.log('Effects browser checks passed: seven worlds, custom crashes and hidden trails, saved choices, mobile setup, live input, replay paths, rewind, reduced motion, context loss and restoration.');
  console.log(JSON.stringify({impact,grass,active},null,2));
} finally { ws?.close();child.kill(); }

import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTrack,createRace,takeTurn,takeAITurns,chooseAIMove,previewMove,key} from '../public/engine.js';
import {humanAnchor,cameraDrivers,groupCamera,livePose,stepCamera} from '../public/race-view.js';
import {tunnelExposure} from '../public/mountains.js';

test('AI pass matches ordered turns, records each once and stops before the next human',()=>{
 const r=createRace(generateTrack('AI-PASS'),[{control:'human'},...Array.from({length:3},()=>({control:'ai'}))]);takeTurn(r);
 const baseline=structuredClone(r);const expected=[];for(let i=0;i<3;i++){expected.push(baseline.active);takeTurn(baseline,chooseAIMove(baseline));}
 const turns=takeAITurns(r);assert.deepEqual(turns.map(t=>t.id),expected);assert.deepEqual(r,baseline);assert.equal(r.active,0);assert.equal(turns.length,3);
 assert.deepEqual(turns.map(t=>t.round),[1,1,1]);assert.equal(r.cars[0].turns,1);
});
test('mixed human seats divide AI passes and all-AI races are bounded to one turn per car',()=>{
 const r=createRace(generateTrack('AI-SEATS'),[{control:'ai'},{control:'human'},{control:'ai'},{control:'human'}]);assert.equal(takeAITurns(r).length,1);assert.equal(r.active,1);assert.equal(takeAITurns(r).length,0);
 const all=createRace(generateTrack('AI-ALL'),Array.from({length:4},()=>({control:'ai'})));assert.equal(takeAITurns(all).length,4);assert.equal(all.round,2);assert.ok(all.cars.every(c=>c.turns===1));
 all.ended=true;assert.equal(takeAITurns(all).length,0);
});
test('automatic follow retains the human during AI turns and hands over only to another human',()=>{
 const cars=[{id:0,control:'human'},{id:1,control:'ai'},{id:2,control:'human'}];assert.equal(humanAnchor(cars,1,0).id,0);assert.equal(humanAnchor(cars,2,0).id,2);assert.equal(humanAnchor([{id:0,control:'ai'}],0),undefined);
});
test('nearby rivals means adjacent race positions, and custom groups can include AI',()=>{
 const cars=[{id:0,progress:20},{id:1,progress:55},{id:2,progress:15},{id:3,progress:30}];
 assert.deepEqual(cameraDrivers(cars,0,'nearby').map(c=>c.id),[3,0,2]);assert.deepEqual(cameraDrivers(cars,1,'nearby').map(c=>c.id),[1,3]);
 assert.deepEqual(cameraDrivers(cars,0,'selected',[1,2]).map(c=>c.id),[1,2]);assert.equal(cameraDrivers(cars,undefined,'human').length,4);
 cars[3].wrecked=true;assert.deepEqual(cameraDrivers(cars,0,'nearby').map(c=>c.id),[1,0,2]);
});
test('group framing fits separated racers and reachable human cells above the HUD',()=>{
 for(const [w,h]of [[1440,900],[390,844],[844,390]]){
 const cars=[{id:0,x:2,y:3,vx:8,vy:-2},{id:1,x:95,y:72,vx:0,vy:0}],cam=groupCamera(cars,w,h,cars[0]);
 for(const c of cars){const x=((c.x+.5)*32-cam.x)*cam.zoom+w/2,y=((c.y+.5)*32-cam.y)*cam.zoom+h/2;assert.ok(x>0&&x<w);assert.ok(y>90&&y<h-100);}
 }
});

test('camera damps position and zoom without snapping or overshooting at 30, 60 and 120 Hz',()=>{
 const target={x:320,y:-160,zoom:.7},samples=[];
 for(const fps of [30,60,120]){
   const camera={x:0,y:0,zoom:1.5},velocity={};
   assert.equal(stepCamera(camera,target,velocity,0),true);
   assert.deepEqual(camera,{x:0,y:0,zoom:1.5});
   for(let i=0;i<fps/2;i++){
     const previous={...camera};stepCamera(camera,target,velocity,1/fps);
     assert.ok(camera.x>=previous.x&&camera.x<target.x);
     assert.ok(camera.y<=previous.y&&camera.y>target.y);
     assert.ok(camera.zoom<=previous.zoom&&camera.zoom>=target.zoom);
   }
   samples.push({...camera});
   for(let i=0;i<fps*2;i++)stepCamera(camera,target,velocity,1/fps);
   assert.deepEqual(camera,target);assert.equal(stepCamera(camera,target,velocity,1/fps),false);
 }
 for(const sample of samples)for(const key of ['x','y','zoom'])assert.ok(Math.abs(sample[key]-samples[0][key])<1e-8);
});

test('a camera retarget preserves its position and velocity until the next frame',()=>{
 const camera={x:0,y:0,zoom:1.5},velocity={};
 stepCamera(camera,{x:100,y:60,zoom:1},velocity,1/60);
 const before={...camera},speed={...velocity};
 stepCamera(camera,{x:-100,y:-60,zoom:2},velocity,0);
 assert.deepEqual(camera,before);assert.deepEqual(velocity,speed);
 const resumed={...camera},v={...velocity};
 stepCamera(camera,{x:-100,y:-60,zoom:2},velocity,10);
 stepCamera(resumed,{x:-100,y:-60,zoom:2},v,.05);
 assert.deepEqual(camera,resumed);
});
test('one animation clock moves every AI pose together and retains full oil rotations',()=>{
 const from={x:0,y:0,heading:0},car={x:4,y:0,heading:Math.PI*3};const motion={from,start:100,duration:400,move:{spin:Math.PI*3}};
 assert.equal(livePose(car,motion,100).x,0);assert.equal(livePose(car,motion,300).x,3);assert.equal(livePose(car,motion,300).renderHeading,Math.PI*1.5);assert.equal(livePose(car,motion,500).x,4);
});
test('mountains conceal only drivable shortcut cells and preserve open paths, pits and seeded geometry',()=>{
 for(let i=0;i<18;i++){
 const t=generateTrack('MOUNTAIN-'+i),again=generateTrack('MOUNTAIN-'+i);assert.deepEqual(t.tunnels,again.tunnels);assert.deepEqual(t.mountains,again.mountains);assert.ok(t.mountains.size>0);
 for(const tunnel of t.tunnels){assert.ok(tunnel.cells.length);for(const k of tunnel.cells){assert.ok(t.hidden.has(k)&&t.road.has(k));assert.ok(!t.pit.has(k));const p=t.cells.get(k);assert.equal(previewMove(t,{id:0,...p,vx:0,vy:0},{ax:0,ay:0}).crash,false);}
 const p=t.cells.get(tunnel.cells[Math.floor(tunnel.cells.length/2)]);assert.equal(tunnelExposure(t,tunnel,[p]),1);assert.equal(tunnelExposure(t,tunnel,[]),0);assert.equal(tunnelExposure(t,tunnel,[t.start]),0);
 }
 assert.ok([...t.hidden].some(k=>!t.tunnelCells.has(k))||!t.hidden.size);
 for(const k of t.mountains)assert.ok(!t.road.has(k)||t.tunnelCells.has(k));
 }
 const off=generateTrack('MOUNTAIN-OFF',{shortcuts:false});assert.equal(off.tunnels.length,0);assert.ok(off.mountains.size>0);
});

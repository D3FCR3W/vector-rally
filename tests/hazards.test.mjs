import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,previewMove,takeTurn,generateTrack,chooseAIMove,key,progressDelta} from '../public/engine.js';
import {createReplay,replayCar,recordReplay,sampleReplay} from '../public/replay.js';

function race(drivers=[{}]){
 const road=new Set(),cells=new Map();for(let y=0;y<18;y++)for(let x=0;x<90;x++){road.add(key(x,y));cells.set(key(x,y),{x,y,s:x,distance:0});}
 return createRace({road,cells,holes:new Set(),ramps:new Map(),oil:new Map(),spikes:new Map(),pit:new Set(),width:90,height:18,length:180,path:[],start:{x:5,y:7,dx:1,dy:0,minLane:-3,maxLane:3}},drivers);
}
test('potholes damage parts without a crash, braking, or a temporary penalty',()=>{
 const r=race(),c=r.cars[0];c.vx=3;r.track.holes.add('7,7');const before={...c.health};
 takeTurn(r);assert.equal(c.x,8);assert.equal(c.vx,3);assert.equal(c.slowTurns,0);assert.equal(c.crashes,0);
 assert.deepEqual(c.health,{...before,tires:before.tires-1,body:before.body-1});
});
test('oil applies to the next three personal turns, locks momentum and ends facing backwards',()=>{
 const r=race(),c=r.cars[0];c.vx=2;r.track.oil.set('6,7',{x:6,y:7});takeTurn(r);assert.equal(c.oilTurns,3);
 const start=c.x,heading=c.heading;
 for(let n=3;n>0;n--){assert.equal(previewMove(r.track,c,{ax:-1,ay:0}).blocked,true);assert.deepEqual(chooseAIMove(r),{ax:0,ay:0});takeTurn(r);assert.equal(c.oilTurns,n-1);assert.equal(c.vx,2);}
 assert.equal(c.x,start+6);assert.ok(Math.abs(Math.cos(c.heading-heading)+1)<1e-9);
 assert.equal(previewMove(r.track,c,{ax:-1,ay:0}).blocked,false);
});
test('police spikes deploy after round one and allow only braking for three turns',()=>{
 const r=race(),c=r.cars[0];r.track.spikes.set('6,7',{x:6,y:7});c.vx=2;
 assert.equal(previewMove(r.track,c,{ax:0,ay:0}).roadEffects.length,0);
 r.track.hazardRound=2;takeTurn(r);assert.equal(c.punctureTurns,3);assert.equal(c.health.tires,c.maxHealth.tires-2);
 assert.equal(previewMove(r.track,c,{ax:0,ay:0}).blocked,true);
 assert.equal(previewMove(r.track,c,{ax:-1,ay:1}).blocked,true);
 takeTurn(r,{ax:-1,ay:0});assert.equal(c.vx,1);takeTurn(r,{ax:-1,ay:0});assert.equal(c.vx,0);takeTurn(r);assert.equal(c.punctureTurns,0);
 assert.equal(previewMove(r.track,c,{ax:1,ay:1}).blocked,false);
});
test('penalties count personal turns; oil takes priority over puncture braking',()=>{
 const r=race([{},{}]),a=r.cars[0],b=r.cars[1];a.oilTurns=3;a.punctureTurns=3;a.vx=1;
 takeTurn(r);assert.equal(a.oilTurns,2);takeTurn(r);assert.equal(a.oilTurns,2);assert.equal(b.turns,1);
 assert.equal(a.punctureTurns,2);assert.equal(previewMove(r.track,a,{ax:0,ay:0}).blocked,false);
});
test('hard impacts damage the moving car and leave oil; mild bumps do not',()=>{
 for(const speed of [1,4]){const r=race(),c=r.cars[0];c.vx=speed;r.track.road.delete('6,7');takeTurn(r);
 assert.equal(c.crashes,1);assert.equal(c.health.body,c.maxHealth.body-(speed===1?1:2));assert.equal(c.health.engine,c.maxHealth.engine-(speed===1?0:1));assert.equal(r.track.oil.size,speed===1?0:1);}
});
test('crossing the service cell repairs every part and clears penalties without stopping',()=>{
 const r=race(),c=r.cars[0];c.vx=2;c.oilTurns=2;c.punctureTurns=2;c.slowTurns=2;c.health={tires:2,engine:1,body:2};r.track.serviceCell='6,7';
 takeTurn(r);assert.deepEqual(c.health,c.maxHealth);assert.equal(c.x,7);assert.equal(c.vx,2);assert.equal(c.oilTurns+c.punctureTurns+c.slowTurns,0);
});
test('fatal damage retires the car before a later repair, skips it, and can end without a winner',()=>{
 const r=race([{},{}]),a=r.cars[0];a.health.tires=1;a.vx=3;r.track.holes.add('6,7');r.track.serviceCell='7,7';
 takeTurn(r);assert.equal(a.wrecked,true);assert.equal(a.x,6);assert.equal(r.active,1);assert.equal(r.ended,false);
 const b=r.cars[1];b.health.body=1;b.vx=1;r.track.holes.add(key(b.x+1,b.y));takeTurn(r);
 assert.equal(r.ended,true);assert.equal(r.winner,null);assert.throws(()=>takeTurn(r),/finished/);
});
test('jumping over oil, spikes and a hole avoids their damage and maluses',()=>{
 const r=race(),c=r.cars[0];r.track.hazardRound=2;c.vx=4;r.track.ramps.set('6,7',{x:6,y:7,dx:1,dy:0});r.track.holes.add('7,7');r.track.oil.set('7,7',{x:7,y:7});r.track.spikes.set('7,7',{x:7,y:7});
 takeTurn(r);assert.equal(c.jumps,1);assert.deepEqual(c.health,c.maxHealth);assert.equal(c.punctureTurns+c.oilTurns,0);
});
test('every generated repair lane is a one-cell connected detour with local progress',()=>{
 for(let i=0;i<36;i++){
 const t=generateTrack('FACILITY-'+i,{length:['short','medium','long'][i%3],turns:['gentle','balanced','technical'][Math.floor(i/3)%3],width:['narrow','standard','wide','mixed'][i%4]});
 assert.ok(t.pit.size>=9);assert.ok(t.spikes.size>0);assert.ok(t.pit.has(t.serviceCell));
 let gain=0;for(let j=1;j<t.pitRoute.length;j++){const a=t.pitRoute[j-1],b=t.pitRoute[j];assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1);gain+=progressDelta(t,a,b);const car={id:0,...a,vx:0,vy:0};assert.equal(previewMove(t,car,{ax:b.x-a.x,ay:b.y-a.y}).crash,false);}
 assert.ok(gain>0&&gain<25);
 for(const k of t.pit){const p=t.cells.get(k);assert.equal([[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>t.road.has(key(p.x+dx,p.y+dy))).length,2);}
 }
});
test('replay deep-copies health and oil, reproduces spins, and hides future spills when seeking back',()=>{
 const r=race(),c=r.cars[0],rec=createReplay(r.cars,null);c.vx=4;r.track.road.delete('8,7');
 let from=replayCar(c);takeTurn(r);recordReplay(rec,1,from,c,r.lastMove,'crash',null);
 assert.equal(sampleReplay(rec,0).oil.length,0);assert.equal(sampleReplay(rec,1).oil.length,1);
 c.health.body=1;assert.notEqual(sampleReplay(rec,1).cars[0].health.body,1);
 c.oilTurns=3;c.vx=0;from=replayCar(c);takeTurn(r);recordReplay(rec,2,from,c,r.lastMove,'move',null);
 const mid=sampleReplay(rec,1.5).cars[0];assert.ok(Math.abs(mid.renderHeading-from.heading-Math.PI*1.5)<1e-9);
 assert.deepEqual(sampleReplay(rec,1.5),sampleReplay(rec,1.5));assert.equal(sampleReplay(rec,0).oil.length,0);
});

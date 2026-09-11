import test from 'node:test';
import assert from 'node:assert/strict';
import { moveEffects, sampleEffects, neonColor, EFFECT_LIMITS } from '../public/effects.js';
import { THEMES } from '../public/themes.js';
const track = { hidden: new Set(['2,0','3,0']) };
const from = { id:0, x:0,y:0,vx:0,vy:0,color:'#ff8855' }, to = {...from,x:4,vx:4};

test('tire marks reveal only travelled ground and distinguish hidden grass routes', () => {
  const event=moveEffects(track,from,to,{vx:4,vy:0},0,1);
  assert.equal(sampleEffects([event],0).marks.length,0);
  const half=sampleEffects([event],.5), end=sampleEffects([event],1);
  assert.ok(half.marks.every(m=>m.x<=2));
  assert.ok(end.marks.some(m=>m.dirt));assert.ok(end.marks.some(m=>!m.dirt));
  assert.equal(moveEffects(track,from,to,{jumps:1}).marks.length,0,'Airborne tires leave no tracks.');
  assert.equal(moveEffects({hidden:new Set()},{...from,vx:4},to,{vx:4,vy:0}).marks.length,0,'Steady road coasting does not burn tires.');
});

test('crash sparks begin at contact and effects rewind and pause deterministically', () => {
  const event=moveEffects(track,from,{...to,x:3},{crash:true,contact:{x:3.1,y:0},vx:4,vy:0});
  assert.ok(sampleEffects([event],.74).particles.every(p=>p.kind!==1));
  const impact=sampleEffects([event],.8);
  assert.ok(impact.particles.some(p=>p.kind===1));assert.ok(impact.particles.some(p=>p.kind===2));
  sampleEffects([event],1.5);
  assert.deepEqual(sampleEffects([event],.8),impact);
  assert.equal(sampleEffects([event],3).particles.length,0);
  assert.ok(sampleEffects([event],3).marks.length>0,'Tire marks persist after particles fade.');
});

test('effects respect reduced motion and bound particles and persistent marks', () => {
  const event=moveEffects(track,from,{...to,x:80},{crash:true,vx:80,vy:0});
  const events=Array.from({length:1000},()=>event), sample=sampleEffects(events,.85);
  assert.ok(sample.particles.length<=EFFECT_LIMITS.particles);
  assert.ok(sample.marks.length<=EFFECT_LIMITS.marks);
  assert.equal(sampleEffects(events,.85,'forest',true).particles.length,0);
  assert.ok(sampleEffects(events,.85,'forest',true).marks.length>0);
  assert.ok(sample.particles.every(p=>[p.x,p.y,p.size,p.alpha].every(Number.isFinite)));
});

test('cosmetic effects never change cars, collision surfaces or progress', () => {
  const before=structuredClone({track,from,to});
  for(const theme of ['forest','sand','future'])sampleEffects([moveEffects(track,from,to,{vx:4,vy:0})],.5,theme);
  assert.deepEqual({track,from,to},before);
});

test('tire burn requires acceleration or sharp-turn friction, never ordinary braking or coasting', () => {
  const road={hidden:new Set()}, driving={...from,vx:3,vy:1};
  assert.equal(moveEffects(road,driving,{...to,x:3,y:1,vx:3,vy:1}).marks.length,0);
  assert.equal(moveEffects(road,driving,{...to,x:3,y:0,vx:3,vy:0}).marks.length,0,'A gentle turn while slowing produces no burn.');
  assert.equal(moveEffects(road,{...from,vx:3},{...to,x:2,vx:2}).marks.length,0,'Straight braking produces no burn.');
  assert.ok(moveEffects(road,{...from,vx:2},{...to,x:1,y:1,vx:1,vy:1}).marks.length>0,'A tight turn produces friction.');
  assert.ok(moveEffects(road,{...from,vx:2},{...to,x:3,vx:3}).marks.length>0);
  const crash=moveEffects(road,{...from,vx:3},{...to,x:2,vx:0},{crash:true,vx:3,vy:0,contact:{x:2.1,y:0}});
  assert.equal(crash.marks.length,0,'A coasting crash does not invent tire burn before impact.');
  assert.ok(sampleEffects([crash],.8).particles.length>0,'Impact effects still occur.');
});

test('hidden paths leave surface effects while futuristic trails honor selected neon colors', () => {
  const event=moveEffects(track,{...from,x:2,vx:1},{...to,x:3,vx:1});
  assert.ok(event.marks.every(m=>m.dirt));
  for(const style of ['green','purple','yellow']){
    const frame=sampleEffects([event],.5,'future',false,style);
    assert.ok(frame.particles.length>0);
    assert.ok(frame.particles.every(p=>p.kind===1),'Neon paths glow instead of emitting brown dust.');
    assert.ok(frame.particles.every(p=>JSON.stringify(p.color)===JSON.stringify(neonColor({x:0,y:0},style).rgb)));
  }
  assert.equal(new Set([0,4,8].map(x=>neonColor({x,y:0}).hex)).size,3);
  for(const theme of ['forest','sand'])assert.ok(sampleEffects([event],.5,theme).particles.some(p=>p.kind===2));
});
test('every world has distinct deterministic crash and hidden-path effects independent of wall-clock time', () => {
  const signatures=new Set();
  for(const theme of THEMES){
    const move={crash:true,contact:{x:3.1,y:0},vx:4,vy:0};
    const event=moveEffects(track,from,to,move,0,1), later=moveEffects(track,from,to,move,16,1);
    const sample=sampleEffects([event],.875,theme.id);
    const repeated=sampleEffects([later],16.875,theme.id).particles;
    assert.equal(repeated.length,sample.particles.length);
    for(let i=0;i<repeated.length;i++){
      assert.deepEqual(repeated[i].color,sample.particles[i].color);
      for(const field of ['x','y','size','alpha','seed','kind'])assert.ok(Math.abs(repeated[i][field]-sample.particles[i][field])<1e-9,'Same action, same particle pattern within floating-point precision.');
    }
    sampleEffects([event],1.1,theme.id);assert.deepEqual(sampleEffects([event],.875,theme.id),sample);
    signatures.add(JSON.stringify(sample.particles));
    assert.ok(sample.particles.length>0&&sample.particles.length<=EFFECT_LIMITS.particles);
    assert.equal(sampleEffects([event],.875,theme.id,true).particles.length,0);
    assert.ok(theme.effects.trail);
  }
  assert.equal(signatures.size,7);
});

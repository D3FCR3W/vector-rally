import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplay, recordReplay, sampleReplay, advanceReplay, crashPose, interpolateHeading } from '../public/replay.js';
import { createScenery, sampleScenery } from '../public/themes.js';
import { generateTrack } from '../public/engine.js';
const car = (id, y) => ({ id, name:'Driver '+id, control:'human',color:'#fff',x:0,y,vx:0,vy:0,heading:0,slowTurns:0,progress:0,checkpoint:0,crashes:0,jumps:0,turns:0 });

test('round replay animates wildlife clocks, phases and positions on a paused car', () => {
  const c = car(0, 0), initial = createScenery(generateTrack('REPLAY-WILDLIFE'), 'forest');
  const from = sampleScenery(initial, 4), to = sampleScenery(initial, 6), rec = createReplay([c], from);
  recordReplay(rec, 1, c, c, null, 'move', to);
  const before = structuredClone(rec);
  for (const t of [.75, .25, .5]) {
    const scene = sampleReplay(rec, t).scenery, expected = sampleScenery(initial, 4 + 2 * t);
    assert.equal(scene.elapsed, expected.elapsed);
    assert.ok(Math.abs(scene.actors[0].elapsed - expected.actors[0].elapsed) < 1e-9);
    assert.ok(Math.abs(scene.actors[0].x - expected.actors[0].x) < 1e-9);
  }
  assert.deepEqual(rec, before);
});

test('steering turns gradually along the shortest arc, including across ±180 degrees', () => {
  const from = 170 * Math.PI / 180, to = -170 * Math.PI / 180;
  const values = [0, .25, .5, .75, 1].map(t => interpolateHeading(from, to, t));
  assert.ok(values.every((v, i) => !i || v > values[i - 1]));
  assert.ok(Math.abs(values[2] - Math.PI) < 1e-12);
  assert.ok(Math.abs(values[4] - values[0] - 20 * Math.PI / 180) < 1e-12);
  assert.equal(interpolateHeading(0, Math.PI / 2, -1), 0);
  assert.equal(interpolateHeading(0, Math.PI / 2, 2), Math.PI / 2);
});

test('replay steering remains visible throughout translation and is independent of seek order', () => {
  const from = car(0, 0), to = { ...from, x: 2, y: 2, vx: 2, vy: 2, heading: Math.PI / 4 };
  const rec = createReplay([from], null);
  recordReplay(rec, 1, from, to, { vx: 2, vy: 2 }, 'move', null);
  for (const t of [.75, .25, .5, 0, .99]) {
    const pose = sampleReplay(rec, t).cars[0];
    assert.equal(pose.renderHeading, interpolateHeading(0, Math.PI / 4, t));
    assert.equal(pose.x, 2 * t); assert.equal(pose.y, 2 * t);
    if (t > 0) assert.ok(pose.renderHeading > 0 && pose.renderHeading < Math.PI / 4);
  }
  assert.equal(sampleReplay(rec, 1).cars[0].heading, Math.PI / 4);
});
test('replay interpolates all drivers together by round and scrubs exactly to recorded endpoints', () => {
  const cars=[car(0,0),car(1,1)], rec=createReplay(cars,null), before=structuredClone(cars);
  recordReplay(rec,1,cars[0],{...cars[0],x:4,vx:4,progress:4},null,'move',null);
  recordReplay(rec,1,cars[1],{...cars[1],x:2,vx:2,progress:2},null,'move',null);
  const middle=sampleReplay(rec,.5);
  assert.deepEqual(middle.cars.map(c=>c.x),[2,1]);
  assert.deepEqual(sampleReplay(rec,1).cars.map(c=>c.x),[4,2]);
  assert.deepEqual(sampleReplay(rec,0).cars.map(c=>c.x),[0,0]);
  assert.deepEqual(cars,before,'Replaying never changes the live cars.');
  assert.equal(rec.duration,1);
});
test('full recording retains every turn, including crashes, jumps and recovery', () => {
  const c=car(0,0),rec=createReplay([c],null);
  let from=c;
  for(let round=1;round<=130;round++){
    const to={...from,x:round,heading:Math.PI/4};
    recordReplay(rec,round,from,to,{jumps:round===2?1:0},'move',null); from=to;
  }
  assert.equal(rec.events.length,130);
  assert.equal(sampleReplay(rec,130).cars[0].x,130);
  assert.ok(sampleReplay(rec,1.5).cars[0].renderLift>0);
  recordReplay(rec,131,from,{...from,vx:0,slowTurns:3},null,'crash',null);
  assert.equal(sampleReplay(rec,131).cars[0].x,130);
  assert.equal(sampleReplay(rec,131).cars[0].slowTurns,3);
  recordReplay(rec,132,{...from,slowTurns:3},{...from,slowTurns:2},null,'recovery',null);
  assert.equal(sampleReplay(rec,132).cars[0].slowTurns,2);
});
test('playback advances by elapsed time and selected speed, clamps seeking and ends exactly', () => {
  assert.equal(advanceReplay(1,1/60,2,5),1+1/30);
  assert.equal(advanceReplay(4.9,.2,4,5),5);
  assert.equal(advanceReplay(1,-2,1,5),1);
  const rec=createReplay([car(0,0)],null);
  assert.equal(sampleReplay(rec,-5).time,0); assert.equal(sampleReplay(rec,Infinity).time,0);
});


test('a crash translates to contact before stopping, in live animation and replay', () => {
  const from = car(0, 0), to = { ...from, x: 4, slowTurns: 3 }, contact = { x: 4.1, y: 0 };
  assert.equal(crashPose(from, to, contact, 0).x, 0);
  assert.ok(crashPose(from, to, contact, .5).x > 2);
  assert.equal(crashPose(from, to, contact, .75).x, 4.1);
  assert.equal(crashPose(from, to, contact, 1).x, 4);
  const rec = createReplay([from], null);
  recordReplay(rec, 1, from, to, { contact }, 'crash', null);
  assert.ok(sampleReplay(rec, .5).cars[0].x > 2);
  assert.equal(sampleReplay(rec, 1).cars[0].x, 4);
});
test('indexed replay seeks across a long race and refreshes when more turns are recorded', () => {
  let from=car(0,0);const rec=createReplay([from],null);
  for(let round=1;round<=1000;round++){
    const to={...from,x:round,progress:round};recordReplay(rec,round,from,to,null,'move',null);from=to;
  }
  for(const time of [999.5,1.25,678.75,0,1000,32.5])assert.equal(sampleReplay(rec,time).cars[0].x,time);
  recordReplay(rec,1001,from,{...from,x:1001},null,'move',null);
  assert.equal(sampleReplay(rec,1000.5).cars[0].x,1000.5);
  assert.ok(sampleReplay(rec,1001).cars[0].trail.length<=24);
});

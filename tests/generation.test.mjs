import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTrack, validateTrack, createRace, previewMove, key, startPoint, takeTurn, progressDelta } from '../public/engine.js';
import { createScenery, wildlifeCells } from '../public/themes.js';

test('starts vary around the circuit but keep four level, obstacle-free launch lanes', () => {
  const directions = new Set(), positions = new Set(), lengths = new Set();
  for (let i = 0; i < 96; i++) {
    const track = generateTrack('ORGANIC-' + i, {length:['short','medium','long'][i%3],turns:['gentle','balanced','technical'][Math.floor(i/3)%3],width:['narrow','standard','wide','mixed'][i%4]});
    const {dx,dy}=track.start, race=createRace(track,[{},{},{},{}]);
    directions.add(key(dx,dy)); positions.add(key(track.start.x,track.start.y));
    const straight=Math.hypot(track.vertices[1].x-track.vertices[0].x,track.vertices[1].y-track.vertices[0].y);lengths.add(straight);
    assert.equal(Math.abs(dx)+Math.abs(dy),1,'Starts are cardinal, never diagonal.');
    assert.ok(straight<Math.min(track.width,track.height)*.4,'A short grid replaces the long fixed corridor.');
    assert.equal(new Set(race.cars.map(c=>track.cells.get(key(c.x,c.y)).s)).size,1,'No lane begins farther along the lap.');
    const wildlife=wildlifeCells(createScenery(track,'forest'));
    for(const car of race.cars){
      assert.equal(Math.abs((car.x-track.start.x)*dx+(car.y-track.start.y)*dy),0);
      assert.equal(car.heading,Math.atan2(dy,dx));
      for(let step=0;step<=3;step++){
        const point={x:car.x+dx*step,y:car.y+dy*step},k=key(point.x,point.y);
        assert.ok(track.road.has(k)&&!track.holes.has(k)&&!track.ramps.has(k),'Every lane has the same clear first three cells.');
        assert.ok(!wildlife.has(k),'Initial wildlife must not obstruct a launch lane.');
      }
      const move=previewMove(track,{...car,vx:dx*2,vy:dy*2},{ax:dx,ay:dy},race.cars,wildlife);
      assert.equal(move.crash,false);
    }
    assert.ok(track.ramps.size>0,'A jump remains available away from the grid.');
    for(const ramp of track.ramps.values()){
      assert.ok(Math.hypot(ramp.x-track.start.x,ramp.y-track.start.y)>10);
      const car={id:0,x:ramp.x-ramp.dx,y:ramp.y-ramp.dy,vx:3*ramp.dx,vy:3*ramp.dy};
      const jump=previewMove(track,car,{ax:0,ay:0});
      assert.equal(jump.crash,false,'Relocated ramps have a clear approach and landing.');
      assert.equal(jump.jumps,1);assert.ok(progressDelta(track,car,jump)>0,'Ramp follows the race direction.');
    }
  }
  assert.equal(directions.size,4);assert.ok(positions.size>70);assert.ok(lengths.size>3);
});

test('finish crossing follows the starting direction on every side of the circuit', () => {
  const covered=new Set();
  for(let i=0;i<40&&covered.size<4;i++){
    const track=generateTrack('FINISH-SIDE-'+i),{dx,dy}=track.start;
    if(covered.has(key(dx,dy)))continue;covered.add(key(dx,dy));
    const race=createRace(track,[{}]),car=race.cars[0];
    Object.assign(car,startPoint(track,1),{vx:-2*dx,vy:-2*dy,checkpoint:3,progress:track.length+10});
    takeTurn(race,{ax:0,ay:0});assert.equal(race.winner,null,'Reverse crossing cannot win.');
    Object.assign(car,startPoint(track),{vx:dx,vy:dy,checkpoint:3,progress:track.length});
    takeTurn(race,{ax:0,ay:0});assert.equal(race.winner,0,'Clockwise full-lap crossing wins in this direction.');
  }
  assert.equal(covered.size,4);
});

test('all circuit length, corner and width combinations support a connected four-car start', () => {
  for (const length of ['short','medium','long']) for (const turns of ['gentle','balanced','technical']) for (const width of ['narrow','standard','wide','mixed']) {
    for (const seed of ['BUILD-1','BUILD-2']) {
      const track = generateTrack(seed, { length, turns, width });
      assert.equal(validateTrack(track,4),true,[seed,length,turns,width].join('/'));
      const race=createRace(track,[{},{},{},{}]);
      for(const car of race.cars) assert.equal(previewMove(track,car,{ax:track.start.dx,ay:track.start.dy},race.cars).crash,false);
    }
  }
});

test('seeds change the silhouette and settings control length, turns and width reproducibly', () => {
  const base=generateTrack('CIRCUIT-A'),same=generateTrack('CIRCUIT-A');
  assert.deepEqual([...base.road],[...same.road]);
  assert.deepEqual(base.shortcuts,same.shortcuts);
  const other=generateTrack('CIRCUIT-B');
  const intersection=[...base.road].filter(k=>other.road.has(k)).length;
  assert.ok(intersection / new Set([...base.road,...other.road]).size < .8,'Different seeds visibly change road placement.');
  assert.ok(generateTrack('OPTIONS',{length:'long'}).length > generateTrack('OPTIONS',{length:'short'}).length * 1.3);
  assert.ok(generateTrack('OPTIONS',{turns:'technical'}).vertices.length > generateTrack('OPTIONS',{turns:'gentle'}).vertices.length * 1.5);
  const narrow=generateTrack('OPTIONS',{width:'narrow',shortcuts:false}),wide=generateTrack('OPTIONS',{width:'wide',shortcuts:false});
  assert.ok(wide.road.size > narrow.road.size * 1.5);
  const mixed=generateTrack('OPTIONS',{width:'mixed'});
  assert.ok(new Set([...mixed.cells.values()].filter(c=>mixed.road.has(key(c.x,c.y))).map(c=>Math.round(c.roadRadius))).size >= 3);
});

test('hidden shortcuts are optional, connected, traversable and earn only their local route progress', () => {
  for (const seed of ['CIRCUIT-A','CIRCUIT-B','OPTIONS']) {
    const t=generateTrack(seed,{turns:'technical'});
    assert.ok(t.shortcuts.length >= 1,seed);
    assert.ok(t.hidden.size > 0);
    assert.equal(generateTrack(seed,{turns:'technical',shortcuts:false}).hidden.size,0);
    for(const route of t.shortcuts){
      assert.ok(route.saving>0);
      const car={id:0,x:Math.round(route.from.x),y:Math.round(route.from.y),vx:Math.round(route.to.x)-Math.round(route.from.x),vy:Math.round(route.to.y)-Math.round(route.from.y)};
      const move=previewMove(t,car,{ax:0,ay:0});
      assert.equal(move.crash,false,seed+': shortcut must be physically usable');
      for(const k of route.cells){
        assert.ok(t.road.has(k));assert.ok(!t.holes.has(k));
        const c=t.cells.get(k);assert.ok(c.s>=route.from.s&&c.s<=route.to.s);
        assert.ok(Number.isFinite(c.distance),'AI must have finite navigation costs on hidden roads');
      }
    }
  }
});

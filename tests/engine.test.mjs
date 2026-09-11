import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTIONS, generateTrack, validateTrack, createRace, previewMove, traceCells, takeTurn, chooseAIMove, canBrakeSafely, key } from '../public/engine.js';

function flatTrack(width = 30, height = 15) {
  const road = new Set(), cells = new Map();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { road.add(key(x, y)); cells.set(key(x, y), { x, y, s: x, distance: Math.abs(y - 7) }); }
  return { width, height, road, cells, holes: new Set(), ramps: new Map(), length: 100, path: [], start: { x: 5, y: 7, minY: 4, maxY: 10 } };
}
const car = (overrides = {}) => ({ id: 0, x: 5, y: 7, vx: 0, vy: 0, slowTurns: 0, ...overrides });

test('momentum is accumulated; coasting, braking, reverse, and diagonal moves use the same equation', () => {
  const t = flatTrack();
  for (const a of DIRECTIONS) {
    const m = previewMove(t, car({ vx: 2, vy: 1 }), a);
    assert.equal(m.x, 7 + a.ax); assert.equal(m.y, 8 + a.ay);
    assert.equal(m.vx, 2 + a.ax); assert.equal(m.vy, 1 + a.ay); assert.equal(m.crash, false);
  }
  assert.equal(previewMove(t, car(), { ax: -1, ay: 0 }).x, 4);
  assert.throws(() => previewMove(t, car(), { ax: 0.5, ay: 0 }), RangeError);
  assert.throws(() => previewMove(t, car(), { ax: 2, ay: 0 }), RangeError);
});

test('wildlife crashes only a car that ends its turn on the occupied cell', () => {
  const t = flatTrack(), race = createRace(t, [{}, {}]), c = race.cars[0];
  c.vx = 3;
  race.wildlife = new Set(['7,7']);
  assert.equal(previewMove(t, c, { ax: 0, ay: 0 }, race.cars, race.wildlife).crash, false, 'Passing a grounded animal is safe.');
  race.wildlife.add('8,7');
  const other = structuredClone(race.cars[1]);
  const result = takeTurn(race, { ax: 0, ay: 0 });
  assert.equal(result.type, 'crash'); assert.equal(c.x, 7); assert.equal(c.y, 7);
  assert.equal(c.vx, 0); assert.equal(c.slowTurns, 3); assert.equal(c.progress, 2);
  assert.deepEqual(race.cars[1], other, 'Only the moving driver is stopped.');
  assert.ok(race.wildlife.has('8,7'), 'The animal is left in place.');
});

test('AI avoids wildlife at its landing cell and checks the same braking rule', () => {
  const t = flatTrack(), race = createRace(t, [{ control: 'ai' }]);
  race.cars[0].vx = 2;
  race.wildlife = new Set(['8,7']);
  const choice = chooseAIMove(race), move = previewMove(t, race.cars[0], choice, race.cars, race.wildlife);
  assert.equal(move.crash, false); assert.notEqual(key(move.x, move.y), '8,7');
  assert.equal(canBrakeSafely(t, car({ vx: 2 }), [], new Set(['6,7'])), false);
});

test('supercover includes both side cells at exact diagonal corner contact', () => {
  const cells = traceCells(5, 7, 1, 1);
  assert.deepEqual(cells.map(c => key(c.x, c.y)), ['5,7', '6,7', '5,8', '6,8']);
  const t = flatTrack(); t.road.delete('6,7');
  assert.equal(previewMove(t, car(), { ax: 1, ay: 1 }).reason, 'Track boundary');
});

test('a free destination cannot tunnel through boundaries or cars; holes record damage', () => {
  const t = flatTrack(), c = car({ vx: 4 });
  t.holes.add('7,7'); assert.equal(previewMove(t, c, { ax: 0, ay: 0 }).roadEffects[0].kind, 'hole');
  t.holes.clear(); t.road.delete('7,7'); assert.equal(previewMove(t, c, { ax: 0, ay: 0 }).reason, 'Track boundary');
  t.road.add('7,7'); assert.equal(previewMove(t, c, { ax: 0, ay: 0 }, [c, car({ id: 1, x: 7 })]).reason, 'Another car');
});

test('a ramp jumps exactly one cell, including a car, then requires a clear landing', () => {
  const t = flatTrack(), c = car({ vx: 4 });
  t.ramps.set('6,7', { x: 6, y: 7, dx: 1, dy: 0 }); t.holes.add('7,7');
  const other = car({ id: 1, x: 7 });
  const m = previewMove(t, c, { ax: 0, ay: 0 }, [c, other]);
  assert.equal(m.crash, false); assert.equal(m.jumps, 1); assert.deepEqual(m.airborne, ['7,7']); assert.equal(other.x, 7);
  assert.equal(previewMove(t, c, { ax: 0, ay: 0 }, [c, car({ id: 1, x: 8 })]).crash, true);
  t.holes.add('8,7'); assert.equal(previewMove(t, c, { ax: 0, ay: 0 }).roadEffects[0].kind, 'hole');
});

test('incomplete jumps and airborne boundary crossings crash; wrong-way ramps do not launch', () => {
  const t = flatTrack(); t.ramps.set('6,7', { x: 6, y: 7, dx: 1, dy: 0 });
  assert.equal(previewMove(t, car({ vx: 2 }), { ax: 0, ay: 0 }).reason, 'Not enough momentum to land');
  t.road.delete('7,7'); assert.equal(previewMove(t, car({ vx: 4 }), { ax: 0, ay: 0 }).reason, 'Track boundary');
  t.road.add('7,7'); t.holes.add('5,7');
  const reverse = previewMove(t, car({ x: 8, vx: -4 }), { ax: 0, ay: 0 });
  assert.equal(reverse.jumps, 0); assert.equal(reverse.roadEffects[0].kind, 'hole');
});

test('crashes advance to the last safe cell and never stop the other car', () => {
  const r = createRace(flatTrack(), [{ name: 'One' }, { name: 'Two' }]);
  Object.assign(r.cars[0], { vx: 2, progress: 12, checkpoint: 1 }); Object.assign(r.cars[1], { x: 7, y: 7, vx: 1 });
  const other = structuredClone(r.cars[1]); takeTurn(r, { ax: 1, ay: 0 });
  assert.equal(r.cars[0].x, 6); assert.equal(r.cars[0].progress, 13); assert.equal(r.cars[0].checkpoint, 1);
  assert.equal(r.cars[0].vx, 0); assert.equal(r.cars[0].slowTurns, 3); assert.deepEqual(r.cars[1], other);
});

test('every crash imposes three driving turns at grid speed one, with no skipped turns', () => {
  for (const speed of [1, 3, 20]) {
    const r = createRace(flatTrack(100), [{}]), c = r.cars[0];
    c.vx = speed; r.track.road.delete('6,7'); takeTurn(r);
    assert.equal(c.slowTurns, 3); assert.equal(c.x, 5);
    r.track.road.add('6,7');
    takeTurn(r, { ax: -1, ay: 0 });
    assert.equal(c.x, 4); assert.equal(c.slowTurns, 2);
    const before = structuredClone(r);
    assert.throws(() => takeTurn(r, { ax: -1, ay: 0 }), /Speed limited/);
    assert.deepEqual(r, before, 'An unavailable acceleration never consumes a turn.');
    takeTurn(r); assert.equal(c.x, 3); assert.equal(c.slowTurns, 1);
    takeTurn(r); assert.equal(c.x, 2); assert.equal(c.slowTurns, 0);
    takeTurn(r, { ax: 1, ay: 0 }); takeTurn(r, { ax: 1, ay: 0 }); takeTurn(r, { ax: 1, ay: 0 });
    assert.equal(c.vx, 2, 'Normal acceleration returns after exactly three driving turns.');
  }
});

test('clear road paths do not crash; a distant boundary stops the car near that boundary', () => {
  const r = createRace(flatTrack(20), [{}]), c = r.cars[0];
  c.vx = 10;
  assert.equal(previewMove(r.track, c, { ax: 0, ay: 0 }).crash, false);
  r.track.road.delete('12,7');
  const move = previewMove(r.track, c, { ax: 0, ay: 0 });
  assert.deepEqual(move.stop, { x: 11, y: 7 });
  assert.ok(move.contact.x > 11 && move.contact.x < 11.5);
  takeTurn(r); assert.equal(c.x, 11); assert.equal(c.slowTurns, 3);
});

test('AI drives during the speed restriction and never chooses a disabled acceleration', () => {
  const r = createRace(flatTrack(100), [{ control: 'ai' }]), c = r.cars[0];
  c.slowTurns = 3;
  for (let i = 0; i < 3; i++) {
    const a = chooseAIMove(r), m = previewMove(r.track, c, a, r.cars);
    assert.equal(m.blocked, false); assert.equal(m.crash, false);
    assert.ok(Math.max(Math.abs(m.vx), Math.abs(m.vy)) <= 1);
    takeTurn(r, a);
  }
  assert.ok(c.x > 5); assert.equal(c.slowTurns, 0);
});

test('generated tracks are deterministic, varied, connected, and provide a straight clear starting grid', () => {
  const a = generateTrack('REPLAY'), b = generateTrack('REPLAY');
  assert.deepEqual([...a.road], [...b.road]); assert.deepEqual([...a.holes], [...b.holes]); assert.deepEqual(a.start, b.start);
  assert.notDeepEqual([...a.road], [...generateTrack('DIFFERENT').road]);
  for (let i = 0; i < 40; i++) {
    const t = generateTrack(`TRACK-${i}`); assert.equal(validateTrack(t), true, `seed ${i}`);
    const r = createRace(t, [{}, {}, {}, {}]);
    assert.equal(new Set(r.cars.map(c => key(c.x, c.y))).size, 4);
    assert.ok(r.cars.every(c => (c.x - t.start.x) * t.start.dx + (c.y - t.start.y) * t.start.dy === 0 && c.vx === 0 && c.vy === 0));
    assert.ok(t.holes.size > 0 && t.ramps.size > 0);
    for (const c of r.cars) for (let d = -3; d <= 3; d++) { const k = key(c.x + d * t.start.dx, c.y + d * t.start.dy); assert.ok(t.road.has(k) && !t.holes.has(k)); }
  }
});

test('reversing over the start does not win; a legal full lap does; play ends at victory', () => {
  const r = createRace(generateTrack('FINISH'), [{}]), c = r.cars[0];
  const { dx, dy } = r.track.start;
  takeTurn(r, { ax: -dx, ay: -dy }); takeTurn(r, { ax: dx, ay: dy }); takeTurn(r, { ax: dx, ay: dy }); takeTurn(r, { ax: 0, ay: 0 });
  assert.equal(r.winner, null);
  Object.assign(c, { x: r.track.start.x, y: r.track.start.y, vx: dx, vy: dy, progress: r.track.length, checkpoint: 3 });
  takeTurn(r, { ax: 0, ay: 0 }); assert.equal(r.winner, 0);
  assert.throws(() => takeTurn(r), /finished/);
});

test('AI rejects wall-bounce shortcuts and retains a safe stopping route', () => {
  const r = createRace(flatTrack(12), [{ control: 'ai' }]); Object.assign(r.cars[0], { x: 9, vx: 2 });
  const a = chooseAIMove(r), move = previewMove(r.track, r.cars[0], a, r.cars);
  assert.equal(move.crash, false); assert.equal(canBrakeSafely(r.track, { ...r.cars[0], ...move }, r.cars), true);
  assert.equal(a.ax, -1);
});

test('AI finishes seeded races without using crashes as a strategy', { timeout: 60000 }, () => {
  for (const seed of ['RALLY-2026', 'PAPER', 'FRIENDS']) {
    const r = createRace(generateTrack(seed), [{ name: 'Atlas', control: 'ai' }]);
    for (let turn = 0; turn < 250 && r.winner === null; turn++) takeTurn(r, chooseAIMove(r));
    assert.equal(r.cars[0].crashes, 0, seed); assert.equal(r.winner, 0, `${seed} AI must complete the lap`);
  }
});

test('four AI drivers share the road and finish without intentionally colliding', () => {
  const r = createRace(generateTrack('FRIENDS'), Array.from({ length: 4 }, (_, i) => ({ name: `AI ${i + 1}`, control: 'ai' })));
  for (let turn = 0; turn < 1000 && r.winner === null; turn++) {
    const a = chooseAIMove(r), c = r.cars[r.active];
    if (!c.slowTurns && DIRECTIONS.some(option => !previewMove(r.track, c, option, r.cars).crash)) {
      assert.equal(previewMove(r.track, c, a, r.cars).crash, false, 'Never choose a collision when a clear move exists.');
    }
    takeTurn(r, a);
  }
  assert.notEqual(r.winner, null, 'A driver must finish the multiplayer race.');
});

test('cars face their exact travel vector and retain heading at rest, after crashes and during recovery', () => {
  const r = createRace(flatTrack(100, 100), [{}, {}]);
  assert.ok(r.cars.every(c => c.heading === 0), 'All cars start facing right.');
  r.cars.pop();
  const c = r.cars[0];
  takeTurn(r, { ax: 1, ay: 0 });
  takeTurn(r, { ax: 1, ay: 1 });
  assert.equal(c.heading, Math.atan2(1, 2), 'A shallow diagonal must not snap to 45 degrees.');
  takeTurn(r, { ax: -1, ay: 0 });
  assert.equal(c.heading, Math.PI / 4);
  takeTurn(r, { ax: -1, ay: -1 });
  assert.deepEqual([c.vx, c.vy], [0, 0]);
  assert.equal(c.heading, Math.PI / 4, 'Stopping keeps the last heading.');
  takeTurn(r, { ax: 0, ay: 0 });
  assert.equal(c.heading, Math.PI / 4, 'Coasting at rest does not rotate the car.');
  takeTurn(r, { ax: -1, ay: 0 });
  assert.equal(c.heading, Math.PI, 'Negative velocity faces left.');
  r.track.road.delete(key(c.x - 1, c.y - 1));
  takeTurn(r, { ax: 0, ay: -1 });
  assert.ok(c.slowTurns > 0);
  assert.equal(c.heading, -3 * Math.PI / 4, 'A crash retains the attempted travel direction.');
  takeTurn(r, { ax: 0, ay: 0 });
  assert.equal(c.heading, -3 * Math.PI / 4, 'A stationary restricted turn retains orientation.');
});

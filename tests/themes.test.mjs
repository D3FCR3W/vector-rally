import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTrack, createRace, previewMove } from '../public/engine.js';
import { THEMES, getTheme, createScenery, advanceScenery, wildlifeCells, sampleScenery, interpolateScenery } from '../public/themes.js';

test('scenery sampling animates all worlds without mutating the recorded scene', () => {
  const track = generateTrack('WILDLIFE-VIDEO');
  for (const theme of THEMES) {
    const scene = createScenery(track, theme.id), before = structuredClone(scene);
    const later = sampleScenery(scene, 6.5);
    assert.notDeepEqual(later.actors.map(a => [a.x, a.y, a.elapsed]), scene.actors.map(a => [a.x, a.y, a.elapsed]));
    sampleScenery(scene, 40); sampleScenery(scene, 1);
    assert.deepEqual(sampleScenery(scene, 6.5), later, 'Backward seeking gives the same wildlife poses.');
    assert.deepEqual(scene, before);
  }
});

test('replay advances wing and walking clocks continuously through complete cycles', () => {
  const initial = createScenery(generateTrack('WILDLIFE-CYCLES'), 'forest');
  const from = sampleScenery(initial, 13.8), to = sampleScenery(initial, 58.2);
  for (const t of [.1, .5, .9]) {
    const actual = interpolateScenery(from, to, t), expected = sampleScenery(initial, 13.8 + 44.4 * t);
    assert.ok(Math.abs(actual.elapsed - expected.elapsed) < 1e-8);
    for (const [i, a] of actual.actors.entries()) {
      const b = expected.actors[i];
      for (const field of ['x', 'y', 'lift', 'elapsed']) assert.ok(Math.abs(a[field] - b[field]) < 1e-8, field);
      assert.equal(a.phase, b.phase); assert.equal(a.variant, b.variant);
    }
  }
  assert.deepEqual(interpolateScenery(from, to, 0), from);
  assert.deepEqual(interpolateScenery(from, to, 1), to);
});

test('replay preserves recorded take-off reactions and grounded endpoints', () => {
  const from = createScenery(generateTrack('WILDLIFE-REACTION'), 'forest'), to = structuredClone(from);
  const bird = to.actors[0];
  advanceScenery(to, .2, [{x:bird.homeX-.5,y:bird.homeY-.5}]);
  advanceScenery(to, .2, []);
  const middle = interpolateScenery(from, to, .5);
  assert.ok(Math.abs(middle.actors[0].elapsed - 2.1) < 1e-9);
  assert.deepEqual(interpolateScenery(from, to, 1), to);
  assert.equal(to.actors[0].phase, 'taking-off');
});

test('scenery motion leaves track geometry and parked cars unchanged', () => {
  const track = generateTrack('LIVING-WORLD'), race = createRace(track, [{}]), before = structuredClone(race);
  const move = previewMove(track, race.cars[0], { ax: 1, ay: 0 }, race.cars);
  assert.equal(getTheme('obsolete-theme').id, 'forest');
  for (const theme of THEMES) {
    const scene = createScenery(track, theme.id);
    assert.deepEqual(scene, createScenery(track, theme.id));
    assert.ok(scene.actors.some(a => a.kind === theme.flyer));
    assert.ok(scene.actors.some(a => a.kind === theme.walker));
    for (let i = 0; i < 200; i++) advanceScenery(scene, .1, race.cars);
    assert.deepEqual(race, before, 'Animal motion alone cannot crash parked cars or consume turns.');
    assert.deepEqual(previewMove(track, race.cars[0], { ax: 1, ay: 0 }, race.cars), move);
  }
});

test('only grounded wildlife occupies landing cells; walking onto a parked car never causes a crash', () => {
  const race = createRace(generateTrack('ANIMAL-ARRIVAL'), [{}]), before = structuredClone(race);
  const c = race.cars[0];
  const scene = { elapsed: 0, actors: [
    { x: c.x + .5, y: c.y + .5, flying: false, phase: 'crossing' },
    { x: 2.5, y: 3.5, flying: true, phase: 'resting' },
    ...['taking-off', 'flying', 'landing'].map((phase, i) => ({ x: i + 10.5, y: 3.5, flying: true, phase }))
  ] };
  assert.deepEqual([...wildlifeCells(scene)].sort(), [c.x + ',' + c.y, '2,3'].sort());
  assert.deepEqual(race, before, 'Occupancy changes do not apply a crash to an idle driver.');
});

test('birds rest, take off, fly and land again, and react to approaching cars', () => {
  const scene = createScenery(generateTrack('BIRDS'), 'forest'), bird = scene.actors.find(a => a.flying);
  bird.elapsed = 0; advanceScenery(scene, 0, []);
  const home = { x: bird.x, y: bird.y };
  const phases = new Set();
  for (let i = 0; i < 140; i++) { advanceScenery(scene, .1, []); phases.add(bird.phase); }
  assert.deepEqual([...phases].sort(), ['flying','landing','resting','taking-off'].sort());
  assert.ok(Math.hypot(bird.x - home.x, bird.y - home.y) < .001, 'Flight returns continuously to its perch.');
  bird.elapsed = 0;
  advanceScenery(scene, 0, [{ x: bird.homeX - .5, y: bird.homeY - .5 }]);
  assert.equal(bird.phase, 'taking-off', 'A bird leaves when a car approaches.');
});

test('ground wildlife crosses both ways without teleporting at cycle boundaries', () => {
  const scene = createScenery(generateTrack('CROSSING'), 'sand'), animal = scene.actors.find(a => !a.flying);
  animal.elapsed = 21.9; advanceScenery(scene, 0, []);
  const before = { x: animal.x, y: animal.y };
  advanceScenery(scene, .2, []);
  assert.ok(Math.hypot(animal.x - before.x, animal.y - before.y) < .001);
  animal.elapsed = 7; advanceScenery(scene, 0, []);
  assert.equal(animal.phase, 'crossing');
  assert.ok(Math.hypot(animal.x - animal.homeX, animal.y - animal.homeY) < 3, 'Crossing reaches the road.');
});

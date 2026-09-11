import { interpolateScenery } from './themes.js';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
// Follow the shortest arc, easing into and out of the turn. Pure sampling also
// makes backwards seeking and frame-by-frame exports reproduce the same pose.
export function interpolateHeading(from, to, progress) {
  const t = clamp(progress, 0, 1);
  return angle(from, to, t * t * (3 - 2 * t));
}
const replayIndexes = new WeakMap();

// Round snapshots make playback and random seeking independent of race history length.
function replayIndex(recording) {
  let index = replayIndexes.get(recording);
  if (index?.count === recording.events.length) return index;
  const cars = recording.cars.map(c => ({ ...c, trail: [{ x: c.x, y: c.y }] }));
  const snapshots = [], copyCars = () => cars.map(c => ({ ...c, trail: c.trail.slice(-24) }));
  let scenery = recording.scenery, oil = [], group;
  for (const event of recording.events) {
    if (group?.round !== event.round) {
      group = { round: event.round, cars: copyCars(), scenery, oil, events: [] }; snapshots.push(group);
    }
    group.events.push(event);
    const car = cars.find(c => c.id === event.to.id);
    Object.assign(car, event.to); car.trail.push({ x: car.x, y: car.y });
    if (car.trail.length > 24) car.trail.shift();
    scenery = event.scenery;
    oil=event.oilAfter||oil;
  }
  snapshots.push({ round: Infinity, cars: copyCars(), scenery, oil, events: [] });
  index = { count: recording.events.length, snapshots }; replayIndexes.set(recording, index); return index;
}

export function replayCar(car) {
  const { id, name, control, color, x, y, vx, vy, heading, slowTurns, progress, checkpoint, crashes, jumps, turns, oilTurns, punctureTurns, wrecked } = car;
  return { id, name, control, color, x, y, vx, vy, heading, slowTurns, progress, checkpoint, crashes, jumps, turns, oilTurns, punctureTurns, wrecked, health:car.health?{...car.health}:undefined,maxHealth:car.maxHealth?{...car.maxHealth}:undefined };
}

export function createReplay(cars, scenery) {
  return { cars: cars.map(replayCar), scenery: structuredClone(scenery), events: [], duration: 0 };
}

export function recordReplay(recording, round, from, to, move, type, scenery) {
  recording.events.push({ round, from: replayCar(from), to: replayCar(to), type, vx: move?.vx ?? to.vx, vy: move?.vy ?? to.vy, contact: move?.contact ? { ...move.contact } : null, jumps: move?.jumps || 0, spin:move?.spin||0,oilBefore:structuredClone(move?.oilBefore||[]),oilAfter:structuredClone(move?.oilAfter||[]),roadEffects:structuredClone(move?.roadEffects||[]), scenery: structuredClone(scenery) });
  recording.duration = Math.max(recording.duration, round);
}

export function sampleReplay(recording, seconds) {
  const time = clamp(Number.isFinite(seconds) ? seconds : 0, 0, recording.duration);
  const { snapshots } = replayIndex(recording);
  let low = 0, high = snapshots.length - 1;
  while (low < high) { const mid = (low + high) >>> 1; if (snapshots[mid].round <= time) low = mid + 1; else high = mid; }
  const snapshot = snapshots[low];
  const cars = snapshot.cars.map(c => ({ ...c, trail: [...c.trail] }));
  let sceneryFrom = snapshot.scenery, sceneryTo = sceneryFrom, sceneT = 0;
  let oil=snapshot.oil||[];
  for (const event of snapshot.events) {
    const car = cars.find(c => c.id === event.to.id);
    if (time >= event.round) {
      Object.assign(car, event.to); car.trail.push({ x: car.x, y: car.y });
      sceneryFrom = event.scenery; sceneryTo = sceneryFrom;
      oil=event.oilAfter||oil;
    } else if (time >= event.round - 1) {
      const t = time - (event.round - 1);
      Object.assign(car, event.from);
      car.renderHeading = event.spin ? event.from.heading+event.spin*t : interpolateHeading(event.from.heading, event.to.heading, t);
      if(t>=.75){car.health=event.to.health?{...event.to.health}:undefined;car.oilTurns=event.to.oilTurns;car.punctureTurns=event.to.punctureTurns;car.wrecked=event.to.wrecked;oil=event.oilAfter||oil;}
      car.progress = lerp(event.from.progress, event.to.progress, t);
      if (event.type !== 'crash' && event.type !== 'recovery') {
        car.x = lerp(event.from.x, event.to.x, t); car.y = lerp(event.from.y, event.to.y, t);
        car.renderLift = event.jumps ? Math.sin(t * Math.PI) * 18 : 0;
      } else if (event.type === 'crash') {
        Object.assign(car, crashPose(event.from, event.to, event.contact, t));
        if (t >= .75) car.slowTurns = event.to.slowTurns;
      }
      car.trail.push({ x: car.x, y: car.y });
      sceneryTo = event.scenery; sceneT = t;
    }
  }
  const scenery = interpolateScenery(sceneryFrom, sceneryTo, sceneT);
  return { time, cars, scenery, oil };
}

export function advanceReplay(time, deltaSeconds, speed, duration) {
  return clamp(time + Math.max(0, deltaSeconds) * speed, 0, duration);
}


export function crashPose(from, stop, contact, time) {
  const t = clamp(time, 0, 1), hit = contact || stop;
  if (t < .75) return { x: lerp(from.x, hit.x, t / .75), y: lerp(from.y, hit.y, t / .75) };
  const settle = (t - .75) / .25;
  return { x: lerp(hit.x, stop.x, settle), y: lerp(hit.y, stop.y, settle) };
}

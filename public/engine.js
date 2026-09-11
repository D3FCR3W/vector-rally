import { addRaceFacilities, vehicleHealth, applyRoadEffects } from './hazards.js';
import { addMountains } from './mountains.js';
export const DIRECTIONS = [-1, 0, 1].flatMap(ay => [-1, 0, 1].map(ax => ({ ax, ay })));
export const COAST = Object.freeze({ ax: 0, ay: 0 });
export const COLORS = ['#ef7754', '#67bce5', '#be98df', '#f3cf63'];
export const key = (x, y) => `${x},${y}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function seededRandom(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ h >>> 15, h | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function roundedLoop(vertices) {
  const corners = vertices.map((p, i) => {
    const prev = vertices[(i + vertices.length - 1) % vertices.length];
    const next = vertices[(i + 1) % vertices.length];
    const inset = Math.min(4, distance(p, prev) / 3, distance(p, next) / 3);
    return { p, a: { x: p.x + (prev.x - p.x) * inset / distance(p, prev), y: p.y + (prev.y - p.y) * inset / distance(p, prev) }, b: { x: p.x + (next.x - p.x) * inset / distance(p, next), y: p.y + (next.y - p.y) * inset / distance(p, next) } };
  });
  const points = [];
  for (let i = 0; i < corners.length; i++) {
    const { a, b, p } = corners[i];
    for (let j = 0; j < 20; j++) {
      const t = j / 20, u = 1 - t;
      points.push({ x: u * u * a.x + 2 * u * t * p.x + t * t * b.x, y: u * u * a.y + 2 * u * t * p.y + t * t * b.y });
    }
    const end = corners[(i + 1) % corners.length].a;
    const count = Math.ceil(distance(b, end) * 4);
    for (let j = 0; j < count; j++) points.push({ x: b.x + (end.x - b.x) * j / count, y: b.y + (end.y - b.y) * j / count });
  }
  return points;
}

export function trackOptions(options = {}) {
  options ||= {};
  const choose = (name, values, fallback) => values.includes(options[name]) ? options[name] : fallback;
  return { length: choose('length', ['short', 'medium', 'long'], 'medium'),
    turns: choose('turns', ['gentle', 'balanced', 'technical'], 'balanced'),
    width: choose('width', ['narrow', 'standard', 'wide', 'mixed'], 'standard'),
    shortcuts: options.shortcuts !== false };
}

export function generateTrack(seed = 'RALLY-2026', options = {}) {
  const settings = trackOptions(options);
  const random = seededRandom(String(seed) + ':' + settings.length + ':' + settings.turns);
  const integer = (a, b) => a + Math.floor(random() * (b - a + 1));
  const size = { short: [76, 60], medium: [96, 80], long: [124, 104] }[settings.length];
  const width = size[0] + (settings.turns === 'technical' ? 16 : 0), height = size[1] + (settings.turns === 'technical' ? 12 : 0);
  const cx = width / 2 + integer(-3, 3), cy = height / 2 + integer(-3, 3);
  const [normalX, normalY] = [[0, -1], [1, 0], [0, 1], [-1, 0]][integer(0, 3)];
  const dx = -normalY, dy = normalX, angleStart = Math.atan2(normalY, normalX);
  const rx = width / 2 - 10, ry = height / 2 - 10;
  const startRadius = .74 + random() * .23, halfStraight = integer(7, 11);
  const center = { x: Math.round(cx + normalX * rx * startRadius), y: Math.round(cy + normalY * ry * startRadius) };
  const shift = integer(7 - halfStraight, halfStraight - 7);
  const start = { x: center.x + dx * shift, y: center.y + dy * shift, dx, dy };
  const count = { gentle: 5, balanced: 10, technical: 17 }[settings.turns] + integer(0, 2);
  const vertices = [{ x: center.x - dx * halfStraight, y: center.y - dy * halfStraight },
    { x: center.x + dx * halfStraight, y: center.y + dy * halfStraight }];
  const phase = random() * Math.PI * 2;
  const gap = Math.atan2(halfStraight + 5, (normalX ? rx : ry) * startRadius);
  for (let i = 0; i < count; i++) {
    const angle = angleStart + gap + i / (count - 1) * (Math.PI * 2 - gap * 2);
    const inward = settings.turns === 'gentle' ? .83 + random() * .16 : i % 2 ? .52 + random() * .22 : .87 + random() * .13;
    const radius = i === 0 || i === count - 1 ? startRadius : Math.min(1, inward + Math.sin(angle * 3 + phase) * .08);
    vertices.push({ x: Math.round(cx + Math.cos(angle) * rx * radius),
      y: Math.round(cy + Math.sin(angle) * ry * radius) });
  }
  const path = roundedLoop(vertices);
  let length = 0;
  for (let i = 0; i < path.length; i++) { path[i].s = length; length += distance(path[i], path[(i + 1) % path.length]); }
  const radius = { narrow: 1.6, standard: 3.1, wide: 4.2, mixed: 3.1 }[settings.width];
  const track = { seed: String(seed), settings, width, height, path, length, vertices, road: new Set(), hidden: new Set(), shortcuts: [],
    cells: new Map(), holes: new Set(), ramps: new Map(), start, radius };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) track.cells.set(key(x, y), { x, y, s: 0, distance: Infinity, roadRadius: radius });
  // Rasterize only the neighborhood of each curve sample, keeping large circuits fast.
  for (const p of path) {
    const ordinaryRadius = settings.width === 'mixed' ? 2.8 + Math.sin(p.s / 15 + phase) * 1.2 : radius;
    // Only the immediate grid needs four clear lanes. Blend back into the
    // selected road width instead of widening an entire fixed corridor.
    const t = clamp((distance(p, start) - 4) / 8, 0, 1), blend = 1 - t * t * (3 - 2 * t);
    const roadRadius = ordinaryRadius + Math.max(0, 3.1 - ordinaryRadius) * blend;
    const reach = Math.ceil(roadRadius + 2);
    for (let y = Math.floor(p.y) - reach; y <= Math.ceil(p.y) + reach; y++) for (let x = Math.floor(p.x) - reach; x <= Math.ceil(p.x) + reach; x++) {
      const cell = track.cells.get(key(x, y)); if (!cell) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < cell.distance) { cell.distance = d; cell.s = p.s; cell.roadRadius = roadRadius; }
      if (d <= roadRadius) track.road.add(key(x, y));
    }
  }
  start.s = track.cells.get(key(start.x, start.y)).s;
  start.minLane = 0; start.maxLane = 0;
  while (track.road.has(key(start.x + dy * (1 - start.minLane), start.y - dx * (1 - start.minLane)))) start.minLane--;
  while (track.road.has(key(start.x - dy * (start.maxLane + 1), start.y + dx * (start.maxLane + 1)))) start.maxLane++;
  addTrackRamp(track, random);
  const candidates = [...track.road].filter(k => {
    const c = track.cells.get(k);
    return c.distance > 1.3 && c.distance < c.roadRadius - .3 && distance(c, start) > 10 && [...track.ramps.values()].every(ramp => distance(c, ramp) > 4);
  });
  for (let i = 0; i < Math.round(length / 20) && candidates.length; i++) {
    const k = candidates.splice(integer(0, candidates.length - 1), 1)[0], c = track.cells.get(k);
    if ([...track.holes].every(h => distance(c, track.cells.get(h)) > 4)) track.holes.add(k);
  }
  if (settings.shortcuts) addHiddenRoutes(track, random);
  addRaceFacilities(track, random);
  addMountains(track, random);
  return track;
}

// Local start coordinates: forward follows the race; lane runs across the grid.
// Defaults also support simple hand-authored/test tracks facing right.
export function startPoint(track, forward = 0, lane = 0) {
  const { x, y, dx = 1, dy = 0 } = track.start;
  return { x: x + dx * forward - dy * lane, y: y + dy * forward + dx * lane };
}

function addTrackRamp(track, random) {
  const candidates = [...track.road].map(k => track.cells.get(k)).filter(c => c.distance > .8 && distance(c, track.start) > 12);
  while (candidates.length) {
    const c = candidates.splice(Math.floor(random() * candidates.length), 1)[0];
    const index = track.path.findIndex(p => p.s >= c.s), p = track.path[Math.max(0, index)], next = track.path[(Math.max(0, index) + 4) % track.path.length];
    const tx = next.x - p.x, ty = next.y - p.y;
    const dx = Math.abs(tx) >= Math.abs(ty) ? Math.sign(tx) : 0, dy = dx ? 0 : Math.sign(ty);
    if (!dx && !dy) continue;
    const strip = [-1, 0, 1, 2].map(n => key(c.x + n * dx, c.y + n * dy));
    if (!strip.every(k => track.road.has(k)) || track.cells.get(strip[2]).distance <= .8) continue;
    track.ramps.set(key(c.x, c.y), { x: c.x, y: c.y, dx, dy }); track.holes.add(strip[2]); return;
  }
}

function addHiddenRoutes(track, random) {
  const samples = track.path.filter((p, i) => i % 12 === 0 && p.s > track.length * .16 && p.s < track.length * .9);
  const candidates = [];
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
    const from = samples[i], to = samples[j], arc = to.s - from.s, straight = distance(from, to);
    if (arc < 14 || arc > Math.min(75, track.length * .35) || straight < 6 || straight > arc * .92) continue;
    const middle = Array.from({ length: 9 }, (_, k) => {
      const t = (k + 1) / 10;
      return key(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t));
    });
    if (middle.filter(k => !track.road.has(k)).length < 3) continue;
    if (middle.some(k => track.road.has(k) && Math.abs(track.cells.get(k).s - (from.s + to.s) / 2) > arc)) continue;
    candidates.push({ from, to, saving: arc - straight, rank: (arc - straight) * (.7 + random() * .6) });
  }
  candidates.sort((a, b) => b.rank - a.rank);
  for (const candidate of candidates) {
    if (track.shortcuts.length >= 2) break;
    if (track.shortcuts.some(route => Math.abs(route.from.s - candidate.from.s) < 55)) continue;
    const { from, to } = candidate, dx = to.x - from.x, dy = to.y - from.y, squared = dx * dx + dy * dy;
    const cells = [];
    for (let y = Math.floor(Math.min(from.y, to.y) - 2); y <= Math.ceil(Math.max(from.y, to.y) + 2); y++)
      for (let x = Math.floor(Math.min(from.x, to.x) - 2); x <= Math.ceil(Math.max(from.x, to.x) + 2); x++) {
        const t = clamp(((x - from.x) * dx + (y - from.y) * dy) / squared, 0, 1);
        if (Math.hypot(x - from.x - t * dx, y - from.y - t * dy) > 1.4) continue;
        const k = key(x, y), cell = track.cells.get(k); if (!cell) continue;
        track.holes.delete(k);
        if (track.road.has(k)) continue;
        track.road.add(k); track.hidden.add(k); cells.push(k);
        cell.s = from.s + t * (to.s - from.s); cell.shortcut = true;
        cell.distance = Math.hypot(x - from.x - t * dx, y - from.y - t * dy); cell.roadRadius = 1.4;
      }
    if (cells.length) track.shortcuts.push({ ...candidate, cells });
  }
}

// Supercover traversal: cells merely touched at a corner are included too.
export function traceCells(x, y, vx, vy) {
  const result = [{ x, y, t: 0, corner: false }];
  if (!vx && !vy) return result;
  const sx = Math.sign(vx), sy = Math.sign(vy), dx = vx ? 1 / Math.abs(vx) : Infinity, dy = vy ? 1 / Math.abs(vy) : Infinity;
  let tx = dx / 2, ty = dy / 2, cx = x, cy = y;
  while (Math.min(tx, ty) < 1) {
    if (Math.abs(tx - ty) < 1e-9) {
      result.push({ x: cx + sx, y: cy, t: tx, corner: true }, { x: cx, y: cy + sy, t: ty, corner: true });
      cx += sx; cy += sy;
      result.push({ x: cx, y: cy, t: tx, corner: false }); tx += dx; ty += dy;
    } else if (tx < ty) { cx += sx; result.push({ x: cx, y: cy, t: tx, corner: false }); tx += dx; }
    else { cy += sy; result.push({ x: cx, y: cy, t: ty, corner: false }); ty += dy; }
  }
  return result;
}

export function previewMove(track, car, acceleration, cars = [], wildlife = new Set()) {
  const { ax, ay } = acceleration;
  if (![ax, ay].every(a => Number.isInteger(a) && a >= -1 && a <= 1)) throw new RangeError('Acceleration must be -1, 0, or 1 on each axis.');
  const vx = car.vx + ax, vy = car.vy + ay;
  const cells = traceCells(car.x, car.y, vx, vy);
  const result = { x: car.x + vx, y: car.y + vy, vx, vy, ax, ay, cells, airborne: [], roadEffects: [], jumps: 0, crash: false, reason: '', impact: null, stop: { x: car.x, y: car.y }, contact: null, blocked: false, spin: car.oilTurns > 0 ? Math.PI * 3 : 0 };
  if(car.wrecked){result.blocked=true;result.reason='This car is out of the race';return result;}
  if(car.oilTurns>0&&(ax||ay)){result.blocked=true;result.reason='Oil: straight ahead only · '+car.oilTurns+' turns';return result;}
  if(!(car.oilTurns>0)&&car.punctureTurns>0){
    const braking=(old,next)=>old===0?next===0:Math.sign(next)===Math.sign(old)&&Math.abs(next)<=Math.abs(old)||next===0;
    if(!braking(car.vx,vx)||!braking(car.vy,vy)||((car.vx||car.vy)&&!ax&&!ay)){result.blocked=true;result.reason='Puncture: brake only · '+car.punctureTurns+' turns';return result;}
  }
  if (!(car.oilTurns > 0) && !(car.punctureTurns > 0) && car.slowTurns > 0 && Math.max(Math.abs(vx), Math.abs(vy)) > 1) {
    result.blocked = true; result.reason = 'Speed limited to 1 for ' + car.slowTurns + ' more turns'; return result;
  }
  const occupied = new Set(cars.filter(c => c.id !== car.id && !c.wrecked).map(c => key(c.x, c.y)));
  let skip = 0, mustLand = false, projectedPuncture = false;
  const projectedHealth={...(car.health||vehicleHealth(track))};
  let safe = { x: car.x, y: car.y };
  const fail = (cell, reason) => {
    const t = cell.t ?? 1, length = Math.hypot(vx, vy);
    const contactTime = Math.max(0, t - (length ? .4 / length : 0));
    return Object.assign(result, { crash: true, reason, impact: { x: car.x + vx * t, y: car.y + vy * t },
      stop: { ...safe }, contact: { x: car.x + vx * contactTime, y: car.y + vy * contactTime } });
  };
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i], k = key(c.x, c.y);
    if (!track.road.has(k)) return fail(c, 'Track boundary');
    if (skip > 0) { result.airborne.push(k); skip--; mustLand = true; continue; }
    if (i > 0 && occupied.has(k)) return fail(c, 'Another car');
    if(i>0){
      if(track.holes.has(k))result.roadEffects.push({kind:'hole',x:c.x,y:c.y,t:c.t});
      if(track.oil?.has(k))result.roadEffects.push({kind:'oil',x:c.x,y:c.y,t:c.t});
      if(track.spikes?.has(k)&&(track.hazardRound??2)>=2)result.roadEffects.push({kind:'spikes',x:c.x,y:c.y,t:c.t});
      if(track.serviceCell===k&&!c.corner)result.roadEffects.push({kind:'repair',x:c.x,y:c.y,t:c.t});
      if(track.holes.has(k)){projectedHealth.tires--;projectedHealth.body--;}
      if(track.spikes?.has(k)&&(track.hazardRound??2)>=2&&!projectedPuncture){projectedHealth.tires-=2;projectedPuncture=true;}
      if(track.serviceCell===k&&!c.corner)Object.assign(projectedHealth,car.maxHealth||vehicleHealth(track));
      if(Object.values(projectedHealth).some(n=>n<=0)){result.x=c.x;result.y=c.y;result.destroyed=true;return result;}
    }
    if (mustLand) mustLand = false;
    if (!c.corner && !(i === cells.length - 1 && wildlife.has(k))) safe = { x: c.x, y: c.y };
    const ramp = track.ramps.get(k);
    const aligned = ramp && ((ramp.dx && vy === 0 && Math.sign(vx) === ramp.dx) || (ramp.dy && vx === 0 && Math.sign(vy) === ramp.dy));
    if (aligned && !c.corner) {
      if (i + 2 >= cells.length) return fail(c, 'Not enough momentum to land');
      skip = 1; result.jumps++;
    }
  }
  if (mustLand || skip) return fail(cells.at(-1), 'Jump has no landing');
  // Wildlife only obstructs the chosen landing cell, never cells passed over.
  if (wildlife.has(key(result.x, result.y))) return fail({ x: result.x, y: result.y }, 'Animal on the landing cell');
  return result;
}

export function progressDelta(track, from, to) {
  const a = track.cells.get(key(from.x, from.y)), b = track.cells.get(key(to.x, to.y));
  if (!a || !b) return 0;
  let delta = b.s - a.s;
  if (delta > track.length / 2) delta -= track.length;
  if (delta < -track.length / 2) delta += track.length;
  return delta;
}

export function createRace(track, drivers) {
  if (!drivers.length || drivers.length > 4) throw new RangeError('Choose 1 to 4 drivers.');
  const offsets = [0, -1, 1, 2];
  const cars = drivers.map((driver, i) => { const position = startPoint(track, 0, offsets[i]); return { id: i, name: driver.name || `Driver ${i + 1}`, control: driver.control || 'human', color: COLORS[i], ...position, vx: 0, vy: 0, heading: Math.atan2(track.start.dy || 0, track.start.dx ?? 1), slowTurns: 0, progress: 0, checkpoint: 0, crashes: 0, jumps: 0, turns: 0, trail: [{ ...position }] }; });
  for(const car of cars)Object.assign(car,{health:vehicleHealth(track),maxHealth:vehicleHealth(track),oilTurns:0,punctureTurns:0,wrecked:false});
  track.oil=new Map();track.hazardRound=1;
  for (const c of cars) if (!track.road.has(key(c.x, c.y)) || track.holes.has(key(c.x, c.y)) || track.ramps.has(key(c.x, c.y))) throw new Error('Invalid starting grid.');
  return { track, cars, active: 0, round: 1, winner: null, ended:false, history: [], lastMove: null, wildlife: new Set() };
}

export function takeTurn(race, acceleration = { ax: 0, ay: 0 }) {
  if (race.winner !== null || race.ended) throw new Error('The race is finished.');
  const car = race.cars[race.active];
  const before = { x: car.x, y: car.y };
  const move = previewMove(race.track, car, acceleration, race.cars, race.wildlife);
  if (move.blocked) throw new RangeError(move.reason);
  car.turns++;
  const oldHeading=car.heading;
  if (move.spin) car.heading=oldHeading+move.spin;
  else if (move.vx || move.vy) car.heading = Math.atan2(move.vy, move.vx);
  move.oilBefore=[...(race.track.oil?.values()||[])].map(p=>({...p}));
  race.lastMove = { ...move, from: before, color: car.color };
  const destination = move.crash ? move.stop : move;
  car.progress += progressDelta(race.track, car, destination);
  car.x = destination.x; car.y = destination.y;
  car.vx = move.crash ? 0 : move.vx; car.vy = move.crash ? 0 : move.vy;
  car.slowTurns = move.crash ? 3 : Math.max(0, (car.slowTurns || 0) - 1);
  if (move.crash) car.crashes++;
  else car.jumps += move.jumps;
  const conditionNotes=applyRoadEffects(race.track,car,move);
  move.oilAfter=[...(race.track.oil?.values()||[])].map(p=>({...p}));
  Object.assign(race.lastMove,move);
  car.trail.push({ x: car.x, y: car.y });
  if (car.trail.length > 90) car.trail.shift();
  while (car.checkpoint < 3 && car.progress >= (car.checkpoint + 1) * race.track.length / 4) car.checkpoint++;
  const st = race.track.start;
  const dx = st.dx ?? 1, dy = st.dy ?? 0;
  const from = (before.x - st.x) * dx + (before.y - st.y) * dy, to = (car.x - st.x) * dx + (car.y - st.y) * dy;
  const t = from <= 0 && to > 0 ? -from / (to - from) : -1;
  const lane = t < 0 ? Infinity : -(before.x + (car.x - before.x) * t - st.x) * dy + (before.y + (car.y - before.y) * t - st.y) * dx;
  const crossed = t >= 0 && lane >= (st.minLane ?? st.minY - st.y) - .5 && lane <= (st.maxLane ?? st.maxY - st.y) + .5;
  if (!move.crash && !car.wrecked && car.checkpoint === 3 && car.progress >= race.track.length - .5 && crossed) race.winner = car.id;
  const entry = move.crash
    ? { type: 'crash', driver: car.name, text: car.name + ': ' + move.reason.toLowerCase() + ' · speed limited to 1 for the next 3 turns.' }
    : { type: race.winner !== null ? 'win' : move.jumps ? 'jump' : 'move', driver: car.name, text: race.winner !== null ? car.name + ' wins the race!' : car.name + ' moves to (' + car.x + ', ' + car.y + ') · velocity (' + car.vx + ', ' + car.vy + ').' };
  if(conditionNotes.length)entry.text+=' · '+conditionNotes.join(' · ');
  entry.conditions=conditionNotes;
  race.history.unshift({ ...entry, round: race.round }); race.history = race.history.slice(0, 60);
  race.ended=race.winner!==null||race.cars.every(c=>c.wrecked);
  for(let n=0;n<race.cars.length;n++){race.active=(race.active+1)%race.cars.length;if(race.active===0)race.round++;if(!race.cars[race.active].wrecked)break;}
  race.track.hazardRound=race.round;
  return entry;
}

// Resolve in ordinary seat order, but let the UI animate the whole AI block once.
// The visited set bounds all-AI races and blocks never pass a human turn.
export function takeAITurns(race) {
  const turns=[],visited=new Set();
  while(!race.ended && race.winner===null && race.cars[race.active].control==='ai' && !visited.has(race.active)){
    const car=race.cars[race.active],from=structuredClone(car),round=race.round;
    visited.add(car.id);
    const entry=takeTurn(race,chooseAIMove(race));
    turns.push({id:car.id,from,to:structuredClone(car),round,entry,move:structuredClone(race.lastMove)});
  }
  return turns;
}

export function canBrakeSafely(track, car, cars = [], wildlife = new Set()) {
  let state = { ...car };
  const steps = Math.max(Math.abs(state.vx), Math.abs(state.vy));
  for (let i = 0; i < steps; i++) {
    const move = previewMove(track, state, { ax: -Math.sign(state.vx), ay: -Math.sign(state.vy) }, cars, wildlife);
    if (move.crash || move.blocked || move.destroyed) return false;
    state = { ...state, x: move.x, y: move.y, vx: move.vx, vy: move.vy, slowTurns: Math.max(0, (state.slowTurns || 0) - 1) };
  }
  return true;
}

export function chooseAIMove(race) {
  const { track, cars } = race, car = cars[race.active];
  if(car.oilTurns>0)return COAST;
  if(car.punctureTurns>0)return {ax:-Math.sign(car.vx),ay:-Math.sign(car.vy)};
  let beam = [{ car, gain: 0, risk:0, first: null, score: 0 }];
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const node of beam) for (const a of DIRECTIONS) {
      const move = previewMove(track, node.car, a, cars, race.wildlife);
      if (move.crash || move.blocked || move.destroyed) continue; // Fatal moves can never be rewarded by the search.
      const state = { ...node.car, x: move.x, y: move.y, vx: move.vx, vy: move.vy, slowTurns: Math.max(0, (node.car.slowTurns || 0) - 1) };
      if (!canBrakeSafely(track, state, cars, race.wildlife)) continue;
      const gain = node.gain + progressDelta(track, node.car, move);
      const centerDistance = track.cells.get(key(move.x, move.y))?.distance || 0;
      const damageRisk=node.risk+move.roadEffects.filter(hit=>hit.kind!=='repair').length;
      const needsRepair=car.health&&Object.keys(car.health).some(part=>car.health[part]<car.maxHealth[part]*.6);
      const score = gain - centerDistance * 0.35 - (Math.abs(move.vx) + Math.abs(move.vy)) * 0.025 - damageRisk*8 + (needsRepair&&move.roadEffects.some(hit=>hit.kind==='repair')?12:0);
      next.push({ car: state, gain, risk:damageRisk, first: node.first || a, score });
    }
    if (!next.length) break;
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, 12);
  }
  if (beam[0]?.first) return beam[0].first;
  // An opponent can invalidate the stopping route. Prefer any clear move at the
  // lowest impact energy before emergency braking when every move collides.
  const clear = DIRECTIONS.map(a => ({ a, move: previewMove(track, car, a, cars, race.wildlife) }))
    .filter(candidate => !candidate.move.crash && !candidate.move.blocked && !candidate.move.destroyed)
    .sort((a, b) => (a.move.vx ** 2 + a.move.vy ** 2) - (b.move.vx ** 2 + b.move.vy ** 2));
  if (clear.length) return clear[0].a;
  return { ax: -Math.sign(car.vx), ay: -Math.sign(car.vy) };
}

export function validateTrack(track, count = 4) {
  let race;
  try { race = createRace(track, Array.from({ length: count }, () => ({}))); } catch { return false; }
  const visited = new Set([key(race.cars[0].x, race.cars[0].y)]), queue = [...visited];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i].split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(x + dx, y + dy);
      if (track.road.has(k) && !track.holes.has(k) && !visited.has(k)) { visited.add(k); queue.push(k); }
    }
  }
  return race.cars.every(c => visited.has(key(c.x, c.y))) && track.path.every(p => visited.has(key(Math.round(p.x), Math.round(p.y))));
}

export const raceProgress = (race, car) => clamp(car.progress / race.track.length * 100, 0, 100);

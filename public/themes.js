import { seededRandom, key, startPoint } from './engine.js';

// Event palettes are shared by live rendering and replay; adding a world needs no new game rules.
const EFFECTS = {
  forest: { trail: '#344624bb', style: 'dirt', dust: [.55,.59,.29], chips: [.37,.47,.2], impact: [1,.72,.22], smoke: [.38,.42,.43], gravity: 1.8 },
  sand: { trail: '#83613bcc', style: 'dirt', dust: [.83,.66,.39], chips: [.61,.45,.26], impact: [1,.64,.25], smoke: [.67,.52,.34], gravity: 1.8 },
  future: { trail: '#81e6f2', style: 'neon', dust: [.4,.75,.8], chips: [.5,.8,1], impact: [.45,1,.85], smoke: [.32,.4,.58], gravity: 1.2 },
  jungle: { trail: '#4a351dcc', style: 'dirt', dust: [.39,.52,.22], chips: [.43,.78,.23], impact: [.84,.94,.34], smoke: [.31,.38,.23], gravity: 2.1 },
  sky: { trail: '#f4fdffcc', style: 'cloud', dust: [.9,.97,1], chips: [.68,.85,1], impact: [.75,.94,1], smoke: [.89,.94,1], gravity: -.35 },
  sea: { trail: '#b3fff2cc', style: 'water', dust: [.54,.95,.95], chips: [.8,1,1], impact: [.44,.89,1], smoke: [.63,.94,1], gravity: 2.6 },
  space: { trail: '#c7a0ff', style: 'plasma', dust: [.65,.43,1], chips: [.54,.89,1], impact: [.91,.49,1], smoke: [.42,.27,.63], gravity: 0 }
};

// Add a theme here, then supply its prop and wildlife artwork below.
// Palettes leave track geometry unchanged; grounded wildlife occupies landing cells.
export const THEMES = Object.freeze([
  { id: 'forest', name: 'Forest', subtitle: 'Woodland trails', description: 'Pines, wildflowers and cool woodland ponds. Birds perch on the road; deer wander between the trees.', ground: '#47754c', fleck: '#588856', shoulder: '#b0a786', road: '#535d62', roadAlt: '#566168', grid: '#97a7aa28', curb: ['#eddec4', '#bf6550'], accent: '#ffd174', prop: 'pine', flyer: 'bird', walker: 'deer', flyerColor: '#dce9e1', walkerColor: '#b88756' },
  { id: 'sand', name: 'Desert', subtitle: 'Sun & sandstone', description: 'Warm sand, rippling dunes, cacti and sandstone. Desert birds circle overhead while lizards dash across the road.', ground: '#d6b071', fleck: '#e6c98c', shoulder: '#ab895c', road: '#826e59', roadAlt: '#88765e', grid: '#e7d2a330', curb: ['#f4dfa9', '#b76643'], accent: '#ffd59a', prop: 'cactus', flyer: 'bird', walker: 'lizard', flyerColor: '#51433c', walkerColor: '#5e7848' },
  { id: 'future', name: 'Futuristic', subtitle: 'Neon after dark', description: 'A midnight circuit lined with neon towers and glowing gardens. Scout drones land, recharge and lift off; tiny service rovers patrol the road.', ground: '#172639', fleck: '#21364a', shoulder: '#304457', road: '#354051', roadAlt: '#384657', grid: '#70c4d52d', curb: ['#6bd8e3', '#a57bcd'], accent: '#81e6f2', prop: 'tower', flyer: 'drone', walker: 'rover', flyerColor: '#8be9ed', walkerColor: '#cfadf4' }
  ,{ id: 'jungle', name: 'Jungle', subtitle: 'Lost canopy', description: 'Race through giant palms and ancient ruins. Parrots and lizards share the road. Hidden trails leave muddy ruts and leaves; impacts throw up a burst of foliage.', ground: '#244f38', fleck: '#397147', shoulder: '#86734b', road: '#665f49', roadAlt: '#6d674e', grid: '#cee69d28', curb: ['#d5c48c','#578344'], accent: '#bce969', prop: 'palm', extraProp: 'ruin', flyer: 'parrot', walker: 'lizard', flyerColor: '#f3bb43', walkerColor: '#83b857' },
  { id: 'sky', name: 'Sky', subtitle: 'Above the clouds', description: 'Floating roads above a sea of clouds, with gulls and tiny cloud creatures. Hidden routes leave white vapor trails; impacts scatter frost and cloud puffs.', ground: '#7daecf', fleck: '#a1c5df', shoulder: '#c5d7e4', road: '#8395b2', roadAlt: '#8a9db9', grid: '#e8f8ff38', curb: ['#edf9ff','#bca4de'], accent: '#f4e49b', prop: 'cloud', extraProp: 'balloon', flyer: 'bird', walker: 'cloudling', flyerColor: '#ffffff', walkerColor: '#e8f6ff' },
  { id: 'sea', name: 'Sea', subtitle: 'Tidal circuit', description: 'Cross ocean platforms between tropical islets and buoys. Gulls and crabs wander nearby. Hidden channels leave foamy wakes; impacts erupt in spray and bubbles.', ground: '#236a81', fleck: '#398fa1', shoulder: '#61a6aa', road: '#537d86', roadAlt: '#59858c', grid: '#b6f3ed38', curb: ['#ecdfb4','#e8886d'], accent: '#91e8df', prop: 'island', extraProp: 'buoy', flyer: 'bird', walker: 'crab', flyerColor: '#f4efdf', walkerColor: '#f28866' },
  { id: 'space', name: 'Space', subtitle: 'Orbital drift', description: 'An orbital circuit among stars, ringed planets and asteroids. Probes and rovers patrol the deck. Hidden routes leave violet plasma trails; impacts release drifting ion sparks.', ground: '#151529', fleck: '#69658e', shoulder: '#37334e', road: '#48465e', roadAlt: '#504d68', grid: '#b8a5f238', curb: ['#9e8be7','#67bacc'], accent: '#d0a5ff', prop: 'asteroid', extraProp: 'planet', flyer: 'probe', walker: 'rover', flyerColor: '#d5adff', walkerColor: '#84cde0' }
].map(theme => Object.freeze({ ...theme, effects: Object.freeze(EFFECTS[theme.id]) })));

export function getTheme(id) { return THEMES.find(theme => theme.id === id) || THEMES[0]; }

export function drawProp(c, type, x, y, variant = 0) {
  c.save(); c.translate(Math.round(x), Math.round(y));
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  if (type === 'palm') {
    rect('#143c3277',-22,7,45,16); rect('#77603b',-3,-9,7,27); rect('#a48a50',-1,-9,2,25);
    rect('#194e35',-25,-23,50,12); rect('#287345',-19,-29,38,14); rect('#38884b',-6,-37,12,28);
    rect('#5ba35a',-20,-28,15,4); rect('#75ae59',2,-32,4,15); rect('#20653c',-29,-15,13,8);rect('#20653c',16,-15,13,8);
    rect('#d49e45',-3,-15,5,5);
  } else if (type === 'ruin') {
    rect('#153a2b66',-16,7,36,13);rect('#77816a',-15,-16,30,31);rect('#a5a184',-11,-20,23,8);
    rect('#3d5540',-4,-10,8,25);rect('#559152',-15,-16,9,6);rect('#72a158',7,3,10,5);
  } else if (type === 'cloud') {
    rect('#638fb744',-24,10,54,10);rect('#d3e7f2',-25,-3,50,18);rect('#ecf7ff',-18,-12,37,22);
    rect('#ffffff',-9,-19,22,19);rect('#f9fdff',-23,-3,22,9);rect('#bad6eb',-13,12,30,4);
  } else if (type === 'balloon') {
    rect('#a277a5',-12,-32,24,23);rect('#efad88',-8,-35,16,28);rect('#f7dca6',-3,-34,6,28);
    rect('#657b97',-6,-7,1,12);rect('#657b97',5,-7,1,12);rect('#926d53',-6,5,13,8);
  } else if (type === 'island') {
    rect('#67b4b0',-24,4,49,16);rect('#d7c78b',-18,-3,38,19);rect('#69a269',-12,-8,25,18);
    rect('#806a43',-1,-21,4,24);rect('#2c7753',-15,-23,31,8);rect('#48a16a',-9,-30,19,12);rect('#77bb78',-2,-32,5,17);
  } else if (type === 'buoy') {
    rect('#96d5d155',-12,8,26,6);rect('#efb771',-8,0,16,12);rect('#db735c',-5,-14,10,19);
    rect('#fff0cb',-5,-6,10,4);rect('#ffdba0',-3,-19,6,5);
  } else if (type === 'asteroid') {
    rect('#252438',-14,-9,29,23);rect('#686178',-12,-15,23,27);rect('#94859e',-9,-15,14,5);
    rect('#423e57',-7,-5,8,6);rect('#514860',6,4,6,5);rect('#beb0c9',-11,1,3,3);
  } else if (type === 'planet') {
    rect('#62528d',-14,-19,28,29);rect('#9878b9',-10,-23,20,37);rect('#c399cc',-9,-17,17,5);
    rect('#7d68b0',-12,-4,25,6);rect('#e5b987',-27,1,19,4);rect('#e5b987',7,-11,21,4);rect('#b99778',-15,-3,31,4);
  } else if (type === 'pine') {
    rect('#1f403b55', -13, 5, 35, 15); rect('#634936', -3, -2, 6, 15);
    if (variant % 3 === 0) {
      rect('#244e3c', -17, -19, 34, 23); rect('#2d6044', -13, -27, 26, 36);
      rect('#3d7851', -14, -24, 20, 15); rect('#639460', -10, -24, 12, 4);
    } else {
      rect('#214c3c', -17, 0, 34, 9); rect('#2c6244', -13, -11, 26, 17);
      rect('#34744c', -9, -22, 18, 19); rect('#4a8954', -5, -30, 10, 18);
      rect('#7aa364', -2, -32, 4, 8); rect('#568d55', -11, -6, 8, 3);
    }
  } else if (type === 'cactus') {
    rect('#8b6d4844', -11, 7, 28, 8); rect('#477052', -4, -25, 9, 37);
    rect('#638552', -2, -25, 3, 33); rect('#3a6450', -12, -14, 5, 14);
    rect('#477052', -11, -4, 11, 5); rect('#477052', 4, -11, 11, 5); rect('#547a51', 11, -22, 5, 14);
    rect('#d6d395', -2, -18, 1, 3); rect('#d6d395', 2, -7, 1, 3); rect('#f0be8b', -1, -28, 4, 4);
  } else if (type === 'tower') {
    const glow = variant % 2 ? '#71dce7' : '#b18ade';
    rect('#0b172baa', -14, 6, 39, 19); rect('#132033', -15, -29, 30, 44);
    rect('#30475e', -12, -32, 24, 43); rect('#3e5670', -12, -32, 5, 43);
    rect('#4f687f', -12, -32, 24, 4); rect(glow, -14, 10, 28, 3);
    for (let row = -24; row < 5; row += 8) for (let col = -4; col < 10; col += 7) rect(glow, col, row, 3, 4);
    rect('#121f32', -3, -42, 5, 10); rect(glow, -2, -44, 3, 3);
  } else if (type === 'rock') {
    rect('#684e3744', -13, 5, 31, 10); rect('#9a7051', -13, -5, 26, 17);
    rect('#c08e60', -9, -12, 19, 21); rect('#dfb27b', -9, -12, 15, 5); rect('#8f634b', 5, -6, 8, 15);
  } else if (type === 'log') {
    rect('#443d2b66', -14, 5, 29, 8); rect('#634b35', -15, -4, 29, 12);
    rect('#8e6843', -13, -4, 24, 3); rect('#bb9159', 10, -3, 5, 10); rect('#705638', 12, 0, 2, 4);
  } else if (type === 'crystal') {
    rect('#57759455', -12, 6, 27, 8); rect('#495c9d', -6, -19, 12, 31);
    rect('#82bfcf', -6, -19, 5, 28); rect('#b4f2e5', -3, -24, 6, 6);
    rect('#7865b1', 7, -6, 6, 16); rect('#bd94db', 7, -9, 3, 15);
  }
  c.restore();
}

export function drawLandscape(c, track, theme, cell) {
  const random = seededRandom(track.seed + ':landscape:' + theme.id);
  c.fillStyle = theme.ground; c.fillRect(0, 0, track.width * cell, track.height * cell);
  for (const p of track.cells.values()) {
    const x = p.x * cell, y = p.y * cell, noise = random();
    if (!p.shortcut && p.distance <= (p.roadRadius || track.radius) + .8) { c.fillStyle = theme.shoulder; c.fillRect(x, y, cell, cell); continue; }
    c.fillStyle = theme.fleck;
    c.fillRect(x + Math.floor(noise * 23), y + (p.x * 7 + p.y * 3) % 27, theme.id === 'sand' ? 17 : 3, 2);
    if (p.shortcut) continue;
    if (theme.id === 'sea' && noise > .5) { c.fillStyle = '#75bec155'; c.fillRect(x+2,y+11,18,2); c.fillRect(x+16,y+8,12,2); }
    if (theme.id === 'space' && noise > .83) { c.fillStyle = noise > .96 ? '#fff1c9' : '#ada0cd'; c.fillRect(x+10,y+9,2,2); if(noise>.98){c.fillRect(x+8,y+9,6,1);c.fillRect(x+10,y+7,1,6);} }
    if (theme.id === 'jungle' && noise < .15) { c.fillStyle='#5a9350';c.fillRect(x+5,y+17,3,8);c.fillRect(x+2,y+20,9,3);c.fillStyle='#e7a55b';c.fillRect(x+16,y+11,4,4); }
    if (theme.id === 'forest') {
      // A quiet pond in the infield, always masked away from the road.
      const lake = ((p.x - 29) / 6) ** 2 + ((p.y - 20) / 3.5) ** 2;
      if (p.distance > 6 && lake < 1) {
        c.fillStyle = lake > .65 ? '#7a9f71' : '#477f85'; c.fillRect(x, y, cell, cell);
        if (lake < .65) { c.fillStyle = '#80b2a6'; c.fillRect(x + 3, y + 11, 16, 2); }
        continue;
      }
      if (noise < .13) { c.fillStyle = noise < .06 ? '#eadbac' : '#baabcf'; c.fillRect(x + 6, y + 21, 3, 3); c.fillRect(x + 17, y + 13, 3, 3); }
    }
    if (theme.id === 'future' && p.x % 4 === 0 && p.y % 4 === 0) {
      c.strokeStyle = '#315268'; c.lineWidth = 1; c.strokeRect(x + 3, y + 3, 26, 26);
      c.fillStyle = '#72b6bf'; c.fillRect(x + 4, y + 4, 4, 2);
    }
    if (p.distance > 5.3 && noise > ({jungle:.76,sky:.93,sea:.96,space:.95}[theme.id] || .81)) {
      const variant = Math.floor(random() * 9);
      const prop = noise > (theme.extraProp ? .985 : .94) ? theme.extraProp || ({ forest: 'log', sand: 'rock', future: 'crystal' })[theme.id] : theme.prop;
      drawProp(c, prop, x + 16, y + 18, variant);
    }
  }
}

export function drawThemePreview(canvas, theme) {
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = theme.ground; c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = theme.fleck; c.fillRect(6, 8, 19, 2); c.fillRect(65, 47, 23, 2);
  c.fillStyle = theme.shoulder; c.fillRect(0, 28, canvas.width, 21);
  c.fillStyle = theme.road; c.fillRect(0, 31, canvas.width, 15);
  c.fillStyle = theme.accent; for (let x = 0; x < canvas.width; x += 19) c.fillRect(x, 38, 9, 1);
  c.save(); c.translate(24, 24); c.scale(.7, .7); drawProp(c, theme.prop, 0, 0, 1); c.restore();
  c.save(); c.translate(80, 22); c.scale(.55, .55); drawProp(c, theme.prop, 0, 0, 0); c.restore();
}

// Scenery motion never crashes parked cars. Turns sample grounded occupancy separately.
export function createScenery(track, themeId) {
  const theme = getTheme(themeId), random = seededRandom(track.seed + ':wildlife:' + theme.id);
  const suitable = p => p && track.road.has(key(p.x, p.y)) && !track.holes.has(key(p.x, p.y)) && !track.ramps.has(key(p.x, p.y)) && !track.tunnelCells?.has(key(p.x,p.y)) && !track.pitRoute?.some(q => Math.hypot(q.x-p.x,q.y-p.y)<3) && p.distance < 1.5;
  const safe = [...track.cells.values()].filter(p => suitable(p) && Math.hypot(p.x - track.start.x, p.y - track.start.y) > 10);
  const actors = [];
  for (let i = 0; i < 24; i++) {
    let p;
    if (i < 3) { const point = startPoint(track, 6 + i * 3); const candidate = track.cells.get(key(point.x, point.y)); if (suitable(candidate)) p = candidate; }
    p ||= safe[Math.floor(random() * safe.length)];
    if (!p) continue;
    const nearest = track.path.reduce((a, b) => Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a);
    const next = track.path[(track.path.indexOf(nearest) + 4) % track.path.length] || { x: nearest.x + 1, y: nearest.y };
    const angle = Math.atan2(next.y - nearest.y, next.x - nearest.x) + Math.PI / 2;
    const flying = i % 3 !== 2;
    actors.push({ kind: flying ? theme.flyer : theme.walker, flying, homeX: p.x + .5, homeY: p.y + .5, nx: Math.cos(angle), ny: Math.sin(angle), elapsed: i === 0 ? 0 : i === 2 ? 4 : random() * 14, duration: flying ? 14 : 22, phase: 'resting', x: p.x + .5, y: p.y + .5, lift: 0, direction: angle, variant: random() });
  }
  const scene = { themeId: theme.id, elapsed: 0, actors };
  advanceScenery(scene, 0, []);
  return scene;
}

export function advanceScenery(scene, seconds, cars) {
  const dt = Math.max(0, Math.min(seconds, .25)); scene.elapsed += dt;
  for (const a of scene.actors) advanceActor(a, dt, cars);
}

// The same poses drive live wildlife and deterministic replay/export sampling.
// Sampling accepts whole cycles; only the live clock caps large frame deltas.
function advanceActor(a, dt, cars) {
    const cycles = Math.floor((a.elapsed + dt) / a.duration);
    a.elapsed = (a.elapsed + dt) % a.duration;
    if (!a.flying && cycles % 2) a.variant = 1 - a.variant;
    if (a.flying) {
      if (a.elapsed < 4 && cars.some(car => Math.hypot(car.x + .5 - a.homeX, car.y + .5 - a.homeY) < 2.8)) a.elapsed = 4;
      const t = a.elapsed;
      a.phase = t < 4 ? 'resting' : t < 5.5 ? 'taking-off' : t < 11.5 ? 'flying' : 'landing';
      const flight = t < 4 ? 0 : (t - 4) / 10, angle = flight * Math.PI * 2;
      a.x = a.homeX + Math.sin(angle) * 4;
      a.y = a.homeY + (1 - Math.cos(angle)) * 2;
      a.lift = t < 4 ? 0 : Math.sin(flight * Math.PI) * 25;
      a.direction = Math.atan2(Math.sin(angle) * 2, Math.cos(angle) * 4);
    } else {
      const progress = Math.max(0, Math.min(1, (a.elapsed - 3) / 9));
      a.phase = a.elapsed < 3 || a.elapsed >= 12 ? 'resting' : 'crossing';
      const distance = -5.5 + progress * 11;
      // Reverse the next crossing instead of teleporting back to the first verge.
      const reverse = a.variant > .5 ? -1 : 1;
      a.x = a.homeX + a.nx * distance * reverse; a.y = a.homeY + a.ny * distance * reverse;
      a.direction = Math.atan2(a.ny * reverse, a.nx * reverse); a.lift = 0;
    }
}

export function sampleScenery(scene, seconds) {
  if (!scene) return null;
  const sample = structuredClone(scene), dt = Math.max(0, seconds);
  sample.elapsed += dt;
  for (const a of sample.actors) advanceActor(a, dt, []);
  return sample;
}

export function interpolateScenery(from, to, progress) {
  if (!from) return null;
  const t = Math.max(0, Math.min(1, progress));
  if (!to || t === 0) return structuredClone(from);
  if (t === 1) return structuredClone(to);
  const sample = structuredClone(from), elapsed = Math.max(0, to.elapsed - from.elapsed);
  sample.elapsed += elapsed * t;
  for (const [i, a] of sample.actors.entries()) {
    const b = to.actors[i];
    if (!b) continue;
    // Unwrap the actor clock so wings, walking, take-off and landing keep
    // moving through cycle boundaries instead of switching snapshots halfway.
    const phaseDelta = ((b.elapsed - a.elapsed) % a.duration + a.duration) % a.duration;
    const cycles = Math.max(0, Math.floor((elapsed - phaseDelta + 1e-7) / a.duration));
    advanceActor(a, (phaseDelta + cycles * a.duration) * t, []);
  }
  return sample;
}

export function wildlifeCells(scene) {
  return new Set(scene.actors.filter(a => !a.flying || a.phase === 'resting').map(a => key(Math.floor(a.x), Math.floor(a.y))));
}

export function drawScenery(c, scene, theme, cell, bounds = null) {
  for (const a of scene.actors) {
    const x = a.x * cell, y = a.y * cell, flap = Math.sin(a.elapsed * 19) > 0 ? 1 : -1;
    if (bounds && (x < bounds.x || y < bounds.y || x > bounds.right || y > bounds.bottom)) continue;
    c.fillStyle = '#111d2d35'; c.fillRect(x - 6 + a.lift * .25, y + 4 + a.lift * .25, 13, 4);
    c.save(); c.translate(Math.round(x), Math.round(y - a.lift)); c.rotate(a.direction);
    const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    if (a.kind === 'bird' || a.kind === 'parrot') {
      rect('#27333b', -5, -3, 10, 6); rect(theme.flyerColor, -4, -2, 8, 4);
      rect(theme.flyerColor, 2, -4, 5, 5); rect('#dbac61', 7, -2, 3, 2); rect('#17212e', 5, -3, 1, 1);
      if (a.phase !== 'resting') {
        rect(theme.flyerColor, -3, -4 - (flap > 0 ? 5 : 1), 5, 6); rect(theme.flyerColor, -3, 2 + (flap > 0 ? 3 : 0), 5, 6);
        rect('#7a9194', -5, -7, 3, 3); rect('#7a9194', -5, 5, 3, 3);
      } else { rect('#a7774a', -2, 3, 1, 3); rect('#a7774a', 2, 3, 1, 3); }
      if(a.kind==='parrot'){rect('#d65c48',-1,-3,4,6);rect('#60b5bb',-9,-1,5,3);}
    } else if (a.kind === 'drone' || a.kind === 'probe') {
      rect('#182334', -9, -8, 18, 16); rect('#667d92', -7, -3, 14, 6);
      rect('#c4dbe2', -4, -5, 8, 10); rect('#68e4ed', 2, -2, 4, 4);
      for (const yy of [-8, 6]) for (const xx of [-10, 5]) {
        rect('#829bad', xx, yy, 6, 3);
        if (a.phase !== 'resting') rect(theme.flyerColor, xx - (flap > 0 ? 2 : 0), yy + 1, flap > 0 ? 10 : 6, 1);
      }
    } else if (a.kind === 'deer') {
      rect('#533f31', -10, -5, 20, 10); rect(theme.walkerColor, -9, -4, 18, 8);
      rect('#d5ae75', 7, -4, 7, 7); rect('#432f2c', 13, -2, 2, 3);
      rect('#ad794d', 7, -7, 3, 4); rect('#ad794d', 10, 2, 3, 5);
      for (const xx of [-7, 5]) { rect('#674930', xx + (a.phase === 'crossing' ? flap : 0), -7, 2, 4); rect('#674930', xx - (a.phase === 'crossing' ? flap : 0), 4, 2, 4); }
      rect('#eee0b9', -11, -2, 3, 4);
    } else if (a.kind === 'cloudling') {
      rect('#bad9ee',-9,-3,18,9);rect(theme.walkerColor,-7,-7,14,12);rect('#ffffff',-3,-10,8,9);
      rect('#516f96',1,-3,2,2);rect('#516f96',6,-3,2,2);
    } else if (a.kind === 'crab') {
      rect('#963e46',-7,-4,15,8);rect(theme.walkerColor,-5,-5,11,10);
      for(const side of [-1,1]){rect('#e78e68',-7,-8*side,3,4);rect('#e78e68',3,-8*side,3,4);rect('#ffb888',9,-7*side,5,4);}
      rect('#ffe3b7',6,-3,2,2);rect('#ffe3b7',6,2,2,2);
    } else if (a.kind === 'lizard') {
      rect('#405941', -6, -3, 13, 6); rect(theme.walkerColor, -5, -2, 16, 4);
      rect('#97a15b', -14, -1, 9, 2); rect('#8e9e58', -3, -5, 2, 10); rect('#8e9e58', 4, -5, 2, 10); rect('#202d2d', 9, -2, 1, 1);
    } else {
      rect('#141f30', -10, -7, 20, 14); rect('#65758e', -9, -4, 18, 8);
      rect(theme.walkerColor, -6, -5, 12, 10); rect('#89e8e4', 5, -2, 3, 4);
      for (const xx of [-7, 5]) { rect('#232b40', xx, -8, 3, 3); rect('#232b40', xx, 5, 3, 3); }
    }
    c.restore();
  }
}

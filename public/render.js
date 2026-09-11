import { key, startPoint } from './engine.js';
import { crashPose, interpolateHeading } from './replay.js';
import { createEffectLayer, moveEffects, sampleEffects, neonColor, EFFECT_LIMITS } from './effects.js';
import { getTheme, drawLandscape, createScenery, advanceScenery, drawScenery, wildlifeCells } from './themes.js';
import { drawMountains, drawTunnelRoofs } from './mountains.js';
import { livePose } from './race-view.js';

export const CELL = 32;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sprites = new Map();

// Hand-drawn pixel sprites, rendered at native resolution before scaling.
function carSprite(color, damaged) {
  const cacheKey = `${color}:${damaged}`;
  if (sprites.has(cacheKey)) return sprites.get(cacheKey);
  const sprite = document.createElement('canvas'); sprite.width = 32; sprite.height = 32;
  const c = sprite.getContext('2d'); c.imageSmoothingEnabled = false;
  c.translate(16, 16);
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  rect('#10191f', -10, -10, 6, 4); rect('#10191f', 5, -10, 6, 4);
  rect('#10191f', -10, 6, 6, 4); rect('#10191f', 5, 6, 6, 4);
  rect('#202a30', -14, -6, 28, 12); rect('#202a30', -11, -8, 22, 16);
  rect(damaged ? '#7b8786' : color, -12, -5, 25, 10);
  rect(damaged ? '#7b8786' : color, -10, -7, 19, 14);
  rect('#ffffff55', -9, -7, 18, 2); rect('#00000033', -10, 5, 20, 2);
  rect('#dce5dd', -13, -5, 2, 10); rect('#324957', -7, -5, 3, 10);
  rect('#162e3c', 2, -5, 5, 10); rect('#91cee0', 3, -4, 3, 7);
  rect('#ffffffcc', -2, -5, 2, 10); rect('#ffe6a5', 11, -5, 2, 3); rect('#ffe6a5', 11, 2, 2, 3);
  rect('#ff6c54', -13, -5, 1, 3); rect('#ff6c54', -13, 2, 1, 3);
  rect('#17232a', -14, -9, 3, 18); rect('#ffffff88', -14, -7, 1, 14);
  if (damaged) { rect('#242d32', 8, -2, 5, 3); rect('#373d41', 6, -4, 3, 3); }
  sprites.set(cacheKey, sprite); return sprite;
}

function arrow(c, x, y, angle, color = '#ddd5a3', size = 1) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size); c.fillStyle = color;
  c.fillRect(-9, -2, 14, 4); c.fillRect(1, -6, 4, 12); c.fillRect(5, -4, 3, 8); c.fillRect(8, -2, 3, 4); c.restore();
}

function makeTerrain(track, theme, hiddenClip) {
  const terrain = document.createElement('canvas'); terrain.width = track.width * CELL; terrain.height = track.height * CELL;
  const c = terrain.getContext('2d'); c.imageSmoothingEnabled = false;
  drawLandscape(c, track, theme, CELL);
  for (const k of track.road) {
    if (track.hidden?.has(k)) continue;
    const p = track.cells.get(k), x = p.x * CELL, y = p.y * CELL;
    c.fillStyle = (p.x + p.y) % 3 ? theme.road : theme.roadAlt; c.fillRect(x, y, CELL, CELL);
    c.fillStyle = '#676c70'; c.fillRect(x + (p.x * 7 % 27), y + (p.y * 3 % 27), 1, 1);
    c.strokeStyle = theme.grid; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, CELL, CELL);
    for (const [dx, dy, rx, ry, rw, rh] of [[-1, 0, x, y, 4, CELL], [1, 0, x + CELL - 4, y, 4, CELL], [0, -1, x, y, CELL, 4], [0, 1, x, y + CELL - 4, CELL, 4]]) {
      if (track.road.has(key(p.x + dx, p.y + dy))) continue;
      c.fillStyle = theme.curb[(p.x + p.y) % 2]; c.fillRect(rx, ry, rw, rh);
    }
  }
  // Worn twin tracks suggest a route without painting it as a normal road.
  c.save(); c.clip(hiddenClip);
  for (const route of track.shortcuts || []) {
    const dx = route.to.x - route.from.x, dy = route.to.y - route.from.y, length = Math.hypot(dx, dy);
    c.save(); c.strokeStyle = theme.id === 'future' ? theme.accent : theme.shoulder;
    c.globalAlpha = theme.id === 'sand' ? .42 : .32; c.lineWidth = theme.id === 'future' ? 2 : 3; c.setLineDash([5, 9]);
    for (const offset of [-5, 5]) {
      c.beginPath(); c.moveTo((route.from.x + .5) * CELL - dy / length * offset, (route.from.y + .5) * CELL + dx / length * offset);
      c.lineTo((route.to.x + .5) * CELL - dy / length * offset, (route.to.y + .5) * CELL + dx / length * offset); c.stroke();
    }
    c.restore();
  }
  c.restore();
  let lastArrow = -100;
  for (let i = 0; i < track.path.length - 4; i++) {
    const p = track.path[i], next = track.path[i + 4];
    if (p.s - lastArrow < 12 || Math.hypot(p.x - track.start.x, p.y - track.start.y) < 5) continue;
    arrow(c, (p.x + .5) * CELL, (p.y + .5) * CELL, Math.atan2(next.y - p.y, next.x - p.x), theme.id === 'future' ? '#80abb8' : '#c9c3a2', .8); lastArrow = p.s;
  }
  for(const k of track.pit||[]){
    const p=track.cells.get(k),x=p.x*CELL,y=p.y*CELL;
    c.fillStyle='#24474b';c.fillRect(x,y,CELL,CELL);c.strokeStyle='#83ddd3';c.lineWidth=2;c.strokeRect(x+1,y+1,CELL-2,CELL-2);
    if(k===track.serviceCell){c.fillStyle='#edf9d9';c.fillRect(x+13,y+5,6,22);c.fillRect(x+5,y+13,22,6);c.font='bold 12px monospace';c.textAlign='center';c.fillText('PIT',x+16,y-5);}
  }
  const st = track.start;
  const heading = Math.atan2(st.dy || 0, st.dx ?? 1), minLane = st.minLane ?? st.minY - st.y, maxLane = st.maxLane ?? st.maxY - st.y;
  c.save(); c.translate((st.x + .5) * CELL, (st.y + .5) * CELL); c.rotate(heading);
  for (let lane = minLane; lane <= maxLane; lane++) for (let col = 0; col < 2; col++) for (let row = 0; row < 4; row++) {
    c.fillStyle = (row + col) % 2 ? '#243139' : '#eeeedd'; c.fillRect(-8 + col * 8, lane * CELL - 16 + row * 8, 8, 8);
  }
  c.restore();
  for (const lane of [-2, 2]) for (const forward of [2, 4]) {
    const p = startPoint(track, forward, lane);
    if (track.road.has(key(p.x, p.y))) arrow(c, (p.x + .5) * CELL, (p.y + .5) * CELL, heading, '#f8d570', 1.15);
  }
  const sign = startPoint(track, 0, minLane - 1.5);
  const signX = clamp((sign.x + .5) * CELL - 89, 4, terrain.width - 182), signY = clamp((sign.y + .5) * CELL - 12, 4, terrain.height - 30);
  c.fillStyle = '#243238'; c.fillRect(signX - 4, signY - 4, 186, 31);
  c.fillStyle = theme.accent; c.fillRect(signX, signY, 178, 23);
  c.fillStyle = '#243238'; c.font = 'bold 16px monospace'; c.textAlign = 'left'; c.fillText('START / FINISH', signX + 7, signY + 17); arrow(c, signX + 161, signY + 11, heading, '#243238', .8);
  c.fillStyle = theme.id === 'future' ? '#82b2c044' : '#263b2e66'; c.font = 'bold 46px monospace'; c.textAlign = 'center'; c.fillText('VECTOR RALLY', terrain.width * .5, terrain.height * .54);
  c.font = '15px monospace'; c.fillText('ONE LAP. EVERY MOVE COUNTS.', terrain.width * .5, terrain.height * .54 + 31);
  for (const k of track.holes) {
    const p = track.cells.get(k), x = p.x * CELL, y = p.y * CELL;
    c.fillStyle = '#a6a194'; c.fillRect(x + 4, y + 9, 25, 15); c.fillRect(x + 8, y + 5, 17, 23);
    c.fillStyle = '#373e44'; c.fillRect(x + 4, y + 8, 21, 15); c.fillRect(x + 8, y + 5, 14, 21);
    c.fillStyle = '#18252d'; c.fillRect(x + 8, y + 10, 16, 11); c.fillRect(x + 11, y + 7, 9, 17);
    c.fillStyle = '#616871'; c.fillRect(x + 1, y + 6, 4, 3); c.fillRect(x + 25, y + 24, 4, 3);
    c.fillStyle = '#242e35'; c.fillRect(x + 2, y + 16, 5, 2); c.fillRect(x + 22, y + 10, 7, 2);
  }
  for (const ramp of track.ramps.values()) {
    c.save(); c.translate((ramp.x + .5) * CELL, (ramp.y + .5) * CELL); c.rotate(Math.atan2(ramp.dy, ramp.dx));
    c.fillStyle = '#172329'; c.fillRect(-14, -13, 30, 28);
    c.fillStyle = '#b57530'; c.fillRect(-14, -12, 27, 24);
    for (let x = -12; x <= 10; x += 4) { c.fillStyle = x > 0 ? '#f3c460' : '#d29d47'; c.fillRect(x, -10, 3, 20); }
    c.fillStyle = '#ffe29b'; c.fillRect(10, -13, 4, 26);
    c.fillStyle = '#efbe54'; c.fillRect(-14, -13, 25, 3); c.fillRect(-14, 10, 25, 3);
    arrow(c, 0, 0, 0, '#273335', .85); c.restore();
  }
  drawMountains(c,track,theme,CELL);
  return terrain;
}

export function createRenderer(canvas, minimap, effectCanvas = document.createElement('canvas')) {
  const ctx = canvas.getContext('2d'), mini = minimap.getContext('2d');
  const effects = createEffectLayer(effectCanvas), miniTerrain = document.createElement('canvas');
  const liveEffects = [], replayEffects = new Map();
  let liveTime = 0, lastTime = null, lastMini = -Infinity, miniView = '';
  let trailStyle = 'mixed';
  let pathCache = null;
  function setTrailStyle(value) { trailStyle = value; effectCanvas.dataset.trailStyle = value; }
  const camera = { x: 0, y: 0, zoom: 1.4, following: true };
  let width = 1, height = 1, dpr = 1, terrain, track, scene, hiddenClip, theme = getTheme('forest');
  function resize(size) { width = size?.width ?? canvas.clientWidth; height = size?.height ?? canvas.clientHeight; dpr = size ? 1 : Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); effectCanvas.width = Math.round(width); effectCanvas.height = Math.round(height); }
  function setTrack(value, themeId = theme.id) {
    track = value; theme = getTheme(themeId); hiddenClip = new Path2D();
    for (const k of track.hidden || []) { const p = track.cells.get(k); hiddenClip.rect(p.x * CELL, p.y * CELL, CELL, CELL); }
    terrain = makeTerrain(track, theme, hiddenClip); scene = createScenery(track, theme.id);
    liveEffects.length = 0; replayEffects.clear(); liveTime = 0; lastTime = null; lastMini = -Infinity;
    pathCache = null;
    miniTerrain.width = minimap.width; miniTerrain.height = minimap.height;
    const base = miniTerrain.getContext('2d'); base.imageSmoothingEnabled = false; base.drawImage(terrain, 0, 0, miniTerrain.width, miniTerrain.height);
    base.save();base.scale(miniTerrain.width/terrain.width,miniTerrain.height/terrain.height);drawTunnelRoofs(base,track,theme,CELL);base.restore();
    canvas.dataset.theme = theme.id;
  }
  function trackPreview(target) {
    const context = target.getContext('2d'); context.imageSmoothingEnabled = false;
    context.fillStyle = theme.ground; context.fillRect(0, 0, target.width, target.height);
    const scale = Math.min(target.width / terrain.width, target.height / terrain.height);
    context.drawImage(terrain, (target.width - terrain.width * scale) / 2, (target.height - terrain.height * scale) / 2, terrain.width * scale, terrain.height * scale);
    context.save();context.translate((target.width-terrain.width*scale)/2,(target.height-terrain.height*scale)/2);context.scale(scale,scale);drawTunnelRoofs(context,track,theme,CELL);context.restore();
    target.dataset.seed = track.seed; target.dataset.length = Math.round(track.length); target.dataset.corners = track.vertices.length;
  }
  function stepScenery(seconds, cars) { advanceScenery(scene, seconds, cars); }
  function wildlife(enabled = true) { return enabled ? wildlifeCells(scene) : new Set(); }
  function captureScenery() { return structuredClone(scene); }
  function beginEffects(from, to, move, animation) {
    liveEffects.push(moveEffects(track, from, to, move, liveTime, animation.duration / 1000, true));
    if (liveEffects.length > EFFECT_LIMITS.events) liveEffects.shift();
  }
  function effectsActive() { const last = liveEffects.at(-1); return !!last && liveTime < last.start + last.duration + 1.2; }
  function drawDrivenPaths(recording, replay) {
    if (!pathCache || pathCache.recording !== recording || replay.time < pathCache.time) {
      const paths = new Map();
      for (const car of recording.cars) { const path = new Path2D(); path.moveTo((car.x + .5) * CELL, (car.y + .5) * CELL); paths.set(car.id, path); }
      pathCache = { recording, paths, next: 0, time: 0 };
    }
    pathCache.time = replay.time;
    while (pathCache.next < recording.events.length && recording.events[pathCache.next].round <= replay.time) {
      const event = recording.events[pathCache.next++], path = pathCache.paths.get(event.to.id);
      if (event.type === 'crash' && event.contact) path.lineTo((event.contact.x + .5) * CELL, (event.contact.y + .5) * CELL);
      path.lineTo((event.to.x + .5) * CELL, (event.to.y + .5) * CELL);
    }
    ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
    for (const car of replay.cars) { ctx.strokeStyle = car.color; ctx.stroke(pathCache.paths.get(car.id)); }
    // Add only the travelled portion of the current round, never the future destination.
    for (let i = pathCache.next; i < recording.events.length && recording.events[i].round - 1 <= replay.time; i++) {
      const event = recording.events[i], car = replay.cars.find(c => c.id === event.to.id);
      ctx.strokeStyle = car.color; ctx.beginPath(); ctx.moveTo((event.from.x + .5) * CELL, (event.from.y + .5) * CELL);
      if (event.type === 'crash' && event.contact && replay.time - (event.round - 1) >= .75) ctx.lineTo((event.contact.x + .5) * CELL, (event.contact.y + .5) * CELL);
      ctx.lineTo((car.x + .5) * CELL, (car.y + .5) * CELL); ctx.stroke();
    }
    ctx.restore();
  }
  function effectEvents(recording, time) {
    let low = 0, high = recording.events.length;
    while (low < high) { const mid = (low + high) >>> 1; if (recording.events[mid].round - 1 <= time) low = mid + 1; else high = mid; }
    const events = [];
    for (let i = Math.max(0, low - EFFECT_LIMITS.events); i < low; i++) {
      const source = recording.events[i];
      if (!replayEffects.has(source)) replayEffects.set(source, moveEffects(track, source.from, source.to, source, source.round - 1));
      events.push(replayEffects.get(source));
    }
    while (replayEffects.size > EFFECT_LIMITS.events * 2) replayEffects.delete(replayEffects.keys().next().value);
    return events;
  }
  function screen(x, y) { return { x: (x - camera.x) * camera.zoom + width / 2, y: (y - camera.y) * camera.zoom + height / 2 }; }
  function world(x, y) { return { x: (x - width / 2) / camera.zoom + camera.x, y: (y - height / 2) / camera.zoom + camera.y }; }
  function controls(car) {
    const position = screen((car.x + .5) * CELL, (car.y + .5) * CELL);
    const destination = screen((car.x + car.vx + .5) * CELL, (car.y + car.vy + .5) * CELL);
    return { ...destination, cell: CELL * camera.zoom, vx: car.vx, vy: car.vy, carX: position.x, carY: position.y };
  }
  function focus(car, resetZoom = false) {
    camera.following = true;
    if (resetZoom) camera.zoom = width < 600 ? 1.6 : 1.5;
    const availableWidth = Math.max(160, width - 100), availableHeight = Math.max(140, height - 300);
    camera.zoom = Math.min(camera.zoom, availableWidth / ((Math.abs(car.vx) + 4) * CELL), availableHeight / ((Math.abs(car.vy) + 4) * CELL));
    camera.zoom = Math.max(.35, camera.zoom);
    camera.x = (car.x + .5 + car.vx / 2) * CELL;
    camera.y = (car.y + .5 + car.vy / 2) * CELL + 60 / camera.zoom;
  }
  function fit() { camera.following = false; camera.x = track.width * CELL / 2; camera.y = track.height * CELL / 2; camera.zoom = Math.min((width - 45) / (track.width * CELL), (height - 205) / (track.height * CELL)); }
  function zoom(factor, x = width / 2, y = height / 2) {
    const point = world(x, y); camera.zoom = clamp(camera.zoom * factor, .25, 3.5);
    camera.x = point.x - (x - width / 2) / camera.zoom; camera.y = point.y - (y - height / 2) / camera.zoom; camera.following = false;
  }
  function pan(dx, dy) { camera.x -= dx / camera.zoom; camera.y -= dy / camera.zoom; camera.following = false; }
  function draw(race, { started = false, preview = null, animation = null, ambience = true, time = performance.now(), replay = null, recording = null, paused = false, reduced = false, showPaths = false, tunnelViewIds = null } = {}) {
    const motions=Array.isArray(animation)?animation:animation?[animation]:[];
    const poses=race.cars.map(car=>livePose(car,motions.find(m=>m.id===car.id),time));
    if (lastTime !== null && !paused && !replay) liveTime += Math.max(0, Math.min(.1, (time - lastTime) / 1000));
    lastTime = time;
    const fx = sampleEffects(replay && recording ? effectEvents(recording, replay.time) : liveEffects, replay ? replay.time : liveTime, theme.id, reduced, trailStyle);
    effectCanvas.dataset.marks = fx.marks.reduce((count, mark) => count + Number(mark.dirt), 0);
    canvas.dataset.zoom = camera.zoom; canvas.dataset.cameraX = camera.x; canvas.dataset.cameraY = camera.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme.ground; ctx.fillRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
    // Copy only visible terrain pixels. The cached full circuit is never rescaled per frame.
    const topLeft = world(0, 0), sx0 = Math.max(0, Math.floor(topLeft.x)), sy0 = Math.max(0, Math.floor(topLeft.y));
    const sw = Math.min(terrain.width, Math.ceil(topLeft.x + width / camera.zoom)) - sx0, sh = Math.min(terrain.height, Math.ceil(topLeft.y + height / camera.zoom)) - sy0;
    if (sw > 0 && sh > 0) ctx.drawImage(terrain, sx0, sy0, sw, sh, sx0, sy0, sw, sh);
    const hazardTime=replay?replay.time:Math.max(0,race.round-1),deployed=hazardTime>=1;
    const firstMotion=motions[0];
    const oil=replay?replay.oil:(firstMotion&&time<firstMotion.start+firstMotion.duration*.75?firstMotion.move.oilBefore:[...(track.oil?.values()||[])]);
    for(const p of oil||[]){const x=(p.x+.5)*CELL,y=(p.y+.5)*CELL;ctx.fillStyle='#14151de8';ctx.beginPath();ctx.ellipse(x,y,15,11,.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8b72bd';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x+2,y,9,5,-.4,0,Math.PI*1.5);ctx.stroke();ctx.strokeStyle='#65a9a5';ctx.beginPath();ctx.ellipse(x-2,y+3,6,3,.2,0,Math.PI);ctx.stroke();}
    for(const p of track.spikes?.values()||[]){
      const x=(p.x+.5)*CELL,y=(p.y+.5)*CELL;
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(p.ny,p.nx));
      ctx.fillStyle=deployed?'#242936':'#edb657';ctx.fillRect(-12,-13,24,26);
      ctx.strokeStyle=deployed?'#ece4cd':'#f5cf72';ctx.lineWidth=2;
      for(let n=-9;n<=9;n+=6){ctx.beginPath();ctx.moveTo(n,-10);ctx.lineTo(n+3,0);ctx.lineTo(n,10);ctx.stroke();}
      ctx.fillStyle='#263c67';ctx.fillRect(23,-7,11,17);ctx.fillStyle='#efd4aa';ctx.fillRect(24,-14,8,7);ctx.fillStyle='#385788';ctx.fillRect(22,-17,12,4);
      ctx.strokeStyle='#efd4aa';ctx.beginPath();ctx.moveTo(24,-3);ctx.lineTo(deployed?14:18,deployed?0:-10);ctx.stroke();
      ctx.fillStyle=!reduced&&!paused&&Math.floor((replay?replay.time:time/1000)*4)%2?'#ee725d':'#72bfea';ctx.fillRect(25,3,5,4);ctx.restore();
    }
    ctx.save(); ctx.clip(hiddenClip); ctx.lineWidth = 3; ctx.lineCap = 'butt';
    for (let i = fx.marks.length - 1; i >= 0; i--) {
      const m = fx.marks[i], x = (m.x + .5) * CELL, y = (m.y + .5) * CELL;
      if (!m.dirt) continue;
      if (x < topLeft.x - 32 || y < topLeft.y - 32 || x > topLeft.x + width / camera.zoom + 32 || y > topLeft.y + height / camera.zoom + 32) continue;
      const neon = ['neon', 'plasma'].includes(theme.effects.style);
      ctx.strokeStyle = theme.effects.style === 'neon' ? neonColor(m, trailStyle).hex : theme.effects.trail;
      const dx = Math.cos(m.angle), dy = Math.sin(m.angle), half = m.size * CELL / 2 + .4;
      ctx.beginPath();
      for (const side of [-7, 7]) { ctx.moveTo(x - dx * half - dy * side, y - dy * half + dx * side); ctx.lineTo(x + dx * half - dy * side, y + dy * half + dx * side); }
      if (neon) { ctx.lineWidth = 8; ctx.globalAlpha = .2; ctx.stroke(); ctx.lineWidth = 3; ctx.globalAlpha = .95; }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    canvas.dataset.sceneryTime = (replay?.scenery || scene).elapsed.toFixed(3);
    if (ambience) drawScenery(ctx, replay?.scenery || scene, theme, CELL, { x: topLeft.x - 50, y: topLeft.y - 50, right: topLeft.x + width / camera.zoom + 50, bottom: topLeft.y + height / camera.zoom + 80 });
    canvas.dataset.pathsVisible = String(!!(replay && recording && showPaths));
    if (replay && recording && showPaths) drawDrivenPaths(recording, replay);
    if (preview) {
      const car = race.cars[race.active]; ctx.strokeStyle = preview.crash ? '#ff8e78' : '#b6ffd1'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo((car.x + .5) * CELL, (car.y + .5) * CELL); ctx.lineTo((preview.x + .5) * CELL, (preview.y + .5) * CELL); ctx.stroke(); ctx.setLineDash([]);
      const targetX = (preview.x + .5) * CELL, targetY = (preview.y + .5) * CELL;
      ctx.strokeRect(targetX - 14, targetY - 14, 28, 28);
      if (preview.impact) { const x = (preview.impact.x + .5) * CELL, y = (preview.impact.y + .5) * CELL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke(); }
    }
    for (const car of poses) {
      const animation=motions.find(m=>m.id===car.id);
      let x = car.x, y = car.y, lift = car.renderLift || 0;
      let heading = car.renderHeading ?? car.heading ?? Math.atan2(car.vy, car.vx);
      const px = (x + .5) * CELL, py = (y + .5) * CELL;
      if (started && race.active === car.id && !animation && !replay) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(px - 17, py - 17, 34, 34); }
      ctx.fillStyle = '#18282077'; ctx.fillRect(px - 13 + lift * .3, py - 7 + lift * .3 + 4, 28, 16);
      ctx.save(); ctx.globalAlpha=car.wrecked ? .35 : 1;ctx.translate(px, py - lift); ctx.rotate(heading);
      ctx.drawImage(carSprite(car.color, car.slowTurns > 0 && (!animation || !animation.move.crash || time >= animation.start + animation.duration * .75)), -16, -16); ctx.restore();
      ctx.fillStyle = '#19282b'; ctx.fillRect(px - 6, py - 25 - lift, 12, 11);
      ctx.fillStyle = '#fff4cb'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(car.id + 1), px, py - 16 - lift);
      if(car.health){const ratio=Math.min(...Object.keys(car.health).map(part=>car.health[part]/car.maxHealth[part]));ctx.fillStyle='#18252d';ctx.fillRect(px-14,py+19,28,4);ctx.fillStyle=ratio<.35?'#ef7754':'#83ddd3';ctx.fillRect(px-14,py+19,28*ratio,4);}
      if(car.oilTurns||car.punctureTurns||car.wrecked){ctx.fillStyle=car.wrecked?'#ef7754':'#ffd174';ctx.font='bold 9px monospace';ctx.fillText(car.wrecked?'OUT':car.oilTurns?'OIL '+car.oilTurns:'TIRE '+car.punctureTurns,px,py-30);}
      if(car.punctureTurns){ctx.strokeStyle='#ffbc78';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px-18,py+8);ctx.lineTo(px-23,py+11);ctx.moveTo(px+18,py+8);ctx.lineTo(px+23,py+11);ctx.stroke();}
      if (car.slowTurns && (!animation || !animation.move.crash || time >= animation.start + animation.duration * .75)) { ctx.fillStyle = '#c4c8bf'; ctx.fillRect(px + 6, py - 20, 5, 5); ctx.fillStyle = '#8d9999'; ctx.fillRect(px + 8, py - 26, 7, 7); }
    }
    effects.draw(fx.particles, ctx, camera, width, height);
    canvas.dataset.revealedTunnels=String(drawTunnelRoofs(ctx,track,theme,CELL,poses.filter(c=>tunnelViewIds===null||tunnelViewIds.includes(c.id))));
    canvas.dataset.animatingCars=motions.map(m=>m.id).join(',');
    const view = [camera.x, camera.y, camera.zoom, width, height].join(',');
    if (time - lastMini < 100 && view === miniView) return;
    lastMini = time; miniView = view;
    mini.imageSmoothingEnabled = false; mini.drawImage(miniTerrain, 0, 0);
    const sx = minimap.width / terrain.width, sy = minimap.height / terrain.height;
    for (const car of race.cars) { mini.fillStyle = '#142b23'; mini.fillRect((car.x + .5) * CELL * sx - 3, (car.y + .5) * CELL * sy - 3, 7, 7); mini.fillStyle = car.color; mini.fillRect((car.x + .5) * CELL * sx - 2, (car.y + .5) * CELL * sy - 2, 5, 5); }
    const top = world(0, 0); mini.strokeStyle = '#fff4ce'; mini.lineWidth = 1; mini.strokeRect(top.x * sx, top.y * sy, width / camera.zoom * sx, height / camera.zoom * sy);
  }
  function dispose() {
    effects.dispose();
    for (const image of [terrain, miniTerrain, canvas, minimap, effectCanvas]) if (image) { image.width = 1; image.height = 1; }
    liveEffects.length = 0; replayEffects.clear(); pathCache = null;
  }
  return { camera, resize, setTrack, setTrailStyle, trackPreview, stepScenery, wildlife, captureScenery, beginEffects, effectsActive, screen, world, controls, focus, fit, zoom, pan, draw, dispose };
}

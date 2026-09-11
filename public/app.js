import { DIRECTIONS, COAST, COLORS, generateTrack, trackOptions, validateTrack, createRace, previewMove, takeTurn, takeAITurns, raceProgress } from './engine.js';
import { CELL, createRenderer } from './render.js';
import { THEMES, getTheme, drawThemePreview } from './themes.js';
import { createReplay, recordReplay, replayCar, sampleReplay, advanceReplay } from './replay.js';
import { exportReplayVideo, videoSupported, videoDriverId } from './video-export.js';
import { humanAnchor, cameraDrivers, groupCamera, livePose, stepCamera } from './race-view.js';

const $ = id => document.getElementById(id);
const renderer = createRenderer($('track'), $('minimap'), $('effects'));
const keys = 'qweasdzxc';
let drivers = [{ name: 'You', control: 'human' }, { name: 'Atlas', control: 'ai' }];
let circuitOptions = trackOptions();
let themeId = 'forest', ambience = true, sceneryFrame, sceneryLast = 0;
let trailStyle = 'mixed';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let seed = 'RALLY-2026', race, started = false, paused = false, busy = false;
let recording, playback = null, replayFrame;
let videoJob = null, videoReturn = null, videoFile = null, videoUrl = null;
let followedDriverId;
let videoCameraMode = 'follow';
let humanDriverId, liveCameraMode='human', selectedDrivers=[], cameraMaxZoom=1.5;
let epoch = 0, aiTimer, recoveryTimer, frame, noticeTimer, preview = null, animation = null, drag = null;
let wildlifeSignature = '';
let cameraFrame, cameraLast=0, cameraInitial=true;
const cameraVelocity={x:0,y:0,zoom:0};
try {
  const saved = JSON.parse(localStorage.getItem('vector-rally-settings'));
  if (saved && typeof saved.seed === 'string' && saved.seed.length <= 40 && Array.isArray(saved.drivers) && saved.drivers.length >= 1 && saved.drivers.length <= 4 && saved.drivers.every(d => typeof d.name === 'string' && ['human', 'ai'].includes(d.control))) {
    circuitOptions = trackOptions(saved.circuitOptions);
    themeId = getTheme(saved.themeId).id; ambience = saved.ambience !== false;
    if (['green', 'purple', 'yellow', 'mixed'].includes(saved.trailStyle)) trailStyle = saved.trailStyle;
    seed = saved.seed; drivers = saved.drivers.map(d => ({ name: d.name.slice(0, 18), control: d.control }));
  }
} catch { /* Storage is optional for local play. */ }
$('seed').value = seed;
const make = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const activeCar = () => race.cars[race.active];
const canDrive = () => started && !busy && !paused && !race.ended && !activeCar().wrecked && activeCar().control === 'human';
function notify(message) {
  clearTimeout(noticeTimer); $('announcement').textContent = message; $('announcement').hidden = false;
  noticeTimer = setTimeout(() => { $('announcement').hidden = true; }, 3200);
}
function buildRace() {
  cancelAnimationFrame(cameraFrame); cameraFrame=null; cameraInitial=true; cameraLast=0;
  Object.assign(cameraVelocity,{x:0,y:0,zoom:0});
  const track = generateTrack(seed, circuitOptions);
  if (!validateTrack(track, drivers.length)) throw new Error('This track could not be validated. Try another seed.');
  race = createRace(track, drivers); renderer.setTrack(track, themeId); renderer.fit();
  renderer.setTrailStyle(trailStyle);
  recording = createReplay(race.cars, renderer.captureScenery());
  humanDriverId=humanAnchor(race.cars,race.active)?.id;liveCameraMode=humanDriverId===undefined?'all':'human';
  selectedDrivers=race.cars.map(c=>c.id);renderCameraChoices();
  followedDriverId = videoDriverId(recording.cars);
  videoCameraMode = 'follow';
  for (const id of ['video-camera', 'winner-video-camera']) $(id).value = videoCameraMode;
  for (const id of ['video-driver', 'winner-video-driver']) {
    $(id).replaceChildren(...recording.cars.map(car => {
      const option = make('option', '', `${car.id + 1}. ${car.name} · ${car.control === 'human' ? 'Player' : 'AI'}`);
      option.value = car.id; return option;
    }));
    $(id).value = followedDriverId;
  }
  renderTrackSettings();
}
function renderTrackSettings() {
  for (const property of ['length', 'turns', 'width']) $('circuit-' + property).value = circuitOptions[property];
  $('circuit-shortcuts').checked = circuitOptions.shortcuts;
  renderer.trackPreview($('course-preview'));
  $('course-stats').textContent = Math.round(race.track.length) + ' cells per lap · ' + race.track.vertices.length + ' bends · ' + circuitOptions.width + ' road';
}
function renderDriverSettings() {
  $('driver-settings').replaceChildren(...drivers.map((driver, index) => {
    const row = make('div', 'driver-setting'), chip = make('span', 'car-chip'); chip.style.background = COLORS[index];
    const name = make('input'); name.value = driver.name; name.maxLength = 18; name.required = true; name.setAttribute('aria-label', 'Driver ' + (index + 1) + ' name');
    name.addEventListener('input', () => { driver.name = name.value; race.cars[index].name = name.value.trim() || 'Driver ' + (index + 1); });
    const control = make('select'); control.setAttribute('aria-label', 'Driver ' + (index + 1) + ' control');
    for (const [value, label] of [['human', 'Human'], ['ai', 'AI']]) { const option = make('option', '', label); option.value = value; control.append(option); }
    control.value = driver.control; control.addEventListener('change', () => { driver.control = control.value; race.cars[index].control = control.value; });
    const remove = make('button', 'remove-driver', '×'); remove.type = 'button'; remove.disabled = drivers.length === 1; remove.setAttribute('aria-label', 'Remove driver ' + (index + 1));
    remove.addEventListener('click', () => { drivers.splice(index, 1); buildRace(); renderDriverSettings(); render(); });
    row.append(chip, name, control, remove); return row;
  }));
  $('add-driver').disabled = drivers.length >= 4;
}
function moveLabel(move) {
  const warnings=[...new Set((move.roadEffects||[]).map(h=>({hole:'Pothole: vehicle damage',oil:'Oil: straight spin for 3 turns',spikes:'Police spikes: puncture for 3 turns',repair:'Full repair'})[h.kind]))].join(' · ');
  return move.blocked ? move.reason : move.destroyed ? 'Vehicle destroyed on this path' : move.crash ? move.reason + ' — damage and speed limited to 1 for the next 3 turns.' :
    'Move to (' + move.x + ', ' + move.y + ') · velocity (' + move.vx + ', ' + move.vy + ')' + (move.jumps ? ' · jump!' : '') + (warnings?' · '+warnings:'');
}
function draw(advanceCamera=false) {
  const replay = playback ? sampleReplay(recording, playback.time) : null;
  const time=performance.now(),motions=Array.isArray(animation)?animation:animation?[animation]:[];
  const cars=replay?.cars||race.cars.map(c=>livePose(c,motions.find(m=>m.id===c.id),time));
  if(!busy&&!playback)humanDriverId=humanAnchor(race.cars,race.active,humanDriverId)?.id;
  const viewed=cameraDrivers(cars,humanDriverId,liveCameraMode,selectedDrivers);
  if(advanceCamera){cancelAnimationFrame(cameraFrame);cameraFrame=null;}
  if(started&&renderer.camera.following){
    const anchor=cars.find(c=>c.id===humanDriverId);
    // Keep room for the human's landing grid across input locks and AI turns.
    const pose=groupCamera(viewed,$('track').clientWidth,$('track').clientHeight,!playback&&!anchor?.wrecked&&viewed.includes(anchor)?anchor:null,cameraMaxZoom);
    if(pose){
      let moving=false;
      if(cameraInitial||reducedMotion.matches){Object.assign(renderer.camera,pose);Object.assign(cameraVelocity,{x:0,y:0,zoom:0});cameraInitial=false;}
      else moving=stepCamera(renderer.camera,pose,cameraVelocity,advanceCamera&&cameraLast?(time-cameraLast)/1000:0);
      if(moving&&!cameraFrame)cameraFrame=requestAnimationFrame(()=>{cameraFrame=null;draw(true);});
    }
  }else Object.assign(cameraVelocity,{x:0,y:0,zoom:0});
  if(advanceCamera||!cameraLast)cameraLast=time;
  positionTargets();
  $('game').dataset.cameraMode=liveCameraMode;$('game').dataset.cameraDrivers=viewed.map(c=>c.id).join(',');$('game').dataset.humanAnchor=humanDriverId??'';
  renderer.draw(replay ? { ...race, cars: replay.cars } : race, { started, preview, animation, ambience, replay, recording, paused, reduced: reducedMotion.matches, showPaths: playback?.showPaths === true,time,tunnelViewIds:viewed.map(c=>c.id) });
}
function renderCameraChoices(){
  $('camera-mode').value=liveCameraMode;$('camera-players').hidden=liveCameraMode!=='selected';
  $('camera-players').replaceChildren(...race.cars.map(car=>{const label=make('label'),input=make('input');input.type='checkbox';input.value=car.id;input.checked=selectedDrivers.includes(car.id);
    input.addEventListener('change',()=>{const next=[...$('camera-players').querySelectorAll('input:checked')].map(el=>Number(el.value));if(!next.length){input.checked=true;return;}selectedDrivers=next;renderer.camera.following=true;updateCamera();});label.append(input,document.createTextNode(`${car.name} · ${car.control==='human'?'Player':'AI'}`));return label;}));
}
function followView(){renderer.camera.following=true;cameraMaxZoom=innerWidth<600?1.6:1.5;}
function syncAmbience() {
  cancelAnimationFrame(sceneryFrame); sceneryLast = 0;
  if (!started || paused || document.hidden || race.ended || ((!ambience || reducedMotion.matches) && !renderer.effectsActive())) return;
  sceneryFrame = requestAnimationFrame(animateScenery);
}
function animateScenery(time) {
  if (!started || paused || document.hidden || race.ended || ((!ambience || reducedMotion.matches) && !renderer.effectsActive())) { sceneryLast = 0; return; }
  if (sceneryLast && ambience && !reducedMotion.matches) renderer.stepScenery(Math.min((time - sceneryLast) / 1000, .1), race.cars);
  sceneryLast = time;
  refreshWildlifeTargets();
  if (!busy) draw(true);
  sceneryFrame = requestAnimationFrame(animateScenery);
}
function renderThemes() {
  $('theme-options').replaceChildren(...THEMES.map(theme => {
    const button = make('button', 'theme-option'); button.type = 'button'; button.dataset.theme = theme.id;
    button.setAttribute('aria-pressed', String(themeId === theme.id)); button.setAttribute('aria-label', theme.name + '. ' + theme.subtitle);
    const art = make('canvas'); art.width = 104; art.height = 56; art.setAttribute('aria-hidden', 'true'); drawThemePreview(art, theme);
    button.append(art, make('strong', '', theme.name), make('small', '', theme.subtitle));
    button.addEventListener('click', () => {
      if (started) return;
      themeId = theme.id; renderer.setTrack(race.track, themeId); renderThemes(); renderTrackSettings(); draw();
    });
    return button;
  }));
  const theme = getTheme(themeId); $('game').style.setProperty('--accent', theme.accent);
  $('theme-description').textContent = theme.description; $('ambience').checked = ambience;
  $('neon-setting').hidden = themeId !== 'future'; $('neon-trails').value = trailStyle;
}
function refreshWildlifeTargets() {
  race.wildlife = renderer.wildlife(ambience);
  if (!canDrive()) return;
  const signature = [...race.wildlife].join(';');
  if (signature === wildlifeSignature) return;
  wildlifeSignature = signature;
  for (const button of $('destinations').children) {
    const choice = { ax: Number(button.dataset.ax), ay: Number(button.dataset.ay) };
    const move = previewMove(race.track, activeCar(), choice, race.cars, race.wildlife);
    button.classList.toggle('danger', Boolean(move.crash || move.destroyed));
    button.classList.toggle('caution', !!move.roadEffects?.length && !move.crash && !move.destroyed);
    button.disabled = move.blocked;
    const label = 'Land on (' + move.x + ', ' + move.y + '). ' + moveLabel(move);
    button.title = label; button.setAttribute('aria-label', label);
    if (preview && (button.matches(':hover') || document.activeElement === button)) { preview = move; renderHUD(); }
  }
}
function positionTargets() {
  if(!canDrive()||$('destinations').hidden)return;
  const pad = renderer.controls(activeCar());
  $('destinations').style.setProperty('--control-cell', pad.cell + 'px');
  $('destinations').style.left = pad.x + 'px'; $('destinations').style.top = pad.y + 'px';
  Object.assign($('destinations').dataset, { carX: pad.carX, carY: pad.carY, vx: pad.vx, vy: pad.vy, cell: pad.cell });
}
function renderTargets() {
  syncAmbience();
  race.wildlife = renderer.wildlife(ambience);
  $('destinations').replaceChildren();
  wildlifeSignature = '';
  const visible = canDrive();
  $('destinations').hidden = !visible;
  if (!visible) return;
  positionTargets();
  for (const [index, a] of DIRECTIONS.entries()) {
    const move = previewMove(race.track, activeCar(), a, race.cars, race.wildlife);
    const button = make('button', 'destination' + (move.crash || move.destroyed ? ' danger' : move.roadEffects?.length ? ' caution' : ''), '');
    button.disabled = move.blocked;
    button.dataset.ax = a.ax; button.dataset.ay = a.ay; button.dataset.x = move.x; button.dataset.y = move.y;
    const adjustment = 'Land on (' + move.x + ', ' + move.y + ')' + (index === 4 ? ': keep momentum' : '');
    button.setAttribute('aria-label', adjustment + '. ' + moveLabel(move) + ' Press ' + keys[index].toUpperCase() + '.'); button.title = adjustment + '. ' + moveLabel(move);
    const showPreview = () => { if (!canDrive()) return; preview = previewMove(race.track, activeCar(), a, race.cars, race.wildlife); renderHUD(); draw(); };
    button.addEventListener('pointerenter', showPreview); button.addEventListener('focus', showPreview);
    button.addEventListener('pointerleave', () => { preview = null; renderHUD(); draw(); });
    button.addEventListener('click', event => { event.stopPropagation(); if (canDrive()) performMove(a); });
    $('destinations').append(button);
  }
}
function renderHUD() {
  const car = activeCar(), ended = race.ended;
  $('replay-button').disabled = busy || !recording.events.length || !!playback;
  $('watch-replay').disabled = !recording.events.length;
  for (const id of ['export-video', 'export-winner-video']) $(id).disabled = busy || !recording.events.length || !!videoJob || !!videoReturn;
  for (const id of ['video-driver', 'winner-video-driver']) $(id).disabled = videoCameraMode === 'all' || !!videoJob || !!videoReturn;
  for (const id of ['video-camera', 'winner-video-camera']) $(id).disabled = !!videoJob || !!videoReturn;
  $('help-button').disabled = !!playback; $('menu-button').disabled = !!playback;
  $('game').dataset.active = car.id; $('game').dataset.turns = race.cars.reduce((n, c) => n + c.turns, 0); $('game').dataset.busy = String(busy);
  $('round-label').textContent = started ? 'ROUND ' + String(race.round).padStart(2, '0') + ' · LAP 1 / 1' : 'START YOUR ENGINES';
  $('track-seed').textContent = seed;
  $('active-name').textContent = ended ? 'Race complete' : car.name === 'You' ? 'Your turn' : car.name + "'s turn";
  $('active-kind').textContent = car.control === 'ai' ? 'AI DRIVER' : 'HUMAN DRIVER';
  $('driver-chip').style.background = car.color;
  $('speed').textContent = Math.max(Math.abs(car.vx), Math.abs(car.vy)).toFixed(1).replace('.0', '');
  $('speed').title = 'Velocity (' + car.vx + ', ' + car.vy + ')';
  $('progress').textContent = Math.round(raceProgress(race, car)) + '%';
  $('checkpoint').textContent = car.checkpoint + ' / 3 CHECKPOINTS';
  let message = 'Choose your landing square. Center keeps momentum.';
  if (preview) message = moveLabel(preview);
  if (car.slowTurns) message = 'Speed limit 1 · ' + car.slowTurns + ' turns remaining. You can drive.';
  if (car.punctureTurns) message = 'Punctured tires · '+car.punctureTurns+' turns. Brake only; wait at rest.';
  if (car.oilTurns) message = 'Oil spin · '+car.oilTurns+' turns. Center only: keep going straight.';
  if (car.control === 'ai') message = 'Planning a line and checking the braking distance…';
  if (busy) message = 'On the move…';
  if (paused) message = 'Race paused. Ready when you are.';
  if (ended) message = 'Checkered flag! Time for a rematch.';
  $('move-description').textContent = message;
  $('vehicle-condition').replaceChildren(...['tires','engine','body'].map(part=>{
    const label=make('label','',({tires:'Tires',engine:'Engine',body:'Body'})[part]+' '+car.health[part]+'/'+car.maxHealth[part]);
    const meter=make('meter');meter.min=0;meter.max=car.maxHealth[part];meter.value=car.health[part];meter.low=car.maxHealth[part]*.35;meter.optimum=car.maxHealth[part];label.append(meter);return label;
  }));
  $('game').dataset.health=JSON.stringify(car.health);
  $('move-description').classList.toggle('danger', !!preview?.crash && !busy);
  $('resume').hidden = !paused || !started || ended || $('help-dialog').open || $('menu-dialog').open;
  $('move-description').style.visibility = !$('resume').hidden ? 'hidden' : '';
}
function renderStandings() {
  $('standings').replaceChildren(...[...race.cars].sort((a, b) => b.progress - a.progress).map((car, index) => {
    const row = make('div', 'standing'), chip = make('span', 'car-chip'); chip.style.background = car.color;
    const name = make('span', 'driver-name', car.name); name.append(make('small', '', car.control.toUpperCase()));
    row.append(make('span', '', String(index + 1)), chip, name, make('span', 'standing-value', car.wrecked?'OUT':car.oilTurns?'Oil · '+car.oilTurns:car.punctureTurns?'Tires · '+car.punctureTurns:car.slowTurns ? 'Limit 1 · ' + car.slowTurns : Math.round(raceProgress(race, car)) + '%')); return row;
  }));
  $('race-log').replaceChildren(...race.history.slice(0, 8).map(entry => make('div', 'log-entry ' + entry.type, entry.text)));
  if (!race.history.length) $('race-log').append(make('p', 'empty-log', 'A clean starting grid. Your first move is waiting.'));
}
function render() {
  $('setup-panel').hidden = started; $('race-hud').hidden = !started || race.ended;
  $('map-panel').hidden = !started;
  $('winner-banner').hidden = !race.ended || busy;
  if (race.winner !== null) {
    const winner = race.cars[race.winner]; $('winner-name').textContent = winner.name + ' takes the flag.';
    $('winner-detail').textContent = winner.turns + ' turns · ' + winner.crashes + ' crashes · ' + winner.jumps + ' jumps';
  } else if(race.ended){
    $('winner-name').textContent='No car made it to the flag.';
    $('winner-detail').textContent='Every car is out. Try a repair lane before a part reaches zero.';
  }
  draw(); renderHUD(); renderStandings(); renderTargets();
}
function scheduleAI() {
  clearTimeout(aiTimer);
  if (!started || paused || busy || race.ended || activeCar().control !== 'ai') return;
  const expectedEpoch = epoch;
  aiTimer = setTimeout(() => {
    if(epoch!==expectedEpoch||paused||busy||race.ended)return;
    race.wildlife=renderer.wildlife(ambience);animateTurns(takeAITurns(race));
  }, 100);
}
function performMove(a) {
  if (!started || busy || paused || race.ended) return;
  race.wildlife = renderer.wildlife(ambience);
  const car = activeCar(), from = { x: car.x, y: car.y, heading: car.heading };
  const move = previewMove(race.track, car, a, race.cars, race.wildlife);
  if (move.blocked) { notify(move.reason); return; }
  const recordedFrom = replayCar(car), recordedRound = race.round;
  const entry = takeTurn(race, a);
  Object.assign(move,race.lastMove);
  animateTurns([{id:car.id,from:recordedFrom,to:replayCar(car),round:recordedRound,move,entry}]);
}
function animateTurns(turns){
  if(!turns.length)return;
  busy=true;preview=null;
  const expectedEpoch=epoch,start=performance.now();
  const duration=reducedMotion.matches?70:Math.max(...turns.map(t=>t.move.crash?650:t.move.jumps?460:320));
  animation=turns.map(t=>({id:t.id,from:t.from,move:t.move,start,duration}));
  turns.forEach((t,i)=>{recordReplay(recording,t.round,t.from,t.to,t.move,t.entry.type,renderer.captureScenery());renderer.beginEffects(t.from,t.to,t.move,animation[i]);});
  $('game').dataset.aiPass=turns.filter(t=>t.from.control==='ai').map(t=>t.id).join(',');
  render();
  const finish = () => {
    if (epoch !== expectedEpoch) return;
    animation = null; busy = false;
    render();
    const notable=turns.filter(t=>t.entry.type==='crash'||t.entry.type==='jump'||t.entry.conditions?.length);
    if(notable.length)notify(notable.map(t=>t.entry.text).join(' · '));
    scheduleAI();
  };
  function tick() {
    if (epoch !== expectedEpoch) return;
    draw(true);
    if (animation && performance.now() < start + duration) frame = requestAnimationFrame(tick);
    else finish();
  }
  // Even recovery turns have a short input lock, so a double-click cannot skip twice.
  if (animation) frame = requestAnimationFrame(tick); else recoveryTimer = setTimeout(finish, 220);
}
function resetToSetup() {
  cancelAnimationFrame(replayFrame); playback = null; $('replay-panel').hidden = true;
  epoch++; clearTimeout(aiTimer); clearTimeout(recoveryTimer); cancelAnimationFrame(frame); clearTimeout(noticeTimer);
  animation = null; preview = null; busy = false; started = false; paused = false;
  $('announcement').hidden = true;
  for (const id of ['menu-dialog', 'help-dialog']) $(id).close();
  buildRace(); renderDriverSettings(); render();
}
function updateCamera() { preview = null; draw(); renderHUD(); renderTargets(); }
function openDialog(id) {
  const dialog = $(id); dialog.dataset.wasPaused = String(paused); paused = true; clearTimeout(aiTimer);
  renderStandings(); dialog.showModal(); preview = null; renderTargets(); renderHUD(); draw();
}
for (const id of ['help-dialog', 'menu-dialog']) $(id).addEventListener('close', () => {
  paused = started && $(id).dataset.wasPaused === 'true';
  renderHUD(); renderTargets(); draw(); scheduleAI();
});
$('setup-form').addEventListener('submit', event => {
  event.preventDefault(); seed = $('seed').value.trim() || 'RALLY-2026';
  drivers.forEach((d, i) => { d.name = d.name.trim() || 'Driver ' + (i + 1); });
  buildRace(); try { localStorage.setItem('vector-rally-settings', JSON.stringify({ seed, drivers, themeId, ambience, circuitOptions, trailStyle })); } catch {}
  epoch++; started = true; paused = false; followView(); render(); scheduleAI();
  const direction = race.track.start.dx === 1 ? 'right →' : race.track.start.dx === -1 ? 'left ←' : race.track.start.dy === 1 ? 'down ↓' : 'up ↑';
  notify(`START · Head ${direction}, then follow the arrows clockwise.`);
});
for (const property of ['length', 'turns', 'width', 'shortcuts']) $('circuit-' + property).addEventListener('change', event => {
  if (started) return;
  circuitOptions[property] = property === 'shortcuts' ? event.target.checked : event.target.value;
  buildRace(); render();
});
$('neon-trails').addEventListener('change', event => { trailStyle = event.target.value; renderer.setTrailStyle(trailStyle); draw(); });
$('ambience').addEventListener('change', () => { if (!started) { ambience = $('ambience').checked; draw(); } });
reducedMotion.addEventListener('change', () => { syncAmbience(); draw(); });
$('shuffle').addEventListener('click', () => { seed = Math.random().toString(36).slice(2, 9).toUpperCase(); $('seed').value = seed; buildRace(); render(); });
$('seed').addEventListener('change', () => { seed = $('seed').value.trim() || 'RALLY-2026'; buildRace(); render(); });
$('add-driver').addEventListener('click', () => { if (drivers.length < 4) { drivers.push({ name: ['You', 'Atlas', 'Nova', 'Ember'][drivers.length], control: 'human' }); buildRace(); renderDriverSettings(); render(); } });
$('resume').addEventListener('click', () => { paused = false; render(); scheduleAI(); });
$('new-race').addEventListener('click', resetToSetup); $('race-again').addEventListener('click', resetToSetup);
$('help-button').addEventListener('click', () => openDialog('help-dialog'));
$('menu-button').addEventListener('click', () => openDialog('menu-dialog'));
for (const id of ['close-help', 'got-it']) $(id).addEventListener('click', () => $('help-dialog').close());
for (const id of ['close-menu', 'continue-race']) $(id).addEventListener('click', () => $('menu-dialog').close());
$('focus-car').addEventListener('click', () => { liveCameraMode=humanDriverId===undefined?'all':'human';renderCameraChoices();followView();updateCamera(); });
$('camera-mode').addEventListener('change',()=>{liveCameraMode=$('camera-mode').value;renderCameraChoices();followView();updateCamera();});
$('overview').addEventListener('click', () => { renderer.fit(); updateCamera(); notify('Whole track · Follow returns to your car.'); });
$('minimap').addEventListener('click', () => $('overview').click());
$('minimap').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('overview').click(); } });
$('zoom-in').addEventListener('click', () => { renderer.zoom(1.2); updateCamera(); });
$('zoom-out').addEventListener('click', () => { renderer.zoom(1 / 1.2); updateCamera(); });
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('game').requestFullscreen(); }
  catch { notify('Browser fullscreen is unavailable. The game still fills this window.'); }
});
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  $('fullscreen').setAttribute('aria-label', label); $('fullscreen').title = label;
});
$('game').addEventListener('wheel', event => {
  if (event.target.closest('.camera-controls') || !started || $('video-dialog').open || $('help-dialog').open || $('menu-dialog').open || (race.ended && !playback)) return;
  event.preventDefault();
  const r = $('track').getBoundingClientRect();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? r.height : 1);
  renderer.zoom(Math.exp(-Math.max(-250, Math.min(250, delta)) * .002), event.clientX - r.left, event.clientY - r.top); updateCamera();
}, { passive: false });
$('track').addEventListener('pointerdown', event => {
  if (!started || (event.pointerType === 'mouse' && event.button !== 0)) return;
  drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  $('track').setPointerCapture(event.pointerId);
});
$('track').addEventListener('pointermove', event => {
  if (!drag) return;
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
  if (drag.moved) { renderer.pan(event.clientX - drag.x, event.clientY - drag.y); updateCamera(); }
  drag.x = event.clientX; drag.y = event.clientY;
});
$('track').addEventListener('pointerup', event => {
  if (!drag) return;
  const moved = drag.moved; drag = null;
  if (moved || !canDrive()) return;
  const r = $('track').getBoundingClientRect(), point = renderer.world(event.clientX - r.left, event.clientY - r.top);
  const x = Math.floor(point.x / CELL), y = Math.floor(point.y / CELL);
  const command = [...DIRECTIONS, COAST].find(choice => {
    const move = previewMove(race.track, activeCar(), choice, race.cars, race.wildlife);
    return move.x === x && move.y === y;
  });
  if (command) performMove(command);
});
$('track').addEventListener('pointercancel', () => { drag = null; });
document.addEventListener('keydown', event => {
  if (!started || $('video-dialog').open || event.repeat || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey || $('help-dialog').open || $('menu-dialog').open) return;
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); $('focus-car').click(); return; }
  if (event.key === '+' || event.key === '=') { $('zoom-in').click(); return; }
  if (event.key === '-') { $('zoom-out').click(); return; }
  if (!canDrive()) return;
  const arrowKeys = { ArrowUp: 1, ArrowLeft: 3, ArrowRight: 5, ArrowDown: 7 };
  const index = arrowKeys[event.key] ?? keys.indexOf(event.key.toLowerCase());
  if (index >= 0) { event.preventDefault(); performMove(DIRECTIONS[index]); }
  if (event.key === ' ' && !['BUTTON', 'A'].includes(event.target.tagName)) { event.preventDefault(); performMove(COAST); }
});
document.addEventListener('visibilitychange', () => {
  if ($('video-dialog').open) return;
  if (document.hidden && playback) { playback.playing = false; cancelAnimationFrame(replayFrame); renderPlayback(); }
  if (document.hidden && started) { paused = true; if (!busy) clearTimeout(aiTimer); renderHUD(); renderTargets(); }
});

function renderPlayback(advanceCamera=false) {
  if (!playback) return;
  $('replay-panel').dataset.time = playback.time.toFixed(4);
  $('replay-panel').dataset.playing = String(playback.playing);
  $('replay-panel').dataset.speed = String(playback.speed);
  $('replay-toggle').textContent = playback.playing ? 'Pause' : 'Play';
  $('replay-toggle').setAttribute('aria-label', playback.playing ? 'Pause replay' : 'Play replay');
  $('replay-position').value = playback.time;
  $('replay-time').textContent = playback.time.toFixed(1) + ' / ' + recording.duration.toFixed(1) + ' s';
  $('replay-round').textContent = 'ROUND ' + Math.min(recording.duration, Math.floor(playback.time) + 1) + ' / ' + recording.duration;
  draw(advanceCamera);
}
function tickReplay(time) {
  if (!playback?.playing) return;
  const dt = playback.last ? Math.min(.1, (time - playback.last) / 1000) : 0;
  playback.last = time;
  playback.time = advanceReplay(playback.time, dt, playback.speed, recording.duration);
  if (playback.time >= recording.duration) playback.playing = false;
  renderPlayback(true);
  if (playback.playing) replayFrame = requestAnimationFrame(tickReplay);
}
function seekReplay(time) {
  if (!playback) return;
  playback.time = Math.max(0, Math.min(recording.duration, Number(time)));
  playback.last = 0;

  renderPlayback();
}
function toggleReplay() {
  if (!playback) return;
  playback.playing = !playback.playing;
  playback.last = 0; cancelAnimationFrame(replayFrame);
  if (playback.playing && playback.time >= recording.duration) playback.time = 0;
  renderPlayback();
  if (playback.playing) replayFrame = requestAnimationFrame(tickReplay);
}
function openReplay() {
  if (busy || !recording.events.length || playback) return;
  playback = { time: 0, speed: 1, playing: true, last: 0, showPaths: false, wasPaused: paused, camera: { ...renderer.camera } };
  $('replay-paths').checked = false;
  paused = true; clearTimeout(aiTimer); preview = null; clearTimeout(noticeTimer); $('announcement').hidden = true;
  syncAmbience(); renderTargets(); renderHUD();
  $('race-hud').hidden = true; $('winner-banner').hidden = true; $('replay-panel').hidden = false;
  $('replay-position').max = recording.duration; $('replay-speed').value = '1';
  followView();
  renderPlayback(); replayFrame = requestAnimationFrame(tickReplay);
}
function closeReplay() {
  if (!playback) return;
  const saved = playback;
  cancelAnimationFrame(replayFrame); playback = null;
  paused = saved.wasPaused; Object.assign(renderer.camera, saved.camera);
  $('replay-panel').hidden = true;
  render(); scheduleAI();
}
$('replay-button').addEventListener('click', openReplay);
$('watch-replay').addEventListener('click', openReplay);
$('replay-close').addEventListener('click', closeReplay);
$('replay-toggle').addEventListener('click', toggleReplay);
$('replay-position').addEventListener('input', event => seekReplay(event.target.value));
$('replay-back').addEventListener('click', () => seekReplay(Math.ceil(playback.time) - 1));
$('replay-forward').addEventListener('click', () => seekReplay(Math.floor(playback.time) + 1));
$('replay-speed').addEventListener('change', event => { if (playback) { playback.speed = Number(event.target.value); playback.last = 0; renderPlayback(); } });
$('replay-paths').addEventListener('change', event => { if (playback) { playback.showPaths = event.target.checked; draw(); } });
document.addEventListener('keydown', event => {
  if (!playback || $('video-dialog').open || event.repeat || ['INPUT', 'SELECT'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { event.preventDefault(); closeReplay(); }
  else if (event.key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); toggleReplay(); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); seekReplay(Math.ceil(playback.time) - 1); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); seekReplay(Math.floor(playback.time) + 1); }
});

async function exportVideo() {
  if (videoJob || videoReturn || $('video-dialog').open || busy || !recording.events.length) return;
  videoReturn = { paused, playing: playback?.playing === true, camera: { ...renderer.camera } };
  paused = true; clearTimeout(aiTimer); cancelAnimationFrame(replayFrame);
  if (playback) { playback.playing = false; playback.last = 0; renderPlayback(); }
  syncAmbience(); renderTargets(); renderHUD();
  videoFile = null;
  $('video-download').hidden = true; $('video-share').hidden = true;
  $('video-progress').value = 0; $('video-progress').hidden = false;
  $('video-preview').hidden = false; $('video-close').textContent = 'Cancel export';
  $('video-status').textContent = 'Preparing your full race…';
  $('video-dialog').showModal();
  const controller = new AbortController(); videoJob = controller;
  try {
    const result = await exportReplayVideo({ race, recording, themeId, seed, ambience, trailStyle, followedDriverId, cameraMode: videoCameraMode,
      showPaths: playback?.showPaths === true,
      canvas: $('video-preview'), signal: controller.signal,
      onProgress: ({ progress, paused: waiting }) => {
        $('video-progress').value = progress;
        $('video-status').textContent = waiting ? 'Export paused — return to this tab to continue.' : `Creating your video… ${Math.floor(progress * 100)}%`;
      }
    });
    videoFile = new File([result.blob], result.filename, { type: result.blob.type });
    videoUrl = URL.createObjectURL(videoFile);
    const download = $('video-download'); download.href = videoUrl; download.download = result.filename; download.hidden = false;
    $('video-status').textContent = 'Your video is ready. Download started — or save it again below.';
    $('video-progress').value = 1;
    $('video-share').hidden = !navigator.canShare?.({ files: [videoFile] });
    download.click();
  } catch (error) {
    if (controller.signal.aborted) { $('video-dialog').close(); return; }
    $('video-status').textContent = error.message || 'The video could not be exported. Close this window and try again.';
    $('video-preview').hidden = true; $('video-progress').hidden = true;
  } finally {
    videoJob = null; $('video-close').textContent = 'Back to race'; renderHUD();
  }
}
for (const id of ['export-video', 'export-winner-video']) $(id).addEventListener('click', exportVideo);
for (const id of ['video-driver', 'winner-video-driver']) $(id).addEventListener('change', event => {
  if (videoCameraMode === 'all' || videoJob || $('video-dialog').open) return;
  followedDriverId = videoDriverId(recording.cars, Number(event.target.value));
  for (const target of ['video-driver', 'winner-video-driver']) $(target).value = followedDriverId;
});
for (const id of ['video-camera', 'winner-video-camera']) $(id).addEventListener('change', event => {
  if (videoJob || $('video-dialog').open) return;
  videoCameraMode = event.target.value === 'all' ? 'all' : 'follow';
  for (const target of ['video-camera', 'winner-video-camera']) $(target).value = videoCameraMode;
  renderHUD();
});
if (!videoSupported()) $('video-hint').textContent = '60 fps export needs a browser with video encoding support.';
function closeVideo() { if (videoJob) videoJob.abort(); else $('video-dialog').close(); }
$('video-close').addEventListener('click', closeVideo);
$('video-dialog').addEventListener('cancel', event => { event.preventDefault(); closeVideo(); });
$('video-dialog').addEventListener('close', () => {
  if (videoJob && !videoJob.signal.aborted) videoJob.abort();
  if (videoUrl) { const oldUrl = videoUrl; setTimeout(() => URL.revokeObjectURL(oldUrl), 60000); videoUrl = null; }
  videoFile = null;
  if (!videoReturn) return;
  paused = videoReturn.paused || document.hidden;
  Object.assign(renderer.camera, videoReturn.camera);
  if (playback) {
    playback.playing = videoReturn.playing && !document.hidden; playback.last = 0;
    renderPlayback(); if (playback.playing) replayFrame = requestAnimationFrame(tickReplay);
  } else { render(); scheduleAI(); }
  videoReturn = null;
  renderHUD();
});
$('video-share').addEventListener('click', async () => {
  if (!videoFile) return;
  try { await navigator.share({ files: [videoFile], title: 'Vector Rally' }); }
  catch (error) { if (error.name !== 'AbortError') $('video-status').textContent = 'Sharing is unavailable here. Use Download video to save the file.'; }
});

const observer = new ResizeObserver(() => { renderer.resize(); if (race) { if (!started) renderer.fit(); else if (renderer.camera.following && !$('video-dialog').open) followView(); updateCamera(); } });
renderer.resize(); buildRace(); renderDriverSettings(); renderThemes(); render(); observer.observe($('game'));

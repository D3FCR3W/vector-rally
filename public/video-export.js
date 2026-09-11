import { CELL, createRenderer } from './render.js';
import { sampleReplay } from './replay.js';
import { getTheme, sampleScenery } from './themes.js';

export const VIDEO_FPS = 60;
export const videoSupported = () => typeof globalThis.VideoEncoder === 'function' && typeof globalThis.VideoFrame === 'function';

export function videoDriverId(cars, selectedId) {
  return cars.find(car => car.id === selectedId)?.id ?? cars.find(car => car.control === 'human')?.id ?? cars[0]?.id;
}

export function videoCamera(cars, followedId, mode = 'follow') {
  if (mode === 'all') {
    // Keep every car inside the unobstructed road area: below the header,
    // above the standings and to the left of the mini-map, with room for jumps.
    const xs = cars.map(car => (car.x + .5) * CELL), ys = cars.map(car => (car.y + .5) * CELL);
    const left = Math.min(...xs) - 2 * CELL, right = Math.max(...xs) + 2 * CELL;
    const top = Math.min(...ys) - 2 * CELL, bottom = Math.max(...ys) + 2 * CELL;
    const zoom = Math.min(1.65, 936 / (right - left), 480 / (bottom - top));
    return { x: (left + right) / 2 + 140 / zoom, y: (top + bottom) / 2 + 20 / zoom, zoom };
  }
  const car = cars.find(car => car.id === followedId);
  return { x: (car.x + .5) * CELL, y: (car.y + .5) * CELL + 17 / 1.65, zoom: 1.65 };
}

export function videoFilename(seed, mimeType, date = new Date()) {
  const safeSeed = String(seed).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'race';
  return `vector-rally-${safeSeed}-${date.toISOString().replace(/[:.]/g, '-')}.${mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
}

// A separate renderer keeps live state, camera, scenery and replay controls untouched.
export function createVideoScene({ race, recording, themeId, seed, ambience = true, trailStyle = 'mixed', reduced = false, showPaths = false, followedDriverId, cameraMode = 'follow', canvas }) {
  const track = document.createElement('canvas'), effects = document.createElement('canvas'), map = document.createElement('canvas');
  map.width = 248; map.height = 168;
  const renderer = createRenderer(track, map, effects), ctx = canvas.getContext('2d');
  canvas.width = 1280; canvas.height = 720;
  renderer.resize({ width: 1280, height: 720 });
  renderer.setTrack(race.track, themeId); renderer.setTrailStyle(trailStyle);
  renderer.camera.zoom = 1.65;
  const followedId = videoDriverId(recording.cars, followedDriverId);
  const theme = getTheme(themeId), duration = recording.duration / 4 + 3;
  const initialScenery = recording.scenery || renderer.captureScenery();
  const recordedSceneryMoves = recording.events.some(event => event.scenery && event.scenery.elapsed > initialScenery.elapsed + 1e-7);
  function draw(seconds) {
    const time = Math.max(0, Math.min(recording.duration, (seconds - 1) * 4));
    const replay = sampleReplay(recording, time);
    // Reduced-motion games (and old recordings without scenery samples) still
    // produce a living video. This cosmetic clock never alters recorded turns,
    // wildlife collisions, or the live world's state. Moving recordings retain
    // their recorded wildlife timing, including reactions to approaching cars.
    if (ambience && !recordedSceneryMoves) replay.scenery = sampleScenery(initialScenery, time);
    canvas.dataset.sceneryTime = String(replay.scenery?.elapsed ?? 0);
    const followed = replay.cars.find(car => car.id === followedId);
    // Follow the interpolated position directly: at 4× a lagging camera can
    // lose fast cars. Keep a readable, fixed scale through turns and crashes.
    Object.assign(renderer.camera, videoCamera(replay.cars, followedId, cameraMode));
    canvas.dataset.replayTime = String(time);
    canvas.dataset.followedDriver = String(followedId);
    canvas.dataset.cameraMode = cameraMode;
    canvas.dataset.cameraX = String(renderer.camera.x); canvas.dataset.cameraY = String(renderer.camera.y);
    canvas.dataset.zoom = String(renderer.camera.zoom);
    canvas.dataset.carSize = String(CELL * renderer.camera.zoom);
    renderer.draw({ ...race, cars: replay.cars }, { started: true, replay, recording, ambience, reduced, showPaths, time: seconds * 1000,tunnelViewIds:cameraMode==='all'?replay.cars.map(c=>c.id):[followedId] });
    canvas.dataset.revealedTunnels=track.dataset.revealedTunnels;
    canvas.dataset.effectRenderer = effects.dataset.renderer;
    canvas.dataset.particles = effects.dataset.particles;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(track, 0, 0);
    // Read the WebGL layer in the same task as drawing, before its buffer is cleared.
    if (effects.dataset.renderer === 'webgl') ctx.drawImage(effects, 0, 0);
    if (cameraMode === 'all' && renderer.camera.zoom < .75) {
      // Keep widely separated cars identifiable when the adaptive view zooms out.
      for (const car of replay.cars) {
        const p = renderer.screen((car.x + .5) * CELL, (car.y + .5) * CELL);
        ctx.strokeStyle = car.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#19282bf2'; ctx.fillRect(p.x - 9, p.y - 29, 18, 17);
        ctx.fillStyle = car.color; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
        ctx.fillText(String(car.id + 1), p.x, p.y - 16);
      }
    }
    ctx.fillStyle = '#19282bf2'; ctx.fillRect(0, 0, 1280, 66); ctx.fillRect(0, 620, 1280, 100);
    ctx.textAlign = 'left'; ctx.fillStyle = theme.accent; ctx.font = 'bold 24px monospace';
    ctx.fillText('VECTOR RALLY', 26, 41);
    ctx.fillStyle = '#f5f1df'; ctx.font = '16px monospace'; ctx.fillText(`${theme.name} · ${seed}`, 260, 40, 580);
    ctx.textAlign = 'right'; ctx.fillText(`4× · ${time.toFixed(1)} / ${recording.duration} s`, 1254, 40);
    ctx.fillStyle = '#19282bf2'; ctx.fillRect(1000, 82, 264, 209);
    ctx.textAlign = 'left'; ctx.fillStyle = theme.accent; ctx.font = 'bold 13px monospace';
    ctx.fillText(cameraMode === 'all' ? 'ALL DRIVERS' : `FOLLOWING ${followed.name}`, 1008, 102, 248);
    ctx.drawImage(map, 1008, 113, 248, 168);
    const column = 1232 / replay.cars.length;
    for (const [index, car] of replay.cars.entries()) {
      const x = 24 + index * column;
      ctx.fillStyle = car.color; ctx.fillRect(x, 640, 12, 12);
      ctx.fillStyle = '#f5f1df'; ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace';
      ctx.fillText(`${car.id + 1}. ${car.name}`, x + 22, 652, column - 36);
      ctx.fillStyle = '#b9c6bd'; ctx.font = '14px monospace';
      ctx.fillText(car.wrecked?'OUT':`${car.turns} turns · ${car.crashes} crashes`, x, 675, column - 18);
      if(car.health){ctx.font='11px monospace';ctx.fillText(`T ${car.health.tires} · E ${car.health.engine} · B ${car.health.body}`+(car.oilTurns?` · OIL ${car.oilTurns}`:car.punctureTurns?` · TIRE ${car.punctureTurns}`:''),x,700,column-18);}
    }
    if (seconds < 1 || time >= recording.duration) {
      const winner = race.winner === null ? null : replay.cars[race.winner];
      const title = seconds < 1 ? 'THE STARTING GRID' : winner ? `${winner.name} takes the flag!` : race.ended ? 'NO CAR FINISHED' : 'RACE REPLAY';
      ctx.fillStyle = '#19282bee'; ctx.fillRect(300, 285, 680, 115);
      ctx.textAlign = 'center'; ctx.fillStyle = theme.accent; ctx.font = 'bold 28px monospace'; ctx.fillText(title, 640, 333, 630);
      ctx.fillStyle = '#f5f1df'; ctx.font = '16px monospace';
      ctx.fillText(seconds < 1 ? 'One lap. Every move counts.' : winner ? `${winner.turns} turns · ${winner.crashes} crashes · ${winner.jumps} jumps` : 'Every recorded turn, from the starting grid.', 640, 371, 630);
    }
  }
  return { draw, duration, dispose: () => renderer.dispose() };
}

// Generate every frame at its exact presentation time. Rendering/encoding may
// take longer on slower devices, but never drops frames or changes movie speed.
export async function exportReplayVideo(options) {
  const { canvas, signal, onProgress = () => {} } = options;
  if (!videoSupported()) throw new Error('60 fps video export is unavailable in this browser. Try a current version of Chrome, Edge or Safari.');
  if (!options.recording.events.length) throw new Error('Take a turn before exporting a replay.');
  signal?.throwIfAborted();
  let scene, output, finalized = false, cancellation;
  let frame = 0, frameCount = 1;
  const cancel = () => cancellation ||= output?.cancel().catch(() => {});
  // Bound stalled encoders and make cancel responsive even during finalization.
  const wait = promise => new Promise((resolve, reject) => {
    const abort = () => { cancel(); done(signal.reason || new DOMException('Export cancelled.', 'AbortError')); };
    const timer = setTimeout(() => { cancel(); done(new Error('Video encoding timed out. Please try again.')); }, 30000);
    function done(error, value) { clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); }
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => done(null, value), done);
    if (signal?.aborted) abort();
  });
  const progress = () => onProgress({ progress: frame / frameCount, paused: document.hidden });
  const visible = () => new Promise((resolve, reject) => {
    const check = () => {
      if (document.hidden && !signal?.aborted) return;
      document.removeEventListener('visibilitychange', check); signal?.removeEventListener('abort', check);
      signal?.aborted ? reject(signal.reason) : resolve();
    };
    document.addEventListener('visibilitychange', check); signal?.addEventListener('abort', check, { once: true }); check();
  });
  document.addEventListener('visibilitychange', progress);
  try {
    const { Output, BufferTarget, CanvasSource, Mp4OutputFormat, WebMOutputFormat, canEncodeVideo } = await wait(import('./vendor/video-codecs.js'));
    const encoding = { width: 1280, height: 720, bitrate: 12_000_000, latencyMode: 'quality' };
    let codec;
    for (const candidate of ['avc', 'vp9', 'vp8']) {
      if (await wait(canEncodeVideo(candidate, encoding))) { codec = candidate; break; }
    }
    if (!codec) throw new Error('60 fps video export is unavailable in this browser. No compatible video encoder was found.');
    signal?.throwIfAborted();
    // Shared videos include full particles, regardless of the live UI's reduced
    // motion preference. The preference itself and live game remain untouched.
    scene = createVideoScene({ ...options, reduced: false });
    frameCount = Math.ceil(scene.duration * VIDEO_FPS);
    canvas.dataset.fps = String(VIDEO_FPS);
    const format = codec === 'avc' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
    output = new Output({ format, target: new BufferTarget() });
    const source = new CanvasSource(canvas, { codec, bitrate: encoding.bitrate, latencyMode: 'quality', keyFrameInterval: 2 });
    output.addVideoTrack(source, { frameRate: VIDEO_FPS });
    await wait(output.start());
    while (frame < frameCount) {
      await visible(); signal?.throwIfAborted();
      scene.draw(frame / VIDEO_FPS);
      // CanvasSource snapshots the composed 2D+WebGL pixels synchronously.
      const added = source.add(frame / VIDEO_FPS, 1 / VIDEO_FPS);
      frame++; progress(); await wait(added);
      // Yield for preview painting and cancel clicks, independently of monitor Hz.
      if (frame % 4 === 0) await wait(new Promise(resolve => setTimeout(resolve, 0)));
    }
    await visible();
    await wait(output.finalize()); signal?.throwIfAborted();
    finalized = true;
    const blob = new Blob([output.target.buffer], { type: format.mimeType });
    if (!blob.size) throw new Error('The browser produced an empty video. Please try again.');
    return { blob, filename: videoFilename(options.seed, blob.type) };
  } finally {
    document.removeEventListener('visibilitychange', progress);
    if (!finalized) await cancel();
    scene?.dispose();
  }
}

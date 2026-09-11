# Development

[Back to the game overview](../README.md)

Vector Rally uses JavaScript, HTML and CSS, with Canvas graphics and WebGL particles. The local Node.js server serves static files. There is no backend game service or online multiplayer.

## Run and test

Use Node.js 22 or later:

```sh
npm start
npm test
```

The server listens on loopback at port 4173. Set `PORT` to use another port. The game runs without installing dependencies because the browser video bundle is checked in.

The automated tests cover movement, swept collisions, jumps, generation, starting grids, AI, health and repairs, replay sampling, wildlife, effects and camera framing.

## Browser checks

Start the local server, then run a browser script with Microsoft Edge installed. Set `BROWSER_PATH` if Edge is installed in a nonstandard location.

```sh
node --experimental-websocket scripts/smoke.mjs
```

| Script in `scripts/` | Coverage |
| --- | --- |
| `smoke.mjs` | Setup, controls, replay, desktop and mobile layouts |
| `motion-smoke.mjs` | Stable landing warnings and smooth camera movement |
| `group-tunnel-smoke.mjs` | Grouped AI, camera groups, tunnels and video |
| `hazards-smoke.mjs` | Damage, penalties, repair and retirement |
| `video-smoke.mjs` | Real export, decoded frame count, cancellation, failure and cleanup |
| `video-follow-smoke.mjs` | Individual and adaptive export cameras |
| `steering-smoke.mjs` | Heading interpolation and WebM export |
| `wildlife-video-smoke.mjs` | Animated wildlife in encoded video |
| `effects-smoke.mjs` | Particles, reduced motion and graphics fallback |
| `performance.mjs` | Large circuits and long replay profiling |

Screenshots, recordings and measurements are written to `artifacts/`. Live frame rate is hardware-dependent; exported video uses fixed 60 fps timestamps.

## Project structure

| File | Responsibility |
| --- | --- |
| `public/engine.js` | Track generation, momentum, collisions, turns, laps and AI |
| `public/hazards.js` | Traps, repairs and car condition |
| `public/race-view.js` | Human anchors, camera groups and smooth motion |
| `public/mountains.js` | Mountain geometry and tunnel cutaways |
| `public/app.js` | UI, input, turn scheduling and preferences |
| `public/render.js` | Terrain, cars, camera transforms and mini-map |
| `public/themes.js` | Seven world palettes, props and wildlife |
| `public/effects.js` | Deterministic marks and particles |
| `public/replay.js` | Turn recording and replay sampling |
| `public/video-export.js` | Video composition and encoding |
| `public/index.html`, `public/style.css` | Interface, help and responsive layout |
| `server.mjs` | Local static server |
| `tests/` | Automated tests |

## Graphics and replay

The renderer crops terrain to the visible region, caches the mini-map and culls off-screen wildlife. Landing warnings update when grounded occupancy changes. Camera motion uses a damped spring; heading interpolation follows the shortest arc except during oil spins.

Particles use WebGL with a Canvas fallback. Reduced motion suppresses moving particles in live play and replay. Effect budgets limit retained events, marks and particles.

Replay uses cached round snapshots and binary search. Video export uses a separate renderer so encoding does not alter the live game, camera or replay state.

## Rebuild the video bundle

Video encoding uses WebCodecs and Mediabunny. After changing a dependency:

```sh
npm ci
npm run build:video
```

Dependency versions are pinned in the lockfile. The browser bundle and its license are under `public/vendor/`; no external CDN is needed at runtime.

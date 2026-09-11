# Vector Rally

A fullscreen pixel racing game for 1–4 human or AI drivers sharing one screen. Built with HTML, CSS, Canvas, and JavaScript. All interface text and project documentation are in English.

## Play

Use Node.js 22 or later. No packages need installing.

```powershell
cd vector-rally
npm start
```

Open [Vector Rally](http://localhost:4173) or [the IPv4 address](http://127.0.0.1:4173). Both IPv4 and IPv6 loopback connections are supported. Keep the terminal running while you play. Choose your drivers, circuit settings and track seed, then start the race. The same seed and circuit settings produce the same track. Settings are remembered locally; an ongoing race resets when the page reloads.

**Build your circuit** before the race: choose short, medium or long; gentle sweepers, mixed bends or lots of tight turns; and narrow, standard, wide or variable-width roads. The preview updates whenever you change a setting or shuffle the seed. Every circuit keeps a straight, clear starting grid.

Enable **Hidden shortcuts** for optional routes around bends. Look for faint tire tracks and gaps in the verge; these trails blend into each theme instead of appearing as ordinary asphalt. They are drivable, narrower than most roads, and follow the same collision and momentum rules. Their progress follows the bypassed section of the circuit, so a shortcut still requires completing the lap.

**Click the exact track cell where you want to land.** The 3×3 matrix is centered on your current position plus your velocity. Surrounding cells adjust velocity by −1, 0 or +1 on each axis; **center / S / Space** keeps momentum. To brake, choose against your current velocity. At a rightward speed of 2, the landing columns are 1, 2 or 3 cells ahead. **Q W E / A S D / Z X C** and keyboard arrows select the corresponding matrix cell.

The nine blank landing cells move and zoom with the track grid; there are no arrows or letter labels. It disappears immediately after a move and returns only when a human can drive. It stays hidden during AI turns, pause, replay and after finishing. Green is clear; amber warns of a road hazard; red warns of a crash or fatal damage. A crash shows travel to the impact, then parks the car on the last safe road cell. Cars normally face their travel direction and retain that heading when stopped; oil spins can leave them facing backward. Start in the direction your car faces and follow the painted arrows clockwise. The seed varies the departure position and direction (up, right, down or left); every driver starts level on the same horizontal or vertical line, with three clear cells ahead. A short, locally widened grid blends into the surrounding bends instead of a fixed long corridor.

Use the **mouse wheel** to zoom around the cursor, **drag** to pan, and **F / Follow** to return to your car. The **Track** button or mini-map shows the circuit overview. Use **Frame** for **Active human**, **Nearby rivals** (the racer ahead and behind by race progress), **All drivers**, or **Choose drivers** for any nonempty human/AI group. Follow stays with humans during AI turns. Group framing also works in replay; camera choices reset for a new race. The game fills the window; the **Fullscreen** button hides browser chrome. Help and the race menu pause play. Read **How to play** for jumping, collisions, recovery, and lap rules.

Choose **Forest**, **Desert**, **Futuristic**, **Jungle**, **Sky**, **Sea**, or **Space** in **Choose your world** before starting. The illustrated buttons preview the scenery immediately. Forest has birds and deer; Desert has birds and lizards; Futuristic has drones and service rovers. Birds and drones rest, take off when cars approach, fly and land again. Ground wildlife crosses the road in both directions. Ending your move on a grounded animal, landed drone or rover causes a crash. Passing its cell is safe, and flying wildlife does not block the road. An animal moving onto a parked car never triggers a crash. AI uses the same landing checks.

Each world has its own deterministic crash and hidden-route effects:

| World | Hidden-path trail | Crash effect |
| --- | --- | --- |
| Forest | Grass tracks and dirt | Dust, sparks and fragments |
| Desert | Sand ruts | Sandy smoke and amber sparks |
| Futuristic | Selectable neon colors | Mint energy sparks |
| Jungle | Muddy ruts and leaves | Foliage and green dust |
| Sky | White vapor trails | Cloud puffs and frost |
| Sea | Foamy wakes and bubbles | Water spray and bubbles |
| Space | Violet plasma trails | Drifting ion sparks |

Jungle adds palms, ruins, parrots and lizards; Sky adds clouds, balloons, gulls and cloud creatures; Sea adds islets, buoys, gulls and crabs; Space adds stars, planets, asteroids, probes and rovers. Theme selection is remembered. Geometry and movement rules remain the same across worlds.

Particle patterns derive from the recorded action, never wall-clock start time. Rewinding reproduces the same effects; reduced motion applies to live play and replay, while shared videos retain full effects. Particle limits apply to every world. Persistent marks stay confined to hidden paths, and driven-route lines remain an optional replay-only overlay.

**Living scenery** switches wildlife and its landing-cell collisions on or off. Their animation pauses for help, the menu, hidden pages and reduced-motion preferences. Theme and scenery preferences are remembered when you start a race.

**Tire smoke and crash effects** appear automatically: accelerating and sharp turns with sufficient friction emit tire smoke; steady driving and ordinary straight-line braking do not produce tire burn; driving hidden forest paths throws up grass and dirt and leaves wheel tracks. Desert routes kick up sand, while futuristic routes leave green, purple, yellow or mixed neon wheel trails. Choose **Neon trails** in the Futuristic theme setup; the selection is remembered. Crashes emit smoke, sparks and debris at contact. These are cosmetic: road boundaries and collision rules stay the same.

Persistent wheel tracks and route hints are drawn only inside hidden-path cells. Normal roads show no persistent tire marks or driven-route lines during live play. In replay, enable **Show driven paths** to see each car’s completed route and the travelled part of its current move. This option starts unchecked and never applies to live play.

Effects use pixel-styled WebGL shaders with a Canvas fallback when WebGL is unavailable or its context is lost. Reduced-motion mode keeps tire marks but suppresses moving particles. Marks reset with a new race. To keep memory and frame work bounded, the renderer retains at most 96 recent effect events, draws up to 1,536 mark segments and 384 particles, and reconstructs the appropriate effects when replay time changes.

**Watch the full replay** using the ▶ button or **Watch full replay** after finishing. It records every turn, including jumps, crashes and restricted-speed turns. Cars move together by race round with smooth interpolation, targeting the display refresh rate through requestAnimationFrame. Play/pause, drag the timeline, step backward or forward by round, and select **0.25×, 0.5×, 1×, 1.5×, 2× or 4×** speed. At 1×, one round takes one second. Playback preserves the live race and camera so you can return to your turn. Frame rate depends on the browser and display; replay recording lasts until a new race or page reload.

**Export video** downloads the entire recorded race in one click, from the finish screen or the replay panel. The 1280 × 720 video uses your chosen camera at **60 fps**, with a mini-map, driver names and turn/crash counts. Choose **Video camera** before exporting: **Follow a driver** keeps a close-up on the participant selected under **Video follows**; **All drivers** adjusts the camera position and zoom to keep every car inside the unobstructed road area, even when they spread out. The default is the first human driver in starting-grid order, or the first car in an all-AI race, regardless of the winner. Both export entry points share the choice for the current race; a new race restores the player-following default. All drivers preserves the individual choice for switching back. The result card still names the actual winner. Export runs at **4× speed** (four rounds per second), independently of the replay slider and speed. The opening stays visible for one second and the result card for two seconds. **Show driven paths** is included if enabled. Full smoke, impact particles and world effects are included even when the live UI uses reduced motion. No sound is recorded.

The browser creates every frame locally at an exact 1/60-second interval using WebCodecs and [Mediabunny](https://mediabunny.dev/guide/media-sources). Slow devices take longer to prepare the file, without skipping frames or changing the video duration. Keep the tab open; switching tabs pauses generation until you return. You can cancel at any time. Export preserves the live race, camera and replay position. A completed file downloads automatically; **Download video** lets you save it again, and **Share video** opens the system share sheet when file sharing is available. MP4/H.264 is preferred, with a 60 fps WebM/VP9 or VP8 fallback. Browsers without compatible video encoding show an explanation. Refreshing or leaving the page cancels an unfinished export; downloaded videos remain saved.

Cars translate and turn progressively in live play, replay and video. Orientation follows the shortest arc with eased endpoints throughout the move: a 170° to −170° change passes through 180°, without spinning around. Seeking samples the same pose in either direction. This changes only animation, preserving vector movement and collision rules; live reduced-motion mode retains its shorter move animation.

With **Living scenery** enabled, replay samples the recorded wildlife clocks continuously: wingbeats, walking, take-off, landing and cycle boundaries animate between rounds. Export preserves that recorded motion. If a recording has only frozen wildlife snapshots (for example from reduced-motion play), or no scenery snapshots, export animates the world's creatures visually from the race time. This fallback does not reconstruct historical animal positions or alter recorded collisions and results. Pausing/seeking remains deterministic; scenery-off hides the wildlife.

This version supports local shared-screen play. It does not include online multiplayer or saved playable races.

## Verify

```powershell
npm test
```

The engine suite checks momentum, exact landing cells, acceleration, braking and coasting, swept collisions and exact corner contact, jumps and landing, three-turn speed restrictions, translation before impact, seeded tracks and starting grids, legitimate finishes, AI braking, and solo and four-driver AI races.

With the local server running, run the browser smoke test using an installed Edge browser:

```powershell
node --experimental-websocket scripts/smoke.mjs
```

Set `BROWSER_PATH` if Edge is installed elsewhere. The script checks desktop and mobile layouts, race setup, a human move followed by an AI turn, help, replay, and track regeneration. Screenshots are saved in `artifacts/`.

Run `node --experimental-websocket scripts/video-smoke.mjs` for video export checks: real MP4 download, native decoding of every frame, exact 60 fps and duration under CPU throttling, shader pixel comparison with reduced motion enabled, hidden-tab pause, cancellation, encoder failure, unsupported browsers, encoder cleanup, preserved race/replay state, mobile layout and export from a completed race. Test videos are saved in `artifacts/video-downloads/`. Run `node --experimental-websocket scripts/steering-smoke.mjs` for actual live/replay steering transitions and native decoding of the WebM fallback at 60 fps.

The browser codec bundle is included in `public/vendor/`; the game still runs with `npm start` without a build step or external CDN. To regenerate that bundle after a dependency change, run `npm ci` then `npm run build:video`. Versions are pinned in the lockfile; the vendor license is included alongside the bundle.

Run `node --experimental-websocket scripts/wildlife-video-smoke.mjs` to verify moving wildlife in an encoded 60 fps video with a stationary car and fixed camera, including recordings made with reduced motion, backwards seeking and unchanged race state.

## AI passes and mountain tunnels

Consecutive AI drivers now animate **together in one smooth pass**, stopping before the next human turn. Collision resolution stays in ordinary seat order, and each move is recorded once. The camera keeps its human anchor during the pass; all-AI races default to framing everyone.

Rocky mountains conceal sections of some hidden shortcuts. Look for dark stone entrances: the roof fades to reveal the lit interior around the drivers you are viewing, then returns when they leave. Open worn paths remain available. Underground movement follows the normal road, damage and lap rules. Replay and video reproduce the cutaway from the sampled positions. Turning Hidden shortcuts off removes tunnels while retaining decorative mountains.

See the [AI, camera and tunnel change record](audit/ai-camera-tunnels.md) for rules, tests, screenshots and Studio synchronization.

## Traps, condition and repairs

Every car has separate **Tires, Engine and Body** bars. If any reaches zero, that car retires permanently. Other drivers continue; if everyone retires, the race ends without a winner.

- **Potholes** damage tires and body without stopping or slowing the car.
- **Hard crashes** damage parts and leave oil. Crossing oil forces straight momentum and a full spinning animation for the next **three personal turns**; only center is allowed.
- **Police spikes** deploy from round 2. Crossing a strip damages tires and allows only braking for **three personal turns**. Wait with center once stopped. Oil takes priority when both penalties overlap.
- **Repair lane:** follow the cyan, one-cell-wide PIT detour and pass its white service cross. All parts recover fully and every penalty clears, without stopping. Reach it before a part fails.

Amber targets warn of road hazards; red warns of a crash or fatal damage. Replay and video preserve spins, historic condition, oil and retirement. See the [rules and verification record](audit/hazards-and-repair.md) for damage values, precedence, tests and Studio synchronization.

## Rendering performance

The renderer crops terrain to the visible region, reuses a pre-scaled mini-map, culls off-screen wildlife and updates landing warnings only when grounded occupancy changes. Replay uses cached round snapshots and binary search instead of scanning every prior turn on each frame.

With the server running, use `node --experimental-websocket scripts/effects-smoke.mjs` to verify effects, and `node --experimental-websocket scripts/performance.mjs` to profile a long technical circuit and 4,000 recorded events. Results and screenshots are written to `artifacts/`. The measured comparison is in `audit/performance.json`; frame rate varies with hardware and browser. The effects stress check observed about 60 FPS with 106 particles at 1440×900.

## Project

The current code is the authority for product behavior and design. Studio Lyriks project **Vector Rally** (`vector-rally-d60551`) has been updated from this baseline: 26 inventoried capabilities, 13 behavior features, 13 data entities and 7 Experience screens. See the [reconciliation report](audit/design-code-reconciliation.md) for actual verification and remaining gaps.

The [2026-09-10 design and behavior reference](audit/design-code-reference.md) captures the actual screen anatomy, English copy, seven world palettes, responsive layouts, controls, states and acceptance cases. Its [enumerated evidence inventory](audit/design-code-inventory.json) and frozen source snapshot preserve the local review. This reference has now informed the Studio updates. The local game remains the executable authority for pixel graphics, camera and racing geometry; the Experience is an approximation with documented gaps.

- `public/engine.js`: deterministic tracks, movement, collisions, jumps, laps, and AI.
- `public/race-view.js`: human anchors, nearby/custom groups, adaptive framing and shared motion poses.
- `public/mountains.js`: seeded mountain ridges, concealed shortcut sections and sampled roof cutaways.
- `tests/race-view.test.mjs`: grouped AI turns, framing and tunnel geometry.
- `public/hazards.js`: police strips, one-cell pit lanes, part condition, oil, damage and repair.
- `tests/hazards.test.mjs`: penalties, damage, retirement, repair, generated facilities and replay state.
- `public/app.js`: controls, rendering, turn scheduling, and local preferences.
- `public/themes.js`: theme registry, landscape artwork, wildlife occupancy and pixel sprites. Add future themes here with a palette, prop/wildlife artwork and an `effects` profile; the setup choices and event visuals use the registry.
- `public/replay.js`: complete turn recording, simultaneous round interpolation, wildlife snapshots and playback timing.
- `tests/replay.test.mjs`: exact replay endpoints, rewind, simultaneous cars, full history, jump/crash/limited-speed motion and timing.
- `public/render.js`: pixel sprites, visible terrain cropping, movement animation, camera transforms and cached mini-map.
- `public/effects.js`: deterministic tire/grass marks, smoke, sparks and debris; one WebGL particle batch with Canvas fallback.
- `tests/effects.test.mjs`: contact timing, replay-safe sampling, surface marks, reduced motion and bounded effects.
- `public/index.html` and `public/style.css`: responsive interface and rules.
- `tests/engine.test.mjs`: gameplay verification.
- `tests/generation.test.mjs`: 72 circuit-setting combinations, 96 varied starting grids, four-direction finish checks, seed variation, road width, track length, hidden-route traversal and progress.
- `tests/themes.test.mjs`: deterministic scenery, bird lifecycle, continuous crossings, grounded occupancy and harmless animal motion onto parked cars.
- `server.mjs`: local static server, bound to loopback.

The AI searches three turns ahead and checks whether it can brake safely. If another driver blocks that route, it chooses a clear move with low speed; when all moves collide, it brakes as hard as possible and receives the same crash penalty as a human. Every surviving crash normally limits the car to one grid cell per turn for the next three personal turns, including diagonal steps; oil and puncture restrictions take priority. There are no skipped turns. Cells requiring a higher speed are disabled without consuming a turn. Normal acceleration returns after the third restricted turn. Cars retain the distance actually travelled before impact; the AI still excludes crashes from its progress ranking.

## Audit

The historical local audit is in `audit/report.json`; `.unspa.json` retains reviewed implementation references. Source code stays local. `npm run audit:local` checks that frozen baseline and will now report changed hashes for the new export implementation. Do not treat it as a current completion certificate. The [video export change record](audit/video-export.md) describes the close-up / 4× addition, its browser verification and its synchronization into Lyriks (24 new passing behavior scenarios). The current scope has 26 capabilities and 13 features; whole-project Studio blockers remain explicit.

**Studio specification updates are saved; whole-project validation remains blocked.** The prior 119-scenario baseline is supplemented by 22 passing car-condition scenarios; the updated obstacle model also passes. Native Canvas fidelity and two stale generated Experience replay bindings remain unresolved. Historical implementation mappings have not been re-certified; their old `pending_spec` / `pending_auth` labels are historical, not the current connection status.

Local verification includes circuit generation, movement, replay, effects and wildlife tests, plus desktop/mobile browser checks. The [starting-grid change record](audit/organic-starts.md) covers varied departure positions, equal starting progress and direction-aware finishes. Mapping coverage measures traceability, not exhaustive testing.

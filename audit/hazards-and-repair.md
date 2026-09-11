# Road hazards, car condition and repair

Updated 2026-09-11. The running game remains the design authority.

## Rules

Each car has separate tires, engine and body condition. Tires and engine start at 6, body at 8, plus `min(4, floor((holes + police strips) / 8))` for every part. All cars on the same circuit have the same capacities. Any part reaching zero permanently retires the car. Turn order skips retired cars; the survivors continue. If all cars retire, the race ends without a winner, retaining replay, export and Race again.

| Contact | Damage | Consequence |
| --- | --- | --- |
| Grounded pothole, including a corner touch | Tires −1, body −1 per hole | Keep momentum; no crash or speed malus unless the damage is fatal |
| Police spikes, active from round 2 | Tires −2 once per move | Three future personal turns of braking only; wait when stopped |
| Oil | None directly | Three future personal turns of unchanged straight momentum, with a 540° spin per turn |
| Crash | Tires −1; body −severity; engine −(severity−1) | Stop at the last safe cell; surviving cars receive the ordinary three-turn speed restriction |
| Pit service cross | Restore all parts | Clear oil, puncture and crash penalties without stopping |

Crash severity is 1 below speed 3, 2 below speed 6, otherwise 3. Speed is the attempted movement vector's length. Crashes at speed 3 or above leave persistent oil on the last safe cell, except inside the repair lane. Oil clears with a new race.

Penalty turns belong to the affected driver; opponents' turns do not count. A fresh contact resets its penalty. Oil takes priority over puncture; both counters still elapse. Puncture permits reducing existing velocity components toward zero, never increasing a component, starting a new perpendicular component or reversing. A moving punctured car must brake on at least one axis. At rest it may wait. Oil and puncture restrictions take priority over the ordinary crash speed cap.

A ramp skips road hazards in its airborne cell. Contacts resolve in path order. A car destroyed before a later service crossing stops at the fatal cell and cannot be revived. The cyan PIT bypass is one cell wide, reconnects with the main road, and has one white service cross. It credits only the local circuit arc it bypasses. Its layout and police positions are seeded and kept away from the starting grid. Wildlife home positions avoid the repair route. Repairs do not require a stop or extra action.

## Interface and playback

The current-turn HUD shows three named current/maximum bars and explicit penalty instructions. Amber landing targets warn of hazards, red of crashes or fatal damage. Cars show condition bars and OIL, TIRE or OUT labels. Police stand beside their strip; oil has a dark reflective surface, and the narrow repair lane is cyan. The help contains ten rules.

Replay snapshots copy condition, counters, retirement and oil before/after moves. Oil spins retain their full rotation rather than taking a shortest angular path. Rewinding hides future spills. The same rendering is included in 4×, 720p, 60 fps export, with part values and status in standings and NO CAR FINISHED when everyone retires. Camera selection and first-human default remain available.

## Verification

- `npm test`: 56/56 pass. Ten hazard tests cover damage-only holes, three personal turns, overlap precedence, crash severity, service repair, fatal-before-repair, retirement, jumping and replay snapshots. Generated pit routes are checked across 36 circuit configurations for single-cell connectivity, usable service cells and bounded local progress.
- `scripts/smoke.mjs`: desktop/mobile controls, themes, scenery, camera and replay passed. Display cadence observed 58.7 fps; live playback remains hardware-dependent.
- `scripts/hazards-smoke.mjs`: actual browser HUD, oil-locked input, spin replay, generated pit repair, deployed police spikes, mobile and all-retired result passed without browser errors. Test access is injected into the fetched module by the browser harness, not shipped in the app.
- The exported MP4 decoded all 210 frames over 3.5 seconds at exactly 60 fps. Evidence: `artifacts/hazards-check.json`, `oil-penalty.png`, `oil-spin-replay.png`, `pit-repair.png`, `police-puncture.png`, `vehicle-health-mobile.png`, `retired-race.png`.

## Studio synchronization

Project `vector-rally-d60551` now inventories 23 capabilities and 13 features. The new Survive traps and repair the car feature has three actions, typed part state, restrictions, 22 passing scenarios and three invariants. Its bounded model check found no invariant violations; exploration was truncated at 180 states, so it is not an exhaustive proof. Existing obstacle behavior still passes its four scenarios.

Updated related feature descriptions and acceptance criteria, damage-only hole rules, data fields, the current-turn HUD component, ten help rules, retirement-result copy and replay/export requirements. All four Experience journeys pass. The Experience demonstrates the healthy condition HUD and conditional all-retired copy; actual contact geometry, generated pits, spins and damage execute in the game, not the Studio prototype.

The final whole-project audit remains blocked at 94: Experience is deliberately not assessed as a faithful native renderer, and project coherence retains two existing blockers. Local passing tests and saved spec changes do not certify whole-project completion. Source uploads were rejected by automatic approval review earlier in the session; concise product specifications were saved successfully, while implementation evidence mappings were not re-certified. Historical frozen audit files remain historical.

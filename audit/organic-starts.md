# Organic starting grids

Updated 2026-09-10. The running game is the design authority.

## Behavior

The circuit seed now varies the departure position, initial cardinal direction and length of the short starting straight. Only the area around the grid widens to accommodate every driver, with a gradual transition into the selected road width. Adjacent bends follow the generated circuit instead of a fixed long top corridor. The same seed and settings remain reproducible, although layouts differ from the previous generator.

All one to four drivers start stopped, side by side, at the same longitudinal position and lap progress. The line is horizontal or vertical, perpendicular to the cars' heading; there are no diagonal or staggered grids. Each seat has three clear forward cells. Ramps, holes and initial wildlife placement protect this launch area. This guarantees a level grid and equal immediate clearance, not identical racing lines through later bends.

The checkerboard, launch arrows, car headings, start announcement and help follow the generated direction. A valid finish must cross that same line forward within its road width after the lap and checkpoints, without crashing. Replay and video reuse those positions and headings.

## Verification

- `npm test`: 44/44 passing, including 96 varied starting grids, 72 circuit-setting/seed combinations, four-direction finishes, AI races, wildlife, replay and effects.
- `scripts/start-smoke.mjs`: actual browser launches for four human drivers in every cardinal direction, replay seeking and mobile layout; no browser errors.
- `scripts/smoke.mjs`: desktop/mobile controls, momentum, wildlife collisions, crash restrictions, replay, themes and camera controls passed. Keyboard-specific fixtures explicitly select a suitable direction rather than assuming every shuffled track starts right.
- `scripts/steering-smoke.mjs`: progressive live/replay steering passed; exported WebM decoded all 195 frames at 60 fps over 3.25 seconds. Live display cadence remains hardware-dependent.
- See `artifacts/start-check.json`, `artifacts/varied-starts.png` and `artifacts/steering-check.json` for local evidence.

## Studio synchronization

Updated the procedural circuit, setup and finish features, their acceptance criteria, two prose scenarios, and the visible racing help. The Track screen explicitly describes its right-facing example as static; Studio does not run the procedural generator.

The three existing behavior models pass all 24 executable scenarios, and all four Experience navigation journeys pass. Those models abstract geometry; the local generation and browser tests above verify actual level grids and directional crossings. `artifacts/studio-starts-sync.json` records the checks.

The whole-project audit remains blocked at 94: Experience is not assessed ready, and project health retains two blocking gaps. This is distinct from the completed starting-grid change. Native Canvas fidelity and historical implementation mappings have not been re-certified by this update.

# Vector Rally — code-derived Experience reference

Reviewed 2026-09-10. Project: `vector-rally-d60551`.

Status: **used to reconcile the authenticated Studio project on 2026-09-10; Experience remains partially aligned**. See [the reconciliation report](design-code-reconciliation.md) for saved changes, 119 passing behavior scenarios, final blockers and mapping limitations. The 28 historical `pending_spec` entries are implementation records, not 28 distinct features.

The current product is authoritative. Keep its English copy, visual hierarchy, settings, rules and limitations. Source evidence and the enumerable UI/control inventory are recorded in `design-code-inventory.json`. No gameplay or design source was changed for this review.

## Design identity

Source: `public/style.css`, `public/themes.js`, `public/index.html`.

The game occupies the full viewport with a pixel circuit behind floating panels. There is no dashboard, side navigation or separate landing page. Preparation, victory and replay are layers over the same circuit; help and the race menu are modal dialogs.

| Role | Current value |
| --- | --- |
| Main text | `#f5f1df` |
| Secondary text | `#b9c6bd` |
| Floating panel | `#19282bee` |
| Setup panel | `#19282bf5` |
| Dialog | `#19282b` |
| Border | `#ffffff24`; setup/dialog border `#72827a` |
| Ordinary button / hover | `#223438` / `#34494c` |
| Input | `#101e22` |
| Main interface type | Courier New, monospace |
| Headings and explanatory prose | Arial, sans-serif |
| Corner radii | ordinary button 4 px; primary/input 3 px; setup/dialog/replay 8 px; HUD 6 px |
| Clear landing cell | border `#a0edaa`, fill `#8ce99a30` |
| Dangerous landing cell | border `#ff8070`, fill `#df483930`, small × marker |
| Keyboard focus | 3 px accent outline, offset 3 px |

The stylesheet fallback accent is `#ffc857`; the running app replaces it with the selected world's accent. The initial Forest accent is **`#ffd174`**, not the fallback. Main buttons have a lower solid shadow. The ordinary hover background and primary hover `#ffdb88` remain those of the actual stylesheet.

| World, in display order | Subtitle | Accent | Ground | Living scenery |
| --- | --- | --- | --- | --- |
| Forest | Woodland trails | `#ffd174` | `#47754c` | birds and deer |
| Desert | Sun & sandstone | `#ffd59a` | `#d6b071` | birds and lizards |
| Futuristic | Neon after dark | `#81e6f2` | `#172639` | drones and rovers |
| Jungle | Lost canopy | `#bce969` | `#244f38` | parrots and lizards |
| Sky | Above the clouds | `#f4e49b` | `#7daecf` | gulls and cloud creatures |
| Sea | Tidal circuit | `#91e8df` | `#236a81` | gulls and crabs |
| Space | Orbital drift | `#d0a5ff` | `#151529` | probes and rovers |

Extract theme descriptions verbatim from the registry. World illustrations are pixel artwork, not generic icons. Preserve transparent layers, the visible circuit, the car sprites and map. If the Experience renderer cannot reproduce the canvas, record that limitation on the affected screen and use an actual captured circuit as visual evidence; a static image cannot certify playable racing.

## Screens and layers

### 1. Race preparation — initial state

Source: `public/index.html` setup panel; `renderDriverSettings`, `renderThemes`, `renderTrackSettings`, setup submit in `public/app.js`.

The blurred circuit remains visible behind a centered, scrollable dark card. Copy, in order:

- `LOCAL MULTIPLAYER · 1–4 DRIVERS`
- `Pick your line.` / accent line `Make your move.`
- `A little momentum. A lot of racing.` / `Click your next square and you're off.`
- `CHOOSE YOUR WORLD`: seven illustrated choices, selected border, subtitle and full description; `Living scenery`, with `Watch your landing cell`; `Neon trails` appears only for Futuristic.
- `BUILD YOUR CIRCUIT`: Length, Corners, Road width; `Hidden shortcuts`; the actual hint about worn tire tracks, verge gaps and maintenance trails; circuit preview; live lap length, bends and road-width summary.
- `TRACK SEED`: required input, maximum 40 characters, default `RALLY-2026`; shuffle button.
- `THE STARTING GRID` / `CONTROL`: colored car chip, required name of at most 18 characters, Human/AI control and remove button for each driver.
- `+ Add a driver`; `LET'S RACE →`; `No timer. No sign-up. Just one more race.`

Defaults: You/Human and Atlas/AI; Forest; living scenery on; Medium circuit / Mixed bends / Standard; hidden shortcuts on; Mixed colors for neon trails. Length choices are Short sprint, Medium circuit, Long endurance. Corners: Gentle sweepers, Mixed bends, Lots of tight turns. Width: Narrow, Standard, Wide, Variable width. Neon: Mixed colors, Green, Purple, Yellow.

The last remaining driver cannot be removed; Add is disabled at four. Name and control update the corresponding driver, not an arbitrary selected row. New drivers are Human; names follow the current list position. Seed and circuit changes regenerate the preview; world changes update artwork and accent without changing the circuit geometry. Native required-field validation blocks empty fields; trimmed whitespace falls back to the default seed or Driver N at submission.

Settings are saved when a race starts. A valid saved setup restores seed, drivers, world, living scenery, circuit options and neon selection; invalid/unknown choices fall back as implemented. Unavailable storage does not prevent play. Reload starts at preparation and loses the ongoing race and recording.

Desktop at width ≥850 px: card width 820 px; world choices left and circuit settings right; seed left and drivers right below; race button left and Add right. Seven worlds form four columns. At ≤600 px: three world columns, circuit selectors stacked, card constrained to viewport height, overlay scrollable. The later CSS rules override earlier short-viewport layout declarations; transcribe the final cascade.

### 2. Live race and track overview

Source: `render`, `renderHUD`, `renderTargets`, camera handlers in `public/app.js`; `controls`, `draw`, camera methods in `public/render.js`.

Shared chrome: brand top left; `ROUND 01 · LAP 1 / 1` and `CLOCKWISE ↻`; top-right replay, help, fullscreen and menu buttons. Camera controls are below on the right: +, −, Follow and Track. Mini-map is bottom left with `CIRCUIT MAP`, seed and `CLICK MAP FOR OVERVIEW`. The overview is a camera state, not a different product page.

The bottom HUD shows the active driver's colored chip, HUMAN DRIVER or AI DRIVER, name/turn, speed in CELLS / TURN, percentage and `0 / 3 CHECKPOINTS`. The selected car has a white outline and a number. Cars face actual travel and retain their heading at rest. A temporary announcement displays start, jump, crash or camera feedback.

The **nine blank destination cells** are positioned in the track itself, centered on current position plus current velocity. They scale and pan with the road grid. Do not restore a floating directional pad, arrow glyphs, letter labels or a center brake control. Hover/focus draws the path, destination and impact marker and updates the HUD with coordinates, velocity, jump/crash or blocked reason.

Distinct states to model: human ready, hover/focus preview, moving, AI planning, crash contact/settling, next three personal turns at limited speed, paused, and finished. The matrix exists only when a human can drive: race started, no animation lock, not paused, no winner, human active. Limited-speed drivers still see and use valid cells. Invalid faster cells are disabled and do not spend a turn. Replay also hides it by pausing the race.

HUD messages include `Choose your landing square. Center keeps momentum.`, `On the move…`, `Planning a line and checking the braking distance…`, `Race paused. Ready when you are.`, and `Speed limit 1 · N turns remaining. You can drive.` Use the exact source's priority between these states.

On mobile, brand and buttons occupy the first row, race information the next row; camera labels are hidden; keyboard hint is hidden; the HUD moves above the lower play area and the mini-map shrinks. At height ≤600 px the mini-map is hidden. World and controls continue to fill the window without a separate mobile navigation.

### 3. How to play

Source: help dialog in `public/index.html`; `openDialog` and dialog close handlers.

Overlay dialog: close ×, `THE RULES OF THE ROAD`, `Click. Drive. Brake.`, all eight ordered rules, keyboard help, `Got it. Let's race. →`. The topics are one-click destinations; speed/braking; whole-path collision; jumps; three limited-speed driving turns after crashes; living worlds; full clockwise lap; wildlife on the landing cell. Copy the current HTML, including Center/S/Space keeping momentum.

Opening pauses the race and scenery and hides destinations. Closing restores whether the race was already paused; it does not always force immediate play. Keyboard driving is suppressed while the dialog is open.

### 4. Race menu and paused race

Source: menu dialog, `renderStandings`, visibility and resume handlers.

Overlay dialog: close ×, `TAKE A BREATHER`, `Race menu`, standings, race notes, `Back to the race →`, `Set up a new race`. Standings sort by progress and show rank, driver color/name/control, percentage or `Limit 1 · N`. Show the latest eight notes; initial empty message is `A clean starting grid. Your first move is waiting.`

Closing preserves the prior pause state. A hidden browser tab pauses live play; returning does not automatically resume it. When paused outside a dialog, show `Resume race →`. Starting a new race returns to preparation and resets race, recording and visual effects. No additional confirmation dialog exists in the current code.

### 5. Checkered flag

Source: winner banner and `render`.

The circuit remains behind a centered card with a checkered top strip, `CHECKERED FLAG`, `<name> takes the flag.`, turns/crashes/jumps summary, `Watch full replay ▶`, `Race again →`. Hide this layer while the last movement is animating or while watching the replay. Race HUD/destinations are unavailable after victory. Race again returns to preparation.

### 6. Race replay

Source: replay panel, playback handlers; `public/replay.js`.

This is a lower floating panel over the circuit, not a table of turns: `RACE REPLAY`, current round/total, `Back to race ×`, elapsed/total seconds, draggable timeline, previous round, Play/Pause, next round, Speed, keyboard hint and `Show driven paths`. Six speeds: 0.25×, 0.5×, 1×, 1.5×, 2×, 4×. Initial playback starts from zero, playing at 1×, with paths unchecked on every open. One round takes one second at 1×.

Replay is disabled with no recorded event, while a move is busy, or when replay is already open. Help and menu are disabled during replay; HUD, victory and matrix are hidden. Cars interpolate simultaneously by round, including jumps, contact/settling and damaged state; this is not a reconstruction of wall-clock pauses between clicks. All recorded turns remain available even beyond the short race-notes list.

Seek clamps to beginning/end. Previous goes to the preceding round boundary; next to the following boundary. Playback stops at its end; Play at the end restarts from zero. Space toggles, Left/Right step, Escape returns, subject to input-focus guards in the code. Hiding the tab stops playback. Closing restores the live race, previous camera and prior pause state; it does not commit replay positions to live play. Follow during replay follows the first recorded driver.

Driven paths show only completed travel plus the travelled portion of the current round; rewinding removes future travel. The checkbox applies exclusively to replay. The panel is at most 620 px wide and shrinks on mobile.

## Behavior and acceptance corrections

These are source-derived obligations to reconcile against the **fresh** remote model after login. Do not retain a contradictory rule merely because its historical scenario passed.

| Capability | Required behavior | Positive and negative acceptance examples |
| --- | --- | --- |
| Prepare a local race | 1–4 human/AI drivers, named and colored; no timer, sign-up or network opponents | One driver starts; four drivers disable Add; empty required fields block start; unavailable storage still permits play |
| Build a circuit | Same seed/settings reproduce geometry; length, corners and width alter it; clear straight starting grid | Exercise all 72 combinations including shortcuts on/off; changed seed changes preview; invalid saved settings fall back |
| Explore hidden shortcuts | Optional narrow traversable paths, subtle hints, local progress along bypassed arc, no guaranteed shortcut count for every seed | A driven shortcut advances locally; disabling removes hidden routes; shortcuts do not bypass lap eligibility |
| Choose a world | Seven ordered choices with exact palette/art; remembered selection and live preview | Select each world; unknown saved world becomes Forest; neon selector visible only in Futuristic |
| Drive using momentum | Each choice adds −1/0/+1 to each velocity axis, then applies the new velocity to position | Rightward speed 2 gives rightward destination columns 1, 2, 3; center/S/Space remains 2; opposite input slows before reversal; turning retains the other velocity component |
| Inspect a move | Exact grid placement; green/red prediction; path and impact preview; matrix hidden whenever human input unavailable | Zoom/pan keep targets aligned; double-click cannot commit two simultaneous moves; AI/pause/replay/finish hide targets; limited-speed cells remain selectively usable |
| Avoid road obstacles | Test the entire swept path including exact diagonal corner contact; another car only stops the mover | Clear destination beyond a pothole still crashes; touching an occupied side cell at a diagonal corner crashes; stationary other car remains unchanged |
| Jump a gap | Straight, arrow-aligned ramp traversal jumps exactly the next cell and needs a legal landing beyond | Can jump a hole or car; wrong-way ramp does not launch; insufficient momentum or boundary crossing crashes even while airborne |
| Continue after a crash | Travel to contact, settle on last safe road cell, stop velocity, preserve actual pre-impact progress; next three personal turns speed ≤1 on each axis | No skipped turns; diagonals at (±1,±1) allowed; faster acceleration disabled without consuming turn; a subsequent crash resets three restricted turns |
| Share the road with wildlife | Only destination occupancy by grounded wildlife causes collision; warning refreshed as occupancy changes | Grounded destination crashes; passing through safe; taking-off/flying/landing flyers do not occupy road; wildlife walking onto parked car never triggers a crash; scenery-off removes wildlife collisions |
| Race against AI | Same move/collision/limited-speed rules; look ahead and retain safe stopping route; never reward crashing | AI drives during restriction; avoids occupied wildlife landing; prefers a slow clear move if braking route blocked; brakes if every move collides |
| Win one lap | Three checkpoints, full progress and clockwise finish crossing, successful move only | Backward crossing does not win; a crash cannot win; first legal finish ends play; shortcuts earn only corresponding progress |
| Control the camera | Cursor-anchored wheel zoom, buttons/keys, drag pan, Follow, Track and clickable/keyboard mini-map | Drag does not commit move; transformed click chooses the actual destination; Follow restores following; unavailable browser fullscreen shows fallback message |
| Pause and resume | Help/menu/hidden tab pause; preserve pre-dialog pause; input lock around committed animation | Closing previously paused help leaves Resume; hidden-tab return requires Resume; no driving while dialog open |
| Watch the full replay | All turns, simultaneous round animation, transport/speeds/seek, live state restored on exit | Long recordings retain early moves; rewind reproduces positions/contact/effects; replay exit restores camera and current turn; no event disables replay |
| Show driven paths | Replay-only, initially off, current travelled portion only | Toggle changes replay overlay; rewind removes future segments; live race never shows completed-route lines |
| See surface and crash effects | Acceleration or sufficiently sharp turning emits tire smoke; hidden routes create world-specific tracks; crashes emit effects at contact | Straight braking/coasting produces no tire burn; jumps leave no ground marks; no persistent marks outside hidden paths; effect sampling never changes collisions |
| Respect motion preferences | Scenery remains still with reduced motion; moving particles suppressed but existing marks retained | Toggling preference updates render; help/menu pause scenery; cosmetic effects remain bounded; collision occupancy is not disabled solely by reduced motion |
| Remember setup, not races | Save setup at race start; current race/replay stays in memory only | Reload restores settings and preparation; new race clears recording and marks; invalid saved setup safely falls back |

## Data to reconcile

Name the data in player language; keep code paths only in provenance. Compare this list against both current behavior entities and actual UI fields after reconnecting:

- Race setup: seed; selected world; living scenery; neon color; length, corners, width, hidden shortcuts; ordered driver names/control choices.
- Circuit: road and hidden-path cells, boundaries, potholes, ramps and their direction, start/finish, checkpoints, lap length, bends and shortcut progress.
- Driver: name, color, Human/AI, position, horizontal/vertical momentum, retained heading, limited-speed turns remaining, lap progress, checkpoints, personal turns, crashes and jumps.
- Race: active driver, round, winner, started/paused/moving state, recent notes and pending destination preview.
- Living scenery: world, creature kind, ground/flight phase, position and animation time; sampled grounded occupancy for landing prediction.
- Replay: initial drivers/scenery, all turn records and their round, before/after driver states, move kind, attempted velocity, contact and jumps, scenery snapshots, duration.
- Playback: time, selected speed, playing state, Show driven paths, saved camera and pause state for return.
- Camera: center, zoom, follow/overview state. Zoom and drag stop automatic following.
- Visual effects: event time, duration/contact time, travelled marks, crash state, world palette, action-derived seed. These are transient; they are not saved races or new score rules.

The obsolete skipped-turn recovery field/rules must not stand in for limited-speed driving turns. Replay records are not the same as the eight visible notes or 60-entry note history. No backend account, online multiplayer, durable recording, audio controls or payment capability is present in the reviewed UI.

## Architecture evidence and verification limits

The current implementation is HTML/CSS/Canvas with local JavaScript and a loopback static server. WebGL particles fall back to Canvas if unavailable or context is lost. Rendering caps the recent effect-event window at 96, marks at 1,536 and particles at 384; replay remains full-history. Camera zoom controls clamp at 0.25–3.5, with automatic follow-fit using its own constraints. New race resets rendering caches and marks. These are implementation evidence, not new product settings.

Local validation on 2026-09-10: 36/36 existing tests passed; the source/reference audit passed for 18 hashes, 146 historical index entries and 120 classified implementation entries. Desktop/mobile browser smoke passed when Edge was run with access to its local automation connection. The initial sandboxed run timed out at `Runtime.enable`; that was an environment failure. Screenshots were refreshed in `artifacts/`. Browser smoke's final message still says “three themes”; seven choices were read from source and are visible in the refreshed preparation capture. This run does not claim seven separate world browser checks.

Studio MCP authentication was restored and all relevant remote sections were read and updated. The fresh whole-project audit remains blocked: Experience fidelity is not certified and two generated replay parameter bindings cause formal type conflicts. The authored capability inventory is covered; formal completion and renewed source adoption are not claimed.

## Reconciliation outcome

The remote before-state was snapshotted, contradictory specifications were corrected, missing replay/effects behavior was authored, and data, design references, screens, interactions and the capability inventory were updated. The fresh audit and exact limitations are recorded in [design-code-reconciliation.md](design-code-reconciliation.md). A native Studio visual comparison, executable Canvas equivalence, corrected generated replay bindings and re-certified source mappings remain outstanding.

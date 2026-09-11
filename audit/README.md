# Vector Rally audit

Latest addition: [one-click video export](video-export.md). It changes the code after the frozen design/source baseline below. Its dedicated browser verification and remaining remote-spec synchronization are recorded separately; the old hashes and 119-scenario count do not certify this new capability.

The 2026-09-10 [design/code reference](design-code-reference.md) and [evidence inventory](design-code-inventory.json) prepare the Experience reconciliation from current code. They inventory six screens/layers, 68 static UI elements, 51 event-listener registration sites and dynamic world/driver/landing choices. The source baseline is frozen in `design-source-snapshot.json`. The 36 tests and desktop/mobile smoke were rerun successfully. Remote reads and writes remain unavailable in this session after the reported reconnection (`Auth required`); these documents do not certify the current Studio model.

Local implementation and verification are current. **Studio synchronization is blocked by expired authentication.** The remote specification does not yet describe the final grid, crash rules, wildlife collisions, replay and circuit-builder options and special effects accurately.

| Check | Result |
| --- | --- |
| Gameplay and replay tests | 36 passed |
| Browser checks | Circuit preview, seed variation, length/corner/width controls, remembered settings, Exact landing cells, turn-only matrix, animal landing crash/recovery, replay transport and speed, live-state preservation, desktop/mobile themes and camera passed |
| Replay display cadence | Observed 60 fps in the latest browser run; hardware-dependent |
| Source evidence | Current SHA-256 manifest and reviewed local reference ranges |
| Remote model/scenario audit | 119/119 scenarios pass; Experience and mapping limits remain — see [reconciliation](design-code-reconciliation.md) |

Circuit generation now varies the outline by seed and supports three lengths, three corner styles and four road-width settings. Optional hidden routes use subtle tire ruts and verge openings; their cells are traversable and carry local lap progress. Tests cover 72 setting/seed combinations and confirm AI races still finish without crash shortcuts.

The nine blank matrix cells are aligned with the track and centered on position plus velocity. The clicked cell is the destination unless the trajectory crashes or the speed restriction disables that cell. On a crash, the car translates to contact and settles on the last safe road cell. It can drive immediately, with a speed limit of one grid cell for the next three driving turns. Live play and replay share the same contact animation. Grounded wildlife still obstructs only landing cells, and animal movement alone cannot crash parked cars. AI shares all collision and speed-limit rules.

Replay records every turn, including jump/crash/recovery, groups drivers into simultaneous rounds and interpolates their positions. Play/pause, timeline seeking, round stepping and 0.25×–4× speed leave the live race untouched. Wildlife is interpolated between recorded round snapshots.

Tire smoke, grass/sand tracks, crash sparks and debris are cosmetic and reconstructed from move timing. Effect budgets cap memory and draw work. Browser checks verified visible shader pixels, no WebGL errors, Canvas fallback after context loss, shader restoration, reduced motion, pause and replay rewind. All seven themes were inspected visually. Jungle, Sky, Sea and Space add distinct palettes, props, wildlife, crash effects and hidden-route trails. Tests verify action-based particle seeds independent of wall-clock start time; all themes preserve physics and particle budgets. Desktop/mobile selection, remembered choices and eight new crash/trail screenshots passed browser checks. Tire burn now requires acceleration or a turn of at least 30 degrees with prior speed of at least 1.5 cells per turn; a crash alone and ordinary braking do not generate road burn. Hidden-route surface tracks still appear at steady speed. Futuristic routes use selectable green, purple, yellow or mixed neon trails; selection persistence was checked in the browser.

Persistent marks and shortcut hints are clipped to hidden-path cells. Normal roads show no persistent tracks in live play. Replay has an unchecked **Show driven paths** checkbox; enabling it draws the entire recorded route behind each car up to the selected time. Browser pixel comparisons verify toggling, rewinding and returning to live play.

The measured before/after benchmark is in `performance.json`. Draw submission p95 fell from 0.7 ms to 0.3 ms; replay sampling p95 for 4,000 events fell from 1.5 ms to 0.1 ms. An active effects fixture with 106 particles ran at approximately 60 FPS. These are local measurements, not a universal frame-rate guarantee; the separate large-track benchmark remained around 32 FPS.

`report.json` contains the source manifest, implementation inventory, per-element evidence and explicit synchronization backlog. New implementation entries without an authored remote feature are marked `pending_spec`. `../.unspa.json` retains existing references with `syncStatus: pending_auth`; these must be re-reviewed and synced once Studio reconnects.

Run `npm run audit:local` to check local hashes and code ranges. A passing local check does not imply remote specification completion or exhaustive test coverage. Source code stays local.


## Studio reconciliation — 2026-09-10

Authentication is restored and the remote specification was updated to 19 capabilities, 11 features and 6 screens. The [current reconciliation report](design-code-reconciliation.md) supersedes older pending-authentication statements above. Whole-project validation is blocked by Experience fidelity and generated replay-binding conflicts. Historical implementation records remain preserved and unverified against the revised spec; source code stays local.

## Studio rendering review — 2026-09-10

The [renderer defect report](studio-experience-rendering-report.md) includes before/after screenshots from the deployed Run component mounted locally, saved Experience workarounds, remaining fidelity limits and acceptance criteria for the Studio repository. All three Experience journeys pass; whole-project completion remains blocked.

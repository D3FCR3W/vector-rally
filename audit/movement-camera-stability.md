# Movement targets and camera stability

## Product contract

Landing squares stay green when safe, amber for nonfatal road hazards, and red for crashes or fatal damage. Scenery changes elsewhere and repeated hover/focus redraws must not invert their color. An animal entering or leaving the actual landing cell updates its warning immediately.

In live play and replay, automatic camera position and zoom approach the requested framing progressively. Clicking a move or updating a preview does not instantly reposition the camera. The live camera continues reserving space for the viewed human's reachable squares while input is locked and during AI turns, avoiding a framing change caused only by the controls disappearing. Human-only Follow and the existing group choices remain available. The landing buttons stay aligned with the projected road grid during camera settling and keep their identity during camera-only redraws.

Camera settling continues when Living scenery is off. Manual pan/zoom suspends automatic framing and its residual motion. Initial race framing and reduced-motion mode use immediate framing. Presentation never changes the chosen move, physics, turn order or wildlife collision rules.

## Diagnosis and implementation

`public/app.js`: a safe preview has `crash: false` and can omit `destroyed`. The expression passed to `classList.toggle` therefore evaluated to undefined; the browser inverted the danger class on each wildlife update. The browser reproduction returned alternating false/true eight times for unrelated off-track wildlife. An explicit Boolean now fixes the class to its actual safety state.

Automatic camera targets were copied directly into the current camera, and reachable squares were removed from the framing during the movement lock. The view now retains that framing allowance, applies a critically damped spring on animation frames, and repositions existing target buttons with the camera. Pointer preview events request a redraw without advancing the spring. Settling ends once the target is reached; it also runs without the scenery animation loop. Manual control clears spring velocity. `public/race-view.js` uses elapsed-time integration, caps resumed frame time at 50 ms and respects reduced motion in the caller.

## Verification

- `npm test`: 65/65 pass. Camera tests compare 30, 60 and 120 Hz convergence, fixed-target overshoot, retarget continuity and long-frame recovery. After the zero-time no-op refinement, all 9 race-view tests pass again.
- `scripts/motion-smoke.mjs`: eight unrelated wildlife updates keep a safe cell green; actual occupancy makes it red and clearing restores green. A stationary pointer retains the same button and camera across 60 frames.
- Six human moves with live wildlife and AI opponents: no synchronous camera jump on click, no AI anchor takeover, target alignment error below 0.01 px, and no turn-boundary jump above the test threshold. Observed cadence: 59.28–60.00 fps; largest sampled camera translation: 14.40 screen pixels. This is local browser evidence, not a hardware-independent frame-rate guarantee.
- Scenery-off settling, manual camera stability and 390×844 mobile layout pass. Screenshot: `artifacts/motion-mobile.png`. Measurements: `artifacts/motion-check.json`.
- `scripts/group-tunnel-smoke.mjs`: grouped AI turns, human-only Follow, nearby/all/custom framing, nonempty selection, mountains, tunnel replay and mobile checks pass with no browser errors. Export decodes 210/210 frames, 3.5 seconds at 60 fps, preserving the existing 4× timing.
- `scripts/smoke.mjs`: desktop/mobile controls, actual pointer clicks after camera transforms, pause/scenery/reduced motion, replay and input-lock checks pass. Observed replay cadence: 60.0 fps.

## Studio

Saved the existing view feature, two feature-card criteria and two detailed Given/When/Then criteria in project `vector-rally-d60551`, citing `src-vr-movement-camera-stability`. Corrected older view criteria that still described Follow as following the active AI and the starting direction as always right. These are visual regression requirements verified in the real browser, not new simulated gameplay actions.

The view's 25 executable scenarios pass; no invariant violations or dead actions were found. Bounded model exploration is truncated at 264 states. The refreshed global audit remains blocked at 95: Experience has not been assessed as ready and two existing project-health gaps remain. All authored journeys pass. The project now has 23 registered sources, with 26 capabilities and 13 features unchanged. These existing Studio limitations are separate from this fix. Historical implementation mappings are not re-certified by these tests.

# AI passes, race framing and mountain tunnels

Updated 2026-09-11. The native game remains the behavior and design authority.

## AI turns

Consecutive AI seats resolve using the existing deterministic turn order and collision rules, then animate together with one start time and one duration. This preserves each resolved outcome while removing the repeated delay between AI cars. The pass stops at the next human, a winner/all-retired result, or a previously played AI seat. An all-AI race therefore advances at most one turn per car per pass. Each actual move is recorded once at its original round, with its damage, spin and effects.

Human input stays locked throughout the pass. Paused, busy and completed races cannot start another pass. The normal group duration is 320 ms, extended to 460 ms for jumps or 650 ms for a crash; reduced motion uses 70 ms. A short 100 ms scheduling delay occurs once per pass.

## Camera

The automatic anchor is a human. It stays on the current/last human during AI turns and hands over when another human can drive. An all-AI race starts with All drivers.

The **Frame** control offers:

- **Active human:** keep the human in view.
- **Nearby rivals:** include the human and the immediate racer ahead and behind by lap progress, regardless of human/AI control. Ties use grid order. Retired opponents are excluded; a leader/trailer has only the available adjacent racer.
- **All drivers:** fit every participant.
- **Choose drivers:** check any nonempty subset, including AI-only groups. The last checked driver cannot be removed.

Framing samples animated positions and fits the group above the HUD. The active human's reachable squares are included when that human can drive. Widely separated groups can zoom farther out than manual zoom. Pan and zoom suspend automatic tracking; Follow or a new Frame choice restores it. Frame choices apply to live play and replay, reset for a new race, and remain independent of the existing video camera selection.

## Mountains and tunnels

Seeded mountains form continuous rocky ridges with shaded slopes. Where a suitable shortcut exists, its middle section is concealed under a ridge. Open approaches and other worn paths remain visible. Dark stone entrances hint at the concealed route. The roof fades near a viewed car to reveal a lit, gridded interior, and returns as that car leaves. Cutaway visibility is sampled from position, not a permanent discovery flag.

Mountain cover never changes road geometry, collision checks, damage, ramps or local lap credit. Mountains occupy off-road cells and the concealed shortcut section, preserving ordinary roads, the grid and the pit. Wildlife home positions avoid the tunnel. With Hidden shortcuts disabled, decorative mountains remain and tunnels are absent. Shortcut/tunnel availability depends on the generated layout.

Live play and replay reveal tunnels around the drivers included in Frame. Export reveals around the selected followed driver, or any participant in All drivers mode. Rewinding restores the appropriate roof state. The mini-map and setup preview retain the closed mountain cover.

## Verification

- `npm test`: **63/63 pass**. New checks cover ordered AI-pass equivalence, interleaved humans, bounded all-AI passes, human anchors, adjacent rivals, custom groups, desktop/mobile framing, shared animation poses, and mountains preserving traversable seeded geometry.
- `scripts/group-tunnel-smoke.mjs`: three AI cars share the exact animation start; the camera remains on human 0; four moves are recorded once. Nearby/all/custom modes, preventing an empty group, covered/interior views, replay cutaways and mobile layout pass with no browser errors.
- Export verification decoded **210/210 MP4 frames**, duration **3.5 seconds**, at **60 fps**. The existing 4× export timing is preserved.
- `scripts/smoke.mjs`: desktop/mobile controls, camera transforms, single-input locking, scenery, pause, themes and replay pass. Observed display cadence was 60.0 fps on this test machine; live display cadence remains hardware-dependent.
- Evidence: `artifacts/group-tunnel-check.json`, `ai-one-pass.png`, `camera-selected.png`, `camera-mobile.png`, `mountain-outside.png`, `mountain-inside.png`, `tunnel-replay.png`.

## Studio specification

Updated project `vector-rally-d60551`: **26 capabilities, 13 features**, 22 registered sources. The AI, view and track models pass **54 scenarios**, including 24 new scenarios. No invariant violation was found; the camera model's bounded exploration was truncated at 264 states, so this is not an exhaustive proof.

Saved feature/acceptance updates, rules, camera/track data fields, the Frame component, human Follow behavior, twelve help rules and mountain setup hints. The Studio default-roster prototype accepts the camera options and prevents clearing the last selected driver when its change event is fired. Native animation, procedural mountains, dynamic driver lists and camera fitting remain game-renderer responsibilities, explicitly recorded in the screen descriptions.

The final whole-project audit remains **blocked at 95**: Experience is not certified as a faithful native renderer and two pre-existing coherence blockers remain. All authored journeys pass. Historical implementation evidence mappings were not re-certified, and no whole-product completion was claimed.

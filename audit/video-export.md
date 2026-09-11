# One-click race video export

Added on 2026-09-10 following the user's request to export the final video for sharing.

## Product behavior

- **Export video** is available on the finish screen and in replay when at least one completed turn is recorded. It is disabled during a move; duplicate exports are prevented.
- One click creates and downloads the entire recording from time zero at 4× speed: four rounds per second. The opening remains one second and the result card two seconds; exact file duration is recorded duration / 4 + 3. Preparation time cannot lengthen the video.
- Output: 1280 × 720, exactly 60 fps, a selectable camera: Follow a driver tracks the interpolated car position at fixed zoom 1.65 (a car sprite spans 52.8 px), while All drivers adjusts framing to keep every car visible clear of the HUD and mini-map. A mini-map in the upper right locates the action. Default to the first human driver in starting-grid order, otherwise the first car, regardless of the winner. Video follows can select any participant. Both export entry points share the camera choices until a new race resets them. All drivers disables the individual chooser without forgetting its value. Widely separated cars have colored numbered markers. Preserve the original world/scenery/effects, driver names and turn/crash counts. Finished races name the winner and show their turns, crashes and jumps. A partial recording ends with a replay card, without inventing a winner.
- Current replay path visibility applies. Full effects are exported independently of the live reduced-motion setting, which remains unchanged. Current replay time, speed and live camera do not change the exported sequence.
- MP4/H.264 is preferred where supported. WebM/VP9 or VP8 is the fallback; both retain 60 fps and the extension matches the actual format. There is no audio source in this game, so the export is silent.
- A progress dialog previews the video. A hidden tab pauses generation of new frames; returning resumes at the next exact timestamp. Cancel or Escape stops the job without downloading a partial video.
- Completion automatically downloads a file named with the track seed and timestamp. A download link remains available. File sharing is offered only when the browser reports support and requires a separate user click.
- Unsupported encoding and encoder failures display an error and retain a way back. Encoding and export-renderer resources are released on success, cancellation and failure. Each pending encoding step has a 30-second timeout.
- A separate renderer reads the recording. It does not change live cars, camera, wildlife or replay time/speed. Previously playing replay resumes when the dialog closes; previously paused replay stays paused. Returning while the page is hidden keeps playback paused.
- Leaving/reloading the page interrupts the export. The video is produced locally; there is no upload service, saved replay storage or background export after closing the tab.

## Verification and evidence

- Engine/replay/effects/scenery suite: 42 tests passed, including shortest-arc steering across ±180°, reproducible intermediate replay poses, wildlife clocks across complete cycles and recorded take-off reactions.
- Existing browser smoke passed, including desktop/mobile movement, replay, camera, fullscreen and theme controls. Its mobile size check was timing-sensitive on two attempts; the subsequent complete run passed. The assertion now includes the measured rectangle if it fails again.
- Export browser results: [video-export-check.json](../artifacts/video-export-check.json).
- Visual inspection: [export ready](../artifacts/video-export-ready.png), [mobile](../artifacts/mobile-video-export.png), [decoded video frame](../artifacts/video-decoded-frame.png), [winner card](../artifacts/video-winner-frame.png).
- Real downloaded MP4: 765 frames over exactly 12.75 seconds, with every frame decoded by the browser's native VideoDecoder. A CPU-throttled export retained all 195 frames over 3.25 seconds despite a hidden-tab pause. The test also checks cancellation, unavailable encoder/support, closed encoders and preserved live/replay state.
- A shader fixture exported with reduced motion enabled retained 7,541 visibly affected pixels. Decoded color error was about 1.25/255 against effects-on, versus 36.61/255 against effects-off. See [pixel comparison](../artifacts/video-effects-check.json) and [decoded effects](../artifacts/video-effects-60fps.png).
- The [steering check](../artifacts/steering-check.json) verifies intermediate orientation in the actual input/render path and reverse replay seeking. It also forces MP4 unavailable and decodes all 195 WebM frames at 60 fps. Other browsers and operating-system share destinations have not been tested.
- Encoding uses timestamped canvas samples and quality-mode backpressure through the locally bundled [Mediabunny media sources](https://mediabunny.dev/guide/media-sources), replacing real-time MediaRecorder capture. No CDN, remote encoder or race upload is used.
- Wildlife regression: replay previously switched actor animation clocks halfway through each round, and reduced-motion recordings contained identical wildlife snapshots. Replay now samples continuous wildlife clocks and natural flight/walking poses, preserving recorded endpoints and reactions. Export additionally animates frozen or absent scenery snapshots on a deterministic cosmetic race clock; recorded collisions/results stay unchanged. This fallback does not claim to reconstruct historical animal positions. Living scenery off remains respected.
- A stationary-car/fixed-camera video contains 300 decoded frames over 5 seconds at 60 fps. Two frames differ in 5,038 wildlife pixels; decoded color error is below 3/255 against the expected moving pose and above 68/255 against the wrong time. Backwards seeking reproduces identical frames and the race/recording are unchanged. See [wildlife verification](../artifacts/wildlife-video-check.json).
- The close-up/4× revision passed the dedicated export browser checks, including a complete race export. Sampling proves that one second of racing video advances four recorded seconds and reaches the exact finish. A 35-second recording has 8.75 seconds of race footage plus 3 seconds of titles. The [close-up frame](../artifacts/video-closeup-frame.png) was visually inspected.

## Specification baseline

The Lyriks spec was updated on 2026-09-10: feature **Export a race video**, ten acceptance criteria, 24 passing behavior scenarios, a connected Race video entity, user access, glossary and browser-recording architecture. The new export journey and the replay/winner cancellation paths pass. The inventory now contains 20 capabilities and 12 features. Seven screens and fifteen components include the export preparation view. See [the synchronization results](../artifacts/studio-video-export-sync.json).

The prototype does not encode, download or share a video. Its preparation/return design is present; native completion and file-sharing states remain specified in the feature rather than simulated as fake files. Local visual inspection reproduced the existing Studio mobile frame overflow (434 px for a requested 390 px viewport). The local technical report and preview screenshot were not uploaded: automatic approval review rejected those payloads. Product requirements and specification fields were synchronized separately.

The 60 fps/effects/steering revision also synchronizes the momentum, replay and effects acceptance criteria, export timing and resource rules, architecture and Experience labels. All 61 scenarios across these four affected features pass, as do all four journeys. Frame cadence, actual shader pixels and steering visuals are verified in the native browser tests; the behavior simulator does not prove those visual properties. See [the current synchronization results](../artifacts/studio-60fps-sync.json).

The subsequent wildlife correction adds matching replay/export acceptance criteria and edge cases in Lyriks. All 41 scenarios for those two features and all four journeys pass; the native video test supplies the visual motion evidence. The refreshed project audit retains the same global blockers. See [wildlife spec synchronization](../artifacts/studio-wildlife-sync.json).

The whole-project audit was refreshed after this revision and remains **blocked** at score 94 because Experience is not ready and two coherence blockers persist. This does not invalidate the tested native-game export. Source hashes from the earlier reconciliation remain a historical baseline; they no longer certify the modified files. Unaffected feature scenarios were not rerun for this revision.

## Player selection and adaptive camera revision

The player default, participant selector and All drivers mode were added on 2026-09-10. Cancellation restores camera controls only after the old dialog has closed, preventing a rapid retry from being aborted by the previous close event.

46 logic tests pass. The dedicated `scripts/video-follow-smoke.mjs` checks the real default and explicit-driver exports, a completed race with a different winner, cancel/retry, both camera modes, mobile layout, reset on a new race and four widely separated cars. The MP4 decodes all 195 frames at 60 fps. See `artifacts/video-follow-check.json`.

The Lyriks export feature now has 35 passing executable scenarios. The shared Experience camera selector retains the choice through export/cancel, and all four navigation journeys pass. The prototype demonstrates the default two-driver grid; real participant lists, frame rendering and encoding run in the native game. Its inactive individual chooser is hidden, while the game keeps it visible and disabled. Whole-project blockers remain separate from this verified change.

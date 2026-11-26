# Chunk 15: shared.js lines 9443-14162 (places, alignment, room setup guide, camera mode, preview camera, phone AR, Shared dialog, output page, talk and live sound, HOST.collab, wiring)
Read: shared.js 9443-14162 (4,720 lines, 368 KB; also 8192-8251 tick, 3460-3499 pump, 8965-8975 begin, 9176-9192, index.html 2780-2800 for the callers)

## Findings
### The room's alignment pass runs twice every XR frame   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: shared.js:10034 update(f); called by tick 8220 (R.update(f), the shell's own session rAF loop 11039) AND by place(f) 10946-10948, which index.html:2794 HOST.anchor.frame(f) calls "once a frame from a story's headset loop" (24 story files call HOST.anchor.frame).
What: in a room both callbacks get the same XRFrame, so the whole pass runs twice: 2-3 getPose calls, lf/lfi and m/mi matrix inverts, trkHist, ownFloorCheck, scanCheck, scanFloorAt, align() (its shared-space branch each frame: val(kFrame()), splitHere(), othersElsewhere() over all C.keys with a regex), areaAnchors, basis. Nothing guards on the frame.
Change: at the top of update(): `if (f === R.lastF) return; R.lastF = f;` (place() then only reads R.m). Check trkHist does not rely on being fed twice.

### Places survey restores every kept anchor on a timer, in a room or in none   [perf-frame]  gain: medium  risk: medium  sure: confirmed
Where: shared.js:9637 placesStep (tick 8223, every XR frame while HOST.session, no room needed); survey 9656-9678; surveyMeasure 9681.
What: cadence 10 s for 2 min after every session start, wake or room change, then 60 s to 10 min, then 120 s (9656). Each survey calls HOST.anchor.find for every other place (up to PLC.max = 8 persistent anchors, plus anchor B of places with unknown yb), measures them 3 s, deletes them, and logs two lines ('places looked for', 'places found'), each through log(), which (first reader) parses localStorage. Outside a room it surveys even places whose room was left on purpose or is gone, which placeDecide (9750) can never join, only offer.
Change: outside a room, survey only places that could be joined (not kr.left/gone) and stop after the first 2-minute burst unless a wake; log the pair only when the result changes (as 'place here' already does at 9761). Device-only: report on-headset cost as untested.

### Shared dialog rebuilds its lists on every change   [perf-load]  gain: medium  risk: low  sure: confirmed
Where: shared.js:12668 renderDialog, called by changed() 12956 (60 ms debounce: up to ~16 calls a second in a busy room).
What: with the dialog open on a page, every call rewrites innerHTML of .sh-room (12725), .sh-stations (12748, ~1.5 KB of HTML per station with titles and aria labels), .sh-people (12785) and .sh-colors (12802: the static COLORS list, every time), then drawMap and trkRender. No signature check, unlike guideList (12816), the Add select (12765) and the cam/pc lists (11401, 12158). Buttons are replaced under the pointer, so a click between pointerdown and pointerup can be lost (see Bugs).
Change: build each container's HTML and assign only if it differs from the last (DLG.<part> as guideList does); build .sh-colors once.

### Repository cost: on-demand seams in this third (about 135 KB of the 368 KB)   [repo-cost]  gain: medium  risk: medium  sure: confirmed
Where: camera mode 11109-11454 and the preview camera 11456-12311 (87 KB, incl. CAM_CSS and PC_CSS), phone AR 12313-12499 (15 KB), output-page glue 12976-13062, talk and live sound 13064-13845 (~35 KB), HOST.collab 13848-14142 (~30 KB, about half test-only accessors: menus() reads canvas pixels, pucks, talkIn, liveIn, presIn...).
What: all of it is parsed on every page and every headset; the cameras never run in a headset, phone AR never on a desktop or headset, Talk/live only after Talk on or a @snd/@talk message. output.js already shows the pattern (outLib 12988: a script loaded on first use).
Change: move cameras + preview camera into `camera.js` and phone AR into the same or `phone.js`, loaded as output.js is (keep the HOST.xr.request wrapper stub here); Talk/live into `talk.js` loaded on Talk on or first @talk/@snd; test-only accessors behind one `HOST.collab.test` object. Each also cuts what an agent reads for a camera or talk task. Every new file needs sw.js SHELL and relay APP_FILES.

### Comments: 28% of the bytes, much of it history and duplicated in docs   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: this range: 860 comment-only lines, 91 KB of 368 KB; 62 lines quoting the owner with dates or naming versions (e.g. 9532-9539, 10756-10769, 11110-11138, 11457-11488, 12314-12329). The places block 9591-9611 is nearly word for word docs/agents/shared-rooms.md 1685-1716.
What: an agent reading a function reads its history twice (code and docs); camera mode's 30-line header (11110-11138) and the preview camera's 32-line header (11457-11488) are specs, not code comments.
Change: keep one-line "why" comments; move the owner's quotes, version history and the long behaviour headers to docs/agents/shared-rooms.md (or tools/output/SPEC.md style SPECs) and point to them by heading.

### Phone AR sheet rebuilt and serialised every frame while open   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: shared.js:12381 phStep, called by tick 8237 every frame; 12460 phRender.
What: in a phone's AR with the sheet open, phRows() (12392) builds ~15 row objects with closures, calls talkState(), recenterRow(), liveAvail(), the occlusion API, then J() of all rows as the signature, every frame; two querySelector calls a frame even when closed.
Change: gate phRender at 200-250 ms as camStep (11240) and pcStep (11771) do, and cache the two element refs at phBuild.

### Talk and live sound: per-packet allocations and per-pump work on every page   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: talkPump 13232 (new Float32Array per AudioData, ~100/s, only for the RMS), talkChunk 13280-13286 (Uint8Array, object, pre.concat and a closure per packet, 50/s), talkOut 13700 and liveOutData 13524 (a Float32Array per decoded frame per talker); talkStep 13584 and liveStep 13392 from the pump (3467) 5x/s on every page, in a room or not: talkState() maps every talker and J() builds a signature; talkPlace 13772 (tick 8218, every frame while talkers exist) writes the AudioListener each frame though sfx.listen (8217) writes it too, and maps T.pos to a new array at 30 Hz.
Change: reuse one Float32Array per stream (grow on size change); return early from talkStep/liveStep when !C.code && !TH.test && !TH.sub && !LV.sub; let sfx.listen own the listener.

### sample() logs a large line every 5 s; the comment says a minute   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: shared.js:10887-10930 sample (tick 8221, in a room each frame, gated 5000 ms at 10889); upload 10934 every 10 s does LOG.filter over up to 1,000 entries.
What: each sample spreads C.pres twice, includes occlusion's and frame-time samples, and goes through log() (localStorage per line, first reader). Comment 10887 "a line a minute (and at every change)" is stale against the 5 s gate.
Change: decide 5 s or 60 s and fix the comment; in upload keep the index of UP.n instead of filtering the whole LOG.

### Duplicated framing and constants   [repo-cost]  gain: low  risk: low  sure: confirmed
Where: sndSend 13159 and talkSend 13298 (same 16-byte header); the Opus rate list five times (TALK_RATES 13070, SND.rates 13136, literal 13420, output.js 1016 and 1050); talkPump 13223 "as output.js's sndPump" (output.js 1004) is a second copy of the capture loop; camRender 11362 and pcRender 12109 share text/show/pressed helpers and the follow list HTML (11403 vs 12160); CAM_CSS, PC_CSS and PH_CSS repeat the button styles.
Change: one frame(tag, b0, seq, at, bytes) helper, one RATES constant, shared overlay helpers (they move together into the camera module above).

## Bugs seen
- Dialog clicks can be lost: renderDialog replaces every button in .sh-stations/.sh-people on each changed() (12748, 12785) while others move; a press spanning a rebuild loses its target (plausible, not reproduced).
- mapHit (12929) is never called anywhere (dead). put('roomGuide', null) (10779) removes a v107 key on every page load (a migration left in).
- talkPlace (13797) and sfx.listen set the WebAudio listener twice per frame with the same values (harmless).

## Not worth changing
- align()'s own-marks path is gated at 500 ms (9874); splitHere (9176) and val() lookups per frame are cheap.
- camStep/pcStep render at 200 ms with text/attribute writes guarded by comparison (11365-11366, 12112-12113); the follow lists use a signature.
- guideStep (10793) calls lineCase/lineUp per frame only in narrow states (10820, 10823, 10831 once); guideList (12807) compares HTML before writing.
- drawMap (12821) from the pump at 5/s only with the dialog open and no session (3494): desktop only, small.
- Listeners: pcKeys (11815) and camBuild/pcBuild/phBuild bind once with guards; session listeners die with the session.
- Start-up in this range: camCheck isSessionSupported (11143, async, not in headsets), 9 localStorage reads (11499, 13073, 13382): negligible.

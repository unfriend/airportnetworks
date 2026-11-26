Read: collab.mjs 4951-5750
- 5127: hintBad reads `a.dist.toFixed(1)` BEFORE the `!a ||` guard at 5128: a missing arrow throws TypeError (round aborts) instead of a bad[] entry/failed check.
- 5284 comment says window "shortened to 8 s", code sets 14000 (5285) and message expects "within 14 s" (5295): stale comment. 5291 sleep(14300) is a wall-clock wait for a page timer (margin only ~0.3 s plus the touch's own frames); the page timer is HOST.collab.now(), the test could set win:1500.
- 5288 `cleared = cs0.s !== 'done'` passes for any state but done (weak).
- 5395 `await tap(H2,'guide:skip')` result unchecked. 5284-5296: win restored to 20000 at 5296 (assumes default 20000).
- 5001-5017 held-grip check: `most <= 16` / `gap >= 60` are upper-rate bounds that a slow machine satisfies trivially; only hw.length>=10 can fail when slow (loop ends at 10 s cap).
- floorSpots (5458-5583) and guide round chain: floorSpots takes H1/H2 in the exact state the guide round leaves them (rm written by H1 at 5331, H2 calibrated at 5428); not runnable alone; --guide always runs both. 5542 compares rm JSON incl. `at` (fine only because nothing is written).
- 5578 `HOST.room.frame.o[1]` inside stepUntil would throw if frame null (round abort not a failed check).
Read: collab.mjs 5751-6550
- placesRound: return values of joinedTo ignored at 5763, 5792, 5816, 5921 (a failed join is only seen by a later check). 5864-5865 `delete HOST.anchor.on` then redefines `on` as a constant-false getter: if `on` was an own data property the page is left changed (harmless, page closed at the end).
- 6417 tokenRound finally: `await new Promise(r => { T.proc.once('exit', r); T.proc.kill(); })` hangs forever if the relay already exited (relayOff 6479 guards with exitCode, this one does not). 6229-6233: a start timeout rejects OUTSIDE the try, so the relay process (and `logs` temp dir) is left running.
- 6328 `files.length > 0` (relay log files) depends on the 10 s log flush plus frames(H,11000) (6322): wall-clock/real-time dependent positive check, not guarded.
- tokenRound 6357 closes A,B,H contexts before the home-relay half: later parts use only O and G; no leftovers. The home-relay half (6338-6413, 7 checks) has nothing to do with the password round except reusing its relay; it is in the main run only through --token (not in main run) -> that half is not in the main run either.
- Duplicates: `touch` (hold tip 650 frames then wantPress 150 frames) is copied in guideRound 5170, placesRound 5623, areasRound 5995; `mark`/`since`/`look`/`go`/`end` in placesRound 5616-5651 and areasRound 5989-6016 (same bodies); `tap`/`has` in guideRound 5069-5071, tokenRound 6295-6297 and 6402-6404 (three copies in one round).
- areasRound 6140 `!cmp1` is a negative check after 6.5 s of frames: vacuous only if `cx` was true (it is in the same condition), fine. 6204 uses global WebSocket (Node >= 22 only; no fallback).
- 6179 nrm mutates the laptop page's internal key map synchronously and restores: fine.
Read: collab.mjs 6951-7350
- 7168 aQuiet: `!(it.st && !it.st.el.paused)` is true whenever the page never created a stream element, so "a device with its sound off plays nothing" cannot fail on a page that simply does not build the element (it can only fail if the element exists and plays); the half that matters is HOST.audio.muted.
- 7154 vHeard `Math.abs(x) <= 0.05`, 7125/7136 voice recorded in REAL time (sleep(4000) + 20 ms setInterval on a busy machine): the 50 ms sync bound is a wall-clock bound on a fake-mic round trip, flaky by construction under load (cannot tell a slow machine from a sync fault).
- 7111 / 7098-7099 / 7054: fixed sleeps (500/1000 ms) used as "let the other writer's last write land" before a recording (the comment at 7049-7051 documents it): wall-clock guard, leftover-dependent: the next block's pass depends on the previous blocks' B/C writes having reached all four pages.
- 7269-7270 "frame by frame while the circle glides" samples hRoom() 40 times 30 ms apart: samples in wall-clock, so on a slow machine the glide (0.25 s) may be sampled 0-3 times and `worst < 0.001` then holds trivially (the check that the glide is seen is absent; no minimum number of samples taken mid-glide).
- 7273 `R1.placing` asserted true AFTER the loop that waits for the rig to arrive (7270); if placing() means "still gliding" this is wrong, if it means "placed by the room" fine: unclear from here, worth a look in shared.js.
- 7327 sleep(1500) is a negative window ("each item once in the room"), fine; 7346 closes all four pages, the rest of the round (relay /upload, token, R2) opens its own.
- dOf is defined three times (6972, 7032, 7081) with different bodies (the middle one converts to Float64Array, the others index arrays directly).
Read: collab.mjs 7351-7750
- 7465/7468 studio-with-password leak check: `!logTxt.includes(PASS)` passes when the relay's --logs folder is empty (no `files.length > 0` guard, unlike tokenRound 6328); logs are flushed every 10 s and nothing here waits for one, so the "not in its log files" clause is probably vacuous. Same for `saveTxt`/`T.out` (those are real).
- 7661-7662 homeRound "sends it nothing before a password is typed": `ctx.route(...)` sees HTTP requests only; a WebSocket (ws://main.lab.lbi-netmed.com) the page opened would not be listed in `sent`, and `--host-resolver-rules` maps only the two site names, so the offered host would resolve for real if the machine has network. The negative check is blind to WebSocket (peer=off is in the hash but the relay socket is the likely culprit). 7656 still filters fonts.googleapis/gstatic (no page loads them since v213: dead filter).
- 7409 sleep(7000) and 7425 sleep(4500) are negative-window waits ("nothing more asked"), the second tied to a 2 s poll in the page: if the studio's poll interval grows past 4.5 s the check passes vacuously.
- 7481: `for (p = 8840; p < 8860 && !S3r; p++) S3r = await startFake(...).catch(() => null)`: when all 20 ports fail S3r stays null and 7483 throws a TypeError (round aborts with an unrelated message); the earlier finding's "S3 stand-in 8840-8859 overlapping 8860's neighbour" is wrong: 8840-8859 does not overlap any relayOn range (8860-8879 starts after). The real overlaps are among relayOn ranges (8790/8791/8792 here, 8860/8870/8880 elsewhere), harmless because rounds run in series and each takes the first free port.
- 7538, 7577-7578, 7590 assert on the relay's stdout wording ("came straight into the bucket", "wrote ..."): coupled to log text.
- 7617-7621 R2 leak check: `!JSON.stringify(S3r.requests).includes(PASS3)` fine.
Read: collab.mjs 7751-8000
- 7878-7881 "the phone walked into the first circle (standing in it 2.5 s) changes nothing": a negative check over a fixed 2.5 s window with no positive control; if the dwell time a station needs is longer than 2.5 s (or the phone's presence is not yet in the circle) the check passes vacuously.
- 7947-7948 double-tap timing is made with Playwright round trips and sleep(600)/sleep(120): the page's double-tap window is compared with test-process latency (a loaded machine stretches 120 ms past the window -> false red; a window longer than 600 ms -> false green on h2).
- 7860-7866 menu row found by `seen.indexOf('Camera')` among all fillText calls of three frames: first 'Camera' string wins (any other drawn label with that text would be taken for the person row).
- 7777 `!(ov.phone && (...))` passes when `HOST.collab.phone` does not exist (ov.phone null): can never fail if that hook is removed/renamed.
- 7853 "within 1 s" of the station's clock after 2.5 s of frames on two software-drawn pages: a wall-clock bound.
- 7717-7718 cameraRound reassigns the module-global ROOM (const ROOM0 saved); restoration is outside my range (grep above).
(7717-8005: ROOM = ROOM0 is in the finally at 8005: fine.)
# FINAL
Read: collab.mjs 4951-5750, 5751-6550, 6551-6950, 6951-7350, 7351-7750, 7751-8000 (every line, plus 8001-8010 to see the finally).
1. Bugs in the test itself
 - 5127 hintBad: `a.dist.toFixed(1)` runs before the `!a ||` guard at 5128; a missing arrow throws TypeError (guide round aborts) instead of recording a bad[] entry.
 - 6417 tokenRound finally waits on `T.proc.once('exit')` with no exitCode guard (relayOff 6479 has one): hangs if the relay already died; 6229-6233 a start timeout rejects outside the try, relay + logs dir left behind.
 - 7465/7468: `!logTxt.includes(PASS)` is vacuous when the relay's log folder is empty (nothing waits for the 10 s flush; tokenRound 6328 guards `files.length > 0`, this one does not).
 - 7661-7662 homeRound "sends it nothing": route() sees HTTP only, WebSocket to the offered host invisible; the offered name is resolvable for real. Dead fonts.googleapis filter 7656.
 - Vacuous/always-true parts: 6585-6586 (livebar absent -> '' -> pass); 6916-6917 tint on materials (`every` over empty lit list); 6931 onClock tolerance 0.25 s (true for any clip <= 0.5 s); 7168 aQuiet (true if no stream element exists); 7777 (true if HOST.collab.phone missing); 5288 `cleared` (any state but done); 7881 phone in circle 2.5 s (negative, no positive control).
 - 7273 `R1.placing` asserted true after the glide has finished: meaning unclear, verify in shared.js.
 - Stale comment 5284 ("shortened to 8 s", code 14000).
2. Wall-clock / leftover dependence
 - 5291 sleep(14300) vs a 14 s page window (could set win:1500); 6322 frames(11000) for a 10 s log flush; 7409 sleep(7000), 7425 sleep(4500) (tied to a 2 s page poll), 7327 sleep(1500), 7054/7099 sleeps as "last writer wins" guards.
 - Real-time bounds: 6666 (layer weight 1 after sleep(700)), 6718 `dtAdd < 10` (relay file watch, 3 sequential waits), 7154 voice sync <= 50 ms with a 4 s real-time fake-mic recording, 7853 within 1 s, 7947-7948 double tap 120/600 ms through Playwright latency, 7269 glide sampled by wall-clock (no minimum number of mid-glide samples; trivially true on a slow machine), 5017 rate caps (most <= 16, gap >= 60) only bound from above.
 - Order dependence: floorSpots (5458) needs the state guideRound leaves on H1/H2 (rm, calibration); studioRound's 6703-6704 `h1===1,h2===2`, 6738 `lk.n===5` depend on earlier blocks (cube added on B, ply001 deleted, no .history in the copied scene); one failed early step breaks 4+ later checks. placesRound ignores joinedTo results at 5763, 5792, 5816, 5921.
 - 6328/7468 depend on the relay's log flush; 7538, 7577-7578, 7590 assert on relay stdout wording.
3. Duplicates
 - `touch` x3 (5170, 5623, 5995), `mark/since/look/go/end` x2 (5616-5651, 5989-6016), `tap/has` x4 (5069, 6295, 6402 + 5071), `dOf` x3 (6972, 7032, 7081), `run`/`bothUntil` (5060, 7755), hopen/topen/sopen/openDevice page openers (6235, 6343, 6501, 7692). The tokenRound's second half (6338-6413, "relay a page offers", 7 checks) is a separate feature sharing only the relay; not in the main run (--token is not).
4. Corrections to the earlier findings
 - "S3 stand-in 8840-8859 overlapping 8860's neighbour" (earlier port item) is wrong: 8840-8859 overlaps no relayOn range. Real overlaps are only between relayOn scan windows (8790/8791/8792 in studioRound; 8860/8870/8880), harmless in series. startFake failure leaves S3r null and 7483 throws a TypeError.
 - "No ffmpeg guard seen": studioRound reads SRC.ffmpeg (7354, 7366, 7569) and switches expectations (mp3 vs wav22); guarded. 
 - studioRound/tokenRound use fs.rmSync only on mkdtemp dirs (fine); 6494 removes copied scene folders in the temp copy only.

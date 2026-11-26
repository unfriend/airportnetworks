Read: collab.mjs 8001-8800
- 8384-8386: after HOST.live.reload('room') sleep(1500) then until(previewOn && isPresenting): if the reload is slower than 1.5 s the OLD page still satisfies it, and lb.log (8387) 'preview camera reload' may be logged by the old page: check 8390 can pass without a reload. Race on wall-clock.
- 8286: title says "written once", asserts hb.n>=1 / hh.n>=1 (n counts writes during the 500 ms hold too, so writes before the blur satisfy it). 8281 `moved` unused.
- 8249 about(): tolerance = v*slack (key-event time) + 6% + 1 cm; on a slow machine slack grows, so hold checks 8253/8260/8264/8270 loosen themselves (pass when too slow to judge).
- 8182, 8203: depend on earlier steps' leftovers (k6 key, fov 52 from wheel at 8165); 8203 k7.v.fov===52. 8359 presN>5 is wall-clock presence rate.
- 8041-8054, 8427-8431: pages A (and B, C) opened outside try: a throw leaks pages and (preview) ROOM stays changed.
- 8512: V135 copy from git 7c32b37 failing (shallow clone, ref absent: cloud depth 50) is only a console.log; cases 3b and 6a silently skipped, run green, no counted skip.
- 8452 order: 8453 until 2000 ms wall-clock window.
Read: collab.mjs 8801-9500
- 9024-9078 (and 9086-9090): the sound-effect checks (same cues on every page, pause stops cues, join mid-play) and the slideshow stop/Next checks run ONLY for the first story of STORIES (slidesSeen = true is set before `typeof SFXQ` is tested at 9029); if that story has no SFXQ the sound block is skipped for the whole run without a check or a printed skip, and the labels say `${key}:` as if per story.
- 9056-9059: verdict passes when the machine is too slow to judge: only `judged sum >= 1` (one cue reached on one page) is needed; `once`/`all` are vacuous for pages that were asked nothing; spread tolerance `0.3 + 2*gap` grows with the slowest frame gap, so slower = looser. The "drew too few frames" line is a console.log, not a counted skip.
- 9075: `(await n(C)) === c0 || !late.length`: passes when C played nothing new (vacuous).
- 9012-9013: of 5 reads it keeps the one nearest the clock (sort by error, take [0]); fails only if all 5 are off by >0.45 s: lenient by design, can mask jitter.
- 9251-9252: `before.keys[kx].v` is evaluated outside a guard; a missing key throws a TypeError that ends the whole run, not one check.
- 9182-9186 "no ping-pong": passes also if the pages are dead (no writes either way); 5 s wall-clock floor. 9172 sleep(3500), 9361 sleep(3000), 9495 sleep(3300): floors for negative/real-time checks.
- Order dependence: 8872 removes the airports station, 8916 Arrange all re-adds it (so later stationOf results are new ids); the headset block 9271-9500 depends on the exact room state left by relay restart 9244 (A's frame publish at 9276), on `code`, NST, HEADSET_STORY; 9159 needs robots in STORIES.
- 9262/9990 lookIs/subsIs/sndIs results discarded (reset only, not checked): a failed reset leaks into later blocks silently.
- 9429-9431: HOST.room.away is monkey-patched and restored without try/finally.
Read: collab.mjs 9501-10000
- 9799: `arrRefused` compares stations() with the JSON taken one statement earlier, synchronously after arrange(): if a refused and an accepted arrange differ only after the relay's echo (the 8858/8916 code waits on `pending` for exactly that), the check passes either way. Needs an `until pending empty` before comparing. (plausible, not confirmed: depends on whether arrange applies locally at once)
- 9504-9508 `since`: counts only each key's LAST seq; a headset write overwritten by a later write in the excluded window (qA..qB) is hidden. Also the window (q2,qA] must stay empty of standbySteps writes (9303) which the comment at 9306 does not say.
- 9774-9775: expected carry distance re-implements the app's formula (exp(2*10deg), 12 m cap) inside the test: a wrong app constant and a matching test constant pass together.
- 9617: `vol === 1` and `|vol_app - vol| < 0.012`: the second term is only ever tested at 1.
- 9728: `went` is a 3 s fixed wait for something that must not happen (negative); 9967-9983 stubs X.session.end without try/finally, 9429 stubs HOST.room.away likewise: an exception inside the evaluate leaves the stub for every later block.
- 9841-9990: one 150-line evaluate feeds 6 checks (9991-10000...) that each print the whole `hand` JSON: a throw inside it fails all six at once, with no sign of which step.
- 9623-9631: press() leaves controller 0 visible, wantPress on and `src` set; 9738-9764 grabStep relies on X.aim overriding it (leftover from the previous step).
Read: collab.mjs 10001-10500
- 10005: `ROOM = [2.05, 0, 1, 0.3]` reassigns the module-global ROOM in the main body and (so far) never restores it; every round run after the main body (11082-11123 dispatch, p2p, nearby, names) inherits it unless it sets its own (previewRound/cameraRound save ROOM0 = this changed value and restore that). Order leftover.
- 10146 `keys[rcKp].v`, 10297 `keys['st.'+S2.id+'.ui'].v`: unguarded property reads (10017 guards the same key with `|| {v:{}}`); if the key is missing the TypeError ends the whole run in the middle of the headset block instead of failing one check.
- 10124, 10129, 10159, 10142, 10207 etc.: `until(...)` results discarded; the next check carries the verdict, so a timeout there shows only as a wrong value one step later.
- 10326: check('headset: the grip on the shell's own things never moves the scene', quietAfter.shell) tests HOST.anchor.locked('shell') AFTER the session ended: the same predicate as 9503 (during the session), so a duplicate that says nothing about the scene not moving.
- 10318 sleep(3200) (3 s arm window), 10005-10009 etc: loops 24x250 frames for the view (10026-10036) wait on the headset's frames, so run time depends on software frame rate.
- 10399-10404: floor check requires seenOld (a 'floor claimed' log after a marker): wall-clock loop, 24x250 frames; fine, but passes through `seenOld.was === aId`, i.e. depends on A having written 'rm' at 10395 (own write), not an independent source.
Read: collab.mjs 10501-10900
- 10838 menuIdle(400) then 10849 menuIdle(20000): the headset page's menu idle time is left at 20 s for everything after (never restored; 10898-10900 area only restores repeat/anchor/mute): leftover for later menu checks.
- 10589: 'shared space: used unless switched off (the default)' reads one setting on page A: trivial, cannot fail unless the default changes.
- 10875-10878 (s.end stub) and 10640-10646 (B's ws.send patched, undone only at 10683) have no try/finally: a throw or an early failed `until` in between leaves them for the rest of the run (B keeps swallowing its own presence).
- 10711, 10737, 10741, 10746: frames published with `Date.now() + 5000/9000/9500/10000` (future `at`) so they win against the relay's newer-wins rule: depends on the test machine's clock vs the page's `HOST.collab.now()` skew; fine on one machine.
- 10754 loop up to 100x250 ms "20 s into the session", 10803 `frames(H, 5200)`: real-time waits for timers (20 s no-scan, 5 s marks unanswered); the 'passes on slow machine' risk is absent here (they wait for the event), the cost is ~35 s of fixed time.
- 10554-10567, 10735, 10790-10793, 10820: `recal()` (calibrate + touch A + touch B + wait for saved anchors) is called 8 times in this block with 650+100 ms frames per touch: duplicated set-up, each ~2.5 s.
Read: collab.mjs 10901-11216
- 11051/11052/11067 (room on this device): the room LCL is arranged with Arrange all, which places only HOST.list (the main set; index.html 3527/3532: Experiments are not in it; 8856 adds them by hand for the main room only). HEADSET_STORY = 'flock' (392) is an Experiment, so `stations().find(s => s.story === HEADSET_STORY)` is undefined; walk() then calls headAt(undefined) (756: `s.x`) = TypeError, caught at 11206, which skips every later round. And 11067 `ist === NST` compares LCL's stations (HOST.list.length) with NST, which 8857 raised by exps.length. Unless the app's Arrange all places Experiments (shared.js 2949 not read in full), both are wrong expected values from the v188 change.
- 11084-11123 and 11206-11208: no try/catch per round; one throw (a 90 s waitForFunction, an unguarded `.v` read: 9252, 10146, 10297) aborts the remaining rounds (studio ... output, p2p, nearby, names) and prints only 'exception'; nothing lists which rounds did not run.
- 11126-11202 (--shots): reuses A, C, H, S1 of the main body after 21 rounds (about 12 min later); H and C pages have been alive and drawing all that time; the block depends on state left by 10838-10860 (menuIdle 20000, VR session, seeAll).
- 11213: global `errors` list, filters differ per opener (e.g. 10964 pushes everything, 10986 filters), so a console error on Fp4 or Up fails the run after every check passed.
- 10902: sound-toggle expectation built from the observed first value of the same string (`setT.sound.split(',')[0]`): checks only the pattern, fine but self-referential.
# FINAL
Chunk 28c: tools/collab.mjs lines 8001-11216 read line by line (all of it). Ranges read: 8001-8800, 8801-9500, 9501-10000, 10001-10500, 10501-10900, 10901-11216. Nothing run.
Ranked findings (line numbers in tools/collab.mjs):
1. 11051-11067 likely wrong expectations (see notes): flock is an Experiment, absent from an Arrange-all room; headAt(undefined) throws and skips all later rounds; `ist === NST` (NST += exps at 8857) false for the LCL room. Verify with a run before changing.
2. 11084-11123 + 11206: no per-round isolation; one throw ends the rest of the main run (21 rounds + p2p/nearby/names), reported only as 'exception'. Unguarded reads that can throw: 9252 (before.keys[kx].v), 10146 (keys[rcKp].v), 10297 (keys[...ui].v). Wrap each round, count it as its own fail, list rounds not run.
3. 9024-9090: sound-effect and slideshow-stop checks run only for the first story (slidesSeen set before the SFXQ test at 9029); silent skip if it has no SFXQ, labels say `${key}:` as if per story.
4. 9056-9059: passes when too slow to judge (needs 1 cue on 1 page; tolerance 0.3+2*gap grows with slowness; the 'too few frames' line is a console.log, not a skip). Same shape: 8249 about() tolerance grows with key-event slack (8253, 8260, 8264, 8270); 9075 vacuous when C played nothing.
5. 8384-8391 previewRound reload: sleep(1500) then until(previewOn) can be satisfied by the OLD page; the log entry 'preview camera reload' can predate the reload, so the check can pass with no reload.
6. 8512, 8741: v135 copy from git 7c32b37 failing (shallow clone) only prints a line; cases 3b and 6a are skipped, run stays green, no counted skip.
7. 10005: ROOM reassigned and never restored in the main body; later rounds (and solo vs main runs) see different ROOM. 11049-11054 restores without finally.
8. 9799 arrRefused compares stations before the echo (no wait on pending): can pass either way (plausible).
9. 8286 title 'written once' but asserts n >= 1 (writes before the blur count).
10. Leftovers and stubs without try/finally: menuIdle(20000) never restored (10849); X.session.end stubs 9967, 10875; HOST.room.away 9429; B's ws.send 10640-10683; pages opened outside try in previewRound 8041-8047 and talkRound 8427-8431.
11. Duplicates/trivial: 10326 repeats 9503's anchor.locked('shell') (after the session, says nothing about the scene); 10589 reads a default; recal() 8 times (10559); press/touch helpers; hand evaluate 9841-9990 feeds six checks (one throw fails all six).
12. Wall-clock floors in range: sleeps 3300 (9495, 9551), 3200 (10318), 3500 (9172), 3000 (9361, 8729), 5000 idle (9184), 4000 (8768); real-time frame waits 20 s no-scan (10754), 5.2 s (10803), 3 x 3000 frames (10595-10615).
13. 9504 `since` sees only each key's last seq; 9774 re-implements the app's carry formula; 9617 `vol === 1` makes the volume tolerance moot.
Earlier findings checked against the full text: no statement found wrong. Confirmed: 21 main-run rounds (11084-11123), 179 check( texts in 8827-11080 (but loops over STORIES multiply them), 8712/8713 ports, the two exclusion lines 11204-11205 (11204 lacks !P2P on purpose). Addition: the earlier cascade point (4) is stronger than it said, because the 21 rounds share one try with the main body (11206).

Read: smoke.mjs 14266-15265
- 15231 `window.__sh.layers.some(L => L.writes >= 0)` always true (writes starts 0): half of that until-condition tests nothing.
- 15186-15192 sharp swap: `seen` is set to 2 once ANY loading frame had all layers out and Math.max keeps it; "out of sight while the next builds" is not checked for every loading frame.
- 14932 until(level===1) result discarded: the step-up is never asserted on its own (only the hold afterwards); 14931/14933 `a =` unused.
- Cascades: frame rate step 2 (14360) needs xrHz=120 left by step 1 (14353); step 4 (14493) `start()` with no open needs step 3's LCL room page and its end(); sharp text steps 3-6 (15125-15198) all use the session step 2 started, no start/open: one failure in step 2 -> 4 more red lines.
- 14283/14294 take-all and offline checks fine. 14802 .catch(()=>0) harmless cleanup.
Read: smoke.mjs 15266-16265
- 15427-15436 uploads topo/qubits/mutation: "playing on: what moves goes, and the frames still differ" is never asserted (only p.frames<6); nothing proves the bufferSubData counter works for these stories, so the paused `d.buf` (0) check cannot fail if the wrapper never fires (robots step has copies>0 as proof, these do not).
- 15616-15621 stick moving "Turn: smooth (the default, v202)": xrTurn removed, then opened with `&turn=smooth`, so the default is never tested without the link; `def !== 'steps'` just reads what step 2 left (15574, 15637): dependence on the previous step's leftover.
- 15772 an eighth source-grep inside a browser step (stories/studio.js regex for `sticks: { say`), plus 15289-15298, 16049-16058 (earlier finding 1 lists 15296/16051 only).
- 15381 `XR.land.some(p => p.nd > 1) === true` passes if any card was already drawn twice earlier; not tied to the card whose signature changed.
- 15893 step uses leftover page if HOST.curKey==='studio' (self-heals if not); 15573 same pattern; 15125-15198 sharp text chain; 15919 AR two-clicks duplicates the AR case at 15748 (different story, same rule).
- 15826 stuBothWays run twice (6 outside a room, 7 at a station): intended, ~2x 60 frame ticks.
Read: smoke.mjs 16266-16765
- 16333 `(0.12 + 1.2 * 0)`: the `1.2 * 0` term is a no-op (the muzzle offset ignores the ship's speed): the bolt-position check is loose (0.25 m tolerance).
- 16611 `.catch(() => null)` swallows a 120 s STUDIO.ready timeout in goggles; the step then fails on unrelated lines (addShape etc.) instead of saying the scene never loaded.
- 16686-16752 goggles page steps run on the page's own rAF loop (HOST.flight.debug.page) and read fade/paused/thrust after fixed 400-1500 ms sleeps; at ~1-5 fps under SwiftShader that is 0-2 frames: real flake source (b1.fade 16731, th1 v 16723, l1/l2 16745-16749). Corrects earlier finding 3: unlike the stick/spaceship ticks these cannot become `tick(2)`; they need waitForFunction on the state.
- 16407 pickups "at most 2" needs exactly 2 seen within 10 ticks of timers set to 100-200 ms (random draw): timing/random dependent but bounded.
- 16508 `lbl` only used in a message; 16514 .then(true,false) fine.
Read: smoke.mjs 16766-17265
- Occlusion steps are one chain on a single AR session with ABSOLUTE counters: bindings 1 (17052), renews 1 / bindings 2 (17067), renews 2 / bindings 3 / tries.depth 1 (17078), renews 3 / bindings 4 / tries.depth 2 (17090), `s0.tries.depth !== 2` (17114), tries 6 and 6 renews (17124-17125). One red step makes every later step red (and any extra rebuild from an earlier step shifts them all).
- 17226-17231 "a stored Smooth edges off stays off" does not store it: it relies on localStorage xrOcclSmooth='off' left by the Smooth-edges steps (setSmooth(false) at 17038/17149/17222); title and test disagree on what is under test.
- 17249 source grep in browser (listed). 17162 load loop up to 400 evaluates with no message when it never loads (the following plane()/shows then fail).
- 17036 OCCL_SMOOTH_SAY env only prints; fine. 16934, 16992: expected strings duplicate the shell's own words (fine).
Read: smoke.mjs 17266-17765
- 17458 and 17487: "two taps took N ms (too slow a machine to judge)" is pushed to errors (red) not skipped; a loaded machine fails the run by design, it is a timing assertion (400 ms vs the page's own double-tap window).
- 17379-17431 phone ar: sheet steps depend on the sheet left open by step 2's `press(p,'menu')` (17370) -> 17382 `!s.open || !s.sheet`; 17409 re-presses only `if (!s0.open)`. Steps 2-4 and 6 reuse the one session from step 1.
- 17649 focus mode "explore drawer" reads `window.__fcResize` that the previous step defined (17627): leftover dependency; if that step fails early n is undefined and `window.__fcResize > n` is false, the wait times out silently (.catch) and several red lines follow.
- 17551-17666: five steps per device share the page opened in step 1 (17552); a single-step --only would run on about:blank.
- 17564-17567 (bars at 390 and 360 px, focus on) duplicates 17739 (bars at 320/360/390/430 in the two "focus mode on" modes).
- 17731/17434/17590/17612 `.catch(() => {})` on waits: all followed by an assertion on the same state, so not swallowed failures.
- 17463 r3 (two slow taps: menu not open) passes if taps do nothing at all; only r1 proves the taps work.
Read: smoke.mjs 17766-18265
- controllers after standby (17987-18129): steps compare ABSOLUTE counters from the guard (s2.fixes 18003, `s1.fixes !== 1` 18013, `s0.missed !== 1` 18031, `s2.synth !== 1` 18038, `synth !== 2` 18049, `missed !== 2`/`synth !== 3` 18059, `synth !== 4` 18073); step 5 is relative (good). One red step shifts every later number. Also shared `bad` array: the last step's failures are never flushed if it throws (18117-18128; no final flush after ctx.close at 18130), earlier steps' leftover `bad` lines are reported under the next step.
- developer mode: `file` (module-level, 18159) is set only in step 1 and read in steps 2-3 (18175-18190) -> TypeError in the wrapper if step 1 was skipped/failed. Step 3 (18200: expects 'What is new in v999') relies on the page.route stand-in that step 2 left installed (18184, removed only at 18226). Step 3's #btnDev click (18228) expects devMode on from step 2 and ends with #dev=off (18231); step 4 (18243: 'Developer mode: off/false') relies on that. One chain, four steps.
- 18166 and 18181 2.5 s waits assert a negative (no card) after a load that has already waited for the scene: only a negative check, as the earlier finding says (Not-worth-changing list item holds).
- 17830 `fs !== 3` counts full-screen asks over the whole step (1 + 2 in the loop); fine but order dependent inside the step.
- 17787-17791 and 17862-17865 each assert a negative after a fixed 5 s (4 such waits in 17768-17866 plus 17784, 17859; earlier finding said 4: there are 5 in phones + iPhone: 17784, 17789, 17859, 17864 = 4, matches).
Read: smoke.mjs 18266-18765
- 18424-18432 developer mode (page) history scroll: asserts `sc.sh > sc.ch + 20` and scrollTop reaching >= 40 on the REAL newest whatsnew release at a 460 px window; whatsnew.json is rewritten by hand every release ("a handful each"), so a short release makes this red with no code change. The headset twin (18442) stubs a 30-item list; the page one should too.
- 18345-18347: the Settings-row step assumes devMode 'off' left by the previous step's end (18336) and the open headset page from its last xr(); 18324/18382/18387/18412 read `file` from step 1 of the block (18164). Chain: 18162 -> 18171 -> 18197 -> 18236 and 18303 -> 18342.
- 18382 `idx.versions.length < 17` and 'networks-v127' hard-coded history sizes (fine today, grows only); 18414 stubs 'networks-v141' which need not exist (harmless).
- 18456 magic 602 (scroll step) and 18333 `< 2000` ms hard-coded in the shell's timer values (copies of shell constants).
- 18486 400 ms wait for "a ray's hover lasts 250 ms": real-time; 18482-18490 stick loops 1200/600/600/1200 ms real time.
- 18524 hard-coded list of files copied for the release test: couples the test to release.mjs's reads (fails with a message, fine).
- trackers steps 1-2 (18584-18713) deterministic; 18642 fetch stub left on the page for later steps.
Read: smoke.mjs 18766-19017
- trackers steps 3-5 (18763-18864) chain on step 2: step 3 needs trk on and the hand-made frame from the dialog step; the pucks step expects LHR-B named 'Belt' and last heard at [-1,0.9,0.5] from step 2 (18820); the three steps share one headset pretend.
- update the room: 18926 `r.orders !== 2` is cumulative over step 1's single order (18905); step 5 (18966) needs the page that step 4's real reload produced; HOST.live.roomNewer (18972) is overwritten and never restored (page closed, harmless).
- 19010-19013 the last step only proves spatial.html reaches HOST.curKey 'spatial' (the hash t=20 is not checked, proteins.html not tested); 19015 prints 'all good' when errors is empty, whatever ran (a --only that matches no block would also say all good: not verified, the filter is at lines 35-57, outside my range).

# FINAL
Range read: smoke.mjs 14266-15265, 15266-16265, 16266-16765, 16766-17265, 17266-17765, 17766-18265, 18266-18765, 18766-19017 (every line, Read tool).
## New real defects in the test (ranked)
1. 15231 `window.__sh.layers.some(L => L.writes >= 0)` is always true (writes starts at 0): half of that until-condition tests nothing (the failing-write step still checks `blending === 1` and the error text, so the step is not empty).
2. 15427-15436 uploads topo/qubits/mutation: the comment promises "playing on: what moves goes, and the frames still differ" but only `p.frames < 6` is asserted; nothing shows the bufferSubData wrapper fires for these stories, so the paused `d.buf` check (0) cannot fail if the counter is dead (the robots step has copies>0 as proof; these do not).
3. 15616-15621 Turn smooth "the default (v202)": xrTurn is removed, then the page is opened with `&turn=smooth`, so the default itself is never tested; `def !== 'steps'` only reads what the step before left (15574/15637).
4. 18424-18432 developer mode history scroll asserts the real newest whatsnew release has lists longer than a 460 px window (`sh > ch + 20`, scrollTop >= 40): whatsnew.json is rewritten by hand every release, so a short release turns it red with no code change. The headset twin (18442) stubs 30 items; do the same here.
5. 17226-17231 "a stored Smooth edges off stays off" stores nothing: it depends on xrOcclSmooth='off' left by the Smooth-edges steps (17038/17149/17222); title and test disagree.
6. 15186-15192 sharp text swap: `seen` becomes 2 once ANY loading frame had every layer out and never goes back (Math.max); "out of sight while the next builds" is not checked for every loading frame.
7. 14932 until(level===1) result discarded: the step up is never asserted; only the hold after it is. 15381 `XR.land.some(p => p.nd > 1)` is not tied to the card whose signature changed. 16333 `1.2 * 0` no-op. 16611 `.catch(() => null)` hides a goggles scene that never loads (later lines fail unrelated).
## Order/leftover dependence (line numbers)
- occlusion 16930-17251: one AR session, absolute counters bindings/renews/tries (17052, 17067, 17078, 17090, 17114, 17124-17125): one red step reddens all later.
- controllers after standby 17987-18129: absolute guard counters (18003, 18013, 18031, 18038, 18049, 18059, 18073); `bad` shared: last step's failures not flushed if it throws (18117-18130).
- developer mode: `file` from 18164 read at 18175-18412; step 3 relies on step 2's route stub v999 (18184, 18200); 18345 assumes devMode off from 18336; 18243 assumes off from 18231. Chains 18162->18236 and 18303->18342.
- stick moving 15614-15639 (xrTurn left by the step before), phone ar 17379-17431 (sheet left open by 17370), focus mode 17649 (`__fcResize` from 17627, five steps share one page from 17552), sharp text 15125-15198 (session from 15114), frame rate 14360 (xrHz=120 from 14353) and 14493 (room page from 14400), trackers 18763-18864, update the room 18926 (cumulative orders).
## Timing/flake
- 17458, 17487: "taps took N ms (too slow a machine to judge)" is pushed as an error: a loaded machine fails the run by design.
- goggles 16686-16752: fade/pause/thrust read after 400-1500 ms sleeps on the page's own rAF loop (0-2 frames under SwiftShader); 16731, 16723, 16745-16749.
- 18486 400 ms real wait for a 250 ms hover; 18482-18490 real-time stick loops.
## Duplicates
- 17564-17567 (bars at 390 and 360 px, focus on) is repeated by 17739 (320/360/390/430, same `bars`). AR "two clicks say why" at 15748 and 15919 (different pages, same rule). 15772 is an eighth in-browser source grep (stories/studio.js regex): add to earlier finding 1 with 15289-15298, 16049-16058, 17247-17250.
## Corrections to the earlier findings
- Finding 3 is wrong for most of stick moving: the 500 ms waits at 15536, 15539, 15543, 15549, 15552, 15562-15565 wait for the PAGE's 0.4 s double-click clock (header 15457-15458: frames are the test's clock, clicks are the page's), so tick(2) cannot replace them. Goggles waits (16696-16751) are real rAF frames and need waitForFunction, not tick. "5 s waits in phone ar (17784, 17789, 17859, 17864)" are in the phones and iPhone steps, not phone ar; shortening them to 1 s is unsafe: the positive wait for the same card allows 15 s (17774, 17853). 17600 is focus mode's "playing" wait, not the welcome's timer (that is frames(p, 2900) at 17438).
- Finding 9: away idle x3 (15303: hand-written, built-from-sets, live simulation) and uploads x3 (15427: three instance-pool stories) are per-story tests by design (headers 15286, 15400), not redundant reloads; only the anchored-placement loop is.
- Finding 4(e) is right but understated: the chains above are far longer than the paint/relay ones it names.
- Not wrong: finding 1's other six sites, 6, 7; "Not worth changing" items hold (release.mjs temp copy 18519-18556 is correct, uses rmSync only on its own mkdtemp dir).

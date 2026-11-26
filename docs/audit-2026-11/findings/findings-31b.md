Read: smoke.mjs 3131-3930
- 3185 txp.once('filechooser',()=>{}) does nothing (stub left over). 3196/3249/3253/3257/3747/3766/3823/3912/3537 until() result ignored (later assertion catches, but a timeout is not named).
- 3222 px null (no image) => TypeError on rm.px[1] (only when all earlier conds pass) -> kills run (step has no try/catch).
- 3239 / 3341 / 3722 / 3826 early `return` after load failure: later steps of the block run on a half-state; 3826 leaves the 'Slice' cut-out (no undo) so 3883 (cuts.length===2), 3887 (items 6), 3840 (size 8) cascade-fail.
- 3436, 3534, 3667, 3836, 3878 `while (UNDO.length) undo()` in Node loop / in-page: hangs forever if undo() does not shrink UNDO (no bound).
- 3442-3490: catch returns {err} but leaves XR.on=true, XR.clear, controllers set, sceneClock held, UNDO entries -> leaks into the next steps (3504, 3543).
- 3737-3739 as-scanned pixel check runs right after setRec with no frames/wait: timing on rebuild of materials.
- 3744-3758 depends on real fade time (until 5000) and now0[1] false right after shownFor.
Read: smoke.mjs 3931-4630
- 4103-4106: after a caught in-page error (4101 .catch) XR.on, XR.free, controllers, held cuts stay set (no finally) -> next step 4110/4151 start dirty. Same for 4379/4433/4492/4583 (groups): on r.err the step returns at 4381/4435/4494/4585 without the in-page Undo/restore; next steps (all depend on step 1's Group via window.__gr.gid()) cascade with misleading errors; 4585 return skips `await gp.close()` (4598) -> page left open.
- Groups steps 2-5 (4340-4599) depend entirely on step 1 (4256) having built the Group and left it (not undone); step 1's early returns 4259/4268 leave nothing built.
- 4151-4186 depends on 4110 clearing STU.cutF/whole (4144, only if no throw) and on the card step 3896 restoring wall/door via Undo.
- 4276 waitForTimeout(300), 4294 waitForTimeout(250) (gap between two clicks so they are not a double click): timing.
- 4110: lookNow compares exact floats (0.07, 0.333) = brittle to rounding but deterministic; pixel check d>3 only guards 'box drawn vs not at one pixel'.
Read: smoke.mjs 4631-4960
- 4919-4934 `let ok=false` set by the first colour step; the rest are `if (ok) await step(...)`: with `--only 'studio colour: a pointer drag'` (any step but the first) ok stays false, so the chosen step is silently skipped and the run is green (a test that tests nothing under --only). Also 4951 (typed hex) uses the popover left open by 4934 without open(): order dependence.
- 4690/4693/4803/4805 early returns leave tint/faces state, and 4690/4693 skip `fp.close()` (4731); the faces/tint blocks also leave fig001 put by putItem (4689, 4802: not undoable, `undo()` at 4701/4813 only takes back the GLB switch, removeItem only in tint 4813).
- 4938 waitForTimeout(150) then asserts the box was previewed (mid[1] !== c0, 4943): timing on slow machine.
- 4852-4854 low[3]==='disabled' depends on exactly 7 presses (0.8^7 < 0.25): fine but coupled to the 25 % limit.
- 4872 Node-side `while (await ss('UNDO.length') > u0) await ss('undo()')`: unbounded.
- 4701 `undo()` inside a list: relies on the switch being the last Undo step (not checked).
Read: smoke.mjs 4961-5290
- 4993 `want` (the recent's hex) is computed and only printed; the assertion tests just /^#[0-9a-f]{6}$/ and the Undo count, so "a recent writes ITS colour" is not asserted (should be b[0]===want).
- 5082 third element of o.square (shown !== from ? 0 : 1) is never read (5112 checks [0],[1] only): dead measurement.
- 5018-5046: addShape('cube') (5020) is never removed (only its colour change is undone) -> a leftover item in the scene for 5047 and the rest of the block.
- 4967/4984 depend on the popover left open by 4934/4951 (no open() until 5012): chain of 4 steps on one open popover; 4971 expects '#aabbcc','#3366cc' from step 4951's inputs.
- 5047-5106 in-page, no catch, XR.on=true left on throw; any exception kills the run (main step has no try/catch).
- 5005/5037 waitForTimeout(100) then asserts a drag preview happened (during !== c0, d[1] live): timing.
- 5184 live: if no AudioEncoder the whole decode check is only a console.log (cannot fail); 5168-5188 uses real setTimeout (20 ms x 50 frames) and asserts lagMs 100..1500, exact frames===chunks-1, lost===1: wall-clock under SwiftShader.
- 5221-5222 negative assertion after a fixed 300 ms sleep ('handed over for 0.3 m'): passes vacuously if the handover is just slow; the positive case at 5224 does wait.
- 5251 `.catch(()=>{})` on the wait for flock, then only s.claimed false is asserted.
- 5267 talk's step() wrapper (try/catch) shadows the main step: confirmed as in earlier findings.
Read: smoke.mjs 5291-5620
- 5399 / 5447 (talk): when AudioEncoder is missing the hearing/voices steps `return` after a console.log: they cannot fail and report green (the whole decode/HRTF check is skipped); same in 5487 (ctxOk false -> only a log). Real Chromium headless usually has it, but a silent skip is a green result for 'tests nothing'.
- 5411-5430 talk heard: exact frames (49/50), lost, gain===1 and lagMs 40..600, target 60..300 depend on in-page real timers (20 ms sleep x 50, 500 ms decoder warm-up at 5404): flake under SwiftShader though the page viewport is shrunk to 480x300 (5296) to help.
- 5459-5471 HRTF step: real-time feed loops (500+400+800 ms) with put()/F.step; 5478 waits <=500 ms for 'flat' after session end.
- 5530 edit speed step 1 sets XR.lm='face' and never restores it (finally restores XR.on, hover, loop only); 5569 step 2 leaves APP.mode='explore', XR.stories=false set. Steps share the page.
- 5547 `n2.texImage2D !== 1` exact upload count: brittle to how the sprite texture is made, not a bug.
Read: smoke.mjs 5621-5950
- 5649 title says each extra empty 'adds a draw each', assertion is only an upper bound (on2-on > 10 fails) plus st2.tags >= st.tags+10; passes if no draw is added.
- 5762/5826/5830/5839/5842 (viewer) early returns leave the viewer open or the Upload rows planned (upClear only at 5835/5866): the next step starts dirty; 5876-5883 early returns skip the ball.glb route cleanup and `vp.close()` (5899) -> page left open.
- 5779 `until(...)` result ignored then asserted; 5811 `.catch(()=>{})` on the frames wait, then asserts d1 <= d0+1 (a page that drew no frames passes that part).
- 5895 Node-side unbounded `while (await ss('UNDO.length') > u0) undo()` again.
- 5921-5950 ktx2: `let made=false` set at 5950 gates later steps (same --only skip problem as 'ok' in colour/live).
Read: smoke.mjs 5951-6300
- 6002/6047 `if (!made) { bad(['no KTX2 GLB ...']) }` give a false red under --only (made is set by the first step 5950); 6071/6088 `if (made)` silently skip.
- 6163 step 1 creates STUDIO.ids (6173) that steps 3-4 (6253, 6286) read: early return at 6166 -> TypeError inside in-page code with no catch -> run dies. 6286 `UNDO.length = 0` truncates the Undo list of earlier steps on purpose.
- 6251-6270 'a cube hiding the empty silences it' asserts only `STU.items.get(snd).heard` falsy: no positive control that the sound was heard before (3567 waits for heard first); with audio muted/not started it cannot fail.
- 6297 sp.keyboard.press('Delete') with focus on the Lock button just clicked: if the studio's key handler ignores keys from buttons, 'refused' is vacuous (record untouched anyway). Unverified (handler outside range).
- 6014 draw() mutates the KTX2 map (encoding Linear, filters, repeat) before capCompressed(map) at 6027 in the same page: the cap check runs on a modified texture.

# FINAL
Range read in full: smoke.mjs 3131-3930, 3931-4630, 4631-4960, 4961-5290, 5291-5620, 5621-5950, 5951-6300 (every line, Read tool).
(1) Bugs in the test itself, by importance
 a. 6251-6270 silence-by-cube asserts only heard===falsy, no positive control (cf. 3567): cannot fail if audio never started.
 b. 5221-5222 'no handover for 0.3 m' is a negative after a fixed 300 ms: passes vacuously when slow. 5184, 5399, 5447, 5487: AudioEncoder/context missing => the check only console.logs and returns green.
 c. 4919-4934 `ok`, 5921 `made`, 5138 `ok`: later steps are gated on a flag set by an earlier step. Under --only for a later step: colour/live steps are silently skipped (green), ktx2 steps 6002/6047 give a false red.
 d. 4993 the recent's hex `want` is computed, never compared; 5082 third item of o.square never read; 5649 'adds a draw each' only an upper bound; 3185 filechooser stub does nothing; 3222 TypeError if px null (kills run: main step() has no try/catch).
 e. 3737-3739, 4678-4681: as-scanned/lit pixel read right after setRec with no frame wait (rebuild timing).
(2) Order/leftover/timing dependencies
 - Whole blocks chain on the first step: follow 3338 (page load, HELP), cuts 3719, groups 4256 (the Group is read by gid() in 4340-4599), shapes 6163 (STUDIO.ids), colour 4934->4951->4967->4984 (one popover left open, recents 4971 from 4964).
 - Early `return` after a failed load/convert leaves state: 3826 leaves the 'Slice' cut-out so 3840 (size 8), 3883 (cuts 2), 3887 (items 6) cascade; 4381/4435/4494/4585 return before restore, 4585/4690/4693/5876-5883 skip page.close().
 - Caught in-page errors (.catch at 3490, 4101, 4379...) leave XR.on, XR.free, controllers, held sceneClock, cut previews set for the next step; no finally. 5530 sets XR.lm='face', never restored; 5020 addShape never removed.
 - Real-time: 3352 (2500 ms), 4276/4294 (300/250), 4938 (150), 5000 (700), 5005/5037 (100), 5404 (500), 5168-5188 live lag 100..1500 ms and exact frame/lost counts, 5411-5430 talk lag 40..600 ms, 4943/5010 preview within 100-150 ms, 3744-3758 fade until 5000.
 - Node-side unbounded `while (await ss('UNDO.length')...) undo()` at 3436, 3534, 4872, 5895 (hangs if undo() stops shrinking).
(3) Duplicates
 - Convert figure.fbx -> route -> switchToGLB -> restore: 5 copies (3162-3180 rust, 3516-3537, 3827-3839, 4694-4702, 4806-4814): four 90 s conversions of the same file; 'rebuild of its file' (fileChanged('box.glb')) in 4686 and 4797.
 - Headset ids()/press() scroll loops pasted 8x (3635, 4091, 4569, 4723, 4878, 5215, 6215...); rig-scene goto+ready wait 9x; Twin/box fixtures 4645 and 4776; shot()/two() pixel helpers 4 copies (HELP in cuts, faces, tint, shapes).
(4) Earlier findings checked
 - Confirmed: step() has no try/catch; talk shadows it (5267); only talk's TALK_INIT sets the full test settings; studio blocks use their own pages (leak between blocks contained).
 - Add to its waitForTimeout list: 4276, 4294, 4938, 5005, 5037 (small).
 - Correction: the 'while UNDO.length undo()' repeats in my range are mostly Node-side loops, not in-page; the 'studio' pages are closed only by the last step of each block, so a failed/early-returned block leaves its page open (harmless, browser closes at end).
Files: /home/user/airportnetworks/tools/smoke.mjs; notes /tmp/claude-0/-home-user-airportnetworks/d3fa415a-d304-5531-b3f1-7d363fea03c2/scratchpad/audit/findings-31b.md

Read: smoke.mjs 6301-7100
- 6495: `await until(STU.listing==='ok')` result discarded (a timeout passes silently).
- 6502/6761: page closed only at last step end; no step try/catch so a throw leaves page open (no effect on later blocks since new pages).
- 6748-6750: want has `undefined` entries (11,12) compared via JSON.stringify: undefined and null conflated, so norm('c'/'s').behaviour returning null would pass.
- 6662 comment "last 8 are kept" vs 16 sends; harmless.
- 7058 pz4[2] `JSON.stringify(collabState()).length>0` always true and never checked.
- 6859 step 2 (always on two pages) depends on step 1 leftovers (mp HELP/PUT, mp2 loaded in step 1); 6607,6638,6674 behaviours steps depend on bhf001/bha001 state left by prior steps (BEH.fake, X.view='orbit' set at 6630 and never reset; 6638 setEdit(true) restores edit but view stays orbit).
- 6428: `!await hk(11)` relies on hk helper returning truthy (defined outside range).
Read: smoke.mjs 7101-7900
- 7135/7668 and 6748: expected arrays hold `undefined` slots compared through JSON.stringify -> null; slot 17/18 (norm('c'/'x').path) pass for null too (weak, not wrong). 7896 xr expects `null` for rec.idle/strideK after pressing "still"/"As measured": undefined in array also prints null, so `idle: null` or deleted both pass.
- 7736, 7747: `J(x).slice(0,200)` where x may be undefined: JSON.stringify(undefined) is undefined -> .slice throws TypeError, so the failure message path itself throws (still red but kills the run, no step try/catch).
- 7691, 7495-style `await until(...)` results ignored (7691 STUDIO.ready 60s): timeout silent.
- 7058/pz4[2] (earlier range) same pattern; 7650 cleanup `.catch(()=>{})` outside any step (intentional).
- Order dependence: every studio block's later steps need step 1's goto + HELP/PUT: `--only 'studio paths: the state'` (or any non-first step) runs on about:blank and throws. Within paths: 7344 expects pth001 left clean (no path) by 7242/7293; 7414 expects path.speed 1 left by the 7388 seq (pspeed +,- then +=1.5); 7633 expects FLOOR on from the row click at 7506; 7421 relies on box001 having no path left by earlier step (7236 undo). Walks: 7819 follower relies on wlk001 path restored (7816); 7857 relies on wlk001 rec after 7779 (play restored 7816, anim/idle from scene).
- 7650: reset of FLOOR/localStorage sits outside step(); with --only skipping the step, rp is blank (caught).
- 7421 `if (keep) HOST.sfx.play = keep` not restored if play was falsy: harmless.
Read: smoke.mjs 7901-8300
- CORRECTS earlier "ONE browser per run": 'studio recorder' block 7930 launches its own second chromium (fake-mic flags) plus its own relay on 8930-8959 (7918-7929), closed in finally 8289-8292.
- 8057 step 3 and 8164 step 4 depend on step 1's leftovers: box001 path src 'recordings/Box-1.json' (8091 find(...).rec.path, 8100, 8128 note text, 8137), window.__rc from step 1's HELP; step 4 leaves a voice/undo stack state step 5 does not need but needs mute handled. If step 1 fails/returns early (7969,7970,7980) steps 3-4 throw TypeError (no step try/catch).
- 8168/8188 early `return` skip `HOST.audio.mute(true)` at 8257 (mic/voice and unmute leak into next step; step 5 re-mutes at 8286).
- 8213-8215 getUserMedia patch restored only if rec() does not throw.
- 8221 `past = null` unused.
- Real-time assertions (flake): 8203/8207/8229 voice within 50 ms of path clock; 8272 med<=0.06 max<=0.12 from 200 ms evaluate polls; 8280 `g.gt !== g.want` exact float equality; 8016 `j.k[last][0] !== rec.len` exact equality; waits 8181 (4000), 8270 (1000), 8281 (1500).
- 8241 skip:0 expected null (undefined) -> conflation again.
Read: smoke.mjs 8301-8700
- Checked: relay `--quiet` does not hide the "relay listening on" line (relay/server.mjs:3253 uses console.log, not log()), so the port detection at 7924 works.
- Texture swaps (8305-8528): steps 2-6 all depend on step 1's route (8342), HELP, files and the items twn001/txa001/txb001/txc001; step 3 (8392) has no own setup and needs txa001.tex == [E()] left by step 2's last line (8388); step 5 (8456) needs the 2-entry state step 4's undo (8438) leaves; step 6 8478 resets txa001 itself. Early `return`s at 8339/8349/8514 skip `tp.close()` (8526) and leave the page open.
- 8452 `[null,true,null,true,true]`: STU.txp undefined also prints null (weak). 8398: `STU.badTex = 3 ... = 0` assumes 0 beforehand.
- 8359 `await look(C); await look(OUT);` are setup, not assertions (fine, but the assertion that follows at 8361 only passes if the lobby hook clears what C set).
- Cube starts (8533+): clips step is deterministic (held trgClock) but 8690 switches trgClock to the real performance.now and unmutes audio (8688) for the following steps; 8697 waitForTimeout(1000) then 8698 `until` result ignored (deliberate).
- 8672: `select('plw001')` side effect inside an assertion expression; 8675 undoes with select('').
Read: smoke.mjs 8701-9100
- 8731: message says "faded to 0 within 0.6 s" but the assertion is `h1 - h0 > 900` (and h0/h1 are two evaluate round trips plus until's polling); wall-clock assertion, message and limit disagree.
- 8720, 8734, 8739, 8744 `until()` results discarded (the assertion after catches most; 8744 is cleanup).
- Cube-starts steps are a chain: 8686 sounds step needs W/S/D/H cubes and box001 from the clips step (8564-8571) and switches trgClock to real time (8690); 8748 resets trgClock (8750) so it does not depend on that; 8865 (page card) needs trgClock = window.__T left by 8748 and plw001's plays chain (8918 expects 'starts 2' only after 8888-8899); 8952 uses window.__T left by earlier steps (+60000); 8982 needs E/plays on plw001/pls001.
- Duplicate: 8982 (delete box001 / duplicate / cube copy / group copy / figure.fbx converted and switched to GLB, 90 s convert wait 9010) repeats 8476 (texture swaps step 6) almost line for line with tex vs plays; both convert figure.fbx (8514, 9010) and route the same models/figure.glb. A shared helper (entries kind param) would remove ~25 lines and one 90 s conversion if the converted GLB bytes were cached (window var / node variable) between blocks.
- 8851-8857: outer `E` (8556) shadowed by a `const E` inside the step callback (8857): fine (no TDZ), but easy to break.
- 9072 `GL.renderer.setAnimationLoop(null)` never restored (page-local, block ends with page).
- Counted arrays: 8839 st has 22 items, want 22; 8982 d 12/12; 8392 20/20; 8476 14/14: all consistent.
Read: smoke.mjs 9101-9510
- 9492 tie test has no positive control: a waiting sequence-named figure is already hidden, so "B (hide) wins" passes even if neither sequence fired (cannot fail on a broken tie rule that does nothing); the sequences' own steps use a control (9485), this one does not.
- 9493-9494: putItem('qcb001') then `STU.items.delete('qcb001'); removeItem('qcb001')`: removeItem returns at once when the item is already gone (e6_items.js:318-319), so the cube's look/tick/tag stay in GL.edit; the putItem at 9493 is pointless.
- 9386 `setEdit(false)` and 9072 `setAnimationLoop(null)`: state left for later steps; steps 9393+ rely on seq001 left by 9386's mkMain (9393 does not call mkMain).
- 9461 title says 2.2 s, test uses 2.15 s; message prints `!k[1]`.
- 9204 times chosen by hand ("between the frames above and the chain's below", 9214): monotonic-clock assumption between steps.
- 9238 d 25/25, 9150 pk 12/12, 9342 l 12/12 consistent.
- Range ends mid-step (9498-9510); the assertion on `b` lies beyond 9510.

# FINAL
Chunk 32b: tools/smoke.mjs lines 6301-9510 (studio blocks). Read: smoke.mjs 6301-9510 in full, line by line (7 reads).

## Findings, by importance
1. Weak/never-failing assertions
 - 9492: sequence tie ("higher id wins") has no positive control; a still-waiting figure is already hidden, so it passes if neither sequence ever fired. Add a shown check at 9491+0.55 s, or make A's show later than B's hide.
 - 9493-9494: puts qcb001 then `STU.items.delete` before `removeItem`; removeItem returns early (e6_items.js:318), cube look/tick/tag leak into GL.edit; the putItem is dead.
 - JSON.stringify turns undefined into null in expected arrays: 6748-6750, 7135, 7668, 7896 (idle/strideK after Still/As measured), 8241 (skip 0), 8452/8928 (STU.txp/plp undefined), 8510. A record that wrongly holds null passes where the test means "absent".
 - 7058 pz4[2] `JSON.stringify(collabState()).length > 0` is always true and never read.
 - 8731: message says "faded to 0 within 0.6 s", limit is 900 ms on wall clock taken over two evaluate round trips; 8203/8207/8229 (50 ms), 8272 (med 0.06, max 0.12 from 200 ms polls), 8723/8742 (0.3 s) are real-time against SwiftShader.
 - 8280 `g.gt !== g.want`, 8016 `j.k[last][0] !== rec.len`, 8786/8617 `off` equality: exact floats; fine only while values are integers/copied.
2. A thrown error in a failure message kills the run (no step try/catch, as earlier finding says): 7736, 7747 `J(x).slice()` with x undefined (JSON.stringify(undefined) is undefined); 6742/7131/7660 `L.objects.find(o => o.id === 'fig001')` without a guard.
3. Order dependence (leftovers), by block
 - Every studio block: step 1 does goto + HELP/PUT; any later step alone runs on about:blank and throws (so `--only` can only name the block, not a step). Affects behaviours 6543-6762, motions 6810-7143, paths 7194-7693, walks 7719-7899, recorder 7968-8288, texture swaps 8336-8527, cube starts 8559-9040, cube switches 9068-9238, sequences 9342+. Contradicts the earlier "contained" note: contained between blocks, not inside them.
 - Specific: 7344 needs pth001 without a path (7242/7293 end), 7414 needs path.speed 1 left by the 7388 clicks, 7633 needs FLOOR on from 7506, 7421 needs box001 with no path; 8057/8164 need box001's file path from 8047's recording (8091, 8100, 8128, 8137) and window.__rc; 8392 needs txa001.tex == [E()] from 8388; 8456 needs 8438's undo state; 8865 needs trgClock = window.__T from 8750 (8690 had switched it to real time), plw001's plays chain (8918 'starts 2'); 8952 reads window.__T from earlier steps (+60000); 9393 needs seq001 from 9387; 6638/6674 need BEH.fake/X.view='orbit' (6630) not reset; clocks must only increase (9214 hand-picked 9410/9455 between 9404 and 9500).
 - 7650: FLOOR/localStorage reset sits outside any step.
4. Duplicates: 8982-9007 repeats 8476-8499 (delete/duplicate/cube copy/group copy/convert figure.fbx and switch to GLB); figure.fbx is converted twice (8513, 9009), 90 s waits each; GLB bytes could be cached between blocks. "Press X in the headset" scroll/draw helper repeated verbatim 20+ times in range (6357, 6415, 6716, 6943, 7410, 7625, 7888, 8459, 8935 ...). Norm-rule/round-trip steps (6450, 6732, 7123, 7651, 8392, 8839) share one shape (state apply back, layout round trip, norm table).
5. Resource/cleanup: 7930 launches a second Chromium plus its own relay (7918-7929) — corrects the earlier "ONE browser per run"; closed in finally (8289). Early returns leave pages open: 8339, 8349, 8514 (tp), 9010 (cp), 9071; 8168/8188 skip `HOST.audio.mute(true)` (8257); 8213-8215 getUserMedia patch not restored on throw. Smoke itself uses `RL.proc.kill()` and `fs.rmSync` (8291-8292) on its own temp dir only (no conflict with the no-rm rule for repo files).
6. Discarded waits: 6495, 7691, 8698, 8720, 8734, 8739, 8744 ignore the boolean `until` returns (8698 deliberate).
7. Corrections to earlier findings
 - "ONE browser per run" is wrong for 'studio recorder' (7930, own browser, relay and port 8930-8959).
 - Fixed sleeps: recorder block is ~16.8 s of literal waits (4000 x2 at 8181, 1000 at 8270, 1500 at 8281, 300 at 8207, sampling loops 3000+1500+1500 at 8271-8282), not 6.8 s; cube starts ~8.6 s is right (8.0 s sounds step + 0.6 s at 9025). Plus a 90 s conversion wait twice (8514, 9010) and a 10-minute recording stepped 18,100 frames (7975).
 - "--list/static scan": step names here are template-free literals, so a static scan works, but several are > 600 chars (6371, 6953 ~1,100, 7421, 8164).
 - Relay `--quiet` does not hide the listening line (relay/server.mjs:3253), so 7924's wait is sound.
 - Counted expected arrays (8392, 8476, 8839, 8982, 9150, 9238, 9342) all match their code (no wrong-length expected values found).
Ranges read: 6301-7100, 7101-7900, 7901-8300, 8301-8700, 8701-9100, 9101-9510 (all lines).

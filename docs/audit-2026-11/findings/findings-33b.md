Read: smoke.mjs 9511-10510
- 9634 `!near(d[1],1,0.01+0.0) && !near(d[1],1.0,0.11)` = just near(d[1],1,0.11): the "snapped to 0.1 s" is not checked (1.05 passes); first clause redundant.
- 10279 (streams step 2) expects box001.stream [{y,cc7}] left behind by step 1 (10244, never cleared): leftover dependency (plus `ready`).
- 10282 near check: |r8 - hypot(r5,0.6,2)| < 0.3 while hypot ranges 2.09..2.29 for r5 in 0..1: cannot detect a wrong x offset (passes for any value 1.8-2.6).
- 10281 phase compare ok. 10417 r[6] check only 0<=x<=1 (trivial).
- 10208 `.catch(()=>0)` swallows cleanup failure (harmless). 9872 step comment says it relies on "the step before leaves the figure shown" (but calls clean first).
- 9706 last sequences step closes sp: if only that step is selected by --only the earlier steps' page open is skipped (same family as ready).
Read: smoke.mjs 10511-11010
- 10684-10687 trails "its trail off": `a` (items after 100 ms) is computed and never asserted; only o[1..4] after +3.1 s, so "fades and goes after its length" cannot be told from "goes at once".
- 10941-10942 walls: "the session's end takes them" comment then `WALLS.src === 'xr' && wallsSet([], '')` and STUDIO.walls(null): nothing asserted after; the step tests nothing.
- 10876 walls "no walls, not where placed": `STUDIO.pose(id).drawn && !near(...)`: if drawn is falsy for all four the check passes vacuously.
- 10949, 10972-10978 walls step 2 relies on step 1's items wdr001/wnr001/wtl001/wps001 and page `wp` (leftover; no ready guard; if step 1 returns early step 2 throws on a blank page). Same for loops steps 10511-10560 (cleanup runs only at the end of the same evaluate: an exception leaves lpq003/lpr001 etc. for the next step).
- 10748/10831 everyone: pages closed only on the two normal paths; an assertion exception leaks two pages. Comment 10765 says A is 1e6 behind the room's clock; it is 4e6 (expected values 999800 are right).
- 10282 weak near (above); 10524 order-tolerant ok.
Read: smoke.mjs 11511-11930
- 11781-11782 shuffle: `sh[4]` (shuffleOrder(9,12345)) and `sh[5]` (shuffleOrder(9,2147483648)) are computed and never compared with a literal; the step says "a fixed function" but only checks self-equality, permutation, other-seed-differs and seed 0. A changed algorithm (devices would disagree on the order) passes.
- 11899-11900 `const want = [r[0]]; void want;` dead code. 11879 `old` and 11822 `r` (descriptor) unused. 11849: c2[6] (UNDO.length after scNext with editing off) pushed, never compared. 11657 c0[2] UNDO.length unused.
- 11591/11592 confirmed (ffmpeg missing = console.log skip, run green). 11588 r.status null (ENOENT) also lands in skip.
- 11651-11922 all screens steps chain on `sp` and `sid` from step 1 and on each other's state (HOLD/`__ck`, SCR.dur.set stub at 11761 left in place if the step throws before 11783, `hid001` cube and `lim00x` items removed only on the success path 11825); `if (!sp) return` makes them print ok when step 1 failed (step 1 did push an error, so only a --only run hides it).
- 11654 `HOST.audio.mute(false)` and 11806 1.5 s sleep + `t0 > 1.4` rest on real time (0.3 s play + 1.5 s hidden): small margin only on the low side.
- 11519 relay paint step: leftovers chain (painting __pid across 11544-11565); `fs.rmSync` of its own mkdtemp dir in finally (test code, fine).
Read: smoke.mjs 11931-12350
- 11993-11995 (screens, two pages, sync own): `ia !== 0 && ia !== 1` passes for either entry; `ib !== (ia===0?1:0) && ib !== 1` is true only when ib is neither 0 nor 1. Both checks accept any of the two possible values: they cannot fail on a wrong own entry (A own should be fixed by the earlier press; B pressed Next so B should be 1).
- Page `sp` made at 11621 by `mk('&edit')` is never closed in the screens block (only pa/pb at 11996 and vp at 11859 are); it keeps its video elements and audio nodes alive through examples, xp, tour... (leak; the block ends at 12000 without sp.close()).
- 11956 two-page step: pa/pb closed only on the success path (11996); an exception leaks them.
- 12257 and 12319: `waitForTimeout(1500)` negatives ("pressed while locked/being copied does nothing"): fine but fixed sleeps. 12305 `mt(...)!== m0` relies on mtime moving in 50 ms (ext4 ok, coarse FS would make the "only the missing file was sent" check pass vacuously for box.glb/layout.json; the `refused !== 2` count is the real check).
- 12076-12103 first examples step: `ep` leaks if an assertion throws (no finally, unlike the relay steps that have finally).
- 11999-12000 all screens steps after step 1 `if (!sp) return;` print ok when the first step's load failed (error is in step 1).
Read: smoke.mjs 12351-12750
- 12571 trackers: `if (!HOST.collab.trkIn) { log 'skipped'; return o; }` makes the step green when the hook is renamed/removed (the message goes to console.log through `said`, not to errors).
- 12558-12559 (trackers step 2) uses box001's `rec.trk` set only by step 1 at 12518 (`E.itemAct('trk', B, 'box001')`), and 12541/12554 need trs001/tre001 from step 1: a failure in step 1 turns into a TypeError in step 2 (cascade; --only on step 2 throws).
- 12611 `kp.close()` only in the last trackers step: a throw in step 4 or in an earlier one that never reaches it leaks the page (steps 1-3 have no early close).
- 12477 `distanceTo(V(9,9,9)) > 1` loose ("the pose the shell keeps").
- 12602 loop waits 20 s for the rig scene silently; failure surfaces only as the later `!row || !why`.
Read: smoke.mjs 12751-13150
- Puppet steps chain on pup001's state: 12798 (`['o.pup001'].puppet.cal` needs the lined-up record step 1 leaves at 12750), 12819-12820 (page B is given A's record), 12876 (`pupby` expects rig 'any', not on, no cal, i.e. worn by step 1/2 leftovers). One failure in step 1 turns into reds in steps 2, 3 and 5. Step 3 also runs `await open()` (12816, a second 120 s scene load) outside any step, so it costs even when only step 1 is selected via --only.
- Guard flags are more than the 12 `ready` ones: `live` (13060, 13083, 13100, 13145 ...) and `if (!sp) return` (screens) return silently (printed ok) when their opening step was skipped; `opened` in the xp block (12956, 12968, 12996) instead pushes an error, so the same pattern is inconsistent: a --only run of an xp later step fails, a --only run of a streams/loops/trails/xp-interaction step passes vacuously.
- 12829 "two pages solve the same bones": both pages run the same ik.js with the same record on the same machine; agreement within 1 deg/1 mm can only fail on state differences, not on solver errors (fine as a determinism check, but it is not independent evidence).
- 13016 xp settle requires `now.tbbar1` to exist; if the id is renamed in the generator the step reports "did not settle within 48 s" after 60 x 0.8 s (a slow failure message for a rename).
- 12848 take sample count `n !== 91` couples to frame loop semantics (0..90 plus the countdown frame).
Read: smoke.mjs 13151-13530
- 13354 and 13370 (guide mirror): two fixed `wait(2000)` then asserts hips moved 0.5 m / hands within 0.15 m: under SwiftShader (about 1 fps) 2 s is a couple of frames; it passes only if the mirror eases within that many frames (flake source, step depends on timing not state).
- 13356-13372: `B = a.bones || {}`; if the first branch fails (`!a.on`) B is {} and 13372 `B.hips[2]` throws a TypeError whenever `b.on && b.bones`; the step then ends in the catch and the `out` messages collected so far are lost (13382 never runs).
- 13339 `for (const id of ['try001'])` one-element loop (header says "the two robots to try"; mir008 handled apart at 13340).
- 13203 `window.__xp.at(...) || [...]`: relies on at() returning 0 so the array is the value (works, obscure).
- 13196-13206 xp visitor step reuses page `xb` (navigates it away from the shared-room pair): fine as last step; `xa/xb` opened at 13042 even when only the first xp step is selected.
- 13297 tour game screen: `gs2.shows` read unguarded (null gs2 = TypeError, still red).
- 13410 anchored placement: identical pretend-headset run for each of the ~20 stories (confirms earlier finding 9); grip kind is a hand list `['flock','robots','tutorial']` that must be kept in step with stories by hand (the pass story's life-size grip, AGENTS.md, is not in it).
Read: smoke.mjs 13531-13900
- 13876 and 13886 comments say "all sixteen" stories; STORY_KEYS is twenty (stale comment, and the `seen.length < 12` captions floor at 13837 is a loose lower bound for a 200 s span).
- 13880 and 13895: the `'stories/' + k + '.js'` branch of the fetch is dead for every story (all are packages since v187; only design/studio use it); a 404 body fails `.includes` and reports the key as "missing" (right result, wrong reason).
- 13873 `setLang("de", false)` is called inside the assertion condition (side effect in an `&&` chain: works, but a failure of an earlier operand skips the restore at 13874 only because 13874 repeats it).
- 13835 subtitles loop: 199 iterations of seek + tick + 1-2 evaluates: a quarter-thousand round trips for a floor of 12 captions.
- 13802 the three labels/cards steps each run labelModes + freeMoving: the grip logic of freeMoving's `life` branch is keyed on `key === 'flock'` by hand.
Read: smoke.mjs 13901-14265
- 14122 `.catch(() => {})` on waitForFunction(!HOST.busy, 60 s): a swallowed timeout costs 60 s and the failure shows later as "design button: opened false".
- 14239-14255 packages order: expected values come from the repository's packages/order.json and index.json on disk, not from what the served base URL gives; against another host the step compares different trees.
- 14047/14088 later headset steps re-open qubits when a previous step left a different state (good), but 14054-14076 double press windows (0.4 s) are real time: 500 ms sleeps between presses; slow frames could stretch `seq`'s 4 ticks past 0.4 s if the shell measures with performance.now().
- 13389-13407 Repeat and 13410 anchored loops are not under `runs()` / `!ONLY`; the settings group 13516-14136 is under `if (!ONLY)`: its nine steps (labels, subtitles, panels, fps, keypad, design button) cannot be picked with --only at all (not in the AGENTS.md block list either).

# FINAL
Read: smoke.mjs 9511-10510, 10511-11010, 11011-11510, 11511-11930, 11931-12350, 12351-12750, 12751-13150, 13151-13530, 13531-13900, 13901-14265 (all of 9511-14265, every line).
(see the per-range notes above; the ranked list is the handback message)
Read: smoke.mjs 11011-11510 (re-appended; the first append hung on a stray stdin cat and was stopped)
- Dead terms: 11131, 11346, 11407 (`&& false`); 11428 `img` unused; 11375 bare `PAINT.fake;`; 11202 `res` unused.
- Paint steps 11232, 11255 cleanup, 11284, 11329, 11384, 11433 chain on `pid` from 11158.
- 11161 400 ms sleep, 11185 150 ms; 11183 loose bound.

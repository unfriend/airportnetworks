Read: collab.mjs 1900-2700
- 2238-2239: askRound auto-close check has upper bound `after < 12` on wall clock (frames 7500 + until 4000) and requires a4 (still open after 7.5 s): fails on a slow machine, not a bug.
- 2267/2280/2286: lobby counts l6===1, l8===2, l9===2 depend on stubLobby counter accumulating across the three checks (leftovers; one early miss cascades).
- 2464-2465 (narrationRound): wroteAll filters keys by h1 matching /look|voice|narr/; h1 never writes `look` by design and room keys are named st.*/look, so check is nearly vacuous.
- 2674 shipsRound: `held` (the bolt-time bound the comment 2669 cares about) is only printed in JSON, never asserted.
- 2471-2481 welcome negative checks (!w3.shown after 3 s window, !w5/ w0.done 3.5 s) are wall-clock floors; pass if the page is too slow to ever show.
Read: collab.mjs 2700-3500
- 2753 shipsRound: `hooks.every(n => n === 0)`: effects() (2557) only wraps h.effect when the hook and its effect exist; if a story has no `effect` hook it returns 0 for ever, so the "no effect reached the hook" half can never fail.
- 3118 menusRound hover check: only upper bounds (`h1.n - h0.n <= floor(hs/4)+1+allow`, `short.length <= allow`, `paired`); with no picture made at all hgaps is empty, short empty, paired true (every on []) -> passes when the machine is too slow to send anything. Only `hov.length >= 3` (A's own hover) ties it to the run. Same shape at 3080 for gaps (needs pics>=2, so safe there).
- 3048 `!cm || !cm.drawn`: C never ran frames after the drawn step except in that one runUntil; passes if C simply has no copy for any reason.
- 2905 walkRound: title/comment say the row is "greyed" but the check asserts `row8 === 'none'` (menuFind returns nothing); a greyed-but-present row would fail, an absent row passes; row0 'on' vs 'greyed' branch (2831/2902) is dead for the greyed result.
- 2714: `Math.abs((kb.left-ka.left) - 2300) < 1200` wall-clock window on the ships landing (1.5 s + 0.8 s of frames), slow machine fails.
- 2267/2280/2286: also depends on earlier leftover counters (see previous note).
- 3340 behaveRound finally: fs.rmSync of its tmp (outside tree; the repo rule about rm is for agent shell, fine).
- 3436 `truthAt` closes over F declared on 3438 (let): fine at call time.
Read: collab.mjs 3500-3950 (read in a 450-line piece: the 800-line read exceeded the tool limit)
- 3939 outputRound: title says "no target address in any answer" but only checks `!got.some(g => !g.m)` (undecodable UDP); the address check is the ping one at 3763 (`!J(ping).includes(String(lport))`, which can also false-fail if the random port number happens to occur as a substring of another number in the ping).
- 3937 `tk.length >= 60` in 2.5 s at a 60 Hz fake: lower bound only (no upper), a floor on wall clock; 3922 `heads.length >= 6` in 3 s of frames likewise.
- 3871 (outputRound) inPlain re-enters the plain cube on the page to prove the cube was really walked into: good guard, so 3873's "sends nothing" is not vacuous. trackersRound 3664 `moved > 0.05` plays the same role for the walking performer.
- 3521 `(await key(rc)).m` throws TypeError (round aborts) if the trk key is absent instead of failing the check.
- Order dependence: trackersRound is one chain (dialog -> by hand -> names -> Index -> held checks -> studio -> puppet -> walk -> take); every later check needs the earlier lining up. Fixed sleeps: 3518-3523 (200/300/400), 3618 1000, 3636 1200 after F.off (a wait for the relay to stop sending, not polled), 3692 700 (animation step measured over wall time, `step > 1` degree).
Read: collab.mjs 3950-4430
- 4202-4208 netRound "old drawing kept while the new one is built": `kept` is only set if a poll (<= 400 x 20 ms plus the evaluate time) happens to see the transient state `job() && lim.grp === 0`; if the rebuild finishes before the first poll (fast machine) kept stays null and the check fails; a race against speed in the other direction from most (a fast machine fails it).
- 4216 and 4260 netRound: two "no echo" checks (seq delta <= 1 over 2.5 s, <= 2 over 3 s) on different states, the same assertion; upper-bounds only, they pass if nothing at all is happening (so they rely on the earlier checks having proved the traffic).
- 4226/4238/4254/4278: hard-coded data numbers (141296 links, 422 proteins, 1864 links): the round fails on any change to the cell data, not on a sync bug.
- 4314-4334: the --no-nets relay R2 shares `tmp` with R, in which 4308 already deleted `.nets/<id>`; the "cannot give" result would be reached by absence alone, but the check also demands the words "this relay keeps no shared networks", which is what ties it to --no-nets: fine. Depends on the earlier remove step's leftovers only for `id`.
- 4007/4010 scenesRound: `names.find(n => n !== 'test')` undefined if the scenes folder holds only `test` ('scene:undefined' then); depends on tools/studio/test/scenes containing a second scene (it has puppet).
- 4014 sleep(400) after Studio here is not waited on by anything (the next call is synchronous), pure delay. 4040 roomInfo2 is a const declared after scenesRound that uses it: fine at runtime.
- arrRound 4047-4059: when the story has no `arrange` the round runs against a stand-in written here and the title says so (`how`): in that case it tests the shell's HOST.arrange side only; with 'real' it wraps the real one. Titles of both outcomes are the same check.
Read: collab.mjs 4430-4690
- 4544 allRound: the result of `stepUntil(... mine()===AID && XR.stories ...)` is discarded (no `const`), so a headset that never gets to the arc is only caught later by c1.mine at 4559; harmless but the wait's outcome is not asserted where it is made.
- 4556-4560 arc check carries `c1.zone !== AID` (never walked into): good negative, but `zone` is read after 800 frames of waiting only; ok.
- 4437-4472 codeRound: `join0 === null` and `same === null` both test "menuFind returns nothing" for a greyed Join (no way to tell a greyed row from an absent one, same ambiguity as walkRound 2905).
- 4618 `held > 0` counts a poll (30 ms) that saw `h === 1` on page A; with a slow page A it may see none although the writes happened (A polls in its own page timers): a floor on wall clock, mild.
- Fixed sleeps in allRound so far: 4574 1500, 4656 300, 4679 800 (each followed by a poll or frames, so the sleep itself is only delay).
Read: collab.mjs 4689-4950
- 4892-4917 smoothRound grip-after-let-go: rgP starts at 4892 (before the second drive) and waits for `BUF.get(kPl).s.length > 3 && !last.h`; the buffer left by the FIRST drive (3 s turn, last sample a let-go) can already satisfy it, so the grip may fire before the second drive sends anything. The check (4916) asserts had/dropped/moved/back only, never that `rg.gripAt >= sr.end`; the printed "gripped N ms after they let go" can be negative. Plausible: the case "right after someone else let go" can go untested while the check is green. The wait's 8 s exit is not asserted either.
- 4880 `drawnPast(...)` result discarded (also 4929, 4940).
- 4948-4950 `between >= 3` frames inside a 1.2 s window: wall-clock floor; slow machine fails.
- 4805 negative check after 3.5 s of frames (`!kinds.length`): passes if the arc would come back later than that.
- Duplicates seen: "open the menu, menuFind(id), r.fn(), 2-3 steps, close" at 1931 (menu), 2141 (askRound menu), 2398 (menuTap), 2986 (press), 4448 (tap); `lineUpH` identical at 2378 and 2548; `sopen` identical at 3201/3439/3734 apart from the MIDI stub; "dialog(true); sleep; click data-sh; read text" at 2047, 2178, 2406, 3503.
- Earlier findings, checked against the text: line numbers for the ports (3215, 3469, 3759, 3966, 4062, 4144, 4314) and opener copies (3202, 3440, 3735, 3969, 4065, 4148) are right. WRONG: "trackers 3562 (a 3 s note)" is listed among wall-clock bounds feeding checks, but 3562 is only a console.log (the trace is printed if lining up took more than 3 s); nothing asserts on it. The menus bounds 3079/3117/3145 are right (they are at 3080, 3116-3118, 3146).
- "no catch that swallows a failure": in 1900-4950 the catches are 2138 (loading story, comment says so), 3338/3698/3952 context closes in finally, 3954 socket close, 4095 (lay = null, then the check fails): none hides a failure.
# FINAL
Read: collab.mjs 1900-2699, 2700-3499, 3500-3949, 3950-4429, 4430-4688, 4689-4950 (every line of 1900-4950).
Ranked, adding to / correcting findings-28:
1. 4892-4917 (smoothRound, grip right after let-go): wait for "their let-go" can be satisfied by the first drive's leftover buffer; check never asserts the grip came after sr.end. Plausible green-with-no-test.
2. 3118 (menusRound hover picture rate): only upper bounds; with no picture sent at all it passes (made 0, hgaps empty, short empty, paired true). Only hov.length >= 3 ties it to the run.
3. 2753 (shipsRound): `hooks.every(n => n === 0)` cannot fail when the story has no effect hook (effects() 2557 wraps only an existing h.effect).
4. 2464-2465 (narrationRound): "no override written" filters h1's keys by /look|voice|narr/; h1 never writes `look` by design: near vacuous.
5. 2905, 4451, 4463: "greyed" Join/row asserted as menuFind === null/'none', which is also what an absent row gives; 2905's title says "greyed" and the greyed branch of row8 is never expected.
6. 2674: `held` (the 2.75 s bolt bound, the point of the 2669 comment) is only printed, never asserted.
7. 4202-4208 (netRound): "old drawing kept" needs a poll to catch a transient state; a fast machine that rebuilds before the first poll fails it (race the other way).
8. 3939: title claims "no target address in any answer", checks only that no UDP datagram failed to decode; 3763's `!J(ping).includes(String(lport))` can false-fail on a coincidental substring.
9. 3048: `!cm || !cm.drawn` passes if C simply has no copy for any reason.
10. Correction to findings-28: 3562 is a console.log, not a wall-clock check.
Leftovers / order: 2267, 2280, 2286 (lobby counter l6===1, l8===2, l9===2 accumulate from one stub); 4007-4027 (scenesRound needs a second scene in tools/studio/test/scenes, then counts of 3 circles and two 'Studio: test' rows depend on the earlier steps); trackersRound is one chain (3500-3695); 4314-4334 reuses the relay's scenes dir after 4308 deleted the net (the --no-nets wording still ties it); allRound 4688-4837 steps depend on the headset still being at AID after each earlier step.
Wall-clock: 2238-2239 (after < 12, still open at 7.5 s), 2714 (2300 +- 1200 ms), 2471-2515 welcome windows (3-4 s, positive and negative), 3118/3080/3146 rates, 3922 (>= 6 heads in 3 s), 3937 (>= 60 in 2.5 s), 4634 (mid >= 2), 4701 (APP.t 29-45), 4948-4950 (>= 3 frames in 1.2 s). Fixed sleeps followed by assertions with no poll: 3518-3523, 3618, 3636, 3692, 4014, 4728 (sleep 500 then read a value), 4751/4776.
Duplicates: menu-press helper x5 (1931, 2141, 2398, 2986, 4448); lineUpH 2378 == 2548; sopen 3201 == 3439 == 3734 (MIDI stub aside); two no-echo checks 4216 and 4260.
Nothing in this range swallows a failure with a catch.

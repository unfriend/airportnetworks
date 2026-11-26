# Run plan (owner, 26 Nov 2026: "do everything you say from 1 to 7 if possible but remove the whole design room for now and skip the steps that would only touch that")
One builder at a time in the checkout (Opus), one Sonnet review each, one fix round, push to dev. Main conversation (Fable) does step 2 itself.
Builders never edit CLAUDE.md / AGENTS.md (main does); they report lines that need changing.
Skipped because design-room only: table.js AWAY bug, props.json text fixes, props.md generator, cdk5 props.json.
Design room: parked = out of the app, sources kept (tools/design/), nothing deleted; stories/design.js left for the owner.

| # | Release | What | State |
|---|---|---|---|
| A | v217 | park the design room | DONE pushed (5a59fe9, 04811bf) |
| B | v218 | step 0 (perf.mjs) + step 1 quick fixes | DONE pushed (34cb589, 11466cf, ac4e514); review clean. Carry to D: iconIdle not kicked when the packages index or a package file arrives later (shared.js:3941-3953) |
| 2 | docs | CLAUDE.md + AGENTS.md slimmed | DONE pushed (66bd2ee) |
| C | v219 | delivery + start page | PUSHED unreviewed-at-push (f79e1dd, ee25e69, f55f2b5) because tokens ran out and the machine may be reclaimed. Review came after: fix round DONE as v220 (list below; committed on dev, not pushed) |
| D | v221 (v220 became C's fix round; the later rows move up one) | step 4a shared.js room costs (mirror/locFlush, stationsChanged, viewSync, drawPeople, presence, panelSig, subtitles, trkKey) + bodies culling | |
| E | v221 | step 4b studio (roomState memo, paneSig, cube panel repaint, matrix walks, LOOKS.fill, ghosts, unused-feature steps) | |
| F | v222 | step 4c engine + stories (pick on ray move, compileLate helper, idle path on a page, placeLabels, ovary stain, nmd heart/tower, airports slider, per-story small ones) | |
| G | docs | step 5a generated: --list in tests -> testing.md, TOC script for shared-rooms/shell, release.mjs writes state lines + meta | |
| H | docs | step 5b archive: HANDOVER 287->55 KB, plans to docs/history/plans (stubs left), setup, data, README.md | PART DONE pushed de5f484; still: package SPECs, studio SPEC vs studio.md, relay README, README.txt, code headers pointing at stubs |
| I | v223 | step 6a load: ppicell models lazy, exposome data lazy, lbi buffers, shared sets scaffolding, precomputed layouts, airports binary data | |
| J | v224 | step 6b: studio.js split + comment strip, shell modules on demand, headset canvases only in XR, examples KTX2 | |
| K | tests | step 7: tools/lib kit, --list/--only ids, node-only greps, real test bugs, sleeps, ports, split smoke by block | |

## Owner's decisions since the plan
- 26 Nov: "the start page should load nothing in the background, just have the cards there" -> into builder C (v219): with no story in the address the Stories screen shows with no story started, built or fetched behind it (no airports main.js, no narration, no globe); a story loads only when its card is picked. Check the headset Stories screen outside a room too, `HOST.cur` being null there (Back to the story, the menu's Story tab, recenter, subtitles, shared.js attachCheck), restoring a kept place, and Take all stories.
- Design room: parked (sources kept, nothing deleted); stories/design.js left for the owner.
- Open gap noted by v217's review: no shared-room test of Add/lock/Arrange for a page that is not a story (the studio) since the design round went -> step 7.

## Re-measurement with finish() (perf2/MEASURED2.md), for ranking F and I
Background-build hypothesis confirmed: ovary 50% 2,525 KB/frame -> 37; nmd 25% 735 -> 39; micro 50% 2.1 ms -> 0.6. So ovary stain / nmd heart are BUILD costs (still hitch while building in a headset; move to load step I, lower priority).
Worst lasting points now: exposome 25% (heap 1342 KB/frame, js 3.9 ms mean, 73.4 ms worst; first measured), endo 25% (438 KB, 689k tris), topo 75% (js 1.3 mean, 49.7 worst), tutorial 25% (worst 39.8 ms: seek catch-up), soil 75% (158 KB, 33.5 worst), cellstress 75% (37 worst), nmd 50% worst 28.2 (tower group change), pass 50% worst 26.6 (globe first shown).
Draws: ppicell 25% 108, cdk5 explore 80, lbi 25% 66. Tris: endo 25% 689k, micro 50% 552k, ppicell 25% 547k, pet 25% 424k.
Program links mid-story: 12 of 84 points, mostly SpriteMaterial in labelSprite and MeshBasicMaterial -> the compile-late helper should cover label sprites.

## v219 review findings to fix as v220: DONE in v220 (9 partly: the guide, places, standby and areas rounds run after the corking, all good; the whole suite not yet)
1. DONE v220. index.html ~6036-6044 HOST.offline: the 30 s fallback posts {type:'mains'} on the start page -> sw takeMains fetches every main.js + minis (~17 MB). Against the owner's "load nothing". Drop the 30 s fallback; wait for the first story pick/built. Smoke step only watches 4 s and cannot see worker traffic: make it check the PKG cache after 35 s or expose a counter.
2. DONE v220. Offline guarantee weaker: install no longer takes mains; message goes to r.active||controller once (an old v218 worker has no handler -> lost). Send again when the new worker activates; decide with the owner whether an installed copy should take all mains after the first story (it did at install before).
3. DONE v220. Deploy race sticks: sw.js ~215-228 + HOST.loadSrc ~2925-2951: an old body under ?v=NEW is kept for ever and HOST.fp is taken from the index, so HOST.live never notices. Guard (a): in the worker on a miss for main.js hash the body and compare with files['main.js'] from the cached index before pkgPut; on mismatch return it but do not keep. Or (b) page hashes in idle time and reloads fresh.
4. DONE v220. HOST.bare ~5800-5836 + HOST.start ~3591-3596: first story's load fails inside a headset -> stuck on the loading card, session live, landingVR true. On a failed start with !HOST.cur && HOST.session: end the session, clear landingVR/mode/inputs. Minor: #top click sets landingVR even when enter() bailed.
5. DONE v220. sw.js shellTake: with no ETag it sends If-Modified-Since; a redeploy of an older file answers 304 and keeps the newer copy. Use ETag only; date-only files get a full fetch.
6. DONE v220. tools/update.mjs ~150-185: offline checks now depend on the 5 s mains timer (and maybe the old worker); wait for the mains explicitly; fix its stale comment.
7. DONE v220. relay set log: lines up to 5 s late and out of order with immediate lines; who-set-which-key lost; key set capped at 200 with no "+more". Flush pending set lines before any other log line of that room, add a "+n more" mark.
8. DONE v220. relay corking inflates socket.writableLength (corked bytes count): a large set makes every member look backed up for 20 ms -> presence and TRK/OSC/SND/TALK backlog skips. Track queued-before-cork separately or measure backlog excluding corked bytes. Check presence is full-pose (skip-safe).
9. PARTLY v220 (four rounds run, all good). collab suite not run after the 20 ms corking: stragglers after replies may break `q.length = 0` patterns (the relay test needed a 60 ms wait).
Fine per review: start page's HOST.cur guards, loadSrc lifecycle, brotli (async, shared job), --keep cache, nets async, cork ordering, flush timer.

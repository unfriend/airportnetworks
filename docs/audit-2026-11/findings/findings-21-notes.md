# Chunk 21: design room sources, shared engine (tools/engine), lowpoly, mol, packages tools
Read: tools/design/build.mjs (44)
Read: tools/design/engine/e1_head.js (40)
Read: tools/design/engine/e2_scene.js (66)
Read: tools/design/engine/e3_story.js (99)
Read: tools/engine/parts.mjs (60)
Read: tools/engine/all.mjs (29)
Read: tools/engine/e1_head.js (20)
- diff -rq: template/hello/robots/design engine dirs are NOT copies of tools/engine: they are each story's own e1..e7 files with //#use lines (template 25.7 KB, hello 34 KB, robots 78 KB, design 53 KB). tools/engine holds shared parts only.
- parts.mjs report (line 36-38) scans only tools/<k>/engine; stories moved to packages/<k>/src/engine at v185-187 -> report says parts unused that are used (stale report). 
- design e3_story.js:56-64 storyCam returns new arrays (slice / literal) each call.
- design e3 labelSet:76-77 joins txt each call (2 string joins); check who calls per frame.
Read: tools/design/engine/e4_explore.js (223)
Read: tools/design/engine/e5_xr.js (147)
- design e4:17-21 exploreStep (per frame) builds a fresh object via exploreTargets every frame; e4:27 orbitStep allocates new array (map) per frame while flying.
- design e4:89 collabApply JSON.stringify twice per card key per apply (100+ keys) - only on apply, fine.
- design e4:170-175 miniAt on every pointermove (no buttons): GL.world.updateMatrixWorld(true) + raycast all pickables per mouse move event (could be once a frame).
- design e5:93-135 xrPoint (per controller per frame, from xrUpdate): XR.panelMeshes.filter() new array l.101; hit objects + point.clone() l.114/117 per frame; table raycast vs all pickables each frame.
Read: tools/design/engine/e6_panels.js (116)
Read: tools/design/engine/e7_app.js (179)
- design e7 frame(): per frame allocs: l.71 Object.assign({}, S, {table_floor:0}) in passthrough XR; l.79-80 new closure + LBL.exploreAll() concat (e7:97) per desktop frame; storyCam arrays l.59; exploreStep object; window.__frames l.82 (test hook, cheap).
- design e6:6-9 sigMainX joins 9 fields to a string; called from panelTick (check frequency in shared panelTick).
- design e7 builtStep l.86-92: renderPanes() (full innerHTML of both panes, ~100+ chips) up to 4x/s while the table fills -> DOM churn during load.
Read: tools/design/props.json (101)   (stale: sharedParts names packages/lbi/src/kit.js - kit is tools/engine/kit.js; check)
Read: tools/design/sets/table.js (442)
- BUG/PERF (confirmed by count): table.js:179 AWAY = Float32Array(48), homeStep l.276 returns when order.length > 48. Loading every minis.js + lowpoly.js in node: 57 models, 53 with a card -> order.length 53 > 48, so the "every miniature at home in two draws" merge (v136, comment l.270-272) never happens now: ~53 solid + see-through meshes drawn separately (~60-100 draws) AND every frame homeStep evaluates built() = order.filter(...) (l.268) before the length test -> 53-element array alloc per frame forever. Fix: size AWAY from order.length (uniform float uAway[N] via define), test length first.
- table.js:430 pickables() = 2 maps + filter, 3 arrays per call; called per controller per frame (design e5 xrPoint l.113) and per mousemove (miniAt). Cache once built.
- table.js:434 moved() order.filter + recOf (poseRec allocs 8-array per carried) called from sigMainX every panel signature + renderPanes.
- table.js:324 awayStep forEach closure over 53 per frame; glide l.376 per frame (fine, no alloc).
Read: tools/engine/e2_scene.js (454)
- e2:223-234 updateSets~3 (called by frame() each frame) allocates `hid` array every frame; buildTurn l.58 jobs.filter() another array every frame, forever (after everything is built it still runs with empty arrays). primeCheck(s) called for every hidden set every frame (cheap once primed: flag check).
- e2:130 keepCamera (per frame, per set with keepOut) allocates [x,y,z] array per call.
- e2:421 molPx allocates new THREE.Vector2 once per frame (from LOD.update). e2:375-381 LOD.update forEach closure per model per frame.
- e2:340-341 molMaterial transparent/depthWrite getters: fine (no recompiles).
- e2:25-33 1800-star Points built in every story (one draw); design passes its own.
Read: tools/engine/e3_story.js (536)
- e3:54-58 storyState (frame() each story frame): new object with every DEF param; evalTrack l.40-52 linear scan of each param's keys from 0 each frame (O(params x keys)); plus LOG.has/LIN.has Set lookups per param. Cache per-param last index (t moves forward) and reuse one S object.
- e3:113-125 storyCam / l.378 storyView: new 10-12 element array + `end` closure + spreads per frame.
- e3:172-210 placeLabels (desktop frame, every frame): 2x $() querySelector + 2 getBoundingClientRect per frame AFTER updateStoryDOM/updateTimeline wrote styles (track width, opacity/visibility) -> forced synchronous layout most frames; writes style.transform for every visible label every frame even if x,y unchanged (template string + toFixed x2 per label); `vis` arrays per frame; _placed.find closure per pass.
- e3:284-300 updateTimeline (frame, story mode): p has 0.01% resolution -> changes nearly every frame for a 5-10 min story (T_END 300-660 s: 0.03-0.07 s per step); each change: 5 querySelector, textContent of clock, querySelectorAll('#track .name') + classList.toggle on every chapter name. Clock text changes once a second, chapter once a minute: split them.
- e3:398-408 labelText: performance.now per set label per frame, closure call max 10/s: fine.
- Duplicated variants (storyCam/~2, placeLabels/~2, updateStoryDOM/~2, buildCamera/~3, buildSetLabels/~2, setLabelAlpha/~2, pct/~2) = several near-identical copies kept as "~N" parts; each story ships one, but the source carries both.
Read: tools/engine/e4_explore.js (284)
- e4:33-40 exploreStep (frame(), explore mode, every frame): exploreTargets(now) builds an object of all params per frame (story code), plus STEP/LOG Set lookups per param. orbitStep l.60 f.map alloc per frame while flying.
- e4:117-144 bindCanvas pointermove (each mouse event, not frame-capped; 125-1000 Hz mice): pickAt raycast (story pickWith) + tip.innerHTML rewrite + transform string every event even when the pick is unchanged. Coalesce to once a frame; rewrite innerHTML only when text changes.
- e4:264-268 collabView builds a 6-array each call (if shared.js polls it per frame: check shell).
- Parts duplicated across areas: `cap` is a part in e3 and e4 (e3:88, e4:201); afterUpdate/~2 identical text (e4:31,245); ctlValue/~2 identical (e4:16,278).
Read: tools/engine/e5_xr.js (1087)
XR frame path (frame -> xrBegin -> xrPoint x2 -> xrPointed; ... xrUpdate -> placeLabelXR per label, xrTip, panelTick per panel):
- e5:857 xrPoint (each controller, each XR frame): XR.panelMeshes.filter() new array; hit object literal; HOST.collab.ray call; xrSceneHit -> xrBallHit l.902-913 -> pickRay -> story pickWith raycast EVERY frame per controller in explore mode + _xp.clone() per frame; l.873 hit.P.at() per frame + string concat for hk.
- e5:563-569 xrBegin: for every panel x every controller P.at() again (second hit test of the same point per frame; xrPoint already computed hr at l.873) -> store hr on c.
- e5:602-606 xrUpdate: per label per frame placeLabelXR -> labelPos -> anchorOf (anchors as functions return new arrays) + storyT(APP.t) recomputed per story label (l.603) + setLabelAlpha; fine per label but ×(labels: tens to 100+).
- e5:835 xrTip: JSON.stringify(h.pk) + concat per frame while a controller points at a pick; l.841 new [x,y,z] array per frame.
- e5:1045-1087 xrClear (xrCap~2 <- xrPlace, every XR frame in stories with keepClear): traverseVisible over every object of keepClear sets with 3 new closures per frame; hierarchical bound test is good. l.1073: any unsampled visible object sets _xdone=false each frame -> xrPrep l.1033 re-traverses all sets' groups to find the next unsampled object (O(objects) traversal per job start).
- e5:132-145 xrIdle: away -> only audioSync + render (good); behind the cards -> panelTick for every panel + landing cards. Desktop has NO idle path: see e7 frame.
- e5:88,90 xrRecenter allocs new Euler/Vector3 (rare, fine).
Read: tools/engine/e6_panels.js (706)
- e6:141-158 panelTick (xrUpdate, every XR frame, for every panel incl. the header): builds P.sig() string + slices/concats BEFORE the 60 ms throttle test (l.144) -> move the `now - P.t < 60` test first. sigMain l.339-353 does 2 querySelector (#titleArc, #titleDot) + loops per frame. Redraw/upload logic itself is good (sig change only, row patches via texSubImage2D, cards 2 first draws a frame).
- e6:228-265 + e5:801-828 xrSetup -> xrLandingSetup: every story start (desktop and phones too, no XR check) makes the header (1400x236) + one 640x820 canvas + CanvasTexture + mesh per card (main set ~14 cards ~ 2.1 MB each of 2D backing store once getContext is called in makePanel l.113) + main 1024x1200 (4.9 MB) + foot -> ~35-40 MB canvases allocated per story load on machines that never enter a headset. Make panels lazily on first xrStart/xrAdopt.
- e6:456-470 drawStoryEl 'bars' branch draws 2D bars from HTML (style parsing) - fine.
- e6:547-549 sigFoot changes every second (Math.floor(APP.t)) -> foot panel full redraw + 1024x176 upload once a second while playing: acceptable.
- Variants kept as ~2 parts: stats/stats~2 (only kw differs; stats~2 with default kw=220 subsumes stats), sigFoot/~2, drawScenesPane/~2.
Read: tools/engine/e7_app.js (800)
- e7:293-341 frame~2 / 351-408 frame: NO paused/idle path on a page. A paused story (or explore with turn off, nothing held, no flight) still does storyState, storyCam, updateSets (every visible set's update), full renderer.render, updateMatrixWorld(true) and placeLabels with 2 getBoundingClientRect, every display frame (60-120 Hz) forever. Sets' update depends only on params and time (AGENTS rule), and story mode sets uTime = ts (constant when paused) -> a paused story's frame is identical: skip render+labels when paused and nothing changed (camera, hover, resize, room apply) - big battery/heat gain on laptops and phones.
- e7:334 frame~2: `if (navigator.xr) xrPrep(...)` -> desktop Chrome/Edge expose navigator.xr, so the keep-clear sampler spends up to 1 ms/frame on desktops that will never enter a headset, until every keepClear object is sampled (and again whenever an unsampled object appears). Gate on isSessionSupported('immersive-vr') result or XR.on.
- e7:337-338: new closure per frame for placeLabels; LBL.exploreAll() concat per frame.
- e7:331 NEXT.splice(0) array per frame only when non-empty: fine.
- e7:410-800 ARR (arrangements editor runtime, ~390 lines) pasted into every story and the design room though used only with developer mode's Copy to relay / &arr=: size candidate for a shell-side module.
- e7:224-242 init/load: steps per set + warm (renderer.compile per material, 50 ms slices) + xrSetup/xrWarm always (even without navigator.xr: panels and controllers built anyway, e5:801-818 return only after creating them).
Read: tools/engine/kit.js (248)  - fine; newSet.setAlpha loops fades per set per frame (cheap); upload() diff-sends buffers (good).
Read: tools/engine/panelsame.mjs (81)
Read: tools/engine/same.mjs (111)
Read: tools/engine/xrsame.mjs (114)
- same/panelsame/xrsame: identical `serve`, TYPES, chromium launch, open/waitForFunction boilerplate x3 (~20 lines each); default KEYS (l.10/20/15) stale: no cdk5, exposome, ppicell, cellstress, hello -> 5 of 20 engine users never compared by default. Share one helper; take keys from tools/stories.mjs.
MEASURED (node one-liner over tools/engine parts x every //#use in packages/*/src/engine + design + template):
- shared parts source 209 KB; each built story pastes 119-173 KB of them (lbi 139, flock 131, robots 125, tutorial 131, design 119, ppicell 173, exposome 171, most ~160 KB) -> ~3.1 MB of engine text across 21 built files; + kit.js 13 KB each.
- parts.mjs report (node tools/engine/parts.mjs) prints "174 parts no story uses" - wrong: true count 0 unused; only molInstanced (1.3 KB) has a single user (ppicell). Report scans tools/<k>/engine only (l.36-38).
- ARR part alone 24.8 KB (in all 20); keep-clear sampler (XR_NEAR.._xjob..xrClear) 11 KB in all though only endo/exposome/nmd call xrPrep; frame~2 used by endo/exposome/nmd.
Read: tools/lowpoly/build.mjs (83)
Read: tools/lowpoly/minis.mjs (111)
Read: tools/lowpoly/load.js (29)
Read: tools/lowpoly/harness-a.html (99)
Read: tools/lowpoly/harness-b.html (99)
- MEASURED: minis.mjs:18-23 assemble pastes the whole kit into every package's minis.js: kit-a 25 KB (5 users), kit-b 16 KB (16 users incl. lowpoly.js) -> ~385 KB of the 631 KB of minis files (20 packages + lowpoly.js) is duplicated kit text. The design room (HOST.lowpoly('*')) fetches and parses all 21 at its load; lobby icons fetch them per package. Ship kit-a.js/kit-b.js once (LOWPOLY_KITS global loaded by HOST.lowpoly before the first minis file) -> ~360 KB less to fetch/parse for the design room.
- harness-a.html / harness-b.html: two 99-line pages doing the same job with different query names (only= vs keys=, az in degrees vs radians, stats array vs object) -> one harness.html?kit=a|b.
Read: tools/lowpoly/kit-a.js (339)
Read: tools/lowpoly/kit-b.js (193)
Read: tools/lowpoly/shell.js (136)
- kit-a.js:221-229, kit-b.js:17-24: every miniature build makes fresh MeshStandardMaterials (one per kind used); the design room merges and disposes them (table.js:241) so fine there; station icons keep theirs (a few). Not worth changing.
- shell.js:92 comment "sixteen cards ... one in each story's colour" fixed list of 16 colours: cosmetic, fine.
Read: tools/mol/build.py (730)
- build.py:586-662 one .mol holds all three LODs of surface and cartoon (29 files, 8.4 MB in packages/cdk5/models + ppicell/models); the app fetches the whole file (e2 molLoad l.250) even for a crowd that uses LOD 2 only (molInstanced). molMesh (e2:361-384) builds all 3 levels into a THREE.LOD; primeCheck (e2:72-79) primes every mesh >3000 verts incl. hidden LOD 0 -> all levels go to the GPU. Plausible memory gain: prime only the level on show; optional per-LOD byte ranges (Range requests) for crowds. Low priority.
- build.py fine otherwise (cache outside repo, --check by hash).
Read: tools/mol/test/models.json (14)
Read: tools/mol/view.html (119)  - fine (reads engine parts live: no extra copy).
Read: tools/packages/check.mjs (295)
- check.mjs:219-225 fingerprint() copied from scan.mjs (comment says so); l.231-244 a 4th copy of the static server + TYPES (also same/panelsame/xrsame), l.258 the test localStorage defaults copied again. One tools/lib (serve, fingerprint, launch, test defaults) would remove ~80 duplicated lines and keep the test defaults rule in one place.
Read: tools/packages/move.mjs (208)
- move.mjs: the one-off migration tool (v185-187). STORY_LIST is empty since v187, so l.46-47 now refuses every key: 208 lines of dead code still named in AGENTS.md's layout ("tools/packages/move.mjs <key> moves a built story"). Retire (git history keeps it) and drop the AGENTS.md mention.
Read: tools/packages/publish.mjs (350)
- publish.mjs:187-198 a 5th copy of the static file server + TYPES; otherwise careful and fine (no force, no deletes).
Read: tools/packages/scan.mjs (135)
- scan.mjs:64-70 FIELDS/NEED/KEY/COL and fingerprint (l.25-31) duplicated in check.mjs:35-45,219-225 ("the same fields and rules"): one module both import. packages/index.json 27 KB (7 KB gz, 124 file fps): fine.

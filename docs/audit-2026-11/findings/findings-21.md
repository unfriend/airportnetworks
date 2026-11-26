# Chunk 21: design room sources, shared engine (tools/engine), lowpoly, mol, packages tools
Read: tools/design/build.mjs (44), engine/e1_head.js (40), e2_scene.js (66), e3_story.js (99), e4_explore.js (223), e5_xr.js (147), e6_panels.js (116), e7_app.js (179)
Read: tools/design/props.json (101), tools/design/sets/table.js (442)
Read: tools/engine/all.mjs (29), e1_head.js (20), e2_scene.js (454), e3_story.js (536), e4_explore.js (284), e5_xr.js (1087), e6_panels.js (706), e7_app.js (800), kit.js (248), panelsame.mjs (81), parts.mjs (60), same.mjs (111), xrsame.mjs (114)
Read: tools/lowpoly/build.mjs (83), harness-a.html (99), harness-b.html (99), kit-a.js (339), kit-b.js (193), load.js (29), minis.mjs (111), shell.js (136)
Read: tools/mol/build.py (730), tools/mol/test/models.json (14), tools/mol/view.html (119)
Read: tools/packages/check.mjs (295), move.mjs (208), publish.mjs (350), scan.mjs (135), template/build.mjs (48), template/engine/e1_head.js (19), template/engine/e2_scene.js (7)
(Working notes kept in findings-21-notes.md.)

Frame loop (tools/engine/e7_app.js `frame` 351-408 / `frame~2` 293-341, run by setAnimationLoop, every display frame):
xrBegin (XR: xrSettings, xrPoint per controller, panel hover) -> xrIdle -> clock, audioFollow, slideStep, sfxStep, audioSync
-> story: storyState + storyCam + applyCamera/keepCamera + updateStoryDOM + updateTimeline | explore: exploreStep + orbitStep
-> updateLight -> updateSets (set.update for shown sets; buildTurn + primeStep) -> arrPlace -> xrUpdate (labels, xrTip, panelTick
per panel) -> render -> [frame~2: xrPrep] -> page: updateMatrixWorld(true) + placeLabels.

## Findings
### Paused or idle page renders every frame anyway   [perf-frame]  gain: high  risk: medium  sure: confirmed
Where: tools/engine/e7_app.js:351-408 (frame), 293-341 (frame~2); same in tools/design/engine/e7_app.js:37-83
What: only a headset away from its station or behind the cards gets an idle path (e5_xr.js:132-145 xrIdle). On a page a paused story, explore mode with Turn off, or a story behind the page's Stories screen still runs storyState, storyCam, every visible set's update, a full render, updateMatrixWorld(true) and placeLabels (2 forced layouts) at 60-120 Hz. In story mode uTime = story time, and set updates depend only on params and time (AGENTS rule), so a paused frame is identical to the last.
Change: on a page, skip the frame (or everything after the clock) when not playing, no orbit flight/hold/sway, no input, resize, theme or room apply since the last drawn frame; mark "dirty" from those events. Live simulations (flock, robots, pass fish) opt out.

### placeLabels forces a layout every page frame and rewrites every label   [perf-frame]  gain: high  risk: low  sure: confirmed
Where: tools/engine/e3_story.js:172-210 (placeLabels; ~2 at 471-507), called from frame (e7:403-405); updateTimeline 284-300; updateStoryDOM 216-245
What: each frame: two querySelector + two getBoundingClientRect (#panel, #bar) read right after updateTimeline/updateStoryDOM wrote styles (#track .done width changes every 0.01 %, i.e. nearly every frame for 5-10 min stories; opacity/visibility), so layout is forced every frame; then style.transform is rewritten (template string, 2 toFixed) for every visible label even when x,y did not move; `vis` arrays and closures per frame. updateTimeline also does querySelectorAll('#track .name') + classList.toggle on every chapter name and rewrites #clock text whenever p changes.
Change: cache the panel/bar rects (update on resize/scroll/ResizeObserver); write transform only when the rounded x,y changed (keep L.x/L.y); in updateTimeline update the clock once a second and the chapter names only on chapter change.

### Design room: the "every miniature in two draws" merge silently stopped working   [bug/perf-frame]  gain: high  risk: low  sure: confirmed
Where: tools/design/sets/table.js:179 (AWAY = Float32Array(48), uniform uAway[48]), 276 (homeStep), 268 (built)
What: loading every packages/*/minis.js + lowpoly.js in node gives 57 models, 53 with a card -> order.length 53 > 48, so homeStep returns before merging forever: ~53 miniatures drawn as their own 1-2 meshes each (the v136 comment at 270-272 promises 2 draws), and every frame homeStep first evaluates built() = order.filter(...) (53-entry array) before the length test.
Change: size AWAY and the shader's array from order.length at layout (define MINI_N); test `order.length > AWAY.length` and HM.state first; cache built count.

### Every headset panel and card canvas is made on every story load, even on desktops   [perf-load]  gain: medium  risk: low  sure: confirmed (sizes plausible)
Where: tools/engine/e7_app.js:239 (init's last step: xrSetup, xrWarm); e5_xr.js:801-818; e6_panels.js:104-122 (makePanel calls getContext at once), 228-265
What: each story start builds main 1024x1200 (4.9 MB backing store), foot 1024x176, the Stories header 1400x236 and one 640x820 canvas + CanvasTexture + mesh per card (~2.1 MB each, ~14 main-set cards), two controllers, and compiles headset materials (xrWarm) - ~35-40 MB of canvases on phones and desktops that never enter a headset; xrSetup only checks navigator.xr after making them.
Change: make the landing cards (and optionally main/foot) lazily on first xrStart/xrAdopt; skip xrWarm unless isSessionSupported('immersive-vr') resolved true.

### Keep-clear sampler runs on desktop Chrome   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: tools/engine/e7_app.js:334 (frame~2: `if (navigator.xr) xrPrep(xr ? 2 : 1)`), e5_xr.js:1026-1040, 1073
What: desktop Chrome/Edge expose navigator.xr, so endo, exposome and nmd spend up to 1 ms a frame sampling keepClear sets on machines that will never enter a headset; xrClear (every XR frame) resets _xdone for any unsampled visible object and xrPrep then re-traverses every set's group to find the next one.
Change: gate on the isSessionSupported result (xrSetup already asks) or XR.on; keep a queue of unsampled objects instead of re-traversing.

### Per-frame allocations along the engine's frame path   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where (caller each frame -> allocation): frame -> storyState e3:54-58 (object with every DEF param; evalTrack 40-52 scans each param's keys from index 0) | exploreStep e4:33-40 -> story exploreTargets (object per frame) | storyCam e3:113-125 / storyView 378-390 (10-12 array + closure + spreads) | orbitStep e4:60 (map while flying) | updateSets~3 e2:224 (`hid`) -> buildTurn e2:58 (filter, forever after build) | keepCamera e2:130 ([x,y,z] per set) | LOD.update -> molPx e2:421 (new Vector2) | page labels e7:404-405 (closure + LBL.exploreAll() concat, design e7:97) | xrPoint e5:857 (panelMeshes.filter, hit objects, xrBallHit point.clone e5:912) | xrTip e5:835,841 (JSON.stringify(pk) + array) | xrClear e5:1054-1063 (3 closures + traverseVisible) | panelTick e6:143 (signature string built before the 60 ms throttle; sigMain e6:347 does 2 querySelector).
What: a few dozen small objects/arrays/strings per frame per story; on Quest this is GC pressure in a 72-90 Hz budget. evalTrack is O(params x keys) per frame.
Change: reuse one S/targets object and one view array; keep each track's last key index (t mostly moves forward); hoist the label closures; test the throttle before building panel signatures; filter panelMeshes on visibility change only.

### Double hit test of the same panel point per controller per frame   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: tools/engine/e5_xr.js:873 (xrPoint computes hit.P.at) and 563-569 (xrBegin loops every panel x controller calling P.at again)
Change: store the region from xrPoint on c and read it in xrBegin.

### The engine is pasted ~160 KB into every built story; one file would save fetch+parse   [perf-load/repo-cost]  gain: medium  risk: high  sure: confirmed (measured)
Where: tools/engine/parts.mjs (expand), every packages/<key>/src/build.mjs, tools/design/build.mjs, template
What: measured over every //#use: each built main.js carries 119-173 KB of engine parts (design 119, robots 125, flock/tutorial 131, lbi 139, most ~160, ppicell 173) + kit.js 13 KB; ~3.1 MB of engine text across 21 built files. Of it the arrangements runtime ARR (e7:410-800) is 24.8 KB in every story and the design room, used only with developer mode's Copy to relay / &arr=; the keep-clear sampler (e5:927-1087) 11 KB in all though only endo/exposome/nmd call xrPrep.
What stands in the way: parts are not modules - they close over each story's own globals (SETS, CH, DEF, FIT, XR_HERE, story hooks such as exploreTargets, pickWith, drawTabPane) and ~2 variants exist for many parts; a package is frozen against later engine changes by design (tools/packages/SPEC.md:195-197). One shared file needs an engine factory taking the story's hooks plus a versioned engine file (engine-<hash>.js) that a package names - essentially the "R1-R3" work parked as "left for later".
Change (cheap first): move ARR out to a shell module loaded on demand (HOST.arrange already exists), and the keep-clear sampler into the three stories that use it; ~36 KB less parsed per story start.

### Story-engine boilerplate repeated outside the parts   [repo-cost]  gain: medium  risk: low  sure: confirmed (measured)
Where: packages/*/src/engine/e7_app.js (19 stories + design), e3_story.js, e4_explore.js
What: lines >30 chars identical in >=8 stories' own engine files: e7_app 71 lines (~98 KB summed over copies; the whole `return { inputs, caption, recenter, panels, xrPose, collab: {...}, peek, dispose() }` block, initEnd's theme/MutationObserver lines), e3_story 36 lines (~47 KB), e4_explore 42 lines (~40 KB). The rule "keep the shared hooks identical in every story" is upheld by hand.
Change: make the return object (with a few hooks) and initEnd's common lines `//#part`s, so the rule holds by construction.

### parts.mjs's report is stale; engine compare tools skip five stories   [repo-cost/md]  gain: medium  risk: low  sure: confirmed
Where: tools/engine/parts.mjs:34-48; same.mjs:20, panelsame.mjs:10, xrsame.mjs:15
What: `node tools/engine/parts.mjs` scans only tools/<k>/engine and prints "174 parts no story uses" - true count: 0 unused, one part (molInstanced) with a single user (ppicell). The three compare tools' default KEYS omit cdk5, exposome, ppicell, cellstress, hello.
Change: scan packages/*/src/engine and tools/design/engine (tools/stories.mjs); take default keys from tools/stories.mjs.

### Miniature kits pasted into every minis file   [perf-load/repo-cost]  gain: medium  risk: low  sure: confirmed (measured)
Where: tools/lowpoly/minis.mjs:18-23 (assemble)
What: kit-a (25 KB, 5 packages) and kit-b (16 KB, 15 packages + lowpoly.js) are pasted into each file: ~385 KB of the 631 KB of minis files is kit text. The design room's HOST.lowpoly('*') fetches and parses all 21 at its load; station icons fetch them per package.
Change: ship kit-a.js/kit-b.js once (a global loaded by HOST.lowpoly before the first minis file); minis files hold only their models.

### Dead or duplicated tools   [repo-cost/md]  gain: low  risk: low  sure: confirmed
- tools/packages/move.mjs (208 lines): the finished v185-187 migration; STORY_LIST is empty, so l.46-47 refuses every key. Still advertised in AGENTS.md:131, docs/agents/layout.md:33, packages.md:180, stories.md:7. Retire; keep one line in docs/history.md.
- Static file server + TYPES copied 5x (same.mjs:22-31, panelsame.mjs:12-17, xrsame.mjs:17-25, check.mjs:231-244, publish.mjs:188-198); the test-page localStorage defaults copied in check.mjs:258, same.mjs:73, xrsame.mjs:99, publish.mjs:206; fingerprint() and story.json FIELDS duplicated in scan.mjs:25-31,64-70 and check.mjs:35-45,219-225. One tools/lib.mjs.
- tools/lowpoly/harness-a.html and harness-b.html: two 99-line pages for one job with different query names (only= vs keys=, az in degrees vs radians); one harness.html?kit=a|b.
- tools/design/props.json:13 names packages/lbi/src/kit.js (does not exist; the kit is tools/engine/kit.js).

### diff -rq of the "further engine copies"   [repo-cost]  gain: low  risk: low  sure: confirmed
Where: tools/packages/template/engine/, packages/hello/src/engine/, packages/robots/src/engine/ vs tools/engine/
What: none is a copy of tools/engine: every file differs and tools/engine holds only shared parts, kit.js and the tools. Each folder is that story's own e1..e7 layer (//#use lines + its code: template 25.7 KB, hello 34 KB, robots 78 KB, design 53 KB). template is needed (new packages copy it); robots is a real story. hello overlaps the template: its build.mjs is identical to template/build.mjs (0 differing lines), as is cellstress's; cellstress's e5_xr is byte-identical to the template's. hello may stay as the documented runnable example, but the template could be generated from it (or vice versa) so only one is maintained.

### .mol files carry all LODs; all are primed to the GPU   [perf-load]  gain: low  risk: low  sure: plausible
Where: tools/mol/build.py:586-662; tools/engine/e2_scene.js:246-256 (whole file fetched), 361-384 (all 3 levels in a THREE.LOD), 72-79 (primeCheck queues every mesh over 3000 vertices, hidden LOD 0 included)
What: 29 .mol files, 8.4 MB (cdk5, ppicell); a crowd using LOD 2 still downloads LOD 0-1, and priming uploads every level.
Change: prime only the level on show; optionally byte ranges per level.

## Not worth changing
- Panel textures: redrawn only when their signature changes, text fades sent as row patches (texSubImage2D), first card draws limited to 2 a frame, foot redrawn once a second while playing - good.
- kit.js upload() diff-sends attribute ranges; newSet.setAlpha per set per frame is cheap; molMaterial/kit fade transparent getters cause no recompiles.
- BUILD/buildTurn budget (1 ms in a headset, 2-8 ms on a page) and PRIME (one item a frame, only at dt <= 20 ms) are sound apart from the allocations above.
- xrIdle away from a station renders only (good); load steps yield at 40 ms; warm() compiles in 50 ms slices.
- design collabApply's JSON.stringify per card runs only on apply; miniAt's raycast per mousemove is event-driven (could be per frame, minor).
- packages/index.json 27 KB (7 KB gz) with 124 file fingerprints: fine. tools/mol/view.html reads engine parts live (no copy). kit-a/kit-b fresh materials per build: disposed by the table.
- publish.mjs: careful (no force, no deletes); scan/check logic sound apart from duplication.

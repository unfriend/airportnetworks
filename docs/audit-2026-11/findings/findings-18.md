# Chunk 18: hand-written stories proteins + spatial (working notes)
Read: packages/proteins/main.js lines 1-1800 (so far)
- proteins:6 PPI blob 25,485 bytes one line (254 nodes, 375 edges); parsed once by JS parser; NET built once (92-130). Fine.
- proteins:7 HOP_DIST duplicates PPI.stats.hist; :77 STATS duplicates PPI.stats (tiny dup).
- Draw calls good: dots = 1 Points (589), pillars 1 instanced (596-608), routes 1 LineSegments (610-641), highlights 1 mesh each (~7).
- membrane SphereGeometry(1,128,80) ~10.4k verts + nucleus (96,64) ~6.3k, both transparent DoubleSide (539,542): full-screen-ish transparent overdraw x2 in headset; 32x24 would do for a rim shader.
- atmosphere mesh built but always invisible (545-548) "kept for shared code"; updateLight writes its uniforms every frame (1171-1172).
- per frame: storyState(t) new object of 22 keys + evalTrack linear scan (740-744); cameraPose allocates 4 Vector3 + 3 clones (685-696) called via applyCamera / xrPlaceGlobe each frame.
- updateStoryDOM (1038) per frame: CH.find + ST.items.find; in paths chapter $('#flights') querySelector + hopEnds.filter each frame (1070-1074) writes textContent every frame unconditionally; robustness $('#robPct') each frame (1078).
- updateTimeline (1108): toFixed string per frame; when changed, querySelectorAll('#track .name') + 3 querySelector; p changes nearly every frame while playing (0.01% steps of ~350s => change ~every 35ms) => DOM writes ~30/s.
- placeLabel (1022): template-string transform per visible label per frame.
- pickAirport loops 254 nodes per pointermove: fine.
- curveData: 31 steps x 6 connectivity; cached. fine.
Read: packages/proteins/main.js (3595 lines) DONE
- panelTick (2575-2592) is called every XR frame for XR.panels (xrUpdate 2223) and computes P.sig() BEFORE the 60 ms throttle test (2577-2578): sigMain (2647-2664) does 3-4 querySelector + getAttribute + string concat per frame in story mode; in explore mode builds a 20-element array + [...X.manual].join + join('|') every frame. Fix: test `now - P.t < 60` first.
- sigFoot (3166) includes Math.floor(APP.t): foot panel full 1024x176 redraw+upload once a second while playing (ok-ish).
- drawStoryEl (2802-2894) re-reads DOM every redraw (querySelector, textContent, style regex) — only on redraw, fine.
- xrPoint (2089): XR.panelMeshes.filter(m=>m.visible) new array per controller per frame + raycaster.intersectObjects; _xp.clone() per frame on globe hit (2110); pickAirportRay 254-loop per controller per frame (fine).
- XR frame does GL.rig.updateMatrixWorld(true) three times (xrBegin 2174, xrUpdate 2205, updateLight 1170) plus renderer.render's own scene update: 4 traversals of the rig (world, labels, highlights, panels, 16 landing cards).
- xrUpdate 2212-2215: storyT(APP.t) recomputed per label per frame (linear scan over 80 NARRATION_SYNC pairs each).
- frame (3423-3462): desktop: placeLabel for all ST.labels each frame (~30 labels, transform string each visible).
- Load: 5 steps (3476-3479); buildStory does 500 random-set trials + 4 connectivity calls (<few ms for 254 nodes); warm() sliced 50 ms; fine.
- dispose (3584-3593) disposes textures/geometries; label canvases freed. Timer xrMsg cleared. Listeners on window/document left to shell (HOST removes).
- Shared XR/panel/landing/slideshow/sfx/APP code: ~1654-3388 + 3390-3595 minus story-specific panes (drawExplorePane..drawKeyboard 2896-3162, drawFoot explore part) => roughly 1,350 lines shared.
Read: packages/spatial/main.js lines 1-1150 (so far)
- spatial data is text (PROTEINS 249 lines 33-283, LINKS 252 lines 287-540, MOVES): ~18 KB, parsed once into NET (614-716) at factory time. Fine.
- BIG: LAYOUT IIFE (803-1009) runs at factory evaluation, BEFORE init()/LOAD steps: relax(160)+relax(220) (951, 976) each iteration O(NC^2) repulsion with NC=282 copies => 39.6k pairs x 380 iters = 15M pair tests + project() per copy per iter (nearestOnMT scans all MT segments for cytosk copies) + CELL place() up to 4000 tries x 4 with spots.every. Seeded => output identical every load. Blocks the main thread in one go before the first loading step (headset shows no loading card). Fix: precompute pos/inst/pores (282x3 floats ~ 6 KB) with a node script, or at least move into a LOAD step / chunk it.
- edgeCurve/travelCurve use v3 helpers allocating arrays (load-time only).
Read: spatial 1150-1800
- spatial scene draw calls: merged organelles (v137) ~12 meshes + dots 1 Points + routes 1 + ids 1 + actors + bubble + stars; good.
- fill/overdraw: pm SphereGeometry(1,128,80) DoubleSide transparent (1430-1433), nucleus (96,64) DoubleSide (1436), golgi cisternae DoubleSide (1478 no front()), ER 3 nested spheres 80x56 merged = ~13.7k verts with discard (1467, FrontSide). Pixel cost in headset: membrane both faces + nucleus both faces + 3 ER sheets + golgi; vertex count of pm (10.4k) excessive for a rim shader.
- cameraPose/applyCamera/resize (1688-1721) are line-for-line copies of proteins 685-718; tubeGeometry, highlightMaterial, setHighlight, mulberry, storyT/narrT, evalTrack, key/ramp also duplicated.
- Stars built identically in both (1541-1550 vs proteins 551-559).
Read: spatial 1800-2450
- placeLabels (2186-2208), called each desktop frame from frame(): alloc vis array of [L,x,y] per label, sort, O(n^2) _placed.find overlap per label, transform string; ~45 story labels; fine for desktop, modest.
- setActors (2139-2152) called every frame (storyActors in story, exploreStep in explore): sets needsUpdate on 3 attributes every frame even when nothing moves (3 bufferSubData/frame), c.array.set([..]) allocates per actor; storyActors/exploreStep allocate {from,to,x,a,col} objects per traveler per frame; exploreStep builds tg object + MOVES.forEach closures per frame.
- isThere(c) = present(c, scenNow()) and scenNow() maps MOVES each call (2300-2301): bestPath/reachInfo call it per edge visited -> array alloc per edge (on click only; low).
- buildStory placeStats: O(P^2) with pPlaces .some/.includes (31k pairs) + proteinReach pairs loop O(P^2) with Set iteration (load-time, ~ms).
- orgAnchor (2078) calls storyCam+cameraPose at build; fine.
Read: spatial 2450-3150
- spatial 2944-3115 (XR state, xrPlaceGlobe, recenter, settings getters, xrIdle, xrWarm, xrCaption, yawOf, xrQ, xrPanelPose, xrFace, xrSettings) identical to proteins 1654-1825.
- labelTex etc same as proteins except LBL_STYLE class names.
Read: spatial 3150-3850
- GOOD FINDING: pickCopyRay (3218-3231) calls isThere(c) for all 282 copies; isThere = present(c, scenNow()) and scenNow() = MOVES.map(...) allocates a 7-element array + closure each call. pickCopyRay is called from xrPoint (3388) for each controller every XR frame in explore mode (xrBegin 3459 <- frame). => ~2 x 282 = 564 arrays per frame (~45k/s at 80 Hz) of garbage: GC pauses in headset. Same in pickCopy (2860) per pointermove. Fix: compute scen = scenNow() once per frame (or cache by XS values), pass to present().
- spatial XR section 2944-3850 is line-identical to proteins 1654-2590 except: pickCopyRay vs pickAirportRay, xrTip text, placeLabelXR position source, xrClickCopy/xrSetPathEnd, proteinInfo vs airportInfo/closureInfo, VC adds teal.
Read: packages/spatial/main.js (4842 lines) DONE
- MEASURED: spatial lines 10-1009 (NET+CELL+LAYOUT) extracted to scratch and run in node: ~100-110 ms (cold), all synchronous at factory evaluation.
- Shared code (difflib, runs>=3 identical lines): proteins~spatial 2,186 lines / 122 KB; proteins~airports 3,080 lines / 170 KB; in all three 2,153 lines / 119 KB. proteins~tools/engine/e5_xr.js 511 lines, ~e6_panels.js 426 lines.
- proteins is a fork of airports: 27 lines still say airport/18,858 routes (e.g. :610 "all 18,858 routes as one line set", :1930 "Closest airport to a ray"); names selectAirport/renderAirport/pickAirport/airportMaterial; dead: km() :230, HOP_DIST :7, STATS dup of PPI.stats :77, XR_STORIES (both), atmosphere mesh :545 kept invisible but uniforms written every frame :1171.
- peek: src => eval(src) (proteins 3583, spatial 4830): direct eval in the factory forces every factory-scope variable to be context-allocated (V8 cannot optimise scope); plausible small cost on hot functions.

==================== FINAL (supersedes the working notes above) ====================
# Chunk 18: hand-written stories proteins + spatial
Read: packages/proteins/main.js (3595 lines)
Read: packages/spatial/main.js (4842 lines)
## Findings
### Spatial's cell layout runs synchronously before the first load step   [perf-load]  gain: high  risk: low  sure: confirmed
Where: packages/spatial/main.js:614-716 (NET), 722-797 (CELL), 803-1009 (LAYOUT), run at factory evaluation; init() only at 4812
What: two force relaxations (951, 976: 160+220 iterations, O(NC^2) repulsion over 282 copies = 15M pair tests, project() per copy per iteration, nearestOnMT over every microtubule segment) plus CELL's rejection sampling (up to 4x4000 tries). Measured 100-110 ms in node on this machine (lines 10-1009 extracted to scratch); on Quest Browser likely several hundred ms, one block, before HOST.progress is ever called, so a headset gets no loading card for it. The result is seeded, so identical on every load.
Change: precompute LAYOUT.pos/inst/pores and CELL's organelle spots with a node script into a small data block (~282x3 floats + ~30 spots, ~8 KB), keep the solver in a tool; or at least move NET/CELL/LAYOUT into LOAD steps sliced like warm().
### Spatial allocates ~560 arrays per headset frame while pointing in explore mode   [perf-frame]  gain: high  risk: low  sure: confirmed
Where: packages/spatial/main.js:2300-2301 (scenNow, isThere), 3218-3231 (pickCopyRay), called from xrPoint 3388 <- xrBegin 3459 <- frame 4672
What: isThere(c) = present(c, scenNow()), and scenNow() does MOVES.map(...) (a new 7-element array and closure) on every call. pickCopyRay calls it for all 282 copies, per controller, every XR frame in explore mode: ~564 arrays a frame, ~45k/s at 80 Hz, steady garbage for the GC in the headset. The same in pickCopy (2860) per pointermove, and in bestPath/reachInfo/partnersByPlace per visited edge (on clicks).
Change: work out the scen array once a frame (or keep it in X/XS, updated in exploreStep) and pass it in; present(c, scen) is already allocation-free.
### Panels build their signature every frame before the 60 ms throttle   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: proteins:2575-2578, spatial:3841-3844 (panelTick); sigMain proteins:2647-2664, spatial:3913-3929; called for every XR.panels entry from xrUpdate (proteins:2223, spatial:3506) each frame
What: P.sig() runs before `now - P.t < 60` is tested. Story mode does 3-4 querySelector + getAttribute + string concatenation a frame; explore mode builds a ~20-element array, [...X.manual].join, scenNow().map(...).join and join('|') every frame for the main panel, plus the foot panel. The same lines are in every story (engine e6_panels.js holds the shared copy).
Change: test the throttle first (`if (!force && now - P.t < 60) return;` before P.sig()). One line, in every story's copy and tools/engine/e6_panels.js.
### Desktop page DOM written about 30 times a second, also in a headset   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: proteins:1108-1124 / spatial:2276-2292 (updateTimeline), proteins:1038-1081 / spatial:2212-2248 (updateStoryDOM); called from frame (proteins:3445-3446, spatial:4690-4692) whether or not xr
What: the progress string has 0.01 % steps, so on a ~345 s story it changes every ~35 ms: two style writes, setAttribute, a textContent and a querySelectorAll('#track .name') with 10 classList toggles each time. updateStoryDOM writes #flights/#steps textContent and runs querySelector every frame of its chapter (proteins:1071-1073, spatial:2244-2246) even when unchanged, and getBoundingClientRect (forced layout) when a line appears. All of this also runs during a headset session, where the page is not seen.
Change: round to whole seconds or 0.1 %; cache the element references; write text only when it changes; skip updateTimeline/updateStoryDOM's DOM part while xr is presenting (the panels read ST.items' e.o, not the DOM, except sigMain's three reads, which can read cached values).
### Three copies of the same ~2,150 lines in the hand-written stories   [repo-cost]  gain: high  risk: medium  sure: confirmed
Where: proteins:1654-3595 vs spatial:2944-4842 (and airports/main.js); full-file comparison with difflib, runs of >=3 identical lines
What: proteins and spatial share 2,186 identical lines (122 KB); proteins and airports 3,080 lines (170 KB of proteins' ~215 KB of code); 2,153 lines (119 KB) are identical in all three. That is the XR core (state, globe pose, recenter, settings getters, xrIdle, xrWarm, labels as sprites/signs, controllers, grab/carry/resize, xrPoint, xrBegin/xrUpdate, session start/end), panels (makePanel, panelTick/Fade/Send/Patch, text helpers, landing cards, drawStoryEl, drawFoot story part), narration, slideshow, sound effects, APP/frame/LOAD/warm/initEnd, cameraPose/applyCamera/resize, tubeGeometry, highlights, evalTrack. The built stories take theirs from tools/engine/e5_xr.js + e6_panels.js (proteins matches only 511 + 426 lines of those: the hand-written copies have drifted from the engine). Any headset change is made three times by hand plus once in the engine, and an agent reading either story reads ~120 KB that is not story-specific.
Change: (the owner parked the rewrite onto the engine, R1-R3) a smaller step: move the byte-identical blocks into one shared file the three load (or paste at build like the engine parts) and leave the story-specific panes (drawExplorePane..drawKeyboard, buildStory, NET) in each main.js; until then, a header comment naming the shared line ranges so an agent can skip them.
### Proteins still reads as the airports story   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: packages/proteins/main.js:610 ("all 18,858 routes as one line set"; it has 375), 255, 593, 1655-1660 ("The globe floats"), 1930 ("Closest airport to a ray"); names selectAirport, renderAirport, pickAirport(Ray), airportMaterial, airportInfo, findAirport, X.tab 'airport', NET.city/country holding role/compartment; 27 lines mention airport or 18,858
What: misleading for an agent: counts and terms belong to another story. Dead code from the fork: km() 230-235 and NET.lat/lon (only flyTo uses them), HOP_DIST 7 (unused), STATS 77 (duplicates PPI.stats), XR_STORIES (proteins:2666, spatial:3931: unused), the atmosphere mesh 545-548 (always hidden, yet updateLight writes its uniforms every frame at 1171-1172).
Change: fix the comments; drop km/HOP_DIST/XR_STORIES and the atmosphere mesh (and its two uniform writes); rename only if the shared code is split out anyway (collab state keys use 'airport' as a tab name, so renaming the tab needs a FORMAT bump).
### Large see-through shells, drawn both sides, in a headset   [perf-frame]  gain: medium  risk: medium  sure: plausible
Where: proteins:539-544 (membrane SphereGeometry(1,128,80) and nucleus (0.37,96,64), both transparent DoubleSide); spatial:1430-1436 (same membrane and nucleus, DoubleSide), 1467 (3 ER spheres 80x56 merged, ~13.7k verts, discard shader), 1478 (Golgi cisternae DoubleSide)
What: the membrane fills most of the view at life size, so each pixel shades membrane back and front, nucleus back and front, and in spatial up to three ER sheets and the Golgi: 4-7 blended layers per pixel on Quest's fill rate. 10.4k vertices for a rim-lit sphere is ~4x more than it needs (64x40 looks the same with this shader).
Change: membrane and nucleus FrontSide (the rim term already brightens the silhouette) or BackSide-only for the inner face; lower their segment counts; spatial already did FrontSide for the small shells (1459) and says why.
### Per-frame allocations in the frame helpers   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: cameraPose proteins:685-696 / spatial:1688-1699 (4 Vector3 + 3 clones per call) via applyCamera/xrPlaceGlobe every frame; storyState proteins:740 / spatial:1801 (new object of 22/27 keys a frame); spatial storyActors 2153 / exploreStep 2303-2343 (objects per traveller, tg object, closures) and setActors 2139-2152 (array per actor, 3 attributes flagged needsUpdate every frame even with nothing moving); spatial placeLabels 2186-2208 (array per label, sort, O(n^2) overlap); xrPoint proteins:2089/spatial:3374 (panelMeshes.filter per controller per frame), _xp.clone() per hit; xrUpdate storyT(APP.t) per label (proteins:2213, spatial:3496)
What: each small, together a steady stream of short-lived objects every frame in the headset.
Change: module-level scratch vectors in cameraPose; reuse one state object; flag actors' attributes only when the list changed; compute storyT once in xrUpdate; keep a visible-panel list updated when visibility changes.
### GL.rig's matrices walked three times per headset frame   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: proteins:2174, 2205, 1170; spatial:3457, 3488, 2396 (updateMatrixWorld(true) in xrBegin, xrUpdate, updateLight), then renderer.render walks the scene again
What: the rig holds the world (dots, routes, highlights, labels' sprites/signs), the two panels and up to ~20 landing cards: four full traversals a frame. Spatial already freezes its static meshes (1539), which helps.
Change: one forced update after the last change of rig/world pose in the frame (in xrUpdate), plain updateMatrixWorld() elsewhere.
### Direct eval in the story factory   [perf-frame]  gain: low  risk: low  sure: plausible
Where: proteins:3583, spatial:4830 (`peek: src => eval(src)`)
What: a direct eval inside the factory forces V8 to context-allocate every variable of the factory scope (it cannot know which ones eval reads), which slows every hot closure's variable access a little.
Change: expose an explicit object for tests (e.g. peek reading from `{ NET, GL, X, XR, APP, ... }`), or use the shell's indirect eval with a fixed map.
## Not worth changing
- Draw calls are already low: dots one Points, pillars instanced, all interactions one LineSegments, spatial's organelles merged per kind (v137, ~12 meshes), highlights one mesh each; no per-node meshes.
- Proteins' embedded data is 25 KB on one line (line 6), parsed once; spatial's 18 KB of text data parsed once into typed arrays. buildStory's 500 random-set trials and connectivity calls take a few ms on 254 nodes.
- Panel texture uploads are already throttled (60 ms, signature) and fades go up as texSubImage2D row bands (panelFade/panelPatch); landing cards first-draw two a frame.
- pickAirportRay/pickCopyRay loops (254/282 per controller) are cheap apart from the isThere allocation above.
- dispose clears timers (spatial also setMove.t), disconnects the MutationObserver and disposes geometries, materials and canvas textures; listeners on window/document are the shell's to remove.
- Load steps (scene, warm sliced at 50 ms, story, explore, panels) yield at 40 ms; only spatial's pre-step layout escapes them.
Bugs seen: none beyond the stale comments above.

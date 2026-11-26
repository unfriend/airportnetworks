# Chunk 25: studio headset code, panels, images/KTX2, studio tools, sets, tests, tour generator
Read: tools/studio/engine/e8_xr.js (1169 lines, 79.9 KB)
(context read: e10_app.js frame() 178-236; e7_explore.js rayPick/visitPick 1085-1127; e6q_screens.js screenRay 439-453)

## Notes e8 (working)
- frame() e10:178 in XR order: pvJobs? -> xrBegin (e8:898) -> xrIdle (e8:111) -> clock/audioFollow/slideStep/sfxStep/audioSync
  -> storyState|exploreStep+orbitStep -> xrPlace (e8:41) -> camera.updateMatrixWorld -> updateLight -> (Object.assign S copies
  in AR / grid hidden, e10:212-213, one new object each per frame) -> updateSets -> GL.world.updateMatrixWorld(true) (e10:215)
  -> behaveStep -> itemsStep -> trailStep -> cpkStep -> gogStep -> settingsStep -> svStep -> exStep -> STU.framed check
  (e10:224 spreads [...STU.items.values()] every frame until framed; never true in XR since !xr) -> updateExtraLabels -> paneStep
  -> xrUpdate (e8:960) -> renderer.render (scene.autoUpdate: another full matrixWorld pass).
- xrBegin: xrSettings (3 HOST.xr calls), getViewerPose, mirGrips, HOST.anchor.frame, floor getPose, xrRoomOnly/xrCards x2,
  stickMove x2 ctrls, GL.rig.updateMatrixWorld(true) (e8:936: FULL forced pass over rig->world->all items, since GL.world is
  a child of GL.rig, e2_scene.js:16), matrix invert, wallsXR, scanXR, xrPoint x2, xrLost, holdStep, panel hover loop
  (P.at per controller per panel), STU.hover find, STU.hotCorner find.
- xrPoint per controller: panelMeshes.filter (new array, e8:845), raycast panels, HOST.collab.ray, rayPick/visitPick
  (pickables loop over all items; visitPick allocates L each call), screenRay (loop over all items, e6q:439), floor raycast
  XR.solid, P.at for hover key + string concat (e8:872), paintXR, carry (carryItem/carryGroup each do another
  GL.world.updateMatrixWorld(true): e8:633, 674, 704, 714), stickScroll, stickWalk, dot.lookAt.
- xrUpdate: GL.rig.updateMatrixWorld(true) again (e8:977), labels loop (ST.labels, LBL.sets, LBL.extra) placeLabelXR
  each: distanceTo, applyMatrix4 for signs; panelTick per panel (e9).
- => In XR, per frame, forced full-scene matrixWorld passes: e8:936, e10:215, e8:977, render's own = 4 (5-6 while carrying).
  Model nodes have matrixAutoUpdate=false (e5_models.js:341) but force=true still recomputes matrixWorld for every node.
Read: tools/studio/engine/e9_panels.js (826 lines, 54.1 KB)
(context: e7_explore.js paneSig 857, paneStep 1055, renderPanes 1036 (guarded in XR, good); e6m_anim.js animSig 200)
## Notes e9 (working)
- panelTick (e9:125) runs every frame for each panel in XR.panels (main, foot, landing head, every card; cards skip via
  P.want===false) from xrUpdate e8:996. Each call builds P.sig() and then 3 more string concats (e9:127) before comparing.
- sigMain explore (e9:243) = ['x', audioLabel(), xrSig(), paneSig(), animSig(true), ...].join('|'): paneSig (e7:857) is a
  ~90-field array joined, with JSON.stringify(X.texAdd...), 20+ *Sig() calls, and [...STU.items.values()].map(per-item
  string).join(''). In a headset this is built TWICE per frame: paneStep (e10:226 -> e7:1061) and sigMain (via panelTick).
  O(items) allocation per frame. paneSig's per-item part includes it.act/it.heard (cube and sound state) so walking through
  trigger cubes / sound reach causes a full main-panel repaint + full 1024x1200 texture upload (4.9 MB incl. mips) even
  though the pane shown may not show those items (only the Items tab does).
- full repaint path: drawExplorePane does paneBlocks(X.tab) + a dry drawBlock pass for height + the real pass (e9:510-524),
  i.e. every text block wrapped (measureText per word) twice; a third pass when CPKX.reveal.
- partial updates (panelHover, panelFade, barsTick, panelPatch with texSubImage2D + generateMipmap) are good work already.
- sigMain story mode (e9:237) reads two DOM attributes via $() each frame in the title chapter; sigFoot story changes every
  whole second (Math.floor(APP.t)) -> foot panel full repaint+upload once a second (1024x176, small).
- xrLandingCards e9:274 disposes/recreates all card canvases (640x820 each) on HOST.listRev change; cards drawn at most 2/frame (good).
Read: tools/studio/engine/images.js (692 lines, 48.0 KB)
Read: tools/studio/engine/ktx2.js (563 lines, 37.7 KB)
## Notes images/ktx2 (working)
- Both pasted into stories/studio.js (build.mjs:17 ENGINE list) for every visit, though the runtime uses only texFind/
  isPicture/psdBack (e5_models.js:130-141) and the TIFF/PSD/DDS decoders when a model names such a texture. ktx2.js is used
  only through convert.js (convert.js:43) — the headset's own KTX2 reading is three.js's KTX2Loader (e5_models.js:20-27).
  Encoder pool/encode/capture/glb/mips/strips/decode (~lines 190-560, ~30 KB) and images' cover/fillGaps (~9 KB) are
  converter/Fewer-triangles work: candidates for the same lazy-load pattern the exporter and simplifier already use
  (exporterLoad/meshoptLoad, e5_models.js:19). With convert.js (91 KB) that is ~150-175 KB of 2.33 MB a headset parses.
- Code quality fine: decoders guard sizes, worker pool reuses compiled wasm, idle decoder stops after 15 s (ktx2:530). Good.
Read: tools/studio/push.mjs (160 lines)
Read: tools/studio/r2sync.mjs (207 lines)
Read: tools/studio/scan.mjs (47 lines)
## Notes tools (working)
- All three reuse relay/scenes.mjs and relay/r2.mjs (sceneFiles, allScenes, uploadPath...) rather than copy the listing
  rules: good, no duplication. push.mjs's hidden password prompt is the only copy in the repo. Nothing to change.
- r2sync pull: per file sequential await (no concurrency) — fine for an event-prep tool; not app cost.
Read: tools/studio/sets/looks.js (546 lines)
Read: tools/studio/sets/stage.js (68 lines)
## Notes sets (working)
- looks.js fill() (line 160) is scene.onBeforeRender (batch(), line 223-226): runs on EVERY render, page and headset, editing
  or not. Per frame: scene.traverseVisible over the whole scene graph (every visible model node, line 163) just to find
  userData.bt tags/lines; TAGS.filter().map(pair arrays).sort() (line 171: one array per tag per frame); a new Map `by` and
  arrays per kind (186); list.map(linePts) (189); per line a 16-float matrix compare (201). With nothing batched (a visitor,
  not editing) it still walks the whole scene. Cheaper: keep a registry Set of batched objects (batched() adds, drop()
  removes) and walk only it, checking visibility up its parent chain; reuse a pair array for sorting.
- atSend (line 72-86) regenerates mipmaps of the whole 2048 x (512..4096) atlas whenever any tag's words change: tags whose
  text changes often (e.g. "397k tris" while Fewer triangles previews) cost a full mip chain each change. Low.
- stage.js: grid is 2 x 49 x 48 = 4,704 segments (9,408 verts) in one LineSegments, floor CircleGeometry 96, sky sphere
  32x16: one draw each, built once. Fine. Floor Lambert (v137) fine.
Read: tools/studio/test-ik.mjs (548 lines)
## Notes tests (working)
- test-ik: Node only, no browser, solves ~15 runs of 30 fps frames; fast (seconds). Its last block (v216, lines 504-545)
  tests bodies.js and greps shared.js and e6l_puppet.js for a copied matrix line (WRIST_G and MIR_WRIST): the matrix is kept
  in two places and the test guards the copy by regex. Better: one exported constant both read (ik.js is already shared).
- mulberry32 (0x6d2b79f5) copied into 8 files: tools/smoke.mjs, collab.mjs, studio/test-ik, xp/kit.js, xp/sounds.mjs,
  tour/sounds.mjs, packages/hello (src+main). The ok()/checks/fails harness copied in test-ik, test-images, test-ktx2.
  Small, but a tools/studio/test/lib.mjs (rnd, ok, report) would serve them.
Read: tools/studio/test-images.mjs (239 lines)
Read: tools/studio/test-ktx2.mjs (172 lines)
Read: tools/studio/test/examples/index.json (9 lines)
Read: tools/studio/test/examples/tiny/files.json (9 lines)
Read: tools/studio/test/examples/tiny/layout.json (14 lines)
- test-images: Node only; its 4,096 px fillGaps run is the slow part (seconds). Fine. test-ktx2: runs the real basis
  encoder/transcoder wasm in Node via vm; a few seconds. Both reuse the module source by new Function (no copies). Good.
- examples/tiny: generated by test/make.mjs (line 894-920), ~30 KB with box.glb and a 26 KB tone.wav; used by smoke
  'studio examples' only. Fine; listings committed so scan --check guards them.
Read: tools/studio/test/make.mjs (922 lines, 65 KB)
## Notes make.mjs (working)
- Header line 1 says the test scene and what it writes are "under 200 KB together": stale. Committed tools/studio/test/
  totals 617 KB (git ls-files); scenes/test/sounds/long.wav alone is 200,044 B, walks/walker.glb 110,816, puppet/rig.glb 60,232.
- Byte-identical generated files committed several times (for scenes that must be self-contained): box.glb x4, figure.fbx
  x3, figure.png x3, dancer.glb x2, tone.wav x2 (~75 KB of copies). Cheap; only worth it if the folder must shrink.
- In-file duplication: three GLB writers (glb() 98-140, dancerGlb() 143-205, puppetGlb() 670-777), each with its own
  add/f32/u16/mm/accessor/header/chunk helpers (~25 lines repeated 3x); two near-identical ASCII FBX templates (fbx()
  225-379 and panelFbx() 458-556, ~140 of ~250 lines the same); three WAV writers with the same 44-byte header code
  (voiceWav 207, wav 382, longWav 392). One glbWriter({nodes, meshes...}), one fbxText(opts), one wavOf(rate, bits, f)
  would cut ~250 of 922 lines (~25%) an agent reads when touching the test scenes. PNG/CRC writer also copied in
  pictures.mjs and tools/perf.mjs.
Read: tools/studio/test/pictures.mjs (225 lines)
- pictures.mjs exports png() (24-33) with the CRC table; make.mjs (86-95) has an identical private copy though it already
  imports scenePictures from pictures.mjs: import png instead (-10 lines). `grid`/`hi` exported but grid unused? (not checked).
  Checked: grid (line 22) and hi (196) are exported (225) but imported nowhere (importers: test-images, make.mjs, smoke.mjs
  which takes only PX): dead exports, grid itself is used nowhere.
Read: tools/studio/tour/checks.mjs (71 lines)
Read: tools/studio/tour/make.mjs (127 lines)
Read: tools/studio/tour/page.html (18 lines)
Read: tools/studio/tour/sounds.mjs (50 lines)
## Notes tour (working)
- tour/make.mjs, xp/make.mjs (131) and tracker-guide/make.mjs (133) are one harness three times: Playwright launch with the
  same SwiftShader args, page.route serving an ALLOW list, per-part XP.make loop, budgets, write/--check with the 2 % size
  tolerance for glb/jpg, walk(), stale/NOT MADE, scan. Only the scene name, ALLOW regexes, budgets and the layout differ
  (diff tour vs guide: 80 changed lines of 260). A shared tools/studio/examples-make.mjs (build(page, opts)) would leave
  each maker ~30 lines. Each run starts a Chromium and builds every model (tens of seconds); --check builds everything
  again to compare (no cheaper check than a full rebuild).
- tour/sounds.mjs repeats xp/sounds.mjs's rng (mulberry32), buf, bell, norm, seam and wav (16-bit mono header) with small
  differences (rate 11,025 vs 22,050; bell partials). A shared synth module would serve both (and the tracker guide).
- checks.mjs is shared by tour and tracker-guide (good: imported, not copied).
Read: tools/studio/tour/layout.mjs (372 lines)
- layout.mjs: obj/shape/cube/sound record builders and the id/name/refs checks (lines 92-128, 266-275) are a per-maker copy;
  tracker-guide/layout.mjs and xp/layout.mjs likely carry their own (not in my manifest; not checked). The 26 stands' words
  live here as data (good: one place, drawn by parts.js). Fine otherwise.

# FINAL (ranked) — see the final message for the full text; this section is the same list in short
1 perf-frame high: trigger cube / sound flip -> paneSig per-item flags -> full main-panel repaint + 4.9 MB upload (e7:857, e9:127-145)
2 perf-frame med: 4-6 forced full-scene matrixWorld passes per XR frame (e8:936, e10:215, e8:977, render; +e8:633/674/704/714 per carry)
3 perf-frame med: looks.js fill() traverseVisible of whole scene every render, allocations per tag (looks.js:160-221)
4 perf-frame med: paneSig built twice per XR frame (e10:226->e7:1061 and e9:243) with O(items) strings
5 perf-load med: images.js + ktx2.js + convert.js (~175 KB) parsed by every visit; lazy-load like exporter/meshopt
6 perf-frame low: xrPoint per controller allocs + 3 loops over STU.items (e8:845, e7:1119, e6q:439)
7 repo-cost med: tour/xp/tracker-guide make.mjs one harness x3; sounds.mjs x2; make.mjs GLB writer x3, FBX x2, WAV x3, png copy
8 md low: make.mjs header "under 200 KB" stale (617 KB); pictures.mjs dead exports grid/hi

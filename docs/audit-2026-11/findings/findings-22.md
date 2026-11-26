# Chunk 22: template engine tail, studio build, converter, studio engine head..motion
Read: tools/packages/template/engine/e3_story.js (96)
Read: tools/packages/template/engine/e4_explore.js (115)
Read: tools/packages/template/engine/e5_xr.js (9)
Read: tools/packages/template/engine/e6_panels.js (44)
Read: tools/packages/template/engine/e7_app.js (147)
Read: tools/packages/template/sets/orb.js (41)
- template engine: not a copy. Each file is a story-specific stub + `//#use name...` lines that pull the shared
  definitions from tools/engine at build (e5_xr is 9 lines of //#use only). diff -q reports "differ" for all, but it is
  ~450 lines of own code vs ~3,400 in tools/engine e3..e7. No own copy needed; fine as is.
- orb.js update(): every frame rewrites 1500 positions + aA and sets needsUpdate on both (uploads ~24 KB/frame) even
  when orb_grow/orb_spread are unchanged; template is copied into every new package -> pattern spreads. Low gain.
Read: tools/studio/build.mjs (90)
- Order: e1_head (kit, vendor: fflate, NURBS, TGA, FBX, GLTF, WorkerPool, KTX2, OBJ, MTL, PLY, STL, SkeletonUtils,
  TransformControls; GLTFExporter in exporterLoad(); meshopt in meshoptLoad()), sets stage+looks, then 46 engine files
  incl. images, ktx2, convert, ik (root ik.js pasted), e7b_upload, e7d_lite, e7e_pics, e7f_viewer, e7g_examples.
- ik.js (54,751 B) pasted into studio.js AND precached separately in sw.js SHELL ('./ik.js') -> 55 KB shipped twice.
- Page-only bytes all visits parse (sizes of sources): convert.js 91K, e7b_upload 82K, GLTFExporter 58K (in a fn, still
  parsed+downloaded), meshopt 68K (WASM base64 inside fn), e7d_lite 32K, e7f_viewer 32K, e7e_pics 29K, images 48K,
  ktx2 38K (encoder half page-only), e7g_examples 18K, FBX 101K + fflate 30K + OBJ/MTL/PLY/STL/TGA/NURBS ~75K (only to
  convert/upload non-GLB: check), TransformControls 46K (page editing). Rough total ~750 KB of 2.33 MB.
- comments at lines 15-28 are one 2 KB wall listing every engine part (duplicates docs/agents/studio.md); history-ish.
Read: tools/studio/convert.mjs (249)
- fine: CLI wrapper, loads vendor files + engine/convert.js separately (so convert.js is already a standalone module:
  shows a second file is feasible). Dead `const where = p => p;` (l.170). 38-line header = usage doc, OK.
Read: tools/studio/dub/make.mjs (198)
- examples/dub-techno is a generated example missing from CLAUDE.md's/AGENTS.md's "Built file" lists (bliss-xp, studio-tour,
  tracker-guide are there); its --check is not in AGENTS.md's Testing table. lint() re-implements a subset of norm()
  limits (LIMITS copy: cubes 100, shapes 200, groups 50 = e4_files.js:357 c/p/g): can drift.
Read: tools/studio/engine/convert.js (1248)
- makeConverter is built once at load (e5_models.js:19 CONV). Scene loading uses only load/fbxGuess/guessFor/glbRecord/
  matsOf/texFind/IM/ktx2 (~l.32-420). Page-only: reduce (l.503-671, e7d_lite), fillModel+fillPlan (l.673-791; e7_explore,
  e7d_lite, e7f_viewer), triCount (l.793-868, upload/lite), toGLB (l.870-1244, ~375 lines: upload, AND e6p_scan room scan
  in a headset). So ~55 KB of 91 KB could be a second file loaded on first Convert/Fewer/scan-save.
- No per-frame code. Fine: fbxGuess reads only first 4 MB; weld uses hash table; yields during long work.
- namesIn('fbx') (l.175) builds a JS string of the WHOLE FBX (String.fromCharCode per 64K) then a regex over it:
  for a 200 MB FBX that is a 200M-char string (~400 MB UTF-16) on upload; page-only, low.
Read: tools/studio/engine/e1_head.js (29)   (wrapper; fine)
Read: tools/studio/engine/e2_scene.js (115)  (3 lights; GL.stars a hidden 1-point Points "kept for the engine's sake" l.23-27; updateLight per frame no alloc: fine)
Read: tools/studio/engine/e3_story.js (253)
- placeLabels (l.161) each page frame (frame() l.232-233): 2x getBoundingClientRect (#panel, #bar) + $() lookups; only 2 labels in
  the studio; low. labelSet (l.134-137) carries a history comment (v136 bug story) - history, not rule.
Read: tools/studio/engine/e10_app.js (555)
- frame() (l.178, setAnimationLoop): GL.world.updateMatrixWorld(true) at l.215 AND again at l.231 (page, after render), plus
  renderer.render's own scene.updateMatrixWorld: three full forced traversals of every model node/bone per page frame,
  two per XR frame. l.231 is redundant after render (nothing moves between) -> drop or make non-forced.
- l.224: `[...STU.items.values()].every(...)` builds an array every frame until STU.framed; if an object's model never
  arrives (state stays loading) it runs forever. low.
- l.212/213: Object.assign({}, S, ...) a new params object per frame in passthrough AR or grid hidden. low.
- STUDIO (l.352-480): 130-line test/console API in the shipped file (~10 KB); fine but test-only.
Read: tools/studio/engine/e4_files.js (726)
- keyOf (l.436) = sort + JSON.stringify of EVERY placed record (paths up to 6,000 keys x8 numbers, paintings' points) plus
  settings; unsaved() (l.441) calls it. Callers: renderPanes via savedLine/Save button (e7_explore.js l.88, 131, 147, 153:
  up to 3x per render), renderPanes runs <=1 per 150 ms while dirty (paneStep, from frame() e10_app l.226) -> while
  dragging an item, ~3 full-layout stringifies every 150 ms. Cache: a STU.rev counter bumped on change, key memoised by rev.
- Cross-file pointer (e7_explore.js:857, another reader): paneStep -> paneSig() EVERY frame builds a ~90-part string incl.
  JSON.stringify(X.texAdd...) and a map over all items ([...STU.items.values()].map(...).join): per-frame garbage
  proportional to item count (300 objects + 200 shapes...). Also in XR sigMain (e9_panels:243).
- call() (l.62) scans STU.files + PV.files linearly per request: fine (not per frame).
- LIMITS (l.357) duplicated in tools/studio/dub/make.mjs lint().
Read: tools/studio/engine/e5_models.js (436)
- getBytes (e4_files.js:108-124, used by libLoad l.87 and sndFetch) keeps every chunk then copies into a new buffer:
  peak memory 2x the file (a 300 MB scan GLB -> ~600 MB in a Quest tab) though the listing gives f.bytes: preallocate
  Uint8Array(f.bytes) and write chunks in place (grow only if larger).
- libClone (l.317-344): static nodes get matrixAutoUpdate=false - good, this is what makes per-frame traversal cheap.
- skinCull (l.162): skinned meshes that may move or be worn are never frustum-culled: drawn and skinned whenever present.
- _az (l.295) unused; _ax used once in e6_items. Small dead code.
- Library root E.root kept alive beside every clone (geometry shared, materials cloned per object): fine.
Read: tools/studio/engine/e6_items.js 1-820 (of 2031)
- triggerStep (l.718; per frame, from itemsStep): for each `all` cube allocates per frame: hs.filter, new Map(ins.map),
  Math.min(...ins.map) (l.750-754); behHeads(Tr) array per frame. Small (<=100 cubes), low.
- warmUpStep/warmQueue (l.435-482): good (uploads spread a frame at a time, XR only). warmDraw allocates a THREE.Color
  per call (l.471) - one per frame while warming; trivial.
- putItem (l.240) scans all items per new item -> O(n^2) at load for 300+ items; negligible.
Read: tools/studio/engine/e6_items.js 820-2031 (rest)
- BIG: roomState()/collabState (e6_items.js:1941-1953) is polled EVERY FRAME in a shared room: shared.js:3484 (tick) ->
  statePoll (3209) -> publish (932) -> sig() = J(v) (256): JSON.stringify of the whole studio state (every record incl.
  recorded paths up to 6,000 keys x 8 numbers, paintings' strokes, sequences; a layout may be up to 2 MB) every frame
  just to find it unchanged. Fix: memoise roomState on a revision (STU.rev + qr/pr/sw/bt changes) and return the same
  object; in shared.js skip sig() when state() returns the identical object as last time (or a collab.rev() hook).
- collabApply (l.1961-2025): on every room update re-norms every record and JSON.stringifies old+new per item (l.1986),
  plus qr/pr/sw maps; during someone's drag (grips write 10/s) that is the whole layout twice per update on every device.
  Compare only keys whose incoming value changed (shared.js already knows which keys arrived).
- beginChange/endChange (l.1555-1581): change() without ids JSON.stringifies every record before and after (snapNow of
  all items) for each edit (button press, not per frame): fine, but O(layout) per click.
- emitStep (l.1236, per frame from itemsStep): per playing sound getWorldPosition + 3 AudioParam .value writes even when
  unchanged; listen() 9 writes/frame. Low; skip when position unchanged.
- editStep (l.1087, per frame): with a cube selected builds `[...new Set(...)]` arrays each frame and re-uploads the
  1,600-vertex links buffer (2x19 KB) every frame (needsUpdate always set, l.1123). Low.
- awayArm (l.1521): a 100 ms timer runs forever from the first frame, also on pages that are never in a headset. Low.
Read: tools/studio/engine/e6b_cuts.js (317)
- Fine: discard shader only while a box cuts (v137 fix), uniforms uploaded once a frame per object (cutUpload via onBeforeRender).
- cutsStep (l.72, per frame from itemsStep): 3 passes over all items even in a scene with no cut-out (unused feature costs
  O(items)/frame); cutLook builds its tag string per frame (set() caches the canvas). Low: early-out when no 'x' item (count by STU.rev).
Read: tools/studio/engine/e6c_groups.js (330)
- groupMap memoised on STU.rev: good. groupsStep (l.306, per frame from itemsStep): only a selected/carried group does
  work (groupMeasured arrays + atPlaced each frame); low. groupBase deep-copies records with JSON.parse(JSON.stringify) per hold: fine.
Read: tools/studio/engine/e6d_shapes.js (332)
- shapeStep/settingsStep per frame: cheap (tag words cached). "Move the scene to this circle" (l.225-316, ~90 lines) is a
  migration for pre-v125 layouts; candidate to drop or move page-only once no such layout remains (owner's call).
Read: tools/studio/engine/e6e_motion.js (215)
- poseStep/drawnPose per moving item per frame: one matrix invert + a closure (`about`, l.81) per motionDelta call; fine.
- comment share measured: studio.js 2,330,356 B of which ~471 KB full-line comments + ~48 KB trailing (22 %); engine files
  25-42 % comments; e6_items.js alone 68 dated history references ("the owner, ... 2026", "until v130"...).

==================== FINAL (structured) ====================
# Chunk 22: package template engine (end), studio build, converter, studio engine head..motion
Read: tools/packages/template/engine/e3_story.js (96), e4_explore.js (115), e5_xr.js (9), e6_panels.js (44), e7_app.js (147)
Read: tools/packages/template/sets/orb.js (41)
Read: tools/studio/build.mjs (90), tools/studio/convert.mjs (249), tools/studio/dub/make.mjs (198)
Read: tools/studio/engine/convert.js (1248), e10_app.js (555), e1_head.js (29), e2_scene.js (115), e3_story.js (253)
Read: tools/studio/engine/e4_files.js (726), e5_models.js (436), e6_items.js (2031), e6b_cuts.js (317), e6c_groups.js (330)
Read: tools/studio/engine/e6d_shapes.js (332), e6e_motion.js (215)
## Findings
### The studio's whole room state is JSON-stringified every frame in a shared room   [perf-frame/relay]  gain: high  risk: low  sure: confirmed
Where: shared.js:3484 (tick, every frame) -> statePoll 3209 -> publish 932 -> sig() 256 = J(v); state from tools/studio/engine/e6_items.js:1941-1953 (collabState/roomState)
What: roomState builds an object of every record (paths up to 6,000 keys x 8 numbers, paintings' strokes, sequences; layouts up to 2 MB), and publish stringifies all of it each frame only to find it unchanged.
Change: memoise roomState on a revision (STU.rev plus qr/pr/sw/bt changes) and return the same object; in shared.js skip sig() when state() returns the object it compared last (or add an optional collab.rev()). Measure on a heavy scene first.
### Ship ~0.45-0.75 MB less in stories/studio.js: page-only parts as a second file, and comments out of the built file   [perf-load/repo-cost]  gain: high  risk: medium  sure: plausible
Where: tools/studio/build.mjs:17 (ENGINE order), 32-73 (VENDOR, LATER, meshopt), 80-82
What: build.mjs pastes, in order: e1_head (kit, then fflate, NURBS, TGA, FBX, GLTF, WorkerPool, KTX2, OBJ, MTL, PLY, STL, SkeletonUtils, TransformControls, GLTFExporter inside exporterLoad(), meshopt inside meshoptLoad()), sets stage+looks, then 46 engine parts. Every device precaches and parses all 2.33 MB (705 KB gzip). Page-only or rare parts (source bytes): e7b_upload 82K, e7d_lite 32K, e7e_pics 29K, e7f_viewer 32K, e7g_examples 18K, e7h_seqview 22K, TransformControls 46K, GLTFExporter 58K and meshopt 68K (deferred in a function but still downloaded and pre-parsed), convert.js's export half 55K (below): ~440 KB. Separately, full-line comments are 471 KB of studio.js and trailing ones ~48 KB (engine files 25-42 % comments).
Change: (a) build a second file stories/studio-edit.js (upload, lite, pics, viewer, examples, seqview, exporter, meshopt, TransformControls, convert's export half) loaded by a small loader on first Edit/Upload/Convert/Fewer triangles/room-scan save; convert.mjs already loads convert.js as a standalone script, so the module boundary exists. (b) strip full-line comments when pasting (keep licence headers of vendor/). Both keep sources as they are; --check still compares bytes.
### ik.js shipped twice   [perf-load]  gain: medium  risk: low  sure: confirmed
Where: tools/studio/build.mjs:82 pastes root ik.js (54,751 B) into studio.js; sw.js:4 SHELL also precaches './ik.js'
What: every device downloads and caches the solver twice; bodies.js loads ik.js on demand anyway.
Change: have the studio use the global from ik.js (load it as bodies.js does, before the studio runs) instead of pasting it; or accept and note it.
### convert.js: only ~40 % is needed to show a scene   [perf-load]  gain: medium  risk: medium  sure: confirmed
Where: tools/studio/engine/convert.js; CONV made once at e5_models.js:19
What: scene loading uses load/fbxGuess/guessFor/glbRecord/matsOf/texFind/IM/ktx2 (l.32-427). reduce (l.503-671), fillModel/fillPlan (673-791), triCount (793-868) and toGLB (870-1244) are used only by Upload, Fewer triangles, the viewer and e6p_scan's room-scan save.
Change: split convert.js into load (always) and export (on demand, part of the second file above); toGLB must stay loadable in a headset for the room scan.
### Unsaved-changes check stringifies the whole layout up to 3x per pane render   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: tools/studio/engine/e4_files.js:436-441 (keyOf, unsaved); callers e7_explore.js:88, 131, 147, 153; renderPanes from paneStep (e10_app.js:226, each frame, renders <=1 per 150 ms while dirty)
What: keyOf sorts and JSON-stringifies every placed record plus settings; while dragging (dirty constantly) that is ~20 full-layout stringifies a second, plus the same in the headset panel path.
Change: memoise keyOf() by STU.rev (and settings), compute unsaved() once per render.
### paneSig() built every frame (cross-file pointer; e7_explore.js is another reader's)   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: e10_app.js:226 paneStep -> e7_explore.js:857 paneSig; also e9_panels.js:243 sigMain in XR
What: a ~90-part string each frame, incl. JSON.stringify(X.texAdd...) and a map/join over every item; garbage grows with item count.
Change: bump a pane revision where those values change, or compose the per-item part only when STU.rev/libRev change.
### collabApply re-norms and double-stringifies every record on every room update   [perf-frame/relay]  gain: medium  risk: low  sure: plausible
Where: tools/studio/engine/e6_items.js:1961-2025 (l.1980 norm, l.1986 JSON.stringify old and new)
What: during someone's grip drag (writes 10/s) every other device re-checks and stringifies the whole layout per update.
Change: compare only the keys that changed (shared.js knows which arrived), or compare the incoming raw value with the last raw value per key before norm().
### Three forced world-matrix traversals per page frame   [perf-frame]  gain: medium  risk: low  sure: plausible
Where: tools/studio/engine/e10_app.js:215 and 231 (frame(), setAnimationLoop)
What: GL.world.updateMatrixWorld(true) before the item steps, renderer.render's own scene update, then again forced after render (page only) for placeLabels; nothing moves in between.
Change: drop l.231 (render already updated matrices) or make it non-forced. Static model nodes already skip work (libClone matrixAutoUpdate=false, e5_models.js:338-342), so the gain is the walk itself.
### Model download holds twice its size in memory   [perf-load]  gain: medium  risk: low  sure: confirmed
Where: tools/studio/engine/e4_files.js:108-124 (getBytes), used by e5_models.js:87 (libLoad) and sndFetch
What: chunks are kept, then copied into a new buffer: a 300 MB scan peaks near 600 MB in a Quest tab; the listing already gives f.bytes.
Change: preallocate Uint8Array(f.bytes) and write chunks in place (grow only if longer).
### Per-frame loops for unused features   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: e6b_cuts.js:72-84 (cutsStep: 3 passes over all items with no cut-out), e6_items.js:1087-1137 (editStep: per-frame Set/array building and a 2x19 KB buffer re-upload while a cube is selected, l.1114-1123), e6_items.js:750-754 (per-frame arrays/Maps per 'all' cube), 1236-1276 (emitStep writes 3 AudioParams per sound + 9 listener params each frame even when unchanged), e10_app.js:224 (array spread each frame until STU.framed; forever if a model never loads), e6_items.js:1521 (100 ms timer forever on pages too).
Change: early-outs keyed on counts by STU.rev; skip param writes when position unchanged.
### Generated example missing from the built-files lists   [md]  gain: low  risk: low  sure: confirmed
Where: CLAUDE.md "Built file" table and AGENTS.md "Built files and data"; tools/studio/dub/make.mjs
What: examples/dub-techno is generated (`node tools/studio/dub/make.mjs`, `--check`) like bliss-xp, studio-tour and tracker-guide, which are listed; it is only in docs/agents/layout.md:379 and studio.md:747. Its lint() also re-copies the studio's LIMITS (e4_files.js:357) and can drift.
Change: add one row/line (or replace the four example rows with one "examples/<name>: its make.mjs" line, cheaper in both always-loaded files).
### History in shipped comments   [repo-cost/md]  gain: low  risk: low  sure: confirmed
Where: e6_items.js (68 dated owner quotes/version notes), e4_files.js (18), e10_app.js (13), e6d_shapes.js (12); build.mjs:15-28 a 2 KB one-line list of every part (duplicates docs/agents/studio.md); e3_story.js:134-137 (v136 bug story)
What: agents reading these files pay for history; it also ships (see comment stripping).
Change: keep the rule in the code comment, move the "the owner, <date>: ..." quotes and version stories to docs/history.md; make build.mjs's part list one line per part or point to studio.md.
### Template engine: no copy, but its example set uploads every frame   [repo-cost/perf-frame]  gain: low  risk: low  sure: confirmed
Where: tools/packages/template/engine/*.js (diff -q says all differ); tools/packages/template/sets/orb.js:22-31
What: the template's engine files are story-specific stubs plus `//#use` lines expanded from tools/engine at build (e5_xr.js is 9 lines of //#use only; ~450 own lines vs ~3,400 in tools/engine e3..e7): no separate copy, nothing to dedupe. orb.js rewrites 1,500 positions and sets needsUpdate on two attributes every frame even when its params do not change; every new package copies the pattern.
Change: in orb.js, recompute only when orb_grow/orb_spread changed (keep the time-only core spin).
## Bugs seen
- e5_models.js:295 `_az` is unused (`_ax` used once in e6_items.js:1799). convert.mjs:170 `const where = p => p` is an identity no-op.
## Not worth changing
- convert.js's own algorithms (hash weld, locked-seam simplify, fill with yields), fbxGuess reading only 4 MB; warmUpStep/warmQueue (uploads spread a frame at a time, XR only); cut-out shader only while a box cuts (v137); groupMap memoised on STU.rev; tag canvases cached by text (looks.js:239); static model nodes with matrixAutoUpdate off; getBytes progress, sound probe/streaming split at 20 s; triggerStep's cube-switch settling (bounded passes).
- The template's engine needs no copy of its own (it is //#use stubs).

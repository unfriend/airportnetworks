# Chunk 24: studio engine parts e6v..e7h (stream, loops, trails, walks, goggles, explore, upload, direct, lite, pics, viewer, examples, colour, seqview)
Read: tools/studio/engine/e6v_stream.js (331 lines, 25.0 KB)
Read: tools/studio/engine/e6w_loops.js (339 lines, 22.6 KB)
Frame loop (e10_app.js:190-235): behaveStep, itemsStep (-> loopStep e6_items:956, streamStep :958), trailStep, cpkStep, gogStep, settingsStep, svStep, exStep, paneStep; walkStep when X.view==='walk'; vwDraw when viewer open.
- streamStep (e6v:156) / loopStep (e6w:154): return at once when no watch/no loop: free when unused. OK.
- loopStep count-in: `new THREE.Vector3()` per beat only (e6w:164), fine.
- streamSig (e6v:310) / loopSig (e6w:334) are folded into paneSig (e7_explore:857) -> check how often paneSig runs (paneStep).
- e6v: ~260 of 331 lines are card/editing UI (streamBlocks, stPickBlocks, ITEM_ACT) -- page/edit only. e6w: ~120 lines card UI.
Read: tools/studio/engine/e6x_trails.js (238 lines, 16.2 KB)
Read: tools/studio/engine/e6y_walks.js (258 lines, 18.1 KB)
Read: tools/studio/engine/e6z_goggles.js (184 lines, 12.8 KB)
- trailStep (e6x:120, from e10_app:218) unused: loops all items (TRAIL_KINDS.includes + rec.trail) + GL.items.updateWorldMatrix(true,false) -> cheap, fine.
  Used: per frame per trail: `T.last=[x,y,z]` array alloc (e6x:90), one {x,y,z,t,s} object per sample (60/s), `T.head={..}` object per frame (e6x:95),
  `T.pts.shift()` O(n) per expired sample (e6x:141), `[...TRL.map.values()]` (e6x:149), and `T.pts.concat([T.head])` copying up to len*60 (600) entries per trail per frame (e6x:166).
  trailHands allocs `new THREE.Vector3` + array + string key per hand per frame (e6x:105,107,114). Upload range is v-limited (good).
  -> ring buffer of Float32 per trail, reuse head slot, iterate pts then head without concat. gain low-medium (GC in headset with hand trails on).
- gaitStep (e6y:176): no allocations, binary search; fine. gaitInfo once per clip (48 mixer samples, allocs Vector3s) - one-off.
- gogStep (e6z:50): two loops over all items every frame even with no goggles (gogScreens items loop e6z:141 with WeakMap lookup per model; isGoggles loop e6z:53). Cheap.
  With a GameScreen material: gogDraw builds 5 strings + join per frame (e6z:161-171) but canvas redrawn only on change (sig) - fine.
- e7_explore.js 1-500 read: TABS/X state, exploreStep (per frame, loops DEF), orbitStep (per frame when flying: f.map allocates 6-elem array per frame, only during a fly), frameScene, paneBlocks (scene/add/upload/paint/item/items), fromBlocks, itemSub, itemCard, itemBlocks start.
  paneBlocks is block-description UI for page AND headset (shared), so not page-only; but Add pane's convert/pics rows and Upload tab are page-only. Items pane: itemCard per item allocates (placedBox + new Vector3 per object card: e7:344) — only when pane is rebuilt.
- e7 500-1107 read. KEY: paneStep (e7:1055, called every frame from e10_app:228, page AND headset) calls paneSig() (e7:857) every frame:
  a ~110-field array incl. liteSig, paintSig, cpkSig, playSig, seqSig, pressSig, sendSig, streamSig, loopSig, recSig, animSig, exSig (maps EX.list, e7g:242),
  JSON.stringify(X.texAdd..), [...STU.whole].join, [...STU.cutF].join, and [...STU.items.values()].map(...).join('') (a string per item), joined with '|'.
  Render is throttled to 150 ms (e7:1063) yet the sig is built every frame. In a headset paneSig+animSig are built a SECOND time per frame by the
  explore panel's signature (e9_panels.js:243). With 100 items: ~250+ short strings/arrays per frame x2 -> GC churn in a 8-14 ms budget.
  Change: skip paneSig while now - X.drawn < 150 (it cannot render sooner anyway), and let the headset panel reuse paneLast for the frame; longer term a revision counter bumped by dirty() sources.
- renderPanes (e7:1036): skipped while presenting (good, v136). On a page: rebuilds whole pane innerHTML; fine at <=7/s.
- buildExplore (e7:858-989): ~105 lines of CSS (#stuCpk, .stu-plan upload rows, .stu-drop...) inlined in a template string: page-only, parsed in a headset too (~9 KB).
Read: tools/studio/engine/e7_explore.js (1528 lines, 150.3 KB)
- e7 1107-1528: rayPick/visitPick/insidePick (shared), page canvas input (bindCanvas), Walk view grab, clickAt, walkStep (per frame in Walk view only, no allocs), TransformControls (tcSetup/tcRead/tcAttach), liveBlocks.
- pointermove while editing on a page (e7:1225-1228) calls pagePick -> GL.world.updateMatrixWorld(true) for the WHOLE scene + raycast on every mouse event, unthrottled
  (the non-edit hover path at e7:1216 is throttled to 100 ms). Same in grabLook (e7:1334). Page-only; gain low-medium on big scenes (900k-tri test scene: proxies only, but the full matrix walk per event).
- tcRead allocates Eulers/arrays per objectChange (drag only) - fine.
Read: tools/studio/engine/e7b_upload.js (1051 lines, 82.1 KB)
- No per-frame work. Lines 446-1051 (UP state, upPlan/upRow/upVideo, uploadBlocks/uploadHTML/texRows/uploadBind/UP_ACT) = 47.8 KB is the Upload pane: page only
  (pickTab refuses 'upload' in XR or &visit, e7:854; UP_ACT gated !XR.on && !OPT.visit, e7:779). rateOf/probeFile/hasPicture also upload-only (~4 KB).
  Shared helpers used elsewhere: upSend/upPost (voice, scan, paint, pics, examples), safeSeg, freeName, saveFile, monoWav (e6j_voice), convertFile/texGo (lite, puppet: headset too).
- glbFor() (e7b:51) is O(glbs x files) and re-run per pane build (sceneLists, itemBlocks e7:396 per object card, itemCard via C.stands memo) - only on pane rebuild, fine.
- uploadBind adds document dragover/drop listeners in every session incl. headset/visit (they return early) - harmless.
Read: tools/studio/engine/e7c_direct.js (87 lines, 5.8 KB) - R2 upload links; a 60 s timer (linksSoon) only while the relay gives signed links; fine. Page and headset (Fewer triangles saves from a headset).
Read: tools/studio/engine/e7d_lite.js (436 lines, 31.6 KB)
- liteStep (e7d:317, from paneStep every frame): two `if (FT.id)/(CT.id)` - free when unused. liteSig (e7d:334) joins 15 fields every frame inside paneSig.
- Fewer triangles/Change texture are page AND headset (edit only): not a split candidate except liteRow (Upload rows), LITE_RANGE up:* and liteBind (page sliders), ~4 KB.
- thumbOf (e7d:404-429, "for tests", 1.9 KB) and liteState/trisOf: test-only code shipped to every device (pattern repeated across parts: *State() for STUDIO.* test hooks).
Read: tools/studio/engine/e7e_pics.js (409 lines, 29.0 KB)
- No per-frame step (pvJobs runs queued shots in a headset frame only when asked). pvShot (e7e:110) does a sync readRenderTargetPixels of 512x512 + a per-pixel JS loop (262k px) - only when a picture is made (convert/Make pictures): a stall of tens of ms, acceptable on a page; from a headset (Fewer triangles Save) it lands inside an XR frame (pvShotSoon) -> one long frame, said nowhere. low.
- Picture fetching/tiles are shared (headset Add/Items panes draw them). Page-only: Make pictures (pvMissing/pvMakeAll/pvMakeOne, ~3.5 KB).
- tileFor canvases cached by key (TILE map never cleared: bounded by kinds x colours, fine).
Read: tools/studio/engine/e7f_viewer.js (463 lines, 31.8 KB)
- Whole file is page-only (canView() refuses XR; header: "Pages only, never in a headset"). 31.8 KB a headset parses for nothing.
- vwDraw (e7f:206, from e10_app:230 only while VW.open): vwApply loops meshes+maps per pass (no allocs), two passes side by side, a wire pass re-renders the scene with overrideMaterial: fine for a page tool.
- While the viewer is open the studio's whole frame (updateSets, behaveStep, itemsStep, trails, paneSig...) still runs, only render is swapped (by design: the room goes on).
Read: tools/studio/engine/e7g_examples.js (246 lines, 17.9 KB)
- exStep (e7g:135, from e10_app:225 every frame): exLeave (cheap guard) + exSaw: for each example a SRC.scenes.find + a template-string sig per frame (e7g:91) even when no copy is under way.
  exSig (e7g:242, inside paneSig every frame) again runs exOnRelay+exPart per example (2-3 more scans of SRC.scenes) and exWhy(). Small (3 examples) but pure per-frame garbage;
  folds into the paneSig fix; exSaw could run only when the relay's listing changes (listScenes) instead of each frame.
Read: tools/studio/engine/e7h_colour.js (390 lines, 22.7 KB)
- cpkStep (e7h_colour:122, from e10_app:219): returns at once when no picker open. cpkSig (in paneSig) '' when closed. pickersTick throttled 50 ms, patches a strip not the card: good.
- Page popover (cpkPageOpen..cpkWheel, e7h_colour:143-300) is page-only (~10 KB); drawPicker/cpkXr* headset; maths shared.
Read: tools/studio/engine/e7h_seqview.js (322 lines, 22.1 KB) - all page-only (svWant refuses XR).
- svStep (e7h_seqview:221, from e10_app:224 every frame): svWant() cheap when no sequence selected. While the lane view is open: getBoundingClientRect of #explore's parent + clientWidth/clientHeight every frame (forced layout right after renderPanes' innerHTML writes) and a 14-field sig string; canvas redraw only on change (33 ms while playing). Page-only, low-medium.
Comments in this chunk: 92 KB full-line + 19 KB trailing of 488 KB (23%). Shipped stories/studio.js: 471 KB of 2.33 MB is full-line comments (incl. vendor licence headers).

# FINAL (ranked)
1 paneSig every frame, twice in a headset [perf-frame] gain med, risk low, confirmed: e7_explore.js:857 via paneStep e7:1061 (e10_app:228) and panelTick->sigMain e9_panels.js:127/243.
2 ~170 KB page-only + ~90 KB edit-only code parsed by every (visiting) headset [perf-load] gain med, risk med, confirmed sizes.
3 471 KB full-line comments shipped in studio.js [perf-load/repo] gain med, risk low-med.
4 trails per-frame allocs (concat etc.) [perf-frame] low-med.
5 lane view layout reads per frame [perf-frame, page] low.
6 pointermove pagePick unthrottled full matrix walk [perf-frame, page] low.
7 exSaw/exSig per-frame scans [perf-frame] low (fold into 1).

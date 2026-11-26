# Chunk 42: ovary section set, pass engine/sets, start of pet
Read: packages/ovary/src/sets/section.js (869 lines)
notes: section.js update() L706-771; step(K.showMs(dt,4)) at L707 runs the stain/objects generators while shown.
 stain() L76-109: per pixel mix() x3-4 (new arrays L86-88), inside()->rad() reduce w/ destructuring closure L44; SA 1024^2 + SB 512^2 = 1.31M px.
 objects() L171-244: at() L19 clones a Matrix4 per bead/part; mix() per bead.
 hubsAt() L530 cache keyed on exact age -> recomputed every frame while section_age eases (kindN over OBJ ~180, pairW over LK with PAIRS.map).
 small per-frame arrays: L719 [mats], L724 Math.max(...hi), L729 [SA,SB], L749 setRGB(...arr), anchors inA return arrays.
OVARY DIAGNOSIS (draft):
 timeline: story 270 s; 25%=67 s donors (charts shown, section hidden), 50%=135 s methods a+10 (section shown: tiles=1, feat ramping), 75%=202 s trends (organ shown, section hidden).
 => alloc tracks the section set's unfinished build (fresh load seeked): shown -> update L707 step(K.showMs(dt,4)) (4 ms/frame on a page = the measured 3.5 ms JS mean); hidden -> idle via buildTurn (e2_scene buildTurn, 2-8 ms by turns).
 node replica of stain() for section A (scratchpad r42/stain*.mjs, 4 ms slices): 400 ms CPU, ~615 MB garbage (~5.9 MB per 4 ms slice), 617 scavenges.
   rad() L44 reduce((s,[k,a,p])=>...) destructuring: ~350 MB of it (loop: 267 MB). mix() arrays L86-88: ~75 MB more (scalar: 192 MB, 325 ms). rest: boxed doubles from non-inlined nz()/inside() returns.
 objects(): builder pushes 17 numbers/vertex into plain JS arrays (look.js L88-120), then toF32 L123 does out.set(src.slice(i,i+CH)) = 1.5 MB slice per chunk; at() L19 clone per part.
 worst frame candidates: tex.needsUpdate L108 (1024^2 RGBA + mipmaps upload in one frame), m1/m2 first draw upload (shown sets are not PRIMEd).
Read: packages/ovary/src/shot.mjs (27), sweep.mjs (26), story.json (22): shot/sweep differ from pass's only in the key; 30 such copies across packages/*/src (repo-cost).
Read: packages/pass/src/build.mjs (121): cuts airports+spatial main.js into pass (globe/cell duplicated in shipped pass/main.js; known by design).
Read: packages/pass/src/engine/e1_head.js (18), e2_scene.js (152), e2_text.js (213), e3_story.js (286), e4_explore.js (676)
 pass e2_scene: updateSets has no buildTurn/PRIME (hidden sets idle(dt) each, older engine form); tellFish L142 calls GL.world.updateMatrixWorld(true) per frame + toArray/filter/map arrays; followView L132 v.slice per frame. Small.
 pass e4 exploreStep L53: exploreTargets builds 3 objects per frame (Object.assign of params + explore(c) + out over DEF): small.
Read: packages/pass/src/engine/e5_xr.js (103), e6_panels.js (214), e7_app.js (282)
 pass e7 frame(): world matrices updated 3x a frame on a page: tellFish (e2 L144 updateMatrixWorld(true)), renderer.render, and L178 GL.world.updateMatrixWorld(true) again after render (render already did it). L163 Object.assign({},S,..) per frame in a headset.
 e6 sigMainX L7: JSON.stringify(X.ctl)+JSON.stringify(X.out) + join each time sigMain is asked (per frame in a headset in explore, if panelTick polls) - small strings.
Read: packages/pass/src/sets/fish.js (1039): sim in typed arrays, grid kNN, 30 Hz steps, ranged uploads - good. Minor: sharkStep L435 builds [dx,dy,dz] 3x per shark per step; centre() L807 allocates arrays per step; load: 150 warm-up steps at build (L860). Per-pixel: dome+surface+bed+fish all run waterCol() (noise) - fill cost on Quest, plausible not measured.
 pass engine lacks PRIME (texture/buffer upload before first show): e2_scene updateSets L49-60 only idle(); globe first shown at sky a+7 (147 s) ~= the pass 50% worst frame 30.4 ms (plausible: airports globe land texture + 18,858 route buffers uploaded on first draw).
Read: packages/pass/src/sets/globe.js (364): wraps cut-out airports globe; per-frame update allocation-free; probe onBeforeRender per eye fine. Load: setup(VIE) runs the SEIR + buildArcs at build, facts() runs setup again (same key: cached).
Read: packages/pass/src/sets/cell.js (392): ~125 lines of German role strings (ROLE_DE) inline; update builds a small `list` per frame for setActors (8 points) - fine.
Read: packages/pass/story.json (22)
Read: packages/pass/src/harness.html (103): 15 per-package harness.html copies (1,439 lines), pet vs ovary differ by 27 lines, pet vs micro 17 (repo-cost: one tools/engine/harness.html taking ?pkg=).
Read: packages/pass/src/props.json (1259 lines, 24.6 KB): hand-kept catalogue; 19 such files = 434 KB; repeats code-derived lists (params with defaults, views with numbers, all 541 cell anchor names, controls, buildMsNode) - checked pass+pet views/params/controls: currently match code. Could be generated (scan the set's exports in node like test-sets does) leaving only shows/notes by hand.
Read: packages/pass/src/test-sets.mjs (256): fine; needs gen/ from build first (documented L6).
Read: packages/pet/src/build.mjs (39): ~same as ovary/build.mjs except SET_FILES and the micro gallery cut. src() L12 resolves '../' against tools/pet (does not exist since v187); the comment "a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay" is stale in 14 build.mjs files. 15 near-identical build.mjs -> one tools/engine/buildstory.mjs reading a SET_FILES list.
Read: packages/pet/src/data/gen_data.mjs (270): writes sets/data.js 130 KB, of which synth (a seeded synthetic cohort: rows 36.6 KB + residual pairs 56.8 KB) = 95 KB (73 %). Deterministic from seed 658 + Figure 2A matrix (in data): could be computed at load (chol/inv 11x11, 658 rows, 4 OLS fits: a few ms) instead of shipped in pet/main.js (721 KB).
Read: packages/pet/src/engine/e1_head.js (22), e2_scene.js (24, no trailing newline, harmless: files expanded one by one), e5_xr.js (46), e3_story.js (355): story text inline in template literals (fine); nothing per-frame here.
Read: packages/pet/src/engine/e4_explore.js (437), e6_panels.js (90), e7_app.js (163): pet uses the shared parts (frame, updateSets with BUILD/PRIME); per-frame explore work is small objects only. Pass by contrast forks buildScene/updateSets/frame/dispose in its own engine (e2 L5-60, e7 L113-183): no PRIME, no fadeDepth.
Read: packages/pet/src/harness.html (89): drifted fork of ovary's (no named cams, no function labels, no with=, no nofinish). Stale copied comments: pet harness L20 example "set=atp&p=atp_build" (an lbi set), L46 "the motor set's heart" (nmd); ovary shot.mjs L3 example "p=atp_assemble" (lbi); ovary harness says "shows one alone" twice.
Read: packages/pet/src/props.json (1267): see finding on garbled/truncated catalogue text.

=========================== FINAL (brief's shape) ===========================
# Chunk 42: ovary section set (+ ovary tools), pass engine/sets/tests, start of pet (build, data generator, engine)
(Read lines: see the notes above; every manifest file read in full.)
## Findings
### Ovary's 2.5 MB/frame is the section set's unfinished build, run from update() each frame   [perf-frame]  gain: high  risk: low  sure: plausible (cause in code confirmed; attribution to the measurement needs one re-measure)
Where: packages/ovary/src/sets/section.js:707 (update -> step(K.showMs(dt,4))), :31-36 step(), :76-109 stain(), :171-244 objects(); hidden: idle() :813 via buildTurn (tools/engine/e2_scene.js:57)
What: At 50 % (t=135 s, Methods a+10, section shown) update() runs the JOBS generators for 4 ms a frame until built (mean JS 3.5 ms = that budget). At 25 %/75 % the section is hidden and builds by turns in buildTurn (2-8 ms). A node replica of stain() for section A (1024^2; scratchpad r42/stain*.mjs, 4 ms slices) took 400 ms and threw ~615 MB of garbage (~5.9 MB per 4 ms slice, 617 scavenges): rad() L44 `o.waves.reduce((s,[k,a,p]) => ...)` (destructuring closure, per pixel) ~350 MB of it; the mix() arrays L86-88 ~75 MB; the rest boxed doubles from nz()/inside(). SB (512^2) adds a quarter more; objects() then clones a Matrix4 per bead (at() L19) and pushes into plain JS arrays.
Change: re-measure after `finish()` on every set (sweep.mjs L16 does this) to confirm. Then: rad() as a loop or a 2,048-entry angle table (smooth in th); mix() inlined as r,g,b scalars and the constant mix(C.eosin,C.nucleus2,0.45) hoisted; replica: 615 -> 192 MB, 433 -> 325 ms. Best: draw the stain once on the GPU (a fragment shader of the same value noise into a WebGLRenderTarget, nuclei as points) - ~0 CPU, no garbage, no 1024^2 upload. Same pattern in organ.js:397 (shown at 75 %, its colour callbacks build mix() arrays per vertex, L91-104) - chunk 41's file.
### Builder's toF32 copies through 1.5 MB slices   [perf-frame]  gain: medium  risk: low  sure: confirmed (code)
Where: packages/ovary/src/sets/look.js:122-123 (geometryGen, called from section objects() L235-241 and organ.js)
What: `out.set(src.slice(i, i + CH), i)` allocates a 196,608-number JS array (~1.5 MB) per chunk for each of 6 attributes (17 numbers a vertex), on top of the builder keeping P/N/Cl/Ce/O/E as plain JS arrays (8 B a number, regrown by doubling).
Change: copy with a plain index loop (no slice); better, size Float32Arrays up front (count vertices per add) and write into them directly.
### Ovary worst frame: texture and buffers uploaded on the frame the build ends   [perf-frame]  gain: medium  risk: low  sure: plausible
Where: section.js:108 (`tex.needsUpdate` after stain: 1024^2 RGBA + mipmaps), :243 (m1, m2, fades, masks added to a shown set); tools/engine/e2_scene.js:230/39 (primeCheck only for hidden sets)
What: a set that finishes while shown skips PRIME, so its new buffers (hundreds of thousands of vertices x 17 floats) and the stain texture go to the GPU in the next render: fits the 28.5 ms worst frame.
Change: when step() finishes on a shown set, queue the new meshes/texture on PRIME (or renderer.initTexture and a yield before g.add).
### Pass forks the engine's scene loop and misses PRIME   [perf-frame]  gain: medium  risk: medium  sure: plausible
Where: packages/pass/src/engine/e2_scene.js:5-60 (own buildScene/updateSets), e7_app.js:113-183 (own frame)
What: updateSets has no primeCheck/primeStep/buildTurn/fadeDepth; the globe (airports land texture, 18,858 routes) is first drawn at sky a+7 = 147 s, next to pass 50 % (152 s, worst frame 30.4 ms). frame() also updates world matrices three times (tellFish e2:144 updateMatrixWorld(true), render, e7:178 again after render).
Change: take the shared parts (//#use updateSets with PRIME) with the fish's life-size holder as a hook; drop the post-render updateMatrixWorld.
### PET ships a synthetic cohort it could compute   [perf-load]  gain: low-medium  risk: low  sure: confirmed
Where: packages/pet/src/data/gen_data.mjs:72-137, 239 -> sets/data.js
What: synth is 95 KB of data.js's 130 KB (rows 36.6 KB, residual pairs 56.8 KB), deterministic from seed 658 and Figure 2A (already in the data); pet/main.js is 721 KB.
Change: move chol/inv/OLS (60 lines) into the organs set and compute at load (11x11, 658 rows: a few ms).
### 15 near-identical build.mjs / harness.html, 30 shot/sweep copies; stale shared comment   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: packages/*/src/build.mjs (pet vs ovary differ only in SET_FILES and a gallery cut), harness.html (15 files, 1,439 lines; pet vs ovary 27 lines, drifted: pet lacks named cams, function labels, with=, nofinish), shot.mjs/sweep.mjs (differ only in the key)
What: build.mjs L12 resolves '../' against tools/<key>/ (no such folder since v187); the comment "where shared sources stay" is stale in 14 files. Copied comments are wrong: pet harness L20 example `set=atp&p=atp_build` (an lbi set), L46 "the motor set's heart" (nmd), ovary shot.mjs L3 `atp_assemble`; ovary harness says "shows one alone" twice.
Change: one tools/engine/story-build.mjs (SET_FILES in story.json or a 5-line config), one shared harness (?pkg=), one shot/sweep taking the key.
### props.json: a 434 KB twin of docs/props.md with garbled, truncated text   [md | bug]  gain: medium  risk: low  sure: confirmed
Where: packages/pet/src/props.json:572 (organs/bars "frames": "above the column), unit (the foot of the ÷ aorta line ..."), :97 ("0-0.45 the scanner moves left"), :115, :498 (cut at "13"), :308/:326 (label texts run together), :1039 labelCount 122 with 35 listed; 19 files, 434 KB; docs/props.md 225 KB says "same facts"
What: the catalogue looks extracted once and kept by hand; tools/lowpoly/minis.mjs:78-79 puts shows/frame/meaning on the design room's cards, so the cut sentences show there. Params, views, controls and anchor lists (pass cell: all 541 anchors) repeat code (checked pass and pet: they match today).
Change: generate the code-derived fields with a node pass like packages/pass/src/test-sets.mjs (build each set, read params/cam/controls/anchors/labels); keep only shows/frame/size/notes by hand; make docs/props.md generated from the JSON or drop one of the two.
## Not worth changing
- section.js update's small per-frame arrays (L719, L724, L729, L749) and hubsAt() recomputing each frame while section_age ramps (~150 objects, ~300 links: ~0.02 ms).
- pass fish.js: typed arrays, grid kNN, 30 Hz steps, ranged uploads; only tiny arrays in sharkStep/centre. globe.js and cell.js updates are allocation-free or 8-point. test-sets.mjs fine.
- pet e3/e4/e6/e7: per-frame work is small objects; dispose leaves the icon timer harmless (iconStep checks LOAD.gone).
- pet e2_scene.js has no trailing newline: harmless, the build expands each file separately.

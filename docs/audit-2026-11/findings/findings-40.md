# Chunk 40: micro sets, mutation story, nmd build
Read: packages/micro/src/sets/hier.js (867)
Engines: micro, mutation, nmd src/engine/e1..e7 ALL differ from tools/engine (forked per story) -> diff later.
- hier: orgMesh ShaderMaterial created late in buildOrgans() (hier.js:472-485, called from update->orgStep l.653 / idle l.863) AFTER the load's warm() pass (tools/engine/e7_app.js:270-291 compiles only materials present at load) -> program link at the first frame it draws: likely one of micro 50%'s 3 links.
- hier update() (l.652-743) per frame: loops NN=133 nodes x NCO=6 with CO[k].gi.includes(i) (l.696) ; rewrites IM (16 floats x NI), nCol, nA, 5 halo attrs every frame, then K.upload diffs whole arrays (l.739-741) -- upload word-compare is O(len) per attr per frame ~ NI*(16+3+1+3+3+1+1+1) words. Nodes set to zero but still processed when hier hidden? update only when set shown (check engine).
- hier labels: 2 per node (266) + per-organ ones; at() closures allocate posOf -> new [0,0,0] (l.639) and cur.cp[k][j].slice() (l.791) per visible label per frame; small.
- threads: NE=~200 edges x 19x6 verts=~23k verts additive transparent, 2 uniform-driven; aH refill only on focus crossfade (sig l.681) - fine.
- bandMat vertex shader has `uniform vec4 uB[${NBD}]` array (l.538) - fine.
Read: packages/micro/src/sets/organs.js (550)
- Measured (node, this machine): ORGAN3D full models of 29 organs = 46,164 tris / 23,023 verts / 1.2 MB buffers, built in ~400 ms CPU (sliced by the engine's ORGJOB); lite copies = 11,556 tris in 33 ms more.
- hier.js:474 merges the FULL models for its organ ring (organs ~0.06-0.09 m radius); atlas.js:797 already uses {lite:true}. Using lite in hier saves ~34.6k tris per eye; full models only worth it for a close-up.
- Late shader link: hier.js:478-480 / atlas.js ~797 create new ShaderMaterials after load; warm() (tools/engine/e7_app.js:270) only sees load-time materials and primeStep (tools/engine/e2_scene.js:88) skips objects with no program ("drawing it would link one here") -> each organ mesh links its program on the first frame it is SHOWN. Fix: after buildOrgans() while hidden, call renderer.compile on a stand-in scene with that mesh (as warm() does), or create the material at build() with placeholder geometry so warm() compiles it. uP/uQ array size is baked into GLSL (shader(n)), so hier (29) and atlas (40?) give two different programs.
- Shared cost "three times": ORGAN3D is runtime code, pasted into micro, pet, topo main.js (organs.js 550 lines/~45 KB each). pet strips the SETS.organs gallery (pet build.mjs:20-22); topo does NOT strip it (gallery dead code shipped in topo main.js; micro ships it too). Runtime: pet builds only its list (O3.build), topo only the liver (want(LIVER)); micro all 29 + 29 pictures.
- picture(): per-triangle string `rgb(...)` + array map (l.469-470) - ~1.6k strings per organ picture, once; fine (sliced).
- Option (load): bake the 29 meshes at build time into a data file (1.2 MB raw float; quantised Int16 ~0.4 MB) vs 400 ms CPU in slices: probably keep runtime (bytes matter more), note only.
Read: packages/micro/src/sets/slide.js (815)
- slide update() (l.726-748) is uniform-only per frame (good); parts hidden by .visible (l.737-742).
- drawGauge (l.665-686) called by update() each frame while gauge visible; key = share.toFixed(1)|age: during the age sweep (20->70) the key changes almost every frame -> 512x196 canvas redrawn (8 fillText, arcs) and re-uploaded (~400 KB RGBA) per frame for the whole sweep. Quantise the age key (whole years already; share to 0.1 changes ~84 times) - medium on Quest (texSubImage of 400 KB each frame).
- wash fragment shader (l.307-376): 9 fwidth + 3 texture reads + atan/exp/pow per pixel over the whole section, transparent; it is drawn whenever any of tl/ft/ad/dm/fc > 0 -> large overdraw area in a close view; plausible GPU cost, not measurable here.
- "copied from packages/lbi/src/sets/tissue.js, which this set must match" (l.19-69): layers()/plane()/noise copied by hand -> drift risk; repo-cost (export from tissue.js api instead).
- harness-only ghost (l.689-692, 746-747) shipped in story.
- Load: sharesAt() twice (l.133,143) ~420 x ~170 domAt each + tiles 480x64 domAt + PCA 3x60 iterations on 16x16: tens of ms total, once; fine.
Read: packages/micro/src/shot.mjs (27), packages/micro/src/sweep.mjs (26), packages/micro/story.json (22)
- shot.mjs/sweep.mjs: 15 copies each (packages/*/src/), differing only in the story key and comment (diff micro vs mutation: 3 lines). One tools/engine/shot.mjs <key> would do. micro shot.mjs:3 example query "p=atp_assemble:1" is the lbi story's set (stale copy).
- story.json fine.
Read: packages/mutation/src/build.mjs (31), engine/e1_head.js (21), e2_scene.js (9), e5_xr.js (8), e3_story.js (470)
- Engines are NOT forked: each e*.js is a `//#use part ...` list expanded from tools/engine by parts.mjs, plus story-specific code (e3_story: NARRATION_SYNC, CH, FIT, panel HTML, keys). Good design; diff -q "differ" is expected.
- build.mjs: ~15 near-identical copies (mutation vs micro: only target key, SET_FILES, a regex strip). `src` maps '../x' to tools/<key>/ (tools/mutation, tools/micro no longer exist; path.join normalises so it works) and the comment "from tools/<dir>/, where shared sources stay" is stale in 14 build.mjs files. A shared tools/engine/build-story.mjs(key, SET_FILES) would cut ~14 x 30 lines.
- e2_scene.js last line has no newline: e5's first `//#use` glues on in cat (harmless).
- e3_story storyCam (l.448) -> standView calls view('tree','stand') each frame in a headset (new array per frame; tiny).
Read: packages/mutation/src/engine/e4_explore.js (434)
- exploreStep (l.99, called each frame in explore mode) -> exploreTargets (l.79) allocates per frame: Object.assign({}, s.params), ctlArgs object (ctlValue per control), s.explore(c) result, maybe tree params copy, and `out` over all DEF keys (~70 params). ~5 objects of up to 70 keys a frame; targets change only on a control/pane change -> cache keyed on X version. low gain (same pattern in other stories' e4).
- syncNums (l.264) on each slider input rebuilds 3 live panes' innerHTML incl. stemLiveHtml -> api('stem').results(...) (check stem.js caching).
Read: packages/mutation/src/engine/e6_panels.js (132), e7_app.js (175)
- sigMainX (e6 l.6) builds a signature with JSON.stringify(X.ctl) + 12 fields joined; called by the headset panel's redraw check each frame (sigMain) -> a few hundred-byte string a frame in a headset; a version counter bumped by setCtl/setTime/... would do. low.
- e7: enterExplore tries every option of every control calling s.explore (once); fine. dispose traverses GL.scene; fine.
Read: packages/mutation/src/harness.html (106) - harness, fine (per-frame `new THREE.Vector2()` l.~75 is harness-only).
Read: packages/mutation/src/props.json (2234 lines, 44.8 KB; data: the design room catalogue of 4 sets, params with meaning/usedInStory; skimmed as data). 19 such files = 434 KB in packages/*/src/props.json, pretty-printed one value per line (usedInStory arrays spread over lines); read by tools/lowpoly/build.mjs, design build, smoke, move/publish. An agent grepping a set's params hits these too.
Read: packages/mutation/src/sets/letters.js (371)
- Immediate-mode set: update() (each frame while shown) rebuilds every tube/ball/tile instance through LK pools (begin/add/end) - helix 24 bp x (2 rungs + 3x2 backbone segs) ~ 250 tubes; piles up to 400 tiles with a setFromAxisAngle + premultiply each (l.273-277) and up to 400 M.sample calls (l.226) each frame even when nothing moves (explore with reads=400). Scratch reused, no per-frame allocs except label text closures (l.317, 322: new arrays per frame) and anchors pileX `_t.slice()` (l.309).
- Cost depends on LK.*.end() uploading (see look.js).
Read: packages/mutation/src/sets/look.js (557)
- `upload(attr, n)` (l.103-121) is a verbatim copy of tools/engine/kit.js upload (K.upload) - also in qubits/look.js and topo/look.js: 3 copies + kit. Use K.upload.
- pool/tubes/rings/balls/boxes/halos (l.122-252) copied from packages/qubits/src/sets/look.js (QLOOK, "grown from"); a shared tools/engine part for instanced pools would serve qubits, mutation (and topo's look).
- Pools refill and diff-upload every frame (end()): CPU cost is the per-add Matrix4.compose + Quaternion.setFromUnitVectors, plus upload's word compare over the used range (16 floats/instance). Fine at a few hundred instances.
- depth() (l.543) sets depthWrite on every material each frame - cheap.
- tile = 200 tris; letters' piles up to 400 tiles = 80k tris for 9 cm tiles; a 12-tri box for pile tiles beyond the top layer would do (low).
Read: packages/mutation/src/sets/mmath.js (646)
- Pure maths with caches (prepCache, pairCache, rebuildCache). rebuildCache (l.559) is unbounded: every "Rebuild again" (seed 1..999) x pair favour w (1..30) adds an entry (~15 KB: samples 2000x6 + good + post); a long explore session can keep MBs. Cap it like TREES (e4 l.53, 8 entries). low.
- Header l.1-52 (52 lines) is rationale for example values: fine as science record, but it is the third copy of numbers that also live in SPEC/README? (not checked) - low.
Read: packages/mutation/src/sets/rule.js (583)
- update() (l.443) per frame while shown: pyramid() (l.143) recomputes the whole path polyline (NT=64 points, each mixAt = 2 x M.path/expRow) every frame although it depends only on (model, start) and the switch; machine() calls turnAt (2 x angles -> 2 x expAll 4x4) 5 DIAL ticks + amax + gears each frame. ~200 small exp evaluations a frame: < 0.1 ms; cache the polyline per switch state if ever needed. low.
- shareRing is copied verbatim from letters.js (l.91-109 vs letters l.72-92): move into MLOOK. repo-cost low.
- drum uses MeshStandardMaterial (l.77): lit built-in, compiled by warm() at load with lights; fine.
Read: packages/mutation/src/sets/stem.js (532)
- Load: the "about a million" cloud (l.64-87) builds NCLOUD = 60,000 points at set build (60k K.unit + 5 rng each, attributes ~2.2 MB: pos/col 3 floats, size, alpha, delay) for a ~6 s moment of chapter 6 (stem_count 2..3) and explore Count; same picture with 15-20k points (the label carries the number). perf-load medium-low.
- Fields: 6,000 instanced quads with the ladder in the fragment shader; fillFields only on data change (l.386). Good.
- update() calls set.group.updateMatrixWorld() each frame (l.296) for camL; cheap.
- smallStem/... pools refill per frame like the other sets; fine.
Read: packages/mutation/src/sets/tree.js (500)
- update(): uAt bisection (18 steps) per branch per frame (18 branches) + per-branch uniform arrays; rows of 8 tiles at every growing branch and tip; family() caches geometry per seed (6 kept, disposed beyond) - good. Branch glass: 14 x 2 x 33 x 10 verts additive double-sided. Nothing per-frame worth changing.
- `const GL = new Float32Array(L8)` (l.203) shadows the engine's global GL inside the set's closure: harmless now, a trap for anyone adding engine calls in this set (rename e.g. GLOW). bug-risk low.
Read: packages/mutation/src/shot.mjs (27), sweep.mjs (26): identical to micro's but for key (see above).
# Chunk 40: micro sets (hier, organs, slide), the mutation story's sources, nmd build
Read: packages/micro/src/sets/hier.js (867)
Read: packages/micro/src/sets/organs.js (550)
Read: packages/micro/src/sets/slide.js (815)
Read: packages/micro/src/shot.mjs (27), sweep.mjs (26), story.json (22)
Read: packages/mutation/src/build.mjs (31), engine/e1_head.js (21), e2_scene.js (9), e3_story.js (470), e4_explore.js (434), e5_xr.js (8), e6_panels.js (132), e7_app.js (175)
Read: packages/mutation/src/harness.html (106), props.json (2234 lines, 44.8 KB: catalogue data, structure checked, not read line by line)
Read: packages/mutation/src/sets/letters.js (371), look.js (557), mmath.js (646), rule.js (583), stem.js (532), tree.js (500)
Read: packages/mutation/src/shot.mjs (27), sweep.mjs (26), test-mmath.mjs (309), story.json (22)
Read: packages/nmd/src/build.mjs (29)
Engines: the e1..e7 files of micro, mutation and nmd all differ from tools/engine/, but they are not forks. Each is a `//#use part ...` list that tools/engine/parts.mjs expands, plus the story's own code. Nothing to fix there.

## Findings
### Micro at 50%: a shader link and a 1.2 MB upload on the frame the hierarchy's organ ring first shows   [perf-frame]  gain: high  risk: low  sure: confirmed (mechanism) / plausible (that it is one of the 3 links measured)
Where: packages/micro/src/sets/hier.js:472-486 (buildOrgans, orgStep), 863 (idle); tools/engine/e7_app.js:270-291 (warm); tools/engine/e2_scene.js:83-90 (primeStep)
What: At micro 50% (atlas chapter, story time about 145-161 s) the atlas_net/hier_grow hand-over runs and `show('hier', a+19)` fires (packages/micro/src/engine/e3_story.js:372-374). hier's organ mesh and its ShaderMaterial are made late, in buildOrgans(), which runs from idle() while the set is hidden. The load's warm() only compiles materials that exist at load. primeStep skips any object whose material has no program yet ("drawing it would link one here"). So the first frame that draws hier links the organ program. That same frame also uploads 23,023 verts / 1.2 MB of buffers (29 full models, 46,164 triangles; I measured this by running organs.js in node). atlas.js:797 makes its organ material the same late way. Its uniform array size (shader(n): uP[n], uQ[n]) is different, so it is a second program.
Change: at the end of buildOrgans() (and the same spot in atlas.js), compile the new mesh at once. Use what warm() does: GL.renderer.compile on a stand-in scene that holds the lights and this one object. Then push the mesh onto PRIME.q, so its buffers go up a frame early, while it is still hidden. Better: a K helper "compileLate(set, obj)" that the engine provides, so every late-built mesh uses it.

### hier draws the full organ models where atlas uses the lighter copies   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: packages/micro/src/sets/hier.js:474 (`O3.merged(...)` with no `{ lite: true }`); compare atlas.js:797
What: The ring's organs are 0.06-0.09 m across (ORAD, l.102), yet each frame draws 46,164 triangles of full models. The lite copies (organs.js:361 lite(), vertex clustering) come to 11,556 triangles for the same 29 models and take about 33 ms more to build, once. That is about 35k triangles less per eye in every hier frame (the 505k figure at 50%).
Change: `O3.merged(ids, { lite: true })` in hier. Keep the full models only for close-ups, where there are any.

### hier's node spheres: 168 instances of a 280-triangle sphere   [perf-frame]  gain: medium-low  risk: low  sure: confirmed
Where: packages/micro/src/sets/hier.js:387 (`SphereGeometry(1, 14, 10)`), 416 (NI = 133 graph nodes + the contact domains)
What: That is about 47k triangles per eye for dots of 1.3-3 cm radius. Instances that are off (aA < 0.004) still run the vertex shader. The threads add another ~44k (204 edges x 18 segments x 6 sides x 2, l.267).
Change: SphereGeometry(1, 10, 7) or IcosahedronGeometry(1, 1) (80 triangles), since halos and shading carry the look. 4 sides on the threads would also do.

### hier per-frame JS (what calls it: GL.sets.hier.update from the engine's updateSets every frame while hier_a > 0.003)   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: packages/micro/src/sets/hier.js:652-743; labels 781-801
What: update() loops 133 nodes x 6 organs with `CO[k].gi.includes(i)` (l.696). It rewrites all instance arrays (16+3+1 floats per node plus 5 halo attributes) and K.upload word-compares each one (l.739-741). There are about 300 labels (2 per node, l.781-785). Each visible label's `at` makes a new array (posOf l.639; `cur.cp[k][j].slice()` l.791). Probably 0.2-0.5 ms in all, so it is not the main part of micro's 2.1 ms; atlas.js, which runs in the same frames, should be checked by its reader.
Change: a precomputed per-node mask of contact organs (a Uint8 bitset) in place of includes(). Pass `out` arrays to the anchors.

### slide's age gauge redraws its canvas and uploads it about every frame during the age sweep   [perf-frame]  gain: medium-low  risk: low  sure: confirmed
Where: packages/micro/src/sets/slide.js:665-686 (drawGauge), called from update() l.743 every frame while gauge.visible
What: The key is the share to 0.1 % plus the age in whole years. As slide_age ramps from 20 to 70 the key changes most frames. Each change redraws the 512x196 canvas (arcs, 5 fillText) and re-uploads ~400 KB RGBA (gTex.needsUpdate). This costs time in a headset during the age chapter.
Change: key the redraw on the whole-year age only, or at most 10 times a second. Better still, draw the number with the label system and keep the canvas static.

### ORGAN3D is pasted into three stories; topo and micro also ship the harness gallery   [perf-load, repo-cost]  gain: low-medium  risk: low  sure: confirmed
Where: packages/micro/src/sets/organs.js (550 lines, ~45 KB) in micro, pet and topo main.js; gallery l.507-550; pet's build strips it (packages/pet/src/build.mjs:20-22), topo's does not (packages/topo/main.js:2430)
What: The cost paid three times is the code bytes and their parse, not a build-time computation. At run time each story builds only what it needs: pet builds its list (O3.build), topo only the liver (want(LIVER)), and micro all 29 models plus 29 pictures, ~400 ms of CPU in slices. The SETS.organs gallery is dead code in topo and micro.
Change: strip the gallery in every build (move pet's strip into the shared builder below), or split it into organs-gallery.js that only harness.html loads. Optional: load ORGAN3D from one shared file instead of pasting it.

### 19 near-identical build.mjs, and 15 copies each of shot.mjs/sweep.mjs, with a stale path rule   [repo-cost, md]  gain: medium  risk: low  sure: confirmed
Where: packages/*/src/build.mjs (19 files; mutation vs micro differ only in key, SET_FILES and one regex), packages/*/src/shot.mjs and sweep.mjs (15 each, differing only in key and comment)
What: 14 build.mjs files say "(a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay)". Their `src` resolves '../' against tools/<key>/. Neither tools/micro, tools/mutation nor tools/nmd exists; it works only because path.join normalises '../../packages/...'. micro's shot.mjs:3 gives the example query "p=atp_assemble:1", which is the lbi story's set. An agent fixing one builder has to fix 19.
Change: one tools/engine/build-story.mjs <key> that reads SET_FILES (and the strip list) from a small per-story JSON or from story.json. One tools/engine/shot.mjs <key> and one tools/engine/sweep.mjs <key>. Fix the comment.

### MLOOK copies the kit's upload and qubits' pools; shareRing is copied twice   [repo-cost]  gain: low-medium  risk: low  sure: confirmed
Where: packages/mutation/src/sets/look.js:103-121 (upload is tools/engine/kit.js upload line for line; also in qubits/src/sets/look.js and topo/src/sets/look.js), 122-252 (pool, tubes, rings, balls, boxes, halos grown from qubits' QLOOK, 72 diff lines over ~150), rule.js:91-109 = letters.js:72-92 (shareRing)
Change: use K.upload. Move the instanced pools into a tools/engine part that qubits and mutation (and topo's look) all use. Put shareRing in MLOOK.

### Mutation: the 60,000-point "about a million" cloud is built at load for a few seconds of chapter 6   [perf-load]  gain: low  risk: low  sure: confirmed
Where: packages/mutation/src/sets/stem.js:64-87
What: 60k K.unit samples plus 5 rng calls each, and ~2.2 MB of attributes, built in the stem set's load step. It is shown only while stem_count is between 2 and 3, and in explore's Count view.
Change: 15-20k points (the label says the number), or build it in idle() as hier builds its organs.

### Mutation explore and panel signatures allocate every frame   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: packages/mutation/src/engine/e4_explore.js:79-109 (exploreStep -> exploreTargets, every frame in explore mode); e6_panels.js:6 (sigMainX: JSON.stringify(X.ctl) + 12 fields, per headset panel check)
What: Each frame builds about 5 objects of up to ~70 keys (params copy, ctlArgs, s.explore(c), out) plus a JSON string, although the targets change only when a control changes. The same pattern is likely in the other built stories' e4.
Change: cache the targets and the signature, keyed on a version counter that setCtl, setTime, setW, readOut and the other setters bump.

### slide.js keeps a hand copy of tissue.js's geometry   [repo-cost]  gain: low  risk: medium  sure: confirmed
Where: packages/micro/src/sets/slide.js:18-69 ("copied from packages/lbi/src/sets/tissue.js, which this set must match")
What: layers(), plane(), noise1, the aggregate and the vessels are duplicated. If tissue.js changes, the domain wash comes out wrong and nothing checks it.
Change: have tissue.js expose them through its api(), or put them in a small shared file that both sets paste.

## Bugs seen
- packages/mutation/src/test-mmath.mjs:307: `ok(ms < 1000, ...)` fails the maths test whenever the machine is busy (a timing check inside a correctness test). Report the time without failing on it.
- packages/mutation/src/sets/tree.js:203: `const GL = new Float32Array(8)` shadows the engine's GL inside the set. Harmless today; a trap later (rename it GLOW).
- packages/mutation/src/sets/mmath.js:559: rebuildCache has no bound (seed 1-999 x w 1-30, ~15 KB each) in a long explore session. Cap it, as TREES (e4 l.53) and dataCache (stem l.204) are.

## Not worth changing
- The mutation sets refill instanced pools every frame, but there are no per-add allocations and uploads are diff-ranged. letters, rule, tree and stem do a few hundred adds a frame, well under 0.1 ms each. rule's 64-point path is recomputed each frame but is cheap.
- slide.update is uniforms only, and hidden parts are set visible=false. Its fields, bars and links are single instanced draws.
- tree caches the family geometry per seed (6 kept, the rest disposed). stem refills its fields only when the data changes.
- organs.js's picture() builds strings per triangle, but it is sliced and runs once per organ.
- story.json for micro and mutation, harness.html, and nmd build.mjs (same template as above): fine.
- props.json: 19 files, 434 KB of pretty-printed catalogue (one value per line). This only matters if agents grep it; it is not used at run time.

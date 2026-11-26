# Chunk 44: ppicell sets, proteins/qubits sources, robots engine (start)
Read: packages/ppicell/src/sets/cell.js (1120 lines)
- cell.update (called each frame by the set loop): follow(want(S)) builds an object + wkey JSON.stringify per frame (1003-1015); setFocus builds an 8-field template key per frame (678); new Set + CX_EX.filter + [...cl].sort + cxDraw key list.join(',') per frame (1041-1044, 876); with cell_cxon and no pick, CX.forEach adds EVERY complex each frame -> sort+join of ~all complexes per frame; C.objs() allocates 2 nested arrays per frame (953,1053).
- Draws from cell: 10 shell meshes (pm, nucleus, nucleolus, ER, golgi, mitos, lysos, endos, peroxs, cytoskeleton lines; 136-175) + dotsZ, dots, routes, flags, flagsG (5) + pick extra/focus/cx dots/lines (up to 4). Points drawn twice (dotsZ depth pass 627 + colour pass).
- Shell tris: pm 128x80 (~20k), nucleus 96x64 (~12k), ER 3x80x56 (~27k), golgi 5x64x10 (~6k), mitos 14x40x20 (~11k), 20 balls 28x18 (~20k) => ~100k tris, all transparent DoubleSide with rim shader; the plasma membrane covers the whole screen from inside (overdraw).
- Memory: D.pos/D.cC are plain JS number arrays (doubles, push(...p)) for every dot, plus D.keys string per dot ('loc|inst', 'loc|b<at>', 'loc|g<k>') and a Map of them (443-444); JC caches every judged (g,sd) pair (up to 6) per network; NETS keeps KEEP=4 + story's nets, each with its own D/JC; mergeCopies keeps aO (copy of position) + aP for all shells, incl. non-ER/mito ones whose shader never reads aO (79: own=!!kind) -> e.g. pm 10k verts x12 B unused aO? (pm not merged; lysos/endos/peroxs/golgi merged carry unused aO+aP).
- pickCopy (917): linear scan over nMain dots per pick call; fine if only on press/hover - check caller.
Read: packages/ppicell/src/sets/ball.js (248 lines)
- At build, ball calls cell.api().net(2) (10): follow(want({..., cell_show: 2}), false) builds the whole background at once for show 2 (judge + dots + lines); the cell's own update then asks show 0 -> NETS key has no `show`, so N.show !== w.show -> net.build() again (cell.js 996), all dots and lines rebuilt; every later change of cell_show in the story rebuilds again (D arrays, Map, strings). Load: at least two full builds.
- ball keeps for the whole story: sweep geometry of every link of P.E (6 floats + 2 u16 per link, 174-176) plus sKey Float32Array(P.E), home/rad, hairball dots (ND = net.n + unplaced, 9 attributes) and links (NL = drawn background). 4 draws (dots, links, hiLines, sweep), only 2 normally visible.
- update per frame: cheap (uniforms, setDrawRange). highlight() loops all P.E links on a ball_hi change only (step param): fine.
Read: packages/ppicell/src/sets/balls.js (108 lines)
- BALLS.mat defines transparent/depthWrite as getters on uA (56-57): three.js r128 sorts by material.transparent each frame and rebuilds program keys? (transparent is not part of the program key in r128, fine). cloud.tick re-uploads position+aRad whenever any place() was called that frame (92): see crowd/lens for whether place() runs every frame.
- `reach` uses Math.max(...balls.map()) (11): build only.
Read: packages/ppicell/src/sets/crowd.js (118 lines)
- Fine: jiggle in shader, one Points draw (~WANT 3,600 molecules; comment says "near 40,000" balls), packing sliced at load (prep 25 ms). Per frame: one 1-float aA re-upload (105) even when unchanged; trivial. Keeps P.balls (array of 5-arrays per ball, ~40k small arrays) and P.mols forever after build (78): could drop P.balls after the typed arrays are filled (only stats/anchors read P.mols).
Read: packages/ppicell/src/sets/lens.js (150 lines)
- Per frame (updateSets -> SETS.lens.update while lens_a > 0.003): the purification cloud `mix` = 11 torn membrane pieces of ~NL=3,786 lipids x 3 balls (minus tears; ~9-11k balls) + 36 proteins: mix.place() for every piece and protein (122-129) applies a quaternion per ball in JS and mix.tick re-uploads position + aRad of the whole cloud every frame (balls.js 84-92), even when lens_focus shows lens 1 or 3 (lens 2 has inner.visible false, 113) and even while it stands still (b loop phase). Same for nbM (30 proteins). Also ~170 small arrays a frame from v3.add/lerp (117,124,128,140).
- 3 rings x (torus 10x64 + disc) + yeast sphere + dna + 4 molMesh models + glow + mix + halo + nbM + tags + bait blob: ~20 draws while lens shows, though only one ring is visible at a time after focus (the others g.visible false: fine).
Read: packages/ppicell/src/sets/models.js (22 lines)
- molPrep's first call fetches all 20 models (MOL_ALL) at once (9): good for latency, but every model is fetched and parsed before ready even ones only chapter 8 uses -> part of the 18.3 MB to ready; check models/ folder sizes.
Read: packages/ppicell/src/sets/next.js (190 lines)
- Build: SLAB packs up to BMAX 42,000 balls (sliced prep, fine); slab cloud (sc) places every molecule once at build (155) - good. But sc.tick(t) runs every frame (179) even when s <= 0.01 (sc hidden): only sets uniforms (no upload unless moved), cheap.
- halo cloud: when next_halo > 0.01, every frame place() for 9 x 15 molecules + re-upload (174-175), even when h has reached 1 and nothing moves (g = 1 constant): ~135 v3.add/mul arrays + full position/aRad upload per frame; could skip when h unchanged.
- vol: when next_vol > 0.01, per frame loop over every voxel (cells ~ (2/0.07)^3*0.52 ~ 12k) writing aA and re-uploading (182), even once v = 1 (constant). Called by SETS.next.update each frame.
- slabMat.opacity *= s / memMat.opacity *= ... (180): relies on K.fade resetting opacity each frame (setAlpha) - fine if so.
- 9 halo meshes (one each, 101) + hc + slab + slabEdge + mem + sc + vol = 15 draws; halos could be one instanced/merged draw.
Read: packages/ppicell/src/sets/pdata.js (56 lines)
- PDATA keeps D (= PPI_DATA, the base64 strings: links 942k chars, sym 85k, com 48k, pl/main 36k each) for ever (48: `D` in the returned object) besides the decoded arrays: ~1.2 MB of strings kept twice-over (source text in main.js + PPI_DATA object). E = 141,296 links (942k/4*3/5). Only D.kinds/D.places read later? -> drop D after decode.
- Repo: packages/ppicell/src/narration-v204-old.mp3 is 6.0 MB committed in the tree (not served, kept "until then" per HANDOVER.md:87) - clone weight; the git history keeps it anyway.
Read: packages/ppicell/src/sets/pnet.js (596 lines)
- Heap: GJ = new Int8Array(1<<20).fill(-1) (156): 1 MB allocated and filled at load for a pair cache keyed by two 10-bit masks; only a few hundred distinct pairs ever occur -> a Map (or 2^20 lazily) saves 1 MB.
- judge() (162-177) allocates a, b Int32Array(E) + cls, why Uint8Array(E) + lSp: with E = 141,296 links ~1.45 MB per judgement; cell.js JC caches each (g, sd) judged (up to 6 per network) and NETS keeps up to KEEP=4 networks + the story's -> up to ~6 x 1.45 MB per network kept. a/b as Int32 where locations < 65,536 (Uint16 would halve).
- select() (221-237) builds JS arrays of link numbers per verdict for all E links (groups[] of up to 141k numbers) on every build; transient.
- The pairs/wwiznet parsing is bounded and only on user action: fine.
Read: packages/ppicell/src/sets/psides.js (108 lines)
- Fine: decoded once over PDATA; masks() cached per reading. ofProt: an array per protein (13,460 small arrays, 64). Keeps PPI_SIDES (S, 335 KB source) referenced via returned `S`.
Read: packages/ppicell/src/sets/pwiz.js (328 lines)
- Export-only code (27 KB source) pasted into main.js and parsed at every load; used only by the Network tab's Export and the CLI. Could be loaded on demand (repo/load cost low).
- hairball() (49-77) is a copy of ball.js 16-43 (same seeds, Float64 vs Float32): two copies of one layout to keep in step; ball.js could call PWIZ.hairball.
Read: packages/ppicell/src/sets/sites.js (174 lines)
- Fine mostly: 3 InstancedMesh chains (one draw each), molMesh models (grb2, tp53, stat3 x3, jak2, p300 at lod 0 = finest always), 2 envelope spheres 64x40 with in-shader holes, 3 tori. Per frame (SETS.sites.update): ~3 v3.lerp arrays + spread into position.set, Math.max(...nowA), G2.setHighlight each frame (cheap uniform set). The GRB2 shell is K.pointsGeo(deg GRB2 = 871 points).
- lod: 0 forced on 6 models (90, 98, 99, 112, 114): every model at its finest even when small/far; note for triangles.
Read: packages/ppicell/src/sets/walls.js (220 lines)
- Overdraw: 6 space meshes (SP, 44-51) + lumens are added once and never hidden: SETS.walls.update only sets uA0/uA1 to 0 when a space is not lit (166-170), so while walls_a > 0 the cytosol sphere (0.985 x cell) and the Outside sphere (1.12 x cell), 48x32 each, plus the nucleus/mito/small-organelle merges and the ER/Golgi lumens (3 x 72x48 non-indexed + 5 caps) are all drawn as transparent rim-shaded layers at alpha 0: up to 7 draws and ~2 full-screen transparent layers of pure fill cost. Set mesh.visible = on > 0.001 || w > 0.
- Per frame (pv > 0.01): chain 24 instance matrices via v3.lerp/way() arrays (~100 small arrays) + instanceMatrix upload; fine.
Read: packages/ppicell/story.json (21 lines) - fine.
Read: packages/proteins/src/props.json (8 lines), packages/proteins/story.json (22 lines) - fine.
Read: packages/qubits/src/build.mjs (31 lines)
- Comment 11-12: `src` maps '../x' to tools/qubits/x "where shared sources stay"; tools/qubits does not exist after the move (only '../engine/kit.js' uses it, resolving to tools/engine/kit.js via ..). Misleading; say '../engine/kit.js -> tools/engine/kit.js'. Each built package has its own near-identical build.mjs (qubits 31, robots 27 lines): could be one shared tools/engine builder taking SET_FILES/ENGINE lists.
Read: packages/qubits/src/engine/e1_head.js (21), e2_scene.js (6), e5_xr.js (8): //#use lines + story constants only (layering OK).
Read: packages/qubits/src/engine/e3_story.js (359): panel copy, keys, cues. FACTS computed once at load: anOf(NETI, ..., L) for L 1-3 found + random = 6 QMATH.analyze runs at load (92-107) - see qmath cost.
Read: packages/qubits/src/engine/e4_explore.js (277), e6_panels.js (110), e7_app.js (171)
- e7_app.js: APP, initEnd and the returned shell object (inputs, caption, xrPose, collab, peek, dispose: ~90 lines) are hand-copied in 19 packages' src/engine/e7_app.js (grep "peek: src => eval(src)" = 19) rather than a //#use part: a fix to dispose/initEnd must be made 19 times (repo-cost, risk of drift).
- e6 sigMainX builds a JSON.stringify(X.ctl) signature each call (7); sigMain runs per panel tick in explore mode: small.
- e4 renderAll rebuilds 4 panes' innerHTML on every pick (fine, user-driven).
Read: packages/qubits/src/harness.html (92) - fine (test page; per frame new Vector2 in harness only).
Read: packages/qubits/src/props.json (1598 lines, 29.7 KB)
- Pretty-printed one array element per line: 1,598 lines for 3 sets; 40 of its 78 label entries are "(computed text)" at "point"/"fn" (no information), garbled text "the gallery now , lesson(L) the lesson's names" (606), cube_focus "usedInStory": [-1, -1] (553). Same facts kept three times: sets/*.md manifests, src/props.json, docs/props.md. 19 props.json = 472 KB in the repo. Compact JSON (arrays on one line) would cut ~60%; dropping "(computed text)" labels and anchors lists that the build can read from code cuts more. Only tools/lowpoly/build.mjs (cards) reads it.
Read: packages/qubits/src/sets/look.js (180)
- Good: instanced pools, diff-upload of only changed words (upload, 52-66). One draw per pool. depth() loops set.mats every frame (cheap).
Read: packages/qubits/src/sets/chart.js (141)
- Fine: 5 pools = 5 draws; per frame ~100 small arrays (p, [..]) and Math.max(...G.map()) (68) in SETS.chart.update; EX/exGates computed by QMATH.analyze at build (cached).
Read: packages/qubits/src/sets/pairs.js (350)
- The pairs triangle (pp: NP = 28,680 points, gp: 240) is never hidden (61-63): after the map replaces the grid (tri = 0), both still draw every frame and run the vertex shader for 28,920 points per eye (vA < 0.004 throws them off-screen). SETS.pairs.update sets slate.visible but not pp/gp: add pp.visible = gp.visible = tri > 0.003. Each also carries an all-zero position Float32Array(NP*3) = 344 KB unused (55).
- update: walkerAt() 22x/frame + arc arrays: ~60 small arrays a frame (fine). chip.children.forEach opacity per frame (fine).
Read: packages/qubits/src/sets/cube.js (496)
- SETS.cube.update calls warm(1) every frame while the cube shows (290) until all 4 networks' cuts, 6 analyses each, layouts and objects are made; warm()'s do/while always runs at least one generator step, and the header says a step is "a couple of milliseconds": so ~2+ ms of JS on every frame of the cut/coarse chapters until done (plus idle() while hidden). Check step sizes; give warm a budget that can be 0 in a headset (or run only while hidden / in explore).
- Per frame allocations in update: targets() makes 3 new Float64Array(N*N) (257, 262) + A.order.slice(0, NB) twice (263, 353), lessonOf() regex+filter when the lesson shows (287), frame()/drawString() arrays for up to 20 small cubes (each P[] of 8 corners + Q.entry arrays), add3/norm/cross arrays: several hundred short-lived arrays a frame. Hoist D/G/R into cur (sized 64), cache order slices per analysis.
- 4 pools + 3 planes + per-network pts/lns: draw count fine.
Read: packages/qubits/src/sets/qmath.js (529)
- Load: two O(n^2) force layouts run straight through at build: pairs.js 93 Q.layout(2D, 50 iters) and cube.js 154 buildNet(DEF) -> Q.layout(3D, 45 iters) (LAY[DEF] not warmed yet): n=320 -> ~51k pairs x 95 iters = ~4.9M pair-force steps in two load steps, plus the default cut (modes: 100 subspace iterations, k-means, 5,040 labellings). Fine on desktop, likely tens of ms per step on a Quest; layoutG exists (yields per iteration) and could be used through the build budget.
- entry() returns a fresh [re, im] array (344-349); cube.update calls it per corner/edge per string every frame (cube.js 235, 240, 266, 320, 344): hundreds of 2-arrays a frame. Return the real part only (all callers take [0]).
Read: packages/qubits/src/shot.mjs (27), sweep.mjs (26), test-qmath.mjs (122), story.json (22)
- 15 packages each carry their own shot.mjs and sweep.mjs (30 files, all md5-different only by story key/paths) plus a harness.html: one tools/engine/shot.mjs + sweep.mjs taking the key would replace them (repo-cost; and fixes made once).
- test-qmath fine.
Read: packages/robots/src/build.mjs (27): same stale comment as qubits ('../<dir>' -> tools/robots, which no longer exists; e1_head.js:5 also says "the set in tools/robots"). Near-copy of qubits/build.mjs.
Read: packages/robots/src/engine/e1_head.js (13): header line 5 stale ("the set in tools/robots": sets are in packages/robots/src/sets).
Read: packages/robots/src/engine/e2_scene.js (172)
- applyView -> orbitPose (screen camera, every frame): while the low view is blocked, tries up to 14 azimuths (AZ_TRY) x youGap + sightBlocked, each marching the sight line every 0.1 m against every furniture polygon (inPoly2) (56-59, 68-75), then up to 14 inRoom() checks each 5 floorPoint ray casts with fresh arrays (29-33, 83-87). Re-done every frame while CAMV.off itself stays blocked. Cache per room/2 Hz.
- tellRobots: GL.world.updateMatrixWorld(true) forces the whole world tree's matrices every frame (164) before the renderer does it again; head.toArray() allocs. Low.
- buildScene/resize/updateLight are forks of tools/engine parts (own copies, not //#use): robots' camera is life-size specific, OK, but updateLight/track duplicate engine lines 143-155.
Read: packages/robots/src/engine/e3_story.js (194)
- Own forks of buildCamera/storyCam/anchorOf (life-size waypoints with g): justified. updateLive (per frame) reads coverage() (O(1), robots.js 2033) and builds a short string: fine. storyCam linear scan of ~10 waypoints + slice per frame: fine.
Read: packages/robots/src/engine/e4_explore.js (234): sfxLive reads state() every 100 ms with filter/map/sort (fine); pile ids as toFixed strings (fine).
Read: packages/robots/src/engine/e5_xr.js (285): room read at most 2/s, xrSeen without allocation (good). xrPoint per controller per frame: XR.panelMeshes.filter() + toArray() allocs (shared pattern).
Read: packages/robots/src/engine/e6_panels.js (76): trailing empty "// --- narration --" header (76-77) left after a move.

## Draw-call tally for ppicell at 25% (chapter 3, walls; measured 97 both eyes = ~48 per eye)
cell: 10 shells + dotsZ, dots, routes, flags, flagsG = 15. walls: 7 space/lumen layers + receptor 2 patches + 3 models + 9 small "sides" shapes (each its own MeshStandardMaterial via solid()) + pore 4 + import 8 = ~33. => ~48 per eye: matches. Triangles: walls' gs model is forced lod 0 (walls.js 66; gs.mol 866 KB, the largest model) plus ~30 merged 48x32 spheres in SP (~92k) and the cell's shells (~100k).

# ===== FINAL (consolidated) =====
# Chunk 44: ppicell sets, proteins/qubits sources, robots engine (start)
(Read lines for all 42 manifest files are above. The pass story's sets were not in this manifest.)
## Findings
### ppicell walls: seven transparent layers drawn at alpha 0   [perf-frame] gain: high risk: low sure: confirmed
Where: packages/ppicell/src/sets/walls.js:16-22, 27-51, 164-170
What: SETS.walls.update (called each frame while walls_a > 0.003) sets only uA0/uA1 of the six space meshes and the ER/Golgi lumens and never hides them, so the cytosol shell (0.985 x cell) and the Outside shell (1.12 x cell) plus the merged nucleus, 7 mitochondria, 20 small organelles and lumens are drawn as rim-shaded transparent layers even when alpha is 0: 7 of the ~48 per-eye draws at 25%, two of them full-screen overdraw, ~100k triangles.
Change: mesh.visible = on > 0.001 || w > 0 for each SP entry and the lumens.
### ppicell lens: ~11k balls re-placed and re-uploaded every frame, also for hidden rings   [perf-frame] gain: high risk: low sure: confirmed
Where: packages/ppicell/src/sets/lens.js:60-78, 120-141; balls.js:82-93
What: the purification cloud is 11 torn membrane pieces of NL = 3,786 lipids x 3 balls (minus tears) + 36 proteins; SETS.lens.update calls mix.place() for every piece and protein each frame (JS quaternion per ball) and mix.tick() re-uploads position and aRad of the whole cloud, even when lens_focus shows ring 1 or 3 (ring 2's inner.visible false, 113). Same for the 30 neighbours (nbM). ~170 small arrays a frame from v3.add/lerp.
Change: skip place()/tick for a lens whose inner is hidden; move the pieces' drift into the shader (a per-ball piece index + 11 uniforms) so nothing is uploaded per frame.
### ppicell load: the background network built twice, plus every cell_show change   [perf-load] gain: medium-high risk: low sure: plausible
Where: packages/ppicell/src/sets/ball.js:10; cell.js:984-998, 1087, 934-940
What: ball's build calls cell.api().net(2), which runs follow(... cell_show: 2 ...) and a full build (judge 141,296 links, ~18k+ dots with string keys in a Map, two line geometries); NETS' key leaves out `show`, so the cell's first update at show 0 sees N.show !== w.show and rebuilds all dots and lines; each story change of cell_show rebuilds again. Part of the 2.1 s to ready.
Change: build show 2 once and draw show 0/1 as subsets (draw ranges or a per-link class uniform cut-off: routeMat/flagMat already have aT/class data), so show changes never rebuild.
### ppicell heap: judgement caches, a 1 MB pair table and the data kept as strings   [perf-load] gain: medium risk: low sure: confirmed
Where: pnet.js:156, 162-177; cell.js:431-441, 443-445, 965-968; pdata.js:8, 48
What: GJ = Int8Array(1<<20) filled at load for a few hundred mask pairs (1 MB); each judgement allocates a, b Int32Array(E) + cls, why (E = 141,296: ~1.45 MB) and JC keeps up to 6 per network, NETS up to 5 networks; dots live in plain JS arrays (D.pos/D.cC doubles via push(...p)) with one string key per dot in a Map; PDATA keeps D (PPI_DATA base64 strings: links 942k chars, sym 85k, com 48k) after decoding.
Change: GJ as a Map; a/b as Uint16 (< 65,536 locations); keep only the judgement on show (and the story's); D.pos as a growing Float32Array; numeric keys (loc * K + inst) instead of strings; drop PDATA.D after decode (keep kinds/places).
### ppicell cell.update: keys, sets and sorts built every frame   [perf-frame] gain: medium risk: low sure: confirmed
Where: packages/ppicell/src/sets/cell.js:1003-1015, 1035-1062, 678, 876, 953
What: each frame SETS.cell.update builds want(S) and wkey = JSON.stringify, setFocus's 8-field template key, a new Set of complexes + filter + [...cl].sort() + cxDraw's list.join(','); with cell_cxon and no pick, CX.forEach adds every complex, so the sort and join run over all complexes each frame; C.objs() allocates two nested arrays.
Change: compare the few params against last frame's numbers and return early; cache the complex list key by (cxs, cxp, cxon, pp, pc).
### ppicell next: constant work while halos/volume stand still   [perf-frame] gain: medium risk: low sure: confirmed
Where: packages/ppicell/src/sets/next.js:171-182
What: with next_vol > 0.01 SETS.next.update rewrites aA for every voxel (~12k) and re-uploads each frame even at v = 1; with next_halo > 0.01 it re-places 135 molecules and re-uploads the halo cloud each frame even at h = 1. 9 halo spheres are 9 draws.
Change: only when v/h changed; one merged or instanced halo mesh.
### ppicell draws: many tiny lit meshes and finest-only models   [perf-frame] gain: medium risk: medium sure: plausible
Where: walls.js:53, 66, 98-107, 133-136; sites.js:90-114
What: ~33 of the ~48 per-eye draws at 25% are walls: 9 "sides" shapes, rings, patches, each its own MeshStandardMaterial (PBR) via solid(); the Gs model (gs.mol 866 KB, the largest) is forced to lod 0 "always", as are six models in sites.js: likely much of the 553k triangles.
Change: merge the static sides/patches into one vertex-coloured mesh; let lod follow distance except in the headset close view.
### qubits pairs: 28,920 points never hidden   [perf-frame] gain: medium risk: low sure: confirmed
Where: packages/qubits/src/sets/pairs.js:51-63, 249-255
What: the grid of pairs (pp, NP = 28,680 points) and its gene row are never set invisible; after the map takes over (tri = 0) both still draw each frame and run the vertex shader for every point per eye. Each also holds an all-zero position array (344 KB).
Change: pp.visible = gp.visible = tri > 0.003 in SETS.pairs.update.
### qubits cube: warming and allocations on every frame   [perf-frame] gain: medium risk: low sure: plausible
Where: packages/qubits/src/sets/cube.js:155-175, 257-263, 290, 353; qmath.js:344-349
What: SETS.cube.update calls warm(1) every frame while the cube shows; its do/while always runs at least one generator step ("a couple of milliseconds" by its own comment) until 4 networks' cuts, 24 analyses and 3 O(n^2) layouts are done. Per frame it also makes 3 Float64Arrays (targets), A.order.slice twice, and hundreds of [re, im] arrays from QMATH.entry (all callers use [0]).
Change: warm only while hidden or in explore (or check the budget before the first step); hoist the arrays into cur; an entryRe() returning a number.
### qubits load: two O(n^2) force layouts run straight through   [perf-load] gain: low-medium risk: low sure: plausible
Where: pairs.js:93; cube.js:116, 154; qmath.js:473-513
What: n = 320 -> ~51k pairs x (50 + 45) iterations in two load steps, plus the default cut (100 subspace iterations, k-means, 5,040 labellings). layoutG yields per iteration but build uses the blocking form.
Change: run layoutG through the build budget (BUILD/buildTurn) as cube.js already does for the other networks.
### robots: the low camera's search repeats every frame   [perf-frame] gain: low-medium risk: low sure: plausible
Where: packages/robots/src/engine/e2_scene.js:29-33, 51-61, 66-90
What: applyView -> orbitPose (screen, each frame) tries up to 14 azimuths, each marching the sight line every 0.1 m against every furniture polygon, then up to 14 inRoom() checks of 5 floorPoint casts each with fresh arrays, every frame while the chosen side stays blocked.
Change: re-search at most a few times a second; cache inRoom for the camera's cell.
### Repository cost: copies and dead weight   [repo-cost] gain: medium risk: low sure: confirmed
Where: packages/ppicell/src/narration-v204-old.mp3; packages/*/src/props.json; packages/*/src/{shot,sweep}.mjs; packages/*/src/engine/e7_app.js; packages/ppicell/src/sets/pwiz.js:49-77
What: a 6.0 MB old narration in the tree (unserved, kept "until then", HANDOVER.md:87); 19 props.json = 472 KB, pretty-printed one element per line (qubits: 1,598 lines, 40 "(computed text)" labels, garbled "the gallery now , lesson(L)..." at 606) and the same facts again in sets/*.md and docs/props.md; 15 shot.mjs + 15 sweep.mjs differing only by key; APP/initEnd/return block hand-copied in 19 e7_app.js; PWIZ (27 KB, export only) pasted into main.js and its hairball() a copy of ball.js:16-43.
Change: move the old mp3 out of the tree; compact or generate props.json; one shared shot/sweep tool taking the key; an //#use part for e7's shell block; load PWIZ on demand and let ball.js call PWIZ.hairball.
### Stale comments   [md] gain: low risk: low sure: confirmed
Where: packages/qubits/src/build.mjs:11-12, packages/robots/src/build.mjs:9-10, packages/robots/src/engine/e1_head.js:5, e6_panels.js:76-77
What: "shared sources from tools/<dir>" / "the set in tools/robots": tools/qubits and tools/robots no longer exist (sets are in packages/<key>/src/sets); robots e6 ends with an empty "narration" header.
Change: fix the lines.
## Not worth changing
QLOOK pools (diff-upload of changed words only), chart.js, crowd.js (jiggle in shader, sliced packing), next.js slab packing (sliced, placed once), psides/pnet parsing (bounded, on user action), sites.js per-frame work, robots xrRoom (≤2 reads/s, no per-frame allocation), qubits e3/e4/e6 panes (user-driven), test-qmath.

# The built stories (tour, muscle, endotype, PET, microanatomy, ovary, qubits, mutation, tissue topology, soil, CDK5, pass, flock, robots, tutorial, design room)

<!-- toc (tools/docs/toc.mjs) -->
- 32: Stories moved into packages (v185 robots; v186 qubits, mutation, flock, tutorial, endo, pet, ovary, soil; v187 micro, topo, nmd, lbi, pass) (3.2 KB)
- 67: Shared engine parts (`tools/engine/`, step 1 of the packages plan, 19 November 2026) (9.4 KB)
- 159: The tour (`packages/lbi/main.js`) is built from sets (2.8 KB)
- 199: The muscle story (`packages/nmd/main.js`) is built the same way (5.2 KB)
- 266: The endotype story (`packages/endo/`, a story package since v186) is built the same way (1.9 KB)
- 288: The PET story (`packages/pet/`, a story package since v186) is built the same way (4.9 KB)
- 336: The microanatomy story (`packages/micro/main.js`) is built the same way (2.1 KB)
- 359: The aging ovary story (`packages/ovary/`, a story package since v186) is built the same way (4.6 KB)
- 406: The qubits story (`packages/qubits/`, a story package since v186) is built the same way (2.8 KB)
- 436: The mutation machine (`packages/mutation/`, a story package since v186) is built the same way (4.9 KB)
- 484: The shape of tissue (`packages/topo/main.js`) is built the same way (6.3 KB)
- 548: The soil story (`packages/soil/`, a story package since v186) is built the same way (7.3 KB)
- 620: The CDK5 story (`packages/cdk5/`, a story package since v189) is built the same way (7.9 KB)
- 694: The pass story (`packages/pass/main.js`) is built the same way (9.3 KB)
- 780: The flock (`packages/flock/`, a story package since v186) is built the same way (5.9 KB)
- 863: The robot gang (`packages/robots/`, a story package since v185) is built the same way (4.6 KB)
- 925: The tutorial (`packages/tutorial/`, a story package since v186) is built the same way (5.1 KB)
- 975: Back into the cell (`packages/ppicell/`, a story package) is built the same way (5.2 KB)
- 1024: Invisible threads, the exposome story (`packages/exposome/`, a story package on the Experiments set) is built the same way (6.3 KB)
- 1084: The design room (`stories/design.js`) is built the same way (5.0 KB)
- 1135: From CLAUDE.md (6.4 KB)
<!-- /toc -->

Read on demand; the rules every agent needs are in AGENTS.md. The rules all the built stories share (the build budget and
`buildTurn`, `keepClear` and the 0.35 m head distance, life size, `xrCap`) are under "The muscle story ... is built the same way" and
"Shared engine parts": Grep them by name. The last section, "From CLAUDE.md", holds old rule bullets that repeat the above (the
sound-effect lines, the narration commands, the anchor rule).

## Stories moved into packages (v185 robots; v186 qubits, mutation, flock, tutorial, endo, pet, ovary, soil; v187 micro, topo, nmd, lbi, pass)

Moved by `tools/packages/move.mjs <key>` (`docs/packages-migration.md`): the sources are `packages/<key>/src/` (the
same files; build with `node packages/<key>/src/build.mjs`, then `node tools/packages/scan.mjs`), the built file
`packages/<key>/main.js` (the same code: only the comment and narration lines naming the folders changed), the
narration `packages/<key>/audio/narration.mp3` (`narrationFile()` through `HOST.pkgUrl`; the pass story's German
`narration-de.mp3` beside it, its `AUDIO` map's `de` through `HOST.pkgUrl` too), the list entry
`packages/<key>/story.json` (its place: `packages/order.json`). Key, hash, miniature, hooks and `collab.state()` are
unchanged. Shared sources stay with their owners (the lean route: no shared library yet): a build reads another
story's set from that story's `src/` by path, `'../../packages/<owner>/src/sets/<set>'` (endo: nmd's motor and data;
pet: lbi's body, micro's organs; micro: lbi's body and tissue; ovary: the body; topo: the body and the organs; soil:
topo's look, lbi's web), resolved through the moved build's `src()`; its harness loads them from
`../../../packages/<owner>/src/`. A data generator or a data test in `src/` finds the app three folders up (four from
`src/data/`). The pass story's build cuts the globe and the cell out of `packages/airports/main.js` and
`packages/spatial/main.js` (`ORIGINALS`). The sections below give each story's old notes with the new paths.

The three hand-written stories (airports, proteins, spatial) were wrapped in v187: `packages/<key>/main.js` is the old
`stories/<key>.js` (the narration literal through `HOST.pkgUrl` and the comments naming it the only changes), with no
build; edit it, then `node tools/packages/scan.mjs` (and rebuild pass after airports or spatial). Only spatial has a
`src/` (v225): `src/layout.mjs`, which stores its cell's layout (below).
`proteins.html` and `spatial.html` still redirect to `#proteins` and `#spatial`.

The cell map's layout is stored (v225): `packages/spatial/main.js`'s `solveLayout()` (the old `LAYOUT` code, unchanged;
two relaxations, about 0.1 s on a laptop, measured headless, and run before any loading card; a headset's time is
not measured) is run once by `node
packages/spatial/src/layout.mjs` (`--check`) in headless Chromium, which writes `LAYOUT_DATA` (positions as Float32,
organelle per copy as Int32, base64, with `layoutSig()` and the browser's version). The page uses it while
`layoutSig()` (the copies, places, hints, links, `TOGETHER` and the cell's organelles, fractions to 5 places) matches,
and solves as before otherwise; after editing the lists, the cell or `solveLayout()` itself (its code and constants,
the seed, the steps and the springs, are not in the signature: only `--check` sees such a change), run it, then the
pass build. Why Chromium and not Node: the
380 relaxation steps magnify last-digit differences in `sin`, `cos`, `acos` and `pow`, and Node 22 and Chromium 158
differ there (the cell came out up to 0.11 of its radius apart). So a browser whose maths differs (an older Quest
Browser, Safari, Firefox) made a slightly different cell before v225 and now shows Chromium 158's.

## Shared engine parts (`tools/engine/`, step 1 of the packages plan, 19 November 2026)

The fourteen built stories each have their own engine files (`packages/<key>/src/engine/e1_head.js` ... `e7_app.js`), copied
from one story to the next and drifted by generation (lbi, nmd, endo, flock older; micro, ovary, qubits, mutation, topo,
soil newest). What was the same, byte for byte, in two or more stories now lives once in `tools/engine/<the same file
name>.js` (340 parts: a declaration with the comment block above it; a name with more than one shared version has the
others as `name~2`, `name~3` ...). A story's engine file keeps its own code and, where it used a part, a line
`//#use name name ...`; its `build.mjs` expands those lines (`expand` in `tools/engine/parts.mjs`) in place, so the built
file is exactly what it was (every build's `--check` passed unchanged when the parts were taken out).

- To change shared engine code, edit the part in `tools/engine/` and rebuild every story that uses it:
  `node tools/engine/all.mjs` (`--check` says whether all fourteen are current). `node tools/engine/parts.mjs` lists
  which stories use each part. A story that needs its own version of a part replaces its name on the `//#use` line by
  the code itself, in its own engine file.
- Story-specific code (`CH`, `NARRATION_SYNC`, `NARRATION_ENDS`, `buildStory`, the panes, the collab state) stays in the
  story's own files: `tools/voice/narrate.mjs` and `tools/pace.mjs` write the narration tables there as before.
- The relay's `--build` sees `'../engine/` in each `build.mjs` and rebuilds every story when a part changes.
  `tools/engine/` has no `build.mjs` on purpose (the relay would take it for a story's).
- The studio (`tools/studio/engine/`) and the hand-written stories (airports, proteins, spatial) do not use the parts
  yet.
- Protein models (`tools/mol/`): the parts `MOLS molLoad molParse molMaterial molMesh molInstanced` draw the `.mol`
  files `tools/mol/build.py` makes from a story's `models.json` (`tools/mol/README.md`). A built story that uses them
  keeps its models in a folder of its own, which goes into `sw.js` `SHELL` (each file) and `relay/server.mjs`
  `APP_DIRS`, with each address fingerprinted by hand (`?v=` the `fp` in its `index.json`); packages need none of that.

**Step 1b (v168): one version of each engine family.** The versions that still differed (engine generations, and real
story differences) were brought onto one shared version each, with the story differences as small per-story
constants and hooks in the story's own engine file of the same name (a hook's default is a part named on the story's
`//#use` line; a story that differs declares a function or constant of that name itself). Nothing a story shows or does
was meant to change (`tools/engine/same.mjs` against the tree before: every paused story moment 0 to noise on desktop
and phone). A story whose version is really different keeps its own (life size: flock, robots, pass; the design room;
lbi and nmd's index-based picking; pass's languages). `node tools/engine/parts.mjs` shows who shares what.

- Headset (`e5_xr`): `xrPlaceLife(v)` (nmd's tower, endo's gap, pet's scanner), `xrCap` (nmd and endo keep clear),
  `xrLifeHome` (pass), `xrLabelH` (label height: pet, pass, and the life-size three), `xrLetGo`, `xrPressScene`,
  `xrReleaseScene`, `xrGrabScene`, `xrCarryScene` (what the trigger and grip do to the scene: globe drag by default;
  the sea, the falcon, crumbs, miniatures), `xrSceneHit` and `xrBallHit` (what a ray hits), `xrDrag`, `xrSticks`,
  `xrPosed`, `xrPointed`, `xrExtraAlpha`, `xrOnReset`, `xrOnEnter`, `xrStars`, `xrOnEnd`. Every hook is a function
  declaration (hoisted).
- Panels (`e6_panels`): `XR_TITLE`, `xrHint()`, `sigMainS()` and `sigMainX()` (the main panel's change signature: the
  story's extras and its explore part), `XR_STEP_LINES`, `XR_STEP_COL` (pet keeps ink), `FLOW_BOLD` (false only in nmd),
  `flowIcon` (pet and micro), `drawFootX`, `drawTabPane` (the story's panes behind the shared tab strip), `pickTab`.
- App (`e7_app`): `narrationFile()` (pass: by language; design has none), `frameLife`, `frameLow`, `frameFloor` (the
  shared `frame` of pet, micro, ovary, qubits, mutation, topo, soil; nmd and endo share `frame~2`).
- Story, scene, explore (`e2`–`e4`): `DEF_MORE` (the engine's own params), `LIN`, `LOG`, `FIT` (now in all fourteen:
  never declare it again), `MORPH`, `FRAME`/`frameOf`, `STRIP_FIT` (0 keeps the older framing in lbi, nmd, endo, flock,
  design), `trackHTML`.
- Arrangements (step 3, `tools/engine/SPEC.md`): the part `ARR` (`e7_app`) gives every built story and package
  `arrange: { model, apply, get }` (`ARR_API` in its returned object). It writes again, from a copy of the story's own,
  what `buildStory` built (`TR`, `ST.wp`/`yaw`/`stand`, `ST.items`, `ST.labels`, `SFXQ`, `CH`, `NARRATION_SYNC`,
  `NARRATION_ENDS`, `T_END`). Its hooks: `arrLoad()` after `buildTimeline()` (the shared `init`; ovary's own),
  `arrSkip()` after `audioFollow()` and `arrPlace()` after `updateSets()` in every `frame`, `arrVoice()` for the
  recording (`audioInit`, the packages', the pass story's `audioLang`), `arrTl`/`arrSync`/`arrFollow` in the narration's
  parts, `arrFoot` in `drawFoot`; each does nothing without an arrangement. A story with its own `frame` or `init` keeps
  those lines. Test by peek: `HOST.cur.arrange.apply({ chapters: { slide: { len: 50 } } })`, `apply(null)`.
- Known traps (safe today): a story whose set lists a `log` param needs `logMix` (only topo and soil declare it); a chip
  with `icon` needs `flowIcon` (only pet and micro declare it).
- Frame costs (v224, audit row F): `pickMemo` (`e5_xr`, used by `pickRay` and nmd's own) keeps a ray's pick while the
  ray, the world's and every set's `matrixWorld` and the story's `pickSig(out)` are unchanged (a story without
  `pickSig` tests every ray, as before; topo, soil, cdk5 and nmd have one: explore's `XS`, plus cdk5's eye and nmd's
  `tower.pickState()`, and `false` while something moves with the clock: cdk5's pulsing CDK5, nmd's cross-fades, its
  `tower.settled()`). A story whose sets pick from anything else (time, the camera, a set's own state) must add it to
  its `pickSig` or return `false`. `compileLate(o)` (`e5_xr`) compiles something made after the load with the scene's
  lights (three.js r128 keys every program by the scene's light counts, unlit ones too) and sends its textures:
  `xrWarm`, `labelSprite` and `labelSign` use it. `pageIdle(now, dt)` (`e7_app`, called after `audioSync()` in every
  `frame` but flock's, robots', pass's and the tutorial's, whose guide lives on the clock) skips a paused story's frame on a page while nothing it shows can have
  changed (its time, mode, play, the window's size, the page's and the root's classes, the theme, the clear colour, any
  input event, a set or a build job (`GL.jobPend`, set by `buildTurn`: micro's organs, topo's liver) still building or a
  model loading), draws on for 2 s of frame time after any of these (`PAGE.hold`, the sum of the drawn frames' dt, so a
  slow page draws on longer: sets that ease on the frame's dt, such as
  mutation's letters and qubits' cube, settle only on drawn frames), and draws one frame a second regardless; its quiet
  frames go on sending sets to the card (`primeStep`) and sampling the keep-clear (`xrPrep(1)`); explore mode and a
  headset are untouched. `exploreStep` snaps a param to its target once within 1e-6, so a value easing to 0 stops
  changing `pickSig`'s key. `labelRead()` (in the `_placed` part) reads the panel's and the bar's places at the start of
  the frame, before anything is written; `placeLabels` reads them itself when the frame did not.
- The same, by hand and in the sets (v224, row F's second part): `compileLate` also sends a shader's own textures (its
  `uniforms`), not only `map`. The three hand-written stories carry copies of `compileLate` (`xrWarm`, `labelSprite`,
  `labelSign`), `pickMemo` (without the sets' matrices; `pickSig`: airports and proteins the pillars' heights, spatial
  `X.iso` and the scenarios `s0..`) wrapped round `pickAirportRay`/`pickCopyRay` (the tests themselves are now
  `pickAirportWith`/`pickCopyWith`), and `pageIdle` (with `pageBusy = () => false`: they build everything in the load);
  their labels read no rectangles, so they need no `labelRead`. Spatial's `isThere` fills one scratch list instead of
  `scenNow()`'s new array a call. Airports' closures (`setClosedAttributes`) write only the airports whose flag changed
  and their routes (`GL.close`: each route's first vertex `at`, each airport's routes `rof` in `NET.adjS`'s slots, the
  flags last written `on`) and send only the stretch of the routes' flags between the first and last route touched
  (`updateRange`, widened while a stretch is still unsent); pass takes it with the globe. Pass's own `updateSets` primes
  its hidden sets (`primeCheck`, `primeStep`) as `updateSets~3` does. The micro story's organ models (`hier.js`,
  `atlas.js`) go through `compileLate` when built and into `PRIME.q` if their set was primed already; ovary's sections
  (`section.js`) send the stain when it is done and add each object mesh as it is made (one a frame while a section on
  show builds). Ovary's own `placeLabels` reads `LRECT` like the engine's.
- A reviewer's notes kept as they were, not fixed: pet's headset story panel draws uncoloured points in ink where its
  page shows amber (`XR_STEP_COL = ''`), and nmd measures a chip in the font of the one before (`FLOW_BOLD = false`).

## The tour (`packages/lbi/main.js`) is built from sets

`packages/lbi/main.js` is generated: edit the sources in `packages/lbi/src/` and run
`node packages/lbi/src/build.mjs`, never edit the built file by hand, and commit both
(`node packages/lbi/src/build.mjs --check` tells you if they are out of step). The
set contract (API, rules, performance budget, palette, shared facts) is
`packages/lbi/src/SPEC.md`; each set has a manifest `packages/lbi/src/sets/<name>.md`.

The fourth story turns an institute presentation into a tour through ten 3D
**sets** (one scene each: the interactome, a computer taken apart, the internet
and friendships, DNA and protein shapes, ATP synthase, a crowd and a Sankey
diagram for rare diseases, the tower of scales and the team, a PET body, a
tissue section). All sets share `GL.world`, are centred on the origin and are
faded in and out by the story; the camera flies between views.

- `makeKit(THREE)` (top of the file) is the shared kit `K`: seeded random
  numbers, vector helpers, and materials (`K.points`, `K.lines`, `K.rim`,
  `K.fade` for built-in lit materials) that fade with their set and size points
  in local units (`K.U.uPx`, kept current by `updateLight`).
- Each `SETS.<key> = function (K) { ... }` returns `{ group, params, update(S, t),
  anchors, labels, cam, controls, explore(c) }`. `params` are the set's
  animation tracks (names start with `<key>_`; `<key>_a` is its fade);
  `update` must depend only on the params and the time, so seeking works.
  `anchors` are named points for labels and camera targets; `labels` are the
  set's own labels with a rule for when they show; `cam` holds named views
  `[az, el, dist, tx, ty, tz]`; `controls`/`explore` drive explore mode.
- `buildStory()` keys the params per chapter (`ramp`, `key`, `show`) and the
  camera waypoints (`cam(t, set, view, spin)`); story labels are pinned to set
  anchors. In a headset `xrPlace` turns a view into the pose and scale of
  `GL.world`, so the view's target floats in front of you.
- Explore mode has a Scenes tab (any set, with its own controls, as HTML and
  canvas twins) and a Proteins tab (search, partners and routes on the
  interactome's named proteins).
- Memory (v225): the DNA set's meshes (`geoOf`) copy the used part out of their builders' doubled capacity. No
  attribute drops its array once on the graphics card (`onUpload`): three.js r128 uploads every attribute again from
  its array after a lost WebGL context is restored (`webglcontextrestored`, index.html), and an emptied array leaves a
  zero-length buffer, so the mesh no longer draws (v225 dropped them for about 20 MB; its review round took that back).
  The shared `body.js` lets its 60,000-point
  staging arrays go once its geometry holds its copies, `tissue.js` its cells and splats before it hands the set over.

## The muscle story (`packages/nmd/main.js`) is built the same way

`packages/nmd/main.js` is generated like the tour: edit `packages/nmd/src/` and run
`node packages/nmd/src/build.mjs` (`--check` as for the tour). It uses the shared kit (`tools/engine/kit.js`)
(`tools/engine/kit.js`) and set contract (`packages/lbi/src/SPEC.md`); `packages/nmd/src/SPEC.md`
describes its three sets: `tower` (the multiplex network: 71 layers, the hero
of the story and of explore mode), `motor` (the motor unit, sarcomere and heart)
and `hpc` (the supercomputer and the stress test).

- The data is real: `packages/nmd/src/data/gen_data.mjs <folder>` reads the authors' files (not in the repository;
  `ikerdata/` in its history) and writes `packages/nmd/src/sets/data.js` (the constant `NMD_DATA`,
  documented in its header), never edited by hand. It also computes the layer
  z-scores (degree-matched random sets) and the walk's visits on the protein
  layers, and names endotypes after their most typical GO process; these are
  stand-ins until the authors send their own. Layers without links yet
  (`data: ''`) fill in when their links arrive in the data, without code
  changes. No patient or variant data, and nothing about zebrafish, may appear.
- Everything the story says in numbers comes from `NMD_DATA` (`FACTS` in
  `engine/e3_story.js`).
- Explore mode (`engine/e4_explore.js`, canvas twins in `engine/e6_panels.js`):
  tabs Diseases (pick a group: its module, endotypes, layer scores, grid by
  endotype), Genes (search, partners per layer, terms), Walk (a live random walk
  from a group's seeds or your own genes, on the layers that are on), Layers
  (knock layers out), Endotypes (pick several, across groups: links between
  them per layer) and Scenes. The panels talk to the tower through its API
  (`setState`, `walk`, `pick`, anchors `gene`, `endo`, `group`).
- *Stand inside* (view controls, or the Scenes tab in the headset) opens the
  tower around you: on screen from its middle, in a headset life size around
  where you stand (`XR.room`, `xrPlace`).
- The heart (in `motor`) is one smooth surface: a signed distance field (round
  cones and ellipsoids blended softly) polygonised by surface nets. That is too
  slow for load time, so it runs as a job in slices between frames: a set may
  return `idle(dt, ms)` (the engine calls it while the set is hidden) and
  `finish()` (build now: the harness and `sweep.mjs` call it before
  screenshots). The heart fades in once built.
- The build budget: every engine whose sets build between
  frames (the muscle, endotype, PET, microanatomy, ovary and tissue topology stories) shares one budget a frame among all
  of them (`BUILD`, `buildMs(dt)`, `buildTurn(jobs, dt)` in `engine/e2_scene.js`, the same lines in each): in a headset
  about 1 ms, on a page an eighth of the frame, 2 to 8 ms (more where frames are slow anyway, as in headless Chromium).
  The hidden sets take it by turns, one a frame (round robin, `BUILD.i`); each of the others is asked `idle(dt, 0)`,
  which builds nothing and answers whether it still has work (`true`) or not (`false`: it is passed over until it says
  `true` again). The organs' models that the microanatomy and tissue topology engines step themselves (`ORGAN3D`) are a
  job of the same budget (`ORGJOB`, `LIVJOB`), no longer on top of it. A set on show still builds on demand in its
  `update` (its own slice, as before: the heart 12 ms once it is wanted), and `finish()` at once. The ovary's organ,
  which the story shows from its first second, builds during the load instead (`early(ms)`, a slice a step behind the
  loading card), so its first seconds no longer pay 4 ms a frame for it. `idle(dt)` without `ms` keeps a set's old
  slice (the harnesses). The jobs yield finely enough for it (the ovary's surface nets after each row of cells and
  its stain every 128 pixels, `ORGAN3D`'s quads a plane at a time and its pictures every 25 triangles). How much longer the builds take in wall time on a Quest, and whether a story's set is ready when
  its chapter comes, is untested there.
- A set may also export `keepOut(p)` (the camera's position in its own frame,
  returned moved if need be) and `still(p)` (explore's sway rests there): the
  engine's `keepCamera` applies them every frame outside a headset. The
  supercomputer uses them to keep the camera out of its racks; the story's
  aisle shot stays on the aisle's centre line by design.
- In a headset no close view brings a set that exports `keepClear` (the
  motor unit; in the endotype story also the junction) nearer than 0.35 m to
  your head: `xrPlace` caps the view's scale, eased, from a sample of the
  set's visible meshes (`xrClear` in `engine/e5_xr.js`, the same lines in both
  stories); your own size and an overview's scale stay, and standing inside
  is left alone. The sample (a point per 3.5 cm of surface, in set units) is
  taken in slices of a millisecond or two from the start wherever WebXR is
  (`xrPrep`, from the frame loop), so entering the headset never stalls on
  it. `keepClear` may be a function giving, per object, a test of where it is
  never drawn (the junction's cut-away). Sets whose positions come from their
  shaders (the tower, the network, the tree) do not export it, nor does the
  supercomputer (its aisle shot is inside it).

## The endotype story (`packages/endo/`, a story package since v186) is built the same way

`packages/endo/main.js` is generated from `packages/endo/src/` (`node packages/endo/src/build.mjs`, `--check` as for the tour):
the shared kit (`tools/engine/kit.js`), three sets (`syn`, the neuromuscular junction close up; `net`, the protein network, seeds and
walkers; `tree`, the gene x term matrix, the tree and the endotypes; each with a manifest), the muscle story's
`motor` set (the build gives it the muscle story's disease groups, all it reads of `NMD_DATA`) and engine parts
adapted from the muscle story's. `packages/endo/src/SPEC.md` is the contract.

- The data: `packages/endo/src/data/gen_data.py` (Python with EndotypY installed) reads the authors' saved run (their
  protein network, the 35 seed genes, their 12 endotypes) and the Gene Table's CMS genes, and writes
  `packages/endo/src/sets/data.js` (`ENDO_DATA`, documented in its header). The authors' files stay out of the
  repository: only these numbers are kept. The endotypes are the authors'; the steps before them (seed groups,
  the walk, neighbourhoods, the annotation, the tree) are re-run with the package's defaults on the same network
  to show the method, and the tree is drawn to agree with their endotypes. The story says so (explore's Method
  tab, the last chapter's small print). Its random walk is the package's, solved by iteration instead of a dense
  inverse (the same numbers on a test graph). A pickle can run code: the generator unpickles only the expected
  classes.
- Explore: Endotypes, Genes (the 393 module genes only), Method (the five steps) and Scenes tabs; *Stand in the
  gap* puts you in the synaptic cleft (in a headset life size around you, the cleft at chest height).
- The `net` and `tree` sets export `api()` (picking, gene names, focus); `net`'s walkers keep state between
  frames but follow paths planned from `t`, so seeking works.

## The PET story (`packages/pet/`, a story package since v186) is built the same way

`packages/pet/main.js` is generated from `packages/pet/src/` (`node packages/pet/src/build.mjs`, `--check` as for the tour): the tour's
kit and body set (unchanged), organ icons (`sets/icons.js`, `PET_ICONS`), three sets (`scan`, the PET/CT scanner, how
PET sees and the vision row, its stages joined by flowing light; `organs`, segmentation, uptake, the cohort, the
explainer and the paper's networks, drawn in the body set's frame; `liver`, an organ as a network of patches, in
explore mode only; each with a manifest) and engine parts adapted from the endotype story's. `packages/pet/src/SPEC.md` is the
contract.

- The vision row (the opening; the owner's wish: more 3D, better colours): its network is the 14
  organs as the microanatomy story's 3D models (`ORGAN3D`, `packages/micro/src/sets/organs.js`, included by the build; the bone
  marrow a model of its own there, `marrow`, kept out of that story's 29), lit, each taking on its colour and turning
  slowly, spread in depth and joined by glowing tubes with light running along them, the models built in the load
  before the scanner's set (`SETS.scan.prep`, a slice a step); prognosis is three glass tubes filling with the story's
  cyan light and medication five amber capsule pills rising from a small base (no more neon orange, red and yellow).
  Rebuild the PET story after changing `packages/micro/src/sets/organs.js` (and the microanatomy and tissue topology stories).
- The paper's networks the same way (no flat glyphs, the organs' names as labels; the same in explore mode): in the `organs` set, story and explore alike,
  every node is its organ's 3D model (the vision row's models, lit, in its colour, turning slowly, a soft glow behind;
  a hub's takes on orange-yellow), and the bars' feet, the slab's column heads and the panel's axes show small lighter
  copies (`ORGAN3D.lite`, made in `SETS.organs.prep`); about 35k triangles in two draw calls. `PET_ICONS` only draws
  the panes' pictures now (explore's Organs pane, HTML and the headset's canvas).

- The data: `packages/pet/src/data/gen_data.mjs` (Node) writes `packages/pet/src/sets/data.js` (`PET_DATA`, documented in its
  header) from the paper's tables (typed in), the two weight matrices printed in its Figure 2A, and
  `packages/pet/src/data/figures.json`: values read off its Figures 3 and 4 (each read twice independently and reconciled).
  Stand-ins, said so in the story: typical organ uptakes and a synthetic cohort with Figure 2A's partial correlations
  (for explore's matrix and scatter views). The authors' VR viewer (with a patient's scan) is not used: no patient
  data.
- `body` and `organs` share one frame and are shown together.
- The story follows the paper (the network of all scans, then from health to disease); the poster gives its title,
  the vision row and its authors. It has no one-scan network, index, survival or immunotherapy results (they did not
  match the poster; the `people` set and explore's One scan and People tabs are in the history; the explore-only `liver`
  scene stays), no matrix of all scans or scatter plot in the Network chapter (it goes straight to the network on the
  body) and no Vision chapter at the end (its credits and Explore button close Health; the row stays in the intro). The
  second chapter is "How PET sees" (FDG as the most common of the tracers; no brackets in its text), the organ labels
  are names only and the AI is "segmentation algorithms". The scanner hands its patient to the body set in one
  move (`scan_rise`): the scanner goes, the patient stands up exactly where the body set's body stands (`riseTo`, after
  `buildCamera`'s turn), its glow cools, then the tracer arrives as before. Explore mode plays the same hand-over (and back in reverse): picking Body or Organs from the Scanner (`openScene`, `X.hand`, `HAND` in
  `engine/e4_explore.js`) holds the camera 1.5 s while the scanner goes, eases it to the new scene's view as the
  patient stands up and turns (the sets unturned in explore, so `riseTo.yaw` is 0 there: `updateSets`), cools the glow
  and plays the tracer's arrival (6.5 to 15 s; Organs then fade in); the Scanner picked from Body or Organs plays it
  backwards in 6 s (the tracer drains, the image glows, lies down as the camera goes back, the room returns). Only a
  scene picked as such plays it (the Scenes pane, page or headset, and a scene from a shared room once this page has
  taken the room's state, `X.synced`): an organ, a network, a comparison or a tab picked from the Scanner shows at
  once. Picked while another plays, it starts at the moment that matches what shows (`handFrom`), so turning back
  halfway plays back from there. A flight of its own (a view) takes the camera from it; a control changed ends it. Open: the owner finds the text from the
  Network chapter on does not match the poster (the poster is needed to rewrite it; see HANDOVER.md).

## The microanatomy story (`packages/micro/main.js`) is built the same way

`packages/micro/main.js` is generated from `packages/micro/src/` (`node packages/micro/src/build.mjs`, `--check` as for the tour): the
tour's kit, body and tissue sets (unchanged), small 3D models of the 29 organs (`sets/organs.js`, `ORGAN3D`: signed
distance fields polygonised by surface nets, built between frames from the start, one organ after another, the one on
show first; drawn as meshes on the body, the atlas's plates and the network's organ ring, and as pictures in the
panes, each going in as it is drawn), three sets (`slide`, the method in the tour's visual language over the tissue
section, drawn in its frame: tiles, their features as glowing blocks, a network of neighbours with messages, the lift
into a map where alike tiles gather, and the domains; `atlas`, the slide library of glass slides, in a lit rack, the
atlas of sections as slabs in relief, the tile cloud, the volcano and the trajectories; `hier`, the network of organ
architecture and the domain contacts; each with a manifest) and engine parts adapted from the PET story's.
`packages/micro/src/SPEC.md` is the contract.

- The data: `packages/micro/src/data/gen_data.mjs <graphml>` reads Iva Buljan's network of organ architecture (the file stays
  out of the repository) and writes `packages/micro/src/sets/data.js` (`MICRO_DATA`, documented in its header) with the
  preprint's numbers (typed in) and `packages/micro/src/data/figures.json` (values read off the talk's figures). The slides,
  sections and tiles are drawn, never the GTEx images.
- `tissue` and `slide` share one frame and are shown together.
- In the Atlas chapter the atlas turns into the network (`atlas_net`, with `hier_grow` keyed at the same times, so each
  node grows as its things arrive): the sections' tiles gather into a bead per domain, the organs fly up to their nodes,
  the sections to their tissues', their beads on to the tissue types' and the domains' (by name; the mapping is in
  `sets/atlas.md`). The network takes the atlas's turn at that hand-over (`MORPH` in `buildCamera`), so they meet exactly.

## The aging ovary story (`packages/ovary/`, a story package since v186) is built the same way

`packages/ovary/main.js` ("The aging ovary", after the poster "Mapping the histological landscape of human ovarian aging" by
Parijat Chakraborty, Samir Moustafa and André Rendeiro) is generated from `packages/ovary/src/` (`node packages/ovary/src/build.mjs`,
`--check` as for the tour): the shared kit (`tools/engine/kit.js`) and body set (unchanged), the data and a shared look pasted before the sets
(`OVARY_DATA`, `sets/data.js`, and `OVARY_TREND`, the poster's lines looked up, with `OVARY_LOOK`, `sets/look.js`), three
sets (`organ`, a cut-away ovary built by surface nets between frames, small in the body's pelvis at first, whose
follicles, scars and vessels follow the poster's trend lines with age; `section`, a drawn H&E section in relief with the
four kinds and cysts, a younger and an older one, the tiles, UNI2 features, a grove of decision trees that votes, the
predictions, SegFormer's masks and the illustrative neighbor network, which tips back off the section and gathers into
five hubs by kind joined by bands (`section_lift`, `section_kinds`); `charts`, only the slides stacking into the age
histogram, the one graph, in passing: twenty towers of slides lying on the floor in a wide arc, age 20 on the
left to 70 on the right, seen from a little above (a flat one was hard to see); each with a manifest) and
engine parts adapted from the microanatomy story's.
`packages/ovary/src/SPEC.md` is the contract.

- The data: `packages/ovary/src/data/gen_data.mjs` writes `packages/ovary/src/sets/data.js` from the poster's numbers (typed in
  exactly) and what the story uses of `packages/ovary/src/data/figures.json` (values read off its figures by two readers,
  reconciled: the trend lines, the shares of donors with none, the comparison lines' slopes; the bands and axes read
  there are kept but unused). The story draws no trend, comparison or score charts (the owner's rule against 2D
  graphs; there is no Agree? chapter, no Charts scene in explore and no illustrative dots): the Age
  chapter is the cut-away ovary aging from 20 to 70 with tags giving each method's count on the poster's lines (read
  off its figures: approximate, the story says so), all r in words and the agreement donor by donor (its "the
  segmentation finds fewer" from the read slopes, said so in the small print); Methods ends with the scores as tags
  on the section's own objects. Of the donors the data holds only their ages (whole years filling the histogram's
  bars, for the Donors chapter's slides). The lines, r and p are the poster's. The network of the last chapter is the
  poster's next step, drawn as an illustration and labelled so throughout. The slides, sections and the ovary are
  drawn, never GTEx images or the poster's pictures.
- `body` and `organ` share one frame (the ovary sits in the body's pelvis before it grows out of it).
- One model out before the next comes in (two models overlapping z-fight in a headset): the section, the ovary and the donors' slides all stand at the origin, and
  two see-through models in one place flicker in a headset as their drawing order flips with the head. At each change
  of model in the story (Donors to Section, Methods to Age, Age to Next) the old one fades out over 1.2 s and the new one
  in from 1.2 s; explore's `exploreStep` holds a set's fade-in until every set going out is at 0 (one going out also
  drops by 0.6 a second, so it is gone in about half a second); and the older section of the pair comes in from the
  right and behind (`section_pair`), never across the younger one. A set writes no depth while it fades (`fadeDepth` in `engine/e2_scene.js`: each material's
  own `depthWrite` back once its set is fully in, above 0.97; the kit's own faded materials left to `setAlpha`): a faint
  model that wrote depth hid the next one where it was drawn first, and in a headset that order flips with the head.
- Labels whose text is a function (the ovary's age and count tags, `organ_counts`) are read again while they show
  (`labelText`, as in the qubits story).
- Explore: Objects (pick a kind: its numbers as text, picked out on the section and in the ovary; pointing at an object
  on the section picks it), Age (a slider from 20 to 70 driving the ovary, with its count tags, and the section; the
  counts on the poster's trend lines at that age), Methods (tiles and the forest's vote, or the masks, and their scores)
  and Scenes (Ovary; Section, with the network By kind). No charts anywhere in explore (an old link with
  `scene=charts` is ignored).
- **American spelling in this story too** (aging, color, gray, center, hematoxylin, neighbor), as the qubits story;
  English only.

## The qubits story (`packages/qubits/`, a story package since v186) is built the same way

`packages/qubits/main.js` is generated from `packages/qubits/src/` (`node packages/qubits/src/build.mjs`, `--check` as for the tour): the
tour's kit, three shared parts pasted before the sets (`QMATH`, the maths, `sets/qmath.js`, checked by
`node packages/qubits/src/test-qmath.mjs`; `QUBITS_DATA`, the real run's numbers typed in from Joel Hancock's brief,
`sets/data.js`; `QLOOK`, the story's lit instanced tubes, rings, balls and halos, `sets/look.js`), three sets (`pairs`,
the grid of pairs, the network as a map with two walkers and its valleys, the chip and the eight neighborhoods;
`cube`, the cuts, the coarse operator A_c on a cube, the Pauli strings as small cubes, added up, and the toolbox;
`chart`, the real run's residual by depth and the six-gate circuit; each with a manifest) and engine parts adapted
from the microanatomy story's. `packages/qubits/src/SPEC.md` is the contract.

- Example networks throughout (Joel Hancock's wish): no STRING data and no gene names; every number about them is
  computed live by `QMATH` (the cut, A_c, the Pauli weights, the algebras so(2L) and so(2L + 1), the residual, the
  Trotter angles). The real run's numbers appear only where the text says "in the real network". No data term D and no
  Walsh-Hadamard step (out of scope); the valleys of the walkers' map are labelled illustrative. The cut stands in
  for the authors' beam search (the story says so).
- A set label's `text` may be a function returning `[bold, rest]` (the gallery's weights, the grid's count, the gate
  angles): the engine reads it again while it shows and redraws it when it changes (`labelText`: the HTML label and
  the headset's sprite).
- Step params (never eased): `cube_net`, `cube_cut`, `cube_algebra`, `cube_focus`, `chart_src`, `pairs_code`. The
  cube builds its default network at load and the others when first asked for in explore (a short pause).
- Stored layouts (v225): the two force layouts the load makes (`pairs`' map, the cube's default network; about 90 ms
  cold on a laptop) are worked out by `build.mjs` with the same calls and pasted before the sets as `QLAY_STORED`
  (base64 Float32, keyed by `QMATH.layoutKey`: the network's links, the options and the starting places, fractions to
  6 places). `QMATH.layout()` uses a stored one only while its key matches, else works it out live as before, so a
  change to those calls (or to the networks) costs time, never a wrong picture; the cut, A_c and every number shown
  are still computed live. Checked identical in Chromium 158 (stored against `layoutG` run in the page).
- **American spelling in this story** (color, gray, neighborhood, normalized, center; the aging ovary story too), as the brief asks: keep
  it in `packages/qubits/src/` and its card; the rest of the app stays British.

## The mutation machine (`packages/mutation/`, a story package since v186) is built the same way

`packages/mutation/main.js` ("The mutation machine", after the poster "Converting Mutation into a Machinery: DNA Substitution
Models as Quantum Circuits" by Enes Berk Sakalli and Arndt von Haeseler, a draft) is generated from `packages/mutation/src/`
(`node packages/mutation/src/build.mjs`, `--check` as for the tour): the shared kit (`tools/engine/kit.js`), three shared parts pasted before the sets
(`MMATH`, the maths, `sets/mmath.js`, checked by `node packages/mutation/src/test-mmath.mjs`; `MUT_DATA`, the poster's numbers
typed in, `sets/data.js`; `MLOOK`, the qubits story's lit instanced tubes, rings, balls, boxes and halos plus letter
tiles, arrowheads, qubit spheres and gears, `sets/look.js`), four sets (`letters`, the DNA helix, the ancestor's eight
letters and two copies with swaps, a letter's two qubits and their read-outs piling up; `tree`, the family tree in 3D,
one machine (a gear) per branch and the poster's species tree; `rule`, a rule of change as balls and arrows, the pyramid
of mixes and the path through it, the compiler, the machine for one branch and its circuit; `stem`, an RNA stem, a pair
breaking, the coupling, the count of combinations and the fields of rebuilt ancestors, drawn in `tree`'s frame; each
with a manifest) and engine parts adapted from the qubits story's. `packages/mutation/src/SPEC.md` is the contract.

- Example numbers throughout, as in the authors' own test (the author: fine for a test of the method; a real result
  would estimate them from real sequences). Every number about the examples is computed live by `MMATH`: three
  substitution models (GTR as the story's, JC69 and K80) and P(t) = e^(Qt), the path through the pyramid, the qubits'
  arrows and read-outs, the circuit's angles and its simple steps (checked by a state-vector run), the family tree with
  every swap simulated, the pair models and the ancestor rebuilt by Felsenstein's pruning. The poster's numbers
  (`MUT_DATA`: Figure 1's sequences, Figure 5's stems, the shares of 2,000 rebuilt ancestors with all six pairs intact,
  10 %, 43 % and 20 %) appear only where the text says "in the authors' test".
- The poster does not give its coupled circuit in detail, so the live example's coupling is **our stand-in**: each
  branch's turn, then a step that weights every matching pair w times (`MMATH.Pcoupled`), labelled so wherever it shows
  (MM6 in `docs/questions-for-authors.md`).
- The author's answers are the story's. The turn: the circuit copies the parent's letter onto the child,
  then turns the child by single-qubit rotations plus two-qubit steps that make the turn depend on the parent's letter;
  how far each step turns depends only on the branch length, and the steps are the same on every branch. The wording of
  the result: a broken pair in the true ancestor is normal (only about a quarter of ancestors have all six pairs
  matched); the coupled circuit favours matching pairs too strongly (43 % against the exact calculation's 20 %): its
  ancestors look believable, but its percentages are not true chances. Never say the circuit is "better" or "more
  accurate".
- The family tree is properly 3D (the owner's wish): it grows up out of its root, its eight tips evenly round the
  vertical, and heights are change (a branch rises by its length), so you walk round it and look up into it. In a
  headset the story eases into the tree set's `stand` view while the family tree is the scene (chapter 2 and the
  machines of chapter 5; `standView` in `engine/e3_story.js`, by story time, so everyone at a station sees the same
  size): the tree stands about 1.5 m tall in front of you, its root low and its crown above your eyes, and nothing of it
  comes within 0.35 m of your eyes; the species tree stays at table size. Explore offers it as Look: Stand in it; `up`
  looks up from below the root on a screen only (the headset's Tree pane leaves it out: it would tip the tree over).
- A set label's `text` may be a function (the branches' lengths, the branch picked, the dial's branch length): the
  engine reads it again while it shows (`labelText`, as in the qubits story). Step params (never eased) are listed in
  each manifest and in `STEP` (`engine/e4_explore.js`).
- Explore: Letters (a letter or a mix in two qubits, read out 1 or 100 more), Rule (three rules, the start and parent
  letters, the branch length; the path, the machine, its circuit and simple steps), Tree (five trees, how fast letters
  change, a branch picked by click or ray, the machines running, the views), Stem (the authors' test or this example
  live, the pair favour w from 1 to 30, a method lit, rebuild again) and Scenes.
- **British spelling** (colour, favour, tumour, centre, grey), English only. T stands for RNA's U, as on the poster. No
  patient data (the test is synthetic); the poster's pictures are never shown, its figures are redrawn in 3D.

## The shape of tissue (`packages/topo/main.js`) is built the same way

`packages/topo/main.js` ("The shape of tissue", after the poster "topocyte: scale-resolved topological phenotyping of tissue
architecture across spatial modalities" by Simon Schindler, André Rendeiro and Jörg Menche) is generated from
`packages/topo/src/` (`node packages/topo/src/build.mjs`, `--check` as for the tour): the shared kit (`tools/engine/kit.js`), three shared parts pasted before
the sets (`TOPO_DATA`, the authors' numbers, `sets/data.js`, generated; `TDATA`, its decoders and look-ups,
`sets/tdata.js`, checked with the data by `node packages/topo/src/test-data.mjs`; `TLOOK`, the mutation story's lit tubes,
rings, balls and halos plus glass discs, glass triangles, ribbons, glass slides and cells drawn in H&E or as beads,
`sets/look.js`), the tour's `body` set and the microanatomy story's organ models (`ORGAN3D`, only its liver; both
unchanged), four sets (`slide`, the healthy tile round the poster's patch and the new slide's window drawn in H&E from
their cells, sketches of other modalities, the fixed scales other tools read and the whole slide's overview; `map`, in
`slide`'s frame: one cell's neighbourhood, its own network, bars and score, then every cell scored as a relief, the
two groups and their cell types, and sketches of the next steps; `tower`, the poster's patch: balls growing round 110
cells, the network with triangles, pieces joining and loops opening and closing, the tower of scales and its barcode;
`cohort`, the 123 slides as a rack of glass slides with their curves, the main shapes, the space of scores, the
classifier's wall, the held-out stacks and the weight for every radius on a column of radii; each with a manifest) and
engine parts adapted from the mutation story's. `packages/topo/src/SPEC.md` is the contract.

- The instance pools send only what changed: `upload` in
  `packages/topo/src/sets/look.js` (and the same function in `packages/qubits/src/sets/look.js` and `packages/mutation/src/sets/look.js`; the
  soil story draws with this look's pools) compares a pool's used range, as 32-bit words, with a copy of what last went
  and sends the stretch from the first change to the last (a range set and not yet sent is merged in, since three.js
  sets its count back to -1 once it has gone), nothing when it is the same: a story paused or at rest uploads nothing,
  one moving sends what moves. The soil field's posts are written only when the netting moves.

- **Every number is topocyte's** (the owner: "use the topocyte code for all calculations").
  `packages/topo/src/data/gen_data.py` runs the authors' package topocyte and the poster's own figure scripts on the authors'
  GTEx liver cohort (123 slides, 66 healthy and 57 with cirrhosis, 30.8 million cells found by HistoPLUS, CC BY 4.0)
  and writes `packages/topo/src/sets/data.js` (`TOPO_DATA`, documented in its header): the slides' curves, scores, classifiers
  and held-out results for pieces and loops, the shares of the gap by radius, the poster's patch with its complex,
  bars, joins and loops, a healthy tile round it and the new slide's window (6,716 cells, each with its own score and
  bars). topocyte is GPL-3: it is only run offline, and none of its code is copied into the app. The authors' files,
  the cohort table, slide ids and any GTEx image stay out of the repository: only derived numbers go in, and slides are
  numbered, never named. `TDATA` only decodes and looks things up (what is alive at a radius by its stored radius, the
  stored bars alive there, sums of stored shares, the poster's colours): **the app computes nothing scientific**, so
  never recompute persistence, a functional PCA, a classifier or a score in it.
- The data reproduces every number of the poster (`test-data.mjs` checks them): 66 and 57 slides; the first two main
  shapes hold 72 % and 20 % of the variation in loops; the held-out test gets 62 of 66 healthy and 47 of 57 cirrhotic
  slides right (4 and 10 wrong, accuracy 0.886); loops of 5 to 10 µm add 2.73 and of 10 to 15 µm 4.65 to a gap of 7.04
  (odds × 1,138); the patch has 82 pieces at the poster's first snapshot (4.08 µm); the new slide splits into 1,000
  and 5,716 cells at 100 µm.
- The local radius is 50 µm (the author's choice); the poster's split at 100 µm appears only in small print and as
  explore's map at 100 µm (only the colours and groups change). Cell v's score is the data's (6.97; the poster prints
  26.57: T5 in `docs/questions-for-authors.md`, open).
- The cell types are the cell classifier's labels (HistoPLUS), not a pathologist's: "Cancer cell" is kept (the author's
  wish), and the story says once what the labels are. The genes and proteins of the last chapter are sketches of the
  workflow, labelled so, not data.
- The tissue is drawn from the cells' positions and types, never from an image. The relief of scored cells takes its
  heights from the stored scores round each cell, smoothed for drawing only; its colours are each cell's own score.
- In a headset the tower of scales stands about 1.5 m tall in front of you while it is the scene (chapters 3 and 4;
  `standView` in `engine/e3_story.js`, by story time, so everyone at a station sees the same size; nothing of it comes
  within 0.35 m of your eyes), as the mutation story's family tree does. Explore offers it as Look: Stand at it; `up`
  looks up through it on a screen only.
- The radii ease on the poster's log ruler (the tower set's `log`). A set label's `text` may be a function
  (`labelText`); step params (never eased) are listed in each manifest and in `STEP` (`engine/e4_explore.js`).
- Explore: Patch (the radius from 1.5 to 60 µm with the poster's four stops, the balls, the tower or the barcode,
  pieces or loops lit, the counts there), Cohort (pieces or loops; the rack, the scores or the held-out stacks; a slide
  picked by click or ray, its scores and held-out result), Scales (a window of radii of your own, 0 to 100 µm or "and
  above" in 0.5 µm steps: its share of the gap and its odds factor), Cells (one cell, every cell, the two groups or the
  sketches, at 50 or 100 µm; a cell picked by click or ray: its neighbourhood, its own network at a radius, its bars
  and score) and Scenes (Liver, Section, Patch, Cohort, Map).
- **British spelling** (colour, centre, grey, haematoxylin, neighbourhood, tumour), English only. No patient data, no
  donor details, no GTEx ids or images, and never the poster's pictures.

## The soil story (`packages/soil/`, a story package since v186) is built the same way

(v225) Soil shows only the tour's globe (`web_net` 0 throughout): `SETS.web.netMax = 1000` in its `e2_scene.js` grows the
web set's internet tree small (the tour's 17,000 nodes otherwise); the globe has random streams of its own, the same
either way.

`packages/soil/main.js` ("Holding on to nitrogen", after the slides "Exploring the Effects of Biological Nitrification
Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by Marina Montserrat Díez, Tadashi Yoshihashi,
Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper,
and their field trial's data; made for the Global Peter Drucker Forum in Vienna, a lay, business audience) is generated
from `packages/soil/src/` (`node packages/soil/src/build.mjs`, `--check` as for the tour): the shared kit (`tools/engine/kit.js`), three shared parts pasted
before the sets (`SOIL_DATA`, the trial's numbers, `sets/data.js`, generated; `SDATA`, its decoders and look-ups,
`sets/sdata.js`, checked with the data and the story's key numbers by `node packages/soil/src/test-data.mjs`; `SLOOK`, the
story's palette and colour rules, `sets/look.js`), the tissue topology story's look (`TLOOK`) and the tour's `web` set
(only its globe), both unchanged, three sets (`soil`, the cut-away block of soil with its wheat: fertiliser, the
nitrogen's flows, a magnified pore with the relay's microbes, the BNI halo round the roots, the wild grass and the piece
of chromosome, one marked atom; `field`, the trial's 24 plots under netting over five dates, the leaves by their
chlorophyll, nitrate under the plots, jars breathing N2O, the 119 cores stacking into the design and a module lighting
its plots; `net`, in `field`'s frame: the cloud of 20,000 kinds of microbe, the nitrifiers, the co-occurrence network
pulled out of its core, the shuffle, the modules and the halves' own networks side by side; each with a manifest) and
engine parts adapted from the tissue topology story's (with the hop from Vienna to Japan on the globe, `makeHop` in
`engine/e2_scene.js`). `packages/soil/src/SPEC.md` is the contract, with the owner's decisions.

- **The data**: `packages/soil/src/data/gen_data.py` (Python with numpy, pandas, scipy and networkx,
  `packages/soil/src/data/requirements.txt`; about five minutes) reads the authors' three CSVs (the 16S read counts of 100,116
  kinds in 119 samples, their taxonomy, the field metadata) from a folder given on the command line, builds the
  co-occurrence network and writes `packages/soil/src/sets/data.js` (`SOIL_DATA`, about 425 KB, documented in its header), with
  what the story uses of `packages/soil/src/data/figures.json` (the slides' charts read off by two readers and reconciled by
  `packages/soil/src/data/reconcile.py`; the readers' files are not kept). The authors' files are not in the repository: only
  derived numbers go in, and `sets/data.js` is never edited by hand. `SDATA` only decodes and looks things up: the app
  computes nothing scientific. Permission: the authors, through the owner, with the rule that anything
  unknown is shown as illustrative and said so (`docs/data-and-permissions.md`).
- **Real, read off, illustrative** (each said so where it shows). Real: every field measure per plot and date, the
  groups' means and tests, the phyla, the nitrifier guilds, the cloud's kinds and the network, built for this story with
  a standard method (centred log-ratios, Spearman's rho of at least 0.6, false discovery rate under 5 %, Louvain modules;
  "about five big groups", since the count depends on the run): correlation, not interaction, and not the authors'
  analysis. Read off the slides (approximate): day 70's chlorophyll, the N2O incubation curves, the qPCR counts.
  Illustrative: the soil block and its flows (only the slides' "less than half reaches the plant" is theirs), the relay
  in the pore, the halo, the chromosome, the field's plot layout (the real map is not known: four blocks of six in a
  seeded order), the wheat's look at each date (only its leaf colour is data), the hop's end (JIRCAS's home in Tsukuba:
  the site is not given) and explore's Nitrogen sketch ("a sketch, not data").
- **The hedges** (the data's verdict, `packages/soil/src/README.md`): in the slides' measurements the BNI wheat stays greener
  and leaks less nitrate and N2O; the soil's microbes and their network follow the fertiliser and the field's plots, not
  the wheat line (2 of 3,384 common kinds differ by line; the two lines' own networks, 38,653 and 30,276 links, differ
  less than some random halves do, 158 to 27,758 apart); rising together is not working together; strong indications,
  not yet proof. Never say the wheat "changes the microbiome" or "rewires the network", never call a hub a keystone or a
  link an interaction, and never say the line changes nothing (a test that finds no difference does not show there is
  none). The two N2O measurements disagree (the metadata's "potential" N2O in fertilised soil over the season, 0.81
  against 0.98, p = 0.58, against up to about 3-fold less in the slides' jars): an open question, said in chapter 5's
  small print and explore's Field pane. The other open points are `SOIL_DATA.open` and S1 to S9 in
  `docs/questions-for-authors.md`.
- Kinds of microbe are numbered by abundance, never named by their ids; no sequences, no ASV ids, no pictures or photos
  from the slides (everything is redrawn in 3D), no e-mail addresses. The two kinds that differ by line (a Denitratisoma
  and a Kitasatospora) are named only in explore's small print, never as an effect of the wheat.
- Eight chapters, 11:03 as narrated: Half the sack, The relay, A wheat fights
  back, The field trial (the globe and the hop, then the field), Greener, fewer leaks, A crowd of 100,000, Who rises
  together, What we know. Every number the text shows comes from `SOIL_DATA` (`FACTS` in `engine/e3_story.js`). In a
  headset no set stands life size (`field_life` was optional and is not built). A set label's `text` may be a function
  (`labelText`); step params (never eased) are listed in each manifest and in `STEP` (`engine/e4_explore.js`).
- Explore: Field (a date, a measure: chlorophyll, ammonium, nitrate, N2O or pH, a wheat line and a regime, the views;
  a group of plots picked by click or ray, with tags; N2O brings the jars), Nitrogen (the soil block's sketch with
  three switches: fertiliser, the BNI wheat, DCD), Microbes (the cloud by phylum or the nitrifiers, their shares by
  regime and line, a kind picked by click or ray), Network (a module and the plots where it thrives, the threshold from
  0.6 to 0.8 with the counts at 0.5 and 0.55 in words, Shuffle, Split by wheat line, fertiliser or at random) and
  Scenes (Soil, Globe, Field, Microbes).
- To rebuild the data (only with the authors' files, which are not in the repository):
  `python -I packages/soil/src/data/gen_data.py <folder with Soil_ASVs.csv, ASV_Identifiers.csv, Field_Metadata.csv>`, then
  `node packages/soil/src/test-data.mjs` and `node packages/soil/src/build.mjs`; the slides' readings again only through
  `packages/soil/src/data/reconcile.py`.
- **British spelling** (colour, fertiliser, centre, grey, neighbourhood), English only; plain words for a business
  audience, the technical layer in small print.

## The CDK5 story (`packages/cdk5/`, a story package since v189) is built the same way

`packages/cdk5/main.js` ("The switch that sticks", the kinase CDK5 and brain diseases) was written by Christiane Hütter
(the Menche lab) on a fork of the app at v135 (as `tools/cdk5/` and `stories/cdk5.js`; the owner, 18 November 2026:
"take all data and scene descriptions and data representations from the github", of its two VR projects the analytics
one only, networks only) and came into the app as a package at v189, on the Experiments set of cards (`list:
"experiments"` in `story.json`: nobody has tried it on a headset yet; one field moves it to the main set). It is
generated from `packages/cdk5/src/` (`node packages/cdk5/src/build.mjs`, `--check` as for the tour; then
`node tools/packages/scan.mjs`): the shared kit (`tools/engine/kit.js`), `CDK5_DATA` (`sets/data.js`, generated, copied
from the fork unchanged), its decoders `CDATA` (`sets/cdata.js`, checked by `node packages/cdk5/src/test-data.mjs`), the
story's palette `CLOOK` (`sets/look.js`), the tissue topology story's look (`TLOOK`, `packages/topo/src/sets/look.js`,
unchanged), two sets (`net`: 16,376 points flowing between the authors' six arrangements, each scene's links, CDK5's
halo, its partners, its cousins, a pathway or a disease term lit, its 30 nearest in the landscape, the process knots,
and a veil that clears the view to the map's centre; `core`: each scene's centre proteins as lit balls and tubes with
names; each with a manifest) and the engine: the shared parts (`tools/engine/`) and the story's own (`src/README.md`
lists them). `packages/cdk5/src/SPEC.md` is the builder's brief (its rework; the superseded v189 brief, word for word, is `docs/history/specs/cdk5-superseded.md`).

- Brought onto today's engine (v189) by a three-way merge of its engine files (the fork's soil engine, the fork's CDK5
  engine, today's `packages/soil/src/engine/`): the story's own lines kept, every other line a `//#use` of the shared
  parts. Its own beyond the soil story's: `key` (authored seconds times `K_T`, 0.9), `DEF_MORE`, `LIN` and `MORPH`
  empty; `xrPlace` and its own `xrCap` (the default size, 0.35 m from the eyes by `XR_BOUND`, standing inside by
  `XR.inW`), `xrTip`, `xrBallHit` and `xrMinD` in the net's frame (explore's scenes are not sets: `X.scene` is one of
  `CDATA.SCENES`); `frame` (the shared one with explore's views from `sceneCam()` in the net set, and `XR.scene`,
  `XR.inW`, `XR.inV` set each frame); `sigFoot` and `drawFootX` (Stand inside). Its `collab.state()` carries `v:
  COLLAB_V` (2 since v191: the three new scenes and pathways 2 and 3), which `apply()` checks (`tools/packages/SPEC.md`, "Shared rooms"). The story's text,
  `NARRATION_SYNC` and `NARRATION_ENDS` were the fork's until v191's new script (`node tools/voice/narrate.mjs cdk5`).
- The data: `python3 -I packages/cdk5/src/data/gen_data.py <folder of the CDK5_data clone> --go <folder with
  goa_human.gaf.gz and go-basic.obo>` reads the repository's `CDK5_analytics` VR project, whose layouts, colours and
  links it decodes exactly from the textures (`layouts/` and `layoutsl/` the high and low bytes of each coordinate;
  `layoutsRGB/` a node's RGBA; `links/00-BIOPROC.bmp` each link as two pixels, a node's pixel in the 128-wide node
  textures, R + 128 G; `linksRGB/` a link's RGBA), its interactome (`input/ppi_elist.txt`) and gene symbols, the two
  Reactome pathway exports and its Disease Ontology tables (pickles of dicts, lists and strings only, read by an
  unpickler that refuses every class). The clone stays out of the repository. The notebook's two feature pickles (GO
  processes and diseases by gene) are on the lab's Drive, not in the repository: the layouts they gave are in the
  textures. Never lay the authors' layouts out again in the app. Since v191 also three scenes of `CDK5_minimal_new`
  and two more Reactome exports; the process knots are kept from the data file before (`--keep-clouds`), as their GO
  release (2026-07-26) is no longer to be had.
- What is ours, said so: the close-ups at the centre (the authors' centre proteins at their relative places, scaled up to
  radius `CDATA.CENTRE_R`), the tags, the over-representation of disease terms among CDK5's partners and its 30 nearest
  proteins in the landscape (hypergeometric within the 6,538 proteins with a disease, Benjamini-Hochberg; "in this
  map"), and the process knots on the map of processes (19 November 2026, the owner: "annotate the protein clouds in the
  very first layout"): named from a current GO release, since the authors' GO matrix is not in their repository; today's
  GO finds no single process in the map's big dense clouds, so 14 small knots where one process gathers are labelled
  instead, and the story says so. The authors' one drawn link, CDK5 - calpain (calpain acts on p35, not on CDK5), is
  said so.
- Reworked at v191 (the owner, 23 November 2026; `packages/cdk5/src/SPEC.md`, "The rework"): the colleague's scene
  document's ten scenes and a close (`title`, `activators`, `partners`, `ntrk2`, `sema`, `npas4`, `calpain`, `reach`,
  `alzheimer`, `landscape`, `learn`), a new script recorded word for word (8:27; each spoken line a `data-say`, a line
  with no key point of its own an empty `vo` mark), presentation-like (a heading and at most two points at once, names
  and structures as the voice says them). Three scenes from the second VR project, `CDK5_minimal_new` (the 205-partner
  star, Semaphorin interactions, NPAS4), decoded by the generator (the 311 proteins told apart by their links; six pairs
  with identical links may be swapped, said on the About tab). PDB structures at the centre (`src/models.json`, built by
  `tools/mol/build.py` into `packages/cdk5/models/`, about 2 MB, fetched once the close-up shows, a ball until then):
  CDK5 with p35's gripping part (1H4L, docking), calpain-1's core (1ZCM), BDNF (1BND), NTRK2's domain d5 (1HCF),
  SEMA4D and PLXNB1 (3OL2), mouse NPAS4 (7XI3), a Tau filament (5O3L); p39 a ball. Every number from `CDATA` (`FACTS`).
  In a headset the first chapter stands you inside the map (`XR.inW`, the map's middle at your eyes, 1.25 m a unit),
  then it floats in front of you at 0.5 m a unit, its scale capped so no point comes within 0.35 m of the eyes
  (`XR_BOUND`).
- Explore: Scenes (the nine, with switches per scene, Stand inside), Proteins (search, partners, terms, pathways),
  Diseases (88 terms, CDK5's own first) and About. Shared state `{ v, tab, scene, ctl, prot, term, path }` (never the
  search text, the camera or standing inside). Links: `src/README.md`; the smoke test's `cdk5` step checks five of them.
- Rules kept from the v189 brief (the rest of it is in `docs/history/specs/cdk5-superseded.md`; the rework overrides it where
  they differ): every number the story shows is read from `CDATA` at load, never typed (the list is there under "The data").
  The layouts' places mean "similar processes" or "similar diseases" only roughly (UMAP): distances on them are not
  measurements. Real (the authors'): the interactome, every layout, every colour, every scene's links, the pathways' members,
  the proteins' Disease Ontology associations; ours: the over-representation counts, the close-ups' balls, tubes and names, the
  tags; the one drawn link, CDK5 - calpain of scene 3, is not an interaction in the interactome: say so. In the `inside` view the
  camera is at the origin and points must not pop near the camera (fade those within 0.15 of it). Names: every centre protein its
  gene symbol, the key ones with a short role, and not all at once on a phone (`core_names` 1 all, 0.5 the key ones only).
- Miniatures `cdk5.net` (its station icon, `icon` in `story.json`) and `cdk5.core` (`packages/cdk5/src/minis.js`, kit
  b), both props of the design room (their cards from `packages/cdk5/src/props.json`).
- British spelling, English only. The open questions are C1 to C10 in `docs/questions-for-authors.md`; its permission row
  in `docs/data-and-permissions.md` is marked TO FILL.

## The pass story (`packages/pass/main.js`) is built the same way

`packages/pass/main.js` ("Pass it on", in German "Weitersagen!", the institute's outreach story for about 12 and up) is
generated from `packages/pass/src/` (`node packages/pass/src/build.mjs`, `--check` as for the tour; `node packages/pass/src/test-sets.mjs`
checks the sets without a browser): the shared kit (`tools/engine/kit.js`), the airports story's globe and the cell map story's cell, three sets
and engine parts adapted from the qubits story's (the life-size parts from the flock's). `packages/pass/src/SPEC.md` is the
contract.

- **The globe and the cell are the originals, unchanged.** The build cuts whole sections and named declarations out of
  `packages/airports/main.js` and `packages/spatial/main.js` (`ORIGINALS` in `build.mjs`), each inside a function of its own
  (`PASS_AIRPORTS`, `PASS_SPATIAL`), and the `globe` and `cell` sets wrap them: their own `buildScene`, data, shaders
  and look, driven from params as their stories drive them. One source of truth: **rebuild the pass story after any
  change to either original** (`--check` says when it is out of date; a marker that moved stops the build with its
  name). Never change those two stories for this one's sake.
- **Two languages.** Every word of this story is in English and German: `STR` (`[English, German]` by key, read
  through `T(key, ...values)`) in `engine/e2_text.js` for the panel, the headset's panels, the story's labels and the
  explore panes, and each set's own `setLang` for its labels and controls (a getter). A switch (EN | DE) sits on the
  story panel and above the explore tabs, page and headset (`setLang`, which redraws everything at once). The
  language is per device: German when `navigator.language` is, kept in `localStorage` (`passLang`), `#pass&lang=de`
  or `&lang=en` in a link; never in `collab.state()`. The shell's own words (top bar, Stories screen, menu) stay
  English. British English, and plain, natural German for a 12-year-old ("du"), not word for word; the cell's
  protein names (their roles are in German, `ROLE_DE`) and most city names stay as in their stories (open, see `docs/questions-for-authors.md`).
  Add a string in both languages, or the smoke test fails.
- **The narration in two languages.** One recording per language, on one timeline (`NARRATION_SYNC`, `NARRATION_ENDS`
  the later of the two): `packages/pass/audio/narration.mp3` (English, Kokoro's `af_heart`) and `packages/pass/audio/narration-de.mp3`
  (German, Piper's Thorsten voice), both made by `node tools/voice/narrate.mjs pass` from the text in each language
  (each stretch as long as the longer of the two lines needs). The story plays the language on show (`AUDIO` and
  `audioLang` in `engine/e7_app.js`, from `setLang`): switched, page or headset, the other file is loaded in place
  through `HOST.audio.narration` (the shell keeps one file at a time; while Web Audio decodes it the `<audio>` element
  plays it), the clock, playing and the slideshow kept (checked in headless Chromium; untested on a headset). A missing file leaves that language silent. In a shared room each device plays
  its own language on the station's clock (the language stays out of `collab.state()`). After the text changes in
  either language, run `narrate.mjs pass` again and check both (`node tools/voice/check.mjs pass` and `--lang de`);
  the German pronunciations are in `tools/voice/say.json`'s `de` section. How the German voice sounds is unheard here.
- **Life size and tabletop in one story.** The fish are life size as the flock is (1 unit is 1 m, eyes at 1.6 m): on a
  screen a wide lens (the `lens` track, 58 degrees among the fish, 32 for the globe and the cell) and the flock's
  `followView`; in a headset the fish set hangs in a holder (`GL.life`, `placeLife`) that undoes the pose `xrPlace`
  gives `GL.world` for the globe and the cell, so the school stays round you while the other two float in front of
  you. In passthrough the sea is hidden (`fish_water` 0, per device) and the school swims in your room at a third of
  life size, shrunk round your eyes so it stays at eye level (round the floor it swam a metre below them: "too low" on
  the Quest). The rise to the globe shrinks the sea on a screen (`fish_scale`) and only fades it in a headset (the
  viewer never moves). Among the fish the ray hits the sea (`kind: 'sea'`): in explore mode the trigger is the shark,
  and the grip moves the school (`XR.lifeOff`, the holder's offset in the rig's frame, eased; `carrySea` in
  `engine/e5_xr.js`): it follows the hand's move, one hand at a time, within 2 m up or down and 6 m to the side. Outside
  a room it is per device (`XR.lifeTo`: people differ in height), reset by Recenter and for a new wearer. At a station
  it is the station's, for everyone there (`XR.lifeSt`, `sea` in `collab.state()`, metres in the station rig's frame to
  the centimetre: every headset there has the station's spot as its rig, so it is one place in the room, and the
  school's frame, where `fishSync` works, moves with it); moved in all three directions where `HOST.anchor.locked`
  allows the grip, gliding in on the others' headsets, never reset by Recenter, a new wearer or a new session; walking
  away goes back to your own; a screen following the station keeps and passes it on but draws nothing differently.
  Never in the `place` hook. While it is carried no shark steering starts. The school's height, the grip and the new shark were checked on a Quest 3, with the endotype junction over a real
  wall, the PET scanner's base and the fitted card titles.
- **The outbreak** is the globe set's seeded S/E/I/R model on the real route network: the same start and settings give
  the same outbreak on every device, so a shared room shares only those; each person plays its days. The story and
  the Outbreak tab say it is a simple model, not a forecast.
- Explore: Fish (be the shark: the pointer, a controller's ray with the trigger held, or a tracked hand's index
  fingertip; let go while Be the shark is on, the shark stays, cruising round the school and through it now and then,
  clear of your head, until you steer it again, turn Be the shark off or leave the fish (the set's `hold`, from
  `sharking()` every frame); the story's sharks and Now and then pass through and go; neighbours watched 1 to 12;
  links; the school's size), Outbreak (pick any airport on the globe, by click,
  ray or search, as the start or to look it up; play, the day, the chart of cities in each state, the settings), Cell
  (a protein's places and partners there, the cell map's seven moves and what each changes) and Scenes. In a shared
  room the school belongs to the station as the flock does (`fishSync`), fish by fish (the leader's every fish three
  times a second, the quiet effect `fishes`: the flock's `birds`).
- **Up to four sharks at once** (the owner's wish: be the shark shared with everyone at the station; the set's `MAXS`): passing ones (the story's, Now and then, one sent, one let go and swimming off) and people's own. At
  a station everyone there sees every shark and every school flees all of them (each fish from each shark within
  4.5 m, the forces added up; the warning passes on as before). Be the shark there: yours goes to the others as the
  quiet effect `steered` about 15 times a second while you steer it or keep it (`fishSend`: where it is drawn now, in
  the set's frame, how it moves and swims, your member id and colour; once more with `off` as you let it go, and it
  swims off there as here), and theirs are drawn here 120 ms behind their samples (the relay's time, `clock`), between
  the two samples round that moment (a cubic along their velocities), past the last for at most half a second; with
  none for 1.5 s it swims off as a passing one does (taken up again if they go on). Each person's shark is tinted
  with their colour (the shell's member colour: its back takes a little of it and a faint glow of it runs along its
  edge; it still reads as a shark); passing ones keep the shark's own colours. The fish flee another person's shark
  where it is now (its drawn place carried on by its velocity for those 120 ms), as its owner's fish do. A fifth
  shark wanted: a passing one is not sent (Send a shark greyed: *Four sharks already*; the story's and Now and then
  wait), a steered one (yours, or another person's) takes the place of the oldest passing one, which goes, and with
  four people's sharks swimming yours is refused and the panel says so (`f.full`: "Four sharks are swimming already.
  Wait until one swims off." in both languages). Outside a room it works as before (yours, the story's and the ones
  you send), only now several may swim at once. The school, fish by fish, as the flock's birds (see the flock's
  notes: `pack`, `align`, `fishSend`; about 3.6 KB for 300 fish, 7.2 KB for 600): measured in Node, a follower 3.7 m
  off (median) within 0.15 m after 1 s and 3 mm after 3 s, and 2 mm with a shark passing through both; in headless
  Chromium, three pages drawing in software at 4 to 5 frames a second, a follower's fish 1 to 8 cm from the leader's
  (median) alone and 4 cm with two people's sharks in the school, and another person's shark drawn on a third page
  within 0.3 m of where its owner had it 120 ms before. Untested on headsets: how four sharks and their tints look,
  and how others' sharks and the school feel at these rates over Wi-Fi.

## The flock (`packages/flock/`, a story package since v186) is built the same way

`packages/flock/main.js` is generated from `packages/flock/src/` (`node packages/flock/src/build.mjs`,
`--check` as for the tour): the shared kit (`tools/engine/kit.js`), one set (`sets/flock.js`, manifest
`sets/flock.md`) and engine parts adapted from the tour's (no Proteins tab, no
scene list).

- The set is a live simulation, so unlike other sets its `update` is not a pure
  function of the params and the time: 200 birds (100 to 400) in steps of a
  thirtieth of a second (the birds glide on between steps in the shader); each
  follows its seven nearest neighbours (the neighbour search is a sorted grid),
  keeps its distance, and flees a falcon, with alarm passing from neighbour to
  neighbour; the flock as a whole follows a whim (a heading turning now left,
  now right) and a weak pull to a roost in front of you, and every 88 s swoops
  round you. A story key `flock_hunt` sends a falcon each time it passes a whole
  number. Tune the flight by numbers (bearing rate, distance, reversals), not
  by eye: the flock and the screen camera are easy to make dizzying.
- Life size: 1 unit is 1 m, the viewer stands at the origin, the ground is
  y = 0, the sunset is towards -z. In a headset `xrPlace` puts the land under
  your feet (a standing eye height, 1.6 m, below the rig: the reference space
  is `local`, so the floor is unknown) and never moves it; the grip moves only
  the panel. In passthrough AR the sky and the land are hidden (`flock_sky` 0)
  and the flock flies in your room at a third of life size.
- The engine tells the set where you are every frame (`see(head, hands)`, in
  its frame: the head and controllers in a headset; on a screen a fixed spot,
  1.6 m above the middle of the field, so the flock never follows the camera),
  and `scatter(dir)` sends a falcon where you point (a click on the sky, or the
  trigger pointed at the sky).
- In a shared room the flock belongs to the station (`flockSync` in
  `engine/e4_explore.js`): the set's origin is the station's spot on every
  device, and it roosts and swoops round that spot instead of round each viewer
  (`see(head, hands, spot)`). Every device there sends where its flock is twice
  a second (a quiet effect `flock`: its flight time, middle and velocity, and
  since when it is there); the one there longest leads (heard in the last 2 s;
  a page back from a pause or a hidden tab counts as new; ties by member id), so
  a newcomer never pulls the others' flock to its own: the others take its
  flight time (so the roost and the whim match), and every bird gets the same
  pull towards the leader's middle (a damped spring; more than 12 m off, as on
  joining, the flock moves there at once: the set's `follow`). Only the leader
  sends falcons of its own (the story's and *Now and then*; a page new at the
  station listens 1.5 s first, the set's `hush`); every falcon,
  also one someone points at the sky, goes out as it starts (`onLaunch`, the
  effect `falcon`), so all see the same one; up to four in the air at once (the
  set's `MAXF`: a fifth
  is not launched here, and Send a falcon says *Four falcons already*; one from
  another device takes the place of the oldest, so two devices that each sent a
  fourth at once, or one still flying a falcon gone elsewhere, end with the same
  four; Now and then waits while one is in the air), and the birds
  flee every falcon near them. Every value from another device is bounded
  (positions and velocities under 10 km in size, a snapshot whose fish or birds
  would not be finite is ignored), and who sent an effect is the relay's word for
  it (the shell passes it to the story's `effect(type, data, by)`), not its data's.
- Bird by bird (the owner's wish: the birds shared exactly): while
  anyone else is at the station the leader also sends every bird three times a
  second (the quiet effect `birds`, from `flockSend` after the frame's step, so
  where they are drawn now: the set's `pack`, positions in cm from the flock's
  middle as 16-bit numbers and velocities in steps of 0.15 m/s as 8-bit ones, 9
  bytes a bird in base64, about 2.4 KB for 200 and 4.8 KB for 400, well under the
  relay's 64 KB a message; with presence, `flock` and `birds` a page sends some
  20 messages a second, under the relay's 60). The others take only the one they
  follow, with as many birds (the count is in `state()`): each bird's difference
  from the leader's, carried on by its velocity to the moment this page's flock is
  drawn at, is taken up frame by frame (`align`: time constant 0.25 s, at most
  12 m/s, so no bird jumps and the shader's gliding between steps stays smooth),
  on top of the flock's own flight, which is the same on both, so they stay in
  step between snapshots; far apart, as on joining, the birds are first paired
  afresh, each of the leader's with the nearest of ours, ours only renumbered, so
  none crosses the flock. A bird's own wingbeat and lean are the same on every
  device (drawn once at the start, by index). Times are the relay's at the frame
  a thing was drawn in (`FSY.at`; what a page sends goes after its step), and a
  leader whose frames come slower than ten a second (its steps fall behind) says
  its pace, which the others carry what it sends on at. Measured: in Node, two
  flocks 13 m apart (median) within 0.18 m after 1 s and 0.01 m after 3 s; in
  headless Chromium, three pages drawing in software at 5 to 10 frames a second,
  0.03 to 0.1 m with no falcon and 0.1 to 0.48 m with two passing (the median
  distance between a follower's bird and the leader's at the same moment).
  Untested on headsets.
- On a screen the camera stands where you do and turns to follow the flock
  (`followView`: a dead zone, eased turns of up to 50 degrees a second; from
  afar it aims at the flock instead and comes round to the view's side at up
  to 60); dragging takes the camera over (View: Look around). Wings and reeds
  move on real time, so they keep moving while the story is paused.

## The robot gang (`packages/robots/`, a story package since v185) is built the same way

The first of the app's stories moved into a story package (`docs/packages-migration.md`, `tools/packages/move.mjs`):
`packages/robots/main.js` is generated from `packages/robots/src/` (`node packages/robots/src/build.mjs`, `--check` as
for the tour; then `node tools/packages/scan.mjs`): the shared kit (`tools/engine/kit.js`), one set (`sets/robots.js`,
manifest `sets/robots.md`) and engine parts adapted from the flock's. `packages/robots/src/SPEC.md` is the contract
between them. Its narration is `packages/robots/audio/narration.mp3` (`narrationFile()` through `HOST.pkgUrl`), its
`story.json` carries its list entry (`icon: "robots.robots"`, `life`, `needs: 185`), its place on the Stories screen
is `packages/order.json`'s.

- A live simulation, like the flock: `update(S, t, dt)` advances it (steps of at
  most 1/60 s), and seeking the story changes only the params (the rule, the
  count), not the robots' past. Robots are discs (radius 0.17 m) that drive
  like real ones (turn on the spot, smooth speed); the rule (`robots_rule`:
  dock, bump and turn, follow you, conga line, keep away) only changes their
  targets, so a switch is smooth. They never leave the floor polygon, never
  overlap, and bump off walls, furniture, each other and your feet. The
  counters `robots_dust` and `robots_crumbs` act each time they pass a whole
  number. Tests and `sweep.mjs` run it fast with `simStory(t0, t1)` and
  `simExplore(sec)`.
- The set works on a room description in its own frame (floor at y = 0,
  1 unit = 1 m): `{ kind: 'model' | 'real' | 'box', floor, walls, blocks }`,
  given with `setRoom()` (it rebuilds the colliders, the floor texture and the
  drawn room, but skips a room that has not changed to the centimetre, and a
  refined room of the same kind keeps its cleaned floor; a floor under 1 m² or
  too thin for a robot gives way to a box room). On a screen it is the model living room
  and you are an avatar: a click on the floor walks it there (`floorPoint`,
  then `walkTo`), a drag turns the view.
- In a headset the room is yours. Every story asks for `plane-detection` and
  `mesh-detection` as optional features when it starts an AR session (a session
  survives story changes; VR asks for no room scan, so the robots get the
  virtual room there and no *Set up your room*), and `xrRoom` (`engine/e5_xr.js`) reads
  `frame.detectedPlanes` and `frame.detectedMeshes` (only when
  `session.enabledFeatures` lists them, inside try/catch) when they change,
  once a second besides (poses can move on their own, and a first read may
  come before tracking has them), at most twice a second, and at once after a
  reference-space reset; a reset's transform carries the robots, piles and
  cleaned floor to the new coordinates (`shift`; without one they start again
  from the dock). The
  floor is the plane labelled floor; walls are planes labelled wall (or tall
  unlabelled ones); furniture is seats, cupboards, beds and detected volumes
  (tables and desks are left out, and volumes raised more than 12 cm off the
  floor: the robots go under them).
- A real room must not move with the rig, which carries the panels and may be
  anchored: `GL.world` is the reference space moved down to the floor (world
  matrix = inverse(rig) x translation(0, floor, 0)), so set x and z are
  reference x and z. Without a room (no feature, no room setup) a virtual
  room hangs on the rig 1.6 m below your head, as the flock's land does: the
  model living room in VR, a bare 4 m x 5 m box in passthrough; the panel then
  offers *Set up your room* (`initiateRoomCapture`, once a session), and
  planes that arrive later take over. Nothing here moves `GL.rig`.
- Your head is the player (no avatar), the trigger aimed at the floor spills
  crumbs there, and the grip moves only the panel (outside a shared room). In passthrough
  (`robots_room` 0) nothing opaque is drawn: a glowing line along each wall's
  base, ripples where a robot bumps it, and the cleaned trail.
- The cleaned floor (a DataTexture of the room's cells, about 335 KB) goes to the GPU at most ten times a second, in a
  headset every 0.4 s, and only the boxes of the cells cleaned since the last time (a box per trail: a disc
  joins the box it touches, `MAP.boxes`; `mapSend` sends each through the renderer's `copyTextureToTexture`,
  texSubImage2D from a small copy of its rows); a new map, the dust again, more than 32 boxes or boxes over half the map
  together send all of it, as before (also in the set's harness, which has no `GL.renderer`). How the trail's 0.4 s
  steps look on a headset is untested.

## The tutorial (`packages/tutorial/`, a story package since v186) is built the same way

`packages/tutorial/main.js` is generated from `packages/tutorial/src/` (`node packages/tutorial/src/build.mjs`, `--check` as for the
tour): the shared kit, the guide's script (`sets/script.js`: `GUIDE`, `SCRIPT`, `compileScript`, `evalGuide`; plain
maths, no THREE), one set (`sets/guide.js`, manifest `sets/guide.md`) and engine parts adapted from the flock's.
`packages/tutorial/src/SPEC.md` is the plan (v173); its Review notes say where the build differs.

- An introduction, not one of the first sixteen stories: a package since v186, last in `packages/order.json` (since v180; it was first
  in `stories/list.js`) with `intro: true` (the shell skips it for
  the default start, Repeat all and `HOST.count()`; `docs/agents/shell.md`), `needs: 173` (it needs `HOST.needBodies`
  and the story sets of `bodies.js`). It was the seventeenth card when written (v173); the main set has fifteen cards and the Experiments card now, and
  Arrange all takes only the main set.
- The guide is the people's armour figure, drawn by a draw set of the story's own (`HOST.bodies.set(2)`, attached to
  `GL.scene`, `I.toWorld` the set's frame; `docs/agents/shared-rooms.md`, "A story's own figures"), not by the overlay:
  so it draws on a page too. The load waits up to 8 s for `bodies.js` (`sceneJoin`); without it (an older shell, no
  float vertex textures, `?nofvt`) a plain figure of boxes and cylinders stands in. `dispose()` disposes the body set
  first (its geometries are shared with every other set).
- Not a live simulation: everything is `evalGuide(G, guide_clock, live)`, a pure function of the story's clock
  (`guide_clock`, keyed linear 0 to 187 in `LIN`) in story seconds; `SCRIPT` is written per chapter in seconds from the
  chapter's start, so `narrate.mjs`'s retiming moves it with the words. `live` (the viewer's head and ray, the panel's
  buttons) only turns its head and aims the end's pointing. The solver's state is re-warmed after a jump (30
  solve-only steps over the second before); its `dt` is the clock's step, so a pause freezes it mid-step.
- Rules (`node packages/tutorial/src/test-script.mjs`, a cheap check run on `dev` too): its head never nearer than 1.2 m to the
  viewer's start (x, z); walks at most 0.7 m/s at cruise and glides at least 1.6 m/s (story time) and 1.3 m/s (real
  time, with the built `NARRATION_SYNC`); no 0.3 s between 0.85 and 1.15 m/s; the head at most 1.02 x 1.62 m; every
  key inside its chapter; tags in order; at most 4 sound onsets in 3 s (a `seq` run aside); the network's degrees.
  `--words` counts the spoken words (at most 415). Run it again after `narrate.mjs` or `pace.mjs`.
- In a headset the set's frame hangs under the rig at the floor: the floor plane's height where the session reports
  planes (labelled floor, the largest; else the lowest large upward plane over a metre below the head; read once a
  second until found, re-placed only if it moves more than 5 cm: `xrPosed`), else 1.6 m below the head (the flock's
  rule). The same in VR and AR; AR draws no floor and no stars, VR the stars at a tenth. It never moves `GL.rig`;
  the grip moves only the panel.
- The narration hold (`HOLD`, `holdCan`, `holdStep` in `e3_story.js`): once a session, at 7.8 s, the story waits for the
  voice (the guide points at the panel's Sound button, Narration off, a sign says so) when there is a recording,
  narration is off, this device's sound is on, in a real session, outside a shared room, `localStorage` `tutorialHold`
  is not `off` (every test page sets it) and the story played into 7.8 s. Narration on, or Play, goes on.
- Explore mode is practice (`e4_explore.js`): seven tasks (point at the hub, send a signal, pause then play, another
  marker, open the menu, Recenter, move with the sticks in VR or walk round it in AR), greyed with the reason where they
  cannot be done (a page: the last three; anchored: Recenter; the sticks where `HOST.xr.walkWhy()` refuses). The ticks
  are this device's own (`sessionStorage` `tutorialTicks`), never in `state()`. Task 6 counts the menu's Recenter (the
  story's `recenter` hook, wrapped) and the panel's (the edge of `XR.needRecenter`). The guide runs on practice's own
  clock (an idle loop, reactions, a nudge after 15 s with nothing done; from v181 the guide is never quite still in story or practice: breathing, a weight shift, small head and hand drifts, arms swinging on a walk, softer turns: `gLife` in `packages/tutorial/src/sets/script.js`); the foot bar is practice's (Play and Pause, the
  marker arrows).
- `collab.state()` is `{ net: 'badge' | 'grown', mk: -1..4, run: 0 | 1 }` (`mk` -1: at home); a signal is an effect
  (`sig`, `{ n }`). The guide is never sent: every device draws it from the station's clock.
- Without its recording the story is paced by `node tools/pace.mjs <url> --write tutorial` (`NARRATION_ENDS` empty);
  the voice (`node tools/voice/narrate.mjs tutorial`, Kokoro `af_heart`) is still to be made. Sounds only through
  `HOST.audio.fx` (`sfxCue`, 47 cues; `MANY.tutorial = 70` in `tools/sfx-cues.mjs`), no background.
- British English. The credits say its moves and words were written by Claude.

## Back into the cell (`packages/ppicell/`, a story package) is built the same way

- Its plan, data, sets and chapters: `packages/ppicell/src/SPEC.md`; its sources and credits: `packages/ppicell/README.md`.
  Sets in `src/sets/` (`cell`, `ball`, `crowd`, `walls`, `lens`, `sites`, `next`) over `PDATA` (`pdata.js`, the
  interactome and the Atlas's places) and, since v205, `PSIDES` (`psides.js` over `sides.js`: UniProt's membrane sides
  and the Complex Portal's complexes, `src/data/gen_sides.py`; `node packages/ppicell/src/data/test-sides.mjs`).
- Its protein models: the load waits for all sixteen it draws (`molPrep`'s first call fetches them side by side). v225
  made the lenses' and the sites' sets after the load (a stand-in without models until theirs came); its review round
  took that back, since a seek, a room's jump, explore mode or an opening `&t=` into chapter 6 or 8 before those models
  came showed the chapter without its lenses or sites, with no loading card. A set made after the load needs a hold
  (the clock and the narration waiting, the loading card shown) before it can come back. The credits come from `models/index.json` (`MOL_CREDITS`, pasted in by `build.mjs`); the crowd's four molecules are
  drawn only as balls (`structs.js`, now only those balls: `src/data/gen_structs.py`) and their models are not fetched.
- The judgement (v205): carried sides (UniProt's where it names the place, else the protein's own build; no signal
  taken as the cytosol's side, said in the story to be a rule with exceptions), the unknown ones strict; the cell's
  `cell_sides` (0 none, 1 named, 2 carried) and `cell_faces` (the unknown sides' reading). Every count the story shows
  comes from that, computed as the page runs; the old judgement without sides stays computable (explore mode's
  *Sides: None*, the *Why red?* chapter compares).
- Complexes: chapter 6 *Machines* and explore mode's *Complexes* switch and complex pick (`cell_cxs`, `cell_cxp`,
  `cell_cxon`, `cell_cxa`): dots of their own in a ring, one Points and one LineSegments draw for all. Never call a
  complex listed apart wrong: the story says an address is off, not the link.
- The Network tab (v207, explore mode only; `src/SPEC.md`, "Your own network", stages 1 and 2): the method run in the
  page (`src/sets/pnet.js`, `PNET`: limits, judgement, the links drawn, the communities, reading and mapping a chosen
  network; `node packages/ppicell/src/data/test-pnet.mjs`), the cell one network per model and limits (`makeNet`),
  built in 4 ms slices a frame in explore mode (`cell_live`), at once in the story. At every limit's default the
  picture is v205's (the generator's communities): keep it so, the told story never changes. The limits are shared
  (`lim` in `collab.state()`, v 4, FORMAT `networks-58`) and in the address (`&links=`, `&support=`, `&rel=`,
  `&places=`, `&group=off`); a network chosen on a page (`src/engine/e4b_network.js`, `OWNN`) never is: not sent, not
  in `state()`, kept (IndexedDB) only when asked; its lookup `data/lookup.json` (`src/data/gen_lookup.py`) and example
  `data/example.txt` (`src/data/gen_example.mjs`) are generated. Every new pane twice (`renderNet`, `drawNetPane`).
- Shared networks (v208, `src/SPEC.md`, "Stage 3"; `SNET` in `src/engine/e4b_network.js`): a network of one's own goes
  to the relay only on *Share with this room* / *Put on the relay* (each with its sentence; absent, with a line why, without
  a relay that keeps them), as `PNET.toDoc`'s form (symbols, links, kinds, scores, the file's name: nothing else), kept by
  `relay/nets.mjs` under an id from its content. The station's state names it (`net`, v 5, FORMAT `networks-59`); every
  device fetches it and builds it between frames (`PNET.fromDoc`, `netLoad`), the room's state kept meanwhile
  (`SNET.pend`, what `collabState()` gives) and applied once it shows; a device that cannot have it says why and shows
  the built-in network. `#ppicell&explore&net=<id>` opens one; the headset's tab lists the relay's. Test: `node
  tools/collab.mjs --net`, `node relay/test.mjs --nets`.
- Export for wwiznet (v211, `src/SPEC.md`, "Export for wwiznet"): `src/sets/pwiz.js` (`PWIZ`, no DOM) writes a wwiznet
  dataset (nodes.tsv per protein and place, edges.tsv with verdicts, config.json, a guide window) from the cell's
  `api().wiz()`; the Network tab's *Export for wwiznet (ZIP)* (page only, a ZIP made in the page) and
  `node packages/ppicell/src/export-wwiznet.mjs <out>` (the cell set run in Node with three.js: the same bytes). Test:
  `node packages/ppicell/src/data/test-wiz.mjs`. The chooser and `--net` also take a wwiznet dataset (edges.tsv, with
  nodes.tsv if given; `PNET.wizKind`, `wizRead`): only the ends, one score, one kind and the column naming the
  protein are read, the rest skipped and never kept or sent; an exported dataset opens again as the same network.
- The voice: synthetic (Kokoro). After its words change, `node tools/voice/narrate.mjs ppicell` and `check.mjs ppicell`
  where Kokoro is; until then (v205) it runs on subtitles with a table laid out on estimated durations
  (`packages/ppicell/README.md`, "The voice").
- British spelling; "in this map" for counts on the set; the Complex Portal's terms are to confirm before `main`.

## Invisible threads, the exposome story (`packages/exposome/`, a story package on the Experiments set) is built the same way

`packages/exposome/main.js` ("Invisible threads", the chemical exposome; `list: "experiments"`, in `packages/order.json`
after cdk5, so `tools/engine/all.mjs` builds it and `version.json` lists it) is built from `packages/exposome/src/` as
the template's packages are (`node packages/exposome/src/build.mjs`, `--check`; then `node tools/packages/scan.mjs`).
`src/SCRIPT.md` is its script (the main conversation's), `src/SPEC.md` the contract (data, numbers against the paper,
chapters and scene track, sets and their params, explore mode, headset); `README.md` its sources. Eight chapters, about
nine minutes and fifty seconds (`NARRATION_SYNC` provisional until the voice is rendered).

- The science and data: Lombardo, Hütter, Unterlass and Menche, Nat Commun 17, 5754 (2026); their deposit (Zenodo
  18793297, CC BY 4.0) stays out of the repository. `python3 -I packages/exposome/src/data/gen_data.py <deposit>
  <cell.json>` (numpy, pandas, openpyxl; pickles through a restricted unpickler) writes derived numbers only:
  `src/sets/data.js` (`EXPO_DATA`, embedded, about 1 MB) and `data/targets.bin`, `ppi.bin`, `diseases.bin`,
  `names.json` (about 3.9 MB, fetched when a set's `prep` or a pane needs them). `src/sets/xdata.js` (`XDATA`) is the
  only way in; `node packages/exposome/src/test-data.mjs` checks it against the paper's numbers. Every number on a
  panel or a pane comes from it, the printed ones too (`meta.cited`: the correlation, 42 million PubMed records, the
  E-PRTR years; `meta.dis.zClose`, the authors' z cut; `meta.levels.bigMin`, 50 for a large group; `meta.drawn` and
  `meta.ppi.drawn`, the links drawn). A rerun may reshuffle `src/data/terms.json`'s member samples: keep the committed one.
- The sets (`src/sets/`): `cloud` (9,764 substances: a drifting cloud round you, our shelves by chemical family, the
  authors' layout; 45,000 drawn links; colours by family, `LOOK.family`, ours, or by community, the authors'), `pair`
  (diethylstilbestrol and zearalenone, their genes and the shared ones, tied: `PAIR_NAMES`, the same two lit at the end
  of chapter reach, as the data says both touch CASP3), `clot` (the fine group 11_2_1, its four named and SERPINC1),
  `cell` (*Back into the cell*'s model cell, its proteins where that story puts them, a substance's threads in, CASP3's
  out), `ppi` (the interactome, in the cell then sorted, our arrangement; the four patterns, hazard flares, a disease
  drawn together, the steps, a sample of the pairs) and `globe` (the airports story's globe turned to Europe: the
  countries, their releases, Italy and endrin, the score columns). Tags say what is ours or a sample ("our arrangement",
  "drawn together here", "A sample", "7,000 threads drawn", from the data). In the story's dive into the clotting group
  the larger and smaller groups are tagged plainly ("A larger group · 266 substances"); explore names them.
- The app computes nothing scientific: the communities (Louvain: 125 top, 152 middle, 456 fine, renamed as the authors'
  notebook does), their colours and the network's 3D layout are the authors'; the shelves by chemistry, their colours
  and the sorted interactome are ours, said so. Plain words for the communities are hand-written in
  `src/data/labels.json` from `src/data/terms.json` (the enrichment with FDR): label only what the terms support; the
  three named in chapter sort (`SORT_EXAMPLES`: top groups 3, 9, 16) are spoken from them.
- Reads two other packages' sources at build time, never edits them: `packages/ppicell/src/sets/cell.js` (the model
  cell: its proteins' places through `src/data/gen_cell.mjs`, and its skins cut by `src/c-cut.mjs`) and
  `packages/airports/main.js` (the globe, cut as the pass story does). Rebuild after either changes (it is listed with
  the pass story among the readers in `AGENTS.md`, "Rebuild the dependants"; the relay's `--build` finds the cell from
  the line naming it in `src/build.mjs`).
- Headset: not life size; chapters cloud and end stand you inside the cloud (`standB`, by story time), whose points
  fade within 0.35 m of your head; `cell`, `ppi` and `globe` keep clear (`keepClear`: the engine's `xrCap~2` with the
  frame's time and its sampling, `xrPrep`, run from `frameFloor` since this story keeps the engine's plain `frame`; the
  interactome's points move in their shaders, so `ppi` keeps a hidden stand-in of every protein in the cell and sorted
  for the sampling). Untested on a headset. (After v226, 27 November 2026) The cloud's and the globe's draw hooks read
  the camera only from its `matrixWorld`: v212 to v226 the cloud called `camera.getWorldDirection`, which on three.js
  r128's eye camera (its pose only in its matrix) put both eyes at the space's origin for all drawn after it, the
  owner's "beams way lower than the hands, the exposome stuck to my head" (smoke: `<key>: draw hooks leave a headset's eye camera where it is`).
  The rule for every story's draw hooks (`onBeforeRender`, `onAfterRender`): read the camera you are handed only through
  `camera.matrixWorld` (and `matrixWorldInverse`, `projectionMatrix`): `setFromMatrixPosition(camera.matrixWorld)`, `new
  Vector3(0, 0, -1).transformDirection(camera.matrixWorld)`, `q.setFromRotationMatrix(camera.matrixWorld)`; never
  `getWorld*`, `lookAt` or `updateMatrix*` on it. Since v228 the shell's lock makes those calls harmless on a headset's
  eyes (`docs/agents/shell.md`, "The headset's eyes are the shell's") and `tools/packages/check.mjs` refuses them; the
  pass story's globe and cell probes, which called `cam.getWorldQuaternion` on a page's camera only, read
  `matrixWorld` too since v228.
- Explore: Scene, Substances (families as swatches in the shelves' colours), Groups, Diseases, Countries, each pane
  twice (HTML and the headset's canvas, the notes under every card in both). Address: `&sub=`, `&group=`, `&dis=`
  (opens the Diseases tab and the interactome), `&country=` (the Countries tab and the globe), `&csub=`. Shared state
  `{ v: 1, tab, scene, ctl, b: { sub, comm }, c: { dis, country, sub } }`; no effects; `FORMAT` unchanged by adding it.
- Wording: "disturbs" or "touches" a gene, "close in the map", "more common where", never "causes"; no brand names;
  countries by their rates only; no health advice. British spelling.

## The design room (`stories/design.js`) is built the same way

Parked since v217 (`tools/design/`, its `README.md`; the owner, 26 November 2026): out of the app, no longer in
`STORY_EXTRA`, built only by hand. What follows describes it as it was.

`stories/design.js` (the props table) is generated from `tools/design/` (`node tools/design/build.mjs`, `--check` as
for the tour): the shared kit (`tools/engine/kit.js`), the shell's own props' cards (`DESIGN_CARDS`, made at build time
from `tools/design/props.json` and `tools/lowpoly/shell.js`: none yet), one set (`sets/table.js`) and engine parts
adapted from the flock's (the shared-room, headset-setting and subtitle lines copied unchanged). `tools/design/SPEC.md`
is the contract. Since v190 the stories' miniatures and their cards are the packages' own (`packages/<key>/minis.js`,
from `src/minis.js` and `src/props.json` by `node tools/lowpoly/build.mjs`; `tools/packages/SPEC.md`, "Miniatures"): the
room loads every listed package's file before it lays out the table (`HOST.lowpoly('*')`, at most 8 s, `takeCards`), the
packages in the table's order before v190 (`TABLE_ORDER`), any other after them, so a new package's miniatures stand on
the table without a rebuild here.

- **Not one of the stories** (a table with the low-poly versions of all props): its entry is in `STORY_EXTRA`, so it is on no Stories screen and not counted;
  `#design` or `HOST.go('design')` opens it, and `tools/release.mjs` lists it in `version.json` (live updates swap it).
  No narration and no chapters: it opens straight into explore mode, the table; its one short intro line (6 s) plays
  for a new wearer or Intro, and its end never starts Repeat.
- **The table**, life size like the flock's land (1 unit is 1 m, the floor 1.6 m under your eyes in a headset): round,
  2.3 m across, its top at 0.86 m and its middle 1.55 m in front of you; a plate per story round the rim in the story's
  colour with a place card (kicker and title), its miniatures (12 cm, from its package's `minis.js`, built a few per frame so the
  table fills in without a stall) on rings from the rim in; in the middle the stage, where the picked prop stands 40 cm
  tall and turns. Lit as the props are (sky light, a light over your shoulder, a cool rim light), dark navy.
- **Few draws**: each miniature is merged as it is built into at most two meshes (`mergeMini` in `sets/table.js`: its
  opaque parts and its see-through ones), every part's colour and look carried per vertex (`aMat`: its material's
  colour, roughness, metalness and its glow in its own colour; `aSee`: its opacity and whether it adds its light), drawn
  by two `MeshStandardMaterial`s shared by every miniature (`miniMat`, their shaders patched in `onBeforeCompile`; the
  see-through one premultiplied, so a part that adds its light, haze, leaves what is behind it as it was, its alpha too);
  a two-sided part is doubled with its faces and normals turned, so both stay one-sided, and see-through parts keep their
  order (glass before haze). The plates, their glowing edges, the place cards' faces and backs and the homes' discs and
  rings are one mesh each (`merged`), and what never moves has its matrices worked out once (`still`). The picking
  proxy, the hover rings and glow and the stage's copy (`clone()` of the merged group, its own matrix updated again) are
  as before. Measured in a pretend headset: 70 draws an eye (from 235), 1.5 ms of script a frame (from 4.4), 313
  objects (from 573), pictures of the table, a plate, from above and the stage as before (under 1 % of pixels apart,
  the stage's turning prop aside). How the merged miniatures look on a headset is untested.
- **Pointing** at a miniature (the mouse, a controller's ray, a hand) lights it and shows its name; a click, the
  trigger or a pinch puts it on the stage and its card on the panel (Prop: its name, story, what it shows, size and
  frame, params with range and meaning, named views, what reuses it, source and manifest; All props: every story's
  props to pick from). In a headset the grip picks a miniature up (it follows the hand and, free moving on, turns with
  it), both grips size it, let go it stays; *Tidy the table* puts them all back. On a screen the camera goes round the
  table (drag, wheel; View: the table, the stage, from above; a story's heading flies to its plate).
- **Shared rooms**: the same hook lines as every story. `state()` is the prop on the stage and one top-level field per
  miniature moved by hand (`[x, y, z, qx, qy, qz, qw, s]` in the table's frame, rounded), so two people moving two
  miniatures both keep theirs; no effects; `view()` null. In a room it is a station like a story's, placed from the
  headset's menu (*Design room here*) or the page's Shared dialog, never by Arrange all ("Shared rooms": "The design
  room in a room"); outside a room the menu's *Design room* opens it. Its station's icon is its own miniature,
  `design.table` (skipped by `tools/design/build.mjs`, as are the shell's circles' icons, `all.stories` and `all.lobby`:
  not props on the table).


## From CLAUDE.md

These notes were in `CLAUDE.md` (Notes for Claude Code); they are kept here word for word, beside the area they belong to.

- `packages/lbi/main.js` is built from `packages/lbi/src/`: edit there and run
  `node packages/lbi/src/build.mjs`. `packages/nmd/main.js` likewise from `packages/nmd/src/`
  (`node packages/nmd/src/build.mjs`; data from the authors' files, kept out of the repository, via
  `node packages/nmd/src/data/gen_data.mjs <folder>`). Never show patient or variant data in it.
  `packages/flock/main.js` likewise from `packages/flock/src/` (`node packages/flock/src/build.mjs`),
  and `packages/robots/main.js` from `packages/robots/src/` (`node packages/robots/src/build.mjs`; a story package
  since v185).
  `stories/design.js` (the design room, parked since v217, out of the app) likewise from `tools/design/`
  (`node tools/design/build.mjs`), its models and cards from the packages' `minis.js`, built from their `src/minis.js`
  and `src/props.json` (`node tools/lowpoly/build.mjs`; every miniature under 1,200 triangles, its `tris` exact).
  `packages/endo/main.js` likewise from `packages/endo/src/` (`node packages/endo/src/build.mjs`; data
  from the authors' files via `packages/endo/src/data/gen_data.py`, which are not in the
  repository); it includes `packages/nmd/src/sets/motor.js`, so rebuild it after changing that.
  `packages/pet/main.js` likewise from `packages/pet/src/` (`node packages/pet/src/build.mjs`; data from the paper's tables and the
  figures' readings in `packages/pet/src/data/figures.json` via `node packages/pet/src/data/gen_data.mjs`); it includes
  `packages/lbi/src/sets/body.js` and `packages/micro/src/sets/organs.js` (its opening network's 3D organs), so rebuild it after changing those. No patient data in it (the authors' VR viewer holds a
  patient's scan: never use its data).
  `packages/micro/main.js` likewise from `packages/micro/src/` (`node packages/micro/src/build.mjs`; data from Iva Buljan's GraphML, kept out of
  the repository, and the preprint's numbers via `node packages/micro/src/data/gen_data.mjs <graphml>`); it includes the tour's
  body and tissue sets (its organs are its own 3D models, `packages/micro/src/sets/organs.js`), so rebuild it after changing
  those.
  `packages/ovary/main.js` likewise from `packages/ovary/src/` (`node packages/ovary/src/build.mjs`; data from the poster's numbers, typed in,
  and the figures' readings in `packages/ovary/src/data/figures.json` via `node packages/ovary/src/data/gen_data.mjs`); it includes
  `packages/lbi/src/sets/body.js`, so rebuild it after changing that. Its neighbor network (and the network by kind) is
  illustrative and its count tags are read off the poster's lines (say so); no charts beyond the donors' histogram, and
  no GTEx image or picture from the poster in it. American spelling, as in the qubits story.
  `packages/qubits/main.js` likewise from `packages/qubits/src/` (`node packages/qubits/src/build.mjs`; its maths checked by
  `node packages/qubits/src/test-qmath.mjs`; example networks only, computed live, and the real run's numbers typed in from
  Joel Hancock's brief in `packages/qubits/src/sets/data.js`, shown only as "in the real network"). It and the aging ovary
  story use American spelling (color, gray, neighborhood, aging), as asked; keep it so there and British everywhere else.
  `packages/mutation/main.js` likewise from `packages/mutation/src/` (`node packages/mutation/src/build.mjs`; its maths checked by
  `node packages/mutation/src/test-mmath.mjs`; example numbers only, computed live, and the poster's numbers typed in
  `packages/mutation/src/sets/data.js`, shown only as "in the authors' test"). Its coupling, computed live, is our stand-in for
  the authors' circuit and says so; never call the circuit "better" or "more accurate". No patient data and none of the
  poster's pictures (its figures are redrawn in 3D). British spelling.
  `packages/topo/main.js` likewise from `packages/topo/src/` (`node packages/topo/src/build.mjs`; its data and decoders checked by
  `node packages/topo/src/test-data.mjs`; data from the authors' files via `packages/topo/src/data/gen_data.py`, which runs their
  package topocyte (GPL-3, offline only, none of its code copied) and the poster's figure scripts; the files are not in
  the repository). Every number is topocyte's: never write science in the app (no persistence, functional PCA,
  classifier or score computed there), only look up `TOPO_DATA` through `TDATA`. No GTEx ids, donor details or images,
  and none of the poster's pictures (slides are numbered); "Cancer cell" stays (the cell classifier's label, the
  author's wish). It includes `packages/lbi/src/sets/body.js` and `packages/micro/src/sets/organs.js`, so rebuild it after changing
  those. British spelling.
  `packages/soil/main.js` likewise from `packages/soil/src/` (`node packages/soil/src/build.mjs`; its data, decoders and key numbers checked
  by `node packages/soil/src/test-data.mjs`; data from the authors' three CSVs via `packages/soil/src/data/gen_data.py` and the
  slides' readings via `packages/soil/src/data/reconcile.py`, none of those files in the repository). Look numbers up in
  `SOIL_DATA` through `SDATA`; compute nothing scientific in the app. Unknowns are illustrative and say so; keep its
  hedges (the BNI wheat greener and leaking less in the slides' measurements; the microbes and their network follow the
  fertiliser and the plots, not the wheat line; rising together is not working together; strong indications, not yet
  proof) and the two N2O measurements as an open question. The network is ours, built for the story: never call a link
  an interaction or a hub a keystone. Kinds numbered, never named by their ids; no sequences, no pictures from the
  slides, no e-mail addresses. It includes `packages/topo/src/sets/look.js` and `packages/lbi/src/sets/web.js`, so rebuild it after
  changing those. British spelling.
  `packages/pass/main.js` likewise from `packages/pass/src/` (`node packages/pass/src/build.mjs`; its sets checked by
  `node packages/pass/src/test-sets.mjs`). Its globe and cell are cut, unchanged, out of `packages/airports/main.js` and
  `packages/spatial/main.js` at build time, so rebuild it after changing either. It is in English and German: every word in
  both (`STR` in `packages/pass/src/engine/e2_text.js`, the sets' own `setLang`), German plain and natural for a 12-year-old;
  the language is per device and never in `collab.state()`.


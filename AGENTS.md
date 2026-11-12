# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What this is

An installable web app that teaches network science in sixteen narrated stories
(the airports about four minutes, the proteins and the cell map about six, the tour about ten and a half, the muscle
story about nine, the endotype story about seven and a half, the PET story about six, the microanatomy story about eight,
the ovary story about eight, the qubits story about nine, the mutation story about eight and a half, the tissue topology
story about nine, the soil story about eleven, the pass story about seven, the flock and the robot gang about two), each
followed by an explore mode. Everything works on desktop, phones and in VR/AR headsets (built for Meta
Quest Browser, WebXR).

| Story | File | Network |
| --- | --- | --- |
| Network theory | `stories/airports.js` | 3,214 airports, 18,858 routes on a globe |
| Network medicine | `stories/proteins.js` | 254 curated proteins, 375 interactions in a cell |
| Spatial interactome | `stories/spatial.js` | 249 proteins in 13 compartments of a model cell |
| LBI Network Medicine tour | `stories/lbi.js` | ten 3D scenes, from a protein machine and an illustrative interactome to organs and tissue |
| Rare muscle diseases | `stories/nmd.js` | 1,182 genes of 13 neuromuscular disease groups in a tower of 71 layers (the authors' real data, kept out of the repository), the motor unit, a supercomputer |
| Disease endotypes | `stories/endo.js` | one neuromuscular junction close up; the 35 genes of congenital myasthenic syndromes in the authors' protein network (18,306 proteins), their module of 393 genes and 12 endotypes (EndotypY), the motor unit |
| Whole-body PET | `stories/pet.js` | a PET/CT scanner and how it sees; the organs of the paper's 658 whole-body scans (Geist et al., Med 2025) and their partial correlation networks (printed and read off its figures), from health to disease; the tour's PET body |
| Tissue microanatomy | `stories/micro.js` | the tour's H&E section and the domains a method finds in it; 24,945 GTEx slides of 40 tissues (Buljan, Bago-Horvath, Rendeiro, bioRxiv 2025); the network of organ architecture (29 organs, tissues, 10 tissue types, 70 domains, Iva Buljan's file); which domains change with age, pathology, and the contacts between domains |
| Ovarian aging | `stories/ovary.js` | the tour's body and a drawn cut-away ovary that ages; 255 GTEx donors aged 20 to 70 (Chakraborty, Moustafa, Rendeiro, poster); a drawn H&E section with blood vessels, macrophages, corpora albicantia and follicles (14,941 marked by hand), tiles with UNI2 features and a random forest, SegFormer's masks and their scores as tags on the section; the poster's trends with age told on the ovary as it ages (each method's count on its lines as tags; r and p in words) and the methods' agreement; an illustrative spatial neighbor network that tips up off the section and gathers into hubs by kind |
| Quantum network compression | `stories/qubits.js` | example gene networks (320 genes in 8 hidden groups, at three strengths of mixing, and a random one) cut into 8 cells on 3 qubits; the coarse operator A_c on a cube, its Pauli strings, the toolbox (a Lie algebra, so(6) or so(7)) and what it drops; the real run's residual by depth and its 3-qubit circuit (Joel Hancock's method and figures) |
| Quantum phylogenetics | `stories/mutation.js` | a text in four letters copied with swaps; a family tree in 3D (8 tips, 14 branches, every swap simulated) you walk round and look up into; a letter's two qubits and their read-outs; a rule of change (three example substitution models) as balls and arrows and a path through the pyramid of mixes; the machine for one branch (copy and turn), its circuit, one machine per branch; an RNA stem, its pairs and their coupling; the ancestor of three species rebuilt 2,000 times three ways (Enes Berk Sakalli and Arndt von Haeseler's poster; example numbers computed live, the poster's only as the authors' test) |
| Tissue topology | `stories/topo.js` | 110 real cells of a healthy liver (the poster's patch) with balls growing round them, the network with triangles, pieces joining and loops opening and closing, and the tower of scales; 123 GTEx liver slides (66 healthy, 57 with cirrhosis, 30.8 million cells found by HistoPLUS), their curves, main shapes, scores, a classifier's wall, its held-out test and its weight for every radius; a new slide's window of 6,716 cells, every cell scored, the two groups and their cell types (Simon Schindler, André Rendeiro and Jörg Menche's poster; every number computed by their package topocyte on their data) |
| Soil microbes | `stories/soil.js` | a cut-away block of soil with a wheat plant, its nitrogen's flows and the microbes' relay; a field trial in Japan (a BNI wheat and its control, three fertiliser regimes, 24 plots, five dates, 119 samples) with each plot's chlorophyll and nitrate and the jars' N2O read off the slides; about 100,000 kinds of soil microbe (a cloud of 20,000) and the co-occurrence network of 1,564 kinds and 22,348 links, its modules and the two wheat lines' networks side by side (the slides and field trial of Marina Montserrat Díez, Christa Schleper and colleagues; the network built for this story) |
| Networks for everyone (outreach; English and German) | `stories/pass.js` | a school of fish (300, a live simulation) all around you, each watching its 7 nearest neighbours; the airports story's globe (3,214 airports, 18,858 routes, taken unchanged) with a seeded S/E/I/R outbreak on its routes; the cell map story's cell (249 proteins in 13 places, taken unchanged), its NF-κB relay and CFTR in the wrong place |
| Flock | `stories/flock.js` | 200 starlings (a live simulation) flying all around you at dusk, each following its seven nearest neighbours |
| Robot gang | `stories/robots.js` | 6 to 24 robot vacuums (a live simulation) in a model living room, or in a headset your own room; who follows whom (you, or the one ahead) is the network |

Besides the stories, two pages that are not stories (`STORY_EXTRA`, on no Stories screen): the design room
(`stories/design.js`, `#design`: a table with a small model of every prop) and the studio (`stories/studio.js`,
`#studio`, v111: the owner's own models, trigger cubes and sounds placed life size in the room, served and saved by the
relay, with an upload page that converts and sorts what is dropped on it).

No build step, no framework, no package.json. Plain HTML/JS plus
`three.min.js` (three.js r128, vendored, MIT) and `peerjs.min.js` (PeerJS 1.5.5,
vendored, MIT, loaded only when a shared room runs peer to peer); the studio pastes three.js r128's own loaders and
exporter and meshoptimizer's simplifier (1.3.0, its WebAssembly inside; `tools/studio/vendor/`, MIT) into its built
file. The app is deployed by copying
the folder to any HTTPS host (GitHub Pages works); VR and installing need HTTPS.

## Layout

- `index.html` - the app shell: shared CSS and DOM (top bar, side panel,
  timeline, start screen) and the `HOST` object. It owns the single WebGL
  renderer and any running XR session, and loads stories on demand (and swaps
  one in place: "Hot reload and live updates").
- `stories/list.js` - the list of stories (`HOST.list`: key, kick, title,
  colour, its miniature for the stations' icons (`icon`, a key of `LOWPOLY_MODELS`),
  card text, titles, loading line, length, `life`; optional `needs`),
  in the order of the Stories screen and Arrange all. Read before the shell's
  script and again while the app runs. `STORY_EXTRA` at its end holds pages that
  are not stories (the design room, then the studio), with the same fields: `HOST.meta(key)`
  finds a key in either list (start, load, swap, title), while everything that
  lists the stories sees only `STORY_LIST`.
- `lowpoly.js` - the low-poly miniatures of every story's sets
  (`LOWPOLY_MODELS`), generated by `tools/lowpoly/build.mjs` from
  `tools/lowpoly/models-a.js` and `models-b.js` (never edit it by hand);
  loaded once by `HOST.lowpoly()` (the design room's table, the stations' icons).
- `version.json` - the latest release, for live updates: written by
  `tools/release.mjs`, never by hand, never cached.
- `whatsnew.json` - what is new in the latest release and what to test (developer mode's box, `HOST.dev`): written by
  hand at every release, never cached, not in `SHELL` ("Developer mode" below).
- `stories/<key>.js` - one story each, wrapped in
  `HOST.register('<key>', function (HOST) { ... })`. Everything a story
  defines is local to that function. Each returns
  `{ inputs, caption, recenter, panels, xrPose, collab, peek, dispose }` to the shell (`collab`: its
  shared-room hooks, see "Shared rooms"; `caption`: its line on show, for the
  headset's subtitles; `recenter`: its Recenter, for the headset's menu; `panels`: its two headset panels, for the
  menu's Story tab; optionally `lobby`, called as this headset goes to a Back to the lobby circle: the studio's; and
  `sticks: { say(on), note }` where the page switches its sticks with the shell's moving with the sticks and moves you
  itself while it is on: the studio's, v125; `ownSticks: true`, for a page whose own stick walk the setting must leave
  alone, is said by none since then).
- `proteins.html`, `spatial.html` - redirect stubs to `index.html#proteins`
  / `#spatial` so old links keep working. Do not put code there.
- `sw.js` - service worker. Pages and app files come from the network first,
  checked with the server each time (`cache: 'no-cache'`), so the page and its
  story files are always the same version; the cache is the offline copy (and
  the answer when the network takes more than 4 s). The narration MP3s are
  served from the cache (with byte ranges), a cache of their own that outlives
  the releases (`networks-narration`, v109): a narration goes in when a story
  first plays it on this device, never all sixteen at once (about 57 MB; ten
  headsets at their first visit would pull 570 MB over one router while people
  are already in a room), so offline a device has the narrations it has
  played. A new worker asks the server only about those it holds, with their
  ETag, and fetches only the ones that changed. Installing fetches straight
  from the server (`cache: 'reload'`). The studio's scenes (any same-origin path with `/scenes/`: the relay's
  `--scenes` and a static folder of them) are passed straight through, never cached (v111), by a rule before the
  narration's, so a scene's own `audio/narration.mp3` is never taken for (and cached as) the app's; the upload page's
  POSTs and the navigation to `<relay>/upload` are left to the browser.
- `audio/` - optional narration MP3s (`narration.mp3` for the airports,
  `narration-<key>.mp3` for the others, such as `narration-lbi.mp3`);
  missing files are fine.
- `manifest.webmanifest`, `icons/` - PWA install metadata.
- `shared.js` - the shell's shared-room client (`HOST.collab`, `HOST.room`; it plays
  the relay's part itself for a room on this device and, as a peer-to-peer room's
  host, for everyone in it; and the PC's trackers in a room, v126), loaded by `index.html` between its two scripts (see
  "Shared rooms" and "Vive trackers" below).
- `sfx.js` - the shell's sound effects (`HOST.sfx`, and `SFX_LIB` for the sound
  board), loaded by `index.html` just before `shared.js` (see the sound notes under
  "How the shell and stories fit together"). `tools/sfx.html` is its sound board and
  `tools/sfx-render.mjs` renders every sound to MP3 files for listening.
- `occlusion.js` - real-world occlusion in AR (`HOST.occlusion`), loaded by `index.html` after `sfx.js` and before
  `shared.js` (see "Real-world occlusion" below).
- `ships.js` - the spaceships (`HOST.ships`, v132), the shell's own mini-game in headsets, loaded by `index.html` after
  `occlusion.js` and before `shared.js`, which links itself in at its end (see "Spaceships" below).
- `peerjs.min.js` (PeerJS 1.5.5, MIT, licence in `PEERJS-LICENSE.txt`) - the
  links of a peer-to-peer room, loaded by `shared.js` only then. `p2p/` - a test
  page (not part of the app) for checking a network before an event: do two
  devices link directly, how fast, and inside VR or AR (`&peer=` picks another
  introduction server).
- `room-test/` - a test page (not part of the app; served by GitHub Pages and by the relay, `APP_DIRS`) for one Quest 3
  before building real-world occlusion (the owner, 4 November 2026: "start with a test page"): in AR, through the app's
  own renderer path (three.js r128's WebXR with a plain `XRWebGLLayer`, the stories' renderer settings, the `local`
  space), it asks for `depth-sensing` (GPU or CPU; a ladder of data formats, each rung tried in turn whatever the error:
  with `'unsigned-short'`, then without it, then without depth) and the room scan (`plane-detection`, `mesh-detection`, `initiateRoomCapture` offered
  when nothing comes within 5 s), records what came back (formats, texture type and size, raw to metres, the matrix, a
  16 x 16 probe of the raw values per eye read back exactly, planes and meshes by label) and runs five modes, each one's
  cost measured (the gap between frames, which stays at the display's while a mode fits; our code's time and the depth's
  part of it; every 12th frame the time until the GPU has finished it, `gl.finish`, and the headroom left in the frame;
  a GPU timer query where `EXT_disjoint_timer_query_webgl2` is offered): *Depth picture* (false colours over each eye), *Occlusion* (the depth written as each eye's
  `gl_FragDepth` in a full-view pass before the test things: three.js's `ShaderMaterial` in GLSL3 with the session's
  texture handed to three.js as an external texture, per eye in `onBeforeRender`; raw WebGL after three.js as the
  fallback, `Draw with`; the session's texture set to nearest every frame, an eye without depth that frame left
  unoccluded), *Room*, *Room hides* (the meshes and planes depth-only, built only while one of the two shows) and
  *Nothing* (no depth asked for: the baseline). *Depth as* tries the readings (metres through
  `normDepthBufferFromNormView`, flipped, or a depth buffer's window depth for the depth's own near and far, as three.js
  r158 reads it, turned back into metres; with no far plane, `depthFar` Infinity, as a Quest 3 on Quest Browser 154 gave,
  `near / (1 - value)`, the report saying `infinite`). *Depth seen from* (after the owner's first reports from a
  Quest 3, 6 November 2026: their depth was such a depth buffer, which *metres* threw away and *window* turned into
  NaN): *its own view*, the default, follows each eye's ray into the view the depth was seen from (`XRDepthInformation`'s
  `transform` and `projectionMatrix`, the view's own where it gives none), a few steps in the shader; *the eye* reads it
  straight behind the eye's point as before; the report keeps per eye how far that view is from the eye (`offset`: cm and
  degrees, mean and most, and whether its projection differs). The room's planes and meshes are built again only when
  their shape changes (`shapeSig`), the old drawing kept until the new one is ready: that Quest marked its 39 planes
  changed about 45 times a second with nothing changed, and rebuilding each time made Room and Room hides blink and stall
  (the report: `ticks`, `changes`, `rebuilt`). The report (kept every 5 s while the session runs and when the page hides) (JSON,
  no names: the user agent, what came back, the frame times) is kept in `localStorage` (`roomTestReport`), copied,
  downloaded or sent to a relay that keeps logs (`POST /api/log`, with the app's kept password for that origin). Its
  test is `tools/room-test.mjs`. Untested on a real Quest: that is what it is for.
- `relay/` - the shared rooms' server (`server.mjs`, Node, no packages; it can serve
  the app too, and `--lan` makes it an HTTPS server for the headsets on one
  Wi-Fi that keeps their alignment logs in `relay/logs/`), its test (`test.mjs`)
  and Dockerfile; see its `README.md`. It is also an introduction server for peer
  to peer at `/peerjs` (PeerJS's server protocol; `--no-peer` turns it off), for
  the tests and for an event that wants its own. With `--scenes <dir>` it serves the studio's scenes, saves their
  layouts and takes uploads (v111; "The studio's scenes on the relay" under "Shared rooms"); `scenes.mjs` holds their
  listing and upload path rules, which `tools/studio/scan.mjs` shares (in the Docker image, never served). With
  `--scenes r2` (v114) it keeps them in a Cloudflare R2 bucket instead ("The studio's scenes in R2" under "Shared
  rooms"): `r2.mjs` (AWS Signature Version 4 with `node:crypto`, signed requests and presigned links, the S3 client the
  relay and `tools/studio/r2sync.mjs` share), `test-r2.mjs` (the signer against AWS's published examples, byte for byte)
  and `s3fake.mjs` (a stand-in S3 for the tests that checks every signature; never served, not part of the app). With
  `--trackers` (v126) it takes the PC's Vive trackers from `tools/trackers/bridge.py` on UDP 127.0.0.1 and sends them,
  lined up, to the rooms that use them: `trackers.mjs` ("Vive trackers" below).
- `tools/trackers/` - the Vive trackers (v126; "Vive trackers" below): `SPEC.md` (the plan and the contracts between the
  lanes), `bridge.py` (SteamVR's poses to the relay on the same PC: Python 3 and pyopenvr, named in its PEP 723 block, so
  `uv run tools/trackers/bridge.py` fetches both, at the versions in `bridge.py.lock`; `--fake` without SteamVR),
  `fake.mjs` (a fake bridge in Node, for the tests and for trying the rooms without the hardware) and `README.md`
  (setting it up on the Windows PC).
- `docs/` - the shared rooms' plan (`shared-space-plan.md`, with what phase 0
  built) and the lessons from another project it applies (`multiplayer.md`:
  syncing; `shared-spaces.md`: one room frame for several headsets), and
  `quest-shared-space-findings.md`, a short page of what Quest did that those notes did not say.
- Handover: `HANDOVER.md` (start here when taking the project over), and in
  `docs/`: `data-and-permissions.md` (where each story's data comes from and what
  may be used), `questions-for-authors.md` (open points in the sources),
  `setup-and-release.md` (tools, tests, release), `event-runbook.md` (a session
  with headsets) and `narration.md` (the words to record, generated by
  `tools/narration.mjs`; never edit it by hand).
- `tools/smoke.mjs` - headless smoke test; `tools/audio.mjs` - narration and sound effects test;
  `tools/sfx-cues.mjs` - the stories' sound cues checked without listening (see "Sound effects");
  `tools/update.mjs` - update test for the service worker; `tools/live.mjs` -
  hot reload and live updates test; `tools/release.mjs` - writes `version.json`
  (a release step); `tools/collab.mjs` -
  shared rooms test (see Testing); `tools/narration.mjs` - writes
  `docs/narration.md` from the running stories; `tools/pace.mjs` - writes the
  `NARRATION_SYNC` that paces a story without a recording (see "Inside a story").
- `tools/voice/` - a synthetic narration (Kokoro-82M through kokoro-onnx, `kokoro.py`; German with Piper, `piper.py`;
  the models, their Python and the spoken lines stay outside the repository, see its `README.md`):
  `node tools/voice/narrate.mjs <key>` speaks a story's lines (how each word is said: `say.json`, its German rules in
  their own section, `de`), lays them out and writes `audio/narration-<key>.mp3`, `NARRATION_SYNC` and
  `NARRATION_ENDS`; `node tools/voice/check.mjs <key>` checks the result in a browser (`--lang de` a story's German).
  Every story but the airports (which keep their human recording) is narrated so, with the American voice `af_heart`
  (the owner's choice, 29 October 2026): the tour first, the other fourteen in v109 (3 November 2026, after a pass over
  every story's text so that it reads as a person would say it). A story in two
  languages (the pass story) gets a recording per language on one timeline: English with `af_heart`, German with
  Piper's Thorsten voice (`de_DE-thorsten-high`, the owner's choice), `audio/narration-pass.mp3` and
  `audio/narration-pass-de.mp3`.
- `tools/nmd/` - the sources of `stories/nmd.js` (data generator, data block, sets,
  engine parts, build script, set harness; it uses `tools/lbi/kit.js`); see its
  `README.md`. The authors' analysis files it reads are not in the repository (removed on 3 November 2026, in its
  history as `ikerdata/`; a local copy there is ignored by git).
- `tools/endo/` - the sources of `stories/endo.js` (data generator, data block, sets,
  engine parts adapted from the muscle story's, build script, set harness; it uses
  `tools/lbi/kit.js` and the muscle story's motor set); see its `README.md` and `SPEC.md`.
- `tools/pet/` - the sources of `stories/pet.js` (data generator and the figures' readings, data block, organ
  icons, sets, engine parts adapted from the endotype story's, build script, set harness; it uses `tools/lbi/kit.js`,
  the tour's body set and the microanatomy story's 3D organs); see its `README.md` and `SPEC.md`.
- `tools/micro/` - the sources of `stories/micro.js` (data generator, data block, small 3D organ models, sets, engine
  parts adapted from the PET story's, build script, set harness; it uses `tools/lbi/kit.js` and the tour's body and
  tissue sets); see its `README.md` and `SPEC.md`.
- `tools/ovary/` - the sources of `stories/ovary.js` (data generator and the figures' readings, data block, shared look,
  sets, engine parts adapted from the microanatomy story's, build script, set harness; it uses `tools/lbi/kit.js` and the
  tour's body set); see its `README.md` and `SPEC.md`.
- `tools/qubits/` - the sources of `stories/qubits.js` (the maths `QMATH` and its test, the real run's numbers, the
  shared look, sets, engine parts adapted from the microanatomy story's, build script, set harness; it uses
  `tools/lbi/kit.js`); see its `README.md` and `SPEC.md`.
- `tools/mutation/` - the sources of `stories/mutation.js` (the maths `MMATH` and its test, the poster's numbers, the
  shared look, four sets, engine parts adapted from the qubits story's, build script, set harness; it uses
  `tools/lbi/kit.js`); see its `README.md` and `SPEC.md`.
- `tools/topo/` - the sources of `stories/topo.js` (the data generator, which runs topocyte on the authors' files,
  the data it writes and its decoders and their test, the shared look, four sets, engine parts adapted from the mutation
  story's, build script, set harness; it uses `tools/lbi/kit.js`, the tour's body set and the microanatomy story's organ
  models); see its `README.md` and `SPEC.md`.
- `tools/soil/` - the sources of `stories/soil.js` (the data generator, which reads the authors' files, and the slides'
  readings reconciled, the data it writes, its decoders and their test, the story's palette, three sets, engine parts
  adapted from the tissue topology story's, build script, set harness; it uses `tools/lbi/kit.js`, the tour's `web` set
  and the tissue topology story's look); see its `README.md` and `SPEC.md`.
- `tools/pass/` - the sources of `stories/pass.js` (the build that cuts the airports story's globe and the cell map
  story's cell out of `stories/airports.js` and `stories/spatial.js`, unchanged; three sets, `fish`, `globe` and `cell`;
  the story's words in two languages; engine parts adapted from the qubits and flock stories'; set checks, harness); see
  its `README.md` and `SPEC.md`.
- `tools/lbi/` - the sources of `stories/lbi.js` (kit, sets, engine parts,
  build script, set harness, data generators); see its `README.md`.
- `tools/flock/` - the sources of `stories/flock.js` (the flock set, engine parts
  adapted from the tour's, build script, set harness); see its `README.md`.
- `tools/robots/` - the sources of `stories/robots.js` (the robots set, engine
  parts adapted from the flock's, build script, set harness); see its
  `README.md` and `SPEC.md`.
- `tools/design/` - the sources of `stories/design.js` (the design room: the props
  catalogue `props.json`, the table set, engine parts adapted from the flock's,
  build script that also makes the props' cards); see its `README.md` and `SPEC.md`.
- `tools/studio/` - the sources of `stories/studio.js` (the studio, v111: your own scenes; "The studio" below): its
  engine parts adapted from the design room's (`engine/e*.js`; `engine/convert.js`, the converter, and
  `engine/images.js`, the picture reader (TIFF, PSD, DDS) and the texture names' ladder, modules shared with
  `convert.mjs`; `engine/e7b_upload.js`, GLB records, Convert to GLB, textures baked in and the Upload pane; `engine/e7d_lite.js`,
  Fewer triangles and Change texture on a card and the Upload pane's share; `engine/e7e_pics.js`, the Add
  pane's pictures of the models (v120: made with every GLB and by Make pictures, kept in `previews/`); `engine/e7f_viewer.js`,
  the viewer (v125: a model over the whole window, from Preview, Look closer and Look); `engine/e6b_cuts.js` the
  cut-outs; `engine/e6c_groups.js` the groups; `engine/e6d_shapes.js` the shapes, empties, locks, the scene's settings and the
  lobby hook; `engine/e6e_motion.js` the motions and the pose pipeline that draws an item; `engine/e6f_path.js` the
  recorded paths, the recorder and its loop join; `engine/e6g_behave.js` the behaviours; `engine/e6h_ghost.js` the ghost
  where a moving item is placed, the page's arrows on it, and Pause; `engine/e6i_tex.js` the trigger cubes that change
  pictures on objects; `engine/e6j_voice.js` (v125) recordings past 2 minutes kept as files of the scene and a voice
  recorded with the movement; `engine/e6k_trk.js` (v126) props that follow one of the PC's Vive trackers;
  `engine/e6l_puppet.js` (v126) a Mixamo character worn with trackers, its lining up and its takes; `engine/e6m_anim.js` (v127) a
  selected model's timeline while editing, held for its circle, and since v128 a recorded path's; `engine/e6n_plays.js` (v136)
  trigger cubes that start things: a clip, a sound, a recorded path or a motion as you walk in or out), two sets (`stage`, the
  floor and sky round the scene, and `looks`, the items' looks: cubes, speaker markers, rings, grey boxes, shapes, empties' crosses), `vendor/`
  (three.js r128's own add-ons, unchanged, MIT: `GLTFLoader`, `FBXLoader`, `TGALoader`, `OBJLoader`, `MTLLoader`,
  `PLYLoader`, `STLLoader`, `NURBSCurve` and `NURBSUtils`, `SkeletonUtils`, `TransformControls`, `GLTFExporter`, and
  fflate 0.6.9, which the FBX loader needs; pasted into the built file with their licence lines, each wrapped so
  nothing leaks but `THREE.*`, `GLTFExporter` last inside `exporterLoad()`, defined only when the studio first
  converts; and meshoptimizer's `meshopt_simplifier.js`, 1.3.0, MIT, inside `meshoptLoad()`, its WebAssembly made only
  when the studio first makes a model lighter: its `README.md`), the build (`build.mjs`, `--check`), `scan.mjs` (a plain folder of scenes for any web
  host), `convert.mjs` (a model to GLB on a computer; `--keep` makes it lighter), and the test scene (`test/make.mjs` makes
  `test/scenes/test/`: an animated `box.glb`, an ASCII `figure.fbx` in centimetres and Z up with `figure.png`, a short
  `tone.wav`, a 25 s `sounds/long.wav`, an OBJ with its MTL and PNG under `originals/`, its `layout.json` and listings,
  about 250 KB, committed; and `test/scenes/textures/`, about 20 KB: pictures in every kind the studio reads, from
  `test/pictures.mjs`, and models that name them by each rung of the ladder; and `test/scenes/rig/`, about 35 KB: a small
  skinned `dancer.glb` whose bones are named in mixed conventions, with a voice following her head; and
  `test/scenes/cuts/`, about 30 KB: a wall whose door a cube opens, two boxes of one file with a hole in one, the dancer
  and the figure, for cut-outs; and `test/scenes/puppet/`, about 60 KB: `rig.glb`, our own humanoid with Mixamo's bone
  names and a walk, for the trackers' solver; `test/local/` is git-ignored, for your own scenes), `test-images.mjs` (the picture reader checked in Node); see its `README.md` and `SPEC.md`.
  `engine/ik.js` (v125; in the build since v126, as `convert.js` is: `e6l_puppet.js` uses it) is the trackers' solver for
  phase 3 of `tools/trackers/SPEC.md` (a Mixamo character worn with trackers, a headset and controllers: "The solver
  (ik.js)" there), a plain module like `convert.js`, checked by `test-ik.mjs`.
  For a relay that keeps its scenes in R2 (v114): `engine/e7c_direct.js` (the files' signed links read again before they
  lapse, uploads straight into the bucket) and `r2sync.mjs` (scenes between the bucket and a folder: `list`, `pull`,
  `push`).
- `examples/` - example scenes that ship with the app (v137): scene folders with their listings exactly as
  `tools/studio/scan.mjs` writes them (`examples/index.json`, `examples/<name>/files.json`), opened read only from the
  studio's Scene pane and copied to a relay from there ("The studio"). The first, `bliss-xp`, the Bliss XP room ("The Bliss
  XP room (example scene)" under "The studio"), is generated by `tools/studio/xp/make.mjs`: never edit it by hand.
- `tools/studio/xp/` - the Bliss XP room's generator (v137): `COMPONENTS.md` (the video's components and what each became
  in the room), `make.mjs` (`--check`; headless Chromium with three.js r128's own glTF exporter and loader), `page.html`,
  `kit.js` and `parts/*.js` (each component built in code: canvas pictures, procedural paintings, geometry, clips),
  `sounds.mjs` (every sound synthesised), `layout.mjs` (the room) and `README.md` (how, what, and the rules: our own
  drawings and sounds only).
- `tools/lowpoly/` - the miniatures (`models-a.js`, `models-b.js`: each
  `LOWPOLY_MODELS['<story>.<set>'] = { story, set, name, shows, tris, build(THREE) }`,
  under 1,200 triangles, `tris` exact; 48 props, the design room's own `design.table` and the studio's
  `studio.stage` (870 triangles: a low stage, a small figure, a see-through cube's edges, a speaker on a post),
  only their station icons, and, last, `all.stories` and `all.lobby`, the icons of the shell's two
  circles, All stories and Back to the lobby, not props either), their harnesses (`harness-a.html`,
  `harness-b.html`) and `build.mjs` (writes `lowpoly.js`; `--check`).

## How the shell and stories fit together

- `HOST.list` comes from `stories/list.js` (always the same array, changed in
  place when the list is read again; `HOST.listRev` counts the changes), so a
  story's code may keep it (`XR_STORIES`). Nothing in a story writes the number
  of stories in: the title and Stories screen say it in words up to twenty
  (`HOST.count()`; the headsets' `drawLandHead` the same), and the headset
  Stories screen lays its cards out in two rows from the number
  (`xrLandingCards`, built again when `HOST.listRev` moves on). A story the list does not have (a shared
  room's station from a newer copy) gets a stand-in, `HOST.unknown(key)`.
- `HOST.start(key)` loads `stories/<key>.js` if needed (`HOST.load`: fetched as
  text, its fingerprint noted in `HOST.fp`, run as a script; a file that
  registers no story is refused), calls the old story's `dispose()`, removes
  every listener the old story added, then runs the new story's factory
  (`HOST.run`). Stories never navigate the page, so a VR/AR session survives a
  change of story. `HOST.swap(key)` does the same for the story on show,
  keeping its place (see "Hot reload and live updates").
- Listener bookkeeping: `index.html` wraps `EventTarget.prototype` and
  `THREE.EventDispatcher.prototype.addEventListener` and records listeners
  added while a story is current. Listeners three.js adds for itself must not
  be recorded (XRSession listeners, `webglcontext*`, `dispose`, anything added
  while `HOST.quiet` is set, which is how `HOST.makeRenderer` creates the shared
  renderer). If VR controller clicks or the XR frame loop stop working after a
  story change, look here first.
- Stories must create the renderer with `HOST.makeRenderer(...)`, never
  `new THREE.WebGLRenderer`.
- Controllers after standby (`HOST.inputsGuard` in `index.html`, v124; the owner, 8 November 2026: "sometimes after
  sleep the controllers cannot click on buttons and one has to open the quest menu and close it again"). three.js r128
  moves its controllers every frame by index from `session.inputSources` but hands a select or squeeze to a controller
  only through a map it fills on `inputsourceschange`, so a source the browser replaces without that event keeps its ray
  and loses its presses. Each frame of a headset session (`HOST.loading.wrap`, outermost) the sources are compared with
  those last seen with a real event, and a change nobody announced is announced by a synthetic `inputsourceschange`
  (what went, what came; `synthetic: true`), which three.js's handler maps afresh, the stories hearing `disconnected`
  and `connected` as for a real one. Logged as `inputs replaced` (with seconds since waking, `woke`). Until v130 only
  from the session going hidden until a minute after it was visible again (the tests' pretend headsets swapped their
  sources by hand: nothing on a headset needed the window); since v130 (the owner, 10 November 2026: "Sometimes the
  right controller cannot click after standby and only going quest menu and back lets it click again"; a controller
  sleeps and wakes on its own, picked up minutes later) at any time of the session, once the change has stood a whole
  frame unannounced (a browser that fires its own event after the frame's callbacks gets that frame).
  - Pressed and not heard (v130). A tracked controller with a gamepad (never a tracked hand) whose trigger
    (`buttons[0]`) or grip (`buttons[1]`) goes down while the session is visible, with no `selectstart` (`squeezestart`)
    from the session for it from the frame before the gamepad shows it down until 300 ms after, is a missed press:
    logged as `press missed` (`hand`, `kind` select or squeeze, `came`: how the source came, `'start'`, `'event'` or
    `'announced'` here; `woke`: seconds since waking; `vis`; `profiles`; `mapped`: whether three.js maps it; `stray`:
    real presses seen for a source three.js does not map, also logged as `press for an unknown source`; `heard`: seconds
    since the session last said so), and that controller's button is armed: its presses are then given as synthetic
    `selectstart` as it goes down and `select` and `selectend` as it comes up (`squeezestart`, `squeeze`, `squeezeend`
    for the grip; plain events with `inputSource`, `frame` and `synthetic: true`, dispatched on the session within the
    frame), which three.js hands to the story's controller as a real press, and through the story's press of a shell hit
    to the shell's menu (`HOST.collab.press`); the shell's own session listeners hear them too. The first real
    `selectstart` from it disarms it (`press back`, with how many were given). The missed press itself is lost (it is found
    missed only after it went down; a tracked hand's pinch never counts as its controller's press). Never two clicks for one press (the owner
    would rather lose one): a real `selectstart` arriving while a synthetic press is under way (a browser that fires it
    after the frame's callbacks) is stopped by the guard before three.js or the shell hear it, and the session's own
    `select` and `selectend` end that press in place of synthetic ones; and once a synthetic end was given, that press's
    own events coming late (within 250 ms, `G.late`: a `select` or `selectend` with no real press open at three.js, or a
    `selectstart` while the button is up, and then its `select` and `selectend`) are stopped too, while a real
    `selectstart` with the button down again in that time is a press of its own. For that the guard's listeners are added as
    `HOST.session` is set (it wraps `HOST.xr.watch`, which the setter calls), which every story does before it hands the
    session to three.js: at a session, which is not a node, Chromium runs listeners in the order they were added,
    capture or not (checked in headless Chromium 141). A real event for a source three.js does not map reaches no
    controller, so it does not count as heard (a press it carried is missed, and the next given); counted as `stray` only
    once the session's frames come through the guard. The sound's unlock hears a synthetic `select` too but goes by
    `navigator.userActivation`, which no synthetic event sets. `HOST.inputsGuard.state()` (`{ fixes, seen, missed, synth, stray, stopped, woke, armed: ['right select'] }`),
    `wokeAgo(ms)`, `missMs(ms)` and `lateMs(ms)` are for tests.
  - Untested on a headset: whether a Quest replaces a controller without the event, or keeps it and stops passing its
    presses on (the headsets' logs will say: `inputs replaced`, `press missed`, `press for an unknown source`), how the
    trigger's `pressed` and Quest Browser's select line up there (Chromium takes its select from the same button state, as
    far as we know; were they apart, a light press the browser does not take for a select would be logged as missed and
    arm it, the next real press disarming it, and a light press while armed would be given as a click), and whether the
    presses given that way work on a Quest.
- Loading (29 October 2026, the owner: "some rooms like 'the future' take a little time to load"). A story builds in
  steps, each a task of its own (its `LOAD` queue, see "Inside a story"), and reports each with
  `HOST.progress(done, total, label)` (stories guard it, `if (HOST.progress)`, so an older shell still works). The
  page's `#loading` shows a thin bar in the story's colour (`#ldBar`, changed at most every 150 ms and only where it
  changes: each change costs the page a frame, which a slow device composites in software) and the step (`#ldStep`) under the story's
  loading line (`#ldLine`; `HOST.loading.begin(meta)` in `HOST.start`). In a headset the old story's scene is gone
  while the next one builds, so `HOST.teardown` gives the renderer the shell's loading scene as its frame loop
  (`HOST.loading`, in `index.html`, in place of the blank loop that kept the session alive): a card with the story's
  kicker, title and a bar in its colour and the step, 1.2 m in front of you and 15 cm below your eyes, easing with your
  head (upright, turned to you; until v102 also a ring with the share done on the left wrist, where the menu's clock
  sat; the menu is out of the scenes while a story builds). It is placed from the frame in the renderer's reference space (where three.js puts the
  camera), shown only once a load has taken 0.4 s, and fade out over the new story's first frames (`HOST.loading.wrap`,
  in `makeRenderer`'s `setAnimationLoop`: drawn after the story's frame with its camera's near and far, so the
  session's depth range does not flip). The loading scene is a scene of its own, never in a story's, made once with
  `HOST.quiet` set; the clear colour stays as the story before left it (see-through in AR). A headset draws it between
  the story's steps only, so no step may run long. A story torn down while it still builds (its frame loop not yet
  given: `HOST.loading.ran`) never took the headset: `HOST.inputs` and `HOST.xrPose` from the story before stay.
- In a headset session, a newly started story calls `xrAdopt()` to take over
  the running session, the controllers (`HOST.inputs`) and the previous
  placement (`HOST.xrPose`).
- The start screen (`#picker`) is the landing page. Entering VR/AR from it
  (`HOST.landingVR` / `HOST.picking`) shows the headset Stories screen
  (`XR.stories`, built by `xrLandingSetup`). Entering VR/AR from inside a
  story resumes that story. In a shared room a headset never shows the
  Stories screen (see "Shared rooms"), except at an All stories circle.
  - The headset Stories screen (v109; the same lines in all sixteen stories and the design room, on `XR.landGroup` in
    `GL.rig`): a header (`XR.land[0]`, `drawLandHead`, 1.02 m wide) with only the title (*Networks, in sixteen
    stories*), its hint (or where an anchored place stands, `HOST.anchor.status()`) and *Back to the story* (while
    `XR.inStory` and not at an All stories circle's cards); the sound, Sound check, Anchor, Exit, Recenter or Place
    again and Repeat are the headset's menu's, not on it. Under it one card per story (`XR.land[1..]`, in
    `HOST.list`'s order, 0.36 m x 0.461 m, the whole card a button: here and not at an All stories circle's cards back
    into the story, else `HOST.go(key)`) in two rows on one arc, as the All stories circle's icon has them: the first
    half of the list (rounded up) in the upper row, the rest under it, a shorter row centred, each card turned to you.
    In a row neighbours stand 0.381 m apart and the outer ones at most 62 degrees to the side, never nearer than
    1.25 m (sixteen: eight a row, 0.306 rad apart at 1.25 m). Heights over your eyes (`XR_LAND`): the header's middle
    0.475 m, the rows' middles 0.13 m and -0.38 m (0.05 m apart, the upper row's top 0.03 m under the header), so it
    reaches from 0.56 m above your eyes to 0.61 m below, the header 1.22 m ahead.
- The address mirrors the state (`HOST.setUrl`): `#stories` while the Stories
  screen shows (page or headset), `#<key>` in a story. A `#<key>` link opens
  that story directly; no hash or `#stories` lands on the Stories screen.
  It replaces the address (`HOST.hist.replace`, keeping `history.state`), with one exception (v109, the back button on
  phones: `HOST.hist` in `index.html`): a story opened from the page's Stories screen (`closePicker` onto a story,
  outside a headset session and a headset's browser) is a history entry of its own (`{ nwUp: 1, key, doc }` in its
  state, `setUrl(false, 'push')`), so back (Android's back, iOS's swipe, a desktop's) comes back to the Stories screen;
  the Stories button there steps back to that entry (`setUrl(true, 'back')`), so entries never pile up (an entry a page
  made before a reload, `doc` another page's, is turned into the Stories screen's instead: stepping back would load the
  old page again); forward goes back into the story. On `popstate` back first closes what is open (the Shared dialog, the card of `HOST.handheld`, More,
  focus mode's Text, explore's drawer: `HOST.hist.closeOne()`) and puts the story's entry back. On the Stories screen
  and in a story opened by a link (nothing of ours under it) back leaves as ever, and a new address typed in changes
  nothing. No entry per chapter, explore change, swap (`HOST.swap` keeps the entry) or story the room or Repeat starts;
  a shared room's `#s=XYZ` stays on both entries. In a headset session nothing changes (the address replaced). Untested
  on real phones (Android's back, iOS's swipe).
- The shell talks to stories with window events `storypause` and
  `storyrestart`.
- Repeat (`HOST.repeat`: `off`, `all` or `one`; buttons on the page's Stories
  screen, via `HOST.toggleRepeat`, and *Repeat* on the headset menu's Settings
  tab, each press the next, via `HOST.setRepeat`; the headset Stories screen's
  buttons until v109): a story that reaches its end
  calls `HOST.ended()`; when that returns true the story only pauses, and after
  a moment the shell starts the next story (`all`, wrapping round) or sends
  `storyrestart` (`one`); otherwise the story opens explore mode. Remembered in
  `localStorage`; `#repeat=all` or `#repeat=one` in a link sets it.
- Slideshow (`HOST.slides` in `index.html`): a story waits at the end of each
  chapter, all its text shown, until Next (or Play) goes on. `global()` and
  `setGlobal(on)` (every story; it clears the stories' own choices: the
  Slideshow button on the Stories screen, the headset's left-hand menu),
  `on(key)` and `set(key, on)` (one story: the switch on its panel, page and
  headset), `sig()` for panel signatures; remembered in `localStorage`
  (`slideshow`, `slideshowStories`), per device, never in `collab.state()`;
  `#slides=on` or `#slides=off` in a link sets it for every story. The shell
  sends stories nothing: each reads it every frame (guarded by `HOST.slides &&`,
  so a story and a shell of different versions do not break). In every story
  the same lines (`slideStep` and its helpers next to the narration code):
  chapter i stops at `slideStop(i)` = `narrT(CH[i].b - 0.7)` (just before its
  text starts to fade out), found as a crossing in `frame()` (the clock before
  and after the frame; at a station also since the last frame when the clock
  moved no further than the time that passed plus 0.35 s, as when the shell
  catches a slow page up with the station's clock, but not a jump), so a jump
  into chapter k stops at its end, and the last
  chapter stops too before the end (Repeat and explore mode follow Next). The
  stop is `APP.playing = false; APP.seek(stop)` and Next is `APP.togglePlay()`,
  so in a shared room they go out through the shell's wrapper as the station's
  clock, like a pause and a play by hand, at the same `t` on every device. A
  story paused just now while playing up to 0.25 s before a stop (a room's pause
  lands within the shell's 0.25 s drift) waits at it too, but a clock put near a
  stop while paused (a scrub) stays where it was put unless it is right on the
  stop; a stop just gone on from stays passed while the clock is within 1 s of
  it. The voice: a chapter's last words often run on past its stop (the
  airports' recording by up to 2.4 s, so a plain pause cut them). A story with a
  recording lists where each chapter's words end in it (`NARRATION_ENDS`, seconds
  by chapter key, measured from the file; `stories/airports.js` has one, independent
  of `NARRATION_SYNC`, and the tour has one, written with its table by
  `tools/voice/narrate.mjs`, whose words always end before each stop): at a stop the narration plays on, on
  its own clock, to that point (`slideTail`, `slideSound`, which `audioSync`
  plays), and after Next it stays quiet, the story not following it
  (`audioFollow`), until the story is back there, so nothing is cut or said
  twice. Re-measure the list when re-recording (ffmpeg's `silencedetect`, then
  check by ear). Next shows at the foot of the page's panel (`#slides`, with the
  story's switch, scrolled into sight only as far as the chapter's top stays in
  view), on a phone (under 900 px) beside Play in the bar instead
  (`#btnNextBar`), and in the headset's foot panel in place of the chapter's
  name (the chapter arrows stay; the switch beside the clock).
- Placement in the headset: each story hangs its Stories screen, story panel
  and the scene's placement point (`XR.globeBase + XR.globeOff`) on one frame,
  `GL.rig`. Normally the rig is set from your head (`xrRecenter`) when a
  session starts, on Recenter, when the reference space resets, and when the
  headset was off for more than 3 s (`xrFreshStart`: a new wearer). Anchored
  mode (`HOST.anchor` in `index.html`; *Anchor: on/off* on the headset menu's
  Settings tab, beside Exit and Recenter, a button on the headset Stories screen
  until v109; in a shared room it can be turned off there, not on; `#anchor=on` / `#anchor=off`; remembered as `xrAnchor` and `xrPlace`
  in `localStorage`) pins the rig to a WebXR anchor with a persistent handle
  (Meta Quest Browser), so the place survives all of those and reloads. Stories
  call `HOST.anchor.frame(frame, ref)` in `xrBegin` and set the rig from what
  it returns, skip `xrRecenter` while `HOST.anchor.held()`, block the grip while
  `HOST.anchor.locked()`, and take the saved arrangement from
  `HOST.anchor.saved()` in `xrRecenter`; *Place again* is `HOST.anchor.again()`
  plus a recentre. Without anchors (`frame.createAnchor` missing or refused)
  the place holds until the session ends; a saved place the headset cannot
  find (another room) is kept for the next session while things hold where
  they are. Each request carries a generation number, so one that settles
  after Place again, Anchor off or the end of the session is thrown away.
  What a session asks for comes from the shell (`HOST.xr.request(mode)`, in
  every story's `xrStart` since v119: `session = await (HOST.xr.request ? HOST.xr.request(mode) :
  navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));`, the same line in all sixteen,
  the design room and the studio; `HOST.xr.features(mode)` is still the list): AR asks for `local-floor`, `hand-tracking`,
  `anchors`, `plane-detection` and `mesh-detection` (the robot gang's room and real-world occlusion) and
  `shared` (the shared space), and `depth-sensing` (real-world occlusion: below), all optional; VR only for `local-floor`,
  `hand-tracking` and `anchors`, since a Quest 3 left VR for its home at once
  with the full list (October 2026; AR was fine there, and VR on a Pico) and
  started VR on the first try with these three (which of the other three was
  to blame was not tried). A VR
  session that ends within 10 s of starting, or whose page goes with it (no
  `pagehide`), makes the next one ask for less (`hand-tracking` and
  `local-floor`, then `local-floor`, then nothing; `xrSteps` in `localStorage`,
  back to the start in another browser version): Sound check says what VR asks
  for and why. Ending VR on purpose within 10 s counts too.
- Four headset settings, one each for the whole system (the owner, October
  2026: "the settings systemwide, with the default being that everything is
  3D"; 29 October: "add subtitles in the headsets as a switchable option per
  room"; 30 October: "an independent switch for the small labels that are shown
  inside the 3d models and one for the larger ones like the play pause cards?
  the smaller models should be on top by default and the other ones should be 3d
  by default", and "the name tags go into the same category as the cards and
  are 3d by default, keep all choices 3d, on top, hidden for both"):
  `HOST.xr.labels()`, the scenes' small labels (`'face'`, the default: on top;
  `'fixed'`: in 3D; `'hidden'`), `HOST.xr.cards()`, the larger ones: the
  story's two panels (its text and explore panes and its play and pause bar),
  the shell's station cards over the circles and people's name tags (`'fixed'`,
  the default: in 3D; `'face'`: on top; `'hidden'`), `HOST.xr.free()` (free
  moving, on by default) and `HOST.xr.subs()` (subtitles, off by default), set
  with `HOST.xr.setLabels(m)`, `HOST.xr.setCards(m)`, `HOST.xr.setFree(on)` and
  `HOST.xr.setSubs(on)`, `HOST.xr.sig()` for panel signatures (labels, cards,
  free moving and subtitles); rows in the headset's menu (*Labels: on top* ->
  *in 3D* -> *hidden* and *Cards: in 3D* -> *on top* -> *hidden*, side by side,
  each press the next, each lit while shown; *Moving: free* / *Moving: facing
  you*; *Subtitles: on* / *off*) and, in a room, in the page's Shared dialog
  (a Labels and a Cards picker). Labels and cards are independent: labels
  hidden leaves the cards, cards hidden leaves the labels. In a shared room
  they are the room's (key `look`, below), for every headset and page in it;
  otherwise the device's own (`xrLabels2`, `xrCards`, `xrFree`, `xrSubs` in
  `localStorage`; the labels under a new key since v100, so every device started
  once on the new defaults whatever it chose before; `xrLabels` is left
  behind), which keeps a room's last value after leaving it.
  `#labels=face|fixed|hidden`, `#cards=face|fixed|hidden`, `#free=on|off` and
  `#subs=on|off` in a link set them. Stories read labels, cards and free moving
  every frame (`xrSettings` in `xrBegin`: `XR.lm`, `XR.cm`, `XR.free`; a shell
  without them means labels on top and nothing free, and a shell without
  `cards()` the labels' mode for the cards) and put `xrSig()` in `sigMain`; the
  shell alone draws the subtitles. The two sound switches (v100,
  `HOST.xr.sfx()` and `HOST.xr.voice()`, for pages and headsets alike) go the
  same way, in `look` beside these (see "The two sound switches" under "Sound
  effects"); `HOST.xr.sig()` leaves them out (the stories' panels do not show
  them).
  - The frame rate (v118; the owner, 5 November 2026): beside these, a fifth setting that is never the room's but each
    headset's own (`HOST.xr.fps()`, `HOST.xr.setFps(on)`, `xrFps` in `localStorage`, off by default, `#fps=on|off` in a
    link; not in `HOST.xr.sig()`): the menu's *Frame rate: on/off* row (Settings, under Moving and Subtitles), or a double
    press of B or Y (v119; the owner, 6 November 2026: "Fps counter should start with a hotkey like double press b or y":
    `buttons[5]` of either controller pressed twice within 0.4 s, `BY` in `sticks`, a button held as its controller
    appears counting nothing; a notice says *Frame rate: on* or *off*; no story uses that button). While on, in
    a headset session only, the shell draws a small read-out low in the view (`drawFps`, `OV.fps`, 0.36 m wide, 1 m away,
    22 degrees under the gaze and 14 to the left, fixed to the head, `renderOrder` 52: over the story and the subtitles,
    under the menu and the notices), drawn again when its numbers change (about once a second): the frames a second (since
    v136 *88 fps of 90 Hz* against the session's refresh rate, below, coloured by it: green within 3 % of it, amber within
    20 %, else red; where the browser says no rate, as before: *88 fps*, green from 70, amber from 55) and the time between frames, the mean and the worst of the last second (the
    shell's own frame callback, `FPS`, as the Debug tab's line), and the story's frame's triangles, draw calls and how
    long its code took (`HOST.perf` in `index.html`: the story's frame function is wrapped inside `HOST.loading.wrap`, so
    the loading scene's fade after it is not counted; while measuring, `renderer.info.autoReset` is off for the whole
    function, so a story that renders twice counts both, and in a headset one render draws both eyes; the shell's things
    in the story's scene, rings, icons, the menu and the read-out itself, are in the numbers; each second's means as
    `HOST.perf.stats()` `{ tri, calls, js, n, at }`; off, nothing is measured or changed). How the read-out reads and the
    numbers on a real Quest are untested.
  - The refresh rate (v136; the owner, 11 November 2026: "make sure that we get a good framerate everywhere, even in the
    lobby with only the stations visible i could not reach 90fps"). Quest Browser runs a WebXR session at 72 Hz unless the
    page asks for more (Meta's docs; Browser 16.4 and later: `session.supportedFrameRates`, `frameRate`,
    `updateTargetFrameRate(rate)`), and until v136 nothing asked, while the read-out painted 72 green. Each headset's own,
    never the room's, not in `HOST.xr.sig()` (`HOST.xr.hz()`, `setHz(n)`, `xrHz` in `localStorage`, 90 by default,
    `#hz=72|90|120` in a link): on each new session (`HOST.xr.watch`, `layerWatch`) and again whenever it changes, the
    highest rate the session lists at or below it is asked for (else the lowest listed); logged through `HOST.collab.log`
    as `frame rate` `{ want, list, asked, got, why }` (`got` the session's `frameRate` once the request has settled, `err`
    a refusal), and the session's `frameratechange` as `frame rate change` (its listener added with `HOST.quiet` set). The
    Debug tab's *Refresh rate: 90 Hz* row (each press the next listed rate, round again; greyed where the browser has no
    frame-rate API, the line beside it saying so) says beside it the session's rate and what it offers (*Now 90 Hz · offers
    72, 80, 90, 120*); the Debug tab's *Frame rate* line and the alignment samples (`sample()`'s `hz`: `{ f, a, w, v }`,
    the session's rate, the one asked for, the setting and the frames a second measured) carry it too.
    `HOST.xr.hzState()` (`{ want, list, asked, got, err, api }`: `api` null before a session was seen, false without the
    API) is for tests. Two developer experiments beside it on the Debug tab, each headset's own, never the room's, their
    defaults as before v136: *Foveation: the story's* / *0* / *0.5* / *1* (`HOST.xr.fov()`, `setFov(v)`, `xrFov`,
    `#fov=story|0|0.5|1`: as the story sets it, 0.5 at every story's first `xrBegin`, by default; else the shell sets
    `session.renderState.baseLayer.fixedFoveation` after the story's frame, `HOST.xr.layerStep` from `HOST.loading.wrap`,
    only when its value or the layer changes, so a story that sets its own again is set back; back to the story's, the
    layer's value from before is put back once; `fovNow()` the layer's now) and *Resolution: 100 %* / *90 %* / *80 %*
    (`HOST.xr.scale()`, `setScale(v)`, `xrScale`, `#scale=1|0.9|0.8` or `100|90|80`: three.js r128's
    `renderer.xr.setFramebufferScaleFactor`, read as it makes the layer, so set as each new session is first seen, before
    the story hands it to three.js, and while none runs; the row's line says it applies from the next session,
    `scaleNow()` the one this session was made with). Antialiasing is unchanged. Untested on a headset: what a Quest 3 or
    3S lists and runs at by default, whether it takes 90 or 120 from the page, how heavy stories hold 11.1 ms, and how
    foveation and a lower resolution look and what they save there.
  - Real-world occlusion (v119): a sixth setting that is each headset's own, never the room's, *Real world hides: room
    and people* (the default) / *room* / *people* / *nothing* on the menu's Settings tab (under My menu), only in AR;
    see "Real-world occlusion" below.
  - Your menu shown to your circle (v120; the owner, 6 November 2026: "the menu window of each person should optionally
    be visible for everyone so that i can explain it easier", then "menu shown to others in my circle"): a seventh
    setting, each headset's own and never the room's (`MSH` in `shared.js`, `xrMenuShare` = `circle` in `localStorage`,
    off by default; not in `HOST.xr.sig()`, no link option): the menu's *My menu: only me* / *My menu: my circle* row
    (Settings, under Frame rate, a note beside it). While on, the menu open and this headset lined up at a live station
    in a shared room (`menuShareTo`), the other headsets at that station see it where it floats here; never while the
    relay's password page is open (it shows the password as it is typed: the menu is closed for the others meanwhile).
    It goes out as quiet effects on the station's channel (`e.<station>`, type `@menu`, which the shell takes for itself
    in `onFx` and never passes to the story; nothing stored, no `FORMAT` change): the menu's pose in room coordinates
    (`{ k: 'pose', p, q, w, h, n, ts, m }`: its top edge's middle, which it hangs from, its turn, its width and height
    in metres, the number of its latest picture, the relay's time, `m: 1` while it moves) at most every 200 ms while it
    moves, once more as it comes to rest and once a second while still; a picture of what it shows (`{ k: 'pic', img,
    ... }`, the pose too: the drawn part of its canvas, only the height the tab uses, with the Story tab's copies of the
    story's panels drawn in where they show, on a dark ground) as a JPEG data URL, made smaller and coarser step by step
    (`MSH.steps`, 540 px wide at quality 0.75 down to 180 at 0.3; the next starts at the step that fitted, a step finer
    when it came well under) until it is under 47 KB (the relay refuses effects over 64 KB), sent only when what it
    shows changed (`menuSig`: the menu's content, `cver`, counted by `drawPanel` with the light of the button pointed at
    left out, the mirrored panels' texture versions and the height shown) and at most every 1.5 s (`MSH.picMs`), or when
    only that light changed at most every 4 s (`MSH.hovMs`: a ray moving over the buttons redraws the menu all the time,
    and every picture goes to everyone in the room), encoded with `toBlob` off the frame, and never sent when its bytes are
    those of the last one made (v121: what `cver` follows, people walking between circles among it until v136, which
    keeps them to Circles, changes more often than what a tab shows; `menuSent().same` counts them; the Debug tab's
    read-outs, drawn on their own since v136, move no `cver`: a picture shows them as they were when it was made); and `{ k: 'closed' }` once
    when the menu closes, the setting goes off, the station changes or the session ends (`menuShareEnd`). A headset at
    that station whose latest picture is older than the pose says (`n`) asks for it (`{ k: 'want', to }`, at most every
    1.5 s) and gets the last one made (also when a newer one did not fit); only a headset at that station keeps a
    picture (`menuIn`), so one that walks in later asks. Every other headset at the same live station draws it (`drawMenus`, `MENUS`) as a plane at that pose in the room
    (`OV.room`), smoothed as others' moves are (`bufAt` with `MIX.menu`), the picture's own shape, its corners cut
    round, two faces back to back so it reads the right way round from either side (from behind, left and right are
    swapped against the person's ray), depth-tested so what stands in front hides it, `renderOrder` 49.5 on its meshes
    (after the station cards set on top, under the story panels set on top, the subtitles, the read-out and your own
    menu; its group's stays 0, as three.js r128 sorts by a group's order before an object's own), a tag over its top
    edge with the person's name by their colour (*Anna's menu*); never pointable or pressable; gone 3 s after its last
    sample (`menusExpire`) or at once on `closed` (the log's `menu gone` says why: `closed`, `quiet` or `room`; a `closed`
    for another station than the copy's, or with no copy, is `menu closed ignored`). Pages draw nothing; the Shared
    dialog's people list says *showing their menu*. `HOST.collab.menuShare(on)`, `menuSent()` (`n`: pictures made;
    `pics`: pictures sent, a want's answer, an old picture sent again, among them; `at`, `ns` and `cv`: when each was
    sent, its number and the `cver` it shows; `cur`: the last picture made shows what the menu shows now), `menus(full,
    px)` (`px` false: no pixels read back) and `menuShot(master)` (the picture as it would be made now) are for tests. Untested on a headset: how the picture reads at a few metres, its cost (a JPEG
    made in the page at most every 1.5 s, about 45 KB to everyone in the room each time: the relay, and a peer-to-peer
    room's host, send every effect to every member, so with the Story tab of a playing story shown, its clock changing
    every second, about 30 KB a second to each of them), and Quest Browser's `toBlob`.
  - Moving with the sticks (v125, `index.html`, after `HOST.xr`; the owner, 8 November 2026: "Add Movement in vr mode,
    maybe with sticks, switchable by double pressing a stick?"): an eighth setting, each headset's own, never the room's
    and never in `collab.state()` (`HOST.xr.walk()`, `setWalk(on)`, `xrWalk` in `localStorage`, off by default,
    `#walk=on|off` in a link; not in `HOST.xr.sig()`). Turned on and off by the left stick clicked twice within 0.4 s
    (`sticks` in `shared.js`, a notice *Moving with the sticks: on* / *off*; until v132 either stick, since then the right
    stick clicked twice launches or lands a spaceship, and since v133 while one flies the right stick's press counts only
    at its middle: "Spaceships" below) or by the menu's *Moving with the sticks*
    row (Settings, under Moving and Subtitles). Both clicks must be on the same stick: a click of each within 0.4 s (or
    both at once) counts as one click, which opens or closes the menu; a single click acts only once 0.4 s have passed
    with no second click of that stick. While a spaceship flies the right stick's 30 degree turn rests (the thumb sits on
    A), the left stick still moving you. It applies (`HOST.xr.walking()`) in a VR session (not AR: there you walk for
    real),
    not while this headset is in a shared room's real room with the others (the room's frame and the others' view of you
    need where you really stand there) and while the story on show does not move you itself (`ownSticks: true` in its
    returned object, which no page says since v125); `HOST.xr.walkWhy()` says why not (`'ar'`, `'room'`, `'own'`,
    `'none'`, `'session'`; `''` it applies), and there a double click says so in a notice and the menu's row is greyed
    with the reason under it (`'room'`: *Not while you are in the room with the others: there you walk for real.*). A
    page that switches its sticks with it (`sticks: { say(on), note }` in its returned object; the studio, "The studio's
    two stick modes" below) has it apply in VR in a shared room too and moves you itself while it applies
    (`HOST.xr.walkSelf()`: the shell's travel stays as it is, never stepped, so the two never fight); `say(on)` gives
    the double click's notice and `note` the menu row's line in its own words. The left stick moves you along the
    floor where your head faces (1.5 m/s at full push, a dead zone of 0.2, the rate the push's square past it), the
    right stick turns you 30 degrees about your head on a flick past 0.6 (again once it is back under 0.3). A controller
    whose grip is held (`squeezestart` and `squeezeend` on the session, or its button 1) keeps its stick for the story
    (a carried scene's reach) and moves you not at all meanwhile; the free hand's stick still moves you while the other
    hand carries a scene (how that feels, comfort above all, is untested). How: three.js r128 has no
    `setReferenceSpace`, so the shell hooks the session's own `requestAnimationFrame` (in `HOST.xr.watch`, as
    `HOST.session` is set, before three.js starts its loop) and, before any callback of a frame reads it, puts its own
    `getViewerPose`, `getPose` (for an input source's ray or grip, or a hand's joint), `getJointPose` and `fillPoses` on
    that frame object (instance-level: a Proxy fails WebXR's brand checks), each answering for three.js's reference
    space from `base.getOffsetReferenceSpace(T)`, `T` the travel's inverse as an `XRRigidTransform`, made again only
    when the travel changes. Other spaces are left alone: an anchor's pose stays in the real room (an anchored place
    stays put and you move past it), as do `HOST.room`'s own spaces and the room scan's. The travel stays when the
    setting is turned off (you stay where you moved to), and goes at the session's end, once a shared room is joined and
    while in the room with the others (below). Stories need nothing for the move: their head, controllers and rays, the
    menu, the sounds' listener and the subtitles all follow three.js's space; their own stick use (an explore view's
    spin and zoom) waits while `xrWalking()` is true (the same line in every story). `HOST.xr.travel()` (`{ space, x, z,
    yaw }`) and `walkReset()` are for tests; `HOST.xr.toReal(v, q)` and `travelShift(yaw, x, z)` are for `shared.js`
    (below). Untested on a headset: how it feels on a Quest (comfort, the speed, the turn), and an anchor placed while
    moved (made at the moved coordinates in the real room, so the next session finds it elsewhere).
  - In a shared room, elsewhere (v128; the owner, 9 November 2026, after trying it: "should also work in shared rooms
    everywhere when the user is in vr and not in the same room"). It applies to a headset elsewhere in a room
    (`HOST.collab.here()` false: VR answered *Somewhere else*, or not answered yet, since a VR headset counts as
    elsewhere
    until it says otherwise), and is `'room'` for one in the room with the others (AR, VR answered *In this room* or
    *I am
    in the room*, the PC's Index the trackers see) and for any headset in a room on this device alone (`C.local`, where
    `here()` is true by design: its circles stand on this headset's real floor, and the room goes to a relay as soon as
    one answers, where the others line up with that floor). A `shared.js` without `here()` (an older one) gives `'room'`
    in any room, as before. Each headset's own setting still: nothing in the room's keys, no `FORMAT` change. Why it
    works: a headset elsewhere has its own floor as the room (`ownFrame`, made from where three.js has its head as it
    joins), and the room's frame keeps the real numbers of `HOST.room`'s own spaces, so the circles, cards, icons and
    people stay put in three.js's space while the sticks move the head and controllers through it. Everything of yours
    the room reads follows the head three.js has: your presence's head, heading, rays and grips (so the others see you
    move, smoothed as any move), the circles you walk into (also Back to the lobby with the circles asked first), the
    studio's behaviours (`heads()`), the sound zone. What compares your head with the real floor's origin or spaces
    takes
    the travel back first (`HOST.xr.toReal(v, q)`, `realHead` in `shared.js`): the check for an origin that jumps
    (`originCheck`, so a stick's move or a 30 degree flick is never a jump and never asks to calibrate), the shared
    space at the head, the PC's trackers' history of the head (`trkHist`) and the logged samples (`sample`, which also
    logs the travel). A reset of the room's floor with its transform (a recentre, waking: `floorReset`) moves the travel
    with the room's frame (`HOST.xr.travelShift`, the transform carried into three.js's space by `R.lf`, then
    T M T^-1), so you stay where you were in the room. Re-align for a headset elsewhere makes the room round where
    three.js has your head now, as before. The travel goes when a room is joined (or another: the code changes, so its
    frame is made from where you really stand), whenever this headset is in the room with the others (the answer
    changed to *In this room*, the trackers), at the session's end and in AR (never there); it stays while elsewhere,
    through Recenter at a station (the station's scene and panel, as ever) and on leaving the room. The double click's
    notice says *The others see you move* there, and the menu row's note that it works in this room because you are
    elsewhere. The studio is unchanged: it moves you itself (`walkSelf`). Untested on a headset: how moving through a
    room's circles feels, how the others see a moving avatar over Wi-Fi, a real recentre or wake while moved.
  - The studio's two stick modes (v125; the owner, 8 November 2026: "i want stick movement in studio mode too, just make
    it switchable with the double stick click so that i can switch between the two modes of stick operation in studio
    mode"). The same setting (`xrWalk`), not one of the studio's own: a double click of the left stick (since v132) then does the obvious thing
    everywhere (on: the sticks move you, in the studio as in every story; off: each page's own sticks, which in the
    studio are its walk, turn and steer), and the menu has one row for it. Off, the studio's own sticks as before (its
    VR walk and 30 degree turns with nothing carried, steering a carried item, scrolling the pane under the ray). On, in
    VR, the sticks move you by the shell's numbers wherever the ray is (the pane scrolls by Up and More) and also while
    something is carried: it stays in the hand and comes along (carry something far across the scene, turned with you),
    the sticks no longer steering it. The studio moves you itself (`stickMove` in `tools/studio/engine/e8_xr.js`, before
    any carry each frame): its scene moves (`XR.walk`, as its own walk does), so its panels stay with you as in its own
    mode, and the same in a shared room, where the others see you where you really stand (your presence is your real
    head; the shell's travel is never used in the studio). Switching keeps where you are (`XR.walk` stays); Recenter takes
    it back, at a station too. While a path is recorded the sticks move nothing (`REC`: the scene moving under the hand
    would go into the path), and a story's travel left from before is taken back as the studio comes on show (the
    shell's `step`, the page's `sticks`). Known limit: a two-hand carry of a group while moving may drift by the move
    (one hand carries it right). The notice says *Sticks: moving you* or *Sticks: the studio's*, as do the menu row's note,
    the item card's line under *Carry it* and the foot panel's hint. AR: you walk for real; the double click says *Not in
    AR*. Untested on a headset: switching on a Quest, carrying something far while moving, how a carried item turned
    with you feels.
  - Labels (`XR.lm`): on top, every scene label is a sprite over everything.
    In 3D, a flat sign at its sprite's place and size, upright and turned to
    you (about the vertical, in the rig's frame: `placeLabelXR` with
    `XR.signL` and `XR.signH`), but in the scene: depth-tested, so what stands
    in front hides it, readable from both sides. Hidden: no scene labels. The
    pointer's tip (`XR.tip`) is always a sprite.
  - Cards (`XR.cm`): in 3D, the two story panels (`XR.main`, the text and
    explore's panes, and `XR.foot`) stand in the scene as the labels' signs do
    (`panelDepth`, set only when the mode changes: depth-tested and writing
    depth, drawn first of the see-through things at `renderOrder` -1, their
    clear corners cut away by `alphaTest` 0.1), so whatever stands in front
    hides them, glass and glowing points too, and they hide what is behind
    them; the pointer still reaches a panel first, even one partly hidden
    behind the scene. On top: both story panels over everything, as before
    (`renderOrder` 50). Hidden: no story panel at all, neither `XR.main` nor
    `XR.foot`, in story and explore mode (not drawn and not pointable); the
    headset Stories screen stays (never stuck), the shell's menu stays (to
    switch back; its Story tab still shows the story's panels and works: play and
    pause are there, A and X do nothing since v125). Shown, the story's
    Panels row (below) applies on top. In the shell, station cards are drawn on
    top (after the scenes, before the story's panels, depth-tested) or, in 3D,
    as the labels' signs are (`renderOrder` -1, writing depth, `alphaTest` 0.1,
    both faces), and not at all when hidden (the ring stays, pointable and
    grabbable, and its icon; in a circle the other stations' cards show only
    while their ring is pointed at, see "Shared rooms", and with cards hidden a
    ring pointed at brings up its icon alone); people's name tags are sprites,
    signs over the head drawn the same way, or nothing.
  - In every mode of both: the Stories screen's panels, the menu (its Story
    tab's copies of the story panels too), the shell's notes and the subtitles
    are on top, and the stations' icons
    are as ever.
  - Free moving: the grip holds the scene like a real object, the point you
    hold the pivot. One hand moves it and turns it with the hand (`XR.rot`, a
    turn in the rig's frame; the facing comes from `XR.globeBase`, not from
    where you moved it, `xrFace`); two hands size it as before, move it with
    their middle and turn it with the line between them; let go, it stays.
    The story panel is held rigidly and may tilt. Off: things move but keep
    facing you, and the panel stands upright (turning it off clears `XR.rot`
    and stands the panel up, its yaw kept). Recenter clears the turn. The
    life-size stories (the flock, the robots, the pass story's fish) move only
    their panel. Stations stay level (room furniture). The anchored
    arrangement keeps `q` (the scene's turn) and `pq` (the panel's) too.
  - Subtitles (`drawSubs` in `shared.js`): only in a headset, in story mode
    with a line on show (playing or paused; nothing in explore mode, on the
    Stories screen, away from a station, or for a story without the hook), the
    narration's words in a strip low in the view (16 degrees under the gaze),
    1.4 m away and 0.9 m wide, white B612 on a dark rounded band, drawn on top
    of everything in every labels and cards mode (`renderOrder` 51: over the story panels,
    under the menu and the notices), one canvas redrawn only when the caption
    changes, fading between captions. It stays while the head turns less than
    15 degrees from it (or moves less than 12 cm) and eases back in front
    beyond. The words come from the story's caption hook (`caption`, below):
    the cues of the chapter on show, read as `tools/narration.mjs` reads them
    (so a recording and the captions say the same; a cue with no word of two
    letters, such as a chart's numbers, is not read), the latest cue passed
    with words cut into captions of at most two lines of about 42 characters
    (at a sentence's end, then a clause's, then a word; a new cue element
    always breaks), spread over the stretch to the next cue at reading pace
    (2.1 words a second, by word count), or faster only where the stretch is
    shorter than that (as the narration goes there); the last caption of a
    stretch holds until the next cue, and a chapter's last line is spread to
    end 0.75 s before the chapter does, so a slideshow stop shows its last
    caption. The pass story's captions are in the device's language (its
    panel is). How they read and follow on a headset is untested.
- Focus mode (`HOST.focus` in `index.html`, v106; the owner, 2 November 2026: "on a mobile device, phone as well as
  the ipad it needs less of the ui, maybe just a small bar and subtitles so the main focus is on the 3d models"; on by
  default there with a Text button to bring the panel back, each chapter's title shown briefly, explore's controls in a
  pull-up drawer). A story's 3D on its own on a page: on by default where `matchMedia('(pointer: coarse)')` matches and
  the screen's smaller side is at most 1100 px (phones and iPads), never in a headset's browser (Quest, Pico, Wolvic:
  Enter VR stays in view), off on desktops; this device's own setting (`pageFocus` in `localStorage`), never a room's;
  *Focus view* on the Stories screen (beside Slideshow) and in the top bar's More menu (⋯), `#focus=on|off` in a link.
  `HOST.focus()` is true while it is on, no headset session runs (`HOST.session` or the renderer presenting), a story is
  on show (not the Stories screen) and neither Text nor the drawer is open; whenever that value changes the shell sends a
  window `resize`, and every story frames its scene for the whole page from it (`GL.bare` in `resize()`, "Inside a
  story"). Body classes: `focus` while the setting is on, `fc-text` with Text open, `fc-drawer` with the drawer open; all
  its rules are scoped to `body.focus:not(.picking)`. `HOST.focus.on()`, `set(on)`, `text(open)`, `drawer(open)`,
  `close()` (Escape: More, then Text, then the drawer), `chapter(±1)`, `check()` and `state()` (tests).
  - The top bar (48 px plus the safe area, `--fc-top`): the story's short title, Stories, Shared, AR where the device
    has it (v109) and More (what has no room: the mode button under 700 px, VR, Install, Full screen, Focus view). The foot bar (56 px plus the safe area,
    `--fc-bot`): Play, the chapter arrows (as the headset's foot panel's: back to this chapter's start, or the one before
    within 2 s of it; on to the next), the chapter's name (Next in its place at a slideshow stop), a thin timeline along
    its top edge, the clock from 600 px up, Sound (as the top bar's) and Text, which opens the story's panel as it is (the
    bottom sheet under 900 px, the side panel above) and closes it.
  - Subtitles on the page: the narration's words in a strip just above the foot bar (white on a dark rounded band, at
    most two lines, `clamp(18px, 1.6vmin + 14px, 28px)`, smaller down to about 72 % when a caption needs a third line),
    fading between captions, only in story mode with Text closed (Text, explore mode, the Stories screen and a headset
    session hide it at once). They are the headsets' own captions: one function in `shared.js` (`captionNow`) reads the
    story's caption hook, splits and times it for both, `drawSubs` draws the headset's strip from it as before and
    `HOST.collab.caption()` gives the page `{ text, id }`.
  - Chapter titles: a chapter's heading (its `h1` or `h2` on the panel, else its timeline name) in the upper middle for
    about 3 s when the chapter is played into or jumped to, or a story starts from the Stories screen.
  - Explore mode: the view controls stay in the foot bar as one row that scrolls sideways, and Controls pulls the panes
    up in a drawer (at most 60 % of the height; full width under 900 px, in the side panel's place above; a handle), closed
    whenever explore mode begins; while it is open `HOST.focus()` is false, so the scene frames as with the panel.
  - Nothing changes on desktops with it off, in headsets, or in `collab.state()` (no `FORMAT` change). Untested on real
    phones and iPads (Safari's safe areas and URL bar, `:has()`, how readable the strip is over every scene): only in
    headless Chromium with touch emulated.
  - Phones and tablets (v109, `HOST.handheld` in `index.html`; the owner, 3 November 2026: AR more prominent where a
    phone has it, a top bar that fits, the back button, "mobile browsers do not properly fullscreen", and "on iphone and
    ipad one goes back when they want to move the story timeline on the bottom"). A phone or tablet is focus mode's own
    test (`HOST.handheld.hand`).
    - The top bar fits any page (`fit`, on the bar's changes, the body's classes, resizes and the font's arrival): under
      700 px wide (`#top.slim`, the Stories screen too, focus mode on or off, explore mode) short labels (*AR*, *VR*: the
      `.long` "Enter " hidden) and the mode button and Install in More (focus mode's ⋯, shown while `#top.more`); then
      only while the bar has no room (no button is squeezed; the title keeps 72 px or its own width) in turn: VR to More,
      a tighter bar (`#top.tight`), the Sound button's words for an icon (`#btnSoundIco`, `#top.sndico`, mirroring it
      as the foot bar's does), Shared, then AR (`#top .ovf`). More lists what is hidden (Shared under 760 px too), then
      *Full screen* / *Exit full screen* where the browser has it, then *Focus view: on/off* in a story. Its items pass
      the click on to their buttons; the top bar's own handler leaves More and its menu alone (the Stories screen stays
      open). Wide screens as ever.
    - AR on a phone or tablet that has it (`isSessionSupported('immersive-ar')`: Android's Chrome with ARCore; no iPhone
      or iPad has WebXR): Enter AR shown even without VR (the stories show it only beside VR), in focus mode's top bar
      too (an icon and *AR*, a cyan edge), and once per device (`arInvite` in `localStorage`, set as it shows) a card,
      *See it in your room*, about 3.5 s after a story first shows (`#hhCard`): Enter AR (the top bar's button, within
      the tap) or Not now. How a story feels in a phone's AR session (taps on the screen as input) is untested.
    - The menu in a phone's AR session (v125, the phone AR section of `shared.js`: `PH`, `phAsk`, `phRows`, `phTap`; the
      owner, 8 November 2026: "No access to menu in ar on android, make it one button on the top right"). A phone has no
      stick to click and no hand to pinch. Its AR session (a phone or a tablet, `phoneDev`: never a headset's browser,
      `IS_HEADSET`; a phone's or tablet's user agent, `DEV`, or `HOST.handheld.hand`; not camera mode, which keeps its own
      overlay) also asks for `dom-overlay` (optional, on every rung of `HOST.xr.request`'s ladder, through camera mode's
      wrapper; `extra.drop`: a refusal other than `NotAllowedError` or `SecurityError`, which are thrown at once, asks
      again without it, depth sensing kept, straight after the failed request inside the ladder, so the tap's activation,
      which lasts a few seconds, still holds; refused again, the story's line on the page says *Could not start AR: it was
      refused with the menu button (...) and again without it (...). Tap Enter AR again.*) with its own root, `#xrPhone`
      (made once, its CSS injected once, its listeners added with `HOST.quiet`);
      a headset's browser asks for nothing new. Granted (`domOverlayState`), the overlay shows one round menu button (52
      px, three lines) at the top right inside the safe areas, only during that session. The root passes taps through
      (`pointer-events: none`, `auto` on its controls; `beforexrselect` cancelled only on the button and the sheet), so a
      tap on the scene still points and presses. The button opens a sheet (at the foot in portrait, on the right in
      landscape, scrollable, buttons at least 48 px) with the menu's main rows, each calling what the headset menu's
      Settings row calls and showing its state (its words and `aria-pressed`): Exit AR, Recenter, Sound (this session's
      mute), Narration (this session's), Sound effects, Subtitles, Slideshow, Frame rate, Labels and Cards, Panels (the
      story on show's), Real world hides, and *The full menu* (`menuOpen(true, 'phone')`: the shell's 3D menu in front of
      you for the rest, a tap on the screen pointing at it and pressing it; the row then says *Close the full menu*).
      Close, or the button again, closes the sheet; nothing new is stored. Without the overlay: two quick taps on the
      screen (a `screen` input source, each taken at its `selectend`, once the story has pointed its ray; within 0.4 s)
      pointing at none of the panels open and close the 3D menu, as the left hand's two pinches do. The menu's hints, the
      notice *The menu* and the welcome (*Tap: point at a thing and press it.*, *The round button, top right: the menu.*,
      no controller drawn) say so on a phone. `HOST.collab.phone()` and `phoneSheet(on)` are for tests (the smoke test's
      `phone ar` block). Untested on a real phone: the overlay itself, the safe areas, taps passing through, Chrome's own
      AR controls beside the button, the 3D menu's size and distance on a phone's screen.
    - Full screen (the Fullscreen API: Android's Chrome, iPad's Safari, desktops): asked for within the tap on a story's
      card on the Stories screen on a phone or tablet (`storyTap`; a refusal is quiet), and from More. Never while a
      headset session runs or Enter VR or AR (or the card's) was pressed in the last 8 s, and never again by itself: a
      person who left it (back, Esc, the browser's swipe; back leaves full screen first, by itself) gets it back only by
      opening a story from the Stories screen or from More. An iPhone (Safari has no element full screen) not opened from
      the Home Screen (`navigator.standalone`, `display-mode: standalone`) gets, once per device (`homeTip`), a card
      saying *For full screen, add this to your Home Screen: Share, then Add to Home Screen.* (the manifest's `display`
      is `standalone`; the page uses the safe areas and `100dvh`).
    - Touch (`pointer: coarse`): the bars 20 to 22 px inside the safe areas (iOS takes a swipe from a side edge as back,
      from the bottom as home), the focus foot bar a little above the home indicator (up to 8 px more than the inset),
      its timeline a 28 px tall strip starting 24 px in (`touch-action: none`), the phone's bottom sheet 22 px in.
    - Untested on real devices: Android's and iPad's full screen, the iPhone tip, AR on a phone, Safari's gestures and
      address bar; only in headless Chromium with touch emulated and these APIs stubbed.
- Panels per story (`HOST.panels` in `index.html`; the owner, 29 October 2026:
  "i would want that for every story as an independent per story toggle maybe
  inside the clock menu"): `'shown'` (as ever), `'controls'` (only the foot bar,
  `XR.foot`: play and pause, the chapter arrows, the clock, Next; good with
  subtitles on) or `'hidden'` (no story panel; play and pause on the menu's Story tab: A and X do nothing since v125).
  Each story keeps its own value, the design room too: `get(key)`,
  `set(key, v)`, `next(key)`, `sig(key)`. Outside a shared room it is the
  device's (`xrPanels` in `localStorage`, `{ key: value }`, shown left out); at a
  station in a room the station's, for everyone at that circle (key
  `st.<id>.ui`, below; a station without it: shown), whatever a device keeps of
  its own. Set in the headset's menu (a *Panels: shown* / *controls only* /
  *hidden* row for the story on show, each press the next; no row on the
  Stories screen or away from a station) and, in a room, per station in the
  page's Shared dialog; never refused by the circles lock. `#panels=shown|controls|hidden`
  in a link sets it for the story the link opens. Stories read it every frame
  in `xrUpdate` beside the cards mode (`xrPanels()`, next to `xrSig`, which
  carries `HOST.panels.sig(XR_HERE)`): cards hidden still hides both panels
  (the two are independent; labels hidden hides neither), and the Stories
  screen never changes with it.
  Not in a story's `state()`. How it feels on a headset is untested.
- Developer mode (v125, `HOST.dev` in `index.html`, `NEWS` in `shared.js`; the owner, 8 November 2026: "A box at the
  beginning of a session that tells me the most recent changes and what i should test, optionally enabled when in
  'developer mode' a switch in the menu"). This device's own, off by default (`devMode` in `localStorage`, `#dev=on|off`
  in a link); its switch is at the Stories screen's foot (`#btnDev`, small, beside *What is new*, `#btnNews`), in More
  (focus mode's and a narrow top bar's) and on the headset menu's Settings tab (*Developer mode: on/off*, under Frame
  rate). What is new is `whatsnew.json` at the app's root, `{ version, date, new, test, untested }` (short sentences;
  New, Please test and Untested), written by hand at every release; fetched past every cache as `version.json` is
  (`?t=`, `no-store`; the service worker passes it through, the relay serves it `no-store`, never in `SHELL`), at most
  40 sentences a list.
  - On a page, while it is on: a card (`#devCard`) over the Stories screen, or over the story a link opened, once a
    page load (`HOST.dev.boot()`, after the first story has started), with the release's number from the file (*What
    is new in v124*), its date and the three lists; *Got it* keeps it away for that version on this device (`devSeen`),
    *Later* (also Escape and the back button) until the next page load. Never in a headset session: a session that starts
    closes it, as Later (`HOST.session`'s setter). *What is new* (the Stories screen's foot, More) opens it any time.
  - In a headset session, while it is on: at the start of every session until Got it for that version, the menu opens
    by itself at *What is new*, a page of the Debug tab in place of its content (`newsPage`, `PNL.page` `'news'`, as the
    room setup guide is of Circles), as tall as its lists need (its type 22, 20 or 18 px, the largest that fits the
    1920 px canvas; what still does not fit counted), with *Got it* and *Later*; either closes the menu it opened, and
    closing it any other way (another tab, the menu closed) counts as Later. It comes last of what a session shows by
    itself: after the startup flow in a shared room (the room setup guide, the check by eye) and after the welcome
    (*Getting around*: once it has shown and gone; with it off, where it would have come, 2.5 s in), 0.8 s after the last
    of them (so about 3.3 s into the session with the welcome off), never over the open menu (it waits until it is
    closed), the questions, a calibration or a check, never in camera mode. The Debug tab's *What is new* opens the page
    any time (*Got it* and *Back*).
  - A file that cannot be fetched is said in one line (*Could not fetch what is new (whatsnew.json): the server answered
    404.*; a release fetched earlier in the page is kept and shown instead), and while it is fetched *Fetching what is
    new...*: then the card has *Later* alone and the headset's page *Later* (or *Back*) alone, since Got it names a
    release. Nothing in a room's keys or `collab.state()` (no `FORMAT`
    change). `HOST.dev.on()`, `set(on)`, `load(again)`, `data()`, `seen()`, `card(open)`, `state()`;
    `HOST.collab.whatsNew()` (`{ shown, fl, menu }`), `devOpen()` and `welcomeMs(ms)` are for tests. How the page reads
    in a headset (about 1 m tall with v124's lists) is untested.
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories only say
  what should play. A story asks for its file with
  `AUD = HOST.audio.narration(url, { ready, error })` and calls
  `AUD.sync(playing, t)` and `t = AUD.follow(t)` every frame and `AUD.seeked()`
  after a jump; `AUD.label()` and `AUD.on()` feed the headset panels. Stories set
  `HOST.session` when they start or adopt a headset session; the shell listens
  to its controller events (`select`, `squeeze`: Chromium counts them as taps,
  `selectstart` it does not) and its visibility. Never create or close an
  `AudioContext` in a story. One exception, and only this one (v111): the studio's Upload pane decodes a short sound it
  is given in an `OfflineAudioContext` (`monoWav` in `tools/studio/engine/e7b_upload.js`), to mix it to a mono WAV;
  such a context opens no output and plays nothing (v125: a voice recorded with a movement goes through the same
  `monoWav`, the same one place; its level meter is an analyser on the shell's context, connected to nothing else). The studio's sounds placed in a scene play through the shell's
  context (`HOST.audio.fx()`), as the effects do ("The studio" below). How it works, and why (the narration was silent on
  the Quest twice):
  - Two engines, unlocked by the first tap or click (Enter VR is one) and kept
    for the life of the page: Web Audio (first choice: one `AudioContext`,
    `latencyHint: 'playback'`, never closed) and one `<audio>` element
    (fallback: plays the fetched bytes from a blob URL, so it needs no
    decoding, no `AudioContext`, no network and no service worker; Chromium
    refuses a media file whose byte ranges come partly from the network and
    partly from a service worker, as on a first visit). The element also plays
    while Web Audio is still decoding. Only one decoded file is kept.
  - Only taps the browser counts unlock (`navigator.userActivation.isActive`;
    Esc or a bare Shift do not).
  - While a headset session runs, Web Audio plays an inaudible hum (noise at
    3e-5), so its output never goes silent. Browsers swap a silent output for a
    dummy one, and opening the real one again inside a headset can fail; the
    narration used to work on the Quest when it started right at Enter VR, and
    stopped when it started only after a pick on the headset Stories screen.
    Outside a headset there is no hum (on a phone it could stop other apps'
    audio).
  - A watchdog (`check()`, about once a second from `sync()`) retries
    `resume()` (allowed without a new tap once the page has had one), reopens a
    stuck output (suspend and resume with a 3 s deadline, then a new context;
    decoded files are reused), and switches to the `<audio>` element when Web
    Audio reports two device errors within a minute, its clock stops, a tap or a
    new context has not started it within 3 s, or it cannot decode the file
    within 30 s. A Web Audio engine that runs after all is taken back.
    `follow()` only trusts a clock that is known to move, so a stuck engine never
    freezes a story.
  - Sound by mode (v124; the owner, 8 November 2026: "On mobile and desktop default to no sounds and no narration until
    manually enabled, in ar and vr default to sounds but no narration"; "narration in headsets should stay on when its
    turned on once"). A headset session (VR or AR on any device, the Quest and a phone's AR alike: `HOST.inXR()`, a
    session in `HOST.session` or the renderer presenting) has its own mute and narration, apart from the page's; leaving
    the session, the page's apply again. The hum, both engines and the watchdog are unchanged.
  - The mute (the Sound button: the page's bar, focus mode's foot bar, and
    *Sound: on/off* on the headset menu's Settings tab, `HOST.audio.mute(on)`,
    `HOST.audio.muted` the one that applies now). On a page it is **on by default** (v109; the
    owner, November 2026: "Default to sound off in all modes", kept for pages): a device plays
    nothing, narration, effects, backgrounds or the vacuum, until it turns the
    sound on, and its choice is saved under `narrationMuted3` (only `'0'` keeps
    the sound on; a new key, so every device started muted once; the older
    `narrationMuted`, a mute saved when *Play sound* was pressed in the headset,
    and `narrationMuted2`, sound on by default, are removed). In a headset session it is **off by default**
    (v124): effects play at once (Enter VR or AR is a tap, so the engines start), and only the menu's *Sound* row turns
    it on there, saved as `xrMuted` (`'1'` keeps the session muted); the page's own stays as it was. Muted, a story
    runs on its own clock with its subtitles, as with the Narration switch off.
    The bar's button says *Sound off* (title *Turn the sound on*); a press turns
    it on (it is a tap, so it starts the engines too); with no recording (a
    story without one, the design room) it stays, for the effects (*Sound off*,
    *Sound on* or *Play sound*). `#sound=on|off` in a link sets it (saved).
    *Play sound* (and any press while loading with the sound on) only starts the
    engines; it never mutes. Reset in Sound check turns both mutes off. The Narration
    switch (v100, `HOST.xr.voice()`, the narration that applies now; see "The two sound
    switches" under "Sound effects") is a second, finer way to silence it:
    `sync` plays nothing and `speaking()` is false while it is off, so the story
    runs on its own clock and the effects do not duck; the mute (the Sound
    button) stays this device's quick mute of everything. In a headset session the story panel's Sound button
    (every story's `hb('sound', ...)`, calling `HOST.audio.toggle()` and drawing `AUD.label()` and `AUD.on()`: a shell
    change, no story file touched) is this headset's narration switch: it says *Narration on* or *Narration off*, lit
    while on, and a press turns this headset's narration on or off (`HOST.xr.setVoice`), never the mute.
  - Sound check (`#soundcheck`, a button on the page's Stories screen; in the
    headset a page of its menu, the shell's `soundPage`, in or out of a shared
    room; since v109 no longer a panel of the headset Stories screen) shows `HOST.audio.report()`, plays a beep through each
    engine and lets the user pick an engine (`soundEngine` in `localStorage`).
    Ask a user with sound problems on a device for those lines.
  - Listeners the shell adds while a story runs (a new context, the headset
    session) are added with `HOST.quiet` set, so story changes do not remove
    them.
- Sound effects (`HOST.sfx`, `sfx.js`; the owner, 29 October 2026: "nice sound
  effects to everything"; after listening to phase 1: "sounds are fine, go on",
  and explore mode gets sounds too). Phase 1: the shell's own sounds and a quiet
  background per story. Phase 2: sounds inside the stories (cues on their
  timelines, explore and headset actions, the live simulations' own) and
  continuous sounds, below ("Sounds inside the stories"). **On by default** since
  phase 2 (a device that saved them off keeps them off). v100 (the owner, 30
  October 2026, after listening to every story's track: "remove the background
  hums, they are not good, i like the interaction feedback and the small woshes
  and beeps. make it so that we have a switch for sound effects and one for
  narration, both global in the clock menu and the shared menu on the desktop";
  "flock and pass it on can keep their sounds as is, all other background noise
  can go"; "vacuum sounds keep"): only the flock and the pass story keep a
  background, the machines' hum went (the robots' vacuum stays), and the two
  switches below ("The two sound switches"). The rules:
  - Everything is made in `sfx.js` from Web Audio nodes and short generated
    buffers (seeded noise, smooth random drifts, a small reverb): no files.
  - It plays through HOST.audio's one context (`HOST.audio.fx()`: the context
    while Web Audio runs after a tap, the page or headset is in view, Web Audio
    is not out or set aside for the `<audio>` element in Sound check and not
    being reopened; else null). Never a context of its own, so nothing before
    the first tap and nothing while only the `<audio>` element plays. It builds
    its graph again on a new context (the watchdog's `renew`). The hum, both
    engines and the watchdog are untouched. While the sound is off (the bar's
    Sound button, the headset panel's or the menu's *Sound* row: `HOST.audio.muted`,
    this device's quick mute of everything, on until the device turns the sound on, v109) the effects and the background are silent too (the app's
    adapter gives no context then: a visitor who turns the sound off expects
    silence); the two switches are the finer ones (the narration without
    effects, or the other way round).
  - In a headset a sound can come from a place (`play(name, { at: [x, y, z] })`,
    the scene's coordinates, which are the reference space's): an HRTF
    `PannerNode` (inverse distance, full level within 1 m), the listener at your
    head every frame (`HOST.sfx.listen(p, q)` from shared.js's `tick`; back at
    the origin when the session ends). On a screen plain stereo
    (`{ pan: -1 .. 1 }`; page buttons are panned a little by where they sit).
  - It ducks under the narration: -9 dB (down with a 0.14 s time constant, back
    with 0.5 s) while `HOST.audio.speaking()` (the narration sounding through
    either engine, also a slideshow stop's tail). The backgrounds duck too.
  - At most 16 voices: a new one past that cuts the one quietest now (its level
    times what is left of it; the oldest of equals) in 25 ms. Each sound has a
    minimum gap (the hover tick 70 ms, notices 0.6 s); `{ force: true }` skips
    it (Arrange all's thunks, Try them, the tests). A soft-clip curve at the
    output is exactly level below 0.6 of full scale. `play(name, o)` also takes
    `pitch` (a frequency factor), `dur` (a texture's or a sweep's length, s) and
    `n` (a count: the ratchet's clicks; `rise` makes each a little higher); a
    name it does not know plays nothing (an older shell, a newer story).
  - Continuous sounds (`HOST.sfx.drone(id, name, o)`, `DRONES`: `vacuum` only;
    the machines' hum, `machine`, went in v100 with its four spans in the tour,
    the muscle, PET and mutation stories and its two explore-mode uses, ATP
    synthase's rotor and the PET scanner's ring): kept going while asked for every frame (at least every 250 ms),
    `o: { at, pan, gain, pitch }` followed smoothly (0.08 s); faded in over
    0.3 s, out over 0.4 s once not asked for 0.3 s (the engine's step), at once
    when the effects go off or silent; at most 4 (a fifth replaces the
    quietest only when it is louder), not counted in the 16 voices; `state().drones` lists them.
    Nothing in a story stops them: it stops asking (a pause, a jump out of the
    span, explore mode, another story); a hot swap keeps the ids
    (`<key>.<n>`), so one running through a swap carries on.
    `SFX_LIB.length(name, o)` is a sound's length from a dry run of its recipe
    on a stand-in context (the cue checker's overlap; renders are sized by it).
  - The two sound switches (v100), each for every story at once, pages and
    headsets alike: **Sound effects** (`HOST.xr.sfx()`, `HOST.xr.setSfx(on)`;
    `HOST.sfx.on()` and `HOST.sfx.set(on)` read and write the same setting
    through the engine's `on`/`set` hooks) and **Narration** (`HOST.xr.voice()`,
    `HOST.xr.setVoice(on)`: off, the narration is silent on both engines,
    `HOST.audio`'s `voiceOff()` in its `sync` and `speaking`, and the story runs
    on its own clock as when muted; the effects and the subtitles go on, nothing
    ducks). Sound effects on by default, and the narration on a page (`narrationOn`, only `'off'` saved keeps it off).
    In a shared room the effects are the room's, for every
    headset and page in it (key `look`, `sfx`, beside the headsets'
    four settings; set by anyone, never refused by either lock; one the room
    never wrote stays each device's own, so a device that turned it off keeps it
    off, and another setting written leaves it out of the key),
    else this device's own (`sfxOn`, only `'off'` saved keeps them off),
    which keeps a room's last value after leaving it,
    as the headsets' settings do. `#sfx=on|off` and `#voice=on|off` in a link (the latter both of this device's own
    narration values, the page's and a headset session's: `HOST.xr.setVoiceOwn`).
  - The narration (v124; the owner, 8 November 2026: "narration in headsets should stay on when its turned on once but
    should also have a global setting where i can turn it off or on for every headset in the room at once (each headset
    could still turn it on or off individually and this would then reset once the headset goes into the lobby"). What
    applies (`HOST.xr.voice()`, and why, `HOST.xr.voiceWhy()`: `'room'`, `'own'` or `'mine'`):
    - On a page: in a room the room's (`look`'s `voice`, once written), else `narrationOn`. A page's press (Sound check,
      the Shared dialog) in a room is the room's for everyone (below), outside a room its own.
    - In a headset session outside a room: this headset's own (`xrNarration`), **off by default** and remembered once
      turned on (the menu's *Narration* row, the story panel's button).
    - In a headset session in a room: this headset's own for the room if it changed it there (an override, `{ code, vg,
      on }` kept as `xrNarrRoom`, never written to the room, so it survives a new session in the same room), else the
      room's `voice` when written, else this headset's own (off by default). The override goes when the room's `vg` moves
      on (a press for everyone: every headset follows it at once), when this headset goes to Back to the lobby (walking
      in or *Go in*: where the shell calls the story's `lobby` hook, `HOST.xr.voiceDrop('lobby')`) and when it leaves the
      room (`voiceDrop('leave')`; another room's code drops it too).
    - For everyone (`HOST.xr.setVoiceAll(on)`, `HOST.collab.setVoiceAll(on)`): a write of `look` with `voice` and `vg`
      one more (FORMAT networks-36: an older device writing `look` would drop `vg`), so a press always means "set every
      headset and page here to this". From the headset menu's Circles tab (*Narration for everyone here*: *On for all*
      and *Off for all*, `voiceall:on` and `voiceall:off`, lit by the room's value, with a note) and the page's Shared
      dialog (its Sound row's Narration in a room). Every write of `look` keeps `vg` (`setLook`).
    Rows: the headset's menu (*Sound: on/off*, this headset's mute, then *Sound
    effects: on/off* and *Narration: on/off* side by side under Subtitles and
    Panels, then *Effects volume* with a note: the volume and the narration this headset's own, until the lobby, Sound
    effects the room's), the Circles tab's *Narration for everyone here*,
    the page's Shared dialog (a Sound row under the room's parts, shown in a
    room for everyone there and outside a room for this device) and Sound check
    (Sound effects: on/off, a volume slider, Try them, Narration: on/off). The
    volume (`sfxVolume`, 0 to 1, 0.75 by default, squared as a loudness taper,
    so 75 % is 5 dB down; the menu steps 25, 50, 75, 100 %) is always this
    device's own. The Sound button stays this device's quick mute of
    everything. Never in a story's `collab.state()`. *Try the sound effects* is
    on the menu's Sound check page; Sound check's report has a line for the
    effects (`HOST.sfx.line()`) and says when the narration is switched off.
    Neither switch silences the studio's sound emitters (a scene's own sounds, not effects): they follow only the
    Sound button, this device's mute (v111; the studio's Scene pane and a sound's card say so).
    How a room's switch sounds on a hall of headsets is untested on devices.
  - What plays when (all from the shell): a page button (any `button`, after its
    own handlers): a quiet click, or a switch's on or off sound by its new
    `aria-pressed`, unless the press made a sound of its own (`HOST.sfx.count()`
    moved) or the button has `data-sfx="none"` (the beeps). The headset menu: a
    click, or a switch's sound for a button drawn with `on` (`tog` in its
    region), at the pointer or fingertip; a stick's click or the left hand's
    two pinches opening and closing the menu (open, close, from where it floats;
    not when it opens by itself); pointing at a menu button or a station's ring
    or card, or a fingertip over a new button (hover, a soft tick); the grip
    taking and putting down the menu (grab and drop, at it); grabbing and letting go of a circle (grab,
    drop, at it); a circle placed (place, a soft thunk: Add, Move here, Design
    room here, the map's drag; Arrange all one per spot, along the rows); the
    circles lock and a story's lock (lock, unlock); a notice in front of you
    (notice, from where it shows) and the page's Back-in-room toast; a story
    built (ready, three soft notes, from `HOST.loading.wrap`; not behind the
    Stories screen); walking into a circle (enter, a gentle swell); someone
    joining or leaving the room (join, leave, from where they stand: a newcomer
    a second later, once its presence has come).
  - The background (a bed) of the story on show, chosen from its key, only for
    two stories since v100: the flock dusk air and distant birds (`dusk`), the
    pass story a deep sea hush with bubbles (`sea`), both as they were. Every
    other story, the design room and the studio have none (`SFX_LIB.bedOf(key)` is `''`; the
    calm tone, the robots' room tone and the soil story's wind went), and a new
    story gets none. Each made about -35 LUFS at full
    volume, some 20 dB under the narration (-13 to -16 LUFS), with no energy
    worth the name below 100 Hz (a headset's speakers give little there). Faded
    in over 3 s once the story is built (`HOST.loading.ran`), out over 1.5 s when
    it goes (loading another, the Stories screen on the page or in the headset,
    a headset in a room away from every station), at once (0.3 s) when the page
    or headset is hidden or the effects are turned off. Birds and bubbles are
    scheduled 1.5 s ahead, from the engine's step (every 100 ms, a timer of the
    shell's).
  - The sound board, `tools/sfx.html` (served next to the app), loads `sfx.js`
    directly and runs an engine of its own on its own context (a tool page, not
    the app): every sound with a button and what it is for (the stories' sounds
    with what uses them and their pitch and length), the continuous sounds
    (start, stop, pitch), *A story's sounds* (a story's whole sound track: its
    cues read from the app in a hidden frame, rendered a minute at a time with
    its background, its continuous sounds and its narration where it has a
    recording, played with a seek bar, its cue list beside it), the two
    backgrounds (the flock's and the pass story's), a 3D demo (a sound circling your head through the HRTF panner;
    headphones), the ducking demo (seven seconds of the airports' narration over
    the flock's background and clicks) and the voice limit. `node tools/sfx-render.mjs
    [url] [out folder]` renders each in headless Chromium through an
    `OfflineAudioContext` (the same graph), converts them with ffmpeg to MP3
    (44.1 kHz; mono for the interface and room sounds, stereo for the stories'
    sounds, the continuous ones, the backgrounds and demos), writes `sfx-all.mp3`
    (everything with 1.5 s of silence between) with its index `sfx-all.txt`,
    `sfx2-all.mp3` and `sfx2-all.txt` (phase 2 alone: the stories' sounds, a few
    examples of their use, the continuous sounds), and `levels.txt` (sample and
    true peak, the loudest 400 ms, and for the backgrounds the integrated
    loudness, beside the narration's; a story sound out of its range flagged).
    `--story <keys|all>` renders a story's whole track instead,
    `story-<key>.mp3` with its cue list `story-<key>.txt` (m:ss, chapter, sound,
    options, where), at the default volume (75 %), the effects 9 dB under a
    recorded narration as in the app (live and explore sounds are not in it).
    The levels are the app's at full effects volume, one gain for all: the
    shell's sounds -30 to -45 LUFS (loudest 400 ms), the stories' accents about
    -27 (`STORY` in `sfx.js`, +3 dB over their recipes, one knob for all of
    them), their short ones by their peak (-9 to -15 dBFS), the backgrounds -35
    integrated, the narration -13 to -16. Whether they sound good, and how loud
    they are on a headset, can only be judged by ear.
  - Sounds inside the stories (phase 2; every story, the design room and the studio keep
    the same lines, the flock's `tools/flock/engine/` and the airports' the
    references): the story's cues are set beside its keys in `buildStory`,
    `sfxCue(t, name, set, at, o)` (story time; a set and one of its anchors, or
    for the hand-written three an item: an airport, a protein, a copy or an
    organelle; `o` play's options and `seq: true` for a marked sequence), and
    spans of a continuous sound `sfxHold(t0, t1, name, set, at, o)`. The block
    after the slideshow block (`SFXQ`, `sfxCue`, `sfxHold`, `sfxN`, `sfxWhere`,
    `sfxPlay`, `sfxHidden`, `sfxAct`, `sfxStep`; `sfxPos` after it, identical in
    every built engine) plays a cue as the clock crosses it while the story
    plays, by the slideshow's crossing rule (`SLIDE.from`, set in `slideStep`):
    so every device at a station plays the same cues at the same moment off the
    station's clock, none on a jump, a scrub, a slideshow stop's seek or a late
    joiner's start, a cue at most 1.5 s late (the narration's clock leaps ahead
    as it starts after a jump) and never twice (`SFXQ.hi`). `frame()` keeps
    `was` (playing as the frame began) and calls `sfxStep(was, dt)` right after
    `slideStep`. A sound comes from its place (`sfxWhere`: the scene's
    coordinates, an HRTF panner in a headset; on a screen a pan by where it
    shows). Explore and headset actions call `sfxAct` (explore mode only, and
    only while the story shows: a room's state applied while the story plays is
    silent) or `sfxPlay` where the story already handles them: a pick `pick`, a
    result `ping`, a scene change `whoosh`, a knockout or closure `knock`
    (undone: `rise`), a shuffle or a cut `snap`, a simulation started `pulse`, a
    slider crossing a named stop `step`. The headset's story panels: a soft
    `click` at the button on a press that made no sound of its own (`xrRelease`),
    a `hover` tick as the ray comes onto a button (`xrPoint`); page buttons
    click through the shell as before. The live simulations (the flock, the
    robots, the pass story's fish) define `sfxLive(dt)`, which the block calls
    every frame while the story shows: they poll what happens (a falcon or a
    shark starting, crumbs, a robot's bump), so what another device sends sounds
    too. Nothing goes into `collab.state()`, no effect, no `FORMAT` change; an
    older shell (no `HOST.sfx`, no `drone`, a name it does not know) plays
    nothing and nothing throws. `SFXQ.log` keeps what was asked for (`[name,
    APP.t, mode]`, hover ticks aside), also before a tap: the tests read it.
    Rules for cue tables: a cue 0.2 to 0.5 s before the line it belongs to (the
    sound announces, the voice follows) or in the pause after it; a chapter's
    opening cue in the 0.6 s before its heading; textures under speech at gain
    0.3 to 0.45; no two cues of one sound closer than its gap; at most 4 onsets
    in any 3 s unless marked `seq`; at most 6 cue voices at once
    (`node tools/sfx-cues.mjs [url] [keys|all]` checks all of it in seconds,
    and prints each story's busiest moment). About one story sound every 12 to
    25 s, short sequences (a path's hops, a circuit's gates) and soft textures
    under the voice. The story sounds (each reused across stories; their
    descriptions and uses are in `sfx.js` and on the sound board): `grow` (a
    network growing: glassy grains thickening and rising), `link` (a link
    snapping on), `snap` (a link breaking), `whoosh` (air sweeping up or down:
    flights, scene changes), `bubble`, `pick`, `ping` (a result: two notes up a
    fifth), `step` (one step of a sequence), `rise` (a reveal: a chord swelling
    and rising a fourth), `knock` (a closure, a knockout; a robot's bump),
    `heart`, `flutter` (wings), `rush` (water, flows), `patter` (many small
    things landing), `spark` (an impulse), `pulse` (a signal spreading), `clink`
    (glass), `ratchet` (a mechanism turning); the spaceships' (v132, kind `game`, at the shell's levels, in `ORDER` after
    the room's: `zap`, `zapLow` (a drone's), `shieldHit`, `hullHit`, `boost`, `boom`, `bump`, `launch`, `land`, `respawn`,
    `pickup`, `pickupEnd`; no engine sound: the owner's rule, no hums unless asked); continuous `vacuum` (a robot
    vacuum, its pitch its speed; the only one since the machines' hum went). How
    they sound in a story, on a Quest's speakers, through HRTF, and with ten
    headsets at one station (open-ear speakers may let neighbours hear a slight
    flam) is unheard and untested until tried.

## Real-world occlusion (`HOST.occlusion`, `occlusion.js`)

In an AR session (passthrough) real things hide what stands behind them, as they would a real object (v119; the owner,
6 November 2026: "also plan for adding the occlusions", "occlusion should be on by default"). The way it is done was
proven on a Quest 3 (Quest Browser 154) with the room test page (`room-test/`), whose depth pass, reading, `ready`,
probe, `roomSync` and `shapeSig` it reuses.

- **The request.** `HOST.xr.request(mode)` (in `HOST.xr`, `index.html`): VR exactly as before (`{ optionalFeatures:
  HOST.xr.features(mode) }`, its ladder kept); AR adds `depth-sensing` to the optional features with `depthSensing: {
  usagePreference: ['gpu-optimized', 'cpu-optimized'], dataFormatPreference: ['unsigned-short', 'luminance-alpha',
  'float32'], matchDepthView: true }`, and the room test's ladder: a `TypeError` naming one of those values (a browser
  that does not know `'unsigned-short'`) asks again without it, any other refusal asks again without depth at all. With
  `extra.drop` (a phone's menu button) what `extra` asks for is dropped first, at once, depth kept (the person's or the
  browser's own refusal, `NotAllowedError` or `SecurityError`, is thrown at once then).
- **The setting.** `HOST.occlusion.own()`, `set(m)`, `next(m)`, `mode()`: `'both'` (the default: room and people),
  `'room'`, `'depth'` (people, hands, anything moving) or `'off'`; this headset's own (`xrOccl` in `localStorage`,
  `#occl=both|room|depth|off` in a link), never a room's, never in `collab.state()` (no `FORMAT` change). The menu's
  Settings row *Real world hides: room and people* -> *room* -> *people* -> *nothing* (each press the next) with a note.
  A story may ask for its own (`HOST.occlusion.scene(mode)`, also `true` for `'both'` and `false` for `'off'`; `null`
  gives the headset's own back): the studio, for a scene that says always or never; cleared when the story changes
  (`detach`, from `HOST.teardown`), and the menu's note says so while it holds.
- **Each frame.** `HOST.loading.wrap` wraps the story's frame function in `HOST.occlusion.wrap` (inside `HOST.perf`'s, so
  the read-out counts it): before the story draws, in an AR session with the story built (`collab.scene()`), its
  objects (`O.root`, a `THREE.Group` with `renderOrder` -1e9, so its group order puts them before everything of the
  story's) are hung in the story's scene (its root is the renderer's reference space), taken out in `HOST.teardown`
  before the story is disposed and hung in the next story's on its first frame, so they survive a story change in a
  session. Nothing at all happens outside an AR session or on a frame with no `XRFrame` (three.js r128 also runs the
  loop on the window's frames).
- **Depth (people).** Each frame, for each view, `XRWebGLBinding.getDepthInformation(view)` (CPU depth, a phone's:
  `frame.getDepthInformation(view)`, uploaded as metres). A full-view quad drawn first (opaque, `renderOrder` -2 in the
  group, `depthFunc` Always, no colour, not culled) writes each eye's real depth as `gl_FragDepth` with that eye's
  projection (`onBeforeRender` per eye: three.js's left camera is on layer 1, its right on 2), the session's texture
  handed to three.js as an external texture (a stand-in whose `__webglTexture` is the session's), set to nearest every
  frame; an eye without depth that frame gets a texture of zeros (unoccluded). Readings: window (a depth buffer's value
  for the depth's own near and far: `near / (1 - v)` with no far plane, as a Quest 3 gives it; the usual formula for a
  finite far) or metres (the value times `rawValueToMeters`, through `normDepthBufferFromNormView`): window until the
  probe has looked when the depth gives its own range, else metres; the probe (the room test's auto reading: a 16 x 16
  grid of raw values read back, a few times at most a session until it has values, an integer texture refused by a
  float sampler tried with an integer one) decides once (again after a renew: "After a sleep" below). The depth's own view is taken as the eye's (on the Quest it
  matched to 0 cm and 0.03 degrees). Depth sensing runs for the whole AR session, whatever the setting (v124: until
  then it was paused while unused, and a Quest whose depth was paused from the session's first frame, the setting at
  *nothing*, never gave it back when the setting was turned on again: the owner, 8 November 2026).
- **Room.** `frame.detectedPlanes` and `detectedMeshes` (when the session enabled them) drawn depth-only in the story's
  scene, each part posed every frame by `frame.getPose(its space, renderer.xr.getReferenceSpace())`, built again only
  when its shape really changes (`shapeSig`: a plane by its corners, a mesh by its sizes and a sample of its values,
  the same arrays as last time taken as the same; a Quest 3 marked them changed about 56 times a second with nothing
  changed), the old drawing kept until the new one is built, at most two built a frame.
- **After a sleep** (v131; the owner, 10 November 2026: "Occlusion stops working after longer sleep in quest 3s? Maybe
  in 3 too, will test"). Until then everything was decided once a session (the binding, the depth's kind and reading,
  the probe) and nothing asked again: depth that stopped coming, calls that threw and room parts with no pose failed
  silently. The likeliest cause, as with anchors not tracked after standby: after a long sleep the headset's runtime
  stops, or starts again, its depth and its room scan. So `renew(why)` asks again for what the session gave: the depth's
  state dropped as the session's end drops it, a new `XRWebGLBinding`, its kind (`D.kind`), reading (`S.decided`) and
  probe (count and time) decided afresh, `session.resumeDepthSensing()` where the session has it and `depthActive` is
  not true (false, or not given), and every room part dropped, so they are built again from what the frame lists now.
  It never pauses depth (v124's rule). What asks:
  - the session visible again after hidden for at least 10 s (its own `visibilitychange` listener, added with
    `HOST.quiet` as the session begins and removed as it ends; a short hide, the system menu, changes nothing): at once
    on the next frame, and the watchdog's tries start afresh;
  - the watchdog, only while the session is visible and only for what the mode uses: depth that had come, wanted, the
    views there, but none for 1.5 s; `getDepthInformation` throwing on 30 frames in a row (from the start too); room
    parts there, none of them posed for 2 s (the room only); its first try at least 10 s after the last ask (at once when there
    was none), each next one twice as long after (20, 40, 80 ... s), at most 6 after the session's start, a sleep or the last time it was back
    steadily for 10 s with no gap of a second (`steady`: so a long session's few hiccups, each brought back, never use up
    the cap; the gap since the last ask stays; the depth and the room each their own), and frames that stopped coming for over 5 s (the next story building) counting afresh. Past the sixth
    the Debug tab's *Real world* line says *depth stopped N s ago: leave AR and enter again* (or that the room scan
    stopped), and one notice a session (*People no longer hide things*, *The room no longer hides things*, through
    `HOST.collab.notice`; none for depth that never came). Depth that comes back by itself is drawn again and the line
    plain again;
  - the depth's shape changing (its `textureType`, the session's `depthDataFormat`, whether it gives its own range, its
    `rawValueToMeters`) from what the kind was decided on: decided afresh at once (`redecide`: the stand-ins of the old
    kind forgotten, the reading and the probe again), no new binding.
  Logged through `HOST.collab.log` (so a headset's log in a room carries them to the relay): `occlusion renew` (`why`:
  `wake`, `depth lost`, `depth throws`, `room` or `shape`; `depthActive`, frames asked and with depth, errors and the
  last one, ms since the last depth, how long it was hidden, the tries so far, the room's parts and those posed),
  `occlusion back` (the depth or the room back after it, and how long that took), `occlusion room` (the parts posed going
  to or from none), `occlusion steady` (back steadily, its tries started afresh: how many there were), `occlusion gave up`, and the shell's `webgl context lost` and `webgl context restored`. Every
  alignment sample (`sample()` in `shared.js`, every 5 s in a room) carries `occl`: `{ m, u, f, k, r, a, n, v, ago, e,
  pl, me, po, rn, rr }` (the mode, the depth's usage, format, kind and reading, `depthActive`, frames asked and with
  depth, ms since the last depth (-1 none yet), errors, planes, meshes, parts posed, renews of the depth and of the
  room). A lost WebGL context (`webglcontextlost` and `webglcontextrestored` on the renderer's canvas, listeners added in
  `makeRenderer` with `HOST.quiet`): nothing drawn while lost; restored, occlusion forgets its own GL objects (the probe's
  programs, its quad and framebuffer, the zero textures) and ends its part of the session, so the next frame begins anew
  (three.js makes its own again). The headset's layer itself would need the session started again: leaving AR and
  entering again (untested).
- **A little behind.** A thing must be a little further than a real surface to be hidden by it (`BIAS`: 4 cm for the
  depth, which is noisier, 2 cm for the room, each along the view), so a robot's trail on the floor, a line along a
  wall's foot, a studio model standing on the floor or a button under a fingertip is not hidden by what it stands on.
- **What it hides.** Everything depth-tested drawn after it: the scenes, cards in 3D (the story panels, station cards,
  name tags), the circles' rings and icons. Never: what is drawn over everything (`depthTest` false: the menu, the
  notices, the subtitles, the frame-rate read-out, labels and cards set on top, the loading card, the calibration
  crosses).
- For tests and the Debug tab: `HOST.occlusion.state()` (the mode, the session's depth: usage, format, kind, shape,
  reading, eyes, the probe; the room's parts; since v131 `lastDepthAt`, `hiddenAt`, `hidLast`, `renews`, `roomRenews`,
  `redecides`, `resumes`, `bindings`, `posed`, `depthActive`, `tries`, `gaveUp`, `told`, `lost`, `restored` and `gl`, our
  own GL objects; v124's `paused` went), `line()` (the Debug tab's *Real world* line), `sample()` (the samples' `occl`),
  `times({ wake, lost, room, every, cap, throws })` (the times above shortened for tests, as `eyeTimes` and `guideTimes`;
  `null` the defaults), `lost()` and `restored()` (the shell's), `parts()`, `sig()`.
- **Untested on a headset**: all of it on a real Quest in the app (the room test page proved the depth pass and the
  room there, not this code in the stories), how the 4 cm and 2 cm read (people's edges, hands near panels, things on
  the floor), the cost with a big room scan and depth together in a heavy story, depth sensing left running while the setting is *nothing*,
  CPU depth on a phone (Android's Chrome), a browser that refuses depth sensing (the ladder), the studio's override.
  After a sleep (v131), only a Quest 3 or 3S can show: whether `resumeDepthSensing` or a new binding brings the depth
  back after a real long sleep (or neither: leaving AR and entering again stays the proven remedy), whether the room's
  planes come back with poses or as a new set, whether a Quest says `depthActive` false then, whether its depth's shape
  changes, how often the watchdog asks on a real headset (the logs will say: `occlusion renew`, `occlusion back`, the
  samples' `occl`), and a lost WebGL context in a session.

## Spaceships (`HOST.ships`, `ships.js`)

A spaceship mini-game in headsets (v132), the shell's own, not a story: it flies over every story and every circle, alone
or in a shared room. The owner, 10 November 2026: "if we double click the right stick in ar or vr mode we get a little
spaceship that we can control with the right controllers position in space, it is automatically going forward and the
grip is brakes/reverse, trigger is shooting, each ship has a shield and health, shield fills up again, health does not,
both get lower when hit, first shield then health, a is boost but that only lasts briefly"; asked, steering "like a
joystick is better since otherwise one could not fully turn", "new ship after 5s", ships seen by "everyone", practice
targets alone "yes totally, maybe some ships that also fly around"; then: "leave the drifting targets and the drones in
when more join so players can also coop against them, also add some addons like additional boost and faster shooting for
some times and reinforced shields pickups that spawn from time to time". The game is our own (no existing game's names,
ships or look).

- **Launch and land.** The right stick clicked twice within 0.4 s (`sticks` in `shared.js`, `shipPress`; the left stick's
  double click is moving with the sticks, a single click of either and both at once the menu as before), or the menu's
  *Spaceship: launch* / *land* row (Settings, under Moving with the sticks); landed again the same way, by the menu's
  Exit and by the session's end. Only in an immersive session (VR or AR) with a tracked controller with a gamepad as the
  right input source; never in camera mode or a phone's AR (`whyNot`: a tracked hand there is told *It needs a controller
  in your right hand*, the row greyed with the reason). The notices say what happens (launch: the controls in a line).
  It acts at the ship's next frame (`toggle`, `S.want`). A story change keeps it flying: its objects hang in the story's
  scene and are taken out before a story is disposed (`HOST.teardown`, `HOST.ships.detach`), as occlusion's are. While
  a ship flies (v133) its right stick steers and is pushed hard, so a press of it counts as a click (the menu's, both at
  once, the double click that lands) only with the stick within 0.5 of its middle as it goes down (`SHIPCLK` in
  `sticks`); pushed further it is a steer that clicked and counts for nothing (log `ship stick click ignored`, at most once
  a second), leaving nothing half counted. Not flying, while it is down (`HOST.ships.down()`: destroyed, the new ship to
  come) and the left stick always, as before.
- **Each frame.** `index.html`'s moving with the sticks hooks the session's own `requestAnimationFrame`; once a frame,
  after it has dressed the frame (so the poses are three.js's), it calls `HOST.ships.frame(s, t, f)`, before any callback
  draws. The ship's clocks are that frame's time (ms) and the relay's (`now()`; for tests the frame's: `testClock`).
- **Steering: the right thumbstick** (v133; the owner, 11 November 2026: "please also add joystick controls for the ships,
  right joystick should control left right with left right and up down with up down", then "the pitch of the up down
  should be reversed like in flightsim" and "also remove the controller motion steering from the ships for now, its not
  working well anyway"; `stick(x, y)`, `axes(gp)`, its numbers `STICK` and `STEER`, to be tuned on a Quest): the right
  controller's stick (xr-standard's `axes[2]` and `axes[3]`, a pad with two axes its 0 and 1), each axis on its own: a
  dead zone of 0.15, past it the push's share to the power 1.5 (fine near the middle, full at the edge). Pushed right it
  turns right about the vertical (full: 140 degrees a second, round as often as you like), pushed forward (away from you,
  `axes[3]` -1) its nose turns down and pulled back up, as a flight simulator's stick, at a rate (full: 140 degrees a
  second, `STEER.climb`), with no limit, so held back it loops (v134; the owner, 11 November 2026: "the sticks should have
  more freedom so that one can do a looping"; v133 set a flight pitch of at most 60 degrees): at cruise a loop takes
  about 2.6 s and is about 1 m across. Upside down (past the top of a loop, `cos(pitch) < 0`) the turn about the vertical
  goes the other way, so right still turns it to its own right. Let go the right way up, its nose eases back to level
  (`STEER.level`, 0.5 s); let go upside down, it holds its attitude. The ship banks into its turns (up to 50 degrees,
  eased), which does not change its path. How the controller is held, tilted or pointed counts for nothing: v132 flew by its tilt like a
  joystick (its roll turned, its pitch from the angle held at launch climbed and dived: in the history at v132), taken out
  in v133 with the Steering setting its first build had (`xrShipSteer`, removed from `localStorage` as `ships.js` loads).
  The launch notice and the Spaceship row's note say how (`steerWords()`).
- **Speed** (`FLY`): always forward at 1.2 m/s; the right grip (`buttons[1].value`) brakes, below 0.9 to 1.2 x (1 - 0.8 g),
  from 0.9 slowly backwards (-0.5 m/s); at most 2.5 m/s2. A (`buttons[4]`, its rising edge; nothing else of the shell or
  any story reads it) boosts when its meter is full: 3.2 m/s at once for 0.8 s, then it recharges for 4 s; braking ends
  a boost.
- **The arena** (`ARENA`): round where the pilot stood at launch, 5 m along the floor, from 0.15 to 3 m above it (in a
  room the room's floor, room coordinates; outside a room the session's own `local-floor`, else the head's height less
  1.6 m, taken at launch). Within 0.6 m of its edge, heading out, it is turned back gently (up to 90 degrees a second at
  the edge); at the edge it bounces (its heading reflected); at its floor and ceiling it bounces too, its pitch mirrored
  (v134, as a loop may reach them; until then held level), with a bump. In AR it bounces off the room scan's planes too (`frame.detectedPlanes` when the session has `plane-detection`:
  the ship crossing a plane inside its polygon, its heading reflected about the plane), with a bump and no damage. Ships
  pass through each other and through people. A new ship stands 0.5 m ahead of the right controller along the head's
  level forward, at its height (both clamped into the arena), flying where the head faces, level.
- **Shooting** (`GUN`): the right trigger held fires bolts from the nose along its heading, at most 5 a second (exactly:
  each an interval after the last), at 8 m/s plus the ship's speed, each living 1.25 s, damage 20; small bright elongated
  bolts in the shooter's colour (drones' red), all in one instanced draw.
- **Shield and health** (`HP`): every ship 100 of each. Damage takes the shield first, what is left the health. The shield
  refills from 2 s after the last hit at 25 a second; health never does. At 0 health it explodes (a burst for about 0.8 s
  and a boom); its pilot sees *Destroyed by <name>* (or *by a drone*) and a countdown on its strip; 5 s later a new ship
  at the controller, full. A hit flashes a ring round it (the shield) or sparks (the hull) and
  buzzes the right controller (0.4, 60 ms).
- **Targets, drones and pickups: one shared set, fought together.** 3 targets (slowly drifting glowing crystals, health 40,
  no shield) and drones (another, darker, angular design with red edges and eye; shield 30, health 60): 2 while one pilot
  flies, one more for each further pilot, at most 5. Drones wander at 0.9 m/s, now and then turn towards the nearest
  pilot's ship, and fire a bolt (6 m/s, damage 10) every 1.5 s while a ship is within 4 m and within 20 degrees ahead.
  A destroyed one comes back 8 s later at the arena's edge. They stay when more pilots join: everyone shoots the same
  ones, and a destruction is credited to the pilot whose bolt did it. They live in the set's arena (the first leader's),
  its centre carried with the set. Pickups: one every 15 to 30 s (at random) at a free spot, at most 2 at once, each there
  for 25 s and then gone (shrinking over its last 2 s); a small opaque token turning slowly, each kind its own shape and
  colour: *boost* (an amber chevron: for 15 s the boost recharges in 1 s and lasts 1.2 s), *rapid fire* (a red double
  pyramid: for 12 s 10 shots a second, the same damage), *reinforced shield* (a blue hexagon: +50 on top of the shield, up
  to 150, used first, never refilled, until used up). Taken by flying through it (within 0.25 m of the ship's middle);
  a chime as it is taken and another as it runs out; one of a kind again starts its time again, never piling up. The
  strip says what is on and its time left.
- **The leader.** One per room among the pilots flying (alone or outside a room: this headset): the one flying longest
  (its launch time, as its presence says, the relay's; ties by member id), the same on every device (`pilots`, `leadStep`).
  The leader's headset moves the targets, drones and pickups, fires the drones' bolts, decides every hit on a target or
  drone (anyone's bolts may hit them) and who takes a pickup, and sends the set in its presence. When it lands, leaves or
  is silent for 2 s, the next by the same rule takes over from what it has been drawing (`takeOver`: their places,
  headings, shield and health, the pickups and their times, absolute in the relay's time), so nothing jumps or is born
  again; with nobody flying the set goes, and starts afresh with the next launch. A pickup: the pilot's own headset sees
  its exact ship touch it and sends a claim; the leader gives it to the first claim it receives (its own included) and
  says so to everyone; it goes for everyone and the winner's headset starts it. While a claim waits it is hidden for that
  pilot alone, and shows again after 1 s if it is still there.
- **Shared, and who decides.** The owner decides: each headset its own ship, the leader the shared set.
  - Poses: the ship (and, from the leader, the set: targets, drones, pickups with their times) ride in this headset's
    presence as one field, `sh` (`out()`: `{ lt, p, q, v, s, x, h, b, dn, w }`, positions to the mm, turns to 4 decimals,
    shield, extra and health as integers, the boost meter, `dn` the relay's time it was destroyed; `w` the leader's set),
    15 a second with presence's `ts`, so no extra messages; a presence without it has landed. Every other device draws
    them by snapshot interpolation as people's heads are (`SMOOTH.DELAY`, 120 ms, behind the relay's time, between
    samples, at most 100 ms carried on past the last; gone 2 s after the last). A camera's presence carries none.
  - Bolts, hits, destructions, claims and gifts: quiet effects on one room-wide key the shell keeps for itself, `ships`
    (the relay's `KEY` rule; `shared.js`'s `onFx` hands it to `HOST.ships.fxIn` with the relay's `by`; older shells drop
    a key they do not know, and only `e.<station>` ever reaches a story's effect hook), batched at most 20 a second
    (`NET.flush`, 50 ms: with presence's 15 a member sends at most 35 a second, under the relay's 60, the leader with five
    drones and rapid fire too). A bolt's data is its start, direction, speed, the relay's time and its number (a drone's
    its id), so every device draws it along the same line. Each frame a headset sweeps every live bolt between last
    frame's and this frame's places against its own ship (exact, a sphere of 0.18 m; one heard late swept from its start
    against where the ship was meanwhile, its last 0.6 s kept); the leader also against the targets and drones. A ship's
    own bolts never hit it; drones' hit ships only. A hit goes out (what, by whom, the bolt, the new shield and health),
    and so does a destruction; every device shows the flash and the bars from it. A hit marks its bolt spent everywhere,
    but a hit on a drone or a target only from the leader (or a hit on a ship): a device that missed the leader's presence
    for 2 s (Wi-Fi, the system menu) leads its own copy for that moment and says its hits, and the leader, which never
    takes them, still sweeps that bolt itself, so it counts there (v135; before, the bolt was lost). A pickup given goes
    from whatever set a headset holds, its own copy of that moment too (v135; before, it came back there 3 s later). A
    pilot heard is stamped with the page's clock, not the frame's, so a headset whose frames paused (its system menu) does
    not take everyone for gone on its first frame back (v135).
  - Kills: each device counts, from the destructions it hears, per member the ships and the drones and targets destroyed
    since it joined.
  - Nothing stored: no room key, no `FORMAT` change. Peer to peer and a room on this device the same (the Hub passes
    presence and effects).
  - Who sees: every headset in the room every ship, drone, target and bolt, at any circle and whatever its People setting
    (ships are not people), a camera too; pages draw nothing in 3D, and the Shared dialog's people list says *flying a
    ship (shield 80, health 100)* and what each destroyed (redrawn at once when a ship goes down, at most once a second
    for its bars, which the shield's refill changes in nearly every presence). In a room everything is in room
    coordinates (the root hangs at the room's matrix); a headset elsewhere flies in the same room coordinates as its
    avatar; outside a room the renderer's space moved down to the floor. A headset in a room that is not lined up yet
    plays alone in its own frame and takes no one's ships or effects (`offRoom`: they are in room coordinates) until it
    is; a page keeps the ships for its people list (gone 2 s after their last presence, by a timer: a page has no
    frames), but no bolts, and plays none of the game's sounds.
- **The right controller while flying** belongs to the ship. `HOST.inputsGuard.claim(fn)` (`index.html`): the guard's
  listeners, the first on the session, hear its select and squeeze events as ever (so none counts as missed) and stop
  them, so they reach neither three.js (the story) nor the shell's other listeners (the menu, a station's grip); nothing
  is given again for it; but a press whose start reached three.js and the shell before the claim (the trigger or grip
  that launched the ship) gets its end through (`pass`), so the story's controller is not left pressed or holding.
  `HOST.collab.ray` answers for its ray as the shell's, at the controller with nothing to press and
  a distance of 0 (as a camera's), so the story draws no line and it is not sent to the others. The right stick's turn of
  moving with the sticks rests (`index.html`; and the studio's own right stick), and so does the stories' explore
  spin and zoom on that stick (the same line in every story's `xrPoint`, `!(HOST.ships && HOST.ships.claims(c.src))`
  beside `xrWalking()`); the left stick still moves you in VR.
  The left hand is unchanged (the menu, panels, its stick).
- **The look.** Nothing large and see-through (the owner's frame rate, v131): one lit shader in view space (opaque, the
  same in every story whatever its lights), instanced meshes a kind (ships in their pilots' colours, drones, targets, each
  pickup's kind, bolts, the bars), small additive glows (`Points`: engines, drones' eyes, crystals, pickups) and bursts, and the shield's flashing ring:
  each adds its colour and leaves the layer's alpha alone (`ADD`: `CustomBlending`, colour One and One, alpha Zero and One;
  v134, the owner: "ships and pickups have a black halo around glowing stuff in ar", since three.js's `AdditiveBlending`
  also added the glow's alpha, so its whole square, black at the corners, went opaque over the passthrough). The
  ship: a low-poly fighter built in code (a pointed hexagonal body, swept wings, two fins leaning out, a dark cockpit, an
  engine glowing at the back), about 0.2 m long, under 300 triangles, its white parts in its pilot's colour. Over every
  ship two thin bars (shield, with the extra lighter over it, and health) and its pilot's name (others'), over drones the
  same bars, over targets their health; small, opaque, turned to you. The pilot's own strip above the right controller
  (shield, hull, boost meter, kills, what is on; the countdown while down), drawn over everything, and when the ship is
  more than 34 degrees from where you look a small arrow near the edge of the view pointing to it (fixed to the head, as
  the frame-rate read-out is). The Debug tab has a *Spaceships* line.
- **Sounds** (`sfx.js`, kind `game`, at the shell's levels, from where they happen through `HOST.sfx.play`'s `at`):
  `zap`, `zapLow` (a drone's), `shieldHit`, `hullHit`, `boost`, `boom`, `bump`, `launch`, `land`, `respawn`, `pickup`,
  `pickupEnd`. No engine sound (the owner's rule: no hums unless asked).
- For tests: `HOST.ships.state()` (flying, down, the frame, the ship's pose, speed, turn, the stick (`stick`), shield, extra, health,
  boost, pickups on, the leader, the drones, targets and pickups as drawn here, live bolts, kills, others' ships, what is
  drawn, `rt` the time drawn at), `launch(on)`, `times({...})` (`null` the defaults), `testClock(on)`, `stick`, `axes`,
  `person(id)`, `line()`, and `debug` (`place`, `freeze`, `drone`, `target`, `pickup`, `next`, `clearPicks`, `hurt`,
  `bolt`, `claim`, `track`, `materials`).
- Tests: the smoke test's *spaceship* steps and `tools/collab.mjs --ships` ("Testing").
- **Untested on a headset**: how the stick feels and its numbers (its dead zone and curve, 140 degrees a second each
  way, forward to dive, loops, the levelling as it is let go, the turn upside down), the glows over a real passthrough, the speeds, the boost, the damage and the times, how the ships, bars, strip and arrow
  read, how smooth others' ships look over Wi-Fi (120 ms behind), the room scan's bounces on a Quest, the buzz, the
  frame cost with eight pilots and five drones (under 1 ms of script a frame is the aim), the sounds (unheard: rendered
  only, `node tools/sfx-render.mjs`).

## Hot reload and live updates (`HOST.live`, `HOST.swap`, `tools/release.mjs`, the relay's `--watch`)

The app follows its files while it runs (the owner said go, 29 October 2026; it is
also the ground for a story design room, where a draft story reloads in the
headset as it changes). One path in the shell, `HOST.live` in `index.html`:

- **Swapping a story in place** (`HOST.swap(key)`): the story's file fetched
  fresh (past every cache), and only when its fingerprint differs from the one
  running, `HOST.place()` taken (mode, `APP.t` and playing, the explore state by
  the story's own `collab.state()`, its `view()`, whether its headset Stories
  screen is open, the page's Stories screen, the station followed), the old
  story torn down and the new factory run as for any story change (`HOST.run`:
  listeners removed, the renderer and a headset session kept, the headset's
  placement by `xrPose()` and `xrAdopt`), and the place put back by
  `HOST.putPlace` right after the story's start gives the renderer its frame
  loop (`HOST.built`, a microtask: before any other task, such as the shared
  room's pump, sees the new story). The slideshow is the shell's and stays; a
  paused clock right at a chapter's stop waits there again. At a station in a
  shared room nothing is put back: the room's clock, state and view apply as the
  story attaches, as for any story there, and nothing is written to the room
  (the shell publishes a person's play, pause, jumps and mode changes only). A
  file that registers no story (a syntax error mid-edit) is refused and the old
  story runs on, the error in the page's bar.
- **While developing**: `node relay/server.mjs --static . --watch [--build]`
  (or with `--lan`). `/api/ping` says `watch: true`; `/api/watch` is a stream of
  Server-Sent Events (`hello` with every fingerprint, then `story`, `list`,
  `shell`, `build`; protocol in `relay/README.md`). A story file changed swaps
  in place at once on every page showing it (also mid-chapter) and is fetched
  fresh next time on the others; the list is read again (cards appear or change,
  no reload); a shell file (`index.html`, `sfx.js`, `occlusion.js`, `ships.js`, `shared.js`, `sw.js`, `three.min.js`,
  `peerjs.min.js`) reloads the page with its place kept. `--build` also runs a
  built story's `tools/<key>/build.mjs` when its sources change (the folders its
  build names, `../lbi/` and the like, and the story files it cuts from; not
  `shots/`, `gen/`, `data/`), one build at a time, a moment after the last
  change; a failed build shows in the page's bar. A page served by a watching
  relay does not ask for `version.json`.
- **On the live site** (GitHub Pages from `main`; the test place, branch `dev`, on the owner's Coolify at
  `stories.lab.lbi-netmed.com`, served by its relay): `version.json`,
  written by `node tools/release.mjs` (a release step), is asked for 3 s after
  the start, about once a minute, when the page comes back into view and when a
  new service worker takes over (always the server's: `?t=` and `no-store`, and
  the worker passes it through). It holds `version` (sw.js), `format` (shared.js),
  `shell: { n, id }` (the shell's fingerprint, and the release in which it last
  changed), `list` (the list's fingerprint, over `JSON.stringify(HOST.list)`) and
  per story `{ fp, needs }` (its file's fingerprint and the oldest shell it
  needs: its list entry's `needs`, else the shell of the release that last
  changed it). The page compares with its own stamp (`HOST.shell`, written into
  `index.html` by the same script) and the stories it loaded (`HOST.fp`). Taken
  without asking: a new story's card (`take`; on the page and, through
  `HOST.listRev`, in every story's headset Stories screen), a changed story not
  on show (fetched fresh next time it starts: `HOST.live.stale`), the story on
  show (swapped at a quiet moment: paused, explore mode, a Stories screen, or
  within a second after a chapter's end, `CH[i].b` on the recording's clock;
  never in the middle of a playing chapter). Asked first, with Reload now (the
  place kept) or Later: another shell, another `FORMAT`, a story that needs a
  newer shell (one never loaded here is not started until then; one loaded runs
  on in its old version), a station whose story this device does not know. On
  the page it is a bar (`#livebar`); in a headset a panel the shell draws in
  front of you over everything, pointed at through `HOST.collab.ray` and
  `press` (which every story calls before its own scene: the shell wraps them).
  A question waiting is taken by itself on the page's Stories screen outside a
  headset unless Later was pressed (Later holds until it is asked again) (`HOST.reloadIfUpdated`, which the service worker's takeover used to
  trigger directly), at most once in ten minutes (a host that serves an old
  page from a cache must not cause a loop). Without `version.json` a worker
  that took over still means a new shell, as before.
- **A reload keeps the place**: `HOST.place()` in `sessionStorage`
  (`livePlace`, for two minutes), put back as the boot starts its story, the
  station followed again. A headset session cannot survive a reload, so the page
  then shows one button, *Enter VR to continue* (or AR), which enters as Enter VR
  does and plays on as before.
- **In a shared room** (v136; "Updating a room" under "Shared rooms"): the bar and the headset's panel have a third
  button, *Reload every device* (Update the room's two presses: *Reload every device? Press again*), while this device is
  in a room that is not on this device alone. A new `FORMAT` asked about on a page outside a headset in a room is taken
  by itself after a 20 s countdown on the bar (*Reloading by itself in n s.*; *Not now* holds it off for 5 minutes, then
  it asks again), at most once in ten minutes (`liveReloadAt`, as `waiting()`): a page left on Later held the room on the
  old version for everyone (`cdOn`, `cdStep` in `HOST.live`; `HOST.live.times({ countdown, hold })` and `localStorage`
  `liveCountdown` = `off` for tests). A room that moved on to a newer version than this device's (`shared.js`, refused
  with 4006) asks as the question `room` (*Room XYZ has moved to a newer version of the app: reload to go back in.*, the
  highest of the kinds), or outside a headset reloads at once, at most once in ten minutes (`HOST.live.roomNewer`).
- **A shared room with an older device**: a station whose story this device's
  list does not have shows on its card and in the page's dialog as *A newer
  story*, "Update needed" (`shared.js`'s `meta` takes `HOST.unknown`), cannot be
  run here (`HOST.start` asks instead), and the question offers the update;
  Arrange all on such a device leaves that station where it is. So a new story
  no longer needs a new `FORMAT`, nor does a new page in `STORY_EXTRA` (the studio came without one). `HOST.live`
  knows a key by `HOST.meta` (`known`: a story, or a page in `STORY_EXTRA`, the design room or the studio); until v111
  it looked at the stories only, so a station of the design room asked every page and headset to update, and a page
  on its Stories screen reloaded itself.
- Untested on a headset: a swap in place in a session (the story's `xrAdopt` as
  for a story change), the question's panel and its buttons, *Enter VR to
  continue*, `EventSource` in Quest Browser.

## Shared rooms (`shared.js`, `relay/`)

Several headsets and desktop pages join a room on the relay (`#s=XYZ` in the
address while joined, the same on every headset; `&relay=wss://...` when the
relay is not the page's own origin). A room holds **stations**: `st.<id>` =
`{ story, x, z, yaw }` in room coordinates (metres, floor y = 0, yaw 0 faces -z;
the content floats 1.4 m ahead of the spot), with `st.<id>.play` (the clock:
`{ mode, t, playing, at }`, `at` in relay time), `st.<id>.x` (the story's
`collab.state()`), `st.<id>.panel` (the story panel: `{ x, y, z, yaw }` from the
spot, y over the floor) and `st.<id>.place` (the scene: `{ x, y, z }` moved from
where the story puts it, and `s` its size, a factor on the story's own; FORMAT
networks-8; both gain `q`, `[x, y, z, w]` to 4 decimals, the scene's turn and the
panel's tilt left by a free grip, absent when there is none; FORMAT networks-22),
`st.<id>.view` (the explore view there, `{ v, story }`, `v` the story's `collab.view()`; FORMAT networks-26; a write of
any of these, or of `st.<id>` itself, that carries a move by hand also has `ts`, the relay's time when it was written in
whole ms, and `h: 1` while it is still held: "Others' moves, smooth" below),
`st.<id>.ui` (the station's panels and its story's lock, `{ panels, lock, story, by, at }`: `'shown'`, `'controls'` or
`'hidden'`, and `lock` true for *Lock this story*, for every headset at that circle; set from a headset's menu there or a
page's Shared dialog, never refused by the circles lock; a write keeps the other field; absent: shown, not locked; gone
with the station's other keys when it shows another story; FORMAT networks-25), `lock` (the circles lock, `{ on, by, at }`,
below; FORMAT networks-6),
`look` (the headsets' four settings, the two sound switches and the circles walked into or asked first, `{ labels, cards, free, subs, sfx, voice, ask, vg, by, at }`: set by anyone,
from a page's Shared dialog or a headset's menu, never refused by the circles
lock; a room without it gives labels on top, cards in 3D, no subtitles and circles asked first (since v120; walked into before), and leaves a sound switch it never wrote to each device; free moving turned off takes
every `q` out of the stations' places and panels in the same write; `ask`: "Circles asked first" below, FORMAT networks-33, asked first by default since networks-35; `vg`: a number every press of Narration for everyone moves on, so each headset's own narration in the room goes, kept by every write of `look`: "The narration" under "Sound effects", FORMAT networks-36), and per area `rp.<id>` (an area's tape crosses: "Areas" below; FORMAT networks-41), and per shared space `rf.<space id>` (the room's frame in it) and
`rs.<space id>` (found split; FORMAT networks-9), `sg` (the room's shared-space
generation, `{ n, by, at }`), `near` (*Show on this network*, `{ on, by, at }`: absent or on, the room is listed under
*Rooms on this network*; set by anyone in the room, never refused by the circles lock) and `rid` (the room's own id, ten
letters written once by the page that made or holds it: a room joined again by itself can be told from another room
under the same code), `trk` (the PC's trackers in this room, `{ on, m: { a, b } | null, names, by, at }`: "Vive trackers"
below; set by anyone, never refused by either lock; FORMAT networks-38) (FORMAT networks-10; networks-11 when the eighth story came, networks-12 the ninth, networks-13 the tenth, networks-14 the eleventh, networks-15 the twelfth, networks-16 the thirteenth, networks-17 when the PET story's `state()` lost its one-scan fields, networks-18 when its liver scene came back, networks-19 when the ovary story's charts went, networks-20 when the pass story's school got a shared place at a station, networks-21 when the fourteenth story came, networks-22 when the scene's and the panel's turn joined a station's place, networks-23 when the fifteenth story came, networks-24 when subtitles joined `look`, networks-25 when `near` and `rid`
came with rooms on this network, and `st.<id>.ui` with panels per story in the same round, and its `lock` when the
layout lock became two locks after the ten-headset test, networks-26 when moves by hand gained `ts` and `h` and the
explore view became `{ v, story }`, for motion smoothing, networks-27 when the two sound switches, `sfx` and `voice`,
and the cards' setting, `cards`, joined `look` in v100, networks-28 when the shell's own two kinds of circle came in v104:
an All stories circle `st.<id>` = `{ story: 'all' | <a story's key>, kind: 'all', sync, x, z, yaw }` and a lobby circle
`{ story: 'lobby', kind: 'lobby', x, z, yaw }`, with the room's key `allp` (`{ by, at }`: the first headset's All stories
circle placed), below; networks-29 when the room's first All stories circle became the room's arc in v109: `st.all01`
gains `arc` (`true` while it is the arc, `false` once it became a circle) and `allp` may carry `pg: 1` (the arc a page
made, not yet moved by a headset), and a room now starts with the arc, below; networks-30 when a studio sound could
follow an object or a bone in v112: a sound's record in the studio's `state()` gained `on`, `bone` and `o`; networks-31
when the studio's cut-outs came in v113: its `state()` gained a field per cut-out, `x.<id>`; networks-32 when the studio's
groups and Faces came in v114: its `state()` gained a field per group, `g.<id>`, and an object's record an optional
`faces`; networks-33 when the circles asked first came in v118: `look` gained `ask`, which an older device writing `look`
would drop, and in the same round a studio circle made for a scene its record's `sc: true`; networks-34 when the studio's
shapes, empties, locks and scene settings came in v119: its `state()` gained a field per shape, `p.<id>`, and per empty,
`e.<id>`, every item's and group's record an optional `locked`, a sound's `on` an empty or a shape too, and the scene's
`settings`; networks-35 when circles became asked first by default and the studio's items gained motions, recordings and
behaviours in v120: a room that never wrote `look`'s `ask` asks first, which an older device would walk into; the studio's
`state()` gained an optional `motion` on an object's, a shape's and an empty's record and, with the recorder, an optional
recorded `path` on those and on a sound's, and in the same round an optional `behaviour` on an object's, a shape's and an
empty's; networks-36 in v124: `look` gained `vg`, the generation of the room-wide narration (*On for all* / *Off for all*),
which an older device writing `look` would drop, and the studio's `state()` gained an optional `tex` on a cube's record
(the texture changes) and an optional `cutsLocked` on an object's; networks-37 in v125: the studio's `state()` gained an
optional `tint` and `bright` on an object's record, a recorded `path` kept as a file of the scene (`src`, `len`, `n` in
place of its keys) and, on a voice recorded with a movement, a sound's `sync`, `skip` and `len`; networks-38 in v126: the
room's key `trk` (the PC's trackers: "Vive trackers" below) and, from the studio in the same release, its records' `trk`
(an item following a tracker) and `puppet` (a Mixamo character worn with trackers); networks-39 in v127: the studio's
`state()` gained an optional `side` on a `follow` behaviour (Follow behind or at a side), which an older device would
drop; networks-40 in v128: the studio's `state()` gained an optional `face` on a `follow` and an `item` behaviour (which way
it faces: *Them* or *Where they look*, *The item* or *As placed*), which an older device would drop; networks-41 in v131:
the room's areas, a key each, `rp.<id>` (more tape crosses in one room: "Areas" below; an older device would take an
area's crosses for spots A and B and write the room's floor from them, moving everyone's origin), a frame published for
a shared space whose `m` may be an area's `{ k, a, b }`, `rm` gaining `t` (when spots A and B were taped) and `trk.m`
gaining `k`, `ra` and `rb`; networks-42 in v136: the studio's `state()` gained an optional `plays` on a cube's record (what
it starts as you walk in or out: "Trigger cubes that start things" under "The studio"), which an older device would drop).
The plan is `docs/shared-space-plan.md`.

- All stories and Back to the lobby (v104; the owner, 2 November 2026: "a circle with all stories that looks exactly
  like the single player story menu and that should be the default for new shared rooms in ar and vr, placed directly
  in front of the player ... one should also be able to place it in a shared space and then decide if it is in sync with
  the stories there or if it can run its own stories"; "a 'back to the lobby' circle where the headsets go back to the
  lobby"). Two kinds of circle that are the shell's own, not stories: never in `stories/list.js`, never started
  (`HOST.start('all')` would refuse); `KINDS` in `shared.js` gives their look wherever a station's is taken (cards, rings,
  icons, the dialog and its map, the menu's lists, people and Follow lines): All stories (`'all'`, kicker *Every
  story*, a pale cyan-white `#cfeeff`, icon `all.stories`) and Back to the lobby (`'lobby'`, kicker *The lobby*, a soft
  green `#9fe5bf` (the design room has the gold), icon `all.lobby`); a key `lowpoly.js` does not have yet shows the glowing fallback. `lookKey(s)` is a
  station's kind, else its story; `runs(s)` the story it runs ('' for an All stories circle's cards and the lobby);
  `stTitle(s)` "All stories" (": <the story picked>"), "Back to the lobby" or the story's title.
  - The first headset adds one (`allFirst`, from the shell's tick): a headset in the room with the others (AR, or VR
    answered "in this room"; never one elsewhere), aligned, in its session, the circles not locked, in a room that has
    never had one put there by itself (`allp`, written in the same batch, so once per room: a removed one does not come
    back) and that has none (one added by hand on a page is enough), the conditions holding 1.5 s (a room refilled after a relay restart comes back empty first), once per page
    and room: an All stories circle 1.2 m ahead of its head along the floor (just outside the 1.1 m walk-in: one step and
    you are in it), facing away from it (its cards float ahead, as on the Stories screen), Own stories, always under one
    id (`all01`), so two headsets that place it at the same moment place one circle (the last writer's). Since v109 it is
    the room's arc (`arc: true`, below) when the room has no other circle, standing where the headset stands (not 1.2 m
    ahead: its cards then float about 1.25 m in front of it, as on the single-player Stories screen), else an ordinary
    circle 1.2 m ahead (`arc: false`); and a room a page started already has the page's arc, which the first headset
    moves to where it stands instead, as
    long as it stands where the page put it (`allp` with `pg`; `allp` is then rewritten as the headset's). Tests turn
    both off (`HOST.collab.autoAll(false)`, or `localStorage` `collabAutoAll` = `off` before the page loads: every
    device in `tools/collab.mjs` starts so, and its pretend headsets keep it off, unless the All stories round asks).
  - The room's arc (v109; the owner, 3 November 2026: "Change it so that the room behaves like a shared version of the
    single player room and the players can move the story arc around by dragging it, change it to a circle once a player
    places the first other circle or arrange all"; anyone may move it, the circles lock stops that). A room starts as a
    shared version of the single-player Stories screen: one All stories circle, `st.all01` with `arc: true` (`arcSt()`,
    `HOST.collab.arc()`), made by the first headset (`allFirst`) or by a page that starts a room or joins one with no
    stations (`pageArc`, from the pump: at the room's origin facing -z, once per page and room, after the room has been
    empty for 1.5 s, with `allp` `{ by, at, pg: 1 }` written in the same batch, so the first headset moves it in front of
    itself and a removed one does not come back).
    - Everyone is at it without walking in (`arcStep`, from the pump and every headset frame): every aligned headset in
      the room with the others (AR, or VR answered "in this room"; one elsewhere walks into it as into any circle) has it
      as its live station (`choose(id, 'arc')`: `C.live`, `C.mine`, so `cards()` is true, `away()` false and `place()`
      puts the rig at its spot: everyone sees the same arc of cards at one place in the room; presence says `st` is the
      arc), and every page follows it (`C.follow`) and shows its Stories screen (`pageCards`), no Follow needed, unless
      it left it by hand (Stop following, or a story of its own: `C.arcOff`, per room). A pick there plays for everyone
      at it (`allPickAt`, in front of the arc), and the story panel's Stories button goes back (`allBack`). `zoneStep`
      never walks into it (it is live anyway). In a headset at it nothing of it is drawn (`drawPreviews`: no ring, card or
      icon; its cards are the circle).
    - Dragging it: the grip on its cards (the story's own panels: the ray's `near` from `HOST.collab.ray`) or in an
      unseen volume round them (`arcHit`, `ARC`: 0.7 to 3.1 m from its spot along the floor, within 1.35 rad of its
      facing, 0.95 m below to 0.75 m above the eyes; generous, for one arc or two rows of cards), only while its cards
      show, carries it for everyone as a station is carried (`grabStation`, `carryStation`, `sendStation` with `ts` and
      `h`; the others' cards glide, `SHOWN`): the point held stays under the ray (`MV.off`, `offAt`), swinging round
      the hand as you point, pushed away as you raise the controller, turned as you twist. The trigger still picks
      cards (the shell claims no hover for the volume). Refused while the circles are locked (`refused`, its notice).
      Move here (the menu) and the page's room map move it too; every write of it carries `arc` (`stVal`).
    - Turning it into a circle: the first other circle placed (`add`: the page's Add, the headset's Add here, Design room
      here, the lobby, another All stories circle) or Arrange all (`arrange`) writes `st.all01` with `arc: false` in the
      same batch (`arcEnd`): an ordinary All stories circle where it stands (ring, card, icon; walk-in from then on;
      Arrange all leaves it where it is). Headsets and pages at it stay with it (a station is left only by walking into
      another one); a headset that took it as the arc (`C.arcd`, never walked into it) sees its ring, faint as your own
      station's, while it stands outside it (more than 1.1 m from its spot), so it knows where the circle is. Removing
      every other circle leaves it a circle. An arc beside another circle (two writes crossing) is turned into a circle
      by whoever sees it.
    - Rooms from before v109: a room kept on a device or a relay (revived from a copy) whose only station is `all01`
      (kind all) without `arc` becomes the arc as it is joined (`arcStep` writes `arc: true`); one with other circles keeps
      it a circle. A room of another `FORMAT` is refused as ever (devices update).
  - Walked into (as any circle), it is the headset's live station. Showing its cards (`HOST.room.cards()`), the story
    loaded hosts the single-player Stories screen there (the stories open it while `cards()` is true, below; the
    shell's `place()` puts their rig at the circle's spot, so the cards float ahead of it), the scene hidden, the story
    paused, nothing synced (no story there: `synced` is false, nothing goes out), not away (`away()` is false, so the
    cards are pointable). `HOST.room.allHere()` is true while the live station is an All stories circle, cards or a story;
    `HOST.room.allBack()` sends it back to its cards, for everyone there.
  - Picking (`allPick`, which `HOST.start` and the page's Stories screen ask first; `allPickAt(id, key)`): at an All
    stories circle a person's story (a card on the headset, the page's Stories screen while following it, the dialog's
    picker) never leaves the station: it is the circle's pick, written for everyone there, `st.<id>` with that story
    and, on its own keys, `st.<id>.play` `{ mode: 'story', t: 0, playing: true, at }` in the same batch (the relay drops
    the circle's other keys first: the epoch rule), so every headset and page at the circle switches to it from its
    start, playing, as a station given another story does. The story panel's Stories button there (and *Back to all
    stories* in the menu's Circles tab, and *Choosing a story* in the dialog's picker) writes `story: 'all'` again: its
    keys go. Repeat does not run at a station (a story's end opens explore mode there, as at any circle).
  - The switch (`sync`; *Own stories*, the default, or *With the room's circles*; `setAllSync`): the menu's Circles tab at
    that circle (a row under the two locks, beside *Back to all stories*) and the circle's row in the page's dialog;
    never refused by either lock. With it on and a circle of the picked story in the room (not an All stories one; the
    first by id), the All stories circle joins that circle's session (`sessOf(s)`, `sesSt()`: the station whose keys hold
    the clock, explore state, view, scene place, panel, panels and lock (`st.<other>.*`) and its effects (`e.<other>`);
    `liveSt()` stays the circle you stand in, for the rig, the sound zone, the cards, the people drawn and your
    presence's `st`), so people at both circles see the same moment and what one changes the other sees; the panel and
    scene are placed relative to each circle's own spot. A pick in sync mode writes only the circle's story (never the
    other circle's clock); with no such circle it runs on its own keys. Turned off with a story running in a linked
    session, its own keys are seeded from where that session is (its clock, explore state, scene place, panel, view,
    panels and lock; own ones that session does not have go), so the story goes on and nothing jumps. A linked circle
    that goes (removed, or given another story) leaves the circle on its own keys: the people at it write its clock and
    explore state from where the story is with them, so they stay together. Moving an All stories circle (the grip, the
    map) writes its story and switch as the room has them at that moment (`stVal`), never an older pick back. When the live
    station's story or session changes with the story already loaded, the room's clock and state apply at once
    (`C.liveSig`).
  - Back to the lobby: walking into it ends the headset's live station (no story: away, the story hidden, paused and
    silent, nothing of it goes out), and the room shows as before any circle (every ring, card and icon, everyone
    drawn); it is never a live station itself, its own ring, card and icon stay, and walking into a story circle after
    enters it as usual. No automatic lobby circle (the owner: "no automatic placement for now"). It is walked into with
    the circles asked first too, its ring hidden then (v119; the owner, 6 November 2026: "the lobby ring can go away too
    for now but in that one the headsets shall go to the lobby automatically": "Circles asked first" below). Going to it,
    by walking in or *Go in*, in either mode, calls the story loaded's optional `lobby` hook (`HOST.cur.lobby()`, in its
    returned object; the studio's forgets what this headset has seen there, its cubes starting afresh).
  - Pages: a page following an All stories circle shows its Stories screen while the cards show (`pageCards`; a pick
    there is the circle's) and follows the story picked as any station (in sync mode, the linked session); the room's
    arc is followed without Follow (above). The dialog's row of an All stories circle has a picker (*Choosing a story* or
    a story) and its switch (the arc's says it is for everyone in the room until another circle is added); the lobby's row has no
    Follow, Panels or Lock (only Remove), and a click on its dot follows nothing.
  - Add (the dialog's picker and the headset's *Add here* page) offers *All stories* and *Back to the lobby* after the
    design room; moving, turning, removing, the circles lock and the map work on them as on any circle (a move keeps
    `kind`, `sync` and `arc`: `stVal`). Arrange all leaves both where they are (and turns the room's arc into a circle).

- `HOST.collab` keeps the room's keys (echo suppression by value, optimistic
  writes acknowledged by the relay, apply order stations > clock > state >
  panel; a moving thing's value compared without its `ts` and `h`), members, the relay's clock (ping/pong), presence
  (`p.<member>` at 15 Hz, with `ts`) and effects (`e.<station>`); it reconnects with backoff and brings the
  room back after a relay restart; its pump runs from a timer and from
  animation frames (long frames starve timers). Log: `window.__collabLog` (and
  `#debug`).
- Peer to peer (no relay; owner, 28 October 2026: so the copy on GitHub Pages has
  rooms too). A room runs on the relay when the page knows one (or is served by
  one); when no relay is known, or the relay cannot be reached as the room is
  joined (no answer within 6 s), it runs peer to peer (`C.via`: `'relay'`,
  `'peer'` or `'local'`; `C.local` still means this device only). PeerJS
  (`peerjs.min.js`, loaded on demand from `appRoot()`) and its introduction
  server (PeerJS's public one, `0.peerjs.com`, by default; `&peer=host[:port][/path]`
  in a link, or `peer:host...` typed in the Shared dialog's relay field, picks
  another, such as the relay's `/peerjs`; `&peer=off` turns peer to peer off;
  kept as `collabPeer` in `localStorage`, and a room's link carries it)
  introduce the devices, which then talk directly over WebRTC data channels
  (Cloudflare's STUN server, `stun:stun.cloudflare.com:3478`, is the only ICE
  server; no TURN, so the devices need a network that allows direct links). The
  room's id there is `lbinet-<FORMAT>-<code>` (devices of another version never
  meet). Whoever holds the id hosts: a new room takes a free code whose id is
  free; a link or a kept room takes the id when nobody holds it (hosting this
  device's kept copy) or links to its holder. The host runs a `Hub` (the relay's
  rules, as for a room on this device: the welcome, a batch as one seq, the epoch
  and stale rules, refusals, members on hello and leave, `fx` passed on with
  `by`, pong with the room's time, the relay's limits on sizes and rates; keys
  kept in `localStorage` as a room on this device) with its own page through an
  in-page socket (`LocalSocket`) and each guest through its link; a guest's
  `PeerSocket` has the WebSocket face the shell uses and carries the relay's
  JSON (long texts in pieces), so join, connect and recv barely changed. Guests
  ping every 2 s. The host goes (Leave, `pagehide`): it destroys its PeerJS peer,
  freeing the id at once; the guests' links close and the one longest in the
  room (members' `since`; the others 1.5 s later each) takes the id over with
  its own copy (`C.keys`, seq from the highest seen) and its measure of the old
  host's clock as the hub's (`Hub.off`), so stations play on without a jump; the
  others find the id taken and link to it. A host not heard from for 6 s (a
  headset taken off): each guest keeps its link and tries now and then (in that
  order, then backing off) to take the id or link to whoever holds it, and a new
  link that opens replaces the old one. Known limit: a host that vanishes without
  letting go (asleep, out of Wi-Fi) holds the id until the introduction server
  times it out (PeerJS's public server: up to about a minute; the relay's:
  `--timeout`, 40 s), so the room waits that long. Meanwhile the room stays as
  it is on every page and the menu and dialog say "The host has gone: taking
  over"; writes made meanwhile give way to the room's when it is back, as with
  a relay that was away. A headset that hosts hands the room to the first screen
  (a laptop or desktop page, `dev` in its hello) that joins: it tells everyone
  who is next (`host`), lets go of the id, that screen takes it at once and the
  headset links back as a guest. A host whose id lapsed while its server link was
  away and was taken by someone else steps down (its guests link to the new
  one; writes made on the old host meanwhile are lost). Off peer to peer: Fresh
  shared space (`canFresh`) and the headsets' logs (`POST /api/log`). A room
  that runs peer to peer stays so until everyone has left (no move to a relay
  found later: every member would have to move at once); a room on this device
  that fell back because peer to peer failed asks again (probe, with the
  relay). When PeerJS cannot be loaded or its introduction server does not
  answer within 8 s (counting only time the page was awake), the room is on this
  device only, as below; when the server answered but no link to the host opens
  (15 s), it keeps trying. Recommended (and said in the dialog): start a
  peer-to-peer room on a laptop or desktop page that stays awake. The shell's
  listener bookkeeping must not take PeerJS's: `shared.js` makes
  `RTCPeerConnection` and `RTCDataChannel` add their listeners with `HOST.quiet`
  set. Test page for a network: `p2p/`.
- A room on this device: when no relay is known and peer to peer cannot be had
  (no introduction server, or `&peer=off`), or the relay cannot be
  reached as a room is joined and peer to peer cannot be had, the room works on the
  device alone (starting a room first asks whether the page's own server is a
  relay, 5 s at most: a room started before that was known stayed on the
  device until the next probe, and links to it were refused). A `Hub` with an in-page `LocalSocket` in `shared.js` plays the relay's part in the page
  (the same messages and the same rules for keys, a station's epoch and stale
  writes; presence and effects go nowhere, no log is sent). Its keys are kept
  in `localStorage` (`collabRoom.<code>`, the last 8 rooms), and a room joined
  through a relay is kept there too as last seen, so its layout is still there
  on a day the relay is not; a relay that forgot a room (expired overnight, or
  restarted) gets it back from any page that keeps a copy. The headset's menu
  has its shared room section without a relay too (*Start a room here*, the rooms kept on the
  headset). A headset alone is never asked about the others, and without marks
  or a shared space its stations stand on its floor where the session began
  (`'floor'`, for the session; calibrating keeps them in place). The room goes
  to a relay once one answers (asked every 15 s, and at once when an address
  is entered): made there from the device's copy when the relay has no such
  room or one with no stations, else joined as the relay has it (changes made
  meanwhile give way; a room there of another version is left alone, and the
  panel says so). The placement stays as it moves; a `'floor'` frame then gives
  way once the shared space gives a frame. Another tab's writes to a room on
  this device are taken (the `storage` event).
- Rooms on this network (the owner, 29 October 2026; "Rejoin by itself, never join something new by itself"). Browsers
  cannot search the local network, so devices meet through the address they share on the internet.
  - The network's id (`C.net`): a short hash, never the address itself (kept only on the device, with its rooms, and
    never logged by the page or the relay): the first 24 bits of SHA-256 of a fixed salt (`networks-near-1`) and the
    network's name (one id stands for about 256 public addresses). With a relay, the relay's (`/api/ping` and
    `/api/near` say it): it hashes the address it sees, a private one by its /24 (a relay on the LAN sees the headsets'
    own addresses), IPv6 by its /64; behind a reverse proxy such as Coolify's it takes the last address in
    `X-Forwarded-For`, only when started with `--proxy` (behind `n` proxies, `--proxy n`, the `n`-th from the right:
    `--proxy 2` with a CDN such as Cloudflare in front; the Dockerfile leaves it off, Coolify's start command sets it,
    see `relay/README.md`). Without a relay (or one that does not answer), the public
    IPv4 address Cloudflare's STUN server reports (the srflx candidate of a throwaway `RTCPeerConnection`, its listener
    added with `HOST.quiet`), hashed in the page (`netName`, `netHash`: the relay's rules and salt, so both agree). For
    tests `#net=<word>` pretends one (no relay; kept for the tab in `sessionStorage`, `collabNet`; `off` drops it). None
    found: nothing listed and nothing joined by itself, and the dialog says so. It is asked only when the dialog or the
    menu lists rooms, when a room is joined (kept with it), or at load when a room was used in the last week.
  - *Rooms on this network* (the Shared dialog above *Open rooms*, the headset's menu as *On this network*; one press
    joins; looked for again every 15 s while either is open): the relay lists the rooms with someone on the asker's
    network (an empty room: on its last members' networks) unless their `near` is off (`GET /api/near`: code, the first
    member's name, people, stations; never an address). Peer to peer, a room's host holds the first free of eight slots
    named after the network on the introduction server (`lbinet-near-<FORMAT>-<net>-<0..7>`, `slotStep`, in the pump;
    let go when it no longer hosts, the room is hidden or left, or the page goes) and answers whoever links to it there
    with its code, its name, people and stations; a seeker (`seek`) links to all eight at once through a throwaway
    peer (a free slot answers after the introduction server's 5 s).
  - Rejoin (`rejoin`, `netAgain`): each room kept on the device (`collabRoom.<code>`, the last 8, as before) also keeps
    when it was last used (`at`), the network (`net`) and relay (`relay`, '' none) it was used through, and `left`
    (left on purpose) or `gone` (its code is another room's now). A device in no room joins again by itself the room
    it used last on the current network through the same relay (or none), within a week of its last use, when its copy
    holds the room's own id (`rid`; a copy without one, as when the page went before the id came back, is only offered,
    since another room under the code could not be told from it), at page load
    (no `#s=` in the link) and when the network or the relay becomes known (also on `online`, and when the page shows
    again a minute after the network was last found), with a notice (`#shToast` on a page, with *Shared*, *Leave* and a
    close button, gone by itself after 20 s: shown and hidden by its `display`, which outranks the `hidden` attribute;
    the shell's notice in a headset session) and *joined again by itself* in the dialog's status. With a relay: the
    room there is looked at first (`GET /api/rooms/<code>`): another room under the code (its `rid` differs: the relay
    forgot ours and gave the code again) is never joined (`notMine`: marked `gone`, a note says so); none there: joined
    by its code, and the relay gets it back from this device's copy (`revive`). Peer to peer: joined by its id, which is
    unique, so linked to whoever holds it, else hosted here from this device's copy (the existing rule for a kept room),
    so the others find it; two at once never split it (the second links to the first); a headset that ends up hosting
    hands the room to the first laptop page as before. A welcome from another room under the code (its `rid`) is left
    at once, and nothing of it is kept. Never: a room left on purpose (*Leave* in the dialog, the menu or the notice,
    and `HOST.collab.leave()`), until it is joined again by hand; a room the device was never in; one last used more
    than a week ago. Used last on another network, through another relay, or with no network found: nothing by itself,
    but one button, *Start room XYZ again* (*Join room XYZ again* with a relay; `offer`), in the dialog and the menu.
    In a headset the join is any join: the room's frame comes back as on any join, a calibration from last time is
    found by its anchors.
- A fresh shared space (*Fresh shared space* in the headset's menu and in
  the page's Shared dialog, two presses, only where the relay serves the page):
  Quest Browser keeps one shared space per page address, and two Quest 3s each
  kept their own copy of one, session after session (2.6 to 3.4 m apart by the
  tape). The relay also serves the app under `s/<n>/` (`serve`; `/s/<n>`
  without the slash is moved there), so the room's generation goes up by one
  (key `sg`) and every page in it moves to `s/<n>/` (`spaceMove`: only when that
  address answers, keeping the query and the room in the hash; a page opened at
  an older address later moves too; a room with no `sg`, as after a relay
  restart, moves nobody, and a page at `s/<n>/` gives it its generation). `SG` is the page's own generation and
  `appRoot()` the app's address, where the relay is (`detect`). The headsets
  leave AR as their pages move; the page and then the headset say to start AR on
  one headset first and the others after "Room ready". Every headset's
  log says its whole address (`search`, `sg` in `session`).
- Re-align (a button in the headset's menu, `HOST.room.realignNow()`):
  this headset lines up again from the start without leaving the session or
  forgetting its marks. The shared space is asked for again, what was held
  since waking is dropped, its own marks are looked for again by their anchors,
  and otherwise it asks whoever wrote the room's frame to write it into the
  space again (`q.frame`, passed on like presence) and takes it (waiting up to
  3 s). The frame held so far stays until another is found ("Re-aligned", or
  "Nothing to re-align to"). Once re-aligned, in AR in a room with spots, the check by eye asks (below).
- The room setup guide, its startup flow and Touch the spot (v107; the owner, 2 November 2026: "a guided room setup and
  an alignment check, so a group can start a shared room from zero and know whether the headsets line up"; "make it so
  that we can run the touch the spot"; v109, 3 November: "just do the calibrated marks but make it part of the startup
  flow to check and make people check and calibrate if needed": two fixed spots are more accurate than two people
  touching controllers; v122, 7 November, floor spots: the two spots are tape crosses on the floor, which set the room's
  floor too, "The room's floor is under the marks" below). Nothing in how alignment works changed: `lineUp()`
  (in `shared.js`, after `status()`) only says in plain words what the frame rests on: *Room ready* (this headset's
  shared space's origin is the room's, `R.src` `'shared'`; the notice of that name), *Lined up through the shared space*
  (`'adopted'`; *Lined up from the room's spots (shared space)* when that frame was made from spots,
  `R.mk`), *Lined up from the two spots you touched* (`'marks'`) or *from the room's spots, found again* (`'anchor'`),
  *Lining up with the room...*, or *Not lined up yet* with why (`LU_WHY`: no shared space, not in the others' shared
  space (`R.notJoined`), the space split (`splitHere`), no room scan (`R.noScan`, for a frame taken through the space),
  another Quest Browser version (the frame's writer's, `otherVersion`; `versionNote` before it lines up), the shared
  space switched off, or nothing after 20 s; since v124 its own spots' anchors not found again after waking, `R.reenter`,
  no longer count: the check by eye asks instead). The user-facing words say *spot A* and
  *spot B* (the code still says marks: `mark()`, `R.saved`, `R.mk`, key `rm`).
  - The room's spots (`roomMk()`): `[height of A, A to B, height of B]` in room coordinates, as this headset puts them: a
    frame from spots has its origin at spot A and its x axis towards B, so A is at `(0, hA, 0)` and B at `(d, hB, 0)`.
    This headset's own (`R.mk`, `own()`), or those of the frame it took through the shared space (`R.mk` from its `m`),
    else the room's key `rm` (A's height over the room's floor, `FLOOR_TIP` for floor spots, and the distance; B as high
    as A); null while the room has none. `byMarks()`: this headset's frame rests on them; `roomSpots()`: the room has them (`rm`) or `byMarks()`.
  - The guide (`guidePage`, `PNL.page` `'guide'`, `PNL.gs` its page, in place of the rest of the Circles tab as the
    code page is): five pages since v131 (four before), *Before you start* (the room scan, the same browser version, address and Wi-Fi, two tape
    crosses on the floor, A and B, about 2 m apart and 1 m at least, touched with the controller's tip on the floor, which
    set the room and its floor, drawn: `drawTape`), *Line up*, *Check that you line up*
    *Not lined up?* (Re-align and Check again, Calibrate, Fresh shared space where the relay serves the page) and *Areas*
    (v131: *Add spots for another area*, then each area's letters and name with *Check at C*, *Check at D* and *Calibrate
    here*: "Areas" under "Shared rooms"; Line up has *Calibrate on: <area>* while the room has areas), with
    Back, Next (Done on the last) and Close (*Skip for now* while the flow shows it), and over them a live status
    (`guideStatus`: the room, `lineUp()` in its colour, *Headsets lined up: n of m, k checked*, an amber note for another
    version or no room scan). *Line up* says what to do now (`lineCase()`): `'calib'` (calibrating: touch spot A, then
    B; Stop calibrating), `'check'` (lined up by the room's spots: Check, or Calibrate again), `'room'` (the room has
    its spots and this headset is not lined up by them, or its last check was out: *Calibrate on them*, the reason in red
    above; spots gone, new ones become the room's), `'first'` (no spots yet and this headset is the room's first,
    nobody else here or its origin: *Put two tape crosses on the floor, at least 1 m apart ... its tip on spot A, ...
    then spot B*, which sets the room and its floor for everyone: `claimFloor` and `publishOwn` as ever) or `'none'` (no
    spots yet, another headset is first:
    *Check with someone*, or Calibrate). *Check* has, once the room has its spots (`roomMk()`), *Check at A* and *Check
    at B* (a check on its own, `selfCheck`) and below them *Check here* with someone; without spots only Touch the spot.
    *Room setup* on the Circles tab (with `lineUp()`'s words beside it) opens it at the page last shown; only a headset
    in a room with the others or as its first (not one elsewhere, not a room on this device: `guideOn`).
  - The startup flow (`GD`, `guideStep` from the shell's tick, `guideOpen`, `guideClose`, `guideCal`, `guideGo`): every
    time a headset enters AR (or VR answered *In this room*) in a shared room, the guide opens by itself 1.5 s in
    (`FLOW.wait`), at *Check* when it is lined up by the room's spots already (in AR, since v119, the check by eye's
    question instead: `eyeInstead`, below), else at *Line up* (`GD.fl`: 0 not yet, 1 on show, 2 done, 3 skipped, 4 asked
    by eye). On *Line up*, before any press there (`GD.touched`), it turns to *Check* by itself (in AR: closes, and the
    check by eye asks) once this headset is lined up by the spots (its own found again, or through the shared space from
    them); a
    calibration started from the guide or the Debug tab (`guideCal`, `GD.cal` the marks' generation then) goes on to
    *Check* once it is made (opening the guide again there if the menu was closed meanwhile, not after Skip for now; the
    menu's own opening by itself, `autoGuide`, allowing). A check that stands
    (green or amber, on its own or with someone, or Yes by eye: `checkDone`) ends the flow for the session (`GD.ok`,
    `{ how: 'a' | 'b' | 'p' | 'e', d, at }`, until the frame it was made in changes: `setFrame`, a calibration, Re-align, Forget) and closes the
    guide, and the menu with it when the flow opened it (`GD.menu`). A red one (`checkRed`, `GD.red`) opens it again:
    at *Line up* once the room has its spots (calibrate on them), else at *Not lined up?*. *Skip for now* (or closing it
    any way: the menu closed, another tab) leaves it for the session, until a red check, being late (not lined up 20 s
    after entering with another headset there and the flow not on show: *Not lined up?*, `CK.late`) or the room getting
    its spots later with no check of this headset's standing (`GD.spots`: once, at *Check* (by eye in AR) or *Line up*). Never for a
    headset elsewhere or in a room on this device, never while calibrating or checking, never over the once-per-room
    question (it waits for the answer), and not while the menu is in use for something else (it waits). Opened by itself
    it stays open until used (`PNL.self`). Tests that do not look at it turn its opening by itself off
    (`HOST.collab.autoGuide(false)`). `roomGuide` in `localStorage` (v107's once per device) is removed.
  - The check by eye (v119; the owner, 6 November 2026: "At the beginning of every session and on wakeup etc we need an
    alignment flow where it shows the two marks and where it thinks they are in the room and ask the user to align again
    when they are not there"; "it should run anytime there could be misalignment"; `EYEQ`, `eyeWant`, `eyeStep`,
    `drawEye`, `OV.eye`). In AR, in a room whose two spots are known (`roomMk()`), lined up, whenever the alignment may
    have slipped (`eyeWant(why)`: the session's start once lined up by the spots, in place of the flow's opening at
    *Check*; waking, the session visible again after hidden; a reset of `local-floor`, with or without a transform;
    Re-align; the spots' anchors lost (`lostMarks`) or found again (`restore`); the room's frame jumping by more than 5
    cm or 2 degrees, or taken from another source, in `setFrame`, but not the session's first frame nor spots just touched
    by hand, `'marks'`; the room getting its spots, `GD.spots`), the orange crosses show where this headset puts spot A
    and spot B (`drawMarks` from `roomMk()`; since v119 the crosses are drawn over everything, `depthTest` off,
    `renderOrder` 53, so neither the scene nor the room's own depth hides one a little under a table's surface) and a
    small panel in front of you (720 x 290 px, 0.42 m wide, 0.85 m ahead along the floor and 2 cm above the eyes, turned
    to you, `renderOrder` 55, the ray's first target, put in front again once the head turns more than 0.9 rad from it or
    walks 1.6 m off; amber, *CHECK BY EYE*) asks *Are both crosses on your spots?*, with why (*A new session.*, *The
    headset was off or asleep.*, *The headset moved its floor.*, *Re-aligned.*, the anchors lost or found again, *The
    room moved in this headset.*, *The room has its spots now.*), *Yes* and *No, calibrate again* (the ray or the right
    index fingertip, as the circles' question: `pokeSheet`). Yes stands as a check (`checkDone('e')`, `GD.ok.how` `'e'`:
    the flow done; presence's `lu.ck` `'e'`, the pages' list *checked by eye*; an older distance, `CK.res`, cleared). No
    (`GD.red` `{ spot: 'e' }`) opens the guide at *Line up*, case `'room'`, with *You said the orange crosses are not on
    your spots.* in red; `lineUp()` says not lined up meanwhile (`w` `'eye'`: *its crosses off the spots, by eye* in
    the pages' list). A burst of reasons asks once, 3 s after the last (`EYEQ.quiet`) and at most 10 s after the first
    (`EYEQ.most`); the first reason says why, a new session's over any other. It waits, and comes back, while
    calibrating or checking (`tipMode()`), re-aligning (`R.again`), the menu is open or the circles' question shows; a
    check that stands made since answers it; a room without spots drops it. Its opening by itself follows the guide's
    (`GD.auto`, `HOST.collab.autoGuide`). A headset elsewhere, in VR, in a room on this device or one without spots:
    nothing. After waking, with it on its way, the old *Check the spots* notice is not shown. Where the crosses are
    (v130; the owner, 10 November 2026: "When asking people if they are aligned with the crosses, highlight the crosses
    and add some arrow or something that points towards where it believes they are so that they see better where they
    should be"; `EH`, `eyeHintBuild`, `eyeSpots` from `drawMarks`, `eyeArrows` from `drawEye`): only while the question
    shows, each cross is lit (1.6 to 1.95 times its size and brighter, a slow pulse of 1.6 s), a thin beam of light 1.2 m
    straight up from it (fading upwards) and its letter, *A* or *B* on an amber disc, over the beam, all in the room and
    over everything as the crosses are (`renderOrder` 53); under the question an arrow per spot (the one further to your
    left on the left), pointing at its cross from where the arrow floats, with its letter and its distance along the floor
    from your head under it (*A 2.3 m*; *A here* within 0.3 m); a cross behind you (more than 110 degrees from where you
    face, in front again within 95) gets a U-turn arrow to the side to turn to and *, behind you* in its words. The panel
    says *Follow the arrows to the two orange crosses* (its words in three lines of 20 px, the buttons a little lower).
    Built once, the first time the question shows; each frame only places them (a label is drawn again when its words
    change); gone with the question, the crosses as they were. For tests: `HOST.collab.eye()` (`{ ask, shown, why, due,
    can }`), `eyeTimes({ quiet, most })` and `eyeHint()` (the crosses, beams, letters and arrows in the story's scene).
    How the crosses and the panel read on a real Quest, how the lit crosses, beams, letters and arrows read there (over a
    real room, from across it), whether the reasons come at the right moments there (a real wake's resets) and how often
    it asks are untested.
  - A check on its own (`selfCheck`, `CK.self` `'a'` or `'b'` while armed): *Check at A* arms it; the next trigger off
    the menu takes the controller's tip where it was held still (`steady`) in room coordinates and measures it against
    where this headset puts that spot (`roomMk()`); nothing is sent. The orange crosses hide while any check or a
    calibration is armed (`drawMarks`, `tipMode()`), so the tip goes to the spot itself. The same limits and words as
    Touch the spot, with the spot: *Lined up: 3 cm at spot A*, *14 cm out at spot A: fine for walking about; calibrate
    on the spots for close work*, *40 cm out at spot A: not lined up*. Since v122 (floor spots) both kinds of check say
    the height part when it is 2 cm or more (`hPart`, `CK.res.h`: *Lined up: 3 cm at spot A (2 cm in height)*, *14 cm out
    at spot A (12 cm in height): ...*, in the menu's line and the notice's title): the spots are on the floor, so it is
    mostly how this headset's floor differs from the room's, which tells a headset lined up through the shared space
    (that keeps its own floor) that its floor is off. It checks this headset against the spots; Touch
    the spot checks two headsets against each other (it alone catches two headsets that calibrated on the spots in
    opposite orders).
  - Touch the spot (`CK`): *Check here* (the guide's check page, and the Debug tab beside Re-align) arms it; the next
    trigger off the menu takes the controller's tip where it was held still (`steady`, the point a calibration mark
    takes; the bright rings show, as while calibrating, `tipMode()`) in room coordinates with the relay's time, and sends
    it to the room as a one-off message (`fx` `q.check`, `{ p, at, n }`, as `q.frame` is: nothing stored). Each headset
    pairs its last check with another person's within 20 s (`CK.win`; the nearest in time; each pair once, so a new check
    waits for a new partner) and shows the distance between the two points: up to 10 cm green (*Lined up: 4 cm*), 10 to 25
    cm amber (*14 cm out: fine for walking about; calibrate on the spots for close work*), over 25 cm red (*60 cm out: not
    lined up*, which opens the guide again); a notice says it too. Alone: *Waiting for someone else to press Check here
    (20 s)*, then *Nobody else pressed Check here within 20 s*; someone else's check waiting: *Anna pressed Check here:
    touch the same spot and press it too*. The result (`CK.res`, either kind of check) stands until the next check,
    Re-align, a calibration, a frame that moves (another source, or 5 cm or 2 degrees: `setFrame`), five minutes
    (`CK.keep`) or a reason found since (the space split, another space, spots lost, another version, no scan), and
    `lineUp()` takes it as the better word (green or amber: lined up; red: not). An armed check takes the trigger
    everywhere but the menu, so it stops by itself after 30 s (`CK.armFor`), when the menu closes or once it cannot be
    made (its notice going with it). While a headset's own spots are still being found it is *Lining up* (not *no shared
    space*) until it is late.
  - Presence carries `lu` (`{ k, h, w, c, ck }`: `'ok'`, `'wait'`, `'no'`, `'away'` or `'alone'`, how, why, the check in
    cm, and this session's check that stood: `'a'` or `'b'` at that spot, `'p'` with someone, `''` none yet), and a
    headset in a room that is not lined up yet, or has lost its head pose, sends a presence without a head once a second
    (`statusOut`, with `al` as the full presence has it), so the pages hear it (older pages keep it as they keep a page's;
    nothing new is stored, no `FORMAT` change). The page's Shared dialog has *Setting up a room* under the room map (below
    it, so the map does not move as it changes): each headset in the room and how it lines up (`guideList`, `luLine`:
    *Anna: lined up (the room's spots, checked 3 cm at spot A)*, *lined up (shared space, checked 4 cm)*, *room ready
    (the room's origin, not checked yet)*, *not lined up (no room scan)*, *not lined up (checked 60 cm out at spot A)*,
    *elsewhere: nothing to line up*; an older app's headset by its `al`, and never *not checked yet* without its `ck`),
    *n of m headsets in the room lined up, k checked*, and the steps as text (a `<details>`, open, in `index.html`). For
    tests: `HOST.collab.guide()` (`{ open, step, status, check, lined: [lined up, headsets, checked], flow, case, ok, red,
    spots, menu }`), `guideOpen(k)` (by hand: the flow as it is), `checkArm(on, spot)`, `guideTimes({ win, late })` and
    `autoGuide(on)` (its opening by itself; the pretend headsets in `tools/collab.mjs` turn it off unless asked, `guide:
    true` in `installXR`, as they do `autoAll`). How it works on real Quests (how accurately a tip finds a tape cross on
    the floor, the points' accuracy, the guide's timing and whether it feels light, the notices) is untested.
  - The room's arc waits for that first calibration: the room's first headset becomes the room's origin through its
    shared space within about 8 s, and a calibration on the spots then moves the origin to spot A, so `allFirst` places
    nothing while the flow is on show asking it to calibrate (`guideShown()` with `R.calib` or `lineCase() === 'first'`);
    once calibrated, or on Skip for now, the arc stands where the headset stands.
- A headset runs live the station whose circle it walked into last (within
  1.1 m of its spot for 1 s; with the circles asked first, the default since v120, the one it last went into by *Go
  in* instead, the lobby still walked into: "Circles asked first" below): stations are walk-in only (the owner, October
  2026: "the stories can only be visited by going to their circle"), and a
  story is left only by walking into another circle (the owner, 29 October
  2026, after ten headsets: "One should only exit a story when walking into a
  new circle, otherwise stay in the story even if they move away from the
  story's circle"). Walked out of its circle, the headset keeps the station
  live (`C.mine`, `C.live`; `zoneStep`): its story shows where the station has
  it, plays on the station's clock and goes on syncing both ways (state, view,
  place, panel, the clock), and the narration fades with distance (the sound
  zone). Leaving the room, Leave, a new session (walk-in only: a session that
  starts drops a station the page followed or a session had) and a station
  removed end it; a station given another story takes the headset there. The
  trigger or a pinch on another station's card or ring runs nothing (a notice
  says to walk into its circle); the grip there still moves the station.
  `HOST.go` switches story (in a room `HOST.start` queues a request made while
  a story loads, and the pump retries a lost one). Away from every station
  (`HOST.room.away()`: a headset in a room that has walked into no circle yet
  this session, its story not yet loaded there, the room not yet aligned, or
  its station removed) no story shows: the stories hide their scene
  (`GL.world`, with the life-size holders in it), their story panels and
  labels, leave nothing of them to point at, and pause the story, silent
  (`xrAway`); only the shell's things show (the stations' rings, cards and
  icons, people, the menu, calibration marks), and nothing of a story
  goes out to the room. A desktop page follows one from the Shared dialog (a
  page cannot walk). A story the person starts themselves leaves the station
  (no longer following, not pulled back).
- Circles asked first (v118; the owner, 5 November 2026: "a switch for the circles so that they are only accessible by
  clicking a circle's card or the icon, then a dialogue asks if you want to go into that story, works better in tight
  rooms"; a room setting, walking in doing nothing, the story staying at its circle, a small panel with the story's title
  in its colour, Go in and Not now, gone after 10 s, the lobby the same). The room's (`look`'s `ask`, FORMAT networks-33:
  set by anyone, never refused by either lock; `askFirst()`, `setAsk(on)`, `HOST.collab.askFirst()` and `setAsk(on)`):
  the headset menu's Circles tab has *Circles: walk in* / *Circles: ask first* (with a note that it is for everyone here)
  and the page's Shared dialog the same button in its row of the headsets' settings (`data-sh="ask"`). **On by default
  since v120** (the owner, 6 November 2026: "Circles should be ask first by default for everyone"; FORMAT networks-35): a
  room that never wrote `ask` asks first (`LOOK0.ask`), and the switch turned to walk in writes `ask: false` for the room
  (until v120 off by default, a room that never wrote it walking in). Tests that walk into circles start as before: a
  device with `localStorage` `collabAskDefault` = `walk` before the page loads (read once, as `collabAutoAll`; every page
  `tools/collab.mjs` opens has it but the round of the circles asked first) takes a room that never wrote `ask` as walked
  into, and `HOST.collab.askDefault(on)` sets the same (without an argument it says which). With it on:
  - Walking in does nothing (`zoneStep`: no dwell, no swell; `C.zone` is kept at the live station, so walking about with
    it on enters nothing and, turned off again, walking in starts from where you are), except into Back to the lobby
    (v119; the owner, 6 November 2026: "in that one the headsets shall go to the lobby automatically"): the same dwell as
    walking in (within 1.1 m of its spot for 1 s) ends your live station there, once you have stood outside every lobby
    since *Go in* last took you somewhere (`C.lobbyArm`, so *Go in* pressed while standing in the lobby holds).
  - No ring is drawn at all (v119; the owner: "Circles should not show at all when not in all circles on mode since
    entering them is now done via selection by clicking the card and accepting"): not the lobby's, not your own, not
    within 2 m, and nothing to point at where one was (`r.noRing` keeps a fading ring out of `OV.hit`), unless *Show
    all rings* is on (then as ever). The cards and icons stay as they are: they are what you press.
  - The trigger or a pinch on another station's card, ring or icon (not your own live one, nor the room's arc, which
    everyone here is at) opens a small panel in front of you instead of the notice (`askOpen`, `ASK`, `drawAsk`;
    `OV.ask`, a sheet of 720 x 300 px, 0.42 m wide, put 0.9 m ahead along the floor and 6 cm below the eyes as it opens,
    turned to you, then fixed; `renderOrder` 55, drawn over everything, the ray's first target, `kind: 'ask'`): the
    circle's kicker in its colour, its title (`stTitle`: "Back to the lobby", "All stories", "Studio: <scene>"), a line
    (the lobby: *Leave your story and see every circle again?*), *Go in* and *Not now*, and *Closes by itself in n s*.
    Pointed at by the ray (the hover tick, a click) or pressed by the right index fingertip (`pokeAsk`, as the menu's
    `poke`; a pinch and a poke at once count once). The station asked about keeps its card shown while it asks.
  - It goes after 10 s (`ASK.ms`; `HOST.collab.askMs(ms)` for tests), on *Not now*, when the menu opens, when the circle
    goes or is your live one, when the switch goes off and when the session ends (`askClose`).
  - *Go in* does what walking in does (`askGo`: `C.zone` set, `choose(id, 'walk')`, the *enter* swell; your presence's
    `st` then says so), for a story's circle, an All stories circle (its cards) and Back to the lobby (which ends your
    live station). The story stays at its circle: the rig at its spot as ever, wherever you stand (a person who goes in
    from across the room sees it there, small, and hears it faintly until they walk over). Nothing is written to the
    room but `look` (asking, Not now and the time running out write nothing).
  - The station cards' tips say *Point here and press to go in* (the lobby: *Walk in, or press here, to leave your
    story*; All stories: *to choose a story*), the menu's Stations line *Point at a circle and press to go in* (its note:
    *press a card or icon to go in; no rings*), and the lobby's line *Walk in or press: back to every circle*. Pages are unchanged (they follow a station from the dialog). With it off, the trigger on a station
    shows the notice as before. `HOST.collab.asking()` (`{ id, left }` or null) is for tests. How the panel reads, where
    it stands and how the fingertip presses it on a real headset is untested.
- A station in a headset (`ringFor`, `cardFor`, `drawPreviews`): a ring in its story's colour (0.44 to 0.52 m across
  its middle, a triangle at the front for its facing) floating 0.5 m over the room's floor (`RING.y`; the owner, 31
  October 2026: "Circles sollten ca 50 cm in der luft sein": a headset that finds the floor a little wrong sank a ring
  on the floor into it or lifted it off it), its card standing over the ring's middle (its middle at 1.45 m, `CARD_Y`,
  its top edge at 1.6 m; the owner: "Circle card soll mittig ueber circle sein"; until v101 it stood where the content
  floats, 1.4 m ahead), turned to you and fading as your head comes within 0.8 m of the middle (gone within 0.45 m,
  `CARD_NEAR`: walking in, it would be in your face), and its icon above both (2.1 m). The card (v136, the frame rate:
  "even in the lobby with only the stations visible i could not reach 90fps") says no running clock (`stationLine(s,
  true)`: *Playing* while its story plays, *Paused at 1:03* as it stopped; the page's Shared dialog keeps the time): it
  was drawn again and sent to the GPU whole, 560 x 330 with its mipmaps, every second for every playing station, all in
  one frame. A card whose content changed (`cardSig`: its story, line, people, light, carrying, lock, sync, the circles
  asked first, its title) waits in a queue (`DIRTY`), and at most one card is drawn a frame, the one pointed at or
  carried first, then the nearest (a card never drawn yet is not shown until its turn, so nothing blank goes to the GPU;
  `o.drawn` counts its drawings, for tests); mipmaps kept. Its back face (`o.back`, for reading it from behind) shows,
  and is pointable, only while there is no head pose and the card stands at its station's yaw; turned to you it would
  face away, a draw of nothing twice a frame for every card. Walking in still goes by where
  you stand on the floor (within 1.1 m of its spot). With the circles asked first no ring is drawn (above). At a studio
  station the studio can hide every other station (`HOST.collab.hideOthers(on)`, v119, the studio's switch; `HIDE`,
  `hidingOthers`): while on and this headset's live station runs the studio, the other stations' rings, cards and icons
  are neither drawn nor pointable (`r.hid`; people as ever) nor walked into (`zoneStep`: a circle you cannot see would
  switch your story as you walk about a life-size scene), but the lobby, where the headsets charge, is still walked into
  (its ring, card and icon hidden too); it lapses when the live station or its story changes (it
  holds what it was asked for, `HIDE.sig`), and `hideOthers()` without an argument says whether they are hidden now.
  Pages are as ever.
- In a circle, icons only (the owner, 30 October 2026, after v100: "Once
  inside a story hide the circles and show only the 3d icons, show circle once
  a person moves close to the 3d icon of that story"; from 29 October to v100
  it was the other way round, rings only): while a headset has a live station,
  every other station shows its icon only, its card and ring hidden; another
  station's ring fades in within 2 m of its spot and out beyond 2.2 m (`RING` in
  `drawPreviews`, the ring's `near`), so you see where to step in. Your own
  station shows nothing (the owner, 31 October 2026: "just hide it once i am
  inside, only show it if i turn on the show all rings in the menu"): no card, no
  icon and no ring, wherever you walk while it is yours, and nothing of it to
  point at. *Show all rings* (the menu's Circles tab; this headset's own, kept as
  `collabRings`, never in the room; `HOST.collab.allRings(on)`) shows every ring
  at any distance, yours too (faint), to find the circles or grab your own (and is the only way to see a ring while the
  circles are asked first). The icons stand for their stations: pointable
  through an unseen ball round each (`ICON.ball`, 0.2 m), grabbable, and the
  trigger there says to walk into its circle, as on a ring. Pointing at an
  icon, a ring or the card it brought up (a controller's ray or a hand's pinch
  ray resting on it) shows that station's card for as long as it points; it
  stays 2 s after and fades (`PEEK`: the ring's `seenAt` and `peek`, the
  card's opacity), so you can tell which story it is without walking over.
  Before any circle everything shows as before (rings, icons and cards).
- Follow a person (pages only; the owner, 29 October 2026: a laptop for people
  who do not want to wear a headset follows along): in the Shared dialog's
  people list each person in a headset (`kind` `ar` or `vr`) has *Follow*
  (`HOST.collab.followPerson(id)`, `followingWho()`; `C.who`; refused for
  anyone not in a headset). The page then follows whichever station that
  person's headset runs, as their presence says (`st`: the circle they walked
  into last, which stays theirs when they walk out of it), switching as they
  walk into the next circle (`whoStep` in the pump; `choose(id, 'person')`);
  with their presence quiet (a headset taken off), or one that says no
  station, it stays on the last one. It stops when they
  leave the room (gone from the members for 15 s while this page is connected,
  `WHO_GONE`, so a socket of theirs back within it, as after a relay restart,
  keeps them; the page stays at their last station, following it as by hand),
  or when this page follows a station by hand (a station's Follow, the map),
  picks a story by hand, presses Stop following, leaves the room or starts a
  headset session. The dialog says "Following <name> (at <story>)", "(last at
  <story>; in no circle now)" or "(not at a station yet)"; Follow on someone not
  at a station yet keeps the dialog open. Nothing is written to the room (each
  page's presence already says where it is), so no `FORMAT` change. A reload in
  place (`HOST.place`, `who`) follows them again.
- Camera mode (v124; the owner, 8 November 2026: "Camera mode, where an android in ar mode is aligned with the room and
  then acts as a camera, i can just record the screen to see what people see in vr with the real world overlaid, would
  make sense combined with the follow feature to give people outside an option to see the things too"; Android's own
  screen recorder records Chrome's AR session with the camera image, so nothing is recorded in the page). The camera mode
  section of `shared.js` (`CAM`, `camStart`, `camSession`, `camStep`, `camMark`, `camRender`), with small hooks
  elsewhere; no `FORMAT` change (nothing stored changes shape).
  - Offered on a device whose browser offers `immersive-ar` (`isSessionSupported`, asked once) and that is not a
    headset's browser (`IS_HEADSET`), in a room that is not on this device only (`camOffered`): *Camera mode* in the
    Shared dialog's room row, with a line saying what it is; and a link with `&camera` (`#s=XYZ&camera`): its own page
    (`#camera` before the session, `.cam-pre`) with one big button, *Start the camera* (a tap must start a session), the
    dialog not opened. A headset's browser, or a device without AR, gets a sentence instead of the button.
  - Starting (`camStart`, within the tap): `CAM.want` set, then the page's Enter AR button pressed (`btnAR.click()`), so
    the story on show starts its AR session as Enter AR does. `HOST.xr.request` (index.html) takes `extra` ({ features,
    init }), and `shared.js` wraps it: while `CAM.want`, AR also asks for `hit-test` and `dom-overlay` (`domOverlay: {
    root: #camera }`) on every rung of its ladder (depth sensing kept). A refusal shows on the camera's page; no request
    within 3 s (a story still loading) says to try again. The camera's session is only the one its own request gave
    (`CAM.sess`, noted as the request resolves, before the story makes it `HOST.session`; `camSession`, first in `watch`):
    `CAM.on`, `HOST.collab.cameraMode()` true (other parts of the shell guard on it). Any other session that starts
    meanwhile is not the camera's, and Start's wish (`CAM.want`) goes with it.
  - Lining up: no shared space and no controller tip on a phone. The overlay shows a crosshair in the middle of the
    screen; a hit test from the viewer space straight ahead (`requestHitTestSource`, `getHitTestResults` every frame,
    `camStep`) finds where the aim meets the floor (a ring there, `OV.camRet`); *Move the phone slowly so it finds the
    floor* until it does, then *Aim at spot A and tap Set spot A* and spot B. `camMark` hands that point, raised by
    `FLOOR_TIP` as a controller's tip held on the floor is, to the calibration (`markAt`, split out of `mark`), so the
    floor spots' rule (v122) gives the camera the headsets' room and floor (a test: within 1 cm and 0.5 degrees). A
    camera calibrates on the spots afresh each session (Chrome has anchors but no persistent handles: `HOST.anchor.keep`
    gives no handle, and its anchors hold the room for the session): a camera keeps no places (`roomFrames`:
    `storePlaces` writes none, and its session drops any, `placesDropAll`), and its session starts with none (`R.saved` cleared, any handles let go), so nothing is looked for
    (`restore`) while it asks for spot A; and again by itself once
    the room is lost (a reset without anchors to follow); *Calibrate again* in the overlay. It never writes the room's
    floor (`claimFloor`). Without the DOM overlay (domOverlayState missing) a tap on the screen (the session's `select`)
    sets the spot. The room setup guide, its startup flow and the check by eye never open (`guideOn`, `eyeRoom`), nor the
    menu (`menuOpen`); no notice, subtitle strip or frame rate is drawn in 3D (the overlay says what is needed: `camWords`).
  - What it shows: what a headset in the room at its circle sees. The station it follows is its live one: its story
    loaded, its rig at the station's spot (`place`, as a headset's), on the station's clock; the other circles' icons and
    cards as a headset sees them; everyone in a headset (`drawPeople`, as with People: everyone; rays, dots and name
    tags; as in a headset in AR a head and hands only for people elsewhere, since the camera sees the people in the room).
    Its narration plays as a page's (no sound zone).
  - Follow (the overlay's *Follow* list): a person in a headset (`followPerson`, `C.who`, `whoStep`: allowed during a
    camera's session, whichever circle their presence says), a circle (`choose(id, 'follow')`) or nobody; the room's arc
    as a page takes it (`arcStep`'s page branch). Walking with the phone never enters a circle (`zoneStep` and `allFirst`
    skipped), and the circles' question never opens. A session that starts keeps what the page followed.
  - An observer: it writes nothing to the room (`publish` refuses every key, `fx` every key but its presence;
    `camQuiet` logs each once, `camera().quiet` lists them). Its presence is `{ st, head, hands: [], kind: 'cam', ts }`
    (`statusOut`'s without the head while not lined up); its hello says kind `cam` and the name *Camera* (the relay's and
    the hub's kinds take `cam`; an older relay makes it `desktop`, which never counts as a headset either). Other devices
    mark it (`P.cam`): never drawn in a headset (no head, hands or tag), never in `heads()` (the studio's behaviours), never
    among the headsets that line up (`linedUp`, `othersIn`, the pages' guide list) or offered Follow (only kinds `ar` and
    `vr`); what a headset shows of its own (the welcome toast) guards on `cameraMode()`. The pages' people list and the
    headset menu's people rows say *camera (filming)* (never *here* or *elsewhere*), and the room map draws a small box
    for it. A station card's *Here:* line names it *Camera*, as it names the pages at that circle: people can see a
    camera films there.
  - Taps on the camera image press nothing: the overlay root covers the screen and cancels every select
    (`beforexrselect`), and `ray()` takes a camera's rays as the shell's with nothing to press (a guard for a browser
    that does not honour it). Taps on the overlay's buttons are the overlay's. A double tap on the image (two within
    0.4 s and 60 px, `camTap`) brings a hidden overlay back.
  - The overlay (`#camera`, the DOM overlay's root; HTML, its CSS injected once, `CAM_CSS`; its listeners added with
    `HOST.quiet`): a small bar at the top with the lining-up status and *Follow*, *Calibrate again*, *Panels: shown /
    hidden* (this camera's own: `HOST.collab.panels` gives `hidden`, so the story hides its panels on this device only),
    *People: shown / hidden*, *Sound* (this device's mute), *Subtitles: on / off* (the narration's captions as a strip at
    the foot, `captionNow`, as focus mode shows them), *Hide* (the controls go until a double tap; the subtitles stay)
    and *Exit* (ends the session; the page then follows on as a page does, its kind `desktop` again). The crosshair, the
    step and *Set spot A* / *B* show while lining up. None of its settings is the room's.
  - For tests: `HOST.collab.cameraMode()`, `camera()` (`{ on, want, phase, ok, offered, lined, calib, hit, follow,
    station, story, hidden, panels, people, subs, list, words, quiet }`), `cameraOffered()`, `cameraStart(why)`.
  - Untested on a real phone: everything (the hit test on a tape cross and how close it lines up, a heavy story's frame
    rate on a phone, the DOM overlay on real Chrome, the recording with Android's screen recorder, sound in it).
- Arrange all: two rows in front of you, half the stories (rounded up: eight of
  sixteen) 1.2 m ahead and the rest 2.6 m further on (behind them; in the gaps when the second row is shorter), 2.4 m apart, every
  station facing away from you (its content floats 1.4 m beyond its spot); it
  needs about 17 m x 4 m of floor from 1.2 m in front of you. It leaves the design room's table where it is (not a
  story), and the All stories and lobby circles too (never moved, made or removed by it). Remove asks first ("Remove for everyone?", 3 s), on the page and in the headset.
- Station icons (`makeIcon`, `iconDef`, `miniDef`, placed by `iconStep` in `shared.js`; 29 October 2026, the owner's
  go; made from the miniatures the same day, the design room's part 2): over each station's ring, its middle 2.1 m
  above the floor (over the heads of people in the circle and above the card's top edge at 1.6 m, so from across the
  room it covers neither), its story's main miniature: the `icon` of its entry in `stories/list.js` (a key of
  `LOWPOLY_MODELS`: the tour's interactome, the PET scanner, the airports' globe; the design room's own `design.table`,
  a small round table with props on plates in the stories' colours, which is only its icon, not a prop on the table;
  and the shell's two circles' own, `all.stories`, the Stories screen in miniature (sixteen cards in the stories' colours
  in two rows on an arc under its header, lit from within), and `all.lobby`, an open doorway with light in it, stepping
  stones up to it and a curved arrow turning back over it (the icons of All stories and Back to the lobby, `KINDS` in
  `shared.js`; not props either: story `all`, which the design room's build skips)), from `lowpoly.js`, loaded once through `HOST.lowpoly()` the first time an icon wants one. Its parts are merged into
  one mesh (one draw call; its see-through parts, glass and haze, in a second, drawn after without writing depth),
  centred and sized as the first hand-made models were (its box in a ball of 0.6 units, its longest side at most 0.9:
  a globe about 0.2 m across, `ICON.size` 0.3 m a unit), with a soft additive glow behind it in the story's colour
  (`col` in `HOST.list`), and its own colours drawn towards the story's (`ICON.tint` 0.55: by lightness, from a dark
  tone of the colour through the colour to a lighter one, so white parts take it too), so people can tell from across the room which circle
  is which story. It is turned to your head and leant back as far as you look up at it plus 0.2 rad (so its top
  shows), and turns about its own axis once in 12 s, each station in its own phase; the flat ones (lower than about
  0.6 of their width: the slide, the room, the table) lie back further, by how flat they are, so their top always
  shows. Lit by its own shader in view space (a light over your shoulder, a rim in a paler tone; glowing parts nearly
  unlit), so it looks the same in every story's scene whatever its lights. It follows the rings, not the cards: shown
  in every labels and cards mode, opaque, depth-tested and writing depth in the room, since it is part of the station
  rather than a card, and with cards hidden it is what tells the circles apart. At your own (live) station it shrinks away
  (your story is in front of you); in a circle the others' icons are what shows of their stations ("In a circle, icons
  only"). A child of its ring's group, so it eases with the station (`SHOWN`) and grows with it while carried; pointable
  through an unseen ball round it (`ICON.ball`), as its ring is. Built once per story, the
  first time a station of it shows, at most one a frame (a room's first view would build every one at once), and
  kept; until then, while `lowpoly.js` loads (or if it cannot), and for a key whose entry names no miniature, a glowing
  dodecahedron with a ring in its colour stands there: a seventeenth story needs only its `icon`. 600 to 1,200
  triangles each. `tools/icons.html` (served next to the app) renders them all, every story's, then the design
  room's and the shell's two circles' (`HOST.collab.kinds()`, keys `all` and `lobby`), in a grid as a headset sees them (`?keys=a,b`, `&cols=`, `&t=` frozen, `&turns=4` four sides, `&fallback`),
  from the app in a hidden frame through `HOST.lowpoly()` and `HOST.collab.icon(key)` (its `model` says which
  miniature, '' the fallback). How they read from across a real room is untested on a headset.
- The design room in a room (the design room's part 2, 29 October 2026): not one of the stories, so never part of
  Arrange all (it neither places nor moves nor removes a station of it), but a station like any other once placed: the
  page's Shared dialog lists it after the stories in its station picker (Add), the headset's Add here page too, and the
  headset's menu has a *Design room* row (below the settings and Panels, above the shared room): outside a room it
  opens the design room (`HOST.go('design')`, the menu closing; greyed while you are there); in a room, *Design room
  here* puts the props table at your feet as a circle facing your way, or moves the room's one there when it has one
  (one table, not a pile of them; `pageHere`, `HOST.collab.design(b)`), refused while the circles are locked as Add
  is (greyed). A new station of a page that is not a story starts its clock at its table, in explore mode (a story's at
  its start, paused). Standing at it (it is at your feet) the headset takes it as its station and the table stands
  life size in front of you (its middle 1.55 m ahead of the spot), shared like a story at its station.
- The studio in a room (v111): a page that is not a story, placed and kept as the design room is. The page's Add and
  the headset's Add here list it after the design room (`STORY_EXTRA`'s order, then All stories and Back to the lobby);
  the menu's Settings tab has *Design room* and *Studio* side by side (`PAGE_ROW`, `pageRow`): outside a room *Studio*
  opens the studio (`HOST.go('studio')`), in a room *Studio here* puts a plain studio circle at your feet facing your
  way, or moves the room's plain one there (one not made for a scene: no `sc` in its record, told by how it was made and
  never by its state, which names a scene as soon as one is picked there; the first by id when there are several,
  whatever circles of scenes stand beside it; `pageOne`, `pageHere`, `HOST.collab.studio(b)`; since v118, when a room may
  hold several studio circles), refused while the circles are locked; never Arrange all. Its clock starts in explore
  mode.
  - Scenes as circles (v118; the owner, 5 November 2026: "add scenes as possible circles"): the page's Add and the
    headset's Add here list after *Studio* one entry per scene of the studio's relay (*Studio: <scene>*; `SCN`,
    `scenesFetch`: `relayFind()`, then `GET /api/scenes` with the kept password through `api()`, asked again whenever
    the dialog or the Add here page opens, at most every 3 s; nothing listed without a relay, from a relay without
    `--scenes` or one that refuses; the headset's page shows at most 8, `SCN_ROWS`, and says how many more a page has).
    Such an entry (the picker's value and the button's id `scene:<name>`, `addOne`) makes a studio circle for that scene
    in one batch (`addScene`): `st.<id>` = `{ story: 'studio', sc: true, x, z, yaw }` (`sc`, the shell's own mark that
    the circle was made for a scene, kept by every move, `stVal`; FORMAT networks-33), its clock, and its state `st.<id>.x` =
    `{ scene }` (the studio's own field and nothing else: the studio at a station whose state names a scene and holds no
    items opens it and writes its saved layout, every device alike; the shell changes no `state()` shape). Several
    studio circles may stand in a room. Wherever the shell names a station (the cards, the dialog's rows and map, the
    menu's lists and Story tab, people and Follow lines, the question of circles asked first) a studio station whose
    state names a scene is *Studio: <scene>* (`sceneOf`, `stTitle`; a plain circle too, once a scene is picked there). `HOST.collab.scenes()`, `addScene(name, b)` and
    `sceneOf(id)` are for tests. Its scene is life size on the room's frame (v125; the owner, 8 November 2026: "align all
  things to the room marks and have the circle only be the entry, so that moving the circle does not move the studios
  scene content"): its origin and axes the room's (the floor at y = 0; on a room calibrated on its floor spots spot A, x
  towards spot B), so every item stands at one place in the real room whichever circle shows it and wherever that circle
  stands (two studio circles of one scene show it at the same place); the circle is only the way in (walked into, or *Go
  in*), its panels float at it, and moving or turning it (the grip, the map, Move here) moves nothing of the scene (until
  v124 the scene stood round the circle's spot and moved with it; *Move the scene to this circle*, "The studio" below,
  puts a layout made then back round its circle). Everyone at the station sees one scene and one layout: `state()` is the
  scene's name and one field per item ("What each story shares" below; the studio came with no `FORMAT` change, an older
  device showing the station as *A newer story*; sounds that follow a model changed a sound's record, networks-30;
  cut-outs added a field per cut-out, networks-31; groups a field per group and Faces an object's `faces`, networks-32). What each person's place reveals (the trigger cubes), editing, the selection, Walk, the
  VR stick walk and sound are each device's own. With exactly one scene in the relay's listing every device at a station
  with none picks it and writes its saved layout (every device writes the same records, so nothing doubles); else
  *Pick a scene*. A circle made for one scene (v118: the shell's *Studio: <scene>*, written as `st.<id>` = `{ story:
  'studio', x, z, yaw }` and in the same batch `st.<id>.x` = `{ scene }`): a station whose state names a scene and holds
  no item field at all is opened on every device there as `'fresh'` (`collabApply`), each writing the scene's saved layout
  alike, so the circle shows the scene at once (a device with that scene open already, from another station or outside
  the room, opens it again there: `STU.stId`; items from the room that come first are the room's, `STU.fresh`). *Lock this
  story* refuses its editing for everyone at the circle ("The studio" below).
- Moving a station by hand: in a headset the grip on a station's ring, icon or card
  picks it up (the shell hears the session's own `squeezestart` and
  `squeezeend`, controller i being `session.inputSources[i]` in three.js r128,
  so the stories need nothing); it swings round your hand as you point, its
  distance from the hand grows as you raise the controller and shrinks as you
  lower it (`exp(2 x the pitch's change)`), and twisting your wrist turns it
  (`carryStation`). It goes out to the room at most every 66 ms while it moves
  (with `ts` and `h: 1`), once more as it comes to rest and once more without `h` when let go (`MV`; a carry the
  circles lock stops lands where it was last sent), and the others draw it as it moved, a moment later (`SHOWN` from
  its samples: "Others' moves, smooth"); it is also put down when its controller goes, its grip
  is up or the headset is taken off (no `squeezeend` may come then). Your own
  station's ring can be grabbed too while *Show all rings* shows it (a trigger on
  it does nothing; else *Move here* in the menu moves it). Every
  headset draws rings, cards and its live station's placement where `SHOWN`
  eases them to the room's value, so a moved station glides, and the people at
  a moved station keep it (a station is left only by walking into another
  circle). On a page the room map does the same: a station's dot dragged
  moves it, its square (where its content floats) dragged turns it; a click
  still follows it, the map keeps its scale while dragging, and an interrupted
  drag (`pointercancel`) puts it back.
- Two locks (the owner, 29 October 2026: "one toggle for locking the circles'
  movement globally and one toggle per room for locking its panels and story
  elements"; a "room" there is a story's circle):
  - The circles lock (key `lock`, `{ on, by, at }`, FORMAT networks-6, the
    layout lock of v96): once the stations are in place anyone locks them
    (*Lock circles* in the headset's menu and the page's Shared dialog) and
    anyone unlocks them. While on, the grip on a station's ring or card, the
    room map's drag and turn, Arrange all, Add, Move here, Design room here
    and Remove are refused (`refused()`, `circlesLocked()`), a station being
    carried stops where it was last sent, and the cards say so. It never
    locks a scene or a panel. A room from v96 locked then reads as circles
    locked only: its stories need locking once.
  - A story's lock (*Lock this story*; `lock` in `st.<id>.ui`, with its
    panels; `stLocked`, `setStLock`, `HOST.collab.stationLock(id)`,
    `setStationLock(id, on)`): the grip moving, turning or resizing the
    station's scene and moving or tilting its panel is refused for everyone
    at its circle (`HOST.room.gripLocked()` there, and the story panels'
    hint: "This story is locked"); a scene or panel held when it locks stops
    where it was last sent and glides back to the room's. Set in the clock
    menu at that station (beside *Lock circles*) and per station in the
    page's Shared dialog (*Lock story* / *Story locked* on each station's
    row); never refused by the circles lock, nor the other way round.
- The headset's menu (the shell's panel, `PNL`, `drawPanel`) is closed at the
  start of every session, and nothing of it shows then: no watch (the owner, 1 November 2026: "Watch can be totally
  hidden now, not needed anymore if we can open the menu with stick click or double pinch"; until v102 a clock showed
  the time on the left wrist, and the loading ring sat there too). The welcome, *Getting around* (v124, below), says how
  to open it; with the welcome off (tests) a notice titled *The menu*, 2.5 s into a session, says it as before
  (set as the session starts, in `watch`: *Click a stick to open the menu*, or with tracked hands *Pinch twice with your left hand, pointing at
  nothing*), unless it is open by then.
- Getting around (v124; the owner, 8 November 2026: "a little popup toast at the beginning after alignment that tells
  people to click the rooms to enter in case its in click to enter mode and to move to them if its in that mode, also
  quickly explain the controllers, the button for clicking and the button for grabbing"; `WEL`, `welStep`, `drawWelcome`,
  `OV.wel`): once a session in a headset, a small panel in front of you (its own sheet, not a notice, so `notes()` is
  unchanged: 760 x 360 px, 0.56 m wide, 1.05 m ahead and 2 cm under the eyes, eased with the head as the notices are
  and above where they show, over everything, `renderOrder` 54, never pointable) for 14 s (`WEL.ms`, *Closes by itself
  in n s*), with a soft chime. Its words: *Getting around*; in a room with circles (the room's arc aside), by the room's
  setting, *Point at a circle's card or icon and press the trigger to go in.* (asked first) or *Walk into a circle to go
  in.* (walked into); in a room with only the room's arc, *Point at a story's card in front of you and press the trigger
  to start it.*; then *Trigger (index finger): click.*, *Grip (middle finger): grab and move things.* and *Click a
  stick: the menu.*, beside a controller drawn from the side with its trigger in cyan and its grip in amber. With tracked
  hands (the left input source a hand): *pinch* for the trigger in the circles' line, *Pinch: click.* and *Pinch twice
  with your left hand: the menu.* (a hand grabs nothing: the grip comes from squeeze events only). In a shared room it
  waits until this headset is lined up (`lineUp().k` `'ok'`, or `'away'` or `'alone'` where nothing lines up) and nothing
  else is in front of it: not while the startup flow is to come or shows (the room setup guide, the check by eye), nor
  while calibrating, checking or re-aligning, nor over the circles' question, the once-per-room question, the menu or
  its keypad; outside a room 2.5 s into the session (`WEL.wait`). It closes early when the menu opens (or the circles'
  question, the check by eye or a calibration comes), and does not come again that session. Never in camera mode
  (`HOST.collab.cameraMode()`, where a version has it). Its opening by itself: `HOST.collab.autoWelcome(on)` (off also
  closes one on show), or `localStorage` `collabAutoWelcome` = `off` before the page loads (every page `tools/collab.mjs`,
  `tools/smoke.mjs` and `tools/audio.mjs` open has it, as `collabAutoAll`; `installXR`'s `welcome: true` turns it on);
  `HOST.collab.welcome()` (`{ shown, at, text, mode: 'ask' | 'walk' | 'arc' | '', hands, done }`) is for tests. How it
  reads and where it stands on a real headset, and its timing after a real alignment, are untested. The menu opens and closes with a click of either stick
  (`sticks`: `buttons[3]`, rising edge, per input source; a stick held down as its controller appears is no click; no
  story uses it: they use the stick's axes; since v125 it opens or closes once 0.4 s have passed with no second click of
  that stick, `CLK`: the left stick clicked twice turns moving with the sticks on or off (the right stick clicked twice
  launches or lands a spaceship since v132; while one flies, since v133, a press of the right stick pushed past 0.5 from
  its middle counts for nothing) and never the menu, the other
  stick clicked meanwhile counts as the same click, so both at once still toggle it once; "Moving with the sticks" under
  "Four headset settings"; `buttons[4]`, A and X, plays and pauses nothing since v125), or with tracked hands two
  pinches of the left hand within 0.4 s while its ray points at none of the panels (`pinched`, from the session's `selectstart`: not at the menu, a
  station (the shell's hover) or a story panel (the `near` the story passes to `HOST.collab.ray`), so two pinches
  meant for a panel's button stay the button's; the scene counts as nothing, since in the flock, the robots and the
  pass story's sea the scene is everywhere the ray goes, and the story gets those two pinches too; not the right
  hand's, not while calibrating; the owner: "only left double pinch"), and by Close in its header. Unused for
  20 s (`IDLE`; no press, no ray resting on it, no fingertip at it, not held) it closes by itself, not while
  calibrating, not while it asks its once-per-room question, and when it opened by itself (`PNL.self`) not until it has
  been used (neither opens again by itself). It
  floats in front of you (`floatMenu`, `FLOAT`; the owner: "Menu should be further away from the face by default, also
  should be movable with grabbing"): put there as it opens, level in the direction you face, its middle 0.8 m ahead
  along the floor and 12 cm under your eyes (`FLOAT.pos`, `{ d, h }`), at 1.05 of the panel's 0.42 m (about 44 cm
  wide: too far for a fingertip, the ray reaches it; in v102 it was 28 cm wide at 0.5 m), turned to you, hanging from
  its top edge, so the tabs stay put while the tab below them changes height. It stays put while you use it and glides
  back in front once your head has turned more than 30 degrees from it, walked off (nearer than 0.35 m or further than
  1.4 m along the floor) or moved 25 cm up or down, never while a ray or a fingertip is at it. The grip on it (on its
  canvas or the Story tab's copies of the panels; `grabMenu`, before the shell looks for a station; `MG`) picks it up:
  it stays at that point of the controller's ray, as far along it as where it was taken, turned to you (`carryMenu`),
  and where you let go (`menuPut`) it stays for as long as it is open (`FLOAT.pinned`: no gliding back), and the
  distance and height you left it at are where it opens next time (`xrMenuAt` in `localStorage`, this headset's own;
  `d` 0.3 to 2 m, `h` -0.8 to +0.6 m). It is put down when its controller goes, its ray is stale or the menu closes.
  Its header shows *Menu* and the time (hours and minutes, `timeNow`, redrawn when the minute changes), how it closes,
  Close, and four tabs (`TABS`, `PNL.tab`, `setTab`; it opens on the tab used last, kept as `xrMenuTab`, Story the
  first time, and on Circles when it opens by itself), each as tall as what it shows:
  - **Story** (the owner, 1 November 2026: "A tab in clock menu that shows the current circle story menu card"): the
    story on show's own two panels, its text panel over its foot bar, drawn by the menu as two planes over its canvas
    (`OV.mirror`, `renderOrder` 54, `mirrorStep` each frame where `drawPanel` left room for them, `PNL.mirror`) with the
    story's own canvas textures, so they are the story's panels exactly as they are now (its pane, its hover, its
    buttons lit), whatever the Cards and Panels settings and wherever the story's own panels are. They are used there
    as on the story: the ray on a copy is a shell hit of kind `storypanel` that `HOST.collab.ray` returns as
    `{ kind: 'shell', panel: 'main' | 'foot', u, v, point, dist }`, and the story turns it into a hit on its own panel
    at that point (`menu: true`), so hovering, pressing and its sounds are the story's own; the grip there moves the
    menu, never the story's panel (`xrGrab` ignores `h.menu`). Over them the story's title in its colour; with no story
    on show a line instead (in a room away from every station: walk into a circle; else pick one). The story gives
    its panels through the `panels` hook (below).
  - **Settings**: Exit (ends the session: neither the story panels nor the headset Stories screen have one), *Recenter* and *Anchor: on/off* side by side
    (Recenter, the owner, 30 October 2026: the story's own, `HOST.cur.recenter`, as the story panel's
    button: you in front of it again, *Place again* while anchored; at a station the station's scene and panel back
    where the story puts them, for everyone at its circle, greyed while its story is locked; greyed away from every
    station. Anchor, `set:anchor`: `HOST.anchor.set`, anchored placement for every story, the headset Stories screen's
    button until v109; in a shared room it can be turned off, not on, as the room places everything), *Slideshow:
    on/off* (`HOST.slides.setGlobal`, for every story, shown when `HOST.slides` exists, a note beside it), *Repeat:
    off* / *all* / *one* (`set:repeat`, `HOST.setRepeat`, each press the next, this headset's own, a note beside it:
    what a story's end does, or in a room that it does not run there; the Stories screen's buttons until v109), *Labels* and *Cards* side by side, *Moving* and *Subtitles* side by side (the four headset settings,
    `HOST.xr`), *Moving with the sticks: on/off* (v125, this headset's own, the whole width with a note under it,
    greyed with the reason in AR, in a shared room and in the studio: "Moving with the sticks" under "Four headset
    settings"), *Spaceship: launch* / *Spaceship: land* (v132, the whole width with a note under it that the right stick
    clicked twice does the same, greyed with the reason where no ship can fly: "Spaceships"), *Frame rate: on/off* (the frame-rate read-out, this headset's own, a note beside it: "Four headset
    settings"), *Developer mode: on/off* (v125, this device's own, a note beside it: "Developer mode"), *My menu: only me* / *my circle* (this menu shown to the others at your circle, this headset's own, a note
    beside it: "Your menu shown to your circle" under "Four headset settings"), then *Panels* (the story on show's, `HOST.panels`, with a note beside it: in a room that the panels are
    for everyone at this circle and the rest for the room, else for that story only; with no story on show, in a room,
    a line that these four and Sound effects are the room's takes its place); *Sound: on/off* (`set:sound`, this headset's
    mute in the session, `HOST.audio.mute`: on until turned off there, v124, saved as `xrMuted`; a press is a tap, so it
    starts the engines too; a note beside it); *Sound effects: on/off* and *Narration: on/off* side by side (Sound effects
    for every story, in a room the room's: "The two sound switches"; Narration this headset's own, in a room until the
    lobby: "The narration"), then *Effects volume* (`HOST.sfx`, this headset's own, with a note saying so); *Design room* and *Studio* side by
    side (outside a room each opens its page; in a room *Design room here* and *Studio here* put its circle at your
    feet: "The design room in a room", "The studio in a room"), a note under each.
  - **Circles**: the shared room (its code and people as the heading, with *Another room* beside them in a room; in no
    room the rooms, then *Start a room*, *Join with a code* and *Refresh*; the question; stations (Move here, Add here;
    Arrange all, Remove; *Lock circles* and *Lock this story* side by side, the latter at a station only; at an All
    stories circle its switch, *Own stories* / *With the room's circles*, and *Back to all stories*; *Show all
    rings* and *On this network*; *Circles: walk in* / *Circles: ask first* with a note (the room's, "Circles asked
    first"); *Narration for everyone here*: *On for all* and *Off for all* (v124, "The narration" under "Sound effects");
    above them, for a headset in the room with the others, *Room setup* and how it lines up), people (at most `PEOPLE_ROWS`, 6, and as many as leave room for You), You (name,
    colour, Leave). *Join with a code* and *Another room* (the owner, 30 October 2026: "Joining a room with code not
    possible in ar/vr?") open a page in place of the rest of the tab (`codePage`, `PNL.code`): the code so far in three
    boxes, a keypad of the 26 letters (seven to a row; a fourth letter refused), Delete, Join (once there are three
    letters, and not the room you are in; a code with no room says so, as on a page) and Back. *Room setup* opens the
    room setup guide's five pages there likewise (`guidePage`: "The room setup guide, its startup flow and Touch the
    spot"), which also opens there by itself as a headset enters a room.
  - A keypad for a word (v118, `HOST.collab.keypad({ title, hint, value, max })`: a promise of the text typed, or null;
    for pages that need a word in a headset, which cannot type, such as the studio's scene names): in place of the tab
    shown, whichever it is (`keyPage`, `PNL.kp`, the relay password's page as its model), the title, a hint, the text so
    far, the 26 lower-case letters and the ten digits nine to a row, *space*, `_`, `.` and `-`, Delete, OK (greyed while
    there is nothing but spaces; it gives the text as typed) and Back. The menu opens for it, and closes after OK or Back
    when it was closed before; it does not close by itself while the keypad waits. Back, another tab, the menu closing,
    another keypad and the session's end give null (`kpEnd`); with no headset session or no story scene to show the menu
    in, null at once. Its buttons' ids are `kp:<key>`, `kp:space`, `kp:del`, `kp:ok` and `kp:back`.
  - **Debug**: the room's alignment (in a room, once the question is answered: Calibrate, Re-align, *Check here* (Touch
    the spot) and what the check says, the shared space's lines, Forget calibration, Shared space: on/off, Fresh shared
    space, then *I am elsewhere* / *in the room*), *Places* (v130, in a room or in none: *Join ABC: you are standing in
    its place* when offered, each place kept with its *Forget*, the anchor budget's line, and since v131 the room's areas
    with *Forget area*: "Places" and "Areas" under "Shared rooms"),
    *People: same circle* / *everyone* and *Sound check* (a page in place of the rest of the tab: the two beeps,
    the engine choice, Reset the sound and `HOST.audio.report()`, redrawn twice a second; *Try the sound effects*;
    Back), *Trackers: shown / hidden* (v126: the PC's trackers as small pucks, this headset's own, a line beside it: "Vive
    trackers"), *Refresh rate: 90 Hz* and *Foveation* and *Resolution* side by side (v136, this headset's own: "The refresh
    rate" under "Four headset settings"), *What is new* (v125: this release's lists, a page in place of the rest of the tab, with Got it and Back:
    "Developer mode"), then read-outs (`debugLines`: the release and `FORMAT`, the room's code, relay or peer to peer and its round
    trip, Quest Browser's version, the frame rate, `FPS`, once a second, with the session's refresh rate). The read-outs
    are drawn on their own as they change (v136; `stripStep`, `stripRow`, `sheetPatch`): the frame rate and the round trip
    are out of the menu's signature (`panelSig`), so the whole canvas (720 x 1920, 5.5 MB with its mipmaps) is no longer
    drawn and sent to the GPU each time they change; at most every 200 ms (`STRIP.ms`) a line that changed is drawn again
    on a small canvas of its own (its row: the menu's background, then the line), put on the menu's canvas in its place
    (so the picture shown to your circle, `menuShot`, has it; `cver` does not move for it) and sent to the menu's texture
    alone (`texSubImage2D` of that row, 652 x 30, then its mipmaps; a texture still to be sent whole carries it; without
    WebGL2 the whole texture), another number of lines drawing the tab again. Likewise (v136) the members are in the
    signature only on Circles and Debug (which name them) and the people's stations only on Circles (its people rows):
    someone walking between circles drew the whole menu again whatever tab it showed. `HOST.collab.strip()` (`{ rows,
    patched, lines, at, x, w, lh, ver }`), `stripMs(ms)` and `fpsTest(v)` (the frame rate as a second's count would set
    it) are for tests.
  The canvas is 1920 px tall, more than any tab needs (Circles in a room with six people is about 1230 px, the room setup
  guide's tallest page about 1090; Settings about 1700 with a ship flying outside a room (the smoke test's spaceship steps print it and fail past 1900), Debug about 870 (v136's three rows add about 210 px: 1384 px in a room on this device with 20 stations and no places; the smoke test's frame rate steps print it and fail past 1500); What is new as tall as its lists, up to the
  canvas; Story as tall as the story's two panels at the menu's width). A right index fingertip also presses its buttons (`poke`: within 1.5
  cm of the panel over one, again once pulled back 3 cm; a pinch on the ray at the same button within 0.7 s counts once
  with it, `twice`), not the Story tab's copies (the ray does). The
  once-per-room question still opens it by itself (on Circles), and so does the first time in a room with no stations
  (once per room: its Stations section says "None yet: Arrange all puts every story in front of you"; since v109
  not while this headset is about to make the room's arc: automatic circles on, no `allp` yet, in the room with the others). The notices
  say how to open it and under which tab (`menuWhere`). `HOST.collab.panelOpen(on)`, `HOST.collab.menu`,
  `menuTab(t)`, `menuIdle(ms)`, `menuFind(id)` (a button on whichever tab has it, that tab shown), `menuIds()`
  (every tab's buttons), `menuGrab` (held by the grip), `menuPos()` (`{ d, h, pinned }`) and `notes()` (the last eight notices
  shown, titles and texts, kept on the page only) are for tests.
- Other people in a headset (`drawPeople`: from their presence, in room
  coordinates: their rays and the dots at their ends, a name tag over the head,
  and in VR or for someone elsewhere a simple head and hands) are drawn only
  when they are at the same station as you (their presence's `st` is your live
  station; the owner, 29 October 2026: "can we not show other people's name
  tags and hands if they are not in the same circle"); before you have walked
  into any circle you see everyone. *People: same circle* / *everyone* in the
  clock menu draws everyone (this headset's own setting, `collabPeople` in
  `localStorage`, never in the room; default same circle; for debugging;
  `HOST.collab.seeAll(on)`). Pages' room maps still show everyone. Heads, hands and rays are drawn where the
  presence put them `SMOOTH.DELAY` ago, between its samples (`ts` in each); presence without `ts` eases to the latest
  (a 60 ms time constant), as before.
- At its station in a shared room a headset moves the scene and the panel for
  everyone: the grip on the scene moves it (`XR.globeOff`), both grips on it
  resize it (`xrResize`: the distance between the hands, a quarter to four times
  the story's own size, `XR.size`, in story and explore mode alike) and move it
  with their middle, the grip on the panel moves the panel; with free moving on
  (the room's setting) the grip turns the scene and tilts the panel too, and the
  turn is the station's, for everyone there whatever their own setting
  (`q` in the place and the panel; ignored while free moving is off). `placeSync` (every
  frame, from the shell's tick) sends what is held out at most every 66 ms while it moves (`xrPose().held`; `ts` and
  `h: 1`), once more as it comes to rest (so the others see it stop, rather than carry it on) and once more without
  `h` when let go (also when the story's lock stops it: it lands where it was last sent); someone else's move it puts
  exactly where their samples say it was `SMOOTH.DELAY` ago, every frame ("Others' moves, smooth"); otherwise it
  glides each to the room's value (`collab.panel`, `collab.place`; a turn by slerp, sent when it
  changed by more than 0.004 rad, the panel's `yaw` worked out from its
  quaternion), and puts both there at once when
  a station is reached. Both values carry the story they were written for, so
  a late one from before the station changed story is refused by the relay. `HOST.anchor.locked(kind)` is
  `HOST.room.gripLocked()` in a room: true away from any station and while
  the station's story is locked (*Lock this story*; then nothing moves, and the
  panels say so: `HOST.room.gripHint`, which `sigMain` includes, so the panel
  redraws); the circles lock does not lock it. The
  flock and the robots are life size (`life: true` in `HOST.list`): only their
  panel moves. Outside a room both grips resize the scene too, for this device
  only (kept with an anchored place, reset by Recenter). Recenter at its station (the story panel's button and the
  menu's; the owner, 30 October 2026: "Recenter in ar room mode with the circles should bring panel and 3d model to the
  starting position"; `HOST.room.recenter`, `recenterStation` in `shared.js`) takes the station's place and panel keys
  out of the room (absent, they are where the story puts them), so its scene (offset, size, turn) and its panel glide
  back there for everyone at its circle; in explore mode the view goes back to where the story itself put it there
  (`VW.home`: the first view after none, that is explore mode begun or a flight of its own landed, never one glided to
  from the room or turned by hand) and goes out as a view after a flight does. Refused while its story is locked, as the
  grip is (a notice; the menu's Recenter greyed). The life-size stories' own places (the pass story's `sea`) stay.
- In a shared room a headset never shows the Stories screen (neither its
  header nor the story cards) and the story panel has no Stories button (each
  station keeps its story; another story is another station), except at an All stories circle (above: its cards are
  the Stories screen, and its story panel's Stories button goes back to them for everyone there): one open closes
  at once when a room is started or joined (from the page, the headset's menu
  or a `#s=` link; `xrBegin`), entering VR or AR from the start screen in a
  room does not open it (`xrEnterScene`), nor does a new wearer
  (`xrFreshStart`) or a story's end. Leaving the room in the headset brings it
  back, as for a new wearer (`xrBegin` sees `XR.inRoom` turn false and calls
  `xrFreshStart`), and a session ended away from a station opens the page's
  Stories screen (`xrEnded`). Sound check is in the headset's menu.
- In VR the headset's menu opens by itself and asks once per room "Are you in the same room as the
  others?" (In this room / Somewhere else, kept per room code in
  `localStorage` `collabHere`); passthrough counts as in the room.
- `HOST.room` (headsets) asks for its own `local-floor` and `shared` spaces and
  runs its own frame callback. The room frame (an origin and a level x axis,
  kept in `local-floor` coordinates) comes from, first found first: (1) this
  headset's own calibration, which nothing overrides: two tape marks touched
  with a controller (`'marks'`), or last time's found again by the two anchors
  made at them (`'anchor'`; since v130 a calibration is this room's place, kept per room code in `localStorage`
  `roomFrames`, the marks and the anchors' handles, never coordinates alone: "Places" below); (1b) the PC's trackers, for
  the Index on the relay's PC only (`'trackers'`, v126: "Vive trackers"); (2) unless switched off
  (*Shared space: off* on the panel, for this page only: remembered, it
  left one headset unaligned in every room of an evening; on by default since
  two Quest 3s on one browser version lined up through it; the panel says
  when it is off) the
  frame published for its shared space (key `rf.<space id>`, `{ uuid, o, x, g,
  by, at, m }`, `g` `'marks'` or `'shared'`, `m` the marks for drawing) by a
  calibrated headset or the first one in the space (`'adopted'`, first on this
  headset's own floor, then held at that height in the shared space (`R.hS`),
  so a floor the headset estimates again does not move the room; followed
  when it moves more than 3 cm, 1 degree or 2 cm in height), or
  (3) the space's own origin when
  nobody published for it (`'shared'`); (4) else calibrate. A calibrated
  headset publishes its marks for its space anyway and reports how far the
  shared space puts another calibrated headset's marks from its own (`R.cmp`,
  a line on the panel). More than 10 cm or 3 degrees for 5 s, and it tells the
  room the space is split (`rs.<space id>` `{ uuid, bad, d, a, by, with, at }`,
  `splitCheck`; within 5 cm and 2 degrees it says whole again): while both
  headsets that measured it are in the room (`splitHere`), nobody takes a frame
  through that space or publishes its own origin there; a headset without
  marks keeps a frame it holds, or asks to calibrate ("Shared space not
  usable"). Only the pair that measured it writes it again (every minute while
  it still finds it so) or says whole again; older than 3 minutes, it lapses. Why: two Quest 3s on Quest Browser 152 with Physical space features
  off were in two spaces 2.6 m and 11 degrees apart under one id, neither its
  own floor, so nothing but the tape could tell. A headset whose session has
  plane or mesh detection and has found no plane or mesh 20 s in says it has
  no room scan (`scanCheck`, `R.noScan`: run Space Setup, Physical space
  features on), since the shared space and anchors rest on that scan. People
  elsewhere (VR) use their own floor.
- The room's floor is under the marks, not under each headset. Floor spots (v122; the owner, 7 November 2026: "is it
  possible to make the floor also set by the two points for calibration? Meaning i would put these on the floor and that
  would be where the virtual floor sits too? Asking because the floor was off so many times now in various headsets",
  then "floor spots sounds good, lets try that"): the two spots are tape crosses on the floor, touched with the
  controller's tip on the floor, pointing down, so a calibration's floor is the floor under its spots: in local-floor
  coordinates mark A's touch height less `FLOOR_TIP` (0.02 m, the controller's target-ray origin over the floor with its
  tip on it, held pointing down: a guess until measured on a Quest), whatever this headset's own (Guardian) floor says
  (`floorUnder`, `fromMarks`, `marksMk` = `[FLOOR_TIP, d, FLOOR_TIP + B's height - A's]`, the same wherever the floor
  under the marks is worked out: a calibration, its anchors followed or found again, `refloor`, a reset, waking,
  Re-align), so every headset that calibrates on the spots gets the same floor. Its saved marks say so (`f: 1` in
  its place, `R.saved`, `onFloor()`), and so does the room's key `rm`: `{ a: FLOOR_TIP, d, f: 1, by, at }` (`a`
  mark A's height over the room's floor, `d` the marks' distance: marks within 10 cm of it, `SAME`, are the same
  marks). Older devices read `a` and `d` as before (their floor is their mark A less `a`: the same floor), so no
  `FORMAT` change. A floor-spot calibration writes `rm` when the room has none, its `rm` lacks `f`, its distance
  differs by more than `SAME` or its writer has left (`claimFloor`, at a calibration, when its marks are found again,
  and twice a second while `rm` is missing, its writer gone or without `f`); two headsets on the same spots never write
  it in turn, and its own frame never waits for it (two sets of floor spots in one room: `rm`'s `d` is the last
  calibrator's, or the last to find theirs again, so the other headset's note says its marks are that much further
  apart than the room's; the floor is the same either way). When the second spot is touched (`mark()`) spots more
  than 4 cm apart in height are refused (`SPOTS_DH`: *Spots at different heights*, back to spot A; the tip's height
  moves with how the controller is tilted; a guess until tuned from the headsets' logs). How high spot A stands over
  this headset's own floor is never limited (the owner, 7 November 2026: a Quest whose floor put spot A 92 cm up was
  refused by v122's first 45 cm limit, "that was an error by the headset floor and exactly what i want to avoid": a floor
  that is off, by however much, is what floor spots are for), so spots on a table are taken too, and the room's floor
  is then the table's. The log says `floor spots` with A's and B's touch
  heights over this headset's floor and their difference (`dh`) and, when the session has plane detection and a plane
  labelled floor (`scanFloorAt`, the lowest, every 2 s), over the room scan's floor too, and `mark refused` with why
  (and `dh`, or A's height `h`): later logs measure `FLOOR_TIP`, the two limits and the headsets' floors. A
  calibration from before v122 (no `f`: its spots may be table corners) keeps the old rule: `rm` is mark A's height
  over the floor of the first headset that calibrated (taken over by a newer calibration of the
  same headset, other marks, or a calibrated headset when its writer has left; never over the room's floor spots while
  their writer is here), and a headset whose floor differs puts the room's origin that far above its own floor; other
  marks (another distance): its own floor. Either way the origin's height comes from the anchors' heights, so a floor
  that jumps does not move the room, and the panel says how this headset's floor differs ("Your floor is 28 cm lower
  than the room's", `floorNote`). Headsets lined up through the shared space keep their own floor (`reconcile`,
  `R.hS`, unchanged): Check at A says the difference as the height part. Untested on a headset: `FLOOR_TIP` (how high
  the target-ray origin really is with the tip on the floor, and how people hold the controller), the two refusals'
  limits, floors that differ between real headsets.
- Why (the relay's logs of two Quest 3s in one room): the shared space came
  with the same id on both at once but was at first just one headset's own
  floor, jumped by 40 cm and 74 degrees when colocation found something, then
  stayed 0.9 m and 19 degrees out against the tape, and sometimes reported the
  head's pose; one headset's floor was 28 cm too low (its head at 2 m), and its
  origin later jumped 5.5 m and 0.7 m down; `local-floor` moves with a recentre
  without a reset event. Two anchors (positions only) keep the frame on the
  marks; without anchors a reset without a transform or a jump of the head
  asks to calibrate again.
- The shared space (Quest Browser's experiment, explainer
  github.com/cabanier/shared-spaces): a default space for a few seconds, then
  a reset and the real one; the first headset's origin is the space's; one
  space per page address; lost when a headset leaves VR or AR. Our reading of
  its pose (`floorFromShared`) is right: it keeps a headset's own marks in one
  place across its resets to 2 cm (the inverse is 80 cm out). In the logs the
  two Quest 3s had the same id but different spaces: the one with the older
  browser (149) had its own floor every session, the other (150) one frame
  that held to 2 cm over 71 minutes and three sessions; so the 0.9 m and 19
  degrees (later 1.2 m and 28, 2.4 m and 84) were two spaces, not an
  inaccurate one. Right after waking Quest gave the head's pose as the space's
  for up to 15 s: such a pose is not used (`sharedHead`), and nothing is
  published or compared through the space within 20 s of waking (`settled`). The panel names a space that is exactly this
  headset's own floor (`sharedOwn`: the default one, the first headset, or not
  joined) and shows the browser's version; the log has the page address.
  Every headset sends its Quest Browser version with its presence (`bv`):
  the people lists show it, and the panel warns when another headset here
  runs another version (`versionNote`; two versions never shared a space).
  The page drops `index.html` from its address on load, so every headset has
  the same address for the same page (one shared space per page address).
  Such a space is the first headset's (its origin is the space's) or, when
  someone here had already published for its id, or another headset here was
  aligned through a space of that id (`alignedHere`: presence carries `sp`, the
  space id, and `al`, `'adopted'` or `'shared'`), as the id appeared
  (`R.firstHere` false), not joined: then nothing is taken or published
  through it (`notInIt`), not even this headset's own frame from before, a
  frame held so far stays, and after 2 s the panel says so ("Not in the
  others' shared space"). Why: a Quest 3 that left AR and entered it again got
  its space back under the same id but as its own floor, while the other's
  stayed where it was; it took its own earlier frame through the new space and
  stood the room elsewhere (both Quest Browser 152). Both judgements are made
  once a session per space id (`R.firstFor`, `R.ownFor`): Re-align, the space
  asked for again after waking, or an id flicking to a default space and back
  never re-judge the first headset (its space is its own floor too, and the
  others are aligned through it by then). Presence says `al` only while a
  headset has joined. Once judged its own floor (within 2 cm and 1.5 degrees),
  a space stays so while within 15 cm and 2 degrees (such spaces drifted up to
  8 cm; a judgement flapping at 2 cm let the room through). Known limits: a
  headset judged not joined stays so for the session even when the others
  leave, and two headsets that both came back in spaces of their own are both
  not joined; restarting both browsers (one after the other) or calibrating
  both on tape is the way out, and the panel says so. A frame for the id from someone
  who has left may be last time's (the id stayed the same across sessions and
  days): every headset waits 8 s before taking it, and the first headset then
  replaces it with its own space. A frame someone here published for another
  space id means the others are elsewhere (`othersElsewhere`): this headset's
  own space then never becomes the room (not joined, calibrate).
- Standby with the shared space in use (an adopted frame, or the space's own
  origin): one headset was offset after waking in a test, and one of two after
  a night's standby. The frame the floor's resets carried over holds
  (`R.wakeHold`, only after a wake the session reported) until the
  shared space agrees with it again (10 cm and 3 degrees along the floor, not
  in the first 3 s while the resets come in; `wakeOK`): right after waking the
  space gave the head's pose, and after a night it may come back made again
  under the same id (around the headset that woke first). A space that still
  disagrees once settled (20 s) and still for 5 s: this headset's own
  publication is written into it again as
  held (not into a space that is just its own floor: nobody else is known to
  be in it); someone else's is followed only when written since this headset
  fell asleep (`p` in the frame, FORMAT networks-7; its writer writes it again
  once settled after waking, `R.refresh`) or when the floor moved with no
  transform (`R.blind`), never through a space that is just this headset's own
  floor; a headset still held once settled asks the writer once to write it
  again (`q.frame`, answered only when the writer can write it now). A headset
  still outside the others' space 15 s after waking asks for it once more. The height comes back from the space (`R.hS`; a jump of more
  than 30 cm keeps the room's height), since the floor came back 12 to 17 cm
  off after waking. A session that begins before the room's members are known
  (a socket not yet back after a night) waits up to 8 s before taking someone's
  frame. (Two rules from this round were taken out again after two Quest 3s
  could not align: a reset of the floor with no wake before it started a hold
  too, and another headset in the room since earlier counted as someone here,
  so a headset first in the shared space but later in the room never became
  the room.) Why: no logs
  of the night; two independent readings of the code found that the headset
  that woke second would follow last night's frame through a space made again
  around the other, which matches what was seen.
- Off and on again (the session hidden, then visible: sleep, the system menu)
  the origin moves under the frame (manual calibration lined two Quest 3s up,
  but switching one off and on left it "totally off"). Quest Browser says how
  with `reset` events of `local-floor` (two on waking) whose `transform`
  carries points from the old coordinates into the new ones (not the other
  way, as the spec reads: applied inverted it turned the room -126 instead of
  +126 degrees; applied this way it matched a fresh calibration on the same
  tape within 1 to 1.5 cm), and whose height is the head's change, not the
  floor's: `floorReset` uses only its turn about the vertical and its move
  along the floor. Anchors made in the session were not tracked again after a
  sleep: a woken calibrated headset keeps its frame (moved by the reset), waits
  up to 5 s for its anchors (`afterWake`), then looks for them again by their
  saved handles (they put the frame back on the marks) and shows the orange
  crosses for 30 s ("Check the spots"; in AR in a room with spots, since v119, the
  check by eye's question instead, which every wake asks: "The room setup guide").
  Not found (after 5 and 15 minutes
  asleep two Quest 3s did not find them, and did once AR was entered again), it
  looks again every 10 s for two minutes, then every minute up to ten
  (`restore`, `retryDue`; "Spots found again"); a retry does not hold the room
  in 'restoring', and a calibration from last time not found at session start
  is looked for the same way. Waking never drops a calibration
  (asking to calibrate after every wake was worse). Not found after waking
  (`lostMarks`, `R.reenter`, log `marks lost`; in a test after a standby twenty tries over ten minutes failed and a new
  AR session found them at once), and likewise after a reset without a
  transform or a jump of the origin while the anchors are not held but their
  handles are saved: the calibration is kept, its anchors are looked for again
  (at once, then on the retries' schedule; only a calibration with no saved handles asks to calibrate again), the
  headset still counts as lined up (`lineUp`), the Debug tab's line says *Your own marks (looking for their anchors
  again)*, and in AR in a room with spots the check by eye asks (`eyeWant('lost')`). Until v124 a notice and the panel
  asked to leave AR and enter it again; the owner, 8 November 2026: "The leave ar message after standby or resume can
  go away, alignment nearly always good and has a check now too". Re-align that finds no spots says *Spots not found*:
  the headset keeps looking, and to calibrate again if the orange crosses are off the two spots.
- The browser's store of saved anchors can be full ("Maximum number of
  anchors reached!": one Quest 3 refused every handle with 9 listed for the
  site, another saved with 11, so the limit is not simply per site). At
  session start `HOST.anchor` deletes saved anchors nobody here knows
  (`session.persistentAnchors` minus the placement's and `HOST.room.handles()`)
  and the room logs what that did (`anchors tidied`); a handle refused as full
  is asked once more after deleting again (`handlesAgain`,
  `HOST.anchor.handle(a)`); if it is still refused the marks hold for this
  session only and the panel says a restart will ask to calibrate. Meta's
  docs: 8 persistent anchors per site, deleted with the site's browsing
  history; the browser's author: a limited set across all sites. Clearing the
  browser's data is the remedy (not confirmed on our headsets).
- Calibrating: the two spots are tape crosses on the floor (v122), touched with
  the controller pointing down, its tip on the floor; a mark is where the
  controller's ray origin was held still 70 to
  260 ms before the trigger (a bright ring shows that point), at least 50 cm
  apart; a second pull within 0.6 s is ignored; spots more than 4 cm apart in
  height go back to spot A (how high spot A is over this headset's floor is
  never limited) (above: "The room's floor is under the marks"). Orange
  crosses show the marks where this headset puts them (while the headset's menu
  is open, and 30 s after aligning). The panel's room section also shows the
  shared space's id and *Forget calibration* (`HOST.room.forget()`, press
  twice: this room's place only, v130). Anchor requests carry the marks' generation (`R.mgen`), so ones that
  settle after Forget or new marks are thrown away; a handle the browser
  refuses is logged with its reason. Every 10 s a headset in a room sends its
  log (alignment samples every 5 s) to the relay (`POST /api/log`, kept in
  `relay/logs/` with `--lan` or `--logs`). While aligned and at its station,
  `HOST.anchor.frame()` returns the station's rig pose (spot at 1.6 m over the
  room's floor, facing its way, `room: true`), `held()` is true and
  `locked(kind)` is true (in a room it is anyway); `HOST.audio.zone()` pans the
  narration from the station (full volume within 1.5 m, so at the station's
  spot; nothing changes outside a room).
- Areas: more tape crosses in one room (v131, "areas" in `shared.js`, after `claimFloor`; the owner, 10 November 2026,
  after trying v130's places: "Multiple rooms ... work in general, but rooms are not autojoined, there is a message about
  it after exiting ar and entering in a new room, i think i would prefer one room that can have multiple anchors so that
  people stay in the same one and there are just multiple spots where things can line up again"; asked, tape crosses in
  every area, measured once and shared by every headset). One shared room, one room frame, several pairs of crosses on
  its floor. Arrange all still lays its rows out in front of you, so in rooms side by side its rows may reach through a
  wall: place circles by hand there.
  - Spots A and B stay as ever (the room's key `rm`, the room's origin and floor). Each extra area is a key of its own,
    `rp.<id>` = `{ name, n, a, b, d, base: { d, at }, by, at }` (`AREA`, `areaIn`, `areaList`): `n` its number for its
    letters (`areaLetters`: 2 is C and D, 3 E and F...; the lowest free), `a` and `b` its two crosses in room coordinates
    as a lined-up headset took them: where the controller's target-ray origin was held still with its tip on each cross,
    so their `y` is the touch height over the room's floor (the area's floor as the room has it, plus `FLOOR_TIP`); `d`
    their distance along the floor; `base` spots A and B's `d` and taping time when it was measured (`rmBase`: `rm.t`,
    kept by `claimFloor` while the same spots are written again, else `rm.at`), so spots A and B taped again make the area
    stale (`areaStale`: the guide and the Debug tab say *measure again*, the map draws it dim). Forgotten by a tombstone
    `{ gone: true, by, at }` (the relay deletes only `st.*` and `pose.*`). At most 8 areas, spots A and B among them. Ids
    are 8 letters and digits (`AREA_ID`).
  - Adding one (`areaAdd`, `areaAsk`, `areaTake`, `areaWrite`; the room setup guide's fifth page, *Areas*, *Add spots for
    another area*): a headset lined up by its own spots (`own()`: its marks or their anchors; or the PC's trackers, `areaFrom`: one lined up
    through the shared space keeps its own floor, which would go into the new crosses' heights; the page says to calibrate
    first) names it (the shell's keypad,
    *Area 2*, *Area 3*...), then touches its two crosses with the controller's tip on the floor (`steady`, taken into room
    coordinates as a check is; the tip mode's target kind `area`); refused as a calibration's spots are (less than 50 cm
    apart, more than `SPOTS_DH` in height); a pair within 30 cm of spots A and B is refused (*These are spots A and B*), of
    an area's offers *Replace* (its tombstone and the new key in one batch; this headset's place at the old crosses goes
    at once with its anchors unless it lines up from it now, then at its next session). That headset makes its own place there from
    the same touches at once (`areaAnchors`: its two anchors made in the next frame, measured for its `yb`, let go; the
    survey finds them by their handles). The log's `area added` says the area's floor over the room's (`floor`: how far the
    room's frame drifted over the walk there, or a real step).
  - Calibrating on area k (`calibrate(k)`, `R.calib.k`; the guide's Line up has *Calibrate on: Lab (C and D)* while the
    room has areas, cycling through them, the area found where you stand first, `guidePk`; the Areas page has *Calibrate
    here* per area): the touches are fitted to the area's room points (`fitFrame`: turned about the vertical so the area's
    A to B lies along the touches, its origin where that puts the room's when the area's first cross is at the first
    touch, the room's floor as far under it as the area's first cross is over the room's floor: both touch heights, so
    `FLOOR_TIP` cancels and this headset's own floor at the area does not count); a touched distance more than `SAME` (10
    cm) from the area's is refused in words (*These crosses are 1.5 m apart; Lab's C and D are 2.0 m*). `claimFloor` only
    for spots A and B. What a calibration puts in the room is `{ k, A, B }` (`mkA`, `mkOf`: the area's id, '' spots A and
    B, and its crosses in room coordinates), `R.mk`; `roomMk` gives the area this headset lines up from, else the room's
    area nearest its head; `spotsOf(k)` a given area's; the legacy `[height of A, A to B, height of B]` is kept for spots A
    and B wherever it is read (`HOST.room.marks`, `guide().spots`, a published frame's `m`); an area's goes as `{ k, a, b }`
    (`mkOut`, `mkIn`).
  - Checking an area: the guide's Check page checks the area this headset lines up from (*Check at C*, *Check at D*; the
    buttons keep their ids `guide:selfA` and `guide:selfB`), its Areas page every area's (`guide:acheck:<id>:a`, `b`), so a
    second headset lined up elsewhere confirms an area measured. A check's area rides on presence (`lu.pk`, beside `ck`
    `'a'` or `'b'` for older readers): the pages' list says *at spot C* and *Lab's spots*.
  - What is drawn: the crosses of the area this headset lines up from (or the nearest, lined up by another source) at
    their room points, a sign over them with the area's name and letters while the room has areas (`OV.markName`); the
    check by eye's beams and arrows say the area's letters (`MKL`, *C 1.3 m*); the pages' room map draws every area's
    crosses with their letters and names.
  - Two headsets lined up by different areas' crosses are never compared through the shared space (`compare`: their
    frames differ by the room's drift between the areas, not by the space): logged (`compare across areas`), no split.
  - The PC's trackers line up on any area (the dialog's area picker: `trk.m.k`, and that area's floor points `ra`, `rb`,
    which `relay/trackers.mjs`'s `frameOf` fits as `fitFrame` does), and camera mode too (its overlay's *Spots: C and D*
    button while it lines up, `CAM.pk`).
  - The Debug tab lists the room's areas (letters, name, who measured it, *stale: measure again*) with *Forget area* (two
    presses: its tombstone; every headset's places there go at its next session). `HOST.collab.areas()`, `areaAdd(name)`,
    `areaPick(id)`, `areaWrite()`, `areaForget(id)` and `areaStop()` are for tests.
  - Untested on a headset: the room's drift over the walk between areas (the log's `area added` floor, a later check at
    the area's crosses), whether a Quest finds an area's anchors as it walks in mid-session or only at a session's start,
    a multi-room Space Setup, whether an anchor's own turn is kept exactly across sessions (a place gone down to one
    anchor rests on it), adding an area and calibrating on one with real controllers.
- Places: a calibration kept per room (v130, `PLC` and "places, kept" and "where this headset is" in `shared.js`; the
  owner, 10 November 2026: "Would it be possible to have multiple anchor points like the calibration points are now so
  that i can do multiple rooms and it aligns itself in each of them with the points?", then, of one shared room per
  physical room, "ok sounds good, lets start with a and also add an option to only use one anchor per room if possible
  for a max of 8 rooms"). One shared room per physical room, each calibrated on its own spots.
  - Since v131 a place is per area too ("Areas" above): `roomFrames` = `{ v: 4, places: [{ code, pair, rid, a, b, at,
    used, anchors, n, f, yb, ra, rb, base, an }] }` (`pair` the area's id, '' spots A and B; `ra` and `rb` a copy of the
    area's room points and `base` of its base, so a place survives the area changed meanwhile; `an` its name; `yb` B's
    turn from A in anchor A's own frame: anchor A is made turned towards B, and `yb` is measured from the anchors' live
    poses the first time both are tracked and fit, `ybLearn`, also for a v130 place, which had none, and for a place not in
    use by the survey finding both its anchors, their distance its marks' within 5 cm, `surveyMeasure`, log `place yb`
    with `by: 'survey'`; a v130 place made with
    one anchor has 0). A v3 place reads as spots A and B's. `placeOf(code, pair)`; `placeTake` takes this room's most
    recently used place (any area's). A place whose area has its tombstone, or whose `base` no longer matches `rm`, is
    stale: dropped at the next session in that room (`placesStale`, once the room's keys are in; the Debug tab says
    *Dropped: room ABC's Lab*). Before v131: a place was a calibration made in a room, kept per room code: `localStorage` `roomFrames` = `{ v: 3, one, places:
    [{ code, rid, a, b, at, used, anchors, n, f }] }`, most recently used first (`a` and `b` the marks in local-floor
    coordinates as touched, `at` when, `used` when it last lined this headset up, `anchors` the handles, `n` one or two,
    `f` floor spots, `rid` the room's own id, so a place never joins another room given its code). `R.saved` is the
    place of the room joined now (`placeTake`, from `HOST.room.joined`; `placeLeave` as the room is left), so lining
    up, waking, Re-align, the floor spots, `claimFloor`, publishing for the shared space and the guide's cases work as
    before inside a room. A calibration in a room makes or replaces that room's place (its old anchors deleted); the
    others stay. A calibration whose anchors are not made (yet), or were refused, holds for the session and is not
    stored. Forget calibration forgets this room's place only. An older `roomFrame` (v2: one calibration, no room) is
    kept as a place with no code, taken by the first room this headset lines up in with it (its anchors found there:
    `placeUsed`, log `place taken`); the key `roomFrame` goes. `HOST.room.handles()` gives every place's anchors, so
    `HOST.anchor`'s tidy-up keeps them. A camera keeps no places. Nothing new in the room's keys (`rm` stays per room):
    no `FORMAT` change.
  - The anchor budget (v131, `placesFit`, in place of v130's setting *Anchors per room*; the owner, 10 November 2026: "two
    by default until 4 areas, then once a fifth area is opened the first only has one, then the second and so on"): at
    most 8 saved anchors in all places together (every room's and area's), less one while `HOST.anchor` keeps a placement
    of its own (Anchor: on). A new place gets two; while the total would pass the cap, the places made first (by `at`,
    never the new one) go down to anchor A alone, one at a time (B's anchor deleted; its direction from then on from
    anchor A's turn plus `yb`, `spotB`), so with four places of two a fifth takes the first two down to one (1 + 1 + 2 + 2
    + 2 = 8); one whose `yb` is not known yet is dropped instead; past that (every older place on one already) the place
    used least recently is dropped with its anchors. A notice names what changed (*Older places on one anchor*, *Older
    places dropped*; log `places fitted` with `down` and `dropped`). The Debug tab says the budget in a line. A place on
    one anchor is as v130's one-anchor places were: Before v131, Anchors per room (this headset's own, `roomFrames.one`; the Debug tab's *Anchors per room: two* / *one*, a note
    beside it): two (the default, the most accurate: at spot A and spot B, positions only) or one, at spot A, made turned
    about the vertical so its x axis lies level towards spot B (`yawTo`): found again, the room's origin is the floor
    under its position (the floor spots' rule) and x its turn's x axis made level, spot B that far along it at the marks'
    height difference (`spotB`, in `anchorsAt`, so everything downstream sees two marks). It applies to calibrations from
    then on; a place keeps how it was made. One anchor's turn is steadied (the review of v130: a wobble of its turn would
    turn the whole room about spot A, 2 degrees being 35 cm at 10 m): `oneYaw` takes the mean of its readings over the
    last 3 s (`ONE`), a reading more than 2 degrees from that mean starting it afresh (a real turn: local-floor moved
    without a reset event), the window starting afresh with new anchors and after a reset; `followAnchors` turns the room
    for one anchor only past 0.57 degrees (two anchors: 0.29). The alignment samples log the window's size and spread
    (`one`: how much a Quest's anchor turn wobbles, for tuning). A new anchor whose turn the browser did not keep as asked
    fails its check (spot B more than 5 cm off: `anchorsFit`) and the calibration holds for that session only. Limits (`placeCap`): at most 8 saved anchors in all places together (Meta
    documents 8 per site; one Quest 3 refused a 9th), less one while `HOST.anchor` keeps a placement of its own (Anchor:
    on): 4 rooms with two anchors, 8 (7) with one. A calibration that would pass it drops the places used least
    recently, their anchors deleted, with a notice naming them (*Older places dropped*, log `places dropped`).
  - Where this headset is (`placesStep`, from the shell's tick, in a headset session in a room or in none, AR or VR: an
    anchor found means the headset is there). Every place's spot A is looked for by its first anchor (never the room
    joined now's: `restore` does that), at the session's start, after a wake, while this headset is not lined up by its
    own place's anchors (every 10 s for two minutes, then every minute up to ten, then every 2 minutes) and every 2
    minutes otherwise; each find waits 10 s at most (`SV.wait`: a promise that never settles must not pile up), the
    anchors found are measured over a few frames (tracked, with a pose, 3 s at most) and deleted. Of the places found,
    the one whose spot A is nearest the head along the floor, within 10 m (`SV.near`), is where this headset is
    (`PLC.here`; since v131 the survey looks for this room's other areas' places too, `PLC.hereArea` the area found: one
    found nearer by 2 m while this room's own is further than 4 m or not tracked is taken in its place, `areaSwitch`, no
    join, never while calibrating or adding an area: lined up from it, `src` `'anchor'`, the log's `area switch` with how
    far the room moved in cm and degrees, and the check by eye asks, why `area`; the cross-room offer shows only while
    this room has no area found where the headset stands). Another room than the one joined now: in no room, or in one joined by itself (a rejoin, or a place
    before: `C.auto`, `C.byPlace`), it joins that room by itself (`join(code, 'place', rid)`, checked by the room's own
    id as a rejoin is; the room left is not marked left on purpose), answers *In this room* for it (unless *Somewhere else* was answered for that room: kept, the Debug tab changes it), says so (*Room ABC:
    You are in its place, so this headset joined it*), lines up from its marks at once and the check by eye asks (why
    `place`), unless the room joined now holds (below); in a room joined by hand, or into a room left on purpose (or
    whose code is another room's now), never by itself: the Debug tab offers *Join ABC: you are standing in its place*
    (a join by hand, which since v131 counts as joined by its place: `C.byPlace`, so a later move is by itself) and a notice says so once a session. Never while calibrating. The room joined now holds (`ownState`,
    `placeDecide`; the review of v130: never leave a room the headset may well be standing in because another room's
    anchor answered first), and the other room is then offered only:
    - while its own place's first answer since the join, the session's start or a wake is not in (20 s at most,
      `SV.grace`; `restore` finds it, `R.tries` counts its misses): the decision waits (`place wait`) and the places are
      looked for again once it is in;
    - while its own place's spot A is known (its anchors held and tracked within the last 3 s, checked or not yet) within
      10 m, or the other room's spot A is not nearer by 2 m (`SV.margin`): two rooms side by side never flip;
    - while its own place lined this headset up as it went off and is not found since the wake (`SV.wokeIn`,
      `placesWoke`, from the session's visibility: a Quest loses anchors after standby, which is no move; a headset
      carried to another room while asleep is offered that room);
    - while its own place is not found and the other room's spot A is further than 4 m (`SV.sure`: its not being found
      is no proof the headset is elsewhere);
    - while its marks were touched there this session, unless its spot A is further than 10 m.
    A room with no place of its own here holds nothing. Logs: `places looked for`, `places found`, `place wait`, `place
    held` (with why: `lost`, `gone`, `here`), `place here`, `place join`.
  - The Debug tab's *Places* rows: the offer; *Places on this headset: n*, each place's room (*in use* for this room's,
    *you are in it* for the one found where you stand), one or two anchors (or *this session only*) and when it was
    calibrated, with *Forget* (two presses; this room's is Forget calibration; an area's place by `placeforget:ABC|<id>`);
    the budget's line (v131, in place of *Anchors per room*), the places dropped as stale, and the room's areas with
    *Forget area*. `HOST.room.places(o)` (`{ list, cap, anchors, here, hereArea, offer, current, pair, surveys, res, own,
    waiting, wokeIn, dropped }`; `o.reset`, `reload`, `out`, `forget`, `look`, `wait`, `near`, `join`) is for tests.
  - Untested on a headset: whether a Quest finds a room's anchors when it walks in during a session or only at a
    session's start; a multi-room Space Setup (one scan over several rooms, or one per room); whether a persistent
    anchor keeps its turn exactly from one session to the next (one anchor per room rests on it: a turn restored a
    degree or two off turns the room about spot A, which steadying cannot see; the check by eye asks at each session's
    start and after a wake, and two anchors per room stay the default); how much a Quest's anchor turn wobbles (the
    samples' `one` will say); how far apart two rooms' places must be for the nearest to win, and whether 4 m and the 2 m
    margin suit real rooms; the cost of looking for 8 anchors every 10 s on a Quest.
- The explore view at a station (`st.<id>.view`, `{ v, story }`): headsets at the station share
  it (`viewSync`, every frame from the shell's tick: one turned here goes out while it changes frame by frame, at most
  every 66 ms with `ts` and `h: 1`, and once more without `h` when it rests; one that came at once here, after a flight
  (`collab.view()` is null while the camera flies), goes out plain; someone else's turn is put exactly where their
  samples say it was `SMOOTH.DELAY` ago, every frame, through `collab.setView(v, true)`, and nothing goes out
  meanwhile, so nothing applied from the room is written back; once it has landed where they let go and shows so here,
  turns made here go out again; a view from the room without `ts` glides in, the story's 0.25 s glide), so the scene
  stands turned and sized alike for everyone there; screens following the station keep their own camera.
- Others' moves, smooth (the owner, 30 October 2026: "can you interpolate movements that others are doing in
  multiplayer to smooth them out? like i was standing inside a large network and my colleague spun that and it was a
  bit jerky on my side"; then "make it smooth"). Snapshot interpolation, as games do it (`SMOOTH`, `BUF`, `RT`,
  `bufPush`, `bufAt`, `MIX`, `smoothIn` in `shared.js`). Before, each new value (ten a second, the view five) started
  a glide from where the thing stood, so a steady spin sped up and slowed down at every arrival, and inside a large
  network a small step of a spin is a big jump at its far side. Now every write of a move by hand (a station's
  scene, panel and explore view, a station carried by the grip) and every presence carries `ts`, the relay's time
  (`now()`, whole ms) when it was written, and, while still held, `h: 1`; held writes go out at most every 66 ms (15
  a second, `SMOOTH.SEND`). Each device keeps the last 8 samples of every thing someone else moves (a gap of more
  than 1 s starts it again, as do a station reached, its story changed, a welcome, and a value without `ts`) and draws
  it where it was `SMOOTH.DELAY` (120 ms: two send intervals and a little, so the next sample is nearly always there
  already, even one 25 ms late) before the relay's time now, between the two samples around that moment: places in
  a straight line, sizes geometrically, turns by slerp (the shortest way), yaws by the shortest angle, a view
  component by component (its angles, in degrees in [-180, 180), unwrapped where they cross the seam). A new move
  starts from where the thing is shown (a sample there one send interval before its first). Past the last sample a
  held thing carries on as it went for at most 100 ms (`CARRY`: a late sample), then holds; a sample without `h` is
  where it was let go, and it lands exactly there (stamped no later than the last held one, as by a clock measured
  again meanwhile, it takes that one's place rather than being dropped as late), and once landed its samples are done
  with (the room's value from then on). A grip here (on the scene, the panel, or a station carried) drops the samples
  of someone else's move of the same thing, so letting go never pulls it back to where they left it. A view landed is
  what the story shows here, never a turn made here, even if it reads a little differently (`VW.here`). The render time (`RT`) runs on by each frame's own time and is
  eased towards the relay's clock less `DELAY` by at most 2 ms a frame, so a new measure of the relay's clock never
  jolts what moves. With nothing newer than 1 s (`LIVE`) plus `DELAY` the old behaviour returns: the glide to the
  room's value, a station just reached put at once, and a value from a write by hand (Arrange all, the map, a view
  after a flight) with no `ts` glides as before. Echo suppression and every "changed?" check compare a moving
  thing's value without `ts` and `h`; the rest and the letting go are forced writes (the same place again). A held
  move is neither logged nor redraws the page's dialog (it changes nothing the dialog says; the room map follows it
  from the pump). Known limit: moves carried inside a story's `collab.state()` (the pass story's school, `sea`, and
  the design room's miniatures) are not smoothed: they still come with the five-a-second state poll and the story's
  own glide. How smooth it feels can only be judged on headsets (untested there); the test is `node tools/collab.mjs
  --smooth`.
- The relay (`relay/server.mjs`) keeps per room a map key -> `{ v, seq, by }`
  (every stored write takes the next seq; the last writer wins), the members,
  and passes on ephemeral `fx` messages (presence, effects) without storing
  them. `null` deletes only `st.*` and `pose.*` keys; giving a station another
  story drops its `st.<id>.*` keys in the same seq. For now it runs on a machine
  on the same Wi-Fi as the headsets and serves the app itself
  (`node relay/server.mjs --lan`, see `relay/README.md`); GitHub Pages serves
  everything else, and a copy there can join a relay elsewhere with `&relay=`.
  The test place (v116; the owner, 5 November 2026: "the main page will stay on
  github pages, deployed from main and works as it always worked and i will add the
  dev branch with a hook to the app1 on coolify that is at stories.lab.lbi-netmed.com
  and saves models to cloudflare r2", and the main site "does not need a hosted relay
  for now ... a good place to test the peer to peer functionality"; `relay/README.md`,
  "The test place on Coolify"): the main site is GitHub Pages from `main` at
  `https://stories.lbi-netmed.com/` (its `CNAME`); the owner's Coolify runs branch
  `dev` at `https://stories.lab.lbi-netmed.com/` (every name under
  `lab.lbi-netmed.com` points at the Coolify server with a wildcard certificate),
  served by its relay, with the studio's scenes in R2 and a webhook deploying every
  push to `dev`, and since v120 (the owner, 6 November 2026) branch `main` as well,
  as the main site's relay at `https://main.lab.lbi-netmed.com/` (a clone of the test
  place's resource with its domain, branch and `R2_PREFIX` changed:
  `--proxy 1 --public --scenes r2` and a password), which the main site offers.
  Work goes to `dev` first, then `main` once the owner has tried it. A page can offer a relay of its own (`HOME_RELAY` in
  `shared.js`, keyed by the page's host, so never this machine, a LAN or the tests,
  where `HOST.collab.homeRelay(url)` offers one): while no relay is in use there
  (`homeOffer`), the Shared dialog has *The relay* (a password field, `homeTry`) and
  the headset menu's Circles tab a *Relay password* row opening the keypad page; the
  password accepted (there, or in *This relay needs its password* after a 401 of the
  studio's, which asks the offered relay for its scenes through `relayFind`), the
  device keeps it and uses that relay from then on (`setRelay`, kept as one typed
  in); without it rooms run peer to peer; *Forget the password*, out of a room, takes
  both off the device and the offer is back. The table has one entry since v120,
  `'stories.lbi-netmed.com': 'https://main.lab.lbi-netmed.com'` (empty from v116 to
  v119, the main site's rooms peer to peer; without the password they still are);
  `--public` allows `https://stories.lbi-netmed.com` (`APP_ORIGIN`), so the main
  relay needs no `--origin`; its test is `node tools/collab.mjs --home`. v114 and v115 had planned
  the main site on Coolify and a test copy on Pages (v115 only reached `dev`).
  On a public server (the owner's Coolify) it runs with `--public` (3 November
  2026; `RELAY_ARGS="--proxy 1 --public"` in its environment; `relay/README.md`,
  "Public hosting on Coolify"): only the app's pages and its own may open a
  socket or use the API (`--origin`), no list of open rooms and no member's name
  in any answer or log line (`GET /api/rooms` is `[]`, `/api/ping` says
  `unlisted: true`), per address at most 30 lookups of unknown codes a minute
  (then any code is refused: 429, or on a socket `error` `limit`, close 4429;
  4029 until v109, and the app takes both), 10 new rooms a minute and 64 sockets
  (`busy`, 4429), every room together 64 MB, and logs only with a token
  (`X-Log-Token`; the app sends none). Off unless asked: a laptop at an event
  runs as before. A room's version (the app's `FORMAT`, given as it is made or by its first hello) moves on to a newer
  `networks-<n>` from a newcomer once nobody of its own version is connected, or while a reload order names it, and
  never back (v136, `takeOver`; "Updating a room" below); `--keep <file>` keeps every room in a file across restarts.
- Updating a room (v136; the owner, 11 November 2026: "It needs a: update this room on the relay switch that just tells
  everyone to reload, after updates rooms otherwise get lost sometimes"; `relay/README.md`, "Rooms across updates"). Why
  rooms were lost: a room's version is the app's `FORMAT` (it changed in 12 of the 24 releases from v112 to v131) and never
  changed once made; a deploy restarts the relay (1001), the pages still running the old app came back within a second and
  made the room again under the old version (`revive`), and every device that took the update was refused (4006) and
  stopped trying, for as long as the room lived (6 hours after it emptied); peer to peer the room's id names the version,
  so the first updated device hosted a second room. Owner's decisions: anyone in the room may press, never refused by
  either lock, never a camera; the relay moves a room on by itself; pages take a format update by themselves in a room
  (the countdown under "Hot reload and live updates"); `--keep` implemented, off by default; after a reload a headset's
  check by eye asks as for any new session; peer to peer does not look for a host on the previous format's id (a gap).
  No `FORMAT` change: nothing stored changes shape (the studio lane's bump to networks-42 in v136 is its own).
  - The relay (`relay/server.mjs`): a newcomer of a newer `networks-<m>` takes a room of `networks-<n>` once no other
    connected member has said hello with the room's version, or while a reload order named that version (2 minutes);
    then the members still on the old one get the relay's own order and are refused (4006), so their own live updates ask
    them: an app that obeys orders (its hello says `reload: 1`, this release on) 12 s after it was first told
    (`ORDER_GRACE`: the order, else the move), at least 3 s after the move, so never before its turn (up to 8 s); an older
    app, which ignores the order, 3 s after the move (the review of v136: all were refused 3 s after the first newcomer,
    and a device whose turn came later reloaded at once on a page or was asked in a headset mid-countdown, losing the
    stagger); an older newcomer is refused (4006, its words naming the room's version: `the room runs version
    networks-42`); other versions only the same; the log `XYZ version networks-41 -> networks-42`. `/api/ping` says
    `versions: 1` and `reload: true` (and `keep: true` with `--keep`); a taken code's 409 names its `version`. `POST
    /api/rooms/<code>/reload { n, to, shell, from }`: the order `{ t: 'fx', k: 'q.reload', v: { n, to, shell, by: '',
    from, at }, by: '' }` to every member whatever its version, `room.next` = `to` for 2 minutes; 200 `{ ok, members,
    version }`, 404, 400, 405, 429 within 10 s of the last order to the room; the password as every call; the log `XYZ
    reload to networks-42 (n members)`, no names. `--keep <file>`: every room's code, app, version, seq, keys and when it
    was last occupied written atomically (a temporary file renamed) every 5 s when something changed and as the relay
    stops (SIGTERM), read back as it starts (expired rooms and keys a write would refuse left out; a file that cannot be
    read kept aside as `.bad`), and for 2 minutes after the start the file looked at every second, another relay's write
    taken (a rolling update: a room missing here, or one nobody changed here since it was read, its members reconnecting).
  - Waiting or reloading (`shared.js`, `versionRefused`, `movedOn`): the welcome's `version` is kept (`C.roomVer`, also
    from the refusal's words and a revive's 409). Refused (4006) by an older room: status `older`, the note *Room XYZ
    still runs version networks-41 on a device that has not updated: joining as soon as it has.*, tried again every 3 s
    (`C.want` kept; the welcome then keeps `older` until the relay takes it in, its members saying so, so the note does
    not flicker), given up after 2 minutes on a relay whose ping lacks `versions` (each try would keep the old room from
    expiring: `capsGet`). By a newer room: status `newer`, `HOST.live.roomNewer` (above); log `room newer`; but while a
    reload order counts down here (`RL.pend`) it reloads in its turn as it was going to, neither at once nor asked in a
    headset (log `room newer: reloading in turn`, the note *... this device reloads in its turn.*), falling back to
    `roomNewer` if that reload has not come 40 s after its turn (`room newer: no reload in turn`). Another
    version that is not `networks-<n>`: refused, *the devices need the same release*. The connection line says *waiting
    for a device on an older version* or *this device needs the update*. Rooms on this network list rooms of other
    versions too, marked *older: it updates as you join* or *newer: this device needs the update* (peer to peer the
    slots name the format, so only the same). Kept copies (`collabRoom.<code>`) say their format, `f`, and `locLoad` and a
    welcome from an older room run `MIGRATE` (`{ 'networks-<n>': keys => keys }`, empty: every bump so far only added
    fields and keys).
  - The switch (*Update the room*; *Reload this device* in a room on this device): the page's Shared dialog under the
    room's code (`data-sh="reload"`, with a line saying what it does; also while `older`), the headset menu's Circles tab
    under the room's heading (`room:reload`, with the same line) and the update bar's and panel's *Reload every device*.
    Two presses (the first arms it for 3 s: *Reload every device? Press again*), anyone in the room, never refused by
    either lock (it moves nothing, as `look`, `near` and `trk`), never from a camera (`reloadCan`); one order a room every
    20 s from here (a second press is dropped and logged). The presser (`roomUpdate`): `version.json` (3 s at most) for
    `to` (its `format`) and `shell` (`{ n, id }`; else this device's), its own copy written (`locFlush`), then on a relay
    `GET /api/rooms/<code>` (404: the relay lost it, so `revive` first and its welcome waited for, 6 s at most) and the
    endpoint (an older relay: the order as the effect `q.reload` in the room; a 429: another order is out, nothing more);
    peer to peer the effect `q.reload`, which the host's hub passes to every member; a room on this device its other tabs
    (`localStorage` `collabReload`, the `storage` event). The order: `{ n: rid(8), to, shell, by, name, at }`, never
    stored, so no `FORMAT` change; an older app ignores the key. The presser obeys its own last (its rank the number of
    other members).
  - Obeying (`reloadIn`, `reloadGo`): skipped (logged `room reload skipped`) when its `n` was seen in this tab
    (`sessionStorage` `roomReloadSeen`, the last 8), one is under way, this device obeyed one in the last 30 s, its `at`
    is more than 2 minutes from the relay's time, or a camera follows nothing; this device's own as the relay sends it back
    (`RL.mine`). The order of reloading: the members by when they came into the room (the relay's `since`), then by id,
    the presser left out: 0.4 s, then 0.5 s more for each, at most 8 s, a headset session at least 3 s (about 1 MB
    gzipped a device: ten together on one router can pass the service worker's 4 s fallback). A headset says *This
    headset reloads in 3 s. Then press Enter VR to continue.* (a notice), a page the toast *Updating the room: reloading
    in n s.*. Then its copy written, `sessionStorage` `roomReload` = `{ code, n, to, shell, live, zone, from, at, tries,
    rank, wait }` and `HOST.live.reload('room')` (livePlace as ever: the story, mode, clock, explore state, view, the
    station or person followed, a headset's *Enter VR to continue*); a studio upload, conversion, save or recording under
    way first (30 s at most). It comes back by the room's code in its address.
  - Back (`reloadBack`, first in `HOST.collab.boot`, before anything joins): the shell checked against the order's (the
    same id, or a newer `n`); not (the service worker's old cache after 4 s or a network error): once more, its
    `livePlace` put back, twice at most (`room reload again`), then the bar's note *This device could not fetch the new
    version: reload it by hand.*; log `room reload back { n, from, to, ok, ms }`. A headset's next session in that room
    within 10 minutes keeps the station it was at (`reloadKeep`: `choose(live, 'reload')`, log `station kept after the
    reload`; the room not in yet: as its welcome comes; not the room's arc, which `arcStep` takes), instead of dropping it
    as every new session does; then `roomReload` goes. Alignment comes back as for any session (marks by their anchors,
    places, the check by eye).
  - Peer to peer: each device that gets the order lets go of the old id as it reloads (`pagehide`) and claims the new
    version's; the first back hosts from its copy (written as it went), the rest link to it, so the room does not split
    as long as every device got the order. Not yet: a newer device finding no host on the new id does not look on the
    old id to send it the order; a straggler that missed it stays on the old id until its own live update reloads it.
  - For tests: `HOST.collab.roomReload` (`{ ask(why), now(why), armed(), label(), can() }`), `reloadIn(v, by)`,
    `reloadState()`, `reloadTest(fn)` (fn(order) in place of the reload), `reloadClear()` and `format`; `HOST.live.roomNewer(code)`,
    `HOST.live.times(...)`. Untested on real devices: *Enter VR to continue* after an order on a Quest, the timings over
    real Wi-Fi with ten headsets and the service worker's 4 s fallback there, `--keep` on Coolify's volume through a
    rolling deploy, frozen tabs on Android.
- The relay's password (v110; the owner, 3 November 2026: "i would like to add a
  secret to the relay like how this project does it: menchelab/asdf10k-collab-backend
  ... like one word like networksofthefuture2037 that i can use and enter on each
  client if i want it to be able to use the relay, no other way to use it"):
  `COLLAB_TOKEN` in the relay's environment (or `--token`, also in `RELAY_ARGS`;
  empty or unset: none, everything as before), asdf10k-collab-backend's scheme
  (`relay/README.md`, "The shared password" and "Compared with
  asdf10k-collab-backend", which lists what matches and what does not for a later
  merge; `COLLAB_PORT` and `COLLAB_HOST` set `--port` and `--host` too). Needed for
  everything but `GET /api/health` (`{ ok, protocol, rooms }`) and the app's own
  files (a page must load to ask for it): the API as `Authorization: Bearer` or
  `?token=` (401 `{"error":"missing or wrong token"}`), the room's socket and
  `/api/watch` as `?token=` (the protocol's `error` `token`, then close 4401,
  before anything of a room), the introduction server as PeerJS's key (its default
  `peerjs` refused; `INVALID-KEY`, 4401). Compared in constant time. 20 wrong
  passwords a minute from one address, then 429 or close 4429 (none at all,
  PeerJS's default key and an unknown room code asked with the password are
  refused or answered but not counted: pages ask before they know it, and after a
  relay restart every device behind one router brings its rooms back). Never in a log
  line or file. In the app (`shared.js`, `AUTH`, `tokenFor`, `authSaw`,
  `authTry`, `authForget`): each device enters it once, kept per relay origin in
  `localStorage` `relayTokens` (`{ origin: password }`), never in a room's keys, a
  link, the address or a log (`log` strips any it knows, `?token=`, `key=` and
  `Bearer`); sent with every relay call (`api()`, `connect()`, `detect()`, the
  headsets' log, PeerJS's `key` when the introduction server is that relay's,
  `HOST.live`'s ping and `/api/watch`, the `p2p/` page). A relay that wants it (a
  401, a socket closed 4401) is not unreachable: the room meant for it waits
  (`C.status` `'auth'`), never peer to peer or on this device, nothing is joined by
  itself, and the relay is asked at most once a minute (`authWait`) until one is
  given. The page's Shared dialog shows *This relay needs its password* (a
  password field and Use; *That is not this relay's password*; a kept one the
  relay no longer takes is dropped and asked for again), *Forget the password* in
  its relay part; the headset menu's Circles tab a *Relay password* row (in a room
  and with none), which opens a keypad page as the code's (`passPage`, `PNL.pass`:
  the 26 lower-case letters and the ten digits, Delete, Use greyed while empty,
  Back). It is case-sensitive, so the owner's word is lower-case letters and
  digits. Accepted once a call with it succeeds: the room that waited starts or
  joins. Untested on a headset and on Coolify.
- The studio's scenes on the relay (v111; the owner, 3 November 2026: "the relay idea sounds good, then i can run a
  relay and serve the fbx and glb files from that and also save the json files directly"; the reference is
  `relay/README.md`, "Your own scenes (the studio)" and "Uploading (the upload page)"). `--scenes <dir>` (or
  `COLLAB_SCENES`, or inside `RELAY_ARGS`): each subfolder of `<dir>` is a scene (a name of up to 64 letters, digits,
  spaces and `_ . -`, not starting with a space, `.` or `-`, and not `watch`; others left out and said once in the
  log), its files up to 4 folders deep, at most 2,000 listed (dot files, `.history/`, temporary files and the scene's
  own `layout.json` and `files.json` left out; the rules in `relay/scenes.mjs`; v120: a model's picture for the studio's
  Add pane, `previews/<the model's path>.jpg`, listed and told with the kind `preview`, never `image`, anything else in
  `previews/` `other`, and `previews/` left out first past 2,000; an upload or copy there takes only such a `.jpg` of at
  most 200 KB, `.../put` signing its size, 413 *a picture in previews/ is at most 200 KB*, and `Previews/` in any other
  case is refused, 400: where case is ignored, Windows and macOS, it is that same folder; v125: a recorded path kept as a
  file, `recordings/<name>.json`, listed and told with the kind `recording`, served as JSON, at most 4 MB (and
  `--max-upload`), stored in R2 and signed as `application/json`; a `.json` anywhere else is refused, 400, and another kind
  in `recordings/` goes by its own rules). `GET /api/scenes` (the scenes, and
  `save`, `upload`, `ffmpeg`, `maxUpload`), `GET /api/scenes/<name>` (its files with their kinds, its parsed `layout`
  and `layoutAt`), `GET /scenes/<name>/<path>` (the file: `ETag`, `no-cache`, 304, byte ranges, CORS; `..`,
  backslashes, NUL, dot files and links out of the scene refused), `POST /api/scenes/<name>/layout` (writes
  `layout.json` whole, the old one copied into `.history/layout-<time>.json`, the newest 20 kept), `GET
  /api/scenes/watch` (Server-Sent Events: `hello`, `scene`, `layout`, `scenes`; the folder looked at every 2 s while
  anyone listens, a change told once it has settled for 0.5 s), uploads (`POST /api/scenes` makes a scene, `POST
  /api/scenes/<name>/file?path=` stores a file, at most `--max-upload` MB (512) counted as it streams, never over a
  file without `replace=1`, written to a temporary dot file and moved into place, nothing left behind on a refusal;
  `POST /api/scenes/<name>/sound?path=` has `ffmpeg` make a long sound a mono MP3 at 96 kbit/s and 44.1 kHz, two at
  once, `--ffmpeg-limit` s each; v118: `POST /api/scenes/<name>/copy` `{ from, path, as?, replace? }` copies one file of
  another scene in, by an upload's path and kind rules, 409 when taken unless `replace`, the source a file its scene lists
  and at most `--max-upload`, written to a temporary dot file and put in place, told on the watch; with R2 the bucket's
  CopyObject, its `x-amz-copy-source` signed, nothing through the relay) and `GET /upload` (302 to `/#studio&upload` when the relay serves the app, else to
  `--app <url>`, by default the `--origin`, else `https://stories.lbi-netmed.com/`, with `&relay=` its own `wss://`
  address; no password needed to be sent on, and the query never passed on). `--scenes-readonly` writes nothing (no
  saving, no uploads: 403; the studio offers *Download layout.json*). `ffmpeg` is looked for once at the start
  (`ffmpeg -version` on the `PATH`; `--ffmpeg <path>` names one, which must run; `--no-ffmpeg` none), and the Docker
  image installs it (`apk add --no-cache ffmpeg`, about 133 MB); without it long sounds are kept as given. With a
  password every scene endpoint and file needs it, exactly as the API (wrong ones counted), and `--public` with
  `--scenes` refuses to start without one (the files are the owner's own work). `/api/ping` says `scenes: true`. In the
  shell (`shared.js`): `HOST.collab.relayFind()` gives the studio its relay, `{ base, token }` (the relay this page
  knows, else the page's own server when `detect()` finds it a relay, asked at most 5 s; `token` the password kept for
  it, '' none) or null, and `HOST.collab.relaySaw(base, status, sent, json)` passes what a studio call answered to
  `authSaw`, so a 401 brings up the shell's own password prompts (the Shared dialog's field, the menu's *Relay
  password* row) and an answer with a new password keeps it; a link `#studio&upload&relay=wss://...` sets the relay as a
  link does before the studio reads its options. Untested behind Coolify's proxy (`X-Forwarded-Proto` for `/upload`'s
  address, big uploads over slow links) and on Windows (finding `ffmpeg`, placing files by link and rename).
- The studio's scenes in R2 (v114; the owner, 5 November 2026: "we have the coolify server going on hetzner so i guess i
  will use that and the r2, also implement the r2 things right away"; the reference is `relay/README.md`, "Scenes in
  Cloudflare R2"). The relay keeps running on Coolify; with `--scenes r2` (or `COLLAB_SCENES=r2`, or in `RELAY_ARGS`) the
  scenes' files (models, textures, sounds, each `layout.json` and its `.history/`) live in a Cloudflare R2 bucket instead
  of a folder; the rooms never touch it. The bucket and its keys come only from the environment (`R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`; optional `R2_PREFIX`, `R2_JURISDICTION` (`eu`: the endpoint
  `<account>.eu.r2.cloudflarestorage.com`), `R2_LINK_TTL` (12 h), `R2_POLL` (5 s), `R2_ENDPOINT` (tests)): missing or
  wrong ones stop the start with a sentence naming them (never a value), and the start lists the bucket (a sentence for
  refused keys, no bucket, an address that is no one's; a bucket that only does not answer now, a 5xx, 408, 429 or no
  answer, does not stop it: the relay starts, its rooms never need the bucket, the scenes answer 502 and it is asked
  again after 5 s and then every 30 s, `R2UP`), checks its CORS rule as a browser meets it (preflights) and tries an
  upload link as a page gets one (`r2PutCheck`: a PUT with its type, length and `If-None-Match` signed on a hidden
  `.put-check-*` object, removed again; refused, links sign only their type and `.../done` checks the size; both
  refused, `direct: false`; `If-None-Match` ignored is said); `--r2-check` does both and stops. Every scene endpoint goes through one store with two backends (`KEPT` in `server.mjs`: the folder's and
  R2's), so the rules (`relay/scenes.mjs`: `scenesOf` applies the listing rules to object keys) and answers are the
  same. With R2: `GET /api/scenes` adds `store: 'r2'`, `direct` and `linkTtl`; a scene's listing gives each file a
  signed GET (`url`, dated from the hour or the file's own time, so it stays the same for an hour and a changed file gets
  a new one), which the studio fetches straight from the bucket, from its own origin (`fileUrl`), and reads again once
  half its life has passed by the wall clock (every minute, when the page shows again, before a fetch) and after the
  bucket refuses one (403 or no answer: `linksAgain` in `call`; a streamed sound's element that fails gets a new one);
  `GET /scenes/...` is a 302 to one (no-store, CORS); a save copies the old layout into `.history/` (none when the
  newest copy is it already), puts the new one, and only then deletes past 20 (a save the bucket refuses answers 502 and
  costs no history); uploads go through the relay as before (received into its temporary folder, then put whole,
  `If-None-Match: *` unless `replace=1`; at most three at once, a fourth 429 with `Retry-After`) or straight into the
  bucket (`POST .../put` gives a signed PUT with its type, length and `If-None-Match` signed, or its type alone when the
  bucket refused the others at the start; `POST .../done` checks it and tells the watch, and removes an object past
  `--max-upload` only when a link of its own without its length signed brought it); the studio's Upload pane, Convert to
  GLB and texture buttons use them when `direct` (`tools/studio/engine/e7c_direct.js`), and send a file the bucket
  refuses (no answer, 400, 403, 501) through the relay, as every one after it on that page (`directOff`, `upVia` waiting
  on 429); `.../sound?from=<path>` makes the MP3 from a file already in
  the bucket (the studio sends a long sound's original straight there first); the watch lists the bucket every
  `R2_POLL` s while a page listens and tells a change at once (no settling: an object lands whole); a scene made empty
  keeps a hidden marker, `.scene`. R2's unexpected answers become 502s of ours (one retry for a 5xx or no answer; a PUT
  refused as `If-None-Match` says, 412 or 409, on its second try is taken as its own when the object's MD5 is what was
  sent); no key or signed link in any log line. A file with a signed link needs no password; with a folder the studio
  sends the password as a header, but in the address (`?token=`) for the loaders and sound elements, as before, and for
  a file of an R2 relay without a link (its redirect to another origin would drop a header). `tools/studio/r2sync.mjs`
  pulls scenes onto a laptop before an event and pushes them back (only what differs; a file newer where it would go
  kept and said unless `--force`; a `layout.json` replaced on either side copied first into that side's `.history/`;
  `--dry`, `--delete`, `--history`). No `FORMAT` change. Untested until tried with a real bucket: the signatures and CORS against R2 itself
  (`Origin: null` after the redirect from another origin, signed `If-None-Match` and `Content-Length` on PUTs: the
  start's check says, and both sides fall back; whether R2's 403s carry CORS headers), the EU endpoint, Quest Browser
  fetching and streaming signed links (and new ones after a night asleep), big uploads straight to R2, the costs in
  practice (a listing is a Class A operation per 1,000 objects: `R2_POLL=15` or more for a big bucket with a page left
  open).
- The shell wraps the story's `APP.seek`, `togglePlay`, `enterExplore` and
  `enterStory` to publish the clock, polls `collab.state()` five times a second
  and publishes it when its value changed; a value from the room goes through
  `collab.apply()`, merged per top-level field with controls changed here
  that the room has not yet acknowledged (so two people changing different
  controls at once both keep theirs). A story never publishes anything itself
  except effects.
  A page following a station (Follow) leaves its Stories screen: while that
  shows, nothing syncs.

The hooks every story keeps (all sixteen, the same lines; the flock is the
reference, `tools/flock/engine/`):

- `collab: { APP, scene: () => (LOAD.done ? GL.scene : null), state, apply, view, setView, effect, hover, panel, place }`
  in its returned object (`scene()` is null until the story is all built, so the shell attaches to it, applies the
  room's clock and state and hangs its overlay only then): `APP` is its own clock object, `effect(type, data, by)`
  plays a one-shot effect another person caused (without sending it again; `by`, since v103, is their member id as the
  relay or the host says, which a story trusts over anything in the data),
  `hover(i)` is how far controller i's ray reaches now (or 0), `panel(p, yaw, q)`
  puts the story panel where another person moved it (upright at `yaw`, or
  held at the turn `q` while free moving is on), `place(o, s, q)` the scene
  (`XR.globeOff`, `XR.size` and, free moving on, its turn `XR.rot`; `q` an
  array or null, null meaning no turn); `xrPose()` also returns `s` (the size),
  `held` (what grips hold: `'globe'`, `'panel'`, joined by spaces), `rot` (the
  scene's turn, `XR.rot`), `pq` (the panel's quaternion) and `pr` worked out
  from it (`yawOf`); `xrAdopt` takes `rot` and `pq` across a story change. `view()` is the scene's
  view in explore mode (`orbit.cur`, rounded; the longitude or azimuth
  normalised), which in a headset turns and sizes the scene in the room, or
  null (story mode, or while it flies somewhere); `setView(v, now)` glides there in
  0.25 s (`orbit.fast`), or with `now` (someone else turning it, smoothed by the shell) puts `orbit.cur` there at once
  (its angle unwrapped as for the glide; `orbit.to` null), the same lines in all sixteen (the flock, the robots and
  the design room take the argument and set nothing). The flock and the robots are life size in a headset:
  their `view()` is always null. While a headset stands at its station the
  explore sway rests (`HOST.room.placing()`).
- Two helpers next to `xrSig`:
  `const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());`
  (a headset in a shared room: no Stories screen) and
  `const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());`
  (away from any station: in no circle yet this session, the story hidden and
  paused; walked out of its circle a headset keeps its station, so it is not
  away); a shell without `HOST.room.away` gives the old behaviour.
- Moving with the sticks (v125), the line after `xrSig`:
  `const xrWalking = () => !!(HOST.xr && HOST.xr.walking && HOST.xr.walking());` (the shell moves this headset with the
  sticks in VR: "Moving with the sticks" under "Four headset settings"); in `xrPoint` the explore view's spin and zoom by
  the stick waits on it, and since v132 on a spaceship flying with that controller,
  `if (APP.mode === 'explore' && !c.press && !c.grab && !xrWalking() && !(HOST.ships && HOST.ships.claims(c.src)))`, while a carried scene's
  reach by its stick in `carry` does not (its grip is held, so the shell leaves that stick to the story). The studio
  switches its own sticks with it and moves you itself while it is on (`sticks: { say(on), note }` in its returned
  object: "The studio's two stick modes"). No story reads A or X (`buttons[4]`) since v125.
- The All stories circle's lines (v104), after `xrAway`:
  `const xrCards = () => !!(HOST.room && HOST.room.cards && HOST.room.cards());` and
  `const xrAllHere = () => !!(HOST.room && HOST.room.allHere && HOST.room.allHere());`; `xrSig` ends with
  `+ (xrAllHere() ? 'A' : '')` (the panel redraws with its Stories button); in `xrBegin`, before the room's line that
  closes the Stories screen, `if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }`
  and that line becomes `if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();`
  (the cards close once a story is picked there or the headset walks into another circle); after the controllers
  `if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }`; the landing card's region
  `fn: () => (here && !xrCards() ? xrLandingClose() : HOST.go(s.key))` and the Stories pane's
  `if (here && !xrCards()) XR.stories = false; else HOST.go(k);` (the story on show's card picks it there, through
  `HOST.start` and `allPick`); the header's *Back to the story* and the pane's *Back* not drawn while `xrCards()`; and in
  `drawMain`, after the room's Stories line,
  `else if (xrAllHere() && !XR.stories) hb('stories', 'Stories', () => HOST.room.allBack(), 130);`. The smoke test checks
  the lines are in all sixteen stories and every page in `STORY_EXTRA` (the design room, the studio).
- Recenter, next to `xrRecenter` (the story panel's Recenter button, and `recenter: xrRecenterAsk,` in the returned
  object after `caption`, for the menu's Recenter and Place again):
  `function xrRecenterAsk() { if (HOST.room && HOST.room.recenter && HOST.room.placing && HOST.room.placing()) return HOST.room.recenter(); if (HOST.anchor.on) HOST.anchor.again(); XR.needRecenter = true; return true; }`
  (at a station the station's scene and panel go back where the story puts them, for everyone at its circle; else you
  in front of it again; a shell without `HOST.room.recenter` gives the old behaviour).
- The caption hook for the shell's subtitles, next to `xrAway`:
  `const xrCaption = () => { ... }` (null in explore mode, on the Stories
  screen and away from a station; else `{ s, end, els, narrT }`: the story time
  now, the chapter on show's end, its cues as `ST.items` keeps them, each
  `{ el, at, out }` in story time, and `narrT` to the clock's time), and
  `caption: xrCaption,` in the returned object, after `inputs`. The shell does
  the reading, splitting, timing and drawing; a story without it (the design
  room) simply has no subtitles.
- The panels hook for the menu's Story tab, after `recenter` in the returned object:
  `panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),` (each panel with its `tex`, `w`
  and `h`; the shell draws their textures, the story keeps drawing them every frame whether they show or not).
- `xrPoint`: after raycasting its own panels (`hs`),
  `const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);`;
  a hit (`kind: 'shell'`: the shell's menu, the other stations' cards and
  rings, calibration marks) is nearer than the story's panels and is the hover
  instead of them and of the scene, except a hit on the menu's Story tab's copy
  of one of the story's panels (`sh.panel`, `'main'` or `'foot'`), which becomes
  a hit on that panel of the story's own at the same point:
  `if (sh && sh.panel && XR[sh.panel]) { const P = XR[sh.panel]; hit = { kind: 'panel', P, x: sh.u * P.w, y: (1 - sh.v) * P.h, point: sh.point, menu: true }; dist = sh.dist; }`
  before `else if (sh)`; then `else if (xrAway()) hit = null;`
  (nothing of the story to point at). `xrPress`:
  `if (h.kind === 'shell') { HOST.collab.press(c.i); return; }`.
- `xrGrab`: `if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return;` (in a
  shared room only at its station and unless its story is locked; the shell's
  own things never move the scene, the grip on a station's preview moves
  that station and the grip on the menu, its Story tab too, moves the menu, done by the shell); `carry` lets go when that turns locked, and
  a controller that disappears lets go too.
- `xrBegin`, after setting the rig from `HOST.anchor.frame()`:
  `const roomOnly = xrRoomOnly(); if (XR.inRoom && !roomOnly) xrFreshStart(); XR.inRoom = roomOnly;`
  and `if (XR.stories && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();`
  (no Stories screen in a room; at a station the story is the station's;
  leaving the room brings the Stories screen back); after the controllers,
  `if (xrAway()) { APP.playing = false; SLIDE.tail = null; }` (paused and
  silent away from its station; never published: the shell has no live
  station then). The scene's offset and size at a station come from the room
  (`placeSync`), not from before.
- `xrUpdate`: `const land = !!XR.stories, away = xrAway();`, the story panels
  `const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';` (`XR.main`
  `pv && pm === 'shown'`, `XR.foot` `pv && pm !== 'hidden'`: panels per story; the cards' mode, not the labels') and
  `GL.world.visible = !land && !away;`.
- Away a second, the frame idles (v136; the lobby diagnosis: the story left loaded went on working out its hidden scene,
  0.1 to 0.45 ms a frame here, the pass story's fish the most, and three.js walked the hidden `GL.world`'s matrices):
  `if (xrIdle(xr, dt)) return;` right after `if (xr) xrBegin(xrFrame, dt);` in `frame`, and `xrIdle` beside `xrAway`
  (with `_xrNoWalk`), the same lines in all sixteen, the design room and the studio. While `xrAway()` holds it counts the
  time away (`XR.awayT`); after a second (the frames meanwhile are full ones, so `xrUpdate` has hidden the scene, the
  panels and the labels and every fade is done: the studio's emitters fade out over 0.4 s) the frame does only xrBegin
  (the rays at the shell's things, its presses), `audioSync()` (the narration kept quiet) and the render: no sets, no
  state or camera, no labels, no `panelTick`, no sound cues. Meanwhile `GL.world.updateMatrixWorld` is a no-op of its own
  (`_xrNoWalk`, deleted again on the first frame back, when the session ends or away no longer holds), so three.js does
  not walk the hidden world (it recurses into invisible groups). Back at a station the first frame is a full one; a live
  simulation (the flock, the robots, the pass story's fish) goes on from where it was, a station's flock and school
  joining their leader as on any arrival. The smoke test's `away idle` steps check the lines in every story and page and
  drive a hand-written story, one built from sets and the flock through it.
- `xrEnterScene`: `XR.inRoom = xrRoomOnly(); const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;`.
- `xrEnded`: `const away = xrAway();` first, and
  `if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }`.
- The panel footer: `if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', ...)`;
  `xrResize` and the two-hand branch at the top of `carry`; `XR.size` in
  `xrPlace` (scene stories), `xrRecenter` and `xrAdopt`.
- The session asked for through the shell: `session = await (HOST.xr.request ? HOST.xr.request(mode) : navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));` (v119; AR asks for `'shared'` and depth sensing; VR does not).
- `xrFreshStart`: `if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }`: a
  headset taken off in a room keeps its story and place (no Stories screen
  for a new wearer); at a station the room's clock and state go on applying.
- `xrLandingClose`: `if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);`
  and `if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;`: closing
  a Stories screen in a room never restarts or plays the story (at a station
  it runs on the station's clock).
- The sound effects' lines (not a shared-room hook, but they keep a station's
  devices in step): the block after the slideshow block with `SLIDE.from`, the
  two lines in `frame()`, the click and hover lines in `xrRelease` and
  `xrPoint` (see "Sounds inside the stories" under "Sound effects"). Each
  device plays its own cues off the station's clock: nothing is sent.
- `HOST.collab.effect(type, data)` where the story itself causes a one-shot
  effect.

What each story shares:

| Story | `state()` | Effects |
| --- | --- | --- |
| airports, proteins | tab, colour, pillars, routes (to 0.05), hubs by, community level, closure mode and count, closed items, selection, path (items by airport code or gene symbol) | none |
| spatial | tab, colour, cell, routes, selection and its copy, path, community level, moves (a 0/1 string), bait and its labelling radius | none |
| lbi | tab, scene, every control of that scene, selected protein, route | none |
| nmd | tab, scene, every scene's controls, group, gene, picked endotypes, layers knocked out, your genes, the walk (its start and result, the same on every device), walkers, colour, grid, z-scores | none |
| endo | tab, scene, every scene's controls (synapse, network, tree, motor unit), endotype, gene, k (the seed-group step), method step (standing in the gap stays per device) | none |
| pet | tab, scene, every scene's controls (scanner, body, organs, liver), the comparison (a Table 2 row), network, organ (life size stays per device) | none |
| micro | tab, scene, every scene's controls (body, section, atlas, network), organ, domain, age, method step | none |
| ovary | tab, scene, every scene's controls (ovary: view, show; section: view, with By kind, show; never their Age steps), the kind of object picked, the age (20 to 70), the method (`rf` or `seg`) | none |
| qubits | tab, scene, every scene's controls (pairs; cube: view, network, cut, bits, algebra; chart: view, example, angles), the brick shown (a Pauli string by name), how many strings are added up, the gallery (kinds or largest) | none |
| mutation | tab, scene, every scene's controls (letters: view, letter or mix; rule: view, rule, start and parent letters; tree: view, tree, how fast letters change, machines; stem: view, numbers (the authors' test or this example), method), the branch length (`time`, to the hundredth), the read-outs and their seed, the branch picked, the pair favour (`w`), the rebuild's seed (never the camera or how far the read-outs have played) | none |
| topo | tab, scene, every scene's controls (the liver: lifted out, in the body or a slice; the slide: tissue, look, one scale; the tower: view, what is lit; the cohort: view, pieces or loops; the map: show, 50 or 100 µm), the patch's radius (`r`, µm to the hundredth), a cell's network radius (`mr`), the slide picked (`slide`, -1 none), the window of radii (`from`, `to`, on the 0.5 µm grid; `to` 100.5 is "and above"), the cell picked (`cell`, -1 the poster's cell v) | none |
| soil | tab, scene, every scene's controls (the soil block: view, fertiliser, wheat, DCD; the field: view, date, measure, wheat line, regime; the microbes: view, colour, split by), the module picked (`mod`, -1 none), the threshold (`rho`, to the hundredth), the shuffle (`shuf`, 0 or 1), the kind picked (`kind`, a cloud index, -1 none), the group of plots picked (`plot`, line * 3 + regime, -1 none) | none |
| pass | tab, scene, every scene's controls but the fish's view (the fish: neighbours watched, links, shark now and then; the globe: view, colour, pillars, outbreak on; the cell: view, organelles, colour, move), the school's size, the outbreak's start (an airport's code) and settings (incubation, infectious days, spread, flights cut), the city looked up, the protein picked, the school's place at a station (`sea`, moved with the grip there) (never the language, the outbreak's day, the steered shark or the sea moved outside a room) | `shark` (a passing one, as the flock's falcon, in the set's frame), `school` (quiet, twice a second, as the flock's `flock`), `fishes` (quiet, three times a second from the leader: every fish, as the flock's `birds`), `steered` (quiet, about 15 times a second while someone is the shark: their own shark, see the pass story's notes) |
| flock | birds, links, falcon | `falcon` (where it starts, its velocity and aim, in the set's frame; up to four in the air), `flock` (quiet, twice a second: where the flock is, see the flock's notes), `birds` (quiet, three times a second from the leader while anyone else is there: every bird, about 2.4 KB for 200) |
| robots | rule, robots, trails, links | `crumbs` (a pile: in room coordinates in a headset with an aligned frame, else in the station's frame), `dust` |
| design (not a story) | the prop on the stage (`pick`), and one field per miniature moved by hand (its key: `[x, y, z, qx, qy, qz, qw, s]` in the table's frame, mm, 3 decimals, 2 decimals) | none |
| studio (not a story) | the scene's name (`scene`, `''` none) and one field per item, `o.<id>` (an object), `c.<id>` (a trigger cube, with its texture changes `tex` when it has any, v124, and what it starts, `plays`, when it has anything, v136), `s.<id>` (a sound, with what it follows: `on`, `bone`, `o`, and, a voice recorded with a movement, `sync`, `skip`, `len`, v125) or `x.<id>` (a cut-out: the object it cuts, `on`, and its `p`, `q` and `size` in that object's frame) or `g.<id>` (a group: its `name` and `items`, its members' ids) or `p.<id>` (a shape: `shape`, `p`, `q`, `size`, `colour`, `look`) or `e.<id>` (an empty: `p`, `q`); an object's record carries its `faces` when set, and its `tint` and `bright` (v125) when set, an object's, a shape's and an empty's its `motion` (v120) when set, an object's, a shape's, an empty's and a sound's its recorded `path` (its keys, or a recording kept as a file: `src`, `len`, `n`, v125), and an object's, a shape's and an empty's its `behaviour` (v120; a `follow` one's `side` when not in front, v127; a `follow` or `item` one's `face` when set from its card, v128) when set, an object's, a shape's and an empty's the tracker it follows, `trk` `{ id, o, q }` (v126), and an object's who wears it, `puppet` `{ on, rig, by, map, cal, s, floor }` (v126), when set, and any record its `locked` when locked: its record as in `layout.json`, without `id` (an item absent from a state applied is removed there; a bad record is ignored and the item kept; changing the scene clears the items and the device that changed it writes the new scene's saved layout); and `settings` (the scene's: `others`, `real`; absent: a new scene's); never which cubes are active for whom, what a cube has started for whom, editing, the selection, a group's picking, Walk, the stick walk, sound, a cut-out's *Preview*, a recording under way, Pause or *Start again*, or what the lobby made this device forget | `beh` (quiet, about ten times a second from the headset a behaviour reacts to, which drives it: `{ at, b: [[id, tx, tz, d, since], ...] }`, each item's move along the floor and turn from its placed pose in the scene's frame, a last `1` when it stops; the others draw it 120 ms behind: "Behaviours" under "The studio") |

Rules that matter most (from `docs/multiplayer.md`):

- Share outcomes, not events: `state()` is plain JSON of what another person
  must see alike (tab, controls, selection, search, route), and `apply()` sets
  it with the story's own setters so both panels (HTML and canvas) follow.
  Never share the camera, hover, open menus, text being typed, timers, page
  layout, or anything random or per device.
- `state()` must be the same on every device for the same view, and
  `apply(state())` must give the same `state()` back: echoes are suppressed by
  value, so a value that changes when applied goes back and forth for ever.
  `apply()` checks every field, ignores unknown ones and never publishes.
- One-shot effects are ephemeral (`e.<station>`), never stored; their data
  must mean the same on every device (the set's frame, room coordinates).
- Bump `FORMAT` in `shared.js` when the keys or a story's `state()` change
  shape (a room refuses another format).
- `dispose()` clears the story's timers: rooms make quick story changes
  likely, and a late timer that wrote into shared element ids once crashed
  the next story.
- The live simulations run on each device. The robots are not synced (only
  their controls and effects); the flock and the pass story's school follow one
  device at the station, bird by bird and fish by fish (see the flock's notes).
  `HOST.collab.effect(type, data, true)` sends a quiet effect: one sent often,
  kept out of the log on both sides.

Testing: `node relay/test.mjs` and `node tools/collab.mjs` (see Testing). A new
story gets the hooks, then an entry in `STORIES` in `tools/collab.mjs`.
Tried on two Quest 3 headsets in one room several times: in phase 0 neither the
shared space nor the calibration lined them up; the relay's logs of the second
test led to the rules above (own marks win, the floor from the marks); with
both on one Quest Browser version the shared space lined them up, but one was
offset after standby, and one of two after a night's standby (the rules for
waking above); later the two headsets each kept their own copy of the shared
space, and even at a fresh address (`s/<n>/`) the second joined the first's id
8 to 13 m off, while the tape calibrations, found again from their anchors
after a night, lined them up. Not confirmed on headsets yet: whether they line up again after
standby (and a night) now, whether asking for the shared space again (Re-align,
or 15 s after waking) joins the others' space,
how a scene moved, resized or turned at a station looks for the others, people's
name tags in each cards mode, the story panels in 3D in the life-size and
stand-inside views (the labels, the story panels and the station cards in 3D,
hidden, and the grip moving and turning scenes and panels, alone and at a
station, were checked on a Quest 3, 28 October 2026, as one setting; labels and
cards as two independent ones, labels on top by default, are untested there),
persistent anchors restored (one headset's handles were refused; the log now
says why), whether a recentre fires a reset, sound zones heard, comfort and
frame rate with presence drawn, and whether the socket keeps running inside an
immersive session. Peer to peer on real devices (the owner, 29 October 2026):
two laptops found each other on a local network with the test page `p2p/`, and
two laptops were in one peer-to-peer room; not yet tried: headsets and phones in
such a room, links inside VR and AR, a host change and a headset's hand-over at
an event, and how long PeerJS's public server keeps a sleeping host's id. Ten
headsets (the owner, 29 October 2026, main v96 through a local relay on the
owner's computer and one router on site): "everything worked very well"; the
changes it asked for (stay in your story out of its circle, rings only in a
circle with a card on pointing, two locks, people at your circle only) are
untested on headsets: how a ring's card reads when pointed at, the story and its
narration heard from out of the circle, the locks and the People toggle in use.

## Vive trackers (`tools/trackers/`, `relay/trackers.mjs`)

Vive Tracker 3.0s in the shared rooms (v126; the owner, 8 November 2026: "we go for 1 and 3 with mixamo rigs for now":
phase 1, trackers in the rooms and props that follow them, and phase 3, a Mixamo character worn by a performer; about
9 to 11 trackers, three base stations, a Windows PC with SteamVR and a Valve Index that also runs the relay). The
contract between the lanes is `tools/trackers/SPEC.md`; setting it up, `tools/trackers/README.md`; the relay's side,
`relay/README.md` ("The PC's Vive trackers").

### The bridge and the relay (v126)

- **The bridge** (`tools/trackers/bridge.py`, Python 3 and pyopenvr, the standard library otherwise; `uv run` it, which
  fetches both by its PEP 723 block and `bridge.py.lock`, or `python` after `pip install openvr`): browsers cannot
  read the trackers, so this reads every device's pose from SteamVR (a background application, the standing universe:
  y up, the floor at 0) about 90 times a second and sends one UDP datagram a reading to `127.0.0.1:<port>` (47800):
  `{ v: 1, t, d: [{ s: <serial>, k: 'trk' | 'hmd' | 'ctl' | 'base', h?: 'l' | 'r', p, q, lv, av, ok, b }] }`, under 8 KB.
  Serial numbers are the ids everywhere. `--list`, `--fake` (made-up devices, no SteamVR), `--seconds`, `--port`,
  `--rate`. `tools/trackers/fake.mjs` is the same in Node for the tests (`startFake({ port, turn, move, devices })`:
  SteamVR's space the room turned and moved by a known transform, so every pose's truth is known).
- **The relay** (`--trackers [port]`, also in `RELAY_ARGS`; `relay/trackers.mjs`; nothing at all without it): takes the
  datagrams on 127.0.0.1 only (bad ones ignored, counted, said in the log at most once a second), keeps each device's
  latest reading with its own time, and answers `/api/ping` (`trackers: true`, `trackersSeen`), `GET /api/trackers` (every
  device raw in SteamVR's space) and `GET /api/trackers/still?id=&ms=` (a tracker's position averaged while it lies still,
  or why not: not seen, lost tracking, moved more than 5 mm), both with the password as the API.
- **Lining up by hand** (the room's key `trk = { on, m: { a, b } | null, names, by, at }`, written by pages and headsets,
  never refused by a lock; since v131 `m` may also carry `k`, an area's id, with `ra` and `rb`, that area's floor points
  in room coordinates as the page wrote them, its crosses less `FLOOR_TIP`: the tracker lay on that area's crosses, and
  `frameOf` fits `a` and `b` to them as a headset's calibration on an area is fitted, "Areas" under "Shared rooms"; the
  dialog has an area picker while the room has areas, `#shTrkArea`, and its spots' buttons say the area's letters): `m`
  holds the two points of a tracker lying on spot A and on spot B in SteamVR's space, and
  the room's frame from them is exactly a headset's from its floor spots (`shared.js`'s `fromMarks` with the floor
  spots' `floorUnder`, and `basis`; `TRK_FLOOR`, the tracker's pose origin over the floor lying on its base, 0 until
  measured, in place of `FLOOR_TIP`): origin the floor under spot A, x level towards spot B, y up. `relay/test.mjs` runs
  `shared.js`'s own code against `relay/trackers.mjs`'s. Reference trackers left on the spots wait for a later round.
- **`@trk`**: to every member of a room whose `trk.on` holds and whose `m` gives a frame, sent by the relay itself
  (`by: ''`, no member's fx rate), at most 60 a second (once a second while the bridge is silent): `{ t: 'fx', k: '@trk',
  v: { at: <relay ms of the newest reading>, l: 'hand', t: [[id, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok, kind], ...] },
  by: '' }` in room coordinates (mm, 4 decimals; `ok` 0 also once a reading is 0.5 s old; `kind` `t`, `h`, `l`, `r`; no
  base stations; a device silent 5 s left out). On but not lined up: `{ at, l: '', t: [] }` once a second. A member
  whose socket holds over 256 KB unsent is skipped. Only rooms on that relay (peer to peer and on a device: none).
- `FORMAT` networks-38 (the room's key `trk`; the studio's records' `trk` and `puppet`).
- Untested until tried on the owner's PC: the bridge with SteamVR and real trackers (pyopenvr's calls, the rate on
  Windows), `TRK_FLOOR`, the lag through the relay, how steady the lining up by hand is.

### The shell (v126, `shared.js`: "the PC's trackers")

- **The room's key `trk`** = `{ on, m: { a: [x, y, z], b: [x, y, z] } | null, names: { <serial>: <name, at most 24
  characters> }, by, at }`: `on`, this room uses the PC's trackers; `m`, the two points (a tracker's raw position in
  SteamVR's standing space) taken with a tracker lying on spot A and on spot B. Written by pages and headsets, never
  refused by either lock; a write keeps the fields it does not change (`setTrk`, also fields of a newer app's). The room's
  frame from `m` is the headsets' frame from floor spots: its origin the floor under spot A, x along the floor towards
  spot B, y up, z = x cross y (a point to the right of the way from A to B has z > 0). The relay works it out; the shell
  keeps the headsets' own as the reference, `HOST.room.fromSpots(a, b, tip)` (`fromMarks` for floor spots: tip `FLOOR_TIP`
  for a controller, `TRK_FLOOR` for a tracker, the tracker's pose origin over the floor lying on its base, 0 until
  measured) and `HOST.room.roomOf(frame, p)` (a point in the spots' own space in room coordinates through it).
- **`@trk`** (the relay's own message to every member of a room whose `trk.on` holds and whose `m` is set, 60 a second,
  `by` ''): `{ at: <the relay's ms of its newest reading>, l: 'hand', t: [[id, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok,
  kind], ...] }` in room coordinates (`kind` `'t'` a tracker, `'h'` the Index, `'l'` and `'r'` its controllers); with
  `trk.on` but no `m`, `{ at, l: '', t: [] }` once a second. Peer-to-peer rooms and rooms on this device get none. The
  shell's own (`onFx`, as `@menu` is), never passed to a story and never taken from a member (only with `by` ''): each
  one's last 8 samples by `at` (`TRK`), drawn at the relay's time now less `TRK.delay` (40 ms, eased as others' moves'
  render time is) between the two samples round that moment (places in a line, turns by slerp), carried on by its velocity
  for at most 100 ms past the last; not heard of for 0.5 s, `ok` false and its last pose kept (one its row says is not
  seen well, held, not carried). A bad row (no id, more than 64 characters, numbers that are not, a place past 10 km) is
  dropped, a late or repeated sample ignored, at most 64 trackers; one not heard of for a minute is forgotten.
- **The API** (`HOST.collab`): `trackers()` (`[{ id, name, kind, p, q, ok, age }]` in room coordinates now), `tracker(id,
  out)` (one, `out` filled in; null never seen), `trk()` (the key read safely with the last `l`, whether the relay has
  trackers, its count, whether this room uses them now, `used`, its status in words), `setTrk({ on, m, names })` and
  `trkName(id, name)`; `body(memberId)` (below). For tests: `trkIn(v, by)` (a `@trk` message through the shell's own
  intake, as the relay sends it; with `by` as a member would, ignored), `trkTime(ms)` (the relay's time held for the
  trackers, and for the Index's history below; `null` live), `trkPing()` (the relay asked now), `trackersShown(on)`,
  `pucks()`, `mapTrackers()`.
- **Pages** (the Shared dialog's *The PC's trackers*, `index.html`'s `.sh-trk`, drawn by `trkRender`): shown while the
  room is on a relay whose `/api/ping` says `trackers: true` (asked as the dialog opens, then every 3 s while it is open
  and every 15 s otherwise). *Use the PC's trackers in this room: on/off* (`trk.on`) with its status (*Not used in this
  room*, *Not lined up yet*, *Lined up by hand (the spots 1.84 m apart): 3 trackers in the room.*, *the relay sees no
  trackers: is the bridge running...*); lining up by hand: the tracker lying on the spot picked from the relay's list,
  *Set spot A* (`GET /api/trackers/still?id=<serial>&ms=1000`: its mean place while still, or the relay's words why not),
  then *Set spot B*, which writes `trk.m` (refused in words: less than 50 cm apart, or more than 4 cm apart in height,
  `SPOTS_DH`, as the headsets' floor spots); the trackers (`GET /api/trackers` twice a second while the dialog is open):
  serial, kind, seen or not, battery, a name typed into `trk.names`, a row that lights for 1.5 s while its tracker moves
  (more than 1 cm since the last look), the base stations counted. The room map draws them as small dots with their names
  while the room uses them.
- **Headsets**: *Trackers: shown / hidden* on the menu's Debug tab (this headset's own, kept as `xrTrackers`, hidden by
  default; a line beside it says how they stand): each tracker (kind `'t'`) a small puck where it is in the room (in the
  room's group, as people are drawn; a 7 cm disc along the tracker's own y, a ring on top that dims while it is not seen,
  its name on a sign turned to you), depth-tested.
- **The Index in the room** (`trkAlign`, `trkHist`, `trkEstimate`): the PC's page in VR with the Index (a browser that is
  not a standalone headset's, `!IS_HEADSET`) lines its room up from its head as the trackers see it (`'h'`, in room
  coordinates) against its own head in its `local-floor` at the same moments (a history of its viewer pose by the relay's
  clock, read from the frame itself: `update` also runs from the story's frame, through `place`, before the shell's tick
  has this frame's head). A level frame, the turn about the vertical from the heading of the two and the place (and the
  floor's height) from the two, over the last second of samples taken while the head is fairly still (at most 0.5 m/s
  and 0.6 rad/s as both see it: a pose WebXR predicts for the display and one the bridge read a moment before differ only
  while it moves), at least 10 of them across 0.3 s; followed past 1 cm or 0.5 degrees. A frame source of its own,
  `'trackers'`, after this headset's own marks and before the shared space; held while the trackers do not see it; while
  they see it and its first samples are still coming, lining up (never *Calibrate the room* meanwhile).
  `lineUp()` says *Lined up by the PC's trackers* (not lined up: *the PC's trackers have lost it* after 3 s); the pages'
  list *lined up (the PC's trackers, not checked yet)*; the startup flow never opens for it, and the menu's question (in this room, or
  elsewhere?) is answered for it while the trackers see it (*In the room*). No spots and no shared space needed. One such page per room: a second PC's browser in VR
  would take the Index's head for its own.
- **A person's head and hands** (`HOST.collab.body(memberId)`, for the studio's puppet worn with a Quest's head and
  hands): `{ head: [x, y, z, qx, qy, qz, qw], hands: [left, right] (each such a pose or null), at }` in room coordinates
  for a member in a headset, smoothed from presence as their figure is drawn, or this headset's own poses now; null for a
  page, a camera or anyone not heard of for 2 s. Presence gained `g`, the grips (or the tracked hands' wrists) as poses,
  `[left, right]` with null where there is none (`gripStep`, each frame of a headset session); its `hands`, the rays
  drawn, were in the order of the story's controller indices (the session's input sources, in no fixed order of hands)
  and are now the left's first. Older devices ignore `g` (a newer device reads none from them: hands null).
- Untested here: SteamVR, real trackers and the Index (what the bridge reads, `TRK_FLOOR`, how a tracker's own frame lies,
  so how the pucks sit), the Index's page in VR in Chrome or Edge through SteamVR's OpenXR (its frame from the trackers,
  whether its viewer pose and the bridge's head pose are the same point, lag through the relay), the pucks' look on a
  headset, a Quest's grips in presence on a real device. Only in headless Chromium with a pretend headset and the relay's
  answers stubbed (`--only trackers`).

### The studio: props on trackers and a character worn with them (v126)

- **The trackers here** (`engine/e6k_trk.js`, `trkStep`, first in `behaveStep` each frame): the shell's
  `HOST.collab.trackers()` (`{ id, name, p, q, ok, k }` in room coordinates; guarded: an older shell gives none), only at a
  studio station, where the scene's frame is the room's (v125: a tracker's room pose is the scene's, nothing turned).
  Each one's last pose is kept per station (`TRK.last`): a tracker not seen holds it; another station starts with none.
- **Props** (phase 1): an object's, a shape's or an empty's record may carry `trk` `{ id, o, q }` (its tracker's serial;
  the item's pose in the tracker's frame, to the mm, turned but not scaled, 4 decimals). Drawn by the pose pipeline's base
  stage (`POSE.base` = `poseBase`: a tracker first, else a behaviour's, `behaveBase`; set only while the scene has
  either), so a path and a motion draw over it and the record never changes; never seen here: where it is placed; it
  rests at its placed pose while held here or paused. The card's *Follows a tracker* (page and headset, editing on):
  *None*, the tracker (a list by the room's names, else serials), *Snap onto it*; choosing keeps it where it stands, None
  leaves it where the tracker had it; one Undo step each, refused while locked in place. A sound may follow it. A copy
  follows no tracker; a GLB switch turns the offset by the baked turn (`switchedRec`).
- **A character worn with trackers** (phase 3; `engine/e6l_puppet.js` with `engine/ik.js`): an object rigged with
  Mixamo's bone names (`IK.rigOf`; others told why on the card) may carry `puppet` `{ on, rig: 'full' | 'feet', by, map,
  cal, s, floor }` (`'head'`, a headset alone, waits). *Wear it: whole body* (6 to 11 trackers) or *feet and headset* (a
  tracker on each foot; the head and hands from the PC's Index, `by` `'index'`, its kinds `'h'`, `'l'`, `'r'` in the
  stream, or from the performer's own headset, `by` their member id: this device's own head and controllers when it is the
  performer, else `HOST.collab.body(by)`, guarded). *Line up with the performer*: a 5 s countdown (this device's own), the
  performer in a T-pose in front of it facing its way; the parts assigned (`IK.assign`), the character moved along the
  floor so its parts at rest are, on average, where their trackers are, sized (`IK.calibrate`, then again at the scale the
  record keeps), one change, one Undo step; *Line up again, these parts*; refused while locked in place; why not in words.
  On and lined up: its own clip off and its bones solved every frame (`IK.solve`, in `itemsStep` in place of `animStep`:
  `pupStep`), alike on every device from the same trackers and record (nothing per bone sent); not solvable now: at rest,
  the card says why; Pause holds it; its holder stays where it is placed (a ghost there while editing); a sound may follow
  its head bone. *Its parts* (another tracker for a part, swapping; then lined up again), *Head and hands from*, *On* /
  *Off*, *Stop wearing*. A copy is worn by nobody; a GLB switch keeps it.
- **Takes**: *Record a take* (on and lined up): a 3 s countdown, the solved bones sampled 30 times a second on the room's
  clock (`pupClock`) until *Stop* or 120 s, made a clip *Take n* (`IK.clipOf`, bound by the bones' names of the model the
  converter reads: `takeInto`) and the object's GLB made again with its clips and the new one through the converter
  (`convertFile` with `take`: with a relay that takes uploads into `models/`, the old one kept under `originals/` when it
  was there already, else every object of the file switched to the new one, a new picture; else downloaded). It plays as
  any clip.
- For tests: `STUDIO.trk(id)`, `STUDIO.puppet(id)`; `pupClock` (a function the tests replace).
- Untested on devices: everything with real trackers, SteamVR and the Index, a Quest's head and hands through
  `HOST.collab.body` (the turns of its hands), how a character looks worn, how a performer's trackers stay on, the lining
  up's placement in practice (a few cm where the trackers' own offsets do not average out, which turns with the
  performer), takes made through a real relay.

## Inside a story (all sixteen follow the same pattern)

- Data at the top (airports and proteins: precomputed constants; spatial: the
  editable `PLACES`, `PROTEINS`, `LINKS`, `TOGETHER`, `MOVES` lists, laid out
  at load time by `LAYOUT`).
- The start runs in steps (`LOAD`, the same lines in every built engine's `e7_app.js`; the hand-written three keep the
  same `loadStep` and `warm` with their own list): `init` (from `setTimeout(init, 40)` as before) lists the steps
  `[label, fn, scene]` and runs them one by one (`loadStep`), calling `HOST.progress` after each; short steps run on
  in one task, and after 40 ms, or a step left half done (a step that returns true runs again), the next runs from a
  timer (not an animation frame: the window's frames stop in a headset). Built stories: `buildScene` (the renderer, scene, lights and stars only), then per set `buildSet(k)`
  and `warm(group)`, then `sceneJoin()` (what joins the sets: the microanatomy story's colours, network and dots, the
  tissue topology story's liver, the design room's plates and first view; empty elsewhere) and `warm(GL.scene)`, then
  the story (`resize`, `buildDefaults`, `buildStory`, labels, timeline), explore mode (`buildExplore`, `bindCanvas`)
  and the panels (`audioInit`, `xrSetup`, `LOAD.done`, then `initEnd`: the old start's rest, listeners, a link's
  place, the frame loop). The hand-written three: `buildScene`, `warm(GL.scene)`, story, explore, panels. `warm`
  compiles each material once (`LOAD.seen`) with the scene's lights, as when drawn (`renderer.compile` on a stand-in
  scene holding the lights and one object without its children), until a slice has taken 50 ms; its floor is one
  shader program (in SwiftShader up to about 0.5 s on a quiet machine, more on a loaded one; three.js r128 cannot use
  `KHR_parallel_shader_compile`). A failure in a step marked `scene` shows that WebGL is missing, as before;
  `dispose` sets `LOAD.gone` and clears `LOAD.t` (also the timer that hides the loading screen 120 ms after the first
  frame, so a story picked meanwhile keeps it). `LOAD.ms` keeps each step's time (`HOST.cur.peek('LOAD.ms')`).
  Nothing else changed: the sets, the first frame, seeking, the clock and the shared-room hooks are as they were.
- `CH` lists chapters with story-time ranges; `buildStory()` writes the panel
  HTML (elements with `data-at` fade in at that second of the chapter) and the
  animation tracks via `ramp()`/`key()` over the names in `DEF`; `storyCam()`
  interpolates camera waypoints. Beside the keys, the story's sound cues
  (`sfxCue`, `sfxHold`; the block after the slideshow block plays them, and
  `sfxLive` in a live simulation's explore part: see "Sounds inside the
  stories" under "Sound effects").
- `NARRATION_SYNC` maps recording time to story time; the narration (if
  present) drives the clock (`audioInit`, `audioSync`, `audioFollow`, thin
  wrappers around `HOST.audio`). `APP.t`, the timeline, `#<key>&t=` and the
  shared rooms' clock run on the recording's time; chapters, `data-at`, labels,
  camera and animation on story time (`storyT`, back with `narrT`; the sweep
  tools take story times). Until a story has a recording the table sets its
  pace: `node tools/pace.mjs <url> [--write] [keys]` writes it from the panel's
  words (each stretch between two cues, a `data-at` element or a chapter's
  start or end, lasts the longer of 1.1 times its story time and the words,
  numbers not counted, that appear at its start read at a rate chosen per story
  so that the whole story reads at the airports' 2.1 words a second; where that
  slows a stretch a lot, a line's 0.6 s fade-in keeps the light pace and the
  rest of the stretch waits, so the text is there at once). Run it again after a story's text changes, then update the lengths
  (`len` in `stories/list.js`, `audio/PUT-narration.mp3-HERE.txt`) and
  `docs/narration.md` (every story has a recording since v109, so this is for a
  new story until it is narrated); the flock's first swoop (flight time, `roost` in its
  set) is timed to its last chapter in its recording. A recorded narration replaces
  the table with its own times (the airports' is): `pace.mjs` leaves a story
  with an MP3 in `audio/` alone. A synthetic narration (`tools/voice/`, every story's but the airports') is laid out from its audio instead:
  each stretch lasts the longer of 1.1 times its story time and its line plus a pause, and a chapter's words end
  before its slideshow stop; after such a story's text changes, run `node tools/voice/narrate.mjs <key>` again (only
  changed lines are spoken again), not `pace.mjs`. A story in two languages (`LANGS` and `setLang(l, false)`, the pass story) is read in
  each, and each stretch takes the reading time of its longer text (by words); `tools/narration.mjs` writes both into
  `docs/narration.md`. Narrated (`tools/voice/narrate.mjs`), it is spoken in each (English by Kokoro, German by Piper)
  and laid out on one timeline: each stretch lasts the longest of 1.1 times its story time and each language's line
  plus its pause (a line one language reads as one and the other as two spans both stretches), `NARRATION_ENDS` is the
  later of the two, and each language has its own recording on that timeline (`audio/narration-<key>.mp3` for the
  first, `audio/narration-<key>-<lang>.mp3` for the others, all of one length), so the clock, the slideshow's stops and
  a station's clock are the same in either. `slideStep` (slideshow, see above)
  runs in `frame()` after the clock moves and before the end check.
- Explore mode: the `X` state object, `exploreStep()`, tab renderers
  (`render*`), and the canvas/pointer handling in `bindCanvas()`.
- WebXR: the `XR` object, controllers (`xrController`, `xrPoint`), canvas-drawn
  panels (`makePanel`, `panelTick` with a signature function so textures only
  redraw on change, `vButton`, `textBlock`). The HTML panel cannot be shown in
  a headset, so every pane exists twice: HTML (`render*`) and canvas (`draw*`).
  Keep both in step when you change one. Story titles and kickers on the
  canvases (the Stories screen's cards, the story panel's header) go through
  `fitTitle`: their own size when they fit, else smaller down to about 0.8 of
  it, then (on the big cards, whose description moves down) two lines split
  where they are most even, else an ellipsis; the shell's station cards
  (`drawCard` in `shared.js`) shrink theirs the same way.
- The screen's framing (`resize()`, `applyCamera`): on a wide screen the camera
  aims past the side panel (`setViewOffset(w, h, -0.14 * w, ...)`, with each
  story's own shifts: FIT's target shift, the tour's `side`), on a narrow one
  above the bottom sheet (`0.21 * h`), and `GL.fit` stands the scene back to
  fit. In focus mode (v106, the shell's `HOST.focus()`: the 3D alone on a phone
  or tablet) `resize()` reads `GL.bare = !!(HOST.focus && HOST.focus());`
  first (the same line in all sixteen, the design room and the studio; the shell sends a
  `resize` when it changes) and then frames the scene for the whole page: no
  sideways offset, its middle at 0.45 of the height
  (`setViewOffset(w, h, 0, 0.05 * h, w, h)`), and `GL.fit` for the page between
  a 48 px top bar and 126 px of bar and subtitles (a scene reaching about 0.95
  of the half height at fit 1, and 1 to the sides; the robots' room 1.05 and
  1.2, the cell map's cell 1.3 wide). Every shift clear of the side panel goes
  back as on a phone (`GL.wide && !GL.bare`: `u` in `applyCamera`, the tour's
  `storyCam` and `sideStep` for its explore views), NARROW still stands wide
  views back on an upright screen, and what framed the strip above the bottom
  sheet is off (LOW, the flock's and the school's lift, the robots' low
  framing). Focus off, every framing is as before.

## The tour (`stories/lbi.js`) is built from sets

`stories/lbi.js` is generated: edit the sources in `tools/lbi/` and run
`node tools/lbi/build.mjs`, never edit the built file by hand, and commit both
(`node tools/lbi/build.mjs --check` tells you if they are out of step). The
set contract (API, rules, performance budget, palette, shared facts) is
`tools/lbi/SPEC.md`; each set has a manifest `tools/lbi/sets/<name>.md`.

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

## The muscle story (`stories/nmd.js`) is built the same way

`stories/nmd.js` is generated like the tour: edit `tools/nmd/` and run
`node tools/nmd/build.mjs` (`--check` as for the tour). It uses the tour's kit
(`tools/lbi/kit.js`) and set contract (`tools/lbi/SPEC.md`); `tools/nmd/SPEC.md`
describes its three sets: `tower` (the multiplex network: 71 layers, the hero
of the story and of explore mode), `motor` (the motor unit, sarcomere and heart)
and `hpc` (the supercomputer and the stress test).

- The data is real: `tools/nmd/data/gen_data.mjs <folder>` reads the authors' files (not in the repository
  since 3 November 2026; `ikerdata/` in its history) and writes `tools/nmd/sets/data.js` (the constant `NMD_DATA`,
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
- The build budget (v136; the sweep found 5 to 10 ms of building a frame in the first seconds of the ovary, microanatomy,
  muscle and endotype stories, each hidden set taking 3 or 4 ms and two at a time): every engine whose sets build between
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
  slice (the harnesses). The jobs yield finely enough for it (v136: the ovary's surface nets after each row of cells and
  its stain every 128 pixels, `ORGAN3D`'s quads a plane at a time and its pictures every 25 triangles; they ran 5 to 15
  ms between yields). How much longer the builds take in wall time on a Quest, and whether a story's set is ready when
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

## The endotype story (`stories/endo.js`) is built the same way

`stories/endo.js` is generated from `tools/endo/` (`node tools/endo/build.mjs`, `--check` as for the tour):
the tour's kit, three sets (`syn`, the neuromuscular junction close up; `net`, the protein network, seeds and
walkers; `tree`, the gene x term matrix, the tree and the endotypes; each with a manifest), the muscle story's
`motor` set (the build gives it the muscle story's disease groups, all it reads of `NMD_DATA`) and engine parts
adapted from the muscle story's. `tools/endo/SPEC.md` is the contract.

- The data: `tools/endo/data/gen_data.py` (Python with EndotypY installed) reads the authors' saved run (their
  protein network, the 35 seed genes, their 12 endotypes) and the Gene Table's CMS genes, and writes
  `tools/endo/sets/data.js` (`ENDO_DATA`, documented in its header). The authors' files stay out of the
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

## The PET story (`stories/pet.js`) is built the same way

`stories/pet.js` is generated from `tools/pet/` (`node tools/pet/build.mjs`, `--check` as for the tour): the tour's
kit and body set (unchanged), organ icons (`sets/icons.js`, `PET_ICONS`), three sets (`scan`, the PET/CT scanner, how
PET sees and the vision row, its stages joined by flowing light; `organs`, segmentation, uptake, the cohort, the
explainer and the paper's networks, drawn in the body set's frame; `liver`, an organ as a network of patches, in
explore mode only; each with a manifest) and engine parts adapted from the endotype story's. `tools/pet/SPEC.md` is the
contract.

- The vision row (the opening, since v104, the owner's wish: "way more 3d", "better colors"): its network is the 14
  organs as the microanatomy story's 3D models (`ORGAN3D`, `tools/micro/sets/organs.js`, included by the build; the bone
  marrow a model of its own there, `marrow`, kept out of that story's 29), lit, each taking on its colour and turning
  slowly, spread in depth and joined by glowing tubes with light running along them, the models built in the load
  before the scanner's set (`SETS.scan.prep`, a slice a step); prognosis is three glass tubes filling with the story's
  cyan light and medication five amber capsule pills rising from a small base (no more neon orange, red and yellow).
  Rebuild the PET story after changing `tools/micro/sets/organs.js` (and the microanatomy and tissue topology stories).
- The paper's networks the same way (v107; the owner, 2 November 2026: "the network scene not yet, also should all be
  the same in explore mode"; no flat glyphs, the organs' names as labels): in the `organs` set, story and explore alike,
  every node is its organ's 3D model (the vision row's models, lit, in its colour, turning slowly, a soft glow behind;
  a hub's takes on orange-yellow), and the bars' feet, the slab's column heads and the panel's axes show small lighter
  copies (`ORGAN3D.lite`, made in `SETS.organs.prep`); about 35k triangles in two draw calls. `PET_ICONS` only draws
  the panes' pictures now (explore's Organs pane, HTML and the headset's canvas).

- The data: `tools/pet/data/gen_data.mjs` (Node) writes `tools/pet/sets/data.js` (`PET_DATA`, documented in its
  header) from the paper's tables (typed in), the two weight matrices printed in its Figure 2A, and
  `tools/pet/data/figures.json`: values read off its Figures 3 and 4 (each read twice independently and reconciled).
  Stand-ins, said so in the story: typical organ uptakes and a synthetic cohort with Figure 2A's partial correlations
  (for explore's matrix and scatter views). The authors' VR viewer (with a patient's scan) is not used: no patient
  data.
- `body` and `organs` share one frame and are shown together.
- The story follows the paper (the network of all scans, then from health to disease); the poster gives its title,
  the vision row and its authors. Its one-scan network, index, survival and immunotherapy results were taken out
  (October 2026: they did not match the poster; with them went the `people` set and explore's One scan and People tabs,
  all in the history; the explore-only `liver` scene went too and came back the same day), and so were the Network chapter's matrix of all scans and its scatter plot (it goes
  straight to the network on the body). On 28 October 2026, after the owner's notes, its last chapter (Vision: the row
  again, prognosis and medication) went too (its credits and Explore button close Health; the row stays in the intro),
  the second chapter became "How PET sees" (FDG as the most common of the tracers; no brackets in its text), the organ
  labels became names only and the AI "segmentation algorithms". The scanner hands its patient to the body set in one
  move (`scan_rise`): the scanner goes, the patient stands up exactly where the body set's body stands (`riseTo`, after
  `buildCamera`'s turn), its glow cools, then the tracer arrives as before. Explore mode plays the same hand-over (the owner, 1 November 2026:
  "better hide the scanner, rotate the body, fade out the organs and then show the sugar thing ... the explore mode does
  not do the same"; back: "play reverse"): picking Body or Organs from the Scanner (`openScene`, `X.hand`, `HAND` in
  `engine/e4_explore.js`) holds the camera 1.5 s while the scanner goes, eases it to the new scene's view as the
  patient stands up and turns (the sets unturned in explore, so `riseTo.yaw` is 0 there: `updateSets`), cools the glow
  and plays the tracer's arrival (6.5 to 15 s; Organs then fade in); the Scanner picked from Body or Organs plays it
  backwards in 6 s (the tracer drains, the image glows, lies down as the camera goes back, the room returns). Only a
  scene picked as such plays it (the Scenes pane, page or headset, and a scene from a shared room once this page has
  taken the room's state, `X.synced`): an organ, a network, a comparison or a tab picked from the Scanner shows at
  once. Picked while another plays, it starts at the moment that matches what shows (`handFrom`), so turning back
  halfway plays back from there. A flight of its own (a view) takes the camera from it; a control changed ends it. Open: the owner finds the text from the
  Network chapter on does not match the poster (the poster is needed to rewrite it; see HANDOVER.md).

## The microanatomy story (`stories/micro.js`) is built the same way

`stories/micro.js` is generated from `tools/micro/` (`node tools/micro/build.mjs`, `--check` as for the tour): the
tour's kit, body and tissue sets (unchanged), small 3D models of the 29 organs (`sets/organs.js`, `ORGAN3D`: signed
distance fields polygonised by surface nets, built between frames from the start, one organ after another, the one on
show first; drawn as meshes on the body, the atlas's plates and the network's organ ring, and as pictures in the
panes, each going in as it is drawn), three sets (`slide`, the method in the tour's visual language over the tissue
section, drawn in its frame: tiles, their features as glowing blocks, a network of neighbours with messages, the lift
into a map where alike tiles gather, and the domains; `atlas`, the slide library of glass slides, in a lit rack, the
atlas of sections as slabs in relief, the tile cloud, the volcano and the trajectories; `hier`, the network of organ
architecture and the domain contacts; each with a manifest) and engine parts adapted from the PET story's.
`tools/micro/SPEC.md` is the contract.

- The data: `tools/micro/data/gen_data.mjs <graphml>` reads Iva Buljan's network of organ architecture (the file stays
  out of the repository) and writes `tools/micro/sets/data.js` (`MICRO_DATA`, documented in its header) with the
  preprint's numbers (typed in) and `tools/micro/data/figures.json` (values read off the talk's figures). The slides,
  sections and tiles are drawn, never the GTEx images.
- `tissue` and `slide` share one frame and are shown together.
- In the Atlas chapter the atlas turns into the network (`atlas_net`, with `hier_grow` keyed at the same times, so each
  node grows as its things arrive): the sections' tiles gather into a bead per domain, the organs fly up to their nodes,
  the sections to their tissues', their beads on to the tissue types' and the domains' (by name; the mapping is in
  `sets/atlas.md`). The network takes the atlas's turn at that hand-over (`MORPH` in `buildCamera`), so they meet exactly.

## The aging ovary story (`stories/ovary.js`) is built the same way

`stories/ovary.js` ("The aging ovary", after the poster "Mapping the histological landscape of human ovarian aging" by
Parijat Chakraborty, Samir Moustafa and André Rendeiro) is generated from `tools/ovary/` (`node tools/ovary/build.mjs`,
`--check` as for the tour): the tour's kit and body set (unchanged), the data and a shared look pasted before the sets
(`OVARY_DATA`, `sets/data.js`, and `OVARY_TREND`, the poster's lines looked up, with `OVARY_LOOK`, `sets/look.js`), three
sets (`organ`, a cut-away ovary built by surface nets between frames, small in the body's pelvis at first, whose
follicles, scars and vessels follow the poster's trend lines with age; `section`, a drawn H&E section in relief with the
four kinds and cysts, a younger and an older one, the tiles, UNI2 features, a grove of decision trees that votes, the
predictions, SegFormer's masks and the illustrative neighbor network, which tips back off the section and gathers into
five hubs by kind joined by bands (`section_lift`, `section_kinds`); `charts`, only the slides stacking into the age
histogram, the one graph, in passing: since v105 twenty towers of slides lying on the floor in a wide arc, age 20 on the
left to 70 on the right, seen from a little above (the owner: the flat one was "hard to see"); each with a manifest) and
engine parts adapted from the microanatomy story's.
`tools/ovary/SPEC.md` is the contract.

- The data: `tools/ovary/data/gen_data.mjs` writes `tools/ovary/sets/data.js` from the poster's numbers (typed in
  exactly) and what the story uses of `tools/ovary/data/figures.json` (values read off its figures by two readers,
  reconciled: the trend lines, the shares of donors with none, the comparison lines' slopes; the bands and axes read
  there are kept but unused). The story draws no trend, comparison or score charts (the owner's rule against 2D
  graphs, October 2026; the Agree? chapter, explore's Charts scene and the illustrative dots went with them): the Age
  chapter is the cut-away ovary aging from 20 to 70 with tags giving each method's count on the poster's lines (read
  off its figures: approximate, the story says so), all r in words and the agreement donor by donor (its "the
  segmentation finds fewer" from the read slopes, said so in the small print); Methods ends with the scores as tags
  on the section's own objects. Of the donors the data holds only their ages (whole years filling the histogram's
  bars, for the Donors chapter's slides). The lines, r and p are the poster's. The network of the last chapter is the
  poster's next step, drawn as an illustration and labelled so throughout. The slides, sections and the ovary are
  drawn, never GTEx images or the poster's pictures.
- `body` and `organ` share one frame (the ovary sits in the body's pelvis before it grows out of it).
- One model out before the next comes in (v105; the owner, 2 November 2026: "two 3d models exactly overlapping which
  leads to z fighting inside the headsets"): the section, the ovary and the donors' slides all stand at the origin, and
  two see-through models in one place flicker in a headset as their drawing order flips with the head. At each change
  of model in the story (Donors to Section, Methods to Age, Age to Next) the old one fades out over 1.2 s and the new one
  in from 1.2 s; explore's `exploreStep` holds a set's fade-in until every set going out is at 0 (one going out also
  drops by 0.6 a second, so it is gone in about half a second); and the older section of the pair comes in from the
  right and behind (`section_pair`), never across the younger one. Since v107 (the owner: "ovary section and more still
  overlaps on transitions") a set writes no depth while it fades (`fadeDepth` in `engine/e2_scene.js`: each material's
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

## The qubits story (`stories/qubits.js`) is built the same way

`stories/qubits.js` is generated from `tools/qubits/` (`node tools/qubits/build.mjs`, `--check` as for the tour): the
tour's kit, three shared parts pasted before the sets (`QMATH`, the maths, `sets/qmath.js`, checked by
`node tools/qubits/test-qmath.mjs`; `QUBITS_DATA`, the real run's numbers typed in from Joel Hancock's brief,
`sets/data.js`; `QLOOK`, the story's lit instanced tubes, rings, balls and halos, `sets/look.js`), three sets (`pairs`,
the grid of pairs, the network as a map with two walkers and its valleys, the chip and the eight neighborhoods;
`cube`, the cuts, the coarse operator A_c on a cube, the Pauli strings as small cubes, added up, and the toolbox;
`chart`, the real run's residual by depth and the six-gate circuit; each with a manifest) and engine parts adapted
from the microanatomy story's. `tools/qubits/SPEC.md` is the contract.

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
- **American spelling in this story** (color, gray, neighborhood, normalized, center; the aging ovary story too), as the brief asks: keep
  it in `tools/qubits/` and its card; the rest of the app stays British.

## The mutation machine (`stories/mutation.js`) is built the same way

`stories/mutation.js` ("The mutation machine", after the poster "Converting Mutation into a Machinery: DNA Substitution
Models as Quantum Circuits" by Enes Berk Sakalli and Arndt von Haeseler, a draft) is generated from `tools/mutation/`
(`node tools/mutation/build.mjs`, `--check` as for the tour): the tour's kit, three shared parts pasted before the sets
(`MMATH`, the maths, `sets/mmath.js`, checked by `node tools/mutation/test-mmath.mjs`; `MUT_DATA`, the poster's numbers
typed in, `sets/data.js`; `MLOOK`, the qubits story's lit instanced tubes, rings, balls, boxes and halos plus letter
tiles, arrowheads, qubit spheres and gears, `sets/look.js`), four sets (`letters`, the DNA helix, the ancestor's eight
letters and two copies with swaps, a letter's two qubits and their read-outs piling up; `tree`, the family tree in 3D,
one machine (a gear) per branch and the poster's species tree; `rule`, a rule of change as balls and arrows, the pyramid
of mixes and the path through it, the compiler, the machine for one branch and its circuit; `stem`, an RNA stem, a pair
breaking, the coupling, the count of combinations and the fields of rebuilt ancestors, drawn in `tree`'s frame; each
with a manifest) and engine parts adapted from the qubits story's. `tools/mutation/SPEC.md` is the contract.

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
- The author's answers (27 Oct 2026) are the story's. The turn: the circuit copies the parent's letter onto the child,
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

## The shape of tissue (`stories/topo.js`) is built the same way

`stories/topo.js` ("The shape of tissue", after the poster "topocyte: scale-resolved topological phenotyping of tissue
architecture across spatial modalities" by Simon Schindler, André Rendeiro and Jörg Menche) is generated from
`tools/topo/` (`node tools/topo/build.mjs`, `--check` as for the tour): the tour's kit, three shared parts pasted before
the sets (`TOPO_DATA`, the authors' numbers, `sets/data.js`, generated; `TDATA`, its decoders and look-ups,
`sets/tdata.js`, checked with the data by `node tools/topo/test-data.mjs`; `TLOOK`, the mutation story's lit tubes,
rings, balls and halos plus glass discs, glass triangles, ribbons, glass slides and cells drawn in H&E or as beads,
`sets/look.js`), the tour's `body` set and the microanatomy story's organ models (`ORGAN3D`, only its liver; both
unchanged), four sets (`slide`, the healthy tile round the poster's patch and the new slide's window drawn in H&E from
their cells, sketches of other modalities, the fixed scales other tools read and the whole slide's overview; `map`, in
`slide`'s frame: one cell's neighbourhood, its own network, bars and score, then every cell scored as a relief, the
two groups and their cell types, and sketches of the next steps; `tower`, the poster's patch: balls growing round 110
cells, the network with triangles, pieces joining and loops opening and closing, the tower of scales and its barcode;
`cohort`, the 123 slides as a rack of glass slides with their curves, the main shapes, the space of scores, the
classifier's wall, the held-out stacks and the weight for every radius on a column of radii; each with a manifest) and
engine parts adapted from the mutation story's. `tools/topo/SPEC.md` is the contract.

- The instance pools send only what changed (v136; the sweep found the tower re-sending 630 KB of instance buffers a
  frame, 31 calls, even paused, and the qubits and mutation stories' pools their whole buffers every frame): `upload` in
  `tools/topo/sets/look.js` (and the same function in `tools/qubits/sets/look.js` and `tools/mutation/sets/look.js`; the
  soil story draws with this look's pools) compares a pool's used range, as 32-bit words, with a copy of what last went
  and sends the stretch from the first change to the last (a range set and not yet sent is merged in, since three.js
  sets its count back to -1 once it has gone), nothing when it is the same: a story paused or at rest uploads nothing,
  one moving sends what moves. The soil field's posts are written only when the netting moves.

- **Every number is topocyte's** (the owner: "use the topocyte code for all calculations").
  `tools/topo/data/gen_data.py` runs the authors' package topocyte and the poster's own figure scripts on the authors'
  GTEx liver cohort (123 slides, 66 healthy and 57 with cirrhosis, 30.8 million cells found by HistoPLUS, CC BY 4.0)
  and writes `tools/topo/sets/data.js` (`TOPO_DATA`, documented in its header): the slides' curves, scores, classifiers
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

## The soil story (`stories/soil.js`) is built the same way

`stories/soil.js` ("Holding on to nitrogen", after the slides "Exploring the Effects of Biological Nitrification
Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by Marina Montserrat Díez, Tadashi Yoshihashi,
Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper,
and their field trial's data; made for the Global Peter Drucker Forum in Vienna, a lay, business audience) is generated
from `tools/soil/` (`node tools/soil/build.mjs`, `--check` as for the tour): the tour's kit, three shared parts pasted
before the sets (`SOIL_DATA`, the trial's numbers, `sets/data.js`, generated; `SDATA`, its decoders and look-ups,
`sets/sdata.js`, checked with the data and the story's key numbers by `node tools/soil/test-data.mjs`; `SLOOK`, the
story's palette and colour rules, `sets/look.js`), the tissue topology story's look (`TLOOK`) and the tour's `web` set
(only its globe), both unchanged, three sets (`soil`, the cut-away block of soil with its wheat: fertiliser, the
nitrogen's flows, a magnified pore with the relay's microbes, the BNI halo round the roots, the wild grass and the piece
of chromosome, one marked atom; `field`, the trial's 24 plots under netting over five dates, the leaves by their
chlorophyll, nitrate under the plots, jars breathing N2O, the 119 cores stacking into the design and a module lighting
its plots; `net`, in `field`'s frame: the cloud of 20,000 kinds of microbe, the nitrifiers, the co-occurrence network
pulled out of its core, the shuffle, the modules and the halves' own networks side by side; each with a manifest) and
engine parts adapted from the tissue topology story's (with the hop from Vienna to Japan on the globe, `makeHop` in
`engine/e2_scene.js`). `tools/soil/SPEC.md` is the contract, with the owner's decisions.

- **The data**: `tools/soil/data/gen_data.py` (Python with numpy, pandas, scipy and networkx,
  `tools/soil/data/requirements.txt`; about five minutes) reads the authors' three CSVs (the 16S read counts of 100,116
  kinds in 119 samples, their taxonomy, the field metadata) from a folder given on the command line, builds the
  co-occurrence network and writes `tools/soil/sets/data.js` (`SOIL_DATA`, about 425 KB, documented in its header), with
  what the story uses of `tools/soil/data/figures.json` (the slides' charts read off by two readers and reconciled by
  `tools/soil/data/reconcile.py`; the readers' files are not kept). The authors' files are not in the repository: only
  derived numbers go in, and `sets/data.js` is never edited by hand. `SDATA` only decodes and looks things up: the app
  computes nothing scientific. Permission: the authors, through the owner, 29 October 2026, with the rule that anything
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
- **The hedges** (the data's verdict, `tools/soil/README.md`): in the slides' measurements the BNI wheat stays greener
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
- Eight chapters, 11:03 as narrated (v109): Half the sack, The relay, A wheat fights
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
  `python -I tools/soil/data/gen_data.py <folder with Soil_ASVs.csv, ASV_Identifiers.csv, Field_Metadata.csv>`, then
  `node tools/soil/test-data.mjs` and `node tools/soil/build.mjs`; the slides' readings again only through
  `tools/soil/data/reconcile.py`.
- **British spelling** (colour, fertiliser, centre, grey, neighbourhood), English only; plain words for a business
  audience, the technical layer in small print.

## The pass story (`stories/pass.js`) is built the same way

`stories/pass.js` ("Pass it on", in German "Weitersagen!", the institute's outreach story for about 12 and up) is
generated from `tools/pass/` (`node tools/pass/build.mjs`, `--check` as for the tour; `node tools/pass/test-sets.mjs`
checks the sets without a browser): the tour's kit, the airports story's globe and the cell map story's cell, three sets
and engine parts adapted from the qubits story's (the life-size parts from the flock's). `tools/pass/SPEC.md` is the
contract.

- **The globe and the cell are the originals, unchanged.** The build cuts whole sections and named declarations out of
  `stories/airports.js` and `stories/spatial.js` (`ORIGINALS` in `build.mjs`), each inside a function of its own
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
  the later of the two): `audio/narration-pass.mp3` (English, Kokoro's `af_heart`) and `audio/narration-pass-de.mp3`
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
  Never in the `place` hook. While it is carried no shark steering starts. The school's height, the grip and the new shark were checked on a Quest 3 (October
  2026), with the endotype junction over a real wall, the PET scanner's base and the fitted card titles.
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
- **Up to four sharks at once** (the owner, 31 October and 1 November 2026, after a test with headsets: "if be the
  shark is on on one player the shark should be shared for all of them"; one or several: "ok lets make it 4"; the
  set's `MAXS`): passing ones (the story's, Now and then, one sent, one let go and swimming off) and people's own. At
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

## The flock (`stories/flock.js`) is built the same way

`stories/flock.js` is generated from `tools/flock/` (`node tools/flock/build.mjs`,
`--check` as for the tour): the tour's kit, one set (`sets/flock.js`, manifest
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
  owner, 1 November 2026: "yes also make it 4 falcons"; the set's `MAXF`: a fifth
  is not launched here, and Send a falcon says *Four falcons already*; one from
  another device takes the place of the oldest, so two devices that each sent a
  fourth at once, or one still flying a falcon gone elsewhere, end with the same
  four; Now and then waits while one is in the air), and the birds
  flee every falcon near them. Every value from another device is bounded
  (positions and velocities under 10 km in size, a snapshot whose fish or birds
  would not be finite is ignored), and who sent an effect is the relay's word for
  it (the shell passes it to the story's `effect(type, data, by)`), not its data's.
- Bird by bird (the owner, the same day: the birds shared exactly too): while
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

## The robot gang (`stories/robots.js`) is built the same way

`stories/robots.js` is generated from `tools/robots/` (`node tools/robots/build.mjs`,
`--check` as for the tour): the tour's kit, one set (`sets/robots.js`, manifest
`sets/robots.md`) and engine parts adapted from the flock's. `tools/robots/SPEC.md`
is the contract between them.

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
  headset every 0.4 s (v136), and only the boxes of the cells cleaned since the last time (a box per trail: a disc
  joins the box it touches, `MAP.boxes`; `mapSend` sends each through the renderer's `copyTextureToTexture`,
  texSubImage2D from a small copy of its rows); a new map, the dust again, more than 32 boxes or boxes over half the map
  together send all of it, as before (also in the set's harness, which has no `GL.renderer`). How the trail's 0.4 s
  steps look on a headset is untested.

## The design room (`stories/design.js`) is built the same way

`stories/design.js` (the props table) is generated from `tools/design/` (`node tools/design/build.mjs`, `--check` as
for the tour): the tour's kit, the props' cards (`DESIGN_CARDS`, made at build time from `tools/design/props.json`,
only the fields a card shows, and the miniatures' names in `tools/lowpoly/`), one set (`sets/table.js`) and engine parts
adapted from the flock's (the shared-room, headset-setting and subtitle lines copied unchanged). `tools/design/SPEC.md`
is the contract. Rebuild it after changing `props.json` or the miniatures' names, and `lowpoly.js`
(`node tools/lowpoly/build.mjs`) after changing a miniature.

- **Not one of the stories** (the owner, 29 October 2026: "the design room as a room where we have a table with the
  low poly versions of all props"): its entry is in `STORY_EXTRA`, so it is on no Stories screen and not counted;
  `#design` or `HOST.go('design')` opens it, and `tools/release.mjs` lists it in `version.json` (live updates swap it).
  No narration and no chapters: it opens straight into explore mode, the table; its one short intro line (6 s) plays
  for a new wearer or Intro, and its end never starts Repeat.
- **The table**, life size like the flock's land (1 unit is 1 m, the floor 1.6 m under your eyes in a headset): round,
  2.3 m across, its top at 0.86 m and its middle 1.55 m in front of you; a plate per story round the rim in the story's
  colour with a place card (kicker and title), its miniatures (12 cm, from `lowpoly.js`, built a few per frame so the
  table fills in without a stall) on rings from the rim in; in the middle the stage, where the picked prop stands 40 cm
  tall and turns. Lit as the props are (sky light, a light over your shoulder, a cool rim light), dark navy.
- **Few draws** (v136; the sweep found 235 draws an eye and 5.4 ms of script a frame, a mesh per material of every
  miniature): each miniature is merged as it is built into at most two meshes (`mergeMini` in `sets/table.js`: its
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

## The studio (`stories/studio.js`) is built the same way

`stories/studio.js` (v111, *Your own scenes*) is generated from `tools/studio/` (`node tools/studio/build.mjs`,
`--check` as for the tour): the tour's kit, three.js r128's own add-ons from `tools/studio/vendor/` (pasted with their
licence lines, each wrapped so nothing leaks but `THREE.*`; `GLTFExporter` only inside `exporterLoad()`, defined when
the studio first converts), two sets (`stage`, `looks`) and engine parts adapted from the design room's (the
shared-room, headset-setting, subtitle, panels, recenter, framing and sound-effect lines as in every story: the smoke
test checks them in every `STORY_EXTRA` page). `tools/studio/SPEC.md` is the contract; `tools/studio/README.md` the
formats guide and the upload page; `relay/README.md` the relay's side.

- **What it is** (the owner, 3 November 2026: "i actually need a room where i can place some fbx or other format files
  in a folder and then i have textured objects, in some case with animations and then i can place them and somehow
  save where they are placed ... and i also need semi-transparent trigger cubes that i can use to let the 3d objects
  appear and disapear depending on where the user goes"; then "also add some spatial audio emitters and let me hide and
  show multiple objects with each trigger cube"). Not one of the stories: its entry is in `STORY_EXTRA` after the
  design room (kick *Studio*, title *Your own scenes*, colour `#e6d3b8`, icon `studio.stage`, `life: true`), so it is on
  no Stories screen and not counted; `#studio`, the menu's *Studio* (Settings tab), a station or the relay's `/upload`
  open it. No narration: one short intro (5 s: the scene from a little way off, then the walk up to it) for a new
  wearer or Replay, then explore mode, the scene; its end never starts Repeat. The two files the owner sent as examples
  (an atelier scan, binary FBX, 397,066 triangles, an 8,192 px JPEG inside, in centimetres; a rigged figure, binary
  FBX, one 51 s take, its PNG beside it, Z up) are kept outside the repository, as every scene of the owner's is.
- **Scenes.** A scene is one folder: models, their textures, sounds and `layout.json`, where everything placed stands.
  An item is one thing placed: an object (a model file placed once; one file may be placed many times), a trigger cube
  or a sound. What the studio makes goes into the scene's `models/` (GLB), `sounds/` and `originals/` (the files as they
  were given, so a model can be converted again); files elsewhere in the scene work as well. The scenes come from the
  relay (`--scenes <dir>`; `HOST.collab.relayFind()` finds it: "The studio's scenes on the relay" under "Shared rooms"),
  else from a plain folder next to the app (`scenes`, or `&scenes=<relative folder>`: only a relative path, no `//` or
  `..`) that `node tools/studio/scan.mjs <folder>` describes (`index.json` and `<name>/files.json`, what the relay's
  API answers, by the same rules, `relay/scenes.mjs`; read only, so *Download layout.json* in place of Save). The scene
  opened: the link's `&scene=`, else the last used here (`studioLast.<source>` in `localStorage`), else the only one,
  else the list (*Pick a scene*). The relay's watch keeps it current: a changed file is fetched again and its items
  rebuilt where they stand, a new file shows in the Add list, a scene that comes or goes changes the picker, and a
  layout saved elsewhere updates *Saved* (it never replaces what is placed by itself). With a password the studio
  fetches every file with it (the loaders through their `LoadingManager`'s `setURLModifier`, `?token=`; sounds and
  JSON with `Authorization: Bearer`); the first 401 goes to the shell once (`HOST.collab.relaySaw`), which asks where it
  always does, and the studio then asks nothing more of that relay until the shell holds another password (seen alike
  twice, 2 s apart), when it lists the scenes again and fetches what was refused.
- **Models.** GLB and glTF (`GLTFLoader`: PBR materials, every clip; no Draco, Meshopt or KTX2, which its card says),
  FBX (binary or ASCII, version 7 and up), OBJ with its MTL, PLY (vertex colours) and STL. Textures a file names but
  does not hold are found in the scene's pictures by the ladder ("Textures" below; the author's own path ignored); one
  not found leaves the model untextured and its card says *Missing texture x.png: put it in the scene's folder* and
  offers pictures for it. Textures
  over 4,096 px are drawn down before they reach the GPU (`&maxtex=` 512 to 8,192; the card says so: the atelier's 8,192
  px JPEG alone would take about 340 MB of a Quest's memory). The units and up axis are guessed when a file is first
  placed and then stored in the item (`s`, `q`), so a layout never changes when the guess does: an FBX's
  `GlobalSettings` (`UnitScaleFactor`, `UpAxis`, `UpAxisSign`, read from the file's bytes, since the loader ignores
  them), taken when they make the model's largest side 5 cm to 60 m, else 1 unit is 1 m if that does, else it is sized
  to 1 m; glTF is metres and Y up; OBJ, PLY and STL say nothing, so metres, centimetres or millimetres, whichever fits.
  The card's Scale line says what the file said and what was made of it. The atelier comes out 7.4 m wide (scale 0.01),
  the figure 1.66 m tall (stood up from Z up). One file is loaded once and cloned per object (`SkeletonUtils.clone` when
  rigged), each with its own `AnimationMixer`; a file no object uses any more is dropped and its GPU memory freed. Each
  object is *lit* (a sky and ground light, one over your shoulder; glTF's PBR gets a soft room-like environment) or *as
  scanned* (unlit, its own colours: photogrammetry has its light in its texture); a mesh without normals starts as
  scanned, and lit it is shaded flat. An FBX material of opacity 0 with no alpha map (3ds Max's habit) is drawn solid,
  and the card says so. The card: its file, size in metres as placed, triangles, textures and their sizes, clips and
  warnings, with Quest budgets (shown, never refused): over 500,000 triangles in the scene, 300,000 in one model, more
  than 6 textures over 2,048 px. A model loading (or one this device cannot find) is a grey box with a line of text
  where it will stand: parsing a big FBX stalls the page for seconds (more on a headset).
- **GLB first** (the owner, 4 November 2026: "maybe we should work with these and use a converter like you mentioned
  glb better than fbx and we can just convert it"). One converter (`tools/studio/engine/convert.js`,
  `makeConverter(THREE, hooks)`) serves the studio, its Upload pane and `tools/studio/convert.mjs`: it bakes the guess
  in (metres, Y up), draws textures down (4,096 px, or 2,048 *For Quest*; opaque ones as JPEG, the rest PNG), makes
  Phong and Lambert materials standard ones, fixes the opacity-0 quirk, welds repeated corners, keeps animations and
  skins, and records what it did in `asset.extras.studio = { from, s, q, at, scan }` (`from` the original's path in the
  scene, `s` and `q` the scale and turn baked in, `scan: true` for a mesh without normals). It turned the atelier's 14
  MB FBX into an 11.4 MB GLB that parses in 0.3 to 0.7 s instead of 1 to 2 s, and the figure's 3.7 MB into 3.0 MB with
  its skin and take exact, 0.03 s instead of 0.55 s. *Convert to GLB* (pages only, editing on; a headset says *Convert
  on a laptop*) on an object's card, and *Convert every model* in the Add pane: with a relay that takes uploads the GLB
  goes to `models/<name>.glb` and every object placed from the original switches to it where it stands (`s' = s / b`,
  `q' = q * r^-1` for the baked scale `b` and turn `r`; one change, one Undo step, for everyone at a station); else it
  is downloaded. The Add list shows `models/`, `sounds/` and everything outside `originals/`, with `originals/` folded
  under *Originals*; a GLB whose record (read from its first bytes with a `Range` request) names another file of the
  scene, or without one has its base name, stands for it, and a placed original's card offers *Switch to the GLB*.
- **Textures: found, added, converted** (the owner, 4 November 2026: "it needs a way to add textures to models in case
  they are missing, preferably with autoassign and direct convert to good formats"; `tools/studio/SPEC.md` has it in
  full). The browser shows PNG, JPEG, WebP, GIF, BMP and AVIF, TGA goes through `TGALoader`, and **TIFF** (none, LZW,
  PackBits, Deflate; 1 to 16 bits; grey, RGB, palette, CMYK), **PSD/PSB** (the merged picture) and **DDS** (uncompressed,
  DXT1, DXT3, DXT5, BC4, BC5) are read in the page by `tools/studio/engine/images.js` (fflate for the zipped ones);
  EXR, HDR, HEIC, KTX, BC6H/BC7 and JPEG-in-TIFF are refused with a sentence. The converter's `load` reads such a picture
  a model names first and gives its loader a PNG (an FBX's `.psd` names, which r128's loader never asks for, made `.ps~`
  in a copy of its bytes and back in the URL modifier; a `.tga` name read whatever its bytes are). **The ladder**
  (`CONV.texFind`): the path the model gives, its name in any case (nearest folder first), the same name as another kind
  of picture (`x.tga` finds `x.png`), then the same words but colour words (`diffuse`, `albedo`, `basecolor`...), in the
  same slot (`CONV.slotOf`: normal, roughness, metalness, occlusion, glow, opacity, `orm`, by name words or a normal
  map's colour), only when exactly one picture is so; the card says each one found under another name or read from a
  TIFF, PSD or DDS. **By hand** (an object's card, pages with editing on, never `&visit`; a headset says *Add a texture
  on a laptop*): each missing name offers *Use <file>* (up to three of the scene's pictures, `CONV.texRank`) and *Choose
  a picture...* (with a relay into `originals/`, else from memory), and *Add a texture...* lays a picture on a material
  with texture coordinates (a material, a slot: Colour, Normal, Roughness, Metalness, Occlusion, Glow, Opacity). One
  press converts at once through Convert to GLB's path (`texGo`, `convertFile(path, { tex, into })`): the pictures baked
  into `models/<name>.glb` (objects switched where they stand; without a relay downloaded), **never stored in the layout
  or `collab.state()`** (no `FORMAT` change), recorded in the GLB as `asset.extras.studio.tex` (`[{ name, mat, slot,
  from, how }]`), so converting the original again lays the ones chosen by hand on again; an object on a GLB is fixed by
  making that GLB again (from its original when it is in the scene, else from itself, the old one kept under
  `originals/`). In the GLB separate roughness and metalness pictures are packed into one (green and blue) and a bump map
  becomes a normal map. The Upload pane lists each texture a dropped model names (found, how, or *Use* and *Choose a
  file...*), pairs the only picture left over with the only model lacking one (`only`), takes a picture dropped onto a
  model's row, and at convert time gives a model with no colour picture a left-over one of its name (`stem`).
  `convert.mjs`: `--texture <name>=<picture>`, `--texture <material>:<slot>=<picture>`, `--textures <dir>`. The relay
  lists `.tif .tiff .psd .psb .dds .avif` as images. Untested: real Photoshop, Substance and game-engine files beyond the
  generated ones and those ImageMagick and Pillow write (checked by hand), a big TIFF or PSD's memory on a headset.
- **The upload page** (the owner, 4 November 2026: "the relay should offer an upload page where everything gets
  converted into the right formats directly and then sorted into a folder if possible"). `<relay>/upload` sends the
  browser to the studio's **Upload** tab (`#studio&upload`; pages only, none in a headset or with `&visit`): pick a
  scene or *New scene*; drop files or whole folders (or *Choose files*, *Choose a folder*); the plan shows one row per
  thing it will make before anything happens (a model with the files it names, wherever they were dropped: textures,
  an OBJ's MTL and its textures, a glTF's `.bin`; each sound; anything left *kept as it is* into `originals/`, never
  dropped; a missing texture said in its row); *For Quest* (on: 2,048 px; off: 4,096) and *Replace files with the
  same name* (off: a name taken gets a number, `eva_001 2.glb`); *Convert and upload*, with progress per row; then *Open
  the scene* (editing on). Models become `models/<name>.glb` by the converter (loaded back and checked; a row that fails
  says why and makes nothing). Sounds become mono, so they place well: up to 20 s decoded in the page (an
  `OfflineAudioContext`, the one exception to the sound rule: "How the shell and stories fit together") into a 16-bit
  WAV at their own rate (at most 48 kHz), `sounds/<name>.wav` (gapless loops; OGG does not play on iPhones); longer ones
  sent to the relay's `ffmpeg` for `sounds/<name>.mp3` (mono, 96 kbit/s, 44.1 kHz), and without it an MP3, M4A/AAC or
  OGG kept as it is (played from one point) and anything else a mono 22.05 kHz WAV. Every given file also goes into
  `originals/<the dropped folders>`. Without a relay that takes uploads the plan still shows and *Convert* offers each
  GLB and WAV as a download. v127 (the owner, 9 November 2026: "add option to remove items from upload list before
  uploading, one slider for all models reduction when uploading"): a × on every row still to make takes it out of the
  plan (`upDrop`: its files leave what was dropped, a model's with the files it needs and its pictures, unless another
  row still uses them; nothing of it is made, uploaded or kept), and *Triangles kept, every model* above the list sets
  every model row's share at once as it moves (`UP.keepAll`, `upKeep()`; a row's own slider can still differ after, a
  line then says so, and a later drop starts at it).
- **Fewer triangles and Change texture** (v119; the owner, 6 November 2026: "models need to be way less triangles",
  "needs a percentage and should be adjustable per model with a preview", "20 percent by default for everything",
  "preview in ar/vr would really be helpful", and "a change texture button on models placed in the scene";
  `tools/studio/SPEC.md`, "Fewer triangles" and "Change texture"; `engine/e7d_lite.js`). The converter's `reduce` (every
  mesh to a share of its triangles with meshoptimizer's simplifier: its normals and texture coordinates weighed, so its
  textures stay put; corners shared between parts locked; crumbs pruned; skins kept, shape keys left), in `toGLB`
  (`keep`; the record's `tris: { from, to, keep }`) and `convert.mjs --keep`. On a placed model's card (page and headset,
  editing on, under its place and size): *Fewer triangles...*, 20 % to start (a page's slider; a headset's *− 5 %*,
  *+ 5 %*, *10 %*, *20 %*, *50 %*), shown at once in place on this device only (the object's own model given the
  lighter geometries), *Save* making the GLB as Convert to GLB does (from the original a GLB stands for when the scene
  has it, so the share is of the original; every object of that file switched where it stands, one Undo step, for
  everyone at a station), *Cancel* putting it back; *Change texture...* (a material, a slot and one of the scene's
  pictures, or on a page one from this computer, shown at once on this device; *Save* bakes it in through Add a
  texture's path, recorded in `asset.extras.studio.tex`). Both save from a headset too (with a relay that takes uploads;
  the rule that a headset converts nothing lifted for these two). A lighter GLB made again from its original keeps its
  share. The Upload pane: each model's *Triangles kept* (20 % by default), about how many (`CONV.triCount`, from its
  bytes) and *Preview*, which opens the viewer over the whole window (v125, "The viewer" below; until then a small
  picture of both side by side), as does *Look closer* on the card while Fewer triangles is open. Nothing in the layout or
  `collab.state()` (no `FORMAT` change).
  - The fill: no black seams (v120; the owner, 6 November 2026: "The reduction works really well but leaves black
    artifacts in the textured models ... maybe just needs changes to the texture like adding fade out color around all
    tiles"; `tools/studio/SPEC.md`, "Fewer triangles"). Why: a scan's texture is an atlas of many small pieces with black,
    unused texels between them; reducing keeps the seams joined in 3D but straightens each piece's outline in the
    picture, so at 10 % the triangles sample the black between pieces (black wedges along the seams; even all its
    triangles show thin dark seams once mipmapped). Measured on the atelier with its margins blacked out: filling every
    texel no triangle uses with the colour of the nearest piece took both away; locking the seams' corners stopped the
    wedges but kept the dark seams (not done). So the converter fills (`CONV.fillModel`, `engine/convert.js`; the pixel
    work `IM.cover` and `IM.fillGaps` in `engine/images.js`, plain typed arrays): for each picture a GLB is made with, the
    texels the triangles of the model as it is before it is made lighter use are marked, and every other texel is
    filled from them, a band of exact edge colours (2 to 8 rings by size) and then a smooth push-pull fill; the used
    texels never change; alpha kept where a material reads it, else filled too (a see-through picture whose gaps are
    mostly clear is left as it is and said: a canvas keeps no colour where alpha is 0). A picture drawn down before the
    fill (the converter's `maxTex`, its reading with a `max`, the studio's own cap: each tells it, `CONV.drew`) has its
    pieces' rims taken back and filled too (`fillGaps`'s `rim`: one ring, two when drawn down by more than half; only
    where a texel deeper in the piece is beside it), since drawing down averages them with the black beyond the edge and
    the band would copy that dark rim outwards (the atelier's 8,192 px picture is filled at 4,096). Only where it makes sense: texture
    coordinates within 0 to 1 (a picture that tiles is left alone), under 95 % of the picture used, every mesh showing it
    with texture coordinates; every slot with its own values (a normal map never black). Integer arrays only (about 90
    MB besides the picture at 4,096 px), the page given back every 25 ms; the atelier's 4,096 px picture in 1.4 s in
    `convert.mjs`'s headless page (a headset's time untested). Every path that writes a GLB fills (Convert to GLB,
    Convert every model, the Upload pane, Fewer triangles' and Change texture's Save, the missing-texture buttons:
    `toGLB`, `fill: false` not); the record gains `fill` (how many pictures), the GLB's card says so in one line, and a
    GLB whose record says so is never filled again (`load` marks its pictures). Fewer triangles' preview shows the
    pictures filled too (copies, worked out once while it is open, laid on the object's own materials, put back and
    freed by Cancel, Save's end or another object; `STUDIO.state().lite.ft.fill`). `convert.mjs --no-fill`. How the
    filled seams look on a Quest and the time the fill takes there are untested.
- **The viewer** (v125; the owner, 8 November 2026: "Studio uploader needs better preview, also for the reductions, can
  use the whole viewport, show the model and be able to spin it etc"; `tools/studio/SPEC.md`, "The viewer";
  `engine/e7f_viewer.js`). Pages only, never in a headset. A model over the whole window, opened by an Upload row's
  *Preview*, by *Look closer* on a placed model's Fewer triangles card and by *Look* on each model card of the Add pane (a
  small button over the picture's corner: a press on the card still places it). An overlay (`#stuViewer`, z-index 14) over
  the studio's own canvas, raised to 13 while it is open: **never a second renderer**; the studio's frame goes on (items,
  sounds, the shared room) but draws the viewer's scene in place of its own (`vwDraw`, from `frame`). The model lit as the
  studio lights its scene or as scanned, framed on its box over a floor grid, its size and triangles said; drag to spin, the
  wheel or a pinch to zoom, a right drag, a Shift drag or two fingers to pan, a double click (or *Frame it*) to frame it
  again; it turns by itself until touched. For a model being made lighter (an Upload row's, Look closer's): *All triangles*,
  *Lighter* or *Side by side* (the window's halves, one camera; top and bottom on a tall window), the share on a slider (the lighter one made again as it is
  let go, `CONV.reduce` on the model as read), both counts, the lighter one's pictures filled as Save fills them;
  *Wireframe* (dark edges a hair nearer than its faces) and *Textures* on or off, *Lit* / *As scanned*. Close or Esc: all
  it made freed, the canvas back under the page, the share chosen back on the row or the card; while open the keyboard is
  its own (the studio's keys never reach the scene). Nothing in the layout or the room, no Undo step. `STUDIO.viewer()`
  for tests. Untested: a big scan in it on a slow laptop, pinch and two-finger pan on a real touch screen.
- **Pictures in the Add pane** (v120; the owner, 6 November 2026: "Models in add dialogue should have preview images and
  show in a grid ... 3d preview? overkill?", then "add pane with pictures sounds good, leave 3d models for now";
  `tools/studio/SPEC.md`, "Pictures in the Add pane"; `engine/e7e_pics.js`). A picture is a 256 x 256 JPEG of a model (lit
  as the studio lights a scene, seen from a little above and in front, framed on its box, drawn at twice the size and
  made smaller, over a dark background), kept in the scene as `previews/<the model's path>.jpg` (`previews/models/eva.glb.jpg`;
  the relay's rule above: only such a `.jpg` there, at most 200 KB, kind `preview`). The converter's `toGLB(m, { picture })`
  hands the GLB as loaded back to the hook before freeing it, so every path that writes a GLB makes one (Convert to GLB,
  Convert every model, Fewer triangles' and Change texture's Save, the texture buttons: `convertFile`; the Upload pane's
  rows, which show it too); with a relay that takes uploads it goes beside the GLB (`upSend`: straight into R2 when it
  can, else through the relay) and shows at once, else it is kept for this page on the card of the model it was made
  from; never a reason a conversion fails. The GLB's record also says its size (`size`, metres) and triangles (`n`).
  *Make pictures (n)* (the Add pane, a page with editing on; not in a headset, not `&visit`) makes the missing ones one
  model after another (a model the scene has loaded drawn from that; any other fetched and loaded as the converter
  loads it, its textures at most 1,024 px, freed after), uploaded with such a relay, else for this page only, its button
  saying how far it is, *Stop* after the model it is making, a line saying what was made. The cards (a `{ grid }` block,
  page and headset): the Add pane's models and the Originals fold's models (its other files a list; sounds a list),
  each its picture (an original a GLB stands for shows the GLB's) or a plain tile with its kind (*GLB*, *FBX*...), its
  name (`models/` left out), its size in metres and triangles where known (loaded here, a GLB's record, a picture made
  here), else its bytes, and what it was made from or into; a page's CSS grid has 3 to 5 a row by the pane's width, the
  headset's canvas 3 a row, paged by the pane's *Up* and *More*. Pictures are said apart from the scene's files as a
  listing is read (`setFiles`; by path too, for an older relay's `image`), so nothing else sees them (the Add lists, the
  texture ladder and pickers, From another scene's lists), and fetched as files are (`call`: the password as a header,
  or R2's signed link), three at a time, each once a version, a page all of the cards', a headset only those it draws.
  In a headset session a picture is drawn inside the session's frame callback (`PV.jobs`, from `frame()`). A picture
  belongs to the opening of the scene it was made in (`STU.gen`): another scene opened meanwhile, the same one opened
  again or the studio gone, and it is kept nowhere (`pvKeep`, `pvSend`). From another scene copies a model's picture with
  it. Nothing in the layout or `collab.state()` (no `FORMAT` change).
  `HOST.cur.peek('STUDIO.state().pics')` for tests.
- **`layout.json`** (also what *Download layout.json* gives and Upload takes): `{ studio: 1, scene, saved, objects,
  cubes, sounds, cuts, groups, shapes, empties, settings }`. An object `{ id, name, file, p, q, s, light: 'lit' | 'scan', clip, anim: 'loop' | 'once' | 'off',
  start: 'always' | 'shown', faces, tint, bright }` (`faces` optional, kept only when set: `'both'` or `'inside'`; "Faces" below; `tint` (`'#rrggbb'`) and `bright` (0.25 to 4, 1 never kept) optional, v125: "Tint and brightness" below; `cutsLocked: true` optional, v124: its cut-outs locked, "Cut-outs" below), a cube `{ id, name, p, yaw, size, mode: 'while' | 'stay', show, hide, tex, plays }` (lists of item
  ids; `tex` optional, kept only when it has an entry, v124: up to 16 `{ on, mat, slot, file }`, "Trigger cubes that change
  textures" below; an entry that is not one dropped, and counted when read from a layout; a layout without it reads as
  before; `plays` likewise, v136: up to 16 `{ on, what: 'clip' | 'sound' | 'path' | 'motion', clip, how: 'once' | 'loop' |
  'hold' | 'stop', when: 'leave' }`, "Trigger cubes that start things" below, an entry that is not one dropped and counted,
  one naming an item the layout lacks, or of the wrong kind, dropped), a sound `{ id, name, file, p, vol, r, loop, start, on, bone, o, sync, skip, len }` (the last six optional, kept
  only when set: the object it follows, its bone's name, the offset in the target's frame, "Sounds" below; and, v125, a
  voice recorded with a movement: the item whose recorded path it plays with, the seconds into its file where that path's
  start is, -10 to 600, and how long of it plays, "Recorded paths" below), a cut-out `{ id, name, on,
  p, q, size }` in `cuts` (the object it cuts, and its middle, a full turn and its size in that object's frame, turned
  but not scaled; "Cut-outs" below; a layout without `cuts`, v112's, reads as before), a group `{ id, name, items }` in
  `groups` (its members' ids, this layout's objects, sounds and cubes only, one left with fewer than 2 dropped and counted;
  "Groups" below; a layout without `groups`, v113's, reads as before), a shape `{ id, name, shape: 'cube' | 'sphere' |
  'cylinder' | 'plane', p, q, size, colour: '#rrggbb', look: 'colour' | 'hide' }` in `shapes` and an empty `{ id, name, p,
  q }` in `empties` ("Shapes and empties" below), any item or group with `locked: true` (kept only when set; "Locked in
  place" below), and the scene's `settings` `{ others: 'shown' | 'hidden', real: 'device' | 'always' | 'never' }` ("The
  scene's settings" below; a layout without them, v118's, reads as before, a new scene's; bad ones counted), an object's, a
  shape's or an empty's `behaviour` `{ kind: 'look' | 'follow' | 'avoid' | 'item', who: 'nearest' | 'first', range, dist,
  speed, area, target }` (only its kind's fields, kept only when set; "Behaviours" below; a layout without it, v119's,
  reads as before), and an object's,
  a shape's or an empty's `motion` `{ kind: 'spin' | 'wobble' | 'bob' | 'pulse' | 'orbit' | 'sway', speed, amount, axis:
  'x' | 'y' | 'z', start: 'always' | 'shown' }` (kept only when set; "Motions" below; a layout without it, v119's, reads as
  before), and an object's, a shape's, an empty's or a sound's recorded `path` `{ k: [[t, dx, dy, dz, qx, qy, qz, qw],
  ...], play: 'loop' | 'once' | 'bounce', start: 'always' | 'shown', speed }` (kept only when set; "Recorded paths" below;
  2 to 600 keys an item, 6,000 a scene, at most 120 s; a layout without it reads as before), or for a recording kept as a
  file (v125) `{ src: 'recordings/<name>-<n>.json', len, n, play, start, speed }` (`len` more than 0 to 600 s, `n` 2 to
  40,000 keys; not counted in the scene's 6,000), and (v126) an object's, a shape's or an empty's tracker, `trk` `{ id, o, q }`, and an object's `puppet` ("Vive trackers" below), each kept only when set. Metres in the scene's frame (the floor at y = 0; at a station
  in a shared room the room's frame since v125, the origin and axes the room's: spot A and x towards spot B on a room
  calibrated on its floor spots; outside a room where you stood, -z the way you faced; until v124 the circle's spot); `p` to the mm, `q` to 4 decimals, `s` 4 significant
  figures, `yaw` radians (cubes stay level), `vol` 0 to 2, `r` (full volume within, 0.1 to 20 m). `id` six characters
  `[a-z0-9]`, unique in the scene; `name` at most 60 characters (the file's name, numbered when placed again: *eva_001
  2*). At most 300 objects, 100 cubes, 60 sounds, 100 cut-outs (16 on one object), 50 groups, 200 shapes, 100 empties; a `file` is a path in the scene's listing (200 characters, no `..`); a
  cube's lists only name this scene's items. A bad item is dropped and said once (*2 items in layout.json could not be
  read*); anything else ignored.
- **Trigger cubes** are each person's own: a cube is active for you while your head is inside it (a headset's head; on
  a page the camera in Walk view, never the orbit camera), `while` only then, `stay` from then on until the scene is
  opened again or *Reset what I have seen*. For an item, of the cubes active for you, those listing it in `show` (S) and
  in `hide` (H): shown if S has any and H none, hidden if H has any and S none, both: the one entered last decides (a
  `stay` cube walked into again counts as entered again, v117: before, it counted only the first time, so with a `stay`
  cube showing an item and another hiding it the item stayed hidden after the first round, the owner's report of 5
  November 2026); neither: hidden if any cube lists it in `show` (it waits for its cube), else shown (v119: away from its
  station in a room, nothing; a shape or an empty is shown and hidden as an object is). Shown and hidden fade
  over 0.4 s; `start: 'shown'` starts an object's animation, or a sound, from its beginning each time it is shown (a
  sound stops, fading, when hidden). Never shared, never in `state()`: ten headsets each see what their own place
  reveals. While editing every cube is drawn as its edges and its name only (v131: no walls; its own colour while you are
  in it, lighter pointed at or selected, else darker; an unseen box both ways round where its fill was, so it is still
  pointed at from inside and outside), a selected cube's lines go green to what it shows and red to what it hides, and a
  model or a coloured shape a cube hides from you is not drawn at all but shown by its unseen box's edges and its tag
  (*Atelier · 397k ▲ · hidden*; until v130 it was drawn faint, at 0.3: "Nothing see-through while editing" under
  "Editing"), still pointed at, selected and carried; not editing, cubes and sound markers are not drawn at all.
- **Trigger cubes that change textures** (v124; the owner, 8 November 2026: "trigger cube replace texture mode so that
  it can replace a texture on a model in the scene", then "no crossfade needed"; `tools/studio/SPEC.md`, "Trigger cubes
  that change textures"; `engine/e6i_tex.js`). A cube's record may hold `tex`, up to 16 entries `{ on, mat, slot, file }`:
  an object's id (models only), one of its materials (its index as Change texture lists the object's materials, `ctMats`:
  those with texture coordinates), a slot (`map`, `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `emissiveMap`,
  `alphaMap`) and a picture of the scene (`normTex`: an entry that is not one is dropped, as is a second for the same
  object, material and slot; `tex` not a list makes the cube bad; read from a layout, the dropped ones are counted,
  `STU.badTex`, and those for objects the layout lacks dropped as its lists drop ids). While a cube is active for you its
  entries apply: for each object, material and slot, of the active cubes' entries the one from the cube entered last wins
  (`c.since`, show and hide's rule); with none, the object's own picture is back. A switch, no fade; each person's own, as
  every cube is (only the cube's record goes to the room). As scanned shows only a colour picture; the other slots apply
  lit (a slot its material has not, Phong's roughness, does nothing). On the object's own materials (its clones,
  `libClone`): another object of the same file never changes with it; what each had is kept and put back (`texOn`,
  `texOff`, as `ctShow` does; `applyLight` puts the own pictures back first, so a material as scanned made meanwhile takes
  its own), only when what an object wants changes (`texStep`, each frame after the models are built: its entries, the
  pictures ready, lit or as scanned, its model built again; nothing at all while no cube has an entry and none is on).
  The pictures are read as the scene opens or an entry arrives (`CONV.picture`: TIFF, PSD and DDS too; at most 2,048 px,
  or `&maxtex=` when lower; kept by the scene's opening and the file's time), sent to the GPU then
  (`renderer.initTexture`) in each flip the objects need (glTF's not flipped), so the switch is in the same frame, and
  freed when nothing names them. Reset what I have seen and the lobby hook give the own pictures back (they forget what
  was entered). Change texture's and Fewer triangles' previews on the same object win while open (`texHold`: its own
  pictures back as either opens), then the cubes' state applies again. The cube's card (page and headset; not for a
  visitor, nor with editing off; a cube locked in place takes them as it takes its lists): *Changes textures*, a row per
  entry (*Box · Colour → paint.png*; a press flashes the object in amber, ✕ takes it off, one Undo step) and *Change a
  texture...* (`STU.txp`: the object, pointed at (the trigger or a click, `pressItem`) or from the card's list, then its
  material when it has more than one, the slot, Colour first, and a picture as Change texture lists them, a headset eight
  at a time: the entry added, one Undo step; *Another object...*, *Cancel*, Escape, another selection and editing off end
  it); a selected cube's lines run amber to the objects it changes; the Items card *Cube · shows 2, hides 1, textures 1*.
  Deleting an object takes its entries out of every cube in the same step; duplicating it adds, in every cube, an entry
  for the copy beside each of its own (`texCopy`); a cube's copy keeps its entries; a group's copy maps them (a cube of
  the group onto the copies, one outside it gains entries for them). A GLB switch keeps them (the object keeps its id):
  the conversion says how its materials came out (`toGLB`'s `mats`, the original's `texMatsOf`) and each entry's material
  is found again there (`texRemap`, `texSwitched`, in the switch's change; glTF may list a mesh with several materials in
  another order); *Switch to the GLB* on a card keeps the index. `STUDIO.tex(id)` for tests. FORMAT `networks-36`. Untested
  on a headset: how the switch looks on a Quest, the memory with many 2,048 px pictures there.
- **Trigger cubes that start things** (v136; the owner, 11 November 2026: "Trigger cube should also be able to trigger
  things like an animation or a soundfile being played on a character or prop"; `tools/studio/SPEC.md`, "Trigger cubes that
  start things"; `engine/e6n_plays.js`). A cube's record may hold `plays`, up to 16 entries (`PLAY_MAX`) `{ on, what, clip,
  how, when }`: the item (`on`: an object's id for a clip; a sound's for the sound; an object's, a shape's, an empty's or a
  sound's for its recorded path; an object's, a shape's or an empty's for its motion: `PLAY_KINDS`), what is started
  (`what`: `'clip'` with `clip` one of the object's animations by name, `'sound'`, `'path'` or `'motion'`), how (`once`:
  from its start to its end, even after you leave; `loop`: again and again while the cube is active for you, a while cube
  until you have left, a stay cube from then on, then it comes off; `hold`, clips and paths only: once to its end, held
  there while the cube is active, then it comes off; `stop`: ends the run on that item now, whatever started it) and when
  (absent: as you walk in; `'leave'`, once and stop only: as you leave). `normPlays`: an entry that is not one is dropped
  (an id that is not one, an unknown what, how or when, hold on a sound or a motion, leave with loop or hold, a clip entry
  with no clip; a clip named on a stop dropped), one entry per item, what and moment (`on|what|when`), 16 at most; how
  always written, when only for leave; not a list (and not null) makes the cube bad. Each person's own, as everything a
  cube does: nothing is sent and nothing stored but the cube's record (no effect, no room key). An entry fires as its cube
  is entered (each time, a stay cube walked into again too; the head inside as the scene opens, the cube appears or the
  entry is added fires at once) or left; both edges debounced 0.3 s (`PLAY_EDGE`: out for 0.3 s counts as having left, in
  again within that is no new entry; show and hide are not debounced, so no scene changes), the moment of leaving that
  edge plus 0.3 s. On one item and what, the last start decides: it replaces the run under way, and when a run ends nothing
  older comes back. How each comes off (`trgFire`, `trgStart`, `trgOff`, `trgDone` on `it.tr`, the runs per what):
  - a clip (`trgClipStep`, from `animStep`): a layer of its own (`it.tl`, at most 2: a clip's clone's action, two kept per
    clip name, `it.tAct`) blended in over 0.3 s (`PLAY_BLEND`) over the object's own animation, which gets the rest of the
    weight (three.js r128's weighted mix; at full weight the cube's clip is the whole pose, properties it does not move at
    their rest), or over its rest pose with Animation Off; a new run on it crossfades from the old one's frame (frozen
    there, fading out meanwhile); a once fades out from its end, a loop or a hold from when it came off; the last layer
    stopped puts its rest pose back (three.js's own). A clip it lacks ends the run (`'missing'`, logged once a scene's
    opening, the card's amber line). A timeline's hold (e6m_anim.js) shows its own clip alone; Pause holds the frame;
    worn with trackers (pupStep) it plays none. Its model built again (a file changed, a GLB switch), the run goes on by
    its clock on the new model;
  - a sound (`trgSound` from `emitStep`, `trgSoundAt` in `emitOffset`, `sLoop`): one a cube names waits silent until a run
    starts it, from its start at its level at once (decoded or streamed), looping only for a loop; a run that came off
    fades out over 0.4 s (`PLAY_FADE`), a once is over at its end; its own Loop and Starts no longer apply; hidden mid-run
    it is silent, and shown again on its run's clock. A sound that plays with a recorded path (`sync`) is no target (the
    entry is ignored; the card says to start the path, which starts its voice);
  - a recorded path (`trgPathAt` in `POSE.path`): one a cube names waits at its start, or where its last run left it
    (`it.pw`); once: from its start to its end (there and back for Back and forth: its Plays says what one pass is), then
    it waits there; loop: again and again, coming off it finishes the pass under way and waits at its end; hold: to its end
    and held, coming off back along its path at its speed to its start; stopped mid-once: where it is. A voice recorded
    with it (`syncAt`, `trgPathTime`) starts with each run (its pass `'r<n>:<k>'`), silent while the path waits or a hold
    goes back. Its timeline's hold wins; carried or paused it rests at its placed pose;
  - a motion (`trgMotion` in `drawnPose`): one a cube names rests until a run; once: one period (60 / |speed| s); a loop
    that came off (or was stopped) finishes the period under way; a wobble's and an orbit's amount eased in and out over
    min(0.5 s, a quarter period) (they stand away from their place at the period's start).
  An object's own animation goes on until a cube plays a clip on it (Animation Off keeps it still until then). Show and
  hide still decide what is seen and heard: a run on a hidden item goes on by its clock, unseen or silent. Textures are
  independent. The cube's card (page and headset, `playCubeBlocks`; not with editing off, nor for a visitor; a cube locked
  in place still takes them): *Starts*, a row per entry (*Dancer · Wave · once*, *Voice · the sound · loops while you are
  inside*, *Radio · stops · on leaving*, with *· playing for you* while its run is the one on its item; a press flashes the
  item in blue; *Try* fires it here now as if entered, no Undo step, a tried loop or hold coming off after 10 s,
  `PLAY_TRY`, or pressed again, its label then *Stop*; ✕, one Undo step) with an amber line under one that cannot play now
  (`playWhy`), and *Start something...* (`STU.plp`: an item pointed at, the trigger or a click, `pressItem`, or from the
  card's list with what it offers, *animations: Spin, Bob · recorded path*; then *Another item...*, what (its animations, a
  headset's eight at a time, *Its recorded path*, *Its motion: Spin*, *The sound*), How (Once, Loop, Hold, Stop), When
  (Walking in, Walking out: once and stop only), *It will* in a sentence (`playSentence`: *As you walk in, Dancer plays
  Wave once from its start, then its own animation again.*) and *Add*, or *Replace* in its place for the same item, what
  and moment; one pick at a time with Pick what it shows and Change a texture...; Escape, another selection and editing off
  end it), and a faint paragraph. A selected cube's lines run blue to what it starts; the Items card *Cube · shows 2, hides
  1, starts 2*, and a target's faint line *started by a cube*; a target's card says which cube starts it and what waits
  (`playNote`: under its Animation rows, a sound's Plays, its Recorded path and Motion rows). Deleting an item takes its
  entries out of every cube in the same step; duplicating it adds, in every cube, an entry for the copy beside each of its
  own (`playCopy`, `withCopies` as texture changes do); a cube's copy keeps its entries; a group's copy maps them. A GLB
  switch keeps them (the object keeps its id; its clips' names come through the converter). Reset what I have seen and the
  lobby stop every run at once (`trgReset`: layers stopped, sounds stopped, paths back to their start); a cube you stand
  in fires again the next frame; opening the scene again forgets everything. Nothing is done per frame in a scene whose
  cubes start nothing (`trgList` is made again only when the items change). Logged: `studio play` (one line a start: its
  cube, item, what, clip, how, when) and `studio play missing`. `STUDIO.plays(id)` (`{ log, on, item: { tgM, tr, layers,
  pw, tg, trgLog } }`) and `trgClock` (the tests set their own) for tests. FORMAT `networks-42`. Untested on a headset: how
  a blended clip looks on a character there, the 0.3 s debounce with a real head, a voice started on entering through
  HRTF, a path's Hold going back, and how often a stay cube's restart feels right in a real room.
- **Sounds** (emitters): a sound file placed at a point, played through the shell's context (`HOST.audio.fx()`, never
  one of its own), each through an HRTF `PannerNode` (inverse distance, full volume within `r`, `rolloff` 1,
  `maxDistance` 50 m) and its own gain. The listener is the head in a headset (the shell's `HOST.sfx.listen`) and the
  camera on a page (put back at the origin in `dispose`). Silent while `fx()` gives no context (before a tap, hidden,
  the `<audio>` engine chosen) or the Sound button is off (`HOST.audio.muted`); not the Sound effects or Narration
  switches, since an emitter is the scene's own sound, not an effect (the Scene pane and a sound's card say so). An
  `always` loop starts at the same moment for everyone at a station (the room's time, `HOST.collab.now()`, modulo its
  length; outside a room from when the scene opened). Sounds up to 20 s (`STREAM_S`) are decoded once per file, at most
  60 MB decoded a scene (more: not loaded, said); longer ones (the owner's 4 min 16 s `first_room.mp3` would be about 98
  MB decoded) are streamed: an `<audio>` element per emitter (`crossOrigin` anonymous, the password as `?token=`)
  through `createMediaElementSource` into its panner and gain, its moment set by `currentTime`, paused (not torn down)
  while there is no context or the device is muted, a new element on a new context (an element feeds one context
  only). A stereo file is played from its point; the card says *mono files place best*. While editing: a small speaker
  in the sound's colour and a faint ring on the floor at `r`. A voice recorded with a movement (v125, its record's `sync`)
  plays with that item's recorded path instead of its own loop: from each start of the path, on the path's clock
  ("Recorded paths" below, "A voice with the movement").
- **Sounds that follow a model** (the owner, 4 November 2026: "also sound should follow a model, sometimes i might also
  want to select bones like the head for voice, breast for sounds she makes while moving etc"; `tools/studio/SPEC.md`,
  "Sounds that follow a model"): a sound's optional `on` (an object's id; since v119 also a shape's or an empty's, followed
  where it is, no bone), `bone` (a bone of its model, or for a model
  with no bones a part its clips move, by name as three.js gives it; none: the whole model, the object's holder) and `o`
  (an offset in metres in the target's frame, turned but not scaled, to the mm). Every frame, once every object's
  animation has stepped, its holder goes to the target's place plus the target's turn times `o` (`soundStep`; the
  speaker, labels, pointer and panner follow), not while a grip or the page's arrows carry it. A bone not found here: the
  whole model; the object not in the scene: its own `p` (kept so, dangling, from the room and from `layout.json` alike,
  until the object is back). Names are matched as given, then leniently (lower case, letters and digits only: an FBX's
  *mixamorig:Head* is *mixamorigHead* once a GLB). Its card: *Follows* (*Follow an object...*,
  a pick mode as *Pick what it shows*, the trigger or a click on an object, or the card's list of objects; *Move onto
  it*; *Stop following*) and the bone choices: a short list where the model has such a bone (*Whole model*, *Head*,
  *Neck*, *Chest*, *Hips*, the hands and the feet, by the end of the tidied name: Mixamo, Biped, Unreal, Rigify's
  numbered `DEF-spine`, VRM), then *More bones...* (all on a page, eight at a time in a headset). Attaching, another
  bone, a move by hand and *Stop following* keep it where it is (a move while its bone's model is still loading here
  writes `p` only: `measureNode`); sizing the object (its size steps, both grips, the arrows) scales the offsets of what
  follows it in the same change, and between the grips' writes by the size shown over the record's (`followK`);
  switching the object to its GLB turns the offsets of what follows its whole model (or names a bone it lacks) by the
  baked turn (`o' = r o`), bones keeping theirs; deleting it leaves its sounds where they are, following nothing (one
  Undo step brings both back). Heard only while it and its object are both shown for you (its fade times its object's;
  `start: 'shown'` from its beginning each time both are shown). While editing a thin line in its colour runs to what
  it follows, and its labels say so (*Voice → Dancer · Head*). Shared as its record (FORMAT networks-30, v112). Untested
  on a headset: how a voice at a moving head sounds, the pick by trigger and the bone pages on a real panel.
- **Cut-outs** (the owner, 4 November 2026: "is it possible to remove parts of a glb model nondestructive? like a door in
  a wall etc?", then "for the models i would just do parts that are hidden, which i can draw on the models or remove
  with boolean ops like a cube, whatever is easier"; `tools/studio/SPEC.md`, "Cut-outs"; `engine/e6b_cuts.js`). A
  cut-out (*Cut-out box* on the Add pane, *Cut out a part* on an object's card) is a box over part of one object's model
  that hides whatever of that model lies inside it, for everyone, the model's file never changed (the owner's atelier is
  one mesh with one material: nothing in it can be hidden by name). Its record `{ name, on, p, q, size }`: the object it
  cuts and only that one (`on`, required), its middle, a full turn and its size in that object's frame, turned but not
  scaled (metres; `p` and `size` to the mm, each side 1 cm to 50 m, `q` 4 decimals), so it stays on the same part of the
  model when the object is moved or turned; sized here, the object scales its cut-outs' records in the same change
  (`scaleFollowers`, `followK` between both grips' writes; a value past what a record takes held at the limit, never
  refused, and said on the object's card), and switched to its GLB they turn by the baked turn (`p' = r p`, `q' = r q`;
  scaled by `k = s' b / s` too where the new scale's 4 significant figures are not exact). Deleting the object deletes
  its cut-outs in the same step (Undo brings all back); duplicating it copies them onto the copy, each copy in every cube
  list its original is in; a cut-out whose object is not here (a layout, the room) is kept and cuts nothing. How:
  every material of an object with a cut-out (lit and as scanned) gets a small addition (`cutPatch`, `onBeforeCompile`;
  `customProgramCacheKey` the original's plus `|studio-cut-1`): each fragment's world place, from three.js's own
  `transformed` after skinning and morphs, is tested against the object's boxes (`uniform vec4 cutM[48]`, three rows of
  each box's inverse matrix, and `uniform int cutN`, at most 16: a model's first cut-out compiles its patched programs
  once, a box added after that nothing; more than 16 from a room or a layout: the 16 lowest ids cut, the same on every
  device), and one inside any is
  discarded; the boxes handed over as its first mesh is drawn each frame (`cutUpload`, `onBeforeRender`); each object's
  materials are its own clones, so two copies of one file never share a cut; a model with none keeps its materials. No
  extra pass, no change to the geometry; the hole's edges are open. Limits: 100 a scene, 16 an object, beyond them refused
  in words. A trigger cube shows or hides a cut-out as any item: hidden for you, the model is whole; it switches as its
  fade crosses one half, and one new here takes its state at once (the owner's door: a cube in front of the wall shows
  the cut-out, so the wall opens as you walk up). Made where the click or trigger that selected the model met its surface
  as drawn (`pressItem` keeps that ray, `cutRay`; one raycast as the button is pressed, `modelHits`, a skinned mesh's
  triangles where its bones put them), 0.8 x 2 x 0.4 m (each side at most a fifth of the model), upright, facing you;
  else at the model's middle. Its card: what it cuts and *Move onto another object...* (a pick mode, keeping its place),
  size steps per side (5 cm) and every side, *Turn 90°*, *Preview: As seen / Cut / Whole* (this device only, while
  editing; *Cut* cuts whatever the cubes say, so a door a cube opens can be sized with its hole in sight), *Duplicate*
  (beside it, in its cubes' lists), *Delete*, every change one Undo step. While editing its box is drawn in one warm
  red-orange, dashed edges, solid corner ticks over everything, *✂ Door*, its corner balls when selected, and nothing
  see-through (v125; the owner, 8 November 2026: "Framerate bad in studio edit mode when cutouts are active, they should
  not have this transparency": its faint fill went, a layer the size of the box on screen, two seen from outside;
  pointed at or selected its edges light up instead, lighter, their dashes denser and its ticks a third of each edge
  long, `LOOKS.CUT_LOOK`; v131: its lines, ticks and corners opaque too, one cutting nothing drawn darker, `LOOKS.CUT_OFF`,
  rather than fainter); the pointer
  finds the nearest object, sound or cut-out, passing over an object's unseen box when the ray goes on into one of its
  own cut-outs (and over cut-outs while picking an object for a sound or a cut-out); the page's arrows move,
  turn and size it per side; in a headset the grip carries it (turning with the hand while free moving is on), both grips
  size it, a corner stretches it. Not editing, only the hole. The Items pane shows each object's cut-outs as tags on its card. *Lock cut-outs* on the object's card (v124; the owner, 8 November 2026: "add cutout lock mode where the cutouts
  for an object are locked and cannot be moved anymore, cutout boxes should be hidden then but show again if it is
  unlocked"): the object's record gains `cutsLocked: true` (kept only when set; anything but a boolean makes it bad; a
  copy's are not locked; shared and saved, in v124's `FORMAT` networks-36); its cut-outs cut as before, but their boxes
  are never drawn or pointed at (`cutsHid`), they do not move, size, turn or go (`lockNames`), no cut-out is added to it
  or moved onto it (`canCut`, `cutOnto`), the object is not deleted until they are unlocked, its card says so in place of
  their list and the Items pane shows one tag (*🔒 ✂ 2 cut-outs locked*, a press selecting the object); *🔒 Cut-outs
  locked* again unlocks them and their boxes show again. One Undo step each.
  `layout.json`'s `cuts`, `state()`'s `x.<id>` (FORMAT networks-31, v113). Untested on a headset: how the holes look on a
  Quest, the shader's cost with a big scan and 16 boxes, the grips on real controllers, the one raycast against a big scan.
- **Groups** (the owner, 5 November 2026: "grouping things (models, sounds, etc) in studio mode so that they move together";
  `tools/studio/SPEC.md`, "Groups"; `engine/e6c_groups.js`). A group (`{ name, items }`, kind `g`) is a named set of objects,
  sounds and trigger cubes, and since v119 shapes and empties (a cut-out belongs to its object, so never a member); an item is in one group at most (an id
  two groups name stays in the one with the lower id, `groupOf`, the same on every device), no groups in groups, 50 a
  scene. *Make a group...* on an item's card makes a group of it and starts a pick mode (a click, the trigger or a pinch on
  an item puts it in or takes it out, Ctrl- and Shift-click as a click, cards under Items too; one in another group moves
  into this one; *Done*); *Add or remove items...* on the group's card the same. A click on a member selects its group (its
  card, a dashed box round its members while editing (opaque, v131), `LOOKS.group`), a second one on the same member that member
  alone (*In group ...*, *Select the group*; selected alone it moves alone); hover labels say *Group 2 · Dancer*; the
  Items pane shows groups first, a heading each with its members' cards under it. A selected group moves, turns and sizes as one about its
  pivot (the mean of its members' middles, on the floor, `groupPivot`: a turn or a size carries every middle with its
  member, so the pivot stays put; the middle of their box shifted after a turn that was not a quarter, and the next turn
  hopped): turns about the vertical only (an object's turn and a cube's yaw gain it), sizes alike on every axis (places,
  an object's `s` with its cut-outs and its sounds' offsets through `scaleFollowers`, a cube's size, a sound's reach; a
  value past its limit held there, a place within 1 km of the scene's origin too, and said on the card); a sound in
  the group that follows an object in it simply follows, one that follows an object outside it moves as carried by hand
  (`soundAt`). On a page the arrows on the pivot (Y ring only), *Turn 90°*, size steps, *On the floor* (the lowest point
  of its objects: cubes and sounds stand on nothing); in a headset the grip on any member (unless selected alone) carries
  the group (a yaw from the hand only while free moving is on), both grips size it about its pivot; the other hand
  carrying the group, a grip on a member joins it; the other hand carrying a member alone, a grip on another member
  carries that one alone. An item removed while a hand holds it (a group gone from the room too) ends that hand's change
  in the next frame (`XR.lost`, `xrLost`). Every move one change (one Undo step, every member written in one state). *Duplicate*
  (every member copied as a new group beside it: a following sound's copy follows its object's copy, a cube of the group
  lists the copies, each copy joins the lists of the cubes outside the group its original is in, cut-outs with their
  objects), *Ungroup*, *Delete* (every member). A group left with fewer than 2 members goes in the same change (not one
  picking now); one made and left with its one item when picking ends is taken back as never made. Undo while picking
  picks on; an Undo that leaves a group with one member leaves it picking again (as before that step), any other group
  it touched and leaves with fewer than 2 goes (`groupUndone`). A group with fewer than 2 of the items placed is never written to `layout.json`,
  the draft or *Unsaved changes* (`placedItems`). A cube's *Pick what it shows* / *hides* on a grouped item toggles all
  of its group's members (a cube in a group of cubes alone selects as any cube does). `layout.json`'s `groups`, `state()`'s `g.<id>`
  (FORMAT networks-32, v114). Untested on a headset: the grips carrying and sizing a group on real controllers, the pick
  mode by trigger, how the box reads.
- **Faces** (the owner, 5 November 2026: "double sided and flip inside out settings per model?"; `tools/studio/SPEC.md`,
  "Faces"). An object's optional `faces`: absent or `null` (*As in the file*, each material's own side as loaded), `'both'` (*Both
  sides*: `DoubleSide`) or `'inside'` (*Inside out*: `BackSide`, three.js turning the normals so the light follows), on the
  object's own materials (its clones, lit and as scanned, `applyFaces`; the side as loaded kept as `side0`), so two copies
  of one file may differ; set again whenever its model is built (a file changed on the relay, a GLB switch, which keeps the
  record's `faces`), and with its cut-outs' addition. A row on the object's card (page and headset): *Faces: As in the file
  / Both sides / Inside out*, one Undo step, shared and saved (FORMAT networks-32). The file is never changed. Untested on
  a headset: a scan inside out seen from within, the cost of double sides on a big scan.
- **Tint and brightness** (v125; the owner, 8 November 2026: "Studio: add tinting and brightness for models placed in the
  scene"; `tools/studio/SPEC.md`, "Tint and brightness"). An object's optional `tint` (`'#rrggbb'`, lower case) and
  `bright` (a factor, 0.25 to 4, to 2 decimals; 1 is none), each kept only when set (anything else makes the record bad, a
  brightness out of range held at its limit; FORMAT networks-37). On the object's own materials, lit and as scanned: each
  material's colour as loaded (`userData.col0`, kept as `libClone` and `scanMat` make it) times the tint, times the
  brightness (`applyTint`, `tintMat`; past 1 a texture brightens too), so two copies of one file may differ; put on again
  whenever its model is built (a file changed on the relay, a GLB switch, which keeps the record), and untouched by Change
  texture's and Fewer triangles' previews and the cubes' texture changes (they swap pictures, never a colour). Rows on the
  object's card (page and headset, editing on, never refused by a lock in place): *Tint: None* and the shapes' ten
  swatches, on a page *Any colour* (a colour field, taken once chosen), and *Brightness: n %* with *Darker* (×0.8),
  *Brighter* (×1.25), held at 25 % and 400 %, and *Reset*; one Undo step each, shared and saved. A group selected has the
  same rows for every object of it in one step (Darker and Brighter on each one's own). The file is never changed; the
  Add and Items panes' pictures stay the file's. Untested on a headset: how tints look on a Quest.
- **Shapes, empties, locks, the scene's settings and the lobby** (v119; the owner, 6 November 2026: "Needs invisible
  occlusion cubes and other primitives to hide things and just in general"; "Needs empty objects for example to place
  sounds in space"; "an option to lock things in space so we cannot accidentally move them"; "an option to hide all other
  icons and circles in studio mode"; `tools/studio/SPEC.md`, "Shapes and empties", "Locked in place", "The scene's
  settings", "The lobby"; `engine/e6d_shapes.js`, `LOOKS.shape`, `LOOKS.empty`).
  - A shape (`p.<id>`, `shapes`): `{ name, shape: 'cube' | 'sphere' | 'cylinder' | 'plane', p, q, size, colour, look }`,
    added from the Add pane's *Shapes* row (a 50 cm box or ball, a 50 cm by 1 m cylinder, a 1 m plane, upright, facing
    +z; 1.5 m in front of you on the floor, selected; 200 a scene). `look: 'colour'`: lit in its colour (ten swatches on
    its card, `#rrggbb` lower case), fading as an object does; `'hide'`: drawn into the depth alone (`colorWrite: false`,
    `renderOrder` -1, after the stage's floor and sky, before the items), so the scene's own things behind it are not
    drawn there: in AR the real room shows through it, in VR the stage; a closed shape hides from its outside only, a plane
    both ways; while editing its edges show where it is, opaque (v131: no fill drawn; a ball's three great circles, a
    cylinder's rims and four lines along it, a plane's outline; an unseen fill keeps it pointable from inside and outside;
    a cube hiding it from you: nothing hidden), and every shape has its tag (*Box · 12 ▲ · hides things*, its primitive's
    triangles). It moves, turns (fully) and sizes per axis: the page's arrows (scale in its own frame),
    the grips (turning with the hand while free moving is on), both grips (every side alike), a cube's corners; its card:
    *Shape*, *Look: Colour / Hides things*, *Colour*, size 10 cm a press per side and ×0.5 to ×2, *Turn 90°*, *On the
    floor* (its exact lowest point: a ball's and a cylinder's as turned). A trigger cube shows or hides it, a group holds
    it, a sound follows it (its place and turn; its offsets not scaled with its size).
  - An empty (`e.<id>`, `empties`): `{ name, p, q }`, a point with a turn, drawn only while editing (a small axis cross,
    x red, y green, z blue, over everything, a ball in its colour, its name; an unseen ball for the pointer); added from
    the Add pane (1.2 m up; 100 a scene). A sound follows it as it follows an object (*Follow an object...* lists objects,
    shapes and empties; the pointer on one picks it), heard only while the empty is shown for you (a cube may hide it).
    Its card: where it is, the sounds that follow it, *Turn 90°*. Moved and turned (not sized), in groups and cube lists.
  - *Lock in place* (`locked: true` on any item's or group's record, kept only when set; *Lock in place* / *🔒 Unlock* at
    the top of every card, right under its heading, page and headset, since v128 (the owner, 9 November 2026: "move the
    locked toggle all the way to the top"; until then by its Duplicate and Delete), one Undo step, shared and saved): a locked item does not
    move, turn, size or go, whichever way is tried (its card's buttons greyed and refused, the Delete key, the page's
    arrows not attached, the grips, both grips, a corner and *Hold it* refused with a short buzz and a knock); a group's
    lock holds its members (selected alone too), and a group with a locked member does not move or go and says which; an
    object with a locked cut-out is not deleted (the cut-out moves with it as ever); *Ungroup* is refused only by the
    group's own lock. The card's top says what holds it (*Refused:* in red for 4 s after a try); labels and the Items pane's
    cards mark it 🔒. A copy (Duplicate, a group's) is never locked. The room's records and Undo are never refused. Editing a
    locked item's other fields (light, colour, look, clip, its cube lists) is allowed.
  - The scene's settings (`settings`, in `layout.json` and in `state()`, so for everyone at that studio's circle; rows on
    the Scene pane while editing, page and headset, one Undo step each, counted by *Unsaved changes*; a new scene's:
    shown, as each headset has it): *Other circles: Shown / Hidden* and *Real world hides the scene: As each headset has
    it / Always / Never*. The studio tells the shell each time what it wants changes (`settingsStep`, every frame,
    guarded: `HOST.collab.hideOthers(true)` while this device is at this studio's station with the other circles hidden,
    `false` otherwise; `HOST.occlusion.scene(null | 'both' | 'off')` while the scene shows here, `null` otherwise), and both
    back (`false`, `null`) as it goes (`dispose`); away from the station, on the Stories screen or for another scene (a
    new scene's settings) they are off. The shell draws or hides the circles and does the occlusion (the shell's lane:
    real-world occlusion is on by default for every headset in AR).
  - The lobby: the studio's returned object has `lobby()`, which the shell calls as this headset walks into the room's
    *Back to the lobby* circle: this device forgets what it has seen (as *Reset what I have seen*, and more: every item
    starts again from its beginning the next time it is shown: a `shown` animation or sound, a sound that plays once);
    nothing is written to the room. Away from its station (the lobby, before any circle) nothing of the scene is shown for
    that device (`triggerStep`), so it all starts afresh on its return.
  - FORMAT networks-34. Untested on a headset: how a shape that hides things looks against the real room in AR (its edges,
    the depth's precision against the room's occlusion), the empty's cross in a headset, the lock's buzz, the circles
    hidden at a studio's circle and the occlusion setting with the shell's real-world occlusion, the lobby hook as a
    headset walks into the lobby.
- **Behaviours** (v120; the owner, 6 November 2026: "Add follow the player/avoid the player/an object etc to objects",
  then "behaviours should be shared for each headset so only react to one headset, example closest or first player who
  walks close"; `tools/studio/SPEC.md`, "Behaviours"; `engine/e6g_behave.js`). An object, a shape or an empty may have a
  `behaviour` in its record, with only its kind's fields: `look` `{ who, range }` (its front, `+z` as placed, turns to the
  person about the vertical through its middle), `follow` `{ who, range, dist, speed, side }` (comes to about `dist` in front of
  them, at its own height, turned to them; v127, the owner: "follow mode should also be able to be behind someone", "left
  right sounds good too": `side` `'behind'`, `'left'` or `'right'` puts it there instead, facing the way they look, so it
  walks with them; in front is no `side` at all, as before; FORMAT networks-39), `avoid` `{ who, range, dist, speed, area }` (keeps `dist` away along the floor,
  within `area` of its place, home once home is `dist + 0.2 m` clear of them) or `item` `{ target, speed, face }` (follows
  another object, shape or empty at the offset they are placed at, where that one is before its motion, `it.pre`, which
  `drawnPose` keeps, a little behind, turning with it as the two are placed). Which way Follow and Follow an item face
  (v128; the owner, 9 November 2026: "when a model is in follow there should be a switch to look at the person or item it
  is following instead of into the same direction as the person"): `face` `'them'` (its front, `+z` as placed, turned
  about the vertical through its middle to the person, or to the followed item's middle as drawn before its motion; right
  over it, within 5 cm along the floor, it keeps its turn; an item keeps its place where the offset puts it) or `'along'`
  (Follow: the way the person looks; an item: the turn it is placed at with that item, turning with it); absent, as
  before v128 (Follow in front `'them'`, behind or at a side `'along'`; an item `'along'`), so older layouts and rooms
  look the same; once pressed on the card it is kept, also when the side changes, and written as given; a value other
  than these makes the record bad; look and avoid drop it; FORMAT networks-40. `who` `'nearest'` (another nearer by 0.3 m takes over) or `'first'` (kept until
  `range + 0.5 m` away), `range` 3 m, `dist` 1 m (follow) or 1.5 m (avoid), `speed` 0.6 m/s, `area` 2 m by default, to the
  cm and held at their limits; a bad one makes the record bad. One person at a time among those in a headset at its
  circle (pages never count; outside a room this device's own head, a page's camera in Walk view too), chosen alike on
  every device from the shell's `HOST.collab.heads()` (the heads of the people in a headset at this device's live
  station, its own among them, from presence in room coordinates with the relay's time of each; since v125 room
  coordinates are the scene's at a station, no turn needed: "Placement in a headset" below): that person's headset drives it, moving it every frame from its own head
  (exact) and sending its move along the floor and its turn (the quiet effect `beh`, about ten times a second, every item
  it drives in one; once more with an end when it stops), every other device drawing it 120 ms behind those samples
  (the relay's clock), between them; ended or silent for 1 s, nobody in range, it goes home by itself, alike everywhere;
  two drivers at once settled by their claims (`'first'` the earlier arrival, `'nearest'` the newer driver, ties by id).
  `item` needs no driver. It is the pose pipeline's base stage (`POSE.base`, set only while the scene has a behaviour, so
  a scene without one is drawn exactly as before; while one has, every object, shape and empty goes through the
  pipeline), so a path and a motion draw over it and **the record never changes**; as a motion, it goes on while selected
  and rests while held here or paused (v122). Its card (page and headset, before Motion): *Behaviour: None / Look at / Follow / Keep away
  / Follow an item...* (pointing at one, or the card's list), *Reacts to: Nearest / First to come close*, *Notices people
  within*, Follow's *Where: In front / Behind / Left / Right* (v127) and *Faces: Them / Where they look* (v128, a line under
  it in words that match), *Stays in front of them at* (*behind them*, *at their left*, *at their right*) or *Keeps away
  by*, *Stays near its place, within*, *Moves at most*, and an item's *Faces: The item / As placed* (v128); one Undo step
  each (a new kind drops `face`; another item to follow keeps it); a group's copy follows its own. `STUDIO.behave(id)`, `BEH.fake` and `BEH.log` for tests. FORMAT networks-35
  (v120). Known limit: in VR the stick walk moves the scene for one headset alone, so near a boundary the others may choose
  differently for a moment. Untested on a headset: all of it at a real station (being followed, looked at or avoided life
  size, the choice and hand-over between real headsets over Wi-Fi, how smooth 120 ms behind looks, the cost), and how
  Faces feels there (a model walking beside you that turns to look at you, an item turning to look at the one it follows).
- **Motions** (v120; the owner, 6 November 2026: "Add little animations like spin and wobble etc for models?", then
  "animations do 1 and 2", 1 simple motions, 2 the recorder, "Recorded paths" below, curves later; `tools/studio/SPEC.md`,
  "Motions"; `engine/e6e_motion.js`). An object, a shape or an empty may have a `motion` in its record: `spin` (turns about
  the axis through its middle), `wobble` (tilts `amount` degrees, the tilt going round the axis), `bob` (along the axis by
  `amount` metres), `pulse` (grows and shrinks about its middle by `amount`, a share; no axis), `orbit` (round a circle of
  `amount` metres across the axis, its facing kept) or `sway` (swings `amount` degrees each way about the axis); `speed`
  turns or swings a minute (0.1 to 600, negative the other way), `axis` the scene's `'y'` (default), `'x'` or `'z'`,
  `start` `'always'` (on the scene's clock: at a station the room's, `HOST.collab.now()`, so everyone there sees the same
  phase; outside a room since the scene opened) or `'shown'` (from when it was last shown here, per device, as animations
  and sounds started when shown); the kind's own speed and amount when left out, out of range held, a bad one making the
  record bad. One pose pipeline draws it (`drawnPose(it, now, clockS, out)`: the placed pose, or what a behaviour gives
  instead, `POSE.base`; then its recorded path, `POSE.path`, below; then the motion, `motionDelta`, about its middle in
  the scene's frame), written each frame into the holder's matrix (`poseStep`, `matrixAutoUpdate` off while it moves), so
  the model, its unseen box, its labels and a sound following it or one of its bones come along (a pulse grows an
  object's followers' offsets, `motionK`), its cut-outs take the same change (`poseCut`); the holder's place, turn and
  scale stay the placed pose, so **the record never changes**, and a group's members move only by their own. Since v122
  it goes on while selected (editing or not: a motion picked on its card shows at once), and rests at its placed pose
  only while this device holds it (`motionRests`, from `restScan`'s list made once a frame: a grip or the sticks, its
  group carried, the page's arrows dragged on it or its group, its path being recorded, a sound or a cut-out on it
  carried, a group holding a sound on it carried), while a cut-out on it or a sound following it is selected here
  (editing: their arrows, box and corners stand on it where it is placed, so a drag of them never jumps; they have no
  ghost of their own) or Pause is on here ("The ghost, Pause and placing what moves" below);
  what is measured against it (attaching a sound, a bone, *Move onto it*, *Stop following*, a group's pivot, box, moves
  and *On the floor*, sizes, a cut-out's frame) is measured at its placed pose (`poseRest` in an action, `atPlaced`
  inside a frame). Its card (page and headset, editing on, not refused by a lock): *Motion: None / Spin / Wobble / Bob /
  Pulse / Orbit / Sway*, *Speed* (*Slower*, *Faster*, *The other way* for a spin and an orbit), *How far* (*Less*,
  *More*), *Axis*, *Starts: Always / When shown*, and a line saying it goes on while selected (a ghost where it is placed)
  and rests while carried; one Undo step each, shared and saved; then *Motions: playing / paused* and *Start again*. `STUDIO.pose(id)` for tests. FORMAT networks-35
  (v120). Untested on a headset: how the motions look and feel life size, their phase across real headsets at a station,
  the cost of many moving items on a Quest.
- **Recorded paths** (v120; the owner, 6 November 2026: "just animate objects by dragging them? Animation recorder?", then
  "animations do 1 and 2"; `tools/studio/SPEC.md`, "Recorded paths"; `engine/e6f_path.js`). An object, a shape, an empty
  or a sound may have a recorded `path` in its record (a group has none: its members each keep their own and move with
  it, and its card says so; cubes and cut-outs have none, a cut-out going with its object's): `k`, its keys `[t, dx, dy,
  dz, qx, qy, qz, qw]`, `t` seconds from 0 (to the ms, the first 0, strictly increasing, the last at most 120), the pose
  then relative to its placed pose (the place in its placed frame turned but not scaled, to the mm; a turn after its
  placed turn, 4 decimals; a sound only moves), 2 to 600 keys an item and 6,000 a scene (so the station's state, one value
  at the relay, stays well under its 256 KB: a recording that would take the state past 224 KB is refused too); `play`
  `'loop'`, `'once'` (held at its last key) or `'bounce'` (back and forth); `start` `'always'` (the scene's clock: at a
  station the room's, the same moment for everyone there) or `'shown'` (from when it was last shown here); `speed` 0.25 to
  4. A bad one makes the record bad; a layout or a state from the room past the scene's 6,000 keys has the item past them
  dropped (counted) or ignored; a copy (Duplicate, a group's) that would pass them, or the state's 224 KB, is refused in
  words. Drawn by the pose pipeline as `POSE.path` (between keys the place in a straight line and the turn by slerp, then
  a motion on top), so moving or turning the item moves or turns its whole path, its record's place stays where it is
  placed, and what follows it (a sound, its cut-outs) comes along; a sound that follows something moves with that, its own
  path waiting until it follows nothing. Switched to its GLB, an object's keys are turned by the baked turn (`d' = r d`,
  `q' = r q r^-1`, `pathTurned`), so it moves as before. As a motion, it plays on while selected and rests at its placed
  pose while held here or paused (v122; *Play it here*, `STU.recPlay`, went: *Start again* takes its place); selected while
  editing it has a timeline under its rows (v128, "A model's timeline" below: its own clock held, for everyone at a circle,
  shown through Pause). **Recording** (this device's own; nothing is written to
  the record or the room while it runs): in a headset *Record its movement* on its card arms it (`XR.rec`, as *Hold it* is
  armed: the two disarm each other, as do another selection, editing off and the session's end); the next grip of either
  hand, on it or anywhere, carries it as usual and records its holder's pose 30 times a second until it is let go (the
  sticks turn it and push it, and that is recorded; neither the left stick nor a second hand sizes it: a path has no size);
  on a page *Record* on its card starts it and *Stop* (or *Cancel*) ends it, the arrows (Move, Turn) and its card's
  buttons moving it meanwhile with their real timing (its size steps and the Size arrows off), the page's whole recording
  one change; selecting something else keeps it as Stop does, editing off cancels it. Then the samples are simplified
  (`pathSimplify`: a key kept wherever leaving it out would move its middle more than 5 mm or turn it more than 1 degree;
  4 mm and 0.9 degrees there, the rest left for rounding), and the path is written into its record with its place as it
  was when the recording began, one change, one Undo step (a *Record again* keeps the old path's play, start and speed);
  a path that plays in a loop is joined first (the loop join, below); it plays at once. Refused in words (`REC_NOTE` on its card): too short, not moved, more than 600 keys once simplified, the
  scene's 6,000, the shared state's 224 KB; a locked item (*Lock in place*) and a sound that follows something cannot be
  recorded; at 120 s the recording stops by itself and is kept. Its rows (page and headset): *Recorded path: n s, k keys*
  with *Record* / *Record again* (page) or *Record its movement* (headset), *Plays: Loop / Once / Back and forth*, *Starts:
  Always / When shown*, *Speed* (*Slower*, *Faster* through ×0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4) and *Delete recording*,
  one Undo step each; what the loop join did, with *Keep it as recorded*; *Motions: playing / paused* and *Start again*.
  `RECLAST` keeps the last recording's samples and
  `recClock` its clock (the tests set their own). FORMAT networks-35 (v120). Untested on a headset: recording with real
  grips and sticks (the pose sampled from a real carry at the headset's frame rate), how a recorded path plays back life
  size, its phase across real headsets at a station, a recording's simplification and its stall on a Quest (a 120 s one
  at 30 samples a second), the cost of many items on paths.
  - **Ten minutes, as a file** (v125; the owner, 8 November 2026: "Add voice recording option to the motion recorder,
    make length up to ten minutes possible?"; `tools/studio/SPEC.md`, "Ten minutes, as a file"; `engine/e6j_voice.js`).
    With a relay that takes uploads a recording may run up to 600 s (`recCap`, then it stops by itself and is kept;
    without one 120 s as before). One that fits the old limits (at most 120 s and 600 keys once simplified) stays in the
    record; a longer one, or one of more than 600 keys (up to 40,000), is kept as a file of the scene,
    `recordings/<the item's name>-<n>.json` (`{ studio: 1, recording: 1, item, len, n, k }`, the keys as a record keeps
    them; the first `n` free, never written over, so Undo can give an older record back with its file; at most 4 MB, the
    relay's rule), uploaded as the converter's GLBs are (`upSend`: through the relay or straight into R2), and the
    record's path is then `{ src, len, n, play, start, speed }`, written once the file is in (one change, one Undo step;
    the item stands where it is placed meanwhile: the change a page's recording ends, the item put back where it began,
    is empty and dropped). A recording of more than 2 minutes of samples is simplified a slice of about 8 ms at a time
    between timer tasks (`recSoon`, `simplifySoon`, `simpStart`/`simpRun`: the same keys as `pathSimplify` at once; the
    card says *Simplifying the recording*), so a headset never stalls on it (measured in headless Chromium: 18,000 jittery
    samples, 43 ms of work at once in 6 slices, the longest 8 ms; the ten-minute test's 18,000 smooth ones in 17 slices,
    the longest 19 ms; untested on a Quest); its upload's share on the card. The device that made it keeps its keys (`PF`, `own`); every other
    device reads the file (`pathK`, `pfLoad`, through `call()`: the password as a header, R2's signed link) once it is
    listed, and again when it changes; until then the item rests where it is placed. The scene's 6,000 keys and the
    shared state's 224 KB count only keys in records (`pathN`). Without a relay that takes uploads a recording that needs
    a file is refused in words (*A recording longer than 2 minutes needs a relay that takes uploads*; more than 600 keys:
    *... a longer one is kept as a file of the scene, which needs a relay that takes uploads*). A GLB switch writes its keys
    turned into a new file first (`pathFileTurned`, `pathFilesTurned`, then `switchToGLB`'s `pmap`); an object whose file
    cannot be turned (no relay that takes uploads, its keys not read within 5 s, the upload refused) is not switched: it
    stays on its original, where it plays as before, and its card (`it.swNote`, page and headset) and the conversion's note
    (`heldWords`) say why, *Switch to the GLB* trying again. *Move the scene to this circle* turns a sound's own path kept
    as a file into a new file the same way first (`sceneToCircleFiles`), or is refused in words, nothing moved. Loop, once, back and forth, speed,
    Start again, the loop join and *Keep it as recorded* work for both kinds. Its card: *Recorded path: 4:12, 3,812 keys,
    kept as a file* and the file's name. FORMAT networks-37 (`src` on a path, `sync` on a sound).
  - **A voice with the movement** (v125; `tools/studio/SPEC.md`, "A voice with the movement"; `engine/e6j_voice.js`).
    *With my voice: on / off* among the recorder's rows (an object's, a shape's and an empty's card, page and headset; this
    device's own, `studioRecVoice`, kept) asks for the microphone as it is turned on (`getUserMedia`, 15 s at most; the
    headset's card says to allow it on the 2D page first: the browser may not show its question inside a session); greyed
    without a relay that takes uploads or `MediaRecorder`. While a recording runs with it on the microphone is recorded
    (`MediaRecorder`, a chunk a second) with a short level meter on the card (an analyser on the shell's context,
    connected to nothing else). Kept with the recording (dropped with one cancelled or refused): made a mono sound as the
    Upload pane makes sounds (up to 20 s a 16-bit WAV at 48 kHz by `monoWav`; longer, the relay's `ffmpeg`'s mono MP3;
    without it as it came), uploaded to `sounds/<the item's name>-voice-<n>`, and placed as a sound item *<item> voice*
    following the recorded item (its *Head* bone when it has one, else its top), `loop: false`, its record's `sync` (the
    item's id), `skip` (the stillness the loop join cut from the path's start less how late the microphone began; negative:
    it starts that much later, its card says so) and `len` (where it ends in the path's own time: its file's end, `dur -
    skip`, at most the path's end, so a voice whose microphone began late is not cut short at its end); the path and the
    sound one change, one Undo step (the files stay). *Record again* with it on writes a new file (the first `n` free, never
    the old one written over) and points that sound at it (one sound per recorded item: `voiceOf`), so Undo gives the old
    file back and no device keeps playing an old copy of a file changed under it. It plays from each start of the path
    (`syncAt`: each loop; once; on the way there with back and forth), on the path's clock, so everyone at a circle hears it
    at the same moment (a decoded voice started 20 ms ahead at where it will be, `start(when, offset, duration)`; a streamed
    one, longer than 20 s, set to its moment as its element can take it, 50 ms ahead to begin with, then kept there:
    `syncStream` compares its element with the path's clock about twice a second and sets it again when it is more than 80
    ms off, ahead by how late its last setting came in, `S.lag`); either at its level at once at each start (not faded in);
    at a path speed other than ×1 at its own pace from each start (its card says so). The recording deleted (or its item gone), it plays as a sound of its own, its card saying *no longer synced*.
    A group's copy of a voice plays with its item's copy. `STUDIO.voice(id)` (a streamed one's element, drift and settings
    too), `STUDIO.pf(src)` and `SIMP.last` for tests. Untested: the microphone in a Quest session, how a voice sounds
    following a model there, a voice over 20 s through a real relay's `ffmpeg`, a streamed voice kept on the path's clock
    in Quest Browser (its element's seeking) and across real headsets, Safari's `MediaRecorder`.
  - **Stays on the floor** (v130; the owner, 10 November 2026: "When animating an item have an option that keeps it
    grounded, stuck to the floor with the side thats closest to the floor when starting"; `tools/studio/SPEC.md`, "Stays
    on the floor"; `engine/e6f_path.js`: `FLOOR`, `recDown`, `recFloor`, `floorRows`). *Stays on the floor: on / off*
    among the recorder's rows (an object's, a shape's, an empty's and a sound's card, page and headset; this device's own,
    `studioRecFloor` in `localStorage`, off by default; a line under it says what it does). A recording begun with it on
    sets an object or a shape down first, its lowest point on the floor (`y = 0` in the scene's frame, as *On the floor*
    measures it: `objBox`, `shapeBox`), and that is where it begins (its ghost there) and the place written with its path;
    then every frame, before it is sampled and drawn (`recFloor`, first in `recSample`, so after a headset's carry and its
    sticks; on a page also as the arrows move it, before `tcRead`), its height stays and its turn keeps only its turn about
    the vertical since it began (a swing-twist split about the scene's `y` axis: `q = twist q0`), so it slides along the
    floor and turns about the vertical, the side that was lowest kept on the floor. An empty keeps its height and turns
    only about the vertical; a sound keeps its height; an object whose model is not in yet keeps its height. On a page the
    arrows lose their up arrow and tilting rings while it records so, and *Stand up* is refused and greyed. Its keys hold to
    it (to a record's rounding), nothing new in the record (no `FORMAT` change); the loop join, simplifying, the voice, ten
    minutes as a file and *Record again* work as before. Cancelled or refused, it goes back where it was before it was set
    down (nothing to undo); kept, one change, one Undo step, as ever (one kept later by `recKeep` writes the set-down place
    with its path). Untested on a headset: how carrying something that stays on the floor feels (the hand lifting it while
    it slides below), recording so with real grips and sticks, how a grounded path plays back life size on a real floor.
- **The ghost, Pause and placing what moves** (v122; the owner, 7 November 2026: "when selecting animations on the item
  motion tab they should also show on the item as a preview"; "to make placing easier add a pause motion button but i also
  want to be able to move moving/animated items to select their exact place"; `tools/studio/SPEC.md`, "The ghost, Pause
  and placing what moves"; `engine/e6h_ghost.js`). An item with a motion, a recorded path or a behaviour goes on while it
  is selected. While a selected item (or a selected group's member) is drawn more than 1 cm or 1 degree from its placed
  pose (`ghostFar`, from `it.mX`; and for 0.6 s after, so a spin through its place does not blink it), and since v124
  every item that moves while editing, selected or not (the owner, 8 November 2026: "in edit mode Ghosts should always
  be visible for animated things"; at most `GHOST.build`, 4, new ones a frame; none once it rests, none with editing
  off), and since v125 a model its own clip moves while editing, the whole time its clip plays, selected or not
  (`clipMoves`: the owner, "I do not see the ghosts of moving things in studio mode"; its parts taken in their rest pose and put back as they were, never through the mixer, v129: with its clip standing
  still three.js's mixer wrote nothing back and left the model in its rest pose;
  its holder never leaves its placed pose, so the page's arrows stand on the item there), its ghost stands there (`GH`, `ghostStep` at the end of `itemsStep`): an object's model copied with its geometry shared and one
  opaque light grey material (v131; the owner, 10 November 2026: "ghosts for example can just be a light gray"; until
  v130 pale blue-white at 0.25, no depth written: Lambert, depth written, pushed a hair back by `polygonOffset` so the
  item wins where the two meet, a mesh without normals flat-shaded; a skinned mesh as a plain one, its rest pose), a
  shape's shape, an empty's cross and dot, a sound's speaker, all opaque; a model of more than 100,000 triangles
  (`GHOST.tris`), a model its own clip moves (its ghost would stand where it is drawn: the owner, "outline box is fine,
  just make sure it has no transparent walls") and a model a cube hides from you only its unseen box's edges, opaque
  lines (`ghostLine`; no clip ghost at all for a hidden one: its own edges stand there);
  built once per selection and freed when it changes (its materials disposed, never the shared geometry). The ghost is
  pointed at as the item (its unseen box among `pickables`, `userData.ghost`): the trigger selects the item, the grip on
  the ghost (or on the item where it is drawn) carries it from its placed pose, and let go it moves on from there. On a
  page the arrows stand on the ghost: `TransformControls` hold a stand-in, `TCP`, at the placed pose while the item is
  drawn moving (`tcTarget`, `tcProxy`, `tcStep`; never switched during a drag), each change going into the holder's
  place, turn and scale and then `tcRead`, as a drag of the item would; the item rests there while dragged (it is
  carried). A cut-out made where a click met a moving model goes on that part of it (`cutRay` keeps the ray in the model's
  own frame as drawn then, or as placed for a ghost; `cutAt` casts it onto the model at its placed pose). **Pause**
  (`MPAUSE`, `pauseSet`; this device's own, never in `state()`, never saved, off as soon as editing is off, never for a
  visitor): *Motions: playing / paused* on the Scene pane while editing and on the card of anything that moves (a motion,
  a path, a behaviour, a model's animation that plays), P on a page; every item at its placed pose (a behaviour this
  device drives given up, its last sample saying so), the models' animations holding their frame (`animStep` sets no
  time), sounds playing on; played again, everything goes on by its clock. *Start again* (this device's, no change
  recorded) on the card of an item whose path or motion starts *When shown* or whose path plays *Once*: its *shown* clock
  from now (`it.shownAt`), a path that plays once played once more (`it.again`). **The recording's ghost and the loop join**
  (the owner: "when animating a 'ghost' of the model should stay in the initial place so that one can hit it again for
  better loops, these loops could then even autosmooth if the start and the end are close"): while a path is recorded
  its ghost stands at the start pose (`REC.p0`, `REC.q0`, `REC.s0`) the whole time; once the item has been more than 15
  cm (its middle) or 30 degrees away (`REC.away`), coming back within 5 cm and 10 degrees lights it (greenish white) with
  a soft tick at the ghost (`hover`, forced) and a gentle pulse on the carrying controller (`buzz(c, 0.1, 25)`)
  (`recGhost`); let go or *Stop* while it is lit puts the end exactly on the start. A path that plays *Loop* (a new one's;
  *Record again* keeps the old play) is joined (`pathJoin`): its still start (until it has moved more than 1 cm or 1
  degree) and still end (after it last moved that far) cut, then, with its end within 15 cm and 20 degrees of its start,
  its last 0.5 s (a quarter of it under 2 s) bent onto its start (its place along a cubic Hermite to the start's place and
  the speed of its first 0.1 s, its turn by a smoothstep-weighted correction), its last key its first's pose; then
  simplified. Its card (`REC_NOTE.join`, while `RECLAST` holds the recording): *Loop closed: its end met its start (6 cm,
  4° apart; 0.4 s of stillness cut)* with *Keep it as recorded* (the raw samples simplified, one Undo step), or *Its end is
  40 cm from its start, so it jumps back each loop: record again and end at the ghost to close it.* Nothing new in the
  record or `state()`: no `FORMAT` change. `STUDIO.ghost(id)` for tests. Untested on a headset: how the ghost reads life
  size and over a real room, carrying an item by its ghost with real controllers, finding the ghost by hand while
  recording, the tick and the pulse on a real controller, how a joined loop looks there, Pause from the headset's panel.
- **A model's timeline** (v127; the owner, 9 November 2026: "items that have an animation should show a timeline and play
  pause in edit mode when selected", "play and pause for everyone in the circle", "pause and scrubbing is temporary";
  v128, after trying it: "please add timeline and play pause also for recorded items", of a 1.3 s clip in a headset "i
  could not see a timeline"; `engine/e6m_anim.js`, `tools/studio/SPEC.md` "A model's timeline"). Two timelines, each with
  a hold of its own (its channel: `clip` or `path`): an object whose clip plays (Loop or Once), selected while editing,
  under its Animation rows; and (v128) an object, a shape, an empty or a sound with a recorded path (in its record or kept
  as a file), selected while editing and not being recorded, under its Recorded path rows. What a path's holds is its own
  clock (the item's time `POSE.path` reads, before its speed, Loop, Once or Back and forth: `pathT`, `pathTime`), so its
  range is one cycle of what is seen (its length at its speed, twice that for Back and forth; `pathCycle`). Each shows
  (page and headset) *Pause* / *Play*, *Start*, *−1 s*, *+1 s* (round a Loop, held at the ends of Once), *The scene's
  clock*; on a page *Timeline: t s of d s* and a slider in tenths (`stuRangeAnim`, `stuRangePath`; acts `an:*` and `ap:*`),
  in a headset *Timeline (d s): playing / held, paused...* and under it a bar (v128, a block `{ bar: { id, ch } }`,
  `drawBar` in `engine/e9_panels.js`: a track the card's width, the part played filled, cyan, amber while held paused, the
  playhead ringed while held with its time over it, ticks at whole seconds up to 30 s (tenths up to 3 s), its ends' times
  under it), pointed at and pressed or dragged with the trigger (its region's `drag`, as the foot panel's track): held
  there, paused, for everyone at the circle (`animScrub`), and let go it stays held there. While the card is not drawn
  again the bar moves on its own strip at most ten times a second (`barsTick`: drawn on a small canvas of its own, put on
  the card's and sent to the texture alone, `panelPatch`, texSubImage2D and its mipmaps, about 400 KB, not the card's 4.9
  MB; no WebGL2: the whole card), so the card's signature (`animSig(true)`) holds only who holds what. A press holds it
  here (`ANIM.mine`, the clip's; `ANIM.mineP`, the path's: its time at a moment of the clock, playing or not) and, at a
  station, everyone at the circle draws the same moment: a quiet effect of the studio's, `anim` (`{ at, a: [id, t, p] }`,
  `c: 'p'` for a path's, four times a second and at once on each press, `{ at, a: [id], end: 1 }` at the end; a slider
  or a bar moving is told four times a second), the relay's clock as at; a word that says what the hold kept says
  already (the same holder, the same moment within 30 ms) only keeps it fresh; nothing stored or saved, no record change,
  no Undo step, no `FORMAT` change. It lets go, back to the scene's clock (or from when shown) for everyone, when the item
  is no longer selected here, editing goes off, its clip stops or changes (a path deleted, recorded again, its play, start
  or speed changed, a recording starting), or *The scene's clock* is pressed; a device that hears nothing for 1.2 s lets
  go by itself; two holding one at once, the latest word wins on the others. A hold shows through Pause (v122): a held
  path is drawn at its held moment over its placed pose, no motion or behaviour (`pathHeld` in `drawnPose`; carried, it
  rests as ever). A voice recorded with the path (`syncAt`) follows its hold: silent while held paused, from the held
  moment while held playing (each hold a pass of its own: a decoded voice starts again there, a streamed one is set
  there), on the path's clock again once let go. The page's card follows each timeline every frame without drawing the
  pane again (`animCardStep`), and a slider being moved holds the pane still until let go. On a headset's card the rows
  push Place and Size a little down (scroll to them). `animState()` (`{ mine, mineP, heard }`), `animSet(it, t, p,
  quiet, ch)`, `animBar(ch)` and `XR.main.patched` for tests. Untested on a headset: how the bar reads and drags on a
  Quest (its strip sent alone, its mipmaps), how in step a held frame looks for several people at a circle, a held voice
  in Quest Browser.
- **Nothing see-through while editing** (v131; the owner, 10 November 2026: "All transparent things are problematic when
  it comes to framerate in edit mode i feel, can we somehow reduce them? Like ghosts for example can just be a light
  gray, rooms that are not currently shown because a cube hides them could just be a empty square with a name? cubes
  that hide things need no walls too, same for walls that hide things, and the cutouts can also be without walls"; a
  see-through layer is drawn again over what is behind it, and a room scan drawn faint or a cube round you filled a
  headset's view several layers deep). Every look the studio draws while editing is opaque lines, small opaque meshes
  and opaque tags (`tools/studio/sets/looks.js`; what lit up by opacity lights up by colour): a trigger cube its edges
  and name, a shape that hides things its edges, a cut-out its dashed edges and ticks, a ghost light grey, a sound's
  speaker, ring and line, an empty's cross, a group's dashed box, the selected and pointed-at outlines, a loading model's
  grey box; the tags (`LOOKS.tag`, the pick ticks too) an opaque band drawn with the opaque things after the items
  (`renderOrder` 12, no depth test), so still over everything they draw. Only the 1.6 s flash of an item from a cube's
  card pulses see-through (lines).
  - What a cube hides from you (`it.hid`, `itemsStep`): a model or a coloured shape is not drawn at all (its model's
    `visible` off; a shape's mesh), snapping, no fade, and shown by its unseen box's edges (`LOOKS.hidBox`, opaque, a
    muted grey-blue; a shape its own edges) and its tag with *· hidden*; still pointed at, selected and carried through
    its unseen box (`pickables`, `insidePick`; its animation holds meanwhile). While this device holds it (`heldHere`:
    a grip, both grips, *Hold it*, the sticks while carried, the page's arrows on it or its group, a group carried, its
    path recorded) it is drawn whole, every material its own (opacity, depth written: the owner, "if i grab it it should
    show but just 100% not transparent"), its edges hidden; let go, its edges again. Not editing: as before (fading in
    and out over 0.4 s). A model still loading that a cube hides shows its grey box (opaque) with *· hidden*.
  - Triangles in space (the owner: "In edit mode show triangle count per item next to its name in space", "on every"
    model): while editing every placed model has a tag over its top (`modelTag`, made the first time it shows, placed by
    `itemTopInto` each frame; its words built and its canvas drawn again only when they change), *Atelier · 397k ▲*
    (`kTris`), *· hidden* while a cube hides it, its lock mark (`tagName`); not while it is pointed at or selected, where
    the engine's labels say it (*object · 397k ▲ · selected*). The count (`trisNow`): while Fewer triangles previews it,
    the preview's (`FT.pv.to`); built, its model's (`trisOf`, counted once per model, so a GLB switch counts again); not
    built yet, its file's or its GLB record's `n` as far as the page has read it (nothing fetched for it). A shape's tag
    says its primitive's triangles (`LOOKS.shapeTris`). No layout, `state()` or `FORMAT` change.
  - Untested on a headset: the frame-rate gain on a Quest (the shell's frame-rate read-out, a double press of B or Y,
    says the story's triangles, draw calls and code time: compare a scan hidden by a cube, or a cube round you, with
    v130), how the edges, the light grey ghosts and the tags read life size, and the cost of a tag per model (one draw
    call each) in a scene of many models.
- **Editing without the cost** (v136; the owner, 11 November 2026: "The edit mode still has worse framerates than not
  editing, why?"; `tools/studio/SPEC.md`, "Editing without the cost"). Edit mode no longer does these every frame: the
  labels of what is pointed at and selected made again (`labelSet` compared two words with the three it keeps, so a new
  canvas, texture, sprite material and shader program link every frame something was pointed at, every frame in a room
  scan; now only when their words change, `L.key`); the scene's matrices made again for each pick (`rayPick` takes them as
  they are: a headset's after `xrBegin`, again only after the other hand moved something, `XR.pickStale`; a page's through
  `pagePick`, once); the whole panel drawn and sent (4.9 MB) for every item or button the ray crossed (the item pointed at
  in the scene is out of `sigMain`; a change of the button pointed at alone draws again and sends only its rectangles,
  before and after, `panelHover`, each on a small canvas of its own as a timeline's bar is, texSubImage2D; the menu's Story
  tab draws that texture too); the page's panes built while a headset presents (`renderPanes`, then once the session
  ends); a draw for every tag and line (each keeps its own objects, as the engine and tests know them, but on a layer no
  camera sees, and `GL.scene.onBeforeRender` gathers those shown into a few draws: every tag in one, its pictures on one
  canvas, `LOOKS.BT.atlas`, and the lines in one a kind, dashes as dashes, `LOOKS.batch`). Measured with a pretend headset
  on a 400,000-triangle scan with 40 items: script a frame editing 7.6 to 14.7 ms down to 4.2 to 6.9 (viewing 2.9 to 3.4,
  SwiftShader), draws 210 down to 132 (viewing 104). No layout, `state()` or `FORMAT` change. Untested on a headset: the
  frame rate on a Quest, how the tags read from one canvas, a hover patch's cost there.
- **Editing**: off by default; *Edit* on the Scene pane turns it on for this device (`studioEdit`; `&edit` too), never
  in `state()`; refused (greyed, *This scene is locked*) while the station's story is locked (`HOST.anchor.locked`
  there: *Lock this story*); not offered at all with `&visit` (a visitor's kiosk: no Edit, no Upload, also with
  `&upload` in its link). *Undo* takes back this device's last 30 changes. In a headset the ray lights and names an
  item and the trigger (or a pinch) selects it (nothing: clears); the grip carries an object or a sound as the design
  room's miniatures (its offset from the hand kept, turning with the hand while free moving is on, else only about the
  vertical) and a cube (level, only its yaw turns); both grips size an object (a twentieth to twenty times) and move it
  with their middle; a selected cube's 8 corner balls stretch it (the opposite corner stays); let go, it stays and its
  record is written. The sticks while something is carried by one hand (v120; the owner, 6 November 2026: "Things in edit
  mode should be turnable and zoomable with the sticks once grabbed like the models in the stories"; "left stick up down
  is zoom, left stick right left is turn, right stick up down is move away, move to me, right stick left right is also
  turn for now"), whichever hand carries it (`holdSticks`, `holdApply` in `engine/e8_xr.js`): the left stick up sizes it up
  and down sizes it down (twice the size in 1.5 s held fully, about its middle, a group about its pivot; a twentieth to
  twenty times and each record's own limits, as both grips and the size steps: an object's cut-outs and following sounds
  scaled with it, `scaleFollowers`; a shape's, a cube's and a cut-out's sides; a sound's reach; an empty has no size), left
  and right turn it about the vertical (90 degrees a second, pushed right its near side goes right); the right stick up
  pushes it away along the carrying line and down pulls it in (its reach, 0.15 to 8 times), left and right turn it too. A
  hand that carries something else steers that with its own stick. A dead zone of 0.2, the rate the push's square past
  it; part of the carry (its records written with the carry's, one Undo step); a locked item is refused as the grip is,
  so the sticks never reach it; nothing scrolls the panel meanwhile. A line on the headset's card under *Carry it* says
  it. In VR, while nothing is carried, the left stick
  walks you through the scene and the right stick turns you 30 degrees a flick (the scene moves, `XR.walk`, never the
  rig; per device, reset by Recenter, at a station too, never written to the room). These are the studio's own sticks: the
  left stick clicked twice (the shell's moving with the sticks, the same setting as in every story, VR only) switches them to
  moving you, also while something is carried, which comes along in the hand, and back (v125, `stickMove`, by the
  shell's numbers, the scene moving as with its own walk, in a shared room too; the notice, the menu row's note and the
  card's line under *Carry it* say which: "The studio's two stick modes" under "Four headset settings"); in AR you walk
  for real, and objects stand on the real
  floor (the session's `local-floor`, its height in the renderer's space from `frame.getPose`; at a station the room's).
  From the inside (v118; the owner, 5 November 2026: "models should be able to be touched/moved from the inside"): when
  the ray finds nothing at all and the controller is inside an object's unseen box (a room scan you stand in), that
  object is pointed at, the smallest such box if several (`rayPick(ray, { inside: true })`, `insidePick`; anything the ray
  finds wins; it beats the floor), so the trigger selects it and the grip carries it, as cubes have always worked; on a
  page the same for the camera in Walk view, a click on the floor still walking. *Hold it* (a selected item's headset card,
  under *Carry it*): the next grip of either hand, wherever it points (not at the shell's menu or a station), carries it
  from where it stands as a grip on it would (a group as a whole), one Undo step; once, then disarmed (again, another
  selection, editing off or the session's end disarm it; `XR.hold`, `holdHover`). A stick pushed up or down while its ray
  is on the studio's panel (or its copy on the menu's Story tab) scrolls a pane taller than the panel (a dead zone of
  0.2, faster the further pushed, from a third of the speed to all of it in 0.8 s held, stopped at either end as Up and
  More are: `stickScroll`, `X.scrollMax`), never while something is carried (v120: the sticks steer it); there the left stick does not walk nor
  the right stick turn. No other story's headset panel scrolls with Up/More buttons (checked for v118: the design room's
  prop card cuts a long list of params short and says the page's card lists them all).
  On a page a click selects, `TransformControls` move, turn and size the selection (W, E, R, or its card's buttons;
  cubes take per-axis size from R; sounds only move), the views are *Orbit* (round the scene) and *Walk* (first person
  at 1.6 m: W A S D or the arrows, drag to look, a click on the floor walks there: where cubes trigger on a page), and
  Delete, Duplicate (D) and Undo (Ctrl+Z) work from the keyboard. Walk view's mouse (v127; the owner, 9 November 2026:
  "mouse movement switch left right and also grab mouse focus with esc to ungrab", "like most games, in both cases"): a
  drag looks the way the mouse goes (right looks right, up looks up), and a click with a mouse grabs it (the browser's
  pointer lock, `GRAB` in `engine/e7_explore.js`): the mouse turns you, W A S D walk, a crosshair in the middle where a
  click selects or walks (`clickAt` at the page's middle), a line under the view saying how; Esc lets go (the browser's
  own; the studio's Esc deselects nothing then), as do leaving Walk view, explore mode or the page. A browser without
  the lock clicks as before, and a refused request (as within a second of Esc) for 1.5 s. Orbit view as before. New items go 1.5 m in front of you on the floor (a
  model's lowest point on it), selected.
- **The panes** (page HTML and headset canvas twins, the same content): **Scene** (the scene and the scenes to pick
  from, a station's for everyone at it; *Edit*; *Save*, which says *Saved 22:41* (*by Anna* for another device's save)
  or why not; *Unsaved changes* while what is placed differs from what was last saved or loaded; *Load saved*, two
  presses; *Undo*; *Reset what I have seen*; on a page *Download layout.json*; the relay's state, or how to run one;
  v118 *New scene*: on a page a field and *Make it*, in a headset *New scene...* asking the shell's keypad,
  `HOST.collab.keypad({ title, hint, value, max })`, no button without it; made by `POST /api/scenes` and opened as one
  picked by hand, editing on; v119, while editing, the scene's settings: *Other circles* and *Real world hides the
  scene*), **Add** (editing: the scene's models with their size and a warning mark, since v120 a grid of cards with
  their pictures and *Make pictures* on a page, its sounds,
  *Originals* folded, *Trigger cube*, *Convert every model*; v119 *Shapes* (Cube, Sphere, Cylinder, Plane) and *Empty*; v118 *From another scene...*: the relay's other scenes, then
  one's models and sounds, `models/` and `sounds/` first, its originals folded; a press copies the file in at the same
  path, a new name when taken, `POST .../copy`, with the files a non-GLB model names that its scene has, found as the
  Upload pane's plan finds them, one whose path is taken here kept as this scene's, an OBJ and its MTL under
  `originals/`; then placed as Add places it, one Undo step; each scene keeps its own copy. New scene and From another
  scene only with a relay that takes uploads, never read only, `&visit`, editing off (the copy) or a locked scene),
  **Item** (the selection's card and its controls: lit or as scanned, the clip and
  *Loop* / *Once* / *Off*, *Always* / *When shown*, *Turn 90°*, *Stand up*, *On the floor*, size steps,
  *Duplicate*, *Delete*; a cube's size steps, *While inside* / *Stays once entered*, *Pick what it shows* and *Pick
  what it hides*, pointing at items to add or remove them until *Done*, and what it shows and hides as buttons (v117:
  one flashes the item's box in the scene for 1.6 s while editing, green if the cube shows it and red if it hides it;
  *Its card* opens the item's card; ✕ takes it off the list, one Undo step); a sound's volume, reach, loop and start),
  **Items** (v122, the owner, 7 November 2026: "items need a preview in the items list tab, should show the same image and
  look like the add item part": every item a card in the Add pane's grid look, page and headset alike, `itemCard`; an
  object its model file's picture exactly as the Add pane shows it for that file, else the plain tile with its kind; a
  shape, a sound, a trigger cube, an empty and a cut-out cutting nothing a tile drawn for it in its colour, `tileFor` in
  `engine/e7e_pics.js`, one canvas a kind and colour, the page showing it as a data URL; its name, a short line, *1.7 m ·
  24k triangles*, *Sphere*, *Sound · follows Dancer · Head*, *Cube · shows 2, hides 1*, *Empty*, and a faint one; 🔒 and
  *moves* marks, and the faint line says what moves it, *spins*, *recorded path*, *follows people*, as the rows did (a
  headset has no tooltip); groups first, a heading each, `.stu-gh`, a press selecting the group, with their members'
  cards under it; an object's cut-outs tags on its card, a press selecting one; the selected card's border in the accent
  colour, one on a cube's list being picked green or red, a cut-out's tag too; a press does what a row's did, selecting it
  or, picking, picking it; with a cube selected *Shows* and *Hides* under every card but the cube's own and under each
  cut-out's tag (in the headset the tag keeps the card's whole width, its toggles on a row of their own), one Undo step
  each, what the page's tick boxes did, now in the headset too, regions `tick:show:<id>` and `tick:hide:<id>`; the
  headset's canvas three a row, a row as tall as its tallest card, `drawItemCards` in `engine/e9_panels.js`, paged by Up,
  More and the stick; the card faces and headings keep the rows' ids, `sel:<id>`; which GLB stands for a file worked out
  once a render, only when an object's card asks; no layout or `state()` change) and
  **Upload** (pages only). `&tab=scene|add|item|items|upload`, `&view=walk`.
- **Saving**: *Save* writes what is placed now to the relay's `layout.json` (for everyone at a station); a read-only
  source offers *Download layout.json*. Outside a room what is placed is also kept on this device
  (`studioDraft.<source>.<scene>` in `localStorage`, a second after each change), and opening the scene with a draft
  newer than the saved layout and different from it offers *Your unsaved changes from <time>: Restore / Discard*.
- **Placement in a headset**: life size, as the design room's table. Outside a room the scene's origin is the rig's
  floor point: where you stood as the session or the studio began, facing your way (anchored with `HOST.anchor` when
  Anchor is on, so an exhibit comes back at the same place in the real room). At a station in a shared room (v125; the
  owner, 8 November 2026: "In studio mode align all things to the room marks and have the circle only be the entry, so
  that moving the circle does not move the studios scene content") the scene's frame is the room's: room coordinates as
  `shared.js` keeps them (the floor at y = 0, the origin and axes the room's; on a room calibrated on its floor spots,
  spot A on the floor and x towards spot B). The rig stays the station's spot (its panels float there), and `xrPlace`
  hangs the scene from it at the room's origin (`xrRoomBase`: the inverse of the rig times the shell's room matrix,
  `HOST.room.matrix()`, each frame, so the scene holds still while the circle glides), so every item stands at the same
  place in the real room whichever circle shows it and wherever that circle stands, and moving or turning the circle
  (the grip, the map, Move here; Arrange all leaves studio circles alone anyway) moves nothing of it; walking into the
  circle (or *Go in*) still enters the studio there. The VR stick walk still moves the scene for one headset. Pages draw
  the scene in its own frame, as before. A layout made before v125 stood round its circle: **Move the scene to this
  circle** (the Scene pane while editing at a studio station in a room, page and headset alike, with a note that since
  v125 the scene stands on the room's spots and its circle is only the way in; `sceneToCircle`, `circleBlocks` in
  `engine/e6d_shapes.js`) takes every item's placed pose through this circle's spot (`x' = spot + turn(yaw) x`, the
  station's record's `x`, `z` and `yaw`): the objects', shapes' and empties' places and turns, the cubes' places and yaws,
  the sounds' places (one following something keeps its offset `o`; its own `p` is where it stands when what it follows
  is not there) and a sound's own recorded path (its keys are in the scene's axes, so turned with it: `pathTurned`);
  nothing in an item's own frame (cut-outs, offsets, the other items' paths, motions, behaviours; a motion about the
  scene's x or z axis keeps that axis, so turns by other than quarter turns change its direction in the room). One change
  (one Undo step), every record written, shared and saved; refused while the scene is locked (*Lock this story*: editing
  is off then, so it is not offered) or while an item is locked in place (*Refused: Box is locked in place...*, naming
  each, as a group's move does). The grip on nothing moves only the panel. In VR a dark floor with a faint 1 m grid and a
  soft sky (`stage`, round the scene's origin: at a station the room's); in passthrough none of it. Untested on a
  headset: how a scene on the room's frame feels at a circle across the room, and that a real room's frame lines it up.
- **Shared rooms**: "The studio in a room" under "Shared rooms"; `state()` in "What each story shares". Items from the
  room glide there in 0.25 s unless carried here (the carry wins until let go); one effect, `beh`, a behaviour's driver's
  samples ("Behaviours" above); `view()` null; `place` and
  `panel` as the design room's (only the panel moves). Its station's icon is its own miniature, `studio.stage`
  (skipped by `tools/design/build.mjs`: not a prop).
- **Trackers** (v126): props that follow one of the PC's Vive trackers and a Mixamo character worn with trackers, its
  lining up and its takes: "Vive trackers" below.
- For tests and the console: `HOST.cur.peek('STUDIO.state()')` (where things stand: the source, scenes, the scene, its
  items, editing, the selection, unsaved changes, Saved).
- **The Bliss XP room (example scene)** (v137; the owner, 11 November 2026: "we need it almost 1 to 1, but the elements
  separated and dynamic on detected walls", "the elements, but detached and mapped onto the room, with spatial audio of
  course", "it may need to be reactive and react to user movements, where the user goes, instead of a static variant", "so
  this could actually be built like a studio scene with trigger cubes etc that we can edit", "make sure its all cool and
  fancy 3d if possible", "Also add a little 3d version of clippy that is there and chills"; `tools/studio/xp/README.md`,
  `COMPONENTS.md`). `examples/bliss-xp/`: the music video "Bliss (Windows XP)" by anabology taken apart and built again
  as a room of about 5 x 5 m round the scene's origin, every part our own (no frames, people, logos, the real system's
  sounds or lyrics; Clippy in the assistant's part, our own paperclip): 58 models (the boot and welcome screens with our
  emblem, the windows as Luna slabs with their buttons in relief, the taskbar's pieces and the Start menu, the icons, the
  Recycle Bin, balloons that pop in, the giant arrow cursor, the hand, the hourglass, the door that opens onto the hill,
  the solitaire win bouncing out of the wall, Media Player's 3D bars, the drag trail, the glass CRT, the flip phone, the
  duck, grass that sways, clouds, titles in 3D, Clippy with his clips Chill, Blink, Wave and Dance on his beanbag; for VR
  our painted hill and sky and the starfield, for AR a painted wallpaper), 14 synthesised sounds as 17 emitters at their
  objects, 11 trigger cubes as a walk through the video (some for everyone at the circle), 3 groups, about 69,000
  triangles as placed and 5.3 MB. It uses v137's contract: the `wall` behaviour on its wall items (so in AR they go onto
  the walls each headset finds), `shows: 'ar' | 'vr'` and cubes' `all: true`. Made by `node tools/studio/xp/make.mjs`
  (deterministic; `--check` says whether the folder is current), never by hand.
- **Untested on a headset**: the grips, the corner stretch, the VR stick walk, objects on the real floor in AR, the
  emitters through HRTF and streamed sounds on a Quest (`createMediaElementSource` there), the frame rate with the
  397,066-triangle scan, the memory peak while its 8,192 px JPEG is decoded before it is drawn down, how the flat-shaded
  lit scan looks, *Studio here* and standing in the studio's circle, the visitor kiosk in a headset, *Convert on a
  laptop* and the folded *Originals* on the headset panel, the Relay password row reached from a studio 401, a group
  carried and sized by real grips, a model inside out seen from within on a Quest, *Fewer triangles* and *Change texture*
  in a headset (how a lighter scan looks life size, the pause while a big scan is made lighter there, a GLB written
  there: its textures encoded and uploaded from a Quest, its memory), the Upload pane's pictures on a real GPU, the Add
  pane's grid and the Items pane's cards on the headset panel (how the cards, pictures and tiles read, paging by Up and More,
  *Shows* and *Hides* pressed by a real ray) and a picture drawn in a
  headset session (inside its frame callback: a GLB a headset's Save writes), shapes
  that hide things in AR against the real room and with the shell's real-world occlusion, an empty's cross, a lock
  refused by real grips (the buzz), the other circles hidden at a studio's circle and the lobby hook as a headset walks
  into the lobby, and how the `studio.stage` icon reads across a room. The pretend headset in `tools/collab.mjs` works the triggers out in the
  page with the renderer told it presents for that moment, so the real per-frame headset path is untested on a device.
  Unheard: the converted mono sounds and `first_room.mp3`. Untested anywhere but headless Chromium: a real folder
  dragged from a desktop file manager (only a synthetic drop and *Choose files*), Safari, iPhone and Firefox
  (`OfflineAudioContext` rates, `webkitdirectory`), uploads from GitHub Pages to a relay elsewhere, a streamed sound on
  a renewed context or reaching its end without a loop, and a plain `.gltf` with an external `.bin` (no test file).

## Conventions

- Match the surrounding style: 2-space indent, single quotes, semicolons,
  compact one-line helpers, short comments that say why. No frameworks or
  bundlers; do not add dependencies.
- Writing in the UI is plain British English, short sentences, no jargon
  without a gloss (the qubits story uses American spelling, as its author asked, and so does the aging ovary story, as the owner asked; the pass story is in English and German, see its section). Numbers shown in the story are computed from the data at
  load time, not hard-coded, wherever possible.
- Scientific content is illustrative but must be correct: only add
  interactions and locations that are well documented (complexes, textbook
  pathways, Human Protein Atlas / UniProt locations). Say "in this map" for
  statistics computed on the curated sets.
- Avoid 2D graphs (bar charts, line charts, scatter plots, matrices, survival
  curves): in AR and VR they are dull, and a poster or a paper shows them
  better. A quick graph in passing is fine; a whole chapter needs something
  that uses the space (the numbers on the body or the organ they belong to, a
  network standing in the room, things that move, grow or flow). The owner's
  rule, from the feedback on the PET story (October 2026).
- External scripts: none beyond the vendored three.js and PeerJS (the latter
  loaded only for a peer-to-peer room; three.js r128's own add-ons and meshoptimizer's simplifier for the studio are
  pasted into its built file). Fonts come from Google Fonts (cached by
  the service worker).

## Things that are easy to forget

- Bump `VERSION` in `sw.js` whenever any app file changes, or installed copies
  (and headsets) keep serving the old cache. If you add a file the app needs,
  also add it to `SHELL`, and to `APP_FILES` (or `APP_DIRS`) in
  `relay/server.mjs`, or the relay serving the app answers 404 for it
  (`node relay/test.mjs` checks every file `SHELL` names).
- When releasing (after bumping `VERSION`), run `node tools/release.mjs`: it
  writes `version.json` and stamps the shell's release into `index.html`
  (`HOST.shell`); commit both. `node tools/release.mjs --check` says whether
  they are current. Without it, running pages do not see the release until
  they reload (and a new shell refuses to be written without a new `VERSION`).
- At every release, rewrite `whatsnew.json` by hand for the new `VERSION` (`version`, `date`, and short sentences under
  `new`, `test` and `untested`: what changed, what the owner should try on a headset and a phone, what nobody could
  check here; a handful each, so the headset's page stays readable). `node tools/release.mjs` warns and `--check` fails
  while it names another release ("Developer mode" above).
- Never let the page and its story files come from different versions: a new
  `index.html` with an old story file looks fine but misbehaves (Repeat ended
  in explore mode because the old story never called `HOST.ended()`). Hosts
  such as GitHub Pages let browsers keep files for ten minutes, so the service
  worker revalidates every app file, and when an update takes over a running
  page, `HOST.live` asks `version.json` what changed: a new shell is asked
  about, and taken by itself at the next quiet moment (`HOST.reloadIfUpdated`:
  on the Stories screen, not in a headset); a story needing a newer shell is
  never swapped in. After changing `sw.js`, run `tools/update.mjs`.
- Story chapter timings are also documented in `audio/PUT-narration.mp3-HERE.txt`.
- After changing anything in `tools/nmd/` (or the authors' files: first
  `node tools/nmd/data/gen_data.mjs <their folder>`), rebuild `stories/nmd.js` with
  `node tools/nmd/build.mjs` (and bump `VERSION`).
- After changing anything in `tools/lbi/`, rebuild `stories/lbi.js` (and bump
  `VERSION`). Likewise `tools/endo/` and `stories/endo.js` (and after changing
  `tools/nmd/sets/motor.js`, which the endotype story uses too), `tools/flock/` and
  `stories/flock.js`, `tools/robots/` and `stories/robots.js`, and `tools/pet/` and `stories/pet.js` (and after
  changing `tools/lbi/sets/body.js` or `tools/micro/sets/organs.js`, which the PET story uses too), and `tools/micro/` and `stories/micro.js` (and after
  changing `tools/lbi/sets/body.js` or `tools/lbi/sets/tissue.js`, which it uses), and `tools/ovary/` and
  `stories/ovary.js` (and after changing `tools/lbi/sets/body.js`, which it uses; first
  `node tools/ovary/data/gen_data.mjs` after changing its readings), and `tools/qubits/` and
  `stories/qubits.js` (run `node tools/qubits/test-qmath.mjs` after changing its maths), and `tools/mutation/` and
  `stories/mutation.js` (run `node tools/mutation/test-mmath.mjs` after changing its maths), and `tools/topo/` and
  `stories/topo.js` (run `node tools/topo/test-data.mjs` after its data or decoders change; its data only from the
  authors' files through `tools/topo/data/gen_data.py`; and after changing `tools/lbi/sets/body.js` or
  `tools/micro/sets/organs.js`, which it uses), and `tools/soil/` and `stories/soil.js` (run
  `node tools/soil/test-data.mjs` after its data or decoders change; its data only from the authors' files through
  `tools/soil/data/gen_data.py`; and after changing `tools/topo/sets/look.js` or `tools/lbi/sets/web.js`, which it
  uses), and `tools/pass/` and
  `stories/pass.js` (and after changing `stories/airports.js` or `stories/spatial.js`, whose globe and cell it takes).
  And `tools/design/` and `stories/design.js` (also after changing `tools/design/props.json` or a miniature's name), and
  `tools/lowpoly/` and `lowpoly.js` (`node tools/lowpoly/build.mjs`; keep each miniature under 1,200 triangles and its
  `tris` exact: the harnesses mark a wrong count in red). And `tools/studio/` and `stories/studio.js` (also after
  changing `tools/lbi/kit.js`; never edit `tools/studio/vendor/`, three.js r128's own files); after changing the test
  scene's maker, `node tools/studio/test/make.mjs` (it runs `scan.mjs` too; `node tools/studio/scan.mjs
  tools/studio/test/scenes --check` says whether its listings are current). A new page in `STORY_EXTRA` needs its icon
  in `tools/lowpoly/` and its key in `ICONS` in `tools/design/build.mjs` (an icon, not a prop), as the studio has.
- The owner's own scenes (models, textures, sounds, layouts: the atelier scan, the rigged figure, `first_room.mp3`)
  never go into the repository: they live in the relay's `--scenes` folder outside it, or for local checks in
  `tools/studio/test/local/` (git-ignored). The only scene committed is the generated test scene.
- Keep `README.txt` (user-facing notes) in sync with structural changes.
- Shared rooms: bump `FORMAT` in `shared.js` when the keys or a story's
  `collab.state()` change shape (a room refuses another format). A story's
  hooks (see "Shared rooms") must stay in step with its pointer code.
- Several handlers run inside the old story's call stack when switching;
  use `HOST.go(key)` (deferred) from inside a story, not `HOST.start`.

## Testing

There is no unit-test suite. When the suites run (the owner, 7 November 2026: "only running when pushing to main makes
sense for now"): every suite below that a change touches runs before `main` moves, the smoke test always; a push to
`dev` gets only `node --check` on the changed files, the builds' `--check` and `node tools/release.mjs --check`, and a
red result there is not chased. Each "after touching ..., run ..." below says what goes into that release run.

The smoke test (serve the folder, then run it) loads every story (and the design room: its 48 miniatures built, a click putting one on the stage
with its card as `props.json` has it, a pretend headset's grip, its shared state, Tidy; and the studio, below), scrubs through it, plays it as a slideshow
(a paused scrub near a stop holding, a stop exactly at a chapter's end and at the
last one, the voice finishing the chapter there where a story has a recording,
Next on the page, in the bar and on the headset panel beside the chapter arrows,
Next going on), exercises explore
mode and the headset panels (the headset Stories screen too: its header only the title, the hint and Back to the story,
its cards in two rows, the first half of the list on top, each row level, centred and in the list's order, under the
header and within about 0.65 m of the eyes; for the muscle, endotype, PET, microanatomy, ovary, qubits, mutation, tissue topology, soil and pass stories every explore tool too,
for the tissue topology story the panes' numbers against its data (the patch's counts at the poster's snapshots, the
held-out test, a window's share of the gap, the two groups, cell v's score), for the soil story the panes' numbers
against its data (nitrate on day 24, day 70's chlorophyll read off the slides, the network's links at three thresholds,
none left shuffled, the wheat lines' own networks) and a plot and a kind picked with the pointer, for the mutation,
tissue topology and soil stories also their links (each opens explore mode on what it says), for the pass story in both languages with its switch; for
the robot gang every rule, a click to walk, crumbs, a big open floor and one
with no area, and a pretend headset room from detected planes),
loads every story again watching its load (`HOST.progress` rising from 0 to its total once per step, the page's bar
and step shown and gone, no task of the load longer than `LOAD_LIMIT`, 4 s: generous, as SwiftShader compiles one
shader at a time in software; the shared-room hooks seeing the scene only once it is built; a story picked while
another builds stopping that one's steps and keeping the controllers and place), and with a pretend headset (its
frames driven, the drawing recorded) the loading scene in VR and AR: nothing before 0.4 s, then the card 1.2 m in
front and 15 cm below the eyes (nothing at the wrist since v103), drawn in a scene of its own (not the story's, no
listener of the story's), the clear colour kept, the card fading out over the story's first frames,
switches stories, runs anchored placement in each
story with a pretend headset (an origin that jumps, anchors that stay, saved
handles), checks the headset settings with a pretend headset in a page of
its own (labels on top and cards in 3D by default, also on a device that chose
its labels under the old key; the menu's Labels, Cards and Moving buttons
going round, each leaving the other, kept across a reload, set by `#labels=`
and `#cards=`; for the qubits, the flock and
the airports, each mode of each switch on its own: labels on top as sprites, in
3D as depth-tested upright signs turned to the head, also after it moves, and
hidden, the story panels staying as the cards have them (labels hidden leaving
both panels drawn and pointable); the two story panels in 3D in the scene
(depth-tested, writing depth, `renderOrder` -1, `alphaTest` above 0, their
materials built again only when the mode changes, the ray still reaching each),
on top as before, and with cards hidden neither panel drawn or pointable in
story and explore mode, the labels staying, A or X doing nothing and the menu's Story tab's copy of the foot bar
playing; back again
from hidden; the Stories screen's panels on top throughout; a free grip turning the scene 90 degrees with the hand, the
point held staying in it, staying when let go and facing you again with free
moving off; the panel tilting with the hand; the flock's grip taking only the
panel; subtitles: off by default with nothing drawn, on through the menu's row,
kept across a reload, set by `#subs=on`, the caption the words of the line on
show (several captions for a long line) changing with the clock, holding while
paused, none in explore mode or on the Stories screen, still for a 10 degree
turn of the head and following a 40 degree one with lag, the pass story's in
German, the hook in all sixteen; panels per story: shown by default, the menu's
Panels row going round (controls only, hidden, shown) with the story following,
no row on the Stories screen (its panels staying), each value in story and
explore mode (controls only: the foot bar alone, the text panel neither drawn
nor pointable; hidden: neither, A or X doing nothing and the Story tab's copy of the foot bar playing), cards hidden still
hiding both and labels hidden neither, each story its own (the qubits, the flock, the airports, the
design room), kept per story across a reload, set by a link for the story it
opens, the panels and cards lines in all sixteen and every page in `STORY_EXTRA`; the frame-rate read-out (v118: off by
default with nothing drawn, on through the menu's Frame rate row, the story's frames drawn through `HOST.perf` from the
pretend head giving a second's triangles, draw calls and code time, the read-out showing them with the frames a second and
the frame times, 22 degrees down and 14 to the left 1 m away and staying so as the head turns, kept across a reload,
`#fps=off` and `#fps=on`, nothing drawn when off; v119: a double press of B on a pretend controller turning it on with
its notice, of Y off again, one press, two 0.6 s apart and a B held as its controller appeared doing nothing); the keypad (v118, `HOST.collab.keypad`: the menu opening with its
keys, OK and Delete greyed while empty, *atelier 22*, Delete and OK giving *atelier 2* and closing the menu again, Back
giving null, another tab giving null, and null at once on a page without a headset session); the menu's Design room
button outside a room opening the design room, the menu closing and the button
greyed there), the stories' sound effects (per story: its cue table, names the
shell knows, places that resolve, times within the story; a paused scrub across
cues playing none; a stretch played asking for exactly the cues it crosses; one
explore action's sound, `SFX_PICK`; a pretend headset's press on a story panel
button clicking; at a slideshow stop no cue past it until Next, then the next),
real-world occlusion (v119: a pretend AR headset driven through three.js r128's own WebXR path, its depth a real WebGL2
texture array made in the page each frame, window depth with no far plane, and a pretend room scan; a magenta test plane
read back from the layer's framebuffer hidden where the real world is nearer and drawn where it is farther, in both
eyes, also the other way round, an eye without depth unoccluded, the real world 2 cm nearer not hiding it; the room's
wall hiding what stands behind it, depth sensing never paused or resumed (v124); off; both; the menu never hidden; the default *room and people*
and the menu's row going round, kept; a story's own cleared by a story change and the objects hung in the next story's
scene; nothing drawn after the session ends; CPU depth; `#occl=off`; `HOST.xr.request`'s ladder (a TypeError naming
`'unsigned-short'`, another refusal) and VR as ever; the session line in every story; v131, after a sleep, the fake's
session hidden and visible again (its `visibilityState` and events), its depth dead until `resumeDepthSensing`, a
binding made after it died or never, its `depthActive`, its bindings' generation (one made before it moved on throws),
plane spaces with no pose or a new set of planes, a changed `textureType`, and the times shortened (`times()`): a short
hide changing nothing (no renew, no resume, no new binding); a long sleep with the depth dead and `depthActive` false:
asked again at once (`occlusion renew`, `wake`, how long hidden), resumed once, a new binding, `occlusion back`, the
plane hidden again in both eyes; the depth dying with no sleep: the watchdog asks again (`depth lost`), a new binding,
no resume (`depthActive` true); a binding from before throwing every frame (6 in a row here): asked again (`depth
throws`, its error), the plane hidden again; the room's planes with no pose: `occlusion room` posed 0, the room built
again (`room`), nothing hidden, then planes given again: `occlusion back`, the wall hiding again; the depth and the room
back steadily (0.3 s here): their tries started afresh (`occlusion steady`, two and one), no renew; depth that never comes
back: six tries, then `occlusion gave up` once, the line *depth stopped N s ago: leave AR and enter
again*, one notice and no more tries, and back by itself: drawn again, the line plain; one texture per eye: decided
afresh (`shape`), the plane hidden in both eyes, probed and read as a depth buffer's, and a texture array again;
never a pause; after the session, the WebGL context lost and restored (`WEBGL_lose_context`): both logged, our own GL
objects forgotten, and a new session's depth hiding the plane with them made again),
focus mode (v106: on by default on a pretend phone, 390 x 844 and 360 px wide, and an iPad, 1180 x 820, with touch:
`HOST.focus()` true, the panel hidden, the slim bars, the subtitle strip's text the shell's caption for the line on show
and changing with the clock, none in explore mode or on the Stories screen, a chapter's title at its start, Text opening
the panel and closing it with a resize each time, explore's drawer closed by default, then open and closed; `#focus=off`
giving today's layout; a desktop page unchanged; and the framing lines in all sixteen stories and every page in
`STORY_EXTRA`),
phones and tablets (v109: the top bar fitting at 320, 360, 390 and 430 px with a pretend AR and VR and Install, and on an
iPad either way round, on the Stories screen, in a story with focus mode on and off and in explore mode, AR always in it;
More's items, and More opening on the Stories screen without closing it; AR in focus mode's top bar only where a
pretend WebXR has it, the invitation once and not after a reload; back from a story opened from the Stories screen
returning there, forward going back in, back with Text open closing Text, the Stories button not piling entries up;
full screen asked for once per card tap through a stub, never with a pretend headset session or Enter VR just pressed,
its toggle in More only where the browser has full screen; the iPhone tip once, not after a reload, never in the Home
Screen app; the timeline's touch strip at least 20 px from both edges),
and fails on console errors:

```sh
npx http-server -p 8123 -c-1 .          # or: python3 -m http.server 8123
node tools/smoke.mjs http://127.0.0.1:8123/
node tools/smoke.mjs http://127.0.0.1:8123/ --only studio       # only the studio's pages
```

`--only <words>` (v124) runs only the steps whose names start with the words and the blocks that hold them (each block
of steps is guarded by its name, `runs(...)`; the headset settings, a block of mixed names, runs only without it; focus
mode and phones and tablets run with `--only 'focus mode'`, `phones`, `tablets` or `iPhone`): `--only studio` the
studio's pages, `--only 'studio texture swaps'` one block of them. For a builder's own steps; the release run is the
whole test.

Its *away idle* steps (v136, `--only 'away idle'`, a page of their own, a minute or two): the away lines (`xrIdle` and
its call right after `xrBegin` in `frame`) in every story and every page in `STORY_EXTRA`; then for the airports (written
by hand), the qubits (built from sets) and the flock (a live simulation) a pretend VR headset driving the story's real
frame function through three.js's ArrayCamera path, `HOST.room.away` and `inRoom` stubbed: at a station every frame a
full one (`xrUpdate` each frame, the world shown and walked, the birds flying); away, a second of full frames with the
world and the panels hidden; then frames that only render (no `xrUpdate`, no set's `update`, `window.__frames` counting
on), `GL.world.updateMatrixWorld` its own no-op (moving the world and walking the scene's matrices leaves its matrix as
it was), the birds still; back, the first frame a full one, the world shown and walked again, the birds flying on from
where they were; away again and the session ending while idle: the walk given back. Its *uploads* steps (v136,
`--only uploads`, a page of their own with WebGL2's calls counted, a minute or two): the tissue topology story paused at
212 s (the tower), the qubits at 267 s and the mutation story at 253 s sending no buffer in six frames (they sent 186,
102 and 258 before), and playing on; the robots in explore mode with 12 robots for four seconds: their cleaned floor
sent as boxes through `copyTextureToTexture` and no whole map. The design room's *few draws* step (with its other
steps, `--only design`): every miniature in one or two meshes of the two shared materials, static and with `aMat`, at
most 110 meshes shown on the table and 110 draws for it (337 and 334 before).

Its *stick moving* steps (v125, `--only 'stick moving'`, a page of their own, a minute or two; a pretend VR headset whose
frames go first through the session's own `requestAnimationFrame`, the shell's hook and its own callback, and then the
story's frame with the same frame object, as three.js's would: a reference space that makes offset spaces, a new frame
each tick answering for the head, two controllers with gamepads and an anchor from where they really are; 60 frames a
second on the test's clock): off by default; one click of a stick opening the menu only after 0.4 s; a stick clicked
twice turning it on (its notice, `xrWalk`, no menu then or later), both sticks at once one click (the menu once), kept
across a reload, the left stick clicked twice again turning it off (the right stick's double click is the spaceship's since
v132), two clicks 0.6 s apart the menu twice; the left stick
pushed forward for a second moving the head three.js sees 1.5 m where it faces (within 5 cm), the story's own head with
it, the left controller's ray with it, the anchor not; a push of 0.6 to the right a quarter of the speed to the right;
the dead zone nothing; a flick of the right stick turning 30 degrees about the head (held, no more), a flick left back;
forward after a turn where the head now faces; the setting off moving nothing and keeping where you are; in the airports'
explore mode the stick's spin and zoom left alone while it applies and working again when it is off, the grip held on
the globe (`squeezestart`) its reach still following the stick with no moving, let go the stick moving you again; the
menu's row on and pressed both ways; in a pretend shared room elsewhere (v128: `HOST.collab.joined`, `code` and `here()`
stubbed, `here()` false): moved and turned before it is joined, the travel gone as the room is joined (back where you
stand), the left stick 1.5 m where you face, a flick 30 degrees, `walkWhy` `''` and the row pressable, another room's code
while moved taking the travel back again, then moved and turned once more and in the room with the others (`here()` true)
back where you stand, the sticks
moving nothing, two clicks saying *Not while you are in the room with the others*, the row greyed, and elsewhere again
the stick moving you; in AR, in a pretend shared room with an older `shared.js` (no `here()`: any room, the travel back
to none) and with the story's `ownSticks`: the sticks moving nothing, two clicks saying why in a notice, the row greyed; the studio's
`sticks: { say, note }` and no `ownSticks`; `#walk=off` and `#walk=on`; the `xrWalking` line in every story and
`STORY_EXTRA` page, every explore stick waiting on it, and no story reading `buttons[4]`. Then the studio's two stick
modes, on its test scene with editing on, the pretend controllers pointing down, outside a room and again at a pretend
studio station in a shared room (`HOST.collab.joined`, `live`, `HOST.room`'s `inRoom`, `away`, `placing`, `gripLocked`,
`matrix` and `recenter`, and `HOST.anchor.frame` stubbed: the rig at the station's spot, the scene on the room's frame):
the setting off, the row pressable there, the left stick walking 1.5 m through the scene (`XR.walk`) and the card's line
*Sticks: the studio's*; two clicks to moving you (*Sticks: moving you*, nothing jumping, the card's line); the left stick
1.5 m through the scene where the head faces and a flick right 30 degrees about the head, three.js's head and the
shell's travel still; the box carried (the grip held): the left stick moving you 1.5 m all the same, the sticks steering
nothing, the box staying in the hand (within 1 mm) and so 1.5 m through the scene, a flick turning it 30 degrees with
you; two clicks back while carrying (*Sticks: the studio's*, nothing jumping), the right stick up pushing the box away
again; Recenter taking the walk back (at the station the station's Recenter too); in AR two clicks saying *Not in AR*.

Its *spaceship* steps (v132, `--only spaceship`, a page of their own, a few minutes; the stick moving steps' pretend VR
headset, its frames through the session's own `requestAnimationFrame` so the shell's hook steps the ship, 60 frames a
second on the test's clock, which the ship's relay time follows there, `HOST.ships.testClock`; the right controller's grip
turned by the test; the drones frozen, `debug.freeze`): the right stick clicked twice launching (its notice, no menu), the
ship 0.5 m ahead of the controller facing where the head does; the left stick twice still moving with the sticks, both at
once one menu; the right stick twice again landing; a tracked right hand refused in words. The controller's tilt
steering nothing (v133: rolled 40 degrees either way, nose up or down 40, turned 75 about the vertical, the ship flying
straight and level); the right stick full right all the way round (392 degrees in 2.8 s), banking 50 degrees; held back
a whole loop (v134: 359 degrees in 2.57 s, upside down at its top 1.58 m up from 0.6, back where it began within 8 cm,
its yaw unchanged); let go climbing 40 degrees level within 2.5 s, let go upside down holding; the ceiling and the floor
bouncing it (its pitch mirrored, never past 3 m or under 0.15 m); upside down the stick right turning it about the
vertical the other way; nothing of the tilt left (no `steer`, `angles`,
`steering`, `setSteering`, no `neutral` or `roll` in the state, `xrShipSteer` gone). The stick's numbers: full right 140
degrees a second to the right (within 3), full left the other way, 0.5 at (0.35 / 0.85)^1.5 x 140 (about 37), 0.1 nothing;
pulled back its nose turning up 35 degrees in 0.25 s (140 a second), pushed forward down, released level; the state's stick and the mapping
(`stick`, `axes`, `STICK`). No Steering row on the Settings tab, its height between 1,500 and 1,900 px (printed: the
canvas is 1,920). Two right-stick clicks pushed past 0.5 neither landing nor opening the menu (logged, at most once a
second); a pushed click then
one at its middle at once the menu alone (never paired); two at its middle landing. Cruise
1.2 m/s, half grip 0.72, full grip -0.5, at most 2.5 m/s2; A boosting to 3.2 m/s for 0.8 s, not again until 4 s of
recharge, braking ending it. The trigger held a second: 5 bolts at 9.2 m/s (8 plus the ship's), none older than 1.25 s.
Alone: 3 targets and 2 drones, led here; two bolts destroying a target (counted); a drone's bolt taking 10 of the shield
(the buzz 0.4 for 60 ms), refilled after 2 s, then past the shield into the health, which stays. Pickups (times
shortened): the boost's (a boost of 1.2 s, recharged in 1 s, gone after its time), rapid fire's (10 bolts in a second,
gone after its time), the reinforced shield's (150, a hit of 20 taken from the extra, which never refills), one living
1.5 s gone after it, at most 2 at once. Destroyed at 0 (*Destroyed by a drone*, no ship drawn, the strip shown), a new ship
5 s later at the controller, full, level though the controller is nosed up. Flying, the right controller's select and squeeze events
reaching no listener after the shell's guard, the left's all six; its ray at the open menu pointing at nothing (`kind`
shell, `dist` 0, no hover) where the left's points at the menu; landed, its presses heard again; a trigger and grip
pressed before the launch getting their ends through (and the next press not); moving with the sticks
on, a flick of the right stick turning nothing while the left stick moves you. In the airports' explore mode the right
stick spinning and zooming nothing while it flies, and again once landed. Flying alone (the game in its own frame),
another's ship and bolt handed in taken by nobody. The menu's Spaceship row launching and
landing; another story (the flock) keeping it flying, drawn in its scene; the session's end landing it. Heading out from
the arena's middle it never passes 5 m and comes back; the strip shown and the arrow with the head turned away; in AR a
pretend wall (a plane of the room scan 1 m ahead) bouncing it back; nothing see-through among its materials but small
additive glows, each adding its colour and keeping the alpha (v134), and drawn over a see-through background (alpha 0,
as in AR, on a canvas of its own) the glow and the shield's ring leaving the alpha at 0 everywhere while adding light; the
ship under 600 triangles.

Its *frame rate* steps (v136, `--only 'frame rate'`, a page of its own, about five minutes; `FPS_FAKE`: a pretend Quest
driven through three.js r128's own WebXR path, a layer with a framebuffer of its own, two controllers; its session lists
72, 80, 90 and 120 Hz and records what `updateTargetFrameRate` is asked, which fires `frameratechange`; its layer records
what `fixedFoveation` is set to and what three.js made it with; every 2D texture upload counted per frame): a session
asking for 90 Hz and logging it (`frame rate`, `frame rate change`); the Debug tab's Refresh rate row going 90, 120, 72,
80, 90 Hz and asking each again; 100 asking 90 and 60 asking 72; nothing in `HOST.xr.sig()`; 120 kept across a reload and
asked; `#hz=72`; a session without the API asking nothing, the row greyed, logged; the read-out's words (*NN fps of 90
Hz*) and colour at 90, 88 (green), 86, 72 (amber), 71 and 40 (red), and without a rate as before. In a room on this device
with every story's station, the design room, the studio, All stories and Back to the lobby, the headset lined up on its
floor: every card that shows drawn once, at most one a frame (drawn and sent to the GPU), the nearest first (their
distances never falling), no back face shown or pointable; every story's station playing: each card *Playing*, none
drawn again or sent over 2.6 s; paused, *Paused at 1:03*. The menu on the Debug tab: the frame rate changed three times,
its line (*... · the headset at 90 Hz*) drawn and sent alone (`texSubImage2D 652x30`), the whole menu never, the texture's
version unchanged, the row read back from the GPU the canvas's and not the line before; someone walking between two
circles drawing the Settings and Debug tabs not at all and Circles each time; the Debug tab's height printed (under 1500
px). Foveation: the story's 0.5, then the row 0, 0.5, 1 and the story's again (each set once, the 0.5 from before put
back), a story's own set back; Resolution 90, 80, 100 % from the next session (its layer made at 0.9); both kept across a
reload; `#fov=1&scale=80` and `#fov=story&scale=1`.

Its *developer mode* steps (v125, `--only 'developer mode'`, a page of their own, a few minutes): off by default with
nothing shown and the switch and What is new at the Stories screen's foot; `#dev=on` showing the card over the Stories
screen with the served file's lists; Got it keeping it away for that version across a reload, a stand-in file of another
version showing it again (an empty list without its heading), Later and Escape until the next load; a link into a story
showing it over the story; What is new by hand; a file answered 404 said in one line; the switch and `#dev=off`; More's
two items at 600 px. Then a pretend headset session (as the headset settings' steps make one), the welcome on and made
1.5 s long: the menu opening at What is new only once the welcome has shown and gone, Later closing it and the menu
(again the next session), Got it closing them and keeping the version (not the next session); with the welcome off, a
moment into the session; developer mode off, never; the Settings row and the Debug tab's What is new (Back to the tab).
Without the file (404, on a page that has fetched none) the card has Later alone, focused, and the headset's page Back
alone; while it is fetched by hand (the server slowed down 1.5 s) the card says *Fetching what is new...* with Later
alone, then Got it once it has come; the page's card open as a headset session starts closes, as Later.

Its *update the room* steps (v136, `--only 'update the room'`, a page of its own in a room on this device, a minute or
two): the Shared dialog's button (*Reload this device* there, with its line) armed by a first press for 3 s (*Reload this
device? Press again*, then back), a second press within it sending the order to the room's other tabs and obeying it at
once here (rank 0, 0.4 s; the toast *Updating the room: reloading in 1 s.*), kept for the reload (`roomReload`), the
reload itself replaced by a test hook; the labels in a room with others (*Update the room*, *Reload every device? Press
again*); an order heard twice obeyed once (*one obeyed just now*), one 3 minutes old skipped (*too old*); the headset
menu's `room:reload` on the Circles tab of a pretend session, two presses within 3 s; a real reload by an order: back
in the story in explore mode (livePlace), in the room, `room reload back` with its shell matching; and refused (4006, the
relay's words naming a newer version) while an order counts down: status `newer`, *reloads in its turn*,
`HOST.live.roomNewer` not called and the order's own reload coming at its turn; with none under way `roomNewer` at once;
with one whose reload never came, `roomNewer` once its 40 s are up.

Its *phone ar* steps (v125, `--only 'phone ar'`, two pages of their own, a minute or two): a pretend Android phone
(Chrome's user agent, touch, 412 x 860; a pretend `navigator.xr` that records what it is asked for; the airports story's
own `xrStart` through three.js r128's WebXR path, frames driven by the test; screen taps as Chrome makes them: a
transient `screen` input source, `selectstart`, a frame, `select`, `selectend`). No button on the page; the AR request
asking for `dom-overlay` once with `#xrPhone` as its root, depth sensing still asked; the round button in the session in
the window's top right corner (52 px, a 50 % radius, an icon, *Menu*), the root letting the middle of the screen
through; `beforexrselect` cancelled on the button, the sheet, a row and the sheet's heading, not on the root, the page or
the canvas; the sheet's thirteen rows in order, none under 44 px tall, each toggle (Sound, Narration, Sound effects,
Subtitles, Slideshow, Frame rate, Labels, Cards, Panels, Real world hides) changing what `HOST` says to what the headset
menu's row would and its words and `aria-pressed` saying so, Recenter asking the story to recentre, and the headset
menu's Settings tab having each of those rows; The full menu opening the 3D menu (logged as by `phone`, the sheet
closed), its row then *Close the full menu* and closing it, Close and the button closing the sheet; the notice *The
menu* saying *Tap the round button at the top right for the menu.* and the welcome a phone's words (no trigger, no
stick); Exit AR ending the session and the button gone; without the overlay (not granted) no button, two quick taps at
nothing opening and closing the 3D menu (logged as by `tap`), two 0.6 s apart not, and two at the open menu's margin
(pointed at, the menu's hover) leaving it open; the overlay refused once (a `NotSupportedError`, not the person's or
the browser's own): asked again at once without it, depth sensing still asked (two requests), the session running with
no button and two quick taps opening and closing the menu; refused again without it (a `SecurityError`, as when the tap's
activation has gone): no session, nothing of the button, and the page's line *Could not start AR: it was refused with
the menu button (...) and again without it (...). Tap Enter AR again.*; the person's own refusal (`NotAllowedError`) at
the first ask: asked once, the browser's words as they were; a headset's user agent asking for no `dom-overlay` and
showing no button. Camera mode's request is checked in `node tools/collab.mjs --camera` (its root `#camera`, `dom-overlay` once, no
phone button).

Its *controllers after standby* steps (v130, `--only 'controllers after standby'`, a page of their own, a minute or two;
`HOST.inputsGuard`, "Controllers after standby"): a pretend Quest's VR session through three.js r128's own WebXR path (a
pretend `navigator.xr` and session, the airports story's own `xrStart`, frames driven by the test through the session's
`requestAnimationFrame`, so the guard runs before the story's frame as on a headset), two Touch controllers with
gamepads pointing at the floor, the session's events fired as a browser fires them (before the frame's callbacks) or
not, and what reaches three.js's two controllers (the story's) and the session's listeners after the shell's recorded.
The controllers the browser announces reaching the story; real presses of the trigger and the grip, and one whose event
comes a frame before the gamepad shows it down, given once each, nothing missed, given or announced. Hidden and visible
again, waking moved back two minutes (`wokeAgo`), the right controller replaced without an event: nothing the first
frame, announced the next (`inputs replaced`, `woke` about 120 s; `disconnected` and `connected` at the story's
controller, its source the new one), a real select on it reaching the story once; replaced again with the browser's own
event a frame late: not announced again. A trigger press with no `selectstart`: `press missed` (right, select, its
source came by an event, about 120 s after waking, visible, its profiles, mapped), armed, nothing at the story; its next
press given once (`selectstart` as it goes down, `select` and `selectend` as it comes up, marked synthetic at the
session); a given press with its ray on the menu's Subtitles row turning subtitles over once; a real press disarming it
(`press back`, two given), that press once; armed again, the browser's `selectstart` coming after the frame that gave the
press: stopped (the session's later listeners never hear it), the session's `select` and `selectend` ending it, the
story getting one press and the menu's row turning over once, disarmed. The grip the same (`squeezestart`, `squeeze`,
`squeezeend`). A given press's own events coming late (the window made 5 s, `lateMs`, as a frame drawn in software can
take longer than 250 ms): the session's `select` and `selectend` after the frame that gave its end stopped (the
session's later listeners never hear them), the story getting one press and the menu's row turning over once, still
armed; its whole press late (`selectstart`, `select`, `selectend`, the trigger up) stopped too, disarming it; armed
again, a real press with the trigger down again at once its own (two presses, the row back); with the window 250 ms
again, a stray `select` and `selectend` 300 ms later reaching three.js as before. A tracked hand's button with no event: nothing; a trigger pressed while the session is `visible-blurred`
and held as it is visible again: nothing missed or given.

Its *trackers* steps (v126, `--only trackers`, a page of its own in a room on this device, a minute or two; "Vive
trackers"): `@trk` fed through the shell's own intake (`HOST.collab.trkIn`) at relay times held (`trkTime`): a tracker
going at 1 m/s and turning 90 degrees a second drawn 40 ms behind between its samples (to 1e-6 m and 1e-4 of its turn),
carried on 60 ms past the last by its velocity and at most 100 ms (still seen at 340 ms), not heard of for 600 ms ok
false with that pose kept, one its row says is not seen held where it was; bad rows (no id, too long an id, NaN, a place
past 10 km, not an array), a late sample and a member's `@trk` (`by` set) ignored, the good row of a mixed message taken;
`tracker(id, out)`, the room's key read and written (a write keeping the rest, a name cut at 24 characters, '' taking one
out), a message with `l` '' not lined up; the story's `effect` hook never called. The Shared dialog's section with the
relay's `/api/ping`, `/api/trackers` and `/api/trackers/still` stubbed in the page (`fetch`): shown with the switch off and
the three trackers' rows (the base station counted, the Index named), turned on, a name typed into `trk.names`, a tracker
moved 5 cm lighting its row only, *Set spot A* (its question `id=LHR-A&ms=1000`, *Spot A taken (still to 1.2 mm)*), spot
B 20 cm away, 6 cm higher and with the relay's error refused in words, then 1.84 m away written as `trk.m`, B again
without A refused; once heard from, *Lined up by hand (the spots 1.84 m apart): 2 trackers in the room.* and the room
map's two dots (a pixel read at one). A pretend VR headset (a browser that is not a Quest's; local and local-floor
spaces from a pretend real room whose trackers' room stands 5 cm above its floor; frames 60 a second at relay times held,
each with the Index's head where it really is): the `'trackers'` frame after a second within 1 cm and 0.5 degrees (to
3e-6 cm), *Lined up by the PC's trackers*; the head turned 1.5 rad, moved and pitched, still there; SteamVR's space shifted
4 cm and 1.5 degrees, followed to within 1 cm and 0.5 degrees; the head turning at 3 rad/s with the trackers a frame
behind, nothing taken; `lineUp()`'s words (the room taken as one on a relay for that moment); the menu's question
answered for it (*In the room*), the frame again at once. The Debug tab's *Trackers* row turning the pucks on (kept as
`xrTrackers`): LHR-A's puck where it lies (1 mm in room coordinates, 1 cm in the story's space), depth-tested, named
*Lamp*; LHR-B's dim where it was last heard of, named *Belt*; hidden again. `body()`: this headset's head and its grips
(left, right) within 1 cm and 0.5 degrees of where they are in the room; presence's `g` `[left, right]` and its rays the
left's first though the session's sources are right, left; another person's two presences smoothed between them (their
right hand new, as it is), an older app's with no grips, nobody or a page null.

It needs Playwright with a Chromium build (`npm i --no-save playwright` and
`npx playwright install chromium` once, or a global install; see
`docs/setup-and-release.md`). A 404 for a missing narration MP3 is expected and ignored.
WebGL runs in software (SwiftShader) headlessly, so frame rates are low;
real-headset behaviour (controllers, session hand-over between stories,
placement and comfort) can only be confirmed on a device - say so when you
report results.

The smoke test's studio block runs on a page of its own at
`#studio&scenes=tools/studio/test/scenes&scene=test&edit` (the committed test scene, no relay): not on the Stories
screen, in `STORY_EXTRA`; every file loaded with its sizes and the two guesses in the card's words (and one the studio
refuses, and one sized to 1 m), the clips, the missing texture, the opacity-0 material drawn solid and a mesh without
normals; the layout read; a pretend head moved into the cube showing the figure and the sound and hiding the box,
fading over 0.4 s (stepped frame by frame), the figure's take from when it was shown, out again the reverse, a
`stay` cube holding; nothing see-through while editing (v131: the box the cube hides not drawn but its outline at once,
with its tag *Box · 12 ▲ · hidden*, pointed at through its unseen box, the labels pointed at and selected with its
triangles, the tag following a stand-in Fewer triangles preview; a pretend headset's grip and the page's arrows holding
it drawn whole, every material its own, its outline again once let go; the cube's edges only, in its own colour inside,
darker outside, lighter selected, picked from inside and outside; a shape the cube hides its edges and tag, a ball that
hides things its three rings, depth only, its unseen fill; nothing drawn of the items, their looks and tags see-through;
a pixel at the hidden box's middle the same with its outline drawn as without, and the box drawn there showing; not
editing, as before); editing on the page (a click selecting, the arrows moving it,
a cube grown, *Shows* under the box's Items card linking it, Add and Delete, Undo); the shared state and back (`apply(state())` the same), a state from
the room taken, bad values ignored; a pretend headset's grip carrying an object, both grips sizing it, a corner
stretching a cube, the VR stick walk (none in passthrough) and Recenter; the sticks while something is carried (v120: the
other hand's left stick up held 1.5 s doubling the box about its middle, right a quarter turn in a second, the right stick
up pushing it away along the hand's line by e^0.75, left turning it back, no walk meanwhile, one Undo step; a group about
its pivot, twice and a quarter turn; a sound's reach; a locked box refused); the relay's watch (a scene added, a layout
removed) and its password (one refusal told once, nothing more asked until another; a stubbed `fetch`); the emitter's
HRTF panner at its place once shown, silent while muted; a sound longer than 20 s streamed through an element (no
decoded buffer), a short one decoded, paused while muted; GLB first (the Add list's folders, an OBJ from `originals/`,
*Convert to GLB* in the page offered as a download, its bytes a GLB whose record names the original and that loads back
with the same triangles and clip, a placed figure switched to it keeping where it stands, its corners within 1 mm);
the Upload pane with no relay (the test originals dropped: the plan's rows, grouping and names, converting offered as
downloads, a mono WAV of each sound, each model row's picture of its GLB); the Add pane's grid and pictures (v120, no
relay: a card per model with a plain tile and its kind, the cards' words, sounds a list, 3 to 5 a row; *Convert to GLB*
making the figure's picture, 256 px with the model in the middle and dark corners, its record's `size` and `n`, shown on
its card; *Make pictures* making the box's and the crate's for this page, its line, *Stop* after one; a picture made for
an opening of the scene that is over kept nowhere; the headset's
canvas, three a row, a picture drawn and a plain tile without; `previews/` in a listing never among the scene's files
or textures, an older relay's `image` taken by its path); the Items pane as cards (v122, with a group of a ball that spins
and an empty, a cut-out on the box and three shapes, one locked and hiding things, put in for it: the box's picture made
for this page, the figure's plain tile with its kind, a tile per shape, the empty, the cube and the sound, really drawn in
their colours; the order, the group's heading and its members first, the cut-out a tag after the box's face, the
sections by kind; the lines and the marks; a press on a card selecting it, its card lit under Items, the tag selecting
the cut-out, the heading the group; the cube selected, *Shows* and *Hides* under every card but its own and under the
cut-out's tag, three presses three Undo steps; the ball's faint line saying it spins; a pick by a press, the card ticked
with a green border, and the cut-out's tag pressed, on the list and green; the headset's canvas: three a row, paged by
More, the box's picture and the ball's tile bright where the figure's plain tile is dark, the selected card's border in
the accent colour, the cut-out's tag the card's width less its margins with its toggles on a row under it, picked, its
edge green, a toggle and a card's face pressed by a pretend ray); Fewer triangles and Change texture (v119: a dense ball with a red and green checker
made in the page, 24,320 triangles, served as `ball.glb` and placed twice, nothing committed: its card's preview at 20 %
within 1 % on that object only, every corner's texture coordinates as before and its colours as before, the selected
ball's label and the other ball's tag counting their triangles (v131: the preview's, its own; after the switch, the new
model's), the slider at 50 %, the pretend headset's card (steps and quick picks, its 10 %, Save only with a relay that takes uploads), Save
downloaded with `tris` in its record, both balls switched to it with the original as the base (*The model here has only
N*), Change texture's list, figure.png shown on that ball only, Cancel putting its own picture back, Save with `tex` in
its record, the headset's ray choosing and cancelling, nothing for a visitor; the Upload pane's share (20 %, its count
read from the bytes, 30 % on its slider), its picture and its conversion with that share); the gaps filled (v120: a dense
ball whose picture is an atlas of 128 wavy pieces with 6 px of black between them, made in the page, placed as scanned:
pixels read back from four sides, none black with all its triangles, many at 10 % without the fill and none with it in
the preview, the same in the GLB Save downloads against the converter's own made with `fill: false`, the fill worked out
once for two shares, the record's `fill` and its note, the placed GLB's card line and Fewer triangles on it filling nothing
again; a picture that tiles and one a plane uses whole left alone; a piece drawn down 4 times by the converter's reading
filled with no dark rim beside it, the same drawn down by hand with one; a see-through picture whose gaps are clear left
alone and said, one whose gaps are opaque black filled with its alpha kept); the headset panels' panes and its Stories screen (no Upload tab and no Convert
there); *Download layout.json* giving the layout; `#studio&upload` opening the Upload pane. Its *studio textures* steps
run on another page, at `&scene=textures` (the second test scene, every model placed): every rung of the ladder; TIFF
(LZW, PackBits), a PSD named by an FBX (the `.ps~` renaming) and DDS (DXT1, BC5) read in the page, their pixels sampled
against those they were made from (`tools/studio/test/pictures.mjs`); a refused picture's sentence; the cards' lines;
*Use paint.png* and *Choose a picture...* (the chooser stubbed with a file) each converting at once to a downloaded GLB
whose record has `tex` and that loads back textured, the object switched to it where it stands (corners within 1 mm),
its card then naming the picture; *Add a texture...* on a box with no material (Roughness preselected by the picture's
name, Colour chosen); no UVs refused in words; roughness and metalness packed into one; the crate's bump made a normal
map; the Upload pane's plan (`only`, `ext`, `similar`, *Not this* and *Use*, a picture dropped onto a row) and its four
GLBs with their records; no texture buttons, and nothing converted, for a visitor (`&visit`) or with editing off; the
headset's card (no texture buttons, *Add a texture on a laptop*). Its *studio follow* steps run on a third page, at
`&scene=rig` (the third test scene: a skinned dancer whose bones are named in mixed conventions, Bob's box, the Z-up
figure, and *Voice* following her head by an FBX's name for it): the sound at her head bone plus its offset (worked out
on its own from the bone's matrix, within 1 mm) every frame the page draws and every 1/30 s of her clip, and at three
moments (her head through more than 0.5 m); the short list of bones and the lenient match (*mixamorig:Head*,
*mixamorigHead*, *MIXAMORIG_HEAD*, *Bip01 L Hand*); a part of Bob's box rising with it and the whole model; attaching,
another bone, *Move onto it* and *Stop following* each keeping it where it is (one Undo step each), and the page's card
(the pick list, the bone row, *More bones*) and its label (*→ Dancer · Head*), and the line to her head; a pretend
headset's grip carrying it (not following meanwhile, then following from there with a new offset); her size steps, both
grips and the arrows' size scaling its offset (the same point on her, within 1 mm, one Undo step each); *Convert to GLB*
of the figure (a turn baked in, a sound on its whole model) and of the dancer (*Voice* on her head bone) switching where
they stand, both sounds within 1 mm; her deletion (the sound stays, following nothing; Undo brings both back) and a
copy of *Voice*; a cube hiding her silencing *Voice* (its gain to 0 though it is shown) and showing her again starting
it from its beginning; the state with `on`, `bone` and `o` and back, bad values refused or dropped, a state without her
(the sound at its own place), `layout.json`'s rules (a sound whose object the layout lacks keeping what it follows),
Rigify's spine in the short list, the object it follows picked again changing nothing, a move while her model is not
here writing its place only, both grips between their writes and a sound naming a bone the figure lacks turned with
its GLB; the headset's card (its rows, a page of eight bones at a time, a
bone she lacks refused, the list of objects and the trigger on her). Its *studio cuts* steps run on a fourth page, at
`&scene=cuts` (the fourth test scene: a wall whose *Door* the cube *Doorway* shows, *Box A* with a *Hole* and *Box B* of
the same file, the dancer, the figure): pixels read back from a render of the scene prove each cut (inside the box where
the model was: what is behind it; outside: the model): the hole in *Box A* and none in *Box B* (one file, two objects, only
the first's materials patched); the wall whole with your head outside *Doorway* and opened inside it, whole again outside;
the wall moved, turned and sized (the door's corners in the wall's own frame unchanged, its record scaled with the size,
one Undo step) and the hole still where the door is; the dancer's posed head (her clip held where it is far from her
rest pose) cut by a box round it, her rest-pose place not; *Convert to GLB* of the figure (a turn and a scale baked in)
switching with its cut-out's corners within 1 mm and still cutting; the state with `x.<id>` and back, bad records
refused, unknown fields ignored, a state without the wall (the door kept, cutting nothing) and back; 16 on one object and
no more; `layout.json` with and without `cuts`; the page's card (*Cut out a part* where the click met the wall, the
size steps, *Preview: Whole*, *Cut* and *As seen*, Delete and Undo; deleting the wall taking its cut-outs and Undo
bringing them back; duplicating it copying them; *Move onto another object...* keeping its place); the Add pane's
button; the page's arrows; the pointer (a thin cut-out inside the wall found through the wall's unseen box, the wall
found in a pick, Box B moved in front of the door found first); *Preview: Cut* opening the door its cube hides, *As
seen* shutting it, editing off forgetting it; a new cut-out (and one put back by Undo) cutting at its first frame; 17 on
one object made in reverse id order (the 16 lowest cutting, the 17th said); a cut-out's copy and the wall's copy's door
in the cube's list; Box B sized with a 30 m cut-out held at 50 m and said on its card; *Cut out a part* from a ray at the
dancer's posed head landing on her as drawn; a pretend headset's grip carrying one, both grips sizing it and a corner
stretching it; nothing of a box drawn when not editing (only the hole); the Items pane (the wall's cut-outs tags on its card) and the headset's card (its rows;
Preview pressed there); v124: the wall's cut-outs locked from its card (one Undo step): the door cutting as before, its box hidden and
never pointed at, sizing it, deleting it or the wall and a new cut-out on the wall refused, the card and the Items pane
saying so, the state and `layout.json` carrying `cutsLocked` (a bad one refused, false not kept), a copy of the wall not
locked, unlocked its box back, Undo bringing it all back; v125: no see-through fill (the door's box with no mesh that shows, its edges lit when pointed at or selected, lighter with denser dashes and ticks a third long, plain again after; v131: its lines, ticks and corners opaque, previewed whole (cutting nothing) darker; the pixel at its middle the same with its box drawn as without, plain, pointed at and selected). v118 adds three steps after the pretend headset's grips: inside a model (the pretend controller in the figure's unseen box
pointing at nothing: the figure pointed at, its dot on its box, the trigger selecting it; pointing at the box from there:
the box; outside every box: nothing, and the trigger clearing; editing off: nothing; Walk view with the camera in her box:
a click on nothing selects her, one on the floor walks), *Hold it* (on her headset card only; armed, a grip of the other
hand on nothing carries her from where she stands, one Undo step; without it nothing; another selection or a second press
disarming it), the sticks (the ray on the panel: the left stick pushed down scrolls her card, held to its end and no
further, the dead zone nothing, pushed up back to the top, a ramp, neither the left stick walking nor the right turning
there, a hand carrying something not scrolling; pointing away the left stick walks again), and New scene and From
another scene (neither with the folder of scenes; with a relay and the keypad stubbed: the page's field and *Make it*,
the name rules said here first, a name taken, the headset's keypad asked, cancelled and given, no field in a headset;
neither for a visitor, while locked or on a read-only relay; a circle made for one scene opened `'fresh'`, one with items
from the room, a station changed to the same scene opened again). Its *studio groups* steps run on a fifth page, at `&scene=rig` (with, put in for them, the figure,
a sound *Free*, a sound *Out* following the figure, a cut-out *Hole* on the box and a cube *Lamp* outside the group):
*Make a group...* on the box's card and its pick mode (the dancer Ctrl-clicked and *Free* Shift-clicked in the scene,
*Voice*, *Out* and *Curtain* by their cards under Items, *Done*: one Undo step each); a click on a member selecting the
group, again the member alone (*In group*, *Select the group*); hover naming the group (*Group · Dancer*); its box only while
selected and editing; the Items pane (the group's heading, its members' cards under it, the hole a tag on the box's card); *Make a group...* then
*Done* with one item leaving no step; a group picking its one member left out of `layout.json` and *Unsaved changes*;
Undo of the pick that gave a group its second member, after *Done* and while picking, leaving it picking again (*Done*
then taking it back as never made, no step left over); the arrows' move, turn (the vertical ring only; a tilt given dropped) and size about
the pivot moving every member exactly (places, turns, sizes, the cube's size and yaw, the sounds' reach; the hole on the
box and *Voice* on her head bone and *Out* on the figure outside the group, within 1 mm), one Undo step each, and Undo
bringing the state back; the pivot staying within 2 mm after a turn of 0.6 rad, a quarter turn more and a size; the
card's *Turn 90°*, ×2 and *On the floor* (lifted 0.4 m first, *Curtain* centred on the floor not counted); ×20 holding
two sounds' reach at 20 m, said on the card; ×400 holding a place at 1 km (every member written, none left behind); *Duplicate* (a new group of the six copies and the hole's copy, the box's copy beside it,
*Voice*'s copy on the dancer's copy, *Out*'s still on the figure beside it, *Curtain*'s copy hiding the dancer's copy,
the copies in *Lamp*'s list, one step), *Ungroup* and *Delete* (every member and the hole, *Lamp* letting them go) with
Undo; *Free* moved into the figure's own group, the figure then deleted and its group, left with one, going in the same
step (*Out* left following nothing), Undo bringing both back; *Lamp*'s pick toggling the group's members (a member, a cube
of the group, the group's heading under Items; a cube in a group of cubes alone selecting its group, ending the pick); the
state with `g.<id>` and back, `norm`'s rules, a bad group from the room
ignored, an id two groups name staying in the lower id's in either order of the keys; `layout.json` with and without
`groups`, and groups naming items the layout lacks; a pretend headset's trigger (the group, then the member), its grip
carrying the group (one step), turning with the hand only while moving freely, both grips doubling its size about the
pivot, a member selected alone carried alone, the box carried alone and the other grip on the dancer carrying her alone
(one step), the group held and then gone from the room ending its change in the next frame (Undo working at once), and
the headset's cards (the group's rows, *Add or remove items...* pressed
twice; a member's *Select the group*, *Make a new group...* and Faces). Its *studio faces* steps run on a sixth page, at
`&scene=rig` (the box still, and *Twin*, a copy of its file): pixels read back from renders, each with the object drawn
and not: from inside a box *As in the file* shows nothing of it and *Inside out* and *Both sides* show it, two copies of
one file each as set (their materials' sides too); from outside *As in the file* and *Both sides* its near side, *Inside
out* its far inner side, which a cut-out taking the far half away removes (and leaves *As in the file*'s near side); with
a cut-out in its near side *Both sides* showing its far inner side through the hole and *As in the file* nothing, lit and
as scanned; *Inside out* kept through a rebuild of its file (`fileChanged`) and the figure's *Both sides* through *Convert
to GLB* and the switch; the state and `layout.json` with `faces` (`null` read as absent, other values refused); the page's Faces row (one Undo
step each) and the headset's. Its *studio tint* steps (v125) run on a page of their own, at `&scene=rig` (the box still, and
*Twin*, a copy of its file, beside it; `--only 'studio tint'`): pixels read back from renders of both near sides: a red tint
(`#ff5a4b`) making the box redder, brightness 2 brighter and 0.5 darker, Twin unchanged, lit and as scanned; the box's
materials its colour as loaded times the tint times 1.5, each its own; kept through a rebuild of its file (`fileChanged`)
and the figure's *Convert to GLB* and switch; the state and `layout.json` with `tint` and `bright` and back, `norm`'s rules
(a colour lower-cased, other values refused, a brightness held at 0.25 and 4, 1 dropped, rounded to 2 decimals); the
page's rows (a swatch, *Any colour*, Darker, Brighter, Reset greyed at 100 %, None: one Undo step each; Darker held at 25 %
and greyed; not refused by a lock in place), a group's rows (both objects in one step, *Brightness: they differ*, Brighter
on each one's own) and the headset's (a swatch and Brighter pressed on its panel, no colour field there). Its *studio
viewer* steps (v125) run on a page of their own, at `&scene=test` (`--only 'studio viewer'`), the viewer's pixels read from
the canvas in the same task as it draws: an Add card's Look (none in a headset; the overlay at z-index 14 over the whole
window, the canvas raised to 13, Close focused; the box, 12 triangles, 0.5 m, 5 cm grid squares, turning by itself; drawn
in the middle with the background at the sides; a click stopping it, a drag of 100 by 20 px turning it 40 degrees round
and 6 up, the wheel zooming out by e^0.24, a right drag panning, a double click framing it again exactly; Wireframe
changing over 1,000 pixels; Textures off taking every picture off and on putting them back; As scanned; Delete, Ctrl+Z
and P reaching nothing behind it; Esc: the overlay gone, the canvas under the page again, nothing written, Undo unchanged,
the studio drawing again); an Upload row's Preview (the test originals dropped: the figure stood up, 1.7 m, its 12
triangles, drawn in the middle; Close leaving *Seen in the viewer* on its row; then a dense ball made in the page: 24,320
triangles, 20 % kept within 1 %, *All: 24,320 · Lighter: 4,8xx*; the wireframe changing more pixels for all its triangles
than for the lighter one; Side by side drawing both, the left half with more edges, each said over it; the slider at 50 %
making it again within 2 %; Close putting 50 % and what was seen on the row; nothing written); and Fewer triangles' Look
closer on the ball placed and tinted red (its tint on the viewer's materials and drawn red, 24,320 triangles at the card's
20 %; the slider at 30 % showing it side by side; Esc putting 30 % on the card, its preview made again; nothing written).
Its *studio shapes* steps run on a seventh page, at `&scene=test` (v119): the Add pane's four shapes and an empty
(their records, geometries and names), a shape's card (a colour's swatch, *Hides things*, size per side and every side, its
kind, five Undo steps), the page's arrows sizing it per axis in its own frame, the Items pane's Shapes and Empties cards, the
headset's card (its rows, a colour pressed); pixels read back from renders: a shape that hides things between the camera
and the box shows the sky behind where the box was, one in red draws red, and editing shows its opaque edges alone (v131:
no fill; an unseen one pointable) while it still hides (pixels); a
sound following an empty (picked by pointing, following as it moves, the cards on both sides, silenced by a cube hiding the
empty), an empty drawn only while editing; *Lock in place* on the card (one Undo step, the move buttons greyed, the arrows
off, the 🔒 in the label) refusing the card's actions, the Delete key, *Hold it*, a pretend headset's grip, both grips and a
corner; a group with a locked member not moving or going and saying which, a group's lock holding its member and refusing
*Ungroup*, an object with a locked cut-out not deleted; *Unlock* from the card (the turn then working) and *Lock* from the
headset's card (its move and Delete buttons then not offered); the scene's settings rows (page and headset, only while
editing, one Undo step each) and the shell's hooks, stubbed, told in order: outside a room only the real world, at a
pretend station the other circles hidden, away both off, *Never*, back; another scene's settings and its hooks off; the
lobby hook forgetting a cube that stays and starting a `shown` animation again, writing nothing; the state with `p.<id>`,
`e.<id>`, `locked` and `settings` and back, the room's records taken (colour lower-cased, `locked: false` dropped), bad
ones and bad settings ignored, a state without settings a new scene's, 200 shapes at most from the room, `layout.json`
with shapes, empties and settings read back the same, an older layout read as before, bad settings and a bad shape
counted, a group of a shape and an empty; and the hooks off as the studio goes. Its *studio behaviours* steps run on a page
of its own at `&scene=test` (v120, with a turned shape that looks, a ball that follows, an empty that keeps away and a cube
that follows the ball put in for them, a pretend head moved about, `STU.head` with its turn, and the clock held, `behNow`):
the look's front to the head, its middle still; the ball 1 m in front of the head at its own height and turned to it,
never faster than its speed; the cube at its offset on the ball as drawn, and still while the ball spins; the empty at
least its distance from the head within its area, cornered to the far side of its area, home once home is clear of the
head; an object (the box) looking; nobody in range, all of them where they are placed and every record unchanged; who it
reacts to with pretend others (`BEH.fake`): nearest (one nearer by 0.2 m not taking over, by 0.4 m taking over, kept to
range + 0.5 m, ties by id), first (the first kept while the other stands nearer, until they leave; ties by id), this
device driving only while it is the one, a page with no head counting for nothing; going on while selected (editing:
still driven here, away from its place, its ghost at its placed pose) and resting while carried and while paused, starting
again from its place each time (v122); a pretend other device's samples (its effect, `studioEffect`) drawn
120 ms behind (within 2 mm) and going home once they end; the page's Behaviour rows (Follow, First to come close, More,
Closer, Faster, Keep away, Less, Look at, Follow an item... by pointing and by the list, None: one Undo step each, the
pick none) and the headset's; the state and `layout.json` carrying behaviours and giving them back, `norm`'s rules (bad
kinds, whos, numbers and targets refused, out of range held, another kind's fields dropped, a cube's and a sound's
ignored), a bad behaviour in a layout counted, a group's copy following its own; and (v128) Faces: the cube following the
ball with Faces *The item* turned to face the ball within a degree, its middle unchanged, and back as placed; the item's
Faces row on a page (kept when another item is picked) and on the headset's card (Right then Them: one record with `side`
and `face`; Look at dropping it); `face` through the state and `layout.json`, and `norm`'s rules for it. Its *studio motions* steps run on two pages
of their own at `&scene=test` (v120, with a shape turned and sized per axis, an empty, a sound following the empty and a
cut-out on the box put in for them): each kind's drawn pose at two moments its formula (about its middle, in the scene's
axes, for the shape, the box and the empty), its holder and record unchanged; the sound on the bobbing empty, the cut-out
on the spinning box and a sound on the pulsing box (its offset grown with it) coming along; no motion, at rest; `always`
drawn alike on both pages at one room time (a pretend station, `HOST.collab.now` stubbed), `shown` from its showing and
from its beginning when shown again; going on while selected (editing) and its group selected (both members' ghosts
shown, the group's pivot still while they move), resting while a sound on it is selected or carried and while a pretend
headset's grip carries it, moving again after (v122); the page's Motion rows (a kind, Faster, Less, an axis, When
shown, another kind, The other way, None: one Undo step each, the line about the ghost, the list's *spins*) and the
headset's (Pulse, More, None); then (v122) a step for the ghost: none before it is selected, at its placed pose while a
bob draws it 1 m above, one part and one unseen box; the page's arrows on its stand-in (`TCP`), a drag through
`TransformControls`' own events moving its record by 0.5 m with it resting there meanwhile (one Undo step) and moving on
from there after; a ray at where it is placed (under where it is drawn) finding the item through its ghost, a pretend
headset's grip there carrying it from its placed pose and moving it 0.3 m; an object's ghost (its clip off) as many
parts as its model's meshes, opaque light grey, writing depth (v131), a big one (`GHOST.tris` lowered) only its outline
box, an empty's two parts, a sound's (its own path) two, none of them see-through, none once deselected; the box with its
clip playing while editing: a ghost at its placed pose, its opaque outline box only (v131), and still once selected, the
page's arrows on its holder there (v125); its ghost built again while its clip stands still, the model
keeping its frame (v129); Pause from the Scene pane (every item at rest, the box's clip time held over 0.7 s of scene
clock, the pane saying so, `state()` unchanged), the card's switch playing them again (the arrows back on the ghost), P
pausing (the arrows back on the item), editing off playing them again; Start again on a motion that starts when shown
(its clock from now, no Undo step); a cut-out on the spinning box and a sound following the orbiting empty, each
selected: what it is on resting, no ghost, the arrows on its own holder, a drag through `TransformControls`' events not
moving it as it begins and moving it by just the 0.1 m dragged (one Undo step), let go within the record's rounding, both
moving again once deselected; and a cut-out made where a click met the spinning box (its clip off) put on that part
of it in its own frame, within 1 mm, though it spun on before *Cut out a part*; the state and `layout.json` carrying motions and giving them back, `norm`'s
rules (bad kinds, values, axes and starts refused, out of range held, a cube's ignored), a bad motion in a layout counted.
Its *studio paths* steps run on a page of their own at `&scene=test` (v120, with a shape, an empty and two sounds put in
for them, the recorder's clock the test's): a recording by a pretend headset's grip (Record its movement armed on the
box's card, a grip on nothing, 3 s at 30 frames a second, the hand moving and turning, the right stick pushing and the
left turning): fewer than half the samples kept as keys, the pose at every sample's time (between keys too) within 5 mm
at its middle and 1 degree of what was recorded, one Undo step, its place unchanged, playing at once while selected and
drawn there as recorded, playing on once selected again, Undo taking it back; a path of three keys on the shape at chosen
times looped, once and back and forth, at ×2 and when shown, a bob on top, the shape moved and turned (its path with
it), a sound following it, a sound's own path (and its emitter), a following sound's own path waiting, the box's cut-out
coming along, at rest without one; the refusals in words (too short, not moved, a jittery 700 frames needing more than
600 keys, ten empties of 599 keys leaving no room for the scene's 6,000 and their copies refused, the shared state's limit
lowered, a locked item, a following sound, a group) with nothing changed, and 120 s stopping it and keeping it (its slow
drift's last centimetre cut as a still end, v122); a page's
recording (Record on the card, the Move arrows dragged 0.6 m over a second through `TransformControls`' own events, half
a second still, the size steps and the Size arrows refused, Turn 90° on its card, half a second still, Stop): its timing
as recorded, its still end cut (it ends 1.533 s in, the first sample after the turn: it loops), the card saying its end is
60 cm and 90° from its start and 0.5 s of stillness cut, one Undo step, its place as before, playing at once with its
arrows on its ghost; the page's rows (Once, Back and forth, When shown, Faster, Slower, Loop, Start again with its
*shown* clock from now and drawn at its path's start, no Undo step, Delete recording: one Undo step each) and the
headset's (no page Record, Record its movement armed and disarmed, Back and forth, Faster, Delete recording); the
recording's ghost and the loop join (v122): a pretend headset's recording of the box (12 frames still, a circle 0.5 m
across at 2.5 s a turn stopping 4.2 cm short of its start, 12 frames still), its ghost at its start pose in every frame
and lit from the frame it came back within 5 cm (frame 85), a pulse of 0.1 on the stubbed haptic actuator and a forced
`hover` tick asked of the stubbed `HOST.sfx.play` in that frame; the path cut to 73 frames (2.433 s, moving within 0.1
s), its last key its first's pose, drawn within 5 mm across the seam and its velocity over the last and the first 0.05
s within 30 % of each other; one Undo step, its place unchanged; the card's *Loop closed: its end met its start (4 cm, 0°
apart; 0.8 s of stillness cut)* and *Keep it as recorded* (the raw 3.233 s path, its last key 4.2 cm from its first, one
Undo step); one ending 40 cm away not joined (*Its end is 40 cm from its start, so it jumps back each loop...*, nothing to
keep); a back-and-forth one recorded again neither cut nor bent and no line; a page's recording through the arrows (0.3
m out and back to 2 cm, 10 frames still, Stop) its ghost lit and joined (*... (2 cm, 0° apart; 0.3 s of stillness
cut)*, its last key its first's pose, 0.967 s, one Undo step); Stays on the floor (v130): the page's row off by default
and on once pressed (`studioRecFloor`), a pretend headset's recording of the box started 0.5 m up and tilted (asin 0.6
about x and turned) with the hand lifting, tilting and turning it and the sticks pushing and turning: drawn on the floor
and turned only about the vertical after every frame's carry, every key's turn within 0.05 degrees of a turn about the
vertical and its lowest point within 1 mm of the floor (and drawn so by its path), its record set down on the floor with
its turn and x and z as they were, one Undo step, Undo putting it back up; an empty and a sound lifted and tilted keeping
their height; a page's recording of the shape with the Turn arrows tilting it as they turn it (no tilting rings, the
scene's frame, the tilt dropped from its record and holder), *Stand up* refused, the Move arrows with no up arrow and a
lift dropped, its keys on the floor and turned 0.9 rad about the vertical, one Undo step; Record then Cancel leaving the
raised box as it was with nothing to undo; the headset card's row pressed off and on; kept across a reload (the page
loaded again, the row on, then turned off); the state and `layout.json` carrying paths (an
object's, a shape's, an empty's, a sound's) and giving them back, `norm`'s rules (2 to 600 keys, the first at 0, strictly
later, at most 120 s, 8 finite numbers a key, a turn of length 0, play, start and speed, a cube's and a cut-out's
ignored, a following sound's kept and not played), a layout and a state from the room past 6,000 keys, and a GLB switch
of the figure turning its keys (drawn where it was, its turn times the baked one).
Its *studio recorder* steps (v125; `--only 'studio recorder'` runs them alone, about two minutes) run on a page served by a
relay of its own (`--static . --scenes` on a temporary copy of the test scene, ports from 8930: uploads land there and are
read back from the disk) in a browser of its own with Chromium's fake microphone (`--use-fake-ui-for-media-stream
--use-fake-device-for-media-stream`): a ten-minute page recording of the box (18,000 frames of a circle on the recorder's
clock, the test's) stopping by itself at 10 minutes, simplified a slice at a time (`SIMP.last`: at least 2 slices, the
longest under 100 ms) and kept as `recordings/Box-1.json` through the relay (its record's
`src`, `len` and `n`, more than 600 keys, the file's `n`, `k` and `len` the same, one Undo step, its place unchanged, its
card's line), drawn at 10, 50 and 90 % in within 5 mm and 1 degree of the samples and a loop later the same, then its keys
dropped here and read back from the scene as another device reads them; 18,000 jittery samples (a shaky hand for ten
minutes, made in the page) simplified at once, a slice at a time and by the simplifier as it was before slices, the same
keys all three ways (its times printed, the longest slice under 100 ms); a 3 s one still in the record; the refusals with
the relay's uploads turned off (its longest 120 s, a recording past 2 minutes, more than 600 keys: in words, nothing
changed, no file); `norm`'s rules for `src`, `len` and `n`; the state and `layout.json` giving a file's path back (the
scene's 6,000 not counting it); the figure given that path and switched to a GLB, a new file `recordings/Figure-1.json` with
its keys turned, drawn where it was (within 1.5 mm), and with the relay's uploads off (or its file not in the scene, said
within 3 s) not switched at all: the figure left on `figure.fbx` with its path, no Undo step, its card and the note saying
why (*Not switched to models/figure-x.glb: its recorded path is kept as the file ...*); *Move the scene to this circle* at
a pretend station's circle (2 m off, turned a quarter) with a sound whose own path is a file: refused in words with the
uploads off, nothing moved; with them, a new file `recordings/Walking-1.json`, the sound drawn where it was turned with the
scene (within 1.5 mm), one Undo step, Undo giving its file back; then *With my voice* turned on (the card's switch says so), a page
recording of 4 s in real time (0.6 s still, then round) with the fake microphone: its sound `sounds/Box-voice-1.wav` on the
relay's disk (a mono 16-bit WAV at 48 kHz) placed as *Box voice* following the box with `sync`, `loop: false`, `skip` the
loop join's cut start less how late the microphone began (within 2 ms) and `len` to the path's end (`dur - skip`, at most
the path's), the path and the sound one Undo step; with the sound on, its voice where the path's clock says within 50 ms
as it plays and again at the path's next pass; *Record again* with the microphone 1.5 s late (`getUserMedia` delayed in
the page, the movement begun at once): a new file `sounds/Box-voice-2.wav` (the first one's on the disk unchanged), the
same sound pointed at it, `skip` below 0 and `len` to the path's end, more than the file's length (the old rule cut it),
still synced 0.3 s before its end and heard within 50 ms of the path's clock; the state and `layout.json` round trip;
`norm`'s rules for `sync`, `skip` and `len`; the recording deleted leaving the sound, its card saying *no longer synced*,
and Undo taking each step back (the voice's first file again). Then a streamed voice: `sounds/long.wav` (25 s) synced to a
40 s path of the box, playing through its element: its moment within 80 ms of the path's clock as it plays (median 60
ms, at most 120 over 3 s, sampled every 0.2 s), put 0.5 s off and set again within 3 s, and started again (as a new pass)
at its level at once. It prints what it measured (keys, the drawn distance, the simplification's slices, the voices'
offsets).

Its *studio texture swaps* steps run on a page of their own at `&scene=test` (v124; `--only 'studio texture swaps'` runs
them alone, about two minutes), with two solid 8 px pictures made in the page and served as the scene's own
(`tex/magenta.png`, `tex/lime.png`), *Twin* (a second object of `box.glb`) and three cubes put in for them (*Magenta* and
*Lime* overlapping, both on the box's colour, and *Stays*, a cube that stays, on it in lime): the pictures read once, a
GLB's without flipping and sent to the GPU ahead; pixels read back from renders of the box's and Twin's fronts with a
pretend head moved about: outside its own, in *Magenta* magenta, in both *Lime* (entered last), in *Lime* alone lime, in
both again *Magenta* (entered last), outside its own, in *Stays* lime and still lime outside, in *Magenta* after it
magenta and lime again outside, Twin its own throughout and its materials untouched; Reset what I have seen and the lobby
hook giving its own back; Change texture's preview opened on the box with the head in *Magenta* (its own shown, the box
`held`), the cube's again once it closes; as scanned (its material as scanned made while the cube's picture was on: from
its own) the colour change shown and a normal-map entry on its lit material only, out of the cube both materials' own
pictures; the state and `layout.json` carrying `tex` and giving it back, `norm`'s rules (an entry that is not one
dropped: an id that is not one, a material of -1, 1.5 or 256, a slot it has not, a path with `..`, a model's file, `{}`,
`null`, a list; a second for the same object, material and slot; 17 kept as 16; `null` or `[]` absent; a string or an
object a bad cube; an unknown field dropped), a layout's four bad entries counted (`texBad`) and one for an object it
lacks dropped, a cube whose `tex` is a string bad, the Scene pane's sentence; the page's card: *Change a texture...*, the
object from the card's list, *Another object...*, Twin by a click in the scene (`pressItem`), Glow and *lime.png*: the
entry added (one Undo step), Twin glowing lime in the cube and the box magenta, nothing outside; its row flashing the box
in amber (no Undo step); ✕ (one Undo step) and Undo; the Items card *Cube · shows 0, hides 0, textures 2*; editing off and
a visitor (`OPT.visit`): no pick, no change, the button greyed; the headset's card (its rows, *Change a texture...*
pressed, the trigger on the box, Occlusion and *magenta.png* pressed on the panel, the entry added, ✕: one Undo step
each); deleting the box taking its entries out of all three cubes (one Undo step, Undo bringing them back), duplicating it
adding an entry for the copy beside the box's in *Magenta* and *Stays*, a cube's copy keeping its entries, a group (the
box and *Lime*) copied (the cube's copy on the box's copy, *Magenta* gaining an entry for it); `texRemap` (two materials
swapped by meshes and names, by names, none known) and `texSwitched` (a material's index changed in a switch's change,
Undo); and the figure, with an entry, converted to a GLB in the page and switched to it: its entry kept, its material found
again (`[0]`), put on its GLB's model in the cube and off outside.

Its *studio cube starts* steps (v136; `--only 'studio cube starts'`, about three minutes) run on a page of their own at
`&scene=test` with editing on: *Lift* (1 s, up 0.4 m) added to `box.glb`'s clips in the page, *Twin* (a second object of
`box.glb`, Animation Off) and four cubes apart from Doorway (*W*, *S* a cube that stays, *D*, *H*), the studio's clock held
by the test (`trgClock`) and a pretend head moved about. Clips (the box's node read back): a once from its start (y 0.03 at
150 ms, half blended in; 0.2 at 500 ms; on after leaving; fading from its end; gone with no layers and its end logged), Twin
still throughout; a new run 360 ms after leaving crossfading from the old one's frame (0.222: half Lift(0.96), half
Lift(0.15)); out 100 ms and in again one start; a loop on the stay cube on after leaving until Reset what I have seen
(at rest at once, logged); a hold at its end, coming off 0.3 s after leaving, fading, gone; H's stop blending S's loop out,
not back while S stays active, again as S is entered again; a stop as you leave 0.3 s after; over the box's own Spin (at
full weight no turn, its own weight 0; after it its own Spin again on its clock); a timeline's hold showing its own Spin
alone, the layer back once let go; Pause holding the frame; a clip it lacks (nothing, its end logged as missing, the card's
amber line); the ghost while a cube plays a clip with Animation Off its outline only. Sounds (the real clock, the sound on):
a sound a cube names shown but silent; the tone's once from its start at its level at once, over at its end, again from its
start entered again; a long once (streamed) on after leaving; a loop in the stay cube replacing it, its element looping on
its run's clock (within 0.3 s), on after leaving; a stop fading it to 0 and stopping it; hidden 2 s into a run silent, shown
again back on its run's clock. Paths and motions (a shape on a 2 s path, an empty spinning, a shape wobbling, a voice
recorded with the path): waiting at its start; once 1 then 2 (its end logged), waiting at its end, the next run from 0; the
voice from each run's start (`'r<n>:0'`), silent past its 0.6 s; carried and paused at its placed pose; a loop off 0.3 s
after leaving finishing its pass (1.5 at 3.5 s, 2 at 4.1 s); a hold held at its end, going back (1.5 at 3.9 s, 0 at 5.5 s);
a stop mid-once where it is; a spin once (90° at 0.5 s, 180° at 1 s, at rest at 2.1 s), a loop finishing its turn (270° at
3.5 s, at rest at 4.1 s); a wobble at most 2° 50 ms in and 20° mid-run; an entry on the voice ignored, the card saying to
start the path. The state and `layout.json` carry `plays` and give them back; `norm`'s rules (each bad entry dropped, one
per item, what and moment, 16 at most, a clip on a stop dropped, how written as once, `when: 'enter'` dropped, `null` or `[]`
absent, a string or an object a bad cube); a layout's four bad entries counted (`playBad`), one naming an item it lacks or
of the wrong kind dropped, a cube whose `plays` is a string bad, the Scene pane's sentence. The page's card: one pick at a
time (Pick what it shows, Change a texture..., Start something...); *Start something...*, the shape from the list (its
path), *Another item...*, the box by a click in the scene (`pressItem`, its first animation), *Lift*, *Hold*, no When, the
sentence, *Add* (one Undo step); *Replace* in its place; a second entry on the sound; its row flashing the box in blue (no
Undo step); ✕ and Undo; *Try* (the box's Bob here, no Undo step; a tried loop off after 10 s, and pressed again at once:
*Stop*); the Items card *Cube · shows 0, hides 0, starts 2* and the box's *started by a cube*; editing off and a visitor:
no pick, no change, the button greyed. The headset's card: its rows, *Start something...* pressed, the trigger on the box,
*Bob*, *Loop* and *Add* pressed on the panel (Replace in its place), ✕. An entry taken away: its cube keeps no inside
(`trgList` drops the edge of a cube with no starts left), so a leave entry put back after you walked out fires nothing, and
a sound whose only entry goes ends its run there (`trgList` ends a sound's, path's or motion's run no cube names any
more). Deleting the box taking its entries out of both
cubes (one Undo step, Undo bringing them back), duplicating it adding entries for the copy beside its own, a cube's copy
keeping its entries, a group (the box and *S*) copied (the cube's copy on the box's copy, *W* gaining an entry); the
figure with an entry on its take converted to a GLB in the page and switched to it: its entry kept, its take played on its
GLB's model; and the lobby stopping every run at once (the box at rest, the sound stopped, logged) and a cube you stand in
firing again the next frame.

Its *studio edit speed* steps (v136; `--only 'studio edit speed'`, a minute) run on a page of their own at `&scene=test`
with editing on, what edit mode no longer does every frame ("Editing without the cost" under "The studio"): a hover (the
figure) and a selection (the box) held 60 frames drawn as a headset draws its labels (sprites, the scene rendered each
frame): no `texImage2D`, no `linkProgram`, the same sprites, pictures, shader programs and HTML, and the hover moved to the
sound made again once (one upload) and then held; `rayPick` making no world matrices (GL.world's `updateMatrixWorld` not
called) and still finding the box, `pagePick` once, a pretend headset's `xrPoint` none with `XR.pickStale` false and once
with it true; the panel's signature the same whatever item is pointed at; on the main panel, a tab pointed at: no
`texImage2D`, the texture's version and full draws unchanged, one `texSubImage2D` a rectangle (pixels sent the rectangles'
area, under 4 % of the card), one `generateMipmap`, nothing outside the rectangles changed and within them a full redraw's
pixels (a mean difference under 1), the GPU texture there the canvas's (read back through a framebuffer) and the menu's
Story tab drawing that texture; pointing off it a patch too, another pane a full redraw; an Items card's face pointed at
(a cube selected) drawing its whole background (taller than its face) again; the tags and lines drawn together (those
shown gathered, `LOOKS.BT.stats`, each on the layer no camera sees, the tags' draw an instance each, the figure's where its
sprite is and its size, its picture its own on the tags' canvas, the selected cube's edges in their colour in the depth-tested
lines' draw; ten more empties adding at most ten draws, their dots, where each was three); and the page's panes not built
while `GL.renderer.xr.isPresenting` (the HTML unchanged, `X.dirty` kept, `X.skipped` counting) and built once it is not.

Its *studio trackers* steps (v126; `--only 'studio trackers'`, about a minute) run on a page of their own at `&scene=test`,
a pretend studio station (`HOST.collab.live`) and its trackers given in the page (`HOST.collab.trackers` stubbed, so each
frame's poses are exact; the shell's stream is the shell lane's), with a shape, a sound following it and an empty put in
for them: the card's *Follows a tracker* (its list by name, else serial; pressed on the headset's card too); a tracker
chosen (one Undo step) leaving the shape where it stands (within 2 mm), then the tracker moved and turned and the shape on
it within 5 mm, its pose on it kept; the sound following it moving with it; a tracker gone from the list held, one not
`ok` at the pose the shell keeps; carried and paused at its placed pose; *Snap onto it* (right on it, one Undo step, Undo);
another station (none seen there) at its placed pose; *None* leaving it where the tracker had it (one Undo step, Undo);
locked, no new tracker; the empty's tracker chosen on the headset's card and an object's; `norm`'s rules (defaults, rounding,
bad ids, offsets and turns, a cube's and a sound's dropped), the state both ways (a bad `trk` from the room ignored) and
`layout.json` both ways; a copy and a group's copies on no tracker; a GLB switch's turn (the model where it was on its
tracker, within 1e-3); where the shell has its test hook `HOST.collab.trkIn`, a tracker fed through it as the relay sends
`@trk` and a shape following it within 5 mm (skipped, and said, where it has none); and the rig scene's dancer refused in
words (*Not a Mixamo rig...*, *Wear it* greyed), a box with no bones offering nothing.

Its *studio puppet* steps (v126; `--only 'studio puppet'`, under two minutes) run on two pages at `&scene=puppet`, the puppet
test scene's rig loaded a second time in the page by three.js's own GLTFLoader as the performer (its Walk the truth),
trackers worn on its bones with seeded random offsets (as `tools/studio/test-ik.mjs` has them; the mean of their offsets
along the floor made zero by the hips' or the headset's, so lining up puts the character right where the performer
stands), given as the shell's trackers (the Index's kinds too) or as `HOST.collab.body`, frames run at held times: *Wear
it* (whole body), the countdown on the card (Line up and Cancel pressed on the headset's card), then lined up from a
T-pose (the six parts found, the character moved to the performer within 3 mm and sized, one Undo step; Undo, again);
3.3 s of the walk with its hands and feet within 5 mm of the truth (0.06 mm), its clip off; Pause holding it; *Off* (on the
headset's card) giving its clip back, *On* again; a sound on its head bone following it; `norm`'s rules, the state and
`layout.json` both ways, a copy worn by nobody, locked not lined up; a second page with the first's record solving the same
23 bones at one held moment (within 1 degree and 1 mm: 0.0000 of both); a 3 s take (its countdown, 91 keys, *Stop*)
made into a GLB, downloaded (no relay), whose clips are *Walk* and *Take 1* (3 s, a track a bone and the hips' place),
*Take 1* at 1.5 s within 0.1 degrees of the bones solved then; and *feet and headset* with the PC's Index (lined up: the
feet and the Index's headset and controllers), then with a performer's own headset (`HOST.collab.body`): the feet within
5 mm and the hands within 1 cm (0.05 and 0.06 mm); a part given another tracker (swapping), not lined up until it is again.

Its *studio xp* steps (v137; `--only 'studio xp'`, under a minute) open the Bliss XP room read only from `examples/`
(`#studio&scenes=examples&scene=bliss-xp&edit`): every model of its listing placed once more and loaded with no console
error, each under 30,000 triangles and the room under 250,000 as placed, every picture at most 1,024 px, the clips its
layout names there; every sound decoded (mono, 22,050 Hz); and its layout read with no bad items, which passes only with
the studio's v137 contract (a studio without it reads the items with a wall behaviour as bad). After changing
`tools/studio/xp/`, run `node tools/studio/xp/make.mjs` and its `--check`.

After touching sound, also run `node tools/audio.mjs http://127.0.0.1:8123/`.
Headless Chromium plays sound without a tap, so the test imitates the strict
rule (an `AudioContext` starts locked and only a real tap unlocks it; an
`<audio>` element plays only once started inside a tap; its pages start as a
device that turned the sound on, `narrationMuted3` `'0'`, whose headset turned its narration on, `xrNarration` `'on'`,
with the headsets' welcome off) and checks a headset session's own sound (v124: on a fresh device a pretend session
unmuted with effects playing and its narration off, the story panel's button saying *Narration off*; that button turning
the narration on, playing, remembered across a reload and a new session; the page's own mute, *Sound off*, unchanged
after the session; the menu's Sound row the session's mute, `xrMuted`, its Narration row the session's, `xrNarration`,
and a controller's press on the story panel's button turning the narration off and on), the sound
off by default (a fresh device, also one with the sound on under the old key,
showing *Sound off*, a tap playing the story silently, no narration and no
effects, until Sound is pressed; a page without a recording (the design room) having the button
too; the choice kept across a reload, on and off; `#sound=on` and `#sound=off`),
that the narration plays after a click, after a story change with no tap (as in the
headset's Stories menu), through pause, jumps, the Sound button, the Stories
screen and a headset session going hidden and visible; that old saved mutes are
ignored, Play sound never mutes and the hum runs; Sound check's beeps and engine
choice; and that the `<audio>` element takes over when Web Audio cannot decode,
never starts, or its clock stops. For the sound effects (`HOST.sfx`): on by
default (a device that saved them off keeps them off); the bar's Sound button
silencing them with the narration, and bringing them back; turned off and on in
Sound check (with its volume kept, Try them) or by `#sfx=off` and `#sfx=on`;
nothing before a tap; a sound really going through the narration's one context
(the output's level); a page button's click; a background only for the flock and
the pass story (the library's, and the flock's heard, gone with the sound off and
on the Stories screen; none for the airports), and `vacuum` the only continuous
sound; ducked 9 dB under the narration and back; at most 16 voices; none with the
`<audio>` element engine or when Web Audio never starts; the two switches (the
Narration switch silencing the narration only, the story's clock running on, the
effects playing and nothing ducked; the Sound effects switch the effects only;
both from the Shared dialog's Sound row outside a room, kept across a reload and
shown so in Sound check, whose buttons turn them on again; `#voice=off`,
`#voice=on` and `#sfx=off` in a link); the headset menu's rows (Sound, Sound effects,
Narration, the effects' volume steps), and in a pretend headset the listener at the
head, a sound from a place through an HRTF panner, and a press on a story panel's
button clicking at it. The stories' sounds: a cue at its time (the log, the
engine, the output), none while paused or over a jump, the next one as the clock
passes it, the first again after Replay; a continuous sound while the clock is in
its span, gone after a pause and a jump out; an explore pick; the busiest moment
of the airports, the tour, the soil story and the robots within the voice limit
(nothing cut, at most 4 continuous). Whether sound really comes out of a headset
can only be confirmed on the device (use Sound check there), and how the effects
sound only by ear (the sound board, `tools/sfx.html`, and
`node tools/sfx-render.mjs` for files, `--story <key>` for a story's whole
track).

After changing a story's sound cues, run `node tools/sfx-cues.mjs
http://127.0.0.1:8123/ <key>` (seconds; `all` for every story and the design
room): every name a sound the shell knows, every place finite, every time within
the story, 6 to 60 cues (the tour up to 80; the flock, the robots and the design
room at least 1), at most 4 onsets in 3 s outside a marked sequence, no two of
one sound closer than its gap, at most 6 cue voices and 2 continuous sounds at
once; then render the story's track for the owner (`node tools/sfx-render.mjs
http://127.0.0.1:8123/ <out> --story <key>`) and report how it sounds as unheard.

After touching `HOST.live`, `HOST.swap`, `HOST.load`, `tools/release.mjs` or the
relay's `--watch`, run `node tools/live.mjs` (a few minutes; it copies the app to
a temporary folder and changes it there as a release or an editor would): a story
added live (its card without a reload), a changed story not on show fetched fresh,
the story on show swapped in place (explore state and view; at a slideshow stop
its mode, chapter, time and slideshow; a playing chapter only at its end), another
shell asked about first (the page's bar and the headset's panel, pointed at through
the shell's hooks) and the place restored after Reload now, `version.json` through
the service worker uncached; with the relay's `--watch --build`: a story file
touched swapping within about 2 s, a set's source touched building and swapping
its story, the list read again, a swap at a station writing nothing to the room, a
station of a story this device does not know, in a shared room (v136) a new `FORMAT` asked about with the bar's third
button *Reload every device* (its first press arming it), the countdown, *Not now* holding it off and then the page
taking it by itself, back in the room with its place, and a shell file reloading the page with its place.

After changing `sw.js` or how files are loaded, run the update test with an
earlier version checked out next to this one:
`git worktree add /tmp/old <earlier commit> && node tools/update.mjs /tmp/old .`
It installs the old version, serves this one like GitHub Pages (ten-minute
browser caching, ETags) and checks that the page and its stories are both new
on the first visit after the update, on the next visit and offline.

After touching `shared.js`, the relay or a story's shared-room hooks, run
`node relay/test.mjs` (the protocol: rooms, writes and their order, the epoch
rule, `fx`, timeouts, bad frames, static serving, `--logs`, the introduction
server at `/peerjs`, rooms on this network: `/api/near` by the asker's network, a private address by its /24, IPv6 by its
/64, `--proxy` and `X-Forwarded-For` ignored without it, `--proxy 2` taking the second address from the right (the first
when there is only one) and `--proxy` alone the last, an empty room still listed on its members' networks, `near`
off, and no address in any answer or log line, nor a network's id in the log; `--public` and each of its rules: origins
allowed and refused, no room list or names, unknown codes, sockets and new rooms capped per address (4429), the log
token, `--store`, and nothing of it without `--public`; the relay's password: off by default with `/api/health` open,
`COLLAB_TOKEN`, `--token` and in `RELAY_ARGS`, `COLLAB_PORT` and `COLLAB_HOST`, 401 for ping, near, rooms, a room, a new
room, log, watch, `/peerjs` and its ids without it or with a wrong one, `Authorization: Bearer` and `?token=` working, a
preflight allowing `Authorization`, the app's files open, the socket's `error` and close 4401 before anything of a room,
`/peerjs` with PeerJS's default key refused and with the password as key open, `/api/watch` with `?token=`, the
Dockerfile's health check (`/api/health`), 20 wrong ones from an address then 429, 4429 and PeerJS's `ERROR`, none at all
not counted, nor PeerJS's default key, nor unknown room codes asked with the password, and the password in no log line or file;
the studio's scenes (`--scenes`, seven steps, about 15 s more: `/api/ping` saying so and none without it, the list and
one scene by the listing rules, `tools/studio/scan.mjs` writing `index.json` and `files.json` as the API answers and
nothing when run again, files with their types, `ETag` and 304, `no-cache`, byte ranges and CORS, `..`, dot files,
backslashes, NUL and links out refused, a saved layout written whole with the old one in `.history/` (20 kept) and a
bad, too big or unknown one refused, the watch's `hello`, a file added, changed and removed once settled, a saved
layout and a new scene, nothing for `.history/` or temporary files, the password on every scene endpoint and file
(Bearer or `?token=`, wrong ones counted, never in a log line) and `--public` refusing to start without one,
`COLLAB_SCENES`, `RELAY_ARGS` and the options refused at the start) and its uploads (five steps: `GET /api/scenes`
saying `upload`, `ffmpeg` and `maxUpload`, a scene made by `POST /api/scenes` (the name rule, 409, `--scenes-readonly`)
and told at once, a file written whole where it goes with its folders, 409 unless `replace=1`, the paths and kinds
taken and refused, the size counted as it streams and nothing left behind; the sound endpoint with a stand-in `ffmpeg`
(one generated script under the names ok, fail, empty, hang and broken: its failures, its time limit, two at once, none
at all) and, when the machine has one, a real `ffmpeg` making a generated stereo 48 kHz WAV a mono 96 kbit/s 44.1 kHz
MP3 (its frames read), else skipped with a note; `/upload`'s redirects, to the relay's own app or `--app` with its
`wss://` address, no password asked and the query never passed on), copies from another scene (v118, `POST .../copy`: the
same bytes at the same path or `as`, told at once, 409 then `replace`, an upload's kinds by where it goes, sources no
listing shows, bad bodies and the file onto itself 400, missing scenes and files 404, a link out 404, over
`--max-upload` 413, `--scenes-readonly` 403, the password), the models' pictures (v120, `previews:`: `previews/<path>.jpg`
taken, listed and told with the kind `preview`, served as a JPEG, any other kind or name there, too deep and `Previews/` in another case 400, exactly
200 KB taken and past it 413 by its length and as it streams, nothing left behind, copies by the same rule), recordings kept
as files (v125, `recordings:`: `recordings/<name>.json` taken, listed and told with the kind `recording`, served as
`application/json`, a sound there by its own kind, a `.json` anywhere else, `.JSON`, too deep or a temporary name 400,
`uploadPath`'s 4 MB, past `--max-upload` 413 by its length and as it streams, copies by the same rule; and with R2 through
the relay and straight into the bucket, stored and signed as `application/json`), and the scenes in R2 (thirteen steps against the stand-in
S3 `relay/s3fake.mjs`, which checks every signature: `relay/test-r2.mjs` first (the signer against AWS's published
Signature Version 4 examples, byte for byte, and the client), then the folder's steps again with `--scenes r2` (the
start and its CORS check, the listing with a signed link per file, the redirect, saving with `.history/`, the watch from
the relay's writes and from changes made straight in the bucket, uploads through the relay), direct uploads (`.../put`,
a body of another size or type refused, `.../done`), copies by the bucket's CopyObject (its `x-amz-copy-source` signed in
the header, which `relay/test-r2.mjs` and the stand-in check: one unsigned refused), the models' pictures (through the
relay and straight into the bucket, `.../put` refusing one over 200 KB, `done` leaving one over it that no link of the
relay's brought, a copy by the same rule, all told as `preview`), `ffmpeg` with `from=`, the password everywhere and in no link, the
start refusing missing settings (named, never a value), a wrong key or bucket and an address that is no one's,
`--r2-check`, the start's upload-link check against the stand-in told (`quirks`) to refuse a signed length, both, or to
ignore `If-None-Match`, `.../done` removing past `--max-upload` only what its own link brought, a save the bucket
refuses costing no history, three uploads through the relay at once, a 5xx or nothing at the bucket's address at the
start (listening anyway, found later), and `tools/studio/r2sync.mjs` with its conflicts and `.history/` copies), and the
PC's Vive trackers (v126, `--trackers` with the fake bridge `tools/trackers/fake.mjs`; `node relay/test.mjs --trackers`
runs only these, in seconds: nothing of it without `--trackers`; the UDP intake, `/api/ping`, `GET /api/trackers` raw
within 0.1 mm; `/api/trackers/still` (still, moved, not seen, nudged, lost; bad asks); since v131 the frame from an area's
crosses (`m.k`, `ra`, `rb`) against the room's truth and `shared.js`'s own `fitFrame` (200 random rooms and areas, within
1e-6 m); the room's frame from `m` against
`shared.js`'s own `fromMarks`, `floorUnder` and `basis` run with three.js; a room lined up by hand getting `@trk` about 60
times a second, every pose within 1 mm and 0.05 degrees of the truth; only rooms with `trk.on` and `m`, `l: ''` without;
the bridge silent; bad datagrams counted; the password; `RELAY_ARGS`; a UDP port held; `bridge.py --fake` where
`python3` is), and rooms across updates (v136; `node relay/test.mjs --rooms` runs only these, seconds: `/api/ping`'s
`versions` and `reload`, a room of networks-41 refusing networks-42 while one of its own is connected and taking it once
none is (one that has said no hello not counted), never an older one, versions that are not networks-<n> only the same,
a taken code's 409 naming its version; the reload order: 404, 400, 405, 200 with every member of every version getting
`q.reload` by the relay, 429 within 10 s, the newcomer it names (half a second after the order) moving the room on with
two old members there, who get the order again: one that ignores orders refused 3 s later, one whose hello says
`reload: 1` not within 9 s of its order and refused about 12 s after it; `--keep`: written within 6 s of a change, atomically, and as the relay stops,
read back with its seq, version and keys, another relay's write taken, expired rooms and bad keys left out, a bad file
kept aside as `.bad`, nothing without it; and the order needing the password); no browser, seconds; `node tools/peer.mjs` links two pages of
the test page `p2p/` through it) and
`node tools/collab.mjs` (about a quarter of an hour; it starts its own relay with
`--static .`, so no server is needed). For every story in its `STORIES` table,
three pages in a room follow its station and check play, pause, jumps, mode
changes and Replay (within 5 s), the relay's clock, the explore state both
ways and the story's effect (for the robots also the pile's spot and dust, and the
crumbs' patter on the others; for the flock the same falcon, one page leading, the
same flight time and the flocks together, its dive and flutter on the others, two
falcons sent at once from two pages flying on the third, and the birds shared bird by
bird: every page records its birds as drawn in each frame for 10 s (the pages made
small meanwhile, so each draws a few frames a second), and a follower's birds, once it
has followed the leader for 3 s on end, are within 0.5 m of the leader's at the same
moment (the median over its frames; too few such frames are said so, not judged); for
the pass story two pages being the shark, both their sharks swimming on the third in
their owners' colours and swimming off once let go, and the school shared fish by fish
the same way, with the two sharks in it);
on the first story followed, also its sound cues (every page playing the same cues at
the same moment, each every cue its own frames reach, none twice: a cue more than 1.5 s
late is dropped by design, and three pages drawing in software can draw a frame only
every few seconds; a pause on one stopping them on all, a page joining mid-play playing
none it missed, none past a slideshow stop), a slideshow stop on one page pausing the
station for the others at the chapter's end, and its Next playing it again.
Before that: Arrange all's rows, a code with no room, Remove asking first.
After: a station moved and turned on the room map (and refused while the
circles are locked), a room joined by its code from a pretend headset's menu (`codeRound`; `--code` runs only it, a
minute: *Join with a code*, the keypad, Join greyed until three letters, a fourth refused, Delete; in the room *Another
room*, its own code greyed, a code with no room saying so), the room's arc and the All stories and lobby circles (`allRound`, after
the code round in the main run; `--all` runs only it, rooms of its own, several minutes; its devices with `arc: true`, the
others in the run starting with the automatic circles off: a page on a story starting a room making the arc at the room's
origin (its only station, `allp` with `pg`) and showing its Stories screen without Follow, as a page joining does; a
pretend headset (`autoAll: true` in its `installXR`) moving it to where it stands, facing its way (`allp` its own),
and at it without walking in, at its spot: the Stories screen (its cards, no Back), the scene hidden, no ring,
card or icon for it, the rig at its spot, its presence there, nothing written to its keys; a landing card pressed picking
that story for everyone, from its start and playing on the headset and both pages; the story panel's Stories button back
to the cards, the keys gone; the grip on its cards carrying it for everyone (held writes seen on a page, then where it
was let go, swung round, still the arc); the room map moving it and the headset's cards gliding there; the circles lock
refusing the grip, with its notice; Move here putting it at the headset; Add from the headset turning it into a circle
where it stands (`arc` false), the headset still at it with its cards and now its ring (it stands 1.5 m off), the pages
still following; the dialog's Add listing All stories and Back to the lobby after the design room; then as any All stories
circle: the menu's switch row turning sync on, and with a circle of that story in the room the headset joining its
session: explore state and clock both ways with a page following that circle, its presence still the All stories
circle's; the dialog's toggle turning it off, its own keys seeded (the clock, state and the linked circle's moved scene)
and the story going on; on again and the linked circle given another story, the circle going on alone where its story
was (its own clock written); the dialog's picker back to the cards; the lobby added from the page, listed without Follow,
walking in ending the headset's story with every ring, icon and card showing, then a story circle entered as usual, then
the circle that was the arc walked into again (its cards); Arrange all leaving both kinds where they are; an arc again
turned into a circle by Arrange all and by adding the lobby, and left a circle once every other circle is gone; removed,
it not coming back; the headset first in a room of its own making the arc in front of itself, at it at once; a room from
before v109 (`all01` without `arc`, alone, written by a raw socket) the arc once a page joins; with `--shots` its
pictures: `all-1-arc.png`, the arc's cards as the first headset sees them, `all-2-picked.png`, a story picked there,
`all-3-lobby.png`, the All stories circle seen from the lobby, and `all-4-circle.png`, the arc turned into a circle, its
ring under its cards), the room setup guide (`guideRound`, after the All stories
round in the main run; `--guide` runs only it, a room of its own, about six minutes: a page starts the room with a
station far off; the first pretend headset enters AR alone and its startup flow opens by itself at *Line up* as the
room's first with no spots (*Put two tape crosses on the floor*), *Skip for now* closing it and the menu it opened; it becomes the
room's origin, *Room ready*; the second lines up through the shared space and its flow opens at *Line up* (no spots
yet: *Check with someone*), the first's staying shut, both counting 2 of 2 lined up, none checked; the pages: Back
greyed on the first, Next, Back, *Skip for now*, *Room setup* opening it again where it was (with Close), *Check here*
there and in the Debug tab; the laptop's *Setting up a room* listing both, *not checked yet*; Touch the spot with the
tips 3 cm apart, the first waiting, then green on both, the flow done, and *checked 3 cm* in the laptop's list; 40 cm
apart, red on both, *Not lined up?* opened by itself on both, the laptop's list saying so; Re-align taking the red
result away and a check alone timing out (the window shortened to 14 s); the second back with no shared space: its flow
again (every session), skipped, *Not lined up?* by itself once late (shortened), saying why; back again lined up, the
flow again, skipped. Then the spots (tape crosses on the floor: every touch at the true floor plus `FLOOR_TIP`, `TIP`
in the test): the first headset (the room's origin) calibrates on two from *Line up* (case
*first*, the red check's reason above), which writes `rm` (`{ a: FLOOR_TIP, f: 1 }`) and a frame from the spots for the space, and the guide goes on
to *Check* by itself; *Check at A* 3 cm off spot A: green, the flow done, the guide closed; the second, taking that frame
through the shared space, asked by eye (v119: the orange crosses on the two spots within 2 cm, drawn over everything, the
question 0.75 to 1 m in front, on top and the ray's first target, the guide shut; v130: both crosses lit and larger, the
foot of each beam and its letter over its cross within 2 cm, the beam 1.2 m tall, over everything, an arrow to each
under the question, within 0.35 m of it, pointing at its cross within 5 degrees of the line from where the arrow floats,
its words its letter and its distance along the floor from the head, *A 1.3 m*; the head turned round, spot A behind
it: a U-turn to the left and *, behind you*), *Yes* standing as a check (by eye, the flow done, the laptop's list
*checked by eye*; the crosses as they were, no beam, letter or arrow); after a wake (hidden, then visible) asked again (why *wake*), *Yes*;
after a floor reset asked again (why *reset*), *No* opening *Line up* (case *room*, why in red, not lined up: the
laptop's list *not lined up (its crosses off the spots, by eye)*), skipped; entering again the startup flow asks by eye
(flow *eye*, why *start*, the guide shut) instead of opening at *Check*; *No*, *Next*, *Check at A* 3 cm off:
green, the guide and its menu closed, the laptop's list *checked 3 cm at spot A*; 40 cm off: red, back to *Line up*
(case *room*, why); Calibrate there on the spots, on to *Check* by itself, *Check at B* 2 cm off: green (the room's `rm`
still the first's); the laptop's list *lined up (the room's spots, checked ... at spot ...)* for both, 2 checked. Then
floor spots (v122, `floorSpots`): the first headset back in a new session with its own floor 20 cm too high and a room
scan whose floor plane is the true floor, its spots found again by their anchors: the room's floor on the true floor
within 1 cm and *Your floor is 20 cm higher*; calibrating on them again, spot B 5 cm higher refused (*Spots at different
heights*, back to spot A), then both on the floor taken (B 3 cm higher than A): the room's floor on the true floor
within 1 cm, `rm` `{ a: FLOOR_TIP, f: 1 }` its own, and the log's `mark refused` (heights with `dh` 5 cm) and `floor
spots` (touch heights -18 and -15 cm over its floor, `dh` 3 cm, 2 and 5 cm over the scan's floor); back again with its
own floor 90 cm too low (the owner's Quest), calibrating on them again: spot A, 92 cm over its floor, taken, nothing
refused, the room's floor on the true floor within 1 cm, *Your floor is 90 cm lower*, the log's touch height 92 cm; the
second back with its own
floor 15 cm too low, its spots found again (the true floor within 1 cm), then
calibrated on again: its room's origin and direction within 1 cm of the first's, *Your floor is 15 cm lower*, nothing
written to `rm` (no `floor claimed`, `rm` unchanged); Forget, lined up through the shared space (its own floor kept),
*Check at A* with the tip on spot A: *15 cm out at spot A (15 cm in height)*; a calibration from before v122 (no `f`,
two table corners 1.2 m apart, set as its calibration with anchors at the corners, no room's place yet) found again: its own floor (the
room's floor is other spots), *f* absent, nothing written to `rm`; an older device's `rm` for those corners (`a` 0.76,
no `f`): the room stands on it, on the true floor within 1 cm. With
`--shots` its pictures, `guide-*.png`: each page and case of the menu's canvas, waiting, green, red, alone, no shared
space, calibrating, the question by eye (`guide-16-eye-question.png`, its sheet; v130: the scene from the head with the
arrows and a lit cross, `guide-16b-eye-arrows.png`, and turned round, `guide-16c-eye-behind.png`), *No* to it (`guide-17-eye-no.png`),
calibrating with its floor 90 cm too low (`guide-20-floor-far-off.png`), and the laptop's section), places (`placesRound`,
v130, after the guide round in the main run; `--places` runs only it, rooms of their own, eight or nine minutes: two pages each
start a room, X and Y, and a pretend AR headset with saved anchors, a handle taken out of the map standing for an anchor
not in that room: calibrated in X and, joined by hand, in Y, on spots 13 m apart, two places with their anchors and X's
stored in `roomFrames` with the room's own id; standing in Y while in Y, Y here and nothing offered; in Y joined by hand,
standing in X's place, Y not left, X offered (a notice, *Join X* and each place's *Forget* under Debug, no *Anchors per
room* since v131); out of the room (not on purpose), a new session in no room standing in Y with X's handles hidden and the floor
moved: Y joined by itself (its notice) and lined up from its marks within 1 cm and 0.5 degrees; with a place QPA
planted 6 m from where it stands (one anchor, found at once): a new session in Y, Y's own anchors answering after 5 s,
the decision waiting for them (`place wait`) and Y, nearest, holding (nothing joined or offered); woken with Y's
anchors lost (it lined the headset up as it went off), carried to 1.5 m from QPA's spot A: Y holding (`place held`,
`lost`), QPA offered; a new session with Y's anchors not found at all, 6 m from QPA's spot A: Y holding (`gone`, further
than 4 m), QPA offered; walking into X with Y's
anchors gone (their handles, the ones held untracked): X joined by itself from Y, lined up, Y not marked left; X left on
purpose only offered, the offer's button joining it (counted as by its place since v131); a new session's tidy deleting a stranger and keeping every
place's anchors; Forget Y (two presses) keeping X, which still lines the headset up; three more places planted (two
anchors each, used days ago, no `yb`) and Y calibrated anew: the one made first dropped with its anchors (its `yb` not
known, so not taken down to one), *Older places dropped*; the budget (v131): Y's place and three planted after it with
two anchors and `yb`, X calibrated anew (a fifth place, 10 anchors): Y's and the first planted down to anchor A alone, B's
anchors deleted, 8 in all, *Older places on one anchor*; with Anchor on (7) X anew again takes the next one down; Y's
place on one anchor found again in a new session on another floor within 1 cm and 0.5 degrees (*held by one anchor*);
its turn read with a wobble of up to 0.6 degrees at each reading (`installXR`'s `X.jit`): for 5 s the room's
direction within 0.3 degrees and moved at most once; local-floor turned 10 degrees without a reset event: the room's
first move the whole turn, none creeping after, lined up within 1 cm and 0.5 degrees; seven one-anchor places planted
and Y's: eight fitting, then a ninth (X, two anchors) dropping the two used least recently; an older `roomFrame` (v2, no room)
kept as a place with no room and taken by Y, the first room it lines up in), areas (`areasRound`, v131, after the places
round in the main run; `--areas` runs only it, a room of its own, a few minutes: a page starts the room, two pretend AR
headsets with saved anchors; headset 1 calibrates on spots A and B, walks 12 m to a floor 15 cm higher and adds Lab
there, `rp.<id>` with letters C and D and its crosses within 1 cm of the truth, its base spots A and B's, its own place
there with `yb`; headset 2, its floor 3 cm high and turned otherwise, calibrates on C and D only: its room within 1 cm
and 0.5 degrees of the truth and of headset 1's, the room's floor under it, the same room, nothing joined, its crosses
at Lab's points lettered C and D with the sign *Lab: C and D*; C and D touched 50 cm short refused in words; a new
session of headset 1 at Lab, spots A and B's anchors hidden: lined up from its Lab place, no join, the check by eye's
crosses C and D and arrows *C ... m*; walking back to spots A and B: `area switch`, the truth, the check by eye asks why
`area`, its crosses A and B; a v3 place without `yb` read as spots A and B's and learning it, kept as v4; a frame from
Lab's marks through the shared space never compared or split, one from spots A and B's compared; *Forget area* (two
presses on the Debug tab): its tombstone, headset 2's Lab place and anchors gone at its next session; another area,
Hall, C and D again, stale once spots A and B are taped again and its place dropped at the next session; a socket of
networks-40 refused), camera mode on an area's crosses (in the camera round: the overlay's *Spots: C and D (Lab)*, Set
spot C and D, the phone's room still the headset's, no place kept; and Update the room not offered in camera mode), rooms
across updates and Update the room (`reloadRound`, v136, after the areas round in the main run; `--reload` runs only it, a
few minutes, `--cases 2,5` only those of its six: a relay of its own on port 8712, restarted serving another copy of the app as a deploy; three copies made in a
temporary folder by `tools/release.mjs`: this code at its `FORMAT`, this code at `FORMAT` + 1, and v135 (git `7c32b37`) at
`FORMAT`; service workers blocked, every page on a story (the Stories screen takes a waiting update by itself) with
`liveCountdown` off: (1) a deploy bumping the format with two old pages in a room, which make it again under the old one;
a new page joining waits (`older`), one old page reloaded by hand waits too, and once the last has reloaded all three are
in the same room with its stations and explore state, the room on the new format; (2) the switch for the same version:
three pages and a pretend AR headset lined up and at a station, the first press arming it, the headset's notice, every
device reloading once in its turn (ranks 0, 1, 2 and the presser 3; waits 0.4, 0.9, at least 3 s for the headset, 1.9 s),
all back with new ids, the page that followed the station following it again at its paused clock, the headset showing
*Enter AR to continue* and, entered, at its station without walking in; (3) across the format: a new page refused by the
old room offering *Update the room* and pressing it, the endpoint reaching the old pages (this code), everyone back new and
the room moved on; then v135 pages, which ignore the order, refused once the new page is back, and new after a reload by
hand; (4) the relay restarted between press and reloads: the presser bringing the room back first; (5) peer to peer, the
order from a guest, everyone back on the new id, one host, every station; (6) a v135 page in a room with a page of this
code ignoring the order, an order older than 2 minutes ignored, two presses at once giving one order and one reload per
device, and a reload that comes back with a stale `index.html` (`page.route`) reloading twice more and then saying so),
the design room (the Shared dialog's picker listing it after
the stories, its station added there for every page, refused while locked from
Add and the Design room button, left where it is by Arrange all, the button
moving the room's one to your feet rather than adding a second), the headsets' four settings and the two sound switches
as the room's (labels on top, cards in 3D, no subtitles, sound effects and narration on for pages that have them on, in a room without them; set on one
page (the labels from one, the cards from another, each leaving the other), or in another's Shared dialog (both pickers)
with the circles locked, for every page; free moving off taking the turns
out of the stations' places and panels; kept across the relay restart and, in a
room on this device, across a reload), a station's panels set in a page's
Shared dialog with the circles locked (reaching the pages at that station,
another station keeping its own; kept across the relay restart), and its
story's lock there (*Lock story*, also with the circles locked; every page has
it, another station not; kept across the relay restart),
two controls changed at once on two pages (both kept), two stations
followed back to back (the second not lost), a story picked by hand (stops
following), no writes while idle (no ping-pong), a late joiner, a page following a
pretend person in a headset (a socket of its own speaking as a headset's page:
the people list's Follow for them and none for a screen or for you; not at a
station yet, the dialog open and saying so; the station they walk into, then the
next, the line "Following Guide (at <story>)"; out of every circle and their
presence quiet, the last one kept; a station followed by hand, Stop following in
their row and a story picked by hand each stopping it; they leave, it stops after
15 s and the page stays at their last station), a relay restart, and
a pretend headset with fake `local-floor` and `shared` spaces: alignment,
away from every station no story (no Stories screen, the scene and panels
hidden, nothing to point at, paused, no Stories button),
before any circle every station's icon over its ring (its story's miniature, in
its colour, turning) and its card, placement at its station once it walks into
its circle (the story shown; the other stations' icons only, pointable, no card and no
ring further than 2 m off, of its own nothing), a recentre, taken off and on again (it stays in its story),
a Stories screen opened at a station closing at once (restarting nothing),
walking out of the circle into no other (still its station and shown, playing
on the station's clock, the others still icons only, the walk writing nothing;
in step both ways out there: a change on a page following the station taken, a
pause on the headset reaching the room; taken off and on again out there,
still in its story) and back in (nothing happens: no second arrival), the hold
and the lock, a station's panels set on a page reaching the headset at its
circle (controls only: the foot bar alone; the station it is not at keeping its
own) and set from its menu's Panels row for everyone there with the story
locked (hidden), its own station's back again (shown) when it walks there, the
design room in the headset (every station's icon built from its story's
miniature, in its colour, hidden in a circle; the menu's Design room button
greyed while the circles are locked; Add here listing the design room after the
stories; the button putting the props table at its feet facing its way for
every page; standing in it, its station, the design room open there at its
table in explore mode, its icon and card gone; walked out, still at the design
room, its icon still gone and built from the table's miniature),
the station's clock and state, rays and head in room coordinates, another
person at its circle drawn (one at another circle or at none not; all with
People: everyone), the sound zone, the trigger on
another station's card running nothing (its icon pointed at first, bringing
the card up; a notice: walk into its circle), the story panel winning over a
card behind it, a station moved with the grip on its card (its icon pointed at
first; swung, pushed further, turned; the others see it while it moves) and
gliding into place when someone else moves it, the circles lock (the grip and
Arrange all refused; unlocked from the headset's menu), the menu (closed at
first with nothing at the wrist, and a notice saying how to open it;
opened and closed by a click of the left stick or the right (each read 0.5 s after its click: since v125 a single click
acts once 0.4 s have passed with no second one), floating in front of you (0.8 m ahead, a little below
your eyes, turned to you; Close and its four tabs at its top); the grip carrying it, let go staying where it was put
(also with the head turned away) and opening there again next time; its Story tab showing the story's own panels
(their textures), a press there working the story's panel (Replay story, Explore now) and the grip there moving the
menu, not the story's panel; closing by itself unused (not with a
ray resting on it, not while calibrating); staying put as you look about a little and gliding back in front once you
have turned further; with tracked hands two quick pinches of the left hand pointing at nothing opening and closing it
(not one pinch, not two slow ones, not the right hand's, not the left's on the story's panel or the menu); Exit under Settings; buttons
pressed by a fingertip, a poke and a pinch at once pressing once; at its tallest, You still on it; Sound check under
Debug: both beeps, the engine choice, Back), re-alignment, walking to another station
and back, Remove asking first; calibration from two marks (Stop calibrating
still pressable, two anchors made and checked, the marks drawn), a reset with
a transform, a recentre without a reset (the anchors keep the frame), the
anchors found next session, Forget calibration (two presses; also while those
anchors are still being found), a new calibration replacing the old anchors,
the shared space never overriding marks (a newer frame from someone else only
reported, as a distance; not used at all by default), a space found split by two
calibrated headsets (the room told, whole again once they agree; a headset
without marks takes nothing through it), no room scan said and taken back, a fresh shared space (two presses move the
room's pages to `s/1/`, where they join again; a headset there told to start
one headset first; a page opened at the old address moved too; that room has
no stations: entered from the start screen, the headset shows no Stories
screen and no story, only the menu, opened by itself with Arrange all;
leaving the room brings the Stories screen back, joining one closes it), anchors not
found by their handles after waking and found by a later try (meanwhile, since
v124, no message: still lined up, the Debug line says it looks again; a jump with
their handles saved keeps the calibration), the room's floor from
floor spots (v122: the marks touched at the true floor plus `FLOOR_TIP`; `rm` `{ a: FLOOR_TIP, d, f: 1 }` this
headset's own; an older device's `rm` for them, a higher `a` and no `f`, moving nothing here, and this headset writing
the room's floor spots again; the log's `floor spots`), no mark from a double
pull, Forget taking the published frame, the shared space on by default
(off: calibrate), a space that is just this headset's own floor while someone
here published (not joined: nothing taken), a headset back in AR whose space
is its own floor while another here is aligned through that id (its own
earlier frame not taken, also with the space drifting 6 cm), the first headset
in a space staying first with another aligned through it (Re-align, an id
flicking away and back), a frame from someone who has left
(waited for, then replaced by the first headset's own space), the first
headset taking a frame someone here publishes later, standby with the shared space in use
(a wrong space held off, then the room where it was and at the same height
though the floor moved), a reset as Quest Browser
sends it (old to new coordinates, the head's height ignored), a calibration
without anchors asked again after a reset without a transform or a jump, and
kept (moved by the reset) off and on again, off and on again with the anchors
not tracked (the frame follows the reset at once, then the anchors found
again by their handles), unknown saved anchors deleted at session start, a
full anchor store (cleaned and asked again; still full: the marks hold and the
panel says so), the mark taken where the
controller was held still, VR elsewhere with its in-room question (then the menu's
Settings tab: Sound turning the mute off and on, Anchor turning off and greyed while off in
a room, Repeat going off, all, one); in a
room no Stories button (at a station either) and a Stories screen closing by itself, the grip on
the scene and the panel unlocked there (not locked by the circles lock; locked by
its story's lock, set on a page), both grips
resizing the scene and one hand carrying on, the place, size and panel going
out to the room and gliding in from it, Recenter there (the menu's and the story's own: the place and panel keys out
of the room, the scene and panel gliding back where the story puts them; refused while its story is locked, with a
notice and the menu's Recenter greyed; in explore mode the view back where the story put it, not where the room had
turned it, for everyone there), a free grip turning the scene 90 degrees
and tilting the panel (the turns in the room, the other pages holding the same
`q`), Moving in the headset's menu turning free moving off for everyone (the
turns gone, the scene facing you again, the panel upright), Labels going
round there for every page (the cards staying in 3D) and Cards going round
there for every page (the labels staying on top; the other stations' cards, as
if their rings had been pointed at, and the name tag of a person at its circle
on top as before, drawn as the labels' signs in 3D, not drawn when hidden; the
menu on top in every mode); Re-align
(an offset headset back on the room's frame, the shared space asked for again),
and after a night: a headset still outside the space asking for it again, a
follower holding against a space made again and following the room's frame
once written again, this headset's own frame written into a space made again;
a room on this device (no relay known and `&peer=off`: a link opens it, the link's sound switches turned off on the
device staying off there while the room never wrote them (subtitles written leaving them out), Arrange all, a moved
station, the circles lock and the headsets' settings kept across a reload, a headset alone on its floor with
Re-align, a station played there, the room taken to a relay that answers and
joined there by another page; a relay that cannot be reached); then peer to peer
(pages whose `/api` goes nowhere, as on GitHub Pages, introduced by the test
relay's own `/peerjs` through `&peer=`, so nothing goes to the internet): a page
starts a room and hosts it, its link carrying the introduction server; two more
join by the link as guests (the host marked in every list, the Shared dialog saying
*peer to peer · hosted here* or *hosted by*, with Copy link); Arrange all and a
station moved on a guest; presence; play, pause from a guest and a jump at a
station within 5 s; an explore state both ways; the host leaves and the page
longest in the room takes it over, its stations and keys kept and the station's
clock without a jump (the new host's own clock 3 s off); the room goes on; the
old host back as a guest; a host fallen silent with its id held, replaced once
its id is free (after the 6 s); an introduction server that cannot be reached
(the room on this device); a relay that cannot be reached as a room is joined
(peer to peer); a headset (by its user agent) that hosts handing the room to the
first screen that joins. `--p2p` runs only that part (about two minutes). Then rooms on this network (`--near` runs
only that part, about five minutes; its own relay with `--proxy`, and in front of it one small proxy per pretend
network that puts that network's address in `X-Forwarded-For`, as Coolify's does; peer to peer, `#net=home` and
`#net=away` with the relay's `/peerjs`): with a relay, the page's network id the same as its own hash of the address;
two pages on one network see each other's room (the first member's name, people) in the dialog and one press joins,
a page on another network does not (only among the open rooms); a page never in the room is never joined by itself;
*Show on this network* off and on; the headset's menu listing it under *On this network*, one press joining; a page
that was in the room joining it again by itself when the app opens again (the notice, which its close button takes off the page); a day later (the page's clock
moved on, its storage kept) with the relay having forgotten the room, joined again and the room back from its copy;
Leave on purpose, then nothing by itself; more than a week later, nothing; a code the relay gave to another room
meanwhile (another `rid`), never joined, nothing of it kept; a copy kept without the room's `rid`, never joined by
itself, only offered. Peer to peer: the host holding a slot, a page on its
network seeing the room (hosted by) and joining with one press, a page on another not; *Show on this network* off
(the slot let go) and on; a page that was in the room rejoining its host by itself; a day later with nobody holding
it, the first page back hosting it from its copy and the next linking to it; on another network nothing by itself,
*Start room XYZ again* hosting it with one press; Leave on purpose, nothing by itself; the relay's log naming none of
the pretend addresses. `--quick` runs only the last story in the per-story part. `--standby` runs only the pretend
headset's standby with the shared space in use (`standbyRound`, a room of its own set up as the main run's pretend headset
finds it, a minute or two, running the main run's own steps, `standbySteps`): the shared space at the head and as this
headset's own floor, standby with the floor 15 cm lower and a wrong space held off, the room back where it was and at the
same height once the space agrees, read once the room has looked at the space again (up to 8 s of frames; the fixed
800 ms read before missed that look whenever one of a software-drawn page's 1 to 4 s frames fell there, as in every
main run of v119 and v120), and woken again on the first floor. `--narration` runs only the narration in headsets and
the welcome (`narrationRound`, also in the main run after your menu shown to your circle; a room of its own with a story
circle and the lobby, a page and two pretend headsets lined up through the shared space, a few minutes): the narration
off by default in a session (the session's mute off, the panel's button *Narration off*; the page's own on, its mute on);
the page's Shared dialog's Narration pressed twice (Off for all, then On for all, `look`'s `vg` 1 and 2) reaching both
headsets; one headset's own Off from its menu an override (`xrNarrRoom` `{ code, vg, on }`), the other staying on,
`look` unchanged and nothing written by it; the other's story panel button the same; Off for all and On for all from a
headset's menu (Circles) dropping both overrides (`vg` 3 and 4); an override kept through a new session (between
sessions the page follows the room's); walking into Back to the lobby dropping it (the log's `narration own dropped`,
`lobby`); no `look` ever written by the headset with its own; leaving the room dropping it. The welcome: not before
lining up (3.5 s with no shared space id), then once, asked first (the trigger's words and the controllers' buttons, in
front, not pointable, no notice *The menu*); the menu opening closing it, not again that session; walked into, the walk's
words; not while the room setup guide shows, then once it is closed; tracked hands, the pinch's words and no grip;
outside a room 2.5 s in, never while a stub of `HOST.collab.cameraMode` says camera mode. `--walk` runs only moving with the
sticks for a VR headset elsewhere in a room (`walkRound`, v128, also in the main run after the narration round; a room of
its own with an airports circle 3 m ahead of where the headset joins and Back to the lobby 3.5 m beyond it, a page and a
pretend VR headset that answers *Somewhere else*, a minute or two; `installXR`'s `walk: true` gives its local space offset
spaces and two controllers with sticks, `X.stick(hand, x, y)`, and its frames go through the session's own
`requestAnimationFrame`, so the shell's hook moves three.js's space as on a headset): `walkWhy` `''` with no travel yet and
its own floor; two stick clicks turning it on, the notice saying *The others see you move*, the menu's row pressable; the
left stick moving it (`HOST.xr.travel()`) and its head in the room by as far towards -z, the page hearing its presence's
head move by the same within 5 cm once at rest (`HOST.collab.body`); the room's frame and the lobby's icon in three.js's
space unchanged, no `origin moved` in the log and no notice to calibrate; a flick turning it 30 degrees (its heading in
the room, and in its presence on the page within 3 degrees), back again, no jump; with the circles walked into the
sticks taking it into the airports circle (its live station, its presence's `st` on the page); with the circles asked
first on into Back to the lobby (its station ended); a recentre (local and local-floor moved by one transform, the reset
as Quest Browser sends it) leaving it where it was in the room within 1 cm; a second pretend headset in AR getting no
travel from its sticks (`walkWhy` `'ar'`); the first answering *In this room* back to no travel, its sticks moving
nothing, two clicks saying *Not while you are in the room with the others*, the row greyed. `--ships` runs only the
spaceships in a shared room (`shipsRound`, v132, also in the main run after the walk round; a room of its own with two
story circles, a page and two pretend AR headsets lined up through the shared space, with controllers (`installXR`'s
`walk`), each at its own circle, a few minutes): A launches by its right stick clicked twice; B, at the other circle, draws
A's ship where A had it at the relay time it draws (against A's own track, `debug.track`: the median within 3 cm); A
leads 2 drones and 3 targets (frozen, `debug.freeze`: still, holding fire, their shields not refilling), which B draws where A has them; B launches, a third drone, the set
kept, A still leading; A and B each hit the same drone, A deciding (its shield 10 after A's bolt, then 0 and its health
50 after B's, on both devices), and B's last bolt destroying it, credited to B on A, B and the page (its people list); B
whose frames pause 2.6 s while A flies on keeping A the leader on its first frame back; B missing A's presence (its quiet
time made 0) and taking itself for the leader: a pickup A gives away meanwhile gone from
B's own copy, and its bolt on a drone said by B and A taking no frames until B's word has come: the drone's shield 30 to
10 on A all the same, and once B hears A again A leads on both (v135); a pickup B flies through given to B by A (B's rapid fire on, gone for everyone), and one claimed by both at once given to
one only; A lands, B leading and taking the set over where it was (the drones within 5 cm, their shield and health, a
destroyed one's time, a pickup's time left), back to two drones; A, back in the air, fires at B's ship from behind: B
decides, its shield 80 on B, on A and in the page's people list; nine more and B is destroyed, credited to A on every
device and the page; B back 5 s later full, seen so by A (frames until it is, 8 s more at most on a loaded machine; the 5 s
itself is the smoke test's); no room key written by the game while it played, and no effect
reaching a story's effect hook. `--camera` runs only camera mode (`cameraRound`, also in
the main run after the studio's behaviours; a room of its own with two story circles, a page, a pretend headset with
Quest Browser's user agent and a pretend Android phone with Chrome's (`openDevice`: a pretend `navigator.xr` offering
`immersive-ar` that records what `requestSession` is asked and gives the page's pretend session, and every set and fx the
page sends recorded; `installXR` with `phone: true`: a viewer space at the phone's camera, aimed by `X.look`, a hit test of
its view straight ahead against the floor, `X.noFloor` while it has found none, the DOM overlay's state, anchors without
persistent handles, no shared space, and `end()`), a few minutes): the Shared dialog's *Camera mode* on the phone (with
its line), none on the page or in the headset's browser; the headset calibrated on the room's floor spots (its tip on
each) and walked into the first circle; *Camera mode* pressed: the story's own `xrStart` asks, through `HOST.xr.request`,
for `hit-test` and `dom-overlay` (once) with `#camera` as the root (and depth sensing still; v125: no phone AR menu button,
`#xrPhone`, shown); the overlay shown, the dialog
closed, *Move the phone slowly* and *Set spot A* greyed before the floor is found; the page hears a member of kind `cam`
named *Camera*; aimed at spot A (*Aim at spot A and tap Set spot A*, the hit on the spot, the ring there), Set, then spot
B: lined up, the phone's room the headset's (origin within 1 cm, direction within 0.5 degrees, its own floor 5 cm off);
no guide, flow, check by eye, menu or notice in 3D, the room's `rm` the headset's; *Follow* lists the headset, both
circles and Nobody, and following the headset the phone's station and story are its, the rig at the station's spot
(within 3 cm), its clock the station's once the headset plays (within 1 s), the headset drawn where its presence puts it
(its tag; no head or hands over a person in the room); the headset hears a camera (`P.cam`) and never draws or counts it
(heads, lined up 1 of 1), and the page cannot follow it; the headset's menu (its Circles tab's people, read as its canvas
is written) lists the phone as *camera (filming)*, never *here* or *elsewhere*; the headset walks into the other circle and the phone follows;
the phone standing 2.5 s in the first circle changes nothing; a screen ray on the story's own panel is the shell's and
presses nothing, and `beforexrselect` is cancelled on the overlay and its buttons; *Panels: hidden* hides the story's
panels on the phone only (the headset at the same circle keeps them, no `ui` key written), and back; *People: hidden*
draws nobody, and back; *Subtitles: on* shows the caption at the foot once the headset plays; nothing sent by the phone
but its presence and no key of the room its; the page's people list says *camera (filming)* with no Follow; *Hide* and a
double tap (two taps 0.6 s apart are none); *Exit* ends the session (camera mode off, the overlay gone, a page again for
the room) and the page follows the headset on; Start pressed and then an AR session its own request did not give (set
directly, Enter AR stood aside): not the camera's, Start's wish dropped; started again with marks and two handles planted
as a browser that keeps handles would have them: Set spot A at once, not lined up, no marks kept or looked for, the
handles let go, no places kept (nothing in `roomFrames` or `roomFrame`), and *Exit* again; a link with `&camera`: its own page, *Start the camera* once
joined, no dialog; with `--shots` its pictures, `camera-*.png`: the overlay while aiming, following,
panels hidden, subtitles, and the link's page). `--design` runs only the design room
in a room (three pages and a pretend headset, a minute or two; with `--shots` its pictures: `design-menu.png`, the menu's
canvas, `design-station.png`, the table at its circle, `design-circle.png`, its ring, card and icon among the others).
`--token` runs only the relay's password (`tokenRound`, not in the main run; a relay of its own with `COLLAB_TOKEN`, a
minute or two): a page without it sees the Shared dialog's field, and Start a room and a join by code wait for it on the
relay (nothing peer to peer or on this device); a wrong one refused with its note and nothing kept; the right one kept
under the relay's origin, the field gone and the room that waited started on the relay; a second page that has it
joining by the room's link, which (and every address) carries no password; a pretend headset without it getting the
menu's *Relay password* row and its keypad page (26 letters and 10 digits, Use greyed while empty, a wrong one refused,
Delete), then joining; the password in no page's `window.__collabLog`, address or room key, nor in the room the relay
keeps, its lines or its log files; *Forget the password* asking for it again (with `--shots`: `token-1-field.png`,
`token-2-wrong.png`, `token-3-keypad.png`).
`--studio` runs only the studio in a room (`studioRound`, also in the main run, after the room setup guide's round;
about three minutes): relays of its own from port 8790 up, `--static .` with `--scenes` on a temporary copy of
`tools/studio/test/scenes` and a second scene (so none is picked by itself); three pages and a pretend headset: the
menu's *Studio here* putting the circle at its feet, its clock in explore mode, the headset standing in it and the
pages following, none asked to update; the scene picked on one page reaching all; a move by the arrows on one page and a
cube added on another at once, both kept; the headset inside the cube seeing the figure and its sound and not the box,
while a page walking outside and one in Orbit view see the box; a cube that starts something (v136: *Bobber*, Bob looping
on the box, added on a page) held alike by every page and the headset, `plays` included, the headset walking into it
playing Bob on its box (one layer at full weight, the box where Bob puts it) while the pages (one walking outside it, one in
Orbit view) play nothing, the room's keys and every device's state's keys unchanged but for the cube and no effect sent;
deleted on another page, gone everywhere and the headset's box back to its own Spin; *Save* from the headset's panel writing `layout.json`
*by* its name, `.history/` holding 1 file and then 2, every page then *Saved*; a file copied into the folder in the Add
lists within a few seconds; the story's lock refusing a page's edits and the headset's grip; *Convert to GLB* writing
`models/figure.glb`, every device's figure switching to it (corners within 1 mm), the FBX under *Originals*, and its
picture (v120) written through the relay as `previews/models/figure.glb.jpg` (a JPEG under 200 KB), listed as kind
`preview` and shown on another page's Add pane card and the headset's canvas; a model
lacking its picture (the textures scene's `rust.obj`, copied in; that scene itself left out of the copy) given *Use
paint.png* on a page's card: `models/rust.glb` through the relay with the picture in its record, every device's object
switched to it, textured, where it stands; Fewer triangles and Change texture (v119: a dense textured ball made on a page
and put in the folder, saved at 20 % on a page through the relay, every page's and the headset's switched to it as light
as previewed, its record's `tris`; a picture put in its colour slot and saved from the headset, made again from the ball
with its share kept); the rig scene's dancer copied in and placed on a page, a sound made there to
follow her head taken by every page and the headset (each sound where its own dancer's head bone puts it at one held
scene clock, within 1 cm of the first page's) and the saved `layout.json` carrying `on`, `bone` and `o` (that scene
itself left out of the copy); a cut-out made on a page on the test scene's box reaching every page and the headset (its
corners in the scene's frame within 1 cm of the first page's on each, cutting there) and the saved `layout.json` carrying
it under `cuts` (the cuts scene left out of the copy); a group made on a page (the box, the figure, Tone and Doorway),
turned and sized on its card there, taken by every page and the headset (each member within 1 cm of the first page's, the
records the same), a Faces setting (the box inside out) from another page reaching every device's materials, and the
saved `layout.json` carrying `groups` and `faces`; a tint and a brightness (v125: the box red, 125 %) set on a third page
reaching every page's and the headset's record and the box's own materials, and saved; a shape that hides things and an empty with Tone following it made on
a page, the shape locked and the scene's other circles hidden on another, reaching every page and the headset (the same
records, the sound at the empty), a third page's card refused by the lock, the headset at the circle telling its shell
(the hook recorded) to hide the other circles, the saved `layout.json` carrying `shapes`, `empties` and `settings` (v119);
motions (v120: a wobble set on the box on one page and an orbit on the figure on another reaching every page and the
headset, each drawing both in the same phase at one room time held on each, within 1 mm, and the saved `layout.json`
carrying them); a recorded path (v120: the headset records the box's movement, Record its movement armed and a grip on
nothing, 2 s at 30 frames a second with the recorder's clock the test's; its place unchanged, the path reaching every page,
and at one room time held on each, half way through its loop, every page and the headset drawing the box at the same
pose along it, within 1 mm); a ten-minute recording and a voice (v125, with Chromium's fake microphone, which every
browser `tools/collab.mjs` starts has: C records the box for 10 minutes on the test's clock, kept as `recordings/Box-1.json`
through the relay; every page and the headset take its record (the same `src` and `n`), read the file from the relay and,
at one room time held on each, draw the box at the same pose within 1 mm of C's; then C records it again with its voice,
4 s in real time: the path and `sounds/Box-voice-1.wav` (a mono WAV) following the box with `sync` reach every page and the
headset, at one held room time every device puts the voice at the same moment of its file (within 1 ms), and with the
sound on B and C hear it where the room's clock says, within 50 ms; taken away after); a 25 s sound streamed; From another scene (v118: a scene `shelf` made in
the folder with an FBX naming its picture and an OBJ with its MTL and picture: copied into the open scene from a page's
Add pane with the picture at the same paths and the same bytes, placed, one Undo step, taken by every page and the
headset with its picture; the OBJ and what it names under `originals/`, its model in; a second copy of the FBX a new name,
this scene's picture kept; the headset's Add pane offering it); the scene on the room's frame (v125: set up first, so
that nothing from the round's earlier steps moves them: the box, the figure, the cube and the sound without a motion, a
path or a behaviour, nothing locked in place, no cube listing them, and the circle moved to a known spot away from the
room's origin; the headset at the studio's circle drawing the box, the figure, the cube and the sound where their records
put them in room coordinates, their world places turned back through its room frame, within 1 mm; the circle moved 2 m
and turned 90 degrees from a page (`HOST.collab.move`, as the room map moves it): every item where it was in the room
frame by frame while the circle glides, within 1 mm, the headset still at the station, its rig at the new spot; *Move the
scene to this circle* on a page refused while the box is locked (naming it, nothing changed), then every item at the
circle's spot transform of its old place within 1 mm, the cube's yaw turned with it, one Undo step (the list one
longer, its last step every item it moved, once each, with its record as it was just before), every page's and the
headset's records the same and the headset drawing them there; Undo taking it back everywhere); a circle made for one scene written as the shell will
(`st.<id>` and `st.<id>.x` naming `quiet`, with a saved layout of a sound and a cube): two pages following it open it and
write the layout, the room holding each item once, the first station keeping its scene; New scene on the headset's panel
with the shell's keypad stubbed (`HOST.collab.keypad`): made on the relay and opened at its station, the page following it
switching too. Uploads: `/upload` redirecting (302) to `/#studio&upload`; the Upload pane making a new scene, planning the
test originals and sorting them into `models/`, `sounds/` (a mono 16-bit WAV, and a mono 44.1 kHz MP3 from the relay's
`ffmpeg`, else a mono WAV) and `originals/`; the GLBs loading with their records. Then a relay with `COLLAB_TOKEN`: a
page without the password making one refused call and then none, nothing listed or saved (the API 401, `layout.json`
unchanged); a wrong password typed in the Shared dialog never sent by the studio; the right one opening the scene without
a reload, every file and upload carrying it; save, upload and a studio station in a room working; the password in no
page log, address, room key, relay line, log file or saved layout. Then the scenes in R2 (v114): the stand-in S3
(`relay/s3fake.mjs`) on another port (from 8840 up), so every file comes from another origin, and a relay with `--scenes
r2` and a password: a page opens the test scene from it (every file by its signed link, straight from the bucket, CORS,
none refused, none signed in a header), a 25 s sound streamed from it (an element with `crossOrigin`, its ranges 206),
Save writing `layout.json` and `.history/` there, Convert to GLB sending `models/figure.glb` straight into it (a signed
PUT, the record read with a range) and its picture too (`previews/models/figure.glb.jpg`, `image/jpeg`, listed with its
link), From another scene by the bucket's CopyObject (a second scene in the bucket; the FBX
and its picture, each copy's `x-amz-copy-source` signed in the header; placed, its model in), a link the bucket refuses read again and the file fetched by its new one, links past
half their life read again, the Upload pane making a scene and sending the test originals straight into it (the long
sound made MP3 by the relay's `ffmpeg` from its original there), an upload the bucket refuses sent through the relay
(and the next without trying the bucket), the pretend headset opening the scene from it, and the password in neither
the bucket's requests nor a link, the relay's lines or a page. With `--shots`: `studio-*.png`. The design and All
stories rounds expect `STORY_EXTRA`'s pages (the design room, then the studio) after the stories in the pickers.
`--follow` runs only following a person (a room of its own with two stations, a minute or two; with `--shots` the
people list with Follow, `follow-person-1-people.png`, and the dialog following someone, `follow-person-2-following.png`
and `follow-person-3-people-following.png`). The ten-headset round (`headsetRound`, also in the main run, after the
room on this device; `--circles` runs only it, a room of its own with three stations, about four minutes): a pretend
headset sees every card and icon and everyone before any circle, the station cards and a person's name tag following
Cards (in 3D by default, on top, hidden with the rings and icons staying) and not Labels (hidden, still in 3D); the rings 0.5 m over the floor and each card over its ring's middle; in its circle the others' icons only (pointable; their rings gone) and of its own nothing, and only the
people at its circle; *People* in the clock menu drawing everyone and back (kept on the headset, nothing written);
*Show all rings* there showing every ring at any distance, its own too (pointable; kept on the headset, nothing
written), and off again; a ray
resting on another station's icon bringing up its card (no other), still there a second after it moves off, gone about
2 s later, the icon staying; the trigger there running nothing; walked out, still in its story; 1.6 m from another
station's spot its ring there (pointable), 2.6 m off gone again; walking into another circle switching;
the circles lock refusing the grip on a ring and Arrange all and nothing else (the grip at its station free, *Lock this
story* in the menu still working); *Lock this story* refusing the scene and panel grips there, for the room; *Lock
circles* in the menu unlocking; at another circle nothing locked; *Lock story* in a page's dialog locking and unlocking
the headset's circle. With `--shots` its pictures: `round-1-rings.png` (in a circle, the others as icons only),
`round-2-pointed.png` (an icon pointed at, its card up), `round-3-menu.png` (the menu's canvas with *Lock
circles*, *Lock this story* and *People*) and `round-4-dialog.png` (the Shared dialog with *Lock circles* and each
station's *Lock story*). Circles asked first (`askRound`, v118, also in the main run, right after the ten-headset round;
`--ask` runs only it, a room of its own with two story circles and Back to the lobby, a page and a pretend headset, a few
minutes; its two devices the only ones in the run without `collabAskDefault` = `walk`, so v120's default): the fresh room
asking first with nobody having written `look`'s `ask` (the page, the headset and the dialog's button *Circles: ask
first*); a page's Shared dialog turning the room's switch to walk in (`look`'s `ask` false written, the headset too) and
back on (*Circles: walk in* to *Circles: ask first*, `look`'s `ask` true, the headset too); no ring drawn or pointable then, the lobby's too, the cards and icons staying, *Show all
rings* bringing every ring back and off again hiding them (v119); the headset walking into a circle and standing there 3 s entering nothing; the trigger on
another station's icon (pointed at first) opening the question in front of it (that circle's title, 0.8 to 1 m away, on
top and the ray's first target; no notice); *Not now* (pressed by the ray at its button) closing it, nothing entered;
opened again, gone by itself after 10 s; *Not now* pressed by the right index fingertip (a pretend tracked hand, hovering
first); the headset having written nothing to the room meanwhile; *Go in* entering that
circle from the other one (its live station, its story loaded and its rig at that circle's spot, the page seeing its
presence there) and standing on in the first circle entering nothing; the lobby's question (*Back to the lobby*) and its
*Go in* ending the station, the story loaded hearing it (a stub for `HOST.cur.lobby`); from a story again, walking into
the lobby (its ring hidden) ending the station after 1 s and the stub called again; *Go in* pressed while standing in the
lobby holding (not taken back there); the menu's *Circles* row turning it off for the room (`look`'s `ask` false), the headset having written nothing but
`look` (and what any arrival writes: its story's state and view there); walking in working again; then (v119) a studio
circle added from the page: `HOST.collab.hideOthers(true)` refused (false) at a story's circle, and at the studio's
(walked into, the studio loaded) every other station's ring, card and icon gone and nothing of them pointable, a hidden
story circle not walked into (still at the studio after standing in it), the lobby still walked into (the station ends
and the hiding lapses with it), then a story circle walked into again (with `--shots`: `ask-1-question.png`). Your
menu shown to your circle (`menusRound`, v120, also in the main run, right after the circles asked first; `--menus` runs
only it, a room of its own with two story circles, a page and three pretend headsets, A and B walked into one circle and
C into the other, a few minutes): off by default (*My menu: only me*, nothing kept), A's menu open sending nothing and B
drawing nothing; A's *My menu: my circle* (Settings) pressed: B draws a plane where A's menu floats (its top edge's middle,
its turn and width within 1 cm and a degree, the picture's shape that of the part A's menu shows; A's menu and B's copy
read while both draw frames, since between the round's steps a pretend headset draws none and B lets a copy go 3 s after
its last sample), its picture A's menu
(its pixels not dark), depth-tested, `renderOrder` between 49 and 50 (its group's 0), never pointable, A's name on its tag; C draws none
of it; the page's Shared dialog says *showing their menu*; A's tabs changed four times a second, a frame of A's with
each change, for at least 4 s and until 2 pictures have gone out (at most 20 s: a busy machine draws the pretend
headsets' frames seconds apart, and pictures are made in frames): at most one sent every 1.5 s by A's own clock (a
want's answer counted, as it is sent too), each 1,490
ms or more after the last, every effect under 48 KB, B taking every one (its `got`); a pretend controller's ray moving
over A's buttons for 4.5 s, a frame of A's with each move (only their light changing, at least three buttons lit): a
picture made at most every 4 s by A's clock, each 3,990 ms or more after the last (pictures by their numbers: a want's
answer is no new one), but one sooner at most, and only where the later picture shows a later `cver` than the one before
it (`menuSent`'s `cv`: what the menu shows changed meanwhile, as its clock's minute; the light of what is pointed at
never moves it), and under 24 KB a second sent; the Story tab's picture (its
shape that tab's, its height read once a frame of A's has drawn the tab, lit below its top quarter where the story's
panels are drawn in; a pretend headset's step does not draw the story's panels, so the round draws them once first); A's head turned 69
degrees, its menu gliding back in front: B's plane following (at most 5 poses a second) and ending where A's stands; A
silent (no frames, as a headset taken off): gone on B after a few seconds with nothing closed (B's `menu gone` says
`quiet`), and back once A goes on (B asking for the picture it lacks); A's menu closed, while both draw frames and B
holds a copy whose last sample is under 1.5 s old (else, frames stopped between the round's steps, B let it go quiet
first, rightly): gone on B as its `closed` comes
(B's `menu gone` says `closed`, so not the 3 s without a pose; within 2 s, B's polls reading no pixels back; a failure
shows B's log of A's copy, a `closed` it ignored too, and A's own closed lines), opened
again, back; *My menu: only me* again with the menu open (the same way): gone on B (`closed`), nothing more sent; on
again (kept as `xrMenuShare`) and A's session ended (the same way): gone on B (`closed`) (with `--shots`: `menus-1-picture.png` and `menus-2-picture.png`, the pictures B holds of A's
Settings and Story tabs, and `menus-1-seen.png`, `menus-2-seen.png`, what B sees from its head). The studio's scenes as circles (`scenesRound`, v118, also in the main run after the studio round;
`--studio-scenes` runs only it, a relay of its own from port 8770 up with `--scenes tools/studio/test/scenes
--scenes-readonly`, a minute): the page's Add listing after *Studio* one entry per scene of the relay (*Studio: <scene>*,
values `scene:<name>`), then All stories and Back to the lobby; adding *Studio: test* writing `st.<id>` `{ story:
'studio', sc: true, x, z, yaw }` and `st.<id>.x` `{ scene: 'test' }` for every page; a second scene's circle at once, both
titled *Studio: <scene>* in every page's dialog; *Studio here* adding a plain studio circle beside them and then moving
that one; a scene picked at that plain circle (its state naming it, its title *Studio: <scene>*) and *Studio here* still
moving it (no fourth circle); a scene circle moved keeping its `sc`, and *Studio here* then still moving the plain one.
The relay the main site offers (`homeRound`, v120, also in the main run after the scenes round; `--home` runs only it,
under a minute): a browser of its own that takes `stories.lbi-netmed.com` and `stories.lab.lbi-netmed.com` for this
machine (`--host-resolver-rules`), the page served there by the test relay as plain http (the offer goes by the host
alone), its `/api` turned away as GitHub Pages has none and nothing let out to any other address: as the main site it
offers `https://main.lab.lbi-netmed.com` (`HOST.collab.homeRelay()`, the Shared dialog's box naming it) and sends that
address nothing before a password is typed; as the test place's name and on `127.0.0.1` it offers none (`HOME_RELAY`).
The studio's behaviours shared (`behaveRound`, v120, also in the main run after the scenes round; `--behave` runs only it, a
relay of its own from port 8750 up with `--scenes` on a copy of the test scene alone, a few minutes): a studio circle at the
room's origin facing -z (its scene's frame the room's), two pretend headsets in it and a page following it; a ball that
follows (nearest, range 3, 1 m, 1 m/s) and a cube that looks (first) put in on the page; the nearest headset is the ball's
on every device and drives it (the others drawing its samples) to 1 m in front of itself, where all three draw it within 5
cm, and the looker's; while it walks 1.5 m the page and the other headset draw the ball where it had it 120 ms before (the
median within 5 cm, by the relay's clock; it prints the median and the 90th percentile); Pause on the page (v122, editing
on there) writing nothing to the room (its `state()` and the station's key unchanged), the page drawing the ball where it
is placed while the other headset still draws it within 5 cm of the driver, and played again the page following it again;
the other headset coming nearer by more than 0.3 m taking the ball over everywhere; the looker staying the first headset's while it is within range + 0.5
m though the other stands nearer, and the other's once it is further; nobody in range, both back where they are placed on
every device; the room keeping the two records and no key of the samples.
The PC's Vive trackers end to end (`trackersRound`, v126, also in the main run after the studio's behaviours; `--trackers`
runs only it, three to five minutes; `tools/trackers/SPEC.md`, "Tests"): the bridge's lane, the shell's and the studio's
together through a relay of its own from port 8730 up (`--trackers 0`, a free UDP port read from its start line, and
`--scenes` on a copy of the test and puppet scenes, taking uploads) and the fake bridge (`startFake` with SteamVR's space
the room turned 0.7 rad and moved by (1.3, 0.02, -0.6) m): one tracker laid on spot A then spot B, a prop tracker going
round at 0.38 m/s, the Index's headset and controllers, a base station, and six trackers worn on a performer, a walking
copy of the puppet test rig worked out in Node (three.js and its GLTFLoader, as `tools/studio/test-ik.mjs` loads them; the
smoke test's seeded offsets, their mean along the floor zero), fed to the fake as functions of its clock. Three pages and
a pretend VR headset with Chromium's own user agent (not a Quest's; in VR from the start, asked whether it is in the room
while the room does not use the trackers yet; the airports story they open with stops drawing its globe, which in software
starved the pages for seconds): the relay's ping (8 trackers seen); the Shared
dialog's section and its switch (`trk.on` in the room, every device then told `l: ''`); spot A and spot B through the real
`/api/trackers/still` (spot B refused while the tracker slides 3 cm a second, then taken), `trk.m` within 0.2 mm of where
SteamVR reads the spots, the status *Lined up by hand (the spots 2.00 m apart): 8 trackers in the room.*, the 11 tracked
devices on every device (no base station); a name typed in the dialog reaching the others, another page's name and a
newer app's field kept by a write; the headset, the fake's `'h'` its head, lined up by the trackers (`'trackers'`) within
1 cm and 0.5 degrees (0.01 cm and 0.003 degrees), *In the room* answered for it, never *Calibrate the room* meanwhile, the
pages' list *lined up (the PC's trackers, ...)*; at a held relay time every device's trackers within 2 mm and 0.2 degrees
of the truth (0.6 to 1 mm and up to 0.06 degrees); a studio circle for the test scene where the headset stands, three pages following
it, a shape set on a page's card to follow the prop tracker drawn within 5 mm and 0.5 degrees of where its true pose and
offset put it on every device at a held time (0.1 to 0.7 mm, under 0.05 degrees); the puppet scene picked there, the spot and prop
trackers switched off, the rig worn whole body and lined up from the T-pose after its 5 s countdown (its six parts found,
moved to the performer within 3 mm, sized 1), the record and its solving on every device; the performer walking, the 23
bones on every device within 1 degree of each other at a held time (0.0000) and its hands and feet within 1 cm of the
performer's (0.6 to 2 mm); a 3 s take (its countdown, Stop) saved through the relay as `models/rig.glb` with *Walk* and
*Take 1* (3.1 to 3.4 s, 24 tracks, read back in Node; 9 or 10 keys from a page drawing in software), another page switching to it and playing *Take 1* once it is worn no
more. A held time: the fake paused for a moment, each device waiting for the last reading (a page busy drawing in software
takes the relay's messages late), the relay's time held (`HOST.collab.trkTime`) between the last samples. With `--shots`,
`trackers-1-dialog.png`.
Others' moves drawn smoothly (`smoothRound`, also in the main run, after the ten-headset round;
`--smooth` runs only it, a room of its own with two stations, three or four minutes): a raw socket at the station (speaking
as the follow-a-person test's pretend person does) turns its scene about the vertical at 90 degrees a second, 15 writes
a second with `ts` and `h`, each sent up to 25 ms late, then lets go; a pretend headset standing there in explore mode
records its scene's turn every frame (by the frame's own time: the page renders in between, slowly and unevenly in
software): after 0.5 s no frame without motion, the speed per frame within 35 % of the writer's in at least 85 % of
frames, the turn about `SMOOTH.DELAY` behind (within 80 ms), landing where it was let go with no overshoot; a place with
no `ts` still gliding in; landing at the frame whose render time reaches the let-go (not glided there); someone else
turning it and letting go, the headset gripping it at once (their samples dropped) and letting go a moment later, and
it staying where the headset left it; a place written for another story moving nothing (the relay refuses it); the same
for the station's panel moved sideways at 0.3 m/s, for a second station carried by the writer at 0.5 m/s (its ring),
for the explore view (and the headset writing nothing to the room meanwhile, its view ending exactly as let go; a view
with no `ts` gliding in by the story's own glide, nothing written back) and a person's head walking at 0.5 m/s; a grip held on the scene there writing at most 16
place values in any second (66 ms apart at the closest), each with `ts` and `h`, and the last without `h`. It prints
what it measured (frames, the share within 35 %, the speeds' 5th, 50th and 95th percentile, the lag, how far from where
it was let go). A new story needs an entry in `STORIES`
(`change` and `back`: code that changes its `state()`, and optional `effect`
and `more`); the headset's story (`HEADSET_STORY`) stays the last entry.
`--shots <dir>` also saves pictures of rooms on this network (`near-dialog.png`, `near-toast.png`, `near-again.png`,
the menu's canvas `near-menu.png`), of the dialog and eight headset views (the menu open on its Settings tab, its Story tab, its Sound check,
stepped out of a station's circle: still in its story, the others as icons only, and the stations' icons from behind the first row and along it, as a headset in no circle sees them, at 1280 x 800), and the ten-headset round's four.

After changing the room and depth test page (`room-test/`), run `node tools/room-test.mjs` (a minute; it starts its own
relay on port 8131 with `--logs` in a temporary folder): a pretend headset drives three.js r128's own WebXR path with a
real WebGL2 depth texture array made in the page, a new one every frame with WebGL's default filter (near on the left
half of each eye, far on the right), drawn into a framebuffer of the pretend layer's own, and its pixels show the test pillar and panel hidden where the depth is nearer and drawn where it is farther, in
both eyes, through three.js and through raw WebGL; depth of 1.9 and 2.1 m against the 2 m pillar; an eye with no depth
for a frame; rows split top and bottom (identity, *Depth as: metres, flipped*, and a matrix that turns y over); window
depth for its own near and far (auto reading it so, the close steps right), and with no far plane (`depthFar` Infinity:
the report's `infinite`, the probe in metres, the same occlusion and close steps, the picture drawn); depth seen from a view
0.3 m ahead of each eye (a surface 1.9 m from there drawn 2.2 m from the eye, the 2 m pillar in front of it, behind it
with *Depth seen from: the eye*; the offset in the report); the room marked changed every frame with the same shapes
(nothing rebuilt or gone for a frame) and a real change rebuilt once; the ladder after another error; also the
depth picture's colours, an integer (`'unsigned-short'`)
texture, CPU depth, a pretend wall, floor and table (Room's labels, Room hides hiding what stands behind the wall), a
pretend controller pressing the panel's Mode, a session without depth, the format ladder, the frame times (Nothing asking
for no depth, the GPU's done-by time per mode), the autosave and the report, and Send to the relay.

For the tour, test a changed set on its own in the set harness first
(`tools/lbi/shot.mjs`, much cheaper than the whole story), then the story at a
few seconds (`tools/lbi/sweep.mjs`), then the smoke test. The muscle story has
the same tools in `tools/nmd/` (`shot.mjs`, `sweep.mjs`), and so have the
endotype story in `tools/endo/`, the PET story in `tools/pet/`, the microanatomy story in `tools/micro/`, the ovary story in `tools/ovary/`, the qubits story in `tools/qubits/`, the mutation story in `tools/mutation/`, the tissue topology story in `tools/topo/` (also `test-data.mjs`: its data and decoders against the poster's numbers, a second), the soil story in `tools/soil/` (also `test-data.mjs`: its data, decoders and the story's key numbers, a second), the pass story in `tools/pass/` and the robot gang in `tools/robots/`.

The studio's two tools: `node tools/studio/scan.mjs <folder> [--check]` writes a plain folder's `index.json` and
`<name>/files.json` as the relay's API answers them (only what changed; `--check` exits 1 when one is not current, the
files' times aside: run it on `tools/studio/test/scenes` after changing the test scene). `node tools/studio/convert.mjs
<model> [out.glb] [--max-texture 4096] [--no-weld] [--keep 0.2] [--no-fill] [--shots <dir>]` (FBX, glTF, GLB, OBJ, PLY or STL; Playwright and
Chromium, as the smoke test) converts one model with the studio's own converter in a headless page, then checks the GLB
against the original (triangles, size, textures, clips, bones, where the bones and a sample of skinned corners are at
four moments of each clip, and pictures from three sides) and writes nothing when something did not come through (exit
1); it prints the record it wrote (`asset.extras.studio`). The default output is `<name>.glb` beside the input
(`<name>-<max>.glb` for a GLB). It is both a tool for the owner's batches and the test of the converter on real files
(the owner's two, outside the repository). `--textures <dir>` adds pictures to look in, `--texture <name>=<picture>`
gives a texture the model names and `--texture <material>:<slot>=<picture>` lays one on; it prints what each texture was
found as and writes `tex` into the record. `node tools/studio/test-images.mjs` (seconds, no browser) reads the textures
test scene's pictures and more kinds made in memory back against the pixels they were made from (exactly, or within the
block format's error for DXT1, DXT5 and BC5), and checks the refusals, broken and forged files refused in words and
quickly (strips or tiles of no size, sizes their data cannot hold, RLE counts past the end, a Deflate strip that unpacks
to 64 MB), a PSD's named alpha channel not taken for transparency, LZW and PackBits round trips, the ladder, `slotOf`
(colour words first, the last word only), `texRank` and the `.psd` renaming, and the fill of the gaps between a picture's
pieces (v120: `cover` marking the texels whose centres its triangles hold, a tiny one's own; `fillGaps` on an atlas of
three shaded pieces on black: the covered texels unchanged, no black left, the texels beside a piece exact copies of
its edge colours, alpha kept or filled, a picture drawn down 2 and 4 times with a dark halo without `rim` and none with
it, a strip two texels wide keeping its own, a 4,096 px one); run it after changing `tools/studio/engine/images.js` or
`tools/studio/test/pictures.mjs` (then `node tools/studio/test/make.mjs`). `node tools/studio/test-ik.mjs` (v125, under a
second, no browser) checks the trackers' solver (`tools/studio/engine/ik.js`) on the puppet test scene's rig loaded twice,
one walking as the performer: the parts found (and refused in words), which tracker is which from a T-pose, and every
frame of the whole body (6 and 11 trackers, a performer 1.1 times the size), the feet and a headset, and a headset alone
(stepped feet) against the truth, the same output twice, and a take replayed; run it after changing `ik.js` or the
puppet in `tools/studio/test/make.mjs`.

Useful URL hashes: `#spatial&t=95` (open at that second of the timeline, paused),
`#proteins&explore&q=TP53` (explore mode with a search),
`#spatial&explore&tab=moves&move=nfkb&now=1`, `#lbi&t=140` (the tour at a
second), `#lbi&explore&scene=atp&view=network&now=1` (a scene with its controls),
`#lbi&explore&route=TP53,BRCA1`, `#nmd&explore&group=Cardiomyopathies`,
`#nmd&explore&pick=5:13,11:7` (endotypes, group:number), `#nmd&explore&walk=5` or
`&walk=TTN,DES`, `#nmd&explore&inside`, `#endo&explore&endo=2`, `#endo&explore&gene=COLQ`,
`#endo&explore&tab=method&step=1&k=20`, `#endo&explore&scene=syn&view=cleft`, `#endo&explore&inside`, `#pet&t=40`, `#pet&explore&tab=networks&net=C_high`, `#pet&explore&organ=muscle`,
`#pet&explore&scene=scan&view=ring`, `#pet&explore&life`, `#micro&t=100`,
`#micro&explore&organ=Ovary`, `#micro&explore&tab=age&age=70`, `#micro&explore&scene=atlas&view=volcano`, `#ovary&t=200`,
`#ovary&explore&kind=follicle`, `#ovary&explore&tab=age&age=60`, `#ovary&explore&scene=section&view=forest`, `#ovary&explore&scene=section&view=kinds&age=60`, `#ovary&explore&method=seg`, `#qubits&t=100`, `#qubits&explore&tab=network&net=blurred&cut=random&bits=2`,
`#qubits&explore&brick=X2X1&alg=so6`, `#qubits&explore&sum=10`, `#qubits&explore&tab=depth&ex=on`, `#qubits&explore&scene=pairs&view=hoods`,
`#mutation&t=100`, `#mutation&explore&tab=letters&mix=G` (or `mix=rule&time=0.45&reads=100`),
`#mutation&explore&tab=rule&model=even&start=C&time=0.8`, `#mutation&explore&tab=rule&view=steps&parent=T`,
`#mutation&explore&tab=tree&seed=3&speed=2&branch=5`, `#mutation&explore&tab=stem&src=live&w=20` (`&rebuild=2` its seed),
`#mutation&explore&scene=tree&view=up` (the tree's own cameras: `up`, `stand`, `crown`),
`#topo&t=100`, `#topo&explore&tab=patch&r=13.5&tower=on` (`tower=off`: the balls; `view=bars`: the barcode; `lit=loops`),
`#topo&explore&tab=cohort&dim=1&view=space&slide=17` (`dim=0`: pieces; `view=rack|space|held`),
`#topo&explore&tab=scales&dim=1&from=5&to=15` (`to=above`), `#topo&explore&tab=cells&cell=1234&r=4.8&delta=50`
(`show=map|split|genes|proteins`), `#topo&explore&scene=slide&mode=points`, `#topo&explore&scene=body&liver=slice`,
`#topo&explore&scene=tower&view=up` (the tower's own cameras: `up`, `stand`),
`#soil&t=100`, `#soil&explore&tab=field&date=4&show=chl` (`show=nh4|no3|n2o|ph`, `line=0|1`, `fert=0|1|2`, `view=jars`;
`plot=1` a group of plots, line * 3 + regime), `#soil&explore&tab=nitrogen&wheat=bni&dcd=on`,
`#soil&explore&tab=microbes&colour=guild&kind=215` (a kind by its number), `#soil&explore&tab=network&mod=3&rho=0.7`
(`&shuffle`, `&split=line|fert|random`), `#soil&explore&scene=web` (the globe and the hop; `&now=1` skips the glide),
`#pass&t=180&lang=de` (German), `#pass&explore&tab=fish&k=1&links=on&shark`, `#pass&explore&start=LHR&spread=high&cut=50&day=20&city=SYD`,
`#pass&explore&protein=CFTR&move=cf`, `#pass&explore&scene=globe&pillars=on`, `#flock&explore&view=afar&links=on&birds=400`
(`&hunt` sends a falcon), `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low`
(`&crumbs` spills a pile, `&walk=1.5,1.2` walks you there), `#airports&repeat=all` (a kiosk that plays
every story in turn), `#airports&slides=on` (every story as a slideshow), `#anchor=on` (anchored headset placement), `#qubits&panels=controls` (that story's panels in the headset: only the foot bar), `#stories&net=home` (pretend to be on a network, without a relay: rooms on this network in tests),
`#design` (the design room's table), `#design&pick=lbi.atp&view=stage` (a prop on the stage, its card; `view=above`,
`view=group:pet` a story's plate, `&tab=all`, `&now`), `#studio` (the studio: the last scene used here, else the only
one, else the list), `#studio&scene=atelier` (a scene), `#studio&scenes=tools/studio/test/scenes&scene=textures&edit` (the textures test
scene: place its models to see the ladder and the cards), `&edit` (editing on), `&visit` (a visitor's kiosk: no editing
and no uploads at all), `&upload` (the Upload pane, where the relay's `/upload` sends people; `&relay=wss://...` with
it for a relay elsewhere), `&tab=scene|add|item|items|upload`, `&view=walk`, `&scenes=tools/studio/test/scenes&scene=test`
(a static folder of scenes instead of the relay's: a relative path only), `&maxtex=2048` (the texture limit, 512 to
8,192; 4,096 by default). In the console,
`HOST.cur.peek('expression')` evaluates inside the current story
(e.g. `HOST.cur.peek('NET.P')`).

## Working economically (token budget)

Building the tour cost about 16M tokens in sub-agents, plus the main
conversation: about a quarter on building, three quarters on critiques, fix
rounds and verification, all on the most expensive model. Next time:

- **Match the model to the job.** Use the strongest model only to build hard
  things and to integrate. Critiques, verification, screenshot sweeps, audits,
  data extraction and mechanical edits go to a cheaper model (for example
  Sonnet or Haiku) at lower effort.
- **One review round.** One critique and one fix per piece of work; a second
  round only for major findings. Verify findings in one batched pass per area,
  not one agent per finding, and only the high-severity ones.
- **Cap the visual checks.** Small screenshots (640x400 is plenty), contact
  sheets instead of single images, a fixed limit per agent (about 20 images),
  and numbers instead of pictures where possible (label positions, camera
  speed, build time, draw calls).
- **Give each agent only what it needs.** Its own section of a spec, not the
  whole spec; text descriptions of slides or images, not the images; line
  ranges of the big story files, never whole files.
- **Set a budget and plan the run.** Put a token target in the request (e.g.
  "+3M"); workflows can read it and stop early. A workflow runs at most
  (CPUs - 2) agents at once (2 on a 4-CPU cloud machine), so launch one small
  workflow per item instead of one big one, and keep headless-browser work to
  a few agents at a time. Hitting the usage limit mid-run kills in-flight
  agents and their work is redone, so finish or checkpoint long runs first.
- **Prefer cheap tests.** The smoke test and the set harness catch most
  problems; full screenshot sweeps of a story are for the end.
- **The full suites run only before `main` moves** (the owner, 7 November 2026; "Testing"). Running them costs no
  tokens (they are scripts on the machine's CPU); chasing their red results does (100,000 to over a million tokens a
  time), and from v91 to v122 about 5 real app bugs were caught in the full runs against about 70 failures that were the
  tests' own or the machine's (load, slow software drawing, restarts); builders' own runs caught about 11 more before
  merging. Code reviews and the owner's headset tests found more real bugs than the suites did.
- **The shape of a story run** (as the qubits story was built: two builders,
  one review and one fix round in about 1 h 15 min and 1.2M tokens): the
  builders use the strongest model, the review runs on Sonnet, there is only
  one fix round and only if the review finds something, and the agents run the
  smoke test once at the end rather than after every step (the shared-room,
  relay and update tests run once, by the integrator, after the fix round).
- **Show every screenshot.** The owner wants to see each screenshot an agent
  takes as it is taken: agents keep them in one folder outside the repository
  (e.g. `/tmp/<story>-shots/`), and the conversation that runs them watches that
  folder and posts each new picture to the chat.
- **Keep sources small and in the repository.** Edit `tools/lbi/` sources, not
  the 700 KB built file; keep generators and manifests so nothing has to be
  rediscovered.


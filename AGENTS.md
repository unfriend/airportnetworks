# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What this is

An installable web app that teaches network science in narrated stories
(the airports about four minutes, the proteins and the cell map about six, the tour about ten and a half, the muscle
story about nine, the endotype story about seven and a half, the PET story about six, the microanatomy story about eight,
the ovary story about eight, the qubits story about nine, the mutation story about eight and a half, the tissue topology
story about nine, the soil story about eleven, the pass story about seven, the flock and the robot gang about two), each
followed by an explore mode. Everything works on desktop, phones and in VR/AR headsets (built for Meta
Quest Browser, WebXR).

| Story | File | Network |
| --- | --- | --- |
| Network theory | `packages/airports/main.js` | 3,214 airports, 18,858 routes on a globe |
| Network medicine | `packages/proteins/main.js` | 254 curated proteins, 375 interactions in a cell |
| Spatial interactome | `packages/spatial/main.js` | 249 proteins in 13 compartments of a model cell |
| LBI Network Medicine tour | `packages/lbi/main.js` | ten 3D scenes, from a protein machine and an illustrative interactome to organs and tissue |
| Rare muscle diseases | `packages/nmd/main.js` | 1,182 genes of 13 neuromuscular disease groups in a tower of 71 layers (the authors' real data, kept out of the repository), the motor unit, a supercomputer |
| Disease endotypes | `packages/endo/main.js` | one neuromuscular junction close up; the 35 genes of congenital myasthenic syndromes in the authors' protein network (18,306 proteins), their module of 393 genes and 12 endotypes (EndotypY), the motor unit |
| Whole-body PET | `packages/pet/main.js` | a PET/CT scanner and how it sees; the organs of the paper's 658 whole-body scans (Geist et al., Med 2025) and their partial correlation networks (printed and read off its figures), from health to disease; the tour's PET body |
| Tissue microanatomy | `packages/micro/main.js` | the tour's H&E section and the domains a method finds in it; 24,945 GTEx slides of 40 tissues (Buljan, Bago-Horvath, Rendeiro, bioRxiv 2025); the network of organ architecture (29 organs, tissues, 10 tissue types, 70 domains, Iva Buljan's file); which domains change with age, pathology, and the contacts between domains |
| Ovarian aging | `packages/ovary/main.js` | the tour's body and a drawn cut-away ovary that ages; 255 GTEx donors aged 20 to 70 (Chakraborty, Moustafa, Rendeiro, poster); a drawn H&E section with blood vessels, macrophages, corpora albicantia and follicles (14,941 marked by hand), tiles with UNI2 features and a random forest, SegFormer's masks and their scores as tags on the section; the poster's trends with age told on the ovary as it ages (each method's count on its lines as tags; r and p in words) and the methods' agreement; an illustrative spatial neighbor network that tips up off the section and gathers into hubs by kind |
| Quantum network compression | `packages/qubits/main.js` | example gene networks (320 genes in 8 hidden groups, at three strengths of mixing, and a random one) cut into 8 cells on 3 qubits; the coarse operator A_c on a cube, its Pauli strings, the toolbox (a Lie algebra, so(6) or so(7)) and what it drops; the real run's residual by depth and its 3-qubit circuit (Joel Hancock's method and figures) |
| Quantum phylogenetics | `packages/mutation/main.js` | a text in four letters copied with swaps; a family tree in 3D (8 tips, 14 branches, every swap simulated) you walk round and look up into; a letter's two qubits and their read-outs; a rule of change (three example substitution models) as balls and arrows and a path through the pyramid of mixes; the machine for one branch (copy and turn), its circuit, one machine per branch; an RNA stem, its pairs and their coupling; the ancestor of three species rebuilt 2,000 times three ways (Enes Berk Sakalli and Arndt von Haeseler's poster; example numbers computed live, the poster's only as the authors' test) |
| Tissue topology | `packages/topo/main.js` | 110 real cells of a healthy liver (the poster's patch) with balls growing round them, the network with triangles, pieces joining and loops opening and closing, and the tower of scales; 123 GTEx liver slides (66 healthy, 57 with cirrhosis, 30.8 million cells found by HistoPLUS), their curves, main shapes, scores, a classifier's wall, its held-out test and its weight for every radius; a new slide's window of 6,716 cells, every cell scored, the two groups and their cell types (Simon Schindler, André Rendeiro and Jörg Menche's poster; every number computed by their package topocyte on their data) |
| Soil microbes | `packages/soil/main.js` | a cut-away block of soil with a wheat plant, its nitrogen's flows and the microbes' relay; a field trial in Japan (a BNI wheat and its control, three fertiliser regimes, 24 plots, five dates, 119 samples) with each plot's chlorophyll and nitrate and the jars' N2O read off the slides; about 100,000 kinds of soil microbe (a cloud of 20,000) and the co-occurrence network of 1,564 kinds and 22,348 links, its modules and the two wheat lines' networks side by side (the slides and field trial of Marina Montserrat Díez, Christa Schleper and colleagues; the network built for this story) |
| Networks for everyone (outreach; English and German) | `packages/pass/main.js` | a school of fish (300, a live simulation) all around you, each watching its 7 nearest neighbours; the airports story's globe (3,214 airports, 18,858 routes, taken unchanged) with a seeded S/E/I/R outbreak on its routes; the cell map story's cell (249 proteins in 13 places, taken unchanged), its NF-κB relay and CFTR in the wrong place |
| Flock | `packages/flock/main.js` | 200 starlings (a live simulation) flying all around you at dusk, each following its seven nearest neighbours |
| Robot gang | `packages/robots/` (a story package since v185) | 6 to 24 robot vacuums (a live simulation) in a model living room, or in a headset your own room; who follows whom (you, or the one ahead) is the network |
| Tutorial (an introduction, last in the list since v180, `intro: true`; v173) | `packages/tutorial/main.js` | a robot guide (the people's armour figure, `bodies.js`, driven by a script) shows how the app works in a headset, then seven practice tasks; its chest badge becomes a 10-node network |

Besides the stories, two pages that are not stories (`STORY_EXTRA`, on no Stories screen): the design room
(`stories/design.js`, `#design`: a table with a small model of every prop) and the studio (`stories/studio.js`,
`#studio`: the owner's own models, trigger cubes and sounds placed life size in the room, served and saved by the
relay, with an upload page that converts and sorts what is dropped on it).

No build step, no framework, no package.json. Plain HTML/JS plus
`three.min.js` (three.js r128, vendored, MIT) and `peerjs.min.js` (PeerJS 1.5.5,
vendored, MIT, loaded only when a shared room runs peer to peer); the studio pastes three.js r128's own loaders and
exporter and meshoptimizer's simplifier (1.3.0, its WebAssembly inside; `tools/studio/vendor/`, MIT) into its built
file. The app is deployed by copying
the folder to any HTTPS host (GitHub Pages works); VR and installing need HTTPS.


## Layout

One or two lines each; the full text of every entry is `docs/agents/layout.md`.

- `index.html` - the app shell: shared CSS and DOM and the `HOST` object; owns the single WebGL renderer and any XR
  session, loads and swaps stories (`docs/agents/shell.md`).
- `stories/list.js` - `STORY_LIST` (empty since v187: every story is a package; old shells read it) and `STORY_EXTRA`
  (the design room, then the studio); `HOST.meta(key)` finds a key in either or in `HOST.packages`.
- `packages/<key>/main.js` - one story each (v187: all sixteen), `HOST.register('<key>', function (HOST) { ... })`,
  returning `{ inputs, caption, recenter, panels, xrPose, collab, peek, dispose }` (optionally `lobby`, `sticks`); built
  from `packages/<key>/src/`, except airports, proteins and spatial, hand-written (`main.js` is the source, no `src/`).
- `stories/design.js`, `stories/studio.js` - the two pages that are not stories, built from `tools/design/`, `tools/studio/`.
- `proteins.html`, `spatial.html` - redirect stubs to `index.html#proteins` / `#spatial`. No code there.
- `lowpoly.js` - the miniatures (`LOWPOLY_MODELS`), generated by `tools/lowpoly/build.mjs`; never edit by hand.
- `version.json` - the latest release, written by `tools/release.mjs`, never by hand, never cached.
- `whatsnew.json` and `whatsnew/` - what is new (developer mode's box), written by hand at every release; `whatsnew/`
  by `tools/release.mjs`.
- `sw.js` - service worker: network first, checked each time; narration MP3s in their own cache
  (`networks-narration`); studio scenes and `examples/` passed through (`docs/agents/shell.md`).
- `audio/` - since v187 only `PUT-narration.mp3-HERE.txt` (the chapter timings); each story's narration is
  `packages/<key>/audio/narration.mp3` (the pass story's German `narration-de.mp3` beside it).
- `manifest.webmanifest`, `icons/` - PWA install metadata.
- `LICENSE` (MIT, the code) and `NOTICE.md` (CC BY 4.0 for words, narrations, docs and icons; the data's and
  others' parts' own terms) - served with the app by the relay (`docs/data-and-permissions.md`, "Licence").
- `shared.js` - the shared-room client (`HOST.collab`, `HOST.room`), loaded between `index.html`'s two scripts
  (`docs/agents/shared-rooms.md`).
- `sfx.js` - sound effects (`HOST.sfx`, `SFX_LIB`); `tools/sfx.html` its sound board, `tools/sfx-render.mjs` renders
  them.
- `occlusion.js` - real-world occlusion in AR (`HOST.occlusion`).
- `notes.js`, `notes/`, `tools/notes/` - the developer notebook (`HOST.notes`), its notes page and tools; the headset
  menu's Debug tab reads them too (*Notes*, `shared.js`).
- `ships.js` - the spaceships (`HOST.ships`).
- `bodies.js` - people's bodies in a room and My body (`HOST.bodies`: the mannequin, its poser, every body in one draw),
  loaded on demand after `ik.js` (`docs/agents/shared-rooms.md`, "People's bodies").
- `ik.js` - the trackers' solver (`makeIK`): pasted into `stories/studio.js` (the puppet) and loaded for `bodies.js`.
- `peerjs.min.js` (PeerJS 1.5.5, MIT, `PEERJS-LICENSE.txt`) - loaded only for a peer-to-peer room; `p2p/` - a network
  test page, not part of the app.
- `output.js` - the output page (`HOST.out`: MIDI and OSC from a room and the studio, `&output`; v162 streams one sound
  input to the room through the relay, heard elsewhere and by studio *Live sound* items), loaded on demand;
  `tools/output/` its `SPEC.md`, `README.md` (setting it up) and `test-page.mjs` (`docs/agents/shared-rooms.md`).
- `room-test/` - the room and depth test page for a Quest 3 (not part of the app; its test `tools/room-test.mjs`).
- `relay/` - the shared rooms' server (`server.mjs`, Node, no packages), its tests, Dockerfile and `README.md`;
  `scenes.mjs`, `r2.mjs`, `test-r2.mjs`, `s3fake.mjs`, `trackers.mjs`, `notes.mjs`, `osc.mjs` (OSC on UDP, `--osc-out`,
  `--osc-in`).
- `tools/trackers/` - the Vive trackers: `SPEC.md`, `bridge.py`, `fake.mjs`, `README.md`.
- `docs/` - the shared rooms' plan and lessons, the handover pages (`data-and-permissions.md`,
  `questions-for-authors.md`, `setup-and-release.md`, `event-runbook.md`, `narration.md`, generated: never edit),
  `history.md` (why rules are as they are) and `docs/agents/` (the detail files below). `HANDOVER.md`: start here when
  taking the project over.
- `tools/smoke.mjs`, `audio.mjs`, `sfx-cues.mjs`, `update.mjs`, `live.mjs`, `collab.mjs`, `perf.mjs`,
  `room-test.mjs` - the tests and the measuring tool (`docs/agents/testing.md`); `tools/release.mjs` writes
  `version.json`; `tools/narration.mjs` writes `docs/narration.md`; `tools/pace.mjs` the `NARRATION_SYNC` of a story
  without a recording.
- `tools/voice/` - synthetic narration (Kokoro-82M `af_heart`; German with Piper's Thorsten voice); models and Python
  outside the repository, see its `README.md`.
- `tools/mol/` - protein models from the PDB (`build.py`, Python outside the repository: a surface with baked occlusion,
  a cartoon and balls at three levels each, `<name>.mol`); the engine's parts `MOLS molLoad ... molMesh` draw them.
- `packages/<key>/src/` - the sources of each built story (`robots`, v185; `qubits` ... `soil`, v186; `micro`, `topo`,
  `nmd`, `lbi`, `pass`, v187), each with a `README.md` and most with a `SPEC.md` (`docs/agents/stories.md`); a shared
  set is read from its owner's `src/` (`'../../packages/lbi/src/sets/body'`); the tutorial's script is checked by
  `node packages/tutorial/src/test-script.mjs`. `tools/design/` the design room's.
- `tools/studio/` - the sources of `stories/studio.js`: engine parts, sets, `vendor/` (never edited), the build,
  `scan.mjs`, `convert.mjs`, the test scenes, `r2sync.mjs`, `push.mjs`, `ik.js` (`docs/agents/studio.md`).
- `basis/` - Basis Universal's KTX2 encoder and transcoder (v151, the studio's), copied unchanged (`basis/README.md`).
- `tools/studio/xp/` - the Bliss XP room's generator; `examples/` - example scenes that ship with the app
  (`examples/bliss-xp` generated, never edited by hand).
- `tools/lowpoly/` - the miniatures' sources (`models-a.js`, `models-b.js`, each under 1,200 triangles, `tris` exact),
  harnesses and `build.mjs`.
- `packages/` - story packages, a story in one folder each (`packages/<key>/`: `story.json`, `main.js`, `icon.png`, its
  files), listed in `packages/index.json`; `tools/packages/` their `SPEC.md` (the contract), `scan.mjs` (writes the
  index; `--check`), `check.mjs` (a package's rules; `--load`) and `template/` (a package's `src/`); `packages/hello/` the
  example (hidden: `#hello`) (`docs/agents/packages.md`). The app's own stories are moving into packages (v185,
  `docs/packages-migration.md`): `packages/order.json` (hand-written) is the Stories screen's order of every story,
  moved or not; `tools/packages/move.mjs <key>` moves a built story; `tools/stories.mjs` is how every tool finds a
  story's file, sources and narration; *Take all stories* (`HOST.offline`, `sw.js` `takeAll`) takes them for offline.

## Detail files (read the one you need, when you need it)

| File | Covers | Read it before |
| --- | --- | --- |
| `docs/agents/layout.md` | every file and folder in full | adding, moving or looking for a file |
| `docs/agents/shell.md` | how the shell and stories fit together: loading, controllers after standby, the headset Stories screen, the address and history, Repeat, slideshow, placement and anchors, the headset settings (labels, cards, free moving, subtitles, frame rate, refresh rate, automatic quality, menu sharing, moving with the sticks), focus mode, phones and tablets, panels per story, developer mode, sound and sound effects, real-world occlusion, the developer notebook, spaceships, hot reload and live updates, inside a story (`LOAD`, `CH`, `NARRATION_SYNC`, framing) | touching `index.html`, `sfx.js`, `occlusion.js`, `notes.js`, `ships.js`, `sw.js`, sound, headset settings or a story's frame, load or panel code |
| `docs/agents/shared-rooms.md` | shared rooms in full: the room's keys and `FORMAT`, All stories and lobby circles, the room's arc, relay, peer to peer and on-device rooms, room names, rooms on this network, alignment (shared space, floor spots, room setup guide, check by eye, Touch the spot, areas, places), camera mode, the desktop preview camera, the output page (MIDI and OSC), stations, cards, icons, locks, the headset menu and its tabs, others' moves smoothed, the relay (public hosting, password, scenes on disk and in R2, updating a room), the hooks every story keeps, what each story shares; the PC's Vive trackers | touching `shared.js`, `relay/`, a story's `collab` hooks or `state()`, `tools/trackers/` |
| `docs/agents/studio.md` | the studio: scenes, models and the GLB converter, textures, uploads, Fewer triangles, the viewer, `layout.json`, trigger cubes, sounds, cut-outs, groups, shapes, behaviours, walls, motions, recorded paths, ghosts, timelines, screens, paintings, sequences, press and hover, the room scan, examples and the Bliss XP room, editing, saving, placement, performance, props and characters on trackers, and the parked glTF round trips (Blender, Unity: nice to have) | touching `tools/studio/`, `examples/` or the relay's scenes |
| `docs/agents/packages.md` | story packages: the folder, `story.json`, the index and its scan, the shell's loading (`HOST.packages`, `HOST.pkgUrl`, refusals, the cards, developer mode, `HOST.live`), the service worker's cache, the relay, shared rooms (*Not on this device*), the rules | touching `packages/`, `tools/packages/`, or the shell's loading of a package |
| `docs/agents/stories.md` | how the built stories are made from `tools/<key>/` (kit, sets, build budget, `keepClear`, life size) and each one's sets, data, permissions, explore tabs, headset and room behaviour, spelling | touching any story or its `tools/<key>/` sources |
| `docs/agents/testing.md` | every suite, every smoke block (`### smoke: <block>`) and collab round (`### collab.mjs --<flag>`) and what it checks, the tools, useful URL hashes | running or changing a test, or judging what a change needs |
| `docs/history.md` | version history and the owner's words behind the rules, by area; the `FORMAT` history | wondering why a rule is as it is |

New features document themselves in the matching detail file (and the tool's `SPEC.md` where there is one); this file
gets at most a line per feature and stays under 70 KB.

## The app in brief

- `HOST.start(key)` loads `packages/<key>/main.js` (`HOST.load`; the design room and the studio `stories/<key>.js`),
  disposes the old story, removes every listener it added and runs the new factory (`HOST.run`); `HOST.swap(key)` does the same in place, keeping its place. A VR/AR session
  survives a change of story: the new story calls `xrAdopt()` to take over the session, `HOST.inputs` and `HOST.xrPose`.
- A story builds in steps (`LOAD`, `HOST.progress`), tells its chapters in `CH` on story time, follows its narration
  (`NARRATION_SYNC`, `HOST.audio.narration`), and then opens explore mode (`X`, `render*` and `draw*` twins).
- In a headset each story hangs its Stories screen, story panel and scene on one frame, `GL.rig`, set from your head or
  from an anchor (`HOST.anchor`). The shell owns the menu, the subtitles, the settings, sound, occlusion and the
  spaceships.
- In a shared room (`#s=XYZ`) the relay, a peer-to-peer host or this device holds the room's keys: stations
  (`st.<id>`), their clock, state, place, panel and view, and room-wide keys (`look`, `lock`, `trk`, `name` ...). A
  headset runs the station whose circle it walked into (or entered by *Go in*); pages follow one from the Shared
  dialog. The shell publishes play, pause, jumps, mode changes and `collab.state()`; stories send only effects.
- People in a headset are drawn as whole bodies (v164, `bodies.js`: posed from their head and grips by `ik.js`, all in one
  draw; *Bodies: off* gives heads and hands); *My body* (off by default) draws your own in VR.
- The design room (`#design`) and the studio (`#studio`) are pages in `STORY_EXTRA`, built like stories, placed in a
  room as stations but never by Arrange all.
- A studio object's clip may follow the distance it covers (*As it moves*, v164: `docs/agents/studio.md`).
- A story's copy on the relay (v170, `HOST.arrange`): *Copy to relay* (developer mode), `#<key>&arr=<name>[&edit]`, the
  editor drawer, a station's `st.<id>.arr`; the contract `tools/engine/SPEC.md`, the shell's side `docs/agents/shell.md`.
- Sharp text (v174; on by default in Quest Browser since v175/v176, *layer*; the menu too, v177): the story's two panels
  and the headset menu as WebXR quad layers, drawn by the headset's compositor at the display's resolution (the Debug
  tab, `#sharp=`; `docs/agents/shell.md`).
- Run logs (developer mode, *Record a run* on the Debug tab or `#runBtn`): frame times a row a second to the relay's
  `/api/logs`, read with `node tools/notes/notes.mjs perf <id>` (`tools/notes/SPEC.md`, "Run logs").
- Talk (v178, relay rooms only): voice between the people in a room who are elsewhere, through the relay (binary frames,
  tag 2; Opus via WebCodecs); per device, off by default, open mic with a voice gate and a *Mic* row (the Shared dialog,
  the menu's Circles tab, the phone sheet), no button taken; people both `here` never hear each other through it
  (`docs/agents/shared-rooms.md` "Talk").
- Releases: bump `VERSION` in `sw.js`, run `node tools/release.mjs`, rewrite `whatsnew.json`; running pages follow
  `version.json` (`HOST.live`). The main site is GitHub Pages from `main` (`https://stories.lbi-netmed.com/`); branch
  `dev` is the test place on the owner's Coolify (`https://stories.lab.lbi-netmed.com/`), and `main` also runs there as
  the main site's relay (`https://main.lab.lbi-netmed.com/`). Work goes to `dev` first, then `main` once the owner has
  tried it.

## Rules every change must keep

The detail files hold the reasons and the exact lines; these are the rules that must never be broken.

### The shell and stories

- Stories create the renderer only with `HOST.makeRenderer(...)`, never `new THREE.WebGLRenderer`.
- Stories never navigate the page. From inside a story switch with `HOST.go(key)` (deferred), not `HOST.start`.
- Listeners the shell, `shared.js` or three.js add for themselves (XR sessions, `RTCPeerConnection` and
  `RTCDataChannel`, new audio contexts, `webglcontext*`) are added with `HOST.quiet` set, or a story change removes them.
- Every pane exists twice, HTML (`render*`) and canvas (`draw*`): keep both in step.
- A load step never runs long: a headset draws the loading card only between steps. Stories whose sets build between
  frames share one build budget a frame (`BUILD`, `buildTurn`).
- A set's `update` depends only on its params and the time, so seeking works (the live simulations, the flock, the
  robots and the pass story's fish, excepted); step params are never eased.
- Never let the page and its story files come from different versions; a swap in a headset session waits for a quiet
  moment.
- `dispose()` clears the story's timers.
- Story code never moves `GL.rig` past `HOST.anchor`: check `HOST.anchor.held()` before re-placing and
  `HOST.anchor.locked(kind)` before letting the grip move anything. Moving with the sticks is the shell's: stories wait
  on `xrWalking()`. No story reads A or X (`buttons[4]`): it is the spaceship's boost.
- In a headset no close view brings a `keepClear` set nearer than 0.35 m to the head; the life-size stories never move
  `GL.rig` and the grip moves only their panel (the pass story: the school's holder, `XR.lifeOff`).
- The headset settings (labels, cards, free moving, subtitles, the two sound switches, panels, frame rate, refresh rate,
  automatic quality, occlusion, moving with the sticks, menu sharing, my body, bodies, talk) are the shell's or the device's: never in a
  story's `state()` or `collab.state()`.
- Real-world occlusion never pauses depth sensing in an AR session.

### Sound

- Sound belongs to the shell (`HOST.audio`): stories never create or close an `AudioContext`. The one exception is the
  studio's `OfflineAudioContext` in `monoWav` (no output, it plays nothing); keep it the only one.
- Keep both audio engines, the hum and the watchdog. Sound effects play only through `HOST.audio.fx()`.
- Only the flock and the pass story have a background, and `vacuum` is the only continuous sound: never bring back hums
  or other backgrounds unasked (the owner's rule).
- Never put a sound in `collab.state()`. Keep the sound-effect lines (`sfxCue`, `sfxHold`, `sfxAct`, `sfxLive`) the
  same in every story, the design room and the studio.
- The studio's emitters follow only the Sound button (this device's mute), never the Sound effects or Narration
  switches.
- After a synthetically narrated story's text changes, run `node tools/voice/narrate.mjs <key>` (not `tools/pace.mjs`)
  and `node tools/voice/check.mjs <key>`.

### Shared rooms

- Bump `FORMAT` in `shared.js` whenever the room's keys or any story's `collab.state()` change shape; a room refuses
  another format.
- `state()` is plain JSON of outcomes only: never the camera, hover, open menus, typed text, timers, page layout,
  anything random or per device (the pass story's language, slideshow, panels mode among them).
- `apply(state())` gives the same `state()` back (echoes are suppressed by value); `apply()` checks every field,
  ignores unknown ones and never publishes.
- A story never publishes anything itself except effects; effects are ephemeral (`e.<station>`) and their data means
  the same on every device.
- Keep the shared hooks identical in every story, the design room and the studio (the `collab` object, the ray
  and press lines, the grip line, `xrRoomOnly`, `xrAway`, `xrCards`, `xrAllHere`, `xrWalking`, `xrIdle`, Recenter,
  `caption`, `panels`).
- Every write of a move by hand carries `ts` (and `h: 1` while held); every comparison of such a value leaves `ts` and
  `h` out; `setView(v, now)` keeps the same lines in every story.
- The relay's password never goes into a log line, link, address, room key or file; it is kept per relay origin in
  `localStorage` `relayTokens`.
- Tests never use PeerJS's public server: peer to peer is tested only through the relay's own `/peerjs`.
- A new file the app needs goes into `sw.js` `SHELL` and into `relay/server.mjs` `APP_FILES` or `APP_DIRS`.

### Built files and data

- Never edit a built file by hand: edit its sources and rebuild, and commit both (`--check` says when they are out of
  step). Built: `stories/design.js`, `studio.js` (each `node tools/<key>/build.mjs`), a built story's
  `packages/<key>/main.js` (`node packages/<key>/src/build.mjs`, then `node tools/packages/scan.mjs`; airports, proteins
  and spatial are hand-written: their `main.js` is the source),
  `lowpoly.js` (`node tools/lowpoly/build.mjs`), `examples/bliss-xp` (`node tools/studio/xp/make.mjs`),
  `docs/narration.md` (`tools/narration.mjs`), `version.json` (`tools/release.mjs`).
- Rebuild the dependants after a shared source changes (`node tools/engine/all.mjs` builds them all; the relay's
  `--build` the readers of a changed `packages/<key>/src/` file): `packages/lbi/src/sets/body.js` (pet, micro, ovary,
  topo), `packages/lbi/src/sets/tissue.js` (micro), `packages/micro/src/sets/organs.js` (pet, micro, topo),
  `packages/nmd/src/sets/motor.js` and `sets/data.js` (endo), `packages/topo/src/sets/look.js` and
  `packages/lbi/src/sets/web.js` (soil), `tools/engine/kit.js` (every built story and the studio), `tools/engine/*.js`
  (the shared engine parts: every built story but the studio), `packages/airports/main.js` and
  `packages/spatial/main.js` (pass), `tools/design/props.json` or a miniature's name (design).
- Never edit `tools/studio/vendor/` (three.js r128's own add-ons and meshoptimizer, pasted unchanged).
- Generated data files (`packages/*/src/sets/data.js`) are never edited by hand; the authors' source files never go into the
  repository, only derived numbers.
- The owner's own scene files (models, textures, sounds, layouts) never go into the repository, not even as tests: they
  stay in the relay's `--scenes` folder or the git-ignored `tools/studio/test/local/`.
- Keep `examples/bliss-xp` our own: no frames, people, logos, the real system's sounds or lyrics.

### Science and wording

- Never show patient or variant data (the muscle story: nothing about zebrafish either); no GTEx ids, donor details or
  images, no poster pictures (figures are redrawn in 3D).
- The tissue topology and soil stories compute nothing scientific in the app: they look numbers up in `TOPO_DATA`
  through `TDATA` and in `SOIL_DATA` through `SDATA`.
- Soil: never call a link an interaction or a hub a keystone, never say the wheat changes the microbiome or that the
  line changes nothing; keep the hedges and the illustrative labels.
- Mutation: the coupling is our stand-in and says so; never call the circuit better or more accurate; the poster's
  numbers only as "in the authors' test". Qubits: example networks only, computed live by `QMATH`; the real run's
  numbers only as "in the real network".
- The qubits and aging ovary stories use American spelling; every other story British. The pass story is in English
  and German, every string in both; its language is per device; never change `packages/airports/main.js` or
  `packages/spatial/main.js` for its sake.
- No 2D charts as chapters (the owner's rule); the ovary story draws no trend, comparison or score charts. In the ovary
  story one model fades out before the next comes in, and a set writes no depth while it fades (`fadeDepth`).

### The studio

- At a station the scene's frame is the room's: moving or turning a studio circle never moves the scene.
- Motions, paths, behaviours and trackers draw through the pose pipeline; an item's record never changes while it
  moves.
- Nothing see-through while editing: every editing look is opaque lines, small opaque meshes and opaque tags.
- Trigger cubes are each person's own unless `all: true`; what they reveal is never in `state()` or sent. The one
  exception (the owner, 16 November 2026): only for a cube opted in to send (its record has `send` entries), the fact that
  a person walked into it or out of it goes to the room as the ephemeral effect `send` from that person's device; what the
  cube shows, hides, changes or starts for them stays their own. Pointing at an item whose press has `hover`/`unhover`
  sends is sent likewise; nothing else of pointing is.
- A sequence's play state (`qr.<id>`), a press stamp (`pr.<id>`) and a screen's `play` are never in `layout.json` or
  Undo.
- Locked items refuse every move, size and delete; a copy is never locked; the room's records and Undo are never
  refused.
- Editing, Upload and conversion are never offered with `&visit`. Convert to GLB and adding textures are page only (a
  headset says *Convert on a laptop*), except the saves of Fewer triangles and Change texture.

### Reporting

- Report anything only a device can show (controllers, placement, comfort, shared spaces, calibration, anchors,
  trackers, sound zones, occlusion, ships, the studio's grips, sticks and emitters, frame rate) as untested until tried
  there, and how sounds and voices sound as unheard.

## Conventions

- Match the surrounding style: 2-space indent, single quotes, semicolons,
  compact one-line helpers, short comments that say why. No frameworks or
  bundlers; do not add dependencies.
- Writing in the UI is plain British English, short sentences, no jargon
  without a gloss (the qubits story uses American spelling, as its author asked, and so does the aging ovary story, as the owner asked; the pass story is in English and German, see its section). Numbers shown in the story are computed from the data at
  load time, not hard-coded, wherever possible.
- A story's speech sounds like a human scientist speaking to a general audience (the owner, 23 November 2026): one
  speaker, "we" and "you", short spoken sentences, one running image, round numbers, no headings or small print read
  out. The voice has its own words (`data-say` on a line; the headset's subtitles show them); the panel keeps the key
  points and the exact numbers. New and re-recorded narrations follow this (`tools/voice/README.md`, "The script").
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

- Windows: `.gitattributes` (`* text=auto eol=lf`) checks every text file out with LF whatever `core.autocrlf` says,
  since the builds' and `tools/release.mjs`'s `--check` compare bytes (a CRLF checkout failed them). A checkout whose
  files are still CRLF, once, on a clean tree: `git rm --cached -r -q .`, then `git reset --hard`. A tool finds its own
  folder with `fileURLToPath(import.meta.url)`, never `new URL(import.meta.url).pathname` (`C:\C:\...` on Windows):
  `docs/agents/testing.md`, "Windows".
- Bump `VERSION` in `sw.js` whenever any app file changes, or installed copies
  (and headsets) keep serving the old cache. If you add a file the app needs,
  also add it to `SHELL` (story files and narrations excepted: `tools/release.mjs` writes those from `stories/list.js`
  and `audio/`; a package's files are its own, in `packages/`), and to `APP_FILES` (or `APP_DIRS`) in
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
  while it names another release ("Developer mode" in `docs/agents/shell.md`).
- Never let the page and its story files come from different versions: a new
  `index.html` with an old story file looks fine but misbehaves (Repeat ended
  in explore mode because the old story never called `HOST.ended()`). Hosts
  such as GitHub Pages let browsers keep files for ten minutes, so the service
  worker revalidates every app file, and when an update takes over a running
  page, `HOST.live` asks `version.json` what changed: a new shell is asked
  about, and taken by itself at the next quiet moment (`HOST.reloadIfUpdated`:
  on the Stories screen, not in a headset); a story needing a newer shell is
  never swapped in. After changing `sw.js`, run `tools/update.mjs`.
- Story chapter timings are also documented in `audio/PUT-narration.mp3-HERE.txt` (the narrations themselves are in
  `packages/<key>/audio/` since v187).
- After changing anything in a built story's `packages/<key>/src/`, rebuild it (`node packages/<key>/src/build.mjs`,
  then `node tools/packages/scan.mjs`) and its readers ("Rebuild the dependants" above; `node tools/engine/all.mjs`
  builds every one), and bump `VERSION`; after changing a hand-written `packages/<key>/main.js` (airports, proteins,
  spatial), the scan (and the pass story's build for airports and spatial). Its data first where it has a generator
  (`packages/nmd/src/data/gen_data.mjs <the authors' folder>`, `packages/ovary/src/data/gen_data.mjs`, the topo and soil
  stories' `data/gen_data.py`, only from the authors' files), and its own test after its maths, data or sets
  (`packages/qubits/src/test-qmath.mjs`, `mutation/src/test-mmath.mjs`, `topo/src/test-data.mjs`,
  `soil/src/test-data.mjs`, `pass/src/test-sets.mjs`, `tutorial/src/test-script.mjs`).
- Rebuild `stories/design.js` after changing `tools/design/` (also after changing `tools/design/props.json` or a miniature's name), and
  `tools/lowpoly/` and `lowpoly.js` (`node tools/lowpoly/build.mjs`; keep each miniature under 1,200 triangles and its
  `tris` exact: the harnesses mark a wrong count in red). And `tools/studio/` and `stories/studio.js` (also after
  changing `tools/engine/kit.js`; never edit `tools/studio/vendor/`, three.js r128's own files); after changing the test
  scene's maker, `node tools/studio/test/make.mjs` (it runs `scan.mjs` too; `node tools/studio/scan.mjs
  tools/studio/test/scenes --check` says whether its listings are current). A new page in `STORY_EXTRA` needs its icon
  in `tools/lowpoly/` and its key in `ICONS` in `tools/design/build.mjs` (an icon, not a prop), as the studio has.
- The owner's own scenes (models, textures, sounds, layouts: the atelier scan, the rigged figure, `first_room.mp3`)
  never go into the repository: they live in the relay's `--scenes` folder outside it, or for local checks in
  `tools/studio/test/local/` (git-ignored). The only scene committed is the generated test scene.
- Keep `README.txt` (user-facing notes) in sync with structural changes.
- Shared rooms: bump `FORMAT` in `shared.js` when the keys or a story's
  `collab.state()` change shape (a room refuses another format). A story's
  hooks (see `docs/agents/shared-rooms.md`) must stay in step with its pointer code.
- Several handlers run inside the old story's call stack when switching;
  use `HOST.go(key)` (deferred) from inside a story, not `HOST.start`.


## Testing

There is no unit-test suite. What each command checks, block by block, is `docs/agents/testing.md`.

When the suites run (the owner's rule: only when pushing to `main`): every suite a change touches runs before `main`
moves, the smoke test always. A push to `dev` gets only the cheap checks: `node --check` on the changed files, the
builds' `--check`, `node tools/packages/scan.mjs --check` and `node tools/release.mjs --check`; a red result there is not chased. Running is free (CPU);
chasing red results costs tokens, and most were the tests' own or the machine's.

- Serve the folder, then smoke: `npx http-server -p 8123 -c-1 .` (or `python3 -m http.server 8123`), then
  `node tools/smoke.mjs http://127.0.0.1:8123/`. It needs Playwright with Chromium (`npm i --no-save playwright`,
  `npx playwright install chromium`). WebGL runs in SwiftShader headlessly, so frame rates are low. A 404 for a missing
  narration MP3 is expected; any other console error fails it.
- `--only <words>` runs the blocks whose names start with the words, for a builder's own steps; the release run is the
  whole test. Blocks: `'away idle'`, `uploads`, `'stick moving'`, `spaceship`, `'frame rate'`, `'sharp text'`, `'developer mode'`,
  `'update the room'`, `'phone ar'`, `'controllers after standby'`, `trackers`, `bodies`, `'auto quality'`, `'focus mode'`,
  `phones`, `tablets`, `iPhone`, `design`, `talk`, `studio`, and `'studio <block>'` (textures, follow, cuts, groups, faces,
  tint, viewer, shapes, behaviours, motions, paths, walks, recorder, texture swaps, cube starts, cube switches, edit speed, everyone,
  walls, shows, screens (needs `ffmpeg`), paint, examples, trackers, puppet, sequences, press, sends, colour, xp).
- Every test page sets `collabAutoAll`, `collabAutoWelcome` and `tutorialHold` to `off` and `collabAskDefault` to `walk` unless its
  round asks otherwise: keep that when adding a round.

| Command | When |
| --- | --- |
| `node tools/audio.mjs http://127.0.0.1:8123/` | after touching sound |
| `node tools/sfx-cues.mjs <url> <key\|all>`, then `node tools/sfx-render.mjs <url> <out> [--story <key>]` | after changing a story's cues or a sound (report how it sounds as unheard) |
| `node tools/live.mjs` | after touching `HOST.live`, `HOST.swap`, `HOST.load`, `tools/release.mjs` or the relay's `--watch` |
| `git worktree add /tmp/old <commit> && node tools/update.mjs /tmp/old .` | after changing `sw.js` or how files load |
| `node relay/test.mjs` (`--trackers`, `--rooms`, `--notes`, `--video`, `--osc`, `--talk` for parts) | after touching `shared.js`, the relay or a story's hooks |
| `node tools/collab.mjs` (about 15 min; `--quick`, or one round: `--code`, `--all`, `--guide`, `--places`, `--areas`, `--reload [--cases 2,5]`, `--p2p`, `--near`, `--names`, `--standby`, `--narration`, `--walk`, `--ships`, `--camera`, `--preview`, `--design`, `--token`, `--arr` and `--talk` (not in the main run), `--studio`, `--studio-scenes`, `--home`, `--behave`, `--trackers`, `--output`, `--follow`, `--circles`, `--ask`, `--menus` (`MENUS_STORY=studio`), `--smooth`; `--shots <dir>` saves pictures) | after touching `shared.js`, the relay, a story's hooks or `state()` (`--smooth` after touching `setView` or smoothing; `--studio` after the relay's scenes or uploads). A new story needs an entry in `STORIES` there; `HEADSET_STORY` stays the last entry |
| `node tools/output/test-page.mjs` | after touching `output.js` or the output page's part of `shared.js` (Web MIDI and the studio stubbed; `tools/collab.mjs --output` is the end-to-end round with the relay's OSC) |
| `node tools/peer.mjs` | links two `p2p/` pages through `/peerjs` |
| `node tools/room-test.mjs` | after changing `room-test/` |
| `node tools/perf.mjs [url] [--only words] [--json f] [--md f] [--frames N] [--list]`, `--from a.json,b.json --md r.md` | measuring, not a test (exits 0; no GPU time; reads `FPS_FAKE` and `OCCL_FAKE` out of `tools/smoke.mjs`, so do not rename them) |
| `tools/<story>/shot.mjs`, then `sweep.mjs` | a changed set: its harness first, then the story, then the smoke test |
| `node packages/qubits/src/test-qmath.mjs`, `packages/mutation/src/test-mmath.mjs`, `packages/topo/src/test-data.mjs`, `packages/soil/src/test-data.mjs`, `packages/pass/src/test-sets.mjs` | after changing that story's maths, data or sets |
| `node tools/studio/scan.mjs tools/studio/test/scenes --check` | after changing the test scene's maker (`node tools/studio/test/make.mjs` first) |
| `node tools/studio/xp/make.mjs --check` | after changing `tools/studio/xp/` |
| `node tools/studio/convert.mjs <model> [out.glb] [--max-texture N] [--no-weld] [--keep 0.2] [--no-fill] [--textures dir] [--texture a=b] [--shots dir]` | the converter and its test on real files |
| `node tools/studio/test-images.mjs` | after changing `tools/studio/engine/images.js` or `test/pictures.mjs` |
| `node tools/packages/check.mjs packages/<key> --load` | after changing a package or `tools/packages/template/` (build it first: `node packages/<key>/src/build.mjs`) |
| `node tools/studio/test-ik.mjs` | after changing `ik.js` (the studio's puppet and people's bodies) or the puppet in `test/make.mjs` |

Real-headset behaviour (controllers, session hand-over between stories, placement, comfort, sound) can only be
confirmed on a device: say so when you report results.

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
- **Keep sources small and in the repository.** Edit `packages/lbi/src/` sources, not
  the 700 KB built file; keep generators and manifests so nothing has to be
  rediscovered.


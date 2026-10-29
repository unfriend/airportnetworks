# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What this is

An installable web app that teaches network science in fifteen narrated stories
(the airports about four minutes, the proteins and the cell map about five, the tour about nine and a half, the muscle
story about eight, the endotype story about seven, the PET story about six, the microanatomy story about seven
and a half, the ovary story about seven, the qubits story about nine, the mutation story about eight and a half, the tissue topology story about eight, the pass story about seven, the flock and the robot gang about two), each
followed by an explore mode. Everything works on desktop, phones and in VR/AR headsets (built for Meta
Quest Browser, WebXR).

| Story | File | Network |
| --- | --- | --- |
| Network theory | `stories/airports.js` | 3,214 airports, 18,858 routes on a globe |
| Network medicine | `stories/proteins.js` | 254 curated proteins, 375 interactions in a cell |
| Spatial interactome | `stories/spatial.js` | 249 proteins in 13 compartments of a model cell |
| LBI Network Medicine tour | `stories/lbi.js` | ten 3D scenes, from a protein machine and an illustrative interactome to organs and tissue |
| Rare muscle diseases | `stories/nmd.js` | 1,182 genes of 13 neuromuscular disease groups in a tower of 71 layers (real data in `ikerdata/`), the motor unit, a supercomputer |
| Disease endotypes | `stories/endo.js` | one neuromuscular junction close up; the 35 genes of congenital myasthenic syndromes in the authors' protein network (18,306 proteins), their module of 393 genes and 12 endotypes (EndotypY), the motor unit |
| Whole-body PET | `stories/pet.js` | a PET/CT scanner and how it sees; the organs of the paper's 658 whole-body scans (Geist et al., Med 2025) and their partial correlation networks (printed and read off its figures), from health to disease; the tour's PET body |
| Tissue microanatomy | `stories/micro.js` | the tour's H&E section and the domains a method finds in it; 24,945 GTEx slides of 40 tissues (Buljan, Bago-Horvath, Rendeiro, bioRxiv 2025); the network of organ architecture (29 organs, tissues, 10 tissue types, 70 domains, Iva Buljan's file); which domains change with age, pathology, and the contacts between domains |
| Ovarian aging | `stories/ovary.js` | the tour's body and a drawn cut-away ovary that ages; 255 GTEx donors aged 20 to 70 (Chakraborty, Moustafa, Rendeiro, poster); a drawn H&E section with blood vessels, macrophages, corpora albicantia and follicles (14,941 marked by hand), tiles with UNI2 features and a random forest, SegFormer's masks and their scores as tags on the section; the poster's trends with age told on the ovary as it ages (each method's count on its lines as tags; r and p in words) and the methods' agreement; an illustrative spatial neighbor network that tips up off the section and gathers into hubs by kind |
| Quantum network compression | `stories/qubits.js` | example gene networks (320 genes in 8 hidden groups, at three strengths of mixing, and a random one) cut into 8 cells on 3 qubits; the coarse operator A_c on a cube, its Pauli strings, the toolbox (a Lie algebra, so(6) or so(7)) and what it drops; the real run's residual by depth and its 3-qubit circuit (Joel Hancock's method and figures) |
| Quantum phylogenetics | `stories/mutation.js` | a text in four letters copied with swaps; a family tree in 3D (8 tips, 14 branches, every swap simulated) you walk round and look up into; a letter's two qubits and their read-outs; a rule of change (three example substitution models) as balls and arrows and a path through the pyramid of mixes; the machine for one branch (copy and turn), its circuit, one machine per branch; an RNA stem, its pairs and their coupling; the ancestor of three species rebuilt 2,000 times three ways (Enes Berk Sakalli and Arndt von Haeseler's poster; example numbers computed live, the poster's only as the authors' test) |
| Tissue topology | `stories/topo.js` | 110 real cells of a healthy liver (the poster's patch) with balls growing round them, the network with triangles, pieces joining and loops opening and closing, and the tower of scales; 123 GTEx liver slides (66 healthy, 57 with cirrhosis, 30.8 million cells found by HistoPLUS), their curves, main shapes, scores, a classifier's wall, its held-out test and its weight for every radius; a new slide's window of 6,716 cells, every cell scored, the two groups and their cell types (Simon Schindler, André Rendeiro and Jörg Menche's poster; every number computed by their package topocyte on their data) |
| Networks for everyone (outreach; English and German) | `stories/pass.js` | a school of fish (300, a live simulation) all around you, each watching its 7 nearest neighbours; the airports story's globe (3,214 airports, 18,858 routes, taken unchanged) with a seeded S/E/I/R outbreak on its routes; the cell map story's cell (249 proteins in 13 places, taken unchanged), its NF-κB relay and CFTR in the wrong place |
| Flock | `stories/flock.js` | 200 starlings (a live simulation) flying all around you at dusk, each following its seven nearest neighbours |
| Robot gang | `stories/robots.js` | 6 to 24 robot vacuums (a live simulation) in a model living room, or in a headset your own room; who follows whom (you, or the one ahead) is the network |

No build step, no framework, no package.json. Plain HTML/JS plus
`three.min.js` (three.js r128, vendored, MIT) and `peerjs.min.js` (PeerJS 1.5.5,
vendored, MIT, loaded only when a shared room runs peer to peer). The app is deployed by copying
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
  are not stories (the design room), with the same fields: `HOST.meta(key)`
  finds a key in either list (start, load, swap, title), while everything that
  lists the stories sees only `STORY_LIST`.
- `lowpoly.js` - the low-poly miniatures of every story's sets
  (`LOWPOLY_MODELS`), generated by `tools/lowpoly/build.mjs` from
  `tools/lowpoly/models-a.js` and `models-b.js` (never edit it by hand);
  loaded once by `HOST.lowpoly()` (the design room's table, the stations' icons).
- `version.json` - the latest release, for live updates: written by
  `tools/release.mjs`, never by hand, never cached.
- `stories/<key>.js` - one story each, wrapped in
  `HOST.register('<key>', function (HOST) { ... })`. Everything a story
  defines is local to that function. Each returns
  `{ inputs, caption, xrPose, collab, peek, dispose }` to the shell (`collab`: its
  shared-room hooks, see "Shared rooms"; `caption`: its line on show, for the
  headset's subtitles).
- `proteins.html`, `spatial.html` - redirect stubs to `index.html#proteins`
  / `#spatial` so old links keep working. Do not put code there.
- `sw.js` - service worker. Pages and app files come from the network first,
  checked with the server each time (`cache: 'no-cache'`), so the page and its
  story files are always the same version; the cache is the offline copy (and
  the answer when the network takes more than 4 s). The narration MP3s are
  served from the cache (with byte ranges). Installing fetches straight from
  the server (`cache: 'reload'`).
- `audio/` - optional narration MP3s (`narration.mp3` for the airports,
  `narration-<key>.mp3` for the others, such as `narration-lbi.mp3`);
  missing files are fine.
- `manifest.webmanifest`, `icons/` - PWA install metadata.
- `shared.js` - the shell's shared-room client (`HOST.collab`, `HOST.room`; it plays
  the relay's part itself for a room on this device and, as a peer-to-peer room's
  host, for everyone in it), loaded by `index.html` between its two scripts (see
  "Shared rooms" below).
- `peerjs.min.js` (PeerJS 1.5.5, MIT, licence in `PEERJS-LICENSE.txt`) - the
  links of a peer-to-peer room, loaded by `shared.js` only then. `p2p/` - a test
  page (not part of the app) for checking a network before an event: do two
  devices link directly, how fast, and inside VR or AR (`&peer=` picks another
  introduction server).
- `relay/` - the shared rooms' server (`server.mjs`, Node, no packages; it can serve
  the app too, and `--lan` makes it an HTTPS server for the headsets on one
  Wi-Fi that keeps their alignment logs in `relay/logs/`), its test (`test.mjs`)
  and Dockerfile; see its `README.md`. It is also an introduction server for peer
  to peer at `/peerjs` (PeerJS's server protocol; `--no-peer` turns it off), for
  the tests and for an event that wants its own.
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
- `tools/smoke.mjs` - headless smoke test; `tools/audio.mjs` - narration test;
  `tools/update.mjs` - update test for the service worker; `tools/live.mjs` -
  hot reload and live updates test; `tools/release.mjs` - writes `version.json`
  (a release step); `tools/collab.mjs` -
  shared rooms test (see Testing); `tools/narration.mjs` - writes
  `docs/narration.md` from the running stories; `tools/pace.mjs` - writes the
  `NARRATION_SYNC` that paces a story without a recording (see "Inside a story").
- `tools/voice/` - a synthetic narration (Kokoro-82M through kokoro-onnx; the model, its Python and the spoken lines
  stay outside the repository, see its `README.md`): `node tools/voice/narrate.mjs <key>` speaks a story's lines (how
  each word is said: `say.json`), lays them out and writes `audio/narration-<key>.mp3`, `NARRATION_SYNC` and
  `NARRATION_ENDS`; `node tools/voice/check.mjs <key>` checks the result in a browser. The tour's narration is made
  so (the American voice `af_heart`, the owner's choice, 29 October 2026).
- `tools/nmd/` - the sources of `stories/nmd.js` (data generator, data block, sets,
  engine parts, build script, set harness; it uses `tools/lbi/kit.js`); see its
  `README.md`. `ikerdata/` holds the authors' analysis files it reads.
- `tools/endo/` - the sources of `stories/endo.js` (data generator, data block, sets,
  engine parts adapted from the muscle story's, build script, set harness; it uses
  `tools/lbi/kit.js` and the muscle story's motor set); see its `README.md` and `SPEC.md`.
- `tools/pet/` - the sources of `stories/pet.js` (data generator and the figures' readings, data block, organ
  icons, sets, engine parts adapted from the endotype story's, build script, set harness; it uses `tools/lbi/kit.js`
  and the tour's body set); see its `README.md` and `SPEC.md`.
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
- `tools/lowpoly/` - the miniatures (`models-a.js`, `models-b.js`: each
  `LOWPOLY_MODELS['<story>.<set>'] = { story, set, name, shows, tris, build(THREE) }`,
  under 1,200 triangles, `tris` exact; 45 props and, last, the design room's own
  `design.table`, only its station icon), their harnesses (`harness-a.html`,
  `harness-b.html`) and `build.mjs` (writes `lowpoly.js`; `--check`).

## How the shell and stories fit together

- `HOST.list` comes from `stories/list.js` (always the same array, changed in
  place when the list is read again; `HOST.listRev` counts the changes), so a
  story's code may keep it (`XR_STORIES`). Nothing in a story writes the number
  of stories in: the title and Stories screen say it in words up to twenty
  (`HOST.count()`; the headsets' `drawLandHead` the same), and the headset
  Stories screen spaces its cards from the number (`xrLandingCards`, built
  again when `HOST.listRev` moves on). A story the list does not have (a shared
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
- Loading (29 October 2026, the owner: "some rooms like 'the future' take a little time to load"). A story builds in
  steps, each a task of its own (its `LOAD` queue, see "Inside a story"), and reports each with
  `HOST.progress(done, total, label)` (stories guard it, `if (HOST.progress)`, so an older shell still works). The
  page's `#loading` shows a thin bar in the story's colour (`#ldBar`, changed at most every 150 ms and only where it
  changes: each change costs the page a frame, which a slow device composites in software) and the step (`#ldStep`) under the story's
  loading line (`#ldLine`; `HOST.loading.begin(meta)` in `HOST.start`). In a headset the old story's scene is gone
  while the next one builds, so `HOST.teardown` gives the renderer the shell's loading scene as its frame loop
  (`HOST.loading`, in `index.html`, in place of the blank loop that kept the session alive): a card with the story's
  kicker, title and a bar in its colour and the step, 1.2 m in front of you and 15 cm below your eyes, easing with your
  head (upright, turned to you), and a ring with the share done on the left wrist where the menu's clock sits (a
  controller's grip or a tracked hand's wrist, placed as `shared.js` places the clock; the menu is out of the scenes
  while a story builds). Both are placed from the frame in the renderer's reference space (where three.js puts the
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
  Stories screen (see "Shared rooms").
- The address mirrors the state (`HOST.setUrl`): `#stories` while the Stories
  screen shows (page or headset), `#<key>` in a story. A `#<key>` link opens
  that story directly; no hash or `#stories` lands on the Stories screen.
- The shell talks to stories with window events `storypause` and
  `storyrestart`.
- Repeat (`HOST.repeat`: `off`, `all` or `one`; buttons on the Stories screen,
  page and headset, via `HOST.toggleRepeat`): a story that reaches its end
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
  mode (`HOST.anchor` in `index.html`; the Anchor button on the headset Stories
  screen, `#anchor=on` / `#anchor=off`; remembered as `xrAnchor` and `xrPlace`
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
  What a session asks for comes from the shell (`HOST.xr.features(mode)`, in
  every story's `xrStart`): AR asks for `local-floor`, `hand-tracking`,
  `anchors`, `plane-detection` and `mesh-detection` (the robot gang's room) and
  `shared` (the shared space), all optional; VR only for `local-floor`,
  `hand-tracking` and `anchors`, since a Quest 3 left VR for its home at once
  with the full list (October 2026; AR was fine there, and VR on a Pico) and
  started VR on the first try with these three (which of the other three was
  to blame was not tried). A VR
  session that ends within 10 s of starting, or whose page goes with it (no
  `pagehide`), makes the next one ask for less (`hand-tracking` and
  `local-floor`, then `local-floor`, then nothing; `xrSteps` in `localStorage`,
  back to the start in another browser version): Sound check says what VR asks
  for and why. Ending VR on purpose within 10 s counts too.
- Three headset settings, one for the whole system (the owner, October 2026:
  "the settings systemwide, with the default being that everything is 3D"; 29
  October: "add subtitles in the headsets as a switchable option per room"):
  `HOST.xr.labels()` (`'fixed'`, the default: labels in 3D; `'face'`: on top;
  `'hidden'`), `HOST.xr.free()` (free moving, on by default) and
  `HOST.xr.subs()` (subtitles, off by default), set with
  `HOST.xr.setLabels(m)`, `HOST.xr.setFree(on)` and `HOST.xr.setSubs(on)`,
  `HOST.xr.sig()` for panel signatures; rows in the headset's menu (*Labels: in
  3D* -> *hidden* -> *on top*, each press the next; *Moving: free* / *Moving:
  facing you*; *Subtitles: on* / *off*) and, in a room, in the page's Shared
  dialog. In a shared room they are the room's (key `look`, below), for every
  headset and page in it; otherwise the device's own (`xrLabels`, `xrFree`,
  `xrSubs` in `localStorage`), which keeps a room's last value after leaving
  it. `#labels=face|fixed|hidden`, `#free=on|off` and `#subs=on|off` in a link
  set them. Stories read the first two every frame (`xrSettings` in `xrBegin`;
  a shell without them means on top and nothing free) and put `xrSig()` in
  `sigMain`; the shell alone draws the subtitles.
  - Labels in 3D: every scene label is a flat sign at its sprite's place and
    size, upright and turned to you (about the vertical, in the rig's frame:
    `placeLabelXR` with `XR.signL` and `XR.signH`), but in the scene:
    depth-tested, so what stands in front hides it, readable from both sides.
    The two story panels (`XR.main`, the text and explore's panes, and
    `XR.foot`) stand in the scene the same way (`panelDepth`, set only when
    the mode changes: depth-tested and writing depth, drawn first of the
    see-through things at `renderOrder` -1, their clear corners cut away by
    `alphaTest` 0.1), so whatever stands in front hides them, glass and
    glowing points too, and they hide what is behind them; the pointer still
    reaches a panel first, even one partly hidden behind the scene.
    On top: sprites and both story panels over everything, as before
    (`renderOrder` 50). Hidden: no scene labels and no story panel at all,
    neither `XR.main` nor `XR.foot`, in story and explore mode (not drawn and
    not pointable); the headset Stories screen stays (never stuck), the
    shell's menu and its clock stay (to switch back), and A or X still plays
    and pauses. The Stories screen's panels, the menu, its clock and the
    shell's notes are on top in every mode. The pointer's tip (`XR.tip`) is
    always a sprite. In the shell, station cards are drawn on top (after the
    scenes, before the story's panels, depth-tested) or, in 3D, as the labels'
    signs are (`renderOrder` -1, writing depth, `alphaTest` 0.1, both faces),
    and not at all when hidden (the ring stays, pointable and grabbable);
    people's name tags are sprites, signs over the head drawn the same way,
    or nothing.
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
    of everything in every label mode (`renderOrder` 51: over the story panels,
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
- Panels per story (`HOST.panels` in `index.html`; the owner, 29 October 2026:
  "i would want that for every story as an independent per story toggle maybe
  inside the clock menu"): `'shown'` (as ever), `'controls'` (only the foot bar,
  `XR.foot`: play and pause, the chapter arrows, the clock, Next; good with
  subtitles on) or `'hidden'` (no story panel; A or X still plays and pauses).
  Each story keeps its own value, the design room too: `get(key)`,
  `set(key, v)`, `next(key)`, `sig(key)`. Outside a shared room it is the
  device's (`xrPanels` in `localStorage`, `{ key: value }`, shown left out); at a
  station in a room the station's, for everyone at that circle (key
  `st.<id>.ui`, below; a station without it: shown), whatever a device keeps of
  its own. Set in the headset's menu (a *Panels: shown* / *controls only* /
  *hidden* row for the story on show, each press the next; no row on the
  Stories screen or away from a station) and, in a room, per station in the
  page's Shared dialog; never refused by the layout lock. `#panels=shown|controls|hidden`
  in a link sets it for the story the link opens. Stories read it every frame
  in `xrUpdate` beside the labels mode (`xrPanels()`, next to `xrSig`, which
  carries `HOST.panels.sig(XR_HERE)`): labels hidden still hides both panels
  (the two are independent), and the Stories screen never changes with it.
  Not in a story's `state()`. How it feels on a headset is untested.
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories only say
  what should play. A story asks for its file with
  `AUD = HOST.audio.narration(url, { ready, error })` and calls
  `AUD.sync(playing, t)` and `t = AUD.follow(t)` every frame and `AUD.seeked()`
  after a jump; `AUD.label()` and `AUD.on()` feed the headset panels. Stories set
  `HOST.session` when they start or adopt a headset session; the shell listens
  to its controller events (`select`, `squeeze`: Chromium counts them as taps,
  `selectstart` it does not) and its visibility. Never create or close an
  `AudioContext` in a story. How it works, and why (the narration was silent on
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
  - The mute is saved under `narrationMuted2`: older versions saved a mute
    when *Play sound* was pressed in the headset. *Play sound* (and any press
    while loading) only starts the engines; it never mutes.
  - Sound check (`#soundcheck`, a button on the Stories screen; in the headset
    a panel that takes the place of the story cards, `drawSoundCheck`, and a
    page of the headset's menu, the shell's `soundPage`, so it is there in a
    shared room too) shows `HOST.audio.report()`, plays a beep through each
    engine and lets the user pick an engine (`soundEngine` in `localStorage`).
    Ask a user with sound problems on a device for those lines.
  - Listeners the shell adds while a story runs (a new context, the headset
    session) are added with `HOST.quiet` set, so story changes do not remove
    them.

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
  no reload); a shell file (`index.html`, `shared.js`, `sw.js`, `three.min.js`,
  `peerjs.min.js`) reloads the page with its place kept. `--build` also runs a
  built story's `tools/<key>/build.mjs` when its sources change (the folders its
  build names, `../lbi/` and the like, and the story files it cuts from; not
  `shots/`, `gen/`, `data/`), one build at a time, a moment after the last
  change; a failed build shows in the page's bar. A page served by a watching
  relay does not ask for `version.json`.
- **On the live site** (GitHub Pages, the relay on Coolify): `version.json`,
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
- **A shared room with an older device**: a station whose story this device's
  list does not have shows on its card and in the page's dialog as *A newer
  story*, "Update needed" (`shared.js`'s `meta` takes `HOST.unknown`), cannot be
  run here (`HOST.start` asks instead), and the question offers the update;
  Arrange all on such a device leaves that station where it is. So a new story
  no longer needs a new `FORMAT`.
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
`st.<id>.ui` (the station's panels, `{ panels, story, by, at }`: `'shown'`, `'controls'` or `'hidden'`, for every
headset at that circle; set from a headset's menu there or a page's Shared dialog, never refused by the layout lock;
absent: shown; gone with the station's other keys when it shows another story; FORMAT networks-25),
`look` (the headsets' three settings, `{ labels, free, subs, by, at }`: set by anyone,
from a page's Shared dialog or a headset's menu, never refused by the layout
lock; a room without it gives everything in 3D and no subtitles; free moving turned off takes
every `q` out of the stations' places and panels in the same write), and per shared space `rf.<space id>` (the room's frame in it) and
`rs.<space id>` (found split; FORMAT networks-9), `sg` (the room's shared-space
generation, `{ n, by, at }`), `near` (*Show on this network*, `{ on, by, at }`: absent or on, the room is listed under
*Rooms on this network*; set by anyone in the room, never refused by the layout lock) and `rid` (the room's own id, ten
letters written once by the page that made or holds it: a room joined again by itself can be told from another room
under the same code) (FORMAT networks-10; networks-11 when the eighth story came, networks-12 the ninth, networks-13 the tenth, networks-14 the eleventh, networks-15 the twelfth, networks-16 the thirteenth, networks-17 when the PET story's `state()` lost its one-scan fields, networks-18 when its liver scene came back, networks-19 when the ovary story's charts went, networks-20 when the pass story's school got a shared place at a station, networks-21 when the fourteenth story came, networks-22 when the scene's and the panel's turn joined a station's place, networks-23 when the fifteenth story came, networks-24 when subtitles joined `look`, networks-25 when `near` and `rid`
came with rooms on this network, and `st.<id>.ui` with panels per story in the same round). The plan is `docs/shared-space-plan.md`.

- `HOST.collab` keeps the room's keys (echo suppression by value, optimistic
  writes acknowledged by the relay, apply order stations > clock > state >
  panel), members, the relay's clock (ping/pong), presence (`p.<member>` at
  15 Hz) and effects (`e.<station>`); it reconnects with backoff and brings the
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
    `X-Forwarded-For`, only when started with `--proxy`. Without a relay (or one that does not answer), the public
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
    again a minute after the network was last found), with a notice (`#shToast` on a page, with *Shared* and *Leave*;
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
  one headset first and the others after "Shared space found". Every headset's
  log says its whole address (`search`, `sg` in `session`).
- Re-align (a button in the headset's menu, `HOST.room.realignNow()`):
  this headset lines up again from the start without leaving the session or
  forgetting its marks. The shared space is asked for again, what was held
  since waking is dropped, its own marks are looked for again by their anchors,
  and otherwise it asks whoever wrote the room's frame to write it into the
  space again (`q.frame`, passed on like presence) and takes it (waiting up to
  3 s). The frame held so far stays until another is found ("Re-aligned", or
  "Nothing to re-align to").
- A headset runs live only the station it stands at (within 1.1 m for 1 s,
  left beyond 1.5 m): stations are walk-in only (the owner, October 2026: "the
  stories can only be visited by going to their circle"). The trigger or a
  pinch on another station's card or ring runs nothing (a notice says to walk
  into its circle); the grip there still moves the station. `HOST.go` switches
  story (in a room `HOST.start` queues a request made while a story loads, and
  the pump retries a lost one). Away from every station (`HOST.room.away()`: a
  headset in a room not at a station, its story not yet loaded there, or the
  room not yet aligned) no story shows: the stories hide their scene
  (`GL.world`, with the life-size holders in it), their story panels and
  labels, leave nothing of them to point at, and pause the story, silent
  (`xrAway`); only the shell's things show (the other stations' rings and
  cards, people, the menu and its clock, calibration marks; the clock hangs in
  front of you without a left controller or hand). Walking out of a circle
  drops the station (`C.mine` and `C.live`), so nothing of the story goes out
  to the room while away (no clock, no state, no view, no place: a pause there
  is not the room's) and the station plays on for the others; walking back in
  takes the station's clock, state, view, place and panel again. A session
  that starts drops a station the page followed (walk-in only). A desktop page
  follows one from the Shared dialog (a page cannot walk). A story the person
  starts themselves leaves the station (no longer following, not pulled
  back).
- Arrange all: two rows in front of you, half the stories (rounded up: eight of
  fifteen) 1.2 m ahead and the rest 2.6 m further on (behind them; in the gaps when the second row is shorter), 2.4 m apart, every
  station facing away from you (its content floats 1.4 m beyond its spot); it
  needs about 17 m x 4 m of floor from 1.2 m in front of you. It leaves the design room's table where it is (not a
  story). Remove asks first ("Remove for everyone?", 3 s), on the page and in the headset.
- Station icons (`makeIcon`, `iconDef`, `miniDef`, placed by `iconStep` in `shared.js`; 29 October 2026, the owner's
  go; made from the miniatures the same day, the design room's part 2): over each station's ring, its middle 2.1 m
  above the floor (over the heads of people in the circle and above the card's top edge at 1.6 m, so from across the
  room it covers neither), its story's main miniature: the `icon` of its entry in `stories/list.js` (a key of
  `LOWPOLY_MODELS`: the tour's interactome, the PET scanner, the airports' globe; the design room's own `design.table`,
  a small round table with props on plates in the stories' colours, which is only its icon, not a prop on the table),
  from `lowpoly.js`, loaded once through `HOST.lowpoly()` the first time an icon wants one. Its parts are merged into
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
  in every label mode, opaque, depth-tested and writing depth in the room, since it is part of the station rather than
  a label, and with labels hidden it is what tells the circles apart. At your own (live) station it shrinks away
  (your story is in front of you) and grows back when you walk out. A child of its ring's group, so it eases with the
  station (`SHOWN`) and grows with it while carried; not pointable (the ring and card are). Built once per story, the
  first time a station of it shows, at most one a frame (a room's first view would build every one at once), and
  kept; until then, while `lowpoly.js` loads (or if it cannot), and for a key whose entry names no miniature, a glowing
  dodecahedron with a ring in its colour stands there: a sixteenth story needs only its `icon`. 600 to 1,200
  triangles each. `tools/icons.html` (served next to the app) renders them all, every story's and then the design
  room's, in a grid as a headset sees them (`?keys=a,b`, `&cols=`, `&t=` frozen, `&turns=4` four sides, `&fallback`),
  from the app in a hidden frame through `HOST.lowpoly()` and `HOST.collab.icon(key)` (its `model` says which
  miniature, '' the fallback). How they read from across a real room is untested on a headset.
- The design room in a room (the design room's part 2, 29 October 2026): not one of the stories, so never part of
  Arrange all (it neither places nor moves nor removes a station of it), but a station like any other once placed: the
  page's Shared dialog lists it after the stories in its station picker (Add), the headset's Add here page too, and the
  headset's menu has a *Design room* row (below the settings and Panels, above the shared room): outside a room it
  opens the design room (`HOST.go('design')`, the menu closing; greyed while you are there); in a room, *Design room
  here* puts the props table at your feet as a circle facing your way, or moves the room's one there when it has one
  (one table, not a pile of them; `designHere`, `HOST.collab.design(b)`), refused while the layout is locked as Add is
  (greyed). A new station of a page that is not a story starts its clock at its table, in explore mode (a story's at
  its start, paused). Standing at it (it is at your feet) the headset takes it as its station and the table stands
  life size in front of you (its middle 1.55 m ahead of the spot), shared like a story at its station.
- Moving a station by hand: in a headset the grip on a station's ring or card
  picks it up (the shell hears the session's own `squeezestart` and
  `squeezeend`, controller i being `session.inputSources[i]` in three.js r128,
  so the stories need nothing); it swings round your hand as you point, its
  distance from the hand grows as you raise the controller and shrinks as you
  lower it (`exp(2 x the pitch's change)`), and twisting your wrist turns it
  (`carryStation`). It goes out to the room at most every 100 ms and once more
  when let go (`MV`); it is also put down when its controller goes, its grip
  is up or the headset is taken off (no `squeezeend` may come then). Your own
  station's ring can be grabbed too (a trigger on it does nothing). Every
  headset draws rings, cards and its live station's placement where `SHOWN`
  eases them to the room's value, so a moved station glides, and the people at
  a moved station keep it: they leave it by walking away from where it is now
  (`C.zoneD`). On a page the room map does the same: a station's dot dragged
  moves it, its square (where its content floats) dragged turns it; a click
  still follows it, the map keeps its scale while dragging, and an interrupted
  drag (`pointercancel`) puts it back.
- The layout lock (key `lock`, `{ on, by, at }`, FORMAT networks-6): once the
  stations are in place anyone locks them (a button on the headset's Shared
  panel and in the page's Shared dialog) and anyone unlocks them. While on,
  the grip on a station, a scene or a panel, the map drag, Arrange all, Add,
  Move here, Design room here and Remove are refused (`refused()`), a station, scene or panel
  being carried stops where it was last sent, and the cards say so.
- The headset's menu (the shell's panel, `PNL`, `drawPanel`) is closed at the
  start of every session: only a clock shows (`drawClock`: the local time, a
  face 6.5 cm across in the app's cyan rim, *Open menu* under it, redrawn when
  the minute changes), worn like a watch on the left wrist (`HAND`, each
  frame: a controller's grip, the clock 5 cm behind it and 5 cm above; a
  tracked hand's `wrist` joint, the clock 3 cm off the back of the wrist and
  3.5 cm up the forearm), turned to your eyes and eased; without a left
  controller or hand it hangs, twice the size, beside the story panel. It
  opens and closes with a touch of the clock (`touch`: the first 4 cm of the
  right controller's ray, or the right `index-finger-tip`, within 4 cm of its
  middle; another touch counts once moved 7 cm away; a short pulse on a
  controller; none while that controller's grip is held, as when carrying or
  resizing with both hands, or while calibrating), a click of the left stick
  (`buttons[3]`, rising edge: the stories use the stick's axes and
  `buttons[4]`), the trigger or a pinch on the clock (`kind: 'clock'` through
  `ray`/`press`; pulled while the tip touches it, it counts once with the
  touch), or Close in its header. Open, it stands above the clock (its lower
  edge 6.5 cm over the clock's middle, at 0.62 of its size), as tall as what
  it shows: *Menu*, Close; Exit (ends the session: the story panels have no
  Exit, the headset Stories screen keeps its own), *Slideshow: on/off* (`HOST.slides.setGlobal`, for
  every story, shown when `HOST.slides` exists) and *Sound check* (a page in
  place of the rest: the two beeps, the engine choice, Reset the sound and
  `HOST.audio.report()`, redrawn twice a second; Back); *Labels*, *Moving* and
  *Subtitles* (the three headset settings, `HOST.xr`) and *Panels* (the story on
  show's, `HOST.panels`, beside Subtitles; with a line under them: in a room
  that the panels are for everyone at this circle and the rest for the room,
  else for that story only; with no story on show the room's line takes
  its place); *Design room* (outside a room it opens the design room; in a room
  *Design room here* puts its table at your feet: "The design room in a room"), a
  note beside it; then the shared room (its
  code and people as the section's heading, the rooms, the question, the
  room's alignment, stations, people, You; the canvas, 1560 px tall, holds the
  tallest case, a room on this headset with a three-line note at a station (1539
  px), and People shows only as many as leave room for You). A right index fingertip also presses its buttons
  (`poke`: within 1.5 cm of the panel over one, again once pulled back 3 cm;
  a pinch on the ray at the same button within 0.7 s counts once with it,
  `twice`). The once-per-room question still opens it by itself, and so does
  the first time in a room with no stations (once per room: its Stations
  section says "None yet: Arrange all puts every story in front of you").
  `HOST.collab.panelOpen(on)` and `HOST.collab.menu` are for tests.
- At its station in a shared room a headset moves the scene and the panel for
  everyone: the grip on the scene moves it (`XR.globeOff`), both grips on it
  resize it (`xrResize`: the distance between the hands, a quarter to four times
  the story's own size, `XR.size`, in story and explore mode alike) and move it
  with their middle, the grip on the panel moves the panel; with free moving on
  (the room's setting) the grip turns the scene and tilts the panel too, and the
  turn is the station's, for everyone there whatever their own setting
  (`q` in the place and the panel; ignored while free moving is off). `placeSync` (every
  frame, from the shell's tick) sends what is held out at most every 100 ms
  (`xrPose().held`) and once more when let go, glides each to the room's value
  otherwise (`collab.panel`, `collab.place`; a turn by slerp, sent when it
  changed by more than 0.004 rad, the panel's `yaw` worked out from its
  quaternion), and puts both there at once when
  a station is reached. Both values carry the story they were written for, so
  a late one from before the station changed story is refused by the relay. `HOST.anchor.locked(kind)` is
  `HOST.room.gripLocked()` in a room: true away from the headset's station and
  while the layout is locked (then nothing moves, and the panels say so:
  `HOST.room.gripHint`, which `sigMain` includes, so the panel redraws). The
  flock and the robots are life size (`life: true` in `HOST.list`): only their
  panel moves. Outside a room both grips resize the scene too, for this device
  only (kept with an anchored place, reset by Recenter).
- In a shared room a headset never shows the Stories screen (neither its
  header nor the story cards) and the story panel has no Stories button (each
  station keeps its story; another story is another station): one open closes
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
  made at them (`'anchor'`; `roomFrame` in `localStorage` keeps the marks and
  the anchors' handles, never coordinates alone); (2) unless switched off
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
- The room's floor is under the marks, not under each headset: key `rm`
  `{ a, d, by, at }` is mark A's height over the floor of the first headset
  that calibrated (and the marks' distance: marks within 10 cm of it are the
  same marks; taken over by a newer calibration of the same headset, other
  marks, or a calibrated headset when its writer has left). A headset
  whose floor differs puts the room's origin that far above its own floor
  (`frame.o[1]`, from the anchors' heights, so a floor that jumps does not move
  the room), and the panel says so ("Your floor is 28 cm lower than the
  room's").
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
  crosses for 30 s ("Check the marks"). Not found (after 5 and 15 minutes
  asleep two Quest 3s did not find them, and did once AR was entered again), it
  looks again every 10 s for two minutes, then every minute up to ten
  (`restore`, `retryDue`; "Marks found again"); a retry does not hold the room
  in 'restoring', and a calibration from last time not found at session start
  is looked for the same way. Waking never drops a calibration
  (asking to calibrate after every wake was worse). Not found after waking, the
  panel asks to leave AR and enter it again (`lostMarks`, `R.reenter`, log
  `marks lost`; in a test after a standby twenty tries over ten minutes failed
  and a new AR session found them at once), and so does a reset without a
  transform or a jump of the origin while the anchors are not held but their
  handles are saved: the calibration is kept and its anchors looked for again
  at once (only a calibration with no saved handles asks to calibrate again).
  Found after all, the request goes.
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
- Calibrating: a mark is where the controller's ray origin was held still 70 to
  260 ms before the trigger (a bright ring shows that point), at least 50 cm
  apart; a second pull within 0.6 s is ignored, and marks more than 5 cm
  apart in height get a note. Orange
  crosses show the marks where this headset puts them (while the headset's menu
  is open, and 30 s after aligning). The panel's room section also shows the
  shared space's id and *Forget calibration* (`HOST.room.forget()`, press
  twice). Anchor requests carry the marks' generation (`R.mgen`), so ones that
  settle after Forget or new marks are thrown away; a handle the browser
  refuses is logged with its reason. Every 10 s a headset in a room sends its
  log (alignment samples every 5 s) to the relay (`POST /api/log`, kept in
  `relay/logs/` with `--lan` or `--logs`). While aligned and at its station,
  `HOST.anchor.frame()` returns the station's rig pose (spot at 1.6 m over the
  room's floor, facing its way, `room: true`), `held()` is true and
  `locked(kind)` is true (in a room it is anyway); `HOST.audio.zone()` pans the
  narration from the station (full volume within 1.5 m, so at the station's
  spot; nothing changes outside a room).
- The explore view at a station (`st.<id>.view`): headsets at the station share
  it (`viewSync` in the pump: a view from the room glides in, one turned here
  goes out, by value like the rest), so the scene stands turned and sized alike
  for everyone there; screens following the station keep their own camera.
- The relay (`relay/server.mjs`) keeps per room a map key -> `{ v, seq, by }`
  (every stored write takes the next seq; the last writer wins), the members,
  and passes on ephemeral `fx` messages (presence, effects) without storing
  them. `null` deletes only `st.*` and `pose.*` keys; giving a station another
  story drops its `st.<id>.*` keys in the same seq. For now it runs on a machine
  on the same Wi-Fi as the headsets and serves the app itself
  (`node relay/server.mjs --lan`, see `relay/README.md`); GitHub Pages serves
  everything else, and a copy there can join a relay elsewhere with `&relay=`.
- The shell wraps the story's `APP.seek`, `togglePlay`, `enterExplore` and
  `enterStory` to publish the clock, polls `collab.state()` five times a second
  and publishes it when its value changed; a value from the room goes through
  `collab.apply()`, merged per top-level field with controls changed here
  that the room has not yet acknowledged (so two people changing different
  controls at once both keep theirs). A story never publishes anything itself
  except effects.
  A page following a station (Follow) leaves its Stories screen: while that
  shows, nothing syncs.

The hooks every story keeps (all fifteen, the same lines; the flock is the
reference, `tools/flock/engine/`):

- `collab: { APP, scene: () => (LOAD.done ? GL.scene : null), state, apply, view, setView, effect, hover, panel, place }`
  in its returned object (`scene()` is null until the story is all built, so the shell attaches to it, applies the
  room's clock and state and hangs its overlay only then): `APP` is its own clock object, `effect(type, data)`
  plays a one-shot effect another person caused (without sending it again),
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
  null (story mode, or while it flies somewhere); `setView(v)` glides there in
  0.25 s (`orbit.fast`). The flock and the robots are life size in a headset:
  their `view()` is always null. While a headset stands at its station the
  explore sway rests (`HOST.room.placing()`).
- Two helpers next to `xrSig`:
  `const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());`
  (a headset in a shared room: no Stories screen) and
  `const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());`
  (away from its station: the story hidden and paused); a shell without
  `HOST.room.away` gives the old behaviour.
- The caption hook for the shell's subtitles, next to `xrAway`:
  `const xrCaption = () => { ... }` (null in explore mode, on the Stories
  screen and away from a station; else `{ s, end, els, narrT }`: the story time
  now, the chapter on show's end, its cues as `ST.items` keeps them, each
  `{ el, at, out }` in story time, and `narrT` to the clock's time), and
  `caption: xrCaption,` in the returned object, after `inputs`. The shell does
  the reading, splitting, timing and drawing; a story without it (the design
  room) simply has no subtitles.
- `xrPoint`: after raycasting its own panels (`hs`),
  `const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);`;
  a hit (`kind: 'shell'`: the shell's menu and its clock, the other stations' cards and
  rings, calibration marks) is nearer than the story's panels and is the hover
  instead of them and of the scene; then `else if (xrAway()) hit = null;`
  (nothing of the story to point at). `xrPress`:
  `if (h.kind === 'shell') { HOST.collab.press(c.i); return; }`.
- `xrGrab`: `if (XR.stories || HOST.anchor.locked(h.kind)) return;` (in a
  shared room only at its station and unless the layout is locked; the shell's
  own things never move the scene, and the grip on a station's preview moves
  that station, done by the shell); `carry` lets go when that turns locked, and
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
  `const pm = xrPanels(), pv = !land && !away && XR.lm !== 'hidden';` (`XR.main`
  `pv && pm === 'shown'`, `XR.foot` `pv && pm !== 'hidden'`: panels per story) and
  `GL.world.visible = !land && !away;`.
- `xrEnterScene`: `XR.inRoom = xrRoomOnly(); const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;`.
- `xrEnded`: `const away = xrAway();` first, and
  `if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }`.
- The panel footer: `if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', ...)`;
  `xrResize` and the two-hand branch at the top of `carry`; `XR.size` in
  `xrPlace` (scene stories), `xrRecenter` and `xrAdopt`.
- The session's optional features from `HOST.xr.features(mode)` (AR asks for `'shared'`; VR does not).
- `xrFreshStart`: `if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }`: a
  headset taken off in a room keeps its story and place (no Stories screen
  for a new wearer); at a station the room's clock and state go on applying.
- `xrLandingClose`: `if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);`
  and `if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;`: closing
  a Stories screen in a room never restarts or plays the story (at a station
  it runs on the station's clock).
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
| pass | tab, scene, every scene's controls but the fish's view (the fish: neighbours watched, links, shark now and then; the globe: view, colour, pillars, outbreak on; the cell: view, organelles, colour, move), the school's size, the outbreak's start (an airport's code) and settings (incubation, infectious days, spread, flights cut), the city looked up, the protein picked, the school's place at a station (`sea`, moved with the grip there) (never the language, the outbreak's day, the steered shark or the sea moved outside a room) | `shark` (as the flock's falcon, in the set's frame), `school` (quiet, twice a second, as the flock's `flock`) |
| flock | birds, links, falcon | `falcon` (where it starts, its velocity and aim, in the set's frame), `flock` (quiet, twice a second: where the flock is, see the flock's notes) |
| robots | rule, robots, trails, links | `crumbs` (a pile: in room coordinates in a headset with an aligned frame, else in the station's frame), `dust` |
| design (not a story) | the prop on the stage (`pick`), and one field per miniature moved by hand (its key: `[x, y, z, qx, qy, qz, qw, s]` in the table's frame, mm, 3 decimals, 2 decimals) | none |

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
  their controls and effects); the flock follows one device at the station
  (see the flock's notes). `HOST.collab.effect(type, data, true)` sends a
  quiet effect: one sent often, kept out of the log on both sides.

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
name tags in each label mode, the story panels in 3D in the life-size and
stand-inside views (the labels, the story panels and the station cards in 3D,
hidden, and the grip moving and turning scenes and panels, alone and at a
station, were checked on a Quest 3, 28 October 2026),
persistent anchors restored (one headset's handles were refused; the log now
says why), whether a recentre fires a reset, sound zones heard, comfort and
frame rate with presence drawn, and whether the socket keeps running inside an
immersive session. Peer to peer on real devices (the owner, 29 October 2026):
two laptops found each other on a local network with the test page `p2p/`, and
two laptops were in one peer-to-peer room; not yet tried: headsets and phones in
such a room, links inside VR and AR, a host change and a headset's hand-over at
an event, and how long PeerJS's public server keeps a sleeping host's id.

## Inside a story (all fifteen follow the same pattern)

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
  interpolates camera waypoints.
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
  `docs/narration.md`; the flock's first swoop (flight time, `roost` in its
  set) is timed to its last chapter at this pace. A recorded narration replaces
  the table with its own times (the airports' is): `pace.mjs` leaves a story
  with an MP3 in `audio/` alone. A synthetic narration (`tools/voice/`, the tour's) is laid out from its audio instead:
  each stretch lasts the longer of 1.1 times its story time and its line plus a pause, and a chapter's words end
  before its slideshow stop; after such a story's text changes, run `node tools/voice/narrate.mjs <key>` again (only
  changed lines are spoken again), not `pace.mjs`. A story in two languages (`LANGS` and `setLang(l, false)`, the pass story) is read in
  each, and each stretch takes the reading time of its longer text (by words); `tools/narration.mjs` writes both into
  `docs/narration.md`. `slideStep` (slideshow, see above)
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

- The data is real: `tools/nmd/data/gen_data.mjs` reads the authors' files in
  `ikerdata/` and writes `tools/nmd/sets/data.js` (the constant `NMD_DATA`,
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
  return `idle(dt)` (the engine calls it while the set is hidden) and
  `finish()` (build now: the harness and `sweep.mjs` call it before
  screenshots). The heart fades in once built.
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
  `buildCamera`'s turn), its glow cools, then the tracer arrives as before. Open: the owner finds the text from the
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
histogram, the one graph, in passing; each with a manifest) and engine parts adapted from the microanatomy story's.
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
  room the school belongs to the station as the flock does (`fishSync`).

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
  effect `falcon`), so all see the same one. The birds still differ in detail;
  the flock is roughly in the same place.
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
  `design.table` (skipped by `tools/design/build.mjs`: not a prop on the table).

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
  loaded only for a peer-to-peer room). Fonts come from Google Fonts (cached by
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
- After changing anything in `tools/nmd/` (or `ikerdata/`: first
  `node tools/nmd/data/gen_data.mjs`), rebuild `stories/nmd.js` with
  `node tools/nmd/build.mjs` (and bump `VERSION`).
- After changing anything in `tools/lbi/`, rebuild `stories/lbi.js` (and bump
  `VERSION`). Likewise `tools/endo/` and `stories/endo.js` (and after changing
  `tools/nmd/sets/motor.js`, which the endotype story uses too), `tools/flock/` and
  `stories/flock.js`, `tools/robots/` and `stories/robots.js`, and `tools/pet/` and `stories/pet.js` (and after
  changing `tools/lbi/sets/body.js`, which the PET story uses too), and `tools/micro/` and `stories/micro.js` (and after
  changing `tools/lbi/sets/body.js` or `tools/lbi/sets/tissue.js`, which it uses), and `tools/ovary/` and
  `stories/ovary.js` (and after changing `tools/lbi/sets/body.js`, which it uses; first
  `node tools/ovary/data/gen_data.mjs` after changing its readings), and `tools/qubits/` and
  `stories/qubits.js` (run `node tools/qubits/test-qmath.mjs` after changing its maths), and `tools/mutation/` and
  `stories/mutation.js` (run `node tools/mutation/test-mmath.mjs` after changing its maths), and `tools/topo/` and
  `stories/topo.js` (run `node tools/topo/test-data.mjs` after its data or decoders change; its data only from the
  authors' files through `tools/topo/data/gen_data.py`; and after changing `tools/lbi/sets/body.js` or
  `tools/micro/sets/organs.js`, which it uses), and `tools/pass/` and
  `stories/pass.js` (and after changing `stories/airports.js` or `stories/spatial.js`, whose globe and cell it takes).
  And `tools/design/` and `stories/design.js` (also after changing `tools/design/props.json` or a miniature's name), and
  `tools/lowpoly/` and `lowpoly.js` (`node tools/lowpoly/build.mjs`; keep each miniature under 1,200 triangles and its
  `tris` exact: the harnesses mark a wrong count in red).
- Keep `README.txt` (user-facing notes) in sync with structural changes.
- Shared rooms: bump `FORMAT` in `shared.js` when the keys or a story's
  `collab.state()` change shape (a room refuses another format). A story's
  hooks (see "Shared rooms") must stay in step with its pointer code.
- Several handlers run inside the old story's call stack when switching;
  use `HOST.go(key)` (deferred) from inside a story, not `HOST.start`.

## Testing

There is no unit-test suite. Before committing, serve the folder and run the
smoke test, which loads every story (and the design room: its 45 miniatures built, a click putting one on the stage
with its card as `props.json` has it, a pretend headset's grip, its shared state, Tidy), scrubs through it, plays it as a slideshow
(a paused scrub near a stop holding, a stop exactly at a chapter's end and at the
last one, the voice finishing the chapter there where a story has a recording,
Next on the page, in the bar and on the headset panel beside the chapter arrows,
Next going on), exercises explore
mode and the headset panels (for the muscle, endotype, PET, microanatomy, ovary, qubits, mutation, tissue topology and pass stories every explore tool too,
for the tissue topology story the panes' numbers against its data (the patch's counts at the poster's snapshots, the
held-out test, a window's share of the gap, the two groups, cell v's score), for the mutation and tissue topology
stories also their links (each opens explore mode on what it says), for the pass story in both languages with its switch; for
the robot gang every rule, a click to walk, crumbs, a big open floor and one
with no area, and a pretend headset room from detected planes),
loads every story again watching its load (`HOST.progress` rising from 0 to its total once per step, the page's bar
and step shown and gone, no task of the load longer than `LOAD_LIMIT`, 4 s: generous, as SwiftShader compiles one
shader at a time in software; the shared-room hooks seeing the scene only once it is built; a story picked while
another builds stopping that one's steps and keeping the controllers and place), and with a pretend headset (its
frames driven, the drawing recorded) the loading scene in VR and AR: nothing before 0.4 s, then the card 1.2 m in
front and 15 cm below the eyes and the ring at the left wrist, drawn in a scene of its own (not the story's, no
listener of the story's), the clear colour kept, the card fading out over the story's first frames,
switches stories, runs anchored placement in each
story with a pretend headset (an origin that jumps, anchors that stay, saved
handles), checks the three headset settings with a pretend headset in a page of
its own (everything in 3D by default; the menu's Labels and Moving buttons
going round, kept across a reload, set by a link; for the qubits, the flock and
the airports: labels on top as sprites, in 3D as depth-tested upright signs
turned to the head, also after it moves, and hidden; the two story panels on top
as before, in 3D in the scene (depth-tested, writing depth, `renderOrder` -1,
`alphaTest` above 0, their materials built again only when the mode changes,
the ray still reaching each), and hidden with neither panel drawn or pointable
in story and explore mode, A or X still playing; back again from hidden; the
Stories screen's panels on top throughout; a free grip turning the scene 90 degrees with the hand, the
point held staying in it, staying when let go and facing you again with free
moving off; the panel tilting with the hand; the flock's grip taking only the
panel; subtitles: off by default with nothing drawn, on through the menu's row,
kept across a reload, set by `#subs=on`, the caption the words of the line on
show (several captions for a long line) changing with the clock, holding while
paused, none in explore mode or on the Stories screen, still for a 10 degree
turn of the head and following a 40 degree one with lag, the pass story's in
German, the hook in all fifteen; panels per story: shown by default, the menu's
Panels row going round (controls only, hidden, shown) with the story following,
no row on the Stories screen (its panels staying), each value in story and
explore mode (controls only: the foot bar alone, the text panel neither drawn
nor pointable; hidden: neither, A or X still playing), labels hidden still
hiding both, each story its own (the qubits, the flock, the airports, the
design room), kept per story across a reload, set by a link for the story it
opens, the lines in all fifteen and the design room; the menu's Design room
button outside a room opening the design room, the menu closing and the button
greyed there), and fails on console errors:

```sh
npx http-server -p 8123 -c-1 .          # or: python3 -m http.server 8123
node tools/smoke.mjs http://127.0.0.1:8123/
```

It needs Playwright with a Chromium build (`npm i --no-save playwright` and
`npx playwright install chromium` once, or a global install; see
`docs/setup-and-release.md`). A 404 for a missing narration MP3 is expected and ignored.
WebGL runs in software (SwiftShader) headlessly, so frame rates are low;
real-headset behaviour (controllers, session hand-over between stories,
placement and comfort) can only be confirmed on a device - say so when you
report results.

After touching sound, also run `node tools/audio.mjs http://127.0.0.1:8123/`.
Headless Chromium plays sound without a tap, so the test imitates the strict
rule (an `AudioContext` starts locked and only a real tap unlocks it; an
`<audio>` element plays only once started inside a tap) and checks that the
narration plays after a click, after a story change with no tap (as in the
headset's Stories menu), through pause, jumps, the Sound button, the Stories
screen and a headset session going hidden and visible; that an old saved mute is
ignored, Play sound never mutes and the hum runs; Sound check's beeps and engine
choice; and that the `<audio>` element takes over when Web Audio cannot decode,
never starts, or its clock stops. Whether sound really comes out of a headset
can only be confirmed on the device (use Sound check there).

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
station of a story this device does not know, and a shell file reloading the page
with its place.

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
/64, `--proxy` and `X-Forwarded-For` ignored without it, an empty room still listed on its members' networks, `near`
off, and no address in any answer or log line, nor a network's id in the log; no browser, seconds; `node tools/peer.mjs` links two pages of
the test page `p2p/` through it) and
`node tools/collab.mjs` (about a quarter of an hour; it starts its own relay with
`--static .`, so no server is needed). For every story in its `STORIES` table,
three pages in a room follow its station and check play, pause, jumps, mode
changes and Replay (within 5 s), the relay's clock, the explore state both
ways and the story's effect (for the robots also the pile's spot and dust; for the flock
the same falcon, one page leading, the same flight time and the flocks together);
on the first story followed, also a slideshow stop on one page pausing the
station for the others at the chapter's end, and its Next playing it again.
Before that: Arrange all's rows, a code with no room, Remove asking first.
After: a station moved and turned on the room map (and refused while the
layout is locked), the design room (the Shared dialog's picker listing it after
the stories, its station added there for every page, refused while locked from
Add and the Design room button, left where it is by Arrange all, the button
moving the room's one to your feet rather than adding a second), the headsets' three settings as the room's (everything in 3D
and no subtitles in a room without them; set on one page, or in another's Shared
dialog with the layout locked, for every page; free moving off taking the turns
out of the stations' places and panels; kept across the relay restart and, in a
room on this device, across a reload), a station's panels set in a page's
Shared dialog with the layout locked (reaching the pages at that station,
another station keeping its own; kept across the relay restart),
two controls changed at once on two pages (both kept), two stations
followed back to back (the second not lost), a story picked by hand (stops
following), no writes while idle (no ping-pong), a late joiner, a relay restart, and
a pretend headset with fake `local-floor` and `shared` spaces: alignment,
away from every station no story (no Stories screen, the scene and panels
hidden, nothing to point at, paused, no Stories button, the clock in front),
placement at its station once it walks into its circle (the story shown), a
recentre, taken off and on again (it stays in its story), a Stories screen
opened at a station closing at once (restarting nothing), walking out of the
circle (the story hidden and paused here while the station plays on, nothing
written; no Stories screen for a new wearer out there) and back in (shown and
running on the station's clock), the hold and the lock, a station's panels
set on a page reaching the headset at its circle (controls only: the foot bar
alone; the station it is not at keeping its own) and set from its menu's Panels
row for everyone there with the layout locked (hidden), its own station's back
again (shown) when it walks there, the design room in the headset (every
station's icon built from its story's miniature, in its colour and turning; the
menu's Design room button greyed while locked; Add here listing the design room
after the stories; the button putting the props table at its feet facing its
way for every page; standing in it, its station, the design room open there at
its table in explore mode, its icon and card gone; walked out, its icon, the
table's miniature, back),
the station's clock and state, rays and head in room coordinates, another
person drawn, the sound zone, the trigger on the menu's clock, the trigger on
another station's card running nothing (a notice: walk into its circle), the story
panel winning over a card behind it, every station's icon over its ring (its story's miniature, in its colour,
turning; gone at its own station and back once it walks out), a station moved with the grip on its
card (swung, pushed further, turned; the others see it while it moves) and
gliding into place when someone else moves it, the layout lock (the grip and
Arrange all refused; unlocked from the headset's menu), the menu (closed at
first, only its clock; on the left controller and on a tracked hand's wrist;
opened by the left stick, a touch of the right controller or fingertip and
the trigger on the clock, a touch and a trigger at once toggling it once, no
touch with the grip held or while calibrating; Exit inside; buttons pressed by
a fingertip, a poke and a pinch at once pressing once; at its tallest, You still on it;
Sound check in it: both beeps, the engine choice, Back), re-alignment, walking to another station
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
found by their handles after waking and found by a later try (meanwhile the
panel asks to leave AR and enter it again; a jump with their handles saved
keeps the calibration), the room's floor from
the first calibration (a lower floor allowed for), no mark from a double
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
controller was held still, VR elsewhere with its in-room question; in a
room no Stories button (at a station either) and a Stories screen closing by itself, the grip on
the scene and the panel unlocked there (locked by the layout lock), both grips
resizing the scene and one hand carrying on, the place, size and panel going
out to the room and gliding in from it, a free grip turning the scene 90 degrees
and tilting the panel (the turns in the room, the other pages holding the same
`q`), Moving in the headset's menu turning free moving off for everyone (the
turns gone, the scene facing you again, the panel upright) and Labels going
round there for every page (the other stations' cards and a person's name tag
on top as before, drawn as the labels' signs in 3D, not drawn when hidden; the
menu on top in every mode); Re-align
(an offset headset back on the room's frame, the shared space asked for again),
and after a night: a headset still outside the space asking for it again, a
follower holding against a space made again and following the room's frame
once written again, this headset's own frame written into a space made again;
a room on this device (no relay known and `&peer=off`: a link opens it, Arrange all, a moved
station, the lock and the headsets' settings kept across a reload, a headset alone on its floor with
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
that was in the room joining it again by itself when the app opens again (the notice); a day later (the page's clock
moved on, its storage kept) with the relay having forgotten the room, joined again and the room back from its copy;
Leave on purpose, then nothing by itself; more than a week later, nothing; a code the relay gave to another room
meanwhile (another `rid`), never joined, nothing of it kept; a copy kept without the room's `rid`, never joined by
itself, only offered. Peer to peer: the host holding a slot, a page on its
network seeing the room (hosted by) and joining with one press, a page on another not; *Show on this network* off
(the slot let go) and on; a page that was in the room rejoining its host by itself; a day later with nobody holding
it, the first page back hosting it from its copy and the next linking to it; on another network nothing by itself,
*Start room XYZ again* hosting it with one press; Leave on purpose, nothing by itself; the relay's log naming none of
the pretend addresses. `--quick` runs only the last story in the per-story part. `--design` runs only the design room
in a room (three pages and a pretend headset, a minute or two; with `--shots` its pictures: `design-menu.png`, the menu's
canvas, `design-station.png`, the table at its circle, `design-circle.png`, its ring, card and icon among the others). A new story needs an entry in `STORIES`
(`change` and `back`: code that changes its `state()`, and optional `effect`
and `more`); the headset's story (`HEADSET_STORY`) stays the last entry.
`--shots <dir>` also saves pictures of rooms on this network (`near-dialog.png`, `near-toast.png`, `near-again.png`,
the menu's canvas `near-menu.png`), of the dialog and eight headset views (with the menu's clock on the left wrist, the menu open, its Sound check,
stepped out of a station's circle: no story, only the room and the clock in front, and the stations' icons from behind the first row and along it, at 1280 x 800).

For the tour, test a changed set on its own in the set harness first
(`tools/lbi/shot.mjs`, much cheaper than the whole story), then the story at a
few seconds (`tools/lbi/sweep.mjs`), then the smoke test. The muscle story has
the same tools in `tools/nmd/` (`shot.mjs`, `sweep.mjs`), and so have the
endotype story in `tools/endo/`, the PET story in `tools/pet/`, the microanatomy story in `tools/micro/`, the ovary story in `tools/ovary/`, the qubits story in `tools/qubits/`, the mutation story in `tools/mutation/`, the tissue topology story in `tools/topo/` (also `test-data.mjs`: its data and decoders against the poster's numbers, a second), the pass story in `tools/pass/` and the robot gang in `tools/robots/`.

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
`#pass&t=180&lang=de` (German), `#pass&explore&tab=fish&k=1&links=on&shark`, `#pass&explore&start=LHR&spread=high&cut=50&day=20&city=SYD`,
`#pass&explore&protein=CFTR&move=cf`, `#pass&explore&scene=globe&pillars=on`, `#flock&explore&view=afar&links=on&birds=400`
(`&hunt` sends a falcon), `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low`
(`&crumbs` spills a pile, `&walk=1.5,1.2` walks you there), `#airports&repeat=all` (a kiosk that plays
every story in turn), `#airports&slides=on` (every story as a slideshow), `#anchor=on` (anchored headset placement), `#qubits&panels=controls` (that story's panels in the headset: only the foot bar), `#stories&net=home` (pretend to be on a network, without a relay: rooms on this network in tests),
`#design` (the design room's table), `#design&pick=lbi.atp&view=stage` (a prop on the stage, its card; `view=above`,
`view=group:pet` a story's plate, `&tab=all`, `&now`). In the console,
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


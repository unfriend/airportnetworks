# CLAUDE.md

@AGENTS.md

## Notes for Claude Code

- Read `AGENTS.md` (imported above) first; it is the single source of truth
  for structure, conventions and testing. Update it, not this file, when the
  architecture changes.
- The story files are large (`stories/airports.js` is ~640 KB because of its
  embedded data). Search with Grep and read line ranges; never read them whole.
- Prefer small, exact edits. When a change touches the headset code, apply it
  to all sixteen stories: their XR, panel and landing-screen code is meant to
  stay identical apart from story-specific panes.
- Verify visual changes by serving the folder and taking headless Chromium
  screenshots (hashes such as `#spatial&t=60` jump straight to a moment), and
  run `node tools/smoke.mjs` before committing. Report anything that can only
  be checked on a real headset as untested.
- After any change to app files, bump `VERSION` in `sw.js`. After changing
  `sw.js` or how files load, run `tools/update.mjs` (see Testing in `AGENTS.md`).
- Releasing: after the `VERSION` bump, run `node tools/release.mjs` (it writes
  `version.json` and stamps the shell's release into `index.html`; commit both;
  `--check` says whether they are current). Running pages take a release from
  it ("Hot reload and live updates" in `AGENTS.md`). The list of stories is
  `stories/list.js`. After touching `HOST.live`, `HOST.swap`, `HOST.load`, the
  release script or the relay's `--watch`, run `node tools/live.mjs`; a swap in
  a headset and the update panel there are untested until tried on one.
- While developing, `node relay/server.mjs --lan --watch --build` (or
  `--static . --watch`) swaps a saved story in place on every page and headset.
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories never
  create or close an `AudioContext`. Keep both engines, the hum and the
  watchdog (see the sound notes in `AGENTS.md`): each guards against a way the
  narration went silent on the Quest. After touching sound, run
  `node tools/audio.mjs` as well as the smoke test, and report audible output
  on a headset as untested (Sound check is the on-device tool). Sound effects
  are the shell's too (`HOST.sfx`, `sfx.js`): they play only through
  `HOST.audio`'s context (`HOST.audio.fx()`), on by default (the owner approved
  them; the Sound button silences them with the narration). Two switches, each
  for every story at once: Sound effects (`HOST.xr.sfx()`, through `HOST.sfx.on()`
  and `set()`) and Narration (`HOST.xr.voice()`: off, the narration is silent and
  the story runs on its clock; effects and subtitles go on); in a room the room's
  (key `look`), else the device's own (`sfxOn`, `narrationOn`); the effects'
  volume is always the device's own. Only the flock and the pass story have a
  background, and `vacuum` is the only continuous sound (the owner, 30 October
  2026: the other backgrounds and the machines' hum went; never bring them back
  unasked). Stories ask for them through the same lines in all
  sixteen and the design room (the sound effects block after the slideshow block,
  `sfxCue`/`sfxHold` beside the keys, `sfxAct` for explore actions, `sfxLive` in
  the live simulations; the flock and the airports are the references): keep them
  identical, and never put a sound in `collab.state()`. After changing a sound,
  render it (`node tools/sfx-render.mjs`) and check its levels; after changing a
  story's cues, run `node tools/sfx-cues.mjs <url> <key>` and render its track
  (`node tools/sfx-render.mjs <url> <out> --story <key>`); nobody here can hear
  them, so report how they sound as unheard.
- Synthetic narrations come from `tools/voice/` (Kokoro-82M; the tour's, voice
  `af_heart`, the owner's choice; model and Python outside the repository, see
  its README). After a narrated story's text changes, run
  `node tools/voice/narrate.mjs <key>` (it re-times the story from the audio;
  not `tools/pace.mjs`), then `node tools/voice/check.mjs <key>`; check new
  words with `--phonemes` and `say.json`, and report how it sounds as untested.
- Headset placement can be anchored in the room (`HOST.anchor`, see
  "Placement in the headset" in `AGENTS.md`): story code must never move
  `GL.rig` past it, so check `HOST.anchor.held()` before re-placing and
  `HOST.anchor.locked(kind)` before letting the grip move anything. Real anchors
  only exist on a headset: report their behaviour as untested.
- The headset's three settings (labels in 3D, on top or hidden; free moving;
  subtitles, off by default) are the shell's (`HOST.xr.labels()`,
  `HOST.xr.free()`, `HOST.xr.subs()`, in a room the room's key `look`, which also
  holds the two sound switches, `sfx` and `voice`), the same
  for every story: never put them in a story's `state()`. Stories read the first
  two every frame through the shared lines (`xrSettings`, `placeLabelXR`,
  `xrFace`), the same in all sixteen; the shell draws the subtitles from each
  story's caption hook (`caption: xrCaption`, the same lines in all sixteen).
  How the signs read, how the free grip feels and how the subtitles read and
  follow the head can only be checked on a headset: report them as untested.
- Shared rooms (`shared.js`, `relay/`, see "Shared rooms" in `AGENTS.md`): keep
  the shared hooks in all sixteen stories, the same lines in each (the `collab`
  object, the ray and press lines, the grip line, the optional features from
  `HOST.xr.features(mode)` (AR asks for `'shared'`, VR for less), the `HOST.collab.mine()` lines in `xrFreshStart` and
  `xrLandingClose`, and the walk-in lines: `xrRoomOnly` and `xrAway` (no Stories screen in a room; away from its station
  the story hidden, not pointable, paused) read in `xrBegin`, `xrPoint`, `xrUpdate`, `xrEnterScene`, `xrFreshStart`,
  `xrEnded`, `xrLandingClose` and the panel footer). `state()` never holds the camera, hover or anything per
  device, and `apply(state())` gives the same `state()` back. After touching
  `shared.js`, the relay or a story's hooks or its `state()`, run
  `node relay/test.mjs` and `node tools/collab.mjs` as well as the smoke test
  (and bump `FORMAT` in `shared.js` when a `state()` changes shape). Others' moves
  are smoothed in `shared.js` ("Others' moves, smooth" in `AGENTS.md`): a write of a
  move by hand carries `ts` and, while held, `h`, and every comparison of such a value
  leaves them out (or writes and echoes go back and forth); `setView(v, now)` keeps the
  same lines in every story; after touching it run `node tools/collab.mjs --smooth`, and
  report how smooth it feels on headsets as untested. Shared
  spaces, calibration and sound zones only exist on headsets: report them as
  untested. Peer-to-peer rooms (no relay) are tested only between pages on one
  machine through the relay's `/peerjs`: tests never use PeerJS's public server
  (no internet), and links between real devices are untested until tried there.
- `stories/lbi.js` is built from `tools/lbi/`: edit there and run
  `node tools/lbi/build.mjs`. `stories/nmd.js` likewise from `tools/nmd/`
  (`node tools/nmd/build.mjs`; data from `ikerdata/` via
  `node tools/nmd/data/gen_data.mjs`). Never show patient or variant data in it.
  `stories/flock.js` likewise from `tools/flock/` (`node tools/flock/build.mjs`),
  and `stories/robots.js` from `tools/robots/` (`node tools/robots/build.mjs`).
  `stories/design.js` (the design room, not one of the sixteen: `STORY_EXTRA`) likewise from `tools/design/`
  (`node tools/design/build.mjs`; its cards from `tools/design/props.json`), its models from `lowpoly.js`, built from
  `tools/lowpoly/` (`node tools/lowpoly/build.mjs`; every miniature under 1,200 triangles, its `tris` exact).
  `stories/endo.js` likewise from `tools/endo/` (`node tools/endo/build.mjs`; data
  from the authors' files via `tools/endo/data/gen_data.py`, which are not in the
  repository); it includes `tools/nmd/sets/motor.js`, so rebuild it after changing that.
  `stories/pet.js` likewise from `tools/pet/` (`node tools/pet/build.mjs`; data from the paper's tables and the
  figures' readings in `tools/pet/data/figures.json` via `node tools/pet/data/gen_data.mjs`); it includes
  `tools/lbi/sets/body.js`, so rebuild it after changing that. No patient data in it (the authors' VR viewer holds a
  patient's scan: never use its data).
  `stories/micro.js` likewise from `tools/micro/` (`node tools/micro/build.mjs`; data from Iva Buljan's GraphML, kept out of
  the repository, and the preprint's numbers via `node tools/micro/data/gen_data.mjs <graphml>`); it includes the tour's
  body and tissue sets (its organs are its own 3D models, `tools/micro/sets/organs.js`), so rebuild it after changing
  those.
  `stories/ovary.js` likewise from `tools/ovary/` (`node tools/ovary/build.mjs`; data from the poster's numbers, typed in,
  and the figures' readings in `tools/ovary/data/figures.json` via `node tools/ovary/data/gen_data.mjs`); it includes
  `tools/lbi/sets/body.js`, so rebuild it after changing that. Its neighbor network (and the network by kind) is
  illustrative and its count tags are read off the poster's lines (say so); no charts beyond the donors' histogram, and
  no GTEx image or picture from the poster in it. American spelling, as in the qubits story.
  `stories/qubits.js` likewise from `tools/qubits/` (`node tools/qubits/build.mjs`; its maths checked by
  `node tools/qubits/test-qmath.mjs`; example networks only, computed live, and the real run's numbers typed in from
  Joel Hancock's brief in `tools/qubits/sets/data.js`, shown only as "in the real network"). It and the aging ovary
  story use American spelling (color, gray, neighborhood, aging), as asked; keep it so there and British everywhere else.
  `stories/mutation.js` likewise from `tools/mutation/` (`node tools/mutation/build.mjs`; its maths checked by
  `node tools/mutation/test-mmath.mjs`; example numbers only, computed live, and the poster's numbers typed in
  `tools/mutation/sets/data.js`, shown only as "in the authors' test"). Its coupling, computed live, is our stand-in for
  the authors' circuit and says so; never call the circuit "better" or "more accurate". No patient data and none of the
  poster's pictures (its figures are redrawn in 3D). British spelling.
  `stories/topo.js` likewise from `tools/topo/` (`node tools/topo/build.mjs`; its data and decoders checked by
  `node tools/topo/test-data.mjs`; data from the authors' files via `tools/topo/data/gen_data.py`, which runs their
  package topocyte (GPL-3, offline only, none of its code copied) and the poster's figure scripts; the files are not in
  the repository). Every number is topocyte's: never write science in the app (no persistence, functional PCA,
  classifier or score computed there), only look up `TOPO_DATA` through `TDATA`. No GTEx ids, donor details or images,
  and none of the poster's pictures (slides are numbered); "Cancer cell" stays (the cell classifier's label, the
  author's wish). It includes `tools/lbi/sets/body.js` and `tools/micro/sets/organs.js`, so rebuild it after changing
  those. British spelling.
  `stories/soil.js` likewise from `tools/soil/` (`node tools/soil/build.mjs`; its data, decoders and key numbers checked
  by `node tools/soil/test-data.mjs`; data from the authors' three CSVs via `tools/soil/data/gen_data.py` and the
  slides' readings via `tools/soil/data/reconcile.py`, none of those files in the repository). Look numbers up in
  `SOIL_DATA` through `SDATA`; compute nothing scientific in the app. Unknowns are illustrative and say so; keep its
  hedges (the BNI wheat greener and leaking less in the slides' measurements; the microbes and their network follow the
  fertiliser and the plots, not the wheat line; rising together is not working together; strong indications, not yet
  proof) and the two N2O measurements as an open question. The network is ours, built for the story: never call a link
  an interaction or a hub a keystone. Kinds numbered, never named by their ids; no sequences, no pictures from the
  slides, no e-mail addresses. It includes `tools/topo/sets/look.js` and `tools/lbi/sets/web.js`, so rebuild it after
  changing those. British spelling.
  `stories/pass.js` likewise from `tools/pass/` (`node tools/pass/build.mjs`; its sets checked by
  `node tools/pass/test-sets.mjs`). Its globe and cell are cut, unchanged, out of `stories/airports.js` and
  `stories/spatial.js` at build time, so rebuild it after changing either. It is in English and German: every word in
  both (`STR` in `tools/pass/engine/e2_text.js`, the sets' own `setLang`), German plain and natural for a 12-year-old;
  the language is per device and never in `collab.state()`.

## Keeping token use down

Follow "Working economically" in `AGENTS.md`. In particular:

- Ask for (or read) a token budget before large work, and say roughly what a
  multi-agent run will cost before starting one. Ultracode or other
  "exhaustive" modes are for showpiece work, not routine changes.
- Sub-agents and workflow agents that review, verify, sweep screenshots or
  extract data get `model: 'sonnet'` (or `'haiku'` for mechanical checks) and
  low or medium effort; keep the strongest model for building and integration.
- One critique and one fix round; batch verification; only high-severity
  findings get verified.
- In the main conversation, view screenshots as small contact sheets, read line
  ranges with Grep/Read instead of whole files, and delegate broad searches.

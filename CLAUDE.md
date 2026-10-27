# CLAUDE.md

@AGENTS.md

## Notes for Claude Code

- Read `AGENTS.md` (imported above) first; it is the single source of truth
  for structure, conventions and testing. Update it, not this file, when the
  architecture changes.
- The story files are large (`stories/airports.js` is ~640 KB because of its
  embedded data). Search with Grep and read line ranges; never read them whole.
- Prefer small, exact edits. When a change touches the headset code, apply it
  to all fourteen stories: their XR, panel and landing-screen code is meant to
  stay identical apart from story-specific panes.
- Verify visual changes by serving the folder and taking headless Chromium
  screenshots (hashes such as `#spatial&t=60` jump straight to a moment), and
  run `node tools/smoke.mjs` before committing. Report anything that can only
  be checked on a real headset as untested.
- After any change to app files, bump `VERSION` in `sw.js`. After changing
  `sw.js` or how files load, run `tools/update.mjs` (see Testing in `AGENTS.md`).
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories never
  create or close an `AudioContext`. Keep both engines, the hum and the
  watchdog (see the sound notes in `AGENTS.md`): each guards against a way the
  narration went silent on the Quest. After touching sound, run
  `node tools/audio.mjs` as well as the smoke test, and report audible output
  on a headset as untested (Sound check is the on-device tool).
- Headset placement can be anchored in the room (`HOST.anchor`, see
  "Placement in the headset" in `AGENTS.md`): story code must never move
  `GL.rig` past it, so check `HOST.anchor.held()` before re-placing and
  `HOST.anchor.locked(kind)` before letting the grip move anything. Real anchors
  only exist on a headset: report their behaviour as untested.
- Shared rooms (`shared.js`, `relay/`, see "Shared rooms" in `AGENTS.md`): keep
  the shared hooks in all fourteen stories, the same lines in each (the `collab`
  object, the ray and press lines, the grip line, the optional features from
  `HOST.xr.features(mode)` (AR asks for `'shared'`, VR for less), the `HOST.collab.mine()` lines in `xrFreshStart` and
  `xrLandingClose`). `state()` never holds the camera, hover or anything per
  device, and `apply(state())` gives the same `state()` back. After touching
  `shared.js`, the relay or a story's hooks or its `state()`, run
  `node relay/test.mjs` and `node tools/collab.mjs` as well as the smoke test
  (and bump `FORMAT` in `shared.js` when a `state()` changes shape). Shared
  spaces, calibration and sound zones only exist on headsets: report them as
  untested.
- `stories/lbi.js` is built from `tools/lbi/`: edit there and run
  `node tools/lbi/build.mjs`. `stories/nmd.js` likewise from `tools/nmd/`
  (`node tools/nmd/build.mjs`; data from `ikerdata/` via
  `node tools/nmd/data/gen_data.mjs`). Never show patient or variant data in it.
  `stories/flock.js` likewise from `tools/flock/` (`node tools/flock/build.mjs`),
  and `stories/robots.js` from `tools/robots/` (`node tools/robots/build.mjs`).
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

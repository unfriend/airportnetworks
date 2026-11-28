# Testing: when to run what, one row a block, the known red results

<!-- toc (tools/docs/toc.mjs) -->
- 25: When the suites run (1.5 KB)
- 41: Which suite after which change (2.3 KB)
- 69: Listing the tests and the docs' tools (3.0 KB)
- 105: The smoke test (`tools/smoke.mjs`) (19.6 KB)
  - 152: Smoke blocks (9.8 KB)
  - 224: `--only <words>` and `--block <id>` (1.7 KB)
  - 243: Playwright, SwiftShader and what only a headset shows (0.5 KB)
  - 253: The headset bench: testing on the real Quest from the cloud (v232) (2.8 KB)
- 281: Shared rooms: `relay/test.mjs` and `tools/collab.mjs` (6.5 KB)
- 348: Other tools (5.6 KB)
- 375: `tools/sfx-cues.mjs` and `tools/sfx-render.mjs` (0.8 KB)
- 384: Known red results on this machine (8.2 KB)
- 419: Traps for a test writer (4.7 KB)
- 467: Useful URL hashes and the console (4.8 KB)
<!-- /toc -->

Read on demand; the rules every agent needs are in AGENTS.md. This file says when each suite runs, what each smoke
block and shared-room round protects, how to run one of them and what is red on this machine. It does not retell the
checks: `--list` prints them (below). Why a check exists and what bug it caught is in `docs/history/testing.md` (a
heading per block, the full old retelling).

## When the suites run

There is no unit-test suite. When the suites run (the owner's rule, 7 November 2026: the full suites only before `main` moves): every suite below that a change touches runs before `main` moves, the smoke test always; a push to
`dev` gets only `node --check` on the changed files, the builds' `--check` (`node tools/engine/all.mjs --check` covers the fourteen that share the engine parts), `node tools/packages/scan.mjs --check` (the story packages' index is current and no folder in `packages/` is left out: `docs/agents/packages.md`) and `node tools/release.mjs --check`, and a
red result there is not chased. The table under "Which suite after which change" says what goes into that release run.

Every test page sets `collabAutoAll`, `collabAutoWelcome` and `tutorialHold` to `off`, `collabAskDefault` to `walk`
and (v214) `collabMenus` to `full` (the headsets' full menu in a shared room, which the rounds use) before the page loads,
unless its round asks otherwise; keep that when adding a round.

Every test and tool finds a story through `tools/stories.mjs` (v185: its file, sources, build and narrations, moved into
a story package or not) or, in a page, `HOST.list` and `HOST.meta(k)` (`m.pkg ? m.base + 'main.js' : 'stories/<k>.js'`):
smoke's `STORY_KEYS` are `HOST.list`'s stories (the app's own packages included, others' left out), collab's `STORIES`
are checked against `tools/stories.mjs`, so a story that moves stays in every check. `tools/engine/all.mjs --check`
covers the app's packages too.

## Which suite after which change

The same table as `AGENTS.md`, "Testing". Serve the folder first (`python3 -m http.server 8123`); a test takes its URL
as its first argument (`http://127.0.0.1:8123/`), except `relay/test.mjs`, `tools/collab.mjs` and `tools/live.mjs`,
which start their own relay or server (`tools/smoke-all.mjs` too when given no url).

| Touched | Run before `main` moves |
| --- | --- |
| anything | `node tools/smoke.mjs <url>`, or block by block `node tools/smoke-all.mjs <url>` (row K) |
| sound | `node tools/audio.mjs <url>` |
| a story's cues or a sound | `node tools/sfx-cues.mjs <url> <key\|all>`, then `tools/sfx-render.mjs` (report how it sounds as unheard) |
| `HOST.live`, `HOST.swap`, `HOST.load`, `tools/release.mjs`, the relay's `--watch` | `node tools/live.mjs` |
| `sw.js` or how files load | `git worktree add /tmp/old <commit> && node tools/update.mjs /tmp/old .` |
| `shared.js`, the relay, a story's hooks or `state()` | `node relay/test.mjs` and `node tools/collab.mjs` (about 50 min, 26 rounds; one round with its flag) |
| `output.js` | `node tools/output/test-page.mjs` |
| a story's maths, data or sets | its `packages/<key>/src/test-*.mjs`; a changed set: its harness (`src/shot.mjs`), then `sweep.mjs` |
| a package or the template | `node tools/packages/check.mjs packages/<key> --load` |
| `ik.js`, `bodies.js`'s mannequin | `node tools/studio/test-ik.mjs` |
| the studio's images or converter | `node tools/studio/test-images.mjs`, `tools/studio/convert.mjs <model>` |
| an example's generator | that folder's `make.mjs --check` |
| the room and depth test page (`room-test/`) | `node tools/room-test.mjs` |
| `packages/spatial/main.js`'s lists, cell or `solveLayout()` | `node packages/spatial/src/layout.mjs --check` (headless Chromium; no other check runs it, and `layoutSig()` does not see `solveLayout()`'s own code or constants), then the pass build |
| the shared engine, meant to change nothing | `tools/engine/same.mjs`, `xrsame.mjs`, `panelsame.mjs` (below; not in the release run) |

After any change to an app file, bump `VERSION` in `sw.js` (AGENTS.md, "Releases and files"). Real-headset behaviour
(controllers, session hand-over between stories, placement, comfort, sound) can only be confirmed on a device: report
it as untested, and how sounds sound as unheard.

## Listing the tests and the docs' tools

The three big tests say what they hold without running (nothing starts: no server, relay or browser):

- `node tools/smoke.mjs --list` - every block (`block <name>`) and step (`step <name>`, indented inside a block),
  read from the file's text as written (`${key}` left unfilled). `--only <words>` takes these names.
- `node tools/smoke.mjs --blocks` - every block's id, one a line: the `runs('...')` and `inGroup('...')` blocks and each
  of the app's stories (`packages/order.json`'s) by its key; `--block <id>` takes them. `--help` - the flags.
- `node tools/smoke-all.mjs --list` - the same ids with each one's timeout; `--help` its flags.
- `node tools/live.mjs --help`, `node tools/update.mjs --help` - their usage (nothing runs).
- `node tools/collab.mjs --list` - every flag with the round it runs and whether that round is in the main run
  (`(main)`) or not; `--list --checks` - every `check(...)` name under the round (function) that holds it, as written,
  and the count; `--help` - the flags, as `--list`. A flag the code reads but `FLAGS` does not name is printed as a
  `note:`.
- `node tools/audio.mjs --list` - every step; `--list --checks` - under each step the `ok   ...` lines it prints when
  its checks pass; `--help` - its usage (exit 0, runs nothing).

The docs' tools (`tools/docs/`, Node, no packages):

- `node tools/docs/toc.mjs [--check] [file.md ...]` - writes a table of contents between `<!-- toc
  (tools/docs/toc.mjs) -->` and `<!-- /toc -->` at the top of each file (after its `#` title): a line per `##` and
  deeper heading with its line number and the section's size in KB (subsections counted in). Default files:
  `docs/agents/shared-rooms.md`, `shell.md`, `studio.md`, `stories.md`, `packages.md`, `testing.md`. The line numbers
  are those of the file with its table. Run it after editing one of them; `--check` exits 1 when a table is missing or
  not current. Headings inside ``` fences are skipped.
- `node tools/docs/kept.mjs <old file | git rev:path> <new file>... [--allow <file>]` - the loss check for a
  restructured doc: the old text cut into headings, bullets, paragraphs and table cells, then sentences (after `.`,
  `!`, `?` or `;`), each normalised (markdown marks, links, HTML comments and the generated tables out, whitespace
  collapsed, a final `.`, `;`, `:` or `,` dropped) and looked for in the new files run together. Every piece found
  nowhere is printed with its old line number; exit 1 if any. `--allow` names a file of pieces that may go (one a
  line, as printed; `#` a comment), so what was dropped on purpose is written down. Example: `node tools/docs/kept.mjs
  HEAD:docs/agents/shell.md docs/agents/shell.md docs/history.md`.
- `node tools/release.mjs` also writes the state line (release, shell, room format, `whatsnew.json`'s date) between
  `<!-- state (tools/release.mjs) -->` and `<!-- /state -->` in `HANDOVER.md` and `docs/setup-and-release.md`;
  `--check` fails while it is not current or a file has lost its markers.

## The smoke test (`tools/smoke.mjs`)

`node tools/smoke.mjs <url>` is the one test every change runs before `main` moves. It needs Playwright with
Chromium and a plain file server for the folder (not the relay's `--static`, which serves no `tools/`). Since v218: a
step that throws fails with its message and the run goes on; `--only` that matches no block or step fails (since the
audit's row K it also prints the block ids); `--list` prints every block and step name and exits; what this machine lacks
(`ffmpeg` for the studio's screens, a shell without `HOST.collab.trkIn`) fails unless `--skip-missing` is given.
`SHOTS=<dir>` saves pictures in the blocks that take them; `SMOKE_SHOW=1` prints a failure's text under its line. The
whole run fails on any console error (a 404 for a missing narration MP3 is expected).

**The whole run by block** (row K, 27 November 2026): one process takes about 1.5 h. `node tools/smoke-all.mjs [url]`
runs every block as `node tools/smoke.mjs <url> --block <id>`, `-j 2` at a time (the default; more on a machine with few
cores brings timing failures) against one server (its own on a free port, `tools/lib/serve.mjs`, unless a url is given),
each under its own timeout (900 s, a few long blocks more: `LONG` in the file), and prints one table (block, ok, FAILED or
TIMEOUT, seconds, steps); each block's output in `--logs <dir>` with `results.json`. `--shard i/n` takes every n-th block
(for several sessions), `--blocks a,b` some, `--from <id>` the rest of a run. `--timeout <s>` sets the default time-out (900); `--skip-missing` is passed on to each block. A block past its time is stopped with SIGTERM (Playwright then normally closes its browser) and SIGKILL 15 s later, which reaches only the node process: after a TIMEOUT, look for stray chrome/chromium processes before trusting later blocks' timings; stopping them is the person's step (no `kill` by an agent). A block that failed is run again alone
(`--block <id>`) before it is called real.

**The pretend headsets' seats** (the owner, 27 November 2026, after a headset fault the tests could not see: "put the
test headsets about 180 cm in each direction around origin so that we catch things like this in future runs"): every
browser context is one pretend headset at its own seat, `XR_SEATS` in `tools/smoke.mjs` ((1.8, 1.8) turned 37 degrees,
(-1.8, 1.8) -128, (1.8, -1.8) 143, (-1.8, -1.8) -52, in turn), its head 1.6 m up. `XR_SEAT` puts `window.__xrSeat` in
the page before anything else: the one place a fake's head, eyes and controllers come from (`m(mat, lift)`, `p`, `q`,
`pose`; the controllers in the head's frame, so they move with it). `FPS_FAKE`, `OCCL_FAKE`, `PHONE_FAKE`, `CTRL_FAKE`
and the pages' own pretend sessions take it; `tools/perf.mjs` reads `FPS_FAKE` and `OCCL_FAKE` without a seat (the
origin, as before). `browser.newContext({ xrSeat: 'origin' })` gives one check the origin (say why where it asks);
`SMOKE_SEAT=origin` puts every headset back there, to tell a red the seat brings out from one it does not. The
`trackers` block keeps its own pretend room (a head already off the origin and turned).

What the main run (no `--only`) holds besides the blocks: every story and the studio loaded, scrubbed, played as a
slideshow and explored, the panes' numbers checked against the data where a story looks them up; the load steps (no
task longer than `LOAD_LIMIT`, 4 s: SwiftShader compiles one shader at a time); the loading scene in VR and AR; anchored
placement; the headset's settings; the sound-effect cues; focus mode and the top bar on phones and tablets; (after
v226, 27 November 2026) every story's draw hooks (`onBeforeRender`) given a headset's eye camera and leaving it where
it is (an eye camera of the test's own, not locked: it checks the story, whatever the shell's lock).

`eye lock` (v228, own page, about 30 s): the shell's lock on a headset's eyes (`docs/agents/shell.md`, "The headset's
eyes are the shell's"). Under the occlusion block's pretend headset (`OCCL_FAKE`, two views) three.js r128's own
`WebXRManager` poses the cameras; three probes in the story's scene, drawn for each eye, note each eye's
`matrixWorld` and `matrixWorldInverse`, call `getWorldDirection`, `getWorldPosition`, `getWorldQuaternion`,
`getWorldScale`, `lookAt`, `position.set`, `updateMatrix`, `updateMatrixWorld` and `updateWorldMatrix` on it, and
compare, and the scene's own hook does the same to the `ArrayCamera`; `getWorldDirection` must also give the direction
three.js's pose has, and `HOST.xrEyes` must hold three cameras. In VR (airports), after `HOST.go('proteins')` in the same
session (`xrAdopt`) and in AR after that session ended. A last step leaves `xr.enabled` off and a render target set
and expects both put back after one frame (`settle`). With the lock taken out every check fails (the eyes and the
`ArrayCamera` moved, the direction wrong; `HOST.xrEyes` empty), and with `settle` taken out the last step fails.

### Smoke blocks

One row a block. Run one with `--block '<id>'` (exactly that block; `--only` below matches by prefix). Times are what a
block took on a quiet machine; "own page" means it opens a page (or two) of its own. Besides these rows, `--blocks`
names the groups of the main page's steps: `start page` (the landing page, no story fetched), each story by its key
(load, scrub, slideshow, cues, explore, draw hooks, its own steps, its load in steps and its anchored placement),
`switch while loading`, `parked` (the design room), `repeat` (Repeat one and Repeat all), `headset settings` (its own
page: labels, cards, free moving, subtitles, panels, the frame-rate read-out, the keypad), `focus mode` (with phones,
tablets, iPhone) and `old links`.

| Block (`--only ...`) | Page and time | What it protects; traps |
| --- | --- | --- |
| `start page` | a few seconds | the start page asks for no story's `main.js` and no narration; the worker's install has cached every listed `main.js` and miniature |
| `start page headset` | own page, about 20 s | Enter VR from the start page with a pretend Quest: a real `selectstart` reaches the first story's controller; a failed load ends the session and says why. Runs alone, not with the main page |
| `headset` (also `focus mode`, `phones`, `tablets`, `iPhone`) | mixed pages | the headset settings, focus mode, phone and tablet bars. The mixed block runs only without `--only`; the other four words run alone |
| `packages order` | seconds | both Stories screens follow `packages/order.json` (main set, Experiments set, link cards, tutorial last) |
| `take all` | own page, 1-2 min, about 100 MB | *Take all stories* fills the packages' cache; a story never opened answers offline |
| `away idle` | own page, 1-2 min | the away lines (`xrIdle`) in every story and page; what the airports, qubits and flock do at a station and away |
| `uploads` | own page, 1-2 min | a paused story sends no buffer to the graphics card; the robots' floor goes as trail boxes |
| `stick moving` | own page, 1-2 min | moving with the sticks, smooth turning, the menu on a stick click, an anchor not moving with you |
| `spaceship` | own page, a few minutes | launch, steering, boost, shield and health, drones, pickups, relay time. Timing-sensitive: its steps wait past the first second (test fix at 8c59e50) |
| `goggles` | own page, 640 x 400, about 1 min | the studio's VR goggles: taken by the grip, on at the face, nothing written; `flight.js` loaded |
| `occlusion` | own page | real-world occlusion with a pretend AR depth layer: hidden where nearer, both eyes, smooth edges, sleep and wake, watchdog, context loss. Depth is never paused |
| `eye lock` | own page | (v228) the shell's lock on a headset's eye cameras: a draw hook calling `getWorldDirection` ... `updateWorldMatrix` on them leaves them where three.js put them (VR, after a change of story, AR), and a frame left drawing elsewhere is put back (see the paragraph above the table) |
| `frame rate` | own page, about 5 min | `FPS_FAKE` pretend Quest: refresh-rate ladder, foveation, the read-out and double B. Do not rename `FPS_FAKE` (perf reads it) |
| `auto quality` | own page; run on a quiet machine | automatic quality's steps (rate, foveation, viewport scale), `#aq=off` |
| `sharp text` | own page | the panels and the menu as WebXR quad layers on a pretend Quest (`SHARP_FAKE`) |
| `perf run` | three own pages, 640 x 400, about 4 min | the performance run (`perfrun.js`) much shortened: on a page three stories (proteins refused by a stubbed `HOST.load`), one chapter, a second or two a segment, the test example `tiny`; the result's shape, the failure passed over, automatic quality pinned off and put back, a reload in the middle picked up (flock recorded as cut by it); then in a pretend Quest (`FPS_FAKE`) the run in the session (its read-out, its results card's regions) and the hands-on part (one step done, one skipped, the AR step passed over in VR); v230: developer mode's two cards on the Experiments set (`perfrun-card`, `handson-card`; a third page): absent with it off, after the Tracker guide and before the card back with it on, their pictures, their lengths from `HOST.perfRun.minutes()`, `HOST.listRev` moving on as it is switched, a page press opening the start card (nothing started), `HOST.stories()` unchanged, and in a pretend Quest the arch's cards added and gone as it is switched, the card's region pressed starting the run-through at once. Like the rest of the block, the cards' lengths need `perfrun.js` to match `MODS_FP` (a released checkout, or a scratch copy stamped by `tools/release.mjs`). `notes.js` stays unloaded until `tools/release.mjs` stamps its fingerprint, so the run log's part is checked by hand (`docs/agents/shell.md`, "The performance run") |
| `developer mode` | own page, a few minutes | the version card, What is new, Got it/Later, the release step. Its two *Older and Newer* steps need v142 to be served |
| `update the room` | own page in a room on this device, 1-2 min | the Shared dialog's Reload this device, armed by a first press; the order reaches the other tabs |
| `phone ar` | two own pages, 1-2 min | a pretend Android phone's AR through `dom-overlay`, the round button, screen taps as Chrome makes them |
| `controllers after standby` | own page, 1-2 min | `HOST.inputsGuard`: controllers back after a standby, before the story's frame |
| `trackers` | own page in a room on this device, 1-2 min | Vive trackers through `HOST.collab.trkIn`: smoothing, extrapolation, bad rows, the pose kept when not seen |
| `bodies` | own page, a room on this device | people's bodies with a pretend Quest (`FPS_FAKE`) in a room on this device; what a body costs a frame |
| `talk` | four own contexts, 1-2 min | Talk's functions, off by default; counts `getUserMedia` and `AudioContext` calls |
| `studio` | `#studio&scenes=tools/studio/test/scenes&scene=test&edit`, no relay | the studio's main block and its numbered pages: files and sizes, clips, cards, the layout, items and their features |
| `studio textures` | `&scene=textures` | the texture ladder (TIFF, PSD, DDS read in the page), refused pictures, the cards' lines |
| `studio follow` | `&scene=rig` | a sound following a bone of a skinned dancer, every frame and clip frame |
| `studio cuts` | `&scene=cuts` | cut-outs proved by pixels (one file, two objects) |
| `studio groups` | `&scene=rig` | Make a group: pick mode, one Undo step each |
| `studio faces` | `&scene=rig` | *As in the file*, *Inside out*, *Both sides*, by pixels |
| `studio tint` | `&scene=rig` | a tint and brightness by pixels, kept through a save |
| `studio colour` | about 1 min | the colour picker on a page and on the headset's card; one Undo step a drag |
| `studio viewer` | `&scene=test` | the model viewer's Look and Preview over the window; Fewer triangles' Look closer |
| `studio ktx2` | about 1 min, KTX2 default (`studioTex: null`) | KTX2 textures written, loaded and drawn against their pictures. Every other page starts with *JPEG/PNG, up to 2k* |
| `studio shapes` | `&scene=test` | the Add pane's shapes and empty |
| `studio behaviours` | `&scene=test`, held clock | look, follow, keep away: the formulas at set moments |
| `studio motions` | two own pages | each motion kind's pose at two moments against its formula |
| `studio paths` | `&scene=test` | recording by a pretend grip, thinning to keys, replay |
| `studio walks` | `&scene=walks&edit`, about 1 min | walk in place, idle, walk forward, `norm`'s rules for `anim: 'move'` |
| `studio recorder` | own relay, fake microphone, about 2 min | a ten-minute page recording and uploads read back from disk |
| `studio texture swaps` | about 2 min | switching a texture by meshes and names |
| `studio cube starts` | about 3 min | trigger cubes starting clips and what they start |
| `studio cube switches` | about 2 min | cubes holding cubes, switches, held clocks (`behNow`, `trgClock`) |
| `studio sequences` | about 2 min | the record's rules and every event kind. See the known red step below |
| `studio press` | a few minutes | `pr.<id>` presses, `who: 'own'`, hover sends |
| `studio streams`, `studio loops`, `studio trails` | 1-2 min each | stream entries, loops on the beat, trails |
| `studio sends` | a couple of minutes, its own page at `&scene=test&edit` with the studio's clocks held by the test | the send entries' rules (a cube's, a press's, a sequence's: `on`, note and cc, a hold on leaving, a bad address, at most 8), the state and `layout.json` carrying them, the cards on both twins (`tools/studio/SPEC.md`, "Sends to the output page (MIDI and OSC)"; `docs/history/testing.md`, "smoke: studio sends") |
| `studio edit speed` | about 1 min | edit mode costs nothing when idle (hover, selection) |
| `studio everyone` | two own pages, about 1 min | each-person cubes with another person's head |
| `studio walls` | about 1 min | shapes on pretend walls |
| `studio shows` | under 1 min | shown in AR only, VR only, or on a page |
| `studio screens` | a few minutes; needs `ffmpeg` | screens and audio players from WebM clips (Chromium has no H.264 or AAC); skipped with `--skip-missing` |
| `studio paint` | a few minutes | the four brushes, a real pointer drag, Eraser, the 4,000-point limit |
| `studio examples` | about 4 min | the test example opens read only; the headset's Scene pane |
| `studio trackers` | about 1 min | a pretend station's trackers (`HOST.collab.trackers` stubbed) |
| `studio puppet` | two pages, under 2 min | trackers on a rig's bones through `ik.js`, seeded offsets |
| `studio live` | about 1 min | live sound: 50 Opus frames through `HOST.collab.liveFx` and `liveIn`; skipped, said, without `AudioEncoder` |
| `studio xp` | about 2 min | the Bliss XP room: each model under 30,000 triangles, the room under 250,000 |
| `studio tour` | about 1 min | the studio tour: each model under 10,000 triangles, the scene under 60,000 |
| `studio guide` | about 1 min | the Experiments set's link cards; the tracker guide opens the studio visiting |

### `--only <words>` and `--block <id>`

`--block <id>` runs exactly one block (an id `--blocks` prints) and every step in it, whatever the steps' names; an id
that names nothing fails and prints the ids. `--only <words>` runs only the steps whose names start with the words and
the blocks whose ids start with them, or that the words start with (each block of steps is guarded by its id,
`runs(...)`, or a group of the main page's steps by `inGroup(...)`, which only `--block` reads; the headset settings,
a block of mixed names, runs without `--only`, with `--block` or with exactly `--only 'headset settings'`; focus mode and
phones and tablets run with `--only 'focus mode'`, `phones`, `tablets` or `iPhone`): `--only studio` every studio block
(about a quarter of the run: as one run it passed 900 s, so `--block studio` is the main studio block alone and
`smoke-all.mjs` runs the others one by one), `--only 'studio texture swaps'` one block, `--only tutorial` one story's
steps (its `load <key>` step always runs with its block, v179: before, it was filtered out by its own name and the
story's steps ran on the page's default story). A match of nothing fails and prints the ids. For a builder's own steps;
the release run is the whole test (`smoke-all.mjs`).

Not in any block: `hello`, `cellstress` and `crowds` are Experiments that are no app story (`packages/order.json` does not name
them, so `STORY_KEYS` leaves them out): `node tools/packages/check.mjs packages/<key> --load` covers them (and their
builds' `--check`). The notebook (`notes.js`) has no block of its own: the `sharp text` block's step *a notebook picture
pauses the layers* is the only smoke check that reaches it; the rest is untested here.

### Playwright, SwiftShader and what only a headset shows

It needs Playwright with a Chromium build (`npm i --no-save playwright` and
`npx playwright install chromium` once, or a global install; see
`docs/setup-and-release.md`). A 404 for a missing narration MP3 is expected and ignored.
WebGL runs in software (SwiftShader) headlessly, so frame rates are low;
real-headset behaviour (controllers, session hand-over between stories,
placement and comfort) can only be confirmed on a device - say so when you
report results.

### The headset bench: testing on the real Quest from the cloud (v232)

When a change can only be judged on the owner's Quest 3 (a frame rate, a picking cost, a picture of what an eye draws,
a setting's effect in a real session) and the owner has left a headset in bench mode (`docs/agents/shell.md`, "The
headset bench"; `tools/bench/SPEC.md`), the cloud runs it there itself: `node tools/bench/bench.mjs status`, then
`send <cmd> ...` or `run <plan>` (`quick` a few minutes, `dev` about 15, `picking`), `show`, `pic`; a probe not yet
committed with `script <file.js>` (only where the relay runs `--bench-scripts`; exit 2 otherwise: commit it as a probe). It needs the test
place's relay (started with `--bench`) and its password (`NOTES_TOKEN`); exit 3 means no headset listens: say so and
report the change as untested on a device. Use it after a push to `dev` has deployed (the headset runs what the test
place serves; a new shell needs a person, or the adb helper, to enter AR again), one job at a time, and post its
pictures to the chat. It cannot show: the room through passthrough, comfort, sound as heard, what a person's hands do,
the system's own menus or permission questions, and anything the shell draws on Sharp text layers the read-back misses;
its frame figures are the page's (`requestAnimationFrame` intervals, script ms), the headset's own (VrApi: GPU load,
stale frames, temperature) come only with the adb helper (`tools/bench/adb/`). A result from the bench is a device
result: say which headset (`hs`), release and settings it ran with. Jobs read and done with can go (`delete <id>` or
`delete --state done,failed,cancelled,expired`); the relay deletes ended jobs after 14 days anyway. Helper jobs go with
`send <cmd> --to adb` (`devshot`, `enter`, `open`, `vrapi from= to= job=`).

`node tools/bench/test.mjs [--shots dir]` (about 6 min) is the bench's own test in headless Chromium: its own relay
(`--bench`, a random password, a free port), the smoke test's pretend AR headset (`XR_SEAT`, `FPS_FAKE` read out of
`tools/smoke.mjs`, its frames on the page's clock), and only `tools/bench/bench.mjs` to drive it (script jobs on a second
relay with `--bench-scripts`, on a page without a session; the fixed view, v233, on a second pretend headset lying
pitched and rolled near the floor, `XR_LYING`, with offset spaces the smoke fake lacks, `XR_OFFSETS`); `node relay/test.mjs
--bench` is the relay's part (seconds). Run both after touching `bench.js`, `relay/bench.mjs`, the bench's routes or
`tools/bench/bench.mjs`. `node tools/bench/adb/test.mjs [--tmp dir]` (about 2 min) is the adb helper's, against a
stand-in adb, a stand-in relay and a local Chromium (a headset clock five minutes ahead, a pinch-zoomed page among its
checks); run it after touching `tools/bench/adb/` or `HOST.bench.state()`.

## Shared rooms: `relay/test.mjs` and `tools/collab.mjs`

Run both after touching `shared.js`, the relay, a story's `collab` hooks or `state()`. `node tools/collab.mjs --list`
prints every flag, `--list --checks` every check's name under its round (689 at row K, 27 November 2026).

**`node relay/test.mjs`** (starts its own relay): the protocol (rooms, writes and their order, the epoch
rule, `fx`, timeouts, bad frames, static serving, the password), rooms on this network (`/api/near`, `--proxy`), the
introduction server at `/peerjs`, `--watch`, the logs, the notebook, video conversion, OSC, live sound, Talk, trackers
and the shared networks. Its parts run alone with `--nets`, `--logs`, `--notes`, `--video`, `--rooms`, `--osc`, `--snd`,
`--talk` or `--trackers`. It checks every file `sw.js` `SHELL` names. After a relay change that delays replies (v220's
20 ms corking) a straggler after a reply can break a `q.length = 0` pattern: the test waits 60 ms. The full list of what
`relay/test.mjs` checks is `relay/docs/testing.md`; the old retelling is in `docs/history/testing.md`, section "relay/test.mjs".

**`node tools/collab.mjs`** (a full run reaches its end in about 50 minutes on this machine, 26 rounds; starts its own relay
with `--static .` on a free port, so no server is needed). The main
run is the per-story part (three pages in a room follow each story's station: play, pause, jumps, mode changes, Replay,
the relay's clock, the explore state, the story's effect, its sound cues), then the rounds marked *main* below, then
peer to peer, rooms on this network and room names. `--quick` runs only the last story of the per-story part; `--port
<n>` fixes the relay's port; `--shots <dir>` saves pictures. Every round uses its own room. Since 436195f the rounds wait
until the pretend headsets are lined up (the 5 s gate), not a fixed 300 ms: keep that when adding a round, with `alignedAll(headsets)`
(`tools/collab.mjs`; it steps the frames until `HOST.room.aligned`, 30 s at most). The reason: a headset takes a frame published for
its shared space only once its socket has been open 5 s (the room's members known: `shared.js` align's early), so a fixed wait
can fall before that and a headset whose frames stop between steps stays waiting.

Each round runs inside `round()` (row K): a throw is that round's FAIL with the error, and the next round runs; a dead
browser is launched again and a dead main relay restarted on its port; the run ends with a table of the rounds and the line
*N of M rounds failed: C checks failed, T rounds threw* (exit 1 on any failure). Relays take free ports (`relayOn`:
`--port 0`; the reload round: `freePort()`).

| Flag | Round (function) | What it protects |
| --- | --- | --- |
| (none) | main run, per story | station following, effects, cues across three pages; Arrange all, Remove asks first |
| `--p2p` | peer to peer (main) | a room hosted by a page, through the relay's own `/peerjs` only (never PeerJS's public server) |
| `--near` | rooms on this network (main) | `/api/near` and a room listed on its members' network, with a proxy per pretend network |
| `--names` | `namesRound` (main) | a room's name cleaned, kept and shown elsewhere |
| `--code` | `codeRound` (main) | Join with a code from a headset's menu: keypad, Join greyed until three letters |
| `--all` | `allRound` (main) | the All stories and Back to the lobby circles; a landing card starts a story for everyone |
| `--guide` | `guideRound` (main) | the room setup guide and Touch the spot |
| `--calib` | `calibRound` (not in the main run) | the owner's calibration alone in a fresh room in AR (limited menu, a new XRFrame each frame, the shell's frame before or after the story's): lined up, the crosses and their line on the spots |
| `--places` | `placesRound` (main) | a calibration kept per room. Known red once: budget and one-anchor, see below |
| `--areas` | `areasRound` (main) | more tape crosses in one room |
| `--reload` (`--cases a,b`) | `reloadRound` (main) | rooms across updates and Update the room: six cases on its own relay on a free port (8712 before row K), restarted as a deploy. (5) was red until v227 (the app's: a peer-to-peer host hosted again on reconnecting) |
| `--follow` | `personFollow` (main) | following a person; `--shots` saves the people list |
| `--circles` | `headsetRound` (main) | the ten-headset round: cards, icons and name tags by the Cards setting, circles |
| `--ask` | `askRound` (main) | circles asked first (the only devices without `collabAskDefault` = `walk`) |
| `--menus` | `menusRound` (main) | your menu shown to your circle (`MENUS_STORY=studio` for a studio circle) |
| `--smooth` | `smoothRound` (main) | others' moves drawn smoothly: 15 writes a second with `ts` and `h`, no jumps |
| `--standby` | `standbyRound` (main) | the pretend headset's standby with the shared space in use |
| `--narration` | `narrationRound` (main) | narration in headsets and the welcome (pointable since v182) |
| `--walk` | `walkRound` (main) | moving with the sticks for a VR headset elsewhere in a room. Its `headAt` crash is fixed (row K): it was the room-on-this-device block walking to an Experiment's station |
| `--ships` | `shipsRound` (main) | spaceships in a shared room: launch, pilots, pickups, drones |
| `--camera` | `cameraRound` (main) | camera mode with a pretend Quest and a pretend Android phone |
| `--preview` | `previewRound` (main), about 4 min | the desktop preview camera |
| `--studio` | `studioRound` (main), about 3 min | the studio in a room: Studio here, the scene's frame the room's |
| `--studio-scenes` | `scenesRound` (main) | the relay's scenes as circles (`--scenes-readonly`) |
| `--behave` | `behaveRound` (main) | the studio's behaviours shared: follow, look, keep away |
| `--trackers` | `trackersRound` (main), 3-5 min | the PC's Vive trackers: bridge, shell and studio through a relay; relays on free ports |
| `--output` | `outputRound` (main), 4-5 min | the output page, MIDI and OSC, to a UDP listener |
| `--home` | `homeRound` (main), under 1 min | the relay the main site offers (the site's names resolved to this machine) |
| `--token` | `tokenRound` (not in the main run) | the relay's password: the dialog's field, a wrong one refused, nothing in a log |
| `--arr` | `arrRound` (not in the main run) | a story's copy on the relay (*Copy to relay*, the editor) |
| `--net` | `netRound` (not in the main run), a few minutes | the cell story's shared networks |
| `--talk` | `talkRound` (not in the main run), a minute | Talk end to end with the fake microphone |
| `--design` | gone since v217 | says so and exits |

`--help` prints the flags and exits (it no longer runs the suite).

## Other tools

One row a tool; each is a Node script run from the repository's root.

| Tool | Run after | What it checks; traps |
| --- | --- | --- |
| `node tools/audio.mjs [url]` (`--list`, `--list --checks`, `--help`) | sound | 43 steps, about 20 min; no url: it serves the folder itself on a free port. A strict autoplay rule (a locked `AudioContext`, a tap), the start page with nothing behind its cards (v219: a step opens a story by a card's click or a link, `#airports`; v227: the start page shows Sound off before a tap, Sound pressed there is kept for the story picked next, and with sound stored on it says Play sound), narration and sound-effect switches, the headset menu's rows (its pretend headset at smoke's first seat, off the origin), the stories' cues, the voice limit. How sound really sounds only by ear |
| `node tools/sfx-cues.mjs <url> <key\|all>` | cues | below |
| `node tools/smoke-all.mjs [url]` | the release run | the smoke test block by block, two at a time, one table (above, "The whole run by block"); a block that exits 0 with no step run and none skipped is EMPTY, not ok. `smoke.mjs --block` or `--only` with nothing after them prints the ids and exits 1 (it ran the whole test before) |
| `node tools/live.mjs [--port n] [--relay-port n]` | `HOST.live`, `HOST.swap`, `HOST.load`, `release.mjs`, the relay's `--watch` | a few minutes; a story added, changed and swapped live in a temporary copy of the app. Two free ports unless named (row K: two runs no longer collide on 8126 and 8127). The "within about 2 s" step allows 3 s and can still miss on a loaded machine. A story's `APP` is called only once it is built (`built()` first): before row K the step after *a shell file touched* could reach airports' `setClosedAttributes` on a reloading page (*TypeError reading 'aXrm'*), the test's, not the app's |
| `node tools/update.mjs <old> [new] [--port n]` | `sw.js`, file loading | an old checkout installed, this one served like GitHub Pages, both on one free port (the worker's origin; 8125 before row K): page and stories new on the first visit, the next and offline. It waits up to a minute for the packages' cache (about 17 MB) |
| `tools/lib/serve.mjs` | (the tests' kit) | Node built-ins only: `serve(dir, { port, pages })` (GitHub Pages' caching with `pages`, a plain no-cache server with a folder's listing without), `freePort()`, `portArg()`; `smoke-all.mjs`, `live.mjs` and `update.mjs` use it |
| `node tools/room-test.mjs [--port n]` | `room-test/` | about 1 min; its own relay on a free port (8131 before row K); a pretend headset with a real depth texture array; it still stands at the origin (no seat, not moved off it as smoke's and collab's were), so it cannot catch an origin-only fault |
| `node tools/output/test-page.mjs` | `output.js` | the output page's MIDI, OSC and clock |
| `node tools/bench/test.mjs [--shots dir]`, `node relay/test.mjs --bench` | `bench.js`, `relay/bench.mjs`, `tools/bench/bench.mjs` | the headset bench (above, "The headset bench"); the cloud's tool on the real headset is `tools/bench/bench.mjs` |
| `node tools/notes/notes.mjs perfrun <a> [<b>] [--md f]` | (reading, not a test) | the performance run's results as a Markdown table, or two compared segment by segment; each a run log's id on the relay (`NOTES_RELAY`, `NOTES_TOKEN`), its pulled `log.json` or a page's *Download JSON* file. Headless numbers are software drawing: they mean nothing for a headset |
| `node tools/perf.mjs` | (measuring, not a test) | exits 0 always; script ms and counts, never GPU time; reads `FPS_FAKE` and `OCCL_FAKE` out of `tools/smoke.mjs`: do not rename them; run groups of scenes (about 90 in a run exceeds a background limit); `--from` compares two runs |
| `packages/<key>/src/shot.mjs`, `sweep.mjs`, `test-*.mjs` | a story's maths, data or sets | a set harness first (cheap), then the story at a few seconds, then the smoke test; plain Node data tests of a second or two. Each story's own list: its `README.md` |
| `node tools/studio/scan.mjs <folder> [--check]` | the test scene | writes `index.json` and `files.json` as the relay's API answers them |
| `node tools/studio/convert.mjs <model>` | the converter | converts with the studio's own converter in a headless page, checks the GLB against the original, writes nothing on a mismatch (exit 1); `--ktx2`, `--textures`, `--texture`, `--shots` |
| `node tools/studio/test-images.mjs` | `engine/images.js`, `test/pictures.mjs` | no browser, seconds: picture kinds read back, refusals, gap fill (then `tools/studio/test/make.mjs`) |
| `node tools/studio/test-ktx2.mjs` | `engine/ktx2.js`, `basis/` | no browser, seconds: the KTX2 container, strips, mip chain |
| `node tools/studio/test-ik.mjs` | `ik.js`, `bodies.js`'s grips, the puppet scene | under a second, 76 checks at v216: the tracker solver against a rig's truth, and a headset alone |
| `node tools/engine/same.mjs`, `xrsame.mjs`, `panelsame.mjs` `<before> <after>` | a change meant to change nothing in the shared engine | pictures, headset values and panel draws of two checkouts compared. `same.mjs` gives 0.00% at paused moments; explore mode moves by itself (0 to 3%, nmd up to 19%); a set still building: run again with `--wait 3000` |
| `node tools/packages/scan.mjs --check` | every push to `dev` | `packages/index.json` is current and no folder in `packages/` is left out |
| `node tools/packages/check.mjs packages/<key> [--build] [--load] [--phone]` | a package or the template | the package rules of `tools/packages/SPEC.md`, one line a finding (`FAIL` or `warn`); `--load` runs the package's code in a page (read it first), `--build` its build script. The example `packages/hello` passes with `--load --phone` |

## `tools/sfx-cues.mjs` and `tools/sfx-render.mjs`

After changing a story's sound cues, run `node tools/sfx-cues.mjs
http://127.0.0.1:8123/ <key>` (seconds; `all` for every story and the studio; the app's own stories on either set of cards, the Experiments set's too since v189): every name a sound the shell knows, every place finite, every time within
the story, 6 to 60 cues (the tour up to 80, the tutorial up to 70; the flock, the robots and the studio at least 1), at most 4 onsets in 3 s outside a marked sequence, no two of
one sound closer than its gap, at most 6 cue voices and 2 continuous sounds at
once; then render the story's track for the owner (`node tools/sfx-render.mjs
http://127.0.0.1:8123/ <out> --story <key>`) and report how it sounds as unheard.

## Known red results on this machine

Running is free; chasing red costs tokens, and most red results were the test's or the machine's (AGENTS.md, "Testing").
These are known, so a red there is not a regression until proved otherwise. Where a line gives no cause, none is
written down in the repository: the first person to chase one writes it here and in `docs/history/testing.md`.

| Where | What is red | What is known |
| --- | --- | --- |
| smoke, `anchored placement: no word while the saved place is being looked for` | no longer (row K, 27 November 2026) | the test's: its `N.wait` of 60 ms ran out during the first frames of a story just started under `--only`, so the status said *not found* before it was read. Now 2 s, and frames until *not found* (up to 10 s) instead of one sleep of 100 ms: it proves the status says *Finding* while the place is looked for and *not found* once the wait has passed |
| collab `--walk` (`walkRound`): the `headAt` crash | fixed (row K, 27 November 2026) | the test's: the room-on-this-device block walked to the flock's station, and Arrange all never places Experiments, so `headAt(undefined)` threw. It walks to a station the room has |
| collab main run, pretend-headset part: *headset: unused, the menu closes by itself; a ray resting on it keeps it open ...* (`idleHeld`) | flaky under load, row K's `--quick` | the test's: the ray counts as use only in a frame that finds its rest under 250 ms old (`shared.js` `hovOf`), and with `menuIdle(600)` one or two long software frames closed the menu. Since the review round the hold is 3.2 s against an idle time of 1.5 s; not yet run green at load |
| collab main run: *a room on this device: Re-align with nothing to line up with keeps the stations where they are (the menu fits, also with a long note)* | intermittent (red in two `--quick` runs of three; red in both runs on v227, the full one and a `--quick`, not compared with v226) | the Circles tab drawn with only its header and tabs (vis 264 px, panel shown); cause not found. The check's detail now prints the rows drawn and whether the panel shows |
| collab main run: *headset: in explore mode Recenter also puts the view back where the story put it there (not where the room had turned it), for everyone at its circle* | once, in v227's full run; green in a `--quick` run alone | the check's own 6 s wait for the turned view never saw it applied (`rcThere` false), so Recenter was never reached; taken for a timing flake on a loaded machine, cause not proven |
| collab `--token`: *the right one is accepted ... the field goes* | no longer (27 November 2026; red on v225 too) | the test's: the dialog redraws through `changed()` 60 ms after the password is accepted, about 45 ms after the room opens, and the field was read once at once (measured: open at 40 ms, field gone at 85 ms, read at 100-130 ms; a busy machine read it first). Now waited for, 5 s: it proves the field goes |
| collab main run, pretend-headset part: *with tracked hands two quick pinches ... open and close the menu* | red once in the review round's `--quick` at a load average near 10 (`pinch2Closed` false, so every later pinch read the menu still open); green in the next run at 5 | timing under load: a pair must land within 0.4 s, on timers the loaded page runs late |
| collab `--places`: the budget and one-anchor checks | red once (q10: `fit10` null, the *places fitted* log never came), green in four other runs | cause unknown |
| collab, timing under heavy load | green alone or in the full run | smooth steadiness, preview keys and keyboard rate, the p2p clock *without a jump*, the studio voice *heard* timing, `--all` page B following, `--near` rejoin |
| smoke `studio sequences`: *a second page at the same held room time draws the same moment* | no longer (row K) | the test's: a fade's alpha steps with each frame's dt, and both pages' own frame loops ran between the test's held frames (page one, older and busier, 0.75 against page two's 0.25 at 1.6 s). Both loops are held for the comparison: it proves two pages at the same held room time, stepped through the same frames, show the same moment |
| smoke `spaceship: pickups (times shortened)`, *rapid fire for a second* | flaky (5 and 8 bolts seen once each, none in row K's runs) | rapid fire was off for all or part of the second, on the test's own clock; no cause found by reading `ships.js` (`take`, `land`, the shot interval all on the frame's time). The failure now prints the ship's rapid time, health and log, so the next red names it |
| smoke `--only studio` as one run | timed out at 900 s | it is every studio block, about a quarter of the run: `--block studio` is the main block alone, `smoke-all.mjs` the rest one by one |
| smoke `headset settings`, *panels per story*: *on the Stories screen ... its panels shown false* and *no panels or cards lines in studio* | no longer (row K; red at the origin too, so not the seat's) | the test's: the headset draws at most one Stories-screen card a frame and shows a card once drawn, so three frames were too few (now frames until all show, 60 at most); the studio's line goes on with `&& !gogHide()` since v203 (the shared part is what is checked now). Its Story-tab press waits for the foot bar drawn again in story mode |
| smoke notices read as "the last one" (`stick moving`'s walk notice, `headset settings`' *Frame rate: on/off*) | no longer (row K) | the session's own first notice, *The menu*, comes 2.5 s of real time in (`shared.js`) and on a loaded machine lands after the one the step reads: the steps read the latest notice of their own title (the frame rate's: given since a mark) |
| smoke `headset settings`, *the frame-rate read-out in the headset*: *the read-out does not show plausible numbers* ("Measuring") | no longer (27 November 2026; red 4 of 4, at the seat and the origin, on v225 too) | the test's: its loop stopped once `HOST.perf`'s second was in, while the shell's frame rate (`shared.js` `tick`, `FPS`) counts its own second from the session's first frame, here in the loop's slow first iteration. It now waits for the read-out's *N fps* line as well. The app is right to say *Measuring* for a session's first second |
| smoke `phone ar`, *the welcome says how a phone points*: *the notice The menu said []* | no longer (27 November 2026; once in a block-by-block run) | the test's: *The menu* comes 2.5 s into the session only with the 3D menu closed (`shared.js`), and *The full menu* step had it open until about 100 ms before then. The first step now waits for the notice |
| smoke `studio`, *studio v127: Play did not go on from where the slider held it*; `studio live`, *heard ... playing false* | once each in row K's full run (two blocks at a time, another builder's browsers too); green alone | timing under load (the live sound: the trap below, *the output page's live sound starves headlessly*) |
| smoke `goggles: the game on a page`, *the game is not drawn in the scene* | once in row K's runs and once in v227's (green alone), on a loaded machine; then green with the seat and at the origin | a timing flake, not the seat's |
| `relay/test.mjs --watch` (a relay stopped and restarted) | on Windows only: 5 failures about a relay stopped by SIGTERM | they come from Windows, with or without the fix; on this machine `--watch` passes |
| `tools/live.mjs`, the step "within about 2 s" | misses by a little on a loaded machine (seen in v190 and v226) | it allows 3 s |
| `tools/live.mjs`, *TypeError reading 'aXrm'* (airports' `setClosedAttributes` from `enterStory`) | no longer (row K) | the test's: the step after *a shell file touched* called the story's `APP.enterStory` on a page the relay's `--watch` reloaded a second time (one write of `index.html`, two reloads), on a story not yet built. The app calls `APP` only once a story is built (`HOST.putPlace` on its frame loop, `shared.js` after `collab.scene()`). The step waits for a built story on a page that has not reloaded for 2.5 s |
| smoke, `developer mode`: the two *Older and Newer* steps | fail on Windows with or without the v149 fix | they wait for v142 to be served |

A harness-only difference is never red: WebGL runs in software (SwiftShader), frame rates are low, and anything that
needs a real headset (controllers, placement, comfort, sound, occlusion, ships, frame rate) is untested until tried
there.

## Traps for a test writer

Found only by being bitten (the whole account is in `docs/history/testing.md`).

- **Steps wait on frames, not time.** In this suite's software drawing a layer's write takes a few hundred ms (Sharp text:
  only that block's page, and any page given Quest Browser's user agent, as the `phone ar` block's Quest is, asks for `layers`;
  every other pretend headset has Sharp text off by default, as a desktop browser does).
- **The pretend headsets stand off the origin: never assume the head at 0, 0, 0.** Since 27 November 2026 every pretend
  headset stands at its seat (`XR_SEATS`, about 1.8 m out in x and z, 1.6 m up, turned by a yaw that is no multiple of 90
  degrees; "The smoke test" above; the exception is `tools/room-test.mjs`, still at the origin), and its controllers move with its head. A check places what it looks at, aims a ray,
  or reads a place in the head's view through `window.__xrSeat` (`p`, `q`, `m`: from the head's frame to where the headset
  has it; the inverse of `m(identity, H)` back), never at a fixed spot in front of the origin facing -z. What it caught on
  its first day: checks that aimed at the menu from the origin (`controllers after standby`, `phone ar`), a test plane
  0.8 m ahead of the origin (`occlusion`), the ship expected ahead of a controller at the origin (`spaceship`), the head
  expected back at the origin (`stick moving`). Before it, a bug that puts an eye at the origin (a draw hook calling
  `camera.getWorldDirection` on three.js r128's eye camera, whose pose is only in its matrix: the exposome's cloud, v212
  to v226, the scene and the rays stuck to the head) drew the same picture as a right one: still check the eye's
  matrices too (the `<key>: draw hooks` step).
- **Collab's pretend headsets stand off their origin too** (row K, 27 November 2026): 1.8 m off their local origin in x and
  z, turned (`SPOTS`, `xrInstall` in `tools/collab.mjs`), one spot per device (browser context), kept across its sessions.
  Give a headset's own spaces as before and compute expectations in its coordinates through `ownPose(page, P)`;
  `{ origin: true }` only when a check truly needs the origin, saying why at the call. Offsets from the head go along its
  own right, up and forward (`byHead`), not the local axes. Every later session is checked to stand at its device's spot.
- **A ray, pinch or grip takes what its ray rested on in the last 250 ms** (`shared.js` `hovOf`); a software frame can be
  longer: date the rest (`hov.get(i).at = performance.now()`) right before firing, as a headset's next frame would. The
  window itself has its own check (*the grip ... takes only what its ray rested on in the last 250 ms*): keep it when
  stamping elsewhere.
- **Since v222 the menu redraws at most 10 times a second unless a press clears `OV.panel.sig`;** calling a row's fn alone
  does neither that nor update the idle clock. `installXR` wraps `menuFind` to clear the sig; give a round that types on
  the menu a long `menuIdle`.
- **Arrange all never places Experiments:** collab's main run adds them by hand (`NST` counts them); a round in its own room
  must Add any Experiment it walks to.
- **A frame can take over 250 ms in software.** So the window for a press's own events coming late is 5 s (`lateMs` in
  `tools/smoke.mjs`), not 250 ms.
- **The pretend controllers are held as a Quest's are** (`HOLD` in `tools/smoke.mjs`: grip -z ahead along the hand, +y
  up; the raised one straight up): they point as a person's do, palms in (v216).
- **The output page's live sound starves headlessly.** It reads and encodes the input on the page's main thread, which a
  page drawing in software (frames a hundred ms and more apart) starves: the pace (50 frames a second), the kbit/s and the
  count of frames are then printed as `note ... cannot be checked here`, never failed; alone the same pipe gives 50 a second
  headless. The owner checks those on a real device.
- **Windows.** On Windows `path.dirname(new URL(import.meta.url).pathname)` gives `/C:/...`, which makes `C:\C:\...`: a tool
  takes its folder with `fileURLToPath(import.meta.url)` (inside a smoke block that loads its modules with `await import()`,
  `(await import('node:url')).fileURLToPath(import.meta.url)`); a search for `import.meta.url).pathname` finds a slip. The Python
  data generators that write story data (`packages/endo/src`, `packages/soil/src`, `packages/topo/src` `data/gen_data.py`) open
  their output with `newline='\n'`, so a run on Windows writes LF too. A checkout whose files are still CRLF (made before
  `.gitattributes`' `* text=auto eol=lf`) turns LF on a clean tree with `git rm --cached -r -q .`, then `git reset --hard`
  (two commands: Windows PowerShell 5.1 has no `&&`; untracked and ignored files are kept: a person's step, never an agent's).

## Useful URL hashes and the console

The short list, then each story's own explore hashes in a table (the old one-paragraph list is in `docs/history/testing.md`,
"Useful URL hashes and the console"; some stories' `README.md` carry more).

| Story | Explore hashes |
| --- | --- |
| `spatial` | `#spatial&t=95`, `#spatial&explore&tab=moves&move=nfkb&now=1` |
| `proteins` | `#proteins&explore&q=TP53` |
| `lbi` | `#lbi&t=140`, `#lbi&explore&scene=atp&view=network&now=1`, `#lbi&explore&route=TP53,BRCA1` |
| `nmd` | `#nmd&explore&group=Cardiomyopathies`, `#nmd&explore&pick=5:13,11:7` (group:number), `#nmd&explore&walk=5` or `&walk=TTN,DES`, `#nmd&explore&inside` |
| `endo` | `#endo&explore&endo=2`, `#endo&explore&gene=COLQ`, `#endo&explore&tab=method&step=1&k=20`, `#endo&explore&scene=syn&view=cleft`, `#endo&explore&inside` |
| `pet` | `#pet&t=40`, `#pet&explore&tab=networks&net=C_high`, `#pet&explore&organ=muscle`, `#pet&explore&scene=scan&view=ring`, `#pet&explore&life` |
| `micro` | `#micro&t=100`, `#micro&explore&organ=Ovary`, `#micro&explore&tab=age&age=70`, `#micro&explore&scene=atlas&view=volcano` |
| `ovary` | `#ovary&t=200`, `#ovary&explore&kind=follicle`, `#ovary&explore&tab=age&age=60`, `#ovary&explore&scene=section&view=forest`, `#ovary&explore&scene=section&view=kinds&age=60`, `#ovary&explore&method=seg` |
| `qubits` | `#qubits&t=100`, `#qubits&explore&tab=network&net=blurred&cut=random&bits=2`, `#qubits&explore&brick=X2X1&alg=so6`, `#qubits&explore&sum=10`, `#qubits&explore&tab=depth&ex=on`, `#qubits&explore&scene=pairs&view=hoods` |
| `mutation` | `#mutation&t=100`, `#mutation&explore&tab=letters&mix=G` (or `mix=rule&time=0.45&reads=100`), `&tab=rule&model=even&start=C&time=0.8`, `&tab=rule&view=steps&parent=T`, `&tab=tree&seed=3&speed=2&branch=5`, `&tab=stem&src=live&w=20` (`&rebuild=2` its seed), `&scene=tree&view=up` (`up`, `stand`, `crown`) |
| `topo` | `#topo&t=100`, `&explore&tab=patch&r=13.5&tower=on` (`tower=off`: the balls; `view=bars`: the barcode; `lit=loops`), `&tab=cohort&dim=1&view=space&slide=17` (`dim=0`: pieces; `view=rack\|space\|held`), `&tab=scales&dim=1&from=5&to=15` (`to=above`), `&tab=cells&cell=1234&r=4.8&delta=50` (`show=map\|split\|genes\|proteins`), `&scene=slide&mode=points`, `&scene=body&liver=slice`, `&scene=tower&view=up` (`up`, `stand`) |
| `soil` | `#soil&t=100`, `&explore&tab=field&date=4&show=chl` (`show=nh4\|no3\|n2o\|ph`, `line=0\|1`, `fert=0\|1\|2`, `view=jars`; `plot=1` a group of plots, line * 3 + regime), `&tab=nitrogen&wheat=bni&dcd=on`, `&tab=microbes&colour=guild&kind=215` (a kind by its number), `&tab=network&mod=3&rho=0.7` (`&shuffle`, `&split=line\|fert\|random`), `&scene=web` (`&now=1` skips the glide) |
| `pass` | `#pass&t=180&lang=de`, `#pass&explore&tab=fish&k=1&links=on&shark`, `#pass&explore&start=LHR&spread=high&cut=50&day=20&city=SYD`, `#pass&explore&protein=CFTR&move=cf`, `#pass&explore&scene=globe&pillars=on` |
| `tutorial` | `#tutorial&t=60`, `#tutorial&explore&net=badge&view=side` (practice; `&signal` sends a signal from the hub) |
| `flock`, `robots` | in the list below |

- `#<key>&t=95`: any story open at that second of the timeline, paused (`#lbi&t=140`, `#spatial&t=95`, `#pass&t=180&lang=de`
  for German, `#tutorial&t=60` the guide on its markers, `&focus` the 3D alone).
- `#<key>&explore`: explore mode; `&tab=...`, `&scene=...&view=...`, `&now=1` (skips a glide) go further, per story.
- `#proteins&explore&q=TP53` (explore with a search), `#flock&explore&view=afar&links=on&birds=400` (`&hunt` sends a falcon),
  `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low` (`&crumbs` spills a pile, `&walk=1.5,1.2` walks you there).
- `#airports&repeat=all` (a kiosk that plays every story in turn), `#airports&slides=on` (every story as a slideshow),
  `#anchor=on` (anchored headset placement), `#qubits&panels=controls` (that story's panels in the headset: only the foot bar),
  `#stories&net=home` (pretend to be on a network without a relay: rooms on this network in tests), `?nofvt#tutorial` (the
  plain figure).
- `#studio` (the last scene used here, else the only one, else the list), `#studio&scene=atelier`,
  `#studio&scenes=tools/studio/test/scenes&scene=textures&edit` (the textures test scene: place its models to see the ladder
  and the cards); `&scene=test|rig|cuts|walks|puppet` are the other test scenes. `&edit` (editing on), `&visit` (a visitor's
  kiosk: no editing and no uploads at all), `&upload` (the Upload pane, where the relay's `/upload` sends people; `&relay=wss://...`
  for a relay elsewhere), `&tab=scene|add|item|items|upload`, `&view=walk`, `&scenes=<folder>` (a static folder of scenes instead
  of the relay's: a relative path only), `&maxtex=2048` (the texture limit, 512 to 8,192; 4,096 by default).
- `#design` is parked since v217: a key like any unknown one.
- In the console, `HOST.cur.peek('expression')` evaluates inside the current story (e.g. `HOST.cur.peek('NET.P')`).

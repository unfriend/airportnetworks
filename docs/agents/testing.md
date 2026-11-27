# Testing: when to run what, one row a block, the known red results

<!-- toc (tools/docs/toc.mjs) -->
- 23: When the suites run (1.5 KB)
- 39: Which suite after which change (1.9 KB)
- 66: Listing the tests and the docs' tools (2.5 KB)
- 98: The smoke test (`tools/smoke.mjs`) (9.5 KB)
  - 112: Smoke blocks (7.2 KB)
  - 176: `--only <words>` (0.7 KB)
  - 185: Playwright, SwiftShader and what only a headset shows (0.5 KB)
- 195: Shared rooms: `relay/test.mjs` and `tools/collab.mjs` (5.1 KB)
- 251: Other tools (3.4 KB)
- 274: `tools/sfx-cues.mjs` and `tools/sfx-render.mjs` (0.8 KB)
- 283: Known red results on this machine (2.4 KB)
- 307: Useful URL hashes and the console (2.2 KB)
<!-- /toc -->

Read on demand; the rules every agent needs are in AGENTS.md. This file says when each suite runs, what each smoke
block and shared-room round protects, how to run one of them and what is red on this machine. It does not retell the
checks: `--list` prints them (below). Why a check exists and what bug it caught is in `docs/history/testing.md` (a
heading per block, the full old retelling).

## When the suites run

There is no unit-test suite. When the suites run (the owner's rule: the full suites only before `main` moves): every suite below that a change touches runs before `main` moves, the smoke test always; a push to
`dev` gets only `node --check` on the changed files, the builds' `--check` (`node tools/engine/all.mjs --check` covers the fourteen that share the engine parts), `node tools/packages/scan.mjs --check` (the story packages' index is current and no folder in `packages/` is left out: `docs/agents/packages.md`) and `node tools/release.mjs --check`, and a
red result there is not chased. Each "after touching ..., run ..." below says what goes into that release run.

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
which start their own relay or server.

| Touched | Run before `main` moves |
| --- | --- |
| anything | `node tools/smoke.mjs <url>` |
| sound | `node tools/audio.mjs <url>` |
| a story's cues or a sound | `node tools/sfx-cues.mjs <url> <key\|all>`, then `tools/sfx-render.mjs` (report how it sounds as unheard) |
| `HOST.live`, `HOST.swap`, `HOST.load`, `tools/release.mjs`, the relay's `--watch` | `node tools/live.mjs` |
| `sw.js` or how files load | `git worktree add /tmp/old <commit> && node tools/update.mjs /tmp/old .` |
| `shared.js`, the relay, a story's hooks or `state()` | `node relay/test.mjs` and `node tools/collab.mjs` (about 15 min; one round with its flag) |
| `output.js` | `node tools/output/test-page.mjs` |
| a story's maths, data or sets | its `packages/<key>/src/test-*.mjs`; a changed set: its harness (`src/shot.mjs`), then `sweep.mjs` |
| a package or the template | `node tools/packages/check.mjs packages/<key> --load` |
| `ik.js`, `bodies.js`'s mannequin | `node tools/studio/test-ik.mjs` |
| the studio's images or converter | `node tools/studio/test-images.mjs`, `tools/studio/convert.mjs <model>` |
| an example's generator | that folder's `make.mjs --check` |
| the room and depth test page (`room-test/`) | `node tools/room-test.mjs` |
| the shared engine, meant to change nothing | `tools/engine/same.mjs`, `xrsame.mjs`, `panelsame.mjs` (below; not in the release run) |

After any change to an app file, bump `VERSION` in `sw.js` (AGENTS.md, "Releases and files"). Real-headset behaviour
(controllers, session hand-over between stories, placement, comfort, sound) can only be confirmed on a device: report
it as untested, and how sounds sound as unheard.

## Listing the tests and the docs' tools

The three big tests say what they hold without running (nothing starts: no server, relay or browser):

- `node tools/smoke.mjs --list` - every block (`block <name>`) and step (`step <name>`, indented inside a block),
  read from the file's text as written (`${key}` left unfilled). `--only <words>` takes these names.
- `node tools/collab.mjs --list` - every flag with the round it runs and whether that round is in the main run
  (`(main)`) or not; `--list --checks` - every `check(...)` name under the round (function) that holds it, as written,
  and the count; `--help` - the flags, as `--list`. A flag the code reads but `FLAGS` does not name is printed as a
  `note:`.
- `node tools/audio.mjs --list` - every step; `--list --checks` - under each step the `ok   ...` lines it prints when
  its checks pass; `--help` - its usage.

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
step that throws fails with its message and the run goes on; `--only` that matches no block or step fails; `--list`
prints every block and step name and exits; what this machine lacks (`ffmpeg` for the studio's screens, a shell without
`HOST.collab.trkIn`) fails unless `--skip-missing` is given. `SHOTS=<dir>` saves pictures in the blocks that take them.
The whole run fails on any console error (a 404 for a missing narration MP3 is expected).

What the main run (no `--only`) holds besides the blocks: every story and the studio loaded, scrubbed, played as a
slideshow and explored, the panes' numbers checked against the data where a story looks them up; the load steps (no
task longer than `LOAD_LIMIT`, 4 s: SwiftShader compiles one shader at a time); the loading scene in VR and AR; anchored
placement; the headset's settings; the sound-effect cues; focus mode and the top bar on phones and tablets.

### Smoke blocks

One row a block. Run one with `--only '<block>'` (see "`--only <words>`" below). Times are what a block took on a
quiet machine; "own page" means it opens a page (or two) of its own.

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
| `frame rate` | own page, about 5 min | `FPS_FAKE` pretend Quest: refresh-rate ladder, foveation, the read-out and double B. Do not rename `FPS_FAKE` (perf reads it) |
| `auto quality` | own page; run on a quiet machine | automatic quality's steps (rate, foveation, viewport scale), `#aq=off` |
| `sharp text` | own page | the panels and the menu as WebXR quad layers on a pretend Quest (`SHARP_FAKE`) |
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

### `--only <words>`

`--only <words>` runs only the steps whose names start with the words and the blocks that hold them (each block
of steps is guarded by its name, `runs(...)`; the headset settings, a block of mixed names, runs only without it; focus
mode and phones and tablets run with `--only 'focus mode'`, `phones`, `tablets` or `iPhone`): `--only studio` the
studio's pages, `--only 'studio texture swaps'` one block of them, `--only tutorial` one story's steps (its `load
<key>` step always runs with its block, v179: before, it was filtered out by its own name and the story's steps ran on
the page's default story). For a builder's own steps; the release run is the whole test.

### Playwright, SwiftShader and what only a headset shows

It needs Playwright with a Chromium build (`npm i --no-save playwright` and
`npx playwright install chromium` once, or a global install; see
`docs/setup-and-release.md`). A 404 for a missing narration MP3 is expected and ignored.
WebGL runs in software (SwiftShader) headlessly, so frame rates are low;
real-headset behaviour (controllers, session hand-over between stories,
placement and comfort) can only be confirmed on a device - say so when you
report results.

## Shared rooms: `relay/test.mjs` and `tools/collab.mjs`

Run both after touching `shared.js`, the relay, a story's `collab` hooks or `state()`. `node tools/collab.mjs --list`
prints every flag, `--list --checks` every check's name under its round (686 at v224).

**`node relay/test.mjs`** (starts its own relay): the protocol (rooms, writes and their order, the epoch
rule, `fx`, timeouts, bad frames, static serving, the password), rooms on this network (`/api/near`, `--proxy`), the
introduction server at `/peerjs`, `--watch`, the logs, the notebook, video conversion, OSC, live sound, Talk, trackers
and the shared networks. Its parts run alone with `--nets`, `--logs`, `--notes`, `--video`, `--rooms`, `--osc`, `--snd`,
`--talk` or `--trackers`. It checks every file `sw.js` `SHELL` names. After a relay change that delays replies (v220's
20 ms corking) a straggler after a reply can break a `q.length = 0` pattern: the test waits 60 ms.

**`node tools/collab.mjs`** (about 15 minutes; starts its own relay with `--static .`, so no server is needed). The main
run is the per-story part (three pages in a room follow each story's station: play, pause, jumps, mode changes, Replay,
the relay's clock, the explore state, the story's effect, its sound cues), then the rounds marked *main* below, then
peer to peer, rooms on this network and room names. `--quick` runs only the last story of the per-story part; `--port
<n>` fixes the relay's port; `--shots <dir>` saves pictures. Every round uses its own room. Since 436195f the rounds wait
until the pretend headsets are lined up (the 5 s gate), not a fixed 300 ms: keep that when adding a round.

| Flag | Round (function) | What it protects |
| --- | --- | --- |
| (none) | main run, per story | station following, effects, cues across three pages; Arrange all, Remove asks first |
| `--p2p` | peer to peer (main) | a room hosted by a page, through the relay's own `/peerjs` only (never PeerJS's public server) |
| `--near` | rooms on this network (main) | `/api/near` and a room listed on its members' network, with a proxy per pretend network |
| `--names` | `namesRound` (main) | a room's name cleaned, kept and shown elsewhere |
| `--code` | `codeRound` (main) | Join with a code from a headset's menu: keypad, Join greyed until three letters |
| `--all` | `allRound` (main) | the All stories and Back to the lobby circles; a landing card starts a story for everyone |
| `--guide` | `guideRound` (main) | the room setup guide and Touch the spot |
| `--places` | `placesRound` (main) | a calibration kept per room |
| `--areas` | `areasRound` (main) | more tape crosses in one room |
| `--reload` (`--cases a,b`) | `reloadRound` (main) | rooms across updates and Update the room: six cases on its own relay (port 8712), restarted as a deploy |
| `--follow` | `personFollow` (main) | following a person; `--shots` saves the people list |
| `--circles` | `headsetRound` (main) | the ten-headset round: cards, icons and name tags by the Cards setting, circles |
| `--ask` | `askRound` (main) | circles asked first (the only devices without `collabAskDefault` = `walk`) |
| `--menus` | `menusRound` (main) | your menu shown to your circle (`MENUS_STORY=studio` for a studio circle) |
| `--smooth` | `smoothRound` (main) | others' moves drawn smoothly: 15 writes a second with `ts` and `h`, no jumps |
| `--standby` | `standbyRound` (main) | the pretend headset's standby with the shared space in use |
| `--narration` | `narrationRound` (main) | narration in headsets and the welcome. Known red: a welcome check, see below |
| `--walk` | `walkRound` (main) | moving with the sticks for a VR headset elsewhere in a room. Known red: a `headAt` crash, see below |
| `--ships` | `shipsRound` (main) | spaceships in a shared room: launch, pilots, pickups, drones |
| `--camera` | `cameraRound` (main) | camera mode with a pretend Quest and a pretend Android phone |
| `--preview` | `previewRound` (main), about 4 min | the desktop preview camera |
| `--studio` | `studioRound` (main), about 3 min | the studio in a room: Studio here, the scene's frame the room's |
| `--studio-scenes` | `scenesRound` (main) | the relay's scenes as circles (`--scenes-readonly`) |
| `--behave` | `behaveRound` (main) | the studio's behaviours shared: follow, look, keep away |
| `--trackers` | `trackersRound` (main), 3-5 min | the PC's Vive trackers: bridge, shell and studio through a relay. Known red: puppet checks, see below |
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
| `node tools/audio.mjs <url>` (`--list`, `--list --checks`) | sound | 40 steps: a strict autoplay rule (a locked `AudioContext`, a tap), narration and sound-effect switches, the headset menu's rows, the stories' cues, the voice limit. How sound really sounds only by ear |
| `node tools/sfx-cues.mjs <url> <key\|all>` | cues | below |
| `node tools/live.mjs` | `HOST.live`, `HOST.swap`, `HOST.load`, `release.mjs`, the relay's `--watch` | a few minutes; a story added, changed and swapped live in a temporary copy of the app. The "within about 2 s" step allows 3 s and can still miss on a loaded machine |
| `node tools/update.mjs <old> <new>` | `sw.js`, file loading | an old checkout installed, this one served like GitHub Pages: page and stories new on the first visit, the next and offline. It waits up to a minute for the packages' cache (about 17 MB) |
| `node tools/room-test.mjs` | `room-test/` | about 1 min; its own relay on port 8131; a pretend headset with a real depth texture array |
| `node tools/output/test-page.mjs` | `output.js` | the output page's MIDI, OSC and clock |
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
| smoke, `anchored placement: no word while the saved place is being looked for` | fails under `--only` in most blocks, on 436195f as well | a timing problem in the test: its `N.wait` is 60 ms (audit run, row F) |
| collab `--walk` (`walkRound`) | crashes in `headAt` (`tools/collab.mjs`, the helper that turns a station into a pretend head pose) | not v224's; no cause recorded |
| collab main run (the pretend-headset part): *headset: back at its station after the icons* | red on this machine | no cause recorded |
| collab main run and `--quick`: *a page that follows two stations back to back ends at the second (a switch while a story loads is not lost)* | red on this machine | no cause recorded |
| collab `--narration`: the welcome check | fails the same on v221's code | not a regression of v222 to v224 (audit run, row D) |
| collab `--trackers`: the four puppet checks | the test's own | `itemAct('pwear', 'full')`: since v203 the studio takes only `'any'` (audit run, row D) |
| smoke `studio sequences`: *a second page at the same held room time draws the same moment* (it reads the alpha, among other things) | red on this machine | no cause recorded |
| smoke `spaceship: pickups (times shortened)` | flaky | a timing flake; the block's steps wait past the first second since 8c59e50 |
| relay stopped and restarted (`relay/test.mjs --watch`, collab `--reload`) | red on this machine | on Windows the 5 `--watch` failures about a relay stopped by SIGTERM come from Windows, with or without the fix; here no cause recorded |
| `tools/live.mjs`, the step "within about 2 s" | misses by a little on a loaded machine (seen once in v190) | it allows 3 s |
| smoke, `developer mode`: the two *Older and Newer* steps | fail on Windows with or without the v149 fix | they wait for v142 to be served |

A harness-only difference is never red: WebGL runs in software (SwiftShader), frame rates are low, and anything that
needs a real headset (controllers, placement, comfort, sound, occlusion, ships, frame rate) is untested until tried
there.

## Useful URL hashes and the console

The short list; every story's own explore hashes (`#lbi&explore&scene=atp&view=network&now=1`, `#soil&explore&tab=field&date=4&show=chl`,
`#qubits&explore&tab=network&net=blurred&cut=random&bits=2` and the like) are in `docs/history/testing.md`, "Useful URL hashes and
the console", and in each story's `README.md`.

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

# Audit: what I would change (26 November 2026, at v216)

Nothing has been changed. This is the proposal to choose from.

## What was read

- 744 files, 20 MB: every markdown file, the shell (`index.html`, `shared.js`, the modules, `sw.js`), the relay,
  the three hand-written stories, the shared engine, the studio's sources, every built story's sources, the tools
  and the tests. 47 reading chunks plus a measuring run.
- Left out, as told before starting: binaries (narrations, models, pictures), vendored libraries, built files
  (they are pasted from sources that were read) and generated data tables.
- Read by structure, not line by line: `packages/exposome/src/data/gen_data.py` lines 120-542 (an offline
  generator) and the `props.json` files (through their fields).
- The two big test files (`tools/smoke.mjs` 1.8 MB, `tools/collab.mjs` 1 MB) were first read in part with exact
  counts for the rest; follow-up readers then read the unread ranges line by line (see "Tests" at the end).
  `relay/test.mjs` was read by a reader that was cut off after writing its findings; its file is complete.
- Measured with `tools/perf.mjs` (software drawing, so only relative numbers), a load-time script, and the five
  Quest logs on the relay (studio scenes only).
- Cost: about 16 million tokens (about 4 on Fable before the limit, 9 on Opus, 3.5 on Sonnet).

Every finding has a file and line in `findings-NN.md` beside this file; `DIGEST.md` is the short index.

## Two things to know before ranking

1. **The worst per-frame numbers are background builds, not lasting costs.** The measuring tool jumps into a
   story right after load. For the ovary story (2.5 MB of memory per frame), the muscle story and the endotype
   story it measured a set still building itself in the background. They need re-measuring with every set
   finished first.
2. **There are no headset numbers for stories.** All Quest logs on the relay are studio scenes, and their
   `js`, `calls` and `tri` fields read 0. The measuring tool also skips the Experiments set (CDK5, exposome,
   proteins, flock, robots, cell stress test). So the frame-time ranking below rests on reading the code.

## Recommended order

| Step | What | Gain | Risk | Rough cost |
|---|---|---|---|---|
| 0 | Measure properly | ranks the rest | none | 150k (Sonnet) + you record runs |
| 1 | Quick fixes and real bugs | many small, some large | low | 0.6-0.9M (Opus + one review) |
| 2 | `CLAUDE.md` and `AGENTS.md` from 63 KB to about 35 KB | every session and sub-agent | low | 150k (Fable, I do it) |
| 3 | How files reach a device (service worker, relay) | load time, release cost | low-medium | 0.5-0.8M |
| 4 | The five biggest headset frame costs | late frames | medium | 1-1.5M |
| 5 | Docs: generate what can be generated, archive what is history | agents read far less | low | 1-1.5M (Sonnet, Opus for tools) |
| 6 | Load: stories fetch and build only what the first chapter needs | time to ready, memory | medium | 1.5-2M |
| 7 | Tests: one shared kit, `--list`, no-browser checks on `dev` | fewer false alarms, less to read | medium | 1-1.5M |
| later | Your decisions (see the end) | large | high | parked |

Steps 1 to 3 are where I would start. Each step is one release on `dev` with one review, as today.

---

## Step 0: measure properly

- `tools/perf.mjs`: take stories from `HOST.stories()` (it uses `HOST.list`, lines 383 and 387, so the
  Experiments set is never measured) and call each set's `finish()` before measuring, as `sweep.mjs` does.
- Run logs from a Quest: *Record a run* in the ovary, microanatomy and *Back into the cell* stories, and once in
  a room with several headsets. Find out why `js`, `calls` and `tri` are 0 in the logs.

## Step 1: quick fixes and real bugs

Bugs:
- **Design room draws 53 miniatures separately.** `tools/design/sets/table.js:179,276` sizes its merge for 48;
  there are 53, so "every miniature in two draws" never happens and an array is made every frame.
- **`tools/audio.mjs:405-409`** clicks the flock's card on the main screen (on Experiments since v188): the
  step must fail. **`tools/pace.mjs:32`** lists only the main cards, so pacing CDK5 or exposome does nothing.
- **`tools/smoke.mjs:57`**: a step that throws ends the run with no FAIL line and skips every later block.
  **`--only`** on a later step of the streams, loops and trails blocks prints "ok" without running
  (set-up is in step 1; first at 10260). **A missing `ffmpeg`** gives a green run (11586-11592).
- **`tools/studio/tracker-guide/voice.mjs:15-19`**: `--check` compares file times, so after a fresh clone it
  always says every line is rendered.
- **`packages/mutation/src/test-mmath.mjs:307`** fails whenever the machine is busy (a time limit as a check).
- **`props.json`** has cut-off and garbled sentences that show on the design room's cards (pet: lines 97, 115,
  498, 572; qubits: 606), and CDK5's still describes the story before its v191 rework.
- **`relay/server.mjs:1573`** serves `packages/<key>/src/**` (story sources and build scripts) to anyone.
  Harmless if intended; say if it is not.

One-line or few-line performance fixes:
- **Panel signature before its throttle.** `tools/engine/e6_panels.js:143-144` (and the three hand-written
  copies) builds each panel's change signature every headset frame, then checks its own 60 ms throttle. Swap
  the two. For *Back into the cell* that signature loops over 13,460 proteins and reads `localStorage`.
- **Things drawn while invisible:** *Back into the cell*'s seven wall layers at alpha 0 (`walls.js:16-51`,
  two of them full-screen); qubits' 28,920-point grid never hidden (`pairs.js:249-255`); the microanatomy
  hierarchy drawing full organ models where the light ones would do (`hier.js:474`, 46k to 11.6k triangles).
- **Work every frame for nothing:** the spaceships ask for two poses per frame with no ship flying
  (`ships.js:413-443`); the sound listener writes nine values per frame with nothing spatial sounding
  (`sfx.js:885-897`); alignment runs twice per frame in a room (`shared.js:10034`, called at 8220 and again
  through 10946); focus mode's own animation loop runs forever on every page (`index.html:3988-4020`); a 40 ms
  and a 200 ms timer and an animation loop from `shared.js` run on every page, room or not (3498, 3944).
- **The places survey** restores and deletes anchors every 10 s to 2 min outside any room, also for rooms it
  can never join (`shared.js:9637, 9750`).
- **`log()`** reads and parses `localStorage` for every log line (`shared.js:156-161, 427-443`; 401 calls).

House-keeping:
- `.gitignore`: add `.claude/settings.local.json` (the docs tell authors to create it) and the two missing
  `shots/` folders (cdk5, soil).
- `packages/ppicell/src/narration-v204-old.mp3` (6 MB, not served) and the tracker guide's voice committed
  twice (1.4 MB): yours to remove, since I do not delete.
- Stale comments that send agents wrong: `index.html:884`, `sw.js:1-2`, `stories/list.js:1-10`, the
  `tools/<dir>` comment in 14 `build.mjs`, `tools/narration.mjs:109-112` (it stamps old paths into the
  generated `docs/narration.md`), "no recording yet" in exposome, ppicell and tutorial `e3_story.js`.

## Step 2: the two files every session loads

`CLAUDE.md` (10 KB) and `AGENTS.md` (52 KB) go into every session and every sub-agent: about 15,000 tokens
each time. Today's work started about 70 agents. About 27 KB can go without dropping a rule:

- "Things that are easy to forget" (5.3 KB): 9 of its 13 bullets repeat the rules above it. Fold the four
  unique ones into the rules.
- The story table (7.7 KB): a catalogue kept in four other files. One line per story: key, title, built or
  hand-written, spelling, what it reads from other stories at build time.
- "Layout" (8 KB): a second copy of `docs/agents/layout.md`. Keep about 15 entries.
- The built-files rule is written three times; "when the suites run" three times; the economy advice twice.
- "The app in brief": half is per-release feature notes that each end in a pointer.
- Testing: keep the policy and the cheap checks; the block and flag lists live in `testing.md`.
- Stale: `AGENTS.md:143` and `:451` still say `tools/<key>/`; lines 127-132 say stories "are moving into
  packages"; `examples/dub-techno` and `tools/output/cardinal/dub-techno.vcv` are missing from the built-files
  table.
- Optional: `.claude/agents/builder.md` and `reviewer.md` holding the rules I retype into every agent prompt
  (no deletions, notes left alone, the model per job).

Kept as they are: "Rules every change must keep", "Conventions", "No approval prompts".

## Step 3: how files reach a device

Service worker (`sw.js`):
- **Every release re-downloads the whole shell**, 5.5 to 5.9 MB per device, whatever changed, because install
  uses `cache: 'reload'` (line 150). `no-cache` asks the server and gets "unchanged" for most files.
- **Story files and narrations are fetched again on every story start** although their address already
  carries a fingerprint (lines 219-240): up to 2.2 MB of script and 7.3 MB of narration re-stored each time,
  and a slow network waits up to 4 s per file. Answer from the cache when the fingerprint matches.
- Every page start re-stores about 2.4 MB of unchanged shell files (line 163).
- First install pulls 22 story files at once with no limit (17.5 MB, lines 59-67).
- About 50 of its 268 lines are dead since narrations moved into packages.

Relay (`relay/server.mjs`):
- **gzip only.** Brotli makes `shared.js` 21 % smaller, `index.html` 16 %. Compress once per file and keep it.
- Several headsets asking for the same changed file each compress it again (no shared in-progress result).
- **Presence fan-out:** with 30 headsets about 13,000 small packets a second, one write per recipient
  (lines 526-529). Collecting each socket's writes for 15 to 25 ms needs no protocol change.
- **A headset on weak Wi-Fi is sent seconds of old positions** (queued up to 16 MB) before it is cut off.
  Skip presence for a backed-up socket, as talk and trackers already do.
- `--keep` writes every room to disk every 5 s while anything changes; one large shared network is compressed
  synchronously and stops every room for hundreds of milliseconds (`nets.mjs:52`).

The page:
- **The start page fetches 7.7 MB**, 4.6 MB of it the airports narration for a story nobody picked.
- **Each story is fetched as text, hashed in script and run inline** (`index.html:2881-2916`), so the browser
  cannot compile it in the background or keep the compiled code between visits. A normal `<script src>` with
  the fingerprint in the address fixes that; keep the text path for live swaps.

## Step 4: the biggest headset frame costs

In a shared room:
1. **The whole room is written to local storage every 0.4 s while anyone moves anything**, then up to eight
   kept rooms are read back and parsed, on every headset (`shared.js:971, 1036-1077`).
2. **Carrying a circle rebuilds the station list 15 times a second on every device** (`shared.js:2391-2434`).
3. **The studio's whole scene record (up to 2 MB) is turned into text every frame** to find it unchanged
   (`shared.js:3484` through `e6_items.js:1941-1953`).

In the studio:
4. **Walking into a trigger cube repaints the main panel and uploads 4.9 MB**, on any tab, on the frame the
   visitor crosses it. The best candidate for the late frames in your logs; plausible, not confirmed.
5. **The pane signature** (about 110 fields and a string per item) is built every frame, twice in a headset
   (`e7_explore.js:857`, `e9_panels.js:243`).
6. **The scene's matrices are rebuilt four to six times a frame** (`e8_xr.js:936, 977`, `e10_app.js:215`).
7. Tags and lines walk the whole scene on every render (`sets/looks.js:160-221`); ghosts double the drawing
   of moving models while editing (`e6h_ghost.js`); trackers, screens, texture swaps, sequences, walls and the
   room scan do work every frame when no item uses them.

In stories:
8. **Pointing in explore mode tests every item, per controller, every frame**: 6,716 cells in tissue
   topology, 20,000 kinds in soil, 16,376 proteins in CDK5, 84,000 gene-layer pairs in the muscle tower.
   Re-test only when the ray moved, and use the grids the sets already have.
9. **A mesh built late compiles its shader on the frame it first shows** (microanatomy at half way: plus a
   1.2 MB upload; ovary when its section finishes; the pass story's globe, whose own scene loop has no
   warm-up). One engine helper for every late-built mesh.
10. **Background builds that allocate per vertex or per pixel:** ovary's stain (615 MB of garbage in 400 ms
    when rebuilt outside the app; two helpers rewritten cut it by two thirds), the muscle story's heart.
    Build during loading, or with reused arrays.
11. **The airports closures slider** loops 205,000 vertices and uploads 820 KB per step, every frame of a
    drag in a headset.
12. **On a page, a paused story still does everything** 60 to 120 times a second, and label placement forces
    a layout every frame (`tools/engine/e7_app.js:351-408`, `e3_story.js:172-210`). A headset has an idle
    path; a page has none.

People's bodies: every person is solved and drawn in full whether seen or not (`bodies.js:844-898`); with a
full room that is the cost to cut first.

## Step 5: the docs

Generate what repeats the code:
- **`docs/props.md` (225 KB)** is a hand-kept copy of the packages' `props.json` (434 KB, itself partly
  hand-kept and garbled). Generate the code-derived fields from the sets, and `props.md` from the JSON.
- **`docs/agents/testing.md` (264 KB)** retells the tests. With `--list` in the three big tests it shrinks
  to about 15-20 KB: when to run, one row per block, the traps.
- **The state lines** in `HANDOVER.md` and `docs/setup-and-release.md` (both say v212 or v213 and an old
  room format), and the story lists in `index.html`'s descriptions and `manifest.webmanifest` (four stories
  missing): let `tools/release.mjs` write them.

Archive what is history:
- **`HANDOVER.md` (287 KB)**: 220 KB is a release log from v96 to v213, held also in `docs/history.md` and
  `whatsnew/`. Its "Adding another story" gives the steps from before packages and is wrong. Target about
  15 KB plus a releases file.
- **Finished plans** (about 150 KB): `docs/packages-migration.md` (only "Left for later" is live),
  `sfx-phase2-plan.md`, `sfx-phase2-lines.md` (says "copy character for character" but no longer matches the
  real code), `shared-space-plan.md`. Code headers in `shared.js:3`, `relay/server.mjs:1` and
  `tools/collab.mjs:1` still point at them.
- **The stories' `SPEC.md` files** are the builders' briefs in the future tense ("we are adding an eighth
  story", "copy the soil engine and rename"). CDK5's keeps 350 superseded lines under a note that overrides
  them; the tour's set notes name 14 tools that no longer exist.

Make the big references findable:
- **`shared-rooms.md` (275 KB) and `shell.md` (186 KB)**: 87 % of the first sits under one heading; single
  bullets run to 47 KB; history is woven into the rules though the file says it holds none. First step, same
  files: a heading per topic, a generated table of contents with line numbers, history moved to
  `docs/history.md`. An agent then reads 2-3 KB of index and one section.
- **`tools/studio/SPEC.md` (353 KB) and `docs/agents/studio.md` (186 KB)** are two tellings of the same
  contract, and the SPEC stops at about v165: eight features are only in `studio.md`. Decide which is the one;
  the other becomes a 12-15 KB index.
- **`relay/README.md` (181 KB)** is four documents for three readers; its Testing section is one 14 KB
  sentence.

Also: `README.md` and `README.txt` have drifted apart and are each stale; each story's data description is
kept in five or six places; the "not yet tried on a headset" list in four; `docs/narration-timings.txt`
carries a stale second copy of every story (lines 112-197); 57 `TO FILL` lines wait for you across five files.

## Step 6: stories load only what the first chapter needs

- ***Back into the cell*** waits for 16 protein models (5.8 MB) before it is ready; the first is needed at
  115 s. Its background network is built twice at load; 139 KB of structure data is pasted in and 1.5 KB read.
- **Exposome** fetches 3.7 MB of data files before the first frame; one is used only from chapter 6.
- **The tour** builds all ten scenes at load and releases nothing: 99 MB. First, drop the kept copies of
  static buffers after upload (no behaviour change) and fix the DNA set's double-size buffers (15-17 MB).
  Then build each set before its first chapter and release it after its last (touches seeking: more risk).
- **Shared sets keep their scaffolding** in every story that uses them: tissue 10 MB (two stories), body 3 MB
  (five). PET builds the body set twice and its explore-only liver at load. Soil builds a 17,000-node tree it
  never shows.
- **Computed on every load though always the same:** spatial's cell layout (before any loading card), the
  tour's 9,800-node interactome, the endotype network's layouts (1.3 s), qubits' two layouts. Compute once in
  the generator.
- **Airports' data** is 486 KB of text inside the script, pasted again into pass and partly into exposome
  (1.1 MB in all). As binary files beside the story: fetched once, a third smaller.
- **Every story start builds the headset's panel and card canvases, 35-40 MB, on desktops and phones too**
  (`tools/engine/e7_app.js:239`); `shared.js` builds the menu's canvases on every page likewise.
- **`stories/studio.js` (2.33 MB)**: 440 KB is page-only or edit-only code, 471 KB comment lines, 175 KB a
  converter only uploads use; `ik.js` ships twice. A second file loaded on demand and a comment stripper in
  the build cut it by about a third. The example scenes use no compressed textures (Bliss XP: about 70 MB on
  the graphics card, 18 MB with the studio's own KTX2) and 28 draw calls more than needed.
- **The shell parses 2.2 MB before it starts**; occlusion (AR only), spaceships (headsets only), the notebook
  (developer mode) and the arrangement editor could load on demand, as bodies and the goggles already do.

## Step 7: the tests

- **One shared kit** (`tools/lib/`): static server (11 copies in 10 files), relay starter (7 in the room test
  alone), browser flags (in 52 files), fingerprint hash (7 copies), the fake headset (four different ones; the
  measuring tool reads it out of the smoke test's text, hence the "do not rename" rule), page set-up.
- **`--list` and `--only <id>`** with short step ids in all three big tests; a step that throws is caught.
- **Checks that need no browser, run on every push to `dev`:** eight smoke steps load every story in a browser
  only to search its text for a required line.
- **False alarms:** about 100 short fixed sleeps before a check in the room test, about 60 checks on
  wall-clock time under slow drawing, verdicts that pass when the machine is too slow to judge, fixed port
  numbers (two runs on one machine collide), 2,250 lines of steps sharing three pages so one failure cascades.
- **Run time:** the room test spends about 8 of its 15 minutes in fixed waits; the relay's test runs its whole
  body on a relay with a 1 s timeout, and writes the folder and R2 scene steps twice.
- **Split by block** (`tools/smoke/<block>.mjs`, the studio's in `tools/studio/test/`), so an agent working on
  one block reads 20-50 KB, not 1.8 MB.
- **`tools/update.mjs`**: 60 lines are built around the `audio/` folder that is gone; its three main checks
  now only print "not checked".

## Repository-wide duplication (do with the step that touches it)

- 19 near-identical `build.mjs`, 15 each of `shot.mjs`, `sweep.mjs`, `harness.html`; they differ by the key.
- The story contract and teardown at the end of `e7_app.js`, about 120 lines, hand-copied in 19 stories.
- Three example makers that are one harness; three model writers and two templates in the test-scene maker.
- The instanced-pool helpers byte-identical in three stories' `look.js`; a headset keyboard in three stories
  though the shell offers one.
- About a quarter to a third of `shared.js` and the studio's parts is comments, much of it dated history that
  `docs/history.md` exists to hold. It ships to every device and is read by every agent.

## Your decisions (parked or needing your word)

- **One shared engine file** instead of 119-173 KB pasted into each story (3.1 MB in all): blocked by design
  (packages are frozen against engine changes). This is the R1-R3 work you parked on 23 November. A cheap first
  step is moving two rarely used pieces (36 KB per story) out.
- **The three hand-written stories** share 2,150 identical lines (119 KB) that have drifted from the engine's.
  Parked with the above; meanwhile a check that flags drift.
- **Splitting `shared.js`** (1 MB, parsed by every page) into parts loaded on demand: camera mode and the
  preview camera (87 KB, never in a headset), the no-relay transport (75 KB), talk (35 KB), the headset menu
  (150 KB, only in a headset). No room key changes; large but mechanical.
- **Precaching on-demand modules**: 2.95 MB of the shell's 5.5 MB is loaded only on demand (the studio, the
  design room, the output page) but precached by every phone and headset. Your rule puts app files in `SHELL`.
- **The start page builds the airports story behind the Stories screen.** A backdrop you want, or waste?
- **Committed binaries**: the old ppicell narration (6 MB) and the duplicate guide voices (1.4 MB).

## What I would not change

Already good, so nobody re-checks: the canvas panels' partial uploads; people, name tags and halos as one draw
each; the flock, the fish and the robots' simulations; the relay's one-serialise-per-broadcast, talk frames and
bounded memory; the service worker's `packages/index.json` handling; story teardown (no leak found in the
shell); the generators' `--check` modes; `docs/working-on-a-story.md`; the exposome's `SPEC.md` (the model for
the others).

## Tests: what full reading added

Both big test files have now been read line by line (notes in `findings-31b`, `32b`, `33b`, `34b`, `28a`, `28b`,
`28c`). The patterns in Step 7 stand; full reading added faults inside individual steps. These would go into
Step 7, the first group into Step 1.

To verify first (suspected broken, not run):
- **`tools/collab.mjs:11051-11067`**: the "room on this device" block walks to the flock's station, but Arrange
  all places only the main cards and the flock is an Experiment, so the station is undefined and the walk
  throws. The reader did not read the app's arrange code in full.

A failure that ends the whole run instead of being reported:
- `tools/smoke.mjs`: the text of a failure message can itself throw (7736, 7747, 6742, 7131, 7660); a null
  pixel result is read at 3222; four undo loops have no bound (3436, 3534, 4872, 5895).
- `tools/collab.mjs`: 5127 reads a missing arrow before its own guard; 6417 waits for a relay that may already
  have died; a throw in any round skips every later round and nothing lists which did not run (11084-11208).

Runs that stay green without testing:
- Silent skips: no `ffmpeg` (smoke 11592), no tracker hook (12571), no audio encoder or sound context (5184,
  5399, 5447, 5487), a shallow clone without the old commit (collab 8512, 8741), a story without cues (collab
  9029: the sound-effect and slideshow checks run for the first story only).
- `--only` can name a block but not a step in nine studio blocks (the first step opens the page); nine settings
  steps cannot be selected at all (13516-14136); some later steps report a false red (6002, 6047).

Checks that cannot fail (a sample; about 40 are listed in the notes):
- smoke 11993-11995 accepts both possible values of each page's own entry; 11781 never compares the "fixed"
  shuffle with a known order; 11407, 11131 and 11346 carry a leftover `&& false`; 15231 tests `writes >= 0`;
  6251-6270 never checks the sound was heard before it is silenced; 9492 has no control for its tie-break.
- About eight comparisons turn a missing value into null before comparing (6748, 7135, 7668, 7896, 8241, 8452,
  8928, 8510), so "absent" and "null" pass alike.
- collab 3118 has only upper bounds, so no picture sent at all passes; 2753 cannot fail for a story with no
  effect hook; 4892-4917 may grip before the other person has sent anything; 7465 passes when the log folder
  is empty; 8384-8391 can be satisfied by the page from before the reload.
- "Greyed" asserted by finding nothing (collab 2905, 4451, 4463), which a missing row also gives.

Verdicts that loosen as the machine slows: collab 9056-9059, 8249 and its four hold checks, 9075, 7269, 5017.
One that fails on a fast machine: collab 4202-4208 (it must catch a transient state by polling).

State left behind: a room size changed and never restored (collab 10005); stubs and patches restored without
`finally` in about twenty places in both files; pages left open after an early return.

Waste: the test figure is converted from FBX six times at up to 90 s each (smoke 3162, 3516, 3827, 4694, 4806,
8514, 9010); the recorder block starts a second browser and relay and waits about 17 s; a helper that scrolls
and presses a headset panel row is pasted about 35 times in the smoke test.

Corrections to the first readers' counts: the smoke run does not use one browser throughout; most of the
500 ms waits in the stick-moving block wait for the page's own double-click clock and cannot be replaced by
frame steps; the relay-upload paint step does not depend on earlier strokes; the puppet steps are not plain
duplicates of the solver's test.

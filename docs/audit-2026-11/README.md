# The audit of 26 November 2026 and the work that follows it: start here to go on

An audit read every readable file of the repository (at v216) for improvements to the markdown files and to
performance. The owner then said: "do everything you say from 1 to 7 if possible but remove the whole design
room for now and skip the steps that would only touch that", and later: "the start page should load nothing in
the background, just have the cards there". The work stopped part-way when the session ran out of tokens.

## The files here

- `PROPOSAL.md` - what the audit proposes, in steps 0 to 7, with the decisions that are the owner's.
- `RUN.md` - the run plan: one row per piece of work with its state, the owner's decisions since, the
  re-measurement, and the fix round owed on v219 (nine findings with line numbers; done as v220).
- `DIGEST.md` - a short index of every reader's findings.
- `findings/findings-NN.md` - each reader's findings with file and line (line numbers are from v216 and have
  moved a little). Some files hold working notes first and the findings under `# FINAL`.
- `measured-first-run.md`, `measured-after-finish.md` - `tools/perf.mjs` over every story, before and after the
  tool was made to finish background builds first. Software drawing: only relative numbers mean anything.

## Where things stand (branch `dev`)

| Piece | State |
| --- | --- |
| v217: the design room parked (sources kept in `tools/design/`, `stories/design.js` left unused) | done, reviewed, pushed |
| v218: step 0 (the measuring tool) and step 1 (quick fixes and real bugs) | done, reviewed, pushed |
| Step 2: `CLAUDE.md` and `AGENTS.md` from 63 KB to 34 KB | done, pushed |
| Step 5, first pass: `HANDOVER.md` 287 to 55 KB, the release log and finished plans to `docs/history/` | done, pushed |
| v219: step 3 (the start page with only the cards, the service worker, story loading, the relay) | pushed before its review; its fix round done as v220 |
| v220: v219's fix round (`RUN.md`'s nine findings, the review's eight on v220, the limited menu's Calibrate and Room setup, a room left on purpose offered again) | done, reviewed, committed on `dev`, not pushed |
| Step 4: frame costs (a: `shared.js` in a room and people's bodies; b: the studio; c: the engine and stories, the exposome story first) | not started |
| Step 5, the rest: `--list` in the tests and a generated `testing.md`, tables of contents for `shared-rooms.md` and `shell.md`, the stories' `SPEC.md` files, the studio's two tellings, `relay/README.md`, `README.txt`, code headers that still point at the stubs in `docs/` | not started |
| Step 6: stories fetch and build only what the first chapter needs; the studio's file split | not started |
| Step 7: the tests (one shared kit, `--list`/`--only`, the real test bugs, sleeps, ports, splitting the smoke test) | not started |

## How the work was done, and should go on

- One builder at a time in the checkout (Opus), told the rules of `CLAUDE.md` in its prompt, committing by
  explicit path; then one review (Sonnet) of its commits; one fix round; then the push to `dev`. A docs-only
  agent may run beside a builder if its list of files is strict. Builders do not edit `CLAUDE.md` or
  `AGENTS.md`; the main conversation does.
- Each builder's prompt named its items with file and line from the findings; `RUN.md` has the split.
- Skipped on purpose (design room only): the fix for its 53 miniatures, the garbled card texts in
  `props.json`, a generator for `docs/props.md`.
- Known and not yet fixed: ~~the smoke block `packages order` fails since before v218~~ (fixed in v220: the
  test now expects the Experiments set's link cards); `tools/live.mjs` had one timing check fail under
  load (4.0 s against 2 s); the shared-room suite as a whole has not been run since the relay began to batch room
  messages every 20 ms (v220 ran its guide, places, standby and areas rounds: all good); `docs/narration.md` is to
  be regenerated at the next release run; ~~`docs/agents/layout.md`'s line for `sw.js` (not `AGENTS.md`'s, as this
  said before) still says "network first"~~ (fixed in v220); there is no shared-room test of adding, locking and
  arranging a page that is not a story since the design round went; the owner's calibration fault (after the
  second cross both crosses gone, the room not lined up) is not reproduced without a headset: v220 fixed one cause
  (from the start page the trigger reached nothing), not known to be the owner's.

## Waiting for the owner

- Headset trials of v214 (limited menu, two-second hold), v215 (subtitles per headset), v216 (the hands),
  v217, v218.
- Whether a headset entering VR from the start page may load the first story to draw the cards (v219 and v220 do).
- The developer note of 26 November, "Add the exposome story into the experiments": it is already there; what
  was meant?
- The decisions at the end of `PROPOSAL.md`, and two files only the owner removes:
  `packages/ppicell/src/narration-v204-old.mp3` (6 MB) and the tracker guide's voices committed twice.

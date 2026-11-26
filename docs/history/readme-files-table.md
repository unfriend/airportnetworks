# README.md's Files table (v217)

This file is a record: the table that stood under "Files" in `README.md` until 26 November 2026 (v217), a third copy of the layout, taken out word for word. The one list of every file and folder is `docs/agents/layout.md`.

| Path | What it is |
| --- | --- |
| `index.html` | the app: Stories screen, shared page layout, loads and swaps the stories |
| `packages/airports/main.js`, `packages/proteins/main.js`, `packages/spatial/main.js`, `packages/lbi/main.js`, `packages/nmd/main.js`, `packages/endo/main.js`, `packages/pet/main.js`, `packages/micro/main.js`, `packages/ovary/main.js`, `packages/qubits/main.js`, `packages/mutation/main.js`, `packages/topo/main.js`, `packages/soil/main.js`, `packages/pass/main.js`, `packages/flock/main.js`, `packages/robots/main.js`, `packages/ppicell/main.js` | the stories, each a story package (since v187 every one; `packages/order.json` their order, `packages/index.json` the scan's index), with their data, explore modes and headset panels; each one's narration in `packages/<key>/audio/` |
| `stories/design.js`, `stories/studio.js` | two pages that are not stories (on no Stories screen): the design room (`#design`, a table with a small model of every prop; parked since v217, `tools/design/`, unused) and the studio (`#studio`, your own models, trigger cubes and sounds placed in the room, served and saved by the relay's `--scenes`, with an upload page at `<relay>/upload`; see `tools/studio/README.md`) |
| `stories/list.js` | the studio (`STORY_EXTRA`; the design room until v217); `STORY_LIST` is empty since every story became a package (v187) |
| `version.json` | the latest release, written by `node tools/release.mjs`: running copies take new and changed stories from it, and ask before a new shell (see `docs/agents/shell.md`, "Hot reload and live updates") |
| `whatsnew.json` | what is new in the latest release, what to test and what is untested, written by hand at every release: developer mode shows it (see `docs/agents/shell.md`, "Developer mode"; `node tools/release.mjs --check` fails while it names another release) |
| `proteins.html`, `spatial.html` | forward old links to the app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline cache and app install |
| `audio/` | the narrations (the airports' recorded, the others synthetic, from `tools/voice/`) |
| `three.min.js` | three.js r128 (MIT licence, see `three.LICENSE.txt`) |
| `shared.js` | shared rooms: the client (rooms, stations, the clock, the room frame in a headset, presence, the Shared dialog and headset panel) |
| `sfx.js` | the shell's sound effects (`HOST.sfx`: clicks, chimes, room sounds and the stories' own sounds, made in code, through the narration's context; on by default, silent on a page until *Sound* is pressed; a quiet background only for the flock and Pass it on); `tools/sfx.html` is its sound board, `tools/sfx-render.mjs` renders every sound to MP3 |
| `occlusion.js` | real-world occlusion in AR (`HOST.occlusion`): real people, hands and things (by default) and the room scan (when chosen) hide what stands behind them, with smooth edges as a switch (on by default; untested in the app on a Quest) |
| `ships.js` | the spaceships (`HOST.ships`, v132): a little ship steered with the right thumbstick (since v133; launched by the right stick clicked twice), shield and health, drones, drifting targets and pickups fought together in a shared room; nothing stored (untested on a headset) |
| `notes.js` | the developer notebook (`HOST.notes`, v142; developer mode only): hold B or Y in a headset, or press the round button on a page, to record a spoken note with two pictures, pins and the context; sent to the relay's `/api/notes` (kept in an outbox until it answers); read on `notes/` (untested on a headset) |
| `relay/` | the shared rooms' server (`server.mjs`, no packages), its test, Dockerfile and guide (`README.md`) |
| `relay/trackers.mjs` | the relay's part for the PC's Vive trackers (`--trackers`, only on the PC with SteamVR): takes the bridge's readings on UDP 127.0.0.1 and sends them, lined up, to the rooms that use them (`relay/README.md`, "The PC's Vive trackers") |
| `HANDOVER.md` | start here when taking the project over |
| `docs/` | the shared rooms' plan (`shared-space-plan.md`), the lessons it applies (`multiplayer.md`, `shared-spaces.md`) and what two Quest 3s did (`quest-shared-space-findings.md`); for the handover: data sources and permissions (`data-and-permissions.md`), open questions for the authors (`questions-for-authors.md`), setup, tests and release (`setup-and-release.md`), running a session with headsets (`event-runbook.md`) and the narration scripts (`narration.md`) |
| `tools/smoke.mjs` | headless test: loads every story and fails on page errors |
| `tools/collab.mjs` | headless test of shared rooms: a relay and several pages, and a pretend headset, in one room |
| `tools/update.mjs` | update test: an older version installed, then this one deployed (see `docs/agents/testing.md`) |
| `tools/release.mjs` | a release step: writes `version.json` and stamps the shell's release into `index.html` (`--check` says whether they are current, and whether `whatsnew.json` names this release) |
| `tools/live.mjs` | test of hot reload and live updates: a copy of the app changed as a release or an editor would, on a static host and through the relay's `--watch` |
| `tools/audio.mjs` | narration test under the headset browsers' sound rule, with faults that make the fallback take over (needs `packages/airports/audio/narration.mp3`) |
| `tools/narration.mjs` | writes `docs/narration.md` from the running stories (serve the folder first) |
| `tools/pace.mjs` | paces the stories without a recording: writes their `NARRATION_SYNC` from the words on their panels (`--write`; serve the folder first) |
| `packages/lbi/src/` | sources of the tour: its 3D sets, engine parts and build script (`node packages/lbi/src/build.mjs` writes `packages/lbi/main.js`) |
| `packages/nmd/src/` | sources of the muscle story (`node packages/nmd/src/data/gen_data.mjs <the authors' folder>`, then `node packages/nmd/src/build.mjs` writes `packages/nmd/main.js`) |
| `packages/endo/src/` | sources of the endotype story (`node packages/endo/src/build.mjs` writes `packages/endo/main.js`; data from `packages/endo/src/data/gen_data.py` and the authors' files, which are not in the repository) |
| `packages/pet/src/` | sources of the PET story (`node packages/pet/src/data/gen_data.mjs`, then `node packages/pet/src/build.mjs` writes `packages/pet/main.js`) |
| `packages/micro/src/` | sources of the microanatomy story (`node packages/micro/src/build.mjs` writes `packages/micro/main.js`; data from `packages/micro/src/data/gen_data.mjs` and Iva Buljan's network file, which is not in the repository) |
| `packages/ovary/src/` | sources of the aging ovary story (`node packages/ovary/src/data/gen_data.mjs`, then `node packages/ovary/src/build.mjs` writes `packages/ovary/main.js`) |
| `packages/qubits/src/` | sources of the qubits story (`node packages/qubits/src/build.mjs` writes `packages/qubits/main.js`; `node packages/qubits/src/test-qmath.mjs` checks its maths) |
| `packages/mutation/src/` | sources of the mutation story (`node packages/mutation/src/build.mjs` writes `packages/mutation/main.js`; `node packages/mutation/src/test-mmath.mjs` checks its maths) |
| `packages/topo/src/` | sources of the tissue topology story (`node packages/topo/src/build.mjs` writes `packages/topo/main.js`; `node packages/topo/src/test-data.mjs` checks its data against the poster's numbers; data from `packages/topo/src/data/gen_data.py` and the authors' files, which are not in the repository) |
| `packages/soil/src/` | sources of the soil story (`node packages/soil/src/build.mjs` writes `packages/soil/main.js`; `node packages/soil/src/test-data.mjs` checks its data, decoders and key numbers; data from `packages/soil/src/data/gen_data.py` and the authors' files, which are not in the repository) |
| `packages/cdk5/src/` | sources of the CDK5 story (`node packages/cdk5/src/build.mjs` writes `packages/cdk5/main.js`; `node packages/cdk5/src/test-data.mjs` checks its data and decoders; data from `packages/cdk5/src/data/gen_data.py` and a clone of the Menche lab's public CDK5_data repository, which is not in this one) |
| `packages/pass/src/` | sources of the pass story (`node packages/pass/src/build.mjs` writes `packages/pass/main.js`, cutting its globe and cell out of `packages/airports/main.js` and `packages/spatial/main.js`; `node packages/pass/src/test-sets.mjs` checks its sets) |
| `packages/flock/src/` | sources of the flock (`node packages/flock/src/build.mjs` writes `packages/flock/main.js`) |
| `packages/robots/src/` | sources of the robot gang, a story package (`node packages/robots/src/build.mjs` writes `packages/robots/main.js`) |
| `tools/studio/` | sources of the studio (`node tools/studio/build.mjs` writes `stories/studio.js`; `convert.mjs` turns a model into a GLB on a computer, `scan.mjs` describes a plain folder of scenes; its `README.md` is the formats guide) |
| `tools/trackers/` | the Vive trackers' bridge (`bridge.py`: SteamVR's poses to the relay on the same Windows PC; Python 3 and pyopenvr, `--fake` without SteamVR), a fake bridge in Node (`fake.mjs`), the setup on the PC (`README.md`) and the contracts as built (`SPEC.md`) |
| `tools/voice/` | the synthetic narrations: `narrate.mjs <key>` speaks a story's words (Kokoro; German with Piper) and re-times the story, `check.mjs <key>` checks the result (models and Python outside the repository; see its `README.md`) |
| `AGENTS.md`, `CLAUDE.md`, `docs/agents/` | notes on the architecture and conventions for AI coding agents (and people): `AGENTS.md` the core, `docs/agents/*.md` the details by area, `docs/history.md` why rules are as they are |
| `README.txt` | the same notes in plain text |
| `LICENSE`, `NOTICE.md` | the licences: MIT for the code; CC BY 4.0 for the words, narrations, documentation and icons; the data and the parts written by others under their own terms |



# Start here: handing over Networks

An installable web app that teaches network science in twelve narrated 3D stories, each followed by an explore mode,
on desktops, phones and VR/AR headsets (built for Meta Quest Browser). Several headsets can share one room. There is
no build step and no framework: plain HTML and JavaScript with a vendored three.js, deployed by copying the folder to
any HTTPS host. This page is for the colleagues taking it over: what there is, what state it is in, what is still open,
and where to read on.

## What to read, by role

| You will... | Read |
| --- | --- |
| show the stories (screens, kiosk, headsets) | [README.md](README.md) (installing, using), [docs/event-runbook.md](docs/event-runbook.md), [relay/README.md](relay/README.md) for shared rooms |
| check or answer for the science | [docs/data-and-permissions.md](docs/data-and-permissions.md), [docs/questions-for-authors.md](docs/questions-for-authors.md), the story's `tools/<story>/SPEC.md` |
| record a narration | [docs/narration.md](docs/narration.md) (the words and times), [audio/PUT-narration.mp3-HERE.txt](audio/PUT-narration.mp3-HERE.txt) |
| change the code | this page, then [docs/setup-and-release.md](docs/setup-and-release.md) and [AGENTS.md](AGENTS.md) (the full guide: structure, conventions, every shared-room rule, testing) |
| work with an AI coding agent | [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) are written for agents too; see "Working with AI agents" below |

## The twelve stories

| Story | Key | Source | Narration | Data |
| --- | --- | --- | --- | --- |
| Network theory: Airports | `airports` | `stories/airports.js` (hand-written) | recorded | real (OpenFlights routes) |
| Network medicine: Proteins | `proteins` | `stories/proteins.js` (hand-written) | not yet | curated proteins and interactions |
| Spatial interactome: Cell map | `spatial` | `stories/spatial.js` (hand-written) | not yet | curated, laid out at load time |
| LBI Network Medicine: The future | `lbi` | `tools/lbi/` (built) | not yet | illustrative scenes, some real data |
| Rare muscle diseases: Muscle and heart | `nmd` | `tools/nmd/` (built) | not yet | the authors' files in `ikerdata/`, some stand-ins |
| Disease endotypes: Endotypes | `endo` | `tools/endo/` (built) | not yet | the authors' EndotypY run (kept out of the repository) |
| Whole-body PET: One scan, one system | `pet` | `tools/pet/` (built) | not yet | the paper's tables and figures, some stand-ins |
| Tissue microanatomy: Tissue and time | `micro` | `tools/micro/` (built) | not yet | the preprint's numbers, Iva Buljan's network (kept out) |
| Quantum network compression: Three qubits | `qubits` | `tools/qubits/` (built) | not yet | example networks computed live; the real run's summary numbers from Joel Hancock's brief (his method and figures) |
| Networks for everyone: Pass it on | `pass` | `tools/pass/` (built; its globe and cell cut out of `stories/airports.js` and `stories/spatial.js` at build time) | not yet | the airports' routes and the cell map's proteins as in those stories; the fish and the outbreak are simulations; English and German |
| Collective motion: Flock | `flock` | `tools/flock/` (built) | not yet | a live simulation |
| Swarm robotics: Robot gang | `robots` | `tools/robots/` (built) | not yet | a live simulation |

"Built" stories are generated: edit `tools/<key>/` and run `node tools/<key>/build.mjs` (`--check` says whether the
built file is in step); never edit `stories/<key>.js` by hand. What is real and what is a stand-in, story by story, is
in [docs/data-and-permissions.md](docs/data-and-permissions.md).

## Where things stand

- **Tested automatically** before every merge to main: the smoke test (every story, explore mode, headset panels
  with a pretend headset, anchored placement), the update test (service worker), the relay's protocol test and the
  shared-room test (three pages and a pretend headset in a room). All pass on main.
- **Tried on real headsets:** the stories and their sound on Quest; shared rooms on two Quest 3 headsets in several
  rounds (what happened is in [docs/quest-shared-space-findings.md](docs/quest-shared-space-findings.md) and AGENTS.md
  "Shared rooms"). **TO FILL (owner):** which stories have been looked at on a headset (the PET, microanatomy, qubits and
  pass stories were not, during development).
- **Untested on a device:** lining headsets up again after standby or a night; moving and resizing scenes with the
  grips; persistent anchors restored after a restart; sound zones; comfort and frame rate with other people drawn;
  whether the connection to the relay keeps running inside a headset session. The full list ends AGENTS.md "Shared
  rooms"; [docs/event-runbook.md](docs/event-runbook.md) says what to try at an event.
- **Unfinished:** narration for ten stories (scripts ready in [docs/narration.md](docs/narration.md)); the muscle
  story's layer z-scores, walks and endotype names are stand-ins until its authors send their own; the questions in
  [docs/questions-for-authors.md](docs/questions-for-authors.md) are open.
- **Known quirk of the tests:** the shared-room test checks timing, and a heavily loaded machine (software WebGL draws
  slowly) can fail a timing check once. Re-run once; a second failure is real. (A real cause of such failures, a page
  drawing slowly that fell behind its station's clock, was fixed: see `pump` in `shared.js`.)

## Decisions for the owner

Before handing over (or making anything more public), someone has to decide these; the docs mark each place with
**TO FILL (owner)**.

1. **Licence.** The project has no `LICENSE` file, so nobody else has the right to reuse it. Choose one, with the
   Institute if it owns the work. See [docs/data-and-permissions.md](docs/data-and-permissions.md).
2. **The authors' permission** to show their data, figures, posters and talks publicly (muscle, endotype, PET,
   microanatomy and tour stories). Record what was agreed, and with whom, in the same document.
3. **The repository**: it is public, on a personal GitHub account (`unfriend/airportnetworks`), with no licence.
   Every pushed branch is public too, the working branch included. Decide whether it moves to an Institute
   organisation, who gets admin rights, and whether it stays public.
4. **Things already public** that may not belong there: the `logs-2026-10-*` branches (headset logs whose file names
   carry people's first names and room codes), `ikerdata/` (88 MB of the muscle story's authors' files: GitHub Pages
   serves the whole branch, so these files download from the live site too) and screenshots in the history (commits
   `d7c7862`, `e548fa0` and `e3f6b4f`, removed in `bdc8a8e`; drawn content only). Deleting branches or rewriting
   history cannot be undone for those who already fetched them: decide first. The checklist is in
   [docs/data-and-permissions.md](docs/data-and-permissions.md).
5. **The live site**: GitHub Pages publishes `main` at https://unfriend.github.io/airportnetworks/ (no custom domain
   found). Confirm the settings and who may change them (see [docs/setup-and-release.md](docs/setup-and-release.md)).
6. **Who to ask**: **TO FILL (owner):** the people for the code, each story's science, the headsets and the relay.
7. **Deferred**: whether to add a voice assistant; collecting alignment logs from fresh headsets (a test plan is in
   the runbook).

## How work is done

- One working branch; `main` is what visitors get. Main moves forward only after the smoke, update, relay and
  shared-room tests pass (`git push origin HEAD:main`, a fast-forward), then the branch is pushed too. No force pushes
  to main. The full checklist, rollback included, is in [docs/setup-and-release.md](docs/setup-and-release.md).
- After any change to app files, bump `VERSION` in `sw.js`, or installed copies and headsets keep the old files.
  Bump `FORMAT` in `shared.js` when a story's shared state changes shape.
- The story files are large (`stories/airports.js` is about 640 KB with its data): search them, never read them whole.
- Headset behaviour can only be confirmed on a device: say so when reporting a change.

## Adding a thirteenth story

The twelfth story (`pass`) is the most recent example: `git show --stat` on its commits shows every file it touched
(it also shows how a story reuses another's models unchanged, and a story in two languages). Start from the closest
existing story (`tools/qubits/` or `tools/micro/` for a data story, `tools/flock/` for a live simulation).

1. `tools/<key>/`: `SPEC.md` (the contract), `README.md`, the sets (each with a manifest `sets/<name>.md`), the engine
   (`engine/e1_head.js` to `e7_app.js`), `build.mjs`, `harness.html`, `shot.mjs`, `sweep.mjs`, a data generator if it has
   data. Build `stories/<key>.js` and check it with `--check`. Add `tools/<key>/shots/` to `.gitignore`.
2. `index.html`: an entry in `HOST.list` (key, kick, title, colour, loading text, length: pace the story first with
   `node tools/pace.mjs <url> --write <key>`, which prints it), the count in the start
   screen's text and meta description, and the card rows' CSS if the rows change.
3. The headset Stories screen in **every** story: the arc's spacing for n cards and the number word ("twelve") in each
   story's panel code (`stories/airports.js`, `proteins.js`, `spatial.js`, and `tools/*/engine/e6_panels.js`, then
   rebuild those).
4. `shared.js`: bump `FORMAT`; the Arrange all comment (two rows of n/2). `sw.js`: bump `VERSION`, add
   `stories/<key>.js` to `SHELL` and `narration-<key>.mp3` to `AUDIO`.
5. Tests: the story's keys and count in `tools/smoke.mjs` plus an explore step; an entry in `STORIES` in
   `tools/collab.mjs` (its `HEADSET_STORY` stays last).
6. Docs: AGENTS.md (the story table, Layout, a section of its own, the shared-state table, URL hashes), CLAUDE.md
   (the build line), README.md and README.txt, the audio note, [docs/data-and-permissions.md](docs/data-and-permissions.md),
   [docs/questions-for-authors.md](docs/questions-for-authors.md); regenerate [docs/narration.md](docs/narration.md) with
   `node tools/narration.mjs`; relay/README.md if Arrange all needs more floor.
7. Run every test (smoke, update, relay, shared-room; audio after touching sound), then merge as above.

## Working with AI agents

Most of the code was written with Claude Code, following `CLAUDE.md` and `AGENTS.md`; both are plain rules a person can
follow too. Two habits are worth keeping either way: sources and generators stay in the repository (so nothing has to
be rediscovered), and every story is checked by the same tests. For agents, AGENTS.md "Working economically" says how
to keep the cost down: a new story built economically took about 3M tokens (cheaper models for reviews and checks,
one review round); building the tour with the strongest model throughout took about 16M.

## Map of the repository

See the Files table in [README.md](README.md) and "Layout" in [AGENTS.md](AGENTS.md).

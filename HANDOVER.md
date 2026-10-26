# Start here: handing over Networks

An installable web app that teaches network science in thirteen narrated 3D stories, each followed by an explore mode,
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

## The thirteen stories

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
| Ovarian aging: The aging ovary | `ovary` | `tools/ovary/` (built) | not yet | the poster's numbers typed in and values read off its figures (the ovary's count tags: approximate); the neighbor network illustrative |
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
  "Shared rooms"). All thirteen stories, the slideshow and the headset menu on the wrist were tried on a headset in
  October 2026, after the tests had passed on every change.
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
7. **Deferred** (after the next two stories and their reviews):
   - whether to add a voice assistant;
   - collecting alignment logs from fresh headsets (a test plan is in the runbook);
   - **station icons**: a small low-poly 3D icon for each story, floating above its station's ring in a shared room
     (built from simple shapes in the shell's shared-room code, the story's colour, slowly turning). Estimated at
     about an hour of agent work, with the owner approving a contact sheet of all thirteen before they go in;
   - **a story design room**: a room in the headset where the owner talks to Claude about a new story. Claude would
     show the props (the 3D sets) that fit, draft a skeleton story that plays at once with them, build what is missing
     and reload it live. It would run as Claude Code on a laptop next to the headset, with the relay serving the
     working folder, and take the voice with what the person looks at and points at. The steps:
     1. a catalogue of the props;
     2. a player for stories written as data;
     3. the room itself, with live reload;
     4. a bridge on the laptop (the Claude Agent SDK and local speech-to-text, kept outside the app);
     5. push-to-talk in the headset, with what you look at, point at and see.

     It was estimated at 4 to 6M tokens to build. The microphone inside a headset session is untested on Quest.
   - **live updates**: the app picks up a release by itself without losing its place.
     - **How it notices:** a small version file, written by a release script, lists each story file's fingerprint, the
       shell's version, the shared-room format and the list of stories. The app checks it every minute or so, and when
       the page comes back into view.
     - **Taken without asking:**
       - a new story's card appears on the Stories screen, on the page and in the headset;
       - a changed story not on show updates quietly;
       - the story on show is swapped in place, keeping its chapter, time, mode, explore choices and placement, or at
         its next pause if preferred.
     - **A dialogue first, on the page and as a headset panel**, for breaking changes: the shell (`index.html`,
       `shared.js`, `sw.js`), a new shared-room `FORMAT`, or a story that needs a newer shell than the one running
       (each story would say which it needs).
     - **After a full reload:** the app saves its place, reloads and restores it. A full reload always ends a headset
       session (entering VR needs a tap), so the headset then shows one "Enter VR to continue" button.
     - **Groundwork:**
       - the list of stories moves out of `index.html` into its own file;
       - the headset Stories screen in all thirteen stories reads the number of stories instead of having it written
         in (today "thirteen" and the card spacing are in every story's panel code).
     - **Size:** estimated at about 3 to 4 hours of agent work and 2 to 3M tokens, the tests included (the update test
       would cover a story added live, a story swapped in place, the dialogue and the restore). Most useful for a kiosk
       or headsets at an event.
   - **shared rooms without a relay (peer to peer)**, so the copy on GitHub Pages has multiplayer too.
     - **How:** the page that starts a room plays the relay's part for everyone, reusing `LocalSocket`'s rules. The
       others connect to it over WebRTC with PeerJS (MIT, vendored like three.js, loaded only when needed) in a
       `PeerSocket` with the same interface. If the host leaves, the next device takes over from its own copy of the
       room.
     - **Order to try:** the relay first, then peer to peer, then this device only.
     - **Catches:**
       - PeerJS still needs a server to introduce the devices: its free public one, with no guarantees, or one we
         host ourselves.
       - University and event Wi-Fi often blocks direct links between devices; getting through then needs a TURN
         server, another third party. For events the laptop relay stays the reliable choice.
       - Without a relay there is no "Fresh shared space" and no stored alignment logs.
       - The introduction server and the other devices see each device's IP address: record it in
         `docs/data-and-permissions.md`, and the owner decides whether that is acceptable.
       - WebRTC inside an immersive session on Quest is untested.
     - **Size:** estimated at about 3 to 5 hours of agent work and 2 to 4M tokens, the tests included (a peer-to-peer
       run of the shared-room test with a pretend introduction server).
   - **subtitles in the headset**, chosen per person from the headset's menu (Subtitles: off / follow / placed).
     - **Follow:** a little below the line of sight, about 1.5 m ahead. Not stuck to the head (uncomfortable): they
       stay put until you turn more than about 25 degrees, then glide back in front of you, as the wrist clock turns to
       your eyes.
     - **Placed:** picked up with the grip and left anywhere in the room, on this headset only, remembered for next
       time.
     - Per device, never in `collab.state()`: nothing changes for the shared rooms.
     - **How:** all in the shell, no change to the thirteen stories. The words come from each story's panel (its
       `section.ch` chapters and their `data-at` lines, read as `tools/narration.mjs` reads them), split into short
       two-line captions spread over the time until the next line by word count. The pass story's follow its
       language. The panel is drawn like the shell's menu and clock, and the grip reuses the code that carries
       stations.
     - **To know:** only the airports story has a recorded voice, so in the other twelve the subtitles repeat the
       panel's words (useful when the panel is out of view: in the flock or among the fish, at a station, the panel
       behind you). Each line starts with the voice; the captions within a long line are timed by word count, not
       matched word by word.
     - **Size:** estimated at about 2 to 3 hours of agent work and 1 to 1.5M tokens, the tests included, plus a short
       round of tuning (size, distance, follow speed) after the owner tries it on a Quest. A caption bar under the
       scene on screens and phones would add about half an hour.

## How work is done

- One working branch; `main` is what visitors get. Main moves forward only after the smoke, update, relay and
  shared-room tests pass (`git push origin HEAD:main`, a fast-forward), then the branch is pushed too. No force pushes
  to main. The full checklist, rollback included, is in [docs/setup-and-release.md](docs/setup-and-release.md).
- After any change to app files, bump `VERSION` in `sw.js`, or installed copies and headsets keep the old files.
  Bump `FORMAT` in `shared.js` when a story's shared state changes shape.
- The story files are large (`stories/airports.js` is about 640 KB with its data): search them, never read them whole.
- Headset behaviour can only be confirmed on a device: say so when reporting a change.

## Adding a thirteenth story

The thirteenth story (`ovary`) is the most recent example: `git show --stat` on its commits shows every file it touched
(the twelfth, `pass`, shows how a story reuses another's models unchanged, and a story in two languages). Start from the closest
existing story (`tools/qubits/` or `tools/micro/` for a data story, `tools/flock/` for a live simulation).

1. `tools/<key>/`: `SPEC.md` (the contract), `README.md`, the sets (each with a manifest `sets/<name>.md`), the engine
   (`engine/e1_head.js` to `e7_app.js`), `build.mjs`, `harness.html`, `shot.mjs`, `sweep.mjs`, a data generator if it has
   data. Build `stories/<key>.js` and check it with `--check`. Add `tools/<key>/shots/` to `.gitignore`.
2. `index.html`: an entry in `HOST.list` (key, kick, title, colour, loading text, length: pace the story first with
   `node tools/pace.mjs <url> --write <key>`, which prints it), the count in the start
   screen's text and meta description, and the card rows' CSS if the rows change.
3. The headset Stories screen in **every** story: the arc's spacing for n cards and the number word ("thirteen") in each
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

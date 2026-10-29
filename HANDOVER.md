# Start here: handing over Networks

An installable web app that teaches network science in sixteen narrated 3D stories, each followed by an explore mode,
on desktops, phones and VR/AR headsets (built for Meta Quest Browser). Several headsets can share one room. There is
no build step and no framework: plain HTML and JavaScript with a vendored three.js, deployed by copying the folder to
any HTTPS host. This page is for the colleagues taking it over: what there is, what state it is in, what is still open,
and where to read on.

## What to read, by role

| You will... | Read |
| --- | --- |
| show the stories (screens, kiosk, headsets) | [README.md](README.md) (installing, using), [docs/event-runbook.md](docs/event-runbook.md), [relay/README.md](relay/README.md) for shared rooms |
| check or answer for the science | [docs/data-and-permissions.md](docs/data-and-permissions.md), [docs/questions-for-authors.md](docs/questions-for-authors.md), the story's `tools/<story>/SPEC.md` |
| record a narration | [docs/narration.md](docs/narration.md) (the words and times), [audio/PUT-narration.mp3-HERE.txt](audio/PUT-narration.mp3-HERE.txt); a synthetic voice: [tools/voice/README.md](tools/voice/README.md) |
| change the code | this page, then [docs/setup-and-release.md](docs/setup-and-release.md) and [AGENTS.md](AGENTS.md) (the full guide: structure, conventions, every shared-room rule, testing) |
| work with an AI coding agent | [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) are written for agents too; see "Working with AI agents" below |

## The sixteen stories

| Story | Key | Source | Narration | Data |
| --- | --- | --- | --- | --- |
| Network theory: Airports | `airports` | `stories/airports.js` (hand-written) | recorded | real (OpenFlights routes) |
| Network medicine: Proteins | `proteins` | `stories/proteins.js` (hand-written) | not yet | curated proteins and interactions |
| Spatial interactome: Cell map | `spatial` | `stories/spatial.js` (hand-written) | not yet | curated, laid out at load time |
| LBI Network Medicine: The future | `lbi` | `tools/lbi/` (built) | synthetic (Kokoro, `af_heart`) | illustrative scenes, some real data |
| Rare muscle diseases: Muscle and heart | `nmd` | `tools/nmd/` (built) | not yet | the authors' files in `ikerdata/`, some stand-ins |
| Disease endotypes: Endotypes | `endo` | `tools/endo/` (built) | not yet | the authors' EndotypY run (kept out of the repository) |
| Whole-body PET: One scan, one system | `pet` | `tools/pet/` (built) | not yet | the paper's tables and figures, some stand-ins |
| Tissue microanatomy: Tissue and time | `micro` | `tools/micro/` (built) | not yet | the preprint's numbers, Iva Buljan's network (kept out) |
| Ovarian aging: The aging ovary | `ovary` | `tools/ovary/` (built) | not yet | the poster's numbers typed in and values read off its figures (the ovary's count tags: approximate); the neighbor network illustrative |
| Quantum network compression: Three qubits | `qubits` | `tools/qubits/` (built) | not yet | example networks computed live; the real run's summary numbers from Joel Hancock's brief (his method and figures) |
| Quantum phylogenetics: The mutation machine | `mutation` | `tools/mutation/` (built) | not yet | example numbers computed live, as in the authors' own test; the poster's numbers typed in, shown only as "in the authors' test"; the coupling computed live is our stand-in for their circuit |
| Tissue topology: The shape of tissue | `topo` | `tools/topo/` (built) | not yet | every number computed by the authors' package topocyte on their GTEx liver cohort (the files kept out of the repository; only the numbers in it); the poster's numbers all reproduced; the genes and proteins of the last chapter are sketches |
| Soil microbes: Holding on to nitrogen | `soil` | `tools/soil/` (built) | not yet | the field trial's data (16S read counts, their taxonomy, the field metadata; the files kept out of the repository, only the numbers in it); the slides' charts read off (approximate); the soil block, its flows and the field's layout illustrative; the co-occurrence network built for this story |
| Networks for everyone: Pass it on | `pass` | `tools/pass/` (built; its globe and cell cut out of `stories/airports.js` and `stories/spatial.js` at build time) | not yet | the airports' routes and the cell map's proteins as in those stories; the fish and the outbreak are simulations; English and German |
| Collective motion: Flock | `flock` | `tools/flock/` (built) | not yet | a live simulation |
| Swarm robotics: Robot gang | `robots` | `tools/robots/` (built) | not yet | a live simulation |

"Built" stories are generated: edit `tools/<key>/` and run `node tools/<key>/build.mjs` (`--check` says whether the
built file is in step); never edit `stories/<key>.js` by hand. What is real and what is a stand-in, story by story, is
in [docs/data-and-permissions.md](docs/data-and-permissions.md).

## Where things stand

- **Tested automatically** before every merge to main: the smoke test (every story, explore mode, headset panels
  with a pretend headset, anchored placement), the sound test, the update test (service worker), the live-update test
  (`tools/live.mjs`), the relay's protocol test, the introduction server's test (`tools/peer.mjs`), the tour's
  recording against its story (`tools/voice/check.mjs lbi --quick`), the shared-room test (three pages and a pretend
  headset in a room, with its parts for rooms on this network, following a person, the design room and the circles),
  `node tools/release.mjs --check` and each built story's `--check`. All pass on main (networks-v97).
- **Built on 29 October 2026 (release networks-v96), tested headlessly only:**
  - *Live updates and hot reload:* a running copy takes a new release by itself without losing its place, and while
    developing follows the files as they are saved (`HOST.live`, `version.json` written by `node tools/release.mjs`,
    the relay's `--watch` and `--build`; AGENTS.md "Hot reload and live updates").
  - *Station icons:* a small low-poly model of each station's story, in its colour, turning over its ring in a shared
    room (since the design room's part 2, below, each story's main miniature from `lowpoly.js`; `tools/icons.html`
    shows them all).
  - *45 low-poly miniatures* of the stories' 3D sets (`lowpoly.js`, built by `node tools/lowpoly/build.mjs`), from
    the catalogue of props ([docs/props.md](docs/props.md), `tools/design/props.json`).
  - *The design room, part 1* (`#design`, `stories/design.js` from `tools/design/`; not one of the stories, so on no
    Stories screen): a round table with every story's miniatures on a plate in its colour; pick one for the stage and
    its card, pick it up with the grip in a headset; shared like a story in a room.
  - *Subtitles in the headset:* a setting for the whole room (*Subtitles: on/off* in the headset's menu and the
    Shared dialog; off by default; the device's own outside a room; `#subs=on`), the narration's words in a strip low in
    the view that follows the head loosely. All in the shell, fed by a small caption hook in each of the stories
    (FORMAT networks-24). How they read and follow on a headset is untested.
  - *The PET story's text fixes* after the poster comparison (item 8 below; 6:33).
  - *The tour narrated by a synthetic voice* (Kokoro-82M, `af_heart`; `tools/voice/`, `audio/narration-lbi.mp3`,
    10:42); `node tools/voice/check.mjs lbi` checks the recording against the story.
- **Released as networks-v97 (29 October 2026; FORMAT networks-25), tested headlessly only:** the loading bar, rooms
  on this network (with the relay's `--proxy <n>`), panels per story, the design room's part 2, follow a person, the
  PET story's strength chart removed (item 8 below) and the changes after the ten-headset test, each below. A room
  needs every device on networks-v97 (a page of v96 is refused by the new format and asked to reload).
- **In networks-v97:** *a loading bar* (the owner: "some rooms like 'the
  future' take a little time to load"). Every story now builds in steps that yield (the scene, each set with its
  shaders, the story, explore mode, the panels; `LOAD` in each engine and in the three hand-written stories) and
  reports them (`HOST.progress`): the page shows a thin bar and the step under the loading line, and a headset shows
  a card with the story's name and a bar in its colour in front of you and a ring on the left wrist, from 0.4 s on,
  fading as the story appears (`HOST.loading`; AGENTS.md "How the shell and stories fit together"). The PET story's
  organ icons are made after the load. Measured headlessly (software WebGL, a busy machine), the longest task of a
  multi-scene story's load fell from 0.7 to 1.4 s to 0.2 to 0.4 s (at most one shader's compile), while the whole load
  took up to 0.6 s longer: each pause lets the page draw a frame, which software WebGL composites slowly and the next
  shader waits for. How long a load takes on a Quest, and how the card and the ring look there, are untested.
- **In networks-v97:** *rooms on this network* (FORMAT networks-25). The
  owner's priority, in their words: "Rejoin by itself, never join something new by itself." The Shared dialog and the
  headset's menu list *Rooms on this network* (code, its first member's or host's name, people; one press joins): with
  a relay its `GET /api/near` (the relay hashes each device's address; `--proxy` behind Coolify, set in its start
  command, `--proxy 2` with a CDN such as Cloudflare in front: see `relay/README.md`); without one, a room's host holds one of eight slots named after a hash of the network's public address
  (as Cloudflare's STUN server reports it) on the introduction server, and seekers ask there. A device that was in a
  room joins it again by itself when the app opens on the same network within a week (a notice says so, with Leave):
  by its code on the relay (a relay that forgot it gets it back from the device's copy; a code given to another room
  meanwhile is told apart by the room's own id, `rid`, and never joined), by its id peer to peer (linked to whoever
  holds it, else hosted from the device's copy). Never after Leave until joined again by hand, never a room it was
  never in; on another network, one button, *Start room XYZ again*. A switch per room, *Show on this network*. No
  address is kept or logged (only a 24-bit hash; [docs/data-and-permissions.md](docs/data-and-permissions.md)). How it
  works: AGENTS.md "Shared rooms"; at an event: [docs/event-runbook.md](docs/event-runbook.md). Tested between pages on
  one machine with pretend networks (`node tools/collab.mjs --near`); real networks (home routers, hotspots, eduroam,
  a relay behind Coolify) and headsets rejoining after a restart are untested.
- **In networks-v97:** *panels per story* (the owner: "i would want that for
  every story as an independent per story toggle maybe inside the clock menu"). A row in the headset's menu for the
  story on show, *Panels: shown* / *controls only* / *hidden*, each press the next: controls only keeps just the foot
  bar (play and pause, the chapter arrows, the clock, Next; good with subtitles on), hidden takes both story panels
  away (A or X still plays and pauses; the menu stays to switch back; the Stories screen is never affected). Each story
  (and the design room) keeps its own value: the device's outside a shared room (`#panels=controls` in a link sets it
  for the story it opens), the station's in a room, for everyone at that circle, and settable per station in the
  page's Shared dialog too, never refused by the circles lock (key `st.<id>.ui`, part of FORMAT networks-25).
  Independent of Labels (labels hidden still hides both). `HOST.panels` in `index.html`; AGENTS.md "How the shell and
  stories fit together". How it feels on a headset is untested.
- **In networks-v97:** *the design room, part 2* (the owner's queue). A
  *Design room* row in the headset's menu: outside a shared room it opens the design room; in a room, *Design room
  here* puts the props table at your feet as a circle facing your way (or moves the room's one there), refused while
  the circles are locked as Add is; the page's Shared dialog lists the design room after the stories in its station
  picker (and the headset's Add here page too). Arrange all never places, moves or removes it; its station starts at
  the table, in explore mode. The stations' icons are now each story's main miniature (`icon` in `stories/list.js`:
  the tour's interactome, the PET scanner, the airports' globe and so on; the design room's own icon is a new small
  miniature of its table, `design.table`), loaded once from `lowpoly.js`, built once per story and kept, in the
  story's colour, with the glowing dodecahedron while they load or for a story without one; the old hand-made models
  are gone from `shared.js`. AGENTS.md "Shared rooms" ("Station icons", "The design room in a room"). How the icons
  read from across a real room and the table at a circle on a headset are untested.
- **In networks-v97:** *follow a person* (the owner: a laptop for people who
  do not want to wear a headset follows along). In the page's Shared dialog each person in a headset has *Follow* in
  the people list: the page then follows whichever station that person stands at, switching as they walk from one
  circle to the next, and stays on the last one when they step out of every circle (or take the headset off). It stops
  when they leave the room (the page stays at their last station), or when the page follows a station or picks a story
  by hand, as following a station stops now. The dialog says "Following Ann (at The flock)". Pages only (a headset
  walks); nothing new is written to the room (no `FORMAT` change). AGENTS.md "Shared rooms"; at an event:
  [docs/event-runbook.md](docs/event-runbook.md). Tested with a pretend person in a headset between pages on one
  machine (`node tools/collab.mjs --follow`); with real headsets walking a room it is untested.
- **Tried with ten headsets (29 October 2026):** the owner ran main (v96) with 10 headsets through a local relay on
  their computer and one router on site: "everything worked very well". Their changes, below.
- **In networks-v97, after the ten-headset test:** (1) *stay in your story*: "One should
  only exit a story when walking into a new circle, otherwise stay in the story even if they move away from the
  story's circle." A headset that has walked into a circle keeps that station wherever it walks (its story shows,
  plays on the station's clock and stays in step with the room; its narration fades with distance); only walking into
  another circle switches. Leaving the room, Leave, a new session and a station removed end it; before any circle a
  headset sees no story, as before. (2) *Rings only in a circle*: while a headset has a station, the other stations
  show their rings only (no card, no model over it). (3) Pointing at a ring brings up its card and model for as long as
  you point, fading about 2 s after. (4) *Two locks* ("one toggle for locking the circles' movement globally and one
  toggle per room for locking its panels and story elements"): *Lock circles* (the old layout lock's key, now only the
  circles: the grip on a ring or card, the map, Arrange all, Add, Move here, Remove, Design room here) and per station
  *Lock this story* (the clock menu at that circle) or *Lock story* (each station's row in the Shared dialog): its
  scene and panel grips refused for everyone at that circle (in `st.<id>.ui` with its panels, FORMAT networks-25). A
  room locked in v96 reads as circles locked only: lock its stories once. (5) *People at your circle*:
  other people (name tag, head, hands) are drawn only when they are at your circle (everyone before your first circle);
  *People: same circle* / *everyone* in the clock menu (this headset only, never in the room) for debugging. Pages'
  room maps still show everyone. Also: following a person is offered only for people in a headset (`followPerson`
  checks it too), and the props catalogue's PET organs entry lost the removed strength chart (`organs_measures`
  instead; the design room rebuilt). AGENTS.md "Shared rooms"; at an event: [docs/event-runbook.md](docs/event-runbook.md).
  Tests: `node tools/collab.mjs --circles` (its own room) and the rewritten walk-out checks in the main run. All of it
  is untested on headsets: how a ring's card reads when pointed at, the story heard from out of its circle, the locks
  and the People toggle in use.
- **Built and integrated, not yet released (not in networks-v97):** the sixteenth story, *Holding on to nitrogen* (`soil`), after the slides and
  field-trial data of Marina Montserrat Díez, Christa Schleper and colleagues (the authors' permission given through
  the owner, 29 October 2026; anything unknown illustrative and labelled so). Its sources are in `tools/soil/` and
  its data sources in [docs/data-and-permissions.md](docs/data-and-permissions.md). Made for the Global Peter Drucker
  Forum in Vienna. Integrated on 29 October 2026 (its card in `stories/list.js`, `sw.js`, its miniatures, the design
  room's catalogue, the smoke and shared-room tests, the docs: item 11 under "Decisions for the owner"); the release
  (`VERSION`, `node tools/release.mjs`, the word "sixteen" in `index.html`'s head) follows. Untested on a headset.
- **Sound effects, phase 1: built, not yet released, off until the owner approves the sounds** (the owner, 29 October
  2026: "nice sound effects to everything"). `sfx.js` (`HOST.sfx`) plays the shell's own sounds through the narration's
  one Web Audio context (clicks and switches on the page and in the headset's menu, a tick when pointing at the shell's
  things, the menu opening and closing, circles picked up, let go and placed, the locks, notices, a chime when a story
  has loaded, a swell when walking into a circle, people joining and leaving, from where they stand) and a quiet
  background for each story (dusk and birds for the flock, a sea hush for the pass story, room tone for the robots,
  wind for the soil story, a calm tone coloured by the story for the rest). In a headset the sounds come from places
  (HRTF); everything ducks 9 dB under the narration; at most 16 sounds at once. Per device: *Sound effects* and a volume
  in Sound check (page) and in the headset's menu, `#sfx=on`; **off by default**. All made in code, no files. Item 12
  below: the owner's listening round decides phase 2 (sounds inside the stories). AGENTS.md, the sound notes. Tested
  headlessly (`node tools/audio.mjs`); nobody has heard them, and the 3D sound and the levels on a headset are untested.
- **Tried on real headsets:** the stories and their sound on Quest; shared rooms on two Quest 3 headsets in several
  rounds (what happened is in [docs/quest-shared-space-findings.md](docs/quest-shared-space-findings.md) and AGENTS.md
  "Shared rooms"). All thirteen stories of then, the slideshow and the headset menu on the wrist were tried on a headset
  in October 2026, after the tests had passed on every change; the fourteenth and the fifteenth, the mutation machine
  and the shape of tissue, came after.
- **Checked on a Quest 3 (28 October 2026):** the two headset settings (labels in 3D, on top or hidden, and free
  moving, everything in 3D by default and the same for a whole room): the labels, the story panels and the station
  cards in 3D, hidden taking every story panel away, and the grip moving and turning scenes and panels, alone and at a
  station in a shared room (the grip moves things there only at your station, by design).
- **Shared rooms without a relay (peer to peer): built on 28 October 2026** (it was on the deferred list), so the copy
  on GitHub Pages has multiplayer too. A room runs on the relay when there is one, else peer to peer (PeerJS 1.5.5,
  vendored; its public introduction server and Cloudflare's STUN server, which with the other devices see each
  device's IP address, as the owner agreed: [docs/data-and-permissions.md](docs/data-and-permissions.md)), else on
  this device only. The page that holds the room's id hosts it with the relay's rules; when it leaves, the one longest
  in the room takes over with its own copy and the room's clock; a headset that hosts hands the room to the first
  laptop or desktop page that joins. No Fresh shared space and no stored logs without the relay. How it works:
  AGENTS.md "Shared rooms"; at an event: [docs/event-runbook.md](docs/event-runbook.md); a network checked first with
  the test page `p2p/`. Tested between headless pages on one machine (`node tools/collab.mjs --p2p`, through the
  relay's own introduction server). **First tried on real devices (owner, 29 October 2026):** two laptops found each
  other on a local network with the test page `p2p/`, and two laptops were in one peer-to-peer room. **Still untested
  on devices:** headsets and phones in a peer-to-peer room, links inside VR and AR, a host change and a hand-over at an
  event, and how long PeerJS's public server holds the id of a host that went to sleep (up to about a minute, by its
  documentation).
- **Untested on a device:** lining headsets up again after standby or a night; how a scene moved or turned at a
  station looks on the other headsets; persistent anchors restored after a restart; sound zones; comfort and frame
  rate with other people drawn; whether the connection to the relay keeps running inside a headset session; people's
  name tags in each label mode; the story panels in 3D in the life-size and stand-inside views (passing birds, fish or
  layers hide parts of them). The full list ends AGENTS.md "Shared rooms"; [docs/event-runbook.md](docs/event-runbook.md)
  says what to try at an event.
- **Unfinished:** narration for thirteen stories (scripts ready in [docs/narration.md](docs/narration.md)). The airports
  story has a human recording; the tour (*The future*) a synthetic one, made by `tools/voice/` with Kokoro-82M's
  American voice `af_heart`, which the owner picked from samples of several voices (29 October 2026). The others can
  follow with the same command on the owner's go (`node tools/voice/narrate.mjs <key>`, see
  [tools/voice/README.md](tools/voice/README.md)); how the tour sounds was not heard here. The muscle
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
   microanatomy, mutation machine (a draft poster), tissue topology (the authors' cohort data and code), soil (the
   slides and the field trial's data, unpublished: given through the owner on 29 October 2026; whether it may be public
   before publication is still to say) and tour stories). Record what was agreed, and with whom, in the same
   document.
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
   - **The relay on a public server** (the owner's Coolify, considered on 29 October 2026; `relay/Dockerfile` is ready
     for it: Dockerfile location `/relay/Dockerfile`, port 8787, a domain with HTTPS). It works wherever web pages do
     (eduroam, hotspots), serves the app too, and peer to peer stays the fallback when it is down. **It has no login:**
     anyone with its address can list the open rooms with the names of the people in them, read and change any room by
     its 3-letter code, see names and positions, start rooms (at most 2,000) and use its introduction server. Rates,
     sizes and room expiry are capped; no patient data passes through it; its alignment logs stay off unless `--logs`.
     Two options were offered and set aside for now (owner: "no pins for now, I'll host this privately or think about
     it"): an optional PIN for the relay (set in Coolify; asked once per page, a number pad in the headset's menu, or
     carried by the room link) and a room list without names; either would cover the peer-to-peer rooms too. Once it is
     up, its address can become the app's default relay (in `shared.js`), so the GitHub Pages copy uses it with no setup.
6. **Who to ask**: **TO FILL (owner):** the people for the code, each story's science, the headsets and the relay.
7. **Deferred** (and what of the earlier list was built):
   - whether to add a voice assistant;
   - collecting alignment logs from fresh headsets (a test plan is in the runbook);
   - **German for every story** (on hold, the owner, 29 October 2026: keep it low for now). The stories' text in German
     with a German voice and subtitles: about 1.5 to 2 days of agent work; explore mode in German too: about 1 to 1.5
     days more. In a shared room everyone keeps one timeline, so each stretch lasts the longer of its two languages (as
     the pass story, already in English and German, does);
   - **The queue** (the owner, 29 October 2026): rooms on this network, first in it, the loading bar queued alongside,
     panels per story, the design room's part 2, follow a person and the ten-headset round's changes are built and
     released as networks-v97 (see "Where things stand"). Next: the sixteenth story, on soil, built and integrated (item 11 below), then its
     integration and a release. Each item is described below;
   - **circles that load code from a link** (on hold, the owner, 29 October 2026; the design agreed, not to build
     yet). The owner's aim: the whole office as one shared room, where colleagues add circles of their own, with their
     own logic, from a web page or a GitHub repository. How: a station whose story is a script from a web address
     (their own site, GitHub Pages or jsDelivr), loaded into the running page as our stories are, so nobody leaves AR;
     it gets the circle, the room's clock, the controllers and hands, a shared state, subtitles and the people. A whole
     other web page cannot run inside the headset session (one page owns it; opening another ends it), so their page
     carries one script written for the circle; a starter template that also runs on its own as a normal page. Trust:
     the code runs with the app's rights on each device (it can see the room's people and positions and move circles),
     so each device asks once per address ("Load code from this address? It can see and change this room") and the
     circle shows where its code comes from; a sealed sandbox for strangers' code is a bigger step (about 2 days). Also:
     "Add a circle from a link" in the page's Shared dialog (the headset lists the room's saved links), a `FORMAT`
     bump, tests with a local example circle. Office scale: "Add a circle here" where you stand and an office-sized
     room map; a walk test with a headset first (does one calibration hold across rooms and doorways; Quest's
     passthrough outside the scanned room). About 5 to 6 hours, plus 1 to 2 hours for office-scale placing;
   - **rooms on this network**: built (see "Where things stand");
   - **follow a person**: built (see "Where things stand");
   - **see through their eyes** (optional, later; the owner, 29 October 2026): a laptop's camera follows that wearer's
     head at their circle (a view for a projector). About 3 to 4 hours (each story places its scene differently in a
     headset);
   - **a real-world-to-virtual slider** (later; the owner, 29 October 2026: "when I am in a circle I have a slider on
     my watch where I can fade out the real world and fade into VR"): inside the same AR session, so the room's
     alignment, the circle, the people, the sync and the sound carry on. A slider in the clock menu while at a circle
     (*Real world ↔ Virtual*: drag with a fingertip or the ray, or steps of 0, 25, 50, 75 and 100 %) fades the story's
     own surroundings in over the passthrough (the dark backdrop; the flock's dusk sky and land, the fish's sea, the
     robots' model room), per headset and remembered per story. Safety: walking out of your circle (beyond about
     1.5 m) fades the real world back in by itself, and stepping back in returns to the setting (the Quest may not show
     its boundary in an AR session, and a room may hold ten people). Untested until tried on a headset: how partial
     passthrough looks, and whether the boundary shows. About 2 to 3 hours (the slider, the same few lines in all
     sixteen stories and the design room, tests, docs);
   - **the design room, part 2**: built (see "Where things stand": the menu's *Design room* button, the table as a
     circle in a shared room, the stations' icons from the miniatures). Part 1 (the table) is built too (AGENTS.md "The
     design room"). Of the first plan (a catalogue of the props, a player for stories written as
     data, the room with live reload, a bridge to Claude on a laptop, push-to-talk in the headset) the catalogue, the
     room's table and live reload are built and the player was dropped; the bridge and push-to-talk wait for the owner
     (the microphone inside a headset session is untested on Quest);
   - **a loading bar in the headset** (at the wrist clock and in front of you while a story loads): built (see "Where
     things stand"; AGENTS.md "How the shell and stories fit together" and "Inside a story"). What could come next: a
     single shader's compile is still one task (three.js r128 cannot compile in parallel), and a few sets take 0.2 to
     0.5 s to build here; both would need changes inside three.js or the sets;
   - **station icons**: built, and since the design room's part 2 made from the miniatures (see "Where things
     stand"). **For the owner:** approve the contact sheet of all seventeen, the sixteen stories' and the design room's (open `tools/icons.html` next to the app;
     `&turns=4` shows each from four sides) or say which miniature should stand for a story (its `icon` in
     `stories/list.js`). How they read from across a real room is untested on a headset;
   - **live updates and hot reload**: built (see "Where things stand"; AGENTS.md "Hot reload and live updates";
     [docs/setup-and-release.md](docs/setup-and-release.md), step 5b and the table in section 2). A release now ends
     with `node tools/release.mjs` after bumping `VERSION` (it writes `version.json` and stamps the shell's release into
     `index.html`). Taken without asking: a new story's card, a changed story (the one on show swapped in place at a
     quiet moment, keeping its place); asked first (Reload now or Later): a new shell, a new `FORMAT`, a story that
     needs a newer shell, a station whose story the device does not know (its card says "Update needed"). While
     developing: `node relay/server.mjs --lan --watch --build`. **Untested on a headset:** a swap in place inside a
     session, the question's panel and its buttons, Enter VR to continue, and the watch channel in Quest Browser;
   - **subtitles in the headset**: built as a setting for the whole room, on or off (the owner, 29 October: "a
     switchable option per room"), replacing the earlier plan of a per-person choice (off / follow / placed, a strip
     picked up and left in the room). The strip follows the head loosely (it stays until you turn about 15 degrees
     away, then glides back); the words are the panel's, timed by word count from each line's start. Only the airports
     and the tour have a voice so far, so elsewhere they repeat the panel's words (useful when the panel is out of
     view). A caption bar on screens and phones, and placing the strip by hand, were not built. How they read and
     follow on a headset is untested.
8. **The PET story ("One scan, one system"): its second half waits for the poster** (October 2026). Done on 28 October:
   the scanner hands its patient to the body in one move (the scanner goes, the body stands up, its glow fades, then
   the sugar), the organ labels are names only, the Vision chapter is gone, the second chapter is "How PET sees" with
   the owner's text changes, and the intro is 2 s shorter (6:13 in all). Still open from the owner's notes:
   - The text from the Network chapter on (about 3:52 then) "does not match the poster" (owner, 28 October; set aside
     for now). The poster's PDF is needed in the session to rewrite it.
   - The network and the prognosis need far more 3D.
   - The story is a bit dry: less statistics, more story (the 29 October fixes took a few numbers out).

   **Compared with the poster (29 October).** Two independent comparisons of the story with the poster "Shaping a New
   Era in Nuclear Medicine" ([docs/pet-poster-comparison.md](docs/pet-poster-comparison.md)) found that the story
   follows the poster up to the Organs chapter and then tells the paper (Geist et al., Med 2025); every number it gives
   is right for the paper. None of the poster's own results is in it (one network per scan from seven tissues, Clearance
   and Heterogeneity, the metabolic displacement index, the four groups on its scale, survival by thirds, the response
   to immunotherapy, the follow-up scans); of the poster it keeps the title, the authors and the general framing (the
   vision row is the vision slide's). The version before commit b7053fb (23 October) told this poster's story with its
   numbers (`git show b7053fb^:tools/pet/sets/data.js`, under `poster`), so the colleague's note that it "did not
   match the poster" may have meant another poster, or the made-up formulas and profiles of that version.

   **Fixed now (29 October, the owner's go; 6:33 in all):** the intro says "From PET scans to a network of organs" and
   captions the vision row as the aim (prognosis and medication: goals, not yet shown); FDG is "mostly" not taken back;
   PET's main use is "in routine care: finding and staging cancer"; the Network chapter opens with "a network like this
   needs many scans" (one scan gives one row of numbers; these networks are the paper's, each of a group of scans;
   "across scans", since the 658 include repeat scans); the Health chapter speaks of groups ("in the heavier group, the
   brain is a hub", "groups with more tumour load have thinner networks", healthy against cancer "compared within this
   one set of scans"), and the CRP thirds went (they mix healthy people and patients; within either group CRP made no
   clear difference, Table 2): that turn shows the tumour-load networks instead; the credits say the numbers are the
   paper's; explore's liver uses "a rule like the poster's, applied here to patches of one organ, as an illustration".
   Later that day the strength chart beside the body went (the owner: "remove that from the story and the interactive
   mode"): the density and disorder stay as a tag under the network's title, explore's Network view replaces Strength,
   and its Networks pane names the strongest organs in words instead of bars (the story's words and its 6:33 unchanged).

   **Open question to the colleague** (the owner is asking): which poster was meant, and was the note about the content
   or how it was drawn? **The rebuild waits for that answer** and for the authors' open points (P4 to P11 in
   [docs/questions-for-authors.md](docs/questions-for-authors.md): the threshold and the ratios' direction, the formulas,
   the index scale's direction, the dashed lines, means or medians, the counts, the p values, the follow-up results).
   **The plan, in short:** keep the story to the Organs chapter; one bridge line with the paper's two or three key
   numbers (healthy groups dense, cancer sparse); then the poster in 3D: a person's network from seven tissues on their
   body (pairwise ratios, a threshold, links; labelled illustrative), Clearance and Heterogeneity folding into the
   index, the four groups standing along its scale, the cancer patients' thirds and their survival as crowds that thin,
   the 19 people's response (all p above 0.05: a first hint) and the follow-up claim labelled "the poster reports";
   group summaries only, never a single patient's points. The poster's numbers come back from `b7053fb^`; explore's
   old One scan and People tabs are the starting point there.
9. **The fourteenth story: "The mutation machine" (built, October 2026).** From the poster "Converting Mutation into a
   Machinery: DNA Substitution Models as Quantum Circuits" (Enes Berk Sakalli, Arndt von Haeseler; a draft, its footer
   still has placeholders), with the first author's answers on the values, the turn and how to word the result (MM2 to
   MM4 in [docs/questions-for-authors.md](docs/questions-for-authors.md)). Sources in `tools/mutation/` (`SPEC.md`,
   `README.md`, the sets' manifests); its maths checked by `node tools/mutation/test-mmath.mjs`.
   - **What it is** (about 8.5 minutes, 8 chapters, then explore): a text in four letters copied with swaps; a family
     tree in 3D that grows up from its root, its branch lengths real lengths, so you walk round it and look up into it
     (letters ride up the branches, a swap flashes where it happens); a letter as two qubits and its read-outs; the rule
     of change as balls and arrows and a path through a pyramid of mixes; the machine for one branch (copy, then turn)
     and its circuit, one machine per branch; an RNA stem, a pair breaking and the coupling; the ancestor of three
     species rebuilt 2,000 times three ways (the authors' 10 %, 43 % and 20 %, worded as the author asked: the coupling
     favours matching pairs too strongly, so its percentages are not true chances); what it is for. Explore: Letters,
     Rule, Tree, Stem and Scenes. Example numbers computed live; the poster's numbers only "in the authors' test"; the
     coupling computed live in explore is our stand-in for their circuit, labelled so. British spelling.
   - **Untested:** everything in a headset (the panels, picking branches and fields with the ray, the family tree
     standing about 1.5 m tall in front of you, its crown above your eyes, in the story and in explore's Stand in it)
     and the big tree's comfort there; so far only the headless tests have run it.
   - **Still open:** MM1 (is the poster final?), MM5 (credit and title) and MM6 (is our coupled stand-in a fair picture
     of their circuit, and may explore show it live?).
10. **The fifteenth story: "The shape of tissue" (built, October 2026).** From the poster "topocyte: scale-resolved
    topological phenotyping of tissue architecture across spatial modalities" (Simon Schindler, André Rendeiro, Jörg
    Menche), with the authors' GTEx liver cohort and their package topocyte, shared for this story, and their answers on
    the credit, the data, the local radius and three details (T1 to T4 in
    [docs/questions-for-authors.md](docs/questions-for-authors.md)). Sources in `tools/topo/` (`SPEC.md`, `README.md`,
    the sets' manifests). Its data is written by `tools/topo/data/gen_data.py` (Python: it runs topocyte and the poster's
    figure scripts on the authors' files, which stay out of the repository; see
    [docs/setup-and-release.md](docs/setup-and-release.md)) and checked by `node tools/topo/test-data.mjs`.
    - **What it is** (about 8 minutes, 8 chapters, then explore): the tour's body with its liver lifted out, a slice of
      it falling flat as a slide of real cells drawn in H&E; other ways of measuring tissue, sketched, then only the
      cells' positions; the single scales other tools fix; balls growing round the poster's 110 cells until pieces join
      and loops open and close, and the tower of scales, where the radius becomes height; 123 slides as a rack of glass
      slides with their curves, their main shapes and the space of their scores; a classifier's wall, its fair test (109
      of 123 right) and its weight for every radius (loops of 5 to 15 µm speak for cirrhosis); a new slide scored cell
      by cell, its scars red and raised, and its cells in two groups with their cell types. Explore: Patch, Cohort,
      Scales, Cells and Scenes. Every number is topocyte's: the app only looks them up. Slides are numbered, never named;
      no GTEx images. British spelling.
    - **Untested:** everything in a headset (the panels, picking slides and cells with the ray, the tower of scales
      standing about 1.5 m tall in front of you in chapters 3 and 4 and in explore's Stand at it) and the tower's comfort
      there; so far only the headless tests have run it.
    - **Still open:** T5 (the poster's panel e prints its cell v's score as 26.57; the figure's own data and topocyte
      give 6.97, which the story shows).

11. **The sixteenth story: "Holding on to nitrogen" (built, October 2026; in the app after the next release).** For
    the Global Peter Drucker Forum in Vienna (a lay, business audience), from Christa Schleper's soil microbiology group
    at the University of Vienna: a PhD student's project, Marina Montserrat Díez's, with partners at JIRCAS in Japan, the
    University of Thessaly and Université Lyon 1. After the slides "Exploring the Effects of Biological Nitrification
    Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" and the field trial's data behind them,
    shown with the authors' permission given through the owner (29 October 2026; anything unknown illustrative and
    labelled so). Sources in `tools/soil/` (`SPEC.md` with the owner's decisions, `README.md`, the sets' manifests). Its
    data is written by `tools/soil/data/gen_data.py` from the authors' three CSVs (kept out of the repository; see
    [docs/setup-and-release.md](docs/setup-and-release.md)), with the slides' charts read off by two readers
    (`tools/soil/data/reconcile.py`), and checked by `node tools/soil/test-data.mjs`.
    - **What it is** (8:42, 8 chapters, then explore): a cut-away block of soil with a wheat plant, where less than half
      the fertiliser reaches the crop and the microbes' relay turns the rest into nitrate and nitrous oxide; a wheat
      given a piece of chromosome from a wild grass that slows the relay (BNI); the globe and the hop to the field trial
      in Japan (24 plots, three regimes, five dates, 119 samples); the BNI wheat greener and leaking less nitrate, and
      the jars' nitrous oxide read off the slides; a crowd of about 100,000 kinds of microbe and the network of those
      that rise and fall together, which follows the fertiliser and the plots far more than the wheat. Explore: Field,
      Nitrogen (a sketch), Microbes, Network and Scenes. Its hedges: strong indications, not yet proof; rising together
      is not working together; the network is ours, built for the story. British spelling.
    - **Integrated** (29 October 2026): its card (`stories/list.js`, icon `soil.soil`), `sw.js` (`SHELL` and `AUDIO`),
      three miniatures (`soil.soil`, `soil.field`, `soil.net` in `tools/lowpoly/`), the design room's catalogue
      (`tools/design/props.json`, [docs/props.md](docs/props.md)), the smoke test (every explore tool and its links)
      and the shared-room test (`STORIES`), the docs. **For the release round:** bump `VERSION`, run
      `node tools/release.mjs`, and say sixteen in `index.html`'s head (title, description, link previews, the brand
      and the start screen's title still say fifteen) and in `shared.js`'s Arrange all comment (two rows of eight).
    - **Untested:** everything in a headset (the panels, picking plots and kinds with the ray, the pore's bubble and the
      network at their close views); so far only the headless tests have run it.
    - **Still open:** S1 to S9 in [docs/questions-for-authors.md](docs/questions-for-authors.md) (the two N2O
      measurements, the tables behind slides 6, 7 and 9, the chlorophyll's dates, DCD, the dates, the plot map, the other
      microbes, our network, and whether the story may be public before the work is published: **TO FILL (owner)** in
      [docs/data-and-permissions.md](docs/data-and-permissions.md)).
12. **Sound effects: listen, then approve or change (phase 1 built, 29 October 2026).** The shell's sounds and the
    stories' backgrounds are built and off by default (see "Where things stand"). Nobody has heard them yet: the
    recipes were judged by measurement only (levels, spectra, no clipping). To listen: the sound board
    (`tools/sfx.html`, served next to the app: every sound with a button, every story's background, a 3D demo for
    headphones, the ducking demo, the voice limit), or the rendered files (`node tools/sfx-render.mjs [url] [folder]`:
    one MP3 per sound, `sfx-all.mp3` with its index, `levels.txt`), or in the app with `#sfx=on` (in a headset:
    *Sound effects* in the menu on the left wrist, and *Try the sound effects* on its Sound check page). Levels: the
    interface sounds peak at -30 to -15 dBFS (the loudest 400 ms -54 to -30 LUFS), the backgrounds -35 LUFS, against the
    narration's -13 to -16 LUFS; the default volume is 75 % (5 dB lower). **TO FILL (owner):** which sounds to keep,
    change or drop, whether the backgrounds are wanted, and then whether sound effects go on by default. **Phase 2**
    (sounds inside the stories, tied to their timelines) starts only after that.

## How work is done

- One working branch; `main` is what visitors get. Main moves forward only after the smoke, update, relay and
  shared-room tests pass (`git push origin HEAD:main`, a fast-forward), then the branch is pushed too. No force pushes
  to main. The full checklist, rollback included, is in [docs/setup-and-release.md](docs/setup-and-release.md).
- After any change to app files, bump `VERSION` in `sw.js`, or installed copies and headsets keep the old files.
  Bump `FORMAT` in `shared.js` when a story's shared state changes shape.
- The story files are large (`stories/airports.js` is about 640 KB with its data): search them, never read them whole.
- Headset behaviour can only be confirmed on a device: say so when reporting a change.

## Adding a seventeenth story

The sixteenth story (`soil`) is the most recent example (item 11 above; its integration touched every file the steps
below name); the fifteenth (`topo`) too: `git show --stat` on its commits shows every file it touched
(the fourteenth, `mutation`, computes its numbers live; the thirteenth, `ovary`, is a data story typed in and read off
figures; the twelfth, `pass`, shows how a story reuses another's models unchanged, and a story in two languages). Start
from the closest existing story (`tools/topo/` for a story whose numbers come from the authors' own code run on their
data, `tools/mutation/` or `tools/qubits/` for a story whose numbers are computed live, `tools/micro/` or
`tools/ovary/` for a data story, `tools/flock/` for a live simulation).

1. `tools/<key>/`: `SPEC.md` (the contract), `README.md`, the sets (each with a manifest `sets/<name>.md`), the engine
   (`engine/e1_head.js` to `e7_app.js`), `build.mjs`, `harness.html`, `shot.mjs`, `sweep.mjs`, a data generator if it has
   data. Build `stories/<key>.js` and check it with `--check`. Add `tools/<key>/shots/` to `.gitignore`.
2. `stories/list.js`: an entry (key, kick, title, colour, `icon`: its main miniature in `tools/lowpoly/` for the
   stations' icons, made there first (each miniature under 1,200 triangles); loading text, length: pace the story first with
   `node tools/pace.mjs <url> --write <key>`, which prints it). The count on the start screen, in the title and on
   every headset Stories screen follows the list by itself; `index.html`'s head (title, meta description, link
   previews) and `manifest.webmanifest` say it in words for search engines and installs: update them, and the card
   rows' CSS if the rows change.
3. Nothing in the other sixteen stories: their headset Stories screens space the cards and name the count from the
   list (`xrLandingCards`, `drawLandHead`).
4. `sw.js`: bump `VERSION`, add `stories/<key>.js` to `SHELL` and `narration-<key>.mp3` to `AUDIO`; then
   `node tools/release.mjs` (version.json: running pages get the new card within a minute). `shared.js`: `FORMAT` only
   if the shared keys change (a device that does not know the new story yet shows its station as needing an update);
   the Arrange all comment (two rows of n/2).
5. Tests: the story's keys and count in `tools/smoke.mjs` plus an explore step; an entry in `STORIES` in
   `tools/collab.mjs` (its `HEADSET_STORY` stays last).
6. Docs: AGENTS.md (the story table, Layout, a section of its own, the shared-state table, URL hashes), CLAUDE.md
   (the build line), README.md and README.txt, the audio note, [docs/data-and-permissions.md](docs/data-and-permissions.md),
   [docs/questions-for-authors.md](docs/questions-for-authors.md); regenerate [docs/narration.md](docs/narration.md) with
   `node tools/narration.mjs`; relay/README.md if Arrange all needs more floor.
7. Run every test (smoke, update, live, relay, shared-room; audio after touching sound;
   `node tools/release.mjs --check`), then merge as above.

## Working with AI agents

Most of the code was written with Claude Code, following `CLAUDE.md` and `AGENTS.md`; both are plain rules a person can
follow too. Two habits are worth keeping either way: sources and generators stay in the repository (so nothing has to
be rediscovered), and every story is checked by the same tests. For agents, AGENTS.md "Working economically" says how
to keep the cost down: a new story built economically took about 3M tokens (cheaper models for reviews and checks,
one review round); building the tour with the strongest model throughout took about 16M.

## Map of the repository

See the Files table in [README.md](README.md) and "Layout" in [AGENTS.md](AGENTS.md).

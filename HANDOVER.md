# Start here: handing over Networks

An installable web app that teaches network science in fifteen narrated 3D stories, each followed by an explore mode,
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

## The fifteen stories

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
  relay's own introduction server). **Untested on devices:** links between real headsets, laptops and phones, inside
  VR and AR, a host change and a hand-over at an event, and how long PeerJS's public server holds the id of a host
  that went to sleep (up to about a minute, by its documentation).
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
   microanatomy, mutation machine (a draft poster), tissue topology (the authors' cohort data and code) and tour
   stories). Record what was agreed, and with whom, in the same
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
7. **Deferred** (after the next two stories and their reviews):
   - whether to add a voice assistant;
   - collecting alignment logs from fresh headsets (a test plan is in the runbook);
   - **station icons**: built on 29 October 2026 (the owner said go). Over each station's ring in a shared room, 2.1 m
     up, a small low-poly 3D model of its story in its colour, slowly turning (`ICONS` in `shared.js`; "Shared rooms"
     in [AGENTS.md](AGENTS.md)); gone at your own station; a story without one gets a glowing polyhedron. **For the
     owner:** approve the contact sheet of all fifteen (open `tools/icons.html` next to the app; `&turns=4` shows each
     from four sides) or say which to change. How they read from across a real room is untested on a headset;
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
   - **live updates and hot reload**: built on 29 October 2026 (the owner said go). The app picks up a release by
     itself without losing its place, and while developing it follows the files as they are saved (AGENTS.md "Hot
     reload and live updates"; [docs/setup-and-release.md](docs/setup-and-release.md), step 5b and the table in
     section 2).
     - **A release step:** `node tools/release.mjs` after bumping `VERSION` writes `version.json` (each story file's
       fingerprint and the oldest shell it needs, the shell's fingerprint and release, `FORMAT`, the list's
       fingerprint) and stamps the shell's release into `index.html`. Pages ask for it about once a minute and when
       they come back into view.
     - **Taken without asking:** a new story's card (page and headset Stories screens), a changed story not on show
       (fetched fresh next time), the story on show swapped in place at a quiet moment (paused, explore mode, a
       Stories screen, a chapter's end), keeping mode, chapter, time, explore state and view, the slideshow and the
       headset's placement.
     - **Asked first** (a bar on the page, a panel with two buttons in the headset: Reload now or Later): a new shell,
       a new `FORMAT`, a story that needs a newer shell, a shared room's station whose story the device does not know
       (its card says "Update needed"). Reload now keeps the place; a headset then shows one button, Enter VR to
       continue. On the page's Stories screen a new shell is taken by itself, as the service worker's update did
       before.
     - **While developing:** `node relay/server.mjs --lan --watch --build` (or `--static . --watch`): a saved story
       swaps in place on every page and headset showing it, a set's source is built first, a shell file reloads the
       pages with their place. This is the ground for the story design room's live reload.
     - **Groundwork done with it:** the list of stories is `stories/list.js`; the headset Stories screen in all fifteen
       stories spaces its cards from their number (neighbours 0.381 m apart, the outer ones at most 62 degrees to the
       side) and names it in words up to twenty, so a sixteenth story changes none of the fifteen.
     - **Untested on a headset:** a swap in place inside a session, the question's panel and its buttons, Enter VR to
       continue, and the watch channel in Quest Browser. Tested headlessly by `node tools/live.mjs`.
   - **subtitles in the headset**, chosen per person from the headset's menu (Subtitles: off / follow / placed).
     - **Follow:** a little below the line of sight, about 1.5 m ahead. Not stuck to the head (uncomfortable): they
       stay put until you turn more than about 25 degrees, then glide back in front of you, as the wrist clock turns to
       your eyes.
     - **Placed:** picked up with the grip and left anywhere in the room, on this headset only, remembered for next
       time.
     - Per device, never in `collab.state()`: nothing changes for the shared rooms.
     - **How:** all in the shell, no change to the fifteen stories. The words come from each story's panel (its
       `section.ch` chapters and their `data-at` lines, read as `tools/narration.mjs` reads them), split into short
       two-line captions spread over the time until the next line by word count. The pass story's follow its
       language. The panel is drawn like the shell's menu and clock, and the grip reuses the code that carries
       stations.
     - **To know:** only the airports story has a recorded voice, so in the other fourteen the subtitles repeat the
       panel's words (useful when the panel is out of view: in the flock or among the fish, at a station, the panel
       behind you). Each line starts with the voice; the captions within a long line are timed by word count, not
       matched word by word.
     - **Size:** estimated at about 2 to 3 hours of agent work and 1 to 1.5M tokens, the tests included, plus a short
       round of tuning (size, distance, follow speed) after the owner tries it on a Quest. A caption bar under the
       scene on screens and phones would add about half an hour.
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

## How work is done

- One working branch; `main` is what visitors get. Main moves forward only after the smoke, update, relay and
  shared-room tests pass (`git push origin HEAD:main`, a fast-forward), then the branch is pushed too. No force pushes
  to main. The full checklist, rollback included, is in [docs/setup-and-release.md](docs/setup-and-release.md).
- After any change to app files, bump `VERSION` in `sw.js`, or installed copies and headsets keep the old files.
  Bump `FORMAT` in `shared.js` when a story's shared state changes shape.
- The story files are large (`stories/airports.js` is about 640 KB with its data): search them, never read them whole.
- Headset behaviour can only be confirmed on a device: say so when reporting a change.

## Adding a sixteenth story

The fifteenth story (`topo`) is the most recent example: `git show --stat` on its commits shows every file it touched
(the fourteenth, `mutation`, computes its numbers live; the thirteenth, `ovary`, is a data story typed in and read off
figures; the twelfth, `pass`, shows how a story reuses another's models unchanged, and a story in two languages). Start
from the closest existing story (`tools/topo/` for a story whose numbers come from the authors' own code run on their
data, `tools/mutation/` or `tools/qubits/` for a story whose numbers are computed live, `tools/micro/` or
`tools/ovary/` for a data story, `tools/flock/` for a live simulation).

1. `tools/<key>/`: `SPEC.md` (the contract), `README.md`, the sets (each with a manifest `sets/<name>.md`), the engine
   (`engine/e1_head.js` to `e7_app.js`), `build.mjs`, `harness.html`, `shot.mjs`, `sweep.mjs`, a data generator if it has
   data. Build `stories/<key>.js` and check it with `--check`. Add `tools/<key>/shots/` to `.gitignore`.
2. `stories/list.js`: an entry (key, kick, title, colour, loading text, length: pace the story first with
   `node tools/pace.mjs <url> --write <key>`, which prints it). The count on the start screen, in the title and on
   every headset Stories screen follows the list by itself; `index.html`'s head (title, meta description, link
   previews) and `manifest.webmanifest` say it in words for search engines and installs: update them, and the card
   rows' CSS if the rows change.
3. Nothing in the other fifteen stories: their headset Stories screens space the cards and name the count from the
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

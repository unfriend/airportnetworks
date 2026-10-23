# airportnetworks

**Networks, in thirteen stories**: an installable web app that teaches network
science through thirteen short, animated stories. Each story takes a few minutes
(the tour about eight) and ends in an explore mode where the network is yours
to play with.
It runs in any modern browser, on phones, and in VR and AR headsets (built for
Meta Quest Browser).

**Taking it over? Start here:** [`HANDOVER.md`](HANDOVER.md), then
[`docs/setup-and-release.md`](docs/setup-and-release.md),
[`docs/data-and-permissions.md`](docs/data-and-permissions.md),
[`docs/questions-for-authors.md`](docs/questions-for-authors.md),
[`docs/event-runbook.md`](docs/event-runbook.md) and
[`docs/narration.md`](docs/narration.md).

| Story | What you see | Ideas |
| --- | --- | --- |
| **Airports** (network theory) | 3,214 airports and 18,858 routes on a globe | nodes and edges, degree and hubs, shortest paths, betweenness, communities, robustness when airports close |
| **Proteins** (network medicine) | 254 proteins and 375 interactions inside a cell | essential hubs, modules, disease modules, drug targets, knockouts |
| **Cell map** (spatial interactome) | 249 proteins in 13 compartments of a model human cell | where proteins meet, proteins in several places, signals crossing the cell, proteins that move, proximity labelling, proteins in the wrong place |
| **Muscle and heart** (rare muscle diseases) | 1,182 genes of 13 groups of neuromuscular disorders in a tower of 71 layers, after the ISMB 2026 talk by Iker Núñez-Carpintero and Philipp Friedrich (LBI Network Medicine), on their data | the motor unit from nerve to sarcomere, a multiplex network, a random walk with restart, disease modules, endotypes, the overlap of congenital myopathies and cardiomyopathies, a stress test on a supercomputer; explore: pick a group, search a gene, run your own walk, knock out layers, pick endotypes, stand inside the tower |
| **Endotypes** (disease endotypes) | one junction between nerve and muscle close up, the 35 genes of congenital myasthenic syndromes, their protein network of 18,306 proteins and 12 endotypes, after the ISMB 2026 EndotypY poster by Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche (LBI Network Medicine), on their run | fatigable weakness, seed genes, a random walk with restart, a disease module, functional neighbourhoods, a tree whose splits are tested, endotypes and where they act in the synapse; explore: every endotype and gene, the method step by step, stand in the gap |
| **One scan, one system** (whole-body PET) | a PET/CT scanner and how it sees, the tour's glowing PET body, its organs outlined and measured, and the networks of the organs' metabolism from 658 whole-body scans, after the paper by Barbara K Geist and colleagues (Med, 2025) and their poster "Shaping a New Era in Nuclear Medicine" (Medical University of Vienna and LBI Network Medicine) | positrons and coincidences, uptake, partial correlations, network density and disorder, hubs, health eroding into disease |
| **Tissue and time** (tissue microanatomy) | an H&E-stained section and the working units (microanatomical domains) a method finds in it, a library of 24,945 slides of 40 tissues, an atlas of their domains, the network of how organs are built, after the preprint by Iva Buljan, Zsuzsanna Bago-Horvath and André Rendeiro (bioRxiv, 2025) | tiles, features, message passing and clustering without labels; domains shared and specific; which change with age; pathology; contacts between domains that stay or change |
| **The aging ovary** (ovarian aging) | the tour's body and a drawn cut-away ovary that ages, 255 donors aged 20 to 70 (GTEx), a drawn H&E section with blood vessels, macrophages, corpora albicantia and follicles, after the poster by Parijat Chakraborty, Samir Moustafa and André Rendeiro (LBI Network Medicine, CeMM, University of Vienna) | the reserve of follicles that is never refilled, what a section shows, two methods (tiles with UNI2 features and a random forest; SegFormer's masks) and their scores, the trends with age (follicles toward none by about 60, fewer vessels, more scars), whether the methods agree, and a spatial neighbor network as the next step; explore: pick a kind of object, move the age, compare the methods. American spelling |
| **Three qubits** (quantum network compression) | example gene networks cut into eight cells on three qubits, the coarse operator on a cube, its building blocks (Pauli strings) and the toolbox a quantum computer runs well, after the method and figures of Joel Hancock; the real run's summary numbers on STRING | why pairs of genes, two walkers on a map, bisections and bit codes, the coarse operator A_c, Pauli strings, a Lie algebra and the residual it leaves, the honest result by depth, a Trotter step as a circuit; explore: four example networks, found or random cuts, 1 to 3 bits, every brick, add them up, so(6) or so(7) |
| **Pass it on** (networks for everyone; in English and German) | a school of fish all around you (in a headset, life size; in passthrough, in your room), the airports story's globe with an outbreak on its routes, and the cell map story's cell, for the Ludwig Boltzmann Institute for Network Medicine's outreach (about 12 and up) | no fish is in charge: each watches a few neighbours, and a warning races through the school faster than the shark; one neighbour each and the school falls apart; an infection travels along the flight routes, slowly, then through the hubs everywhere at once (a simple model, not a forecast); a signal passes hand to hand in a cell, and a protein in the wrong place stops it; explore: be the shark, change who watches whom, start an outbreak in any city and change how it spreads, the cell's proteins and moves |
| **Flock** (collective motion) | 200 starlings at dusk flying all around you (in a headset, life size), over a field by a lake | no leader: each bird follows its seven nearest neighbours, so the flock is a network that changes from moment to moment; a falcon sets off a wave that runs through the whole flock; explore: as many birds as you like (100 to 400), who follows whom, send a falcon; then it flies on for as long as you stay |
| **Robot gang** (swarm robotics) | a gang of 6 to 24 robot vacuums in a model living room; in a headset, in your own room (its floor, walls and furniture from the headset's room setup) | bump and turn: no map, yet the floor gets clean; then one rule, follow, on two networks of who follows whom: a star (all follow you) and a chain (a conga line). Click the floor to walk; in a headset the trigger on the floor spills crumbs |
| **The future** (LBI Network Medicine) | a 3D tour in ten scenes, after the Ludwig Boltzmann Institute for Network Medicine's welcome talk | the whole is more than its parts, networks everywhere, genes and protein shapes, a protein machine (ATP synthase) assembling and running, the interactome as a city map, rare diseases and inborn errors of immunity, network propagation for diagnosis, networks across scales, the institute's research groups, whole-body PET and organ networks, tissue as a network of cells |

## Using it

- The **Stories screen** is the landing page. Pick a story; the **Stories**
  button in the top bar brings the screen back at any time.
- **Repeat all** and **Repeat one** on the Stories screen (page and headset)
  keep it playing, for an exhibition or a kiosk: with *Repeat all* each story
  is followed by the next, and the last by the first; with *Repeat one* the
  story you pick starts again each time it ends. Press the lit button to turn
  it off. The choice is remembered on the device, and a link such as
  `index.html#airports&repeat=all` sets it.
- Each story plays by itself. Pause, scrub the timeline or jump between
  chapters, or press **Explore now** to search, trace shortest paths and try
  the story's tools (closing airports, knocking out proteins, starting
  protein moves, proximity labelling ...).
- **VR and AR**: press *Enter VR* or *Enter AR*. From the Stories screen you
  land on a Stories screen in the headset, with one panel per story; from
  inside a story you carry on where you were. The network floats in front of
  you with a side panel you point at. Controls: trigger (or pinch) to click,
  grip to move the network or the panel, thumbstick to spin and zoom, A or X to
  play and pause. Changing story inside the headset keeps you in VR or AR and
  keeps the layout where you put it; *Recenter* puts it back in front of you.
- **Anchor** (a button on the headset's Stories screen) keeps the network and
  the panels at one spot in the real room, for every story: they stay there
  when the headset is taken off and put on again (the next wearer still starts
  on the Stories screen), when it recentres, after leaving VR and after a
  reload. While anchored the grip moves nothing; *Place again* puts everything
  in front of you and anchors it there. To arrange things first, leave Anchor
  off, move them with the grip, then press Anchor. It uses the Quest Browser's
  room anchors (not in private browsing; clearing the site's data forgets the
  place); where a headset has none, the place holds until you leave VR. A link
  with `#anchor=on` (or `#anchor=off`) sets it, for a kiosk.
- **Shared rooms** (the *Shared* button in the top bar and on the Stories
  screen; in a headset the menu, opened from a clock on the left wrist, or
  beside the story panel without a left controller or hand): several
  headsets and screens join one room and see the same **stations**, each a
  story at a spot in the room, in step on every device. Anyone can play,
  pause, jump or change a control; the last action wins. A headset runs the
  station it stands at; the others show as rings on the floor with a card,
  and pointing at a card and pulling the trigger goes there too. Each station's
  narration comes from where it stands, and you see where the others point.
  People in the room calibrate once (*Calibrate*: touch two tape marks with a
  controller) unless their headsets share a space; people elsewhere and
  screens see the stations round their own spot. Screens get a room map and
  *Follow* a station. The flock's birds and the robots move separately on each
  device; their controls, falcons and crumbs are shared. `#s=XYZ` in a link
  joins room XYZ. Nothing changes for anyone not in a room. Tried on two Quest
  3 headsets in one room several times; what they did, and what is still
  unconfirmed, is in `docs/quest-shared-space-findings.md`.
- The address shows where you are, so you can share it: `#stories` on the
  Stories screen (on the page or in the headset), `#airports`, `#proteins`,
  `#spatial`, `#lbi`, `#nmd`, `#endo`, `#pet`, `#micro`, `#ovary`, `#qubits`, `#pass`, `#flock` or `#robots`
  in a story. A story link opens that story directly; a link without
  a hash lands on the Stories screen. Old links to `proteins.html` and
  `spatial.html` still work.

## Running and deploying

There is no build step. Upload the whole folder to any HTTPS web server
(GitHub Pages, Netlify, university web space ...). Installing the app and VR/AR
both need `https://`. To try it locally, serve the folder, for example
`python3 -m http.server 8123`, and open `http://127.0.0.1:8123/`.

Installing:
- **Meta Quest Browser**: open the page, then use the Install button in the
  address bar (or the *Install* button in the top bar if shown). The app then
  appears in your Library under unknown sources / apps.
- **Chrome / Edge** (desktop, Android): the *Install* button in the top bar or
  the install icon in the address bar.
- **iPhone / iPad Safari**: Share > Add to Home Screen.

Shared rooms need the relay (`relay/server.mjs`, Node 18 or newer, no
packages), which GitHub Pages cannot run. For now it runs on a machine on the
same Wi-Fi as the headsets and serves the app itself:
`node relay/server.mjs --lan` makes an HTTPS server with a certificate of its
own and prints the address to open on each headset (accept the certificate
warning once). The Wi-Fi must let devices reach each other (use your own router
or a phone hotspot, not eduroam). `relay/README.md` has the step-by-step guide
and the alternatives (`adb reverse`, later public hosting). Everything else
stays on GitHub Pages; a copy there can join a relay elsewhere with
`&relay=wss://host:port` in the room link.

After changing any file (including adding or replacing a narration file), bump
`VERSION` in `sw.js` so installed copies and headsets pick up the change. The
app always fetches its files fresh when online (the cache is only for offline
use), and an installed copy that is open while an update arrives reloads itself
the next time you are on the Stories screen.

## Narration

Optional voice-overs go in `audio/`: `narration.mp3` (airports),
`narration-proteins.mp3`, `narration-spatial.mp3`, `narration-lbi.mp3`, `narration-nmd.mp3`,
`narration-endo.mp3`, `narration-pet.mp3`, `narration-micro.mp3`, `narration-ovary.mp3`,
`narration-qubits.mp3`, `narration-pass.mp3`, `narration-flock.mp3` and `narration-robots.mp3`. Only the airports story has
a recording so far; the others run silently. A narration plays in sync
with its story, follows pausing, seeking and chapter jumps, and gets a *Sound*
button in the top bar and the headset panel. Browsers only start sound after a
tap or click; the first one anywhere in the app (Enter VR counts) turns sound on
for every story, also when you change story inside the headset. Without the file
the story runs silently on the same timing.

**No sound?** Open **Sound check** on the Stories screen (on the page, or in the
headset under the title). It shows what the sound system is doing, plays a test
beep through each of the two ways the app can play sound (Web Audio and an audio
element), and lets you choose the one you hear; *Reset* clears the saved
choices. The app also switches to the audio element by itself when Web Audio
fails. A link ending in `#soundcheck` opens it directly.

Chapter timings and how to record and re-sync a new recording are in
`audio/PUT-narration.mp3-HERE.txt`. `NARRATION_SYNC` is in
`tools/<story>/engine/e3_story.js` for the seven built stories (rebuild after
changing it) and in `stories/<story>.js` for airports, proteins and spatial.
The words to record, chapter by chapter with times, are in `docs/narration.md`
(made by `node tools/narration.mjs`). Until a story is recorded, its `NARRATION_SYNC`
sets its pace so that its panel can be read: `node tools/pace.mjs <url> --write`
writes it from the words (run it again after the text changes).

## Data

- **Airports**: the world airline network (airports and scheduled routes).
- **Proteins**: an illustrative, hand-curated subnetwork of 254 well-documented
  human proteins and 375 interactions (complexes and pathways from the
  literature), not the full interactome. Essential genes follow DepMap common
  essentials; disease genes are a small textbook set. Statistics were computed
  with NetworkX (Louvain modules, betweenness).
- **Cell map**: an illustrative, hand-curated set of 249 well-documented human
  proteins in 13 compartments of a model cell. Proteins found in several places
  get one copy per place (282 copies), joined by dotted lines; 252 documented
  interactions join copies that meet, in one compartment or across a membrane
  they share. Places follow the Human Protein Atlas and UniProt. Seven moves
  (NF-κB, apoptosis, TFEB, GLUT4, NRF2, and the disease cases ALS and cystic
  fibrosis) switch copies on and off. The lists `PROTEINS`, `LINKS`,
  `TOGETHER` and `MOVES` at the top of `stories/spatial.js` can be edited; the
  cell model and the protein positions are built when the story loads.

- **The tour** (`stories/lbi.js`), after the welcome talk of the Ludwig
  Boltzmann Institute for Network Medicine: most of it is illustrative and
  built when the story loads.
  - The interactome shows about 9,100 proteins and 22,100 interactions. 254 of
    them are the named, curated proteins of the network-medicine story, in their
    ten groups; the others are drawn to show the size and shape of the whole map.
  - The friendship globe puts lights at the real positions of the airports
    story's 3,214 airports; its ties are illustrative.
  - The ATP synthase follows the textbook structure, shown with 13 of the
    proteins that build it (two are assembly helpers that leave): an 8-subunit
    c-ring, 8 protons and 3 ATP per turn.
  - The immunity Sankey uses the totals of Guthrie et al. (Science Advances
    2023) for inborn errors of immunity that mainly cause autoimmunity or
    autoinflammation: 173 genes, 9 clinical categories, 19 interactome clusters. The flows
    between them are illustrative.
  - The disease modules, the patient for network propagation, the organ
    network, the stomach section and its embedding are illustrative too.

- **Muscle and heart** (`stories/nmd.js`), after the ISMB 2026 talk "Deep
  integrative multiplex network-based analysis of rare neuromuscular
  disorders" (Iker Núñez-Carpintero, Philipp Friedrich, Julia Guthrie, Jörg
  Menche), on the authors' data in `ikerdata/` (no patient data): the 13
  disease groups of the 2024 Gene Table of Neuromuscular Disorders with their
  known genes, the genes the random walk added and their endotypes; 15,246
  links among the 1,182 module genes in the 27 protein-interaction layers
  (IID), and, for the overlap of congenital myopathies and cardiomyopathies, the
  phenotype and co-expression layers. The other layers of the 71 show no links
  yet. Layer z-scores and the walk's visits are computed in this map on the
  protein layers (`tools/nmd/data/gen_data.mjs`); endotype names are the most
  typical GO process of their genes. The motor unit and the supercomputer are
  illustrative.

- **Endotypes** (`stories/endo.js`), after the ISMB 2026 poster "Introducing
  EndotypY: a Python package for network-based disease endotyping" (Chloé
  Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia
  Guthrie, Jörg Menche; github.com/menchelab/EndotypY), on the authors' run on
  congenital myasthenic syndromes (no patient data): the 35 genes of the Gene
  Table of Neuromuscular Disorders, their protein network (18,306 proteins,
  316,613 links) and their 12 endotypes of 393 genes. Only the numbers the story
  needs are in the repository (`tools/endo/sets/data.js`, made by
  `tools/endo/data/gen_data.py`). The steps before the endotypes (seed groups,
  the walk, each gene's neighbourhood, its GO cellular-component terms, the
  tree) are re-run with the package's default settings to show the method; the
  tree is drawn to agree with the authors' endotypes. Endotype names follow
  their strongest COMPARTMENTS term. The synapse is illustrative.

- **One scan, one system** (`stories/pet.js`), after the paper "The metabolic
  organ connectome: A novel approach to measure allostatic load during
  health-to-disease transition" (Geist et al., Med 6, 100881, 2025; CC BY 4.0)
  and the poster "Shaping a New Era in Nuclear Medicine" (Barbara K Geist,
  Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic,
  Stefan Grünert, Marcus Hacker). No patient data: the networks of all 658 scans
  are the paper's printed numbers (its Figure 2A), the others are read off its
  figures (`tools/pet/data/figures.json`), and `tools/pet/data/gen_data.mjs`
  writes `tools/pet/sets/data.js`. Illustrative stand-ins, said so in the story:
  typical organ uptakes and a synthetic cohort for explore's matrix and scatter
  views. The scanner and the body are illustrative. (The poster's one-scan
  network and its results were taken out: they did not match the poster.)

- **Tissue and time** (`stories/micro.js`), after the preprint "Systematic mapping of human tissue microanatomy
  reveals age-associated remodeling and resilience" (Iva Buljan, Zsuzsanna Bago-Horvath, André F. Rendeiro;
  bioRxiv 2025, doi 10.1101/2025.10.13.682110, CC BY-NC), its poster and talk, and Iva Buljan's network of organ
  architecture (only the numbers the story needs are in the repository, `tools/micro/sets/data.js`, made by
  `tools/micro/data/gen_data.mjs`). The slides, sections and tiles are drawn, not the GTEx images; values read off
  the talk's figures are in `tools/micro/data/figures.json`, and stand-ins are said to be so.

- **The aging ovary** (`stories/ovary.js`), after the poster "Mapping the histological landscape of human ovarian aging"
  (Parijat Chakraborty, Samir Moustafa, André Rendeiro; LBI Network Medicine, CeMM, Faculty of Computer Science of the
  University of Vienna; supported by CeMM and the ERC; data GTEx), public, used with the owner's OK. Its numbers are
  typed in (`tools/ovary/sets/data.js`, made by `tools/ovary/data/gen_data.mjs`), values read off its figures are in
  `tools/ovary/data/figures.json`; the dots of the charts and the neighbor network are illustrative, and the ovary,
  slides and sections are drawn, not GTEx images.

- **Three qubits** (`stories/qubits.js`), after the method and figures of Joel Hancock (network compression onto
  qubits and the Pauli decomposition). The networks shown are examples made up for the story and computed in the
  page (`tools/qubits/sets/qmath.js`): no STRING data, gene names or patient data. The real run's summary numbers
  (on STRING v12.5) are typed in from his brief (`tools/qubits/sets/data.js`) and shown only as "in the real
  network"; the cut stands in for the authors' beam search, and the walkers' valleys are illustrative. This story
  alone uses American spelling, as its author asked.

- **Pass it on** (`stories/pass.js`), an outreach story of the Ludwig Boltzmann Institute for Network Medicine
  (LBI-NetMed), in English and German. Its globe is the airports story's (OpenFlights.org routes, 2014 snapshot, Open
  Database License; Natural Earth coastlines) and its cell the cell map story's (Human Protein Atlas and UniProt
  places; ideas from Thul et al. 2017, Go et al. 2021, Cho et al. 2022, Qin et al. 2021, Lundberg & Borner 2019),
  taken unchanged from those stories when it is built. The fish are a live simulation after the flock's (schooling:
  Rosenthal et al. 2015, Handegard et al. 2012), and the outbreak a seeded S/E/I/R model on the real route network,
  said to be a simple model, not a forecast.

- **Flock** (`stories/flock.js`): a live simulation, not data. Each bird
  matches the heading of its seven nearest neighbours (topological interaction,
  after Ballerini et al., PNAS 2008) and keeps its distance; the flock as a
  whole wheels about in front of you and now and then swoops round you; alarm
  passes from neighbour to neighbour when a
  falcon comes (after Procaccini et al., Animal Behaviour 2011; Cavagna et al.,
  PNAS 2010 on how far a change spreads in a flock). Sky, land and birds are
  illustrative.

- **Robot gang** (`stories/robots.js`): a live simulation, not data, and no
  particular brand of robot. Early robot vacuums had no map and much of the
  time drove until they bumped into something, turned and drove on; in swarm
  robotics each robot often follows a few others, and the network of who
  follows whom shapes what the group does (Olfati-Saber, Fax and Murray,
  Proceedings of the IEEE 2007). Speeds and cleaning times are tuned to look
  right, not measured. In a headset the room comes from the headset's room
  setup (WebXR plane and mesh detection; every story asks for it, as an
  optional feature, when it enters VR or AR); without one the robots get a
  virtual room round you.

The protein data is meant for teaching, not research.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | the app: Stories screen, shared page layout, loads and swaps the stories |
| `stories/airports.js`, `stories/proteins.js`, `stories/spatial.js`, `stories/lbi.js`, `stories/nmd.js`, `stories/endo.js`, `stories/pet.js`, `stories/micro.js`, `stories/ovary.js`, `stories/qubits.js`, `stories/pass.js`, `stories/flock.js`, `stories/robots.js` | the thirteen stories, with their data, explore modes and headset panels |
| `proteins.html`, `spatial.html` | forward old links to the app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline cache and app install |
| `audio/` | optional narrations |
| `three.min.js` | three.js r128 (MIT licence, see `three.LICENSE.txt`) |
| `shared.js` | shared rooms: the client (rooms, stations, the clock, the room frame in a headset, presence, the Shared dialog and headset panel) |
| `relay/` | the shared rooms' server (`server.mjs`, no packages), its test, Dockerfile and guide (`README.md`) |
| `HANDOVER.md` | start here when taking the project over |
| `docs/` | the shared rooms' plan (`shared-space-plan.md`), the lessons it applies (`multiplayer.md`, `shared-spaces.md`) and what two Quest 3s did (`quest-shared-space-findings.md`); for the handover: data sources and permissions (`data-and-permissions.md`), open questions for the authors (`questions-for-authors.md`), setup, tests and release (`setup-and-release.md`), running a session with headsets (`event-runbook.md`) and the narration scripts (`narration.md`) |
| `tools/smoke.mjs` | headless test: loads every story and fails on page errors |
| `tools/collab.mjs` | headless test of shared rooms: a relay and several pages, and a pretend headset, in one room |
| `tools/update.mjs` | update test: an older version installed, then this one deployed (see `AGENTS.md`) |
| `tools/audio.mjs` | narration test under the headset browsers' sound rule, with faults that make the fallback take over (needs `audio/narration.mp3`) |
| `tools/narration.mjs` | writes `docs/narration.md` from the running stories (serve the folder first) |
| `tools/pace.mjs` | paces the stories without a recording: writes their `NARRATION_SYNC` from the words on their panels (`--write`; serve the folder first) |
| `tools/lbi/` | sources of the tour: its 3D sets, engine parts and build script (`node tools/lbi/build.mjs` writes `stories/lbi.js`) |
| `tools/nmd/`, `ikerdata/` | sources of the muscle story and the authors' data (`node tools/nmd/data/gen_data.mjs`, then `node tools/nmd/build.mjs` writes `stories/nmd.js`) |
| `tools/endo/` | sources of the endotype story (`node tools/endo/build.mjs` writes `stories/endo.js`; data from `tools/endo/data/gen_data.py` and the authors' files, which are not in the repository) |
| `tools/pet/` | sources of the PET story (`node tools/pet/data/gen_data.mjs`, then `node tools/pet/build.mjs` writes `stories/pet.js`) |
| `tools/micro/` | sources of the microanatomy story (`node tools/micro/build.mjs` writes `stories/micro.js`; data from `tools/micro/data/gen_data.mjs` and Iva Buljan's network file, which is not in the repository) |
| `tools/ovary/` | sources of the aging ovary story (`node tools/ovary/data/gen_data.mjs`, then `node tools/ovary/build.mjs` writes `stories/ovary.js`) |
| `tools/qubits/` | sources of the qubits story (`node tools/qubits/build.mjs` writes `stories/qubits.js`; `node tools/qubits/test-qmath.mjs` checks its maths) |
| `tools/pass/` | sources of the pass story (`node tools/pass/build.mjs` writes `stories/pass.js`, cutting its globe and cell out of `stories/airports.js` and `stories/spatial.js`; `node tools/pass/test-sets.mjs` checks its sets) |
| `tools/flock/` | sources of the flock (`node tools/flock/build.mjs` writes `stories/flock.js`) |
| `tools/robots/` | sources of the robot gang (`node tools/robots/build.mjs` writes `stories/robots.js`) |
| `AGENTS.md`, `CLAUDE.md` | notes on the architecture and conventions for AI coding agents (and people) |
| `README.txt` | the same notes in plain text |

## Developing

Plain HTML and JavaScript, no framework or dependencies. `AGENTS.md` explains
how the app shell and the stories fit together, the conventions, and the
things that are easy to forget. Before committing, serve the folder and run the
smoke test (needs Playwright and its Chromium; setting up a machine, every test
and the release routine are in `docs/setup-and-release.md`):

```sh
npx http-server -p 8123 -c-1 .
node tools/smoke.mjs http://127.0.0.1:8123/
```

The tour (`stories/lbi.js`) is generated from `tools/lbi/`; edit the sources
there and rebuild with `node tools/lbi/build.mjs` (see `tools/lbi/README.md`).
The muscle story (`stories/nmd.js`) is generated the same way from `tools/nmd/`
(see `tools/nmd/README.md`), the endotype story (`stories/endo.js`) from
`tools/endo/`, the PET story (`stories/pet.js`) from `tools/pet/`, the
microanatomy story (`stories/micro.js`) from `tools/micro/`, the aging ovary story (`stories/ovary.js`) from
`tools/ovary/`, the qubits story (`stories/qubits.js`) from
`tools/qubits/`, the pass story (`stories/pass.js`) from `tools/pass/` (with the airports' globe and the cell map's
cell taken from their stories at build time), the flock
(`stories/flock.js`) from `tools/flock/` and the robot gang
(`stories/robots.js`) from `tools/robots/`, each with `node tools/<key>/build.mjs`
(`--check` says whether the built file is out of step).
`AGENTS.md` also has advice on working economically with AI coding agents.

After changing shared rooms (`shared.js`, `relay/` or a story's shared-room
hooks), also run `node relay/test.mjs` and `node tools/collab.mjs` (it starts
its own relay).

Headset behaviour can only be checked on a device.

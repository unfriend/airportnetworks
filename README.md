# airportnetworks

**Networks, in seven stories**: an installable web app that teaches network
science through seven short, animated stories. Each story takes a few minutes
(the tour about eight) and ends in an explore mode where the network is yours
to play with.
It runs in any modern browser, on phones, and in VR and AR headsets (built for
Meta Quest Browser).

| Story | What you see | Ideas |
| --- | --- | --- |
| **Airports** (network theory) | 3,214 airports and 18,858 routes on a globe | nodes and edges, degree and hubs, shortest paths, betweenness, communities, robustness when airports close |
| **Proteins** (network medicine) | 254 proteins and 375 interactions inside a cell | essential hubs, modules, disease modules, drug targets, knockouts |
| **Cell map** (spatial interactome) | 249 proteins in 13 compartments of a model human cell | where proteins meet, proteins in several places, signals crossing the cell, proteins that move, proximity labelling, proteins in the wrong place |
| **Muscle and heart** (rare muscle diseases) | 1,182 genes of 13 groups of neuromuscular disorders in a tower of 71 layers, after the ISMB 2026 talk by Iker Núñez-Carpintero and Philipp Friedrich (LBI Network Medicine), on their data | the motor unit from nerve to sarcomere, a multiplex network, a random walk with restart, disease modules, endotypes, the overlap of congenital myopathies and cardiomyopathies, a stress test on a supercomputer; explore: pick a group, search a gene, run your own walk, knock out layers, pick endotypes, stand inside the tower |
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
  screen; in a headset a small *Shared* panel beside the story panel): several
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
  joins room XYZ. Nothing changes for anyone not in a room. Not yet tried on
  headsets.
- The address shows where you are, so you can share it: `#stories` on the
  Stories screen (on the page or in the headset), `#airports`, `#proteins`,
  `#spatial`, `#lbi`, `#nmd`, `#flock` or `#robots` in a story. A story link opens that story directly; a link without
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
`narration-flock.mp3` and `narration-robots.mp3`. A narration plays in sync
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

Chapter timings and how to re-sync a new recording
(`NARRATION_SYNC` in each story file) are in `audio/PUT-narration.mp3-HERE.txt`.

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
| `stories/airports.js`, `stories/proteins.js`, `stories/spatial.js`, `stories/lbi.js`, `stories/nmd.js`, `stories/flock.js`, `stories/robots.js` | the seven stories, with their data, explore modes and headset panels |
| `proteins.html`, `spatial.html` | forward old links to the app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline cache and app install |
| `audio/` | optional narrations |
| `three.min.js` | three.js r128 (MIT licence, see `three.LICENSE.txt`) |
| `shared.js` | shared rooms: the client (rooms, stations, the clock, the room frame in a headset, presence, the Shared dialog and headset panel) |
| `relay/` | the shared rooms' server (`server.mjs`, no packages), its test, Dockerfile and guide (`README.md`) |
| `docs/` | the shared rooms' plan (`shared-space-plan.md`) and the lessons it applies (`multiplayer.md`, `shared-spaces.md`) |
| `tools/smoke.mjs` | headless test: loads every story and fails on page errors |
| `tools/collab.mjs` | headless test of shared rooms: a relay and several pages, and a pretend headset, in one room |
| `tools/update.mjs` | update test: an older version installed, then this one deployed (see `AGENTS.md`) |
| `tools/audio.mjs` | narration test under the headset browsers' sound rule, with faults that make the fallback take over (needs `audio/narration.mp3`) |
| `tools/lbi/` | sources of the tour: its 3D sets, engine parts and build script (`node tools/lbi/build.mjs` writes `stories/lbi.js`) |
| `tools/nmd/`, `ikerdata/` | sources of the muscle story and the authors' data (`node tools/nmd/data/gen_data.mjs`, then `node tools/nmd/build.mjs` writes `stories/nmd.js`) |
| `tools/flock/` | sources of the flock (`node tools/flock/build.mjs` writes `stories/flock.js`) |
| `tools/robots/` | sources of the robot gang (`node tools/robots/build.mjs` writes `stories/robots.js`) |
| `AGENTS.md`, `CLAUDE.md` | notes on the architecture and conventions for AI coding agents (and people) |
| `README.txt` | the same notes in plain text |

## Developing

Plain HTML and JavaScript, no framework or dependencies. `AGENTS.md` explains
how the app shell and the stories fit together, the conventions, and the
things that are easy to forget. Before committing, serve the folder and run the
smoke test (needs Playwright):

```sh
npx http-server -p 8123 -c-1 .
node tools/smoke.mjs http://127.0.0.1:8123/
```

The tour (`stories/lbi.js`) is generated from `tools/lbi/`; edit the sources
there and rebuild with `node tools/lbi/build.mjs` (see `tools/lbi/README.md`).
The muscle story (`stories/nmd.js`) is generated the same way from `tools/nmd/`
(see `tools/nmd/README.md`), the flock (`stories/flock.js`) from `tools/flock/`
and the robot gang (`stories/robots.js`) from `tools/robots/`.
`AGENTS.md` also has advice on working economically with AI coding agents.

After changing shared rooms (`shared.js`, `relay/` or a story's shared-room
hooks), also run `node relay/test.mjs` and `node tools/collab.mjs` (it starts
its own relay).

Headset behaviour can only be checked on a device.

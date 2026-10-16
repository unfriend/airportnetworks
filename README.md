# airportnetworks

**Networks, in four stories**: an installable web app that teaches network
science through four short, animated stories. Each story takes a few minutes
(the tour about eight) and ends in an explore mode where the network is yours
to play with.
It runs in any modern browser, on phones, and in VR and AR headsets (built for
Meta Quest Browser).

| Story | What you see | Ideas |
| --- | --- | --- |
| **Airports** (network theory) | 3,214 airports and 18,858 routes on a globe | nodes and edges, degree and hubs, shortest paths, betweenness, communities, robustness when airports close |
| **Proteins** (network medicine) | 254 proteins and 375 interactions inside a cell | essential hubs, modules, disease modules, drug targets, knockouts |
| **Cell map** (spatial interactome) | 249 proteins in 13 compartments of a model human cell | where proteins meet, proteins in several places, signals crossing the cell, proteins that move, proximity labelling, proteins in the wrong place |
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
- The address shows where you are, so you can share it: `#stories` on the
  Stories screen (on the page or in the headset), `#airports`, `#proteins`,
  `#spatial` or `#lbi` in a story. A story link opens that story directly; a link without
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

After changing any file (including adding or replacing a narration file), bump
`VERSION` in `sw.js` so installed copies and headsets pick up the change. The
app always fetches its files fresh when online (the cache is only for offline
use), and an installed copy that is open while an update arrives reloads itself
the next time you are on the Stories screen.

## Narration

Optional voice-overs go in `audio/`: `narration.mp3` (airports),
`narration-proteins.mp3`, `narration-spatial.mp3` and `narration-lbi.mp3`. A narration plays in sync
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

The protein data is meant for teaching, not research.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | the app: Stories screen, shared page layout, loads and swaps the stories |
| `stories/airports.js`, `stories/proteins.js`, `stories/spatial.js`, `stories/lbi.js` | the four stories, with their data, explore modes and headset panels |
| `proteins.html`, `spatial.html` | forward old links to the app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline cache and app install |
| `audio/` | optional narrations |
| `three.min.js` | three.js r128 (MIT licence, see `three.LICENSE.txt`) |
| `tools/smoke.mjs` | headless test: loads every story and fails on page errors |
| `tools/update.mjs` | update test: an older version installed, then this one deployed (see `AGENTS.md`) |
| `tools/audio.mjs` | narration test under the headset browsers' sound rule, with faults that make the fallback take over (needs `audio/narration.mp3`) |
| `tools/lbi/` | sources of the tour: its 3D sets, engine parts and build script (`node tools/lbi/build.mjs` writes `stories/lbi.js`) |
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
`AGENTS.md` also has advice on working economically with AI coding agents.

Headset behaviour can only be checked on a device.

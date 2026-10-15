# airportnetworks

**Networks, in three stories**: an installable web app that teaches network
science through three short, animated stories. Each story takes about four
minutes and ends in an explore mode where the network is yours to play with.
It runs in any modern browser, on phones, and in VR and AR headsets (built for
Meta Quest Browser).

| Story | What you see | Ideas |
| --- | --- | --- |
| **Airports** (network theory) | 3,214 airports and 18,858 routes on a globe | nodes and edges, degree and hubs, shortest paths, betweenness, communities, robustness when airports close |
| **Proteins** (network medicine) | 254 proteins and 375 interactions inside a cell | essential hubs, modules, disease modules, drug targets, knockouts |
| **Cell map** (spatial interactome) | 249 proteins in 13 compartments of a model human cell | where proteins meet, proteins in several places, signals crossing the cell, proteins that move, proximity labelling, proteins in the wrong place |

## Using it

- The **Stories screen** is the landing page. Pick a story; the **Stories**
  button in the top bar brings the screen back at any time.
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
- Old links still work: `proteins.html` and `spatial.html` open the app with
  that story ready, and `index.html#airports`, `#proteins` or `#spatial` choose
  the story loaded behind the Stories screen.

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
`VERSION` in `sw.js` so installed copies and headsets pick up the change.

## Narration

Optional voice-overs go in `audio/`: `narration.mp3` (airports),
`narration-proteins.mp3` and `narration-spatial.mp3`. A narration plays in sync
with its story, follows pausing, seeking and chapter jumps, and gets a *Sound*
button in the top bar and the headset panel. Without the file the story runs
silently on the same timing. Chapter timings and how to re-sync a new recording
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

The protein data is meant for teaching, not research.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | the app: Stories screen, shared page layout, loads and swaps the stories |
| `stories/airports.js`, `stories/proteins.js`, `stories/spatial.js` | the three stories, with their data, explore modes and headset panels |
| `proteins.html`, `spatial.html` | forward old links to the app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline cache and app install |
| `audio/` | optional narrations |
| `three.min.js` | three.js r128 (MIT licence, see `three.LICENSE.txt`) |
| `tools/smoke.mjs` | headless test: loads every story and fails on page errors |
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

Headset behaviour can only be checked on a device.

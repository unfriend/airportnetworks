# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What this is

An installable web app that teaches network science in three narrated,
about four-minute stories, each followed by an explore mode. Everything works on
desktop, phones and in VR/AR headsets (built for Meta Quest Browser, WebXR).

| Story | File | Network |
| --- | --- | --- |
| Network theory | `stories/airports.js` | 3,214 airports, 18,858 routes on a globe |
| Network medicine | `stories/proteins.js` | 254 curated proteins, 375 interactions in a cell |
| Spatial interactome | `stories/spatial.js` | 249 proteins in 13 compartments of a model cell |

No build step, no framework, no package.json. Plain HTML/JS plus
`three.min.js` (three.js r128, vendored, MIT). The app is deployed by copying
the folder to any HTTPS host (GitHub Pages works); VR and installing need HTTPS.

## Layout

- `index.html` - the app shell: shared CSS and DOM (top bar, side panel,
  timeline, start screen) and the `HOST` object. It owns the single WebGL
  renderer and any running XR session, and loads stories on demand.
- `stories/<key>.js` - one story each, wrapped in
  `HOST.register('<key>', function (HOST) { ... })`. Everything a story
  defines is local to that function. Each returns
  `{ inputs, xrPose, peek, dispose }` to the shell.
- `proteins.html`, `spatial.html` - redirect stubs to `index.html#proteins`
  / `#spatial` so old links keep working. Do not put code there.
- `sw.js` - service worker (offline cache, cache-first for app files).
- `audio/` - optional narration MP3s (`narration.mp3`,
  `narration-proteins.mp3`, `narration-spatial.mp3`); missing files are fine.
- `manifest.webmanifest`, `icons/` - PWA install metadata.
- `tools/smoke.mjs` - headless smoke test (see Testing).

## How the shell and stories fit together

- `HOST.start(key)` loads `stories/<key>.js` if needed, calls the old story's
  `dispose()`, removes every listener the old story added, then runs the new
  story's factory. Stories never navigate the page, so a VR/AR session
  survives a change of story.
- Listener bookkeeping: `index.html` wraps `EventTarget.prototype` and
  `THREE.EventDispatcher.prototype.addEventListener` and records listeners
  added while a story is current. Listeners three.js adds for itself must not
  be recorded (XRSession listeners, `webglcontext*`, `dispose`, anything added
  while `HOST.quiet` is set, which is how `HOST.makeRenderer` creates the shared
  renderer). If VR controller clicks or the XR frame loop stop working after a
  story change, look here first.
- Stories must create the renderer with `HOST.makeRenderer(...)`, never
  `new THREE.WebGLRenderer`.
- In a headset session, a newly started story calls `xrAdopt()` to take over
  the running session, the controllers (`HOST.inputs`) and the previous
  placement (`HOST.xrPose`).
- The start screen (`#picker`) is the landing page. Entering VR/AR from it
  (`HOST.landingVR` / `HOST.picking`) shows the headset Stories screen
  (`XR.stories`, built by `xrLandingSetup`). Entering VR/AR from inside a
  story resumes that story.
- The address mirrors the state (`HOST.setUrl`): `#stories` while the Stories
  screen shows (page or headset), `#<key>` in a story. A `#<key>` link opens
  that story directly; no hash or `#stories` lands on the Stories screen.
- The shell talks to stories with window events `storypause` and
  `storyrestart`.

## Inside a story (all three follow the same pattern)

- Data at the top (airports and proteins: precomputed constants; spatial: the
  editable `PLACES`, `PROTEINS`, `LINKS`, `TOGETHER`, `MOVES` lists, laid out
  at load time by `LAYOUT`).
- `CH` lists chapters with story-time ranges; `buildStory()` writes the panel
  HTML (elements with `data-at` fade in at that second of the chapter) and the
  animation tracks via `ramp()`/`key()` over the names in `DEF`; `storyCam()`
  interpolates camera waypoints.
- `NARRATION_SYNC` maps recording time to story time; the narration (if
  present) drives the clock.
- Explore mode: the `X` state object, `exploreStep()`, tab renderers
  (`render*`), and the canvas/pointer handling in `bindCanvas()`.
- WebXR: the `XR` object, controllers (`xrController`, `xrPoint`), canvas-drawn
  panels (`makePanel`, `panelTick` with a signature function so textures only
  redraw on change, `vButton`, `textBlock`). The HTML panel cannot be shown in
  a headset, so every pane exists twice: HTML (`render*`) and canvas (`draw*`).
  Keep both in step when you change one.

## Conventions

- Match the surrounding style: 2-space indent, single quotes, semicolons,
  compact one-line helpers, short comments that say why. No frameworks or
  bundlers; do not add dependencies.
- Writing in the UI is plain British English, short sentences, no jargon
  without a gloss. Numbers shown in the story are computed from the data at
  load time, not hard-coded, wherever possible.
- Scientific content is illustrative but must be correct: only add
  interactions and locations that are well documented (complexes, textbook
  pathways, Human Protein Atlas / UniProt locations). Say "in this map" for
  statistics computed on the curated sets.
- External scripts: none beyond the vendored three.js. Fonts come from Google
  Fonts (cached by the service worker).

## Things that are easy to forget

- Bump `VERSION` in `sw.js` whenever any app file changes, or installed copies
  (and headsets) keep serving the old cache. If you add a file the app needs,
  also add it to `SHELL`.
- Story chapter timings are also documented in `audio/PUT-narration.mp3-HERE.txt`.
- Keep `README.txt` (user-facing notes) in sync with structural changes.
- Several handlers run inside the old story's call stack when switching;
  use `HOST.go(key)` (deferred) from inside a story, not `HOST.start`.

## Testing

There is no unit-test suite. Before committing, serve the folder and run the
smoke test, which loads every story, scrubs through it, exercises explore
mode and the headset panels, switches stories, and fails on console errors:

```sh
npx http-server -p 8123 -c-1 .          # or: python3 -m http.server 8123
node tools/smoke.mjs http://127.0.0.1:8123/
```

It needs Playwright with a Chromium build (`npm i -D playwright` once, or a
global install). A 404 for a missing narration MP3 is expected and ignored.
WebGL runs in software (SwiftShader) headlessly, so frame rates are low;
real-headset behaviour (controllers, session hand-over between stories,
placement and comfort) can only be confirmed on a device - say so when you
report results.

Useful URL hashes: `#spatial&t=95` (open at a story second, paused),
`#proteins&explore&q=TP53` (explore mode with a search),
`#spatial&explore&tab=moves&move=nfkb&now=1`. In the console,
`HOST.cur.peek('expression')` evaluates inside the current story
(e.g. `HOST.cur.peek('NET.P')`).

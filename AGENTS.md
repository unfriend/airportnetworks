# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What this is

An installable web app that teaches network science in four narrated stories
(about four minutes each, the tour about eight), each followed by an explore
mode. Everything works on desktop, phones and in VR/AR headsets (built for Meta
Quest Browser, WebXR).

| Story | File | Network |
| --- | --- | --- |
| Network theory | `stories/airports.js` | 3,214 airports, 18,858 routes on a globe |
| Network medicine | `stories/proteins.js` | 254 curated proteins, 375 interactions in a cell |
| Spatial interactome | `stories/spatial.js` | 249 proteins in 13 compartments of a model cell |
| LBI Network Medicine tour | `stories/lbi.js` | ten 3D scenes, from a protein machine and an illustrative interactome to organs and tissue |

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
- `sw.js` - service worker. Pages and app files come from the network first,
  checked with the server each time (`cache: 'no-cache'`), so the page and its
  story files are always the same version; the cache is the offline copy (and
  the answer when the network takes more than 4 s). The narration MP3s are
  served from the cache (with byte ranges). Installing fetches straight from
  the server (`cache: 'reload'`).
- `audio/` - optional narration MP3s (`narration.mp3`,
  `narration-proteins.mp3`, `narration-spatial.mp3`, `narration-lbi.mp3`);
  missing files are fine.
- `manifest.webmanifest`, `icons/` - PWA install metadata.
- `tools/smoke.mjs` - headless smoke test; `tools/audio.mjs` - narration test;
  `tools/update.mjs` - update test for the service worker (see Testing).
- `tools/lbi/` - the sources of `stories/lbi.js` (kit, sets, engine parts,
  build script, set harness, data generators); see its `README.md`.

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
- Repeat (`HOST.repeat`: `off`, `all` or `one`; buttons on the Stories screen,
  page and headset, via `HOST.toggleRepeat`): a story that reaches its end
  calls `HOST.ended()`; when that returns true the story only pauses, and after
  a moment the shell starts the next story (`all`, wrapping round) or sends
  `storyrestart` (`one`); otherwise the story opens explore mode. Remembered in
  `localStorage`; `#repeat=all` or `#repeat=one` in a link sets it.
- Placement in the headset: each story hangs its Stories screen, story panel
  and the scene's placement point (`XR.globeBase + XR.globeOff`) on one frame,
  `GL.rig`. Normally the rig is set from your head (`xrRecenter`) when a
  session starts, on Recenter, when the reference space resets, and when the
  headset was off for more than 3 s (`xrFreshStart`: a new wearer). Anchored
  mode (`HOST.anchor` in `index.html`; the Anchor button on the headset Stories
  screen, `#anchor=on` / `#anchor=off`; remembered as `xrAnchor` and `xrPlace`
  in `localStorage`) pins the rig to a WebXR anchor with a persistent handle
  (Meta Quest Browser), so the place survives all of those and reloads. Stories
  call `HOST.anchor.frame(frame, ref)` in `xrBegin` and set the rig from what
  it returns, skip `xrRecenter` while `HOST.anchor.held()`, block the grip while
  `HOST.anchor.locked()`, and take the saved arrangement from
  `HOST.anchor.saved()` in `xrRecenter`; *Place again* is `HOST.anchor.again()`
  plus a recentre. Without anchors (`frame.createAnchor` missing or refused)
  the place holds until the session ends; a saved place the headset cannot
  find (another room) is kept for the next session while things hold where
  they are. Each request carries a generation number, so one that settles
  after Place again, Anchor off or the end of the session is thrown away.
  Sessions request `anchors` as an optional feature.
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories only say
  what should play. A story asks for its file with
  `AUD = HOST.audio.narration(url, { ready, error })` and calls
  `AUD.sync(playing, t)` and `t = AUD.follow(t)` every frame and `AUD.seeked()`
  after a jump; `AUD.label()` and `AUD.on()` feed the headset panels. Stories set
  `HOST.session` when they start or adopt a headset session; the shell listens
  to its controller events (`select`, `squeeze`: Chromium counts them as taps,
  `selectstart` it does not) and its visibility. Never create or close an
  `AudioContext` in a story. How it works, and why (the narration was silent on
  the Quest twice):
  - Two engines, unlocked by the first tap or click (Enter VR is one) and kept
    for the life of the page: Web Audio (first choice: one `AudioContext`,
    `latencyHint: 'playback'`, never closed) and one `<audio>` element
    (fallback: plays the fetched bytes from a blob URL, so it needs no
    decoding, no `AudioContext`, no network and no service worker; Chromium
    refuses a media file whose byte ranges come partly from the network and
    partly from a service worker, as on a first visit). The element also plays
    while Web Audio is still decoding. Only one decoded file is kept.
  - Only taps the browser counts unlock (`navigator.userActivation.isActive`;
    Esc or a bare Shift do not).
  - While a headset session runs, Web Audio plays an inaudible hum (noise at
    3e-5), so its output never goes silent. Browsers swap a silent output for a
    dummy one, and opening the real one again inside a headset can fail; the
    narration used to work on the Quest when it started right at Enter VR, and
    stopped when it started only after a pick on the headset Stories screen.
    Outside a headset there is no hum (on a phone it could stop other apps'
    audio).
  - A watchdog (`check()`, about once a second from `sync()`) retries
    `resume()` (allowed without a new tap once the page has had one), reopens a
    stuck output (suspend and resume with a 3 s deadline, then a new context;
    decoded files are reused), and switches to the `<audio>` element when Web
    Audio reports two device errors within a minute, its clock stops, a tap or a
    new context has not started it within 3 s, or it cannot decode the file
    within 30 s. A Web Audio engine that runs after all is taken back.
    `follow()` only trusts a clock that is known to move, so a stuck engine never
    freezes a story.
  - The mute is saved under `narrationMuted2`: older versions saved a mute
    when *Play sound* was pressed in the headset. *Play sound* (and any press
    while loading) only starts the engines; it never mutes.
  - Sound check (`#soundcheck`, a button on the Stories screen; in the headset
    a panel that takes the place of the story cards, `drawSoundCheck`) shows
    `HOST.audio.report()`, plays a beep through each engine and lets the user
    pick an engine (`soundEngine` in `localStorage`). Ask a user with sound
    problems on a device for those lines.
  - Listeners the shell adds while a story runs (a new context, the headset
    session) are added with `HOST.quiet` set, so story changes do not remove
    them.

## Inside a story (all four follow the same pattern)

- Data at the top (airports and proteins: precomputed constants; spatial: the
  editable `PLACES`, `PROTEINS`, `LINKS`, `TOGETHER`, `MOVES` lists, laid out
  at load time by `LAYOUT`).
- `CH` lists chapters with story-time ranges; `buildStory()` writes the panel
  HTML (elements with `data-at` fade in at that second of the chapter) and the
  animation tracks via `ramp()`/`key()` over the names in `DEF`; `storyCam()`
  interpolates camera waypoints.
- `NARRATION_SYNC` maps recording time to story time; the narration (if
  present) drives the clock (`audioInit`, `audioSync`, `audioFollow`, thin
  wrappers around `HOST.audio`).
- Explore mode: the `X` state object, `exploreStep()`, tab renderers
  (`render*`), and the canvas/pointer handling in `bindCanvas()`.
- WebXR: the `XR` object, controllers (`xrController`, `xrPoint`), canvas-drawn
  panels (`makePanel`, `panelTick` with a signature function so textures only
  redraw on change, `vButton`, `textBlock`). The HTML panel cannot be shown in
  a headset, so every pane exists twice: HTML (`render*`) and canvas (`draw*`).
  Keep both in step when you change one.

## The tour (`stories/lbi.js`) is built from sets

`stories/lbi.js` is generated: edit the sources in `tools/lbi/` and run
`node tools/lbi/build.mjs`, never edit the built file by hand, and commit both
(`node tools/lbi/build.mjs --check` tells you if they are out of step). The
set contract (API, rules, performance budget, palette, shared facts) is
`tools/lbi/SPEC.md`; each set has a manifest `tools/lbi/sets/<name>.md`.

The fourth story turns an institute presentation into a tour through ten 3D
**sets** (one scene each: the interactome, a computer taken apart, the internet
and friendships, DNA and protein shapes, ATP synthase, a crowd and a Sankey
diagram for rare diseases, the tower of scales and the team, a PET body, a
tissue section). All sets share `GL.world`, are centred on the origin and are
faded in and out by the story; the camera flies between views.

- `makeKit(THREE)` (top of the file) is the shared kit `K`: seeded random
  numbers, vector helpers, and materials (`K.points`, `K.lines`, `K.rim`,
  `K.fade` for built-in lit materials) that fade with their set and size points
  in local units (`K.U.uPx`, kept current by `updateLight`).
- Each `SETS.<key> = function (K) { ... }` returns `{ group, params, update(S, t),
  anchors, labels, cam, controls, explore(c) }`. `params` are the set's
  animation tracks (names start with `<key>_`; `<key>_a` is its fade);
  `update` must depend only on the params and the time, so seeking works.
  `anchors` are named points for labels and camera targets; `labels` are the
  set's own labels with a rule for when they show; `cam` holds named views
  `[az, el, dist, tx, ty, tz]`; `controls`/`explore` drive explore mode.
- `buildStory()` keys the params per chapter (`ramp`, `key`, `show`) and the
  camera waypoints (`cam(t, set, view, spin)`); story labels are pinned to set
  anchors. In a headset `xrPlace` turns a view into the pose and scale of
  `GL.world`, so the view's target floats in front of you.
- Explore mode has a Scenes tab (any set, with its own controls, as HTML and
  canvas twins) and a Proteins tab (search, partners and routes on the
  interactome's named proteins).

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
- Never let the page and its story files come from different versions: a new
  `index.html` with an old story file looks fine but misbehaves (Repeat ended
  in explore mode because the old story never called `HOST.ended()`). Hosts
  such as GitHub Pages let browsers keep files for ten minutes, so the service
  worker revalidates every app file, and when an update takes over a running
  page, the page reloads at the next quiet moment (`HOST.reloadIfUpdated`: on
  the Stories screen, not in a headset). After changing `sw.js`, run
  `tools/update.mjs`.
- Story chapter timings are also documented in `audio/PUT-narration.mp3-HERE.txt`.
- After changing anything in `tools/lbi/`, rebuild `stories/lbi.js` (and bump
  `VERSION`).
- Keep `README.txt` (user-facing notes) in sync with structural changes.
- Several handlers run inside the old story's call stack when switching;
  use `HOST.go(key)` (deferred) from inside a story, not `HOST.start`.

## Testing

There is no unit-test suite. Before committing, serve the folder and run the
smoke test, which loads every story, scrubs through it, exercises explore
mode and the headset panels, switches stories, runs anchored placement in each
story with a pretend headset (an origin that jumps, anchors that stay, saved
handles), and fails on console errors:

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

After touching sound, also run `node tools/audio.mjs http://127.0.0.1:8123/`.
Headless Chromium plays sound without a tap, so the test imitates the strict
rule (an `AudioContext` starts locked and only a real tap unlocks it; an
`<audio>` element plays only once started inside a tap) and checks that the
narration plays after a click, after a story change with no tap (as in the
headset's Stories menu), through pause, jumps, the Sound button, the Stories
screen and a headset session going hidden and visible; that an old saved mute is
ignored, Play sound never mutes and the hum runs; Sound check's beeps and engine
choice; and that the `<audio>` element takes over when Web Audio cannot decode,
never starts, or its clock stops. Whether sound really comes out of a headset
can only be confirmed on the device (use Sound check there).

After changing `sw.js` or how files are loaded, run the update test with an
earlier version checked out next to this one:
`git worktree add /tmp/old <earlier commit> && node tools/update.mjs /tmp/old .`
It installs the old version, serves this one like GitHub Pages (ten-minute
browser caching, ETags) and checks that the page and its stories are both new
on the first visit after the update, on the next visit and offline.

For the tour, test a changed set on its own in the set harness first
(`tools/lbi/shot.mjs`, much cheaper than the whole story), then the story at a
few seconds (`tools/lbi/sweep.mjs`), then the smoke test.

Useful URL hashes: `#spatial&t=95` (open at a story second, paused),
`#proteins&explore&q=TP53` (explore mode with a search),
`#spatial&explore&tab=moves&move=nfkb&now=1`, `#lbi&t=140` (the tour at a
second), `#lbi&explore&scene=atp&view=network&now=1` (a scene with its controls),
`#lbi&explore&route=TP53,BRCA1`, `#airports&repeat=all` (a kiosk that plays
every story in turn), `#anchor=on` (anchored headset placement). In the console,
`HOST.cur.peek('expression')` evaluates inside the current story
(e.g. `HOST.cur.peek('NET.P')`).

## Working economically (token budget)

Building the tour cost about 16M tokens in sub-agents, plus the main
conversation: about a quarter on building, three quarters on critiques, fix
rounds and verification, all on the most expensive model. Next time:

- **Match the model to the job.** Use the strongest model only to build hard
  things and to integrate. Critiques, verification, screenshot sweeps, audits,
  data extraction and mechanical edits go to a cheaper model (for example
  Sonnet or Haiku) at lower effort.
- **One review round.** One critique and one fix per piece of work; a second
  round only for major findings. Verify findings in one batched pass per area,
  not one agent per finding, and only the high-severity ones.
- **Cap the visual checks.** Small screenshots (640x400 is plenty), contact
  sheets instead of single images, a fixed limit per agent (about 20 images),
  and numbers instead of pictures where possible (label positions, camera
  speed, build time, draw calls).
- **Give each agent only what it needs.** Its own section of a spec, not the
  whole spec; text descriptions of slides or images, not the images; line
  ranges of the big story files, never whole files.
- **Set a budget and plan the run.** Put a token target in the request (e.g.
  "+3M"); workflows can read it and stop early. A workflow runs at most
  (CPUs - 2) agents at once (2 on a 4-CPU cloud machine), so launch one small
  workflow per item instead of one big one, and keep headless-browser work to
  a few agents at a time. Hitting the usage limit mid-run kills in-flight
  agents and their work is redone, so finish or checkpoint long runs first.
- **Prefer cheap tests.** The smoke test and the set harness catch most
  problems; full screenshot sweeps of a story are for the end.
- **Keep sources small and in the repository.** Edit `tools/lbi/` sources, not
  the 700 KB built file; keep generators and manifests so nothing has to be
  rediscovered.


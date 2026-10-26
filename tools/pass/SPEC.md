# "Pass it on" (`pass`): the sets and their contract

The twelfth story, for the lab's outreach (school classes, open days; about 12 and up): how things spread through
networks, at three scales. About 5 minutes of story time before pacing, six chapters, then explore mode. English and
German. Read with `tools/lbi/SPEC.md` (the set contract) and the manifests `sets/fish.md`, `sets/globe.md`,
`sets/cell.md` (each set's params, API, anchors, labels, views and science). The owner's decisions:

- Reuse the airports story's globe and the cell map story's cell **as they are**; do not change `stories/airports.js` or
  `stories/spatial.js`. The only new model is the school of fish, from the flock's simulation.
- English and German with a switcher on the story panel (page, headset panel, explore panes); the language is per
  device (`passLang` in `localStorage`, default German when `navigator.language` starts with `de`, `#pass&lang=de` /
  `&lang=en`), never in `collab.state()`. The shell's own UI stays English. British English; plain, natural German for a
  12-year-old ("du" is fine). Pacing gives each line its reading time in the longer of the two languages.
- Card: kick "Networks for everyone", title "Pass it on" (German in the story: "Weitersagen!"), tagline "how warnings,
  viruses and signals spread", colour `#5fe0c8`. Credit the Ludwig Boltzmann Institute for Network Medicine
  (LBI-NetMed), as outreach; the airport data's source and the cell map's sources as those stories credit them (see
  README.md).

## How the globe and the cell are taken from the original stories

`build.mjs` reads `stories/airports.js` and `stories/spatial.js` and cuts out whole sections (from a line that starts
with a marker to the line that starts with the next one) and whole top-level declarations by name, unchanged, and pastes
each original's parts in its own order inside a function of its own (`PASS_AIRPORTS`, `PASS_SPATIAL`), so their names
(`GL`, `NET`, `buildScene` ...) never meet the engine's or each other's. A little glue says what the cut-out code still
needs from the parts left out (the cell's `isThere` reads the moves from `SCEN`, set by the cell set) and what each
returns.

- **Airports**: from `const NET_B64=` to `// Narration timing` (the routes, land and lakes data; `D2R`, `LIFT`) and from
  `const COMM_NAMES` to the camera section (network, graph maths, geometry, shaders, `buildScene`, `setHighlight`), and its
  search, `matches` and `findAirport`.
- **Cell map**: from `// Spatial interactome data` to the camera section (the lists, network, cell, layout, curves,
  shaders, `buildScene`, `setHighlight`, `setFocus`), and `present`, `proteinReach`, `placeStats`, `TRV`, `travelPoint`,
  `_tp`, `setActors`, `bestPath`, `reachInfo`, `partnersByPlace`, `placeName`, `placeShort`, `matches`, `findProtein`,
  `wherePlaces`.
- A marker that moved or vanished stops the build with its name. One source of truth: after any change to either
  story, rebuild `stories/pass.js` (`--check` says when it is out of date). The cut-out code goes to `tools/pass/gen/`
  too (not committed), for the harness.
- In the sets: each calls the original's `buildScene` with a stand-in `HOST.makeRenderer` (the engine owns the canvas;
  the original only asks the renderer how big a land texture the GPU takes, so the engine must set **`K.renderer`**
  before building the sets: done in the copied `engine/e2_scene.js`), and adds the original's `GL.world` to the set's
  group (its stars go into a scene of its own that is never drawn). Every shader of the original gets the set's fade
  appended to its fragment shader before it is compiled (`uSetA`; the globe becomes see-through to fade). What the
  originals' story and explore code did each frame (`applyUniforms`, `updateLight`, the travelling proteins of
  `exploreStep`, picking by ray) is redone in the sets from params, with comments saying where it came from. Light and
  point sizes are set just before the set is drawn, for each eye (a probe's `onBeforeRender`: on a screen from the
  camera; in a headset the light stays with the rig, `set.group.parent.parent`, and dots keep their size, `0.0028 *
  K.U.uPx * group scale`), so the engine needs to do nothing for them.

## What every set of this story adds to the set contract

- `setLang('en' | 'de')`: the set's labels (their `text` is a function, re-read by the engine every frame) and controls
  follow. `controls` is a **getter** that returns the controls in the set's current language, so the engine's code
  reading `s.controls` needs no change; re-render the panes after a switch. Call `setLang` on all three sets at start and
  on every switch.
- Label classes used: `''`, `amb`, `cyn`, `tl` (the cell map's teal: the shell has `.lbl.tl`; the copied engine's
  `LBL_STYLE` has it now too).
- Placement: **the fish are life size** (as the flock: 1 unit is 1 m, the viewer at the origin with eyes 1.6 m up; in a
  headset `xrPlace` puts the set's origin 1.6 m below your eyes and never moves it, but the grip on the sea does, for this
  device only outside a shared room and for everyone at a station: see `e5_xr.js` below; on a screen the camera stands where
  you float and turns to follow the school, the flock's `followView`, aiming at the anchor `school`). **The globe and the
  cell are tabletop sets** (radius 1, as the qubits and tour sets: the view's target floats in front of you). The engine
  must call `fish.see(head, hands, spot)` every frame (in the set's frame), as the flock engine does. In passthrough AR the
  engine sets `fish_water` 0 on that device (the school swims in your room at a third of life size, shrunk round your
  eyes, so it stays at eye level).
- Explore's "be the shark": `fish.steer(p)` with a point in the fish set's frame: on a screen the point on the pointer's
  ray at the school's distance from the camera; in a headset the controller ray's point at that distance, or the right
  index fingertip; `steer(null)` when the pointer leaves or the button is let go. The engine calls `fish.hold(on)` every
  frame with whether you are the shark (`sharking()`: explore mode, Be the shark on, the fish scene on show): while on, a
  shark let go stays and cruises round the school (and through it now and then) until you steer it again; off (the
  switch, another scene or tab that brings another scene, the story), it swims off.

## The sets in short

- **fish** (`sets/fish.md`): 300 fish (30-600) in deep blue water with light shafts, a seabed and drifting specks; each
  watches `fish_k` (1-12, default 7) neighbours; links (`fish_links`); a shark (`fish_hunt` for the story, `fish_shark`
  now and then, `steer`, `scatter`); the warning passes from fish to fish at about 10 m/s, twice the shark's speed, and
  each fish flashes as it reaches it. With one neighbour each the school falls apart within about 10 s; back to seven it
  comes together again (checked in `test-sets.mjs`).
- **globe** (`sets/globe.md`): the airports' globe as it is; params for its reveal, routes, hub colours and pillars;
  the outbreak (`globe_out`, `globe_day`, `globe_dim`) and its API (`setup`, `start`, `series`, `arrivalDay`, `chain`,
  `select`, `pick` ...).
- **cell** (`sets/cell.md`): the cell map's cell as it is; params for its organelles, proteins, links, colours, the
  growth signal, the NF-kB relay and the seven moves (`cell_nfkb` ... `cell_cf`); its explore tools as an API (`pick`,
  `select`, `info`, `moveDelta`, `search`, `path` ...).

## The chapters (suggested keys; times in seconds of story time from the chapter's start)

Numbers in the text come from the sets: `globe.api.n()` (3,214 airports), `globe.api.routes()` (18,858 routes),
`globe.api.summary()` and `series()` (the outbreak: from Vienna, medium spread, incubation 5 days, infectious 7: 7
cities by day 5, 47 by day 10, 676 by day 20, 1,673 by day 30), `cell.api.counts()` (249 proteins, 13 places).

1. **A school of fish** (about 40 s). `fish_a` 1, defaults (seven neighbours, no links). Camera: the fish's `default`
   (following the school), towards the end `afar`. Life size in a headset, in AR through your room. "No fish is in
   charge. So how do they stay together?"
2. **Who watches whom** (about 55 s). `fish_links` 0 -> 1 at 4-7; camera to `near` at 8-14 (on a screen); `fish_hunt`
   0 -> 1 at 20 (stepped; the shark reaches the school 4-6 s later, label "Shark"); the warning races through the school
   at about 26 (the links warm to white, the fish flash). "A school is a network that passes on a warning", faster than
   the shark.
3. **Change the links** (about 45 s). Links stay on. `fish_k` 7 -> 1 at 5 (stepped): the links become pairs and the
   school falls apart within about 10 s; `fish_k` 1 -> 7 at about 24: it comes together again over 20-40 s. Camera (on
   a screen): `near` at 7, back to `afar` at 15 while it falls apart, `near` again at 36, `afar` at the end. "The shape
   of the network decides what the group can do."
4. **From the sea to the sky** (about 65 s). The rise: on a screen the camera climbs to the fish's `above` view while
   `fish_scale` 1 -> 0.002 (the sea shrinks to a dot) or `fish_a` 1 -> 0 (in a headset: fade only, never move the
   viewer); `globe_a` 0 -> 1 at 7-11, `globe_reveal` 0 -> 1 at 8-14, camera to the globe's `world` then `start` (Vienna,
   after `globe.api.setup({ start: 'VIE' })` at build). `globe_out` and `globe_dim` 0 -> 1 at 18-20; `globe_day` 0 at 20
   -> 40 at 52 (smooth); optional `globe_pillars` 0 -> 1 -> 0 around 38-50 for "through the hubs"; camera out to
   `default`. Labels: "Day n", "Vienna: it starts here". Small print: a simple model on the real route network, not a
   forecast.
5. **Into the cell** (about 60 s). `globe_a` 1 -> 0 at 0-4, `cell_a` 0 -> 1 at 2-6; `cell_org` 0 -> 10 at 3-15 with
   `cell_names` 1 (off at 18); `cell_ex` 0 -> 1 at 16-19 (proteins meet partners in particular places); camera `nfkb` at
   20; `cell_cue` 0 -> 1 at 22-28 (the relay, hand to hand from the surface), `cell_nfkb` 0 -> 1 at 28-32 (linear: NF-kB
   travels through a pore into the nucleus); camera `cf` at 38, `cell_cf` 0 -> 1 at 42-46 (CFTR caught in the ER, never
   arrives: the signal stops; a disease). Alternative for the signal: `cell_focus` 1 and `cell_path` 0 -> 10 over 12 s
   (EGF to SRF, camera `signal`); for the wrong place: `cell_als` (camera `als`).
6. **Network medicine** (about 35 s). The cell stays, `cell_shell` 1 -> 0.35 (the network stands out), camera
   `default` turning slowly; `cell_cf` stays at 1 (CFTR's lost links). The same maths for fish, flights and proteins:
   find the links that break in a disease, and where a medicine could help. The lab's name; an invitation to explore.

## Explore mode (tabs; HTML and canvas twins)

- **Fish**: be the shark (`steer`; let go, it stays while Be the shark is on: `hold`), neighbours watched 1-12
  (`fish_k`), links on/off (`fish_links`), school size (`fish_n`, 100-600). The fish fade in life size, as in chapter 1.
- **Outbreak**: pick any airport as the start (`globe.api.pick(raycaster)`: click; in a headset the ray and trigger) then
  play: the engine advances `globe_day` (3-4 days a second) to `api.end()`; a chart of `api.series()` (cities in each
  state by day), the day counter (`Math.floor(globe_day)`), the selected airport's `arrivalDay`. Sliders through
  `api.setup`: incubation 1-21 days (`inc`), infectious 2-30 days (`inf`), spread low/medium/high, fewer flights 0-90 %
  (`kept` = 1 - cut). `globe_out` and `globe_dim` 1. Labelled "a simple model, not a forecast".
- **Cell**: the cell map's own tools as far as they come with the cell: pick a protein (`api.pick`, `select`, `info`:
  its places and partners by place), search (`api.search`), its moves (`cell_<key>` eased linearly over about 3 s; for
  NF-kB the relay first, `cell_cue` 0 -> 1 over 1.6 s, as the cell map does), what each move changes
  (`api.moveDelta`), the wrong places (cystic fibrosis, ALS).
- **Scenes**: each set's `controls` and `explore(c)`.

## Shared rooms

- Fish: as the flock's `flockSync` (the set has the same `flight`, `follow`, `hush`, `onLaunch`, `shark(f)`; effects
  `shark` with `{ p, v, aim }` and a quiet `school` twice a second). The school roosts round the station's spot
  (`see(..., spot)`), moved by the station's sea.
- The school's place at a station: `sea` in `collab.state()` (`[x, y, z]`, metres in the station rig's frame, to the
  centimetre, `[0, 0, 0]` until someone moves it; `XR.lifeSt`), always present, so it is the same on every device and
  `apply(state())` gives it back. The grip on the sea at your station moves it (`carrySea`), the shell sends it out
  with the rest of the state five times a second, and the others' schools glide there (`placeLife`). At a station
  `HOST.anchor.frame()` gives every headset the same rig (the station's spot), so the same offset is the same place in
  the room for everyone, and the school's frame (where `fishSync` works and the school roosts) with it. `apply()` takes
  only an array of three finite numbers, clamped as the grip is (`seaClamp`; a rounded value is never shortened
  again), and never publishes. A screen following the station keeps and reports it but draws the fish where it always
  does (`placeLife` moves nothing on a screen).
- Outbreak: share the start (IATA code) and the settings (`inc`, `inf`, `spread`, `kept`) in `collab.state()`; the model
  is seeded, so every device computes the same outbreak; not the day being drawn.
- Cell: the selected protein (symbol), the moves on (keys), the colour and organelles.
- Never the language, the camera, the steered or kept shark (a shark from another device does not replace one you
  steer or keep) or where you moved the sea outside a room (`XR.lifeTo`: per device, people differ in height).

## The engine

Adapted from the qubits story's engine, with the flock's life-size parts. As built:

- `e2_text.js`: the language (`LANG`, `LANGS`, `setLang` in `e7_app.js`) and every word of the story, `STR`:
  `[English, German]` by key, read through `T(key, ...values)` (`{0}` ... filled in), `num()` for numbers as each
  language writes them. The panel (`storyHTML`, made again on a switch), the timeline's chapter names (`CH[i].name` is
  a getter), the story's labels (`relabel`), the explore panes and the headset's panels all read it.
- `e2_scene.js`: the lens (`setLens`, from the `lens` track: 58 degrees among the fish, 32 for the globe and the cell),
  the fish's holder (`GL.life`, `placeLife`: in a headset it undoes `GL.world`'s pose, so the school is life size round
  you, moved by `XR.lifeOff`, eased to `XR.lifeTo` outside a room and to the station's `XR.lifeSt` at a station, put
  there at once when the station is reached), the flock's `followView` aimed at the school (`schoolAt`),
  `tellFish` (`see(head, hands, spot)` every frame; with the sea moved, the spot is where you would be had you not
  moved it, so the school keeps where you put it instead of swimming back round you).
- `e3_story.js`: the six chapters (keys as above; story time 305 s, paced to 6:53 from the longer language), `LIN`
  tracks (the outbreak's days and the cell's travelling proteins run evenly), `STORY_OUT` (the story's outbreak, from
  Vienna; explore's comes back with explore).
- `e4_explore.js`: the tabs (Fish, Outbreak, Cell, Scenes), `collabState`/`collabApply`, `fishSync`/`fishEffect`.
- `e5_xr.js`: the sea as the ray's target among the fish (`kind: 'sea'`; the trigger is the shark in explore mode,
  `steerRay`; a tracked hand's index fingertip leads it, `xrFingertip`), label sprites sized by distance. The grip on the
  sea moves the school (`xrGrab`, after the hook line, then `carrySea`): it follows the hand's move since the grip, in
  the rig's frame (up and down within 2 m, sideways within 6 m), one hand at a time (both grips: nothing more; no resize
  of a life-size school), rounded to the centimetre (`seaClamp`). Two offsets: this headset's own (`XR.lifeTo`) outside
  a shared room, never shared; and at a station in a shared room the station's (`XR.lifeSt`, `sea` in `collab.state()`,
  the same for everyone there), moved in all three directions where `HOST.anchor.locked` allows the grip (at your
  station, unless the layout is locked; reaching or leaving a station while carrying lets go). Neither is in the
  `place` hook or `xrPose().held`'s `'globe'`. While it is carried no shark steering starts (trigger or fingertip), and
  gripping it lets go of the shark that hand was leading. Recenter, a new wearer (`xrFreshStart`) and a new session put
  this headset's own back, never the station's (that would move it for everyone); walking away from the station the
  school glides back to this headset's own, and coming back it is at the station's again. In a room the story panel's
  hint among the fish is `xr.hint.fish.room` (the grip moves the school and the panel for everyone; the shell's
  `gripHint` offers resizing, which the school does not do).
- `e6_panels.js`: the headset's twins of the panes, and the language switch at the foot of the main panel (`drawLang`).

## Tested, untested, open

- Tested: `node tools/pass/test-sets.mjs` (the outbreak is the same for the same settings, its series add up, fewer
  flights slow it, its chain runs back to the start; the school holds with seven, falls apart with one and comes
  together again, stays round you, its warning outruns the shark, a steered shark follows and leaves, and kept (being
  the shark) it cruises round the school and through it, clear of your head, comes back when steered and swims off when
  you stop; the cell's API and
  German names); harness screenshots of each set (no page errors); `build.mjs --check`; the two original stories
  unchanged. Build times in the harness (software GL): fish about 150 ms (with 5 s of warm-up), globe 150-240 ms, cell
  120-210 ms; draw calls: fish 8-10, globe 5-8, cell about 60 (the original's organelles); a fish step about 2 ms (300
  fish).
- Untested (headset): life size and comfort of the school round you, the passthrough school (now at eye level), moving
  the sea with the grip (comfort, the easing), the new shark's look and swimming in a headset and a kept shark's loops
  round you, the globe's and cell's light and dot sizes in a headset (the probe's XR branch), the rise in a headset,
  frame rate with 600 fish and links. Tested with a pretend headset (a temporary script, October 2026): the grip on the
  sea moved the school by the hand's move (0.3, 0.4, -0.5 m), at a pretend station only up and down (a hand moved
  1, 0.3, -1 m lifted it 0.3 m), not on the Stories screen, not with a second hand, no shark steering while carried,
  Recenter put it back. The station's sea (a temporary script, October 2026, two pages and a pretend station): `sea` in
  `state()` (`[0,0,0]` at first), `apply(state())` exact, a moved value taken and reported, bad values (wrong length,
  NaN, Infinity, strings, objects, missing) ignored, clamped and idempotent (`[0.004,5,-8]` to `[0,2,-6]`); the grip at
  a pretend station moved x, y and z of the station's value (0.5, 0.4, -0.7 m) and not this headset's own, clamped to
  `[6,2,0]`; reaching the station put the drawn sea there at once, a new value glided in; Recenter and a new wearer left
  it alone; walking away glided back to this headset's own; two pages with the same rig and different scene views put
  the school's frame at the same room point (to 1 mm). Untested on headsets: two Quest 3s seeing the school in one
  place.
- Part 2 tested: the smoke test's pass step (both languages and the switch, every explore tool, picks with a ray,
  `apply(state())` giving the same state, the headset panels in every tab), `build.mjs --check`.
- Open: the protein names and airport city and country names stay as in the originals (English;
  scientific names and OpenFlights names; the globe says about 35 well-known cities in German, `CITY_DE`; the cell says
  every protein's role in German, `ROLE_DE`) in the German story: translate them or keep them; the explore panes' text,
  chart and credits are part 2's.

# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What this is

An installable web app that teaches network science in nine narrated stories
(about four minutes each, the tour about eight, the muscle story about seven, the endotype story about five, the PET
story about five and a half, the
flock just over one, the robot gang about one and a half), each
followed by an explore mode. Everything works on desktop, phones and in VR/AR headsets (built for Meta
Quest Browser, WebXR).

| Story | File | Network |
| --- | --- | --- |
| Network theory | `stories/airports.js` | 3,214 airports, 18,858 routes on a globe |
| Network medicine | `stories/proteins.js` | 254 curated proteins, 375 interactions in a cell |
| Spatial interactome | `stories/spatial.js` | 249 proteins in 13 compartments of a model cell |
| LBI Network Medicine tour | `stories/lbi.js` | ten 3D scenes, from a protein machine and an illustrative interactome to organs and tissue |
| Rare muscle diseases | `stories/nmd.js` | 1,182 genes of 13 neuromuscular disease groups in a tower of 71 layers (real data in `ikerdata/`), the motor unit, a supercomputer |
| Disease endotypes | `stories/endo.js` | one neuromuscular junction close up; the 35 genes of congenital myasthenic syndromes in the authors' protein network (18,306 proteins), their module of 393 genes and 12 endotypes (EndotypY), the motor unit |
| Whole-body PET | `stories/pet.js` | a PET/CT scanner and how it sees; the organs of the paper's 658 whole-body scans (Geist et al., Med 2025) and their partial correlation networks (printed and read off its figures), from health to disease; the poster's one-scan network and its index (stand-in maths), survival and immunotherapy; the tour's PET body |
| Flock | `stories/flock.js` | 200 starlings (a live simulation) flying all around you at dusk, each following its seven nearest neighbours |
| Robot gang | `stories/robots.js` | 6 to 24 robot vacuums (a live simulation) in a model living room, or in a headset your own room; who follows whom (you, or the one ahead) is the network |

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
  `{ inputs, xrPose, collab, peek, dispose }` to the shell (`collab`: its
  shared-room hooks, see "Shared rooms").
- `proteins.html`, `spatial.html` - redirect stubs to `index.html#proteins`
  / `#spatial` so old links keep working. Do not put code there.
- `sw.js` - service worker. Pages and app files come from the network first,
  checked with the server each time (`cache: 'no-cache'`), so the page and its
  story files are always the same version; the cache is the offline copy (and
  the answer when the network takes more than 4 s). The narration MP3s are
  served from the cache (with byte ranges). Installing fetches straight from
  the server (`cache: 'reload'`).
- `audio/` - optional narration MP3s (`narration.mp3` for the airports,
  `narration-<key>.mp3` for the others, such as `narration-lbi.mp3`);
  missing files are fine.
- `manifest.webmanifest`, `icons/` - PWA install metadata.
- `shared.js` - the shell's shared-room client (`HOST.collab`, `HOST.room`; it plays
  the relay's part itself for a room on this device), loaded by `index.html`
  between its two scripts (see "Shared rooms" below).
- `relay/` - the shared rooms' server (`server.mjs`, Node, no packages; it can serve
  the app too, and `--lan` makes it an HTTPS server for the headsets on one
  Wi-Fi that keeps their alignment logs in `relay/logs/`), its test (`test.mjs`)
  and Dockerfile; see its `README.md`.
- `docs/` - the shared rooms' plan (`shared-space-plan.md`, with what phase 0
  built) and the lessons from another project it applies (`multiplayer.md`:
  syncing; `shared-spaces.md`: one room frame for several headsets), and
  `quest-shared-space-findings.md`, a short page of what Quest did that those notes did not say.
- `tools/smoke.mjs` - headless smoke test; `tools/audio.mjs` - narration test;
  `tools/update.mjs` - update test for the service worker; `tools/collab.mjs` -
  shared rooms test (see Testing).
- `tools/nmd/` - the sources of `stories/nmd.js` (data generator, data block, sets,
  engine parts, build script, set harness; it uses `tools/lbi/kit.js`); see its
  `README.md`. `ikerdata/` holds the authors' analysis files it reads.
- `tools/endo/` - the sources of `stories/endo.js` (data generator, data block, sets,
  engine parts adapted from the muscle story's, build script, set harness; it uses
  `tools/lbi/kit.js` and the muscle story's motor set); see its `README.md` and `SPEC.md`.
- `tools/pet/` - the sources of `stories/pet.js` (data generator and the figures' readings, data block, organ
  icons, sets, engine parts adapted from the endotype story's, build script, set harness; it uses `tools/lbi/kit.js`
  and the tour's body set); see its `README.md` and `SPEC.md`.
- `tools/lbi/` - the sources of `stories/lbi.js` (kit, sets, engine parts,
  build script, set harness, data generators); see its `README.md`.
- `tools/flock/` - the sources of `stories/flock.js` (the flock set, engine parts
  adapted from the tour's, build script, set harness); see its `README.md`.
- `tools/robots/` - the sources of `stories/robots.js` (the robots set, engine
  parts adapted from the flock's, build script, set harness); see its
  `README.md` and `SPEC.md`.

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
  Sessions request `anchors` as an optional feature (and `plane-detection` and
  `mesh-detection`, for the robot gang's room).
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

## Shared rooms (`shared.js`, `relay/`)

Several headsets and desktop pages join a room on the relay (`#s=XYZ` in the
address while joined, the same on every headset; `&relay=wss://...` when the
relay is not the page's own origin). A room holds **stations**: `st.<id>` =
`{ story, x, z, yaw }` in room coordinates (metres, floor y = 0, yaw 0 faces -z;
the content floats 1.4 m ahead of the spot), with `st.<id>.play` (the clock:
`{ mode, t, playing, at }`, `at` in relay time), `st.<id>.x` (the story's
`collab.state()`), `st.<id>.panel` (the story panel: `{ x, y, z, yaw }` from the
spot, y over the floor) and `st.<id>.place` (the scene: `{ x, y, z }` moved from
where the story puts it, and `s` its size, a factor on the story's own; FORMAT
networks-8), and per shared space `rf.<space id>` (the room's frame in it) and
`rs.<space id>` (found split; FORMAT networks-9), and `sg` (the room's shared-space
generation, `{ n, by, at }`; FORMAT networks-10; networks-11 when the eighth story came, networks-12 the ninth). The plan is `docs/shared-space-plan.md`.

- `HOST.collab` keeps the room's keys (echo suppression by value, optimistic
  writes acknowledged by the relay, apply order stations > clock > state >
  panel), members, the relay's clock (ping/pong), presence (`p.<member>` at
  15 Hz) and effects (`e.<station>`); it reconnects with backoff and brings the
  room back after a relay restart. Log: `window.__collabLog` (and `#debug`).
- A room on this device: when no relay is known, or the relay cannot be
  reached as a room is joined (no answer within 6 s), the room works on the
  device alone (starting a room first asks whether the page's own server is a
  relay, 5 s at most: a room started before that was known stayed on the
  device until the next probe, and links to it were refused). `LocalSocket` in `shared.js` plays the relay's part in the page
  (the same messages and the same rules for keys, a station's epoch and stale
  writes; presence and effects go nowhere, no log is sent). Its keys are kept
  in `localStorage` (`collabRoom.<code>`, the last 8 rooms), and a room joined
  through a relay is kept there too as last seen, so its layout is still there
  on a day the relay is not; a relay that forgot a room (expired overnight, or
  restarted) gets it back from any page that keeps a copy. The headset's Shared
  panel shows without a relay too (*Start a room here*, the rooms kept on the
  headset). A headset alone is never asked about the others, and without marks
  or a shared space its stations stand on its floor where the session began
  (`'floor'`, for the session; calibrating keeps them in place). The room goes
  to a relay once one answers (asked every 15 s, and at once when an address
  is entered): made there from the device's copy when the relay has no such
  room or one with no stations, else joined as the relay has it (changes made
  meanwhile give way; a room there of another version is left alone, and the
  panel says so). The placement stays as it moves; a `'floor'` frame then gives
  way once the shared space gives a frame. Another tab's writes to a room on
  this device are taken (the `storage` event).
- A fresh shared space (*Fresh shared space* on the headset's Shared panel and in
  the page's Shared dialog, two presses, only where the relay serves the page):
  Quest Browser keeps one shared space per page address, and two Quest 3s each
  kept their own copy of one, session after session (2.6 to 3.4 m apart by the
  tape). The relay also serves the app under `s/<n>/` (`serve`; `/s/<n>`
  without the slash is moved there), so the room's generation goes up by one
  (key `sg`) and every page in it moves to `s/<n>/` (`spaceMove`: only when that
  address answers, keeping the query and the room in the hash; a page opened at
  an older address later moves too; a room with no `sg`, as after a relay
  restart, moves nobody, and a page at `s/<n>/` gives it its generation). `SG` is the page's own generation and
  `appRoot()` the app's address, where the relay is (`detect`). The headsets
  leave AR as their pages move; the page and then the headset say to start AR on
  one headset first and the others after "Shared space found". Every headset's
  log says its whole address (`search`, `sg` in `session`).
- Re-align (a button on the headset's Shared panel, `HOST.room.realignNow()`):
  this headset lines up again from the start without leaving the session or
  forgetting its marks. The shared space is asked for again, what was held
  since waking is dropped, its own marks are looked for again by their anchors,
  and otherwise it asks whoever wrote the room's frame to write it into the
  space again (`q.frame`, passed on like presence) and takes it (waiting up to
  3 s). The frame held so far stays until another is found ("Re-aligned", or
  "Nothing to re-align to").
- A headset runs live the station it stands at (within 1.1 m for 1 s, left
  beyond 1.5 m) or picks one by pointing at its preview (a ring and a card);
  `HOST.go` switches story (in a room `HOST.start` queues a request made while
  a story loads, and the pump retries a lost one). A desktop page follows one
  from the Shared dialog. A story the person starts themselves leaves the
  station (no longer following, not pulled back).
- Arrange all: two rows in front of you, half the stories (rounded up: five of
  nine) 1.2 m ahead and the rest in the gaps 2.6 m further on, 2.4 m apart, every
  station facing away from you (its content floats 1.4 m beyond its spot); it
  needs about 9.6 m x 4 m of floor from 1.2 m in front of you. Remove asks first ("Remove for
  everyone?", 3 s), on the page and in the headset.
- Moving a station by hand: in a headset the grip on a station's ring or card
  picks it up (the shell hears the session's own `squeezestart` and
  `squeezeend`, controller i being `session.inputSources[i]` in three.js r128,
  so the stories need nothing); it swings round your hand as you point, its
  distance from the hand grows as you raise the controller and shrinks as you
  lower it (`exp(2 x the pitch's change)`), and twisting your wrist turns it
  (`carryStation`). It goes out to the room at most every 100 ms and once more
  when let go (`MV`); it is also put down when its controller goes, its grip
  is up or the headset is taken off (no `squeezeend` may come then). Your own
  station's ring can be grabbed too (a trigger on it does nothing). Every
  headset draws rings, cards and its live station's placement where `SHOWN`
  eases them to the room's value, so a moved station glides, and the people at
  a moved station keep it: they leave it by walking away from where it is now
  (`C.zoneD`). On a page the room map does the same: a station's dot dragged
  moves it, its square (where its content floats) dragged turns it; a click
  still follows it, the map keeps its scale while dragging, and an interrupted
  drag (`pointercancel`) puts it back.
- The layout lock (key `lock`, `{ on, by, at }`, FORMAT networks-6): once the
  stations are in place anyone locks them (a button on the headset's Shared
  panel and in the page's Shared dialog) and anyone unlocks them. While on,
  the grip on a station, a scene or a panel, the map drag, Arrange all, Add,
  Move here and Remove are refused (`refused()`), a station, scene or panel
  being carried stops where it was last sent, and the cards say so.
- The headset's Shared panel rides on the left controller (`HAND`, from the
  left input source's grip or target ray each frame): above it, its lower edge
  7 cm over it, at 0.62 of its size, turned to your eyes and eased; without a
  left controller it hangs beside the story panel as before. It shows in every
  headset session, in a room or not, and its header (also while closed) holds
  Exit, which ends the session: the story panels have no Exit (the headset
  Stories screen keeps its own).
- At its station in a shared room a headset moves the scene and the panel for
  everyone: the grip on the scene moves it (`XR.globeOff`), both grips on it
  resize it (`xrResize`: the distance between the hands, a quarter to four times
  the story's own size, `XR.size`, in story and explore mode alike) and move it
  with their middle, the grip on the panel moves the panel. `placeSync` (every
  frame, from the shell's tick) sends what is held out at most every 100 ms
  (`xrPose().held`) and once more when let go, glides each to the room's value
  otherwise (`collab.panel`, `collab.place`), and puts both there at once when
  a station is reached. Both values carry the story they were written for, so
  a late one from before the station changed story is refused by the relay. `HOST.anchor.locked(kind)` is
  `HOST.room.gripLocked()` in a room: true away from the headset's station and
  while the layout is locked (then nothing moves, and the panels say so:
  `HOST.room.gripHint`, which `sigMain` includes, so the panel redraws). The
  flock and the robots are life size (`life: true` in `HOST.list`): only their
  panel moves. Outside a room both grips resize the scene too, for this device
  only (kept with an anchored place, reset by Recenter).
- At a station the story panel has no Stories button (in a room each station
  keeps its story; another story is another station), and a Stories screen
  still open when a headset reaches its station closes by itself (`xrBegin`).
  Sound check (on the Stories screen) is then reached only before a headset
  stands at a station, or from the page (`#soundcheck`).
- In VR the shell's panel asks once per room "Are you in the same room as the
  others?" (In this room / Somewhere else, kept per room code in
  `localStorage` `collabHere`); passthrough counts as in the room.
- `HOST.room` (headsets) asks for its own `local-floor` and `shared` spaces and
  runs its own frame callback. The room frame (an origin and a level x axis,
  kept in `local-floor` coordinates) comes from, first found first: (1) this
  headset's own calibration, which nothing overrides: two tape marks touched
  with a controller (`'marks'`), or last time's found again by the two anchors
  made at them (`'anchor'`; `roomFrame` in `localStorage` keeps the marks and
  the anchors' handles, never coordinates alone); (2) unless switched off
  (*Shared space: off* on the panel, for this page only: remembered, it
  left one headset unaligned in every room of an evening; on by default since
  two Quest 3s on one browser version lined up through it; the panel says
  when it is off) the
  frame published for its shared space (key `rf.<space id>`, `{ uuid, o, x, g,
  by, at, m }`, `g` `'marks'` or `'shared'`, `m` the marks for drawing) by a
  calibrated headset or the first one in the space (`'adopted'`, first on this
  headset's own floor, then held at that height in the shared space (`R.hS`),
  so a floor the headset estimates again does not move the room; followed
  when it moves more than 3 cm, 1 degree or 2 cm in height), or
  (3) the space's own origin when
  nobody published for it (`'shared'`); (4) else calibrate. A calibrated
  headset publishes its marks for its space anyway and reports how far the
  shared space puts another calibrated headset's marks from its own (`R.cmp`,
  a line on the panel). More than 10 cm or 3 degrees for 5 s, and it tells the
  room the space is split (`rs.<space id>` `{ uuid, bad, d, a, by, with, at }`,
  `splitCheck`; within 5 cm and 2 degrees it says whole again): while both
  headsets that measured it are in the room (`splitHere`), nobody takes a frame
  through that space or publishes its own origin there; a headset without
  marks keeps a frame it holds, or asks to calibrate ("Shared space not
  usable"). Only the pair that measured it writes it again (every minute while
  it still finds it so) or says whole again; older than 3 minutes, it lapses. Why: two Quest 3s on Quest Browser 152 with Physical space features
  off were in two spaces 2.6 m and 11 degrees apart under one id, neither its
  own floor, so nothing but the tape could tell. A headset whose session has
  plane or mesh detection and has found no plane or mesh 20 s in says it has
  no room scan (`scanCheck`, `R.noScan`: run Space Setup, Physical space
  features on), since the shared space and anchors rest on that scan. People
  elsewhere (VR) use their own floor.
- The room's floor is under the marks, not under each headset: key `rm`
  `{ a, d, by, at }` is mark A's height over the floor of the first headset
  that calibrated (and the marks' distance: marks within 10 cm of it are the
  same marks; taken over by a newer calibration of the same headset, other
  marks, or a calibrated headset when its writer has left). A headset
  whose floor differs puts the room's origin that far above its own floor
  (`frame.o[1]`, from the anchors' heights, so a floor that jumps does not move
  the room), and the panel says so ("Your floor is 28 cm lower than the
  room's").
- Why (the relay's logs of two Quest 3s in one room): the shared space came
  with the same id on both at once but was at first just one headset's own
  floor, jumped by 40 cm and 74 degrees when colocation found something, then
  stayed 0.9 m and 19 degrees out against the tape, and sometimes reported the
  head's pose; one headset's floor was 28 cm too low (its head at 2 m), and its
  origin later jumped 5.5 m and 0.7 m down; `local-floor` moves with a recentre
  without a reset event. Two anchors (positions only) keep the frame on the
  marks; without anchors a reset without a transform or a jump of the head
  asks to calibrate again.
- The shared space (Quest Browser's experiment, explainer
  github.com/cabanier/shared-spaces): a default space for a few seconds, then
  a reset and the real one; the first headset's origin is the space's; one
  space per page address; lost when a headset leaves VR or AR. Our reading of
  its pose (`floorFromShared`) is right: it keeps a headset's own marks in one
  place across its resets to 2 cm (the inverse is 80 cm out). In the logs the
  two Quest 3s had the same id but different spaces: the one with the older
  browser (149) had its own floor every session, the other (150) one frame
  that held to 2 cm over 71 minutes and three sessions; so the 0.9 m and 19
  degrees (later 1.2 m and 28, 2.4 m and 84) were two spaces, not an
  inaccurate one. Right after waking Quest gave the head's pose as the space's
  for up to 15 s: such a pose is not used (`sharedHead`), and nothing is
  published or compared through the space within 20 s of waking (`settled`). The panel names a space that is exactly this
  headset's own floor (`sharedOwn`: the default one, the first headset, or not
  joined) and shows the browser's version; the log has the page address.
  Every headset sends its Quest Browser version with its presence (`bv`):
  the people lists show it, and the panel warns when another headset here
  runs another version (`versionNote`; two versions never shared a space).
  The page drops `index.html` from its address on load, so every headset has
  the same address for the same page (one shared space per page address).
  Such a space is the first headset's (its origin is the space's) or, when
  someone here had already published for its id, or another headset here was
  aligned through a space of that id (`alignedHere`: presence carries `sp`, the
  space id, and `al`, `'adopted'` or `'shared'`), as the id appeared
  (`R.firstHere` false), not joined: then nothing is taken or published
  through it (`notInIt`), not even this headset's own frame from before, a
  frame held so far stays, and after 2 s the panel says so ("Not in the
  others' shared space"). Why: a Quest 3 that left AR and entered it again got
  its space back under the same id but as its own floor, while the other's
  stayed where it was; it took its own earlier frame through the new space and
  stood the room elsewhere (both Quest Browser 152). Both judgements are made
  once a session per space id (`R.firstFor`, `R.ownFor`): Re-align, the space
  asked for again after waking, or an id flicking to a default space and back
  never re-judge the first headset (its space is its own floor too, and the
  others are aligned through it by then). Presence says `al` only while a
  headset has joined. Once judged its own floor (within 2 cm and 1.5 degrees),
  a space stays so while within 15 cm and 2 degrees (such spaces drifted up to
  8 cm; a judgement flapping at 2 cm let the room through). Known limits: a
  headset judged not joined stays so for the session even when the others
  leave, and two headsets that both came back in spaces of their own are both
  not joined; restarting both browsers (one after the other) or calibrating
  both on tape is the way out, and the panel says so. A frame for the id from someone
  who has left may be last time's (the id stayed the same across sessions and
  days): every headset waits 8 s before taking it, and the first headset then
  replaces it with its own space. A frame someone here published for another
  space id means the others are elsewhere (`othersElsewhere`): this headset's
  own space then never becomes the room (not joined, calibrate).
- Standby with the shared space in use (an adopted frame, or the space's own
  origin): one headset was offset after waking in a test, and one of two after
  a night's standby. The frame the floor's resets carried over holds
  (`R.wakeHold`, only after a wake the session reported) until the
  shared space agrees with it again (10 cm and 3 degrees along the floor, not
  in the first 3 s while the resets come in; `wakeOK`): right after waking the
  space gave the head's pose, and after a night it may come back made again
  under the same id (around the headset that woke first). A space that still
  disagrees once settled (20 s) and still for 5 s: this headset's own
  publication is written into it again as
  held (not into a space that is just its own floor: nobody else is known to
  be in it); someone else's is followed only when written since this headset
  fell asleep (`p` in the frame, FORMAT networks-7; its writer writes it again
  once settled after waking, `R.refresh`) or when the floor moved with no
  transform (`R.blind`), never through a space that is just this headset's own
  floor; a headset still held once settled asks the writer once to write it
  again (`q.frame`, answered only when the writer can write it now). A headset
  still outside the others' space 15 s after waking asks for it once more. The height comes back from the space (`R.hS`; a jump of more
  than 30 cm keeps the room's height), since the floor came back 12 to 17 cm
  off after waking. A session that begins before the room's members are known
  (a socket not yet back after a night) waits up to 8 s before taking someone's
  frame. (Two rules from this round were taken out again after two Quest 3s
  could not align: a reset of the floor with no wake before it started a hold
  too, and another headset in the room since earlier counted as someone here,
  so a headset first in the shared space but later in the room never became
  the room.) Why: no logs
  of the night; two independent readings of the code found that the headset
  that woke second would follow last night's frame through a space made again
  around the other, which matches what was seen.
- Off and on again (the session hidden, then visible: sleep, the system menu)
  the origin moves under the frame (manual calibration lined two Quest 3s up,
  but switching one off and on left it "totally off"). Quest Browser says how
  with `reset` events of `local-floor` (two on waking) whose `transform`
  carries points from the old coordinates into the new ones (not the other
  way, as the spec reads: applied inverted it turned the room -126 instead of
  +126 degrees; applied this way it matched a fresh calibration on the same
  tape within 1 to 1.5 cm), and whose height is the head's change, not the
  floor's: `floorReset` uses only its turn about the vertical and its move
  along the floor. Anchors made in the session were not tracked again after a
  sleep: a woken calibrated headset keeps its frame (moved by the reset), waits
  up to 5 s for its anchors (`afterWake`), then looks for them again by their
  saved handles (they put the frame back on the marks) and shows the orange
  crosses for 30 s ("Check the marks"). Not found (after 5 and 15 minutes
  asleep two Quest 3s did not find them, and did once AR was entered again), it
  looks again every 10 s for two minutes, then every minute up to ten
  (`restore`, `retryDue`; "Marks found again"); a retry does not hold the room
  in 'restoring', and a calibration from last time not found at session start
  is looked for the same way. Waking never drops a calibration
  (asking to calibrate after every wake was worse). Not found after waking, the
  panel asks to leave AR and enter it again (`lostMarks`, `R.reenter`, log
  `marks lost`; in a test after a standby twenty tries over ten minutes failed
  and a new AR session found them at once), and so does a reset without a
  transform or a jump of the origin while the anchors are not held but their
  handles are saved: the calibration is kept and its anchors looked for again
  at once (only a calibration with no saved handles asks to calibrate again).
  Found after all, the request goes.
- The browser's store of saved anchors can be full ("Maximum number of
  anchors reached!": one Quest 3 refused every handle with 9 listed for the
  site, another saved with 11, so the limit is not simply per site). At
  session start `HOST.anchor` deletes saved anchors nobody here knows
  (`session.persistentAnchors` minus the placement's and `HOST.room.handles()`)
  and the room logs what that did (`anchors tidied`); a handle refused as full
  is asked once more after deleting again (`handlesAgain`,
  `HOST.anchor.handle(a)`); if it is still refused the marks hold for this
  session only and the panel says a restart will ask to calibrate. Meta's
  docs: 8 persistent anchors per site, deleted with the site's browsing
  history; the browser's author: a limited set across all sites. Clearing the
  browser's data is the remedy (not confirmed on our headsets).
- Calibrating: a mark is where the controller's ray origin was held still 70 to
  260 ms before the trigger (a bright ring shows that point), at least 50 cm
  apart; a second pull within 0.6 s is ignored, and marks more than 5 cm
  apart in height get a note. Orange
  crosses show the marks where this headset puts them (while the Shared panel
  is open, and 30 s after aligning). The panel's room section also shows the
  shared space's id and *Forget calibration* (`HOST.room.forget()`, press
  twice). Anchor requests carry the marks' generation (`R.mgen`), so ones that
  settle after Forget or new marks are thrown away; a handle the browser
  refuses is logged with its reason. Every 10 s a headset in a room sends its
  log (alignment samples every 5 s) to the relay (`POST /api/log`, kept in
  `relay/logs/` with `--lan` or `--logs`). While aligned and at its station,
  `HOST.anchor.frame()` returns the station's rig pose (spot at 1.6 m over the
  room's floor, facing its way, `room: true`), `held()` is true and
  `locked(kind)` is true (in a room it is anyway); `HOST.audio.zone()` pans the
  narration from the station (full volume within 1.5 m, so at the station's
  spot; nothing changes outside a room).
- The explore view at a station (`st.<id>.view`): headsets at the station share
  it (`viewSync` in the pump: a view from the room glides in, one turned here
  goes out, by value like the rest), so the scene stands turned and sized alike
  for everyone there; screens following the station keep their own camera.
- The relay (`relay/server.mjs`) keeps per room a map key -> `{ v, seq, by }`
  (every stored write takes the next seq; the last writer wins), the members,
  and passes on ephemeral `fx` messages (presence, effects) without storing
  them. `null` deletes only `st.*` and `pose.*` keys; giving a station another
  story drops its `st.<id>.*` keys in the same seq. For now it runs on a machine
  on the same Wi-Fi as the headsets and serves the app itself
  (`node relay/server.mjs --lan`, see `relay/README.md`); GitHub Pages serves
  everything else, and a copy there can join a relay elsewhere with `&relay=`.
- The shell wraps the story's `APP.seek`, `togglePlay`, `enterExplore` and
  `enterStory` to publish the clock, polls `collab.state()` five times a second
  and publishes it when its value changed; a value from the room goes through
  `collab.apply()`, merged per top-level field with controls changed here
  that the room has not yet acknowledged (so two people changing different
  controls at once both keep theirs). A story never publishes anything itself
  except effects.
  A page following a station (Follow) leaves its Stories screen: while that
  shows, nothing syncs.

The hooks every story keeps (all nine, the same lines; the flock is the
reference, `tools/flock/engine/`):

- `collab: { APP, scene: () => GL.scene, state, apply, view, setView, effect, hover, panel, place }`
  in its returned object: `APP` is its own clock object, `effect(type, data)`
  plays a one-shot effect another person caused (without sending it again),
  `hover(i)` is how far controller i's ray reaches now (or 0), `panel(p, yaw)`
  puts the story panel where another person moved it, `place(o, s)` the scene
  (`XR.globeOff` and `XR.size`); `xrPose()` also returns `s` (the size) and
  `held` (what grips hold: `'globe'`, `'panel'`, joined by spaces). `view()` is the scene's
  view in explore mode (`orbit.cur`, rounded; the longitude or azimuth
  normalised), which in a headset turns and sizes the scene in the room, or
  null (story mode, or while it flies somewhere); `setView(v)` glides there in
  0.25 s (`orbit.fast`). The flock and the robots are life size in a headset:
  their `view()` is always null. While a headset stands at its station the
  explore sway rests (`HOST.room.placing()`).
- `xrPoint`: after raycasting its own panels (`hs`),
  `const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);`;
  a hit (`kind: 'shell'`: the shell's panel, the other stations' cards and
  rings, calibration marks) is nearer than the story's panels and is the hover
  instead of them and of the scene. `xrPress`:
  `if (h.kind === 'shell') { HOST.collab.press(c.i); return; }`.
- `xrGrab`: `if (XR.stories || HOST.anchor.locked(h.kind)) return;` (in a
  shared room only at its station and unless the layout is locked; the shell's
  own things never move the scene, and the grip on a station's preview moves
  that station, done by the shell); `carry` lets go when that turns locked, and
  a controller that disappears lets go too.
- `xrBegin`: `if (XR.stories && HOST.collab.mine() && HOST.room.placing()) xrLandingClose();`
  after setting the rig from `HOST.anchor.frame()` (at a station the story is
  the station's); the scene's offset and size there come from the room
  (`placeSync`), not from before.
- The panel footer: `if (!(HOST.room && HOST.room.placing())) hb('stories', ...)`;
  `xrResize` and the two-hand branch at the top of `carry`; `XR.size` in
  `xrPlace` (scene stories), `xrRecenter` and `xrAdopt`.
- `'shared'` in the session's optional features.
- `xrFreshStart`: `if (HOST.collab.mine()) { lastNow = 0; return; }`: a
  headset taken off at a station keeps its story and place (no Stories screen
  for a new wearer); the room's clock and state go on applying.
- `xrLandingClose`: `if (!XR.inStory && !HOST.collab.mine()) APP.enterStory(0);`:
  Start on the headset Stories screen at a station never restarts the story
  for everyone.
- `HOST.collab.effect(type, data)` where the story itself causes a one-shot
  effect.

What each story shares:

| Story | `state()` | Effects |
| --- | --- | --- |
| airports, proteins | tab, colour, pillars, routes (to 0.05), hubs by, community level, closure mode and count, closed items, selection, path (items by airport code or gene symbol) | none |
| spatial | tab, colour, cell, routes, selection and its copy, path, community level, moves (a 0/1 string), bait and its labelling radius | none |
| lbi | tab, scene, every control of that scene, selected protein, route | none |
| nmd | tab, scene, every scene's controls, group, gene, picked endotypes, layers knocked out, your genes, the walk (its start and result, the same on every device), walkers, colour, grid, z-scores | none |
| endo | tab, scene, every scene's controls (synapse, network, tree, motor unit), endotype, gene, k (the seed-group step), method step (standing in the gap stays per device) | none |
| pet | tab, scene, every scene's controls (scanner, body, organs, people, liver), the comparison (a Table 2 row), network, organ, profile, custom uptakes, threshold, group (life size stays per device) | none |
| flock | birds, links, falcon | `falcon` (where it starts, its velocity and aim, in the set's frame), `flock` (quiet, twice a second: where the flock is, see the flock's notes) |
| robots | rule, robots, trails, links | `crumbs` (a pile: in room coordinates in a headset with an aligned frame, else in the station's frame), `dust` |

Rules that matter most (from `docs/multiplayer.md`):

- Share outcomes, not events: `state()` is plain JSON of what another person
  must see alike (tab, controls, selection, search, route), and `apply()` sets
  it with the story's own setters so both panels (HTML and canvas) follow.
  Never share the camera, hover, open menus, text being typed, timers, page
  layout, or anything random or per device.
- `state()` must be the same on every device for the same view, and
  `apply(state())` must give the same `state()` back: echoes are suppressed by
  value, so a value that changes when applied goes back and forth for ever.
  `apply()` checks every field, ignores unknown ones and never publishes.
- One-shot effects are ephemeral (`e.<station>`), never stored; their data
  must mean the same on every device (the set's frame, room coordinates).
- Bump `FORMAT` in `shared.js` when the keys or a story's `state()` change
  shape (a room refuses another format).
- `dispose()` clears the story's timers: rooms make quick story changes
  likely, and a late timer that wrote into shared element ids once crashed
  the next story.
- The live simulations run on each device. The robots are not synced (only
  their controls and effects); the flock follows one device at the station
  (see the flock's notes). `HOST.collab.effect(type, data, true)` sends a
  quiet effect: one sent often, kept out of the log on both sides.

Testing: `node relay/test.mjs` and `node tools/collab.mjs` (see Testing). A new
story gets the hooks, then an entry in `STORIES` in `tools/collab.mjs`.
Tried on two Quest 3 headsets in one room several times: in phase 0 neither the
shared space nor the calibration lined them up; the relay's logs of the second
test led to the rules above (own marks win, the floor from the marks); with
both on one Quest Browser version the shared space lined them up, but one was
offset after standby, and one of two after a night's standby (the rules for
waking above); later the two headsets each kept their own copy of the shared
space, and even at a fresh address (`s/<n>/`) the second joined the first's id
8 to 13 m off, while the tape calibrations, found again from their anchors
after a night, lined them up. Not confirmed on headsets yet: whether they line up again after
standby (and a night) now, whether asking for the shared space again (Re-align,
or 15 s after waking) joins the others' space,
moving and resizing scenes with the grips (comfort, how it looks for the others),
persistent anchors restored (one headset's handles were refused; the log now
says why), whether a recentre fires a reset, sound zones heard, comfort and
frame rate with presence drawn, and whether the socket keeps running inside an
immersive session.

## Inside a story (all nine follow the same pattern)

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

## The muscle story (`stories/nmd.js`) is built the same way

`stories/nmd.js` is generated like the tour: edit `tools/nmd/` and run
`node tools/nmd/build.mjs` (`--check` as for the tour). It uses the tour's kit
(`tools/lbi/kit.js`) and set contract (`tools/lbi/SPEC.md`); `tools/nmd/SPEC.md`
describes its three sets: `tower` (the multiplex network: 71 layers, the hero
of the story and of explore mode), `motor` (the motor unit, sarcomere and heart)
and `hpc` (the supercomputer and the stress test).

- The data is real: `tools/nmd/data/gen_data.mjs` reads the authors' files in
  `ikerdata/` and writes `tools/nmd/sets/data.js` (the constant `NMD_DATA`,
  documented in its header), never edited by hand. It also computes the layer
  z-scores (degree-matched random sets) and the walk's visits on the protein
  layers, and names endotypes after their most typical GO process; these are
  stand-ins until the authors send their own. Layers without links yet
  (`data: ''`) fill in when their links arrive in the data, without code
  changes. No patient or variant data, and nothing about zebrafish, may appear.
- Everything the story says in numbers comes from `NMD_DATA` (`FACTS` in
  `engine/e3_story.js`).
- Explore mode (`engine/e4_explore.js`, canvas twins in `engine/e6_panels.js`):
  tabs Diseases (pick a group: its module, endotypes, layer scores, grid by
  endotype), Genes (search, partners per layer, terms), Walk (a live random walk
  from a group's seeds or your own genes, on the layers that are on), Layers
  (knock layers out), Endotypes (pick several, across groups: links between
  them per layer) and Scenes. The panels talk to the tower through its API
  (`setState`, `walk`, `pick`, anchors `gene`, `endo`, `group`).
- *Stand inside* (view controls, or the Scenes tab in the headset) opens the
  tower around you: on screen from its middle, in a headset life size around
  where you stand (`XR.room`, `xrPlace`).
- The heart (in `motor`) is one smooth surface: a signed distance field (round
  cones and ellipsoids blended softly) polygonised by surface nets. That is too
  slow for load time, so it runs as a job in slices between frames: a set may
  return `idle(dt)` (the engine calls it while the set is hidden) and
  `finish()` (build now: the harness and `sweep.mjs` call it before
  screenshots). The heart fades in once built.
- A set may also export `keepOut(p)` (the camera's position in its own frame,
  returned moved if need be) and `still(p)` (explore's sway rests there): the
  engine's `keepCamera` applies them every frame outside a headset. The
  supercomputer uses them to keep the camera out of its racks; the story's
  aisle shot stays on the aisle's centre line by design.

## The endotype story (`stories/endo.js`) is built the same way

`stories/endo.js` is generated from `tools/endo/` (`node tools/endo/build.mjs`, `--check` as for the tour):
the tour's kit, three sets (`syn`, the neuromuscular junction close up; `net`, the protein network, seeds and
walkers; `tree`, the gene x term matrix, the tree and the endotypes; each with a manifest), the muscle story's
`motor` set (the build gives it the muscle story's disease groups, all it reads of `NMD_DATA`) and engine parts
adapted from the muscle story's. `tools/endo/SPEC.md` is the contract.

- The data: `tools/endo/data/gen_data.py` (Python with EndotypY installed) reads the authors' saved run (their
  protein network, the 35 seed genes, their 12 endotypes) and the Gene Table's CMS genes, and writes
  `tools/endo/sets/data.js` (`ENDO_DATA`, documented in its header). The authors' files stay out of the
  repository: only these numbers are kept. The endotypes are the authors'; the steps before them (seed groups,
  the walk, neighbourhoods, the annotation, the tree) are re-run with the package's defaults on the same network
  to show the method, and the tree is drawn to agree with their endotypes. The story says so (explore's Method
  tab, the last chapter's small print). Its random walk is the package's, solved by iteration instead of a dense
  inverse (the same numbers on a test graph). A pickle can run code: the generator unpickles only the expected
  classes.
- Explore: Endotypes, Genes (the 393 module genes only), Method (the five steps) and Scenes tabs; *Stand in the
  gap* puts you in the synaptic cleft (in a headset life size around you, the cleft at chest height).
- The `net` and `tree` sets export `api()` (picking, gene names, focus); `net`'s walkers keep state between
  frames but follow paths planned from `t`, so seeking works.

## The PET story (`stories/pet.js`) is built the same way

`stories/pet.js` is generated from `tools/pet/` (`node tools/pet/build.mjs`, `--check` as for the tour): the tour's
kit and body set (unchanged), organ icons (`sets/icons.js`, `PET_ICONS`), four sets (`scan`, the PET/CT scanner, how
PET sees and the vision row; `organs`, segmentation, uptake, the cohort, the explainer and the paper's networks, drawn
in the body set's frame; `people`, the poster's one-scan network and the population; `liver`, an organ as a network
of patches; each with a manifest) and engine parts adapted from the endotype story's. `tools/pet/SPEC.md` is the
contract.

- The data: `tools/pet/data/gen_data.mjs` (Node) writes `tools/pet/sets/data.js` (`PET_DATA`, documented in its
  header) from the paper's tables (typed in), the two weight matrices printed in its Figure 2A, and
  `tools/pet/data/figures.json`: values read off its Figures 3 and 4 and the poster's plots (each read twice
  independently and reconciled). The poster's per-patient points are kept only as group summaries. Stand-ins, said
  so in the story: typical organ uptakes, a synthetic cohort with Figure 2A's partial correlations (for the
  explainer), the one-scan formulas (the poster names Clearance, Heterogeneity and the index; their formulas are not
  published) and the population dots. The authors' VR viewer (with a patient's scan) is not used: no patient data.
- `body` and `organs` share one frame and are shown together.

## The flock (`stories/flock.js`) is built the same way

`stories/flock.js` is generated from `tools/flock/` (`node tools/flock/build.mjs`,
`--check` as for the tour): the tour's kit, one set (`sets/flock.js`, manifest
`sets/flock.md`) and engine parts adapted from the tour's (no Proteins tab, no
scene list).

- The set is a live simulation, so unlike other sets its `update` is not a pure
  function of the params and the time: 200 birds (100 to 400) in steps of a
  thirtieth of a second (the birds glide on between steps in the shader); each
  follows its seven nearest neighbours (the neighbour search is a sorted grid),
  keeps its distance, and flees a falcon, with alarm passing from neighbour to
  neighbour; the flock as a whole follows a whim (a heading turning now left,
  now right) and a weak pull to a roost in front of you, and every 88 s swoops
  round you. A story key `flock_hunt` sends a falcon each time it passes a whole
  number. Tune the flight by numbers (bearing rate, distance, reversals), not
  by eye: the flock and the screen camera are easy to make dizzying.
- Life size: 1 unit is 1 m, the viewer stands at the origin, the ground is
  y = 0, the sunset is towards -z. In a headset `xrPlace` puts the land under
  your feet (a standing eye height, 1.6 m, below the rig: the reference space
  is `local`, so the floor is unknown) and never moves it; the grip moves only
  the panel. In passthrough AR the sky and the land are hidden (`flock_sky` 0)
  and the flock flies in your room at a third of life size.
- The engine tells the set where you are every frame (`see(head, hands)`, in
  its frame: the head and controllers in a headset; on a screen a fixed spot,
  1.6 m above the middle of the field, so the flock never follows the camera),
  and `scatter(dir)` sends a falcon where you point (a click on the sky, or the
  trigger pointed at the sky).
- In a shared room the flock belongs to the station (`flockSync` in
  `engine/e4_explore.js`): the set's origin is the station's spot on every
  device, and it roosts and swoops round that spot instead of round each viewer
  (`see(head, hands, spot)`). Every device there sends where its flock is twice
  a second (a quiet effect `flock`: its flight time, middle and velocity, and
  since when it is there); the one there longest leads (heard in the last 2 s;
  a page back from a pause or a hidden tab counts as new; ties by member id), so
  a newcomer never pulls the others' flock to its own: the others take its
  flight time (so the roost and the whim match), and every bird gets the same
  pull towards the leader's middle (a damped spring; more than 12 m off, as on
  joining, the flock moves there at once: the set's `follow`). Only the leader
  sends falcons of its own (the story's and *Now and then*; a page new at the
  station listens 1.5 s first, the set's `hush`); every falcon,
  also one someone points at the sky, goes out as it starts (`onLaunch`, the
  effect `falcon`), so all see the same one. The birds still differ in detail;
  the flock is roughly in the same place.
- On a screen the camera stands where you do and turns to follow the flock
  (`followView`: a dead zone, eased turns of up to 50 degrees a second; from
  afar it aims at the flock instead and comes round to the view's side at up
  to 60); dragging takes the camera over (View: Look around). Wings and reeds
  move on real time, so they keep moving while the story is paused.

## The robot gang (`stories/robots.js`) is built the same way

`stories/robots.js` is generated from `tools/robots/` (`node tools/robots/build.mjs`,
`--check` as for the tour): the tour's kit, one set (`sets/robots.js`, manifest
`sets/robots.md`) and engine parts adapted from the flock's. `tools/robots/SPEC.md`
is the contract between them.

- A live simulation, like the flock: `update(S, t, dt)` advances it (steps of at
  most 1/60 s), and seeking the story changes only the params (the rule, the
  count), not the robots' past. Robots are discs (radius 0.17 m) that drive
  like real ones (turn on the spot, smooth speed); the rule (`robots_rule`:
  dock, bump and turn, follow you, conga line, keep away) only changes their
  targets, so a switch is smooth. They never leave the floor polygon, never
  overlap, and bump off walls, furniture, each other and your feet. The
  counters `robots_dust` and `robots_crumbs` act each time they pass a whole
  number. Tests and `sweep.mjs` run it fast with `simStory(t0, t1)` and
  `simExplore(sec)`.
- The set works on a room description in its own frame (floor at y = 0,
  1 unit = 1 m): `{ kind: 'model' | 'real' | 'box', floor, walls, blocks }`,
  given with `setRoom()` (it rebuilds the colliders, the floor texture and the
  drawn room, but skips a room that has not changed to the centimetre, and a
  refined room of the same kind keeps its cleaned floor; a floor under 1 m² or
  too thin for a robot gives way to a box room). On a screen it is the model living room
  and you are an avatar: a click on the floor walks it there (`floorPoint`,
  then `walkTo`), a drag turns the view.
- In a headset the room is yours. Every story asks for `plane-detection` and
  `mesh-detection` as optional features when it starts a session (a session
  survives story changes), and `xrRoom` (`engine/e5_xr.js`) reads
  `frame.detectedPlanes` and `frame.detectedMeshes` (only when
  `session.enabledFeatures` lists them, inside try/catch) when they change,
  once a second besides (poses can move on their own, and a first read may
  come before tracking has them), at most twice a second, and at once after a
  reference-space reset; a reset's transform carries the robots, piles and
  cleaned floor to the new coordinates (`shift`; without one they start again
  from the dock). The
  floor is the plane labelled floor; walls are planes labelled wall (or tall
  unlabelled ones); furniture is seats, cupboards, beds and detected volumes
  (tables and desks are left out, and volumes raised more than 12 cm off the
  floor: the robots go under them).
- A real room must not move with the rig, which carries the panels and may be
  anchored: `GL.world` is the reference space moved down to the floor (world
  matrix = inverse(rig) x translation(0, floor, 0)), so set x and z are
  reference x and z. Without a room (no feature, no room setup) a virtual
  room hangs on the rig 1.6 m below your head, as the flock's land does: the
  model living room in VR, a bare 4 m x 5 m box in passthrough; the panel then
  offers *Set up your room* (`initiateRoomCapture`, once a session), and
  planes that arrive later take over. Nothing here moves `GL.rig`.
- Your head is the player (no avatar), the trigger aimed at the floor spills
  crumbs there, and the grip moves only the panel (outside a shared room). In passthrough
  (`robots_room` 0) nothing opaque is drawn: a glowing line along each wall's
  base, ripples where a robot bumps it, and the cleaned trail.

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
- After changing anything in `tools/nmd/` (or `ikerdata/`: first
  `node tools/nmd/data/gen_data.mjs`), rebuild `stories/nmd.js` with
  `node tools/nmd/build.mjs` (and bump `VERSION`).
- After changing anything in `tools/lbi/`, rebuild `stories/lbi.js` (and bump
  `VERSION`). Likewise `tools/endo/` and `stories/endo.js` (and after changing
  `tools/nmd/sets/motor.js`, which the endotype story uses too), `tools/flock/` and
  `stories/flock.js`, `tools/robots/` and `stories/robots.js`, and `tools/pet/` and `stories/pet.js` (and after
  changing `tools/lbi/sets/body.js`, which the PET story uses too).
- Keep `README.txt` (user-facing notes) in sync with structural changes.
- Shared rooms: bump `FORMAT` in `shared.js` when the keys or a story's
  `collab.state()` change shape (a room refuses another format). A story's
  hooks (see "Shared rooms") must stay in step with its pointer code.
- Several handlers run inside the old story's call stack when switching;
  use `HOST.go(key)` (deferred) from inside a story, not `HOST.start`.

## Testing

There is no unit-test suite. Before committing, serve the folder and run the
smoke test, which loads every story, scrubs through it, exercises explore
mode and the headset panels (for the muscle, endotype and PET stories every explore tool too; for
the robot gang every rule, a click to walk, crumbs, a big open floor and one
with no area, and a pretend headset room from detected planes),
switches stories, runs anchored placement in each
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

After touching `shared.js`, the relay or a story's shared-room hooks, run
`node relay/test.mjs` (the protocol: rooms, writes and their order, the epoch
rule, `fx`, timeouts, bad frames, static serving, `--logs`; no browser,
seconds) and
`node tools/collab.mjs` (about a quarter of an hour; it starts its own relay with
`--static .`, so no server is needed). For every story in its `STORIES` table,
three pages in a room follow its station and check play, pause, jumps, mode
changes and Replay (within 5 s), the relay's clock, the explore state both
ways and the story's effect (for the robots also the pile's spot and dust; for the flock
the same falcon, one page leading, the same flight time and the flocks together).
Before that: Arrange all's rows, a code with no room, Remove asking first.
After: a station moved and turned on the room map (and refused while the
layout is locked),
two controls changed at once on two pages (both kept), two stations
followed back to back (the second not lost), a story picked by hand (stops
following), no writes while idle (no ping-pong), a late joiner, a relay restart, and
a pretend headset with fake `local-floor` and `shared` spaces: alignment,
placement at its station, a recentre, taken off and on again (it stays in its
story), Start on its Stories screen (restarts nothing), the hold and the lock,
the station's clock and state, rays and head in room coordinates, another
person drawn, the sound zone, the shell's panel and a card pick, the story
panel winning over a card behind it, a station moved with the grip on its
card (swung, pushed further, turned; the others see it while it moves) and
gliding into place when someone else moves it, the layout lock (the grip and
Arrange all refused; unlocked from the headset panel), the Shared panel on the
left controller, re-alignment, walking to another station
and back, Remove asking first; calibration from two marks (Stop calibrating
still pressable, two anchors made and checked, the marks drawn), a reset with
a transform, a recentre without a reset (the anchors keep the frame), the
anchors found next session, Forget calibration (two presses; also while those
anchors are still being found), a new calibration replacing the old anchors,
the shared space never overriding marks (a newer frame from someone else only
reported, as a distance; not used at all by default), a space found split by two
calibrated headsets (the room told, whole again once they agree; a headset
without marks takes nothing through it), no room scan said and taken back, a fresh shared space (two presses move the
room's pages to `s/1/`, where they join again; a headset there told to start
one headset first; a page opened at the old address moved too), anchors not
found by their handles after waking and found by a later try (meanwhile the
panel asks to leave AR and enter it again; a jump with their handles saved
keeps the calibration), the room's floor from
the first calibration (a lower floor allowed for), no mark from a double
pull, Forget taking the published frame, the shared space on by default
(off: calibrate), a space that is just this headset's own floor while someone
here published (not joined: nothing taken), a headset back in AR whose space
is its own floor while another here is aligned through that id (its own
earlier frame not taken, also with the space drifting 6 cm), the first headset
in a space staying first with another aligned through it (Re-align, an id
flicking away and back), a frame from someone who has left
(waited for, then replaced by the first headset's own space), the first
headset taking a frame someone here publishes later, standby with the shared space in use
(a wrong space held off, then the room where it was and at the same height
though the floor moved), a reset as Quest Browser
sends it (old to new coordinates, the head's height ignored), a calibration
without anchors asked again after a reset without a transform or a jump, and
kept (moved by the reset) off and on again, off and on again with the anchors
not tracked (the frame follows the reset at once, then the anchors found
again by their handles), unknown saved anchors deleted at session start, a
full anchor store (cleaned and asked again; still full: the marks hold and the
panel says so), the mark taken where the
controller was held still, VR elsewhere with its in-room question; at a
station no Stories button and a Stories screen closing by itself, the grip on
the scene and the panel unlocked there (locked by the layout lock), both grips
resizing the scene and one hand carrying on, the place, size and panel going
out to the room and gliding in from it; Re-align
(an offset headset back on the room's frame, the shared space asked for again),
and after a night: a headset still outside the space asking for it again, a
follower holding against a space made again and following the room's frame
once written again, this headset's own frame written into a space made again;
a room on this device (no relay known: a link opens it, Arrange all, a moved
station and the lock kept across a reload, a headset alone on its floor with
Re-align, a station played there, the room taken to a relay that answers and
joined there by another page; a relay that cannot be reached). `--quick` runs only the last story in the per-story part. A new story needs an entry in `STORIES`
(`change` and `back`: code that changes its `state()`, and optional `effect`
and `more`); the headset's story (`HEADSET_STORY`) stays the last entry.
`--shots <dir>` also saves pictures of the dialog and two headset views.

For the tour, test a changed set on its own in the set harness first
(`tools/lbi/shot.mjs`, much cheaper than the whole story), then the story at a
few seconds (`tools/lbi/sweep.mjs`), then the smoke test. The muscle story has
the same tools in `tools/nmd/` (`shot.mjs`, `sweep.mjs`), and so have the
endotype story in `tools/endo/`, the PET story in `tools/pet/` and the robot gang in `tools/robots/`.

Useful URL hashes: `#spatial&t=95` (open at a story second, paused),
`#proteins&explore&q=TP53` (explore mode with a search),
`#spatial&explore&tab=moves&move=nfkb&now=1`, `#lbi&t=140` (the tour at a
second), `#lbi&explore&scene=atp&view=network&now=1` (a scene with its controls),
`#lbi&explore&route=TP53,BRCA1`, `#nmd&explore&group=Cardiomyopathies`,
`#nmd&explore&pick=5:13,11:7` (endotypes, group:number), `#nmd&explore&walk=5` or
`&walk=TTN,DES`, `#nmd&explore&inside`, `#endo&explore&endo=2`, `#endo&explore&gene=COLQ`,
`#endo&explore&tab=method&step=1&k=20`, `#endo&explore&scene=syn&view=cleft`, `#endo&explore&inside`, `#pet&t=40`, `#pet&explore&tab=networks&net=C_high`, `#pet&explore&organ=muscle`,
`#pet&explore&tab=one&profile=cancer&theta=2`, `#pet&explore&scene=scan&view=ring`, `#pet&explore&life`, `#flock&explore&view=afar&links=on&birds=400`
(`&hunt` sends a falcon), `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low`
(`&crumbs` spills a pile, `&walk=1.5,1.2` walks you there), `#airports&repeat=all` (a kiosk that plays
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


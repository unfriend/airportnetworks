# The shell

Read on demand; the rules every agent needs are in AGENTS.md.

## How the shell and stories fit together

- `HOST.list` comes from `stories/list.js` and the app's own story packages, in `packages/order.json`'s order (v185,
  `docs/agents/packages.md`; always the same array, changed in
  place when the list is read again; `HOST.listRev` counts the changes), so a
  story's code may keep it (`XR_STORIES`). Nothing in a story writes the number
  of stories in: the title and Stories screen say it in words up to twenty
  (`HOST.count()`; the headsets' `drawLandHead` the same), and the headset
  Stories screen lays its cards out in two rows from the number
  (`xrLandingCards`, built again when `HOST.listRev` moves on). A story the list does not have (a shared
  room's station from a newer copy) gets a stand-in, `HOST.unknown(key)`. An entry with `intro: true` (v173, the
  tutorial: an introduction, not one of the stories) is passed by in three places in `index.html`: `HOST.count()`
  counts only the entries without it, the default start (no `#key`) builds the first entry without it behind the
  Stories screen, and Repeat all skips it (from the tutorial itself it goes on to the first story).
- `HOST.start(key)` loads `stories/<key>.js` if needed (`HOST.load`: fetched as
  text, its fingerprint noted in `HOST.fp`, run as a script; a file that
  registers no story is refused), calls the old story's `dispose()`, removes
  every listener the old story added, then runs the new story's factory
  (`HOST.run`). Stories never navigate the page, so a VR/AR session survives a
  change of story. `HOST.swap(key)` does the same for the story on show,
  keeping its place (see "Hot reload and live updates").
- Listener bookkeeping: `index.html` wraps `EventTarget.prototype` and
  `THREE.EventDispatcher.prototype.addEventListener` and records listeners
  added while a story is current. Listeners three.js adds for itself must not
  be recorded (XRSession listeners, `webglcontext*`, `dispose`, anything added
  while `HOST.quiet` is set, which is how `HOST.makeRenderer` creates the shared
  renderer). If VR controller clicks or the XR frame loop stop working after a
  story change, look here first.
- Stories must create the renderer with `HOST.makeRenderer(...)`, never
  `new THREE.WebGLRenderer`.
- Controllers after standby (`HOST.inputsGuard` in `index.html`; why: after standby a controller sometimes could not click until the Quest menu was opened and closed again). three.js r128
  moves its controllers every frame by index from `session.inputSources` but hands a select or squeeze to a controller
  only through a map it fills on `inputsourceschange`, so a source the browser replaces without that event keeps its ray
  and loses its presses. Each frame of a headset session (`HOST.loading.wrap`, outermost) the sources are compared with
  those last seen with a real event, and a change nobody announced is announced by a synthetic `inputsourceschange`
  (what went, what came; `synthetic: true`), which three.js's handler maps afresh, the stories hearing `disconnected`
  and `connected` as for a real one. Logged as `inputs replaced` (with seconds since waking, `woke`). At any time of the session (a controller sleeps and wakes on its own, picked up minutes later), once the change has stood a whole
  frame unannounced (a browser that fires its own event after the frame's callbacks gets that frame).
  - Pressed and not heard. A tracked controller with a gamepad (never a tracked hand) whose trigger
    (`buttons[0]`) or grip (`buttons[1]`) goes down while the session is visible, with no `selectstart` (`squeezestart`)
    from the session for it from the frame before the gamepad shows it down until 300 ms after, is a missed press:
    logged as `press missed` (`hand`, `kind` select or squeeze, `came`: how the source came, `'start'`, `'event'` or
    `'announced'` here; `woke`: seconds since waking; `vis`; `profiles`; `mapped`: whether three.js maps it; `stray`:
    real presses seen for a source three.js does not map, also logged as `press for an unknown source`; `heard`: seconds
    since the session last said so), and that controller's button is armed: its presses are then given as synthetic
    `selectstart` as it goes down and `select` and `selectend` as it comes up (`squeezestart`, `squeeze`, `squeezeend`
    for the grip; plain events with `inputSource`, `frame` and `synthetic: true`, dispatched on the session within the
    frame), which three.js hands to the story's controller as a real press, and through the story's press of a shell hit
    to the shell's menu (`HOST.collab.press`); the shell's own session listeners hear them too. The first real
    `selectstart` from it disarms it (`press back`, with how many were given). The missed press itself is lost (it is found
    missed only after it went down; a tracked hand's pinch never counts as its controller's press). Never two clicks for one press (the owner
    would rather lose one): a real `selectstart` arriving while a synthetic press is under way (a browser that fires it
    after the frame's callbacks) is stopped by the guard before three.js or the shell hear it, and the session's own
    `select` and `selectend` end that press in place of synthetic ones; and once a synthetic end was given, that press's
    own events coming late (within 250 ms, `G.late`: a `select` or `selectend` with no real press open at three.js, or a
    `selectstart` while the button is up, and then its `select` and `selectend`) are stopped too, while a real
    `selectstart` with the button down again in that time is a press of its own. For that the guard's listeners are added as
    `HOST.session` is set (it wraps `HOST.xr.watch`, which the setter calls), which every story does before it hands the
    session to three.js: at a session, which is not a node, Chromium runs listeners in the order they were added,
    capture or not (checked in headless Chromium 141). A real event for a source three.js does not map reaches no
    controller, so it does not count as heard (a press it carried is missed, and the next given); counted as `stray` only
    once the session's frames come through the guard. The sound's unlock hears a synthetic `select` too but goes by
    `navigator.userActivation`, which no synthetic event sets. `HOST.inputsGuard.state()` (`{ fixes, seen, missed, synth, stray, stopped, woke, armed: ['right select'] }`),
    `wokeAgo(ms)`, `missMs(ms)` and `lateMs(ms)` are for tests.
  - Untested on a headset: whether a Quest replaces a controller without the event, or keeps it and stops passing its
    presses on (the headsets' logs will say: `inputs replaced`, `press missed`, `press for an unknown source`), how the
    trigger's `pressed` and Quest Browser's select line up there (Chromium takes its select from the same button state, as
    far as we know; were they apart, a light press the browser does not take for a select would be logged as missed and
    arm it, the next real press disarming it, and a light press while armed would be given as a click), and whether the
    presses given that way work on a Quest.
- Loading. A story builds in
  steps, each a task of its own (its `LOAD` queue, see "Inside a story"), and reports each with
  `HOST.progress(done, total, label)` (stories guard it, `if (HOST.progress)`, so an older shell still works). The
  page's `#loading` shows a thin bar in the story's colour (`#ldBar`, changed at most every 150 ms and only where it
  changes: each change costs the page a frame, which a slow device composites in software) and the step (`#ldStep`) under the story's
  loading line (`#ldLine`; `HOST.loading.begin(meta)` in `HOST.start`). In a headset the old story's scene is gone
  while the next one builds, so `HOST.teardown` gives the renderer the shell's loading scene as its frame loop
  (`HOST.loading`, in `index.html`, in place of the blank loop that kept the session alive): a card with the story's
  kicker, title and a bar in its colour and the step, 1.2 m in front of you and 15 cm below your eyes, easing with your
  head (upright, turned to you; the menu is out of the scenes while a story builds). It is placed from the frame in the renderer's reference space (where three.js puts the
  camera), shown only once a load has taken 0.4 s, and fade out over the new story's first frames (`HOST.loading.wrap`,
  in `makeRenderer`'s `setAnimationLoop`: drawn after the story's frame with its camera's near and far, so the
  session's depth range does not flip). The loading scene is a scene of its own, never in a story's, made once with
  `HOST.quiet` set; the clear colour stays as the story before left it (see-through in AR). A headset draws it between
  the story's steps only, so no step may run long. A story torn down while it still builds (its frame loop not yet
  given: `HOST.loading.ran`) never took the headset: `HOST.inputs` and `HOST.xrPose` from the story before stay.
- In a headset session, a newly started story calls `xrAdopt()` to take over
  the running session, the controllers (`HOST.inputs`) and the previous
  placement (`HOST.xrPose`).
- The start screen (`#picker`) is the landing page. Entering VR/AR from it
  (`HOST.landingVR` / `HOST.picking`) shows the headset Stories screen
  (`XR.stories`, built by `xrLandingSetup`). Entering VR/AR from inside a
  story resumes that story. In a shared room a headset never shows the
  Stories screen (see "Shared rooms"), except at an All stories circle.
  - The headset Stories screen (the same lines in all sixteen stories and the design room, on `XR.landGroup` in
    `GL.rig`): a header (`XR.land[0]`, `drawLandHead`, 1.02 m wide) with only the title (*Networks, in sixteen
    stories*), its hint (or where an anchored place stands, `HOST.anchor.status()`) and *Back to the story* (while
    `XR.inStory` and not at an All stories circle's cards); the sound, Sound check, Anchor, Exit, Recenter or Place
    again and Repeat are the headset's menu's, not on it. Under it one card per story (`XR.land[1..]`, in
    `HOST.list`'s order, 0.36 m x 0.461 m, the whole card a button: here and not at an All stories circle's cards back
    into the story, else `HOST.go(key)`) in two rows on one arc, as the All stories circle's icon has them: the first
    half of the list (rounded up) in the upper row, the rest under it, a shorter row centred, each card turned to you.
    In a row neighbours stand 0.381 m apart and the outer ones at most 62 degrees to the side, never nearer than
    1.25 m (sixteen: eight a row, 0.306 rad apart at 1.25 m). Heights over your eyes (`XR_LAND`): the header's middle
    0.475 m, the rows' middles 0.13 m and -0.38 m (0.05 m apart, the upper row's top 0.03 m under the header), so it
    reaches from 0.56 m above your eyes to 0.61 m below, the header 1.22 m ahead.
- The address mirrors the state (`HOST.setUrl`): `#stories` while the Stories
  screen shows (page or headset), `#<key>` in a story. A `#<key>` link opens
  that story directly; no hash or `#stories` lands on the Stories screen.
  It replaces the address (`HOST.hist.replace`, keeping `history.state`), with one exception (the back button on phones: `HOST.hist` in `index.html`): a story opened from the page's Stories screen (`closePicker` onto a story,
  outside a headset session and a headset's browser) is a history entry of its own (`{ nwUp: 1, key, doc }` in its
  state, `setUrl(false, 'push')`), so back (Android's back, iOS's swipe, a desktop's) comes back to the Stories screen;
  the Stories button there steps back to that entry (`setUrl(true, 'back')`), so entries never pile up (an entry a page
  made before a reload, `doc` another page's, is turned into the Stories screen's instead: stepping back would load the
  old page again); forward goes back into the story. On `popstate` back first closes what is open (the Shared dialog, the card of `HOST.handheld`, More,
  focus mode's Text, explore's drawer: `HOST.hist.closeOne()`) and puts the story's entry back. On the Stories screen
  and in a story opened by a link (nothing of ours under it) back leaves as ever, and a new address typed in changes
  nothing. No entry per chapter, explore change, swap (`HOST.swap` keeps the entry) or story the room or Repeat starts;
  a shared room's `#s=XYZ` stays on both entries. In a headset session nothing changes (the address replaced). Untested
  on real phones (Android's back, iOS's swipe).
- The shell talks to stories with window events `storypause` and
  `storyrestart`.
- Repeat (`HOST.repeat`: `off`, `all` or `one`; buttons on the page's Stories
  screen, via `HOST.toggleRepeat`, and *Repeat* on the headset menu's Settings
  tab, each press the next, via `HOST.setRepeat`): a story that reaches its end
  calls `HOST.ended()`; when that returns true the story only pauses, and after
  a moment the shell starts the next story (`all`, wrapping round) or sends
  `storyrestart` (`one`); otherwise the story opens explore mode. Remembered in
  `localStorage`; `#repeat=all` or `#repeat=one` in a link sets it.
- Slideshow (`HOST.slides` in `index.html`): a story waits at the end of each
  chapter, all its text shown, until Next (or Play) goes on. `global()` and
  `setGlobal(on)` (every story; it clears the stories' own choices: the
  Slideshow button on the Stories screen, the headset's left-hand menu),
  `on(key)` and `set(key, on)` (one story: the switch on its panel, page and
  headset), `sig()` for panel signatures; remembered in `localStorage`
  (`slideshow`, `slideshowStories`), per device, never in `collab.state()`;
  `#slides=on` or `#slides=off` in a link sets it for every story. The shell
  sends stories nothing: each reads it every frame (guarded by `HOST.slides &&`,
  so a story and a shell of different versions do not break). In every story
  the same lines (`slideStep` and its helpers next to the narration code):
  chapter i stops at `slideStop(i)` = `narrT(CH[i].b - 0.7)` (just before its
  text starts to fade out), found as a crossing in `frame()` (the clock before
  and after the frame; at a station also since the last frame when the clock
  moved no further than the time that passed plus 0.35 s, as when the shell
  catches a slow page up with the station's clock, but not a jump), so a jump
  into chapter k stops at its end, and the last
  chapter stops too before the end (Repeat and explore mode follow Next). The
  stop is `APP.playing = false; APP.seek(stop)` and Next is `APP.togglePlay()`,
  so in a shared room they go out through the shell's wrapper as the station's
  clock, like a pause and a play by hand, at the same `t` on every device. A
  story paused just now while playing up to 0.25 s before a stop (a room's pause
  lands within the shell's 0.25 s drift) waits at it too, but a clock put near a
  stop while paused (a scrub) stays where it was put unless it is right on the
  stop; a stop just gone on from stays passed while the clock is within 1 s of
  it. The voice: a chapter's last words often run on past its stop (the
  airports' recording by up to 2.4 s, so a plain pause cut them). A story with a
  recording lists where each chapter's words end in it (`NARRATION_ENDS`, seconds
  by chapter key, measured from the file; `stories/airports.js` has one, independent
  of `NARRATION_SYNC`, and the tour has one, written with its table by
  `tools/voice/narrate.mjs`, whose words always end before each stop): at a stop the narration plays on, on
  its own clock, to that point (`slideTail`, `slideSound`, which `audioSync`
  plays), and after Next it stays quiet, the story not following it
  (`audioFollow`), until the story is back there, so nothing is cut or said
  twice. Re-measure the list when re-recording (ffmpeg's `silencedetect`, then
  check by ear). Next shows at the foot of the page's panel (`#slides`, with the
  story's switch, scrolled into sight only as far as the chapter's top stays in
  view), on a phone (under 900 px) beside Play in the bar instead
  (`#btnNextBar`), and in the headset's foot panel in place of the chapter's
  name (the chapter arrows stay; the switch beside the clock).
- Placement in the headset: each story hangs its Stories screen, story panel
  and the scene's placement point (`XR.globeBase + XR.globeOff`) on one frame,
  `GL.rig`. Normally the rig is set from your head (`xrRecenter`) when a
  session starts, on Recenter, when the reference space resets, and when the
  headset was off for more than 3 s (`xrFreshStart`: a new wearer). Anchored
  mode (`HOST.anchor` in `index.html`; *Anchor: on/off* on the headset menu's
  Settings tab, beside Exit and Recenter; in a shared room it can be turned off there, not on; `#anchor=on` / `#anchor=off`; remembered as `xrAnchor` and `xrPlace`
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
  What a session asks for comes from the shell (`HOST.xr.request(mode)`, in every story's `xrStart`: `session = await (HOST.xr.request ? HOST.xr.request(mode) :
  navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));`, the same line in all sixteen,
  the design room and the studio; `HOST.xr.features(mode)` is still the list): AR asks for `local-floor`, `hand-tracking`,
  `anchors`, `plane-detection` and `mesh-detection` (the robot gang's room and real-world occlusion) and
  `shared` (the shared space), and `depth-sensing` (real-world occlusion: below), all optional; VR only for `local-floor`,
  `hand-tracking` and `anchors`, since a Quest 3 left VR for its home at once
  with the full list (AR was fine there, and VR on a Pico) and
  started VR on the first try with these three (which of the other three was
  to blame was not tried). A VR
  session that ends within 10 s of starting, or whose page goes with it (no
  `pagehide`), makes the next one ask for less (`hand-tracking` and
  `local-floor`, then `local-floor`, then nothing; `xrSteps` in `localStorage`,
  back to the start in another browser version): Sound check says what VR asks
  for and why. Ending VR on purpose within 10 s counted too until v176; since then a session the page ends itself (an
  exit button, a story's own `end()`, after the session's first 1.5 s) does not (`watch` wraps the session's `end`),
  while a story that could not start the headset view, ending it at once, still does. Sharp text's `'layers'` is the
  first thing dropped (below, "Sharp text").
- Four headset settings, one each for the whole system (the owner's: system-wide, labels on top and cards in 3D by default, name tags with the cards):
  `HOST.xr.labels()`, the scenes' small labels (`'face'`, the default: on top;
  `'fixed'`: in 3D; `'hidden'`), `HOST.xr.cards()`, the larger ones: the
  story's two panels (its text and explore panes and its play and pause bar),
  the shell's station cards over the circles and people's name tags (`'fixed'`,
  the default: in 3D; `'face'`: on top; `'hidden'`), `HOST.xr.free()` (free
  moving, on by default) and `HOST.xr.subs()` (subtitles, off by default), set
  with `HOST.xr.setLabels(m)`, `HOST.xr.setCards(m)`, `HOST.xr.setFree(on)` and
  `HOST.xr.setSubs(on)`, `HOST.xr.sig()` for panel signatures (labels, cards,
  free moving and subtitles); rows in the headset's menu (*Labels: on top* ->
  *in 3D* -> *hidden* and *Cards: in 3D* -> *on top* -> *hidden*, side by side,
  each press the next, each lit while shown; *Moving: free* / *Moving: facing
  you*; *Subtitles: on* / *off*) and, in a room, in the page's Shared dialog
  (a Labels and a Cards picker). Labels and cards are independent: labels
  hidden leaves the cards, cards hidden leaves the labels. In a shared room
  they are the room's (key `look`, below), for every headset and page in it;
  otherwise the device's own (`xrLabels2`, `xrCards`, `xrFree`, `xrSubs` in
  `localStorage`; the labels under a new key, `xrLabels2`, so every device started once on the new defaults whatever it chose before; `xrLabels` is left
  behind), which keeps a room's last value after leaving it.
  `#labels=face|fixed|hidden`, `#cards=face|fixed|hidden`, `#free=on|off` and
  `#subs=on|off` in a link set them. Stories read labels, cards and free moving
  every frame (`xrSettings` in `xrBegin`: `XR.lm`, `XR.cm`, `XR.free`; a shell
  without them means labels on top and nothing free, and a shell without
  `cards()` the labels' mode for the cards) and put `xrSig()` in `sigMain`; the
  shell alone draws the subtitles. The two sound switches (`HOST.xr.sfx()` and `HOST.xr.voice()`, for pages and headsets alike) go the
  same way, in `look` beside these (see "The two sound switches" under "Sound
  effects"); `HOST.xr.sig()` leaves them out (the stories' panels do not show
  them).
  - On the desktop preview camera (v155): its overlay's own *Labels* and *Cards* switches (this device's, never the
    room's): `shared.js` wraps `HOST.xr.labels()` (`'hidden'` there with its Labels hidden; shown, the room's mode, on top
    where the room hides them) and `HOST.xr.sig()`, and draws the name tags and the circles' cards by them; `HOST.xr.cards()`
    and every headset are untouched ("The desktop preview camera" in `docs/agents/shared-rooms.md`).
  - The frame rate: beside these, a fifth setting that is never the room's but each
    headset's own (`HOST.xr.fps()`, `HOST.xr.setFps(on)`, `xrFps` in `localStorage`, off by default, `#fps=on|off` in a
    link; not in `HOST.xr.sig()`): the menu's *Frame rate: on/off* row (Settings, under Moving and Subtitles), or a double press of B or Y (`buttons[5]` of either controller pressed twice within 0.4 s, `BY` in `sticks`, a button held as its controller
    appears counting nothing; a notice says *Frame rate: on* or *off*; no story uses that button). While on, in
    a headset session only, the shell draws a small read-out low in the view (`drawFps`, `OV.fps`, 0.36 m wide, 1 m away,
    22 degrees under the gaze and 14 to the left, fixed to the head, `renderOrder` 52: over the story and the subtitles,
    under the menu and the notices), drawn again when its numbers change (about once a second): the frames a second (*88 fps of 90 Hz* against the session's refresh rate, below, coloured by it: green within 3 % of it, amber within
    20 %, else red; where the browser says no rate, as before: *88 fps*, green from 70, amber from 55) and the time between frames, the mean and the worst of the last second (the
    shell's own frame callback, `FPS`, as the Debug tab's line), and the story's frame's triangles, draw calls and how
    long its code took (`HOST.perf` in `index.html`: the story's frame function is wrapped inside `HOST.loading.wrap`, so
    the loading scene's fade after it is not counted; while measuring, `renderer.info.autoReset` is off for the whole
    function, so a story that renders twice counts both, and in a headset one render draws both eyes; the shell's things
    in the story's scene, rings, icons, the menu and the read-out itself, are in the numbers; each second's means as
    `HOST.perf.stats()` `{ tri, calls, js, n, at }`; off, nothing is measured or changed). How the read-out reads and the
    numbers on a real Quest are untested.
  - The refresh rate. Quest Browser runs a WebXR session at 72 Hz unless the
    page asks for more (Meta's docs; Browser 16.4 and later: `session.supportedFrameRates`, `frameRate`,
    `updateTargetFrameRate(rate)`), so the shell asks. Each headset's own,
    never the room's, not in `HOST.xr.sig()` (`HOST.xr.hz()`, `setHz(n)`, `xrHz` in `localStorage`, 90 by default,
    `#hz=72|90|120` in a link): on each new session (`HOST.xr.watch`, `layerWatch`) and again whenever it changes, the
    highest rate the session lists at or below it is asked for (else the lowest listed); logged through `HOST.collab.log`
    as `frame rate` `{ want, list, asked, got, why }` (`got` the session's `frameRate` once the request has settled, `err`
    a refusal), and the session's `frameratechange` as `frame rate change` (its listener added with `HOST.quiet` set). The
    Debug tab's *Refresh rate: 90 Hz* row (each press the next listed rate, round again; greyed where the browser has no
    frame-rate API, the line beside it saying so) says beside it the session's rate and what it offers (*Now 90 Hz · offers
    72, 80, 90, 120*); the Debug tab's *Frame rate* line and the alignment samples (`sample()`'s `hz`: `{ f, a, w, v }`,
    the session's rate, the one asked for, the setting and the frames a second measured) carry it too.
    `HOST.xr.hzState()` (`{ want, list, asked, got, err, api }`: `api` null before a session was seen, false without the
    API) is for tests. Two developer experiments beside it on the Debug tab, each headset's own, never the room's, by default leaving the story's own: *Foveation: the story's* / *0* / *0.5* / *1* (`HOST.xr.fov()`, `setFov(v)`, `xrFov`,
    `#fov=story|0|0.5|1`: as the story sets it, 0.5 at every story's first `xrBegin`, by default; else the shell sets
    `session.renderState.baseLayer.fixedFoveation` after the story's frame, `HOST.xr.layerStep` from `HOST.loading.wrap`,
    only when its value or the layer changes, so a story that sets its own again is set back; back to the story's, the
    layer's value from before is put back once; `fovNow()` the layer's now) and *Resolution: 100 %* / *90 %* / *80 %*
    (`HOST.xr.scale()`, `setScale(v)`, `xrScale`, `#scale=1|0.9|0.8` or `100|90|80`: three.js r128's
    `renderer.xr.setFramebufferScaleFactor`, read as it makes the layer, so set as each new session is first seen, before
    the story hands it to three.js, and while none runs; the row's line says it applies from the next session,
    `scaleNow()` the one this session was made with). Antialiasing is unchanged. Untested on a headset: what a Quest 3 or
    3S lists and runs at by default, whether it takes 90 or 120 from the page, how heavy stories hold 11.1 ms, and how
    foveation and a lower resolution look and what they save there.
  - Automatic quality (`index.html`, `HOST.xr`; the owner's decisions: 90 Hz is the target, automatic quality is **on by
    default**, every headset drops to 72 Hz first (v151; until then a Quest 3S only), the look changes it makes are approved). Each headset's own, never the
    room's, never in `collab.state()` or `HOST.xr.sig()`: `HOST.xr.auto()`, `setAuto(on)` (`xrAuto` in `localStorage`,
    `#aq=on|off`; the Debug tab's *Automatic quality: on/off* row with a line from `HOST.xr.aq()`, *Level 2 of 5:
    foveation 1, view 100 % · why*). *Foveation* and *Resolution* on the Debug tab now start with *auto* (`FOVS` is auto,
    story, 0, 0.5, 1; `SCALES` auto, 1, 0.9, 0.8; `setFov` and `setScale` take `'auto'`); a value set by hand wins over auto,
    and auto off gives the story's foveation and scale 1. The ladder (`aqFrame`, called from the session's
    frame hook beside the walk): L0 to L5 are fixed foveation 0.5, 0.75, 1, 1, 1, 1 and view scale 1, 1, 1, 0.9, 0.8, 0.7
    (the view scale through `requestViewportScale`, in the dress wrap of `getViewerPose`; without that API, and on a Pico
    (v166: its browser drew the smaller picture small, so everything shrank), the ladder stops at L2; the viewport that came back is logged once, `viewport`). A frame is late when its time is over 1.5 periods of the
    rate the session runs at now; the first 1.5 s, a story loading, a hidden session, a scene change and a step's settle time
    are not judged. A 1 s window steps down at 4 % late, or at 1.5 % twice running; a window where the script took over 0.6
    of the period is CPU-bound, logged as act `cpu` and never stepped (a lower picture would not help). Ten clean windows
    step up; a step up that fails again within 15 s holds further steps up for 60 s. The level is kept per scene in
    `sessionStorage` `aqLevels`. L4 or deeper for 30 s makes the next session's framebuffer 0.9 (`xrAqScale`); 2 minutes at L1
    or lighter clears it.
  - The refresh rate as a ladder step (the owner, 16 November 2026: "fallback first to 72 fps before reducing resolution
    etc"; until v150 only a Quest 3S dropped to 72 Hz first): taken only where the session lists 72
    Hz, has `updateTargetFrameRate` and the wanted rate is above 72. `rate3S(ua)` (`/\bQuest\s?3S\b/i` on the user agent: a
    plain Quest 3 is not a 3S; kept for the logs and tests, no longer deciding the default); `HOST.xr.rateStep()` is `'first'`
    (L0 at 90, L0 at 72, then L1 to L5 at 72: the default on every headset since v151), `'last'` (L0 to L5 at the wanted
    rate, then L5 at 72; the default on a Quest 3 until v150) or `'never'` (`xrRateStep`,
    `setRateStep(v)`, `rateSteps()`); stepping up reverses the order, so the wanted rate comes back last. `hzAsk`
    asks the lower of the two while the rate step is down; each rate step is logged as `auto quality` and as `frame rate`
    (why `auto quality`); the next 2 s are not judged.
  - Logs and hooks: `HOST.xr.aq()` (`{ level, fov, vs, why, auto, rate, low, rateStep, vsApi, steps, next, noUp, clean }`),
    `aqTest({ win, up, hold, warm, settle, upFail, rate, minN, deep, light, cpu, late, reset, next })` (null restores the
    defaults) and `frameTimes()` (`{ p50, p95, max, late, n, js, jsMax, calls, tri, fov, vs, level, hz }` over a 10 s ring, null
    under 5 frames or with no session; `HOST.perf` measures the story's frame whenever a session runs with auto on). `shared.js`
    writes a `frame times` log line every 10 s of a session and `sample()` carries `pf`; occlusion's log counter must skip
    these (they carry their own `n`). The relay keeps a headset's log when the request brings the relay's password (Authorization
    or `?token=`) in place of the log token (`saveLog`; `--public --logs` starts with no log token when a password is set; a
    log without the password is 401; the password is in no log line): `relay/test.mjs`, "--public: a log with the relay's
    password". Untested on a headset: every threshold and step (4 %, 1.5 periods, 10 clean windows, the levels' look),
    whether `requestViewportScale` is there and honoured, how a 3S behaves at 72 Hz and whether a step is seen, the gain.
  - Sharp text (v174; on by default since v175, *layer*, in Quest Browser only since v176; the menu too since v177; the owner, 20 November 2026, after the rendering lab's composition
    layers, "a trick to make text supersharp in vr and ar on quest", and after trying v174 on a Quest: "the sharp text
    works ... all of them do it so just use the cheapest one per default"; v177: "sharp text is also important in ar, it is
    ok that it does not hide in that case, also make the menu use the sharp text feature"): the story's two panels (its
    text, 1024 x 1200, and its play bar, 1024 x 176: the same in every story and page, `HOST.cur.panels()`) and the
    shell's headset menu (720 x 1920, `HOST.collab.sharpMenu()`, v177) shown as WebXR quad layers. The headset's compositor samples a
    layer's canvas once, at the display's resolution, as it warps for the lenses; a panel in the scene is drawn into the
    eye buffer first (its resolution, the framebuffer's scale, fixed foveation) and that picture warped again. No story
    changed: the shell does it all (`index.html`, after the stick moving's module). Each headset's own, never the room's:
    `HOST.xr.sharp()`, `setSharp(v)` (`xrSharp2` in `localStorage`, a new key in v175 so every device starts once on the
    new default, v174's `xrSharp` left alone; `#sharp=layer|text|front|off`), `sharps()`, `sharpState()` (`{ v, can, live,
    layers, order, dropped, next, shown, err, ms, size }`: `order` the session's layers, `behind` or `front`; `dropped` why
    the VR ladder dropped the layers, or empty; `next` the value needs the next session). The size key `xrSharpSize`
    (`#sharpsize=half|full`) did not change with v175's new key: a stored value wins over the browser's default. The
    Settings tab's *Sharp text* row under My body (the Debug tab's, under Automatic quality, until v176: it took that tab
    over the smoke test's 1,500 px): each press the next of *off*, *layer*, *for text*, *in front*,
    then *off* again (while `dropped` is set and the value is not off, the press asks for the layers again instead); its
    line: *2 layers shown · a write 1.2 ms*, *In front: from the next session* (or *Behind: ...*), *As ever: press again
    to compare* (off in a session that has layers), *Off: the story panel drawn as ever*, *From the next session*,
    *Dropped: ... Press to try again*, *No WebXR layers in this browser*, or *Not this session: ...* with the reason.
    The values:
    - *layer* (`'layer'`, the default in Quest Browser): behind the scene, a hole in the eye buffer (below). The cheapest
      that keeps the rays, their dots, labels and the menu over the panel: the same eye buffer work as the panel drawn as
      ever (its one draw, blended to a hole) and one quad a panel for the compositor (Meta's numbers for a Quest 2: about
      0.1 ms a layer, plus about 0.6 ms for each screenful it covers; a hidden layer still pays the 0.1 ms, so v175 makes
      only the two a value needs).
    - The default by browser (v176, `sharpDefault(ua)`): *layer* where the user agent says `OculusBrowser`, where it was
      tried; *off* in any other browser until set there. Quest Browser takes a quad's width and height as half extents (the
      lab's finding, and the owner's Quest showed the right size); the spec's are full, so a browser that follows it would
      show the text in the middle quarter of a dark panel. So `full` (the size) is off in Quest Browser and on elsewhere
      unless `xrSharpSize` (`#sharpsize=half|full`) says otherwise.
    - *for text* (`'text'`): the same with quality `'text-optimized'`, the compositor's own filter for reading (on a
      Quest, supersampling and sharpening: more compositor work every frame).
    - *in front* (`'front'`): over everything, the panel drawn into nothing in the eye buffer; no hole, so it does not
      need the compositor to use the eye buffer's alpha (a fallback for a headset that does not), but it covers the
      rays, their dots and the menu where they cross it.
    - *off* (`'off'`): the panels as ever. **Off as a session starts changes nothing**: no feature asked, no layer.
    - The session: any other value asks for the optional `'layers'` feature where the browser has quad layers
      (`XRWebGLBinding.prototype.createQuadLayer`) and the VR ladder has not dropped them (`request`: added to every
      rung's list, VR and AR). When the session enabled it, `sharpPrep(s)` (in `request`, before the story gives the session to three.js) takes a
      `'local'` space and wraps the session's `updateRenderState`: three.js's first call (`{ baseLayer }`, in its
      `setSession`) goes in as `{ layers: [main, foot, three.js's XRWebGLLayer] }` for *layer* and *for text*, or `[three.js's
      XRWebGLLayer, main, foot]` for *in front* (v174 made all four for comparing in one session; v175 only the two the
      value needs: half the layers' memory). The spec allows an XRWebGLLayer in the list; layers added mid-session blacked
      out the lab's WebGPU view, so they go in at the start. Anything refused (no binding, `createQuadLayer` or the list) falls back to three.js's own call, the
      reason in `err` and logged (`sharp text`). The layers: `XRWebGLBinding.createQuadLayer`, `layout: 'mono'`, `RGBA8`
      (the canvas's colours as they are; the lab found `SRGB8_ALPHA8` too dark), each the size of its canvas.
    - three.js r128 reads `renderState.baseLayer.framebuffer` every frame, and the spec makes `baseLayer` null once
      `layers` is set: the session gets an own `renderState` getter (the prototype's, its `baseLayer` the XRWebGLLayer
      while the layers are this session's), so three.js, the shell's foveation and every story's `fixedFoveation` line
      work unchanged.
    - Each frame (`sharpStep(f)`, `HOST.loading.wrap` after the story's frame; the loading scene's own loop calls
      `sharpStep(f, true)`: nothing on show while the next story builds): a shown panel (it and every parent up to the
      scene visible) gets its layer placed from its world matrix in `HOST.xr.poseSpace()` (the space three.js's poses are
      in: the stick moving's offset space while you travel, else three.js's own; three.js's world is that space, as no
      story's camera has a parent), width and height half the panel's (Quest Browser takes half extents, as the lab found;
      `#sharpsize=full` or `setSharpSize('full')`, `xrSharpSize`, for the spec's full ones), quality `'text-optimized'` for
      *for text*. It is written (`getSubImage`, `texSubImage2D` of the canvas, flipped and premultiplied, every GL state it
      touches put back) when it has nothing yet, when the compositor asks (`needsRedraw`) or when the panel was drawn
      again (`P.nd`), at most every 100 ms (or 20 times a write's mean time while writes are slow); `getSubImage` throws
      until the updateRenderState took effect, so a failing layer puts its panel back at once and is tried again (see
      "When things go wrong").
    - The menu (v177): a third layer, 720 x 1920, behind the scene only (*layer*, *for text*): last of the three in the
      session's list, so the compositor draws it over the panels' layers (its `renderOrder` 53 orders only its hole in the
      eye buffer). *In front* (a fallback) leaves the menu in the eye buffer: a menu layer in front would cover the Story
      tab's mirrors, the notices and the rays that point at it. `HOST.collab.sharpMenu()` (`shared.js`) gives its canvas, mesh, a count that moves
      whenever the canvas changes (the texture's `version` plus `patched`: a full send or a patch, a hover light or a Debug
      read-out) and `f`, the part of the canvas shown: the menu shows only its top `vis` rows (`showTop`: the texture's
      repeat and offset, the mesh's `scale.y`), so its layer holds the whole canvas (`drawPanel` clears it, so the rows
      below are clear) and its quad is the whole canvas's, its top edge where the mesh's is. Null while the menu is
      closed: its layer out of sight at once. A write sends the whole canvas (5.5 MB; a layer's images rotate, so a patch
      would land on an older one): at once when the menu was drawn again whole (`nv`, the texture's version: a tab, a
      page), else at most every 50 ms for its patches (a button's light as you point, the Debug read-outs; 10 times a
      write's mean time while writes are slow); its hole is the menu's own material, cropped as it is shown. The Story tab's mirrors of the story's panels and the notices over the menu are drawn in the eye buffer, over
      the hole. Not layers (yet): the Stories screen's cards, the subtitles, the notices, the station cards.
    - The panel's own material (no new mesh): behind (*layer*, *for text*) it erases the eye buffer where it is, by its
      canvas's alpha (custom blending: zero, one minus source alpha, for colour and alpha; its depth settings as the Cards
      setting has them), so what stands in front of the panel (Cards: in 3D) or is drawn after it (on top: the rays, the
      labels, the notices) still covers the layer, and the menu, a layer itself since v177, is over it by its place in the
      list; in front it draws nothing (zero, one) and the layer covers everything,
      rays and menu too. The material changes only once its layer has the panel, from the next frame, and a layer goes out
      of sight (a millimetre wide, a kilometre under the floor) a frame after its panel is drawn as ever again, so the hole
      and the layer never part; a panel or menu not drawn at all (hidden, closed, the next story building) takes its layer
      out of sight at once (v177). *layer*, *for text* and *off* switch live in a session with layers behind; *in front* (or
      from it) applies from the next session (`next`), the panels drawn as ever meanwhile. A session started with *off*
      has no layers until the next.
    - When things go wrong (v176): a layer that cannot be placed or written puts its panel back in the eye buffer at once
      (no hole without its layer); after 90 failures in a row it is tried again every 2 s, never given up for the session.
      Writes come further apart while they are slow (100 ms, or 20 times a write's mean time). A later `{ baseLayer }`
      (a second `setSession`) replaces the list: the layers are dropped, the panels drawn as ever (`err` *a new base
      layer*). The VR ladder (`xrSteps`, "what a headset session asks for") drops `'layers'` first: a VR session that asked
      for them and closed by itself within 10 s (or whose page went with it) makes the next ask without them
      (`noLayers`, `HOST.xr.layersDropped()`, the reason on the Settings tab's line, *Dropped: ... Press to try again*), before
      its list gets shorter. A session counts as one with layers when it was granted them (`enabledFeatures`, kept as
      `X.lay` as it starts). The drop holds for every later session, VR and AR, until that press or a value set by hand
      asks for them again (`layersAgain()`). `features()`
      and `line()` (Sound check's *VR asks for*) include `'layers'` when it is asked for.
    - The developer notebook's pictures (`notes.js`, read back from the eye buffer, which has a hole where a layer is):
      `HOST.xr.sharpPause()` draws the panels as ever for 600 ms and says whether the frame just drawn had no hole; the
      notebook takes its picture once it does (a frame or two later).
    - Tried on a Quest (v174, the owner: "the sharp text works ... all of them do it"): so Quest Browser takes the
      XRWebGLLayer beside quad layers and uses its alpha behind them (else *layer* would show a black panel); no wrong
      size was reported, so half extents hold there. Tried again after v177 (the owner, 20 November 2026: "this works
      and does not cost a lot"): the menu as a layer and the cost on a Quest. Untested: other headsets and browsers (they
      may refuse; the Debug tab says why and the panel is drawn as ever) and v176's fallbacks (the ladder dropping the
      layers, a failing layer retried, the notebook's pause), tried only with a pretend headset. In AR a layer behind
      the scene is not covered by the real world's occlusion (a hand before the panel shows the panel): kept on in AR
      all the same (the owner, v177: "sharp text is also important in ar, it is ok that it does not hide in that case"). The lab: `webxr-user-studies/web/lab/layers.js` (not in this
      repository). Tests: `smoke.mjs --only 'sharp text'`.
  - Real-world occlusion: a sixth setting that is each headset's own, never the room's, *Real world hides: room
    and people* (the default) / *room* / *people* / *nothing* on the menu's Settings tab (under My menu), only in AR;
    see "Real-world occlusion" below.
  - Your menu shown to your circle: a seventh
    setting, each headset's own and never the room's (`MSH` in `shared.js`, `xrMenuShare` = `circle` in `localStorage`,
    off by default; not in `HOST.xr.sig()`, no link option): the menu's *My menu: only me* / *My menu: my circle* row
    (Settings, under Frame rate, a note beside it). While on, the menu open and this headset lined up at a live station
    in a shared room (`menuShareTo`), the other headsets at that station see it where it floats here; never while the
    relay's password page is open (it shows the password as it is typed: the menu is closed for the others meanwhile).
    It goes out as quiet effects on the station's channel (`e.<station>`, type `@menu`, which the shell takes for itself
    in `onFx` and never passes to the story; nothing stored, no `FORMAT` change): the menu's pose in room coordinates
    (`{ k: 'pose', p, q, w, h, n, ts, m }`: its top edge's middle, which it hangs from, its turn, its width and height
    in metres, the number of its latest picture, the relay's time, `m: 1` while it moves) at most every 200 ms while it
    moves, once more as it comes to rest and once a second while still; a picture of what it shows (`{ k: 'pic', img,
    ... }`, the pose too: the drawn part of its canvas, only the height the tab uses, with the Story tab's copies of the
    story's panels drawn in where they show, on a dark ground) as a JPEG data URL, made smaller and coarser step by step
    (`MSH.steps`, 540 px wide at quality 0.75 down to 180 at 0.3; the next starts at the step that fitted, a step finer
    when it came well under) until it is under 47 KB (the relay refuses effects over 64 KB), sent only when what it
    shows changed (`menuSig`: the menu's content, `cver`, counted by `drawPanel` with the light of the button pointed at
    left out, the mirrored panels' texture versions and the height shown) and at most every 1.5 s (`MSH.picMs`), or when
    only that light changed at most every 4 s (`MSH.hovMs`: a ray moving over the buttons redraws the menu all the time,
    and every picture goes to everyone in the room), encoded with `toBlob` off the frame, and never sent when its bytes are those of the last one made (what `cver` follows changes more often than what a tab shows; `menuSent().same` counts them; the Debug tab's read-outs, drawn on their own, move no `cver`: a picture shows them as they were when it was made); and `{ k: 'closed' }` once
    when the menu closes, the setting goes off, the station changes or the session ends (`menuShareEnd`). A headset at
    that station whose latest picture is older than the pose says (`n`) asks for it (`{ k: 'want', to }`, at most every
    1.5 s) and gets the last one made (also when a newer one did not fit); only a headset at that station keeps a
    picture (`menuIn`), so one that walks in later asks. Every other headset at the same live station draws it (`drawMenus`, `MENUS`) as a plane at that pose in the room
    (`OV.room`), smoothed as others' moves are (`bufAt` with `MIX.menu`), the picture's own shape, its corners cut
    round, two faces back to back so it reads the right way round from either side (from behind, left and right are
    swapped against the person's ray), depth-tested so what stands in front hides it, `renderOrder` 49.5 on its meshes
    (after the station cards set on top, under the story panels set on top, the subtitles, the read-out and your own
    menu; its group's stays 0, as three.js r128 sorts by a group's order before an object's own), a tag over its top
    edge with the person's name by their colour (*Anna's menu*); never pointable or pressable; gone 3 s after its last
    sample (`menusExpire`) or at once on `closed` (the log's `menu gone` says why: `closed`, `quiet` or `room`; a `closed`
    for another station than the copy's, or with no copy, is `menu closed ignored`). Pages draw nothing; the Shared
    dialog's people list says *showing their menu*. `HOST.collab.menuShare(on)`, `menuSent()` (`n`: pictures made;
    `pics`: pictures sent, a want's answer, an old picture sent again, among them; `at`, `ns` and `cv`: when each was
    sent, its number and the `cver` it shows; `cur`: the last picture made shows what the menu shows now), `menus(full,
    px)` (`px` false: no pixels read back) and `menuShot(master)` (the picture as it would be made now) are for tests. The picture is made with `toBlob` given 2 s and its `FileReader` 2 s (`inTime`: one that never calls back held every later picture),
    and where either gives nothing, with `toDataURL` at once (`jpegUrl`); `MSH.how` keeps why, the log's `menu share` line
    says it, and the Settings row's note says who sees it now (`menuShareSays`: *Shown to Anna, Ben*, *Nobody else is in
    this circle now*, *Not shown: go into a circle first*, *Not shown yet: this headset is not lined up with the room*,
    *Not shown: this headset could not make a picture of it* after two failures, `MSH.bad`). Untested on a headset: how the picture reads at a few metres, its cost (a JPEG
    made in the page at most every 1.5 s, about 45 KB to everyone in the room each time: the relay, and a peer-to-peer
    room's host, send every effect to every member, so with the Story tab of a playing story shown, its clock changing
    every second, about 30 KB a second to each of them), and Quest Browser's `toBlob`.
  - Moving with the sticks (`index.html`, after `HOST.xr`): an eighth setting, each headset's own, never the room's
    and never in `collab.state()` (`HOST.xr.walk()`, `setWalk(on)`, `xrWalk` in `localStorage`, off by default,
    `#walk=on|off` in a link; not in `HOST.xr.sig()`). Turned on and off by the left stick clicked twice within 0.4 s
    (`sticks` in `shared.js`, a notice *Moving with the sticks: on* / *off*; the right stick clicked twice launches or lands a spaceship, and while one flies the right stick's press counts only
    at its middle: "Spaceships" below) or by the menu's *Moving with the sticks*
    row (Settings, under Moving and Subtitles). Both clicks must be on the same stick: a click of each within 0.4 s (or
    both at once) counts as one click, which opens or closes the menu; a single click acts only once 0.4 s have passed
    with no second click of that stick. While a spaceship flies the right stick's 30 degree turn rests (the thumb sits on
    A), the left stick still moving you. It applies (`HOST.xr.walking()`) in a VR session (not AR: there you walk for
    real),
    not while this headset is in a shared room's real room with the others (the room's frame and the others' view of you
    need where you really stand there) and while the story on show does not move you itself (`ownSticks: true` in its
    returned object, which no page says); `HOST.xr.walkWhy()` says why not (`'ar'`, `'room'`, `'own'`,
    `'none'`, `'session'`; `''` it applies), and there a double click says so in a notice and the menu's row is greyed
    with the reason under it (`'room'`: *Not while you are in the room with the others: there you walk for real.*). A
    page that switches its sticks with it (`sticks: { say(on), note }` in its returned object; the studio, "The studio's
    two stick modes" below) has it apply in VR in a shared room too and moves you itself while it applies
    (`HOST.xr.walkSelf()`: the shell's travel stays as it is, never stepped, so the two never fight); `say(on)` gives
    the double click's notice and `note` the menu row's line in its own words. The left stick moves you along the
    floor where your head faces (1.5 m/s at full push, a dead zone of 0.2, the rate the push's square past it), the
    right stick turns you 30 degrees about your head on a flick past 0.6 (again once it is back under 0.3). A controller
    whose grip is held (`squeezestart` and `squeezeend` on the session, or its button 1) keeps its stick for the story
    (a carried scene's reach) and moves you not at all meanwhile; the free hand's stick still moves you while the other
    hand carries a scene (how that feels, comfort above all, is untested). How: three.js r128 has no
    `setReferenceSpace`, so the shell hooks the session's own `requestAnimationFrame` (in `HOST.xr.watch`, as
    `HOST.session` is set, before three.js starts its loop) and, before any callback of a frame reads it, puts its own
    `getViewerPose`, `getPose` (for an input source's ray or grip, or a hand's joint), `getJointPose` and `fillPoses` on
    that frame object (instance-level: a Proxy fails WebXR's brand checks), each answering for three.js's reference
    space from `base.getOffsetReferenceSpace(T)`, `T` the travel's inverse as an `XRRigidTransform`, made again only
    when the travel changes. Other spaces are left alone: an anchor's pose stays in the real room (an anchored place
    stays put and you move past it), as do `HOST.room`'s own spaces and the room scan's. The travel stays when the
    setting is turned off (you stay where you moved to), and goes at the session's end, once a shared room is joined and
    while in the room with the others (below). Stories need nothing for the move: their head, controllers and rays, the
    menu, the sounds' listener and the subtitles all follow three.js's space; their own stick use (an explore view's
    spin and zoom) waits while `xrWalking()` is true (the same line in every story). `HOST.xr.travel()` (`{ space, x, z,
    yaw }`) and `walkReset()` are for tests; `HOST.xr.toReal(v, q)` and `travelShift(yaw, x, z)` are for `shared.js`
    (below). Untested on a headset: how it feels on a Quest (comfort, the speed, the turn), and an anchor placed while
    moved (made at the moved coordinates in the real room, so the next session finds it elsewhere).
  - In a shared room, elsewhere. It applies to a headset elsewhere in a room
    (`HOST.collab.here()` false: VR answered *Somewhere else*, or not answered yet, since a VR headset counts as
    elsewhere
    until it says otherwise), and is `'room'` for one in the room with the others (AR, VR answered *In this room* or
    *I am
    in the room*, the PC's Index the trackers see) and for any headset in a room on this device alone (`C.local`, where
    `here()` is true by design: its circles stand on this headset's real floor, and the room goes to a relay as soon as
    one answers, where the others line up with that floor). A `shared.js` without `here()` (an older one) gives `'room'`
    in any room, as before. Each headset's own setting still: nothing in the room's keys, no `FORMAT` change. Why it
    works: a headset elsewhere has its own floor as the room (`ownFrame`, made from where three.js has its head as it
    joins), and the room's frame keeps the real numbers of `HOST.room`'s own spaces, so the circles, cards, icons and
    people stay put in three.js's space while the sticks move the head and controllers through it. Everything of yours
    the room reads follows the head three.js has: your presence's head, heading, rays and grips (so the others see you
    move, smoothed as any move), the circles you walk into (also Back to the lobby with the circles asked first), the
    studio's behaviours (`heads()`), the sound zone. What compares your head with the real floor's origin or spaces
    takes
    the travel back first (`HOST.xr.toReal(v, q)`, `realHead` in `shared.js`): the check for an origin that jumps
    (`originCheck`, so a stick's move or a 30 degree flick is never a jump and never asks to calibrate), the shared
    space at the head, the PC's trackers' history of the head (`trkHist`) and the logged samples (`sample`, which also
    logs the travel). A reset of the room's floor with its transform (a recentre, waking: `floorReset`) moves the travel
    with the room's frame (`HOST.xr.travelShift`, the transform carried into three.js's space by `R.lf`, then
    T M T^-1), so you stay where you were in the room. Re-align for a headset elsewhere makes the room round where
    three.js has your head now, as before. The travel goes when a room is joined (or another: the code changes, so its
    frame is made from where you really stand), whenever this headset is in the room with the others (the answer
    changed to *In this room*, the trackers), at the session's end and in AR (never there); it stays while elsewhere,
    through Recenter at a station (the station's scene and panel, as ever) and on leaving the room. The double click's
    notice says *The others see you move* there, and the menu row's note that it works in this room because you are
    elsewhere. The studio is unchanged: it moves you itself (`walkSelf`). Untested on a headset: how moving through a
    room's circles feels, how the others see a moving avatar over Wi-Fi, a real recentre or wake while moved.
  - The studio's two stick modes. The same setting (`xrWalk`), not one of the studio's own: a double click of the left stick then does the obvious thing
    everywhere (on: the sticks move you, in the studio as in every story; off: each page's own sticks, which in the
    studio are its walk, turn and steer), and the menu has one row for it. Off, the studio's own sticks as before (its
    VR walk and 30 degree turns with nothing carried, steering a carried item, scrolling the pane under the ray). On, in
    VR, the sticks move you by the shell's numbers wherever the ray is (the pane scrolls by Up and More) and also while
    something is carried: it stays in the hand and comes along (carry something far across the scene, turned with you),
    the sticks no longer steering it. The studio moves you itself (`stickMove` in `tools/studio/engine/e8_xr.js`, before
    any carry each frame): its scene moves (`XR.walk`, as its own walk does), so its panels stay with you as in its own
    mode, and the same in a shared room, where the others see you where you really stand (your presence is your real
    head; the shell's travel is never used in the studio). Switching keeps where you are (`XR.walk` stays); Recenter takes
    it back, at a station too. While a path is recorded the sticks move nothing (`REC`: the scene moving under the hand
    would go into the path), and a story's travel left from before is taken back as the studio comes on show (the
    shell's `step`, the page's `sticks`). Known limit: a two-hand carry of a group while moving may drift by the move
    (one hand carries it right). The notice says *Sticks: moving you* or *Sticks: the studio's*, as do the menu row's note,
    the item card's line under *Carry it* and the foot panel's hint. AR: you walk for real; the double click says *Not in
    AR*. Untested on a headset: switching on a Quest, carrying something far while moving, how a carried item turned
    with you feels.
  - My body (v164; the owner, 18 November 2026: your own legs when you look down, "off by default"): a ninth setting,
    each headset's own, never the room's and never in `collab.state()` or `HOST.xr.sig()` (`HOST.xr.body()`,
    `setBody(on)`, `xrBody` in `localStorage`, off by default, `#body=on|off` in a link). The menu's *My body: on* /
    *off* row (Settings, under Frame rate). While on, in a VR session (not AR: there you see your own; never in camera
    mode or on the preview camera), the shell draws your own body with the others' (`bodies.js`: "People's bodies" in
    `docs/agents/shared-rooms.md`) from your head and your controllers' grips as each frame gives them, in a shared room
    or not, the head and neck folded away; nothing of it is sent. Untested on a headset: how it feels to look down at it,
    how your arms follow real controllers, whether it is in the way of the menu or a story's panels.
  - Labels (`XR.lm`): on top, every scene label is a sprite over everything.
    In 3D, a flat sign at its sprite's place and size, upright and turned to
    you (about the vertical, in the rig's frame: `placeLabelXR` with
    `XR.signL` and `XR.signH`), but in the scene: depth-tested, so what stands
    in front hides it, readable from both sides. Hidden: no scene labels. The
    pointer's tip (`XR.tip`) is always a sprite.
  - Cards (`XR.cm`): in 3D, the two story panels (`XR.main`, the text and
    explore's panes, and `XR.foot`) stand in the scene as the labels' signs do
    (`panelDepth`, set only when the mode changes: depth-tested and writing
    depth, drawn first of the see-through things at `renderOrder` -1, their
    clear corners cut away by `alphaTest` 0.1), so whatever stands in front
    hides them, glass and glowing points too, and they hide what is behind
    them; the pointer still reaches a panel first, even one partly hidden
    behind the scene. On top: both story panels over everything, as before
    (`renderOrder` 50). Hidden: no story panel at all, neither `XR.main` nor
    `XR.foot`, in story and explore mode (not drawn and not pointable); the
    headset Stories screen stays (never stuck), the shell's menu stays (to
    switch back; its Story tab still shows the story's panels and works: play and
    pause are there, A and X do nothing). Shown, the story's
    Panels row (below) applies on top. In the shell, station cards are drawn on
    top (after the scenes, before the story's panels, depth-tested) or, in 3D,
    as the labels' signs are (`renderOrder` -1, writing depth, `alphaTest` 0.1,
    both faces), and not at all when hidden (the ring stays, pointable and
    grabbable, and its icon; in a circle the other stations' cards show only
    while their ring is pointed at, see "Shared rooms", and with cards hidden a
    ring pointed at brings up its icon alone); people's name tags are sprites,
    signs over the head drawn the same way, or nothing.
  - In every mode of both: the Stories screen's panels, the menu (its Story
    tab's copies of the story panels too), the shell's notes and the subtitles
    are on top, and the stations' icons
    are as ever.
  - Free moving: the grip holds the scene like a real object, the point you
    hold the pivot. One hand moves it and turns it with the hand (`XR.rot`, a
    turn in the rig's frame; the facing comes from `XR.globeBase`, not from
    where you moved it, `xrFace`); two hands size it as before, move it with
    their middle and turn it with the line between them; let go, it stays.
    The story panel is held rigidly and may tilt. Off: things move but keep
    facing you, and the panel stands upright (turning it off clears `XR.rot`
    and stands the panel up, its yaw kept). Recenter clears the turn. The
    life-size stories (the flock, the robots, the pass story's fish) move only
    their panel. Stations stay level (room furniture). The anchored
    arrangement keeps `q` (the scene's turn) and `pq` (the panel's) too.
  - Subtitles (`drawSubs` in `shared.js`): only in a headset, in story mode
    with a line on show (playing or paused; nothing in explore mode, on the
    Stories screen, away from a station, or for a story without the hook), the
    narration's words in a strip low in the view (16 degrees under the gaze),
    1.4 m away and 0.9 m wide, white B612 on a dark rounded band, drawn on top
    of everything in every labels and cards mode (`renderOrder` 51: over the story panels,
    under the menu and the notices), one canvas redrawn only when the caption
    changes, fading between captions. It stays while the head turns less than
    15 degrees from it (or moves less than 12 cm) and eases back in front
    beyond. The words come from the story's caption hook (`caption`, below):
    the cues of the chapter on show, read as `tools/narration.mjs` reads them
    (so a recording and the captions say the same; a cue with no word of two
    letters, such as a chart's numbers, is not read), the latest cue passed
    with words cut into captions of at most two lines of about 42 characters
    (at a sentence's end, then a clause's, then a word; a new cue element
    always breaks), spread over the stretch to the next cue at reading pace
    (2.1 words a second, by word count), or faster only where the stretch is
    shorter than that (as the narration goes there); the last caption of a
    stretch holds until the next cue, and a chapter's last line is spread to
    end 0.75 s before the chapter does, so a slideshow stop shows its last
    caption. The pass story's captions are in the device's language (its
    panel is). How they read and follow on a headset is untested.
- Focus mode (`HOST.focus` in `index.html`; on phones and tablets less of the interface: a small bar and subtitles, the 3D the main focus). A story's 3D on its own on a page: on by default where `matchMedia('(pointer: coarse)')` matches and
  the screen's smaller side is at most 1100 px (phones and iPads), never in a headset's browser (Quest, Pico, Wolvic:
  Enter VR stays in view), off on desktops; this device's own setting (`pageFocus` in `localStorage`), never a room's;
  *Focus view* on the Stories screen (beside Slideshow) and in the top bar's More menu (⋯), `#focus=on|off` in a link.
  `HOST.focus()` is true while it is on, no headset session runs (`HOST.session` or the renderer presenting), a story is
  on show (not the Stories screen) and neither Text nor the drawer is open; whenever that value changes the shell sends a
  window `resize`, and every story frames its scene for the whole page from it (`GL.bare` in `resize()`, "Inside a
  story"). Body classes: `focus` while the setting is on, `fc-text` with Text open, `fc-drawer` with the drawer open; all
  its rules are scoped to `body.focus:not(.picking)`. `HOST.focus.on()`, `set(on)`, `text(open)`, `drawer(open)`,
  `close()` (Escape: More, then Text, then the drawer), `chapter(±1)`, `check()` and `state()` (tests).
  - The top bar (48 px plus the safe area, `--fc-top`): the story's short title, Stories, Shared, AR where the device has it and More (what has no room: the mode button under 700 px, VR, Install, Full screen, Focus view). The foot bar (56 px plus the safe area,
    `--fc-bot`): Play, the chapter arrows (as the headset's foot panel's: back to this chapter's start, or the one before
    within 2 s of it; on to the next), the chapter's name (Next in its place at a slideshow stop), a thin timeline along
    its top edge, the clock from 600 px up, Sound (as the top bar's) and Text, which opens the story's panel as it is (the
    bottom sheet under 900 px, the side panel above) and closes it.
  - Subtitles on the page: the narration's words in a strip just above the foot bar (white on a dark rounded band, at
    most two lines, `clamp(18px, 1.6vmin + 14px, 28px)`, smaller down to about 72 % when a caption needs a third line),
    fading between captions, only in story mode with Text closed (Text, explore mode, the Stories screen and a headset
    session hide it at once). They are the headsets' own captions: one function in `shared.js` (`captionNow`) reads the
    story's caption hook, splits and times it for both, `drawSubs` draws the headset's strip from it as before and
    `HOST.collab.caption()` gives the page `{ text, id }`.
  - Chapter titles: a chapter's heading (its `h1` or `h2` on the panel, else its timeline name) in the upper middle for
    about 3 s when the chapter is played into or jumped to, or a story starts from the Stories screen.
  - Explore mode: the view controls stay in the foot bar as one row that scrolls sideways, and Controls pulls the panes
    up in a drawer (at most 60 % of the height; full width under 900 px, in the side panel's place above; a handle), closed
    whenever explore mode begins; while it is open `HOST.focus()` is false, so the scene frames as with the panel.
  - Nothing changes on desktops with it off, in headsets, or in `collab.state()` (no `FORMAT` change). Untested on real
    phones and iPads (Safari's safe areas and URL bar, `:has()`, how readable the strip is over every scene): only in
    headless Chromium with touch emulated.
  - Phones and tablets (`HOST.handheld` in `index.html`: AR more prominent where a phone has it, a top bar that fits, the back button, full screen, a timeline that does not trigger iOS's back swipe). A phone or tablet is focus mode's own
    test (`HOST.handheld.hand`).
    - The top bar fits any page (`fit`, on the bar's changes, the body's classes, resizes and the font's arrival): under
      700 px wide (`#top.slim`, the Stories screen too, focus mode on or off, explore mode) short labels (*AR*, *VR*: the
      `.long` "Enter " hidden) and the mode button and Install in More (focus mode's ⋯, shown while `#top.more`); then
      only while the bar has no room (no button is squeezed; the title keeps 72 px or its own width) in turn: VR to More,
      a tighter bar (`#top.tight`), the Sound button's words for an icon (`#btnSoundIco`, `#top.sndico`, mirroring it
      as the foot bar's does), Shared, then AR (`#top .ovf`). More lists what is hidden (Shared under 760 px too), then
      *Full screen* / *Exit full screen* where the browser has it, then *Focus view: on/off* in a story. Its items pass
      the click on to their buttons; the top bar's own handler leaves More and its menu alone (the Stories screen stays
      open). Wide screens as ever.
    - AR on a phone or tablet that has it (`isSessionSupported('immersive-ar')`: Android's Chrome with ARCore; no iPhone
      or iPad has WebXR): Enter AR shown even without VR (the stories show it only beside VR), in focus mode's top bar
      too (an icon and *AR*, a cyan edge), and once per device (`arInvite` in `localStorage`, set as it shows) a card,
      *See it in your room*, about 3.5 s after a story first shows (`#hhCard`): Enter AR (the top bar's button, within
      the tap) or Not now. How a story feels in a phone's AR session (taps on the screen as input) is untested.
    - The menu in a phone's AR session (the phone AR section of `shared.js`: `PH`, `phAsk`, `phRows`, `phTap`). A phone has no
      stick to click and no hand to pinch. Its AR session (a phone or a tablet, `phoneDev`: never a headset's browser,
      `IS_HEADSET`; a phone's or tablet's user agent, `DEV`, or `HOST.handheld.hand`; not camera mode, which keeps its own
      overlay) also asks for `dom-overlay` (optional, on every rung of `HOST.xr.request`'s ladder, through camera mode's
      wrapper; `extra.drop`: a refusal other than `NotAllowedError` or `SecurityError`, which are thrown at once, asks
      again without it, depth sensing kept, straight after the failed request inside the ladder, so the tap's activation,
      which lasts a few seconds, still holds; refused again, the story's line on the page says *Could not start AR: it was
      refused with the menu button (...) and again without it (...). Tap Enter AR again.*) with its own root, `#xrPhone`
      (made once, its CSS injected once, its listeners added with `HOST.quiet`);
      a headset's browser asks for nothing new. Granted (`domOverlayState`), the overlay shows one round menu button (52
      px, three lines) at the top right inside the safe areas, only during that session. The root passes taps through
      (`pointer-events: none`, `auto` on its controls; `beforexrselect` cancelled only on the button and the sheet), so a
      tap on the scene still points and presses. The button opens a sheet (at the foot in portrait, on the right in
      landscape, scrollable, buttons at least 48 px) with the menu's main rows, each calling what the headset menu's
      Settings row calls and showing its state (its words and `aria-pressed`): Exit AR, Recenter, Sound (this session's
      mute), Narration (this session's), Sound effects, Subtitles, Slideshow, Frame rate, Labels and Cards, Panels (the
      story on show's), Real world hides, and *The full menu* (`menuOpen(true, 'phone')`: the shell's 3D menu in front of
      you for the rest, a tap on the screen pointing at it and pressing it; the row then says *Close the full menu*).
      Close, or the button again, closes the sheet; nothing new is stored. Without the overlay: two quick taps on the
      screen (a `screen` input source, each taken at its `selectend`, once the story has pointed its ray; within 0.4 s)
      pointing at none of the panels open and close the 3D menu, as the left hand's two pinches do. The menu's hints, the
      notice *The menu* and the welcome (*Tap: point at a thing and press it.*, *The round button, top right: the menu.*,
      no controller drawn) say so on a phone. `HOST.collab.phone()` and `phoneSheet(on)` are for tests (the smoke test's
      `phone ar` block). Untested on a real phone: the overlay itself, the safe areas, taps passing through, Chrome's own
      AR controls beside the button, the 3D menu's size and distance on a phone's screen.
    - Full screen (the Fullscreen API: Android's Chrome, iPad's Safari, desktops): asked for within the tap on a story's
      card on the Stories screen on a phone or tablet (`storyTap`; a refusal is quiet), and from More. Never while a
      headset session runs or Enter VR or AR (or the card's) was pressed in the last 8 s, and never again by itself: a
      person who left it (back, Esc, the browser's swipe; back leaves full screen first, by itself) gets it back only by
      opening a story from the Stories screen or from More. An iPhone (Safari has no element full screen) not opened from
      the Home Screen (`navigator.standalone`, `display-mode: standalone`) gets, once per device (`homeTip`), a card
      saying *For full screen, add this to your Home Screen: Share, then Add to Home Screen.* (the manifest's `display`
      is `standalone`; the page uses the safe areas and `100dvh`).
    - Touch (`pointer: coarse`): the bars 20 to 22 px inside the safe areas (iOS takes a swipe from a side edge as back,
      from the bottom as home), the focus foot bar a little above the home indicator (up to 8 px more than the inset),
      its timeline a 28 px tall strip starting 24 px in (`touch-action: none`), the phone's bottom sheet 22 px in.
    - Untested on real devices: Android's and iPad's full screen, the iPhone tip, AR on a phone, Safari's gestures and
      address bar; only in headless Chromium with touch emulated and these APIs stubbed.
- Panels per story (`HOST.panels` in `index.html`; an independent toggle per story): `'shown'` (as ever), `'controls'` (only the foot bar,
  `XR.foot`: play and pause, the chapter arrows, the clock, Next; good with
  subtitles on) or `'hidden'` (no story panel; play and pause on the menu's Story tab: A and X do nothing).
  Each story keeps its own value, the design room too: `get(key)`,
  `set(key, v)`, `next(key)`, `sig(key)`. Outside a shared room it is the
  device's (`xrPanels` in `localStorage`, `{ key: value }`, shown left out); at a
  station in a room the station's, for everyone at that circle (key
  `st.<id>.ui`, below; a station without it: shown), whatever a device keeps of
  its own. Set in the headset's menu (a *Panels: shown* / *controls only* /
  *hidden* row for the story on show, each press the next; no row on the
  Stories screen or away from a station) and, in a room, per station in the
  page's Shared dialog; never refused by the circles lock. `#panels=shown|controls|hidden`
  in a link sets it for the story the link opens. Stories read it every frame
  in `xrUpdate` beside the cards mode (`xrPanels()`, next to `xrSig`, which
  carries `HOST.panels.sig(XR_HERE)`): cards hidden still hides both panels
  (the two are independent; labels hidden hides neither), and the Stories
  screen never changes with it.
  Not in a story's `state()`. How it feels on a headset is untested.
- Developer mode (`HOST.dev` in `index.html`, `NEWS` in `shared.js`: a box at the start of a session with the latest changes and what to test). This device's own, off by default (`devMode` in `localStorage`, `#dev=on|off`
  in a link); its switch is at the Stories screen's foot (`#btnDev`, small, beside *What is new*, `#btnNews`), in More
  (focus mode's and a narrow top bar's) and on the headset menu's Settings tab (*Developer mode: on/off*, under Frame
  rate). What is new is `whatsnew.json` at the app's root, `{ version, date, new, test, untested }` (short sentences;
  New, Please test and Untested), written by hand at every release; fetched past every cache as `version.json` is
  (`?t=`, `no-store`; the service worker passes it through, the relay serves it `no-store`, never in `SHELL`), at most
  40 sentences a list. It keeps a history: `whatsnew/<version>.json` for every release from v127 and
  `whatsnew/index.json` (`{ versions, at }`, newest first), written by `node tools/release.mjs` from `whatsnew.json` when
  that names the release (`--check` fails while they are not current), never cached (the service worker passes them
  through, the relay serves the folder as an app folder, `no-store`). The card and the headset's page have *Older* and
  *Newer* (`HOST.dev.show(v)`, `older()`, `newer()`, `position()`, `versions()`), a line *v142 · 2 of 18*, *Got it* only on
  the newest, and always open at the newest; their lists scroll (the card's body; the headset's page an 860 px view with
  Up and More, and the stick pushed up or down while the ray is on the menu, `newsStick`; `HOST.collab.whatsNew()` adds
  `sc` and `max`). Untested on a Quest: the stick scroll's feel; with Moving with the sticks on, the left stick also
  moves you while it scrolls.
  - On a page, while it is on: a card (`#devCard`) over the Stories screen, or over the story a link opened, once a
    page load (`HOST.dev.boot()`, after the first story has started), with the release's number from the file (*What
    is new in v124*), its date and the three lists; *Got it* keeps it away for that version on this device (`devSeen`),
    *Later* (also Escape and the back button) until the next page load. Never in a headset session: a session that starts
    closes it, as Later (`HOST.session`'s setter). *What is new* (the Stories screen's foot, More) opens it any time.
  - In a headset session, while it is on: at the start of every session until Got it for that version, the menu opens
    by itself at *What is new*, a page of the Debug tab in place of its content (`newsPage`, `PNL.page` `'news'`, as the
    room setup guide is of Circles), as tall as its lists need (its type 22, 20 or 18 px, the largest that fits the
    1920 px canvas; what still does not fit counted), with *Got it* and *Later*; either closes the menu it opened, and
    closing it any other way (another tab, the menu closed) counts as Later. It comes last of what a session shows by
    itself: after the startup flow in a shared room (the room setup guide, the check by eye) and after the welcome
    (*Getting around*: once it has shown and gone; with it off, where it would have come, 2.5 s in), 0.8 s after the last
    of them (so about 3.3 s into the session with the welcome off), never over the open menu (it waits until it is
    closed), the questions, a calibration or a check, never in camera mode. The Debug tab's *What is new* opens the page
    any time (*Got it* and *Back*).
  - A file that cannot be fetched is said in one line (*Could not fetch what is new (whatsnew.json): the server answered
    404.*; a release fetched earlier in the page is kept and shown instead), and while it is fetched *Fetching what is
    new...*: then the card has *Later* alone and the headset's page *Later* (or *Back*) alone, since Got it names a
    release. Nothing in a room's keys or `collab.state()` (no `FORMAT`
    change). `HOST.dev.on()`, `set(on)`, `load(again)`, `data()`, `seen()`, `card(open)`, `state()`;
    `HOST.collab.whatsNew()` (`{ shown, fl, menu }`), `devOpen()` and `welcomeMs(ms)` are for tests. How the page reads
    in a headset (about 1 m tall with v124's lists) is untested.
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories only say
  what should play. A story asks for its file with
  `AUD = HOST.audio.narration(url, { ready, error })` and calls
  `AUD.sync(playing, t)` and `t = AUD.follow(t)` every frame and `AUD.seeked()`
  after a jump; `AUD.label()` and `AUD.on()` feed the headset panels. Stories set
  `HOST.session` when they start or adopt a headset session; the shell listens
  to its controller events (`select`, `squeeze`: Chromium counts them as taps,
  `selectstart` it does not) and its visibility. Never create or close an
  `AudioContext` in a story. One exception, and only this one: the studio's Upload pane decodes a short sound it
  is given in an `OfflineAudioContext` (`monoWav` in `tools/studio/engine/e7b_upload.js`), to mix it to a mono WAV;
  such a context opens no output and plays nothing (a voice recorded with a movement goes through the same
  `monoWav`, the same one place; its level meter is an analyser on the shell's context, connected to nothing else). The studio's sounds placed in a scene play through the shell's
  context (`HOST.audio.fx()`), as the effects do ("The studio" below). How it works, and why (the narration was silent on
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
  - Sound by mode (the owner's rule: on pages no sound and no narration until turned on; in AR and VR sounds on, narration off until turned on, then remembered). A headset session (VR or AR on any device, the Quest and a phone's AR alike: `HOST.inXR()`, a
    session in `HOST.session` or the renderer presenting) has its own mute and narration, apart from the page's; leaving
    the session, the page's apply again. The hum, both engines and the watchdog are unchanged.
  - The mute (the Sound button: the page's bar, focus mode's foot bar, and
    *Sound: on/off* on the headset menu's Settings tab, `HOST.audio.mute(on)`,
    `HOST.audio.muted` the one that applies now). On a page it is **on by default**: a device plays
    nothing, narration, effects, backgrounds or the vacuum, until it turns the
    sound on, and its choice is saved under `narrationMuted3` (only `'0'` keeps
    the sound on; a new key, so every device started muted once; the older
    `narrationMuted`, a mute saved when *Play sound* was pressed in the headset,
    and `narrationMuted2`, sound on by default, are removed). In a headset session it is **off by default**: effects play at once (Enter VR or AR is a tap, so the engines start), and only the menu's *Sound* row turns
    it on there, saved as `xrMuted` (`'1'` keeps the session muted); the page's own stays as it was. Muted, a story
    runs on its own clock with its subtitles, as with the Narration switch off.
    The bar's button says *Sound off* (title *Turn the sound on*); a press turns
    it on (it is a tap, so it starts the engines too); with no recording (a
    story without one, the design room) it stays, for the effects (*Sound off*,
    *Sound on* or *Play sound*). `#sound=on|off` in a link sets it (saved).
    *Play sound* (and any press while loading with the sound on) only starts the
    engines; it never mutes. Reset in Sound check turns both mutes off. The Narration switch (`HOST.xr.voice()`, the narration that applies now; see "The two sound
    switches" under "Sound effects") is a second, finer way to silence it:
    `sync` plays nothing and `speaking()` is false while it is off, so the story
    runs on its own clock and the effects do not duck; the mute (the Sound
    button) stays this device's quick mute of everything. In a headset session the story panel's Sound button
    (every story's `hb('sound', ...)`, calling `HOST.audio.toggle()` and drawing `AUD.label()` and `AUD.on()`: a shell
    change, no story file touched) is this headset's narration switch: it says *Narration on* or *Narration off*, lit
    while on, and a press turns this headset's narration on or off (`HOST.xr.setVoice`), never the mute.
  - Narration decoded only when audible (`narration()` in `index.html`): it no longer decodes as it loads. `N.sync` calls
    `startDecode` the first time it runs while the device is not muted, Narration is on and the story is not away, paused or
    playing; meanwhile the `<audio>` element has the bytes (`engine()` is `'media'` until the decode is `'ok'`). So a page that
    starts muted (the default) decodes nothing until the sound is turned on, an undecoded idle narration is not labelled
    *Sound loading*, and the old story's buffer is dropped when a new narration starts. `tools/audio.mjs` waits for a loaded
    decode state, not for `ok`.
  - Sound check (`#soundcheck`, a button on the page's Stories screen; in the
    headset a page of its menu, the shell's `soundPage`, in or out of a shared
    room) shows `HOST.audio.report()`, plays a beep through each
    engine and lets the user pick an engine (`soundEngine` in `localStorage`).
    Ask a user with sound problems on a device for those lines.
  - Listeners the shell adds while a story runs (a new context, the headset
    session) are added with `HOST.quiet` set, so story changes do not remove
    them.
- Sound effects (`HOST.sfx`, `sfx.js`). Phase 1: the shell's own sounds and a background. Phase 2: sounds inside the stories (cues on their timelines, explore and headset actions, the live simulations' own) and continuous sounds, below ("Sounds inside the stories"). **On by default** (a device that saved them off keeps them off). Only the flock and the pass story keep a background, and the robots' `vacuum` is the only continuous sound (the owner's rule: no other backgrounds or hums, never brought back unasked); and the two switches below ("The two sound switches"). The rules:
  - Everything is made in `sfx.js` from Web Audio nodes and short generated
    buffers (seeded noise, smooth random drifts, a small reverb): no files.
  - It plays through HOST.audio's one context (`HOST.audio.fx()`: the context
    while Web Audio runs after a tap, the page or headset is in view, Web Audio
    is not out or set aside for the `<audio>` element in Sound check and not
    being reopened; else null). Never a context of its own, so nothing before
    the first tap and nothing while only the `<audio>` element plays. It builds
    its graph again on a new context (the watchdog's `renew`). The hum, both
    engines and the watchdog are untouched. While the sound is off (the bar's
    Sound button, the headset panel's or the menu's *Sound* row: `HOST.audio.muted`,
    this device's quick mute of everything, on until the device turns the sound on) the effects and the background are silent too (the app's
    adapter gives no context then: a visitor who turns the sound off expects
    silence); the two switches are the finer ones (the narration without
    effects, or the other way round).
  - In a headset a sound can come from a place (`play(name, { at: [x, y, z] })`,
    the scene's coordinates, which are the reference space's): an HRTF
    `PannerNode` (inverse distance, full level within 1 m), the listener at your
    head every frame (`HOST.sfx.listen(p, q)` from shared.js's `tick`; back at
    the origin when the session ends). On a screen plain stereo
    (`{ pan: -1 .. 1 }`; page buttons are panned a little by where they sit).
  - It ducks under the narration: -9 dB (down with a 0.14 s time constant, back
    with 0.5 s) while `HOST.audio.speaking()` (the narration sounding through
    either engine, also a slideshow stop's tail). The backgrounds duck too.
  - At most 16 voices: a new one past that cuts the one quietest now (its level
    times what is left of it; the oldest of equals) in 25 ms. Each sound has a
    minimum gap (the hover tick 70 ms, notices 0.6 s); `{ force: true }` skips
    it (Arrange all's thunks, Try them, the tests). A soft-clip curve at the
    output is exactly level below 0.6 of full scale. `play(name, o)` also takes
    `pitch` (a frequency factor), `dur` (a texture's or a sweep's length, s) and
    `n` (a count: the ratchet's clicks; `rise` makes each a little higher); a
    name it does not know plays nothing (an older shell, a newer story).
  - Continuous sounds (`HOST.sfx.drone(id, name, o)`, `DRONES`: `vacuum` only): kept going while asked for every frame (at least every 250 ms),
    `o: { at, pan, gain, pitch }` followed smoothly (0.08 s); faded in over
    0.3 s, out over 0.4 s once not asked for 0.3 s (the engine's step), at once
    when the effects go off or silent; at most 4 (a fifth replaces the
    quietest only when it is louder), not counted in the 16 voices; `state().drones` lists them.
    Nothing in a story stops them: it stops asking (a pause, a jump out of the
    span, explore mode, another story); a hot swap keeps the ids
    (`<key>.<n>`), so one running through a swap carries on.
    `SFX_LIB.length(name, o)` is a sound's length from a dry run of its recipe
    on a stand-in context (the cue checker's overlap; renders are sized by it).
  - The two sound switches, each for every story at once, pages and
    headsets alike: **Sound effects** (`HOST.xr.sfx()`, `HOST.xr.setSfx(on)`;
    `HOST.sfx.on()` and `HOST.sfx.set(on)` read and write the same setting
    through the engine's `on`/`set` hooks) and **Narration** (`HOST.xr.voice()`,
    `HOST.xr.setVoice(on)`: off, the narration is silent on both engines,
    `HOST.audio`'s `voiceOff()` in its `sync` and `speaking`, and the story runs
    on its own clock as when muted; the effects and the subtitles go on, nothing
    ducks). Sound effects on by default, and the narration on a page (`narrationOn`, only `'off'` saved keeps it off).
    In a shared room the effects are the room's, for every
    headset and page in it (key `look`, `sfx`, beside the headsets'
    four settings; set by anyone, never refused by either lock; one the room
    never wrote stays each device's own, so a device that turned it off keeps it
    off, and another setting written leaves it out of the key),
    else this device's own (`sfxOn`, only `'off'` saved keeps them off),
    which keeps a room's last value after leaving it,
    as the headsets' settings do. `#sfx=on|off` and `#voice=on|off` in a link (the latter both of this device's own
    narration values, the page's and a headset session's: `HOST.xr.setVoiceOwn`).
  - The narration (on once turned on in a headset; a room-wide switch for every headset, each headset's own choice reset at the lobby). What
    applies (`HOST.xr.voice()`, and why, `HOST.xr.voiceWhy()`: `'room'`, `'own'` or `'mine'`):
    - On a page: in a room the room's (`look`'s `voice`, once written), else `narrationOn`. A page's press (Sound check,
      the Shared dialog) in a room is the room's for everyone (below), outside a room its own.
    - In a headset session outside a room: this headset's own (`xrNarration`), **off by default** and remembered once
      turned on (the menu's *Narration* row, the story panel's button).
    - In a headset session in a room: this headset's own for the room if it changed it there (an override, `{ code, vg,
      on }` kept as `xrNarrRoom`, never written to the room, so it survives a new session in the same room), else the
      room's `voice` when written, else this headset's own (off by default). The override goes when the room's `vg` moves
      on (a press for everyone: every headset follows it at once), when this headset goes to Back to the lobby (walking
      in or *Go in*: where the shell calls the story's `lobby` hook, `HOST.xr.voiceDrop('lobby')`) and when it leaves the
      room (`voiceDrop('leave')`; another room's code drops it too).
    - For everyone (`HOST.xr.setVoiceAll(on)`, `HOST.collab.setVoiceAll(on)`): a write of `look` with `voice` and `vg`
      one more (FORMAT networks-36: an older device writing `look` would drop `vg`), so a press always means "set every
      headset and page here to this". From the headset menu's Circles tab (*Narration for everyone here*: *On for all*
      and *Off for all*, `voiceall:on` and `voiceall:off`, lit by the room's value, with a note) and the page's Shared
      dialog (its Sound row's Narration in a room). Every write of `look` keeps `vg` (`setLook`).
    Rows: the headset's menu (*Sound: on/off*, this headset's mute, then *Sound
    effects: on/off* and *Narration: on/off* side by side under Subtitles and
    Panels, then *Effects volume* with a note: the volume and the narration this headset's own, until the lobby, Sound
    effects the room's), the Circles tab's *Narration for everyone here*,
    the page's Shared dialog (a Sound row under the room's parts, shown in a
    room for everyone there and outside a room for this device) and Sound check
    (Sound effects: on/off, a volume slider, Try them, Narration: on/off). The
    volume (`sfxVolume`, 0 to 1, 0.75 by default, squared as a loudness taper,
    so 75 % is 5 dB down; the menu steps 25, 50, 75, 100 %) is always this
    device's own. The Sound button stays this device's quick mute of
    everything. Never in a story's `collab.state()`. *Try the sound effects* is
    on the menu's Sound check page; Sound check's report has a line for the
    effects (`HOST.sfx.line()`) and says when the narration is switched off.
    Neither switch silences the studio's sound emitters (a scene's own sounds, not effects): they follow only the
    Sound button, this device's mute (the studio's Scene pane and a sound's card say so).
    How a room's switch sounds on a hall of headsets is untested on devices.
  - What plays when (all from the shell): a page button (any `button`, after its
    own handlers): a quiet click, or a switch's on or off sound by its new
    `aria-pressed`, unless the press made a sound of its own (`HOST.sfx.count()`
    moved) or the button has `data-sfx="none"` (the beeps). The headset menu: a
    click, or a switch's sound for a button drawn with `on` (`tog` in its
    region), at the pointer or fingertip; a stick's click or the left hand's
    two pinches opening and closing the menu (open, close, from where it floats;
    not when it opens by itself); pointing at a menu button or a station's ring
    or card, or a fingertip over a new button (hover, a soft tick); the grip
    taking and putting down the menu (grab and drop, at it); grabbing and letting go of a circle (grab,
    drop, at it); a circle placed (place, a soft thunk: Add, Move here, Design
    room here, the map's drag; Arrange all one per spot, along the rows); the
    circles lock and a story's lock (lock, unlock); a notice in front of you
    (notice, from where it shows) and the page's Back-in-room toast; a story
    built (ready, three soft notes, from `HOST.loading.wrap`; not behind the
    Stories screen); walking into a circle (enter, a gentle swell); someone
    joining or leaving the room (join, leave, from where they stand: a newcomer
    a second later, once its presence has come).
  - The background (a bed) of the story on show, chosen from its key, only for two stories: the flock dusk air and distant birds (`dusk`), the
    pass story a deep sea hush with bubbles (`sea`), both as they were. Every
    other story, the design room and the studio have none (`SFX_LIB.bedOf(key)` is `''`), and a new
    story gets none. Each made about -35 LUFS at full
    volume, some 20 dB under the narration (-13 to -16 LUFS), with no energy
    worth the name below 100 Hz (a headset's speakers give little there). Faded
    in over 3 s once the story is built (`HOST.loading.ran`), out over 1.5 s when
    it goes (loading another, the Stories screen on the page or in the headset,
    a headset in a room away from every station), at once (0.3 s) when the page
    or headset is hidden or the effects are turned off. Birds and bubbles are
    scheduled 1.5 s ahead, from the engine's step (every 100 ms, a timer of the
    shell's).
  - The sound board, `tools/sfx.html` (served next to the app), loads `sfx.js`
    directly and runs an engine of its own on its own context (a tool page, not
    the app): every sound with a button and what it is for (the stories' sounds
    with what uses them and their pitch and length), the continuous sounds
    (start, stop, pitch), *A story's sounds* (a story's whole sound track: its
    cues read from the app in a hidden frame, rendered a minute at a time with
    its background, its continuous sounds and its narration where it has a
    recording, played with a seek bar, its cue list beside it), the two
    backgrounds (the flock's and the pass story's), a 3D demo (a sound circling your head through the HRTF panner;
    headphones), the ducking demo (seven seconds of the airports' narration over
    the flock's background and clicks) and the voice limit. `node tools/sfx-render.mjs
    [url] [out folder]` renders each in headless Chromium through an
    `OfflineAudioContext` (the same graph), converts them with ffmpeg to MP3
    (44.1 kHz; mono for the interface and room sounds, stereo for the stories'
    sounds, the continuous ones, the backgrounds and demos), writes `sfx-all.mp3`
    (everything with 1.5 s of silence between) with its index `sfx-all.txt`,
    `sfx2-all.mp3` and `sfx2-all.txt` (phase 2 alone: the stories' sounds, a few
    examples of their use, the continuous sounds), and `levels.txt` (sample and
    true peak, the loudest 400 ms, and for the backgrounds the integrated
    loudness, beside the narration's; a story sound out of its range flagged).
    `--story <keys|all>` renders a story's whole track instead,
    `story-<key>.mp3` with its cue list `story-<key>.txt` (m:ss, chapter, sound,
    options, where), at the default volume (75 %), the effects 9 dB under a
    recorded narration as in the app (live and explore sounds are not in it).
    The levels are the app's at full effects volume, one gain for all: the
    shell's sounds -30 to -45 LUFS (loudest 400 ms), the stories' accents about
    -27 (`STORY` in `sfx.js`, +3 dB over their recipes, one knob for all of
    them), their short ones by their peak (-9 to -15 dBFS), the backgrounds -35
    integrated, the narration -13 to -16. Whether they sound good, and how loud
    they are on a headset, can only be judged by ear.
  - Sounds inside the stories (phase 2; every story, the design room and the studio keep
    the same lines, the flock's `packages/flock/src/engine/` and the airports' the
    references): the story's cues are set beside its keys in `buildStory`,
    `sfxCue(t, name, set, at, o)` (story time; a set and one of its anchors, or
    for the hand-written three an item: an airport, a protein, a copy or an
    organelle; `o` play's options and `seq: true` for a marked sequence), and
    spans of a continuous sound `sfxHold(t0, t1, name, set, at, o)`. The block
    after the slideshow block (`SFXQ`, `sfxCue`, `sfxHold`, `sfxN`, `sfxWhere`,
    `sfxPlay`, `sfxHidden`, `sfxAct`, `sfxStep`; `sfxPos` after it, identical in
    every built engine) plays a cue as the clock crosses it while the story
    plays, by the slideshow's crossing rule (`SLIDE.from`, set in `slideStep`):
    so every device at a station plays the same cues at the same moment off the
    station's clock, none on a jump, a scrub, a slideshow stop's seek or a late
    joiner's start, a cue at most 1.5 s late (the narration's clock leaps ahead
    as it starts after a jump) and never twice (`SFXQ.hi`). `frame()` keeps
    `was` (playing as the frame began) and calls `sfxStep(was, dt)` right after
    `slideStep`. A sound comes from its place (`sfxWhere`: the scene's
    coordinates, an HRTF panner in a headset; on a screen a pan by where it
    shows). Explore and headset actions call `sfxAct` (explore mode only, and
    only while the story shows: a room's state applied while the story plays is
    silent) or `sfxPlay` where the story already handles them: a pick `pick`, a
    result `ping`, a scene change `whoosh`, a knockout or closure `knock`
    (undone: `rise`), a shuffle or a cut `snap`, a simulation started `pulse`, a
    slider crossing a named stop `step`. The headset's story panels: a soft
    `click` at the button on a press that made no sound of its own (`xrRelease`),
    a `hover` tick as the ray comes onto a button (`xrPoint`); page buttons
    click through the shell as before. The live simulations (the flock, the
    robots, the pass story's fish) define `sfxLive(dt)`, which the block calls
    every frame while the story shows: they poll what happens (a falcon or a
    shark starting, crumbs, a robot's bump), so what another device sends sounds
    too. Nothing goes into `collab.state()`, no effect, no `FORMAT` change; an
    older shell (no `HOST.sfx`, no `drone`, a name it does not know) plays
    nothing and nothing throws. `SFXQ.log` keeps what was asked for (`[name,
    APP.t, mode]`, hover ticks aside), also before a tap: the tests read it.
    Rules for cue tables: a cue 0.2 to 0.5 s before the line it belongs to (the
    sound announces, the voice follows) or in the pause after it; a chapter's
    opening cue in the 0.6 s before its heading; textures under speech at gain
    0.3 to 0.45; no two cues of one sound closer than its gap; at most 4 onsets
    in any 3 s unless marked `seq`; at most 6 cue voices at once
    (`node tools/sfx-cues.mjs [url] [keys|all]` checks all of it in seconds,
    and prints each story's busiest moment). About one story sound every 12 to
    25 s, short sequences (a path's hops, a circuit's gates) and soft textures
    under the voice. The story sounds (each reused across stories; their
    descriptions and uses are in `sfx.js` and on the sound board): `grow` (a
    network growing: glassy grains thickening and rising), `link` (a link
    snapping on), `snap` (a link breaking), `whoosh` (air sweeping up or down:
    flights, scene changes), `bubble`, `pick`, `ping` (a result: two notes up a
    fifth), `step` (one step of a sequence), `rise` (a reveal: a chord swelling
    and rising a fourth), `knock` (a closure, a knockout; a robot's bump),
    `heart`, `flutter` (wings), `rush` (water, flows), `patter` (many small
    things landing), `spark` (an impulse), `pulse` (a signal spreading), `clink`
    (glass), `ratchet` (a mechanism turning); the spaceships' (kind `game`, at the shell's levels, in `ORDER` after
    the room's: `zap`, `zapLow` (a drone's), `shieldHit`, `hullHit`, `boost`, `boom`, `bump`, `launch`, `land`, `respawn`,
    `pickup`, `pickupEnd`; no engine sound: the owner's rule, no hums unless asked); continuous `vacuum` (a robot
    vacuum, its pitch its speed; the only one since the machines' hum went). How
    they sound in a story, on a Quest's speakers, through HRTF, and with ten
    headsets at one station (open-ear speakers may let neighbours hear a slight
    flam) is unheard and untested until tried.

## Real-world occlusion (`HOST.occlusion`, `occlusion.js`)

In an AR session (passthrough) real things hide what stands behind them, as they would a real object (on by default, the owner's choice). The way it is done was
proven on a Quest 3 (Quest Browser 154) with the room test page (`room-test/`), whose depth pass, reading, `ready`,
probe, `roomSync` and `shapeSig` it reuses.

- **The request.** `HOST.xr.request(mode)` (in `HOST.xr`, `index.html`): VR exactly as before (`{ optionalFeatures:
  HOST.xr.features(mode) }`, its ladder kept); AR adds `depth-sensing` to the optional features with `depthSensing: {
  usagePreference: ['gpu-optimized', 'cpu-optimized'], dataFormatPreference: ['unsigned-short', 'luminance-alpha',
  'float32'], matchDepthView: true }`, and the room test's ladder: a `TypeError` naming one of those values (a browser
  that does not know `'unsigned-short'`) asks again without it, any other refusal asks again without depth at all. With
  `extra.drop` (a phone's menu button) what `extra` asks for is dropped first, at once, depth kept (the person's or the
  browser's own refusal, `NotAllowedError` or `SecurityError`, is thrown at once then).
- **The setting.** `HOST.occlusion.own()`, `set(m)`, `next(m)`, `mode()`: `'both'` (the default: room and people),
  `'room'`, `'depth'` (people, hands, anything moving) or `'off'`; this headset's own (`xrOccl` in `localStorage`,
  `#occl=both|room|depth|off` in a link), never a room's, never in `collab.state()` (no `FORMAT` change). The menu's
  Settings row *Real world hides: room and people* -> *room* -> *people* -> *nothing* (each press the next) with a note.
  A story may ask for its own (`HOST.occlusion.scene(mode)`, also `true` for `'both'` and `false` for `'off'`; `null`
  gives the headset's own back): the studio, for a scene that says always or never; cleared when the story changes
  (`detach`, from `HOST.teardown`), and the menu's note says so while it holds.
- **Each frame.** `HOST.loading.wrap` wraps the story's frame function in `HOST.occlusion.wrap` (inside `HOST.perf`'s, so
  the read-out counts it): before the story draws, in an AR session with the story built (`collab.scene()`), its
  objects (`O.root`, a `THREE.Group` with `renderOrder` -1e9, so its group order puts them before everything of the
  story's) are hung in the story's scene (its root is the renderer's reference space), taken out in `HOST.teardown`
  before the story is disposed and hung in the next story's on its first frame, so they survive a story change in a
  session. Nothing at all happens outside an AR session or on a frame with no `XRFrame` (three.js r128 also runs the
  loop on the window's frames).
- **Depth (people).** Each frame, for each view, `XRWebGLBinding.getDepthInformation(view)` (CPU depth, a phone's:
  `frame.getDepthInformation(view)`, uploaded as metres). A full-view quad drawn first (opaque, `renderOrder` -2 in the
  group, `depthFunc` Always, no colour, not culled) writes each eye's real depth as `gl_FragDepth` with that eye's
  projection (`onBeforeRender` per eye: three.js's left camera is on layer 1, its right on 2), the session's texture
  handed to three.js as an external texture (a stand-in whose `__webglTexture` is the session's), set to nearest every
  frame; an eye without depth that frame gets a texture of zeros (unoccluded). Readings: window (a depth buffer's value
  for the depth's own near and far: `near / (1 - v)` with no far plane, as a Quest 3 gives it; the usual formula for a
  finite far) or metres (the value times `rawValueToMeters`, through `normDepthBufferFromNormView`): window until the
  probe has looked when the depth gives its own range, else metres; the probe (the room test's auto reading: a 16 x 16
  grid of raw values read back, a few times at most a session until it has values, an integer texture refused by a
  float sampler tried with an integer one) decides once (again after a renew: "After a sleep" below). The depth's own view is taken as the eye's (on the Quest it
  matched to 0 cm and 0.03 degrees). Depth sensing runs for the whole AR session, whatever the setting, never paused: a Quest whose depth was paused from the session's first frame (the setting at *nothing*) never gave it back when the setting was turned on again.
- **Room.** `frame.detectedPlanes` and `detectedMeshes` (when the session enabled them) drawn depth-only in the story's
  scene, each part posed every frame by `frame.getPose(its space, renderer.xr.getReferenceSpace())`, built again only
  when its shape really changes (`shapeSig`: a plane by its corners, a mesh by its sizes and a sample of its values,
  the same arrays as last time taken as the same; a Quest 3 marked them changed about 56 times a second with nothing
  changed), the old drawing kept until the new one is built, at most two built a frame.
- **After a sleep.** Nothing is decided only once a session (the binding, the depth's kind and reading, the probe): depth that stops coming, calls that throw and room parts with no pose are asked for again. The likeliest cause, as with anchors not tracked after standby: after a long sleep the headset's runtime
  stops, or starts again, its depth and its room scan. So `renew(why)` asks again for what the session gave: the depth's
  state dropped as the session's end drops it, a new `XRWebGLBinding`, its kind (`D.kind`), reading (`S.decided`) and
  probe (count and time) decided afresh, `session.resumeDepthSensing()` where the session has it and `depthActive` is
  not true (false, or not given), and every room part dropped, so they are built again from what the frame lists now.
  It never pauses depth. What asks:
  - the session visible again after hidden for at least 10 s (its own `visibilitychange` listener, added with
    `HOST.quiet` as the session begins and removed as it ends; a short hide, the system menu, changes nothing): at once
    on the next frame, and the watchdog's tries start afresh;
  - the watchdog, only while the session is visible and only for what the mode uses: depth that had come, wanted, the
    views there, but none for 1.5 s; `getDepthInformation` throwing on 30 frames in a row (from the start too); room
    parts there, none of them posed for 2 s (the room only); its first try at least 10 s after the last ask (at once when there
    was none), each next one twice as long after (20, 40, 80 ... s), at most 6 after the session's start, a sleep or the last time it was back
    steadily for 10 s with no gap of a second (`steady`: so a long session's few hiccups, each brought back, never use up
    the cap; the gap since the last ask stays; the depth and the room each their own), and frames that stopped coming for over 5 s (the next story building) counting afresh. Past the sixth
    the Debug tab's *Real world* line says *depth stopped N s ago: leave AR and enter again* (or that the room scan
    stopped), and one notice a session (*People no longer hide things*, *The room no longer hides things*, through
    `HOST.collab.notice`; none for depth that never came). Depth that comes back by itself is drawn again and the line
    plain again;
  - the depth's shape changing (its `textureType`, the session's `depthDataFormat`, whether it gives its own range, its
    `rawValueToMeters`) from what the kind was decided on: decided afresh at once (`redecide`: the stand-ins of the old
    kind forgotten, the reading and the probe again), no new binding.
  Logged through `HOST.collab.log` (so a headset's log in a room carries them to the relay): `occlusion renew` (`why`:
  `wake`, `depth lost`, `depth throws`, `room` or `shape`; `depthActive`, frames asked and with depth, errors and the
  last one, ms since the last depth, how long it was hidden, the tries so far, the room's parts and those posed),
  `occlusion back` (the depth or the room back after it, and how long that took), `occlusion room` (the parts posed going
  to or from none), `occlusion steady` (back steadily, its tries started afresh: how many there were), `occlusion gave up`, and the shell's `webgl context lost` and `webgl context restored`. Every
  alignment sample (`sample()` in `shared.js`, every 5 s in a room) carries `occl`: `{ m, u, f, k, r, a, n, v, ago, e,
  pl, me, po, rn, rr }` (the mode, the depth's usage, format, kind and reading, `depthActive`, frames asked and with
  depth, ms since the last depth (-1 none yet), errors, planes, meshes, parts posed, renews of the depth and of the
  room). A lost WebGL context (`webglcontextlost` and `webglcontextrestored` on the renderer's canvas, listeners added in
  `makeRenderer` with `HOST.quiet`): nothing drawn while lost; restored, occlusion forgets its own GL objects (the probe's
  programs, its quad and framebuffer, the zero textures) and ends its part of the session, so the next frame begins anew
  (three.js makes its own again). The headset's layer itself would need the session started again: leaving AR and
  entering again (untested).
- **A little behind.** A thing must be a little further than a real surface to be hidden by it (`BIAS`: 4 cm for the
  depth, which is noisier, 2 cm for the room, each along the view), so a robot's trail on the floor, a line along a
  wall's foot, a studio model standing on the floor or a button under a fingertip is not hidden by what it stands on.
- **What it hides.** Everything depth-tested drawn after it: the scenes, cards in 3D (the story panels, station cards,
  name tags), the circles' rings and icons. Never: what is drawn over everything (`depthTest` false: the menu, the
  notices, the subtitles, the frame-rate read-out, labels and cards set on top, the loading card, the calibration
  crosses).
- For tests and the Debug tab: `HOST.occlusion.state()` (the mode, the session's depth: usage, format, kind, shape,
  reading, eyes, the probe; the room's parts; `lastDepthAt`, `hiddenAt`, `hidLast`, `renews`, `roomRenews`,
  `redecides`, `resumes`, `bindings`, `posed`, `depthActive`, `tries`, `gaveUp`, `told`, `lost`, `restored` and `gl`, our own GL objects), `line()` (the Debug tab's *Real world* line), `sample()` (the samples' `occl`),
  `times({ wake, lost, room, every, cap, throws })` (the times above shortened for tests, as `eyeTimes` and `guideTimes`;
  `null` the defaults), `lost()` and `restored()` (the shell's), `parts()`, `sig()`.
- **Merged room**: the room's planes and meshes are drawn as ONE depth-only mesh in reference-space coordinates (a scan of
  40 planes was 80 draws and 40 uniform sets a frame), each part's geometry kept in its own space and transformed by its pose
  into one growing buffer; it is made again at once when a shape, a part or whether a part has a pose changes, and otherwise at
  most four times a second when a pose moved by over 1 mm (`POSE_TOL`: a scanned space's poses refine all the time), sending
  only the used range. Test it with `OCCL_FAKE` (`--only occlusion`).
- **Untested on a headset**: all of it on a real Quest in the app (the room test page proved the depth pass and the
  room there, not this code in the stories), how the 4 cm and 2 cm read (people's edges, hands near panels, things on
  the floor), the cost with a big room scan and depth together in a heavy story, depth sensing left running while the setting is *nothing*,
  CPU depth on a phone (Android's Chrome), a browser that refuses depth sensing (the ladder), the studio's override.
  After a sleep, only a Quest 3 or 3S can show: whether `resumeDepthSensing` or a new binding brings the depth
  back after a real long sleep (or neither: leaving AR and entering again stays the proven remedy), whether the room's
  planes come back with poses or as a new set, whether a Quest says `depthActive` false then, whether its depth's shape
  changes, how often the watchdog asks on a real headset (the logs will say: `occlusion renew`, `occlusion back`, the
  samples' `occl`), and a lost WebGL context in a session.

## The developer notebook (`HOST.notes`, `notes.js`)

Spoken notes recorded in AR or VR (B or Y held), transcribed, with screenshots; notes from a phone or laptop too, and a notes page to listen through and delete. The contract is
`tools/notes/SPEC.md`; what follows is the outline.

- Developer mode only (`HOST.dev.on()`): off, nothing shows and holding B or Y does nothing.
- In a headset: B or Y held for 0.45 s records (`sticks` in `shared.js` hands the hold to `HOST.notes`; a press that
  became a hold never counts towards the double press that toggles the frame rate), let go sends; at most 5 minutes. A
  read-out fixed to the head (`drawRec`, `OV.rec`), and every `selectstart` while recording a numbered pin where the ray
  points, with what was there (the shell's hover, the story's panel, or a raycast of the story's scene), the press still
  doing what it does. A held controller that goes, the session's end or developer mode off stops and sends it
  (`heldCheck`).
- On a page: the round button at the bottom right (`#noteBtn`), press to record and again to send, Esc to cancel; every
  pointer press meanwhile a pin with the element under it.
- Two pictures, as it begins and ends, read back right after the story's frame (`HOST.notes.frame`, the outermost wrapper
  in `HOST.loading.wrap`): in a session the layer's framebuffer, the left eye; on a page the canvas. In AR they show
  only what the app draws.
- The microphone: `getUserMedia` as B or Y goes down, kept 60 s after a note; `MediaRecorder`; no `AudioContext` of its
  own (a level meter is an analyser on `HOST.audio.fx()`).
- The context: the release, the story, its mode, clock and `collab.state()`, the studio's scene and selection, the room,
  station and line-up, the settings, the frame rate, the last 60 log lines (the relay's password stripped).
- Sent to the relay (`POST /api/notes`, the password as every relay call, a `nonce` the relay dedupes on); failing that
  kept in an IndexedDB outbox (`networks-notes`, at most 20) and sent again later.
- The relay (`relay/notes.mjs`): notes on wherever it keeps scenes (`<scenes>/.notes/`, or `R2_PREFIX + '.notes/'` in
  R2, skipped by the scenes' listing), `--notes <dir>`, `--no-notes`; `/api/ping` says `notes: true`; `GET /notes` is
  the notes page (`notes/index.html`).
- A Claude session reads them: `NOTES_TOKEN=... node tools/notes/notes.mjs list|pull|transcribe|done` (transcribe:
  faster-whisper through `tools/notes/transcribe.py`, the transcript written back to the note).
- Nothing of a note is in the repository, a room's keys or `collab.state()` (no `FORMAT` change).
- Tests: `node relay/test.mjs --notes`. Untested on a headset: all of it (the microphone in a session, the framebuffer
  read, holding B or Y, pins, the read-out), an iPhone's recording, the page on a phone.

### Run logs (*Record a run*)

- Developer mode only: the Debug tab's *Record a run: on/off* (under *What is new* and *Notes*; `runlog`, its line from
  `HOST.notes.runState()`, redrawn through `HOST.notes.runSig()` in `panelSig`) and on a page `#runBtn` over the note
  button. `HOST.notes.run(on)`, `running()`, `runState()`, `runRows()`, `runTest({ part, tick })`.
- While on, `HOST.notes.frame(t)` takes every frame's interval and `HOST.perf.last()` (the story's script ms, triangles,
  draw calls, points; `HOST.perf` measures while a run is on, on a page too, and calls `aqStory` only in a session); a
  row a second (`RUN_COLS`), events for the story, mode, chapter, quality, session, visibility; parts to the relay's
  `/api/logs` every 30 s, on hidden and on stop. Its listeners are the shell's (`quiet`); nothing in `collab.state()`.
- The contract, the format and the endpoints: `tools/notes/SPEC.md`, "Run logs"; `node tools/notes/notes.mjs perf <id>`
  reads one. Tests: `node relay/test.mjs --logs`. Untested on a headset: all of it.

### Reading notes in a headset (v148)

- The Debug tab's *Notes* (developer mode only, beside *What is new*) opens `PNL.page = 'notes'`, a page in place of the
  rest of the tab as *What is new* is (`notesPage` in `shared.js`; state `NB`, redrawn through `notesSig()` in
  `panelSig`). *Back* returns to the Debug tab.
- The list: *New* / *Done* / *All* (this headset's own, `localStorage` `xrNotesFilter`) and *Refresh*; each note a row
  (when, length, pins, new or done, the transcript's first line or *Not transcribed yet*, story and release) in a view of a
  fixed height that scrolls by *Up* and *More* or the stick (`newsStick` serves both pages, `notesScroll`). Since v183
  (the owner, 22 November 2026, as on the notes page) a row in full view has *Mark done* / *Mark new* and *Delete*
  (*Press again* within 3 s) at its bottom right, over the row (drawn after it, so a press there is theirs; the rest of
  the row still opens the note): `notesMark(id)`, `notesDelete(id)`; and under the filters *Mark all done (n)* marks
  every new note the list shows done after a second press within 3 s (`notesMarkAll`, `NB.arm = '*all'`).
- A note pressed: its two pictures drawn into the menu's canvas (fetched as blobs, `createImageBitmap`, `drawImage`),
  *Play* / *Stop*, *Mark done* / *Mark new*, *Delete* (*Press again* within 3 s), its transcript by segment and its pins
  in a view that scrolls, *Back to the list*.
- The relay's API as the notes page uses it, through `relayFind` (the relay and its password, a Bearer header; never
  logged, kept or put in an address) and `relaySaw` (a 401 brings up the shell's password prompts). One line says how it
  goes: no relay, the relay wants its password (Circles' *Relay password*, the Shared dialog or the notes page), fetching,
  or the error.
- Playing: a plain `<audio>` element on an object URL of the recording (no `AudioContext`; `HOST.audio`'s own element is
  the narration's and stays so), muted while the Sound button is. Stopped by *Stop*, *Back*, the page going (another tab,
  the menu closed: `notesStep` every frame), the session's end (`watch`) and a note starting to record. Leaving the page
  revokes the object URL and closes the pictures (`notesClose`, `notesRelease`).
- Nothing of it in a room's keys or `collab.state()`. Tests: `HOST.collab.notesView()`, `HOST.collab.notesOpen()`.
  Untested on a headset: all of it (the stick, playing inside a session, the pictures' look in the menu).

## Spaceships (`HOST.ships`, `ships.js`)

A spaceship mini-game in headsets, the shell's own, not a story: it flies over every story and every circle, alone or in a shared room. The game is our own (no existing game's names,
ships or look).

- **Launch and land.** The right stick clicked twice within 0.4 s (`sticks` in `shared.js`, `shipPress`; the left stick's
  double click is moving with the sticks, a single click of either and both at once the menu as before), or the menu's
  *Spaceship: launch* / *land* row (Settings, under Moving with the sticks); landed again the same way, by the menu's
  Exit and by the session's end. Only in an immersive session (VR or AR) with a tracked controller with a gamepad as the
  right input source; never in camera mode or a phone's AR (`whyNot`: a tracked hand there is told *It needs a controller
  in your right hand*, the row greyed with the reason). The notices say what happens (launch: the controls in a line).
  It acts at the ship's next frame (`toggle`, `S.want`). A story change keeps it flying: its objects hang in the story's
  scene and are taken out before a story is disposed (`HOST.teardown`, `HOST.ships.detach`), as occlusion's are. While a ship flies its right stick steers and is pushed hard, so a press of it counts as a click (the menu's, both at
  once, the double click that lands) only with the stick within 0.5 of its middle as it goes down (`SHIPCLK` in
  `sticks`); pushed further it is a steer that clicked and counts for nothing (log `ship stick click ignored`, at most once
  a second), leaving nothing half counted. Not flying, while it is down (`HOST.ships.down()`: destroyed, the new ship to
  come) and the left stick always, as before.
- **Each frame.** `index.html`'s moving with the sticks hooks the session's own `requestAnimationFrame`; once a frame,
  after it has dressed the frame (so the poses are three.js's), it calls `HOST.ships.frame(s, t, f)`, before any callback
  draws. The ship's clocks are that frame's time (ms) and the relay's (`now()`; for tests the frame's: `testClock`).
- **Steering: the right thumbstick** (`stick(x, y)`, `axes(gp)`, its numbers `STICK` and `STEER`, to be tuned on a Quest): the right
  controller's stick (xr-standard's `axes[2]` and `axes[3]`, a pad with two axes its 0 and 1), each axis on its own: a
  dead zone of 0.15, past it the push's share to the power 1.5 (fine near the middle, full at the edge). Pushed right it
  turns right about the vertical (full: 140 degrees a second, round as often as you like), pushed forward (away from you,
  `axes[3]` -1) it dives and pulled back it climbs (full: 60 degrees, the flight pitch eased with 0.25 s; no loops: the owner's rule), as a flight simulator's stick; released, level flight. The ship banks into its turns (up to 50 degrees, eased), which does not change its path. How the controller is held, tilted or pointed counts for nothing (an old Steering setting, `xrShipSteer`, is removed from `localStorage` as `ships.js` loads).
  The launch notice and the Spaceship row's note say how (`steerWords()`).
- **Speed** (`FLY`): always forward at 1.2 m/s; the right grip (`buttons[1].value`) brakes, below 0.9 to 1.2 x (1 - 0.8 g),
  from 0.9 slowly backwards (-0.5 m/s); at most 2.5 m/s2. A (`buttons[4]`, its rising edge; nothing else of the shell or
  any story reads it) boosts when its meter is full: 3.2 m/s at once for 0.8 s, then it recharges for 4 s; braking ends
  a boost.
- **The arena** (`ARENA`): no edge along the floor (the owner's: unlimited range, enemies following; real walls never block): a ship flies anywhere, from 0.15 to 3 m above the floor (in a room the room's
  floor, room coordinates; outside a room the session's own `local-floor`, else the head's height less 1.6 m, taken at
  launch), and at that floor and ceiling it is held, level, until steered away. Nothing real stops it: in AR the room scan's planes do not bounce it (the `bump` sound stays in `sfx.js`, unused). Ships pass
  through each other and through people. A new ship stands 0.5 m ahead of the right controller along the head's level
  forward, at its height (held between the floor and the ceiling), flying where the head faces, level.
- **Shooting** (`GUN`): the right trigger held fires bolts from the nose along its heading, at most 5 a second (exactly:
  each an interval after the last), at 8 m/s plus the ship's speed, each living 1.25 s, damage 20; small bright elongated
  bolts in the shooter's colour (drones' red), all in one instanced draw.
- **Shield and health** (`HP`): every ship 100 of each. Damage takes the shield first, what is left the health. The shield
  refills from 2 s after the last hit at 25 a second; health never does. At 0 health it explodes (a burst for about 0.8 s
  and a boom); its pilot sees *Destroyed by <name>* (or *by a drone*) and a countdown on its strip; 5 s later a new ship
  at the controller, full. A hit flashes a ring round it (the shield) or sparks (the hull) and
  buzzes the right controller (0.4, 60 ms).
- **Targets, drones and pickups: one shared set, fought together.** 3 targets (slowly drifting glowing crystals, health 40,
  no shield) and drones (another, darker, angular design with red edges and eye; shield 30, health 60): 2 while one pilot
  flies, one more for each further pilot, at most 5. Drones wander at 0.9 m/s, now and then turn towards the nearest
  pilot's ship, and fire a bolt (6 m/s, damage 10) every 1.5 s while a ship is within 4 m and within 20 degrees ahead.
  A destroyed one comes back 8 s later at the set's edge. They stay when more pilots join: everyone shoots the same
  ones, and a destruction is credited to the pilot whose bolt did it. They live within 5 m of the set's middle (`w.c`,
  carried with the set), which follows the flying ships: the leader eases it towards their mean place along the
  floor (a time constant of 1.5 s, at most 3.5 m/s, `ARENA.follow` and `move`; not while frozen for tests), so the
  targets, drones and pickups come along wherever the pilots fly. The targets turn back at its edge and, left behind past
  it, are pulled after it (up to 3.5 m/s); the drones head back to it there and fly faster the further out they are (up to
  3.5 m/s); a new drone or target comes at its edge and a pickup within it. Pickups: one every 15 to 30 s (at random) at a free spot, at most 2 at once, each there
  for 25 s and then gone (shrinking over its last 2 s); a small opaque token turning slowly, each kind its own shape and
  colour: *boost* (an amber chevron: for 15 s the boost recharges in 1 s and lasts 1.2 s), *rapid fire* (a red double
  pyramid: for 12 s 10 shots a second, the same damage), *reinforced shield* (a blue hexagon: +50 on top of the shield, up
  to 150, used first, never refilled, until used up). Taken by flying through it (within 0.25 m of the ship's middle);
  a chime as it is taken and another as it runs out; one of a kind again starts its time again, never piling up. The
  strip says what is on and its time left.
- **The leader.** One per room among the pilots flying (alone or outside a room: this headset): the one flying longest
  (its launch time, as its presence says, the relay's; ties by member id), the same on every device (`pilots`, `leadStep`).
  The leader's headset moves the targets, drones and pickups, fires the drones' bolts, decides every hit on a target or
  drone (anyone's bolts may hit them) and who takes a pickup, and sends the set in its presence. When it lands, leaves or
  is silent for 2 s, the next by the same rule takes over from what it has been drawing (`takeOver`: their places,
  headings, shield and health, the pickups and their times, absolute in the relay's time), so nothing jumps or is born
  again; with nobody flying the set goes, and starts afresh with the next launch. A pickup: the pilot's own headset sees
  its exact ship touch it and sends a claim; the leader gives it to the first claim it receives (its own included) and
  says so to everyone; it goes for everyone and the winner's headset starts it. While a claim waits it is hidden for that
  pilot alone, and shows again after 1 s if it is still there.
- **Shared, and who decides.** The owner decides: each headset its own ship, the leader the shared set.
  - Poses: the ship (and, from the leader, the set: targets, drones, pickups with their times) ride in this headset's
    presence as one field, `sh` (`out()`: `{ lt, p, q, v, s, x, h, b, dn, w }`, positions to the mm, turns to 4 decimals,
    shield, extra and health as integers, the boost meter, `dn` the relay's time it was destroyed; `w` the leader's set),
    15 a second with presence's `ts`, so no extra messages; a presence without it has landed. Every other device draws
    them by snapshot interpolation as people's heads are (`SMOOTH.DELAY`, 120 ms, behind the relay's time, between
    samples, at most 100 ms carried on past the last; gone 2 s after the last). A camera's presence carries none.
  - Bolts, hits, destructions, claims and gifts: quiet effects on one room-wide key the shell keeps for itself, `ships`
    (the relay's `KEY` rule; `shared.js`'s `onFx` hands it to `HOST.ships.fxIn` with the relay's `by`; older shells drop
    a key they do not know, and only `e.<station>` ever reaches a story's effect hook), batched at most 20 a second
    (`NET.flush`, 50 ms: with presence's 15 a member sends at most 35 a second, under the relay's 60, the leader with five
    drones and rapid fire too). A bolt's data is its start, direction, speed, the relay's time and its number (a drone's
    its id), so every device draws it along the same line. Each frame a headset sweeps every live bolt between last
    frame's and this frame's places against its own ship (exact, a sphere of 0.18 m; one heard late swept from its start
    against where the ship was meanwhile, its last 0.6 s kept); the leader also against the targets and drones. A ship's
    own bolts never hit it; drones' hit ships only. A hit goes out (what, by whom, the bolt, the new shield and health),
    and so does a destruction; every device shows the flash and the bars from it. A hit marks its bolt spent everywhere,
    but a hit on a drone or a target only from the leader (or a hit on a ship): a device that missed the leader's presence
    for 2 s (Wi-Fi, the system menu) leads its own copy for that moment and says its hits, and the leader, which never
    takes them, still sweeps that bolt itself, so it counts there. A pickup given goes
    from whatever set a headset holds, its own copy of that moment too. A
    pilot heard is stamped with the page's clock, not the frame's, so a headset whose frames paused (its system menu) does not take everyone for gone on its first frame back.
  - Kills: each device counts, from the destructions it hears, per member the ships and the drones and targets destroyed
    since it joined.
  - Nothing stored: no room key, no `FORMAT` change. Peer to peer and a room on this device the same (the Hub passes
    presence and effects).
  - Who sees: every headset in the room every ship, drone, target and bolt, at any circle and whatever its People setting
    (ships are not people), a camera too; pages draw nothing in 3D, and the Shared dialog's people list says *flying a
    ship (shield 80, health 100)* and what each destroyed (redrawn at once when a ship goes down, at most once a second
    for its bars, which the shield's refill changes in nearly every presence). In a room everything is in room
    coordinates (the root hangs at the room's matrix); a headset elsewhere flies in the same room coordinates as its
    avatar; outside a room the renderer's space moved down to the floor. A headset in a room that is not lined up yet
    plays alone in its own frame and takes no one's ships or effects (`offRoom`: they are in room coordinates) until it
    is; a page keeps the ships for its people list (gone 2 s after their last presence, by a timer: a page has no
    frames), but no bolts, and plays none of the game's sounds.
- **The right controller while flying** belongs to the ship. `HOST.inputsGuard.claim(fn)` (`index.html`): the guard's
  listeners, the first on the session, hear its select and squeeze events as ever (so none counts as missed) and stop
  them, so they reach neither three.js (the story) nor the shell's other listeners (the menu, a station's grip); nothing
  is given again for it; but a press whose start reached three.js and the shell before the claim (the trigger or grip
  that launched the ship) gets its end through (`pass`), so the story's controller is not left pressed or holding.
  `HOST.collab.ray` answers for its ray as the shell's, at the controller with nothing to press and
  a distance of 0 (as a camera's), so the story draws no line and it is not sent to the others. The right stick's turn of
  moving with the sticks rests (`index.html`; and the studio's own right stick), and so does the stories' explore
  spin and zoom on that stick (the same line in every story's `xrPoint`, `!(HOST.ships && HOST.ships.claims(c.src))`
  beside `xrWalking()`); the left stick still moves you in VR.
  The left hand is unchanged (the menu, panels, its stick).
- **The look.** Nothing large and see-through (for the frame rate): one lit shader in view space (opaque, the
  same in every story whatever its lights), instanced meshes a kind (ships in their pilots' colours, drones, targets, each
  pickup's kind, bolts, the bars), small additive glows (`Points`: engines, drones' eyes, crystals, pickups) and bursts, and the shield's flashing ring:
  each adds its colour and leaves the layer's alpha alone (`ADD`: `CustomBlending`, colour One and One, alpha Zero and One; never three.js's `AdditiveBlending`, which also adds the glow's alpha, so its whole square, black at the corners, goes opaque over the passthrough: a black halo in AR). The
  ship: a low-poly fighter built in code (a pointed hexagonal body, swept wings, two fins leaning out, a dark cockpit, an
  engine glowing at the back), about 0.2 m long, under 300 triangles, its white parts in its pilot's colour. Over every
  ship two thin bars (shield, with the extra lighter over it, and health) and its pilot's name (others'), over drones the
  same bars, over targets their health; small, opaque, turned to you. The pilot's own strip above the right controller
  (shield, hull, boost meter, kills, what is on; the countdown while down), drawn over everything, and when the ship is
  more than 34 degrees from where you look a small arrow near the edge of the view pointing to it (fixed to the head, as
  the frame-rate read-out is). The Debug tab has a *Spaceships* line.
- **Sounds** (`sfx.js`, kind `game`, at the shell's levels, from where they happen through `HOST.sfx.play`'s `at`):
  `zap`, `zapLow` (a drone's), `shieldHit`, `hullHit`, `boost`, `boom`, `bump`, `launch`, `land`, `respawn`, `pickup`,
  `pickupEnd`. No engine sound (the owner's rule: no hums unless asked).
- For tests: `HOST.ships.state()` (flying, down, the frame, the ship's pose, speed, turn, the stick (`stick`), shield, extra, health,
  boost, pickups on, the leader, the drones, targets and pickups as drawn here, live bolts, kills, others' ships, what is
  drawn, `rt` the time drawn at, `setC` the shared set's middle), `launch(on)`, `times({...})` (`null` the defaults), `testClock(on)`, `stick`, `axes`,
  `person(id)`, `line()`, and `debug` (`place`, `freeze`, `drone`, `target`, `pickup`, `next`, `clearPicks`, `hurt`,
  `bolt`, `claim`, `track`, `materials`).
- Performance: while nothing flies the groups are hidden and the frame sends nothing to the GPU (one last pass empties
  every count and clears the tags); instanced meshes send only their used range, and nothing when empty. `sfx.js` makes a long
  texture's grains and a bed's chirps in the engine's 100 ms step (`o.defer`, `later`, at most about 30 nodes a task) instead
  of all at once (70 to 200 nodes in one task); the random numbers are drawn first, in the same order, so a sound is the
  same; a render or a dry run, with no scheduler, makes them at once (`tools/sfx-render.mjs` unchanged).
- Tests: the smoke test's *spaceship* steps and `tools/collab.mjs --ships` ("Testing").
- **Untested on a headset**: how the stick feels and its numbers (its dead zone and curve, 140 degrees a second, 60
  degrees of climb, forward to dive), the glows over a real passthrough, the speeds, the boost, the damage and the times, how the ships, bars, strip and arrow
  read, how smooth others' ships look over Wi-Fi (120 ms behind), how the set following the pilots feels, the buzz, the
  frame cost with eight pilots and five drones (under 1 ms of script a frame is the aim), the sounds (unheard: rendered
  only, `node tools/sfx-render.mjs`).

## A story's copy (arrangements, `HOST.arrange`, v170)

The owner, 18 and 19 November 2026: "a copy button to copy them to the relay and then edit in case this is wanted";
"rearranging and timing etc, no logic". The contract is `tools/engine/SPEC.md`; the story's side (`HOST.cur.arrange`:
`model`, `apply`, `get`) is the shared engine's. The shell's side is `HOST.arrange` in `index.html` (before the boot):

- **A copy** is a scene on the relay (the scenes API, `--scenes`, folder or R2): `<key>-copy`, `<key>-copy-2` ...; its
  `layout.json` is `{ studio: 1, scene, story: <arrangement>, saved, by }` (Save keeps any other field it had), its
  recordings in `sounds/`. The relay needs nothing new. Calls go to the relay the page knows
  (`HOST.collab.relayFind`) with its password as `Authorization: Bearer`, never in an address; what it answered goes to
  `HOST.collab.relaySaw` (a 401 brings up the shell's password prompts).
- **API**: `read(name)` (the arrangement, or throws: status 404 when the scene is no copy), `save(name, A)` (at a station
  running that copy it writes the station's key again, so every device there reads it again), `copy(key)` (the next free
  name, made with `POST /api/scenes` and saved as `{ v: 1, key, made, from: HOST.fp[key] }`), `list(fresh)` (the relay's
  copies `[{ name, key, title, made }]`: only names like `<key>-copy[-n]` are read, kept 10 s), `upload(name, file)` (a
  recording into `sounds/<its name>.mp3`, replaced: an MP3 through `/file` as it is, anything else through `/sound`, the
  relay's ffmpeg; gives the path), `url(name, path)` (a promise of a `blob:` address of the file: on a relay on R2 from
  the signed link its scene's listing gives, with no header, as the studio does, since `/scenes/...` answers there with a
  redirect to the bucket that would drop the header and send `Origin: null`; on a folder's relay from `/scenes/...` with
  the password as a header; the last four kept), `current(key)` (`{ name, A }` the copy this page plays for the story, `A` null while it
  is read or when it could not be; or null), `open(key, name, edit)` (play a copy: at a station of that story the
  station's, else this page's own; `HOST.go(key)` when another story is on show; `edit` opens the editor once it is
  read), `own()` (back to the story's own, the station's too), `isCopy(name)` (a scene `list()` found to hold a story:
  never by its name alone, so a scene named `atelier-copy` stays a scene), `editing()`, `state()` (for tests).
- **Which copy plays**: a page following, or a headset running, a station whose story is on show plays the station's
  copy (`st.<id>.arr`, `HOST.collab.arrOf(id)`; `docs/agents/shared-rooms.md`); otherwise the address's
  (`#<key>&arr=<name>`, this page's own: dropped when another story starts, `HOST.arrange.started` from `HOST.run`).
  Every 300 ms (`tick`) the copy wanted is read when it is not yet (again 15 s after a failure, and when the station's
  `at` moves on: a save made elsewhere; our own save moves the cache's `at` with it) and laid over the story with
  `HOST.cur.arrange.apply(A, name)` (a clone: the story never changes ours; the name: the story fetches the copy's
  recording by it) once the story is built (`HOST.loading.built()`,
  new in v170: its frame loop given), again whenever the copy changes, and `apply(null)` when it goes. A story without
  `arrange` (the airports, proteins, cell map, the studio) plays as its own.
- **The address**: `#<key>&arr=<name>` while a copy plays by the address, `&edit` added while the editor is open or the
  link had it (`tail(key)`, added by `HOST.run`, `HOST.swap` and `HOST.setUrl`); in a room the address stays `#s=XYZ`.
  `&edit` alone shows *Copy to relay* without developer mode. With `&visit` (a visitor's page) `&edit` is ignored and
  neither *Copy to relay* nor *Edit* nor the editor is ever offered, developer mode or not; a copy still plays.
- **The bar** (`#arrBar` after the clock; a page only, hidden on the Stories screen and in a headset session): while a
  copy plays, *Copy: <name>*, *Edit* (when the story has `arrange` and the copy was read) and *Own story*; *Reading the
  copy...*, *Copy not found* (a 404: the story plays as its own) or *Copy not read: <why>*. Otherwise *Copy to relay* on
  a story with `arrange`, in developer mode or with `&edit`, once the relay answered its scenes API with this page's
  password and saves layouts (looked for at most every 30 s, only then): it makes the copy, plays it and opens the editor.
- **The editor** (`#arrEd`, a drawer over the timeline, made once, its listeners added with `HOST.quiet`; a page only:
  under 700 px wide it says it needs a wider screen; `body.arr-ed` lifts the story panel above it, and under 900 px hides
  it). Its lanes are drawn in the story's time as arranged (each chapter at its new length; `geo()`), a drag read back
  into the story's own seconds, and the story seeks there through the narration's timing as arranged (`APP.seek` on the
  timeline's clock, `APP.t`; the playhead from it the same way): the copy's `sync` (or the story's own), and in a chapter
  of a new length its span of the recording scaled by the same factor, as the story's `ARR` lays it out. Lanes: the chapters (drag a chapter's right end for its
  length; click: its length, *Skip it*, *Back to its own length*), the narration's anchors (`sync`), each set's show and
  hide (its `show` track, with its other tracks folded under it), the tracks of no set, the camera, the captions (click:
  the text with its numbers as `{1}`, `{2}` and a preview, *Back to the story's own*), the labels (click: the text), the
  sound cues. Keyframes keep their order (a drag stops at a neighbour). The side: what is selected, *Places* (each set's
  x, y, z, turn and size, typed), *The recording* (*Upload a recording*, *Back to the story's own recording*, *Back to
  the story's own timing*). The head: *Save* (to the relay), *Undo* and *Redo* (this page's, 200 steps), *Unsaved
  changes* / *Saved*, the arranged length; a line for the edits dropped because the story changed: the story's last
  apply, whoever asked for it (the shell's, the load's, the pass story's change of language), read from
  `arrange.dropped()` when the editor opens and every 300 ms. A save of the copy made elsewhere (the station's `at`
  moved on): a clean editor takes it (its Undo starting there, *A newer save of this copy ... is shown*); one with
  unsaved changes keeps them, laid over the story as they are, and says a newer copy was saved elsewhere. A drag is laid
  over the story at most every 120 ms and once more when let go. Leaving the page with unsaved changes asks first.
- **The studio** lists copies apart (*Copies of stories*: *Copy of <title>*, *Open*, which calls `HOST.arrange.open`),
  never among its scenes (a name like `<key>-copy[-n]` waits for `list()`), and its Save keeps a layout's `story`
  (`docs/agents/studio.md`); the room's Add leaves copies out of its "Studio: <scene>" entries (`isCopy`).
- Tests: `node tools/collab.mjs --arr` (not in the main run). Untested: everything in a headset (a copy played at a
  station there, its narration from the copy), and the story's side until its engine has `arrange` (the round then uses
  it instead of its stand-in).

## Hot reload and live updates (`HOST.live`, `HOST.swap`, `tools/release.mjs`, the relay's `--watch`)

The app follows its files while it runs (it is also the ground for a story design room, where a draft story reloads in the
headset as it changes). One path in the shell, `HOST.live` in `index.html`. Story packages (`packages/<key>/`) follow
the same path through their index, read again at every check: `docs/agents/packages.md`.

- **Swapping a story in place** (`HOST.swap(key)`): the story's file fetched
  fresh (past every cache), and only when its fingerprint differs from the one
  running, `HOST.place()` taken (mode, `APP.t` and playing, the explore state by
  the story's own `collab.state()`, its `view()`, whether its headset Stories
  screen is open, the page's Stories screen, the station followed), the old
  story torn down and the new factory run as for any story change (`HOST.run`:
  listeners removed, the renderer and a headset session kept, the headset's
  placement by `xrPose()` and `xrAdopt`), and the place put back by
  `HOST.putPlace` right after the story's start gives the renderer its frame
  loop (`HOST.built`, a microtask: before any other task, such as the shared
  room's pump, sees the new story). The slideshow is the shell's and stays; a
  paused clock right at a chapter's stop waits there again. At a station in a
  shared room nothing is put back: the room's clock, state and view apply as the
  story attaches, as for any story there, and nothing is written to the room
  (the shell publishes a person's play, pause, jumps and mode changes only). A
  file that registers no story (a syntax error mid-edit) is refused and the old
  story runs on, the error in the page's bar.
- **No swap in a headset session unless quiet**: in a session explore mode and a paused story are not quiet moments (a
  swap is a hitch); a swap waits for the Stories screen, being away from every station, the shell's menu open, or the session's end. A loaded story whose newer
  file needs a newer shell keeps its factory (`HOST.live.pinned(key)`), and `HOST.run` drops the factories of stories no
  longer in the list or room (`this.factories` and `loaded` pruned), so old factories no longer pile up in a long session.
- **While developing**: `node relay/server.mjs --static . --watch [--build]`
  (or with `--lan`). `/api/ping` says `watch: true`; `/api/watch` is a stream of
  Server-Sent Events (`hello` with every fingerprint, then `story`, `list`,
  `shell`, `build`; protocol in `relay/README.md`). A story file changed swaps
  in place at once on every page showing it (also mid-chapter) and is fetched
  fresh next time on the others; the list is read again (cards appear or change,
  no reload); a shell file (`index.html`, `sfx.js`, `occlusion.js`, `ships.js`, `shared.js`, `sw.js`, `three.min.js`,
  `peerjs.min.js`, `output.js`) reloads the page with its place kept. `--build` also runs a
  built story's `tools/<key>/build.mjs` when its sources change (the folders its
  build names, `../lbi/` and the like, and the story files it cuts from; not
  `shots/`, `gen/`, `data/`), one build at a time, a moment after the last
  change; a failed build shows in the page's bar. A page served by a watching
  relay does not ask for `version.json`.
- **On the live site** (GitHub Pages from `main`; the test place, branch `dev`, on the owner's Coolify at
  `stories.lab.lbi-netmed.com`, served by its relay): `version.json`,
  written by `node tools/release.mjs` (a release step), is asked for 3 s after
  the start, about once a minute, when the page comes back into view and when a
  new service worker takes over (always the server's: `?t=` and `no-store`, and
  the worker passes it through). It holds `version` (sw.js), `format` (shared.js),
  `shell: { n, id }` (the shell's fingerprint, and the release in which it last
  changed), `list` (the list's fingerprint, over `JSON.stringify(HOST.list)`) and
  per story `{ fp, needs }` (its file's fingerprint and the oldest shell it
  needs: its list entry's `needs`, else the shell of the release that last
  changed it). The page compares with its own stamp (`HOST.shell`, written into
  `index.html` by the same script) and the stories it loaded (`HOST.fp`). Taken
  without asking: a new story's card (`take`; on the page and, through
  `HOST.listRev`, in every story's headset Stories screen), a changed story not
  on show (fetched fresh next time it starts: `HOST.live.stale`), the story on
  show (swapped at a quiet moment: paused, explore mode, a Stories screen, or
  within a second after a chapter's end, `CH[i].b` on the recording's clock;
  never in the middle of a playing chapter). Asked first, with Reload now (the
  place kept) or Later: another shell, another `FORMAT`, a story that needs a
  newer shell (one never loaded here is not started until then; one loaded runs
  on in its old version), a station whose story this device does not know. On
  the page it is a bar (`#livebar`); in a headset a panel the shell draws in
  front of you over everything, pointed at through `HOST.collab.ray` and
  `press` (which every story calls before its own scene: the shell wraps them).
  A question waiting is taken by itself on the page's Stories screen outside a
  headset unless Later was pressed (Later holds until it is asked again) (`HOST.reloadIfUpdated`, which the service worker's takeover used to
  trigger directly), at most once in ten minutes (a host that serves an old
  page from a cache must not cause a loop). Without `version.json` a worker
  that took over still means a new shell, as before.
- **A reload keeps the place**: `HOST.place()` in `sessionStorage`
  (`livePlace`, for two minutes), put back as the boot starts its story, the
  station followed again. A headset session cannot survive a reload, so the page
  then shows one button, *Enter VR to continue* (or AR), which enters as Enter VR
  does and plays on as before.
  Not for the desktop preview camera's pretend session (`HOST.collab.previewOn()`): it starts again by itself
  (`pcResume`, "The desktop preview camera" in `docs/agents/shared-rooms.md`). The headset's update panel (`xrTick`) is
  never drawn on a camera's picture (camera mode's or the preview camera's: nobody there can press it); such a device
  takes a release at its next reload.
- **In a shared room** ("Updating a room" under "Shared rooms"): the bar and the headset's panel have a third
  button, *Reload every device* (Update the room's two presses: *Reload every device? Press again*), while this device is
  in a room that is not on this device alone. A new `FORMAT` asked about on a page outside a headset in a room is taken
  by itself after a 20 s countdown on the bar (*Reloading by itself in n s.*; *Not now* holds it off for 5 minutes, then
  it asks again), at most once in ten minutes (`liveReloadAt`, as `waiting()`): a page left on Later held the room on the
  old version for everyone (`cdOn`, `cdStep` in `HOST.live`; `HOST.live.times({ countdown, hold })` and `localStorage`
  `liveCountdown` = `off` for tests). A room that moved on to a newer version than this device's (`shared.js`, refused
  with 4006) asks as the question `room` (*Room XYZ has moved to a newer version of the app: reload to go back in.*, the
  highest of the kinds), or outside a headset reloads at once, at most once in ten minutes (`HOST.live.roomNewer`).
- **A shared room with an older device**: a station whose story this device's
  list does not have shows on its card and in the page's dialog as *A newer
  story*, "Update needed" (`shared.js`'s `meta` takes `HOST.unknown`), cannot be
  run here (`HOST.start` asks instead), and the question offers the update;
  Arrange all on such a device leaves that station where it is. So a new story
  no longer needs a new `FORMAT`, nor does a new page in `STORY_EXTRA` (the studio came without one). `HOST.live` knows a key by `HOST.meta` (`known`: a story, or a page in `STORY_EXTRA`, the design room or the studio), never the stories alone (else a station of the design room asks every page and headset to update, and a page on its Stories screen reloads itself).
- Untested on a headset: a swap in place in a session (the story's `xrAdopt` as
  for a story change), the question's panel and its buttons, *Enter VR to
  continue*, `EventSource` in Quest Browser.

## Inside a story (all sixteen follow the same pattern)

- Data at the top (airports and proteins: precomputed constants; spatial: the
  editable `PLACES`, `PROTEINS`, `LINKS`, `TOGETHER`, `MOVES` lists, laid out
  at load time by `LAYOUT`).
- The start runs in steps (`LOAD`, the same lines in every built engine's `e7_app.js`; the hand-written three keep the
  same `loadStep` and `warm` with their own list): `init` (from `setTimeout(init, 40)` as before) lists the steps
  `[label, fn, scene]` and runs them one by one (`loadStep`), calling `HOST.progress` after each; short steps run on
  in one task, and after 40 ms, or a step left half done (a step that returns true runs again), the next runs from a
  timer (not an animation frame: the window's frames stop in a headset). Built stories: `buildScene` (the renderer, scene, lights and stars only), then per set `buildSet(k)`
  and `warm(group)`, then `sceneJoin()` (what joins the sets: the microanatomy story's colours, network and dots, the
  tissue topology story's liver, the design room's plates and first view; empty elsewhere) and `warm(GL.scene)`, then
  the story (`resize`, `buildDefaults`, `buildStory`, labels, timeline), explore mode (`buildExplore`, `bindCanvas`)
  and the panels (`audioInit`, `xrSetup`, `LOAD.done`, then `initEnd`: the old start's rest, listeners, a link's
  place, the frame loop). The hand-written three: `buildScene`, `warm(GL.scene)`, story, explore, panels. `warm`
  compiles each material once (`LOAD.seen`) with the scene's lights, as when drawn (`renderer.compile` on a stand-in
  scene holding the lights and one object without its children), until a slice has taken 50 ms; its floor is one
  shader program (in SwiftShader up to about 0.5 s on a quiet machine, more on a loaded one; three.js r128 cannot use
  `KHR_parallel_shader_compile`). A failure in a step marked `scene` shows that WebGL is missing, as before;
  `dispose` sets `LOAD.gone` and clears `LOAD.t` (also the timer that hides the loading screen 120 ms after the first
  frame, so a story picked meanwhile keeps it). `LOAD.ms` keeps each step's time (`HOST.cur.peek('LOAD.ms')`).
  Nothing else changed: the sets, the first frame, seeking, the clock and the shared-room hooks are as they were.
- `CH` lists chapters with story-time ranges; `buildStory()` writes the panel
  HTML (elements with `data-at` fade in at that second of the chapter) and the
  animation tracks via `ramp()`/`key()` over the names in `DEF`; `storyCam()`
  interpolates camera waypoints. Beside the keys, the story's sound cues
  (`sfxCue`, `sfxHold`; the block after the slideshow block plays them, and
  `sfxLive` in a live simulation's explore part: see "Sounds inside the
  stories" under "Sound effects").
- `NARRATION_SYNC` maps recording time to story time; the narration (if
  present) drives the clock (`audioInit`, `audioSync`, `audioFollow`, thin
  wrappers around `HOST.audio`). `APP.t`, the timeline, `#<key>&t=` and the
  shared rooms' clock run on the recording's time; chapters, `data-at`, labels,
  camera and animation on story time (`storyT`, back with `narrT`; the sweep
  tools take story times). Until a story has a recording the table sets its
  pace: `node tools/pace.mjs <url> [--write] [keys]` writes it from the panel's
  words (each stretch between two cues, a `data-at` element or a chapter's
  start or end, lasts the longer of 1.1 times its story time and the words,
  numbers not counted, that appear at its start read at a rate chosen per story
  so that the whole story reads at the airports' 2.1 words a second; where that
  slows a stretch a lot, a line's 0.6 s fade-in keeps the light pace and the
  rest of the stretch waits, so the text is there at once). Run it again after a story's text changes, then update the lengths
  (`len` in `stories/list.js`, `audio/PUT-narration.mp3-HERE.txt`) and
  `docs/narration.md` (every story has a recording, so this is for a new story until it is narrated); the flock's first swoop (flight time, `roost` in its
  set) is timed to its last chapter in its recording. A recorded narration replaces
  the table with its own times (the airports' is): `pace.mjs` leaves a story
  with an MP3 in `audio/` alone. A synthetic narration (`tools/voice/`, every story's but the airports') is laid out from its audio instead:
  each stretch lasts the longer of 1.1 times its story time and its line plus a pause, and a chapter's words end
  before its slideshow stop; after such a story's text changes, run `node tools/voice/narrate.mjs <key>` again (only
  changed lines are spoken again), not `pace.mjs`. A story in two languages (`LANGS` and `setLang(l, false)`, the pass story) is read in
  each, and each stretch takes the reading time of its longer text (by words); `tools/narration.mjs` writes both into
  `docs/narration.md`. Narrated (`tools/voice/narrate.mjs`), it is spoken in each (English by Kokoro, German by Piper)
  and laid out on one timeline: each stretch lasts the longest of 1.1 times its story time and each language's line
  plus its pause (a line one language reads as one and the other as two spans both stretches), `NARRATION_ENDS` is the
  later of the two, and each language has its own recording on that timeline (`audio/narration-<key>.mp3` for the
  first, `audio/narration-<key>-<lang>.mp3` for the others, all of one length), so the clock, the slideshow's stops and
  a station's clock are the same in either. `slideStep` (slideshow, see above)
  runs in `frame()` after the clock moves and before the end check.
- Explore mode: the `X` state object, `exploreStep()`, tab renderers
  (`render*`), and the canvas/pointer handling in `bindCanvas()`.
- WebXR: the `XR` object, controllers (`xrController`, `xrPoint`), canvas-drawn
  panels (`makePanel`, `panelTick` with a signature function so textures only
  redraw on change, `vButton`, `textBlock`). The HTML panel cannot be shown in
  a headset, so every pane exists twice: HTML (`render*`) and canvas (`draw*`).
  Keep both in step when you change one. Story titles and kickers on the
  canvases (the Stories screen's cards, the story panel's header) go through
  `fitTitle`: their own size when they fit, else smaller down to about 0.8 of
  it, then (on the big cards, whose description moves down) two lines split
  where they are most even, else an ellipsis; the shell's station cards
  (`drawCard` in `shared.js`) shrink theirs the same way.
- The screen's framing (`resize()`, `applyCamera`): on a wide screen the camera
  aims past the side panel (`setViewOffset(w, h, -0.14 * w, ...)`, with each
  story's own shifts: FIT's target shift, the tour's `side`), on a narrow one
  above the bottom sheet (`0.21 * h`), and `GL.fit` stands the scene back to
  fit. In focus mode (the shell's `HOST.focus()`: the 3D alone on a phone
  or tablet) `resize()` reads `GL.bare = !!(HOST.focus && HOST.focus());`
  first (the same line in all sixteen, the design room and the studio; the shell sends a
  `resize` when it changes) and then frames the scene for the whole page: no
  sideways offset, its middle at 0.45 of the height
  (`setViewOffset(w, h, 0, 0.05 * h, w, h)`), and `GL.fit` for the page between
  a 48 px top bar and 126 px of bar and subtitles (a scene reaching about 0.95
  of the half height at fit 1, and 1 to the sides; the robots' room 1.05 and
  1.2, the cell map's cell 1.3 wide). Every shift clear of the side panel goes
  back as on a phone (`GL.wide && !GL.bare`: `u` in `applyCamera`, the tour's
  `storyCam` and `sideStep` for its explore views), NARROW still stands wide
  views back on an upright screen, and what framed the strip above the bottom
  sheet is off (LOW, the flock's and the school's lift, the robots' low
  framing). Focus off, every framing is as before.


## From CLAUDE.md

These notes were in `CLAUDE.md` (Notes for Claude Code); they are kept here word for word, beside the area they belong to.

- While developing, `node relay/server.mjs --lan --watch --build` (or
  `--static . --watch`) swaps a saved story in place on every page and headset.
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories never
  create or close an `AudioContext`. The one exception: the studio's Upload pane
  decodes a short sound it is given in an `OfflineAudioContext` (no output, it
  plays nothing) to make it a mono WAV; keep it the only one. The studio's sounds
  placed in a scene (emitters) play through `HOST.audio.fx()` and follow only the
  Sound button (this device's mute), not the two switches below (they are the
  scene's own sounds, not effects). Keep both engines, the hum and the
  watchdog (see the sound notes above): each guards against a way the
  narration went silent on the Quest. After touching sound, run
  `node tools/audio.mjs` as well as the smoke test, and report audible output
  on a headset as untested (Sound check is the on-device tool). Sound effects
  are the shell's too (`HOST.sfx`, `sfx.js`): they play only through
  `HOST.audio`'s context (`HOST.audio.fx()`), on by default (the owner approved
  them; the Sound button silences them with the narration). The Sound button
  itself, this device's mute (`HOST.audio.mute()`), starts muted on every page
  until it is pressed (`narrationMuted3`; the owner: "Default to sound off in all modes", then, 8 November 2026, "On
  mobile and desktop default to no sounds and no narration until manually enabled, in ar and vr default to sounds but
  no narration"); a headset session (VR or AR, `HOST.inXR()`) has its own mute, off by default (`xrMuted`), and its own
  narration, off by default and remembered once turned on (`xrNarration`); the story panel's Sound button is the
  narration's switch in a session. Its tests seed the sound on where they need it. Two switches, each
  for every story at once: Sound effects (`HOST.xr.sfx()`, through `HOST.sfx.on()`
  and `set()`) and Narration (`HOST.xr.voice()`, the narration that applies now: off, the narration is silent and
  the story runs on its clock; effects and subtitles go on); Sound effects in a room the room's
  (key `look`; one the room never wrote stays the device's own), else the device's own (`sfxOn`); the narration on a page
  the room's or `narrationOn`, in a session in a room this headset's own for the room until the lobby (`xrNarrRoom`,
  never written to the room) else the room's, which Narration for everyone sets (`look`'s `vg` moves on); the effects'
  volume is always the device's own. Only the flock and the pass story have a
  background, and `vacuum` is the only continuous sound (the owner, 30 October
  2026: the other backgrounds and the machines' hum went; never bring them back
  unasked). Stories ask for them through the same lines in all
  sixteen, the design room and the studio (the sound effects block after the slideshow block,
  `sfxCue`/`sfxHold` beside the keys, `sfxAct` for explore actions, `sfxLive` in
  the live simulations; the flock and the airports are the references): keep them
  identical, and never put a sound in `collab.state()`. After changing a sound,
  render it (`node tools/sfx-render.mjs`) and check its levels; after changing a
  story's cues, run `node tools/sfx-cues.mjs <url> <key>` and render its track
  (`node tools/sfx-render.mjs <url> <out> --story <key>`); nobody here can hear
  them, so report how they sound as unheard.
- Synthetic narrations come from `tools/voice/` (Kokoro-82M; every story's but
  the airports', voice `af_heart`, the owner's choice; the pass story's German
  with Piper's Thorsten voice; models and Python outside the repository, see
  its README). After a narrated story's text changes, run
  `node tools/voice/narrate.mjs <key>` (it re-times the story from the audio;
  not `tools/pace.mjs`), then `node tools/voice/check.mjs <key>`; check new
  words with `--phonemes` and `say.json`, and report how it sounds as untested.
- Headset placement can be anchored in the room (`HOST.anchor`, see
  "Placement in the headset" above): story code must never move
  `GL.rig` past it, so check `HOST.anchor.held()` before re-placing and
  `HOST.anchor.locked(kind)` before letting the grip move anything. Real anchors
  only exist on a headset: report their behaviour as untested.
- The headset's four settings (the scenes' small labels on top, in 3D or
  hidden, on top by default; the cards, meaning the story panels, the station
  cards and people's name tags, in 3D, on top or hidden, in 3D by default; the
  two independent of each other; free moving; subtitles, off by default) are the
  shell's (`HOST.xr.labels()`, `HOST.xr.cards()`, `HOST.xr.free()`,
  `HOST.xr.subs()`, in a room the room's key `look`, which also holds the two
  sound switches, `sfx` and `voice`), the same
  for every story: never put them in a story's `state()`. Stories read labels,
  cards and free moving every frame through the shared lines (`xrSettings`:
  `XR.lm`, `XR.cm`; `placeLabelXR` follows the labels only, `panelDepth` and the
  story panels' visibility the cards only; `xrFace`), the same in all sixteen and
  the design room; the shell draws the subtitles from each
  story's caption hook (`caption: xrCaption`, the same lines in all sixteen).
  Moving with the sticks in VR (`HOST.xr.walk()`, v125; in a shared room only for a headset elsewhere, v128) is the shell's too and
  each headset's own: the shell moves three.js's reference space, so stories
  never move `GL.rig` for it; their own stick use waits on `xrWalking()` (the same
  line in all sixteen, the design room and the studio); the studio switches its
  own sticks with it and moves you itself while it is on (`sticks` in its
  returned object; "The studio's two stick modes" above). No story reads A or X
  (`buttons[4]`): play and pause are on the panels and the menu's Story tab.
  How the signs read, how the free grip feels, how moving with the sticks feels
  and how the subtitles read and follow the head can only be checked on a
  headset: report them as untested.

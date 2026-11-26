# Chunk 14: shared.js middle third (headset menu, notices, welcome, check by eye, trackers, subtitles, sticks, tick, room frame start)
Read: shared.js lines 4722-9442 (4,721 lines, 362 KB of the file's 1,071 KB), every line; plus short look-ups outside the range to tie callers (102, 1062, 2140-2240, 2794, 3461-3499, 3932-3944, 4640-4721, 11039-11048)

Call chain for everything below: XR session rAF `loop` (11042) -> `tick(f)` (8192) -> ... -> `drawOverlay(dt)` (8463). `tick` has no other caller: nothing of it runs on a page without a headset session.

## Findings

### The menu's redraw signature is built whole on every frame the menu is open   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: shared.js:4734-4748 `panelSig`, called first thing by `drawPanel` (5200), called by `drawOverlay` (8491) each frame while `OV.panelG.visible`
What: Answer to the main question: NOT while the menu is closed (8488-8500: closed, only `regions`/`sig` are cleared once). Open, every frame builds one `JSON.stringify` of about 120 values: `C.st.map` (one string a station), on Circles/Debug `C.members.map` and `[...C.pres].map`, out of a room three more `.map`s over room lists, `timeNow()` (a `Date`), `recenterRow()` (an object and closures only to read `label` and `!!fn`), `storyPanels()` (the story's `panels()` hook, again in `mirrorStep` 4721), `langButtons()` (`getElementById` + `getAttribute`, 5146), `lineUp()`, `checkState()`, `linedUp()`, and nested `J(...)` inside `J` (`layerSig` 5856 on Debug, `sharpSig` 5859 on Settings, `placesSig`). A few KB of strings and some dozens of arrays 72-90 times a second.
Change: Keep the signature but build it at most about 10 times a second unless `S.sig === ''` (every press, `poke`, keypad and page change already clears it, 7956, 8141, 4841), and return `panelHover(S)` in between. Drop the inner `J` calls (push the values), and give `recenterRow` a label-only form.

### Every full redraw copies the canvas, uploads it and rebuilds the whole mipmap chain; Sound check does it twice a second   [perf-frame]  gain: medium  risk: medium  sure: confirmed (the layer part: plausible)
Where: shared.js:5923-5928 `panelSend`, 5907-5913 `sheetCopy`, 5954-5967 `sheetPatch`; 4742 (`PNL.page === 'sound' ? Math.floor(performance.now() / 500)`); 6014-6037 `soundPage`
What: A changed signature redraws the whole 720 x 1920 menu, then `sheetCopy` draws rows 0..H into a second canvas (`PCV.cv`, kept for good: up to another 5.5 MB), `texSubImage2D` sends it and `generateMipmap` rebuilds all levels of the full texture whatever H is. The Debug tab's read-outs got their own row patch in v136 (`stripStep`), but the Sound check page still puts a half-second counter into the signature, so it does the full path 2 times a second for `A.report()`'s lines. Nothing here asks whether the menu is shown as a sharp-text WebXR layer (the default in Quest Browser since v177): if the compositor draws it from the layer, this texture upload and mipmap pass may be for a mesh nobody sees (index.html's reader should confirm).
Change: (1) Sound check: draw `A.report()` through the strip mechanism (`PNL.strip`) and take the counter out of the signature. (2) WebGL2 `texSubImage2D(..., width, height, ..., canvas)` with `UNPACK_SKIP_ROWS`/`SKIP_PIXELS` can send a sub-rectangle of `S.cv` itself: no copy canvas. (3) Skip `panelSend` (or at least mipmaps) while the layer shows the menu.

### Subtitles walk the story panel's DOM from inside the XR frame   [perf-frame]  gain: medium  risk: medium  sure: confirmed
Where: shared.js:7755-7780 `subText`, 7805-7827 `subNow`, 7859 `captionNow`, called by `drawSubs` (7866) from `drawOverlay` (8505) every frame while Subtitles are on
What: Each frame calls the story's `caption()` hook and loops the chapter's cue elements up to three times (7809, 7813, 7814), each a `WeakMap` look-up; every 250 ms each cue's text is read again with a `TreeWalker` and two to five `closest()` selector matches per text node, plus Unicode regexes, for every cue of the chapter, not only the one on show.
Change: Read a cue's words once per chapter (key: the element), and re-read at 4 Hz only the cue on show and only if it holds a live number (e.g. no `data-say` and a digit in it); cache `at`/`next`/`out` per (chapter, story second) so the three loops run when the cue changes, not each frame.

### `trkKey()` is rebuilt for every tracker on every frame   [perf-frame]  gain: medium (rooms with the PC's trackers), else none  risk: low  sure: confirmed
Where: shared.js:7365-7374 `trkKey`; used in `trkPose` (7347), `trkUsed` (7401), `trkGone`, `trkMenuLine`; `trkPose` is called per tracker by `drawTrackers` (7588, each frame from `drawOverlay` 8480) and by `HOST.collab.tracker()/trackers()` (7350-7362), which the studio's puppets and props read each frame
What: `trkKey` validates the room's key and builds a fresh `names` object with `Object.entries`, `trim`, `slice` and copies of `m.a`, `m.b` on every call; `trkPose` calls it once per tracker only for `names[E.id]`, and also allocates `p` and `q` arrays per call. `drawTrackers` adds a `new Set` and `[...TRK.pucks.keys()]` per frame.
Change: Memoize `trkKey` on the identity of `val('trk')` (as `look()` 2797 and `areaList()` 8871 already do); let `trkPose` write into `out.p`/`out.q` when given.

### A third of this range is comments, much of it dated history   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: shared.js:4722-9442
What: 901 full-line comment lines (96 KB) plus trailing comments: about 106 KB of the range's 362 KB (29 %). Much is "the owner, <date>: <quote>", version history and field logs (e.g. 4749-4752, 6649-6660, 6863-6877, 6979-6989, 8291-8300, 8328-8344, 8663-8685, 9120-9123), which `docs/history.md` exists to hold. It is shipped to every device (no minifier) and read by every agent that opens the function below it; the long block comments also sit on single lines of 120+ characters, so a 40-line Read costs about 1,500 tokens before any code.
Change: Keep one or two lines of "what and why now" above each function; move the quotes, dates and measurements to `docs/history.md` or the matching `docs/agents/` section with a `(history: <anchor>)` pointer. About 60 KB (some 15,000 tokens) could leave this third alone.

### Seams for code loaded on demand   [perf-load | repo-cost]  gain: medium  risk: medium  sure: plausible
Where: shared.js:4734-6513 (the menu and its pages, about 150 KB), 6648-6860 (check by eye, 16 KB), 7412-7549 (the dialog's Trackers section)
What: The file is one closure, parsed by every page; everything from `panelSig` to `notePage` runs only in a headset session with the menu open. Cleanest cuts, by how few shared names they touch: (a) the Notes pages 6132-6513 (27 KB; developer mode only; uses `PNL`, `OV.panel`, `button`, `paintButton`, `wrapText`, `fit`, `relayFind`, `relaySaw`) belong in `notes.js`, which is already the notebook's module; (b) the room setup guide's pages and drawings 4892-5103 (19 KB of mostly sentences); (c) `trkSpot`/`trkRender` 7447-7549 (9 KB, a page's dialog, only when the relay has trackers); (d) `eyeHintBuild`/`eyeArrows`/`eyeHint` 6745-6860. A whole `shared-xr.js` (menu, overlay, room frame) would need a context object for some hundreds of free names: a larger job.
Change: Start with (a): `HOST.notes.menuPage(api)` loaded with developer mode, as `bodies.js`, `flight.js` and `output.js` are loaded on demand; then (b) and (c). Each needs its file in `sw.js` `SHELL` and the relay's `APP_FILES`.

### Small per-frame garbage in `tick`, added up   [perf-frame]  gain: low to medium  risk: low  sure: confirmed
Where and what (all once a frame from `tick` unless said):
- `[...session.inputSources]` three times a frame: `gripStep` 7702, `sticks` 8042, `leftHand` 8165 (with a closure), again in `carryMenu` 8591 while the menu is carried. Read once in `tick` into one reused array.
- `gripStep` 7714: a new 7-number array per hand per frame; `presenceOut` only needs it 15 times a second.
- `ray()` 7897 (called by each story's pointer code per controller per frame): the `[OV.ask.mesh, OV.eye.mesh, OV.wel.mesh]` array and three `findIndex` closures even with no hit (7922), a new hover record and result object per hit (7931, 7936), `intersectObjects` result array. Skip 7922 when `hits.length < 2`; reuse the hover record per controller.
- `menuShareStep` 2184-2216 (while My menu is on and open): `menuSig()` (an `Object.values().map().join`), the `full` string and `menuPose()` (three arrays, an object) are built every frame before the `picMs`/`poseMs` gates; move them behind the gates.
- `drawFps` 7062-7064 (Frame rate read-out on): two template strings and `toLocaleString('en-GB')` every frame to find that nothing changed; the read-out costs frame time it then reports. Compare `FPS.t0` and `st.at` first.
- `drawWelcome` 6938-6940: `welWords()` (a `filter` over stations, nested arrays, a `join`) each frame for the 14 s it shows; `drawRec` 7093-7120: `HOST.notes.view()` and `V.pins.map().join()` each frame, recording or not.
- `drawOverlay` 8519 `Object.values(OV.mirror)`, 8487 `HOV.some(atMenu)` closure, and 8527 `OV.root.updateMatrixWorld(true)`: a forced pass over every overlay object (cards, rings, people) each frame, before three.js does its own.
- `zoneStep` 8264-8289, `allFirst` 8303, `arcStep` 8362: `arcSt()` (a `find` with a closure) at least three times a frame in a room, `dist` closure, `C.st.some`; these could run at 10 Hz (the dwell is a second).
- `body(id)` 7722-7734 and `heads()` 8428-8442 (the studio's and bodies' per-frame reads): fresh arrays per person per call; `tracker(id, out)` already takes an `out`, these do not.

### The same rows written two to four times in the menu code   [repo-cost]  gain: low to medium  risk: low  sure: confirmed
Where: shared.js:4793-4820 `passPage` vs 4860-4891 `keyPage` (two keypads; the password page could be `keypad()` with a note); 5648-5697 (the named-or-coded room row four times: offer, near, rooms, kept); 5020, 5054, 5065, 5451 (what the check says, four times); 5156-5161 vs 5627-5631 (the relay's password block); 5172-5177 vs 5394-5403, 5188 vs 5747, 5192 vs 5447 (limited menu rows vs the full menu's); 6066 vs 6486 (`lines`, a second word-wrap counter beside `wrapText`); 6084-6088 vs `nbBar` 6428; the "clear, rounded box, fill, stroke" opening of `drawNote`, `drawAsk`, `drawEye`, `drawWelcome`, `drawFps`, `drawRec`; the literal `'#ffb43b'` about 25 times where `AMBER` exists.
Change: A `roomRow`, a `checkSays`, a `sheetBox` helper and one keypad page: about 150 lines (8-10 KB) less, and one place to change a row both menus show.

### What runs with no room and no headset; start-up leftovers   [perf-load]  gain: low  risk: low  sure: confirmed
Where: shared.js:3498-3499, 3944, 8661, 8701-8724, 8751
What: On every page: `setInterval(pump, 200)` plus a `requestAnimationFrame` loop that calls `pump` each frame for good (it returns after one `performance.now()` compare; out of a room it does `attachCheck`, `liveStep`, `talkStep` 5 times a second), and `setInterval(iconIdle, 40)` (25 wake-ups a second that return at once out of a room). At load: `put('collabSharedAlign', '')` (a `localStorage` write on every load to clear a key older versions kept) and `placesLoad()` with the v2/v3 `roomFrame` migrations.
Change: Start `iconIdle`'s timer when a room is joined and stop it when left; drop the rAF pump on pages that are in no room (or start it with `join`); retire the legacy key writes after a release or two.

## Bugs seen
- `panelSig` does not cover some things the Settings tab draws: `HOST.flight.on()` (Exit / Goggles off, 5266), `HOST.ships.flying()`/`whyNot()` (5317), `LV.mode` and `liveSound().playing` (5410-5411): changed from outside the menu (a stick's double click, sound starting) they stay stale until something else redraws (plausible; unless `HOST.xr.sig()` carries them).
- `drawPanel` 5789 `const LV = look()` shadows the module's `LV` (the live sound, used at 5410 in another branch): harmless today, a trap for the next edit. `guidePage` 5012 declares `b3` a second time (same value as 4899).

## Not worth changing
- No `localStorage` read on any per-frame path in this range: every `get()` is at load (6146, 6879, 7284) or on a press; `localRooms()` is cached (`LOC.list`), `look()`, `areaList()`, `areasAll()` are memoized, `gpuInfo()` is read once per context.
- Hover changes repaint and upload only the two buttons (`panelHover` 5931); the Debug read-outs patch one row (`stripStep`, 5 Hz).
- `drawNote`, `drawAsk`, `drawEye`, `eyeArrows` labels, pucks' and menus' name tags redraw only on a changed signature; the once-a-second countdown redraws of the small ask and welcome sheets are cheap.
- `eyeStep`, `welStep`, `devStep`, `notesStep`, `soundZone`, `floatMenu`, `originCheck` are flag checks and reused vectors; `presenceOut` is held to 15 Hz, `scanCheck` to 1 Hz, `scanFloorAt` to 0.5 Hz, `frameTimesLog` to 0.1 Hz.
- `subSplit` (the caption line-breaking, quadratic in words) runs only when the cue's text changes; `subDraw` only when the caption does.
- `trkIn` (60 messages a second) keeps 8 samples a tracker and is bounded to 64 rows.

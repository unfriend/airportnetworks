# Chunk 11: the app shell (index.html) and shell modules
(in progress)
Progress: index.html lines 1-900 read (CSS 21-707, DOM 709-876, script starts 879).
Progress: index.html 1-4250 read. Raw notes so far (to be ranked at the end):
- 930-938 EventTarget.prototype.addEventListener patched for all targets (HOST_REC push while a story is on show); removed at teardown 3513. fine.
- 2881-2916 HOST.load: story file fetched as text, hashed char by char (fingerprint, 2868), then run as an inline <script> via textContent (2901-2903): no streaming compile, no V8 code cache for 700 KB-MB files; text + sourceURL = second copy.
- 3988-4020 HOST.focus frame(): window rAF forever on every device; check() (3 classList.toggle, 3 aria reads, getElementById x8) and sound() (btnSound.textContent/getAttribute/title + string concat) each page frame even with focus off; a MutationObserver (4045) already calls check().
- 2528-2578 sharpStep per XR frame (Quest default 'layer'): new Map, 2x [...SH.mats], up to 3 new XRRigidTransform + 6 literal objects, panels() and sharpMenu() calls, ly.transform/width/height set even when unchanged.
- 1826-1853 aqFrame per XR frame: one object pushed to a 10 s ring (~900 entries at 90 Hz) + shift; runs even with auto quality off.
- 2351-2353 session rAF wrapped: one closure per frame; dress() 2259 makes 4 closures per frame while walk is on.
- 3207-3223 wrap(): 6 nested try/finally wrappers round every story frame; perf.wrap measures (2 performance.now, info.reset) whenever a session runs with auto quality on (default).
- 1374-1390 N.sync per frame: muted(), voiceOff() (-> HOST.xr.voice -> voiceWhy -> room() twice), away() evaluated 2-3 times each.
## Second reader (re-reading everything)
Progress: index.html 1-2200 re-read.
- 7,10 meta description + og:description ~1.6 KB of prose listing stories (stale-prone: no CDK5/exposome/ppicell/tutorial). md-ish.
- 21-707 CSS ~690 lines inline (~45 KB?) parsed on every load; fine-ish.
- 877-878 stories/list.js and three.min.js synchronous script tags before the main inline script (blocking parse); list.js nearly empty since v187.
- 1374-1390 N.sync per story frame: check() watchdog early-outs (<1s) fine; muted()/voiceOff()/away() each evaluated twice (1379,1380); voiceOff -> HOST.xr.voice -> voiceWhy -> room() (collab.lookKept) and room() again in voice(): ~4 room() calls/frame.
- 1408 N.label() read by headset panels every frame (comment 1430) -> label() -> muted(), engine(); cheap strings.
- 1846-1848 aqFrame: new object per XR frame into a 10 s ring (~900 at 90 Hz) with shift() (O(n) each frame once full). Runs whether AQ.auto or not.
- 1919-1932 frameTimes: Map + sort per call (called by shared.js logging, not per frame?) check later.
Progress: index.html 2200-2850 re-read.
- 2329-2343 xr frame() (called per XR frame from the wrapped session rAF 2351-2353, which makes a new arrow closure per rAF call): dress(f) per frame when W.on (walk) or aq view scale != 1: 4 closures + WeakSet add per frame object; step() calls f.getViewerPose a 2nd time per frame while walking (three.js calls it too), each through aqView.
- 2528-2578 sharpStep (per XR frame after the story's, via HOST.loading.wrap, Quest default 'layer'): calls HOST.cur.panels() and collab.sharpMenu() each frame, new Map, [...SH.mats] spread, matrixWorld.decompose + new XRRigidTransform + 2 literal objects per visible layer (up to 3) and sets ly.transform/width/height every frame even when the panel has not moved (could compare against last matrix); shown() walks parents per layer.
- 2586-2588 write(): 5-9 gl.getParameter calls per layer write (sync GPU state queries) at most every 100 ms per layer: acceptable but could track state.
- 2637 HOST.session setter fans out to 6 watchers: fine.
Progress: index.html 2850-3450 re-read.
- 2881-2916 HOST.load: fetch text, fingerprint loop over every char (2868-2874; airports main.js ~700 KB = 700k iterations of 2 Math.imul, a few ms on a Quest, synchronous inside a load step), then <script>.textContent = txt + sourceURL: inline-script compile, no streaming/off-thread parse, no V8 code cache; the text kept in closure until done. A <script src> with the same ?v= url would get streaming + code cache; fingerprint could come from packages/index.json (already has fp) instead of hashing.
- 3087-3231 HOST.loading: loading scene card redraw gated by a sig string built per frame ([..].join) while loading only: fine.
- 3207-3223 wrap(): up to 7 nested wrapper closures round every story frame (layerStep, sharpStep, occlusion, perf, inputsGuard, notes, fade); each adds try/finally per frame: small but layerStep/sharpStep/notes run every frame of every story in XR.
- 3402-3449 inputsGuard.step per XR frame: allocation-free in quiet frames except for-of iterator; fine.
Progress: index.html 3450-4050 re-read.
- 3469-3495 HOST.perf.wrap per story frame: measures (2x performance.now, info.reset, autoReset toggle, aqStory) whenever a session runs and auto quality is on (the default) -> always in a headset. Cheap; fine.
- 3496-3524 teardown: HOST_REC listeners removed; controllers cleared; innerHTML of 5 nodes reset. Story dispose() is the only geometry/texture cleanup: shell does not check renderer.info.memory after swap (could log geometries/textures count after teardown to catch leaks; HOST.perf has info).
- 3580-3584 factories of all but last 3 stories dropped: good.
- 3624-3625 HOST.place JSON round trips: only on swap. fine.
- 3988-4020 HOST.focus frame(): its own window rAF forever on every device (focus on or off, picker or story): check() (getElementById x~8, 3 classList.toggle, 3 getAttribute, HOST.picking getter) + sound() (string concat of 3 DOM reads) each page frame; the MutationObserver at 4045 already calls check() on class changes. With focus on: HOST.cur.peek? (chapters cached), collab.caption() each frame.
Progress: index.html 4050-4600 re-read.
- 4129-4139 handheld tick: setTimeout every 400 ms while a card is due (phones with AR or iPhones until shown once) -> stops: fine.
- 4148-4173 handheld top-bar fit(): two MutationObservers (top subtree incl. characterData; body class) call fit(), which reads scrollWidth/clientWidth (forced layout) after class writes; body class changes on every explore/picking/xr switch; the Sound button text changes trigger it too (same() filters only identical text). Not per frame. OK.
- 4458 listFp: fingerprint(JSON.stringify(HOST.list...)) once per check: fine.
- 4492-4509 live check: version.json + packages/index.json (no-store) each check (about once a minute): 2 requests/min per open page; packages/index.json size? (see below) re-parsed and merge() JSON.stringify compares whole list each time.
Progress: index.html 4600-5150 re-read.
- 4765-4781 HOST.live tick: setInterval 250 ms for the life of the page (cdStep, collab.stations() scan each tick in a room, getElementById). Cheap; fine.
- 4678-4713 xrLoop: a second session rAF loop only while an update question is open: fine.
- 4908-4912 + 877-878: synchronous scripts before the boot: stories/list.js 2.8 KB, three.min.js 603 KB, inline main script (~4,030 lines, ~300 KB), sfx.js 77 KB, occlusion.js 54 KB (AR only), ships.js 87 KB (headset only), notes.js 48 KB (developer notebook), shared.js 1,071 KB. ~2.2 MB of JS parsed/compiled before any story fetch starts; occlusion/ships/notes/most of shared.js could load on demand as bodies.js/flight.js do.
- 4942-~5830 HOST.arrange (v170 editor, page-only developer feature) inline in index.html: ~900 lines parsed on every load, phones and headsets included.
Progress: index.html 5150-5929 read (end).
- 5160-5178/5716 HOST.arrange tick: setInterval 300 ms forever on every page and headset (want(), bar() builds an HTML string and compares); with developer mode on, relay() fetches /api/scenes every 30 s. Low.
- 5815-5826 boot: with no story in the address the first listed story is started behind the Stories screen (HOST.start(first) then openPicker): the landing page fetches, compiles and builds a full story nobody picked yet (and waits up to 1.5 s for packages/index.json first, no-store, 27 KB).
- 5906 offline take after 20 s; 5908 setInterval 15 s forever (cheap).
Read: manifest.webmanifest (18) - description duplicates index.html's meta descriptions (3 hand-kept story lists, none name CDK5/exposome/ppicell/tutorial).
Read: notes.js (727)
- notes.js is loaded synchronously on every page (index.html:4911) though it only acts in developer mode; at load it fetches version.json no-store (331, the same file HOST.live fetches 3 s later), opens IndexedDB 'networks-notes' (697 outCount) and runs setInterval watch 500 ms (692), runTick 1 s (575), flush 60 s (695) forever. Could build lazily on devOn() and share HOST.live's version.
- frame() (242) is in every story frame's wrap (index.html:3214): heldCheck early-outs; cheap when off.
Read: notes/index.html (324) - polls /api/notes, the open note's detail and /api/logs every 15 s while visible (318) and on focus; JSON.stringify sig compare. Fine for a developer page.
Read: occlusion.js (881)
- step() per AR frame (occlusion.wrap, index.html:3211): its own f.getViewerPose(ref) (754), the 2nd-4th of the frame; depthStep allocs per eye per frame: D.eyes=[] twice (431,756), forEach+g closures, shape string concat (451), Array.from(matrix) (454), E object; ready() 2 getParameter + 2 bindTexture + 2 texParameteri per eye per frame (397-404).
- roomSync (modes both/room, not the default since v195): new Set per frame; plane shapeSig builds a joined string of all polygon corners whenever lastChangedTime moves (Quest: ~56/s per comment 589) for every plane: no identity cache as meshes have (594).
- Smooth edges default (v196): 4 texelFetch + 4 conversions per pixel per eye, full-view pass writing gl_FragDepth. Owner's choice; mention only.

# Chunk 11 (final, ranked): the app shell (index.html) and shell modules
Read: index.html (5929)   Read: manifest.webmanifest (18)   Read: notes.js (727)   Read: notes/index.html (324)   Read: occlusion.js (881)
## Findings
### 2.2 MB of script parsed before the boot, most of it for headsets, AR or developers   [perf-load]  gain: high  risk: medium  sure: confirmed
Where: index.html:877-878, 4908-4912; HOST.arrange 4942-5730
What: Sync before any story fetch: three.min.js 603 KB, main inline script 277 KB + second 72 KB (HOST.arrange alone 55 KB, a page-only developer editor), sfx.js 77 KB, occlusion.js 54 KB (AR only), ships.js 87 KB (headset only), notes.js 48 KB (developer mode only), shared.js 1,071 KB. Phones and the landing page pay for all of it.
Change: load occlusion.js at the first AR session, ships.js at the first XR session, notes.js when developer mode is on (or the outbox has notes), HOST.arrange as arrange.js when &arr, a station's arr or developer mode asks, as bodies.js and flight.js are already loaded; defer or split shared.js (its reader).
### Story files run as inline script text, hashed char by char   [perf-load]  gain: high  risk: medium  sure: confirmed
Where: index.html:2881-2916 (2889-2903), fingerprint 2868-2874
What: Every story main.js is fetched as text, hashed in JS (ppicell 2.2 MB, cdk5/exposome 1.57 MB, topo 1.5 MB, pass 1.0 MB: millions of Math.imul pairs on the main thread) and run via script.textContent: no streaming or off-thread compile and no V8 code cache, so each visit recompiles megabytes; on a Quest this is one long task before the first LOAD step.
Change: for a normal start use <script src="packages/<key>/main.js?v=<fp>"> (fp already in packages/index.json; registration check on onload/onerror as HOST.lowpoly does); keep text+hash only for fresh swaps (HOST.swap, --watch), where the comparison is needed.
### The landing page builds a whole story nobody picked   [perf-load]  gain: medium  risk: medium  sure: plausible
Where: index.html:5815-5826
What: With no story in the address the first listed story (airports, 0.7 MB + its globe build) is started behind the Stories screen, after waiting up to 1.5 s for packages/index.json (27 KB, no-store). If the person picks another card, that work is thrown away (and on phones it competes with the first tap). May be intended as a backdrop.
Change: ask the owner; if the globe is only a backdrop, start it after the picker is idle (requestIdleCallback) or show a static backdrop until a card is picked.
### Sharp text re-places every layer every XR frame   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: index.html:2528-2578 (sharpStep), called each frame by the wrapper at 3210 (on by default in Quest Browser)
What: Per frame: HOST.cur.panels() and collab.sharpMenu(), new Map, two [...SH.mats] spreads, and for each of up to 3 visible layers matrixWorld.decompose + new XRRigidTransform + 2 object literals + width/height writes, also when the panel has not moved.
Change: keep each layer's last matrixWorld.elements (16 numbers) and skip decompose/transform/size when unchanged; reuse one Map; iterate SH.mats without spreading.
### Focus mode's page rAF runs forever on every page   [perf-frame]  gain: medium  risk: low  sure: confirmed
Where: index.html:3988-4020 (frame), 4051; check() 3888-3904, sound() 3956-3964
What: A window requestAnimationFrame loop beside the renderer's, on every device, focus on or off, Stories screen too: check() (~8 getElementById, 3 classList.toggle, 3 getAttribute, HOST.picking getter) and sound() (3 DOM reads + string concat) each frame, although the MutationObserver at 4045 already calls check() and HOST.audio's changed() (1431) is where the Sound button changes.
Change: call sound() from changed() and check() from the observer and the setters; run the rAF only while focus is on and a story shows (title and subtitle fades).
### Per-XR-frame garbage in the shell's own hooks   [perf-frame]  gain: low-medium  risk: low  sure: confirmed
Where: index.html:2351-2353 (closure per session rAF), 1846-1848 (aqFrame: new object per frame into a ~900-entry ring with shift(), runs whatever AQ.auto), 2259-2267 (dress: 4 closures per frame while walking), 2287 + occlusion.js:754 + 3153 (extra getViewerPose calls per frame); occlusion.js:431-461 (D.eyes=[] twice, closures, shape string, Array.from(matrix), E object per eye), 397-404 (getParameter/bindTexture/texParameteri per eye per frame)
What: All run each XR frame from frame() (2329) and the wrappers at 3209-3214; a few hundred small allocations a second each, GC pauses on a Quest.
Change: preallocated circular buffer for the ring; one viewer pose per frame cached in frame() and handed to the walk step and occlusion; reuse eye objects; compare shape/matrix in place.
### notes.js works on every page though it is for developer mode   [perf-load]  gain: low  risk: low  sure: confirmed
Where: notes.js:331, 575, 692, 695-697
What: At load it fetches version.json no-store (HOST.live fetches it 3 s later anyway), opens IndexedDB, and runs intervals of 500 ms, 1 s and 60 s for the life of the page.
Change: start them on devOn() or a non-empty outbox; take the release from HOST.live's version.json.
### Room scan: planes' shape signature rebuilt every frame   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: occlusion.js:591-592, 678-681 (roomStep per AR frame in modes both/room)
What: Quest moves lastChangedTime ~56 times a second (comment 589), so each plane's polygon is mapped and joined into a string every frame; meshes have an identity cache (594), planes do not.
Change: cache the plane's signature by its polygon array identity, as for meshes.
### Five page timers for the life of the page   [perf-frame]  gain: low  risk: low  sure: confirmed
Where: index.html:4802 (HOST.live 250 ms), 5716 (HOST.arrange 300 ms), 5908 (offline 15 s); notes.js:575, 692
What: Small each, but they wake a headset's page thread ~10 times a second in every story.
Change: one shell tick (e.g. 250 ms) calling the others; arrange's tick only once arrange is wanted.
### Three hand-kept story lists in descriptions, already stale   [md]  gain: low  risk: low  sure: confirmed
Where: index.html:7, 10; manifest.webmanifest:4
What: ~1.6 KB of prose each listing the stories; none names CDK5, the exposome, Back into the cell (main cards since v188) or the tutorial.
Change: one short generic sentence ("Network science in short interactive stories, on phones, desktops and VR/AR headsets"), or generate them in tools/release.mjs from packages/index.json.
### Stale comments in the shell   [md]  gain: low  risk: low  sure: confirmed
Where: index.html:884-886 ("Each story lives in stories/<name>.js": packages since v187), 3705-3707 and 5778 ("#airports, #proteins or #spatial")
Change: reword to packages/<key>/main.js and "#<key>".
## Not worth changing
- Sound: N.sync's watchdog (1193) early-outs under 1 s; voiceOff()/muted() evaluated twice per frame (1379-1380) is cheap. narration() drops the old decoded buffer (1343) and load() keeps one file (1309): memory across swaps fine.
- Teardown (3496-3524) removes every recorded listener (HOST_REC, 930-938), drops all but the last 3 factories (3583-3584); shell objects are made once with HOST.quiet. No leak seen in the shell itself (story dispose() is the stories' readers').
- inputsGuard.step (3402-3449) allocates nothing in quiet frames; HOST.perf.wrap (3477-3492) is cheap; layerStep (1748) writes only on change.
- HOST.live: version.json + packages/index.json once a minute (4775) is fine; handheld fit() (4151) runs on mutations, not per frame.
- sharp-text write() (2581-2604) state queries run at most every 100 ms per layer.
- notes/index.html polls every 15 s while visible: a developer page, fine. Inline CSS 54 KB: fine.
- Smooth edges' 4-tap depth pass (occlusion.js:126-177) is the owner's chosen default; cost is known (comment 821).

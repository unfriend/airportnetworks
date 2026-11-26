# Chunk 19: packages/airports/main.js (working notes)
Blobs: L5 NET_B64 353,053 B base64 -> 264,776 B binary (N 3214, E 18858, K 100; numeric 110,998 B, text code/city/country/name 153,778 B); gz bin 135,089 vs gz b64 154,862; br bin 114,670.
L6 LAND_B64 126,470 B -> 94,838 B bin (delta int16 rings /50). L7 LAKES_B64 6,763 B -> 5,056 B.
Whole file 701,241 B (gz 288,769, br 255,914); code without blobs 214,911 B (gz 70,856).
pass build takes sections NET_B64..'// Narration timing' (all three blobs) + COMM_NAMES..camera (net, maths, geometry, shaders, buildScene): pass/main.js has NET,LAND,LAKES (L275-277). exposome c-cut takes LAND,LAKES,bytes,decodeRings,globeMaterial,atmosphereMaterial (exposome/main.js L442-443).
Load: NET decode L84-128 (atob 353K, per-byte loops, two sorts of 3214, TextDecoder split); land mask L538-564: canvas 2048 (4096 desktop) fill of rings, getImageData + 2M-iteration copy loop; routes L642-672: 18,858 arcPoints Float32Arrays then copy.
Read 8-1697. Per frame (story): storyState L764 allocates obj + 20 evalTrack linear scans; updateStoryDOM L1024: CH.find/ST.items.find closures, $('#panel'); updateTimeline L1091: p (toFixed(2) of 231 s) changes nearly every frame -> 4 $() queries, clock textContent, querySelectorAll('#track .name') + 9 classList.toggle per frame; placeLabel L1002 per label: transform string per frame (DOM labels, only desktop). matches L1170: 4 toLowerCase x 3214 per keystroke (could precompute). pickAirport L1554 on every pointermove: 3214 loop, fine.
Load: buildStory L773: 6 connectivity() union-find runs (fine), bestPath; panel HTML. curveData L1412 31x(3+4) connectivity runs on first Closures tab (217 x 18,858 edges) - lazy, ok.
Read 1698-2517 (XR). Per XR frame: xrBegin L2134 -> xrPoint L2070 per controller: XR.panelMeshes.filter alloc L2078, raycaster.intersectObjects, HOST.collab.ray, pickAirportRay L1920 3214-loop per controller in explore (cheap ~6k iter), hit obj + _xp.clone L2100, hk string L2106; xrBegin L2170 P.at() per panel per ctrl. xrUpdate L2178: per story label placeLabelXR (storyT recomputed per label L2203), each label a separate Sprite/sign (1 draw each, own CanvasTexture). xrLabelMode/xrCardMode/xrFreeOn read every frame (xrSettings L1799).

---- FINAL (supersedes the working notes above) ----
# Chunk 19: packages/airports/main.js
Read: packages/airports/main.js (3,592 lines, 701,241 B; every code line read; blobs L5-7 inspected and measured)

Embedded data (all base64 string literals, one line each, decoded at factory time / in buildScene):
- L5 `NET_B64` 353,053 B -> 264,776 B binary: header N=3214, E=18858, K=100; Int16 lat/lon x100, Uint16 degree, Float32 betweenness, Uint8 community (35,354 B), edges Uint16 pairs (75,432 B), 100 random ids, then text code/city/country/name joined by \n and \0 (153,778 B, 58% of it). gzip: 154,862 as b64 vs 135,089 binary; brotli binary 114,670.
- L6 `LAND_B64` 126,470 B -> 94,838 B (ring lengths, then Int16 deltas /50 degrees). L7 `LAKES_B64` 6,763 B -> 5,056 B.
- Blobs 486,286 B = 69% of the file; code alone 214,911 B (gzip 70,856). The generator is not in the repository (docs/data-and-permissions.md L64).

## Findings
### Globe data shipped three times, as base64 inside JS   [perf-load | repo-cost]  gain: high  risk: medium  sure: confirmed
Where: L5-7; packages/pass/src/build.mjs L25-30 (sections 'const NET_B64=' .. '// Narration timing', all three blobs, plus COMM_NAMES .. camera); packages/exposome/src/c-cut.mjs L6-7, L58 (LAND_B64, LAKES_B64, bytes, decodeRings, globeMaterial, atmosphereMaterial)
What: 486 KB of blobs are in airports/main.js, again in pass/main.js (L275-277, 486 KB) and partly in exposome/main.js (L442-443, 133 KB): about 1.1 MB of base64 in total, revalidated and cached once per story. Base64 costs +33% raw and +15% gzipped. The JS parser scans it, then atob plus a per-byte loop runs at factory time (~6 ms on a desktop in node, several times that on a Quest). Lines of 353 KB also make a careless Grep or Read dump the whole blob into an agent's context.
Change: write the three blobs once as `packages/airports/net.bin` and `land.bin` (a small one-off converter from the current literals: the data is unchanged). Fetch them as ArrayBuffers via `HOST.pkgUrl('airports', ...)` before `init` (the first LOAD step waits on it). Pass and exposome fetch the same files (or take a copy into their own package) instead of pasting literals. Optional tighter edges: eu is already sorted, so delta varints of eu plus zigzag deltas of ev, keeping edge order (neighbour order matters, L101), take 75 KB -> ~40 KB raw, 54 KB -> ~20 KB gzipped. Check that Take all stories and the sw cache list package files. The pass and exposome builds must keep working; they cut by markers.

### Routes: 205k vertices x 36 B, and an 820 KB re-upload on every closure step   [perf-frame | perf-load]  gain: medium  risk: low  sure: confirmed
Where: buildScene L642-672; setClosedAttributes L691-699; called by updateClosures L1463-1476 <- `#kslider` input L1443, collabApply L1512, and in a headset xrSetK L2252 <- the panel's slider region drag L3079, which xrPoint L2112 runs every frame while dragged
What: 18,858 arcs make 204,885 vertices: position plus aT, aRv, aComm, aRnd, aWave, aXrm as Float32 is 7.4 MB on the GPU, plus a 1.5 MB Uint32 index and a 0.8 MB edgeOf Int32Array in JS. Four of those attributes are constant per route. Each k step loops 205k entries and re-uploads all of aXrm (820 KB). It also rebuilds the selection tube (selectAirport, L1474), reruns bestPath (L1475) and reruns connectivity (renderClosures L1447), and the explore sigMain redraws the 1024x1200 panel.
Change: make the per-route flags Uint8 normalised attributes (or one packed attribute) and aXrm Uint8: 205 KB per update, 2.5 MB less GPU memory. Better: keep a 3214-texel "closed" DataTexture and give each vertex its two airport ids (WebGL2 vertex texture fetch); a closure then uploads 3 KB and loops 3,214. At load, write arcs straight into `rp` instead of 18,858 temporary Float32Arrays (L643-644).

### One long indivisible load step, plus a decode outside any step   [perf-load]  gain: medium  risk: low  sure: plausible (not timed on a device)
Where: NET IIFE L84-128 and `PERM = permutation(7)` L1115 run at factory time, before the first HOST.progress. LOAD step 'Setting up the scene' L3473 runs all of buildScene L524-674.
What: one step rasterises the land into a 2048x1024 canvas (4096 on desktop), reads it back with getImageData (8 MB RGBA, L557) and copies it in a 2M-iteration loop (L558). The same step builds 18,858 arcs and copies 205k vertices, builds the atmosphere and the instanced pillars. The headset draws its loading card only between steps (AGENTS rule "A load step never runs long"), so this step is likely the longest frozen frame of the load on a Quest.
Change: split buildScene into steps (NET decode, land mask, routes, the rest: they share only GL and NET). Return true from the routes step to build it in slices of ~4,000 routes. Record LOAD.ms on a Quest to confirm.

### Per-frame DOM work on the page in story mode   [perf-frame]  gain: low-medium  risk: low  sure: confirmed
Where: frame L1442-1443 -> updateTimeline L1091-1107, updateStoryDOM L1024-1064; frame L1455 -> placeLabel L1002-1020
What: `p = (100*t/T_END).toFixed(2)` changes almost every frame (a step is 23 ms of a 231 s story). So each frame runs 4 `$()` queries, a clock textContent write, and `querySelectorAll('#track .name')` with 9 classList.toggle calls. updateStoryDOM runs CH.find and ST.items.find with closures and `$('#panel')`, and on the title chapter getAttribute/setAttribute on the SVG. The labels build a transform string each frame per visible label. This matters most on phones.
Change: cache the elements once (buildTimeline). Write the clock only when the whole second changes. Toggle the chapter names only when the chapter changes. Keep the chapter index rather than finding it again.

### Headset per-frame allocations and signatures   [perf-frame]  gain: low-medium  risk: low  sure: confirmed
Where: frame -> xrBegin L2166 -> xrPoint L2070 (per controller); xrUpdate L2213 -> panelTick L2565 -> sigMain L2637 / sigFoot L3157
What: each controller each frame runs `XR.panelMeshes.filter(m => m.visible)` (L2078), allocates a hit object, runs `_xp.clone()` (L2100) and builds a key string (L2106). In explore it also runs pickAirportRay, a 3,214-airport loop (L2092). panelTick calls `P.sig()` before its 60 ms throttle (L2567-2568), so sigMain concatenates ~20 fields every frame. In story mode that includes DOM getAttribute/textContent reads (L2644-2646) and HOST.panels.sig. xrUpdate also recomputes storyT(APP.t) once per story label (L2203). This is steady small garbage on a Quest.
Change: test `now - P.t < 60` before building the signature. Keep a reusable visible-mesh array and a reused hit object or Vector3. Compute storyT once per frame. These lines are copied in every story (see below), so fix them in tools/engine/e5_xr.js and e6_panels.js and in the three hand-written copies together.

### Same headset/panel/landing code as every other story, in a hand-written copy   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: L1638-2440 (headset core, 1,100 lines incl. labels/free moving), L2442-2634 (canvas panels, fades, texSubImage), L2655-2748 (landing cards), L3248-3385 (slideshow, sound-effect cues), L3465-3527 (LOAD, warm)
What: those ranges are about 1,330 lines and ~82 KB. Of the file's 2,543 lines of 25 or more characters, 2,145 (156 KB) also appear verbatim in packages/proteins/main.js, 1,539 (112 KB) in packages/spatial/main.js and 1,087 (82 KB) in tools/engine/*.js. A headset change (CLAUDE.md: "apply it to every story") means hand-editing this copy, proteins and spatial as well as the engine source. tools/engine/xrsame.mjs's default KEYS leave out airports, proteins and spatial, so nothing checks that this copy behaves like the engine.
Change: rewriting onto the engine is the owner's "left for later" (R1-R3), so leave that. Meanwhile, add airports, proteins and spatial to xrsame/panelsame's keys, or add a small line-diff check that names where the three hand-written copies drift from e5_xr/e6_panels. An agent can then edit one place and check the others.

### Stale or orphan comments   [md]  gain: low  risk: low  sure: confirmed
Where: L67 "Pre-computed on the full graph with NetworkX (see the Blender version for the method)"; L3210 "put an MP3 at packages/airports/audio/narration.mp3"
What: no Blender version or NetworkX script is in the repository (data-and-permissions.md L64 says the generator is missing). L3210 still reads as if the file were optional; the recording ships.
Change: say where the method lives, or that it is not in the repository. Trim the narration comment.

## Bugs seen
- L1004-1005: the 'deg' and 'btw' branches of placeLabel are identical (harmless; the second test is dead).

## Not worth changing
- Graph maths at load: 6 union-find passes over 18,858 edges (L787-788), one bestPath, two 3,214-element sorts (L113). Milliseconds.
- curveData (L1412) runs 217 connectivity passes, but only lazily on the first Closures tab and cached. matches() lower-cases 4x3,214 strings per keystroke only.
- pickAirport on pointermove (3,214 loop) is fine. The land mask is already R8 (2.8 MB with mips). The atmosphere ring/sphere swap (L485-519) and the panel row-fade texSubImage (L2589-2634) are already optimised. Text panels redraw only on signature change, 60 ms apart.
- Listeners: everything goes through HOST_REC (index.html L930-937), MediaQueryList and XRReferenceSpace included. dispose clears LOAD.t and xrMsg.t, disconnects the MutationObserver, removes the session listener and frees geometry, materials and textures.
- Draw calls: globe, atmosphere, stars, dots, pillars (instanced, hidden when flat), routes (hidden when invisible), up to 6 highlight tubes, one sprite per visible label, 2 panels, 6 controller parts. Modest.

# Measured numbers (v216, dev). Numbers only, no recommendations.

Machine: 4 CPUs, headless Chromium, WebGL in SwiftShader (software). Absolute ms mean little; compare relative.
Sources in this folder: perf1-5.json/md (tools/perf.mjs, 120 frames a chapter), load.json/load.log (load.mjs), sizes.txt, notes/.

## 1. Per frame, per story (tools/perf.mjs; draws and tris are both eyes; "js" is page script ms excluding renderer.render)
Chapters measured at 25% / 50% / 75% of the story and explore. Full per-chapter table: perf-table.txt (also text of tools/perf.mjs: perf1-5.md).
Not run by perf.mjs: flock, robots, cdk5, exposome, proteins, cellstress, hello. Pass was run twice (batches 3 and 5; batch 3 shown, batch 5: js worst 10.8 at 50%, otherwise alike). The tool's "hitch" filter matched nothing.
| scene | draws (25/50/75/expl) | tris k max | js mean max (ch) | js worst frame | heap KB/f max | geo/tex/prog at end |
|---|---|--:|---|--:|--:|---|
| airports | 23/27/22/24 | 94 | 0.4 (50%) | 15.1 | 58 | 15/6/15 |
| lbi | 66/31/51/60 | 142 | 0.5 (25%) | 2.1 | 65 | 43/25/87 |
| nmd | 24/30/41/40 | 199 | 1.6 (25%) | 30.6 | 735 | 20/16/51 |
| endo | 52/34/60/60 | 689 | 1.7 (25%) | 15.3 | 642 | 48/26/76 |
| pet | 39/30/42/24 | 424 | 0.4 (50%) | 7.7 | 59 | 43/15/66 |
| micro | 28/34/36/36 | 505 | 2.1 (50%) | 21.7 | 496 | 33/23/69 |
| ovary | 48/24/36/36 | 134 | 3.5 (50%) | 28.5 | 2525 | 41/18/48 |
| qubits | 57/40/45/46 | 153 | 1.4 (25%) | 15.1 | 136 | 26/32/28 |
| mutation | 34/44/22/31 | 134 | 0.7 (50%) | 16.6 | 54 | 34/14/36 |
| topo | 31/30/26/28 | 234 | 0.6 (50%) | 13.0 | 76 | 47/24/47 |
| pass | 30/32/60/53 | 220 | 1.0 (50%) | 30.4 | 81 | 44/9/72 |
| soil | 36/42/44/46 | 163 | 0.7 (50%) | 15.0 | 115 | 28/16/56 |
| spatial | 58/48/52/50 | 221 | 0.3 (25%) | 4.1 | 37 | 27/10/27 |
| ppicell | 97/50/45/46 | 553 | 0.7 (25%) | 10.2 | 72 | 56/12/46 |
| tutorial | 22/44/44/48 | 10 | 0.8 (25%) | 20.9 | 108 | 27/11/28 |
| design:room | 204 | 157 | 0.3 | 0.7 | 105 | 155/4/15 |
| studio:test:viewing | 20 | 3 | 0.2 | 1.5 | 41 | 18/6/19 |
| studio:test:editing | 34 | 4 | 0.4 | 2.5 | 52 | 24/7/26 |
| studio:heavy:viewing | 46 | 898 | 0.6 | 3.6 | 81 | 24/8/22 |
| studio:heavy:editing | 75 | 902 | 0.8 | 6.0 | 138 | 34/10/29 |
| studio:bliss-vr | 84 | 57 | 1.5 | 10.8 | 124 | 96/35/25 |
| studio:bliss-ar | 88 | 41 | 1.5 | 14.1 | 123 | 98/37/27 |
| room:lobby | 42 | 11 | 0.2 | 0.9 | 37 | 34/8/20 |
| room:station | 50 | 99 | 0.3 | 6.1 | 43 | 50/10/22 |
| room:station+6people | 58 | 141 | 0.7 | 1.2 | 70 | 57/12/27 |
Program links during measured frames (a link is a shader compile hitch): 12 of 60 story chapters had exactly 1 (SpriteMaterial in labelSprite: lbi 50%, pet 25%, micro 50%, ovary 50%, topo 25%; MeshBasicMaterial at first render: lbi 75%, nmd 75%, qubits 75%, topo 75%, tutorial 75%, pass 75% (batch 5); ShaderMaterial: nmd 50%). Micro 50% listed 3 links. No page errors in any batch.
Texture upload per frame: ovary 25% 144 KB, soil 50% 76 KB, pass 50% 74 KB (batch 3), ppicell 25% 67 KB, airports 50% 46 KB. Buffer upload per frame: ovary 50% 188 KB, pet 25% 37 KB, soil 25% 41 KB, pass 25% 20 KB, micro 50% 15 KB.

## 2. Load time (load.mjs, run once)
Ready = navigation commit to `HOST.curKey===key && HOST.cur.collab.scene()` (story built), then two requestAnimationFrame; start page = `HOST.list` non-empty and readyState complete. URL `index.html#<key>&slides=off`, fresh context each, service worker blocked, cache disabled, python http.server (no compression), 640x400. Bytes = CDP encodedDataLength of finished requests (so includes the narration MP3 that the story fetches). Heap = usedJSHeapSize after gc, 1.5 s after ready. One run each, no repeats.
| story | ready ms | req | MB fetched | script KB | fetch KB (narr, data) | heap MB |
|---|--:|--:|--:|--:|--:|--:|
| start-page | 393 | 15 | 7.7 | 1946 | 5301 | 29.7 |
| airports | 736 | 15 | 7.7 | 1946 | 5301 | 29.8 |
| lbi | 1869 | 17 | 8.4 | 1946 | 5996 | 98.7 |
| nmd | 1131 | 15 | 7.6 | 1946 | 5216 | 47.4 |
| endo | 1260 | 15 | 7.2 | 1946 | 4749 | 51.2 |
| pet | 1614 | 29 | 6.1 | 1946 | 3659 | 42.3 |
| micro | 1486 | 15 | 7.0 | 1946 | 4623 | 49.2 |
| ovary | 1037 | 15 | 6.6 | 1946 | 4203 | 50 |
| qubits | 601 | 15 | 7.1 | 1946 | 4655 | 16.3 |
| mutation | 498 | 15 | 7.0 | 1946 | 4551 | 18 |
| topo | 984 | 15 | 8.2 | 1946 | 5767 | 33.2 |
| pass | 1858 | 15 | 6.7 | 1946 | 4302 | 34.2 |
| soil | 858 | 15 | 8.7 | 1946 | 6300 | 32.6 |
| cdk5 | 571 | 15 | 8.1 | 1946 | 5654 | 25.5 |
| exposome | 980 | 18 | 12.4 | 1946 | 9980 | 48.1 |
| proteins | 551 | 16 | 5.5 | 1946 | 3048 | 12.2 |
| spatial | 1224 | 16 | 5.4 | 1946 | 3021 | 14.8 |
| ppicell | 2108 | 37 | 18.3 | 1946 | 15908 | 83.1 |
| flock | 570 | 16 | 3.4 | 1946 | 1028 | 11.4 |
| robots | 958 | 16 | 3.6 | 1946 | 1238 | 11.1 |
| tutorial | 505 | 18 | 4.6 | 2075 | 2014 | 11.6 |
| cellstress | 373 | 14 | 2.7 | 1946 | 283 | 18.1 |
| hello | 300 | 14 | 2.7 | 1946 | 250 | 8.1 |
Start page by type: Document 428 KB, Script 7 files 1,946 KB, Font 2 files 35 KB, Fetch 5 files 5,301 KB (airports is the default story; its narration 4,570 KB is in that).

## 3. Headset logs (notes/*/note.json, `frame times` rows every 10 s, Quest 3 Browser, VR session, all 120 Hz)
Every row's js, calls and tri read 0 (the headset log did not fill them). All five notes are in the studio, not a story.
| note | release | studio scene (items) | rows | p50 ms | p95 ms | max ms | late per 10 s | fps |
|---|---|---|--:|---|---|---|---|--:|
| 20261125-075001-trqh | v200 | tracker-guide (36) | 18 | 8.8-9.3 | 10.8-12.3 | 12.6-318 | 2-38 | 115 |
| 20261125-075143-h630 | v200 | bliss-xp (172) | 19 | 8.3-11.8 | 9.8-14.3 | 14.4-318 | 3-147 | 105 |
| 20261125-110746-ks6w | v203 | studio-tour (145) | 10 | 8.3-10.3 | 9.3-16.8 | 14.3-196 | 1-258 | 111 |
| 20261126-054819-671e | v212 | tracker-guide (66) | 12 | 9.8-10.8 | 11.3-12.8 | 15-87 | 7-58 | 101 |
| 20261126-055010-4s92 | v212 | tracker-guide (66) | 19 | 8.3-11.3 | 8.8-12.8 | 15-87 | 2-56 | 120 |
(8.33 ms is one 120 Hz frame.) The notes list has 98 notes, all kind headset; no run logs (kind run) exist, so nothing was pulled to runs/ and `notes.mjs perf` had nothing to read.

## 4. Sizes
Per package (main.js, narration MP3s, everything else except src/); also sizes.txt:
| package | main.js KB | narration KB | other KB | total MB |
|---|--:|--:|--:|--:|
| airports | 701 | 4570 | 19 | 5.3 |
| cdk5 | 1573 | 4050 | 2086 | 7.7 |
| cellstress | 253 | 0 | 8 | 0.3 |
| endo | 1021 | 3697 | 37 | 4.8 |
| exposome | 1566 | 4696 | 3965 | 10.2 |
| flock | 229 | 768 | 21 | 1.0 |
| hello | 220 | 0 | 59 | 0.3 |
| lbi | 794 | 5143 | 62 | 6.0 |
| micro | 708 | 3885 | 40 | 4.6 |
| mutation | 473 | 4048 | 33 | 4.6 |
| nmd | 899 | 4287 | 37 | 5.2 |
| ovary | 435 | 3738 | 28 | 4.2 |
| pass | 1029 | 6486 | 28 | 7.5 |
| pet | 721 | 2908 | 37 | 3.7 |
| ppicell | 2239 | 7266 | 7524 | 17.0 |
| proteins | 241 | 2777 | 19 | 3.0 |
| qubits | 358 | 4267 | 28 | 4.7 |
| robots | 338 | 870 | 22 | 1.2 |
| soil | 964 | 5306 | 37 | 6.3 |
| spatial | 270 | 2721 | 20 | 3.0 |
| topo | 1504 | 4233 | 33 | 5.8 |
| tutorial | 267 | 1717 | 22 | 2.0 |
`sw.js` SHELL: 28 entries, 5,936 KB total (index.html counted for './' and for itself, 428 KB each, so 5,508 KB without the repeat). Largest: stories/studio.js 2,331 KB; shared.js 1,071; three.min.js 603; index.html 428; stories/design.js 213; output.js 114; ships.js 87; peerjs.min.js 87; sfx.js 77; bodies.js 74; flight.js 61; ik.js 55; occlusion.js 54; icon-512.png 49; notes.js 48; maskable-512.png 41; lowpoly.js 28; the three B612 fonts 49 together; the rest under 16 KB.

15 largest files fetched at start (start page, airports default story; bytes on the wire):
1. packages/airports/audio/narration.mp3 4,570,053
2. shared.js 1,071,505
3. packages/airports/main.js 701,437
4. three.min.js 603,641
5. index.html 428,074
6. ships.js 87,389
7. sfx.js 77,528
8. occlusion.js 53,967
9. notes.js 48,504
10. packages/index.json 27,245
11. fonts/B612-Regular.woff2 21,350
12. fonts/B612-Bold.woff2 13,434
13. stories/list.js 2,986
14. version.json 2,024
15. api/ping 521
(Only 15 requests in all.) Note: studio.js, bodies.js, ik.js, flight.js, output.js are not fetched at start.

## Where the time and bytes go
Draw calls (mean, both eyes; story chapters): ppicell 25% 97; lbi 25% 66; endo 75% and explore 60 (52 at 25%); pass 75% 60 (explore 53); spatial 25% 58 and qubits 25% 57. Outside stories: design room 204, studio bliss-ar 88, bliss-vr 84, studio heavy editing 75, room station+6 people 58.
Triangles (k): studio heavy 898-902; endo 25% 689; ppicell 25% 553; micro 50% 505; pet 25% 424.
JS per frame (mean, software draw not included): ovary 50% 3.5 ms; micro 50% 2.1; endo 25% 1.7; micro 25% and ovary 25% 1.8 and 1.8; nmd 25% 1.6; studio bliss 1.5. Worst single frames: nmd 50% 30.6 ms; pass 50% 30.4 (10.8 on the repeat); ovary 50% 28.5; micro 50% 21.7; tutorial 25% 20.9. Frames over 11.1 ms of script: pass 50% 3 (batch 3), qubits 25% 2, soil 50% 2, tutorial 25% 2, else 1 or 0. Heap allocated per frame: ovary 50% 2,525 KB, ovary 75% 1,461, ovary 25% 841, nmd 25% 735, endo 25% 642 (a normal chapter is 30-60 KB).
Load time to ready (ms): ppicell 2,108; lbi 1,869; pass 1,858; pet 1,614; micro 1,486 (spatial 1,224, endo 1,260). Heap after load (MB): lbi 98.7; ppicell 83.1; endo 51.2; ovary 50.0; micro 49.2. Shader programs at the end of a story: lbi 87, endo 76, pass 72, micro 69, pet 66.
Bytes fetched to be ready (MB): ppicell 18.3 (27 requests; narration 7.3, main.js 2.2); exposome 12.4 (narration 4.7, diseases.bin 1.7, main.js 1.6); soil 8.7; lbi 8.4; topo 8.2. Of every story's bytes 1.9-2.4 MB is the shell's scripts and the document, and the narration MP3 is the largest single file in every story with one (3.7-7.3 MB). On disk, package totals: ppicell 17.0 MB, exposome 10.2, cdk5 7.7, pass 7.5 (two narrations), soil 6.3. Largest main.js: ppicell 2.24 MB, cdk5 1.57, exposome 1.57, topo 1.50, pass 1.03. Largest non-main.js non-audio data: ppicell 7.5 MB, exposome 4.0, cdk5 2.1.

## What could not be measured here
- GPU time, real frame rate and fill rate: software drawing; "render" ms in the tables is only submit time.
- Anything in a headset session (two-eye XR rendering, quad layers, occlusion, compositor): the headset logs have js/calls/tri as 0, and only studio scenes were logged, not a story.
- Load over a real network: local server, no compression, no CDN, no caching, service worker off; a warm start from the service worker cache and offline were not measured. Narration decode time and the audio engine's cost were not measured (bytes only).
- Load times are single runs, run while other agents were reading the machine; differences under about 200 ms are noise.
- flock, robots, cdk5, exposome, proteins, cellstress and hello have load numbers but no per-frame numbers; the German pass narration is not fetched in the English run.
- Phones and tablets, shared rooms with real peers (room:station+6people is simulated), peak memory over a full story, and long-run leaks (heap per frame is one 120-frame window each).

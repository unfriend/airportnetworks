# Chunk 26 (+47): example-scene generators (tracker guide, Bliss XP) and nine small files
Read: tools/studio/tracker-guide/layout.mjs (166)
Read: tools/studio/tracker-guide/make.mjs (133)
Read: tools/studio/tracker-guide/page.html (22)
Read: tools/studio/tracker-guide/parts.js (509)
Read: tools/studio/tracker-guide/script.json (15)
Read: tools/studio/tracker-guide/voice.mjs (31)
## working notes
- du: examples/bliss-xp 6.2M (66 glb, 66 jpg, 17 wav = 1.4 MB), studio-tour 2.0M (42 glb, 12 jpg, 10 wav = 244 KB), tracker-guide 4.3M (17 glb, 8 jpg, 9 mp3 1.4 MB). jpg previews total 796 KB.
- layout counts: bliss 81 objects/66 distinct models, 22 cubes, 35 sounds, 24 sequences; tour 50 obj/42 models, 68 shapes; guide 25 obj/17 models, 21 shapes, 9 cubes, 9 sounds.
- voice MP3s committed TWICE: tools/studio/tracker-guide/voice/NN.mp3 (1.4 MB, tracked) and examples/tracker-guide/sounds/voice-NN.mp3 (byte-identical, cmp SAME). make.mjs:36-37 copies.
- voice.mjs:15-19 --check uses mtimes vs script.json: meaningless after git checkout (all mtimes = checkout time) -> says "every line rendered" even if stale. Hash of text in a sidecar would be honest.
- robot.glb 986 KB: 8 clips (Idle, Wave, 5 stands, Line up), 24-25 tracks each, 535 KB of float keyframes (20 fps, parts.js:19 FPS=20, ~70 s of clips). Every bone gets a quaternion track even when constant. character.glb 385 KB repeats the mesh with one clip. pucks-2 479 KB.
- parts.js:376-383 bakes each stand twice (warm-up pass): build cost only, fine.
- make.mjs:121 --check compares glb/jpg within 2 % size only: a changed model of same size passes; fine as intended but means binaries are not verified for content.
Read: tools/studio/xp/kit.js (662)
- kit.js:225-226 XP.face: texture width 900 px/m clamped 256..1024 -> most windows/panels get their own 512-1024 px texture (one mesh + one texture each). GLB embeds JPEG q0.8 (kit.js:564-566); exporter maxTextureSize 1024 (651). Studio supports KTX2 (basis/, v151) but generators never emit it: every texture decoded to RGBA in GPU memory (1024x1024 ≈ 5.3 MB with mips). 
- kit.js:260-293 XP.merge welds via string keys (build-time only). Each part = 1 mesh 1 material for window/panel; lit parts merge by vertex colours. Good.
- tracker-guide page.html:13-15 re-wraps toBlob at 0.62 on top of kit.js:565 (0.8): two monkeypatches, order dependent (works because page.html passes explicit q into kit's).
- kit.js:572-577 picture renderer is a second WebGLRenderer 512px: build only.
Read: tools/studio/xp/layout.mjs (452)
- xp/layout.mjs: 81 objects; 12 balloon-ish/close/hourglass extras riding on windows (203-211: 4 close buttons + 4 loader hourglasses + 2 media buttons = 10 objects, each own draw); 4 cards + 2 pages; 9 clouds (5 room, 4 VR sky).
- 35 sound records over 17 WAVs; click.wav used by 11 records (fine: file once).
- 12 key cubes (310) = 6 keys x 2 room sizes.
- Helpers r4/r3/yawQ/obj()/id checks duplicated in tracker-guide/layout.mjs:18-20,75-92,157 and xp/layout.mjs:28-29,58-72,391 (and tour?).
- checkLayout (389-452) is also the smoke test's (comment 384): good, single copy.
Read: tools/studio/xp/make.mjs (131)
Read: tools/studio/xp/page.html (27)
- Three make.mjs (xp 131, tour 127, tracker-guide 133 lines) share 62-84 identical lines pairwise: Playwright launch+route (xp 35-50, tg 41-57), part loop+log (xp 56-70, tg 63-75), contact sheet (xp 71-80, tg 78-88, identical but cols 8/4), write/walk/remove stale (xp 99-109, tg 107-131), --check compare (xp 113-130, tg 114-127). ~70 lines x3 -> one tools/studio/examples-make.mjs helper (runPage(allow, url), writeOrCheck(files, scene)).
- xp/make.mjs:102 `failed = !!process.exitCode && !check` vs tg/make.mjs:110 `failed = !!process.exitCode` (check also skips) -> drift between copies already.
- xp/make.mjs:107 & 124 define walk twice in one file.
- Budgets: xp folder < 6 MB (28,97) yet bliss-xp is 6.2 MB du / 6,057,367 bytes per index.json (5.78 MiB): ~3.5 % headroom. 
Read: tools/studio/xp/parts/balloons.js (45)  - 6 balloons, each XP.balloon: 1 mesh, own 640-px texture (W:640, balloons.js:8,28)
Read: tools/studio/xp/parts/clippy.js (82)    - clippy 7 meshes/3 materials (wire, 2x white/pupil/brow; animated separately, needed); lounge 1 mesh
Read: tools/studio/xp/parts/clouds.js (39)    - 1 mesh, unlit, no texture: cheap. 9 placed.
Read: tools/studio/xp/parts/cursors.js (64)   - hourglass 4 meshes incl. a transparent glass (cursors.js:46, depthWrite false), placed 5x (desktop + 4 loaders, layout.mjs:202) = up to 20 draws, 5 transparent; loaders hidden except 1.2 s.
Read: tools/studio/xp/parts/grass.js (44)  - each grass model = 4 clump meshes + turf = 5 draws (grass.js:26-39), placed 3x (layout 214-216) = 15 draws for grass alone. Clumps exist only to sway separately: one skinned mesh with 4 bones (as tracker-guide/parts.js:128-207 already does for pucks) -> 1 draw per patch, saves ~12 draws.
Read: tools/studio/xp/parts/icons.js (108) - each icon = thing mesh + label panel (own 512-px canvas texture, icons.js:8) = 2 draws, 5 instances (4 icons + bin) = 10 draws and 5 label textures. 
Read: tools/studio/xp/parts/landscape.js (88) - hill 1+40x72 verts (light), sky 1024x512 texture, starfield 3 meshes sharing 1 geometry. VR-only. Fine.
Read: tools/studio/xp/parts/media.js (58)   - media-player = face + 10 bar meshes each its own node (media.js:47-52) = 11 draws for a window; one skinned mesh with 10 bones (scale per bone) = 1 draw (-10).
Read: tools/studio/xp/parts/pressables.js (90) - close/play/stop buttons 1 draw each (6 placed); cards 2 meshes (card + ball) each with own 256-px texture x4; page 512 px x2 (same model).
Read: tools/studio/xp/parts/screens.js (136) - boot = slab + 3 block meshes (4 draws; screens.js:43-46); welcome 1024 px; safe-off: extruded traced text, 116 KB glb with no texture; wallpaper 3 m wide at 1024 px (AR only).
Read: tools/studio/xp/parts/solitaire.js (65) - felt+trail merged (1 draw) + 4 running card meshes (solitaire.js:57-58) = 5 draws; the 4 cards could be bones of one skinned mesh (1 draw).
Read: tools/studio/xp/parts/taskbar.js (103)  - 5 taskbar pieces + start menu, 1 draw each, each own texture (1024/512/1024/512/640 px). Bar 3 m x 0.14 m at 1024 px wide -> face 1024x48+8 (fine).
Read: tools/studio/xp/parts/things.js (94)    - door 4 meshes (frame, outside picture, leaf, handle), phone 3, crt 4 (incl. transparent shell, things.js:76), duck 1.
Read: tools/studio/xp/parts/titles.js (11)    - extruded traced text, 1 draw each.
Read: tools/studio/xp/parts/trail.js (23)     - 12 window copies merged (1 draw; 151 KB glb because 12 copies of the slab geometry are baked; overdraw of 12 stacked opaque slabs).
- Draw tally from parts (bliss as placed, all shown): grass 15, hourglasses 20, media player 11, clippy 7, icons+bin 10, cards 8, pages 4, boot 4, door 4, crt 4, solitaire 5, phone 3, starfield 3 ... matches the measured 84-88. Merge candidates (skinned bones instead of node-per-piece): grass -12, media bars -9, solitaire cards -4, boot blocks -3 => ~28 fewer draws (~1/3).
Read: tools/studio/xp/parts/windows.js (255) - ~17 windows, each 1 draw but each its own canvas texture 448-1024 px (XP.face width 900 px/m).
- MEASURED (node, read-only, embedded image headers of the GLBs as placed): bliss-xp 48 textures = 13.8 Mpx -> ~70 MB GPU as RGBA+mips; 140 primitives as placed (108 unique). tracker-guide 16 tex 5.7 Mpx ~29 MB, 42 prims. studio-tour 34 tex 10.1 Mpx ~51 MB, 74 prims. All JPEG (1.3 MB, 0.5 MB, 0.96 MB on disk). docs/agents/studio.md:45,122ff: studio supports KTX2 (UASTC -> ASTC 4x4, 1 byte/px) since v151 and uploads default to it, but none of the three generators emits KTX2 (kit.js:651 exporter, JPEG).
- textures are NPOT (640x854, 704x536 ...): fine on WebGL2 (Quest), but in WebGL1 r128 rescales to POT.
Read: tools/studio/xp/sounds.mjs (185) - 17 mono 16-bit 22,050 Hz WAVs, 1.37 MB; startup 4.4 s=194 KB, outdoors 7 s=265 KB, music 5.4 s=212 KB. Pure Node, byte-deterministic. tour/sounds.mjs repeats rng (sounds.mjs:5 = tour/sounds.mjs:5 = kit.js:11), wav(), buf, note/hz, bell, norm, seamless/seam: a shared tools/studio/synth.mjs would hold them once. Encoding to Opus/MP3 64k (voice.mjs already uses ffmpeg with -fflags +bitexact) would cut ~1.4 MB to ~0.15 MB; decoded size in memory unchanged.
Read: .claude/hooks/session-start.sh (80)
Read: .claude/settings.json (32)
Read: .gitattributes (5)
Read: .gitignore (42)
Read: CNAME (0 lines, 22 bytes, no trailing newline)
Read: PEERJS-LICENSE.txt (22)
Read: docs/narration-timings.txt (221)
Read: fonts/OFL.txt (93)
Read: three.LICENSE.txt (21)
- narration-timings.txt: lines 112-197 are a second, older copy of every story's paragraph ("looks for ..."), with other timings (proteins ends 5:48 at :83 vs 4:38 at :116; lbi :25-28 vs :123-131; nmd 8:56 vs 7:47 ...). Line 112 is an orphan fragment "Recording a narration, step 3)." Second half lacks cdk5/exposome/ppicell/tutorial.
- .gitignore: shots/ listed per package (13 lines, 3-15,32-36) but packages/cdk5/src and packages/soil/src have shot.mjs writing shots/ (shot.mjs:8) and are not ignored (git check-ignore); also airports/ppicell/... One line `packages/*/src/shots/` covers all. `.claude/settings.local.json` is not ignored though CLAUDE.md tells people to override there and the git rules say never commit it.

# FINAL
# Chunk 26 + 47: example-scene generators (tracker guide, Bliss XP) and nine small files
Read: all 27 files of chunk-26 (tracker-guide: layout.mjs 166, make.mjs 133, page.html 22, parts.js 509, script.json 15, voice.mjs 31; xp: kit.js 662, layout.mjs 452, make.mjs 131, page.html 27, parts/*.js 16 files 1,350, sounds.mjs 185) and all 9 of chunk-47 (session-start.sh 80, settings.json 32, .gitattributes 5, .gitignore 42, CNAME, PEERJS-LICENSE 22, narration-timings.txt 221, OFL.txt 93, three.LICENSE 21).
Measured (read-only): du examples/bliss-xp 6.2M (66 glb, 66 jpg, 17 wav), studio-tour 2.0M, tracker-guide 4.3M (9 mp3). Layouts: bliss 81 objects/66 models/22 cubes/35 sounds/24 sequences; tour 50/42 + 68 shapes; guide 25/17 + 21 shapes, 9 cubes, 9 sounds.
## Findings
### Example scenes ship JPEG textures: ~70 MB of GPU memory for the Bliss XP room   [perf-frame]  gain: high  risk: low  sure: confirmed
Where: tools/studio/xp/kit.js:225-226 (XP.face 900 px/m, up to 1024), 564-566, 651 (exporter, JPEG q0.8)
What: Reading the embedded image headers of the GLBs as placed: bliss-xp 48 textures, 13.8 Mpx -> ~70 MB RGBA+mips on a Quest; studio-tour 34 textures ~51 MB; tracker-guide 16 ~29 MB. Since v151 the studio loads KTX2 (UASTC -> ASTC 4x4, 1 byte/px; docs/agents/studio.md:45,122) and uploads default to it, but none of the three generators emits it.
Change: give XP.make an option to write KHR_texture_basisu (the studio's own engine/ktx2.js encoder, in the same headless page) -> ~18 MB for bliss; or at least halve XP.face's 900 px/m for wall windows read from 1-2 m. Weigh the larger files on disk (UASTC) against ETC1S.
### Node-per-piece animated parts cost ~28 draw calls in the Bliss XP room   [perf-frame]  gain: high  risk: low  sure: confirmed
Where: xp/parts/grass.js:26-39 (4 clump meshes + turf, x3 placed = 15 draws), media.js:47-52 (10 bar meshes), solitaire.js:57-58 (4 running cards), screens.js:43-46 (3 boot blocks); cursors.js:46 hourglass 4 meshes x5 placed (layout.mjs:202)
What: Measured 84-88 draws; the tally from the parts matches (140 primitives as placed). Each moving piece is its own Mesh only so a clip can move a node.
Change: build each as one SkinnedMesh with a bone per piece, as tracker-guide/parts.js:128-207 (devices) and :442-469 (countdown) already do -> grass 3 draws not 15, media 2 not 11, solitaire 2 not 5, boot 2 not 4: about 28 fewer (a third). The hourglass's frame and sand could merge too (sand scaled by bones).
### The tracker guide's voice is committed twice (1.4 MB)   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: tools/studio/tracker-guide/voice/00-08.mp3 (tracked) and examples/tracker-guide/sounds/voice-NN.mp3; copied by make.mjs:36-37
What: cmp says byte-identical; 1.4 MB in two places.
Change: let voice.mjs write straight into examples/tracker-guide/sounds/ and make.mjs read from there (or git-ignore voice/).
### Three generator drivers copy ~70 lines each, already drifting   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: xp/make.mjs:35-50,56-80,99-130; tracker-guide/make.mjs:41-57,63-88,107-132; tour/make.mjs:38-127
What: Playwright launch and route, the part loop and its log, the contact sheet, write/remove-stale, --check compare: 62-84 identical lines pairwise. Drift: xp/make.mjs:102 `failed = !!process.exitCode && !check` vs tracker-guide:110 without `&& !check`; xp defines walk twice (107, 124). Also r3/r4/yawQ/obj()/id checks repeated in xp/layout.mjs:28-29,58-72 and tracker-guide/layout.mjs:18-20,75-92,157 and tour/layout.mjs:14-16; rng repeated in kit.js:11, xp/sounds.mjs:5, tour/sounds.mjs:5 with wav()/bell/norm/seam.
Change: one tools/studio/examples.mjs (runPage, writeOrCheck, sheet) and one synth.mjs for the WAV helpers; each make.mjs keeps only its list and budgets. Saves ~200 lines an agent reads.
### Uncompressed WAVs: 1.6 MB of the example scenes   [perf-load]  gain: medium  risk: low  sure: confirmed
Where: xp/sounds.mjs:56-64 (16-bit 22 kHz mono), 17 files 1.37 MB (outdoors 265 KB, media-music 212 KB, startup 194 KB); tour 244 KB
What: Fetched by every headset opening the scene; bliss-xp is 5.78 MiB against make.mjs:28's 6 MB cap (3.5 % headroom).
Change: encode as voice.mjs:27 already does (ffmpeg, -fflags +bitexact, 64 kb/s) -> ~0.2 MB; --check can compare the WAV bytes before encoding.
### docs/narration-timings.txt holds a stale second copy of every story   [md]  gain: medium  risk: low  sure: confirmed
Where: docs/narration-timings.txt:112-197 (and orphan fragment :112 "Recording a narration, step 3).")
What: The "looks for ..." paragraphs repeat :6-110 with old timings that contradict them (proteins ends 5:48 at :83 vs 4:38 at :116; nmd 8:56 vs 7:47; lbi given twice, :25 and :123); cdk5, exposome, ppicell, tutorial appear only in the first half. Every number also lives in each story's NARRATION_SYNC/ENDS.
Change: delete :112-197; better, have tools/narration.mjs write the timings from NARRATION_SYNC/ENDS so the file cannot go stale, keeping only "Recording a narration" by hand.
### .gitignore misses shots folders and settings.local.json   [md]  gain: medium  risk: low  sure: confirmed
Where: .gitignore:3-15,32-36
What: 13 per-package `shots/` lines, but packages/cdk5/src and packages/soil/src have shot.mjs writing `shots/` (shot.mjs:8) and are not ignored (git check-ignore). `.claude/settings.local.json`, where CLAUDE.md says to put personal overrides and which the git rules say never to commit, is not ignored.
Change: one line `packages/*/src/shots/` in place of the 13; add `.claude/settings.local.json`.
### voice.mjs --check compares mtimes, meaningless after a checkout   [bug]  gain: low  risk: low  sure: confirmed
Where: tools/studio/tracker-guide/voice.mjs:15-19
What: After git clone every file has the checkout time, so it says "every line rendered" even when script.json changed.
Change: store a hash of each line's text (as make's --check does for bytes) and compare that.
### robot.glb: 535 KB of the 986 KB is keyframes   [perf-load]  gain: low  risk: low  sure: confirmed
Where: tracker-guide/parts.js:19 (FPS 20), 383, 486
What: 8 clips (about 70 s) x 24 bone tracks at 20 fps, written even where a bone barely moves.
Change: drop constant tracks and take 10-15 fps (the solver's motion is smooth), or prune with a tolerance before clipOf.
## Not worth changing
- xp/layout.mjs checkLayout (389-452) is the smoke test's too: one copy, fine. Ids, sequence and press checks are build-time only.
- Clouds, titles, safe-off and the trail are already one mesh each. The 12 merged copies in trail.js (151 KB) are a small overdraw cost only.
- The landscape and starfield are VR-only and light (one 1024x512 sky, 2,881 hill vertices, the starfield's geometry shared by its 3 layers).
- Do the generated binaries need committing? Yes while GitHub Pages serves main as is: there is no build step there. --check compares models and pictures by size within 2 % only (make.mjs:121), so it cannot prove the content anyway.
- session-start.sh: careful (exits 0, never resets, timeouts). settings.json, .gitattributes, CNAME and the three licence texts are current. node_modules as a symlink is covered by `node_modules`.

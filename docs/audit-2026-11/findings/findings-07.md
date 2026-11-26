# Chunk 07: story packages' READMEs, SPECs and set notes (nmd to topo)
Read: packages/nmd/src/README.md (26 lines)
Read: packages/nmd/src/SPEC.md (224 lines)
Read: packages/nmd/src/sets/hpc.md (78 lines)
Read: packages/nmd/src/sets/motor.md (167 lines)
Read: packages/nmd/src/sets/tower.md (161 lines)
Read: packages/ovary/README.md (7 lines)
Read: packages/ovary/src/README.md (32 lines)
Read: packages/ovary/src/SPEC.md (220 lines)
Read: packages/ovary/src/sets/charts.md (45 lines)
Read: packages/ovary/src/sets/organ.md (80 lines)
Read: packages/ovary/src/sets/section.md (115 lines)
<!-- notes so far (to be shaped into findings):
nmd SPEC l.3 "We are adding a fifth story ... /home/user/airportnetworks", "about seven-minute" (AGENTS: about nine); SPEC = builder brief, sets/*.md = as built; numbers differ (126,000 vs 125,463 links; tower cams lack `z`; motor length 2.4 vs 2.5).
nmd SPEC l.20-33 idle/finish/BUILD/keepClear contract text repeated in ovary SPEC l.145-149 and elsewhere; names `engine/e2_scene.js`, `e5_xr.js` - exist in packages/nmd/src/engine (per-story copies of tools/engine).
ovary SPEC: l.10 "Six chapters, about seven minutes" vs l.14-15 "about four-and-a-half-minute", l.165 "Chapters (4:30 of story time", AGENTS "about eight"; l.24 "after the microanatomy story in HOST.list" and l.155 "the length in HOST.list" (now packages/order.json / story.json); l.212 "FORMAT networks-19", "thirteen stations (seven and six)"; l.144 "room for thirteen stories"; section.md l.74 "chapters 3, 4 and 7" (six chapters now). SPEC l.33-44 Files table = src/README.md l.16-26 table. SPEC l.79-136 set summaries = sets/*.md (SPEC lacks kindsLabel, byKind, hubs, age20..age70 anchors).
-->
Read: packages/pass/README.md (7 lines)
Read: packages/pass/src/README.md (41 lines)
Read: packages/pass/src/SPEC.md (226 lines)
Read: packages/pass/src/sets/cell.md (74 lines)
Read: packages/pass/src/sets/fish.md (136 lines)
Read: packages/pass/src/sets/globe.md (76 lines)
<!-- pass notes: src/README l.11 "after airports.js or spatial.js changed" (old names; gen/ has files of that name too). SPEC l.196-226 "Tested, untested, open" = 31 lines of run history (temporary scripts Oct 2026, "Part 2 tested", "part 2's"). SPEC l.72-84 "sets in short" and l.86-118 keys repeat sets/*.md "Suggested story keys"; outbreak numbers 3x (SPEC l.88-90, globe.md l.23-25, test). -->
Read: packages/pet/README.md (7 lines)
Read: packages/pet/src/README.md (36 lines)
Read: packages/pet/src/SPEC.md (372 lines)
<!-- pet SPEC notes: l.3-22 a 20-line change log before anything else; l.24-27 "ninth story ... /home/user/airportnetworks ... five-and-a-half-minute" vs l.21 6:33; l.160 dead absolute path to another session's scratchpad (/tmp/claude-0/.../8bba4ed7-.../scratchpad/s9/vision.png); l.108-120 + l.34-38 + l.129-131 the poster's facts/palette "no longer shown" (about 25 lines), with `git show b7053fb^:tools/pet/...`; l.146 "Until the real icons arrive, a stub"; l.51-53 server/playwright how-to; l.367-372 Deliverables (builder brief, same text in nmd SPEC l.219-224). -->
Read: packages/pet/src/sets/icons.md (101 lines)
Read: packages/pet/src/sets/liver.md (146 lines)
Read: packages/pet/src/sets/organs.md (261 lines)
Read: packages/pet/src/sets/scan.md (248 lines)
<!-- pet set notes: organs.md l.83-105 "For the engine (what it does today and what it should do)" builder-to-integrator to-do list (check if done); scan.md l.132 "`vision` 305-330" chapter (gone 28 Oct); scan.md l.229-244 "Deviations from the spec" while SPEC l.158-220 keeps the original brief; icons.md 9 KB for pane-only icons, l.92-101 Testing names shots/icons-test.html, icons-shot.mjs; liver.md l.65 "one chapter of about 20 s" (explore only). Performance sections with "while other agents were running". -->
Read: packages/ppicell/README.md (147 lines)
Read: packages/ppicell/src/SCRIPT-sides.md (93 lines)
<!-- ppicell notes: README l.1,5-6 "a story package, in development ... Hidden while it is made" vs AGENTS "on the main cards since v188"; SCRIPT-sides.md = the v205 script "for stage B", a finished work order (words now in e3_story.js); README l.77 src/narration-v204-old.mp3 kept "delete once liked". README is this package's src/README too (no src/README.md) - 13 KB: licences + voice + wwiznet export + enrichr one-liners + build list. -->
Read: packages/ppicell/src/SPEC.md (661 lines, 67,916 bytes)
<!-- ppicell SPEC notes: 68 KB, the largest; a stack of plans turned "done": l.73-100 chapter table "is the first plan" (8 chapters, 540 s) under a v205 list of 9 chapters/716 s; l.130-144 build plan with token budget and Builder A/B; l.146-162 two "owner's headset notes, done"; l.183 heading "Membrane sides and complexes (planned...)" though stages A, B done; l.291 "Your own network (planned ...)" then "Status: done"; l.204-206 "narrate ... not on a cloud machine" contradicted by l.508 and CLAUDE.md; l.29-32 "mitochondria ... taken to be in the matrix (its membranes ... not told apart)" contradicted by v205 (README l.45-48, SPEC l.195, l.242); l.45 "a finding (chapter 6)" now chapter 7; shared state given 4 times (l.113 no v, l.120 v:3 networks-57, l.333 v:4 networks-58, l.434 v 5 networks-59; shared.js is networks-61); l.208-289 Stage A counts (82 lines of numbers that test-sides.mjs recomputes); measured/tested paragraphs l.335-345, 393-401, 448-473, 589-596; enrichr coverage numbers twice (l.600-602, l.647-648); export options in README l.96-104 and SPEC l.523-526. -->
Read: packages/proteins/README.md (7 lines)
Read: packages/qubits/README.md (7 lines)
Read: packages/qubits/src/README.md (28 lines)
Read: packages/qubits/src/SPEC.md (229 lines)
Read: packages/qubits/src/sets/chart.md (56 lines)
Read: packages/qubits/src/sets/cube.md (83 lines)
Read: packages/qubits/src/sets/pairs.md (60 lines)
<!-- qubits notes: SPEC l.154 shared state `{ tab, scene, ctl, brick, sum, gal }` ("Done in part 2") vs l.220 `{ tab, scene, ctl, net, cut, bits, alg, brick, sum }`; l.157-161 "Rename everything ... remove the body, tissue and organ code" (brief for the engine builder, done); l.229 "(once the engine is adapted)"; l.163 "about 4:50 ... before pacing" vs l.155 9:04. Otherwise the cleanest SPEC of the chunk: the QMATH API (l.79-117) is reference an agent needs. -->
Read: packages/robots/README.md (7 lines)
Read: packages/robots/src/README.md (51 lines)
Read: packages/robots/src/SPEC.md (325 lines)
Read: packages/robots/src/sets/robots.md (205 lines)
<!-- robots notes: SPEC l.3 "A seventh story ... /home/user/airportnetworks"; l.290-315 "Integration" all stale and against today's rules: HOST.list entry in index.html (now story.json), '"six stories" -> "seven stories" everywhere' (AGENTS: no count of stories anywhere), `proteins.js`, `spatial.js`, `tools/robots`, add main.js to sw.js SHELL and the audio list (packages are their own), manifest "seven stories", AGENTS section. SPEC l.47-196 (150 lines: room, floor, robots, rules, crumbs, player, links, params table, exports, anchors) is the brief that sets/robots.md l.7-171 restates as built (robots.md adds `under`, `shift`, `avatar`, `onBump`); Science para twice (SPEC l.317-325, robots.md l.198-205). src/README l.13 "and bump VERSION in sw.js" vs AGENTS v193 (a package-only change needs no new VERSION) and no scan step. src/README l.31-51 "The headset's room" = SPEC l.250-280. -->
Read: packages/soil/README.md (7 lines)
Read: packages/soil/src/README.md (49 lines)
Read: packages/soil/src/SPEC.md (419 lines)
<!-- soil SPEC notes: 40.6 KB two-builder brief. l.10-21 integrator para + card for `HOST.list`/`stories/list.js` (now story.json; desc text differs from the shipped one); l.73 "The stubs in sets/ ... replace their bodies", "Anchors (stub)", "Views (stub)" x3; l.281 "Only if time allows"; l.328-342 a 15-line hand-over note already marked "Overtaken (26 Nov, v212)" but kept; l.344-388 chapter texts "a draft" (the real words are e3_story.js, docs/narration.md); l.418 "once the story is in HOST.list"; "7.5 minutes before pacing" vs 11:03. The verdict (2 of 3,384; 38,653/30,276; 158 to 27,758; N2O 0.81 vs 0.98) is written out in src/README l.40-46, SPEC l.33-44, SPEC l.169-185 and the story's small print. Data fields l.141-197 = data.js's own header ("its header lists every field"). -->
Read: packages/soil/src/sets/field.md (100 lines)
Read: packages/soil/src/sets/net.md (72 lines)
Read: packages/soil/src/sets/soil.md (89 lines)
Read: packages/spatial/README.md (7 lines)
Read: packages/topo/README.md (7 lines)
Read: packages/topo/src/README.md (47 lines)
Read: packages/topo/src/SPEC.md (351 lines)
<!-- soil sets: field.md l.47-52 "**new** ... add to the engine's STEP" (to-do to the engine builder; check), l.49 `field_life` "not built". topo SPEC: l.11-19 card for `HOST.list`; l.200-203 "computed? no: draw ... or, simpler" (brief thinking aloud); l.263-272 "Copied from ... Rename everything ... remove the mutation story's own code"; l.274-325 draft chapter texts; l.347 "once the story is in HOST.list"; hashes and collab.state in src/README l.32-43 (as built) and SPEC l.338-342 (as planned). -->

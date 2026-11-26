# Chunk 08: the tutorial's and topo's notes, relay/README.md, the tools' READMEs and SPECs
Read: packages/topo/src/sets/cohort.md (172 lines)
Read: packages/topo/src/sets/map.md (154 lines)
Read: packages/topo/src/sets/slide.md (120 lines)
Read: packages/topo/src/sets/tower.md (137 lines)
Read: packages/tutorial/README.md (7 lines)
Read: packages/tutorial/src/README.md (30 lines)
Read: packages/tutorial/src/SPEC.md (861 lines)
Read: packages/tutorial/src/sets/guide.md (67 lines)
Read: relay/README.md (1810 lines)
Read: tools/design/README.md (32 lines)
Read: tools/design/SPEC.md (86 lines)
Read: tools/design/sets/table.md (18 lines)
Read: tools/engine/SPEC.md (169 lines)
Read: tools/mol/README.md (156 lines)
Read: tools/mol/SPEC.md (104 lines)
Read: tools/notes/README.md (30 lines)
Read: tools/notes/SPEC.md (293 lines)
Read: tools/output/README.md (190 lines)
Read: tools/output/SPEC.md (921 lines)
Read: tools/output/cardinal/README.md (128 lines)
Read: tools/packages/SPEC.md (203 lines)
Read: tools/packages/template/README.md (55 lines)
Total 5,743 lines, 514 KB (about 130k tokens); three files are 65 % of it: relay/README.md 186 KB, tools/output/SPEC.md 79 KB, packages/tutorial/src/SPEC.md 71 KB.

## Findings

### relay/README.md is four documents in one file, for three readers   [md]  gain: high  risk: low  sure: confirmed
Where: relay/README.md, whole file (1,810 lines, 186 KB, 24 headings, no table of contents)
What: It mixes (a) the operator's how-to: l.161-332 "A session on one Wi-Fi" with an 80-line troubleshooting list, l.334-544 Coolify, l.849-930 R2 steps and costs (about 70 KB); (b) the reference an agent needs: flags l.27-113, HTTP API l.1317-1362, WebSocket l.1387-1473, /peerjs l.1530-1587 (about 35 KB); (c) one section per feature (scenes, uploads, video, R2, trackers, OSC, live sound, Talk, notes, nets: about 60 KB); (d) history and comparison (owner quotes, "Compared with asdf10k-collab-backend" l.1612-1655, "Rooms across updates" l.1477-1483 why-they-were-lost). An agent changing one message type must find it in a 46k-token file; lines run to 2,000 characters in table cells (l.85, l.691, l.696, l.1330, l.1336).
Change: Keep relay/README.md as a 10-15 KB front page: what it is, the usage line, ONE complete flag and environment table, a contents list linking to the parts, the test command. Split the rest into relay/docs/ (not served: relay/ is outside APP_DIRS): `protocol.md` (WebSocket, HTTP API, /peerjs, rooms on this network, rooms across updates' rules), `scenes.md` (folder, uploads, video, R2 mechanics), `features.md` or one file each (trackers, OSC, live sound, Talk, notes, nets), `hosting.md` (Coolify, the test place, R2 owner's steps, costs: for the owner), and move "A session on one Wi-Fi" plus its troubleshooting into docs/event-runbook.md (next finding). Owner quotes and the asdf10k comparison go to docs/history.md or `relay/docs/compared.md`. Update the about 15 pointers (`relay/README.md, "<section>"`) in docs/agents/shared-rooms.md, layout.md, shell.md and server.mjs comments in the same change.

### The relay's Testing section is one 140-line sentence that repeats docs/agents/testing.md   [md]  gain: high  risk: low  sure: confirmed
Where: relay/README.md:1665-1805 (about 14 KB, one paragraph, no bullet or line break in sense)
What: Every check of relay/test.mjs since v100 appended with "; and" to a single sentence; docs/agents/testing.md:1436 ("### relay/test.mjs") lists the same checks, and CLAUDE.md names testing.md as the place for "every test and what it checks". Unreadable for a person, 3,500 tokens for an agent, and two copies to keep in step.
Change: Replace with 10 lines: the command, the part flags (add the two missing ones, `--video` and `--nets`; `--logs` also exists in test.mjs), "what each part checks: docs/agents/testing.md, relay/test.mjs", and the tools/peer.mjs paragraph. testing.md keeps the one copy.

### tools/output/SPEC.md and packages/tutorial/src/SPEC.md are build plans kept as the contract   [md]  gain: high  risk: medium  sure: confirmed
Where: tools/output/SPEC.md (921 lines, 79 KB); packages/tutorial/src/SPEC.md (861 lines, 71 KB)
What: Both were written to steer parallel builders and were never turned into reference. output/SPEC.md: "Who owns which file" lane tables (l.53-66, l.670-684, with where in shared.js to paste so "the merge is clean"), "Lane STUDIO/PAGE/RELAY" to-do lists (l.347-445), per-lane test instructions including one dead session scratchpad path and a symlink-then-remove step that CLAUDE.md now forbids (l.450-452), FORMAT said as networks-51 then -52 (now networks-61), three stacked versions (v157 body, "# v158", "# v162") where v158 amends v157's `bt` and Wire 4/5. tutorial SPEC: section A "Registration" (stories/list.js entry, tools/lowpoly/models-b.js, SHELL/AUDIO lists, "sixteen stories", `~l.5319`-style line numbers into index.html and smoke.mjs: all gone since v187/v190), then 42 numbered review notes that correct the plan above them (e.g. note 23 changes chapter 3's times, note 24 the cue count, note 18 says menuOpen() was never added though section E task 5 and G.1 still name it). An agent must read plan plus errata to know what is true. The live wire contracts inside them (output Wire 1-5, layout `send`/`stream`/`trail` fields, sound frame; tutorial B's bodies.js API, C's script tracks) are referenced from shared.js, server.mjs and shared-rooms.md.
Change: For each, keep a reference file of what is true now (output: Wire 1-5 merged with the v158 and v162 changes, layout fields, limits: perhaps 25 KB; tutorial: places, tracks, gestures, props, practice, state: perhaps 15 KB, much of it already in sets/guide.md and src/README.md) and move the plan, lanes, build order and review notes to `PLAN.md` beside it (or docs/history.md), headed "as built at v157/v173, not maintained". Keep section names that code comments cite ("Wire 3", "v158", "v162", "section B").

### "A session on one Wi-Fi" duplicates the event runbook, and the two hostings are told three times   [md]  gain: medium  risk: low  sure: confirmed
Where: relay/README.md:161-332 vs docs/event-runbook.md (61 KB, "1. The day before", "2. Setting up", "5. When things go wrong"); relay/README.md:334-544 vs docs/setup-and-release.md:349 "The relay" and docs/agents/shared-rooms.md:1774-1968
What: The README says at l.24 "the checklist is docs/event-runbook.md; this file is the reference", then gives its own 170-line session guide (shared space flags, tape marks, Arrange all's floor space, calibrate, 20 troubleshooting bullets); `eduroam`/client isolation appears 5 times in each file, "Enhanced spatial services" in both. Coolify set-up: RELAY_ARGS appears 18 times in the README, 5 in shared-rooms.md, 4 in setup-and-release.md.
Change: The session guide and troubleshooting live only in docs/event-runbook.md (merge the bullets the runbook lacks, e.g. the anchor store full, "Maximum number of anchors reached", which is only here). Hosting steps live in one file (the proposed relay/docs/hosting.md or setup-and-release.md section 5); the other two keep a two-line pointer.

### Stale statements in relay/README.md (checked against relay/server.mjs at v216)   [md]  gain: medium  risk: low  sure: confirmed
Where: relay/README.md, lines below
What: (1) l.48 `--build` "run a built story's `tools/<key>/build.mjs`" and l.1373-1385 Hot reload: events described as `stories/<key>.js` and `stories/list.js` changing, builds triggered "under `tools/<dir>/`"; server.mjs:1643-1646 says a package's `main.js` is the `story` event, `packages/index.json` the `list`, and `--build` runs `packages/<key>/src/build.mjs` then the scan (and tools/lowpoly/build.mjs for minis). server.mjs:101's own help text has the same stale wording. (2) l.394-399 "Logs stay off ... the app sends no log token ... and `shared.js` sending the token as `X-Log-Token`" contradicts l.89 and l.1343 (since v145 the app sends the password with its logs and that is accepted in place of the log token; shared.js has no X-Log-Token). (3) l.541 "A redeploy restarts the relay and empties its rooms" contradicts `--keep` (l.387, l.474 "both Coolify resources should have since v136"). (4) l.533-539 "Untested until it runs on Coolify": it has run there since v116/v120 (l.337-339); the list should say what the owner has since seen. (5) The usage line and flag table (l.30-61) omit flags that exist: `--logs <dir>`, `--notes`, `--no-notes`, `--nets`, `--nets-max`, `--no-nets`, `--osc-out`, `--osc-in` (the last five only in their own sections; `--logs`, used at l.322, l.397 and l.1343, has no row anywhere). (6) l.1663 part flags omit `--video`, `--nets`, `--logs`. (7) l.1373 `hello.shell` lists nine files; APP_FILES now has ik.js, bodies.js, flight.js, notes.js too (not verified which the watch fingerprints: check `hello()` when fixing).
Change: Fix in place when the file is split; make the flag table the single complete one (a `--help` paste would do: server.mjs:60-110 already holds it, so the table could be generated).

### Stale paths left from before the packages move (v187/v190) in the small tool docs   [md]  gain: medium  risk: low  sure: confirmed
Where: tools/design/README.md:3; tools/design/SPEC.md:10,83; tools/design/sets/table.md:4; tools/engine/SPEC.md:8-10,31; tools/mol/README.md:28-29,66-67,104-106; tools/packages/SPEC.md:6,17,25,45,59,128-130,151; packages/tutorial/README.md:6
What: design README "every prop of the sixteen stories" (twenty packages in order.json at v216); design SPEC l.10 "everything that lists the stories ... sees only `STORY_LIST`" (empty since v187: they see HOST.packages) and l.83 "all 48 miniatures" (smoke.mjs uses a computed `DESIGN_MINIS`); table.md "miniatures (from `lowpoly.js`)"; engine SPEC "`stories/<key>.js`", "the fourteen built stories", "`FORMAT` goes to networks-54"; mol README offers `tools/<key>/models.json`, `tools/<key>/engine/e2_scene.js` and "a built story (`stories/<key>.js`) ... needs its folder in `sw.js` SHELL" (no tools/<key>/ story or stories/<key>.js exists; an agent following step 5 would edit SHELL needlessly); packages SPEC still words the migration as in progress ("moved into a package or still in `stories/list.js`", "all sixteen by v187", "the same contract as stories/<key>.js", "as in `stories/list.js`"); tutorial README "`src/SPEC.md` where there is one".
Change: One mechanical pass: say "every story package", drop the tools/<key>/ and stories/<key>.js alternatives, replace counts by "every" (the owner's own rule: no count of stories), drop FORMAT numbers from contracts (docs/history.md has the FORMAT history).

### The same endpoint tables are kept in two or three places   [md]  gain: medium  risk: low  sure: confirmed
Where: notes: relay/README.md:1235-1262 and tools/notes/SPEC.md:135-161 (and run logs l.244-264); OSC: relay/README.md:1060-1117 and tools/output/SPEC.md:207-263; live sound: relay/README.md:1127-1164, tools/output/SPEC.md:686-777 and docs/agents/shared-rooms.md:2243; Talk: relay/README.md:1166-1220 and shared-rooms.md:2285 ("is also in relay/README.md"); packages: tools/packages/SPEC.md (17 KB) and docs/agents/packages.md (37 KB; `pkgUrl` 3 vs 9 mentions, `networks-packages` in both); virtual MIDI ports: tools/output/README.md:35-41 and cardinal/README.md:85-88
What: Each wire format is written out by the relay's README and again by the feature's SPEC, with the same limits (2,000 notes, 16 MB, SND_RATE 100, TALK_MAX 8, 2,000 OSC messages a second); a change must be made two or three times, and an agent reads the same 3-6 KB twice.
Change: One owner per contract: the wire (messages, frames, endpoints, limits) in the relay's protocol file; the feature SPECs keep only their own side and link. tools/packages/SPEC.md is the contract, docs/agents/packages.md the shell's implementation notes: cut from packages.md what restates the SPEC.

### tools/engine/SPEC.md is not the engine's spec   [md]  gain: low  risk: low  sure: confirmed
Where: tools/engine/SPEC.md (169 lines, 13.5 KB)
What: Its title is "Arrangements: a story's copy on the relay"; it covers only `arrange`/`HOST.arrange`. AGENTS.md cites it correctly for that, but the name invites an agent looking for the set or engine-part contract (which is packages/lbi/src/SPEC.md, "What a set exports", per the template README) to open the wrong file.
Change: Rename to tools/engine/ARRANGE.md (or add a 5-line SPEC.md index: arrangements here, the set contract in packages/lbi/src/SPEC.md, the parts' list in docs/agents/stories.md).

### History woven into reference text   [md]  gain: low  risk: low  sure: confirmed
Where: relay/README.md owner quotes at l.117-121, 451-458, 548-549, 664-665, 772-773, 980-981, 1224-1225, 1477-1483, 1614-1615; "learnt on 6 November", "the review of v136" (l.1492), "(4029 until v109)", "as before v120"; tools/notes/SPEC.md:3-7, 203-204; tools/output/SPEC.md:3-15, 510-516, 665-668
What: About 6-8 KB of dated quotes and "until vNNN" asides inside rules; CLAUDE.md already names docs/history.md as the place for why rules are as they are.
Change: Move quotes to docs/history.md under the feature's heading; keep at most "(v136)" tags.

## Not worth changing
- packages/topo/src/sets/*.md (four manifests, 53 KB): uniform shape (what it draws, Params table, Anchors, Labels, Cam views, Explore, Sizes, Performance, For the narrator), each read only when its set is touched; numbers agree across the four (6,716 cells, 123 slides, 110 cells, 1,529/5,187). The "For the narrator" bullets are the science rules for that set and belong there. Only nit: keyframe times in the Params tables are "suggested" story seconds that go stale after a narrate.mjs retiming.
- packages/tutorial/src/sets/guide.md and src/README.md: current, short, the right first read for the tutorial.
- tools/mol/SPEC.md, tools/notes/README.md, tools/output/README.md, tools/output/cardinal/README.md, tools/packages/template/README.md: for a person setting something up, well shaped, no stale flags found (`--osc-out`, `--osc-in`, `--trackers`, `--nets*`, `--notes`, `--keep`, `--r2-check`, `--scenes-readonly`, `--ffmpeg-video-limit`, `--allow-no-origin`, `--unlisted`, `--guesses`, `--creates`, `--sockets`, `--store`, `--log-token` all exist in server.mjs; test parts `--rooms --notes --trackers --osc --snd --talk --nets --video --logs` all exist in test.mjs; `MANY.tutorial = 70`, `HOME_RELAY`, `APP_FILES`/`APP_DIRS` lists match the README's l.1345-1354).
- tools/notes/SPEC.md (25 KB): a real contract, one feature, readable; only its relay part repeats the README.
- No code was in this chunk: no perf-frame, perf-load or relay runtime findings. Nothing was run.

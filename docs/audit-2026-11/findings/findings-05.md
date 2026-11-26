# Chunk 05: the agents' detail files `docs/agents/stories.md`, `studio.md`, `testing.md`
Read: docs/agents/stories.md (1,081 lines, 103,956 bytes)
Read: docs/agents/studio.md (1,615 lines, 190,601 bytes)
Read: docs/agents/testing.md (2,592 lines, 263,701 bytes)
(558 KB together, about 140,000 tokens. Cheap facts checked against tools/smoke.mjs 1.86 MB, tools/collab.mjs 1.07 MB, relay/test.mjs 0.41 MB at v216.)

## Findings

### testing.md retells every assertion in prose; the test files already name them   [md | repo-cost]  gain: high  risk: low  sure: confirmed
Where: docs/agents/testing.md l.50-1322 (smoke), l.1436-2392 (relay, collab); tools/smoke.mjs `step('...')`; tools/studio/SPEC.md l.3458 "## Tests" (16 KB)
What: 198 paragraphs, median 277 bytes but p90 3.4 KB and max 31.5 KB: `collab.mjs main run` is one 323-line section (31.7 KB), `relay/test.mjs` 13.4 KB, the smoke intro one 119-line sentence (l.52-170, 11 KB). smoke.mjs already holds 417 step names that are full sentences (89 KB of names), so each check is told three times: step name, testing.md paragraph, the SPEC's "Tests".
Change: Generate the list, do not hand-write it. Add `--list [--only words]` to smoke.mjs, collab.mjs and relay/test.mjs (perf.mjs has one): prints block tag, page/scene, and its step names, no browser. testing.md shrinks to about 15-20 KB: when suites run, how to serve, one table row per block and round (tag or flag, round function, minutes, needs ffmpeg/relay, in the main run or not, "run after touching"), the traps (SwiftShader timing, `studioTexKind`, the page defaults), URL hashes. If a committed index is wanted: `node tools/testing-index.mjs` writes `docs/agents/testing-blocks.md` (tag | steps | first line of the block's comment) with `--check` among the cheap checks. Measured numbers and "v119 failed because" go to docs/history.md.

### studio.md is a second telling of tools/studio/SPEC.md, as one 177 KB section   [md]  gain: high  risk: low  sure: confirmed
Where: docs/agents/studio.md l.5-1467 (`## The studio is built the same way`, 177,516 bytes); tools/studio/SPEC.md (361 KB, 89 headings, one `##` per feature)
What: studio.md has 6 headings in 190 KB; its 64 features are bold bullet leads (`- **Cut-outs**`), so no heading grep and no section read; cross-references say '"Cut-outs" below' with no anchor. 37 bullets open by naming the SPEC section that "has it in full". Top-level bullets: median 1.75 KB, p90 4.8 KB, max 13 KB (KTX2, l.122-212); "Trigger cubes that start things" is 67 lines. Four bullets are a single line each of 1-2.2 KB (l.743-746), so any grep hit returns the whole paragraph.
Change: Make SPEC.md the one copy of each feature. studio.md becomes an index of about 12-15 KB: the rules that bind (already in AGENTS.md "The studio": point there), then one table row per feature: name | SPEC heading | engine file (`e6b_cuts.js`) | state key and `layout.json` field | `STUDIO.x()` test hook | smoke block | FORMAT that introduced it. Keep as its own short sections only what SPEC lacks (check first): "Performance" (away/unload), "Editing without the cost", the collected "Untested on a headset" list. The room-scan bullet (l.478-499: Where / Save / Shared / For tests / Untested as short nested bullets) is the shape to copy wherever prose stays.

### History woven into present rules   [md]  gain: medium  risk: low  sure: confirmed
Where: all three; counts: version tags stories 37, studio 49, testing 100; `networks-NN` mentions studio 29 (current FORMAT is networks-61); owner quotes with dates 15
What: Present behaviour is mixed with what it replaced ("until v153 a cube pressed while picking was selected", "v149: it wrote a new `ts`", "as in every main run of v119 and v120", "from 235 draws", "*For Quest* (v150)" three times, testing.md l.21-48 the Windows fix's story, l.1314-1322 "other steps changed in v145"). An agent cannot tell rule from anecdote without reading the sentence through.
Change: One line per fact in the reference ("Since FORMAT 49"); move the why, the before-numbers and the owner's quotes to docs/history.md under the same feature name. The Windows section becomes its two rules (already in AGENTS.md) plus a pointer.

### "From CLAUDE.md" tails repeat the files above them and AGENTS.md   [md]  gain: medium  risk: low  sure: confirmed
Where: stories.md l.1019-1081 (6.5 KB), studio.md l.1596-1615 (1.9 KB), testing.md l.2576-2592 (1.1 KB)
What: 9.5 KB "kept word for word": every story's build command, data generator and wording rule a second time (third with AGENTS.md "Built files and data", "Science and wording"). Already drifting: stories.md l.1030 "not one of the sixteen".
Change: Delete the three tails; AGENTS.md is the copy for rules, each story's section for its commands.

### Headings that do not match the test tags or the content under them   [md]  gain: medium  risk: low  sure: confirmed
Where: testing.md l.204, 659, 685, 1194, 1213, 1561
What: All 56 `runs('...')` tags, 33 collab flags, 27 round functions and 7 relay flags named in the docs exist in the code (checked). But 8 smoke tags have no `### smoke:` heading: `headset`, `occlusion` (both inside the 119-line sentence), `uploads` (under "away idle"), `studio ktx2` (30 lines under "### smoke: studio shapes"), `studio viewer` (under "studio tint"), `studio streams`/`loops`/`trails` (under "studio sends"). `collab.mjs --code/--all/--guide/--places/--areas/--reload/--p2p/--near` have no heading (inside the 31.7 KB main-run paragraph); `### collab.mjs --names` sits among the smoke sections; "studio paint" also holds developer-mode steps, "studio colour" an xp note, "studio cuts" a "v118 adds three steps" block on unrelated things. `relay/test.mjs --notes` (in AGENTS.md) is not in testing.md at all; `--nets` is in testing.md but not AGENTS.md.
Change: One heading per tag and per flag, spelled exactly as typed on the command line, in the file's order of the test; a generated table makes this automatic (first finding).

### stories.md: stale counts and states at v216   [md]  gain: medium  risk: low  sure: confirmed (voice lines: plausible)
Where: docs/agents/stories.md l.1, 28, 37, 70, 123, 835-838, 874, 916-918, 928; testing.md l.8, 38, 105, 112, 160
What: "The fourteen built stories" / "all fourteen" (19 packages have `src/engine/`); testing.md "the fourteen that share the engine parts", "all 16 builds", "the hook in all sixteen" (order.json has 20). Title line lists neither ppicell nor exposome. l.874 "the voice ... is still to be made" and `NARRATION_ENDS` empty: `packages/tutorial/audio/narration.mp3` exists and `e3_story.js` l.19 has the table. l.916 ppicell "until then (v205) it runs on subtitles": its README says recorded at v210. l.928 exposome "provisional until the voice is rendered": `audio/narration.mp3` exists. l.123 names `tools/engine/kit.js` twice. Headings carry migration history ("a story package since v186", "is built the same way" x17).
Change: Drop counts (the owner's rule already bans counts users read; the same drift happens here) or say "every built story"; fix the three voice lines; headings become `## <key>: <title>` so `grep '^## topo'` works.

### stories.md duplicates each package's own SPEC.md and README.md   [md]  gain: medium  risk: low  sure: plausible
Where: stories.md l.86-970 (about 80 KB of per-story sections) against `packages/<key>/src/SPEC.md` (20-71 KB each), `src/README.md`, `sets/<name>.md`
What: Each section restates the sets, the data generator, hedges, explore tabs and spelling that the package's SPEC and README hold (the ppicell section, l.878-919, is already the right shape: pointers plus the few cross-cutting rules). The pass (9.5 KB) and flock (6 KB) sections carry sync protocols and measurements found nowhere in AGENTS.md's rules.
Change: Per story keep 8-15 lines: files, build and test commands, what it reads from other packages (rebuild dependants), the wording rules, shared-state shape, pointer to SPEC sections. Move protocol detail and measurements into the package's SPEC. Target about 30 KB. "Shared engine parts" (l.26-84) is engine reference: move to `tools/engine/SPEC.md`, leave five lines.

### Parked plans and catalogue text inside the reference   [md]  gain: low  risk: low  sure: confirmed
Where: studio.md l.1540-1594 (glTF round trips, 3.5 KB, "Nothing of it is built"), l.1371-1447 (Bliss XP, tour and tracker-guide inventories, about 8 KB, each with its own README), l.747-754 dub-techno
What: A parked plan and three example-scene inventories sit in the file an agent greps for how the studio works. `examples/dub-techno` and `tools/studio/dub/make.mjs` appear here (l.747, 1307) but not in CLAUDE.md's built-files table or AGENTS.md's "Built" list.
Change: Move the plan to `docs/` (or SPEC's end); one line per example pointing at its README; add dub-techno to the built-files table.

### Long hard-wrapped and unwrapped lines defeat line-range reads   [md]  gain: low  risk: low  sure: confirmed
Where: studio.md l.45 (2,175 chars), l.686, l.743-746, l.807, l.1053; testing.md l.604 (1,400), l.1159-1215, l.2418
What: Read's line ranges and Grep's `-C` assume lines of about 120 chars; 5 lines over 1,000 chars in studio.md and 2 in testing.md return kilobytes for a one-word match. l.45's Quest texture numbers are repeated at l.122-130.
Change: Falls away with the two rewrites above; until then wrap them and cut l.45's duplicate.

## What an agent would read (now -> proposed)
- Change one studio feature (cut-outs): now studio.md bullet 5.3 KB + `layout.json` bullet 4.8 KB + SPEC section 13.1 KB + testing.md block 4.5 KB = about 28 KB (7,000 tokens), in three tellings that can disagree, and only if its grep lands on a bullet lead. Proposed: index row 0.3 KB + SPEC section 13.1 KB + `smoke.mjs --list 'studio cuts'` 2.9 KB (11 step names) = about 16 KB (4,000 tokens), one telling.
- Add a smoke block: now the smoke intro and `--only` 13 KB + a neighbouring block as a model 4-7 KB + AGENTS.md's block list, then write a 2-6 KB paragraph and extend three lists by hand = about 20 KB read, 5 KB written. Proposed: testing.md's "adding a block" section about 2 KB + the table 4 KB; the docs follow from `runs('tag')` and the step names; one generated row. About 6 KB read, nothing hand-written.
- Change one story's set (topo `tower`): now stories.md topo section 6.5 KB + testing.md harness paragraph 2 KB + `sets/tower.md` 12.8 KB + the SPEC's part = about 25 KB. Proposed: stories.md topo entry about 1.2 KB + harness 1 KB + `sets/tower.md` 12.8 KB = about 15 KB.
- Whole-area size: 558 KB -> about 65-75 KB hand-written (stories 30, studio 15, testing 20) plus a generated block list of about 25 KB (tags and step counts) or none with `--list`.

## Not worth changing
- Names are accurate: every smoke tag, `--only` word, collab flag, round function and relay flag sampled (about 120 names) exists in the test files; AGENTS.md's `focus mode`, `phones`, `tablets`, `iPhone`, `design` are step-name prefixes, which `--only` matches by design.
- stories.md has one `##` per story, lines of at most 328 chars: grep by story already works; it needs trimming, not restructuring.
- testing.md "Useful URL hashes" (l.2531-2574), "Refactor checks" (l.2491-2507) and "Story packages" (l.2509-2529) are compact, current and found nowhere else: keep.
- studio.md "Props on trackers" (l.1479-1538) and "Live sound" already have headings and short bullets with pointers to `tools/trackers/SPEC.md`: keep the shape.
- No code in this chunk; no bugs seen. Note: besides this file I left one scratch list, `_tags05.txt`, in the audit folder (made while cross-checking tags; not deleted, per the no-`rm` rule).

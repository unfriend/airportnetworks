# Chunk 09: the studio's SPEC and README, the trackers' and the voice's markdown
Read: tools/studio/README.md (625 lines, 54,470 bytes)
Read: tools/studio/SPEC.md (3,607 lines, 361,550 bytes; all of it, in six ranges)
Read: tools/studio/dub/README.md (68 lines)
Read: tools/studio/tour/README.md (62 lines)
Read: tools/studio/tracker-guide/README.md (74 lines)
Read: tools/studio/xp/COMPONENTS.md (108 lines)
Read: tools/studio/xp/README.md (185 lines)
Read: tools/trackers/README.md (116 lines)
Read: tools/trackers/SPEC.md (541 lines, 54,031 bytes)
Read: tools/voice/README.md (220 lines)
Also grepped (not read whole): docs/agents/studio.md (1,615 lines, 190,601 bytes), tools/studio/engine/ (44 parts), relay/scenes.mjs.

## Measurements (tools/studio/SPEC.md)
- 60 `##` sections, no table of contents; 14 sections over 8 KB, 35 over 4 KB. Largest: Editing 22.8 KB, Recorded paths
  22.3 KB, Tests 16.2 KB, Cut-outs 13.1 KB, A scene's layout 12.6 KB, Screens 11.9 KB, Fewer triangles 11.7 KB.
- 519 top-level bullets: median 438 characters, 90th percentile 1,161, six over 2,000, the longest 4,919 (the fill,
  l.2412-2453: one bullet of 42 lines).
- 85 "the owner", 41 "Untested" lines (4.6 KB), 40 "FORMAT networks-NN", 11 "until vNNN", 21 "For tests".
- Headings are not stable keys: 44 of 60 carry "(the owner, <date>)" or "(vNNN, the owner, <date>)".
- Stale check, names: 130 function and constant names taken from the SPEC were grepped in tools/studio/engine,
  tools/studio/sets, shared.js, ik.js and index.html: all 130 exist (STU.recPlay is the one absent, and the SPEC says it
  went). All 36 engine files the SPEC names exist. So the SPEC is not stale by wrong names; it is stale by omission
  and by appended, unmerged text (below).

## Findings

### Two full copies of the studio's contract (SPEC.md 361 KB, docs/agents/studio.md 190 KB)   [md]  gain: high  risk: medium  sure: confirmed
Where: tools/studio/SPEC.md (whole), docs/agents/studio.md l.5-1467
What: every one of 18 sampled topics is written out in both files (bytes SPEC / studio.md): cut-outs 13.1k/5.3k, groups
10.7k/3.6k, behaviours 11.0k/7.9k, motions 6.9k/9.1k, recorded paths 22.3k/16.3k, sequences 7.6k/5.7k, screens
11.9k/5.5k, paintings 6.9k/3.4k, KTX2 7.7k/13.4k, fewer triangles 11.7k/4.8k, viewer 4.3k/1.8k, examples 8.0k/12.8k,
walls 4.9k/3.1k, sends 9.1k/6.1k, trails 4.9k/1.7k, cube switches 8.2k/10.4k, ghost and Pause 6.0k/5.3k, cube starts
9.3k/about 9k. The SPEC is the fuller for 13 of 18; studio.md is the fuller for KTX2, examples, cube switches, motions
(it got the later fixes) and is the only one with what came after v165 (next finding). studio.md points at the SPEC 40
times; the SPEC points back 0 times. Since 20 November: 10 commits to the engine, 9 to studio.md, 3 to the SPEC.
Change: keep ONE contract per feature, beside the code (shape below), and cut studio.md to an orientation page of about
15 KB (how it is built, the pose pipeline, the cross-cutting rules, a table feature -> spec file -> engine part -> smoke
block). The contract should be the SPEC side (records, rules, test hooks); what studio.md has that the SPEC lacks is
moved in first, then its copy deleted.

### The SPEC stops at about v165: eight features are only in studio.md   [md]  gain: high  risk: low  sure: confirmed
Where: tools/studio/SPEC.md (absent); docs/agents/studio.md l.213, 747, 824, 1168, 1396, 1416, 1424, 1525
What: no word in the SPEC of the VR goggles (`e6z_goggles.js`, v197, FORMAT networks-56; 0 hits for "goggles"), game
screens (v203), Mirror the visitor (v204; it is in tools/trackers/SPEC.md), the studio tour (v199), the tracker guide
(v200), the dub techno example, `push.mjs`, and Performance (a scene unloaded after 2 minutes away). `rig: 'any'` (v201)
is one clause at l.2783. The newest FORMAT it names is networks-53; shared.js is at networks-61. Eight engine parts are
never named in it: e10_app, e1_head, e2_scene, e4_files, e5_models, e6r_paint (62 KB), e6z_goggles, e7d_lite. An agent
told "the SPEC is the contract" (AGENTS.md, studio.md l.11) misses them.
Change: with the split below each of these gets its file; until then a line at the SPEC's top saying where they are.

### Core tables appended to, never merged   [md]  gain: high  risk: low  sure: confirmed
Where: tools/studio/SPEC.md l.48-51, 156-294, 288, 919-925, 1204, 3035-3046
What: the places an agent trusts as the summary are the oldest text. (a) `state()` at l.919 lists `o. c. s. x. g. p. e.`
only; `q.`, `qr.`, `pr.`, `v.`, `d.`, `sw.`, `bt` are defined 2,000 lines later in their own sections. (b) "Limits" at
l.288 has no screens (20), paintings (50), sequences (50), streams (64). (c) the JSON example and field list of
`layout.json` (l.162-294) have no `screens`, `paintings`, `press`, `send`, `stream`, `trail`, `grab`, `key`, `all`,
`shows`, `puppet`; `sequences` is one loose line above the JSON (l.160). (d) file kinds at l.48-51 (`.glb .gltf .fbx`;
images to `.bmp`) against l.1204 (tif, psd, dds, avif) and l.3007 (video). (e) "Built differently (the studio lane,
v143)" l.3035-3046 corrects the Screens section above it instead of being merged into it. (f) l.1243 says the upload
page stores textures as JPEG/PNG; l.1053 says KTX2 up to 8k is the default.
Change: one generated or hand-kept "Records" page: per kind its state key, layout list, limit, fields with one line each
and the section that owns it (the engine's `LIMITS` and `norm` are the source; a small script could print the table and
`--check` it, as the builds do).

### History woven into the rules   [md]  gain: medium  risk: low  sure: confirmed
Where: tools/studio/SPEC.md l.1-12, 740-782, 951-955, 1033-1036, 1073-1088, 1432-1446, 2412-2453, 2675-2705; 44 headings
What: the file opens with the owner's first request and the two sample files' byte details; 44 headings carry a date;
most sections open with one to five lines of quotation (about 2.6 KB of quotes in all, by a rough grep). Diagnosis
stories stand as contract: "Editing without the cost" (l.740-782, 4 KB of what was slow before v136), the cut-out fill's
measurements (l.1437-1444), the KTX2 timing table (l.1073-1088), the fill's reasoning and timings inside one 4.9 KB
bullet, examples at a circle told as v137b then v137c's review. Eleven "until vNNN it was ..." clauses, a FORMAT
history paragraph (l.951-955). Builder's briefs left in: l.110 "`relayFind()` (new, in `shared.js`)", l.1009 "`convert.js`,
or where it fits", l.1248 "Add the r128 loaders this needs to `tools/studio/vendor/` ... update the vendor README" (they
are there: an instruction an agent could follow again).
Change: each spec keeps the present rule and one "Why" line (the owner's words in a sentence, dated); the measurements,
the before/after stories and "until vN" go to docs/history.md under "Studio" (it already holds the FORMAT history).
Estimated 35 to 45 KB out of the contract.

### "## Tests" (16 KB) repeats docs/agents/testing.md   [md]  gain: medium  risk: low  sure: confirmed
Where: tools/studio/SPEC.md l.3458-3607
What: 30 bullets in no order (v154 first, the original block last), 20 of them ending `"Testing" in
docs/agents/testing.md` after a paragraph describing the same steps; the last three (l.3582-3605, v118 to v120) are 4.5 KB
of step-by-step narration. Each feature section also has its own "For tests" bullet.
Change: delete the section; each spec file ends with two lines: its `STUDIO.<hook>()` and its `--only '<block>'`. The
step lists stay in testing.md (one copy).

### tools/trackers/SPEC.md states its wire three times, one of them superseded   [md]  gain: medium  risk: low  sure: confirmed
Where: tools/trackers/SPEC.md l.116-127 (as built), l.128-147 ("the plan as first written ... where it differs, that
holds"), l.155-173 ("the wire contract of this round ... this wins"); l.234-252, 284-290, 483-486, 533-541
What: the `trk` key, `/api/trackers`, `/still` and `@trk` are written out three times in 60 lines, with two "this wins
over that" notes; the reference-tracker plan (`ref`, `l: 'ref'`, `e`) reads as a format though nothing builds it. The
headset-only plan (l.241-248) and the pre-v201 line-up (l.284-290) are kept beside what replaced them. "Tests" opens
with "the full release run has not run on v124, v125 or v126" (90 versions ago); "How it was built" is a token estimate.
The same material is again in relay/README.md "The PC's Vive trackers" (6.7 KB), docs/agents/shared-rooms.md "Vive
trackers" (12.1 KB), tools/studio/SPEC.md l.2736-2835 (10.2 KB) and docs/agents/studio.md l.1479-1540 (6.6 KB): the
studio's two phases exist four times.
Change: one wire section (as built); "Deferred: reference trackers" as five lines; drop l.128-147, 533-541 and the stale
test preface (history.md). The studio's phases live in the studio's puppet and tracker specs only; this file keeps the
bridge, the relay, the shell and `ik.js`; shared-rooms.md keeps a paragraph and a pointer.

### tools/voice/README.md: the release steps are the pre-package ones   [md]  gain: medium  risk: medium  sure: confirmed
Where: tools/voice/README.md l.76-78 against l.92-99
What: "Narrating a story" tells the agent to change `len` in `stories/list.js` and bump `VERSION` in `sw.js`; `STORY_LIST`
has been empty since v187 (only two `len:` lines remain there, the design room's and the studio's) and `len` is in each
`packages/<key>/story.json`. "A story package" (l.92-99) says the opposite ("No `len` in `stories/list.js` ... no
`VERSION` bump") as if packages were the exception; every story is one. An agent following l.76 edits the wrong file.
Change: merge "A story package" into "Narrating a story" as the only path; one line for the three hand-written stories.

### README.md "Files" and "Formats guide" are behind, and the guide is kept twice   [md]  gain: low  risk: low  sure: confirmed
Where: tools/studio/README.md l.547-581, 600-625; tools/studio/SPEC.md l.3446-3456
What: "Files" names 15 of the 44 engine parts (stops at e7f, v125) and lists `ik.js` under tools/studio though it says
itself it is at the root (AGENTS.md's layout line for `tools/studio/` also still ends "`ik.js`"). The formats guide is
in both files; the SPEC's copy is garbled ("by hand: Ready lines:") and both say textures at most 4,096 px while the
Upload pane's default is KTX2 up to 8k. Test scene size: README l.612 "under 250 KB", SPEC l.3545 "under 200 KB", 276
KB on disk (`du`).
Change: "Files" becomes a pointer to the generated index of parts; the guide stays in the README only.

### The Bliss XP room is described five times   [md]  gain: low  risk: low  sure: confirmed
Where: tools/studio/xp/README.md l.8-12, 86-135; xp/COMPONENTS.md l.3-7, 68-108; tools/studio/SPEC.md l.2837-2872;
docs/agents/studio.md l.1371-1395
What: the owner's six quotes open both xp files; the cube table (COMPONENTS) and "The walk" (README) are the same ten
cubes; the presses are in both; the SPEC and studio.md each retell the layout's rules (about 4 KB each).
Change: README keeps making it, the rules and budgets; COMPONENTS keeps the three tables; SPEC and studio.md one line
each ("an example scene: tools/studio/xp/README.md").

## Proposed shape, and what an agent would then read
- `tools/studio/SPEC.md` becomes an index of about 6 KB: one row a feature (stable name, no dates) -> its spec file ->
  engine part(s) -> record field and state key -> FORMAT that added it -> smoke block. Stable `##` anchors.
- `tools/studio/spec/<topic>.md` (or `engine/<part>.md` beside the part; a folder is easier, since cubes and editing
  span parts): about 45 files of 3 to 10 KB, each in one skeleton: Record (fields, limits, bad values) / What it does /
  Card (page and headset) / With the rest (copies, GLB switch, locks, groups) / Shared (state key, FORMAT) / Tests (hook,
  block) / Untested / Why (one dated line). `records.md` (the kinds, keys and limits table), `relay.md` (endpoints, R2),
  `editing.md`, `rooms.md` for what is cross-cutting.
- docs/agents/studio.md: about 15 KB of orientation and the rules no feature owns (nothing see-through, the record never
  changes, each person's own, page and headset twins), pointing at the index.
- Sizes: today 606 KB of studio markdown in three files (SPEC 361, studio.md 190, README 54), about 150,000 tokens.
  After: about 300 to 330 KB in all (the duplicate copy, about 150 KB, and about 40 KB of history gone), no file over
  12 KB but the README.
- To change one feature (cut-outs as the example). Today: the studio.md bullet (5.3 KB, found only by grep: l.5-1467 is
  one heading with 64 bold bullets, median 1.8 KB, largest 13 KB) plus the SPEC section (13.1 KB) plus the layout and
  state lines (about 3 KB) plus mentions in 19 other SPEC sections (10.5 KB of matching lines): 20 to 30 KB, 5,000 to
  8,000 tokens, if every grep lands; an agent that opens either file whole reads 48,000 or 90,000 tokens. After: the
  index (6 KB), `spec/cut-outs.md` (about 8 KB), `records.md` (about 6 KB): 20 KB, 5,000 tokens, with no grep needed and
  nothing to reconcile; the worst case (a wrong file opened whole) is 12 KB, not 361.

## Not worth changing
- The SPEC's function and file names: 130 of 130 checked exist; no renames to chase.
- tools/trackers/README.md (setup on the PC), tools/studio/dub/, tour/ and tracker-guide/ READMEs: short, current,
  each the one home of its content (the tour's and guide's budgets and stand lists match `examples/`: four scenes there).
- tools/voice/README.md apart from l.76-99: setup, `say.json`, timing and licences are one copy and needed as they are.
- The README as the user-facing guide: it is the right place for the how-to text; only its last two sections are behind.
- "Untested on a headset" lines: 41 in the SPEC, 4.6 KB; they are the owner's reporting rule and belong with each feature.
## Bugs seen
- None in code (markdown only). An instruction that would misfire: tools/voice/README.md l.76 (above); SPEC l.1248 (above).

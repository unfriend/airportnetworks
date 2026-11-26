# Chunk 04: the agents' detail files (layout, packages, shared-rooms, shell)
Read: docs/agents/layout.md (405 lines, 42 KB) - whole
Read: docs/agents/packages.md (407 lines, 37 KB) - whole
Read: docs/agents/shared-rooms.md (2,550 lines, 282 KB) - lines 1-1909 whole; 1910-2550 NOT read line by line (the reader's context ran out): measured by script, headings and samples only (l.2010-2026, 2527-2550)
Read: docs/agents/shell.md (1,896 lines, 191 KB) - NOT read line by line (context ran out): l.1-30 and l.1630-1728 read, the rest measured by script (bullet sizes, headings, the sub-bullet heads of l.244-688). Findings on it are marked "measured". A second reader should take shell.md and shared-rooms.md 1910-2550.

Measured (scratchpad/audit/b04.mjs, t04.mjs). Text is wrapped at ~120 chars, but some physical lines reach 2,380 chars.

| file | top-level bullets | median | p75 / p90 | largest | bytes in blocks over 2 KB |
| --- | --- | --- | --- | --- | --- |
| layout.md | 69 | 0.4 KB | 1.1 KB | 6.5 KB (`tools/studio/`) | 10 of 42 KB |
| packages.md | 61 blocks | 0.4 KB | 1.2 KB | 3.0 KB | 8 of 37 KB |
| shared-rooms.md | 112 | 1.1 KB | 2.4 / 4.8 KB | 23.6 KB (l.1028) | 204 of 281 KB |
| shell.md | 109 | 0.6 KB | 1.5 / 2.8 KB | 47.3 KB (l.244) | 122 of 190 KB |

Version and history markers: `vNNN` 143 times in shared-rooms, 86 in shell, 82 in layout; "the owner" 61 + 40 times (21 with a date and a quote).

## Findings

### No index: 87 % of shared-rooms.md sits under one heading, shell.md's first 1,120 lines under one   [md]  gain: high  risk: low  sure: confirmed
Where: shared-rooms.md:5 (`## Shared rooms`, runs to l.2243, 245 KB); shell.md:5 (`## How the shell and stories fit together`, to l.1121, 112 KB); layout.md has one `#` and nothing else.
What: shared-rooms.md has 8 headings for 282 KB, shell.md 12 for 191 KB. Topics (room names, camera mode, areas, places, the menu, the relay's password ...) are top-level bullets whose name is prose, so `grep '^#'` finds nothing, and cross-references ("Areas" below, "Four headset settings") point at bullet openings, not anchors. AGENTS.md's table says which file, never which lines.
Change: one `##`/`###` heading per topic with a stable short name (the ~112 + ~109 bullet openings already are the names), and a generated table of contents at the top (heading, line, KB) from a small script with `--check`, so an agent reads 2-3 KB of index and then one section by line range.

### Bullets are whole chapters; two are mis-nested or mis-named   [md]  gain: high  risk: low  sure: confirmed
Where: shell.md:244-688 "Four headset settings" (47 KB, measured); shared-rooms.md:1023-1212 (the headset's menu, 24 KB); l.640-800 preview camera 18.6 KB; l.297-438 room setup guide 16.7 KB; l.42-141 All stories 11.7 KB; l.2162 effects 11.6 KB; shell.md:910 sound effects 17.3 KB.
What: "Four headset settings" holds 18 sub-topics, most not the four: frame rate l.286, refresh rate 301, automatic quality 325-359 (9 KB), Sharp text 360-477 (13.6 KB), occlusion, menu sharing, moving with the sticks 524-616, My body; a grep hit for any lands in a 47 KB bullet. In shared-rooms.md the menu's own bullet is l.1023-1027; a new top-level bullet "Getting around" (the welcome toast, l.1028) then carries the rest of the menu's text and its four tab sub-bullets, so by structure the tabs belong to the toast. The Settings tab's rows are one 2.6 KB sentence (l.1090-1111); the Debug tab (l.1132-1156) has a 1.5 KB physical line (l.1145).
Change: one rule or one UI row per bullet (a table for the menu's rows: label, id such as `set:sound`, whose setting it is, where documented); each sub-topic its own heading; "Getting around" out of the menu; "Four headset settings" renamed "Headset settings" with Sharp text, Automatic quality, Refresh rate and Moving with the sticks as siblings. shell.md's "Hot reload and live updates" (l.1630-1727: bold lead-in per bullet, 0.5-2.5 KB each) and packages.md are the pattern to copy.

### History woven into the present rule, in a file that says it holds none   [md]  gain: high  risk: medium  sure: confirmed
Where: shared-rooms.md:3 ("History ... is kept apart; this file says what is true now"); l.39; l.1398-1564; l.862-884; l.1213-1230; l.1810-1818; packages.md:167-202.
What: l.39 is one 2,284-character line reciting FORMAT networks-51..61 (docs/history.md, 90 KB, already has the FORMAT history), and nearly every key in l.7-39 carries its "FORMAT networks-N". The alignment bullets (l.1369-1564, about 25 KB) are largely field reports ("two Quest 3s on Quest Browser 152 ... 2.6 m and 11 degrees", "Two rules from this round were taken out again", "after 5 and 15 minutes asleep ..."). Fixed bugs stay as text ("Known races ... Fixed in v179 ... Fixed while integrating", the "v158" changelog block, "Measured: 5.3 MB per hover change down to about 0.16 MB"). packages.md keeps the how-to of a migration finished at v187 (`move.mjs`, "Its readers", "Wrapping a hand-written story": 3.5 KB). Nearly every bullet opens with `(vNNN; the owner, <date>: "...")`.
Change: per topic keep "now" (rules, names, thresholds); move the why and history paragraphs, the owner's quotes, per-version notes and fixed-bug stories to docs/history.md under the same heading name, one link back. No rule changes. Rough yield in the part read: 30-40 % of shared-rooms.md 1-1909 (about 60-80 KB).

### Same content in two or more places   [md]  gain: medium  risk: low  sure: confirmed
- "## From CLAUDE.md ... kept here word for word": shared-rooms.md:2527-2550 (2.0 KB) and shell.md:1818-1896 (6.2 KB) repeat AGENTS.md's rules ("Shared rooms", "Sound") and the sections above them, with the stale "all sixteen stories"; a grep lands there as readily as on the real section. Keep AGENTS.md's rule lines and the topic sections; drop both appendices once each sentence has a home.
- A studio circle made for a scene: shared-rooms.md:955-967 and again l.978-983 (same record, same `fresh` rule).
- `roomFrames` places: "A v3 place reads as spots A and B's" twice in one bullet (l.1653, l.1658), the fields listed twice.
- Deployment (GitHub Pages from `main`, Coolify `dev`, `main.lab...`): shared-rooms.md:1776-1797, shell.md:1671, AGENTS.md "Releases", relay/README.md. Keep relay/README.md.
- The service worker's package cache: layout.md:58-75, packages.md:90-120, layout.md:360-367. Miniatures: layout.md:34-40 and 394-404, packages.md:147-159, tools/packages/SPEC.md. Keep packages.md / SPEC.md; one line in layout.md.
- layout.md repeats AGENTS.md's "Layout" list entry for entry at five times the length; `room-test/` (3.5 KB, l.132-160) and `tools/studio/` (6.5 KB, l.308-353, lines up to 582 chars naming every engine file with its version) are behaviour and belong in room-test's README and docs/agents/studio.md.
Change: layout.md becomes a table (path, one line, "details: <file>, <heading>"), about 12 KB instead of 42 KB.

### Stale at v216 (cheap facts checked)   [md]  gain: medium  risk: low  sure: confirmed
- layout.md:76-78 documents `audio/` with `narration-<key>.mp3`: the folder does not exist; l.207 still explains `AUDIO`; packages.md:112 Take all "every narration still in `audio/`".
- layout.md:20-28 describes `stories/list.js` as the stories "in the order of the Stories screen": `STORY_LIST` is empty since v187. shared-rooms.md:904 "the `icon` of its entry in `stories/list.js`" (now `story.json`), l.907 "sixteen cards", l.931 "a seventeenth story".
- "all sixteen" stories: shell.md:227, 1728 (a heading), 1804, 1854, 1884, 1886, 1890; shared-rooms.md:2042, 2074, 2120, 2133, 2532; layout.md:229 "the fourteen built stories". `packages/order.json` has 20, the index 22. Say "every story".
- packages.md:379 heading "Back into the cell (... in development)" and l.400 "a one-chapter placeholder until builder B's": it is on the main cards and its `e3_story.js` has 558 lines.
- hello: layout.md:373 and packages.md:286 say hidden; packages.md:329 and the index say `list: "experiments"`.
- layout.md's cross-references to sections of the old single AGENTS.md ("below", "see Testing"): l.44, 92, 98, 101, 105, 167, 169, 174, 179, 202, 308, 377. An agent following them finds nothing in layout.md.
- shared-rooms.md:1020 and 1237 "the clock menu" (the menu's old name).
- Unwrapped lines: shared-rooms.md:25-39 and 229 (up to 2,380 chars): `grep -n` returns the whole line.
- Current: `FORMAT` networks-61 (shared.js:29), `VERSION` v216, the v214-v216 notes.

### "For tests" hook lists and "Untested" paragraphs inside every topic   [md]  gain: medium  risk: low  sure: confirmed
Where: shared-rooms.md l.387-391, 430-434, 636-639, 788-800, 885-887, 1318-1324, 1641-1644, 1724-1730, 1887-1891 ("untested" 28 times, "for tests" 21; shell.md 38 and 14, measured).
What: each topic ends with its `HOST.collab.*` test hooks (the preview camera's `preview()` shape alone is 0.6 KB) and a paragraph of what was never tried on a device: a register the owner works through, scattered over about 66 places.
Change: hooks to docs/agents/testing.md (or generated from `shared.js`); untested items to one register (`docs/untested.md`, grouped by device), each topic keeping a one-line pointer.

### Proposed shape, and what an agent would then read   [md | repo-cost]  gain: high  risk: medium  sure: plausible
Shape: keep the four file names as short indexes (AGENTS.md's table keeps working) and split by topic into `docs/agents/rooms/` and `docs/agents/shell/`, each file 3-10 KB, present tense, one rule per bullet, fixed skeleton (What it is / Keys and names / Rules / Where in the code / Tests: pointer / History: pointer). rooms/: keys.md (a table of every room key: shape, who writes, which lock refuses; replaces l.7-39), stations.md, all-stories.md, circles-ask.md, menu.md (rows as a table), alignment.md, areas-places.md, cameras.md, output.md, relay.md, update-room.md, people-bodies.md, smoothing.md, hooks.md (the lines every story keeps, "What each story shares"), talk.md, trackers.md. shell/: loading.md, stories-screen.md, settings.md, sharp-text.md, quality.md, sticks.md, sound.md, sfx.md, occlusion.md, notes.md, ships.md, flight.md, arrange.md, live.md, inside-a-story.md. A `--check` script writes the index and fails on a bullet over 1.5 KB or a line over 160 chars.
Cheaper first step, same files: headings, generated TOC, wrap the long lines, move history out; no split.
Estimates ("today" = bytes of the sections involved, measured; "then" = estimate):

| task | today | then |
| --- | --- | --- |
| change a headset menu row | menu bullet 24.2 KB (shared-rooms 1023-1212) + the setting's part of shell.md's 47.3 KB bullet (5-14 KB) + hook lines: 35-45 KB, 70 KB if both bullets are read whole | index 2 KB + menu.md 6-8 KB + the one setting 2-4 KB = 10-14 KB |
| add a room-wide key | intro 6.3 KB (l.7-39) + a model key (`name` l.229, 2.4 KB; `menus` about 5 KB) + relay bullet 3.6 KB + kept copies and Updating a room about 3 KB + history.md's FORMAT notes: 18-22 KB | index 2 KB + keys.md 4 KB + relay.md's key rules 2 KB = 8 KB |
| change how a story loads | shell.md head 6.4 KB + Hot reload 8.5 KB + Inside a story 7.8 KB + packages.md's shell and service worker 6.8 KB + layout.md `sw.js` 1.6 KB = 31 KB (+ 6.2 KB when grep lands in From CLAUDE.md) | index 2 KB + loading.md 6 KB + live.md 5 KB + packages.md "The shell" 3 KB = 16 KB |

## Not worth changing
- packages.md's structure (17 headings, median block 0.4 KB) is fine; only its migration section and the three example sections (hello, cellstress, ppicell: 7.5 KB, better in each package's README) should move.
- The key names, thresholds and function names in the present-tense parts are dense but are what grep finds: keep them.
- `FORMAT` networks-61, `VERSION` v216, the 22 packages, the `tools/packages/` and `tools/engine/` file lists match the repository.

## Bugs seen
None (documentation only in this chunk).

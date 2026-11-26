# Chunk 17: the relay's test and its trackers module
Read: relay/test.mjs (4332 lines, 410 KB; read whole, 1-4332)
Read: relay/trackers.mjs (245 lines, 15 KB)

Numbers (counted, nothing run): 132 steps, 1,032 `ok(` checks, 106 `await start(` relays spawned plus 6 kinds of
"relay that refuses to start" spawns; longest line 434 characters, average 95 (about 110,000 tokens to read whole).
Fixed waits: 146 literal `sleep(N)` = 52.9 s (32 of them `sleep(200)`), 15 `.none()` = 5.9 s, 5 `.window()` = 4.6 s;
on top the waits the relay's own rules need: the reload order 12 s (1053-1055), EXPIRE 5 s (2366), room expiry 2.6 s
(2144), `--keep`'s 5 s write twice (1069, 1093), three watch "not again" waits of 2.6 s (3274, 3450, 3484). So about
65 s of fixed sleeping and about 30 s of rule waits before any work; the rest is 106 process starts, real ffmpeg jobs
and about 3,000 folders written by hand (1278, 1421, 1754).

## Findings

### Fixed sleeps before a positive check: slow when idle, red under load   [repo-cost]  gain: high  risk: low  sure: confirmed
Where: relay/test.mjs, e.g. 702-704, 711-716, 861, 888, 897, 908 (sleep 200-500, then "the frames came"); 1894, 1897,
2323, 2462, 2614, 2673-2690, 2718 (`raw()` then `sleep(200)` then read `w.head`); 1997-2001, 2693, 2818, 3020, 3206,
3339, 3719, 3876 (sleep 100-400, then a log line "said a line a tick"); 318, 325, 1601, 2106, 2512, 3526-3529.
What: about 60 of the 146 sleeps wait a fixed time and then assert that something HAS arrived. Idle, each wastes its
whole time; with the 4 CPUs busy (a smoke or collab run beside it) the thing arrives later and the check goes red
with nothing wrong in the relay. The helpers to wait on a condition already exist (`c.next`, `r.wait`, and four
private copies of "wait for a log line": `logged` 803, `sleepUntil` 1147, `said` 3828, `waitFor` 4168, plus 16 inline
`for (const end = ...; Date.now() < end;) await sleep(..)` loops).
Change: one `until(fn, ms)` and one `P.said(re, ms)` at the top (a relay's `out`), `raw()` gaining `r.headIn(ms)`,
a `bins(c, n, ms)` that waits for n frames. Keep fixed sleeps only for "nothing came" checks (`.none`, and there
wait once per step, not per check). Saves roughly 15-20 s a run and removes the commonest false red.

### Counts in a wall-clock window with both bounds tight   [repo-cost]  gain: high  risk: low  sure: confirmed
Where: relay/test.mjs:191 (30..60 readings, dt < 1500), 286 (100..125 @trk in 2 s), 289 (median delay < 40 ms),
320-321, 339, 343 (>= 50 in 1 s), 602 (150..265), 619, 729 (95..105), 910 (55..61), 1055 (11000..14500 ms),
1288, 1763 (201s 60..62 of 64 sequential POSTs), 1774 (58..61), 2367 (4000..7500), 3263, 3449, 3475, 3555, 3921
(< 900 ms), 3949, 3981, 4007 ("told at once": < 1000 ms).
What: the trackers' fake bridge (`tools/trackers/fake.mjs`) runs its 90 Hz timer inside the test's own process, so
the test's jitter is measured as the relay's. The rate-limit bursts (1287, 1762, 1770-1772) send 64-70 requests one
after another against a bucket that refills by the second: if they take over 2 s on a loaded machine, more than 62
get through and the check fails. Each of these is a place where "the machine's" failures in the project's history
come from.
Change: assert the rule, not the clock: for rates send the burst with `Promise.all` (as 1778 and 2618 already do)
and accept `>= burst`; for "at once" compare with the poll interval the relay was started with (told before
R2_POLL / the settle time) rather than 900-1500 ms; for @trk compare counts between the two members and against the
fake's own sent count (`F.history`), not against 2 s of wall time; print the measured figure as line 312 does.

### The main relay runs with `--timeout 1` for the whole run   [repo-cost]  gain: medium  risk: low  sure: plausible
Where: relay/test.mjs:38 (`--timeout 1 --expire 1 --ping 0.2`); clients A, B made at 1902-1909 and used to 2113.
What: one step (2086) needs the 1 s timeout, but every step up to 2113 keeps A and B joined on that relay, so any
stall of the test process over 1 s drops them and the following steps fail in a cascade. The test also blocks its
own event loop with `execFileSync` (python up to 15 s at 390, ffmpeg 1453-1456, scan.mjs 3151, `test-r2.mjs` up to
60 s at 3807): harmless today only because nothing after 2113 needs A and B as members.
Change: the timeout and expiry steps on a relay of their own (as `--keep`, `--proxy`, `--public` already have);
the main relay on default timeouts. `test-r2.mjs` spawned async like `r2sync` (4245) rather than `execFileSync`.

### No way to run one case; nine copied runner blocks; three flags the index does not name   [repo-cost | md]  gain: high  risk: low  sure: confirmed
Where: relay/test.mjs:1808-1860, 128 (`step`), 1862-4327; AGENTS.md:445.
What: the nine part flags (`--nets --logs --notes --video --rooms --osc --snd --talk --trackers`) are nine identical
4-line blocks differing in one function name, only the first flag given runs, and the ~90 steps of the main body
(protocol, serving, `--public`, password, scenes, uploads, R2: 2,450 lines) have no flag at all: to re-run "R2: the
watch" an agent runs everything. Steps cannot run alone anyway: they share `R`, `A`, `B`, `SCN`, `UP`, `RR`, `S3`
and grep `relay.out` for lines earlier steps caused (978-983, 2628, 4322-4326). AGENTS.md lists six part flags;
`--nets`, `--logs` and `--snd` exist too (testing.md has them).
Change: a table `PARTS = { nets: netsSteps, ... }` and one runner; move the main body into named part functions
(`protocol`, `serving`, `public`, `password`, `scenes`, `uploads`, `r2`), each making its own room and relay;
`--only <words>` on step names (as `tools/smoke.mjs` has) and `--list` printing the 132 names (the index an agent
greps instead of reading 410 KB). AGENTS.md's row: "(`--list` names the parts)" instead of a list that goes stale.

### The folder and R2 scene steps are the same test written twice   [repo-cost]  gain: high  risk: medium  sure: confirmed
Where: relay/test.mjs:3121-3288 against 3831-3933 (listing, files, layout saves with 24+5 saves each, the watch);
3466-3543 against 3935-3968 (uploads); 3545 against 3970 (copies); 3602/4069 (previews), 3640/4031 (recordings),
3674/4055 (paintings); recordings and paintings are also near copies of each other (3640-3700).
What: about 700 lines (roughly 95 KB, a quarter of the file) repeat the same asks with `sget`/`at()` swapped for
`rget`/`obj()`. The notes, nets and logs parts already do it once: `run(label, A, H, where)` (1149, 1367, 1679)
against a folder, `--notes <dir>` and R2.
Change: the same shape for scenes: one `sceneChecks(label, port, store)` where `store` gives `has(rel)`,
`bytes(rel)`, `put(rel)`, `del(rel)`; the kinds-by-folder steps (previews, recordings, paintings) one loop over
`[folder, kind, type, max]`. Keep apart only what differs (signed links, `put`/`done`, symlinks, settling).

### Helpers copied inside the file and across the tests   [repo-cost]  gain: medium  risk: low  sure: confirmed
Where: relay/test.mjs:42 (`req`), 1136, 1356, 1665 (`rq`, three identical copies), 1458, 3401 (`send`): five HTTP
helpers; 555, 1232, 1480, 2590, 3363, 3418: six copies of "spawn a relay that should refuse to start"; 2474-2481 and
2539-2541 re-make `socket()` by hand though `socket(url, headers)` (59) takes headers; the R2 stand-in's start with
its nine env values 7 times (1297-1302, 1314-1319, 1328-1335, 1428-1433, 1632-1637, 1789-1794, 3813-3816);
`sse()` + `ready` + `next(hello)` 9 times; the fingerprint hash (2394-2400) is the seventh copy in the repository
(index.html:2869, relay/server.mjs:1648, tools/live.mjs:29, tools/release.mjs:40, tools/packages/scan.mjs:26,
check.mjs:220). `tools/collab.mjs` (7 places), `tools/smoke.mjs` (3), `tools/peer.mjs` and
`tools/output/test-page.mjs` each start `relay/server.mjs` and parse its "listening on" line themselves.
Change: a small `relay/testkit.mjs` (startRelay, startRefused, http, socket, sse, until, r2Stand) imported by
relay/test.mjs, tools/collab.mjs, smoke, peer and test-page; the fingerprint exported once from a tools module
for the five Node users. Removes about 150 lines here and the drift between copies (their timeouts already differ:
2.5, 3 and 5 s).

### Seconds spent for nothing   [repo-cost]  gain: low  risk: low  sure: confirmed
Where: relay/test.mjs:1225; 34; 1278, 1421, 1754; 2657-2660 and 2983-2986.
What: 1225 `const P = await startFails(['--public', '--notes', ND], {})` is never read, and such a relay starts
(1227 shows it), so it waits the helper's full 2.5 s and is killed. `start()` leaves a 5 s timer per relay (106).
The "507 past the limit" steps write 2,000 + 500 + 500 folders and files synchronously. The Dockerfile's health
check is run twice.
Change: drop 1225; clear the timer on start; a `--notes-max`-style small limit for the test (nets has `--nets-max`)
or one fill shared by the three; keep one health-check run.

### The full run needs ffmpeg and ffprobe but only one step says so   [bug | md]  gain: low  risk: low  sure: confirmed
Where: relay/test.mjs:1453-1457 (`videoSteps`: `execFileSync('ffmpeg' ...)` outside any `step`), against 3754-3757
(guarded: "no ffmpeg on this machine: skipped") and 2271, 387 (openssl, python3 guarded).
What: on a machine without ffmpeg the full run throws out of `videoSteps`, the `finally` kills the relays and the
process ends with a stack and no "N checks passed" line, after every other part has passed.
Change: guard it as 3756 does (skip the video part with a line), and say in testing.md that the relay test uses
ffmpeg, ffprobe, openssl and python3 when they are there.

### trackers.mjs: the 60 Hz loop never rests and rebuilds each room's frame every tick   [relay]  gain: low  risk: low  sure: confirmed
Where: relay/trackers.mjs:204-217 (`attach`), 158-187 (`tick`), 175, 181; called from relay/server.mjs:3237.
What: with `--trackers` the timer fires 60 times a second for the relay's life, bridge or not, rooms or not; each
tick walks every room (`rooms.values()`), and for each room with `trk.on` calls `frameOf(v.m)` (two `vec` checks
with a closure each, atan2, sin, cos, a new object and array) and builds a key string (`F.o.join() + ...`, 181),
then `tuples()` (8-11 arrays of 13) and one `JSON.stringify` per room (server.mjs:1138: framed once, written to
every member: good). At event size (one PC, a handful of rooms) this is microseconds; it only matters on a shared
relay with many rooms.
Change: keep the frame on `S` and recompute only when the stored value changes (`S.m !== v.m`: a write replaces
the object); when `silent` or no room had `trk.on` last tick, tick once a second; delete forgotten devices
(186) on the 1 s branch rather than 60 times a second. Do not touch the per-datagram path (107-128): one
`JSON.parse` and about ten small objects 90 times a second.

### trackers.mjs header names an import the test does not make   [md]  gain: low  risk: low  sure: confirmed
Where: relay/trackers.mjs:6 ("Also imported by relay/test.mjs (frameOf, toRoom, quatToRoom, parseDatagram)").
What: the test imports `frameOf, toRoom, quatToRoom, TRK_FLOOR` (test.mjs:139); nothing outside the file uses
`parseDatagram`. Change: correct the line (or drop the `export`).

## Not worth changing
- `trackersSend` (server.mjs:1138): one frame per room, backlog check per member; `take()`'s per-reading work; `still()`
  and `list()` (per request). `quatToRoom`/`toRoom` are already allocation-light.
- `c.next`/`r.wait` polling every 10 ms: cheap, and they return as soon as the message is there.
- The 300/200-iteration checks of `frameOf` against shared.js's own code (216-270): milliseconds, and they guard a
  real duplication (the frame maths lives in shared.js and trackers.mjs).
- The `run(label, A, H, where)` pattern of notes, nets and logs: the model for the scenes steps.
- The stand-in ffmpeg and the stand-in S3: fast and local; the real-ffmpeg steps (1508-1569, 3754) are the slow part
  and there are only about eight conversions.
- The long step names double as documentation of the relay's rules; keep them (a `--list` makes them the index).

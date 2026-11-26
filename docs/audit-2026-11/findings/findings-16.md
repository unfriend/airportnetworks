# Chunk 16: the relay
Read: relay/Dockerfile (25 lines)
Read: relay/nets.mjs (144 lines)
Read: relay/notes.mjs (419 lines)
Read: relay/osc.mjs (205 lines)
Read: relay/r2.mjs (345 lines)
Read: relay/scenes.mjs (231 lines)
(server.mjs in progress: notes so far, to be rewritten at the end)
- broadcast() 526-529: one stringify + one frame for all recipients (good); one socket.write per recipient, no cork/coalescing.
- set() 681-737: each value JSON.stringify'd in check() 676 and again 692, a third time in broadcast 733; log line per set 734.
- sendFile 1607-1634: gzip only, cache GZ by path (no promise cache: herd), Cache-Control no-cache for everything, stat+realpath per request.
- keepLog 1538-1543: mkdirSync/statSync/appendFileSync on request path.
- keepOut 751: whole rooms stringified every 5 s while dirty.

## Reader 16 (second pass, reading everything again)
Read: relay/Dockerfile (25) relay/nets.mjs (144) relay/notes.mjs (419) relay/osc.mjs (205) relay/r2.mjs (345) relay/s3fake.mjs (240) relay/scenes.mjs (231) relay/test-r2.mjs (167)
- nets.mjs:52 gzipSync level 9 of up to 12 MB canon (MAX_BODY) on the POST path: blocks the event loop ~100s of ms for a big net (whole room stalls). Use zlib.gzip async.
- notes.mjs:399-405 logR2Store sigs lists every key under .logs/ (all part-NNNNN.json, up to 1000/run) to find log.json: up to 50 list calls per listing. Use delimiter or a meta key; low.
- r2.mjs:156 file upload hashed (sha256File) then streamed: reads file twice; UNSIGNED-PAYLOAD would do; low (uploads only).
- osc.mjs fine (per-target send, rate consts). s3fake test-only, fine. scenes.mjs walk is async; fine.
Read: relay/server.mjs 1-900 so far
- Presence is fx 'p.<id>' at 15/s per headset (shared.js:8402) -> message() 609-613: JSON.parse + one JSON.stringify + one Ws.frame (Buffer.concat copy) per message, then one socket.write per recipient (528) with setNoDelay(true) (384): 30 headsets = 450 in/s, ~13,000 writes and TCP packets/s out. No coalescing; Wi-Fi airtime/packet rate is the limit. Batch fx per recipient per ~20-30 ms tick (one frame holding many) or socket.cork/uncork per tick.
- set() 676/692: JSON.stringify(v) twice per pair, + log line per set 734 (console.log is synchronous to a pipe on Linux: Docker stdout).
- Ws.data 417: Buffer.concat on every chunk of a partial frame (quadratic for 1 MB messages); unmask byte loop in JS 433 (fine for small).
- keepOut 751-755 stringifies all rooms every 5 s when dirty; dirty is set by every set() (732) -> at an event, every 5 s a full stringify of all rooms (up to 4 MB each) + write. Only fine while small.
- join(): welcome sends keysOut (all keys) + broadcast members to all on every join/hello (O(N) members list per member).
Read: relay/server.mjs 900-1650
- main tick 903-933: every 5 s (min of ping/timeout/expire), fine. snd status tick 1315 and talk tick 1404 every 2 s: fine.
- talkBin 1391-1402 / sndBin 1300-1313: one Ws.frame per packet, written per hearer, backlog-gated (16 KB / 64 KB): good. talkHears per member per frame cheap. Talk at 50 pkts/s x 8 talkers x 29 hearers = 11,600 writes/s more in a full room.
- trackersSend 1137, oscIn 1207, talkList 1343: one frame for all (good).
- keepLog 1525-1546: mkdirSync/statSync/appendFileSync per POST /api/log (every 10 s per headset): low.
- sendFile 1607-1634: ETag size+mtime, 304 cheap (stat + realpath per request, async). gzip only (no brotli), level default, computed on first request and kept in GZ forever (unbounded Map, but bounded by app files); no in-flight promise so N headsets at once each gzip the same 1-2 MB file (herd at an event start / after a deploy). HEAD also gzips. Cache-Control no-cache for all (sw revalidates anyway).
Read: relay/server.mjs 1650-2500
- --watch fpOf readFileSync (1661): dev only, fine.
- folderRoom 2100: sceneFiles(dir) full walk (lstat per file, up to 2000) for every upload/copy just to count: low (uploads rare).
- ffmpeg sound (2297) / video (2493, x264 veryfast up to 1800 s, all cores) spawned on the relay that also carries rooms; not niced. At an event an upload during a session competes with the room's event loop only for CPU; low/medium on a 2-core box. Could spawn with `nice` / -threads 2.
Read: relay/server.mjs 2500-3311 (whole file read: 3311 lines)
Measured (node one-liner, read-only): gzip vs brotli q11: ppicell/main.js 2,239,042 -> gz 1,097,978 (82 ms) / br 1,013,979 (4.1 s); shared.js 1,071,308 -> 339,779 / 267,270; index.html 427,884 -> 129,489 / 109,016; three.min.js 603,445 -> 149,992 / 120,830.
- presence backlog: Ws.write 398-402 queues up to 16 MB (16*MAX_MSG) before destroying; fx presence to a slow headset queues seconds of stale poses. trackersSend/talk/snd already skip backed-up sockets; fx broadcast does not.
- netsApi 2809 gzipSync level 9 (nets.mjs:52) and 2835 gunzipSync on request path: sync, up to 12 MB.
- HTTP/1.1 only (3225); with --lan the headsets talk to it directly: ~100 revalidations per start over 6 connections.
(final findings: see the final report, same text)

# Chunk 16: the relay (final, reader 16)
Read: relay/Dockerfile (25) | relay/nets.mjs (144) | relay/notes.mjs (419) | relay/osc.mjs (205) | relay/r2.mjs (345) | relay/s3fake.mjs (240) | relay/scenes.mjs (231) | relay/server.mjs (3311) | relay/test-r2.mjs (167)
## Findings
### Presence fan-out: one TCP write per frame per recipient, no coalescing   [relay] gain: high risk: low sure: confirmed
Where: server.mjs:384 (setNoDelay), 526-529 broadcast, 609-613 fx; shared.js:8402 (presence fx every 66 ms)
What: each headset's presence is an fx at 15/s; per message the relay does JSON.parse + one stringify + one Ws.frame (good: not per recipient), then socket.write per member with Nagle off. 30 headsets: 450 in/s -> ~13,000 writes/syscalls/TCP segments out per s (~4-5 MB/s at ~350 B each); Wi-Fi airtime is per packet.
Change: per member, cork the socket on first write and uncork on a 15-25 ms timer (or setImmediate), so a tick's frames leave as one segment; no protocol change. Bigger: a room-level presence bundle flushed every 66 ms (one frame per recipient per tick) with a client change.
### Stale presence piles up for a slow headset   [relay] gain: medium risk: low sure: confirmed
Where: server.mjs:398-402 (Ws.write: cut only past 16 MB backlog), 528
What: trackers (1140), live sound (1311) and talk (1400) skip a backed-up socket, but fx/presence are queued up to 16 MB: a headset on weak Wi-Fi gets seconds of old poses before being cut.
Change: in broadcast for fx whose k starts 'p.' (or all fx), skip a member whose socket.writableLength > ~64 KB, as trackersSend does; keep 'set' and members unskipped.
### Static files: gzip only, no brotli, gzip herd   [relay perf-load] gain: medium risk: low sure: confirmed
Where: server.mjs:1555-1556, 1612-1632
What: text over 1 KB gzipped once and kept in GZ (good, 304 by size+mtime ETag works, so the sw's no-cache revalidations are cheap). No brotli: measured ppicell/main.js 1.10 MB gz vs 1.01 MB br; shared.js 340 KB vs 267 KB (-21%); index.html 129 vs 109 KB; three.min.js 150 vs 121 KB. No in-flight promise: N headsets asking for the same changed file at once (event start, after a release) each gzip it (1-2 MB, 30-80 ms of threadpool each). HEAD also compresses.
Change: cache a promise per (file, etag); add brotli when Accept-Encoding has br, compressed async (zlib.brotliCompress, quality 9-11 off the event loop) and served gzip until ready; etag suffix -br. Optional: precompress at release into a cache dir.
### Synchronous compression on request paths   [relay] gain: medium risk: low sure: confirmed
Where: nets.mjs:52 (gzipSync level 9, body up to 12 MB, called at server.mjs:2809); server.mjs:2835 (gunzipSync for a client without gzip)
What: a large shared network (250,000 links) blocks the event loop for every room for 100s of ms while it is compressed at level 9.
Change: promisified zlib.gzip / gunzip (as sendFile already does at 1556).
### --keep stringifies every room every 5 s while anything changed   [relay] gain: medium risk: low sure: confirmed
Where: server.mjs:732 (keepTouch per set), 751-755 keepOut, 820 interval
What: any set marks dirty, so during a session every 5 s all rooms (each up to 4 MB, --store 64 MB) are stringified on the main thread and rewritten whole.
Change: keep a per-room cached JSON string invalidated by that room's set; join cached strings; or write only rooms changed since the last write (a file per room).
### Sync stdout log line per set, join, hello   [relay] gain: low risk: low sure: plausible
Where: server.mjs:371 log, 734 (every set), 575/586/637
What: on Linux, stdout to a pipe (Docker, Coolify) is synchronous in Node; a set while a station is dragged (ts writes) logs a line each. Cheap per line but on the hot path and fills Coolify's log.
Change: count sets per room and log one line a tick (as fx drops already are, 914), or only with a --verbose.
### set(): each value stringified twice, fx parsed before size check   [relay] gain: low risk: low sure: confirmed
Where: server.mjs:676 and 692 (JSON.stringify(v) in check and again for n); 610-611 (MAX_FX checked after JSON.parse)
Change: have check return the length; check text.length against MAX_MSG/MAX_FX before parsing an fx.
### Frame reassembly copies the buffer on every chunk   [relay] gain: low risk: low sure: confirmed
Where: server.mjs:417 (Buffer.concat per 'data' while a frame is incomplete), 433 (unmask byte loop)
What: quadratic copying for a 1 MB message arriving in 64 KB chunks (~8 MB copied); irrelevant for presence/talk (small).
Change: keep a chunk list and concat once the header says the frame is complete.
### HTTP/1.1 only for --lan headsets   [relay perf-load] gain: low-medium risk: medium sure: plausible
Where: server.mjs:3225
What: with --lan the headsets reach the relay directly; every start revalidates ~80-100 files (sw.js SHELL plus a story's files) over 6 HTTP/1.1 connections. Behind Coolify the proxy may already speak HTTP/2 to clients.
Change: http2.createSecureServer({ allowHTTP1: true }) for --cert/--lan (the WebSocket upgrade stays on HTTP/1.1).
### Uploads/conversions share the relay's CPU   [relay] gain: low risk: low sure: plausible
Where: server.mjs:2297-2310 (sound), 2493-2515 (x264 veryfast, up to 1800 s); 2100 folderRoom walks the whole scene (lstat per file) per upload to count files
Change: spawn ffmpeg with `-threads 2` (and nice on Linux) so an upload during a session never starves the event loop; count files from the watch's cached listing.
### Run-log listing on R2 lists every part key   [relay] gain: low risk: low sure: confirmed
Where: notes.mjs:399-405 (logR2Store sigs: listAll of every part-NNNNN.json, up to 1000 a run, limit 50,000 = 50 list calls) 
Change: list with delimiter '/' then stat log.json, or keep log.json under a separate prefix.
## Bugs seen
- server.mjs:1573 APP_DEEP 'packages' serves packages/<key>/src/** (story sources, build scripts) to anyone; harmless if intended, but it ships sources in the image and the relay answers for them (.dockerignore keeps tools/ out but not packages/*/src).
- r2.mjs:156 an upload from a file is SHA-256 hashed (read once) then streamed (read again); UNSIGNED-PAYLOAD would halve disk reads (uploads only).
## Not worth changing
- One stringify and one frame per broadcast for all recipients (527, 1138, 1208, 1256, 1308, 1343, 1397): already right.
- Talk/live sound: binary, sid stamped in place, rate-capped (60/100 a s), backlog-gated, never queued: right.
- Timers: main tick every 5 s (933), snd/talk/osc status every 2 s, keep look 1 s only for the first 2 min: fine. Scenes watch polls only while someone listens (2587-2601).
- Memory: rooms expire after --expire; CLIENTS, FAILS, TALLY, LOGGED (1000), PENDING (10,000), VJ jobs, peer waiting queues all bounded; GZ bounded by the app's files (keyed by path).
- 304s: ETag size+mtime and If-None-Match honoured (1616); stat+realpath async per request: cheap.
- osc.mjs, scenes.mjs, s3fake.mjs (tests only), test-r2.mjs: no hot-path issues. Dockerfile: fine (HEALTHCHECK spawns node every 30 s; busybox wget would be lighter, trivial).

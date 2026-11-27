# The relay: protocol

<!-- toc (tools/docs/toc.mjs) -->
- 13: HTTP API (9.1 KB)
- 61: WebSocket protocol (version 1) (8.3 KB)
- 149: Rooms across updates (v136) (5.7 KB)
- 204: Introduction server for peer to peer (`/peerjs`) (4.7 KB)
- 264: Compared with asdf10k-collab-backend (3.8 KB)
<!-- /toc -->

What a client and the relay say to each other: the HTTP API, the WebSocket protocol, rooms across updates and the introduction server for peer to peer. For people who write or test a client; running the relay is in [the relay's README](../README.md).

## HTTP API

All under `/api/`, JSON, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` (preflights: 204). With an
origin rule (`--origin`, `--public`): `Access-Control-Allow-Origin` is the asking page's origin when it is allowed
(`Vary: Origin`), and a request from any other origin gets 403 `{ error: 'origin not allowed' }` (its preflight too);
a request with no `Origin` is answered (the relay's own page, the health check, curl). Preflights allow the methods
`GET`, `POST` and `OPTIONS` and the headers `Authorization`, `Content-Type`, `Range` and `X-Log-Token`. With a password (`COLLAB_TOKEN`) every request below but
`GET /api/health` needs it (`Authorization: Bearer` or `?token=`; 401 without, 429 past 20 failures a minute: [The
shared password](../README.md#the-shared-password-collab_token)).

| request | answer |
| --- | --- |
| `GET /api/health` | `{ ok: true, protocol, rooms }`: the protocol number (1) and how many rooms (a count); open even with a password (health checks), and nothing more |
| `GET /api/ping` | `{ now, proto, net, versions: 1, reload: true }`: relay time (ms), protocol number (1), the asker's network id (see [Rooms on this network](../README.md#rooms-on-this-network)), and since v136 that a room moves on to a newer version (`versions`) and takes reload orders (`reload`, below); with `--keep` also `keep: true`; with `--watch` also `watch: true`; with `--scenes` also `scenes: true`; with the notebook on (`--scenes`, `--notes`) also `notes: true`; with shared networks on (`--scenes`, `--nets`) also `nets: true`; with `--unlisted` (`--public`) also `unlisted: true` (no list of open rooms here); with `--trackers` also `trackers: true` and `trackersSeen` (how many trackers the bridge has sent in the last 5 s); with `--osc-out` or `--osc-in` also `osc: { out, in, trk }` (the number of targets, the UDP port or 0, `--trackers` on; never an address) |
| `GET /api/near` | `{ net, rooms: [{ code, name, members, stations, version }] }`: the rooms on the asker's network, those with people first (at most 20): `name` the first member's (by when they came), `members` a count. Never an address; with `--unlisted` no `name` either. A room that has a name (the room key `name`, `{ v, by, at }`, v146: a label for people, the code stays the address) gains `title` (cleaned: control, zero-width and bidi characters out, spaces collapsed, at most 40 characters; absent when the room has none), also with `--unlisted` and `--public`: the label is the room's own, shown on its network, and no member's name. `GET /api/rooms` rows gain `title` likewise. No log line prints a title |
| `GET /api/watch` | with `--watch`: a stream of Server-Sent Events (see [Hot reload](operations.md#hot-reload---watch)); 404 without, 503 at 200 pages |
| `POST /api/rooms` `{ app, version, code? }` | 201 `{ code }`: a new room, 3 letters A-Z. With `code`, that code if it is free (409 `{ error: 'taken', version }` if not, the room's version since v136): how a client brings back its room after a relay restart. 400 for a body that is not JSON or a bad code, 413 over 16 KB, 503 at 2000 rooms. With `--creates`: 429 (`Retry-After`) past an address's new rooms; a chosen `code` is also a lookup (`--guesses`: 409 counts, 429 past the budget) |
| `GET /api/rooms` | `[{ code, members, names, stations, idle, version }]`: `members` a count, `names` theirs, `stations` how many `st.<id>` keys, `idle` seconds since the last member left (0 while anyone is in). With `--unlisted` (`--public`): `[]` |
| `GET /api/rooms/XYZ` | `{ code, app, version, created, seq, idle, members, keys }` (for debugging; a page asks it before it joins a room again by itself, or brings one back), or 404. With `--unlisted`, `members` is a count. With `--guesses`, a 404 is a lookup of an unknown code, and past the budget any code gets 429 (`Retry-After`) |
| `POST /api/rooms/XYZ/reload` `{ n, to?, shell?, from? }` | (v136, Update the room) sends every member, whatever its version, the reload order: the effect `{ t: 'fx', k: 'q.reload', v: { n, to, shell, by: '', from, at }, by: '' }` (`n` the order's id, 1 to 16 letters, digits, `_` and `-`; `to` the version to come back with; `shell` `{ n, id }` the release; `from` who pressed it), and for 2 minutes lets the room move on to `to` from its first newcomer of that version, even while members of the old one are still there (they get the order again and are refused afterwards, 12 s after they were told when their hello said `reload: 1`, else 3 s after the move: [Rooms across updates](#rooms-across-updates-v136)). 200 `{ ok, members, version }`; 400 for a bad body, 404 for no such room (a lookup, `--guesses`), 405 for another method, 429 (`Retry-After`) within 10 s of the last order to the room. Never stored; with a password it needs it, as every call; its log line names no one |
| `GET /api/scenes`, `GET /api/scenes/<name>`, `POST /api/scenes/<name>/layout`, `GET /api/scenes/watch` | with `--scenes`: the studio's scenes, see [Your own scenes](operations.md#your-own-scenes-the-studio); 404 without |
| `POST /api/scenes`, `POST /api/scenes/<name>/file`, `POST /api/scenes/<name>/sound`, `POST /api/scenes/<name>/copy` | with `--scenes`: uploads and copies from another scene, see [Uploading](operations.md#uploading-the-upload-page) (`GET /upload`, outside `/api/`, sends a browser to the upload page) |
| `POST /api/scenes/<name>/put`, `POST /api/scenes/<name>/done` | with `--scenes r2`: uploads straight into the bucket, see [Scenes in Cloudflare R2](operations.md#scenes-in-cloudflare-r2) (501 with a folder) |
| `GET /api/nets`, `POST /api/nets`, `GET /api/nets/<id>`, `POST /api/nets/<id>/delete` | the cell story's shared networks (v208): see [Shared networks](operations.md#shared-networks---nets---no-nets-v208); 404 when they are off |
| `GET /api/notes`, `POST /api/notes`, `GET /api/notes/<id>`, `.../audio`, `.../shot/<n>`, `POST /api/notes/<id>`, `POST /api/notes/<id>/delete` | the developer notebook (v142): see [The developer notebook](operations.md#the-developer-notebook---notes---no-notes); 404 when it is off |
| `GET /api/trackers`, `GET /api/trackers/still?id=<serial>&ms=1000` | with `--trackers`: the PC's trackers raw in SteamVR's space, and one lying still, averaged; see [The PC's Vive trackers](operations.md#the-pcs-vive-trackers---trackers); 404 without |
| `POST /api/log` `{ room, id, name, kind, entries }` | with `--logs` (or `--lan`): `entries` (objects, at most 2000) appended as JSON lines to `<logs>/<day>-<room>-<name>-<id>.jsonl`; 200 `{ lines }`, 400 for a bad body, 429 more than once a second per member, 507 over 20 MB a file; 404 without `--logs`. With a log token (`--log-token`, `RELAY_LOG_TOKEN`; `--public` needs one for `--logs`): only with the header `X-Log-Token`, 404 without it (as if logs were off: the page stops sending), 403 for a wrong one. v145: with a password set, a log that brings the password is kept whatever the log token (without it the call is 401 before it gets here) |

With `--static <dir>`, every other path may be a file of the app, and only that: `index.html` (also at `/`),
`sfx.js`, `occlusion.js`, `ships.js`, `notes.js`, `shared.js`, `ik.js`, `bodies.js`, `flight.js`, `sw.js`, `manifest.webmanifest`, `three.min.js`, `three.LICENSE.txt`, `proteins.html`,
`spatial.html`, `README.txt`, `peerjs.min.js`, `PEERJS-LICENSE.txt`, `output.js` (the output page's), `version.json` (the release's version file, for
live updates: sent with `Cache-Control: no-store`), `whatsnew.json` (developer mode's box), `LICENSE` and `NOTICE.md`,
`lowpoly.js` (the shell's miniatures), and the files directly in `stories/` (`audio/` until v190),
`icons/`, `fonts/` (the app's font, B612, v213), `whatsnew/` (what is new, older releases), `basis/` (the studio's KTX2 encoder and transcoder), `room-test/`, `notes/` (the developer notebook's page, at `/notes/`; `/notes` moves there) and `p2p/` (the peer-to-peer test page, at `/p2p/`: a path ending in `/` is that folder's `index.html`), and
`examples/` with its scene folders as deep as a scene's files go (the studio's example scenes, v137: `examples/<scene>/`
and at most four folders under it, `APP_DEEP`), and `packages/` likewise (the story packages, v185: each one's `main.js`,
`minis.js`, narration and data)
(`APP_FILES` and `APP_DIRS` in `server.mjs`: add to them when the app needs a new file or folder). Everything else is 404: the
authors' data (`ikerdata/`), `tools/`, `docs/`, the relay itself, folders (no listings), anything whose path has
a part starting with `.` (no `..`, no `.git`), and links that lead out of those files. `GET` and `HEAD`. `Cache-Control: no-cache` with `ETag`/`Last-Modified` (304 when unchanged, as the
service worker expects), gzip for text when asked, single byte ranges on every file (206; 416 when
unsatisfiable; the narration's `<audio>` element asks for them), types for `.html .js .mjs .json .webmanifest
.css .txt .md .svg .png .jpg .webp .ico .gif .mp3 .ogg .wav .mp4 .wasm .woff2 .glb .pdf` (and for scenes `.gltf .fbx .bin
.tga .bmp .oga .opus .m4a .aac .flac .webm`). Without `--static`, `/` answers a line of text. With `--scenes`, the
paths under `/scenes/` are the scenes' files ([Your own scenes](operations.md#your-own-scenes-the-studio)), with or without
`--static`.


## WebSocket protocol (version 1)

Connect to `/api/ws?room=XYZ&id=<client id>` (`wss://` behind HTTPS; `&token=<password>` when the relay has one). The room code is case-insensitive; the
client id is 1-64 characters `A-Z a-z 0-9 _ -`, random per page load and kept across reconnects. An optional
`&proto=1` is checked. A second socket with the same id replaces the first (`replaced`). Every message is one
JSON object with a `t` field, as a text frame; at most 1 MB. The exceptions: live sound's audio frames from the output page,
binary (v162, [Live sound](operations.md#live-sound-from-the-output-page-v162)), and Talk's (tag 2, v178, [Talk](operations.md#talk-v178)). A tag-2
frame from any member is Talk's: dropped and counted when the member has no Talk stream, never closed; any other binary
frame from a socket that never said `out: 1` closes it with 1003.

| from | `t` | fields | meaning |
| --- | --- | --- | --- |
| relay | `welcome` | `you, room, app, version, seq, keys {k: {v, seq, by}}, members [...], now, proto, snd, talk` (`snd: 1`: live sound, v162; `talk: 1`: Talk, v178) | first message on every socket: the whole room |
| relay | `members` | `members [...]` | to everybody after any join, leave, hello or timeout (the joiner too) |
| client | `hello` | `name, color, kind, here, version` (`proto`, `dev` and `reload` optional) | who I am; again after any change (`reload: 1`, v136: this app obeys the room's reload orders in its turn, [Rooms across updates](#rooms-across-updates-v136)) |
| client | `set` | `batch [[k, v], ...], cid` | stored writes: one batch, one seq |
| relay | `set` | `batch, seq, by, cid` | to everybody, the writer included (its acknowledgement) |
| client | `fx` | `k, v` | ephemeral, not stored |
| relay | `fx` | `k, v, by` | to everybody but the sender; `by: ''` for the relay's own, `@trk` (`--trackers`: [The PC's Vive trackers](operations.md#the-pcs-vive-trackers---trackers)) and `@osc` (to output pages only: [OSC and the output page](operations.md#osc-and-the-output-page---osc-out---osc-in)) |
| client | `osc` | `m [[address, types, ...args], ...]` | the output page only (`hello` with `out: 1`): OSC to the `--osc-out` targets ([OSC and the output page](operations.md#osc-and-the-output-page---osc-out---osc-in)) |
| client | `osc-cfg` | `trk` | the output page only: the trackers as OSC for its room on or off |
| client | `snd-start`, `snd-stop`, `snd-sub` | see [Live sound](operations.md#live-sound-from-the-output-page-v162) | the output page's live sound (v162), and hearing it; the audio itself goes as binary frames |
| relay | `fx` `@snd` | `by: ''` | live sound's start, stop and status ([Live sound](operations.md#live-sound-from-the-output-page-v162)) |
| client | `talk-start`, `talk-stop`, `talk-sub` | see [Talk](operations.md#talk-v178) | a person's microphone for Talk (v178), and hearing the others; the voice itself goes as binary frames (tag 2) |
| relay | `fx` `@talk` | `by: ''` | Talk's list of talkers (to every member) and a talker's status ([Talk](operations.md#talk-v178)) |
| client | `ping` | `c` (client ms) | |
| relay | `pong` | `c, now` | `c` echoed (a number, else null); `now` relay ms |
| relay | `error` | `code, text` (+ `cid, keys` for writes) | see below |

A member is `{ id, name, color, kind, here, version, since }`, and `out: 1` for an output page (its `hello` said `out: 1`). `hello` is tidied, not refused: `name` trimmed to
32 characters, `color` kept only as `#rgb` to `#rrggbbaa`, `kind` one of `ar`, `vr`, `desktop` (else
`desktop`), `here` true only if `true`, `version` up to 64 characters; `reload` is kept by the relay (true only if `1`)
and never listed. Before its hello a member is listed with empty values.

**Writes.** A batch has 1 to 500 `[key, value]` pairs and an optional `cid` (string or number, echoed; else
null). Keys are `[A-Za-z0-9_-]+` parts joined by dots (later parts may also hold `:`), at most 128 characters;
values any JSON up to 256 KB; a room holds at most 5000 keys and 4 MB (keys and values, as JSON). Every accepted batch gets the room's next `seq` and is
stored key by key with `{ v, seq, by }`: the last writer wins. The relay sends the batch as stored: deletions
caused by the epoch rule first, as `[k, null]`, then the accepted pairs in their order. Pairs it refuses are
named to the writer alone in an `error` (`refused`, with `cid` and `keys`); the rest of the batch still goes
through. When nothing is accepted, no `set` goes out and no seq is used.

- `null` deletes, but only in the deletable families `st.*` and `pose.*`; elsewhere it is refused.
- A station `st.<id>` (`id` 1-32 characters `A-Z a-z 0-9 _ -`) must be an object with a non-empty `story`.
- **Epoch rule**: writing `st.<id>` with another story than the stored one (or creating it, or deleting it)
  deletes all of that station's state keys `st.<id>.*` in the same seq. State keys written in the same batch
  are stored after that, so a batch can change the story and set its new state at once. Moving a station
  (same story) keeps its state.
- A state key `st.<id>.*` needs its station (as it stands after the batch): refused as `no such station`
  otherwise. If its value is an object with a `story` field (optional), that must be the station's story, or
  the write is refused as `stale` (a late write from before a change of story).

**Ephemeral.** `fx` needs a key as above and a value (any JSON, the message at most 64 KB). It is never stored
and never sent back to its sender. At most 60 a second per member; the rest are dropped without an answer (the
log counts them).

**Errors** (`{ t: 'error', code, text }`):

| code | when | then |
| --- | --- | --- |
| `bad` | a message that is not JSON, not an object, an unknown `t`, a malformed batch or `fx` | the socket stays |
| `refused` | pairs of a batch not stored (`cid`, `keys`: which; `text`: why, per key), or the room is full (4 MB or 5000 keys: the whole batch) | the socket stays |
| `rate` | more than 120 `set` messages a second (`cid`, `keys`) | the socket stays |
| `bad` (on connect) | no valid room code or client id | closed, 4000 |
| `room` | no such room (never made, or expired, or the relay restarted) | closed, 4004 |
| `proto` | another protocol number (query or hello) | closed, 4005 |
| `version` | the hello's `version` differs from the room's and the room does not move on to it (a room made without one takes the first; since v136 a room of `networks-<n>` takes a newer `networks-<m>` once nobody of its own version is connected, or a reload order asked for it, and never an older one: [Rooms across updates](#rooms-across-updates-v136)); `text` names the room's version (`the room runs version networks-42`) | closed, 4006 |
| `replaced` | the same client id connected again; the new socket stays | closed, 4008 |
| `timeout` | silent for `--timeout` seconds | closed, 4009 |
| `token` | the relay has a password and the socket brought none, or a wrong one (`&token=`) | closed, 4401, before anything of a room |
| `limit` | `--guesses`: this address looked up too many unknown room codes in the last minute (the room asked for may exist); with a password, also 20 wrong passwords in the last minute | closed, 4429: try again in a minute |
| `busy` | `--sockets`: this address has too many sockets open | closed, 4429: try again when one has closed |

(4429 and 4401 are asdf10k-collab-backend's codes; until v109 the limits closed with 4029, which the app still takes.)

Broken WebSocket frames close the socket with the RFC 6455 codes: 1002 (unmasked frame, reserved bits,
bad control frame or continuation, unknown opcode), 1003 (binary message), 1007 (not UTF-8), 1009 (a
message over 1 MB, refused as soon as its header says so). 1001: the relay is stopping. With an origin rule
(`--origin`, `--public`), a socket from a page of another origin, or with no `Origin` at all unless
`--allow-no-origin`, gets HTTP 403 instead of the upgrade.

**Liveness.** The relay pings every member over WebSocket every 20 s; any frame counts as life, so a browser's
automatic pong keeps an idle member in. A member silent for 40 s is dropped (`timeout`). A room is deleted
6 hours after its last member left (or after it was made, if nobody joined).

**A restart** empties the rooms (unless `--keep`). A client whose room has gone (`room` on reconnecting) can make it again
under the same code (`POST /api/rooms` with `code`) and fill it from its own state.

## Rooms across updates (v136)

The owner, 11 November 2026: "It needs a: update this room on the relay switch that just tells everyone to reload, after
updates rooms otherwise get lost sometimes". Why they were lost: a room's version is the app's shared-state format
(`shared.js`'s `FORMAT`, `networks-<n>`; it changed in 12 of the 24 releases from v112 to v131), and until v136 it never
changed once the room was made. A deploy restarts the relay, which said goodbye with 1001; the pages still open, running
the old app, came back within a second and made the room again under the old version (`revive`), so every device that
took the update was refused (4006) and stopped trying, for as long as the room lived (6 hours after it emptied). Peer to
peer the room's id names the version, so the first updated device hosted a second room and the two drifted apart. Now:

- **A room moves on, never back** (`takeOver` in `server.mjs`): a newcomer whose hello names a newer `networks-<m>` than
  the room's `networks-<n>` takes the room to it once no other connected member has said hello with the room's version
  (a member that has not said hello yet does not count), or while a reload order named that version (below). The log
  says `XYZ version networks-41 -> networks-42`. Members still on the old version then get the relay's own order and are
  refused (4006): one whose hello said `reload: 1` (an app that obeys orders, v136 on) only 12 s after it was first told
  (`ORDER_GRACE`, from the order, else from the move; at least 3 s after the move), since it reloads in its turn, up to 8
  s after the order, and one refused before its turn reloaded at once (a page) or was asked (a headset) mid-countdown, so
  the stagger that spares the router was lost (the review of v136); an older app, which ignores the order, 3 s after the
  move. An app refused all the same while its order counts down (a slow reload) keeps its turn. An older newcomer is
  refused with 4006 as before (a device that missed the update, waking in an upgraded room, would otherwise turn it
  back); its words name the room's version. Versions
  that are not `networks-<n>` (the tests' `v1`) only ever match exactly. The keys are kept as they are (every bump so far
  only added fields and keys, which the app reads leniently; `shared.js` has a `MIGRATE` table for one that does not).
- **The app waits or reloads** (`shared.js`, `versionRefused`): refused by an older room, a device says so (*Room XYZ
  still runs version networks-41 on a device that has not updated: joining as soon as it has*, status `older`) and tries
  again every 3 s, so it is in as soon as the last old device has reloaded (an older relay without `versions` in its ping
  cannot move a room on, and each try keeps the room from expiring: it gives up after 2 minutes there). Refused by a newer
  room, it reloads (outside a headset at once, at most once in ten minutes; in one the update panel asks), or, while a
  reload order counts down there, in its turn as it was going to (40 s after its turn without a reload, as above). Pages outside
  a headset in a room also take a new `FORMAT` by themselves after a 20 s countdown on the update bar (*Not now* holds it
  off for 5 minutes), so a page left on Later no longer holds a room back.
- **Update the room** (the switch: the page's Shared dialog under the room's code, the headset menu's *Circles* tab under
  the room's heading, and the update bar's and panel's *Reload every device*; two presses, the first arming it for 3 s;
  anyone in the room, never refused by a lock, never from a camera; *Reload this device* in a room on one device): the
  device that presses asks the release (`version.json`) for the version and shell to come back with, writes its own copy
  of the room, and, on a relay, posts `POST /api/rooms/<code>/reload` (bringing the room back first when the relay lost it),
  which reaches every member whatever its version; on an older relay, peer to peer, or as an effect in the room
  (`q.reload`). Every device then reloads in turn (by when it came into the room, the presser last: 0.4 s, then 0.5 s more
  each, at most 8 s; a headset at least 3 s, with a notice, and *Enter VR to continue* after it; back in its next session
  at its station without walking in), keeping its place, and comes back by the room's code in its address. Back, it
  checks it got the release the order named (the service worker answers from its old cache after 4 s or a network
  error): if not, once more, twice at most, then it says *This device could not fetch the new version: reload it by
  hand*. An app older than v136 ignores the order; once the room has moved on it is refused (4006), and its own live
  updates ask it to reload.
- **`--keep <file>`** keeps the rooms across restarts (above): with it a deploy no longer empties them, so the old pages
  never make them again. On Coolify: step 6 of [Public hosting on Coolify](operations.md#public-hosting-on-coolify).
- **Peer to peer** (no relay): every device that gets the order lets go of the old id as it reloads and claims the new
  version's (`lbinet-<FORMAT>-<code>`); the first back hosts from its copy, written as it went, and the rest link to it,
  so the room does not split as long as every device got the order. Not yet: a device of a newer version that finds no
  host on the new id does not look for one on the old id to send it the order; a straggler that missed the order stays on
  the old id until its own live update reloads it.
- What is still untested until tried on real devices: the timings over real Wi-Fi with ten headsets (the service worker's
  4 s fallback there), *Enter VR to continue* after an order on a Quest, `--keep` on Coolify's volume through a rolling
  deploy, and frozen tabs on Android.

## Introduction server for peer to peer (`/peerjs`)

Devices in a shared room can also link to each other directly (WebRTC data channels, through PeerJS 1.5.5, vendored as
`peerjs.min.js`). Before they can, something must introduce them: pass each one's offer, answer and network
candidates to the other. By default PeerJS's free public server (`0.peerjs.com`) does that. The relay does it too,
speaking the same protocol, so that

- **tests** need no internet (`tools/peer.mjs`, and the protocol in `relay/test.mjs`), and
- **an event** can have its own introduction server when the public one is down, slow or not wanted (on the laptop on
  the event's Wi-Fi, or a public relay): then nothing about the devices goes beyond the relay (and the STUN server).

Once two devices are linked their messages go straight from one to the other, not through the relay. It is on by
default and costs nothing while nobody uses it; `--no-peer` turns it off. A PeerJS client uses it with

```js
new Peer(id, { host: '192.168.1.20', port: 8787, path: '/peerjs', secure: true,   // secure: https and wss (--lan)
  config: { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] } });         // (key: PeerJS's default, peerjs)
```

The peer-to-peer test page takes it from its address, `#room=ABCD&peer=<address>:8787` (the path `/peerjs` when none is
given; `http://` or `https://` in front says how to reach it, else as the page is reached), and shows which server it
uses. The relay serves that page too: `https://<address>:8787/p2p/#room=ABCD&peer=<address>:8787` with `--lan`. A page
on `https://` (GitHub Pages) can only use an introduction server on `https://` whose certificate it trusts: `--lan`'s
self-signed one is refused there without asking, as for rooms (open the page from the relay instead).

With `--public` (or `--origin`, `--sockets`) the same rules hold here as for rooms: only the app's pages and the
relay's own (403 for other origins, and for a socket with no `Origin` unless `--allow-no-origin`), and an address's
sockets here count with its room sockets (past `--sockets`: `ERROR` *too many connections from your network*, closed
4429). It stays on: peer to peer is the fallback when the relay is away. With a password (`COLLAB_TOKEN`) PeerJS's key is
the password (`new Peer(id, { ..., key: '<password>' })`; the app does this by itself for a relay whose password the
device keeps): its default key `peerjs` gets `INVALID-KEY` and close 4401, the id request is `/peerjs/<password>/id`,
`GET /peerjs` needs it as the API does, and failures count as above.

**Protocol** (what PeerJS 1.5.5's client expects; ids, not rooms; nothing stored). HTTP, with CORS and preflights as
the API (other keys or paths 404, other methods 405):

| request | answer |
| --- | --- |
| `GET /peerjs/peerjs/id?ts=...` | a new id (a UUID) as plain text, for a client that brings none |
| `GET /peerjs` | `{ name, key, path }` |
| `GET /peerjs/peerjs/peers` | 401: listing peers is off |

The socket is `/peerjs/peerjs?key=peerjs&id=<id>&token=<token>&version=...`; JSON text messages with a `type`:

| from | `type` | meaning |
| --- | --- | --- |
| server | `OPEN` | the id is this socket's; also when the same id comes again with the same token (a reconnect while the old socket hangs on: the new one wins, the old is closed with 4008) |
| server | `ID-TAKEN` `{ payload: { msg } }` | another socket holds the id with another token; closed (4001) |
| server | `INVALID-KEY` | a key other than `peerjs` (closed, 4003); with a password, any key but the password (closed, 4401) |
| server | `ERROR` `{ payload: { msg } }` | no id, token or key, an id PeerJS would not make (letters and digits, single `-`, `_` or spaces between them, at most 64), a token over 64 characters (closed, 4000), or 5000 ids connected (4013) |
| client | `OFFER`, `ANSWER`, `CANDIDATE`, `LEAVE` `{ dst, payload }` | passed on to `dst` as `{ type, src, dst, payload }`, `src` the sender's id whatever it wrote |
| client | `HEARTBEAT` | PeerJS sends one every 5 s; like any frame, it keeps the id |
| server | `EXPIRE` `{ src, dst }` | messages for an id not connected wait 5 s (at most 128 KB per id; a `LEAVE` is not kept): if it connects meanwhile it gets them after its `OPEN`, in order; else each sender hears `EXPIRE` once, `src` the absent id (PeerJS reports `peer-unavailable`) |

Anything else (not JSON, another type, no `dst`, a message over 64 KB, more than 200 a second per id) is dropped
without an answer, as PeerJS's own server does (an `ERROR` would end the client). An id is free as soon as its socket
closes, or once silent for `--timeout` (40 s; closed with 4009): the relay pings every socket every `--ping` seconds
and a browser answers by itself, so only a device that has gone falls silent. 1001: the relay is stopping.


## Compared with asdf10k-collab-backend

The owner may merge this relay with menchelab's asdf10k-collab-backend some day ("make sure to run everything so that it
is quite the same if possible, we might merge at some point"; 3 November 2026). What already matches it, and what
does not yet:

**The same**

- `COLLAB_TOKEN`: one shared token; trimmed; empty or unset means no authentication. `COLLAB_PORT` and `COLLAB_HOST`
  name the port and the address (our defaults stay 8787 and 0.0.0.0; its are 8789 and 127.0.0.1).
- Required on everything but `GET /api/health`: HTTP takes `Authorization: Bearer <token>` or `?token=`, the WebSocket
  `?token=`. Compared as there (`tokenMatches`): equal-length buffers with `timingSafeEqual`, false when none is given.
- A missing or wrong token: HTTP 401 `{"error":"missing or wrong token"}`; a socket gets the protocol's error message,
  then close 4401. Too many failures: 429 `{"error":"too many failed attempts, wait a minute"}`, close 4429.
- Its `FailureLimiter`: 20 failed attempts per client address in a fixed window of a minute, swept every minute, checked
  before the token. Ours counts only a wrong token (its counts an unknown room code too, and a missing token): our pages
  ask before they know the token and bring their kept rooms back after a restart, from one address behind an event's
  router (`--guesses` limits unknown codes under `--public`).
- `GET /api/health` answers `{ ok, protocol, rooms }`, `rooms` a count. CORS allows the `Authorization` header.

**Not the same (yet)**

- **Protocol.** Ours: one socket at `/api/ws?room=XYZ&id=<id>&proto=1`, `hello`, `set { batch: [[k, v]], cid }`, `fx`,
  `welcome { keys, members, now }`, stations with their own epoch rule (a station given another story drops its keys),
  per-member rates and room limits. Its: `/api/rooms/<code>/ws?protocol=1&app=<version>&name=`, `set { epoch, keys }`,
  `eph`, `log`, one epoch per room (the key `dataset`). Other close codes differ: ours 4005 protocol, 4006 version, 4008
  replaced, 4009 timeout; its 4010 protocol, 4009 version (4000 and 4004 mean the same in both).
- **Routes.** Ours: `/api/ping`, `/api/near` (rooms on this network), `/api/watch` (hot reload), `/api/log` (headsets'
  alignment logs), `POST /api/rooms { app, version, code? }`, the introduction server at `/peerjs` (the token as PeerJS's
  key) and the app's own files. Its: `POST /api/rooms { appVersion, dataset? }`, `/api/rooms/<code>/ice` (voice chat's
  STUN and TURN), `/api/archive`, `/api/logs` (a debug timeline).
- **Persistence.** Ours keeps rooms in memory (a restart empties them; the pages bring them back from their copies), and
  with `--keep <file>` (v136) in one JSON file written every 5 s when they changed and as it stops. Its
  snapshots every room to `COLLAB_DATA_DIR`, archives expired ones and keeps a debug log there.
- **The token's place in the app.** Its app reads the token from its deployment's `index.json`. Ours is public on GitHub
  Pages, so each device enters it once and keeps it per relay origin (never in the app's files).
- **What counts as a failure.** Its counts a missing token too; ours only a wrong one (the app's own pages ask before
  they know it). Ours also refuses PeerJS's default key while a token is set, and checks the token on `/api/watch`.
- **The client's address.** Its takes the first `X-Forwarded-For` hop always; ours the `n`-th from the right, and only
  with `--proxy n` (a client could write anything before the proxy's entry). Ours limits by an IPv6 address's /64.
- **CORS.** Its is `*` always (the token is the gate); ours is `*` unless `--origin` or `--public` names the pages.
- **Settings.** Its other `COLLAB_*` variables (`COLLAB_ROOM_TTL_HOURS`, `COLLAB_LOG`, `COLLAB_DATA_DIR`, voice chat's)
  have flags here or nothing yet (`--expire`, `--quiet`). Ours is one Node file with no packages; its is TypeScript with
  `ws` and `zod`.

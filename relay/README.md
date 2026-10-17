# The relay (shared rooms)

A small server that lets several headsets and desktop browsers share a room: each sees the same stations
playing the same stories in step (the plan is [docs/shared-space-plan.md](../docs/shared-space-plan.md)). It keeps,
per room, the latest value of every shared state key and passes ephemeral messages (pointer rays, effects) on
without storing them. One file, `server.mjs`: Node 18 or newer, no packages (its own minimal WebSocket code). It
can serve the app as well (`--static .`), so the page and the relay share one address.

**Where it runs.** GitHub Pages serves static files only, so it cannot run the relay. The app itself keeps
working there as it does today; only shared rooms need the relay, on any machine that runs Node or Docker
(Coolify, a lab machine, a laptop).

**No accounts, no passwords: the room code is the secret.** Rooms live in memory: a restart empties them.
Meant for a lab network or a self-hosted server, not for the open internet.

## Running it

```sh
node relay/server.mjs [--port 8787] [--host 0.0.0.0] [--static .] [--cert cert.pem --key key.pem]
```

| flag | default | meaning |
| --- | --- | --- |
| `--port <n>` | 8787 | port; `0` picks a free one (the start line says which) |
| `--host <addr>` | 0.0.0.0 | address to listen on |
| `--static <dir>` | off | also serve the app from `<dir>` (the repository root) |
| `--cert <file> --key <file>` | off | speak HTTPS and WSS with this certificate (PEM) |
| `--timeout <s>` | 40 | a member silent this long is dropped |
| `--expire <s>` | 21600 (6 h) | a room without members is deleted after this |
| `--ping <s>` | 20 | how often the relay pings every member (keeps proxies from closing idle sockets) |
| `--quiet` | off | no log lines |

It prints `relay listening on http://<host>:<port>` when it starts, then one line per event: a room created, a
join, a hello, every stored write (`XYZ set #12 by k7f2: st.a1.play`, deletions as `key=null`), every refusal
with its reason, dropped ephemeral messages (counted), a leave, a timeout, an expired room. `X-Forwarded-For`
is used for these lines only. It stops cleanly on SIGTERM (telling every member, close code 1001).

Headsets need a secure context for WebXR: `https://`, or `http://localhost`. A page on `https://` can only open
`wss://` sockets. Three set-ups:

### 1. Coolify (recommended): one address for the app and the relay

1. In Coolify, **New resource** > this Git repository (and branch).
2. Build pack **Dockerfile**; base directory `/`, Dockerfile location `/relay/Dockerfile`.
3. Ports exposed: **8787**.
4. Give it a **domain** (`https://networks.example.org`); Coolify's proxy gets a certificate for it and passes
   WebSocket upgrades through without further settings (the relay's pings every 20 s keep an idle socket open
   through any proxy timeout above that).
5. Deploy. Check `https://networks.example.org/api/ping` (the image's health check uses it too).

Then open `https://networks.example.org/` on every headset and desktop: the relay serves the app, and the
app's shared-room client talks to the relay on the same origin (`wss://networks.example.org/api/ws`). Use the
same page link on every headset (Quest shared spaces are per page URL). The image (`node:22-alpine`, about
8 MB of app) holds the app files and the relay only; `.dockerignore` leaves out `tools/`, `ikerdata/`, `docs/`
and the git history. A redeploy restarts the relay and empties its rooms (see "A restart" below).

### 2. The app on GitHub Pages, the relay elsewhere

Run the relay as in 1 (or on any host with HTTPS in front), and keep the app on GitHub Pages. The app is told
the relay's address once (it remembers it), or by a link:
`https://<user>.github.io/<repo>/#s=XYZ&relay=wss://networks.example.org`. The API sends CORS headers (and
answers Private Network Access preflights) for this. The relay must be on `wss://` (a Pages site is `https://`),
and the app on Pages and the relay should be the same version (a room refuses another app version).

### 3. A laptop, for testing

```sh
node relay/server.mjs --static .          # the app and the relay on http://<laptop>:8787
adb reverse tcp:8787 tcp:8787             # once per headset (USB, or wireless adb: adb -s <serial> reverse ...)
```

Then open `http://localhost:8787/` in Quest Browser on each headset: `localhost` is a secure context, so WebXR,
the service worker and `ws://` all work, and every headset has the same page URL. Desktop browsers on the
laptop use the same address; other machines can use `http://<laptop-ip>:8787/` for the desktop page (no
headset view there: not a secure context).

Caveats: a headset that opens `http://<laptop-ip>:8787/` gets no WebXR. `--cert/--key` with a self-signed
certificate is a poor fit for headsets: each must accept the browser's warning, a page with a certificate
error does not get its service worker, and a `wss://` connection to a host whose certificate was not accepted
fails without asking. On a lab machine use a real certificate for a real name instead (for example from Let's
Encrypt with a DNS challenge, the name pointing at the machine's LAN address):
`node relay/server.mjs --static . --port 443 --cert fullchain.pem --key privkey.pem`.

## HTTP API

All under `/api/`, JSON, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` (preflights: 204).

| request | answer |
| --- | --- |
| `GET /api/ping` | `{ now, proto }`: relay time (ms) and protocol number (1) |
| `POST /api/rooms` `{ app, version, code? }` | 201 `{ code }`: a new room, 3 letters A-Z. With `code`, that code if it is free (409 `{ error: 'taken' }` if not): how a client brings back its room after a relay restart. 400 for a body that is not JSON or a bad code, 413 over 16 KB, 503 at 2000 rooms |
| `GET /api/rooms` | `[{ code, members, names, stations, idle, version }]`: `members` a count, `names` theirs, `stations` how many `st.<id>` keys, `idle` seconds since the last member left (0 while anyone is in) |
| `GET /api/rooms/XYZ` | `{ code, app, version, created, seq, idle, members, keys }` (for debugging), or 404 |

With `--static <dir>`, every other path is a file of the app: `GET` and `HEAD`, `/` and folders give their
`index.html`, no listings, nothing whose path has a part starting with `.` (no `..`, no `.git`), no links that
lead out of the folder. `Cache-Control: no-cache` with `ETag`/`Last-Modified` (304 when unchanged, as the
service worker expects), gzip for text when asked, single byte ranges on every file (206; 416 when
unsatisfiable; the narration's `<audio>` element asks for them), types for `.html .js .mjs .json .webmanifest
.css .txt .md .svg .png .jpg .webp .ico .gif .mp3 .ogg .wav .mp4 .wasm .woff2 .glb .pdf`. Without `--static`,
`/` answers a line of text.

## WebSocket protocol (version 1)

Connect to `/api/ws?room=XYZ&id=<client id>` (`wss://` behind HTTPS). The room code is case-insensitive; the
client id is 1-64 characters `A-Z a-z 0-9 _ -`, random per page load and kept across reconnects. An optional
`&proto=1` is checked. A second socket with the same id replaces the first (`replaced`). Every message is one
JSON object with a `t` field, as a text frame; at most 1 MB.

| from | `t` | fields | meaning |
| --- | --- | --- | --- |
| relay | `welcome` | `you, room, app, version, seq, keys {k: {v, seq, by}}, members [...], now, proto` | first message on every socket: the whole room |
| relay | `members` | `members [...]` | to everybody after any join, leave, hello or timeout (the joiner too) |
| client | `hello` | `name, color, kind, here, version` (`proto` optional) | who I am; again after any change |
| client | `set` | `batch [[k, v], ...], cid` | stored writes: one batch, one seq |
| relay | `set` | `batch, seq, by, cid` | to everybody, the writer included (its acknowledgement) |
| client | `fx` | `k, v` | ephemeral, not stored |
| relay | `fx` | `k, v, by` | to everybody but the sender |
| client | `ping` | `c` (client ms) | |
| relay | `pong` | `c, now` | `c` echoed (a number, else null); `now` relay ms |
| relay | `error` | `code, text` (+ `cid, keys` for writes) | see below |

A member is `{ id, name, color, kind, here, version, since }`. `hello` is tidied, not refused: `name` trimmed to
32 characters, `color` kept only as `#rgb` to `#rrggbbaa`, `kind` one of `ar`, `vr`, `desktop` (else
`desktop`), `here` true only if `true`, `version` up to 64 characters. Before its hello a member is listed with
empty values.

**Writes.** A batch has 1 to 500 `[key, value]` pairs and an optional `cid` (string or number, echoed; else
null). Keys are `[A-Za-z0-9_-]+` parts joined by dots (later parts may also hold `:`), at most 128 characters;
values any JSON up to 256 KB; a room holds at most 4 MB. Every accepted batch gets the room's next `seq` and is
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
| `refused` | pairs of a batch not stored (`cid`, `keys`: which; `text`: why, per key), or the room is full | the socket stays |
| `rate` | more than 120 `set` messages a second (`cid`, `keys`) | the socket stays |
| `bad` (on connect) | no valid room code or client id | closed, 4000 |
| `room` | no such room (never made, or expired, or the relay restarted) | closed, 4004 |
| `proto` | another protocol number (query or hello) | closed, 4005 |
| `version` | the hello's `version` differs from the room's (a room made without one takes the first) | closed, 4006 |
| `replaced` | the same client id connected again; the new socket stays | closed, 4008 |
| `timeout` | silent for `--timeout` seconds | closed, 4009 |

Broken WebSocket frames close the socket with the RFC 6455 codes: 1002 (unmasked frame, reserved bits,
bad control frame or continuation, unknown opcode), 1003 (binary message), 1007 (not UTF-8), 1009 (a
message over 1 MB, refused as soon as its header says so). 1001: the relay is stopping.

**Liveness.** The relay pings every member over WebSocket every 20 s; any frame counts as life, so a browser's
automatic pong keeps an idle member in. A member silent for 40 s is dropped (`timeout`). A room is deleted
6 hours after its last member left (or after it was made, if nobody joined).

**A restart** empties the rooms. A client whose room has gone (`room` on reconnecting) can make it again
under the same code (`POST /api/rooms` with `code`) and fill it from its own state.

## Testing

```sh
node relay/test.mjs
```

It starts the relay on a free port (timeouts of 1 s, serving the repository), and checks the API, joining and
its refusals, welcome and members, ordering and acknowledgement, last writer wins, null refused outside the
deletable families, the epoch rule, `fx` (not stored, not echoed, rate capped), ping and pong, a late joiner,
malformed and oversized messages, hand-made frames (masking, fragmentation with a ping inside, control frames,
close), member timeouts, version and protocol mismatches, replaced sockets, room expiry, the static files
(types, gzip, byte ranges, 304, path traversal attempts, a link out of the folder) and the log. It exits 1 on
a failure. The shared-room client in the app has its own test (`tools/collab.mjs`).

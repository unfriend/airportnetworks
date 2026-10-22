# The relay (shared rooms)

A small server that lets several headsets and desktop browsers share a room: each sees the same stations
playing the same stories in step (the plan is [docs/shared-space-plan.md](../docs/shared-space-plan.md)). It keeps,
per room, the latest value of every shared state key and passes ephemeral messages (pointer rays, effects) on
without storing them. One file, `server.mjs`: Node 18 or newer, no packages (its own minimal WebSocket code). It
can serve the app as well (`--static .`), so the page and the relay share one address.

**Where it runs.** For now on a machine (a laptop will do) on the **same Wi-Fi as the headsets**, not on the
internet. It serves the app too, so every headset and desktop opens one address on that machine. GitHub Pages
serves static files only, so it cannot run the relay; the app keeps working there for everyone else, and only
shared rooms need the relay. Public hosting (Coolify) stays possible later: see the end of this file.

**No accounts, no passwords: the room code is the secret.** Rooms live in memory: a restart empties them.

**Running a session with headsets:** the checklist is [docs/event-runbook.md](../docs/event-runbook.md); this file
is the reference for the relay itself.

## Running it

```sh
node relay/server.mjs [--lan] [--port 8787] [--host 0.0.0.0] [--static .] [--cert cert.pem --key key.pem]
```

| flag | default | meaning |
| --- | --- | --- |
| `--port <n>` | 8787 | port; `0` picks a free one (the start line says which) |
| `--host <addr>` | 0.0.0.0 | address to listen on |
| `--static <dir>` | off | also serve the app's files from `<dir>` (the repository root); nothing else (see HTTP API) |
| `--cert <file> --key <file>` | off | speak HTTPS and WSS with this certificate (PEM) |
| `--timeout <s>` | 40 | a member silent this long is dropped |
| `--expire <s>` | 21600 (6 h) | a room without members is deleted after this |
| `--ping <s>` | 20 | how often the relay pings every member (keeps proxies from closing idle sockets) |
| `--quiet` | off | no log lines |
| `--lan` | off | for headsets on the same Wi-Fi: HTTPS with a certificate of its own (made with `openssl` in `relay/.lan/`) and the app's files served from the repository; prints the address to open on the headsets |

It prints `relay listening on http://<host>:<port>` when it starts and, when it serves the app on every address
(`--host 0.0.0.0`), what to open: over HTTPS the `https://<address>:<port>/` for the headsets; over plain HTTP
the address for desktops only and how to reach it from a headset (`--lan`, or `adb reverse` and
`http://localhost:<port>/`), since a headset gets no VR or AR at an `http://` address. Then one line per event: a room created, a
join, a hello, every stored write (`XYZ set #12 by k7f2: st.a1.play`, deletions as `key=null`), every refusal
with its reason, dropped ephemeral messages (counted), a leave, a timeout, an expired room. `X-Forwarded-For`
is used for these lines only. It stops cleanly on SIGTERM (telling every member, close code 1001).

Headsets need a secure context for WebXR (`https://`, or `http://localhost`), and a page on `https://` can only
open `wss://` sockets. `--lan` takes care of both on a local network: it makes a certificate of its own for
this machine's addresses (once, with `openssl`, in `relay/.lan/`, made again when the addresses change), serves
the app's files from the repository over HTTPS, and prints the address to open.

## A session on one Wi-Fi, step by step

**Once, before the first session**

1. A machine (a laptop will do) on the same Wi-Fi as the headsets, with Node 18 or newer, `openssl` and a copy
   of this repository:

   ```sh
   git clone https://github.com/unfriend/airportnetworks.git
   cd airportnetworks
   ```

   macOS and Linux have `openssl`. On Windows it comes with Git but is not on the PATH: run the relay from
   **Git Bash**, or add `C:\Program Files\Git\usr\bin` to PATH.
2. A Wi-Fi where devices can reach each other. University and guest networks (eduroam, for instance) usually
   keep devices apart: then use a router of your own or a phone's hotspot. Let the machine's firewall accept
   connections on port 8787 (macOS and Windows ask the first time the relay starts: allow it on private
   networks).
3. For Quest Browser's experimental shared space (used for alignment unless you switch it off on the Shared panel,
   *Shared space: on*; with both headsets on one browser version it lined them up without tape): in
   Quest Browser open `chrome://flags`, set **WebXR experiments** to Enabled and restart the browser completely;
   turn on **Enhanced spatial services** in the headset's settings (privacy, device permissions); and **update
   Quest Browser on every headset to the same version** (the panel shows it beside the shared space's id: in our
   test the headset with the older browser never joined the other's space). Leave **Physical space features** on
   (developer settings) and run **Space Setup** in the room on every headset: the shared space rests on the
   headset's scan of the room, and two headsets with that setting off were in two spaces 2.6 m apart under one id
   (the panel says *No room scan here* when a headset has none). Open the same address everywhere,
   start AR on one headset, wait ten seconds, then the others. A headset whose panel says *your own floor* on
   the shared space line has not joined (unless it was the first). Leaving AR on one headset and entering it
   again can give it a new space under the same id: the panel then says *Not in the others' shared space*.
   Restart both headsets' browsers and start them one after the other again, or calibrate both on the same tape
   marks (that never depends on the shared space). See [docs/shared-spaces.md](../docs/shared-spaces.md).
4. Two marks for calibration: two crosses of tape on the floor or a table, a metre or more apart (at least
   50 cm; the further apart, the better the room lines up). Mark A is the room's origin.
5. Floor space: Arrange all needs about 9.6 m wide and 4 m deep for all ten (two rows of five, starting 1.2 m in
   front of where you stand); in a smaller room add 2-4 stations with **Add here** (headset) or **Add a station**
   (page).

**Each session**

1. On the machine, in the repository: `node relay/server.mjs --lan`. It prints the address to open, for example
   `https://192.168.1.20:8787/`. If it prints several (a machine with a cable and Wi-Fi, or a VPN), pick the
   one on the Wi-Fi the headsets use.
2. On every headset, open **exactly that address** in Quest Browser (a bookmark helps: shared spaces need the
   same page address on every headset). The first time, the browser warns that the certificate is not trusted:
   choose to continue (it is this machine's own certificate).
3. Open **Shared**: on the page, the **Shared** button in the top bar or on the Stories screen; in the headset,
   the **Open** tab on the **Shared space** panel above your left controller (beside the story panel without one). The first person: **Start a room**,
   then **Arrange all** puts the ten stories as stations in two rows of five in front of you (or one story where you
   stand: **Add here** in the headset, **Add a station** on the page). Arrange all from a page, without a
   headset, puts the rows round the room's origin (mark A). Everyone else: **Shared**, then pick the room under
   **Open rooms**. To move a station, point at its ring or card in the headset and hold the grip: point to swing
   it round, raise or lower the controller to push it away or bring it nearer, twist your wrist to turn it, and let
   go to put it down (everyone sees it move). On the page, drag its dot on the room map to move it, or its small
   square to turn it. At your own station the grip moves its scene and story panel (both grips resize the scene) for everyone there, and nobody can move them anywhere else, so everyone sees them alike. Once
   the stations are where you want them, **Lock the layout** (on the Shared panel, or **Lock layout** in the
   Shared dialog) so nobody moves one by accident; anyone can unlock it. In the headset the Shared panel rides
   on your left controller, so it is always at hand (without a left controller it stays beside the story
   panel).
4. In the room, use **Enter AR**: you see the room and each other, and the stations stand in it. In VR the panel
   asks once whether you are in the same room as the others (then the room is aligned as in AR) or elsewhere
   (then you get your own floor and the others see you as an avatar).
5. **Calibrate every headset on the same two marks** (Shared panel, **Calibrate**): a bright ring shows the point
   that counts, at the front of the controller. Put it on mark A, hold still, pull the trigger once; then the
   same on mark B (while calibrating, any trigger pull away from the Shared panel takes a mark). Orange crosses then show where this headset puts the
   marks: they must sit on the tape (they show for 30 s, and whenever the Shared panel is open). A headset's own
   calibration is never overridden. It is kept for next time by two anchors at the marks ("Room calibration from
   last time", when the headset can save anchors); a headset without anchors, or after a recentre (a
   long press on the Meta button), may ask to calibrate again. The room's floor is set by the first headset
   that calibrates: if another headset's floor is lower or higher (a Guardian floor set wrong), it says so on the
   panel ("Your floor is 28 cm lower than the room's") and allows for it, so things stand at the same height
   for everyone; fix that headset's floor in its boundary settings when you can.
6. Walk up to a station (or point at its card and pull the trigger): its story runs for everyone there, its
   narration plays where it stands, and everyone sees everyone's pointer.
7. Desktop operators on the same network open the same address in a browser (and accept the warning once),
   join with **Shared**, and follow a station from the room map.

People elsewhere (remote VR, remote desktops) cannot reach a relay on a local network: that needs a VPN to the
machine or public hosting.

**If something does not work**

- **A headset cannot open the page**: open `https://<address>:8787/api/ping` in Quest Browser. It answers
  `{"now":...}` when the headset reaches the relay. If it does not, check in this order: the address (the one
  on the Wi-Fi, if several were printed); the Wi-Fi (client isolation: networks that keep devices apart, such
  as eduroam or guest networks; try a phone's hotspot); the machine's firewall (port 8787, or Node allowed on
  private networks).
- **The certificate warning**: expected with `--lan`; accept it once per headset (and once per desktop
  browser). When the machine's addresses change, the relay makes a new certificate and everyone accepts it once
  more.
- **No Enter VR or Enter AR button**: the page is not at a secure address (`http://<address>`): use `--lan`, or
  `adb reverse` and `http://localhost:8787/` (below).
- **The app says the room does not exist**: a mistyped room code, an expired room (6 hours after the last
  person left), or a relay that was restarted. Pick the room from **Open rooms** instead of typing, or start a
  new one. (A device that was in the room keeps a copy of it and brings it back by itself.)
- **No relay at all**: a room still works on one device (the panel says "this headset only"): its stations,
  their places and the lock are kept on the device, and the room moves to the relay once one answers (the app
  asks every 15 s, and at once when an address is entered), made there from the device's copy.
- **The headsets do not line up through the shared space**: the Shared panel shows each headset's Quest Browser
  version (people list) and warns when they differ: update both, one shared space needs one version. Then check on
  every headset: the WebXR experiments flag (`chrome://flags`, then restart the browser; an update can reset it),
  Enhanced spatial services on (Quest settings, privacy), the same address in the browser, and Space Setup done in
  this room, and *Shared space: on* on the Shared panel (it no longer stays off after a reload). Start one headset
  in AR first, wait until it says it found the shared space, then the other. If the panel says *Not in the others'
  shared space*, press Re-align; if that does not help, leave AR on both headsets, close Quest Browser on both, and
  start them again one after the other (a headset that left AR and came back on its own got a new space under the
  same id in our logs). Tape calibration (Calibrate, on the same two marks on every headset) does not need the
  shared space at all, and once two headsets are calibrated the panel says how far apart the shared space puts
  them; more than 10 cm, and the room stops using that space (*Shared space not usable*) until they agree again
  or reload.
- **A fresh shared space**: when the panel says the shared space is split (two calibrated headsets far apart
  through it), press *Fresh shared space* twice on the Shared panel (or in the page's Shared dialog). Every page in
  the room moves to the app under a new address (`/s/1/`, `/s/2/`, ...: the relay serves the app there too), where
  the headsets make a new shared space: they leave AR, then start AR on one headset first and wait for *Shared
  space found* before the others. The rooms, calibrations and anchors stay (they belong to the relay's address).
- **Starting the shared space afresh**: on every headset, Settings > Privacy and safety > Device permissions:
  *Clear* the physical space history (boundaries, Space Setup, stored anchors) and *Delete* the spatial data on
  Meta's servers; in Quest Browser clear the site data of the relay's address (this also forgets the app's
  calibration). Then restart the headsets, run Space Setup on each, check *Enhanced spatial services* and the
  WebXR experiments flag, and start AR on one headset before the others.
- **The headsets do not line up**: check the orange crosses on each headset (open the Shared panel). Crosses
  off the tape: calibrate that headset again, holding still at each mark. Crosses on the tape on both
  headsets but things still apart: please send the logs (below). The pointer rays of the others should start at
  their real controllers.
- **Things at different heights on two headsets**: one headset's floor is off (the panel says by how much, and
  allows for it once both have calibrated on the same marks). Set the floor again in that headset's boundary
  settings.
- **"Your marks are ... further apart than the room's"**: this headset touched other marks than the first one,
  or touched one badly: calibrate again on the same tape.
- **Off after a headset was switched off and on**: it moves the room as the headset says its origin moved,
  looks for its anchors again by their saved handles (they put it back on the marks) and shows the orange
  crosses for 30 s ("Check the marks"). If the panel says **Leave AR and enter it again** (the headset does not
  find its anchors in the same session after standby, `marks lost` in the log), do that: a new AR session finds
  the marks at once. If the crosses are still not on the tape, press **Calibrate** and please send the logs. Lined up through the shared space (no tape), it holds the room where the headset says it moved until the
  shared space agrees again (a few seconds; one that disagrees is judged after 20 s: right after waking the space is
  wrong for up to 15 s, and after a night it may come back made again). If it stays off, press **Re-align** on that headset's Shared panel (it
  asks for the shared space again and takes the room's frame afresh, as the others show it); if nothing changes,
  press it on the other headset, and please send the logs (`shared held after wake`, `shared after
  wake`, `shared asked again`, `realign` and `frame asked` lines say what it did).
- **Calibration lost after a recentre or a new session**: the anchors were not kept (private browsing, cleared
  site data, a full anchor store, or a browser without anchors). Calibrate again; **Forget calibration** (press
  twice) clears a headset's marks and anchors.
- **"Anchors not saved (the store is full)"** on the panel, or a headset that asks to calibrate after every
  restart: Quest Browser refused to save more anchors ("Maximum number of anchors reached!" in the log). The
  app deletes the saved anchors it no longer knows and tries once more. If the panel still says so, clear
  Quest Browser's browsing data (cookies and site data) on that headset, then calibrate once more. Meta's
  WebXR docs say a site can keep 8 persistent anchors at a time and clearing its browsing history deletes them;
  the browser's author says the browser keeps a limited set across all sites (so old addresses of the relay,
  another IP or port, may count too), and others report a store that fills early with entries that cannot be
  deleted from the page. The log line `anchors tidied` says what deleting did.
- **No sound at a station**: use **Sound check** on the Stories screen (it plays a beep through each sound
  engine).

**Without a certificate**: `node relay/server.mjs --static .` and, per headset in developer mode,
`adb reverse tcp:8787 tcp:8787` (USB or wireless adb); then open `http://localhost:8787/` on each headset, which
counts as secure (no warning, and the service worker runs). Other machines can use `http://<machine>:8787/` for
the desktop page only (no VR or AR there). The relay prints these addresses when it starts.

**Logs.** With `--lan` (or `--logs <dir>`) every headset in a room sends its log every 10 s: what its room
frame rests on, the shared space, its anchors and its head, sampled every 5 s. They are kept as
`relay/logs/<day>-<room>-<name>-<id>.jsonl` (the relay prints each new file). They hold each person's name in the room
(often their own first name), the room code and positions in the room. To have alignment looked at, send the folder
privately to whoever analyses it (zipped, not in a public place), and never push the logs to a public repository
(`relay/logs/` is git-ignored: keep it so).

**Caveats.** The self-signed HTTPS and `wss://` path (`--lan`) works on Quest 3 headsets. A page with a self-signed certificate gets no service worker (no offline copy;
nothing else changes). The app on GitHub Pages cannot use a relay with a self-signed certificate (the `wss://`
connection fails without asking): open the app from the relay instead. `--cert` and `--key` take a real
certificate if you have one.

## Later: public hosting (Coolify)

1. A name for it: with your DNS provider, point a record at the Coolify server (an `A` record
   `networks.example.org` -> the server's public IP address) and wait until it resolves; the certificate in
   step 5 needs it.
2. In Coolify, **New resource** > this Git repository (and branch).
3. Build pack **Dockerfile**; base directory `/`, Dockerfile location `/relay/Dockerfile`.
4. Ports exposed: **8787**.
5. Give it that **domain** (`https://networks.example.org`); Coolify's proxy gets a certificate for it and
   passes WebSocket upgrades through without further settings (the relay's pings every 20 s keep an idle socket
   open through any proxy timeout above that).
6. Deploy. Check `https://networks.example.org/api/ping` (the image's health check uses it too).

Then open `https://networks.example.org/` on every headset and desktop: the relay serves the app, and the
app's shared-room client talks to the relay on the same origin (`wss://networks.example.org/api/ws`). The image
(`node:22-alpine`, about 8 MB of app) holds the app files and the relay only; `.dockerignore` leaves out
`tools/`, `ikerdata/`, `docs/` and the git history (and the relay serves only the app's files in any case). A
redeploy restarts the relay and empties its rooms.
Or keep the app on GitHub Pages and give it the relay's address once (it remembers it), or by a link:
`https://<user>.github.io/<repo>/#s=XYZ&relay=wss://networks.example.org` (the API sends CORS headers and answers
Private Network Access preflights for this; the app versions must match).

## HTTP API

All under `/api/`, JSON, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` (preflights: 204).

| request | answer |
| --- | --- |
| `GET /api/ping` | `{ now, proto }`: relay time (ms) and protocol number (1) |
| `POST /api/rooms` `{ app, version, code? }` | 201 `{ code }`: a new room, 3 letters A-Z. With `code`, that code if it is free (409 `{ error: 'taken' }` if not): how a client brings back its room after a relay restart. 400 for a body that is not JSON or a bad code, 413 over 16 KB, 503 at 2000 rooms |
| `GET /api/rooms` | `[{ code, members, names, stations, idle, version }]`: `members` a count, `names` theirs, `stations` how many `st.<id>` keys, `idle` seconds since the last member left (0 while anyone is in) |
| `GET /api/rooms/XYZ` | `{ code, app, version, created, seq, idle, members, keys }` (for debugging), or 404 |
| `POST /api/log` `{ room, id, name, kind, entries }` | with `--logs` (or `--lan`): `entries` (objects, at most 2000) appended as JSON lines to `<logs>/<day>-<room>-<name>-<id>.jsonl`; 200 `{ lines }`, 400 for a bad body, 429 more than once a second per member, 507 over 20 MB a file; 404 without `--logs` |

With `--static <dir>`, every other path may be a file of the app, and only that: `index.html` (also at `/`),
`shared.js`, `sw.js`, `manifest.webmanifest`, `three.min.js`, `three.LICENSE.txt`, `proteins.html`,
`spatial.html`, `README.txt`, and the files directly in `stories/`, `audio/` and `icons/` (`APP_FILES` and
`APP_DIRS` in `server.mjs`: add to them when the app needs a new file or folder). Everything else is 404: the
authors' data (`ikerdata/`), `tools/`, `docs/`, the relay itself, folders (no listings), anything whose path has
a part starting with `.` (no `..`, no `.git`), and links that lead out of those files. `GET` and `HEAD`. `Cache-Control: no-cache` with `ETag`/`Last-Modified` (304 when unchanged, as the
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
close), member timeouts, version and protocol mismatches, replaced sockets, room expiry, the room's limits
(5000 keys; 4 MB with the keys counted), the static files (types, gzip, byte ranges, 304, path traversal
attempts, every file `sw.js` caches served and nothing else of the repository, links, no file left open by a
download cut short), the start lines (no `http://` address for headsets), `--lan` and the log. It exits 1 on
a failure. The shared-room client in the app has its own test (`tools/collab.mjs`).

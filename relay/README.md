# The relay (shared rooms)

<!-- toc (tools/docs/toc.mjs) -->
- 35: Running it (11.4 KB)
- 127: The shared password (`COLLAB_TOKEN`) (4.4 KB)
- 174: Rooms on this network (2.2 KB)
- 198: Where the rest is (1.7 KB)
<!-- /toc -->

A small server that lets several headsets and desktop browsers share a room: each sees the same stations
playing the same stories in step (the plan is [docs/shared-space-plan.md](../docs/shared-space-plan.md)). It keeps,
per room, the latest value of every shared state key and passes ephemeral messages (pointer rays, effects) on
without storing them. One file, `server.mjs` (and `scenes.mjs`, the studio's listing and upload path rules, which
`tools/studio/scan.mjs` shares): Node 18 or newer, no packages (its own minimal WebSocket code). It
can serve the app as well (`--static .`), so the page and the relay share one address. It is also an introduction
server for devices that link to each other directly (peer to peer, PeerJS's protocol at `/peerjs`; see
[Introduction server for peer to peer](docs/protocol.md#introduction-server-for-peer-to-peer-peerjs)).

**Where it runs.** On a machine (a laptop will do) on the **same Wi-Fi as the headsets**, or on a public server
(the owner's Coolify) with `--public`. It serves the app too, so every headset and desktop opens one address on that
machine. GitHub Pages serves static files only, so it cannot run the relay; the app keeps working there for everyone
else, and only shared rooms need the relay. Public hosting: [Public hosting on Coolify](docs/operations.md#public-hosting-on-coolify).

**No accounts; one shared password if you want it.** Rooms live in memory: a restart empties them, unless `--keep <file>`
(v136) keeps them in a file across restarts ([Rooms across updates](docs/protocol.md#rooms-across-updates-v136)). On a laptop at an
event the relay trusts everyone who can reach it; on the internet `--public` narrows that down (only the app's pages, no
list of rooms or names, limits per address). With a password (`COLLAB_TOKEN`, as asdf10k-collab-backend has it: [The
shared password](#the-shared-password-collab_token)) only devices that have entered it can use the relay at all;
without one a room's code (three letters) is all it takes to join it.

**Running a session with headsets:** the checklist is [docs/event-runbook.md](../docs/event-runbook.md); this file
is the reference for the relay itself.


## Running it

```sh
node relay/server.mjs [--lan] [--port 8787] [--host 0.0.0.0] [--static .] [--cert cert.pem --key key.pem] [--proxy [n]] [--public] [--token <word>] [--scenes <dir>|r2 [--max-upload <MB>] [--ffmpeg <path>] [--app <url>]] [--trackers [<port>]]
COLLAB_TOKEN=<word> node relay/server.mjs ...   # the same password, from the environment (better: not in a command)
```

| flag | default | meaning |
| --- | --- | --- |
| `--port <n>` | 8787 | port; `0` picks a free one (the start line says which) |
| `--host <addr>` | 0.0.0.0 | address to listen on |
| `--static <dir>` | off | also serve the app's files from `<dir>` (the repository root); nothing else (see HTTP API). Text is sent packed: brotli to a browser that takes it once its copy is made (in the background, once per file and change; gzip until then), else gzip; each with an ETag of its own, any of a file's a 304 (v219) |
| `--cert <file> --key <file>` | off | speak HTTPS and WSS with this certificate (PEM) |
| `--timeout <s>` | 40 | a member silent this long is dropped |
| `--expire <s>` | 21600 (6 h) | a room without members is deleted after this |
| `--ping <s>` | 20 | how often the relay pings every member (keeps proxies from closing idle sockets) |
| `--quiet` | off | no log lines |
| `--no-peer` | off | no introduction server for peer to peer (`/peerjs`, on by default; it costs nothing while unused) |
| `--proxy [<n>]` | off | behind `n` reverse proxies (1 when no number is given: Coolify's or nginx alone; 2 with a CDN such as Cloudflare in front of it): a client's address is the `n`-th from the right in `X-Forwarded-For`, for [rooms on this network](#rooms-on-this-network). Without it the header is ignored (a client could write anything there); never turn it on for a relay that clients reach directly |
| `--lan` | off | for headsets on the same Wi-Fi: HTTPS with a certificate of its own (made with `openssl` in `relay/.lan/`) and the app's files served from the repository; prints the address to open on the headsets |
| `--watch [<dir>]` | off | while developing (hot reload): watch the app's files, the `--static` folder (or `<dir>`, then also served when `--static` is not given). The pages it serves swap a changed story in place, keeping their place, and reload (place kept) when a shell file changes; see [Hot reload](docs/operations.md#hot-reload---watch) |
| `--build` | off | with `--watch`: run a built story's `tools/<key>/build.mjs` when its sources change, so editing a set shows by itself |
| `--token <word>` | off | a shared password every client must bring ([The shared password](#the-shared-password-collab_token)); better set as `COLLAB_TOKEN` in the environment |
| `--scenes <dir>` | off | the studio's scenes: each subfolder of `<dir>` is one scene (models, textures, sounds, its `layout.json`), served and its layout saved there ([Your own scenes](docs/operations.md#your-own-scenes-the-studio)) |
| `--scenes r2` | off | the same, the scenes kept in a Cloudflare R2 bucket, its settings from the environment only (`R2_*`): [Scenes in Cloudflare R2](docs/operations.md#scenes-in-cloudflare-r2). A folder named `r2` is `./r2` |
| `--r2-check` | off | with `--scenes r2`: check the settings, the keys, the bucket's CORS rule and its upload links, say what is wrong, and stop |
| `--scenes-readonly` | off | with `--scenes`: never write a layout (the studio offers *Download layout.json* instead) and take no uploads |
| `--max-upload <MB>` | 512 | with `--scenes`: one uploaded file at most this big ([Uploading](docs/operations.md#uploading-the-upload-page)) |
| `--ffmpeg <path>` | the PATH's | with `--scenes`: the `ffmpeg` that makes long sounds mono MP3 (looked for once at the start; a named one that does not run stops the start) |
| `--no-ffmpeg` | off | never use `ffmpeg` (the studio then keeps long sounds as they are) |
| `--ffmpeg-limit <s>` | 180 | one conversion may take this long, then it is stopped |
| `--ffmpeg-video-limit <s>` | 1800 | a video converted to MP4 (H.264) may take this long, then it is stopped ([Converting a video](docs/operations.md#converting-a-video)) |
| `--app <url>` | the `--origin`, else `https://stories.lbi-netmed.com/` | where `/upload` sends people when the relay does not serve the app itself |
| `--keep <file>` | off | keep the rooms in `<file>` (JSON, written atomically every 5 s when they changed and as the relay stops, read back as it starts; its folder made; each room's keys turned into JSON again only after its own writes, v219): a restart, such as a deploy, no longer empties them ([Rooms across updates](docs/protocol.md#rooms-across-updates-v136)). Not `--store`, which is only a cap on their size |
| `--trackers [<port>]` | off (47800 when given without a port) | the PC's Vive trackers: take the bridge's readings (`tools/trackers/bridge.py`) on UDP `127.0.0.1:<port>` (`0` picks a free one, which the start line says), list them at `/api/trackers` and send them, lined up, to the rooms that turn them on ([The PC's Vive trackers](docs/operations.md#the-pcs-vive-trackers---trackers)). A port another program holds stops the start with a sentence |

The environment (asdf10k-collab-backend's `COLLAB_*` names, since shells and conda set `PORT` and `HOST` for other
things; a flag given as well wins):

| variable | default | meaning |
| --- | --- | --- |
| `COLLAB_TOKEN` | (none) | the shared password (`--token`); empty or unset: none, everything open as before |
| `COLLAB_PORT` | 8787 | `--port` |
| `COLLAB_HOST` | 0.0.0.0 | `--host` |
| `COLLAB_SCENES` | (none) | `--scenes` (`r2` for a bucket) |
| `R2_*` | (none) | the bucket for `--scenes r2`: [Scenes in Cloudflare R2](docs/operations.md#scenes-in-cloudflare-r2) (only from the environment) |
| `RELAY_ARGS` | (none) | more options, added after the command's own (Coolify: `--proxy 1 --public`) |
| `RELAY_LOG_TOKEN` | (none) | the log token (`--log-token`) |

For a public server ([Public hosting on Coolify](docs/operations.md#public-hosting-on-coolify)). Each is off unless given; `--public`
turns on all of them, with the defaults in the second column (a value given on its own wins):

| flag | with `--public` | meaning |
| --- | --- | --- |
| `--public` | | all of the below, and `--logs` only with a log token; no addresses to open on a LAN in the start lines |
| `--origin <list>` | `https://stories.lbi-netmed.com` | only pages from these origins (comma separated, the flag may be repeated; a scheme, a host and an optional port, no path) and the relay's own pages may open a socket (`/api/ws`, `/peerjs`) or use the API and the introduction server over HTTP. The relay's own pages: an `Origin` whose host is the one the request was sent to (`Host`, or with `--proxy` also `X-Forwarded-Host`). Another origin: 403, before any socket. CORS names the allowed origin (`Vary: Origin`) instead of `*`. A request with no `Origin` (the relay's own page asking with GET, the health check, curl) is answered; a socket with none is refused unless `--allow-no-origin` |
| `--allow-no-origin` | off | with an origin rule: also sockets that send no `Origin` (not a browser: tools, scripts) |
| `--unlisted` | on | no list of open rooms (`GET /api/rooms` answers `[]`), no member's name in any answer (`/api/near`: code, people, stations, version; `/api/rooms/<code>`: people as a count) or log line; `/api/ping` says `unlisted: true`. A room's own members still see each other's names (its people list) |
| `--guesses <n>` | 30 | per address, at most `n` lookups a minute of room codes that do not exist (a burst of `2n`): a socket for an unknown room, `GET /api/rooms/<code>` answered 404, `POST /api/rooms` with a code that is taken (409). Past that, every lookup of a code from that address is refused, a known one too (or the answers would say which codes exist), until the budget fills again: 429 with `Retry-After`, or on a socket `error` `limit` and close 4429 (4029 until v109; the app takes both). A member coming back (its id still in the room) is let in |
| `--creates <n>` | 10 | per address, at most `n` new rooms a minute (a burst of `2n`), then 429 |
| `--sockets <n>` | 64 | per address, at most `n` open sockets, rooms and the introduction server together (`error` `busy`, or PeerJS's `ERROR`, close 4429) |
| `--store <MB>` | 64 | every room together holds at most this many MB of keys and values (as JSON; each room still at most 4 MB): a write past it is refused (`the relay is full`) |
| `--log-token <t>` | (needed with `--logs`) | `POST /api/log` keeps a log only with the header `X-Log-Token: <t>` (none: 404, as when logs are off, so a page stops sending; a wrong one: 403). At least 16 characters. With a password (`COLLAB_TOKEN`) set, a request that brings it (`Authorization: Bearer`, which the app sends with its logs since v145) is kept in place of the log token, and `--public --logs` then starts without a log token. Better than on the command line: the environment variable `RELAY_LOG_TOKEN` (Coolify's environment; never in the repository) |

"Per address" is the device's address as rooms on this network take it: with `--proxy`, the one the outermost proxy
saw; IPv6 by its /64; kept only in memory as a keyed hash (a new key at every start), never logged. Every device
behind one router shares it (ten headsets and the laptops at an event): the defaults leave them room, a relay restart
included (each page looks its room up, finds it gone and brings it back: about three lookups of an unknown code a
device).

It prints `relay listening on http://<host>:<port>` when it starts and, when it serves the app on every address
(`--host 0.0.0.0`), what to open: over HTTPS the `https://<address>:<port>/` for the headsets; over plain HTTP
the address for desktops only and how to reach it from a headset (`--lan`, or `adb reverse` and
`http://localhost:<port>/`), since a headset gets no VR or AR at an `http://` address. Then one line per event: a room created, a
join, a hello, a room's stored writes in one line a second at most and always before the room's next other line (v220:
`XYZ set #12 by k7f2: st.a1.play`, or `XYZ 7 sets #12..#18 by k7f2: st.a1 st.a1.play; q1w2: st.b2`, each key after the
member who wrote it, deletions as `key=null`, at most 200 keys a line and the rest as `+n more`, never a value; presence
passed by for a backed-up connection is counted: a connection counts as backed up by what waits to leave, not by the
messages held a moment to leave together, so one large write holds back nobody's presence), every refusal
with its reason, dropped ephemeral messages (counted), a leave, a timeout, an expired room; and for the introduction
server an id joining, coming back, refused, leaving or timing out and an id that never came (ids only, `peer join
<id>`; a slot of rooms on this network shows with `******` in place of its network's id). No line names a client's
address or its network's id. With `--public` (or its parts) the start lines also say what it allows, refusals are
counted (`sockets refused: origin not allowed (3)`, one line per kind every few seconds, never an address) and no line
names a member (no names on the hello lines), and the lines with addresses to open on a LAN are left out. It stops
cleanly on SIGTERM (telling every member, close code 1001).

Headsets need a secure context for WebXR (`https://`, or `http://localhost`), and a page on `https://` can only
open `wss://` sockets. `--lan` takes care of both on a local network: it makes a certificate of its own for
this machine's addresses (once, with `openssl`, in `relay/.lan/`, made again when the addresses change), serves
the app's files from the repository over HTTPS, and prints the address to open.

## The shared password (`COLLAB_TOKEN`)

The owner (3 November 2026): "i would like to add a secret to the relay like how this project does it:
menchelab/asdf10k-collab-backend ... like one word like networksofthefuture2037 that i can use and enter on each client
if i want it to be able to use the relay, no other way to use it". So the relay takes one shared password, the
scheme of asdf10k-collab-backend's `COLLAB_TOKEN` ([Compared with
asdf10k-collab-backend](docs/protocol.md#compared-with-asdf10k-collab-backend) lists what matches and what does not):

- **Set it** in the relay's environment, `COLLAB_TOKEN=<word>` (or `--token <word>`, also in `RELAY_ARGS`). Empty or
  unset: no password, and the relay behaves exactly as before (a laptop at an event, the tests).
- **Needed for everything but** `GET /api/health` (`{ ok, protocol, rooms }`, `rooms` a count: open, as there, for
  health checks) **and the app's own files** (the pages, stories, `s/<n>/` copies: a page must load to ask for the
  password, and the app is public on GitHub Pages anyway). Preflights (`OPTIONS`) need none.
- **How a client brings it:** the API (`/api/ping`, `/api/near`, `/api/rooms`, `/api/rooms/<code>`, `/api/log`, ...)
  as `Authorization: Bearer <word>` or `?token=<word>`; the room's socket as `/api/ws?room=...&token=<word>` (browsers
  cannot set headers there); the dev stream as `/api/watch?token=<word>`; the introduction server as PeerJS's key (the
  socket's `key=<word>`, the id request's path `/peerjs/<word>/id`; PeerJS's default key `peerjs` is refused while a
  password is set). Compared in constant time.
- **Refused:** HTTP 401 `{"error":"missing or wrong token"}`. A room's socket gets the protocol's
  `{ t: 'error', code: 'token', text: 'missing or wrong token' }`, then close 4401, before anything of a room (no welcome,
  member, key or name); the introduction server's gets `INVALID-KEY`, then 4401.
- **Failed attempts** (a wrong password) are counted per address, as `--guesses` counts unknown room codes
  (with `--proxy` the one the outermost proxy saw; IPv6 by its /64; a keyed hash in memory, never logged), in a fixed
  window of a minute: after 20, everything from that address but `/api/health` and the app's files gets 429
  `{"error":"too many failed attempts, wait a minute"}` (`Retry-After: 60`), a socket `error` `limit` and close 4429
  (PeerJS's `ERROR`), for the rest of the minute, the right password too (or the limit would tell a guesser when it
  guessed right). A request with no password at all (or PeerJS's default key `peerjs`, which a page without one sends) is
  refused but **not counted**: guessing needs a password sent, and the app's own pages ask before they know one (every
  device behind an event's router shares one address). Nor is an unknown room code asked with the right password: the
  password is the gate, and after a relay restart every kept room is unknown for a moment, so ten headsets bringing their
  rooms back would lock their own address out (`--guesses` still limits unknown codes under `--public`).
- **Never logged:** the start line says a password is needed, never which; a URL in an error line loses `?token=`, `key=`
  and the key in `/peerjs/<key>/`; the headsets' logs never hold it (the app strips it).
- **In the app** (docs/agents/shared-rooms.md, "Shared rooms"): each device enters it once, on a page in the Shared dialog (*This relay
  needs its password*, a password field and **Use**; *That is not this relay's password* after a wrong one; **Forget the
  password** in its relay part), in a headset under the menu's **Circles** tab, **Relay password** (a keypad page of the
  26 lower-case letters and the ten digits). On a Quest the 2D page in Quest Browser before VR or AR is the easiest
  place; the headset then needs nothing more. The device keeps it per relay origin in its browser (`localStorage`
  `relayTokens`), never in a room's keys, a link, the address or a log. While a relay waits for its password, a room
  meant for it waits too: nothing goes peer to peer or onto the device instead, nothing is joined by itself, and the
  relay is asked at most once a minute.
- **Choose** lower-case letters and digits (the password is case-sensitive, and the headset's keypad has only those),
  long enough not to be guessed: `networksofthefuture2037` is the owner's kind of word. **Changing it** means every
  device enters it again (the old one is refused, dropped and asked for: *The password this device kept is no longer
  this relay's*).


## Rooms on this network

Browsers cannot search the local network, so devices meet through the address they share on the internet (the app's
*Rooms on this network*, in docs/agents/shared-rooms.md "Shared rooms"). The relay hashes the address it sees for each request and socket
into a **network id**: the first 6 hex digits (24 bits) of SHA-256 of `networks-near-1|<name>`, where the name is the
address itself (a public IPv4 address), its /24 for a private one (`192.168.1.0/24`: a relay on the LAN sees each
headset's own address, and one Wi-Fi is one network), its /64 for IPv6, `loopback` for this machine. The page makes the
same hash of the public address Cloudflare's STUN server reports when there is no relay, so a room used on a network
through a relay on the internet is on that network peer to peer too. One id stands for about 256 public addresses.

- `GET /api/ping` and `GET /api/near` say the asker's id (`net`); `/api/near` lists the rooms shown on it: those with a
  member on that network (each member's id is taken from its socket), an empty room on the networks of the members it
  had (the last 8), unless the room's key `near` is `{ on: false }` (*Show on this network: off*).
- Privacy: no address is kept or logged, only these ids, in memory, with the rooms (gone when the room expires or the
  relay restarts), and the log names neither. No answer contains an address. (`GET /api/rooms` lists every room
  whatever its network, as before, except with `--unlisted` (`--public`), which also leaves the first member's name
  out of `/api/near`: the network list is a convenience, not a lock; a room's code is all it takes to join.)
- Behind a reverse proxy the relay sees only the proxy's address: start it with `--proxy`, and it takes the last
  address in `X-Forwarded-For` (the one the proxy added; anything before it came from the client). Behind two (a CDN
  such as Cloudflare in front of Coolify's proxy) start it with `--proxy 2`: it takes the second from the right, the
  one the CDN added (the first when the header has only one). Without `--proxy` the header is ignored. The Dockerfile
  does not turn it on: Coolify's `RELAY_ARGS` does (step 6 of [public hosting](docs/operations.md#public-hosting-on-coolify)).


## The headset bench (`--bench`)

`--bench` (v232) turns on the headset bench's job queue at `/api/bench` (design and endpoints: `tools/bench/SPEC.md`): the
cloud posts jobs (`tools/bench/bench.mjs`), a headset in bench mode (developer mode, `#dev=on&bench=on`) asks for them
by long poll and posts results and pictures, the adb helper (`tools/bench/adb/`) attaches the headset's frame statistics.
Off unless given; only on the **test place's** relay, never the main site's (the app refuses bench mode on
`stories.lbi-netmed.com` anyway). On the test place on Coolify add `--bench` to `RELAY_ARGS` (it already has its password,
`COLLAB_TOKEN`). The relay refuses to start with `--bench` and no password unless it listens on a loopback address only (a
test's) and is not behind `--proxy`, and with `--no-notes`; with no password a page of another origin is refused (403). Jobs are kept beside the notes (`.notes/.bench/<id>/`: `job.json`, `pic-<n>.jpg`,
`devshot-<n>.png|jpg`; under `.notes/.bench/` in R2), in memory when the relay keeps no notes; a restart keeps them. Every
endpoint wants the password. Limits: a job 64 KB and 200 steps, 50 queued, 1000 kept, 1 GB of results and pictures
(ended jobs are deleted 14 days after they end, and the oldest ended first when either limit is reached; by hand:
`node tools/bench/bench.mjs delete`), a result 1 MB, a picture 1 MB (20 a job), the helper's lines 512 KB, a device
screenshot 4 MB (5 a job); in memory at most 32 headsets and 32 helpers (ten minutes each) and 16 long polls at once. A queued job expires after its `ttl` (900 s), a running one after its `limit` and a minute without word.
The log says only `bench job <id> queued <n> steps`, `taken by <hs>`, `<state> <ms>`, `deleted (old)` and `bench <hs> listening`: never a
step, a result, a report or the password. Its tests: `node relay/test.mjs --bench`, `node tools/bench/test.mjs`.

**`--bench-scripts`** (v232, `tools/bench/SPEC.md` 14) also lets a job carry its own code (a `script` step: a probe not
yet committed, sent by `node tools/bench/bench.mjs script <file.js>`), run on a page in bench mode. The trade-off in plain
words: with this flag, anyone holding the relay's password can run anything on a page in bench mode, on a headset in
someone's home, with what that page can reach (the relay's password kept in it among them). So it needs `--bench` and
always the password, on a loopback address too (the relay refuses to start otherwise); never put it on the main site's
relay, and on the test place add it to `RELAY_ARGS` only while trying probes. Without it a job with a script step is
refused 403. `/api/ping` says `benchScripts: true|false`, `GET /api/bench` says `scripts`. The listing gives a script's
length and a short hash, never its text (`GET /api/bench/jobs/<id>` gives the text); no log line holds the code, and the
code counts in the 64 KB job limit.

## Where the rest is

This file is for running a relay. The rest of what used to be here, word for word, is in `relay/docs/`:

- [relay/docs/operations.md](docs/operations.md) - a session on one Wi-Fi step by step, public hosting on Coolify and
  the test place, the studio's scenes (uploading, converting a video, Cloudflare R2), the PC's Vive trackers, OSC and
  the output page, live sound, Talk, the developer notebook, shared networks, hot reload (`--watch`).
- [relay/docs/protocol.md](docs/protocol.md) - the HTTP API, the WebSocket protocol, rooms across updates (`--keep`),
  the introduction server for peer to peer (`/peerjs`), and how it compares with asdf10k-collab-backend.
- [relay/docs/testing.md](docs/testing.md) - `node relay/test.mjs`: its flags and every group of checks it makes.

Other files and code comments say `relay/README.md, "<section>"`: this is where each section is now.

| Section | File |
| --- | --- |
| Running it; The shared password (`COLLAB_TOKEN`); Rooms on this network; The headset bench (`--bench`) | this file |
| A session on one Wi-Fi, step by step | `relay/docs/operations.md` |
| Public hosting on Coolify; The test place on Coolify | `relay/docs/operations.md` |
| Your own scenes (the studio); Uploading (the upload page); Converting a video | `relay/docs/operations.md` |
| Scenes in Cloudflare R2; The owner's steps | `relay/docs/operations.md` |
| The PC's Vive trackers; OSC and the output page; Live sound; Talk | `relay/docs/operations.md` |
| The developer notebook; Shared networks; Hot reload (`--watch`) | `relay/docs/operations.md` |
| HTTP API; WebSocket protocol; Rooms across updates; Introduction server for peer to peer; Compared with asdf10k-collab-backend | `relay/docs/protocol.md` |
| Testing | `relay/docs/testing.md` |

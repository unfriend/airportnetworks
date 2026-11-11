# The relay (shared rooms)

A small server that lets several headsets and desktop browsers share a room: each sees the same stations
playing the same stories in step (the plan is [docs/shared-space-plan.md](../docs/shared-space-plan.md)). It keeps,
per room, the latest value of every shared state key and passes ephemeral messages (pointer rays, effects) on
without storing them. One file, `server.mjs` (and `scenes.mjs`, the studio's listing and upload path rules, which
`tools/studio/scan.mjs` shares): Node 18 or newer, no packages (its own minimal WebSocket code). It
can serve the app as well (`--static .`), so the page and the relay share one address. It is also an introduction
server for devices that link to each other directly (peer to peer, PeerJS's protocol at `/peerjs`; see
[Introduction server for peer to peer](#introduction-server-for-peer-to-peer-peerjs)).

**Where it runs.** On a machine (a laptop will do) on the **same Wi-Fi as the headsets**, or on a public server
(the owner's Coolify) with `--public`. It serves the app too, so every headset and desktop opens one address on that
machine. GitHub Pages serves static files only, so it cannot run the relay; the app keeps working there for everyone
else, and only shared rooms need the relay. Public hosting: [Public hosting on Coolify](#public-hosting-on-coolify).

**No accounts; one shared password if you want it.** Rooms live in memory: a restart empties them, unless `--keep <file>`
(v136) keeps them in a file across restarts ([Rooms across updates](#rooms-across-updates-v136)). On a laptop at an
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
| `--static <dir>` | off | also serve the app's files from `<dir>` (the repository root); nothing else (see HTTP API) |
| `--cert <file> --key <file>` | off | speak HTTPS and WSS with this certificate (PEM) |
| `--timeout <s>` | 40 | a member silent this long is dropped |
| `--expire <s>` | 21600 (6 h) | a room without members is deleted after this |
| `--ping <s>` | 20 | how often the relay pings every member (keeps proxies from closing idle sockets) |
| `--quiet` | off | no log lines |
| `--no-peer` | off | no introduction server for peer to peer (`/peerjs`, on by default; it costs nothing while unused) |
| `--proxy [<n>]` | off | behind `n` reverse proxies (1 when no number is given: Coolify's or nginx alone; 2 with a CDN such as Cloudflare in front of it): a client's address is the `n`-th from the right in `X-Forwarded-For`, for [rooms on this network](#rooms-on-this-network). Without it the header is ignored (a client could write anything there); never turn it on for a relay that clients reach directly |
| `--lan` | off | for headsets on the same Wi-Fi: HTTPS with a certificate of its own (made with `openssl` in `relay/.lan/`) and the app's files served from the repository; prints the address to open on the headsets |
| `--watch [<dir>]` | off | while developing (hot reload): watch the app's files, the `--static` folder (or `<dir>`, then also served when `--static` is not given). The pages it serves swap a changed story in place, keeping their place, and reload (place kept) when a shell file changes; see [Hot reload](#hot-reload---watch) |
| `--build` | off | with `--watch`: run a built story's `tools/<key>/build.mjs` when its sources change, so editing a set shows by itself |
| `--token <word>` | off | a shared password every client must bring ([The shared password](#the-shared-password-collab_token)); better set as `COLLAB_TOKEN` in the environment |
| `--scenes <dir>` | off | the studio's scenes: each subfolder of `<dir>` is one scene (models, textures, sounds, its `layout.json`), served and its layout saved there ([Your own scenes](#your-own-scenes-the-studio)) |
| `--scenes r2` | off | the same, the scenes kept in a Cloudflare R2 bucket, its settings from the environment only (`R2_*`): [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2). A folder named `r2` is `./r2` |
| `--r2-check` | off | with `--scenes r2`: check the settings, the keys, the bucket's CORS rule and its upload links, say what is wrong, and stop |
| `--scenes-readonly` | off | with `--scenes`: never write a layout (the studio offers *Download layout.json* instead) and take no uploads |
| `--max-upload <MB>` | 512 | with `--scenes`: one uploaded file at most this big ([Uploading](#uploading-the-upload-page)) |
| `--ffmpeg <path>` | the PATH's | with `--scenes`: the `ffmpeg` that makes long sounds mono MP3 (looked for once at the start; a named one that does not run stops the start) |
| `--no-ffmpeg` | off | never use `ffmpeg` (the studio then keeps long sounds as they are) |
| `--ffmpeg-limit <s>` | 180 | one conversion may take this long, then it is stopped |
| `--app <url>` | the `--origin`, else `https://stories.lbi-netmed.com/` | where `/upload` sends people when the relay does not serve the app itself |
| `--keep <file>` | off | keep the rooms in `<file>` (JSON, written atomically every 5 s when they changed and as the relay stops, read back as it starts; its folder made): a restart, such as a deploy, no longer empties them ([Rooms across updates](#rooms-across-updates-v136)). Not `--store`, which is only a cap on their size |
| `--trackers [<port>]` | off (47800 when given without a port) | the PC's Vive trackers: take the bridge's readings (`tools/trackers/bridge.py`) on UDP `127.0.0.1:<port>` (`0` picks a free one, which the start line says), list them at `/api/trackers` and send them, lined up, to the rooms that turn them on ([The PC's Vive trackers](#the-pcs-vive-trackers---trackers)). A port another program holds stops the start with a sentence |

The environment (asdf10k-collab-backend's `COLLAB_*` names, since shells and conda set `PORT` and `HOST` for other
things; a flag given as well wins):

| variable | default | meaning |
| --- | --- | --- |
| `COLLAB_TOKEN` | (none) | the shared password (`--token`); empty or unset: none, everything open as before |
| `COLLAB_PORT` | 8787 | `--port` |
| `COLLAB_HOST` | 0.0.0.0 | `--host` |
| `COLLAB_SCENES` | (none) | `--scenes` (`r2` for a bucket) |
| `R2_*` | (none) | the bucket for `--scenes r2`: [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2) (only from the environment) |
| `RELAY_ARGS` | (none) | more options, added after the command's own (Coolify: `--proxy 1 --public`) |
| `RELAY_LOG_TOKEN` | (none) | the log token (`--log-token`) |

For a public server ([Public hosting on Coolify](#public-hosting-on-coolify)). Each is off unless given; `--public`
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
| `--log-token <t>` | (needed with `--logs`) | `POST /api/log` keeps a log only with the header `X-Log-Token: <t>` (none: 404, as when logs are off, so a page stops sending; a wrong one: 403). At least 16 characters. Better than on the command line: the environment variable `RELAY_LOG_TOKEN` (Coolify's environment; never in the repository) |

"Per address" is the device's address as rooms on this network take it: with `--proxy`, the one the outermost proxy
saw; IPv6 by its /64; kept only in memory as a keyed hash (a new key at every start), never logged. Every device
behind one router shares it (ten headsets and the laptops at an event): the defaults leave them room, a relay restart
included (each page looks its room up, finds it gone and brings it back: about three lookups of an unknown code a
device).

It prints `relay listening on http://<host>:<port>` when it starts and, when it serves the app on every address
(`--host 0.0.0.0`), what to open: over HTTPS the `https://<address>:<port>/` for the headsets; over plain HTTP
the address for desktops only and how to reach it from a headset (`--lan`, or `adb reverse` and
`http://localhost:<port>/`), since a headset gets no VR or AR at an `http://` address. Then one line per event: a room created, a
join, a hello, every stored write (`XYZ set #12 by k7f2: st.a1.play`, deletions as `key=null`), every refusal
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
asdf10k-collab-backend](#compared-with-asdf10k-collab-backend) lists what matches and what does not):

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
- **In the app** (AGENTS.md, "Shared rooms"): each device enters it once, on a page in the Shared dialog (*This relay
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
3. For Quest Browser's experimental shared space (used for alignment unless you switch it off in the headset's menu,
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
5. Floor space: Arrange all needs about 17 m wide and 4 m deep for all sixteen (two rows of eight, the second right behind the first,
   starting 1.2 m in front of where you stand); in a smaller room add 2-4 stations with **Add here** (headset) or **Add a station**
   (page).

**Each session**

1. On the machine, in the repository: `node relay/server.mjs --lan`. It prints the address to open, for example
   `https://192.168.1.20:8787/`. If it prints several (a machine with a cable and Wi-Fi, or a VPN), pick the
   one on the Wi-Fi the headsets use.
2. On every headset, open **exactly that address** in Quest Browser (a bookmark helps: shared spaces need the
   same page address on every headset). The first time, the browser warns that the certificate is not trusted:
   choose to continue (it is this machine's own certificate).
3. Open **Shared**: on the page, the **Shared** button in the top bar or on the Stories screen; in the headset,
   the menu: click either stick (with hand tracking, two quick pinches of the left hand pointing at nothing); it floats in front of you, and the shared room is under **Circles**. The first person: **Start a room**,
   then **Arrange all** puts the sixteen stories as stations in two rows (eight, and eight behind them) in front of you (or one story where you
   stand: **Add here** in the headset, **Add a station** on the page). Arrange all from a page, without a
   headset, puts the rows round the room's origin (mark A). Everyone else: **Shared**, then pick the room under
   **Open rooms**. To move a station, point at its ring or card in the headset and hold the grip: point to swing
   it round, raise or lower the controller to push it away or bring it nearer, twist your wrist to turn it, and let
   go to put it down (everyone sees it move). On the page, drag its dot on the room map to move it, or its small
   square to turn it. At your own station the grip moves its scene and story panel (both grips resize the scene) for everyone there, and nobody can move them anywhere else, so everyone sees them alike. Once
   the stations are where you want them, **Lock circles** (in the headset's menu or the Shared dialog) so nobody moves
   one by accident; anyone can unlock it. A story's scene and panel have a lock of their own (**Lock this story** in the
   menu at its circle, **Lock story** on its row in the Shared dialog). In the headset a click of either stick (or two
   quick pinches of the left hand) opens the menu in front of you, so it is always at hand; its Story tab holds the
   story's own panel.
4. In the room, use **Enter AR**: you see the room and each other, and the stations stand in it. In VR the menu
   asks once whether you are in the same room as the others (then the room is aligned as in AR) or elsewhere
   (then you get your own floor and the others see you as an avatar).
5. **Calibrate every headset on the same two marks** (headset's menu, **Calibrate**): a bright ring shows the point
   that counts, at the front of the controller. Put it on mark A, hold still, pull the trigger once; then the
   same on mark B (while calibrating, any trigger pull away from the menu takes a mark). Orange crosses then show where this headset puts the
   marks: they must sit on the tape (they show for 30 s, and whenever the menu is open). A headset's own
   calibration is never overridden. It is kept for next time by two anchors at the marks ("Room calibration from
   last time", when the headset can save anchors); a headset without anchors, or after a recentre (a
   long press on the Meta button), may ask to calibrate again. The room's floor is set by the first headset
   that calibrates: if another headset's floor is lower or higher (a Guardian floor set wrong), it says so on the
   panel ("Your floor is 28 cm lower than the room's") and allows for it, so things stand at the same height
   for everyone; fix that headset's floor in its boundary settings when you can.
6. Walk into a station's circle: its story runs there, as for everyone there, its narration plays where it
   stands, and everyone sees everyone's pointer. Stations are walk-in only (the trigger on a card runs nothing),
   and away from every station a headset shows no story, only the room's rings, cards, people and the menu.
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
- **The headsets do not line up through the shared space**: the headset's menu shows each headset's Quest Browser
  version (people list) and warns when they differ: update both, one shared space needs one version. Then check on
  every headset: the WebXR experiments flag (`chrome://flags`, then restart the browser; an update can reset it),
  Enhanced spatial services on (Quest settings, privacy), the same address in the browser, and Space Setup done in
  this room, and *Shared space: on* in the menu (it no longer stays off after a reload). Start one headset
  in AR first, wait until it says it found the shared space, then the other. If the panel says *Not in the others'
  shared space*, press Re-align; if that does not help, leave AR on both headsets, close Quest Browser on both, and
  start them again one after the other (a headset that left AR and came back on its own got a new space under the
  same id in our logs). Tape calibration (Calibrate, on the same two marks on every headset) does not need the
  shared space at all, and once two headsets are calibrated the panel says how far apart the shared space puts
  them; more than 10 cm, and the room stops using that space (*Shared space not usable*) until they agree again
  or reload.
- **A fresh shared space**: when the panel says the shared space is split (two calibrated headsets far apart
  through it), press *Fresh shared space* twice in the headset's menu (or in the page's Shared dialog). Every page in
  the room moves to the app under a new address (`/s/1/`, `/s/2/`, ...: the relay serves the app there too), where
  the headsets make a new shared space: they leave AR, then start AR on one headset first and wait for *Shared
  space found* before the others. The rooms, calibrations and anchors stay (they belong to the relay's address).
- **Starting the shared space afresh**: on every headset, Settings > Privacy and safety > Device permissions:
  *Clear* the physical space history (boundaries, Space Setup, stored anchors) and *Delete* the spatial data on
  Meta's servers; in Quest Browser clear the site data of the relay's address (this also forgets the app's
  calibration). Then restart the headsets, run Space Setup on each, check *Enhanced spatial services* and the
  WebXR experiments flag, and start AR on one headset before the others.
- **The headsets do not line up**: check the orange crosses on each headset (open the menu). Crosses
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
  crosses for 30 s ("Check the marks"; in AR in a room with spots, the check by eye asks instead). If it does not find
  its anchors in the same session after standby (`marks lost` in the log), it keeps the room where it was and keeps
  looking (since v124 without a message); leaving AR and entering it again finds them at once if the crosses are off.
  If the crosses are still not on the tape, press **Calibrate** and please send the logs. Lined up through the shared space (no tape), it holds the room where the headset says it moved until the
  shared space agrees again (a few seconds; one that disagrees is judged after 20 s: right after waking the space is
  wrong for up to 15 s, and after a night it may come back made again). If it stays off, press **Re-align** in that headset's menu (it
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

## Public hosting on Coolify

The relay can run on the owner's Coolify server as well as on a laptop at an event: then shared rooms work wherever
web pages do (eduroam, a hotspot, at home), and the copies of the app elsewhere can use it. Since v116 the owner's
Coolify runs the test place this way, branch `dev` at `https://stories.lab.lbi-netmed.com/` with the studio's scenes in
R2, and since v120 branch `main` as well, at `https://main.lab.lbi-netmed.com/`, the relay the main site on GitHub Pages
offers: [The test place on Coolify](#the-test-place-on-coolify) after these steps.
Peer to peer stays the fallback when it is down. On the internet anyone can reach it, so it runs with `--public` (below: what that changes
and why). Nothing here changes how it runs on a laptop.

**Before you start:** a DNS name for it (here `rooms.lbi-netmed.com`; any subdomain will do), Coolify on a server
with a public address and its proxy (Traefik or Caddy) running, and access to this repository from Coolify. At the
institute every name under `lab.lbi-netmed.com` (such as `stories.lab.lbi-netmed.com`)
already points at the Coolify server and has a certificate (a wildcard record and a wildcard certificate, checked 5
November 2026): there, skip step 1, and the domain in step 5 works at once. A name outside it (such as
`rooms.lbi-netmed.com`) gets no certificate on that server without more: see *Certificates and names on Coolify* under
[The test place on Coolify](#the-test-place-on-coolify).

1. **DNS.** With the domain's DNS provider, add an `A` record `rooms` (`rooms.lbi-netmed.com`) pointing at the Coolify
   server's public IPv4 address (and an `AAAA` record for its IPv6 address, if it has one). Wait until it resolves
   (`dig +short rooms.lbi-netmed.com` shows the address): the certificate in step 5 needs it. A CDN or proxy in front
   (Cloudflare's orange cloud) is not needed; if you use one, read step 6's note.
2. **New resource.** In Coolify: your project > **+ New** > **Public Repository** (the repository is public: paste
   `https://github.com/unfriend/airportnetworks`), or **Private Repository (with GitHub App)** if it has moved or
   become private. Branch **`main`** (the branch GitHub Pages publishes, so the relay serves the same app and speaks the
   same room format).
3. **Build.** Build pack **Dockerfile**. Base directory `/`, Dockerfile location **`/relay/Dockerfile`**. (The image
   holds the app's files and the relay only; `.dockerignore` leaves out the tools, the authors' data, the docs and the
   git history.)
4. **Port.** *Ports Exposes*: **`8787`**. No port mapping: Coolify's proxy reaches the container itself.
5. **Domain.** *Domains*: **`https://rooms.lbi-netmed.com`** (with `https://`: Coolify's proxy then gets a Let's
   Encrypt certificate for it and sends `http://` there). WebSocket upgrades pass through without further settings;
   the relay pings every socket every 20 s, which keeps an idle one open through any proxy timeout above that.
6. **Options.** Under *Environment Variables* add **`RELAY_ARGS`** = **`--proxy 1 --public`** (a runtime variable;
   it need not be available at build time). The relay adds these to the image's command, so the start command stays
   as the Dockerfile has it. If your Coolify offers a *Start Command* for this resource, the same thing written out is
   `node relay/server.mjs --port 8787 --static . --proxy 1 --public`; use one or the other, not both.
   - `--proxy 1`: Coolify's proxy stands in front, so the relay takes each device's address from the last entry of
     `X-Forwarded-For` (rooms on this network, and the limits per address). With a CDN such as Cloudflare in front of
     Coolify's proxy, `--proxy 2`, and let only the CDN reach the server (a device that reached Coolify's proxy
     directly could name its own network). Without `--proxy` every device looks like the proxy: one network, and one
     budget of lookups and sockets for everyone (the start lines warn).
   - `--public`: see below. If the app is also served from another address that should use this relay, add it:
     `--proxy 1 --public --origin https://stories.lbi-netmed.com,https://other.example` (the list replaces the
     default, so name the app's own address too). The relay's own pages (`https://rooms.lbi-netmed.com/`) are always
     allowed.
   - **`COLLAB_TOKEN`** = the shared password ([The shared password](#the-shared-password-collab_token)), a second
     variable, marked as a secret in Coolify (its lock: *Is Secret*, so the value is not shown in the UI or the build
     logs). Lower-case letters and digits, such as `networksofthefuture2037`; never in the repository, a link or a
     chat. Empty or absent: no password (anyone the other rules let through may use the relay). Then each device
     enters it once: the Shared dialog on a page (also the Quest's 2D page before VR or AR), or the headset menu's
     **Circles** > **Relay password** keypad. Changing it later (edit the variable, redeploy) means every device enters
     the new one.
   - **`--keep /data/rooms.json`** (v136), added to `RELAY_ARGS` (`--proxy 1 --public --keep /data/rooms.json`), with a
     *Persistent Storage* volume mounted at `/data` (the resource's *Storages* tab: **+ Add**, *Volume Mount*, a name
     such as `relay-rooms`, *Destination Path* **`/data`**; the user `node` the image runs as must be able to write
     there: Coolify's named volumes are, a bind mount of a host folder needs `chown 1000` on the host). Then a deploy no
     longer empties the rooms: the relay writes them there every 5 s when they change and as it stops, and the new one
     reads them back, so the pages still open simply reconnect to their room ([Rooms across updates](#rooms-across-updates-v136)).
     Without the volume the file is the container's own and goes with each deploy (nothing worse than before).
   - Logs stay off (they are off unless asked for), and that is right for now: the app sends no log token, so a
     public relay could not take a headset's alignment log anyway. To turn them on later (for a test that needs two
     headsets' numbers): a second variable **`RELAY_LOG_TOKEN`** = a long random string (`openssl rand -hex 24`; at least
     16 characters; only in Coolify, never in the repository), `--logs <dir>` added to `RELAY_ARGS` with `<dir>` on a
     *Persistent Storage* volume the user `node` may write to (a redeploy deletes the container's own files), and
     `shared.js` sending the token as `X-Log-Token`. The relay refuses to start with `--public --logs` and no token.
7. **Limits.** Under *Resource Limits*: memory **512 MB** (`512m`; swap the same), CPUs 1 is plenty. Node sizes its
   heap to the container's limit; the rooms hold at most 64 MB of data together (`--store`), so a limit stops a flood
   of large rooms from taking the server down with it. **Restart policy**: Coolify's containers restart unless stopped (its
   default); keep it, so a relay that ran out of memory comes back by itself (a restart empties the rooms unless
   `--keep`; the pages in them bring them back within seconds).
8. **Health check.** The image has its own (`GET http://127.0.0.1:8787/api/health` every 30 s: open with a password
   and with `--public`, as it sends no `Origin`). Leave Coolify's *Healthcheck* tab off, or point it at path
   `/api/health`, port `8787`.
9. **Deploy, and keep it in step.** Press **Deploy** and watch the logs. The start lines should read
   ```
   relay listening on http://0.0.0.0:8787, serving /app (protocol 1)
   Introduction server for peer to peer (PeerJS) at /peerjs, key the password (--no-peer turns it off)
   Behind a reverse proxy: a client's address is the last one in X-Forwarded-For (rooms on this network)
   Only pages from https://stories.lbi-netmed.com and the relay's own may open a socket or read the API (...)
   No list of open rooms and no names in any answer: a room is joined by its code, a link or on its network
   Per address at most 30 lookups of unknown room codes a minute (a burst of 60), 10 new rooms a minute (...), 64 open sockets
   All rooms together hold at most 64 MB
   A password is needed (COLLAB_TOKEN or --token): everything but GET /api/health and the app's files; 20 failed attempts a minute from one address, then 429
   ```
   (without `COLLAB_TOKEN` the last line reads `No password (COLLAB_TOKEN): anyone who can reach the relay may use it`).
   Then turn on **Auto Deploy** in the resource's settings (with a public repository Coolify needs a webhook: copy
   the GitHub webhook address and secret from the resource's *Webhooks* page into the repository's *Settings* >
   *Webhooks*, content type `application/json`, push events; with the GitHub App it needs nothing more). Every push to `main` then rebuilds the relay, so it
   serves the same app as GitHub Pages and accepts its rooms (a room moves on to a newer `FORMAT` by itself once nobody
   of the old one is in it, and refuses an older one). Each deploy restarts the relay: with `--keep` and its volume the
   rooms stay; without, open rooms empty and come back from the pages within seconds. After a deploy that changed the
   app, press **Update the room** in a room (the Shared dialog, or the headset menu's *Circles* tab) so every device in
   it reloads into the new version at once ([Rooms across updates](#rooms-across-updates-v136)); avoid pushing during an
   event.
10. **Test it.**
    - `curl -s https://rooms.lbi-netmed.com/api/health` answers `{"ok":true,"protocol":1,"rooms":0}`, and
      `curl -s https://rooms.lbi-netmed.com/api/ping` (no password) `{"error":"missing or wrong token"}`.
    - `curl -s -H "Authorization: Bearer $COLLAB_TOKEN" https://rooms.lbi-netmed.com/api/ping` answers
      `{"now":...,"proto":1,"net":"...","unlisted":true}`; run it from two different networks (a phone on mobile data):
      `net` differs, so `--proxy` is right. (Type the password into the shell's variable rather than the command, and
      only on a machine of your own.)
    - `curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://evil.example' https://rooms.lbi-netmed.com/api/ping`
      prints `403`; with `-H 'Origin: https://stories.lbi-netmed.com'` (and the password) it prints `200` and the answer carries
      `Access-Control-Allow-Origin: https://stories.lbi-netmed.com` (`curl -si ...`).
    - `curl -s -H "Authorization: Bearer $COLLAB_TOKEN" https://rooms.lbi-netmed.com/api/rooms` prints `[]`, even while a room is open.
    - The app on GitHub Pages with the relay: open `https://stories.lbi-netmed.com/#stories&relay=wss://rooms.lbi-netmed.com`
      on a laptop (the page remembers the relay; the Shared dialog's relay field takes the same address). **Shared**:
      it asks for the relay's password; type it, **Use**. **Start a room**: its status says it is on the relay. On a second device on the same Wi-Fi the room shows under
      *Rooms on this network* (with its people as a count, no name); on a device elsewhere join it by its code or by
      the room's link (`https://stories.lbi-netmed.com/#s=XYZ&relay=wss://rooms.lbi-netmed.com`).
    - The relay's own copy of the app: `https://rooms.lbi-netmed.com/` (the same app, from the relay; a headset can use
      it as at an event, with a real certificate this time).
    - In a headset: the same link in Quest Browser, then Enter VR or AR, and two headsets in one room.

### The test place on Coolify

The owner, 5 November 2026, after weighing the main site on Coolify: "i decided that the main page will stay on github
pages, deployed from main and works as it always worked and i will add the dev branch with a hook to the app1 on coolify
that is at stories.lab.lbi-netmed.com and saves models to cloudflare r2", and "the github page then also does not need a
hosted relay for now, if it needs one i will add that later on, for now its a good place to test the peer to peer
functionality".

The owner, 6 November 2026, after setting up a relay for the main site the same day: Coolify runs branch `main` too, as
the main site's relay, and the main site on GitHub Pages offers it (v120).

| address | serves | branch | rooms |
| --- | --- | --- | --- |
| `https://stories.lbi-netmed.com/` | GitHub Pages, the main site, as ever | `main` | on the main relay once a device has its password (offered in the Shared dialog and the headset menu, below); peer to peer without it |
| `https://main.lab.lbi-netmed.com/` | Coolify, the main site's relay (it serves `main`'s app too) | `main` | on its relay (its password once per device); the studio's scenes in R2 under the main relay's own `R2_PREFIX` |
| `https://stories.lab.lbi-netmed.com/` | Coolify, the test place: the relay serving the app | `dev` | on its relay (its password once per device); the studio's scenes in R2 |

Every name under `lab.lbi-netmed.com` points at the Coolify server (`178.104.76.48`) with a wildcard certificate, so the
lab name needs no DNS. The app on Coolify is set up as in the guide above (steps 2 to 10) with branch **`dev`**,
*Domains* **`https://stories.lab.lbi-netmed.com`**, *Ports Exposes* **`8787`** (Coolify fills in `3000`: with it the
proxy answers 502 Bad Gateway though the relay runs, as it did at first), `RELAY_ARGS` = `--proxy 1 --public --scenes r2`
(no quote marks; since v116 the relay drops them anyway), `COLLAB_TOKEN` (locked) and the R2 variables
([Scenes in Cloudflare R2](#scenes-in-cloudflare-r2), with `R2_PREFIX` as chosen, such as `main`). A GitHub webhook
with *Auto Deploy* (step 9) makes it follow every push to `dev` within a minute or two (the image's layers with Node and
ffmpeg stay cached; each deploy restarts the relay, and open rooms come back from the pages within seconds, or stay with
`--keep /data/rooms.json` and a volume at `/data`, step 6, which both Coolify resources should have since v136).

**Releases.** Work goes to `dev` first: the test place takes it by itself. Once the owner has tried it there, `main` moves
forward to it: GitHub Pages publishes it, and the main relay rebuilds from it (by itself with *Auto Deploy* and a webhook
for `main`, as the test place has for `dev`; else press **Deploy**), so the two serve the same release and room format (a
room refuses another `FORMAT`: a main relay left behind refuses the main site's rooms until it is deployed). The main site keeps its `CNAME` file and
custom domain. A device without the main relay's password runs its rooms peer to peer, so peer to peer is still tried
there.

**The main site's relay** (v120, set up by the owner on 6 November 2026): a clone of the test place's resource in Coolify,
with three things changed and then redeployed: *Domains* **`https://main.lab.lbi-netmed.com`**,
the branch **`main`**, and its own **`R2_PREFIX`** (so its scenes stay apart from `dev`'s in the same bucket; the other R2
variables as for the test place). Everything else as above: *Ports Exposes* `8787`, `RELAY_ARGS` = `--proxy 1 --public
--scenes r2`, `COLLAB_TOKEN` locked (the main relay's own password; never in the repository), a GitHub webhook for `main`
with *Auto Deploy* (above). `--public` allows `https://stories.lbi-netmed.com` by default (`APP_ORIGIN` in `server.mjs`), so the
main site's pages may use it with no `--origin`, and the relay's own pages at `main.lab.lbi-netmed.com` always may.

**How the main site offers it** (`HOME_RELAY` in `shared.js`, keyed by the page's host:
`'stories.lbi-netmed.com': 'https://main.lab.lbi-netmed.com'`; on any other host, this machine, a LAN and the tests no
relay is offered). While no relay is in use there, the Shared dialog shows *Have the password for
main.lab.lbi-netmed.com?* with a password field, and the headset menu's **Circles** tab a **Relay password** row (a
keypad of lower-case letters and digits). The password accepted (once per device), that device's rooms run on the main
relay and the studio's scenes come from it (`relayFind`); without it rooms run peer to peer, as before v120, and nothing
is sent to the relay until a password is typed. **Forget the password** (out of a room) goes back to peer to peer and
offers it again. The test: `node tools/collab.mjs --home` (a browser that takes the two site names for this machine).

**Certificates and names on Coolify** (learnt on 6 November 2026, setting up the main relay): Coolify's proxy gets its
certificates with a DNS challenge through Hetzner DNS, which answers the `lab.lbi-netmed.com` names. A name under
`lab.lbi-netmed.com` (such as `main.lab.lbi-netmed.com`) therefore gets its certificate at once. A name served elsewhere
(`lbi-netmed.com` itself is at Namecheap, so `rooms.lbi-netmed.com` in the steps above) gets none on Coolify unless its `_acme-challenge` name is a `CNAME` into the lab zone (for example `_acme-challenge.rooms.lbi-netmed.com`
pointing at a name under `lab.lbi-netmed.com` that Hetzner answers). After changing a resource's domain in Coolify,
redeploy it: the new domain is only served (and its certificate asked for) from the next deploy.

**What `--public` changes, and why** (each flag on its own in [Running it](#running-it)):

- **Only the app's pages may connect** (`--origin`, by default `https://stories.lbi-netmed.com`, plus the relay's own
  pages). Without it any web page anywhere could use the relay from its visitors' browsers: open rooms, fill them,
  use the introduction server. A browser always says which page a socket or a cross-origin request comes from, and a
  page cannot lie about it; a socket with no `Origin` (not a browser) is refused too, unless `--allow-no-origin`. This
  keeps other web pages off, not determined people: a script can send any header it likes, which is what the limits
  below are for. CORS answers name the allowed origin instead of `*`.
- **No list of rooms, no names** (`--unlisted`). On a laptop the Shared dialog lists every open room with its people's
  names, which is handy at an event and wrong on the internet. With `--public`, `GET /api/rooms` answers an empty list
  (the dialog then shows no open rooms, without an error), *Rooms on this network* still lists a room to the devices on
  its network (a code, how many people and stations, no name), and joining by code or by link works as before. No
  answer and no log line names a member (the log's hello lines give the member's random id); the people in a room
  still see each other's names, as the room's people list must.
- **Guessing codes is slow** (`--guesses 30`). A code has three letters, 17,576 in all. Each address may look up 30
  codes that do not exist a minute (a burst of 60); past that it gets no answer about any code for a while, so finding
  a room by trying codes takes hours from one address, not seconds. A relay restart at an event (every page looks its
  room up, finds it gone and brings it back: about three lookups a device) fits in the burst for some twenty devices
  behind one router. **The code is still all it takes to join**: anyone who has it (the link, a look at a screen) is
  in, and a determined person with many addresses is slowed down, not stopped. Hence the shared password
  (`COLLAB_TOKEN`, above): with it, only devices that entered it get that far.
- **Limits per address** (`--creates 10`, `--sockets 64`) and **for everything** (`--store 64`, besides the 2,000
  rooms, 4 MB a room and the message rates every relay has): so that one address cannot use up the relay for everyone.
- **Logs only with a token** (`--log-token`, `RELAY_LOG_TOKEN`): logs are files written on the server by anyone who
  can reach `/api/log`, and they carry names.

**Untested until it runs on Coolify** (everything above was tested on one machine: `node relay/test.mjs`, the image
built and run with `--proxy 1 --public`, the app in Chromium from the relay and from an allowed and a refused origin):
the certificate and `wss://` through Coolify's proxy, the proxy's `X-Forwarded-For` (that `net` differs between
networks and the limits fall per device's address, not the proxy's), whether the proxy passes `Host` or
`X-Forwarded-Host` so the relay's own pages are recognised (if not, they get 403: add `--origin
https://rooms.lbi-netmed.com`), auto deploy, the memory limit in practice, headsets in a room over the internet
(eduroam and hotspots may block or slow WebSockets), and the password typed on a real headset's keypad.

A redeploy restarts the relay and empties its rooms. The image (`node:22-alpine`, about 8 MB of app) runs as the
user `node`; `docker build -f relay/Dockerfile -t networks-relay .` and `docker run -p 8787:8787 networks-relay` run it
locally as on a laptop (no `--public`), and `docker run -p 8787:8787 -e RELAY_ARGS='--public' -e COLLAB_TOKEN=<word>
networks-relay` as on the server.

## Your own scenes (the studio)

The owner (3 November 2026): "i can run a relay and serve the fbx and glb files from that and also save the json files
directly". The studio (`#studio` in the app; its contract is `tools/studio/SPEC.md`) shows your own models, their
textures and sounds, lets you place them, add trigger cubes (that show and hide things as people walk in) and sound
emitters, and save where everything stands. The relay serves the files from a folder on your computer and writes the
layouts straight back into it.

**At an event** (headsets on the same Wi-Fi as the laptop):

```sh
node relay/server.mjs --lan --scenes ~/scenes
COLLAB_TOKEN=<word> node relay/server.mjs --lan --scenes ~/scenes   # with the shared password
```

It prints `Scenes for the studio (#studio) from <folder>: 2 (atelier, garden); the studio saves their layouts there`.
On every headset open the address it prints, as for any session, then the studio: `#studio` at the end of the address
(`https://192.168.1.20:8787/#studio`), or the headset menu's *Studio* row. A page on another origin (GitHub Pages with
`&relay=`) uses it too: the scenes' files carry CORS headers as the API does.

**The folder.** Each subfolder is one scene, named after it:

```
scenes/
  atelier/                  a scene: letters, digits, spaces, _ . - (up to 64, not starting with a space, . or -)
    annette.fbx             models: .glb .gltf .fbx
    eva_001.fbx
    eva_001.png             a texture a model names but does not hold: anywhere in the scene, by its file name
    sounds/birds.mp3        sounds: .mp3 .ogg .oga .wav .m4a .aac .flac .opus .webm
    models/eva_001.glb      what the studio's Upload pane (or Convert to GLB) makes goes into models/ and sounds/,
    originals/eva/...       and the files as they were given into originals/
    previews/models/eva_001.glb.jpg   the Add pane's picture of models/eva_001.glb (the studio makes it: below)
    layout.json             where everything stands (the studio's Save writes it)
    .history/               the layouts before the last 20 saves (the relay keeps them)
  garden/
```

Files may sit in subfolders up to 4 levels deep; at most 2,000 a scene are listed (by path). Left out: dot files and
folders (`.history/`, `.DS_Store`), temporary files (ending in `~`, `.tmp`, `.temp`, `.part`, `.partial`, `.crdownload`,
`.download`, `.swp`), the scene's own `layout.json` (it comes apart, as `layout`) and a `files.json` (from
`tools/studio/scan.mjs`). A link is followed only when it leads somewhere inside its scene's folder (a scene folder that
is itself a link is followed: your choice). A folder whose name cannot be a scene's (and one named `watch`, the change
stream's name) is left out and said once in the log. Big FBX files are slow to open on a headset (a 14 MB scan takes
seconds to parse); `node tools/studio/convert.mjs <file.fbx>` makes a GLB from one (textures drawn down to 4,096 px).

**Saving.** The studio's *Save* sends what is placed now; the relay writes `layout.json` whole (a temporary file renamed
over it, so it is never half written), after copying the old one into the scene's `.history/` as
`layout-<time>.json` (an ISO time with `-` in place of `:`, which Windows does not allow; the newest 20 are kept). To
go back, copy one of them over `layout.json`; the studio's *Load saved* then takes it. `layout.json` is laid out a field
a line and an item a line, so it reads (and compares in git) well. `--scenes-readonly` writes nothing: *Save* says why
and the page offers *Download layout.json*.

**Recordings kept as files** (v125). `recordings/<a name>.json` is a recorded path the studio keeps as a file of the
scene (one longer than 2 minutes, or of more than 600 keys: `tools/studio/SPEC.md`, "Ten minutes, as a file"), `{ studio: 1,
recording: 1, item, len, n, k }`. It is listed and told with a kind of its own, `recording`, served as `application/json`
(stored in R2 and signed as such), and takes uploads and copies of at most 4 MB (and `--max-upload`: 413 *a recording in
recordings/ is at most 4 MB*). A `.json` anywhere else outside `originals/` is refused (400); anything else in `recordings/`
goes by its own rules (a sound there is a sound). The studio never writes over one (a new recording is a new file), so
the voices recorded with movements (`sounds/<name>-voice-<n>.wav`, or `.mp3` made by `ffmpeg` from a longer one) are the
only files it replaces as it records.

**Pictures of the models** (v120). `previews/<a model's path>.jpg` is the studio's Add pane picture of that model (a
256 x 256 JPEG the studio makes with every GLB it writes, and on *Make pictures*: `tools/studio/SPEC.md`, "Pictures in
the Add pane"). The listing gives such a file the kind `preview` (never `image`: the studio never takes it for a
texture, nor for a model), and anything else under `previews/` the kind `other`; past 2,000 files `previews/` is left out
first. Uploads and copies there take only such a `.jpg`, at most 200 KB (or `--max-upload` when that is smaller; over it
413 *a picture in previews/ is at most 200 KB*), by the same endpoints as every file (through the relay, or with R2
straight into the bucket: `.../put` signs its size). `Previews/`, or `previews/` in any other case, at the top of a scene
is refused (400): on a file system that ignores case (Windows', macOS's) it is that same folder, and a file put there would
be past the rule. Deleting the folder is harmless: the studio makes them again.

**The password.** With `COLLAB_TOKEN` every scene request and file needs it, exactly as the API does
(`Authorization: Bearer <word>` or `?token=<word>`: the studio adds `?token=` to every file its loaders fetch, and
`Authorization` to sounds and JSON), and wrong ones count towards the 20 a minute from an address ([The shared
password](#the-shared-password-collab_token)). The files are your own work, not the app's, so `--public` with
`--scenes` refuses to start without a password. On Coolify: a *Persistent Storage* volume the user `node` may write to
(say at `/scenes`), and `--scenes /scenes` added to `RELAY_ARGS` (or `COLLAB_SCENES=/scenes`); or, with no volume, the
scenes in a Cloudflare R2 bucket (`--scenes r2`: [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2)).

| request | answer |
| --- | --- |
| `GET /api/scenes` | `{ scenes: [{ name, files, bytes, at, layout }], save, upload, ffmpeg, maxUpload }`: by name; `files` how many, `bytes` their size, `at` the newest file's time (ms), `layout` whether it has a `layout.json`; `save` and `upload` false with `--scenes-readonly`; `ffmpeg` whether long sounds are made MP3 here; `maxUpload` the most one upload may be, in bytes ([Uploading](#uploading-the-upload-page)) |
| `GET /api/scenes/<name>` | `{ name, files: [{ path, bytes, at, kind }], layout, layoutAt, save }`: `path` relative with `/`, sorted by path; `kind` `model` (`.glb .gltf .fbx`), `audio`, `image` (`.png .jpg .jpeg .webp .gif .tga .bmp`), `data` (`.bin`), `preview` (`previews/<a model's path>.jpg`, above), `recording` (`recordings/<name>.json`, above) or `other`; `layout` the parsed `layout.json` (null when there is none, or it is not a JSON object or over 2 MB), `layoutAt` its time (null). 404 for no such scene |
| `GET /scenes/<name>/<path>` | the file (also `HEAD`): its type by extension, `ETag` from its size and time (304 when it matches), `Cache-Control: no-cache`, single byte ranges (206, 416), CORS (`Access-Control-Expose-Headers: ETag, Content-Range, Accept-Ranges`). The path is decoded once; `..` (as sent or escaped), backslashes, NUL, dot files and folders (`.history/`), more than 4 folders deep, and anything whose real path (a link followed) leaves the scene's folder: 404, the refusals said in the log by their path (never their query), at most 20 lines a minute |
| `POST /api/scenes/<name>/layout` | body: the layout, a JSON object with `studio: 1`, at most 2 MB. 200 `{ ok: true, at, bytes }` (`at` the new file's time, as `layoutAt` will say); 403 `{ error }` with `--scenes-readonly`; 404 no such scene; 413 too big; 400 not a layout. One save at a time per scene |
| `GET /api/scenes/watch` | Server-Sent Events (with a password `?token=`: an `EventSource` cannot send headers), below |
| `POST /api/scenes`, `POST /api/scenes/<name>/file`, `POST /api/scenes/<name>/sound`, `GET /upload` | uploads: [Uploading](#uploading-the-upload-page) |

With the scenes in a Cloudflare R2 bucket (`--scenes r2`) the requests and answers are the same, with a signed link
(`url`) for each file in a scene's listing, a redirect to one for a file, and uploads straight into the bucket besides:
[Scenes in Cloudflare R2](#scenes-in-cloudflare-r2).

**The watch.** `GET /api/scenes/watch` (`text/event-stream`, `retry: 2000`, a comment line every 20 s, at most 200
pages) tells the pages what changes in the folder, so a file you save in Blender or drop in appears in the studio by
itself:

| event | data |
| --- | --- |
| `hello` | `{ scenes }` (as `GET /api/scenes`), at once on every connection |
| `scene` | `{ name, path, kind, gone }`: a file added or changed (`gone: false`) or removed (`gone: true`); `kind` as the listing's (`preview` for a model's picture) |
| `layout` | `{ name, at }`: a scene's `layout.json` written (by a save, or by hand); `{ name, at: null, gone: true }` when removed |
| `scenes` | `{ scenes }`: a scene came or went (the list as `GET /api/scenes` gives it) |

The relay looks at the folder every 2 s while anyone listens, and not at all otherwise (not `fs.watch`: it differs by
system and misses changes on shared folders), and tells a change once it has settled: the same for about 0.5 s (a copy
in progress grows meanwhile, and is told once, after its last part). So a change shows within about 1 to 3 s. Never for
anything the listing leaves out (`.history/`, dot files, temporary files). What the relay writes itself (an upload, a
new scene) is told at once, since it lands whole, and not again when the folder is looked at next.

**Without the relay** (a plain web host, the tests; read only): `node tools/studio/scan.mjs <folder>` writes
`<folder>/index.json` (what `GET /api/scenes` answers, `save: false`) and `<folder>/<name>/files.json` (what
`GET /api/scenes/<name>` answers, without `layout`: the page fetches `<name>/layout.json` itself), by the relay's own
listing rules (`relay/scenes.mjs`, which both use). Run it again after changing the folder (it writes only what
changed; `--check` exits 1 when something is not current, the files' times aside). The page then takes the folder
with `&scenes=<relative folder>` in its link.

### Uploading (the upload page)

The owner (4 November 2026): "the relay should offer an upload page where everything gets converted into the right
formats directly and then sorted into a folder if possible". The page is the studio's own **Upload** pane (a page in a
browser, not a headset): open `<relay>/upload`, pick a scene or make one, drop files or whole folders, check the plan, and
*Convert and upload*. Models are converted to GLB in the browser (the studio's own converter: metres, Y up, textures at
most 2,048 px *for Quest* or 4,096), sounds made mono, and everything sorted into the scene's `models/`, `sounds/` and
`originals/` (the files as they were given, kept so a model can be converted again). The relay only stores what the page
sends, makes scenes, and has `ffmpeg` make long sounds MP3; the conversion of models is the page's
(`tools/studio/SPEC.md`, "The upload page").

```sh
node relay/server.mjs --lan --scenes ~/scenes                       # then open https://<this machine>:8787/upload
COLLAB_TOKEN=<word> node relay/server.mjs --lan --scenes ~/scenes   # the page asks for the password once per device
```

**`/upload`** sends the browser on (302, no password needed for that; any query, where a password could ride, is never
passed on): to `/#studio&upload` when the relay serves the app (`--static`, `--lan`), else to the app's public address
(`--app <url>`; by default the `--origin`, else `https://stories.lbi-netmed.com/`) with
`#studio&upload&relay=<this relay>`: `wss://` and the request's `Host` when the page reached the relay over HTTPS (its
own certificate, or behind `--proxy` the proxy's `X-Forwarded-Proto`, the `n`-th from the right as for
`X-Forwarded-For`), else `ws://`. A `Host` that is not a host name or address: 400.

**What the relay takes** (each with the password when there is one, exactly as every scene endpoint; refused with 403
`{ error }` under `--scenes-readonly`; CORS as the API's, so a page on GitHub Pages may send them: the preflight allows
`POST`, `Authorization` and `Content-Type`):

| request | answer |
| --- | --- |
| `POST /api/scenes` `{ "name": "<name>" }` | 201 `{ ok: true, name }`: the scene's folder made (empty). 400 for a name that cannot be a scene's (the rule above, and not `watch`) or a body that is not `{ name }`; 409 when a scene, or a file, of that name is there; 413 over 16 KB; 507 at 200 scenes |
| `POST /api/scenes/<name>/file?path=<path>[&replace=1]` | the body's bytes as the file at `path` in the scene: 200 `{ ok: true, path, bytes, at }` (`at` its time, as the listing says). The folders of the path are made as needed |
| `POST /api/scenes/<name>/sound?path=<path>.mp3[&replace=1]` | a sound's bytes (any format `ffmpeg` reads: WAV, FLAC, AIFF, MP3, M4A, OGG...), written by `ffmpeg` as a mono MP3 at 96 kbit/s and 44.1 kHz at `path` (which must end in `.mp3`; the studio sends `sounds/<name>.mp3`): 200 `{ ok: true, path, bytes, at }`. 501 when the relay has no `ffmpeg`; 429 (`Retry-After: 5`, and `retry: 5` in the body, since a page on another origin cannot read the header otherwise) while two are being made already; 422 when `ffmpeg` could not make an MP3 of it (not a sound) or made an empty one; 500 when it took longer than `--ffmpeg-limit` (it is stopped) |
| `POST /api/scenes/<name>/copy` `{ "from": "<scene>", "path": "<its path there>", "as": "<its path here>", "replace": true }` (v118; `as` and `replace` optional) | one file of another scene copied into this one (the studio's Add pane, *From another scene...*: each scene keeps its own copy): 200 `{ ok: true, path, bytes, at }`, as an upload. The source must be a file the scene `from` lists (not its `layout.json` or `files.json`, no dot file, nothing in `.history/`; a link out of its folder is no file), at most `--max-upload` (413); where it goes (`as`, else the same path) keeps to the upload's rules below, 409 when a file (or a folder) is there unless `replace: true`, 507 when the scene is full. 404 for no such scene (either one) or file; 400 for a bad body, a source no listing shows, a target the rules refuse, or the file onto itself. A folder's copy goes into a temporary dot file beside where it goes and into place in one step, as an upload's; with R2 the bucket copies the object itself (CopyObject: nothing passes through the relay; see [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2)). The log says `scenes: <name>: copied <path> from <scene>/<path>` |

**The paths** (`uploadPath` in `scenes.mjs`): relative, with `/`, at most 200 characters and 4 folders deep (so under
`originals/` a dropped folder keeps 3 levels of its own), no empty part, no part starting with a dot (`..`,
`.history/`, dot files) or named as a temporary file (`~`, `.tmp`, `.part`...: the listing would leave it out), no
backslash, control character or `: * ? " < > |`, no part ending in a space or a dot and no Windows device name (`con`,
`nul`, `com1`...), so a scene copied to another computer stays whole; never `layout.json`, `files.json` or `index.json`
at the scene's top. Outside `originals/` only the listing's models, sounds, images and data (`.bin`); under
`originals/` any file; under `previews/` only a model's picture, a `.jpg` of at most 200 KB, and no other casing of that
folder at the top (v120: above). A path through a link in the scene that leads out of it is refused before anything is made: 400,
said in the log. 404 for no such scene; 405 for other methods.

**Writing.** A file already there is replaced only with `replace=1`, else 409 `{ error }` (also when two uploads of one
new name meet: the second is told 409); a folder of that name, or a file where a folder of the path should be: 409. The
body is counted as it streams in: over `--max-upload` (512 MB; `maxUpload` in `GET /api/scenes`, so the page can say so
before sending) it is 413, by its `Content-Length` at once or when the count passes it; the rest of the body is read and
thrown away (at most 16 MB more, or 10 s) so the answer reaches the page. It goes into a temporary dot file beside where
it goes (`.upload-<pid>-<random>.tmp`: the listing and the watch leave it out), onto the disk, then into place in one
step (renamed over the old file with `replace=1`; else linked in, which fails when something is there; a file system
without links, such as FAT, looked at, then renamed). Refused, too big, cut short (the page went, or sent nothing for 2
minutes), or the disk full (507): nothing is left behind, nor the folders made for it, and the page is answered only once
that is done. Node's 5-minute limit on a whole request is off where uploads are taken (512 MB over a slow Wi-Fi takes
longer). The log says what was written (`scenes: atelier: wrote models/eva_001.glb (3.0 MB in 1.2 s)`) and what was cut
short. The watch tells the pages at once.

**ffmpeg.** Looked for once at the start where uploads are taken: `ffmpeg -version` on the `PATH`, or the one
`--ffmpeg <path>` names (which must run, or the relay does not start); `--no-ffmpeg` uses none. The start line says
which, and `GET /api/scenes` says `ffmpeg: true`. Without it the studio keeps an MP3, M4A/AAC or OGG as it is and makes
other long sounds a mono WAV itself. Each conversion: the sound written to a temporary file of its own (in the OS's
temporary folder), then `ffmpeg -nostdin -hide_banner -loglevel error -y -i <it> -map 0:a:0 -vn -sn -dn -map_metadata -1
-ac 1 -ar 44100 -c:a libmp3lame -b:a 96k -f mp3 <a temporary dot file beside where it goes>`, its input closed, at most
`--ffmpeg-limit` seconds (180) and two at once; the output must be there and not empty, then it is renamed into place.
`ffmpeg`'s own words never reach the page (it gets ours: *ffmpeg could not make an MP3 of it*); the log gets its last
line, short, with the temporary paths taken out and no query. The 4 min 16 s stereo MP3 the owner sent became a mono
96 kbit/s MP3 of 3.1 MB in 2.3 s on the machine this was built on. Install it with `brew install ffmpeg` (macOS), `sudo apt
install ffmpeg` (Debian, Ubuntu), `winget install ffmpeg` (Windows). The Docker image (`relay/Dockerfile`, Alpine) installs it
(`apk add --no-cache ffmpeg`); an image built without that line runs as before and says so.

## Scenes in Cloudflare R2

The owner (5 November 2026): "we have the coolify server going on hetzner so i guess i will use that and the r2, also
implement the r2 things right away". The relay keeps running on Coolify (on Hetzner); only the studio's scene files
(models, textures, sounds, each scene's `layout.json` and its `.history/`) can live in a Cloudflare R2 bucket instead of
a folder. The rooms never touch R2.

Why: the relay's machine keeps no scenes and needs no *Persistent Storage* volume on Coolify (a redeploy deletes the
container's own files; only an upload that goes through the relay is held in its temporary folder on the way, at most
three at once); the files are downloaded straight from Cloudflare (R2 charges nothing for downloads, and the relay's
bandwidth is not used); big uploads go straight into the bucket, not through Coolify's proxy. A folder of scenes
(`--scenes <dir>`) works as before: the laptop at an event with no internet pulls the scenes first (below).

**How it works** (`--scenes r2`; the same endpoints, answers and listing rules as a folder, `relay/scenes.mjs`):

- **Listing.** The relay lists everything under the bucket's prefix in one go (at most 50,000 objects), keeps it 2 s,
  and lists again at once after a write of its own. A scene is a first-level folder with any object in it; a scene made
  empty keeps a hidden marker object (`<scene>/.scene`, never listed). `GET /api/scenes` adds `store: 'r2'`, `direct`
  and `linkTtl`; `GET /api/scenes/<name>` gives each file a signed link, `url`, and adds `linkTtl`.
- **Downloads.** The studio fetches each file by its `url`, straight from the bucket, from its own origin (models,
  textures, sounds, a long sound streamed by an `<audio>` element with `crossOrigin`). A link is dated from the start of
  the hour (or from the file's own time, when the file changed since) and lives until `R2_LINK_TTL` (12 hours by
  default) after the end of that hour, so a file has the same link all hour (the browser's cache, R2's `ETag` and 304
  work), a changed file gets a new link, and every link lives at least `R2_LINK_TTL` from the listing that gave it. The
  studio reads the listing again once half that time has passed by the wall clock (looked at every minute, when the
  page shows again and before a file is fetched, so a device that slept, such as a headset taken off for the night,
  gets new links as it wakes), and once more when the bucket refuses a link (403, or no answer), fetching the file again
  by its new one; a streamed sound whose element fails gets a new element.
  `GET /scenes/<name>/<path>` (with the password, as ever) answers 302 to a fresh signed link (`Cache-Control:
  no-store`, CORS): for plain links and older studios. A file with a signed link needs no password; one without (never
  in a listing from R2) goes by its address with `?token=`, since after a redirect to another origin a browser drops a
  header. With a folder the studio sends the password as a header, except for the loaders and sound elements, which
  cannot send one.
- **Saving.** `POST /api/scenes/<name>/layout` copies the old `layout.json` into `.history/layout-<time>.json` (unless
  the newest copy there is it already: a save that failed after copying and is tried again adds none), then puts the
  new one whole (`application/json`; an object is never half written), and only then deletes the copies past the
  newest 20: a save the bucket keeps refusing never costs history. Refused, it answers 502 as below.
- **Uploads.** Through the relay, unchanged (`.../file`, `.../sound`: the body is received into the relay's temporary
  folder, counted against `--max-upload`, then put into the bucket whole; nothing is left behind), so an older studio
  still uploads; at most three at once (each is held whole on the way), a fourth answered 429 with `Retry-After`, which
  the studio waits for. And straight into the bucket (`direct: true`): the page asks `POST .../put?path=&size=` for a
  signed PUT, sends the file there with its progress, and tells the relay with `POST .../done?path=&size=`. The Upload
  pane, *Convert to GLB* and the texture buttons do so whenever the relay offers it (`tools/studio/engine/e7c_direct.js`);
  when the bucket refuses the page's PUT (no answer, which a missing CORS rule looks like, or 400, 403, 501) that file
  goes through the relay instead, and so does every upload after it on that page.
- **The upload links checked at the start.** Cloudflare's documents show only `Content-Type` signed on a presigned PUT;
  the relay signs its type, length and `If-None-Match: *` (a body of another size refused by the bucket itself, and no
  file replaced by a link that was not asked to). At every start (and with `--r2-check`) it tries one such link on a
  hidden object at the top of the prefix (`.put-check-<random>`, removed again), twice: taken, then refused (one is
  there). The bucket refusing a signed length or `If-None-Match` (400 or 403): its links sign only their type, sending
  `If-None-Match` all the same, and `.../done` checks the size (an object past `--max-upload` that such a link brought
  is removed; one that came another way, such as `r2sync.mjs`, is never the relay's to remove: 413, left there). Both
  refused: `direct: false`, and pages send their files through the relay. A second PUT taken (the bucket ignoring
  `If-None-Match`) is said: two uploads of one new name at the same moment could then overwrite each other. One line in
  the start's log says which (`R2 upload links: ...`).
- **Copies from another scene** (v118, `POST .../copy`): the bucket copies the object itself (S3's CopyObject, its
  `x-amz-copy-source` signed in the request's header as every `x-amz-*` header is; the type and metadata go with it),
  after the same checks as an upload through the relay (what stands where it goes; the source a listed object of the
  other scene, at most `--max-upload`). Nothing passes through the relay or the page. The bucket is not asked to refuse an
  object already there (conditions on a copy differ from store to store): of two copies to one new name at the same
  moment, the second may replace the first.
- **Long sounds.** `ffmpeg` runs on the relay as before: from the body, or with `?from=<path>` from a file already in
  the bucket (the studio sends the original straight into the bucket first, then asks for the MP3 from it). The relay
  fetches it to a temporary file, runs `ffmpeg` (its time limit, two at once), puts the MP3 into the bucket and removes
  its temporary files.
- **The watch.** While a page listens, the relay lists the bucket every `R2_POLL` seconds (5) and tells what changed
  (key, size, ETag, time) at once (an object lands whole: nothing to settle); its own writes (a save, an upload, a
  scene made) are told at once. A comment line every 20 s keeps proxies from closing the stream.
- **Errors.** What R2 answers that is not expected (403, 404, 5xx, no answer) becomes a short answer of the relay's own
  (502 `{ error: "the scenes' storage (R2) answered 503" }`), tried once more first for a 5xx or no answer. A PUT that
  is refused as `If-None-Match` says (412, or 409 as R2 has been seen to answer) on its second try is looked at: when
  the object there is the one sent (its MD5), the first try landed with its answer lost, and it went in. Never R2's
  body, a signed link or a key in an answer or a log line.
- **The start.** Settings that cannot work stop it with a sentence (missing ones named, keys refused, no such bucket, an
  address that is no one's). A bucket that does not answer now (a 5xx, 408, 429, no answer: R2 or the way to it away for
  a moment, as during a redeploy) does not: the relay starts (its rooms never need the bucket), says so, the scenes
  answer 502 until the bucket answers, and it is asked again after 5 s and then every 30 s; once it answers the log says
  `scenes: the bucket ... answers now`, and its CORS rule and upload links are checked as at a start.

### The owner's steps

1. **The bucket.** Cloudflare dashboard, **R2 Object Storage**, **Create bucket**: a name (lower-case letters, digits
   and `-`, such as `lbi-scenes`). *Location*: leave it automatic, or choose the **European Union** jurisdiction if the
   files must stay in the EU: **this cannot be changed later** (a bucket made so needs `R2_JURISDICTION=eu`). Default
   storage class: Standard.
2. **An API token.** R2's overview, **Manage API tokens** (in *Account details*), **Create API token** (an *Account*
   token, or a *User* token): permission **Object Read & Write**, **Apply to specific buckets only**: the bucket above.
   Create, then copy the **Access Key ID** and the **Secret Access Key** (shown once) somewhere safe, and the **Account
   ID** (R2's overview, *Account details*; it is also in the S3 address shown there,
   `https://<account id>.r2.cloudflarestorage.com`).
3. **The CORS rule.** The bucket, **Settings**, **CORS Policy**, **Add CORS policy** (or Edit), the JSON tab, paste:

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD", "PUT"],
       "AllowedHeaders": ["Content-Type", "If-None-Match", "Range"],
       "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   `"*"` opens nothing: every request needs its own signed link, which only someone with the relay's password gets.
   (Listing the app's origins instead, `https://stories.lbi-netmed.com` and `https://rooms.lbi-netmed.com`, works for
   the studio; a page that follows the relay's redirect from another origin arrives with `Origin: null`, which only
   `"*"` lets in.) Pictures for WebGL and sounds for the sound engine need CORS; uploads need `PUT` and the two headers.
   A change can take 30 s to show.
4. **Coolify.** The relay's resource, *Environment Variables*, each a runtime variable (not needed at build time):
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (all three marked **Is Secret**), `R2_BUCKET`, and if
   wanted `R2_JURISDICTION` (`eu`), `R2_PREFIX` (a folder in the bucket, such as `scenes`), `R2_LINK_TTL`, `R2_POLL`.
   Then `RELAY_ARGS` = **`--proxy 1 --public --scenes r2`**, and `COLLAB_TOKEN` (the password: `--public` with scenes
   refuses to start without one). No *Persistent Storage* is needed for scenes. Never put the keys in a command or the
   repository: process lists and build logs show commands.
5. **Deploy and check.** The start lines should include
   ```
   Scenes for the studio (#studio) from the R2 bucket lbi-scenes: none yet (...); the studio saves their layouts there (...); pages fetch the files straight from the bucket by signed links (each lives 12 h) and upload big ones straight into it; they need the password
   R2 CORS (as a page at https://stories.lbi-netmed.com meets it): download with a range yes, upload yes; a page sent there by the relay's redirect from another origin (Origin: null) yes; the rule itself cannot be read with these keys: ...
   ```
   (an Object Read & Write token may not read the rule itself; the line then checks it as a browser would, by
   preflights, and asks you to look at the exposed headers in the dashboard), and
   `R2 upload links: taken with their type, length and If-None-Match signed; a second upload to the same new name refused (412 ...)`
   (or which of the fallbacks above it took). With wrong settings the relay does not start, and says why:
   `--scenes r2: missing R2_BUCKET in the environment`, `R2 refused the keys (403 SignatureDoesNotMatch): check
   R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY ...`, `there is no bucket lbi-scenes there (... R2_JURISDICTION=eu)`,
   `could not reach ... (ENOTFOUND)`; a bucket that only does not answer for now does not stop it (above). In the
   container's terminal (Coolify, *Terminal*), `node relay/server.mjs --scenes r2 --r2-check` checks the settings, the
   keys, the CORS rule and the upload links, prints what it found and stops (exit 0 when all is well).
6. **Moving scenes there, and an event.** On a computer of your own, with the same variables set in the shell (from a
   file of your own, never in the repository, such as `set -a; . ~/r2.env; set +a`):

   ```sh
   node tools/studio/r2sync.mjs list                           # the bucket's scenes
   node tools/studio/r2sync.mjs push ~/scenes --all --dry      # what it would send; then without --dry
   node tools/studio/r2sync.mjs pull --all ~/scenes            # before an event: everything onto the laptop
   node relay/server.mjs --lan --scenes ~/scenes               # the event, with no internet
   node tools/studio/r2sync.mjs push ~/scenes --all            # after: the layouts saved there back into the bucket
   ```

   It moves exactly the files the relay lists (and each `layout.json`; `.history/` only with `--history`), only those
   that differ (by size, then MD5 where the bucket's ETag is one, else by time; a pulled file takes the object's time),
   never deletes unless `--delete`, and `--dry` changes nothing. A file that differs goes only from the newer side: one
   newer where it would go (a layout saved on the laptop's relay since the pull, or by the relay on Coolify since) is
   kept, and said (`kept <scene>/layout.json in the bucket: it is newer there ...; --force replaces it`), unless
   `--force`. A `layout.json` replaced on either side is first copied into that side's `.history/` (the newest 20 kept),
   as the relay keeps one it saves over, so nothing saved is lost. Both changed (saved at the event and on Coolify):
   the newer wins and the other is in `.history/`; pull before you push. `node tools/studio/scan.mjs ~/scenes` works on
   a pulled folder as on any other.
7. **Costs** (Cloudflare's prices as of November 2026; check its R2 pricing page): every month, 10 GB stored, 1 million
   Class A operations (writes and listings) and 10 million Class B operations (reads) are free; downloads are always
   free. Beyond that $0.015 per GB a month, $4.50 per million Class A, $0.36 per million Class B. What the relay uses:
   a listing is one Class A operation per 1,000 objects under the prefix (every scene's files and their `.history/`
   copies count; a page opening a scene: one or two listings; a save: about five operations, with its history; an
   upload: two or three; each start: about five, for its checks); the watch lists the whole bucket every `R2_POLL`
   seconds while at least one page listens: 720 listings an hour at 5 s, so a page left open around the clock for a month
   costs about 520,000 operations for a bucket of up to 1,000 objects, within the free million, but twice that at 2,000
   objects and three times at 3,000 (operations = pages of 1,000 x listings). For a bucket of more than about 1,000
   objects with a page left open, set `R2_POLL=15` or more (a third, or less); changes then show up to 15 s later. Every
   file a browser fetches is a Class B operation (a streamed sound a few, one per range). A typical studio fits the free
   tier many times over.

**Security.** The keys are read from the environment only, never from the command line, and never written to a log or
an answer. A signed link works for anyone who has it, for that one file, until it lapses (`R2_LINK_TTL`, 12 hours;
60 s to 7 days): it cannot list the bucket, read another file or write. Only someone with the relay's password gets
links (the listing and the redirect need it), so the password still guards who sees the scenes. A signed PUT is for one
path, of one type (and one size, where the bucket takes the length signed), for an hour, and cannot replace a file
unless the page asked to and was allowed (`replace=1`). The API token is Object Read & Write on that one bucket only. The files are served from Cloudflare's own
address, not the app's, so a page or a script kept in `originals/` cannot reach the app or its password. `--public` with
`--scenes r2` still needs the password.

| variable | default | meaning |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | (needed) | the account's 32-character ID |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | (needed) | the API token's keys (Object Read & Write, that bucket) |
| `R2_BUCKET` | (needed) | the bucket's name |
| `R2_PREFIX` | none | a folder in the bucket that holds the scenes (`scenes`, `studio/scenes`) |
| `R2_JURISDICTION` | none | `eu` for a bucket made in the EU jurisdiction (`https://<account>.eu.r2.cloudflarestorage.com`) |
| `R2_LINK_TTL` | 43200 (12 h) | how long a signed download link lives, in seconds (60 to 604800) |
| `R2_POLL` | 5 | how often the watch lists the bucket while a page listens, in seconds (1 to 300) |
| `R2_ENDPOINT` | from the account | another S3 address (tests, an S3-compatible store); `http://` only for `127.0.0.1` or `localhost` |

| request (R2 only) | answer |
| --- | --- |
| `POST /api/scenes/<name>/put?path=<path>&size=<bytes>[&replace=1]` | 200 `{ url, headers, path, expires }`: a signed PUT for that file (`expires`: 3600 s): send the body with exactly those headers (its `Content-Type`; `If-None-Match: *` unless `replace=1`); its length and `If-None-Match` are signed too (a body of another size refused by the bucket), unless the bucket refused those signed at the start (then only its type: the size is checked at `.../done`). The checks of an upload through the relay first: the path and kind rules (400), `size` needed and at most `--max-upload` (400, 413), 409 for a file there (unless `replace=1`), a folder by that name or a file in the path, 507 for a full scene, 404 for no such scene, 403 with `--scenes-readonly`. A relay with a folder, or one whose bucket refused its upload links at the start, answers 501 (send the file to `.../file`) |
| `POST /api/scenes/<name>/done?path=<path>[&size=<bytes>]` | 200 `{ ok, path, bytes, at }` as an upload's: the relay looks at the object (400 when nothing came, or it is not of the size said; 413 past `--max-upload`, the object removed only when a link of this relay's without its length signed brought it, else left there) and tells the watch at once |
| `POST /api/scenes/<name>/sound?from=<path>&path=<path>.mp3[&replace=1]` | as `.../sound`, the sound taken from a file already in the scene (400 for none, 413 past `--max-upload`) instead of the body |

**Tests.** `node relay/test-r2.mjs` checks the signer byte for byte against AWS's published Signature Version 4
examples (`relay/test.mjs` runs it too), and `relay/test.mjs` runs the folder's scene and upload steps against a
stand-in S3 (`relay/s3fake.mjs`, tests only, never served: it checks every signature, header and link, so a broken
signer fails), plus the redirect, direct uploads, `from=`, the watch from changes made straight in the bucket, the
start's refusals, `--r2-check`, the upload links checked at the start against a stand-in told to answer as another
store might (`s3fake.mjs`'s `quirks`: a signed length refused, both refused, `If-None-Match` ignored, 409 for one there,
a PUT's answer lost, a 5xx or nothing at the start), a save the bucket refuses, three uploads through the relay at once,
and `tools/studio/r2sync.mjs` (its conflicts and `.history/` copies too); `node tools/collab.mjs --studio` opens, saves,
converts and uploads from a real browser against the stand-in on another port, including a link the bucket refuses
(read again) and an upload it refuses (sent through the relay).

**Untested until tried with a real bucket:** the signatures against R2 itself (checked against AWS's examples and a
stand-in that checks them as S3 does), R2's CORS answers to the studio's preflights and on signed links, a page sent
through the redirect from another origin (`Origin: null`), `If-None-Match: *` and a signed `Content-Length` on a signed
PUT (the start's check says which R2 takes, and the relay and the studio fall back), whether R2 sends CORS headers on
its 403s (else a lapsed link reads as no answer, which the studio also treats as a lapsed link), R2's ETags (a copy's
the same as its original's) and the milliseconds of its listing's times, `GetBucketCors` with an Object Read & Write token, the EU
endpoint, Quest Browser fetching and streaming from signed links, uploads of hundreds of MB from a page straight into the
bucket, and the costs in practice.

## The PC's Vive trackers (`--trackers`)

Vive Tracker 3.0s with SteamVR on the Windows PC that also runs the relay (v126; the owner, 8 November 2026: "we go
for 1 and 3 with mixamo rigs for now", 9 to 11 trackers, three base stations and a Valve Index). Browsers cannot read
the trackers, so a small helper beside SteamVR, `tools/trackers/bridge.py`, sends their poses to the relay on the same
PC, and the relay sends them to the rooms that use them, lined up with the room. Setting it up: [tools/trackers/README.md](../tools/trackers/README.md);
the contract between the parts: [tools/trackers/SPEC.md](../tools/trackers/SPEC.md). The code: `relay/trackers.mjs`.

```sh
node relay/server.mjs --lan --trackers        # on the PC, with SteamVR running
uv run tools/trackers/bridge.py               # (--port <n> when the relay has --trackers <n>; or python, after pip install openvr)
```

`--trackers` belongs only on the PC with SteamVR: the bridge sends to 127.0.0.1, so a relay elsewhere hears nothing.
The relays on Coolify (the test place and the main site's relay) run without it: their rooms get no `@trk` and their
Shared dialogs show no trackers. With a password (`COLLAB_TOKEN`), `/api/trackers` and `/api/trackers/still` need it as
every API call does (401 without it), and so does `/api/ping`, which says `trackers: true`.

**The bridge's datagrams.** UDP to `127.0.0.1:<port>` (47800 by default; the relay listens on `127.0.0.1` only, so
nothing from the network reaches it), one datagram a reading of every device, about 90 a second, JSON, under 8 KB:
`{ v: 1, t: <bridge ms>, d: [{ s: <serial>, k: 'trk' | 'hmd' | 'ctl' | 'base', h: 'l' | 'r' (controllers), p: [x, y, z]
(m), q: [x, y, z, w], lv: [3] (m/s), av: [3] (rad/s), ok: <tracked well>, b: <battery 0..1 or null> }] }` in SteamVR's
standing space (y up, -z ahead, right-handed, as WebXR's). The relay keeps each device's latest reading with its own
time it came. A datagram that is not the bridge's (not JSON, no `v: 1` or `d`, over 8 KB) is ignored whole; a reading
that is not right (a serial outside `[A-Za-z0-9_.:-]`, up to 64; an unknown kind; a position past 1 km; a turn that is
not one; `ok` not true or false) is left out on its own; both are counted and said in the log at most once a second
(`trackers: ignored 3 bad datagrams and 1 bad reading`). A battery outside 0 to 1 is taken as none. The log also says
each device the first time it is seen, when the bridge starts sending and when it has been silent for 5 s.

**The room's key `trk`** (written by pages and headsets in the room; never refused by either lock; the relay only
reads it): `{ on, m, names, by, at }`. `on: true`: this room uses the PC's trackers (only such rooms get them).
`m: { a: [x, y, z], b: [x, y, z] }` or null: the two points taken by hand, a tracker lying on its base on spot A and on
spot B, in SteamVR's space (each from `/api/trackers/still`). `names: { <serial>: <name> }` for the pages. A write keeps
the fields it does not change (the pages' rule; the relay stores what it is given).

**Lining up.** The room's frame from `m` is exactly a headset's from its floor spots (`shared.js`: `fromMarks` with
the floor spots' `floorUnder`, and `basis`): its origin the floor point under spot A (spot A's point less `TRK_FLOOR`,
the tracker's pose origin over the floor when it lies on its base: 0 m until measured), its x axis level towards spot
B, y up, z = x cross y. A point `p` in SteamVR's space is `(c dx - s dz, dy, s dx + c dz)` in the room, `d = p - origin`,
`(c, 0, -s)` the x axis; a turn is turned by the same yaw. `relay/test.mjs` runs `shared.js`'s own code against it.
Points under 10 cm apart along the floor (or not three numbers each) give no frame: not lined up. It holds while the
base stations stay put and SteamVR's room setup is not run again (then line up again). Reference trackers left on the
spots for good (`ref` in the SPEC) are for later.

**`@trk`.** To every member of a room whose `trk.on` is true, sent by the relay itself (no member's fx rate applies;
`by: ''`), about 60 times a second while the bridge sends (whenever a newer reading has come since the last one):
`{ t: 'fx', k: '@trk', v: { at, l: 'hand', t: [[id, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok, kind], ...] }, by: '' }`.
`at`: the relay's time (ms) of the newest reading; each device's pose and velocity in room coordinates (metres and
m/s to the mm, quaternions to 4 decimals); `ok` 1 or 0 (0 when SteamVR lost it, or its reading is older than 0.5 s);
`kind` `t` a tracker, `h` the headset, `l` and `r` its controllers. Base stations never; a controller SteamVR has given
no hand yet is left out; a device silent for 5 s is left out. With nothing new (the bridge silent), once a second all
the same, so pages see each tracker go to `ok` 0. A room that is on but not lined up (no `m`, or one that gives no
frame): `{ at, l: '', t: [] }` once a second, so pages can say why. About 1.5 KB for 11 trackers, the headset and two
controllers, 60 times a second to each member. A member whose socket holds more than 256 KB unsent is skipped until it
drains (newer poses come anyway; it is not cut for them; the log counts them once a second). A member cannot send an
`@trk` of its own (`@` is not in a key a member may use: refused as `bad`). Only rooms on this relay: rooms peer to
peer or on a device get none.

**The API** (with the relay's password as every API request; both answers 200 whatever the tracker did, 400 for a
bad ask, 405 for another method):

| request | answer |
| --- | --- |
| `GET /api/trackers` | `{ ok: true, trackers: [{ id, k, h?, ok, b, p, q, age }] }`: every device seen in the last minute, trackers first, then the headset, its controllers and base stations; raw in SteamVR's space (`p` and `q` to 4 decimals), `ok` false once its reading is 0.5 s old, `b` the battery (0 to 1, to 2 decimals) or null, `age` ms since its last reading |
| `GET /api/trackers/still?id=<serial>&ms=1000` | waits `ms` (200 to 5000; 1000 by default) and answers `{ ok: true, p, spread, n }`: the tracker's position averaged over its readings meanwhile (`p` to 0.01 mm), how far the furthest was from it (`spread`, mm) and how many; or `{ ok: false, error }` in words: not seen (at once, for a serial not heard from for 5 s), lost tracking meanwhile, or moved more than 5 mm meanwhile (with `spread`). The pages' *Set spot A* and *Set spot B* |

Untested until it runs on the owner's PC: the bridge with SteamVR and real trackers (`bridge.py`'s pyopenvr calls,
the rate on Windows), `TRK_FLOOR`, the lag from SteamVR to a headset through the relay, and how steady the lining up
by hand is.

## HTTP API

All under `/api/`, JSON, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` (preflights: 204). With an
origin rule (`--origin`, `--public`): `Access-Control-Allow-Origin` is the asking page's origin when it is allowed
(`Vary: Origin`), and a request from any other origin gets 403 `{ error: 'origin not allowed' }` (its preflight too);
a request with no `Origin` is answered (the relay's own page, the health check, curl). Preflights allow the methods
`GET`, `POST` and `OPTIONS` and the headers `Authorization`, `Content-Type`, `Range` and `X-Log-Token`. With a password (`COLLAB_TOKEN`) every request below but
`GET /api/health` needs it (`Authorization: Bearer` or `?token=`; 401 without, 429 past 20 failures a minute: [The
shared password](#the-shared-password-collab_token)).

| request | answer |
| --- | --- |
| `GET /api/health` | `{ ok: true, protocol, rooms }`: the protocol number (1) and how many rooms (a count); open even with a password (health checks), and nothing more |
| `GET /api/ping` | `{ now, proto, net, versions: 1, reload: true }`: relay time (ms), protocol number (1), the asker's network id (see [Rooms on this network](#rooms-on-this-network)), and since v136 that a room moves on to a newer version (`versions`) and takes reload orders (`reload`, below); with `--keep` also `keep: true`; with `--watch` also `watch: true`; with `--scenes` also `scenes: true`; with `--unlisted` (`--public`) also `unlisted: true` (no list of open rooms here); with `--trackers` also `trackers: true` and `trackersSeen` (how many trackers the bridge has sent in the last 5 s) |
| `GET /api/near` | `{ net, rooms: [{ code, name, members, stations, version }] }`: the rooms on the asker's network, those with people first (at most 20): `name` the first member's (by when they came), `members` a count. Never an address; with `--unlisted` no `name` either |
| `GET /api/watch` | with `--watch`: a stream of Server-Sent Events (see [Hot reload](#hot-reload---watch)); 404 without, 503 at 200 pages |
| `POST /api/rooms` `{ app, version, code? }` | 201 `{ code }`: a new room, 3 letters A-Z. With `code`, that code if it is free (409 `{ error: 'taken', version }` if not, the room's version since v136): how a client brings back its room after a relay restart. 400 for a body that is not JSON or a bad code, 413 over 16 KB, 503 at 2000 rooms. With `--creates`: 429 (`Retry-After`) past an address's new rooms; a chosen `code` is also a lookup (`--guesses`: 409 counts, 429 past the budget) |
| `GET /api/rooms` | `[{ code, members, names, stations, idle, version }]`: `members` a count, `names` theirs, `stations` how many `st.<id>` keys, `idle` seconds since the last member left (0 while anyone is in). With `--unlisted` (`--public`): `[]` |
| `GET /api/rooms/XYZ` | `{ code, app, version, created, seq, idle, members, keys }` (for debugging; a page asks it before it joins a room again by itself, or brings one back), or 404. With `--unlisted`, `members` is a count. With `--guesses`, a 404 is a lookup of an unknown code, and past the budget any code gets 429 (`Retry-After`) |
| `POST /api/rooms/XYZ/reload` `{ n, to?, shell?, from? }` | (v136, Update the room) sends every member, whatever its version, the reload order: the effect `{ t: 'fx', k: 'q.reload', v: { n, to, shell, by: '', from, at }, by: '' }` (`n` the order's id, 1 to 16 letters, digits, `_` and `-`; `to` the version to come back with; `shell` `{ n, id }` the release; `from` who pressed it), and for 2 minutes lets the room move on to `to` from its first newcomer of that version, even while members of the old one are still there (they get the order again and are refused 3 s later: [Rooms across updates](#rooms-across-updates-v136)). 200 `{ ok, members, version }`; 400 for a bad body, 404 for no such room (a lookup, `--guesses`), 405 for another method, 429 (`Retry-After`) within 10 s of the last order to the room. Never stored; with a password it needs it, as every call; its log line names no one |
| `GET /api/scenes`, `GET /api/scenes/<name>`, `POST /api/scenes/<name>/layout`, `GET /api/scenes/watch` | with `--scenes`: the studio's scenes, see [Your own scenes](#your-own-scenes-the-studio); 404 without |
| `POST /api/scenes`, `POST /api/scenes/<name>/file`, `POST /api/scenes/<name>/sound`, `POST /api/scenes/<name>/copy` | with `--scenes`: uploads and copies from another scene, see [Uploading](#uploading-the-upload-page) (`GET /upload`, outside `/api/`, sends a browser to the upload page) |
| `POST /api/scenes/<name>/put`, `POST /api/scenes/<name>/done` | with `--scenes r2`: uploads straight into the bucket, see [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2) (501 with a folder) |
| `GET /api/trackers`, `GET /api/trackers/still?id=<serial>&ms=1000` | with `--trackers`: the PC's trackers raw in SteamVR's space, and one lying still, averaged; see [The PC's Vive trackers](#the-pcs-vive-trackers---trackers); 404 without |
| `POST /api/log` `{ room, id, name, kind, entries }` | with `--logs` (or `--lan`): `entries` (objects, at most 2000) appended as JSON lines to `<logs>/<day>-<room>-<name>-<id>.jsonl`; 200 `{ lines }`, 400 for a bad body, 429 more than once a second per member, 507 over 20 MB a file; 404 without `--logs`. With a log token (`--log-token`, `RELAY_LOG_TOKEN`; `--public` needs one for `--logs`): only with the header `X-Log-Token`, 404 without it (as if logs were off: the page stops sending), 403 for a wrong one |

With `--static <dir>`, every other path may be a file of the app, and only that: `index.html` (also at `/`),
`sfx.js`, `occlusion.js`, `ships.js`, `shared.js`, `sw.js`, `manifest.webmanifest`, `three.min.js`, `three.LICENSE.txt`, `proteins.html`,
`spatial.html`, `README.txt`, `peerjs.min.js`, `PEERJS-LICENSE.txt`, `version.json` (the release's version file, for
live updates: sent with `Cache-Control: no-store`), `lowpoly.js` (the miniatures), and the files directly in `stories/`, `audio/`,
`icons/` and `p2p/` (the peer-to-peer test page, at `/p2p/`: a path ending in `/` is that folder's `index.html`)
(`APP_FILES` and `APP_DIRS` in `server.mjs`: add to them when the app needs a new file or folder). Everything else is 404: the
authors' data (`ikerdata/`), `tools/`, `docs/`, the relay itself, folders (no listings), anything whose path has
a part starting with `.` (no `..`, no `.git`), and links that lead out of those files. `GET` and `HEAD`. `Cache-Control: no-cache` with `ETag`/`Last-Modified` (304 when unchanged, as the
service worker expects), gzip for text when asked, single byte ranges on every file (206; 416 when
unsatisfiable; the narration's `<audio>` element asks for them), types for `.html .js .mjs .json .webmanifest
.css .txt .md .svg .png .jpg .webp .ico .gif .mp3 .ogg .wav .mp4 .wasm .woff2 .glb .pdf` (and for scenes `.gltf .fbx .bin
.tga .bmp .oga .opus .m4a .aac .flac .webm`). Without `--static`, `/` answers a line of text. With `--scenes`, the
paths under `/scenes/` are the scenes' files ([Your own scenes](#your-own-scenes-the-studio)), with or without
`--static`.

## Hot reload (`--watch`)

While you work on the app, `node relay/server.mjs --static . --watch --build` (or `--lan --watch --build` for
headsets) makes every page and headset it serves follow your edits (index.html's `HOST.live`; AGENTS.md "Hot reload
and live updates"). The page asks `/api/ping`; when it says `watch: true` it opens `/api/watch`, a stream of
Server-Sent Events (`text/event-stream`, `Cache-Control: no-store`, `retry: 2000`, a comment line every 20 s):

| event | data | the page |
| --- | --- | --- |
| `hello` | `{ shell: { 'index.html': fp, 'sfx.js': fp, 'occlusion.js': fp, 'ships.js': fp, 'shared.js': fp, 'sw.js': fp, 'three.min.js': fp, 'peerjs.min.js': fp }, stories: { <key>: fp }, list: fp, build }`, at once on every connection | the first: the shell as it is; after a lost connection (the relay restarted, the laptop slept): a shell file changed meanwhile reloads, a story changed meanwhile is swapped or marked, the list is read again |
| `story` | `{ key, fp }`: `stories/<key>.js` changed | swaps it in place at once where it is on show (its place kept: mode, time, explore state, view, the headset's placement; at a station the room's clock and state, nothing written to the room); fetched fresh next time elsewhere |
| `list` | `{ fp }`: `stories/list.js` changed | reads the list again: new and changed cards, no reload |
| `shell` | `{ file, fp }`: a shell file changed | reloads with its place kept (a headset session ends: the page shows Enter VR to continue) |
| `build` | `{ key, ok, ms, out }` (with `--build`): a built story's build ran (`out`: the end of its output) | a failed build shows in the page's bar |

`fp` is a fingerprint of the file's text (index.html's `HOST.fingerprint`, the same in `tools/release.mjs`). A file is
looked at 150 ms after its last change and told only when its text changed. With `--build`, a change to a `.js` file
under `tools/<dir>/` runs the build of every story whose `build.mjs` names that folder (its own, and `../lbi/` and the
like) or a story file it cuts from (the pass story from `stories/airports.js` and `stories/spatial.js`); files in
`shots/`, `gen/` and `data/` are not sources. One build runs at a time, 300 ms after the last change; the story file it
writes then goes out as `story`. Watching `tools/` needs Node 20 or newer on Linux (macOS and Windows: any). For
development only: `--build` runs the build scripts of the folder it watches.

## WebSocket protocol (version 1)

Connect to `/api/ws?room=XYZ&id=<client id>` (`wss://` behind HTTPS; `&token=<password>` when the relay has one). The room code is case-insensitive; the
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
| relay | `fx` | `k, v, by` | to everybody but the sender; `by: ''` for the relay's own, `@trk` (`--trackers`: [The PC's Vive trackers](#the-pcs-vive-trackers---trackers)) |
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
  says `XYZ version networks-41 -> networks-42`. An older newcomer is refused with 4006 as before (a device that missed
  the update, waking in an upgraded room, would otherwise turn it back); its words name the room's version. Versions
  that are not `networks-<n>` (the tests' `v1`) only ever match exactly. The keys are kept as they are (every bump so far
  only added fields and keys, which the app reads leniently; `shared.js` has a `MIGRATE` table for one that does not).
- **The app waits or reloads** (`shared.js`, `versionRefused`): refused by an older room, a device says so (*Room XYZ
  still runs version networks-41 on a device that has not updated: joining as soon as it has*, status `older`) and tries
  again every 3 s, so it is in as soon as the last old device has reloaded (an older relay without `versions` in its ping
  cannot move a room on, and each try keeps the room from expiring: it gives up after 2 minutes there). Refused by a newer
  room, it reloads (outside a headset at once, at most once in ten minutes; in one the update panel asks). Pages outside
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
  never make them again. On Coolify: step 6 of [Public hosting on Coolify](#public-hosting-on-coolify).
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

## Rooms on this network

Browsers cannot search the local network, so devices meet through the address they share on the internet (the app's
*Rooms on this network*, in AGENTS.md "Shared rooms"). The relay hashes the address it sees for each request and socket
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
  does not turn it on: Coolify's `RELAY_ARGS` does (step 6 of [public hosting](#public-hosting-on-coolify)).

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

## Testing

```sh
node relay/test.mjs
```

It starts the relay on a free port (timeouts of 1 s, serving the repository), and checks the API, joining and
its refusals, welcome and members, ordering and acknowledgement, last writer wins, null refused outside the
deletable families, the epoch rule, `fx` (not stored, not echoed, rate capped), ping and pong, a late joiner,
malformed and oversized messages, hand-made frames (masking, fragmentation with a ping inside, control frames,
close), member timeouts, version and protocol mismatches (since v136 a room moving on to a newer `networks-<n>` once
nobody of its own is connected, never back, other versions only the same; the reload order: its answers 404, 400, 405
and 429, every member of every version getting it from the relay, the room moving on with old members there, who get it
again and are refused 3 s later; and `--keep`: written within 6 s of a change and as it stops, read back with its seq,
version and keys, expired rooms and bad keys left out, a bad file kept aside as `.bad`, another relay's write taken;
`node relay/test.mjs --rooms` runs only these, in seconds), replaced sockets, room expiry, the room's limits
(5000 keys; 4 MB with the keys counted), the static files (types, gzip, byte ranges, 304, path traversal
attempts, every file `sw.js` caches served and nothing else of the repository, links, no file left open by a
download cut short), the start lines (no `http://` address for headsets), `--lan`, the log, and the introduction
server: ids over HTTP (CORS, bad requests refused), `OPEN`, `ID-TAKEN` for another token, the same token reconnecting,
messages passed on with `src`, kept for an id that comes a moment later and `EXPIRE` for one that never comes,
heartbeats, a silent id dropped, a closed socket freeing its id, the log (ids only) and `--no-peer`; rooms on this
network (`/api/near` and `/api/ping` by the asker's network with `--proxy`, only the last address of `X-Forwarded-For`,
and with `--proxy 2` only the second from the right (the first when there is only one),
a private address by its /24 and IPv6 by its /64, `near` off and on, a member from another network, an empty room,
the header ignored without `--proxy`, no address in any answer or log line and no network's id in the log); and `--watch`
(ping, the event stream's `hello` with the right fingerprints, `story`, `list` and `shell` as files change, nothing for
a file written unchanged, `--build` running a story's build when its source changes and reporting a failed one, not
for `shots/`); and a public server: without `--public` every origin, sockets with no `Origin`, a hundred unknown codes
in a row and the room list with names as before; with it, the app's origin allowed and others refused (the API, its
preflights, sockets before the upgrade, the introduction server's ids and sockets; CORS echoed with `Vary: Origin`), a
request with no `Origin` answered (Node's `fetch` and the Dockerfile's own health check) but a socket with none refused
unless `--allow-no-origin`, the relay's own origin by `Host` or `X-Forwarded-Host`, its pages served to anyone, the start
lines (no LAN addresses), options from `RELAY_ARGS`, `--origin` alone (a list, repeated; bad values refused at the
start; no other rule with it), no room list and no name in any answer (`/api/rooms/<code>`, `/api/near`) or log line
while the room's own members still see names, unknown codes capped per address (`GET` 404s, sockets for unknown rooms
and taken codes from one budget; past it a known code refused too, with `Retry-After` or `limit` and 4429; a member
coming back let in; another address, an IPv6 address in another /64 and the address `--proxy` takes not held up; one
budget for everyone without `--proxy`), sockets per address (rooms and `/peerjs` together) and new rooms per address
capped, the log token (refused at the start without one or with a short one; from `RELAY_LOG_TOKEN` or `--log-token`;
none 404, wrong 403, never in the log) and `--store`; and the shared password: off by default (nothing changes,
`/api/health` open), `COLLAB_TOKEN`, `--token` and in `RELAY_ARGS`, `COLLAB_PORT` and `COLLAB_HOST`, `/api/health`
saying nothing more, ping, near, rooms, a room, a new room, log, watch, an unknown path and `/peerjs` without it or with a
wrong one (Bearer or `?token=`, case counting) 401 with its body, both ways of bringing it working, a preflight allowing
`Authorization`, the app's files open, a socket without it or with a wrong one getting `error` `token` and 4401 and
nothing else, one with it welcome, the introduction server refusing PeerJS's default key (4401) and taking the password
as key (in the socket and the id's path), `/api/watch` with `?token=`, the Dockerfile's health check, 20 wrong ones from
an address then 429 (the right one too), 4429 on its socket and `/peerjs`, another address untouched, none at all not
counted (nor PeerJS's default key, nor an unknown room code asked with the password), and the password in no log line or file; and
the studio's scenes (`--scenes`, in a folder of its own under the OS's temporary folder, removed afterwards): `/api/ping`
saying so (and nothing on a relay without it), the list and a scene by the listing rules (names left out and said once,
the files a listing leaves out, 4 folders deep, links in and out, kinds, sorting, sizes and times), `tools/studio/scan.mjs`
writing what the API answers and nothing when run again (`--check`), the files (types in any case, ETag and 304,
no-cache, ranges, HEAD, CORS and its preflight; `..` as sent and escaped, backslashes, NUL, links out, dot files,
`.history/`, too deep: 404, said in the log without the query), saving (the first save, `.history/` from the second,
the newest 20 kept over 24 saves, five at once, no temporary file left, bad, too big and unknown refused and changing
nothing, `--scenes-readonly` 403), the watch (`hello`, a file added, changed and removed told once settled, a save's
`layout`, a scene coming and going, a file written in parts told once after its last part, nothing for `.history/` or
temporary files, `layout.json` removed, a second page), the password on every scene endpoint and file (Bearer and
`?token=`, wrong ones counted to 429, never in a log line), `--public` with `--scenes` refused without a password,
`COLLAB_SCENES`, `RELAY_ARGS`, a folder that is not there and `--scenes-readonly` alone; and uploads (a folder of their own,
and stand-in `ffmpeg` scripts, one script whose name says what it does): `GET /api/scenes`'s `upload`, `ffmpeg` and
`maxUpload` (with the stand-in, with none on the `PATH`, `--scenes-readonly`); a scene made (201, listed, told on the
watch at once and not again, 409 for one or a file of that name, names that cannot be a scene's and bodies that are not
`{ name }` 400 with nothing made, over 16 KB 413, `--scenes-readonly` 403); files (written as sent with their folders,
listed and served, told at once and not again, 409 then `replace=1`, the kinds and paths taken and the ones refused,
each saying why and writing nothing, a link out of the scene refused with nothing made outside, a folder or a file in the
way 409, no such scene 404, other methods 405, exactly 1 MB taken with `--max-upload 1`, past it 413 by
`Content-Length` and counted while chunked, the answer arriving, no temporary file or folder left and a folder that was
there kept, a page going mid-upload leaving nothing, two at once to one new name 200 and 409, the log, a preflight from
another origin and the answer's CORS, `--scenes-readonly` 403); sounds through the stand-in (written in place, run with
`-nostdin`, mono, 44.1 kHz, 96 kbit/s, its input the bytes sent in a temporary file of its own and gone after, its
output a dot file beside where it goes; not `.mp3` 400, 409 then `replace=1`, too big 413; one that fails 422 in our
words, logged shortly with no temporary path and no query; an empty MP3 422; one that never ends stopped after a
shortened `--ffmpeg-limit` with 500, both processes gone and nothing left, a third at once 429 with `Retry-After`
exposed and `retry` in the body; none on the `PATH` and `--no-ffmpeg` 501 while files are still taken;
`--scenes-readonly` 403; a named `ffmpeg` that does not run, `--ffmpeg` without `--scenes` or with `--no-ffmpeg`,
`--max-upload 0`, `--ffmpeg-limit 0` and an `--app` that is not http(s) refused at the start); a real `ffmpeg`, when the
machine has one, making a generated stereo 48 kHz WAV a mono MP3 (its frames read by hand: MPEG-1 layer III, 96 kbit/s,
44.1 kHz, mono); `/upload` (serving the app: `/#studio&upload`; not: the app's address with `ws://<Host>`;
`X-Forwarded-Proto` only with `--proxy`, the `n`-th from the right; `--app` a folder or a page; the `--origin` by
default; no password asked and the query never passed on; a bad `Host` 400; `POST` 405); copies from another scene
(`POST .../copy`: the same bytes at the same path or `as`, its folders made, told at once, 409 then `replace: true`, an
OBJ refused outside `originals/` and taken there, sources no listing shows, targets the upload's rules refuse, the file
onto itself and bad bodies 400 with nothing written, no such scene, file or a folder 404, a link out of its scene 404 and
said, over `--max-upload` 413, no temporary file left, `--scenes-readonly` 403, `GET` 405, the log); the models' pictures
(v120: `previews/<path>.jpg` taken, listed and told with the kind `preview`, served as a JPEG, any other kind or name
under `previews/`, too deep and `Previews/` in another case 400, exactly 200 KB taken and past it 413 by its length and as it streams, nothing left
behind, `--max-upload` elsewhere as before, copies by the same rule); recordings kept as files (v125: `recordings/<name>.json`
taken, listed and told with the kind `recording`, served as `application/json`, a sound there by its own kind, a `.json`
anywhere else, `.JSON`, too deep or a temporary name 400, past the smaller of 4 MB and `--max-upload` 413 by its length and
as it streams, copies by the same rule; with R2 through the relay and straight into the bucket as `application/json`); and the password on
making a scene, a file, a sound and a copy; and the scenes in R2 (`--scenes r2`, against the stand-in S3 `relay/s3fake.mjs`, which checks
every signature; first `relay/test-r2.mjs`, the signer against AWS's published examples byte for byte): the start (the
bucket listed, its CORS rule as a browser meets it), the list and a scene by the same rules with a signed link per file
(its bytes, type, CORS, a range, 304), the redirect for a file and the same refusals, saving with `.history/` (20 kept),
the watch from the relay's writes at once and from changes made straight in the bucket within `R2_POLL`, uploads through
the relay (a scene's marker, 409, the path rules, the size counted, a page going mid-upload, two at once), direct
uploads (the signed PUT, a body of another size or type refused by the bucket, `done` and its checks, 501 with a
folder), copies from another scene by the bucket's CopyObject (its `x-amz-copy-source` signed in the header, the
stand-in refusing one unsigned; nothing fetched by the relay; 409 then `replace: true`, the kinds and paths, a source not
there), the models' pictures there (through the relay and straight into the bucket, `.../put` refusing one over 200 KB,
`done` leaving one over it that no link of the relay's brought, a copy by the same rule, all told as `preview`), `ffmpeg` from the body and from a file in the bucket (`from=`), the password on every endpoint and in no link,
no key or signed link in a log line, the start refusing missing settings (named, no value shown), a wrong key or bucket
and no answer, `--r2-check`, and `tools/studio/r2sync.mjs` (list, pull, push, `--dry`, `--delete`, `--history`); and the
PC's Vive trackers (`--trackers`, v126, with the fake bridge `tools/trackers/fake.mjs`, its SteamVR space turned 37
degrees and moved against the room; `node relay/test.mjs --trackers` runs only these, in seconds): nothing of it without
`--trackers` (no field in `/api/ping`, 404s, no `@trk` for a room that asks); the start line's UDP port, `/api/ping`'s
`trackers` and `trackersSeen`, `GET /api/trackers` (every device with its kind, hand and battery, raw within 0.1 mm of
where SteamVR has it); `/api/trackers/still` (a tracker lying still: its mean within 0.1 mm and about 45 readings in 0.5
s; one going round, one never seen, one nudged 2 cm meanwhile and one losing tracking refused in words; bad asks 400,
`POST` 405); the room's frame from `m` against `shared.js`'s own `fromMarks`, `floorUnder` and `basis` run with three.js
(1,500 points and turns within 1e-9 m; spot A the origin, x to spot B, right-handed; no frame from points under 10 cm
apart, one above the other or not points); a room with `trk` on and `m` written as a room key getting `@trk` about 60
times a second on each member (`by: ''`, `l: 'hand'`, every tracker, the headset and its controllers with their kinds,
never a base station), every pose within 1 mm and 0.05 degrees of the truth and every velocity within 10 mm/s, spot A's
tracker at the origin; nothing for a room without `trk` or with it off; `l: ''` once a second for one on without `m`
or with two points one above the other, and lined up as soon as `m` is written; the bridge silent (once a second, each
tracker `ok` 0, one switched off left out after 5 s, then 60 a second again); bad datagrams and readings ignored,
counted and said in the log, the good reading beside them taken; the password on both endpoints (and in no log line);
`--trackers` in `RELAY_ARGS`; a UDP port another relay holds stopping the start with a sentence; and, when `python3` is
on the machine, `tools/trackers/bridge.py --fake` sending to the relay (its ten devices taken with their kinds and
hands, nothing ignored). It exits
1 on a failure. The shared-room client in the app has its own test (`tools/collab.mjs`).

`node tools/peer.mjs` (Playwright and Chromium, as `tools/smoke.mjs`; seconds) is the end-to-end check: it starts the
relay, opens the peer-to-peer test page from it in two headless pages with `&peer=` pointing at the relay, and checks
that the first hosts, the second gets an id and links to it, the data channel opens and messages go both ways, and
that the host's id is freed when it leaves and the other page takes over. Nothing goes to the internet.

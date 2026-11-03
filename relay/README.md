# The relay (shared rooms)

A small server that lets several headsets and desktop browsers share a room: each sees the same stations
playing the same stories in step (the plan is [docs/shared-space-plan.md](../docs/shared-space-plan.md)). It keeps,
per room, the latest value of every shared state key and passes ephemeral messages (pointer rays, effects) on
without storing them. One file, `server.mjs`: Node 18 or newer, no packages (its own minimal WebSocket code). It
can serve the app as well (`--static .`), so the page and the relay share one address. It is also an introduction
server for devices that link to each other directly (peer to peer, PeerJS's protocol at `/peerjs`; see
[Introduction server for peer to peer](#introduction-server-for-peer-to-peer-peerjs)).

**Where it runs.** On a machine (a laptop will do) on the **same Wi-Fi as the headsets**, or on a public server
(the owner's Coolify) with `--public`. It serves the app too, so every headset and desktop opens one address on that
machine. GitHub Pages serves static files only, so it cannot run the relay; the app keeps working there for everyone
else, and only shared rooms need the relay. Public hosting: [Public hosting on Coolify](#public-hosting-on-coolify).

**No accounts, no passwords: the room code is the secret.** Rooms live in memory: a restart empties them. On a
laptop at an event the relay trusts everyone who can reach it; on the internet `--public` narrows that down (only the
app's pages, no list of rooms or names, limits per address), but a room's code (three letters) is still all it takes
to join it.

**Running a session with headsets:** the checklist is [docs/event-runbook.md](../docs/event-runbook.md); this file
is the reference for the relay itself.

## Running it

```sh
node relay/server.mjs [--lan] [--port 8787] [--host 0.0.0.0] [--static .] [--cert cert.pem --key key.pem] [--proxy [n]] [--public]
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

For a public server ([Public hosting on Coolify](#public-hosting-on-coolify)). Each is off unless given; `--public`
turns on all of them, with the defaults in the second column (a value given on its own wins):

| flag | with `--public` | meaning |
| --- | --- | --- |
| `--public` | | all of the below, and `--logs` only with a log token; no addresses to open on a LAN in the start lines |
| `--origin <list>` | `https://stories.lbi-netmed.com` | only pages from these origins (comma separated, the flag may be repeated; a scheme, a host and an optional port, no path) and the relay's own pages may open a socket (`/api/ws`, `/peerjs`) or use the API and the introduction server over HTTP. The relay's own pages: an `Origin` whose host is the one the request was sent to (`Host`, or with `--proxy` also `X-Forwarded-Host`). Another origin: 403, before any socket. CORS names the allowed origin (`Vary: Origin`) instead of `*`. A request with no `Origin` (the relay's own page asking with GET, the health check, curl) is answered; a socket with none is refused unless `--allow-no-origin` |
| `--allow-no-origin` | off | with an origin rule: also sockets that send no `Origin` (not a browser: tools, scripts) |
| `--unlisted` | on | no list of open rooms (`GET /api/rooms` answers `[]`), no member's name in any answer (`/api/near`: code, people, stations, version; `/api/rooms/<code>`: people as a count) or log line; `/api/ping` says `unlisted: true`. A room's own members still see each other's names (its people list) |
| `--guesses <n>` | 30 | per address, at most `n` lookups a minute of room codes that do not exist (a burst of `2n`): a socket for an unknown room, `GET /api/rooms/<code>` answered 404, `POST /api/rooms` with a code that is taken (409). Past that, every lookup of a code from that address is refused, a known one too (or the answers would say which codes exist), until the budget fills again: 429 with `Retry-After`, or on a socket `error` `limit` and close 4029. A member coming back (its id still in the room) is let in |
| `--creates <n>` | 10 | per address, at most `n` new rooms a minute (a burst of `2n`), then 429 |
| `--sockets <n>` | 64 | per address, at most `n` open sockets, rooms and the introduction server together (`error` `busy`, or PeerJS's `ERROR`, close 4029) |
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
  crosses for 30 s ("Check the marks"). If the panel says **Leave AR and enter it again** (the headset does not
  find its anchors in the same session after standby, `marks lost` in the log), do that: a new AR session finds
  the marks at once. If the crosses are still not on the tape, press **Calibrate** and please send the logs. Lined up through the shared space (no tape), it holds the room where the headset says it moved until the
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
web pages do (eduroam, a hotspot, at home), and the copy of the app on GitHub Pages (`https://stories.lbi-netmed.com/`)
can use it. Peer to peer stays the fallback when it is down. On the internet anyone can reach it, so it runs with
`--public` (below: what that changes and why). Nothing here changes how it runs on a laptop.

**Before you start:** a DNS name for it (here `rooms.lbi-netmed.com`; any subdomain will do), Coolify on a server
with a public address and its proxy (Traefik or Caddy) running, and access to this repository from Coolify.

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
   - Logs stay off (they are off unless asked for), and that is right for now: the app sends no log token, so a
     public relay could not take a headset's alignment log anyway. To turn them on later (for a test that needs two
     headsets' numbers): a second variable **`RELAY_LOG_TOKEN`** = a long random string (`openssl rand -hex 24`; at least
     16 characters; only in Coolify, never in the repository), `--logs <dir>` added to `RELAY_ARGS` with `<dir>` on a
     *Persistent Storage* volume the user `node` may write to (a redeploy deletes the container's own files), and
     `shared.js` sending the token as `X-Log-Token`. The relay refuses to start with `--public --logs` and no token.
7. **Limits.** Under *Resource Limits*: memory **512 MB** (`512m`; swap the same), CPUs 1 is plenty. Node sizes its
   heap to the container's limit; the rooms hold at most 64 MB of data together (`--store`), so a limit stops a flood
   of large rooms from taking the server down with it. **Restart policy**: Coolify's containers restart unless stopped (its
   default); keep it, so a relay that ran out of memory comes back by itself (a restart empties the rooms; the
   pages in them bring them back within seconds).
8. **Health check.** The image has its own (`GET http://127.0.0.1:8787/api/ping` every 30 s; a `/api/ping` with no
   `Origin` is answered with `--public` too). Leave Coolify's *Healthcheck* tab off, or point it at path `/api/ping`,
   port `8787`.
9. **Deploy, and keep it in step.** Press **Deploy** and watch the logs. The start lines should read
   ```
   relay listening on http://0.0.0.0:8787, serving /app (protocol 1)
   Introduction server for peer to peer (PeerJS) at /peerjs, key peerjs (--no-peer turns it off)
   Behind a reverse proxy: a client's address is the last one in X-Forwarded-For (rooms on this network)
   Only pages from https://stories.lbi-netmed.com and the relay's own may open a socket or read the API (...)
   No list of open rooms and no names in any answer: a room is joined by its code, a link or on its network
   Per address at most 30 lookups of unknown room codes a minute (a burst of 60), 10 new rooms a minute (...), 64 open sockets
   All rooms together hold at most 64 MB
   ```
   Then turn on **Auto Deploy** in the resource's settings (with a public repository Coolify needs a webhook: copy
   the GitHub webhook address and secret from the resource's *Webhooks* page into the repository's *Settings* >
   *Webhooks*, content type `application/json`, push events; with the GitHub App it needs nothing more). Every push to `main` then rebuilds the relay, so it
   serves the same app as GitHub Pages and accepts its rooms (a room refuses another `FORMAT`). Each deploy restarts
   the relay: open rooms empty and come back from the pages within seconds; avoid pushing during an event.
10. **Test it.**
    - `curl -s https://rooms.lbi-netmed.com/api/ping` answers `{"now":...,"proto":1,"net":"...","unlisted":true}`;
      run it from two different networks (a phone on mobile data): `net` differs, so `--proxy` is right.
    - `curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://evil.example' https://rooms.lbi-netmed.com/api/ping`
      prints `403`; with `-H 'Origin: https://stories.lbi-netmed.com'` it prints `200` and the answer carries
      `Access-Control-Allow-Origin: https://stories.lbi-netmed.com` (`curl -si ...`).
    - `curl -s https://rooms.lbi-netmed.com/api/rooms` prints `[]`, even while a room is open.
    - The app on GitHub Pages with the relay: open `https://stories.lbi-netmed.com/#stories&relay=wss://rooms.lbi-netmed.com`
      on a laptop (the page remembers the relay; the Shared dialog's relay field takes the same address). **Shared** >
      **Start a room**: its status says it is on the relay. On a second device on the same Wi-Fi the room shows under
      *Rooms on this network* (with its people as a count, no name); on a device elsewhere join it by its code or by
      the room's link (`https://stories.lbi-netmed.com/#s=XYZ&relay=wss://rooms.lbi-netmed.com`).
    - The relay's own copy of the app: `https://rooms.lbi-netmed.com/` (the same app, from the relay; a headset can use
      it as at an event, with a real certificate this time).
    - In a headset: the same link in Quest Browser, then Enter VR or AR, and two headsets in one room.

Once it is up, the app's default relay can be set to this address (in `shared.js`), so the GitHub Pages copy uses it
with no setup: the integrator does that, not this file. Pages that saved another relay keep theirs.

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
  in, and a determined person with many addresses is slowed down, not stopped. A PIN (set in Coolify, asked once per
  page) would be the next step; the owner set it aside for now (HANDOVER.md).
- **Limits per address** (`--creates 10`, `--sockets 64`) and **for everything** (`--store 64`, besides the 2,000
  rooms, 4 MB a room and the message rates every relay has): so that one address cannot use up the relay for everyone.
- **Logs only with a token** (`--log-token`, `RELAY_LOG_TOKEN`): logs are files written on the server by anyone who
  can reach `/api/log`, and they carry names.

**Untested until it runs on Coolify** (everything above was tested on one machine: `node relay/test.mjs`, the image
built and run with `--proxy 1 --public`, the app in Chromium from the relay and from an allowed and a refused origin):
the certificate and `wss://` through Coolify's proxy, the proxy's `X-Forwarded-For` (that `net` differs between
networks and the limits fall per device's address, not the proxy's), whether the proxy passes `Host` or
`X-Forwarded-Host` so the relay's own pages are recognised (if not, they get 403: add `--origin
https://rooms.lbi-netmed.com`), auto deploy, the memory limit in practice, and headsets in a room over the internet
(eduroam and hotspots may block or slow WebSockets).

A redeploy restarts the relay and empties its rooms. The image (`node:22-alpine`, about 8 MB of app) runs as the
user `node`; `docker build -f relay/Dockerfile -t networks-relay .` and `docker run -p 8787:8787 networks-relay` run it
locally as on a laptop (no `--public`), and `docker run -p 8787:8787 -e RELAY_ARGS='--public' networks-relay` as on the
server.

## HTTP API

All under `/api/`, JSON, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *` (preflights: 204). With an
origin rule (`--origin`, `--public`): `Access-Control-Allow-Origin` is the asking page's origin when it is allowed
(`Vary: Origin`), and a request from any other origin gets 403 `{ error: 'origin not allowed' }` (its preflight too);
a request with no `Origin` is answered (the relay's own page, the health check, curl). Preflights allow the headers
`Content-Type` and `X-Log-Token`.

| request | answer |
| --- | --- |
| `GET /api/ping` | `{ now, proto, net }`: relay time (ms), protocol number (1) and the asker's network id (see [Rooms on this network](#rooms-on-this-network)); with `--watch` also `watch: true`; with `--unlisted` (`--public`) also `unlisted: true` (no list of open rooms here) |
| `GET /api/near` | `{ net, rooms: [{ code, name, members, stations, version }] }`: the rooms on the asker's network, those with people first (at most 20): `name` the first member's (by when they came), `members` a count. Never an address; with `--unlisted` no `name` either |
| `GET /api/watch` | with `--watch`: a stream of Server-Sent Events (see [Hot reload](#hot-reload---watch)); 404 without, 503 at 200 pages |
| `POST /api/rooms` `{ app, version, code? }` | 201 `{ code }`: a new room, 3 letters A-Z. With `code`, that code if it is free (409 `{ error: 'taken' }` if not): how a client brings back its room after a relay restart. 400 for a body that is not JSON or a bad code, 413 over 16 KB, 503 at 2000 rooms. With `--creates`: 429 (`Retry-After`) past an address's new rooms; a chosen `code` is also a lookup (`--guesses`: 409 counts, 429 past the budget) |
| `GET /api/rooms` | `[{ code, members, names, stations, idle, version }]`: `members` a count, `names` theirs, `stations` how many `st.<id>` keys, `idle` seconds since the last member left (0 while anyone is in). With `--unlisted` (`--public`): `[]` |
| `GET /api/rooms/XYZ` | `{ code, app, version, created, seq, idle, members, keys }` (for debugging; a page asks it before it joins a room again by itself, or brings one back), or 404. With `--unlisted`, `members` is a count. With `--guesses`, a 404 is a lookup of an unknown code, and past the budget any code gets 429 (`Retry-After`) |
| `POST /api/log` `{ room, id, name, kind, entries }` | with `--logs` (or `--lan`): `entries` (objects, at most 2000) appended as JSON lines to `<logs>/<day>-<room>-<name>-<id>.jsonl`; 200 `{ lines }`, 400 for a bad body, 429 more than once a second per member, 507 over 20 MB a file; 404 without `--logs`. With a log token (`--log-token`, `RELAY_LOG_TOKEN`; `--public` needs one for `--logs`): only with the header `X-Log-Token`, 404 without it (as if logs were off: the page stops sending), 403 for a wrong one |

With `--static <dir>`, every other path may be a file of the app, and only that: `index.html` (also at `/`),
`shared.js`, `sw.js`, `manifest.webmanifest`, `three.min.js`, `three.LICENSE.txt`, `proteins.html`,
`spatial.html`, `README.txt`, `peerjs.min.js`, `PEERJS-LICENSE.txt`, `version.json` (the release's version file, for
live updates: sent with `Cache-Control: no-store`), `lowpoly.js` (the miniatures), and the files directly in `stories/`, `audio/`,
`icons/` and `p2p/` (the peer-to-peer test page, at `/p2p/`: a path ending in `/` is that folder's `index.html`)
(`APP_FILES` and `APP_DIRS` in `server.mjs`: add to them when the app needs a new file or folder). Everything else is 404: the
authors' data (`ikerdata/`), `tools/`, `docs/`, the relay itself, folders (no listings), anything whose path has
a part starting with `.` (no `..`, no `.git`), and links that lead out of those files. `GET` and `HEAD`. `Cache-Control: no-cache` with `ETag`/`Last-Modified` (304 when unchanged, as the
service worker expects), gzip for text when asked, single byte ranges on every file (206; 416 when
unsatisfiable; the narration's `<audio>` element asks for them), types for `.html .js .mjs .json .webmanifest
.css .txt .md .svg .png .jpg .webp .ico .gif .mp3 .ogg .wav .mp4 .wasm .woff2 .glb .pdf`. Without `--static`,
`/` answers a line of text.

## Hot reload (`--watch`)

While you work on the app, `node relay/server.mjs --static . --watch --build` (or `--lan --watch --build` for
headsets) makes every page and headset it serves follow your edits (index.html's `HOST.live`; AGENTS.md "Hot reload
and live updates"). The page asks `/api/ping`; when it says `watch: true` it opens `/api/watch`, a stream of
Server-Sent Events (`text/event-stream`, `Cache-Control: no-store`, `retry: 2000`, a comment line every 20 s):

| event | data | the page |
| --- | --- | --- |
| `hello` | `{ shell: { 'index.html': fp, 'shared.js': fp, 'sw.js': fp, 'three.min.js': fp, 'peerjs.min.js': fp }, stories: { <key>: fp }, list: fp, build }`, at once on every connection | the first: the shell as it is; after a lost connection (the relay restarted, the laptop slept): a shell file changed meanwhile reloads, a story changed meanwhile is swapped or marked, the list is read again |
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
| `limit` | `--guesses`: this address looked up too many unknown room codes in the last minute (the room asked for may exist) | closed, 4029: try again in a minute |
| `busy` | `--sockets`: this address has too many sockets open | closed, 4029: try again when one has closed |

Broken WebSocket frames close the socket with the RFC 6455 codes: 1002 (unmasked frame, reserved bits,
bad control frame or continuation, unknown opcode), 1003 (binary message), 1007 (not UTF-8), 1009 (a
message over 1 MB, refused as soon as its header says so). 1001: the relay is stopping. With an origin rule
(`--origin`, `--public`), a socket from a page of another origin, or with no `Origin` at all unless
`--allow-no-origin`, gets HTTP 403 instead of the upgrade.

**Liveness.** The relay pings every member over WebSocket every 20 s; any frame counts as life, so a browser's
automatic pong keeps an idle member in. A member silent for 40 s is dropped (`timeout`). A room is deleted
6 hours after its last member left (or after it was made, if nobody joined).

**A restart** empties the rooms. A client whose room has gone (`room` on reconnecting) can make it again
under the same code (`POST /api/rooms` with `code`) and fill it from its own state.

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
4029). It stays on: peer to peer is the fallback when the relay is away.

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
| server | `INVALID-KEY` | a key other than `peerjs`; closed (4003) |
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
and taken codes from one budget; past it a known code refused too, with `Retry-After` or `limit` and 4029; a member
coming back let in; another address, an IPv6 address in another /64 and the address `--proxy` takes not held up; one
budget for everyone without `--proxy`), sockets per address (rooms and `/peerjs` together) and new rooms per address
capped, the log token (refused at the start without one or with a short one; from `RELAY_LOG_TOKEN` or `--log-token`;
none 404, wrong 403, never in the log) and `--store`. It exits 1 on a failure. The shared-room client in the app has
its own test (`tools/collab.mjs`).

`node tools/peer.mjs` (Playwright and Chromium, as `tools/smoke.mjs`; seconds) is the end-to-end check: it starts the
relay, opens the peer-to-peer test page from it in two headless pages with `&peer=` pointing at the relay, and checks
that the first hosts, the second gets an id and links to it, the data channel opens and messages go both ways, and
that the host's id is freed when it leaves and the other page takes over. Nothing goes to the internet.

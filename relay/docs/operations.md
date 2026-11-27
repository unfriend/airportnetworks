# The relay: operations

<!-- toc (tools/docs/toc.mjs) -->
- 23: A session on one Wi-Fi, step by step (15.4 KB)
- 196: Public hosting on Coolify (20.3 KB)
  - 311: The test place on Coolify (9.1 KB)
- 408: Your own scenes (the studio) (23.5 KB)
  - 524: Uploading (the upload page) (10.2 KB)
  - 607: Converting a video (2.8 KB)
- 632: Scenes in Cloudflare R2 (19.8 KB)
  - 711: The owner's steps (12.0 KB)
- 840: The PC's Vive trackers (`--trackers`) (6.5 KB)
- 910: OSC and the output page (`--osc-out`, `--osc-in`) (7.4 KB)
- 989: Live sound (from the output page, v162) (3.6 KB)
- 1028: Talk (v178) (5.7 KB)
- 1084: The developer notebook (`--notes`, `--no-notes`) (4.4 KB)
- 1126: Shared networks (`--nets`, `--no-nets`, v208) (4.9 KB)
- 1180: Hot reload (`--watch`) (2.4 KB)
<!-- /toc -->

How to run the relay for a session and in public, and what each of its optional parts needs: a session on one Wi-Fi, public hosting, the studio's scenes, R2, the trackers, OSC, live sound, Talk, the notebook, shared networks and hot reload. How to start it and its password are in [the relay's README](../README.md).

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
   marks (that never depends on the shared space). See [docs/shared-spaces.md](../../docs/shared-spaces.md).
4. Two marks for calibration: two crosses of tape on the floor or a table, a metre or more apart (at least
   50 cm; the further apart, the better the room lines up). Mark A is the room's origin.
5. Floor space: Arrange all needs about 17 m wide and 4 m deep for the main stories (two rows of about eight, the second right behind the first,
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
   then **Arrange all** puts the main stories (not the Experiments) as stations in two rows (about eight, and as many behind them) in front of you (or one story where you
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
   - **`COLLAB_TOKEN`** = the shared password ([The shared password](../README.md#the-shared-password-collab_token)), a second
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
     reads them back, so the pages still open simply reconnect to their room ([Rooms across updates](protocol.md#rooms-across-updates-v136)).
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
   it reloads into the new version at once ([Rooms across updates](protocol.md#rooms-across-updates-v136)); avoid pushing during an
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

**What `--public` changes, and why** (each flag on its own in [Running it](../README.md#running-it)):

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
password](../README.md#the-shared-password-collab_token)). The files are your own work, not the app's, so `--public` with
`--scenes` refuses to start without a password. On Coolify: a *Persistent Storage* volume the user `node` may write to
(say at `/scenes`), and `--scenes /scenes` added to `RELAY_ARGS` (or `COLLAB_SCENES=/scenes`); or, with no volume, the
scenes in a Cloudflare R2 bucket (`--scenes r2`: [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2)).

| request | answer |
| --- | --- |
| `GET /api/scenes` | `{ scenes: [{ name, files, bytes, at, layout }], save, upload, ffmpeg, maxUpload }`: by name; `files` how many, `bytes` their size, `at` the newest file's time (ms), `layout` whether it has a `layout.json`; `save` and `upload` false with `--scenes-readonly`; `ffmpeg` whether long sounds are made MP3 here; `video: true` and `videoLimit` (its time limit in seconds) only where videos can be converted here (ffmpeg with the H.264 and AAC encoders); `maxUpload` the most one upload may be, in bytes ([Uploading](#uploading-the-upload-page)) |
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
| `POST /api/scenes` `{ "name": "<name>", "from": "<scene>" }` (`from` optional, v167) | 201 `{ ok: true, name }`: the scene's folder made (empty). 400 for a name that cannot be a scene's (the rule above, and not `watch`) or a body that is not `{ name }`; 409 when a scene, or a file, of that name is there; 413 over 16 KB; 507 at 200 scenes. With `from` (the studio's *Duplicate scene*): a copy of that scene (404 when there is none), every file its listing shows copied in as `.../copy` copies one (the same checks; with R2 by CopyObject), then its saved `layout.json` as it is (locked items stay locked); its `.history/` and `files.json` are not copied. 201 `{ ok: true, name, from, files, failed }`: `files` how many were copied, `failed` the paths that were not (the copy is kept, never removed half made). The log says `scenes: <name>: a copy of <scene> (<n> files)` |
| `POST /api/scenes/<name>/file?path=<path>[&replace=1]` | the body's bytes as the file at `path` in the scene: 200 `{ ok: true, path, bytes, at }` (`at` its time, as the listing says). The folders of the path are made as needed |
| `POST /api/scenes/<name>/sound?path=<path>.mp3[&replace=1]` | a sound's bytes (any format `ffmpeg` reads: WAV, FLAC, AIFF, MP3, M4A, OGG...), written by `ffmpeg` as a mono MP3 at 96 kbit/s and 44.1 kHz at `path` (which must end in `.mp3`; the studio sends `sounds/<name>.mp3`): 200 `{ ok: true, path, bytes, at }`. 501 when the relay has no `ffmpeg`; 429 (`Retry-After: 5`, and `retry: 5` in the body, since a page on another origin cannot read the header otherwise) while two are being made already; 422 when `ffmpeg` could not make an MP3 of it (not a sound) or made an empty one; 500 when it took longer than `--ffmpeg-limit` (it is stopped) |
| `POST /api/scenes/<name>/video?path=<path>.mp4&h=720\|1080[&from=<a file there>][&orig=<originals/...>][&replace=1]` (v143) | a video made an H.264 MP4 as a job: [Converting a video](#converting-a-video) |
| `GET /api/scenes/<name>/jobs/<job>` | the job's state: `{ job, state: 'queued' \| 'running' \| 'done' \| 'failed', pct, error, path, bytes, at }` |
| `POST /api/scenes/<name>/copy` `{ "from": "<scene>", "path": "<its path there>", "as": "<its path here>", "replace": true }` (v118; `as` and `replace` optional) | one file of another scene copied into this one (the studio's Add pane, *From another scene...*: each scene keeps its own copy): 200 `{ ok: true, path, bytes, at }`, as an upload. The source must be a file the scene `from` lists (not its `layout.json` or `files.json`, no dot file, nothing in `.history/`; a link out of its folder is no file), at most `--max-upload` (413); where it goes (`as`, else the same path) keeps to the upload's rules below, 409 when a file (or a folder) is there unless `replace: true`, 507 when the scene is full. 404 for no such scene (either one) or file; 400 for a bad body, a source no listing shows, a target the rules refuse, or the file onto itself. A folder's copy goes into a temporary dot file beside where it goes and into place in one step, as an upload's; with R2 the bucket copies the object itself (CopyObject: nothing passes through the relay; see [Scenes in Cloudflare R2](#scenes-in-cloudflare-r2)). The log says `scenes: <name>: copied <path> from <scene>/<path>` |

**The paths** (`uploadPath` in `scenes.mjs`): relative, with `/`, at most 200 characters and 4 folders deep (so under
`originals/` a dropped folder keeps 3 levels of its own), no empty part, no part starting with a dot (`..`,
`.history/`, dot files) or named as a temporary file (`~`, `.tmp`, `.part`...: the listing would leave it out), no
backslash, control character or `: * ? " < > |`, no part ending in a space or a dot and no Windows device name (`con`,
`nul`, `com1`...), so a scene copied to another computer stays whole; never `layout.json`, `files.json` or `index.json`
at the scene's top. Outside `originals/` only the listing's models, sounds, videos (`.mp4 .m4v .mov .mkv`, kind `video`, served as `video/mp4`, `video/x-m4v`, `video/quicktime` and `video/x-matroska`; a `.webm` stays a sound, and a screen takes either), images and data (`.bin`); under
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

**From a folder on your computer** (`tools/studio/push.mjs`, Node's own modules, as the relay): `node
tools/studio/push.mjs <scene folder> <relay> [--as <scene>] [--replace] [--dry]` sends one scene folder as it is, by
the requests above: nothing is converted again (it is for GLBs, sounds and pictures already made, by an importer for
instance), the scene is made when it is not there (named after the folder, or `--as`), exactly the files the listing
would show are sent (the same rules, `relay/scenes.mjs`), each checked by `uploadPath` first, and `layout.json` last, so
the studio never reads a layout before its files. A file the relay has at the same size is skipped; one that differs,
and a `layout.json` the relay already has (perhaps saved in the studio since), are kept there unless `--replace` (the
relay keeps the old layout in `.history/`). `--dry` says what it would send. The password is asked for in the terminal
without being shown (piped input: its first line), or taken from `COLLAB_TOKEN`; it goes only into the `Authorization`
header, never into a URL or the output.

### Converting a video

*(v143, optional, off in the studio unless the Upload pane's option is on; `node relay/test.mjs --video` tests it.)* A screen
in the studio plays MP4 (H.264) most surely, so the relay can make one of any video `ffmpeg` reads:
`POST /api/scenes/<name>/video?path=videos/<name>.mp4&h=720` (or `1080`, the default; the most its height may be, never
larger) with the video as the body, or `&from=<a file already in the scene>` instead of a body (the way a page sends a big
file straight into R2 first). The result is H.264 (`-preset veryfast -crf 23`, `yuv420p`, width kept even), AAC 128 kbit/s
(a video with no sound is fine), `+faststart` (its index first, so it starts playing before it has all come), no tags,
written to `path` (which must end in `.mp4`) as an upload is. A body is first kept as the original under `originals/`
(`&orig=<originals/...>`, else `originals/videos/<name>.source`; a `from=` file stays where it is); `&replace=1` allows
both paths to be taken.

It is a job: **202 `{ ok, job }`** once the body is in and the original kept, then
`GET /api/scenes/<name>/jobs/<job>` says `{ state: 'queued' | 'running' | 'done' | 'failed', pct, error, path, bytes, at }`
(`pct` from ffmpeg's own progress and the video's duration). One is made at a time, at most 8 wait (a ninth: 429 with
`Retry-After: 60`); jobs are forgotten an hour after they end, and when the relay restarts (404). When it is done the
scene's watch tells the new file (`scene` event, kind `video`); `failed` carries our words (*ffmpeg could not make an MP4 of
it (is it a video?)*, *making the MP4 took more than N s*), never ffmpeg's. `--ffmpeg-video-limit <s>` (1800) stops one
that takes longer. 501 without an ffmpeg that has the `libx264` and `aac` encoders (`GET /api/scenes` has no `video`),
403 with `--scenes-readonly`, 400 for a path that is not `.mp4`, an `h` that is not 720 or 1080, a `from=` or `orig=` that is
not right, 404 for no such scene, 409 for a path taken, 413 past `--max-upload`. ffmpeg reads only the file given (never a
playlist: `-protocol_whitelist file`, and ffmpeg's mov/mp4 demuxer leaves external data references off by default, `enable_drefs` false, so a file cannot make it read another local file), as for sounds. A job is queued only once its whole body has arrived (a slow upload never lets ffmpeg start on half a file). Videos are untrusted input to a real decoder: only holders of the relay's password may send them (set `COLLAB_TOKEN` on any relay that is reachable beyond your own network). With R2 the original goes into the bucket and the result is put there as every upload is
(a `from=` file is fetched to a temporary folder first); nothing is left behind either way. Untested: a long video on a small
relay (the CPU it takes: about one core, a few seconds per second of 1080p on a laptop), and Quest Browser playing the result.

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
PC, and the relay sends them to the rooms that use them, lined up with the room. Setting it up: [tools/trackers/README.md](../../tools/trackers/README.md);
the contract between the parts: [tools/trackers/SPEC.md](../../tools/trackers/SPEC.md). The code: `relay/trackers.mjs`.

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

## OSC and the output page (`--osc-out`, `--osc-in`)

The output page (`output.js`: a computer's page opened in a room with `&output`, or from the Shared dialog; its setting
up is `tools/output/README.md`, the contract `tools/output/SPEC.md`) follows a studio circle and sends what happens there
as MIDI and OSC, and takes MIDI and OSC back as room actions. MIDI it does itself (the browser's Web MIDI); OSC is UDP,
which a page cannot speak, so it hands its OSC messages to the relay over its room socket, and the relay sends and takes
the UDP. Run the relay on the same machine as the programs that take the OSC (or on their network):

```sh
node relay/server.mjs --lan --trackers --osc-out 127.0.0.1:9000 --osc-in 9001
```

- `--osc-out <host:port>`: where the OSC goes. Repeatable and comma separated (`--osc-out 127.0.0.1:9000,192.168.1.20:7000`),
  at most 8 targets; `host` an IPv4 address or a name (looked up once as the relay starts, again after a send error, at
  most once every 10 s). Every message goes to **every** target alike, as one datagram, from one UDP socket on a port
  the system picks. Nothing else is ever sent anywhere: the targets are only the ones on the command line.
- `--osc-in <port>` or `--osc-in <addr:port>`: take OSC on that UDP port (on `127.0.0.1`, this machine only, unless an address is given;
  `0` picks a free one, which the start line and `/api/ping` say). Each packet that comes in goes to every output page in
  every room on the relay. UDP has no password, so OSC from another machine needs the address said: `--osc-in
  0.0.0.0:9001` (then anything on the network that can reach the port can press, start and show in every room).
- With `--trackers` too: the trackers go as OSC themselves, lined up, for the room whose output page asks (its
  *Trackers as OSC* switch), straight from the relay at the bridge's rate (below).
- Both work in `RELAY_ARGS` too. A port in use for `--osc-in` stops the start with a sentence (as `--trackers`).
- **The password.** With `--public` and no password (`COLLAB_TOKEN`, `--token`) either flag stops the start: OSC sends
  and takes UDP on the machine's network, and nobody else should drive it. The output page's socket brings the password
  as every page's does (`?token=`); nothing of OSC carries it or writes it down, and no log line says a message's
  contents, a target in an answer, or a member's address. The start line names the targets (it is the relay's own
  console).
- Start lines: `OSC: out to 127.0.0.1:9000, 192.168.1.20:7000; in on UDP 127.0.0.1:9001 ...` and, with `--trackers`,
  `OSC: the trackers go as OSC (/room/tracker/<serial>), lined up, for the room whose output page asks for them`.

**What goes where.**

| From | Message | To |
| --- | --- | --- |
| the output page | `{ t: 'osc', m: [[address, types, ...args], ...] }` (1 to 128 messages, the frame at most 64 KB) | each message one datagram to every `--osc-out` target |
| a UDP packet on `--osc-in` | `{ t: 'fx', k: '@osc', v: { at, m: [[address, types, ...args], ...] }, by: '' }` (`at` the relay's ms as it came; a bundle's messages flattened) | every member whose hello said `out: 1`, in every room |
| the output page | `{ t: 'osc-cfg', trk: true \| false }` | the trackers as OSC for its room on or off; answered at once with a status |
| the relay | `{ t: 'fx', k: '@osc', v: { st: { out, in, trk, sent, got, dropped } }, by: '' }` | to an output page after its `osc-cfg` and every 2 s while it is connected |
| the bridge's datagrams (`--trackers`) | `/room/tracker/<serial>` `fffffffis` and every 2 s `/room/tracker/<serial>/name` `s` | every `--osc-out` target |

- **Who may.** Only a member whose `hello` said `out: 1` (the output page) may send `osc` or `osc-cfg`; anyone else is
  refused once as `bad` (and then ignored silently). The relay keeps `out` and adds `out: 1` to that member in the
  members list. A member cannot send `@osc` of its own (`@` is not in a key a member may use: refused as `bad`).
- **Messages out** (the page's): `address` `/` and printable characters without spaces, at most 256 in all; `types`
  letters of `ifsTFN` (no comma), at most 32; one argument per `i` (an integer within 32 bits), `f` (a finite number
  within float32's range) or `s` (a string, at most 256 characters, no NUL), none for `T`, `F`, `N`. Encoded as OSC 1.0
  (`relay/osc.mjs`: NUL-padded strings, big-endian int32 and float32). A bad message is dropped and counted, the rest
  sent. With no `--osc-out` they are dropped silently (counted). At most 2,000 messages a second from one member (a fixed
  one-second window); the rest dropped, counted and said in the log at most once a second, as a count.
- **Messages in** are normalised: `i` (`i`, and `h` within a safe integer), `f` (`f`, `d`, and an `h` beyond), `s` (`s`,
  `S`, `c`), and `T`, `F`, `N`, `I` with no argument. Bundles are flattened (nested to depth 4; timetags ignored: a
  message is taken as it comes). A packet with any other type (`b` blobs, `t`, `r`, `m`, arrays), a float that is not a
  number, or a bad layout is dropped whole and counted. At most 500 `@osc` a second to one member; one whose socket holds
  more than 256 KB unsent is skipped (as `@trk`).
- **The status** `st`: `out` the number of targets, `in` the UDP port (0 none), `trk` for that page: `'off'` (not asked,
  or no `--trackers` or no `--osc-out`), `'on'` (sending for its room), `'none'` (the bridge silent for 5 s),
  `'unaligned'` (its room's `trk` not on or not lined up), `'other'` (another room's output page asked after it: one
  room's trackers at a time, the latest page still connected that asked). `sent` and `dropped` count its room's
  messages (sent on UDP, the trackers' among them; dropped as bad, over the rate, with no target, or not handed to a
  backed-up page), `got` the messages that came in on `--osc-in` since the relay started.
- **The trackers as OSC.** On every datagram from the bridge (at most 120 a second), one message per device seen in the
  last 5 s (the trackers, the Index and its controllers; never base stations): `/room/tracker/<serial>` with x, y, z,
  qx, qy, qz, qw in the room's coordinates (metres, floor at y = 0), exactly as `@trk` turns them from the room's `trk`
  key (`trk.on` and `m` lined up: [The PC's Vive trackers](#the-pcs-vive-trackers---trackers)), then `ok` (1, or 0 once
  the reading is 0.5 s old) and its kind (`'t'` a tracker, `'h'` the headset, `'l'` and `'r'` its controllers); every 2 s
  also `/room/tracker/<serial>/name` with its name from `trk.names` (`''` none). SteamVR's own space is never sent. A
  room not lined up gets nothing (its page's status says `'unaligned'`).
- `GET /api/ping` gains `osc: { out, in, trk }` (the number of targets, the UDP port or 0, whether `--trackers` is on)
  only when `--osc-out` or `--osc-in` was given; never a target's address.
- Peer-to-peer rooms and rooms on one device have no relay, so no OSC (the output page says so; its MIDI still works).

The addresses the output page sends and takes (the studio's events, people, items, streams; `/studio/press` and the
rest coming in) are tools/output/SPEC.md's Wire 4: the relay passes every message as it is and reads none of them.

Untested until tried on the owner's machines: OSC to real programs (TouchDesigner, Max, Pd), UDP through Windows'
firewall (allow Node on private networks for `--osc-in`), a name looked up on a real network, and the trackers' OSC rate
on the PC with SteamVR. Here: only UDP on 127.0.0.1 with the fake bridge (`node relay/test.mjs --osc`).

## Live sound (from the output page, v162)

The output page can stream one sound input of its computer to the room (its switch *Stream sound to the room*; setting
it up: tools/output/README.md, *Live sound*). It encodes the sound as Opus in 20 ms frames (about 320 bytes each at 128
kbit/s, 50 a second) and sends each frame as a **binary WebSocket frame** on its room socket; the relay forwards it, once,
to every member of that room that asked for it, and keeps nothing. No flag: every relay of v162 or later does it, and
says so (`snd: true` in `/api/ping`, `snd: 1` in `welcome`); a page on an older relay says the relay is too old.
Relay rooms only: peer-to-peer rooms and rooms on one device have no live sound. The contract is tools/output/SPEC.md,
"v162: live sound from the output page".

- **A frame** is 16 bytes of header, big-endian, then one Opus packet: `tag` u8 (1), `ch` u8 (1 or 2), `sid` u16 (the
  sender writes 0; the relay writes the stream's id), `seq` u32 (from 0 at each start), `at` f64 (when its first sample
  was captured, on the relay's clock, ms). At most 4,016 bytes in all (`SND_MAX_FRAME`); smaller than 17 or larger, or
  another tag: dropped and counted as bad.
- **Messages** (text, as ever):

| from | `t` | fields | meaning |
| --- | --- | --- | --- |
| the output page | `snd-start` | `cfg { codec: 'opus', sampleRate, numberOfChannels, description? }`, `kbps?` | starts (or restarts) the room's stream; `sampleRate` 8000, 12000, 16000, 24000 or 48000, 1 or 2 channels, `description` base64 (at most 512 characters); `kbps` 8 to 256, shown to listeners only |
| the output page | `snd-stop` | | stops it |
| any member | `snd-sub` | `on: true \| false` | hear the room's stream, or not; a new socket starts without it (the page asks again on `welcome`) |
| relay | `fx` `@snd` (`by: ''`) | `{ on: true, sid, cfg, kbps, by }` / `{ on: false, sid, why }` | to the members that asked: a stream started (and at once to one that asks while it runs) or stopped (`why`: `stopped`, `gone`: the sender left or is no longer the output page, `taken`: another output page started) |
| relay | `fx` `@snd` (`by: ''`) | `{ st: { on, mine, sid, subs, frames, bytes, dropped, bad, why } }` | to the sender on each change and every 2 s (`subs`: its listeners now), and to an output page whose stream was taken (`mine: false`, `why: 'taken'`) |

- **One sender a room**: the latest output page that sent `snd-start`. The one before is told `taken`, and its frames are
  dropped from then on (it stops by itself).
- **Limits.** At most 100 frames a second a sender (`SND_RATE`; the rest dropped and counted). A listener whose socket is
  closing or backed up past 64 KB (`SND_BACKLOG`) misses frames rather than queueing them: late audio is worth nothing.
- **Who may send.** Only a member whose `hello` said `out: 1`: a binary frame from a socket that never did closes it
  with 1003 (as before v162); `snd-start` and `snd-stop` from a plain member are refused once a socket (`bad`). A sender
  whose hello drops `out`, or who leaves, ends its stream (`gone`). A frame with tag 2 is Talk's ([Talk](#talk-v178)),
  from any member: one without a Talk stream is dropped and counted, never closed.
- **Never kept or logged**: no frame's bytes and no cfg's description. The log says `<room> live sound from <id> started
  (<ch> ch, <rate> Hz)`, `... stopped (<why>)`, and the counts of dropped and bad frames when they change.

Untested until tried on real machines: real loopback inputs (BlackHole, VB-Audio Cable), latency and dropouts over a real
network and Wi-Fi, and how it sounds. Here: `node relay/test.mjs --snd` (the relay) and `node tools/output/test-page.mjs`
(the output page with a stubbed input).

## Talk (v178)

Voice between the people in a room who are **not** in the same physical room. A person's page or headset with *Talk* on
hears the others who talk, and while its *Mic* is on it sends its microphone: open mic with a voice gate (nothing goes
while the person is silent), never push to talk. Each 20 ms of voice is one Opus packet (mono, 24 kbit/s, about 60 bytes:
50 frames a second while someone speaks, none while they are silent) sent as a **binary WebSocket frame** on the member's
room socket; the relay forwards it, once, to every member of the room that should hear it, and keeps nothing. No flag:
every relay of v178 or later does it, and says so (`talk: true` in `/api/ping`, `talk: 1` in `welcome`); a page on an
older relay says the relay is too old for Talk. Relay rooms only: peer-to-peer rooms and rooms on one device have no Talk.
Talk is each device's own (off until turned on), never in the room's keys. The contract is docs/agents/shared-rooms.md,
"Talk".

- **A frame** is 16 bytes of header, big-endian, then one Opus packet: `tag` u8 (2; live sound's is 1), `fl` u8 (bit 0:
  the first frame of a spurt, the voice gate just opened; other bits 0), `sid` u16 (the talker writes 0; the relay writes
  the talker's stream id), `seq` u32 (frames handed to the socket since this `talk-start`, from 0: a frame the gate held
  back takes no number, so a gap at a listener is a real loss), `at` f64 (when its first sample was captured, on the
  relay's clock, ms). At most 1,016 bytes in all (`TALK_MAX_FRAME`); one smaller than 17 bytes or larger is dropped and
  counted as bad.
- **Messages** (text, as ever):

| from | `t` | fields | meaning |
| --- | --- | --- | --- |
| relay | `welcome` | `talk: 1` | this relay forwards Talk |
| a person's page or headset | `talk-start` | `cfg { codec: 'opus', sampleRate, numberOfChannels: 1, description? }` | its microphone's stream starts (or restarts, with a new `sid`); `sampleRate` 8000, 12000, 16000, 24000 or 48000, one channel, `description` base64 (at most 512 characters). Refused (`bad`) once a socket from the output page or a camera; a bad cfg: `bad talk-start` |
| any member | `talk-stop` | | its stream stops (Mic muted, Talk off, the microphone gone) |
| any member | `talk-sub` | `on: true \| false` | hear the room's talkers, or not; a new socket starts without it (the page asks again after `welcome`) |
| relay | `fx` `@talk` (`by: ''`) | `{ list: [{ sid, id, cfg, here }] }` | the talkers, to **every** member (Talk on or not, so a page with Talk off can say who is talking) whenever the list changes (a stream starts or stops, a talker's `here` changes), and to a member right after its `welcome` when the list is not empty. No names: every member has them from `members` |
| relay | `fx` `@talk` (`by: ''`) | `{ st: { on, sid, subs, frames, bytes, dropped, bad, why, max } }` | to a talker on its start and stop and every 2 s while it talks; `subs`: the members who get its frames now; `why`: `''`, `stopped`, `gone` (its socket replaced, it left, or its hello now says output page or camera), `full` (refused: `on: false`, `sid: 0`); `max` = 8 |

- **Who hears whom.** A frame from talker *s* goes to member *l* when *l* asked (`talk-sub`), *l* is not *s*, and not both
  are `here` (the `here` of their `hello`s, which the app sends again whenever it changes). People in the same place
  hear each other in the air, never through speakers. Known limit: two separate groups that are both `here` do not hear
  each other; a headset in AR counts as here until it says *I am elsewhere* (the headset menu's Debug tab), so two people
  in AR in two homes press that first. A VR headset that has not yet answered *Are you in the same room as the others?*
  neither talks nor hears until it does.
- **Limits.** At most 8 open microphones a room (`TALK_MAX`; the ninth `talk-start` gets `st` with `why: 'full'`, and
  listening still works; a restart by a talker does not count itself). At most 60 frames a second a talker (`TALK_RATE`;
  the rest dropped and counted). A listener whose socket is gone or backed up past 16 KB (`TALK_BACKLOG`) misses the frame
  (counted in the talker's `dropped`; a closing one is simply skipped): audio never queues behind a slow device. The
  talker's page drops a frame (never queues it) while its socket holds more than 8 KB or its encoder is behind.
- **Who may send.** Any person's page or headset (not the output page, not a camera). A frame with tag 2 from a member
  with no stream (never started, stopped, the output page) is dropped and counted (`<n> frames from <id> without a
  stream` in the log), **never** a 1003 close; a frame of any other tag is live sound's, as before (a plain member's
  tag-1 frame still closes it with 1003). A talker whose socket is replaced, who leaves, or whose hello says output page or
  camera ends its stream (`gone`); a reconnect starts again on the new socket.
- **Never kept or logged**: no frame's bytes, no cfg, no name, no address. The log says `<room> talk from <id> started
  (<n> open)`, `... stopped (<why>)`, `... refused (full: 8 open)`, and the counts when they change: `<room> talk from
  <id>: <frames> frames, <dropped> dropped, <bad> bad so far` and `<room> talk: <n> frames from <id> without a stream`.
- **Not end to end.** Voices go over TLS to the proxy and are plain in the relay's memory while it forwards them; every
  member sees who has a microphone open (the list).

Untested until tried on real devices: Quest Browser's WebCodecs (`MediaStreamTrackProcessor`, `AudioEncoder`,
`AudioDecoder`) and its microphone prompt in a session, echo with headsets on their speakers, latency and gaps over
Coolify's proxy on home and venue Wi-Fi and mobile data, the relay's load with eight talkers, and how voices sound. Here:
`node relay/test.mjs --talk` (the relay).

## The developer notebook (`--notes`, `--no-notes`)

A voice note with what the app knew at that moment (v142; the owner, 13 November 2026: "a developer notebook function where
i can directly record some spoken audio in ar or vr ... the more direct the better"). The app records it in developer mode
(holding B or Y in a headset, a round button on a phone or laptop) and sends it here; a Claude Code session reads the
notes, transcribes them (`tools/notes/notes.mjs`) and writes the transcript back, and the page `notes/` (served at `/notes/`)
lists them, plays them and deletes them. The contract is [tools/notes/SPEC.md](../../tools/notes/SPEC.md); the code is
`relay/notes.mjs` and `notesApi` in `server.mjs`.

Run logs (*Record a run*, developer mode: a device's frame times, a row a second, sent in parts every 30 s) are kept beside
the notes, in their `.logs/` (`/api/logs`, `logsApi` in `server.mjs`), on and off with them, with the same password; the
format and endpoints are in the same SPEC ("Run logs").

- **Where they are kept.** Whenever the relay keeps scenes: with `--scenes <dir>` in `<dir>/.notes/`, with `--scenes r2`
  under `<R2_PREFIX>.notes/` in the bucket. `--notes <dir>` keeps them in `<dir>` instead (also without scenes); `--no-notes`
  turns the notebook off (with `--notes`: refused). The scenes' listing, their watch, `GET /scenes/...` and
  `tools/studio/r2sync.mjs` leave `.notes` out, silently (a dot name is never a scene). With R2 the scenes' listing steps over the keys under `<R2_PREFIX>.notes/`, so the notes' objects never count against its limit (`R2_LIST_LIMIT` lowers it, for the tests). A note carries a client `nonce`: one posted again is answered 200 `{ id, again: true }` and kept once. On a public server (`--public`)
  without a password nothing is kept (said at the start); with one, an address may post 30 notes a minute (a burst of 60,
  then 429 with `Retry-After`).
- **A note on disk** (or as objects): `<id>/note.json` (what was sent without the base64, plus `id`, `got`, `size`, `status`
  `new` or `done`, `transcript` null or `{ text, lang, segments: [{ start, end, text }], by, at }`), `<id>/audio.<webm|ogg|m4a|mp3>`
  and `<id>/shot-1.jpg`, `<id>/shot-2.jpg`. The id is `YYYYMMDD-HHMMSS-` and four letters or digits, by the relay's UTC
  clock (so they sort). A note is written into a hidden folder and moved into place whole (R2: `note.json` last), so a
  listing never shows half a note.
- **Endpoints**, all behind the password when there is one (`Authorization: Bearer` or `?token=`), answers `no-store`, `GET`
  and `POST` only; with the notebook off every one answers 404 `{ error: 'this relay keeps no notes' }`, and `/api/ping` says
  `notes: true` when it is on.

| request | answer |
| --- | --- |
| `POST /api/notes` `{ v: 1, at, dur, kind, name?, audio: { type, data } or null, shots: [{ at, type, w, h, data } or { at, err }], pins, context }` | 201 `{ id }`. `audio.type` is `audio/webm`, `audio/ogg`, `audio/mp4` or `audio/mpeg` (a codecs suffix kept), `data` base64; at most 2 shots (JPEG, base64); 400 in words for bad JSON or a bad field, 413 past 16 MB (counted as it streams, nothing written), 429 past the per-address limit under `--public`, 507 past 2,000 notes |
| `GET /api/notes` | `{ notes: [{ id, at, got, dur, kind, name, status, story, station, release, device, pins, shots, audio, transcript }] }`, newest first; `pins` and `shots` counts, `audio` whether there is a recording, `transcript` its first 200 characters or null |
| `GET /api/notes/<id>` | its `note.json` (no base64), 404 for none |
| `GET /api/notes/<id>/audio`, `GET /api/notes/<id>/shot/<1\|2>` | the bytes with their type, one byte range (206, 416), `nosniff` |
| `POST /api/notes/<id>` `{ status?, transcript? }` | sets those fields (a transcript `{ text, lang, segments, by }`, `at` set by the relay, at most 200 KB; `null` clears it); 200 the note |
| `POST /api/notes/<id>/delete` | 200 `{ ok: true }` and its files are gone; 404 for none |
| `GET /notes` | 301 to `/notes/`, the notes page (`notes/index.html`, an app folder) |

No note's words, name, transcript or picture is ever in a log line: at most `note <id> <bytes>`. Test:
`node relay/test.mjs --notes` (seconds): off without scenes, `--notes`, `--no-notes`, `--public`, the endpoints above against a
folder, `--notes <dir>` with a password and the R2 backend against the stand-in S3, the limits, and `r2sync` leaving `.notes` alone.

## Shared networks (`--nets`, `--no-nets`, v208)

The cell story (*Back into the cell*, `packages/ppicell/src/SPEC.md`, "Stage 3") lets someone read a list of protein
pairs of their own on a page and, only when they press *Share with this room* (or *Put on the relay* outside a room),
put it here so that every device at their station, a headset too, can fetch it and show it. The code is
`relay/nets.mjs` and `netsApi` in `server.mjs`.

- **What is kept**: the network as the page read and mapped it, nothing else: `{ v: 1, name (the file's), prot: [the
  proteins' symbols], kinds: [up to 7 words], a, b: [each link's two proteins, numbers into prot], k: [each link's kind
  bits], s: [each link's score or null] (only with scores) }`, checked field by field (control characters refused in
  names), kept with its fields in a fixed order and gzipped. Its id is made from that: the first 60 bits of its SHA-256
  in 12 base-32 letters and digits (`a-z`, `2-7`). The same network sent again gets the same id (200 `again`) and is
  never written twice; no other network can overwrite it.
- **Where**: whenever the relay keeps scenes, in `.nets/` of the `--scenes` folder, or under `<R2_PREFIX>.nets/` in the
  R2 bucket (the scenes' listing steps over it, as over `.notes/`, so it never counts against `R2_LIST_LIMIT`; `r2sync`
  leaves it alone); `--nets <dir>` keeps them in `<dir>` instead (also without scenes); `--no-nets` turns them off (with
  `--nets`: refused). On a public server (`--public`) without a password nothing is kept (said at the start). Each
  network is `<id>/net.json.gz` and `<id>/meta.json` (written last, so a listing never shows half a network).
- **Limits**: 12 MB as sent (counted as it streams, 413 past it), 250,000 links (the page's own limit), 65,535 proteins,
  500 networks and 512 MB kept all together, compressed (`--nets-max <MB>` sets another size; 507 past either: remove
  some); one network is put at a time, so a burst cannot pass the caps. Under `--public`, 30 a minute from one address (a
  burst of 60, then 429 with `Retry-After`), counted before the body is read, so refused and failed tries count too; only
  a network already kept (`again`, nothing written) gives its turn back. Measured: the built-in map as pairs (141,296 links) is 1.9 MB sent and 0.7 MB kept; 250,000 links with
  scores 5.2 MB and 2.2 MB.
- **Who can read them**: anyone who can use this relay's API: with a password (`COLLAB_TOKEN`), those who know it; without
  one, anyone who can reach the relay. The page says so beside the button.
- **Who can remove them**: the rule is the notes': anyone who may write to this relay (its password, when it has one)
  can remove any network with the endpoint, for everyone who uses it, other rooms too. The page offers *Remove from the
  relay* only in the browser that put that network there (it remembers the ids per relay, in `localStorage`; an id is
  not secret), says that it goes for everyone, and asks once. A removal takes `meta.json` away first (R2) or moves the
  folder aside whole first (a folder), so a failure half way never leaves a network listed that cannot be fetched.
- **Endpoints**, behind the password when there is one, answers `no-store`, `GET` and `POST` only; with the store off
  every one answers 404 `{ error: 'this relay keeps no shared networks' }`, and `/api/ping` says `nets: true` when it is on.

| request | answer |
| --- | --- |
| `POST /api/nets` (the network as JSON) | 201 `{ id }`; 200 `{ id, again: true }` when it is there already; 400 in words for bad JSON or a bad field, 413 past 12 MB, 429 past the per-address limit under `--public`, 507 past 500 networks or a full store (`--nets-max`) |
| `GET /api/nets` | `{ nets: [{ id, name, n, e, kinds, score, bytes, gz, at }], max: { bytes, nets, store } }`, newest first (`n` proteins, `e` links, `bytes` as kept, `gz` compressed) |
| `GET /api/nets/<id>` | the network as JSON (`Content-Encoding: gzip` when the asker takes it); 404 for none |
| `POST /api/nets/<id>/delete` | 200 `{ ok: true }`, and it is gone; 404 for none |

No network's name or protein is ever in a log line: at most `net <id> <bytes>`. Test: `node relay/test.mjs --nets`
(seconds).

**The owner's relays** need this release before sharing works there: a relay older than v208 answers 404 for
`/api/nets`, so the page shows no share button and says *Sharing a network needs a relay that keeps them*. Both run
`--public --scenes r2` with a password ([The test place on Coolify](#the-test-place-on-coolify)), so once they run v208
they keep shared networks under their own `<R2_PREFIX>.nets/` with no new setting: the test place
(`stories.lab.lbi-netmed.com`) takes v208 by itself with the push to `dev` (*Auto Deploy*); the main relay
(`main.lab.lbi-netmed.com`) when `main` moves to v208 (its webhook, else **Deploy** in Coolify). A relay without scenes
needs `--nets <dir>` (in `RELAY_ARGS`, on a persistent volume) to keep them; a relay with `--public` and no
`COLLAB_TOKEN` keeps none.


## Hot reload (`--watch`)

While you work on the app, `node relay/server.mjs --static . --watch --build` (or `--lan --watch --build` for
headsets) makes every page and headset it serves follow your edits (index.html's `HOST.live`; docs/agents/shell.md "Hot reload
and live updates"). The page asks `/api/ping`; when it says `watch: true` it opens `/api/watch`, a stream of
Server-Sent Events (`text/event-stream`, `Cache-Control: no-store`, `retry: 2000`, a comment line every 20 s):

| event | data | the page |
| --- | --- | --- |
| `hello` | `{ shell: { 'index.html': fp, 'sfx.js': fp, 'occlusion.js': fp, 'ships.js': fp, 'shared.js': fp, 'sw.js': fp, 'three.min.js': fp, 'peerjs.min.js': fp, 'output.js': fp }, stories: { <key>: fp }, list: fp, build }`, at once on every connection | the first: the shell as it is; after a lost connection (the relay restarted, the laptop slept): a shell file changed meanwhile reloads, a story changed meanwhile is swapped or marked, the list is read again |
| `story` | `{ key, fp }`: `stories/<key>.js` changed | swaps it in place at once where it is on show (its place kept: mode, time, explore state, view, the headset's placement; at a station the room's clock and state, nothing written to the room); fetched fresh next time elsewhere |
| `list` | `{ fp }`: `stories/list.js` changed | reads the list again: new and changed cards, no reload |
| `shell` | `{ file, fp }`: a shell file changed | reloads with its place kept (a headset session ends: the page shows Enter VR to continue) |
| `build` | `{ key, ok, ms, out }` (with `--build`): a built story's build ran (`out`: the end of its output) | a failed build shows in the page's bar |

`fp` is a fingerprint of the file's text (index.html's `HOST.fingerprint`, the same in `tools/release.mjs`). A file is
looked at 150 ms after its last change and told only when its text changed. With `--build`, a change to a `.js` file
under `tools/<dir>/` runs the build of every story whose `build.mjs` names that folder (its own, and `../lbi/` and the
like) or a story file it cuts from (the pass story from `packages/airports/main.js` and `packages/spatial/main.js`); files in
`shots/`, `gen/` and `data/` are not sources. One build runs at a time, 300 ms after the last change; the story file it
writes then goes out as `story`. Watching `tools/` needs Node 20 or newer on Linux (macOS and Windows: any). For
development only: `--build` runs the build scripts of the folder it watches.

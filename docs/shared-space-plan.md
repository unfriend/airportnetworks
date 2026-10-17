# Shared space: plan and build spec

The stories become **stations** in a room: several people with headsets (mostly Quest 3 in one room, in
passthrough; sometimes people elsewhere in VR, and remote desktop operators) see the same stations in the same
places, each station playing its own story, in sync on every headset. Each station has its own panel and its own
sound zone; people can look at a station together, point at things, and use its interactive parts together.
Read [multiplayer.md](multiplayer.md) (sync rules) and [shared-spaces.md](shared-spaces.md) (one room frame for
everybody) first: this plan applies them.

Decisions (2026-10-17, from the owner): a **new relay in this repository** (Node, no dependencies, self-hosted);
**stations, nearby ones live**; **everyone equal** (anyone can play, pause, jump, change controls; last action
wins); participants mostly Quest 3 in one room, sometimes **remote VR** people and **remote desktop operators**.

## 1. Phases

0. **This build: shared rooms with one live station per person.** The relay; the session client in the shell;
   the room frame (shared spaces, two-point calibration, saved per headset); stations (a story at a spot in the
   room) whose state is synced; each headset runs live the station it stands at (the others show as previews on
   the floor and switch over when you walk up or point at them); the story placed at its station for everyone;
   the station's narration as a sound zone; pointer rays, name tags and (for remote people) simple avatars;
   desktop operators with a room map who follow and steer a station. Nothing changes for a person who is not
   in a shared room.
1. Two live stations per headset (the nearest two run in full): the stories learn to run as guests of the shell
   (no own frame loop, input dispatched by the shell, scene rendered into a shared frame). A large refactor of
   all seven stories; only after phase 0 has been tried on headsets.
2. One simulation for everybody: the flock's birds and the robot gang are live simulations; in phase 0 every
   headset runs its own (same rules, same events, but birds and robots are not in the same places). Phase 2
   makes the first person at a station its simulation host, streaming positions (ephemeral, about 10 Hz) that
   the others ease towards. Robots also need one shared room description from that host.
3. Polish: relay persistence across restarts, station editing on the desktop map, remote VR teleport, presenter
   tools if wanted.

## 2. Files

| Path | What |
| --- | --- |
| `relay/server.mjs` | the relay: HTTP + WebSocket (own minimal RFC 6455 code, no packages), optional TLS, optional static serving of the app |
| `relay/test.mjs` | Node test of the protocol (two or three clients) |
| `relay/README.md` | running it (Coolify, a lab machine with TLS, a laptop with `adb reverse`), the protocol |
| `relay/Dockerfile` | for Coolify (or any Docker host): Node 22 slim, the app copied in, `node relay/server.mjs --port 8787 --static .` |
| `shared.js` | the shell's shared-space client (`HOST.collab`, `HOST.room`), loaded by `index.html`, in `sw.js` `SHELL` |
| `index.html` | wiring: the Shared button and dialog on the page, the placement hook, the audio panner |
| every story | a small hook object and three short additions in its headset pointer code (section 7) |
| `tools/collab.mjs` | headless test: a relay and several pages in one room |

## 3. The relay (`relay/server.mjs`)

Node 18 or newer, **no dependencies** (the repository has no package.json): `node:http`/`node:https`,
`node:crypto` for the WebSocket handshake, own frame code (text frames, masking, fragmentation, ping/pong,
close; messages up to 1 MB). Usage:

```sh
node relay/server.mjs [--port 8787] [--host 0.0.0.0] [--cert cert.pem --key key.pem] [--static .]
```

With `--static .` it also serves the app (same origin, so `wss://` and the shared space's "same page" rule come
for free; recommended in the lab). With `--cert/--key` it speaks HTTPS/WSS (headsets need a secure context; a
page on HTTPS can only open `wss://`). CORS on the API for other origins (the app on GitHub Pages).

**Hosting.** GitHub Pages cannot run the relay (static files only); everything that exists today keeps working
there, and only shared rooms need the relay. Two set-ups, both documented in `relay/README.md`: (1) the app on
GitHub Pages and the relay on Coolify (the app is told the relay's `wss://` address once: remembered, or
`&relay=` in a link); (2) everything on Coolify: the relay with `--static .` serves the app too, one address
(recommended for shared rooms: Quest shared spaces want the same page URL on every headset). Coolify's proxy
terminates TLS and passes the WebSocket upgrade; the relay listens on plain HTTP behind it and must trust
`X-Forwarded-*` only for logging. A health check: `GET /api/ping`.

HTTP API (JSON): `POST /api/rooms` `{ app: 'networks', version }` -> `{ code }` (3 letters A-Z, unused);
`GET /api/rooms` -> `[{ code, members, stations, idle }]`; `GET /api/rooms/XYZ` -> the stored state (debugging);
`GET /api/ping` -> `{ now }`. A room expires 6 hours after its last member left. WebSocket:
`/api/ws?room=XYZ&id=<client id>` (the client id is random per page load, kept across reconnects).

Messages (JSON objects with a `t` field):

| from | `t` | fields | meaning |
| --- | --- | --- | --- |
| client | `hello` | `name, color, kind ('ar' | 'vr' | 'desktop'), here (bool), version` | who I am (again after any change) |
| relay | `welcome` | `you, seq, keys {k: {v, seq, by}}, members [...], now, proto` | the whole room, first message on a socket |
| client | `set` | `batch [[k, v], ...], cid` | stored writes (one batch, one seq) |
| relay | `set` | `batch, seq, by, cid` | to everybody, the writer included (its acknowledgement) |
| client | `fx` | `k, v` | ephemeral, not stored |
| relay | `fx` | `k, v, by` | to everybody but the sender |
| relay | `members` | `members [...]` | after any join, leave or hello |
| client | `ping` | `c` (client ms) | |
| relay | `pong` | `c, now` | for the round trip and the clock offset |
| relay | `error` | `code, text` | unknown room, wrong protocol, version mismatch (then it closes) |

Rules: every stored write gets the room's next seq; last writer wins. `v: null` deletes, but **only** for keys in
deletable families (`st.<id>` and below, `pose.*`); the relay refuses `null` elsewhere (the "epoch storm" lesson).
Writing a station (`st.<id>`) with a **different story** deletes that station's state keys (`st.<id>.*`) in the
same seq (the epoch rule). Members time out after 40 s of silence. A member's `fx` rate is capped (60 a second).
Log every write (room, member, seq, keys) or why it was dropped.

## 4. State keys

All poses are in **room coordinates** (metres, y up, the floor at y = 0; see the room frame, section 5).

| key | value | who writes |
| --- | --- | --- |
| `st.<id>` | `{ story, x, z, yaw }`: a station: which story, where its viewing spot is and which way it faces | whoever places or moves it |
| `st.<id>.play` | `{ mode: 'story' | 'explore', t, playing, at }`: the story clock: at relay time `at` the story was at `t`; while playing it runs on from there | whoever plays, pauses, jumps, changes mode (or the story reaches its end) |
| `st.<id>.x` | the story's explore state (opaque JSON, from the story's `collab.state()`) | whoever changes a control |
| `st.<id>.panel` | `{ x, y, z, yaw }`: the station's panel, relative to its spot | whoever moves the panel |
| `roomFrameShared` | `{ uuid, o, x, by, at, src }` (shared-spaces.md) | the alignment |

Station ids are short random strings. A new room has no stations; the headset panel and the desktop dialog offer
**Arrange all** (the seven stories on an arc in front of the person, 2.2 m apart, facing inwards, the spot 1.4 m
from where the content floats) and **Add a station here** (one story, at your feet, facing where you face),
**Move here**, **Remove**.

Ephemeral (`fx`): `p.<member>` presence at 15 Hz: `{ st, head: [x, y, z, qx, qy, qz, qw], hands: [[ox, oy, oz,
dx, dy, dz, len], ...] }` (room coordinates; `len` how far the ray reaches: to the panel or object it hits);
`e.<station>` one-shot story effects `{ type, data }` (a falcon sent, crumbs spilled, ...).

**Clock**: clients keep an offset to relay time from `ping`/`pong` (median of the last few, round trip halved).
The story time of a playing station is `t + (relayNow - at)`; a headset whose story drifts more than 0.25 s from
that jumps (and its narration with it). A story reaching its end writes the end itself (first writer wins in
effect: the others' writes carry the same value and are suppressed by value).

## 5. The room frame (`HOST.room`)

As in shared-spaces.md, adapted: the renderer keeps the `local` reference space (no story changes); the shell
asks the session for `local-floor` and, when granted, `shared` spaces of its own and runs its own
`session.requestAnimationFrame` callback each frame (the same `XRFrame` as the story's), where it reads
`frame.getPose(localFloor, local)` and `frame.getPose(shared, local)`. The room frame is stored per headset in
`local-floor` coordinates (`localStorage` `roomFrame`), and turned into a **room -> local** matrix every frame.

- Alignment as in shared-spaces.md section 4: shared space (adopt a published frame for our id; else our saved
  marks or the shared origin, published) -> else saved marks (persistent anchor at mark A, then saved
  coordinates) -> else **calibrate**: the shell's headset panel asks to touch mark A and pull the trigger, then
  mark B. Reconcile at 2 Hz (3 cm / 1 degree). Notices in the headset.
- Remote people (`here` false) and desktop users never calibrate: their room frame is their own floor origin,
  facing where they faced when they joined (VR).
- The stories request `'shared'` as an optional feature too (with `plane-detection` and `mesh-detection`).
- Log every step in `window.__collabLog`.

## 6. Stations on a headset

- **Your station**: the nearest station whose spot is within 1.6 m of you for 1 s (leave it beyond 2.2 m), or the
  one you point at and pick. Your station's story is the live story on your headset (`HOST.go(key)` when it
  differs) and is placed at its station; all other stations show as **previews** drawn by the shell: a ring on
  the floor at the spot in the story's colour, and a small upright card (title, kick, who is there, its state:
  playing at 1:23 / exploring) where the content would float. Pointing at a preview and pulling the trigger
  makes it your station.
- **Placement**: in a room with an aligned frame, `HOST.anchor.frame()` returns the rig pose of your station
  (room -> local applied to the spot, at a standing eye height of 1.6 m above the floor, facing the station's
  direction), `held()` and `locked()` are true (stories do not recentre, the grip moves only panels), and
  `saved()` gives the station's panel pose. So the story stands at its station for everybody, with no story
  change. Outside a room, everything is as today.
- **Sound zone**: the shell routes the narration through a Web Audio `PannerNode` at the station's content
  (HRTF, inverse distance, reference 1 m, rolling off so it is faint beyond about 4 m) and moves the listener with
  your head every frame. The `<audio>` element fallback sets its volume by distance instead. Previews are silent.
  Both engines, the hum and the watchdog stay as they are (CLAUDE.md); Sound check is unchanged.
- **Presence**: every headset sends `p.<me>` at 15 Hz. Others draw, in the room frame: each hand's ray as a thin
  line in the person's colour with a bright dot at its end, and a small name tag above the head; people who are
  not in the room (`here` false) also get a simple avatar (a rounded head with a visor and two hand spheres in
  their colour). In passthrough you see the people in your room, so they get no avatar.
- **The shell's headset panel**: a small panel beside the story panel ("Shared: XYZ · 4 people" when joined,
  "Shared space" when not): join a room from the list (no typing), leave, your name and colour, calibrate, the
  alignment state, the stations (Arrange all, Add a station here, Move here, Remove), and the people. Shell
  objects take part in the story's pointer handling (section 7) and are always nearer than the scene behind.

## 7. What each story adds (all seven, kept identical where the code is shared)

1. In the object a story returns: `collab: { APP, scene: () => GL.scene, state, apply, effect, hover }`:
   `APP` (the shell wraps its `seek`, `togglePlay`, `enterExplore`, `enterStory` to publish the clock, and sets
   `APP.t`, `APP.playing`, `APP.mode` when the room changes it); `scene()` (the shell hangs its overlay group,
   with presence, previews and its panel, in it); `state()` -> the explore state to share (plain JSON: the
   chosen tab, controls, selection, search, route ... whatever makes another person see the same thing; never
   camera, hover or layout of the page); `apply(s)` -> show that state without publishing it again; `effect(type,
   data)` -> play a one-shot effect another person caused (the flock's falcon, the robots' crumbs); `hover(i)` ->
   how far controller i's ray reaches now (for the shared ray's length), or 0.
2. A story calls `HOST.collab.effect(type, data)` where it causes such a one-shot effect itself.
3. In its headset pointer code: before its own raycast, `const sh = HOST.collab.ray(c.i, c.o, c.d)`; when it
   returns a hit, that is the hover (`{ kind: 'shell', point, dist }`, drawn with the usual dot) and a press goes
   to `HOST.collab.press(c.i)` instead of the story.
4. `'shared'` in the session's optional features.

The shell polls `state()` five times a second and publishes it when its value changed (echo suppression by
value); a remote value goes through `apply()` and becomes the last synced value.

## 8. Desktop operators

The top bar gets a **Shared** button (also on the Stories screen): a dialog with the relay address (remembered;
the app's own origin when it was served by the relay), the open rooms (Join), Start a room, your name and
colour, the people, and a **room map**: a top-down canvas with the stations (dots in their colours, titles,
facing), the people (arrows where they stand and look, their rays) and, when joined, a **Follow** button per
station: the page shows that station's story in sync (playing, pausing, jumping and controls go both ways).
Links: `#s=XYZ` joins room XYZ (with `&relay=wss://host:port` when the relay is elsewhere) and stays in the
address while joined, so a reload rejoins.

## 9. Tests

- `relay/test.mjs`: create, join, welcome state, ordering and acknowledgement, null refused outside deletable
  families, a station's story change dropping its state keys, `fx` not stored and not echoed, ping/pong, member
  timeout, room expiry (with a short test timeout).
- `tools/collab.mjs` (Playwright, starts the relay with `--static .`): three pages in one room: stations arranged;
  a page following a station sees play, pause, jump and mode changes from another within a second; each story's
  explore state round-trips (`state()` on one equals `state()` on another after a change); no ping-pong (count
  writes over 5 s of idle: zero); a late joiner gets everything; a relay restart is survived (reconnect and
  refetch); a pretend headset (as `tools/smoke.mjs` does) with fake `local-floor` and `shared` spaces aligns from a
  published frame, its story stands at its station, its rays reach the others in room coordinates, walking to
  another station switches the story; calibration from two fake marks gives the expected frame.
- `node tools/smoke.mjs` stays green (nobody in a room: nothing changes).
- Untested until two Quest 3 headsets are in a room: shared-space ids, calibration accuracy, sound zones heard,
  comfort, frame rate with presence drawn.

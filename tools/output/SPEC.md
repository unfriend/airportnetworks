# The output page: MIDI and OSC from the rooms and the studio (plan and contracts)

The owner, 16 November 2026: send and receive MIDI and OSC from the shared rooms and the studio. The owner's answers:

1. "make it opt in by default and say who entered": a trigger cube sends only when it is opted in on that cube (off by
   default), and what it sends says who walked in or out (their room name, colour and member id).
2. "both": MIDI and OSC.
3. "in and out": both directions.
4. "output page and then midi or local relay for osc and trackers i guess?": a page of the app on a laptop or the PC in
   the room (the output page) does MIDI itself through the browser's Web MIDI API, and hands OSC to a relay on the same
   machine or network, which sends and takes the UDP and also sends the Vive trackers as OSC itself.

This file is the contract between the three lanes that build it in parallel (RELAY, PAGE, STUDIO) and the integrator.
The idea came from HANDOVER.md's "Cardinal on a laptop, played from the room over MIDI" (the maybe list), which this
builds in a more general form.

## Contents

- The picture
- Who owns which file
- FORMAT
- An exception to a rule (cubes)
- Wire 1: the room (studio state fields, the effect `send`, hello and presence)
- Wire 2: the studio's API for the output page (`HOST.cur.out`)
- Wire 3: the output page and the relay (`osc`, `osc-cfg`, `@osc`, `/api/ping`)
- Wire 4: OSC on UDP (address scheme and arguments)
- Wire 5: MIDI (what the page sends and takes)
- `layout.json`: the `send` entries, their validation, the motion's `beat`
- Lane STUDIO
- Lane PAGE
- Lane RELAY
- Tests: each lane's own, and the integrator's end-to-end round
- Known limits (say them in the docs) and untested

## The picture

```
headsets and pages in the room (each person's own cubes and pointing)
   |  room keys and effects through the relay as ever:
   |  studio state (pr.<id> presses, qr.<id> sequences, the new sw.<id> and bt), the new effect 'send'
   v
the output page (a laptop or the room's PC; Chrome or Edge; #s=XYZ&output)
   - follows one studio circle and runs the studio scene itself (HOST.cur.out: poses, events, actions)
   - people's heads and hands (HOST.collab), trackers (HOST.collab.trackers())
   - Web MIDI: out to a virtual port (loopMIDI, IAC, ALSA) -> Cardinal, a DAW ...; in from any port
   - OSC: messages over its room socket to the relay ('osc'), and back ('@osc')
   v
relay/server.mjs --lan --osc-out host:port [--osc-out ...] --osc-in port [--trackers]
   - UDP OSC out only to the targets on its command line; UDP OSC in on its port, to the output pages
   - the trackers as OSC itself, at the bridge's rate, in the room's coordinates
```

## Who owns which file

Disjoint: a lane edits only its own files. Nobody bumps `VERSION` in `sw.js`, runs `tools/release.mjs`, touches
`whatsnew.json` or commits: the integrator does. Never write the forbidden host name the brief names (the old one) anywhere.

| Lane | Files |
| --- | --- |
| RELAY | `relay/osc.mjs` (new), `relay/server.mjs` (flags, `osc` and `osc-cfg` messages, `@osc`, `/api/ping`, `out` in hello and the members list, `'output.js'` in `APP_FILES`), `relay/trackers.mjs` (a hook for each datagram), `relay/test.mjs` (`--osc`), `relay/README.md` ("OSC and the output page") |
| PAGE | `output.js` (new: the output page), `shared.js` (FORMAT, `&output`, loading `output.js`, the Shared dialog's button, `@osc` intake, `HOST.collab.osc*`, hello and presence `out`, *output page* in the people lists, `HOST.collab.people()`), `index.html` (only if a hook there is unavoidable), `sw.js` (`'./output.js'` in `SHELL` only; never `VERSION`), `tools/output/README.md` (new: setting it up), `tools/output/test-page.mjs` (new: its own test), `docs/agents/shared-rooms.md` (a section "The output page (MIDI and OSC)", and the studio's row of "What each story shares": `sw.<id>`, `bt`, the effect `send`) |
| STUDIO | `tools/studio/**` (engine, `SPEC.md`, `README.md`, `scan.mjs` if it reads records), `stories/studio.js` (only by `node tools/studio/build.mjs`), `tools/smoke.mjs` (one new block, `'studio sends'`), `docs/agents/studio.md` |
| integrator | `tools/collab.mjs` (`--output`), `docs/agents/testing.md`, `docs/agents/layout.md`, `AGENTS.md` (a line), `README.txt`, `docs/history.md` (FORMAT history, the owner's words), `HANDOVER.md` (the Cardinal entry: built), `sw.js` `VERSION`, `version.json`, `index.html`'s stamp, `whatsnew.json` |

`node relay/test.mjs` checks that every file `SHELL` names is served: it passes only once PAGE's `SHELL` line and RELAY's
`APP_FILES` entry are both in (neither lane chases that on its own).

## FORMAT

`networks-50` becomes **`networks-51`** (lane PAGE edits `const FORMAT` in `shared.js`). Why: the studio's records gain
`send` (cubes, a press record, sequences) and a motion's `beat`, its state gains `sw.<id>` and `bt` (an older device
would drop them, write records back without them, or ignore an outside switch), and presence and hello gain `out`.

## An exception to a rule (cubes)

AGENTS.md: "Trigger cubes are each person's own unless `all: true`; what they reveal is never in `state()` or sent." The
owner's decision makes one exception, which every lane's docs state in these words: **only for a cube opted in to send
(its record has `send` entries), the fact that a person walked into it or out of it is sent as an ephemeral effect from
that person's device; what the cube shows, hides, changes or starts for them stays their own and is never sent.** A
pointing (hover) on an item whose press has `hover`/`unhover` send entries is likewise sent; nothing else of pointing is.
Nothing goes into `state()` for either. AGENTS.md's rule line is amended by the integrator.

## Wire 1: the room

### Studio state (`collab.state()` of `stories/studio.js`)

Beside the existing fields (`o.<id>`, `c.<id>`, ..., `qr.<id>`, `pr.<id>`):

- Records as in `layout.json` carry the new optional fields: `c.<id>.send`, `o.<id>.press.send`, `p.<id>.press.send`,
  `q.<id>.send`, and `o|p|e.<id>.motion.beat` ("`layout.json`" below).
- **`sw.<id>`** = `{ on: 1 | 0, at, by }`: an outside switch of an item (an object, a shape, an empty, a sound or a cube),
  written only through `HOST.cur.out.act()` (the output page). `on` 1 shows it (a cube: switched on), 0 hides it (a cube:
  switched off); `at` the room's ms (`behNow()`) of the write; `by` the writer's member id (at most 32 characters). It is
  one more source in the cubes' "entered last decides" rule, exactly as a press's show and hide entries are
  (`{ id: 'sw', since: at, cut: false }`, a 0.4 s fade; a cube switches at once): in force until a later source decides.
  Shared, never in `layout.json`, Undo, the draft or *Unsaved changes*; an id not in the scene is ignored (and not
  written back); absent: no outside switch. Changing the scene clears them all. Not cleared by *Reset what I have seen*
  or the lobby (it is the room's).
- **`bt`** = `{ bpm, at, by }`: the room's beat, written only through `HOST.cur.out.act({ do: 'beat' })`. `bpm` 20 to 300
  (to 0.01), `at` the room's ms of one beat (any beat: phase = ((now - at) / (60000 / bpm)) mod 1), `by` as above.
  Absent: no beat. At most one write a second from a device (a removal at once). Never in `layout.json` or Undo.
- `apply()` checks every field of both (a bad value ignored, the field treated as absent) and never publishes.

### The effect `send` (on the studio station's `e.<station>`, through `HOST.collab.effect('send', data, quiet)`)

Published by a person's device (a headset, or a page in Walk view), never by a camera (`HOST.collab.cameraMode()`), the
preview camera or the output page (`HOST.collab.outOn()`, below):

```
data = { id: <item id, 6 chars [a-z0-9]>, ev: <event>, at: <room ms of the moment>, t?: <s, an 'at' marker only>, try?: 1 }
```

- A cube that is **each person's own** (no `all: true`, no `key`) with send entries: `ev` `'enter'` as its inside
  (`c.raw && c.on`) becomes true for this device, `'leave'` 0.3 s after it stops (`PLAY_EDGE`, as `plays` debounce; back
  within that: nothing). Only when the cube has at least one entry for that `ev`, or (as integrated) for `'leave'` a held
  entry for `'enter'`, so the held note ends as the person walks out (likewise `'unhover'` after a held `'hover'`, and
  the output page's own `'off'` and everyone cubes' `'leave'`). A `stay` cube sends by the head itself
  (enter as entered, leave as the head leaves), whatever it keeps showing. Not quiet.
- An item whose `press.send` has `'hover'` or `'unhover'` entries: `'hover'` as this device's pointing on it begins
  (`hoverNow`, a real pointing; the card's *Try pointing* sends nothing), `'unhover'` 0.3 s after it ends. Quiet (`q: 1`).
- *Try* on any send row of a card (any kind, any `ev`, editing): one effect with `try: 1` (and `t` for an `'at'` row).
- Never sent: everyone cubes and cubes with a key (the output page works those out itself), presses and sequences
  (already shared by `pr.<id>` and `qr.<id>`), cube switches.
- At most 10 `send` effects a second from a device and one per (id, ev) per 100 ms; the rest dropped and counted
  (`STUDIO.sends().dropped`).
- Every device's `studioEffect` ignores `send` unless something listens on `HOST.cur.out` (the output page); a bad
  `data` (shape, an unknown id) is ignored.

### Hello, presence, the people lists (lane PAGE; the relay keeps `out`)

- The output page's hello: `{ t: 'hello', name: 'Output page', color, kind: 'desktop', here: false, version: FORMAT,
  proto, dev: 'screen', reload: 1, out: 1 }`. The relay keeps `m.out = true` and adds `out: 1` to that member in its
  members list (`pub`); the peer-to-peer and on-device hubs in `shared.js` do the same.
- Its presence, once a second: `{ st: <the station it follows>, kind: 'desktop', out: 1, ts }` (no head: it is never a
  person, never drawn, never counted as a head). Others mark it `P.out`; the pages' people list and the headset menu's
  people rows say *output page*.
- It is not an observer: it writes the studio's state as any page following a station does (presses, sequences, `sw`,
  `bt`), and nothing else of the room.

## Wire 2: the studio's API for the output page (`HOST.cur.out`, lane STUDIO; also `STUDIO.out`)

The studio's returned object gains `out` (present from the studio's first frame; `HOST.cur.out` is undefined for every
other story, and the page then offers people and trackers only). All poses in the scene's frame, which at a station is
the room's (metres, floor at y = 0, quaternions `[x, y, z, w]`).

```
out = {
  v: 1,
  ready(): bool,                     // a scene open and its items in (LOAD.done and a scene)
  scene(): string,                   // the scene's name ('' none)
  list(): [{ id, k, name, send, press, all, key }],
      // every item: k 'o' object, 'p' shape, 'e' empty, 's' sound, 'c' cube, 'q' sequence (no cut-outs, groups, screens,
      // paintings); send: its send entries as recorded (a cube's, a sequence's, a press's), [] none; press: 'all' | 'own' |
      // '' (no press record); all: a cube's all: true; key: a cube's key id or ''
  pose(id): { p: [x, y, z], q: [x, y, z, w], shown: bool } | null,
      // where it is drawn now on this device (motions, paths, behaviours, trackers, carries: the holder's world pose in the
      // scene's frame; an object's p its holder's origin); a sequence or an unknown id: null
  listen(fn): () => void,            // fn(ev) for each event (below); several listeners; returns the remover
  act(a): { ok: true } | { ok: false, why: string },   // an action from outside (below)
  beat(): { bpm, at, by } | null,    // the room's beat as applied
  sends(): { out: n, dropped: n },   // this device's send effects sent and dropped (as STUDIO.sends())
}
```

### Events (`fn(ev)`)

```
ev = { ev, id, k, name, who, at, t?, send, try? }
```

- `ev`: `'enter'`, `'leave'`, `'on'`, `'off'` (cubes), `'press'`, `'hover'`, `'unhover'` (objects and shapes), `'start'`,
  `'stop'`, `'at'` (sequences). `id`, `k`, `name` the item's. `who`: a member id, or `''` (nobody: a key cube, a cube
  switched by a cube). `at`: the room's ms of the moment. `t`: an `'at'` event's time in the sequence (s). `send`: the
  item's send entries whose `on` is `ev` (and whose `t` is `t` for `'at'`), copies, possibly `[]`. `try`: 1 when it came
  from a card's *Try*.
- Emitted only while at least one listener is registered (no cost otherwise), from the studio's frame (after
  `pressStep`), or at once from `studioEffect` for an effect. A listener that throws is logged once and kept.
- Where each comes from, on the output page:
  - `'enter'`, `'leave'` of a person's own cube: the effect `send` (`who` = the effect's `by`).
  - `'enter'`, `'leave'` of an everyone cube (`all: true`) with send entries: worked out here from the heads
    (`behHeads`), as every device does, `PLAY_EDGE` on leaving; `who` = the member id of the earliest head inside at
    entering (the last inside at leaving). Of a cube with a key: the same, `who` `''`.
  - `'on'`, `'off'`: a cube with send entries for them switched on or off as this device works it out (only shared
    sources count here: everyone cubes, shared sequences and presses, `sw`); `who` = the deciding source's `by` (a press
    stamp's, a sequence state's, an `sw`'s), else `''`.
  - `'press'`: every new shared press stamp `pr.<id>` (`who` = its `by`), **also for items with no send entries** (`send`
    `[]`), only when its `at` is within 2 s of now (no replay of old presses as the page joins or the scene opens).
  - `'hover'`, `'unhover'`: the effect `send`.
  - `'start'`, `'stop'`: a shared sequence's effective state starting or stopping (a command, a `seq` event, a cube's
    or a press's `seq` entry, `start: 'open'`; `stop` also when a sequence without `loop` passes its `len`), also with no
    send entries, `who` = the state's `by`, only for states set within 2 s of now. Own-sync sequences never.
  - `'at'`: a shared sequence playing crosses one of its `'at'` send entries' `t` (each cycle of a loop), in real time
    only (never in the catch-up of a late join or a seek); `who` = the state's `by`.
  - Anything with `try: 1`: the effect `send` (`who` = its `by`).

### Actions (`act(a)`)

| `a` | What it does | Refused (`why`) |
| --- | --- | --- |
| `{ do: 'press', id }` | `pressFire(id)` as a press here (the stamp written, everyone's entries fire), with or without editing | no such item; no press record; `press.who: 'own'` (*its press is each person's own*); within 250 ms of the last |
| `{ do: 'start' \| 'stop' \| 'toggle' \| 'rewind', id }` | `seqCmd` on a shared sequence (toggle: stop when playing, else start) | not a sequence; `sync: 'own'`; the circle's story locked |
| `{ do: 'show' \| 'hide' \| 'flip' \| 'clear', id }` | writes `sw.<id>` `{ on: 1 }` / `{ on: 0 }` / the opposite of whether it is shown here now / removes it | not an object, shape, empty, sound or cube |
| `{ do: 'beat', bpm, at }` | writes `bt` (`bpm` 0 or absent: removes it); at most once a second, the last kept and written when the second is up | `bpm` outside 20 to 300 |

`by` in what it writes is this device's member id. `act` never throws; with no scene, `{ ok: false, why: 'no scene' }`.

## Wire 3: the output page and the relay

Only over the output page's own room socket, only when the room runs on a relay (`C.via === 'relay'`) and the relay's
`/api/ping` says `osc`. Peer-to-peer and on-device rooms: no OSC (MIDI still works); the page says so.

### Page to relay

- `{ t: 'osc', m: [msg, ...] }`: 1 to 128 messages, the frame at most 64 KB. `msg` = `[address, types, ...args]`:
  `address` `/^\/[!-~]{0,255}$/` (no spaces), `types` `/^[ifsTFN]{0,32}$/` (no leading comma), one arg per `i` (an
  integer within int32), `f` (a finite number) or `s` (a string, at most 256 characters), none for `T`, `F`, `N`. Each
  message becomes one UDP datagram to **every** `--osc-out` target. A bad message is dropped and counted, the rest sent.
  Accepted only from a member whose hello said `out: 1` (else refused once as `bad`, as an unknown message is); with no
  `--osc-out`, dropped silently (counted). At most 2,000 messages a second per member (fixed one-second window, as
  `over()`); the rest dropped and counted (said in the log at most once a second, never their contents).
- `{ t: 'osc-cfg', trk: true | false }`: the trackers as OSC for this member's room (below) on or off. From an `out`
  member only. The relay answers with a status at once.

### Relay to page (fx with `by: ''`, the shell's own, never passed to a story, never taken from a member)

- `{ t: 'fx', k: '@osc', v: { at: <relay ms>, m: [msg, ...] }, by: '' }`: one per UDP packet that came in on `--osc-in`
  (a bundle's messages flattened, nested bundles to depth 4, timetags ignored), to **every** member with `out` in every
  room of the relay (an event's relay has one). Incoming types are normalised: `i` (`i`, and `h` within a safe integer),
  `f` (`f`, `d`, and other `h`), `s` (`s`, `S`, `c`), `T`, `F`, `N`, `I` (no arg). A packet with any other type (`b`,
  `t`, `r`, `m`, arrays) or a bad layout is dropped and counted. At most 500 `@osc` a second per member; a member whose
  socket holds more than 256 KB unsent is skipped (as `@trk`).
- `{ t: 'fx', k: '@osc', v: { st: { out: <targets>, in: <UDP port or 0>, trk: <'off' | 'on' | 'none' | 'unaligned' |
  'other'>, sent: n, got: n, dropped: n } }, by: '' }`: to an `out` member after its `osc-cfg` and every 2 s while it is
  connected. `trk`: `'off'` not asked or no `--trackers`, `'on'` sending for this room, `'none'` the bridge silent,
  `'unaligned'` the room's `trk` not on or not lined up, `'other'` another room's output page asked last.

### `/api/ping` (password as ever)

Gains `osc: { out: <number of targets>, in: <UDP port or 0>, trk: <bool: --trackers on too> }` only when `--osc-out` or
`--osc-in` was given. Target addresses are never in an answer.

### The relay's command line (lane RELAY)

- `--osc-out <host:port>`: repeatable and comma-separated, at most 8 targets; `host` an IPv4 address or a name (looked
  up once at start; again after a send error, at most once every 10 s), `port` 1 to 65535. Datagrams from one UDP socket
  bound to an ephemeral port.
- `--osc-in <port>` or `--osc-in <addr:port>`: listen for OSC on UDP (default address 127.0.0.1, since UDP has no password: `0.0.0.0:<port>` for OSC from the LAN; 0 picks a free port, which
  the start line and `/api/ping` say). Also in `RELAY_ARGS`.
- With `--public` and no password (`--token` / `COLLAB_TOKEN`), either flag stops the start with a line saying they need
  the relay's password. The socket's password rule is the usual one (`?token=`); nothing of OSC carries or logs it.
- Start lines: `OSC: out to 127.0.0.1:9000, 192.168.1.20:7000; in on UDP 127.0.0.1:9001` and, with `--trackers`, that the
  trackers go as OSC for the room whose output page asks. A port in use for `--osc-in` stops the start (as `--trackers`).

### The trackers as OSC (the relay itself)

With `--trackers` and `--osc-out`, and the trackers asked for by an output page (`osc-cfg { trk: true }`; the room of
the latest such member still connected): on every bridge datagram (at most 120 a second), one message per device in it
seen in the last 5 s (trackers, the Index and its controllers; never base stations), in that room's coordinates from its
`trk` key (`trk.on` and `m` lined up; `frameOf`, `toRoom`, `quatToRoom` as `@trk`): address `/room/tracker/<serial>`,
types `fffffffis`: x, y, z, qx, qy, qz, qw, ok (1 or 0, 0 once 0.5 s old), kind (`'t'`, `'h'`, `'l'`, `'r'`). Every 2 s
also `/room/tracker/<serial>/name` `s` with its name from `trk.names` (`''` none). Counted with the room's OSC. Raw SteamVR
space is never sent. `relay/trackers.mjs` gains `o.onTake(list)` (called after each good datagram with its readings) or
an equivalent the lane chooses; `@trk` is unchanged.

## Wire 4: OSC on UDP (defaults)

Every address the page or the relay makes. `<slot>` is 1 to 16 (below), `<id>` an item's id, numbers as OSC floats.

| Address | Types | Args | From |
| --- | --- | --- | --- |
| `/studio/cube/<id>/<ev>` (`enter`, `leave`, `on`, `off`) | `ssssi` | who's name, who's colour (`#rrggbb` or `''`), who's member id (`''` nobody), the cube's name, 1 (`enter`, `on`) or 0 | page |
| `/studio/item/<id>/<ev>` (`press`, `hover`, `unhover`) | `ssssi` | as above (1 press, hover; 0 unhover) | page |
| `/studio/seq/<id>/<ev>` (`start`, `stop`) | `ssssi` | as above (1 start, 0 stop) | page |
| `/studio/seq/<id>/at` | `ssssif` | as above, 1, the marker's `t` (s) | page |
| an entry's own `osc` address | the same types and args as its default | | page |
| `/room/person/<slot>/head`, `/room/person/<slot>/hand/l`, `/hand/r` | `fffffff` | x, y, z, qx, qy, qz, qw (room coordinates) | page (People raw) |
| `/room/person/<slot>/info` | `ssss` | name, colour, member id, kind (`ar`, `vr`) | page (on change and every 2 s) |
| `/room/person/<slot>/gone` | | | page |
| `/studio/item/<id>/pose` | `fffffffi` | x, y, z, qx, qy, qz, qw, shown (1 or 0) | page (Items raw) |
| a stream's own address | `ff` | the value scaled 0 to 1, the value as measured (m, degrees) | page (Streams) |
| `/room/tracker/<serial>`, `/room/tracker/<serial>/name` | above | above | relay |

Incoming addresses the page always takes (when OSC is on; `<ref>` an item's id or its exact name):

| Address | Args | Action (`act`) |
| --- | --- | --- |
| `/studio/press` | `s ref` | `press` |
| `/studio/seq/start`, `/studio/seq/stop`, `/studio/seq/toggle`, `/studio/seq/rewind` | `s ref` | the same |
| `/studio/show`, `/studio/hide`, `/studio/flip`, `/studio/clear` | `s ref` | the same |
| `/studio/beat` | `f bpm` (or `i`) | `beat` with `at` = now: each such message is a beat (send one per beat to lock the phase) |
| `/studio/beat/stop` | | `beat` with bpm 0 |

Plus the page's own incoming mappings (Lane PAGE). Anything else is shown in the page's log and ignored.

## Wire 5: MIDI (the output page, Web MIDI)

- Access: `navigator.requestMIDIAccess({ sysex: false })` only (Chrome, Edge; elsewhere the page says MIDI needs Chrome or
  Edge). The page uses only: `access.outputs` and `access.inputs` (iterated with `.values()`), `access.onstatechange`
  (assigned), `port.id`, `port.name`, `port.state`, `output.send(array)` (no timestamp: timing by the page's timers),
  `input.onmidimessage = fn` (assigned, `e.data` a `Uint8Array`). The tests' stub implements exactly this.
- One output port and one input port, picked by name (kept in `localStorage`; none picked: the first of each).
- Events: an entry with `note`: note on (`0x90 | ch-1`, note, `val` default 100), then note off (`0x80 | ch-1`, note, 0)
  after `noteLen` ms (default 100) or, with `hold`, at the paired end (`enter`/`leave`, `on`/`off`, `hover`/`unhover`,
  `start`/`stop`; held per item, entry and who; a person gone, Stop, MIDI off: every held note off). An entry with `cc`:
  CC (`0xB0 | ch-1`, cc, `val` default 127), with `hold` 0 at the paired end. `ch` 0 (*by person*): the channel is
  `who`'s slot (no slot or `who` `''`: channel 1).
- Streams: CC (`0xB0 | ch-1`, cc, round(value 0..1 * 127)) only when the 0..127 value changes.
- In: note on (velocity > 0), note off (or note on with velocity 0), CC, program change, and the realtime bytes clock
  (`0xF8`), start (`0xFA`), continue (`0xFB`), stop (`0xFC`), for the incoming mappings; clock also for the beat
  (*MIDI clock to the room's beat*, off by default): bpm = 60000 / (24 x the median of the last 48 tick intervals); a beat
  at every 24th tick counted from the last start (or the first tick heard); `act({ do: 'beat', bpm, at })` when bpm moved
  by 0.5 or more, or the beat's predicted moment is more than 20 ms off, at most once a second; stop: `act({ do: 'beat',
  bpm: 0 })`. Times by `HOST.collab.now()` (the room's clock) at the message.
- Slots: each person in a headset (members with a head in presence) gets the lowest free slot 1 to 16 as first seen
  (kept while the page runs; freed 60 s after they leave); the 17th and later have none (not sent by slot).

## `layout.json`: the `send` entries (lane STUDIO)

A **send entry**, fields written in this order, only those set:

```
{ on, t, osc, note, cc, val, ch, hold }
```

- `on`: by the record: a cube `'enter' | 'leave' | 'on' | 'off'`; a press record (`press.send`, objects and shapes)
  `'press' | 'hover' | 'unhover'`; a sequence `'start' | 'stop' | 'at'`.
- `t`: required for `'at'` only (0 to 600 s, to 0.01; past `len` kept, never reached); absent otherwise.
- `osc`: an address of its own, `/^\/[A-Za-z0-9_.\-\/]{0,127}$/` without `//`; absent: the default (Wire 4).
- `note` or `cc` (never both): an integer 0 to 127; neither: OSC only.
- `val`: 0 to 127 (only with `note` or `cc`); absent: 100 for a note, 127 for a CC.
- `ch`: 0 to 16 (0: by person); absent: 1 (1 is never written).
- `hold`: `true` only with `note` or `cc` and `on` one of `'enter'`, `'on'`, `'hover'`, `'start'`.
- At most 8 entries a record; an exact duplicate is dropped; an entry that is not one is dropped and counted when read
  from a layout (said on the Scene pane with the other bad entries, as `plays`). The list is kept only when it has an
  entry. A press record is kept when any of `do`, `hover`, `send` has an entry (an item with only send entries is
  pressable: a click writes its stamp).
- Where: a cube `{ ..., plays, send }`; `press: { do, hover, send, who }` (`who: 'own'`: its `press` sends happen only on
  that device and never reach the output page: its card says so); a sequence `{ ..., ev, send }` (`sync: 'own'`: the
  same).
- A cube's `send` is the owner's opt-in: no `send`, nothing about that cube is ever sent.
- Delete, Duplicate, groups' copies: `send` belongs to its own record and names nothing else, so a copy copies it and
  nothing else changes.
- A motion's **`beat`**: one of 0.25, 0.5, 1, 2, 4, 8, 16 (beats a period), absent: off. While the room has `bt`, the
  motion's cycle count is `c = sign(speed) x (behNow() - bt.at) / (beat x 60000 / bt.bpm)` in place of
  `(speed / 60) x t` (its `start: 'shown'` ignored meanwhile); without `bt`, as before. Pause and rests as ever.

## Lane STUDIO (`tools/studio/`, one round)

1. Validation: one `normSend(list, kind)` for `readLayout`, `collabApply`, the cards and `scan.mjs` if it checks records;
   motion `beat`; the state fields `sw.<id>` and `bt` in `collabState` and `collabApply`.
2. `sw` as a source in the cubes' rule (`triggerStep`, `cubeSwitch`, beside `pressShowHide`'s sources); `bt` in the
   motions (`motionDelta`'s cycle count).
3. The effect `send` out (Wire 1) from cubes and pointing, with the rate limits; in, through `studioEffect`.
4. `HOST.cur.out` and `STUDIO.out` (Wire 2), its events and actions; `STUDIO.sends()`; for tests also
   `STUDIO.sendSet(id, list | null)` (a record's `send`, or a press's `send`, written as an edit with one Undo step,
   validated as a layout's) and `STUDIO.beatSet(motionItemId, beat | null)`.
5. The cards, page HTML and headset canvas twins from the same blocks:
   - A cube's card: *Sends to the output page: Off / On* (On adds `[{ on: 'enter' }, { on: 'leave' }]`, Off takes the
     list away; one Undo step each), a line: *Only that someone walked in or out goes to the room (with their name and
     colour); what the cube shows stays each person's own.*, then one row per entry in words (*Walking in · OSC
     /studio/cube/ab12cd/enter · note 36, channel 1, held while inside*), *Try* (the effect with `try: 1`), ✕ (one Undo
     step), and *Add a send...*: When (the record's `on` values, *At ... s* with the sequence card's nudges for `'at'`),
     MIDI (*None*, *Note*, *Controller*; the number and value with −12 −1 +1 +12 / −10 −1 +1 +10 steps, a page also by
     typing), Channel (1 to 16 or *By person*), *Hold until ...* (where allowed), OSC (*Default address* shown; on a page a
     field for its own address, in a headset only the default or the one it has), a sentence, *Add* or *Replace*.
   - An object's and a shape's card: *Sends* under *When pressed* / *While pointed at*, `on` *When pressed*, *As
     pointing begins*, *As pointing ends*; the Items pane's faint line *sends*.
   - A sequence's card: *Sends* (*At the start*, *At the stop*, *At ... s*).
   - A motion's card: *On the beat: Off / ¼ / ½ / 1 / 2 / 4 / 8 / 16* with a line: *Follows the room's beat (from the
     output page's MIDI clock or OSC) while there is one.*
   - A selected item with sends: no new lines in the scene (nothing see-through; nothing new drawn).
6. Rebuild `stories/studio.js` (`node tools/studio/build.mjs`); `tools/studio/SPEC.md` section "Sends to the output page
   (MIDI and OSC)"; `docs/agents/studio.md` a bullet; `tools/studio/README.md` if it lists record fields.

## Lane PAGE (`output.js`, `shared.js`, one round)

1. `shared.js`: FORMAT `networks-51`; `&output` in `boot` (a computer's page, `DEV === 'screen'`; on a phone or headset:
   ignored); *Output page (MIDI and OSC)* in the Shared dialog's room row (computer pages in a room not on this device
   only), with a line saying what it is; `output.js` loaded on demand from `appRoot()` as `peerjs.min.js` is, then
   `HOST.out.start(why)`; reload resume (v161: the address carries `&output` while it runs, `pageFlag()`; no sessionStorage); hello and presence
   `out`; `P.out`, *output page* in both people lists; `@osc` taken in `onFx` only with `by` `''`, handed to `HOST.out`;
   `HOST.collab.outOn()` (true while this page runs as the output page), `HOST.collab.osc(msgs)` (sends `{ t: 'osc' }`,
   false when not on a relay or not open), `HOST.collab.oscCfg(o)`, `HOST.collab.people()` (`[{ id, name, color, kind,
   st, body }]`: every member in a headset with a head heard in the last 2 s, `body` from `body(id)`), and the hubs
   keeping `out` in their members list. Every listener the page adds on `window`, `document` or MIDI objects is added
   with `HOST.quiet` set.
2. `output.js`: `HOST.out`. Starting follows a studio circle (the first by id; a picker of the room's circles, a
   non-studio one giving people and trackers only), sets `body.outp`, shows the overlay `#out` (a side panel at the right,
   420 px, scrolling; the story's picture stays visible at the left, so the studio's panel and cards stay usable; CSS injected once, `OUT_CSS`). Sections:
   - Status: room, relay, circle, scene, *Stop*; a warning while the tab is hidden (*Keep this tab in front: a hidden tab
     stops the scene's frames*).
   - MIDI: *MIDI: Off / On*, output and input pickers, status, *Test note* (60 on channel 1).
   - OSC: what the relay says (`osc` from `/api/ping` and `@osc` `st`), *OSC: Off / On*, *Trackers as OSC (the relay):
     Off / On* (`osc-cfg`).
   - Events: *The scene's sends* (always on while MIDI or OSC is), *Every press and sequence on the default addresses:
     Off / On*, *Also what this page caused: Off / On* (off by default: events whose `who` is this page are not sent).
     How an event is sent: each entry of `ev.send` gives one OSC message (its `osc` or the default address, Wire 4)
     while OSC is on, and a MIDI message when it has `note` or `cc` while MIDI is on; an event with `send` `[]` (a press
     or a sequence's start or stop without entries) goes out only with *Every press and sequence* on, as one OSC
     message on its default address (no MIDI).
   - People: slots, names, colours, kind; *People as OSC: Off / On* (15 a second at most each), *Everyone in the room /
     At this circle*.
   - Items: *Items as OSC: Off / On* (`pose` of each item that moved more than 1 mm or 0.2 degrees, or was shown or
     hidden, at most 30 a second each; all once as it is turned on).
   - Streams and Incoming: tables with Add, edit, ✕, on/off per row, a live value per stream, *Learn* per incoming row
     (the next MIDI or OSC message fills its `from`).
   - Log: the last 200 messages in and out (`HOST.out.log()`).
   - *Export* (downloads `output-mapping.json`) and *Import* (a file or pasted text, validated, replacing the mapping).
3. The mapping, in `localStorage` `outMap` (validated on read, a bad row dropped and said): `{ out: 1, opt, streams,
   incoming }`:
   - `opt`: `{ midi, midiOut, midiIn, osc, oscTrk, all, echo, people, peopleWhere: 'room' | 'circle', items, clock,
     noteLen }` (booleans off by default, `noteLen` 100, `peopleWhere` `'room'`).
   - A stream: `{ id, on, name, src, v, min, max, curve, smooth, hz, midi, osc }`: `src` `{ k: 'head' | 'hand' | 'tracker'
     | 'item' | 'dist', who: 1-16 | 'any', hand: 'l' | 'r', id, a, b, flat }` (`'any'`: the lowest slot present; `dist`
     between endpoints `a` and `b`, each `{ k: 'head' | 'hand' | 'tracker' | 'item', who, hand, id }`, `flat: true` along
     the floor only), `v` `'x' | 'y' | 'z' | 'yaw' | 'pitch' | 'speed' | 'd'` (`'d'` for dist only; height is a head's
     `'y'`), `min` and `max` the measured range mapped to 0 to 1 and clamped, `curve` `'lin' | 'inv'`, `smooth` 0 to 0.95
     (each sample: `y += (1 - smooth) * (x - y)`), `hz` 1 to 60 (anything using a person at most 15), `midi` `{ ch: 1-16,
     cc: 0-127 } | null`, `osc` an address or `''`.
   - An incoming row: `{ id, on, name, from, act }`: `from` `{ midi: 'note' | 'cc' | 'pc' | 'start' | 'stop' | 'continue',
     ch: 0 (any) | 1-16, n: 0-127, min: 1-127 (a CC fires as it crosses min upward; default 64) }` or `{ osc: address,
     arg: index of the number to test (default 0), min (default 0.5; no number: fires) }`; `act` `{ do, id, hold }` with
     `do` from the table of `act()` (not `beat`), `hold: true` for `show`/`hide`/`start`/`stop` (note off, or the value
     back below `min`, does the opposite).
   - Ids six characters `[a-z0-9]`; at most 64 streams and 64 incoming rows.
4. `HOST.out` for tests: `start(why)`, `stop()`, `on()`, `state()` (`{ on, phase, room, via, station, story, studio:
   bool, midi: { on, ok, err, outs, ins, out, in }, osc: { on, relay, sent, got, dropped }, people: [{ slot, id, name,
   color, kind }], opt, streams, incoming, events }`), `log(n)` (`[{ at, dir: 'out' | 'in', via: 'midi' | 'osc' | 'room',
   text, m }]`, `m` the MIDI bytes or the OSC message array), `map(json)` (get; with an argument set, returning the
   problems found), `midiIn(bytes)` and `oscIn(msg)` (as if from the port or the relay).
5. Its own test and docs (below; `tools/output/README.md`: loopMIDI on Windows, the IAC Driver on macOS, `snd-virmidi` or
   a2jmidid on Linux, Cardinal's MIDI modules, the relay's flags, the address tables of this file by reference).

## Lane RELAY (`relay/`, one round)

1. `relay/osc.mjs`: `encode(msg)` (Wire 3's JSON message to an OSC 1.0 datagram: address and type tags NUL-padded to 4
   bytes, int32 and float32 big-endian, strings NUL-padded), `decode(buf)` (messages and bundles, Wire 3's normalised
   types; `null` for a bad packet), `makeOsc({ out, inAddr, inPort, log })` (sockets, sends, the incoming callback,
   counts, lookups), each testable without the server.
2. `relay/server.mjs`: the flags and start lines, `osc` and `osc-cfg` messages, `out` in hello and `pub`, `@osc` in and
   status, `/api/ping`'s `osc`, the trackers' OSC, `'output.js'` in `APP_FILES`, the `--public` rule, help text, a clean
   close of the sockets as the relay stops. No member's address, no target's contents, no password in a log line.
3. `relay/trackers.mjs`: the per-datagram hook; nothing else changes.
4. `relay/README.md`: "OSC and the output page" (the flags, an example `node relay/server.mjs --lan --trackers --osc-out
   127.0.0.1:9000 --osc-in 9001`, what goes where, the password rule).

## Tests

Cheap checks for every lane: `node --check` on every changed `.js`/`.mjs`. Each lane runs only its own tests, once at the
end, and does not chase failures that are the machine's. Playwright: `ln -s /opt/node-tools/node_modules
/home/user/airportnetworks/node_modules` only while running, removed after. Screenshots (few, 640 x 400) to
`/tmp/claude-0/-home-user-airportnetworks/807e65b1-c085-5dcc-a329-4d92419b27cf/scratchpad/output-shots/`.

- **RELAY**: `node relay/test.mjs --osc` (a new part, also in the full run): the codec (round trips of every type,
  padding at every length mod 4, a bundle in a bundle, bad packets refused, int64 and float64 normalised); a relay with
  `--osc-out 127.0.0.1:<a UDP listener> --osc-in 0`: a member with `out: 1` sends `osc` and the listener gets the exact
  bytes; a member without `out` is refused; the rate cap drops and counts; a datagram sent to the in port reaches only
  the `out` members as `@osc`; `osc-cfg` answers with `st`; `/api/ping`'s `osc`; `--public` without a password refuses to
  start, with one it starts; with `--trackers 0` and `tools/trackers/fake.mjs`, the room's `trk` lined up by a `set`, the
  listener gets `/room/tracker/<serial>` in room coordinates equal to `@trk`'s within 1 mm. Then `node relay/test.mjs`
  (whole) once.
- **STUDIO**: `node tools/studio/build.mjs` then `--check`; `node tools/studio/scan.mjs tools/studio/test/scenes --check`;
  a new smoke block `node tools/smoke.mjs http://127.0.0.1:8123/ --only 'studio sends'`: validation (a layout with good
  and bad entries: kept, dropped, counted), both twins of each card show the rows, `STUDIO.sendSet` and Undo; with a
  listener on `STUDIO.out`: a press stamp gives `'press'` with its `by`, a sequence's start, an `'at'` and its stop, an
  everyone cube entered by a pretend head gives `'enter'` with that head's id, `studioEffect('send', ...)` gives the
  event with `who` = by; this device entering its own cube with sends calls `HOST.collab.effect('send', ...)` (a spy)
  and one without sends does not; `act()` for each `do` writes `pr`, `qr`, `sw`, `bt` and refuses as the table says;
  `sw` shows, hides and switches a cube; a motion with `beat` follows `bt`'s phase. Also `--only 'studio press'`,
  `'studio sequences'` and `'studio cube switches'` once (nothing of theirs broken).
- **PAGE**: `tools/output/test-page.mjs` (Playwright; a served folder; a room on this device, `#net=...`, or the existing
  relay; MIDI stubbed as in Wire 5; `HOST.cur.out` stubbed by a fake studio API with two items, so it needs neither of
  the other lanes): starting from `&output` and from the dialog, the overlay, MIDI ports picked, an event with a note
  entry gives note on and off bytes on the stub (and held ones at their pair), CC streams from pretend presence (the
  shell's test hooks for presence), incoming note and CC and OSC (`HOST.out.oscIn`) call the stub's `act` as mapped,
  MIDI clock at 120 bpm gives `act({ do: 'beat', bpm: ~120 })`, export and import round trip, `HOST.collab.osc` false
  off a relay. Then `node tools/smoke.mjs http://127.0.0.1:8123/ --only 'developer mode'` (a quick check that the shell
  still starts).
- **Integrator, end to end**: `node tools/collab.mjs --output` (a new round): a relay with `--osc-out 127.0.0.1:<UDP
  listener in the test> --osc-in 0 --trackers 0 --scenes <the test scenes>`; the output page (`#s=XYZ&output`, MIDI
  stubbed by `addInitScript`, sends kept in `window.__midiSent`) following a studio circle; send entries written with
  `STUDIO.sendSet` from a second page; then (1) a pretend headset walking into a cube with `[{ on: 'enter', note: 36 }]`:
  the listener gets `/studio/cube/<id>/enter` with that headset's name, colour and id, and `__midiSent` a note on 36;
  leaving gives `leave` (and the note off); a cube without `send`: nothing at all, from the effect to UDP; (2) a press
  from the second page: `/studio/item/<id>/press`; (3) UDP `/studio/press <id>` into the relay's in port: the room's
  `pr.<id>` advances; an incoming MIDI note mapped to `start` a sequence: its `qr.<id>.on`; `/studio/hide <id>`: `sw.<id>`
  and the item hidden on the second page; (4) 48 clock ticks at 120 bpm: `bt.bpm` within 0.5 of 120; (5) the fake bridge
  and `trk` lined up: `/room/tracker/<serial>` datagrams; (6) *People as OSC*: `/room/person/1/head`; (7) a stream head
  `y` to CC 7: `0xB0 7 v` on the stub. Then the release run as ever (smoke, `relay/test.mjs`, the collab rounds touched:
  `--preview`, `--studio`, `--quick`).

## Known limits (say them in the docs) and untested

- A hidden output tab stops the scene's frames (browsers throttle them): everyone cubes, presses' and sequences' events
  and Items wait until it is in front again (effects still arrive). Keep it in front, on its own screen or window.
- Person-own cubes switched by that person's own cubes or presses: the output page sees only shared switches (`'on'`,
  `'off'` events and its own view of shown and hidden).
- Own presses (`who: 'own'`) and own sequences (`sync: 'own'`) never reach the output page.
- OSC goes to every target alike; no per-target routing. No OSC in peer-to-peer rooms or a room on one device.
- Two people pressing within a few hundred ms may lose a press (as ever); a note held for a person who leaves the room
  ends when they are gone (2 s).
- Only one room's trackers as OSC per relay (the latest output page that asked).
- Untested until tried on the owner's machines: Web MIDI with real virtual ports (loopMIDI, IAC, ALSA) and Cardinal, real
  MIDI clock jitter from a DAW, OSC to real apps (TouchDesigner, Max, Pd, Cardinal has no OSC), UDP through Windows'
  firewall, the trackers' OSC rate on the PC, cubes and pointing with real headsets, how in time it all feels. Only
  headless Chromium with stubs and UDP on 127.0.0.1 here.

# v158: streams in the scene, trails, loops on the beat, MIDI clock both ways

The owner, 17 November 2026: values to send for objects ("xyz plus velocity plus what else"), the scene's streams set on
an item's card (the recommendation they chose), trails "for both [items and people's hands] and show to everyone at the
circle", a loop recorder "movement for now, both clocks should be possible", then "also do the events". This section is
the contract between lane STUDIO (`tools/studio/`, `stories/studio.js`), lane PAGE (`output.js`, `tools/output/`) and the
integrator (FORMAT, VERSION, release, `docs/agents/`, HANDOVER, whatsnew). **FORMAT networks-52** (records gain `stream`,
`trail`, a path's `sync`/`beats`, a sequence's `beats`, `settings.hands`, an event kind `press` and `send`, `bt.bar`):
the integrator bumps it in `shared.js`; lanes write `networks-52` where they mention it.

## 1. The room's beat with bars (`bt`)

- `bt` = `{ bpm, at, bar, by }`. New: `bar`, beats per bar, an integer 1 to 16, **written always from v158**; with `bar`,
  `at` is the room's ms of a **downbeat** (a bar's first beat). A `bt` without `bar` (an older writer) reads as `bar: 4`
  with `at` taken as a downbeat. Helpers in the studio (lane STUDIO, also exported on `HOST.cur.out`): `beatMs()` =
  60000 / bpm; `beatPos(now)` = (now - at) / beatMs (beats since that downbeat, may be negative); `barPos(now)` =
  beatPos / bar.
- `act({ do: 'beat', bpm, at, bar })`: `bar` optional (absent: the current `bt.bar`, else 4); `bar` outside 1..16 refused
  (*bar 1 to 16*). Same rate limit as before. `HOST.cur.out.beat()` returns `bar` too.
- Writers: the output page (MIDI clock in, OSC in, or its own tempo: section 5). Nothing else writes `bt`.

## 2. Streams in the scene (an item's card: *Streams*)

- A record of an object `o`, shape `p`, empty `e`, sound `s` or cube `c` may carry `stream`: a list (1 to 8, kept only
  when it has an entry; at most 64 entries in a scene, beyond them dropped and counted, said on the Scene pane as the
  other bad entries) of entries, fields in this order, only those set:
  `{ v, min, max, curve, smooth, hz, cc, wide, note, at, vel, val, ch, osc }`
  - `v` (required): what is measured.
    - Pose and motion of the item as drawn (`out.pose`; cubes too: a cube's middle): `'x' 'y' 'z'` (m, scene/room frame),
      `'yaw' 'pitch' 'roll'` (degrees, -180..180 / -90..90 / -180..180; yaw and pitch as the page's streams measure them
      today, roll about the item's own forward axis), `'speed'` (m/s), `'vx' 'vy' 'vz'` (m/s, signed), `'acc'` (m/s²,
      magnitude), `'spin'` (deg/s, magnitude of its turning speed).
    - The item's state (computed by the studio: `out.value`): `'size'` (its drawn scale over its placed scale, a pulse
      motion's, 1 at rest), `'shown'` (0 or 1, as on the device running it), `'clip'` (its clip's phase 0..1, 0 none),
      `'path'` (its recorded path's phase 0..1), `'motion'` (its motion's phase 0..1), `'near'` (m: the distance from its
      middle to the nearest head of a person in a headset at the circle, `heads()`; none: no value).
    - Cubes only: `'count'` (how many people's heads at the circle are inside it now, by `heads()`, 0..).
  - `min`, `max`: the measured range mapped to 0..1 and clamped (numbers, min ≠ max; absent: the value's default range,
    table below); `curve` `'inv'` (absent: linear); `smooth` 0..0.95 (absent 0); `hz` 1..60 (absent 30; `near` and
    `count` at most 15).
  - Output, one of: `cc` 0..127 (a stream: a CC whenever the 0..127 value changes; `wide: true` makes it 14-bit, CC `cc`
    the high 7 bits and `cc + 32` the low ones, allowed only for `cc` 0..31); or `note` 0..127 (a threshold: note on when
    the scaled value crosses `at` upward, `at` 0.01..0.99, absent 0.5; note off when it falls below `at - 0.05`, or after
    the page's note length if it never does within 2 s; velocity `vel: 'speed'` = 1 + round(126 × min(1, the item's speed
    / 3 m/s)) at the crossing, else `val` 1..127, absent 100). Neither: OSC only. `ch` 1..16 (absent 1; 0 by person is not
    offered for streams).
  - `osc`: an address of its own (the send entries' rule); absent: `/studio/item/<id>/<v>` (cubes `/studio/cube/<id>/<v>`),
    args `ff` (scaled 0..1, value as measured); a threshold also sends `i` 1 or 0 on that address + `/gate`.
  - Default ranges: x, z -3..3; y 0..2.5; yaw, roll -180..180; pitch -90..90; speed 0..3; vx vy vz -3..3; acc 0..20;
    spin 0..720; size 0.5..2; shown, clip, path, motion 0..1; near 0..4; count 0..4.
  - Validation (`normStream`, one function, lane STUDIO; the page validates again as it reads `list()`): a bad entry
    dropped and counted; an exact duplicate dropped; `cc` with `note` both: bad; `wide` without `cc` or with cc > 31: bad.
- The card (page and headset, editing on; not for a visitor; not refused by a lock in place): *Streams*: a row per entry
  (*Speed → CC 21 ch 1*, *Y → note 36 at 50 %*), each with *Try* (sends a 0 → 1 → 0 sweep over 1 s through the effect
  `send` with `try: 1` and `ev: 'stream'`, `v`) and ✕; *Add a stream...*: the value (grouped: Where, How it moves, Its
  state, People), then CC or Note (number with − / +, channel), the range (*Range from its movement*: watches for 5 s and
  takes min and max of what it measured, widened by 5 %; or − / + on each end), smoothing, OSC address (page only, a text
  field). One Undo step each. The Items card gains *streams 2* in its faint line.
- `HOST.cur.out` gains (lane STUDIO): `list()` items carry `stream` (copies of the validated entries, `[]` none);
  `value(id, v)` → number | null for the state values (`size shown clip path motion near count`; null for the kinematic
  ones, which the page measures from `pose()` itself); `pose(id)` also for cubes (their middle, yaw only).

## 3. Trails (everyone at the circle sees them)

- A record of an object, shape, empty or sound may carry `trail` `{ len, w, col }`: `len` 0.5..10 s (absent 3), `w` 0.005
  ..0.1 m (absent 0.02), `col` `'#rrggbb'` (absent: the item's own colour: a shape's colour, else the studio's accent
  for its kind). Present: drawn always (editing or not, on every device at the circle and pages following it); absent:
  none. Behind the item's middle as drawn (motions, paths, behaviours, carries, trackers: where each device draws it).
- The scene's settings gain `hands`: `{ len, w }` (absent: off; written only when on), people's hand trails: each person
  in a headset at the circle (`HOST.collab.persons()` / `body()`, smoothed presence; this device's own hands from its
  controllers or tracked wrists) leaves a trail from each hand in their colour. A row on the Scene pane while editing
  (*Hand trails: Off / On*, length, width), one Undo step, shared as every setting.
- Drawn by each device from what it draws (nothing new is sent). One batched draw for every trail: a camera-facing
  ribbon (two vertices per sample), sampled at most 60 a second and at least every 2 cm of movement, its colour fading to
  black by age and blended additively in the ships' way (colour One/One, alpha Zero/One, `ADD` in `ships.js`), so it adds
  light and never darkens and leaves the layer's alpha alone in AR; depth-tested, no depth write. At most 16,384 ribbon
  vertices a frame (beyond: the oldest samples of the longest trails dropped first, counted in `STUDIO.trails()`).
  A trail jumps (no line across) when its item jumps more than 1 m in a frame or is hidden. Nothing while away from the
  station.
- `STUDIO.trails()` for tests: `{ items, hands, verts, dropped }`.

## 4. Loops on the beat (movement and events)

- **Movement.** A recorded path gains `sync: 'beat'` and `beats` (an integer 1..256), both or neither. While the room has
  `bt`: the path's moment s = ((beatPos(now) mod beats) / beats) × D (D its recorded length), so it loops exactly on the
  beat and stretches with the tempo (its `play`, `speed`, `start` ignored meanwhile); without `bt`, as before. A cube's
  start of it, a timeline hold and Pause win as they win over a path's clock today.
  - Its card's path rows gain *On the beat: Off / n beats* (− / + by a bar, *Fit*: the nearest whole bar to its length
    at the current tempo), and the recorder gains *Record on the beat: 1 / 2 / 4 / 8 bars* (only while the room has `bt`;
    greyed with *needs the room's beat (output page)*): armed, it counts in to the next downbeat (the card says *in 3*,
    *in 2*, ...; a soft `step` sound at the item on each beat of the count-in), records from that downbeat exactly
    bars × bar beats of the room's beat (on a headset while carried: the carry may start any time before; let go early,
    it stays where let go until the end), stops itself at the end downbeat, joins the loop (the existing loop join) and
    writes `path` with `play: 'loop'`, `sync: 'beat'`, `beats`, its key times in seconds at the tempo it was recorded at.
    One Undo step. The tempo changing mid-recording: samples are taken by beat position and converted at the end, so the
    loop is exact in beats.
- **Events.** A sequence gains `beats` (an integer 1..256): while the room has `bt`, its time t = ((beatPos(now) - its
  start beat) mod beats) / beats × len for a loop (its start rounded down to a downbeat), so it runs locked to the bar;
  without `bt` as before. New event kinds (SEQ_WHAT gains them; FORMAT networks-52):
  - `{ t, on, what: 'press' }`: fires the item's press as if pressed (its `do` entries for everyone, its sends: the
    output page hears `press` with `who` `''`), on an object or shape with a press record.
  - `{ t, on, what: 'send', ev }`: `ev` `'enter' | 'leave'` (a cube) or `'hover' | 'unhover'` (an item): only its send
    entries go out (the output page hears that event with `who` `''`, as from the sequence); nothing is shown or hidden.
  - A sequence card's recorder: *Record events: 1 / 2 / 4 / 8 bars*, *Grid: 1/16 · 1/8 · 1/4 · Off*, *Overdub: on/off*
    (on: added to the events it has; off: replaces the recorded kinds `press`, `send`, `show`, `hide`, `seq` it had and
    keeps clips, sounds, paths, motions, pictures). Needs the room's `bt`. Count-in as the movement's; it records, from
    any device (page or headset; the output page too through `act`), what happens on shared sources during those bars:
    a new press stamp `pr.<id>` → `press`; a `send` effect enter/leave/hover/unhover with send entries (and the device's
    own) → `send`; an outside switch `sw.<id>` → `show`/`hide` (flip resolved); another shared sequence started or
    stopped → `seq`. Times as beat positions, quantised to the grid, written as seconds at the tempo then; `len` = bars ×
    bar × beatMs/1000, `beats` = bars × bar, `loop: 'loop'`; the sequence started on the beat at the end (its `qr`).
    One Undo step. At most 200 events (the existing cap): beyond them dropped and said.
- `STUDIO.loops()` for tests: `{ armed, phase: 'count' | 'rec' | '', id, kind: 'path' | 'seq', from, to, got }`, and a
  clock hook the tests set (`loopClock`), as `recClock` and `trgClock`.

## 5. MIDI clock both ways (lane PAGE)

- **In** (as v157, plus): Start (0xFA) marks a downbeat at that moment (the next tick's beat), Song Position Pointer
  (0xF2, sixteenths) sets the tick count (a beat is 24 ticks, a sixteenth 6), so `at` names a downbeat; *Beats a bar*
  (1..16, default 4) on the MIDI part sets `bar`. Stop (0xFC) removes `bt`. OSC in: `/studio/beat f bpm [i bar]` (each a
  beat, as before), new `/studio/bar f bpm [i bar]` (each a downbeat).
- **The room's own tempo** (room as master): a *Tempo* part: bpm field (20..300), *Beats a bar*, *Tap* (4 taps or more,
  the median interval), *Start* (writes `bt` with `at` = the next 10 ms rounded room moment as a downbeat), *Stop*
  (removes it). Disabled while *MIDI clock to the room's beat* is on and clock is coming in (the page says who leads).
- **Out** (*MIDI clock out*, off by default, to the chosen output port): while `bt` is set, 24 clock bytes a beat, sent
  with Web MIDI timestamps (`output.send(bytes, ts)`, ts in `performance.now()` ms from the room's time: `ts = perf +
  (roomMs - rnow())`), a scheduler every 25 ms looking 100 ms ahead; when `bt` appears or its downbeat moves by more than
  a tick (another writer), Stop then Song Position (the bar's start) and Start at the next downbeat; a tempo change goes
  on at the new rate from the current phase; `bt` removed: Stop. Never sent back into the room it came from: when clock
  out and clock in are both on and `bt.by` is this page because of incoming clock, clock out still runs (separate ports;
  the page warns *a loop: the input and output may be the same cable* when the two ports' names match). Clock bytes are
  not logged one by one (a line a second: *clock out 120.00 bpm*).
- **Streams from the scene** (lane PAGE): the page reads `list()` once a second (and at once on `STUDIO.rev` changes if
  exposed) and runs each item's `stream` entries beside its own table's rows (shown under *Streams from the scene*,
  read only, with their live value); kinematic values measured from `pose(id)` every frame (velocity and acceleration
  from the drawn pose with the frame's own time, smoothed as the entry says; roll from the turn), state values from
  `value(id, v)`. Its own table's sources gain `vx vy vz acc roll spin` for heads, hands, trackers and items, and `wide`
  14-bit CC and threshold notes as above. Note ends on Stop, MIDI off and the item gone, as held notes.
- Wire 4 additions: `/studio/item/<id>/<v>`, `/studio/cube/<id>/<v>` `ff`, `.../gate` `i`; incoming `/studio/bar`.

## 6. Tests and docs

- Lane STUDIO: `tools/studio/SPEC.md` sections for each (*Streams on a card*, *Trails*, *Loops on the beat*); smoke steps
  `--only 'studio streams'`, `--only 'studio trails'`, `--only 'studio loops'` (pixels for trails; clock hooks for loops;
  validation round trips through state and `layout.json`); run only those and `--only 'studio sends'`, and
  `node tools/studio/build.mjs --check`.
- Lane PAGE: `tools/output/test-page.mjs` gains clock in with Start/SPP and bar, tempo Start/Stop/Tap, clock out timing
  (24 per beat within 2 ms of their timestamps on the stub, Start at a downbeat), scene streams (velocity of a moving
  pretend item within 5 %, 14-bit pairs, a threshold note on and off, velocity from speed); `tools/output/README.md`
  (clock both ways with a DAW and Cardinal). Web MIDI's `send(bytes, ts)` added to the stub.
- Integrator: FORMAT, VERSION v158, `tools/release.mjs`, `whatsnew.json`, `docs/agents/studio.md`, `shared-rooms.md`,
  `testing.md`, HANDOVER.
- Untested here: everything with real MIDI ports, a DAW and Cardinal, timing over a real network, trails' look and cost on
  a Quest.

# v162: live sound from the output page

The owner (17 November 2026, "go as described"): the output page can **stream one sound input of its computer to the
room**, and devices that are elsewhere hear it; a studio sound item can be the live sound, heard from where it stands.
Relay rooms only. Latency of about 0.3 to 0.5 s is accepted. This section is the contract for both builders; where it
names a function, a key, a message or a text, use exactly that.

## 0. Lanes and files

| Lane | Owns |
| --- | --- |
| **A: sending** | `relay/server.mjs` (all of section 2), `relay/test.mjs` (`--snd`, also in the main run), `relay/README.md` (a paragraph "Live sound"), `shared.js` section "live sound: sending" (section 3a) plus the one line in `welcome()`, its line in `HOST.collab`, `output.js` (section 4), `tools/output/test-page.mjs`, `tools/output/README.md` ("Live sound": BlackHole 2ch and a Multi-Output Device on a Mac, VB-Audio Cable on Windows, Chrome or Edge) |
| **B: hearing** | `shared.js` section "live sound: hearing" (section 3b), its lines in `HOST.collab`, `wire()`/`connect()` (binary in), `onFx` (`@snd`), `leave()`, the Shared dialog row, the headset menu row, the phone sheet row (section 6); the studio: `tools/studio/engine/**` (section 5), `tools/studio/SPEC.md` ("Live sound"), `stories/studio.js` only by `node tools/studio/build.mjs`, `tools/smoke.mjs` (block `'studio live'`), `docs/agents/shared-rooms.md` (a section "Live sound"), `docs/agents/studio.md` (a line) |
| integrator | `sw.js` `VERSION` (no new file: nothing for `SHELL` or `APP_FILES`), `tools/release.mjs`, `whatsnew.json`, `AGENTS.md` (a line), `docs/agents/testing.md`, `docs/history.md`, optional `tools/collab.mjs --live` (end to end: an output page with a fake input, a page elsewhere hears frames) |

Neither lane touches the other's files. Placement in `shared.js` (so the merge is clean): both new sections go between
the end of `persons()` (the output page's section, "the people in a headset, for the output page") and `HOST.collab = {`:
first A's, headed `// ============================================== live sound: sending ==`, then B's, headed
`// ============================================== live sound: hearing ==`. In `HOST.collab`, A adds its line directly
after the line `osc: msgs => osc(msgs), oscCfg: ..., persons: () => persons(),`; B adds its lines directly after the
line `presIn: (id, v) => onFx(...)`. A's `welcome()` line goes as the last statement of `welcome(m)`; every other edit
outside the two sections is B's.

## 1. The wire

Text messages are JSON as ever; audio goes as **binary WebSocket frames** (opcode 2), which the relay's parser already
reassembles (it refused them with 1003: section 2 changes that).

### 1a. An audio frame (binary, both directions, unchanged by the relay but for `sid`)

16 bytes of header, big-endian, then one Opus packet (an `EncodedAudioChunk`'s bytes):

| Bytes | Field | |
| --- | --- | --- |
| 0 | `tag` u8 | `1` (an audio frame; any other tag: dropped and counted as bad) |
| 1 | `ch` u8 | channels, 1 or 2 (as the cfg) |
| 2-3 | `sid` u16 | the stream's id: the sender writes 0, **the relay writes the room's current `sid`** before forwarding |
| 4-7 | `seq` u32 | the frame's number since this `snd-start`, from 0 |
| 8-15 | `at` f64 | when its first sample was captured, on the relay's clock (`HOST.collab.now()`), ms |
| 16- | Opus | 1 to 4,000 bytes (`SND_MAX_FRAME` = 4,016 for the whole frame) |

20 ms frames at 128 kbit/s are about 320 bytes: 50 frames a second.

### 1b. Text messages

From the output page to the relay:

- `{ t: 'snd-start', cfg }`: it starts (or restarts, with a new cfg) the room's stream. `cfg` is the encoder's
  `decoderConfig`: `{ codec: 'opus', sampleRate, numberOfChannels, description? }`, `sampleRate` one of 8000, 12000,
  16000, 24000, 48000 (48000 expected), `numberOfChannels` 1 or 2, `description` (absent for Opus as Chrome makes it;
  else base64, at most 512 characters). Optional `kbps` (8 to 256, shown to listeners in the dialog line only).
- `{ t: 'snd-stop' }`: it stops.

From any member to the relay:

- `{ t: 'snd-sub', on: true | false }`: hear the room's stream, or not. The relay never sends audio to a member that has
  not said `on: true` on this socket (a reconnect starts unsubscribed: the hearing side says it again on `welcome`).

From the relay to members, as an effect with `by: ''` (the relay's own, as `@osc`; never stored, never in a key):

- to every subscriber (and to one that just subscribed, at once, while a stream runs):
  `{ t: 'fx', k: '@snd', v: { on: true, sid, cfg, kbps, by: <sender's member id> }, by: '' }`, and when it stops
  `{ t: 'fx', k: '@snd', v: { on: false, sid, why }, by: '' }`, `why` one of `'stopped'`, `'gone'` (the sender left or
  is no longer the output page), `'taken'` (another output page started).
- to the sender (and to an output page that was told `'taken'`), on every change and every 2 s while it streams:
  `{ t: 'fx', k: '@snd', v: { st: { on, mine, sid, subs, frames, bytes, dropped, bad, why } }, by: '' }`; `mine` false
  with `why: 'taken'` when another output page has the stream; `subs` the subscribers now (the listeners count).

`/api/ping` gains `snd: true`; `welcome` gains `snd: 1`. A page on a relay without them says the relay is too old.

### 1c. Limits

- One sender a room: **the latest output page that sent `snd-start`**; the one before is told `st.why: 'taken'` and
  its frames are dropped from then on (it stops its encoder and says so).
- A frame over `SND_MAX_FRAME` (4,016 bytes) or under 17: dropped, counted `bad`. At most `SND_RATE` = 100 frames a
  second a sender (`quota()`); the rest dropped, counted `dropped`.
- A subscriber whose socket is closing, destroyed, or backed up past `SND_BACKLOG` = 64 KB (`writableLength`) misses the
  frame (counted `dropped`): audio never queues up behind a slow device.
- Nothing of it is stored or logged but these lines: `<room> live sound from <id> started (<ch> ch, <rate> Hz)`,
  `... stopped (<why>)`, and the counters in the per-tick line. Never a frame's bytes, never a cfg's description.

## 2. The relay (lane A, `relay/server.mjs`)

- `Ws.frame()`/`frame(fin, op, payload)`: `op === 2` goes to `this.onbinary(payload)` when set (after the same
  closing check as text); without `onbinary`, 1003 as now.
- In `join` (where `ws.onmessage` is set): `ws.onbinary = buf => sndBin(room, m, buf)`, wrapped in try as `onmessage`
  is. The member record gains `outEver: false, snd: { n: 0, t0: 0 }, sndSub: false, sndRefused: false`; `outEver` is set
  when a hello says `out: 1`.
- A new section after the OSC one: `// ---- live sound from the output page (v162; tools/output/SPEC.md "v162")`, with
  `SND_MAX_FRAME = 4016, SND_RATE = 100, SND_BACKLOG = 64 << 10`, the room's `room.snd = { by: null (the member),
  sid: 0, cfg: null, kbps: 0, frames: 0, bytes: 0, dropped: 0, bad: 0 }` (made on first use), and:
  - `sndStart(room, m, msg)`: `!m.out` -> `sndRefuse(room, m, 'snd-start')` (once a socket, as `oscRefuse`); a bad cfg
    -> `refuse(..., 'bad snd-start: cfg { codec: \'opus\', sampleRate, numberOfChannels }', 'bad')`; else a previous
    sender (another member) gets `st` with `why: 'taken'`, subscribers get `on: false, why: 'taken'` for the old `sid`,
    `sid` = (`sid` + 1) & 0xffff (never 0: 0 skips to 1), cfg kept, counters zeroed, every subscriber gets `on: true`,
    the sender its `st`.
  - `sndStop(room, m, why)`: only the current sender (from `snd-stop`, from `leave()`, from a hello without `out`):
    subscribers get `on: false`, cfg cleared, the sender its `st`.
  - `sndSub(room, m, msg)`: `on` not a boolean -> `refuse(..., 'bad snd-sub: on true or false', 'bad')`; sets
    `m.sndSub`; `on: true` while a stream runs: that member gets `on: true` with the cfg at once. An output page may
    subscribe (the relay does not care); the shell never makes it.
  - `sndBin(room, m, buf)`: `!m.outEver` -> `m.ws.fail(1003, 'binary frames only from the output page')` (the existing
    relay test's "a binary frame: 1003" stays true); not the current sender, or no stream: dropped, counted; size and tag
    checked; over the rate: dropped; else bytes 2-3 set to `sid`, then **one** `Ws.frame(2, buf)` written to every
    subscriber but the sender under the backlog rule (as `oscIn`).
  - `sndStatus(room, m)`: the `st` above; called on change and from the existing 2 s interval for output pages.
- `message()`: `snd-start`, `snd-stop`, `snd-sub` dispatched next to `osc`/`osc-cfg`. The hello: a member that was the
  sender and now says no `out` -> `sndStop(room, m, 'gone')`. `leave()`: the sender -> `sndStop(room, m, 'gone')`.
- `welcome` gains `snd: 1`; `/api/ping` gains `snd: true` (always: no flag turns it off).
- `relay/test.mjs`: a step **"live sound"** in the main run and alone as `--snd`: `/api/ping` and `welcome` say snd; a
  plain member's binary frame: 1003; `snd-start` from a plain member: `bad`; an output page starts, a subscriber gets
  `@snd on` with the cfg and then the frames byte for byte but `sid`; a member not subscribed gets none; one that
  subscribes late gets the cfg at once; 150 frames in one second: about 100 through, `dropped` counted in `st`; a frame
  of 5,000 bytes: `bad`; a second output page's `snd-start`: the first told `taken`, its frames dropped; `snd-stop` and
  the sender leaving: subscribers told `on: false` (`stopped`, `gone`).

## 3. `shared.js`

### 3a. "live sound: sending" (lane A)

- In `welcome(m)`: `C.snd = m.snd === 1;` (a room on this device or peer to peer: never set, so false).
- `sndCan()`: `OUT.on && C.code && C.via === 'relay' && C.snd && C.ws && C.ws.readyState === 1`.
- `sndWhy()`: `''` when it can, else one of `'Live sound needs a room on a relay: not peer to peer or on this device.'`,
  `'This relay is too old for live sound.'`, `'Not connected to the room.'`, `'Only the output page streams sound.'`.
- `sndStart(cfg, kbps)`: checks the cfg as the relay does, `send({ t: 'snd-start', cfg, kbps })`; true when sent.
- `sndStop()`: `send({ t: 'snd-stop' })`.
- `sndSend(seq, at, ch, bytes)`: builds the 16-byte header (`sid` 0) and the packet into one `ArrayBuffer`, false when
  `!sndCan()` or `C.ws.bufferedAmount > 65536` (dropped here, never queued), else `C.ws.send(buf)` and true.
- `HOST.collab` line: `sndCan: () => sndCan(), sndWhy: () => sndWhy(), sndStart: (cfg, kbps) => sndStart(cfg, kbps),
  sndStop: () => sndStop(), sndSend: (seq, at, ch, bytes) => sndSend(seq, at, ch, bytes),`.
- The `st` coming back reaches `output.js` as `HOST.out.sndFx(st)` (B's `onFx` line calls it, section 3b).

### 3b. "live sound: hearing" (lane B)

- `connect()`: `ws.binaryType = 'arraybuffer'` for the relay's socket. `wire()`'s `onmessage`: a non-string `ev.data`
  goes to `liveIn(ev.data)` (after `C.heard = clock()`), never to `JSON.parse`.
- `onFx`, next to the `@osc` branch: `m.k === '@snd' && !m.by`: `v.st` -> `HOST.out.sndFx(v.st)` while `OUT.on`
  (guarded and logged as `@osc` is), else `liveFx(v)`.
- State `LV = { mode, sub, sid, cfg, by, dec, ctx, out, claim: '', next: 0, anchor: null, seq: -1, frames: 0, lost: 0,
  late: 0, level: 0, lagMs: 0, heardAt: 0 }`; `mode` from localStorage `liveSound` (`'auto' | 'on' | 'off'`, default
  `'auto'`; read and written in try).
- `liveWant()`: false while `OUT.on` (the output page never plays it back), off a relay or without `C.snd`, with mode
  `'off'`, or while `HOST.audio.muted`; mode `'on'`: true; `'auto'`: `!here()` (a computer's page is elsewhere; a
  headset elsewhere by its own setting; a camera is here).
- `liveStep()` (from the existing pump, at most 5 times a second): `send({ t: 'snd-sub', on })` when `liveWant()`
  changes, and again after each `welcome`; on unsubscribing, the decoder and nodes go (`liveDrop(why)`).
- `liveFx(v)`: `on: true` -> a new `AudioDecoder` configured with `cfg` (`AudioDecoder.isConfigSupported` first; not
  supported: `why` says so, unsubscribes), `sid` kept, the jitter buffer reset; `on: false` with this `sid` ->
  `liveDrop(v.why)`.
- `liveIn(buf)`: tag, `sid` checked; a gap in `seq` counts `lost` (the decoder simply goes on); `lagMs` from `at` and
  `HOST.collab.now()`; decoded `AudioData` copied to an `AudioBuffer` on `HOST.audio.fx()` (no context: dropped and
  counted, nothing kept) and scheduled on an `AudioBufferSourceNode` into `LV.out`.
- The jitter buffer: target **0.25 s**. The first frame after a reset (`LV.anchor`) plays at `ctx.currentTime + 0.25`;
  each next frame at the end of the one before. A frame due less than 0.03 s ahead: the schedule moves forward to
  `currentTime + 0.25` (counted `late`); more than 0.6 s ahead: moved back to `currentTime + 0.25` (counted `late`).
- `LV.out`: one `GainNode` on `HOST.audio.fx()` (made again on a new context; never a context of its own). Unclaimed
  it is connected to `ctx.destination` at `LIVE_LEVEL` = 0.8 (the everywhere case); claimed (section 5) the shell
  disconnects it from the destination and the claimer connects it to its own nodes. Its gain fades to 0 in 0.1 s while
  `HOST.audio.muted` (this device's Sound button only: not Sound effects, not Narration) and back. Not a background of a
  story: the owner asked for it, and it plays only while the output page streams.
- `level`: the decoded frames' RMS, smoothed (0 to 1), for the dialog and tests.
- API in `HOST.collab`: `liveSound()` -> `{ mode, want, on (a stream announced), playing (a frame scheduled in the last
  0.5 s), level, lagMs (capture to play-out, ms), frames, lost, late, src: 'cfg' | '' (a cfg in hand), by, claimed
  (the owner's name or ''), why }`; `liveMode()` and `setLiveMode(m)` (`'auto' | 'on' | 'off'`; anything else ignored;
  stored, `changed()`); `liveNode()` -> `LV.out` or null; `liveClaim(owner)` -> true (the destination link cut;
  `owner` a short name, `'studio'`); `liveRelease(owner)` -> the destination link back (only the claimer releases);
  `liveIn(buf)`, `liveFx(v)` for tests.
- A story change, the lobby, leaving the room: `liveRelease` of any claim (the shell does it in `leave()` and when a
  story is disposed), decoder and nodes dropped, `snd-sub` off.

## 4. `output.js` (lane A): the section *Live sound*

- A new section key `'live'` after `'osc'` in `show()`'s list, `secLive()` in `render()`'s map. It shows: a switch
  `Stream sound to the room: On / Off` (`onOff`, act `snd`); an input picker (a `<select>` of `enumerateDevices()`'s
  `audioinput`s, labelled only once permission was given: before it, one entry *Default input* and a note *Names show
  once the browser may use an input*); a level meter (a bar, its `aria-valuenow`); `kbit/s` sent; `Listeners: n`
  (`st.subs`); and a line saying why it cannot (`HOST.collab.sndWhy()`) or that another output page took it.
  Help text: *Streams one sound input of this computer to everyone elsewhere in the room (headsets and pages not in it),
  and to a studio item set to Live sound. To send what this computer plays, pick a loopback input: BlackHole 2ch with
  a Multi-Output Device on a Mac, VB-Audio Cable on Windows. About half a second late.*
- localStorage `outSnd`: `{ on, dev, kbps }` (`kbps` 128 by default). After a reload it resumes when it was on and
  `navigator.permissions.query({ name: 'microphone' })` says `granted`; else it waits for a click on the switch.
- Capture: `getUserMedia({ audio: { deviceId: dev ? { exact: dev } : undefined, echoCancellation: false,
  noiseSuppression: false, autoGainControl: false, channelCount: 2, sampleRate: 48000 } })`, then
  `new MediaStreamTrackProcessor({ track })` -> `AudioData` -> `AudioEncoder` (`{ codec: 'opus', sampleRate:
  data.sampleRate, numberOfChannels: data.numberOfChannels (1 or 2), bitrate: kbps * 1000, opus: { frameDuration:
  20000 } }`). **No `AudioContext` of its own** (the rule). Without `MediaStreamTrackProcessor` or `AudioEncoder`:
  the switch is greyed, *Live sound needs Chrome or Edge*. (No fallback through `HOST.audio.ctx` in this round: Chrome
  and Edge have both, which the output page needs anyway.)
- The first chunk's metadata gives `decoderConfig`: `HOST.collab.sndStart(cfg, kbps)` before its first frame is sent;
  each chunk then `sndSend(seq++, at, ch, bytes)` with `at = HOST.collab.now() - (chunk.duration / 1000)`. A false
  from `sndSend` counts a drop. Off, stopped, the room left, `st.why === 'taken'`, the track ended: the encoder closed,
  the tracks stopped, `sndStop()` (unless taken), the switch Off with the reason.
- `HOST.out.sndFx(st)` (new): keeps `st` for the section. `HOST.out.state()` gains `snd: { on, phase ('off' | 'asking'
  | 'live' | 'error'), dev, devs (labels), level, kbps (measured), frames, drops, st, err }`; `HOST.out.snd(on, dev)`
  for tests. `stop()` stops it first.
- `tools/output/test-page.mjs`: an init script stubs `getUserMedia` with a stream from the **test's own**
  `AudioContext` (an `OscillatorNode` into `createMediaStreamDestination()`; test code may, app code may not) and
  `enumerateDevices` with two inputs; checks the section, `snd(true)`: phase `live`, `sndStart` called once with an
  Opus cfg, frames about 50 a second, level above 0; `taken`; Off sends `snd-stop`; no `AudioContext` made by app code
  (a counting wrapper installed after the stub).

## 5. The studio (lane B): a sound item as Live sound

- The record: a sound whose **`file` is `'@live'`** (`LIVE_FILE`), a reserved name no upload can make (no folder,
  no sound extension). `okFile` already passes it; `norm('s', ...)` for it: `name` defaults to *Live sound*, `vol`, `r`,
  `on`, `bone`, `o`, `path`, `stream`, `trail`, `shows`, `locked` as any sound; `loop`, `start` kept but unused; `sync`,
  `skip`, `len` dropped. `snd()` is never called for it (no fetch, no decode, no *not in the scene's folder*: its status
  says *Live sound: from the output page*). `scan.mjs` and the relay's scene code read no sound records, so nothing
  there.
- Playing (`e6_items.js`, `emitStep`): live items are skipped by the file path. Each step the shown live item nearest
  the listener (switching only when another is 0.5 m nearer) is the claimer: while `HOST.collab.liveNode()` gives a node
  on the same context as `HOST.audio.fx()`, it gets `it.lv = { g, p }`, a `GainNode` (`vol`, and its fades as other
  emitters') and an HRTF `PannerNode` exactly as `emitStart`'s (inverse, `refDistance` `r`, rolloff 1, max 50 m),
  `liveNode().connect(g)`, `HOST.collab.liveClaim('studio')`; its place set every step as the others'. Every other live
  item is silent; when none is shown, the studio's scene is not on show, the context changes, or `dispose()`: nodes go,
  `liveRelease('studio')`, and the stream plays everywhere at the fixed level again. Muted: the shell's gain is 0
  already; the studio keeps no mute of its own for it.
- UI: Add's sound list gets *Live sound (from the output page)* first; a sound card (page and headset twins) a row
  *Source: Live sound* / *Source: a file* (a button `Live sound: on / off`; off asks for a file as Add does, the item's
  last file kept in memory, not saved). With several live items the card says *Only the nearest live sound plays*.
  The card says who hears it: *Heard by devices elsewhere (their Room's live sound setting); silent while the output page
  is not streaming*.
- `STUDIO.live()` for tests: `{ items: [ids], claimer: id | '', node: bool }`.
- Smoke block `'studio live'`: a stub `liveNode()` (a `GainNode` on `HOST.audio.fx()`, made by the test) and stubbed
  `liveClaim`/`liveRelease`; a live item claims, its panner's place follows the item; two live items: the nearer claims,
  and moving the camera hands over; the record round-trips through `state()` and `layout.json` with `file: '@live'`;
  no request for `@live` (no 404); `dispose` releases.

## 6. Settings and texts (lane B)

- localStorage `liveSound` (this device's, never in `state()` or `collab.state()`), as `HOST.collab.setLiveMode`.
- The Shared dialog, in a room, right after the output page's row (`sh-outp`), never on the output page itself:
  `<div class="row sh-live">` with a button `data-sh="live"` (each press the next: auto, on, off) labelled
  `Room's live sound: auto` / `on` / `off`, and a `<span>`: auto *Plays here when this device is elsewhere, not in the
  room*; on *Plays here even in the room*; off *Never plays here*; then the state: *Playing now* / *The output page is not
  streaming* / *Not available: rooms on a relay only* (peer to peer, on this device, an old relay: the button disabled).
  Its click case next to `act === 'output'`.
- The headset menu's Settings tab, after the *Effects volume* row and before the design room and studio buttons, in a
  room only: `button(S, 'live', x, y, bw, 60, "Room's live sound: " + mode, ...)` with the same short note right of it
  (*Plays when you are elsewhere* / *Plays even in the room* / *Never plays*, or *Rooms on a relay only*). The phone AR
  sheet (`phRows`): the same row after Sound effects.

## 7. FORMAT

**No change** (stays `networks-52`). The room's keys do not change; audio and `@snd` are relay effects, never keys or
state; `snd-*` are relay messages outside FORMAT (as `osc` was; the relay's support is said by `snd: 1` and `/api/ping`).
The studio's record gains no field: `file: '@live'` is a value of an existing field, which an older device keeps and
writes back unchanged (it would only call the file missing). `liveSound` and `outSnd` are per device.

## 8. Tests each lane runs, and untested

- A: `node --check` on its files, `node relay/test.mjs --snd`, `node tools/output/test-page.mjs`.
- B: `node --check shared.js`, `node tools/studio/build.mjs` and `--check`, `node tools/smoke.mjs <url> --only 'studio
  live'`, and a short page check of `HOST.collab.liveSound()` with `liveFx`/`liveIn` fed frames encoded in the test.
- Integrator (before `main`): the full release run; `tools/collab.mjs --live` if written.
- Untested here, say so: real loopback inputs (BlackHole, VB-Cable), latency and dropouts over a real network and
  Wi-Fi, how it sounds (unheard), positional live sound in a headset, a Quest Browser's `AudioDecoder` (if it lacks
  one, `why` says *This browser cannot play the room's live sound*).

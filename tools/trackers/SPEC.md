# Vive trackers in the rooms: plan and contracts

The owner, 8 November 2026: "i have a lot of them and it would make sense to implement them also for props and camera
tracking and things like that, and also for live puppetry"; then "we go for 1 and 3 with mixamo rigs for now, 2 and 4 we
can save up for maybe later, i have about 9 or 11 vive tracker 3.0 with three basestations. windows pc running steamvr is
already here and that one could also host the page". Phase 1 (trackers in the rooms, lined up, props that follow them) and
phase 3 (live puppetry of a Mixamo-rigged character, takes recorded as clips) were built in v126 (the solver in v125).
Phase 2 (camera tracking for compositing) and phase 4 (headsets lined up through a tracker on each) wait on the maybe
list.

The owner's setup and answers (8 November 2026): a Valve Index is on the PC (so SteamVR has its headset: no null
driver), each tracker has its own USB dongle, lining up by hand first (reference trackers on the spots stay a later
option), and two lighter body setups as well as the full one (below): "a minimal version that only needs one tracker at
each foot and uses the headset and the controllers and ik for the rest if possible, maybe also a version where one can
just use the headset and the controllers if possible".

This file was the contract between the lanes that built it. Status: v126 built phases 1 and 3 in three lanes (the bridge,
the fake and the relay; the shell; the studio), lined up by hand, with the wire settled by v126's brief (no reference
trackers this round, `GET /api/trackers/still`, a kind in each `@trk` row, `FORMAT` networks-38). Built: the solver of
phase 3 (v125, "The solver (ik.js)" below), the bridge, the fake and the relay ("The bridge", "The relay"), the shell's part
("The shell") and the studio's (props and the puppet), and the round that runs the three together end to end
(`tools/collab.mjs --trackers`, "Tests"). The studio's: `tools/studio/SPEC.md`, "Props that follow a tracker" and
"Worn with trackers". This file is now the contracts as built; the overview is AGENTS.md, "Vive trackers".

## Open and deferred

- Reference trackers left on the spots for good (`ref`, below): later. Lining up is by hand only.
- The headset-alone body (`rig: 'head'`, its legs stepping by themselves): built in `ik.js` but not offered. Deferred;
  first a probe of Quest Browser's WebXR body tracking.
- Phases 2 and 4: on the maybe list.
- `TRK_FLOOR` (the tracker's pose origin over the floor, lying on its base) is 0 until measured.
- Untested on Windows: the bridge with SteamVR and real trackers, its rate, and the lag through the relay.
- Review notes not fixed:
  - The Index's lining up pairs tracker samples (stamped as they reach the relay, about when the bridge read them) with
    the head's pose as WebXR predicts it for the display, under a stillness gate of 0.5 m/s and 0.6 rad/s, so a slow
    drift could pair them 2 to 3 cm apart. An idea: 0.1 m/s and 0.3 rad/s, and a test with a fixed lag.
  - Two pages naming different trackers at the same moment can lose a name (one `trk` key: the last writer wins).
  - Whether a take from a model in centimetres has its hips' place keys scaled by the converter's bake is unchecked.
  - With six trackers the upper arms' and forearms' twist can be up to 12 degrees off (only the hinge bends are tested).

## The picture

```
Vive Tracker 3.0 x 9-11, 3 base stations (2.0)
        |  SteamVR on the Windows PC
        v
tools/trackers/bridge.py  (Python 3 + the openvr package; reads every tracker's pose)
        |  UDP datagrams on 127.0.0.1 (JSON), about 90 a second
        v
relay/server.mjs --lan --trackers   (the same PC serves the app and the room)
        |  lines the trackers up with the room (from the room's key trk), sends @trk to the room
        v
headsets and pages: HOST.collab.trackers() in room coordinates  ->  the studio: props, the puppet, takes
```

Browsers cannot read the trackers (WebXR has no tracker API and SteamVR solves their poses natively), so a small native
helper is needed. It talks only to the relay on the same PC, so there is no browser permission, mixed-content or
rate-limit question on the way in, and nothing depends on a page staying open on the PC.

## The bridge (`tools/trackers/bridge.py`)

Built in v126 (setting it up: `tools/trackers/README.md`).

- Python 3 (Windows; 3.11 or newer keeps 90 a second there), the `openvr` package (pyopenvr) and the standard library
  only, named in the script's own block (PEP 723), so `uv run` fetches both (the versions in `bridge.py.lock`, made by
  `uv lock --script bridge.py`). Started after SteamVR: `uv run bridge.py [--port 47800] [--rate 90]` (or `python`); it waits for SteamVR when it is not running
  and again when SteamVR closes (`VREvent_Quit`). `--list` prints the devices SteamVR sees, `--seconds n` stops after n s,
  `--quiet` drops the status line (every 5 s: the devices, how many tracked well, readings a second). The owner's PC has
  the Index, so SteamVR has its headset: no null driver.
- A background application (`openvr.init(VRApplication_Background)`: it never starts SteamVR and needs no scene
  application). Reads `getDeviceToAbsoluteTrackingPose` (0 s ahead) in the standing universe (SteamVR's own room setup:
  y up, the floor at 0; the lining up below makes its origin and turn irrelevant) for every device of class
  GenericTracker, the headset (the Index), its controllers (for a performer wearing the Index, and to line the Index's
  own page up) and the base stations (for the map), at most `--rate` a second; `k` is `'trk'`, `'hmd'`, `'ctl'` (with
  `h: 'l' | 'r'` from SteamVR's controller role) or `'base'`. Which devices there are and their serial numbers are
  looked at every 2 s, batteries every 10 s (`Prop_DeviceBatteryPercentage_Float` where
  `Prop_DeviceProvidesBatteryStatus_Bool`). A device not connected is not sent; one whose pose is not valid is sent with
  its last pose and `ok` false (one never seen valid is not sent).
- Sends one UDP datagram a reading of every device to 127.0.0.1:<port>: `{ v: 1, t: <bridge ms>, d: [{ s: <serial>, k,
  h?, p: [x, y, z] (m, 4 decimals), q: [x, y, z, w] (4 decimals), lv: [3] (m/s, 3 decimals), av: [3] (rad/s), ok:
  <pose valid and Running_OK>, b: <battery 0..1 or null> }] }`, under 8 KB (more devices than fit go in several; 10
  devices are about 1.3 KB). Serial numbers are the devices' ids everywhere (`LHR-XXXXXXXX`; base stations `LHB-...`),
  stable across sessions.
- `--fake`: no SteamVR, made-up devices (the same as the Node fake's, below), to try the rest without the hardware.
- `tools/trackers/fake.mjs` (Node, no packages): a fake bridge for the tests and for trying the rooms without the
  hardware, the same datagrams. Its SteamVR space is the room turned by `turn` about y and moved by `move` (a known
  transform, so a test knows every pose's truth in room coordinates); devices at scripted poses (still, round a circle,
  bobbing) or from a function the caller passes (`startFake({ port, rate, turn, move, devices: [{ s, k, h, b, pose: t =>
  ({ p, q }) }] })`; `pause`, `off` (switched off), `lost` (out of view), `set` (another pose), `send` (any bytes),
  `history` (each device's last poses in room coordinates with the time they were sent), `spots` (where a tracker lying
  on spot A and B reads in SteamVR's space)). From the command line: two trackers lying on spot A and B, three others,
  the headset, its controllers and two base stations (`node tools/trackers/fake.mjs --help`).

## The relay (`--trackers [port]`, `relay/trackers.mjs`)

Built in v126 by v126's brief (the wire below is that brief's, which settled the plan's open details; reference trackers
wait). The reference: `relay/README.md`, "The PC's Vive trackers".

- `--trackers [port]` (also in `RELAY_ARGS`; 47800 when no port is given, `0` a free one, said in the start line); a
  port another program holds stops the start with a sentence. Nothing at all without it: no socket, no endpoint, no
  field in `/api/ping`, no `@trk`.
- Listens for the bridge's datagrams on 127.0.0.1 only. Keeps each device's latest reading with the relay's time it
  arrived. Bad datagrams (not JSON, not `v: 1` with `d`, over 8 KB) are ignored and bad readings left out one by one,
  both counted and said in the log at most once a second. `/api/ping` says `trackers: true` and `trackersSeen` (trackers,
  `k: 'trk'`, heard in the last 5 s); `GET /api/trackers` (with the password, as the API) lists every device seen in the
  last minute raw: `{ ok: true, trackers: [{ id: <serial>, k, h?, ok, b, p: [3], q: [4], age: <ms> }] }` (`ok` false once
  its reading is 0.5 s old). `GET /api/trackers/still?id=<serial>&ms=1000` (200 to 5000 ms) waits that long and answers
  `{ ok: true, p: [3] (the mean, raw), spread: <mm, the furthest reading from the mean>, n }` or `{ ok: false, error:
  <words> }`: not seen (at once), lost tracking meanwhile, or moved more than 5 mm meanwhile (both answers 200).
- What v126 builds of the room's key and the lining up, by v126's brief (it wins over the plan below where they differ):
  `trk = { on: bool, m: { a: [x, y, z], b: [x, y, z] } | null, names: { <serial>: <name, <= 24 chars> }, by, at }`, no
  `ref`; the frame from `m` exactly the headsets' from floor spots (`shared.js`'s `fromMarks` with the floor spots'
  `floorUnder`, and `basis`, with `TRK_FLOOR` = 0 for `FLOOR_TIP`: origin the floor point under spot A, x level towards
  spot B, y up, z = x cross y; `relay/test.mjs` runs `shared.js`'s own code against it); and `@trk` to every member of a
  room whose `trk.on` holds and whose `m` gives a frame, at most 60 a second (whenever a newer reading has come; once a
  second while the bridge is silent): `{ t: 'fx', k: '@trk', v: { at: <relay ms of the newest reading>, l: 'hand', t:
  [[id, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok, kind], ...] }, by: '' }` in room coordinates (metres and m/s to the mm,
  quaternions to 4 decimals; `ok` 1 or 0, 0 also once a reading is 0.5 s old; `kind` `'t'` a tracker, `'h'` the Index,
  `'l'` and `'r'` its controllers; base stations never, a controller with no hand yet left out, a device silent for 5 s
  left out). On but not lined up (no `m`, or points under 10 cm apart along the floor): `{ at, l: '', t: [] }` once a
  second. A member whose socket holds over 256 KB unsent is skipped until it drains. Only rooms on this relay.
- The plan as first written (reference trackers wait for a later round; where it differs from the bullet above, that
  holds). The room's key `trk` (written by pages or headsets in the room; never refused by either lock):
  `{ on, ref: { a: <serial>, b: <serial> } | null, m: { a: [x, y, z], b: [x, y, z] } | null, names: { <serial>: <name> },
  by, at }`. `on`: this room uses the PC's trackers (only such rooms get them). Lining up, two ways (by hand is built
  first; reference trackers later, the owner: "start with lining up by hand for now, leave the other option for maybe
  later"):
  - **Reference trackers** (`ref`): two trackers lying flat on spot A and spot B for good, their pose origin (the base's
    mount) on the floor. The room's frame is the floor spots' (as the headsets' since v122): its origin the floor point
    under spot A, x along the floor towards spot B, y up. Worked out from the two trackers' positions averaged over the
    last 2 s and moved only past 3 mm or 0.1 degrees, so it is steady and corrects itself if SteamVR's space shifts; a
    reference tracker not seen holds the last good frame. Lined up once, never again by hand.
  - **By hand** (`m`): a tracker set on spot A, *Set spot A* (its position averaged over 1 s while still), then on spot B:
    the two points in SteamVR's space are written into `m`. Holds while the base stations do not move and SteamVR's room
    setup is not run again. Frees the two trackers for props and the body.
  The relay turns every tracker into room coordinates (`TRK_FLOOR`, the pose origin's height over the floor with the
  tracker lying on its base, 0 m until measured) and, while a room's `trk.on` holds and it is lined up, sends that room's
  members an fx of type `@trk` 60 times a second: `{ at: <relay ms of the reading>, l: 'ref' | 'hand', e: [<spot A error
  mm>, <spot B mm>] (ref only), t: [[serial, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok], ...] }` (metres to the mm,
  quaternions to 4 decimals). Sent by the relay itself, so no member's fx rate applies; about 1 KB 60 times a second to
  each member. Not lined up: `{ at, l: '', t: [] }` once a second, so pages can say why.
- Peer-to-peer rooms and rooms on other relays get no trackers (the PC's relay is the room's relay at an event).

## The shell (`shared.js`, `index.html`)

Built in v126 (the shell's lane; AGENTS.md, "Vive trackers", has it in full). The wire contract of this round, which
the three lanes follow (where the sections above say otherwise, this wins: no reference trackers yet):

- The room's key `trk` = `{ on: bool, m: { a: [x, y, z], b: [x, y, z] } | null, names: { <serial>: <name, at most 24
  characters> }, by, at }` (no `ref` this round). Written by pages or headsets, never refused by either lock; a write
  keeps the fields it does not change.
- `GET /api/trackers` (the password as for the API): `{ ok: true, trackers: [{ id: <serial>, k: 'trk' | 'hmd' | 'ctl' |
  'base', h?: 'l' | 'r', ok, b: <battery 0..1 | null>, p: [3], q: [4], age: <ms> }] }`, raw in SteamVR's space. `GET
  /api/trackers/still?id=<serial>&ms=1000`: waits that long and answers `{ ok: true, p: [3] (the mean), spread: <mm>, n }`
  or `{ ok: false, error: <words> }` (not seen, or moved more than 5 mm meanwhile). `/api/ping` says `trackers: true` and
  `trackersSeen: <n>` when the relay runs with `--trackers`.
- The room frame from `m` is the headsets' frame from floor spots (`fromMarks`, `floorUnder` in `shared.js`): origin the
  floor under spot A (SteamVR's standing space has its floor at y = 0; `TRK_FLOOR` = 0, the tracker's pose origin over the
  floor lying on its base, a constant to measure later), x along the floor towards spot B, y up, z = x cross y (a point to
  the right of the way from A to B has z > 0). The shell's reference: `HOST.room.fromSpots(a, b, 0)` and
  `HOST.room.roomOf(frame, p)` give a raw point in room coordinates exactly as the headsets' frame from floor spots does
  (the smoke test checks them; the relay's frame can be compared with them).
- `@trk`: `{ t: 'fx', k: '@trk', v: { at: <relay ms of the newest reading>, l: 'hand', t: [[id, x, y, z, qx, qy, qz, qw,
  vx, vy, vz, ok, kind], ...] }, by: '' }` 60 times a second to every member of a room whose `trk.on` holds and whose `m`
  is set, in room coordinates (metres to the mm, quaternions to 4 decimals, `ok` 1 or 0, `kind` `'t'` a tracker, `'h'` the
  Index, `'l'` and `'r'` its controllers; base stations never). With `trk.on` but no `m`: `{ at, l: '', t: [] }` once a
  second. Sent by the relay itself. Peer-to-peer rooms and rooms on this device get none.
- `FORMAT` `networks-38` (the room's key `trk`; the studio's records' `trk` and `puppet`).

What the shell does with it:

- `@trk` is the shell's own (as `@menu`), never passed to a story and never taken from a member (only with `by` ''). Each
  tracker's last 8 samples by `at`; drawn at the relay's time now less `TRK.delay` (40 ms, eased) between samples, carried
  on by its velocity for at most 100 ms past the last; not seen for 0.5 s: `ok` false, its last pose kept.
- `HOST.collab.trackers()`: `[{ id, name, kind, p, q, ok, age }]` in room coordinates; `HOST.collab.tracker(id, out)`:
  one, or null; `HOST.collab.trk()`: the room's `trk` key read safely, the last `l`, whether the relay has trackers (its
  ping) and whether this room uses them now; `setTrk({ on, m, names })`, `trkName(id, name)`. For the studio lane's tests
  and the shell's: `trkIn(v)` (a `@trk` message as the relay sends it) and `trkTime(ms)` (the relay's time held).
- `HOST.collab.body(memberId)`: `{ head: [x, y, z, qx, qy, qz, qw] | null, hands: [left, right] (each [7] or null), at }`
  in room coordinates for a member in a headset (smoothed from presence; this headset's own from its own poses), or
  null: the "feet and headset" puppet worn with a Quest reads the performer's head and hands through it. Presence carries
  `g`, the grips (or tracked hands' wrists) as poses `[left, right]`; its rays, `hands`, now list the left's first (they
  were in the order of the session's input sources, which is no fixed order of hands).
- Pages: *The PC's trackers* in the Shared dialog while the relay says `trackers: true`: *Use the PC's trackers in this
  room* (`trk.on`), its status (*Lined up by hand (the spots 1.84 m apart): 3 trackers in the room.*, *Not lined up yet*,
  ...), lining up by hand (a list of the relay's trackers to pick the one lying on the spot, *Set spot A*, *Set spot B*:
  `/api/trackers/still`, then `trk.m` written; the spread or the error said; spots less than 50 cm apart or more than 4
  cm apart in height refused), the trackers (serial, a name typed into `trk.names`, seen or not, battery, a row that
  lights while its tracker moves), and the room map's small dots with names.
- Headsets: *Trackers: shown / hidden* on the menu's Debug tab (this headset's own, kept, hidden by default): each tracker
  a small puck with its name, depth-tested, at its room pose (in the room's group, as people are drawn).
- The Index in the room (the owner: "a vive index is there too, that could then even join the page in webvr"): the PC's
  browser enters VR with the Index (Chrome or Edge on Windows through SteamVR's OpenXR) and joins the room as a VR
  headset; the menu's question (in this room?) is answered for it while the trackers see it. With `@trk` giving the
  headset `'h'` in room coordinates and the page knowing its own head pose in its `local-floor` at the same moments (by
  the relay's clock), its room frame follows: a level frame, the turn about the vertical and the place along the floor
  (and the floor's height) from the two, averaged over about 1 s of samples taken while the head is fairly still, followed
  past 1 cm or 0.5 degrees; a frame source of its own, `'trackers'`, taken before the shared space and after this
  headset's own marks; `lineUp()` says *Lined up by the PC's trackers*. Only for a session whose browser is not a
  standalone headset's and while `'h'` is seen and ok (held otherwise; while its first samples are still coming, lining up,
  never *Calibrate the room*); no spots, no shared space needed, and the room setup guide's startup flow never opens for it. Tethered, so it stays near the PC; it sees the room in VR.

## The studio, phase 1: props that follow a tracker

- Built in v126 (`tools/studio/engine/e6k_trk.js`). The studio reads the trackers from the shell,
  `HOST.collab.trackers()` (`[{ id, name, p, q, ok, k }]` in room coordinates, `k` the stream's kind: `'t'`, `'h'`, `'l'`,
  `'r'`), once a frame and only at a studio station, guarded (an older shell: none). It keeps each one's last pose itself
  (held while not seen), per station.
- An object's, a shape's or an empty's record may carry `trk: { id: <serial>, o: [x, y, z], q: [x, y, z, w] }`: the item's
  pose in the tracker's frame (metres to the mm, turned but not scaled; 4 decimals). Its card (page and headset, editing
  on): *Follows a tracker: None / <name or serial>...*; choosing one keeps the item where it stands now (the offset from
  the tracker's pose now); *Snap onto it* sets the offset to zero; *None* leaves it where the tracker had it; one Undo step
  each, shared and saved, refused while it is locked in place. A copy follows no tracker; a GLB switch turns the offset by
  the baked turn.
- Drawn through the pose pipeline as its base stage (as behaviours are, `POSE.base`): the tracker's room pose, which is
  the scene's frame at a studio station since v125 (the scene stands on the room's frame there, its circle only the way
  in: no turn by the station's spot and facing needed), times the offset; a motion and a path draw over it;
  the record never changes. Not seen: its last pose held; never seen here: its placed pose. Rests at its placed pose
  while held here or paused, as everything that moves (v122). A sound may follow such an item as any other.
- `FORMAT` networks-38 (the room's key `trk`, and the studio's records' `trk` and `puppet`; v126's brief: only the shell
  lane changes the line in `shared.js`).

## The studio, phase 3: a Mixamo character worn with trackers

- Mixamo rigs only for now: a model whose bones are Mixamo's (`mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`,
  `Head`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, the right side, as
  three.js names them once loaded, `mixamorigHips`...). Others are told so on the card.
- Three ways to wear it, two of them built first (the owner: the full set, "a minimal version that only needs one tracker at each foot and uses the
  headset and the controllers and ik for the rest", and "a version where one can just use the headset and the
  controllers"):
  - **Full**: trackers on the hips (belt), head, both wrists and both feet (6), and optionally the chest, both elbows and
    both knees (up to 11). Lined up by hand, every tracker is free for the body.
  - **Feet and headset**: a tracker on each foot; the head and hands from the performer's headset and controllers; the
    hips worked out from the head and the feet (below the head, back a little, turned with the feet and the head).
  - **Headset only** (deferred, the owner, 8 November 2026: "skip that part for now, note it down for later and maybe the
    quest body tracking can solve it"): the headset and its two controllers; the hips from the head; the legs would need
    stepping of their own (feet kept planted and moved in a step when the hips leave them behind), which no JavaScript
    library does. Not offered for now; first a probe of Quest Browser's experimental WebXR body tracking (`body-tracking`,
    since Quest Browser 32: the upper body tracked, the legs estimated by the headset), which could give the whole body
    without our own stepping. If the solver of v125 has stepping code, it stays unused until then.
  The headset and controllers are either the Index (through the bridge, in SteamVR's space with the trackers: exact, 90
  times a second) or a Quest (its own poses on that Quest, its presence in room coordinates on everyone else's, 15 a
  second and smoothed; lined up with the room through the spots, so a few centimetres off the trackers). *Headset only*
  with a Quest would need no PC at all and work in any room, peer to peer too (deferred, above).
- The object's record gains `puppet: { on, rig: 'full' | 'feet' (and later 'head'), by: <the performer's member id when a Quest's
  head and hands drive it, or 'index'>, map: { hips?, head?, lhand?, rhand?, lfoot?, rfoot?, chest?, lelbow?, relbow?,
  lknee?, rknee?: <serial, or '@head', '@l', '@r' for the performer's own headset> }, cal: { <slot>: [x, y, z, qx, qy, qz,
  qw] }, s, floor }`: which tracker drives which part, each part's offset from its tracker to its bone found at the lining
  up, the object's scale then and the floor (the scene's, 0). Shared and saved; every device solves the same pose from the
  same tracker stream (nothing per bone is sent). Built in v126 (`tools/studio/engine/e6l_puppet.js`, `rig` `'full'` and
  `'feet'`; `'head'` not offered). For `by` a member id the head and hands come from `HOST.collab.body(by)` (`{ head, l, r }`,
  each `{ p, q }` or seven numbers, in room coordinates: the shell's lane gives it), or on the performer's own headset
  from its own head and controllers (their rays' poses), which the shell's `body()` should give alike (the turns of a
  presence's hands: untested).
- *Line up with the performer* (its card, page and headset): the performer stands in a T-pose (Mixamo's rest pose) facing
  the character's way; a 5 s countdown, then the trackers (and in the lighter setups the headset and controllers) are
  given their parts (automatically from the T-pose: highest
  the head, lowest two the feet, the hands furthest out, left and right by the facing, the hips the one nearest the middle
  at hip height, chest, elbows and knees by height and side; changeable on the card), the character moved along the floor
  to where the performer stands (its parts at rest, on average, where their trackers are: built in v126), scaled so its
  hips (or for `feet` its eyes) are as high as the performer's, and each part's offset taken. One Undo step.
- The solver (`tools/studio/engine/ik.js`, a plain module like `convert.js`, also run in Node by its test): hips from
  their tracker (place and turn); the spine bent between the hips and the chest (or the head) tracker; neck and head
  from the head tracker (or headset); arms and legs by two-bone inverse kinematics to the hand and foot targets, the elbows
  and knees towards their trackers where worn, else a natural bend; hands and feet turned as their targets; the hips
  worked out where no tracker gives them, and the steps of *Headset only*. While it is on, the model's own clip is off.
  A take is best recorded on the device that has the poses first: the PC for the Index and trackers, the performer's
  own Quest for a Quest's head and hands.
- *Record a take* (its card; a 3 s countdown, *Stop*, at most 120 s): the solved bones sampled 30 times a second on the
  tracker stream's clock, made into a clip *Take n*, and the object's GLB made again with all its clips and the new one
  (through the converter, as Convert to GLB: the old file kept under `originals/`, every object of that file switched,
  a new picture), with a relay that takes uploads; else downloaded. The clip then plays as any other.

## The solver (`ik.js`)

Built in v125 as phase 3's groundwork: `tools/studio/engine/ik.js`, a plain module like `convert.js` and `images.js`
(`makeIK(THREE)`: no DOM, nothing fetched or drawn), checked in Node by `tools/studio/test-ik.mjs`. In
`tools/studio/build.mjs` since v126, used by `tools/studio/engine/e6l_puppet.js`. Its contract is
the comment at its top. Everything is in three.js's world frame (the targets, the floor, up +y): the studio turns room
or scene coordinates into it. A pose is `{ p: [x, y, z], q: [x, y, z, w] }`.

- `rigOf(root)`: the bones by Mixamo's names as three.js gives them (`mixamorigHips`), leniently (any case,
  `mixamorig1:`, no prefix), in Mixamo's chains, with the rest pose as the bones stand now (call it on the model as loaded;
  `rig.toRest()` puts it back), or a sentence why not: *Not a Mixamo rig: no bone named mixamorig:Spine, ...*, *This
  model has no bones: ...*, *Its bones are not in Mixamo's order: ...*.
- `assign(rig, targets, setup)`: the parts from a T-pose facing the character's way, by the rule above (`full`, 6 to 11
  trackers); `feet` the two feet by side; `head` nothing (the caller names the headset and controllers). Too few, or no
  hand found on both sides, is said in words.
- `calibrate(rig, targets, map, setup, o)`: the performer stands in the character in a T-pose (the character's bones
  are read where it stands, so the studio moves it to the performer first, or the performer steps into it). `s`: the
  hips tracker's height over the character's hips (`full`), or the headset's over the character's eyes (its head bone
  plus 45 % of the way to the top of its head: `feet` and `head`); `o.scale` false keeps the size. Each worn slot's
  offset `[x, y, z, qx, qy, qz, qw]` (metres to 0.1 mm, 5 decimals) to its bone at rest with the character scaled by `s`
  about its origin; the elbows and knees to the joint (the forearm's and shin's origin, rigid with either bone the
  tracker is strapped to). Plain JSON: `map`, `cal` and `s` are the record's, and `floor` (the floor's height then, where
  `head` plants its feet) joins them. The caller scales the character by `s` before solving. Refused in words: a part not
  tracked, a hips tracker not 0.4 to 1.5 m up, a headset not 0.6 to 2.3 m up.
- `solve(rig, cal, targets, dt, state)`: as "The solver" above. The hips from their tracker, else under the head (their
  height and place so that the head is where its target is, turned with the head, and in `feet` 60 % with the feet,
  lowered when a foot could not be reached); the spine spread evenly from the hips to the chest (its tracker, else half
  way to the head's turn); the neck half way to the head; the shoulders with the chest. Two-bone chains to the hands and
  feet: the elbows and knees towards their trackers, else elbows down, back and a little out and knees forward (with the
  hips and the foot); the hinges are worked out from the facing at rest (elbows bend forward, knees back), and a limb
  nearly straight, or a pole within 3 degrees of its line, keeps the hinge carried from rest. A target not seen this
  frame: its last pose; one never seen: not solved (*Nothing tracks the left hand yet.*). `head`: each foot planted until
  its home (under the hips as at rest) is 16 % of the leg's length away or 0.6 rad turned, or the leg cannot reach it
  (6 mm), then a 0.3 s arc to its home plus where the hips are going; one at a time, by turns, unless a planted foot
  cannot be reached. Deterministic: the same targets, `dt` and `state` give the same pose number for number.
- `restPose(rig, part)` (`'eye'`: where a headset is worn), `sample(rig, t)` and `clipOf(samples, name)`: the bones'
  local turns and the hips' place made into a `THREE.AnimationClip` (track names bind by the bones' names, or their
  uuids where a name has `. [ ] : /`).

The test rig: `tools/studio/test/scenes/puppet/rig.glb` (`tools/studio/test/make.mjs`, about 60 KB, never Mixamo's files):
25 bones with Mixamo's names in a T-pose, each bone's frame as Mixamo's (y along the bone) under an Armature scaled 0.01,
an eight- or twelve-sided tube per bone (1,568 triangles, two materials) and a walk in place, Walk, whose elbows and knees
bend only about their hinges. `test-ik.mjs` (42 checks, under a second) loads it twice with three.js's GLTFLoader, one
walking as the performer, and fixes trackers (random offsets), a headset and controllers to its bones. As it stands:
`full` with 6 trackers puts the hands and feet within 0.06 mm of the truth and turns the hips, head, hands and feet within
0.01 degrees (the arms' and legs' twist is a guess there: up to 12 and 3 degrees); with 11 trackers, the performer away
from the origin and turned, every bone within 1.2 degrees; a performer 1.1 times as big gives `s` 1.1 and the same; `feet`
puts the feet and hands within 0.06 mm and the hips within 2.1 cm; `head` keeps the head within 0.05 mm, the hands within
1.3 mm and the hips within 1.9 cm, takes no step standing, 12 by turns walking 2.4 m and lets no planted foot move more
than 4.6 mm; a take replays the solved pose exactly.

The studio's side (the card, the record, wearing it, takes saved as GLB: lane C) is built in v126. Not done yet: a
character lined up anywhere but where the performer stands (the studio moves it there first: a leftover offset between
the two, a few cm where the trackers' own offsets do not average out, turns with the performer); shoulders that shrug as the arms rise, a spine
that bends more at its top than its foot, a forearm's twist shared with it (Mixamo's sits on the hand); rigs other than
Mixamo's, elbows or knees that bend another way, non-uniform scales. *Headset only* (`head`) stays unused (deferred
above): its steps are quick and short (about three a second, 0.4 m), since straight legs reach little unless the head
drops, and five of its twelve steps in the test were forced by reach. How any of it looks on a real character worn with
real trackers, a headset and controllers is untested.

## Tests

The numbers below come from the builders' own runs. The full release run (`docs/setup-and-release.md`, step 7) has not
run on v124, v125 or v126.

- `relay/test.mjs` (built in v126; `node relay/test.mjs --trackers` runs only these, in seconds): the UDP intake (bad
  datagrams and readings ignored, counted and said), `/api/ping`, `/api/trackers` and `/api/trackers/still` with and
  without the password, the room's frame against `shared.js`'s own code, lining up by hand against a known transform
  (every pose within 1 mm and 0.05 degrees of the truth in `@trk`; measured 0.68 mm, the rounding to the mm, and 0.015
  degrees), `@trk` only to rooms with `trk.on` and `m` and `l: ''` without, its rate (120 in 2 s), the bridge silent,
  `still` refusing a tracker that moved, nothing without `--trackers`, and `bridge.py --fake` to the relay where
  `python3` is. Lining up from reference trackers waits for a later round.
- `tools/smoke.mjs --only trackers` (v126, the shell): `@trk` through the shell's intake at held times (smoothing,
  carrying on, ok false after 0.5 s, bad rows, a member's message, nothing to the story); the Shared dialog's section with
  the relay's answers stubbed (the switch, spots taken and refused, `trk.m` written, names, a row lit while its tracker
  moves, the status, the room map's dots); a pretend VR headset: the `'trackers'` frame within 1 cm and 0.5 degrees,
  turned and moved, followed, a fast turn with the clocks apart adding nothing, `lineUp()`, the question answered; the
  pucks; `body()` and presence's grips. AGENTS.md's Testing section has the numbers.
- `tools/studio/test-ik.mjs` (Node, seconds): a generated Mixamo-named test rig (`tools/studio/test/make.mjs`, our own
  mesh, never Mixamo's files) walked by a generated clip; its trackers worked out from the clip with random offsets; the
  solver's hands and feet within 5 mm of the truth and the bones within 3 degrees where the trackers determine them.
  Built in v125: what it checks and its numbers are in "The solver (ik.js)" above.
- `tools/smoke.mjs --only 'studio trackers'` and `--only 'studio puppet'` (v126, the studio's lane): a pretend studio
  station with the trackers stubbed in the page (`HOST.collab.trackers`, `body`; and where the shell has its test hook
  `HOST.collab.trkIn`, one tracker fed through it): a shape following a tracker within 5 mm, its offset kept as it is
  chosen, Snap, a tracker not seen held, one never seen here its placed pose, resting while carried or paused, None,
  norm's rules, the state and `layout.json` both ways, copies on no tracker, a GLB switch; the puppet test rig worn
  (whole body and feet with the Index or a performer's own headset) from trackers worn on its own walking copy, lined up
  from a T-pose after the countdown, its hands and feet within 5 mm of the truth (0.06 mm), two pages solving the same
  bones at one held moment (within 0.0001 degrees), a 3 s take made into a GLB (downloaded) whose Take 1 plays the solved
  pose, a model that is not Mixamo's refused in words.
- `tools/collab.mjs --trackers` (built in v126, `trackersRound`, also in the main run after the studio's behaviours; three
  to five minutes): the three lanes together through a real relay (`--trackers` on a free UDP port, `--scenes` on a copy of
  the test and puppet scenes, taking uploads) and the fake bridge, SteamVR's space the room turned 0.7 rad and moved by
  (1.3, 0.02, -0.6) m; no reference trackers this round: one tracker laid on spot A and then on spot B (lined up by hand),
  a prop tracker going round (0.38 m/s), the Index's headset and controllers, a base station and a performer's six
  trackers worn on a walking copy of the puppet test rig (worked out in Node, as `test-ik.mjs` does). Three pages and a
  pretend VR headset that is not a Quest's browser (in VR from the start, asked whether it is in the room until the
  trackers come): the dialog's section and switch (`trk.on`), spot A and spot B through
  the real `/api/trackers/still` (spot B refused while the tracker slides), `trk.m` within 0.2 mm of where SteamVR reads
  the spots, a name typed reaching the others, a write keeping the other fields (a newer app's too); every device's
  trackers at one held relay time within 2 mm and 0.2 degrees of the truth (measured 0.6 to 1 mm and
  0.01 to 0.06 degrees over eight runs: the mm rounding); the headset lined up by the trackers (`'trackers'`) within 1 cm and 0.5 degrees (0.01 cm and 0.003 degrees),
  never asked to calibrate meanwhile; at a studio circle a shape on the prop tracker within 5 mm and 0.5 degrees of
  where it should be on every device (0.1 to 0.7 mm, under 0.05 degrees); the rig worn whole body, lined up from the T-pose after its
  countdown (moved to the performer within 3 mm), its 23 bones within 1 degree of each other on every device at one held
  time (0.0000) and its hands and feet within 1 cm of the performer's (0.6 to 2 mm); a 3 s take saved through the relay as
  `models/rig.glb` with *Take 1* (3.1 to 3.4 s, 24 tracks; 9 or 10 keys, a page drawing in software), which another page switches to and plays. A held time: the fake
  paused for a moment, every device given the last reading, the relay's time held in the middle of the last samples.

## How it was built

After v124 was merged: the solver, the test rig and `test-ik.mjs` first (v125); then in v126 three lanes (the bridge,
the fake and the relay with its tests; the shell and the Trackers section; the studio: props, the puppet and takes) and
the round that runs them together (`tools/collab.mjs --trackers`). Each lane was planned with one Sonnet review and one
fix round; the review notes left open are under "Open and deferred". Estimated at 4.5 to 6 days of agent work and 19 to
26M tokens (the two lighter body setups and the Index in the room added about a day and 4 to 6M to the first estimate).
Untested until tried with the owner's PC, trackers and headsets: the bridge on Windows, `TRK_FLOOR`, lag through the PC's
relay, how the puppet looks and how a performer's trackers stay on.

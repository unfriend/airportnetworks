# Vive trackers in the rooms: plan and contracts

The owner, 8 November 2026: "i have a lot of them and it would make sense to implement them also for props and camera
tracking and things like that, and also for live puppetry"; then "we go for 1 and 3 with mixamo rigs for now, 2 and 4 we
can save up for maybe later, i have about 9 or 11 vive tracker 3.0 with three basestations. windows pc running steamvr is
already here and that one could also host the page". Phase 1 (trackers in the rooms, lined up, props that follow them) and
phase 3 (live puppetry of a Mixamo-rigged character, takes recorded as clips) are to be built after v124. Phase 2 (camera
tracking for compositing) and phase 4 (headsets lined up through a tracker on each) wait on the maybe list.

This file is the contract between the lanes that build it. Status: planned, nothing built.

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

- Python 3 (Windows), the `openvr` package (pyopenvr) and the standard library only. Started after SteamVR:
  `python bridge.py [--port 47800] [--rate 90]`. A PC without a SteamVR headset needs SteamVR's null driver
  (`requireHmd` false, the null driver enabled): the README says how.
- Reads `getDeviceToAbsoluteTrackingPose` in the standing universe (SteamVR's own room setup: y up, the floor at 0; the
  lining up below makes its origin and turn irrelevant) for every tracked device of class GenericTracker (and base
  stations, for the map), at most `--rate` a second.
- Sends one UDP datagram a reading to 127.0.0.1:<port>: `{ v: 1, t: <bridge ms>, d: [{ s: <serial>, k: 'trk' | 'base',
  p: [x, y, z] (m, 4 decimals), q: [x, y, z, w] (4 decimals), lv: [3] (m/s), av: [3] (rad/s), ok: <pose valid and
  running ok>, b: <battery 0..1 or null> }] }`, under 8 KB (11 trackers are about 1.5 KB). Serial numbers are the
  trackers' ids everywhere (`LHR-XXXXXXXX`), stable across sessions.
- `--fake`: no SteamVR, a few synthetic trackers (to try the rest without the hardware). The tests use the Node fake,
  `tools/trackers/fake.mjs`, which speaks the same datagrams.

## The relay (`--trackers [port]`, `relay/trackers.mjs`)

- Listens for the bridge's datagrams on 127.0.0.1 only (port 47800 by default). Keeps each tracker's latest reading with
  the relay's time it arrived. `/api/ping` says `trackers: true` and how many are seen; `GET /api/trackers` (with the
  password, as the API) lists them raw: serial, kind, ok, battery, `p`, `q`, age.
- The room's key `trk` (written by pages or headsets in the room; never refused by either lock):
  `{ on, ref: { a: <serial>, b: <serial> } | null, m: { a: [x, y, z], b: [x, y, z] } | null, names: { <serial>: <name> },
  by, at }`. `on`: this room uses the PC's trackers (only such rooms get them). Lining up, two ways:
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

- `@trk` is the shell's own (as `@menu`), never passed to a story. Each tracker's last 8 samples by `at`; drawn at the
  relay's time now less `TRK.delay` (40 ms) between samples, carried on by its velocity for at most 100 ms past the last;
  not seen for 0.5 s: `ok` false, its last pose kept.
- `HOST.collab.trackers()`: `[{ id, name, p, q, ok, age }]` in room coordinates; `HOST.collab.tracker(id, out)`: one, or
  null; `HOST.collab.trk()`: the room's `trk` key and the last `l` and `e` (for the dialog and tests).
- Pages: a *Trackers* section in the Shared dialog when the relay says `trackers: true`: *Use the PC's trackers in this
  room* (`trk.on`), lining up (two lists for the reference trackers, or *Set spot A* / *Set spot B* by hand with a list
  of trackers), its status (*Lined up from the trackers on spot A and B: 1 mm, 2 mm*; *Not lined up: ...*), and the
  trackers: serial, a name typed here (`trk.names`), ok, battery, and a row that lights while its tracker moves (to tell
  which is which by moving it). The room map shows them as small dots with their names.
- Headsets: *Trackers: shown / hidden* on the menu's Debug tab (this headset's own): each tracker drawn as a small puck
  with its name, depth-tested.

## The studio, phase 1: props that follow a tracker

- An object's, a shape's or an empty's record may carry `trk: { id: <serial>, o: [x, y, z], q: [x, y, z, w] }`: the item's
  pose in the tracker's frame (metres to the mm, turned but not scaled; 4 decimals). Its card (page and headset, editing
  on): *Follows a tracker: None / <name or serial>...*; choosing one keeps the item where it stands now (the offset from
  the tracker's pose now); *Snap onto it* sets the offset to zero; one Undo step each, shared and saved.
- Drawn through the pose pipeline as its base stage (as behaviours are, `POSE.base`): the tracker's room pose turned into
  the scene's frame at the studio's station (its spot and facing), times the offset; a motion and a path draw over it;
  the record never changes. Not seen: its last pose held; never seen here: its placed pose. Rests at its placed pose
  while held here or paused, as everything that moves (v122). A sound may follow such an item as any other.
- `FORMAT` networks-37 (the studio's `state()` changes shape).

## The studio, phase 3: a Mixamo character worn with trackers

- Mixamo rigs only for now: a model whose bones are Mixamo's (`mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`,
  `Head`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, the right side, as
  three.js names them once loaded, `mixamorigHips`...). Others are told so on the card.
- Trackers worn: hips (belt), head, both hands (wrists), both feet are needed (6); chest, both elbows and both knees
  improve it (up to 11). With two reference trackers on the spots that leaves 7 to 9 for the body; lining up by hand
  leaves all of them.
- The object's record gains `puppet: { on, map: { hips, head, lhand, rhand, lfoot, rfoot, chest?, lelbow?, relbow?, lknee?,
  rknee?: <serial> }, cal: { <slot>: [x, y, z, qx, qy, qz, qw] }, s }`: which tracker drives which part, each part's
  offset from its tracker to its bone found at the lining up, and the character's scale then. Shared and saved; every
  device solves the same pose from the same tracker stream (nothing per bone is sent).
- *Line up with the performer* (its card, page and headset): the performer stands in a T-pose (Mixamo's rest pose) facing
  the character's way; a 5 s countdown, then the trackers are given their parts (automatically from the T-pose: highest
  the head, lowest two the feet, the hands furthest out, left and right by the facing, the hips the one nearest the middle
  at hip height, chest, elbows and knees by height and side; changeable on the card), the character scaled so its hips
  are as high as the performer's, and each part's offset taken. One Undo step.
- The solver (`tools/studio/engine/ik.js`, a plain module like `convert.js`, also run in Node by its test): hips from
  their tracker (place and turn); the spine bent between the hips and the chest (or the head) tracker; neck and head
  from the head tracker; arms and legs by two-bone inverse kinematics to the hand and foot trackers, the elbows and knees
  towards their trackers where worn, else a natural bend; hands and feet turned as their trackers. While it is on, the
  model's own clip is off.
- *Record a take* (its card; a 3 s countdown, *Stop*, at most 120 s): the solved bones sampled 30 times a second on the
  tracker stream's clock, made into a clip *Take n*, and the object's GLB made again with all its clips and the new one
  (through the converter, as Convert to GLB: the old file kept under `originals/`, every object of that file switched,
  a new picture), with a relay that takes uploads; else downloaded. The clip then plays as any other.

## Tests

- `relay/test.mjs`: the UDP intake (bad datagrams ignored), `/api/ping`, `/api/trackers` with the password, lining up
  from reference trackers and by hand against known transforms (to 1 mm and 0.05 degrees), `@trk` only to rooms with
  `trk.on`, its rate, nothing without `--trackers`.
- `tools/studio/test-ik.mjs` (Node, seconds): a generated Mixamo-named test rig (`tools/studio/test/make.mjs`, our own
  mesh, never Mixamo's files) walked by a generated clip; its trackers worked out from the clip with random offsets; the
  solver's hands and feet within 5 mm of the truth and the bones within 3 degrees where the trackers determine them.
- `tools/collab.mjs --trackers`: the fake bridge with SteamVR's space turned and moved against the room, two reference
  trackers on the spots, a prop tracker going round, a performer walking; a page's Trackers section, a pretend headset at
  a studio station: trackers in room coordinates within 2 mm, a shape following a tracker within 5 mm on every device at
  one held time, the test rig worn and every device's bones within 1 degree of each other, a 3 s take saved through the
  relay as a GLB with *Take 1* that plays.

## Order of work

After v124 is merged. Two lanes at once, then one: (A) the bridge, the fake, the relay and its tests, the shell and the
Trackers section, the collab round's plumbing; (B) the solver, the test rig and `test-ik.mjs`; then (C) the studio: props,
the puppet and takes. One Sonnet review and one fix round each. Estimated 3.5 to 4.5 days of agent work, 15 to 20M tokens.
Untested until tried with the owner's PC, trackers and headsets: the bridge on Windows, `TRK_FLOOR`, lag through the PC's
relay, how the puppet looks and how a performer's trackers stay on.

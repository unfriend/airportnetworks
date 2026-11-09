# Vive trackers in the rooms: plan and contracts

The owner, 8 November 2026: "i have a lot of them and it would make sense to implement them also for props and camera
tracking and things like that, and also for live puppetry"; then "we go for 1 and 3 with mixamo rigs for now, 2 and 4 we
can save up for maybe later, i have about 9 or 11 vive tracker 3.0 with three basestations. windows pc running steamvr is
already here and that one could also host the page". Phase 1 (trackers in the rooms, lined up, props that follow them) and
phase 3 (live puppetry of a Mixamo-rigged character, takes recorded as clips) are to be built after v124. Phase 2 (camera
tracking for compositing) and phase 4 (headsets lined up through a tracker on each) wait on the maybe list.

The owner's setup and answers (8 November 2026): a Valve Index is on the PC (so SteamVR has its headset: no null
driver), each tracker has its own USB dongle, lining up by hand first (reference trackers on the spots stay a later
option), and two lighter body setups as well as the full one (below): "a minimal version that only needs one tracker at
each foot and uses the headset and the controllers and ik for the rest if possible, maybe also a version where one can
just use the headset and the controllers if possible".

This file is the contract between the lanes that build it. Status: the solver of phase 3 was built in v125 ("The solver
(ik.js)" below); v126 builds phases 1 and 3 in three lanes (the bridge and the relay; the shell; the studio). The studio's
part is built (v126): props that follow a tracker and a Mixamo character worn with trackers, its lining up and its takes
("The studio, phase 1" and "phase 3" below; `tools/studio/SPEC.md`, "Props that follow a tracker" and "Worn with
trackers"). FORMAT becomes `networks-38` (the room's key `trk`, and the studio's records' `trk` and `puppet`): the shell's
lane changes the line.

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
  lining up below makes its origin and turn irrelevant) for every tracked device of class GenericTracker, the headset
  (the Index) and its two controllers (for a performer wearing the Index, and to line the Index's own page up), and the
  base stations (for the map), at most `--rate` a second; `k` is `'trk'`, `'hmd'`, `'ctl'` (with `h: 'l' | 'r'`) or
  `'base'`.
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
- The Index in the room (the owner: "a vive index is there too, that could then even join the page in webvr"): the PC's
  browser enters VR with the Index (Chrome or Edge on Windows through SteamVR's OpenXR) and joins the room as a VR
  headset in the room (*In this room*). It needs no shared space and no spots: the bridge reports the Index's pose in
  SteamVR's space, the page knows its own pose in its `local-floor` at the same moments, and the lining up by hand turns
  SteamVR's space into the room's, so its room frame follows from the three (a frame source of its own, `'trackers'`,
  steadier than any Quest's). Tethered, so it stays near the PC; it sees the room in VR.

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
- `FORMAT` networks-38 (the room's key `trk`, and the studio's `state()` changes shape: `trk` and `puppet`).

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

Built in v125 as phase 3's groundwork (lane B above): `tools/studio/engine/ik.js`, a plain module like `convert.js` and
`images.js` (`makeIK(THREE)`: no DOM, nothing fetched or drawn), checked in Node by `tools/studio/test-ik.mjs`. It is not
in `tools/studio/build.mjs` yet, so nothing in the app uses it; the studio's side (lane C) wires it in. Its contract is
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

- `relay/test.mjs`: the UDP intake (bad datagrams ignored), `/api/ping`, `/api/trackers` with the password, lining up
  from reference trackers and by hand against known transforms (to 1 mm and 0.05 degrees), `@trk` only to rooms with
  `trk.on`, its rate, nothing without `--trackers`.
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
- `tools/collab.mjs --trackers`: the fake bridge with SteamVR's space turned and moved against the room, two reference
  trackers on the spots, a prop tracker going round, a performer walking; a page's Trackers section, a pretend headset at
  a studio station: trackers in room coordinates within 2 mm, a shape following a tracker within 5 mm on every device at
  one held time, the test rig worn and every device's bones within 1 degree of each other, a 3 s take saved through the
  relay as a GLB with *Take 1* that plays.

## Order of work

After v124 is merged. Two lanes at once, then one: (A) the bridge, the fake, the relay and its tests, the shell and the
Trackers section, the collab round's plumbing; (B) the solver, the test rig and `test-ik.mjs`; then (C) the studio: props,
the puppet and takes. One Sonnet review and one fix round each. Estimated 4.5 to 6 days of agent work, 19 to 26M tokens (the two lighter body setups and the Index in the room add
about a day and 4 to 6M to the first estimate).
Untested until tried with the owner's PC, trackers and headsets: the bridge on Windows, `TRK_FLOOR`, lag through the PC's
relay, how the puppet looks and how a performer's trackers stay on.

# The robot gang: spec (`stories/robots.js`, built from `tools/robots/`)

A seventh story for the app in `/home/user/airportnetworks` (read `AGENTS.md` once for context and conventions;
`CLAUDE.md` for the working rules). A gang of robot vacuums lives in a room with you. In a headset it is **your**
room: the headset knows your floor, walls and furniture from its room setup (WebXR plane and mesh detection), and
the robots drive on your floor, follow you around and bounce off your walls; in passthrough you see them in your
real room. On a screen you stand in a model living room and click the floor to walk. The network idea: the same
robots with the same rule, on a different network of who follows whom, make a different shape (a star: all follow
you; a chain: each follows the one ahead, a conga line). A short story (about 1:24), then free play for as long as
you stay.

Never use the trademark "Roomba" in the app: say robot vacuums, robots, the gang.

## Files and build

Built like the flock (`tools/flock/`, read its `README.md`, `build.mjs`, `engine/` and `sets/flock.js` as the
model; copy and adapt rather than invent):

| Path | What |
| --- | --- |
| `tools/robots/sets/robots.js` | the one set, key `robots` (`SETS.robots = function (K) {...}`) |
| `tools/robots/sets/robots.md` | its manifest (params, anchors, labels, views, controls, API, numbers that were measured) |
| `tools/robots/engine/e1_head.js` ... `e7_app.js` | engine parts, adapted from `tools/flock/engine/` |
| `tools/robots/build.mjs` | like the flock's: kit + set + engine into `stories/robots.js`, `--check` |
| `tools/robots/harness.html`, `shot.mjs`, `sweep.mjs`, `README.md` | set harness and screenshot tools, as the flock's |
| `stories/robots.js` | generated; never edit by hand |

Shots go to `tools/robots/shots/` (git-ignored). Narration file (optional): `audio/narration-robots.mp3`.

## Runtime rules (as for every set; see `tools/lbi/SPEC.md` "Runtime and code rules")

- three.js r128 global `THREE`, no addons, no other libraries, no fetches, no modules. 2-space indent, single quotes,
  semicolons, compact helpers, short comments that say why. Plain British English, short sentences.
- Deterministic randomness with `K.rng(seed)`, never `Math.random()`.
- Custom `ShaderMaterial`s: `uA: set.uA` in the uniforms, alpha multiplied by it, pushed into `set.mats`. Built-in
  materials registered with `K.fade(set, mat, base)`. No shadows (use blob shadows), no render targets.
- Like the flock, this set is a **live simulation**: `update(S, t, dt)` advances it by `dt` (clamp `dt` to 0.1 and
  substep at most 1/60 s). Seeking the story changes the params (the rule, the count), not the robots' past.
- Performance (Quest 2 at 72 fps, stereo): instanced meshes for the robots' parts (one `InstancedMesh` per part, a
  per-instance colour where needed), at most ~40 draw calls for the whole set including the model room, ~150k
  triangles, build under ~300 ms in headless Chromium. Up to 24 robots. The floor texture (dust/cleaned) updates at
  most 10 times a second.
- Units: 1 unit = 1 m. Floor at y = 0 in the set's frame. Life size everywhere (screen and headset).

## The set `robots` (`sets/robots.js`)

### The room

The set always works on a **room description** in its own frame (floor at y = 0):

```js
room = {
  kind: 'model' | 'real' | 'box',   // model: the furnished living room; real: from the headset; box: a bare
                                    // virtual room round you (a headset without room setup)
  floor: [[x, z], ...],             // floor outline polygon (any winding; may be concave)
  walls: [[x1, z1, x2, z2, h], ...],// wall segments at floor level, h their height (m)
  blocks: [{ poly: [[x, z], ...], h, label }],   // furniture footprints the robots cannot enter (h: its height)
}
```

- `setRoom(room)` replaces the room: rebuilds colliders, the floor texture (its bounding box), the drawn room for
  `real`/`box` kinds, the dock, and puts robots that are now outside the floor back inside (nearest point inside, at
  least 0.2 m from walls). Robots keep their positions otherwise. Called rarely (when the headset's planes change).
- `modelRoom()` returns the built-in living room description (also the default at load).
- Colliders: every wall segment, every floor polygon edge (so a gap between detected walls still holds), every block
  polygon edge. Robots are discs (radius 0.17 m); collide disc against segments (push out along the normal, then the
  robot's bump reaction), disc against disc, disc against the player (radius 0.25 m). A robot whose centre ends up
  outside the floor polygon is moved back to the nearest point at least 0.2 m inside.

**The model living room** (kind `model`, for screens and as the headset fallback in VR): about 5.4 m × 4.4 m,
centred on the origin, walls 2.5 m high. Warm and simple, made to look good from above at an angle: a wooden plank
floor (shader: planks, subtle grain, a little sheen), pale walls with a skirting board, a window with soft daylight
on the back wall (-z), a door frame on a side wall, a sofa with cushions against one wall, an armchair, a low coffee
table on a rug (the rug is flat: passable; the table is passable underneath, collide only with its four legs as
tiny blocks), a bookshelf, a plant in a pot, a floor lamp. Furniture is built from rounded boxes and cylinders with
lit materials (no textures beyond small canvas/shader ones), with a soft blob of darkness under each (fake ambient
occlusion). Doll's-house cutaway: a wall whose outer side faces the eye (see `see(eye)`) is drawn only to skirting
height (0.25 m) with a soft fade on top, so you see into the room from any angle outside it; from inside (headset,
"Your eyes" view) all walls are full height.

**`real` and `box` rooms** (headset): drawn from the description. Param `robots_room` (1 = opaque VR, 0 =
passthrough) chooses how:
- `robots_room` 1: floor polygon as a soft grey surface with a faint 0.5 m grid, walls as pale quads of their real
  height with a brighter edge at top and bottom, blocks as rounded boxes of their height. A calm digital twin.
- `robots_room` 0 (passthrough): nothing opaque. A thin glowing line along the base of each wall; where a robot
  bumps a wall, a short ripple of light spreads along that wall from the point of contact (0.8 s). The floor shows
  only the cleaned trail (see Floor) and the robots' blob shadows.
- The scan effect (`robots_scan` 0..1) works for all kinds: a band of cyan grid lines sweeps across the floor and up
  the walls (and the furniture), as if the room were being found; at 1 the sweep is complete and the grid fades to
  nothing over the last 15 %. Label "Floor" and "Wall" (see labels) show during it.

### The floor: dust and the cleaned trail

A texture over the room's bounding box (cells of about 2.5 cm, at most 256 × 256) records where robots have been
(each robot cleans a disc of radius 0.16 m around its centre). In the model room the floor shows grey dust specks
(a dusty film) where not yet cleaned, the clean planks where cleaned; with `robots_trails` 1 the cleaned area also
gets a faint cyan tint so it reads as a map. In real/box rooms with `robots_room` 0, only the cleaned area shows
(faint cyan, at `robots_trails`); with `robots_room` 1, as on the grey floor. `coverage()` returns the cleaned share
of the floor (cells inside the floor polygon and outside blocks). `robots_dust` is a counter: each time it passes a
whole number the floor is dusty again (coverage 0).

### The robots

Robot vacuums, life size: a disc 0.34 m across and 0.09 m tall. Charcoal body with a glossy dark top, a lighter
ring round the top edge, a grey bumper round the front half (it squashes in by 1 cm for 0.15 s on a bump), a
round button in the middle of the top, a thin LED ring whose colour is the robot's own (a gang: cyan `#46d9ff`,
magenta `#ff5ad9`, amber `#ffb43b`, green `#3ee08f`, red `#ff5a4b`, violet `#9d7bff`, cycling), two small white LED
"eyes" near the front edge of the top (they blink now and then, squint for 0.3 s after a bump, and their pupils look
towards where the robot is heading), a side brush (three thin bristles) at the front-right that spins while it
drives. A soft blob shadow under each. All instanced.

Kinematics: differential drive. Each robot has position, heading, speed, turn rate. Top speed 0.45 m/s (0.6 when it
follows and is far behind), turn rate up to 2.8 rad/s, smooth acceleration (no jumps in speed or heading). It
turns on the spot when its target is far off its heading (speed scaled by cos of the heading error, clamped at 0).

**Rules** (param `robots_rule`, a whole number; switching rules is smooth because only targets change):

0. `dock` - each drives to its own place at the dock (a row along the longest wall, 0.3 m from it, 0.42 m apart),
   turns to face out, and rests there, its LED ring breathing slowly.
1. `bounce` - bump and turn: drive straight at 0.35 m/s; on a bump, back off 4 cm, turn on the spot by a random
   angle (away from the wall: a new heading within ±80° of the wall's inward normal), drive on. Now and then (every
   20-40 s each) a short spiral (as early robot vacuums did) in open floor.
2. `follow` - follow you: target is the player's position; each keeps its own distance (0.65 m + a little per robot,
   so they form a loose ring round you rather than a pile), keeps clear of other robots within 0.45 m (separation),
   slows as it arrives, stops and turns to face you. Never drives into you.
3. `chain` - conga line: robot 0 follows the player (keeping 0.6 m), robot i follows robot i - 1 (keeping 0.42 m),
   so the line snakes after you. Separation as above, weaker.
4. `flee` - keep away: a robot within 1.8 m of you drives away from you (and bounces off walls as in `bounce`);
   further away it wanders slowly (bounce at half speed). You can herd them into a corner.

In every rule except `dock`, a bump makes a robot back off and turn (in `follow`/`chain` it turns towards the side
nearer its target and drives 0.4 s before it steers to its target again), so the gang bounces off walls, furniture,
each other and your feet. Robots never leave the floor polygon and never overlap.

**Crumbs**: `crumbs(x, z)` spills a little pile of crumbs (30-40 tiny instanced bits within 0.2 m) at a point
(clamped inside the floor, outside blocks). Each pile draws the nearest one or two robots, whatever their rule; a
crumb vanishes when a robot passes over it (within 0.15 m); once a pile is gone those robots go back to their rule.
At most 8 piles at once (the oldest goes). Param `robots_crumbs` is a counter: each time it passes a whole number a
pile is spilled at a spot chosen by the set (open floor, 1-2 m from the player) - the story uses it.

**The player**: the set holds where the player stands. `player(x, z, yaw, show)` sets it (headset: your head
position projected to the floor; `show` false, no avatar). On screens the set walks an **avatar**: a simple,
friendly figure about 1.7 m tall (rounded capsule body in soft blue-grey, a head, no face detail needed; shoulders
and a gentle walking bob and sway, a soft shadow) with `walkTo(x, z)` (walks at 1.1 m/s, turning smoothly, sliding
along walls and furniture; the target is clamped inside the floor) and param `robots_walk`: 0 = stand where it is
(or go where it was last sent), 1 = stroll a built-in loop round the model room (a smooth closed path through open
floor, about 25 s per lap, pausing briefly twice). `player()` with `show` true also works (puts the avatar there).

**Links**: with `robots_links` > 0, a line from each robot to whom it follows (to the player in `follow`, to the one
ahead in `chain`; none in `bounce`/`dock`/`flee`), cyan, additive, at about 0.25 m height (so they clear the robots),
with a small bright dot at the follower's end. These are the network.

### Params

| param | default | meaning |
| --- | --- | --- |
| `robots_a` | 1 | fade (engine) |
| `robots_rule` | 1 | 0 dock, 1 bounce, 2 follow, 3 chain, 4 flee (whole numbers; stepped, not eased) |
| `robots_n` | 6 | how many robots, 1-24 (stepped; new ones roll out from the dock) |
| `robots_trails` | 0 | 0..1 the cleaned trail's tint |
| `robots_links` | 0 | 0..1 who follows whom |
| `robots_scan` | 1 | 0..1 the room-finding sweep (1: done and faded) |
| `robots_room` | 1 | 1 draw the room (screens, VR); 0 passthrough (overlays only) |
| `robots_walk` | 0 | 1 the avatar strolls its loop (model room, screens) |
| `robots_dust` | 0 | counter: a dusty floor each time it passes a whole number |
| `robots_crumbs` | 0 | counter: a crumb pile each time it passes a whole number |

### Exports beyond the set contract

`setRoom(room)`, `modelRoom()`, `room()` (the current description), `player(x, z, yaw, show)`, `walkTo(x, z)`,
`crumbs(x, z)` (returns false if the point is not on the floor), `floorPoint(origin, dir)` (a ray in the set's
frame against the floor y = 0: `[x, z]` if it lands on the floor polygon outside blocks, else null), `see(eye)`
(the eye position in the set's frame, every frame: for the cutaway and for eyes that glance at you), `coverage()`,
`robots()`, `bumps()` (total so far), `state()` (for tests: positions, headings, rule, targets, piles, player).

### Anchors, labels, views, controls

Anchors (set frame): `floor` (floor centre, y 0.02), `wall` (middle of the longest wall at 1.3 m), `dock`, `you`
(the player's head: 1.7 m on screens, eye height in a headset), `gang` (the robots' centroid, 0.3 m up), `lead`
(robot 0, 0.3 m up), `crumbs` (the newest pile). Labels: **Floor** (cyan) and **Wall** (cyan) while `robots_scan` is
between 0.15 and 0.9; **You** (amber) on screens when the avatar shows and `robots_links` > 0.5.

Views `[az, el, dist, tx, ty, tz]` (vertical field of view about 50° on screens; the engine uses its own lens):
`default` - the doll's house from above at an angle (about 35° az, 52° el, framing the whole model room);
`low` - a robot's-eye view, 0.25 m above the floor near the gang; `eyes` (the engine places it at the avatar's head
looking at the gang). Controls:

- `view`: `default` "Above", `low` "Low down", `eyes` "Your eyes"
- `rule`: `follow` "Follow me", `chain` "Conga line", `flee` "Keep away", `bounce` "Bump and turn"
- `robots`: `6`, `12`, `24`
- `trails`: `off` "Off", `on` "Cleaned floor"
- `links`: `off` "Off", `on` "Who follows whom"

## The engine (`tools/robots/engine/`)

Adapted from the flock's engine (one set, no Proteins tab, no scene list). Differences:

**Screen camera.** Views are orbits as in the tour, with the camera kept above the floor and outside the walls'
cutaway line where possible. `default`/`low` orbit; `low` keeps its target on the gang (smoothly). `eyes`: the
camera at the avatar's head, looking (smoothly, lazily: a dead zone and eased turns as the flock's `followView`) at
the gang; the avatar hidden in that view. Drag orbits (in `eyes`, drag turns your head), wheel/pinch zooms. **A click
(no drag) on the floor walks the avatar there** (`floorPoint` from the click ray, then `walkTo`); a click elsewhere
does nothing. The canvas cursor is a pointer over the floor.

**Story** (chapters, times in story seconds; panel text plain British English; `data-at` reveals as in the flock;
numbers marked live are filled every frame from the set):

| key | name | a-b | what happens |
| --- | --- | --- | --- |
| `title` | Robot gang | 0-14 | robots at the dock (rule 0); `robots_scan` 0→1 over 2-11 s (the room is found); camera `default` with a slow drift |
| `bump` | Bump and turn | 14-34 | rule 1, `robots_dust` jumps at 14, `robots_trails` 0→1 over 15-17; camera moves low for a while (20-27) then back above |
| `follow` | Follow me | 34-54 | rule 2, the avatar strolls (`robots_walk` 1), `robots_trails` 1→0 at 34-36, `robots_links` 0→1 at 40-42 |
| `chain` | Follow the one ahead | 54-74 | rule 3, avatar strolls, links stay on; a crumb pile at 66 (`robots_crumbs`) |
| `gang` | Your gang | 74-84 | rule 2, links 1→0 at 74-76, avatar stands; then explore |

Text (adjust only to fit; keep the facts):

- title: h1 "Robot gang", sub "vacuums in your room". At 4: "Six robot vacuums share a room with you. In a headset
  it is your own room: the headset knows your floor and walls from its room setup, and so do they." Note at 9: "On a
  screen you stand in a model living room. Click the floor to walk."
- bump: "Early robot vacuums had no map of the room. Much of the time they simply drove until they bumped into
  something, turned, and drove on." At 7: "Nobody plans a route, yet the floor gets clean: so far the gang has
  cleaned **N %** of it." (live, `coverage()`.) At 13: "Bouncing at random reaches every corner in the end, but the
  last patches take longest."
- follow: "Now give each robot one rule: follow you, keep a little distance, and keep clear of the others." At 7
  (accent): "Draw who follows whom and you get a network: you in the middle, a link to every robot. A star."
- chain: "Rewire the network. Each robot follows the one in front of it; only the first follows you." At 7: "Same
  robots, same rule, a different network: the gang becomes a line." At 13 (small credit): "Swarms of robots are often
  steered like this: each watches a few others, and the network of who follows whom shapes the group (Olfati-Saber,
  Fax and Murray, Proceedings of the IEEE 2007)."
- gang: "The gang stays for as long as you do." At 3: "Change the rule, add robots, show the cleaned floor, or spill
  crumbs: click the floor to walk; in a headset, point at the floor and pull the trigger."

**Explore mode**: one pane ("The gang") with the controls above, plus buttons "Spill crumbs" (a pile 1-2 m from
you) and "Dust again" (`robots_dust`), and a live line "Cleaned: N % of the floor · M robots". Defaults on entering:
rule follow, 6 robots, trails off, links off, view default. Hash: `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low`, `&crumbs` spills a pile, `&walk=x,z` walks the avatar.

**Headset** (all of the flock's XR machinery: panels, Stories screen, anchors, Sound check, controllers):

- The session already requests optional features; the integration step adds `'plane-detection'` and
  `'mesh-detection'` to every story's `requestSession` (sessions survive story changes). Check
  `session.enabledFeatures` (when present) before touching `frame.detectedPlanes` / `frame.detectedMeshes`, and wrap
  the access in try/catch (Chromium throws when the feature is not enabled).
- **Reading the room** (`xrRoom(frame, ref)`, every frame but cheap: rebuild when the set of planes/meshes or any
  `lastChangedTime` changed, at most twice a second, and re-read once a second while planes exist, since a first read
  can miss poses; `setRoom` ignores an unchanged room and keeps the cleaned floor when a room of the same kind is
  refined). WebXR Plane Detection: `frame.detectedPlanes` is a set of
  `XRPlane` with `planeSpace`, `polygon` (points in plane space; the plane is the plane space's x-z plane, its +y the
  normal), `orientation` (`'horizontal'`/`'vertical'`), `lastChangedTime`, and on Quest `semanticLabel` (`'floor'`,
  `'wall'`, `'ceiling'`, `'table'`, `'couch'`, `'storage'`, `'bed'`, `'door frame'`, `'window frame'`, `'screen'`,
  `'lamp'`, `'plant'`, `'wall art'`, `'other'`, `'global mesh'`, `'invisible wall face'`; compare lower-case, and be
  tolerant of others or none). Get each pose with `frame.getPose(plane.planeSpace, ref)` and transform the polygon
  points to the reference space.
  - Floor: the horizontal plane labelled floor (else the lowest large horizontal plane facing up, more than 1 m
    below the head). Its y is the floor height; its polygon (x, z) the floor outline.
  - Walls: vertical planes labelled wall (or unlabelled vertical planes taller than 1.5 m): the segment between the
    two extreme points of the polygon along its horizontal direction, at floor level; height from the polygon.
    Skip door frames, window frames, wall art and invisible wall faces.
  - Blocks: horizontal planes labelled couch, storage, bed, other (top 0.05-1.3 m above the floor), and detected
    meshes (Quest: furniture volumes) except `'global mesh'` and any mesh whose footprint is more than a third of the
    floor or taller than 2.2 m: footprint = convex hull of the vertices' x-z, height = top above floor. Tables and
    desks are passable (robots go under).
  - No floor polygon but walls: floor = convex hull of the wall ends. Floor but no walls: walls = floor edges at 2.5 m.
  - Nothing found (no feature, permission refused, no room setup, or nothing after 4 s): a `box` room 4 m × 5 m
    centred on where you stood when the room was first needed, long side ahead; the floor 1.6 m below your head then.
    If `XR.session.initiateRoomCapture` exists, the panel offers "Set up your room" (calls it once per session).
    In opaque VR the model living room (`model`) is used instead of the bare box, placed the same way.
  - The room is passed to the set in the set's frame. With a real room, `GL.world` is placed so that its frame is the
    reference space shifted down to the floor: world matrix = inverse(rig matrix) × translation(0, floorY, 0) (the
    rig carries panels and may be anchored; the real room must not move with it). So set x/z = reference x/z, set
    y = reference y − floorY. With `box`/`model` the world hangs on the rig as in the flock (`(0, −1.6, 0)` under it,
    facing where you faced) so anchors keep it in place. Never move `GL.rig` yourself (anchors rule in `CLAUDE.md`).
  - A reference-space `reset` (recentring) changes the coordinates: rebuild the room on the next frame; robots that
    end up outside are put back inside by `setRoom`.
- The player is your head: every frame `player(head.x, head.z, yaw, false)` in the set's frame; `see(head)`.
- **Trigger on the floor spills crumbs** there (`xrPoint`: when the ray does not hit a panel, intersect it with the
  floor via `floorPoint`; the hover dot sits on the floor; a press spills crumbs and buzzes). Trigger elsewhere does
  nothing. The grip moves only the panel (as in the flock).
- `robots_room` is 0 in passthrough (`XR.on && !XR.clear`), 1 otherwise.
- Headset panel (canvas twin of the explore pane): the same controls (except view), Spill crumbs, Dust again, the
  live line, and a room line: "Your room: floor, N walls, M pieces of furniture" / "No room setup found: a virtual
  room round you" (+ "Set up your room" button when possible). The footer hint mentions the trigger on the floor.

## Integration (shell, other stories, tests, docs)

- `index.html`: `HOST.list` entry `{ key: 'robots', kick: 'Swarm robotics', title: 'Robot gang', col: '#3ee08f'
  (or another free accent), desc: 'A gang of robot vacuums in your room. In a headset they find your floor and walls,
  follow you about and bounce off the walls.', page: 'A gang of robot vacuums in your room', brand: 'Robot gang',
  sub: 'vacuums in your room', aria, thing: 'room', loading: 'Waking the robots', len: 'Story 1:24 · then free
  play' }`. "six stories" → "seven stories" everywhere (title, meta, brand, picker heading, manifest, docs). The
  picker grid must look good with seven cards on wide, medium and narrow screens (check with screenshots).
- Every story (`stories/airports.js`, `proteins.js`, `spatial.js` by hand; `tools/lbi`, `tools/nmd`, `tools/flock`,
  `tools/robots` engine sources then rebuild): `optionalFeatures: ['local-floor', 'hand-tracking', 'anchors',
  'plane-detection', 'mesh-detection']`; the headset Stories screen fits seven cards (cards 0.36 m wide, angle step
  about 0.31 rad at about 1.25 m, so neighbours do not overlap and the outer cards are within about 50°; check
  the arithmetic: chord = 2 d sin(step / 2) must exceed the card width).
- `sw.js`: bump `VERSION`, add `./stories/robots.js` to `SHELL` and `./audio/narration-robots.mp3` to the audio list.
  `manifest.webmanifest`: seven stories. `.gitignore`: `tools/robots/shots/`.
- `tools/smoke.mjs`: `robots` in every story list (also the Repeat-all run and the anchored-placement loop; the grip
  there moves the panel, as for the flock); a robots step: every control and rule; a click on the floor walks the
  avatar (its position changes towards the point); `crumbs` spills a pile and a robot reaches it; robots stay inside
  the floor polygon and never overlap after 20 s of each rule; no NaN; and a **pretend headset room**: a fake
  `frame.detectedPlanes` (a floor polygon, four walls, a couch plane, with poses) and `enabledFeatures` including
  `plane-detection`, checking that the set gets a `real` room with 4 walls and 1 block, the robots end up inside it,
  `GL.world` places the floor at the floor plane's height, and the trigger aimed at the floor spills crumbs.
- Docs: `AGENTS.md` (seven stories, the table row, layout entry for `tools/robots/`, a section "The robot gang
  (`stories/robots.js`) is built the same way" with what is special: live sim, room from the headset, world =
  inverse rig for a real room, plane/mesh detection requested by every story), `CLAUDE.md` (build line),
  `README.md`, `README.txt`, `audio/PUT-narration.mp3-HERE.txt` (chapter timings), `tools/robots/README.md`.

## Science (may say / must not say)

May say: early robot vacuums had no map and much of the time drove until they bumped into something, turned and
drove on; random bouncing covers a floor in the end but the last patches take longest; in swarm robotics each robot
often follows a few others, and the network of who follows whom (a star, a chain) shapes what the group does
(Olfati-Saber, Fax & Murray, "Consensus and cooperation in networked multi-agent systems", Proc. IEEE 95, 2007).
Headsets such as Meta Quest store the room's floor, walls and furniture from their room setup, and WebXR pages can
ask for them. Must not say: anything about how a particular brand's robot works today, or that the simulation's
numbers (speeds, coverage times) are measured; they are tuned to look right.

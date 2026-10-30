# `robots` - a gang of robot vacuums in a room with you (sets/robots.js)

Life size: 1 unit is 1 m, the floor is y = 0 in the set's frame. Like the flock, the set is a live simulation:
`update(S, t, dt)` advances it by `dt` (clamped to 0.1 s, in steps of at most 1/60 s), so seeking the story changes
the params (the rule, the count), not the robots' past.

## The room

The set always works on a room description in its own frame:

```js
{ kind: 'model' | 'real' | 'box',
  floor: [[x, z], ...],               // outline, any winding, may be concave
  walls: [[x1, z1, x2, z2, h], ...],  // segments at floor level, h their height (default 2.5)
  blocks: [{ poly: [[x, z], ...], h, under, label }] }   // furniture footprints; under > 0.12 m: robots pass beneath
```

- No floor (or one under 1 m²) but walls: the floor is the hull of the wall ends. Floor but no walls: walls along its
  edges, 2.5 m (a run of edges turning less than 3 degrees makes one wall). Neither, or a floor no robot fits in: a
  4 m x 5 m box round the origin.
- `setRoom` skips a room that is the same to the centimetre (a headset reports its room again and again), and a new
  room of the same kind keeps what was cleaned where there is still floor.
- Colliders: every wall, every floor edge (a gap between detected walls still holds), every block edge (blocks with
  `under` > 0.12 only stop the avatar). A wall with floor on both sides (a partition) holds a robot on whichever side
  it is. A grid of 10 cm cells (coarser over 14 m, at most about 142 x 142) holds the clearance to them (capped at
  1.2 m): it drives paths (distance fields to you, the dock and crumb piles, kept as 32-bit floats and rounded as
  they are stored), clear-way tests, steering round furniture and the floor's shade.
- **Model living room** (`modelRoom()`, the default): 5.4 m x 4.4 m, walls 2.5 m. Oak planks (shader: staggered
  planks, grain, fine gaps, a soft sheen), a sage back wall with a window (daylight sky, a band of trees, a warm patch
  of sun on the floor crossed by the window's bars) and linen curtains on a brass rail, cream walls, skirting boards,
  a door with panels and a brass knob in the left wall, a framed print over the sofa. Furniture of rounded boxes,
  cylinders and lathes, in one merged mesh: a blue-grey sofa with cushions and two pillows against the left wall, a
  mustard armchair turned to the coffee table, a coffee table (1.1 x 0.62 m, legs near its corners so a robot fits
  between them; robots pass under it) with books, a mug, a tray of fruit, on a painted rug, a low white bookcase
  with books, a vase and a picture, a plant in a terracotta pot, a floor lamp whose shade glows and warms the corner.
  Shade under and round all furniture and along the walls comes from the clearance grid (no shadows).
  Doll's-house cutaway: a wall (with everything on it) whose outside faces the eye drops to 0.25 m with a soft fade;
  from inside the floor outline (a headset, "Your eyes") all walls stand full height. Only the first 24 walls of a
  room can drop; any more stay full height.
- **Real and box rooms** are drawn from the description: with `robots_room` 1 a calm digital twin (grey floor with a
  faint 0.5 m grid, pale walls of their real height, brighter at top and foot, blocks raised to their height with a
  bevelled top); with `robots_room` 0 (passthrough) nothing opaque: a thin glowing line along each wall's foot, a
  ripple of light along the wall where a robot bumps it (0.8 s), the cleaned trail and the shadows. With the model
  room and `robots_room` 0 the model is hidden and the same overlays show (use the model only in opaque VR).
- **Scan** (`robots_scan`): a band of cyan grid lines (25 cm) sweeps out from where you stand (the room's middle for
  the model) across the floor, up the walls and over the furniture; the front reaches the furthest wall top at 0.85,
  the grid fades out over the last 15 %. Labels Floor and Wall show between 0.15 and 0.9.
- Lighting lives in the set's frame (a warm room light, the window's daylight, the lamp, sky and ground) and is
  neutral for real and box rooms. Every material is a `ShaderMaterial` with `uA`.

## The floor: dust and the cleaned trail

A texture over the floor's bounding box (2.5 cm cells, at most 256 x 256; R cleaned, G shade, B counts), sent to the
GPU at most ten times a second. Each robot cleans a disc 0.16 m round its middle. Model room: dust is a pale grey flat
film with a few specks; cleaned planks are deeper and a little glossy; with `robots_trails` the cleaned area takes a
faint cyan tint with brighter edges (a map). Twin floors likewise in grey; in passthrough only the cleaned area shows
(cyan at `robots_trails`). `coverage()` is the cleaned share of floor cells outside robot-stopping furniture.
`robots_dust` passing a whole number makes the floor dusty again.

## The robots

Up to 24, life size: 0.34 m across, 0.09 m tall. One instanced mesh each for the body (a lathe: charcoal sides, a
silver ring round the top edge, a thin LED ring in the robot's own colour, a glossy dark top with a fine circular
brush and a soft sheen, a round button with a coloured ring; plus a grey bumper round the front half that gives 1 cm
for 0.15 s on a bump), the face (a small sloped visor at the front of the top, where the eyes are drawn by the
shader so they read from above and from low down), and the side brush (three bristles at the front right, spinning
while it moves); one instanced batch of blob shadows (robots and the avatar). Colours cycle cyan, magenta, amber,
green, red, violet. Each has its own pace (plus or minus 6 %), follow distance and blink rhythm.

Eyes: rounded LED eyes with dark pupils and a glint; the pupils look where the robot turns, glance at the viewer's eye
now and then (`see`), and look up at you while waiting for you. They blink, squint (> <) for 0.3 s after a bump,
smile (^ ^) when eating crumbs, and at the dock close into content crescents while the LED ring breathes slowly.
New robots pop in at the dock; removed ones shrink away.

Kinematics: differential drive; speed and turn rate eased (1.2 m/s^2 up, 2 m/s^2 down, 12 rad/s^2), turn rate up to
2.8 rad/s with braking so it never overshoots, top speed 0.45 m/s (0.6 when following and behind), speed scaled by
the cosine of the heading error (it turns on the spot when the goal is behind). Collisions: discs against colliders
(pushed out, then the bump reaction), against each other (a robot at rest gives way less, a robot pressed against
something fixed hardly at all), against you (0.25 m). A robot whose middle ends off the floor or inside furniture is
moved to the nearest cell with 0.2 m clearance.

**Rules** (`robots_rule`):

0. **dock**: places in a row 0.3 m from the longest wall, 0.42 m apart, centred on its free stretch; when that wall
   has no more room the row goes on along the walls nearest it. Robots get places in the order they stand round the
   room (their ways in do not cross), come in through a point 0.45 m in front of their place, turn to face out and
   rest, asleep.
1. **bounce**: straight at 0.35 m/s; a bump: back off 4 cm, turn on the spot to a random heading within 80 degrees
   of the way out (tried again, up to six times, if there is no room 0.4 m along it, so corners do not trap them),
   drive on. Every 20-40 s each spirals out (about 9 s) when it has 0.85 m of open floor.
2. **follow**: to you, each keeping its own distance (0.65 m + 4 cm a robot), keeping 0.45 m from the others,
   slowing as it arrives (it knows how fast you walk away), facing you while it waits. Too close: it backs off facing
   you. Blocked by the crowd: it queues for a moment, facing you.
3. **chain**: robot 0 follows you at 0.6 m, robot i follows the path of robot i - 1, 0.42 m behind it, so the line
   snakes after you; a follower steps aside when the one ahead comes back its way; the head of the line does not wait
   for its own follower and wriggles out if its coil boxes it in.
4. **flee**: within 1.8 m of you it drives away, sliding along walls rather than into them, and stops when cornered;
   further away it wanders at half speed (bounce).

In every rule robots step aside for you when you walk at them (on a screen for where the avatar means to go, so they
also clear its way while it waits), and for a robot they block. Robots going somewhere (follow, chain, dock, crumbs)
steer round walls and furniture (sliding past instead of bumping), and round your feet when you are not their goal;
they bump-and-turn off walls, furniture and you, and off another robot only when meeting it head on outside a crowd.

**Crumbs**: `crumbs(x, z)` spills 30-40 golden bits within 0.2 m (moved to open floor if needed; false if not on the
floor). The nearest one or two robots (by the way there; two when there are three or more) leave their rule, eat
(a bit goes when a robot passes within 0.15 m) and go back. At most 8 piles (the oldest goes). `robots_crumbs`
passing a whole number spills a pile on open floor 1-2 m from you, in front of you if possible.

## The player and the avatar

On screens an avatar (1.7 m: a rounded blue-grey body with shoulders, a head with two small eyes, arms that swing,
feet that step, a walking bob and sway, a soft shadow) walks for you: `walkTo(x, z)` at 1.1 m/s by the shortest way
(a distance field) with smooth turns, sliding along walls and furniture; it steps round robots, slows for them and
gives way to a robot that cannot move. `robots_walk` 1: it strolls a closed path round the table and the armchair
(about 24 s a lap, pausing twice to look about). In a headset `player(x, z, yaw, false)` puts you there and hides it.

## Links

With `robots_links` (follow and chain only): from each robot to whom it follows (you, or the one ahead) a cyan arc at
0.25 m with beads (4 cm) flowing along it every 9 cm towards the one followed, and a bright dot (7 cm) at the follower.

## Params

| param | default | meaning |
| --- | --- | --- |
| `robots_a` | 1 | fade (engine) |
| `robots_rule` | 1 | 0 dock, 1 bounce, 2 follow, 3 chain, 4 flee |
| `robots_n` | 6 | robots, 1-24 |
| `robots_trails` | 0 | the cleaned area's cyan tint |
| `robots_links` | 0 | who follows whom |
| `robots_scan` | 1 | the room-finding sweep (1: done, gone) |
| `robots_room` | 1 | 1 draw the room; 0 passthrough overlays only |
| `robots_walk` | 0 | 1 the avatar strolls |
| `robots_dust` | 0 | counter: dusty again at each whole number |
| `robots_crumbs` | 0 | counter: a pile at each whole number |

## Exports beyond the set contract

- `setRoom(room)`, `modelRoom()`, `room()` (the current description, normalised).
- `see(eye)`: the viewer's eye `[x, y, z]` in the set's frame, every frame before `update` (the screen camera, or the
  head in a headset). It decides the cutaway and where robots glance; in a headset its height is the `you` anchor's.
- `player(x, z, yaw, show)`: where you stand in the set's frame; `yaw` is a turn about y as three.js measures it
  (0 faces -z). `show` false (headset, every frame): no avatar, the robots treat (x, z) as you. `show` true puts the
  avatar there. `walkTo` also brings the avatar back.
- `walkTo(x, z)`: returns the target `[x, z]` (clamped to where the avatar fits) or false off the floor.
- `crumbs(x, z)`: true, or false off the floor.
- `floorPoint(origin, dir)`: a ray in the set's frame (`[x, y, z]` arrays; `dir` need not be unit length) against
  y = 0; `[x, z]` if it lands on the floor outside furniture that stops robots (under the coffee table counts as
  floor), else null.
- `avatar(show)`: `avatar(false)` hides the avatar (the "Your eyes" view), `avatar(true)` shows it; returns
  `{ x, z, head: [x, y, z], forward, yaw, walking, shown }` for placing that camera.
- `shift(c, s, tx, tz)`: the coordinates changed (a headset's recentre): robots, trails, piles and you move by
  x' = c x - s z + tx, z' = s x + c z + tz, and the next `setRoom` moves the cleaned floor the same way. `shift(null)`:
  nobody knows how they moved, so the robots start again from the dock and the piles go.
- `coverage()`, `robots()` (how many), `bumps()` (so far), `state()` (positions, headings, speeds, modes, goals,
  piles, player, room, dock places).
- `onBump(i, x, z, why)`: optional, set by the engine (as `onLaunch` is on the flock's): called at each bump, as
  `bumps()` counts it, with the robot, where it is in the set's frame and why (the engine's sound effects play a
  small knock there).

## Anchors, labels, views, controls

Anchors: `floor` (the floor's middle, y 0.02), `wall` (middle of the longest wall, 1.3 m), `dock` (the middle of the
places on the longest wall, 0.1 m), `you` (1.7 m on screens; the eye's height in a headset), `gang` (the robots'
middle, 0.3 m), `lead` (robot 0, 0.3 m), `crumbs` (the newest pile). Labels: **Floor** and **Wall** (cyan) during the
scan, **You** (amber) over the avatar when links show. Views (50 degree lens): `default` [35, 52, 7.8, 0, 0.1, 0.15]
(the whole room from above at an angle), `low` [25, 6, 1.7, 0, 0.1, 0] (0.25 m up; the engine should aim it at the
gang), `eyes` [0, -18, 0.3, 0, 1.6, 0] (a stand-in: the engine uses `avatar().head`). Controls: View (Above, Low
down, Your eyes), Rule (Follow me, Conga line, Keep away, Bump and turn), Robots (6, 12, 24), Floor (Off, Cleaned
floor), Network (Off, Who follows whom); `explore(c)` defaults to follow and sets `robots_walk` 0.

## Measured (headless, 120 s of simulation per run in steps of 1/60 s, model / box / L-shaped room, 6 and 24 robots)

From `harness.html` in the page (the same numbers in Node). The avatar strolled in the model room and was sent
somewhere new every 6 s in the others.

- Robots off the floor 0, inside furniture 0, NaN 0, in all 30 runs. A robot whose numbers ever go bad starts again
  at the dock (none did). Rooms of 15 x 15 to 40 x 30 m: no NaN, at most 10 ms a step while their paths are built. Pairs closer than 0.33 m after 3 s: none;
  closest pair 0.335 m (robots are 0.34 across).
- Speed at most 0.6 m/s (following), 0.37 m/s bouncing (0.47 while stepping out of your way), turn rate at most
  2.8 rad/s. Displacement including pushes at
  most 1.24 m/s (a robot shoved aside by the avatar walking at 1.1 m/s).
- Stuck (got no further than 0.2 m in 10 s while its rule wanted it to move, counted once a second): 0-9 robot-seconds
  with 6 robots; up to 34 with 24 (a crowd of 24 jammed between the sofa and the table, or herded into a corner when
  keeping away), out of about 2,600.
- Bounce coverage after 20, 60, 120 s with 6 robots: model 36, 62, 85 %; box 38, 79, 93 %; L room 42, 76, 90 %.
  With 24: model 81, 93, 95 %.
- Conga line, distance to the one ahead after 30 s (wanted 0.42 + 0.03): median 0.447-0.465 m, 10th-90th percentile
  0.36-0.80 m.
- A crumb pile about a metre away is gone 7.1 s (model), 7.4 s (box), 10.8 s (L room) after it is spilled.
- `setRoom` with 17 robots outside the new room: 0 outside after it, 0 in the next 10 s. The same room again: 0.1 ms,
  the cleaned share unchanged.
- Build 52-62 ms in headless Chromium; `setRoom` 6 ms (L room), 17 ms (model), 28 ms (a 9 x 8 m room with a 60-point
  floor and six blocks) in Node. Draw calls 9 (6 robots), 11 with links; triangles 30k (6 robots) to 64k (24 robots,
  links, crumbs). The avatar's stroll: 23.8 s a lap.

## Science

May say: early robot vacuums had no map and much of the time drove until they bumped into something, turned and drove
on; random bouncing covers a floor in the end, but the last patches take longest; in swarm robotics each robot often
follows a few others, and the network of who follows whom (a star, a chain) shapes what the group does (Olfati-Saber,
Fax and Murray, Proc. IEEE 95, 2007). Headsets such as Meta Quest keep the room's floor, walls and furniture from their
room setup, and WebXR pages can ask for them. Must not say how any brand's robot works today, or that the speeds and
coverage times are measured: they are tuned to look right.

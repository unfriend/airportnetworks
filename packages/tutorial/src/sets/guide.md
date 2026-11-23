# `guide` - the tutorial's robot guide and its props (sets/guide.js, with sets/script.js)

Life size: 1 unit is 1 m, the floor y = 0, the viewer's start at the origin looking along -z, right +x. The guide's home
is (0.35, -2.0), 10 degrees right of ahead; the panel hangs 33 degrees left.

- **The figure**: the people's street-armour mannequin (`bodies.js`, posed by `ik.js`) in a draw set of its own
  (`HOST.bodies.set(2)`, attached to the scene's root, `I.toWorld` the set's frame), size fixed at 1.62 m eyes (1.75 m
  tall), its colour pearl `#e8eef8`, the copy amber `#ffb347`. Its head and two hands come from the script (wrists and
  aims in its own frame, `HOST.bodies.grip`; never eased by bodies.js: `ease: 0`); ik.js does arms, legs and footsteps.
  Its look per frame: `hide`, `dark`, `power`, `flash` over the parts (`HOST.bodies.PARTS`). The body stands about 8 cm
  behind its head pose (the eyes): the script places it by its head. A live guard (per device): your head within 0.6 m
  of its head caps its power at 0.3 and drops its flash, within 0.35 m hides it (the solver runs on).
- **Seeking**: the solver keeps state (planted feet, the hips' heading, velocity); a jump (a seek, a late join, a gap
  over 0.5 s, backwards, a change of mode) re-warms it: 30 solve-only steps (`warm: true`) of 1/30 s over the second
  before. Paused, dt is 0: drawn, nothing moves, and its scan (the set's `begin(story ms)`) stands still.
- **The plain figure** (no `HOST.needBodies`, it resolves false, or `?nofvt`): a helmet, a visor strip, a torso,
  a pelvis, an arm and a leg cylinder each, boots and fists, the emblem and spine nodes as small instanced meshes, in the
  same head and hand frames; power as brightness. Every prop works the same on it.
- **Props**: the ray (a 6 mm cylinder from the right fist, cyan `#46d9ff`, fading over its last 30 %, a dot where it meets
  its target); the target (a 14 cm ring at (-0.6, 1.5, -1.8), lit by the script or while your ray is on it); five
  markers (18 cm hexes on the floor on an arc of 2.4 m at bearings -10 to 38 degrees, each with a gem and a number; they
  fly from the spine's nodes, 0.3 s apart, 0.8 s each; the one the guide stands on glows) and the line joining them;
  the network (the badge leaves the chest from its four points, flies 1.6 s to (-0.05, 1.3, -1.25), grows to 0.7 m
  across, then six more nodes sprout: 10 nodes, 12 links, the hub's degree 6; beads run the links hop by hop, 0.35 s a
  link; dimmed to 40 % from the menu chapter to the story's end); the mini menu (a 32 x 20 cm hologram over the right
  hand: Story, Settings, Circles, Debug and the five Settings rows); the copy (a second figure in the same set); boot
  trails (six fading discs a boot, from the script); the card ("Next: Airports", or "Your circle's stories" in a room);
  the narration hold's sign; soft shadows; in VR and on a page a dark floor 8 m across with a 0.5 m grid fading out
  from 3 m (none in AR).
- **Practice** (`guide_mode` 1): its own clock (this device's, standing still while practice is paused), a boot-up of
  1.2 s at home, an idle loop (a weight shift every 4 s, a visor sweep every 9 s, a glance at the network every 6 s) and
  reactions added on that clock: `react('done', n, m)` (turn to you, two nods, its tag "Task n of m: done"),
  `react('all')` (four 90 degree clicks and a wave), `react('signal', i)` (it points at the node), `react('nudge', i)`
  (it mimes the next task). `walkTo(i)` walks to marker i at 0.6 m/s (returns when it arrives).

## Params

| param | default | meaning |
| --- | --- | --- |
| `guide_a` | 1 | fade (engine) |
| `guide_clock` | 0 | the script's clock in story seconds (keyed linear 0 to 187: `LIN`) |
| `guide_mode` | 0 | 0 the story, 1 practice (a step) |
| `guide_net` | 1 | practice: 0 the badge (4 nodes), 1 grown (10) (a step) |

## Exports beyond the set contract

`see(live)`: what the engine tells it every frame (`head`, `ray` (where your ray points), `panel` (the main panel's
buttons by name, in the set's frame; none on a page: fixed points), `room`, `ar`, `hover` (a node's index or 'target'),
`paused`, `hold`). `hit(o, d)`: a ray's hit in the set's frame (`node` with its id, `target`). `signal(i)`,
`signalOn()` (true for at least 1.5 s after the latest), `chapters(CH)`, `react`, `walkTo`, `setRun`, `practice()`,
`practiceReset()`, `figure()` (`'wait'`, `'bodies'`, `'plain'`), `usePlain(why)`, `bodyStats()`, `frame()` (the
evaluated frame), `nodeAt(i)`, `degree(i)`, `state()` (for tests: figure, figures drawn, the hidden mask, the copy,
nodes, beads, the tag, where it stands), `dispose()` (its body set first: bodies.js's geometries are shared).

## Anchors, labels, views, controls

Anchors `head`, `tag` (over its head), `copy`, `copyTag`, `fist` (the right fist), `chest`, `boots`, `net`, `target`,
`menu`, `card`, `nodeTag`, `marker0` to `marker4`, `node0` to `node9`. Labels: its status line (Calibrating, Correcting:
4 cm left, Network deployed, Labels: hidden, Copy created, Copy removed, Powering down, Practice mode, Task 3 of 7: done,
Practice complete, Paused) at `tag`; "Guest" (amber) over the copy; the node pointed at ("Hub: 6 links", "Node: 4 links",
"Leaf: 1 link"). Views: `default` [-8, 12, 2.48, 0.35, 1.1, -2] (where you stand), `side` (from the right at the
markers), `net` (at the network from about a metre), `wide` (both robots). Control: Network (Grown, Badge).

## Measured

In the harness (SwiftShader, 640 x 400): 4 draw calls at the T-pose (the body, its glows, the floor, a shadow), about
10 with the network; build under 20 ms. The body 2,470 triangles and its glows 840 (bodies.js). Untested on a headset.

# The robot gang (`stories/robots.js`)

A gang of robot vacuums in a room with you: a short story (about 1:24), then free play for as long as you stay. On a
screen you stand in a model living room and click the floor to walk; in a headset the room is your own, read from the
headset's room setup (WebXR plane and mesh detection), and the gang drives on your floor. Built like the flock: edit
the sources here, then

```sh
node tools/robots/build.mjs          # writes stories/robots.js
node tools/robots/build.mjs --check  # exits 1 if stories/robots.js is out of date
```

and bump `VERSION` in `sw.js`. The contract between the parts is `SPEC.md`.

| Path | What it is |
| --- | --- |
| `sets/robots.js` | the one set: the simulation (rules, bumps, crumbs, the avatar), the robots, the model living room, rooms drawn from a description, the dusty floor, the links (manifest: `sets/robots.md`) |
| `engine/` | the flock's engine parts, adapted: one scene, a screen camera with three views (above, low down on the gang, your eyes), click to walk, the headset's room (`xrRoom` in `e5_xr.js`), the trigger on the floor spills crumbs |
| `build.mjs` | puts the tour's kit (`../lbi/kit.js`), the set and the engine parts together |
| `harness.html`, `shot.mjs`, `sweep.mjs` | the set on its own (`harness.html?set=robots&room=box&sim=20&anim=1`, see its header) and screenshots, as in `tools/flock` |

Serve the repository root (`python3 -m http.server 8123`) and run the tools from this folder
(`node shot.mjs robots "<query>|<query>" <prefix>`, `node sweep.mjs <prefix> "5,25,65" [width height]`); shots go to
`shots/`. The gang is a live simulation, so `sweep.mjs` runs the story on (without drawing) up to each shot.

In the browser console: `HOST.cur.peek('GL.sets.robots.state()')` (robots, piles, the player, the room),
`HOST.cur.peek('simStory(0, 30)')` or `simExplore(20)` (run on fast), `HOST.cur.peek('XRR')` (the headset's room).
Useful hashes: `#robots&t=25`, `#robots&explore&rule=chain&robots=12&trails=on&links=on&view=low`, `&crumbs`,
`&walk=1.5,1.2`, `&view=eyes`.

## The headset's room

Every story asks for `plane-detection` and `mesh-detection` as optional features when it starts a headset session (a
session survives a change of story, so the gang may inherit one). `xrRoom(frame, ref)` runs every frame and reads the
room again when the detected planes or meshes change, once a second besides (poses can move without a change, and a
first read can come before tracking has them), at most twice a second, or at once after the reference space was reset;
`setRoom` skips a room that has not changed, so the cleaned floor stays. The room: the floor (the plane labelled floor,
else the lowest large plane facing up), the walls (planes labelled wall, or tall unlabelled vertical ones; door and
window frames, wall art and invisible wall faces are skipped), the furniture (labelled seats, cupboards, beds and other
surfaces, and detected volumes; tables and desks are left out, and so are volumes raised more than 12 cm off the floor,
the robots go under them). A recentre (a reset with a transform) carries the robots, piles, trails and cleaned floor to
the new coordinates (`shift`); without a transform the robots start again from the dock. The set's frame is then the
reference space moved down to the floor: `GL.world` = inverse(rig) x translation(0, floor, 0), so the room stays put
when the rig (panels, anchors) moves. Without a room (no feature, no room setup) a virtual room hangs on the rig, 1.6
m below your head: the model living room in VR, a bare 4 m x 5 m box in passthrough; the panel (and, where there is
space, the story panel) offers *Set up your room* where the browser can start the headset's room setup (once a
session, as Quest allows). The story panel's paragraphs may carry a headset wording in `data-xr` (you walk yourself
there; the trigger spills crumbs). `tools/smoke.mjs` checks this with a pretend headset (a floor plane, four walls and
a couch: the set gets a real room, the robots stay in it, the floor is where the plane is, the trigger on the floor
spills crumbs). What the headset really reports, the passthrough look and comfort can only be checked on a device.

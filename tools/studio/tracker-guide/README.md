# The tracker guide (example scene)

`examples/tracker-guide/` (v200): the ways to wear trackers, one stand each, life size, from eleven trackers on the whole
body to a headset alone, each with the tutorial's robot moving as the app's own solver (`ik.js`) poses it, and its sign;
at the end a robot to wear yourself. Made by `node tools/studio/tracker-guide/make.mjs` (`--check` says whether the
folder is current; `--sheet <file.png>` a contact sheet of the models' pictures); never edit the folder by hand.

Open it: the Experiments set's card *Tracker guide* (the studio on it, visiting: no editing), or the studio's Scene pane,
*Examples*, *Open* beside `tracker-guide`, or `index.html#studio&scenes=examples&scene=tracker-guide`. You start at its
entrance facing down it (-z).

## How it is made

- `page.html` and `parts.js`: the models, built in headless Chromium with three.js r128's own glTF exporter and loader,
  the Bliss XP room's kit (`tools/studio/xp/kit.js`), the studio tour's sign maker (`tools/studio/tour/parts.js`), and the
  app's `ik.js` and `bodies.js`, all loaded, not copied.
- The robot is the people's armour figure (`bodies.js`'s mannequin, `HOST.bodies.mannequin()`: the tutorial's guide),
  exported as a skinned model with Mixamo's bone names (23 bones, every vertex on one bone, 2,470 triangles; the plates,
  undersuit and visor lit in a deep shade of the guide's pearl colour, its lights unlit in the colour). The character worn
  at the T-pose stand is the same figure in the tutorial copy's orange, its armature 0.8 of the size.
- The motion is the solver's, not drawn by hand. A performer (the same mannequin, never drawn but at the T-pose stand)
  moves by a few turns of its joints (`MOVES`: idle, wave, marching on the spot with a wave, a lean and a walk round a
  circle 0.8 m across, hands up in front with a lean). Each tracker, the headset, the controllers and the tracked wrists
  are fixed to one of its bones at rest (`DEV`). Their poses each frame are the targets, lined up as the studio lines up (v201): with a
  headset the robot sized so its eyes are at the headset, with none `IK.fit` sizes it; `IK.match` ties every device to
  the part it is nearest to (the build fails if any is tied to another part than the one it is worn on), `IK.calibrate`
  (`'any'`) takes the offsets, `IK.solve` poses it 60 times a second (one loop first, unrecorded, so the stepping comes round), `IK.sample` takes it 20
  times a second and `IK.clipOf` makes the clip. The pucks drawn are the targets themselves (bones of their own, a second
  skin, two draws), so where a limb misses its puck is where the solver guessed.
- Where things are worn (`DEV`): the head's puck on the front of the head, above the visor (the owner, 25 November 2026);
  the chest's on its front; the hips' at the back, on the belt; the back of each hand; each upper arm just above the
  elbow; each thigh just above the knee (`KNEE`: 80 % of the way from the hip to the knee, **an assumption**, one setting);
  the top of each foot at the front. The headset over the eyes, the controllers in the fists (as `bodies.js` holds them),
  a tracked hand's ring at its wrist. Each is placed on the figure's surface by a ray against its bone's pieces.
- `robot.glb` holds every clip of the robot (*Idle*, *Wave*, one a stand, and the performer's *Line up*); each stand
  places it beside its own pucks model with the same clip name. The studio plays every clip on the scene's clock, so the
  two stay in step. The T-pose stand adds `character.glb` (its clip *Line up*: in its T-pose beside the robot, then sliding
  in and sized as `fit` says, then the solved bones) and a countdown board in its pucks model; then a line from each puck to
  the part `match` tied it to (`ln_<id>`, lit with its puck in `match`'s order, gone as the character starts to follow).
- `layout.mjs`: the signs' words (`signs()`), the stands' places and `layout.json` (`makeLayout`), every record in the
  studio's own shape; the sizes come from the lining up (`GUIDE.info()`). The floor (v203) is three planes side by side
  (left, walkway, right), 12 mm up, the pads 24 mm: the tour's `checks.mjs` fails the build when two faces facing up
  overlap less than 1 cm apart (the walkway lay 2 mm over the floor and flickered).
- `script.json`: the spoken lines. `voice.mjs` speaks them with Kokoro (`af_heart`, as `tools/voice/README.md` sets it up)
  into `voice/NN.mp3`; `make.mjs` then adds each as `sounds/voice-NN.mp3`, with a teal pad on the floor at each stand whose
  cube (each person's own) plays it once as you step on, and a press on each sign (for you alone) that plays it again.
  Without `voice/`, the scene has signs only.
- Budgets: a model under 10,000 triangles, the scene under 60,000 as placed, pictures at most 1,024 px, the folder under
  3 MB (about 2.8 MB without the voice: `robot.glb` 0.96 MB with its eight clips); with the spoken lines (1.3 MB of MP3) 4.5 MB.

To speak the lines (once the voice is set up as `tools/voice/README.md` says):

```sh
export VOICE_PYTHON=~/kokoro/venv/bin/python KOKORO_DIR=~/kokoro
node tools/studio/tracker-guide/voice.mjs && node tools/studio/tracker-guide/make.mjs
```

## The walk

The welcome (the robot waving, the sign), then six stands, odd on the left, even on the right, 3.4 m apart a side:
1 the whole body with 11 trackers, 2 lining up in a T-pose (the orange character in its T-pose beside the robot, a 5 s
countdown, the character coming to the robot and sized (it wears no headset), a line from each puck to its part, the
performer's body gone, the character following), 3 the whole body with 6
trackers, 4 feet and headset, 5 headset and controllers (its feet stepped by the solver as it leans and walks round), 6
headset and tracked hands; at the end *Try it yourself*: one robot whose wearing is ready (`puppet` `{ rig: 'any' }`, on
nobody yet; since v201 one way of wearing takes any mix of devices, so one robot is enough): with trackers on the relay,
open the scene from *Examples* (not visiting), turn on Edit, select it, *Line up with the performer*. A headset alone is
one of the mixes now; it is also how people's bodies show in a shared room, and *My body* (the settings) shows your own.
Beside it (v204), *Your mirror* (`mir008`, sign 8, spoken line 8): a robot whose record has `puppet` `{ mirror: 1.6 }`
(the studio's *Mirror the visitor*, `tools/trackers/SPEC.md`, "The mirror"). It needs nothing but a headset, visiting
too: stand on the pad 1.6 m in front of it and face it, and it copies you like a mirror, at your size, with a puck and a
tag at each device it sees (the headset, the controllers or bare hands, and the room's trackers near you). Each person
sees their own; on a page it plays its *Idle* clip. The try-it robot moved left (x -1.1) and the mirror stands on the
right (x 1.2), 0.4 m further on.

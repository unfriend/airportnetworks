# The studio tour (example scene)

`examples/studio-tour/` (v199): a hall you walk down with a stand for each thing the studio does, each with the thing
itself working and a sign (the studio's name for it, one sentence on what it does, what to do here), and at the end a
shuttle with the VR goggles. Made by `node tools/studio/tour/make.mjs` (`--check` says whether the folder is current;
`--sheet <file.png>` a contact sheet of the models' pictures); never edit the folder by hand.

Open it: the studio's Scene pane, *Examples*, *Open* beside `studio-tour`, page or headset; or
`index.html#studio&scenes=examples&scene=studio-tour`. You start at the hall's entrance facing down it (-z).

## How it is made

- `page.html` and `parts.js`: the models, built in headless Chromium with three.js r128's own glTF exporter and loader and
  the Bliss XP room's kit (`tools/studio/xp/kit.js`, loaded, not copied): the hall, the signs (a board of canvas text on a
  post, one unlit draw each, its picture a JPEG at quality 0.62), a small robot with five clips (Idle, Walk, Wave, Jump,
  Dance), a bee (Fly), an eye, a vase, a bowl drawn from one side only, an easel holding a painting (its picture material
  0, the one the texture cube swaps), a low wall, the shuttle, its game screen (a material named GameScreen, v203) and
  the world outside it.
- `sounds.mjs`: every sound synthesised (mono 16-bit WAV at 11,025 Hz: every partial is under 4 kHz).
- `layout.mjs`: the words of every sign (`STANDS`, `SIGNS`) and `layout.json` (`makeLayout`), every record in the studio's
  own shape; the smoke test's `studio tour` block reads each back through the engine's `norm`.
- `checks.mjs` (v203; the tracker guide uses it too): the build fails when anything overhangs the table it stands on (2 cm
  in at least) or two faces facing up overlap less than 1 cm apart in height (they flicker in a headset). So the floor
  is tiles side by side (`layout.mjs` `FLOOR`: by each wall, the sections' bands cut where they met, the floor, the
  walkway), their tops 12 mm up, the pads 24 mm; a table's size is [along the hall, height, across].
- Budgets: a model under 10,000 triangles, the scene under 60,000 as placed, pictures at most 1,024 px, the folder under
  2 MB (it is about 1.8 MB: signs 1.1 MB, models 0.39 MB, sounds 0.23 MB). As placed: 50 objects, about 11,200
  triangles and 74 draws, besides 68 shapes (one draw each).
- Everything is our own, made in code and seeded: no owner's files, no real products, logos, people or music.

## The walk

Two boards at the entrance (*Studio tour*, and *Also in the studio*: what a generated scene cannot show), then 26 stands,
odd numbers on the left, even on the right, 2 m apart along each side: the basics (blue bands on the floor's edges),
what reacts to you (green), what moves (amber). A cube's stand has a pad on the floor marking it (the cube stands on it,
floor to 2.2 m), so walking down the middle sets nothing off.

1 Models, 2 Textures, 3 Tint and brightness, 4 Faces, 5 Shapes (and Hides things), 6 Groups and empties, 7 Lock in
place, 8 Cut-outs, 9 On a wall, AR or VR only, 10 Paintings, 11 Trigger cubes, 12 Cubes for everyone, 13 Cubes that
start things, 14 Cubes that change textures, 15 Cubes that switch cubes, 16 Moved by anyone, cubes with a key, 17 Sounds
(an emitter, a sound that follows a model, started by a cube), 18 Press and hover, 19 Sequences, 20 Screens (an audio
player with two tunes: a video needs an MP4 of your own), 21 Sends to the output page, 22 Motions, 23 Behaviours, 24
Recorded paths, As it moves, 25 The ghost and the timeline, 26 Trails, 27 The shuttle.

## The shuttle

One object (`shtl01`, `models/shuttle.glb`): a boxy cabin for four (two benches), a doorway in its back facing the hall,
two windows a side, a shelf on the front wall with the VR goggles (`gog027`, a shape of kind `goggles`) and their sign
(each grip a throttle, either stick steers, the trigger scans: v203), and the game screen (`gscr27`, v203) with its sign
(`sggame`) under it: everyone at the circle sees on it who is flying, what they scanned, the links they followed and the
next protein (the studio draws it on the model's material named GameScreen: "Game screens" in `docs/agents/studio.md`).
Its cabin is a trigger cube (`cbn027`, each person's own):
inside it the hall (`hall01`) and the shuttle's outside sign go and `elsew1` comes, a dome 4.8 m round the cabin drawn
from inside (a violet sky, stars, a ringed planet at the left, a moon at the right, mountains, a rusty ground), and a
whoosh plays; stepping out brings the hall back. No stand stands within the dome (`layout.mjs` checks it), so nothing of
the hall shows through it.

To use your own shuttle: put your model in your copy of the scene (Copy to the relay first, then Upload), place it where
ours stands, and delete ours (`shtl01`); or change `shtl01`'s `file` in the copy's `layout.json`. The group *Shuttle*
holds everything that belongs to it (the shuttle, its cube, the world outside, the goggles, the game screen, its signs and
the whoosh), so
it moves as one. Keep the cabin cube inside your cabin and the world's dome round it, or resize them to fit.

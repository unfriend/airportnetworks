# From a Unity scene to a studio scene (`tools/studio/unity/`)

The owner (16 November 2026): port the Annette environment of a Unity project (`Photon2RoomHandTrackingAnnette`, its
`Environment` object) into a studio scene. The importer reads the Unity scene file and the project's assets and makes a
scene folder the studio opens, which `tools/studio/push.mjs` sends to a relay. Node's own modules; the models go through
the studio's own converter (`tools/studio/convert.mjs`, so Playwright as there), the sounds through `ffmpeg`.

**Its own branch** (the owner, 16 November 2026): the importer, its checks and this README live on the `unity-importer`
branch, not on `dev`: "we might not need them again and they would just bloat the app". `push.mjs` is on `dev`.
The dancequest2 placement check below crashed the headset (too much for it), so that scene is shelved.

```sh
node tools/studio/unity/import.mjs <unity project> <scene.unity> "<object path>" tools/studio/test/local/<scene> [--dry]
node tools/studio/unity/check.mjs tools/studio/test/local/<scene>      # where each object stands, as numbers
node tools/studio/push.mjs tools/studio/test/local/<scene> <relay> --dry
```

The checks (no test suite of the repository runs them; run them by hand after an import or a change here):

- `check.mjs <scene folder>`: each object's size, lowest and highest point and middle, from its GLB's bounds.
- `corners.mjs <unity project> <scene.unity> <scene folder> <object id>`: one object's drawing as Unity draws it and
  as the studio draws it, as two boxes, worked out apart from the importer's placing (for a model whose single node is
  the prefab's root): dancequest2's black floor, a miniature box and the chair agree to the millimetre.
- `studio-check.mjs <app address> <scene> [<cube name> ...]`: the scene opened in the studio in headless Chromium (a
  local relay serving `tools/studio/test/local`): ready or not, records refused, models and sounds loaded, items
  against `layout.json`, paths, and what each cube shows at the start and after walking into the cubes named; exit 1
  on a refused record, a failed model or a page error. It says nothing of a headset's frame rate or memory: the
  dancequest2 check passed it and crashed the headset.

The Annette environment, as the owner wants it (16 November 2026: unlit, the bat scans' pictures at 1,024 px):

```sh
node tools/studio/unity/import.mjs C:/Users/john/Documents/dancequest/testquestpt2 \
  C:/Users/john/Documents/dancequest/testquestpt2/Assets/QuestPun2Template/Scenes/Photon2RoomHandTrackingAnnette.unity \
  "Environment/Enviroment" tools/studio/test/local/annette-atelier --light scan --texture-of Fledermaus_01=1024
```

The dancequest2 scene (16 November 2026: `offline_dominik_mitvideo`, its `alltheworlds`, on the Unity project's
`offline` branch), the start room, the ladder room, the furniture, the reset and the chair only, to check the
placement in a headset (the other rooms wait for cubes that work only while their room is shown, below). Shelved: it
crashed the headset (109 objects, 99 of them animated dancers, two scans of 150,000 triangles):

```sh
node tools/studio/unity/import.mjs C:/Users/john/Documents/dancequest/testquestpt2 \
  C:/Users/john/Documents/dancequest/testquestpt2/Assets/offline_dominik_mitvideo.unity \
  alltheworlds tools/studio/test/local/dancequest2 --light scan --texture-of artefakte/=1024 \
  --skip ideen_fuer_spaeter --skip smallvideo --skip fromstudiotowerk \
  --skip kleinerraumohnestiege --skip studio --skip studio_inaufloesung --skip fainschmitz_video --skip inderkiste
```

(`ideen_fuer_spaeter`: ideas for later, not wanted; `smallvideo`: the 360 video, left out for now; `fromstudiotowerk`:
the door to the Werk hub, which is not in this scene.)

`<object path>` names GameObjects from the scene's top, joined by `/` (`Environment/Enviroment/Atelier`). Everything
under it that is active, or that a trigger shows, is ported. The out folder must not be in the repository (the owner's
own files); `tools/studio/test/local/` is git-ignored for them. Options: `--max-texture` (2,048 px, for Quest),
`--tris` (150,000: a model with more is made lighter to that many by the converter's `--keep`), `--tris-of
<words>=<n>` (as often as needed: models whose path holds the words made lighter to that many triangles, the first that
matches; the converter's simplifier keeps a model's seams, so some barely get lighter: the miniature ladder went from
22,307 to 21,166), `--small-under <m>` and `--small-keep <share>` (1 and 0.3: copies scaled to under half their model's
size and placed under that height share one lighter GLB, `<file>--small.glb`, with that share of the triangles and
pictures of at most 512 px; kept only when it saves a fifth of the triangles and comes out placed as the full one: the
miniature worlds' dancers, 4,488 triangles each, become 1,346; `--small-under 0` turns it off), `--light
auto|lit|scan` (auto: `scan` when every material of a model is unlit in Unity, else `lit`), `--mirror x|z` (below),
`--texture-of <words>=<px>` (as often as needed: models whose path holds the words get their textures drawn down to that
size, the first that matches; the bat scans are small and high up: `Fledermaus_01=1024` saves about
550 MB of GPU memory), `--skip <name>` (as often as needed: a part left out by its GameObject's name, with all it
holds; a trigger showing only that is left out too), `--force` (convert everything again), `--dry` (list, convert
nothing). Words are matched in the path within the project's `Assets/`.

## What becomes what

| Unity | studio |
| --- | --- |
| a placed FBX or OBJ (a prefab instance of a model) | an object: `models/<file>.glb`, placed where Unity has it |
| a placed `.prefab` whose root draws a model | an object of that model; `grab: true` (people may carry it) when a grab script is on it (`OVRGrabbable`, its Photon twin) |
| a material given to one placement (another texture) | a GLB of its own, `models/<file>--<texture>.glb` (the file's colour picture swapped by `--texture`) |
| `ObjectsToTrigger` + its `BoxCollider` (the player's `ColliderFromPlayer` acts on them) | a trigger cube: `while` when what it does on leaving undoes what it did (show A, hide B; then the reverse), else `stay`; its targets' items in `show` and `hide` (below) |
| what such a trigger does as you leave, when it does not undo what it did | a short sequence of shows and hides (`On leaving <cube>`), started by the cube as you leave it (`plays`, `when: 'leave'`) |
| `CLEANER` and `activator` (scripts turning up to five objects off, or on, each time their object comes on) | folded into the stay cubes that turn on the part holding them: those cubes also hide and show what the scripts name |
| an `AudioSource` (enabled, playing on awake) | a sound: `sounds/<clip>.mp3`, mono 96 kbit/s (as the relay's ffmpeg makes them); a 2D one (spatial blend 0) gets `r` 20 m; on a model it follows it (`on`); a loop shown from the start `start: 'always'`, else `'shown'` (one played once plays each time it is shown, as Unity plays it on awake: the start room's chime) |
| a Timeline's audio track (a dancer's foley) | a sound at what it is bound to (following its model), played by the Timeline's sequence where its clips start (`what: 'sound'`); 2D within 20 m, as Unity plays a track's clips with the track's spatial blend (0) |
| an Animator with a controller, or a Timeline on it or its parent | the GLB's first clip, looping, cut to Unity's clip window (below) |
| a Timeline (or a controller's `.anim`) that moves an object or one of its parents | a recorded path on the object (below) |
| a Timeline that turns things on and off, or plays takes at given moments | a sequence (below) |
| one model file in one place in several worlds, with other pictures | each world's own object and GLB (`--merge-copies`: one object whose pictures the cubes switch; below) |
| a built-in Cube, Sphere, Cylinder, Plane or Quad that is drawn | a shape in the material's colour |
| lights, particle systems, cameras, other scripts | not ported yet: listed at the end of every run |

A trigger that shows something outside the imported part (a door to another world) is left out, and said: import that
part too (unless it also shows something in the part, now or as you leave it). Objects inactive in Unity that no trigger
that becomes a cube, and no Timeline, turns on are left out (counted).

**What a cube shows.** A trigger turning an object on shows the items under it, but not what is off in Unity under it at
the start: Unity, turning the parent on, leaves such a child off until its own trigger has fired once (the box's
miniature room, the crouching woman, the three eva dancers, music parts 4 to 6). After that Unity brings it back with its
parent, unless something turns it off itself (the CLEANERs turn music parts 4 to 6 off; nothing turns the crouching
woman or the eva dancers off), so on a second round through the rooms they appear with their room in Unity and only
with their own trigger here. No fixed list is right on both rounds; this one is right on the first. What an activation
track turns on and off is shown with its parent (its path parks it while off). Hiding takes everything under the object.

**Reset scripts** (`CLEANER`, `activator`, the owner's: up to five objects turned off, or on, each time their object or
a parent comes on, in order, stopping at an empty field as the script throws there): a stay cube that turns on a part
holding one (nothing off between) also hides and shows what it names (the start room's `CLEANER (1)`: every other room
off, music parts 4 to 6 off, 1 to 3 on). Unity runs them only when the part was off; the cube does it each time it is
entered (in the start room, the reset at the front wall turns the small room and music part 4 off again; Unity leaves
them). Not for a while cube (the ladder: climbing down turns the room you were in on again, and its scripts run; which
room that is, a cube cannot know).

**Worlds and their doors.** The Annette environment (`Environment/Enviroment`) is four worlds in one place, each a
GameObject that triggers activate and deactivate: Atelier (active at the start), atelier_blaetter, outdoor and
Atelierwhite. Each world keeps its own copy of the four doors (pillars) at the same four places, and Unity has only the
copy of the world you are in active. The importer makes the copies of one door (same place, size and turn) one stay
cube that shows that world and hides the others, which is what walking into the place does in Unity whichever world you
are in. Two rules of the studio need care, and the importer takes it:

- An item a cube lists in `show` waits hidden until a cube shows it. The world Unity shows from the start would then
  start hidden, so a sequence shows it as the scene opens (`Start: the first world`, `start: 'open'`, shared, a `show`
  event at 0 for each of its items): a source in the cubes' rule from that moment, so any door walked into later decides
  over it, and nothing stamps it again. It shows about 1.5 s after the scene's items are in. (A stay cube whose `key` is
  an empty inside it would show it at once, but a headset coming back to its station in a room enters such a cube again
  and gets the first world shown over the one it was in: the review of 16 November 2026 found it in the code.)
- What a while cube shows (the hut's small cut-out, swapped in while you stand in the hut) is left out of the doors'
  `show` lists: Unity, activating a world again, leaves such a part as its own trigger last set it (off, once you left).

**What the studio cannot do yet** (found by a review of the code, 16 November 2026; each wants a change in the studio,
not the importer):

- A trigger inside one world (the hut's) works in every world: Unity has it only while its world is active. Stepping
  out of the hut area and back in, in another world, shows the Atelier's small cut-out there. A cube would need a
  condition, such as "works only while item X is shown for you".
- Coming back to the Atelier through its door while standing in the hut area shows the full hut until you step out of
  the hut area and in again (the door, entered later, wins over the hut's while cube).
- Walking through the door of the world you are already in starts its sequences again (the doors are one cube for all
  worlds; Unity's own door of a world is off in that world). A sequence started by a cube only when it is not playing
  would avoid it.
- A looping sequence stopped a second time takes the wrong cycle, so a `show` event of it can win over a door. The
  importer therefore never shows or hides with sequences: an object a timeline turns off is parked 300 m under the floor
  by its path instead.

dancequest2 needs more of the same (found by the analysis of 16 November 2026): its rooms stand in one place, and 11 of
its 15 triggers belong to one room (the stool, the box and the chair each open another room depending on the room you
are in; a line in the small room is armed by one trigger and disarmed by another). Imported as they are, every room's
triggers would work at once from the first step. Asked of the studio: a cube that works only while an item is shown for
you (each room's triggers gated by an empty in that room), and a clip's start offset per object (`StartAnimatorRandom`
starts each of the 159 small dancers at a random moment of its clip; here they move in step). Until then the
dancequest2 import holds the parts that are the same in every room.

The studio's converter also refuses some of the other rooms' models (a full import of 16 November 2026, into a scratch
folder): the five Dominik dancers (48_3, 48_4, 48_5, the crouching woman 48_kauernundso, dominik001_new) and two
artefacts (artfakt002, artfakt004). Their meshes switch between materials hundreds of times (48_3: 536 runs), and the
export makes one primitive per run: a skinned mesh becomes 536 meshes, one without corners shared multiplies its
triangles (artfakt002: 260 become 4,940); the converter's own check then writes nothing. The crouching woman draws
nothing at all, already as loaded. Both want a change in the converter (`tools/studio/engine/convert.js`: the triangles
of one material made one run before the export), not the importer.

`.import.json` in the out folder (a dot file: the relay never lists it) keeps each item's id by its Unity object, so an
import run again gives the same ids (a layout saved in the studio meanwhile still names the same things), and what each
GLB was made from (the source, the settings, the pictures given and those the converter found beside it, the converter's
own version), so only what changed is converted again. Files the layout no longer names leave the scene folder (a GLB a
merge left unused waits in `.cache/`, a dot folder, so its conversion is kept); `push.mjs` never deletes on the relay,
so old files stay there, unused.

**Pictures.** A GLB wears the pictures of Unity's materials for its file (the `.meta` remaps each of the file's
materials, by name, to a Unity material, whose picture it is). Where the converter finds the pictures the file names
and they are Unity's, they stay as found (the file's own names pair them with their materials: `raum`'s four). Where it
finds one Unity's materials do not use (the big atelier's FBX names `textured_output.jpg`, its Unity material uses
`textured_output 2.jpg`), or none at all (the eva dancers name a picture in another folder; the small room's black floor
names none), or leaves a material Unity gives a picture without one (dominik001_new's `TextureAtlas_1001`), each material
gets its Unity material's picture by name (`--texture <material>:map=<picture>`); with no material named as Unity's and
one picture in Unity, that picture. Only colour pictures count (a normal map the file names is told from them by its
name, as the studio's picture reader tells them: `engine/images.js`). A Unity material given to one placement with another
picture makes a GLB of its own (`--<picture>`), one with no picture a GLB of one plain colour (`--plain-<rrggbb>`:
Atelierwhite's white atelier and cut-out).

**Each world its own copies (by default).** Where the same file stands in the same place in several worlds with other
pictures (the small cut-out in Atelierwhite, outdoor and the hut; the big atelier in Atelier and Atelierwhite; the
100 m box in atelier_blaetter and Atelierwhite), each world keeps its own object with its own GLB, as Unity has it. The
owner tried one shared object whose pictures the doors switch, and saw some pictures come out wrong in the headset
(16 November 2026), so that is only on request: `--merge-copies` keeps one object and gives every cube that showed a
copy a `tex` entry putting that copy's picture on it (of the active cubes, the one entered last wins; with none active
its own picture is back); its own file is the copy shown from the start, else one with a picture; a copy without a
picture gets an 8 px picture of its material's colour; the pictures go to `pictures/`, drawn down as the converter
draws a model's (ffmpeg). It saves little: the studio loads a file once however often it is placed.

## Timelines (`timeline.mjs`, `anim.mjs`)

Read from the Unity files and played as Unity plays them (only what the scene uses): a director's time loops (wrap 1),
stops (2) or holds (0); a track's clip covers `[start, start + duration)`, holds its first frame before the first clip
and its last after the last (hold extrapolation); an AnimationClip is evaluated as Unity's curves are (cubic Hermite
with each key's slopes, an infinite slope holding, weighted keys as a Bezier), looping when its `m_LoopTime` says so. A
clip with curves on its root moves the bound object: its local position becomes `Pt + Rt (Pc + Rc (p(t) - p(0) when
remove start offset))`, its turn `Rt Rc` (track and clip offsets, mode 0), Euler angles turned Y·X·Z as Unity does. An
Animator whose controller's default state plays an `.anim` with root curves moves its object too (absolute, on the
scene's clock). Takes on bones (an FBX's take, or an `.anim` on `mixamorig:*` paths) and activation tracks are a
schedule, not a movement.

- **Paths.** Each object something moves gets a recorded path: its pose sampled 30 times a second (and on both sides of
  every moment it may jump: a clip's start and end, a loop coming round), relative to the record's `p` and `q` (the
  studio draws `p + q·d` and `q·qk`), then thinned as the studio's recorder thins (a key is dropped where the straight
  line between its neighbours stays within 4 mm and 0.9 degrees). `start: 'shown'`: it starts when its world is shown,
  as a director starts when its world is enabled. Its length is the time after which everything moving it repeats
  together (a director's length and a controller's clip length; the birds' two loops only after hours: their first 10
  minutes, then again). Over 600 keys or 120 s it is a file, `recordings/<name>-<id>.json`. A route longer than 900 m
  is anchored at its middle (keys may be at most 1 km off `p`).
- **Turned on and off.** An activation track (the climber gone after his climb, the sprinter seen only for three
  1.8 s moments) parks its object 300 m under the floor while it is off, by the object's path (with a key on both sides
  of each switch), rather than by sequence `show`/`hide` events (see "What the studio cannot do yet").
- **Takes held, then played.** An object whose take a timeline plays, and that no controller animates, gets a clip of
  the take's first frame added to its GLB (`first frame`, two keys: `glb.mjs`) as its own clip, as Unity holds the first
  frame until the clip starts; the sequence's runs play over it and it is back on that frame when a run ends.
- **Unity's clip window.** Unity plays only the frames of a take its `.meta` cuts (`clipAnimations`: `firstFrame` to
  `lastFrame`, at the FBX's own frame rate, its `TimeMode`); the converter keeps the whole take on the file's clock (the
  44_4 dancer's take from 14.3 s to 117.2 s; Unity plays frames 428 to 3528). So the GLB's take is cut to the window and
  starts at 0 (`cropAnimations` in `glb.mjs`: a key at both ends of each channel, the old keys out of the file), before
  its first frame is added.
- **Foley.** A Timeline's audio track becomes a sound played by its sequence (`once` where a clip starts, `loop` for a
  looping clip, a `stop` where a clip ends, at the latest at the Timeline's end (a held Timeline excepted), but not
  where another clip of the same file starts inside it). A clip trimmed or sped up in its Timeline is played from its start at normal speed, and
  said. Its id comes from the track's own id, so it stays when other tracks are muted or added.
- **Timelines turned on by Timelines.** A director on an object another director's activation track turns on starts as
  Unity starts it, each time its object comes on (play on awake): the other's sequence starts it where the activation
  starts (`what: 'seq'`) and stops it where it ends (the `dancers` Timeline: the three eva dancers at 4.95, 30.47 and
  46.52 s). Activation clips that follow on each other are one (Unity's activation mixer keeps the object on across
  them); one spanning a looping director's whole loop keeps it on while that director plays, so it starts with it (from
  the doors, or as the scene opens when that director is on from the start), and so do runs that meet across its seam
  (no start at 0 after the first round). A director that stops (wrap none) and leaves the object on afterwards turns it
  on again at its end; one that turns it off then stops it there. No door
  starts such a director; a door that hides it stops it (a sequence stopped does not stop what it started). An
  activation track on a group with no model of its own still makes a sequence, which parks and starts what the group
  holds. A held director (wrap hold) leaves on what its last moment has on; one that stops (wrap none) as the track's
  post-playback state says (the path's last key is that state).
- **Sequences.** A director with takes on an object's bones, an activation track or an audio track becomes a sequence
  (`sync: 'own'`, each person's own as Unity's triggers were; looping when the director loops; `start: 'open'` when its
  own object is on from the start, as Unity plays it on awake): a `clip` event where a take starts (`once` when it plays
  once, `loop` for a looping take longer than once, `hold` for an `.anim` that holds its last pose or a take that does
  not loop (the Timeline clip's Loop, else the take's Loop Time, off for a take its `.meta` never cut, as Unity's default),
  each with a `stop` where it ends; and a `stop` at 0 of
  a looping one that holds), and `path` once at 0 for an object it moves or turns on and off. An event past a Timeline
  of fixed length is left out (Unity never reaches it). The stay doors that show its world start it (`plays`, `what:
  'seq'`) and those that hide it stop it; a while cube does that as you go in and the opposite as you leave (climbing the
  ladder hides every room: their Timelines stop, and start from the beginning as the rooms come back).

## Placing: Unity's frame and the studio's

Unity is left-handed (+z ahead), the studio right-handed (-z ahead): a Unity world matrix `W` is the studio's `Z W Z`
(`Z` mirrors z). A model is more: Unity imports an FBX in metres (`useFileScale`: the file's `UnitScaleFactor` / 100,
times `globalScale`), mirrored in x, and when the file has a single top node (and `preserveHierarchy` is off) that node
becomes the prefab's root, whose transform the scene overrides (position and turn always, scale when changed; what it
does not override is the node's own, as the converter's GLB holds it). The converter's GLB is the file's nodes under its
own root (the guess of units and up axis, `B`). So an object's matrix is

`Z · W_unity · X · S_unity · N⁻¹ · B⁻¹`

with `X` the import's mirror, `S_unity` its unit scale, `N` the file's top node (single top node only) and `W_unity`
the placement's world matrix in Unity (its parents' and its own). An OBJ has no units (1 unit is 1 m: `S_unity` is
`globalScale`) and Unity keeps its single node under a root of its own, so `W_unity` takes that node's local transform
too (the scene's override of it, else the node's own). A `.prefab` places its mesh under the prefab's root, whose
transform the scene overrides, else the prefab's own. An OBJ with loose edges or points (`l`, `p` lines: Blender writes
loose edges so) is drawn as lines by three.js r128's OBJ loader, all of it: the converter gets a copy without them, with
its MTL and pictures, in the out folder's `.cache/obj/` (`kiste_nofloor.obj`: two loose edges).

**Uneven scales.** The studio scales an object evenly. Unity draws the model's own drawing with `G = Z · W_unity ·
childLocal · X · S_unity`; the object is `G · N⁻¹ · B⁻¹`, and when that is not an even scale (the scene scales the
model unevenly, or scales a node of uneven scale evenly), the model gets a GLB of its own whose node just above the
drawing (its top node, else the converter's group) carries `G`'s scale, that node's place and turn kept
(`<file>--s<shape>.glb`, shared by the copies of one shape; only its JSON changes, nothing is converted): the product is
then an even scale and the object stands exactly as in Unity. Not for a node a clip the object plays moves (its own, or a
take a Timeline plays on it): there the scale is evened in `G`'s frame (over a flat model's long axes, an axis
under a fifth of the longest being its thickness), the drawing's middle kept where Unity has it, and said. Checked against Unity's own corners (`G` on the
GLB's corners): dancequest2's black floor (`boden_black_kleinerraum`, 75 × 86 × 52, turned 95°, its drawing 8.6 units
off its node's origin) x −2.97 … 6.22, y −1.03 … 0.57, z −4.76 … 1.08 in both; a miniature box (2:1:1 on a cube whose
node is 127 × 234 × 100) the same in both, where evening had turned its long side 90°. Recorded paths use the same
placement at every key. Its position, turn and scale become `p`, `q` and `s`.

If every model comes out turned half round where it stands, Unity's import mirrors in z rather than x on that machine:
`--mirror z`.

Checked on the Atelier (22 models, 15 of them scans): the floor comes out at about y = -0.1 (Unity's environment stands
0.25 m low), the bats 2.36 times their size up under the roof (their parent `black` is scaled so in Unity), and the hut's
trigger box round the small cut-out it swaps in. How it looks is the owner's check; a headset's frame rate is untested.

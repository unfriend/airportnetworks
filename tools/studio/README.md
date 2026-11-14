# The studio: your own scenes

`stories/studio.js` (built from this folder: `node tools/studio/build.mjs`, `--check`) is a page of the app that is not a
story, like the design room: `#studio`. A **scene** is a folder of files (models, their textures, sounds) and its
`layout.json`, where everything placed stands: objects, see-through trigger cubes that show and hide them (or change
their pictures) as you walk in and out, and sounds placed in the room. The contract is `SPEC.md`.

## Running it

On a computer on the same Wi-Fi as the headsets:

```sh
node relay/server.mjs --lan --scenes <folder>
```

Each subfolder of `<folder>` is a scene. The relay serves the app, lists the scenes, serves their files, saves their
layouts (the old `layout.json` kept in the scene's `.history/`) and takes uploads. Open its address and pick
**Studio** (`#studio`), or `#studio&scene=<name>`. With `--scenes-readonly` nothing is written. With a password
(`COLLAB_TOKEN`) every scene endpoint and file needs it; each device enters it once (the Shared dialog, or the
headset menu's Circles tab).

Without a relay, `node tools/studio/scan.mjs <folder>` describes a plain folder of scenes for any web host (read only;
`#studio&scenes=<relative folder>`).

### Scenes in Cloudflare R2

A relay can keep the scenes in a Cloudflare R2 bucket instead of a folder (`--scenes r2`, the bucket and its keys from
the environment: `relay/README.md`, "Scenes in Cloudflare R2"). Nothing changes in the studio's use: it fetches every
file straight from the bucket by the signed link the relay's listing gives it, and its uploads (the Upload pane,
**Convert to GLB**, the texture buttons) go straight into the bucket. To work with no internet, pull the scenes onto a
laptop first and serve that folder:

```sh
node tools/studio/r2sync.mjs pull --all ~/scenes        # the R2_* variables set in this shell
node relay/server.mjs --lan --scenes ~/scenes
node tools/studio/r2sync.mjs push ~/scenes --all        # afterwards: what changed back into the bucket
```

`r2sync.mjs` moves exactly the files the relay lists (and each `layout.json`; `.history/` with `--history`), only those
that differ, deletes nothing without `--delete`, and `--dry` shows what it would do; `list` shows the bucket's scenes. A
file newer where it would go (a layout saved there since) is kept and said, unless `--force`, and a `layout.json` it
replaces on either side is first copied into that side's `.history/`. Should the bucket refuse a page's upload (its
CORS rule missing, say), the studio sends the file through the relay instead.

## The upload page

`<relay>/upload` (or the **Upload** tab in the studio, on a laptop or desktop; a headset has none) turns whatever you
drop into what the studio wants, and sorts it into the scene's folders:

1. Pick a scene, or **New scene** and give it a name.
2. Drop files or whole folders onto the pane (or **Choose files**, **Choose a folder**).
3. Read the plan: one row per thing it will make, before anything happens. A model and the files it names (its
   textures, an OBJ's MTL and the MTL's textures, a glTF's `.bin`), wherever they were in what you dropped, are one row;
   each sound is one row; anything left (a picture no model names, a text file) is kept as it is. A model whose texture
   is not there says so.
4. **For Quest** (on by default: textures at most 2,048 px; off: 4,096) and **Replace files with the same name** (off: a
   name already taken gets a number, `eva_001 2.glb`). Each model's row has **Triangles kept** (20 % to start) and
   **Preview**: the model over the whole window ("Looking closely: the viewer" below), with all its triangles and the
   share kept side by side; the share you choose there comes back to the row.
5. **Convert and upload**: each row converts in the browser and uploads, with its progress. Then **Open the scene**:
   the studio on that scene, editing on, the Add list showing what was made.

What it makes:

| You drop | It makes |
| --- | --- |
| A model: FBX, OBJ with its MTL, glTF with its `.bin`, GLB, PLY, STL | `models/<name>.glb`: metres and Y up (the studio's guess of its units and up axis baked in), textures drawn down and stored as JPEG (PNG where see-through), animations and skins kept, an FBX material of opacity 0 (3ds Max's habit) drawn solid, a mesh without normals marked to be shown as scanned. It is loaded back and checked; if something did not come through, the row says why and nothing is made. |
| A sound up to 20 s | `sounds/<name>.wav`: mono, 16-bit, at its own rate (at most 48 kHz): loops without a gap |
| A sound longer than 20 s | with ffmpeg on the relay: `sounds/<name>.mp3`, mono, 96 kbit/s (streamed when it plays); without: an MP3, M4A/AAC or OGG kept as it is (a stereo file plays from one point), anything else a mono WAV at 22.05 kHz |
| A video: MP4, M4V, MOV, MKV (a WebM with a picture too) | `videos/<name>.<ext>` as it is (a screen plays it, "Screens" in `SPEC.md`); with **Convert videos to MP4 (H.264)** on: `videos/<name>.mp4` made by the relay's ffmpeg, and the file you gave in `originals/` |
| Every file you gave | the same file in `originals/`, in its folders (so a model can be converted again) |

Without a relay that takes uploads the plan still shows, and **Convert** offers each GLB and WAV as a download.

**Videos and the option to convert them.** A video is kept as you gave it, into `videos/`. **Convert videos to MP4
(H.264): off / on** (off by default, kept on this computer; greyed with the reason where the relay has no ffmpeg with the
H.264 and AAC encoders, or takes no uploads) has the relay make an H.264 MP4 (`yuv420p`, AAC 128 kbit/s, `+faststart`,
at most 720 high with **For Quest** on, else 1080, never larger) as a job: the row shows its progress, one video is made
at a time and the next waits, and the file you gave goes to `originals/`. A conversion that fails says why and leaves your
file in `originals/`. Headsets and phones play MP4 (H.264) most surely; other files may not play everywhere. See
`relay/README.md` ("Converting a video") for the relay's side.

In a scene, the Add list shows `models/`, `sounds/` and anything outside `originals/`; `originals/` is folded under
**Originals**. A GLB made from another file of the scene (its `asset.extras.studio.from`, or the same base name) stands
for it: placing the original places the GLB. An FBX (or OBJ, PLY, STL, glTF) object's card has **Convert to GLB**, and
Add has **Convert every model**: with a relay the GLB goes into `models/` and every object placed from the original
switches to it where it stands; without one it is downloaded.

## Looking closely: the viewer

On a page (never in a headset), a model can be looked at over the whole window: **Preview** on an Upload row, **Look
closer** on a placed model's card while **Fewer triangles** is open, and **Look** on each model card of the Add pane (a
small button on the picture's corner; a press anywhere else on the card still places the model).

- It shows the model lit as the studio lights a scene (or **As scanned**), over a floor grid, with its size and
  triangles at the top. It turns by itself until you touch it. **Drag** to spin, the **wheel** or a **pinch** to zoom,
  a **right drag**, a **Shift drag** or **two fingers** to pan, a **double click** (or **Frame it**) to frame it again.
- For a model being made lighter (an Upload row, Look closer): **All triangles**, **Lighter** or **Side by side** (all of
  them on the left, the lighter one on the right, one camera for both; on a phone held upright, top and bottom), the **Share kept** slider (the lighter one is made
  again as you let it go: a big scan takes a moment), and both counts. The lighter one's pictures are shown with their
  gaps filled, as the GLB will have them.
- **Wireframe** draws its triangles' edges over it (the difference a share makes shows at once); **Textures: off** shows
  its shape alone.
- **Close** or **Esc** goes back to the studio as it was; the share you chose goes back to the row or the card. Nothing
  you do in the viewer changes the scene, its layout or a shared room, and Undo does not see it.

## Pictures in the Add pane

The Add pane shows the scene's models (and the Originals' models) as a grid of cards: a picture of each model, its
name, its size in metres and its triangles (where the studio knows them), so you can tell them apart without placing
them; sounds stay a list. A model without a picture has a plain tile with its kind (*GLB*, *FBX*...). On a page the grid
has 3 to 5 cards a row, by the pane's width; in a headset 3 a row, **Up** and **More** paging through them.

- A picture is a small JPEG (256 x 256, the model lit and seen from a little above, on a dark background) kept in the
  scene as `previews/<the model's path>.jpg`: `models/eva.glb`'s is `previews/models/eva.glb.jpg`. The relay takes only
  such pictures there (`.jpg`, at most 200 KB; the folder's name in lower case only) and never offers them as textures.
- The studio makes one **whenever it makes a GLB**: Convert to GLB, Convert every model, the Upload page, Fewer
  triangles' and Change texture's Save, and the texture buttons. With a relay that takes uploads it goes into the scene
  for everyone; without one it is for that page only.
- **Make pictures** (the Add pane, on a page with Edit on) makes the missing ones, one model after another, with how far
  it is and a **Stop**: uploaded with a relay that takes uploads, else for that page only. Each model is loaded and freed
  again, so a scene of big scans takes a while.
- From another scene copies a model's picture with it. Nothing of this is in `layout.json`.

## The Items pane

**Items** shows everything placed as cards in the same look: an object with its model's picture (the one the Add pane
shows for that file; a plain tile with its kind where there is none), and shapes, sounds, trigger cubes and empties with a
small drawing in their colour (a shape its kind, a sound a speaker, a cube a see-through box, an empty an axis cross).
Under each name a short line (*1.7 m · 24k triangles*, *Sphere*, *Sound · follows Dancer*, *Cube · shows 2, hides 1*,
*Empty*), and a fainter one that also says what moves it (*spins*, *recorded path*, *follows people*); 🔒 marks what is
locked in place and *moves* what has a motion, a recorded path or a behaviour. Groups come
first, a heading each (a press selects the group) with their members under it; a model's cut-outs are small tags on its
card (*✂ Door*: a press selects it). A press on a card selects it (its card opens under Item); the selected card has a
bright border, and while you pick what a cube shows or hides, what is on its list has a green or red one (a tag too). With a trigger cube selected, every card has **Shows** and **Hides** under it: a press puts the item on
that list of the cube, again takes it off (page and headset). In a headset the cards are three a row, **Up** and **More**
(or a stick) paging through them.

## Sounds that follow a model

A sound can follow an object, or one of its bones, so a voice stays at a dancer's head and the sounds of her moving at
her chest. With **Edit** on:

1. Place the sound (Add) and move it to her mouth.
2. On its card, **Follow an object...**, then point at her and pull the trigger (or click her, or pick her name from the
   card's list). The sound now follows her whole model from where it is.
3. Under **Bone**, press **Head**. It stays where it is, and now turns and moves with her head. **More bones...** lists
   every bone (a model with no bones offers the parts its animation moves instead).

**Move onto it** puts the sound right on the bone; **Stop following** leaves it where it is now. Moving the sound by hand
keeps it following from where you put it, sizing her keeps it at the same point on her, and switching her to a GLB keeps
it where it was. It is heard only while she is shown to you (a cube that hides her hides her voice too); with **When
shown** it starts from its beginning each time she appears. Everyone at a station hears it from the same bone. The
bone's name is kept as the studio reads it, and found again leniently (an FBX's *mixamorig:Head* is *mixamorigHead* in
its GLB). The short list (*Head*, *Neck*, *Chest*, *Hips*, the hands and the feet) knows Mixamo, 3ds Max's Biped, Unreal,
Rigify and VRM names.

## Cubes for everyone, and AR or VR only

- **Works for: Each person / Everyone here** (a trigger cube's card, with **Edit** on): a cube is each person's own (it
  shows, hides, changes and starts things only for whoever is inside it), or, set to **Everyone here**, it works for
  everyone at the circle as soon as anyone in a headset is inside it, at the same moment on every device (a cube that
  **stays** stays so once anyone has been inside). On a page outside a room your own camera in Walk view counts, as ever.
- **Shows in: AR and VR / Only AR / Only VR** (an object's, a sound's, a shape's or an empty's card): only in AR it is not
  drawn or heard in VR or on a page, only in VR not in AR (where the real room is there instead: stand-in walls and a
  floor for a VR visitor, say). While editing one that does not show here is drawn as a hidden thing is, its tag saying
  *· AR only* or *· VR only*.

Both shared in a room and saved in `layout.json` (`all` on a cube, `shows` on an item; "Cubes for everyone" and "AR or VR
only" in `SPEC.md`).

## Trigger cubes that change pictures

A trigger cube can also put another picture on an object while you are in it (the owner: "trigger cube replace texture
mode", no crossfade). On the cube's card, with **Edit** on (page or headset): **Change a texture...**, then point at the
object (or click it, or pick it from the list), its material when it has more than one, the slot (**Colour** first, then
Normal, Roughness, Metalness, Occlusion, Glow, Opacity) and one of the scene's pictures. Each change is a row under
**Changes textures** (*Box · Colour → night.png*): a press flashes the object in amber, ✕ takes it off. Up to 16 a cube.

- Walk into the cube and the object shows that picture at once; walk out and its own is back (a cube that **stays** keeps
  it). Two cubes changing the same slot: the one you entered last wins. Each person sees what their own place does.
- **As scanned** shows only a Colour picture; the other slots need the object lit (Roughness and Metalness show on a GLB's
  materials).
- Only that object changes: another object of the same file keeps its own picture. The model's file is never changed.
- Deleting the object takes its rows out of every cube; duplicating it (or its group) adds rows for the copy; switching it
  to its GLB keeps them. **Reset what I have seen** and the lobby put every object's own pictures back.
- The pictures are read when the scene opens (drawn down to 2,048 px), so the switch is instant; many big pictures cost a
  headset memory (untested on a Quest).

## Cut-outs: a door in a wall

A cut-out is a box that hides the part of one model inside it, without changing the model's file. A scan of a room is
one mesh, so you cannot hide its door by name; a box over the door hides it. With **Edit** on:

1. Select the wall by pointing at it where the door should be and pulling the trigger (or clicking it there on a page),
   then on the wall's card press **Cut out a part** (or **Cut-out box** under Add while the wall is selected). A box 0.8 m
   wide, 2 m high and 40 cm deep stands where you selected it, facing you, and the wall inside it is gone.
2. Move, turn and size the box: on a page the arrows (W, E, R; the size per side), on its card the size steps (5 cm a
   side, or every side at once) and **Turn 90°**; in a headset the grip carries it, both grips size it and the grip on a
   corner stretches it (the opposite corner stays).
3. To open the door only as people walk up, make a trigger cube in front of the wall, **Pick what it shows** and press
   the cut-out. Until someone stands in the cube the wall is whole for them; inside it, the door opens.

**Preview** on its card is for this device only, while editing: **As seen** (as the cubes say for you), **Cut** (the hole
shown whatever the cubes say, so you can size a door its cube opens from anywhere) or **Whole** (the model whole). The
box stays on the same part of the model when the model is moved, turned, sized or switched to its GLB; duplicating a
box (or its model) puts the copy in the same cubes' lists. While editing the box is only its dashed red-orange edges and
the ticks at its corners, nothing see-through, so many boxes cost a headset little; pointed at or selected, its edges
light up (lighter, the dashes denser, the ticks longer).

Not editing, nothing of the box is drawn: only the hole. The edges of a hole are open (you look into the thin surface):
that is how it is meant to be. A model takes at most 16 cut-outs, a scene 100. **Move onto another object...** gives a
box to another model, where it stands.

## Groups: things that move together

A group is a named set of objects, sounds and trigger cubes that move, turn and size as one (a model's cut-outs, and
the sounds that follow it, come with it anyway). With **Edit** on:

1. Select one of them and press **Make a group...** on its card. Then point at the others and pull the trigger (or click
   them on a page; Ctrl- or Shift-click work too, as do their cards under Items) to put them in; again to take one out.
   **Done** ends it. An item is in one group at most: picked for another, it moves into that one.
2. A click (or the trigger) on a member selects its group: the group's card, and a faint box round all its members. A
   second click on the same member selects that member alone (its card says *In group ...* and has **Select the
   group**); selected on its own, it moves alone.
3. Move the group: on a page the arrows (W move, E turn, R size), on its card **Turn 90°**, the size steps and **On the
   floor**; in a headset the grip on any member carries the whole group (it turns with your hand only while Moving is
   *free*), both grips size it. It turns about the vertical only (cubes stay level) and sizes alike on every side, about
   its middle on the floor (the middle of its members, which stays put as it turns). **On the floor** puts its models'
   lowest point on the floor (its cubes and sounds do not count). Every move is one Undo step.

**Duplicate** copies every member as a new group beside it (a copied sound follows the copy of its model; a copied cube
shows and hides the copies of what it showed and hid in the group). **Ungroup** keeps the members and drops the group;
**Delete** deletes every member. A group left with fewer than two members goes by itself (Undo back to one member leaves
it picking its members again, as it was then; a group still picking is not saved until it has two). A trigger cube's
**Pick what it shows** (or hides) takes a whole group when you point at one of its members.

## Faces: both sides, or inside out

Each placed object's card has **Faces**: **As in the file** (as the model says), **Both sides** (thin walls, leaves and
cloth seen from behind too) or **Inside out** (only the inner side drawn: for a model whose faces point the wrong way, or
a room you want to see from inside, as walls that vanish from outside). It is the object's own setting, so two copies of
one file may differ; the file is never changed, and the setting stays when the model is converted to a GLB, switched to
it or changed on the relay. It is shared in a room and saved in `layout.json`.

## Tint and brightness

Each placed object's card has **Tint**: **None**, or one of ten colours (the shapes' own); on a page also **Any colour**,
a colour picker. The model's colours are multiplied by it, its textures too (white parts take the colour exactly, dark
ones stay dark). **Brightness** goes **Darker** (×0.8) or **Brighter** (×1.25), from 25 % to 400 %, and **Reset** puts it
back to 100 %; above 100 % a texture brightens too. Both are the object's own, so two copies of one file may differ; the
file is never changed, and they stay when the model is converted to a GLB, switched to it or changed on the relay. With a
group selected, the same rows set every object of the group at once. Shared in a room and saved in `layout.json`
(`tint`, `bright`); a lock in place does not stop them (they move nothing).

## Shapes, empties, locks and the scene's settings

- **Shapes** (Add, *Shapes*: Cube, Sphere, Cylinder, Plane): plain shapes in a colour, or ones that **hide things**: on
  the card, *Look: Hides things* makes it invisible, hiding whatever of the scene stands behind it. In AR your room shows
  through it, so a box the size of a real table hides the virtual things behind that table, as the table would. While
  editing it shows as a see-through fill so you can find it. Size it per side (the card's steps, the page's arrows, a
  cube's corners in a headset) and pick its colour from the swatches.
- **Empties** (Add, *Empty*): a point you only see while editing (a small cross). Put a sound on it: on the sound's card,
  *Follow an object...*, then point at the empty. Move the empty and the sound goes with it; a trigger cube that hides
  the empty silences the sound.
- **Lock in place** (every card, by *Duplicate* and *Delete*): a locked thing cannot be moved, turned, sized or deleted
  by any hand, page or headset, until *Unlock*. A locked group holds all its members; a group with a locked member does
  not move and says which. It is shared and saved.
- **The scene's settings** (Scene, while editing): *Other circles: Hidden* hides the other circles' rings, cards and icons
  for everyone at this studio's circle in a shared room; *Real world hides the scene* sets whether real things hide the
  scene in AR (*As each headset has it*, *Always* or *Never*). Both are saved with the scene.
- **The scene and its circle** (v125): in a shared room the scene stands on the room's spots (spot A its origin, x
  towards spot B), not round its circle: the circle is only the way in, and moving or turning it moves nothing of the
  scene; two circles of one scene show it at the same place. A scene placed before v125 stood round its circle: *Move the
  scene to this circle* (Scene, while editing at its circle) moves every item there again, for everyone (one Undo step;
  refused while something is locked in place, saying which).
- **The lobby**: when a headset walks into the room's *Back to the lobby* circle, it forgets what it has seen in the
  studio, so the scene starts afresh for the next person who puts it on.

## Behaviours: look at, follow, keep away, follow an item

An object, a shape or an empty can react to the people in the room: on its card, **Behaviour** picks **Look at** (it turns
to face them), **Follow** (it comes along and stays a little in front of them, at its own height), **Keep away** (it
moves off when they come close, but never far from its place) or **Follow an item...** (point at another object, shape or
empty, or pick it from the list: it follows that one at the distance they stand apart, a little behind), or **None**.
**Reacts to** chooses whom: the **Nearest** person within reach, or the **First to come close**, until they walk away.
**Less** and **More** set how far it notices people, how far in front of them it stays or how far it keeps away, and how
far from its place it may go; **Slower** and **Faster** how fast it moves. In a shared room it reacts to one headset at a
time, the same one for everyone at the circle; pages never count. With nobody near it goes back to its place by itself.
Like a motion it is drawn over where the thing stands, so moving it, saving it and Undo work as ever; it goes on while
you have it selected (a ghost shows where it is placed) and rests there while you carry it or Pause is on. Shared in a
room and saved in `layout.json`
(`engine/e6g_behave.js`; "Behaviours" in `SPEC.md`).

**On a wall** puts it on the room's walls, as each headset's own room scan finds them in AR: **Which wall** is the wall in
its direction from the middle of the scene, the **Nearest** wall, or the wall nearest the person it reacts to (it
**Follows the person** along there; with nobody, back on the wall in its direction). Its back is against the wall (**Gap
from the wall**, 3 cm to start), its front into the room, at its own height where the wall has room. In VR, on a page and
before a headset has scanned its room it stands where it is placed. Nothing is sent: each headset puts it on its own walls
(`engine/e6o_walls.js`; "Things on walls" in `SPEC.md`).

## Motions: spin, wobble, bob, pulse, orbit, sway

An object, a shape or an empty can move on its own: on its card, **Motion** picks **Spin** (turns round its axis),
**Wobble** (tilts and the tilt goes round), **Bob** (up and down), **Pulse** (grows and shrinks a little), **Orbit**
(goes round a small circle, still facing its way) or **Sway** (swings to and fro), or **None**. **Slower** and **Faster**
set how many a minute (*The other way* turns a spin or an orbit round), **Less** and **More** how far (degrees, metres,
or a share of its size for a pulse), **Axis** which way (upright, side to side, front to back), and **Starts** whether it
runs **Always** (on the room's clock: everyone at a circle sees it at the same moment) or **When shown** (from when a
trigger cube shows it to you). It is drawn over where the thing stands: its place is not changed, so moving it, saving it
and Undo work as ever. It keeps moving while you have it selected, so you see the motion you picked at once; the others
still see it move. A sound on it, or a cut-out, moves with it. Shared in a room and saved in `layout.json`.

## Placing what moves: the ghost and Pause

- **The ghost.** While something you have selected moves away from where it is placed (a motion, a recorded path, a
  behaviour), a pale see-through copy stands at its place: that is where it is placed, and what Save keeps. On a page its
  arrows stand on the ghost: drag them and the thing rests there while you drag, then moves on from its new place. In a
  headset the grip on the ghost, or on the thing where it is, carries it from its place; let go, it moves on from there.
  Its card's buttons (Turn 90°, On the floor, the size steps) work on its place as ever. A very big model's ghost is just
  its outline box. Selecting a cut-out of it, or a sound that follows it, stands it still at its place while that is
  selected, so you place those on it where it is placed.
- **Pause.** **Motions: playing / paused** on the Scene tab (while editing), on the card of anything that moves, or **P**
  on a page: everything stands where it is placed and animations hold their frame, so placing is easy; sounds play on.
  It is this device's own (nobody else sees it), and turning Edit off plays everything again.
- **Start again** on the card of something that starts *When shown* or plays *Once* plays it from its beginning, on this
  device only.

## Recorded paths: the recorder

An object, a shape, an empty or a sound can play back a movement you make with it (a group cannot: record its members
one by one; each plays its own and moves with the group).

- **In a headset**: select it, press **Record its movement** on its card, then press a grip (on it, or anywhere, as with
  Hold it) and carry it as you want it to move: swing it, turn it, push it away or pull it in with the right stick, turn
  it with the left stick. Let go and the movement is kept. The sticks do not size it while it records, nor does your
  other hand (a path has no size).
- **On a page**: select it, press **Record** on its card, then move it with its arrows (Move, Turn) or its card's buttons
  (Turn 90°, On the floor...), taking your time: the pauses are recorded too. **Stop** keeps it, **Cancel** drops it.
- **Its ghost**: while you record, a ghost of it stays where it began. Bring it back there (within 5 cm and 10 degrees,
  once it has been away) and the ghost lights up with a soft tick and, in a headset, a short buzz in your hand: let go (or
  Stop) there and the end goes exactly onto the start.
- **Smooth loops**: a recording that plays in a loop (a new one does) is tidied as it is kept: the still moments at its
  start and end are cut, and when its end is within 15 cm and 20 degrees of its start, its last half second is bent so it
  arrives exactly at its start, at the speed it sets off with, so the loop has no jump and no pause. Its card says what
  was done (*Loop closed: its end met its start (6 cm, 4° apart; 0.4 s of stillness cut)*), or how far apart they were
  when it could not close it; **Keep it as recorded** undoes the tidying (one Undo step). Once and Back and forth are kept
  as recorded.
- Up to 10 minutes with a relay that takes uploads, 120 s without (it stops there by itself and keeps what it has). The
  recording is thinned out to the keys that matter (a key wherever leaving it out would move it more than 5 mm or turn it
  more than 1 degree) and kept in its record as one change: Undo takes it back. One longer than 2 minutes, or with more
  than 600 keys, is kept as a file of the scene, `recordings/<its name>-<n>.json` (its card says *kept as a file*), which
  every device fetches; it needs a relay that takes uploads (without one such a recording is refused in words). Files are
  never written over, so Undo can bring an older recording back with its file. A long one is worked out a little at a
  time (*Simplifying the recording* on its card for a moment), so a headset does not freeze. It then plays at once, also while selected; carried, it rests where it is placed (its
  ghost shows where that is). Switching a model whose recording is such a file to its GLB writes the recording turned into
  a new file; when that cannot be done (no relay that takes uploads) the model is not switched and its card says why.
- It plays from where the thing stands: move it or turn it (arrows, grips, Turn 90°, its group) and its whole path moves
  with it. **Plays**: **Loop**, **Once** (then it stays at the end) or **Back and forth**; **Starts**: **Always** (on the
  room's clock, so everyone at a circle sees the same moment) or **When shown** (from when a trigger cube shows it to
  you; *Once* goes with *When shown*: with *Always* it has long played at a circle); **Slower** and **Faster** (a quarter
  to four times); **Delete recording**. A motion (Spin, Bob...) is added on top, and a sound or a cut-out on it comes
  along. **Record again** keeps how it plays.
- Limits, said on its card when a recording is refused: 600 keys a path in the layout (more is kept as a file, up to
  40,000), 6,000 in a scene (a file's keys not counted), and a scene small enough to share in a room. A locked item cannot
  be recorded, nor can a sound that follows something (stop following first). Shared in a room and saved in
  `layout.json`.
- **With my voice** (an object's, a shape's or an empty's card, needs a relay that takes uploads): turned on, it asks for
  the microphone (allow it; in a headset the browser may not show that question, so turn it on on the 2D page first,
  before entering VR). While you record, your voice is recorded too (a small level meter on the card). Kept with the
  recording, it becomes a mono sound of the scene, `sounds/<its name>-voice-<n>.wav` (longer than 20 s: an MP3 made by the
  relay's ffmpeg), placed as *<its name> voice* following it (on its head bone when it has one, else at its top), and it
  plays with its recorded path: from each start of it (each loop; once; on the way there with back and forth), on the
  room's clock, so everyone at a circle hears it at the same moment; the still start the loop's tidying cuts is cut from
  the voice too; if the microphone started late, the voice starts that much after the path and still plays to its end.
  A long voice (more than 20 s) is streamed and kept on the path's clock as it plays. At another speed than ×1 it plays at
  its own pace from each start. Record again with it on makes a new voice file and points the sound at it (the old file
  stays, so Undo brings it back). Deleting the recording leaves the sound, no longer synced (its card says so). The path
  and its voice are one Undo step.
- **Stays on the floor** (on the recorder's rows of every card that records; this device's own, off until you turn it on):
  with it on, a recording first sets the thing down with its lowest point on the floor, as **On the floor** does, and
  that is where its path begins. While it records it then only slides along the floor and turns about the vertical: lift
  it, tilt it or push it up (the hand, the sticks, the arrows) and it stays down, the side that was lowest kept on the
  floor. On a page its arrows lose their up arrow and tilting rings meanwhile, and Stand up waits. An empty and a sound
  keep the height they start at. Cancelled or refused, it goes back where it was; kept, it is one Undo step as ever.

## Trackers: props that follow one, and a character a performer wears

With the PC's Vive trackers in the room (the relay on the PC started with `--trackers`, the bridge running beside SteamVR,
and *Use the PC's trackers in this room* in the Shared dialog, lined up with the room's two spots: `tools/trackers/`), a
studio circle sees them where they are in the room. Editing on:

- **Follows a tracker** on an object's, a shape's or an empty's card: **None**, the tracker it follows (a press lists the
  trackers here by the name the room gave them, else their serial), **Snap onto it**. Choosing one keeps the thing where
  it stands: it then moves with that tracker for everyone at the circle (a cup on a tracker in your hand). A tracker not
  seen holds where it was last seen; carried here or with Pause on, the thing rests where it is placed.
- **Worn with trackers** on a character rigged by Mixamo (others are told why not): **Wear it: whole body** (trackers on
  the hips, head, both wrists and both feet; the chest, elbows and knees too if worn, up to 11) or **Wear it: feet and
  headset** (a tracker on each foot, the head and hands from the PC's Index and its controllers, or from the performer's
  own headset). Then **Line up with the performer**: in 5 s the performer stands in a T-pose in front of it, facing its
  way, arms out to the sides; the trackers find their parts, the character goes to where the performer stands and takes
  their size. **On** moves it with the performer for everyone at the circle (its own animation off meanwhile); **Off**
  gives its animation back. **Its parts** lists which tracker drives what (another one for a part: then **Line up again,
  these parts**). Sounds can follow its head as any bone.
- **Record a take**: after a 3 s countdown the character's moves are recorded until **Stop** (a take stops by itself at
  120 s; the ten-minute limit is for recorded paths only) and made into a clip, *Take 1*, *Take 2*..., in its GLB (with
  a relay that takes uploads it goes into `models/` and every copy
  of the model switches to it; else it is downloaded). It plays as any animation once wearing is off.

Shared in a room and saved in `layout.json` (`engine/e6k_trk.js`, `engine/e6l_puppet.js` and the solver `engine/ik.js`;
"Props that follow a tracker" and "Worn with trackers" in `SPEC.md`). Not yet tried with real trackers. A first real test:
the relay on the PC with `--trackers` and the bridge beside SteamVR (`tools/trackers/README.md`), *Use the PC's trackers in
this room* in the Shared dialog and spots A and B taken there, then a studio circle and a shape's **Follows a tracker**
and **Snap onto it**. Since v125 the scene's frame at a circle is the room's, so the shape should sit on its tracker in
the real room and move with it.

## In a headset: from the inside, Hold it, the sticks

- **Inside a model.** Standing inside a room scan you cannot point at its box (its faces point away from you). With
  **Edit** on, pointing at nothing while your controller is inside a model's box points at that model (the smallest box if
  you are inside several): the trigger selects it and the grip carries it. Anything the ray does hit wins. On a page the
  same holds in **Walk** view for the camera, except that a click on the floor still walks you there.
- **Hold it.** A selected item's card in the headset has **Hold it** (under *Carry it*): the next grip of either hand,
  wherever you point, carries that item from where it stands (as a grip on it would; a group as a whole). Once, then it
  is off again; pressed again, or another selection, turns it off. For something too big or too far to point at.
- **Scrolling a card.** A card taller than the panel scrolls with **Up** and **More**, and now with a stick: point at the
  panel and push either stick up or down (further: faster; held: faster still). While you point at the panel the left
  stick does not walk and the right stick does not turn; point away and they do again.
- **The sticks while you carry something** (with one hand, whichever hand): the **left stick** up makes it larger and down
  smaller (twice the size in about 1.5 s held fully; a group about its middle, a sound's full-volume distance instead of
  a size), left and right turn it; the **right stick** up pushes it away and down pulls it in, left and right turn it too.
  It is all one change: one **Undo** takes the whole carry back. A locked item cannot be carried, so the sticks do nothing
  to it.

## Example scenes

Scenes that come with the app are listed under **Examples** on the Scene tab (the folder `examples/` next to the app, as
`scan.mjs` writes a folder of scenes). **Open** shows one as it is, read only (what you change stays on this device;
**Back to your scenes** goes back). With a relay that takes uploads (on a page or in a headset), **Copy to the relay** makes
it one of your scenes: every file and its layout copied (a second copy is numbered), then opened with **Edit** on. At a
circle in a shared room the scene is for everyone there: the example's button opens it from the relay for everyone at the
circle (the first press copies it there under its name, later presses open that copy, but only once all of it is there:
a copy still on its way says *Being copied...*, and one that broke off is finished by the next press, only the files
missing), and Copy opens its copy there too; greyed only while the circle's story is locked, while it is being copied, or
while the relay takes no uploads, a line saying why
(`engine/e7g_examples.js`; "Example scenes" in `SPEC.md`).

## A new scene, and a model from another scene

- **New scene** (the Scene pane, with a relay that takes uploads): on a page type its name and press **Make it** (or
  Enter); in a headset **New scene...** opens the menu's keypad for the name. The scene is made on the relay and opened
  (at a circle, for everyone there), with Edit on. A name has up to 64 letters, digits, spaces, `_ . -`.
- **From another scene...** (the Add pane, page and headset): pick one of the relay's other scenes, then one of its
  models or sounds. It is **copied** into this scene at the same path (a new name such as *statue 2.fbx* when that path
  is taken here) and placed in front of you, so each scene keeps its own files and a layout never points into another
  scene. A model that is not a GLB brings the files it names that its scene has (an OBJ's MTL and pictures, a glTF's
  `.bin`, an FBX's pictures); one this scene already has by that path is not copied (this scene's own stays). An OBJ and
  its MTL go under `originals/` (the only place the relay keeps those kinds), the paths between them kept. With R2 the
  bucket copies the files itself. Not offered for a folder of scenes without a relay, a read-only relay, a visitor
  (`&visit`) or a locked scene.

## Fewer triangles, and Change texture

- **Fewer triangles** (a placed model's card, with **Edit** on, on a page and in a headset): a share of its triangles kept,
  **20 %** to start. On a page a slider (2 to 100 %); in a headset **− 5 %**, **+ 5 %** and **10 %**, **20 %**, **50 %**.
  It shows at once, in place, **on this device only**, so you can walk round it life size in the headset before keeping
  it; **Cancel** puts it back. **Save** makes `models/<name>.glb` with that share, as Convert to GLB does, and every
  object of that file switches to it where it stands (for everyone at a circle). The share is of the original when the
  scene has it, so a model made too light can come back up (*Save makes it again from statue.fbx*); a headset saves too,
  with a relay that takes uploads. meshoptimizer's simplifier does the work: textures stay where they were, parts that
  touch do not crack apart, crumbs of a scan go; a mesh with shape keys is left as it is. Look closely at the preview:
  at 20 % a dense scan usually holds up well, a low-poly model does not need it.
- **No black seams** (v120): a scan's texture is many small pieces with black between them, and a lighter model's seams
  cut across that black (black wedges along them). So every GLB the studio makes has the gaps between its pictures'
  pieces filled with the colours round them (worked out from all its triangles, before it is made lighter); the preview
  shows it so too. A picture drawn down on the way (a big scan's 8,192 px texture made 4,096) has the dark rims that
  drawing down gives its pieces filled as well. A picture that repeats across the model (a tiled floor), that the model
  uses nearly whole, or that is see-through with clear gaps (nothing can be kept there) is left as it is. The GLB's card
  says *Textures: the gaps between the pieces of its picture are filled*.
- **The Upload pane** gives each model the same: *Triangles kept* (20 % to start), about how many that is, and
  **Preview**, the viewer over the whole window. On a placed model's card, **Look closer** opens it too, at the card's
  share (see "Looking closely: the viewer").
- **Change texture** (a placed model's card): pick one of its materials, a slot (Colour, Normal, Roughness, Metalness,
  Occlusion, Glow, Opacity) and one of the scene's pictures (on a page also one from this computer). It shows at once on
  this device; **Save** puts it into the model's GLB (recorded there, never in the layout); **Cancel** puts its own back.

## The room scan, and scanning rooms and objects

**The headset's own room scan, as a model** (v141). In a headset, in AR, with Edit on, the Add pane has *The room
scan*:

- *Scan the room* opens Quest's own room setup (Space Setup), once a session.
- *Save the room as a model* takes the scan as it is now (the room mesh, or *Walls and floor only*: the flat planes),
  optionally lighter (*Triangles kept: All, 50 %, 20 %*).
- The scan becomes `models/room-scan-<date>.glb`: one mesh per label (walls, floor, tables...), each a plain colour.
- It is placed where the real room is (0, 0, 0, no turn), shown only in VR by default: in AR the real room is there.
  Change that with its card's *Shows in*.
- At a shared room's circle it stands on the room's spots, so every headset there sees it in the right place, also later.
  Outside a room it lines up only for that session.
- Without a relay that takes uploads it is downloaded instead.

What a web page on a Quest can get is shape only: coarse, with no colour. The browser offers no camera image with a known
position, so a photo-textured scan cannot be made in the headset from the web. Use it as a stand-in for the room in VR,
as walls and floor to place things against, or as a base to model on.

**Better scans for models** (checked November 2026):

- **Scaniverse** (iPad, free, on the device): a good default; exports GLB.
- **KIRI Engine**: the best control over weight at export (a triangle count and texture size).
- **Polycam**: good for rooms (Space mode, Remesh to set the texture size); the free tier exports glTF only.
- **Apple Object Capture** (Reality Composer on the iPad, on the device): fine single objects, as USDZ. The studio does not
  read USDZ: convert it to GLB first (Reality Converter or Blender).
- **Apple RoomPlan apps**: a light, untextured room layout (walls, doors, furniture as boxes).
- **On the Quest itself**, only native apps record camera images with their positions. One is OpenQuestCapture
  (sideloaded, open source), whose recordings become a mesh or a Gaussian splat on a PC. Meta's Hyperscape has no export.
  Splats are not shown in the studio (its three.js r128 has no maintained splat viewer).
- **Budgets for a Quest:** about 300,000 triangles a model and 500,000 a scene, textures up to 4,096 px (2,048 safer).
  *Fewer triangles* on a model's card gets there.

## Formats guide

- **Models: GLB.** One file, its textures and animations inside. FBX works, but converted it loads faster and sits right
  without guessing (an FBX often says the wrong units). The studio also reads glTF, OBJ (with its MTL), PLY and STL.
- **Textures:** JPEG for photos and scans, PNG only where something is see-through. At most 4,096 px on a side; 2,048 is
  safer on a Quest (the atelier's 8,192 px JPEG alone would take about 340 MB of its memory).
- **Pictures the studio reads**, and what they become in a GLB (always JPEG when opaque, PNG when see-through):

  | Picture | Read by | Notes |
  | --- | --- | --- |
  | PNG, JPEG, WebP, GIF, BMP, AVIF | the browser | as they are |
  | TGA | three.js's TGALoader | also when a model names a `.tga` and the scene has another kind |
  | TIFF (`.tif`, `.tiff`) | the studio | none, LZW, PackBits or Deflate; 1 to 16 bits; grey, RGB, palette, CMYK; alpha |
  | PSD, PSB | the studio | the merged picture Photoshop keeps (save with *Maximise compatibility* on); 8 or 16 bits; a saved selection or mask channel is not taken for transparency |
  | DDS | the studio | uncompressed, DXT1, DXT3, DXT5, BC4, BC5 (a normal map: its z rebuilt); the largest picture only |
  | EXR, HDR, HEIC, KTX, KTX2, BC6H, BC7, a TIFF compressed with JPEG, a 32-bit PSD | refused | the card says so: save it as PNG or JPEG |
  | anything over 64 million pixels (8,192 x 8,192), or cut short | refused | the card says so: save it smaller, or again |

- **A texture a model names but the scene lacks** is looked for by itself: the path it gives, its name in any case, the
  same name as another kind of picture (`brick.tga` finds `brick.png`), then a name of the same words but colour words
  (`stone_diffuse.jpg` finds `Stone-BaseColor.dds`; never a normal map for a colour one). Still missing, the object's
  card offers the scene's likeliest pictures (*Use <file>*) or one from this computer (*Choose a picture...*), and *Add
  a texture...* lays a picture on a material that has none (choose its slot: Colour, Normal, Roughness, Metalness,
  Occlusion, Glow, Opacity). Either converts the model to a GLB with the picture in it at once (on a page; a headset
  says to do it on a laptop); the choice is kept in the GLB, never in the layout. The upload page does the same for
  what is dropped, and pairs the only picture left over with the only model lacking one.
- **In the GLB:** separate roughness and metalness pictures become one (roughness in green, metalness in blue), a
  bump map becomes a normal map, and the gaps between a picture's pieces (a scan's texture atlas, black between its
  pieces) are filled with the colours round them, so a lighter model shows no black seams (`--no-fill` in
  `convert.mjs` leaves them).
- **Budgets on a Quest:** about 300,000 triangles a model, 500,000 a scene (said on the cards, never refused; *Fewer
  triangles* brings a model down).
- **Sounds: mono**, so they place well (a stereo file is played from its point, mixed). Short loops as WAV (MP3 adds
  silence at its ends, so a loop clicks; OGG does not play on iPhones). Long ones (more than 20 s: streamed, not held in
  memory) as MP3 at 96 to 128 kbit/s.

The upload page does all of this by itself. By hand:

```sh
ffmpeg -i in.wav -ac 1 -c:a pcm_s16le loop.wav    # a loop
ffmpeg -i in.mp3 -ac 1 -b:a 96k out.mp3           # a long one
node tools/studio/convert.mjs model.fbx           # a model, on a computer with Playwright (as tools/smoke.mjs)
node tools/studio/convert.mjs scan.fbx --keep 0.2 # the same with a fifth of its triangles (its texture's gaps filled)
node tools/studio/convert.mjs model.obj --textures ~/pictures --texture rust_old.png=paint.png --texture 0:roughnessMap=rough.tif
```

`convert.mjs` uses the same converter as the page (`engine/convert.js`) and also draws the original and the GLB from
three sides and compares them; `--max-texture 2048`, `--keep 0.2` (the share of its triangles kept, as *Fewer triangles*),
`--no-fill` (the gaps between its pictures' pieces left black), `--shots <dir>` keeps the pictures. `--textures <dir>` adds pictures to
look in (any depth), `--texture <name>=<picture>` gives a texture the model names, and `--texture
<material>:<slot>=<picture>` lays one on (the material's name, its number from 0, or `*`); it prints what each texture
was found as and keeps it in the GLB's record.

## Files

- `engine/` the studio's engine (`e*.js`; `e6b_cuts.js` the cut-outs and their shader, `e6c_groups.js` the groups, `e6d_shapes.js` the shapes, empties, locks, the scene's settings and the lobby, `e6e_motion.js` the motions and how an item's pose is drawn, `e6f_path.js` the recorded paths and the recorder), `engine/convert.js` the converter and `engine/images.js` the picture reader
  and texture names (both shared with `convert.mjs`), `engine/e7b_upload.js` GLB records, Convert to GLB, textures baked
  in and the Upload pane, `engine/e7c_direct.js` a relay's scenes in R2 (signed links read again before they lapse,
  uploads straight into the bucket), `engine/e7d_lite.js` Fewer triangles and Change texture on a card and the Upload
  pane's share, `engine/e7e_pics.js` the Add pane's pictures of the models (made with every GLB and by Make
  pictures, kept in `previews/`), `engine/e7f_viewer.js` the viewer (a model over the whole window: Preview, Look closer,
  Look).
- `r2sync.mjs` scenes between an R2 bucket and a folder (`list`, `pull`, `push`; the relay's `R2_*` variables).
- `sets/` the stage and the items' looks; `vendor/` three.js r128's own add-ons and meshoptimizer's simplifier (see its
  README).
- `test/make.mjs` makes the test scene `test/scenes/test/` (models, a texture, a short and a 25 s sound, and an OBJ with
  its MTL under `originals/`, under 250 KB), the textures scene `test/scenes/textures/` (about 20 KB: pictures from
  `test/pictures.mjs` in every kind the studio reads, and models that name them by each rung), the rig scene
  `test/scenes/rig/` (about 35 KB: a small skinned dancer whose bones are named in mixed conventions, with a voice that
  follows her head), the cuts scene `test/scenes/cuts/` (about 30 KB: a wall with a door a cube opens, two boxes of one
  file with a hole in one, the dancer and the figure), the puppet scene `test/scenes/puppet/` (about 60 KB: `rig.glb`, our
  own humanoid with Mixamo's bone names in a T-pose and a walk, for the trackers' solver) and their listings;
  `node tools/studio/test-images.mjs` checks the picture reader in Node; `test/local/` is ignored by git (your own scenes for
  trying things).
- `engine/ik.js` the trackers' solver (written in v125, in the build since v126, used by `engine/e6l_puppet.js`): a
  Mixamo character worn with trackers, a headset and controllers (`tools/trackers/SPEC.md`, "The solver (ik.js)");
  `node tools/studio/test-ik.mjs` checks it in Node.

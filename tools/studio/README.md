# The studio: your own scenes

`stories/studio.js` (built from this folder: `node tools/studio/build.mjs`, `--check`) is a page of the app that is not a
story, like the design room: `#studio`. A **scene** is a folder of files (models, their textures, sounds) and its
`layout.json`, where everything placed stands: objects, see-through trigger cubes that show and hide them as you walk
in and out, and sounds placed in the room. The contract is `SPEC.md`.

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
   name already taken gets a number, `eva_001 2.glb`).
5. **Convert and upload**: each row converts in the browser and uploads, with its progress. Then **Open the scene**:
   the studio on that scene, editing on, the Add list showing what was made.

What it makes:

| You drop | It makes |
| --- | --- |
| A model: FBX, OBJ with its MTL, glTF with its `.bin`, GLB, PLY, STL | `models/<name>.glb`: metres and Y up (the studio's guess of its units and up axis baked in), textures drawn down and stored as JPEG (PNG where see-through), animations and skins kept, an FBX material of opacity 0 (3ds Max's habit) drawn solid, a mesh without normals marked to be shown as scanned. It is loaded back and checked; if something did not come through, the row says why and nothing is made. |
| A sound up to 20 s | `sounds/<name>.wav`: mono, 16-bit, at its own rate (at most 48 kHz): loops without a gap |
| A sound longer than 20 s | with ffmpeg on the relay: `sounds/<name>.mp3`, mono, 96 kbit/s (streamed when it plays); without: an MP3, M4A/AAC or OGG kept as it is (a stereo file plays from one point), anything else a mono WAV at 22.05 kHz |
| Every file you gave | the same file in `originals/`, in its folders (so a model can be converted again) |

Without a relay that takes uploads the plan still shows, and **Convert** offers each GLB and WAV as a download.

In a scene, the Add list shows `models/`, `sounds/` and anything outside `originals/`; `originals/` is folded under
**Originals**. A GLB made from another file of the scene (its `asset.extras.studio.from`, or the same base name) stands
for it: placing the original places the GLB. An FBX (or OBJ, PLY, STL, glTF) object's card has **Convert to GLB**, and
Add has **Convert every model**: with a relay the GLB goes into `models/` and every object placed from the original
switches to it where it stands; without one it is downloaded.

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
box (or its model) puts the copy in the same cubes' lists. Not editing, nothing of the box is drawn:
only the hole. The edges of a hole are open (you look into the thin surface): that is how it is meant to be. A model takes
at most 16 cut-outs, a scene 100. **Move onto another object...** gives a box to another model, where it stands.

## Groups: things that move together

A group is a named set of objects, sounds and trigger cubes that move, turn and size as one (a model's cut-outs, and
the sounds that follow it, come with it anyway). With **Edit** on:

1. Select one of them and press **Make a group...** on its card. Then point at the others and pull the trigger (or click
   them on a page; Ctrl- or Shift-click work too, as do their names under Items) to put them in; again to take one out.
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
- **The lobby**: when a headset walks into the room's *Back to the lobby* circle, it forgets what it has seen in the
  studio, so the scene starts afresh for the next person who puts it on.

## In a headset: from the inside, Hold it, the sticks on a card

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
  **Preview**, a picture of it with all its triangles and with the share kept.
- **Change texture** (a placed model's card): pick one of its materials, a slot (Colour, Normal, Roughness, Metalness,
  Occlusion, Glow, Opacity) and one of the scene's pictures (on a page also one from this computer). It shows at once on
  this device; **Save** puts it into the model's GLB (recorded there, never in the layout); **Cancel** puts its own back.

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

- `engine/` the studio's engine (`e*.js`; `e6b_cuts.js` the cut-outs and their shader, `e6c_groups.js` the groups, `e6d_shapes.js` the shapes, empties, locks, the scene's settings and the lobby), `engine/convert.js` the converter and `engine/images.js` the picture reader
  and texture names (both shared with `convert.mjs`), `engine/e7b_upload.js` GLB records, Convert to GLB, textures baked
  in and the Upload pane, `engine/e7c_direct.js` a relay's scenes in R2 (signed links read again before they lapse,
  uploads straight into the bucket), `engine/e7d_lite.js` Fewer triangles and Change texture on a card and the Upload
  pane's share and preview, `engine/e7e_pics.js` the Add pane's pictures of the models (made with every GLB and by Make
  pictures, kept in `previews/`).
- `r2sync.mjs` scenes between an R2 bucket and a folder (`list`, `pull`, `push`; the relay's `R2_*` variables).
- `sets/` the stage and the items' looks; `vendor/` three.js r128's own add-ons and meshoptimizer's simplifier (see its
  README).
- `test/make.mjs` makes the test scene `test/scenes/test/` (models, a texture, a short and a 25 s sound, and an OBJ with
  its MTL under `originals/`, under 250 KB), the textures scene `test/scenes/textures/` (about 20 KB: pictures from
  `test/pictures.mjs` in every kind the studio reads, and models that name them by each rung), the rig scene
  `test/scenes/rig/` (about 35 KB: a small skinned dancer whose bones are named in mixed conventions, with a voice that
  follows her head), the cuts scene `test/scenes/cuts/` (about 30 KB: a wall with a door a cube opens, two boxes of one
  file with a hole in one, the dancer and the figure) and their listings;
  `node tools/studio/test-images.mjs` checks the picture reader in Node; `test/local/` is ignored by git (your own scenes for
  trying things).

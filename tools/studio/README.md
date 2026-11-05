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
- **In the GLB:** separate roughness and metalness pictures become one (roughness in green, metalness in blue), and a
  bump map becomes a normal map.
- **Budgets on a Quest:** about 300,000 triangles a model, 500,000 a scene (said on the cards, never refused).
- **Sounds: mono**, so they place well (a stereo file is played from its point, mixed). Short loops as WAV (MP3 adds
  silence at its ends, so a loop clicks; OGG does not play on iPhones). Long ones (more than 20 s: streamed, not held in
  memory) as MP3 at 96 to 128 kbit/s.

The upload page does all of this by itself. By hand:

```sh
ffmpeg -i in.wav -ac 1 -c:a pcm_s16le loop.wav    # a loop
ffmpeg -i in.mp3 -ac 1 -b:a 96k out.mp3           # a long one
node tools/studio/convert.mjs model.fbx           # a model, on a computer with Playwright (as tools/smoke.mjs)
node tools/studio/convert.mjs model.obj --textures ~/pictures --texture rust_old.png=paint.png --texture 0:roughnessMap=rough.tif
```

`convert.mjs` uses the same converter as the page (`engine/convert.js`) and also draws the original and the GLB from
three sides and compares them; `--max-texture 2048`, `--shots <dir>` keeps the pictures. `--textures <dir>` adds pictures to
look in (any depth), `--texture <name>=<picture>` gives a texture the model names, and `--texture
<material>:<slot>=<picture>` lays one on (the material's name, its number from 0, or `*`); it prints what each texture
was found as and keeps it in the GLB's record.

## Files

- `engine/` the studio's engine (`e*.js`; `e6b_cuts.js` the cut-outs and their shader), `engine/convert.js` the converter and `engine/images.js` the picture reader
  and texture names (both shared with `convert.mjs`), `engine/e7b_upload.js` GLB records, Convert to GLB, textures baked
  in and the Upload pane, `engine/e7c_direct.js` a relay's scenes in R2 (signed links read again before they lapse,
  uploads straight into the bucket).
- `r2sync.mjs` scenes between an R2 bucket and a folder (`list`, `pull`, `push`; the relay's `R2_*` variables).
- `sets/` the stage and the items' looks; `vendor/` three.js r128's own add-ons (see its README).
- `test/make.mjs` makes the test scene `test/scenes/test/` (models, a texture, a short and a 25 s sound, and an OBJ with
  its MTL under `originals/`, under 250 KB), the textures scene `test/scenes/textures/` (about 20 KB: pictures from
  `test/pictures.mjs` in every kind the studio reads, and models that name them by each rung), the rig scene
  `test/scenes/rig/` (about 35 KB: a small skinned dancer whose bones are named in mixed conventions, with a voice that
  follows her head), the cuts scene `test/scenes/cuts/` (about 30 KB: a wall with a door a cube opens, two boxes of one
  file with a hole in one, the dancer and the figure) and their listings;
  `node tools/studio/test-images.mjs` checks the picture reader in Node; `test/local/` is ignored by git (your own scenes for
  trying things).

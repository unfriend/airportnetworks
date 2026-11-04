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

## Formats guide

- **Models: GLB.** One file, its textures and animations inside. FBX works, but converted it loads faster and sits right
  without guessing (an FBX often says the wrong units). The studio also reads glTF, OBJ (with its MTL), PLY and STL.
- **Textures:** JPEG for photos and scans, PNG only where something is see-through. At most 4,096 px on a side; 2,048 is
  safer on a Quest (the atelier's 8,192 px JPEG alone would take about 340 MB of its memory).
- **Budgets on a Quest:** about 300,000 triangles a model, 500,000 a scene (said on the cards, never refused).
- **Sounds: mono**, so they place well (a stereo file is played from its point, mixed). Short loops as WAV (MP3 adds
  silence at its ends, so a loop clicks; OGG does not play on iPhones). Long ones (more than 20 s: streamed, not held in
  memory) as MP3 at 96 to 128 kbit/s.

The upload page does all of this by itself. By hand:

```sh
ffmpeg -i in.wav -ac 1 -c:a pcm_s16le loop.wav    # a loop
ffmpeg -i in.mp3 -ac 1 -b:a 96k out.mp3           # a long one
node tools/studio/convert.mjs model.fbx           # a model, on a computer with Playwright (as tools/smoke.mjs)
```

`convert.mjs` uses the same converter as the page (`engine/convert.js`) and also draws the original and the GLB from
three sides and compares them; `--max-texture 2048`, `--shots <dir>` keeps the pictures.

## Files

- `engine/` the studio's engine (`e*.js`), `engine/convert.js` the converter (shared with `convert.mjs`),
  `engine/e7b_upload.js` GLB records, Convert to GLB and the Upload pane.
- `sets/` the stage and the items' looks; `vendor/` three.js r128's own add-ons (see its README).
- `test/make.mjs` makes the test scene `test/scenes/test/` (models, a texture, a short and a 25 s sound, and an OBJ with
  its MTL under `originals/`, under 250 KB) and its listings; `test/local/` is ignored by git (your own scenes for
  trying things).

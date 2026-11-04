# The studio: contract

The owner, 3 November 2026: "i actually need a room where i can place some fbx or other format files in a folder and
then i have textured objects, in some case with animations and then i can place them and somehow save where they are
placed ... and i also need semi-transparent trigger cubes that i can use to let the 3d objects appear and disapear
depending on where the user goes"; then "the relay idea sounds good, then i can run a relay and serve the fbx and glb
files from that and also save the json files directly. also add some spatial audio emitters and let me hide and show
multiple objects with each trigger cube". The two files sent as examples (kept outside the repository, never copied
into it) are a photogrammetry scan of an atelier (binary FBX 7400, one mesh of 397,066 triangles, an 8192 x 8192 JPEG
packed inside, centimetres, 7.4 m x 3.1 m x 7.3 m, Y up) and a rigged figure (binary FBX 7200, skinned, 4,488
triangles, one 51 s take "Take 001", metres despite its UnitScaleFactor of 1, Z up, its PNG texture not in the file but
named beside it). Both load with three.js r128's FBXLoader.

`stories/studio.js` is a page that is not a story, like the design room (`STORY_EXTRA`), built from `tools/studio/`
(`node tools/studio/build.mjs`, `--check`), its engine adapted from the design room's (`tools/design/engine/`), with the
same shared-room, headset-setting, subtitle, panels, recenter, framing and sound-effect lines as every story (the smoke
test checks them in every story and every `STORY_EXTRA` page). Words in the UI: plain British English, short.

## Names

- Key `studio`, `STORY_EXTRA` entry after the design room: kick *Studio*, title *Your own scenes*, its own colour (not
  one a story has), `icon: 'studio.stage'` (a new miniature in `tools/lowpoly/`: a low plinth with a small figure, a
  see-through cube's edges and a little speaker; under 1,200 triangles, `tris` exact; skipped by
  `tools/design/build.mjs`, as `design.table` is: not a prop), `life: true`, `thing: 'scene'`, `loading: 'Opening the
  studio'`, `len: 'No story · your own scenes'`.
- A **scene** is one folder of files: models, their textures, sounds, and `layout.json`, where everything placed stands.
  An **item** is one thing placed in a scene: an *object* (a model file placed once; one file may be placed many times),
  a *trigger cube* or a *sound* (an emitter).
- Links: `#studio` (the last scene used on this device, else the only one, else the list), `#studio&scene=<name>`,
  `&visit` (no editing offered at all: a visitor's kiosk), `&edit` (start editing), `&scenes=<relative folder>` (a static
  folder of scenes instead of the relay's; only a relative path, no `//` or `..`: for tests and plain web hosting).

## Where scenes come from

### From the relay (the owner's way)

`node relay/server.mjs --lan --scenes <folder>` (also `COLLAB_SCENES` in the environment, and inside `RELAY_ARGS`).
Each subfolder of `<folder>` is a scene; its name must match `^[A-Za-z0-9_][A-Za-z0-9 _.-]{0,63}$` (others are skipped
and said once in the log). Files inside may sit in subfolders up to 4 levels deep; dot files and `.history/` are left
out. With a password (`COLLAB_TOKEN`) every scene endpoint and file needs it, exactly as the API does (`Authorization:
Bearer` or `?token=`; wrong ones counted as for the API): the files are the owner's own work, not the app's. `--public`
with `--scenes` refuses to start without a password.

- `GET /api/scenes` -> `{ scenes: [{ name, files, bytes, at, layout }], save }`: `files` how many, `bytes` their size,
  `at` the newest file's time (ms), `layout` whether it has a `layout.json`; `save` whether this relay saves layouts.
- `GET /api/scenes/<name>` -> `{ name, files: [{ path, bytes, at, kind }], layout, layoutAt, save }`: `path` relative,
  with `/`; `kind` `'model'` (`.glb .gltf .fbx`), `'audio'` (`.mp3 .ogg .oga .wav .m4a .aac .flac .opus .webm`),
  `'image'` (`.png .jpg .jpeg .webp .gif .tga .bmp`), `'data'` (`.bin`), else `'other'`; sorted by path; at most 2,000.
  `layout` is the parsed `layout.json` (or `null`), `layoutAt` its time.
- `GET /scenes/<name>/<path>` -> the file, its type by extension (`.glb` `model/gltf-binary`, `.gltf`
  `model/gltf+json`, `.fbx` `application/octet-stream`, the usual for images and sounds), `ETag` from size and time,
  `Cache-Control: no-cache`, `304` when it matches, byte ranges for sounds. Paths decoded once; `..`, backslashes, NUL
  and anything resolving (symlinks too) outside the scene's folder refused (404, logged without the path's query).
- `POST /api/scenes/<name>/layout` with the layout as JSON (at most 2 MB; it must be an object with `studio: 1`) ->
  writes `layout.json` (to a temporary file, then renamed) after moving the old one to
  `.history/layout-<ISO time>.json` (the newest 20 kept) -> `{ ok: true, at, bytes }`. Refused with 403 `{ error }`
  when saving is off (`--scenes-readonly`), 404 for no such scene, 413 too big, 400 not a layout.
- `GET /api/scenes/watch` (`?token=`) -> Server-Sent Events: `hello` `{ scenes }`, then `scene` `{ name, path, kind,
  gone }` when a file is added, changed or removed (a moment after it settles: about 0.5 s with no further change;
  never for `.history/` or temporary files), `layout` `{ name, at }` when `layout.json` changes, a comment every 20 s.
  Found by looking at the folder every 2 s while anyone listens (no `fs.watch`: it differs by system).
- CORS as the API's (a page on another origin, as GitHub Pages with `&relay=`): the preflight allows `Authorization`,
  `Content-Type` and `POST`.
- `/api/ping` says `scenes: true` when it serves scenes.
- The service worker never caches `/scenes/` (it passes it through, as it does `/api/`).

### From a plain folder (tests, other web hosts; read only)

`node tools/studio/scan.mjs <folder>` writes `<folder>/index.json` (what `GET /api/scenes` answers, `save: false`) and
`<folder>/<name>/files.json` (what `GET /api/scenes/<name>` answers, without `layout`: the page fetches
`<folder>/<name>/layout.json` itself). The page uses it when no relay is known (or `&scenes=` says so). No saving there:
*Download layout.json* instead (page only).

### The page's side

`HOST.collab.relayFind()` (new, in `shared.js`) -> a promise of `{ base, token }` (`base` the relay's address without a
trailing slash: the relay the page knows, else the page's own server when `detect()` finds it is a relay) or `null`.
`HOST.collab.relaySaw(base, status, sent)` tells the shell what a call answered (`authSaw`), so a 401 brings up the
shell's own password prompts (the page's Shared dialog field, the headset menu's *Relay password* row) and the studio
says *This relay needs its password: enter it under Shared (or in the menu's Circles tab)*. Files are fetched with the
password: loaders through their `LoadingManager`'s `setURLModifier` (adding `?token=`), sounds and JSON with
`Authorization: Bearer`. A changed file (the watch's `scene` event) is fetched again and its items rebuilt in place;
a new file appears in the Add lists; `layout` from another device's save updates *Saved* (it never replaces what is
placed by itself).

## Models

- `.glb`/`.gltf` (GLTFLoader: PBR materials, every animation clip; no Draco, Meshopt or KTX2: such a file says so on
  its card), `.fbx` (FBXLoader, binary or ASCII, version 7 and up; `fflate`, `NURBSCurve` and `TGALoader` with it).
  The add-ons are three.js r128's own, vendored in `tools/studio/vendor/` (see its README) and pasted into the built
  file by `build.mjs` with their licence lines (no extra file to load, works offline). Wrap them so their globals do not
  leak beyond `THREE.*` (fflate's UMD must not need `module` or `define`).
- Textures a file names but does not hold are looked for in the scene's pictures by the ladder ("Textures: found, added,
  converted" below: its path, its name in any case, the same name as another kind of picture, a name of the same words;
  the FBX's full path from the author's computer, `C:\Users\...\x.png`, is ignored), through the URL modifier, and TIFF,
  PSD and DDS pictures are read in the page. One not found: the model shows untextured and its card says *Missing texture
  x.png: put it in the scene's folder*, and offers pictures for it.
- Textures larger than 4,096 px on a side are drawn down to 4,096 (`&maxtex=` changes it, 512 to 8,192) before they go
  to the GPU, and the card says so: the atelier's 8,192 px JPEG alone would take about 340 MB of the headset's memory.
- When a file is first placed its item gets the file's units and up axis as its starting scale and turn (stored in the
  item from then on, so a layout never changes when this guess does): FBX `GlobalSettings`' `UnitScaleFactor` (cm per
  unit: the scale `factor / 100`) and `UpAxis`/`UpAxisSign` (Z up: a quarter turn about x), read from the file's bytes
  (binary property records, or the ASCII text), since the loader ignores them. A scale is taken only when it makes the
  model's largest side 5 cm to 60 m; else 1 unit = 1 m if that does; else it is sized to 1 m. glTF is metres, Y up. The
  atelier comes out 7.4 m wide (scale 0.01) and the figure 1.66 m tall (scale 1, stood up).
- One file is loaded once and cloned for each object (`SkeletonUtils.clone` for rigged ones); each object has its own
  `AnimationMixer`. Files no object uses any more are dropped and their GPU memory freed.
- Lighting per object: *lit* (the scene's lights: a sky and ground light, a light over your shoulder; glTF's PBR gets a
  soft room-like environment) or *as scanned* (unlit: its own colours, for photogrammetry, whose light is in the
  texture). A model whose file has only one material with a texture and no normals worth the name may start *as
  scanned*; else *lit*.
- Every model's card: its file, size in metres (as placed), triangles, textures and their sizes, animations, warnings.
  Quest budget warnings (shown, never refused): more than 500,000 triangles in the scene, more than 300,000 in one model,
  more than 6 textures over 2,048 px. Parsing a big FBX stalls the page for a few seconds (more on a headset): a model
  loading shows as a grey box with its progress where it will stand.

## A scene's layout

`layout.json` (also what Download gives and Upload takes):

```json
{
  "studio": 1,
  "scene": "atelier",
  "saved": "2026-11-03T22:40:00.000Z",
  "objects": [
    { "id": "k3f9qa", "name": "Atelier", "file": "annette.fbx", "p": [0, 0, 0], "q": [0, 0, 0, 1], "s": 0.01,
      "light": "scan", "clip": "", "anim": "loop", "start": "always" }
  ],
  "cubes": [
    { "id": "c81mzt", "name": "Doorway", "p": [1.2, 1, -2], "yaw": 0, "size": [1.2, 2, 1.2], "mode": "while",
      "show": ["k3f9qa", "s0ab12"], "hide": [] }
  ],
  "sounds": [
    { "id": "s0ab12", "name": "Birds", "file": "sounds/birds.mp3", "p": [0, 2, -3], "vol": 0.8, "r": 1.5,
      "loop": true, "start": "always" }
  ]
}
```

- Coordinates: metres in the scene's frame: the floor at y = 0, +y up, the scene's origin where its circle's spot is
  (outside a room where you stood when the studio opened, or the anchored place), -z the way it faces. `p` to the mm
  (3 decimals), `q` a quaternion (4 decimals), `s` a factor (4 significant figures), a cube's `size` to the mm and its
  `yaw` (radians, 4 decimals; cubes stay level), `vol` 0 to 2 (2 decimals), `r` the distance within which a sound is at
  full volume (0.1 to 20 m, 2 decimals).
- `light`: `'lit'` or `'scan'`. `clip`: an animation's name (`''` none, or the file's first when it has one: set when
  placed). `anim`: `'loop'`, `'once'` (plays to its end and holds) or `'off'` (its rest pose). `start`: `'always'` (an
  object: its animation runs on the scene's clock; a sound: plays from the start) or `'shown'` (from its beginning each
  time a cube shows it to you).
- `id`: six characters `[a-z0-9]`, made when an item is placed, unique in the scene. `name`: at most 60 characters
  (the file's name without its extension, numbered when placed again: *eva_001 2*).
- Limits: 300 objects, 100 cubes, 60 sounds; a `file` is a path in the scene's listing (at most 200 characters, no
  `..`); a list of ids in a cube only names items of this scene (others dropped when read). Anything else in a read
  layout is ignored; a bad item is dropped and said once (*2 items in layout.json could not be read*).

## Trigger cubes

- Each person's own: a cube is *active for you* while your head is inside it (the headset's head; on a page the
  camera's place in Walk view, else nobody: the orbit camera never triggers). Never shared, never in `state()`: ten
  headsets each see what their own place reveals.
- `mode`: `'while'` (active while you are inside) or `'stay'` (once you have been inside it stays active for you until
  the scene is opened again or *Reset what I have seen* is pressed).
- `show` and `hide`: any number of objects and sounds each. For an item: the cubes now active for you that list it in
  `show` (S) and in `hide` (H). Shown if S has any and H none; hidden if H has any and S none; both: the one that became
  active most recently decides. Neither: hidden if any cube lists it in `show` (it waits for its cube), else shown.
- Shown and hidden fade over 0.4 s (opacity, then `visible` off; a sound's gain). An object shown with `start:
  'shown'` starts its animation from the beginning; a sound with `start: 'shown'` plays from the start each time it is
  shown, and stops (fading) when hidden. Items in no list are unaffected.
- While editing: every cube is drawn see-through (its colour, about 0.18 opacity, brighter edges, its name over it,
  brighter while you are inside it), lines from a selected cube to what it shows (green) and hides (red), and objects a
  cube now hides from you drawn faint (about 0.3) instead of hidden, so they can still be picked; sounds play as a
  visitor would hear them. Not editing: cubes and sound markers are not drawn at all.

## Sounds (emitters)

- A sound file of the scene placed at a point: played through the shell's one context (`HOST.audio.fx()`; never an
  `AudioContext` of its own), each through an HRTF `PannerNode` (inverse distance, full volume within `r`, `rolloff`
  1, `maxDistance` 50 m) and its own gain (`vol`) to the context's destination. In a headset the listener is the head
  (the shell's `HOST.sfx.listen` already puts it there every frame; the emitters' places are converted to the same
  world coordinates). On a page the studio puts the listener at its camera while it shows and back at the origin in
  `dispose`.
- Silent while `HOST.audio.fx()` gives no context (before a tap, hidden, the `<audio>` engine chosen) or the device's
  Sound button is off (`HOST.audio.muted`): they fade out and are rebuilt on a new context. Not the Sound effects or
  Narration switches (an emitter is the scene's own sound, not an effect): this is said in the studio's sound pane.
- `start: 'always'` loops start at the same moment for everyone at a station: offset = the room's time
  (`HOST.collab.now()`) modulo the sound's length; outside a room from when the scene opened.
- Decoded once per file (`decodeAudioData`), at most 60 MB of decoded sound per scene (more: the rest not loaded, said).
- While editing: a small speaker marker (a ball and cone in the sound's colour) and a faint ring on the floor at `r`.

## Editing

Off by default; *Edit* in the Scene pane turns it on for this device (kept as `studioEdit`; never in `state()`).
Refused (greyed, *This scene is locked*) while the station's story is locked (`HOST.anchor.locked('globe')` at a
station; *Lock this story*), and not offered at all with `&visit`. Every change is recorded for *Undo* (this device's
last 30 changes; an undo writes the item's record as it was, or removes what was added, or puts back what was
deleted).

In a headset (editing on):
- Pointing at an item lights it and names it; the trigger (or a pinch) selects it (its card on the panel). Pointing at
  nothing and pressing clears the selection.
- The grip carries an object or a sound (as the design room's miniatures: it keeps its offset from the hand and, with
  free moving on, turns with it; off, only about the vertical; the right stick pushes it away or pulls it in), and a cube
  (level; only its yaw turns). Both grips on an object size it (a twentieth to twenty times) and move it with their
  middle. A selected cube shows a ball at each of its 8 corners: the grip on a corner stretches the cube (the opposite
  corner stays). Let go, it stays where it was put (its record written).
- In VR (not passthrough) the left stick walks you through the scene and the right stick turns you 30 degrees a flick,
  while nothing is carried (`XR.lifeOff` style: the scene moves, not the rig; per device, reset by Recenter; never
  written to the room). In AR you walk for real.
- In AR objects stand on the real floor: outside a room the floor is the session's `local-floor` (its height in the
  renderer's `local` space from `frame.getPose`), not a guess 1.6 m under the eyes; at a station the room's floor.

On a page (editing on): a click selects; `TransformControls` arrows move, turn and size the selected item (W, E, R, or
its card's buttons; cubes take per-axis size from R; sounds only move); views: *Orbit* (the camera goes round the scene,
as the design room's) and *Walk* (first person at 1.6 m: W A S D or the arrow keys, drag to look, a click on the floor
walks there; this is where cubes trigger on a page). Delete, Duplicate (D) and Undo (Ctrl+Z) from the keyboard too.

The panes (page HTML and headset canvas twins, the same content):
- **Scene**: its name and the scenes to pick from (a station's scene is for everyone at it); *Edit* on/off; *Save*
  (the relay: *Saved 22:41* or why not), *Unsaved changes* when what is placed differs from what was last saved or
  loaded; *Load saved* (asks first: two presses); *Undo*; *Reset what I have seen* (the `stay` cubes); on a page
  *Download layout.json* and *Upload*; the relay's state (none: how to run one, with the command).
- **Add** (editing): the scene's models (name, size on disk, a warning mark), its sounds, and *Trigger cube*. A press
  places it 1.5 m in front of you on the floor (a model's lowest point on the floor, its middle there), selected.
- **Item** (one selected): its name; for an object its card (above), *Lit* / *As scanned*, the animation (clip, *Loop*
  / *Once* / *Off*, *Always* / *When shown*), *Turn 90 degrees* (about the vertical), *Stand up* (a quarter turn about
  x), *On the floor*, size steps (x0.5, x0.9, x1.1, x2), *Duplicate*, *Delete*; for a cube: size steps per axis (10 cm),
  *While inside* / *Stays once entered*, *Shows n* and *Hides n* with *Pick what it shows* and *Pick what it hides*
  (then pointing and pressing on items adds or removes them from that list until *Done*; the items drawn with a tick),
  *Delete*; for a sound: *Volume* steps, *Full volume within* steps, *Loop*, *Always* / *When shown*, *Delete*.
- **Items**: every item in the scene (objects, cubes, sounds), what is selected lit, a press selects it; on a page also a
  tick box per item in a selected cube's *Shows* and *Hides* columns.

## Shared rooms

- A station like the design room's (placed with the page's Add or the headset's Add here, or the menu's *Studio* row:
  outside a room it opens the studio, in a room *Studio here* puts its circle at your feet or moves the room's one
  there; refused while the circles are locked; never by Arrange all). Its clock starts in explore mode. Everyone at the
  station sees one scene and one layout; triggers, editing, selection, Walk, the VR stick walk and sound are each
  device's own.
- `state()`: `{ scene, 'o.<id>': {...}, 'c.<id>': {...}, 's.<id>': {...} }`: the scene's name (`''` none) and one top-level
  field per item (its record as in `layout.json`, without `id`), so two people changing two items at once both keep
  theirs. An item absent from a state applied is removed there. `apply(state())` gives the same state back (records kept
  exactly as given, after the same checks as a read layout). Changing the scene clears the items and the device that
  changed it writes the new scene's saved layout as items.
- A station with no `scene` yet: with exactly one scene in the listing every device picks it (and writes its saved
  layout: every device writes the same records, so nothing doubles); else *Pick a scene*. A station whose scene this
  device cannot find (another relay, not listed): its items keep their places and show as grey boxes, said on the Scene
  pane.
- Items glide to a record from the room (0.25 s), unless carried here (the carry wins until let go, as the design
  room's). No effects; `view()` null; `place` and `panel` as the design room's (only the panel moves).
- Saving writes what is placed now (the station's items) for everyone; another device's save shows as *Saved 22:41 by
  Anna* where the shell gives a name.
- No `FORMAT` change: a new page in `STORY_EXTRA` is a station an older device shows as *A newer story*.
- Outside a room: what is placed is kept on this device too (`studioDraft.<relay or folder>.<scene>`, written a second
  after each change); opening the scene with a draft newer than the saved layout and different from it offers *Your
  unsaved changes from <time>: Restore / Discard*.

## Placement in a headset

Life size, like the design room: the scene's origin at the rig's floor point (outside a room: where you stood as the
session or the studio began, facing your way; anchored with `HOST.anchor` when Anchor is on, so an exhibit comes back
at the same place in the real room; at a station: the station's spot, so moving the circle moves the scene, and a
scene calibrated to the room's spots stays put while the circle does). The grip on nothing moves only the panel. In VR a
dark floor with a faint 1 m grid and a soft sky; in passthrough nothing of those.

## GLB first, and converting (the owner, 4 November 2026)

The owner: "maybe we should work with these and use a converter like you mentioned glb better than fbx and we can just
convert it". GLB is the format to work with; FBX stays supported. The converter (`tools/studio/convert.mjs`) turned the
owner's atelier (14 MB FBX) into an 11.4 MB GLB that parses in 0.3 to 0.7 s instead of 1 to 2 s, and the figure (3.7 MB)
into 3.0 MB with its skin and take exact, 0.03 s instead of 0.55 s.

- **One converter, two places.** The conversion code is one module (`tools/studio/engine/convert.js`, or where it fits)
  used by `convert.mjs` in its headless page and pasted into `stories/studio.js` (with `GLTFExporter`, now in the app,
  loaded only when converting: see the vendor README). The GLB it writes is in metres and Y up, its textures at most
  4,096 px (or 2,048: *for Quest*), and records what it baked in: `asset.extras.studio = { from: '<the original's path in
  the scene>', s: <the scale applied>, q: [x, y, z, w] <the turn applied>, at: <ms> }`.
- **A scene's folders.** What the studio makes goes into folders of the scene: `models/` (GLB), `sounds/` and
  `originals/` (the files as they were given: an FBX and its textures, an OBJ and its MTL; kept so a model can be
  converted again). Files at the scene's root or in other folders still work as before. The Add list shows `models/`,
  `sounds/` and anything outside `originals/`; `originals/` is folded under *Originals*.
- **Convert to GLB** (page only, editing on; a headset says *Convert on a laptop*): on an FBX (or OBJ, PLY, STL, glTF)
  object's Item card and as *Convert every model* in the Add pane. It loads the file, converts it, then (relay) uploads
  it as `models/<base name>.glb` (the original stays where it is), or (no relay, or saving off) downloads it. Progress
  and the result are said; a failure changes nothing. Once uploaded, every object placed from that original switches to
  the GLB where it stands: for the baked scale b and turn r, `s' = s / b` and `q' = q * r^-1` (one change, one Undo step,
  for everyone at a station).
- **The Add list prefers GLB.** A GLB whose `asset.extras.studio.from` names another file of the scene (or, without
  extras, has the same base name) stands for it: the original shows only under *Originals*; placing places the GLB. A
  placed original's card says *A converted GLB is in the scene: switch to it* (the same switch as after converting).

## Textures: found, added, converted (the owner, 4 November 2026)

The owner: "it needs a way to add textures to models in case they are missing, preferably with autoassign and direct
convert to good formats". Three parts: the studio reads more kinds of picture, finds a texture under another name by
itself, and lets a picture be given by hand, baked at once into the model's GLB. A picture laid on is **never stored in
`layout.json` or `collab.state()`** (no `FORMAT` change, the records unchanged): it lives in the GLB and its record.

- **Reading pictures** (`tools/studio/engine/images.js`, plain JavaScript, also loaded by `convert.mjs`'s page and the
  Node test): the browser shows PNG, JPEG, WebP, GIF, BMP and AVIF; TGA goes through three.js's `TGALoader`; **TIFF**
  (baseline, strips or tiles, none, LZW, PackBits or Deflate, the horizontal predictor, 1 to 16 bits, grey, RGB, palette
  or CMYK, alpha associated or not, either byte order), **PSD and PSB** (the merged picture, raw, RLE or zipped, 1, 8 or
  16 bits, RGB, grey, CMYK, palette, bitmap, duotone; the channel after the colours is transparency only when the file
  says so (a negative layer count) or nothing names it (no layers and no named or numbered alpha channels: a saved
  selection or mask is left out), and then the colours are un-blended from white as Photoshop keeps them; an empty one
  says *save it with Maximise compatibility on*) and **DDS** (the largest picture: uncompressed
  by its masks, DXT1/BC1, DXT3/BC2, DXT5/BC3, BC4 and BC5, a normal map's z rebuilt; the DX10 header for those) are
  read in the page. Refused with a sentence: EXR and Radiance HDR (*an HDR picture (EXR): save it as PNG or JPEG*),
  HEIC, KTX and KTX2, BC6H and BC7, a TIFF compressed with JPEG, CCITT and the like, 32-bit PSDs. A picture is told by its
  bytes first, so a file named wrongly still reads. Broken or forged files are refused in words, quickly, before any
  memory their headers claim is asked for: at most 64 million pixels (8,192 x 8,192); the data must be in the file (a
  file too short for its size at the most its compression packs is *cut short*); strips or tiles of no size and counts
  past the end refused; Deflate unpacked to at most the bytes a strip or channel needs (a small stream can unpack to
  gigabytes); a reader's own error (out of range) said as *a TIFF cut short or damaged: save it again, or as PNG*.
- **During a load** (the converter's `load`, which the viewer, Convert to GLB, the Upload pane and `convert.mjs` share):
  the names a model gives (an FBX's texture names, an OBJ's MTL names, a glTF's image addresses) that stand for a TIFF,
  PSD or DDS (or a TGA under another name) are fetched and read first, drawn down to the texture limit, and given to the
  loader as a PNG (a blob address, revoked once loaded or once the load fails; kept by the address each name stands for,
  so two pictures of one name in two folders stay two). A TGA name goes through a handler that reads whatever its bytes
  are (the FBX loader sends `.tga` names to the TGA handler whatever the file turned out to be). three.js's FBX loader
  makes an empty texture for any name ending in `.psd` without asking for it, so each such name in the FBX's bytes is
  made `.ps~` first (the same length: binary, only string records that end there; ASCII, quoted strings) and back again
  in the URL modifier. A picture that cannot be read counts as missing, with its sentence (`why`).
- **The ladder** (`CONV.texFind(name, pictures, { dir })`, in `images.js`): `path` the path the model gives, from its
  folder, then from the scene's top; `name` its file name in any case (the nearest: the model's own folder first);
  `ext` its name with another picture's extension (`x.tga` for `x.png`; PNG, JPEG, WebP, TGA, BMP, TIFF, PSD, DDS in that
  order); `similar` the same words but colour words (`diffuse`, `diff`, `albedo`, `basecolor`, `color`, `colour`, `col`,
  `d`, `tex`, `texture`; split at separators and at a capital after a small letter), in the same slot, and only when
  exactly one picture is so (one in two kinds counts once). Slot words are never dropped, so a normal map never stands
  in for a colour one. `CONV.slotOf(name, mean)`: a colour word anywhere (`diffuse`, `diff`, `albedo`, `basecolor`,
  `color`, `colour`, `col`, a last `_d`) makes it `map` (`Metal_Door_Albedo.jpg`, `Arm_Diffuse.png`); else only its last
  word says the slot, sizes, numbers, `gl`, `dx` and `map` after it aside (`stone_rough_2k.png` is roughness,
  `Rough_Stone.png` a colour picture): `orm`, `normalMap` (`normal`, `nrm`, `norm`, `nor`, `_n`), `roughnessMap`
  (`rough`, `_r`), `metalnessMap` (`metal`, `metallic`, `_m`), `aoMap` (`ao`, `occlusion`), `emissiveMap` (`emissive`,
  `emission`, `glow`, `_e`), `alphaMap` (`opacity`, `alpha`, `mask`), else `map`, unless its mean colour is a normal
  map's bluish purple (and the slot was not chosen by hand meanwhile). `CONV.texRank` orders a scene's pictures for a
  name: the ladder's hit, shared words, the same slot, the same folder, and ones no other model uses.
- **The card** (an object's Item pane): each missing name in amber, with, on a page with editing on (never with
  `&visit`), up to three of the scene's pictures as *Use <file>* (the likeliest first) and *Choose a picture...* (a file
  from this computer: with a relay that takes uploads it goes to `originals/<file>` and is used from there; without one
  it is used from memory and the GLB downloaded). A picture the reader refused says why. A texture found by `ext` or
  `similar`, or read from a TIFF, PSD or DDS, has a faint line (*Texture x.tga: using brick.tif, the same name as a
  TIFF*), and a GLB's own record its pictures laid on (*Texture x: paint.png, chosen by hand (in this GLB)*). *Add a
  texture...* (a model whose materials have texture coordinates): a picture of the scene (the likeliest by name first) or
  *Choose a picture...*, then the material (*On*, a press for the next when there are several) and the slot (*As*:
  Colour, Normal, Roughness, Metalness, Occlusion, Glow, Opacity, Packed (ORM); chosen by the picture's name or a normal
  map's colour until a slot is pressed),
  *Add and convert* and *Cancel*. One press converts at once (*Adding x.png: converting...*, *...uploading
  models/x.glb*), the result as Convert to GLB's. In a headset the card says what is missing and *Add a texture on a
  laptop*, with no buttons for it.
- **Baked in** (`texGo` and `convertFile` in `engine/e7b_upload.js`): the GLB is written by Convert to GLB's own path
  (with a relay: `models/<name>.glb`, objects placed from the original switched to it where they stand; else downloaded)
  with the pictures laid on, and its record lists them: `asset.extras.studio.tex = [{ name (the name the model gave, ''
  for a slot added), mat (a material's name, its index when unnamed or shared, '*' every material lacking that slot),
  slot, from (the picture's path in the scene), how ('path', 'name', 'ext', 'similar', 'only', 'stem' or 'chosen') }]`
  (`glbRecord` passes it on, checked and at most 40). Converting the original again lays the ones chosen by hand on again
  (read from the GLB made from it). An object on a GLB is fixed by making that GLB again: from its `from` original when
  that is in the scene, else from the GLB itself (its glTF guess: scale 1, no turn), the old GLB first kept under
  `originals/` when it is replaced where it is. A slot added on a GLB's material and laid on its original finds that
  material there by its meshes' names, else its own name (one shared Phong material is one material per mesh in the GLB,
  so their order and keys differ), and the record keeps the original's key; a record made again from itself keeps one
  entry per name or material and slot (the newest). A picture chosen from this computer and uploaded stays in
  `originals/` when the conversion does not run after all (the scene changed, editing went off, the story was locked),
  and the note says so.
- **`CONV.addTextures(root, list, o)`** lays a picture on a material that had none in that slot: it needs texture
  coordinates (else *it has no texture coordinates (UVs), so a picture cannot be laid on it*); right way up for a model
  through the glTF loader (`flipY` off), else turned over as three.js does; an occlusion picture gets a second set of
  coordinates from the first (and the viewer gives one to an occlusion map that has none); an `orm` picture goes in
  occlusion, roughness and metalness at once; a roughness or metalness picture sets its factor to 1; a glow picture makes
  a black emissive colour white.
- **In the GLB** (`toGLB`): separate roughness and metalness pictures are packed into one (roughness in green, metalness
  in blue, as three.js reads them and glTF keeps them; r128's exporter drops them otherwise); a bump map (FBX's, an
  MTL's `bump`) becomes a normal map from its slopes (a Sobel filter over its brightness, as steep as its `bumpScale`
  says) instead of being left out; each note says so. Textures are still drawn down (2,048 For Quest, else 4,096) and
  written as JPEG when opaque, PNG otherwise.
- **The Upload pane**: a model's row lists each texture name it gives with what it will have and how it was found, or,
  missing, the dropped pictures no model uses (likeliest first) as *Use <file>* and *Choose a file...*. Found by the
  ladder against what was dropped, then `only`: exactly one model lacking exactly one texture and exactly one dropped
  picture no model uses are put together (*the only picture left over*) when the picture's slot is the name's (a normal
  map left over never stands in for a missing colour picture; it is still offered as *Use*). *Not this* takes a pairing made by hand or by
  `only` back. A picture dropped onto a model's row is that row's: for a texture it lacks, else laid on as a slot of its
  own (by its name or a normal map's colour; a press changes it). A picture a row uses goes to `originals/` as that row's
  file, not as a row of its own. At convert time a model with no colour picture at all takes a left-over picture whose
  words match the model's or a material's name (`stem`), and says so.
- **`convert.mjs`**: `--texture <name>=<picture>` (a name the model gives), `--texture <material>:<slot>=<picture>` (a
  slot added; the material's name, its number from 0, or `*`) and `--textures <dir>` (more pictures to look in, any
  depth), by the same ladder; it prints what each texture was found as and writes `tex`.
- **Formats in the relay's listing**: `.tif`, `.tiff`, `.psd`, `.psb`, `.dds` and `.avif` are images (`relay/scenes.mjs`),
  served with their types (`image/tiff`, `image/vnd.adobe.photoshop`, `image/vnd-ms.dds`, `image/avif`).
- Untested: real pictures from Photoshop, Substance and game engines beyond the generated ones and those ImageMagick and
  Pillow write (checked by hand while building), a big TIFF or PSD's memory in a headset's browser (they are read on a
  page), and how a bump made a normal map looks against the original.

## The upload page (the owner, 4 November 2026)

The owner: "the relay should offer an upload page where everything gets converted into the right formats directly and
then sorted into a folder if possible".

- **Where.** `<relay>/upload` (no password needed to be redirected; everything after asks for it as the API does)
  redirects (302) to the studio's upload pane: `/#studio&upload` when the relay serves the app (`--static`, `--lan`);
  else to the app's public address (`--app <url>`, default the `--public` origin, `https://stories.lbi-netmed.com/`)
  with `#studio&upload&relay=<this relay's wss:// address>` (from the request's Host and, behind `--proxy`,
  `X-Forwarded-Proto`). It is the studio's own **Upload** pane (a tab beside Scene, Add, Item, Items; pages only: a
  headset shows no Upload tab), so it shares the studio's loaders, converter, relay and password handling. Nothing is
  uploaded without a relay that takes uploads (the pane says how to run one).
- **What the person does.** Pick a scene or *New scene* (a name: `POST /api/scenes`); drop files or whole folders onto
  the pane (or *Choose files*); the pane shows the plan, one row per thing it will make, before anything happens;
  *Convert and upload*; progress per row; then *Open the scene* (the studio on that scene, editing on) and what was made.
  *For Quest* (textures at most 2,048 px) is on by default; off, 4,096. *Replace files with the same name* is off by
  default (a new name is numbered: `eva_001 2.glb`).
- **Grouping.** A model file and the files it needs from what was dropped (the textures it names, found by base name,
  case-insensitively, wherever they were in the dropped folders; an OBJ's MTL and the MTL's textures; a glTF's `.bin`
  and textures) are one model. Each sound is one sound. Anything left (an image no model names, an unknown file) is
  listed as *kept as it is* into `originals/`, never silently dropped. A model whose texture is missing says so in its
  row (*converted without its texture x.png*), as the studio's card does.
- **Models**, converted in the browser by the shared conversion module: FBX, OBJ (with MTL), glTF (with `.bin` and
  textures), GLB, PLY (vertex colours kept) and STL, all to `models/<base name>.glb`: metres and Y up (the same guesses
  as the studio's, baked in), textures drawn down to the limit and stored as JPEG (PNG where see-through), the FBX
  opacity-0 quirk fixed, a mesh without normals marked to be shown as scanned, `asset.extras.studio` recorded (`from`:
  `originals/<path>`). The given files go to `originals/<the dropped folder's structure>`. A GLB already in metres with
  small textures is still passed through (it gains its record and the texture limit). Animations and skins kept; if the
  exporter cannot keep them, the row fails and says why (convert.mjs's own check), and the original is still kept.
  Add the r128 loaders this needs to `tools/studio/vendor/` (`OBJLoader.js`, `MTLLoader.js`, `PLYLoader.js`,
  `STLLoader.js`, unchanged, MIT; update the vendor README); the studio may then load these formats directly too.
- **Sounds**: mono, so they place well. Up to 20 s: decoded in the browser, mixed to mono and written as 16-bit WAV at
  its own rate (at most 48 kHz) to `sounds/<base name>.wav` (gapless loops on every browser; OGG does not play on
  iPhones). Longer: when the relay has ffmpeg (`GET /api/scenes` says `ffmpeg: true`), sent to it, which writes
  `sounds/<base name>.mp3` (mono, 96 kbit/s, 44.1 kHz); without ffmpeg an MP3, M4A/AAC or OGG is kept as it is (*stereo:
  played from one point*) and anything else (WAV, FLAC, AIFF) becomes a mono 22.05 kHz WAV. The given file goes to
  `originals/` too.
- **The relay's side** (all with the password; refused with `--scenes-readonly` (403); `GET /api/scenes` adds
  `upload` (this caller may upload), `ffmpeg` and `maxUpload` (bytes)):
  - `POST /api/scenes` with `{ "name": "<name>" }` makes the scene's folder (the scene name rule; 409 when it exists)
    -> `{ ok, name }`.
  - `POST /api/scenes/<name>/file?path=<relative path>[&replace=1]` with the raw bytes: a path inside the scene (the
    listing's rules: at most 4 folders deep, no dot segments or backslashes), never `layout.json`, `files.json`,
    `index.json` or anything under `.history/`; a model, sound, image or data kind anywhere, any file under
    `originals/`; at most `--max-upload` MB (512), counted while it streams in (cut off at the limit with 413, nothing
    left behind); an existing file only replaced with `replace=1` (else 409); folders made as needed; written to a
    temporary dot file and renamed -> `{ ok, path, bytes, at }`.
  - `POST /api/scenes/<name>/sound?path=sounds/<base name>.mp3[&replace=1]` with a sound's raw bytes: only when ffmpeg
    was found at start (`ffmpeg -version`; `--ffmpeg <path>` names it, `--no-ffmpeg` turns it off; 501 without), run
    with `-nostdin`, the input from a temporary file, mono, 96 kbit/s, 44.1 kHz, a 180 s limit, at most 2 at once (429
    with Retry-After beyond), its output checked (ffprobe-free: the output exists and is not empty) and renamed into
    place -> `{ ok, path, bytes, at }`. ffmpeg's messages are never sent to the page (logged shortly, no paths with
    queries).
  - `GET /upload` as above. The watch tells every studio page what was written.

## Long sounds are streamed

The owner's `first_room.mp3` is 4 min 16 s of stereo at 48 kHz: about 98 MB decoded. A sound longer than 20 s (read
from an `<audio>` element's metadata before anything is decoded) is streamed: an `<audio>` element per emitter
(`crossOrigin = 'anonymous'`, the password as `?token=`, `preload = 'auto'`), through
`createMediaElementSource` on the shell's context into the emitter's panner and gain; `loop` on the element; its start
offset set by `currentTime` (the room's time modulo its length for `start: 'always'`); paused, not torn down, while
`HOST.audio.fx()` gives no context or the device is muted, and set to the right moment again when it comes back; a new
context (the shell's renew) makes its source again (an element can feed only one context: make a new element then).
Shorter sounds are decoded as before (gapless loops). The 60 MB limit counts decoded sounds only. A stereo file is
played from its point (the panner mixes it to that point); the Sound pane says *mono files place best*.

## Formats guide (`tools/studio/README.md`, and briefly on the Scene pane where no scene is found)

Models: GLB (one file, textures and animations inside); FBX works, converted it loads faster and sits right without
guessing. Textures: JPEG for photos and scans, PNG only for see-through; at most 4,096 px, 2,048 safer on a Quest.
Budgets on a Quest: about 300,000 triangles a model, 500,000 a scene. Sounds: mono; short loops as WAV (MP3 adds silence
at its ends, so a loop clicks; OGG does not play on iPhones); long ones (more than 20 s, streamed) as MP3 at 96 to 128
kbit/s. The upload page does all of this by itself; by hand: Ready
lines: `ffmpeg -i in.wav -ac 1 -c:a pcm_s16le loop.wav` (a loop), `ffmpeg -i in.mp3 -ac 1 -b:a 96k out.mp3` (a
long one), and `node tools/studio/convert.mjs model.fbx` (a batch on a computer with Playwright).

## Tests

- `tools/studio/test/scenes/textures/` (about 20 KB, no layout): made by the same script from
  `tools/studio/test/pictures.mjs` (small writers for TIFF with LZW, PackBits and Deflate, PSD with RLE, DDS as DXT1,
  DXT5 and BC5): OBJs and an ASCII FBX that name their pictures by each rung of the ladder, one that lacks its picture,
  one whose picture is refused, and a box with no material. `node tools/studio/test-images.mjs` (seconds, no browser)
  reads every picture back against the pixels it was made from (exact, or within the block format's error), more kinds
  made in memory, the refusals, the ladder, `slotOf`, `texRank` and the `.psd` renaming. The smoke test's *studio
  textures* steps and `tools/collab.mjs --studio`'s texture step: "Testing" in `AGENTS.md`.
- `tools/studio/test/scenes/test/`: small files made by `tools/studio/test/make.mjs` (committed with what they make,
  under 200 KB together): an animated `box.glb` (two clips), an ASCII `figure.fbx` (a mesh with a material naming
  `figure.png` beside it, a take that turns it, Z up and in centimetres, so both guesses show), `figure.png`, a
  short `tone.wav`, a `layout.json` with one object of each file, a cube showing the figure and hiding the box, and a
  sound shown by the cube; and `index.json` and `files.json` from `scan.mjs`.
- `node tools/smoke.mjs` (a studio block): through `&scenes=tools/studio/test/scenes&scene=test`: every file loads
  (sizes and the two guesses as above, the clips listed, the missing-texture note for a file that names one not there),
  the layout read; a pretend head moved into the cube shows the figure and hides the box (fading), out again the
  reverse; `stay` holding; editing: a selection, a move by the page's controls, a cube stretched, a link added to a
  cube's lists, Undo; the state with them and back (`apply(state())` the same), a state from the room taken, bad values
  ignored; a pretend headset's grip carrying an object and both grips sizing it, a corner stretching a cube, the VR
  stick walk; the emitter's panner at its place (Web Audio running after a tap), silent while muted; the headset panels'
  panes; Download giving the layout; the `STORY_EXTRA` lines checks passing for the studio.
- Converting: the smoke block converts `figure.fbx` in the page (no relay: offered as a download; the bytes a GLB whose
  extras name the original, loading back with the same triangles and clip), and a placed figure switching to a GLB keeps
  where it stands (its corners within 1 mm); `tools/collab.mjs --studio` converts it through the relay (the GLB written
  next to the FBX, every page's object switched, the Add list showing it as converted). A sound longer than 20 s (a
  generated 25 s file in the test scene) is streamed (an element, no decoded buffer), a short one decoded.
- The upload pane: the smoke block drops the test scene's originals (a test FBX with its PNG, an OBJ with its MTL, a
  short and a long sound) onto the pane with no relay (the plan's rows, grouping and names checked; converting offered as
  downloads); `tools/collab.mjs --studio` does it through the relay (a new scene made, the files sorted into `models/`,
  `sounds/` and `originals/`, the GLBs loading with their records, a short sound as a mono WAV, a long one via ffmpeg
  when the machine has it, else kept, `/upload` redirecting).
- `node relay/test.mjs` (a scenes section, also the uploads, scene creation, the ffmpeg endpoint with a stand-in
  ffmpeg script and without one, and `/upload`'s redirects): every endpoint above, listing rules, types, ETag and 304, ranges, traversal
  and symlinks refused, the password on every scene endpoint and file (and wrong ones counted), `--public` without a
  password refusing to start, `--scenes-readonly`, saving (the file written, the old one in `.history/`, 20 kept, a bad
  or too-big layout refused), the watch's events for an added, changed and removed file and a saved layout, the
  password in no log line.
- `node tools/collab.mjs --studio` (a round of its own, also in the main run): a relay with `--scenes` on a copy of the
  test scenes; three pages and a pretend headset at a studio station: the scene picked on one reaching all, an object
  moved on one page and a cube added on another both kept, the headset inside the cube seeing the figure while a page
  outside does not, a save from the headset writing `layout.json` (and `.history/` on the second), a file dropped into
  the scene's folder appearing in the Add list within a few seconds, the station's story locked refusing edits.
- How it looks and feels on a headset (the scan's size, frame rate with a 400k-triangle scan, the grips, the stick walk,
  how the emitters sound through HRTF) is untested until tried on one.

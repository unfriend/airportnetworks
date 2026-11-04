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
  a *trigger cube*, a *sound* (an emitter) or a *cut-out* (a box that hides the part of one object's model inside it:
  "Cut-outs" below).
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
      "loop": true, "start": "always" },
    { "id": "v7kq2m", "name": "Voice", "file": "sounds/voice.wav", "p": [0.4, 1.7, -2.6], "vol": 1, "r": 1,
      "loop": true, "start": "shown", "on": "k3f9qa", "bone": "mixamorigHead", "o": [0, -0.03, 0.14] }
  ],
  "cuts": [
    { "id": "d0or01", "name": "Door", "on": "k3f9qa", "p": [1.6, 1, -3.55], "q": [0, 0, 0, 1], "size": [0.8, 2, 0.4] }
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
- A sound's `on`, `bone` and `o` (optional, kept only when set; "Sounds that follow a model" below): `on` the id of an
  object of this scene it follows; `bone` the name of a bone of that object's model (or, for a model with no bones, of
  a part its animation moves) as three.js gives it, at most 120 characters (absent or `''`: the whole model); `o` the
  offset `[x, y, z]` in metres in the target's frame, turned but not scaled, to the mm, each within 1,000 (absent or
  `[0, 0, 0]`: none). A `bone` or an `o` without `on` is dropped, whatever it holds; with `on`, an `on` that is not an
  id, a `bone` that is not a string or an `o` that is not three numbers makes the record bad. `p` stays: where the sound
  stands when it follows nothing, or when what it follows is not in the scene. The layout's version stays `studio: 1`.
- A cut-out's `on` (required: the id of the object it cuts), `p`, `q` and `size` ("Cut-outs" below): in that object's
  frame, turned but not scaled (metres), `p` to the mm, `q` a full turn (4 decimals), each side 1 cm to 50 m to the mm.
  A layout without `cuts` (v112's) reads as before.
- Limits: 300 objects, 100 cubes, 60 sounds, 100 cut-outs (and 16 on one object: "Cut-outs"); a `file` is a path in the scene's listing (at most 200 characters, no
  `..`); a list of ids in a cube only names items of this scene (others dropped when read). A sound that follows an
  object the layout does not hold keeps its `on`, `bone` and `o` and stands at its `p` until that object is back, as with
  a state from the room (so a save made meanwhile never loses what it followed); a cut-out whose object the layout does not
hold is kept the same way, and cuts nothing until that object is back. Anything else in a read layout is
  ignored; a bad item is dropped and said once (*2 items in layout.json could not be read*).

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
- A sound may follow an object or one of its bones ("Sounds that follow a model" below): it is placed, heard and shown
  where that puts it, and only while it and its object are both shown for you.

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
  places it 1.5 m in front of you on the floor (a model's lowest point on the floor, its middle there), selected. And
  *Cut-out box* (*Cut-out box on Wall* while a model, or one of its cut-outs, is selected; else *Cut-out box: select a
  model first*, greyed).
- **Item** (one selected): its name; for an object its card (above), *Lit* / *As scanned*, the animation (clip, *Loop*
  / *Once* / *Off*, *Always* / *When shown*), *Turn 90 degrees* (about the vertical), *Stand up* (a quarter turn about
  x), *On the floor*, size steps (x0.5, x0.9, x1.1, x2), *Duplicate*, *Delete*; for a cube: size steps per axis (10 cm),
  *While inside* / *Stays once entered*, *Shows n* and *Hides n* with *Pick what it shows* and *Pick what it hides*
  (then pointing and pressing on items adds or removes them from that list until *Done*; the items drawn with a tick),
  *Delete*; for a sound: *Volume* steps, *Full volume within* steps, *Loop*, *Always* / *When shown*, *Follows* (*Follow
  an object...*, its bone choices, *Move onto it*, *Stop following*: "Sounds that follow a model"), *Delete*.
- **Items**: every item in the scene (objects, cubes, sounds, cut-outs), what is selected lit, a press selects it; on a
  page also a tick box per item in a selected cube's *Shows* and *Hides* columns. A sound that follows something says what
  (*→ Dancer · Head*). Each object's cut-outs are listed under it (indented, *✂ Door*); cut-outs whose object is not
  here under a heading of their own.

## Shared rooms

- A station like the design room's (placed with the page's Add or the headset's Add here, or the menu's *Studio* row:
  outside a room it opens the studio, in a room *Studio here* puts its circle at your feet or moves the room's one
  there; refused while the circles are locked; never by Arrange all). Its clock starts in explore mode. Everyone at the
  station sees one scene and one layout; triggers, editing, selection, Walk, the VR stick walk and sound are each
  device's own.
- `state()`: `{ scene, 'o.<id>': {...}, 'c.<id>': {...}, 's.<id>': {...}, 'x.<id>': {...} }`: the scene's name (`''` none) and one top-level
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
- A sound's record carries what it follows (`on`, `bone`, `o`), so following is shared exactly as placing is: everyone
  at the station hears it from the same bone, each device posing its own model on the station's clock (with `start:
  'shown'` from each person's own moment, as an object's animation). FORMAT `networks-30` (v112): an older device would
  strip those fields and write the record back.
- Saving writes what is placed now (the station's items) for everyone; another device's save shows as *Saved 22:41 by
  Anna* where the shell gives a name.
- No `FORMAT` change came with the studio itself: a new page in `STORY_EXTRA` is a station an older device shows as *A
  newer story*. Sounds that follow a model changed a sound's `state()` and so `FORMAT` (`networks-30`, v112); cut-outs
  added a kind of field (`x.<id>`) and so `FORMAT` again (`networks-31`, v113).
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

## Sounds that follow a model (the owner, 4 November 2026)

The owner: "also sound should follow a model, sometimes i might also want to select bones like the head for voice,
breast for sounds she makes while moving etc". A sound may follow an object, the whole model or one of its bones, so a
voice stays at a dancer's head and her movement sounds at her chest as she moves.

- **The record** (`layout.json` and `state()` alike; "A scene's layout" above): `on` (the object's id), `bone` (a bone's
  name, absent the whole model), `o` (the offset in metres in the target's frame, turned but not scaled; absent none),
  each kept only when set, `p` as before. The target is the bone, else the object's holder (its place `p`, turn `q` and
  size `s`; there from the first frame, before its model is in).
- **Where it sounds.** Every frame, once every object's animation has stepped (two passes: objects first, then sounds:
  `soundStep` in `engine/e6_items.js`), a following sound's holder is put at the target's place plus the target's turn
  times `o`, both in the scene's frame (the target's world matrix updated first; a skinned model's bones posed by its
  own mixer). The speaker, its ring, the labels, the pointer's hit and the panner follow (the emitter reads the
  holder's place). A record from the room glides there (0.25 s) as any item's. While carried by a grip or dragged by the
  page's arrows, the sound is where the hand or the arrows put it (no following until let go). Not found on this
  device: a bone missing, the whole model; the object not in the scene (deleted elsewhere, a state from the room without
  it), the sound's own `p`, until it is back.
- **Bones** (`bonesOf`, `nodeOf`): a model's bones by name as its loader gives them (the file's, the same in each
  clone; each object's own clone has its own bones, `SkeletonUtils.clone`, and the sound uses its object's); a model
  with no bones offers the parts its clips move (the nodes their tracks name; the test box's Bob). A name is found
  exactly, else leniently: lower case with everything but letters and digits taken out, since three.js's loaders tidy
  names (spaces become underscores, `[ ] . : /` go): an FBX's *Bip01 Head* is *Bip01_Head*, *mixamorig:Head* is
  *mixamorigHead*. A record keeps the name as this device's three.js gave it when chosen. The short list, each shown only
  where the model has such a bone, by the end of its tidied name (Mixamo, 3ds Max's Biped, Unreal, Rigify's `DEF-`,
  VRM and Unity's humanoid names; the bone nearest the root, then the shortest name): *Whole model*, *Head* (`head`,
  `defspine006`), *Neck* (`neck`, `neck01`, `neck1`, `defspine004`, `defspine005`), *Chest* (`upperchest`, `chest`,
  `spine2`, `spine03`, `spine003`, in that order of preference), *Hips* (`hips`, `pelvis`, `defspine`), *Left hand*
  (`lefthand`, `handleft`, `lhand`, `handl`), *Right hand*, *Left foot*, *Right foot* (the same, mirrored). Rigify
  numbers its spine (`DEF-spine` the hips, `.003` the chest, `.004` and `.005` the neck, `.006` the head), so those
  endings carry its `def` prefix: another rig's `spine006` is not a head. Then *More bones...* (or *Moving parts...*):
  every one by name, all on a page, eight at a time on the headset (*Previous*, *Next*). The owner's rigged figure (a 3ds
  Max Biped, 35 bones, `Bip001_...` once loaded) finds all eight (its *Chest* is `Bip001_Spine2`).
- **Attaching, moving, letting go** (each an ordinary change: one Undo step, written to the room, saved):
  - A sound's card (page and headset alike): a *Follows* line (*nothing*, or *Dancer · Head, 0.12 m from it*) and row:
    *Follow an object...* (a pick mode, as *Pick what it shows*: the trigger or a click on an object takes it, and the
    card lists the scene's objects to press; *Cancel*), then, following, *Follow another object...*, *Move onto it* (no
    offset; `p` there too) and *Stop following* (`p` where it is now; `on`, `bone` and `o` go), and the bone choices
    (*Bone*, or *Moving part* for a model with none). Attaching keeps the sound where it is (`o` worked out on the device
    that attaches, in the target's turned-not-scaled frame, to the mm); another bone keeps it where it is (`o` again).
    Picking the object it follows already changes nothing (its bone stays; *Whole model* is one of the bone choices).
  - Moved by hand (the grip, the arrows) it keeps following: at each write (and as it is let go) `p` and `o` are worked
    out from where it was put against the target as it is then. While it names a bone and its object's model is not on
    this device yet (still loading), only `p` is written (`measureNode`): an offset measured against the holder would be
    read against the bone everywhere else, so here it goes back to where its offset puts it. A model here that lacks the
    bone lacks it everywhere (the same file), so it is measured against the whole model, as everyone follows it.
  - An object sized here (its size steps, both grips, the arrows' size; not *Stand up* or *Turn*) scales the offsets of
    the sounds that follow it, bone or whole model, by the size's ratio since the change began, in the same change
    (`setObj`, `scaleFollowers`), so a sound at her mouth stays at her mouth. A record from the room carries the sounds'
    own records, so nothing is scaled when one is applied. Between writes (both grips write ten times a second; a size
    from the room glides in over 0.25 s) the object is shown at another size than its record's, and its followers'
    offsets are scaled by that ratio as they are placed (`followK`), so nothing slides off her meanwhile.
  - Switched to its GLB (`switchToGLB`, `s' = s / b`, `q' = q r^-1`): the sounds that follow its whole model (also those
    naming a bone its model lacks, which follow the whole model too) have their offsets turned by `r` (`o' = r o`) in the
    same change; on a bone they keep theirs (the GLB's bones stand where the
    original's did, to 1 mm, and a name the loader tidied is still found).
  - An object deleted: the sounds that follow it stay where they are, following nothing, in the same Undo step (Undo
    brings both back, following again). A sound duplicated follows the same (its offset nudged as the copy is, `o` + 0.5
    m in x); an object duplicated takes none of its sounds.
- **Hidden with its model.** A following sound is heard only while it and its object are both shown for you (the cubes,
  each person's own): its fade is its own times its object's (the 0.4 s fades), and with `start: 'shown'` it starts from
  its beginning each time that turns on (a voice line as she appears). The card and the Items pane say *hidden for you*
  by that. Not following: as before.
- **While editing** (each device's own): its speaker is drawn where it follows, with a faint line in its colour to the
  target's origin (over everything), and hovered or selected its labels name what it follows (*Voice → Dancer · Head*).
- **Shared rooms**: the record is the sound's field in `state()`, so following is shared as placing is; FORMAT
  `networks-30` (v112). No new key, no effect.
- **Untested on a headset**: how a voice at a moving head sounds through HRTF, the pick by trigger and the bone pages on
  a real panel, and the owner's own figures (only the bone names of the rigged one were checked, locally).

## Cut-outs (the owner, 4 November 2026)

The owner: "is it possible to remove parts of a glb model nondestructive? like a door in a wall etc?", then "for the
models i would just do parts that are hidden, which i can draw on the models or remove with boolean ops like a cube,
whatever is easier". A box was easier, and it is the only way for a scan: the owner's atelier is one mesh with one
material, so nothing in it can be hidden by name. A **cut-out** (*Cut-out box* on the Add pane) is a box placed over
part of one object's model: whatever of that model lies inside the box is not drawn, for everyone at the scene. The
model's file is never changed. The code: `engine/e6b_cuts.js` (record helpers, the per-frame step, the shader, the
edits), its look `LOOKS.cut` in `sets/looks.js`.

- **The record** (`layout.json`'s `cuts`, `state()`'s `x.<id>`): `{ name, on, p, q, size }`. `on` (required) is the id
  of the object it cuts, and cuts only that object. `p` (its middle), `q` (its turn: a full turn, so a slanted part can
  be cut) and `size` are in that object's frame **turned but not scaled** (metres), as a following sound's offset is: the
  box stands at the object's place plus the object's turn times `p` (times the object's size shown over its record's,
  `followK`, while both grips or a size from the room are on their way), turned by the object's turn times `q`. Checked as
  the other kinds are (`norm`): `on` not an id, `p` not three numbers within 1,000, `q` not four numbers (or of no
  length), `size` not three numbers: the record is bad; `p` to the mm, `q` normalised to 4 decimals, each side clamped to 1
  cm to 50 m and kept to the mm; `name` (60 characters, *Cut-out* by default); other fields ignored. `apply(state())`
  gives the same state back.
- **It follows its object.** Moved or turned (the arrows, the grip, *Turn 90°*, *Stand up*, *On the floor*, a record from
  the room), the object carries its cut-outs (they are in its frame). Sized here (its size steps, both grips, the arrows'
  size), the object scales its cut-outs' `p` and `size` by the size's ratio since the change began, in the same change
  (`setObj`, `scaleFollowers`, one Undo step), so a door stays a door; a record from the room carries the cut-outs' own
  records, so nothing is scaled when one is applied. Scaled past what a record takes, a value is held at the limit (a side
  at 1 cm or 50 m, a middle within 1 km), never refused, and the object's card says which cut-outs were held (`cutNote`:
  sizing back does not undo that, Undo does). Switched to its GLB (`switchToGLB`: `s' = s / b`, `q' = q r^-1`), its
  cut-outs are turned by the baked turn (`p' = r p`, `q' = r q`; sizes are metres, kept), so each hole stays where it
  was; `s'` is kept to 4 significant figures, so where `s / b` is not exact (`b` not a power of ten) the model is drawn
  `k = s' b / s` times its old size and its cut-outs' middles and sizes (and its sounds' offsets) are scaled by `k` in
  the same change. Deleted, its cut-outs go with it in the same step (Undo brings them all back); duplicated, its
  cut-outs are copied onto the copy (as many as the scene's 100 allows), each copy in every cube list its original is in
  (so a door a cube opens opens on the copy too). A cut-out whose object is not in the scene (a layout or a
  state from the room without it) is kept, cuts nothing and stands at its record in the scene's frame until the object is
  back; the card and the Items pane say so.
- **How it cuts** (the shader). Once an object has a cut-out its model's materials, lit and as scanned, each get a small
  addition (`cutPatch`, `onBeforeCompile`; every kind three.js has: Standard and Physical, Basic, Lambert, Phong, Toon,
  and the lines and points a model may hold): the vertex shader passes each vertex's place in the world, from three.js's
  own `transformed` after skinning and morphs (and the instance matrix), through `modelMatrix`; the fragment shader drops
  a fragment that lies within half a unit of the middle of any of the object's boxes on every axis, each box given as the
  first three rows of the inverse of its world matrix (`uniform vec4 cutM[48]`, three a box) and their count (`uniform int
  cutN`: a uniform, not a define). A model's first cut-out compiles its patched programs once (a moment's pause on a
  Quest, as the first switch of *Light* does; patching every model up front would change every model's shader for a
  pause only the first cut-out costs, so it is not done), and from then on a box added compiles nothing. One program for every patched material of a kind
  (`customProgramCacheKey`: the original's key and `|studio-cut-1`), its uniforms the object's own: every object's
  materials are its own clones (`libClone`), so two objects of one file never share a cut. The boxes are handed over as
  the first of the object's meshes is drawn each frame (`cutUpload`, from `onBeforeRender`, once the scene's matrices are
  that frame's: the scene moves in a headset), at most 16. A model with no cut-out keeps its materials as loaded; one
  that has had one keeps the addition (with a count of 0 once none are left) until it is built again. No extra pass, no
  change to its geometry, nothing written to its file. The hole's edges are open (you look into the thin surface): that
  is expected.
- **Limits**: 100 cut-outs in a scene, 16 on one object (the shader's array). Beyond them *Cut out a part*, *Cut-out
  box*, *Duplicate* and *Move onto another object...* are refused in words (*16 cut-outs on Wall: the most one model
  takes.*; *The scene has 100 cut-outs: the most it can hold.*). A layout or a room with more than 16 on one object (two
  people adding at once): of those cutting now the 16 with the lowest ids cut, the same on every device whatever order
  its items came in; the rest are drawn as cutting nothing (*· cuts nothing (16 at most)*, and their card says why).
- **Trigger cubes**: a cut-out is an item a cube can show or hide (its lists take it, the Items pane's ticks and *Pick
  what it shows* too). Hidden for you, it cuts nothing (the model whole); shown, it cuts; it switches as its own 0.4 s fade
  crosses one half (a cut cannot fade). A cut-out new here (made, put back by Undo, from the room, a scene opened) takes
  its state at once, with no half fade to wait for. A cut-out a cube shows waits for its cube, as any item: the owner's door, closed
  until you walk up to the wall.
- **Making one** (editing on, never with `&visit`, refused while the station's story is locked, as every edit): an
  object's card has *Cut-outs (n)* with *Cut out a part* and the list of its cut-outs; the Add pane's *Cut-out box* does
  the same for the selected model. The new box is 0.8 x 2 x 0.4 m, each side at most a fifth of the model's largest side as
  placed (`cutAt`), upright, its middle where the click or the trigger that selected the object met the model's own
  surface (that ray, `cutRay`, kept in the scene's frame by `pressItem`, not the pointer's path since; the model's
  triangles looked for once, as the button is pressed, as it is drawn now: a skinned mesh's where its bones put them,
  its rest pose's bounds set aside for that test, `modelHits`), its depth towards where that ray came from; with no such
  ray (or none that meets the model), at the model's middle facing you. It is selected.
- **Its card** (page and headset alike): *Cuts* (the object) and *Size*; *Move onto another object...* (a pick mode, as a
  sound's *Follow an object...*: the trigger or a click on an object, or the card's list; it keeps its place in the scene,
  re-expressed in the new object's frame; *Cancel*); *Size (5 cm a press)*, *x −* to *z +* (its middle stays); *Size,
  every side* (×0.5, ×0.9, ×1.1, ×2); *Turn 90°* (about its own upright: its width and depth trade places); *Preview (this
  device only, while editing)*, *As seen* (as the cubes say for you: the default), *Cut* (cut whatever the cubes say: a
  door a cube opens, sized with its hole in sight from anywhere) or *Whole* (the model drawn whole here); never shared,
  never saved, gone when editing goes off; *Duplicate* (a copy beside it on the same object, along its own width, in
  every cube list it is in); *Delete*. Every change one Undo step.
- **Drawn while editing** (`LOOKS.cut`): one warm red-orange for all cut-outs, its edges dashed (about seven dashes an
  edge) where they are seen, a solid tick a fifth of each edge long at every corner over everything (so a box inside a
  model still shows), a very faint fill, *✂ Door* over it (*· hidden for you*, *· hidden for you, previewed cut*, *· cut*,
  *· whole*, *· cuts nothing*, *· cuts nothing (16 at most)*), brighter when pointed at or selected, fainter while it cuts
  nothing; selected, a ball at each corner. The pointer (a click, a controller's ray) finds the nearest object, sound or
  cut-out, but passes over an object's unseen box when the ray goes on into one of that object's own cut-outs (it lies
  within that box, which would otherwise always be in front); a nearer object or sound is still found first. Picking the
  object a sound follows or a cut-out cuts, cut-outs are passed through. Not editing, nothing of it is drawn: only the
  hole.
- **Moving it**: on a page the arrows move it, turn it (in its own frame) and size it per side (W, E, R); in a headset
  the grip carries it (turning with the hand while free moving is on, else only about the upright), both grips size it
  (every side alike, a twentieth to twenty times) and move it with their middle, the grip on a corner of a selected one
  stretches it (the opposite corner stays, its turn kept, each side at least 1 cm). Let go, its record is written in its
  object's frame (`cutRecOf`).
- **Saving and sharing**: `layout.json`'s `cuts` (written always, `[]` when there are none; read when there), and one
  top-level field per cut-out in `state()`, `x.<id>`, so two people changing two cut-outs at once both keep theirs. This
  changed the state's shape: FORMAT `networks-31` (v113). Items from the room glide (0.25 s) in their object's frame, so a
  box moved elsewhere slides along its object. *Preview* and what a cube shows you are each device's own.
- **Tests**: the smoke test's *studio cuts* steps on the cuts test scene (`tools/studio/test/scenes/cuts/`: a wall with
  *Door*, which the cube *Doorway* shows, two boxes of one file, the first with a *Hole*, the dancer and the figure), and a
  step of `tools/collab.mjs --studio` ("Testing" in `AGENTS.md`).
- **Untested on a headset**: how the holes look on a Quest (the open edges, a scan's thin walls), the shader's cost on a
  Quest with a 400,000-triangle scan and 16 boxes, the grip, both grips and a corner on a real controller, and the one
  raycast against a big scan as the button is pressed (a moment on a laptop; longer on a Quest).

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
- `tools/studio/test/scenes/rig/` (about 35 KB): made by the same script: `dancer.glb` (a small skinned figure, two
  materials, its bones named in mixed conventions, Mixamo's *mixamorig:Head*, 3ds Max's *Bip01 L Hand*, Unreal's
  *foot_l*, and a 2 s clip, *Dance*, moving her head through about 0.7 m), copies of `box.glb`, `figure.fbx` and
  `figure.png`, a short `voice.wav`, and a `layout.json` with *Voice* following her head by an FBX's name for it
  (*mixamorig:Head*), and a cube (*Curtain*) that hides her. The smoke test's *studio follow* steps and `tools/collab.mjs
  --studio`'s step for it: "Testing" in `AGENTS.md`.
- `tools/studio/test/scenes/cuts/` (about 30 KB): made by the same script: `wall.obj` and `wall.mtl` (a wall 3 m wide,
  2.4 m high, 20 cm thick), copies of `dancer.glb`, `box.glb`, `figure.fbx` and `figure.png`, and a `layout.json` with
  the wall and its cut-out *Door* (shown by the cube *Doorway* in front of it), two boxes of one file (*Box A* with a
  cut-out *Hole* in a corner, *Box B* whole), the dancer and the figure. The smoke test's *studio cuts* steps and
  `tools/collab.mjs --studio`'s step for cut-outs: "Testing" in `AGENTS.md`.
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

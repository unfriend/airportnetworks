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
- Textures a file names but does not hold are looked for in the scene's listing by their base name (case-insensitive;
  the FBX's full path from the author's computer, `C:\Users\...\x.png`, is ignored), through the URL modifier. One not
  found: the model shows untextured and its card says *Missing texture x.png: put it in the scene's folder*.
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

## Tests

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
- `node relay/test.mjs` (a scenes section): every endpoint above, listing rules, types, ETag and 304, ranges, traversal
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

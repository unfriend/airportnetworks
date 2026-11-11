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
  a *trigger cube*, a *sound* (an emitter), a *cut-out* (a box that hides the part of one object's model inside it:
  "Cut-outs" below) or a *group* (objects, sounds and cubes that move together: "Groups" below).
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
  `'image'` (`.png .jpg .jpeg .webp .gif .tga .bmp`), `'data'` (`.bin`), `'preview'` (v120: a model's picture,
  `previews/<the model's path>.jpg`: "Pictures in the Add pane" below; anything else under `previews/` is `'other'`),
  else `'other'`; sorted by path; at most 2,000 (past that, `previews/` is left out first, then `originals/`).
  `layout` is the parsed `layout.json` (or `null`), `layoutAt` its time.
- `GET /scenes/<name>/<path>` -> the file, its type by extension (`.glb` `model/gltf-binary`, `.gltf`
  `model/gltf+json`, `.fbx` `application/octet-stream`, the usual for images and sounds), `ETag` from size and time,
  `Cache-Control: no-cache`, `304` when it matches, byte ranges for sounds. Paths decoded once; `..`, backslashes, NUL
  and anything resolving (symlinks too) outside the scene's folder refused (404, logged without the path's query).
- `POST /api/scenes/<name>/layout` with the layout as JSON (at most 2 MB; it must be an object with `studio: 1`) ->
  writes `layout.json` (to a temporary file, then renamed) after moving the old one to
  `.history/layout-<ISO time>.json` (the newest 20 kept) -> `{ ok: true, at, bytes }`. Refused with 403 `{ error }`
  when saving is off (`--scenes-readonly`), 404 for no such scene, 413 too big, 400 not a layout.
- `POST /api/scenes/<name>/copy` with `{ from, path, as, replace }` (`as` and `replace` optional; v118) -> one file of
  another scene (`from`, its `path` there) copied into this one at `as` (else the same path) -> `{ ok, path, bytes, at }`,
  as an upload answers, and the watch told at once. The source: a file the scene `from` lists (not its `layout.json` or
  `files.json`, no dot files or `.history/`; a link out of its folder is no file: 404), at most `--max-upload`; where it
  goes: by an upload's rules (`relay/scenes.mjs`, `uploadPath`: models, sounds, pictures and data anywhere, any other kind
  only under `originals/`), 409 when a file is there unless `replace: true`, 507 when the scene is full. A folder's copy
  is written to a temporary dot file beside where it goes and put in place whole; R2's is the bucket's own CopyObject
  (signed with its `x-amz-copy-source`: nothing passes through the relay; the bucket is not asked to refuse an object
  there, so of two copies to one new name at once the second may replace the first). Refused: 403 `--scenes-readonly`,
  404 no such scene (either) or file, 400 a bad body, a source no listing shows, a target an upload may not have, the
  file onto itself, 413 over `--max-upload`; behind the password as every scene endpoint.
- `GET /api/scenes/watch` (`?token=`) -> Server-Sent Events: `hello` `{ scenes }`, then `scene` `{ name, path, kind,
  gone }` when a file is added, changed or removed (a moment after it settles: about 0.5 s with no further change;
  never for `.history/` or temporary files), `layout` `{ name, at }` when `layout.json` changes, a comment every 20 s.
  Found by looking at the folder every 2 s while anyone listens (no `fs.watch`: it differs by system).
- CORS as the API's (a page on another origin, as GitHub Pages with `&relay=`): the preflight allows `Authorization`,
  `Content-Type` and `POST`.
- `/api/ping` says `scenes: true` when it serves scenes.
- The service worker never caches `/scenes/` (it passes it through, as it does `/api/`).

### From an R2 bucket behind the relay (v114)

`node relay/server.mjs --scenes r2`, the bucket and its keys from the environment (`relay/README.md`, "Scenes in
Cloudflare R2"): the same endpoints, rules and answers, plus `store: 'r2'`, `direct` and `linkTtl` in `GET /api/scenes`
and a signed link, `url`, for each file in `GET /api/scenes/<name>` (with `linkTtl`, its life in seconds, 12 hours by
default). The page keeps each file's `url` (`setFiles`) and `fileUrl` gives it, so every file (models, textures,
sounds, a streamed sound's element, the converter's reads) comes straight from the bucket, from the page's own origin,
with no password in it; the listing is read again once half of `linkTtl` has passed by the wall clock (looked at every
minute, `linksSoon`; when the page shows again; by `fileUrl` and before `call` fetches a signed link: `linksFresh`), and
once more when the bucket refuses a link (403 or no answer: `call` reads the listing and fetches the file again by its
new link, `linksAgain`; a streamed sound's element that fails is made again 2 s later), so a device that slept past its
links (a headset taken off for the night) gets new ones as it wakes (`engine/e7c_direct.js`). With `direct`, an upload to `.../file` (the Upload pane, Convert to GLB, the texture buttons:
`upSend`) goes straight into the bucket instead (`upDirect`: `POST .../put?path=&size=[&replace=1]` gives `{ url,
headers }`, a PUT there with exactly those headers and its progress, then `POST .../done?path=&size=`; the answers as an
upload's: `{ ok, path, bytes, at }`, 409 for a name taken; a PUT the bucket refuses (no answer, as with no CORS rule,
or 400, 403, 501), or `.../put` answering 501, sends that file through the relay instead, and every one after it on
this page, `directOff`; through the relay an upload waits while the relay answers 429, `upVia`), and a long sound for the relay's `ffmpeg` is sent as its
original first (into `originals/`, straight into the bucket), then made MP3 from it there (`.../sound?from=<path>`).
`GET /scenes/<name>/<path>` still works (a 302 to a signed link) for plain links and older studios.

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
password: the loaders (through their `LoadingManager`'s `setURLModifier`) and sound elements, which cannot send a
header, with `?token=` in a file's address, every other fetch (the converter's, a GLB's record, decoded sounds) and the
API's JSON with `Authorization: Bearer`; a file of an R2 relay by its signed link, which needs no password (one without
a link there by `?token=`, since a header is dropped after the redirect to another origin). A changed file (the watch's `scene` event) is fetched
again and its items rebuilt in place;
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
      "light": "scan", "clip": "", "anim": "loop", "start": "always", "faces": "both" },
    { "id": "f4n001", "name": "Fan", "file": "models/fan.glb", "p": [2, 2.4, -1], "q": [0, 0, 0, 1], "s": 1,
      "light": "lit", "clip": "", "anim": "loop", "start": "always", "tint": "#ffb43b", "bright": 1.25,
      "motion": { "kind": "spin", "speed": 30, "amount": 0, "axis": "y", "start": "always" } }
  ],
  "cubes": [
    { "id": "c81mzt", "name": "Doorway", "p": [1.2, 1, -2], "yaw": 0, "size": [1.2, 2, 1.2], "mode": "while",
      "show": ["k3f9qa", "s0ab12"], "hide": [] },
    { "id": "n1ght0", "name": "Night", "p": [-2, 1, -1], "yaw": 0, "size": [1.2, 2, 1.2], "mode": "stay", "show": [], "hide": [],
      "tex": [{ "on": "k3f9qa", "mat": 0, "slot": "map", "file": "pictures/atelier-night.jpg" }] },
    { "id": "w4ve00", "name": "Greeting", "p": [0, 1, -3], "yaw": 0, "size": [1.2, 2, 1.2], "mode": "while", "show": [], "hide": [],
      "plays": [{ "on": "f4n001", "what": "motion", "how": "loop" }, { "on": "s0ab12", "what": "sound", "how": "once" },
        { "on": "s0ab12", "what": "sound", "how": "stop", "when": "leave" }] }
  ],
  "sounds": [
    { "id": "s0ab12", "name": "Birds", "file": "sounds/birds.mp3", "p": [0, 2, -3], "vol": 0.8, "r": 1.5,
      "loop": true, "start": "always" },
    { "id": "v7kq2m", "name": "Voice", "file": "sounds/voice.wav", "p": [0.4, 1.7, -2.6], "vol": 1, "r": 1,
      "loop": true, "start": "shown", "on": "k3f9qa", "bone": "mixamorigHead", "o": [0, -0.03, 0.14] }
  ],
  "cuts": [
    { "id": "d0or01", "name": "Door", "on": "k3f9qa", "p": [1.6, 1, -3.55], "q": [0, 0, 0, 1], "size": [0.8, 2, 0.4] }
  ],
  "groups": [
    { "id": "g7lamp", "name": "Lamp", "items": ["s0ab12", "c81mzt"], "locked": true }
  ],
  "shapes": [
    { "id": "t4ble1", "name": "Table", "shape": "cube", "p": [0, 0.375, -1.5], "q": [0, 0, 0, 1], "size": [1.6, 0.75, 0.8],
      "colour": "#c9d1dc", "look": "hide", "locked": true },
    { "id": "cupl1d", "name": "Lid", "shape": "cylinder", "p": [0.4, 0.8, -1.4], "q": [0, 0, 0, 1], "size": [0.1, 0.02, 0.1],
      "colour": "#ffb43b", "look": "colour", "trk": { "id": "LHR-1A2B3C4D", "o": [0, 0.06, 0], "q": [0, 0, 0, 1] } },
    { "id": "p0ster", "name": "Poster", "shape": "plane", "p": [0, 1.5, -2], "q": [0, 0, 0, 1], "size": [0.6, 0.8, 0.01],
      "colour": "#5aa9ff", "look": "colour", "behaviour": { "kind": "wall", "at": "direction" }, "shows": "ar" }
  ],
  "empties": [
    { "id": "mid4ir", "name": "Mid-air", "p": [0.5, 2.2, -2], "q": [0, 0, 0, 1],
      "path": { "k": [[0, 0, 0, 0, 0, 0, 0, 1], [1.5, 0.6, 0.2, 0, 0, 0.3827, 0, 0.9239], [3, 1.2, 0, -0.4, 0, 0.7071, 0, 0.7071]],
        "play": "bounce", "start": "always", "speed": 1 } }
  ],
  "settings": { "others": "hidden", "real": "device" }
}
```

- Coordinates: metres in the scene's frame: the floor at y = 0, +y up; at a station in a shared room the room's frame
  (v125: the room's origin and axes, on a room calibrated on its floor spots spot A and x towards spot B; until v124 the
  circle's spot, facing its way), outside a room where you stood when the studio opened (or the anchored place), -z the
  way you faced. `p` to the mm
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
- A sound's `sync`, `skip` and `len` (optional, kept only when set, v125; "A voice with the movement" under "Recorded
  paths"): `sync` the id of the item whose recorded path it plays with, `skip` the seconds into its file where that path's
  start is (-10 to 600, to the ms; 0 is none; negative: it starts that much after the path), `len` where it ends in that
  path's own time (seconds, to 600, to the ms: its file's end, `dur - skip`, at most the path's end). A `skip` or a `len` without `sync` is dropped; with `sync`, a `sync` that is not an id, a
  `skip` that is not a number or a `len` that is not a positive number makes the record bad.
- A cut-out's `on` (required: the id of the object it cuts), `p`, `q` and `size` ("Cut-outs" below): in that object's
  frame, turned but not scaled (metres), `p` to the mm, `q` a full turn (4 decimals), each side 1 cm to 50 m to the mm.
  A layout without `cuts` (v112's) reads as before.
- An object's `faces` (optional, kept only when set: `'both'` or `'inside'`; `null` reads as absent; "Faces" below). A
  group's `name` and `items` (its members' ids: this layout's objects, sounds and cubes only; one left with fewer than 2
  is dropped and counted; "Groups" below). A group naming fewer than 2 of the items placed (one picking its members now)
  is not written (nor kept in the draft, nor counted by *Unsaved changes*), so a saved layout reads back as it was saved.
  A layout without `groups` (v113's) reads as before.
- A shape's `shape` (`'cube'`, `'sphere'`, `'cylinder'` or `'plane'`), `q` a full turn, `size` per axis (1 cm to 100 m, to the
  mm; a plane's z kept, unused), `colour` (`#rrggbb`, kept lower case) and `look` (`'colour'` or `'hide'`); an empty's `p` and
  `q` ("Shapes and empties" below). Any item's or group's `locked` (kept only when `true`; `false` or `null` read as absent,
  anything else makes the record bad; "Locked in place" below). The scene's `settings`: `{ others: 'shown' | 'hidden', real:
  'device' | 'always' | 'never' }` ("The scene's settings" below; absent: `shown` and `device`; a bad one is counted and read
  so). A layout without `shapes`, `empties` or `settings` (v118's) reads as before. A group's `items` may name shapes and empties.
- An object's, a shape's or an empty's `behaviour` (optional, kept only when set; "Behaviours" below): `{ kind, who,
  range, dist, speed, area, target, side, face }` with only the fields its `kind` uses (`'look'`: `who`, `range`;
  `'follow'`: `who`, `range`, `dist`, `speed`, and optional `side` (v127) and `face` (v128); `'avoid'`: `who`, `range`,
  `dist`, `speed` and `area`; `'item'`: `target`, `speed` and optional `face` (v128)), the rest taking their defaults when
  left out; `null` reads as absent, anything else that is not such a behaviour makes the record bad. A layout without it
  (v119's) reads as before.
- An object's, a shape's or an empty's `motion` (optional, kept only when set; "Motions" below): `{ kind, speed, amount,
  axis, start }`, `kind` one of `'spin'`, `'wobble'`, `'bob'`, `'pulse'`, `'orbit'` and `'sway'` (required), the rest taking
  the kind's own when left out; `null` reads as absent, anything else that is not such a motion makes the record bad. A
  layout without it (v119's) reads as before.
- An object's, a shape's, an empty's or a sound's `path` (optional, kept only when set; "Recorded paths" below): `{ k, play,
  start, speed }`, `k` 2 to 600 keys `[t, dx, dy, dz, qx, qy, qz, qw]` (the first `t` 0, strictly increasing, the last at
  most 120), `play` `'loop'` (the default), `'once'` or `'bounce'`, `start` `'always'` (the default) or `'shown'`, `speed`
  0.25 to 4 (1 by default); or, for a recording kept as a file of the scene (v125), `{ src, len, n, play, start, speed }`:
  `src` its file, a path under `recordings/` ending in `.json` (the listing's rules), `len` its length (more than 0 to 600
  s, to the ms), `n` its keys (an integer, 2 to 40,000), and no `k`. `null` reads as absent, anything else that is not such
  a path makes the record bad, and an item whose path would take the layout's paths past 6,000 keys (those in records: a
  file's keys are not counted) is dropped and counted. A layout without it reads as before.
- A cube's `tex` (optional, kept only when it has an entry, v124; "Trigger cubes that change textures" below): at most 16
  entries `{ on, mat, slot, file }`, `on` an object's id, `mat` an integer 0 to 255 (the material's index as Change
  texture lists the object's materials), `slot` one of `'map'`, `'normalMap'`, `'roughnessMap'`, `'metalnessMap'`,
  `'aoMap'`, `'emissiveMap'`, `'alphaMap'`, `file` a picture of the scene (a path in its listing with a picture's
  extension). An entry that is not one is dropped, and so is a second one for the same object, material and slot; a
  `tex` that is not a list (and not `null`, read as absent) makes the cube bad. Read from a layout, the dropped entries
  are counted (*3 of the trigger cubes' texture changes in layout.json could not be read*), and an entry for an object
  the layout does not hold is dropped as the cube's lists drop such ids. A layout without it reads as before.
- A cube's `plays` (optional, kept only when it has an entry, v136; "Trigger cubes that start things" below): at most 16
  entries `{ on, what, clip, how, when }` in that order, `on` an item's id, `what` one of `'clip'` (an object's animation,
  named in `clip`: a string of at most 120 characters, required but for a stop, dropped on a stop), `'sound'` (a sound),
  `'path'` (an object's, a shape's, an empty's or a sound's recorded path) or `'motion'` (an object's, a shape's or an
  empty's motion); `how` one of `'once'` (the default, always written), `'loop'`, `'hold'` (a clip or a path only) or
  `'stop'`; `when` `'leave'` (once and stop only; absent, `null` or `'enter'`: as you walk in, not written). An entry that
  is not one is dropped, and so is a second for the same item, what and moment (`on`, `what`, `when`); a `plays` that is
  not a list (and not `null`, read as absent) makes the cube bad. Read from a layout, the dropped entries are counted (*3
  of the trigger cubes' starts in layout.json could not be read*), and an entry naming an item the layout does not hold,
  or one of a kind its what cannot start, is dropped. A layout without it reads as before.
- Limits: 300 objects, 100 cubes, 60 sounds, 100 cut-outs (and 16 on one object: "Cut-outs"), 50 groups, 200 shapes, 100
  empties; a `file` is a path in the scene's listing (at most 200 characters, no
  `..`); a list of ids in a cube only names items of this scene (others dropped when read). A sound that follows an
  object the layout does not hold keeps its `on`, `bone` and `o` and stands at its `p` until that object is back, as with
  a state from the room (so a save made meanwhile never loses what it followed); a cut-out whose object the layout does not
hold is kept the same way, and cuts nothing until that object is back. Anything else in a read layout is
  ignored; a bad item is dropped and said once (*2 items in layout.json could not be read*).

## Trigger cubes

- Each person's own (unless it works for everyone here, v137: "Cubes for everyone" below): a cube is *active for you* while your head is inside it (the headset's head; on a page the
  camera's place in Walk view, else nobody: the orbit camera never triggers). Never shared, never in `state()`: ten
  headsets each see what their own place reveals.
- `mode`: `'while'` (active while you are inside) or `'stay'` (once you have been inside it stays active for you until
  the scene is opened again or *Reset what I have seen* is pressed).
- `show` and `hide`: any number of objects and sounds each. For an item: the cubes now active for you that list it in
  `show` (S) and in `hide` (H). Shown if S has any and H none; hidden if H has any and S none; both: the one entered most
  recently decides (a `'stay'` cube walked into again counts as entered again, v117). Neither: hidden if any cube lists it in `show` (it waits for its cube), else shown.
- Shown and hidden fade over 0.4 s (opacity, then `visible` off; a sound's gain). An object shown with `start:
  'shown'` starts its animation from the beginning; a sound with `start: 'shown'` plays from the start each time it is
  shown, and stops (fading) when hidden. Items in no list are unaffected.
- While editing: every cube is drawn as its edges and its name over it (v131: no walls, "cubes that hide things need no
  walls"; the edges opaque, in its own colour while you are inside it, lighter pointed at or selected, else darker; an
  unseen box both ways round where its fill was, `material.visible` false, so the pointer finds it from outside and from
  inside, its corners and the grips as before), lines from a selected cube to what it shows (green) and hides (red); a
  model or a coloured shape a cube now hides from you is not drawn at all but shown by its unseen box's edges (a shape:
  its own edges) and its tag with *· hidden*, still picked and carried, drawn whole while this device holds it ("Nothing
  see-through while editing" under "Editing"; until v130 it was drawn faint, at 0.3); sounds play as a visitor would hear
  them. Not editing: cubes and sound markers are not drawn at all.

## Cubes for everyone (the owner, 11 November 2026)

The owner: "Trigger cube starts are each person's own, the same as how cubes already show and hide things. THIS MIGHT NEED A
SWITCH FOR BOTH OPTIONS if possible, so it should also be possible to have a cube that triggers things for everyone in the
same studio scene". `triggerStep` in `engine/e6_items.js`, `trgFire` in `engine/e6n_plays.js`.

- **The record**: a cube's `all: true` (kept only when set; absent, `false` or `null`: each person's own, as before;
  anything else makes the record bad). In `layout.json` and `state()` alike: FORMAT networks-43 (an older device would
  drop it).
- **Active**: for every device at the station while any person's head is inside it: the heads the behaviours react to
  (`behHeads`: the people in a headset at its circle, from `HOST.collab.heads()`, this device's own among them; pages
  never count; outside a room this device's own head, or a page's camera in Walk view). A `'stay'` one stays active from
  the first time any head was inside (each device's memory, as for each person's cubes: *Reset what I have seen* and the
  lobby clear it).
- **What follows it**: everything the cube does (what it shows and hides, its texture changes, what it starts), so a
  shared cube shows things to everyone and starts its clips, sounds, paths and motions for everyone, in step.
- **In step**: its entering and leaving are taken in the room's time from the head samples' own time stamps (`h.ts`: the
  presence sample of each head): entered at the earliest sample of the heads inside it now, left at the latest sample of
  the heads that were inside it (a head gone from the list: left now). Outside a room this device's clock (`behNow`). On
  the clock of what cubes start (`trgClock`) these are `c.inT` and `c.outT` (the room moment less how far that clock is
  behind the room's), so every device puts a run's start, and its 0.3 s leave (`PLAY_EDGE`), at the same room moment and
  plays the same phase. Devices agree within about one presence sample (15 a second): the device whose head it is uses
  its own head now, the others its first sample inside.
- **Entered last** (show and hide, texture changes): decided alike on every device, by the entry time (the room's: an
  everyone cube's entry moment; each person's own cube this device's moment, kept after the last one given so two entered
  one after the other keep their order), then by the cube's id (`enteredLater`). Until v137 a counter on each device.
- **Nothing sent**: each device works it out from the heads it has. A device away from its station sees nothing of the
  scene, as ever.
- **Its card** (page and headset): *Works for: Each person / Everyone here* (one Undo step each) and a line saying what it
  means; the card's heading and the Items card say *for everyone here*; a row of what it starts says *playing* (not *for
  you*).
- **For tests**: `STUDIO.cube(id)` (`{ all, inside, act, since, inT, outT, who }`), `BEH.fake` (pretend heads with `ts`),
  `behNow` and `trgClock` held by the test.
- **Untested on headsets**: everyone cubes across real headsets at a circle (how in step their runs look over Wi-Fi, a
  head entering at a cube's face, many heads in and out).

## AR or VR only (the owner, 11 November 2026)

For a room built as a studio scene (another lane's XP room): its elements "detached and mapped onto the room". `shownHere`
and `sessKind` in `engine/e6_items.js`.

- **The record**: an object's, a sound's, a shape's or an empty's `shows: 'ar' | 'vr'` (kept only when set; absent or
  `null`: both; anything else makes the record bad; a cube's or a cut-out's is ignored). FORMAT networks-43.
- **Shown**: in an AR session (passthrough: the studio's `!XR.clear`) an item with `shows: 'vr'` is not shown (not drawn,
  silent, not pointed at), in a VR session one with `shows: 'ar'`; on a page (no session) what VR shows. On top of what
  the cubes say: an item for the other kind of session is never shown, whatever a cube says.
- **While editing**: one not shown for that reason is drawn as a hidden item already is (its unseen box's edges, a
  shape's own edges, and its tag with *· VR only* or *· AR only* in place of *· hidden*), still pointed at, selected and
  carried; its card's heading says *only in AR: not shown here* (or VR), the Items card *only in AR*.
- **Its card** (page and headset, every object, sound, shape and empty): *Shows in: AR and VR / Only AR / Only VR* (one
  Undo step each) and a line saying what it does.
- **For tests**: `STUDIO.sess(k)` pretends a session's kind (`'ar'`, `'vr'`, `''` as it is).

## Trigger cubes that change textures (the owner, 8 November 2026)

The owner: "trigger cube replace texture mode so that it can replace a texture on a model in the scene", then "no
crossfade needed". `tools/studio/engine/e6i_tex.js`.

- **What it does.** A cube's `tex` entries put a picture of the scene in one slot of one material of an object while the
  cube is active for you (inside it, or a `stay` cube once entered): for each object, material and slot, of the active
  cubes' entries the one from the cube entered last wins (the rule of `show` and `hide`, by when each was entered); with
  none active the object's own picture is back. A switch, no fade. Each person's own, as everything a cube does: only the
  cube's record goes to the room. As scanned shows only a colour picture (`map`); the other slots apply when lit (and a
  slot its kind of material does not have, a Phong material's roughness or metalness, does nothing). Reset what I have
  seen and the lobby give the own pictures back (they forget what was entered). Models only (an object's id).
- **On the object's own materials** (its clones, `libClone`, lit and as scanned): another object of the same file never
  changes with it. What each material had is kept and put back (the slot, and the factors a picture changes: roughness and
  metalness set to 1, a black glow made white, an opacity picture making it see-through), as Change texture's preview
  does. A material as scanned made while a cube's picture is on is made from the object's own pictures (`applyLight` puts
  them back first; the cube's go on again in the same frame).
- **The pictures** are read as the scene opens or an entry arrives (`CONV.picture`, as Change texture reads them: TIFF,
  PSD and DDS too), drawn down to 2,048 px (or `&maxtex=` when lower), once per file, and sent to the GPU then
  (`renderer.initTexture`), in each flip the objects need (a glTF's pictures are not flipped, the other loaders' are), so
  the switch shows the picture in the same frame. Kept by the scene's opening and the file's time (a picture changed on the
  relay is read again); freed when no entry names it.
- **Previews win.** While Change texture or Fewer triangles is open on an object, the cubes put nothing on it (its own
  pictures go back as either opens); once it closes, the cubes' state applies again.
- **Editing** (the cube's card, page and headset alike; not for a visitor, `&visit`, nor with editing off; a cube locked in
  place takes them as it takes its lists): *Changes textures*, one row per entry (*Box · Colour → paint.png*, the
  material's name too when the object has several): a press flashes the object in amber for 1.6 s (green and red are the
  lists'), ✕ takes it off (one Undo step). *Change a texture...* picks the object (pointing at it in the scene, the trigger
  or a click, or the card's list of objects), then its material (a list, when it has more than one), the slot (Colour,
  Normal, Roughness, Metalness, Occlusion, Glow, Opacity; Colour first) and a picture (the scene's pictures as Change
  texture lists them, likeliest first; a headset eight at a time): the entry is added, one Undo step (one already there for
  that object, material and slot is replaced). *Another object...* goes back a step, *Cancel* ends it (as do Escape,
  another selection and editing off). A selected cube's lines run amber to what it changes the pictures of. The Items
  pane's cube card says *Cube · shows 2, hides 1, textures 1*.
- **Copies and deletions.** Deleting an object takes its entries out of every cube in the same step (Undo brings them
  back). Duplicating an object adds, in every cube, an entry for the copy beside each of the original's; duplicating a cube
  copies its entries; a group's copy: a cube of the group puts its pictures on the copies of the group's objects, a cube
  outside it gains entries for them beside the originals' (16 a cube kept: the copies' past that are left out).
- **A GLB switch** (Convert to GLB, Fewer triangles' and Change texture's Save) keeps the entries: the object keeps its id.
  The converter keeps the materials in their order where it was tried (the test scene's figure), but glTF may list the
  parts of a mesh with several materials in another order; so the conversion says how its materials came out (`toGLB`'s `mats`, by name and their meshes' names, and
  the original's, `texMatsOf`) and each entry's material is found again in the GLB (`texRemap`: by its meshes' names and its
  own name, else its meshes', else a name only it has, else the same place when there are as many), in the switch's change.
  *Switch to the GLB* on a card (a GLB made earlier) has no such word: the entries keep their index there.
- **Shared rooms.** `c.<id>` carries `tex` as `layout.json` does; FORMAT `networks-36` (v124: an older device would strip
  the field and write the cube back).
- Untested on a headset: how the switch looks on a Quest, the memory with many 2,048 px pictures there.

## Trigger cubes that start things (the owner, 11 November 2026)

The owner: "Trigger cube should also be able to trigger things like an animation or a soundfile being played on a
character or prop". `tools/studio/engine/e6n_plays.js`.

- **What it does.** A cube's `plays` entries start something on an item as you walk into the cube (or, `when: 'leave'`,
  as you walk out): an object's animation (`clip`, by name), a sound, a recorded path or a motion. `once`: from its start to
  its end, even after you leave. `loop`: again and again while the cube is active for you (a while cube until you have
  left it; a stay cube from then on), then it comes off. `hold` (a clip or a path): once to its end, held there while the
  cube is active, then it comes off. `stop`: ends the run on that item now, whatever started it; nothing new starts.
- **Each person's own**, as everything a cube does: a start is this device's (a headset's head, a page's camera in Walk
  view); nothing is sent and nothing stored but the cube's record (`c.<id>` with `plays`). Ten visitors each get the wave
  as they walk up, and nobody's walking in restarts it under another; two side by side may see it at different moments.
- **When an entry fires.** As its cube is entered: each time (a stay cube walked into again too), and also when your head
  is inside as the scene opens, the cube appears or the entry is added (so an entry added while you stand in its cube
  plays at once). As it is left, for `when: 'leave'`. Both edges debounced 0.3 s (`PLAY_EDGE`): you count as having left
  once your head has been out of the cube for 0.3 s (and the moment you left is that moment), and coming back in within
  that is no new entry, so a head on a cube's face never restarts a wave. Show and hide are not debounced (no scene
  changes).
- **Several cubes on one item.** For an item and what is started on it, the last start decides: it replaces the run under
  way. When a run ends nothing older comes back (an object's own animation is back; a sound, a path or a motion waits).
  This is unlike show and hide's rule of the active cubes: starts are events. The idle belongs in the object's own
  Animation row, the gestures in cubes.
- **How each comes off without a jump.**
  - A clip blends over the object's own animation (or, Animation Off, its rest pose) in and out over 0.3 s (`PLAY_BLEND`),
    on a layer of its own: an action of a clone of the clip (two kept per clip name), its weight w, the object's own
    animation getting 1 - w (three.js r128's weighted mix: at full weight the cube's clip is the whole pose, what it does
    not move at its rest). A new run on the object crossfades: the old clip frozen at its frame and fading out over 0.3 s
    while the new one comes in. A once fades out from its end; a loop and a hold from when they came off. When the last
    layer stops, three.js puts the rest pose back by itself. A clip the object lacks (a name from another file, or a model
    switched to a GLB that lost it) plays nothing: the card says so in amber, and the log once (`studio play missing`).
  - A sound starts from its start at its level at once (not faded in), decoded or streamed, looping for a loop only; one
    that came off fades out over 0.4 s (`PLAY_FADE`); a once is over at its end. A new run starts it again at once.
  - A path: once from its start to its end (there and back for Back and forth: its Plays says what one pass is), then it
    waits there; a loop that came off finishes the pass under way and waits at its end; a hold goes back along its path at
    its speed to its start; a once stopped stays where it is. It waits where its last run left it, at its start before any
    run; the next run starts from its start (a jump only if it was left at its end, as Start again does).
  - A motion (they are periodic): once is one period (60 / |speed| s); a loop that came off, or was stopped, finishes the
    period under way. A wobble or an orbit has its amount eased in and out over min(0.5 s, a quarter period), since those
    stand away from their place at a period's start (a spin, a sway, a bob and a pulse are at rest there).
- **What waits, and how it composes.** A sound, a path or a motion any cube's entry names waits until a cube starts it
  (silent; at its start or where its last run left it; at rest): its own Starts, and a sound's own Loop, no longer apply (a
  path's Plays still says what one pass is). An object's own animation goes on until a cube plays a clip over it (with
  Animation Off it stands still until then). Show and hide still decide what is seen and heard: a run on a hidden item
  goes on by its clock, unseen or silent, and shows mid-run when shown. Texture changes are independent. A sound that plays
  with a recorded path (`sync`) is no target (the entry is ignored, the card says to start the path); starting that path
  starts its voice with each run (`syncAt`: its pass `'r<n>:<k>'`), silent while the path waits or a hold goes back. What
  wins over a run: a timeline's hold while editing (its own clip, or a path's held moment, alone), Pause (every frame held,
  the layers too), a carry or what rests an item (paths and motions at their placed pose), a character worn with trackers
  (no clip plays). Editing on or the item selected, runs go on as motions do since v122.
- **Editing** (the cube's card, page and headset alike, `playCubeBlocks`; not for a visitor, `&visit`, nor with editing
  off; a cube locked in place still takes them, as its lists): *Starts*, one row per entry (*Dancer · Wave · once*,
  *Voice · the sound · loops while you are inside*, *Box · its recorded path · held while inside*, *Radio · stops · on
  leaving*; *· playing for you* while its run is the one on its item): a press flashes the item in blue for 1.6 s; *Try*
  fires it here now as if entered (this device's, no Undo step; a tried loop or hold comes off after 10 s, `PLAY_TRY`,
  unless its cube is active for you, or when pressed again, its label then *Stop*); ✕ takes it off (one Undo step); an
  amber line under one that cannot play now (*Box has no animation Wave now*, *Box has no recorded path*, *Voice plays with
  Box's recorded path: start the path instead*, *It names an item not in the scene*). *Start something...* picks the item
  (pointing at it in the scene, the trigger or a click, or the card's list of the items with something to start, each
  with what it offers: *animations: Spin, Bob · recorded path*), then what (its animations, a headset eight at a time;
  *Its recorded path*; *Its motion: Spin*; *The sound*), How (*Once*, *Loop*, *Hold*, *Stop*; Hold only for a clip or a
  path), When (*Walking in*, *Walking out*: once and stop only), *It will* in a sentence (*As you walk in, Box plays Lift
  once and holds its last frame while you are inside, then it stands still again.*) and *Add*, or *Replace* (in its
  place) for the same item, what and moment: one Undo step. *Another item...* goes back a step, *Cancel* ends it (as do
  Escape, another selection and editing off); one pick at a time with *Pick what it shows* and *Change a texture...*. A
  selected cube's lines run blue to what it starts; the Items pane's cube card says *Cube · shows 2, hides 1, starts 2*,
  and a target's faint line *started by a cube*; a target's card says which cube starts it and what waits.
- **Copies and deletions.** Deleting an item takes its entries out of every cube in the same step (Undo brings them
  back). Duplicating an object, a sound, a shape or an empty adds, in every cube, an entry for the copy beside each of the
  original's (16 a cube kept); duplicating a cube copies its entries; a group's copy: a cube of the group starts things on
  the copies of the group's items, a cube outside it gains entries for them beside the originals'. A GLB switch keeps them
  (the object keeps its id; its clips' names come through the converter). Opening the scene again forgets every run;
  *Reset what I have seen* and the lobby stop every run at once (a cube you stand in fires again the next frame).
- **Cost.** A scene whose cubes start nothing does two integer compares a frame and one bit test per item in animStep,
  emitStep, drawnPose and POSE.path (the entries are listed again only when the items change); with plays, a loop over the
  cubes that have them and the items with a run, one more animation action per playing clip (two during a 0.3 s
  crossfade), and a card drawn again only at a start or an end while that cube or item is selected.
- **For tests.** `STUDIO.plays(id)`: `{ log, on, item: { tgM, tr: { <what>: { cube, clip, how, when, at, off, try, n } },
  layers: [[clip, weight, time, fading]], pw, tg, trgLog } }`; the studio's clock for starts, `trgClock` (the tests set
  their own, as `recClock`). Logged (`HOST.collab.log`): `studio play` (one line a start) and `studio play missing`.
- **Shared rooms.** `c.<id>` carries `plays` as `layout.json` does; FORMAT `networks-42` (v136: an older device would strip
  the field and write the cube back).
- Untested on a headset: how a blended clip looks on a character there, the 0.3 s debounce with a real head, a voice
  started on entering through HRTF, a path's Hold going back, how a restart of a stay cube feels in a real room.

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
- While editing: a small speaker marker (a ball and cone in the sound's colour) and a thin ring on the floor at `r`
  (opaque since v131, darker than the speaker).
- A sound may follow an object or one of its bones ("Sounds that follow a model" below): it is placed, heard and shown
  where that puts it, and only while it and its object are both shown for you.

## Editing

Off by default; *Edit* in the Scene pane turns it on for this device (kept as `studioEdit`; never in `state()`).
Refused (greyed, *This scene is locked*) while the station's story is locked (`HOST.anchor.locked('globe')` at a
station; *Lock this story*), and not offered at all with `&visit`. Every change is recorded for *Undo* (this device's
last 30 changes; an undo writes the item's record as it was, or removes what was added, or puts back what was
deleted).

### Nothing see-through while editing (the owner, 10 November 2026)

"All transparent things are problematic when it comes to framerate in edit mode i feel, can we somehow reduce them? Like
ghosts for example can just be a light gray, rooms that are not currently shown because a cube hides them could just be
a empty square with a name? cubes that hide things need no walls too, same for walls that hide things, and the cutouts
can also be without walls". A see-through layer is drawn again over what is behind it; a room scan drawn faint was one
the size of the view, and a cube round you or a few large ones filled a headset's view several layers deep. So (v131)
every look the studio draws while editing is opaque (`tools/studio/sets/looks.js`): lines, small meshes and tags, lit up
by colour where they lit up by opacity. Trigger cubes, shapes that hide things and cut-outs their edges only (with an
unseen box or fill for the pointer), ghosts light grey ("The ghost, Pause and placing what moves"), a sound's speaker,
ring and line, an empty's cross, a group's dashed box, the selected and pointed-at outlines, a loading model's grey box
and the tags (`LOOKS.tag` and the pick ticks: an opaque band, drawn with the opaque things after the items, `renderOrder`
12, with no depth test, so still over everything they draw). Only an item's 1.6 s flash from a cube's card pulses
see-through (lines). Not editing, nothing changes: what a cube shows or hides fades over 0.4 s as before.

- **What a cube hides from you** (`it.hid`, set in `itemsStep` for models and shapes while editing): not drawn at all
  (a model's `visible` off, a shape's mesh), snapping (no fade through see-through), and shown instead by its unseen
  box's edges (`LOOKS.hidBox`: one shared opaque line material, a muted grey-blue; a shape its own edges) and its tag
  with *· hidden* (the owner: "do it like this", of an outline box with its name and "hidden", "and if i grab it it should
  show but just 100% not transparent"). Still pointed at, selected and carried through its unseen box (`pickables` and
  `insidePick` as before: its holder stays visible); its animation holds meanwhile. While this device holds it
  (`heldHere`: `it.carry`, which one grip, both grips, *Hold it*, the sticks while carried, the page's arrows on it or on
  its group and a group carried set, or its path being recorded) it is drawn whole, every material its own opacity,
  see-through and depth (`setObjAlpha(it, 1)`: while editing always), its edges hidden; let go, its edges again if a
  cube still hides it. A model still loading that a cube hides shows its grey box (opaque) with *· hidden*.
- **Triangles in space** (the owner: "In edit mode show triangle count per item next to its name in space", then "on
  every" model): while editing every placed model has a tag over its top (`modelTag`: `LOOKS.tag` in `GL.edit`, made the
  first time it shows, placed by `itemTopInto` each frame; its words built and its canvas drawn again only when its
  record, its count or whether it is hidden change), *Atelier · 397k ▲* (`kTris`; its lock mark by `tagName`), *·
  hidden* while a cube hides it from you; not while it is pointed at or selected, where the engine's labels say it
  (*object · 397k ▲*, *object · 397k ▲ · selected*; *· hidden* too). The count (`trisNow`): while Fewer triangles
  previews it, the preview's (`FT.pv.to`); built, its model's (`trisOf`, counted once per model: a GLB switch or a file
  changed on the relay counts again); not built yet, its file's (as read) or its GLB record's `n` as far as this page has
  read it (nothing is fetched for it), else no count. A shape's tag says its primitive's triangles. No layout,
  `state()` or `FORMAT` change.
- Untested on a headset: the frame-rate gain on a Quest (the shell's frame-rate read-out, a double press of B or Y, says
  the story's triangles, draw calls and code time: compare a scan hidden by a cube and a cube round you with v130), how
  the edges, the grey ghosts and the tags read life size, and the cost of a tag per model (a draw call each) in a scene of
  many models.


### Editing without the cost (the owner, 11 November 2026)

"The edit mode still has worse framerates than not editing, why?" Measured with a pretend headset through three.js's own
WebXR path on a scene of 40 items round a 400,000-triangle scan (the harness of the v136 diagnosis): viewing 2.9 ms of
script a frame, editing 7.6 to 14.7. Since v136 edit mode no longer does these every frame:
- **The labels made again.** The names of what is pointed at and what is selected (`labelSet`, `e3_story.js`) compared
  their two words with the three they keep, so they never matched: every frame with something pointed at or selected (in
  a room scan, every frame: the scan you stand in is pointed at) a new canvas, texture and sprite material, three.js
  linking a new shader program for it, and on a page the label's HTML written and laid out again. Now they are made again
  only when their words change (`L.key`).
- **The scene's matrices made again for each pick.** `rayPick` made the whole scene's world matrices on every call (twice
  a frame in a headset, just after `xrBegin` had). It now takes them as they are: a headset's picks come after `xrBegin`
  made them current, made again only when the other hand's press or carry moved something since (`XR.pickStale`); a
  page's pick, an event between frames, through `pagePick`, which makes them once.
- **The panel drawn whole as the ray moved.** The item pointed at in the scene was in the panel's signature (`sigMain`)
  though nothing on the panel shows it: every item the ray crossed drew the whole card again (1,024 x 1,200 px, 4.9 MB sent
  with its mipmaps). It is out. And when only the button pointed at changes (the same signature, `P.base`), only the
  rectangles of what it lights, before and after (`panelHover`: every button drawn with that id, `P.drawn`, and its
  regions, padded 8 px; near ones joined), are drawn again, each by the same draw as the whole card on a small canvas of
  its own clipped to it, put on the card's canvas and sent on its own (`panelPatch`, texSubImage2D, mipmaps once), as a
  timeline's bar is; most of the card lit (a Stories screen's card) draws it whole. The menu's Story tab draws the same
  texture, so it shows the patches too; the card's texture version does not change for them (`P.full`, `P.hovPatched`,
  `P.hovRects`, `P.patchPx` for tests).
- **The page's panes built in a headset.** `renderPanes` builds nothing while the headset presents (`X.dirty` stays set,
  `X.skipped` counts); the panes are built once the session ends.
- **A draw for every tag and line.** Every look keeps its own objects as before (where they are, shown or not, their
  colours: the engine and the tests read them), but the tags and lines are drawn together (`LOOKS.batch`, `BT` in
  `sets/looks.js`): each is marked (`userData.bt`, `LOOKS.batched`) and put on a layer no camera sees, and each time the
  scene is drawn (`GL.scene.onBeforeRender`, after three.js has made every matrix current, before it lists what to draw)
  the ones shown (`traverseVisible`) are gathered: every tag in one draw (their pictures on one canvas, `BT.atlas`, 2,048
  px wide in rows of 64 px, 512 to 4,096 px tall; a tag's picture drawn there and sent on its own when its words change; an
  instanced quad each, sized and turned to the eye as a sprite, back to front, over everything, its clear corners cut
  away), the lines in one draw a kind (in the scene's depth or over everything, by their order: cubes' and shapes' edges,
  hidden models' outlines, cut-outs' dashes (as their dashes) and ticks, groups' boxes, empties' crosses, sounds' lines,
  loading boxes, the ghosts' outlines and the selected and pointed-at outlines; each in its colour). On the heavy scene a
  headset frame's draws while editing went from 210 to 132 (viewing: 104), texture binds from 24 to 7. Left drawn one by
  one: the speakers (a ball and a cone), their rings, empties' dots, the corner balls of what is selected, the flash from
  a cube's card (it pulses see-through), the lines from a selected cube to its items (one draw already) and the two
  labels. `LOOKS.BT.stats` (`{ tags, lines, draws, uploads, grew }`) for tests.
- Nothing in a layout, `collab.state()` or `FORMAT` changes.
- Untested on a headset: the frame rate on a Quest (the shell's read-out: its draw calls and code time, editing against
  viewing), how the tags read drawn from one canvas (their smaller pictures at a distance), a hover patch's look and cost
  there (Chrome's GPU canvas, the copy and its mipmaps), and how much the draws saved are worth in its GPU process.

In a headset (editing on):
- Pointing at an item lights it and names it; the trigger (or a pinch) selects it (its card on the panel). Pointing at
  nothing and pressing clears the selection.
- From the inside (v118; the owner, 5 November 2026: "models should be able to be touched/moved from the inside"):
  when the ray finds nothing at all (no object, sound, cut-out or cube, nor a corner) and the controller is inside an
  object's unseen box (a room scan you stand in: its box's faces point away from you, so the ray meets none of them),
  that object is the one pointed at, the smallest such box if several (a figure standing in the scan); the dot sits
  where the ray leaves its box. So the trigger selects it and the grip carries it, as cubes have always worked; anything
  the ray does find wins, and it beats the floor (`rayPick(ray, { inside: true })`, `insidePick`). Inside a scan,
  pointing at nothing therefore selects the scan; the Items pane's card selected again clears the selection.
- *Hold it* (v118; a selected item's headset card, under *Carry it*, an object, cube, sound, cut-out or group): the next
  grip of either hand, wherever it points, carries that item as a grip on it would (from where it stands: it keeps its
  offset from the hand; a group as a whole), one Undo step; once, then disarmed (pressed again, another selection,
  editing off or the session's end disarm it too). Not at the shell's menu or a station (the shell takes those grips
  itself) or the studio's own panel (the grip moves the panel): it stays armed then. For a thing too big or too far to point at.
- Stick scrolling (v118; the owner: "on cards that overflow scrolling should work with the sticks up down"): a stick
  pushed up or down while its controller's ray is on the studio's panel (its own, or its copy on the menu's Story tab)
  scrolls the pane there when it is taller than the panel (up shows what is above): a dead zone of 0.2, then from 0.25
  to 1.6 of the pane's height a second the further it is pushed, a third of that speed at first and all of it after
  0.8 s held, stopped at either end as *Up* and *More* are (`stickScroll`, `X.scrollMax`). Nothing scrolls while something
  is carried (v120: the sticks steer what is carried, below). While a stick's ray is on the panel the left stick does not
  walk and the right stick does not turn (a turn held there waits for the stick to come back to the middle). The shell's
  own menu is not the studio's panel: pointing at it the sticks walk and turn as before.
- The grip carries an object or a sound (as the design room's miniatures: it keeps its offset from the hand and, with
  free moving on, turns with it; off, only about the vertical), and a cube (level; only its yaw turns). Both grips on an
  object size it (a twentieth to twenty times) and move it with their middle. A selected cube shows a ball at each of its
  8 corners: the grip on a corner stretches the cube (the opposite corner stays). Let go, it stays where it was put (its
  record written).
- The sticks while something is carried (v120; the owner, 6 November 2026: "Things in edit mode should be turnable and
  zoomable with the sticks once grabbed like the models in the stories"; "left stick up down is zoom, left stick right
  left is turn, right stick up down is move away, move to me, right stick left right is also turn for now"). Whichever hand
  carries it, by one hand (an item or a group; not a corner, and not while both hands hold it: both grips size it then):
  - the left stick up makes it larger and down smaller: twice the size in 1.5 s held fully (`HOLD.grow`, ln 2 / 1.5 a
    second), about its middle (an object's own box's middle; a shape's, a cube's and a cut-out's centre; a group's pivot),
    within what both grips and the size steps allow: a twentieth to twenty times its size as it was taken, and each
    record's own limits (an object a ten-thousandth to 10,000, a cube's side 5 cm to 100 m, a shape's 1 cm to 100 m, a
    cut-out's 1 cm to 50 m, a sound's reach, its full volume within, 10 cm to 20 m; an empty has no size). An object's
    cut-outs and the sounds following it keep their place on it as it is sized (`scaleFollowers`, as both grips);
  - left and right on the left stick turn it about the scene's vertical through its middle (a group about its pivot), 90
    degrees a second held fully: pushed right, its near side goes right (anticlockwise seen from above); a cube stays level;
    a sound has no turn;
  - the right stick up pushes it away along the line from the hand and down pulls it in (its reach, 0.15 to 8 times, 1.5
    a second as before, now on the right stick whichever hand carries it); left and right turn it as the left stick does.
  A hand that carries something else steers that with its own stick only; both sticks act on one thing otherwise. A dead
  zone of 0.2, then the rate rises with the push (its square, all of it pushed fully). It is part of the carry: the size,
  turn and push are shown at once and written with the carry's records (ten times a second and as it is let go), one Undo
  step for the whole carry; a locked item is refused as the grip is, so the sticks never reach it. While something is
  carried the VR stick walk and turn do nothing (as before) and the panel does not scroll. The headset's card says it under
  *Carry it* (`holdBlocks`). Untested on a headset: how the rates feel on real sticks.
- In VR (not passthrough) the left stick walks you through the scene and the right stick turns you 30 degrees a flick,
  while nothing is carried (`XR.lifeOff` style: the scene moves, not the rig; per device, reset by Recenter; never
  written to the room). In AR you walk for real.
- Two stick modes (v125; the owner, 8 November 2026: "i want stick movement in studio mode too, just make it switchable
  with the double stick click so that i can switch between the two modes of stick operation in studio mode"). A stick
  clicked twice (the shell's moving with the sticks, `HOST.xr.walk`, the same setting as in every story, VR only) switches
  between the studio's own sticks above (walk and turn with nothing carried, steer what is carried, scroll the pane under
  the ray) and moving you: the left stick along the floor where the head faces (1.5 m/s at full push, a dead zone of
  0.2, the push's square), the right stick 30 degrees about the head a flick past 0.6 (again once back under 0.3),
  wherever the ray is and also while something is carried, which stays in the hand and so comes along (and turns with
  you); the sticks steer nothing then. The studio moves you itself (`stickMove`, every controller before any carry in
  `xrBegin`, so a carried item is placed on the scene as it now stands): `XR.walk`, as its own walk, so the panels stay
  with you in both modes, and the same at a station in a shared room (your presence is where you really stand). It says
  so to the shell with `sticks: { say(on), note }` in its returned object (`HOST.xr.walkSelf()`: the shell's travel is
  never stepped here); the notice (*Sticks: moving you* / *Sticks: the studio's*), the menu row's note, the card's line
  under *Carry it* and the foot panel's hint say which. Switching keeps `XR.walk` (no jump); Recenter takes it back, at a
  station too. Untested on a headset.
- In AR objects stand on the real floor: outside a room the floor is the session's `local-floor` (its height in the
  renderer's `local` space from `frame.getPose`), not a guess 1.6 m under the eyes; at a station the room's floor.

On a page (editing on): a click selects; `TransformControls` arrows move, turn and size the selected item (W, E, R, or
its card's buttons; cubes take per-axis size from R; sounds only move); views: *Orbit* (the camera goes round the scene,
as the design room's) and *Walk* (first person at 1.6 m: W A S D or the arrow keys, drag to look, a click on the floor
walks there; this is where cubes trigger on a page). In Walk view the camera inside an object's unseen box counts as
the headset's controller does (above): a click that finds nothing and not the floor (the floor is for walking) selects
that object, and the pointer names it. Delete, Duplicate (D) and Undo (Ctrl+Z) from the keyboard too.

Walk view's mouse (v127; the owner, 9 November 2026: "mouse movement switch left right and also grab mouse focus with
esc to ungrab", then "like most games, in both cases", "walk view only for now"): a drag looks the way the mouse goes
(right looks right, up looks up: `walkLook`, 0.004 rad a pixel). A click with a mouse (not a touch or a pen) grabs it:
the browser's pointer lock on the canvas (`grabTry`, `GRAB`). While grabbed the mouse turns you (`movementX` and `Y`,
0.0025 rad a pixel, each event held to 200 px), W A S D and the arrows walk as before, a crosshair shows in the middle
with *Esc lets go of the mouse* under it, and a click (the left button) acts at the crosshair: `clickAt` at the page's
middle, so it selects what is there while editing, else walks to the floor there; what is under it lights up while
editing. Esc lets go (the browser's own; the studio's own Esc, which deselects, does nothing as the grab ends: within
0.4 s of it), and so does leaving Walk view, explore mode, the page or the studio (`grabStep`, every frame; `grabEnd`
in `dispose`). The first click only grabs. A browser without the lock (`GRAB.no`) clicks as before; a request refused
(Chrome refuses one within about a second of Esc) clicks as before for 1.5 s, then a click grabs again (`GRAB.wait`).
While grabbed the mouse's moves never stop a walk to a spot clicked at the crosshair (a drag still does). A line beside
the View buttons, *Click the view to look with the mouse, Esc lets go*, shows in Walk view on a device with a fine
pointer while not grabbed. Orbit view is unchanged.

The panes (page HTML and headset canvas twins, the same content):
- **Scene**: its name and the scenes to pick from (a station's scene is for everyone at it); *Edit* on/off; *Save*
  (the relay: *Saved 22:41* or why not), *Unsaved changes* when what is placed differs from what was last saved or
  loaded; *Load saved* (asks first: two presses); *Undo*; *Reset what I have seen* (the `stay` cubes); on a page
  *Download layout.json* and *Upload*; the relay's state (none: how to run one, with the command). *New scene* (v118):
  on a page a field for its name and *Make it* (Enter too), in a headset *New scene...*, which asks the shell's keypad
  (`HOST.collab.keypad({ title, hint, value, max })`, a promise of the text or `null`; a shell without it: no button in a
  headset); made on the relay (`POST /api/scenes`, the relay's name rule, said here first: up to 64 letters, digits,
  spaces, `_ . -`, not starting with a space, `.` or `-`, not ending in a dot, no device names; *There is a scene called
  x already* for a 409), then opened as a scene picked by hand is (at a station for everyone there), editing on. Offered
  only with a relay that takes uploads (not read only, not `&visit`, not while the scene is locked).
- **Add** (editing): the scene's models as a grid of cards with their pictures (v120: "Pictures in the Add pane"), its
  sounds as a list, and *Trigger cube*. A press
  places it 1.5 m in front of you on the floor (a model's lowest point on the floor, its middle there), selected. And
  *Cut-out box* (*Cut-out box on Wall* while a model, or one of its cut-outs, is selected; else *Cut-out box: select a
  model first*, greyed). *From another scene...* (v118, "From another scene" below).
- **Item** (one selected): its name; for an object its card (above), *Lit* / *As scanned*, the animation (clip, *Loop*
  / *Once* / *Off*, *Always* / *When shown*), *Faces* (*As in the file* / *Both sides* / *Inside out*: "Faces"), *Turn 90
  degrees* (about the vertical), *Stand up* (a quarter turn about x), *On the floor*, size steps (x0.5, x0.9, x1.1, x2),
  *Make a group...*, *Duplicate*, *Delete*; for a cube: size steps per axis (10 cm),
  *While inside* / *Stays once entered*, *Shows n* and *Hides n* with *Pick what it shows* and *Pick what it hides*
  (then pointing and pressing on items adds or removes them from that list until *Done*; the items drawn with a tick),
  *Delete*; for a sound: *Volume* steps, *Full volume within* steps, *Loop*, *Always* / *When shown*, *Follows* (*Follow
  an object...*, its bone choices, *Move onto it*, *Stop following*: "Sounds that follow a model"), *Delete*; an
  object, a cube or a sound in a group says so at the top (*In group ...*, *Select the group*); for a group its card
  ("Groups").
- **Items** (v122: picture cards, "The Items pane as cards" below): every item in the scene as a card in the Add pane's
  look (groups first, a heading each with its members' cards under it; then objects, shapes, empties, cubes and sounds in
  no group), its picture or a tile drawn for it, what is selected lit, a press selects it. A sound that follows something
  says what (*Sound · follows Dancer · Head*). Each object's cut-outs are tags on its card (*✂ Door*); cut-outs whose
  object is not here have cards under a heading of their own. With a cube selected, *Shows* and *Hides* under every card
  (page and headset).

## Shared rooms

- A station like the design room's (placed with the page's Add or the headset's Add here, or the menu's *Studio* row:
  outside a room it opens the studio, in a room *Studio here* puts its circle at your feet or moves the room's one
  there; refused while the circles are locked; never by Arrange all). Its clock starts in explore mode. Everyone at the
  station sees one scene and one layout; triggers, editing, selection, Walk, the VR stick walk and sound are each
  device's own.
- `state()`: `{ scene, settings, 'o.<id>': {...}, 'c.<id>': {...}, 's.<id>': {...}, 'x.<id>': {...}, 'g.<id>': {...}, 'p.<id>': {...},
  'e.<id>': {...} }`: the scene's name (`''` none), its settings (as `layout.json`'s; absent, as in a circle the shell made
  for a scene: a new scene's until the saved layout is read; a bad one ignored) and one top-level
  field per item (its record as in `layout.json`, without `id`), so two people changing two items at once both keep
  theirs. An item absent from a state applied is removed there. `apply(state())` gives the same state back (records kept
  exactly as given, after the same checks as a read layout). Changing the scene clears the items and the device that
  changed it writes the new scene's saved layout as items.
- A station with no `scene` yet: with exactly one scene in the listing every device picks it (and writes its saved
  layout: every device writes the same records, so nothing doubles); else *Pick a scene*.
- A circle made for one scene (v118; the shell's *Studio: <scene>*, written as `st.<id>` = `{ story: 'studio', x, z, yaw }`
  and, in the same batch, `st.<id>.x` = `{ scene }`): a station whose state names a scene and holds no item field at all
  is opened on every device there as `'fresh'` (`collabApply`): each writes the scene's saved layout, the same records,
  so the circle shows the scene at once; a device that has that scene open already (from another station, or outside the
  room) opens it again there (the station changed: `STU.stId`). Items from the room that come before the layout is read
  here are the room's (`STU.fresh`: no layout written over them). A scene emptied at a station by hand and left unsaved
  comes back as saved for a device that arrives later (its state then holds no item): Save the empty scene to keep it so. A station whose scene this
  device cannot find (another relay, not listed): its items keep their places and show as grey boxes, said on the Scene
  pane.
- Items glide to a record from the room (0.25 s), unless carried here (the carry wins until let go, as the design
  room's). One effect, `beh`: a behaviour's driver's samples ("Behaviours" below); `view()` null; `place` and `panel` as
  the design room's (only the panel moves).
- A sound's record carries what it follows (`on`, `bone`, `o`), so following is shared exactly as placing is: everyone
  at the station hears it from the same bone, each device posing its own model on the station's clock (with `start:
  'shown'` from each person's own moment, as an object's animation). FORMAT `networks-30` (v112): an older device would
  strip those fields and write the record back.
- Saving writes what is placed now (the station's items) for everyone; another device's save shows as *Saved 22:41 by
  Anna* where the shell gives a name.
- No `FORMAT` change came with the studio itself: a new page in `STORY_EXTRA` is a station an older device shows as *A
  newer story*. Sounds that follow a model changed a sound's `state()` and so `FORMAT` (`networks-30`, v112); cut-outs
  added a kind of field (`x.<id>`) and so `FORMAT` again (`networks-31`, v113); groups (`g.<id>`) and an object's
  `faces` changed it once more (`networks-32`, v114); shapes (`p.<id>`), empties (`e.<id>`), `locked` on any record and
  the scene's `settings` once more (`networks-34`, v119); a cube's texture changes (`tex`) once more (`networks-36`, v124).
- Outside a room: what is placed is kept on this device too (`studioDraft.<relay or folder>.<scene>`, written a second
  after each change); opening the scene with a draft newer than the saved layout and different from it offers *Your
  unsaved changes from <time>: Restore / Discard*.

## Placement in a headset

Life size, like the design room. Outside a room the scene's origin is the rig's floor point: where you stood as the
session or the studio began, facing your way; anchored with `HOST.anchor` when Anchor is on, so an exhibit comes back
at the same place in the real room.

At a station in a shared room (v125; the owner, 8 November 2026: "In studio mode align all things to the room marks and
have the circle only be the entry, so that moving the circle does not move the studios scene content") the scene's frame
is the room's: room coordinates as `shared.js` keeps them (the floor at y = 0, the origin and axes the room's; on a room
calibrated on its floor spots, spot A on the floor and x towards spot B). The rig stays the station's spot (1.6 m over
the room's floor, facing the station's way; the panels float there), and the studio hangs its scene from the rig at the
room's origin (`xrPlace` with `xrRoomBase` in `engine/e8_xr.js`: the rig's inverse times the shell's room matrix,
`HOST.room.matrix()`, every frame, so the scene holds still while the circle glides somewhere else). So:

- every item stands at the same place in the real room whichever circle shows it and wherever that circle stands; two
  studio circles of one scene show it at the same place;
- moving or turning the circle (the grip, the room map, Move here; Arrange all leaves studio circles alone anyway)
  changes nothing of the scene; walking into the circle (or *Go in*) still enters the studio there;
- behaviours take the people's heads in room coordinates as the scene's (`HOST.collab.heads()`, no turn by the spot);
  the effect `beh`'s samples were in the scene's frame already;
- the VR stick walk still moves the scene for one headset; pages draw the scene in its own frame, as before; a shell
  without `HOST.room.matrix` gives the old placement (the scene at the spot).

**Move the scene to this circle.** A layout made before v125 stood round its circle (the scene's origin at the circle's
spot, facing its way). The Scene pane, while editing at a studio station in a room (page and headset alike), has *Move
the scene to this circle* with a note: *Since v125 the scene stands on the room's spots and its circle is only the way in:
moving the circle moves nothing of it. A scene placed before then stood round its circle: this moves every item there
again, for everyone (one Undo step).* It takes every item's placed pose through this circle's spot, from the station's
record (`p' = (x, 0, z) + turn(yaw) p`, the station's `x`, `z`, `yaw` as the shell places the rig there;
`sceneToCircle` in `engine/e6d_shapes.js`): the objects', shapes' and empties' `p` and `q`, the cubes' `p` and `yaw`, the
sounds' `p` (one following something keeps its offset `o` on what it follows; its own `p` is where it stands when that is
not there) and a sound's own recorded `path` (its keys are in the scene's axes: turned with it, `pathTurned`). Nothing in
an item's own frame changes: cut-outs, offsets, the other items' paths, motions and behaviours are relative and stay (a
motion about the scene's x or z axis keeps its axis, so a turn of other than a quarter turn changes its direction in the
room). One change, one Undo step, every record written (as a group's move writes its members), so shared and saved.
Refused while the scene is locked (*Lock this story*: editing is off then, so it is not offered) or while an item is
locked in place, saying which (*Refused: Box is locked in place: the scene does not move until that is unlocked.*).

The grip on nothing moves only the panel. In VR a dark floor with a faint 1 m grid and a soft sky (round the scene's
origin: at a station the room's); in passthrough nothing of those. Untested on a headset: how a scene on the room's frame
feels from a circle across the room, and that a real room's frame lines it up.

## GLB first, and converting (the owner, 4 November 2026)

The owner: "maybe we should work with these and use a converter like you mentioned glb better than fbx and we can just
convert it". GLB is the format to work with; FBX stays supported. The converter (`tools/studio/convert.mjs`) turned the
owner's atelier (14 MB FBX) into an 11.4 MB GLB that parses in 0.3 to 0.7 s instead of 1 to 2 s, and the figure (3.7 MB)
into 3.0 MB with its skin and take exact, 0.03 s instead of 0.55 s.

- **One converter, two places.** The conversion code is one module (`tools/studio/engine/convert.js`, or where it fits)
  used by `convert.mjs` in its headless page and pasted into `stories/studio.js` (with `GLTFExporter`, now in the app,
  loaded only when converting: see the vendor README). The GLB it writes is in metres and Y up, its textures at most
  4,096 px (or 2,048: *for Quest*), and records what it baked in: `asset.extras.studio = { from: '<the original's path in
  the scene>', s: <the scale applied>, q: [x, y, z, w] <the turn applied>, at: <ms> }` (since v120 also `size`, its size
  in metres, and `n`, its triangles, for the Add pane's cards).
- **A scene's folders.** What the studio makes goes into folders of the scene: `models/` (GLB), `sounds/` and
  `originals/` (the files as they were given: an FBX and its textures, an OBJ and its MTL; kept so a model can be
  converted again). Files at the scene's root or in other folders still work as before. The Add list shows `models/`,
  `sounds/` and anything outside `originals/`; `originals/` is folded under *Originals*.
- **Convert to GLB** (page only, editing on; a headset says *Convert on a laptop*, but makes a GLB with *Fewer triangles*
  and *Change texture* below): on an FBX (or OBJ, PLY, STL, glTF)
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
  default (a new name is numbered: `eva_001 2.glb`). v127 (the owner, 9 November 2026: "add option to remove items from
  upload list before uploading, one slider for all models reduction when uploading"):
  - a **×** at the top right of every row still to make takes it out of the plan (`upDrop`): its files leave what was
    dropped (`UP.entries`), a model's with what it needs (its MTL, `.bin`) and its pictures, unless another row still
    uses them; nothing of it is converted, uploaded or kept in `originals/`. Rows made or working have none;
  - **Triangles kept, every model**, a slider above the plan while it has a model still to make, sets every such row's
    share as it moves (2 to 100 %; the rows' own sliders follow on the page at once). A row's own slider can still differ
    after (a line then says some have a share of their own), and the rows of a later drop start at it (`UP.keepAll`,
    `upKeep()`; 20 % until it is moved).
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
- **While editing** (each device's own): its speaker is drawn where it follows, with a thin line in its colour to the
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
- **Trigger cubes**: a cut-out is an item a cube can show or hide (its lists take it, the Items pane's *Shows* and *Hides* and *Pick
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
  model still shows), *✂ Door* over it (*· hidden for you*, *· hidden for you, previewed cut*, *· cut*, *· whole*, *·
  cuts nothing*, *· cuts nothing (16 at most)*), darker while it cuts nothing (v131: by its colour, `LOOKS.CUT_OFF`, half;
  until v130 by its opacity); selected, a ball at each corner. Nothing
  of it is see-through (v125; the owner, 8 November 2026: "Framerate bad in studio edit mode when cutouts are active,
  they should not have this transparency since it is not needed anyway i think"): its very faint fill went, since each
  box filled its outline on screen once more (twice seen from outside, both faces drawn), so a few large boxes, or one
  round you, cost a headset's frame rate while editing (measured in headless Chromium's software drawing on the cuts
  test scene with 15 boxes, one round the camera, at 2560 x 1600: an editing frame took 543 ms with the fills and 401
  without, about what not editing takes, 380 to 410; close to the wall 809 and 478, against 436; the ghosts, a model
  drawn faint and the trigger cube's fill made no difference there; v131: its lines, ticks and corners opaque too, as
  every look while editing). Pointed at or selected, its edges light up instead
  (`LOOKS.CUT_LOOK.lit`): lighter (40 % towards white), their dashes denser (about twelve an edge, three quarters of it
  drawn, against about eight and under three fifths), its ticks a third of each edge long. The pointer (a click, a
  controller's ray) finds the nearest object, sound or cut-out by its unseen box. A cut-out lies inside its object's
  unseen box, which would always be in front of it, so when the ray goes on into one of that object's own cut-outs the
  object's box is passed over; a nearer object or sound is still found first. While picking the object a sound follows
  or a cut-out cuts, cut-outs are passed over. Not editing, nothing of the box is drawn: only the hole.
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
  Quest with a 400,000-triangle scan and 16 boxes, the frame rate while editing many cut-outs (without their fill, v125)
  and how the lit edges read there, the grip, both grips and a corner on a real controller, and the one raycast against a
  big scan as the button is pressed (a moment on a laptop; longer on a Quest).
- **Cut-outs locked** (v124; the owner, 8 November 2026: "add cutout lock mode where the cutouts for an object are locked
  and cannot be moved anymore, cutout boxes should be hidden then but show again if it is unlocked"): *Lock cut-outs* on
  an object's card writes `cutsLocked: true` into the object's record (kept only when set; anything but a boolean makes
  the record bad; a copy's are not locked; one Undo step, shared and saved). Its cut-outs cut as before; their boxes are
  never drawn or pointed at; they do not move, size, turn or go, whichever way is tried (as a lock in place holds an
  item); no cut-out is added to the object or moved onto it; the object is not deleted until they are unlocked. Its card
  says so in place of their list, the Items pane shows one tag for them (a press selects the object), and *🔒 Cut-outs
  locked* unlocks them, their boxes showing again while editing.

## Groups (the owner, 5 November 2026)

The owner: "grouping things (models, sounds, etc) in studio mode so that they move together". A **group** is a named set of
items that move, turn and size as one. The code: `engine/e6c_groups.js` (membership, the pivot, moving, the pick mode,
duplicating, the frame step), its look `LOOKS.group` in `sets/looks.js`.

- **The record** (`layout.json`'s `groups`, `state()`'s `g.<id>`): `{ name, items }`. `name` at most 60 characters, *Group*
  by default, numbered as any item's (*Group 2*); `items` the members' ids in order (an array: anything else makes the
  record bad; entries that are not ids dropped, repeats once; at most 460). Members are this scene's objects, sounds and
  trigger cubes; a cut-out belongs to its object and moves with it, so it is never a member (picking one picks its
  object). No groups inside groups. At most 50 groups a scene. `apply(state())` gives the same state back.
- **One group an item.** Where two groups name one id (two people at once, a layout written by hand), the group with the
  lower id keeps it (`groupOf`, worked out from the records, the same on every device whatever order its keys came in);
  ids of items not here are passed over. Read from `layout.json`, a group's members are only that layout's objects,
  sounds and cubes, and one left with fewer than 2 is dropped and counted (*n items could not be read*). A layout without
  `groups` (v113's) reads as before.
- **Making one** (editing on, never with `&visit`, refused while the station's story is locked, as every edit): an
  item's card has *Make a group...* (*Make a new group...* for an item in one), which makes a group of that item, selects
  it and starts its pick mode: a click, the trigger or a pinch on an item (Ctrl- and Shift-click as a click; its name
  under Items) puts it in, or takes it out if it is in; one in another group moves into this one (one change; that group,
  left with fewer than 2, goes in it). The group's card has *Add or remove items...* for the same mode; *Done* (or another
  selection, Escape, editing off) ends it. A group made just now and left with its one item when picking ends is taken
  back as if never made (its Undo step too); another left with fewer than 2 goes in a step of its own. While it picks, a
  group may have one member (shared so in a room, but never written to `layout.json`).
- **Undo and picking.** Undo while a group picks its members keeps it picking (unless it takes back the step that made
  it). An Undo that leaves a group with one member (the pick that gave it its second, or the step in which picking ended
  and it went) leaves it picking again: selected, its card in the pick mode, as it was before that step; when the step
  below is the one that made it, *Done* with that one item still takes it back as if never made (`groupUndone`). Any
  other group the step touched (the group or one of its members) that the Undo leaves with fewer than 2 members goes
  with it (no Undo step of its own); a group left so by the room alone stays, as after any room state.
- **Selecting.** A click (the trigger, a pinch) on a member selects its group (its card); a second one on the same member
  while its group is selected selects that member alone (its own card, with *In group Group 2: it moves with it. Selected
  on its own, it moves alone.* and *Select the group*); one more on it keeps it. The group's card lists its members (a
  press selects one alone). The Items pane shows groups first, a heading each (*▣ Group 2*, *n items*; a press selects
  the group) with its members' cards under it (an object's cut-outs tags on its card); the other sections show what is in
  no group. Hover labels
  name the group (*Group 2 · Dancer*); the selection's label says *group of 6 · selected*, or *in Group 2 · selected*
  for a member on its own.
- **Moving.** A selected group moves, turns and sizes as one about its **pivot**: the mean of its members' middles as
  they are shown (an object's own box's middle, or its place while its model is not here; a cube's middle; a sound's
  point), on the floor (y = 0) (`groupPivot`). A move, a turn about the vertical and a size about it carry every middle
  with its member, so the pivot stays where the group was turned or sized about (the middle of the box round them did
  not: after a turn that is not a quarter it moved, and the next turn or size shifted the group). A move by `t`, a turn `th` and
  a size `k` put a member's place `x` at `P + t + turn(k (x - P))`. Turns are about the vertical only: an object's own turn
  gains the yaw (`q' = yaw(th) q`), a cube's `yaw` gains it (it stays level). Sizes are alike on every axis: places scale
  about the pivot (so what stands on the floor stays on it), an object's `s` (its cut-outs' records and the offsets of the
  sounds that follow it with it, through `setObj` and `scaleFollowers`, as for an object sized alone), a cube's `size`, a
  sound's `r`. A value past what its record takes is held at the limit (an object's `s` 1/10,000 to 10,000, a cube's side
  5 cm to 100 m, a sound's `r` 0.1 to 20 m, a place within 1 km of the scene's origin, so no member's record is refused
  and left behind) and the group's card says which (sizing back does not undo that; Undo does).
  A sound in the group that follows an object in the group simply follows (its own record keeps its offset); one that
  follows an object outside the group moves as when carried by hand (its `p` and `o` written against its target where
  the move puts it, `soundAt`). Every move is one change: one Undo step, every member's record written together (so it
  reaches a room in one state). Refused, as every edit, while the station's story is locked or for visitors.
  - On a page: the arrows (`TransformControls`) on the pivot: move (any way), turn (the vertical ring only), size (the
    largest change of any axis taken as the size); the card's *Turn 90°*, size steps (×0.5, ×0.9, ×1.1, ×2) and *On the
    floor* (the lowest point of the group's objects onto the floor: a cube is a volume to walk into and a sound a point,
    so neither counts, unless the group has no object). While a drag lasts its members are carried (the room's records
    wait); a group gone meanwhile (from the room) lets them go, and its change ends as the pointer comes up.
  - In a headset: the grip on any member (unless that member is selected on its own: then it alone) carries the whole
    group, its members keeping their places about the hand; it stays level and takes only a yaw from the hand's turn,
    and only while free moving is on; the sticks size it and turn it about its pivot and push or pull it (v120, as any
    item carried: "The sticks while something is carried" above). Both grips (on members of the same
    group) size it about its pivot, a twentieth to twenty times, and move it with their middle; while one hand carries the
    group the other's grip on any member (a corner too) joins it, and while one hand carries a member on its own the
    other's grip on another member of that group carries that one on its own too (never the group round what the first
    hand holds). The members are shown where the hand puts them each frame and their records written ten times a second
    and as it is let go; a group gone meanwhile (from the room) lets its members go, and the hand's change ends in the
    next frame (`xrLost`: Undo and *Unsaved changes* work at once, not only after the next grip), as for any item
    removed while held.
- **Its card**: its name, *Members* (how many of each kind) and *Size*, *Add or remove items...* and the members' list,
  *Place* (*Turn 90°*, *On the floor*), *Size* steps, *Duplicate*, *Ungroup* (the group goes, its members stay),
  *Delete* (every member, an object's cut-outs with it, and the group; the cubes outside the group let them go, a sound
  outside it that followed a deleted object stays where it is, following nothing; one Undo step brings all back), and on
  a page the arrows' modes. A group with fewer than 2 members (picking, or by Undo) says so.
- **Duplicate** copies every member as a new group (*Group 2*, its members *Box 2*, ...) beside it: along x, past the
  group's width plus 0.5 m. An object's cut-outs come with its copy; a sound that follows an object of the group follows
  that object's copy (the same bone and offset); a sound that follows an object outside it follows that object from beside
  where it was; a cube of the group shows and hides the copies of what it listed in the group (and what it listed outside
  the group as it was), its original left alone; each copy (cut-outs too) joins the lists of the cubes outside the group
  its original is in, as `cubeCopy` does. Refused in words when the scene has no room for every copy (`groupDupWhy`).
- **Deleting a member** (or its being deleted from the room) takes it out of its group in the same change; a group left
  with fewer than 2 members goes too (not one picking its members now). Undo brings both back.
- **Trigger cubes**: in a cube's *Pick what it shows* / *Pick what it hides*, pointing at a grouped item (a cube of the
  group too) puts all of its group's members (not its cubes) in the list, or takes them all out when all are in it (one
  change); under Items the group's heading does the same. The lists still name the members one by one. A cube in a group of
  cubes alone (nothing a cube can list) is selected as an ungrouped cube is (its group, as a click on any member), which
  ends the pick.
- **Drawn while editing**: a selected group as a dashed box in its colour, a little darker (opaque since v131), round all
  its members (`LOOKS.group`, over everything), its name in the selection's label. Not editing, nothing of it is drawn.
- **Shared rooms**: the group's record is its field in `state()` (`g.<id>`), and a move writes its members' records in the
  same state, so a room sees the whole group move at once; who picks, what is selected and a drag's carry are each
  device's own. FORMAT `networks-32`. Two people putting one item into two groups at once leave the group with the higher
  id with that member passed over; if that leaves it fewer than 2, it stays (its card says so and offers *Ungroup*):
  applying a state never changes what it is given (`apply(state())` gives the same state back), and the result is the
  same on every device.
- **Untested on a headset**: the grip carrying a group and both grips sizing it on real controllers, the pick mode by
  trigger, how the faint box reads.

## Faces (the owner, 5 November 2026)

The owner: "double sided and flip inside out settings per model?". Each placed object chooses which of its faces are drawn.

- **The record**: an object's optional `faces`: absent or `null` (*As in the file*: each material's own side as loaded, such as a
  glTF's `doubleSided`), `'both'` (*Both sides*: every material double sided) or `'inside'` (*Inside out*: every material
  drawn from behind only; three.js turns the normals of back faces, so the light follows). Kept only when set; any other
  value makes the record bad. The model's file is never changed: Convert to GLB makes the file as it is, and the switch to
  a GLB keeps the record's `faces`.
- **Per placed object**: on the object's own materials (each object's clones, `libClone`, as cut-outs need them), lit and
  as scanned (an as-scanned material is made from the side as loaded, `side0`), so two copies of one file may differ. Set
  again whenever its model is built (a file changed on the relay, a GLB switch: `buildModel`, through `applyLight`), and
  with its cut-outs' addition: a new side compiles its programs again, the addition with them.
- **Its row** on the object's card (page and headset alike): *Faces: As in the file / Both sides / Inside out*, with *Inside
  out: for a model whose faces point the wrong way, or to see a room from inside. Both sides: thin walls and leaves seen
  from behind too.* One change (one Undo step), shared (`o.<id>`) and saved.
- **Untested on a headset**: how a scan inside out looks from within it, and the cost of double-sided materials on a
  big scan on a Quest.

## Tint and brightness (the owner, 8 November 2026)

The owner: "Studio: add tinting and brightness for models placed in the scene".

- **The record**: an object's optional `tint` (`'#rrggbb'`, lower case; absent: none) and `bright` (a factor, 0.25 to 4,
  to 2 decimals; absent: 1, and 1 is never kept), each kept only when set. A tint that is not a colour, or a brightness
  that is not a number above 0, makes the record bad; a brightness out of range is held at 0.25 or 4 (`norm`, as for the
  other numbers). `FORMAT` networks-37 (v125: an object's record changed shape).
- **On its own materials**: each material's colour as loaded (`userData.col0`, kept as each object's clone is made,
  `libClone`, and as its as-scanned copy is made, `scanMat`, from the colour as loaded, not the tinted one) times the tint,
  times the brightness (`applyTint`, `tintMat`); lit and as scanned. three.js's colours may go past 1, so a brightness over
  100 % brightens a texture too. Two objects of one file never share a tint (each has its own materials). Put on again
  whenever its model is built (a file changed on the relay, a switch to its GLB, which keeps the record's fields: through
  `applyLight`); Change texture's and Fewer triangles' previews and the cubes' texture changes swap pictures only, never a
  colour, so the tint stays through them. The model's file is never changed.
- **Its rows** on an object's card (page and headset alike, editing on; never refused by a lock in place, as Faces is not:
  they move nothing): *Tint: None* and the ten swatches the shapes use, on a page also *Any colour* (an `<input
  type="color">`, taken once chosen: one change), and *Brightness: n %* with *Darker* (×0.8), *Brighter* (×1.25), held
  at 25 % and 400 % (greyed there), and *Reset*. One Undo step each, shared (`o.<id>`) and saved. A group selected shows
  the same rows: a swatch sets every object of the group in one step, Darker and Brighter multiply each one's own
  brightness (*Brightness: they differ* when they do), Reset puts every one back to 100 %.
- The Items pane's and the Add pane's pictures stay the file's (untinted).
- **Untested on a headset**: how tints look on a Quest's display.

## Shapes and empties (the owner, 6 November 2026)

The owner: "Needs invisible occlusion cubes and other primitives to hide things and just in general"; "Needs empty objects
for example to place sounds in space". `engine/e6d_shapes.js`, `LOOKS.shape` and `LOOKS.empty` in `sets/looks.js`.

- **A shape** (kind `p`, `p.<id>` in the state, `shapes` in `layout.json`): a cube, a sphere, a cylinder or a plane (unit
  geometries shared by all: a 1 m box, a ball and a cylinder 1 m across, a 1 m square upright facing +z), placed from the
  Add pane's *Shapes* row 1.5 m in front of you on the floor, selected (a 50 cm box or ball, a cylinder 50 cm across and
  1 m tall, a 1 m plane; named *Box*, *Ball*, *Cylinder*, *Plane*, numbered as ever). 200 a scene.
- **Its look**: `'colour'`, lit in its colour (`MeshStandardMaterial`, as an object), fading in and out as an object does
  when a cube shows or hides it (while editing, hidden for you: not drawn, its edges and its tag with *· hidden*; drawn
  whole while this device holds it: v131); `'hide'`, drawn into the depth alone
  (`colorWrite: false`, `renderOrder` -1: after the stage's floor (-2) and sky (-10), before every item), so the scene's own
  things behind it are not drawn there: in AR the real room shows through it, in VR the stage (its grid is drawn with the
  opaque things now, at -1.5, so its lines carry on behind such a shape); it cannot fade, so it
  switches at one half of its fade (as a cut-out); a closed shape hides from its outside only (from inside it hides
  nothing), a plane both ways. While editing a shape that hides things also shows its edges (v131: no fill drawn, "walls
  that hide things" need none; opaque, lighter pointed at or selected; a ball's three great circles and a cylinder's two
  rims and four lines along it, as three.js finds no edges on a ball and only the rims on a cylinder; a box's twelve, a
  plane's outline), still hiding what is behind it; an unseen fill (`material.visible` false, both sides) keeps it
  pointable, also from inside; hidden for you, its edges alone. Every shape's tag while editing says its primitive's
  triangles (*Box · 12 ▲*, *Ball · 1.8k ▲ · hides things*, *· hidden*; `LOOKS.shapeTris`).
- **Its card** (page and headset): *Shape* (its size kept), *Look: Colour / Hides things*, *Colour* (ten swatches: light
  grey, white, dark grey, black, cyan, green, amber, red, violet, brown; for one that hides things only seen while
  editing), *Size (10 cm a press)* per side and *Size, every side* ×0.5 to ×2, *Place: Turn 90° / On the floor* (its exact
  lowest point: a ball's and a cylinder's as turned), then as every item (group, *Hold it*, *Lock*, *Duplicate*,
  *Delete*), one Undo step each. The page's arrows move it, turn it freely and size it per axis in its own frame; in a
  headset the grip carries it (turning with the hand while free moving is on, else only about the vertical), both grips
  size it every side alike, a cube's selected corners stretch it (the opposite corner staying, its turn kept).
- **An empty** (kind `e`, `e.<id>`, `empties`): a point with a turn, `{ name, p, q }`, placed from the Add pane 1.2 m up,
  100 a scene; drawn only while editing (a small axis cross, x red, y green, z blue, over everything; a ball in its colour;
  its name; an unseen ball for the pointer). It moves and turns (the arrows' Size does not apply), groups, and a cube
  shows or hides it. Its card: where it is, the sounds that follow it (each selects it), *Turn 90°*.
- **Sounds follow them**: a sound's `on` may name a shape or an empty as it names an object (*Follow an object...* lists
  objects, shapes and empties; pointing at one picks it): it follows the item's place and turn (no bones; its offset is not
  scaled with a shape's size), heard only while that item is shown for you.
- **Untested on a headset**: how a shape that hides things looks against the real room in AR (its edges where it meets the
  room; the shell's real-world occlusion with it), an empty's cross at arm's length, the shapes' grips on real controllers.

## Locked in place (the owner, 6 November 2026)

The owner: "There should be an option to lock things in space so we cannot accidentally move them".

- **The record**: `locked: true` on any item's record (an object, a cube, a sound, a cut-out, a shape, an empty) or a
  group's, kept only when set, last of its fields; shared and saved with it.
- **What it refuses**, whichever way it is tried: moving, turning, sizing and deleting: its card's buttons (greyed, and
  refused if pressed anyway: *Turn 90°*, *Stand up*, *On the floor*, the size steps, *Move onto it*, a cut-out's *Move
  onto another object...*, *Hold it*, *Delete*), the Delete key, the page's arrows (not attached), the grip, both grips,
  a corner and *Hold it* in a headset (a short buzz and a knock), and a group's moves. A group's lock holds its members,
  also each selected alone; a group with a locked member does not move, turn, size or go, and its card says which; an
  object with a locked cut-out is not deleted (the cut-out moves with it as ever, keeping its place on the model, and
  sizing the object scales it as ever). *Ungroup* is refused only by the group's own lock. A refusal is said in red at
  the card's top for 4 s (*Refused: ...*); the card's top says what holds it while something does.
- **What it allows**: its other fields (light, faces, clip, colour, look, volume, a cube's lists, what a sound follows),
  *Duplicate* (a copy is never locked: it is new, to be put where it goes), Undo (it takes back what was done, the lock
  too) and the room's records (the room's word wins, as ever). An item carried when the room locks it is let go where it is.
- **Its row**: *Lock in place* / *🔒 Unlock* at the top of the card, right under its heading (page and headset; one Undo
  step; `lockBlocks`), what holds it (`lockTop`, while something does) just above it, then the rest of the card (an
  item's *In group ...* lines after it): the owner, 9 November 2026: "move the locked toggle all the way to the top" (v128;
  until then by the card's *Duplicate* and *Delete*, which stay where they are). The same on every card: an object's, a
  shape's, an empty's, a sound's, a cube's, a cut-out's and a group's. Labels mark a locked item 🔒 while editing, and the
  Items pane's cards always.

## The scene's settings (the owner, 6 November 2026)

The owner: "there should be an option to hide all other icons and circles in studio mode" (decided: a setting saved with
each scene, for everyone at that studio's circle); real-world occlusion is on by default for every headset in AR (the
shell's), and each scene may set it.

- **The record**: `settings: { others: 'shown' | 'hidden', real: 'device' | 'always' | 'never' }`, in `layout.json` and in
  the state, so everyone at the studio's circle has the scene's; a new scene's: `shown` and `device`. Changing the scene
  resets them to a new scene's until its layout (or the room's state) says otherwise.
- **Its rows** on the Scene pane while editing (page and headset): *Other circles: Shown / Hidden* and *Real world hides the
  scene: As each headset has it / Always / Never*, one Undo step each, counted by *Unsaved changes*, saved by *Save*.
- **The shell told** (`settingsStep`, every frame, only when what it wants changes; guarded, an older shell has neither):
  `HOST.collab.hideOthers(true)` while this device is at this studio's station (`atStation()`) and the scene hides the
  other circles, `false` otherwise (away from its station, on the Stories screen, another scene, the setting changed);
  `HOST.occlusion.scene('both')` (always) or `('off')` (never) while the scene shows here, `null` (as each headset has it)
  otherwise; `false` and `null` again as the studio goes (`dispose`). Told again at another studio circle (the station's
  id is part of what it wants: the shell lets it lapse when the station changes). The shell draws or hides the other
  stations' rings, cards and icons (hidden ones are not walked into either, but the lobby) and runs the occlusion.
- **Untested on a headset**: the circles hidden at a studio's circle, and the occlusion setting with the shell's
  real-world occlusion.

## The lobby (the owner, 6 November 2026)

The headsets charge at the room's *Back to the lobby* circle. The studio's returned object has `lobby()`, which the shell
calls (`HOST.cur.lobby && HOST.cur.lobby()`) as this headset walks into that circle: this device forgets what it has seen
(the cubes that stay once entered, as *Reset what I have seen*), and everything starts from its beginning the next time
it is shown (an animation or a sound that starts when shown, a sound that plays once). Nothing is written to the room. Away from its station in a room (the lobby, or before any circle)
nothing of the scene is shown for that device and no cube is entered (`triggerStep`), so it all starts afresh on its
return. Untested on a headset.

## Behaviours (the owner, 6 November 2026)

The owner: "Add follow the player/avoid the player/an object etc to objects", then "behaviours should be shared for each
headset so only react to one headset, example closest or first player who walks close". `engine/e6g_behave.js`.

- **The record** (an object's, a shape's or an empty's; `layout.json` and `state()` alike): `behaviour: { kind, ... }`,
  kept only when set (none: absent), with only the fields its kind uses, in this order:
  - `'look'` `{ who, range }`: its front (its `+z` as it is placed: a glTF model's own front; a shape's and an empty's
    `+z`) turns to face the person, about the vertical through its middle (its place does not change);
  - `'follow'` `{ who, range, dist, speed, side, face }`: comes to the person and stays about `dist` in front of them (where they
    look, along the floor), at its own height, turned to them as `look` turns it; with `side` (v127; the owner, 9
    November 2026: "follow mode should also be able to be behind someone", then "should be able to just walk behind them
    and left right sounds good too") `'behind'`, `'left'` or `'right'` it stays `dist` behind them or at their left or
    right instead (their left: where they look turned a quarter to the left, `[f.z, -f.x]`), facing the way they look, so
    it walks with them; in front (the default) is no `side` at all, so a record from before v127 reads as it did;
  - `'avoid'` `{ who, range, dist, speed, area }`: keeps at least `dist` away from the person along the floor, never more
    than `area` from where it is placed; where it stands while it is far enough, pushed straight away from them when they
    come closer, to the far side of its area when its edge would leave it too close; home once home is `dist + 0.2 m`
    clear of them; it keeps its turn;
  - `'item'` `{ target, speed, face }`: follows another object, shape or empty of the scene (`target`, its id) at the offset the
    two are placed at (`inverse(target placed) × its placed`), on that one where it is drawn before its motion (its
    behaviour and recorded path, not its spin or bob: `drawnPose` keeps `it.pre` for it), a little behind (a time
    constant of 0.3 s, at most `speed`), turning with it as the two are placed; home when that one is not here (or is
    itself).
  - `'wall'` (v137) `{ at, who, range, speed, gap }`: on the room's walls, this device's own ("Things on walls" below).
  - `face` (v128; the owner, 9 November 2026: "when a model is in follow there should be a switch to look at the person
    or item it is following instead of into the same direction as the person"), on `'follow'` and `'item'` only:
    `'them'` (its front turned about the vertical through its middle to the person it follows, from where it is now, as
    `look` turns it; an item: at the place its offset gives it, turned so its front looks at the followed item's middle
    as drawn before that one's motion, the same easing and speed; right over it, within 5 cm along the floor, it keeps
    its turn) or `'along'` (Follow: the way the person looks, so it walks with them; an item: the turn it is placed at
    with that item, as before). Absent, it is as before v128: Follow in front `'them'`, behind or at a side `'along'`;
    an item `'along'`; so older layouts and rooms look the same. Once pressed on the card it is written as given and
    kept, also when the side changes (a new kind drops it; another item to follow keeps it). An item that faces `'them'`
    turns to its target even while that one stands where it is placed (its record never changes).

  `who`: `'nearest'` (the default) or `'first'`. `range` (default 3 m, 0.5 to 20), `dist` (follow 1 m, avoid 1.5 m; 0.2
  to 10), `speed` (default 0.6 m/s, 0.05 to 5) and `area` (default 2 m, 0.2 to 20), each to the cm and held at its
  limits; `target` an item's id (required for `'item'`); `side` one of `'front'`, `'behind'`, `'left'`, `'right'`
  (`'front'` kept as none); `face` `'them'` or `'along'`. A kind it does not know, a `who`, a `side` or a `face` it does
  not know, a number that is not one or an `'item'` without a good `target` makes the record bad (the layout counts it; the room's record is
  ignored and the item kept); fields its kind does not use are dropped. Cubes, sounds, cut-outs and groups have none.
- **Who it reacts to**: one person at a time, among the people in a headset at its circle (pages never count; outside a
  room this device's own head: a headset's, or the camera in Walk view on a page). Distances are along the floor from its
  middle as drawn. `'nearest'`: the nearest within `range`; once it has one, another takes over only when nearer by more
  than 0.3 m, and it keeps its one until they are more than `range + 0.5 m` away. `'first'`: the first who came within
  `range` (each person's arrival kept until they are more than `range + 0.5 m` away), kept until they are; ties by member
  id. Nobody: it goes home (its placed pose) by itself, at most `speed` (turning at most half a turn a second).
- **Shared at a station**: everyone there sees it react to the same one person. Every device works out who that is from
  the same heads: the shell's `HOST.collab.heads()` (the heads of the people in a headset at this device's live station,
  its own among them, from presence, in room coordinates with the relay's time of each), which are the scene's
  (since v125 the scene stands on the room's frame at a station: "Placement in a headset"), this headset's own as the studio has it
  (exact). That person's headset **drives** it: it moves it every frame from its own head and sends where it put it, its
  move along the floor and its turn from its placed pose (`[id, tx, tz, d, since]`, to the mm and the milliradian), about
  ten times a second as one quiet effect of the studio's, `beh` (`{ at: the relay's time, b: [...] }`, every item it
  drives in one message; `studioEffect` hands it on), and once more with a last `1` when it stops driving (nobody in range,
  someone else's turn, it rests, its behaviour goes). Every other device draws it **120 ms behind** those samples (the
  relay's clock, eased as the shell's render time is), between the two around that moment (past the last carried on as it
  went for 0.1 s at most), blended in over its first 0.4 s; with the samples ended or none for 1 s it goes home by itself,
  the same on every device. If two headsets drive one item at once (they saw each other a moment late) the claims settle
  it, alike everywhere: for `'first'` the earlier arrival (`since`, which every device also takes as that person's
  arrival), for `'nearest'` the newer driver (it began because it was nearer), ties by member id; the one that loses stops.
  `'item'` needs no driver: every device works it out from what it draws. Samples are kept for the items here only, the
  last 8 of each sender; nothing of them is stored in the room (no key, no `FORMAT` change for the effect). The record is
  its item's field, shared and saved as placing is: FORMAT networks-35 (v120; `side` networks-39, v127; `face` networks-40,
  v128: an older device would drop them when it writes the record).
- **Drawn**: the base stage of the pose pipeline (`POSE.base`, "Motions" below): its placed pose turned by `d` about the
  vertical through its placed middle and moved by `(tx, 0, tz)` (an item's whole pose), so a recorded path and its motion
  draw over it, the model, its unseen box, labels, its cut-outs and the sounds that follow it come along, and **the record
  never changes**. `POSE.base` is set only while some item of the scene has a behaviour (`behaveStep`, every frame before
  `itemsStep`), so a scene without one is drawn exactly as before; while one has, every object, shape and empty goes
  through the pipeline (those without one at their placed pose).
- **Resting**: as a motion (v122: "The ghost, Pause and placing what moves" below), it goes on while selected and rests
  while this device holds it (carried, dragged by the arrows) or Pause is on here: at its placed pose, no longer driven
  here (its last sample says so), and from there again after.
- **Its rows** on the card of an object, a shape and an empty, before its Motion rows (page and headset alike, editing on,
  not refused by a lock: a behaviour does not move its place): *Behaviour: None / Look at / Follow / Keep away / Follow an
  item...* (a kind for people keeps `who`, `range`, `speed` and `area` where both have them and takes its own `dist`;
  *Follow an item...* starts a pick: a click, the trigger or a pinch on an object, a shape or an empty, or the card's list,
  sets it; *Cancel*), *Reacts to: Nearest / First to come close*, *Notices people within* (*Less* / *More* through 0.5, 1,
  1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20 m), for follow *Where: In front / Behind / Left / Right* (v127) and *Faces: Them /
  Where they look* (v128, `face`; a line under it says *It turns to look at them.* or *It faces the way they look, so it
  walks with them.*), *Stays in front of them at* (*behind them*, *at their left*, *at their right*;
  follow: *Closer* / *Further*) or *Keeps away by*
  (avoid), through 0.2, 0.3, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 7, 10 m, *Stays near its place, within* (avoid: 0.2, 0.5,
  1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20 m), *Moves at most* (*Slower* / *Faster* through 0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8,
  1, 1.5, 2, 3, 4, 5 m/s; not for look), and a line saying it is one person at a time, the same for everyone at a circle,
  pages never counting, and that it goes on while selected (a ghost where it is placed) and rests while carried; for an
  item *Follows: <name>*, *Faces: The item / As placed* (v128), *Moves at most* and
  a line (*turned to look at it* or *turning with it as the two are placed*). One Undo step each (the pick itself none). A group's *Duplicate*: a copy whose behaviour follows an item of the
  group follows that item's copy.
- **For tests and the console**: `STUDIO.behave(id)` (who, whether this device drives it, where it is drawn from: `'me'`,
  `'by:<member>'`, `'home'` or `'item'`, its move and turn, whether it is off its placed pose); `STU.head`'s fourth value
  is the pretend head's turn (0 facing `-z`); `BEH.fake` adds pretend others' heads; `behNow` can be held still;
  `BEH.log = new Map()` keeps what each item did frame by frame.
- **Known limit**: in VR the stick walk moves the scene for one headset alone; the others see where that person stands in
  the room, so near a boundary they may choose differently for a moment (the claims settle who drives).
- **Untested on a headset**: all of it on real Quests at a station (how it feels to be followed, looked at or avoided
  life size; the choice and the hand-over between real headsets over Wi-Fi; how smooth 120 ms behind looks there; many
  behaving items' cost), the stick walk's limit above, and Faces (v128) there: a model at your side that turns to look at
  you as you walk, an item that turns to look at the one it follows.

## Things on walls (the owner, 11 November 2026)

The owner, of a room built as a studio scene: its elements "dynamisch auf detected walls", "losgelöst und auf raum
gemappt", and "keep in mind that it may need to be reactive and react to user movements, where the user goes, instead of a
static variant". `engine/e6o_walls.js`.

- **The record**: a behaviour of the kind `'wall'` (an object's, a shape's or an empty's), fields in this order:
  `{ kind: 'wall', at: 'direction' }`, `{ kind: 'wall', at: 'nearest' }` or `{ kind: 'wall', at: 'person', who, range,
  speed }` (`who`, `range` and `speed` only for a person, as the other behaviours have them: 3 m, 0.6 m/s by default),
  each optionally with `gap` (metres, 0 to 0.5, to the cm, 0.03 by default, written only when not the default). `at` left
  out is `'direction'`; another value makes the record bad. FORMAT networks-43.
- **The walls**: this device's own. In an AR session whose frame has `detectedPlanes` (`plane-detection` enabled), every
  vertical plane (`orientation` `'vertical'`, or `semanticLabel` `'wall'`; never `'door'`; a window counts) taken into the
  scene's frame (`frame.getPose(plane.planeSpace, refSpace)`, then `GL.world`'s inverse): its polygon's extent along the
  floor as a segment, its bottom and top heights, and its normal along the floor turned towards the walls' middle (the
  middle of all the segments' box along the floor). Read when the planes change (their set or a `lastChangedTime`) and at
  most twice a second, once a second besides (a recentre moves the scene), as the robots read theirs (`wallsXR`, from
  `xrBegin`; inside try/catch, the feature asked for by `enabledFeatures`); gone at the session's end. No walls (VR, a
  page, no room scan yet): the item stays at its placed pose, and its card says so.
- **Where**: `'direction'`: the first wall a ray from the walls' middle meets along the item's placed direction from the
  scene's origin (its placed middle's x and z; at the origin `-z`; no wall met: the walls' point nearest where it points);
  `'nearest'`: the walls' point nearest its placed middle along the floor; `'person'`: the walls' point nearest the person
  it reacts to, chosen as Follow and Look at choose (`behChoose`, alike on every device from the heads), moving along there
  at most `speed` m/s; with nobody, back to its `'direction'` place.
- **There**: its back against the wall (its middle the gap plus how far its box reaches behind its middle along its front
  off the wall: an object's model's box, a shape's unit box as sized, an empty's point), its height its placed middle's
  held within the wall's bottom and top where it fits (too tall: its bottom on the wall's), its front (`+z` as placed)
  facing out of the wall into the room (turned about the vertical through its middle), its placed tilt kept. It eases there
  (`WALL_EASE`, 0.15 s: there in about 0.4 s) when the walls change, never jumping each frame.
- **Drawn**: a base stage of the pose pipeline as the other behaviours are (`behaveBase`: its move `tx`, `ty`, `tz` and turn
  `d` from its placed pose), so a recorded path and its motion draw over it and **the record never changes**; it rests at
  its placed pose while held here or paused (its ghost there while editing). Computed on each device from its own walls:
  nothing is sent (no effect, no state), so the same record maps onto each headset's own room.
- **Its rows** (the Behaviour rows, page and headset): *Behaviour: ... / On a wall*, *Which wall: In its direction /
  Nearest / Follows the person*, *Gap from the wall* (*Less* / *More* through 0, 1, 2, 3, 5, 10, 15, 20, 30, 50 cm), for a
  person *Reacts to*, *Notices people within* and *Moves at most*, and a line on this headset's walls (*This headset has 4
  walls from its room scan: it stands on wall 1.*, or none). One Undo step each.
- **For tests**: `STUDIO.walls(list)` gives pretend walls (`[{ a: [x, z], b: [x, z], y0, y1 }]` in the scene's frame; `null`
  the headset's own again; without an argument what there is: `{ src, n, mid, list }`); `STUDIO.behave(id)`'s `wall` (the
  wall it stands on, -1 none) and `ty`.
- **Untested on a headset**: real plane detection on a Quest (which planes it lists as vertical, how steady their extents
  are from one read to the next, a multi-room scan), how things on walls look there, a person followed along the walls,
  and walls read while the scene stands on a room's frame at a station.

## Motions (the owner, 6 November 2026)

The owner: "Add little animations like spin and wobble etc for models?", then "animations do 1 and 2" (1: simple motions,
this section; 2: the recorder, "Recorded paths" below; curves later). `engine/e6e_motion.js`.

- **The record** (an object's, a shape's or an empty's; `layout.json` and `state()` alike): `motion: { kind, speed, amount,
  axis, start }`, kept only when set (no motion: absent). `kind`: `'spin'` (turns about the axis through its middle),
  `'wobble'` (tilts `amount` degrees away from the axis, the tilt going round it), `'bob'` (up and down along the axis by
  `amount` metres), `'pulse'` (grows and shrinks about its middle by `amount`, a share of its size; no axis), `'orbit'`
  (goes round a circle of `amount` metres about where it stands, across the axis, keeping its own facing) or `'sway'`
  (swings about the axis through its middle by `amount` degrees each way). `speed`: turns, wobbles, bobs, pulses or swings
  a minute, 0.1 to 600 in size to 2 decimals, a negative one going the other way. `amount`: 0 to the kind's largest
  (wobble 60°, sway 90°, bob 10 m, orbit 50 m, pulse 0.9; degrees to 0.1, metres to the mm, a share to 2 decimals; a
  spin's is 0). `axis`: `'y'` (upright, the default), `'x'` (side to side) or `'z'` (front to back), the scene's axes.
  `start`: `'always'` (the default) or `'shown'`. Left out, `speed` and `amount` take the kind's own (spin 6 a minute;
  wobble 20 and 10°; bob 15 and 10 cm; pulse 30 and 10 %; orbit 4 and 50 cm; sway 15 and 15°), `axis` `'y'`, `start`
  `'always'`. A kind it does not know, a value that is not a number, another axis or start makes the record bad (the layout
  counts it; the room's record is ignored and the item kept); a value out of range is held at its limit. Cubes, sounds,
  cut-outs and groups have none (a group's members each keep their own).
- **The formulas** (time `t` in seconds, `c = speed / 60 * t` the count so far, its phase `ph = 2π (c - floor c)`, `A` the
  axis and `u` the way across it, `(0, 0, 1)` for `y`, `(1, 0, 0)` for `z`, `(0, 1, 0)` for `x`), each a change in the
  scene's frame applied over the placed pose, about the item's middle (an object's: its model's box's middle; a shape's
  and an empty's: its place): spin a turn by `ph` about `A`; sway a turn by `amount° × sin ph` about `A`; wobble a turn by
  `amount°` about `u` turned by `ph` about `A`; pulse a scale of `1 + amount × sin ph`; bob a move of `amount × sin ph`
  along `A`; orbit a move of `amount` along `u` turned by `ph` about `A`.
- **The clock**: `'always'` runs on the scene's clock (`sceneClock`: at a station the room's, `HOST.collab.now()`, so
  everyone at a circle sees the same moment of it; outside a room since the scene opened), `'shown'` from when it was last
  shown here (a cube showing it to you; this device's own, as an animation or a sound started when shown, and from its
  beginning again after the lobby).
- **One pose pipeline** (`drawnPose(it, now, clockS, out)`, the drawn pose of an item at a time, in the scene's frame), so
  what comes later builds on it: (1) its placed pose, its holder's place, turn and scale (its record, a glide from the
  room, a carry, the arrows), or what a behaviour gives instead (`POSE.base(it, now, clockS, out)`, returning false when it
  gives nothing for this item; none yet); (2) its recorded path (`POSE.path(it, now, clockS, out)`, "Recorded paths" below,
  changing the pose it is given); (3) its motion (`motionDelta`), premultiplied. `poseStep` (every frame in `itemsStep`, once the
  placed pose is this frame's) writes the drawn pose into the holder's matrix (`matrixAutoUpdate` off while it moves), so
  everything under it comes along: the model, the pointer's unseen box, its labels, a sound following it or one of its
  bones (a pulse grows an object's followers' offsets with it, `motionK`); its cut-outs take the same change on their own
  placed poses (`poseCut`), so they stay on the same part of the model. The holder's place, turn and scale stay the
  placed pose, which every edit reads and writes: **the record never changes**. A group's members move only by their own
  motions. `STUDIO.pose(id)` gives the drawn and placed matrices (tests).
- **Resting** (v122; until v121 it also rested while selected): it goes on while selected, editing or not, so the card's
  rows show on it at once; it is drawn at its placed pose only while this device holds it (`motionRests`, from
  `restScan`'s list made once a frame: carried by a grip or the sticks, its group carried, the page's arrows dragged on it
  or its group, its path being recorded, or a sound or a cut-out on it carried, or a group holding a sound on it carried),
  while a cut-out on it or a sound following it is selected here (editing: as until v121; their arrows, box and corners
  stand on it where it is placed, so a drag of them never jumps, and they have no ghost of their own) and while Pause is
  on here. What is measured against it (a sound attached, a bone picked, *Move onto it*, *Stop
  following*, a group's pivot, box, moves and *On the floor*, sizes, a cut-out's frame) is measured at its placed pose
  (`poseRest` in an action; `atPlaced`, the holders put at their placed poses for the measure, inside a frame). Others at
  the station still see it move. See "The ghost, Pause and placing what moves" below.
- **Its rows** on the card of an object, a shape and an empty (page and headset alike, editing on, not refused by a lock:
  a motion does not move its place): *Motion: None / Spin / Wobble / Bob / Pulse / Orbit / Sway* (a kind its own speed and
  amount, the axis and start kept), *Speed* (*Slower* / *Faster* through 0.5, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30, 45, 60, 90,
  120 a minute; *The other way* for a spin and an orbit), *How far* (a wobble's and a sway's degrees, a bob's metres; *By*
  for a pulse, *Round a circle of* for an orbit; *Less* / *More* through each kind's steps; none for a spin), *Axis*
  (*Upright (y)*, *Side to side (x)*, *Front to back (z)*; none for a pulse), *Starts: Always / When shown*, and a line
  that it is drawn over where it stands, its place not changed, goes on while selected (a ghost where it is placed) and
  rests while carried. One Undo step each, shared (its field in `state()`) and saved. Its sub-line in lists says so
  (*spins*, *wobbles*...). Then *Motions: playing / paused* and *Start again* (below).
- **Shared rooms**: the record is its item's field, so a motion is shared as placing is; the phase of `'always'` comes
  from the room's clock on every device. FORMAT networks-35 (v120).
- **Untested on a headset**: how the motions look and feel life size (a spinning scan around you, a fast orbit), their
  phase across real headsets at a station, the cost of many moving items on a Quest.

## A model's timeline (the owner, 9 November 2026)

The owner: "Studio mode items that have an animation should show a timeline and play pause in edit mode when selected",
then "play and pause for everyone in the circle", "pause and scrubbing is temporary, once the item is not selected
anymore or editing is switched off it goes back to its regular behaviour". `engine/e6m_anim.js` (v127). After trying it
(v128): "it was a model with recorded path, just tried one with its own clips and there play pause works but i could not
see a timeline, was a very short animation with 1.3 seconds, please add timeline and play pause also for recorded items"
(in a headset, whose card had the time in words and no bar).

- **Two timelines**, each with a hold of its own (a channel, `ANIM_C`: `clip` or `path`), independent of each other (a
  model with its own clip and a recorded path has both, one held, the other not, or both):
  - *its clip* (v127): the card of an object whose clip plays (*Loop* or *Once*, not *Off*), under its Animation rows;
  - *its recorded path* (v128): the card of an object, a shape, an empty or a sound with a recorded path (in its record or
    kept as a file; a sound that follows something has none playing, so none), not while it is recorded, under its
    Recorded path rows. What it holds is the path's own clock: the item's time the pose pipeline reads (`pathT`: from the
    scene's clock or from when shown, or since *Start again*), before its speed and Loop, Once or Back and forth
    (`pathTime`), never a key's index; so its range is one cycle of what is seen, its length at its speed (`pathCycle`:
    `D / speed`), twice that for Back and forth (there and back), and a Loop wraps round it as Back and forth does.
- **Where**: selected here while editing is on (`animCan(it, ch)`, `animBlocks(it, B, ch)`), page and headset alike:
  *Pause* (or *Play* while held paused), *Start* (held at 0 s, paused), *−1 s* and *+1 s* (a second back or on, round a
  Loop, held at the ends of Once, playing on if it was), *The scene's clock* (lets go; pressable only while this device
  holds it); the clip's acts `an:play`, `an:start`, `an:step`, `an:free`, the path's `ap:...`. On a page the row's label
  says *Timeline: 1.2 s of 2.0 s*, then a slider in tenths of a second (`stuRangeAnim`, `stuRangePath`, `animSeek`; a 1.3 s
  clip has 13 steps) and a line saying how it plays now and that a hold lasts while it is selected with editing on. On a
  headset's card the label says *Timeline (2.0 s): playing* (or *held, paused*, *held, playing*, *by someone else*), and
  the bar is under it.
- **The headset's bar** (v128; `{ xr: true, bar: { id, ch } }`, `drawBar` in `engine/e9_panels.js`): a track the card's
  width, the part played filled (cyan; amber while held paused), the playhead (ringed while held, two small bars in it
  while paused) with its time over it, ticks at whole seconds up to 30 s (every 10 s up to 300 s, then every minute) and
  at tenths up to 3 s, and its ends' times under it (*0 s*, *2.0 s*). Pointed at and pressed or dragged with the trigger
  (its region's `drag`, as the foot panel's track; `e8_xr.js` calls it on the press and every frame while it is held on
  the panel): held there, paused, for everyone at the circle (`animScrub`); let go, it stays held there. It moves while the
  card is not drawn again: the card's signature (`animSig(true)` in `sigMain`) holds only who holds each timeline and
  whether it plays, and each bar shown in full on the card (`P.bars`) is drawn again on its strip when its tenth of a
  second or its hold changes, at most ten times a second (`barsTick`): on a small canvas of its own (`BARCV`), put on the
  card's canvas in its place (the card's canvas never read back) and sent to the card's texture alone (`panelPatch`:
  `texSubImage2D` of that canvas, then the texture's mipmaps; about 400 KB, not the card's 4.9 MB; a texture not on the GPU
  yet or with the whole card still to go takes it as it goes; no WebGL2, the whole card). The menu's Story tab shows the
  same texture.
- **A hold** (`ANIM.mine`, the clip's, `ANIM.mineP`, the path's: `{ id, t, p, at, key, n }`: its time `t` at the moment
  `at`, playing `p` or not, for the clip and mode, or the path, `key` it was made with, and `n` its number): where it is
  from then on is `t`, plus the time since `at` while it plays, wrapped for Loop (and Back and forth), held at the end for
  Once (`animAt`). `at` is the relay's clock at a station (`behNow`), so every device works it out alike; elsewhere this
  page's. A hold shows even while Pause (v122) holds everything else: a held path is drawn at its held moment over its
  placed pose, with no motion or behaviour on it (`pathHeld` in `drawnPose`, `poseStep`); carried (a grip, the arrows, its
  group) it rests where it is placed as ever. Its own hold never makes it rest.
- **A voice recorded with the path** (`syncAt`, e6j_voice.js) follows its hold: silent while the path is held paused,
  from the matching moment while it is held playing, on the path's clock again once let go. Each hold is a pass of its
  own (its number in the pass), so a decoded voice starts again at the held moment (and again as a held Loop comes round)
  and a streamed one is set there; let go, the pass is the clock's again and it starts where the clock has it.
- **Shared at a station**: the holding device tells everyone at its circle with a quiet effect of the studio's, `anim`
  (`{ at, a: [id, t, p] }`, with `c: 'p'` for a path's: its time at `at`, sent at once on each press and four times a
  second while it holds; a slider or a bar being moved is told four times a second, its last place within a quarter of a
  second; `{ at, a: [id], end: 1 }`, `c: 'p'` for a path's, when it lets go). The others keep the latest word per item and
  channel (`ANIM.heard`, the path's under `<id>:p`; an older word from another holder is ignored while the newer one is
  fresh; a word that says what the kept one says already, the same holder playing or not alike at the same moment within
  30 ms, only keeps it fresh, so a held path's voice is not started again four times a second) and draw that moment; one
  not heard from for 1.2 s is let go by itself. Nothing is stored in the room or saved in `layout.json`, no record changes,
  nothing goes into Undo, and `FORMAT` does not change (an older device ignores the effect and plays on its clock).
- **It lets go** (`animStep2`, every frame, `animFree(why, ch)`), back to the scene's clock (or from when shown) for
  everyone, when the item is no longer selected here, editing goes off, the item goes, its clip stops or changes (its
  `key`), its path is deleted or recorded again or its play, start or speed changes (`pathKeyOf`), a recording starts, or
  *The scene's clock* is pressed. Two holding one item at once each see their own; the others follow the latest word.
- **Drawing the card**: a page's card follows each timeline every frame without drawing the pane again (`animCardStep`:
  the label's time, the slider and its words), and while a slider is being moved the pane is not drawn again under the
  hand (`ANIM.drag`, the channel moved; `animSig(false)` held). Its line under the rows is the page's only, so a headset's
  card keeps Place and Size near, one scroll down.
- **For tests**: `animState()` (`{ mine, mineP, heard }`), `animSet(it, t, p, quiet, ch)`, `animBar(ch)`, `ANIM_ACT`,
  `XR.main.patched` (the strips sent on their own) and `XR.main.bars`.
- **Untested on a headset**: the card's rows, how the bar reads and how it drags with a real trigger on a Quest (its strip
  sent alone and its mipmaps there); how in step a held frame or a held path looks for several people at a circle over
  real Wi-Fi; a held path's voice in Quest Browser.

## Recorded paths (the owner, 6 November 2026)

The owner: "just animate objects by dragging them? Animation recorder?", then "animations do 1 and 2" (2: this section).
`engine/e6f_path.js`.

- **The record** (an object's, a shape's, an empty's or a sound's; `layout.json` and `state()` alike): `path: { k, play,
  start, speed }`, kept only when set. A group has none (its members each keep their own and move with it; its card says
  so), nor do cubes and cut-outs (a cut-out goes with its object's path).
  - `k`: its keys, each `[t, dx, dy, dz, qx, qy, qz, qw]`: `t` seconds from 0 (to the ms; the first 0, strictly
    increasing, the last at most 120), then its pose relative to its placed pose: `(dx, dy, dz)` metres in its placed
    frame, turned but not scaled (to the mm, each within 1,000), and `(qx, qy, qz, qw)` a turn after its placed turn (a
    turn of length 0 is bad; normalised when it is more than 2e-3 off unit length, 4 decimals). A sound only moves (its
    turn is kept but not used). 2 to 600 keys an item, and 6,000 in a scene (in a layout's or a state's order, an item
    past them is bad); so the station's state, one value at the relay (256 KB at most), stays under it: a recording that
    would take the state past 224 KB is refused, and so is a copy (Duplicate, a group's) that would pass either limit.
  - `play`: `'loop'` (from its start again), `'once'` (to its last key, then held there) or `'bounce'` (back and forth).
  - `start`: `'always'` (on the scene's clock: at a station the room's, `HOST.collab.now()`, so everyone there sees the
    same moment; outside a room since the scene opened) or `'shown'` (from when it was last shown here: a cube showing it to
    you; a sound, heard). *Once* with *Always* plays once from when the scene opened (at a station the room's clock has
    long passed it, so it stands at its end): *Once* is meant with *When shown*.
  - `speed`: 0.25 to 4 (2 decimals), how fast it plays.
  - A key that is not 8 finite numbers, times out of order or past 120 s, fewer than 2 or more than 600 keys, or a `play`,
    `start` or `speed` of the wrong kind make the record bad (the layout counts it; the room's record is ignored and the
    item kept); a `speed` out of range is held at its limit; `null` reads as absent.
- **Playing** (`pathTime`, `pathAt`): its time (the clock above) times its speed, then looped (`u mod D`), held
  (`min(u, D)`) or back and forth (`u mod 2D`, mirrored past `D`), `D` its last key's time; between the two keys round it
  the place in a straight line and the turn by slerp (the shortest way, normalised). Drawn by the pose pipeline
  ("Motions": `POSE.path`, after the placed pose and before a motion, which adds on top): the placed place plus its turn
  times `d`, its turn times `q`. So moving or turning the item moves or turns its whole path, sizing it does not size the
  path, its record's place stays where it is placed, and what follows it comes along (a sound following it or one of its
  bones, its cut-outs). A sound that follows something moves with that: its own path waits (kept) until it follows nothing.
  Switched to its GLB (which holds its model turned by `r`), an object's keys are turned so it moves as before:
  `d' = r d`, `q' = r q r^-1` (`pathTurned`, in `switchedRec`).
- **Resting**: as a motion, it plays on while selected (v122) and rests at its placed pose while this device holds it or
  Pause is on here. *Play it here* (`STU.recPlay`, v120 and v121) went with that: *Start again* takes its place (below).
- **Its timeline** (v128): selected while editing and not being recorded, its card has a timeline under its Recorded path
  rows ("A model's timeline" above: Pause, Play, Start, a second back and on, The scene's clock, a page's slider, a
  headset's bar): its own clock held, paused or playing, for everyone at a circle, shown through Pause, its voice
  following it.
- **Recording** (`REC`, this device's own: nothing goes into its record or to the room while it runs):
  - In a headset: *Record its movement* on its card arms it (`XR.rec`, as *Hold it*: one disarms the other; another
    selection, editing off or the session's end disarm it). The next grip of either hand, on it or anywhere (not at a
    panel, the shell's menu or a station), carries it as usual, from where it stands, and its holder's pose is sampled 30
    times a second (`recSample`, right after each carry) until it is let go. The sticks turn it and push it meanwhile, and
    that is recorded; they do not size it, nor does a second hand (a grip of the other hand on it is refused while it
    records): a path has no size. At 120 s it ends as if let go.
  - On a page: *Record* on its card starts it and *Stop* keeps it (*Cancel* drops it); meanwhile the arrows (Move, Turn:
    `TransformControls`) and its card's buttons (*Turn 90°*, *On the floor*...) move it as usual, with their real timing
    (sampled every frame, 30 times a second at most); its size steps and the Size arrows are off. From Record to Stop is one
    change (the arrows' drags and the card's presses inside it). Selecting something else keeps it as Stop does; editing
    off (or the station's story locked) cancels it. At 120 s it stops by itself.
  - Then (`recPath`): the samples relative to where it stood as the recording began, simplified (`pathSimplify`, splitting
    where the straight line and slerp between two kept keys stray most from a sample, while any strays by more than 5 mm at
    its middle, an object's model's box's middle, or 1 degree: 4 mm and 0.9 degrees there, the rest left for rounding to
    the mm, 4 decimals and the ms), and the path written into its record, its place and turn as they were when the
    recording began: one change, one Undo step. *Record again* keeps the old path's `play`, `start` and `speed` (a first
    one: loop, always, 1). It plays at once, and its card says *Recorded 3.0 s in 27 keys (from 91 samples)*. A path that
    plays in a loop is joined first ("The recording's ghost and the loop join" below).
  - Refused in words on its card: too short (under 0.1 s), not moved (no key 5 mm or 1 degree from where it began), more
    than 600 keys once simplified, the scene's 6,000, the shared state's 224 KB; a locked item (*Lock in place*: refused as
    a move is, with a knock), a sound that follows something (*Stop following to record its own path*), a group (*record
    its members one by one*). A refused recording changes nothing.
- **Its rows** on the card of an object, a shape, an empty and a sound (page and headset, editing on): *Recorded path* (with
  its length and keys) and *Record* / *Record again* (page; *Stop* and *Cancel* while it records) or *Record its
  movement* (headset; *Now press a grip (again: cancel)* while armed); with a path *Plays: Loop / Once / Back and forth*,
  *Starts: Always / When shown*, *Speed: ×1* (*Slower*, *Faster* through ×0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4) and *Delete
  recording*; one Undo step each; what the last recording's join did, with *Keep it as recorded*; then *Motions: playing /
  paused* and *Start again* (below). How it plays is not refused by a lock
  (its place stays, as with a motion). Its sub-line in lists says *recorded path*. `RECLAST` (the last recording, with its
  samples) and `recClock` (the recorder's clock, ms) are for tests.
- **Shared rooms**: the path is part of its item's record, so it is shared as placing is; `'always'` takes its phase from
  the room's clock on every device. FORMAT networks-35 (v120, with the motions).
- **Untested on a headset**: recording with real grips and sticks (the pose sampled from a real carry at the headset's
  frame rate), how a path plays back life size, its phase across real headsets at a station, the stall of simplifying a
  long recording on a Quest (a 120 s one is 3,600 samples, a 10 minute one 18,000), the cost of many items on paths.

### Ten minutes, as a file (the owner, 8 November 2026)

The owner: "Add voice recording option to the motion recorder, make length up to ten minutes possible?" (this subsection
and the next). `engine/e6j_voice.js`, with its hooks in `engine/e6f_path.js`.

- **How long**: with a relay that takes uploads (`canUpload()`) a recording may run up to 600 s (`recCap`, `PATH_MAX.long`)
  and stops by itself there, kept (*stopped at 10 minutes: the longest a path may be*); without one, up to 120 s as before
  (*stopped at 120 s: the longest a path may be without a relay that takes uploads*).
- **In the record, or as a file**: one that fits the old limits (at most 120 s and 600 keys once simplified) stays in the
  record as before. A longer one, or one of more than 600 keys, is kept as a file of the scene,
  `recordings/<the item's name>-<n>.json` (the first `n` free from 1; a recording is never written over, so Undo can give
  an older record back with its file): `{ studio: 1, recording: 1, item, len, n, k }`, its keys as a record keeps them
  (rounded alike; at most 40,000 and 600 s), at most 4 MB (the relay's rule). It goes up as the converter's GLBs do
  (`upSend`: through the relay, or straight into R2), a name taken meanwhile the next; the record's path is then `{ src,
  len, n, play, start, speed }`, written once the file is in (the item stands where it is placed meanwhile, *Keeping the
  recording: its file goes into the scene (n %)...* on its card), one change, one Undo step (on a page the change from
  Record to Stop puts the item back where it began, so it is empty and dropped: the recording is still one step).
  **Simplified a slice at a time**: a recording of more than 2 minutes of samples (more than 3,600, with a relay that takes
  uploads) is simplified between timer tasks, about 8 ms a slice (`recSoon`, `simplifySoon`; `pathSimplify` is the same
  step function, `simpStart` and `simpRun`, run to its end at once, so the keys are the same either way; each sample's
  middle worked out once), *Simplifying the recording (18,001 samples): a moment...* on its card meanwhile, so a headset
  never stalls on up to 18,000 samples (measured in headless Chromium: 18,000 jittery samples, 43 ms of work at once, in
  6 slices, the longest 8 ms; untested on a Quest). What is refused before simplifying is said at once (one past 2
  minutes with no relay that takes uploads). `SIMP.last` keeps the last one's numbers for the tests. Refused in words: more than 40,000
  keys, and without a relay that takes uploads one that needs a file (*A recording longer than 2 minutes needs a relay
  that takes uploads*, or *This movement needs 700 keys: a path holds 600 at most in the layout, and a longer one is kept
  as a file of the scene, which needs a relay that takes uploads*).
- **Playing**: the device that made it keeps its keys at once (`PF`, `own`); every other device reads the file
  (`pathK`, `pfLoad`: `call()`, so the relay's password as a header, or R2's signed link) once it is in the scene's
  listing, and again when its time there changes (a failure is tried again 10 s later or when it changes; its card says
  why). Until its keys are in the item rests where it is placed (`POSE.path` returns nothing). Everything a path does
  works the same: loop, once, back and forth, its speed, Start again, the loop join and *Keep it as recorded* (which makes
  a file of its own when it needs one), Pause, the ghost. Its card says *Recorded path: 4:12, 3,812 keys, kept as a file*
  and *Kept as the file recordings/Box-1.json: ...*.
- **Limits**: the scene's 6,000 keys and the shared state's 224 KB count only keys in records (`pathN`; a file's are not in
  the state). A copy (Duplicate, a group's) names the same file.
- **A GLB switch**: an object switched to its GLB whose path is a file gets a new file with its keys turned
  (`pathFileTurned` for each, from `pathFilesTurned`, before the switch's change: its keys turned as `pathTurned` turns a
  record's, written as `recordings/<its name>-<n>.json`), its record naming that one. One that cannot be (no relay that
  takes uploads; its keys not read within 5 s, or its file unreadable; the upload refused) is not switched at all: it stays
  on its original, where its path plays as before (switched, its holder would turn by the baked turn and its old keys would
  play turned), and its card says why (`it.swNote`: *Not switched to models/figure.glb: its recorded path is kept as the
  file ..., and turning it needs a relay that takes uploads. It stays on figure.fbx, where it plays as before; Switch to
  the GLB tries again.*), as does the conversion's note (`heldWords`), amber; *Switch to the GLB* on its card tries again.
- **Move the scene to this circle** (v125, "Placement in a headset"): a sound's own recorded path is in the scene's axes,
  so it is turned with the scene; one kept as a file is first written turned into a new file (`sceneToCircleFiles`, as a
  GLB switch does), then everything moves in one change; one that cannot be refuses the move in words (*Refused (nothing
  moved): Walking's recorded path is kept as the file ..., and turning it needs a relay that takes uploads.*), and a circle
  or a recording changed meanwhile asks to press it again.
- FORMAT networks-37 (`src` on a path; `sync` on a sound's record, below).

### A voice with the movement (the owner, 8 November 2026)

- **The switch**: *With my voice: on / off* among the recorder's rows (an object's, a shape's and an empty's card, page and
  headset; not a sound's), this device's own (`studioRecVoice` in `localStorage`, kept). Turned on, it asks for the
  microphone at once (`getUserMedia({ audio })`, 15 s at most; the stream is let go and opened again as a recording
  begins). A refusal or no answer is said on the card (*The microphone was refused: allow it for this page...*; in a
  headset *No answer about the microphone: in a headset the browser may not show its question...*); the headset's card
  always says to turn it on on the 2D page first, before entering VR (untested on a Quest). Greyed without a relay that
  takes uploads (*Your voice is kept as a sound of the scene: it needs a relay that takes uploads*) or a browser that
  cannot record (`MediaRecorder`).
- **While it records** (`voiceBegin`): the microphone is recorded with it (`MediaRecorder`, Opus in WebM where the browser
  has it, a chunk a second), from when it opens (`V.t0`, real time; the recording's own began at `R.real0`); its card
  shows *● Your voice: ●●●●○○○○*, a level from an analyser on the shell's context (`HOST.audio.fx()`, connected to nothing
  else, so nothing is heard and no context is the studio's own; none while the shell has no context: *recording*).
- **Kept** (`recKeep`, `voiceKeep`): only with a recording that is kept; cancelled or refused, what came is let go. Made a
  mono sound as the Upload pane makes sounds: up to 20 s decoded in the page by `monoWav` (the one `OfflineAudioContext`,
  `e7b_upload.js`) into a 16-bit WAV at 48 kHz; longer, sent to the relay's `ffmpeg` for a mono MP3 (`.../sound`); with
  no `ffmpeg` kept as it came (`.webm`, `.ogg` or `.m4a`). Uploaded to `sounds/<the item's name>-voice-<n>.<ext>`, and
  placed (`voicePlace`) as a sound item named *<item> voice*, following the recorded item (on its *Head* bone when its model
  has one, else at its top, as it is placed), volume 1, full volume within 1.5 m, `loop: false`, with `sync` (the item's
  id), `skip` and `len`: `skip` = the stillness the loop join cut from the path's start (`res.c0`) less how late the
  microphone began after the recording (`lead`), `len` = where it ends in the path's own time, its file's end `dur - skip`
  (a microphone that began late, `skip` below 0, ends that much later in the path's time too), at most the path's length.
  The path and the sound are written in one change: one Undo step (the files stay in the scene). *Record again* with the
  voice on writes a new file (the first `n` free; a voice file is never written over) and points that sound at it: one
  sound per recorded item (`voiceOf`: the first by id whose `sync` names it); Undo gives the old record back with its old
  file, which every device still has as it was. *Keep it as recorded* keeps the
  voice and moves its `skip` with the path's start. Its card says *Your voice is Box voice (mono WAV, 48000 Hz, 4.0 s): it
  follows Box and plays with its path.*
- **Playing with the path** (`syncAt`, from `emitStep`, `emitStart` and `streamStart`): while the item's path plays (its
  keys in, the item not resting), the voice starts each time the path starts its loop (with a path that plays once, once;
  back and forth, on the way there), on the path's clock (`pathClock`: at a station the room's), so everyone at a circle
  hears it at the same moment: at the path's pass `e` seconds in, the voice is at `skip + e` in its file, to `skip + len`.
  A decoded voice is started 20 ms ahead at where it will be then (`AudioBufferSourceNode.start(when, offset, duration)`),
  a negative `skip` by starting that much later; a streamed one (over 20 s, the usual ten-minute voice) is set to where
  its path is as its element can take a new moment (its metadata in), 50 ms ahead to begin with, and kept there as it
  plays (`syncStream`: about twice a second, once it has played 150 ms, its element's moment against the path's; more than
  80 ms off, set again, ahead by how late its last setting came in, `S.lag`, learnt from a setting checked within 3 s of it,
  at most 0.5 s), and stopped at its end; a new pass stops it and starts it again. Either starts at its level at once (no
  fade-in over its first word). At a path speed other than ×1 it plays at its own pace from each start (its
  card says so). It is heard only while it and the item are shown for you, and follows the Sound button as every sound of
  the scene does. A sound whose `sync` names an item with no recorded path (the recording deleted, or the item gone) plays
  as a sound of its own by its own *Plays* (its card: *no longer synced*). `STUDIO.voice(id)` (its last start, where its
  voice and its path are now; a streamed one's element, its last difference, how often it was set again, its lead) is for
  tests.
- **Shared rooms**: the sound is an item, its file a file of the scene, so every device fetches it and plays it from the
  room's clock. A group's copy of a voice plays with the copy of its item.
- **Untested**: the microphone in a Quest session (whether Quest Browser shows its question there), how a voice sounds
  following a model there, a voice longer than 20 s made MP3 by a real relay's `ffmpeg` (the tests record a few seconds;
  a streamed voice is tested with the test scene's 25 s WAV), a streamed voice kept on the path's clock in Quest Browser
  and across real headsets, Safari's `MediaRecorder` (MP4).

### Stays on the floor (the owner, 10 November 2026)

The owner: "When animating an item have an option that keeps it grounded, stuck to the floor with the side thats closest
to the floor when starting". `engine/e6f_path.js` (`FLOOR`, `recDown`, `recFloor`, `floorRows`).

- **The switch**: *Stays on the floor: on / off*, a row among the recorder's rows on the card of an object, a shape, an
  empty and a sound (page and headset; not on a sound that follows something), this device's own (`studioRecFloor` in
  `localStorage`, `'1'` on, off by default), never in a record, `state()` or `layout.json`. A line under it says what it
  does for that kind. It applies to recordings begun from then on (`REC.floor`).
- **As it begins** (`recBegin`): an object or a shape is set down so its lowest point is on the floor, `y = 0` in the
  scene's frame, measured as *On the floor* measures it (`objBox`, `shapeBox` with its record), its place rounded to the
  mm; that set-down place is where it begins (its ghost stands there) and the place written with its path. On a page its
  record moves there at once (inside the recording's one change); in a headset only its holder does (a carry writes nothing
  until it is let go). An empty, a sound and an object whose model is not in yet are not moved: they keep their height.
- **Every frame while it records** (`recFloor`, first in `recSample`, so after a headset's carry and its sticks and before
  the frame is drawn; on a page also as the arrows move it, before their change is written, `tcRead`): its height stays
  where it began, and its turn keeps only its turn about the vertical since it began: `d = q q0^-1` (the scene's frame,
  `q0` made unit), split into a twist about the scene's `y` axis and a swing; only the twist is kept (`d`'s `y` and `w`
  parts, made unit; a half turn about a level axis has none), so `q = twist q0`. A turn about the vertical moves no point
  up or down, so the side that was lowest stays on the floor while it slides anywhere along it. A sound only keeps its
  height. Lifting, tilting or pushing it up, by the hand, the sticks, the page's arrows or its card's buttons, is dropped;
  what is drawn is what is sampled.
- **The page's arrows** while it records on the floor (`tcAttach`): Move without its up arrow (and the planes that hold
  it), Turn with the vertical ring only and in the scene's frame; *Stand up* is refused and greyed (`recStops`).
- **The path**: its keys hold to it (each key's turn is `q0^-1 twist q0` and its place has no part up or down in the scene's
  frame, to the rounding of a record: 1 mm, 4 decimals); nothing new in the record, no `FORMAT` change. The loop join keeps
  to it (its bend moves along the floor and turns about the vertical), and so do simplifying, the voice, a recording kept
  as a file and *Record again*.
- **Its end** (`recEnd`): kept here and now, its record takes the set-down place with its path (one change, one Undo step,
  as ever). Cancelled or refused, it goes back where it was before it was set down (the change empty, nothing to undo).
  One kept later (a file, a voice: `recKeep`, `e6j_voice.js`) leaves it where it was meanwhile, and its later change writes
  the set-down place with the path (still one Undo step).
- **Untested on a headset**: how it feels to carry something that stays on the floor (the hand lifting it while it slides
  below), recording with real grips and sticks so, how a grounded path plays back life size on a real floor.

## The ghost, Pause and placing what moves (the owner, 7 November 2026)

The owner, after v121: "when selecting animations on the item motion tab they should also show on the item as a
preview", and, asked whether a selected item should keep moving: "to make placing easier add a pause motion button but i
also want to be able to move moving/animated items to select their exact place". `engine/e6h_ghost.js`.

- **It goes on while selected**: an item with a motion, a recorded path or a behaviour moves while it is selected (editing
  or not), and rests at its placed pose only while this device holds it, a cut-out on it or a sound following it is
  selected here, or Pause is on ("Motions": Resting). So a motion
  picked on its card shows on it at once.
- **The ghost**: while editing, every item that moves now (v124; the owner, 8 November 2026: "in edit mode Ghosts should
  always be visible for animated things"; until v124 only the selected item or a selected group's members), while it is
  drawn more than 1 cm or 1 degree from where it is placed (its middle, its turn, or a pulse more than 1 cm at its edge: `ghostFar`, from `it.mX`), a copy
  stands at its placed pose (`GH`, `ghostStep` at the end of `itemsStep`), and for 0.6 s after it was last that far, so a
  spin passing through its place does not blink it. Since v125 also a model its own clip moves (`clipMoves`: its parts
  move, its holder stays at its placed pose), the whole time its clip plays while editing, selected or not (`ghostFar`
  alone would hide it once selected); the page's arrows then stand on the item itself, at its placed pose, where the
  ghost is. An object's: a copy of its model sharing its geometry with one ghost material (v131, the owner, 10 November
  2026: "ghosts for example can just be a light gray": opaque light grey, `MeshLambertMaterial`, depth written, pushed a
  hair back by `polygonOffset` so the item wins where the two meet, a mesh without normals flat-shaded by a
  `MeshPhongMaterial`; lit, as a recording comes back to it, a light greenish grey; until v130 pale blue-white at 0.25, no
  depth written), a skinned mesh drawn as a plain one (frozen in its rest pose); only its unseen box's edges, opaque lines
  (`ghostLine`), for a model of more than 100,000 triangles (`GHOST.tris`), a model its own clip moves (its ghost would
  stand where it is drawn and fight with it: the owner, "outline box is fine, just make sure it has no transparent
  walls") and a model a cube hides from you (no clip ghost at all then: its own edges stand there); a shape's its shape;
  an empty's its cross and dot; a sound's its speaker; none of it see-through. Each part where it stands on
  its holder (its matrix relative to the holder's as built), the ghost's own matrix the placed pose (the holder's place,
  turn and scale). Built once per selection (again when its model or a shape's kind changes) and freed when the selection
  changes: its two materials disposed, never the geometry it shares (the model's, the looks', the shared box's). None while
  a model is still loading. It is pointed at as the item (an unseen box at its unseen box's place, `userData.ghost`, among
  `pickables`): the trigger or a click on it selects the item, and the grip on it, or on the item where it is drawn,
  carries the item from its placed pose (resting in the hand as ever); let go, it moves on from its new place. *Hold it* as
  ever.
- **The page's arrows on the ghost**: while the selected item is drawn by the pipeline (its holder's `matrixAutoUpdate`
  off), `TransformControls` hold a stand-in, `TCP`, kept at its placed pose (`tcTarget`, `tcProxy`, `tcStep` every frame;
  never switched during a drag); each change of the stand-in goes into the holder's place, turn and scale and then
  `tcRead`, exactly as a drag of the item itself, and the item rests there while dragged (it is carried), so it is drawn
  where it will go; let go, it moves on from there. Its card's buttons act on the placed pose as ever. Resting (Pause, a
  recording) the arrows are on the item itself again.
- **A cut-out on a moving model**: the click or trigger that selects an object keeps its ray in the object's own frame as
  it was drawn then (`cutRay`: the holder's matrix at that moment, or its placed pose when the ray met its ghost), and
  *Cut out a part* casts it onto the model at its placed pose: the cut-out goes on the part of the model the click met,
  however it has moved since.
- **Pause** (`MPAUSE`, this device's own: never in `state()`, never saved, off again as soon as editing is off, never for
  a visitor): *Motions: playing / paused* on the Scene pane while editing (page and headset, with a line), the same switch
  on the card of anything that moves (a motion, a recorded path, a behaviour or a model's animation that plays), and P on a
  page (not while typing). While paused every item stands at its placed pose (no motion, path or behaviour drawn: a
  behaviour this device drives is given up, its last sample saying so, and the others draw it as the room has it), the
  models' animations hold the frame they show (`animStep` does not set their time), and sounds play on. Played again,
  everything goes on by its clock (an *Always* one at the room's moment).
- **Start again** (this device's, no change recorded): on the card of an item whose path or motion starts *When shown*,
  or whose path plays *Once*: its *shown* clock from now (`it.shownAt`: a motion, a path, a model's animation started when
  shown, a sound from its beginning), and a path that plays once played once more from now (`it.again`).
- **For tests**: `STUDIO.ghost(id)` (`{ shown, lit, at, parts, outline, hits }`, or null), `GH`, `GHOST`, `TCP`,
  `MPAUSE`, `pauseSet(on)`.
- **Untested on a headset**: how the ghost reads life size (its opacity over a real room in AR), pointing at a ghost and
  carrying an item by it with real controllers, Pause from the headset's panel, the cost of a ghost copy of a big model.

## The recording's ghost and the loop join (the owner, 7 November 2026)

The owner: "when animating a 'ghost' of the model should stay in the initial place so that one can hit it again for
better loops, these loops could then even autosmooth if the start and the end are close". `engine/e6f_path.js` and
`engine/e6h_ghost.js`.

- **The ghost at the start**: while a path is recorded (a headset's armed grip carrying it, or a page's *Record*), its
  ghost stands at the pose the recording started from (`REC.p0`, `REC.q0`, `REC.s0`), the whole time, also while carried.
- **Hitting it** (`recGhost`, every frame of the recording): once the carried item has been more than 15 cm (its middle)
  or 30 degrees from its start (`REC.away`), coming back within 5 cm and 10 degrees lights the ghost (brighter, greenish
  white), with a soft tick at the ghost (the shell's sound effects, `hover`, forced) and a short gentle pulse on the hand
  that carries it (`buzz(c, 0.1, 25)`); it dims as it leaves again. Let go (headset) or *Stop* (page) while it is lit, its
  end is put exactly on its start.
- **The loop join** (`pathJoin`), only for a path that plays *Loop* (a new recording's way; *Record again* keeps the old
  path's, so *Once* and *Back and forth* stay as recorded, their end put on their start only when let go at the ghost):
  - the still moments are cut: at its start, the samples until it has moved more than 1 cm (its middle) or 1 degree from
    its first (the last still one its new start, the times shifted to 0); at its end, the samples after it last moved
    that far from its final pose (the first still one its new end);
  - then, when its end is within 15 cm and 20 degrees of its start, its last 0.5 s (a quarter of it when it is shorter
    than 2 s) is bent so that it arrives exactly at its start with the start's speed: its place along a cubic Hermite from
    its place and speed at the bend's beginning to its start's place and the speed of its first 0.1 s, its turn by a
    correction towards its start's eased in and out (smoothstep); its last sample is its first's pose exactly;
  - then it is simplified as ever. So it loops with no jump and no pause; its last key is its first key's pose.
- **The card** (page and headset, this device, while the recording is held in `RECLAST`): *Loop closed: its end met its
  start (6 cm, 4° apart; 0.4 s of stillness cut)* with *Keep it as recorded* (the path written from the raw samples,
  simplified, without the cut and the bend: one Undo step), or *Its end is 40 cm from its start, so it jumps back each loop:
  record again and end at the ghost to close it.* (with the stillness cut said, and *Keep it as recorded*, when some was);
  for *Once* or *Back and forth* let go at the ghost, *Its end met its start (4 cm, 3° apart): put exactly on it.* While it
  records the card says to end at its ghost, and when it is lit that letting go there closes it. Nothing new in the record:
  no `FORMAT` change.
- **Untested on a headset**: finding the ghost by hand, the tick and the pulse on a real controller, how a joined loop
  looks life size.

## Fewer triangles (the owner, 6 November 2026)

The owner: "models need to be way less triangles"; meshoptimizer approved; "needs a percentage and should be adjustable
per model with a preview if possible"; "20 percent by default for everything"; "preview in ar/vr would really be helpful
since this is where we experience the models in the end"; yes to the button on models already placed.

- **The simplifier.** meshoptimizer's (1.3.0, MIT, `vendor/meshopt_simplifier.js`, unchanged, its WebAssembly inside),
  pasted into `stories/studio.js` inside `meshoptLoad()`, so its WebAssembly is made only the first time a model is made
  lighter; `convert.mjs` imports it as the module it is. The converter's `reduce(root, keep)` (`engine/convert.js`, shared
  by the page, the Upload pane and `convert.mjs`): every mesh keeps the same share of its triangles (`keep`, 0.02 to 1),
  its corners welded first (a copy: the geometry given is not changed, or with `inPlace` each mesh given its new one);
  `simplifyWithAttributes` weighs its normals (0.5) and texture coordinates (1), so a texture stays where it was (its seams
  are kept); corners a part shares with another part (another material's group of the same mesh, or another mesh touching
  it, found by where they are, a grid a hundred-thousandth of the model's size) are locked, so parts do not crack apart;
  pieces smaller than a hundredth of its size are pruned first (`simplifyPrune`; never at the looser limits, which took a
  figure's separate arms); the limit on how far a corner may move starts at 1 % of its size and is loosened (10 %, all of
  it) until the count is within a tenth of the target; a part with no texture coordinates may then collapse across its
  hard edges (`Permissive`); a part under 16 triangles is left as it is. Its corners are a subset of the old ones, so a
  skinned mesh keeps its bones' weights; a mesh with shape keys (morph targets) is left as it is and said so. It says how
  far it came, how far the surface moved when that is more than 2 % of its size, and the pieces pruned. A dense textured
  sphere of 400,512 triangles came down to 80,101 (20 %) in under a second in headless Chromium, every corner's texture
  coordinates exactly as before.
- **In a GLB.** `toGLB(m, { keep })` reduces after the weld and before the export; the checks compare the GLB with the
  lighter model; the record gains `tris: { from, to, keep }` (none when nothing could be taken away). `CONV.triCount(ext,
  buf)` reads a model's triangles from its bytes (glTF's accessors, OBJ's faces, STL's count, PLY's header, FBX's
  `PolygonVertexIndex`, zipped or not), for the Upload pane's words before anything is loaded.
- **On an object's card** (page and headset, editing on, never `&visit`; under its place and size): *Fewer triangles...*
  opens it at 20 % (or at the share its GLB was made with). A page has a slider, 2 to 100 % (the preview a moment after it
  rests and at once when let go); a headset *− 5 %*, *+ 5 %* and *10 %*, *20 %*, *50 %*. It says what it is made from and
  about how many are kept, and shows it **in place at once, on this device only**: the object's own model is given the
  lighter geometries (`reduce` on its file's model, which stays as loaded: other objects of that file keep theirs; cut-outs,
  faces, light and bones work as before, as they are the materials' and the skeleton's); nothing is shared until saved;
  *Cancel*, another selection or editing off puts it back. **Save** makes the GLB as Convert to GLB does
  (`convertFile(src, { into, keep })`, through the relay or straight into R2, else downloaded on a page): what it is made
  from is the original a GLB stands for when the scene has it (`asset.extras.studio.from`: made again from it into that
  GLB, so a model made too light comes back up), else the file itself (a GLB in `models/` made again where it is, the one
  it has now kept under `originals/`, which its record then names; anything else as `models/<name>.glb`); every object of
  that file switches where it stands (one Undo step, for everyone at a station). The share is of what it is made from;
  the preview shows at most what the model placed has (*The model here has only N, so the preview shows it as it is*).
  Saving writes from a headset too (with a relay that takes uploads; else the card says so); a failure there (a texture
  the headset cannot encode: the exporter is given 4 minutes) is said on the card and changes nothing.
- **The fill: no black seams** (v120; the owner, 6 November 2026: "The reduction works really well but leaves black
  artifacts in the textured models ... maybe just needs changes to the texture like adding fade out color around all tiles
  since now these parts are black most of the time?"). Why: a scan's texture is an atlas of many small pieces with black,
  unused texels between them (the atelier's: 1,960 pieces, 27 % of its 4,096 px picture used). Reducing keeps the seams
  joined in 3D but straightens each piece's outline in the picture, so at 10 % the lighter model's triangles sample the
  black between pieces: black wedges along the seams (and even all its triangles show thin dark seams once mipmapped,
  since the black bleeds into the pieces' edges). Measured on the atelier with its margins blacked out: at 10 % about 2.5 %
  of what is drawn sampled the empty space; filling every texel no triangle uses with the colour of the nearest piece took
  the wedges and the thin seams away. Locking the seams' corners in the simplifier stopped the wedges too but kept the
  dark seams: not done. So `toGLB` fills (`CONV.fillModel`, before the weld and before it is made lighter, by the model's
  triangles as they are then): for each picture it is made with, the texels its triangles use are marked
  (`IM.cover` in `engine/images.js`: every texel whose centre a triangle holds, on an edge too; a triangle smaller than a
  texel marks its corners' and middle's texels, so a tiny piece keeps its colour), and every other texel is filled from
  them (`IM.fillGaps`): a band of exact edge colours (each texel a copy of a neighbour's from the ring before, sides first:
  2 rings at 1,024 px or less, 4 at 2,048, 8 at 4,096), then a smooth push-pull fill (the known texels averaged level by
  level down to one, each empty one drawn back bilinearly from the level above). The used texels never change. Only where
  it makes sense: texture coordinates within 0 to 1 (a picture that repeats across the model, with repeat wrapping, is
  left alone; with clamping the coordinates are clamped), under 95 % of the picture used (a box's or a sphere's picture is
  left as it is), at least 16 px a side, every mesh showing it with texture coordinates (three.js's transform of the first
  set read as r128 reads it: the material's first picture of map, specular, displacement, normal, bump, roughness,
  metalness, alpha, glow; the occlusion picture through the second set). Every slot is filled (colour, glow, normal,
  roughness, metalness, occlusion, opacity), each with its own values: a normal map with the normals round its pieces,
  never black. Alpha is kept as it is where a material reads it (see-through or cut out); elsewhere it is filled with the
  colours (a canvas keeps no colour where alpha is 0), and a picture that becomes opaque so is written as JPEG. A picture
  a material reads the alpha of whose gaps are mostly clear (alpha 0) is left as it is and said (*a see-through picture
  whose gaps are clear*): a canvas, and the GLB written from it, keeps no colour there, so a fill would change nothing. A
  picture drawn down before the fill (the converter's `maxTex`, which a model's own pictures reach at their full size, its
  reading of a picture with a `max`, the studio's own cap: each says so, `CONV.drew(canvas, k)`) has its pieces' rims
  taken back first and filled too (`fillGaps`'s `rim`: one ring of texels, two when drawn down by more than half), each
  rim texel only where a texel deeper in its piece is beside it (a piece a few texels across keeps its own): drawing down
  makes each rim texel an average reaching over the edge into the black, and the band would copy that dark rim outwards
  (the atelier's 8,192 px picture is drawn down to 4,096 before it is filled). No float
  buffers: integer arrays, about 90 MB besides the picture's own bytes at 4,096 px, the work given up to the page every
  25 ms (so a headset keeps drawing). Times in headless Chromium on this machine: the atelier's 4,096 px picture with its
  397,066 triangles in 1.4 s in `convert.mjs`'s page; in the studio's page while it draws the scan in software between
  slices, 5.6 s (a headset's own are untested). Its GLB came out 3.3 MB at 10 % (3.4 MB without the fill: the smooth
  fill costs JPEG nothing). The record gains `fill` (how many pictures are filled, those a GLB made from had filled
  already counted), the GLB's card says so in one line (*Textures: the gaps between the pieces of its picture are
  filled ...*), and a GLB whose record says so has its pictures marked as filled when it is loaded (`load`), so making it
  again from itself does not fill them again. Every path that writes a GLB fills: Convert to GLB, Convert every model, the
  Upload pane at any share, Fewer triangles' Save, Change texture's Save and the missing-texture buttons; `convert.mjs`
  too (`--no-fill` leaves them as they are; `toGLB(m, { fill: false })`).
- **The fill in the preview.** Fewer triangles shows the object's pictures filled too, as Save fills them: worked out once
  while it is open (`CONV.fillModel(E.root, { copy: true })`: copies, the file's own pictures stay as they are; again only
  for another model), at any share, and laid on the object's own materials, lit and as scanned (`ftFillShow`, again when
  its light changes); *Cancel*, Save's end, another object or editing off put its own back and free them (`ftFillFree`).
  The card says *Its picture is shown with the gaps between its pieces filled ...*. A GLB already filled needs none.
  `STUDIO.state().lite.ft.fill` (`{ n, again, ms, err, shown }`) for tests.
- **Made again.** A GLB made lighter keeps its share when it is made again from its original for another reason (Change
  texture, a missing texture: `convertFile` takes the replaced GLB's `tris.keep` unless a share is asked); one made again
  from itself is not made lighter again.
- **The Upload pane:** each model's row has *Triangles kept* (a slider, 20 % by default), *About N of its M triangles*
  (`triCount`), and *Preview*, which opens the viewer over the whole window ("The viewer" below; until v125 a small picture
  of both side by side). Converting uses each row's share; its line says the triangles, and once the viewer has shown it,
  *Seen in the viewer: N triangles became M.*
- **Look closer** (a page's, on the card while Fewer triangles is open): the viewer with the object as placed, at the
  card's share.
- `convert.mjs --keep <share>` (0.02 to 1): the same, its report saying how far it came.
- The fill's limits: a picture shared by a tiling model and an atlas is left alone; a picture whose pieces were baked
  without any margin still shows the colour of the piece next to it at a seam once lighter (the nearest colour, not
  black); a see-through picture whose gaps are clear keeps its dark fringe where a filtered texel reaches them. How the
  filled seams look on a Quest is untested.
- Never in `layout.json` or `collab.state()` (no `FORMAT` change): what is shared is the switch to the GLB.
- `STUDIO.state().lite` (`{ ft, ct }`), `STUDIO.tris(id)` (what an object's model draws now) and `thumbOf(root, w, h,
  wired)` (a small picture of a model, its edges drawn faintly over it) for tests.

## Change texture (the owner, 6 November 2026)

The owner: "a change texture button on models placed in the scene where one can select other texture images".

- **On an object's card** (page and headset, editing on, a model with texture coordinates): *Change texture...* lists
  its materials with the pictures in their slots (colour first; *inside the file* for one a GLB holds), the slots
  (Colour, Normal, Roughness, Metalness, Occlusion, Glow, Opacity; a dot on the filled ones), what the slot has now, and
  the scene's pictures likeliest first (`CONV.texRank` by the picture it has, else the material's or the model's name; a
  page lists them all and offers *Choose a picture...* from this computer, a headset eight at a time). A picture picked is
  **shown at once on this device** on the object's own materials (lit and as scanned; the others of that file keep theirs);
  another material, slot or picture shows that instead; *Cancel* puts its own back.
- **Save** bakes it into the model's GLB through Add a texture's path (`texGo`: a picture from this computer goes to
  `originals/` first; a GLB made from an original still in the scene is made again from it, its share kept), recorded in
  `asset.extras.studio.tex` as a slot laid on (`{ name: '', mat, slot, from, how: 'chosen' }`); every object of that file
  switches where it stands. From a headset too, with a relay that takes uploads. Add a texture stays on the page for a
  slot that is empty; the missing-name buttons too.

## The viewer (the owner, 8 November 2026)

The owner: "Studio uploader needs better preview, also for the reductions, can use the whole viewport, show the model and
be able to spin it etc". `engine/e7f_viewer.js`.

- **Pages only**, never in a headset (nor while one presents: it closes then). Opened by an Upload row's *Preview*, by
  *Look closer* on a placed model's Fewer triangles card, and by *Look* on each model card of the Add pane (a small button
  over the picture's corner: a plain press on the card still places the model). From the Add pane it shows what a press
  would place (the GLB that stands for an original, else the file): the scene's model when it is loaded here (a copy with
  its own materials), else fetched and read as the converter reads it (its pictures at the studio's limit), freed after.
  From an Upload row: the dropped model read as the conversion will read it, stood up by its guess. From Look closer: the
  placed object's file, turned and sized as placed, its faces, tint and brightness as it has them.
- **Over the whole window**: an overlay (`#stuViewer`, z-index 14) with its controls, over the studio's own canvas raised
  to z-index 13 (`GL.canvas.style.zIndex`, put back on close). **Never a second renderer**: while it is open the studio's
  frame goes on (its items, sounds, the shared room) but draws the viewer's scene in place of its own (`vwDraw`, from
  `frame`), and places no labels.
- **The model**: lit as the studio lights its scene (a sky and ground light, the sun over your left shoulder and the cool
  rim from behind, both following the camera; glTF's soft room), or as scanned (*Lit* / *As scanned*: an as-scanned copy of
  each material, as the studio makes one); a model it read itself drawn as the studio draws the scene's (its pictures
  linear, an FBX's opacity-0 material solid). Framed on its box from a little above and in front, over a floor grid at its
  foot (squares of a round step about a tenth of its widest side: 1 cm to 10 m), its size and triangles said at the top.
- **The camera**: drag to spin (0.4 degrees a pixel round, 0.3 up, held within 85 degrees), the wheel or a pinch to zoom
  (`exp(deltaY × 0.0012)`, 0.05 to 60 times its size), a right drag, a Shift drag or two fingers to pan, a double click to
  frame it again (*Frame it* too, which also turns it back to the start). It turns by itself (12 degrees a second) until it
  is touched.
- **A model being made lighter** (an Upload row's, Look closer's): *All triangles*, *Lighter* or *Side by side* (the window's
  two halves, one camera: all on the left, the lighter on the right, each said over it; on a window taller than it is
  wide, as a phone held upright, all at the top and the lighter below), the share on a slider (2 to
  100 %; its words follow it, and the lighter one is made again as it is let go, `CONV.reduce` on the model as read, its own
  geometries swapped in for the drawing only; a share chosen while showing all its triangles shows them side by side),
  *All: N · Lighter: M*. The lighter one's pictures are filled as Save fills them (`CONV.fillModel(root, { copy: true })`,
  worked out once, laid on the lighter one only). A placed model's share is of the original it was made from, as on the
  card.
- **Wireframe** (its triangles' edges in dark lines over it, a hair nearer than its faces) and **Textures** (off: no
  picture on any material; a program is built again only when a picture comes or goes, never when one is swapped).
- **Close or Esc**: everything the viewer made freed, the canvas back under the page, focus back where it was; the share
  chosen goes back to where it was opened from (the Upload row's slider; Fewer triangles' share, previewed again on the
  card). While it is open the keyboard is the viewer's: the studio's keys (Delete, Ctrl+Z, P, W, E, R) never reach the
  scene behind it. **Nothing goes into the layout or the room**, and no Undo step.
- For tests: `STUDIO.viewer()` (`vwState()`: open, what it shows and how, its camera), `vwOpen(src)`, `vwClose()`,
  `vwDraw(dt)`.
- **Untested**: a big scan in it on a slow laptop (reading it, a reduction of a few hundred thousand triangles, the fill),
  pinch and two-finger pan on a real touch screen.

## Pictures in the Add pane (the owner, 6 November 2026)

The owner: "Models in add dialogue should have preview images and show in a grid ... 3d preview? overkill?", then "add
pane with pictures sounds good, leave 3d models for now". `engine/e7e_pics.js`.

- **A picture** of a model is a 256 x 256 JPEG (at most about 190 KB; a few tens in practice): the model lit as the
  studio lights a scene (a sky and ground light, a light over your shoulder, a cool rim, the soft room for glTF's metal
  and gloss), its colour pictures drawn as they are, seen from a little above and in front (about 22 degrees up), framed
  on its box with a small margin, drawn at twice the size and made smaller (smooth edges), over a dark background
  (cleared to nothing, then laid over a dark gradient: a JPEG has no transparency). It is kept in the scene as
  `previews/<the model's path>.jpg` (`models/eva.glb`'s: `previews/models/eva.glb.jpg`). The relay's rule
  (`relay/scenes.mjs`, shared by the folder, R2 and `scan.mjs`): `previews/` takes only such a `.jpg`, at most 200 KB
  (counted as it streams; `.../put` signs its size; a copy by the same rule), listed and told by the watch with the kind
  `'preview'`, never `'image'` or `'model'`, so nothing takes it for a texture or a model; anything else put there by hand
  is `'other'`. An upload to `Previews/` or any other casing of it at the top of a scene is refused (400: on a file system
  that ignores case, Windows' and macOS's, it is that same folder, and a file put there would be past the rule). The
  studio says them apart as it reads a listing (`setFiles`: by path too, for an older relay's `'image'`):
  they are never among the scene's files (the Add lists, the texture ladder and pickers, From another scene's lists, the
  copy's names), only in `PV.files`, so it knows which models have one. Never in `layout.json` or the room's state (no
  `FORMAT` change). A model whose picture's path would be more than 4 folders deep or 200 characters long has one for
  that page only.
- **Made with every GLB.** The converter's `toGLB(m, { picture })` calls `picture` with the GLB as loaded back (metres,
  Y up) before it frees it (`pvShotSoon`): every path that writes a GLB makes its picture (Convert to GLB, Convert every
  model, Fewer triangles' and Change texture's Save, the texture buttons: all through `convertFile`; the Upload pane's
  rows). With a relay that takes uploads it goes into the scene beside the GLB (`previews/<the GLB's path>.jpg`,
  replacing one there; `upSend`, so straight into R2 when it can, else through the relay), and shows at once; without, it
  is kept for this page only, on the card of the model it was made from. A picture belongs to the opening of the scene it
  was made in (`STU.gen`, passed on by `convertFile` and Make pictures): another scene opened meanwhile, the same one
  opened again or the studio gone, and it is kept nowhere (`pvKeep`, `pvSend`: never another scene's picture under a
  path of this one, and never an object address made after `pvClear` freed them). The Upload pane's rows show it too (96 px).
  A picture that cannot be made or kept is never a reason a conversion fails. The GLB's record
  (`asset.extras.studio`) also says its size in metres (`size`, to the mm) and its triangles (`n`), for the cards.
- **The cards** (page and headset alike, `{ grid }` blocks): the Add pane's models, and the Originals fold's models (its
  other files stay a list), each a card with its picture (an original a GLB stands for shows the GLB's, else its own), a
  plain tile with the model's kind (*GLB*, *FBX*, *OBJ*...) where it has none (or its picture cannot be read), its name
  (`models/` left out; the full path as the page's tooltip), its size in metres (its largest side) and triangles where
  they are known (the model loaded here, a GLB's record, a picture made here), else its bytes, and a second line for what
  it was made from or into. Sounds stay a list. Page: a CSS grid, 3 to 5 cards a row by the pane's width. Headset canvas:
  3 cards a row (about 30 cm of panel each), the pane's *Up* and *More* paging through them as through any long pane.
  Pictures are fetched as the scene's other files are (`call`: the password as a header, or R2's signed link, read again
  as the listing's links lapse), three at a time, each once a version (its `at`); a page fetches the cards' all, a
  headset only those it draws. A changed picture (the watch) is fetched again; another scene forgets them all.
- **Make pictures** (the Add pane, a page with editing on; not in a headset, not for a visitor): *Make pictures (n)*,
  for the models the pane shows that have none (an original a GLB stands for is the GLB's), one after another: a model
  the scene has loaded drawn from that, any other fetched and loaded as the converter loads it (its textures at most
  1,024 px) and freed after. With a relay that takes uploads each is uploaded as it is made (kept in the scene for
  everyone); without, made for this page only. Its button says how far it is (*Making pictures: 2 of 5 (eva.fbx)...*),
  *Stop* ends it after the model it is making, and a line says what was made (*3 of 5 pictures made, kept in the scene.*,
  *Stopped: 1 of 3 pictures made...*, and any not made with why).
- **In a headset session** a picture (of a GLB a headset's Save writes) is drawn at the start of the next frame, inside
  the session's own frame callback (`PV.jobs`, from `frame()`), not between frames; none if no frame comes within 5 s.
- **From another scene** copies a model's picture with it (`previews/<its path>.jpg` beside the copy) when that scene has
  one.
- `HOST.cur.peek('STUDIO.state().pics')` (`pvState()`: listed, shown, failed, made here, missing, Make pictures, its line,
  what was learnt) for tests.

## The Items pane as cards (the owner, 7 November 2026)

The owner: "items need a preview in the items list tab, should show the same image and look like the add item part".
`paneBlocks('items')` and `itemCard` in `engine/e7_explore.js`, the tiles in `engine/e7e_pics.js`, the canvas in
`engine/e9_panels.js` (`drawItemCards`). Nothing in `layout.json` or the room's state changes (no `FORMAT` change).

- **One card an item**, in the Add pane's grid (page: 3 to 5 a row by the pane's width; headset canvas: 3 a row, a row as
  tall as its tallest card, the pane's *Up*, *More* and the stick scroll paging through them). The heading's counts stay.
  Groups first: a heading each (its colour, *▣ Pair*, *n items*, 🔒 when locked; a press selects the group, as its row
  did), with its members' cards under it; then what is in no group, by kind: *Objects (n)*, *Shapes*, *Empties*,
  *Trigger cubes*, *Sounds*, and *Cut-outs cutting nothing* (those whose object is not here).
- **Its picture or tile.** An object shows its model file's picture exactly as the Add pane shows it for that file (an
  original a GLB stands for shows the GLB's; `pvAny`, the same fetching, a card drawn again when its picture arrives),
  else the Add pane's plain tile with its kind (*FBX*). What has no file gets a tile drawn for it (`tileFor`: one 256 px
  canvas a kind and colour, kept; the page shows it as a data URL, `tileUrl`, so page and headset look the same; on the
  pictures' dark background): a shape its kind in its colour (cube, sphere, cylinder, plane; one that hides things
  see-through, its edges dashed), a sound a speaker in its colour, a trigger cube a see-through cube's edges in its colour,
  an empty an axis cross (x red, y green, z blue) round a ball in its colour, a cut-out cutting nothing a dashed box with
  scissors.
- **Its words**: its name; a short line (an object: its size as placed, its largest side, and triangles, *1.7 m · 24k
  triangles*, or why not yet, *Loading: 40 %*; *Sphere* or *Cube · hides things*; *Empty · 1 sound*; *Sound · 80 %* or
  *Sound · follows Dancer · Head*; *Cube · shows 2, hides 1*); a faint one (an object's or a sound's file where the name
  does not say it; what moves it, as the rows said: its motion, *spins*, *recorded path* or *recording*, its behaviour,
  *follows people*, since a headset shows no tooltip; *hidden for you*; a cube's *stays once entered* and *active for
  you*). Which GLB stands for an original (`glbFor`) is worked out once a render, and only when an object's card asks.
- **Marks** at its picture's top right: 🔒 when locked in place, *moves* when it has a motion, a recorded path or a
  behaviour. The selected item's card (or the group's heading) has a clear border in the accent colour; picking for a
  cube's list, a card on it is ticked (*✓ Post*) with a green (shows) or red (hides) border; picking a group's members, a
  member's border is the accent's. A cut-out's tag likewise: the accent's edge when selected, green or red on the list
  being picked (`pk` on the tag; the page's `.tag.pk-show` and `.tag.pk-hide`).
- **A press** on a card does what a press on its row did: selects it (its card under Item; pressed again, none), or,
  picking for a cube or a group, picks it (one Undo step each, as before). An object's cut-outs are **tags** on its card
  (*✂ Notch*; a press selects the cut-out, or picking for a cube, puts it on the list), never cards of their own.
- **Shows and Hides**: with a cube selected (editing), two small toggles under every card but the cube's own (and under
  each cut-out's tag: in the headset the tag keeps the card's whole width, its two toggles on a row under it, since beside
  it at three cards a row its name had room for a few letters), lit while the item is on that list: a press puts it on that list (off the other), again takes it
  off (`toggleLink`, one Undo step). What the page's tick boxes did, now in the headset too.
- Ids, for tests: a card's face and a heading `sel:<id>` (the regions the rows had), a tag `sel:<cut-out id>`, a toggle
  `tick:show:<id>` or `tick:hide:<id>` (the act `tick` with `show:<id>`); on the page a card is `.stu-ic[data-card=<id>]`,
  its face `.cm`, a heading `.stu-gh`.

## New scene and From another scene (the owner, 5 November 2026)

- **New scene** from the headset (the owner: yes, with the keypad) and on the page: on the Scene pane ("Editing" above).
- **From another scene...** (the owner chose copying: each scene stays self-contained), on the Add pane, page and
  headset alike: the relay's other scenes as buttons, then the one picked's models and sounds (`models/` and `sounds/`
  first, its *originals* folded), each with its size. A press copies the file into this scene at the same path (when
  that is taken here, a new name as uploads number them: *statue 2.fbx*) through `POST /api/scenes/<this>/copy` (one
  file a call), then places it as Add does (1.5 m in front, selected; one Undo step for the placing). A model that is not
  a GLB (an FBX, an OBJ, a glTF) also brings the files it names that its scene has, found as the Upload pane's plan finds
  them (`CONV.namesIn`, `CONV.mtlNames`: an OBJ's MTL and the MTL's pictures, a glTF's `.bin` and pictures, an FBX's
  pictures; an MTL or a `.bin` by the nearest of its name, a picture by the ladder, `CONV.texFind`), each copied to the
  same path relative to the scene; one whose path is taken here is not copied (this scene's own file of that name stays,
  and the model finds it), and names its scene lacks are said. A kind an upload may put only under `originals/` (an OBJ,
  an MTL) goes there with what it brings (`originals/crates/crate.obj`, `originals/crates/crate.mtl`): the paths stay
  relative to each other. What was copied and kept is said under the list (*Copied props/statue.fbx with 1 file it
  names; this scene's own figure.png kept*); copied files stay when the placing cannot be (the scene full). Each scene
  keeps its own copy: nothing in a layout ever names another scene's file.
- Not offered without a relay that takes uploads (a folder of scenes, `--scenes-readonly`), with `&visit`, while the
  scene is locked, with editing off, or when the relay has no other scene. With R2 the bucket copies (CopyObject), the
  page reads only a non-GLB model's own bytes (by its signed link) to learn what it names.
- `STUDIO.copied` (`{ path, copied, kept, lost, id }`) for tests.

## Example scenes

Scenes that ship with the app. `engine/e7g_examples.js`.

- **The folder**: `examples/` at the app's root, scene folders and their listings exactly as `tools/studio/scan.mjs` writes
  them (`examples/index.json`, `examples/<name>/files.json`, each scene's `layout.json`); `&examples=<a relative folder>`
  picks another (the tests: `tools/studio/test/examples/`, whose `tiny` scene `tools/studio/test/make.mjs` writes). The
  first is `bliss-xp`, the XP room (`tools/studio/xp/make.mjs`, another lane's). The relay serves it as an app folder
  (`APP_DIRS`, deeper than the others: `APP_DEEP`); `sw.js` treats its files as app files, network first, never in
  `SHELL`'s precache.
- **Listed** on the Scene pane, page and headset (*Examples (they come with the app)*), read once as the studio looks for
  its scenes.
- **Open**: the scene from that folder, read only, as `&scenes=examples&scene=<name>` opens it (editing works on this
  device; *Download layout.json* keeps what was changed). *Back to your scenes* returns to where scenes came from before
  (the relay, or the folder of the link). Not at a shared room's circle (the scene there is the room's, and the others
  may not have the folder): the pane says to copy it to the relay.
- **Copy to the relay** (a page only, with a relay that takes uploads, `canWrite()`): a free scene name (the example's,
  else numbered: *bliss-xp 2*), `POST /api/scenes`, every listed file fetched from the example and uploaded to the same
  path through the studio's own upload path (`upSend`: straight into R2 where it can), its pictures too, then its
  `layout.json` (its `scene` the new name) saved through the layout endpoint; the progress on the pane (*n of m files*);
  a file the relay refuses is said and the rest copied; then the copy opened from the relay with editing on.
- **For tests**: `STUDIO.examples()` (`{ list, here, folder, busy, done, of, note, prev, can }`).

## Props that follow a tracker (the owner, 8 November 2026)

Phase 1 of the Vive trackers (`tools/trackers/SPEC.md`; the owner: "we go for 1 and 3 with mixamo rigs for now").
`engine/e6k_trk.js`.

- **The trackers**: the shell's (`HOST.collab.trackers()`: each `{ id: <serial>, name, p, q, ok, k }` in room coordinates,
  `k` `'t'` a tracker, `'h'` the PC's Index, `'l'` and `'r'` its controllers; the relay's `@trk` stream, interpolated by
  the shell), read once a frame (`trkStep`, from `behaveStep`; guarded: an older shell, or none, gives none). Only at a
  studio station: the scene's frame is the room's there (v125), so a tracker's room pose is the scene's, nothing turned
  or moved. Each one's last pose is kept here (`TRK.last`), for the station it was seen at (another station: none seen
  yet). Base stations are never offered.
- **The record** (an object's, a shape's or an empty's; `layout.json` and `state()` alike): `trk: { id, o, q }`, kept
  only when set: the tracker's id (its serial: a letter or digit, then up to 39 of letters, digits and `_ . : -`), the
  item's place in the tracker's frame (metres to the mm, turned but not scaled, within 1 km; `[0, 0, 0]` when left out)
  and its turn there (4 decimals; none when left out). Anything else makes the record bad (the layout counts it; the room's
  record is ignored and the item kept). Cubes, sounds, cut-outs and groups have none.
- **Drawn** by the pose pipeline's base stage (`POSE.base`, `poseBase`: an item on a tracker first, else a behaviour's,
  `behaveBase`; set only while the scene has either, so a scene without one is drawn exactly as before): the tracker's
  pose times its offset, at the item's own scale (an object's `s`, a shape's size); its recorded path and its motion draw
  over it, and the record never changes. A tracker not seen this frame (gone from the shell's list, or not `ok`): its last
  pose here held; one never seen here: the item where it is placed. Like everything that moves it rests at its placed
  pose while held here (carried, its arrows dragged) or paused (v122), and its ghost shows there while editing. A sound
  may follow it as any item (it moves with it).
- **The card** (page and headset, editing on, before Behaviour): *Follows a tracker*: *None*, *<its name> ▸* (the list:
  the trackers known here, by the name the room gave them, `trk.names`, else the serial, with the Index's kinds said and
  *seen* or *not seen now*), *Snap onto it*; and how it stands (moving with it, held where it was last seen, or not seen
  here: where it is placed). Choosing a tracker keeps the item where it stands now (its offset from the tracker's pose
  now; where its old tracker had it, else where it is placed); *Snap onto it* sets the offset to none (right on the
  tracker); *None* leaves it where the tracker had it (its record's place and turn written from there). One Undo step
  each, shared and saved; refused while it is locked in place (as moving it is). The list is this device's own.
- A copy (Duplicate, a group's) follows no tracker: it is new, to be put where it goes. A GLB switch turns its offset's
  turn by the baked turn (`q' = q r^-1`, `switchedRec`), so the model stays where it was on the tracker.
- `STUDIO.trk(id)` for tests: the station, the trackers here, those held, and an item's `trk`, whether it is on it, its
  pose there and whether its tracker is seen.

## Worn with trackers: a Mixamo character (the owner, 8 November 2026)

Phase 3 of the Vive trackers (`tools/trackers/SPEC.md`, "The studio, phase 3"). `engine/e6l_puppet.js` and the solver
`engine/ik.js` (`makeIK`, in the build since v126, as `convert.js` is; its contract is the comment at its top and
"The solver (ik.js)" in `tools/trackers/SPEC.md`).

- **Which models**: an object whose model is rigged (`E.info.rigged`) with Mixamo's bone names (`IK.rigOf`, found once
  per model built, at its rest pose as loaded: `pupRig`). A rigged model of other names is told why on its card (*Not a
  Mixamo rig: no bone named mixamorig:Spine, ...*, *Wear it with trackers* greyed); one with no bones shows nothing of it.
- **The record** (an object's): `puppet: { on, rig, by, map, cal, s, floor }`, kept only when set: `on` (false when left
  out), `rig` `'full'` (trackers on the hips, head, both wrists and both feet; the chest, elbows and knees if worn, up to
  11) or `'feet'` (a tracker on each foot, the head and hands from a headset and its controllers; `'head'`, a headset
  alone, waits: the owner), `by` (`'feet'`: `'index'`, the PC's Index, whose headset and controllers come with the
  trackers, or the performer's member id, their own headset; '' none), `map` (each part, `hips`, `head`, `chest`,
  `lhand`, `rhand`, `lfoot`, `rfoot`, `lelbow`, `relbow`, `lknee`, `rknee`: a tracker's id, or `'@head'`, `'@l'`,
  `'@r'` for the performer's own headset and controllers), `cal` (each part's offset from its tracker to its bone, seven
  numbers: a place within 100 m to 0.1 mm, a turn to 5 decimals; an offset for a part nothing drives dropped), `s` (the
  object's scale when it was lined up; 4 significant figures) and `floor` (the scene's floor then, 0). Anything else
  makes the record bad. Shared and saved; every device solves the same pose from the same trackers and the same record
  (nothing per bone is sent). A copy (Duplicate, a group's) is worn by nobody. A GLB switch keeps it (its `s` divided by
  the baked scale, as the object's).

  ```json
  "puppet": { "on": true, "rig": "feet", "by": "index",
    "map": { "head": "LHR-INDX0007", "lhand": "LHR-INDL0008", "rhand": "LHR-INDR0009", "lfoot": "LHR-1A2B3C4D", "rfoot": "LHR-5E6F7A8B" },
    "cal": { "head": [0.01, 0.05, 0.08, 0.1, 0.2, 0.3, 0.92736], "lfoot": [0, -0.05, -0.04, 0, 0, 0, 1], "...": [] }, "s": 1.02, "floor": 0 }
  ```
- **Lining up** (*Line up with the performer*, its card; refused while it is locked in place): a 5 s countdown on the
  card (this device's own, `PUP.line`; *Cancel*), the performer in a T-pose in front of the character facing its way,
  arms out; then, on the device that pressed it, one change, one Undo step: the trackers seen given their parts
  (`IK.assign`: `'full'` 6 to 11 trackers; `'feet'` the feet, with the Index's `'h'`, `'l'`, `'r'` for `by` `'index'`, or
  `'@head'`, `'@l'`, `'@r'` for a performer's own headset), the character moved along the floor to where the performer
  stands (so that its parts at rest are, on average, where their trackers are: a belt's tracker behind the hips, a foot's
  in front of the ankle and a headset in front of the eyes mostly cancel out; the parts' offsets keep what is left; the
  character's turn is kept), scaled so its hips (`'feet'`: its eyes) are as high as the performer's (`IK.calibrate`, then
  again at the scale the record keeps, 4 significant figures, for the offsets), and `puppet` written `on` with its `map`,
  `cal`, `s` and `floor` (with the object's `p` and `s`). *Line up again, these parts* keeps the parts as they are. Refused
  in words (the card says why): no trackers here, too few, no hand found on both sides, a hips tracker not 0.4 to 1.5 m
  up, no Index or its controllers seen, and the like (`IK`'s sentences).
- **Solved** (`pupStep`, in place of its animation in `itemsStep`, while it is shown): on and lined up, its own clip is
  off (stopped, its bones at rest first) and its bones are solved every frame (`IK.solve`) from its targets in the world:
  the trackers' poses (held while not seen), and for `'@...'` this device's own head and controllers (their rays' poses)
  when it is the performer in its session, else `HOST.collab.body(by)` (its `head`, `l` and `r`, each `{ p, q }` or seven
  numbers, in room coordinates; guarded). Not solvable now (a part never seen here): at rest, the card saying why. Pause
  holds the pose it shows. Its holder stays where it is placed (the pointer finds it there; while editing a ghost shows
  it there, `clipMoves`): the solver puts the bones where the trackers are. Off: its clip again, from its rest pose. A
  sound may follow its head bone (or any) as any model's.
- **Its parts** (the card): each part, the tracker driving it (*not seen*, *not lined up*); a press lists the trackers of
  its kind here, and choosing one gives the part that tracker (a part that had it swaps), `puppet.on` false and its
  offsets gone until *Line up again, these parts*. *Head and hands from: The PC's Index / This headset* (`'feet'`; this
  headset in a session in a room) changes `by` (the feet kept, the rest lined up again).
- **Takes** (*Record a take*, on and lined up; this device's own until it is made): a 3 s countdown (*Cancel*), then the
  solved bones (each part's local turn, normalised, and the hips' place) sampled after each solve once each thirtieth of
  a second of the room's clock (`pupClock`: the relay's at a station, so the tracker stream's), until *Stop* or 120 s;
  then `IK.clipOf` makes them *Take n* (the first free name among its file's clips) bound by the bones' own names of the
  model the converter reads (`takeInto`), and the object's GLB is made again with its clips and the new one through the
  converter (`convertFile` with `take`): a GLB of `models/` made again into itself (the old one kept under `originals/`),
  else a GLB in `models/` with every object of the file switched to it, a new picture; without a relay that takes uploads,
  downloaded. Too short (fewer than two keys) is said. The take then plays as any clip (*Animation*, wearing off).
- `STUDIO.puppet(id)` for tests: its rig (`'ok'` or why not), its record, lined up, solved now, why not, the lining up
  and take under way, the last word on it, whether its clip plays. `pupClock` is a function the tests replace.
- Untested on devices: everything with real trackers, the Index and a Quest's head and hands (`HOST.collab.body`), how
  the character looks and how a performer's trackers stay on, the lining up's placement in practice, takes made through
  a real relay.

## Formats guide (`tools/studio/README.md`, and briefly on the Scene pane where no scene is found)

Models: GLB (one file, textures and animations inside); FBX works, converted it loads faster and sits right without
guessing. Textures: JPEG for photos and scans, PNG only for see-through; at most 4,096 px, 2,048 safer on a Quest.
Budgets on a Quest: about 300,000 triangles a model, 500,000 a scene (*Fewer triangles* on a model's card or the Upload
pane's share brings a scan down, 20 % to start; the gaps between its texture's pieces are filled, so it shows no black
seams). Sounds: mono; short loops as WAV (MP3 adds silence
at its ends, so a loop clicks; OGG does not play on iPhones); long ones (more than 20 s, streamed) as MP3 at 96 to 128
kbit/s. The upload page does all of this by itself; by hand: Ready
lines: `ffmpeg -i in.wav -ac 1 -c:a pcm_s16le loop.wav` (a loop), `ffmpeg -i in.mp3 -ac 1 -b:a 96k out.mp3` (a
long one), and `node tools/studio/convert.mjs model.fbx` (a batch on a computer with Playwright).

## Tests

- v137: the smoke test's *studio everyone*, *studio walls*, *studio shows* and *studio examples* steps (each `--only` of
  its own): "Testing" in `AGENTS.md`.
- Editing without the cost (v136): the smoke test's *studio edit speed* steps (`--only 'studio edit speed'`, a minute):
  "Testing" in `AGENTS.md`.
- The smoke test's step for the Add pane's grid and pictures (v120, on the test scene, no relay), relay/test.mjs's
  `previews:` steps (the folder and R2) and `tools/collab.mjs --studio`'s pictures step: "Testing" in `AGENTS.md`.
- The smoke test's *studio shapes* steps (v119, on the test scene) and `tools/collab.mjs --studio`'s step for shapes,
  empties, a lock and a scene setting: "Testing" in `AGENTS.md`.
- Behaviours (v120): the smoke test's *studio behaviours* steps (on the test scene, with a shape that looks, a ball that
  follows, an empty that keeps away and a cube that follows the ball put in for them) and `tools/collab.mjs --behave`:
  "Testing" in `AGENTS.md`.
- Motions (v120): the smoke test's *studio motions* steps (on the test scene, with a shape, an empty, a sound and a cut-out
  put in for them) and `tools/collab.mjs --studio`'s step for motions: "Testing" in `AGENTS.md`.
- Recorded paths (v120): the smoke test's *studio paths* steps (on the test scene, with a shape, an empty and two sounds put
  in for them, the recorder's clock the test's) and `tools/collab.mjs --studio`'s step for a path recorded on the headset:
  "Testing" in `AGENTS.md`.
- Stays on the floor (v130): the smoke test's *studio paths* step of that name (`--only 'studio paths'`): "Testing" in
  `AGENTS.md`.
- Ten minutes as a file and a voice with the movement (v125): the smoke test's *studio recorder* steps (a relay of its own
  on a copy of the test scene, Chromium's fake microphone; `--only 'studio recorder'`), relay/test.mjs's `recordings:` and
  R2 steps and `tools/collab.mjs --studio`'s step for a ten-minute recording and a voice: "Testing" in `AGENTS.md`.
- Trigger cubes that change textures (v124): the smoke test's *studio texture swaps* steps (on the test scene, with two
  solid pictures made in the page, a second object of `box.glb` and three cubes put in for them; `node tools/smoke.mjs
  <url> --only 'studio texture swaps'` runs them alone): "Testing" in `AGENTS.md`.
- Trigger cubes that start things (v136): the smoke test's *studio cube starts* steps (on the test scene, with a clip
  *Lift* added to `box.glb` in the page, a second object of it, four cubes, two sounds, a shape on a path, a spinning empty,
  a wobbling shape and a voice recorded with the path put in for them, the studio's clock held by the test; `node
  tools/smoke.mjs <url> --only 'studio cube starts'` runs them alone) and `tools/collab.mjs --studio`'s step for a cube
  that starts something (each device's own, its record everywhere): "Testing" in `AGENTS.md`.
- Nothing see-through while editing (v131): the smoke test's main *studio* step of that name (`--only 'studio:'`; the box a
  cube hides as its outline and tag, held whole by a pretend grip and the page's arrows, the cube's edges picked from
  inside and outside, a hidden shape, a ball that hides things, the tags' and labels' triangles, a pixel where the hidden
  box stands), the *studio cuts* look step (opaque, darker cutting nothing), the *studio shapes* pixels step, the *studio
  motions* ghost step (opaque light grey, a clip ghost and a big one opaque lines) and the Fewer triangles step's counts:
  "Testing" in `AGENTS.md`.
- The ghost, Pause and the loop join (v122): the smoke test's *studio motions* step for a ghost, the arrows on it, a grip
  on it, Pause, Start again and a cut-out on a moving model, and its *studio paths* step for the recording's ghost and the
  loop join: "Testing" in `AGENTS.md`.
- The scene on the room's frame and *Move the scene to this circle* (v125): `tools/collab.mjs --studio`'s step after From
  another scene (the headset at a circle away from the room's origin drawing every item at its record's place in room
  coordinates; the circle moved 2 m and turned 90 degrees, every item staying put frame by frame; the button refused while
  an item is locked, then every item at the circle's spot transform of its old place, one Undo step, the same on every
  device): "Testing" in `AGENTS.md`.
- Tint and brightness (v125): the smoke test's *studio tint* steps (on the rig test scene, with Twin, a copy of the box's
  file, put in for them; `--only 'studio tint'`) and `tools/collab.mjs --studio`'s step for a tint set on one page:
  "Testing" in `AGENTS.md`.
- The viewer (v125): the smoke test's *studio viewer* steps (on the test scene, the test originals dropped and a dense ball
  made in the page; `--only 'studio viewer'`): "Testing" in `AGENTS.md`.
- Props that follow a tracker and a character worn with trackers (v126): the smoke test's *studio trackers* steps (on the
  test scene, a pretend studio station and its trackers in the page; `--only 'studio trackers'`) and *studio puppet*
  steps (on the puppet test scene, its rig loaded a second time walking as the performer, the trackers worn on it;
  `--only 'studio puppet'`); `node tools/studio/test-ik.mjs` (the solver alone): "Testing" in `AGENTS.md`.

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
  the scene's folder appearing in the Add list within a few seconds, the station's story locked refusing edits; a group
  made and moved on a page reaching every device (each member within 1 cm), a Faces setting from another page reaching
  every device's materials, the saved layout carrying `groups` and `faces`.
- Groups and Faces: the smoke test's *studio groups* and *studio faces* steps, on the rig test scene ("Testing" in
  `AGENTS.md`).
- v118: the smoke block's three steps after the headset's grips (inside a model, Hold it, stick scrolling; New scene,
  From another scene and a circle made for one scene with a stubbed relay and keypad); `relay/test.mjs`'s copy steps
  (a folder's and R2's, the password's list) and `relay/test-r2.mjs` (CopyObject's `x-amz-copy-source` signed, an
  unsigned one refused by the stand-in); `tools/collab.mjs --studio` (From another scene through the relay and in R2, a
  circle made for one scene as the shell writes it, New scene from the headset with the keypad stubbed).
- v119: the smoke block's Fewer triangles and Change texture step (a dense textured ball made in the page, served as
  `ball.glb`, nothing committed: the preview at 20 % within 1 %, its corners' texture coordinates exactly as before and
  its colours as before, the slider at 50 %, the headset's card and its 10 %, Save downloaded with `tris` in its record,
  the balls switched to it with the original as the base, Change texture shown, cancelled and saved with `tex` in its
  record, in the headset by the ray, nothing for a visitor; the Upload pane's share, count, picture and conversion);
  `tools/collab.mjs --studio` (the ball saved at 20 % on a page through the relay, every page's and the headset's switched
  as light as previewed; a picture put in its colour slot and saved from the headset, its share kept).
- v120: the fill. `node tools/studio/test-images.mjs` (`cover`: two triangles splitting a picture, the diagonal in both,
  a tiny one marking its own texel; `fillGaps` on a 64 px atlas of three shaded pieces on black: the covered texels
  unchanged, no black left, every texel beside a piece an exact copy of an edge colour within three texels, alpha kept,
  and filled when asked; a picture drawn down 2 and 4 times by a box filter, its pieces' edges between texels: without
  `rim` a dark halo, with it none, a strip two texels wide keeping its own texels; a 4,096 px one). The smoke block's step after Fewer triangles' (an atlas ball made in the page:
  128 wavy pieces with 6 px of black between them, 24,320 triangles, placed as scanned; pixels read back from four sides:
  none black with all its triangles, many at 10 % without the fill and none with it, in the preview and in the GLB Save
  downloads against the converter's own GLB made with `fill: false`; the fill worked out once for two shares; the record's
  `fill`, its line in the notes, the placed GLB's card line, and Fewer triangles on it filling nothing again; a picture
  that tiles and one a plane uses whole left alone; a 256 px piece drawn down 4 times by `CONV.picture` with a `max`
  filled with no dark rim beside it, the same drawn down by hand (the converter not told) with one; a see-through picture
  whose gaps are clear left alone and said, one whose gaps are opaque black filled, its alpha kept).
- How it looks and feels on a headset (the scan's size, frame rate with a 400k-triangle scan, the grips, the stick walk,
  how the emitters sound through HRTF) is untested until tried on one.

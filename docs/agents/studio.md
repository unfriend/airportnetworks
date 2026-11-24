# The studio (`stories/studio.js`, `tools/studio/`)

Read on demand; the rules every agent needs are in AGENTS.md.

## The studio is built the same way

`stories/studio.js` (*Your own scenes*) is generated from `tools/studio/` (`node tools/studio/build.mjs`,
`--check` as for the tour): the shared kit (`tools/engine/kit.js`), three.js r128's own add-ons from `tools/studio/vendor/` (pasted with their
licence lines, each wrapped so nothing leaks but `THREE.*`; `GLTFExporter` only inside `exporterLoad()`, defined when
the studio first converts), two sets (`stage`, `looks`) and engine parts adapted from the design room's (the
shared-room, headset-setting, subtitle, panels, recenter, framing and sound-effect lines as in every story: the smoke
test checks them in every `STORY_EXTRA` page). `tools/studio/SPEC.md` is the contract; `tools/studio/README.md` the
formats guide and the upload page; `relay/README.md` the relay's side.

- **What it is**: a room where the owner's own models (FBX and other formats, textured, some animated) are placed and
  their places saved, with trigger cubes that show and hide them by where people go and spatial sound emitters. Not one of the stories: its entry is in `STORY_EXTRA` after the
  design room (kick *Studio*, title *Your own scenes*, colour `#e6d3b8`, icon `studio.stage`, `life: true`), so it is on
  no Stories screen and not counted; `#studio`, the menu's *Studio* (Settings tab), a station or the relay's `/upload`
  open it. No narration: one short intro (5 s: the scene from a little way off, then the walk up to it) for a new
  wearer or Replay, then explore mode, the scene; its end never starts Repeat. The two files the owner sent as examples
  (an atelier scan, binary FBX, 397,066 triangles, an 8,192 px JPEG inside, in centimetres; a rigged figure, binary
  FBX, one 51 s take, its PNG beside it, Z up) are kept outside the repository, as every scene of the owner's is.
- **Scenes.** A scene is one folder: models, their textures, sounds and `layout.json`, where everything placed stands.
  An item is one thing placed: an object (a model file placed once; one file may be placed many times), a trigger cube
  or a sound. What the studio makes goes into the scene's `models/` (GLB), `sounds/` and `originals/` (the files as they
  were given, so a model can be converted again); files elsewhere in the scene work as well. The scenes come from the
  relay (`--scenes <dir>`; `HOST.collab.relayFind()` finds it: "The studio's scenes on the relay" under "Shared rooms"),
  else from a plain folder next to the app (`scenes`, or `&scenes=<relative folder>`: only a relative path, no `//` or
  `..`) that `node tools/studio/scan.mjs <folder>` describes (`index.json` and `<name>/files.json`, what the relay's
  API answers, by the same rules, `relay/scenes.mjs`; read only, so *Download layout.json* in place of Save). The scene
  opened: the link's `&scene=`, else the last used here (`studioLast.<source>` in `localStorage`), else the only one,
  else the list (*Pick a scene*). The relay's watch keeps it current: a changed file is fetched again and its items
  rebuilt where they stand, a new file shows in the Add list, a scene that comes or goes changes the picker, and a
  layout saved elsewhere updates *Saved* (it never replaces what is placed by itself). With a password the studio
  fetches every file with it (the loaders through their `LoadingManager`'s `setURLModifier`, `?token=`; sounds and
  JSON with `Authorization: Bearer`); the first 401 goes to the shell once (`HOST.collab.relaySaw`), which asks where it
  always does, and the studio then asks nothing more of that relay until the shell holds another password (seen alike
  twice, 2 s apart), when it lists the scenes again and fetches what was refused.
- **Models.** GLB and glTF (`GLTFLoader`: PBR materials, every clip, KTX2 textures since v151: "Compressed textures (KTX2)" below; no Draco or Meshopt, which its card says),
  FBX (binary or ASCII, version 7 and up), OBJ with its MTL, PLY (vertex colours) and STL. Textures a file names but
  does not hold are found in the scene's pictures by the ladder ("Textures" below; the author's own path ignored); one
  not found leaves the model untextured and its card says *Missing texture x.png: put it in the scene's folder* and
  offers pictures for it. Textures
  over 4,096 px are drawn down before they reach the GPU (`&maxtex=` 512 to 8,192; the card says so: the atelier's 8,192
  px JPEG alone would take about 340 MB of a Quest's memory; every texture reaches the GPU as raw pixels, 4 bytes each and a third more for its mipmaps: 21 MB at 2,048 px, 85 MB at 4,096, 341 MB at 8,192). What a Quest 3 offers (the owner, 16 November 2026, from v150's Debug tab): textures of at most 8,192 px a side in Quest Browser (its Adreno 740 takes 16,384 natively, but the browser's WebGL stops at 8,192, so nothing larger can work there), and ASTC, ETC1 and ETC2 among its compressed formats, so KTX2 textures with Basis UASTC reach it as ASTC 4x4 (8 bits a pixel: 85 MB at 8,192 px, 21 MB at 4,096; built in v151 with r133's KTX2Loader: "Compressed textures (KTX2)" below). The units and up axis are guessed when a file is first
  placed and then stored in the item (`s`, `q`), so a layout never changes when the guess does: an FBX's
  `GlobalSettings` (`UnitScaleFactor`, `UpAxis`, `UpAxisSign`, read from the file's bytes, since the loader ignores
  them), taken when they make the model's largest side 5 cm to 60 m, else 1 unit is 1 m if that does, else it is sized
  to 1 m; glTF is metres and Y up; OBJ, PLY and STL say nothing, so metres, centimetres or millimetres, whichever fits.
  The card's Scale line says what the file said and what was made of it. The atelier comes out 7.4 m wide (scale 0.01),
  the figure 1.66 m tall (stood up from Z up). One file is loaded once and cloned per object (`SkeletonUtils.clone` when
  rigged), each with its own `AnimationMixer`; a file no object uses any more is dropped and its GPU memory freed. Each
  object is *lit* (a sky and ground light, one over your shoulder; glTF's PBR gets a soft room-like environment) or *as
  scanned* (unlit, its own colours: photogrammetry has its light in its texture); a mesh without normals starts as
  scanned, and lit it is shaded flat. An FBX material of opacity 0 with no alpha map (3ds Max's habit) is drawn solid,
  and the card says so. The card: its file, size in metres as placed, triangles, textures and their sizes, clips and
  warnings, with Quest budgets (shown, never refused): over 500,000 triangles in the scene, 300,000 in one model, more
  than 6 textures over 2,048 px. A model loading (or one this device cannot find) is a grey box with a line of text
  where it will stand: parsing a big FBX stalls the page for seconds (more on a headset).
- **GLB first**. One converter (`tools/studio/engine/convert.js`,
  `makeConverter(THREE, hooks)`) serves the studio, its Upload pane and `tools/studio/convert.mjs`: it bakes the guess
  in (metres, Y up), draws textures down (to the page's texture kind: KTX2 at most 8,192 or 4,096 px, the default since
  v151, or JPEG/PNG at most 4,096 or 2,048, *For Quest*'s old default; opaque ones as JPEG, the rest PNG), makes
  Phong and Lambert materials standard ones, fixes the opacity-0 quirk, welds repeated corners, keeps animations and
  skins, and records what it did in `asset.extras.studio = { from, s, q, at, scan }` (`from` the original's path in the
  scene, `s` and `q` the scale and turn baked in, `scan: true` for a mesh without normals). It turned the atelier's 14
  MB FBX into an 11.4 MB GLB that parses in 0.3 to 0.7 s instead of 1 to 2 s, and the figure's 3.7 MB into 3.0 MB with
  its skin and take exact, 0.03 s instead of 0.55 s. *Convert to GLB* (pages only, editing on; a headset says *Convert
  on a laptop*) on an object's card, and *Convert every model* in the Add pane: with a relay that takes uploads the GLB
  goes to `models/<name>.glb` and every object placed from the original switches to it where it stands (`s' = s / b`,
  `q' = q * r^-1` for the baked scale `b` and turn `r`; one change, one Undo step, for everyone at a station); else it
  is downloaded. The Add list shows `models/`, `sounds/` and everything outside `originals/`, with `originals/` folded
  under *Originals*; a GLB whose record (read from its first bytes with a `Range` request) names another file of the
  scene, or without one has its base name, stands for it, and a placed original's card offers *Switch to the GLB*.
- **Textures: found, added, converted** (`tools/studio/SPEC.md` has it in full). The browser shows PNG, JPEG, WebP, GIF, BMP and AVIF, TGA goes through `TGALoader`, and **TIFF** (none, LZW,
  PackBits, Deflate; 1 to 16 bits; grey, RGB, palette, CMYK), **PSD/PSB** (the merged picture) and **DDS** (uncompressed,
  DXT1, DXT3, DXT5, BC4, BC5) are read in the page by `tools/studio/engine/images.js` (fflate for the zipped ones);
  EXR, HDR, HEIC, KTX, BC6H/BC7 and JPEG-in-TIFF are refused with a sentence. The converter's `load` reads such a picture
  a model names first and gives its loader a PNG (an FBX's `.psd` names, which r128's loader never asks for, made `.ps~`
  in a copy of its bytes and back in the URL modifier; a `.tga` name read whatever its bytes are). **The ladder**
  (`CONV.texFind`): the path the model gives, its name in any case (nearest folder first), the same name as another kind
  of picture (`x.tga` finds `x.png`), then the same words but colour words (`diffuse`, `albedo`, `basecolor`...), in the
  same slot (`CONV.slotOf`: normal, roughness, metalness, occlusion, glow, opacity, `orm`, by name words or a normal
  map's colour), only when exactly one picture is so; the card says each one found under another name or read from a
  TIFF, PSD or DDS. **By hand** (an object's card, pages with editing on, never `&visit`; a headset says *Add a texture
  on a laptop*): each missing name offers *Use <file>* (up to three of the scene's pictures, `CONV.texRank`) and *Choose
  a picture...* (with a relay into `originals/`, else from memory), and *Add a texture...* lays a picture on a material
  with texture coordinates (a material, a slot: Colour, Normal, Roughness, Metalness, Occlusion, Glow, Opacity). One
  press converts at once through Convert to GLB's path (`texGo`, `convertFile(path, { tex, into })`): the pictures baked
  into `models/<name>.glb` (objects switched where they stand; without a relay downloaded), **never stored in the layout
  or `collab.state()`** (no `FORMAT` change), recorded in the GLB as `asset.extras.studio.tex` (`[{ name, mat, slot,
  from, how }]`), so converting the original again lays the ones chosen by hand on again; an object on a GLB is fixed by
  making that GLB again (from its original when it is in the scene, else from itself, the old one kept under
  `originals/`). In the GLB separate roughness and metalness pictures are packed into one (green and blue) and a bump map
  becomes a normal map. The Upload pane lists each texture a dropped model names (found, how, or *Use* and *Choose a
  file...*), pairs the only picture left over with the only model lacking one (`only`), takes a picture dropped onto a
  model's row, and at convert time gives a model with no colour picture a left-over one of its name (`stem`).
  `convert.mjs`: `--texture <name>=<picture>`, `--texture <material>:<slot>=<picture>`, `--textures <dir>`. The relay
  lists `.tif .tiff .psd .psb .dds .avif` as images. Untested: real Photoshop, Substance and game-engine files beyond the
  generated ones and those ImageMagick and Pillow write (checked by hand), a big TIFF or PSD's memory on a headset.
- **The upload page**. `<relay>/upload` sends the
  browser to the studio's **Upload** tab (`#studio&upload`; pages only, none in a headset or with `&visit`): pick a
  scene or *New scene*; drop files or whole folders (or *Choose files*, *Choose a folder*); the plan shows one row per
  thing it will make before anything happens (a model with the files it names, wherever they were dropped: textures,
  an OBJ's MTL and its textures, a glTF's `.bin`; each sound; anything left *kept as it is* into `originals/`, never
  dropped; a missing texture said in its row); *Textures* (v151, in place of *For Quest*: *Compressed (KTX2), up to 8k*,
  the default, *Compressed (KTX2), up to 4k*, *JPEG/PNG, up to 4k*, *JPEG/PNG, up to 2k*: "Compressed textures (KTX2)"
  below; a video's height is *Videos for Quest (720p)*, beside *Convert videos*) and *Replace files with the
  same name* (off: a name taken gets a number, `eva_001 2.glb`); *Convert and upload*, with progress per row; then *Open
  the scene* (editing on). Models become `models/<name>.glb` by the converter (loaded back and checked; a row that fails
  says why and makes nothing). Sounds become mono, so they place well: up to 20 s decoded in the page (an
  `OfflineAudioContext`, the one exception to the sound rule: "How the shell and stories fit together") into a 16-bit
  WAV at their own rate (at most 48 kHz), `sounds/<name>.wav` (gapless loops; OGG does not play on iPhones); longer ones
  sent to the relay's `ffmpeg` for `sounds/<name>.mp3` (mono, 96 kbit/s, 44.1 kHz), and without it an MP3, M4A/AAC or
  OGG kept as it is (played from one point) and anything else a mono 22.05 kHz WAV. Every given file also goes into
  `originals/<the dropped folders>`. Without a relay that takes uploads the plan still shows and *Convert* offers each
  GLB and WAV as a download. A × on every row still to make takes it out of the
  plan (`upDrop`: its files leave what was dropped, a model's with the files it needs and its pictures, unless another
  row still uses them; nothing of it is made, uploaded or kept), and *Triangles kept, every model* above the list sets
  every model row's share at once as it moves (`UP.keepAll`, `upKeep()`; a row's own slider can still differ after, a
  line then says so, and a later drop starts at it).
- **Compressed textures (KTX2)** (v151; the owner, 16 November 2026: "yes build it, encoding in browser since that can be
  done on a desktop and be fast"; `tools/studio/SPEC.md`, "Compressed textures (KTX2)"; `engine/ktx2.js`). **Why**: a JPEG
  or PNG texture reaches the GPU as raw RGBA (4 bytes a pixel and a third more for its mipmaps: 21 MB at 2,048 px, 85 MB
  at 4,096, 341 MB at 8,192), which is why textures were held to 2,048 px for Quest; the owner uses 4k and 8k textures in
  Unity on Quest (Unity ships ASTC), and v150's Debug tab on a Quest 3 said Adreno 740, `MAX_TEXTURE_SIZE` 8,192, and
  ASTC, ETC1, ETC2. **What**: a GLB the studio writes may carry KTX2 textures (glTF's `KHR_texture_basisu`: Basis
  Universal UASTC LDR 4x4, zstd), up to 8,192 px, which three.js r133's `KTX2Loader` transcodes as the model loads to what
  the GPU keeps compressed: ASTC 4x4 on a Quest (8 bits a pixel: 85 MB at 8,192 px, 21 MB at 4,096), BC7 on a desktop,
  ETC2 or ASTC on a phone, RGBA as a last resort. **How**:
  - **The texture kind** (`TEXK`, `texKind()`, `maxTexNow()`, `ktxNow()`, `texKindWords()`, `texLine()` in
    `engine/e7b_upload.js`): the Upload pane's *Textures* row, in place of v150's *For Quest*: *Compressed (KTX2), up to
    8k* (the default on a page), *Compressed (KTX2), up to 4k*, *JPEG/PNG, up to 4k*, *JPEG/PNG, up to 2k*, this device's
    own (`studioTexKind` in `localStorage`, absent the default), with a line saying what it means. Every GLB-writing path
    uses it: the Upload pane's rows, *Convert to GLB*, *Convert every model*, Fewer triangles' and Change texture's Save,
    the missing-texture buttons, a take (`convertFile`), the room scan (`e6p_scan.js`); their lines say it
    (*textures compressed (KTX2), at most 8,192 px*). **A headset never encodes**: in a session (`XR.on`) or on Quest
    Browser's (Pico's, Wolvic's) own page the kind is *JPEG/PNG, up to 2k* whatever this device chose, and the words say
    *compressed (KTX2) textures are made on a laptop or desktop*; a page that cannot encode (no workers or WebAssembly)
    writes JPEG/PNG up to 4k. A video's height kept the videos' part of *For Quest*: *Videos for Quest (720p)*, beside
    *Convert videos to MP4*. What is only looked at is read at most 4,096 px whatever the kind (`maxTexView()`: the
    viewer's Add card and an Upload row's Preview, Change texture's preview on the placed model), as before KTX2: an 8,192
    px picture is 268 MB as RGBA (341 MB with its mips on a GPU); what is written reads it again at the kind's own size.
  - **Writing** (`toGLB(m, { ktx2: { effort } })`, `KT.capture`, `KT.glb`): the exporter writes the GLB as ever but its
    pictures are taken from its own canvases as it draws them (flipped and sized as glTF wants), never made PNG or JPEG:
    `HTMLCanvasElement.prototype.toBlob` is replaced only for the synchronous length of `GLTFExporter.parse` (each call
    copies the canvas and hands back a short tag, `KTX2-STUDIO-<k>`, which then stands in the GLB in the k-th image's
    place). Each picture is then sized to a multiple of 4 on each side (and at most the kind's 8,192 or 4,096), told colour
    or data by the texture slots that use it, the materials' extensions' too (`slotsOf`: base colour, emission, and a
    diffuse, specular, sheen or diffuse transmission colour sRGB; normals, roughness and metalness, occlusion and every
    other slot linear); a picture used both ways is written twice (`split`: a linear copy on a bufferView of its own, its
    data uses pointed at it, a texture used both ways copied for them; a KTX2 has one transfer function, and its mips are
    made in linear light for colour only), its alpha looked at over the whole picture (any texel under 255: forced on every strip, so the
    strips agree), its mip chain made in the page (a 2 x 2 box filter, in linear light for colour, the share each texel
    covers where a side is odd, down to 1 x 1), and every level encoded in strips by a pool of workers (`pool()`: the
    computer's cores less one, at most 6; each a worker made from a Blob that imports `basis/basis_encoder.js`, the
    encoder's WebAssembly compiled once in the page and handed to each, since this build reads no `wasmBinary` but takes
    an `instantiateWasm`). The glTF is rewritten: each image's bufferView the KTX2's bytes, `mimeType` `image/ktx2`, its
    textures `extensions.KHR_texture_basisu = { source }` with no other source, the extension in `extensionsUsed` and
    `extensionsRequired`, BIN made again with every bufferView 4-byte aligned. The record says so: `asset.extras.studio.ktx2
    = { n, effort, max, zstd: true }`; a note says how many, how long, the GPU's bytes and the file's. The pool is closed
    as each GLB is done (its workers terminated); the studio's dispose stops any still running (`KT.stop()`).
  - **The strips** (the spike, then `tools/studio/test-ktx2.mjs`): the WASM encoder refuses more than 12,582,912 source
    texels in one encode, mipmaps included, so a 4,096 px picture cannot be encoded whole. UASTC is made 4 x 4 block by
    block, each alone (no rate-distortion pass: it is off), so each level is cut into full-width strips (at most 4 million
    texels, at least a quarter of a million where the level is that big, as many as twice the workers; each a multiple
    of 4 rows but the last), each encoded alone (one level, no mips), and their blocks put one after another make the
    level exactly as a whole encode would: byte for byte without zstd at efforts 0, 1 and 2 (checked), and with zstd each
    strip is its own zstd frame and the frames joined are one valid stream (read back pixel for pixel the same). The KTX2
    is written here (`write`: the strip's DFD and key-value data kept, levels laid out smallest first, aligned to 1 byte
    when supercompressed, else 16).
  - **The effort** (`KT.EFFORT`, 1; `--effort` in `convert.mjs`): measured on scan-like test pictures made in the page
    (fractal noise, hard cracks and grain), 3 workers on 4 slow cloud cores: efforts 0 and 1 write the same file in the
    same time (the encoder's UASTC level 0 of 0 to 4): 4,096 px in 2.5 s, 8,192 px in 8 s, 45.2 dB on the busy picture,
    52.4 dB on a smoother one, about 10 bits a texel in the file (zstd saves little on such content without RDO; flat
    colours far less); effort 2 took 4.5 times as long for at most 0.2 dB, effort 4 seven times as long for 0.1 to 0.8 dB.
    So the fastest, 1. RDO stays off (it would make zstd pay but costs quality and three times the time); zstd stays on.
  - **Showing** (`e5_models.js`: `ktxLoader()`, `capCompressed`): one `THREE.KTX2Loader` per studio (three.js r133's,
    vendored, pasted in by `build.mjs` with its `WorkerPool`), made when a model first loads, its transcoder the app's
    `basis/` folder (`basisUrl()`: `basis/` next to the page's address, so the relay's `s/<n>/` copy finds it too), its
    formats what the renderer offers (`detectSupport`), 2 workers in a headset session and 4 on a page; given to every
    GLTFLoader the scene loads with (`CONV.load(o.ktx2)`), and disposed in the studio's dispose (its workers terminated;
    the shell's listener bookkeeping removes their `message` listeners on teardown, harmless as they die with the studio,
    a `HOST.swap` making a new one). A KTX2 texture stays a `CompressedTexture`, drawn as its picture is (the studio's
    linear output, as JPEG and PNG); one larger than the GPU takes (`renderer.capabilities.maxTextureSize`: 8,192 in a
    Quest 3's Quest Browser) or than an explicit `&maxtex=` drops its top mip levels instead of being drawn down through a
    canvas. The card's Textures line says *KTX2, ASTC here* (what it became), its memory counts the levels' real bytes,
    and the budget counts a KTX2 texture as big only over 4,096 px.
  - **Reading for conversion** (`KT.decoder`, `KT.decode`): everything that re-exports a model, reads its pixels or makes
    its picture loads it with no KTX2Loader, and its KTX2 pictures come back as plain pictures: a duck-typed loader that
    `GLTFLoader.setKTX2Loader` takes, which transcodes one level to RGBA in a worker of its own (the transcoder, its
    WebAssembly fetched once; the largest level at most `maxTex`, so a picture for the Add pane reads a 1,024 px level of
    an 8,192 px texture) and hands it over as a texture on a canvas. Convert to GLB from a KTX2 GLB, Fewer triangles,
    Change texture, the texture buttons, the Add pane's pictures, the viewer and takes all work unchanged. A GLB made again
    from a KTX2 GLB keeps its fill record (its pictures count as filled, as any GLB's whose record says so). The
    converter's own check loads the GLB back so (at most 1,024 px), counting the textures' full sizes and a byte a texel.
  - **Pixel readers on the scene's own model**: Fewer triangles' fill preview leaves a compressed texture alone (no pixels
    to read; the GLB was filled as it was made where it needed it); Change texture and the trigger cubes swap texture
    objects and put the own back, so a compressed one comes back as it was; a model's picture drawn from the scene's own
    model renders it as it is.
  - **Served**: `basis/` (`basis/README.md`: the encoder from Basis Universal's commit `073eb6a`, three.js r133's
    transcoder, Apache-2.0, their SHA-256) next to `index.html`; the relay's `APP_DIRS`, GitHub Pages; the service worker
    keeps a copy as for any app file it fetched (not in its `SHELL`: the encoder is 3.4 MB).
  - **Limits**: KTX2 files are bigger than JPEGs (about 10 bits a texel on photographic content: an 8,192 px texture 80 MB
    in the GLB, a 4,096 px one 20 MB), so uploads and the first load take longer; the page's memory while writing an
    8,192 px texture is about a gigabyte (its canvas, the copy, the mip chain, the strips); a KTX2 GLB made again from
    itself (no original in the scene) passes its textures through the codec twice; the GPU keeps the transcoded levels in
    the page's memory too, as three.js r128 does for any texture.
  - **Untested**: everything on a real Quest (its memory with KTX2 textures, transcoding there and how long it takes in a
    headset session, how ASTC looks against the JPEG it replaced), real 8,192 px scans (the owner's atelier), encode times
    on a real desktop (here 4 slow cloud cores), Safari and Firefox (the encoder's workers and WebAssembly there), the
    service worker's copy of `basis/` offline.
- **Pushing a folder** (`tools/studio/push.mjs`; `relay/README.md`, "Uploading"). A scene folder already made on a
  computer (GLBs, sounds, pictures, `layout.json`, for instance an importer's) sent to a relay as it is, without the
  upload page's converting: the relay's own listing and upload rules, `layout.json` last, same-size files skipped, files
  that differ and a layout already there kept unless `--replace`, `--dry`. The password is asked for hidden in the
  terminal (or `COLLAB_TOKEN`) and sent only as `Authorization`. Checked against a local relay with a password (new
  scene, the same again, a changed file kept and replaced, an 80 MB file, the layout's history); the hidden prompt in a
  real terminal and a relay behind HTTPS are untested.
- **Fewer triangles and Change texture** (the owner: 20 % by default for everything, adjustable per model with a preview;
  `tools/studio/SPEC.md`, "Fewer triangles" and "Change texture"; `engine/e7d_lite.js`). The converter's `reduce` (every
  mesh to a share of its triangles with meshoptimizer's simplifier: its normals and texture coordinates weighed, so its
  textures stay put; corners shared between parts locked; crumbs pruned; skins kept, shape keys left), in `toGLB`
  (`keep`; the record's `tris: { from, to, keep }`) and `convert.mjs --keep`. On a placed model's card (page and headset,
  editing on, under its place and size): *Fewer triangles...*, 20 % to start (a page's slider; a headset's *− 5 %*,
  *+ 5 %*, *10 %*, *20 %*, *50 %*), shown at once in place on this device only (the object's own model given the
  lighter geometries), *Save* making the GLB as Convert to GLB does (from the original a GLB stands for when the scene
  has it, so the share is of the original; every object of that file switched where it stands, one Undo step, for
  everyone at a station), *Cancel* putting it back; *Change texture...* (a material, a slot and one of the scene's
  pictures, or on a page one from this computer, shown at once on this device; *Save* bakes it in through Add a
  texture's path, recorded in `asset.extras.studio.tex`). Both save from a headset too (with a relay that takes uploads;
  the rule that a headset converts nothing lifted for these two). A lighter GLB made again from its original keeps its
  share. The Upload pane: each model's *Triangles kept* (20 % by default), about how many (`CONV.triCount`, from its
  bytes) and *Preview*, which opens the viewer over the whole window ("The viewer" below), as does *Look closer* on the card while Fewer triangles is open. Nothing in the layout or
  `collab.state()` (no `FORMAT` change).
  - The fill: no black seams (`tools/studio/SPEC.md`, "Fewer triangles"). Why: a scan's texture is an atlas of many small pieces with black,
    unused texels between them; reducing keeps the seams joined in 3D but straightens each piece's outline in the
    picture, so at 10 % the triangles sample the black between pieces (black wedges along the seams; even all its
    triangles show thin dark seams once mipmapped). Measured on the atelier with its margins blacked out: filling every
    texel no triangle uses with the colour of the nearest piece took both away; locking the seams' corners stopped the
    wedges but kept the dark seams (not done). So the converter fills (`CONV.fillModel`, `engine/convert.js`; the pixel
    work `IM.cover` and `IM.fillGaps` in `engine/images.js`, plain typed arrays): for each picture a GLB is made with, the
    texels the triangles of the model as it is before it is made lighter use are marked, and every other texel is
    filled from them, a band of exact edge colours (2 to 8 rings by size) and then a smooth push-pull fill; the used
    texels never change; alpha kept where a material reads it, else filled too (a see-through picture whose gaps are
    mostly clear is left as it is and said: a canvas keeps no colour where alpha is 0). A picture drawn down before the
    fill (the converter's `maxTex`, its reading with a `max`, the studio's own cap: each tells it, `CONV.drew`) has its
    pieces' rims taken back and filled too (`fillGaps`'s `rim`: one ring, two when drawn down by more than half; only
    where a texel deeper in the piece is beside it), since drawing down averages them with the black beyond the edge and
    the band would copy that dark rim outwards (the atelier's 8,192 px picture is filled at 4,096). Only where it makes sense: texture
    coordinates within 0 to 1 (a picture that tiles is left alone), under 95 % of the picture used, every mesh showing it
    with texture coordinates; every slot with its own values (a normal map never black). Integer arrays only (about 90
    MB besides the picture at 4,096 px), the page given back every 25 ms; the atelier's 4,096 px picture in 1.4 s in
    `convert.mjs`'s headless page (a headset's time untested). Every path that writes a GLB fills (Convert to GLB,
    Convert every model, the Upload pane, Fewer triangles' and Change texture's Save, the missing-texture buttons:
    `toGLB`, `fill: false` not); the record gains `fill` (how many pictures), the GLB's card says so in one line, and a
    GLB whose record says so is never filled again (`load` marks its pictures). Fewer triangles' preview shows the
    pictures filled too (copies, worked out once while it is open, laid on the object's own materials, put back and
    freed by Cancel, Save's end or another object; `STUDIO.state().lite.ft.fill`). `convert.mjs --no-fill`. How the
    filled seams look on a Quest and the time the fill takes there are untested.
- **The viewer** (`tools/studio/SPEC.md`, "The viewer";
  `engine/e7f_viewer.js`). Pages only, never in a headset. A model over the whole window, opened by an Upload row's
  *Preview*, by *Look closer* on a placed model's Fewer triangles card and by *Look* on each model card of the Add pane (a
  small button over the picture's corner: a press on the card still places it). An overlay (`#stuViewer`, z-index 14) over
  the studio's own canvas, raised to 13 while it is open: **never a second renderer**; the studio's frame goes on (items,
  sounds, the shared room) but draws the viewer's scene in place of its own (`vwDraw`, from `frame`). The model lit as the
  studio lights its scene or as scanned, framed on its box over a floor grid, its size and triangles said; drag to spin, the
  wheel or a pinch to zoom, a right drag, a Shift drag or two fingers to pan, a double click (or *Frame it*) to frame it
  again; it turns by itself until touched. For a model being made lighter (an Upload row's, Look closer's): *All triangles*,
  *Lighter* or *Side by side* (the window's halves, one camera; top and bottom on a tall window), the share on a slider (the lighter one made again as it is
  let go, `CONV.reduce` on the model as read), both counts, the lighter one's pictures filled as Save fills them;
  *Wireframe* (dark edges a hair nearer than its faces) and *Textures* on or off, *Lit* / *As scanned*. Close or Esc: all
  it made freed, the canvas back under the page, the share chosen back on the row or the card; while open the keyboard is
  its own (the studio's keys never reach the scene). Nothing in the layout or the room, no Undo step. `STUDIO.viewer()`
  for tests. Untested: a big scan in it on a slow laptop, pinch and two-finger pan on a real touch screen.
- **Pictures in the Add pane** (no 3D previews for now, the owner's choice; `tools/studio/SPEC.md`, "Pictures in the Add pane"; `engine/e7e_pics.js`). A picture is a 256 x 256 JPEG of a model (lit
  as the studio lights a scene, seen from a little above and in front, framed on its box, drawn at twice the size and
  made smaller, over a dark background), kept in the scene as `previews/<the model's path>.jpg` (`previews/models/eva.glb.jpg`;
  the relay's rule above: only such a `.jpg` there, at most 200 KB, kind `preview`). The converter's `toGLB(m, { picture })`
  hands the GLB as loaded back to the hook before freeing it, so every path that writes a GLB makes one (Convert to GLB,
  Convert every model, Fewer triangles' and Change texture's Save, the texture buttons: `convertFile`; the Upload pane's
  rows, which show it too); with a relay that takes uploads it goes beside the GLB (`upSend`: straight into R2 when it
  can, else through the relay) and shows at once, else it is kept for this page on the card of the model it was made
  from; never a reason a conversion fails. The GLB's record also says its size (`size`, metres) and triangles (`n`).
  *Make pictures (n)* (the Add pane, a page with editing on; not in a headset, not `&visit`) makes the missing ones one
  model after another (a model the scene has loaded drawn from that; any other fetched and loaded as the converter
  loads it, its textures at most 1,024 px, freed after), uploaded with such a relay, else for this page only, its button
  saying how far it is, *Stop* after the model it is making, a line saying what was made. The cards (a `{ grid }` block,
  page and headset): the Add pane's models and the Originals fold's models (its other files a list; sounds a list),
  each its picture (an original a GLB stands for shows the GLB's) or a plain tile with its kind (*GLB*, *FBX*...), its
  name (`models/` left out), its size in metres and triangles where known (loaded here, a GLB's record, a picture made
  here), else its bytes, and what it was made from or into; a page's CSS grid has 3 to 5 a row by the pane's width, the
  headset's canvas 3 a row, paged by the pane's *Up* and *More*. Pictures are said apart from the scene's files as a
  listing is read (`setFiles`; by path too, for an older relay's `image`), so nothing else sees them (the Add lists, the
  texture ladder and pickers, From another scene's lists), and fetched as files are (`call`: the password as a header,
  or R2's signed link), three at a time, each once a version, a page all of the cards', a headset only those it draws.
  In a headset session a picture is drawn inside the session's frame callback (`PV.jobs`, from `frame()`). A picture
  belongs to the opening of the scene it was made in (`STU.gen`): another scene opened meanwhile, the same one opened
  again or the studio gone, and it is kept nowhere (`pvKeep`, `pvSend`). From another scene copies a model's picture with
  it. Nothing in the layout or `collab.state()` (no `FORMAT` change).
  `HOST.cur.peek('STUDIO.state().pics')` for tests.
- **`layout.json`** (also what *Download layout.json* gives and Upload takes): `{ studio: 1, scene, saved, objects,
  cubes, sounds, cuts, groups, shapes, empties, settings }` (and `screens`, `paintings`, `sequences`: below). Every
  optional field below is kept only when set, and a layout without it reads as before.
  - An object `{ id, name, file, p, q, s, light: 'lit' | 'scan', clip, anim: 'loop' | 'once' | 'off', start: 'always' |
    'shown', faces, tint, bright }`: `faces` `'both'` or `'inside'` ("Faces" below); `tint` (`'#rrggbb'`) and `bright`
    (0.25 to 4, 1 never kept) ("Tint and brightness" below); `cutsLocked: true`, its cut-outs locked ("Cut-outs" below).
  - A cube `{ id, name, p, yaw, size, mode: 'while' | 'stay', show, hide, tex, plays, all }` (`show` and `hide` lists of
    item ids): `all: true`, it works for everyone here ("Cubes for everyone" below); `tex` (only when it has an entry), up
    to 16 `{ on, mat, slot, file }` ("Trigger cubes that change textures" below; an entry that is not one dropped, and
    counted when read from a layout); `plays` likewise, up to 16 `{ on, what: 'clip' | 'sound' | 'path' | 'motion', clip,
    how: 'once' | 'loop' | 'hold' | 'stop', when: 'leave' }` ("Trigger cubes that start things" below; an entry that is
    not one dropped and counted, one naming an item the layout lacks, or of the wrong kind, dropped).
  - A sound `{ id, name, file, p, vol, r, loop, start, on, bone, o, sync, skip, len }`: the last six optional, `on`,
    `bone` and `o` the object it follows, its bone's name and the offset in the target's frame ("Sounds" below); `sync`,
    `skip` and `len` a voice recorded with a movement: the item whose recorded path it plays with, the seconds into its
    file where that path's start is (-10 to 600), and how long of it plays ("Recorded paths" below).
  - A cut-out `{ id, name, on, p, q, size }` in `cuts` (the object it cuts, and its middle, a full turn and its size in
    that object's frame, turned but not scaled; "Cut-outs" below).
  - A group `{ id, name, items }` in `groups` (its members' ids, this layout's objects, sounds and cubes only, one left
    with fewer than 2 dropped and counted; "Groups" below).
  - A shape `{ id, name, shape: 'cube' | 'sphere' | 'cylinder' | 'plane', p, q, size, colour: '#rrggbb', look: 'colour' |
    'hide' }` in `shapes` and an empty `{ id, name, p, q }` in `empties` ("Shapes and empties" below).
  - Any item or group with `locked: true` ("Locked in place" below).
  - The scene's `settings` `{ others: 'shown' | 'hidden', real: 'device' | 'always' | 'never', grid?: 'hidden' }` ("The scene's settings"
    below; a layout without them a new scene's; bad ones counted).
  - An object's, a shape's or an empty's `behaviour` `{ kind: 'look' | 'follow' | 'avoid' | 'item' | 'wall', who:
    'nearest' | 'first', range, dist, speed, area, target, at, gap }` (only its kind's fields; "Behaviours" and "Things on
    walls" below).
  - An object's, a sound's, a shape's or an empty's `shows` (`'ar'` or `'vr'`; "AR or VR only" below).
  - An object's, a shape's or an empty's `motion` `{ kind: 'spin' | 'wobble' | 'bob' | 'pulse' | 'orbit' | 'sway', speed,
    amount, axis: 'x' | 'y' | 'z', start: 'always' | 'shown' }` ("Motions" below).
  - An object's, a shape's, an empty's or a sound's recorded `path` `{ k: [[t, dx, dy, dz, qx, qy, qz, qw], ...], play:
    'loop' | 'once' | 'bounce', start: 'always' | 'shown', speed }` ("Recorded paths" below; 2 to 600 keys an item, 6,000
    a scene, at most 120 s), or for a recording kept as a file `{ src: 'recordings/<name>-<n>.json', len, n, play, start,
    speed }` (`len` more than 0 to 600 s, `n` 2 to 40,000 keys; not counted in the scene's 6,000).
  - An object's, a shape's or an empty's tracker, `trk` `{ id, o, q }`, and an object's `puppet` ("Vive trackers" below).
  - Units: metres in the scene's frame (the floor at y = 0; at a station in a shared room the room's frame, the origin
    and axes the room's: spot A and x towards spot B on a room calibrated on its floor spots; outside a room where you
    stood, -z the way you faced); `p` to the mm, `q` to 4 decimals, `s` 4 significant figures, `yaw` radians (cubes stay
    level), `vol` 0 to 2, `r` (full volume within, 0.1 to 20 m).
  - `id` six characters `[a-z0-9]`, unique in the scene; `name` at most 60 characters (the file's name, numbered when
    placed again: *eva_001 2*). At most 300 objects, 100 cubes, 60 sounds, 100 cut-outs (16 on one object), 50 groups,
    200 shapes, 100 empties; a `file` is a path in the scene's listing (200 characters, no `..`); a cube's lists only name
    this scene's items. A bad item is dropped and said once (*2 items in layout.json could not be read*); anything else
    ignored.
- **Trigger cubes** are each person's own (unless one works for everyone here: below): a cube is active for you while your head is inside it (a headset's head; on
  a page the camera in Walk view, never the orbit camera), `while` only then, `stay` from then on until the scene is
  opened again or *Reset what I have seen*. For an item (another cube too, switched off and on: "Cubes that switch cubes" below), of the cubes active for you, those listing it in `show` (S) and
  in `hide` (H): shown if S has any and H none, hidden if H has any and S none, both: the one entered last decides (a
  `stay` cube walked into again counts as entered again); neither: hidden if any cube lists it in `show` (it waits for
  its cube), else shown (away from its station in a room, nothing; a shape or an empty is shown and hidden as an object is). Shown and hidden fade
  over 0.4 s; `start: 'shown'` starts an object's animation, or a sound, from its beginning each time it is shown (a
  sound stops, fading, when hidden). Never shared, never in `state()`: ten headsets each see what their own place
  reveals. While editing every cube is drawn as its edges and its name only (no walls; its own colour while you are
  in it, lighter pointed at or selected, else darker; an unseen box both ways round where its fill was, so it is still
  pointed at from inside and outside), a selected cube's lines go green to what it shows and red to what it hides, and a
  model or a coloured shape a cube hides from you is not drawn at all but shown by its unseen box's edges and its tag
  (*Atelier · 397k ▲ · hidden*: "Nothing see-through while editing" under "Editing"), still pointed at, selected and carried; not editing, cubes and sound markers are not drawn at all.
- **Cubes for everyone** (`tools/studio/SPEC.md`, "Cubes for
  everyone"; `triggerStep` in `engine/e6_items.js`). A cube's record may carry `all: true` (*Works for: Each person /
  Everyone here* on its card, page and headset, one Undo step; absent, false or null each person's own as before, anything
  else a bad record). An everyone cube is active for every device at the station while any person's head is inside it:
  the heads the behaviours react to (`behHeads`: the people in a headset at its circle from `HOST.collab.heads()`, this
  device's own; pages never count; outside a room this device's own head, or a page's camera in Walk view); a `stay` one
  from the first time any head was inside (each device's memory, cleared by *Reset what I have seen* and the lobby).
  Everything it does follows it: what it shows and hides, its texture changes and what it starts, for everyone, in step:
  its entering and leaving are taken in the room's time from the head samples' own time stamps (`h.ts`, a head with no
  time or not a number taken at the room's time now: entered at the earliest sample of the heads inside, left at the
  latest sample of those inside before; outside a room this device's clock), so every device puts a run's start (and its
  0.3 s leave) at the same room moment (`c.inT`, `c.outT` on the clock of what cubes start, `trgFire`). "Entered last"
  (show and hide, texture changes) is decided alike everywhere: by the entry time (the room's; each person's own cubes
  take this device's moment, kept after the last so two entered one after the other keep their order), then by the
  cube's id (`enteredLater`). Nothing new is sent: each device works it out from the heads it has (their samples come 15
  times a second, so devices agree within about one sample). The card's line, the Items card (*for everyone here*) and
  Start something's paragraph say so. `STUDIO.cube(id)` for tests. FORMAT `networks-43`. Untested on headsets: everyone
  cubes across real headsets at a circle (how in step their runs look, a head entering at a cube's face).
- **Moved by anyone** (`grabOf`, `visitMove` in `engine/e6_items.js`, `visitPick`, `visitDown` in `engine/e7_explore.js`). An
  object's or a shape's record may carry `grab: true` (*Who can move it: Only while editing / Anyone* on its card, page and
  headset, one Undo step; absent, false or null only while editing, anything else a bad record). Without editing (a
  visitor's kiosk too), while the item is shown here, not locked in place, following no tracker and worn by nobody, and the
  circle's story not locked: in a headset the ray finds it (and only such items) and the grip carries it with one hand, the
  sticks turning and pushing it but never sizing it (no second hand, no group, no corner, no selection, no Undo step); on a
  page a press on it drags it along the floor at the height where it was taken (the cursor *move* over it), Orbit and Walk
  view alike. Its record is written as it moves (ten times a second, and as it is let go), so everyone at the circle sees
  it moved, and *Unsaved changes* counts it. FORMAT `networks-44`. Untested on a headset: carrying one without editing.
- **Cubes with a key** (`triggerStep`, `keyBlocks`). A cube's record may carry `key` (an object's, a shape's or an empty's id; *Reacts to: People
  / An item (a key)...* on its card, the item pointed at or picked from the card's list, `STU.keyPick`, one Undo step):
  the cube is then active while that item's middle, where it is drawn (`itemTopInto(.., true)`), is inside it, for everyone
  here (the item's place is the room's), entered at the room's time now; people walking in do nothing. Everything a cube
  does follows it (show, hide, textures, what it starts; *Stays once entered* too). A key not in the scene: never active
  (the card says so). Combined with *Moved by anyone*: a key a visitor carries into a lock. FORMAT `networks-44`. Away
  from its station it keeps its state (v149: it was left while away and entered again on the way back, so its shows won
  over every cube entered before).
- **Cubes that switch cubes** (v154; the owner, 16 November 2026: "can triggercubes now be disabled by other trigger
  cubes? can they also be disabled as part of a group?"; `tools/studio/SPEC.md`, "Cubes that switch cubes";
  `cubeSwitch`, `swWhy` in `engine/e6_items.js`). A cube's `show` and `hide` lists may name other cubes (never itself:
  `norm` drops its own id, and a pick leaves it out), and so may a sequence's show and hide events (`SEQ_SHOW` has `c`:
  *Switch it on* / *Switch it off*) and a press's or hover's show and hide entries (no fade for a cube). Hidden, a cube
  is **switched off**: it reacts to no one (a head, heads or its key inside count for nothing), so it is not entered and
  what it shows, hides, changes and starts does not happen; shown, switched on. The rule is the items': the same
  sources, "entered last decides", and a cube some cube, sequence or press lists in `show` waits switched off until one
  shows it. Each person's own, unless what switches it is for everyone (a cube with `all: true`, a shared sequence or
  press), as everything else they do. A cube's inside is now its head, heads or key inside (`c.raw`) **and** switched on
  (`c.on`): switched off while it is active for you is as if you left it (the owner's choice, "As if you left"): what it
  showed hides again at once, its texture changes go, its loops and holds come off and its `leave` entries fire 0.3 s
  later, as on leaving (`PLAY_EDGE`); a `stay` cube already entered keeps what it made (it stays active, as after
  leaving it) but is not entered again. Switched on while you are inside: as if you walked in (its enter entries fire, a
  stay cube counts as entered again). An everyone cube or one with a key switched takes its switch's moment in the
  room's time (the winner's entry, a sequence's event, a press's stamp; switched on as its switcher's heads left, their
  sample; else the room's time now), so devices agree as for its heads. **Loops and chains**: settled each frame before
  the cubes are worked out, from the frame before, in passes over the cubes in the order of their ids (each deciding
  from the others as they stand) until a pass changes nothing, so a chain settles in the frame it starts; two cubes that
  switch each other off settle (the one with the lower id off when both are walked into at once; walked into one after
  the other, the first one keeps the second off whatever their ids, as it switches the second off as it is entered); a
  ring that has no answer (three cubes each switching the next off) is held: the cubes still changing after as many
  passes as there are cubes that switch or are switched keep what they had, frame after frame (`SW.held`), so nothing
  flickers; every device with the same heads and the same frame before works out the same (a device that comes late to a
  held ring or a pair, or gets the heads entering a pair of everyone cubes in one frame, may settle the other way: known
  limit). Away from its station each cube keeps its switch. *Reset what I have seen* and the lobby work every switch out
  afresh. Editing: picking for a cube, a press on another cube (in the scene, its Items card, a group's name, a group's
  member: the group's cubes with its other members, the picking cube left out) puts it on the list or takes it off (one
  Undo step; until v153 a cube pressed while picking was selected, ending the pick), a tick over it (*✕ switched off by
  Ant*); the selected cube's green and red lines run to the cubes it switches; a cube switched off for you is drawn much
  darker (`LOOKS` cube `off`, opaque), its tag *Bee · switched off*, its card's heading *· switched off* and an amber
  line *Switched off by Ant* (by *the sequence Flip*, *a press on Knob*, *pointing at Knob*; *Switched off: it waits for
  Ant to switch it on*) with what that means, the Items card *switched off*; a row of its lists says *· switched on* or
  *· switched off* by a cube it names; both twins from the same blocks. Duplicate puts a cube's copy on every list its
  original is on (cubes, sequences, presses: `cubeCopy`, `seqCopy`, `pressCopy`), so a copy that waits still waits; a
  group's copy maps its cubes; Delete takes it off every list. Records keep their shape (ids), so `layout.json`, the
  relay's scene checks and `scan.mjs` take them as before; FORMAT `networks-49` (an older device would let a
  switched-off cube act). `STUDIO.cube(id)` (`on`, `raw`, `by`, `why`) and `STUDIO.switches()` (`{ on, passes, held }`)
  for tests; `node tools/smoke.mjs --only 'studio cube switches'`. Untested on a headset: walking into switching cubes
  with a real head, how a darker cube reads there, everyone cubes switching each other across real headsets.
- **Screens: video and audio players** (the owner's decisions: in studio scenes for now, shared by default and per person optional, the relay's conversion an option off by default, no
  YouTube; the contract is `tools/studio/SPEC.md`, "Screens"; `engine/e6q_screens.js`). A new kind of item, a screen
  (`v.<id>` in `state()`, `screens` in `layout.json`, at most 20 a scene): a flat panel (`look: 'screen'`, `w` its width,
  its height from the video's aspect) or a small speaker (`'audio'`) that plays a playlist (`list`, 1 to 50 of the scene's
  video and sound files; `loop` all, one or off; `shuffle` a seed, `shuffleOrder(n, seed)` the same on every device) from
  where it stands. One `<video>` element per screen per device, its picture a `VideoTexture`, its sound only through
  `HOST.audio.fx()` (an HRTF panner, `vol`, reach `r`, following the Sound button as emitters do; muted until there is a
  context). Shared by default: `play` `{ i, on, t, at }` on the room's clock, every device setting its element to that
  moment about twice a second (0.25 s off, 0.35 s in a headset) and working out the end of an entry alike; `sync: 'own'`
  each person's own. The bar under it (previous, play, next, time, seek, the entry and *n of m*, volume, *Everyone* or
  *Just you*) shows when pointed at, or while editing with it selected, to those allowed: `ctl: 'any'` lets anyone use it
  without editing, a visitor too, unless the circle's story is locked. A press writes `play` with no Undo step, and
  `layout.json` keeps no `play` (a scene opens paused at its first entry). Hidden by a cube or not shown here: paused and
  silent, back at the play state's moment when shown. At most 2 playing videos in a headset, 4 on a page (the nearest).
  The relay lists `.mp4 .m4v .mov .mkv` as kind `video` (`.webm` stays audio; a screen takes either); the Upload pane puts
  videos into `videos/` as given, or with *Convert videos to MP4 (H.264)* on (off by default, kept on the device) through
  the relay's job (`POST /api/scenes/<name>/video`, `GET .../jobs/<job>`, its `ffmpeg` with libx264 and aac, 720p for
  Quest else 1080p, `--ffmpeg-video-limit`, the original under `originals/`; "Converting a video" in `relay/README.md`).
  `STUDIO.screen(id)` and `STUDIO.screenClock` for tests. Untested on devices: a Quest's video decoder and the cost of a
  1080p `VideoTexture`, the bar with a real ray, a screen's sound through HRTF, iPhone's video element through the context,
  a long video converted on Coolify.
- **Paintings: drawing in the air** (the contract is `tools/studio/SPEC.md`, "Paintings"; `engine/e6r_paint.js`). A new kind of
  item, a painting (`d.<id>` in `state()`, `paintings` in `layout.json`, at most 50 a scene): `{ name, p, q, s, strokes |
  src, n, pts, locked, shows }`, each stroke `{ b: 'ribbon' | 'tube' | 'glow' | 'spray', c, w, k: [[x, y, z, f(, nx, ny,
  nz)]], sd }` in the painting's frame (spray dots made from its seed, the same on every device). Paint mode is this
  device's own and only while editing: the Add pane's *Paint* and a Paint tab (the brushes and an Eraser, ten colours,
  widths 2 to 80 mm). In a headset the right trigger paints from a tip 6 cm ahead of the controller, its pressure the
  width (`f`); on a page a drag in Orbit view paints on the surfaces under the pointer (the floor, models). Points kept
  every 1.5 mm off a straight line; each stroke one change and one Undo step, shared when let go (the stroke being
  drawn is this device's own, a preview grown in place, kept until the painting's new meshes are built); the Eraser
  one step a sweep (the swept segment tested). Drawn as at most four merged opaque meshes a painting (one a brush),
  built again in slices only when its strokes change. Strokes stay in the record while the scene's records hold at most
  4,000 points and the shared state stays under 224 KB; past that a painting is kept as a file of the scene,
  `paintings/<name>-<n>.json` (a new file each change, never written over; at most 3.5 MB, refused in words past it;
  without a relay that takes uploads refused in words). Readers keep every record they get (the limit is checked only as
  strokes are added). Moved, turned, sized, locked, grouped, duplicated, shown and hidden by cubes, *Shows in*, and moved
  by *Move the scene to this circle* like any item. `STUDIO.paint()`, `STUDIO.painting(id)`, `PAINT.fake(points)` for
  tests. FORMAT `networks-46`. Known limits: the Eraser and a file save against strokes changed meanwhile by another
  device can lose them; a brush's width is held at 2 to 200 mm in the painting's frame (a painting sized far up or down
  paints thinner or thicker than the preview); spray dots' size in a headset session. Untested on a headset: all of it
  (the trigger's pressure, the tip, how strokes look, the frame rate with big paintings).
- **The room scan** (`engine/e6p_scan.js`, `tools/studio/README.md` "The
  room scan, and scanning rooms and objects"). A web page on a Quest gets only Space Setup's scan: WebXR's
  `mesh-detection` and `plane-detection`, which every AR session asks for. That is shape only, coarse, with no colour: the
  browser gives no camera image with a known pose, and WebXR `camera-access` is refused (checked November 2026).
  - **Where:** the Add pane, page and headset, in AR with editing on; elsewhere a faint line says where.
  - **Scan the room:** `initiateRoomCapture`, once a session.
  - **Save the room as a model:**
    - The save is asked for (`scanAsk`) and baked in the next frame (`scanXR`, from `xrBegin` beside `wallsXR`): each
      mesh's vertices, or each plane's polygon fanned, posed by `frame.getPose` and taken into the scene's frame through
      `GL.world`'s inverse.
    - It is merged by label (`scanKey`: wall, floor, ceiling, table, couch, door, window, room for the global mesh...),
      one mesh and one plain colour each, double-sided.
    - It uses the room mesh, else the planes (or *Walls and floor only*), and is refused past 1,500,000 triangles.
    - `CONV.toGLB` makes the GLB with *Triangles kept* (All, 50 %, 20 %) and its picture.
    - With a relay that takes uploads it goes to `models/room-scan-<date>.glb`, gets its `previews/` picture, and is
      placed by `addScan` at p 0, no turn, size 1, `shows: 'vr'`, selected, one Undo step. Without one it is downloaded.
  - **Where it lines up:** at a station the scene's frame is the room's, so the scan stands on the real room for every
    headset there; outside a room only for that session.
  - **Shared:** nothing new (an ordinary file and object; no `FORMAT` change).
  - **For tests:** `STUDIO.scan()` (`{ ar, seen, src, keep, busy, note, last, bake, words }`).
  - **Untested on a headset:** Space Setup started from the page, a real Quest's mesh (density, labels, its poses), the
    picture made in a session, the line-up at a calibrated circle.
- **AR or VR only** (for a room built as a studio scene: its elements "detached and mapped onto the room";
  `tools/studio/SPEC.md`, "AR or VR only"). An object's, a sound's, a shape's or an empty's record may carry `shows: 'ar'` or
  `'vr'` (absent or null both; anything else a bad record): in an AR session (passthrough, `!XR.clear`) one for VR is not
  shown (not drawn, silent, not pointed at), in a VR session one for AR, and a page shows what VR shows (`sessKind`,
  `shownHere`; `STUDIO.sess(k)` pretends one for tests). While editing one not shown for that reason is drawn as a hidden
  item is (its unseen box's edges, or a shape's own, and its tag *Box · 12 ▲ · AR only*), still pointed at and selected;
  its card's heading says *only in AR: not shown here*. Its card: *Shows in: AR and VR / Only AR / Only VR* (page and
  headset, one Undo step each). So one scene can carry stand-ins for a VR visitor (walls, a floor) that an AR visitor's own
  room replaces. FORMAT `networks-43`.
- **Trigger cubes that change textures** (no crossfade, the owner's choice; `tools/studio/SPEC.md`, "Trigger cubes
  that change textures"; `engine/e6i_tex.js`). A cube's record may hold `tex`, up to 16 entries `{ on, mat, slot, file }`:
  an object's id (models only), one of its materials (its index as Change texture lists the object's materials, `ctMats`:
  those with texture coordinates), a slot (`map`, `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `emissiveMap`,
  `alphaMap`) and a picture of the scene (`normTex`: an entry that is not one is dropped, as is a second for the same
  object, material and slot; `tex` not a list makes the cube bad; read from a layout, the dropped ones are counted,
  `STU.badTex`, and those for objects the layout lacks dropped as its lists drop ids). While a cube is active for you its
  entries apply: for each object, material and slot, of the active cubes' entries the one from the cube entered last wins
  (`c.since`, show and hide's rule); with none, the object's own picture is back. A switch, no fade; each person's own, as
  every cube is (only the cube's record goes to the room). As scanned shows only a colour picture; the other slots apply
  lit (a slot its material has not, Phong's roughness, does nothing). On the object's own materials (its clones,
  `libClone`): another object of the same file never changes with it; what each had is kept and put back (`texOn`,
  `texOff`, as `ctShow` does; `applyLight` puts the own pictures back first, so a material as scanned made meanwhile takes
  its own), only when what an object wants changes (`texStep`, each frame after the models are built: its entries, the
  pictures ready, lit or as scanned, its model built again; nothing at all while no cube has an entry and none is on).
  The pictures are read as the scene opens or an entry arrives (`CONV.picture`: TIFF, PSD and DDS too; at most 2,048 px,
  or `&maxtex=` when lower; kept by the scene's opening and the file's time), sent to the GPU then
  (`renderer.initTexture`) in each flip the objects need (glTF's not flipped), so the switch is in the same frame, and
  freed when nothing names them. Reset what I have seen and the lobby hook give the own pictures back (they forget what
  was entered). Change texture's and Fewer triangles' previews on the same object win while open (`texHold`: its own
  pictures back as either opens), then the cubes' state applies again. The cube's card (page and headset; not for a
  visitor, nor with editing off; a cube locked in place takes them as it takes its lists): *Changes textures*, a row per
  entry (*Box · Colour → paint.png*; a press flashes the object in amber, ✕ takes it off, one Undo step) and *Change a
  texture...* (`STU.txp`: the object, pointed at (the trigger or a click, `pressItem`) or from the card's list, then its
  material when it has more than one, the slot, Colour first, and a picture as Change texture lists them, a headset eight
  at a time: the entry added, one Undo step; *Another object...*, *Cancel*, Escape, another selection and editing off end
  it); a selected cube's lines run amber to the objects it changes; the Items card *Cube · shows 2, hides 1, textures 1*.
  Deleting an object takes its entries out of every cube in the same step; duplicating it adds, in every cube, an entry
  for the copy beside each of its own (`texCopy`); a cube's copy keeps its entries; a group's copy maps them (a cube of
  the group onto the copies, one outside it gains entries for them). A GLB switch keeps them (the object keeps its id):
  the conversion says how its materials came out (`toGLB`'s `mats`, the original's `texMatsOf`) and each entry's material
  is found again there (`texRemap`, `texSwitched`, in the switch's change; glTF may list a mesh with several materials in
  another order); *Switch to the GLB* on a card keeps the index. `STUDIO.tex(id)` for tests. FORMAT `networks-36`. Untested
  on a headset: how the switch looks on a Quest, the memory with many 2,048 px pictures there.
- **Trigger cubes that start things** (`tools/studio/SPEC.md`, "Trigger cubes that
  start things"; `engine/e6n_plays.js`). A cube's record may hold `plays`, up to 16 entries (`PLAY_MAX`) `{ on, what, clip,
  how, when }`: the item (`on`: an object's id for a clip; a sound's for the sound; an object's, a shape's, an empty's or a
  sound's for its recorded path; an object's, a shape's or an empty's for its motion: `PLAY_KINDS`), what is started
  (`what`: `'clip'` with `clip` one of the object's animations by name, `'sound'`, `'path'` or `'motion'`), how (`once`:
  from its start to its end, even after you leave; `loop`: again and again while the cube is active for you, a while cube
  until you have left, a stay cube from then on, then it comes off; `hold`, clips and paths only: once to its end, held
  there while the cube is active, then it comes off; `stop`: ends the run on that item now, whatever started it) and when
  (absent: as you walk in; `'leave'`, once and stop only: as you leave). `normPlays`: an entry that is not one is dropped
  (an id that is not one, an unknown what, how or when, hold on a sound or a motion, leave with loop or hold, a clip entry
  with no clip; a clip named on a stop dropped), one entry per item, what and moment (`on|what|when`), 16 at most; how
  always written, when only for leave; not a list (and not null) makes the cube bad. Each person's own, as everything a
  cube does (unless it works for everyone here): nothing is sent and nothing stored but the cube's record (no effect, no room key). An entry fires as its cube
  is entered (each time, a stay cube walked into again too; the head inside as the scene opens, the cube appears or the
  entry is added fires at once) or left; both edges debounced 0.3 s (`PLAY_EDGE`: out for 0.3 s counts as having left, in
  again within that is no new entry; show and hide are not debounced, so no scene changes), the moment of leaving that
  edge plus 0.3 s. On one item and what, the last start decides: it replaces the run under way, and when a run ends nothing
  older comes back. How each comes off (`trgFire`, `trgStart`, `trgOff`, `trgDone` on `it.tr`, the runs per what):
  - a clip (`trgClipStep`, from `animStep`): a layer of its own (`it.tl`, at most 2: a clip's clone's action, two kept per
    clip name, `it.tAct`) blended in over 0.3 s (`PLAY_BLEND`) over the object's own animation, which gets the rest of the
    weight (three.js r128's weighted mix; at full weight the cube's clip is the whole pose, properties it does not move at
    their rest), or over its rest pose with Animation Off; a new run on it crossfades from the old one's frame (frozen
    there, fading out meanwhile); a once fades out from its end, a loop or a hold from when it came off; the last layer
    stopped puts its rest pose back (three.js's own). A clip it lacks ends the run (`'missing'`, logged once a scene's
    opening, the card's amber line). A timeline's hold (e6m_anim.js) shows its own clip alone; Pause holds the frame;
    worn with trackers (pupStep) it plays none. Its model built again (a file changed, a GLB switch), the run goes on by
    its clock on the new model;
  - a sound (`trgSound` from `emitStep`, `trgSoundAt` in `emitOffset`, `sLoop`): one a cube names waits silent until a run
    starts it, from its start at its level at once (decoded or streamed), looping only for a loop; a run that came off
    fades out over 0.4 s (`PLAY_FADE`), a once is over at its end; its own Loop and Starts no longer apply; hidden mid-run
    it is silent, and shown again on its run's clock. A sound that plays with a recorded path (`sync`) is no target (the
    entry is ignored; the card says to start the path, which starts its voice);
  - a recorded path (`trgPathAt` in `POSE.path`): one a cube names waits at its start, or where its last run left it
    (`it.pw`); once: from its start to its end (there and back for Back and forth: its Plays says what one pass is), then
    it waits there; loop: again and again, coming off it finishes the pass under way and waits at its end; hold: to its end
    and held, coming off back along its path at its speed to its start; stopped mid-once: where it is. A voice recorded
    with it (`syncAt`, `trgPathTime`) starts with each run (its pass `'r<n>:<k>'`), silent while the path waits or a hold
    goes back. Its timeline's hold wins; carried or paused it rests at its placed pose;
  - a motion (`trgMotion` in `drawnPose`): one a cube names rests until a run; once: one period (60 / |speed| s); a loop
    that came off (or was stopped) finishes the period under way; a wobble's and an orbit's amount eased in and out over
    min(0.5 s, a quarter period) (they stand away from their place at the period's start).
  An object's own animation goes on until a cube plays a clip on it (Animation Off keeps it still until then). Show and
  hide still decide what is seen and heard: a run on a hidden item goes on by its clock, unseen or silent. Textures are
  independent. The cube's card (page and headset, `playCubeBlocks`; not with editing off, nor for a visitor; a cube locked
  in place still takes them): *Starts*, a row per entry (*Dancer · Wave · once*, *Voice · the sound · loops while you are
  inside*, *Radio · stops · on leaving*, with *· playing for you* while its run is the one on its item; a press flashes the
  item in blue; *Try* fires it here now as if entered, no Undo step, a tried loop or hold coming off after 10 s,
  `PLAY_TRY`, or pressed again, its label then *Stop*; ✕, one Undo step) with an amber line under one that cannot play now
  (`playWhy`), and *Start something...* (`STU.plp`: an item pointed at, the trigger or a click, `pressItem`, or from the
  card's list with what it offers, *animations: Spin, Bob · recorded path*; then *Another item...*, what (its animations, a
  headset's eight at a time, *Its recorded path*, *Its motion: Spin*, *The sound*), How (Once, Loop, Hold, Stop), When
  (Walking in, Walking out: once and stop only), *It will* in a sentence (`playSentence`: *As you walk in, Dancer plays
  Wave once from its start, then its own animation again.*) and *Add*, or *Replace* in its place for the same item, what
  and moment; one pick at a time with Pick what it shows and Change a texture...; Escape, another selection and editing off
  end it), and a faint paragraph. A selected cube's lines run blue to what it starts; the Items card *Cube · shows 2, hides
  1, starts 2*, and a target's faint line *started by a cube*; a target's card says which cube starts it and what waits
  (`playNote`: under its Animation rows, a sound's Plays, its Recorded path and Motion rows). Deleting an item takes its
  entries out of every cube in the same step; duplicating it adds, in every cube, an entry for the copy beside each of its
  own (`playCopy`, `withCopies` as texture changes do); a cube's copy keeps its entries; a group's copy maps them. A GLB
  switch keeps them (the object keeps its id; its clips' names come through the converter). Reset what I have seen and the
  lobby stop every run at once (`trgReset`: layers stopped, sounds stopped, paths back to their start); a cube you stand
  in fires again the next frame; opening the scene again forgets everything. Nothing is done per frame in a scene whose
  cubes start nothing (`trgList` is made again only when the items change). Logged: `studio play` (one line a start: its
  cube, item, what, clip, how, when) and `studio play missing`. `STUDIO.plays(id)` (`{ log, on, item: { tgM, tr, layers,
  pw, tg, trgLog } }`) and `trgClock` (the tests set their own) for tests. FORMAT `networks-42`. Untested on a headset: how
  a blended clip looks on a character there, the 0.3 s debounce with a real head, a voice started on entering through
  HRTF, a path's Hold going back, and how often a stay cube's restart feels right in a real room.
- **Sounds** (emitters): a sound file placed at a point, played through the shell's context (`HOST.audio.fx()`, never
  one of its own), each through an HRTF `PannerNode` (inverse distance, full volume within `r`, `rolloff` 1,
  `maxDistance` 50 m) and its own gain. The listener is the head in a headset (the shell's `HOST.sfx.listen`) and the
  camera on a page (put back at the origin in `dispose`). Silent while `fx()` gives no context (before a tap, hidden,
  the `<audio>` engine chosen) or the Sound button is off (`HOST.audio.muted`); not the Sound effects or Narration
  switches, since an emitter is the scene's own sound, not an effect (the Scene pane and a sound's card say so). An
  `always` loop starts at the same moment for everyone at a station (the room's time, `HOST.collab.now()`, modulo its
  length; outside a room from when the scene opened). Sounds up to 20 s (`STREAM_S`) are decoded once per file, at most
  60 MB decoded a scene (more: not loaded, said); longer ones (the owner's 4 min 16 s `first_room.mp3` would be about 98
  MB decoded) are streamed: an `<audio>` element per emitter (`crossOrigin` anonymous, the password as `?token=`)
  through `createMediaElementSource` into its panner and gain, its moment set by `currentTime`, paused (not torn down)
  while there is no context or the device is muted, a new element on a new context (an element feeds one context
  only). A stereo file is played from its point; the card says *mono files place best*. While editing: a small speaker
  in the sound's colour and a faint ring on the floor at `r`. A voice recorded with a movement (its record's `sync`)
  plays with that item's recorded path instead of its own loop: from each start of the path, on the path's clock
  ("Recorded paths" below, "A voice with the movement").
- **Sounds that follow a model** (`tools/studio/SPEC.md`, "Sounds that follow a model"): a sound's optional `on` (an
  object's id, or a shape's or an empty's, followed
  where it is, no bone), `bone` (a bone of its model, or for a model
  with no bones a part its clips move, by name as three.js gives it; none: the whole model, the object's holder) and `o`
  (an offset in metres in the target's frame, turned but not scaled, to the mm). Every frame, once every object's
  animation has stepped, its holder goes to the target's place plus the target's turn times `o` (`soundStep`; the
  speaker, labels, pointer and panner follow), not while a grip or the page's arrows carry it. A bone not found here: the
  whole model; the object not in the scene: its own `p` (kept so, dangling, from the room and from `layout.json` alike,
  until the object is back). Names are matched as given, then leniently (lower case, letters and digits only: an FBX's
  *mixamorig:Head* is *mixamorigHead* once a GLB). Its card: *Follows* (*Follow an object...*,
  a pick mode as *Pick what it shows*, the trigger or a click on an object, or the card's list of objects; *Move onto
  it*; *Stop following*) and the bone choices: a short list where the model has such a bone (*Whole model*, *Head*,
  *Neck*, *Chest*, *Hips*, the hands and the feet, by the end of the tidied name: Mixamo, Biped, Unreal, Rigify's
  numbered `DEF-spine`, VRM), then *More bones...* (all on a page, eight at a time in a headset). Attaching, another
  bone, a move by hand and *Stop following* keep it where it is (a move while its bone's model is still loading here
  writes `p` only: `measureNode`); sizing the object (its size steps, both grips, the arrows) scales the offsets of what
  follows it in the same change, and between the grips' writes by the size shown over the record's (`followK`);
  switching the object to its GLB turns the offsets of what follows its whole model (or names a bone it lacks) by the
  baked turn (`o' = r o`), bones keeping theirs; deleting it leaves its sounds where they are, following nothing (one
  Undo step brings both back). Heard only while it and its object are both shown for you (its fade times its object's;
  `start: 'shown'` from its beginning each time both are shown). While editing a thin line in its colour runs to what
  it follows, and its labels say so (*Voice → Dancer · Head*). Shared as its record (FORMAT networks-30). Untested
  on a headset: how a voice at a moving head sounds, the pick by trigger and the bone pages on a real panel.
- **Cut-outs** (`tools/studio/SPEC.md`, "Cut-outs"; `engine/e6b_cuts.js`). A
  cut-out (*Cut-out box* on the Add pane, *Cut out a part* on an object's card) is a box over part of one object's model
  that hides whatever of that model lies inside it, for everyone, the model's file never changed (the owner's atelier is
  one mesh with one material: nothing in it can be hidden by name). Its record `{ name, on, p, q, size }`: the object it
  cuts and only that one (`on`, required), its middle, a full turn and its size in that object's frame, turned but not
  scaled (metres; `p` and `size` to the mm, each side 1 cm to 50 m, `q` 4 decimals), so it stays on the same part of the
  model when the object is moved or turned; sized here, the object scales its cut-outs' records in the same change
  (`scaleFollowers`, `followK` between both grips' writes; a value past what a record takes held at the limit, never
  refused, and said on the object's card), and switched to its GLB they turn by the baked turn (`p' = r p`, `q' = r q`;
  scaled by `k = s' b / s` too where the new scale's 4 significant figures are not exact). Deleting the object deletes
  its cut-outs in the same step (Undo brings all back); duplicating it copies them onto the copy, each copy in every cube
  list its original is in; a cut-out whose object is not here (a layout, the room) is kept and cuts nothing. How:
  every material of an object with a cut-out (lit and as scanned) gets a small addition (`cutPatch`, `onBeforeCompile`;
  `customProgramCacheKey` the original's plus `|studio-cut-1`): each fragment's world place, from three.js's own
  `transformed` after skinning and morphs, is tested against the object's boxes (`uniform vec4 cutM[48]`, three rows of
  each box's inverse matrix, and `uniform int cutN`, at most 16: a model's first cut-out compiles its patched programs
  once, a box added after that nothing; more than 16 from a room or a layout: the 16 lowest ids cut, the same on every
  device), and one inside any is
  discarded; the boxes handed over as its first mesh is drawn each frame (`cutUpload`, `onBeforeRender`); each object's
  materials are its own clones, so two copies of one file never share a cut; a model with none keeps its materials. No
  extra pass, no change to the geometry; the hole's edges are open. Limits: 100 a scene, 16 an object, beyond them refused
  in words. A trigger cube shows or hides a cut-out as any item: hidden for you, the model is whole; it switches as its
  fade crosses one half, and one new here takes its state at once (the owner's door: a cube in front of the wall shows
  the cut-out, so the wall opens as you walk up). Made where the click or trigger that selected the model met its surface
  as drawn (`pressItem` keeps that ray, `cutRay`; one raycast as the button is pressed, `modelHits`, a skinned mesh's
  triangles where its bones put them), 0.8 x 2 x 0.4 m (each side at most a fifth of the model), upright, facing you;
  else at the model's middle. Its card: what it cuts and *Move onto another object...* (a pick mode, keeping its place),
  size steps per side (5 cm) and every side, *Turn 90°*, *Preview: As seen / Cut / Whole* (this device only, while
  editing; *Cut* cuts whatever the cubes say, so a door a cube opens can be sized with its hole in sight), *Duplicate*
  (beside it, in its cubes' lists), *Delete*, every change one Undo step. While editing its box is drawn in one warm
  red-orange, dashed edges, solid corner ticks over everything, *✂ Door*, its corner balls when selected, and nothing
  see-through (no fill: a layer the size of the box on screen costs frame rate; pointed at or selected its edges light
  up instead, lighter, their dashes denser and its ticks a third of each edge long, `LOOKS.CUT_LOOK`; its lines, ticks
  and corners opaque, one cutting nothing drawn darker, `LOOKS.CUT_OFF`, rather than fainter); the pointer
  finds the nearest object, sound or cut-out, passing over an object's unseen box when the ray goes on into one of its
  own cut-outs (and over cut-outs while picking an object for a sound or a cut-out); the page's arrows move,
  turn and size it per side; in a headset the grip carries it (turning with the hand while free moving is on), both grips
  size it, a corner stretches it. Not editing, only the hole. The Items pane shows each object's cut-outs as tags on its card. *Lock cut-outs* on the object's card: the object's record gains `cutsLocked: true` (kept only when set; anything but
  a boolean makes it bad; a copy's are not locked; shared and saved, `FORMAT` networks-36); its cut-outs cut as before, but their boxes
  are never drawn or pointed at (`cutsHid`), they do not move, size, turn or go (`lockNames`), no cut-out is added to it
  or moved onto it (`canCut`, `cutOnto`), the object is not deleted until they are unlocked, its card says so in place of
  their list and the Items pane shows one tag (*🔒 ✂ 2 cut-outs locked*, a press selecting the object); *🔒 Cut-outs
  locked* again unlocks them and their boxes show again. One Undo step each.
  `layout.json`'s `cuts`, `state()`'s `x.<id>` (FORMAT networks-31). Untested on a headset: how the holes look on a
  Quest, the shader's cost with a big scan and 16 boxes, the grips on real controllers, the one raycast against a big scan.
- **Groups** (`tools/studio/SPEC.md`, "Groups"; `engine/e6c_groups.js`). A group (`{ name, items }`, kind `g`) is a named set of objects,
  sounds, trigger cubes, shapes and empties (a cut-out belongs to its object, so never a member); an item is in one group at most (an id
  two groups name stays in the one with the lower id, `groupOf`, the same on every device), no groups in groups, 50 a
  scene. *Make a group...* on an item's card makes a group of it and starts a pick mode (a click, the trigger or a pinch on
  an item puts it in or takes it out, Ctrl- and Shift-click as a click, cards under Items too; one in another group moves
  into this one; *Done*); *Add or remove items...* on the group's card the same. A click on a member selects its group (its
  card, a dashed box round its members while editing (opaque), `LOOKS.group`), a second one on the same member that member
  alone (*In group ...*, *Select the group*; selected alone it moves alone); hover labels say *Group 2 · Dancer*; the
  Items pane shows groups first, a heading each with its members' cards under it. A selected group moves, turns and sizes as one about its
  pivot (the mean of its members' middles, on the floor, `groupPivot`: a turn or a size carries every middle with its
  member, so the pivot stays put): turns about the vertical only (an object's turn and a cube's yaw gain it), sizes alike on every axis (places,
  an object's `s` with its cut-outs and its sounds' offsets through `scaleFollowers`, a cube's size, a sound's reach; a
  value past its limit held there, a place within 1 km of the scene's origin too, and said on the card); a sound in
  the group that follows an object in it simply follows, one that follows an object outside it moves as carried by hand
  (`soundAt`). On a page the arrows on the pivot (Y ring only), *Turn 90°*, size steps, *On the floor* (the lowest point
  of its objects: cubes and sounds stand on nothing); in a headset the grip on any member (unless selected alone) carries
  the group (a yaw from the hand only while free moving is on), both grips size it about its pivot; the other hand
  carrying the group, a grip on a member joins it; the other hand carrying a member alone, a grip on another member
  carries that one alone. An item removed while a hand holds it (a group gone from the room too) ends that hand's change
  in the next frame (`XR.lost`, `xrLost`). Every move one change (one Undo step, every member written in one state). *Duplicate*
  (every member copied as a new group beside it: a following sound's copy follows its object's copy, a cube of the group
  lists the copies, each copy joins the lists of the cubes outside the group its original is in, cut-outs with their
  objects), *Ungroup*, *Delete* (every member). A group left with fewer than 2 members goes in the same change (not one
  picking now); one made and left with its one item when picking ends is taken back as never made. Undo while picking
  picks on; an Undo that leaves a group with one member leaves it picking again (as before that step), any other group
  it touched and leaves with fewer than 2 goes (`groupUndone`). A group with fewer than 2 of the items placed is never written to `layout.json`,
  the draft or *Unsaved changes* (`placedItems`). A cube's *Pick what it shows* / *hides* on a grouped item toggles all
  of its group's members, its cubes too (the picking cube left out; v154: "Cubes that switch cubes"). `layout.json`'s `groups`, `state()`'s `g.<id>`
  (FORMAT networks-32). Untested on a headset: the grips carrying and sizing a group on real controllers, the pick
  mode by trigger, how the box reads.
- **Faces** (`tools/studio/SPEC.md`, "Faces"). An object's optional `faces`: absent or `null` (*As in the file*, each material's own side as loaded), `'both'` (*Both
  sides*: `DoubleSide`) or `'inside'` (*Inside out*: `BackSide`, three.js turning the normals so the light follows), on the
  object's own materials (its clones, lit and as scanned, `applyFaces`; the side as loaded kept as `side0`), so two copies
  of one file may differ; set again whenever its model is built (a file changed on the relay, a GLB switch, which keeps the
  record's `faces`), and with its cut-outs' addition. A row on the object's card (page and headset): *Faces: As in the file
  / Both sides / Inside out*, one Undo step, shared and saved (FORMAT networks-32). The file is never changed. Untested on
  a headset: a scan inside out seen from within, the cost of double sides on a big scan.
- **Tint and brightness** (`tools/studio/SPEC.md`, "Tint and brightness"). An object's optional `tint` (`'#rrggbb'`, lower case) and
  `bright` (a factor, 0.25 to 4, to 2 decimals; 1 is none), each kept only when set (anything else makes the record bad, a
  brightness out of range held at its limit; FORMAT networks-37). On the object's own materials, lit and as scanned: each
  material's colour as loaded (`userData.col0`, kept as `libClone` and `scanMat` make it) times the tint, times the
  brightness (`applyTint`, `tintMat`; past 1 a texture brightens too), so two copies of one file may differ; put on again
  whenever its model is built (a file changed on the relay, a GLB switch, which keeps the record), and untouched by Change
  texture's and Fewer triangles' previews and the cubes' texture changes (they swap pictures, never a colour). Rows on the
  object's card (page and headset, editing on, never refused by a lock in place): *Tint: None* and the shapes' ten
  swatches, on a page *Any colour* (a colour field, taken once chosen), and *Brightness: n %* with *Darker* (×0.8),
  *Brighter* (×1.25), held at 25 % and 400 %, and *Reset*; one Undo step each, shared and saved. A group selected has the
  same rows for every object of it in one step (Darker and Brighter on each one's own). The file is never changed; the
  Add and Items panes' pictures stay the file's. Untested on a headset: how tints look on a Quest.
- **The colour picker** (`engine/e7h_colour.js`). One picker for an object's tint, a shape's colour and the paint colour. Page: *Any colour…* opens a popover (a hue ring and a saturation and brightness square, the hex, the ten swatches, up to eight recent colours kept on this device as `studioColours`, shared by the three), dragged with the pointer or stepped with the arrow keys; what it shows is previewed on the item on this device only and written when let go (one Undo step a drag, a typed hex, a swatch or a run of keys; Esc takes the preview back). Headset: *Any colour…* on the card opens the same picker as a block of the card, dragged with the trigger (its own strip sent to the texture while it moves, never the whole card), one Undo step when let go (a lost controller commits what was shown). Records unchanged (`'#rrggbb'`); paint's colour is a tool setting (no Undo step). `STUDIO.colour()` for tests; `node tools/smoke.mjs --only 'studio colour'`. Untested on a headset: dragging the ring and square with a real ray, how the picker reads at arm's length.
- **Sequences** (`tools/studio/SPEC.md`, "Sequences"; `engine/e6s_seq.js`, `engine/e7h_seqview.js`). A new kind of item, `q` (`q.<id>` in `state()`, `sequences` in `layout.json`, at most 50 a scene, 200 events a sequence, 2,000 in all): no place and nothing drawn, `{ name, len, loop, start, sync, col, ev, locked }`; an event `{ t, on, what, ... }` on an item: a clip, sound, path or motion (once, loop, hold, stop, as a cube's `plays`), `show` or `hide` (a fade or `cut`; a cube switched on or off, v154), a picture change (`tex`) or another sequence (`seq`). It is built on `e6n_plays.js`: events start the cubes' runs (source `'seq'`), and show, hide and `tex` are one more source in the cubes' "entered last decides" rule. The play state is not a record: `qr.<id>` = `{ n, on, at, t, ts, by }` in the room's state (a screen's precedent: no Undo step, never in `layout.json`, the draft or *Unsaved changes*), so every device works out the same result from it and the room's clock, a late joiner too (a late joiner to a looping sequence fires only the current cycle's events: known limit); `sync: 'own'` keeps it on this device, never sent. *Play for everyone* / *Play here*, *Stop* and *Rewind* work with editing off, a visitor too (greyed while the circle's story is locked); a stop of a sequence not playing does nothing (v149: it wrote a new `ts`, which put a stopped loop in a later cycle); a cube's `plays` entry can start one, `start: 'open'` starts it by itself. Editing: the card (page and headset twins, a bar on the headset), a preview on this device only, and on a page the lane view `#stuSeq` (events as blocks on a lane per item, dragged, marquee-selected, copied with Alt; one Undo step each). `STUDIO.seq(id)`, `seqs()`, `seqView()`; `node tools/smoke.mjs --only 'studio sequences'`. FORMAT `networks-47`. Untested on a headset: the card's list editor and bar with real controllers, how in step a shared sequence looks across real headsets.
- **Press and hover** (`tools/studio/SPEC.md`, "Pressed and pointed at"; `engine/e6t_press.js`). An object's or a shape's record may carry `press` `{ do, hover, who }`: entries (at most 16 a list) that do what a cube can start (clip, sound, path, motion), show or hide an item (switch a cube on or off, v154), or start or stop a sequence; in `do` a loop toggles (odd presses start it). A press is a stamp, not a record: `pr.<id>` = `{ n, at, by }` in the room's state (no Undo step, never in `layout.json`), written by the presser (one press an item per 250 ms), and every device fires the entries from the stamp and the room's time (a late joiner too); `who: 'own'` keeps it on this device. Hover is each person's own and sends nothing: its entries fire as the pointing begins and its loops and holds come off 0.3 s after it ends. Pressable only with editing off (editing on, a click or the trigger selects; the card's *Try press* and *Try pointing* act here only), a visitor presses, and so does anyone while the story is locked. Headset: the trigger on a pressable item presses (the grip still carries one that is `grab: true`); page: a click (within 4 px). The card (*When pressed*, *While pointed at*, *Add a reaction...*, *Pressed by*), page and headset twins. Two people pressing one item within a few hundred ms may lose one press (last writer wins). `STUDIO.press(id)`, `pressFire(id)`, `hover(id)`; `node tools/smoke.mjs --only 'studio press'`. FORMAT `networks-47`. Untested on a headset: pressing with a real trigger, hover with a real ray, how in step a shared press looks across headsets.
- **Sends to the output page (MIDI and OSC)** (v157; `tools/studio/SPEC.md`, "Sends to the output page (MIDI and OSC)"; `tools/output/SPEC.md` the contract; `engine/e6u_send.js`). A cube, a press record and a sequence may carry `send` entries `{ on, t, osc, note, cc, val, ch, hold }` (at most 8; one check, `normSend`; a layout's bad ones counted and said on the Scene pane): the scene's own mapping of its events to MIDI and OSC, which the output page (`output.js`) sends. The owner's exception to the cubes' rule: **only for a cube opted in to send (its record has send entries), the fact that a person walked into it or out of it is sent as an ephemeral effect from that person's device; what the cube shows, hides, changes or starts for them stays their own and is never sent.** Pointing at an item whose press has `hover`/`unhover` entries is sent likewise; nothing else of pointing; nothing of either in `state()`. The effect `send` (`{ id, ev, at, t?, try? }`, at most 10 a second a device, one per item and event per 100 ms) only from a person's device (never a camera or the output page); every device ignores it unless something listens on `HOST.cur.out`. The state gains `sw.<id>` (an outside switch, one more source in the cubes' rule, written only by the output page) and `bt` (the room's beat), which a motion with `beat` (0.25 to 16 beats a period) follows. `HOST.cur.out` (`STUDIO.out`): `ready`, `scene`, `list`, `pose`, `listen` (events: presses, sequences' start, stop and `at`, cubes' `on`/`off`, everyone and key cubes' `enter`/`leave` worked out from the heads, the effect), `act` (press, start/stop/toggle/rewind, show/hide/flip/clear, beat), `beat`, `sends`. The cards (page and headset twins): a cube's *Sends to the output page: Off / On*, *Sends* on an object's, a shape's and a sequence's card, *Add a send...*, *Try*, ✕ (one Undo step each), a motion's *On the beat*. `STUDIO.sends()`, `sendSet(id, list)`, `beatSet(id, beat)`; `node tools/smoke.mjs --only 'studio sends'`. FORMAT `networks-51`. Untested on a headset: walking into a cube that sends, pointing with a real ray, the card with real controllers, how in time the room's beat looks.
- **The dub techno demo** (v159; `tools/studio/dub/` makes `examples/dub-techno` with `node tools/studio/dub/make.mjs`,
  `--check`; never edit it by hand): a mixing desk of shapes and cubes only (two faders, a turntable, an orb, three pads,
  a dub wand, a dance-floor cube and a drop cube for everyone, a beat-locked wobble sphere, trails and hand trails),
  mapped on MIDI channel 1 (CC 20 to 26, notes 36, 38, 48, 51) to the Cardinal patch `tools/output/cardinal/dub-techno.vcv`
  (made by `node tools/output/cardinal/make.mjs`, `--check`, `--check --src <a Cardinal clone>`: ids checked against
  Cardinal's sources). Cardinal plays on its own 120 bpm clock (its Host MIDI gives no clock pulses); the output page's
  Start puts it back to bar 1 at the room's downbeat. Loaded and heard as levels in Cardinal's web build (headless); never
  listened to, nor tried with real MIDI.
- **Streams, trails and loops on the beat** (v158, FORMAT networks-52; `tools/output/SPEC.md` "v158" the contract,
  `tools/studio/SPEC.md` "Streams on a card", "Trails", "Loops on the beat"). *Streams* on the card of an object, shape,
  empty, sound or cube (`stream`, 1 to 8 entries, 64 a scene, `normStream`, `engine/e6v_stream.js`): a value (x y z, yaw
  pitch roll, speed, vx vy vz, acc, spin; size, shown, clip, path, motion phase; near: the nearest head; a cube's count of
  heads inside) mapped from a range (*Range from its movement*: 5 s watched) to a CC (14-bit with `wide`), a threshold
  note or OSC, which the output page sends; *Try* sweeps it. *Trail* on an object, shape, empty or sound (`trail { len, w,
  col }`) and the scene's *Hand trails* (`settings.hands`): one batched additive ribbon (`engine/e6x_trails.js`, the ships'
  blending), drawn by every device at the circle from what it draws, nothing sent; `STUDIO.trails()`. Loops on the beat
  (`engine/e6w_loops.js`): a recorded path's `sync: 'beat'` and `beats` lock it to the room's beat `bt` (stretching with
  the tempo; *On the beat* on its card, *Record on the beat* 1/2/4/8 bars with a count-in to the next downbeat, stopping
  itself at the end one); a sequence's `beats` likewise, with *Record events* (1/2/4/8 bars, grid, overdub): shared
  presses (event `press`), sends of cubes and pointing (event `send`, only its send entries), outside switches (show,
  hide) and other sequences, quantised; `STUDIO.loops()`, `loopClock`. A press fired by a sequence runs its show, hide and
  run entries, not its `seq` entries. Untested on a headset: Record on the beat with the grip across the downbeat, trails'
  look and cost over passthrough, hand trails over Wi-Fi.
- **Shapes, empties, locks, the scene's settings and the lobby** (`tools/studio/SPEC.md`, "Shapes and empties", "Locked in place", "The scene's
  settings", "The lobby"; `engine/e6d_shapes.js`, `LOOKS.shape`, `LOOKS.empty`).
  - A shape (`p.<id>`, `shapes`): `{ name, shape: 'cube' | 'sphere' | 'cylinder' | 'plane', p, q, size, colour, look }`,
    added from the Add pane's *Shapes* row (a 50 cm box or ball, a 50 cm by 1 m cylinder, a 1 m plane, upright, facing
    +z; 1.5 m in front of you on the floor, selected; 200 a scene). `look: 'colour'`: lit in its colour (ten swatches on
    its card, `#rrggbb` lower case), fading as an object does; `'hide'`: drawn into the depth alone (`colorWrite: false`,
    `renderOrder` -1, after the stage's floor and sky, before the items), so the scene's own things behind it are not
    drawn there: in AR the real room shows through it, in VR the stage; a closed shape hides from its outside only, a plane
    both ways; while editing its edges show where it is, opaque (no fill drawn; a ball's three great circles, a
    cylinder's rims and four lines along it, a plane's outline; an unseen fill keeps it pointable from inside and outside;
    a cube hiding it from you: nothing hidden), and every shape has its tag (*Box · 12 ▲ · hides things*, its primitive's
    triangles). It moves, turns (fully) and sizes per axis: the page's arrows (scale in its own frame),
    the grips (turning with the hand while free moving is on), both grips (every side alike), a cube's corners; its card:
    *Shape*, *Look: Colour / Hides things*, *Colour*, size 10 cm a press per side and ×0.5 to ×2, *Turn 90°*, *On the
    floor* (its exact lowest point: a ball's and a cylinder's as turned). A trigger cube shows or hides it, a group holds
    it, a sound follows it (its place and turn; its offsets not scaled with its size).
  - An empty (`e.<id>`, `empties`): `{ name, p, q }`, a point with a turn, drawn only while editing (a small axis cross,
    x red, y green, z blue, over everything, a ball in its colour, its name; an unseen ball for the pointer); added from
    the Add pane (1.2 m up; 100 a scene). A sound follows it as it follows an object (*Follow an object...* lists objects,
    shapes and empties; the pointer on one picks it), heard only while the empty is shown for you (a cube may hide it).
    Its card: where it is, the sounds that follow it, *Turn 90°*. Moved and turned (not sized), in groups and cube lists.
  - *Lock in place* (`locked: true` on any item's or group's record, kept only when set; *Lock in place* / *🔒 Unlock* at
    the top of every card, right under its heading, page and headset, one Undo step, shared and saved): a locked item does not
    move, turn, size or go, whichever way is tried (its card's buttons greyed and refused, the Delete key, the page's
    arrows not attached, the grips, both grips, a corner and *Hold it* refused with a short buzz and a knock); a group's
    lock holds its members (selected alone too), and a group with a locked member does not move or go and says which; an
    object with a locked cut-out is not deleted (the cut-out moves with it as ever); *Ungroup* is refused only by the
    group's own lock. The card's top says what holds it (*Refused:* in red for 4 s after a try); labels and the Items pane's
    cards mark it 🔒. A copy (Duplicate, a group's) is never locked. The room's records and Undo are never refused. Editing a
    locked item's other fields (light, colour, look, clip, its cube lists) is allowed.
  - The scene's settings (`settings`, in `layout.json` and in `state()`, so for everyone at that studio's circle; rows on
    the Scene pane while editing, page and headset, one Undo step each, counted by *Unsaved changes*; a new scene's:
    shown, as each headset has it): *Other circles: Shown / Hidden*, *Real world hides the scene: As each headset has
    it / Always / Never* and *Floor grid: Shown / Hidden* (v156; the owner, 16 November 2026: "add an option to hide the
    blue studio floor grid for a studio scene": `grid: 'hidden'`, written only when hidden; the stage's blue 1 m grid and
    origin mark not drawn, its floor and sky kept; FORMAT networks-50). A camera (camera mode, the desktop preview camera)
    shows no editing look (v156; the owner: "looks like edit mode is on in the desktop cam view in a studio scene"):
    `editOn()` is false while `HOST.collab.cameraMode()`, whatever this device's Edit. The studio tells the shell each time what it wants changes (`settingsStep`, every frame,
    guarded: `HOST.collab.hideOthers(true)` while this device is at this studio's station with the other circles hidden,
    `false` otherwise; `HOST.occlusion.scene(null | 'depth' | 'off')` while the scene shows here, `null` otherwise; *Always* is the live
    depth alone since v195, as the shell's default, the room scan left out because it hid badly (the owner, 24 November
    2026); `'both'` until then, and the shell still takes `'both'` when asked by name), and both
    back (`false`, `null`) as it goes (`dispose`); away from the station, on the Stories screen or for another scene (a
    new scene's settings) they are off. The shell draws or hides the circles and does the occlusion (the shell's lane:
    real-world occlusion is on by default for every headset in AR).
  - The lobby: the studio's returned object has `lobby()`, which the shell calls as this headset walks into the room's
    *Back to the lobby* circle: this device forgets what it has seen (as *Reset what I have seen*, and more: every item
    starts again from its beginning the next time it is shown: a `shown` animation or sound, a sound that plays once);
    nothing is written to the room. Away from its station (the lobby, before any circle) nothing of the scene is shown for
    that device (`triggerStep`), so it all starts afresh on its return.
  - FORMAT networks-34. Untested on a headset: how a shape that hides things looks against the real room in AR (its edges,
    the depth's precision against the room's occlusion), the empty's cross in a headset, the lock's buzz, the circles
    hidden at a studio's circle and the occlusion setting with the shell's real-world occlusion, the lobby hook as a
    headset walks into the lobby.
- **VR goggles** (v197, FORMAT `networks-56`; `engine/e6z_goggles.js`, the shell's game in `flight.js`: "VR goggles" in
  `docs/agents/shell.md`). A shape of kind `goggles` (`{ name, shape: 'goggles', p, q, size, colour, look, ... }`, the
  shapes' record, limits and card; 18 by 9 by 10 cm; our own low-poly pair made in code, `looks.js` `gogglesGeo`, its
  parts in their own vertex colours times the shape's colour), added from the Add pane's *VR goggles* row 1 m up in front
  of you; its card says how to wear them instead of the *Shape* row (goggles stay goggles; the four primitives are
  `SHAPE_PRIMS`). Placed, moved, sized, locked, grouped and pressed while editing as any shape (an older device took the
  record as bad: hence the FORMAT). In a headset with editing off (`wearable`: shown to you, the scene's own; a locked
  pair too, since nothing moves), the ray finds them as it finds what anyone may move, and the grip carries them in this
  hand alone (`c.grab.wear`: never written, nobody else sees them move; their own lock does not refuse it, a shared room's grip lock at a locked story still does); within the
  shell's `WEAR.on` (0.2 m) of the head they go on (`HOST.flight.wear({ owner: 'studio', id })`) and are back where they
  stand at once (`gogBack`); let go anywhere else, back there too. Refused by the shell (camera mode, a phone, no right controller: `whyNot`, asked first, v198) they stay in the hand, said once a carry. While the game is drawn here (`gogHide`): the scene
  (`GL.world`) and the studio's panels hidden for you, not unloaded; nothing of the studio pointable (`xrPoint`); its
  sticks move nothing (`stickMove`); the shell told to hide the other circles and to apply no real-world occlusion
  (`settingsStep`: `hideOthers(true)`, `occlusion.scene('off')`; back as they were once it is not drawn). Taken off here
  when the goggles go from the scene, editing is turned on, or the studio goes (`dispose`); the rest is the shell's. A
  scene with goggles loads `flight.js` (`gogStep`, once); a grip on them fetches the cell's data (`gogTaken`). Wearing is
  each person's own: never in `state()` or `layout.json`. `STUDIO.goggles()`; `node tools/smoke.mjs --only goggles`.
  Untested on a headset: the grab to the face, the gesture off, the game itself (see the shell's section).
- **Behaviours** (the owner's rule: a behaviour reacts to one headset at a time, the nearest or the first to come
  close, shared alike on every headset; `tools/studio/SPEC.md`, "Behaviours"; `engine/e6g_behave.js`). An object, a shape or an empty may have a
  `behaviour` in its record, with only its kind's fields: `look` `{ who, range }` (its front, `+z` as placed, turns to the
  person about the vertical through its middle), `follow` `{ who, range, dist, speed, side }` (comes to about `dist` in front of
  them, at its own height, turned to them; `side` `'behind'`, `'left'` or `'right'` puts it there instead, facing the way they look, so it
  walks with them; in front is no `side` at all; FORMAT networks-39), `avoid` `{ who, range, dist, speed, area }` (keeps `dist` away along the floor,
  within `area` of its place, home once home is `dist + 0.2 m` clear of them) or `item` `{ target, speed, face }` (follows
  another object, shape or empty at the offset they are placed at, where that one is before its motion, `it.pre`, which
  `drawnPose` keeps, a little behind, turning with it as the two are placed), or `wall` (on the room's walls: "Things
  on walls" below). Which way Follow and Follow an item face: `face` `'them'` (its front, `+z` as placed, turned
  about the vertical through its middle to the person, or to the followed item's middle as drawn before its motion; right
  over it, within 5 cm along the floor, it keeps its turn; an item keeps its place where the offset puts it) or `'along'`
  (Follow: the way the person looks; an item: the turn it is placed at with that item, turning with it); absent, the defaults
  older layouts had (Follow in front `'them'`, behind or at a side `'along'`; an item `'along'`), so older layouts and rooms
  look the same; once pressed on the card it is kept, also when the side changes, and written as given; a value other
  than these makes the record bad; look and avoid drop it; FORMAT networks-40. `who` `'nearest'` (another nearer by 0.3 m takes over) or `'first'` (kept until
  `range + 0.5 m` away), `range` 3 m, `dist` 1 m (follow) or 1.5 m (avoid), `speed` 0.6 m/s, `area` 2 m by default, to the
  cm and held at their limits; a bad one makes the record bad. One person at a time among those in a headset at its
  circle (pages never count; outside a room this device's own head, a page's camera in Walk view too), chosen alike on
  every device from the shell's `HOST.collab.heads()` (the heads of the people in a headset at this device's live
  station, its own among them, from presence in room coordinates with the relay's time of each; room
  coordinates are the scene's at a station, no turn needed: "Placement in a headset" below): that person's headset drives it, moving it every frame from its own head
  (exact) and sending its move along the floor and its turn (the quiet effect `beh`, about ten times a second, every item
  it drives in one; once more with an end when it stops), every other device drawing it 120 ms behind those samples
  (the relay's clock), between them; ended or silent for 1 s, nobody in range, it goes home by itself, alike everywhere;
  two drivers at once settled by their claims (`'first'` the earlier arrival, `'nearest'` the newer driver, ties by id).
  `item` needs no driver. It is the pose pipeline's base stage (`POSE.base`, set only while the scene has a behaviour, so
  a scene without one is drawn exactly as before; while one has, every object, shape and empty goes through the
  pipeline), so a path and a motion draw over it and **the record never changes**; as a motion, it goes on while selected
  and rests while held here or paused. Its card (page and headset, before Motion): *Behaviour: None / Look at / Follow / Keep away
  / Follow an item...* (pointing at one, or the card's list), *Reacts to: Nearest / First to come close*, *Notices people
  within*, Follow's *Where: In front / Behind / Left / Right* and *Faces: Them / Where they look* (a line under
  it in words that match), *Stays in front of them at* (*behind them*, *at their left*, *at their right*) or *Keeps away
  by*, *Stays near its place, within*, *Moves at most*, and an item's *Faces: The item / As placed*; one Undo step
  each (a new kind drops `face`; another item to follow keeps it); a group's copy follows its own. `STUDIO.behave(id)`, `BEH.fake` and `BEH.log` for tests. FORMAT networks-35. Known limit: in VR the stick walk moves the scene for one headset alone, so near a boundary the others may choose
  differently for a moment. Untested on a headset: all of it at a real station (being followed, looked at or avoided life
  size, the choice and hand-over between real headsets over Wi-Fi, how smooth 120 ms behind looks, the cost), and how
  Faces feels there (a model walking beside you that turns to look at you, an item turning to look at the one it follows).
- **Things on walls** (`tools/studio/SPEC.md`, "Things on walls"; `engine/e6o_walls.js`). A behaviour of
  the kind `wall`: `{ kind: 'wall', at: 'direction' }` (on the first wall a ray from the walls' middle meets along its placed
  direction from the scene's origin, its placed middle's x and z; at the origin -z), `{ kind: 'wall', at: 'nearest' }` (the
  walls' point nearest its placed middle) or `{ kind: 'wall', at: 'person', who, range, speed }` (the walls' point nearest
  the person it reacts to, chosen as Follow and Look at choose, alike on every device from the heads, moving along there at
  most `speed` m/s; with nobody back to its `direction` place), each with `gap` (0 to 0.5 m, 3 cm by default, written only
  when not the default). There its back is against the wall (its middle the gap plus its own depth behind its middle off
  the wall, from its box: an object's model's, a shape's, an empty's point), its height its placed middle's held within the
  wall's bottom and top where it fits, its front (`+z` as placed) facing out of the wall into the room, its placed tilt
  kept; it eases there (about 0.4 s, `WALL_EASE`) when the walls change, never jumping. The walls are each headset's own:
  in an AR session whose frame has `detectedPlanes` (`plane-detection` enabled), every vertical plane (`orientation`
  `'vertical'` or labelled a wall; never a door) taken into the scene's frame (`GL.world`'s inverse) as a segment along the
  floor (its polygon's extent), its bottom and top and its normal turned towards the walls' middle (the middle of their box
  along the floor; when that is on a wall's line, as with one wall early in a room scan, a point in the room: the head
  as those walls were read, else the scene's origin, kept while they stay the same, which a ray in an item's direction
  then starts from too), read when the planes change and at most twice a second (once a second besides), as the robots
  read theirs (`wallsXR` from `xrBegin`; gone at the session's end). No walls (VR, a page, no room scan yet): it stays
  where it is placed, its card says so. Nothing is sent and nothing stored but the record: the same record maps onto
  each headset's own room. A base stage of the pose pipeline as the other behaviours are (`behaveBase`, with a height
  `ty` beside `tx`, `tz` and `d`), so a path and a motion draw over it, the record never changes, and it rests at its
  placed pose while held here or paused (its ghost there while editing). Its card: *Behaviour: ... / On a wall*, *Which
  wall: In its direction / Nearest / Follows the person*, *Gap from the wall* (*Less*, *More*), for a person *Reacts
  to*, *Notices people within* and *Moves at most*, and a line on the walls this headset has; one Undo step each.
  `STUDIO.walls(list)` gives pretend walls (`[{ a: [x, z], b: [x, z], y0, y1 }]` in the scene's frame; null the
  headset's own again) for tests. FORMAT `networks-43`. Untested on a headset: real plane detection on a Quest (which
  planes it lists as vertical, how steady their extents are, a multi-room scan), how things on walls look there, a
  person followed along the walls.
- **Motions** (curves later, the owner's plan; the recorder is "Recorded paths" below; `tools/studio/SPEC.md`,
  "Motions"; `engine/e6e_motion.js`). An object, a shape or an empty may have a `motion` in its record: `spin` (turns about
  the axis through its middle), `wobble` (tilts `amount` degrees, the tilt going round the axis), `bob` (along the axis by
  `amount` metres), `pulse` (grows and shrinks about its middle by `amount`, a share; no axis), `orbit` (round a circle of
  `amount` metres across the axis, its facing kept) or `sway` (swings `amount` degrees each way about the axis); `speed`
  turns or swings a minute (0.1 to 600, negative the other way), `axis` the scene's `'y'` (default), `'x'` or `'z'`,
  `start` `'always'` (on the scene's clock: at a station the room's, `HOST.collab.now()`, so everyone there sees the same
  phase; outside a room since the scene opened) or `'shown'` (from when it was last shown here, per device, as animations
  and sounds started when shown); the kind's own speed and amount when left out, out of range held, a bad one making the
  record bad. One pose pipeline draws it (`drawnPose(it, now, clockS, out)`: the placed pose, or what a behaviour gives
  instead, `POSE.base`; then its recorded path, `POSE.path`, below; then the motion, `motionDelta`, about its middle in
  the scene's frame), written each frame into the holder's matrix (`poseStep`, `matrixAutoUpdate` off while it moves), so
  the model, its unseen box, its labels and a sound following it or one of its bones come along (a pulse grows an
  object's followers' offsets, `motionK`), its cut-outs take the same change (`poseCut`); the holder's place, turn and
  scale stay the placed pose, so **the record never changes**, and a group's members move only by their own. It goes
  on while selected (editing or not: a motion picked on its card shows at once), and rests at its placed pose
  only while this device holds it (`motionRests`, from `restScan`'s list made once a frame: a grip or the sticks, its
  group carried, the page's arrows dragged on it or its group, its path being recorded, a sound or a cut-out on it
  carried, a group holding a sound on it carried), while a cut-out on it or a sound following it is selected here
  (editing: their arrows, box and corners stand on it where it is placed, so a drag of them never jumps; they have no
  ghost of their own) or Pause is on here ("The ghost, Pause and placing what moves" below);
  what is measured against it (attaching a sound, a bone, *Move onto it*, *Stop following*, a group's pivot, box, moves
  and *On the floor*, sizes, a cut-out's frame) is measured at its placed pose (`poseRest` in an action, `atPlaced`
  inside a frame). Its card (page and headset, editing on, not refused by a lock): *Motion: None / Spin / Wobble / Bob /
  Pulse / Orbit / Sway*, *Speed* (*Slower*, *Faster*, *The other way* for a spin and an orbit), *How far* (*Less*,
  *More*), *Axis*, *Starts: Always / When shown*, and a line saying it goes on while selected (a ghost where it is placed)
  and rests while carried; one Undo step each, shared and saved; then *Motions: playing / paused* and *Start again*. `STUDIO.pose(id)` for tests. FORMAT networks-35. Untested on a headset: how the motions look and feel life size, their phase across real headsets at a station,
  the cost of many moving items on a Quest.
- **Recorded paths** (`tools/studio/SPEC.md`, "Recorded paths"; `engine/e6f_path.js`). An object, a shape, an empty
  or a sound may have a recorded `path` in its record (a group has none: its members each keep their own and move with
  it, and its card says so; cubes and cut-outs have none, a cut-out going with its object's): `k`, its keys `[t, dx, dy,
  dz, qx, qy, qz, qw]`, `t` seconds from 0 (to the ms, the first 0, strictly increasing, the last at most 120), the pose
  then relative to its placed pose (the place in its placed frame turned but not scaled, to the mm; a turn after its
  placed turn, 4 decimals; a sound only moves), 2 to 600 keys an item and 6,000 a scene (so the station's state, one value
  at the relay, stays well under its 256 KB: a recording that would take the state past 224 KB is refused too); `play`
  `'loop'`, `'once'` (held at its last key) or `'bounce'` (back and forth); `start` `'always'` (the scene's clock: at a
  station the room's, the same moment for everyone there) or `'shown'` (from when it was last shown here); `speed` 0.25 to
  4. A bad one makes the record bad; a layout or a state from the room past the scene's 6,000 keys has the item past them
  dropped (counted) or ignored; a copy (Duplicate, a group's) that would pass them, or the state's 224 KB, is refused in
  words. Drawn by the pose pipeline as `POSE.path` (between keys the place in a straight line and the turn by slerp, then
  a motion on top), so moving or turning the item moves or turns its whole path, its record's place stays where it is
  placed, and what follows it (a sound, its cut-outs) comes along; a sound that follows something moves with that, its own
  path waiting until it follows nothing. Switched to its GLB, an object's keys are turned by the baked turn (`d' = r d`,
  `q' = r q r^-1`, `pathTurned`), so it moves as before. As a motion, it plays on while selected and rests at its placed
  pose while held here or paused (*Start again* restarts it); selected while
  editing it has a timeline under its rows ("A model's timeline" below: its own clock held, for everyone at a circle,
  shown through Pause). **Recording** (this device's own; nothing is written to
  the record or the room while it runs): in a headset *Record its movement* on its card arms it (`XR.rec`, as *Hold it* is
  armed: the two disarm each other, as do another selection, editing off and the session's end); the next grip of either
  hand, on it or anywhere, carries it as usual and records its holder's pose 30 times a second until it is let go (the
  sticks turn it and push it, and that is recorded; neither the left stick nor a second hand sizes it: a path has no size);
  on a page *Record* on its card starts it and *Stop* (or *Cancel*) ends it, the arrows (Move, Turn) and its card's
  buttons moving it meanwhile with their real timing (its size steps and the Size arrows off), the page's whole recording
  one change; selecting something else keeps it as Stop does, editing off cancels it. Then the samples are simplified
  (`pathSimplify`: a key kept wherever leaving it out would move its middle more than 5 mm or turn it more than 1 degree;
  4 mm and 0.9 degrees there, the rest left for rounding), and the path is written into its record with its place as it
  was when the recording began, one change, one Undo step (a *Record again* keeps the old path's play, start and speed);
  a path that plays in a loop is joined first (the loop join, below); it plays at once. Refused in words (`REC_NOTE` on its card): too short, not moved, more than 600 keys once simplified, the
  scene's 6,000, the shared state's 224 KB; a locked item (*Lock in place*) and a sound that follows something cannot be
  recorded; at 120 s (600 s with a relay that takes uploads: "Ten minutes, as a file" below) the recording stops by itself
  and is kept. Its rows (page and headset): *Recorded path: n s, k keys*
  with *Record* / *Record again* (page) or *Record its movement* (headset), *Plays: Loop / Once / Back and forth*, *Starts:
  Always / When shown*, *Speed* (*Slower*, *Faster* through ×0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4) and *Delete recording*,
  one Undo step each; what the loop join did, with *Keep it as recorded*; *Motions: playing / paused* and *Start again*.
  `RECLAST` keeps the last recording's samples and
  `recClock` its clock (the tests set their own). FORMAT networks-35. Untested on a headset: recording with real
  grips and sticks (the pose sampled from a real carry at the headset's frame rate), how a recorded path plays back life
  size, its phase across real headsets at a station, a recording's simplification and its stall on a Quest (a 120 s one
  at 30 samples a second), the cost of many items on paths.
  - **Ten minutes, as a file** (`tools/studio/SPEC.md`, "Ten minutes, as a file"; `engine/e6j_voice.js`).
    With a relay that takes uploads a recording may run up to 600 s (`recCap`, then it stops by itself and is kept;
    without one 120 s). One that fits the record's limits (at most 120 s and 600 keys once simplified) stays in the
    record; a longer one, or one of more than 600 keys (up to 40,000), is kept as a file of the scene,
    `recordings/<the item's name>-<n>.json` (`{ studio: 1, recording: 1, item, len, n, k }`, the keys as a record keeps
    them; the first `n` free, never written over, so Undo can give an older record back with its file; at most 4 MB, the
    relay's rule), uploaded as the converter's GLBs are (`upSend`: through the relay or straight into R2), and the
    record's path is then `{ src, len, n, play, start, speed }`, written once the file is in (one change, one Undo step;
    the item stands where it is placed meanwhile: the change a page's recording ends, the item put back where it began,
    is empty and dropped). A recording of more than 2 minutes of samples is simplified a slice of about 8 ms at a time
    between timer tasks (`recSoon`, `simplifySoon`, `simpStart`/`simpRun`: the same keys as `pathSimplify` at once; the
    card says *Simplifying the recording*), so a headset never stalls on it (measured in headless Chromium: 18,000 jittery
    samples, 43 ms of work at once in 6 slices, the longest 8 ms; the ten-minute test's 18,000 smooth ones in 17 slices,
    the longest 19 ms; untested on a Quest); its upload's share on the card. The device that made it keeps its keys (`PF`, `own`); every other
    device reads the file (`pathK`, `pfLoad`, through `call()`: the password as a header, R2's signed link) once it is
    listed, and again when it changes; until then the item rests where it is placed. The scene's 6,000 keys and the
    shared state's 224 KB count only keys in records (`pathN`). Without a relay that takes uploads a recording that needs
    a file is refused in words (*A recording longer than 2 minutes needs a relay that takes uploads*; more than 600 keys:
    *... a longer one is kept as a file of the scene, which needs a relay that takes uploads*). A GLB switch writes its keys
    turned into a new file first (`pathFileTurned`, `pathFilesTurned`, then `switchToGLB`'s `pmap`); an object whose file
    cannot be turned (no relay that takes uploads, its keys not read within 5 s, the upload refused) is not switched: it
    stays on its original, where it plays as before, and its card (`it.swNote`, page and headset) and the conversion's note
    (`heldWords`) say why, *Switch to the GLB* trying again. *Move the scene to this circle* turns a sound's own path kept
    as a file into a new file the same way first (`sceneToCircleFiles`), or is refused in words, nothing moved. Loop, once, back and forth, speed,
    Start again, the loop join and *Keep it as recorded* work for both kinds. Its card: *Recorded path: 4:12, 3,812 keys,
    kept as a file* and the file's name. FORMAT networks-37 (`src` on a path, `sync` on a sound).
  - **A voice with the movement** (`tools/studio/SPEC.md`, "A voice with the movement"; `engine/e6j_voice.js`).
    *With my voice: on / off* among the recorder's rows (an object's, a shape's and an empty's card, page and headset; this
    device's own, `studioRecVoice`, kept) asks for the microphone as it is turned on (`getUserMedia`, 15 s at most; the
    headset's card says to allow it on the 2D page first: the browser may not show its question inside a session); greyed
    without a relay that takes uploads or `MediaRecorder`. While a recording runs with it on the microphone is recorded
    (`MediaRecorder`, a chunk a second) with a short level meter on the card (an analyser on the shell's context,
    connected to nothing else). Kept with the recording (dropped with one cancelled or refused): made a mono sound as the
    Upload pane makes sounds (up to 20 s a 16-bit WAV at 48 kHz by `monoWav`; longer, the relay's `ffmpeg`'s mono MP3;
    without it as it came), uploaded to `sounds/<the item's name>-voice-<n>`, and placed as a sound item *<item> voice*
    following the recorded item (its *Head* bone when it has one, else its top), `loop: false`, its record's `sync` (the
    item's id), `skip` (the stillness the loop join cut from the path's start less how late the microphone began; negative:
    it starts that much later, its card says so) and `len` (where it ends in the path's own time: its file's end, `dur -
    skip`, at most the path's end, so a voice whose microphone began late is not cut short at its end); the path and the
    sound one change, one Undo step (the files stay). *Record again* with it on writes a new file (the first `n` free, never
    the old one written over) and points that sound at it (one sound per recorded item: `voiceOf`), so Undo gives the old
    file back and no device keeps playing an old copy of a file changed under it. It plays from each start of the path
    (`syncAt`: each loop; once; on the way there with back and forth), on the path's clock, so everyone at a circle hears it
    at the same moment (a decoded voice started 20 ms ahead at where it will be, `start(when, offset, duration)`; a streamed
    one, longer than 20 s, set to its moment as its element can take it, 50 ms ahead to begin with, then kept there:
    `syncStream` compares its element with the path's clock about twice a second and sets it again when it is more than 80
    ms off, ahead by how late its last setting came in, `S.lag`); either at its level at once at each start (not faded in);
    at a path speed other than ×1 at its own pace from each start (its card says so). The recording deleted (or its item gone), it plays as a sound of its own, its card saying *no longer synced*.
    A group's copy of a voice plays with its item's copy. `STUDIO.voice(id)` (a streamed one's element, drift and settings
    too), `STUDIO.pf(src)` and `SIMP.last` for tests. Untested: the microphone in a Quest session, how a voice sounds
    following a model there, a voice over 20 s through a real relay's `ffmpeg`, a streamed voice kept on the path's clock
    in Quest Browser (its element's seeking) and across real headsets, Safari's `MediaRecorder`.
  - **Stays on the floor** (`tools/studio/SPEC.md`, "Stays
    on the floor"; `engine/e6f_path.js`: `FLOOR`, `recDown`, `recFloor`, `floorRows`). *Stays on the floor: on / off*
    among the recorder's rows (an object's, a shape's, an empty's and a sound's card, page and headset; this device's own,
    `studioRecFloor` in `localStorage`, off by default; a line under it says what it does). A recording begun with it on
    sets an object or a shape down first, its lowest point on the floor (`y = 0` in the scene's frame, as *On the floor*
    measures it: `objBox`, `shapeBox`), and that is where it begins (its ghost there) and the place written with its path;
    then every frame, before it is sampled and drawn (`recFloor`, first in `recSample`, so after a headset's carry and its
    sticks; on a page also as the arrows move it, before `tcRead`), its height stays and its turn keeps only its turn about
    the vertical since it began (a swing-twist split about the scene's `y` axis: `q = twist q0`), so it slides along the
    floor and turns about the vertical, the side that was lowest kept on the floor. An empty keeps its height and turns
    only about the vertical; a sound keeps its height; an object whose model is not in yet keeps its height. On a page the
    arrows lose their up arrow and tilting rings while it records so, and *Stand up* is refused and greyed. Its keys hold to
    it (to a record's rounding), nothing new in the record (no `FORMAT` change); the loop join, simplifying, the voice, ten
    minutes as a file and *Record again* work as before. Cancelled or refused, it goes back where it was before it was set
    down (nothing to undo); kept, one change, one Undo step, as ever (one kept later by `recKeep` writes the set-down place
    with its path). Untested on a headset: how carrying something that stays on the floor feels (the hand lifting it while
    it slides below), recording so with real grips and sticks, how a grounded path plays back life size on a real floor.
- **The ghost, Pause and placing what moves** (`tools/studio/SPEC.md`, "The ghost, Pause
  and placing what moves"; `engine/e6h_ghost.js`). An item with a motion, a recorded path or a behaviour goes on while it
  is selected. While a selected item (or a selected group's member) is drawn more than 1 cm or 1 degree from its placed
  pose (`ghostFar`, from `it.mX`; and for 0.6 s after, so a spin through its place does not blink it), and every item
  that moves while editing, selected or not (the owner's rule: ghosts always visible for animated things in edit mode;
  at most `GHOST.build`, 4, new ones a frame; none once it rests, none with editing off), and a model its own clip
  moves while editing, the whole time its clip plays, selected or not (`clipMoves`; its parts taken in their rest pose
  and put back as they were, never through the mixer: with its clip standing still three.js's mixer writes nothing
  back and would leave the model in its rest pose; its holder never leaves its placed pose, so the page's arrows stand on the item there), its ghost stands there (`GH`, `ghostStep` at the end of `itemsStep`): an object's model copied with its geometry shared and one
  opaque light grey material (Lambert, depth written, pushed a hair back by `polygonOffset` so the
  item wins where the two meet, a mesh without normals flat-shaded; a skinned mesh as a plain one, its rest pose), a
  shape's shape, an empty's cross and dot, a sound's speaker, all opaque; a model of more than 100,000 triangles
  (`GHOST.tris`), a model its own clip moves (its ghost would stand where it is drawn; the owner: an outline box, no
  transparent walls) and a model a cube hides from you only its unseen box's edges, opaque
  lines (`ghostLine`; no clip ghost at all for a hidden one: its own edges stand there);
  built once per selection and freed when it changes (its materials disposed, never the shared geometry). The ghost is
  pointed at as the item (its unseen box among `pickables`, `userData.ghost`): the trigger selects the item, the grip on
  the ghost (or on the item where it is drawn) carries it from its placed pose, and let go it moves on from there. On a
  page the arrows stand on the ghost: `TransformControls` hold a stand-in, `TCP`, at the placed pose while the item is
  drawn moving (`tcTarget`, `tcProxy`, `tcStep`; never switched during a drag), each change going into the holder's
  place, turn and scale and then `tcRead`, as a drag of the item would; the item rests there while dragged (it is
  carried). A cut-out made where a click met a moving model goes on that part of it (`cutRay` keeps the ray in the model's
  own frame as drawn then, or as placed for a ghost; `cutAt` casts it onto the model at its placed pose). **Pause**
  (`MPAUSE`, `pauseSet`; this device's own, never in `state()`, never saved, off as soon as editing is off, never for a
  visitor): *Motions: playing / paused* on the Scene pane while editing and on the card of anything that moves (a motion,
  a path, a behaviour, a model's animation that plays), P on a page; every item at its placed pose (a behaviour this
  device drives given up, its last sample saying so), the models' animations holding their frame (`animStep` sets no
  time), sounds playing on; played again, everything goes on by its clock. *Start again* (this device's, no change
  recorded) on the card of an item whose path or motion starts *When shown* or whose path plays *Once*: its *shown* clock
  from now (`it.shownAt`), a path that plays once played once more (`it.again`). **The recording's ghost and the loop join**: while a path is recorded
  its ghost stands at the start pose (`REC.p0`, `REC.q0`, `REC.s0`) the whole time; once the item has been more than 15
  cm (its middle) or 30 degrees away (`REC.away`), coming back within 5 cm and 10 degrees lights it (greenish white) with
  a soft tick at the ghost (`hover`, forced) and a gentle pulse on the carrying controller (`buzz(c, 0.1, 25)`)
  (`recGhost`); let go or *Stop* while it is lit puts the end exactly on the start. A path that plays *Loop* (a new one's;
  *Record again* keeps the old play) is joined (`pathJoin`): its still start (until it has moved more than 1 cm or 1
  degree) and still end (after it last moved that far) cut, then, with its end within 15 cm and 20 degrees of its start,
  its last 0.5 s (a quarter of it under 2 s) bent onto its start (its place along a cubic Hermite to the start's place and
  the speed of its first 0.1 s, its turn by a smoothstep-weighted correction), its last key its first's pose; then
  simplified. Its card (`REC_NOTE.join`, while `RECLAST` holds the recording): *Loop closed: its end met its start (6 cm,
  4° apart; 0.4 s of stillness cut)* with *Keep it as recorded* (the raw samples simplified, one Undo step), or *Its end is
  40 cm from its start, so it jumps back each loop: record again and end at the ghost to close it.* Nothing new in the
  record or `state()`: no `FORMAT` change. `STUDIO.ghost(id)` for tests. Untested on a headset: how the ghost reads life
  size and over a real room, carrying an item by its ghost with real controllers, finding the ghost by hand while
  recording, the tick and the pulse on a real controller, how a joined loop looks there, Pause from the headset's panel.
- **A model's timeline** (the owner's rules: play and pause for everyone in the circle, pause and scrubbing temporary;
  `engine/e6m_anim.js`, `tools/studio/SPEC.md` "A model's timeline"). Two timelines, each with
  a hold of its own (its channel: `clip` or `path`): an object whose clip plays (Loop or Once), selected while editing,
  under its Animation rows; and an object, a shape, an empty or a sound with a recorded path (in its record or kept
  as a file), selected while editing and not being recorded, under its Recorded path rows. What a path's holds is its own
  clock (the item's time `POSE.path` reads, before its speed, Loop, Once or Back and forth: `pathT`, `pathTime`), so its
  range is one cycle of what is seen (its length at its speed, twice that for Back and forth; `pathCycle`). Each shows
  (page and headset) *Pause* / *Play*, *Start*, *−1 s*, *+1 s* (round a Loop, held at the ends of Once), *The scene's
  clock*; on a page *Timeline: t s of d s* and a slider in tenths (`stuRangeAnim`, `stuRangePath`; acts `an:*` and `ap:*`),
  in a headset *Timeline (d s): playing / held, paused...* and under it a bar (a block `{ bar: { id, ch } }`,
  `drawBar` in `engine/e9_panels.js`: a track the card's width, the part played filled, cyan, amber while held paused, the
  playhead ringed while held with its time over it, ticks at whole seconds up to 30 s (tenths up to 3 s), its ends' times
  under it), pointed at and pressed or dragged with the trigger (its region's `drag`, as the foot panel's track): held
  there, paused, for everyone at the circle (`animScrub`), and let go it stays held there. While the card is not drawn
  again the bar moves on its own strip at most ten times a second (`barsTick`: drawn on a small canvas of its own, put on
  the card's and sent to the texture alone, `panelPatch`, texSubImage2D and its mipmaps, about 400 KB, not the card's 4.9
  MB; no WebGL2: the whole card), so the card's signature (`animSig(true)`) holds only who holds what. A press holds it
  here (`ANIM.mine`, the clip's; `ANIM.mineP`, the path's: its time at a moment of the clock, playing or not) and, at a
  station, everyone at the circle draws the same moment: a quiet effect of the studio's, `anim` (`{ at, a: [id, t, p] }`,
  `c: 'p'` for a path's, four times a second and at once on each press, `{ at, a: [id], end: 1 }` at the end; a slider
  or a bar moving is told four times a second), the relay's clock as at; a word that says what the hold kept says
  already (the same holder, the same moment within 30 ms) only keeps it fresh; nothing stored or saved, no record change,
  no Undo step, no `FORMAT` change. It lets go, back to the scene's clock (or from when shown) for everyone, when the item
  is no longer selected here, editing goes off, its clip stops or changes (a path deleted, recorded again, its play, start
  or speed changed, a recording starting), or *The scene's clock* is pressed; a device that hears nothing for 1.2 s lets
  go by itself; two holding one at once, the latest word wins on the others. A hold shows through Pause: a held
  path is drawn at its held moment over its placed pose, no motion or behaviour (`pathHeld` in `drawnPose`; carried, it
  rests as ever). A voice recorded with the path (`syncAt`) follows its hold: silent while held paused, from the held
  moment while held playing (each hold a pass of its own: a decoded voice starts again there, a streamed one is set
  there), on the path's clock again once let go. The page's card follows each timeline every frame without drawing the
  pane again (`animCardStep`), and a slider being moved holds the pane still until let go. On a headset's card the rows
  push Place and Size a little down (scroll to them). `animState()` (`{ mine, mineP, heard }`), `animSet(it, t, p,
  quiet, ch)`, `animBar(ch)` and `XR.main.patched` for tests. Untested on a headset: how the bar reads and drags on a
  Quest (its strip sent alone, its mipmaps), how in step a held frame looks for several people at a circle, a held voice
  in Quest Browser.
- **As it moves: clip by distance** (v164, FORMAT networks-53; the owner, 18 November 2026: "would also need feet solver
  for npcs that move around?", and clip by distance first, foot locking maybe later; `tools/studio/SPEC.md` "As it
  moves"; `engine/e6y_walks.js`). An object's Animation row gains *As it moves* (`anim: 'move'`): its clip is its walk,
  and the clip's time follows the distance it covers along the floor, one cycle a stride. On its recorded path the
  distance is the path's own at the path's moment (`it.pS` from `POSE.path`), so every device agrees and the path's
  timeline scrubs the walk (the stride fitted to a looping path, no jump as it comes round); moved any other way (a
  behaviour, a wall, a motion, a tracker, carried) it is measured from what is drawn, frame to frame. Backwards plays it
  backwards; below 0.05 m/s it settles to standing over 0.3 s: its `idle` clip (*Standing: <clip> ▸* / *Still*), else its
  walk held where its feet are together, never the bind pose. The stride is measured once a clip from the clip (a walk in
  place: how fast the foot on the ground moves back under the hips; root motion: the hips' travel, taken out of what
  plays), times its scale and `strideK` (*Stride: 1.29 m*, *Shorter*, *Longer*, *As measured*; 50 % to 200 %, absent
  at 100 %). Its clip has no timeline (the path keeps its own); a cube's clip wins while it plays. The record's new
  fields: `anim: 'move'`, `idle` (a clip's name) and `strideK`, each kept only when set, in `layout.json` and the shared
  state alike. `STUDIO.walk(id)` for tests; the walks test scene (`tools/studio/test/scenes/walks`: a neon walker with
  Walk, Idle and Walk forward, one on a path, one following it). Foot locking can come on top later (the same samples
  know where each foot is down). Untested on a headset: how it looks walking and turning beside you, the crossfades at
  a real frame rate, following a person or a tracker in a room, and how far its feet slide.
- **Nothing see-through while editing** (the owner's rule, for frame rate: a
  see-through layer is drawn again over what is behind it, and a room scan drawn faint or a cube round you filled a
  headset's view several layers deep). Every look the studio draws while editing is opaque lines, small opaque meshes
  and opaque tags (`tools/studio/sets/looks.js`; what lit up by opacity lights up by colour): a trigger cube its edges
  and name, a shape that hides things its edges, a cut-out its dashed edges and ticks, a ghost light grey, a sound's
  speaker, ring and line, an empty's cross, a group's dashed box, the selected and pointed-at outlines, a loading model's
  grey box; the tags (`LOOKS.tag`, the pick ticks too) an opaque band drawn with the opaque things after the items
  (`renderOrder` 12, no depth test), so still over everything they draw. Only the 1.6 s flash of an item from a cube's
  card pulses see-through (lines).
  - What a cube hides from you (`it.hid`, `itemsStep`): a model or a coloured shape is not drawn at all (its model's
    `visible` off; a shape's mesh), snapping, no fade, and shown by its unseen box's edges (`LOOKS.hidBox`, opaque, a
    muted grey-blue; a shape its own edges) and its tag with *· hidden*; still pointed at, selected and carried through
    its unseen box (`pickables`, `insidePick`; its animation holds meanwhile). While this device holds it (`heldHere`:
    a grip, both grips, *Hold it*, the sticks while carried, the page's arrows on it or its group, a group carried, its
    path recorded) it is drawn whole, every material its own (opacity, depth written: fully opaque, the owner's wish), its edges hidden; let go, its edges again. Not editing: as before (fading in
    and out over 0.4 s). A model still loading that a cube hides shows its grey box (opaque) with *· hidden*.
  - Triangles in space: while editing every placed model has a tag over its top (`modelTag`, made the first time it shows, placed by
    `itemTopInto` each frame; its words built and its canvas drawn again only when they change), *Atelier · 397k ▲*
    (`kTris`), *· hidden* while a cube hides it, its lock mark (`tagName`); not while it is pointed at or selected, where
    the engine's labels say it (*object · 397k ▲ · selected*). The count (`trisNow`): while Fewer triangles previews it,
    the preview's (`FT.pv.to`); built, its model's (`trisOf`, counted once per model, so a GLB switch counts again); not
    built yet, its file's or its GLB record's `n` as far as the page has read it (nothing fetched for it). A shape's tag
    says its primitive's triangles (`LOOKS.shapeTris`). No layout, `state()` or `FORMAT` change.
  - Untested on a headset: the frame-rate gain on a Quest (the shell's frame-rate read-out, a double press of B or Y,
    says the story's triangles, draw calls and code time: compare a scan hidden by a cube, or a cube round you, with
    v130, which drew them see-through), how the edges, the light grey ghosts and the tags read life size, and the cost of a tag per model (one draw
    call each) in a scene of many models.
- **Performance** (a big studio scene is unloaded after 2 minutes away, the owner's choice):
  - Matrix walks: a node nothing moves keeps its matrix as it is (`matrixAutoUpdate` off; a model with no clip and no bones all
    its nodes, one with clips every node no track names; a rigged one keeps all, its bones are solved), a slot group never moved,
    and `worldToLocal` of the head takes only its own parents' matrices. Skinned meshes are culled by the rest sphere grown by
    half (`skinCull`) unless a clip moves them far (a bone's position track, root motion) or they can be worn.
  - Early uploads: a built model goes to the GPU a little a frame (`warmQueue`, `warmUpStep`: one picture with its mipmaps, or
    meshes up to about 150k triangles, into a 1 x 1 target), cube-hidden or out of view, only in a headset; what editing draws
    the first time is compiled early (`warmEdit`, `warmEditStep`). The stage's late look (`stage.late`) follows whether cubes
    hide. Maps reused each frame (`S`, `H` in the triggers).
  - When this headset is away from the station (the lobby, before any circle, behind the Stories screen) `XR.onIdle` stops the
    emitters and screens at once (`AWAY.stop`, 600 ms: elements paused; the idle frame would cut their own fade short), after
    20 s drops streams' elements and the screens' elements and textures (`AWAY.drop`, they come back by themselves), and after
    **2 minutes** frees the models' GPU copies and memory and the decoded sounds (`AWAY.free`, `awayFree`): the records, layout,
    small looks and file list stay, so nothing is written to the room, no Undo step is made and *Unsaved changes* never moves.
    Back at the station every model loads again as on opening the scene (a grey box and its line meanwhile) and sounds decode as
    wanted (`XR.onWake`, `awayStep`). Never while work on this device runs (`awayBusy`: a recording, an upload, a conversion, a
    preview, a stroke, a scan): it waits. `STUDIO.away({ stop, drop, free, force })` for tests (`force` stands in for `xrAway`).
  - Untested on a headset: the return pause after a free (a big scan loading again), the early uploads on a Quest, skin culling,
    and the drop and wake of a streamed sound and a screen's video there.
- **Editing without the cost** (`tools/studio/SPEC.md`, "Editing without the cost"). Edit mode must not do these every
  frame: the labels of what is pointed at and selected are made again only when their words change (`labelSet`, `L.key`;
  else a new canvas, texture, sprite material and shader program link every frame something is pointed at); the scene's
  matrices are not made again for each pick (`rayPick` takes them as they are: a headset's after `xrBegin`, again only
  after the other hand moved something, `XR.pickStale`; a page's through `pagePick`, once); the whole panel (4.9 MB) is not
  drawn and sent for every item or button the ray crosses (the item pointed at in the scene is out of `sigMain`; a change
  of the button pointed at alone draws again and sends only its rectangles, before and after, `panelHover`, each on a
  small canvas of its own as a timeline's bar is, texSubImage2D; the menu's Story tab draws that texture too); the page's
  panes are not built while a headset presents (`renderPanes`, then once the session ends); tags and lines are not one
  draw each (each keeps its own objects, as the engine and tests know them, but on a layer no
  camera sees, and `GL.scene.onBeforeRender` gathers those shown into a few draws: every tag in one, its pictures on one
  canvas, `LOOKS.BT.atlas`, and the lines in one a kind, dashes as dashes, `LOOKS.batch`). Measured with a pretend headset
  on a 400,000-triangle scan with 40 items (v136): script a frame editing 7.6 to 14.7 ms down to 4.2 to 6.9 (viewing 2.9 to 3.4,
  SwiftShader), draws 210 down to 132 (viewing 104). No layout, `state()` or `FORMAT` change. Untested on a headset: the
  frame rate on a Quest, how the tags read from one canvas, a hover patch's cost there.
- **Editing**: off by default; *Edit* on the Scene pane turns it on for this device (`studioEdit`; `&edit` too), never
  in `state()`; refused (greyed, *This scene is locked*) while the station's story is locked (`HOST.anchor.locked`
  there: *Lock this story*); not offered at all with `&visit` (a visitor's kiosk: no Edit, no Upload, also with
  `&upload` in its link). *Undo* takes back this device's last 30 changes. In a headset the ray lights and names an
  item and the trigger (or a pinch) selects it (nothing: clears); the grip carries an object or a sound as the design
  room's miniatures (its offset from the hand kept, turning with the hand while free moving is on, else only about the
  vertical) and a cube (level, only its yaw turns); both grips size an object (a twentieth to twenty times) and move it
  with their middle; a selected cube's 8 corner balls stretch it (the opposite corner stays); let go, it stays and its
  record is written. The sticks while something is carried by one hand (the owner's mapping: left stick up and down
  size, left and right turn; right stick up and down away and nearer, left and right turn too), whichever hand carries it (`holdSticks`, `holdApply` in `engine/e8_xr.js`): the left stick up sizes it up
  and down sizes it down (twice the size in 1.5 s held fully, about its middle, a group about its pivot; a twentieth to
  twenty times and each record's own limits, as both grips and the size steps: an object's cut-outs and following sounds
  scaled with it, `scaleFollowers`; a shape's, a cube's and a cut-out's sides; a sound's reach; an empty has no size), left
  and right turn it about the vertical (90 degrees a second, pushed right its near side goes right); the right stick up
  pushes it away along the carrying line and down pulls it in (its reach, 0.15 to 8 times), left and right turn it too. A
  hand that carries something else steers that with its own stick. A dead zone of 0.2, the rate the push's square past
  it; part of the carry (its records written with the carry's, one Undo step); a locked item is refused as the grip is,
  so the sticks never reach it; nothing scrolls the panel meanwhile. A line on the headset's card under *Carry it* says
  it. In VR, while nothing is carried, the left stick
  walks you through the scene and the right stick turns you 30 degrees a flick (the scene moves, `XR.walk`, never the
  rig; per device, reset by Recenter, at a station too, never written to the room). These are the studio's own sticks: the
  left stick clicked twice (the shell's moving with the sticks, the same setting as in every story, VR only) switches them to
  moving you, also while something is carried, which comes along in the hand, and back (`stickMove`, by the
  shell's numbers, the scene moving as with its own walk, in a shared room too; the notice, the menu row's note and the
  card's line under *Carry it* say which: "The studio's two stick modes" under "Four headset settings"); in AR you walk
  for real, and objects stand on the real
  floor (the session's `local-floor`, its height in the renderer's space from `frame.getPose`; at a station the room's).
  From the inside (models can be touched and moved from the inside): when
  the ray finds nothing at all and the controller is inside an object's unseen box (a room scan you stand in), that
  object is pointed at, the smallest such box if several (`rayPick(ray, { inside: true })`, `insidePick`; anything the ray
  finds wins; it beats the floor), so the trigger selects it and the grip carries it, as cubes have always worked; on a
  page the same for the camera in Walk view, a click on the floor still walking. *Hold it* (a selected item's headset card,
  under *Carry it*): the next grip of either hand, wherever it points (not at the shell's menu or a station), carries it
  from where it stands as a grip on it would (a group as a whole), one Undo step; once, then disarmed (again, another
  selection, editing off or the session's end disarm it; `XR.hold`, `holdHover`). A stick pushed up or down while its ray
  is on the studio's panel (or its copy on the menu's Story tab) scrolls a pane taller than the panel (a dead zone of
  0.2, faster the further pushed, from a third of the speed to all of it in 0.8 s held, stopped at either end as Up and
  More are: `stickScroll`, `X.scrollMax`), never while something is carried (the sticks steer it); there the left stick does not walk nor
  the right stick turn. No other story's headset panel scrolls with Up/More buttons (the design room's
  prop card cuts a long list of params short and says the page's card lists them all).
  On a page a click selects, `TransformControls` move, turn and size the selection (W, E, R, or its card's buttons;
  cubes take per-axis size from R; sounds only move), the views are *Orbit* (round the scene) and *Walk* (first person
  at 1.6 m: W A S D or the arrows, drag to look, a click on the floor walks there: where cubes trigger on a page), and
  Delete, Duplicate (D) and Undo (Ctrl+Z) work from the keyboard. Walk view's mouse (as in most games): a
  drag looks the way the mouse goes (right looks right, up looks up), and a click with a mouse grabs it (the browser's
  pointer lock, `GRAB` in `engine/e7_explore.js`): the mouse turns you, W A S D walk, a crosshair in the middle where a
  click selects or walks (`clickAt` at the page's middle), a line under the view saying how; Esc lets go (the browser's
  own; the studio's Esc deselects nothing then), as do leaving Walk view, explore mode or the page. A browser without
  the lock just clicks, and so does one whose request was refused (as within a second of Esc) for 1.5 s. Orbit view has
  no lock. New items go 1.5 m in front of you on the floor (a
  model's lowest point on it), selected.
- **The panes** (page HTML and headset canvas twins, the same content): **Scene** (the scene and the scenes to pick
  from, a station's for everyone at it; *Edit*; *Save*, which says *Saved 22:41* (*by Anna* for another device's save)
  or why not; *Unsaved changes* while what is placed differs from what was last saved or loaded; *Load saved*, two
  presses; *Undo*; *Reset what I have seen*; on a page *Download layout.json*; the relay's state, or how to run one;
  *New scene*: on a page a field and *Make it*, in a headset *New scene...* asking the shell's keypad,
  `HOST.collab.keypad({ title, hint, value, max })`, no button without it; made by `POST /api/scenes` and opened as one
  picked by hand, editing on; *Duplicate scene* beside it (v167: the same field or keypad, filled with *<scene> copy*,
  `NS.from`; `POST /api/scenes { name, from }` copies every file and the saved layout, locks kept, no `.history/`; files
  not copied counted); *Copies of stories* (v170; `COPIES` in `e4_files.js`): the relay's scenes whose `layout.json` holds
  a story's arrangement (`HOST.arrange.list()`, read when the listing has a name like `<key>-copy[-n]`), each *Copy of
  <title>* with *Open*, which plays that story with the copy (`HOST.arrange.open`: at a studio circle you leave it for the
  story); a copy is never among the scenes to pick (a name like one waits for the list; one whose layout holds no story,
  `atelier-copy`, is then a scene like any other), never opened as a scene; one read at a time, again only when the
  names like a copy's (their times, whether they have a layout) changed or a layout of one was saved; and
  the studio's Save keeps a layout's `story` as it was read (`STU.story`, `keepStory`; "A story's copy" in
  `docs/agents/shell.md`); while editing, the scene's settings: *Other circles* and *Real world hides the
  scene*; *Examples*, the scenes that ship with the app: "Example scenes" below), **Add** (editing: the scene's models with their size and a warning mark, a grid of cards with
  their pictures and *Make pictures* on a page, its sounds,
  *Originals* folded, *Trigger cube*, *Convert every model*; *Shapes* (Cube, Sphere, Cylinder, Plane) and *Empty*; *From another scene...*: the relay's other scenes, then
  one's models (cards with the pictures that scene keeps, as the Add pane's; a plain tile where it has none, v165:
  `pvFrom`, `cardPic`) and sounds, `models/` and `sounds/` first, its originals folded; a press copies the file in at the same
  path, a new name when taken, `POST .../copy`, with the files a non-GLB model names that its scene has, found as the
  Upload pane's plan finds them, one whose path is taken here kept as this scene's, an OBJ and its MTL under
  `originals/`; then placed as Add places it, one Undo step; each scene keeps its own copy. New scene and From another
  scene only with a relay that takes uploads, never read only, `&visit`, editing off (the copy) or a locked scene),
  **Item** (the selection's card and its controls: lit or as scanned, the clip and
  *Loop* / *Once* / *Off*, *Always* / *When shown*, *Turn 90°*, *Stand up*, *On the floor*, size steps,
  *Duplicate*, *Delete*; a cube's size steps, *While inside* / *Stays once entered*, *Pick what it shows* and *Pick
  what it hides*, pointing at items to add or remove them until *Done*, and what it shows and hides as buttons (one
  flashes the item's box in the scene for 1.6 s while editing, green if the cube shows it and red if it hides it;
  *Its card* opens the item's card; ✕ takes it off the list, one Undo step); a sound's volume, reach, loop and start),
  **Items** (every item a card in the Add pane's grid look, page and headset alike, `itemCard`; an
  object its model file's picture exactly as the Add pane shows it for that file, else the plain tile with its kind; a
  shape, a sound, a trigger cube, an empty and a cut-out cutting nothing a tile drawn for it in its colour, `tileFor` in
  `engine/e7e_pics.js`, one canvas a kind and colour, the page showing it as a data URL; its name, a short line, *1.7 m ·
  24k triangles*, *Sphere*, *Sound · follows Dancer · Head*, *Cube · shows 2, hides 1*, *Empty*, and a faint one; 🔒 and
  *moves* marks, and the faint line says what moves it, *spins*, *recorded path*, *follows people* (a headset has no tooltip); groups first, a heading each, `.stu-gh`, a press selecting the group, with their members'
  cards under it; an object's cut-outs tags on its card, a press selecting one; the selected card's border in the accent
  colour, one on a cube's list being picked green or red, a cut-out's tag too; a press selects it or, picking, picks it;
  with a cube selected *Shows* and *Hides* under every card but the cube's own and under each cut-out's tag (in the
  headset the tag keeps the card's whole width, its toggles on a row of their own), one Undo step each, page and
  headset, regions `tick:show:<id>` and `tick:hide:<id>`; the
  headset's canvas three a row, a row as tall as its tallest card, `drawItemCards` in `engine/e9_panels.js`, paged by Up,
  More and the stick; the card faces and headings keep the rows' ids, `sel:<id>`; which GLB stands for a file worked out
  once a render, only when an object's card asks; no layout or `state()` change) and
  **Upload** (pages only). `&tab=scene|add|item|items|upload`, `&view=walk`.
- **Saving**: *Save* writes what is placed now to the relay's `layout.json` (for everyone at a station); a read-only
  source offers *Download layout.json*. Outside a room what is placed is also kept on this device
  (`studioDraft.<source>.<scene>` in `localStorage`, a second after each change), and opening the scene with a draft
  newer than the saved layout and different from it offers *Your unsaved changes from <time>: Restore / Discard*.
- **Example scenes** (`tools/studio/SPEC.md`, "Example scenes"; `engine/e7g_examples.js`). A folder `examples/` at
  the app's root holds scene folders and their listings exactly as `tools/studio/scan.mjs` writes them
  (`examples/index.json` and `examples/<name>/files.json`; `&examples=<a relative folder>` picks another, `'examples'` by
  default: the tests point it at `tools/studio/test/examples/`, whose `tiny` scene `tools/studio/test/make.mjs` writes). The
  first is `bliss-xp`, the XP room (`tools/studio/xp/make.mjs`). The Scene pane lists them, page and headset (*Examples
  (they come with the app)*): *Open* (the scene from that folder, read only, as `&scenes=examples&scene=<name>` opens it;
  editing works on this device, *Download layout.json* keeps it; *Back to your scenes* returns to where scenes came from
  before) and, with a relay that takes uploads (page and headset), *Copy to the relay* (a free scene name, the
  example's, else numbered *bliss-xp 2*; `POST /api/scenes`; every listed file fetched from the example and uploaded to the
  same path through the studio's own upload path, `upSend`, straight into R2 where it can, its pictures too; then its
  `layout.json` saved through the layout endpoint; the progress on the pane, a file the relay refuses said and the rest
  copied; then the copy opened from the relay, with editing on away from a circle). At a shared room's circle the scene is the room's and the folder this device's, so the example's button opens it from the
  relay for everyone at the circle (`exAt`): the relay's copy, else copied there first under its name and then opened
  (`openScene(name, 'pick')`, which the shell publishes as the station's state; editing left as it was); Copy pressed there
  opens its copy for everyone at that circle, if this device is still at it when the copy is done and every file came
  through. The relay's copy is a whole one only (a copy under way or broken off
  opened for everyone would empty the circle's scene): a scene of the example's name with its layout (written last) and at least the
  example's files (`exOnRelay`). One that is not whole waits while its listing changes, a copy under way here or on
  another device (*Being copied...*, greyed; `exPart` `'busy'`, its listing seen changing within the last minute,
  `EX.quiet`, by `exSaw` every frame), else (a copy broken off) a press finishes it there: only the files the relay has not
  got, its layout only when it has none (`exCopy(name, into)`, also when `POST /api/scenes` answers 409 because another
  device made it a moment ago); a layout event of the relay's watch has the scenes listed again, so other devices see it
  land. Off a circle, a name taken meanwhile (409) takes the next free one. Greyed only while it is the circle's scene,
  while the circle's story is locked, while it is being copied, or (no whole copy on the relay) while the room has no relay
  that takes uploads, an amber line saying which (`exWhy()`). A device with an example open as it
  comes to a circle goes back to the relay with no scene open, the scene then the room's (`exLeave`: from `collabApply`
  before the room's state applies, from `collabState`, which the shell polls on its own timer, and every frame; once, so a
  slow answer from the relay is never thrown away): what goes out to a circle is never the example's folder's. The relay
  serves `examples/` as an app folder (`APP_DIRS`, deeper than the others: a scene's files are, `APP_DEEP`); `sw.js` treats
  its files as app files, network first (never in `SHELL`). `STUDIO.examples()` for tests (`at`, `why`, `relay`: the
  examples with a whole copy on the relay; `parts`, those whose scene there is not, `'busy'` or `'broken'`). Nothing of it in the layout or the room (no `FORMAT` change).
- **Placement in a headset**: life size, as the design room's table. Outside a room the scene's origin is the rig's
  floor point: where you stood as the session or the studio began, facing your way (anchored with `HOST.anchor` when
  Anchor is on, so an exhibit comes back at the same place in the real room). At a station in a shared room (the owner's
  rule: everything aligned to the room's marks, the circle only the entry, so moving the circle never moves the scene)
  the scene's frame is the room's: room coordinates as
  `shared.js` keeps them (the floor at y = 0, the origin and axes the room's; on a room calibrated on its floor spots,
  spot A on the floor and x towards spot B). The rig stays the station's spot (its panels float there), and `xrPlace`
  hangs the scene from it at the room's origin (`xrRoomBase`: the inverse of the rig times the shell's room matrix,
  `HOST.room.matrix()`, each frame, so the scene holds still while the circle glides), so every item stands at the same
  place in the real room whichever circle shows it and wherever that circle stands, and moving or turning the circle
  (the grip, the map, Move here; Arrange all leaves studio circles alone anyway) moves nothing of it; walking into the
  circle (or *Go in*) still enters the studio there. The VR stick walk still moves the scene for one headset. Pages draw
  the scene in its own frame. A layout made before v125 stood round its circle: **Move the scene to this
  circle** (the Scene pane while editing at a studio station in a room, page and headset alike, with a note that the
  scene now stands on the room's spots and its circle is only the way in; `sceneToCircle`, `circleBlocks` in
  `engine/e6d_shapes.js`) takes every item's placed pose through this circle's spot (`x' = spot + turn(yaw) x`, the
  station's record's `x`, `z` and `yaw`): the objects', shapes' and empties' places and turns, the cubes' places and yaws,
  the sounds' places (one following something keeps its offset `o`; its own `p` is where it stands when what it follows
  is not there) and a sound's own recorded path (its keys are in the scene's axes, so turned with it: `pathTurned`);
  nothing in an item's own frame (cut-outs, offsets, the other items' paths, motions, behaviours; a motion about the
  scene's x or z axis keeps that axis, so turns by other than quarter turns change its direction in the room). One change
  (one Undo step), every record written, shared and saved; refused while the scene is locked (*Lock this story*: editing
  is off then, so it is not offered) or while an item is locked in place (*Refused: Box is locked in place...*, naming
  each, as a group's move does). The grip on nothing moves only the panel. In VR a dark floor with a faint 1 m grid and a
  soft sky (`stage`, round the scene's origin: at a station the room's); in passthrough none of it. Untested on a
  headset: how a scene on the room's frame feels at a circle across the room, and that a real room's frame lines it up.
- **Shared rooms**: "The studio in a room" under "Shared rooms"; `state()` in "What each story shares". Items from the
  room glide there in 0.25 s unless carried here (the carry wins until let go); one effect, `beh`, a behaviour's driver's
  samples ("Behaviours" above); `view()` null; `place` and
  `panel` as the design room's (only the panel moves). Its station's icon is its own miniature, `studio.stage`
  (skipped by `tools/design/build.mjs`: not a prop).
- **Trackers**: props that follow one of the PC's Vive trackers and a Mixamo character worn with trackers, its
  lining up and its takes: "Props on trackers and a character worn with them" below, and "Vive trackers" in `docs/agents/shared-rooms.md`
  and its area notes for the bridge, the relay and the shell.
- For tests and the console: `HOST.cur.peek('STUDIO.state()')` (where things stand: the source, scenes, the scene, its
  items, editing, the selection, unsaved changes, Saved).
- **The Bliss XP room (example scene)** (`tools/studio/xp/README.md`, `COMPONENTS.md`). `examples/bliss-xp/`: the music video "Bliss (Windows XP)" by anabology taken apart and built again
  as a room, every part our own (no frames, people, logos, the real system's sounds or lyrics; Clippy in the assistant's
  part, our own paperclip): 58 models (the boot and welcome screens with our emblem, the windows as Luna slabs with their
  buttons in relief, the taskbar's pieces and the Start menu, the icons, the Recycle Bin, balloons that pop in, the giant
  arrow cursor, the hand, the hourglass, the door that opens onto the hill, the solitaire win bouncing out of the wall,
  Media Player's 3D bars, the drag trail, the clear CRT, the flip phone, the duck, grass that sways, clouds, titles in
  3D, Clippy with his clips Chill, Blink, Wave and Dance on his deckchair; for VR our painted hill and sky and the
  starfield, for AR a painted wallpaper) as 65 objects, 14 synthesised sounds as 17 emitters at their objects, 11
  trigger cubes as a walk through the video (the entry, the grass and the error corner for everyone at the circle), 8
  groups; 67,346 triangles as placed in VR (50,254 in AR), at most 118 draws, 5.3 MB. In VR it stands as placed in a
  room of 5 x 5 m round the scene's origin; in AR it maps onto each headset's own walls by the `wall` behaviour, in
  clusters: on each wall anchors (`direction`) placed so that in the smallest room (3 x 3 m) they meet their wall where
  they belong, and their neighbours riding on them (the behaviour `item`), so a cluster stays one piece and the room fits
  rooms from about 3 x 3 m to 5 x 5 m (the desktop rides on the taskbar's bar on the front wall); Clippy's chat window
  slides along the walls with you (`wall`, `person`). It also uses `shows: 'ar' | 'vr'` and cubes' `all: true`. The floor
  things and the cubes stand round the scene's origin: start in the middle of the room, facing the wall for the desktop,
  and Recenter there (the boot screen says so; in a shared room put spot A there). What a cube starts is never on
  something an overlapping cube hides, and a sound it starts once is on an object that is always shown, placed where it
  belongs (`o`): an emitter is heard only as much as its object is shown (`layout.mjs`'s `checkLayout`). Made by `node
  tools/studio/xp/make.mjs` (deterministic; a failed build writes nothing; `--check` says whether the folder is current:
  the layout and the sounds byte for byte), never by hand.
  It is interactive: icons open their windows, the start button opens the Start menu, the media player plays our own
  music, balloons burst, Clippy waves and dances, cards and pages can be picked up and crumpled in the bin, all by the studio's
  presses, hovers and sequences ("Things to press" and "What anyone can pick up" in `tools/studio/xp/README.md`; every
  interaction listed per component in `COMPONENTS.md`). The room stays our own drawings and sounds, and is still never edited by hand.
- **Untested on a headset**: the grips, the corner stretch, the VR stick walk, objects on the real floor in AR, the
  emitters through HRTF and streamed sounds on a Quest (`createMediaElementSource` there), the frame rate with the
  397,066-triangle scan, the memory peak while its 8,192 px JPEG is decoded before it is drawn down, how the flat-shaded
  lit scan looks, *Studio here* and standing in the studio's circle, the visitor kiosk in a headset, *Convert on a
  laptop* and the folded *Originals* on the headset panel, the Relay password row reached from a studio 401, a group
  carried and sized by real grips, a model inside out seen from within on a Quest, *Fewer triangles* and *Change texture*
  in a headset (how a lighter scan looks life size, the pause while a big scan is made lighter there, a GLB written
  there: its textures encoded and uploaded from a Quest, its memory), the Upload pane's pictures on a real GPU, the Add
  pane's grid and the Items pane's cards on the headset panel (how the cards, pictures and tiles read, paging by Up and More,
  *Shows* and *Hides* pressed by a real ray) and a picture drawn in a
  headset session (inside its frame callback: a GLB a headset's Save writes), shapes
  that hide things in AR against the real room and with the shell's real-world occlusion, an empty's cross, a lock
  refused by real grips (the buzz), the other circles hidden at a studio's circle and the lobby hook as a headset walks
  into the lobby, and how the `studio.stage` icon reads across a room. The pretend headset in `tools/collab.mjs` works the triggers out in the
  page with the renderer told it presents for that moment, so the real per-frame headset path is untested on a device.
  Unheard: the converted mono sounds and `first_room.mp3`. Untested anywhere but headless Chromium: a real folder
  dragged from a desktop file manager (only a synthetic drop and *Choose files*), Safari, iPhone and Firefox
  (`OfflineAudioContext` rates, `webkitdirectory`), uploads from GitHub Pages to a relay elsewhere, a streamed sound on
  a renewed context or reaching its end without a loop, and a plain `.gltf` with an external `.bin` (no test file).

## Live sound (v162)

A sound whose `file` is `'@live'` (`LIVE_FILE`, *Live sound (from the output page)* first in Add's sound list; on its
card *Live sound: on / off*) plays the room's live sound (the output page's stream, `docs/agents/shared-rooms.md` "Live
sound") from where it stands: the shown live item nearest the listener (a handover only when another is 0.5 m nearer)
claims the shell's node (`HOST.collab.liveClaim('studio')`) into its own gain (`vol`, its fades) and an HRTF panner as
`emitStart`'s (`liveEmit`, `e6_items.js`); none shown, the scene not on show, away, another context or `dispose`: let go,
and the stream plays everywhere at the shell's level. Never fetched or decoded (`it.F` null; `norm` drops `sync`, `skip`,
`len` for it). Turning it off asks for a file (the one it had, kept in memory only, or one picked from the scene's sounds).
`STUDIO.live()` for tests; smoke `--only 'studio live'`. `tools/studio/SPEC.md` "Live sound".

## Props on trackers and a character worn with them

- **The trackers here** (`engine/e6k_trk.js`, `trkStep`, first in `behaveStep` each frame): the shell's
  `HOST.collab.trackers()` (`{ id, name, p, q, ok, k }` in room coordinates; guarded: an older shell gives none), only at a
  studio station, where the scene's frame is the room's (a tracker's room pose is the scene's, nothing turned).
  Each one's last pose is kept per station (`TRK.last`): a tracker not seen holds it; another station starts with none.
- **Props** (phase 1): an object's, a shape's or an empty's record may carry `trk` `{ id, o, q }` (its tracker's serial;
  the item's pose in the tracker's frame, to the mm, turned but not scaled, 4 decimals). Drawn by the pose pipeline's base
  stage (`POSE.base` = `poseBase`: a tracker first, else a behaviour's, `behaveBase`; set only while the scene has
  either), so a path and a motion draw over it and the record never changes; never seen here: where it is placed; it
  rests at its placed pose while held here or paused. The card's *Follows a tracker* (page and headset, editing on):
  *None*, the tracker (a list by the room's names, else serials), *Snap onto it*; choosing keeps it where it stands, None
  leaves it where the tracker had it; one Undo step each, refused while locked in place. A sound may follow it. A copy
  follows no tracker; a GLB switch turns the offset by the baked turn (`switchedRec`).
- **A character worn with trackers** (phase 3; `engine/e6l_puppet.js` with `ik.js`, at the repository's root): an object rigged with
  Mixamo's bone names (`IK.rigOf`; others told why on the card) may carry `puppet` `{ on, rig: 'full' | 'feet', by, map,
  cal, s, floor }` (`'head'`, a headset alone, waits). *Wear it: whole body* (6 to 11 trackers) or *feet and headset* (a
  tracker on each foot; the head and hands from the PC's Index, `by` `'index'`, its kinds `'h'`, `'l'`, `'r'` in the
  stream, or from the performer's own headset, `by` their member id: this device's own head and controllers when it is the
  performer, else `HOST.collab.body(by)`, guarded). *Line up with the performer*: a 5 s countdown (this device's own), the
  performer in a T-pose in front of it facing its way; the parts assigned (`IK.assign`), the character moved along the
  floor so its parts at rest are, on average, where their trackers are, sized (`IK.calibrate`, then again at the scale the
  record keeps), one change, one Undo step; *Line up again, these parts*; refused while locked in place; why not in words.
  On and lined up: its own clip off and its bones solved every frame (`IK.solve`, in `itemsStep` in place of `animStep`:
  `pupStep`), alike on every device from the same trackers and record (nothing per bone sent); not solvable now: at rest,
  the card says why; Pause holds it; its holder stays where it is placed (a ghost there while editing); a sound may follow
  its head bone. *Its parts* (another tracker for a part, swapping; then lined up again), *Head and hands from*, *On* /
  *Off*, *Stop wearing*. A copy is worn by nobody; a GLB switch keeps it.
- **Takes**: *Record a take* (on and lined up): a 3 s countdown, the solved bones sampled 30 times a second on the room's
  clock (`pupClock`) until *Stop* or 120 s, made a clip *Take n* (`IK.clipOf`, bound by the bones' names of the model the
  converter reads: `takeInto`) and the object's GLB made again with its clips and the new one through the converter
  (`convertFile` with `take`: with a relay that takes uploads into `models/`, the old one kept under `originals/` when it
  was there already, else every object of the file switched to the new one, a new picture; else downloaded). It plays as
  any clip.
- For tests: `STUDIO.trk(id)`, `STUDIO.puppet(id)`; `pupClock` (a function the tests replace).
- Untested on devices: everything with real trackers, SteamVR and the Index, a Quest's head and hands through
  `HOST.collab.body` (the turns of its hands), how a character looks worn, how a performer's trackers stay on, the lining
  up's placement in practice (a few cm where the trackers' own offsets do not average out, which turns with the
  performer), takes made through a real relay.

## Nice to have, later: glTF round trips (Blender, Unity)

Discussed with the owner on 16 November 2026 and parked as nice to have ("note all of this down as nice to have for
later"). Nothing of it is built.

**Why glTF.** No finished open standard covers a studio scene: models placed in a room, trigger cubes, sounds,
sequences, press and hover. The glTF family comes closest and is heading that way:

- Placement: glTF 2.0 nodes (ISO).
- Motions and timelines: animations and `KHR_animation_pointer` (ratified).
- Shows and hides: `KHR_node_visibility`.
- Press and hover: `KHR_node_selectability` and `KHR_node_hoverability` (both review drafts, Nov 2026).
- Sounds: `KHR_audio_emitter` (a draft, from OMI's `OMI_audio_emitter`).
- Cubes, sequences and behaviours: `KHR_interactivity` (behaviour graphs; submitted for ratification July 2026;
  Babylon.js and Needle support it, three.js r128 does not).
- Trigger volumes: OMI's `OMI_physics_shape` and `OMI_physics_body`.

MPEG-I Scene Description (ISO/IEC 23090-14, glTF plus `MPEG_*`) has triggers, media and anchors, but almost no
tooling. OpenUSD is too heavy for three.js r128. X3D is close in ideas (ProximitySensor, TouchSensor, Sound,
TimeSensor) but old.

**Decided.**

- `layout.json` stays the studio's own format and is not renamed. Its `p`, `q` and `s` already are a glTF node's
  translation, rotation (same quaternion order) and scale, in metres with Y up, and models are GLB already.
- Renaming fields would touch every engine part, the test scene, the XP generator, the relay and the shared format,
  and would need a reader for old files, for no gain the owner would see. So no existing layout file is rewritten.
- The mapping lives in the export and import code.
- When a part of the format is touched anyway, new fields follow glTF's shapes where they fit (an emitter like
  `KHR_audio_emitter`, visibility like `KHR_node_visibility`), so the mapping stays mechanical.
- The runtime is not moved onto `KHR_interactivity`: it is a general graph language, far wider than cubes, sequences
  and press.

**The pieces, rough cost in tokens.**

1. **Export a scene as one GLB** (about 0.4–0.6M). *Download as GLB*: every object, shape and empty becomes a node with
   its model inside, using three.js r128's `GLTFExporter`, already in `stories/studio.js`.
   - Each node carries its studio record (id and fields) in glTF `extras`, which Blender keeps as custom properties.
   - Sounds and cubes become empty nodes with their records; sounds are also written as `KHR_audio_emitter`.
2. **Import a GLB back** (about 0.6–1M). Nodes are matched to items by the id in `extras`:
   - moved, turned or scaled items update;
   - deleted ones go;
   - nodes new in Blender become objects, their meshes saved as GLB files in `models/`;
   - a summary is shown before saving.

   Start with transforms, additions and deletions. Meshes edited in Blender (an object saved as a new model file) come
   second.
3. **Unity through UnityGLTF** (about 0.2–0.4M on top of 2). Export the Unity scene with UnityGLTF and import it with
   piece 2, plus reading its `KHR_audio_emitter` sounds and its animations.
   - Unity's trigger colliders and scripts have no standard form in its export, so cubes and sequences are set up in
     the studio afterwards.
   - The owner ported a Unity scene by hand before v149: `tools/studio/push.mjs` uploads a scene folder an importer
     made.

All three come to about 1.2–2M tokens, built the usual way: Opus builds, Sonnet reviews, at most one fix round.

## From CLAUDE.md

These notes were in `CLAUDE.md` (Notes for Claude Code); they are kept here word for word, beside the area they belong to.

- `stories/studio.js` (the studio, v111, the second page in `STORY_EXTRA`: the owner's own models, trigger cubes and
  sounds, see "The studio" above and `tools/studio/SPEC.md`) likewise from `tools/studio/`
  (`node tools/studio/build.mjs`; its engine adapted from the design room's, with every story's shared-room,
  headset-setting, subtitle, panels, recenter, framing and sound-effect lines; three.js r128's own loaders and exporter
  and meshoptimizer's simplifier (1.3.0, MIT) pasted in from `tools/studio/vendor/`, never edited; its icon `studio.stage` in `tools/lowpoly/`). Its scenes come
  from the relay (`--scenes <folder>`; `relay/scenes.mjs` holds the listing rules, shared with
  `tools/studio/scan.mjs`), which also saves layouts and takes uploads (`/upload`, `ffmpeg` for long sounds): after
  touching those, run `node relay/test.mjs` and `node tools/collab.mjs --studio`. Its test scene is generated
  (`node tools/studio/test/make.mjs`, then `node tools/studio/scan.mjs tools/studio/test/scenes --check`).
  `examples/bliss-xp` (the Bliss XP room, the studio's first example scene) is generated by
  `node tools/studio/xp/make.mjs` (`--check` says whether it is current): never edit it by hand, and keep it our own (no
  frames, people, logos, the real system's sounds or lyrics: `tools/studio/xp/README.md`, "The rules"). **The
  owner's own model, texture, sound and layout files never go into the repository** (not even as test files: they stay
  in the relay's scenes folder outside it, or in the git-ignored `tools/studio/test/local/`). How a scene, its grips,
  the stick walk, the AR floor and the emitters (through HRTF, streamed ones too) look, feel and sound on a headset is
  untested until tried there: report it so.

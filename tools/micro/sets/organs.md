# `organs`: small 3D models of the 29 organs (file `sets/organs.js`, `ORGAN3D`)

The story's organs as small lit 3D models instead of flat line icons: one for each organ of `MICRO_DATA.organs`
(adipose, adrenal gland, artery, bladder, brain, breast, cervix, colon, oesophagus, fallopian tube, heart, kidney,
liver, lung, minor salivary gland, muscle, nerve, ovary, pancreas, pituitary, prostate, skin, small intestine, spleen,
stomach, testis, thyroid, uterus, vagina). They replace the PET story's icons (`tools/pet/sets/icons.js`, which the PET
story keeps); `MICRO_DATA.organs[i].icon` and the data block's `PET_DATA` shim are no longer read.

## How they are built

- Each organ is a signed distance field of a few primitives (spheres, ellipsoids turned in place, round cones, tubes
  through Catmull-Rom points, rounded boxes) blended softly (`smin`), with cuts (open ends, a lumen, the kidney's hilum),
  a small displacement for texture (the brain's gyri, the pancreas's lobules, the oesophagus's rings, the colon's
  haustra) and colours per part (blended near the seams) or painted (the skin's layers, the artery's cut wall).
  Natural colours, a little brightened for the dark scene.
- Polygonised by surface nets: a coarse 16-cell pass finds the organ's box and the far cells (their fine points take
  the sign without evaluating), then a grid of 24 cells along the longest side (28 for the brain); each vertex is
  pulled onto the surface, its normal from the field's gradient (four samples), darkened in creases (one look outwards).
  Centred and scaled to a unit sphere. About 900 to 3,600 triangles each, 46,000 in all; about 430,000 field
  evaluations for all 29.
- Built between frames, one organ after another, its model and then its picture (so pictures come one by one from the
  start, not all at the end): `step(ms)` runs the queue as resumable jobs (a slice of the grid, or 300 triangles of a
  picture, at a time) for at most `ms` milliseconds. In the story the engine steps it every frame from the first
  (`ORGAN3D.driven`; 3 ms a frame in a headset, elsewhere a quarter of the frame's time, 4 to 8 ms, a little more
  where frames are slow anyway); the sets then leave it alone (in the harness they step it themselves: the network set
  3 ms a frame while hidden, 4 while shown, the atlas set 3 while its models are missing). `want(id)` puts an organ at
  the front: the engine wants the stomach first (the first model the story shows), and a pane or the body wants the
  organ it shows. `geo(id)` builds one at once if needed; the harness and the sweeps build all at once (`finish`). All
  29 models take 0.4 to 0.6 s of CPU in Node unloaded (1.1 to 2 s on a machine with a load average of 16; several
  times longer on a Quest, about 15 s at 3 ms a frame), plus the pictures. In headless Chromium under
  that load, with frames of about 3 s, `#micro&explore&organ=Ovary` showed the ovary's picture (chip and heading) on
  the second build step and the other 28 one by one, without errors.
- Pictures: `canvas(id, px)` draws a model once onto a 2D canvas, lit the same way, with a painter's algorithm (flat
  triangles sorted far to near, each filled and stroked against seams), at twice the size and scaled down. No WebGL, so
  no render target and nothing to do with a headset session. The panes ask with `pic(id)` and `picUrl(id)`, which
  never draw: they give the 64 px picture once the queue has drawn it, else null (or '') and want the organ next.

## Exports (`ORGAN3D`)

| Name | What |
| --- | --- |
| `ids` | the 29 model ids |
| `idOf(name)` | the model for an organ of `MICRO_DATA.organs` (or a GTEx organ name), else null |
| `geo(id)` | `{ pos, nrm, col, idx, view }` (built now if not yet) |
| `has(id)`, `ready()`, `built()` | built yet? all built? how many |
| `mesh(id)` | the model if built, else null (and it is wanted next) |
| `want(id)` | build this organ (model and picture) next |
| `step(ms)` | build ahead for at most ms milliseconds; true once models and pictures are done |
| `version()` | goes up as each model and picture is done (the panes redraw on it) |
| `driven` | set by the engine: it steps the queue itself every frame (the sets then do not) |
| `merged(ids)` | one geometry of several models (duplicates allowed): `{ pos, nrm, col, slot, idx, tris }`; `aSlot` is the index in the list |
| `shader(n)` | GLSL for a lit material over a merged geometry: `uP[n]` place and size, `uQ[n]` alpha, glow, turn about y, and how far the model takes the colour `uTint` |
| `canvas(id, px)`, `url(id, px)` | the picture, as a canvas or a data URL (cached; drawn now if need be) |
| `pic(id)`, `picUrl(id)` | the 64 px picture (canvas, data URL) if the queue has drawn it, else null or '' (never draws) |

## Where they show

- The network set's organ ring (`hier`): each organ node is its model (radius 0.062 + 0.005 √degree), turning slowly,
  in a glow of the level's dark green; spheres until the models are ready (in the story, long before the network shows).
- The atlas's plates: each section's organ floats at its plate's top left corner (hidden as the tiles fly to the cloud
  and beside a plot); the focused section's is larger (at most 0.075).
- The body (the engine's `makeDots`): the picked organ's model grows out in front of the body beside its point (the
  intro's dive into the stomach; explore's organ picks). Only that model is drawn: its geometry is swapped in when the
  pick changes (as soon as the model is built; one that comes late grows from then).
- The panes: the Organs tab's chips and its heading (HTML pictures at 22 px, canvas pictures in the headset's panels).
  Until an organ's picture is drawn its HTML chip keeps the place with a soft dot and its canvas chip a small dot; each
  picture goes into the chips waiting for it as it comes (`fillOrganPics`, nothing drawn again all at once), and the
  headset's panels redraw on `GL.orgV` (the queue's version, at most twice a second while it runs).

## Harness

`harness.html?set=organs` shows all 29 in a grid (`organs_spin:1` turns them, `organs_tint:1` takes the level colour,
`organs_pics:1` lays the pictures over the page on a light and a dark ground). `SETS.organs` is only the harness's
gallery: the story builds it into `stories/micro.js` but never makes it.

## For the narrator

The models are drawn, schematic and not to scale with each other; they say which organ, not what it looks like
inside. Do not describe them as anatomy (the colon's haustra or the brain's gyri are suggestions).

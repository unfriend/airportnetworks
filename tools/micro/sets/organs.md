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
- Built between frames: `step(ms)` runs the builds as resumable jobs (a slice of the grid at a time) for at most `ms`
  milliseconds; the network set calls it while hidden (`idle`, 3 ms a frame) and while shown (4 ms), the atlas set while
  its models are missing. `geo(id)` builds one at once if needed; the harness and the sweeps build all at once
  (`finish`). In headless Chromium under load all 29 take 1 to 2 s of CPU in all (0.4 to 0.6 s in Node unloaded).
- Pictures: `canvas(id, px)` draws a model once onto a 2D canvas, lit the same way, with a painter's algorithm (flat
  triangles sorted far to near, each filled and stroked against seams), at twice the size and scaled down. No WebGL, so
  no render target and nothing to do with a headset session. `step` draws the 64 px pictures after the models, as
  resumable jobs too (300 triangles at a time), so a frame's slice stays short on a headset.

## Exports (`ORGAN3D`)

| Name | What |
| --- | --- |
| `ids` | the 29 model ids |
| `idOf(name)` | the model for an organ of `MICRO_DATA.organs` (or a GTEx organ name), else null |
| `geo(id)` | `{ pos, nrm, col, idx, view }` (built now if not yet) |
| `has(id)`, `ready()`, `built()` | built yet? all built? how many |
| `step(ms)` | build ahead for at most ms milliseconds; true once models and pictures are done |
| `merged(ids)` | one geometry of several models (duplicates allowed): `{ pos, nrm, col, slot, idx, tris }`; `aSlot` is the index in the list |
| `shader(n)` | GLSL for a lit material over a merged geometry: `uP[n]` place and size, `uQ[n]` alpha, glow, turn about y, and how far the model takes the colour `uTint` |
| `canvas(id, px)`, `url(id, px)` | the picture, as a canvas or a data URL (cached) |

## Where they show

- The network set's organ ring (`hier`): each organ node is its model (radius 0.062 + 0.005 √degree), turning slowly,
  in a glow of the level's dark green; spheres until the models are ready.
- The atlas's plates: each section's organ floats at its plate's top left corner (hidden as the tiles fly to the cloud
  and beside a plot); the focused section's is larger (at most 0.075).
- The body (the engine's `makeDots`): the picked organ's model grows out in front of the body beside its point (the
  intro's dive into the stomach; explore's organ picks).
- The panes: the Organs tab's chips and its heading (HTML pictures at 22 px, canvas pictures in the headset's panels).
  Until an organ's model is built its chip has no picture; the panes are drawn again once all are.

## Harness

`harness.html?set=organs` shows all 29 in a grid (`organs_spin:1` turns them, `organs_tint:1` takes the level colour,
`organs_pics:1` lays the pictures over the page on a light and a dark ground). `SETS.organs` is only the harness's
gallery: the story builds it into `stories/micro.js` but never makes it.

## For the narrator

The models are drawn, schematic and not to scale with each other; they say which organ, not what it looks like
inside. Do not describe them as anatomy (the colon's haustra or the brain's gyri are suggestions).

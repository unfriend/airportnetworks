# `slide`: the tissue on its glass slide (file `sets/slide.js`)

Chapters 1, 2, 7 and 8 of the topo story. Two pieces of real tissue, drawn in H&E from the cells alone (`TDATA.tile` and
`TDATA.slide`: positions and the cell classifier's types, nothing else): the healthy **tile** of 640 µm round the
poster's patch (945 cells) and the new slide's **window** of 1.5 mm (6,716 cells). Each lies flat (x-z, y up), 1.6
across, centred on the origin, on a glass slide whose +x end shows just past it (its frosted label far off to the left).

How the H&E is drawn (drawing, not science): every cell is a splat by its type (`TLOOK`'s cells: Epithelial as
hepatocytes, polygons pressed together whose size follows how densely the cells round them sit, with a round nucleus
and its nucleolus; Cancer cell larger and darker; Fibroblasts, Muscle and Endothelial cells as spindles lying along
their spindle neighbours; Lymphocytes and Plasmocytes small and dark; Neutrophils and Eosinophils lobed; Apoptotic
Body shrunken and deep pink; Red blood cells red discs; Macrophages plain), its stain varying gently across the slide
and a little from cell to cell. Under them a ground drawn in its shader from three stain fields made at load from
where the cells are: the hepatocytes' cytoplasm (pink plates), collagen where spindle cells gather (paler, with fibres
along the spindles once close) and a haze of nuclei where lymphocytes and the like gather; white where there are no
cells (the central vein), thin wandering sinusoids between hepatocytes when close, lit as a gentle relief. Far away a
pre-averaged copy of the cells stands in for the splats (as the tour's tissue set). Nothing about the cells is
invented: where they are and what type they are is the data's.

The **modalities** (chapter 1) are sketches, labelled so: spatial transcriptomics as spots (hexagonal, 50 µm apart,
28 µm across, coloured by the mix of the types under each), spatial proteomics as the same cells glowing in their
type's colour on black (their nuclei in a DNA stain's blue); each sweeps in from the left. Then every cell becomes a
white-gold bead: only positions count. **Chapter 2's fixed scales** are drawing on the tile: a grid of 100 µm squares
with one lit, a cell joined to its six nearest, a circle of 30 µm round another cell; then the poster's patch (its
214 µm square, 110 cells) marked in amber, the hand-off to the tower. The **overview** of the new slide (`overview`:
its 97 x 58 bins of 232 µm, purple where dense, pale streaky pink where the scars are, both pieces of the section)
lies on a full glass slide with the window marked, and zooms into the window by scaling itself about it (by about 20),
so the camera need not move; the window's own cells take over as it arrives.

The `map` set shares this frame (the window centred on the origin while it lies alone; side by side it moves with
it). This set reads `S.map_all` and `S.map_a`: where the map's sweeping dome has passed, the window dims to a ghost so
the relief reads (its ground and its cells alike, row by row in the dome's order).

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `slide_a` | 1 | fade | in at 13-16 (as the body set's slice falls flat), out at 60-62; in at 252-254, out at 336-340 (or keep it under the map to the end) |
| `slide_show` | 0 | what lies on the glass: 0 the healthy tile, 1 the new slide's window, 2 both side by side at one scale (the window at x 0.42, the tile at x -1.13 at 0.43 of its size, its true size against the window). In between: 0 to 1 a crossfade in place, 1 to 2 the tile slides in. A plain param; it may be stepped (integers are its states) | 0 in chapters 1 and 2; 1 in chapters 7 and 8 (set while `slide_a` is 0); 2 only in explore |
| `slide_mode` | 0 | the modality: 0 H&E, 1 spatial transcriptomics (sketch: the spots), 2 spatial proteomics (sketch: cells glowing by type on black); in between, the sweep's front running left to right (from 0 to 1 the spots come over the H&E, dimmed under them; from 1 to 2 the dark comes with the glowing cells and the spots go). A plain param; it may be stepped | 0 -> 1 at 21-23.5, 1 -> 2 at 25.5-28 (chapter 1). Back to 0 only while `slide_points` is 1 (unseen: at 33.5), never eased from 2 to 0 (it would sweep back through the spots) |
| `slide_points` | 0 | every cell becomes a glowing white-gold bead (`TLOOK` cells' bead morph), the ground dark glass with the tissue's ghost, the spots gone | 0 -> 1 at 29.5-31.5; 1 -> 0 at 35-37 (back to H&E for the scales) |
| `slide_scale` | 0 | chapter 2's fixed scales on the tile: 1 the grid of 100 µm squares with one lit ("one patch size"), 2 a cell and its six nearest joined ("a neighbour count"), 3 a 30 µm circle round a cell, the cells in it lit ("one radius"); between two of them a crossfade. Plain; may be stepped | 0 -> 1 at 38-40 (cam `square`), -> 2 at 45-47 (cam `hub`), -> 3 at 51-53 (cam `circle`), -> 0 at 56-57.5 |
| `slide_patch` | 0 | the poster's patch marked on the tile: its square in amber with glowing corners | 0 -> 1 at 57-59 (cam `patch`) |
| `slide_over` | 0 | the new slide's overview: 1 the whole section on its glass slide, the window marked (a cyan square); towards 0 it zooms into the window (the zoom's scale on a log scale, the window gliding to the middle); the window's own cells fade in from 0.3 to 0.08, the overview goes by 0.02 | 1 at 252 (set while `slide_a` is 0; cam `over`), 1 -> 0 at 256-262 (the camera may stay at `over`: `window` is the same view) |

The resting look (defaults): the healthy tile in H&E on its glass.

## Anchors

`tile` (the tile's far left corner, for its tag), `window` (the window's far left corner), `centre` (0, 0, 0), `patch`
(the poster's patch square's far right corner), `square` (the lit grid square's far right corner), `hub` (the cell with
six links), `circle` (the circle's rim), `spots`, `fluo`, `points` (spots on the tile's right, for the modalities'
tags), `section` (the overview's far left corner, as it is now), `mark` (the marked window's far right corner, as it is
now), `label` (the overview slide's frosted label). Anchors on the tile follow the layout (functions).

## Labels

- `Healthy liver · 640 µm across, 945 cells` (at `tile`; from `TOPO_DATA.tile`): the tile in H&E, no scale, no patch;
- `Spatial transcriptomics · sketch: spots read the genes` (cyan, at `spots`): with mode 1, not as points;
- `Spatial proteomics · sketch: proteins in colour` (magenta, at `fluo`): with mode 2, not as points;
- `Only positions · every cell a point` (amber, at `points`): as points, not with a scale or the patch;
- `One patch size`, `A neighbour count`, `One radius` (cyan, at `square`, `hub`, `circle`): each near its scale;
- `The patch · 110 cells` (amber, at `patch`; `TDATA.patch.n`): with `slide_patch`;
- `A new slide · 398,611 cells` (at `section`; `overview.cells`) and `A window · 1.5 mm, 6,716 cells` (cyan, at
  `mark`): with the overview, from 0.75;
- `The new slide · a window of 6,716 cells` (at `window`): the window alone, not with the overview or the map's cell,
  sweep or split.

## Cam views `[az, el, dist, tx, ty, tz]`

| View | Value | For |
| --- | --- | --- |
| `default`, `tile`, `window` | [0, 56, 3.4, 0, 0, 0.06], [8, 58, 3.3, 0, 0, 0.06], [0, 56, 3.4, 0, 0, 0.06] | the whole tile or window from above and in front |
| `low` | [14, 26, 3.0, 0, 0, 0.12] | low across the tissue (its relief) |
| `close` | [16, 50, 1.1, 0.05, 0, 0.1] | the cells close (chapter 1, after the tile is seen whole) |
| `cells` | [22, 46, 0.45, 0.12, 0, 0.18] | very close: every cell's shape |
| `square`, `hub`, `circle` | [10, 56, 1.4, -0.375, 0, 0.395], [14, 50, 0.9, 0.499, 0, -0.381], [-10, 52, 0.9, -0.472, 0, 0.478] | chapter 2's three scales (computed from the cells chosen at build) |
| `patch` | [0, 62, 2.1, 0, 0, 0.02] | the poster's patch on the tile (it is the tile's middle) |
| `over` | [0, 58, 3.4, 0, 0, 0.05] | the overview on its glass; the zoom into the window happens under it |
| `both` | [0, 54, 4.0, -0.13, 0, 0.08] | the two side by side |

In a headset the tile and the window lie flat like a table top 1.6 units across; nothing here comes up off the glass
except the chapter 2 marks (a few millimetres).

## Explore

Controls: Tissue (Healthy tile / New slide / Both / Whole slide: `slide_show` 0, 1, 2, or 1 with `slide_over` 1), Look
(H&E / Spots (sketch) / Proteins (sketch) / Points), One scale (None / Patch / Neighbours / Radius: on the tile only).
`explore(c)` returns every `slide_` param (no patch mark).

`api()`: `TW` (1.6), `layout(s)` (the pieces' places for a `slide_show` value: `{ ta, wa, tx, ts, wx }`, as the map
set repeats it), `tile`, `win` (each piece's drawing data: `X`, `Z` in the piece's frame, `RAD`, `KIND`, `ANG`, ...),
`overview` (`{ side, w, h, bin, cells }`), `pos(piece, i, out)` (a cell's place in the set's frame as laid out now:
`piece` 'tile' or 'window'), `hub`, `six`, `circle` (the cells chapter 2 uses, tile indices).

## Sizes for framing

The tile and the window: 1.6 x 1.6 centred on the origin at y 0 (the cells 0.0008 above it); the tile's patch square
0.535 across at its middle. Their glass slide: 6.0 x 2.4, top face at y -0.0015, its +x end at x 1.25 (1.67 side by
side), its label from x -4.75 to -3.19. The overview: its glass 2.6 x 0.87 on the origin, the section 1.22 x 0.73
centred at x 0.27, the window marked 0.081 across at (0.45, 0, 0.26). Side by side: the tile from x -1.47 to -0.79, the
window from -0.38 to 1.22.

## Performance (headless Chromium, software GL)

Build 100-160 ms (each piece's three stain fields: the cells dropped into a 256 x 256 grid and blurred with running box
sums; its pre-averaged cells at 256 x 256; the direction field of its fibres; its spots; the window's dome order).
Draw calls 3 to 6 (a piece's ground, H&E cells, glowing cells and spots, each only while seen; the glass; the
overview; the chapter 2 marks). Triangles: 2.1k (the tile) to 14k (the window), 15.5k side by side. The cells are
filled again only when `slide_mode` or the map's sweep moves by 0.01 (at most 6,716 cells, a few ms); the layout, fades,
the zoom and the beads are uniforms and transforms. Nothing else is allocated per frame.

## For the narrator

- The tissue is drawn from the cells the authors' cell classifier (HistoPLUS) found in GTEx slides: their positions and
  types are real; the stain, shapes and sizes are drawing. The types are the classifier's labels, not histology
  ("Cancer cell" and "Apoptotic Body" are its words for what it saw).
- The spots and the glowing cells are sketches of other modalities (no such data here): say so.
- Slides are numbered, never named: the tile is from a healthy slide of the cohort, the window from a slide the
  classifier never saw.

# `section`: a drawn H&E section of an ovary (file `sets/section.js`)

Chapters 3 (what's in a section), 4 (two methods) and 7 (a network), and the Section scene in explore. Everything is
drawn: no GTEx image is used.

## What it is

- **Section A** (the story's, about 1.9 x 1.5, in the xy plane facing +z, centred on the origin): a slab 0.03 thick, its
  face a stain made between frames (eosin-pink stroma in whorls, denser and more purple in the cortex under the rim,
  paler in the medulla; spindle-shaped purple nuclei; a flat eosin until made). On it the objects in relief (one lit
  merged mesh, `OVARY_LOOK.objMat`):
  - **blood vessels** (64 at 21): an oval wall, pink-red with flat nuclei, round a pale lumen, some with red cells;
  - **macrophages** (56): small rounded brown cells (iron pigment) with a dark nucleus;
  - **corpora albicantia** (14, a third of them at 20): large pale wavy bodies with folds;
  - **follicles**: 3 antral (a ring of granulosa beads round a pale antrum, the oocyte in its zona on a mound of cells),
    6 secondary (three layers of beads round the oocyte), 10 primary (one layer); a darker theca round each, fading with
    it;
  - **cysts** (2): thin-walled pale cavities (constant with age; nothing on the poster says how they change).
  Counts follow the poster's lines with `section_age` (`OVARY_TREND.level`; follicles gone by about 59).
- **Section B**: an older ovary (drawn at 66; its own shape, longer and more ragged), large scars (24 slots of 0.12 to
  0.27), no follicles left, beside A in the pair. Scale bars as on the poster: 1.58 mm (A) and 791 µm (B), each about an
  eighth of its section's width (the older section is smaller in life).
- **Picked out** (`section_<kind>`): the kind takes the poster's color (vessel gray-blue, macrophage sage green, corpus
  albicans magenta, follicle deep indigo; lifted for the dark scene) with a translucent overlay and a bright rim, as the
  poster's table; the stroma and the other kinds dim. The cyst's color is the story's own (sand: the poster gives none).
- **Method 1** (tile-level classification): about 380 tiles of 0.075 over the tissue (their outlines draw on from the
  upper left); every tile's UNI2 features as a 4 x 4 mosaic of glowing blocks (height and color by value, indigo to teal
  to green to yellow; illustrative numbers, from a prototype per label plus noise), lighting up in a wave from the
  followed tile (a follicle's, upper left; ringed); the random forest as a grove of five decision trees (four questions
  deep) to the right of the section on a dark disc: the features flow from the tile into the trees, each tree lights the
  path its questions take, leaves in their labels' colors; four trees say "follicle", one says "corpus albicans"; the
  verdict flies back and the tile takes its label; then every tile is washed in its predicted label's color (stroma
  tiles stay clear; a few near misses, illustrative).
- **Method 2** (semantic segmentation, SegFormer): a bright line sweeps across and paints a mask on each object (bright
  rim, translucent fill): close for vessels, macrophages and scars (IoU 0.84, 0.95, 0.97), a little off for follicles
  (0.70, the smallest further off), mostly missing for cysts (0.15).
- **The spatial neighbor network** (ILLUSTRATIVE: the poster's next step, not its result): a node over each object (in
  its kind's color, sized by kind; primary follicles left out), links to its nearest few within 0.14 (gap between
  edges), stems down to the objects; a node shows while its object does, a link while both ends do, so with
  `section_age` the network changes (follicles' nodes go, scars' come). It draws outwards from the middle.

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `section_a` | 0..1, 1 | fade |
| `section_age` | 20..70, 30 | section A's age |
| `section_pair` | 0..1, 0 | A shrinks to the left, B comes in on the right (both at 0.58), scale bars and labels |
| `section_vessel`, `section_macrophage`, `section_albicans`, `section_follicle`, `section_cyst` | 0..1, 0 | picked out |
| `section_tiles` | 0..1, 0 | tile outlines draw on |
| `section_feat` | 0..1, 0 | the feature blocks (the section darkens) |
| `section_forest` | 0..1, 0 | the vote: grove in by 0.12, features flow 0.1-0.45, trees answer 0.35-0.85, verdict 0.8-0.95, tile lit at 1 |
| `section_pred` | 0..1, 0 | predictions sweep across (the blocks go) |
| `section_mask` | 0..1, 0 | SegFormer's masks sweep across (0 none, 1 all) |
| `section_net` | 0..1, 0 | the network draws outwards (the section dims a little) |

Suggested keyframes: see SPEC.md, chapters 3, 4 and 7.

## Anchors, labels, cams, controls, API

- Anchors: `vessel`, `macrophage`, `albicans`, `follicle` (the largest antral follicle, shown to about 58), `cyst`
  (representatives shown at least from 25 to 45), `center`, `young`, `old` (the sections' tops), `barYoung`, `barOld`,
  `tiles`, `tile` (the followed tile), `feat`, `forest` (above the grove), `uni` (between the tile and the grove),
  `pred`, `mask` (the sweep line), `net`.
- Labels: Younger ovary, Older ovary, 1.58 mm, 791 µm (with the pair); Tiles; Features "UNI2: numbers per tile"; Random
  forest "trees vote on each tile"; SegFormer "paints a mask" (while sweeping); Spatial neighbor network "illustrative".
- Cam: `default` [0, 8, 3.5], `close` (the largest follicle), `pair`, `tiles`, `feat` (a slant close-up of the blocks),
  `forest` (section and grove), `mask`, `net`.
- Controls: View (Section, Young and old, Tiles, Forest (the vote plays over 8 s, then the predictions), Masks (the
  sweep over 5 s), Network), Age (20 ... 70), Pick out (None, Vessels, Macrophages, Scars, Follicles, Cysts).
- `api()`: `kinds` (keys by index), `pick(raycaster)` (the kind index of the object under a ray, −1 if none), `count(age,
  'A'|'B')` (objects per kind shown), `objects` (A's objects: kind, x, y, r, from, until), `views`, `tiles`, `links`.

## Say, and do not say

- Say: H&E (hematoxylin and eosin) stains nuclei purple and the rest pink; the annotated counts (blood vessel 8,706,
  macrophage 5,540, corpus albicans 421, follicle 274) are the training labels; tiles -> UNI2 features -> random forest
  -> tile prediction; SegFormer -> mask prediction; the scores (`OVARY_DATA.kinds`).
- Do not say: that the section, the tiles' numbers, the forest's paths or the network are the authors' (they are drawn
  to show the method); the network is the poster's next step, illustrative.

Performance: about 114,000 triangles and 6 to 7 draw calls for A (15 with B; up to 12 with the method's parts), 1,376
tile lines; construction about 120 ms, the stains and objects about 0.7 s more between frames.

# The shape of tissue: 3D sets, data and engine spec

The fifteenth story of the app: `stories/topo.js`, built from `tools/topo/` like the mutation story is built from
`tools/mutation/`. It follows the poster **"topocyte: scale-resolved topological phenotyping of tissue architecture
across spatial modalities"** by **Simon Schindler, André Rendeiro and Jörg Menche** (Ludwig Boltzmann Institute for
Network Medicine at the University of Vienna; University of Vienna; CeMM Research Center for Molecular Medicine of the
Austrian Academy of Sciences; Medical University of Vienna; Max Perutz Labs, Vienna BioCenter; all Vienna), shown at
the Evaluation of the LBI for Network Medicine 2026, and the package's documentation (topocyte.lab.lbi-netmed.com).
What it says is summed up below; nothing else from it is needed.

Card (`HOST.list`): key `topo`, kick "Tissue topology", title **The shape of tissue**, colour `#ff5c5c`, desc "Where
cells sit in a slide of liver, read at every scale at once: balls grow round the cells, pieces join and loops open and
close. From 123 slides, a classifier learns which scales tell cirrhosis from healthy tissue, and maps it back onto
every cell.", page "The shape of tissue: topology of cells in the liver", brand "The shape of tissue", sub "Topology of
cells in the liver", aria "Interactive 3D story of how the arrangement of cells in liver tissue is read at every scale
with persistent homology, and how it tells cirrhosis from healthy tissue", thing `tower`, loading "Growing the balls",
len from pacing. Credit (the last chapter's small print, explore's About, the docs): Simon Schindler, André Rendeiro
and Jörg Menche, with their institutes as above; the cells: the GTEx project's liver slides, segmented by the authors
with HistoPLUS (CC BY 4.0).

Decisions (the owner's and the author's, 28 Oct 2026):
- **Every number is topocyte's.** The owner: "use the topocyte code for all calculations where possible, don't write
  your own". All numbers come from `TOPO_DATA` (`sets/data.js`), written by `tools/topo/data/gen_data.py`, which runs
  topocyte and the poster's own figure scripts on the authors' data. **The story computes nothing scientific**: it
  draws what is in `TOPO_DATA`, looks things up (the simplices alive at a radius are those whose stored radius is at
  most it; a Betti number at a radius is the count of stored bars alive there; a window's share is the sum of stored
  fine shares), and places things by stored numbers. Never invent a number; never recompute persistence, an fPCA, a
  classifier or a score in the app.
- **Real data** (the author: "you get the cohort data"): the 123 slides' curves, scores and classifiers; the poster's
  patch (110 real cells of a healthy slide); a healthy tile round it (640 µm); the new slide's 1.5 mm window (6,716 real
  cells) with every cell's own score. Slides are numbered, never named: no GTEx sample or donor id, no donor details,
  never a GTEx image or the poster's pictures. The H&E look is drawn from the cells' positions and types.
- **The local radius is 50 µm** (the author). The poster's split at 100 µm (1,000 and 5,716 cells) appears only in
  small print, "with a radius of 100 µm, as in the poster's figure". The cell v of the poster's panel e is the data's
  `slide.e`; show its own score as the data gives it (the poster prints 26.57, the data 6.97: open with the author, so
  the story says "its score", with the number from the data, never 26.57).
- **"Cancer cell" stays** (the author): the cell types are the cell classifier's labels (HistoPLUS), not histology; say so
  once where the types first show ("the labels of the computer that found the cells").
- **No 2D graphs** (the owner's rule, AGENTS.md "Conventions"): curves stand as lit ribbons in the space, scores are
  slides floating in 3D, the held-out results are stacks of glass slides, a composition is cells sorted into piles (in
  passing). A quick graph in passing is fine.
- **British spelling** (colour, centre, grey, haematoxylin, neighbourhood, tumour), English only.
- Words: "pieces" for connected components (with "components" in small print), "loops" for H1 features (holes), "balls"
  for the growing discs, "radius" r in µm (the alpha filtration's value is t = r²: small print), "the tower of scales"
  for the filtration drawn upwards, "a network with triangles" for a simplicial complex.

**The rules for sets are the tour's**: `tools/lbi/SPEC.md` from the top down to "Palette and look", and
`tools/lbi/kit.js`, with these differences (as the mutation story's, `tools/mutation/SPEC.md`):
- Set files live in `tools/topo/sets/`; the harness is `tools/topo/harness.html` (`?set=<name>&p=k:v,...&t=..&
  cam=<view or six numbers>&anim=1&with=<second set>`) and the screenshot tool `tools/topo/shot.mjs` (run it from
  `tools/topo`; `SHOTS=<dir>` and `PORT=<port>`). The harness loads `TOPO_DATA`, `TLOOK` (and the body set and
  `ORGAN3D` where a set needs them) before the set.
- Shared globals before the sets (the build pastes them inside the story's closure in this order): `TOPO_DATA`
  (`sets/data.js`, generated), `TDATA` (`sets/tdata.js`: the decoders and lookups below, no science), `TLOOK`
  (`sets/look.js`, the story's look, from the mutation story's `MLOOK`), then the tour's `body` set
  (`tools/lbi/sets/body.js`, unchanged) and the microanatomy story's organ models (`tools/micro/sets/organs.js`,
  `ORGAN3D`, unchanged: only the liver is used), then this story's sets.
- **Labels may have `text` as a function** returning `[bold, rest]` (the engine re-reads it while the label shows).
- **Step params** (integers, never eased; list each in the set's manifest so the engine puts it in `STEP`).
- A set may export `api()` for explore (picking, lookups) and `finish()` if it builds in slices.
- Budget per set: build under 300 ms in headless Chromium (software GL; the 6,716 cells may be built in slices), at most
  20 draw calls and 150k triangles at any moment, no allocation per frame in `update` (refill pools). Seeking must
  work: what a set shows depends only on its params and `t`.

## Look

The app's dark, glowing, lit 3D (the tour's light over the left shoulder, rim glow). Colours:
- **H&E** (drawn, never an image): haematoxylin nuclei deep purple `#3b2a7a` to `#5a3fa0`, eosin cytoplasm and stroma
  pink `#e7a3c0` to `#f2c4d6`, collagen of scars a paler, streaky pink `#f5d0dc`, sinusoids and vessels white with a
  faint pink edge; computed as the tour's tissue set does (Beer-Lambert from optical densities: read
  `tools/lbi/sets/tissue.js` for its stain colours and cell splats and adapt them, do not include that set).
- **The two classes**: healthy blue `#4d9de0` (`#7cc0ff` where it must glow), cirrhosis red `#e0504d` (`#ff7a6b`);
  the per-cell map's colours are the poster's (RdBu_r): `slide`'s 11 stops from `#053061` through `#F7F6F6` at 0 to
  `#67001F` (see `TDATA.STOPS`).
- **Topology**: cells as small bright beads (white-gold `#ffe8b0`); balls as soft glass discs or spheres (cyan
  `#46d9ff`, 15 % opacity, a brighter rim where two meet); edges as thin lit tubes (`#9fe8ff`); triangles as glass
  panels (`#46d9ff`, 25 %); pieces (H0) in amber `#ffb43b`; loops (H1) in orange `#ff7a3c` (the poster's), their
  chimneys glowing; the radius plane as a faint sheet with a ruler.
- Cell types (as the poster's legend, brightened): Fibroblasts `#2e9e57`, Apoptotic Body `#d4c34a`, Epithelial
  `#9b59b6`, Lymphocytes `#3f8fd6`, Cancer cell `#7a7a7a` lightened to `#a8a8b8`, other `#d8d8d8`; the rest of the 14
  types fold into "other" except where a pane lists them.
- Labels as the other stories'; the app's cyan `#46d9ff` for highlights.

Frames (y up, the story faces +z, 1 unit about 0.5 m in a headset at the default size): the tissue lies flat (in the
x-z plane, y up) on a glass slide, so the tower rises out of it and you look down into it; or it is tilted towards the
viewer where a set says. `slide` and `map` share one frame; `tower` has its own (the patch centred on the origin, the
tower rising to y ≈ 1.6); `cohort` its own; `body` its own (the liver from `ORGAN3D` near its `liver` anchor).

## The poster, in short (what the story tells)

1. **The problem.** Spatial omics and histology record where cells sit, yet the tools that read tissue architecture fix
   one modality and one scale: a patch size, a neighbour count, a radius. topocyte reads architecture from cell
   positions alone, in any modality (segmented H&E, spatial transcriptomics, spatial proteomics; cells as an AnnData,
   from the scverse tools: LazySlide, Squidpy, SpatialData), over every radius at once. Four calls take a cohort from
   positions to a score per cell (`tc.tl.persistent_homology`, `tc.tl.fpca`, `tc.tl.fpca_classify`,
   `tc.tl.local_backattr`), and every result lands back in the AnnData. The cohort: 123 liver slides (66 healthy, 57
   cirrhosis), 30.8 million cells; persistence and fPCA in 1.9 minutes on a laptop's CPU (Apple M4).
2. **Describe the tissue architecture (persistent homology).** Balls grow round the cells; where they meet, the complex
   gains edges and triangles (the alpha complex: a simplicial complex, the higher-order generalisation of a network).
   Persistent homology records each piece (component, H0) and loop (H1) with the radii at which it appears and
   vanishes: bars in the barcode, points in the persistence diagram, counts per radius in the Betti curves, exact step
   functions over every scale at once. The poster's patch: at r = 4.08 µm 82 pieces; 13.49 µm 3 pieces, a loop born;
   24.59 µm one piece, the loop alive; 48.86 µm one piece, the loop filled.
3. **Compare slides across the cohort (functional PCA).** Each slide's Betti curve, scaled to norm 1 (cosine mode: only
   its shape over scales counts), compared with every other exactly from the bars' ends (no grid); the functional PCA
   finds the main shapes (components φ1, φ2) and gives every slide its scores. The first holds 72 % of the variation in
   loops, the second 20 %. In the scores, healthy and cirrhotic slides separate by eye before any classifier.
4. **Learn the scales that separate conditions (classifier).** A logistic regression on the first four scores, read
   back, is a weight per radius γ(r): where it is positive, more features alive at that radius speak for cirrhosis. The
   share of a window of radii in the classes' log-odds gap names the scales that separate them: for loops, 5 to 10 µm
   add 2.73, 10 to 15 µm 4.65, the other scales take 0.35 away; all together cirrhotic slides score 7.04 log-odds
   higher than healthy ones (odds × 1,138). Tested fairly (five-fold cross-validation, each slide predicted by a model
   that never saw it): 62 of 66 healthy and 47 of 57 cirrhotic slides right, accuracy 0.886.
5. **Map the signal back onto the tissue (local persistent homology).** Restrict the slide's complex to the simplices
   within δ of a cell v: v gets Betti curves of its own and, through the cohort's components and weights, a log-odds of
   its own. Every cell is a centre; the slide's score becomes a map (here the components' model, fitted on the other
   122 slides, scoring a slide it never saw).
6. **Downstream.** The scored cells fall into two groups, cirrhosis-like above zero and healthy-like below; the groups
   then meet whatever the modality measures: cell-type composition on H&E (real), differential genes on spatial
   transcriptomics and protein abundance on spatial proteomics (the poster's sketches of the workflow, schematic).
   Take-home: persistent homology of cell arrangements, then exact functional data analysis, finds disease patterns
   across modalities and attributes them to every cell's neighbourhood, where spatial analysis begins.

## The data: `TOPO_DATA` (`sets/data.js`, generated; never edit)

Written by `python -I tools/topo/data/gen_data.py <cells.h5ad> <fig1 dir>` (see its header). Radii in µm. Typed arrays
are base64 strings; `TDATA` decodes them once. Fields:
- `src`: `mpp` (0.4942 µm per pixel), `healthy` 66, `cirrhosis` 57, `cells` (30,836,186), `components` 4, `folds` 5,
  `ruler` [1.5, 60] (µm: the poster's log ruler of r), `rcode` [0.5, 120] (one-byte radii, below), `runtime`
  `{ minutes: 1.9, seconds: [71, 46], machine }` (the poster's, typed in).
- `labels`: 123 numbers, 0 healthy, 1 cirrhosis (the slides' order everywhere below).
- `h0`, `h1` (the cosine models of pieces and of loops): `fve` (the first six fractions of variance), `scores` (123 ×
  4), `curves` (packed; `TDATA` decodes them in place at load into 123 `Float32Array`s `[u, y, u, y, ...]`: each
  slide's unit Betti curve as the figure scripts' exact envelope at 64 columns, u from 0 to 1 on the log ruler, y over
  the bundle's top), `phi` (the first two components, the same form, over
  their common largest |value|), `means` `{ healthy, cirrhosis }` (the classes' mean unit curves, over their common top),
  `gamma` (γ over its largest |value|; `gammaPeak` that value per µm²), `classes`, `y` (0/1 per slide), `coef` (4
  weights on the scores), `intercept`, `C`, `logOdds` (the final model's log-odds per slide), `held` (each slide's
  held-out prediction, 0/1, from the same five folds as the stored cross-validation), `accuracy`, `confusion` (`[tn, fp,
  fn, tp]`, healthy first), `shares` `{ edges: [0, 0.5, ..., 100, null], delta: [...], gap }` (topocyte's
  `fpca_scale_importance` for windows of 0.5 µm up to 100 µm and one from 100 µm on (null is infinity): a window's share
  is the sum of its fine shares; all of them add up to `gap`).
- `poster`: the poster's own panels as its scripts compute them: `fve`, `windows` (`[r0, r1, delta]`), `gap`,
  `confusion`, `accuracy` (for loops: 0.72, 0.20; 2.73 for 5-10 µm, 4.65 for 10-15 µm; 7.04; 62/4/10/47; 0.886).
- `patch` (the poster's panel b: 110 cells of a healthy slide in a window of `side` µm, y up): `pts` (flat x, y),
  `edges` (flat `[i, j, r]`: every edge of the alpha complex and the radius it appears at), `tris` (flat `[i, j, k,
  r]`), `h0` (the radii at which pieces join, sorted; one piece lives on), `h1` (flat `[birth, death]` per loop),
  `loop` (the longest-lived loop's birth and death), `hole` (its centre), `snaps` (the four radii of the poster's
  snapshots) and `betti` (pieces and loops at each), `joins` (one per joining: `[v, w, a, b, r]`: the piece that started
  at cell v joins the one that started at cell w across the edge a-b at radius r: to draw the tower's threads),
  `loops` (per loop `{ b, d, edge, tri, hole, ring }`: born when edge appears, filled when triangle tri does, its hole's
  centre, the edges round it just after birth, or null if it reaches the window's edge), longest-lived first.
- `tile` (640 µm round the patch in the same healthy slide, y down): `n`, `types` (14 names), `xy` (Int16 pairs, 0.1
  µm), `type` (Uint8 per cell), `patch` `[x, y, side]` (where the patch lies in the tile; the patch's y is flipped:
  `y_tile = patch[1] + side - y_patch`).
- `slide` (the new slide's window: `side` 1500 µm, y down; `n` 6,716 cells): `types`, `xy`, `type`, `lo50` and `lo100`
  (Float32, log-odds, NaN where a cell has no local curve; at δ 50 and 100 µm), `limit50`, `limit100` (the colour
  map's limit: the slide's 98th percentile of |log-odds|), `train` 122, `comp50` and `comp100` `{ types (the five most
  frequent and "other"), healthy, cirrhosis (shares), sizes [healthy-like, cirrhosis-like] }`, `local` (each cell's own
  bars at 50 µm, deflated: read them only through `TDATA.slide.localH0(i)` and `localH1(i)`, which give null until
  `TDATA.ready` has settled, a frame or two after load), `eBars` `{ h0, h1 }` (the poster's cell v's own bars, exact,
  always there: use these in the story), `edges` `{ n, ij (Uint16 pairs), r (one-byte radii) }` and `tris` `{
  n, ijk, r }` (the slide's alpha complex among the window's cells), `e` `{ cell, logOdds, drawR }` (the poster's cell
  v, its score and the radius its panel draws), `overview` `{ bin (µm), w, h, window [x, y, side] in bins, count (Uint8,
  cells per bin over the 99th percentile), scar (Uint8, the share of fibroblasts and lymphocytes), cells }` (the whole
  slide, coarsely: its shape for the opening of chapter 7).
- One-byte radii: code c stands for r = 0.5 × 240^(c / 255) µm (2 % steps); 255 means 120 µm or more.

`TDATA` (`sets/tdata.js`, decoding and lookups only): `b64(str, Type)`, `r(code)`, the decoded arrays (`TDATA.tile`,
`TDATA.slide` with `x`, `y`, `type`, `lo50`, `lo100` as typed arrays, the complexes, the local bars), `u(r)` and
`rOf(u)` (the log ruler), `height(r)` (the tower's height for a radius: the ruler mapped to 0..1, the sets scale it),
`betti(bars, r)` (a count of stored bars alive at r), `alive(list, r)` (filter by stored radius), `share(dim, r0, r1)`
(the sum of stored fine shares from r0 to r1; r0 and r1 on the 0.5 µm grid), `STOPS` and `colour(lo, limit)` (the
poster's RdBu_r stops, interpolated), `TYPES` (the legend's colours by type name), `typeOf(i)`.

## The look: `TLOOK(K, set)` (`sets/look.js`)

From the mutation story's `MLOOK` (lit instanced tubes, rings, balls, boxes, halos; refilled per frame, fading with the
set): keep what helps, drop the letters, tiles, qubits and gears, add what this story needs: glass discs/spheres for
balls (instanced, with a rim where they overlap shown by depth or a shader term), glass triangle panels (one merged
dynamic buffer: positions written per frame from the alive triangles, no allocation), ribbons (a curve as a lit strip
standing in the space, from an envelope `[u, y, ...]`, with a glowing edge: for Betti curves, components, γ and means),
glass slides (a thin rounded box with a bevel and a label strip; instanced for the 123), cell splats for H&E (instanced
quads lying on the slide with a nucleus and cytoplasm drawn in the shader, per-type shape and colour, faded by size on
screen as the tour's tissue set does).

## The sets (each with a manifest `sets/<name>.md`: params, keyframes, anchors, labels, views, explore)

- **`slide`** (chapters 1, 2, 7, 8): the tissue on its glass slide.
  - The healthy `tile` (640 µm) and the new slide's `window` (1.5 mm), each drawn in H&E from the cells: every cell a
    splat by its type (hepatocyte-like large round nuclei with pink cytoplasm for Epithelial and Cancer cell, spindles
    for Fibroblasts, small dark round for Lymphocytes, ...); the stroma's eosin from the local density (dense plates
    pink, sinusoids pale, scar bands streaky); gentle relief (the cells stand out a little), so it reads as real tissue
    from afar and from close. A step param chooses what lies on the slide (tile, window, both side by side).
  - The overview of the new slide (`overview`): the whole section drawn coarsely from the bins (its shape, purple where
    dense, the scars' pink-green streaks), lying on a full-size glass slide, the window marked; the camera flies into it.
  - Modalities (a step param, chapter 1): H&E; spatial transcriptomics, sketched (hexagonal spots whose colours mix the
    cell types under them: schematic); spatial proteomics, sketched (cells as fluorescent colours by type on black);
    then everything collapses into the same points: glowing beads at the cells (a param).
  - The fixed scales (chapter 2, a step param): a square patch; each cell joined to its six nearest (computed? no: draw
    the patch's own complex edges up to a radius instead, or, simpler, a ring of six links round one chosen cell picked
    by the set at build time from the drawn positions: drawing, not science); a fixed circle round one cell. Each shown
    in turn with a label ("one patch size", "a neighbour count", "one radius").
- **`tower`** (chapters 3 and 4): the poster's patch.
  - The 110 cells as beads on a glass plate. Balls grow round them with a radius param `tower_r` (µm, 1.5 to 60; eased
    on a log scale); edges and triangles appear when the radius reaches theirs (`TDATA.alive`); pieces tinted by which
    piece they are in, loops' holes glowing orange while alive. Tags at the poster's four snapshots ("82 pieces", "3
    pieces, a loop is born", "one piece, the loop alive", "one piece, the loop filled": from `patch.betti` and
    `patch.snaps`).
  - **The tower of scales** (`tower_rise` 0..1): the radius becomes height (log ruler). Each piece is a thread rising
    from its cell (`joins`: a thread from v up to the height of r, then a bridge across a-b to w's thread); the threads
    merge upwards into one trunk that goes on to the top. Each loop is a chimney: its ring (`loops[].ring`) extruded from
    the height of its birth to its death, capped where it fills; the longest one (`patch.loop`) glows brightest. The
    radius plane (a faint glass sheet with the ruler's marks: 2, 5, 10, 20, 50 µm) moves with `tower_r`, and the
    complex at that radius is drawn on it. In a headset the tower stands about 1.5 m tall in front of you (a `stand`
    view, eased in by the engine as the mutation story's tree is) and you walk round it and look up through it.
  - The barcode and the Betti curves (`tower_bars` 0..1): the bars (pieces amber, loops orange) stand as rods beside
    the tower at the heights they span, sorted; their counts per height form two lit ribbons (β0, β1: `TDATA.betti`
    at each height) on a glass wall beside the tower, with the radius plane's line across them (in passing).
- **`cohort`** (chapters 5 and 6): the 123 slides.
  - A rack of 123 glass slides (two rows, healthy blue tags, cirrhosis red), each with its own curve (`h1.curves`;
    `cohort_dim` a step param, 0 pieces or 1 loops) standing on it as a lit ribbon; the ribbons light one after another;
    the classes' means (`means`) as two bright ribbons.
  - The main shapes (`phi[0]`, `phi[1]`) as two ribbons hovering above, with their shares (`fve`) as tags.
  - The slides fly out of the rack into a space of their scores (x PC1, y PC2, z PC3, scaled to a cube of about 1.6):
    a cloud of small glass slides, blue and red apart by eye (`cohort_space` 0..1).
  - The classifier (`cohort_wall` 0..1): its wall (the plane where `intercept + Σ coef_k × score_k = 0` with the fourth
    score at its mean 0, in the cube's scale) slides in between the clouds; then each slide glides to its log-odds
    (`logOdds`) along an axis through the wall, and drops into one of four stacks by its held-out result (`held` against
    `y`: healthy right, healthy wrong, cirrhosis wrong, cirrhosis right: 62, 4, 10, 47; `cohort_stacks` 0..1), with
    their counts and the accuracy as tags.
  - The weight per radius (`cohort_gamma` 0..1): a glass column standing for the radius (the tower's log ruler, so it
    matches the tower), γ as a ribbon swinging out to the red side (cirrhosis) or the blue (healthy) at each height,
    the means' difference beside it; the windows' shares as glowing rings round the column at their heights (radius of
    the ring by the size of the share, red for +, blue for −: 5-10 µm +2.73, 10-15 µm +4.65, the rest −0.35 as the
    poster's `windows`); then the rings drop into one stack, the gap: 7.04, odds × 1,138 (e^gap: the one sum the engine
    may form from stored numbers).
- **`map`** (chapters 7 and 8, in `slide`'s frame over the window): the signal back on the tissue.
  - One cell v (`slide.e.cell`): a glass dome of 50 µm round it; the neighbourhood's cells light; its part of the
    complex grows with a radius param (`map_r`, from the stored edges and triangles among those cells); its own bars
    (from `local`) rise beside it as a small tower of its own (threads and chimneys need no joins here: show the bars as
    rods and its two curves as small ribbons); its score as a needle up (red) or down (blue) and a tag ("its score:
    +6.97" from `e.logOdds`).
  - Every cell a centre (`map_all` 0..1): the dome sweeps across the window; behind it every cell rises or sinks by its
    score (`lo50`, clamped at ±`limit50`) and takes the map's colour: a relief, the scar bands red and up, the healthy
    lobules blue and down. Cells with no local curve stay grey and flat.
  - The split (`map_split` 0..1): the cells lift off in two groups, healthy-like and cirrhosis-like (`comp50.sizes`),
    and sort themselves by type into piles (the five types and other: `comp50` shares), as columns of small cells (in
    passing), tags with the shares.
  - The sketches (`map_omics` step: 0 none, 1 transcriptomics, 2 proteomics): the same two groups on a sketched slide of
    spots, with a schematic volcano of genes (dots rising), and on a sketched multiplex slide with a few protein bars
    as columns: labelled "sketch: the workflow, not data" (the poster's own words: "the other two sketch the workflow").
- **`body`** (chapter 1, the tour's, unchanged) with the liver from `ORGAN3D` (the microanatomy story's model) lifting
  out of it and turning; a thin slice of it falls flat as the glass slide (the hand-off to `slide`).

## The engine (`tools/topo/engine/`, adapted from the mutation story's)

Copied from `tools/mutation/engine/` as a start. Rename everything: `HOST.register('topo', ...)`, the header comment
(the poster, its authors, the data), `audio/narration-topo.mp3`, `SET_ORDER = ['body', 'slide', 'map', 'tower',
'cohort']`; remove the mutation story's own code (`MMATH`, `MUT_DATA`, its panes); `FACTS` from `TOPO_DATA` (every number
the text shows: counts, shares, fve, accuracy, the snapshots, sizes, the cell's score, the runtime). Keep the shared lines
identical (the headset code, the shared-room hooks, the slideshow, `fitTitle`, the landing screen, the headset settings
lines: see "Shared rooms" and "Inside a story" in AGENTS.md; no life-size or room mode in this story). Keep labels whose
`text` is a function, `STEP`, `finish()`, the stand view (`standView` in `e3_story.js`: here the tower's `stand` view in
chapters 3 and 4). `ORGAN3D` is driven as in the microanatomy story (`ORGAN3D.driven`, want the liver first).

**Chapters** (about 5 minutes of story time before pacing; `CH` keys and times; the first key is `title`). Every
chapter: one or two plain sentences first, then the technical layer in smaller print. Numbers from `FACTS`, none
hard-coded. The text below is a draft: keep its meaning and its plainness, shorten freely.

1. `title` 0-34, **Where cells sit** (`body`, then `slide`: the healthy tile, the modalities, the points). "Under the
   microscope, a slice of liver is a crowd of cells, and where they sit says how healthy the tissue is. A computer can
   find every cell in a stained slide: 30.8 million of them in 123 slides of liver here. Other ways of measuring tissue,
   reading genes in spots or staining proteins in colour, also give where the cells are. From here on, only those
   positions count." Small print: the poster, its authors; the cells found by HistoPLUS in GTEx slides; topocyte reads
   cells from any spatial modality (H&E, spatial transcriptomics, spatial proteomics) as an AnnData.
2. `scale` 34-62, **Which scale?** (`slide`: the three fixed scales). "To read how cells are arranged, most tools pick one
   scale: a patch of a certain size, a cell's nearest few neighbours, or a fixed radius. But tissue has structure at
   every scale, from a cell's neighbours to the shape of a whole lobule. topocyte reads all of them at once." Small
   print: "scale-resolved": every radius, no size to choose.
3. `balls` 62-112, **Balls grow** (`tower`, the patch, `tower_r` from 1.5 to 60 µm). "Take 110 cells. Grow a ball round
   every cell. Where two balls touch, the cells are joined by an edge; where three meet, a triangle fills in: a network
   that also has triangles. At 4 µm there are still 82 separate pieces. At 13 µm three pieces are left, and a loop has
   closed round an empty space. At 25 µm it is all one piece, the loop still open inside. At 49 µm the loop has filled."
   Small print: the alpha complex, a simplicial complex (the higher-order generalisation of a network); the radii are
   the poster's snapshots (4.08, 13.49, 24.59, 48.86 µm) and its counts.
4. `tower` 112-160, **The tower of scales** (`tower`, rising; in a headset the stand view). "Now let the radius become
   height. Each piece is a thread rising from its cell; where two pieces join, their threads merge, until one trunk is
   left. Each loop is a chimney, from the height where it closes to where it fills. How long each lives is a bar; how
   many are alive at each height gives two curves. Together they describe the tissue at every scale at once." Small
   print: persistent homology; pieces are H0 and loops H1; the bars form the barcode; the counts are the Betti curves,
   exact step functions; the filtration value is t = r².
5. `cohort` 160-206, **123 slides** (`cohort`: the rack, the curves, the shapes, the space). "Do this for every slide:
   66 healthy livers and 57 with cirrhosis, where scars cut the liver into knots. Each slide gets its own curves. Scaled
   to the same size, only their shape counts. Comparing every slide with every other finds the main shapes the curves
   vary by: the first holds 72 % of the variation in loops, the second 20 %. Each slide becomes a point by how much of
   each shape it has, and healthy and cirrhotic slides fall apart before anything is trained." Small print: cosine
   normalisation; the functional PCA, computed exactly from the bars' ends (no grid); 1.9 minutes for all 123 slides
   and 30.8 million cells on a laptop's processor.
6. `scales` 206-252, **Which scales matter** (`cohort`: the wall, the stacks, the column of radii). "A classifier draws a
   wall between the two clouds. Read back through the shapes, it becomes a weight for every radius: loops alive at 5 to
   15 µm speak for cirrhosis. Loops from 5 to 10 µm add 2.73 to the difference between the two groups and loops from 10
   to 15 µm add 4.65; the other radii take 0.35 away. Together: 7.04, odds of about 1,138 to 1. Tested fairly, on
   slides it never saw, it gets 109 of 123 right." Small print: a logistic regression on the first four scores; γ(r);
   five-fold cross-validation: 62 of 66 healthy and 47 of 57 cirrhotic slides, accuracy 0.886.
7. `cells` 252-302, **Every cell a centre** (`slide` overview, the window, `map`). "Now a slide the classifier never saw.
   Pick one cell and look only at the cells within 50 µm of it: they make their own small network and their own
   curves, and the classifier gives the cell a score of its own. Do this for every cell, and the slide becomes a map:
   the scars light up red, the healthy tissue blue." Small print: local persistent homology, the slide's complex
   restricted to each cell's neighbourhood; the model and classifier fitted on the other 122 slides (pieces, H0).
8. `next` 302-340, **Where analysis begins** (`map`: the split, the sketches; `slide`). "The cells now fall into two
   groups, the cirrhosis-like and the healthy-like, and the groups can be compared in whatever was measured: here, in
   the cirrhosis-like cells, more fibroblasts and lymphocytes. In spatial transcriptomics it would be genes, in spatial
   proteomics proteins. Four calls of topocyte, and the shape of tissue becomes something to measure." Small print: the
   types are the cell classifier's labels; with a radius of 100 µm, as in the poster's figure, 1,000 and 5,716 cells;
   the transcriptomics and proteomics steps are sketches of the workflow; the credits (authors, institutes, GTEx,
   HistoPLUS, topocyte.lab.lbi-netmed.com).

**Explore mode** tabs (HTML and canvas twins, as every story):
- **Patch**: the radius (1.5 to 60 µm), the tower on or off, pieces or loops lit, the barcode; the counts at that
  radius (looked up).
- **Cohort**: pieces or loops, the view (rack, scores, held out), pick a slide (by click or ray: its number, class, its
  curve lit, its scores, its held-out result); the shares of variance; the accuracy.
- **Scales**: pieces or loops; a window of radii from 0 to 100 µm (or "and above") in 0.5 µm steps: its share and odds
  factor (looked up); γ and the means on the column.
- **Cells**: the map on or off (50 µm, or 100 µm as in the poster's figure: colours only), pick a cell (click or ray):
  its dome, its neighbourhood's complex at a radius, its bars, its score; the split and its piles.
- **Scenes**: Liver (`body`), Section (`slide`, modality), Patch (`tower`), Cohort (`cohort`), Map (`map`).

Suggested hashes: `#topo&t=100`, `#topo&explore&tab=patch&r=13.5&tower=on`, `#topo&explore&tab=cohort&dim=1&view=space&
slide=17`, `#topo&explore&tab=scales&dim=1&from=5&to=15`, `#topo&explore&tab=cells&cell=1234&r=4.8&delta=50`,
`#topo&explore&scene=slide&mode=points`. `collab.state()`: the tab, the scene, every scene's controls, the radius (to
0.01), the dimension, the view, the picked slide, the window, the picked cell, the map's δ (never the camera or
anything per device; `apply(state())` gives `state()` back; the shell's `FORMAT` goes up with a new story).

## Testing

- `node tools/topo/build.mjs --check`; a set alone: `node shot.mjs <set> "<query>|..." <prefix> 640 400` from
  `tools/topo` (serve the repository root); the story: `sweep.mjs`, then the smoke test (once the story is in
  `HOST.list` and the smoke test knows it).
- `node tools/topo/test-data.mjs`: `TDATA` decodes `TOPO_DATA` and its lookups give the poster's numbers (the patch's
  counts at the snapshots, the window shares 2.73 and 4.65 and the gap 7.04 summed from the fine shares, 62/4/10/47 from
  `held` and `y`, 66/57, the split's sizes); no science, only checks that the data and the decoders agree.

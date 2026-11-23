# `map`: the signal back on the tissue (file `sets/map.js`)

Chapters 7 and 8 of the topo story, in the `slide` set's frame over the new slide's window (6,716 real cells, 1.6
across, centred on the origin while the window lies alone; side by side, `slide_show` 2, everything moves with the
window to x 0.42). Nothing here is computed but drawing: the cells within 50 µm of a cell are found by their drawn
positions, the complex is the window's stored one (`TDATA.slide.edges`, `.tris`) filtered by stored radius, the counts
are of stored bars (`TDATA.deaths`, `TDATA.betti`), the colours are each cell's stored score (`lo50`, `lo100`,
`TDATA.colour`), the relief's heights the stored scores round each cell smoothed for drawing (below), the groups are
the scores' signs alone (as in the authors' code: below 0 healthy-like, above 0 cirrhosis-like, a cell at 0 or with no
score in neither; the counts are `comp50.sizes`), the piles' tags are `comp50`'s stored shares.

- **One cell** (the poster's cell v, `TOPO_DATA.slide.e.cell`, at (-0.002, 0, 0.332), a cell the classifier labels a
  fibroblast; or one picked in explore, `map_pick`): a glass dome of 50 µm (cyan, its rim glowing, a ring at its
  base); the 28 cells under it lit as beads, the cell itself cyan; their part of the stored complex at the radius
  `map_r` (edges as lit tubes, triangles as glass), with the growing balls (glass discs that read as one union) while
  `map_balls` is on. Its own stored bars rise behind it as a small tower on the tower set's log ruler (1.5 to 60 µm up
  0.3): pieces (amber rods from 0 to where each joins another, longest in the middle; the one that lives on reaches the
  top with an arrowhead) to the left, loops (orange rods from birth to death) to the right; its two curves (pieces and
  loops alive at each height, counted from those bars, each over its own top) stand as lit ribbons at either end, and
  a cyan level marks `map_r` across them. Its stored score stands as a needle beside it, up for cirrhosis-like and
  down for healthy-like, in the map's colour (clamped at the colour map's limit, 17.92).
- **Every cell a centre** (`map_all`): a dome sweeps the window in rows of 100 µm, back and forth; behind it each cell
  takes the poster's colour (RdBu_r) by its own stored score and rises or sinks with the scores round it (0.15 at the
  limit): the window's stored triangles up to 30 µm lifted into a lit relief with the cells as beads on it, the scars
  red and up, the healthy-like tissue blue and sunk below the glass. The height is for drawing only: each cell's
  clamped score as a Gaussian-weighted mean over the cells within 60 µm (σ 25 µm), so scar bands and lobules read as
  ridges and hollows rather than a field of single-cell spikes (its sign agrees with the cell's own for 90 % of the
  cells). The colours, the tags, the needle and explore keep each cell's own stored score. The `slide` set dims its window to a ghost row by row behind the dome.
- **The split** (`map_split`): the cells fly off in two groups, healthy-like (score below zero: 1,529 at 50 µm) to the
  left and cirrhosis-like (5,187) to the right, each over a tinted glass base, and stack by type into six columns of
  small cells in the legend's colours (comp50's five types and other), a column's cross-section set by its group's
  size so that its height follows the type's share.
- **The sketches** (`map_omics`, schematic, labelled "sketch: the workflow, not data"): 1, the window as a slide of
  spots (50 µm apart), each the blue-red mix of the groups of the cells under it (drawn from the real groups), with a
  schematic volcano of genes rising above it (seeded random dots: up in cirrhosis-like red, up in healthy-like blue,
  the rest grey); 2, the window dark as a multiplex slide, the cells back in place glowing in their group's colour,
  and six schematic proteins as pairs of columns (blue, red). No gene, protein or number in them is data.

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `map_a` | 1 | fade | in at 262-263 (once the slide's zoom has arrived), to the end of chapter 8 |
| `map_cell` | 1 | the dome on the cell, its cells lit, its complex, its bars and score (all of them fade with it, and with the split and the sketches) | 0 at 262; 0 -> 1 at 263-265.5 (cam `cell`); 1 -> 0 at 284-286 as the sweep starts |
| `map_r` | 50 | the radius (µm) of its part of the complex: stored edges and triangles whose radius is at most it; also the balls' radius and the level on its tower. Eased linearly: for an even growth key it in steps, or ease it as the story does the tower's | 1.5 at 263; -> `e.drawR` (4.77, the poster's panel) at 265-268.5; -> 30 at 269-273; 50 from 278 |
| `map_balls` | 0 | the growing balls round its cells (glass discs, the union look of the tower's balls) | 0 -> 1 at 264-266; 1 -> 0 at 271-274 (before they cover everything) |
| `map_bars` | 1 | its own bars rise behind it (a level rising up the ruler shows rods and ribbons below it) | 0 at 262; 0 -> 1 at 273-278 (cam `bars`) |
| `map_score` | 1 | its score's needle and tag | 0 at 262; 0 -> 1 at 279-281 (cam `score`) |
| `map_all` | 0 | the sweeping dome and the relief behind it (0 none, 1 every cell risen; the dome goes from 0.92 on) | 0 -> 1 at 285-298 (cam `sweep`, then `relief` or `low` from 293); held to 302 |
| `map_split` | 0 | the cells fly to their piles (from the bottom up, a layer at a time; the relief folds away by 0.35) | 0 -> 1 at 304-312 (cam `split`) |
| `map_omics` | 0 | the sketches: 1 spots and the volcano, 2 the multiplex slide and protein columns; in between a crossfade (the cells settle back on the slide on the way to 1). Plain; may be stepped | 0 -> 1 at 320-324 (cam `omics`), 1 -> 2 at 327-331; never eased back from 2 to 0 (it would pass through 1): fade `map_a` out instead |
| `map_pick` | -1 | the cell with the dome (an index into the window's cells; -1 the poster's cell v). **Step param** | -1 in the story |
| `map_delta` | 0 | the map at 50 µm (0) or 100 µm as in the poster's figure (1): the relief's and beads' colours (`lo100`, its own limit 13.51), the groups and piles (`comp100`: 1,000 and 5,716) and the spots' groups. The heights, the dome, its complex and its bars stay at 50 µm. **Step param** | 0 in the story |

The resting look (defaults): cell v under its dome with its complex at 50 µm, its bars and its score, on the H&E
window (with the `slide` set at `slide_show` 1).

## Anchors

`cell` (the cell, on the relief if risen), `dome` (beside the dome's top), `net` (by the dome's near side, for the
network's tag), `bars` (right of its tower, near the top), `score` (the needle's tip), `sweep` (the moving dome),
`red`, `blue` (the relief's highest and lowest stretches: 150 µm squares with the highest and lowest mean height, four
squares apart, of the drawn heights; at (-0.72, 0.117, -0.72) and (0.56, 0.024, 0.56)), `healthy`, `cirrhosis` (the near left corners of the
groups' bases), `h_0` .. `h_5`, `c_0` .. `c_5` (the tops of the healthy-like and cirrhosis-like piles, by comp50's
type order: Fibroblasts, Apoptotic Body, Epithelial, Lymphocytes, Cancer cell, other), `genes` (above the volcano),
`proteins` (beside the columns), `window` (the window's far left corner). All follow the cell, the δ and the layout.

## Labels

- `Cell v · 50 µm round it` (cyan, at `dome`; another cell: `Cell 1,234`, its index + 1): with the cell, until its
  bars rise or the sweep starts;
- `Its own network · at 4.8 µm` (cyan, at `net`; the radius now): with the cell, until its bars rise;
- `Its own bars · 11 pieces, 4 loops` (amber, at `bars`; the counts of its stored bars alive at `map_r`: pieces are
  its joinings still ahead plus the one that lives on): with `map_bars`;
- `Its score · +6.97` (at `score`; `e.logOdds` for cell v, `lo50` for another): with `map_score`;
- `Every cell a centre` (cyan, at `sweep`): while the dome sweeps;
- `Red, raised · cirrhosis-like` (magenta, at `red`) and `Blue, sunk · healthy-like` (cyan, at `blue`): the relief
  done, not with the cell or the split;
- `Healthy-like · 1,529 cells` (cyan, at `healthy`) and `Cirrhosis-like · 5,187 cells` (magenta, at `cirrhosis`;
  `comp50.sizes`, or comp100's): with the split;
- `Fibroblasts · 26 %` and `Lymphocytes · 17 %` on the cirrhosis-like piles, `Fibroblasts · 24 %` and
  `Lymphocytes · 5 %` on the healthy-like ones (comp50's shares, or comp100's): once the piles stand;
- `Genes · sketch: the workflow, not data`, `Proteins · sketch: the workflow, not data` (amber): with each sketch.

At most six show at once.

## Cam views `[az, el, dist, tx, ty, tz]`

| View | Value | For |
| --- | --- | --- |
| `default` | [22, 34, 3.6, 0, 0.02, 0.06] | the window and whatever stands on it |
| `cell` | [18, 40, 0.62, -0.002, 0.03, 0.332] | cell v and its dome (chapter 7, 263-273) |
| `net` | [10, 58, 0.36, -0.002, 0.005, 0.342] | close from above: its complex growing |
| `bars` | [12, 16, 0.95, -0.002, 0.13, 0.292] | its tower behind it, low (273-279) |
| `score` | [24, 22, 0.75, 0.028, 0.06, 0.312] | the needle and the tower (279-285) |
| `sweep` | [6, 44, 3.4, 0, 0, 0.08] | the dome sweeping the window (285-293) |
| `relief` | [24, 30, 3.5, 0, 0.02, 0.06] | the relief (293-302) |
| `low` | [32, 12, 3.1, 0, 0.04, 0.12] | the relief from low, the sunk blue under the glass |
| `split` | [0, 14, 3.9, 0, 0.32, 0.05] | the two groups' piles (chapter 8) |
| `omics` | [0, 20, 3.8, 0, 0.3, 0.02] | the sketches |

The cell's views are computed from its place (for cell v). In a headset the relief stands about 0.15 units up and
down, the piles up to 0.63 above the glass.

## Explore

Controls: Show (One cell / Every cell / Two groups / Genes (sketch) / Proteins (sketch)), Radius (2, 5, 10, 20,
50 µm: `map_r`; the balls show under 20 µm), Map at (50 µm / 100 µm: `map_delta`). `explore(c)` returns every `map_`
param but `map_pick` (the Cells tab drives it), and the `slide_` params that show the window under it (`slide_show` 1,
no overview, H&E, no scale or patch): the engine may take or ignore those.

`api()`:
- `n` (6,716), `e` (cell v's index), `drawR` (4.77), `eLogOdds` (6.97), `limit50`, `limit100`, `delta` (50), `comp50`,
  `comp100`, `types`;
- `cell(i)` -> `{ i, x, y (µm, y down), type (the classifier's label), lo50, lo100, near (cells within 50 µm), h0, h1
  (its stored bars: joinings, and [birth, death, ...]; null until `TDATA.ready` has settled, except for cell v),
  group50, group100 ('healthy-like' or 'cirrhosis-like') }`;
- `counts(i, r)` -> `{ pieces, loops }` alive at r µm (from its stored bars), or null until they are inflated;
- `pos(i, out)` (a cell's place in the set's frame as drawn now: on the relief if risen);
- `pick(raycaster)` -> `{ kind: 'cell', cell }` (the bead nearest the ray as drawn now, else the cell nearest to where
  the ray meets the slide, within 30 µm) or null (also while the cells are in their piles or the sketches show).

## Sizes for framing

The window: 1.6 x 1.6 on the origin. Cell v's dome: 0.053 across its radius at (-0.002, 0.332); its tower 0.3 tall,
behind it at z 0.244, from x about -0.25 to 0.19 with its ribbons. The relief: y -0.120 to 0.146. The piles: from x
-0.86 to 0.96, their bases at y 0.03, tops up to 0.63, 0.1 to 0.14 deep. The volcano: x -0.6 to 0.6, y 0.08 to 0.7, z
about -0.33 to -0.03; the protein columns: x -0.54 to 0.54 at z -0.2, up to 0.7 tall.

## Performance (headless Chromium, software GL)

Build 70-95 ms (the cells' heights, colours and visits; the relief's smoothed heights; the stored complex by cell; the
groups and the piles' slots; the relief's 13.1k triangles; the spots' groups). With the slide set under it (`with=slide`)
its own build, 85-215 ms, dominates: together they stay under the 300 ms budget, but not by much. Draw calls: 8 for one
cell (11 with the slide), 10 for the relief with the cell (13 with the slide), 2 for the piles (5 with the slide), 6 for
a sketch with the slide. Triangles: 16.5k for one cell (bars, complex, dome; 30.2k with the slide), 43.1k for the
relief, its beads and the cell (56.7k with the slide, the most), 13.5k for the piles (27.1k with the slide), 27-30k for
a sketch with the slide. The relief and the beads place themselves in their shaders from the params (one buffer each,
filled once): nothing is refilled for the sweep, the split or the sketches. Per frame only the pools of one cell (a few
hundred instances) and the sketches' small pools are refilled; nothing is allocated except a new cell's neighbourhood
and curves when the cell changes.

## For the narrator

- "Within 50 µm" is the local radius (the author's). The cell's network is the slide's own (the window's stored
  complex) among the cells within 50 µm; its bars and its score are topocyte's, computed with the model and classifier
  fitted on the other 122 slides (pieces, H0).
- Cell v's score is its own as the data gives it (6.97 at 50 µm), never the poster's printed 26.57.
- The colours are the poster's (RdBu_r), clamped at the slide's 98th percentile of the scores (17.92).
- The groups are the scores' signs alone, as in the authors' code (a cell scored exactly 0, or not at all, is in
  neither and stays on the slide, fading as the others lift off; this window has none); the piles' shares are
  topocyte's (`comp50`). The types are the cell classifier's labels. With a radius of 100 µm, as in the poster's
  figure, the split is 1,000 and 5,716.
- The spots, the genes, the multiplex slide and the proteins are sketches of the workflow, not data.

# `tower`: the poster's patch, its balls, and the tower of scales (file `sets/tower.js`)

Chapters 3 and 4 of the topo story, the showpiece. The poster's patch (`TOPO_DATA.patch`, panel b: 110 real cells of a
healthy liver slide in a window of 214 µm, its alpha complex of 313 edges and 204 triangles, 109 joinings and 85 loops,
all topocyte's and gudhi's) lies on a glass plate, 1.5 units wide, its frosted label towards you (tinted as the healthy
slides). The poster's y runs up the plate away from you (-z).

- **Balls** (`tower_r`, µm): a glass disc of radius r round every cell (`TLOOK.discs`, so overlapping balls read as one
  union with a seam where two just touch). An edge appears when r reaches its stored radius (glowing white as it
  appears, a joining edge amber), a glass triangle likewise. The beads and balls take the colour of the piece they are
  in (the stored joins replayed in order up to r); a piece of one cell stays white-gold. Every loop alive at r
  (`birth <= r < death`, as `TDATA.betti`) glows: its ring of edges orange (`loops[].ring`), its hole a glass fan and a
  soft halo, a white flash as it is born; the poster's loop (`loops[0]`, `patch.loop`) brightest. Tags at the poster's
  four snapshots, from `patch.snaps` and `patch.betti`.
- **The tower of scales** (`tower_rise`): the radius becomes height on the poster's log ruler (`TDATA.height`: 1.5 µm at
  the plate, 60 µm at y = 1.6). Each piece is a thread rising from its first cell (gudhi's representative of it),
  thicker as it gathers cells and coloured as its piece; where it joins another (`patch.joins`) it bridges, at the
  height of the joining, along a curve across the middle of its joining edge to the other piece's thread; the threads
  merge until one trunk (amber, the last piece) goes on to the top. Each loop is a chimney: its ring extruded from the
  height of its birth to its death and capped where it fills (the poster's loop with lit edges, rings and a glow inside;
  the short-lived ones as faint walls and a cap). The radius plane (faint glass in a cyan frame) rises with `tower_r`
  and carries the complex at that radius: cells, edges, triangles, balls (fainter here) and the loops' holes; whatever
  stands above it is drawn faint, so the plane reads as "now". The ruler: a post at the plate's left (x -1, z 0) with
  marks at 2, 5, 10, 20 and 50 µm and a cyan ring at the plane. At `tower_rise` 0 everything lies on the plate (the balls
  of chapter 3); in between it stretches upwards.
- **The barcode and the Betti curves** (`tower_bars`): the threads and chimneys lift out of the tower as rods (pieces
  amber, loops orange) and fly to a glass board on the tower's right, one after another. The pieces' rods stand side by
  side, the longest-lived first (the trunk's at the left), so the rods alive at any height are the first ones: their
  staircase is the count of pieces, and the β0 ribbon on the board behind them (`TDATA.deaths` at every radius where it
  changes, a rod's pitch per piece) traces it exactly. The loops' rods are packed into lanes (each to the first lane free
  at its birth: as many lanes as loops ever alive at once, 10), so the busy lanes at a height are the count of loops, and
  the β1 ribbon (`TDATA.betti`, a lane's pitch per loop) stands behind them. The rods alive at the plane are lit; the
  plane's line runs across the board with a bead where it meets each curve.

Nothing here is computed but looked up: which simplices and bars are alive at a radius (stored radii against it), which
piece a cell is in (the stored joins replayed), the counts (`TDATA.deaths`, `TDATA.betti`), and where things go (stored
positions and radii). The packing of the loops' rods into lanes, the piece colours and the threads' thickness (cells
per piece) are drawing only.

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `tower_a` | 1 | fade | in at 60-63 (from the `slide` set's tile), out at 158-161 |
| `tower_r` | 1.5 | the radius in µm (1.5 to 60; up to 120 is drawn). **Ease it on the log ruler** (`set.log` lists it: key and ease `TDATA.u(r)`, show `TDATA.rOf(u)`), in the story and in explore | 1.5 at 70; the snapshots `patch.snaps` (4.081, 13.49, 24.592, 48.864) at about 76, 88, 98, 106, each held 3-5 s; 60 at 110. In chapter 4 back to 1.5 as the tower rises (114-122), then up to 60 again (124-140) so the plane sweeps up through the tower; a stop at 13.49 or 24.592 shows the plane cutting the big chimney |
| `tower_rise` | 0 | 0 everything on the plate; 1 the tower of scales (heights times this) | 0 -> 1 at 113-122 |
| `tower_bars` | 0 | the rods fly out to the board (0.04 to 0.58), the glass board (0.3 to 0.6), the two curves drawing upwards (0.5 to 1) | 0 -> 1 at 141-152 |
| `tower_he` | 0 | 1: the 110 cells in H&E by their types (looked up in the healthy tile by position), on a pale eosin stain; to 0 they shrink into beads | 1 at 60-63 (the hand-off from the slide's tile), 1 -> 0 at 65-70 ("from here on, only positions count") |
| `tower_lit` | 0 | 0 both, 1 pieces lit (loops dimmed), 2 loops lit (pieces dimmed). **Step param** | 0 in the story (explore's Lit control) |

The resting look (defaults): the 110 cells as white-gold beads on the plate, the balls at 1.5 µm.

## Anchors

`plate` (the middle of the plate), `label` (the plate's frosted label), `top` (the tower's top on its axis), `tag` (the
plate's back left corner: the snapshots' tags), `cell` (a cell of the big loop, on the plane), `hole` (the big loop's hole
on the plane), `plane` (the ruler at the plane's height), `trunk` (above the trunk's top), `chimney` (the big chimney's
side, halfway up), `bars` (above the pieces' staircase), `bars1` (above the loops' lanes), `board` (the board's middle),
`tick0` .. `tick4` (the ruler's marks at 2, 5, 10, 20, 50 µm). All but `plate`, `label` and `tag` follow the params.

## Labels

- The snapshots, from `patch.betti` and `patch.snaps` (one at a time, at `tag`, within a hair of each radius on the
  ruler, only while the tower lies flat and the cells are beads): `82 pieces · no loops yet`, `3 pieces · 7 loops: the
  big one just born`, `One piece · 2 loops: the big one still open`, `One piece · no loops: the big one has filled`;
- `The big loop · round an empty space` (amber, at `hole`): while it is alive on the flat patch, once past its birth;
- `13.5 µm · 3 pieces · 7 loops` (cyan, at `plane`; a function: the radius and the counts looked up there): once the
  tower rises;
- `2 µm` .. `50 µm` (at the ticks): while the tower stands and the board is away, each fading where the plane passes;
- `The trunk · one piece left` (amber, at `trunk`): the tower up, r past 17 µm, before the board;
- `The big loop · a chimney from birth to filling` (amber, at `chimney`): the tower up, r past 13 µm, before the board;
- `Pieces · 110 rods: their staircase is the count` (amber, at `bars`) and `Loops · 85 rods, at most 10 at once` (at
  `bars1`): with the board (numbers from the data).

## Cam views `[az, el, dist, tx, ty, tz]` (target in the set's frame)

| View | Value | For |
| --- | --- | --- |
| `default` | [18, 16, 4.9, 0, 0.74, 0] | the tower whole, the plate at its foot |
| `plate` | [8, 52, 3.4, 0, 0, 0.05] | a close look at the plate: the balls growing (chapter 3) |
| `snap` | [0, 64, 3.0, 0, 0, 0.02] | from above, as the poster's snapshots (the plate fills the screen, the tag at its top left) |
| `tower` | [26, 12, 5.0, 0, 0.85, 0] | the tower rising (chapter 4) |
| `up` | [205, -58, 2.6, 0.05, 0.95, 0] | from under the glass plate, up through the threads into the big chimney's glow (screens; in a headset it tips the tower, so prefer `stand`) |
| `bars` | [6, 12, 6.0, 1.0, 0.82, -0.15] | the tower and the board of rods and curves |
| `stand` | [16, 0, 1.17, 0, 1.06, 0] | **the headset view**: `xrPlace` scales it to 0.94 m a unit, so the tower (1.68 units with the trunk's top) stands about 1.55 m tall, the plate about 1.2 m below your eyes and its top about 0.4 m above them: you stand at its front and look up through it. With the engine's `standView` (its axis 0.2 units further off, as the mutation story's tree) nothing of the tower comes within 0.38 m of your eyes for story turns from -60 to 60 degrees (the ruler stands at the plate's left side for that), and the board stays more than 0.9 m away; keep the story's turn within that range while it is eased in (chapter 4). On a screen it is a close crop across the plane |

## Explore

Controls: View (Balls / Tower / Barcode), Radius (the four snapshots, `4.08 µm` .. `48.86 µm`, and 60 µm), Lit (Both /
Pieces / Loops). `explore(c)` returns every `tower_` param (cells as beads; the Radius control or `c.r` as a number, so
the Patch tab's slider can drive `tower_r` directly; the Balls view at the second snapshot, the others at 60 µm when no
radius is given).

`api()`:
- `range` ([1.5, 60]), `ticks`, `snaps` ([{ r, pieces, loops }], the poster's, stored), `counts(r)` ({ pieces, loops }
  alive at r, looked up), `most` ({ pieces: 110, loops: 10 }), `lanes` (10), `cells` (110), `loops` (85), `main`
  ({ b, d, edges } of the poster's loop: 12.98, 46.59, 29);
- `piece(i, r)` -> { start (the cell its piece started from), cells (how many it holds) } at radius r;
- `loop(k)` -> { k, b, d, main, edges }; `bar(dim, i)` (a piece's bar { i, b: 0, d } or a loop's);
- `pick(raycaster)` -> { kind: 'cell', i, piece } (on the plate or the plane), { kind: 'loop', k } (its hole on the plane
  or its chimney), { kind: 'bar', dim, i } (a rod on the board, once it is out), or null.

## Sizes for framing

The plate's clear part x and z within ±0.87 (the patch within ±0.75), its label from z 0.87 to 1.48; the tower from y 0
to 1.68 (the trunk's top; 60 µm at 1.6), the radius plane ±0.79; the ruler at (-1, 0); the board from (1.07, -0.08) to
(2.5, -0.49) on the floor, 1.72 high, facing a little to the right of +z (turned 16 degrees). A ball at 60 µm reaches
0.42 units round its cell, past the plate's edge (the balls calm down there).

## Performance (headless Chromium, software GL)

Build 12-28 ms (H&E types looked up in the tile, the threads, lanes and envelopes). Draw calls 3 (H&E) to 9 (the board);
empty pools cost none. Triangles: 0.5k (H&E), 6.6k (balls at 13.49 µm), about 30-42k with the tower, 36k with the board.
update() 0.3 to 1 ms (up to about 2,000 tubes and 1,000 glass triangles refilled per frame), nothing allocated per frame
(label texts aside). Seeking: the picture depends on the params alone (checked: the same params after others give the
same buffers).

## For the narrator

- Pieces are connected components (H0), loops are holes (H1); the radius is r in µm (the alpha filtration's value is
  t = r²). The network with triangles is the alpha complex: an edge appears once the balls of its two cells meet, a
  triangle once its three meet (the complex's own rule decides the exact radius; the set only reads it).
- The poster's snapshots: at 4.08 µm 82 pieces; at 13.49 µm 3 pieces and 7 loops, the big one just born (at 12.98 µm);
  at 24.59 µm one piece, 2 loops, the big one still open; at 48.86 µm one piece and no loops: the big one filled at
  46.59 µm. Most loops live briefly (85 in all, at most 10 at once); the big one lives longest, from 12.98 to 46.59 µm.
- The threads start at each piece's first cell as gudhi counts it (its representative); where two pieces join, the
  thread of the piece that ends there (gudhi's choice: every piece is born at radius 0) bridges to the other's. The
  trunk is the one piece left from 16.58 µm on.
- The barcode is the tower pulled apart and sorted: one rod per piece, one per loop, from the radius it appears to the
  radius it goes. The curves count the rods alive at each height: the Betti curves, exact step functions. The lanes are
  only a way of drawing the loops' rods side by side.
- The cells' types in H&E are the cell classifier's labels (HistoPLUS), not histology; the H&E is drawn from them.

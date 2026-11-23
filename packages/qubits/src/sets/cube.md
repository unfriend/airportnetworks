# `cube`: the cuts, the coarse operator, the bricks, the toolbox (file `sets/cube.js`)

Chapters 4 to 7 of the qubits story. An example network (`QMATH.NETS`, the story's `QMATH.DEFAULT`) cut in two, four
and eight (genes fly to the cube's corners), the coarse operator A_c on the cube, Pauli strings as small cubes with
their weights (largest first), added one by one into the big cube while the error left shrinks, and the toolbox: the
strings inside the algebra stay bright, the rest go gray and are dropped (the residual). Every number is computed live
(`QMATH.analyze`); nothing is the real network's.

Axes, as in the reference figure: the first cut (the top bit, q2 at 3 bits) is left (0) / right (1), the second front
(0) / back (1), the third top (0) / bottom (1). Code 000 is top-front-left. At fewer bits the cells sit on a line (1
bit) or a square (2 bits). Signs: solid +, dashed -; corners red for +1 and blue for -1 where a focused string puts a
loop. Cells keep their colors (`QMATH.CELL_COLORS`) in every set.

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `cube_a` | 1 | fade | in at 90-93, out at 238-241 |
| `cube_net` | default (1) | which example network (index into `QMATH.NETS`: 0 Clear groups, 1 Uneven groups, 2 Strong mixing, 3 Random network). Step param | fixed in the story |
| `cube_cut` | 0 | 0 the found cut, 1 random halvings. Step param | 0 in the story |
| `cube_genes` | 0 | the gene-level network (points and links) | 1 at 90 |
| `cube_bits` | 3 | 0..3: the cuts (0 the network, 1 two halves, 2 a square, 3 a cube); links across the cut being made flash amber and a glowing sheet shows the cut. Also the bits of A_c and the strings (round, 1..3) | 0 at 90; -> 1 at 98-104, -> 2 at 108-114, -> 3 at 118-124 |
| `cube_ac` | 1 | the genes gather into their corners and the coarse operator grows: a loop at each corner (the diagonal), an edge between every two corners as wide as their coupling | 0 -> 1 at 130-138 |
| `cube_bricks` | 0 | the big cube moves left and the gallery of strings comes in (2 rows of 5) | 0 -> 1 at 160-164 |
| `cube_lesson` | 0 | 1: the gallery shows the reference figure's strings one by one, without weights (I, X0, X1, X2, Z2, Z2X1, X2X1, Y2Y1); 0: the network's ten largest weights. A switch crossfades through nothing at 0.5 | 1 at 160; -> 0 at 189-191 |
| `cube_focus` | -1 | a string index k (`QMATH.parse(name, L)`, at the bits shown) or -1: the big cube shows that one string's pattern (its loops and hops, unit size) and its name and what it does above. Step param (the set eases the switch itself) | I, X0, X1, X2, Z2, Z2X1, X2X1, Y2Y1 at 165, 168, ... 186; -1 at 189 |
| `cube_build` | 0 | the big cube shows the sum of the strings added so far (a gray ghost of A_c behind), with the error-left gauge under it | 0 -> 1 at 192-193 |
| `cube_sum` | 0 | 0..10: how many strings have been added (continuous: each flies from its slot into the big cube) | 0 -> 10 at 194-210 |
| `cube_alg` | 0 | strings outside the algebra go gray in the gallery | 0 -> 1 at 217-220 |
| `cube_keep` | 0 | the big cube keeps only the trace part and the strings inside the algebra; the gauge shows the residual | 0 -> 1 at 224-230 |
| `cube_algebra` | 1 | 0 so(2L) (the TFIM chain), 1 so(2L+1) (with the boundary Z on the top qubit). Step param | 1 in the story |

The resting look (defaults): the coarse operator of the default network at 3 bits.

## Anchors

`genes` (the network's center), `cube` (the big cube's center, moves with the gallery), `top` (above it: the focused
string's label), `c000` .. `c111` (beside each corner, functions), `gallery`, `brick0` .. `brick9` (the slots),
`gauge` (the gauge's right end), `cut1`, `cut2`, `cut3` (by each cut's sheet).

## Labels

The corner codes at the bits shown (hidden with the gallery up); `First cut · digit q2`, `Second cut · digit q1`,
`Third cut · digit q0` during each cut; per slot the string's name and weight (`X₀ 0.17`; cyan, or plain for I and,
with the toolbox on, for strings outside; minor beyond the fourth slot; text is a function); the focused string
(`X₂Z₁X₀ · hops across face diagonals`; text is a function); `Error left` or `Residual · the share dropped` at the gauge.

## Cam views

`default` (three-quarter view of the cube, as in the reference figure), `genes` (the network and the cuts), `cube`
(closer), `bricks` (big cube and gallery), `gallery` (the gallery).

## Explore

Controls: View (Genes / Cut / Cube / Bricks / Toolbox), Network (the four), Cut (Found / Random), Bits (3 / 2 / 1, not
for Genes), Algebra (so(2L+1) / so(2L), Toolbox only). The Bricks tab of the engine drives `cube_focus`, `cube_build`,
`cube_sum` and `cube_lesson` itself.

`api()`:
- `nets` [{ i, key, name, note }], `defaultNet`;
- `analysis()`: the analysis shown now (`QMATH.analyze`: sizes, purity, Ac, c, order, errors, fits.tfim/odd
  {inside, gens, residual}, cubeShare, cutShare, trotter), `analyze(ni, 'found' | 'random', L)` any other;
- `bricks()`: the gallery now [{ slot, k, name, weight, inside (null for I) }], `lesson(L)` the lesson's names;
- `algebra()`: the algebra shown (`QMATH.algebra`: gens, basis, dim, label 'so(7)');
- `corner(c, L)`, `pick(raycaster)` -> { kind: 'brick', slot, k, name } | { kind: 'corner', code } | null, `NB` (10).

Building: the default network is built at load (about 130 ms in Node: its cut, 3D layout and geometry); another is
built when first asked for (a pause of a tenth of a second or so in explore; not between frames, which would stutter
in a headset), or all at once by `finish()` (the harness and the sweeps).

## For the narrator

- Each cut is one digit of every gene's code; genes sharing a code form a cell; the first cut is the most significant
  digit (q2). The real run used 8 cuts (256 cells, about 63 genes each); the picture uses 3.
- The cut shown is a stand-in for the authors' beam search (spectral grouping into equal cells, then the codes that
  keep the most coupling on cube edges; SPEC.md). On the planted networks it finds every group (the strong mixing one:
  98 % of genes).
- A_c = P A Pᵀ (P the normalized cell indicators), Sinkhorn-balanced; K = I - A_c. The share of coupling on cube
  edges: `analysis().cubeShare` here, 61 % in the real network.
- The bricks: any traffic table is a recipe of Pauli strings, the way a sound is a mix of pure tones; weights here are
  the example's; the real run's first weights (I 0.40, X1 0.20, X2X1 0.13 ...) belong in the small print.
- The residual is sqrt(1 - share inside) of the traceless part; 0 = nothing lost. Never present the 8-bit real run as a
  success.

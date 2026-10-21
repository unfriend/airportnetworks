# `tree` - from neighbourhoods to endotypes (file `sets/tree.js`)

The gene x term matrix (393 x 457, 4,717 ones) fills row by row; the dendrogram grows beside it (leaves at the rows,
root at the far left, curving towards you in 3D); a test pulse runs down the tree from the root: at a kept split
(`cut` 1) a green check pops and the rows part, at the first split inside an endotype a small dim red cross, and the
endotype's colour runs down its subtree and across its rows. Then the genes fly to positions by their tree distances,
and gather into the poster's metagraph: translucent bubbles on a ring (11 at the top), each with its genes and its
own links, grey bands between them as wide as the number of links, endotypes 0 and 7 loose below the ring.

Everything is read from `ENDO_DATA` (tree, cut, gene, seedOf, featN/featI, links, endo colours). All geometry is
built once; positions, colours and morphs are computed in the shaders from uniforms, so `update` sets only a few
dozen numbers a frame and allocates nothing.

## Params

| Param | Range | Meaning | Default |
| --- | --- | --- | --- |
| `tree_a` | 0..1 | fade (engine) | 1 |
| `tree_matrix` | 0..1 | the empty matrix appears (first 6 %), then a scan line fills it row by row; each row flashes as it fills | 1 |
| `tree_tree` | 0..1 | the dendrogram grows from the leaves (0) to the root and its trunk (1), a glow at the growing front | 1 |
| `tree_test` | 0..1 | the test pulse (see timings below); at 1 every split is decided, rows parted and coloured | 1 |
| `tree_mds` | 0..1 | genes fly (staggered, in an arc towards you) from their rows to their tree-distance spots; matrix and tree fade out by 0.55 | 0 |
| `tree_meta` | 0..1 | genes fly (from the rows or from the spots) into their bubbles; bubbles 0.3-0.85, bands grow in from both ends 0.45-0.95, links 0.55-1, names from 0.85 | 0 |
| `tree_focus` | 0..12 | id + 1 of the endotype in focus (0 none): it brightens and comes forward (rows 0.04, cluster 0.16, bubble 0.34 and towards the ring's centre, 16 % bigger), the others dim to about 30 %; cross-fades over 0.6 s of a running clock (shown at once when paused or after a seek) | 0 |

`tree_focus` is a step: key it with `jump` in the story and put it in explore's `STEP` set (eased values would
light the endotypes in between one after another).

Test timings in `tree_test` units (from `api().testTimes`): the 11 kept splits at 0.09, 0.17, 0.18, 0.25, 0.27,
0.36, 0.38, 0.44, 0.49, 0.52, 0.54; the refusals (endotype roots) at 0.36 (1, 2), 0.44 (10, 11), 0.51 (4, 9), 0.59
(6, 8), 0.66 (0, 3, 5, 7); each endotype's colour reaches its leaves 0.17 later and has crossed its rows 0.30 later
(all done by 0.96). The pulse starts on a short trunk left of the root (0 to 0.09).

Suggested story keys (chapters in `tools/endo/SPEC.md`):
- `hood` (148-185): crossfade in with `tree_matrix` 0, `tree_tree` 0, `tree_test` 0 (cam `matrix`); `tree_matrix`
  0 -> 1 over about 10 s.
- `split` (185-225): `tree_tree` 0 -> 1 over 6-8 s (cam `tree` or `default`); `tree_test` 0 -> 1 over about 18 s
  (cam `tree`, then `default` to see the rows coloured); `tree_mds` 0 -> 1 over 4-5 s (cam `mds`).
- `endotypes` (225-285): `tree_meta` 0 -> 1 over about 5 s (cam `meta`); then `jump('tree_focus', ...)` to 2, 10, 6,
  3 (endotypes 1, 9, 5, 2) with cams `e1`, `e9`, `e5`, `e2`; back to 0 (cam `meta`) before crossing to `syn`.

## Anchors

`matrix` (centre), `matrixTop`, `tree` (middle), `treeTop`, `root`, `kept` (the root's check), `refused` (the first
refusal: endotype 1's root), `scan` (the scan row at the leaves), `mds`, `mdsTop`, `meta` (ring centre), `metaLow`,
`focus` (the focused endotype where it is now, else the current view's centre), `e0`..`e11`: each endotype where it
is now (its rows -> its cluster -> its bubble, following `tree_mds` and `tree_meta`).

## Labels

"393 genes × 457 terms" (matrixTop), "Tree of genes" (treeTop), "Split kept · the two sides differ" (root, while the
test runs), "Split refused · too alike" (first refusal, while the test runs), "Tree distances · near in the tree,
near here" (mds), "12 endotypes" (meta, below the ring), and "id · name" for each endotype on its bubble (above; on
the lowest bubbles alternately below; loose ones below); unfocused names dim. All numbers come from `ENDO_DATA`.
At 1280 px wide nothing overlaps; on a 640 px screen the bottom of the ring gets crowded.

## Cam views

`default` (matrix and tree), `matrix`, `tree` (the tree a little from the side, so its curve shows), `mds`, `meta`,
`focus` (a getter: the focused endotype's view in the current phase, else the phase's view), and `e0`..`e11` (each
bubble in the metagraph, focused and forward; use these for story waypoints, since the getter reads the live state).

## Controls and explore

View: Matrix (the raw matrix, no tree, no colours) / Tree (the tree and the tests, replayed each time the view opens:
`tree_test` = (t - 0.8) / 9) / Distances / Endotypes. `explore` returns `tree_focus` 0; the focus in explore comes
from the API.

`api()` returns:
- `setFocus(id)`: 0..11 focuses that endotype over the param; -1 or null hands the focus back to `tree_focus`. **Call
  `setFocus(-1)` when leaving explore**, or the story's focus keys are ignored.
- `pick(raycaster)` (a `THREE.Raycaster` in world coordinates; or `pick(origin, dir)` in the set's local
  coordinates) -> `{ gene: index }` (module gene 0..392, = node index), `{ endo: id }`, or null. Matrix and leaves:
  the row's gene; the tree (inside an endotype's subtree): that endotype; distances and metagraph: a gene dot near
  the ray, else the cluster or bubble it passes through. While an endotype is in focus only its genes are picked.
- `focus()`, `genePos(i)`, `endoPos(k)` (local coordinates, current state), `bubble(k)` ({ c, r, base, r0, below }),
  `testTimes`, `order` (the column order of the terms), `bands` ([a, b, links]), `own` (links inside each endotype),
  `loose`, `kept` (11), `cells` (4,717), `endoRoots`, `name(i)`.

## Performance

9 draw calls, 32.7k triangles (bubbles 16.1k, bands 16.5k), 6,053 points (4,717 cells, 393 genes, 920 pulse points, 23
verdicts), 6,588 line segments (tree 6,287, links 301). Build 60-100 ms in headless Chromium (it includes the
layouts below). Everything additive, no depth writes; the bubbles and bands are double-sided.

## Notes for the engine and the narrator

- **The `mds` field of `ENDO_DATA` is not used.** It is degenerate: 287 of the 393 genes are at (0, 0, 0) after Int8
  rounding, with the two outlying genes of each endotype far out. A correct 3D classical MDS of this tree would not
  help either: it puts each endotype on one point and four endotypes (4, 6, 8, 9) on the same spot. The set
  computes its own positions from the tree at load: metric MDS (SMACOF) of the 12 endotypes by the height where their
  subtrees meet, then of each endotype's genes by their own tree distances, drawn at a third of the scale so the
  endotypes read as clusters. Say "genes close in the tree land close together"; do not quote distances or claim
  the picture is to scale.
- The verdicts: the pulse stops at the first refusal in each endotype (one cross per endotype); in the data every
  split inside an endotype is refused (`cut` 0). Fine to say: "the test keeps a split only when the two sides'
  terms differ; inside each endotype it refuses every split, so 11 kept splits give 12 endotypes". The test is a
  divergence test of the term distributions of the two sides (Tree2BreakSpace, Sakalli et al., in progress); do not
  name a specific statistic or p-values.
- The tree is drawn to agree with the authors' endotypes (illustrative, see `SPEC.md`); the heights inside an
  endotype are squeezed into the lower 55 %. Do not read biology from branch lengths.
- Matrix: rows are the module genes in tree order; columns are the 457 GO Cellular Component terms ordered by the
  mean row of their ones. The matrix shows the genes' own terms and their neighbourhoods' enriched terms (one matrix,
  as in the data).
- The bands are the module's links between two endotypes (53 pairs, 1 to 42 links), inside a bubble its own links
  (301 in all; none in 0 and 7, which float loose).

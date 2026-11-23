# `tree`: the family tree in 3D, its machines, and the species tree (file `sets/tree.js`)

Chapters 2, 5, 7 and 8 of the mutation story. The family tree (`MMATH.familyTree(seed, speed)`: three levels of splits,
eight tips, every mutation simulated exactly under the story's example model, `MMATH.DEFAULT`) grows from its root at
(0, -1, 0) as a level of change rises through the crown: heights are change, so a branch rises by its length in expected
swaps per letter (`tree.unit`, 1.6 per swap per letter at the story's speed) and the tips end at different heights. The
branches are glass tubes, thick at the root and thin towards the tips, with a soft glowing core, curving up and out in
all directions (`MMATH.curve`), so the tree is round, never flat: you walk round it and look up into it. The ancestor's
eight letters (`ACGTTAGC`, Figure 1's) stand in an arc round the root and ride up every branch as a small row of tiles;
where a mutation happens it flashes, the letter changes (framed white: it differs from the ancestor) and a band in the new
letter's colour stays on the branch. The tips show their sequences. Then a gear on every branch (one machine per branch,
turned as far as `MMATH.turnAngle` says for its length), packets flowing up through them and the tips writing new
sequences that follow the rule. The species tree (`MMATH.speciesTree()`, the poster's ((s1, s2), s3) with example
lengths) crossfades in with coupling gears (the double band) and a glass "?" at the root; the stems at its tips are the
`stem` set's (same frame). Everything is computed live from example numbers; nothing here is the poster's.

Rows of tiles turn round the vertical to face the viewer as one (the camera seen as the last frame was drawn, through an
empty probe mesh's `onBeforeRender`; per eye in a headset), so a sequence always reads left to right.

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `tree_a` | 1 | fade | in at 26-28, out at 58-60; in at 160-163, out at 178-180; in at 218-221 to the end |
| `tree_species` | 0 | 0 the family tree, 1 the species tree; in between a crossfade (a plain param: the engine eases it) | 0 in chapters 2 and 5; 1 from 218 (set while `tree_a` is 0, or crossfade 218-220) |
| `tree_grow` | 1 | the level of change rising from the root past the highest tip (0 nothing, 1 all grown); a thin green ring marks it while it rises. Growth fronts glow; rows ride at the fronts; mutation flashes follow it | 0 at 26; 0 -> 1 at 30-50; 0 -> 1 again at 218-224 for the species tree |
| `tree_seq` | 1 | the letters: the ancestor's arc at the root, the rows riding up, the tips' rows | 1 |
| `tree_hi` | 0 | lights the long and the short branch (`tree.highlight`: for seed 1, branch 10, 0.47 swaps per letter, 4 swaps, and branch 7, 0.15, 1 swap) in green, dims the rest, and measures each one's rise: a dashed line out at the parent's height, a solid one up to the child, ticks at both ends | 0 -> 1 at 50-53, -> 0 at 58 |
| `tree_gears` | 0 | a gear on every branch (at a third of its way up, the branch its axle), winding up to its turn (2.4 x `turnAngle(len)`); coupling gears (the double band) on the species tree | 0 -> 1 at 163-166; on the species tree 0 -> 1 at 221-224 |
| `tree_flow` | 0 | the machines run: packets rise through the grown branches (a bead every 1.1 of height, rising 0.55 a second, by `t`), the gears turn on (faster on longer branches), and each tip's row shows the last packet's sequence (each letter read out from row `parent` of P(len) along the way, `MMATH.sample`, seeded by packet, branch and tree), lighting up as it arrives | 0 -> 1 at 168-170, -> 0 at 178; 0 -> 1 at 266-270 |
| `tree_q` | 0 | the glass "?" at the species tree's root (the unknown ancestor; it pulses) | 0 -> 1 at 219-222; 1 -> 0 at 248-251 (as the stem set's true ancestor comes) |
| `tree_seed` | 1 | which family tree (any integer from 1). **Step param** | 1 in the story |
| `tree_speed` | 1 | how fast letters change: index into [0.5, 1, 2, 4] (a factor on every branch length; it changes the mutations, not the drawing). **Step param** | 1 in the story |
| `tree_pick` | -1 | a picked branch (0..13, -1 none): lit cyan with its rise measured, its gear lit; the others dim. **Step param** | -1 in the story |

The resting look (defaults): the story's family tree fully grown, with its letters.

## Anchors

`root` (0, -1, 0), `below` (under the root's letters: the ancestor's tag), `crown` (the top of the crown, on the axis),
`level` (where the rising ring is, at its right edge), `long`, `short` (the middles of the two highlighted branches),
`pick` (the picked branch's middle), `gear` (beside the first branch's gear), `tips` (above the highest tip),
`tip0` .. `tip7` (above each tip, by tip index), `q` (above the species tree's root), `n1` (its inner node), `sgear`
(above the coupling gear of its branch to s1), `s1`, `s2`, `s3` (the species' tips, where the stem set stands their
stems). All family-tree anchors follow the tree on show (functions).

## Labels

- `Ancestor · ACGTTAGC` (cyan, at `below`): while the tree grows, not with the highlight or a pick;
- `Descendants · their sequences today` (at `tips`): once grown, not with the highlight, gears or a pick;
- `0.47 swaps per letter · 4 swaps here` and `0.15 swaps per letter · 1 swap here` (green, at `long` and `short`;
  text is a function of the tree on show): with `tree_hi`;
- `Branch 5 · 0.16 swaps per letter · 4 swaps` (cyan, at `pick`; a function): with a pick;
- `One machine per branch` (cyan, at `gear`): with the family tree's gears, not with a pick;
- `Coupling gears · one per branch` (cyan, at `sgear`): with the species tree's gears, until the machines run or the
  stem set's fields come (it reads `S.stem_fields`);
- `? · their shared ancestor` (amber, at `q`): with `tree_q`.

## Cam views `[az, el, dist, tx, ty, tz]` (target in the set's frame)

| View | Value | For |
| --- | --- | --- |
| `default` | [24, 12, 5.0, 0, -0.02, 0] | the whole family tree (chapter 2 once grown) |
| `grow` | [18, 5, 4.6, 0, -0.32, 0] | from low, as it grows (chapter 2, 26-48) |
| `crown` | [30, 30, 4.5, 0, 0.42, 0] | the crown and the tips' sequences from above |
| `pair` | [47, 14, 4.6, 0.29, 0.3, -0.15] | the long and the short branch side by side (computed for seed 1: across the line between them, aimed a little right of their middle for the tags) |
| `long`, `short` | [-24, 12, 2.4, -0.53, 0.38, 0.74], [142, 12, 2.4, 0.7, 0.23, -0.59] | close on each (computed) |
| `gears` | [28, 14, 3.9, 0, -0.28, 0] | the machines on the lower branches (chapter 5, 163-180) |
| `stand` | [20, 0, 1.5, 0, 0.15, 0] | **the headset view**: `xrPlace` scales it to 0.76 m a unit, so the tree (2.06 units with its letters) stands about 1.6 m tall, its root about 1.1 m below the eyes (about half a metre above the floor) and its crown up to half a metre above them: you stand at its edge and look up into it. Turned any way, nothing of a grown tree (trees 1 to 5) comes within 0.36 m of your eyes. The story eases into it while the family tree is the scene (chapter 2, the machines of chapter 5), its axis a little further off (the engine's `standView`: 0.44 m at the closest). On a screen it is a close crop of the crown |
| `up` | [200, -62, 2.2, 0, 0.3, 0.05] | from below the root, looking up through the tree into the crown (screens; in a headset it tips the tree 62 degrees, so prefer `stand` there) |
| `species` | [18, 16, 3.9, 0, -0.42, 0.1] | the species tree with its stems (chapter 7, 218-232) |
| `what` | [8, 14, 4.3, 0.16, -0.36, 0] | the species tree, its machines running, the stems (chapter 8) |

The stem set's `fields` and `compare` views frame chapter 7's later beats with the species tree in them.

## Explore

Controls: View (Family tree / Machines / Species tree), Tree (1 to 5: `tree_seed`), Letters change (Slowly / As in the
story / Twice as fast / Four times: `tree_speed` 0..3), Machines (Still / Running: `tree_flow`, not for the plain family
tree). `explore(c)` returns every `tree_` param (grown, letters on, no highlight, no pick; the species view with its
"?"). The Tree tab drives `tree_seed`, `tree_speed`, `tree_pick` and `tree_flow` itself; the Stem tab shows this set
with `tree_species` 1 and `tree_q` 0 once the true ancestor shows.

`api()`:
- `speeds` ([0.5, 1, 2, 4]), `model` ('uneven');
- `tree()` (the family tree on show: `MMATH.familyTree`'s object), `species()`, `highlight()` ({ long, short });
- `branch(b, species)` -> { b, species, depth, len, from, to (the sequences at its ends), swaps, muts: [{ at, site
  (1-based), from, to (letters) }], turn (`MMATH.turnAngle`), angles (`MMATH.angles`: the circuit's 12 angles at that
  length) };
- `pick(raycaster)` -> { kind: 'branch', b, species } (the tree on show, branches as far as grown) or null;
- `mid(b, species)` (a branch's middle, for a label or the headset's tip), `tips()` ([{ tip, seq, pos }]).

## Sizes for framing

Family tree (seed 1): root (0, -1, 0); the ancestor's arc at y -1.06, radius 0.25; tips from y 0.26 to 0.94 (rows of
tiles to about 1.02); widest radius 1.18 (rows reach about 1.3). Species tree: root (0, -1, 0), n1 (-0.36, -0.6, -0.21),
s1 (-0.78, -0.28, 0.45), s2 (0, -0.12, -0.9), s3 (0.78, -0.28, 0.45); the stems on its tips reach y 0.35.

## Performance (headless Chromium, software GL)

Build 17-37 ms warm, about 90 ms on a cold page (the look's glyph atlas and gear geometry); another seed builds in 3 to
12 ms when first asked for (kept for the last six). Draw calls 6 to 8 (family and species branches 1 each, tiles,
tubes, balls, halos, rings, glass, gears 2; empty pools cost none). Triangles: 14k (species tree) to about 87k (family
tree with gears, packets and highlight; at most about 95k with every row riding). Points: under 25 (halos). Nothing is
allocated per frame except label texts; a packet's sequences are written into a small ring of arrays (every 2 s).

## For the narrator

- Heights are change: a branch's rise is its length, the expected number of swaps per letter, which grows with time.
  The long branch (0.47) had 4 swaps here and the short one (0.15) 1: chance can give more or fewer, the length is the
  expectation (MMATH picks a long branch whose count is near what its length leads one to expect).
- The mutations are simulated with the story's example rates (exact Markov jumps, seeded): example numbers, as in the
  authors' test.
- One machine per branch: each gear is the circuit for its branch, turned further on longer branches; the steps are the
  same on every branch, only the angles change with the length (Enes). While the machines run, each packet carries the
  ancestor's letters up and the tips are read out: new sequences that follow the rule.
- The species tree's lengths are examples; its stems are Figure 5's; the "?" is the ancestor to rebuild.

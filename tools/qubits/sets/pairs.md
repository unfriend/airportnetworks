# `pairs`: genes, pairs, the map, two walkers, the chip (file `sets/pairs.js`)

Chapters 1 to 3 of the qubits story: why pairs (the grid of all pairs growing), the network as a city map with two
walkers settling in valleys, a chip with three qubits and the map folding into eight neighborhoods with three-digit
codes. The map is the story's example network (`QMATH.DEFAULT`, "Uneven groups": 320 genes, 5,637 links) laid out
flat; its neighborhoods are the cells of its found cut (`QMATH.analyze(QMATH.DEFAULT, { L: 3 })`), placed on a ring in
Gray-code order (000, 001, 011, 010, 110, 111, 101, 100: neighbors on the ring differ in one digit).

## Params (all 0..1 unless said)

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `pairs_a` | 1 | fade | in at 0, out at the cut chapter (90-93) |
| `pairs_genes` | 1 | the grid's genes (dots on its diagonal) | 0 -> 1 at 1-3 |
| `pairs_grid` | 0 | the grid of pairs grows: genes n = 6 x 40^grid (6 to 240), pairs n(n-1)/2; the spacing shrinks so it fills the view | 0 -> 1 at 6-24 |
| `pairs_map` | 1 | the city map (ground, streets, street lights); the grid fades as it comes | 0 -> 1 at 30-34 |
| `pairs_walk` | 1 | two walkers (magenta, cyan) wander the streets with short trails (by `t`) | 0 -> 1 at 35-37; -> 0 at 62-65 |
| `pairs_valley` | 1 | the valleys dip and glow amber (two, on opposite sides of the map) | 0 -> 1 at 44-48; -> 0 at 62-65 |
| `pairs_settle` | 0 | the walkers settle in the valleys; an amber arc joins them (the pair) | 0 -> 1 at 52-58; -> 0 at 62 |
| `pairs_chip` | 0 | the chip with three qubits beside the map (qubits twinkle; with a code picked they show its bits) | 0 -> 1 at 64-68 |
| `pairs_fold` | 0 | the map folds into the eight neighborhoods (rings in the cells' colors, code labels) | 0 -> 1 at 72-80 |
| `pairs_code` | 0 | 0 none, k = 1..8: neighborhood k-1 lights up, its code shows on the chip (bright qubit = 1) and an arc joins them. A step param (do not ease) | 1, 2, ... 8 every ~1.2 s at 80-89, then 0 |

The resting look (defaults): the map with walkers and valleys.

## Anchors

`tri` (the grid's center), `genes0` (its first gene), `corner` (above its top-left corner: the count label), `map`
(the map's center, y = -0.3), `walker0`, `walker1` (functions), `valley0`, `valley1`, `chip`, `q2`, `q1`, `q0` (the
qubits; q2 left, q0 right, as a code's digits read), `hood0` .. `hood7` (beside each neighborhood, by code).

## Labels

- the grid's count: `"240 genes · 28,680 pairs"` (text is a function of the grid: see SPEC.md, labels);
- `Walker 1`, `Walker 2` (minor) while they wander; `Valley · illustrative` while the valleys show and the map is flat;
- `Three qubits` (` · 011` with a code picked: text is a function);
- the codes `000` .. `111` at the neighborhoods once folded (the others dim while one is picked).

## Cam views

`default`/`map` (oblique over the map), `grid` (face on to the grid), `walkers` (closer, the valleys), `chip` (map and
chip), `hoods` (from above, the folded ring and the chip).

## Explore

Control View: Pairs / Map / Walkers / Neighborhoods. Walkers settle after 4 s (`c.t`); Neighborhoods cycles the codes
(1.6 s each). `api()`: `{ genes, links, codes, hood(c) (its [x, z] on the map), nmax }`.

## For the narrator

- Say: some diseases appear only when two genes are broken together; with n genes there are n(n-1)/2 pairs (16,064
  genes in the real network give 129,018,016: "about 129 million", computed by `QMATH.pairs`).
- The walkers stand for the two genes of a pair (H = K + c V + rho R: K = I - A_c lets them move along the network,
  V rewards pairs, R the exchange operator; always R, never SWAP). The valleys are **illustrative**: no data, no gene
  names; the label says so. Do not say where real valleys are.
- Three qubits tell 2^3 = 8 places apart; each neighborhood's code is like a postcode.

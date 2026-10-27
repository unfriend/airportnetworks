# `letters`: a text in four letters, and letters as qubits (file `sets/letters.js`)

Chapters 1 (`title`) and 3 (`qubits`) of the mutation story. A DNA double helix of 24 base pairs turns slowly (rungs in
the letters' colours, A–T and C–G; B-DNA's 10.5 pairs a turn, the strands 140 degrees apart for the grooves); eight
letters of its top strand peel away and straighten into a row of tiles, Figure 1's ancestor `ACGTTAGC`
(`MUT_DATA.fig1`); two copies slide out of it and in each two letters swap with a flash: the tile turns over, shows its
new letter and stays framed white (copy 1: T→C at 5, A→G at 6; copy 2: G→A at 3, C→T at 8, from
`MUT_DATA.fig1.swaps`). Then the ancestor's first tile comes forward and opens into its two qubits (glass spheres,
arrow up for 0, down for 1); the four codes in turn; the arrows tilt into a mix (by default the rule's mix at point 2,
`MMATH.path(uneven, A, POINTS[1])`) and the tile turns into a grey `?` with a ring in four colours (the mix's shares);
then the read-outs: the arrows spin like a coin, land on a letter, a small tile pops out of the big one and falls onto
its pile; four piles, one per letter, grow as tall as the chances. Every number is computed live (`MMATH.path`,
`MMATH.bloch`, `MMATH.sample` by index). The 16 helix letters outside the row are seeded filler (illustrative).

Frame: centred on the origin, the story facing +z; the helix runs along x.

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `letters_a` | 1 | fade | in at 0 (with the title), out at 25-27; in again at 60-62, out at 95-97 |
| `letters_helix` | 1 | the helix (both strands, rungs, backbones); it turns by `t` | 1 at 0; -> 0 at 11-14 |
| `letters_peel` | 0 | the ancestor's eight letters grow out of their rungs as tiles, peel away one after another (a zipper) and line up as a row with its strand behind | 0 -> 1 at 6-11 |
| `letters_copy1` | 0 | copy 1 slides out of the ancestor's row (down, left and forward), a dashed green trace behind it | 0 -> 1 at 13-15 |
| `letters_mut1` | 0 | copy 1's two swaps: the first over 0-0.5, the second over 0.5-1 (flip, flash, ring, white frame) | 0 -> 1 at 15-18 |
| `letters_copy2` | 0 | copy 2 slides out (further down, right and forward) | 0 -> 1 at 18.5-20.5 |
| `letters_mut2` | 0 | copy 2's two swaps, as copy 1's | 0 -> 1 at 20.5-23.5 |
| `letters_open` | 0 | the ancestor's first tile (A) comes forward and grows (0-0.45), the rows fade (0.05-0.5), the two qubits open out of it (0.35-1) | 0 -> 1 at 62-66 |
| `letters_code` | 0 | 0..3: the code shown, A `\|00⟩`, C `\|01⟩`, G `\|10⟩`, T `\|11⟩` (the tile turns over, each arrow flips on its own). **Step param** (the set eases the switch in 0.6 s itself) | 0 at 66, 1 at 69, 2 at 72, 3 at 75, 0 at 78 |
| `letters_mix` | 0 | 0 the pure code, 1 the mix: the arrows tilt (amplitudes blended), the tile turns into `?` with its ring of four shares | 0 -> 1 at 79-82 |
| `letters_target` | 0 | the mix: 0 the rule's mix after `letters_time` from the code's letter (the story's model, `uneven`), 1 the even mix (a quarter each). **Step param** | 0 |
| `letters_time` | 0.45 (`POINTS[1]`) | the branch length for the rule's mix (swaps per letter, 0..3) | fixed in the story |
| `letters_reads` | 0 | how many read-outs (0..400, continuous: read-out k plays while it runs from k - 1 to k: spin 0-0.36, the arrows land on the letter read 0.3-0.46, the tile pops 0.36-0.56 and falls onto its pile 0.46-0.95, the arrows return to the mix 0.62-0.95) | 0 -> 4 at 84-88, -> 24 at 88-94 |
| `letters_seed` | 1 | which read-outs come out (`MMATH.sample(p, seed, k)`). **Step param** (explore: read again) | 1 |

Step params for the engine's `STEP`: `letters_code`, `letters_target`, `letters_seed`.

The resting look (defaults): the helix turning.

Piles: tiles lie flat, one column while there are at most 30 read-outs (the story), then 2 x 2, 3 x 3 and 4 x 4 a layer
(up to 120, 270, 400), so a pile stays under about 0.6 tall; they jump to the wider footprint when a threshold is passed.
With seed 1 the story's 24 read-outs of the mix at point 2 (A 71 %, C 5 %, G 19 %, T 6 %) give A 17, C 1, G 4, T 1.

## Anchors

`helix` (above its left part), `centre`, `ancestor`, `copy1`, `copy2` (above each row's first tile: their labels sit
there), `ancMid`, `copy1Mid`, `copy2Mid` (each row's middle), `swap1`, `swap2` (the first swapped tile of each copy),
`tile` (right of the big tile; a function), `qubit1`, `qubit2` (under each sphere; functions), `piles` (in front of the
four), `pileA`, `pileC`, `pileG`, `pileT` (above each pile's top; functions).

## Labels

| Label | At | Shows while |
| --- | --- | --- |
| `DNA · two strands of letter pairs` (cyan) | `helix` | the helix is in and before the peel (`helix` x (1 - prog(peel, 0, 0.3))) |
| `Ancestor` | `ancestor` | the row has lined up (peel 0.85-1), until the tile comes forward |
| `Copy 1 · T→C, A→G` (green; from `MUT_DATA`) | `copy1` | copy 1 is out and its swaps begin |
| `Copy 2 · G→A, C→T` (green) | `copy2` | likewise |
| `\|00⟩ · A` ... (cyan; text a function: the code shown), `A mix · of all four letters` once mixed | `tile` | the qubits are open (open 0.6-1) |
| `First qubit`, `Second qubit` | `qubit1`, `qubit2` | the qubits are open and before the read-outs |
| `A · 17`, `C · 1`, `G · 4`, `T · 1` (text a function: the counts) | `pileA` ... | read-outs have begun |

At most seven at once (the qubit labels give way to the pile labels).

## Cam views

| View | `[az, el, dist, tx, ty, tz]` | Beat |
| --- | --- | --- |
| `default` | `[0, 9, 3.5, 0, 0.05, 0]` | the helix, face on (0-6) |
| `helix` | `[-26, 14, 3.0, 0, 0, 0]` | the helix from the left, its grooves (an alternative for 0-6) |
| `peel` | `[8, 12, 3.4, 0, 0.18, 0.05]` | the strand peeling (6-12) |
| `rows` | `[12, 10, 3.7, 0, 0.04, 0.12]` | the ancestor and its two copies (13-26; 60-62) |
| `qubits` | `[0, 6, 2.9, 0, 0.2, 0.3]` | the tile and its two qubits, the codes and the mix (62-83) |
| `reads` | `[0, 12, 3.95, 0, -0.14, 0.35]` | the qubits and the piles below (83-96) |

Sizes for framing: the helix x ±1.2, y and z ±0.31; the rows x -0.95..1.0, y -0.53..0.61, z -0.12..0.6; the tile and
qubits x ±0.67, y -0.36..0.78 (z 0.3); the piles x ±0.83, y -1.05..about -0.45, z 0.3..0.7.

## Explore

Controls: View (Helix / Copies / Qubits), Letter or mix (A / C / G / T / Even / The rule's mix; Qubits only), Branch
length (0.15 / 0.45 / 1 / 1.6; for the rule's mix). `explore(c)` also reads `c.reads` (how many read-outs: the engine's
Letters tab adds 1 or 100, up to 400, and sets it back to 0 when the letter or mix changes) and `c.seed` (read again),
and `c.time` as any number (a slider). The rule's mix starts from A.

`api()`:
- `READ_MAX` (400);
- `mix()`: the four chances shown now; `counts()`: the piles now ([A, C, G, T]); `reads()`: read-outs finished;
- `chances(mix, time)`: the chances for a choice (`'A'` .. `'T'`, `'even'`, `'rule'` with its branch length), for the
  chances in words; `bloch(mix)`: its two arrows (`MMATH.bloch`, six numbers).

## For the narrator

- Figure 1's letters and swaps exactly; the helix's other letters are filler. The copies are drawn falling away from
  the ancestor like a family in the making (chapter 2's tree takes it up).
- `|01⟩` means first 0, then 1: the left sphere is the first qubit.
- At point 2 the arrows are 0.978 long, barely shorter than the sphere: the two qubits hardly depend on each other in
  this mix (say "shorter when they depend on each other" in general, not of this picture).
- The read-outs are chance: the piles grow roughly as tall as the chances, not exactly.

## Performance

Build about 6-17 ms in the harness (software GL). 2-7 draw calls. Triangles: the helix about 37k (its 48 backbone and
48 rung-end balls are most of it); 400 read-outs about 89k (the piles' tiles); the qubits about 5.6k. Nothing is
allocated per frame (pools refilled; up to 400 `MMATH.sample` calls a frame for the piles).

# `stem`: letters that work together, and rebuilding the ancestor (file `sets/stem.js`)

Chapters 6, 7 and 8 of the mutation story, in the `tree` set's frame. Chapter 6 at the origin (the tree hidden): an RNA
strand folds back on itself into a stem, a ladder of six pairs twisted as RNA stems are (11 pairs a turn) with its loop
on top and white rungs; one letter changes alone and its rung snaps (a red cross, the stem bulging there); the coupling
comes (a coupling gear over the pair, its double band along the rung) and the pair changes both letters at once and
holds; beside it the count: a pair's 16 combinations, three letters' 64, ten letters' 1,048,576 ("about a million"),
against 20 qubits, two per letter. Chapter 7 with the species tree: the three species' stems at its tips (Figure 5), three
fields of 2,000 rebuilt ancestors in front of the root, and the true ancestor big at the root beside the three rebuilt
examples.

The close-up's stem is the coupled example's fully paired one (Figure 5's `rebuilt.coupled`, GTTACT / TGATGA), its loop
GAAA (a common four-letter RNA loop; the poster gives none): the strand reads `GTTACTGAAAAGTAGT`, 5' to 3'. Pair 5 (top
C, bottom G) is the one that breaks (C becomes A alone) and that changes together (C-G to T-A). T stands for RNA's U, as
on the poster (the text says so). Species, truth and examples come from `MUT_DATA.test`; the fields from
`MMATH.crowd` (the authors' shares, exactly 200, 400 and 860 of 2,000 intact) or `MMATH.rebuild` (this example, live).

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `stem_a` | 1 | fade | in at 180-182; out at 216-218 and in again at 221-223 (the close-up's params jump while it is out) to the end |
| `stem_strand` | 1 | the close-up's strand: its 16 tiles pop in left to right with the backbone; 0 hides the close-up | 0 -> 1 at 181-185; 0 from 218 |
| `stem_fold` | 1 | 0 a straight row, to 0.55 a hairpin folding round its loop, to 1 the twisted stem (pair 5 square to the story's view); rungs from 0.75 | 0 -> 1 at 186-192 |
| `stem_break` | 0 | pair 5's top letter flips C -> A at 0.5 (a flash, framed white), its rung pulls back into two stubs (0.5-0.75), a red cross (0.55-0.85), the stem bulges there; back to 0 heals it | 0 -> 1 at 194-197, 1 -> 0 at 200-201 |
| `stem_couple` | 0 | the coupling gear over pair 5 (the double band along the rung), winding in | 0 -> 1 at 201-203 |
| `stem_both` | 0 | pair 5 changes both letters at once at 0.5 (C -> T, G -> A, framed white, a flash), the gear turns half round, the rung lights cyan: it holds | 0 -> 1 at 204-206 |
| `stem_count` | 0 | 0..3: to 1 the 4 x 4 square of tile pairs beside the stem (the six matching pairs lit, the rest dim); 1 -> 2 it grows back into a 4 x 4 x 4 cube of blocks (the third letter); 2 -> 3 the cube bursts into a vast cloud of 60,000 points in the letters' colours, behind | 0 -> 1 at 208-210, -> 2 at 211-212.5, -> 3 at 213-215 |
| `stem_qubits` | 0 | a row of 20 qubits under it all (two per letter, each pair holding a letter's mix: `MMATH.path` at the story's points, `MMATH.bloch`), appearing left to right | 0 -> 1 at 214-216 |
| `stem_species` | 0 | the three species' stems on the species tree's tips, small, upright, facing the viewer, broken pairs as red crosses; letters that differ from the true ancestor framed white as `stem_truth` comes | 0 -> 1 at 224-229 |
| `stem_fields` | 0 | three fields of 2,000 tiny stems sprout in front of the root (left to right: letter by letter, exact pair model, coupled circuit), each at its own moment: lit in the letters' colours when all six pairs hold, dim with its broken rungs red otherwise, so each field's share lights up as it grows; dark beds under them | 0 -> 1 at 232-242; -> 0 at 264-266 |
| `stem_named` | 3 | how many fields' tags show, left to right (0.5: the first tag half in): they come as the narrator names each field | 0 -> 1 at 236, -> 2 at 239, -> 3 at 242 (each over 0.6 s) |
| `stem_sort` | 0 | the stems whose six pairs all hold walk to the front rows of their field (in their random order): a lit block whose depth is the share | 0 -> 1 at 243-246 |
| `stem_truth` | 0 | the true ancestor's stem, big at the root (in front of the species tree's "?", which the story fades with `tree_q`), its one broken pair | 0 -> 1 at 249-252 |
| `stem_examples` | 0 | one rebuilt ancestor per method stands before its field (Figure 5's in the story; the most likely one, `best`, live), letters that differ from the truth framed white; the fields dim a little | 0 -> 1 at 253-257; -> 0 at 264-266 |
| `stem_src` | 0 | 0 the authors' test (their shares, Figure 5's examples), 1 this example computed live (`MMATH.rebuild` with `stem_w` and `stem_seed`). **Step param** | 0 in the story |
| `stem_w` | 8 | the pair favour w, 1 to 30 (live only: the authors' test is w = 8). **Step param** | 8 |
| `stem_seed` | 1 | the rebuild's seed (which 2,000 ancestors; also the crowd's shuffle). **Step param** | 1 |
| `stem_method` | -1 | a method lit, the other fields dimmed: index into `MMATH.METHODS` (0 indep, 1 coupled, 2 exact), -1 all. **Step param** | the fields left to right as the narrator names each: 0 at 236, 2 at 239, 1 at 242; -1 at 245 |

The resting look (defaults): the folded stem at the origin, alone.

## Anchors

Close-up: `stem` (0, 0, 0), `loop` (above its loop), `top` (right of the stem's upper half: its tag), `brk` (right of pair
5's right letter; a function), `gear` (beside the coupling gear; a function). Count: `square` (above the square's left
corner), `cube`, `cloud` (above the cloud's left part), `qubits` (under the row's left end). Chapter 7: `sp1`, `sp2`,
`sp3` (above each species' stem), `field_indep`, `field_exact`, `field_coupled` (behind the outer fields' left corners,
before the middle field's, so three tags never touch), `ex_indep`, `ex_exact`, `ex_coupled` (left above each example),
`truth` (beside the true ancestor's top), `root` (0, -1, 0).

## Labels

- `A stem · six pairs and a loop` (at `top`): once folded, until the break, the coupling or the count;
- `Pair broken · C became A alone` (amber, at `brk`): with `stem_break`, not once both letters changed;
- `Coupled · both letters change together` (cyan, at `gear`): as the gear comes, until both change;
- `C–G became T–A · the pair holds` (cyan, at `gear`): with `stem_both`;
- `16 combinations · a pair of letters`, `64 combinations · three letters` (cyan), `About a million · ten letters:
  1,048,576` (amber), each in its stretch of `stem_count` (all from `MMATH.combos`); `20 qubits · two per letter, for all
  ten` (green, `MMATH.qubits(10)`) with `stem_qubits`;
- `Species 1 · 2 broken pairs`, `Species 2 · 3 broken pairs`, `Species 3 · 2 broken pairs` (from `MMATH.brokenPairs`):
  with `stem_species`, until the fields come;
- per field (text is a function): `Letter by letter · 10 % intact`, `Exact pair model · 20 % intact`, `Coupled circuit ·
  43 % intact` (the authors' test: `MUT_DATA.test.intact`), or live `Letter by letter · 11 % here`, `Exact pair model ·
  30 % here`, `Coupling, our stand-in · 46 % here` (`MMATH.rebuild`'s share); each as `stem_named` reaches its field;
  dimmed for a method not lit; they give way to the examples;
- `True ancestor · 1 broken pair` (amber, at `truth`): with `stem_truth`;
- per example (a function): `Letter by letter · 2 broken`, `Exact pair model · 1 broken`, `Coupled circuit · none
  broken` (Figure 5's; live, the most likely ancestors' counts): with `stem_examples`.

## Cam views `[az, el, dist, tx, ty, tz]`

| View | Value | For |
| --- | --- | --- |
| `default` | [16, 6, 3.4, 0, 0, 0] | the folded stem (chapter 6) |
| `strand` | [0, 4, 4.4, 0, 0.1, 0] | the straight strand (2.25 wide) and the fold (181-192) |
| `fold` | [14, 8, 3.2, 0, 0.02, 0] | the stem a little closer |
| `break` | [24, 6, 2.3, 0.12, 0.12, 0] | close on pair 5: the break, the coupling, both letters (194-207) |
| `count` | [-12, 10, 5.4, 0.85, -0.1, -0.15] | the stem, the square, the cube and the qubits (208-213) |
| `cloud` | [-10, 12, 8.4, 1.0, 0, -1.4] | the cloud of a million and the qubits (213-217) |
| `species` | [18, 16, 3.9, 0, -0.38, 0.1] | the species tree and its stems (224-232; as the tree's) |
| `fields` | [0, 30, 4.6, 0, -0.95, 1.15] | the three fields growing, from in front (232-248) |
| `compare` | [0, 27, 4.7, 0.14, -0.5, 0.9] | the true ancestor and the three examples before their fields (249-264): high enough that the middle example stands below the truth, not over it |
| `what` | [8, 14, 4.3, 0.16, -0.36, 0] | the species tree, its machines, the stems (chapter 8; as the tree's) |

In a headset at the default size the close-up stem (1.2 units) stands about 0.45 m tall at `default`, 0.6 m at `break`.

## Explore

Controls: View (Stem: the coupled pair holding / Count: the square, cube, cloud and qubits / Rebuild: the species' stems
and the fields / Compare: sorted fields, the truth and the examples), Numbers (The authors' test / This example:
`stem_src`), Pair favour (1 / 4 / 8 / 16 / 30: `stem_w`, live only), Method (All three / Letter by letter / Exact /
Coupling: `stem_method`). Rebuild and Compare want the tree set with `tree_species` 1 (Compare: `tree_q` 0). The Stem tab
drives `stem_seed` (rebuild again) itself.

`api()`:
- `methods` (the fields' order: ['indep', 'exact', 'coupled']), `names`, `namesLive` (the coupled one is "Coupling, our
  stand-in" live), `strand` ('GTTACTGAAAAGTAGT'), `loop`, `pair` (4: pair 5, 0-based), `truth`, `species`
  (`MUT_DATA.test`'s), `count` ({ pair: 16, three: 64, ten: 1048576, qubits: 20 });
- `results(src, w, seed)` (defaults: what shows) -> per method { share, intact, n, expected (live: the exact chance that
  all six match under that method; null for the authors' test), best: { top, bottom }, broken };
- `pick(raycaster)` -> { kind: 'field', method } (where the ray meets a field's floor), { kind: 'stem', which: 'truth' |
  'indep' | 'exact' | 'coupled' | 's1' | 's2' | 's3' }, or null.

Live numbers (the story's model, w = 8, seed 1, as `node tools/mutation/test-mmath.mjs` prints them): letter by letter
10.9 % intact (exact chance 11.4 %), exact pair model 30.0 % (31.0 %), coupled stand-in 46.1 % (44.6 %); most likely ancestors ATTACT / CGATGG (1 broken), ATTACT / TGATGA and
ATTACT / TGATGG (none broken).

## Sizes for framing

Close-up: the strand 2.25 wide at y 0; the folded stem x within +-0.3, y from -0.58 (pair 1) to 0.56 (the loop), pair 5 at
y 0.08. Count: the square centred (1.18, 0.1, 0), 0.8 across; the cube back to z -0.7; the cloud centred (1.2, 0.2, -2.7),
reaching about 2.8 to the sides, 1.5 up and down, 2.4 deep; the qubit row at y -0.88, z 0.3, x -0.35 to 2.35. Chapter 7:
species stems on the tips (bases y -0.23 and -0.07), 0.55 tall; fields at y -1, x -1.73 to 1.73 (each 1.02 wide, 0.7
deep, centred z 1.2); examples at z 1.8, 0.65 tall; the truth at (0, -0.99, 0.2), up to y -0.1.

## Performance (headless Chromium, software GL)

Build 30-60 ms (the 60,000-point cloud and the 6,000 field quads included); live rebuilds for another w or seed take a
few ms each and refill the fields' attributes once. Draw calls 2 (the folded stem) to 8 (the count); with the tree in
chapter 7, 8 to 10 together. Triangles: 3.6k (the stem) to 51k (the count with 20 qubits); chapter 7 about 21k, with the
tree about 35k-46k. Points: 60,000 in the cloud's beat. The fields are one instanced quad each (12k triangles for all
three), each tiny ladder drawn in its shader and turned to the camera per eye. Nothing is allocated per frame except
label texts.

## For the narrator

- The stem shown is the coupled example's (all six pairs hold); its loop letters are illustrative. A pair holds as A-T,
  C-G or G-T (both ways round); one letter changing alone breaks it; with coupling both letters may change at once and
  changes that keep a pair are more likely (eight times, in the authors' example) [3].
- The count: 4 combinations per linked letter, 16 for a pair, 4^10 = 1,048,576 for ten; qubits need two per letter, 20.
- The fields in the story are the authors' test: 10 %, 20 % and 43 % of 2,000 rebuilt ancestors with all six pairs
  matching; which stems are intact and their broken pairs are drawn from our example's posterior (`MMATH.crowd`):
  illustrative, the shares are the poster's. Say "in the authors' test". The coupled circuit favours pairs too strongly:
  its ancestors look believable, its percentages are not true chances. Never call it better or more accurate.
- The true ancestor has one broken pair (pair 6, T-C): normal, since only about a quarter of ancestors have all six
  (Enes). The examples are Figure 5's (letter by letter 2 broken, exact 1, coupled none); white frames mark letters that
  differ from the truth.
- Live (explore), the coupled method is our stand-in for the authors' circuit (`MMATH.Pcoupled`), and says so.

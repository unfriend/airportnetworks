# The mutation machine: 3D sets, maths and engine spec

The fourteenth story of the app: `stories/mutation.js`, built from `tools/mutation/` like the qubits story is built from
`tools/qubits/`. It follows the poster **"Converting Mutation into a Machinery: DNA Substitution Models as Quantum
Circuits"** by **Enes Berk Sakalli** (Ludwig Boltzmann Institute for Network Medicine at the University of Vienna) and
**Arndt von Haeseler** (Center for Integrative Bioinformatics Vienna (CIBIV), Max Perutz Labs, University of Vienna and
Medical University of Vienna); a draft of 26 Oct 2026, not in the repository. What it says is summed up below; nothing
else from it is needed.

Card (`HOST.list`): key `mutation`, kick "DNA substitution models as quantum circuits", title **The mutation machine**,
colour `#4d8dff`, desc "DNA changes letter by letter as it is copied. A rule for those changes becomes a machine of
gears on a quantum computer, one per branch of a family tree, and pairs of letters that change together are coupled.",
page "The mutation machine: DNA's changes as a quantum circuit", brand "The mutation machine", sub "DNA's changes as a
quantum circuit", aria "Interactive 3D story of how DNA letters change along a family tree and how a quantum circuit
models it, from a rule of change to an RNA stem", thing `machine`, loading "Winding up the gears", len from pacing.
Credit (the last chapter's small print, explore's About or the equivalent, the docs): Enes Berk Sakalli and Arndt von
Haeseler, with their institutes as above.

Decisions (the owner's and the author's, 27 Oct 2026):
- **Example numbers throughout**, as in the authors' own test (Enes: "for a test of the method these example numbers
  are fine, but for a real result they should be estimated from real sequences"). Every number about the examples is
  computed live by `MMATH`; the poster's own numbers (`MUT_DATA`) appear only as "in the authors' test". Never invent a
  number; label anything illustrative so.
- **The result's wording** (Enes): a mismatched pair in the true ancestor is normal (allowed, only rarer; only about a
  quarter of ancestors have all six pairs matched). With coupling 43 % of the rebuilt ancestors have all pairs matched,
  without 10 %; the exact calculation gives 20 %, so the coupled model favours matching pairs **too strongly**: it gives
  believable ancestors, but its percentages should not be read as true probabilities. Never say the circuit is "better"
  or "more accurate".
- **The turn** (Enes): on each branch the circuit first copies the parent's letter onto the child, then turns the
  child's state by single-qubit rotations plus two-qubit steps that make the turn depend on the parent's letter; how
  far each step turns depends only on the branch length, and the sequence of steps is the same on every branch.
- **The family tree is properly 3D** (the owner's wish): not a flat diagram but a tree that grows up, its branches
  spreading in all directions, their lengths real lengths, so you look up into it and walk round it.
- **No 2D graphs** (the owner's rule, AGENTS.md "Conventions"): no bar charts, the result is three fields of rebuilt
  stems, the mix is a point in a pyramid, read-outs pile up as tiles (a pile in passing is fine).
- **British spelling** (colour, favour, tumour, centre, grey). English only. T stands for RNA's U, as on the poster
  (say so once).
- No patient data (the test is synthetic). The poster's pictures are never shown; its figures are redrawn in 3D.

**The rules for sets are the tour's**: `tools/lbi/SPEC.md` from the top down to "Palette and look", and
`tools/lbi/kit.js`, with these differences (as the qubits story's, `tools/qubits/SPEC.md`):
- Set files live in `tools/mutation/sets/`; the harness is `tools/mutation/harness.html` (`?set=<name>&p=k:v,...&t=..&
  cam=<view or six numbers>&anim=1`) and the screenshot tool `tools/mutation/shot.mjs` (run it from `tools/mutation`;
  `SHOTS=<dir>` and `PORT=<port>`). The harness loads `MMATH`, `MUT_DATA` and `MLOOK` before the set.
- Three shared globals come before the sets (the build pastes them inside the story's closure in this order): `MMATH`
  (`sets/mmath.js`, the maths; also a Node module, checked by `node tools/mutation/test-mmath.mjs`), `MUT_DATA`
  (`sets/data.js`, the poster's numbers, typed in) and `MLOOK` (`sets/look.js`, the story's look: the qubits story's
  lit instanced tubes, rings, balls, boxes and halos, plus letter tiles, arrowheads, qubit spheres and gears).
- **Labels may have `text` as a function** returning `[bold, rest]` (the engine re-reads it while the label shows).
- **Step params** (integers, never eased; list each in the set's manifest so the engine puts it in `STEP`).
- A set may export `api()` for explore (live numbers, picking) and `finish()` if it builds in slices.
- Budget per set: build under 250 ms in headless Chromium (software GL), at most 20 draw calls and 150k triangles at
  any moment, no allocation per frame in `update` (refill pools). Seeking must work: what a set shows depends only on
  its params and `t` (live read-outs and mutations are seeded by index, not by frame).

## Look

The app's dark, glowing, lit 3D (the tour's light over the left shoulder, rim glow). The poster's colours, which are
the Okabe-Ito palette, a little brighter where the dark needs it:
- letters: **A** `#e69f00` (orange), **C** `#56b4e9` (sky blue), **G** `#f0e442` (yellow), **T** `#cc79a7` (pink);
  tiles are rounded blocks in the letter's colour with the letter in dark ink on both faces; a white thick frame marks
  a letter that differs (the poster's thick frame);
- gears and the machine: blue `#0072b2` with bright rims `#4fb0ff`; time and branch length: green `#009e73`
  (`#3fd6a6` where it must glow);
- a pair that holds: a white rung; a broken pair: a red `#ff5a4b` cross where the rung would be;
- qubits: glass spheres with an equator ring, a faint vertical axis, 0 at the top and 1 at the bottom, an arrow from
  the centre (its length the Bloch vector's length, shorter when two qubits depend on each other);
- the app's accents for highlights (cyan `#46d9ff`), labels as the other stories'.

Frames (y up, the story faces +z, 1 unit about 0.5 m in a headset at the default size): `letters` and `rule` centred
on the origin within about ±1.3; `tree` and `stem` share one frame: the tree's root at (0, −1, 0), its crown up to
y ≈ 1.2 within a radius of about 1.2; the stem's close-up (chapter 6) stands at the origin while the tree is hidden.

## The poster, in short (what the story tells)

1. **What is a mutation?** DNA is a text in four letters; when it is copied a letter is sometimes swapped (a
   mutation). Over many copies this forms a family tree; a branch joins a parent to a child; its branch length is the
   expected number of swaps per letter, which grows with time. Figure 1: the ancestor `ACGTTAGC`, descendant 1
   `ACGTCGGC` (T→C, A→G), descendant 2 `ACATTAGT` (G→A, C→T). Each letter is stored in two qubits (arrows on spheres,
   up 0, down 1): A = |00⟩, C = |01⟩, G = |10⟩, T = |11⟩; |01⟩ means first 0, then 1. Two qubits can hold a
   superposition, a mix of all four letters, like a spinning coin; reading it makes it land on one letter.
2. **Substitution models: a dynamical system.** A substitution model is a rule for how letters change over time; the
   most general standard one (GTR) sets how readily each pair of letters swaps and how common each letter is in the
   long run. The chances of the four letters form a mix, a point in a triangular pyramid (the simplex) whose corners
   are the pure letters; over time the rule moves the mix along a path (from corner A to the long-run mix, points 1 to
   3 on the way).
3. **Method.** A compiler translates the dynamical system into a quantum circuit for one branch: copy the parent's
   letter, turn to the predicted mix (the branch length sets how far it turns), join: one machine per branch. Reading
   the child generates sequences under the model.
4. **Result.** An RNA stem forms where a strand folds back on itself; the returning half pairs with the outgoing half
   (A–T, C–G or G–T) and holds the shape; if one letter changes alone, the pair breaks. Coupling: on every branch,
   beside the turn, a part acts on both positions together, following a pair model in which changes that keep a pair
   are more likely and both letters may change at once. Pair models exist, but each linked letter multiplies the
   combinations by four (16 for a pair, about a million for ten); qubits hold them compactly, two per letter (20 for
   ten). Test: a synthetic 6-pair stem in three species; 2,000 reconstructed ancestors per method; all six pairs intact
   in 43 % with coupling, 10 % with independent positions, 20 % with the exact pair model.
5. **Conclusion.** The circuit represents a substitution model and generates sequences under it; coupling paired
   positions changes reconstructed pairing in the synthetic example. Scope: one position or pair at a time. Why it
   matters: rebuilding ancestors is how researchers recreate old virus proteins for vaccines [4, 5] and trace how a
   tumour grew from an ancestral cancer cell [6]; trees trace viruses [1]; the model matters [2]; pair models [3].

## The poster's numbers: `MUT_DATA` (`sets/data.js`, typed in; use exactly, and only as "in the authors' test")

- `poster`: title, authors and institutes (above), the six references, shortened: [1] Hadfield et al., Nextstrain,
  Bioinformatics 2018; [2] Arenas and Posada, Curr HIV Res 2010; [3] Schöniger and von Haeseler, Mol Phylogenet Evol
  1994; [4] Doria-Rose et al., J Virol 2005; [5] Rolland et al., J Virol 2007; [6] Li et al., Oncogene 2026.
- `fig1`: `{ ancestor: 'ACGTTAGC', d1: 'ACGTCGGC', d2: 'ACATTAGT' }`.
- `test` (Figure 5; a stem drawn as two rows: `top` the outgoing half 5' to 3', left to right; `bottom` the returning
  half under it, so `top[i]` pairs with `bottom[i]`; the loop is at the right end):
  - `species`: s1 `ATTACT` / `CGATAG` (pairs 1 and 5 broken), s2 `ATTACT` / `CTTTGA` (1, 2, 3 broken), s3 `GTTACT` /
    `TGAGGC` (4 and 6 broken);
  - the tree: ((s1, s2), s3), the root the ancestor;
  - `truth` `GTTACT` / `TGATGC` (pair 6 broken: "the true ancestor has one broken pair");
  - `rebuilt` (one example each): independent `ATTACT` / `CGATGC` (1 and 6 broken), circuit with coupling `GTTACT` /
    `TGATGA` (none broken), exact pair model `ATTACT` / `CGATGA` (1 broken);
  - `n` 2000 per method, `pairs` 6, `w` 8 (matching pairs eight times as likely as mismatched ones), `intact`
    `{ indep: 0.10, coupled: 0.43, exact: 0.20 }`, and the author's "only about a quarter of ancestors have all six pairs
    matched" (`allSixPrior: 'about a quarter'`, words only).
- `pairsOk`: A–T, C–G, G–T, both ways round.

## The maths: `MMATH` (`sets/mmath.js`; checked by `node tools/mutation/test-mmath.mjs`)

Plain JavaScript, no allocation in hot paths that run every frame (`path` and `bloch` are called per frame: give them an
`out` argument). Letters are indices 0..3 for A, C, G, T; a letter's qubits are its two bits, the first qubit the high
bit (A 00, C 01, G 10, T 11). Seeded random numbers (`rng(seed)`, as the kit's).

- **Models** (`MODELS`, `DEFAULT = 'uneven'`): `even` "All swaps alike" (equal rates and shares, JC69), `transitions`
  "A↔G and C↔T faster" (K80-like, κ = 4, equal shares), `uneven` "The story's example" (GTR: exchangeabilities, for
  example AC 1.0, AG 3.6, AT 0.7, CG 1.1, CT 4.2, GT 0.9; long-run shares A 0.32, C 0.18, G 0.24, T 0.26: A the most
  common, as on the poster's picture). Each `{ key, name, note, r: [AC, AG, AT, CG, CT, GT], pi: [4] }`.
- `Q(model)` → 4×4 rate matrix (Float64Array(16), row i to column j), scaled so that the mean rate Σ πᵢ(−Qᵢᵢ) = 1: then a
  branch length is the expected number of swaps per letter, as on the poster. `P(model, t)` → e^(Qt) by the symmetric
  eigen-decomposition of Π^½ Q Π^−½ (Jacobi), cached per model; rows sum to 1, all entries ≥ 0, `P(0)` = I, P(s)P(t) =
  P(s + t), πP = π.
- `path(model, start, t, out)` → the mix p(t) = e_start P(t) (4 numbers). `T_PATH = 1.6` (how far the story's path
  runs) and `POINTS = [t1, t2, t3]` (points 1 to 3 on the way, for example 0.15, 0.45, 1.0).
- **The pyramid**: `CORNERS` (a regular tetrahedron of edge 1.6 centred on the origin, A at the top, C, G, T round
  the base, C at the front left, G at the back, T at the front right: three numbers each) and `simplex(p, out)` → the
  point Σ pᵢ CORNERᵢ.
- **Qubits**: `amps(p)` → the four amplitudes √pᵢ; `bloch(p, out)` → the two qubits' Bloch vectors from the reduced
  density matrices of the state Σ √pᵢ |i⟩ (six numbers: x, y, z for the first, then the second; y is always 0; length
  1 for a pure letter, shorter when the qubits depend on each other); `sample(p, seed, k)` → the k-th read-out (a letter
  index, deterministic in seed and k).
- **The circuit for one branch** (four wires, top to bottom: the parent's p1, p0, the child's c1, c0):
  `circuit(model, t)` → `{ wires: ['p1', 'p0', 'c1', 'c0'], gates }` with gates in order: `{ type: 'CNOT', ctrl: 'p1',
  tgt: 'c1' }`, `{ type: 'CNOT', ctrl: 'p0', tgt: 'c0' }` (the copy), then the turn: `{ type: 'MRY', tgt: 'c1', ctrls:
  ['p1', 'p0'], thetas: [4] }` (a rotation of c1 about y by an angle that depends on the parent's letter) and `{ type:
  'MRY', tgt: 'c0', ctrls: ['p1', 'p0', 'c1'], thetas: [8] }`. The angles are chosen so that, for every parent letter
  i, the child ends in Σⱼ √Pᵢⱼ(t) |j⟩ with non-negative amplitudes, starting from the copy |i⟩: so all angles are 0 at
  t = 0 and grow with the branch length (the gear "turns as far as the branch is long"). `decompose(gate)` → the same
  gate as single-qubit RY turns and CNOTs (a uniformly controlled rotation with k controls: 2^k RY and 2^k CNOT, the
  standard Gray-code construction), so the story can say what "a few simple steps that each rotate one qubit, plus
  steps that link two qubits" are. `simulate(model, t, parent)` → the child's read-out chances from a 4-qubit
  state-vector run of `circuit` (and of its decomposition): must equal row `parent` of `P(t)`. `turnAngle(model, t)` →
  one number for the gears (the mean |θ| of the turn's angles), 0 at t = 0, growing with t.
- **Trees**: nodes `{ id, parent (−1 at the root), len (expected swaps per letter), kids, pos: [x, y, z], depth,
  tip (index or −1), seq }`.
  - `familyTree(seed = 1, speed = 1)` → `{ nodes, branches, root }`: the root's sequence `MUT_DATA.fig1.ancestor` if
    the data is loaded (else `ACGTTAGC`), three levels of splits (8 tips, 14 branches; seeded lengths from about 0.05 to
    0.6 times `speed`), every branch's mutations simulated exactly under the story's model (`muts: [{ at (0..1 along
    the branch), site, from, to }]`, in order) and every node's sequence after them. The **3D layout**: the root at
    (0, −1, 0); a child sits above its parent by `len × 1.6` (heights are change, so tips end at different heights)
    and out from it in a direction that turns round the vertical (the first split along one axis, each deeper split
    turned by the golden angle from its parent's, so the crown is round and full, never in a plane), farther out the
    deeper it is; the crown fits a radius of about 1.2 and y ≤ 1.2. `curve(tree, branch, u, out)` → a point on the
    branch's smooth curve (it leaves the parent upwards, bends outwards and arrives nearly upright: a real tree's
    shape), for drawing and for riding along it.
  - `speciesTree()` → the poster's ((s1, s2), s3) with example branch lengths (for example root→n1 0.25, n1→s1 0.2,
    n1→s2 0.3, root→s3 0.45), laid out the same way (the three tips spread round the vertical, not in a line); the tips'
    stems are `MUT_DATA.test.species`.
- **Pairs**: `ok(x, y)` (A–T, C–G, G–T, both ways), `pairState(x, y)` = 4x + y (0..15). `pairModel(model, w = 8, dbl =
  0.1)` → a reversible 16-state rate matrix: long-run share π_xy ∝ π_x π_y m(xy) with m = w for a matching pair and 1
  otherwise; one letter changing: rate r_xx' π_x' √(m(x'y)/m(xy)); both at once: dbl · r_xx' r_yy' π_x' π_y'
  √(m(x'y')/m(xy)) (detailed balance holds by construction); scaled so the expected number of letter changes per
  letter per unit time is 1 at the long-run mix. `Ppair(model, w, t)` → e^(Q t) (16×16, symmetric eigen-decomposition
  again). `Pindep(model, t)` → P(t) ⊗ P(t). `Pcoupled(model, w, t)` → **our stand-in for the authors' coupled circuit**
  (said so wherever it shows): the independent turn followed by a coupling that weights each resulting pair by m and
  normalises each row (so every branch favours matching pairs w times, however short it is: too strongly, by design,
  as the authors found of theirs). `allSixPrior(model, w)` → the long-run chance that all six pairs match (π of matching
  pairs to the sixth power).
- **Rebuilding the ancestor** on `speciesTree()` from `MUT_DATA.test.species`: `rebuild(method ('indep' | 'coupled' |
  'exact'), { model, w = 8, n = 2000, seed })` → per pair the posterior over the 16 root states (Felsenstein's pruning
  with that method's 16×16 transition matrix on every branch; the root's prior the method's long-run mix), `n` ancestors
  sampled from it (seeded; `samples`: Uint8Array(n × 6) of pair states), `intact` (how many have all six pairs
  matching), `share` (intact / n), `expected` (the exact chance of all six matching under that method: the product over
  pairs), `best` (the most likely ancestor, pair by pair, as two strings `top` and `bottom`). Cached by its arguments.
  `crowd(method, share, n, seed)` → n samples with exactly round(share × n) intact, the rest drawn from that method's
  samples with at least one broken pair (for showing the authors' shares with plausible broken pairs).
- `combos(k)` → 4^k for k linked letters (16 for a pair, 64 for three, 1,048,576 for ten) and `qubits(k)` → 2k.

The example values are free (Enes: example numbers), but choose them so the example tells the poster's story in the
same direction: in this example the exact share is somewhere near a fifth to a third, letter by letter lower, our
coupled stand-in higher. Say in the file's header which values were chosen and why; never tune them to hit the
poster's numbers exactly (the story shows the poster's numbers as the poster's).

Tests (`test-mmath.mjs`, under a second): P(t) rows sum to 1, non-negative, P(0) = I, semigroup, πP = π, mean rate 1;
the path starts at the corner and ends near π; `bloch` of a pure letter gives the codes (up/down) and length 1; the
circuit's simulation (and its decomposition's) equals P(t) for every parent and several t, all angles 0 at t = 0; the
pair model reversible (detailed balance), its π matches π_x π_y m / Z, rows sum to 0; Ppair at w = 1 with dbl = 0 equals
Pindep; Figure 5's broken pairs exactly as listed above by `ok`; `rebuild` deterministic for a seed, `share` within
3 % of `expected` for n = 2000, and the order indep < exact < coupled in this example; the family tree seeded, 8 tips,
its layout within the crown's bounds and not flat (the tips' spread in z at least half that in x).

## The look: `MLOOK(K, set)` (`sets/look.js`)

The qubits story's pools unchanged in use (`tubes`, `rings`, `balls`, `boxes`, `halos`; `begin()`, `add(...)`,
`end()`, `.mesh`; `depth()`), plus:
- `LETTERS` `'ACGT'`, `LCOL` (the four colours as numbers), `BLUE` (gears), `RIM`, `GREEN`, `RED`, `INK`, `GREY`, `mix`.
- `tiles(max)`: letter tiles, instanced, a texture atlas of A, C, G, T and ? (both faces readable: the letter is not
  mirrored on the back); `add(p, q (a quaternion, or null to face the camera), size, letter (0..3, 4 for ?), alpha,
  frame (0..1: the white thick frame), glow)`.
- `cones(max)`: arrowheads, `add(base, dir, length, radius, colour, alpha)`.
- `qubit(pools, centre, R, bloch3, alpha, opts)`: draws one qubit sphere from the pools (a glass ball, the equator
  ring, a faint axis, 0 and 1 marks, the arrow as a tube and a cone), so every set draws qubits alike.
- `gears(max)`: the machine's gear (a toothed ring of blades round a hub with a dot in a circle, as the poster's),
  instanced, `add(centre, axis, R, angle, colour, alpha)`; `coupling` look: a gear with a double band across it (the
  poster's "a pair's two letters" symbol) via `add(..., { pair: true })` or a second pool.
- A header that says what it is (the mutation story's look, from the qubits story's), British spelling in comments.

## The sets (each with a manifest `sets/<name>.md`: params, keyframes, anchors, labels, views, explore)

The chapters below say what each must show; the set builder names the params (prefix `<set>_`), writes the manifest,
and checks the set alone with the harness.

- **`letters`** (chapters 1 and 3): a DNA double helix of about 24 base pairs (rungs in the letters' colours, A–T and
  C–G), turning; one strand peels away and straightens into a row of eight tiles `ACGTTAGC`; a copy of the row slides
  out and, in it, letters swap with a flash (T→C at 5, A→G at 6: the poster's descendant 1; then the second copy's G→A
  at 3, C→T at 8). Then one tile comes forward and opens into its two qubits; the four codes in turn (a step param:
  the tile's letter and both arrows flip, `|00⟩` ... `|11⟩` as labels); the arrows tilt into a superposition (the mix
  the rule reaches at point 2: `MMATH.path(uneven, A, POINTS[1])`); read-outs (a count param): the arrows spin like a
  coin, a small tile pops out with the read letter (`MMATH.sample`, by index) and flies to its pile; four small piles,
  one per letter, grow (in passing; the piles' heights follow the chances). Explore: pick a letter or a mix (A, C, G,
  T, even, the rule's mix at a branch length), read out 1 or 100 more.
- **`tree`** (chapters 2, 5, 7, 8): the family tree in 3D (`MMATH.familyTree`) and the poster's species tree
  (`MMATH.speciesTree`), a step param switching between them with a crossfade. Branches are smooth glass tubes (thicker
  at the base, thinner towards the tips, a soft inner glow) that grow from the root upwards depth by depth; the
  ancestor's eight tiles sit round the root; as the tree grows, a glowing bead (or the eight-letter row, small) rides
  up each branch and, where a mutation happens (`muts[].at`), flashes and changes the letter; each tip shows its
  sequence as a row of small tiles facing the viewer (changed letters framed white). A param highlights a long and a
  short branch (their lengths as tags: "0.52 swaps per letter"). Chapter 5: a gear appears at each branch's start (one
  machine per branch), turning by its branch's `turnAngle`, and sequences flow up through them to the tips. Chapter 7:
  the species tree with coupling gears (the double-band look) on its four branches and a glass "?" at the root (the
  stems at its tips are the `stem` set's: the tips' positions come from `MMATH.speciesTree()`). The whole tree stays in
  the shared frame; no spin of its own (the camera turns round it). Explore: a new tree (seed), how fast letters change
  (a factor on the lengths), pick a branch (click or ray: its length, its mutations, its gear's turn), run the machines.
- **`rule`** (chapters 4 and 5): four letter balls at the pyramid's corners (`MMATH.CORNERS`), sized by the long-run
  share, joined both ways by curved arrows as thick as the rate from one letter to the other (`Q`); then the pyramid
  forms (glass faces, glowing edges, each corner a tile with its code |00⟩ ...), the balls shrink into the corners; the
  mix as a glowing point with a small ring in four colours (the mix's shares) starts at corner A and glides along its
  path (`path`, t from 0 to `T_PATH`, a trail behind it, points 1, 2, 3 marked, the long-run mix a ring it settles
  towards). Chapter 5: the pyramid drops into the compiler (a squat drum with a gear on its face) and out comes the
  machine for one branch: the parent's tile on the left; the copy (a press stamps the parent's letter onto the child:
  the child's two qubits take the parent's arrows); the turn (the child's two qubits sit inside two gears that turn as
  a green branch-length dial goes from short to long; the arrows tilt as `bloch` of the child's mix; a small copy of the
  pyramid beside it shows the child's mix moving along the same path); and the circuit itself, in 3D like the qubits
  story's: four wires, the two copy gates, the two turn blocks with their control dots, the angles as tags, pulses
  running along the wires. Step params: the model (0 even, 1 transitions, 2 uneven), the start letter, the parent
  letter; plain params for the branch length. Explore: the model, the start letter, the branch length (the point moves,
  the machine turns, the circuit's angles change), the parent letter, show the circuit's simple steps (`decompose`).
- **`stem`** (chapters 6, 7, 8; in the tree's frame): chapter 6, at the origin: a strand of letters (`GTTACT`, four
  loop letters, then `AGTAGT` read back: the coupled example's fully paired stem) folds back on itself into a stem: a
  twisted ladder (RNA stems are helices: an A-form twist, about 11 pairs a turn) standing upright, the loop at the top,
  white rungs between pairs; one letter changes alone (for example top 5 C→A) and its rung snaps (a red cross, the stem
  bulges there); the coupling appears (the double band on a pair's two letters) and a pair changes both letters at once
  (G–C to A–T, say) and holds; beside it the count: a pair's 16 combinations as a 4×4 square of small tile pairs
  (matching ones lit), three letters' 64 as a cube, ten letters' about a million as a vast soft cloud of points (about
  60k drawn), against a row of 20 small qubit spheres (two per letter). Chapter 7: the three species' stems at the
  species tree's tips (small, upright, broken rungs as red crosses as in Figure 5), the true ancestor hidden at first;
  then the rebuild: three fields of 2,000 tiny stems each sprout in front of the root (one field per method, labelled
  letter by letter, circuit with coupling, exact pair model), each tiny stem a small ladder of six rungs; stems with all
  six pairs glow in the letters' colours, the others are dim with their broken rungs red; the share in each field lights
  up as it grows (from `MUT_DATA.test.intact` in the story: `MMATH.crowd`; from `MMATH.rebuild` live in explore, a step
  param choosing); then the true ancestor's stem appears big at the root with its one broken pair, beside the three
  rebuilt examples of Figure 5 (letters that differ from the truth framed white). Explore (with the tree): the method
  highlighted, the pair favour w (1 to 30, default 8), the source (the authors' test or this example, live), rebuild
  again (seed).

Sizes for framing go in each manifest, with views (`cam`, `[az, el, dist, tx, ty, tz]`) for every chapter's beat. For
the tree, a close view frames it large: in a headset (`xrPlace`: the view's target lands 1.2 m ahead, 0.2 m below the
eyes; scale grows as the view's distance shrinks) it should stand about 1.6 m tall with its root low and its crown
above your eyes, so you look up into it; give a view `up` from near the root looking up into the crown too.

## The engine (`tools/mutation/engine/`, adapted from the qubits story's)

Copied from `tools/qubits/engine/` as a start. Rename everything: `HOST.register('mutation', ...)`, the header comment
(the poster, its authors, example numbers), `audio/narration-mutation.mp3`, `SET_ORDER = ['letters', 'tree', 'rule',
'stem']`; remove the qubits story's own code (`QMATH`, `QUBITS_DATA`, its panes); `FACTS` from `MUT_DATA` and `MMATH`.
Keep the shared lines identical (the headset code, the shared-room hooks, the slideshow, `fitTitle`, the landing
screen: see "Shared rooms" and "Inside a story" in AGENTS.md; no life-size or room mode in this story). Keep labels
whose `text` is a function, the step params (`STEP`), `finish()`. **British spelling** in every word this story shows
(the qubits story's own text is American: change what you keep of it).

**Chapters** (about 4:50 of story time before pacing; `CH` keys and times; the first key is `title`, as the shared
title-arc lines expect). Every chapter: one or two plain sentences first, then the technical layer in smaller print.
Numbers from `FACTS`, none hard-coded. The text below is a draft: keep its meaning and its plainness, shorten freely.

1. `title` 0-26, **A text in four letters** (`letters`): the helix, the row, a copy with mutations. "DNA is a text
   written in four letters: A, C, G and T. Every time it is copied, now and then a letter is swapped for another. That
   is a mutation." Small print: the poster, its authors; "the numbers here are examples, as in the authors' test". The
   title card (The mutation machine, its sub) can open it.
2. `tree` 26-60, **A family tree** (`tree`, the family tree): the root, the branches growing in 3D with letters riding
   up and mutations flashing, the tips; a long and a short branch. "Copied over many generations, one text becomes
   many: a family tree. Where two branches part lived a shared ancestor. A branch's length says how much changed along
   it: the expected number of swaps per letter, which grows with time." Small print: trees like this trace viruses as
   they spread [1] and how a tumour grew [6]; the rule for how letters change matters [2].
3. `qubits` 60-96, **Letters as qubits** (`letters`): the two qubits, the four codes, the tilt, the read-outs. "A
   quantum computer can hold each letter in two qubits, drawn as arrows on spheres: up is 0, down is 1. A is 00, C is
   01, G is 10 and T is 11. Tilt the arrows and the two qubits hold a mix of all four letters at once, like a spinning
   coin. Reading them out makes the coin land on one letter, each with its own chance." Small print: |01⟩ means first
   0, then 1; arrows shorter than the sphere: the two qubits depend on each other.
4. `rule` 96-134, **The rule** (`rule`): balls and arrows, the pyramid, the path. "A substitution model is the rule for
   how letters change: how readily each letter swaps for another (thicker arrows) and how common each is in the long
   run (bigger balls). Every mix of the four letters is a point in this pyramid, the pure letters at its corners. Start
   at A, and as time goes on the rule moves the mix along a path towards the long-run mix." Small print: the most
   general standard rule is GTR; p(t) = p(0) e^(Qt): a dynamical system; the rates are examples.
5. `machine` 134-180, **The machine** (`rule`, then `tree` with gears): the compiler, copy, turn, the circuit, one
   machine per branch. "A compiler turns the rule into a quantum circuit: a machine of gears for one branch. It copies
   the parent's letter onto the child, then turns the child's qubits: the longer the branch, the further they turn,
   and the child's mix lands where the rule's path is at that time. One machine per branch, joined into the tree; read
   at the tips, it writes new sequences that follow the rule." Small print (Enes): the copy is two CNOT gates; the turn
   is a few rotations of single qubits and steps that link two qubits, so it depends on the parent's letter; the angles
   depend only on the branch length, the steps are the same on every branch.
6. `pairs` 180-218, **Letters that work together** (`stem`, close-up): the fold, a pair breaking, the coupling, the
   count. "Letters often act together. An RNA strand folds back on itself into a stem, held by pairs: A with T, C with
   G, G with T. If one letter changes alone, its pair breaks. Coupling lets the two letters of a pair change together,
   so the pair holds. Models of pairs exist, but each linked letter multiplies the combinations by four: 16 for a pair,
   about a million for ten. Qubits need only two per letter: 20 for ten." Small print: T stands for RNA's U here, as on
   the poster; on every branch the coupling acts on both letters of a pair beside the turn: changes that keep a pair
   are more likely (eight times, in the authors' example), and both letters may change at once [3].
7. `rebuild` 218-264, **Rebuilding the ancestor** (`tree` species tree + `stem`): the species' stems, the "?", three
   fields of 2,000, the shares, the true ancestor. "Three species carry the same stem, each changed in its own way. What
   did their shared ancestor have? Rebuild it 2,000 times with each method and count the ancestors whose six pairs all
   hold. Letter by letter: 10 %. With the coupled circuit: 43 %. The exact pair calculation: 20 %. So the coupling
   favours pairs too strongly: its ancestors look believable, but its percentages are not true chances. And a broken
   pair is normal: the true ancestor here has one, and only about a quarter of ancestors have all six." Small print:
   the authors' test: a made-up six-pair stem in three species, 2,000 rebuilt ancestors per method.
8. `what` 264-290, **What it is for** (the species tree, its machines, the stems): "Rebuilding ancestors is how
   researchers brought back old virus proteins for vaccine research [4, 5] and trace how a tumour grew from one cancer
   cell [6]. This circuit turns a rule of letter change into a machine a quantum computer can run, and couples letters
   that change together." Small print: for now one letter or one pair at a time, on simulated data; for real results
   the numbers would be estimated from real sequences. Credits (both authors, their institutes) and the references.

**Explore mode** tabs (HTML and canvas twins, as every story):
- **Letters**: a letter or a mix (A, C, G, T, Even, The rule's mix at a branch length), its two qubits, read out 1 or
  100 (the piles), the chances in words.
- **Rule**: the model (three), the start letter, the branch length (0 to 2); the pyramid's path; the machine for one
  branch (parent letter, the gears, the circuit's angles live; the simple steps on request).
- **Tree**: a new tree, how fast letters change, pick a branch (its length, mutations, its gear), run the machines.
- **Stem**: the three methods (letter by letter, coupling: our stand-in, exact pair model), the pair favour w, the
  source (the authors' test, or this example computed live: its shares and `expected`), rebuild again; the true
  ancestor and the rebuilt examples.
- **Scenes**: Letters (`letters`), Tree (`tree`), Rule and machine (`rule`), Stem (`stem`), with their controls.

Suggested hashes: `#mutation&t=100`, `#mutation&explore&tab=letters&mix=G`, `#mutation&explore&tab=rule&model=even&
start=C&time=0.8`, `#mutation&explore&tab=tree&seed=3&speed=2&branch=5`, `#mutation&explore&tab=stem&src=live&w=20`,
`#mutation&explore&scene=tree&view=up`. `collab.state()`: the tab, the scene, every scene's controls, the mix, the
model, the start and parent letters, the branch length (to 0.01), the tree's seed and speed, the picked branch, the
method, w, the source, the rebuild seed (never the camera, read-out animations, or anything per device; `apply(state())`
gives `state()` back; the shell's `FORMAT` goes up with a new story).

## Testing

- `node tools/mutation/test-mmath.mjs` (the maths).
- A set alone: `node shot.mjs <set> "<query>|..." <prefix> 640 400` from `tools/mutation` (serve the repository root).
- `node tools/mutation/build.mjs --check`; the story: `sweep.mjs`, then the smoke test (once the story is in
  `HOST.list` and the smoke test knows it).

# The qubits story: 3D sets, maths and engine spec

The eleventh story of the app: `stories/qubits.js`, built from `tools/qubits/` like the microanatomy story is built from
`tools/micro/`. It explains, step by step, how a large gene network is compressed onto a handful of qubits and how the
compressed network breaks down into simple building blocks (Pauli strings), after **Joel Hancock**'s brief for this
visualization ("Prompt: visualize network compression and the Pauli decomposition", 21 Oct 2026; not in the
repository), his figures (the Pauli strings on a cube; the 3-qubit condensation card) and his notes on the runs.

Card: kick "Quantum network compression", title **Three qubits**, tagline "how a gene network fits on a tiny quantum
computer", color `#7d74ff`. Story key `qubits`. Credit: Joel Hancock (the method and the figures it follows) wherever
the other stories credit their authors (the last chapter's small print, explore's About or the equivalent,
`docs/data-and-permissions.md`, HANDOVER's story table).

Decisions (the owner's and Joel's):
- **Example networks throughout** (no STRING data, no gene names). Joel: "it is not strictly necessary to use the real
  STRING ... it could just use example networks throughout rather than compute the bisection on the real PPI."
- **No data D and no Walsh-Hadamard step** (the brief's step 6 is out of scope); the Lie-algebra (DLA) part stays. The
  potential V appears only as the valleys of the walkers' map, labelled illustrative.
- **American spelling in this story only** (normalized, color, signaling, gray, neighborhood, center), as the brief
  asks; everything else in the app stays British (say so in AGENTS.md).
- **Never invent a number.** The example networks' numbers are computed live (QMATH); the real run's numbers
  (`QUBITS_DATA`) appear only where the text says "in the real network"; anything else illustrative is labelled so.
  Never imply the 8-bit compression fits the algebra well.
- Conventions: H = K + c V + ρ R, K = I − A_c, R the exchange operator (always R, never SWAP); Pauli subscripts are
  qubit indices, q2 the most significant bit (the first bisection); signs solid +, dashed −; red +1, blue −1.

**The rules for sets are the tour's**: `tools/lbi/SPEC.md` from the top down to "Palette and look", and
`tools/lbi/kit.js`, with these differences:
- Set files live in `tools/qubits/sets/`; the harness is `tools/qubits/harness.html` (the same query syntax; `cam=` a
  view by name or six numbers) and the screenshot tool `tools/qubits/shot.mjs` (run it from `tools/qubits`; `SHOTS=<dir>`
  and `PORT=<port>`; shots go to `tools/qubits/shots/` by default, ignored by git).
- Three shared globals come before the sets (the build pastes them inside the story's closure in this order):
  `QMATH` (`sets/qmath.js`, the maths), `QUBITS_DATA` (`sets/data.js`, the real run's numbers, typed in) and `QLOOK`
  (`sets/look.js`, the story's lit instanced tubes, rings, balls, boxes and halos). The harness always loads them.
- **Labels may have `text` as a function** returning `[bold, rest]` (the gallery's weights and the circuit's angles
  follow the network or source shown; the grid's count grows). The engine must re-read such a text while the label
  shows and redraw it when it changes (the HTML label and the headset's sprite: drop the sprite so it is made again);
  plain arrays work as before. The harness does this.
- **Step params** (integers: never eased, put them in the engine's `STEP` set): `cube_net`, `cube_cut`,
  `cube_algebra`, `cube_focus`, `chart_src`, `pairs_code`. The sets ease their own switches where it matters (the
  cube's values, 0.35 s; a seek or the first frame shows the new state at once).
- The cube set builds its default network at load and the others when first asked for (explore), or all at once with
  `finish()` (the harness and `sweep.mjs` call it).

## Look

The app's dark, glowing, lit 3D, in the brief's visual language: the cube with cells at its corners (code 000
top-front-left; the first cut left/right, the second front/back, the third top/bottom, as the reference figure), purple
edges `#9a90ff` as wide as the coupling, loops at the corners for the diagonal, solid for + and dashed for −, red
`#ff5a4b` for +1 and blue `#4d94ff` for −1, gray `#5d6676` for what lies outside the algebra. The eight cells keep one
color each in every set (`QMATH.CELL_COLORS`, by code). Gates: red for X-type, blue for Z-type, shaded by |θ|.
Accents as the tour's (cyan `#46d9ff`, amber `#ffb43b` for valleys, cuts and the residual).

## Shared facts (the real run: `QUBITS_DATA`, from Joel's brief; use exactly, and only as "in the real network")

- The network: STRING v12.5 physical protein interactions, combined score ≥ 500, mapped to HGNC gene symbols, largest
  connected component: **16,064 genes** (`network.genes`). Pairs: n(n−1)/2 = 129,018,016, "about 129 million"
  (compute it: `QMATH.pairs(QUBITS_DATA.network.genes)`).
- The full run: **8 bits**, 256 cells, about 63 genes per cell (`run`); the picture uses 3 bits (8 cells).
- The 3-bit cells (`cells3`: codes, informal names read from gene families, gene counts 1,928 to 2,222): the owner chose
  example networks throughout, so the story need not show them; if it does, as informal labels.
- At 3 bits, cube edges carry **61 %** of the coupling between cells (`cubeShare`).
- The 3-bit A_c's largest weights (`weights3`): I 0.40, X₁ 0.20, X₂X₁ 0.13, X₂ 0.11, Z₂Z₁ 0.08, Y₂Y₁ 0.07, X₀ 0.06,
  Z₀ 0.05, X₁X₀ 0.04, and a tail; outside so(7): X₂X₁, Z₀, X₁X₀ (`outside3`).
- At 3 bits the so(7) generators carry **66 %** of A_c's traceless weight and the whole algebra **73 %** (`so7`).
- The residual by depth (`residual`), best algebra of the panel: ours 0.44, 0.52, 0.56, 0.68, 0.74, 0.81, 0.88 (2 to 8
  bits), random 0.57, 0.75, 0.86, 0.92, 0.95, 0.97, 0.99; 0 at 1 bit for every partition; the best 8-bit variant
  (K = 256) 0.82.
- The circuit (`circuit`): RX on q0, q1, q2 (θ = −0.112, −0.396, −0.222), RZZ on (q2, q1) at −0.163 and (q1, q0) at
  +0.039, RZ on q2 at +0.029; θ = −2ct, c = tr(P A_c)/8, R_P(θ) = exp(−iθP/2), t = 1.

Glossary for the captions (from the brief; gloss each term the first time it appears): network/graph, bisection,
cell, qubit (3 qubits address 8 cells, 000 to 111), coarse operator A_c (the network shrunk to cells), Pauli matrices
(I do nothing, X flip the bit, Z sign +1 on 0 and −1 on 1, Y flip with a sign) and Pauli strings (one per qubit, such as
X₂X₁ or Z₀; any matrix on qubits is a weighted sum of them, as any signal is a sum of sine waves), Lie algebra (a small
family of strings closed under commutators: operators built from it run as short circuits), residual (the share
dropped: 0 nothing lost, 1 everything lost), exchange operator R (swaps the two walkers).

## The maths: `QMATH` (`sets/qmath.js`; checked by `node tools/qubits/test-qmath.mjs`)

Pauli strings are indices `k = (x << L) | z` (bit q of x: an X on qubit q; of z: a Z; both: Y); σ = i^|x∧z| X^x Z^z, so
σ[b⊕x][b] = i^|x∧z| (−1)^|z∧b|. Qubit q is bit q of the cell index (q0 least significant). Names top qubit first
(`X2X1`, with `{ sub: true }` `X₂X₁`; the identity `I`).

- **Example networks**: `NETS` (`{ key, name, kind, note, ... }`): `clear` "Clear groups" (the authors' synthetic check
  scaled down: 8 groups of 40 genes on a cube, 0.5 within, 0.04 between cube neighbors, 0.002 otherwise; 4,003 links),
  `mixed` "Uneven groups" (**the story's network**, `DEFAULT`: uneven like a real network, 0.37 to 0.63 within, 0.04
  to 0.18 between neighbors, more across one face diagonal; 5,637 links), `blurred` "Strong mixing" (0.5, 0.25, 0.12;
  10,799 links), `random` "Random network" (320 genes, as many links as the clear one, no groups). All seeded.
  `network(key)` -> `{ key, name, note, n, m, edges (pairs), group (planted corner or null), deg, off, adj (CSR) }`;
  `planted(o)`, `random(o)` make others.
- **The cut** (a stand-in for the authors' beam search, deterministic): `cut(net, L = 3)` -> codes (Uint8Array). The
  network's slowest modes (the 2^L leading eigenvectors of (I + D^−½ A D^−½)/2 by subspace iteration from a seeded
  start, the trivial one dropped, rows normalized) are grouped into 2^L equal cells (k-means from a farthest-point
  start, then a balanced assignment); then every way of giving the cells the codes is tried (first cell at 000: 7! =
  5,040), keeping the one with the most links on one-bit hops (cube edges), then the fewest across the first bisection,
  then the second. Bisection q is bit q of the code; the first bisection is the top bit, so cells nest as prefixes
  (`prefix(code, 3, L)`). On the planted networks it recovers every group with the cube's labelling (clear and uneven:
  every gene; strong mixing: 98 %). `randomCut(net, L, seed)`: random halvings (cells of uneven size, as the real
  run's random baseline). `purity(net, code, L)`, `sizes(code, L)`.
- **The coarse operator**: `coarse(net, code, L)` = P A Pᵀ (P[c][i] = 1/√|c|), `sinkhorn(A, N)` (symmetric:
  diag(x) A diag(x) with rows summing to 1), `cubeShare(B, N)` (share of the coupling between cells on cube edges).
- **Pauli weights**: `pauli(M, L)` -> `{ re, im }` (4^L weights c_k = tr(σ_k M)/2^L, by a Walsh-Hadamard transform of
  each diagonal M[j][j⊕x], O(4^L L)); `fromPauli(c, L, only)` rebuilds (exactly); `entry(k, L, row, col)`, `name`,
  `parse`, `parts`, `kind` ('loops' or 'hops'), `anti(a, b, L)` (anticommute), `wht`.
- **Algebras**: `generators(kind, L)` ('tfim': X_q and Z_q Z_(q+1); 'odd': plus Z on the top qubit), in the circuit's
  order (X0 .. X(L−1), Z(L−1)Z(L−2) .. Z1Z0, Z(L−1)); `closure(gens, L)` (Pauli-string commutators); `algebra(kind, L)`
  -> `{ gens, basis, set, dim, label ('so(7)'), name }` (dim L(2L−1) and L(2L+1): so(6) 15 and so(7) 21 at 3 bits).
- **Fit**: `fit(c, L, alg)` -> `{ total, inside, gens, residual }`: shares of the traceless part's squared weight inside
  the algebra and on its generators, and the residual ‖A₀ − ΠA₀‖_F / ‖A₀‖_F = √(1 − inside) (0 at 1 bit always).
  `order(c)` (by |weight|, largest first), `rebuild(c, L, ord, k)`, `errors(c, ord)` (error left after k strings:
  ‖A − A_k‖_F / ‖A‖_F), `trotter(c, L, alg, t = 1)` -> gates `{ k, name, type ('RX' | 'RZZ' | 'RZ'), qubits, c, theta }`
  with θ = −2 c t.
- **Everything at once**: `analyze(netKey, { L, cut: 'found' | 'random' })` (cached) -> `{ net, cut, L, N, code, sizes,
  purity, raw, Ac, c, order, errors, fits: { tfim, odd }, cubeShare, cutShare, trotter: { tfim, odd } }`.
- Also `layout(net, { dim, iters, seed, init })` (force-directed, seeded), `pairs(n)`, `soDim(m)`, `CELL_COLORS`, `rng`,
  `pop`.

What the story's network gives (for the text, but compute it, never copy these): 320 genes in 8 cells of 40; cube
edges carry 79 % of the coupling between cells; weights I 0.55, X₀ 0.17, X₁ 0.11, X₂ 0.08, X₁X₀ 0.04, Z₁Z₀ 0.04 ...;
the error left falls 1, 0.39, 0.28, 0.21 ... 0.07 after ten strings; so(7) holds 88 % of the traceless weight (its
generators 87 %), residual 0.34 (so(6) 0.35); at 2 bits 0.12; at 1 bit 0; a random cut of it: 0.56 at 2 bits, 0.75 at 3.

## The look: `QLOOK(K, set)` (`sets/look.js`)

`tubes(max)`, `rings(max)`, `balls(max)`, `boxes(max)`, `halos(max)`: pools refilled every frame (`begin()`, `add(...)`,
`end()`; `.mesh` goes into the set's group). Tubes `add(a, b, r, color, alpha, dashes)`, rings `add(center, axis, R, r,
color, alpha, dashes)`, balls `add(p, r, color, alpha)`, boxes `add(p, [sx, sy, sz], color, alpha)`, halos
`add(p, size, color, alpha)` (the kit's glowing points). Lit like the scene (the light over the left shoulder), with a
rim glow; dashed for a negative sign. `depth()` (call first in update) writes depth only while the set is fully in.
Colors `PURPLE`, `RED`, `BLUE`, `GRAY`, `INK`, `AMBER`, `CELL[8]`; `mix(a, b, t)`.

## The sets (each with a manifest: params, keyframes, anchors, labels, views, explore)

- **`pairs`** (`sets/pairs.md`): the grid of pairs growing; the example network as a city map with two walkers and
  glowing valleys (illustrative); the chip with three qubits; the map folding into eight neighborhoods with codes.
- **`cube`** (`sets/cube.md`): the network cut in two, four and eight; A_c on the cube; the lesson (the reference
  figure's strings one by one, `cube_focus` on the big cube); the gallery of the ten largest weights added one by one
  (`cube_build`, `cube_sum`) with the error left; the toolbox (`cube_alg`, `cube_keep`) and the residual.
- **`chart`** (`sets/chart.md`): the real run's residual by depth, ours against random, with the example network's
  points; the six-gate circuit in 3D (real or example angles).

Sizes for framing: `pairs` grid about ±1.05 (y up, facing +z), map a disc of radius about 1.2 at y = −0.3, chip at
x ≈ 1.3; `cube` genes within about 0.8, the cube ±0.5 (with loops ±0.65), with the gallery x from −1.6 to 2.45;
`chart` x ±1.15, y ±0.6; circuit x −0.8 to 0.9, y −0.9 to 1.1.

Performance (headless Chromium, software GL): builds `pairs` about 140 ms, `cube` about 130 ms for its default network
(330 to 400 ms with all four, `finish()`), `chart` about 90 ms; at most 13 draw calls, 75k triangles (the gallery's
instanced tubes), 29k points (the grid of pairs), 11k lines (the strong-mixing network's links).

## The engine (`tools/qubits/engine/`, adapted from the microanatomy story's)

Done in part 2: the first chapter's key is `title` (named Pairs), as the engine's shared title-arc lines expect; the
others as below. Explore's shared state is `{ tab, scene, ctl, brick, sum, gal }` (the cube's network, cut, bits and
algebra live in `ctl.cube`). Paced by `tools/pace.mjs` to 9:04.

Rename everything: `HOST.register('qubits', ...)`, the header comment (Joel Hancock's method and figures; example
networks), `audio/narration-qubits.mp3`, `SET_ORDER = ['pairs', 'cube', 'chart']`; remove the body, tissue and organ
code (`dots`, `ORGAN3D`, `MICRO_DATA`, `domainColour`); `FACTS` from `QUBITS_DATA` and `QMATH`. Keep the shared-room
hooks unchanged (see "Shared rooms" in AGENTS.md), the headset code unchanged (no life-size or room mode in this story).
Support labels whose `text` is a function, the step params above, and `finish()` (as for the micro sets).

**Chapters** (about 4:50 of story time before pacing; `CH` keys and times). Every chapter: one or two plain sentences
first, then the technical layer in smaller print (formulas only there). Numbers from `FACTS`, none hard-coded.

1. `pairs` 0-30, **Looking for pairs** (`pairs`, cam `grid`): `pairs_genes` 0 -> 1 (1-3), `pairs_grid` 0 -> 1 (6-24).
   "Some diseases only appear when two genes are broken at the same time. With 16,064 genes there are about 129
   million pairs: far too many to test one by one." The title card (Three qubits, the tagline) can open it.
2. `walkers` 30-62, **Two walkers on a map** (cam `map`, then `walkers`): `pairs_map` (30-34), `pairs_walk` (35-37),
   `pairs_valley` (44-48), `pairs_settle` (52-58). "Think of the network as a map. Two walkers wander it, one per gene,
   and are drawn to pairs that are broken together in patients more often than in healthy people. Where they settle is
   where to look." Technical: H = K + c V + ρ R; K = I − A_c lets the walkers move, V rewards pairs, R is the exchange
   operator. The valleys are illustrative (no data).
3. `shrink` 62-90, **Why shrink the map?** (cam `chip`, then `hoods`): walkers and valleys out (62-65), `pairs_chip`
   (64-68), `pairs_fold` (72-80), `pairs_code` 1..8 (80-89). "A quantum computer could explore the walkers' routes all
   at once, but today's machines are tiny: 3 qubits can only tell 8 places apart. So the map has to be shrunk first."
   Each neighborhood has a 3-digit code like a postcode.
4. `cut` 90-130, **Cutting the map** (`cube`, cam `genes`): `cube_genes` 1, `cube_ac` 0, `cube_bits` 0 -> 1 (98-104),
   -> 2 (108-114), -> 3 (118-124). Cut in two keeping linked genes together (1 bit: two halves), again (2 bits: a
   square), again (3 bits: a cube); each cut is one digit, the first the most significant (q2). The real run used 8
   cuts (256 cells, about 63 genes each); the picture uses 3. The example network is a planted cube model (say so;
   genes never labelled); the cut here stands in for the authors' search (small print).
5. `coarse` 130-160, **The coarse operator** (cam `default`, then `cube`): `cube_ac` 0 -> 1 (130-138). How much traffic
   flows between neighborhoods: a loop at each corner (the diagonal), edges as wide as the coupling; cube edges join
   cells one digit apart, face and body diagonals two or three. Technical: A_c = P A Pᵀ, Sinkhorn-balanced; K = I − A_c;
   the share on cube edges here (computed) and 61 % in the real network.
6. `bricks` 160-215, **Building blocks** (cam `bricks`): `cube_bricks` 1 with `cube_lesson` 1 (160-164); `cube_focus`
   on I, X0, X1, X2, Z2, Z2X1, X2X1, Y2Y1 (165-188, 3 s each; `QMATH.parse(name, 3)`), −1 at 189; `cube_lesson` -> 0
   (189-191); `cube_build` -> 1 (192-193); `cube_sum` 0 -> 10 (194-210). "Lego bricks of movement": each string's
   pattern (I equal loops; X_q hops along the four edges in direction q; Z_q loops of +1 and −1; Z_q X_p hops with
   signs; X_q X_p and Y_q Y_p face diagonals). "Any traffic table is a recipe of these bricks, the way a sound is a mix of
   pure tones." Added largest weight first, the rebuilt cube converges and the error left shrinks (computed). The real
   run's first weights in the small print (`weights3`).
7. `toolbox` 215-262, **The toolbox** (cam `bricks`, then the chart): `cube_alg` -> 1 (217-220), `cube_keep` -> 1
   (224-230); then `cube_a` -> 0 and `chart_a` -> 1 (238-241), `chart_grow` 0 -> 1 (242-252), `chart_ex` -> 1 (253-255).
   "A quantum computer runs some moves quickly and others hardly at all. Keep only the bricks in its quick toolbox (an
   algebra); the rest is dropped." The example's residual (computed) and the honest result of the real run: good at 2
   to 4 bits, worse with every bit (never a success at 8 bits). Technical: the TFIM chain's generators (X_q, Z_q
   Z_(q+1)) close to so(2L), so(2L+1) with the boundary Z; so(7) at 3 bits (66 % and 73 % in the real network); the
   residual ‖A₀ − ΠA₀‖_F / ‖A₀‖_F.
8. `circuit` 262-290, **The recipe as a circuit** (`chart`, cam `circuit`): `chart_plot` -> 0 and `chart_circuit` -> 1
   (262-265), `chart_gates` 0 -> 6 (265-275). One Trotter step at 3 bits in so(7): six gates on three wires (the real
   run's angles and convention). Then a short recap and what is next (more qubits need larger algebras or better cuts;
   the data term V is the next step); credits: Joel Hancock (the method and the figures it follows); small print: "The
   networks shown are examples, computed here; numbers marked 'real network' are from the authors' run on STRING."

**Explore mode** tabs (HTML and canvas twins):
- **Network**: pick an example network (`cube_net`: the four), the cut (found / random), the bits (1 to 3), and see the
  cells (sizes; how well the planted groups were found: `purity`), A_c, the weights and the residual for so(2L) and
  so(2L+1) update live (`api().analysis()`).
- **Bricks**: the strings (lesson and the network's largest), pick one (`cube_focus`) to see it on the cube (inside or
  outside the algebra), add them up (`cube_build`, `cube_sum`: the error left), choose the algebra (`cube_algebra`;
  `cube_alg`, `cube_keep` for the toolbox).
- **Depth**: the real run's residual-by-depth chart (`chart`), with the example network's points; the circuit (real or
  example angles).
- **Scenes**: Pairs and map (`pairs`), Cube (`cube`), Chart (`chart`), with their controls.

Suggested hashes: `#qubits&t=100`, `#qubits&explore&tab=network&net=blurred&cut=random&bits=2`,
`#qubits&explore&tab=bricks&brick=X2X1&sum=10&alg=so7`, `#qubits&explore&tab=depth&ex=on`,
`#qubits&explore&scene=pairs&view=hoods`. `collab.state()`: `{ tab, scene, ctl, net, cut, bits, alg, brick, sum }`
(the shell's FORMAT goes up with a new story).

## Testing

- `node tools/qubits/test-qmath.mjs`: the maths (exact Pauli rebuilds at 1 to 4 bits, so(2L) and so(2L+1) dimensions
  at 1 to 5 bits, so(7)'s strings as in the reference figure, the planted groups found with the cube's labelling,
  balanced A_c, residual 0 at 1 bit and equal to the projection's by matrices, Trotter angles, seeded networks).
- A set alone: `node shot.mjs <set> "<query>|..." <prefix> 640 400` from `tools/qubits` (serve the repository root).
- `node tools/qubits/build.mjs --check`; the story: `sweep.mjs`, then the smoke test (once the engine is adapted).

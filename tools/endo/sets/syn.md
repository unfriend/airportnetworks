# `syn` - the neuromuscular junction, close up (sets/syn.js)

The hero of the endotype story: a cut-away section through one junction, about 2.4 units across (x -1.2 to
1.2), centred on the origin; the axon reaches further up and left (to about (-2.9, 2.3)) and the fibre's
surface, for the `wide` view, spreads to x ±5. Up (+y) is the nerve, down the muscle. The cut plane is z = 0.34
(`ZC`), facing +z; the section runs back to z -0.62, where it fades out. Scale: 1 micrometre is about 0.5 units;
the small parts are drawn bigger than life (vesicles 0.042 across, cleft 0.13, receptors 0.022).

- **Nerve ending** (`BC` (0, 0.2, -0.12)): a glass bouton (superellipsoid: round on top, flat underneath at
  y 0.13), cut open at z = 0.34 with a glowing cut edge. A myelinated axon (two internodes and a node of Ranvier,
  six microtubules inside) arrives from above left. A terminal Schwann cell caps the top, with a ragged edge and a
  bulge over its nucleus. Inside: 166 vesicles in four clusters (16 docked, four per active zone) and a reserve
  pool; four active zones (dense bars with knobs, along z); three mitochondria, two cut open to show their inner
  membrane and lamellar cristae; three lumpy, darker endosomes; a faint actin mesh, densest under the membrane.
- **Synaptic cleft**: the basement membrane runs through the middle of the cleft and down the middle of every
  fold. It is a fibrous glowing sheet with laminin crosses lying in it (one long arm with a globular head, three
  short arms), a collagen IV net (lines) and collagen XIII rods rising from the muscle's surface.
  Acetylcholinesterase sits as three globules on the triple-helix tail of collagen Q, anchored in the sheet
  (34 of them). Agrin strands (beaded) reach from the nerve's membrane to the crests (22).
- **Muscle side**: the muscle membrane is thrown into six junctional folds about 0.33 to 0.44 deep (fold slits
  at x -0.625 + 0.25 i, mouth 0.044 wide, a little wider at the bottom, wandering slightly along z). It rises into
  a gutter round the bouton's sides. It is drawn as rose glass plus a semi-opaque skin. 1,677 acetylcholine
  receptors carpet the crests and the upper fold walls: five subunits round a pore, alpha, epsilon, alpha,
  delta, beta, faintly coloured, with rapsyn under each. 38 MuSK/LRP4 pairs sit among them (LRP4 a tall stalk
  with beta-propellers, MuSK shorter with Ig domains, its kinase inside and DOK7 under it). 944 sodium channels
  (Nav1.4, four domains) line the lower walls and the bottoms of the folds.
- **Inside the fibre**: nucleus A (-0.5, -0.6, 0.2) is cut open: a double glass envelope with pores, chromatin,
  a nucleolus and the inside of its back half. Three wavy ER sheets with ribosomes wrap its left half, and a Golgi
  stack of five curved cisternae with budding vesicles sits at its right end. Nucleus B (0.66, -0.6, -0.2) is
  whole. There are three muscle mitochondria. Ten myofibrils (along x, radius 0.06, y -0.9 and -1.06) are
  striated in the shader: I-band light, A-band dark, H-zone, M-line and Z-line, period 0.42 (shorter than life),
  fading where they would alias. Desmin rings sit round every Z-disc, joined to the neighbours' rings, and
  plectin strands run from the top row up to the nuclei, a mitochondrion and the bottoms of three folds.
- **The fibre's surface** round the junction: a wide, faint, striated glass cylinder along x (radius 3.2), cut
  away where the section is (for `wide`). It is a mesh of its own, so `syn_shell` fades and hides it.
- **The fibre's cut face** (under the membrane, within the section, z just behind `ZC`): a translucent, lit section of
  muscle, a mesh of its own. Deep rose-red, paler just under the membrane, faintly striated low down (where the
  myofibrils run, period `ZP`) and mottled; it fades towards the sides and the bottom. Opacity 0.55 at most and it
  writes no depth, so the nuclei, organelles and myofibrils behind it show through; it thins while a place glows (the
  rest dims) and as the camera comes close (from 4 set units, to a quarter at 1.2: the close views look into the
  fibre unveiled). It fades in with the fibre (`syn_build` stage 0).
- **Over the room** (passthrough AR): the glass adds its colour as light but writes alpha only as much as it glows
  (1.4 times its brightest channel, at most 0.85; custom blending). Plain additive blending wrote alpha 1 under every
  faint sheet, so over a light wall the cut face, the membranes and the bouton showed as a black box; in VR the
  canvas is opaque, so nothing changes there.

Draw calls: 14 at rest (13 with `syn_shell` 0), 16 with genes and endotypes on (9 at `syn_build` 0.3: parts that
are not there yet are hidden). Triangles: 368k (receptors 122k, sodium channels 49k, laminin 34k, AChE 19k, MuSK/LRP4 11k, vesicles
13k, the rest in three merged meshes). Points: 3,408 (3,773 with genes and endotypes). Line segments: 6,775.
Build 180 to 230 ms in headless Chromium. Only the 166 vesicle matrices are updated every frame. Untested on a
headset.

## Params

| param | default | meaning |
| --- | --- | --- |
| `syn_a` | 1 | fade (engine) |
| `syn_build` | 1 | The junction assembles. 0 to 0.3: the fibre's interior grows in (each part from its middle). 0.05 to 0.35: the muscle membrane and its folds rise into place. 0.25 to 0.5: the basement membrane. 0.4 to 0.7: the receptors gather from all over the membrane onto the crests, staggered. 0.5 to 0.85: the nerve ending arrives from above (it descends 0.6 and fades in, vesicles growing). 0.8 to 1: the Schwann cell, agrin and acetylcholinesterase. 0 shows nothing. |
| `syn_fire` | 0 | Firing, one impulse a second, all from `t` (phase = t mod 1). 0 to 0.16: a glow runs down the axon, then sweeps over the bouton. About 0.235: calcium flashes at the active zones (green-white). 0.24 to 0.39: about 10 of the 16 docked vesicles fuse (sink, flatten into the membrane and vanish), a different random set each impulse. 0.27 to 0.6: a puff of acetylcholine (tiny bright points) crosses the cleft onto the crests and into the fold mouths. 0.31 to 0.74: receptors near each fused vesicle open (glow, pore lit). 0.42 to 0.95: the end plate depolarises, then a wave runs outwards along the fibre's surface and down the folds, where the sodium channels flash. Peak about 0.6: the myofibrils twitch (shorten 3.5 %, glow). 0.8 to 0.98: new vesicles dock. In-between values dim it all (and partly fuse). |
| `syn_tired` | 0 | Fatigable weakness, with firing on. An 8-second loop: six impulses release less and less (relative release 1, 0.7, 0.5, 0.36, 0.27, 0.2 at `syn_tired` 1), then two impulses are skipped (rest). Fewer vesicles fuse and fewer receptors open. The muscle's wave fails below about 0.4 of normal release and the twitch shrinks to nothing by the fifth impulse. 0 healthy. |
| `syn_genes` | 0 | The 35 seed genes light up where they act, as glowing markers in their endotype's colour. There are 11 groups and they light one after another: nerve (four groups), cleft, membrane (three), inside (three). Group g lights over `syn_genes` 0.04 + 0.07 g to +0.12, and all are lit from 0.86. Each group's label fades in with its markers. The rest of the scene dims a little. |
| `syn_place` | 0 | Endotype id + 1, 0 none. Its place glows in its colour and the rest dims to about a third. For 0, 4 and 7 (no place) nothing glows and everything dims a little. In-between values cross-fade the two neighbouring ids, so set it with a step (the engine's `jump`) or a quick ease. With `syn_endo` on, that endotype's cloud brightens and the others dim. |
| `syn_shell` | 1 | The fibre's wide surface round the junction (the cylinder of the `wide` view): 1 shown, 0 hidden (its mesh is not drawn), in between faded. The story never shows it (it only distracts), and explore mode always hides it. |
| `syn_endo` | 0 | The endotypes arrive. Each is a cloud of its genes (as many as it has, up to 40; 295 dots), starting on a ring above the scene (centre (0, 1.95, 0), 11 at the top, like the tree's endotype view). With a place, the cloud flies down in an arc and settles round its place, gently drifting. Endotypes 0, 4 and 7 come down to hover loose above the bouton, on the right. Staggered by id: id k flies over 0.04 k to 0.04 k + 0.5, so all have landed at 0.94. Visible from 0.06. |

Places, from `ENDO_DATA.endo[].place` (slot, what glows): `mito` (the nerve ending's three mitochondria),
`lamina` (the basement membrane, laminin, collagen, AChE/ColQ, agrin), `golgi`, `channels` (acetylcholine
receptors and sodium channels), `er`, `endosome`, `vesicles` (vesicles and active zones), `scaffold` (myofibrils,
desmin, plectin), `junction` (the nerve's membrane, the muscle membrane, rapsyn and MuSK/LRP4).

Suggested keyframes:
- `tired` chapter: `syn_build` 0 to 1 over about 3 s (from `wide`), `syn_fire` 0 to 1, then `syn_tired` 0 to 1
  over about 5 s. Let the loop run at least 8 s, so one whole run-down and rest is seen.
- `genes` chapter: `syn_genes` 0 to 1. A slow ramp (about 15 to 20 s) while the camera tours terminal, cleft,
  receptors, nucleus lets each group light as the camera reaches it. A quick ramp lights all of them at once,
  which also works because the engine stacks the labels.
- `endotypes` chapter: `syn_endo` 0 to 1 over about 6 s, with `syn_place` stepping 2, 10, 6, 3 (ids 1, 9, 5, 2)
  as now.

## Anchors

`axon`, `terminal` (upper bouton), `vesicles`, `activezone`, `mito` (top of the first mitochondrion), `endosome`,
`cleft`, `lamina`, `receptors` (a crest near the cut), `folds` (a fold at the cut), `channels` (sodium channels at
a fold's bottom), `nucleus` (nucleus A's cut face), `er`, `golgi`, `scaffold` (top myofibril, front), `fibre`,
`gap` (0, 0.085, 0.05: in the cleft, for standing inside), `junction` (0, 0.05, 0), `loose` (above the loose
clouds), `e0`..`e11` (where each endotype's cloud settles), and `place()` (a function: the current `syn_place`'s
place, or that endotype's cloud, or `junction` when none). Every place key is an anchor.

Also exported: `genePos(sym)` (where a seed gene's marker is, local coordinates, or null), and `geneGroups`, the
11 groups in the order they light: `{ text, genes, at, from }`, where `from` is the `syn_genes` value at which
the group starts to light.

## Labels

31 labels, at most 7 at once, all functions of the params:
- At rest (hidden as `syn_genes`, `syn_endo` or `syn_place` come in, and waiting for `syn_build` to reach their
  part): Nerve ending, Synaptic vesicles, Mitochondrion, Basement membrane, Acetylcholine receptors, Junctional
  folds, Muscle fibre.
- With `syn_genes`, the 11 gene groups, as the spec gives them ("CHAT · SLC5A7 · SLC18A3" making and recycling
  acetylcholine; ... "TOR1AIP1 · CHD8" nucleus), each pinned near its markers. At 1 all 11 show, so at the default
  view they rely on the engine's nudging to stack. In the close-ups (terminal, cleft, receptors, nucleus) only
  the local ones are on screen.
- With `syn_place`: "Endotype k" plus its name, at its place (or at its cloud for 0, 4, 7).
- With `syn_endo` and no place: "No shared place", endotypes 0, 4 and 7 (ids from the data), above the loose
  clouds.

## Cam views

- `default` [26, 16, 5.8, -0.05, 0.05, 0]: three-quarter view of the whole section, a little from above, the
  axon arriving top left.
- `terminal` [22, 14, 2.1, 0, 0.42, 0.1]: the bouton's inside: vesicle clusters, mitochondria, endosomes.
- `cleft` [62, 4, 1.05, 0.1, 0.06, 0.15]: low and close, along the cleft from the front right.
- `receptors` [6, 48, 0.32, 0.25, 0, 0.27]: down onto a crest's carpet of receptor rosettes, from in front of the
  cut.
- `folds` [10, 6, 1.45, 0.1, -0.18, 0.2]: the folds' cut face, receptors on top, sodium channels below.
- `nucleus` [-16, 10, 1.45, -0.32, -0.66, 0.15]: nucleus A cut open, ER, Golgi, myofibrils.
- `gap` [-90, 0, 1.1, 0.35, 0.092, 0.1]: inside the cleft (the camera at x -0.75, y 0.092), looking along +x:
  the nerve's membrane and vesicles above, the receptor carpet below, the basement membrane, AChE and agrin
  around.
- `wide` [24, 20, 8.2, -0.25, -0.25, -0.2]: pulled back, the fibre's striated surface round the cut-away and the
  axon.

## Controls and explore

- View: Junction (`default`), Nerve ending (`terminal`), Cleft (`cleft`), Folds (`folds`), Inside the fibre
  (`nucleus`). The option keys are cam names, as in the motor set.
- Firing: Still (fire 0), Firing (fire 1), Until tired (fire 1, tired 1).
- Genes: Off / On.

`explore(c)` returns build 1, fire, tired and genes from the controls, and `syn_shell` 0 (no explore view needs the
fibre's wide surface). It also returns `syn_place` and
`syn_endo` from `c.place` (an endotype id, -1 or undefined for none) or else from `showPlace(id)`, which the
engine may call instead (-1 clears). With a place, it returns `syn_endo` 1 and `syn_place` id + 1.

## For the engine

- Glass that comes very close to the eye fades out (within about 0.3 local units, measured in the set's own
  units). So for "Stand in the gap" at life size the membranes round you do not blind you. The acetylcholine
  and receptor-pore points are capped at 10 px.
- In a headset at "Stand in the gap" scale, the cleft (y 0.0 to 0.13) is the band to put at chest height. Use
  the `gap` anchor as the centre.
- `syn_place` is in the engine's STEP set (no easing); keep it so.
- `keepClear`: every part is drawn where its geometry is (the nerve's descent while it builds and the endotype
  clouds' flight aside), so in a headset the engine keeps it clear of your head (`xrClear`, in `e5_xr.js`). It is a
  function that leaves out the cut-away (a point past `ZC` of a part with the cut flag, `aS.w`), so views into the
  section (`receptors`) keep their full scale. A hidden mesh (the shell at `syn_shell` 0, meshes not built yet) is
  left out; the parts of the merged meshes still building count.

## For the narrator

May say: the junction is where a motor nerve tells a muscle fibre to contract. An impulse arrives, calcium
enters at the active zones, and vesicles fuse and release acetylcholine. It crosses the cleft and opens the
acetylcholine receptors, packed on the crests of the junctional folds. The muscle membrane fires (sodium
channels in the folds carry the signal on) and the fibre twitches. The basement membrane in the cleft holds the
junction together and anchors acetylcholinesterase, which clears acetylcholine. Agrin from the nerve, its
receptor LRP4, MuSK, DOK7 and rapsyn keep the receptors clustered. The fibre's own nuclei at the junction make
the junction's proteins, and the ER and Golgi add their sugar chains. In fatigable weakness each impulse in a
train releases less and opens fewer receptors, until the muscle no longer answers: weakness that grows with
use. The 35 genes are shown where they act (textbook placements; the authors will check them).

Must not say: that the run-down numbers, the impulse timing, the counts (166 vesicles, 1,677 receptors, six
folds) or the sizes are real or measured (they are illustrative; the small parts are drawn bigger than life and
the sarcomere shorter); that the gene markers' colours mean anything but the endotype each gene belongs to; that
an endotype's cloud shows real positions of its genes (the dots stand for the number of its genes, up to 40,
gathered round its place). Never say givinostat treats CMS. No patient data, no variants, nothing about
zebrafish.

Anatomy note: the spec says each active zone sits "opposite a fold crest". In the textbooks (Kandel; Purves) the
active zones lie opposite the mouths of the junctional folds, with the receptors on the crests on either side.
This set follows the textbooks: the four active zones sit over the mouths of the four middle folds. The released
acetylcholine lands on the crests beside each mouth and runs a little way into the fold.

## Sources

Standard anatomy and physiology of the neuromuscular junction: Kandel et al., Principles of Neural Science;
Purves et al., Neuroscience; Alberts et al., Molecular Biology of the Cell. These cover the active zones, docked
vesicles, the basement membrane with laminin (beta-2, alpha-5), collagen IV and XIII, and the ColQ-anchored
asymmetric acetylcholinesterase. They also cover agrin-LRP4-MuSK-DOK7 signalling and rapsyn under the receptors,
the fetal (gamma) and adult (epsilon) receptor pentamers with two alpha, beta and delta, and Nav1.4 in the depths
of the folds. And they cover subsynaptic nuclei, desmin round the Z-discs and plectin linking the intermediate
filaments. Gene placements: `tools/endo/SPEC.md` (from UniProt). Endotype colours, places, seeds and sizes:
`ENDO_DATA`.

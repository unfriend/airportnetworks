# The muscle story: 3D sets spec

We are adding a fifth story to the web app in `/home/user/airportnetworks`: `stories/nmd.js`, built from
`tools/nmd/` like the tour `stories/lbi.js` is built from `tools/lbi/`. It turns a conference talk (ISMB 2026,
"Deep integrative multiplex network-based analysis of rare neuromuscular disorders reveals overlapping multiscale
endotypes involved in cardiac and skeletal muscle myopathies", Iker Núñez-Carpintero and Philipp Friedrich, with
Julia Guthrie and Jörg Menche, LBI Network Medicine, Vienna) into a narrated, about seven-minute 3D story with an
explore mode, on desktop, phones and in VR/AR headsets (Meta Quest Browser). Be bold and beautiful, as in the tour.

**The rules for sets are those of the tour**: read `tools/lbi/SPEC.md` from the top down to (and including)
"Palette and look", and `tools/lbi/kit.js`. Everything there holds here (runtime, code style, pure `update`,
exports, labels, controls, camera views, performance budget, harness, palette), with these differences:

- Your set files live in `tools/nmd/sets/`, the harness is `tools/nmd/harness.html` (same query syntax) and the
  screenshot tool is `tools/nmd/shot.mjs` (run it from `tools/nmd`; shots go to `tools/nmd/shots/`).
- The real data of the analysis is the global constant `NMD_DATA` (file `tools/nmd/sets/data.js`, made by
  `tools/nmd/data/gen_data.mjs`; never edit it by hand). It is loaded before the sets, in the harness and in the
  story. Its header comment documents every field. Decode it once per set (base64 to typed arrays).
- No patient data and no variants appear anywhere, and nothing about zebrafish.
- A set whose geometry is too slow to build at load may build it in slices: return `idle(dt)` (called every frame
  while the set is hidden; keep each call to a millisecond or two) and `finish()` (build the rest now; the harness
  calls it after building the set, `sweep.mjs` after loading the story), and slice in `update` too, showing the part
  only once it is ready. The motor set's heart does this.
- A set drawn where its geometry is (no positions computed in its shaders, as the tower's and the tree's are) may export
  `keepClear: true`: in a headset the engine then never lets a close view bring it nearer than 0.35 m to your head
  (`xrClear` in `engine/e5_xr.js` caps the view's scale, eased, from a sample of each of its visible meshes: a point per
  0.035 set units of surface, an instance as a ball, taken once in slices by `xrPrep`; your own size and an overview's
  scale stay). Instead of `true` it may give a function `o => test or null`, the test `(x, y, z, i) => drawn` for a
  point in the object's own frame and a vertex of its triangle, for parts a shader never draws (the endotype story's
  junction leaves out its cut-away this way). The motor set exports `true`.

## The data, in short

- 13 disease **groups** (the 2024 Gene Table of Neuromuscular Disorders has 16; groups under 20 genes were joined to
  the group they overlap most). Each has a short name, a colour (use it everywhere the group appears), a `site`
  (where it strikes: `neuron`, `nerve`, `junction`, `muscle`, `heart`), seed genes (the Gene Table genes) and genes
  the random walk added, and 3 to 20 **endotypes** (clusters of the group's genes that share a mechanism, numbered
  `c` 1..n within the group, with a GO-based name; show both: "Cardiomyopathies 7 · Sarcomere organization").
- 1,182 **genes** (the union of the 13 disease modules), each with its endotype in each group (0 = not in that
  group), seed and added bits per group, a few GO, HPO and KEGG terms, and whether it is in the protein layers.
- The **tower** of 71 layers, top to bottom: HP, MP (phenotypes), Reactome (pathways), NeDRex (drug targets),
  co-essential (CRISPR screens), 39 co-expression layers (GTEx; `coex_core` and 38 tissues), 27 protein-interaction
  layers (IID; `ppi_core`, interactions in more than 24 tissues, and 26 tissues without the core's interactions).
  `data: 'all'` layers (the 27 protein layers) have links for every group: `edges` holds 15,246 links among the
  module genes with a bit per protein layer. `data: 'overlap'` layers (HP, MP and 9 co-expression layers) have
  links only among the 325 genes of the Congenital Myopathies x Hereditary Cardiomyopathies overlap (`extra`). The
  other 33 layers have no links yet (`data: ''`): their data will arrive later and must drop in without code
  changes (treat a layer's links generically, whatever its category).
- `pos`: a fixed 2D layout of the genes in the unit disc (neighbourhoods and endotypes stay together).
- `heat`: per group, how often a random walk with restart from the group's seeds visited each gene (0..255, seeds
  255): restart 0.7, layer switch 0.5, layers weighted by the group's z-score.
- Per group `z`: the layer z-score in each protein layer (largest connected component of the seeds against 1,000
  degree-matched random sets), computed on these files; a layer counts as informative at z >= 1.645. These are
  placeholders until the authors' own values arrive, so the set must read them from the data, never hard-code them.

## Shared facts (use exactly)

- Neuromuscular disorders: rare genetic diseases of the motor unit; 16 disease groups, more than 1,200 diseases,
  about 700 causal genes (Gene Table of Neuromuscular Disorders, 2024); 3.7-4.99 in 10,000 people; variable muscle
  weakness and low muscle tone (hypotonia); no molecular subtypes (endotypes) yet.
- Where they strike: motor neuron diseases, hereditary ataxias and paraplegias in the nerve cells (motor neurons in
  the spinal cord and brain, and the cerebellum for ataxias); hereditary motor and sensory neuropathies in the
  nerves (motor and sensory axons); congenital myasthenic syndromes at the neuromuscular junction; myopathies and
  muscular dystrophies in the muscle fibres; hereditary cardiomyopathies in the heart muscle, which shares the
  sarcomere with skeletal muscle.
- The random walk: start at the seed genes; at every step, with probability 0.7 jump back to a seed (in a layer
  chosen by the layers' z-scores); otherwise, at a gene present in several layers, switch layer with probability 0.5
  (preferring layers with high z-scores), then step to a random neighbour in the layer. Genes visited most join the
  module, one by one, until the module is connected or 200 genes have been added.
- Robustness: 10,000 multiplex networks for each number of removed layers, 680,000 multilayer networks in all,
  about 45 hours on MareNostrum 5 at the Barcelona Supercomputing Center (jobs of 25 nodes with 112 cores each);
  disease modules keep their originally detected genes until most layers are gone.

## The sets

### `motor` - the motor unit, from nerve to sarcomere, and the heart (file `sets/motor.js`)

Slide 2 of the talk, in real 3D, illustrative but anatomically right. One scene, about 2.4 units long, centred on the
origin, read from left (spinal cord) to right (muscle):

- A short section of **spinal cord** (a translucent rounded cylinder with the grey-matter butterfly inside, faint),
  holding a **motor neuron**: a large cell body (soma, nucleus visible through it) in the anterior horn with branching
  dendrites, and a **sensory neuron** cell body outside the cord in a dorsal root ganglion (small swelling) with its
  axon joining the nerve.
- The **axon**: a long smooth tube leaving the cord, wrapped in **myelin** sheath segments (glossy, slightly
  translucent sleeves) with gaps (nodes of Ranvier); near the muscle it branches into terminals, each ending on a
  muscle fibre at a **neuromuscular junction** (a small cupped end plate, with synaptic vesicles as tiny dots).
- The **muscle**: a fascicle of about 20 long cylindrical muscle fibres (striated: alternating light and dark bands
  in a shader or texture), one fibre opened up (`motor_open`) to show the **myofibrils** inside, and one myofibril
  ending in a magnified **sarcomere** at the far right: Z-discs (lattice plates) at both ends, thin actin filaments
  (beaded twin strands) from the Z-discs, thick myosin filaments in the middle with heads sticking out, titin springs
  from the Z-disc to the M-band, the **M-band** in the centre. Real 3D: the filaments form a hexagonal lattice you can
  fly into.
- The **heart**: a stylised but recognisable human heart (four chambers suggested, aorta and pulmonary trunk, coronary
  vessels as raised lines), deep red-magenta with a soft rim glow, floating above the muscle, beating (use `t`).
  A cut-away window in its wall shows the same striated fibres (heart muscle shares the sarcomere).

Params:
- `motor_a` fade. `motor_build` 0..1: the scene appears along the path, cord to muscle (default 1).
- `motor_signal` 0..1: nerve impulses (bright pulses) run down the axon to the junctions, vesicles flash there, the
  fibres twitch (all with `t`); 0 still.
- `motor_open` 0..1: one fibre opens to show myofibrils and the sarcomere magnifies out of it.
- `motor_contract` 0..1: sarcomeres contract (thin filaments slide in, Z-discs move towards the M-band); with
  `motor_signal` > 0.5 they pulse with the twitches.
- `motor_heart` 0..1: the heart appears (from a glow) and beats.
- `motor_groups` 0..1: every disease group's colour lights its site: a soft halo or ring and coloured light on the
  part (neuron: motor neuron diseases, ataxias, paraplegias; nerve: motor and sensory neuropathies; junction:
  myasthenic syndromes; muscle: the myopathies and dystrophies; heart: cardiomyopathies). Take colours and sites from
  `NMD_DATA.groups`. `motor_site` 0 all sites alike, 1..5 = neuron, nerve, junction, muscle, heart: that site glows and
  the rest dims (round it).
Anchors: `cord`, `soma`, `ganglion`, `axon`, `myelin`, `junction`, `fibre`, `myofibril`, `sarcomere`, `zdisc`,
`mband`, `heart`. Labels: Spinal cord, Motor neuron, Sensory neuron, Axon (myelin), Neuromuscular junction,
Muscle fibre, Sarcomere, Heart, each with a rule so at most about five show at once (by `motor_open`, `motor_heart`,
`motor_site`). Cam: `default` (whole unit, three-quarter view), `cord`, `junction`, `fibre`, `sarcomere` (inside the
lattice, close, looking towards the fibre), `sarcEnd` and `sarcSide` (the magnified sarcomere from outside: down its
filaments past the outer Z-disc, and from the side; the story's sarcomere shots), `heart`. Close views look across the
unit or from its right end, so that in a headset the rest of the unit never lies between the view and you. Explore: View (Motor unit / Junction / Sarcomere / Heart), Show (Diseases on / off),
Motion (Still / Impulses / Contraction).

### `tower` - the multiplex network (file `sets/tower.js`)

The hero of the story, used in seven chapters and in all of explore mode. Slide 8 of the talk shows it: layers as
horizontal planes stacked up, genes as dots at the same spot in every layer, links in each plane, vertical threads
joining a gene's copies across layers. Use the tour's palette (not black-and-neon) and avoid clutter: most of the
time only what matters glows.

Geometry:
- 71 layers, top (HP) to bottom (the protein layers), about 2.2 units tall, each a disc of radius 1: a faint rim
  ring and an even fainter fill, tinted by category (protein interactions cyan `#46d9ff`, co-expression green
  `#3ee08f`, phenotypes magenta `#ff5ad9`, pathways amber `#ffb43b`, drug targets red `#ff5a4b`, essential genes
  violet `#b07bff`), with a small gap between categories so the blocks read. Layers without data show only their
  rim (dashed or dotted) until data arrives.
- Genes: a point (`K.points` or your own shader) at `pos` in each layer where the gene has a link in that layer;
  `tower_room` > 0 pushes the layout outwards into an annulus (inner radius about 0.45) so a person can stand in the
  middle (in the headset the engine scales the tower to the room). Seeds have a bright core.
- Links: line segments within each layer. All layer-links together are about 126,000 segments: put them in one or two
  geometries and decide visibility and colour in the shader from per-gene state (a small DataTexture or uniform
  array updated only when the selection changes) and per-layer weights, so that at most about 60,000 are visible in any
  state, and do not rebuild buffers per frame.
- Threads: vertical lines through a gene's copies, only for genes that are highlighted (a few hundred at most).

Params (all 0..1 unless said; the engine eases them, so morphs must look right in between; round index params):
- `tower_a` fade. `tower_rise` the layers appear from the bottom up (default 1). `tower_cats` the category tints and
  labels come up (default 0.4).
- `tower_group` 0 = all groups: genes in their group's colour (genes in several groups white-gold), links faint;
  k = 1..13 = group k-1: its module glows in its colour, everything else dims.
- `tower_seeds` the selected group's seeds glow and pulse (the Gene Table genes); the rest of its module is hidden.
- `tower_walk` walkers: about 20 bright sparks with short trails hop along the selected group's links, jump between
  layers along a thread (layer switch), and now and then flash back to a seed (restart); deterministic in `t` (plan
  their paths at selection time with a seeded walk over `edges` using the group's z-scores, restart 0.7, switch 0.5).
- `tower_heat` genes warm up by the group's `heat` (ramp dark blue, cyan, white).
- `tower_module` the walk's genes join the module one by one in order of heat (their dots and links light up),
  until all the group's added genes are in; seeds-only links stay brighter.
- `tower_z` the layer significance (slide 5): each layer of the selected group glows by its z-score and a bar sticks
  out of the rim (a 3D bar chart running up the tower; bars above 1.645 bright, below dim; layers without z show no
  bar).
- `tower_endo` the selected group's genes take endotype colours (a distinct palette of up to 20 hues, consistent
  between story and explore), dimming the group colour.
- `tower_grid` the endotype grid: the selected group's genes gather into blocks, one per endotype, laid out on a grid
  inside the disc (block size by gene count), at the same place in every layer; other genes slide out to a faint ring.
  Links then show which endotypes connect in which layer.
- `tower_pair` the overlap of Congenital Myopathies (group 5) and Hereditary Cardiomyopathies (group 11): the tower
  splits into two towers side by side (Congenital Myopathies left, Cardiomyopathies right), each showing its module
  across all layers, genes found in both in a narrow third column in the middle with bridges to both sides; genes of
  shared endotypes (pairs of endotypes that share genes, from the genes' endotype numbers) in amber; the links of the
  overlap's other layers (`extra`) show; the layers HP, coex_HRA, coex_HRV and ppi_skeletal_muscle glow (slide 8).
- `tower_seedonly` in pair mode: only the seeds and their links stay ("without the walk, the shared architecture is
  missed"), the walk's genes and links fade.
- `tower_drop` robustness: layers fall away one by one in a fixed random order (planes drop a little, fade), while the
  selected group's module stays lit on the layers that remain, its threads intact; at 1 only about 5 layers remain.
- `tower_room` the annulus layout (see above).
Anchors: `top`, `bottom`, `mid`, `ppi` (middle of the protein block), `coex`, `pheno`, functions
`layer(key)` (a point on the rim of that layer), `group(g)` (centroid of group g's module), `endo(g, c)` (centroid of
endotype c of group g, following the grid and pair morphs), `gene(i, layer)` (a gene in a layer), and `pairLeft`,
`pairRight`, `pairMid`. Labels: the six category names on the rim (with layer counts, e.g. "Protein interactions 27
layers") when `tower_cats` > 0.5; the selected group's name; the largest endotypes' names ("7 · Sarcomere
organization") when `tower_endo` or `tower_grid` > 0.5 (at most 6); in pair mode the two group names, "In both", and
the four glowing layers' names. Cam: `default` (whole tower, slightly from above), `ppi`, `top` (from above), `side`,
`grid` (above the grid, el ~55), `pair` (the two towers), `inside` (from the middle, looking out; for the room mode).

Explore API (export on the set; the engine's explore mode and headset panels use it):
- `genes` (decoded: sym, endo per group, seed and added bits, go, hpo, kegg arrays of strings), `groups`, `layers`,
  `ppi`, `N` (gene count), `edgeCount`, `endoCount` (all endotypes), `endoColour(c)` (CSS colour).
- `state`: `{ group: -1 or g, gene: -1 or i, pick: [[g, c], ...], off: Set of layer indices, heat: null or
  Float32Array(N), walk: false }`; `setState(partial)` applies it on the next frame (explore overrides the params:
  in explore the engine sets params from controls and these). `pick` highlights the chosen endotypes (each in its
  endotype colour, threads on, links within a picked endotype in its colour and links between two picked endotypes in
  amber, everything else faint); `gene` rings one gene in every layer with its links and threads; `off` hides layers
  (knocked out: they collapse to a dim rim); `heat` shows a live walk's result.
- `walk(seeds, opts)` runs the random walk on the module network (genes `seeds` as restart points; `opts.on` = which
  layers are on (bool per layer), `opts.weights` per layer, defaults from the group's z-scores; restart 0.7, switch
  0.5) and returns `{ heat: Float32Array(N), top: [gene indices by heat, seeds excluded] }`; with `state.walk` true
  the walkers spark along the live walk's layers.
- `pick(origin, dir)` the gene nearest a ray (local coordinates) among visible points, or -1.
- `links(i)` per layer, gene i's partners (for the gene panel); `linkStats(pick)` per layer, the number of links
  within each picked endotype and between each pair (for the endotype panel).

### `hpc` - the stress test (file `sets/hpc.js`)

Slides 9-10. A supercomputer hall and a sea of towers.
- `hpc_racks` an aisle of supercomputer racks (instanced dark cabinets with rows of small blinking blue and green
  lights, cable trays above, a cool floor glow), seen in perspective; no brand marks.
- `hpc_field` from the racks stream thousands of tiny towers (instanced; at least 2,000 near, points further away,
  suggesting 680,000) standing on a grid floor; each is a stack of thin glowing discs (the tower in miniature) with a
  bright core thread (the disease module).
- `hpc_remove` 0..1: in a wave across the field, more and more discs vanish from each tower (different ones in each),
  but the core thread stays bright until nearly all are gone (at 1 about 5 discs remain); a counter-like progression
  without text.
Anchors: `racks`, `field`, `near` (one tower close to the camera). Labels: "MareNostrum 5" (Barcelona Supercomputing
Center) at the racks, "680,000 networks" at the field. Cam: `racks`, `field`, `near`. Explore: View (Racks / Field),
Removed (None / Half / Most).

## Deliverables

For each set: `sets/<file>.js`, `sets/<file>.md` (manifest: params with meaning and suggested story keyframes,
anchors, labels, cam views, controls, explore API where present, what a narrator may and must not say, sources),
final screenshots `shots/<key>-final-<k>.png`. Test in the harness only (never run the whole app's smoke test;
that is the integrator's job).

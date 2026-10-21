# The endotype story: 3D sets and engine spec

We are adding an eighth story to the web app in `/home/user/airportnetworks`: `stories/endo.js`, built from
`tools/endo/` like the muscle story `stories/nmd.js` is built from `tools/nmd/`. It turns a poster (ISMB 2026,
"Introducing EndotypY: a Python package for network-based disease endotyping", Chloé Bûcheron, Iker
Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie, Jörg Menche; LBI Network Medicine, University of
Vienna) and the package itself (github.com/menchelab/EndotypY, MIT licence) into a narrated, about five-minute 3D
story with an explore mode, on desktop, phones and in VR/AR headsets (Meta Quest Browser). Be bold and beautiful,
as in the tour and the muscle story. Card title: **Endotypes**; tagline "one disease, many mechanisms".

**The rules for sets are those of the tour**: read `tools/lbi/SPEC.md` from the top down to (and including)
"Palette and look", and `tools/lbi/kit.js`. Everything there holds here (runtime, code style, pure `update`, exports,
labels, controls, camera views, performance budget, harness, palette), with these differences:

- Your set files live in `tools/endo/sets/`, the harness is `tools/endo/harness.html` (same query syntax) and the
  screenshot tool is `tools/endo/shot.mjs` (run it from `tools/endo`; shots go to `tools/endo/shots/`, ignored by
  git). Serve the repository root on port 8123 first (`python3 -m http.server 8123` from the root works).
  Playwright: `node_modules` is linked into the repository root, so the tools find it.
- The data is the global constant `ENDO_DATA` (`tools/endo/sets/data.js`, made by `tools/endo/data/gen_data.py`
  from the authors' files, which are not in the repository; never edit it by hand). Its header comment documents
  every field. Decode it once per set (base64 to typed arrays, little-endian).
- The story also uses the muscle story's `motor` set unchanged (`tools/nmd/sets/motor.js`, manifest
  `tools/nmd/sets/motor.md`) for the dive from the motor unit into one junction. Do not edit it.
- No patient data and no variants appear anywhere, and nothing about zebrafish.
- Like the muscle story's tower, the **net** set is a live-ish view of real data, so it may keep state for
  walkers (particles) between frames, but positions, colours and highlights must depend only on the params.

## The data, in short (read the header of `sets/data.js`)

- The **protein network** the authors used: 18,306 proteins (genes), 316,613 links. `pos` gives every gene a point:
  the first 2,000 (`core`) have a 3D layout and names: the 393 module genes first (in tree order, so each endotype
  is a run of consecutive indices), then the genes the walk from all seeds visits most; the other 16,306 sit in a
  thick shell (radius about 1.3 to 2.4) around the core, nearer the more the walk visits them. `links`: 15,000
  links among the core (the module's own 710 first, then module-to-core links, then a sample of the rest).
- **Seeds**: the 35 CMS genes of the Gene Table of Neuromuscular Disorders (`seeds`: symbol, protein name, Gene
  Table item), all in the module (`seedOf`).
- **Seed groups** (`groups`): for neighbourhood sizes k = 1, 2, 3, 4, 5, 10, 20, 30, 50, 75, 100, 150, 200, each
  seed's group: 34 groups at k = 1 (two seeds already share a neighbourhood), 33 at 4, 29 at 10, 10 at 20, 5 at 30,
  2 at 50, one group from 75 on. Group 0 is the largest at each k.
- **The module**: 393 genes = 35 seeds + 358 genes found by the walk. `heat` is the walk from all seeds.
- **Neighbourhoods** (`hood`): each module gene's own walk; its top 1% of the network = 184 genes.
- **Feature matrix** (`featN`, `featI`, `terms`): each gene's own GO cellular-component terms plus the terms
  enriched in its neighbourhood: 393 genes x 457 terms, 4,717 ones (GO Cellular Component 2026; 389 genes have at
  least one term).
- **Tree** (`tree`): 392 merges over the 393 genes in scipy linkage order; `cut` marks the 11 merges that join two
  endotypes (the splits the test accepts); the merges inside an endotype are splits the test refuses.
- **12 endotypes** (`endo`, ids 0..11, as the authors numbered them): name, size, strongest COMPARTMENTS term and
  its adjusted p, `strong` (2 clear, 1 weak, 0 nothing shared), colour (use it everywhere the endotype appears),
  `place` in the synapse, its seeds:

| id | n | name | place | seeds |
| --- | --- | --- | --- | --- |
| 0 | 9 | No shared place | - | RAPSN |
| 1 | 29 | Mitochondria | mito | PREPL, SLC25A1 |
| 2 | 47 | Basement membrane | lamina | COLQ, AGRN, COL13A1, LAMB2, LAMA5 |
| 3 | 26 | Golgi | golgi | CHRNE, DPAGT1, ALG14 |
| 4 | 12 | No shared place | - | SLC18A3 |
| 5 | 35 | Ion channels | channels | CHRNB1, CHRND, SCN4A, TOR1AIP1 |
| 6 | 13 | ER membrane | er | VAMP1 |
| 7 | 17 | No shared place | - | CHRNA1 |
| 8 | 15 | Endosomes | endosome | - |
| 9 | 25 | Vesicles | vesicles | SYT2, MUSK, ALG2, SNAP25, RPH3A |
| 10 | 34 | Muscle scaffold | scaffold | DOK7, SLC5A7, PLEC |
| 11 | 131 | The junction | junction | CHAT, GFPT1, LRP4, CHD8, UNC13A, GMPPB, MYO9A, DES, CHRNG |

Endotypes 0 and 7 have no links among their own genes (the poster's overview leaves them out; the story shows them
as loose clouds). Endotype 11 is big and mixed (its strongest term, neuromuscular junction, is weak).

## Shared facts (use exactly)

- **Congenital myasthenic syndromes (CMS)**: a diverse group of inherited, mostly autosomal recessive, rare
  disorders of the neuromuscular junction (NMJ), the synapse where a motor nerve tells a muscle fibre to contract.
  Hallmark: fatigable muscle weakness (weakness that grows with use). More than 30 causal genes (CHRNA1, MUSK, AGRN,
  DOK7 among the classic ones). Symptoms range from mild exercise intolerance to severe generalised fatigue,
  impaired gait and reduced breathing capacity, even in patients with the same causal mutations; additional genetic
  modifiers in networks (such as those of the extracellular matrix and the clustering of acetylcholine receptors)
  are thought to drive much of that range (Núñez-Carpintero et al., Nat Commun 2024).
- **Endotypes**: molecularly defined subtypes of a disease, groups of disease genes that are cohesive both in the
  network and in function; more accurate and more actionable than classic subtypes.
- **EndotypY** (spelled so): an open-source Python package (github.com/menchelab/EndotypY). Input: seed genes and a
  biological network. Steps: (1, optional) seed-subgroup exploration: expand each seed by its top-k walk
  candidates and see whether the seeds form one neighbourhood or several; (2) network expansion by **random walk
  with restart (RWR)**: walkers start at the seeds and at every step jump back to a seed with probability 0.8,
  otherwise hop to a random neighbour; the genes they visit most join the seeds until the module is connected (the
  "connector" genes; the result is the core or disease module); (3) functional neighbourhood annotation: for each
  module gene its own walk, the top 1% of genes as its neighbourhood, gene-set enrichment on that neighbourhood
  (GSEApy with Enrichr libraries, over 100 of them: GO, KEGG, MSigDB, CORUM ...), plus the gene's own terms, giving
  a binary gene x term matrix; (4) endotypes by statistically filtered hierarchical clustering
  (**Tree2BreakSpace**, Sakalli et al., in progress): build a tree of the genes from the matrix, then test every
  split (a divergence test of the term distributions of the two sides) and keep a split only when the data support
  it, instead of cutting the tree at a fixed height; (5) views: a combined endotype network, a grid of endotypes, and
  a metagraph with each endotype as a meta-node.
- **What it is for** (poster): precision medicine and patient stratification (classify patients by mechanism, not
  by broad symptoms); drug repurposing (find targetable pathways per endotype); linking rare and common diseases
  (it found the "connectors" between monogenic and polygenic forms of autoimmunity, Guthrie et al., Sci Adv 2023).
- **The poster's four endotypes** (say these, attributed to the authors' analysis):
  - 1 Mitochondria: presynaptic mitochondrial activity. SLC25A1 exports citrate from mitochondria in exchange for
    malate; the nerve ending makes acetyl-CoA from it, which it needs to make the transmitter acetylcholine.
  - 9 Vesicles: genes for forming and releasing synaptic vesicles in the nerve ending (SYT1, SYT2, SNAP25, STX19,
    RPH3A among them). Several of its genes are perturbed by givinostat, a treatment for Duchenne muscular
    dystrophy, another rare neuromuscular disease (a lead for drug repurposing; never say it treats CMS).
  - 5 Ion channels: acetylcholine receptor subunits (CHRNB1, CHRND), whose opening starts the muscle's action
    potential, and sodium channels (SCN4A, SCN8A, SCN1B) that carry it on; other channels too.
  - 2 Basement membrane: extracellular matrix, the synaptic cleft's basement membrane (COLQ, AGRN, LAMB2, LAMA5,
    COL13A1 ...), which holds the junction together and anchors acetylcholinesterase.
- **Illustrative**: the endotypes are the authors' result on their network. The steps shown before them (seed
  groups, the walk, neighbourhoods, the matrix, the tree) were re-run on the same network with the package's
  default settings to show how the method works; the tree is drawn to agree with the authors' endotypes. Say so
  once, briefly (an explore-mode note and the last chapter's small print), never in a way that undermines the result.

### Where the 35 seed genes act at the junction (for the synapse set)

Nerve ending (presynaptic): CHAT (makes acetylcholine in the cytosol), SLC5A7 (choline transporter in the terminal's
membrane: recycles choline from the cleft), SLC18A3 (VAChT, loads acetylcholine into vesicles: vesicle membrane),
SYT2 (synaptotagmin 2, the vesicles' calcium sensor), VAMP1 (synaptobrevin on the vesicle), SNAP25 (on the
terminal's membrane at the active zone; with VAMP1 and syntaxin it zips the vesicle to the membrane), UNC13A
(Munc13-1, primes vesicles at the active zone), RPH3A (rabphilin, on vesicles), PREPL (in the terminal's cytosol),
MYO9A (in the terminal; actin-based motor), SLC25A1 (inner membrane of the terminal's mitochondria).
Synaptic cleft (basement membrane): COLQ (collagen tail that anchors acetylcholinesterase), AGRN (agrin, made by the
nerve, laid into the basement membrane), LAMB2 (laminin beta-2) and LAMA5 (laminin alpha-5), COL13A1 (collagen
XIII, at the muscle's surface in the cleft).
Muscle membrane (postsynaptic): the acetylcholine receptor, a pentamer of two alpha (CHRNA1), one beta (CHRNB1), one
delta (CHRND) and one epsilon (CHRNE; gamma, CHRNG, replaces epsilon before birth), packed on the crests of the
junctional folds; RAPSN (rapsyn, under the receptors, clusters them); LRP4 (agrin's receptor) with MUSK (the kinase
it switches on), DOK7 (MuSK's partner, inside); SCN4A (Nav1.4 sodium channels, in the troughs of the folds).
Inside the muscle fibre: DPAGT1, ALG2, ALG14 (endoplasmic reticulum: the first steps of N-glycosylation, sugar chains
for receptors and other membrane proteins), GFPT1 and GMPPB (cytosol: make the sugar building blocks), PLEC
(plectin, links the membrane and the scaffold), DES (desmin filaments round the myofibrils' Z-discs), TOR1AIP1
(LAP1, in the nuclear envelope of the junction's own nuclei), CHD8 (in those nuclei, a chromatin remodeller).
These placements are textbook (UniProt); the authors will check them.

## The sets

### `syn` - the neuromuscular junction, close up (file `sets/syn.js`) - the hero

A cut-away section through one junction, in real 3D, illustrative but anatomically right, about 2.4 units across,
centred on the origin. Up (+y) is the nerve, down the muscle; the cut face looks towards +z (the default view sees
it in three-quarters, a little from above). Real proportions are a guide (bouton a few micrometres, vesicles 50 nm,
cleft 50 to 80 nm, folds 0.5 to 1 micrometre deep); exaggerate small things enough to be seen.

- **Nerve ending** (upper half): a smooth translucent bouton (cut open along z so its inside shows; glassy membrane
  with a soft rim light), with its axon arriving from above-left and a thin **Schwann cell** cap draped over it.
  Inside: about 150 **synaptic vesicles** (instanced spheres), clustered over 3 to 5 **active zones** (dense bars
  on the membrane facing the cleft, each opposite the mouth of a fold, as in textbooks), a few docked at the membrane; 3 to 4
  **mitochondria** (elongated capsules with visible cristae through a cut); 2 to 3 **endosomes** (larger, irregular,
  slightly darker vesicles); a faint actin mesh.
- **Synaptic cleft**: a gap between the nerve and the muscle; the **basement membrane** runs through it and dips into
  every fold: a fibrous, gently glowing mesh (laminin crosses, collagen threads), with acetylcholinesterase (small
  globular trios) on COLQ triple-helix tails, and agrin strands reaching from the nerve's side to the muscle.
- **Muscle side**: the muscle membrane (sarcolemma) thrown into 5 to 7 deep **junctional folds** under the bouton
  (ridges and troughs); on the crests dense carpets of **acetylcholine receptors** (instanced pentamers seen as
  five-petal rosettes from above, a pore in the middle; colour the subunits faintly: alpha, alpha, beta, delta,
  epsilon) with rapsyn dots under them, a few MuSK/LRP4 pairs among them; **sodium channels** (Nav1.4) in the
  troughs. Below: the fibre's interior with one or two of the junction's own **nuclei** (TOR1AIP1 in the envelope,
  CHD8 inside), **endoplasmic reticulum** sheets and a **Golgi** stack next to a nucleus, a mitochondrion or two, and
  at the bottom the start of the **myofibrils** (striated bundles with Z-discs, desmin filaments round them).
- **Acetylcholine**: tiny bright points.

Params:
- `syn_a` fade. `syn_build` 0..1: the junction assembles (default 1).
- `syn_fire` 0..1: firing. A nerve impulse arrives (a glow down the axon into the bouton), calcium flashes at the
  active zones, a few docked vesicles fuse (they flatten into the membrane, with a puff of acetylcholine points that
  crosses the cleft), the receptors on the crests light where it lands (open), a wave runs along the muscle membrane
  into the folds' sodium channels, and the myofibrils at the bottom twitch. Driven by `t`: about one impulse a
  second at 1, none at 0.
- `syn_tired` 0..1: fatigable weakness. With firing on, each successive impulse releases less and opens fewer
  receptors, and the twitch shrinks (cycle the run-down every few impulses so it loops). 0 healthy.
- `syn_genes` 0..1: the 35 seed genes light up where they act (table above): a small glowing marker at each place
  (in the colour of the gene's endotype from `ENDO_DATA`), with grouped labels (see Labels).
- `syn_place` 0..12: one endotype's place glows in its colour and the rest dims (`syn_place` = id + 1; 0 none;
  round it); for ids without a place (0, 4, 7) nothing glows but the whole scene dims a little.
- `syn_endo` 0..1: **the endotypes arrive**: for each endotype with a place, a small cloud of its genes (glowing
  dots in its colour, as many as it has genes, up to 40) flies in from above the scene and settles round its
  place; 0, 4 and 7 stay hovering loose above the scene. Staggered by id. (The story crossfades from the tree set's
  endotype view to this.)
Anchors: `axon`, `terminal`, `vesicles`, `activezone`, `mito`, `endosome`, `cleft`, `lamina`, `receptors`, `folds`,
`channels` (a trough's sodium channels), `nucleus`, `er`, `golgi`, `scaffold` (myofibrils with desmin and plectin),
`fibre`, `gap` (the middle of the cleft, for standing inside), `junction` (the centre), and `place` (a function: the
current `syn_place`'s point). Every endotype place key above must be an anchor.
Labels (at most about six at once, by the params): Nerve ending, Synaptic vesicles, Mitochondrion, Basement
membrane, Acetylcholine receptors, Junctional folds, Muscle fibre; with `syn_genes` the gene groups instead:
"CHAT · SLC5A7 · SLC18A3" (making and recycling acetylcholine), "SYT2 · VAMP1 · SNAP25 · UNC13A · RPH3A" (release),
"SLC25A1" (mitochondrion), "COLQ · AGRN · LAMB2 · LAMA5 · COL13A1" (basement membrane),
"CHRNA1 · B1 · D · E · G" (receptor), "RAPSN · MUSK · LRP4 · DOK7" (clustering), "SCN4A" (sodium channel),
"DPAGT1 · ALG2 · ALG14 · GFPT1 · GMPPB" (sugar chains), "PLEC · DES" (scaffold), "TOR1AIP1 · CHD8" (nucleus),
"PREPL · MYO9A" (nerve ending); with `syn_place` its endotype's name ("Endotype 2 · Basement membrane").
Cam: `default` (three-quarter view of the whole section), `terminal`, `cleft` (low, close, along the cleft),
`receptors` (onto a crest), `folds`, `nucleus`, `gap` (inside the cleft, looking along it), `wide` (pulled back, the
fibre's surface around the junction).
Controls: View (Junction / Nerve ending / Cleft / Folds / Inside the fibre), Firing (Still / Firing / Until tired),
Genes (Off / On). Explore API from `explore(c)` as usual; also export `showPlace(id)` (or accept `c.place`) so the
engine's Endotypes tab can light an endotype's place.
Performance: it is the hero, but must run on a Quest: instance the vesicles, receptors and lamina pieces; aim under
150 draw calls and 400k triangles.

### `net` - the protein network, the seeds and the walk (file `sets/net.js`)

The authors' protein network as a cloud of 18,306 points (`pos`, scale 1 unit = 1 position unit; the core about 2
units across, the shell to radius 2.4): points small and soft, in cool blue-grey, brighter and larger for the core;
the 15,000 core links as faint additive lines; the module genes a little larger. A dark background (the engine's).
- `net_a` fade. `net_cloud` 0..1: the cloud appears (from the centre outwards; default 1).
- `net_seeds` 0..1: the 35 seeds glow white-hot and grow, everything else dims a little; labels of a few seeds.
- `net_k` 0..12 (fractional): seed groups at neighbourhood size `ENDO_DATA.groups.k[round]`: each seed gets a soft
  halo whose size grows with k, seeds are coloured by group (group 0 a strong colour; the rest a palette), and seeds
  in one group are joined by glowing arcs; between integer values the halos grow smoothly and colours crossfade. A
  label shows "k = 20 · 10 groups".
- `net_walk` 0..1: walkers: up to 300 bright particles start at the seeds and hop along links (on screen a hop takes
  about 0.25 s, gliding along the link), and with probability 0.8 per hop they jump back to a seed (shown as a quick
  streak back home); trails fade behind them. Nodes they visit warm up. Use the core links (the module's links are
  among them); a walker at a gene with no stored link restarts.
- `net_heat` 0..1: colour every node by `heat` (cool to warm), seeds hottest.
- `net_module` 0..1: the module (the first 393 nodes) pulls together and forward: its genes move from the cloud to a
  compact module layout (compute it at load with a quick force layout of the 393 genes and their 710 links, scaled
  to about 1.2 units), their links brighten, the rest of the cloud fades to a faint haze. Seeds stay
  white; the 358 found genes take a warm colour.
- `net_endo` 0..1: module genes take their endotype colours.
- `net_gene` -1..392 (an index into the module, -1 none) with `net_hood` 0..1: that gene's 184-gene neighbourhood
  lights up across the cloud (`hood`), with lines from the gene to its neighbourhood genes that are in the core, and
  a bubble round the gene.
Anchors: `centre`, `module`, `seeds` (their centroid), `gene` (the current `net_gene`, or the module's centre),
`hood`. Labels: "18,306 proteins" (with `net_cloud`, before `net_seeds`), "35 seed genes", the k label, "The module ·
393 genes" (with `net_module`), the current gene's name. Cam: `default` (the whole cloud), `core`, `module`, `gene`
(near the current gene). Controls: View (Network / Module), Walkers (Off / On), Colour (Walk / Endotypes).
Explore API (returned by a function `api()` on the set object): `setGene(i)`, `geneIndex(name)`, `names` (the
module's names in order), `pick(raycaster)` -> module index or -1.

### `tree` - from neighbourhoods to endotypes (file `sets/tree.js`)

- **The matrix**: 393 rows (genes, tree order) x 457 columns (terms) as a wall of small glowing cells (instanced
  quads or points, only the 4,717 ones drawn bright, the zeros as a faint grid), about 1.6 wide and 1.4 tall, facing
  +z; order the columns so the picture shows structure (for example by the mean row index of each term's ones).
  `tree_matrix` 0..1 fills it row by row (a scan line).
- **The tree**: the dendrogram (`tree.ab`, `tree.h`) beside the matrix (to its left, leaves at the rows, the root at
  the far left), in 3D: thin glowing lines, slightly curved. `tree_tree` 0..1 grows it from the leaves to the root.
- **The tests**: `tree_test` 0..1: a pulse runs from the root down the branches; at each merge with `cut` 1 a bright
  check (the split is kept) and the two sides part a little; at merges inside an endotype the pulse fades (refused:
  a small dim cross). As it passes, each endotype's subtree and rows take its colour.
- **Tree distances**: `tree_mds` 0..1: the genes fly from their rows to positions laid out by their tree distances (a
  3D scatter, about 1.6 across, computed at load), coloured by endotype.
- **The endotype network** (the poster's metagraph): `tree_meta` 0..1: each endotype becomes a translucent soft
  bubble (a blob or rounded hull) with its genes as dots inside and its own links among them (the module's links,
  from `links`), arranged on a ring (as on the poster: biggest, 11, at the top); grey bands between endotypes, as
  wide as the number of links between them; 0 and 7 (no links among their genes) float loose and smaller. Labels
  with id and name ("1 · Mitochondria").
- `tree_focus` 0..12 (id + 1; 0 none): that endotype comes forward and brightens, the others dim.
Anchors: `matrix`, `tree`, `root`, `mds`, `meta`, `focus` (the focused endotype, or the ring's centre), and `e0` ..
`e11` (each endotype's bubble). Labels: "393 genes × 457 terms" (matrix), "Tree of genes" (tree), "12 endotypes"
(meta), endotype names in meta. Cam: `default` (matrix and tree), `matrix`, `tree`, `mds`, `meta`, `focus`.
Controls: View (Matrix / Tree / Distances / Endotypes). Explore API `api()`: `setFocus(id or -1)`,
`pick(raycaster)` -> { gene: index } or { endo: id } or null.

## The engine (`tools/endo/engine/`, copied from the muscle story; adapt it)

Rename everything from the muscle story to this one: `HOST.register('endo', ...)`, the header comment (the poster
and authors above), `audio/narration-endo.mp3`, `SET_ORDER = ['motor', 'syn', 'net', 'tree']`, the shared-room
hooks unchanged (see "Shared rooms" in `AGENTS.md`: keep every hook line exactly), the headset code (`e5_xr.js`)
unchanged except for "Stand in the gap" (below).

**Chapters** (about 5:10; `CH` keys and times; the narration may later be recorded to these):
1. `title` 0-14: title card over the motor unit ("Endotypes: one disease, many mechanisms").
2. `tired` 14-40: the motor unit (`motor`, `motor_signal` on, `motor_site` 3: the junction glows), the camera dives to
   a junction; crossfade into `syn` (`wide`, then `default`), firing, then `syn_tired` up: the twitch fades. Text:
   CMS, fatigable weakness, the range of severity.
3. `genes` 40-70: `syn` with `syn_genes`: the 35 genes where they act; more than 30 causal genes, but the same
   mutation can be mild or severe: genes alone do not explain the range; endotypes might.
4. `cloud` 70-108: crossfade to `net`: the cloud ("18,306 proteins"), the seeds; `net_k` steps 0 -> 12 (34 groups ->
   one): the seeds belong to one neighbourhood.
5. `walk` 108-148: walkers with restart (0.8), heat, then `net_module`: 35 seeds + 358 found = the module (393).
6. `hood` 148-185: one gene (pick a seed in endotype 2 or 9, for example COLQ or SNAP25) and its 184-gene
   neighbourhood (`net_gene`, `net_hood`); its shared places become a row; crossfade to `tree` with `tree_matrix`:
   the 393 x 457 matrix fills.
7. `split` 185-225: `tree_tree` then `tree_test`: a tree that splits only when the data say so (Tree2BreakSpace);
   12 endotypes; a glance at `tree_mds`.
8. `endotypes` 225-285: `tree_meta` (the poster's view), then focus on 1, 9, 5, 2 in turn with their stories (the
   four above); then crossfade to `syn` with `syn_endo` (each endotype flies to its place) and `syn_place` stepping
   through 1, 9, 5, 2.
9. `next` 285-310: what for (patients by mechanism, drug repurposing, rare and common diseases), EndotypY is open
   source (pip install, github.com/menchelab/EndotypY), the six authors and the institute; small print: "Endotypes:
   the authors' result. The steps before them: re-run with the package's defaults to show the method."

Text: plain British English, short sentences, no jargon without a gloss; every number from `ENDO_DATA` (`FACTS`),
none hard-coded; chapter panels with `data-at` fade-ins as in the muscle story. Story labels on set anchors.

**Explore mode** tabs (HTML and canvas twins, as in the muscle story):
- **Endotypes**: 12 chips (colour, id, name, size); picking one lists its genes (seeds marked), its strongest term
  and strength ("clear", "weak", "nothing shared"), its place in the synapse, and shows it in the current scene
  (`tree_focus`, `net_endo` with its genes bright, or `syn_place`).
- **Genes**: search the 393 module genes (and only them); a gene shows: its endotype, seed (with protein name and
  Gene Table item) or found by the walk, its terms (from the matrix), its links in the module; buttons: show its
  neighbourhood (`net_gene`, `net_hood`), show it in the tree.
- **Method**: the five steps as a stepper (Seed groups, The walk, Neighbourhoods, The tree, Endotypes), each with
  one sentence and its control: a slider or buttons for k (13 values, with the group count), walkers on/off, a gene
  for the neighbourhood, tests replay, metagraph; and the illustrative note.
- **Scenes**: Synapse (`syn` controls), Network (`net`), Tree (`tree`), Motor unit (`motor`), as in the muscle story's
  Scenes tab.
URL hashes: `#endo&t=120`, `#endo&explore&endo=2`, `&gene=COLQ`, `&scene=syn&view=cleft`, `&k=20`, `&inside` (stand in
the gap). `collab.state()`: tab, scene, every scene's controls, endotype, gene, k, step (plain JSON, the same on every
device; `apply(state())` gives the same state back).

**Stand in the gap** (as the muscle story's *Stand inside*): on screen a view from inside the cleft; in a headset
the `syn` set life size around you at a scale where the cleft is at your chest: the nerve ending's vesicles above
your head, the receptor-covered folds at your hips and the muscle below. Explore view control and the Scenes tab.

## Deliverables

For each set: `sets/<file>.js`, `sets/<file>.md` (manifest: params with meaning and suggested story keyframes,
anchors, labels, cam views, controls, explore API, what a narrator may and must not say), final screenshots
`shots/<key>-final-<k>.png` (small: 640x400). Test in the harness only (never run the whole app's smoke test; that is
the integrator's job). The engine: `engine/*.js` adapted, `node tools/endo/build.mjs` builds `stories/endo.js`.

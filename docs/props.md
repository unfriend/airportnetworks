# Props: the catalogue of 3D sets

Every 3D scene the stories are made from is a **set** (a "prop"): a self-contained group of meshes that the story engine fades in and out, flies the camera round, and drives with numbers called **params**. This page lists all of them, for the planned story design room and for a player that plays stories written as data. The machine-readable twin is `tools/design/props.json` (same facts, one object per set). Where a manifest and the code disagree, the code is right: the disagreements are listed at the end.

Sources: each set's manifest (`tools/<story>/sets/<name>.md`) and code (`tools/<story>/sets/<name>.js`), the set contract `tools/lbi/SPEC.md`, and the stories' engines for which params are steps. The params, defaults, camera views, controls, anchors and labels below were read by building every set in Node (three.js runs there; nothing is drawn) and dumping what its returned object holds.

## How to read an entry

- **Params** are numbers the set reads as `S.<name>` every frame. Names start with the set's key (`atp_build`); `<key>_a` is the set's fade, applied by the engine. *Range* is what the value means; `used` is the range the home story's keyframes actually use. *Eased* is yes for values the engine may glide between; **no** marks step params (indexes, counters, picks) that must jump: in explore mode the engine writes them straight to the target, in a story they are keyed with `jump()`. The set must look right at in-between values of every eased param; update is a pure function of params and time, except the live simulations (flock, robots, fish).
- **Views** are named camera views `[az, el, dist, tx, ty, tz]`: degrees, degrees, local units; the camera stands at target + dist * (cos el sin az, sin el, cos el cos az), az 0 looking from +z towards -z, vertical field of view 32 degrees; dist 3.6 frames a radius-1 set. Some views are getters (computed from the set's data) and some change with a param; the values here are the defaults.
- **Controls** are the explore mode's rows of buttons; `explore(c)` turns the chosen values into param targets (the params it drives are listed).
- **Anchors** are named points in the set's own frame for labels and camera targets; **labels** are the set's own, each shown by a rule on params.
- Param names are prefixed with the set key, so the four keys that occur twice (`organs` in the PET and microanatomy stories, `tree` in the endotype and mutation stories, `tower` in the muscle and topology stories, `slide` in the microanatomy and topology stories) need a namespace (use `<story>/<key>` ids, as here) when a player mixes sets of different stories.
- A story reuses a set by pasting its source into its build; the engine parts (camera, labels, explore, headset code) are each story's own and are not part of a set. A set needs from the engine: the kit `K` (`tools/lbi/kit.js`), the params object every frame (`update(S, t, dt)`), the camera and label machinery for `cam`, `anchors` and `labels`, and, for sets with extra exports (`api`, `idle`, `finish`, `keepClear`, `see`, `setRoom` ...), the calls named in their notes.

## Overview

| id | story | what it shows | frame and size | params | views | data |
| --- | --- | --- | --- | --- | --- | --- |
| `lbi/int` | lbi | A big glowing human protein interaction network (about 9,100 proteins, 22,100 interactions) with a dense centre and filaments towards the rim. The story lights curated… | radius ~1 | 28 | 8 | mixed |
| `lbi/mac` | lbi | A beige 1990s all-in-one computer (no brand marks) on a table. It switches off like a CRT, comes apart in the order of a real teardown, every part lands in neat rows,… | table 1.76 x 1.48 (corners reach radius ~1.15); network radius ~0.6 | 4 | 7 | none |
| `lbi/web` | lbi | Networks are everywhere: first the internet as a tree-like network of 15,938 nodes and 16,359 links in the style of the Opte maps, then a dark globe with the 3,214… | globe radius 1; internet about radius 1 | 5 | 5 | mixed |
| `lbi/dna` | lbi | A long DNA double helix is written from the middle outwards, coils into the 23 chromosomes, threads grow from genes and fold into 25 AlphaFold-style protein chains in a… | helix, karyotype and grid ~radius 1; field radius ~15 (default view… | 6 | 5 | mixed |
| `lbi/atp` | lbi | ATP synthase in three looks: a grid of its 13 AlphaFold-like chains, the assembled complex in a lipid membrane (protons turn the rotor, ATP pops out of the head), and… | 1.2 units tall | 8 | 6 | mixed |
| `lbi/crowd` | lbi | 6,000 instanced lit people. The first crowd of 422 stands in curved rows; one turns red and glows under a beam of light; the other 5,578 then rise out of the floor… | first crowd ~2.3 x 2.0 (radius 1.45, exported as radius); grown sea… | 3 | 3 | none |
| `lbi/sankey` | lbi | A 3D Sankey diagram, 9 clinical categories on the left against 19 molecular clusters on the right, joined by 58 ribbons whose height is the gene count; each category's… | ~1.45 wide, 1.47 tall | 14 | 4 | real |
| `lbi/scale` | lbi | A glowing tower of eight length scales (DNA bases, proteins, ATP synthase, a mitochondrion, a cell, a tissue, a brain, a body), with an amber time spiral, small… | ~2.45 tall, discs radius ~1 | 8 | 7 | none |
| `lbi/body` | lbi | A standing figure, arms raised and hands crossed over the head, as a total-body PET maximum-intensity projection (about 52k glowing points, max blending, hot-iron… | 1.9 tall; the network cage spans y -0.42 to 0.8 and ~1.3 wide with… | 5 | 5 | illustrative |
| `lbi/tissue` | lbi | An H&E-stained section of stomach wall built from about 18,600 cells: zoom in and every cell is there, join cells to neighbours for a network, switch to multiplexed… | ~2.1 long, up to 0.6 deep | 4 | 6 | illustrative |
| `nmd/tower` | nmd | The multiplex network of rare muscle diseases: 71 layers of gene links (phenotypes, pathways, drug targets, co-essential genes, 39 co-expression layers, 27… | ~2.2 tall, discs radius 1 | 15 | 8 | real |
| `nmd/motor` | nmd | The motor unit from nerve to sarcomere, and the heart: spinal cord, motor and sensory neurons, myelinated axons, six neuromuscular junctions, a fascicle of 20 striated… | ~2.5 long (x -1.18 to 1.27, y -0.5 to 0.7) | 8 | 8 | none |
| `nmd/hpc` | nmd | The stress test on a supercomputer: a hall of racks with a cold aisle, blinking lights, cable trays and a glass door, and the field of tiny towers it computes,… | 1 unit ~ 4 m (racks 2 m tall); field far beyond the usual radius on… | 4 | 5 | none |
| `endo/syn` | endo | One neuromuscular junction close up as a cut-away: a glass nerve bouton with vesicles, active zones, mitochondria and Schwann cell; the synaptic cleft with basement… | ~2.4 across (x -1.2 to 1.2); 1 micrometre ~ 0.5 units; small parts… | 8 | 8 | mixed |
| `endo/net` | endo | The authors' protein network (18,306 proteins) as a deep glowing cloud: the 35 congenital-myasthenic seed genes, their neighbourhoods growing and merging as k rises,… | ~4.8 across (larger than the usual radius 1.1) | 11 | 5 | real |
| `endo/tree` | endo | From neighbourhoods to endotypes: the gene x term matrix (393 x 457) fills row by row, a dendrogram grows beside it, a test pulse runs down the tree (green check at… | not stated in the manifest (see views) | 7 | 18 | real |
| `pet/scan` | pet | A glossy PET/CT scanner (no brand, no text) with a patient on the couch, shown as a studio product shot. A plane cuts the housing away to show the detector ring of… | gantry 2.02 wide, 2.1 tall; scanner life size | 10 | 7 | mixed |
| `pet/organs` | pet | Organs, uptake and the cohort network, drawn on the body: a scan plane segments 14 organs (translucent shells with outlines), 14 uptake bars to the body's right (aorta… | body-sized; bars x 0.40 to 1.1; slab 0.47 to 1.13 | 15 | 8 | figures |
| `pet/liver` | pet | An organ is a network too: a liver made of 3,000 small patches joined into a network (about 19,700 links) by the poster's rule, with its gallbladder and falciform… | 1.65 wide, 0.99 tall, 0.77 deep (about 1 unit = 13 cm) | 5 | 5 | illustrative |
| `micro/organs` | micro | Small lit 3D models of the 29 organs of the microanatomy atlas (adipose to vagina), each a signed distance field of a few primitives polygonised by surface nets,… | drawn small (organ nodes on the network ring are radius 0.062 +… | 5 | 1 | none |
| `micro/slide` | micro | The preprint's method (H&E-UTAG) shown on one section: it is cut into tiles, a vision model describes each as glowing blocks, a network of neighbours passes messages,… | as the tissue slab (~2.1 long) | 10 | 8 | mixed |
| `micro/atlas` | micro | The slide library as a curved wall of glass slides, the atlas of 40 sections standing in relief on a 10 x 4 arc with each section's organ model, a cloud of tiles, the… | not stated in the manifest (see views) | 9 | 10 | figures |
| `micro/hier` | micro | Organ architecture as a four-level hourglass network (29 organs, 24 tissues, 10 tissue types, 70 domains) with glowing curved links, each organ its small 3D model, and… | radius ~0.9; node sizes by degree | 6 | 4 | real |
| `ovary/organ` | ovary | A large cut-away ovary (almond-shaped, tunica albuginea, cortex and medulla) with antral follicles, scars (corpora albicantia), vessels and a corpus luteum, whose… | ~1.9 long, 1.1 tall, 0.9 deep | 12 | 8 | figures |
| `ovary/section` | ovary | A drawn H&E section of an ovary with blood vessels, macrophages, corpora albicantia, follicles and cysts in relief; tiles, UNI2 features and a forest of decision trees… | section ~1.9 x 1.5, 0.03 thick | 17 | 9 | mixed |
| `ovary/charts` | ovary | Only the donors in 3D: 255 glass slides fly in, fan out in three arcs and stack into the poster's age histogram, one slide per donor. The story's one graph, shown in… | not stated in the manifest (see views) | 3 | 3 | real |
| `qubits/pairs` | qubits | Why pairs: a grid of all pairs of genes grows; the example network as a city map with two walkers settling into valleys; a chip with three qubits; and the map folding… | not stated in the manifest (see views) | 10 | 6 | illustrative |
| `qubits/cube` | qubits | The cuts and the coarse operator: the network is cut in two, four and eight and its genes fly to the corners of a cube; the coarse operator A_c lives on the cube; Pauli… | not stated in the manifest (see views) | 14 | 5 | illustrative |
| `qubits/chart` | qubits | The real run's best residual by depth (our cuts against random ones, with the example network's own residuals live at 1 to 3 bits) and one Trotter step at 3 bits in… | not stated in the manifest (see views) | 10 | 3 | mixed |
| `mutation/letters` | mutation | A text in four letters copied with swaps: a 24-pair DNA helix, eight letters peeling into tiles (ACGTTAGC), two copies with swaps flashing, then one letter opened into… | not stated in the manifest (see views) | 14 | 6 | mixed |
| `mutation/tree` | mutation | A family tree in 3D (8 tips, 14 branches) that grows up from its root as a level of change rises (a branch rises by its length), every swap simulated, letters riding up… | tree ~2.06 units tall with letters, widest radius 1.18 | 11 | 11 | illustrative |
| `mutation/rule` | mutation | The rule of change: four letter balls at the corners of a pyramid joined by rate arrows, the pyramid of mixes and a point gliding along its path, the compiler (a drum… | pyramid x +-0.93, y -0.5 to 1.2; machine x -1.15 to 1.05 | 15 | 10 | illustrative |
| `mutation/stem` | mutation | Letters that work together: an RNA strand folds into a stem of six pairs, one letter changes alone and its rung snaps, a coupling makes the pair change together, the… | stem ~radius 1; fields in front of the root | 18 | 10 | mixed |
| `topo/slide` | topo | Real tissue on its glass slide drawn in H&E from cells alone: the healthy tile of 640 um round the poster's patch (945 cells) and the new slide's window of 1.5 mm… | 1.6 across | 7 | 12 | real |
| `topo/map` | topo | The signal back on the tissue: one cell's 50 um neighbourhood and its own network, bars and score; every cell scored as a relief; the two groups (healthy-like,… | 1.6 across | 11 | 10 | real |
| `topo/tower` | topo | The poster's patch of 110 real cells with glass balls growing round them, edges and triangles appearing, pieces joining and loops opening and closing, then the tower of… | plate 1.5 wide; tower 1.68 units with the trunk | 6 | 7 | real |
| `topo/cohort` | topo | The 123 slides as a rack of glass slides with their curves (66 healthy, 57 cirrhotic), the classes' means, the main shapes, the cube of scores, the classifier's wall… | rack plus a weights column out to x ~2.05; cube of scores 1.6 across | 15 | 11 | real |
| `pass/fish` | pass | A school of 300 fish (30 to 600, a live simulation) all around you, each watching its seven nearest neighbours; water, seabed with caustics, rocks, seagrass, light… | life size; fish 0.27 m long | 8 | 5 | none |
| `pass/globe` | pass | The airports story's globe exactly as it is (3,214 airports, 18,858 routes), driven from params, with a seeded S/E/I/R outbreak on its real routes: pick a start… | radius 1 | 8 | 6 | real |
| `pass/cell` | pass | The cell map story's cell exactly as it is (249 proteins in 13 places, 252 links, 10 organelles, 7 moves): organelles appear one by one, proteins and links by place or… | radius 1 | 21 | 6 | illustrative |
| `flock/flock` | flock | Starlings at dusk all around you: 200 birds (50 to 400, a live simulation), each following its seven nearest neighbours, keeping its distance and fleeing a falcon with… | life size; sky to the horizon, 2,600 reeds within 32 m | 6 | 3 | none |
| `robots/robots` | robots | A gang of 6 to 24 robot vacuums (a live simulation) in a living room: dock, bump and turn, follow you, conga line or keep away; each robot follows rules about who it… | life size; robot radius 0.17 m | 10 | 3 | none |

Data kinds: **real** = the authors' or a public dataset; **figures** = numbers typed from a paper or read off its figures; **mixed** = real facts with illustrative geometry; **illustrative** = drawn or computed live for an example; **none** = drawn or a live simulation.

## Shared frames and reuse

- `lbi/body` is used unchanged by the PET, microanatomy, ovary and topology stories; `pet/organs` and `ovary/organ` are drawn in its frame and shown together with it (feet at y -0.95, 1.9 tall, faces +z); the PET scanner embeds an instance of it inside the patient.
- `lbi/tissue` (the stomach-wall H&E slab) is used unchanged by the microanatomy story; `micro/slide` is an overlay in its frame and shown together with it.
- `micro/organs` (the `ORGAN3D` models of 29 organs) is read by `micro/atlas`, `micro/hier` and the topology story's liver scene.
- `nmd/motor` (the motor unit and the heart) is used unchanged by the endotype story.
- `topo/slide` and `topo/map` share the slide's frame (the window of 6,716 cells); `mutation/tree` and `mutation/stem` share the tree's frame; `micro/atlas` hands over to `micro/hier` (`atlas_net` with `hier_grow`, keyed at the same times).
- `pass/globe` and `pass/cell` are the airports story's globe and the cell map story's cell, cut unchanged out of `stories/airports.js` and `stories/spatial.js` at build time by `tools/pass/build.mjs` (rebuild the pass story after changing either) and wrapped as sets (`tools/pass/sets/globe.js`, `cell.js`). `pass/fish` adapts the flock's simulation. The flock and the robots are life size (1 unit = 1 m); so are `pass/fish` and the PET scanner.
- `tools/lbi/sets/demo.js` is a tiny example set (points on a sphere) used by the harness; no story uses it, so it is not listed.

## Stories not built from sets

The first three stories are hand-written single scenes, not made of sets. They cannot be reused as props except through the pass story's wrapping of two of them.

- **airports** (`stories/airports.js`): One scene: the globe of 3,214 airports and 18,858 routes (pillars, arcs, communities, closures, a shortest path). Chapters: Intro, Nodes, Edges, Degree, Hubs, Shortest paths, Betweenness, Communities, Robustness, Recap. Explore tabs: Airport, Paths, Hubs, Communities, Closures.
- **proteins** (`stories/proteins.js`): One scene: 254 curated proteins and 375 interactions as a network in a cell. Chapters: Intro, Proteins, Interactions, Hubs, Essential, Modules, Disease modules, Drug targets, Robustness, Recap. Explore tabs: Protein, Paths, Hubs, Modules, Knockouts.
- **spatial** (`stories/spatial.js`): One scene: a model cell with 13 compartments, 249 proteins and 252 links. Chapters: Intro, Compartments, Addresses, Meeting, Many places, Signals, Moving, Proximity, Wrong place, Recap. Explore tabs: Protein, Paths, Places, Moves, Proximity.

## The sets

### `lbi/int`

A big glowing human protein interaction network (about 9,100 proteins, 22,100 interactions) with a dense centre and filaments towards the rim. The story lights curated pathways, the ATP synthase complex, flattens it into a city map with pins and a route, shows disease modules, a rare disease and its drug target, 173 immunity genes in 19 clusters, drug capsules and heat spreading from three seeds.

- **File:** `tools/lbi/sets/int.js`; manifest `tools/lbi/sets/int.md`.
- **Belongs to:** the lbi story.
- **Frame:** Centred on the origin, y up, about radius 1 (city mode flattens it onto a disc of radius 1.12). Views are [az, el, dist, tx, ty, tz].
- **Size:** radius ~1.
- **Data (mixed):** reads embedded, no data block. Curated core = the 254 proteins and 375 interactions of the network-medicine story (curated). ATP synthase (13 subunits, 21 contacts) and the 19 immunity clusters come from shared facts. Background network, disease modules (after Menche et al. 2015), the rare disease and the patient seeds and heat are synthetic and illustrative.
- **Cost and notes:** Built at load from embedded data (about 0.2 to 0.6 s). 9.7k points, 22.1k line segments, 5 to 14 draw calls. int_path0..9 are ten curated-module highlights. Several views are getters that change when int_flat > 0.5. Extra exports select(), route(), pick(), partners(), info feed the tour's Proteins tab. Node cold build 538 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `int_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `int_reveal` | 0..1 | 1 | yes | the network grows from the centre out, with a bright growth front |
| `int_edges` | 0..1 | 1 | yes | interaction brightness |
| `int_dim` | 0..1 | 0 | yes | dims everything that is not highlighted. Highlight looks already dim the rest on their own |
| `int_path0` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path1` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path2` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path3` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path4` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path5` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path6` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path7` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path8` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_path9` | 0..1 | 0 | yes | curated module k lights up in its own colour (no white wash-out): nodes flare, internal edges become ribbons with soft travelling pulses that keep the hue, and the rest |
| `int_atp` | 0..1 | 0 | yes | the 13 ATP synthase nodes glow blue with their 21 contacts inside a faint blue bubble |
| `int_flat` | 0..1 | 0 | yes | city morph: the network flattens onto a disc (radius 1.12) and stays together by neighbourhood |
| `int_build` | 0..1 | 0 | yes | lit buildings with windows rise on the 254 curated proteins |
| `int_hub` | 0..1 | 0 | yes | centrality: hubs and essential curated proteins glow hot (amber to red) and grow, the rest cools to blue |
| `int_hood` | 0..1 | 0 | yes | neighbourhoods: every node takes its district's colour (the 10 module colours plus a muted palette for the background), and buildings take their module colour |
| `int_pins` | 0..1 | 0 | yes | two map pins (with a dark dot on each face of the head) drop and bounce: red on TP53, blue on MCL1, a non-essential protein with 2 curated partners at the map's rim |
| `int_route` | 0..1 | 0 | yes | the shortest path between the pins lights up hop by hop as an orange route with stops |
| `int_dis` | 0..1 | 0 | yes | the 3 disease modules glow in their colours inside rim bubbles (domes on the map) |
| `int_rare` | 0..1 | 0 | yes | the rare disease: the red gene (big ring), its red 2-hop bubble, the drug target (teal ring) and its teal bubble overlapping the red one |
| `int_iei` | 0..1 | 0 | yes | the 19 immunity clusters light up in their colours with rim bubbles |
| `int_drugs` | 0..1 | 0 | yes | drug capsules fly in. 9 green-white "targeted" capsules dock one after another into the clusters |
| `int_heat` | 0..1 | 0 | yes | network propagation: heat spreads out from the 3 white-hot seeds (crisp white discs) hop by hop, to its steady state |
| `int_cand` | 0..1 | 0 | yes | the 12 candidates show as rings (warmer rings get more heat) |
| `int_spin` | turns (unbounded) | 0 | yes | turns the network about y, in turns. Optional: the story turns the camera instead |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [25, 12, 3.6, 0, 0, 0] | the whole network |
| `city` | [20, 35, 3.1, 0, -0.08, 0] | low oblique over the map |
| `atp` | [25, 12, 1.3, 0.093, 0.029, 0.162] | the ATP synthase centroid |
| `dis` | [125, 16, 3.2, 0, 0, 0] | MS and RA on the left, peroxisomal disorders on the right |
| `rare` | [110, 30, 1.45, 0.389, 0.335, -0.195] | the disease gene. treat: the drug target |
| `iei` | [-40, 6, 2.3, -0.33, 0.059, 0.38] | all 19 clusters face on |
| `heat` | [-40, 14, 2.9, -0.21, 0.185, 0.195] | seeds, causal gene and candidates |
| `paths` | [195, 15, 3.6, 0, 0, 0] | the pathways chapter |

Explore controls: **View** (`view`: `net` Network, `city` City); **Colour** (`colour`: `paths` Pathways, `hubs` Hubs, `hoods` Neighbourhoods, `dis` Diseases, `iei` Immunity, `heat` Spread); **Show** (`show`: `none` Nothing, `atp` ATP synthase, `route` Route, `rare` Rare disease). `explore(c)` drives `int_a`, `int_spin`, `int_flat`, `int_build`, `int_path`, `int_hub`, `int_hood`, `int_dis`, `int_iei`, `int_drugs`, `int_heat`, `int_cand`, `int_atp`, `int_pins`, `int_route`, `int_rare`.

Anchors (308): `core`, `atp`, `pinRed`, `pinBlue`, `ms`, `ra`, `perox`, `rare`, `treat`, `seed`, `causal`, `protein`, `mod0`, `mod1`, `mod2`, `mod3`, `mod4`, `mod5`, `mod6`, `mod7`, `mod8`, `mod9`, `iei0`, `iei1` and 284 more.

Own labels (23): "Cell cycle& DNA copying" at `mod0`; "DNA break repair" at `mod1`; "p53& gene control" at `mod2`; "Growth-factorsignalling" at `mod3`; "Wnt& amyloid" at `mod4`; "Proteasome" at `mod5`; "DNA replicationstart" at `mod6`; "AKT-mTOR& survival" at `mod7`; and 15 more.

Other exports: `modules`, `iei`, `nodeCount`, `edgeCount`, `coreCount`, `core`, `select`, `route`, `pick`, `partners`, `info`.

### `lbi/mac`

A beige 1990s all-in-one computer (no brand marks) on a table. It switches off like a CRT, comes apart in the order of a real teardown, every part lands in neat rows, glowing wires connect the chips, then the parts shrink into a network of 106 nodes and 209 links that lifts off the table.

- **File:** `tools/lbi/sets/mac.js`; manifest `tools/lbi/sets/mac.md`.
- **Belongs to:** the lbi story.
- **Frame:** y up; table top at y = -0.30; computer faces +z, keyboard in front, mouse right; network floats at (0, -0.14, 0).
- **Size:** table 1.76 x 1.48 (corners reach radius ~1.15); network radius ~0.6.
- **Data (none):** Drawn; nothing is data.
- **Cost and notes:** The screen is canvas-drawn. Wires widen up to 1.6 times when seen from further than the wiring view. Extra export counts. Node cold build 158 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `mac_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `mac_explode` | 0..1 | 0 | yes | 0: the assembled computer. 1: everything laid out on the table |
| `mac_wire` | 0..1 | 0 | yes | The schematic wiring grows wire by wire. It only draws over the laid-out parts, so it is multiplied by prog(mac_explode, 0.75, 1) (unless the network has already lifted) |
| `mac_net` | 0..1 | 0 | yes | parts shrink into glowing nodes (chips amber, resistors cyan, capacitors magenta, crystals green), wires straighten and the graph (106 nodes, 209 links) lifts off the table |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [32, 13, 2.25, 0.06, -0.09, 0.06] | Three-quarter view of the computer, keyboard and mouse |
| `computer` | [32, 13, 2.25, 0.06, -0.09, 0.06] | three-quarter view of the assembled computer, keyboard and mouse (same as default) |
| `table` | [8, 55, 3.45, 0, -0.32, 0.02] | above the teardown: the whole table of laid-out parts |
| `apart` | [8, 55, 3.45, 0, -0.32, 0.02] | the same view as table |
| `wiring` | [2, 60, 2.6, 0.17, -0.3, -0.06] | Closer over the wired middle rows |
| `network` | [18, 20, 2.4, 0, -0.14, 0] | the lifted network (106 nodes, 209 links) floating over the table |
| `screen` | [12, 6, 1, 0, 0.036, 0.12] | close on the screen glass and its desktop |

Explore controls: **View** (`view`: `computer` Computer, `apart` Taken apart, `wiring` Wiring, `network` Network). `explore(c)` drives `mac_explode`, `mac_wire`, `mac_net`.

Anchors (13): `screen`, `board`, `chips`, `resistors`, `screws`, `keys`, `wires`, `computer`, `crt`, `keyboard`, `mouse`, `table`, `network`.

Own labels (4): "Screws53 of them" at `screws`; "Resistors40, by value" at `resistors`; "Chipstransistors inside" at `chips`; "Keys81 caps" at `keys`.

Other exports: `counts`.

### `lbi/web`

Networks are everywhere: first the internet as a tree-like network of 15,938 nodes and 16,359 links in the style of the Opte maps, then a dark globe with the 3,214 airport cities as lights and about 11,800 friendship ties as arcs (mostly local, about 650 long ones with travelling glints).

- **File:** `tools/lbi/sets/web.js`; manifest `tools/lbi/sets/web.md`.
- **Belongs to:** the lbi story.
- **Frame:** Centred on the origin; the globe has radius 1 and turns about the polar axis (web_spin).
- **Size:** globe radius 1; internet about radius 1.
- **Data (mixed):** reads embedded. Airport city positions are real (the airports story's 3,214 airports). The internet network, the 18,800 fainter lights and all friendship ties are illustrative.
- **Cost and notes:** Build 110 to 300 ms. Internet alone 2 draw calls, 15.9k points; globe alone 4 draw calls, 25k points, 32k segments. The hidden look is switched off. web_net and web_globe are meant to cross-fade; web_ties then web_spin run on the globe. Node cold build 301 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `web_a` | 0..1 | 1 | yes | Fade of the whole set (applied by the engine) |
| `web_net` | 0..1 | 1 | yes | Internet growth. 0 shows nothing. Rising, the hubs pop in one after another (the giant first) |
| `web_globe` | 0..1 | 0 | yes | The globe. A dark sphere grows out of the internet's core, reaching full size at about 0.6 |
| `web_ties` | 0..1 | 0 | yes | Friendship ties. Local ties draw first (from 0.04; 99% are in by 0.23, the odd long tie of a lonely city by 0.37) |
| `web_spin` | turns (unbounded; 0.12 = 43 degrees) | 0 | yes | Globe rotation in turns about the polar axis |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [-18, 12, 3.4, 0, 0, 0] | net : the whole internet, filling most of the frame |
| `net` | [-18, 12, 3.4, 0, 0, 0] | the whole internet, both giant hubs side by side (default) |
| `hub` | [-30, 14, 1.5, 0.36, -0.02, 0.1] | close on the giant hub with spokes all round (good in a headset) |
| `globe` | [0, 24, 4.1, 0, 0, 0] | the globe facing Europe and the Atlantic at web_spin 0 |
| `europe` | [26, 38, 1.9, 0.182, 0.504, 0.451] | close over Europe (right only at web_spin 0) |

Explore controls: **View** (`view`: `net` Internet, `globe` Friendships); **Ties** (`ties`: `all` All, `local` Local only). `explore(c)` drives `web_net`, `web_globe`, `web_ties`, `web_spin`.

Anchors (8): `hub`, `hub2`, `tuft`, `globe`, `europe`, `americas`, `asia`, `atlantic`.

Own labels (3): "Europe" at `europe`; "Americas" at `americas`; "Asia" at `asia`.

Other exports: `netNodes`, `netLinks`, `cities`, `tieCount`, `localShare`.

### `lbi/dna`

A long DNA double helix is written from the middle outwards, coils into the 23 chromosomes, threads grow from genes and fold into 25 AlphaFold-style protein chains in a 5 x 5 grid, which then becomes a tiny framed patch in a field of 20,000 proteins.

- **File:** `tools/lbi/sets/dna.js`; manifest `tools/lbi/sets/dna.md`.
- **Belongs to:** the lbi story.
- **Frame:** Centred on the origin; the helix runs along x, the grid in the z = 0 plane; the field fills a ball of radius ~15 around you.
- **Size:** helix, karyotype and grid ~radius 1; field radius ~15 (default view dist 3.9, field view dist 17).
- **Data (mixed):** reads embedded. B-DNA geometry and GRCh38 chromosome lengths are real; the base sequence is random; the protein folds are stylised AlphaFold-like cartoons (colours from pLDDT bins) and the field is illustrative.
- **Cost and notes:** Params build on each other (keep earlier ones at 1 while a later one rises). A tunnel in the field is kept clear so the grid stays visible. Points fade within ~4 units of the eye (comfortable in a headset). Extra exports proteins, counts. Node cold build 247 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `dna_a` | 0..1 | 1 | yes | Fade (applied by the engine) |
| `dna_helix` | 0..1 | 1 | yes | the helix is written from the middle outwards, with a bright seam at the growing ends that fades out as it completes |
| `dna_chrom` | 0..1 | 0 | yes | the helix squeezes onto a coloured cord inside it (23 colours, one per chromosome, each chromatid a segment) and fades into it as a light sheath |
| `dna_fold` | 0..1 | 0 | yes | thin white threads grow out of the chromosomes, each at its gene |
| `dna_field` | 0..1 | 0 | yes | the field appears from the inside out |
| `dna_rainbow` | 0..1 | 0 | yes | protein colours morph from AlphaFold confidence to chain order (N-terminus blue, through green and yellow, to the C-terminus red), on the grid, the small |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [35, 12, 3.9, 0, 0, 0] | the helix in three-quarter view |
| `helix` | [40, 8, 2.6, 0.3, 0, 0] | along the helix in perspective |
| `chrom` | [0, 4, 4.4, 0, -0.02, 0] | the karyotype of 23 chromosomes, pulled back to leave room for the bars |
| `fold` | [0, 3, 4.6, 0, 0.03, 0] | the 5 x 5 grid of folded proteins |
| `field` | [12, 8, 17, 0, 0, 0] | upper right of the patch, for the field label |

Explore controls: **Show** (`view`: `helix` DNA, `chrom` Chromosomes, `fold` Proteins, `field` All proteins); **Colour** (`colour`: `conf` Confidence, `chain` Chain order). `explore(c)` drives `dna_helix`, `dna_chrom`, `dna_fold`, `dna_field`, `dna_rainbow`.

Anchors (59): `helix`, `bp`, `chrom1`, `chrom21`, `chromX`, `fold0`, `fold1`, `fold2`, `karyotype`, `grid`, `field`, `chr1`, `chr2`, `chr3`, `chr4`, `chr5`, `chr6`, `chr7`, `chr8`, `chr9`, `chr10`, `chr11`, `chr12`, `chr13` and 35 more.

Own labels (7): "Base pairA–T or G–C" at `bp`; "Chromosome 1248 million base pairs" at `chrom1`; "Chromosome 21smallest, 47 million" at `chrom21`; "SRP9" at `fold0`; "LENEP" at `fold1`; "GNG5" at `fold2`; "About 20,000kinds of human protein" at `field`.

Other exports: `proteins`, `counts`.

### `lbi/atp`

ATP synthase in three looks: a grid of its 13 AlphaFold-like chains, the assembled complex in a lipid membrane (protons turn the rotor, ATP pops out of the head), and the 13 parts and their 21 contacts as a network over a faint ghost of the complex.

- **File:** `tools/lbi/sets/atp.js`; manifest `tools/lbi/sets/atp.md`.
- **Belongs to:** the lbi story.
- **Frame:** Rotor axis on y; head at the top (matrix side), membrane at y ~ -0.38; subunit a and the peripheral stalk on +x. The parts grid lies in the z = 0 plane (x +-1.0, y +-0.9).
- **Size:** 1.2 units tall.
- **Data (mixed):** reads embedded. Subunit list and the 21 contacts are shared facts; geometry is illustrative.
- **Cost and notes:** Up to 214k triangles during the build (peak), 168k built, up to 14 draw calls; uses a depth pre-pass for the in-set ghost. The rotor angle atp_turns is unbounded. Extra exports parts (sym, hgnc, name, copies) and contacts. Node cold build 150 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `atp_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `atp_parts` | 0..1 | 1 | yes | The 13 chains draw themselves along their length, one after another, then float gently in the grid |
| `atp_colour` | 0..1 | 0 | yes | Grey-teal (slide 13) changes to the group colours of slide 14: α, β, γ, δ, ε teal |
| `atp_build` | 0..1 | 0 | yes | assembly: the 13 chains fly from the grid to their slots, copies split (alpha x3, beta x3, c x8), each grows into its sphere surface, helpers drift away, the membrane fades in |
| `atp_turns` | turns (unbounded) | 0 | yes | Rotor angle in turns, unbounded. The c-ring and the central stalk turn; the head and the peripheral stalk stay still |
| `atp_flow` | 0..1 | 0 | yes | protons flow in through subunit a and ATP pops out of the head (meaningful once built) |
| `atp_net` | 0..1 | 0 | yes | Network view (slide 15). The surface fades to a faint ghost (with a depth pre-pass, so only the outer skin shows) and the membrane dims |
| `atp_shrink` | 0..1 | 0 | yes | The ghost fades out first (0 to 0.12), then the network shrinks into one bright point at the set's origin and fades; the membrane goes by 0.45 |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 4, 3.5, 0, 0, 0] | the grid of 13 parts (same as parts) |
| `parts` | [0, 4, 3.5, 0, 0, 0] | one entry { sym, hgnc, name, copies } per part, for panel or explore text |
| `complex` | [-10, -8, 2.9, 0, 0.02, 0] | side view of the assembled complex, slightly from below |
| `top` | [-25, 40, 2.8, 0, -0.05, 0] | the c-ring and subunit a show under the head, so Rotor points at the ring |
| `running` | [-28, -4, 2.4, 0, -0.12, 0] | close on ring, a and stalk |
| `network` | [15, 8, 2.9, 0, 0.02, 0] | the 21-contact network over a faint ghost of the complex |

Explore controls: **View** (`view`: `parts` Parts, `complex` Complex, `running` Running, `network` Network). `explore(c)` drives `atp_parts`, `atp_colour`, `atp_build`, `atp_flow`, `atp_turns`, `atp_net`, `atp_shrink`.

Anchors (24): `head`, `rotor`, `membrane`, `stalk`, `shaft`, `ring`, `matrix`, `ims`, `atpOut`, `protonsIn`, `centre`, `ATP5A1`, `ATP5B`, `ATPAF1`, `ATPAF2`, `ATP5C1`, `ATP5D`, `ATP5E`, `ATP5F1`, `ATP5O`, `MT-ATP6`, `ATP5G1`, `ATP5G2`, `ATP5G3`.

Own labels (18): "ATP5A1α" at `ATP5A1`; "ATP5Bβ" at `ATP5B`; "ATPAF1helper" at `ATPAF1`; "ATPAF2helper" at `ATPAF2`; "ATP5C1γ" at `ATP5C1`; "ATP5Dδ" at `ATP5D`; "ATP5Eε" at `ATP5E`; "ATP5F1b" at `ATP5F1`; and 10 more.

Other exports: `parts`, `contacts`.

### `lbi/crowd`

6,000 instanced lit people. The first crowd of 422 stands in curved rows; one turns red and glows under a beam of light; the other 5,578 then rise out of the floor outwards until a sea of people reaches the horizon (one figure per rare disease).

- **File:** `tools/lbi/sets/clinic.js`; manifest `tools/lbi/sets/clinic.md`.
- **Belongs to:** the lbi story.
- **Frame:** Feet at y = 0; rows on arcs bending towards the viewer; people ~0.13 tall.
- **Size:** first crowd ~2.3 x 2.0 (radius 1.45, exported as radius); grown sea ~12 x 7.
- **Data (none):** Drawn; the count 6,000 is the number of rare diseases with a known genetic cause (said in the story).
- **Cost and notes:** Fully grown 249k triangles, 9 draw calls; resting 79k triangles. Four level-of-detail tiers by distance from the first crowd. Exports radius, count, baseCount. No controls in explore. Node cold build 68 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `crowd_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `crowd_red` | 0..1 | 0 | yes | one person (red) turns red and glows; a soft beam of light with drifting dust comes down on them, a red pool lights the floor, and their glow puts a thin red rim on the |
| `crowd_grow` | 0..1 | 0 | yes | the other 5,578 people rise out of the floor, outwards from the first crowd at an even rate, until a sea of 6,000 reaches the horizon (about 12 units wide, 7 deep) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 20, 3.6, 0, 0.04, 0] | front view of the whole first crowd |
| `close` | [12, 22, 0.95, -0.202, 0.085, 0.639] | close on the red patient |
| `wide` | [0, 24, 5.6, 0, 0, -1.4] | the grown sea of 6,000 people, pulled back |

Explore controls: none.

Anchors (6): `red`, `crowd`, `front`, `back`, `far`, `horizon`.

Own labels (0): none.

Other exports: `radius`, `count`, `baseCount`.

### `lbi/sankey`

A 3D Sankey diagram, 9 clinical categories on the left against 19 molecular clusters on the right, joined by 58 ribbons whose height is the gene count; each category's ribbons lie in their own depth layer so the diagram has parallax. A gene dot travels along each ribbon.

- **File:** `tools/lbi/sets/clinic.js`; manifest `tools/lbi/sets/clinic.md`.
- **Belongs to:** the lbi story.
- **Frame:** Centred on the origin, facing +z.
- **Size:** ~1.45 wide, 1.47 tall.
- **Data (real):** reads embedded. Gene counts per clinical category and molecular cluster as on the institute's slide 27 (shared facts).
- **Cost and notes:** sankey_hi (story, jumps) and sankey_h1..h9 (explore, easeable) highlight one category. Exports left, right, total, matrix and the colours. Some labels are marked minor for phones. Node cold build 26 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `sankey_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `sankey_left` | 0..1 | 1 | yes | the 9 clinical blocks grow in, top to bottom; their labels follow |
| `sankey_right` | 0..1 | 1 | yes | the 19 cluster blocks grow in, top to bottom; labels and leader lines follow |
| `sankey_flow` | 0..1 | 1 | yes | the ribbons sweep from left to right (category by category, a glowing front); the gene dots appear in the last half |
| `sankey_hi` | 0..9 (category, step) | 0 | **no** | for the story (keyed in jumps): 0 none; k = 1..9 highlights clinical category k: its ribbons come forward in front of every layer and glow, its block and the clusters |
| `sankey_h1` | 0..1 | 0 | yes | explore: highlight weight for clinical category 1 (safe to ease) |
| `sankey_h2` | 0..1 | 0 | yes | explore: highlight weight for clinical category 2 (safe to ease) |
| `sankey_h3` | 0..1 | 0 | yes | explore: highlight weight for clinical category 3 (safe to ease) |
| `sankey_h4` | 0..1 | 0 | yes | explore: highlight weight for clinical category 4 (safe to ease) |
| `sankey_h5` | 0..1 | 0 | yes | explore: highlight weight for clinical category 5 (safe to ease) |
| `sankey_h6` | 0..1 | 0 | yes | explore: highlight weight for clinical category 6 (safe to ease) |
| `sankey_h7` | 0..1 | 0 | yes | explore: highlight weight for clinical category 7 (safe to ease) |
| `sankey_h8` | 0..1 | 0 | yes | explore: highlight weight for clinical category 8 (safe to ease) |
| `sankey_h9` | 0..1 | 0 | yes | explore: highlight weight for clinical category 9 (safe to ease) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [-8, 7, 3.75, 0.18, 0, 0] | front view of the whole diagram |
| `oblique` | [-42, 14, 3.5, 0.1, 0, 0] | turned so the depth layers of the ribbons show |
| `molecular` | [-16, 4, 2.4, 0.6, 0, 0] | above the two columns |
| `portrait` | [-26, 9, 3.4, -0.12, 0, 0] | narrower, turned view for portrait screens (w/h < 1) |

Explore controls: **Highlight** (`hi`: `0` None, `1` Autoinflammatory, `2` Syndromic, `3` Cellular, `4` Phenocopies, `5` Dysregulation, `6` Antibody, `7` Phagocyte, `8` Innate, `9` Complement). `explore(c)` drives `sankey_left`, `sankey_right`, `sankey_flow`, `sankey_hi`, `sankey_h`.

Anchors (61): `mid`, `clinical`, `molecular`, `top`, `bottom`, `left0`, `leftLabel0`, `left1`, `leftLabel1`, `left2`, `leftLabel2`, `left3`, `leftLabel3`, `left4`, `leftLabel4`, `left5`, `leftLabel5`, `left6`, `leftLabel6`, `left7`, `leftLabel7`, `left8`, `leftLabel8`, `right0` and 37 more.

Own labels (30): "Clinical9 categories" at `clinical`; "Molecular19 clusters" at `molecular`; "Autoinflammatory40" at `leftLabel0`; "Combined, syndromic19" at `leftLabel1`; "Cellular and humoral27" at `leftLabel2`; "Phenocopies4" at `leftLabel3`; "Immune dysregulation33" at `leftLabel4`; "Antibody deficiencies10" at `leftLabel5`; and 22 more.

Other exports: `left`, `right`, `total`, `leftShort`, `rightShort`, `leftColours`, `rightColours`, `matrix`.

### `lbi/scale`

A glowing tower of eight length scales (DNA bases, proteins, ATP synthase, a mitochondrion, a cell, a tissue, a brain, a body), with an amber time spiral, small networks at four floors, a medicine column, four research-group bands with 22 synergy arcs, and finally the tower dissolving into a team of 42 people.

- **File:** `tools/lbi/sets/scale.js`; manifest `tools/lbi/sets/scale.md`.
- **Belongs to:** the lbi story.
- **Frame:** Centred on the origin, y up; floors one above another.
- **Size:** ~2.45 tall, discs radius ~1.
- **Data (none):** Drawn and illustrative; the institute's groups and synergies are structure, not data.
- **Cost and notes:** Up to 18 draw calls and ~98k triangles when everything shows. scale_team works with scale_len 0 (the mission chapter). Label sides assume the story's spins. Node cold build 133 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `scale_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `scale_len` | 0..1 | 1 | yes | the floors appear from the bottom up. Each disc spreads out from its centre with a bright wavefront, its rim draws round, its emblem pops up and the shell rises with them |
| `scale_time` | 0..1 | 0 | yes | an amber spiral time axis (1.75 turns, log10 seconds from 1 µs at the bottom to 80 years at the top) grows up around the tower with a bright head |
| `scale_net` | 0..1 | 0 | yes | small glowing networks grow out from a hub at four floors, one after another: protein-protein interactions (cyan, proteins floor), signalling |
| `scale_med` | 0..1 | 0 | yes | a medicine column beside the tower: three glassy green bubbles holding 3D icons |
| `scale_rg` | 0..1 | 0 | yes | the four research groups light up one after another |
| `scale_syn` | 0..1 | 0 | yes | synergy arcs: 22 nested arcs between the group bands, drawn one after another |
| `scale_team` | 0..1 | 0 | yes | the tower dissolves into dust and fades by team 0.55 |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [15, 18, 5.4, 0, 0.02, 0] | the whole tower, from a little above so that every floor reads as a disc |
| `tower` | [15, 18, 5.4, 0, 0.02, 0] | the whole tower of eight scales from a little above (default) |
| `low` | [-8, 3, 2.7, 0, -0.6, 0] | the lowest floors, nearly level |
| `high` | [12, 24, 3, 0, 0.42, 0] | the upper floors from above |
| `groups` | [100, 18, 5.4, 0, 0.02, 0] | the explore Groups view: labels on the right, synergy fan on the left |
| `time` | [20, 16, 5.3, 0, 0, 0] | the whole time spiral, from its start at the bottom to the top |
| `team` | [0, 12, 3.1, 0, 0, 0] | the constellation |

Explore controls: **View** (`view`: `tower` Scales, `groups` Groups, `team` Team); **Time** (`time`: `off` Off, `on` On); **Networks** (`nets`: `off` Off, `on` On); **Medicine** (`med`: `off` Off, `on` On). `explore(c)` drives `scale_len`, `scale_time`, `scale_net`, `scale_med`, `scale_rg`, `scale_syn`, `scale_team`.

Anchors (35): `top`, `bottom`, `team`, `floor0`, `floor1`, `floor2`, `floor3`, `floor4`, `floor5`, `floor6`, `floor7`, `time0`, `time1`, `time2`, `time3`, `time4`, `time5`, `time6`, `time7`, `time8`, `net0`, `net1`, `net2`, `net3` and 11 more.

Own labels (28): "DNA bases1 nm" at `floor0`; "Proteins10 nm" at `floor1`; "Complexes100 nm" at `floor2`; "Organelles1 µm" at `floor3`; "Cells10 µm" at `floor4`; "Tissues1 mm" at `floor5`; "Organs10 cm" at `floor6`; "Body1 m" at `floor7`; and 20 more.

### `lbi/body`

A standing figure, arms raised and hands crossed over the head, as a total-body PET maximum-intensity projection (about 52k glowing points, max blending, hot-iron colours). Twelve organ nodes rise onto a cage around the body, joined by bands that rewire between a healthy and a disease network, and a tracer injection can run.

- **File:** `tools/lbi/sets/body.js`; manifest `tools/lbi/sets/body.md`.
- **Belongs to:** the lbi story; reused by pet, micro, ovary, topo.
- **Frame:** Feet at y = -0.95, hands at +0.95; faces +z; the person's left is +x. The figure is slimmed across by XS = 0.9. Other sets that draw on the body use this frame.
- **Size:** 1.9 tall; the network cage spans y -0.42 to 0.8 and ~1.3 wide with labels. Shown together with: `pet/organs`, `ovary/organ` (same frame).
- **Data (illustrative):** A stylised figure; no patient scan or patient data.
- **Cost and notes:** Built in 0.6 to 0.8 s. Used unchanged by the PET, microanatomy, ovary and topology stories (the PET scanner embeds an instance in its patient). body_pet is the tracer time (0 injection, 1 steady scan). Export organs. Node cold build 596 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `body_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `body_pet` | 0..1 | 1 | yes | Tracer time: 0 is the injection, 1 the steady scan |
| `body_net` | 0..1 | 0 | yes | The organ network. 0-0.45: nodes pop out of the organs one by one and fly to the cage; thin tethers stay |
| `body_state` | 0..1 | 0 | yes | 0 is the healthy network and scan, 1 the disease network and scan |
| `body_blank` | 0..1 | 0 | yes | Only for the explore loop: it blacks out the scan while the tracer clock rewinds |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 4, 3.75, 0, 0, 0] | front : the whole figure, from the front |
| `front` | [0, 4, 3.75, 0, 0, 0] | the whole figure from the front (default) |
| `side` | [90, 4, 3.75, 0, 0, 0] | profile |
| `net` | [14, 6, 3, 0, 0.17, 0] | the whole organ network with all 12 labels, landscape screen |
| `netTall` | [14, 6, 5.8, 0.1, 0.17, 0] | the same network framing for a portrait phone |

Explore controls: **View** (`view`: `scan` Scan, `net` Network); **State** (`state`: `healthy` Healthy, `disease` Disease); **Tracer** (`tracer`: `up` Taken up, `live` Arriving). `explore(c)` drives `body_pet`, `body_blank`, `body_net`, `body_state`.

Anchors (16): `head`, `feet`, `injection`, `aorta`, `brain`, `thyroid`, `lungs`, `heart`, `liver`, `stomach`, `spleen`, `pancreas`, `kidneys`, `intestine`, `marrow`, `bladder`.

Own labels (12): "Brain" at `brain`; "Thyroid" at `thyroid`; "Lungs" at `lungs`; "Heart" at `heart`; "Liver" at `liver`; "Stomach" at `stomach`; "Spleen" at `spleen`; "Pancreas" at `pancreas`; and 4 more.

Other exports: `organs`.

### `lbi/tissue`

An H&E-stained section of stomach wall built from about 18,600 cells: zoom in and every cell is there, join cells to neighbours for a network, switch to multiplexed imaging so cells take their type colours, then 300 tissue regions lift off into a 3D embedding with loading arrows.

- **File:** `tools/lbi/sets/tissue.js`; manifest `tools/lbi/sets/tissue.md`.
- **Belongs to:** the lbi story; reused by micro (slide overlay).
- **Frame:** A thin slab (0.008 thick) standing upright, facing +z, centred on the origin; mucosa on top, muscle below. Overlay sets draw in this frame.
- **Size:** ~2.1 long, up to 0.6 deep. Shown together with: `micro/slide` (same frame).
- **Data (illustrative):** Drawn from a built-in model of the layers (about 18,600 cells; kinds epithelial, immune, stromal, endothelial, smooth muscle); stain colours by Beer-Lambert; after Rendeiro et al. 2021 and Abila et al. 2026, not their images.
- **Cost and notes:** Build about 1 s. Cells are splats that fade by on-screen size, so close and far views agree. Exports textures, dispose, cellCount, regionCount, types. The manifest says no tissue_near param was added (the story reads anchors instead). Node cold build 988 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `tissue_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `tissue_graph` | 0..1 | 0 | yes | network of neighbouring cells: thin dark lines join the nuclei and draw outwards from the zoom patch (radius 0.16 around it, 4,615 edges) |
| `tissue_mark` | 0..1 | 0 | yes | multiplexed imaging: dark-field look, cells coloured by type |
| `tissue_embed` | 0..1 | 0 | yes | 300 regions lift off and fly to a 3D embedding in front of the slab (centre [0, 0.03, 0.6]) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 6, 3.2, 0, 0, 0] | the whole slab |
| `section` | [0, 6, 3.2, 0, 0, 0] | the whole slab (same as default) |
| `zoom` | [-2.407, 3, 0.25, 0.21, 0.075, -0.038] | face-on, dist 0.25: deep glands above, muscularis mucosae across the middle, submucosa with an artery and a vein below |
| `graph` | [5.593, 5, 0.28, 0.21, 0.075, -0.038] | deep in the zoom patch, for the cell-network look |
| `mark` | [-10.407, 5, 0.42, 0.21, 0.075, -0.038] | deep in the zoom patch, for the multiplexed-imaging look |
| `embed` | [-18, 14, 2.4, 0, 0.03, 0.6] | the 3D embedding of 300 regions in front of the slab |

Explore controls: **View** (`view`: `section` Tissue, `graph` Cell network, `mark` Markers, `embed` Embedding). `explore(c)` drives `tissue_graph`, `tissue_mark`, `tissue_embed`.

Anchors (16): `mucosa`, `submucosa`, `muscle`, `vessel`, `zoom`, `embed`, `epi`, `imm`, `str`, `endo`, `smc`, `load0`, `load1`, `load2`, `load3`, `load4`.

Own labels (10): "Epithelialgland cells" at `epi`; "Immunecells" at `imm`; "Stromalfibroblasts" at `str`; "Endothelialvessel lining" at `endo`; "Smooth muscle" at `smc`; "Epithelial" at `load0`; "Immune" at `load1`; "Stromal" at `load2`; and 2 more.

Other exports: `textures`, `dispose`, `cellCount`, `regionCount`, `types`.

### `nmd/tower`

The multiplex network of rare muscle diseases: 71 layers of gene links (phenotypes, pathways, drug targets, co-essential genes, 39 co-expression layers, 27 protein-interaction layers) stacked into a tower with the same gene at the same spot in every layer. Pick a disease group to light its module, seeds, endotypes, a random walk, a squashed endotype grid, z-score bars or a pair of groups.

- **File:** `tools/nmd/sets/tower.js`; manifest `tools/nmd/sets/tower.md`.
- **Belongs to:** the nmd story.
- **Frame:** Centred on the origin, y up; layers top to bottom in data order with 0.08 gaps between categories.
- **Size:** ~2.2 tall, discs radius 1.
- **Data (real):** reads NMD_DATA. The authors' analysis files (ikerdata): 1,182 genes, 125,463 layer-links, endotypes. Layer z-scores (degree-matched random sets), walk visits and endotype names (most typical GO process) are computed by the generator as stand-ins until the authors send theirs. No patient or variant data.
- **Cost and notes:** Build 70 to 235 ms; 5 to 7 draw calls; up to ~42,000 link entries in any settled state. Rich api (setState, walk, pick, links, linkStats, members, seeds, genePos, pair ...). Needs NMD_DATA pasted before it. Node cold build 233 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `tower_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `tower_rise` | 0..1 | 1 | yes | layers appear from the bottom up (default 1) |
| `tower_cats` | 0..1 | 0.4 | yes | category tints, and the six category labels above 0.5 (default 0.4) |
| `tower_group` | 0..13 (group index + 1, 0 all) | 0 | **no** | 0 all groups (group colours, genes in several groups white-gold, a web of context links in the same colours); k = 1..13 selects group k-1: its module glows, the rest |
| `tower_seeds` | 0..1 | 0 | yes | the selected group's seeds glow and pulse; the rest of its module is hidden |
| `tower_walk` | 0..1 | 0 | yes | about 20 walkers (sparks with trails) hop along the module's links, climb threads to switch layer, flash back to a seed on restart |
| `tower_heat` | 0..1 | 0 | yes | genes warm up by the group's heat (dark blue, cyan, white); genes outside the module that the walk visits show too |
| `tower_module` | 0..1 | 0 | yes | the added genes join the module one by one in order of heat (each flashes as it joins); with tower_seeds 1 this is the module growing |
| `tower_z` | 0..1 | 0 | yes | layer significance (slide 5): protein layers glow by the selected group's z-score; a bar per protein layer sticks out of the rim, left of the default view, bars rising |
| `tower_endo` | 0..1 | 0 | yes | the selected group's genes take endotype colours (20-hue palette, endoColour(c)) |
| `tower_grid` | 0..1 | 0 | yes | the endotype grid: the group's genes gather into one block per endotype (block size by gene count, hottest genes in the middle), at the same place in every layer; the |
| `tower_pair` | 0..1 | 0 | yes | Congenital Myopathies (left) and Hereditary Cardiomyopathies (right) as two towers; the 29 genes in both in a narrow middle column; links between the sides are the |
| `tower_seedonly` | 0..1 | 0 | yes | in pair mode only seeds and their links stay highlighted (each link brighter, as they are fewer); the walk's genes fade, their links left among the faint context |
| `tower_drop` | 0..1 | 0 | yes | robustness: layers fall a little and fade one by one in a fixed random order (the last five are protein layers); at 1 five remain; the selected module stays lit with |
| `tower_room` | 0..1 | 0 | yes | the layout moves out into an annulus (inner radius 0.45), with an inner rim, so a person can stand in the middle |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [24, 16, 5.6, 0, -0.03, 0] | the whole tower slightly from above |
| `ppi` | [30, 20, 2.9, 0, -0.766, 0] | tower layer indices |
| `top` | [24, 86, 3.7, 0, 0, 0] | straight down onto the top layer |
| `side` | [90, 1, 4.6, 0, 0, 0] | level side view of the stack |
| `grid` | [15, 64, 3.8, 0, -0.716, 0] | above the squashed endotype grid |
| `z` | [-20, 10, 3.6, -0.502, -0.716, 0.224] | the z-score bar chart column |
| `pair` | [0, 12, 5.4, 0.18, 0, 0] | the two towers of a pair, target moved right so layer names fit |
| `inside` | [0, 30, 0.95, 0, -0.75, -0.8] | from the middle of the tower looking out and down (stand inside) |

Explore controls: **View** (`view`: `tower` Tower, `grid` Endotype grid, `pair` Two groups, `room` Room); **Colour** (`colour`: `groups` Groups, `endo` Endotypes, `heat` Walk heat); **Show** (`show`: `module` Module, `seeds` Seeds, `walk` Walk, `z` Layer scores, `drop` Robustness). `explore(c)` drives `tower_a`, `tower_cats`, `tower_grid`, `tower_pair`, `tower_room`, `tower_endo`, `tower_heat`, `tower_seeds`, `tower_module`, `tower_seedonly`, `tower_walk`, `tower_z`, `tower_drop`.

Anchors (15): `top`, `bottom`, `mid`, `ppi`, `coex`, `pheno`, `layer`, `zbar`, `zline`, `group`, `endo`, `gene`, `pairLeft`, `pairRight`, `pairMid`.

Own labels (164): "Phenotypes2 layers" at `fn`; "Pathways1 layer" at `fn`; "Drug targets1 layer" at `fn`; "Essential genes1 layer" at `fn`; "Co-expression39 layers" at `fn`; "Protein interactions27 layers" at `fn`; "Motor neuron94 genes, 93 seeds" at `fn`; "1· rRNA metabolic process" at `fn`; and 156 more.

Other exports: `genes`, `groups`, `layers`, `ppi`, `N`, `edgeCount`, `pairs`, `endoCount`, `endoColour`, `state`, `setState`, `walk`, `pick`, `links`, `linkStats`, `members`, `seeds`, `endoGenes`, `heatOf`, `genePos`, `pair`, `zMin`, `drop`.

### `nmd/motor`

The motor unit from nerve to sarcomere, and the heart: spinal cord, motor and sensory neurons, myelinated axons, six neuromuscular junctions, a fascicle of 20 striated fibres with one opened to show myofibrils, a magnified sarcomere with myosin, actin, titin, Z-discs and M-band, and a smooth surface-net heart with great vessels. Sites can be highlighted and shown with impulses or contraction.

- **File:** `tools/nmd/sets/motor.js`; manifest `tools/nmd/sets/motor.md`.
- **Belongs to:** the nmd story; reused by endo.
- **Frame:** Read left to right, y up; ventral points right (+x). Heart centre (0.30, 0.29, -0.12).
- **Size:** ~2.5 long (x -1.18 to 1.27, y -0.5 to 0.7).
- **Data (none):** reads NMD_DATA.groups. Anatomy is drawn. Only the disease groups' names, colours and body site are read (for the Diseases on/off colouring).
- **Cost and notes:** The heart is a signed distance field polygonised by surface nets as a job in slices (idle(dt), finish()); it fades in once built (about 0.4 s of work). keepClear is exported so a headset never brings a close view nearer than 0.35 m. Reused unchanged by the endotype story. Node cold build 448 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `motor_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `motor_build` | 0..1 | 1 | yes | The scene appears along the path from left to right (a cut that moves along x with a cyan edge glow): cord and neurons, roots, nerve, junctions, fibres |
| `motor_signal` | 0..1 | 0 | yes | Impulses, all from t (a 1.7 s cycle, the stretch reflex): the spindle fires and a cyan impulse runs up the sensory axon (bright flashes at the nodes) to the T, the |
| `motor_open` | 0..1 | 0 | yes | 0-0.5: one front fibre's sheath opens along its distal part (a widening wedge, its far cap goes) and the myofibrils grow in |
| `motor_contract` | 0..1 | 0 | yes | Sarcomere contraction: thin filaments and Z-discs slide towards the M-band (by 0.055 of 0.27; the H-zone nearly closes, titin springs compress) and the myosin heads |
| `motor_heart` | 0..1 | 0 | yes | 0-0.3 a magenta glow, 0.2-0.75 the heart fades in from it and grows (scale 0.55 to 1 over 0.1-1), the rim glow settling; it beats at 69 per minute |
| `motor_groups` | 0..1 | 0 | yes | Every disease group's colour lights its site (colours and sites from NMD_DATA.groups): rings with a running highlight and soft halos, and the part's surfaces take the |
| `motor_site` | 0..5 (0 all, 1 neuron, 2 nerve, 3 junction, 4 muscle, 5 heart) | 0 | **no** | 0 all sites alike; 1 neuron, 2 nerve, 3 junction, 4 muscle, 5 heart: that site glows and the rest dims to 30 % |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [-20, 14, 3.35, 0.05, 0.05, 0] | the whole unit, three-quarter view from the front left |
| `cord` | [-24, 12, 0.95, -0.95, -0.15, 0] | the cord's cut face, the motor neuron, roots and ganglion |
| `junction` | [20, 26, 0.42, 0.097, -0.311, 0.188] | close on the third end plate with its vesicles |
| `fibre` | [32, 16, 1, 0.5, -0.2, 0.08] | the opened fibre, its myofibrils and the sarcomere growing out |
| `sarcomere` | [92.237, -2.682, 0.256, 0.73, -0.011, 0.01] | inside the lattice, in the bare zone beside the M-band, in a corridor between two thick |
| `sarcEnd` | [75, 10, 0.9, 1.05, -0.05, 0] | the magnified sarcomere from outside, down its filaments from beyond the |
| `sarcSide` | [15, 14, 1.15, 0.97, -0.05, 0] | the sarcomere from the side, a little from above, for the filaments |
| `heart` | [-10, 8, 1.35, 0.3, 0.34, -0.12] | the heart from the front, a little from its right: right atrium, |

Explore controls: **View** (`view`: `default` Motor unit, `junction` Junction, `sarcomere` Sarcomere, `heart` Heart); **Show** (`show`: `off` Diseases off, `on` Diseases on); **Motion** (`motion`: `still` Still, `impulses` Impulses, `contraction` Contraction). `explore(c)` drives `motor_build`, `motor_open`, `motor_heart`, `motor_groups`, `motor_site`, `motor_signal`, `motor_contract`.

Anchors (14): `cord`, `soma`, `ganglion`, `axon`, `myelin`, `nerve`, `junction`, `spindle`, `fibre`, `myofibril`, `sarcomere`, `zdisc`, `mband`, `heart`.

Own labels (8): "Spinal cordgrey matter inside" at `cord`; "Motor neuronin the anterior horn" at `soma`; "Sensory neurondorsal root ganglion" at `ganglion`; "Axonin its myelin sheath" at `myelin`; "Neuromuscular junction" at `junction`; "Muscle fibrestriated" at `fibre`; "Sarcomereactin, myosin, titin" at `sarcomere`; "Heartthe same sarcomere" at `heart`.

Other exports: `keepClear`, `idle`, `finish`.

### `nmd/hpc`

The stress test on a supercomputer: a hall of racks with a cold aisle, blinking lights, cable trays and a glass door, and the field of tiny towers it computes, stretching to the horizon. Each tower is a stack of 20 glowing discs; far ones are single points.

- **File:** `tools/nmd/sets/hpc.js`; manifest `tools/nmd/sets/hpc.md`.
- **Belongs to:** the nmd story.
- **Frame:** Floor at y = -0.3; hall fits |x|, |z| < 0.85; the field extends to about 22 units.
- **Size:** 1 unit ~ 4 m (racks 2 m tall); field far beyond the usual radius on purpose.
- **Data (none):** Drawn; no data, no brand marks.
- **Cost and notes:** 11 draw calls, 176k triangles, 25k points. Exports keepOut and still (the engine keeps the camera out of the racks and rests the explore sway), streamMat, counts. Node cold build 81 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `hpc_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `hpc_racks` | 0..1 | 1 | yes | the racks rise out of the floor, nearest first, then their lights power on; trays, lights and glass come in last (default 1) |
| `hpc_field` | 0..1 | 0 | yes | the field spreads from the hall to the horizon: a cyan ring runs across the floor, sparks stream out of the hall to it, towers build disc by disc as it passes (default 0) |
| `hpc_remove` | 0..1 | 0 | yes | in a wave from the hall outwards (an amber ring on the floor), discs vanish from each tower in its own order (a brief flash, then they widen and fade) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [38, 24, 3.6, 0, -0.12, 0] | the hall from above, three-quarter view |
| `racks` | [0, 4, 1.4, 0, -0.03, -0.62] | down the cold aisle between the racks |
| `aisle` | [0, 6, 2.1, 0, -0.03, -0.62] | on the same line, just outside the aisle's open end: the way in and out |
| `field` | [24, 19, 7.5, 0, -0.3, -1] | high over the hall and the field of tiny towers |
| `near` | [53, 18, 1, 1.8, -0.19, 3] | one tower close, its neighbours receding towards the hall |

Explore controls: **View** (`view`: `racks` Racks, `field` Field); **Removed** (`removed`: `none` None, `half` Half, `most` Most). `explore(c)` drives `hpc_racks`, `hpc_field`, `hpc_remove`.

Anchors (3): `racks`, `field`, `near`.

Own labels (2): "MareNostrum 5Barcelona Supercomputing Center" at `racks`; "680,000 networks" at `field`.

Other exports: `streamMat`, `keepOut`, `still`, `towerCount`, `pointCount`, `nearTower`.

### `endo/syn`

One neuromuscular junction close up as a cut-away: a glass nerve bouton with vesicles, active zones, mitochondria and Schwann cell; the synaptic cleft with basement membrane, laminin, collagen IV and Q, acetylcholinesterase and agrin; the muscle side with six junctional folds, 1,677 acetylcholine receptors, MuSK/LRP4 and sodium channels; and the inside of the fibre with nuclei, ER, Golgi, myofibrils, desmin and plectin. Endotype clouds of genes can arrive and settle at their place.

- **File:** `tools/endo/sets/syn.js`; manifest `tools/endo/sets/syn.md`.
- **Belongs to:** the endo story.
- **Frame:** Up (+y) is the nerve, down the muscle. Cut plane z = 0.34 facing +z. Axon reaches up and left to about (-2.9, 2.3); the fibre's surface spreads to x +-5 for the wide view.
- **Size:** ~2.4 across (x -1.2 to 1.2); 1 micrometre ~ 0.5 units; small parts drawn bigger than life.
- **Data (mixed):** reads ENDO_DATA. The junction is drawn anatomy. Each endotype's place and genes (the clouds of up to 40 dots) come from the authors' data.
- **Cost and notes:** Build ~0.3 s. keepClear (with a function giving the cut-away's hidden region) keeps close views 0.35 m from the head in a headset. Exports showPlace, genePos, geneGroups. Node cold build 354 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `syn_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `syn_build` | 0..1 | 1 | yes | The junction assembles. 0 to 0.3: the fibre's interior grows in (each part from its middle) |
| `syn_fire` | 0..1 | 0 | yes | Firing, one impulse a second, all from t (phase = t mod 1) |
| `syn_tired` | 0..1 | 0 | yes | Fatigable weakness, with firing on. An 8-second loop: six impulses release less and less (relative release 1, 0.7, 0.5, 0.36, 0.27, 0.2 at syn_tired 1), then two |
| `syn_genes` | 0..1 | 0 | yes | The 35 seed genes light up where they act, as glowing markers in their endotype's colour |
| `syn_place` | 0..12 (endotype id + 1, 0 none) | 0 | **no** | Endotype id + 1, 0 none. Its place glows in its colour and the rest dims to about a third |
| `syn_endo` | 0..1 | 0 | yes | The endotypes arrive. Each is a cloud of its genes (as many as it has, up to 40; 295 dots), starting on a ring above the scene (centre (0, 1.95, 0), 11 at the top, like |
| `syn_shell` | 0..1 | 1 | yes | The fibre's wide surface round the junction (the cylinder of the wide view) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [26, 16, 5.8, -0.05, 0.05, 0] | three-quarter view of the whole section, a little from above, the |
| `terminal` | [22, 14, 2.1, 0, 0.42, 0.1] | the bouton's inside: vesicle clusters, mitochondria, endosomes |
| `cleft` | [62, 4, 1.05, 0.1, 0.06, 0.15] | low and close, along the cleft from the front right |
| `receptors` | [6, 48, 0.32, 0.25, 0, 0.27] | down onto a crest's carpet of receptor rosettes, from in front of the |
| `folds` | [10, 6, 1.45, 0.1, -0.18, 0.2] | the folds' cut face, receptors on top, sodium channels below |
| `nucleus` | [-16, 10, 1.45, -0.32, -0.66, 0.15] | nucleus A cut open, ER, Golgi, myofibrils |
| `gap` | [-90, 0, 1.1, 0.35, 0.092, 0.1] | inside the cleft (the camera at x -0.75, y 0.092), looking along +x: |
| `wide` | [24, 20, 8.2, -0.25, -0.25, -0.2] | pulled back, the fibre's striated surface round the cut-away and the |

Explore controls: **View** (`view`: `default` Junction, `terminal` Nerve ending, `cleft` Cleft, `folds` Folds, `nucleus` Inside the fibre); **Firing** (`fire`: `still` Still, `firing` Firing, `tired` Until tired); **Genes** (`genes`: `off` Off, `on` On). `explore(c)` drives `syn_build`, `syn_fire`, `syn_tired`, `syn_genes`, `syn_place`, `syn_endo`, `syn_shell`.

Anchors (32): `axon`, `terminal`, `vesicles`, `activezone`, `mito`, `endosome`, `cleft`, `lamina`, `receptors`, `folds`, `channels`, `nucleus`, `er`, `golgi`, `scaffold`, `fibre`, `gap`, `junction`, `loose`, `e0`, `e1`, `e2`, `e3`, `e4` and 8 more.

Own labels (31): "Nerve endingof a motor axon" at `terminal`; "Synaptic vesiclesfull of acetylcholine" at `vesicles`; "Mitochondrion" at `mito`; "Basement membranein the cleft" at `lamina`; "Acetylcholine receptorson the crests" at `receptors`; "Junctional folds" at `folds`; "Muscle fibre" at `fibre`; "CHAT · SLC5A7 · SLC18A3making and recycling acetylcholine"; and 23 more.

Other exports: `keepClear`, `showPlace`, `genePos`, `geneGroups`.

### `endo/net`

The authors' protein network (18,306 proteins) as a deep glowing cloud: the 35 congenital-myasthenic seed genes, their neighbourhoods growing and merging as k rises, walkers doing a random walk with restart, the module of 393 genes pulling out of the cloud with endotype colours, and one gene's 184-gene neighbourhood.

- **File:** `tools/endo/sets/net.js`; manifest `tools/endo/sets/net.md`.
- **Belongs to:** the endo story.
- **Frame:** Centred on the origin; 2,000 core genes near the middle, the other 16,306 in a shell from radius 1.8 to 2.4. The module layout is a drawing about 1.3 across.
- **Size:** ~4.8 across (larger than the usual radius 1.1).
- **Data (real):** reads ENDO_DATA. The authors' saved run: their protein network, 35 seed genes and 12 endotypes. Seed groups, walk, neighbourhoods and the tree are re-run with the package's defaults to show the method (said in the story).
- **Cost and notes:** Build ~1.3 s (the slowest of the endotype sets). 300 walkers follow paths planned from t, so seeking works. Exports api (names, setGene, geneIndex, pick, seeds, kValues, groupCount, endoOf, geneView, hoodCore). Node cold build 642 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `net_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `net_cloud` | 0..1 | 1 | yes | the cloud appears from the centre outwards with a bright front (default 1) |
| `net_seeds` | 0..1 | 0 | yes | the 35 seeds glow white-hot and grow, everything else dims a little; labels "35 seed genes" and four seeds (CHRNA1, MUSK, AGRN, DOK7) |
| `net_k` | 0..12 | 0 | yes | 0..12: neighbourhood size groups.k[round(net_k)]; between integers the lit neighbourhoods grow rank by rank, halos grow and colours and arcs crossfade |
| `net_walk` | 0..1 | 0 | yes | walkers: their number grows with the value (300 at 1) |
| `net_heat` | 0..1 | 0 | yes | every gene coloured by the walk from all seeds (heat, log scale): deep blue, blue, teal, amber, orange, white-hot (seeds); hot genes larger |
| `net_module` | 0..1 | 0 | yes | the module pulls out: its 393 genes move (each at its own moment, with a slight swirl) to the module layout, their links brighten, the rest of the cloud recedes |
| `net_endo` | 0..1 | 0 | yes | module genes (and their links) take their endotype colours; seeds keep a white heart |
| `net_gene` | -1, 0..392 (module index) | -1 | **no** | -1 none, else a module index (0..392). Key as a step, while net_hood is 0 |
| `net_hood` | 0..1 | 0 | yes | 0..0.3: the gene is marked (a cyan bubble, white point, its label) and the rest dims |
| `net_focus` | 0..12 (endotype id + 1) | 0 | **no** | 0 none, id + 1: that endotype's genes and links bright, everything else dims (seeds soften) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [18, 12, 6.8, 0, 0, 0] | the whole cloud |
| `core` | [24, 10, 4.4, 0, 0, 0] | the core of the protein network |
| `module` | [20, 8, 2.9, 0, 0, 0] | the module of 393 genes pulled out of the cloud |
| `seeds` | [-28, 14, 3.6, 0, 0, 0] | module indices of the 35 seeds in the Gene Table's order |
| `gene` | [20, 10, 2.9, 0, 0, 0] | the current gene, or the module's centroid |

Explore controls: **View** (`view`: `network` Network, `module` Module); **Walkers** (`walkers`: `off` Off, `on` On); **Colour** (`colour`: `walk` Walk, `endo` Endotypes). `explore(c)` drives `net_cloud`, `net_seeds`, `net_module`, `net_walk`, `net_heat`, `net_endo`.

Anchors (21): `centre`, `cloud`, `module`, `moduleTop`, `seeds`, `seedTop`, `k`, `gene`, `hood`, `e0`, `e1`, `e2`, `e3`, `e4`, `e5`, `e6`, `e7`, `e8`, `e9`, `e10`, `e11`.

Own labels (55): "18,306proteins" at `cloud`; "35 seed genes" at `seedTop`; "CHRNA1" at `fn`; "MUSK" at `fn`; "AGRN" at `fn`; "DOK7" at `fn`; "k = 1· 34 groups" at `k`; "k = 2· 34 groups" at `k`; and 47 more.

API (`set.api`): `names`, `setGene`, `geneIndex`, `pick`, `seeds`, `kValues`, `groupCount`, `endoOf`, `geneView`, `hoodCore`.

### `endo/tree`

From neighbourhoods to endotypes: the gene x term matrix (393 x 457) fills row by row, a dendrogram grows beside it, a test pulse runs down the tree (green check at kept splits, red cross inside an endotype), endotype colours run down the subtree, then genes fly into the poster's metagraph of translucent bubbles on a ring.

- **File:** `tools/endo/sets/tree.js`; manifest `tools/endo/sets/tree.md`.
- **Belongs to:** the endo story.
- **Frame:** Centred on the origin; leaves at the rows, root at the far left, the tree curving towards you.
- **Size:** not stated in the manifest (see views).
- **Data (real):** reads ENDO_DATA. The authors' endotypes, tree, cut, gene and term features; the tree is drawn to agree with their endotypes.
- **Cost and notes:** All geometry is built once; positions, colours and morphs come from shader uniforms, so update sets only a few dozen numbers. 18 camera views (one per endotype e0..e11). Exports api (setFocus, pick, focus, genePos, endoPos, genes, terms, order, cells, kept, endoRoots, bands, bubble ...). Node cold build 320 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `tree_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `tree_matrix` | 0..1 | 1 | yes | the empty matrix appears (first 6 %), then a scan line fills it row by row; each row flashes as it fills |
| `tree_tree` | 0..1 | 1 | yes | the dendrogram grows from the leaves (0) to the root and its trunk (1), a glow at the growing front |
| `tree_test` | 0..1 | 1 | yes | the test pulse runs down the tree from the root: kept splits get a green check and the rows part, in-endotype splits a red cross; at 1 every split is decided |
| `tree_mds` | 0..1 | 0 | yes | genes fly (staggered, in an arc towards you) from their rows to their tree-distance spots; matrix and tree fade out by 0.55 |
| `tree_meta` | 0..1 | 0 | yes | genes fly (from the rows or from the spots) into their bubbles; bubbles 0.3-0.85, bands grow in from both ends 0.45-0.95, links 0.55-1, names from 0.85 |
| `tree_focus` | 0..12 (endotype id + 1) | 0 | **no** | id + 1 of the endotype in focus (0 none): it brightens and comes forward (rows 0.04, cluster 0.16, bubble 0.34 and towards the ring's centre, 16 % bigger), the others |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [14, 8, 4.4, -0.05, 0, 0.05] | matrix and tree |
| `matrix` | [6, 4, 2.6, 0.39, 0, 0] | the gene x term matrix beside the tree |
| `tree` | [30, 6, 3, -0.722, 0, 0.06] | the tree a little from the side, so its curve shows |
| `mds` | [22, 14, 3.5, 0, 0, 0] | field of ENDO_DATA is not used |
| `meta` | [0, 5, 4.3, 0, 0, 0] | the poster's metagraph ring of endotype bubbles |
| `focus` | [14, 8, 4.4, -0.05, 0, 0.05] | the endotype in focus (same framing as default) |
| `e0` | [6.776, 2.043, 1.698, 0.484, -0.66, 0.24] | close on endotype 0 (one view per endotype, e0 to e11) |
| `e1` | [5.033, 8.418, 2.028, 0.36, 0.403, 0.42] | close on endotype 1 |
| `e2` | [7.078, 6.631, 2.164, 0.506, 0.105, 0.36] | close on endotype 2 |
| `e3` | [-6.252, 4.78, 2.001, -0.447, -0.203, 0.408] | close on endotype 3 |
| `e4` | [-3.556, 3.602, 1.83, -0.254, -0.4, 0.409] | close on endotype 4 |
| `e5` | [-7.078, 6.631, 2.079, -0.506, 0.105, 0.32] | close on endotype 5 |
| `e6` | [3.39, 3.562, 1.846, 0.242, -0.406, 0.273] | close on endotype 6 |
| `e7` | [-6.776, 1.938, 1.804, -0.484, -0.677, 0.24] | close on endotype 7 |
| `e8` | [-0.113, 3.195, 1.875, -0.008, -0.467, 0.343] | close on endotype 8 |
| `e9` | [6.165, 4.714, 1.991, 0.44, -0.214, 0.27] | close on endotype 9 |
| `e10` | [-5.102, 8.388, 2.071, -0.364, 0.398, 0.26] | close on endotype 10 |
| `e11` | [0, 9.309, 2.537, 0, 0.551, 0.34] | close on endotype 11 |

Explore controls: **View** (`view`: `matrix` Matrix, `tree` Tree, `dist` Distances, `endo` Endotypes). `explore(c)` drives `tree_a`, `tree_tree`, `tree_test`, `tree_mds`, `tree_meta`.

Anchors (25): `matrix`, `matrixTop`, `tree`, `treeTop`, `root`, `kept`, `refused`, `scan`, `mds`, `mdsTop`, `meta`, `metaLow`, `focus`, `e0`, `e1`, `e2`, `e3`, `e4`, `e5`, `e6`, `e7`, `e8`, `e9`, `e10` and 1 more.

Own labels (18): "393 genes× 457 terms" at `matrixTop`; "Tree of genes" at `treeTop`; "Split kept· the two sides differ" at `kept`; "Split refused· too alike" at `refused`; "Tree distances· near in the tree, near here" at `mdsTop`; "12 endotypes" at `metaLow`; "0· No shared place" at `fn`; "1· Mitochondria" at `fn`; and 10 more.

API (`set.api`): `setFocus`, `pick`, `focus`, `genePos`, `endoPos`, `genes`, `terms`, `order`, `cells`, `kept`, `endoRoots`, `testTimes`, `bands`, `own`, `loose`, `name`, `bubble`.

### `pet/scan`

A glossy PET/CT scanner (no brand, no text) with a patient on the couch, shown as a studio product shot. A plane cuts the housing away to show the detector ring of 4,608 crystals; positrons annihilate, pairs of 511 keV photons fly apart and lines of response join the struck crystals; the couch carries the patient through; the image builds up; finally the patient stands up and hands over to the body set.

- **File:** `tools/pet/sets/scan.js`; manifest `tools/pet/sets/scan.md`.
- **Belongs to:** the pet story; reuses lbi/body (an unchanged instance inside the patient).
- **Frame:** 1 unit = 1 m. Origin at the centre of the bore; its axis is z; the couch comes out towards +z; floor at y = -1.05 (exported as floorY).
- **Size:** gantry 2.02 wide, 2.1 tall; scanner life size.
- **Data (mixed):** reads PET_DATA, PET_ICONS. Which organs are hot sources (brain, heart, bladder, liver, kidneys, tumour) uses PET_DATA's typical uptakes; the rest is drawn.
- **Cost and notes:** Build ~1.2 s, custom studio shader. Embeds an unchanged instance of the tour's body set inside the patient. Exports floorY, riseTo (the hand-over), api (event, live). scan_vision, scan_rise and scan_floor (set 0 in passthrough) are the story's. Node cold build 1202 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `scan_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `scan_bed` | 0..1 | 0 | yes | the couch slides in: 0 the table's head end at the gantry's face (the patient outside), 1 the head (its centre) at the ring's centre plane (travel 1.15 m) |
| `scan_pass` | 0..1 | 0 | yes | added: the couch goes on through the ring, 0 the head in the ring, 0.4 the chest (heart and the lung tumour), 1 the pelvis to the thighs |
| `scan_cut` | 0..1 | 0 | yes | the housing's upper half goes (plane from y 1.12 down to 0.015); from 0.5 the bore's cover opens over the ring |
| `scan_events` | 0..1 | 0 | yes | 0 none; from about 0.03 the featured event (one every 2 s: slow, comets, a beam for its line; the labels follow it); above 0.08 the others join, their share growing |
| `scan_lines` | 0..1 | 0 | yes | how many lines of the web stay: 0 none, 1 the newest 3,000 (15 s of the stream); rising, it uncovers older lines, so the web grows |
| `scan_image` | 0..1 | 0 | yes | 0-0.6 the couch carries the patient on through the ring (scan_pass to 1) and the counts light up behind it (grainy); the lines and events fade (gone by about 0.55) |
| `scan_vision` | 0..1 | 0 | yes | the vision row: 0-0.45 the scanner moves left |
| `scan_floor` | 0..1 | 1 | yes | added: the floor and its reflection; set 0 in passthrough AR |
| `scan_rise` | 0..1 | 0 | yes | added: the hand-over to the body set. 0-0.25 the scanner goes |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [34, 13, 7.2, 0, -0.25, 0.95] | three-quarter view of scanner and couch from slightly above |
| `front` | [0, 4, 6.4, 0, -0.1, 0.4] | straight at the bore |
| `ring` | [28, 22, 2.4, 0, -0.02, 0] | close to the cut detector ring, the web and events inside (needs scan_cut 1) |
| `side` | [90, 6, 7.6, 0, -0.25, 0.9] | side view along the couch |
| `inside` | [0, 18, 1.1, 0, -0.08, -0.35] | in the bore (26 cm above its axis, 10 cm inside its mouth) looking along |
| `vision` | [0, 3, 8.2, 0, -0.02, 0] | the scanner pulled back for the vision row |
| `life` | [20, 12.4, 2.56, 0, 0, 0.8] | the scanner from 2.5 m at eye height (1.6 m above the floor) |

Explore controls: **View** (`view`: `scanner` Scanner, `ring` Ring, `inside` Inside, `vision` Vision); **Events** (`events`: `off` Off, `on` On); **Image** (`image`: `lines` Lines, `image` Image). `explore(c)` drives `scan_bed`, `scan_pass`, `scan_cut`, `scan_vision`, `scan_events`, `scan_lines`, `scan_image`.

Anchors (16): `centre`, `bore`, `ring`, `gantry`, `couch`, `patient`, `head`, `tumour`, `event`, `lor`, `floor`, `vision_scan`, `vision_body`, `vision_net`, `vision_prog`, `vision_med`.

Own labels (10): "PET/CT scanner" at `gantry`; "Detector ring" at `ring`; "Two gamma photons· 511 keV each" at `event`; "Line of response" at `lor`; "FDGin the patient" at `patient`; "PET scan" at `vision_scan`; "One body" at `vision_body`; "One network" at `vision_net`; and 2 more.

API (`set.api`): `floorY`, `event`, `live`.

Other exports: `floorY`, `riseTo`.

### `pet/organs`

Organs, uptake and the cohort network, drawn on the body: a scan plane segments 14 organs (translucent shells with outlines), 14 uptake bars to the body's right (aorta as the unit), a slab of 658 x 11 cells and the partial-correlation panel with 658 stand-in people, then the paper's networks (all scans, tracers, doses, disease) and lesion views.

- **File:** `tools/pet/sets/organs.js`; manifest `tools/pet/sets/organs.md`.
- **Belongs to:** the pet story; reuses lbi/body (drawn on it).
- **Frame:** The body set's frame (feet y -0.95, 1.9 tall, faces +z, slimmed by XS = 0.9); always shown with body.
- **Size:** body-sized; bars x 0.40 to 1.1; slab 0.47 to 1.13. Shown together with: `lbi/body` (same frame).
- **Data (figures):** reads PET_DATA, PET_ICONS. Paper tables typed in (Geist et al., Med 2025), the two weight matrices printed in its Figure 2A and values read off its Figures 3 and 4 by two readers (stand-ins: typical organ uptakes and a synthetic cohort with Figure 2A's partial correlations). No patient data.
- **Cost and notes:** Many step params (organs_focus, organs_pair, organs_which, organs_prev, organs_mix). 123 labels. Built between frames in part (idle, finish). Exports api (netIds, extraNetIds, pairs, pick, setFocus, stats). Node cold build 48 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `organs_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `organs_seg` | 0..1 | 1 | yes | the sweep. At 0 no shells, at 1 all of them (the resting look) |
| `organs_suv` | 0..1 | 0 | yes | the uptake bars grow head to toe (0.03 apart, each over 0.36), with icons, leaders, the unit line and labels |
| `organs_focus` | 0..14 (organ index + 1) | 0 | **no** | organ index + 1 in PET_DATA.organs order (brain 1 ... aorta 14), 0 for none |
| `organs_lesion` | 0..1 | 0 | yes | the tumour hot spot and its rings. Key 0 -> 1 late in the body chapter, and back to 0 before the sweep |
| `organs_rows` | 0..1 | 0 | yes | 0-0.28: the f2 bars become one row (the others fade) |
| `organs_pair` | 0..5 | 0 | **no** | which explainer pair: 1..5 (api().pairs index + 1; 1 liver/spleen, 2 heart/lungs, 3 lungs/liver, 4 intestine/marrow, 5 intestine/liver, the indirect one) |
| `organs_scatter` | 0..1 | 1 | yes | the rise of the dots and the panel, multiplied with min(organs_pair, 1) |
| `organs_partial` | 0..1 | 0 | yes | 0 the raw values and r; 0-0.55 the cloud shrinks to the residuals |
| `organs_net` | 0..1 | 0 | yes | 0-0.48: the nodes rise (head to toe, 0.028 apart) |
| `organs_which` | 0..14 (network index) | 0 | **no** | which network: 0 full, 1 FDG_healthy, 2 A_low, 3 A_high, 4 B_low, 5 B_high, 6 C_low, 7 C_mid, 8 C_high, 9 HK2, 10 GLUT; extras 11 vena, 12 dose_standard, 13 |
| `organs_prev` | 0..14 | 0 | **no** | the network crossfaded from (an index as above, rounded) |
| `organs_mix` | 0..1 | 1 | **no** | 0 shows organs_prev, 1 shows organs_which, between a direct crossfade of the two |
| `organs_strength` | 0..1 | 0 | yes | the chart: panel and axes by 0.5, bars grow 0.15-0.75, the fit draws 0.5-1 |
| `organs_ghost` | 0..1 | 0 | yes | harness only: an instance of SETS.body (body_pet 1) under the shells at this alpha, for checking the fit |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 4, 3.75, 0, 0, 0] | the body, all of it |
| `seg` | [18, 16, 2.4, 0, 0.28, 0] | the torso with the segmentation plane seen from a little above |
| `bars` | [-6, 4, 3, 0.42, 0.2, 0] | above the column), unit (the foot of the ÷ aorta line, under the axis), matrix (right end of the |
| `matrix` | [32, 30, 2.5, 0.76, 0.1, -0.32] | the cohort slab of 658 x 11 cells beside the body |
| `scatter` | [8, 6, 2.1, 0.76, 0.52, 0.2] | above the panel |
| `net` | [8, 6, 3.1, 0.05, 0.37, 0.4] | the network's middle |
| `strength` | [-6, 4, 3.4, 0.56, 0.24, 0.36] | network and its strength chart together |
| `lesion` | [-24, 8, 1.15, -0.099, 0.42, 0.03] | close on the lesion |

Explore controls: **View** (`view`: `organs` Organs, `uptake` Uptake, `matrix` Matrix, `partial` Partial, `network` Network, `strength` Strength); **Network** (`network`: `full` All scans, `FDG_healthy` FDG, 9 organs, `A_low` BMI low, `A_high` BMI high, `B_low` Tumour low, `B_high` Tumour high, `C_low` CRP low, `C_mid` CRP mid, `C_high` CRP high, `HK2` HK2, `GLUT` GLUT). `explore(c)` drives `organs_seg`, `organs_suv`, `organs_rows`, `organs_pair`, `organs_scatter`, `organs_partial`, `organs_net`, `organs_strength`, `organs_which`, `organs_prev`, `organs_mix`, `organs_lesion`.

Anchors (56): `bars`, `unit`, `matrix`, `scatter`, `axisX`, `axisY`, `fit`, `net`, `title`, `strength`, `chartAxis`, `lesion`, `plane`, `hub`, `brain`, `bar_brain`, `seg_brain`, `thyroid`, `bar_thyroid`, `seg_thyroid`, `lungs`, `bar_lungs`, `seg_lungs`, `heart` and 32 more.

Own labels (123): "Brain" at `seg_brain`; "Brain" at `brain`; "Brain" at `brain`; "Brain · hub" at `brain`; "Brain · 4.4×" at `bar_brain`; "Thyroid" at `seg_thyroid`; "Thyroid" at `thyroid`; "Thyroid" at `thyroid`; and 115 more.

API (`set.api`): `netIds`, `extraNetIds`, `pairs`, `pick`, `setFocus`, `stats`.

Other exports: `idle`, `finish`.

### `pet/liver`

An organ is a network too: a liver made of 3,000 small patches joined into a network (about 19,700 links) by the poster's rule, with its gallbladder and falciform ligament, patches coloured by a stand-in uptake and hubs picked out.

- **File:** `tools/pet/sets/liver.js`; manifest `tools/pet/sets/liver.md`.
- **Belongs to:** the pet story.
- **Frame:** Seen from the front: x the patient's left, y up, z forward; centred on the origin by its bounding box.
- **Size:** 1.65 wide, 0.99 tall, 0.77 deep (about 1 unit = 13 cm).
- **Data (illustrative):** reads PET_DATA.organs (liver colour only). Shape and patches are generated, seeded and deterministic; no patient data.
- **Cost and notes:** Explore-only scene in the PET story. Surface from a signed distance field by surface nets at load (~0.7 s). liver_spin turns it about its vertical axis; bring it back to 0 before the close view. Exports api (patches, links, theta, hubs, step, pairs ...). Node cold build 741 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `liver_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `liver_grow` | 0..1 | 1 | yes | patches appear from the middle of the patches outwards, with a cyan front (not white: it must not read as the hottest tissue); at 0 only the glassy organ shows, a |
| `liver_links` | 0..1 | 1 | yes | the links appear (from the middle out, in a loose order); the patches dim a little and the shell, the gallbladder and the ligament step back |
| `liver_top` | 0..1 | 0 | yes | the best-connected 5 % stand out: each keeps its own hot-iron colour (its uptake) inside a slowly pulsing orange-yellow ring (#ffb020), a little larger and brighter |
| `liver_spin` | turns (0.25 = quarter turn) | 0 | yes | turns the organ about its vertical axis (0.25 = a quarter turn); anchors follow |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [-16, 9, 3.4, 0, -0.02, 0] | three-quarter front view, the whole organ |
| `front` | [0, 3, 3.1, 0, 0, 0] | straight at the front, the atlas view: both lobes, the notches and the gallbladder's fundus |
| `close` | [-34, 12, 1.7, -0.427, 0.153, 0.073] | into the web round the warmer patch (only for liver_spin 0) |
| `below` | [-12, -52, 3.1, 0, -0.05, 0] | the underside: the gallbladder in its bed |
| `side` | [-90, 6, 3, 0, 0, 0] | from the patient's right: the right lobe's wedge-shaped profile |

Explore controls: **View** (`view`: `patches` Patches, `links` Links, `hubs` Hubs). `explore(c)` drives `liver_grow`, `liver_links`, `liver_top`, `liver_spin`.

Anchors (11): `centre`, `core`, `top`, `right`, `left`, `dome`, `notch`, `teres`, `warm`, `cool`, `web`.

Own labels (3): "3,000 patches" at `right`; "Links:uptake ratio above the threshold" at `web`; "Best connectedthe top 5 % of patches" at `top`.

API (`set.api`): `patches`, `links`, `theta`, `hubs`, `step`, `pairs`, `meanLinks`, `maxLinks`.

### `micro/organs`

Small lit 3D models of the 29 organs of the microanatomy atlas (adipose to vagina), each a signed distance field of a few primitives polygonised by surface nets, replacing flat icons. Used as meshes on the body, the atlas plates and the network's organ ring, and as pictures in panes.

- **File:** `tools/micro/sets/organs.js`; manifest `tools/micro/sets/organs.md`.
- **Belongs to:** the micro story; reused by micro/atlas, micro/hier, topo/*.
- **Frame:** Each model is centred in its own small box; no shared scene frame. Other sets read ORGAN3D, not this set's group.
- **Size:** drawn small (organ nodes on the network ring are radius 0.062 + 0.005 sqrt(degree)).
- **Data (none):** reads MICRO_DATA.organs (names, to find each model by name). Drawn models; natural colours brightened for the dark scene.
- **Cost and notes:** Slow to build (about 2.8 s in total), so it is built between frames from the start, one organ after another, the one on show first. Exports tris, trisLite and ORGAN3D (the topology liver scene uses it). Harness only controls: organs_spin, organs_tint, organs_pics, organs_lite. Node cold build 2685 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `organs_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `organs_spin` | 0..1 | 0 | yes | turns the models (harness) |
| `organs_tint` | 0..1 | 0 | yes | models take their level colour (harness) |
| `organs_pics` | 0..1 | 0 | yes | lays the 2D pictures over the page (harness) |
| `organs_lite` | 0..1 | 0 | yes | shows the lighter low-triangle models |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 0, 3.4, 0, 0, 0] | one frame for the harness grid of 29 models |

Explore controls: none.

Anchors (0): none.

Own labels (29): "brain"; "thyroid"; "lungs"; "heart"; "liver"; "spleen"; "pancreas"; "kidney"; and 21 more.

Other exports: `tris`, `trisLite`.

### `micro/slide`

The preprint's method (H&E-UTAG) shown on one section: it is cut into tiles, a vision model describes each as glowing blocks, a network of neighbours passes messages, the tiles lift into a 3D map where alike tiles gather and take their domain colour, then fly back and colour the section; the domains change from age 20 to 70.

- **File:** `tools/micro/sets/slide.js`; manifest `tools/micro/sets/slide.md`.
- **Belongs to:** the micro story; reuses lbi/tissue (overlay in its frame).
- **Frame:** An overlay in the tour's tissue set's frame (the stomach-wall H&E slab); show tissue and slide together with the same transform.
- **Size:** as the tissue slab (~2.1 long). Shown together with: `lbi/tissue` (same frame).
- **Data (mixed):** reads MICRO_DATA. Domain shares and examples from the preprint (Buljan, Bago-Horvath, Rendeiro, bioRxiv 2025), typed in; tiles and features are drawn. No GTEx images.
- **Cost and notes:** Copies layers(), plane(), the centring and the lymphoid aggregate from the tissue set; if tissue.js changes its geometry, change it here too. Step params slide_focus. Exports api (domains, titles, colours, shares, pick, recolour), textures, dispose. Node cold build 123 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `slide_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `slide_tiles` | 0..1 | 0 | yes | tile outlines draw on, each traced round its edge, in a diagonal sweep from left to right with some randomness |
| `slide_feat` | 0..1 | 0 | yes | the slide darkens and every tile's mosaic lights up, in a wave from the close-up tile (each block rises over 0.45 of the param) |
| `slide_adj` | 0..1 | 0 | yes | each tile takes its own tint (0-0.25); the network appears in a wave from the close-up tile (nodes, then links), messages run along the links, and the tints and mosaics |
| `slide_group` | 0..2 | 0 | yes | 0..2. 0-1: the nodes lift off (staggered) and gather in the map, taking their group's colour; the links go (0-0.25) |
| `slide_domain` | 0..1 | 0 | yes | tiles take their domain colours one by one (each over 0.45 of the param, the last starting at 0.55) |
| `slide_age` | 0..1 | 0 | yes | age 20 (0) to 70 (1): the submucosa / muscle border rises, so the submucosa loses the same fraction of itself as in the preprint's example (about a fifth) |
| `slide_focus` | 0..6 (domain + 1) | 0 | **no** | 0..6: domain index + 1 (0 none). That domain shows its colour (even without slide_domain), glows softly and gets bright borders; the rest dim, their borders too |
| `slide_gauge` | 0..1 | 0 | yes | shows the gauge (and its label) even at age 20 |
| `slide_ghost` | 0..1 | 0 | yes | harness only: draws an instance of SETS.tissue under the overlay (built the first time it is > 0) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 6, 3.2, 0, 0, 0] | the whole slab (as the tissue set's section) |
| `section` | [0, 6, 3.2, 0, 0, 0] | the whole section, same as default |
| `tiles` | [-20.556, 12, 1.7, -0.301, 0.108, -0.03] | the top-left tiles), feat (over the close-up tile's mosaic, a little right of it), listen (the close-up |
| `matrix` | [-20.123, 20, 0.56, -0.164, 0.121, -0.024] | the mosaics close up at a slant, so the blocks stand out of the slide |
| `close` | [-12.428, 26, 0.8, -0.137, 0.119, -0.011] | the network over the close-up tile and its neighbours |
| `group` | [-12, 12, 3, 0.08, 0.34, 0.135] | the map and the whole section under it |
| `domains` | [5, 5, 2.85, 0.02, -0.02, 0] | the domain map with its labels |
| `age` | [0, 8, 3.25, -0.06, 0.12, 0] | the section for the age sweep from 20 to 70 |

Explore controls: **View** (`view`: `section` Section, `tiles` Tiles, `matrix` Features, `close` Neighbours, `group` Groups, `domains` Domains, `age` Age); **Age** (`age`: `20` 20, `70` 70). `explore(c)` drives `slide_tiles`, `slide_feat`, `slide_adj`, `slide_group`, `slide_domain`, `slide_age`, `slide_gauge`.

Anchors (20): `tiles`, `feat`, `listen`, `close`, `cloud`, `cloudC`, `mucosa`, `submucosa`, `inner`, `outer`, `lymphoid`, `vessels`, `muscularis`, `gauge`, `grp0`, `grp1`, `grp2`, `grp3`, `grp4`, `grp5`.

Own labels (17): "Tiles" at `tiles`; "Featuresa list of numbers a tile" at `feat`; "Each tilelistens to its neighbours" at `listen`; "Alike tilesgather: a domain each" at `cloud`; "Mucosa" at `grp0`; "Submucosa" at `grp1`; "Muscleinner, circular" at `grp2`; "Muscleouter, lengthwise" at `grp3`; and 9 more.

API (`set.api`): `domains`, `titles`, `colours`, `shares`, `pick`, `domainColour`, `recolour`.

Other exports: `textures`, `dispose`, `tileCount`, `linkCount`.

### `micro/atlas`

The slide library as a curved wall of glass slides, the atlas of 40 sections standing in relief on a 10 x 4 arc with each section's organ model, a cloud of tiles, the volcano of changing domains, the age trajectories on glass lanes; at the end it morphs into the network of organ architecture.

- **File:** `tools/micro/sets/atlas.js`; manifest `tools/micro/sets/atlas.md`.
- **Belongs to:** the micro story; reuses micro/organs (ORGAN3D).
- **Frame:** y up, viewer towards +z; wall at the back, sections in front, tiles in the middle; centred on the origin.
- **Size:** not stated in the manifest (see views).
- **Data (figures):** reads MICRO_DATA, ORGAN3D. The preprint's numbers (24,945 slides of 40 tissues) typed in and values read off the talk's figures (figures.json). Sections and slides are drawn, never GTEx images.
- **Cost and notes:** Build 0.25 to 1.9 s depending on load; up to 14 draw calls; 150k to 225k triangles per view. atlas_net jumps (the morph is keyed with hier_grow; the network takes the atlas's turn at hand-over). Exports api (tissues, organs, examples, tiles, useNetwork, netLead, netMap ...). Node cold build 1074 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `atlas_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `atlas_lib` | 0..1 | 1 | yes | the library: slides burst from the stage's middle onto the wall in waves (the centre columns first); glints sweep the glass |
| `atlas_map` | 0..1 | 0 | yes | the atlas: each tissue's section leaves its column on the wall and comes forward to the arc as an H&E section (0.0 to 0.6), then its domain colours wash in |
| `atlas_umap` | 0..1 | 0 | yes | the tile cloud: tiles rise out of the sections (staggered, an arc upwards) into the embedding; plates and captions fade |
| `atlas_focus` | 0..40 (tissue + 1) | 0 | **no** | tissue index + 1 (0 none): that section comes forward big, the others recede and dim |
| `atlas_age` | 0..1 | 0 | yes | age 20 -> 70 for every section's domains; a gauge with a marker runs along the top of a focused section |
| `atlas_volcano` | 0..1 | 0 | yes | the volcano: a dark glass floor and the two axes as lit rods, a faint grid (0 to 0.35); bubbles (lit spheres) pop in with their soft shadows on the floor (0.15 to 0.8) |
| `atlas_curves` | 0..1 | 0 | yes | trajectories: five lanes, each on a strip of dark glass, draw from age 20 to 70 as a glowing tube along the top of a lit ribbon (0.034 deep) over a soft curtain |
| `atlas_net` | 0..1 (morph, jumps) | 0 | **no** | with atlas_map 1 the atlas turns into the network of organ architecture, in step with hier_grow |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 10, 3.4, 0, 0, -0.12] | the wall of slides (same as library) |
| `library` | [0, 10, 3.4, 0, 0, -0.12] | the curved wall of glass slides |
| `atlas` | [0, 3, 3.2, 0, 0, 0.14] | the arc's centre |
| `umap` | [24, 14, 3.3, 0, 0.05, 0.08] | the cloud of tiles in the middle |
| `focus` | [-26, 16, 1.95, 0, 0, 0.72] | the focused section's centre, or the atlas's centre |
| `volcano` | [-6, 9, 3.1, 0.24, 0.02, 0.1] | the volcano of bubbles over its glass floor, with a section beside it |
| `curves` | [-20, 14, 3.4, 0.33, -0.04, 0.08] | the trajectories on their glass lanes, age 20 to 70 |
| `age` | [0, 6, 3.4, 0.2, 0.02, 0.3] | volcano or curves with a focused section |
| `slides` | [-8, 6, 0.75, -0.1, 0.22, -0.49] | close on a tissue's glass slides |
| `shelf` | [-32, 10, 0.3, -0.12, 0.1, -0.47] | very close: slides standing in the wall's compartments |

Explore controls: **View** (`view`: `library` Library, `atlas` Atlas, `tiles` Tiles, `age` Age, `pathology` Pathology); **Age** (`age`: `20` 20 years, `70` 70 years). `explore(c)` drives `atlas_lib`, `atlas_map`, `atlas_umap`, `atlas_volcano`, `atlas_curves`, `atlas_age`.

Anchors (118): `library`, `libTop`, `libBase`, `libAge`, `libAge20`, `libAge70`, `atlas`, `atlasTop`, `umap`, `umapTop`, `focus`, `focusTop`, `age20`, `age70`, `ageMark`, `volcano`, `volcanoTop`, `vLeft`, `vRight`, `curves`, `curveAxis`, `age`, `ex0`, `exDom0` and 94 more.

Own labels (32): "24,945 slides" at `libTop`; "40 tissues of 29 organs" at `libBase`; "983 people, aged 20 to 70" at `libAge`; "70 years" at `libAge70`; "20 years" at `libAge20`; "218 domains in 74 types" at `atlasTop`; "162 million tiles, 218 domains" at `umapTop`; "28 % of domains change with age" at `volcanoTop`; and 24 more.

API (`set.api`): `tissues`, `short`, `organs`, `examples`, `pick`, `domainColour`, `domains`, `tissuesOf`, `volcanoFromFigure`, `slides`, `tiles`, `useNetwork`, `netLead`, `netMap`.

Other exports: `finish`.

### `micro/hier`

Organ architecture as a four-level hourglass network (29 organs, 24 tissues, 10 tissue types, 70 domains) with glowing curved links, each organ its small 3D model, and the contact networks between domains for six organs.

- **File:** `tools/micro/sets/hier.js`; manifest `tools/micro/sets/hier.md`.
- **Belongs to:** the micro story; reuses micro/organs (ORGAN3D).
- **Frame:** Centred on the origin facing +z; rings at y 0.66 (organs, radius 0.9), 0.28 (tissues, 0.7), -0.1 (tissue types, 0.4), -0.62 (domains, 0.9).
- **Size:** radius ~0.9; node sizes by degree.
- **Data (real):** reads MICRO_DATA.graph. Iva Buljan's network of organ architecture (the file stays out of the repository); contacts from the talk.
- **Cost and notes:** Organs are meshes built between frames (idle, finish; spheres until then). 342 labels. Focus and organ are step params. Exports api (nodes, levels, pick, find, linked, organsOfType, organsOfDomain, contactOrgans, layout ...). Node cold build 115 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `hier_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `hier_grow` | 0..1 | 1 | yes | the network grows top to bottom: organs 0-0.18, tissues 0.22-0.4, tissue types 0.44-0.62, domains 0.66-0.84 |
| `hier_focus` | -1..132 (node index) | -1 | **no** | a node index into MICRO_DATA.graph.nodes (-1 none): it and everything linked above and below light up |
| `hier_contacts` | 0..1 | 0 | yes | the contact network comes forward: nodes fly 0.04-0.56, bands draw from both ends to the middle 0.55-0.95, its labels from 0.55 |
| `hier_organ` | 0..5 (contact network) | 0 | **no** | which contact network: 0 Colon, 1 Skin, 2 Ovary, 3 Fallopian tube, 4 Uterus, 5 Coronary artery (a fraction crossfades two) |
| `hier_age` | 0..1 | 0 | yes | age 20 (0) to 70 (1): the changing bands' widths and colours; nodes of the preprint's examples change size |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 12, 4.15, 0, -0.03, 0] | the whole hourglass |
| `net` | [28, 38, 4.6, 0, -0.2, 0] | from above: the rings |
| `grow` | [6, 20, 4.4, 0, 0, 0.12] | higher and further back: wide enough for the atlas's sections in front of the network |
| `contacts` | [0, 6, 2.8, 0.28, 0.05, 0.45] | the contact network left of the middle with its notes column on the right |

Explore controls: **View** (`view`: `network` Network, `contacts` Contacts); **Organ** (`organ`: `0` Colon, `1` Skin, `2` Ovary, `3` Fallopian tube, `4` Uterus, `5` Coronary artery); **Age** (`age`: `20` 20 years, `70` 70 years). `explore(c)` drives `hier_grow`, `hier_contacts`, `hier_organ`, `hier_age`.

Anchors (12): `top`, `bottom`, `connective`, `focus`, `contacts`, `change`, `core`, `age`, `lv0`, `lv1`, `lv2`, `lv3`.

Own labels (342): "Organs · 29" at `lv0`; "Tissues · 24 in this map" at `lv1`; "Tissue types · 10" at `lv2`; "Domains · 70" at `lv3`; "Connective tissue · in 28 of 29 organs" at `connective`; "Adipose · 2 tissues, 5 types" at `fn`; "Adipose" at `fn`; "Adrenal Gland · 2 tissue types" at `fn`; and 334 more.

API (`set.api`): `nodes`, `levels`, `pick`, `find`, `linked`, `organsOfType`, `organsOfDomain`, `contactOrgans`, `levelColour`, `layout`, `useColours`.

Other exports: `idle`, `finish`.

### `ovary/organ`

A large cut-away ovary (almond-shaped, tunica albuginea, cortex and medulla) with antral follicles, scars (corpora albicantia), vessels and a corpus luteum, whose contents follow the poster's trend lines as it ages from 20 to 70. It is small in the body's pelvis at first and grows out of it. Say "drawn", never "to scale".

- **File:** `tools/ovary/sets/organ.js`; manifest `tools/ovary/sets/organ.md`.
- **Belongs to:** the ovary story; reuses lbi/body (small in its pelvis).
- **Frame:** Centred on the origin; in the body, the same frame as the body set (the ovary sits in its pelvis before growing).
- **Size:** ~1.9 long, 1.1 tall, 0.9 deep. Shown together with: `lbi/body` (same frame).
- **Data (figures):** reads OVARY_TREND, OVARY_LOOK, OVARY_DATA. Trend lines read off the poster's figures by two readers (approximate; said so on screen) with the poster's numbers typed in; the organ is drawn.
- **Cost and notes:** American spelling. Built from signed distance fields by surface nets between frames (idle, finish, built, shown; ~0.3 s). Function labels (organ_counts) are read again while shown. Controls: View (cut, closed, body), Age, Show. Node cold build 282 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `organ_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `organ_grow` | 0..1 | 1 | yes | 0 small in the body, 1 large at the centre (position, scale and turn ease between) |
| `organ_body` | 0..1 | 0 | yes | the pelvis while small: the other ovary, the uterus, the tubes (fades as organ_grow passes 0.3) |
| `organ_open` | 0..1 | 1 | yes | 0 closed (the wedge in place), 1 cut open (the wedge lifts up and right, fading from 0.45) |
| `organ_age` | 20..70 (years) | 30 | yes | the donor age shown, 20 to 70 years; follicles, scars and vessels follow the poster's trend lines |
| `organ_follicle` | 0..1 | 0 | yes | picked out in the poster's colors (lifted for the dark scene; the luteum golden), glowing a little; the rest dims |
| `organ_albicans` | 0..1 | 0 | yes | picked out in the poster's colors (lifted for the dark scene; the luteum golden), glowing a little; the rest dims |
| `organ_vessel` | 0..1 | 0 | yes | picked out in the poster's colors (lifted for the dark scene; the luteum golden), glowing a little; the rest dims |
| `organ_luteum` | 0..1 | 0 | yes | picked out in the poster's colors (lifted for the dark scene; the luteum golden), glowing a little; the rest dims |
| `organ_parts` | 0..1 | 0 | yes | the part labels |
| `organ_agelab` | 0..1 | 0 | yes | the age readout label ("Age · 35 years", a function label) |
| `organ_counts` | 0..1 | 0 | yes | three live tags with each method's count on the poster's lines at organ_age |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [24, 14, 3.5, 0.08, 0, 0] | the cut-away ovary in three-quarter view |
| `face` | [4, 4, 2.6, 0.3, 0.02, 0] | the cut face square on |
| `cortex` | [10, 10, 1.15, 0.313, 0.362, 0] | right-hand end of the band), medulla, follicle (the |
| `medulla` | [6, 6, 1.25, 0.06, 0.03, 0] | close on the pink medulla |
| `whole` | [-58, 16, 3.3, -0.1, 0.02, 0] | the intact end |
| `open` | [38, 22, 3.6, 0.15, 0.05, 0.2] | for the wedge lifting |
| `pelvis` | [0, 6, 0.62, 0, -0.07, 0.02] | the body's pelvis, close |
| `body` | [0, 4, 3.6, 0, 0, 0] | the whole body |

Explore controls: **View** (`view`: `cut` Cut open, `closed` Closed, `body` In the body); **Age** (`age`: `20` 20, `30` 30, `40` 40, `50` 50, `60` 60, `70` 70); **Show** (`show`: `none` All, `follicle` Follicles, `albicans` Scars, `vessel` Vessels). `explore(c)` drives `organ_grow`, `organ_body`, `organ_open`, `organ_age`, `organ_follicle`, `organ_albicans`, `organ_vessel`, `organ_luteum`, `organ_parts`, `organ_agelab`.

Anchors (16): `cortex`, `medulla`, `follicle`, `oocyte`, `primordial`, `secondary`, `luteum`, `albicans`, `vessel`, `hilum`, `surface`, `blister`, `top`, `age`, `small`, `pelvis`.

Own labels (10): "Cortexwhere the follicles are" at `cortex`; "Medullavessels, loose tissue" at `medulla`; "Folliclefluid-filled" at `follicle`; "Primordial folliclesthe reserve" at `primordial`; "Corpus albicansa pale scar" at `albicans`; "Corpus luteum" at `luteum`; "(computed text)" at `age`; "(computed text)" at `follicle`; and 2 more.

Other exports: `idle`, `finish`, `built`, `shown`.

### `ovary/section`

A drawn H&E section of an ovary with blood vessels, macrophages, corpora albicantia, follicles and cysts in relief; tiles, UNI2 features and a forest of decision trees that votes; SegFormer's masks with scores as tags; and an illustrative neighbor network that tips off the section and gathers into five hubs by kind joined by bands.

- **File:** `tools/ovary/sets/section.js`; manifest `tools/ovary/sets/section.md`.
- **Belongs to:** the ovary story.
- **Frame:** Section A in the xy plane facing +z, centred on the origin; a second section for the pair view; the grove and hubs beside it.
- **Size:** section ~1.9 x 1.5, 0.03 thick.
- **Data (mixed):** reads OVARY_DATA, OVARY_TREND, OVARY_LOOK. The poster's numbers typed in (14,941 hand-marked objects, scores, counts); the section and the neighbor network are drawn and illustrative (labelled so). No GTEx image.
- **Cost and notes:** American spelling. Stain made between frames (flat eosin until made). Exports idle, finish, built, api (kinds, pick, hitAt, views, count, objects, tiles, links, byKind, hubs). Pointing at an object on the section picks it in explore. Node cold build 195 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `section_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `section_age` | 20..70 (years) | 30 | yes | section A's age |
| `section_pair` | 0..1 | 0 | yes | A shrinks to the left, B comes in on the right (both at 0.58), scale bars and labels |
| `section_vessel` | 0..1 | 0 | yes | picks out the vessel objects on section A and dims the rest |
| `section_macrophage` | 0..1 | 0 | yes | picks out the macrophage objects on section A and dims the rest |
| `section_albicans` | 0..1 | 0 | yes | picks out the albicans objects on section A and dims the rest |
| `section_follicle` | 0..1 | 0 | yes | picks out the follicle objects on section A and dims the rest |
| `section_cyst` | 0..1 | 0 | yes | picks out the cyst objects on section A and dims the rest |
| `section_tiles` | 0..1 | 0 | yes | tile outlines draw on |
| `section_feat` | 0..1 | 0 | yes | the feature blocks (the section darkens) |
| `section_forest` | 0..1 | 0 | yes | the vote: grove in by 0.12, features flow 0.1-0.45, trees answer 0.35-0.85, verdict 0.8-0.95, tile lit at 1 |
| `section_pred` | 0..1 | 0 | yes | predictions sweep across (the blocks go) |
| `section_mask` | 0..1 | 0 | yes | SegFormer's masks sweep across (0 none, 1 all) |
| `section_net` | 0..1 | 0 | yes | the network draws outwards (the section dims a little); the network by kind needs it too |
| `section_lift` | 0..1 | 0 | yes | the slab tips back about 70 degrees (and sinks 0.5) and the nodes rise off it |
| `section_kinds` | 0..1 | 0 | yes | the nodes gather into the hubs (setting off 0 to 0.375, arriving 0.625 to 1; hubs grow 0.35 to 0.8), stems go by 0.3, links bundle and fade 0.55 to 0.92, bands grow |
| `section_names` | 0..1 | 0 | yes | the hubs' names as set labels (explore's By kind view; the story may key it instead of its own labels) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 8, 3.5, 0, 0, 0] | the whole section A |
| `close` | [10, 16, 0.85, 0.521, 0.299, 0] | the largest follicle |
| `pair` | [0, 6, 3.4, 0, 0, 0] | section A beside the second section |
| `tiles` | [0, 22, 3, 0, 0, 0] | from above, the tiles |
| `feat` | [16, 38, 1, -0.637, 0.337, 0] | a slant close-up of the blocks |
| `forest` | [-16, 10, 4.6, 0.5, 0, 0] | above the grove |
| `mask` | [0, 10, 3.3, 0, 0, 0] | the sweep line |
| `net` | [8, 32, 3.1, 0, 0.02, 0] | the neighbor network lifted off the section |
| `kinds` | [0, 12, 4.4, 0, 0.24, 0] | the middle of the hubs |

Explore controls: **View** (`view`: `section` Section, `pair` Young and old, `tiles` Tiles, `forest` Forest, `masks` Masks, `network` Network, `kinds` By kind); **Age** (`age`: `20` 20, `30` 30, `40` 40, `50` 50, `60` 60, `70` 70); **Pick out** (`show`: `none` None, `vessel` Vessels, `macrophage` Macrophages, `albicans` Scars, `follicle` Follicles, `cyst` Cysts). `explore(c)` drives `section_age`, `section_pair`, `section_tiles`, `section_feat`, `section_forest`, `section_pred`, `section_mask`, `section_net`, `section_lift`, `section_kinds`, `section_names`.

Anchors (30): `vessel`, `macrophage`, `albicans`, `follicle`, `cyst`, `center`, `young`, `old`, `barYoung`, `barOld`, `tiles`, `tile`, `feat`, `forest`, `uni`, `pred`, `mask`, `net`, `kinds`, `kindsLabel`, `hub_vessel`, `hub_macrophage`, `hub_albicans`, `hub_follicle` and 6 more.

Own labels (15): "Younger ovary" at `young`; "Older ovary" at `old`; "1.58 mm" at `barYoung`; "791 µm" at `barOld`; "Tiles" at `tiles`; "FeaturesUNI2: numbers per tile" at `feat`; "Random foresttrees vote on each tile" at `forest`; "SegFormerpaints a mask" at `mask`; and 7 more.

API (`set.api`): `kinds`, `pick`, `hitAt`, `views`, `count`, `objects`, `tiles`, `links`, `byKind`, `hubs`.

Other exports: `idle`, `finish`, `built`.

### `ovary/charts`

Only the donors in 3D: 255 glass slides fly in, fan out in three arcs and stack into the poster's age histogram, one slide per donor. The story's one graph, shown in passing.

- **File:** `tools/ovary/sets/charts.js`; manifest `tools/ovary/sets/charts.md`.
- **Belongs to:** the ovary story.
- **Frame:** Centred near the origin facing +z in front of a backdrop of ages and counts.
- **Size:** not stated in the manifest (see views).
- **Data (real):** reads OVARY_DATA.cohort.age. The poster's histogram heights; each slide's age is a whole year in its bar. Donor ages only.
- **Cost and notes:** Cheap (2 ms). Not a scene in explore. Other charts went with the owner's rule against 2D graphs (October 2026). Node cold build 2 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `charts_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `charts_slides` | 0..1 | 0 | yes | the slides fly in (fan); the histogram's slides need it at 1 |
| `charts_hist` | 0..1 | 0 | yes | the slides stack into the histogram (younger bars first), backdrop from 0.4 |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 6, 3.2, -0.05, -0.1, 0] | the slides and the histogram (same as hist) |
| `hist` | [0, 6, 3.2, -0.05, -0.1, 0] | the age histogram of 255 donors |
| `fan` | [0, 14, 3, 0, -0.15, 0] | the slides fanned out in three arcs |

Explore controls: none.

Anchors (4): `hist`, `histTop`, `fan`, `slides`.

Own labels (1): "255 donorsGTEx, aged 20 to 70" at `histTop`.

### `qubits/pairs`

Why pairs: a grid of all pairs of genes grows; the example network as a city map with two walkers settling into valleys; a chip with three qubits; and the map folding into eight neighborhoods placed on a ring in Gray-code order with three-digit codes.

- **File:** `tools/qubits/sets/pairs.js`; manifest `tools/qubits/sets/pairs.md`.
- **Belongs to:** the qubits story.
- **Frame:** Centred on the origin, flat map seen from above; neighborhoods on a ring in Gray order.
- **Size:** not stated in the manifest (see views).
- **Data (illustrative):** reads QMATH, QLOOK. Example network (QMATH.DEFAULT, Uneven groups: 320 genes, 5,637 links) computed live; the valleys of the walkers' map are labelled illustrative. American spelling.
- **Cost and notes:** pairs_code is a step param. Exports api (genes, links, codes, hood, nmax). Node cold build 282 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `pairs_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `pairs_genes` | 0..1 | 1 | yes | the grid's genes (dots on its diagonal) |
| `pairs_grid` | 0..1 | 0 | yes | the grid of pairs grows: genes n = 6 x 40^grid (6 to 240), pairs n(n-1)/2; the spacing shrinks so it fills the view |
| `pairs_map` | 0..1 | 1 | yes | the city map (ground, streets, street lights); the grid fades as it comes |
| `pairs_walk` | 0..1 | 1 | yes | two walkers (magenta, cyan) wander the streets with short trails (by t) |
| `pairs_valley` | 0..1 | 1 | yes | the valleys dip and glow amber (two, on opposite sides of the map) |
| `pairs_settle` | 0..1 | 0 | yes | the walkers settle in the valleys; an amber arc joins them (the pair) |
| `pairs_chip` | 0..1 | 0 | yes | the chip with three qubits beside the map (qubits twinkle; with a code picked they show its bits) |
| `pairs_fold` | 0..1 | 0 | yes | the map folds into the eight neighborhoods (rings in the cells' colors, code labels) |
| `pairs_code` | 0..8 (neighborhood + 1) | 0 | **no** | 0 none, k = 1..8: neighborhood k-1 lights up, its code shows on the chip (bright qubit = 1) and an arc joins them |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [18, 46, 3.6, 0.15, -0.3, 0] | the map of the example network from above (same as map) |
| `grid` | [0, 3, 3.5, 0, 0, 0] | face on to the grid |
| `map` | [18, 46, 3.4, 0, -0.3, 0] | oblique over the map |
| `walkers` | [24, 34, 2.6, 0, -0.3, 0] | closer, the valleys |
| `chip` | [-12, 34, 3.7, 0.45, -0.25, 0.1] | the three-qubit chip and the folded ring |
| `hoods` | [6, 58, 3.9, 0.35, -0.3, 0.05] | from above, the folded ring and the chip |

Explore controls: **View** (`view`: `pairs` Pairs, `map` Map, `walkers` Walkers, `hoods` Neighborhoods). `explore(c)` drives `pairs_genes`, `pairs_grid`, `pairs_map`, `pairs_walk`, `pairs_valley`, `pairs_settle`, `pairs_chip`, `pairs_fold`, `pairs_code`.

Anchors (20): `tri`, `genes0`, `corner`, `map`, `walker0`, `walker1`, `valley0`, `valley1`, `chip`, `q2`, `q1`, `q0`, `hood0`, `hood1`, `hood2`, `hood3`, `hood4`, `hood5`, `hood6`, `hood7`.

Own labels (13): "(computed text)" at `corner`; "Walker 1" at `walker0`; "Walker 2" at `walker1`; "Valley · illustrative" at `valley0`; "(computed text)" at `chip`; "000" at `hood0`; "001" at `hood1`; "010" at `hood2`; and 5 more.

API (`set.api`): `genes`, `links`, `codes`, `hood`, `nmax`.

### `qubits/cube`

The cuts and the coarse operator: the network is cut in two, four and eight and its genes fly to the corners of a cube; the coarse operator A_c lives on the cube; Pauli strings are small cubes with weights, added one by one as the error shrinks; the toolbox (so(6) or so(7)) keeps strings in the algebra bright and drops the rest.

- **File:** `tools/qubits/sets/cube.js`; manifest `tools/qubits/sets/cube.md`.
- **Belongs to:** the qubits story.
- **Frame:** Centred on the origin; first cut left/right, second front/back, third top/bottom; 000 is top-front-left.
- **Size:** not stated in the manifest (see views).
- **Data (illustrative):** reads QMATH, QLOOK. Every number is computed live by QMATH for the example networks (nothing is the real network's). The cut stands in for the authors' beam search.
- **Cost and notes:** Builds its default network at load and the others when first asked for in explore (a short pause). Step params: cube_net, cube_cut, cube_algebra, cube_focus. Labels with function text (gallery weights, grid count). Exports finish, api (nets, analysis, analyze, bricks, lesson, algebra, corner, pick). Node cold build 52 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `cube_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `cube_net` | 0..3 (example network) | 1 | **no** | which example network: 0 Clear groups, 1 Uneven groups, 2 Strong mixing, 3 Random network |
| `cube_cut` | 0..1 (found cut or random) | 0 | **no** | 0 the found cut, 1 random halvings. Step param |
| `cube_genes` | 0..1 | 0 | yes | the gene-level network (points and links) |
| `cube_bits` | 0..3 | 3 | yes | 0..3: the cuts (0 the network, 1 two halves, 2 a square, 3 a cube); links across the cut being made flash amber and a glowing sheet shows the cut |
| `cube_ac` | 0..1 | 1 | yes | the genes gather into their corners and the coarse operator grows: a loop at each corner (the diagonal), an edge between every two corners as wide as their coupling |
| `cube_bricks` | 0..1 | 0 | yes | the big cube moves left and the gallery of strings comes in (2 rows of 5) |
| `cube_lesson` | 0..1 | 0 | yes | 1: the gallery shows the reference figure's strings one by one, without weights (I, X0, X1, X2, Z2, Z2X1, X2X1, Y2Y1) |
| `cube_build` | 0..1 | 0 | yes | the big cube shows the sum of the strings added so far (a gray ghost of A_c behind), with the error-left gauge under it |
| `cube_sum` | 0..10 | 0 | yes | 0..10: how many strings have been added (continuous: each flies from its slot into the big cube) |
| `cube_alg` | 0..1 | 0 | yes | strings outside the algebra go gray in the gallery |
| `cube_keep` | 0..1 | 0 | yes | the big cube keeps only the trace part and the strings inside the algebra; the gauge shows the residual |
| `cube_algebra` | 0..1 (so(2L) or so(2L+1)) | 1 | **no** | 0 so(2L) (the TFIM chain), 1 so(2L+1) (with the boundary Z on the top qubit) |
| `cube_focus` | -1, 0.. (string index) | -1 | **no** | a string index k (QMATH.parse(name, L), at the bits shown) or -1: the big cube shows that one string's pattern (its loops and hops, unit size) and its name and what it |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [24, 16, 3.3, 0, 0, 0] | three-quarter view of the cube, as in the reference figure |
| `genes` | [30, 14, 3.6, 0, 0, 0] | the network's center |
| `cube` | [24, 16, 2.7, 0, 0.02, 0] | the big cube's center, moves with the gallery |
| `bricks` | [4, 8, 5.6, 0.45, -0.02, 0] | the gallery now , lesson(L) the lesson's names |
| `gallery` | [2, 6, 3.9, 1.12, -0.02, 0] | the gallery of Pauli-string bricks |

Explore controls: **View** (`view`: `genes` Genes, `cut` Cut, `cube` Cube, `bricks` Bricks, `toolbox` Toolbox); **Network** (`net`: `0` Clear groups, `1` Uneven groups, `2` Strong mixing, `3` Random network); **Cut** (`cut`: `0` Found, `1` Random); **Bits** (`bits`: `3` 3, `2` 2, `1` 1); **Algebra** (`alg`: `1` so(2L+1), `0` so(2L)). `explore(c)` drives `cube_net`, `cube_cut`, `cube_bits`, `cube_genes`, `cube_ac`, `cube_bricks`, `cube_lesson`, `cube_build`, `cube_sum`, `cube_alg`, `cube_keep`, `cube_algebra`, `cube_focus`.

Anchors (26): `genes`, `cube`, `top`, `gallery`, `gauge`, `cut1`, `cut2`, `cut3`, `c000`, `c001`, `c010`, `c011`, `c100`, `c101`, `c110`, `c111`, `brick0`, `brick1`, `brick2`, `brick3`, `brick4`, `brick5`, `brick6`, `brick7` and 2 more.

Own labels (40): "0" at `fn`; "1" at `fn`; "00" at `fn`; "01" at `fn`; "10" at `fn`; "11" at `fn`; "000" at `fn`; "001" at `fn`; and 32 more.

API (`set.api`): `nets`, `defaultNet`, `analysis`, `analyze`, `bricks`, `lesson`, `algebra`, `corner`, `pick`, `NB`.

Other exports: `finish`.

### `qubits/chart`

The real run's best residual by depth (our cuts against random ones, with the example network's own residuals live at 1 to 3 bits) and one Trotter step at 3 bits in so(7) as a circuit of six gates with its angles.

- **File:** `tools/qubits/sets/chart.js`; manifest `tools/qubits/sets/chart.md`.
- **Belongs to:** the qubits story.
- **Frame:** Chart and circuit share the origin; show one at a time.
- **Size:** not stated in the manifest (see views).
- **Data (mixed):** reads QUBITS_DATA, QMATH. Joel Hancock's real run's residuals and circuit angles typed in from his brief, shown only as "in the real network"; the example residuals and angles are computed live.
- **Cost and notes:** Cheap. chart_src is a step (real or example angles). Exports api (residual, example, gates). Node cold build 3 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `chart_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `chart_plot` | 0..1 | 1 | yes | the chart (back panel with lines at 0, 0.25 .. 1, bits 1 to 8 across) |
| `chart_grow` | 0..1 | 1 | yes | the two series draw left to right (bit by bit) |
| `chart_rand` | 0..1 | 1 | yes | the random-cut series (gray, behind) |
| `chart_best` | 0..1 | 1 | yes | the best 8-bit run (0.82, K = 256) as a dashed ring at 8 bits |
| `chart_ex` | 0..1 | 0 | yes | the example network's residuals at 1, 2, 3 bits (amber rings, dashed line) |
| `chart_circuit` | 0..1 | 0 | yes | the circuit: wires q2, q1, q0 (left to right), time running down, pulses down the wires |
| `chart_gates` | 0..6 | 6 | yes | 0..6: the gates appear in time order (RX q0, RX q1, RX q2, RZZ q2 q1, RZZ q1 q0, RZ q2) |
| `chart_run` | 0..1 | 1 | yes | pulses run down the wires and light each gate as they pass (by t) |
| `chart_src` | 0..1 | 0 | **no** | 0 the real run's angles, 1 the example network's |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 8, 3.9, 0.1, 0.02, 0] | the residual chart (same as chart) |
| `chart` | [0, 8, 3.9, 0.1, 0.02, 0] | face on, a little above |
| `circuit` | [-14, 6, 4.1, 0.05, 0.03, 0] | a little from the left |

Explore controls: **View** (`view`: `chart` Chart, `circuit` Circuit); **Example network** (`ex`: `off` Off, `on` On); **Angles** (`src`: `real` Real network, `ex` Example network). `explore(c)` drives `chart_plot`, `chart_circuit`, `chart_grow`, `chart_rand`, `chart_best`, `chart_ex`, `chart_gates`, `chart_run`, `chart_src`.

Anchors (14): `chart`, `ours`, `rand`, `best8`, `ex3`, `ours3`, `axis`, `bits`, `circuit`, `top`, `time`, `q2`, `q1`, `q0`.

Own labels (25): "Our cuts · real network" at `ours`; "Random cuts" at `rand`; "Best 8-bit run · 0.82" at `best8`; "Example network · computed here" at `ex3`; "Residual · 0 nothing lost, 1 all lost" at `axis`; "Bits · qubits per walker" at `bits`; "1"; "2"; and 17 more.

API (`set.api`): `residual`, `example`, `gates`.

### `mutation/letters`

A text in four letters copied with swaps: a 24-pair DNA helix, eight letters peeling into tiles (ACGTTAGC), two copies with swaps flashing, then one letter opened into its two qubits, a mix of letters and read-outs spinning like a coin and piling into four heaps as tall as the chances.

- **File:** `tools/mutation/sets/letters.js`; manifest `tools/mutation/sets/letters.md`.
- **Belongs to:** the mutation story.
- **Frame:** Centred on the origin; helix vertical; tiles in a row.
- **Size:** not stated in the manifest (see views).
- **Data (mixed):** reads MUT_DATA, MMATH, MLOOK. Figure 1's sequences and swaps typed in from the poster; mixes and read-outs computed live by MMATH (example numbers).
- **Cost and notes:** Cheap (6 ms). British spelling. letters_code, letters_target, letters_seed are steps. Exports api (READ_MAX, mix, counts, reads, chances, bloch). Node cold build 7 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `letters_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `letters_helix` | 0..1 | 1 | yes | the helix (both strands, rungs, backbones); it turns by t |
| `letters_peel` | 0..1 | 0 | yes | the ancestor's eight letters grow out of their rungs as tiles, peel away one after another (a zipper) and line up as a row with its strand behind |
| `letters_copy1` | 0..1 | 0 | yes | copy 1 slides out of the ancestor's row (down, left and forward), a dashed green trace behind it |
| `letters_mut1` | 0..1 | 0 | yes | copy 1's two swaps: the first over 0-0.5, the second over 0.5-1 (flip, flash, ring, white frame) |
| `letters_copy2` | 0..1 | 0 | yes | copy 2 slides out (further down, right and forward) |
| `letters_mut2` | 0..1 | 0 | yes | copy 2's two swaps, as copy 1's |
| `letters_open` | 0..1 | 0 | yes | the ancestor's first tile (A) comes forward and grows (0-0.45), the rows fade (0.05-0.5), the two qubits open out of it (0.35-1) |
| `letters_code` | 0..3 (letter code) | 0 | **no** | which two-qubit code is shown, 0..3 (00, 01, 10, 11): the tile turns over and each arrow flips on its own |
| `letters_mix` | 0..1 | 0 | yes | 0 the pure code, 1 the mix: the arrows tilt (amplitudes blended), the tile turns into ? with its ring of four shares |
| `letters_target` | 0..1 | 0 | **no** | the mix: 0 the rule's mix after letters_time from the code's letter (the story's model, uneven), 1 the even mix (a quarter each) |
| `letters_time` | 0..3 (swaps per letter) | 0.45 | yes | the branch length for the rule's mix (swaps per letter, 0..3) |
| `letters_reads` | 0..400 (read-outs, continuous) | 0 | yes | how many read-outs |
| `letters_seed` | integer >= 1 | 1 | **no** | which read-outs come out (MMATH.sample(p, seed, k)) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 9, 3.5, 0, 0.05, 0] | the helix, face on |
| `helix` | [-26, 14, 3, 0, 0, 0] | the helix from the left, showing its grooves |
| `peel` | [8, 12, 3.4, 0, 0.18, 0.05] | the strand peeling into letter tiles |
| `rows` | [12, 10, 3.7, 0, 0.04, 0.12] | the ancestor and its two copies with their swaps |
| `qubits` | [0, 6, 2.9, 0, 0.2, 0.3] | the tile and its two qubits, the codes and the mix |
| `reads` | [0, 12, 3.95, 0, -0.14, 0.35] | the qubits and the four piles of read-outs below |

Explore controls: **View** (`view`: `helix` Helix, `copies` Copies, `qubits` Qubits); **Letter or mix** (`mix`: `A` A, `C` C, `G` G, `T` T, `even` Even, `rule` The rule's mix); **Branch length** (`time`: `0.15` 0.15, `0.45` 0.45, `1` 1, `1.6` 1.6). `explore(c)` drives `letters_helix`, `letters_peel`, `letters_copy1`, `letters_mut1`, `letters_copy2`, `letters_mut2`, `letters_open`, `letters_code`, `letters_mix`, `letters_target`, `letters_time`, `letters_reads`, `letters_seed`.

Anchors (18): `helix`, `centre`, `ancestor`, `copy1`, `copy2`, `ancMid`, `copy1Mid`, `copy2Mid`, `swap1`, `swap2`, `tile`, `qubit1`, `qubit2`, `piles`, `pileA`, `pileC`, `pileG`, `pileT`.

Own labels (11): "DNA · two strands of letter pairs" at `helix`; "Ancestor" at `ancestor`; "Copy 1 · T→C, A→G" at `copy1`; "Copy 2 · G→A, C→T" at `copy2`; "(computed text)" at `tile`; "First qubit" at `qubit1`; "Second qubit" at `qubit2`; "(computed text)" at `pileA`; and 3 more.

API (`set.api`): `READ_MAX`, `mix`, `counts`, `reads`, `chances`, `bloch`.

### `mutation/tree`

A family tree in 3D (8 tips, 14 branches) that grows up from its root as a level of change rises (a branch rises by its length), every swap simulated, letters riding up each branch; a gear (machine) on every branch; and the poster's species tree. You walk round it and look up into it.

- **File:** `tools/mutation/sets/tree.js`; manifest `tools/mutation/sets/tree.md`.
- **Belongs to:** the mutation story.
- **Frame:** Root at (0, -1, 0); tips on a ring round the vertical; the species tree in the same frame (stem set draws in it).
- **Size:** tree ~2.06 units tall with letters, widest radius 1.18. Shown together with: `mutation/stem` (same frame).
- **Data (illustrative):** reads MMATH, MLOOK. Example trees computed live (every mutation simulated under the story's example model).
- **Cost and notes:** In a headset it eases into the stand view (about 1.6 m tall, nothing within 0.35 m of the eyes); the up view is screens only. tree_seed, tree_speed, tree_pick are steps. 11 views. Exports api (speeds, model, tree, species, highlight, branch, pick, mid, tips). Node cold build 32 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `tree_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `tree_species` | 0..1 | 0 | yes | 0 the family tree, 1 the species tree; in between a crossfade (a plain param: the engine eases it) |
| `tree_grow` | 0..1 | 1 | yes | the level of change rising from the root past the highest tip (0 nothing, 1 all grown); a thin green ring marks it while it rises |
| `tree_seq` | 0..1 | 1 | yes | the letters: the ancestor's arc at the root, the rows riding up, the tips' rows |
| `tree_hi` | 0..1 | 0 | yes | lights the long and the short branch (tree.highlight: for seed 1, branch 10, 0.47 swaps per letter, 4 swaps, and branch 7, 0.15, 1 swap) in green, dims the rest, and |
| `tree_gears` | 0..1 | 0 | yes | a gear on every branch (at a third of its way up, the branch its axle), winding up to its turn (2.4 x turnAngle(len)); coupling gears (the double band) on the species |
| `tree_flow` | 0..1 | 0 | yes | the machines run: packets rise through the grown branches (a bead every 1.1 of height, rising 0.55 a second, by t), the gears turn on (faster on longer branches), and |
| `tree_q` | 0..1 | 0 | yes | the glass "?" at the species tree's root (the unknown ancestor; it pulses) |
| `tree_seed` | integer >= 1 | 1 | **no** | which family tree (any integer from 1). Step param |
| `tree_speed` | 0..3 (index into 0.5, 1, 2, 4) | 1 | **no** | how fast letters change: index into [0.5, 1, 2, 4] (a factor on every branch length; it changes the mutations, not the drawing) |
| `tree_pick` | -1..13 (branch) | -1 | **no** | a picked branch (0..13, -1 none): lit cyan with its rise measured, its gear lit; the others dim |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [24, 12, 5, 0, -0.02, 0] | the whole family tree |
| `grow` | [18, 5, 4.6, 0, -0.32, 0] | from low, while the tree grows |
| `crown` | [30, 30, 4.5, 0, 0.42, 0] | the crown and the tips' sequences from above |
| `pair` | [47, 14, 4.6, 0.39, 0.3, -0.26] | the long and the short branch side by side (computed for the tree's seed) |
| `long` | [-24, 12, 2.4, -0.53, 0.38, 0.74] | close on the long highlighted branch (computed) |
| `short` | [142, 12, 2.4, 0.7, 0.23, -0.59] | the middles of the two highlighted branches |
| `gears` | [28, 14, 3.9, 0, -0.28, 0] | the machines: a gear on every branch |
| `stand` | [20, 0, 1.5, 0, 0.15, 0] | the headset view: xrPlace scales it to 0.76 m a unit, so the tree (2.06 units with its letters) stands about 1.6 m tall, its… |
| `up` | [200, -62, 2.2, 0, 0.3, 0.05] | from below the root looking up into the crown (screens only) |
| `species` | [18, 16, 3.9, 0, -0.42, 0.1] | the species tree with its stems |
| `what` | [8, 14, 4.3, 0.16, -0.36, 0] | the species tree with machines running and the stems |

Explore controls: **View** (`view`: `tree` Family tree, `machines` Machines, `species` Species tree); **Tree** (`seed`: `1` 1, `2` 2, `3` 3, `4` 4, `5` 5); **Letters change** (`speed`: `0` Slowly, `1` As in the story, `2` Twice as fast, `3` Four times); **Machines** (`run`: `off` Still, `on` Running). `explore(c)` drives `tree_species`, `tree_grow`, `tree_seq`, `tree_hi`, `tree_gears`, `tree_flow`, `tree_q`, `tree_seed`, `tree_speed`, `tree_pick`.

Anchors (23): `root`, `below`, `crown`, `level`, `long`, `short`, `pick`, `gear`, `tips`, `q`, `n1`, `sgear`, `tip0`, `tip1`, `tip2`, `tip3`, `tip4`, `tip5`, `tip6`, `tip7`, `s1`, `s2`, `s3`.

Own labels (8): "(computed text)" at `below`; "Descendants · their sequences today" at `tips`; "(computed text)" at `long`; "(computed text)" at `short`; "(computed text)" at `pick`; "One machine per branch" at `gear`; "Coupling gears · one per branch" at `sgear`; "? · their shared ancestor" at `q`.

API (`set.api`): `speeds`, `model`, `tree`, `species`, `highlight`, `branch`, `pick`, `mid`, `tips`.

### `mutation/rule`

The rule of change: four letter balls at the corners of a pyramid joined by rate arrows, the pyramid of mixes and a point gliding along its path, the compiler (a drum with a gear), the machine for one branch (copy the parent's letter, then turn it), its circuit and the turn blocks opening into their simple steps.

- **File:** `tools/mutation/sets/rule.js`; manifest `tools/mutation/sets/rule.md`.
- **Belongs to:** the mutation story.
- **Frame:** Centred on the origin; A at the top, C front left, G back, T front right.
- **Size:** pyramid x +-0.93, y -0.5 to 1.2; machine x -1.15 to 1.05.
- **Data (illustrative):** reads MMATH, MLOOK. Three example substitution models (JC69, K80 and the story's GTR example) computed live; the circuit's angles and simple steps checked by a state-vector run.
- **Cost and notes:** rule_model, rule_start, rule_parent are steps. Exports api (models, mix, longRun, rates, angles, turn, steps, shown). Node cold build 15 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `rule_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `rule_balls` | 0..1 | 1 | yes | the balls grow (0-0.5) and the arrows draw from tail to head (0.2-1) |
| `rule_flow` | 0..1 | 1 | yes | light running along the arrows |
| `rule_pyr` | 0..1 | 1 | yes | the pyramid forms: edges from the corners (0-0.6), faces (0.3-1), corner tiles (0.5-1); the balls shrink into the corners (0.1-0.8), the arrows fade (0-0.5) |
| `rule_path` | 0..1 | 1 | yes | the mix point, its trail and the path ahead, points 1-3, the long-run ring, the threads |
| `rule_time` | 0..3 (swaps per letter) | 1 | yes | the branch length / time (swaps per letter, 0..3): where the point is on the path; in the machine the dial, the gears, the child's arrows and mix, the circuit's angles |
| `rule_model` | 0..2 (even, transitions, uneven) | 2 | **no** | 0 even (JC69), 1 transitions (K80, κ 4), 2 uneven (the story's GTR example) |
| `rule_start` | 0..3 (A C G T) | 0 | **no** | the path's start letter (A C G T). Step param |
| `rule_compile` | 0..1 | 0 | yes | the drum appears (0-0.3); the pyramid shrinks above it (0-0.4) and drops in (0.4-0.8); its gear spins up |
| `rule_machine` | 0..1 | 0 | yes | the machine comes out of the drum part by part (staggered, 0-0.8), the drum shrinks and goes (0.45-0.9) |
| `rule_parent` | 0..3 (A C G T) | 0 | **no** | the parent's letter. Step param (its tile turns over, its arrows flip) |
| `rule_copy` | 0..1 | 1 | yes | the copy: the head moves over the parent (0-0.12), lifts its letter (0.12-0.28), carries it (0.28-0.5), stamps it on the child (0.5-0.66), returns (0.66-0.85); the |
| `rule_circuit` | 0..1 | 0 | yes | the circuit under the machine: wires grow left to right (0-0.6), inputs, copy gates, turn blocks |
| `rule_simple` | 0..1 | 0 | yes | the turn blocks open into their simple steps |
| `rule_run` | 0..1 | 1 | yes | pulses run along the wires (by t) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [-26, 20, 4, 0, 0.3, 0] | the pyramid and its path, from the front left |
| `rates` | [16, 12, 4, 0, 0.32, 0] | the letter balls and rate arrows |
| `pyramid` | [-22, 16, 3.9, 0, 0.3, 0] | the pyramid of mixes forming |
| `path` | [-32, 22, 4.3, 0, 0.28, 0] | the turn has begun, without the circuit |
| `compiler` | [0, 20, 3.9, 0, -0.12, 0] | the drum (the compiler) |
| `machine` | [0, 8, 3.3, -0.1, 0.52, 0] | the whole machine for one branch |
| `copy` | [0, 8, 2.5, -0.6, 0.68, 0] | the copy step: parent and child |
| `turn` | [12, 6, 2.9, 0.05, 0.42, 0] | the turn: gears, dial and small pyramid |
| `circuit` | [0, 6, 4.4, -0.15, 0.12, 0] | the compiler runs, until the machine is half out |
| `steps` | [0, 4, 3.5, -0.05, -0.5, 0] | the simple steps |

Explore controls: **View** (`view`: `rule` Rule, `path` Path, `machine` Machine, `circuit` Circuit, `steps` Simple steps); **Rule** (`model`: `even` All swaps alike, `transitions` A↔G and C↔T faster, `uneven` The story's example); **Start** (`start`: `A` A, `C` C, `G` G, `T` T); **Parent** (`parent`: `A` A, `C` C, `G` G, `T` T); **Branch length** (`time`: `0.15` 0.15, `0.45` 0.45, `1` 1, `1.6` 1.6, `2` 2). `explore(c)` drives `rule_balls`, `rule_flow`, `rule_pyr`, `rule_path`, `rule_time`, `rule_model`, `rule_start`, `rule_parent`, `rule_compile`, `rule_machine`, `rule_copy`, `rule_circuit`, `rule_simple`, `rule_run`.

Anchors (27): `pyramid`, `ballA`, `fast`, `cA`, `cC`, `cG`, `cT`, `mix`, `longrun`, `p1`, `p2`, `p3`, `compiler`, `parent`, `child`, `press`, `gears`, `dial`, `mini`, `machine`, `circuit`, `wireParent`, `wireChild`, `copyGates` and 3 more.

Own labels (24): "Thicker arrow · swaps more readily" at `fast`; "Bigger ball · more common in the long run" at `ballA`; "|00⟩" at `cA`; "|01⟩" at `cC`; "|10⟩" at `cG`; "|11⟩" at `cT`; "1" at `p1`; "2" at `p2`; and 16 more.

API (`set.api`): `models`, `mix`, `longRun`, `rates`, `angles`, `turn`, `steps`, `shown`.

### `mutation/stem`

Letters that work together: an RNA strand folds into a stem of six pairs, one letter changes alone and its rung snaps, a coupling makes the pair change together, the count of combinations (16, 64, about a million) against qubits, then three fields of 2,000 rebuilt ancestors on the species tree.

- **File:** `tools/mutation/sets/stem.js`; manifest `tools/mutation/sets/stem.md`.
- **Belongs to:** the mutation story.
- **Frame:** In the tree set's frame; chapter 6 at the origin with the tree hidden, chapter 7 at the species tree.
- **Size:** stem ~radius 1; fields in front of the root. Shown together with: `mutation/tree` (same frame).
- **Data (mixed):** reads MMATH, MUT_DATA. The poster's Figure 5 stems and shares (10 %, 43 %, 20 %, quarter with all pairs matched) typed in, shown only "in the authors' test"; the live example uses our stand-in coupling (MMATH.Pcoupled), labelled so. Never say the coupled circuit is "better".
- **Cost and notes:** stem_src, stem_w, stem_seed, stem_method are steps. Exports api (methods, names, namesLive, strand, loop, pair, truth, species, count, results, pick). Node cold build 158 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `stem_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `stem_strand` | 0..1 | 1 | yes | the close-up's strand: its 16 tiles pop in left to right with the backbone |
| `stem_fold` | 0..1 | 1 | yes | 0 a straight row, to 0.55 a hairpin folding round its loop, to 1 the twisted stem (pair 5 square to the story's view); rungs from 0.75 |
| `stem_break` | 0..1 | 0 | yes | pair 5's top letter flips C -> A at 0.5 (a flash, framed white), its rung pulls back into two stubs (0.5-0.75), a red cross (0.55-0.85), the stem bulges there; back to |
| `stem_couple` | 0..1 | 0 | yes | the coupling gear over pair 5 (the double band along the rung), winding in |
| `stem_both` | 0..1 | 0 | yes | pair 5 changes both letters at once at 0.5 (C -> T, G -> A, framed white, a flash), the gear turns half round, the rung lights cyan: it holds |
| `stem_count` | 0..3 | 0 | yes | 0..3: to 1 the 4 x 4 square of tile pairs beside the stem (the six matching pairs lit, the rest dim) |
| `stem_qubits` | 0..1 | 0 | yes | a row of 20 qubits under it all (two per letter, each pair holding a letter's mix: MMATH.path at the story's points, MMATH.bloch), appearing left to right |
| `stem_species` | 0..1 | 0 | yes | the three species' stems on the species tree's tips, small, upright, facing the viewer, broken pairs as red crosses; letters that differ from the true ancestor framed |
| `stem_fields` | 0..1 | 0 | yes | three fields of 2,000 tiny stems sprout in front of the root (left to right: letter by letter, exact pair model, coupled circuit), each at its own moment: lit in the |
| `stem_named` | 0..3 | 3 | yes | how many fields' tags show, left to right (0.5: the first tag half in): they come as the narrator names each field |
| `stem_sort` | 0..1 | 0 | yes | the stems whose six pairs all hold walk to the front rows of their field (in their random order): a lit block whose depth is the share |
| `stem_truth` | 0..1 | 0 | yes | the true ancestor's stem, big at the root (in front of the species tree's "?", which the story fades with tree_q), its one broken pair |
| `stem_examples` | 0..1 | 0 | yes | one rebuilt ancestor per method stands before its field (Figure 5's in the story; the most likely one, best, live), letters that differ from the truth framed white; the |
| `stem_src` | 0..1 | 0 | **no** | 0 the authors' test (their shares, Figure 5's examples), 1 this example computed live (MMATH.rebuild with stem_w and stem_seed) |
| `stem_w` | 1..30 | 8 | **no** | the pair favour w, 1 to 30 (live only: the authors' test is w = 8) |
| `stem_seed` | integer >= 1 | 1 | **no** | the rebuild's seed (which 2,000 ancestors; also the crowd's shuffle) |
| `stem_method` | -1..2 | -1 | **no** | a method lit, the other fields dimmed: index into MMATH.METHODS (0 indep, 1 coupled, 2 exact), -1 all |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [16, 6, 3.4, 0, 0, 0] | the folded RNA stem |
| `strand` | [0, 4, 4.4, 0, 0.1, 0] | the straight strand and its fold |
| `fold` | [14, 8, 3.2, 0, 0.02, 0] | the stem a little closer |
| `break` | [24, 6, 2.3, 0.12, 0.12, 0] | close on pair 5: the break, the coupling, both letters changing |
| `count` | [-12, 10, 5.4, 0.85, -0.1, -0.15] | the stem, the 4 x 4 square, the cube and the qubits |
| `cloud` | [-10, 12, 8.4, 1, 0, -1.4] | the cloud of a million combinations against 20 qubits |
| `species` | [18, 16, 3.9, 0, -0.38, 0.1] | the species tree and its stems |
| `fields` | [0, 30, 4.6, 0, -0.95, 1.15] | the three fields of 2,000 rebuilt ancestors, from in front |
| `compare` | [0, 27, 4.7, 0.14, -0.5, 0.9] | the true ancestor and the three examples before their fields (249-264): high enough that the middle example stands below the… |
| `what` | [8, 14, 4.3, 0.16, -0.36, 0] | the species tree, its machines and the stems |

Explore controls: **View** (`view`: `stem` Stem, `count` Count, `rebuild` Rebuild, `compare` Compare); **Numbers** (`src`: `test` The authors' test, `live` This example); **Pair favour** (`w`: `1` 1, `4` 4, `8` 8, `16` 16, `30` 30); **Method** (`method`: `all` All three, `indep` Letter by letter, `exact` Exact, `coupled` Coupling). `explore(c)` drives `stem_strand`, `stem_fold`, `stem_break`, `stem_couple`, `stem_both`, `stem_count`, `stem_qubits`, `stem_species`, `stem_fields`, `stem_named`, `stem_sort`, `stem_truth`, `stem_examples`, `stem_src`, `stem_w`, `stem_seed`, `stem_method`.

Anchors (20): `stem`, `loop`, `top`, `brk`, `gear`, `square`, `cube`, `cloud`, `qubits`, `truth`, `root`, `sp1`, `sp2`, `sp3`, `field_indep`, `ex_indep`, `field_exact`, `ex_exact`, `field_coupled`, `ex_coupled`.

Own labels (18): "A stem · six pairs and a loop" at `top`; "Pair broken · C became A alone" at `brk`; "Coupled · both letters change together" at `gear`; "C–G became T–A · the pair holds" at `gear`; "16 combinations · a pair of letters" at `square`; "64 combinations · three letters" at `cube`; "About a million · ten letters: 1,048,576" at `cloud`; "20 qubits · two per letter, for all ten" at `qubits`; and 10 more.

API (`set.api`): `methods`, `names`, `namesLive`, `strand`, `loop`, `pair`, `truth`, `species`, `count`, `results`, `pick`.

### `topo/slide`

Real tissue on its glass slide drawn in H&E from cells alone: the healthy tile of 640 um round the poster's patch (945 cells) and the new slide's window of 1.5 mm (6,716 cells), plus sketches of other modalities (spots, multiplex), the fixed scales other tools read and an overview of the whole section.

- **File:** `tools/topo/sets/slide.js`; manifest `tools/topo/sets/slide.md`.
- **Belongs to:** the topo story.
- **Frame:** Lies flat (x-z, y up), centred on the origin on a glass slide whose +x end shows past it.
- **Size:** 1.6 across. Shown together with: `topo/map` (same frame).
- **Data (real):** reads TOPO_DATA, TDATA, TLOOK. Cell positions and types from the authors' GTEx liver cohort run by topocyte (HistoPLUS cell classes); drawn in H&E, never an image; slide ids never shown.
- **Cost and notes:** slide_mode and slide_points are plain params; slide_scale and slide_over are story-only. British spelling. Exports api (TW, layout, tile, win, overview, pos, hub, six, circle), textures, dispose. Node cold build 302 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `slide_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `slide_show` | 0..1 | 0 | yes | what lies on the glass: 0 the healthy tile, 1 the new slide's window, 2 both side by side at one scale |
| `slide_mode` | 0..2 (H&E, spots, multiplex) | 0 | yes | the modality: 0 H&E, 1 spatial transcriptomics (sketch: the spots), 2 spatial proteomics (sketch: cells glowing by type on black); in between, the sweep's front running |
| `slide_points` | 0..1 | 0 | yes | every cell becomes a glowing white-gold bead (TLOOK cells' bead morph), the ground dark glass with the tissue's ghost, the spots gone |
| `slide_scale` | 0..3 | 0 | yes | chapter 2's fixed scales on the tile: 1 the grid of 100 µm squares with one lit ("one patch size"), 2 a cell and its six nearest joined ("a neighbour count"), 3 a 30 µm |
| `slide_patch` | 0..1 | 0 | yes | the poster's patch marked on the tile: its square in amber with glowing corners |
| `slide_over` | 0..1 | 0 | yes | the new slide's overview: 1 the whole section on its glass slide, the window marked (a cyan square); towards 0 it zooms into the window |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, 56, 3.4, 0, 0, 0.06] | the whole tile or window from above and in front |
| `tile` | [8, 58, 3.3, 0, 0, 0.06] | the tile's far left corner, for its tag |
| `low` | [14, 26, 3, 0, 0, 0.12] | low across the tissue to show its relief |
| `close` | [16, 50, 1.1, 0.05, 0, 0.1] | the cells close up |
| `cells` | [22, 46, 0.45, 0.12, 0, 0.18] | very close on the tile's cells |
| `square` | [10, 56, 1.4, -0.375, 0, 0.395] | chapter 2's three scales: the 100 µm square (computed from the cells chosen at build) |
| `hub` | [14, 50, 0.9, 0.499, 0, -0.381] | the cell with its six neighbours (the hub scale) |
| `circle` | [-10, 52, 0.9, -0.472, 0, 0.478] | the circle's rim |
| `patch` | [0, 62, 2.1, 0, 0, 0.02] | the poster's patch from above |
| `over` | [0, 58, 3.4, 0, 0, 0.05] | the overview on its glass |
| `window` | [0, 56, 3.4, 0, 0, 0.06] | the new slide's window alone |
| `both` | [0, 54, 4, -0.13, 0, 0.08] | the two side by side |

Explore controls: **Tissue** (`piece`: `tile` Healthy tile, `window` New slide, `both` Both, `whole` Whole slide); **Look** (`look`: `he` H&E, `spots` Spots (sketch), `fluo` Proteins (sketch), `points` Points); **One scale** (`scale`: `none` None, `patch` Patch, `six` Neighbours, `radius` Radius). `explore(c)` drives `slide_show`, `slide_over`, `slide_mode`, `slide_points`, `slide_scale`, `slide_patch`.

Anchors (13): `tile`, `window`, `centre`, `patch`, `square`, `hub`, `circle`, `spots`, `fluo`, `points`, `section`, `mark`, `label`.

Own labels (11): "Healthy liver · 640 µm across, 945 cells" at `tile`; "Spatial transcriptomics · sketch: spots read the genes" at `spots`; "Spatial proteomics · sketch: proteins in colour" at `fluo`; "Only positions · every cell a point" at `points`; "One patch size" at `square`; "A neighbour count" at `hub`; "One radius" at `circle`; "The patch · 110 cells" at `patch`; and 3 more.

API (`set.api`): `TW`, `layout`, `tile`, `win`, `overview`, `pos`, `hub`, `six`, `circle`.

### `topo/map`

The signal back on the tissue: one cell's 50 um neighbourhood and its own network, bars and score; every cell scored as a relief; the two groups (healthy-like, cirrhosis-like) as piles with shares; and sketches of the next steps (genes, proteins).

- **File:** `tools/topo/sets/map.js`; manifest `tools/topo/sets/map.md`.
- **Belongs to:** the topo story.
- **Frame:** In the slide set's frame over the window (centred on the origin; side by side with slide_show 2 it moves to x 0.42).
- **Size:** 1.6 across. Shown together with: `topo/slide` (same frame).
- **Data (real):** reads TOPO_DATA, TDATA, TLOOK. Every cell's stored score at 50 and 100 um, the window's stored complex and bars, the groups from the scores' signs; relief heights are smoothed for drawing only. Cell v's score 6.97 is the data's (the poster prints 26.57: open question T5).
- **Cost and notes:** map_pick, map_delta are steps; map_omics may be stepped. Nothing scientific is computed here. Exports api (n, e, drawR, eLogOdds, limit50, limit100, delta, comp50, comp100, types, cell, counts, pos, pick). Node cold build 275 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `map_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `map_cell` | 0..1 | 1 | yes | the dome on the cell, its cells lit, its complex, its bars and score (all of them fade with it, and with the split and the sketches) |
| `map_r` | um (default 50) | 50 | yes | the radius (µm) of its part of the complex: stored edges and triangles whose radius is at most it; also the balls' radius and the level on its tower |
| `map_balls` | 0..1 | 0 | yes | the growing balls round its cells (glass discs, the union look of the tower's balls) |
| `map_bars` | 0..1 | 1 | yes | the picked cell's own persistence bars rise behind it |
| `map_score` | 0..1 | 1 | yes | its score's needle and tag |
| `map_all` | 0..1 | 0 | yes | the sweeping dome and the relief behind it (0 none, 1 every cell risen; the dome goes from 0.92 on) |
| `map_split` | 0..1 | 0 | yes | the cells fly to their piles (from the bottom up, a layer at a time; the relief folds away by 0.35) |
| `map_omics` | 0..2 | 0 | yes | the sketches: 1 spots and the volcano, 2 the multiplex slide and protein columns; in between a crossfade (the cells settle back on the slide on the way to 1) |
| `map_pick` | -1.. (cell index) | -1 | **no** | the cell with the dome (an index into the window's cells; -1 the poster's cell v) |
| `map_delta` | 0..1 (50 or 100 um) | 0 | **no** | the map at 50 µm (0) or 100 µm as in the poster's figure (1): the relief's and beads' colours (lo100, its own limit 13.51), the groups and piles |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [22, 34, 3.6, 0, 0.02, 0.06] | the window and whatever stands on it |
| `cell` | [18, 40, 0.62, -0.002, 0.03, 0.332] | close on the picked cell and its 50 µm dome |
| `net` | [10, 58, 0.36, -0.002, 0.005, 0.342] | close from above: its complex growing |
| `bars` | [12, 16, 0.95, -0.002, 0.13, 0.292] | amber, at bars; the counts of its stored bars alive at map_r: pieces are |
| `score` | [24, 22, 0.75, 0.028, 0.06, 0.312] | close on a cell with its score tag |
| `sweep` | [6, 44, 3.4, 0, 0, 0.08] | the dome sweeping the window |
| `relief` | [24, 30, 3.5, 0, 0.02, 0.06] | the relief of scored cells |
| `low` | [32, 12, 3.1, 0, 0.04, 0.12] | the relief from low, the sunk blue under the glass |
| `split` | [0, 14, 3.9, 0, 0.32, 0.05] | the two groups' piles |
| `omics` | [0, 20, 3.8, 0, 0.3, 0.02] | the sketches of genes and proteins (illustrative) |

Explore controls: **Show** (`show`: `cell` One cell, `map` Every cell, `split` Two groups, `genes` Genes (sketch), `proteins` Proteins (sketch)); **Radius** (`r`: `2` 2 µm, `5` 5 µm, `10` 10 µm, `20` 20 µm, `50` 50 µm); **Map at** (`delta`: `50` 50 µm, `100` 100 µm). `explore(c)` drives `map_cell`, `map_r`, `map_balls`, `map_bars`, `map_score`, `map_all`, `map_split`, `map_omics`, `map_delta`.

Anchors (25): `cell`, `dome`, `net`, `bars`, `score`, `sweep`, `red`, `blue`, `healthy`, `cirrhosis`, `genes`, `proteins`, `window`, `h_0`, `c_0`, `h_1`, `c_1`, `h_2`, `c_2`, `h_3`, `c_3`, `h_4`, `c_4`, `h_5` and 1 more.

Own labels (15): "(computed text)" at `dome`; "(computed text)" at `net`; "(computed text)" at `bars`; "(computed text)" at `score`; "Every cell a centre" at `sweep`; "Red, raised · cirrhosis-like" at `red`; "Blue, sunk · healthy-like" at `blue`; "(computed text)" at `healthy`; and 7 more.

API (`set.api`): `n`, `e`, `drawR`, `eLogOdds`, `limit50`, `limit100`, `delta`, `comp50`, `comp100`, `types`, `cell`, `counts`, `pos`, `pick`.

### `topo/tower`

The poster's patch of 110 real cells with glass balls growing round them, edges and triangles appearing, pieces joining and loops opening and closing, then the tower of scales and its barcode.

- **File:** `tools/topo/sets/tower.js`; manifest `tools/topo/sets/tower.md`.
- **Belongs to:** the topo story.
- **Frame:** The patch lies on a glass plate with its frosted label towards you, the poster's y running away (-z); the tower rises from it.
- **Size:** plate 1.5 wide; tower 1.68 units with the trunk.
- **Data (real):** reads TOPO_DATA, TDATA, TLOOK. The poster's patch: 110 cells in a 214 um window, 313 edges, 204 triangles, 109 joinings, 85 loops, all topocyte's and gudhi's.
- **Cost and notes:** The radius eases on the poster's log ruler (tower.log, topo's LOG set). In a headset it stands about 1.55 m tall (stand view; the up view is screens only). tower_lit is a step. Exports api (range, ticks, snaps, counts, lanes, cells, loops, main, piece, loop, bar, pick), log. Node cold build 38 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `tower_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `tower_r` | um, 1.5..60 (drawn to 120) | 1.5 | yes | the radius in µm (1.5 to 60; up to 120 is drawn) |
| `tower_rise` | 0..1 | 0 | yes | 0 everything on the plate; 1 the tower of scales (heights times this) |
| `tower_bars` | 0..1 | 0 | yes | the rods fly out to the board (0.04 to 0.58), the glass board (0.3 to 0.6), the two curves drawing upwards (0.5 to 1) |
| `tower_he` | 0..1 | 0 | yes | 1: the 110 cells in H&E by their types (looked up in the healthy tile by position), on a pale eosin stain; to 0 they shrink into beads |
| `tower_lit` | 0..2 (both, pieces, loops) | 0 | **no** | 0 both, 1 pieces lit (loops dimmed), 2 loops lit (pieces dimmed) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [18, 20, 4.9, 0, 0.78, 0] | the tower whole, the plate at its foot, from a little above |
| `plate` | [8, 52, 3.4, 0, 0, 0.05] | close on the plate while the balls grow |
| `snap` | [0, 64, 3, 0, 0, 0.02] | straight down, as the poster's snapshots |
| `tower` | [26, 17, 5, 0, 0.85, 0] | the tower rising |
| `up` | [205, -58, 2.6, 0.05, 0.95, 0] | from under the glass plate up through the threads (screens only) |
| `bars` | [6, 16, 6, 1, 0.82, -0.15] | the tower and the board of rods and curves |
| `stand` | [16, 0, 1.17, 0, 1.06, 0] | the headset view: xrPlace scales it to 0.94 m a unit, so the tower (1.68 units with the trunk's top) stands about 1.55 m tall,… |

Explore controls: **View** (`view`: `balls` Balls, `tower` Tower, `bars` Barcode); **Radius** (`r`: `4.081` 4.08 µm, `13.49` 13.5 µm, `24.592` 24.6 µm, `48.864` 48.9 µm, `60` 60 µm); **Lit** (`lit`: `both` Both, `pieces` Pieces, `loops` Loops). `explore(c)` drives `tower_he`, `tower_rise`, `tower_bars`, `tower_r`, `tower_lit`.

Anchors (17): `plate`, `label`, `top`, `tag`, `cell`, `hole`, `plane`, `trunk`, `chimney`, `bars`, `bars1`, `board`, `tick0`, `tick1`, `tick2`, `tick3`, `tick4`.

Own labels (15): "82 pieces · no loops yet" at `tag`; "3 pieces · 7 loops: the big one just born" at `tag`; "One piece · 2 loops: the big one still open" at `tag`; "One piece · no loops: the big one has filled" at `tag`; "(computed text)" at `hole`; "(computed text)" at `plane`; "2 µm" at `tick0`; "5 µm" at `tick1`; and 7 more.

API (`set.api`): `range`, `ticks`, `snaps`, `counts`, `most`, `lanes`, `cells`, `loops`, `main`, `piece`, `loop`, `bar`, `pick`.

Other exports: `log`.

### `topo/cohort`

The 123 slides as a rack of glass slides with their curves (66 healthy, 57 cirrhotic), the classes' means, the main shapes, the cube of scores, the classifier's wall with its held-out stacks, and the weight for every radius on a column of radii with windows and a gap.

- **File:** `tools/topo/sets/cohort.js`; manifest `tools/topo/sets/cohort.md`.
- **Belongs to:** the topo story.
- **Frame:** Rack of slides in two rows stepping up towards the back; weights column at x 2.05; cube of scores 1.6 across.
- **Size:** rack plus a weights column out to x ~2.05; cube of scores 1.6 across.
- **Data (real):** reads TOPO_DATA, TDATA, TLOOK. Everything is topocyte's, from TOPO_DATA.h1 (loops) or h0 (pieces): curves, scores, coefficients, held-out predictions; the set only places stored numbers and sums stored shares.
- **Cost and notes:** cohort_dim and cohort_pick are steps; cohort_from and cohort_to are plain numbers on the 0.5 um grid. Cheap (8 ms). Exports api (n, healthy, cirrhosis, slide, fve, accuracy, confusion, window, windows, gap, grid, pick, mid). Node cold build 9 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `cohort_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `cohort_dim` | 0..1 (pieces, loops) | 1 | **no** | 1 loops (h1, the poster's), 0 pieces (h0): curves, means, shapes, scores, wall, log-odds, stacks, γ, windows and gap all switch |
| `cohort_rack` | 0..1 | 1 | yes | the slides drop into their slots (0 to 0.14, front to back), then their curves light one after another by slide number (0.14 to 0.94, each with a flash) |
| `cohort_means` | 0..1 | 0 | yes | the classes' mean curves in front of their rows; the slides' curves dim a little |
| `cohort_shapes` | 0..1 | 0 | yes | the two main shapes hovering over the rack, their shares as tags |
| `cohort_space` | 0..1 | 0 | yes | the slides fly into the cube of their scores (staggered over 0.03 to 0.98 by slide number); the shapes move onto its edges, the rack fades |
| `cohort_wall` | 0..1 | 0 | yes | the classifier's wall sweeps in to its place (in by 0.8) |
| `cohort_odds` | 0..1 | 0 | yes | the slides glide to their log-odds along the axis through the wall |
| `cohort_stacks` | 0..1 | 0 | yes | the slides drop into the four stacks (from wherever they are; the tallest stack's last slide lands at 0.94) |
| `cohort_gamma` | 0..1 | 0 | yes | the column rises (0 to 0.3), γ draws upwards (0.2 to 0.55), the means (0.4 to 0.7), the windows' bands (0.65 to 0.95) |
| `cohort_gap` | 0..1 | 0 | yes | the bands drop into the gap's stack (0 to 0.74, one after another), its ring and tag (0.6 to 0.9) |
| `cohort_win` | 0..1 | 0 | yes | a window of radii chosen in explore: a cyan band round the column from cohort_from to cohort_to, with its share and odds factor as a tag; the poster's bands dim |
| `cohort_from` | um, 0..100 (0.5 grid) | 5 | yes | the window in µm, rounded to the 0.5 µm grid of the stored shares (0 to 100; cohort_to 100.5 or more means "and above") |
| `cohort_to` | um, 0..100.5 (100.5 = and above) | 15 | yes | the window in µm, rounded to the 0.5 µm grid of the stored shares (0 to 100; cohort_to 100.5 or more means "and above") |
| `cohort_pick` | -1..122 (slide) | -1 | **no** | a picked slide (0..122, -1 none): its curve lit cyan in the rack, a glow in the cloud, pulled out of its stack towards you; the others dim and the set's other tags hide |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [18, 26, 4, 0, 0.4, 0.05] | the rack whole, from the front and above |
| `rack` | [10, 16, 2.9, 0, 0.42, 0.55] | close on the rack's front: the curves standing on their slides |
| `means` | [0, 10, 2.3, 0, 0.42, 0.85] | the classes' mean curves |
| `shapes` | [14, 18, 4.4, 0, 0.82, 0.05] | the shapes hovering over the rack |
| `space` | [28, 16, 4.7, 0, 0.95, 0] | the cube of the scores |
| `wall` | [80, 8, 4.6, -0.03, 0.71, 0.15] | the classifier's wall nearly edge-on between the two clouds (computed) |
| `odds` | [55, 10, 4.6, 0, 0.95, 0] | the log-odds scale from healthy to cirrhosis |
| `stacks` | [22, 26, 3.7, 0, 0.36, 0.1] | the four stacks |
| `gamma` | [10, 8, 4.3, 2.4, 0.8, 0] | the column, γ and the means |
| `gap` | [-14, 10, 4.2, 1.85, 0.7, 0.1] | the gap's stack of radius bands, right of everything |
| `all` | [16, 18, 6.6, 0.75, 0.75, 0] | everything at once |

Explore controls: **View** (`view`: `rack` Rack, `space` Scores, `held` Held out, `scales` Scales); **Curves of** (`dim`: `1` Loops, `0` Pieces). `explore(c)` drives `cohort_dim`, `cohort_rack`, `cohort_means`, `cohort_shapes`, `cohort_space`, `cohort_wall`, `cohort_odds`, `cohort_stacks`, `cohort_gamma`, `cohort_gap`, `cohort_win`, `cohort_pick`.

Anchors (32): `rack`, `rowH`, `rowC`, `ruler`, `meanH`, `meanC`, `phi1`, `phi2`, `axis3`, `cube`, `healthy`, `cirrhosis`, `wall`, `zero`, `oddsHi`, `oddsLo`, `stack0`, `stack1`, `stack2`, `stack3`, `stacks`, `column`, `colTop`, `gPeak` and 8 more.

Own labels (29): "(computed text)" at `rowH`; "(computed text)" at `rowC`; "(computed text)" at `ruler`; "Healthy · their mean curve" at `meanH`; "Cirrhosis · their mean curve" at `meanC`; "(computed text)" at `phi1`; "(computed text)" at `phi2`; "(computed text)" at `axis3`; and 21 more.

API (`set.api`): `n`, `healthy`, `cirrhosis`, `slide`, `fve`, `accuracy`, `confusion`, `window`, `windows`, `gap`, `grid`, `pick`, `mid`.

### `pass/fish`

A school of 300 fish (30 to 600, a live simulation) all around you, each watching its seven nearest neighbours; water, seabed with caustics, rocks, seagrass, light shafts; a shark you steer or that comes now and then; the school can be pulled apart by watching fewer neighbours.

- **File:** `tools/pass/sets/fish.js`; manifest `tools/pass/sets/fish.md`.
- **Belongs to:** the pass story; reuses flock/flock (simulation adapted, not reused).
- **Frame:** Life size: 1 unit = 1 m, eyes at the origin (1.6 m), seabed 6.5 m below, surface 15 m above.
- **Size:** life size; fish 0.27 m long.
- **Data (none):** A live simulation adapted from the flock's; nothing is data.
- **Cost and notes:** update depends on what came before, so seeking changes only the params. Step params fish_n, fish_k, fish_hunt. In passthrough the school shrinks to a third of life size. Exports see, steer, hold, scatter, shark, falcon, kept, setLang, state, watch ... Node cold build 469 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `fish_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `fish_n` | 30..600 | 300 | **no** | how many fish (30-600; new ones join beside a fish already swimming) |
| `fish_k` | 1..12 | 7 | **no** | neighbours each fish watches (rounded, 1-12) |
| `fish_links` | 0..1 | 0 | yes | the network: 0 hidden, 1 shown (fades) |
| `fish_water` | 0..1 | 1 | yes | the water and everything in it; below 0.5 (passthrough AR) hidden, the school at a third of life size |
| `fish_shark` | 0..1 | 0 | yes | above 0.5 a shark comes now and then (explore) |
| `fish_hunt` | counter (shark at each whole number) | 0 | **no** | a shark each time this passes a whole number (for the story) |
| `fish_scale` | 0..1 | 1 | yes | the whole set's size on top of life size (for the rise to the globe: towards 0 the sea, dome and all, shrinks to a dot at the origin) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, -6, 0.25, 0, 1.6, 0] | among the fish, life size, looking up a little (eyes at 1.6 m) |
| `up` | [20, -55, 0.25, 0, 1.6, 0] | looking up to the light |
| `near` | [25, 10, 8, 0, 1.6, -4] | from just outside the school: each fish and its links apart |
| `afar` | [25, 10, 13, 0, 1.6, -4] | the whole school from outside |
| `above` | [0, 80, 40, 0, 1.6, -4] | high above, looking down on the school |

Explore controls: **View** (`view`: `default` Follow the school, `free` Look around, `afar` From afar); **Neighbours watched** (`k`: `7` 7, `1` 1, `3` 3, `12` 12); **Network** (`links`: `off` Off, `on` Who watches whom); **Shark** (`shark`: `off` Off, `some` Now and then). `explore(c)` drives `fish_k`, `fish_links`, `fish_shark`.

Anchors (2): `school`, `shark`.

Own labels (1): "(computed text)" at `shark`.

Other exports: `see`, `steer`, `hold`, `scatter`, `shark`, `flight`, `follow`, `hush`, `hunted`, `sharkOn`, `following`, `fish`, `neighbours`, `falcon`, `falconOn`, `kept`, `setLang`, `state`, `watch`.

### `pass/globe`

The airports story's globe exactly as it is (3,214 airports, 18,858 routes), driven from params, with a seeded S/E/I/R outbreak on its real routes: pick a start airport, set incubation, infectious days, spread and flights cut, and play the days.

- **File:** `tools/pass/sets/globe.js`; manifest `tools/pass/sets/globe.md`.
- **Belongs to:** the pass story; reuses stories/airports.js (globe cut out unchanged).
- **Frame:** Radius 1, centred on the origin, y up, longitude 0 towards +x, 90 E towards -z.
- **Size:** radius 1.
- **Data (real):** reads PASS_AIRPORTS (cut out of stories/airports.js at build). OpenFlights airports and routes; the outbreak is a simple model, not a forecast.
- **Cost and notes:** Cut unchanged out of stories/airports.js by tools/pass/build.mjs: rebuild the pass story after changing it. Same start and settings give the same outbreak on every device. globe_day is a step (continuous). English and German via setLang. Exports api (setup, start, settings, end, series, count, summary, arrivalDay, chain, select, pick, find, info, search ...). Node cold build 315 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `globe_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `globe_reveal` | 0..1 | 1 | yes | the airports and routes appear (the original's node_reveal and route_reveal) |
| `globe_routes` | 0..1 | 1 | yes | brightness of the routes (the original's route_alpha) |
| `globe_hubs` | 0..1 | 0 | yes | airports coloured by their number of routes (the original's w_deg) |
| `globe_pillars` | 0..1 | 0 | yes | pillars by number of routes (the original's deg_h) |
| `globe_dim` | 0..1 | 0 | yes | dims the plain airports and routes, so the outbreak's colours stand out |
| `globe_out` | 0..1 | 0 | yes | the outbreak shown (its cities, arcs, chain and labels) |
| `globe_day` | days, 0..end of outbreak | 0 | **no** | the outbreak's day (continuous; ease it) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [102, 28, 3.6, 0, 0, 0] | Europe, Africa and Asia |
| `europe` | [104, 46, 2.3, 0, 0, 0] | close over Europe |
| `world` | [60, 18, 4.2, 0, 0, 0] | the whole globe from afar |
| `atlantic` | [55, 32, 3.4, 0, 0, 0] | the Atlantic with Europe and the Americas |
| `asia` | [190, 28, 3.4, 0, 0, 0] | Asia |
| `start` | [106.57, 40.894, 2.6, 0, 0, 0] | turned to the start city by setup |

Explore controls: **View** (`view`: `default` Europe and Asia, `atlantic` The Atlantic, `asia` Asia, `world` From afar); **Colour** (`color`: `plain` Plain, `hubs` Hubs); **Pillars** (`pillars`: `off` Off, `on` Routes per airport); **Outbreak** (`out`: `off` Off, `on` Play). `explore(c)` drives `globe_hubs`, `globe_pillars`, `globe_out`, `globe_dim`, `globe_day`.

Anchors (16): `top`, `start`, `sel`, `VIE`, `LHR`, `FRA`, `CDG`, `IST`, `DXB`, `JFK`, `ATL`, `PEK`, `SIN`, `JNB`, `GRU`, `SYD`.

Own labels (3): "(computed text)" at `top`; "(computed text)" at `start`; "(computed text)" at `sel`.

API (`set.api`): `setup`, `start`, `settings`, `end`, `series`, `count`, `summary`, `arrivalDay`, `chain`, `select`, `selected`, `pick`, `find`, `info`, `pos`, `viewOf`, `search`, `deg`, `n`, `routes`, `original`.

Other exports: `setLang`.

### `pass/cell`

The cell map story's cell exactly as it is (249 proteins in 13 places, 252 links, 10 organelles, 7 moves): organelles appear one by one, proteins and links by place or colour, the growth signal from EGF to SRF, the TNF to NF-kB relay, and the moves that go wrong (CFTR in the ER, TDP-43 leaving the nucleus).

- **File:** `tools/pass/sets/cell.js`; manifest `tools/pass/sets/cell.md`.
- **Belongs to:** the pass story; reuses stories/spatial.js (cell cut out unchanged).
- **Frame:** Radius 1, centred on the origin; a cell about 20 micrometres across, the membrane a slightly flattened ellipsoid.
- **Size:** radius 1.
- **Data (illustrative):** reads PASS_SPATIAL (cut out of stories/spatial.js at build). Curated protein locations and links (complexes, textbook pathways, Human Protein Atlas / UniProt); the layout is illustrative.
- **Cost and notes:** Cut unchanged out of stories/spatial.js by tools/pass/build.mjs. 541 anchors (one per protein copy and organelle). cell_cue and the moves ease at a limited rate (MOVE_P). English and German (roles in ROLE_DE). Exports api (pick, info, select, moveDelta, protein, copyOf, pos, search, moves, move, path, highlight, setFocus, isolate, places, growthPath, relay, counts). Node cold build 306 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `cell_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `cell_org` | 0..10 | 10 | yes | organelles shown: they appear one by one (membrane, nucleus, nucleolus, ER, Golgi, mitochondria, lysosomes, vesicles, peroxisomes, cytoskeleton) |
| `cell_shell` | 0..1 | 1 | yes | the organelles' skins (1 on, 0.35 faint, 0 off) |
| `cell_reveal` | 0..1 | 1 | yes | proteins and links appear |
| `cell_links` | 0..1 | 1 | yes | brightness of the links |
| `cell_ids` | 0..1 | 1 | yes | the dotted links between the copies of one protein |
| `cell_multi` | 0..1 | 0 | yes | colour by number of places instead of by place |
| `cell_focus` | 0..1 | 0 | yes | the rest dims, the growth signal's proteins glow as the signal reaches them |
| `cell_ex` | 0..1 | 0 | yes | two proteins meet: EGF, its receptor and GRB2 (0-1) |
| `cell_cue` | 0..1 | 0 | yes | the relay from TNF to NF-kB's brake (0-1) and its alpha |
| `cell_cue_a` | 0..1 | 1 | yes | the relay from TNF to NF-kB's brake (0-1) and its alpha |
| `cell_path` | 0..10 (hops) | 0 | yes | the growth signal, in hops (0-10), and its alpha |
| `cell_path_a` | 0..1 | 1 | yes | the growth signal, in hops (0-10), and its alpha |
| `cell_names` | 0..1 | 0 | yes | the organelles' names as labels (each as it appears) |
| `cell_nfkb` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |
| `cell_apop` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |
| `cell_tfeb` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |
| `cell_glut4` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |
| `cell_nrf2` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |
| `cell_als` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |
| `cell_cf` | 0..1 | 0 | yes | how far each of the cell map's moves has gone (0-1; its s0 ... s6) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [108, 18, 3.9, 0, 0, 0] | the whole cell |
| `nucleus` | [70, 20, 1.9, -0.12, 0, -0.05] | close on the nucleus |
| `signal` | [-95.956, 16.699, 2.7, -0.01, 0.114, -0.632] | the growth signal from EGF outside to SRF in the nucleus |
| `nfkb` | [50.717, 16.699, 2.6, -0.289, -0.22, 0.579] | the NF-kB relay |
| `cf` | [-169.42, 16.699, 2.2, -0.197, 0.388, -0.425] | CFTR caught in the wrong place |
| `als` | [82.381, 16.699, 2, 0.011, -0.029, 0.231] | TDP-43 leaving the nucleus |

Explore controls: **View** (`view`: `default` Whole cell, `nucleus` Nucleus, `signal` From the surface); **Organelles** (`shell`: `on` On, `faint` Faint, `off` Off); **Colour** (`color`: `place` By place, `multi` Number of places); **Move** (`move`: `none` None, `nfkb` Inflammation, `cf` Cystic fibrosis, `als` ALS). `explore(c)` drives `cell_shell`, `cell_multi`, `cell_cue`.

Anchors (541): `org_pm`, `org_nuc`, `org_nucl`, `org_er`, `org_golgi`, `org_mito`, `org_lyso`, `org_endo`, `org_perox`, `org_cytosk`, `EGF@ext`, `EGF`, `TNF@ext`, `TNF`, `INS@ext`, `INS`, `TF@ext`, `TF`, `TF@endo`, `APOB@ext`, `APOB`, `PCSK9@ext`, `PCSK9`, `PCSK9@endo` and 517 more.

Own labels (23): "(computed text)" at `org_pm`; "(computed text)" at `org_nuc`; "(computed text)" at `org_nucl`; "(computed text)" at `org_er`; "(computed text)" at `org_golgi`; "(computed text)" at `org_mito`; "(computed text)" at `org_lyso`; "(computed text)" at `org_endo`; and 15 more.

API (`set.api`): `pick`, `info`, `select`, `selected`, `moveDelta`, `protein`, `copyOf`, `proteinOf`, `pos`, `search`, `moves`, `move`, `path`, `highlight`, `setFocus`, `isolate`, `placeName`, `placeShort`, `orgName`, `places`, `growthPath`, `relay`, `counts`, `original`.

Other exports: `setLang`.

### `flock/flock`

Starlings at dusk all around you: 200 birds (50 to 400, a live simulation), each following its seven nearest neighbours, keeping its distance and fleeing a falcon with alarm passing between neighbours; sky, a lake, trees and reeds; the flock swoops round you every 88 s.

- **File:** `tools/flock/sets/flock.js`; manifest `tools/flock/sets/flock.md`.
- **Belongs to:** the flock story.
- **Frame:** Life size: 1 unit = 1 m, the viewer at the origin, ground y = 0, the sun sets towards -z.
- **Size:** life size; sky to the horizon, 2,600 reeds within 32 m.
- **Data (none):** A live simulation; nothing is data.
- **Cost and notes:** update depends on history, so seeking changes only the params. In a shared room the flock belongs to the station. In passthrough the sky and land are hidden and the flock flies in your room at a third of life size. Step params flock_birds, flock_hunt. Exports see(head, hands, spot), scatter(dir), falcon, follow, hush, state. Node cold build 286 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `flock_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `flock_birds` | 50..400 | 200 | **no** | how many birds (50-400; new ones join beside a bird already flying) |
| `flock_links` | 0..1 | 0 | yes | the network: 0 hidden, 1 shown |
| `flock_sky` | 0..1 | 1 | yes | the sky, land and reeds; below 0.5 (passthrough AR) hidden, the flock at a third of life size in your room |
| `flock_falcon` | 0..1 | 1 | yes | above 0.5 a falcon comes now and then |
| `flock_hunt` | counter (falcon at each whole number) | 0 | **no** | a falcon each time this passes a whole number (for the story) |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [0, -26, 0.25, 0, 1.6, 0] | standing in the field, looking up at the sky |
| `up` | [30, -48, 0.25, 0, 1.6, 0] | looking steeply up |
| `afar` | [20, 6, 17, 0, 9, -4] | the engine aims it at the flock |

Explore controls: **View** (`view`: `default` Follow the flock, `free` Look around, `afar` From afar); **Birds** (`birds`: `200` 200, `100` 100, `400` 400); **Network** (`links`: `off` Off, `on` Who follows whom); **Falcon** (`falcon`: `some` Now and then, `off` Off). `explore(c)` drives `flock_birds`, `flock_links`, `flock_falcon`.

Anchors (2): `flock`, `falcon`.

Own labels (1): "Falcon" at `falcon`.

Other exports: `see`, `scatter`, `falcon`, `flight`, `follow`, `hush`, `birds`, `falconOn`, `following`, `state`.

### `robots/robots`

A gang of 6 to 24 robot vacuums (a live simulation) in a living room: dock, bump and turn, follow you, conga line or keep away; each robot follows rules about who it follows, which is the network. On a screen the model living room; in a headset your own room from detected planes and meshes.

- **File:** `tools/robots/sets/robots.js`; manifest `tools/robots/sets/robots.md`.
- **Belongs to:** the robots story.
- **Frame:** Life size: 1 unit = 1 m, floor at y = 0 in the set's own frame; the room description {kind, floor, walls, blocks} is set with setRoom().
- **Size:** life size; robot radius 0.17 m.
- **Data (none):** A live simulation; nothing is data.
- **Cost and notes:** update(S, t, dt) advances in steps of at most 1/60 s. Step params robots_rule, robots_n, robots_walk, robots_dust, robots_crumbs. Needs the engine's xrRoom for a real room (planes, meshes). In passthrough nothing opaque is drawn. Exports setRoom, modelRoom, room, player, walkTo, crumbs, floorPoint, see, avatar, shift, coverage, robots, bumps, state. Node cold build 91 ms.

| param | range | default | eased | what it does |
| --- | --- | --- | --- | --- |
| `robots_a` | 0..1 | 1 | yes | the set's fade, 0 hidden to 1 shown (applied by the engine through setAlpha; a set never applies it itself) |
| `robots_rule` | 0..4 | 1 | **no** | 0 dock, 1 bounce, 2 follow, 3 chain, 4 flee |
| `robots_n` | 1..24 | 6 | **no** | how many robots, 1 to 24 |
| `robots_trails` | 0..1 | 0 | yes | the cleaned area's cyan tint |
| `robots_links` | 0..1 | 0 | yes | who follows whom |
| `robots_scan` | 0..1 | 1 | yes | the room-finding sweep (1: done, gone) |
| `robots_room` | 0..1 | 1 | yes | 1 draw the room; 0 passthrough overlays only |
| `robots_walk` | 0..1 | 0 | **no** | when 1 the avatar strolls (a step; the target is set with walkTo) |
| `robots_dust` | counter | 0 | **no** | counter: dusty again at each whole number |
| `robots_crumbs` | counter | 0 | **no** | counter: a pile at each whole number |

| view | [az, el, dist, tx, ty, tz] | frames |
| --- | --- | --- |
| `default` | [35, 52, 7.8, 0, 0.1, 0.15] | the whole room from above and to one side |
| `low` | [25, 6, 1.7, 0, 0.1, 0] | low, near the floor |
| `eyes` | [0, -18, 0.3, 0, 1.6, 0] | a stand-in at head height; the engine uses the player's own head |

Explore controls: **View** (`view`: `default` Above, `low` Low down, `eyes` Your eyes); **Rule** (`rule`: `follow` Follow me, `chain` Conga line, `flee` Keep away, `bounce` Bump and turn); **Robots** (`robots`: `6` 6, `12` 12, `24` 24); **Floor** (`trails`: `off` Off, `on` Cleaned floor); **Network** (`links`: `off` Off, `on` Who follows whom). `explore(c)` drives `robots_rule`, `robots_n`, `robots_trails`, `robots_links`, `robots_walk`.

Anchors (7): `floor`, `wall`, `dock`, `you`, `gang`, `lead`, `crumbs`.

Own labels (3): "Floor" at `floor`; "Wall" at `wall`; "You" at `fn`.

Other exports: `setRoom`, `modelRoom`, `room`, `player`, `walkTo`, `crumbs`, `crumbsNear`, `floorPoint`, `see`, `avatar`, `shift`, `coverage`, `robots`, `bumps`, `state`.

## Shared parts (not props)

These files in `tools/*/sets/` are pasted before the sets and are not props themselves: data blocks, maths, shared looks, icons and one harness example.

- `tools/lbi/kit.js`: the shared kit K (seeded random numbers, vector helpers, fading materials); every story pastes it before its sets
- `tools/nmd/sets/data.js`: NMD_DATA, the muscle story's data block (generated by tools/nmd/data/gen_data.mjs); also read by the endotype story's build
- `tools/endo/sets/data.js`: ENDO_DATA, the endotype story's data block (generated)
- `tools/pet/sets/data.js`: PET_DATA, the PET story's data block (generated)
- `tools/pet/sets/icons.js`: PET_ICONS, organ icons for the PET story's panels
- `tools/micro/sets/data.js`: MICRO_DATA, the microanatomy story's data block (generated)
- `tools/ovary/sets/data.js`: OVARY_DATA and OVARY_TREND, the poster's numbers (generated)
- `tools/ovary/sets/look.js`: OVARY_LOOK, the ovary story's shared look
- `tools/qubits/sets/qmath.js`: QMATH, the qubits story's maths
- `tools/qubits/sets/data.js`: QUBITS_DATA, the real run's numbers
- `tools/qubits/sets/look.js`: QLOOK, the qubits story's lit tubes, rings, balls and halos
- `tools/mutation/sets/mmath.js`: MMATH, the mutation story's maths
- `tools/mutation/sets/data.js`: MUT_DATA, the poster's numbers
- `tools/mutation/sets/look.js`: MLOOK, the mutation story's shared look
- `tools/topo/sets/data.js`: TOPO_DATA, topocyte's numbers (generated)
- `tools/topo/sets/tdata.js`: TDATA, the decoders and look-ups for TOPO_DATA
- `tools/topo/sets/look.js`: TLOOK, the topology story's shared look
- `tools/lbi/sets/demo.js`: a tiny example set (points on a sphere) for the set harness; no story uses it

## Where manifests disagree with the code

Found by comparing every manifest with what the built set returns (param names and defaults, camera views, control keys and labels, anchor names, step params against each story's explore engine). Param names, defaults, anchors and most views agree; the differences are:

- `pet/liver`, view `default`: the manifest says `[-16, 9, 3.1, 0, -0.02, 0]`, the code has `[-16, 9, 3.4, 0, -0.02, 0]` (distance 3.4).
- `mutation/tree`, view `pair`: the manifest says `[47, 14, 4.6, 0.29, 0.3, -0.15]` ("computed for seed 1"), the code gives `[47, 14, 4.6, 0.39, 0.3, -0.26]` (the target is computed from the branches when built).
- `topo/cohort`, view `wall`: the manifest says `[80, 8, 4.6, -0.03, 0.69, 0.16]`, the code computes `[80, 8, 4.6, -0.03, 0.71, 0.15]`.
- `micro/organs` (and the topology story, which pastes it): the code has a fade param `organs_a` that the manifest does not list (it lists only `organs_spin`, `organs_tint`, `organs_pics`, `organs_lite`). Its manifest has no anchors or camera section; the code gives one view, `default`, and no controls.
- `lbi/clinic.md` says `sets/crowd.js` and `sets/sankey.js` are symlinks to `clinic.js` for the harness; there are no such files in `tools/lbi/sets/` (one file, `clinic.js`, defines both sets).
- Step params: the manifests of `pet/organs` (`organs_focus`, `organs_pair`, `organs_which`, `organs_prev`, `organs_mix`), `micro/slide` (`slide_focus`), `micro/atlas` (`atlas_focus`), `micro/hier` (`hier_focus`), `pass/fish` (`fish_n`, `fish_k`, `fish_hunt`), `flock/flock` (`flock_birds`, `flock_hunt`) and `robots/robots` (`robots_rule`, `robots_n`, `robots_walk`, `robots_dust`, `robots_crumbs`) do not say that the explore engine jumps them rather than easing (`STEP` in each story's `engine/e4_explore.js`); `pass/globe` says `globe_day` is "continuous; ease it" while the pass engine lists it in `STEP`; `pet/organs_mix` is eased in the story (0 to 1 over 2 s) but jumps in explore. `micro`'s `STEP` also lists `dots_pick`, which no set has as a param (a dead entry). `lbi` has no `STEP`: `sankey_hi` is a step only by being keyed with jumps, and explore uses `sankey_h1..h9` instead.
- `tissue_near`: the tissue manifest names it only to say it was not added (the story reads the five anchors instead); nothing is missing.

Wording differences only (not counted): control labels in the code against names in prose (the topology radius snapshots rounded to 24.6 and 48.9 um, the mutation rule's names, the globe's view labels), and the manifests' `0..1` in a default column.

## Counts

42 sets (the tour's ten, the muscle story's three, the endotype story's three, PET's three, microanatomy's four, ovary's three, qubits' three, mutation's four, topology's four, pass's three, the flock and the robots), 414 params (every param of every set, counting each set once; the tour's `body` and `tissue`, the muscle story's `motor` and the microanatomy story's `organs` are listed once although other stories reuse them, and the `<key>_a` fade of each set is counted), 285 named camera views. The three hand-written stories (airports, proteins, spatial) have no sets.

# `tower` - the multiplex network (sets/tower.js)

The hero of the muscle story (slide 8 of the talk) and the base of its explore mode. 71 layers of gene links stacked
into a tower about 2.2 units tall, each a disc of radius 1. The same genes sit at the same spot in every layer, and
vertical threads join a gene's copies. Everything comes from `NMD_DATA`: links, z-scores, heat, endotypes, layout.
Nothing is random between loads.

- **Layers**, top to bottom, in data order: HP, MP (phenotypes, magenta), Reactome (pathways, amber), NeDRex (drug
  targets, red), co-essential (essential genes, violet), 39 co-expression layers (green), 27 protein-interaction
  layers (cyan). There is a gap of 0.08 between categories. Each layer has a faint rim and an even fainter fill. A layer
  without links has only a dashed rim. Links are read generically per layer (protein layers from `edges`, the rest from
  `extra`), so new data drops in without code changes: once a layer has links, its rim turns solid and its points and
  links show.
- **Genes**: one point per gene and layer where the gene has a link (23,768 points). Seeds have a white core. At rest
  (all groups) the dots and the context links are kept dim, so the protein block does not become a white-gold blob.
- **Links**: all 125,463 layer-links can be drawn, each as a ribbon a little wider than a pixel that faces the camera
  (instanced quads, one draw call; one-pixel lines all but vanished, more so in a headset). Its width is in local units,
  kept between about 1 and 2.2 pixels (highlighted links up to 3.6), as point sizes are, and it fades out across its
  width. Two kinds of entries are listed in one instanced buffer:
  - *Context links*, chosen once at load: in each layer about 400 (protein layers) or 700 (other layers) of its links,
    never more than half of them (the small layers' links crowd among a few genes, whose copies piled up into a white
    knot), the same gene pairs in every layer (so a block of stacked layers shows one web, not a fog), short links
    before long ones, pairs of hubs less often (each gene keeps about the square root of its links) and fewer where
    genes crowd, so the middle of the layout does not burn out. 13,131 in all. At rest they take their genes' colours
    (a gradient along the link); while a group, a walk, picked endotypes or the pair view is on they turn a light
    blue-grey, keep their weight, and a seeded rank thins them a little (to 85 % with a group). In the pair view only
    those within the two towers show (everyone else waits on the rim). They are weighted by the square root of the live
    layers in their block, and looking down the tower (where a pair's copies in the stacked layers fall on one line)
    they dim to 40 %.
  - *Highlighted links*, listed again only when the selection changes (and once its 0.7 s cross-fade is over, when the
    pair view comes or goes, or the heat comes or goes): the module (its seeds' links brighter; at 45 % while the
    walkers run), picked endotypes (within one in its colour, between two in amber), the ringed gene's links, the
    walk's hottest links and, in the pair view, both groups (with seeds alone, the seeds' links, each brighter as they
    are fewer). The walk's hottest links are those between genes it visits most (at most 1,500 that reach beyond the
    start genes, plus the links between start genes): during the story's walk and in the Walk tab they show where the
    walkers go, above the context and the module. Where they outshine the module's links they take the heat's colours
    from a third of the way up (its darkest blue is darker than the context); the module's other links keep their
    genes' colours. A highlighted link that is also a context link is drawn once, by its highlighted entry: in its own
    colours and at least as bright as the context (so a big module's links, each faint, never turn blue-grey).
  Visibility and colour are decided in the shader from a per-gene texture (written only when the selection changes)
  and a 71-texel layer texture. Highlighted links are weighted by the number of live layers in their block, so the 27
  stacked protein layers never burn out, and the few layers left at the end of the drop shine brighter; looking down
  the tower and in the squashed grid they dim to 55 %. Entries drawn:
  13,131 at rest, about 34,000 with Congenital myopathies, at most about 42,000 in any settled state (the pair view),
  up to about 67,000 for 0.7 s while one large module cross-fades into another.
- **Threads**: one vertical ribbon per gene, from its top copy to its bottom copy. Only highlighted genes show one: the
  selected module (faint), seeds with `tower_seeds`, picked endotypes, the ringed gene, the genes in both groups and the
  shared endotypes in the pair, and the module during the drop.
- Cost: build about 70-130 ms in headless Chromium (listing the context links adds about 10 ms; listing the
  highlighted links again takes a few ms). 5 draw calls at rest, 7 with z bars or walkers; triangles: the fills
  (13.6k), two per link entry (about 26k at rest, 69k with Congenital myopathies, 83k in the pair view) and two per
  thread (2.3k). The link shader runs four vertices per entry (about 53k at rest, 138k with Congenital myopathies;
  the line segments it replaces ran 250k).

## Params (engine eases them; index params are rounded)

| param | meaning | suggested keys |
| --- | --- | --- |
| `tower_a` | fade | |
| `tower_rise` | layers appear from the bottom up (default 1) | 0 → 1 over 4-6 s when the tower first appears |
| `tower_cats` | category tints, and the six category labels above 0.5 (default 0.4) | 0.4 → 1 while naming the layers, back to 0.4 |
| `tower_group` | 0 all groups (group colours, genes in several groups white-gold, a web of context links in the same colours); k = 1..13 selects group k-1: its module glows, the rest dims (the context links stay, blue-grey). Selection changes cross-fade over 0.7 s (at once after a seek) | **key it as a step**: easing through the values in between shows those groups in passing |
| `tower_seeds` | the selected group's seeds glow and pulse; the rest of its module is hidden | 0 → 1 |
| `tower_walk` | about 20 walkers (sparks with trails) hop along the module's links, climb threads to switch layer, flash back to a seed on restart. Paths are planned at selection with a seeded walk (restart 0.7, switch 0.5, layers weighted by the group's z-scores), so they are a function of `t` | 0 → 1 with `tower_seeds` 1 |
| `tower_heat` | genes warm up by the group's `heat` (dark blue, cyan, white); genes outside the module that the walk visits show too | 0 → 1 after a few seconds of walk |
| `tower_module` | the added genes join the module one by one in order of heat (each flashes as it joins); with `tower_seeds` 1 this is the module growing. Links between seeds stay brighter | 0 → 1 over 8-10 s, with `tower_seeds` 1 |
| `tower_z` | layer significance (slide 5): protein layers glow by the selected group's z-score; a bar per protein layer sticks out of the rim, left of the default view, bars rising up the tower one after another; bars at z >= 1.645 (the amber dashed line) bright, others dim | 0 → 1, with a group selected |
| `tower_endo` | the selected group's genes take endotype colours (20-hue palette, `endoColour(c)`) | 0 → 1 |
| `tower_grid` | the endotype grid: the group's genes gather into one block per endotype (block size by gene count, hottest genes in the middle), at the same place in every layer; the others slide to a faint ring at the rim. The stack squashes to a tenth of its height around the protein block (rims and fills dim to match), so from above the blocks read as a grid and not as long columns splayed into a funnel | 0 → 1 with `tower_endo` 1, camera to `grid` |
| `tower_pair` | Congenital Myopathies (left) and Hereditary Cardiomyopathies (right) as two towers; the 29 genes in both in a narrow middle column; links between the sides are the bridges; genes of shared endotypes in amber; the overlap's other layers' links show; HP, coex_HRA, coex_HRV and ppi_skeletal_muscle glow | 0 → 1, camera to `pair` |
| `tower_seedonly` | in pair mode only seeds and their links stay highlighted (each link brighter, as they are fewer); the walk's genes fade, their links left among the faint context ("without the walk, the shared architecture is missed") | 0 → 1 → 0 |
| `tower_drop` | robustness: layers fall a little and fade one by one in a fixed random order (the last five are protein layers); at 1 five remain; the selected module stays lit with its threads intact | 0 → 1 over 10-15 s, with a group selected |
| `tower_room` | the layout moves out into an annulus (inner radius 0.45), with an inner rim, so a person can stand in the middle | 0 → 1, camera `inside` |

"Shared endotypes" are pairs of endotypes, one of each group, that share at least 3 genes (`pair.endo` lists every
pair, `shared` marks those). With the current data these are 13·7 (Sarcomere organization in both, 7 genes),
8·2 (Myofibril assembly · Heart contraction, 6 genes) and 7·5 (3 genes).

## Anchors

`top`, `bottom`, `mid`, `ppi`, `coex`, `pheno` (on the axis), `pairLeft`, `pairRight`, `pairMid` (tower centres at
mid height) and functions: `layer(key or index)` (on the rim, right of the default view), `group(g)` (module centroid,
at the middle of the protein block), `endo(g, c)` (endotype centroid at the top of the protein block, following the
grid, pair and room morphs), `gene(i, layer)` (a gene's copy; default its top layer), `zbar(key)` (end of that layer's
bar), `zline` (top of the threshold line).

## Labels

- The six category names with layer counts ("Protein interactions 27 layers") on the right rim when `tower_cats` > 0.5;
  the four small blocks at the top are spread apart. Hidden in z, endotype, grid and pair looks.
- The selected group's short name with gene and seed counts, above the tower.
- The six largest endotypes of the selected group ("7 · Sarcomere organization", names shortened to about 28
  characters) when `tower_endo` or `tower_grid` > 0.5: stacked up the right rim in the tower. In the grid they cross-fade
  to shorter names (about 17 characters) just behind each block (above it on screen); named blocks in the same grid row
  step down one after another, so neighbouring names do not overlap.
- In pair mode: the two group names, "In both 29 genes" (below the middle column) and the four glowing layers' names on
  the right, spread at least 0.17 apart (Heart atrium and Heart left ventricle are neighbours). The group names start
  at the left edge of each tower, far enough apart that the longer one is not cut off.

## Cam views

`default` [24, 16, 5.6] whole tower slightly from above; `ppi` the protein block; `top` from above; `side`; `grid`
[15, 64, 3.8] above the squashed grid; `z` the bar chart; `pair` [0, 12, 5.4] the two towers (target moved 0.18 right
so the layer names on the right fit); `inside` from the middle, looking out and down
at the protein block (room mode).

## Controls (explore)

View (Tower / Endotype grid / Two groups / Room), Colour (Groups / Endotypes / Walk heat), Show (Module / Seeds, then
the module grows / Walk, heat follows / Layer scores / Robustness, layers drop over 14 s). The group comes from
`setState({ group })`; `explore(c)` returns `tower_group: 0`.

## Explore API (on the set)

- `genes[i]`: `{ sym, endo[13] (0 = not in that group), seed, added, groups (bit masks), go, hpo, kegg (strings), ppi }`;
  `groups[g]` (data plus `index`, `members`, `seedGenes`, `informative`); `layers[l]` (data plus `index`, `links`,
  `genes`, `y`); `ppi` (tower layer indices); `N` 1,182; `edgeCount` 125,463 layer-links; `pairs` 15,246 gene pairs;
  `endoCount` 107; `endoColour(c)` CSS colour.
- `state` `{ group, gene, pick, off (Set), heat, walk }`; `setState(partial)` applies on the next update (explore
  wins over the params). `pick: [[g, c], ...]` (up to 8) colours the picked endotypes, threads them, links within one
  in its colour, links between two in amber, the rest faint; `gene` rings one gene in all 71 layers with its links and
  thread; `off` (Set or array of layer indices) collapses layers to a dim rim over 0.5 s; `heat` (Float32Array(N),
  0..1) replaces the group's heat; `walk: true` makes the walkers follow the last `walk()` run.
- `walk(seeds, { on, weights, group })` random walk with restart on the module network, exactly as in the shared
  facts (restart 0.7, switch 0.5, layers weighted by z >= 1.645, all protein layers alike if none is). `on` is a bool
  per tower layer (default: layers not in `state.off`), `weights` per tower layer (default from the group's z). Any
  layer with links can take part if given a weight. Returns `{ heat: Float32Array(N), top: [genes by heat, seeds
  excluded], weights }`. Cardiomyopathies' 115 seeds take about 70 ms in headless Chromium; for Congenital Myopathies
  the order of added genes matches the data's heat with Spearman 0.90 (the data walked the whole interactome, this
  walk uses the module network).
- `pick(origin, dir)` the visible gene copy nearest a ray (local coordinates, arrays or Vector3), or -1.
- `links(i)` `[{ layer, key, name, cat, partners: [gene indices] }]` for each layer where gene i has links.
- `linkStats(pick)` `{ pick, sizes, layers: [{ layer, key, name, cat, within: [n per pick], between: [[p, q, n]] }],
  total }`.
- Extras: `members(g)`, `seeds(g)`, `endoGenes(g, c)`, `heatOf(g)`, `genePos(i)` (current x, z), `pair` (`left`,
  `right`, `both`, `endo`, `glow`, `shareMin`), `zMin`, `drop` (drop order per layer).

## Tested in the harness

`walk` (seeds of group 11, half the protein layers off), `pick` (a ray at a seed's copy returns that seed; a ray at the
module centroid returns a module gene; a miss returns -1), `setState` with `group`, `gene`, `pick`, `off`, `heat`,
`walk` and back to empty, `links`, `linkStats`, anchors. No page errors or warnings. Not checked on a headset: comfort
and point and ribbon sizes at room scale, how the context links read at the Quest's resolution, and frame rate (the
link shader evaluates both ends of up to about 42,000 entries, four vertices each, per frame and eye; cheap on
desktop, to be watched on the Quest).

Known, data-limited: each module sits where the data's layout puts its genes (Congenital myopathies on the right and
lower part of the discs), and the upper blocks look sparse because those layers have little or no data yet; both
change only with the data.

## Narrator

May say: 71 layers; 27 protein-interaction layers, 39 co-expression layers, phenotypes, pathways, drug targets and
essential genes; the same genes in every layer; a disease module is the seed genes plus the genes the walk adds;
1,182 genes in the 13 modules; a layer counts as informative at z >= 1.645. Quote counts from the exports (`N`,
`groups[g].members`, `informative`), not round numbers. The z-scores are placeholders until the authors' values
arrive: do not quote individual z values, and say "in this map" for statistics. Must not say that empty layers
have no relevance (their data is still to come), or mention patients, variants or zebrafish.

Sources: NMD_DATA (Gene Table of Neuromuscular Disorders 2024, IID, GTEx, HPO, MPO, Reactome, NeDRex, CRISPR
co-essentiality, via the authors' files); slides 5 and 8 of the talk.

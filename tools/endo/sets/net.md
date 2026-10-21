# `net` - the protein network, the seeds and the walk (sets/net.js)

The authors' protein network as a deep, glowing cloud, the 35 CMS seed genes, their neighbourhoods growing and merging
with k, walkers doing a random walk with restart, the module of 393 genes pulling out of the cloud, endotype colours,
and one gene's 184-gene neighbourhood. Everything comes from `ENDO_DATA`; nothing is random between loads.

- **Cloud**: one point per gene (18,306) at `pos` (1 unit = 1 position unit). The 2,000 core genes sit in the middle
  (most within radius 1), the other 16,306 in a thick shell from radius 1.8 to 2.4, so **the set is about 4.8 across**:
  larger than the usual radius-1.1 set (the default view stands back accordingly). Points are cool blue-grey, the core
  brighter, the module genes a little larger; a slow twinkle, a depth cue (brighter in front), a haze of 300 big faint
  sprites and three soft glow shells give depth.
- **Links**: the 15,000 core links (`links`) in one `LineSegments`, faint and additive. The middle of the core is so
  crowded that it would burn out to white, so every point and link is dimmed by how many genes are around it (counted
  on a grid at load, once in the cloud and once in the module's layout). Highlights (seeds, lit neighbourhoods, heat,
  endotypes, a focus, a gene's neighbourhood) partly lift that dimming.
- **Seed groups**: a gene joins a seed's neighbourhood at k = its rank in that seed's walk. `hood` lists are in rank
  order, and the seeds whose top-k sets overlap are exactly the groups of `ENDO_DATA.groups` at every k (checked), so
  the lit genes are the real neighbourhoods, not a drawing. Each seed has a soft halo (instanced spheres) that grows
  with k, and the seeds of one group are joined by glowing arcs (the shortest tree through each group's seeds, bowed
  outwards, with light running along them).
- **Group colours follow lineages**: the groups only merge as k grows, so from the single group (amber) down to k = 1
  the biggest part of each group keeps its colour and the others take new ones from a palette. Amber is group 0 from
  k = 20 on, and below that it is the lineage that becomes group 0 (the largest group at k = 5 and 10 is another
  lineage, which joins amber at k = 30). So colours never jump between lineages; between integer `net_k` they
  crossfade.
- **Module layout**: a quick force layout of the 393 genes on their 710 links, started from their places in the cloud
  (so each keeps its bearing as it moves), with a weak pull towards its endotype's middle so endotypes read as regions.
  About 1.3 across (RMS radius 0.4). It is a drawing: distances in it mean nothing beyond "linked genes sit close".
- **Walkers**: 300 sparks, 8 or 9 per seed. Each lives at one seed; at every step it jumps home with probability
  `facts.r` = 0.8, else hops to a random neighbour along a stored core link (a gene with none sends it home). Restarts
  at home change nothing, so they show as a short rest (the walker fades into its seed). A hop glides along the link in
  about 0.25 s with a gold trail; a restart is a quick pale-cyan streak home (0.13 s); the gene just reached glows
  amber for about a second. Walkers spread evenly over the seeds, each restarting at its own seed, average to the walk
  with restart from all seeds (the walk is linear in its restart vector). Paths are planned once, seeded, and loop
  seamlessly, so a walker's place is a function of `t` (seeking works; nothing accumulates).
- **Cost** (headless Chromium, software GL): build 95-150 ms (the module layout is about 60 ms of it). Draw calls:
  6 at rest, 8 with seed groups (halos, arcs), 9-11 with walkers, 8 with a neighbourhood. Points 18,606 (+900 with
  walkers), lines 15,000 (+1,800 trail segments, +up to 183 neighbourhood lines), triangles 3.6k at rest, 24k with seed
  groups (35 halo spheres, 49 arcs). CPU per frame: about 0.01 ms at rest, 0.3-0.4 ms with 300 walkers. Per-frame
  uploads only while walkers show (about 45 KB) and while halos show (35 centres); a gene change rewrites one 18,306
  float attribute once. No per-frame allocation.

## Params (the engine eases them; index params are rounded)

| param | meaning | suggested keys |
| --- | --- | --- |
| `net_a` | fade | |
| `net_cloud` | the cloud appears from the centre outwards with a bright front (default 1) | 0 → 1 over 5-6 s |
| `net_seeds` | the 35 seeds glow white-hot and grow, everything else dims a little; labels "35 seed genes" and four seeds (CHRNA1, MUSK, AGRN, DOK7). **Above 0.5 it also brings the seed groups** at `net_k` (halos, arcs, lit neighbourhoods); below 0.5 only the seeds glow | 0 → 1; 0.3-0.4 for "seeds there but quiet" (neighbourhood chapter, endotype focus) |
| `net_k` | 0..12: neighbourhood size `groups.k[round(net_k)]`; between integers the lit neighbourhoods grow rank by rank, halos grow and colours and arcs crossfade. Label "k = 20 · 10 groups". At exactly 0 the k label is hidden (so "35 seed genes" can show): **use 0.25 for k = 1** with its label | step 0 → 12 with holds (e.g. 0.25, 5, 6, 8, 9) |
| `net_walk` | walkers: their number grows with the value (300 at 1). Seed groups mostly give way (to 20 %) | 0 → 1 over 2 s; back to 0 |
| `net_heat` | every gene coloured by the walk from all seeds (`heat`, log scale): deep blue, blue, teal, amber, orange, white-hot (seeds); hot genes larger. Seed groups give way | 0 → 1 over 8-10 s while walkers run |
| `net_module` | the module pulls out: its 393 genes move (each at its own moment, with a slight swirl) to the module layout, their links brighten, the rest of the cloud recedes outwards to a faint haze; seeds stay white, the 358 found genes turn warm amber. Label "The module · 393 genes" | 0 → 1 over 8 s, camera to `module` |
| `net_endo` | module genes (and their links) take their endotype colours; seeds keep a white heart. In the cloud view the rest of the core steps back so they show | 0 → 1, best with `net_module` 1 |
| `net_focus` | 0 none, id + 1: that endotype's genes and links bright, everything else dims (seeds soften). **Key as a step** (`STEP` in explore): easing passes through the ids in between | with `net_module` 1, `net_endo` 1, `net_seeds` ≤ 0.3 |
| `net_gene` | -1 none, else a module index (0..392). **Key as a step**, while `net_hood` is 0 | jump, then raise `net_hood` |
| `net_hood` | 0..0.3: the gene is marked (a cyan bubble, white point, its label) and the rest dims; 0.2..1: its 184-gene neighbourhood lights up cyan in rank order (in the core and out in the shell), with lines growing from the gene to the members in the core | 0 → 1 over 4 s, camera `gene` |

With every param at its default the set shows the resting cloud. The story's current keys in `engine/e3_story.js`
(cloud, seeds, k steps at kAt(k) + 0.25 for k = 1, walk, heat, module, then module and heat back to 0, seeds to 0.4,
gene jump and hood) fit these meanings as they are.

## Anchors (local coordinates; functions write into their own array, so copy one to keep it)

`centre` [0, 0, 0]; `cloud` (upper right of the shell, for "18,306 proteins"); `module` (the module's centroid, following
the morph); `moduleTop` (above the module); `seeds` (the seeds' centroid); `seedTop` (the topmost seed); `k` (for the k
label); `gene` (the current gene, or the module's centroid); `hood` (the middle of the current gene's neighbourhood
members in the core); `e0` .. `e11` (each endotype's centroid, following the morph).

## Labels

"18,306 proteins" (with `net_cloud`, before `net_seeds`); "35 seed genes" and CHRNA1, MUSK, AGRN, DOK7 (minor) with
`net_seeds`, until `net_k` moves; one k label per k ("k = 1 · 34 groups" ... "k = 75 · one group"), amber, with
`net_seeds` above 0.5; "The module · 393 genes" with `net_module`; the current gene's name with
"· 184-gene neighbourhood" with `net_hood`, for the 35 seeds (the story's genes are seeds). **Explore mode labels any
other gene itself** at the `gene` anchor (the engine already does). All labels give way to the walk, heat, the module,
endotype colours and a neighbourhood as fits. All numbers come from `ENDO_DATA`.

## Cam views

`default` [18, 12, 6.8, 0, 0, 0] (the whole cloud), `core` [24, 10, 4.4, 0, 0, 0], `seeds` [-28, 14, 3.6, 0, 0, 0] (the
seeds and their arcs), `module` [20, 8, 2.9, 0, 0, 0], and `gene`: a getter, a view from outside the cloud with the
current gene in front (distance 2.4, 1.8 in the module view). For a given gene use `api().geneView(i)` (it uses the
module morph of the moment it is called; in the story's neighbourhood chapter the module is back in the cloud).

## Controls and explore

View (Network / Module), Walkers (Off / On), Colour (Walk / Endotypes). `explore(c)` returns `net_cloud` 1,
`net_seeds` 1, `net_module` (Module), `net_walk` (On), `net_heat` (Walk) and `net_endo` (Endotypes); everything else at
rest (the engine adds k, gene, hood and focus).

## Explore API (`api()`, the same object each call)

- `names`: the 393 module genes' symbols in order (module index = position).
- `geneIndex(name)`: module index (case-insensitive) or -1.
- `pick(raycaster)`: the module gene nearest a world-space ray (within about a degree), in the current morph, or -1.
  Only module genes can be picked.
- `setGene(i)`: an alternative to `net_gene` (used when `net_gene` is -1): marks gene i at once (bubble, label) without
  dimming; its neighbourhood still needs `net_hood`. -1 clears. (State, not a param: the engine does not need it.)
- `geneView(i)`: [az, el, dist, tx, ty, tz] near module gene i.
- `seeds`: module indices of the 35 seeds in the Gene Table's order; `kValues`, `groupCount`: the 13 k values and the
  number of seed groups at each (34, 34, 34, 33, 33, 29, 10, 5, 2, 1, 1, 1, 1); `endoOf(i)`: a module gene's endotype;
  `hoodCore(i)`: the node indices of gene i's neighbourhood members that are in the core (those with lines).

## What a narrator may say, and must not

- May say: the authors' network has 18,306 proteins and 316,613 links; the picture shows the 2,000 the walk from the
  seeds visits most, with 15,000 of their links, and the rest further out the less the walk visits them. At k = 1 two
  seeds already share a neighbourhood (SLC5A7, the choline transporter, and SLC18A3, the vesicular acetylcholine
  transporter); by k = 75 all 35 belong to one. Walkers start at the seeds; at every step they jump back with
  probability 0.8, otherwise hop to a neighbour; the genes they visit most join the module: 35 seeds + 358 found = 393.
  Each gene's own walk gives its neighbourhood, the top 1 % of the network: 184 genes.
- Must not say: that distances in the cloud or in the module layout are biological distances (the module layout is
  drawn to keep linked genes close and endotypes together); that the walkers are molecules or patients; that the
  endotypes are visible as clusters before they are found (the regions are a drawing choice). The seed groups, walk
  and neighbourhoods are the package's steps re-run with its defaults, to show the method (say so once, as the spec
  asks). No patient data, variants or zebrafish.

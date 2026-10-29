# `net` - the crowd of microbes and the network of those that rise together (sets/net.js)

The soil's kinds of microbe as a deep cloud, the nitrifiers flaring, the co-occurrence network of 1,564 kinds and 22,348
links pulling out of the cloud's core, a shuffle dissolving it, its modules in colour, and the halves' networks side by
side. Adapted from the endotype story's `net` set (its cloud with a core and a shell, the glowing seeds, the module
pulling out, the colours, the focus and picking), without its walkers, heat and k. **Drawn in the field set's frame**
(`FRAME = { net: 'field' }`): the cloud floats over the field, centred at (0, 1.3, 0).

- **Data** (all `SOIL_DATA` through `SDATA`, nothing computed): the cloud's 20,000 kinds (`SD.cloud`: rank, phylum,
  prevalence, abundance, guild), the 3,384 common kinds (`SD.common`: names, flags), the network (`SD.net`: nodes, the
  stored 3D layout, links strongest first with their rho and split bits, modules), `SOIL_DATA.net.mods` (sizes, r2, phyla,
  genera), `.splits` (each half's own network), `.null` (shuffled: 0 links), `.thresholds`, the guilds.
- **The cloud's places are a drawing**: each phylum a sector of the sphere about the vertical (wider for phyla with more
  kinds in the cloud: count^0.55), the common kinds in a core of radius 0.06 to 0.38 (the most abundant innermost), the
  rare ones in a shell from 0.42 to 0.7; seeded (`K.rng(100116)`), the same on every device. Coloured by phylum
  (`SLOOK.phylum`), sized by abundance, twinkling; a haze of 260 big faint sprites and two soft glow shells.
- **The network's layout** is the stored one (`SD.net.xyz`: modules apart, radius about 1), scaled to radius 0.6 and each
  module spread round its middle (×1.85 for modules of 30 kinds or more, ×1.4 for smaller ones: the stored modules are
  tight balls whose links between them drew thick bars). Still a drawing: linked kinds sit close, distances mean nothing
  more. The 65 kinds outside any module keep their stored places.
- **Links**: one `LineSegments` per copy, additive, the stored order (strongest first): the threshold is a prefix
  (`SD.net.cut(rho)`), so a link shows while its rank is under the cut; rising together pale cyan, one up as the other
  goes down faint warm red; links between modules much fainter than those inside one; crowded middles dim (a grid count
  round each node, as the endotype story's).
- **The split**: three copies of the nodes and links share one geometry, each with its own uniforms (offset, size, the
  bit of `SOIL_DATA.net.splitBits` it keeps, its fade). Line: BNI left at x -0.6, control right at 0.6, size 0.72;
  fertiliser: -0.8, 0, 0.8, size 0.55; at random: random half A and B (the first random split, the one whose bits are
  stored). Each copy shows only the links of the whole network its half's own network also has, and dims the kinds left
  without one; its tag gives its own network's total links (`splits`).
- **Cost** (headless Chromium, software GL): build 55-135 ms. Draw calls: 6 at rest (cloud, haze, two glow shells, the
  nodes and links of copy 0), 8 split in two, 10 in three, +1 with a kind picked. Points 20,260 (+1,564 per extra copy),
  lines 22,348 per copy, triangles about 1.9k (the glow shells; +720 for the picked kind's bubble). No per-frame
  allocation: a kind picked rewrites one 1,564-float attribute once; a new threshold is looked up once.

## Params (the engine eases them; index params are steps)

| param | meaning | story |
| --- | --- | --- |
| `net_a` | fade | |
| `net_cloud` | the cloud appears from the centre outwards with a bright front (default 1) | 0 → 1 over 7 s (chapter 6) |
| `net_nitro` | the nitrifiers' kinds flare in their guild's colour (`SLOOK.GUILD`), larger; the rest steps back; their tags | 0 → 1 (chapter 6) |
| `net_pull` | the network's kinds fly out of the core to the layout (each at its own moment, with a sideways bow); the rest of the cloud recedes to a faint shell round it (0.72 to 0.97) | 0 → 1 over 8 s (chapter 7) |
| `net_links` | the links fade in (each also waits for its kind to have left the core) | 0 → 1 |
| `net_rho` | 0.6..0.8: only the strongest links (a prefix); kinds left without a link dim | explore only |
| `net_shuffle` | the links shiver and fade to nothing, the kinds scatter a little: "Shuffled · not one link is left" | 0 → 1 → 0 (chapter 7) |
| `net_mods` | kinds and links take their module's colour (`SLOOK.module`); the big modules' tags (size and what they follow) | 0 → 1 |
| `net_focus` | step: -1, or a module 0..16 lit, the rest dimmed (the engine keys `field_module` and `field_mlit` with it) | the fertiliser's big module, then a plots' one |
| `net_split` | the copies move apart and fade in (copy 0 is the whole network at 0) | 0 → 1 (chapter 7, by line) |
| `net_splitBy` | step: 0 wheat line, 1 fertiliser, 2 at random | 0 |
| `net_kind` | step: -1, or a cloud index: its bubble, its links lit, its neighbours cyan, its tag | explore only |

## Anchors, labels, views

- Anchors: `cloud`, `core`, `top`, `net`, `netTop`, `under`, `left`, `mid`, `right` (the copies' tops), `copy0..2`,
  `pick` (the kind picked), `g_<guild>` (each guild's tag: among its 40 most abundant kinds in the cloud, the one farthest
  from the tags placed before), `m0..m16` (each module's top), and the function `module(m)` (its middle).
- Labels: "About 100,000 kinds · of microbe in this soil", "3,384 common kinds · 95 % of the reads", the five guilds
  (kinds and shares; Nitrosospira "0.23 % of reads, 0.51 % with fertiliser"; the uncultured Nitrosomonadaceae "role
  unknown"), the network's kinds and links at the threshold, "Shuffled · not one link is left", the big modules' sizes
  and what they follow (a small module's only while in focus), each copy's own network's links, "8,377 links apart ·
  random halves: 158 to 27,758" (line split), the kind picked ("Kind 215 · Denitratisoma · Proteobacteria").
- Views: `default`, `cloud`, `core`, `net`, `module` (the network with the field below), `split`, `over`.

## Explore and api()

- Controls: `view` (The crowd, The network, Split), `colour` (Phylum, Module, Nitrifiers), `by` (Wheat line,
  Fertiliser, At random; offered while split). `explore(c)` replays the links from `c.t`.
- `api()`: `n` (20,000), `nodes`, `centre`, `pick(raycaster)` (`{ kind: 'kind', i }`: in the cloud any kind; once the
  network has pulled out only its kinds with a link at the threshold; none while split), `pos(i)` (where kind i is now),
  `info(i)` (rank, phylum, name, guild, prevalence, share of reads, what it differs by, its module and links), `kindText(i)`,
  `module(m)`, `nodeOf(i)`, `cloudOfNode(n)`, `members(m)`, `follows(m)` ("the fertiliser", "the plots"),
  `nodesAt(rho)`, `guildTop(key)`.

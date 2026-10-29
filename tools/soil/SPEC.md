# Holding on to nitrogen: 3D sets, data and engine spec

The sixteenth story of the app: `stories/soil.js`, built from `tools/soil/` like the tissue topology story is built from
`tools/topo/`. It is made for the Global Peter Drucker Forum in Vienna (a lay, business audience), from the slides
**"Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter
Wheat"** by **Marina Montserrat Díez**, Tadashi Yoshihashi, Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios
Karpouzas, Christina Hazard, Melina Kerou and **Christa Schleper** (University of Vienna: Vienna Doctoral School of
Ecology and Evolution, Archaea Biology and Ecogenomics; University of Thessaly; Université Lyon 1 Claude Bernard; JIRCAS,
Japan International Research Center for Agricultural Sciences), and from the field trial's data behind them. What they
say is summed up below; nothing else from them is needed. Two builders start from this: **A** builds the `soil` and
`field` sets; **B** builds the `net` set and the engine (story, explore, panels). An integrator adds the story to the app
afterwards (`stories/list.js`, `sw.js`, `shared.js`'s `FORMAT`, the smoke and shared-room tests, the station icon,
`AGENTS.md`, `HANDOVER.md`): builders do not touch those files.

Card (`HOST.list`, for the integrator): key `soil`, kick "Soil microbes", title **Holding on to nitrogen**, colour
`#9ccc65`, desc "Half of a farm's fertiliser is lost through the soil's microbes. A wheat with a trait from a wild grass
slows them down: in a field trial in Japan it stays greener and leaks less, while the soil's crowd of microbes follows
the fertiliser, not the wheat.", page "Holding on to nitrogen: a wheat, its soil and the microbes in between", brand
"Holding on to nitrogen", sub "a wheat, its soil and its microbes", aria "Interactive 3D story of how soil microbes turn
fertiliser into nitrate and nitrous oxide, a wheat that slows them down, and the network of microbes in a field trial",
thing `field`, loading "Spreading the fertiliser", icon a wheat ear (the integrator's, `lowpoly.js`), len from pacing.

## Decisions (the owner's, 29 October 2026)

- **Permission is given** by the authors, through the owner, to use the slides and the data. **For anything unknown, use
  illustrative values and say so** in the story itself (a stand-in is called a stand-in where it shows).
- **"Make sure everything is fancy 3D as usual"**: things in the room that move, grow and flow; numbers as tags on the
  things they belong to; **no 2D charts** as the main thing (the rule in `AGENTS.md`, "Conventions"; a quick graph in
  passing is fine: the cores stacking into the design is one). Reuse props where possible (below).
- **Never the slides' pictures or photos**: everything is redrawn in 3D. The authors' raw files stay out of the
  repository; only derived numbers go in. The kinds of microbe are numbered by abundance, never named by their ids; no
  sequences. No e-mail addresses anywhere.
- **The honest message** (the data's verdict, `tools/soil/README.md`): in the slides' measurements the BNI wheat stays
  greener and leaks less nitrate and N2O; the soil's microbe community and its co-occurrence network follow the
  fertiliser and the field plots, not the wheat line (2 of 3,384 common kinds differ; the two lines' networks differ no
  more than random halves of the samples do); rising together is not working together; strong indications, not yet
  proof. Never say the wheat "changes the microbiome" or "rewires the network", never call a hub a keystone, never call
  a link an interaction.
- **The N2O discrepancy is said**: the metadata's N2O (one number per sample, "the potential amount of produced nitrous
  oxide", unit not given) shows BNI 0.81 against control 0.98 in fertilised soil over the season (p = 0.58), lower for
  BNI on days 1 and 24 but higher on day 15; the slides' incubations (N2O in ppm over 20 to 22 days of each day's soil,
  a mixed model) find the wheat line significant on days 1 to 53, up to about 3-fold less (day 1: about 0.4 against 1.3
  ppm). Say which measurement each is as far as known, and label the difference as an open question (chapter 5's small
  print, explore's Field pane on N2O). The data's other open questions (`SOIL_DATA.open`) are said where they matter.
- **British spelling**, English only. Plain words for a business audience; the technical layer in small print.

Words: "kinds of microbe" (small print: amplicon sequence variants, ASVs, from 16S rRNA gene reads), "the relay" for
nitrification (ammonium to nitrite to nitrate), "ammonium", "nitrate", "nitrous oxide (N2O), a greenhouse gas about 270
times as strong as CO2" (only if the text needs a factor; it is the IPCC's 100-year figure, say so), "the BNI wheat" and
"the control wheat" (small print: Munal-BNI and Munal-control, two lines of the wheat Munal, one carrying a chromosome
segment of the wild grass *Leymus racemosus*), "biological nitrification inhibition (BNI)", the three "regimes": not
fertilised, fertilised (250 kg N per hectare), fertilised + DCD (a synthetic nitrification inhibitor; dicyandiamide is our
reading), "plots", "blocks" (the four replicates, drawn as rows), "sampling dates", "rising together" (co-occurrence:
correlation across the samples), "modules" (groups that rise together), "the crowd" (the community).

**The rules for sets are the tour's**: `tools/lbi/SPEC.md` from the top down to "Palette and look", and
`tools/lbi/kit.js`, with these differences (as the tissue topology story's, `tools/topo/SPEC.md`):
- Set files live in `tools/soil/sets/`; the harness is `tools/soil/harness.html`
  (`?set=<name>&p=k:v,...&t=..&cam=<view or six numbers>&anim=1&with=<second set>`) and the screenshot tool
  `tools/soil/shot.mjs` (run it from `tools/soil`; `SHOTS=<dir>` and `PORT=<port>`). The harness always loads
  `SOIL_DATA`, `SDATA`, `SLOOK`, `TLOOK` and the tour's `web` set (`set=web` shows the globe:
  `set=web&p=web_net:0,web_globe:1,web_spin:-0.25&cam=globe`).
- Shared globals before the sets (the build pastes them inside the story's closure in this order): `SOIL_DATA`
  (`sets/data.js`, generated), `SDATA` (`sets/sdata.js`: decoders and lookups, no science), `SLOOK` (`sets/look.js`: the
  story's palette and colour rules; a shape both A's sets draw, the wheat plant, may be added there), `TLOOK`
  (`tools/topo/sets/look.js`, **unchanged**: lit instanced tubes, rings, balls, boxes, halos, cones, glass spheres, glass
  discs, ribbons, glass slides; read its header), then the tour's `web` set (`tools/lbi/sets/web.js`, **unchanged**: only
  its globe is used), then this story's sets: `soil`, `field`, `net`.
- **Copied and adapted** (not included): the endotype story's `net` set (`tools/endo/sets/net.js`) as `sets/net.js`
  (builder B); the flock's swaying reeds (`tools/flock/sets/flock.js`, "reeds and grass round where you stand": blades as
  triangles swaying in the vertex shader on `uTime`) as the field's wheat; the aging ovary story's stacking movement
  (`tools/ovary/sets/charts.js`, `SLIDE_GL`: instanced items with two poses, a staggered smoothstep per item from one to
  the other) for the soil cores. The stubs in `sets/` keep this contract already: replace their bodies.
- Labels may have `text` as a function returning `[bold, rest]` (re-read while the label shows: the plots' values, the
  dates, the jars' ppm, a module's size). **Step params** (integers, never eased) are listed in each manifest and in the
  engine's `STEP`. A set may export `api()` (picking, lookups) and `finish()` if it builds in slices.
- Budget per set: build under 300 ms in headless Chromium (software GL), at most 20 draw calls and 150k triangles at any
  moment, no allocation per frame in `update` (refill pools). Seeking must work: what a set shows depends only on its
  params and `t` (the wheat's sway and the particles' flow are functions of `t`).
- Each set gets a manifest `sets/<name>.md` (params, keyframes it expects, anchors, labels, views, explore, cost).

## Look

The app's dark, glowing, lit 3D (the tour's light over the left shoulder, rim glow). Colours are `SLOOK`'s:
- **Nitrogen as it moves**: fertiliser grains off-white `#f1eee2`; ammonium amber `#ffb43b`; nitrite rose `#ff7ab8`;
  nitrate blue `#4d9de0` (glowing `#7cc0ff`); nitrous oxide pale lilac wisps `#d9ccff`; nitrogen taken up by the plant
  green `#7bd389`; the marked atom of chapter 8 white. A particle changes colour as the relay hands it on.
- **The two wheat lines and the three regimes are the slides' own colours**: BNI teal `#2ec4b6`, control orange
  `#f08a3c`; not fertilised green `#5cc96b`, fertilised purple `#a77bff`, fertilised + DCD yellow `#f2d14b`. The BNI halo
  round the roots glows `#5ff2e0`; DCD granules yellow.
- **Microbes by guild**: archaea magenta `#ff5ad9`, Nitrosospira coral `#ff7a59`, Nitrosomonas salmon `#ffa07a`,
  Nitrospira cyan `#46d9ff` (comammox: cyan with an amber core), uncultured Nitrosomonadaceae grey-violet `#9a8cc8`.
- **Soil and plant**: loam `#3b2a1e` to `#5a3f2a`, grains `#7a5a3c` and sand `#a88a62`, pores near black with water films
  `#9fd8ff`, roots cream `#e8dcc0` with finer, paler root hairs; leaves by chlorophyll (`SLOOK.chl(spad)`: straw yellow
  at SPAD 45 to deep green at 65), ripe ears gold `#e3c15a`, straw `#cdb46a`; the netting pale `#cfd8e6` on posts.
- **The cloud and the network**: phyla by `SLOOK.phylum(name, i)` (the 12 largest, Other and Unassigned grey);
  modules by `SLOOK.module(m)` (the five big ones vivid red, blue, yellow, green, violet); links rising together pale cyan
  `#9fe8ff`, one rising as the other falls faint warm red `#ff7a6b`.
- Labels as the other stories' (`cls` `''`, `cyn`, `amb`, `grn`, `mag`); the app's cyan `#46d9ff` for highlights.

Frames (y up, the story faces +z; 1 unit about 0.5 m in a headset at the default size):
- `soil`: the block centred on the origin, its surface at y = 0: about 1.2 wide (x), 0.8 deep (z), 0.7 down to y = -0.7;
  the wheat stands at the origin, its ear's top at about y = 0.85, its roots down to about y = -0.6. The front of the
  block is cut away (`soil_cut`) so the profile, the roots and the flows show.
- `field` (and `net`, drawn in its frame: `FRAME = { net: 'field' }`): the 24 plots on the x-z plane at y = 0, about 1.8
  by 1.2; a soil slab under them to y = -0.25 (for the nitrate seeping down); the wheat up to about y = 0.3 when ripe; the
  netting at about y = 0.4; the jars on a bench to the right (x about 1.3); the stack of cores behind (z about -0.95, up
  to y about 0.8); the cloud and the network over the field, centred at (0, 1.3, 0), radius about 0.7.
- `web`: the tour's globe, radius 1 at `web_globe` 1 (it grows from 0.1 below 0.6), turned by `web_spin` turns
  (longitude -12 faces +z at spin 0; `web_spin` -0.25 faces longitude 78 E, between Vienna and Japan). The engine's hop
  (`makeHop` in `engine/e2_scene.js`, done) draws the arc from Vienna to JIRCAS in its frame.

## The slides, in short (what the story tells)

1. **Less than half of the fertiliser reaches the plant** (the slide's words, "Less than 50%"). Nitrifiers, microbes
   that turn ammonium into nitrate, compete with the plant for it; nitrate washes away (leaching) and nitrification and
   what follows it give off N2O. So farmers spread more.
2. **The relay**: ammonium to nitrite by ammonia-oxidising archaea (AOA) and bacteria (AOB), nitrite to nitrate by
   nitrite-oxidising bacteria (NOB), and comammox does both in one microbe.
3. **BNI**: some plants release compounds from their roots that slow nitrification. A segment of chromosome of the wild
   grass *Leymus racemosus* was moved into the wheat Munal (Subbarao et al., PNAS: the slides cite it). Earlier evidence:
   root exudates slowed one ammonia-oxidising bacterium in batch cultures; a field study at a single timepoint (more N in
   the plant, fewer AOA).
4. **The first time-resolved field trial** (JIRCAS, Japan): Munal-BNI and Munal-control, 0 kg N/ha, 250 kg N/ha, 250
   kg N/ha + DCD; five sampling dates (days 1, 15, 24, 53 and 70 on the slides; 129 to 199 days after planting in the
   data's notes, from jointing to ripening); four replicates; the rhizosphere soil (the soil clinging to the roots);
   amplicon sequencing of prokaryotes (16S; fungi and protists too, not sent), qPCR of amoA, soil ammonium and nitrate,
   leaf chlorophyll (SPAD), N2O in incubations.
5. **Greener, less nitrate, less N2O**: chlorophyll higher at the end of the season, most clearly without fertiliser
   (day 70: about 62 against 49); nitrate lower in fertilised soil at day 24 (about 40 against 61 mg N/kg; the slide
   says days 24 to 53, only day 24 is starred); incubated soil from the BNI wheat gives off much less N2O in fertilised
   soil on days 1 to 24 (day 1: about 0.4 against 1.3 ppm), close to what DCD does in every soil.
6. **The microbes look the same**: the fertiliser shapes the community (prokaryotes, fungi, AMF, protists), not the
   wheat line; the AOA and AOB counts (qPCR) differ little (one marginal p = 0.057).
7. **Verdict**: "strong indications" of nitrification inhibition by Munal-BNI, no disturbance of the soil microbiome; to
   prove it, isotope studies and metatranscriptomics (which microbial genes are switched on).

The co-occurrence network is **ours**, built for this story from the 16S data with a standard method (the authors asked
for correlations among the kinds in their notes on the data): say so in its small print.

## The data: `SOIL_DATA` (`sets/data.js`, generated; never edit)

Written by `python -I tools/soil/data/gen_data.py <folder with the three CSVs>` (about five minutes; its header lists
every field; Python with numpy, pandas, scipy, networkx: `tools/soil/data/requirements.txt`), from the authors'
`Soil_ASVs.csv` (raw 16S read counts, 100,116 kinds x 119 samples), `ASV_Identifiers.csv` (their taxonomy) and
`Field_Metadata.csv` (chlorophyll, nitrate, ammonium, N2O, soil water, pH per sample), kept out of the repository, and
from `tools/soil/data/figures.json` (the slides' charts read off by two readers and reconciled by
`tools/soil/data/reconcile.py`: their mean where they agree, flagged where they do not; one point of 450 is flagged).
About 425 KB. Indices are the same everywhere: line 0 BNI, 1 control; fert 0 not fertilised, 1 fertilised, 2 fertilised +
DCD; time 0..4 the dates T1..T5; rep 0..3; a group `g = (line * 3 + fert) * 5 + time` (30); a sample's slot `s = g * 4 +
rep` (120; the missing sample, BNI fertilised + DCD T4 rep 1, is null in every per-sample list); a plot `p = (line * 3 +
fert) * 4 + rep` (24).

- `src`: the table (119 samples, 100,116 kinds, 22.7 million reads, 96.8 % zeros, a median of 3,195 kinds per sample,
  kingdoms, how many kinds have a name at each rank, 51 % of reads without a genus), `missing`.
- `design`: lines, ferts (kg N), times (`dap` days after planting, `day` the slides' day, `stage`, Zadoks range), reps 4,
  plots 24, `n` per group.
- `meta.<nh4|no3|n2o|chl|ph|water>`: name, unit, `values` (120 slots), `mean`, `sd`, `n` per group, `line` (BNI against
  control per regime over the season, `byFert`, and per regime and date, `byGroup`: `[mean BNI, mean control, p]`),
  `fertP`. Real. Ammonium and nitrate agree with the slides' charts (within 4 and 1 mg N/kg).
- `phyla`: the 12 largest and Other, Unassigned: `names`, `kinds`, `share` (mean % of reads), `group` (% per group).
- `guilds`: the nitrifiers (`aoa` archaea, `nsp` Nitrosospira, `nsm` Nitrosomonas, `nit` Nitrospira, `mnd` uncultured
  Nitrosomonadaceae, role unknown): kinds, share, `group`, `sd`, `byFert`, `byLine`, `p`, `rho` (with N2O, ammonium,
  nitrate, pH); `aoa1c` (42 Group 1.1c archaea, not known to oxidise ammonia), `nob` (Nitrobacter and Nitrolancea:
  almost absent). Fertiliser roughly doubles Nitrosospira (0.23, 0.51, 0.42 %); DCD lowers the archaea (4.9, 4.7, 3.9 %);
  neither differs by wheat line.
- `cloud`: 20,000 kinds (all 3,384 common ones and a seeded sample of the rest), by abundance rank: `rank`, `phy`,
  `prev` (samples it is in), `ab` (log10 of its mean share), `guild`.
- `common`: the 3,384 kinds in at least 20 % of samples (94.6 % of reads): `idx` (cloud index), `flags` (differs by
  fertiliser 1,646, by date 580, by wheat line **2**, by plot 2,281 after the 30 groups' means), class, family and genus
  names, `lineKinds` (the two: a Denitratisoma more under the control wheat, a Kitasatospora more under the BNI wheat; q
  about 0.03: name them only in explore's small print, never as an effect of the wheat), `n2oTop`, `n2oMax` (no kind
  follows N2O beyond |rho| 0.59).
- `net`: the co-occurrence network: 1,564 kinds, 22,348 links (18,216 rising together, 4,132 one up as the other goes
  down), **17 modules** (Louvain, seed 1: 438, 312, 296, 213 and 172 kinds and twelve small ones; other seeds give 15 to 17, always five or six big ones: say "about five big
  groups"), Q 0.611; `node`, `mod`, `deg`, `xyz` (a 3D layout made offline: modules apart, radius 1), `ij`, `w` (links
  strongest first: any stricter threshold is a prefix, `cuts`), `split` (bits: whether each link is also in the BNI
  half's own network, the control half's, N's, F's, S's, random half A's and B's), `mods` (per module: size, phyla, top
  taxa, `share` per group, `score` per sample, `r2`: the share of its ups and downs that go with fertiliser, date, line
  and plot; two big modules follow the fertiliser, 0.90, four follow the plots, 0.65 to 0.83, the line under 0.01 everywhere),
  `thresholds` (0.5: 84,506 links ... 0.8: 449), `prevalence`, `null` (shuffled: **0 links**), `splits` (the BNI half's
  own network 38,653 links, the control half's 30,276: 8,377 apart; random halves 158 to 27,758 apart, 10 of 20 more than
  the lines), `residual` (with the 30 groups' means out still 22,348 links, only 9,931 the same; with the plots' means
  out too 1,024: the links mostly reflect fertiliser and plot), `fertNodes` (66 % of the network's kinds differ by
  fertiliser against 49 % of all common kinds).
- `figs`: from the slides, approximate (say "read off the slides"): `chl70` (day 70 chlorophyll per regime and line),
  `n2o` (the incubation curves: ten readings over 22 days per date, regime and line; `peaks`; the printed p labels),
  `qpcr` (`aoa`, `aob` copies per g dry soil per regime, date and line), `match` (how the metadata agrees with them).
- `open`: the open questions (the chlorophyll's dates: the metadata's T4 values match the slides' day 70, and for
  fertilised + DCD the two nearly swap; the N2O measurements; day 15 or 16; 20 or 22 days of incubation; days 24 to 53;
  DCD; the field's site, year and plot map; fungi and protists not sent; the Group 1.1c archaea; the network's caveats).

`SDATA` (`sets/sdata.js`): `group`, `slot`, `plot`, `ofGroup`, `ofSlot`, `ofPlot`, `missing`, `meta(key, line, fert,
time)`, `value(key, s)`, `lineTest(key, fert, time)`, `phylumShare(g, i)`, `guild(key, g)`, the decoded `cloud`,
`common` (with `name(i)`), `net` (`cloudOf(i)`, `xyz`, `ij`, `rho`, `split`, `cut(rho)`, `members(m)`, `score(m, s)`,
`share(m, g)`), `n2o(day, fert, line)`, `qpcr(kind, fert, day, line)`, `chl70(fert, line)`. **The app computes nothing
scientific**: it looks numbers up and draws them. `node tools/soil/test-data.mjs` checks the key numbers.

What is real, read off, illustrative (say so in the story):
- Real (the data): every field measure per plot and date, the groups' means, the phyla, the guilds, the cloud, the
  network and everything about it, the design (119 samples, 24 plots, 5 dates).
- Read off the slides (approximate): chlorophyll on day 70, the N2O incubation curves, the qPCR counts.
- Illustrative: the soil block, its grains, roots and flows (the "less than half" is the slide's; the flows' shares are a
  drawing), the relay in the pore, the halo, the chromosome, the field's plot layout (the real map is not known: four
  blocks of six in a seeded random order), the hop's end point (JIRCAS's home in Tsukuba: the trial's site is not
  given), the wheat's look at each date (its height and stage are the textbook's for the Zadoks stages; its leaf colour is
  the measured chlorophyll), and the Nitrogen sketch in explore. The cloud's places are a drawing (abundance inwards,
  phylum by sector); the network's layout is a drawing (linked kinds sit close; distances mean nothing more).

## The sets

### `soil` (builder A; chapters 1, 2, 3 and 8; explore's Nitrogen sketch)

The cut-away block: layered loam with grains and pores (instanced), a wheat plant (stem, leaves, ear; the same plant as
the field's, `SLOOK` if shared) with roots branching down and fine root hairs, the soil surface with a few stones.
- Fertiliser (`soil_fert` 0..1): grains fall on the surface, sink a little and dissolve into amber ammonium glowing in
  the top soil.
- The flows (`soil_flow` 0..1, the amount; motion by `t`): amber particles drift through the soil; a share
  (`soil_plant`, 0.45 by default: "less than half") climbs the roots and turns green in the plant; the rest is handed
  through the relay (rose, then blue) and sinks out of the block's bottom as blue nitrate (leaching), and a few rise from
  the surface as lilac N2O wisps. `soil_inhibit` 0..1 slows the relay's first step: particles stay amber longer, more
  reach the roots, fewer leave as nitrate or N2O (the BNI halo and DCD both drive it; the shares are a drawing).
- The pore (`soil_pore` 0..1): a magnified bubble (about 0.6 across) grows out of the `pore` spot in the block while the
  block dims behind it: soil grains with water films, and the relay's microbes (`soil_relay` 0..4, eased: 1 archaea, 2
  ammonia-oxidising bacteria, 3 nitrite oxidisers, 4 comammox, each coming in with a glow) handing on glowing particles
  that change colour as they pass (amber to rose to blue; comammox amber straight to blue). Microbes as small lit
  capsules and rods (archaea round-ish, bacteria rods, Nitrospira curved), in the guilds' colours.
- The halo (`soil_halo` 0..1): a soft teal glow round the roots, seeping into the soil around them; inside it the relay
  slows (driven by `soil_inhibit`, which the story keys with it). `soil_dcd` 0..1: yellow DCD granules in the top soil
  (explore only).
- The chromosome (`soil_grass` 0..1: a wild grass plant beside the block, blue-green and taller; `soil_chrom` 0..1: two
  chromosomes float above, the grass's blue and the wheat's orange; a short segment lifts out of the blue one (to 0.5)
  and glides into the orange one (to 1), which glows; then the halo can begin).
- The tracer (`soil_tracer` 0..1, chapter 8): one white atom with a trail travels from a fertiliser grain through the
  soil, into a microbe (it pauses, flickers) and out, up a root into the leaf: "one marked atom" for isotope studies.
- `soil_cut` 0..1 (the cut-away; 0 a closed block), `soil_grow` 0..1 (the plant grows from a seedling), `soil_pick`
  (step: -1, or a guild 0..3 lit in the pore, for explore).
- Anchors (stub): `surface`, `ear`, `stem`, `roots`, `fert`, `nh4`, `no3`, `n2o`, `halo`, `pore`, `aoa`, `aob`, `nob`,
  `comammox`, `grass`, `chromGrass`, `chromWheat`, `segment`, `tracer` (a function: the atom's place).
- Labels (the set's own, by params): "Ammonium" (amber, with the fertiliser), "Nitrate · washes away" (at the bottom while
  it flows), "N2O · a greenhouse gas", "Taken up by the plant", in the pore "Archaea", "Bacteria", "Nitrite oxidisers",
  "Comammox · both steps", "BNI · from the roots" with the halo, "Wild grass · Leymus racemosus", "Wheat · Munal" with
  the chromosomes, "Illustration" in small type on the block (cls ''), once.
- Views (stub): `default`, `plant`, `roots`, `surface`, `pore`, `relay`, `chrom`, `tracer`.
- Explore (the Nitrogen sketch, labelled "a sketch, not data"): controls `view` (The block, The roots, A soil pore, The
  chromosome), `fert` (Spread, None), `wheat` (BNI wheat, Control wheat), `dcd` (None, DCD); the flows replay from `c.t`.

### `field` (builder A; chapters 4 and 5, under the cloud in 6 and 7; explore's Field)

- The 24 plots (`api().plotXZ(p)`: 4 blocks along z, the replicates, each with the 6 treatments in a seeded order: done
  in the stub), each a patch of soil edged in its regime's colour with a small sign of its line; the netting over the
  field on posts (`field_net` 0..1; the slide's photo shows plots under netting).
- The wheat (`field_grow` 0..1 from bare soil; `field_date` 0..4, eased): about 40 to 60 stems per plot, swaying (the
  flock's reeds: blades in a vertex shader on `uTime`), taller with the date (jointing, booting, heading with ears from
  date 2, grain filling, ripening with gold ears at date 4: the Zadoks stages in `design.times`), the leaves coloured by
  each plot's own chlorophyll at that date (`field_chl` 0..1; 0 a uniform green): `meta.chl.values` at T1 to T3 (days 1,
  15, 24), and at the last date (day 70) the slides' reading per group (`SDATA.chl70(fert, line)`, as the slides show
  it); the metadata's T4 chlorophyll is **not** used for day 53 (its values match the slides' day 70 for N and F, so
  they are day 70's; see `open`), so date 3 eases from day 24 to day 70 like the slides' lines; a plot without a value
  takes its group's mean. The control wheat yellowing without fertiliser at the end, the BNI wheat staying green, is the
  chapter's picture.
- Nitrate (`field_no3` 0..1): blue light seeping down under each plot into the slab, as deep and bright as the plot's
  measured nitrate at that date (`meta.no3.values`); a tag on a plot when picked. Ammonium (`field_nh4` 0..1): an amber
  glow in each plot's top soil by `meta.nh4.values`.
- The jars (`field_jars` 0..1; `field_jday` step 0..4, the date whose soil is in them, -1 all five rows; `field_inc`
  0..1, the incubation's time, 0 to 22 days): glass jars (TLOOK's glass and rings) on a bench, one per regime and line
  (six; thirty with all dates), each breathing a lilac N2O plume whose height and density follow the slides' curve
  (`SDATA.n2o(day, fert, line)` at the incubation time, eased between the ten readings), with its ppm as a tag at the
  plume's top (read off the slides: say so). The BNI jars of fertilised soil on days 1 to 24 breathe visibly less; the
  DCD jars hardly at all.
- The cores (`field_cores` 0..1: at each date a core lifts out of every plot that was sampled: 119, the missing one never
  lifts; `field_stack` 0..1: they fly into a stack of the design, the ovary's stacking movement: 3 regimes along x, 2 lines
  along z, 5 dates up, 4 cores each, with a tag "119 samples" and the date levels' days). A graph in passing.
- A module on the field (`field_module` step: -1, or a module 0..16; `field_mlit` 0..1): each plot glows in the module's
  colour as far as the module's score in that plot's sample at `field_date` (`SDATA.net.score(m, s)`, positive glowing,
  negative dark), so a fertiliser module lights the fertilised plots and a plot module lights one block.
- Picking (`field_pick` step: -1, or a group of plots `line * 3 + fert` (0..5), lit, the others dimmed; `field_tags`
  0..1 tags on the picked plots with the measure `field_show` step (0 chlorophyll, 1 ammonium, 2 nitrate, 3 N2O, 4 pH) at
  that date, from `meta`, with the group's mean and the other line's for comparison). `api()`: `plotXZ`, `pick(rc)` (a
  ray to a plot), `plotAt(p)`.
- `field_life` 0..1 (optional): the field life size round you in a headset (`stand` view; the muscle story's Stand
  inside). Only if time allows.
- Anchors (stub): `centre`, `field`, `net`, `under`, `jars`, `stack`, `bni`, `ctrl`, `cloud`; add `plot(p)` and `jar(i)`
  functions.
- Labels: the regimes at the block's head, "Munal-BNI" and "Munal-control" on two plots, the date ("Day 24 · heading and
  flowering"), the jars' ppm, "119 samples", a module's name when lit.
- Views (stub): `default`, `low`, `plots`, `under`, `jars`, `stack`, `cloud` (the field small under the cloud), `stand`.
- Explore (the Field pane): controls `view`, `date`, `show`, `line` (Both, BNI wheat, Control wheat), `fert` (All, or one
  regime).

### `net` (builder B; chapters 6 and 7; explore's Microbes and Network; in the field's frame)

Copied from the endotype story's `net` set and adapted: its deep cloud with a bright core and a faint shell, the glowing
seeds (here the nitrifiers), the module pulling out (here the whole network out of the core), the endotype colours (here
the modules), `net_focus` and picking; without the walkers, the heat and k.
- The cloud (`net_cloud` 0..1): the 20,000 kinds as points round (0, 1.3, 0): abundant ones in the core (by `ab` and
  `rank`), rare ones in a thick faint shell, coloured by phylum (`SLOOK.phylum`), sized by abundance, twinkling; a tag
  "about 100,000 kinds" (`src.kinds`) and "3,384 make 95 % of the reads" (`common.n`, `common.readShare`).
- The nitrifiers (`net_nitro` 0..1): the guilds' kinds flare in their colours, with tags (their kinds and shares, and
  "fertiliser roughly doubles Nitrosospira" from `guilds.nsp.byFert`).
- The network (`net_pull` 0..1: the 1,564 network kinds fly out of the core to their stored layout, scaled to radius
  about 0.6; `net_links` 0..1: the links fade in, rising-together pale cyan, the others faint red; `net_rho` 0.6..0.8: only
  the strongest links, `SDATA.net.cut(rho)`, a prefix; the nodes left without a link dim).
- The shuffle (`net_shuffle` 0..1): the links shiver and fade to nothing while the nodes scatter a little: "shuffled, not
  one link is left" (`net.null.links`), then come back as it returns to 0.
- The modules (`net_mods` 0..1): nodes and links take their module's colour; the five big ones get tags with their size
  and what they follow (`r2`: "follows the fertiliser", "follows the plots"); `net_focus` (step: -1, or a module 0..16,
  lit, the rest dimmed); the engine keys the field's `field_module` and `field_mlit` with it, so the plots light below.
- The split (`net_split` 0..1; `net_splitBy` step 0 line, 1 fertiliser, 2 random): the network divides into two (or
  three) copies side by side at x = -0.6 and 0.6 (three: -0.8, 0, 0.8), each showing only the links its half keeps (the
  `split` bits) with a tag of its own network's link count (`splits`), and for line the comparison with random halves
  ("8,377 apart; random halves 158 to 27,758").
- `net_kind` (step: -1, or a cloud index): one kind picked (by click or ray), its ring, its links lit, its phylum, name,
  guild, flags and abundance as a tag.
- Anchors (stub): `cloud`, `core`, `top`, `net`, `left`, `right`, `pick`; add `module(m)` (its middle).
- Views (stub): `default`, `cloud`, `core`, `net`, `module` (the network with the field below), `split`, `over`.
- Explore: controls `view` (The crowd, The network, Split), `colour` (Phylum, Module, Nitrifiers), `by` (Wheat line,
  Fertiliser, At random). `api()`: `pick(rc)`, `pos(i)`, `module(m)`.

### `web` (unchanged) and the hop (the engine's, done)

Chapter 4 opens on the globe facing Europe (`web_globe` 1, `web_net` 0, `web_ties` 0), turns east (`web_spin` towards
about -0.25) while the hop (`hop_a`, `hop_t` 0..1) draws its arc from Vienna to Japan, then the camera dives towards
Japan and the field fades in. `web_globe` must be 1 while the hop shows (it does not scale with the globe's growth).

## The engine (`tools/soil/engine/`, copied from the tissue topology story's; builder B)

Done: `e1_head.js` (header, `HOST.register('soil', ...)`), `e2_scene.js` (`SET_ORDER = ['soil', 'web', 'field', 'net']`,
`FRAME = { net: 'field' }`, the hop), in `e3_story.js` the chapters (`CH`), a placeholder `NARRATION_SYNC`, the engine's
defaults, `logMix`, `FACTS` (a start) and the credits, `XR_HERE = 'soil'`, the narration file `audio/narration-soil.mp3`.
Everything else story-specific is still the topo story's, marked `TODO(soil B)` where it stands: `buildStory` and the
story labels, `FIT`, `NARROW` and `LOW` (measure them), the stand view, explore's scenes, tabs, state, actions, panes
(HTML in `e4_explore.js`, canvas twins in `e6_panels.js`), picking, `APP.enterExplore`'s scene for a moment, `openStart`
and the hash. **Keep every shared line identical** (the headset code in `e5_xr.js`, the shared-room hooks, the slideshow,
`fitTitle`, the landing screen, the headset settings, the panels setting, captions, the loading step queue: AGENTS.md,
"Shared rooms" and "Inside a story"); before finishing, diff the shared parts against the then-current
`tools/topo/engine/` (another builder may change them meanwhile) and take their changes. `FACTS` holds every number the
text shows, from `SOIL_DATA`; none is typed in.

**Chapters** (about 7.5 minutes before pacing; `CH` keys and story times; the first key is `title`). Every chapter: one
or two plain sentences first, then the technical layer in smaller print. The text below is a draft: keep its meaning
and its plainness, shorten freely.

1. `title` 0-45, **Half the sack** (`soil`: the block, the plant, `soil_fert`, `soil_flow`). "Less than half of the
   fertiliser a farmer spreads ends up in the crop. Microbes in the soil turn much of it into nitrate, which washes
   away, and into nitrous oxide, a strong greenhouse gas. So farmers spread more." Small print: the slides' "less than
   50 %"; the flows in the block are a drawing; the authors and the group (credits in chapter 8).
2. `relay` 45-100, **The relay underground** (`soil_pore`, `soil_relay` 1 to 4). "Inside the soil, microbes pass the
   nitrogen on like a relay. Archaea and bacteria turn ammonium into nitrite; other bacteria turn nitrite into nitrate;
   one kind, comammox, does both. Each hand-off is a step in a network of processes." Small print: AOA, AOB, NOB,
   comammox; nitrification; the pore is an illustration.
3. `bni` 100-150, **A wheat that fights back** (`soil_grass`, `soil_chrom`, then `soil_halo` and `soil_inhibit`). "Some
   plants release substances from their roots that slow the relay down: biological nitrification inhibition, BNI.
   Breeders moved a piece of chromosome from a wild grass into the wheat Munal. Until now the evidence was one
   bacterium in a dish and one day in a field." Small print: *Leymus racemosus*, Munal-BNI, Subbarao et al., PNAS; the
   earlier evidence as the slides list it.
4. `trial` 150-210, **The field trial** (`web` and the hop, then `field`: `field_grow`, `field_net`, `field_date` 0 to
   4, `field_cores`, `field_stack`). "To test it, the two wheats grew side by side in Japan, with no fertiliser, with
   fertiliser, and with fertiliser plus a synthetic inhibitor. Five times over 70 days, soil was taken from the roots of
   every plot: 119 samples." Small print: JIRCAS; 250 kg N per hectare; DCD; the dates (days after planting, growth
   stages); four replicates; the rhizosphere; the plots' layout is illustrative; one sample is missing.
5. `leaks` 210-285, **Greener, fewer leaks** (`field_chl`, `field_no3`, `field_jars`, `field_inc`, tags). "At the end of
   the season the BNI wheat is still green where the control wheat yellows, most clearly without fertiliser. With
   fertiliser there is less nitrate under it in mid-season. And soil from its roots, given ammonium in a jar, gives off
   far less nitrous oxide, close to what the synthetic inhibitor achieves." Numbers: chlorophyll day 70 (`figs.chl70`,
   read off), nitrate day 24 (`meta.no3`), the N2O peaks on day 1 (`figs.n2o.peaks`, read off). Small print: SPAD; the
   incubations (250 mg N/kg, 70 % water, 20 to 22 days); **the N2O discrepancy** (Decisions); chlorophyll's dates.
6. `crowd` 285-340, **A crowd of 100,000** (`net`: `net_cloud`, `net_nitro`, over the field). "A spoonful of this soil
   holds about 100,000 kinds of microbe; 3,384 of them make up 95 % of the DNA read. Fertiliser roughly doubles one
   ammonia-eating bacterium. The wheat line changes nothing that can be measured: only 2 of the 3,384 kinds differ
   between the two wheats." Small print: 16S amplicons, kinds (ASVs) numbered; the guilds and their shares; the qPCR
   counts (read off: no major effect); differ: fertiliser 1,646, date 580, line 2.
7. `together` 340-415, **Who rises together** (`net_pull`, `net_links`, `net_shuffle`, `net_mods` with `field_module`,
   then `net_split`). "Link two microbes when their numbers rise and fall together across the samples: 1,564 kinds and
   22,348 links. Shuffle the samples and not one link is left, so the pattern is real. Its groups follow the fertiliser
   and the field's plots. Split by wheat line, the two networks differ no more than two random halves do. And rising
   together is not working together." Small print: CLR, Spearman, |rho| at least 0.6, q under 0.05, Louvain (about five
   big groups; the count depends on the run); built for this story, not the authors' analysis; thresholds; the residual
   networks.
8. `know` 415-460, **What we know** (`soil`: `soil_tracer`, the halo). "There are strong indications that the BNI wheat
   holds nitrogen in the soil, and it leaves the soil's microbes undisturbed. It is not yet proof. Next: following
   marked nitrogen atoms, and reading which microbial genes are switched on." Small print: isotope studies,
   metatranscriptomics; the open questions; the credits (authors, institutes, the PNAS paper; the data used with the
   authors' permission; what is illustrative).

**Explore mode** tabs (HTML and canvas twins, as every story):
- **Field**: the line, the regime and the date; the plots' tags for chlorophyll, ammonium, nitrate, N2O and pH (the
  group's mean, the other line's, the p of the season or the date); the jars for that date; the cores; small print on
  the N2O discrepancy and the chlorophyll's dates.
- **Nitrogen**: the soil block with three switches (fertiliser, the BNI trait, DCD), labelled "a sketch, not data".
- **Microbes**: the cloud by phylum or the nitrifiers, the guilds' shares by regime and line (numbers as tags on the
  cloud, a short table in the pane at most), one picked kind (click or ray).
- **Network**: pick a module (its size, phyla, top taxa, what it follows; the field lights below), the threshold (0.6 to
  0.8 drawn; the counts at 0.5 and 0.55 in words: 84,506 and 44,897 links, too many to draw), Shuffle, Split by wheat
  line, by fertiliser or at random.
- **Scenes**: Soil (`soil`), Globe (`web`), Field (`field`), Microbes (`net`).

`collab.state()`: the tab, the scene, every scene's controls, the module picked (`mod`, -1), the threshold (`rho`, to
0.01), the shuffle (`shuf`, 0 or 1), the kind picked (`kind`, -1), the plot group picked (`plot`, -1). Never the camera
or anything per device; `apply(state())` gives `state()` back. Suggested hashes: `#soil&t=100`,
`#soil&explore&tab=field&date=4&show=chl`, `#soil&explore&tab=nitrogen&wheat=bni&dcd=on`,
`#soil&explore&tab=microbes&colour=guild&kind=12`, `#soil&explore&tab=network&mod=3&rho=0.7`,
`#soil&explore&tab=network&split=line`, `#soil&explore&scene=web`, `&now=1` skips the glide.

Headset: no close view brings anything within 0.35 m of the eyes (the pore's bubble and the network at their close
views; `keepClear` if needed). In a shared room the story shares only the state above; the shuffle and the split are
state, not effects.

## Testing

- `node tools/soil/test-data.mjs` (a second) after the data or the decoders change; `node tools/soil/build.mjs --check`.
- A set alone: `node shot.mjs <set> "<query>|..." <prefix> 640 400` from `tools/soil` (serve the repository root on
  8123), e.g. `node shot.mjs field "p=field_date:4,field_chl:1&cam=low|p=field_jars:1,field_inc:0.4&cam=jars" f`.
- The story: `sweep.mjs` once the story is in `HOST.list` (the integrator), then the smoke test.
- Report headset behaviour (sizes, the pore's bubble, the life-size field) as untested.

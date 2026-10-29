# Set `soil`: the cut-away block (chapters 1, 2, 3 and 8; explore's Nitrogen sketch)

A block of soil, 1.2 wide (x), 0.8 deep (z), from its surface at y = 0 down to y = -0.7, with a wheat plant at the
origin (its awns' tips at about y = 0.83), its fibrous roots down to about y = -0.62 with fine root hairs, and stones on
the surface. **Everything in this set is illustrative** (a drawing, not data): the only number it stands for is the
slides' "less than half of the fertiliser ends up in the plant" (`soil_plant` 0.45 by default). Say so in the story
(the set's own label "Illustration" shows on the block once).

## Look

- The block's faces show the soil profile (dark humus, loam, a lighter subsoil, mottled, specks of sand). With
  `soil_cut` the faces **nearer the viewer** turn to glass with a pale edge line (whichever side that is, so it works
  from any angle in a headset), and seven in ten soil grains in front of the plant (z > 0) shrink away. The far faces
  stay solid, so the inside reads as a cut-away.
- The wheat: three tillers, four leaves each (green by `SLOOK.chl`), ears of spikelets with awns, swaying on `t`. The
  roots: 8 main roots, about 70 laterals and some second-order ones, cream with whiter tips; about 2,400 root hairs.
- The wild grass (*Leymus racemosus*, drawn): a clump of tall glaucous blue-green blades and three dense spikes on a
  mound beside the block (x = -0.86).
- All glows (ammonium, the flows, the halo, the relay's particles, N2O, the tracer) are one pool of soft additive
  points drawn **without depth test**, so the flows read through the grains of the cut-away block.

## Params

| Param | Range | Meaning | Suggested keys |
| --- | --- | --- | --- |
| `soil_a` | 0..1 | the set's fade (engine) | in for chapters 1 to 3 and 8 |
| `soil_grow` | 0..1 | the plant and roots grow from nothing (roots first, then stem, leaves bottom to top, ears from 0.62; hairs follow the roots) | 1 at rest; 0.2 to 1 over the first seconds of chapter 1 if wanted |
| `soil_cut` | 0..1 | 0 a closed block; 1 the near faces glass and the front grains thinned | 0 to 1 early in chapter 1 (2 s) |
| `soil_fert` | 0..1 | fertiliser grains fall (each from its own moment, 0 to 0.54), land, sink a little and dissolve (0.36 to 0.98) into amber ammonium glowing round them | 0 to 1 over about 6 s in chapter 1 |
| `soil_flow` | 0..1 | how many flow particles run (each with a short trail): a share (`soil_plant`) drifts to a root, climbs it as green and rises into the stem; about 12 % turns rose (nitrite) then rises out of the surface as lilac N2O wisps; the rest turns rose, then blue (nitrate) and sinks out of the block's bottom | 0 to 1 after the fertiliser; keep up through chapter 3 |
| `soil_plant` | 0..1 | the plant's share of the flows (a drawing of "less than half") | 0.45 |
| `soil_inhibit` | 0..1 | slows the relay's first step: particles stay amber longer, more reach the roots (plant share up to 0.45 + 0.55 x 0.55), fewer leave as N2O or nitrate; in the pore some particles bounce off the first microbes and stay amber | keyed with `soil_halo` in chapter 3 (0 to about 0.8); in explore BNI 0.6, DCD 0.8 |
| `soil_halo` | 0..1 | the BNI halo: a soft teal glow along the roots, seeping outwards | 0 to 1 in chapter 3 after the chromosome; 0.5 in chapter 8 |
| `soil_dcd` | 0..1 | yellow DCD granules in the top soil | explore only |
| `soil_pore` | 0..1 | a magnified pore grows out of the `pore` spot (a glass bubble, radius 0.3 at 1) while the block dims behind it; the block's grains, roots and glows inside the bubble's sphere are hidden | 0 to 1 at the start of chapter 2, back to 0 at its end |
| `soil_relay` | 0..4 | the relay's microbes come in one guild per step, each with a glow: 1 archaea (magenta, round), 2 ammonia-oxidising bacteria (coral and salmon rods), 3 nitrite oxidisers (Nitrospira, cyan, curved), 4 comammox (curved, cyan with an amber core); glowing particles are handed on, amber to rose to blue (comammox amber straight to blue) | 0, 1, 2, 3, 4 a few seconds apart while `soil_pore` is 1 (eased: each guild pops in with a little overshoot) |
| `soil_grass` | 0..1 | the wild grass grows beside the block | 0 to 1 at the start of chapter 3 |
| `soil_chrom` | 0..1 | the two chromosomes (the grass's blue, the wheat's orange: two banded sister chromatids each) grow in (to 0.12); the marked segment of the blue one glows and lifts out (0.12 to 0.5), its place thinning to threads; it glides in an arc, turning once, into the orange one (0.5 to 0.92), whose own piece thins as it arrives; the wheat's chromosome glows (0.9 to 1) | 0 to 1 over about 10 s in chapter 3, then the halo |
| `soil_tracer` | 0..1 | one white atom with a trail: from a fertiliser grain on the surface down through the soil (to 0.32), into a small coral rod-shaped microbe where it waits and flickers (0.32 to 0.5; the microbe glows), out to a root, up the root and the stem into a leaf (to 1) | 0 to 1 over about 12 s in chapter 8 |
| `soil_pick` | step, -1 or 0..3 | a guild lit in the pore (0 archaea, 1 bacteria, 2 nitrite oxidisers, 3 comammox), the others dimmed | -1; explore |

Step params: `soil_pick` only (already in the engine's `STEP`).

## Anchors

`surface` [0, 0, 0], `ear` (the highest awn tip), `stem` [0, 0.4, 0], `roots` [0.06, -0.2, 0.14], `uptake` (the stem
just above the surface: "Taken up"), `fert` [-0.25, 0.02, 0.15], `nh4` (in the top soil), `no3` (the block's bottom,
front right: where the nitrate leaves), `n2o` (above the surface, left), `halo` (beside the roots), `pore` [0.18, -0.28,
0.25] (the bubble's centre), `aoa`, `aob`, `nob`, `comammox` (functions: each guild's cluster in the bubble, as it is
now; at the pore spot while the bubble is shut), `grass` (the wild grass's middle), `chromGrass` (above the blue
chromosome), `chromWheat` (below the orange one), `segment` (function: the moving piece), `tracer` (function: the
atom), `corner` (the block's front left bottom corner, for "Illustration").

## Labels (the set's own)

"Ammonium · from the fertiliser" (amb), "Nitrate · washes away" (cyn), "N2O · a greenhouse gas" (mag), "Taken up · by the
plant" (grn), in the pore "Archaea" (mag), "Bacteria" (amb), "Nitrite oxidisers" (cyn), "Comammox · both steps" (cyn),
"BNI · from the roots" (cyn), "Wild grass · Leymus racemosus" (grn), "Wheat · Munal" (amb), "BNI trait · a piece of
chromosome" (cyn, while the segment moves), "One marked atom · followed" (with the tracer), "Illustration" (minor, on the
block while it is cut open). The block's labels give way while the pore is open; at most about five show at once.

## Views

`default` [-28, 18, 3.2, 0, 0.05, 0] (the block and the plant), `plant` (the shoot), `roots` (low, the roots and the
halo), `surface` (from above: fertiliser, ammonium, N2O), `pore` [-10, 6, 1.5] and `relay` [0, 4, 1.2] (the bubble
fills most of the view), `chrom` (the grass, the wheat and the chromosomes above them), `tracer`.

## Explore (the Nitrogen sketch: "a sketch, not data")

Controls `view` (The block, The roots, A soil pore, The chromosome), `fert` (Spread, None: a trickle of flows stays),
`wheat` (BNI wheat: the halo and inhibit 0.6; Control wheat), `dcd` (None, DCD: granules and inhibit 0.8; both together
inhibit 1). The fertiliser falls again and the flows build up from `c.t`.

`api()`: `pick(rc)` (a ray to a microbe in the pore while it shows: `{ kind: 'guild', g }`), `guildAt(g)`, `tracer()`.

## Cost (headless Chromium, software GL)

Build 60 to 150 ms. 6 draw calls with the block alone, 7 with the chromosomes or the tracer, 9 with the pore open; 81k
to 92k triangles; up to about 1,400 glow points and 2,300 hair lines. Nothing is allocated in `update` (the flows and
the relay write into kept arrays; the grains, fertiliser and DCD move in their shader).

## Say / never say

- The flows' shares are a drawing; only "less than half reaches the plant" is the slides'.
- The relay: archaea and bacteria turn ammonium into nitrite, nitrite oxidisers turn nitrite into nitrate, comammox does
  both; N2O comes off along the way (a drawing: the wisps rise from the relay's particles).
- BNI: compounds from the roots slow the relay (biological nitrification inhibition). The chromosome segment came from
  the wild grass *Leymus racemosus* into the wheat Munal (Subbarao et al., PNAS); the picture is a drawing.
- The tracer is what isotope studies would do next ("one marked atom"): not a result.

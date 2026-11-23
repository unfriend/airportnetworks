# Set `field`: the field trial (chapters 4 and 5, under the cloud in 6 and 7; explore's Field)

The trial's 24 plots on the x-z plane at y = 0 (about 1.8 by 1.2), a soil slab under them to y = -0.25, the wheat up to
about y = 0.3 when ripe, netting at y = 0.42 on posts, jars on a bench to the right (x = 1.3), and the stack of soil
cores behind (z = -0.95, up to y = 0.75). The `net` set draws in this frame, over the field.

**Real** (SOIL_DATA through SDATA): each plot's chlorophyll on days 1, 15 and 24 (`meta.chl.values`), its ammonium and
nitrate on all five dates (`meta.nh4`, `meta.no3`; the missing sample takes its group's mean), the tags' values, means
and p values (`meta`, `lineTest`), the 119 cores in the design's 30 groups, a module's score in each plot's sample
(`net.mods[m].score`). **Read off the slides** (approximate, say so): the day-70 chlorophyll per regime and line
(`chl70`), the jars' N2O curves (`n2o`). **Illustrative**: the plots' layout (four blocks of six in a seeded order: the
real map is not known), the wheat's look (its height and stage by the Zadoks stages of `design.times`; only its leaf
colour is data), the netting, the jars and bench, the plumes' shape, the light columns' depth.

## Look

- Plots: tilled soil in drilled rows, edged in the regime's colour (not fertilised green, fertilised purple, + DCD
  yellow), a small sign at the front in the wheat line's colour (BNI teal, control orange); mown paths between.
- Wheat: 50 stems per plot (1,200; the flock's swaying blades grown into a stalk, two leaves and an ear), swaying on
  `t`. Height by date (jointing 0.13, booting 0.2, heading 0.27, then 0.285), ears from date 1.4 to 2 (out of the flag
  leaf), gold and nodding from date 3.1 to 4. Leaves by `SLOOK.chl(spad)` of the plot at the date (straw yellow at 45,
  deep green at 65). Day 53 has no chlorophyll reading (the metadata's T4 is day 70's, `SOIL_DATA.open`): it lies on the
  line from day 24 to day 70, as the slides draw it. On day 70 each plot takes its group's reading off the slides.
- The slab's near sides turn to glass while the nitrate shows (as the soil block's).

## Params

| Param | Range | Meaning | Suggested keys |
| --- | --- | --- | --- |
| `field_a` | 0..1 | the set's fade (engine) | chapters 4 to 7 |
| `field_grow` | 0..1 | the wheat grows from bare soil (each stem staggered) | 0 to 1 early in chapter 4 |
| `field_date` | 0..4, eased | the sampling date: days 1, 15, 24, 53, 70 | 0 to 4 through chapter 4 (with the cores), 4 in chapter 5 for the colour, 2 for nitrate |
| `field_net` | 0..1 | the netting, drawn across from left to right; its posts rise first | 0 to 1 with the field |
| `field_chl` | 0..1 | 0 a uniform green; 1 each plot's leaves by its chlorophyll at the date | 1 in chapter 5 (and after) |
| `field_nh4` | 0..1 | each plot's top soil glows amber with its ammonium at the date (sparkles too) | explore (Show: Ammonium) |
| `field_no3` | 0..1 | blue light seeps down under each plot into the slab, as deep and bright as its nitrate at the date, with drops falling; the slab's near sides turn to glass | 1 in chapter 5 at date 2 (day 24: BNI 39.9 against control 60.9 mg N/kg in fertilised soil) |
| `field_jars` | 0..1 | the bench and the jars (one per regime and line: six, or thirty) | 1 in chapter 5 |
| `field_jday` | step, -1..4 | the date whose soil is in the jars; -1 all five dates in rows (front to back along x) | 0 (day 1: fertilised BNI about 0.4 against 1.3 ppm) |
| `field_inc` | 0..1 | the incubation's time, 0 to 22 days: each jar's lilac plume as high (0.2 per ppm) and dense as its curve says, with its ppm as a tag (six jars) | 0 to 1 over about 8 s |
| `field_cores` | 0..1 | at each date a core lifts out of every plot sampled (date k from k/5): 119, the missing one never lifts | 0 to 1 with `field_date` 0 to 4 |
| `field_stack` | 0..1 | the cores fly in arcs into the stack of the design (3 regimes along x, the two lines front and back, 5 dates up, 4 cores each), each with a band in its regime's colour and a cap in its line's | 0 to 1 at the end of chapter 4 |
| `field_module` | step, -1..16 | a module of the network | the engine keys it with `net_focus` |
| `field_mlit` | 0..1 | each plot glows in the module's colour as far as the module's score in its sample at `field_date` (negative: darker), and light rises from the plot towards the cloud as high as the score | 1 with the module |
| `field_pick` | step, -1..5 | a group of plots `line * 3 + fert` lit, the others dimmed | explore |
| `field_tags` | 0..1 | tags on the picked group's four plots: the measure `field_show` at the date, and the group's mean against the other line's, with the p of that date | explore |
| `field_show` | step, 0..4 | 0 chlorophyll, 1 ammonium, 2 nitrate, 3 N2O (the metadata's potential, unit not given), 4 pH | explore |
| `field_line` | step, -1, 0, 1 | **new**: only one wheat line's plots lit (-1 both) | explore; **add to the engine's `STEP`** |
| `field_fert` | step, -1..2 | **new**: only one regime's plots lit (-1 all) | explore; **add to the engine's `STEP`** |
| `field_life` | 0..1 | not built (the life-size field was optional): no effect | |

Step params: `field_jday`, `field_module`, `field_pick`, `field_show` (in the engine's `STEP`), and `field_line`,
`field_fert` (to add). The set rounds them, but easing them would flash other plots for a moment.

## Anchors

`centre`, `field` [0, 0.35, 0], `net` [0, 0.42, 0], `under` [0, -0.2, 0.45], `jars` [1.3, 0.12, 0], `stack` [0, 0.75,
-0.95], `bni` and `ctrl` (the unfertilised BNI and control plots of the front block), `cloud` [0, 1.3, 0], `pick` (the
middle of the picked group's plots), `lit` (the middle of the plots a module lights, weighted by its score).

## Labels (the set's own)

The date ("Day 24 · heading and flowering", at the back left post); the regimes ("Not fertilised", "Fertilised · 250 kg
N/ha", "Fertilised + DCD · an inhibitor", minor) at the front block until the colour comes; "Munal-BNI" and
"Munal-control" with the colour; a picked group's four values and its summary ("Nitrate, day 24: 39.9 mg N/kg · control
60.9, p 0.03"; day 70's chlorophyll "about 62 · control about 49, read off the slides"; "not measured" where there is
none, as pH on days 15 and 70); the jars ("Day 1 soil in jars · N2O on incubation day 10 (read off the slides)") and six
ppm tags; "119 samples · 30 groups of 4, one missing", "Day 1" and "Day 70" on the stack; "Module 1 is strong here · its
plots light up" (the net set names the module itself). Labels read `S.net_cloud` to give way under the cloud.

## Views

`default` [-24, 30, 4.2, 0, 0.05, 0], `low` (among the wheat, day 70's colours), `plots` (from above, for tags), `under`
(the slab's side, the nitrate), `jars` [52, 14, 1.75, 1.3, 0.17, 0] (from the bench's side, the field behind), `stack`,
`cloud` (the field small under the cloud), `stand` (eye level at the front plots).

## Explore (the Field pane)

Controls `view` (The field, Among the wheat, Under the field, The jars, The samples), `date` (day 1 to 70), `show`
(Chlorophyll, Ammonium, Nitrate, N2O, pH: ammonium lights the plots, nitrate the slab, N2O brings the jars of that date
breathing from `c.t`), `line` (Both, BNI wheat, Control wheat), `fert` (All, or one regime). A line and a regime picked
together pick that group (`field_pick`, tags on).

`api()`: `plotXZ(p)`, `order`, `pick(rc)` (a ray to a plot: `{ kind: 'plot', p, group, line, fert, rep }`), `plotAt(p)`
and `plot(p)` (its centre), `jar(i)` (a jar's plume top), `ppm(time, fert, line, tau)`, `chlAt(p, date)`, `value(key, p,
time)`, `mod(m)` (a module's name and what it follows).

## Cost (headless Chromium, software GL)

Build 50 to 150 ms. 7 draw calls (field and wheat), 8 with the glows, 9 with the jars; 47k triangles (62k with all
thirty jars and the cores); the netting 2,078 lines; up to about 600 glow points. With the net set over it, 14 calls in
all. Per frame: 24 plot uniforms, a few dozen instance matrices (posts, bench), the glows; the cores and the wheat move
in their shaders.

## Say / never say

- The plots' layout is illustrative (the real map is not known); four blocks are the four replicates.
- The day-70 chlorophyll and the jars' N2O are read off the slides (approximate). The metadata's N2O (one number per
  sample, "potential", unit not given) and the slides' incubations disagree (fertilised soil over the season 0.81
  against 0.98, p = 0.58, against up to about 3-fold less in the jars): an open question; the tags say which is which.
- A module lighting the plots shows where its kinds are abundant together: rising together, not working together.

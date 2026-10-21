# `people` - one scan, one network; then the people on its index (sets/people.js)

The poster's next step after the paper: **one network per scan**. Panels 3 and 4 of the poster (one person's organ
uptakes, their ratios, a threshold, the network, its two measures) and then its results, as group summaries only (the
metabolic displacement index across 593 people, survival by the index's thirds, the immunotherapy test, follow-up).
Everything is built once at load; `update` sets uniforms, a few dozen instances and, when a value's text changes, one
small readout canvas.

## What it shows

**One scan** (around the origin, 1 unit about a metre of the set's own drawing, the viewer at +z):

- **Bars** (`people_bars`): a dark panel as on the poster's panel 3: icon and name on the left, then a bar per organ on
  a track with an SUV scale 0 to 5 ("mean SUV"), in the organs' colours. The seven organs and their order are
  `PET_DATA.single.organs`: liver, aorta, spleen, pancreas, kidneys, fat, muscle. At first the panel is in the middle;
  as the network forms it moves to the left, turns a little and shrinks.
- **Ratio field** (`people_ratio`): a 7 x 7 floor of cells below the ring (rows: the numerator organ i, icons on the
  left edge; columns: the denominator j, icons on the front edge). Column (i, j) rises to `ln(u_i / u_j)` when positive
  (0.3 units per ln unit, at most 0.98): organ i outshines organ j. Nothing on the diagonal (a dim cell in the organ's
  colour) or where negative. Columns rise in a wave from the back-left corner.
- **Threshold** (`people_thresh`): a cyan glass plane rises to `ln(theta)` (theta = `people_theta`, 2 by default).
  Columns above it light up (their tops glow, brighter the stronger the link), those below dim.
- **The network** (`people_one`): the lit columns fly up as comets to a ring of seven nodes above the field (discs with
  the organs' icons, a cyan dotted ring, tilted 12 degrees back) and become directed links: glowing tubes bowed towards
  the viewer (i -> j and j -> i on their own sides), coloured from i's colour towards white at j, with three comets
  each flowing from i to j. Every link's weight is `e = sigmoid((ln(u_i / u_j) - ln theta) / soft)` (soft 0.08), so
  everything changes smoothly with the uptakes and theta. The ring reads as the poster's example network: kidneys on
  the right, aorta and pancreas above, liver and spleen left, fat and muscle below.
- **The two measures and the index** (`people_metrics`), as on the poster's panel 4, on three dark dials to the right
  of the ring:
  - **Clearance** (the kidneys' outgoing links): the kidneys' links brighten and thicken into a star, a pulsing halo
    on the kidneys, and a gauge 0 to 1 with the value (mean of e(kidneys -> j) over the other six);
  - **Heterogeneity**: node sizes follow strength (sum of in and out weights); a hub (strength z-score above 1.7)
    glows orange-yellow `#ffb020` and pulses; a gauge 0 to 0.6 with the Gini coefficient of the strengths;
  - **the displacement index** on a 0 to 10 dial: `MDI = m + a C + b H` (`single.proj`), clamped to 0..10; the
    poster's dashed values (3.22 and 6.69) as dashed ticks with the ranges outside them shaded, and the four groups'
    medians as coloured dots round the rim. Each readout (C, H to two decimals, the index to one) shows with its own
    dial.
- **Profiles** (`people_profile` 0..3, fractional values blend the uptakes): healthy (the poster's example bars),
  cancer, cancer + dyslipidaemia, dyslipidaemia; or custom uptakes (`people_custom` 1 with `people_u0..6`, mean SUV,
  clamped 0.1 to 5). Bars, columns, plane, links, node sizes, hub, gauges and the index all follow at every frame.

The maths is exactly that of `tools/pet/data/gen_data.mjs` (`oneScan`): `api().measure` gives C, H and the index of
`PET_DATA.single.profiles` to the printed digits (checked: healthy 0.597 / 0.206 / 4.63, cancer 0.365 / 0.299 / 3.23,
both 0.487 / 0.238 / 3.98, dys 0.664 / 0.173 / 5.04). The healthy profile at theta 2 has 10 links: all eight of the
poster's example network (`poster.creation.example`: kidneys-fat, kidneys-muscle, liver-fat, aorta-kidneys, aorta-fat,
liver-muscle, pancreas-fat, spleen-fat) plus spleen -> muscle and kidneys -> pancreas. Its hub is fat (on the poster
fat is the orange node). Cancer: 5 links; both: 9; dyslipidaemia: 11.

**The population** (in the same place as the one-scan part, which gives way by itself as `people_map` rises):

- **Map** (`people_map`): 593 stand-in dots (cancer 282, cancer + dyslipidaemia 187, dyslipidaemia 89, healthy 35: the
  poster's strip) rise out of the one-scan ring, which shrinks into this person's dot (a white-ringed dot in its
  profile's colour, label "This scan"). Clearance across, Heterogeneity up (axis titles on the frame, no numbers: the
  stand-in measures have no units to show), the poster's legend at the top right. **Lines of equal index** (faint amber,
  tilted) cross the map: the index weighs both measures, and the map is scaled so every line meets the bottom axis at
  its index. Each dot is a tiny glowing point; close up (a point over about 16 to 30 pixels, as in a headset) it turns
  into its person's 7-node mini network (the kidneys' spokes by Clearance, one node grown by Heterogeneity).
- **Strip** (`people_mdi`): the lines straighten, the axis gets its ticks (0 to the poster's 10.7) and the dots drop
  into four rows in the poster's order from the top (dyslipidaemia, healthy, cancer + dyslipidaemia, cancer), sliding
  only a little sideways: the strip just sorts the map into rows. Each row: its p10-p90 whisker, the interquartile bar
  (the poster's error bar) and the median as the big dot; the poster's dashed lines (3.22, 6.69) and shaded ranges
  outside them; the names with n glide from the legend to the rows' right ends. Axis label "Metabolic displacement
  index". This person's dot goes to its profile's row at its own index.
- **Groups** (`people_group` 1..4: cancer, cancer + dyslipidaemia, dyslipidaemia, healthy; 0 none): that group glows
  (dots, summary, label), the others dim to about a fifth.
- **Survival** (`people_km`): a panel to the left, turned towards the middle: the three thirds of the index (near
  healthy `#38bdf8`, intermediate `#a78bfa`, remote `#d9dde6`) as stepped glowing ribbons drawn left to right over 0 to
  140 months with their translucent confidence bands, axes with ticks (0.2 steps, 20 months), the legend with n (137,
  136, 137), and the poster's table inside the chart (deaths 38 %, 49 %, 68 %; 1-year survival 80 %, 84 %, 63 %; median
  not reached, 79 and 27 months). The curves follow `poster.km` (read off the poster every 5 months); between two
  readings a drop is drawn as a couple of small steps, the last drop as one step at the curve's end (near healthy ends
  at 73 months, remote at 113, intermediate falls to 0 at 135). The strip dims meanwhile.
- **Immunotherapy** (`people_response`): a panel to the right: the 19 people as two **summary bands** on the index axis
  (0 to 6.85 with the poster's dashed lines at 3.16 and 6.63): good response n = 14 (min to max 3.40 to 4.68, the
  quartiles 3.84 to 4.42, the median 4.11 marked) and poor response n = 5 (4.27 to 5.51, median 4.85): no single
  points. Below, the AUC bars from the top down: the three network measures in amber (index 0.914, Heterogeneity 0.771,
  Clearance 0.743), the clinical ones in grey (CRP 0.671, tumour stage 0.586, age 0.55), each with its AUC and P value
  as a label, the axis 0.5 to 1.0 and the dashed chance line at 0.5.
- **Follow-up** (`people_follow`, illustrative): the poster's three follow-up groups as rings on the row of the people
  they come from: no intervention (47, on the healthy row: beside the healthy volunteers in the poster's table),
  bariatric surgery (18, on the dyslipidaemia row: beside the people with obesity), immunotherapy before surgery (19,
  on the cancer row: people with lung cancer). Their values are drawn from their row's summary (the poster gives no
  follow-up values). Surgery and immunotherapy glide 70 % of the way towards a value from the healthy range, turning
  healthy blue and leaving faint trails; no intervention stays. The healthy interquartile range lights up as a band
  ("Healthy range"); the other dots dim; the row labels give way to the follow-up groups' labels.

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `people_a` | 0..1, 1 | fade (applied by the engine) |
| `people_bars` | 0..1, 1 | the uptake bars grow in, organ by organ |
| `people_ratio` | 0..1, 1 | the ratio columns rise (a wave from the back-left corner) |
| `people_thresh` | 0..1, 1 | the threshold plane rises to ln(theta); columns above it light up |
| `people_one` | 0..1, 1 | lit columns fly up and become the ring's directed links; the bars move to the left |
| `people_metrics` | 0..1, 1 | Clearance (0 to 0.45), Heterogeneity (0.25 to 0.7), the index (0.5 to 0.95) in turn |
| `people_profile` | 0..3, 0 | 0 healthy, 1 cancer, 2 cancer + dyslipidaemia, 3 dyslipidaemia; fractions blend uptakes |
| `people_custom` | 0..1, 0 | 1: the custom uptakes below instead of the profile (blends in between) |
| `people_u0` .. `people_u6` | 0.1..5, the healthy profile | custom mean SUVs in `single.organs` order |
| `people_theta` | 1.01..10, 2 | the threshold ratio (explore offers 1.1 to 3) |
| `people_map` | 0..1, 0 | the people rise onto the map; the one-scan part (bars, field, plane, gauges, labels) gives way by itself and the ring shrinks into this person's dot whatever the other params do |
| `people_mdi` | 0..1, 0 | the map becomes the strip plot (needs `people_map` 1) |
| `people_group` | 0..4, 0 | highlight a group (1 cancer, 2 cancer + dyslipidaemia, 3 dyslipidaemia, 4 healthy) |
| `people_km` | 0..1, 0 | survival by thirds: panel, then the curves drawn left to right, then the labels |
| `people_response` | 0..1, 0 | immunotherapy: panel and bands (0 to 0.3), then the AUC bars top to bottom (0.3 to 0.95) |
| `people_follow` | 0..1, 0 | follow-up rings glide towards the healthy range (needs `people_mdi` 1) |

With every param at its default the set shows the whole one-scan part (healthy profile, all measures on).

Suggested keyframes (the engine's chapters `one` 218-258 and `people` 258-305 already do this):
- one: `people_bars` 0 -> 1 over 3 s; `people_ratio` 0 -> 1 over 4 s; `people_thresh` 0 -> 1 over 3 s; `people_one`
  0 -> 1 over 5 s; `people_metrics` 0 -> 1 over 4 s; then `people_profile` 0, 1, 1, 3 (healthy -> cancer ->
  dyslipidaemia, through cancer + dyslipidaemia) so the gauges and the index move. Cams `one` -> `field` -> `one` ->
  `metrics`.
- people: `people_map` 0 -> 1 over 5 s (the one-scan params may ramp to 0 meanwhile or stay: either works);
  `people_mdi` 0 -> 1 over 5 s; `people_group` 1, 2, 3, 4 in turn (2 to 3 s each), back to 0; `people_km` 0 -> 1 over
  4 s and out; `people_response` 0 -> 1 over 4 s and out; `people_follow` 0 -> 1 over 4 s. Cams `map` -> `strip` ->
  `km` -> `auc` -> `strip`.

## Anchors

All in the set's frame; functions return the same array each call and follow what moves.

- One scan: `one` (the ring's centre), `profile` (above the ring, left: the profile label), `bars` (the bar panel's top
  left), `bar_<id>` (the end of each organ's bar track), `field` (the ratio floor's centre), `example` (the top of the
  kidneys ÷ fat column), `plane` (the threshold plane's front corner, at its height), `metrics` (the dials' middle),
  `clearance`, `hetero`, `dial` (the gauges' labels), `note` (under the index dial), and each of the seven organ ids
  `liver aorta spleen pancreas kidneys fat muscle` (its node on the ring).
- People: `map` (the frame's centre), `mapNote` (above the frame, left), `iso` (the top of the line of index 2),
  `strip` (the strip's middle), `axis` (under the index axis), `person` (this scan's dot), `g1` .. `g4` (each group's
  centre: on the map the mean of its dots, on the strip its median dot), `lab_g1` .. `lab_g4` (the groups' names:
  legend, then the rows' ends), `healthy` (the top of the healthy range band), `f1` .. `f3` (the follow-up groups'
  labels at their rows' ends).
- Survival and immunotherapy: `km` (the chart's centre), `km1` .. `km3` (the legend's three lines), `auc` (the
  panel's centre), `good`, `poor` (the right ends of the two bands), `auc1` .. `auc6` (the end of each AUC bar, in
  `poster.prognosis.auc` order).

## Labels (49 entries; at most eight show at once)

- Organ names on the ring's nodes with `people_one` (six of them `minor`: they give way on narrow screens; the
  kidneys' does not); with `people_metrics` only the kidneys' and the hub's ("Fat · the hub", amber) stay.
- "Uptake · one scan" (bars), "Kidneys ÷ fat · one ratio" (amber, with the field), "Threshold" (cyan, at the plane).
- The profile: "Healthy / Cancer / Cancer + dyslipidaemia / Dyslipidaemia · illustrative uptakes", or "Your uptakes".
- "Clearance", "Heterogeneity", "Displacement index · 0 to 10" (amber), "Illustrative maths · formulas not yet
  published".
- Groups with n ("Cancer · n = 282" ...), "593 people · stand-in dots, group summaries", "Lines of equal index",
  "This scan", "Metabolic displacement index".
- "Near healthy · n = 137", "Intermediate · n = 136", "Remote · n = 137".
- "Good response · n = 14", "Poor response · n = 5", "AUC 0.914 · P = 0.061" ... "AUC 0.55 · P = 0.973" (amber for the
  network measures).
- "No intervention · n = 47", "Bariatric surgery · n = 18", "Immunotherapy before surgery · n = 19", "Healthy range".

Counted at the main states: bars 1, field 2, threshold 3, network 8, measures 7, map 7, strip 5, survival 3,
immunotherapy 8, follow-up 5.

Text drawn on objects (canvas textures, part of the charts): the bar panel's names and SUV scale; the dials'
readouts; the map's axis titles; the strip's numbers; the survival chart's title, axes and the poster's table; the
immunotherapy panel's title, axes, the measures' names and captions.

## Cam views

Framed for the scene's share of a wide screen (about 1.3 : 1, the panel on the left), labels included.

| View | `[az, el, dist, tx, ty, tz]` | Shows |
| --- | --- | --- |
| `default` | `[-4, 14, 5.0, 0.1, 0.12, 0.1]` | the whole one-scan part: bars, ring, field and the dials |
| `one` | `[-4, 15, 4.0, -0.36, 0.12, 0.1]` | bars, the ring of seven and the field |
| `field` | `[-24, 34, 2.7, 0.05, -0.47, 0.3]` | the ratio columns and the threshold plane from above |
| `metrics` | `[-20, 8, 3.1, 0.55, 0.3, 0.1]` | the ring and the three dials |
| `map` | `[0, 5, 4.1, -0.03, 0.24, 0]` | the map (and the strip: the same frame) |
| `strip` | `[0, 4, 4.1, -0.03, 0.2, 0]` | the strip plot, follow-up |
| `km` | `[30, 4, 2.75, -2.36, 0.24, 0.5]` | the survival panel |
| `auc` | `[-30, 4, 2.95, 2.4, 0.2, 0.5]` | the immunotherapy panel |

## Controls (explore)

- View: One scan (`one`), Ratios (`field`), People (`map`), Index (`strip`), Survival (`km`), Immunotherapy (`auc`).
  One scan: everything of the one-scan part on; Ratios: bars, field and plane, no network or dials; People: the map;
  Index: the strip; Survival and Immunotherapy: the strip with that panel. `people_follow` stays 0 in explore.
- Profile: Healthy, Cancer, Cancer + dyslipidaemia, Dyslipidaemia (`people_profile` 0..3).

The engine sets `people_custom`, `people_u0..6`, `people_theta` and `people_group` from its One scan and People tabs.

## Explore API: `set.api()`

- `measure(u, theta)` -> `{ e (7 x 7 link weights, e[i][j] for i -> j), s (strengths: in + out), C, H, mdi }`: the
  maths the set draws (u in `organs` order; theta defaults to 2).
- `organs`: the seven ids; `profiles`: `['healthy', 'cancer', 'both', 'dys']` (the order of `people_profile`);
  `groups`: `['cancer', 'both', 'dys', 'healthy']` (the order of `people_group` 1..4, as `poster.mdi.groups`).
- `pick(raycaster)` -> `{ organ: id }` (a node on the ring, a bar row, a header of the field; only what is shown),
  `{ group: 1..4 }` (on the map the nearest group centre within 0.3; on the strip the row), or null.
- `current()` -> `{ u, theta, C, H, mdi, links (weights over 0.5), hub (id or null) }` of the last frame.
- `dots` (593), `followUp` (84), `summary()` -> the stand-in dots' quantiles per group, their Clearance and
  Heterogeneity ranges and the follow-up rings' values (for checks).

## For the narrator and panel

May say:
- One scan, one network: each organ's uptake divided by each other's; where one organ outshines another by more than
  a threshold (here twice as much), a link from it to the other.
- Clearance: how strongly the kidneys outshine the other organs (how they handle the tracer). Heterogeneity: whether
  a few organs dominate the network (high) or it is even (low). The index combines the two into one number.
- In this illustration the healthy scan's index is 4.6, the cancer profile's 3.2, cancer + dyslipidaemia 4.0 and
  dyslipidaemia 5.0, close to the poster's groups' medians (healthy 4.51, cancer 3.29, cancer + dyslipidaemia 3.92,
  dyslipidaemia 5.16). Cancer lies low, dyslipidaemia high, healthy people between.
- 593 people on the poster's strip: cancer 282, cancer + dyslipidaemia 187, dyslipidaemia 89, healthy 35.
- Survival by the index's thirds (137, 136, 137 people): median not reached, 79 and 27 months; 1-year survival 80 %,
  84 % and 63 %; deaths 38 %, 49 %, 68 %. The third most remote from the healthy range lived shortest.
- In 19 people with lung cancer given immunotherapy before surgery, the index told good (14) from poor (5)
  responders with an AUC of 0.914, better than CRP (0.671), tumour stage (0.586) or age (0.55). A first test in few
  people: none of the P values is below 0.05 (0.061 for the index).
- After surgery and immunotherapy the index moved towards the healthy range (the poster's statement; the drawing is
  illustrative).

Must not say:
- That the formulas, the profiles, the map's positions or the follow-up movements are the poster's: the poster names
  Clearance, Heterogeneity and the index but has not published the formulas; the four profiles are illustrative
  uptakes, with the formulas' weights fitted so their index lands near the groups' medians; the dots are stand-ins drawn to match each group's
  summary; the follow-up groups' values are not on the poster.
- That any dot is a patient, or read single values off the dots. Only the group summaries (n, medians, quartiles,
  percentiles, min and max) are the poster's.
- That the index's thirds are the four groups, or that the thirds' curves belong to the groups: the thirds split
  people by their index (the people of the survival analysis, 410 in all).
- That the immunotherapy result is significant or proven.
- Uptake values as clinical reference ranges.

## Data used

`PET_DATA.single` (organs, theta, soft, proj, profiles), `PET_DATA.organs` (names, colours), `PET_ICONS`,
`PET_DATA.poster`: `mdi` (axis, dashed, shaded, order, groups with n, centre, err, q, min, max), `km` (curves, table),
`prognosis` (n, strip: axis, dashed, good and bad summaries; auc; chance), `cohort.followup` (groups and n). Every
reading is optional: a missing one leaves its part out (checked with the poster's readings removed, the km and
prognosis removed, the quantiles removed and the profiles removed: no errors).

## Performance (headless Chromium, SwiftShader, 4 CPUs shared with other agents)

- Build 25-70 ms. Draw calls 20-26 depending on the state (under 100); 10.3k-12.5k triangles; 1,471 points (the 593
  dots and 84 rings in one draw, 756 comets in one, 28 icons in three, 8 halos, this person's dot); 249-314 line
  segments.
- Instanced: the 49 columns (one InstancedMesh), the rounded panels, bars and summary pills (instanced quads with an
  SDF shader), the dots and rings (one Points draw, morphing map -> strip -> follow-up in the vertex shader). The 42
  link tubes are one merged mesh (about 10k triangles) whose per-link weights are packed uniforms.
- Per frame: 49 column colours and flight values, 49 instance matrices only when the uptakes or the field's rise
  change, seven nodes, a few dozen pills, the lines of equal index only while they straighten, and a 1024-pixel
  readout canvas only when a readout's text changes. No textures rebuilt otherwise.

## Implementation notes

- Uptakes: `people_profile` blends the profiles piecewise (0 -> 1 -> 2 -> 3); `people_custom` blends towards the custom
  values. The ratio field's columns use the raw log ratio; the links use the smooth weight, so a column just under the
  plane has a faint link.
- The stand-in dots: each group's index values come from its quantiles (min, p10, p25, median, p75, p90, max; or a
  normal spread from its error bar when they are missing), stratified so the summary is met (generated quantiles
  within about 0.1 of the poster's). Each dot's Heterogeneity follows a straight line through the four profiles
  (falling as the index rises) with a spread (sd 0.06), and its Clearance then gives its index exactly. A few dots at
  the ends of the index (below about 1.5 or above about 7) need a Clearance outside 0..1 under the stand-in formulas
  (whose index cannot reach the poster's whole range); the map has no numbers, so this does not show.
- The map's x is linear in Clearance, scaled so that a line of equal index meets the axis at that index; the strip's
  x is the index. So the map -> strip morph moves each dot mostly down into its row.
- The survival bands and curves are stepped ribbons revealed by month in the fragment shader (drawn double-sided:
  their vertical pieces face the other way).
- The one-scan part fades with `people_map` (0 to 0.5) on its own, and the ring stays formed (`max(people_one,
  people_map)`) while it shrinks into the person's dot, so the hand-over looks the same whether the story ramps
  `people_one` down or not.

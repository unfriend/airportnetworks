# `charts`: the poster's charts in 3D (file `sets/charts.js`)

Chapters 2 (255 donors), 4 (the scores), 5 (trends with age) and 6 (do the methods agree), and the Charts scene in
explore.

**THE DOTS ARE ILLUSTRATIVE.** The poster plots one dot per donor; these are `OVARY_DATA.cohort`: 255 donors with the
poster's ages and counts drawn (seeded) to follow the bands and shares at zero read off its charts, tied so the
comparisons give its r and spread so the trends give its r (Pearson's r on counts; `cohort.r`). The lines, r and p are
the poster's. The story's small print must say so.

## What it is

- **Slides**: 255 glass slides (drawn: glass bright at its edges, a pink and purple tissue, a frosted label) fly in and
  fan out in three arcs (`charts_slides`), then each flies to its donor's bar and the bars stack up into the age
  histogram (`charts_hist`: one slide per donor, the poster's 20 bars from 21, 2.45 years wide; the youngest bars
  first), in front of a backdrop with the ages and counts.
- **Trends** (`charts_trend`): four panels in the poster's 2 x 2 order (blood vessels, corpus albicans; follicle,
  macrophage), each a board of dark glass with the printed y ticks (log10; 0 as a row at the place of 0.5; the vessels
  from 50), ages 20 to 70, and r and p as the poster prints them; the dots in two layers (random forest blue in front,
  segmentation red behind; jittered within a year); the poster's two fitted lines as glowing tubes (as read: straight
  lines in counts, so on the log axis the follicle lines dive to about 1 by 58); bands (`charts_band`: the 10th to 90th
  percentile of the dots by decade, translucent); an age cursor (`charts_sweep`) up to which the dots, lines and bands
  show. One panel can be focused (`charts_focus`), big in the middle, the others faded.
- **Comparisons** (`charts_cmp`): the same panels turn into the comparison charts (segmentation count against random
  forest count, linear axes to the read maxima): each donor's two dots fly to one place (its random forest dot stays,
  the other fades), the fitted line as read and the dashed diagonal (where both methods would agree), r and p printed.
- **Scores**: the random forest's precision, recall and F1 per object (`charts_score`: three bars each, lighter to
  full color, the poster's table order: blood vessel, corpus albicans, follicle, macrophage) and SegFormer's IoU per
  object with the cyst (`charts_iou`: blood vessel, corpus albicans, cyst, follicle, macrophage), values printed under
  the bars (blood vessel F1 as printed, 0.86; 0.84 from its precision and recall: an open question).

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `charts_a` | 0..1, 1 | fade |
| `charts_slides` | 0..1, 0 | the slides fly in (fan); the histogram's slides need it at 1 |
| `charts_hist` | 0..1, 0 | the slides stack into the histogram (younger bars first), backdrop from 0.4 |
| `charts_trend` | 0..1, 1 | the trend panels; the dots drop in |
| `charts_sweep` | 20..70, 70 | the age cursor: dots, lines and bands show up to it |
| `charts_focus` | 0..4, 0 | 0 all; 1 vessel, 2 albicans, 3 follicle, 4 macrophage big in the middle |
| `charts_rf`, `charts_seg` | 0..1, 1 | each method's dots, line and band |
| `charts_band` | 0..1, 0 | the bands |
| `charts_cmp` | 0..1, 0 | the comparisons (trend lines and bands go first) |
| `charts_side` | 0..1, 0 | the panels to the right at 0.62 of their size (with `organ_side` on the left) |
| `charts_score`, `charts_iou` | 0..1, 0 | the bars grow from the base |

## Anchors, labels, cams, controls, API

- Anchors: `hist` (above the histogram), `histTop` (the tallest bar), `fan`, `slides`, `t0`..`t3` and `vessel`,
  `albicans`, `follicle`, `macrophage` (panel titles, top left), `p0`..`p3` (r and p, lower left), `end0`..`end3` (the
  segmentation line at the cursor), `rfScores`, `iouScores`, `cyst` (the cyst's bar).
- Labels: "255 donors · GTEx, aged 20 to 70" (with the histogram); per panel its title and "RF −0.24 · Seg −0.43", or
  in the comparison "r +0.78" (function labels); Random forest "precision · recall · F1", SegFormer "IoU (overlap of
  masks)", Cyst "hard: 0.15".
- Cam: `default` [0, 4, 3.05], `hist`, `fan`, `trends`, `focus` (a focused panel), `scores`, `rf`, `iou`, `side`.
- Controls: Chart (Donors, Trends, Methods agree?, Scores), Object (All, Vessels, Scars, Follicles, Macrophages),
  Method (Both, Random forest, Segmentation: the other at 0.12).
- `api()`: `order`, `line(kind, method, age)`, `cohortR` (what the illustrative dots give).

## Say, and do not say

- Say the poster's r and p (`OVARY_DATA.kinds[].trend`, `.compare`) and what the lines show: follicles fall toward zero
  by about 60; blood vessels fall; corpora albicantia rise; macrophages flat by the random forest, falling by
  segmentation; follicles and vessels agree well between the methods (r +0.94, +0.78), corpora albicantia and
  macrophages less (segmentation finds far fewer). Precision: of the tiles called X, how many are X; recall: of the X
  tiles, how many were found; F1: the two in one number; IoU: how much a predicted mask and the true one overlap.
- Do not read values off the dots (illustrative); do not say which r (Pearson or Spearman) the poster uses (open).

Performance: about 18,700 triangles, 2,040 points and up to 24 draw calls with the four panels (fewer per scene part);
construction about 60 to 100 ms (eleven canvas textures).

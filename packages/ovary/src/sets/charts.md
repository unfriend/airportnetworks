# `charts`: the donors in 3D (file `sets/charts.js`)

Chapter 2 (255 donors) only: the story's one graph, and it goes by in passing. Not a scene of explore mode.

The trends with age, the comparisons of the two methods and their scores are no longer charts (the owner's rule against
2D graphs, October 2026): the Age chapter tells the trends on the cut-away ovary (`organ_counts`, three live tags on
the poster's lines) and in words (all r, p in sum, the agreement donor by donor), Methods puts the scores as tags on the
section's own objects, and explore's Objects pane lists every number as text. The illustrative dots went with them
(the generator no longer makes them): `OVARY_DATA.cohort` holds only `age`, used here.

## What it is

- **Slides**: 255 glass slides (drawn: glass bright at its edges, a pink and purple tissue, a frosted label) fly in and
  fan out in three arcs (`charts_slides`), then each flies to its donor's bar and the bars stack up into the age
  histogram (`charts_hist`: one slide per donor, the poster's 20 bars from 21, 2.45 years wide; the youngest bars
  first). The bars are towers of slides lying flat on the floor (`HY0`), each slide's long side along a wide arc in
  front of you (radius 1.5, its centre on your side, so the middle stands furthest away and the ends come round
  towards you; 46 degrees either side), age 20 on the left to 70 on the right, seen from a little above (cam `hist`,
  22 degrees): the owner, 2 November 2026, found the flat histogram (a wall of slides seen edge on, before a backdrop)
  "hard to see". A faint band along the arc on the floor, a mark at every decade in front of it and the ages as the
  set's labels (Age 20, 30 ... 70). The bar heights are the poster's (a slide every 2 cm up a tower); each slide's age
  is a whole year in its bar (`OVARY_DATA.cohort.age`).

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `charts_a` | 0..1, 1 | fade |
| `charts_slides` | 0..1, 0 | the slides fly in (fan); the histogram's slides need it at 1 |
| `charts_hist` | 0..1, 0 | the slides stack into the arc of towers (younger bars first), the floor's band and marks from 0.4 |

## Anchors, labels, cams

- Anchors: `hist` (above the histogram), `histTop` (over the arc's middle, at the tallest tower's height), `age20` to
  `age70` (on the floor in front of the decade marks), `fan`, `slides`.
- Labels: "255 donors · GTEx, aged 20 to 70" and the six ages (with the histogram).
- Cam: `default` (as before), `hist` (the arc from a little above), `fan`.
- No controls, no `explore`, no `api()`.

## Say, and do not say

- Say: 255 donors aged 20 to 70; most were older (the story: at least so many over 40, from the bars).
- Do not say the slides are GTEx images: they are drawn.

Performance: 255 instanced slides in three draw calls, the floor's band and six marks; construction about 20 ms.

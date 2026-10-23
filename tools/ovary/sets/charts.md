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
  first), in front of a backdrop with the ages and counts. The bar heights are the poster's; each slide's age is a
  whole year in its bar (`OVARY_DATA.cohort.age`).

## Params

| Param | Range, default | Meaning |
| --- | --- | --- |
| `charts_a` | 0..1, 1 | fade |
| `charts_slides` | 0..1, 0 | the slides fly in (fan); the histogram's slides need it at 1 |
| `charts_hist` | 0..1, 0 | the slides stack into the histogram (younger bars first), backdrop from 0.4 |

## Anchors, labels, cams

- Anchors: `hist` (above the histogram), `histTop` (the tallest bar), `fan`, `slides`.
- Labels: "255 donors · GTEx, aged 20 to 70" (with the histogram).
- Cam: `default` and `hist` (the histogram), `fan`.
- No controls, no `explore`, no `api()`.

## Say, and do not say

- Say: 255 donors aged 20 to 70; most were older (the story: at least so many over 40, from the bars).
- Do not say the slides are GTEx images: they are drawn.

Performance: 255 instanced slides in three draw calls and one canvas texture; construction about 20 ms.

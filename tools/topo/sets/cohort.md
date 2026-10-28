# `cohort`: the 123 slides, their curves, their scores and what the classifier learns (file `sets/cohort.js`)

Chapters 5 (`cohort`) and 6 (`scales`) of the topo story. Every number is topocyte's, from `TOPO_DATA.h1` (loops) or
`TOPO_DATA.h0` (pieces) through `TDATA`; the set computes nothing scientific. It places things by stored numbers (curves,
scores, the classifier's coefficients and intercept, log-odds, held-out predictions), counts stored values (the
stacks), sums stored fine shares (`TDATA.share`) and forms one number from them, the odds factor e^share.

- **The rack**: 123 glass slides standing on their long edges in two rows of slots that step up towards the back, the
  66 healthy on the left and the 57 cirrhotic on the right, each row in slide order, faces (and frosted labels, blue or
  red) towards you. On each slide stands its own curve as a lit ribbon (`curves[i]`: the slide's unit Betti curve, the
  figure scripts' exact envelope, u on the poster's log ruler from 1.5 µm at the left to 60 µm at the right; loops
  orange, pieces amber), so the rows read as two ridges of curves. The ribbons light one after another (by slide
  number) as `cohort_rack` rises, each with a white flash. The classes' mean curves (`means`) stand in front of their
  rows, bright blue and red.
- **The two main shapes** (`phi[0]`, `phi[1]`): two wide ribbons hovering over the rack (shape 1 cyan, shape 2 green;
  they dip below their base lines where the shape is negative), with their shares of the variation (`fve`) as tags. As
  the slides fly out they move onto the cube's back edges: shape 1 standing on its top back edge (the x axis), shape 2
  on its left back edge (the y axis); shape 3's axis runs along the left bottom edge towards you (no ribbon: `phi`
  holds two).
- **The space of the scores** (`cohort_space`): every slide flies out of its slot (over an arc, by slide number, its
  curve fading as it goes) to its place in a cube 1.6 across: x shape 1, y shape 2, z shape 3 (`scores[i][0..2]`, each
  scaled from its range to 0.9 of the cube's half-side, so the cloud fills it). Small glass slides (0.11 long, label
  tinted), a faint glow in the class's colour, a faint line down to the cube's floor; they sway a little (by `t`) so the
  glass catches the light. Healthy and cirrhotic slides fall apart (for loops mostly along shape 2: up).
- **The classifier's wall** (`cohort_wall`): the plane `intercept + Σ coef_k × score_k = 0` with the fourth score at its
  mean, 0, in the cube's scale, cut to the cube (glass with a bright outline). It sweeps in from the cirrhosis side
  (parallel to itself) to its place between the clouds.
- **The log-odds** (`cohort_odds`): each slide glides to its log-odds (`logOdds[i]`, the final model's, all four scores)
  along an axis through the wall along its normal, in the wall's own scale (the plane's value grows by |a| per unit, so
  0 is on the wall); its offset across the axis shrinks to a fifth. Ticks every 5 (rings), 0 brightest, an arrowhead
  towards cirrhosis.
- **The four stacks** (`cohort_stacks`): the slides drop, one after another, into four stacks by their held-out
  prediction (`held[i]`, from the stored five folds) against their class (`y[i]`): healthy right, healthy wrong,
  cirrhosis wrong, cirrhosis right, left to right (62, 4, 10, 47 for both models). Lying flat, their labels towards you,
  each stack glowing from inside in its class's colour as it grows; the cube, the wall and the axis fade.
- **The weight per radius** (`cohort_gamma`), to the right of everything (x 2.05): a glass column for the radius on the
  tower's log ruler (1.5 µm at its foot, 60 µm at y = 1.6, as the tower set's), with rings at 2, 5, 10, 20, 50 µm; γ
  (`gamma`, over its largest |value|) as a ribbon drawing upwards and swinging out red (+x, more features alive at that
  radius speak for cirrhosis) or blue (−x); beside it the two classes' means on one wall (healthy in front, cirrhotic
  just behind: where red shows past blue, the cirrhotic slides have more features alive at that radius. They are
  overlaid, not subtracted: the set forms no difference). Then the windows of radii: the poster's two (`poster.windows`:
  5 to 10 and 10 to 15 µm) and the rest of the radii on either side (0 to 5, 15 and above), each a glass band round the
  column over its heights with a ring at either end, its radius 0.06 + 0.055 × |share|, red for +, blue for −, each
  share `TDATA.share(dim, r0, r1)`.
- **The gap** (`cohort_gap`): the bands drop, one after another, into one stack in front of the column's left (x 1.3,
  z 0.36): the positive ones stand on the floor in order of radius, the negative ones hang from their top, each 0.11
  high per unit of share; where it ends (the stored `shares.gap`, which their shares add up to), a bright ring, a post
  from the floor and the tag: 7.04, odds × 1,138 (e^gap).

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `cohort_a` | 1 | fade | in at 158-161 (as the tower goes), out at 250-253 |
| `cohort_rack` | 1 | the slides drop into their slots (0 to 0.14, front to back), then their curves light one after another by slide number (0.14 to 0.94, each with a flash); 0 shows nothing | 0 -> 1 at 161-176 |
| `cohort_means` | 0 | the classes' mean curves in front of their rows; the slides' curves dim a little | 0 -> 1 at 176-179 |
| `cohort_shapes` | 0 | the two main shapes hovering over the rack, their shares as tags | 0 -> 1 at 182-186 |
| `cohort_space` | 0 | the slides fly into the cube of their scores (staggered over 0.03 to 0.98 by slide number); the shapes move onto its edges, the rack fades | 0 -> 1 at 191-201 |
| `cohort_wall` | 0 | the classifier's wall sweeps in to its place (in by 0.8) | 0 -> 1 at 207-212 |
| `cohort_odds` | 0 | the slides glide to their log-odds along the axis through the wall | 0 -> 1 at 213-217 (or leave it out and go from the wall to the stacks) |
| `cohort_gamma` | 0 | the column rises (0 to 0.3), γ draws upwards (0.2 to 0.55), the means (0.4 to 0.7), the windows' bands (0.65 to 0.95) | 0 -> 1 at 217-229 |
| `cohort_gap` | 0 | the bands drop into the gap's stack (0 to 0.74, one after another), its ring and tag (0.6 to 0.9) | 0 -> 1 at 231-238 |
| `cohort_stacks` | 0 | the slides drop into the four stacks (from wherever they are; the tallest stack's last slide lands at 0.94) | 0 -> 1 at 240-248, after taking `cohort_gamma` back to 0 at 238-240 (see Labels) |
| `cohort_dim` | 1 | 1 loops (h1, the poster's), 0 pieces (h0): curves, means, shapes, scores, wall, log-odds, stacks, γ, windows and gap all switch. **Step param** | 1 in the story |
| `cohort_pick` | -1 | a picked slide (0..122, -1 none): its curve lit cyan in the rack, a glow in the cloud, pulled out of its stack towards you; the others dim and the set's other tags hide. **Step param** | -1 in the story |
| `cohort_win` | 0 | a window of radii chosen in explore: a cyan band round the column from `cohort_from` to `cohort_to`, with its share and odds factor as a tag; the poster's bands dim | 0 in the story |
| `cohort_from`, `cohort_to` | 5, 15 | the window in µm, rounded to the 0.5 µm grid of the stored shares (0 to 100; `cohort_to` 100.5 or more means "and above"). Plain numbers (they may be eased; the tag looks up the window on show) | |

The resting look (defaults): the rack full, every curve lit (loops).

## Anchors

`rack` (its middle), `rowH`, `rowC` (above the front of each row), `ruler` (under the front of the healthy row),
`meanH`, `meanC` (above each mean), `phi1`, `phi2` (by each shape's ribbon, wherever it is), `axis3` (the front end of
shape 3's axis), `cube` (its centre, (0, 0.95, 0)), `healthy`, `cirrhosis` (above the middle of each cloud), `wall` (the
wall's highest corner), `zero`, `oddsHi`, `oddsLo` (on the log-odds axis: 0, the highest tick, its lower end), `stack0`
.. `stack3` (above each stack, by its count), `stacks` (above the four), `column` (the column's middle), `colTop`,
`gPeak` (where γ is largest), `means` (above the column's means), `drum0` .. `drum3` (beside each window's band,
wherever it is: 0 to 5, 5 to 10, 10 to 15, 15 µm and above), `gap` (above the gap's stack), `win` (beside the chosen
window), `pick` (above the picked slide, wherever it is). Those that move are functions.

## Labels

The engine has no blue or red label class: healthy tags use `cyn` and cirrhosis tags `mag`. All but the window's and
the pick's hide while a slide is picked.
- `66 healthy · blue labels` (cyn, `rowH`) and `57 with cirrhosis · red labels` (mag, `rowC`): as the rack fills, until
  the means come; `Radius · 1.5 to 60 µm, left to right` (`ruler`): the rack, until the shapes;
- `Healthy · their mean curve` (cyn, `meanH`), `Cirrhosis · their mean curve` (mag, `meanC`): with the means;
- `Shape 1 · 72 % of the variation` (cyn, `phi1`), `Shape 2 · 20 %` (grn, `phi2`), `Shape 3 · 5 %` (`axis3`, once in the
  cube): until the log-odds (fve from the model on show);
- `Healthy` (cyn), `Cirrhosis` (mag) at the clouds: once in the cube, until the wall is half in;
- `The wall · where the classifier cannot tell` (`wall`): with the wall, until the log-odds;
- `Log-odds 0 · on the wall` (`zero`), `+15 · cirrhosis more likely` (mag, `oddsHi`; its highest tick), `Below 0 ·
  healthy more likely` (cyn, `oddsLo`): with the log-odds, until the stacks;
- `62 · healthy, right`, `4 · healthy, wrong`, `10 · cirrhosis, wrong`, `47 · cirrhosis, right` (cyn, cyn, mag, mag;
  the stored `confusion`) and `109 of 123 right · held out, accuracy 0.886` (`stacks`): once the stacks are in, **while
  `cohort_gamma` is under 0.3** (so they never crowd the column's tags);
- `Radius · up the column, 1.5 to 60 µm` (`colTop`): as the column rises, until the windows;
- `Weight per radius · red speaks for cirrhosis` (mag, `gPeak`): while γ draws (gamma 0.4 to 0.75);
- `The means · cirrhosis red, healthy blue` (`means`): with the column's means, until the gap;
- `5–10 µm · +2.73`, `10–15 µm · +4.65` and `The other radii · −0.35 together` (at the 15 µm and above band, the larger
  part of the rest; its number is the sum of the rest's shares): with the bands, following them into the gap's stack;
- `The gap · +7.04: odds × 1,138` (amb, `gap`): when the stack is done;
- `5–15 µm · +7.39: odds × 1,612` (cyn, `win`; any window, `… µm and above` for the last): with `cohort_win`;
- `Slide 17 · cirrhosis` and, by the stage it is at, ` · scores -0.19, 0.31, 0.04` (in the cube), ` · log-odds +18.44`
  (on the axis) or ` · held out: right` / `held out: called healthy` (in a stack) (cyn, `pick`).

## Cam views `[az, el, dist, tx, ty, tz]` (target in the set's frame)

| View | Value | For |
| --- | --- | --- |
| `default` | [18, 26, 4.0, 0, 0.4, 0.05] | the rack whole, from the front and above (chapter 5's start) |
| `rack` | [10, 16, 2.9, 0, 0.42, 0.55] | close on the rack's front: the curves standing on their slides |
| `means` | [0, 10, 2.3, 0, 0.42, 0.85] | the two means in front of their rows |
| `shapes` | [14, 18, 4.4, 0, 0.82, 0.05] | the shapes hovering over the rack |
| `space` | [28, 16, 4.7, 0, 0.95, 0] | the cube of the scores |
| `wall` | [80, 8, 4.6, -0.03, 0.69, 0.16] | the wall nearly edge-on between the clouds (computed for loops: across its normal, aimed at it) |
| `odds` | [55, 10, 4.6, 0, 0.95, 0] | the slides on the log-odds axis through the wall |
| `stacks` | [22, 26, 3.7, 0, 0.36, 0.1] | the four stacks |
| `gamma` | [10, 8, 4.3, 2.4, 0.8, 0] | the column, γ and the means |
| `gap` | [-14, 10, 4.2, 1.85, 0.7, 0.1] | the column and the gap's stack |
| `all` | [16, 18, 6.6, 0.75, 0.75, 0] | everything |

## Explore

Controls: View (Rack / Scores / Held out / Scales), Curves of (Loops / Pieces: `cohort_dim`). `explore(c)` returns every
`cohort_` param but `cohort_from` and `cohort_to`: Rack (the rack and the means), Scores (the shapes, the cube and the
wall), Held out (the stacks), Scales (the stacks, the column with γ, the means, the bands and the gap; the stacks' tags
stay hidden there); no pick and no window. The Cohort tab drives `cohort_pick` (and the view), the Scales tab
`cohort_win`, `cohort_from`, `cohort_to`.

`api()`:
- `n` (123), `healthy`, `cirrhosis` (66, 57);
- `slide(i, dim = 1)` -> { i, number (i + 1), cls ('healthy' or 'cirrhosis'), y, scores (4), logOdds, held, right };
- `fve(dim)`, `accuracy(dim)`, `confusion(dim)` ([tn, fp, fn, tp], stored);
- `window(r0, r1, dim = 1)` -> { r0, r1, share (`TDATA.share`), odds (e^share) }: r0, r1 on the 0.5 µm grid, r1
  `Infinity` for "and above"; `windows(dim)` (the four drawn, with their shares and whether they are the poster's);
  `gap(dim)` -> { gap (stored), odds (e^gap) }; `grid` (the windows' edges, 0 to 100 µm in 0.5 steps);
- `pick(raycaster)` -> { kind: 'slide', i } or null (the slide where it is now: in the rack also its curve);
- `mid(i)` (where slide i is now, in the set's frame: for the headset's tip).

## Sizes for framing

The rack: x -0.69 to 0.69, z -1.0 (the back of the healthy row) to 0.95 (its front; the means at 1.12), y 0 to 0.78
(the back curves' tops). The cube: centre (0, 0.95, 0), half-side 0.8; shape 1's ribbon above it to y 2.0, shape 2's
to its left to x -1.07. The stacks: x -0.96 to 0.96 (each 0.11 wide, 0.34 deep), y 0 to 0.84. The column: x 2.05, y 0
to 1.6, γ from x 1.63 to 2.47, the means from 2.67 to 2.97; the gap's stack at (1.3, 0, 0.36), 0.81 high at most.

## Performance (headless Chromium, software GL)

Build 7 to 16 ms (both models placed at load). Draw calls at most 7 in a sweep of every beat, both models, with and
without a pick (one per pool; nine pools, empty ones cost none). Triangles: about 111k for the full rack (123 ribbons of
168 points, 82k, and 123 slides, 28k), at most 122k with the means and the shapes (each of up to 7 large ribbons of 700
points, 2.8k); 31k to 45k once the slides have flown. Points: under 190 (glows). Nothing is allocated per frame in
`update` (pools refilled; the wall's outline in fixed arrays); label texts are made when read.

## For the narrator

- The curves are scaled to the same size (cosine mode): only their shape over the scales counts, not how many cells a
  slide has. The left of each curve is small radii (1.5 µm), the right large (60 µm).
- "Shape 1 holds 72 % of the variation in loops, shape 2 20 %" (`fve`); shape 3 holds 5 % and is the cube's depth.
- The cloud is drawn with each score scaled to fill the cube (the axes are not to one scale): say "healthy and cirrhotic
  slides fall apart", not how far.
- The wall is drawn with the fourth score at its mean (0); the log-odds the slides glide to use all four scores and the
  final model fitted on all 123 slides, so a slide's place on the axis is not its held-out result: the stacks are the
  held-out results (five folds, each slide predicted by a model that never saw it). Say "tested fairly, on slides it
  never saw, it gets 109 of 123 right".
- γ is the classifier read back through the shapes: a weight per radius. The windows' numbers are their shares of the
  gap (topocyte's `fpca_scale_importance`), not odds of their own; "odds × 1,138" is e^7.04, the gap between the
  classes' average log-odds.
- For pieces (`cohort_dim` 0) the poster's windows give other numbers (5 to 10 µm +1.50, 10 to 15 µm −0.61, the rest
  +4.89, gap 5.77); the story tells loops.

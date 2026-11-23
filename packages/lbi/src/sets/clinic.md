# clinic.js: sets `crowd` and `sankey` (slides 24-27)

Two sets in one file. For the harness, `sets/crowd.js` and `sets/sankey.js` are symlinks to `clinic.js` (the harness
loads `sets/<key>.js`); `build.sh` only needs `clinic`.

## `crowd`: one patient among many rare diseases

6,000 instanced, lit people, shaped like the icons on slide 24: a robe-like body with round shoulders, a neck and a ball
head. Rows stand on arcs around a point in front of the crowd, so they bend gently towards the viewer. The first crowd
is the middle of the front rows: **422 people**, centred on the origin, feet at y = 0, people about 0.13 tall. A soft
dark floor fades out at its edge. People sway very slightly with `t`.

**Extent (for the integrator):** the first crowd is about **2.3 wide (x) and 2.0 deep (z)**, so its corners reach about
**1.45** from the origin, beyond the usual radius 1.1. The set exports `radius: 1.45`; on narrow screens scale the
dist of the crowd views by about 1.45 / 1.1, or accept that the back corners are trimmed. From the `default` cam the
whole first crowd is in frame at 16:10 and wider.

| Param | Default | Meaning |
| --- | --- | --- |
| `crowd_a` | 1 | fade |
| `crowd_red` | 0 | one person (`red`) turns red and glows; a soft beam of light with drifting dust comes down on them, a red pool lights the floor, and their glow puts a thin red rim on the immediate neighbours only; everyone else dims |
| `crowd_grow` | 0 | the other 5,578 people rise out of the floor, outwards from the first crowd at an even rate, until a sea of 6,000 reaches the horizon (about 12 units wide, 7 deep); further people fade towards the background colour; the floor widens with them |

Suggested keys (as in the engine draft): `crowd_red` 0 to 1 over 2 s, then `crowd_grow` 0 to 1 over 4-5 s while the
camera pulls back (`default` with el +8, dist +1.5 works, or `wide`).

- Anchors: `red` (just above the patient's head), `crowd` (centre of the first crowd), `front`, `back` (its front and
  back rows), `far` (middle of the grown sea), `horizon` (its back edge).
- Labels: none of its own (the engine's 'One patient' on `red` fits).
- Cam: `default` [0, 20, 3.6, 0, 0.04, 0] (front, the whole crowd); `close` [12, 22, 0.95, on the patient]; `wide`
  [0, 24, 5.6, 0, 0, -1.4] (the grown sea).
- Explore: no controls; `explore()` returns `{}` (the resting crowd, not grown).
- Also exported: `radius` (1.45), `count` (6000), `baseCount` (422).
- Narrator: one figure per rare disease works when grown ("more than 6,000 rare diseases have a known genetic cause");
  the first crowd is just "people". Do not say the crowd has exactly 400 people.
- Level of detail, by where people stand (the grown crowd only appears in the story, whose views are all frontal):
  the first crowd 8-sided with a 6-step round head (184 triangles); within 2.1 of the crowd's front centre 6-sided with
  a 3-step round head (78); out to 3.0 5-sided with shoulders, a pinched neck and a blunt head (35); beyond that the
  same shape 3-sided (21), only a few pixels tall from any story view. The coarser tiers have a weaker blue rim, so
  the rim does not trace their facets. No tier has a pointed crown.
- Performance: fully grown 249k triangles, 9 draw calls, 71 points; resting 79k triangles, 4 draw calls (6 with the
  beam and dust). Build 25-60 ms in headless Chromium.

## `sankey`: clinical categories against molecular clusters (slide 27)

A 3D Sankey diagram about 1.45 wide and 1.47 tall, centred on the origin. Left: 9 clinical categories as lit, glowing
blocks (0.16 deep); right: 19 molecular clusters; between them 58 ribbons, thin bands (0.012 thick) whose heights are gene
counts (0.0072 per gene), coloured by clinical category. Each category's ribbons leave their block, ease into their own
depth layer (first category in front, 0.06 apart, +-0.24) over the first 35% of the span and ease back into the cluster
blocks over the last 35%, so crossings separate in depth, the diagram has parallax when it turns, and no ribbon bends
sharply near a column. One small dot per gene and lap travels along its ribbon (519 dots), a gene moving from its
clinical category to its cluster. Molecular labels are spread apart where small clusters crowd together (c19, c9, c4
...), with faint leader lines to their blocks.

| Param | Default | Meaning |
| --- | --- | --- |
| `sankey_a` | 1 | fade |
| `sankey_left` | 1 | the 9 clinical blocks grow in, top to bottom; their labels follow |
| `sankey_right` | 1 | the 19 cluster blocks grow in, top to bottom; labels and leader lines follow |
| `sankey_flow` | 1 | the ribbons sweep from left to right (category by category, a glowing front); the gene dots appear in the last half |
| `sankey_hi` | 0 | **for the story** (keyed in jumps): 0 none; k = 1..9 highlights clinical category k: its ribbons come forward in front of every layer and glow, its block and the clusters it reaches stay bright, everything else dims to about 10-20%. In-between values blend two neighbouring categories, so a slow ramp from 3 to 5 passes 4: key it as jumps (0.01 s), as the engine draft does |
| `sankey_h1` .. `sankey_h9` | 0 | **for explore** (safe to ease): one highlight weight per category, same look as `sankey_hi` = k. Switching from one to another eases the old one out while the new one fades in; the categories in between never light up. The highlighted category stays fully bright while its highlight fades in; the rest dim with the total weight. Combine freely with `sankey_hi` (the larger weight wins) |

Suggested keys (as in the engine draft): left 0 to 1 over 3 s, right 0 to 1 over 3 s, flow 0 to 1 over 6-7 s, then
highlight 9 (complement deficiencies: almost all to the Complement cluster) and 1 (autoinflammatory: spread over many
clusters) by jumping `sankey_hi`. (Easing `sankey_h9` 1 to 0 while `sankey_h1` goes 0 to 1 also works in the story.)

- Anchors: `left0`..`left8` (centre of the front face of each clinical block), `right0`..`right18` (centre of the
  front face of each cluster block), `leftLabel0`..`leftLabel8` and `rightLabel0`..`rightLabel18` (where the set's own
  labels sit: just right of each clinical block, and beside each cluster block, spread apart where needed), `mid`
  (centre of the ribbons), `clinical` and `molecular` (above the two columns), `top`, `bottom`. For an engine story
  label about a block, prefer `leftLabel<i>` / `rightLabel<j>` (or hide the set's label) so the two do not overlap.
- Labels: 'Clinical 9 categories' (amber) and 'Molecular 19 clusters' (cyan) above the columns, and every block's short
  name with its count (e.g. 'Autoinflammatory 40', 'NF-κB and chromatin 22', 'Meiosis, antigen presentation 3'), each
  shown as its block grows in and dimmed when another category is highlighted. 30 labels in all (the spec asks for
  every block). The 7 labels of clusters with 3 genes or fewer (c23, Calcium, c4, Meiosis, antigen presentation, c19,
  c9, c3) carry **`minor: true`**: drop them on narrow screens and in the headset, where 30 labels are too many.
- Cam: `default` [-8, 7, 3.75, 0.18, 0, 0] (front, slightly oblique, right labels in frame); `oblique` [-42, 14, 3.5,
  0.1, 0, 0] (shows the depth layers); `molecular` [-16, 4, 2.4, 0.6, 0, 0] (close on the clusters); **`portrait`**
  [-26, 9, 3.4, -0.12, 0, 0] for portrait screens (w/h < 1): turned so the diagram is narrower and shows its depth,
  centred on the ribbons; both columns fit at 390 x 844 with the engine's fit, but the right labels run off the edge,
  so show only the non-minor ones there (or none).
- Explore: control `hi` 'Highlight', options '0' None and '1'..'9' with one-word names (Autoinflammatory, Syndromic,
  Cellular, Phenocopies, Dysregulation, Antibody, Phagocyte, Innate, Complement); `explore(c)` returns
  `{ sankey_left: 1, sankey_right: 1, sankey_flow: 1, sankey_hi: 0, sankey_h1..h9 }` with 1 for the chosen category and
  0 for the others.
- Also exported: `left` (the 9 full clinical names), `right` (the 19 full molecular names), `total` (173), `leftShort`,
  `rightShort` (the label names), `leftColours`, `rightColours`, `matrix` (9 x 19 copy).
- Performance: 23.5k triangles, 12 draw calls, 519 points, 38 line segments. Build 30-85 ms.

### The flows are illustrative

Only the totals come from the paper (173 genes; the 9 category counts and the 19 cluster counts). The gene counts
between categories and clusters are made up to be plausible (complement deficiencies mostly to Complement;
autoinflammatory to steroid-resistant inflammation, NF-κB, proteasome and RNA/nucleotide; immune dysregulation to cell
death, vesicular traffic and transcription factors; antibody deficiencies to NF-κB and TCR/BCR). The narrator must not
quote any single flow as a finding ("in this illustration" at most). The set checks the sums at load and throws if one is
wrong. Checked programmatically (Node, from the set's exported `matrix`):

| Clinical \ molecular | c23 | RNA | Prot | Ca | NF-κB | Death | c4 | Meio | Ves | Actin | TF | TCR | CD28 | IL | Ster | c19 | c9 | C' | c3 | row sum |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Autoinflammatory | 1 | 8 | 7 | . | 8 | 4 | . | . | . | . | . | . | . | 2 | 9 | . | . | 1 | . | 40 |
| Combined, syndromic | . | 6 | . | 1 | 2 | . | 1 | 1 | 1 | 1 | 5 | . | . | . | . | 1 | . | . | . | 19 |
| Cellular and humoral | . | 2 | . | 1 | 3 | . | 1 | 2 | . | 1 | 5 | 6 | 3 | 3 | . | . | . | . | . | 27 |
| Phenocopies | . | . | . | . | 1 | 1 | . | . | . | . | . | . | . | 1 | 1 | . | . | . | . | 4 |
| Immune dysregulation | . | . | . | . | 2 | 10 | 1 | . | 7 | 1 | 6 | . | 1 | 1 | 3 | . | 1 | . | . | 33 |
| Antibody deficiencies | . | 1 | . | . | 4 | 1 | . | . | . | . | 1 | 3 | . | . | . | . | . | . | . | 10 |
| Phagocyte defects | . | . | 1 | . | . | 3 | . | . | 1 | 2 | 2 | . | . | . | . | . | . | . | . | 9 |
| Intrinsic and innate | . | 2 | . | . | 1 | . | . | . | . | . | . | . | . | . | . | . | . | . | . | 3 |
| Complement deficiencies | . | . | . | . | 1 | 2 | . | . | . | . | . | . | . | . | 2 | . | . | 22 | 1 | 28 |
| **column sum** | 1 | 19 | 8 | 2 | 22 | 21 | 3 | 3 | 9 | 5 | 19 | 9 | 4 | 7 | 15 | 1 | 1 | 23 | 1 | **173** |

Row sums 40 19 27 4 33 10 9 3 28 and column sums 1 19 8 2 22 21 3 3 9 5 19 9 4 7 15 1 1 23 1 match the Shared facts
exactly; 58 non-zero flows.

## Changes after review 1

- Sankey explore highlight (major): added `sankey_h1..h9`; `explore()` drives those and leaves `sankey_hi` at 0, so a
  Highlight click cross-fades the old category into the new one without sweeping through the ones in between (checked
  in Node by easing 9 to 1 the way `exploreStep` does: categories 2-8 never brighten). The highlighted category no longer
  dips while its highlight fades in.
- Crowd level of detail (major): no pointed tiers any more; mid tier 6-sided with a round head, far tiers with
  shoulders, neck and a blunt head, weaker rim on the coarse tiers. One extra tier (9 draw calls) and a fan crown
  (no degenerate triangles) keep it at 249k triangles.
- Sankey S-bends: layers ease in and out over 35% of the span (ribbons, dots and the highlight pop alike); layer
  spacing 0.06.
- Sankey anchors: `left<i>` / `right<j>` are now the blocks' front faces; label points are `leftLabel<i>` /
  `rightLabel<j>`.
- Sankey on phones: `minor: true` on the 7 smallest clusters' labels and a `portrait` cam.
- Explore buttons: one-word names; the 3D labels keep the longer short names.
- 'Meiosis, antigens' is now 'Meiosis, antigen presentation' (the cluster's full name). I did not use the reviewer's
  'Antigen presentation': it drops half the cluster's name; the full name is 3 words and fits the label rules.
- Crowd red spill: falloff 0.006 / (0.004 + d²), so only the immediate neighbours catch a thin red rim.
- Crowd extent: the first crowd is narrower (2.3 instead of 2.5 wide, a little deeper) and centred on the origin; its
  extent is stated above and exported as `radius`.

Untested: comfort and label clutter in a real headset (the `minor` flag and the extent are hints for the engine).

## Sources

- Slides 24-27 of the LBG visit deck (J. Menche, 2026).
- Guthrie et al., Science Advances (2023): 173 inborn-errors-of-immunity genes, 9 clinical categories (IUIS
  classification), 19 interactome clusters, the counts and colours used here.
- "More than 6,000 rare diseases with a known genetic basis": slide 24.

## Final screenshots

`shots/crowd-final-0..4.png` (resting; patient in red; close on the patient; grown sea with the patient, story pull-back
view; eye-level close view beside the grown crowd, the reviewer's headset-style cam) and `shots/sankey-final-0..6.png`
(default; oblique; complement deficiencies highlighted; ribbons mid-sweep; molecular close-up; explore cross-fade
halfway from Complement to Autoinflammatory; portrait phone 390 x 844 with the `portrait` cam at the engine's fit).

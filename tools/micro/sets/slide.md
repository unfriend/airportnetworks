# `slide`: one section, the method, the domains (file `sets/slide.js`)

The preprint's method, H&E-UTAG, shown on one section. The section is cut into tiles. A vision model describes each
tile with numbers. Each tile mixes in its neighbours' descriptions. Similar tiles are grouped into domains. Then the
domain map changes from age 20 to 70, as in the preprint's gut submucosa example.

The set draws nothing of its own section. It is an overlay in **the tour's tissue set's frame** (the H&E section of
stomach wall, `tools/lbi/sets/tissue.js`), so the engine shows `tissue` and `slide` together, with the same transform.
`slide.js` copies what it needs from `tissue.js`: `layers()`, `plane()`, the centring, the lymphoid aggregate `AG`
and the zoom patch's artery and vein. If `tissue.js` changes its geometry, copy the change here too.

## How it is built

- **Tiles**: 40 x 12 square tiles (0.0525 a side) in the strip's own coordinates (s along the section, d depth),
  so they follow the slab's curve. A tile is kept when at least 30 % of it is tissue: 372 tiles. A tile's own domain
  (for its features, its lift and the matrix) is the main one among 64 samples; small structures count 2.4 times.
- **Domains to the pixel**: the domain map is not drawn per tile (at 40 x 12 its borders were staircases and the
  patch and vessels a tile or two). The wash classifies every pixel: the tissue set's layer lines (passed per
  column of the mesh as an attribute: mucosa / submucosa `b1`, submucosa / muscle `b2`, inner / outer muscle `bm`),
  then the two vessels and the lymphoid patch as ellipses over them, each border antialiased over a pixel. The
  domain colours still wash in tile by tile (the method assigns tiles; the real tiles are far smaller than these).
  - The patch: the tissue set's aggregate `AG` (an ellipse 0.097 x 0.067). The vessels: the zoom patch's artery and
    vein, with a halo of 1.6 times their size (their wall and the loose tissue round them). The tissue set's other,
    smaller vessels (placed by its own random numbers, not exported) stay in the submucosa.
- **One mesh, two shaders**: a grid that follows the slab, 20 quads per kept tile. It is drawn on whichever face
  the camera sees, a hair (0.0016) in front of it.
  - The *wash* shader draws everything on the tiles: outlines, tints, domain colours, borders, focus. It reads a
    small texture of three pages, 40 x 12 each, and the six domain colours as uniforms.
  - The *graph* shader draws the network of neighbouring tiles, 0.011 in front, so it has some parallax up close.
  - Line widths come from `fwidth`, so lines stay crisp from afar and up close (in a headset too).
- **Features**: 16 numbers per tile. They come from the tile's mix of domains (a prototype per domain) plus noise.
  Message passing runs two rounds of "half its own, half its neighbours' mean". A tile's colour (its *tint*) is a
  fixed random projection of these numbers, stretched to a bright range. Tints are shown before and after mixing.
- **Lifted tiles**: five, one each for mucosa, lymphoid patch, submucosa, inner muscle and outer muscle, left to
  right. Each lifts 0.14 towards the viewer and grows to 2.2 times a tile, showing a small drawn H&E picture of what
  it holds, in an amber frame.
- **Feature bars**: 80 quads. A column of 16 bars per lifted tile, where length and brightness are the numbers. Each
  column flies on a curve into its column of the matrix and becomes a column of heat cells.
- **Matrix**: 32 tiles (columns) x 16 features (rows), drawn as a glowing heatmap.
  - It sits above the section at `[0.1, 0.7, 0.12]`, 0.8 x 0.4, tilted back a little.
  - Its columns are grouped by domain, so similar tiles visibly have similar descriptions.
  - Every column is a different tile. Where the section has too few of a kind (the patch, the vessels), a column is
    a tile of that kind from elsewhere (the matrix stands for tiles of many slides): its kind's description plus
    noise.
  - The five lifted tiles land in the middle of their domain's block, with amber edges.
- **Gauge**: a small panel with canvas text above the section's left half, at `[-0.5, 0.57, 0.06]`, 0.68 x 0.26.
  - It shows "Submucosa", the live share, a bar with ticks at 42.9 and 34.5, and "of gut slides at 20 years": the
    preprint's numbers, said to be of the gut's slides, not of this drawn section.
  - The canvas is redrawn only when the shown numbers change.
- **Blending**: premultiplied (`ONE, ONE_MINUS_SRC_ALPHA`), so one material can lay translucent colour over the slide
  and add glow. On the pale slide, the network's links are dark and the messages are bright cyan.

## Params

| Param | Meaning | Default |
| --- | --- | --- |
| `slide_a` | fade (applied by the engine) | 1 |
| `slide_tiles` | tile outlines draw on, each traced round its edge, in a diagonal sweep from left to right with some randomness. Each tile flashes faintly as it appears. Faint from afar (a fine mesh), brighter once a tile is big on screen. Fades to faint as domains or neighbours come in. | 0 |
| `slide_feat` | 0-0.2 the five tiles lift (one after another); 0.15-0.4 each grows its column of 16 bars; 0.35-0.55 the matrix's frame appears; 0.42-0.82 the columns fly into the matrix; 0.68-0.98 the other columns fill in, outwards from the landed ones. At 1 the tiles stay lifted and the matrix stays. The tiles sink back, and the matrix and bars fade, as `slide_adj` or `slide_domain` rise (0.1-0.45). | 0 |
| `slide_adj` | each tile takes its own tint (0-0.25); the network appears (node per tile in its tint, links to the 4 neighbours, messages running both ways along every link); the tints blend into the mixed ones (0.25-0.85). The network fades out as `slide_domain` goes 0.2-0.6. | 0 |
| `slide_domain` | tiles take their domain colours one by one (each over 0.45 of the param, the last starting at 0.55). Inside a tile the colours follow the domains to the pixel, with clean light borders where two domains meet. The slide darkens by 20 % under them, then the colour lies over it at 58 % (74 % on the small patch and vessels). The network fades out over 0.1-0.45. Works with or without the steps before it: on its own it washes the domains straight onto the H&E (the `slide` chapter). | 0 |
| `slide_age` | age 20 (0) to 70 (1): the submucosa / muscle border rises, so the submucosa loses the same fraction of itself as in the preprint's example (about a fifth). The inner / outer muscle border rises by 0.4 of that, so both muscle layers thicken (illustrative). The change runs along the section as a gentle wave (each place over 0.7 of the param), not where the strip has no muscle (its right end). In this section, by area: submucosa 32.7 % to 26.2 %, inner muscle 14.0 % to 17.9 %, outer muscle 18.0 % to 20.5 %, mucosa 34.3 %, patch and vessels 0.5 % each. The gauge's numbers follow linearly (42.9 % to 34.5 %, 20 to 70 years). | 0 |
| `slide_focus` | 0..6: domain index + 1 (0 none). That domain shows its colour (even without `slide_domain`), glows softly and gets bright borders; the rest dim, their borders too. In-between values blend between neighbouring indices. Only the focused domain's label shows. | 0 |
| `slide_gauge` | shows the gauge (and its label) even at age 20. The gauge also shows by itself once `slide_age` > 0. | 0 |
| `slide_ghost` | harness only: draws an instance of `SETS.tissue` under the overlay (built the first time it is > 0). The engine leaves it at 0 and shows the real tissue set. | 0 |

Every param looks right in between: tiles draw on one by one, colours wash in per tile, the borders glide with age,
and the flights are eased curves. `update` reads only `S`. Time (`uTime`) drives only the messages on the links and the focus glow.

**Suggested keyframes** (a = chapter start):
- `slide` (14-50): with the tissue set's section and zoom views, `slide_domain` 0 to 1 over about 5 s near the end
  (cam `domains`, or stay on the tissue's `section`). `slide_tiles` stays 0, so only the wash and the borders show.
- `method` (85-130). Bring `slide_domain` back to 0 first, or the method starts from the finished map.
  - `slide_tiles` 0 to 1 at a+2..8 (cam `tiles`);
  - `slide_feat` 0 to 1 at a+10..20 (cam `matrix`; the label shows from about a+16);
  - `slide_adj` 0 to 1 at a+22..28 (cam `close`, and hold a few seconds for the messages);
  - `slide_domain` 0 to 1 at a+30..36 (cam `domains`). Then hand over to `atlas_umap`.
- `age` (170-215): with `slide_domain` 1, set `slide_gauge` 1 (cam `age`), then `slide_age` 0 to 1 over about 6 s.
- Focus: the engine sets `slide_focus` from the Domains tab, or as `api().pick` returns.

## Anchors (local coordinates; the tissue set's frame)

- `tiles` (the top-left tiles), `matrix` (the matrix's top right; labels run right), `feat0`..`feat4` (the lifted
  tiles, following the lift: mucosa, lymphoid, submucosa, inner muscle, outer muscle), `gauge` (the gauge's right
  edge), `group` (the lumen edge at s = 1.15, for the grouping step).
- Domains: `mucosa` (s = 0.22), `submucosa` (s = 0.2), `inner` (s = 0.6), `outer` (s = 1.34), each in the middle of
  its layer at 20; `lymphoid` (the patch's right part), `vessels` (the artery); plus `muscularis` (the middle of
  both muscle layers). The mucosa, submucosa and inner muscle labels stack on the left, the patch, vessels and outer
  muscle along the section: no two of the six overlap in the `domains` and `age` views at 640 x 400 (measured).
- `listen` (a node of the network in the close-up), `close` (the close-up's target: the corner of four tiles on the
  mucosa/submucosa border).

## Labels (the set's own; at most six at once)

| Text | At | Shows |
| --- | --- | --- |
| Tiles | `tiles` | `slide_tiles` 0.15-0.45, until `feat`, `adj` or `domain` start |
| Features · from a vision model | `matrix` | `slide_feat` 0.6-0.85, until `adj` or `domain` |
| Each tile · listens to its neighbours | `listen` | `slide_adj` 0.3-0.6, until `slide_domain` 0.1-0.3 |
| Similar tiles · group into domains | `group` | `slide_domain` 0.12-0.35, out by 0.5-0.64; only with `slide_tiles` (the method), not with a focus |
| Mucosa / Submucosa / Muscle · inner, circular / Muscle · outer, lengthwise / Lymphoid · patch / Blood vessels | domain anchors | `slide_domain` 0.62-0.95; with a focus only the focused one; lymphoid and vessels give way to the gauge |
| Gut submucosa · thins with age | `gauge` | with the gauge (its numbers are on the gauge) |

Classes: mucosa `amb`, submucosa `mag`, both muscles `grn`, lymphoid `cyn`, grouping `cyn`, vessels and Tiles none,
Features `amb`, the gauge's `mag`. The submucosa's colour is red, which has no label class.

## Domain colours

The colours are the talk's atlas colours, from `MICRO_DATA.figures.atlas`:
- its stomach map: gastric glands orange `#f58020` for the mucosa, submucosa red `#d82a2a`, muscularis green
  `#2ca249` for the inner muscle;
- its small intestine's Peyer's patches: blue `#1a78b6` for the lymphoid patch.

The talk draws the muscularis as one domain, so the outer layer takes a lighter green `#9bd14b`. The vessels take the
palette's purple `#9268ad`. Without the figures, the same values are the fallback.

`domainColour(name)` gives these six for their names. For any other name it gives the first colour the talk's
atlas uses for that name, else a fixed categorical colour per name.

In the story these are not what shows: the engine hands every set the atlas set's `domainColour` through
`api().recolour(fn)` (mucosa blue, submucosa green, inner muscle orange, outer muscle red-orange, lymphoid violet,
vessels red), which repaints the wash and the gauge (final shot 7).

Drawn over pink H&E, a colour at a usual opacity turns muddy (green went olive). So the slide darkens by 20 % under
the domains, and each colour is pushed away from the stain it lies on before it is laid over at 58 %: the colour
plus 0.85 x (1 - 0.58) / 0.58 x (grey - stain), where the stain under each domain was read off a render of the
tissue set (mucosa `#a671a2`, submucosa `#e7a6c7`, muscle `#d05f91`, patch `#503775`, vessels `#e0a0c0`) and darkened
like the slide. A domain then reads as its own colour, not as a mix with pink.

## Cam views

| View | Value | Use |
| --- | --- | --- |
| `default`, `section` | `[0, 6, 3.2, 0, 0, 0]` | the whole slab (as the tissue set's `section`) |
| `tiles` | `[-20.6, 12, 1.7, -0.30, 0.11, -0.03]` | the left half at a slant, tiles drawing on |
| `matrix` | `[4, 9, 3.9, 0.06, 0.28, 0.05]` | the section and the matrix above it (kept: the engine's FIT for it was measured at this distance; the lifted tiles grew instead) |
| `close` | `[-9.9, 9, 0.42, -0.19, 0.15, -0.03]` | a few tiles on the mucosa/submucosa border with their links |
| `domains` | `[5, 5, 2.85, 0.02, -0.02, 0]` | the domain map with its labels |
| `age` | `[0, 8, 3.25, -0.06, 0.12, 0]` | the domain map and the gauge |

(`tiles` and `close` are computed from the slab's normal at their targets; the values above are rounded.)

## Explore

Controls:
- View (`view`): Section `section`, Tiles `tiles`, Features `matrix`, Neighbours `close`, Domains `domains`,
  Age `age`. The keys equal cam names.
- Age (`age`): `20`, `70`.

`explore(c)`: each view turns on its step and those before it:
- Section: nothing.
- Tiles: tiles.
- Features: tiles and features.
- Neighbours: tiles and adjacency.
- Domains: tiles, adjacency and domain.
- Age: as Domains plus the gauge.

`slide_age` is 1 when Age is 70 in the Domains and Age views. `slide_focus` is left to the engine.

`api()` returns:
- `domains`: graph names in order: mucosa, submucosa, inner circular smooth muscle, outer longitudinal smooth
  muscle, lymphoid tissue, blood vessels (as in `MICRO_DATA.graph`);
- `titles`: display names;
- `colours`;
- `shares`: `{ from: 42.9, to: 34.5, tiles: 372, here20, here70 }`: the preprint's example (% of gut slides) and
  this drawn section's shares by area at 20 and 70, one per domain in order (here20 `[34.3, 32.7, 14, 18, 0.5,
  0.5]`, here70 `[34.3, 26.2, 17.9, 20.5, 0.5, 0.5]`);
- `pick(raycaster)`: the domain index under the ray at the age now shown, or -1 off the tissue. It uses the same
  per-pixel rule as the wash (checked at each domain's anchor at 20 and 70);
- `domainColour(name)`;
- `recolour(fn)`: `fn(name)` gives `'#rrggbb'` or `[r, g, b]`; repaints the wash (with the same correction for the
  stain) and the gauge.

The set also exports `textures` and `dispose()`, which frees the tile texture, the matrix texture and the gauge
canvas texture, and the ghost if one was built.

## For the narrator

**Can say**:
- each slide is cut into small tiles;
- a vision model turns every tile into a list of numbers that describe it (its features);
- each tile then mixes in its neighbours' descriptions ("listens to its neighbours");
- tiles with similar descriptions are grouped, across all slides, into domains, and a pathologist names them
  afterwards: no labels were needed;
- here the domains are the gut wall's layers: mucosa, submucosa, two muscle layers, a lymphoid patch, vessels;
- in the gut, the submucosa falls from 42.9 % of the section at 20 to 34.5 % at 70 (`MICRO_DATA.examples`).

**Must not say**:
- that this is a real slide, a GTEx image or a patient's tissue. It is the tour's drawn section, stomach-like.
- that the tiles are to scale. The real method uses far smaller tiles: 162 million over 24,945 slides, about 6,500
  per slide.
- that the numbers, the matrix or the tints are the real model's. They are made from each tile's mix of layers plus
  noise, and the tint is a random projection of them.
- that the domain map was computed by H&E-UTAG. It comes from where the tissue set's layers are.
- that this section's submucosa is 42.9 % of it. Here it is 32.7 % of the area at 20 and 26.2 % at 70: it shrinks by
  the same fraction as the preprint's example (about a fifth). The gauge shows the preprint's numbers and says they
  are of gut slides.
- that the preprint says the muscle thickens with age in the gut. The shift of the others is illustrative ("the
  others take up the rest"). Connective tissue rising with age in many organs is a preprint finding.

## Performance

| Item | Value |
| --- | --- |
| Triangles | wash 14,880 (372 tiles x 20 quads); the graph draws the same geometry again when shown; lifted 10; bars 160; matrix 2; gauge 2 |
| Points / lines | none |
| Draw calls | 0 at rest (every part is hidden, not drawn invisibly); 1 for tiles or domains; up to 6 in the features step (wash, lifted, matrix, bars, plus graph or gauge when shown) |
| Textures | tile pages 40 x 36, matrix 32 x 16 (RGBA8, nearest); gauge canvas 512 x 196 |
| Build | 25-29 ms warm in headless Chromium, 36-73 ms on a page's first build (it measures each domain's area twice, about 150,000 samples) |

- The wash shader makes 3 texture fetches per fragment (nearest, from a tiny texture) and evaluates three layer
  lines and three ellipses with their `fwidth`s. Fill rate on a Quest up close is untested.
- `update` allocates nothing per frame (the gauge's canvas redraws only when its numbers change).

## Sources

- Buljan I, Bago-Horvath Z, Rendeiro AF, bioRxiv 2025 (doi 10.1101/2025.10.13.682110): H&E-UTAG; the gut submucosa
  example (`MICRO_DATA.examples`).
- The talk's atlas colours (`MICRO_DATA.figures.atlas`, the stomach and small intestine maps).
- The section and its layers: the tour's tissue set (textbook gastric wall).

## Final screenshots

`shots/slide-final-<k>.png` (640 x 400, all with `slide_ghost` 1):

| k | View |
| --- | --- |
| 0 | tiles drawing on (`slide_tiles` 0.6), section view |
| 1 | the lifted tiles and their columns of feature bars (`slide_feat` 0.4, `matrix` cam) |
| 2 | the feature matrix (`slide_feat` 1, `matrix` cam) |
| 3 | the network of tiles with messages, tints mixing (`slide_adj` 0.6, `close` cam) |
| 4 | the domains with their labels (explore's Domains view, `domains` cam) |
| 5 | age 70 with the gauge (explore's Age view, `age` cam) |
| 6 | focus on the submucosa (`slide_focus` 2) |
| 7 | as 5 in the atlas set's colours, as the story shows it (`api().recolour`) |

The domains from behind (az 160) were checked too: the overlay is on the face the camera sees (there the harness's
labels, which the engine would nudge apart, overlap).

# `slide`: one section, the method, the domains (file `sets/slide.js`)

The preprint's method, H&E-UTAG, shown on one section, in the tour's visual language for its tissue (its cell network
drawn over the section, the colours lighting up cell by cell, the lift into a 3D embedding). The section is cut into
tiles. A vision model describes each tile with numbers: every tile lights up with a mosaic of glowing blocks. A network
floats over the tiles, each joined to its neighbours; light runs along the links and the descriptions mix. The tiles
lift off into a 3D map of their mixed descriptions, where alike tiles gather into groups and take their colour; they
fly back down and colour the section: the domains. Then the domain map changes from age 20 to 70, as in the
preprint's gut submucosa example.

The set draws nothing of its own section. It is an overlay in **the tour's tissue set's frame** (the H&E section of
stomach wall, `tools/lbi/sets/tissue.js`, used unchanged), so the engine shows `tissue` and `slide` together, with the
same transform. `slide.js` copies what it needs from `tissue.js`: `layers()`, `plane()`, the centring, the lymphoid
aggregate `AG` and the zoom patch's artery and vein. If `tissue.js` changes its geometry, copy the change here too.

## How it is built

- **Tiles**: 40 x 12 square tiles (0.0525 a side) in the strip's own coordinates (s along the section, d depth),
  so they follow the slab's curve. A tile is kept when at least 30 % of it is tissue: 372 tiles. A tile's own domain
  (for its features and its group) is the main one among 64 samples; small structures count 2.4 times.
- **Domains to the pixel**: the domain map is not drawn per tile (at 40 x 12 its borders were staircases and the
  patch and vessels a tile or two). The wash classifies every pixel: the tissue set's layer lines (passed per
  column of the mesh as an attribute: mucosa / submucosa `b1`, submucosa / muscle `b2`, inner / outer muscle `bm`),
  then the two vessels and the lymphoid patch as ellipses over them, each border antialiased over a pixel. The
  domain colours still wash in tile by tile (the method assigns tiles; the real tiles are far smaller than these).
  - The patch: the tissue set's aggregate `AG` (an ellipse 0.097 x 0.067). The vessels: the zoom patch's artery and
    vein, with a halo of 1.6 times their size (their wall and the loose tissue round them). The tissue set's other,
    smaller vessels (placed by its own random numbers, not exported) stay in the submucosa.
- **The wash**: a grid that follows the slab, 20 quads per kept tile, drawn on whichever face the camera sees, a hair
  (0.0016) in front of it. One shader draws everything on the tiles: outlines, tints, the darkening under the
  features and the network (so their light reads), domain colours, borders, focus. It reads a small texture of three
  pages, 40 x 12 each, and the six domain colours as uniforms. Line widths come from `fwidth`, so lines stay crisp
  from afar and up close (in a headset too).
- **Features**: 16 numbers per tile, from the tile's mix of domains (a prototype per domain) plus noise. Message
  passing runs two rounds of "half its own, half its four edge neighbours' mean". A tile's colour (its *tint*) is a
  fixed random projection of these numbers, stretched to a bright range. Tints are shown before and after mixing.
- **The mosaics** (features): 5,952 instanced boxes without a floor, a 4 x 4 mosaic on every tile, each block as tall
  (up to 0.017) and as bright as one of the tile's numbers, in an even colour scale (indigo, teal, green, yellow). They
  stand on the face the camera sees (each block's frame is right-handed on either face). They light up in a wave from
  the close-up tile (the tile `T(16, 3)` on the mucosa / submucosa border, as the tour's network draws outwards from
  its zoom patch); with the network they lower to about half and settle to the mixed numbers.
- **The network** (neighbours): a lit node (an icosphere, radius 0.0062, with a soft halo facing the camera) floats
  0.05 over each tile in the tile's tint; 1,348 links join each tile to its eight neighbours, each a ribbon turned to
  the camera and shaded as a round tube, its colour running from one end's tint to the other's (diagonals thinner and
  fainter). Messages are two bright pulses on each link, one each way. Nodes and links appear in a wave from the
  close-up tile.
- **The map** (groups): the first three principal components of the mixed descriptions (power iteration), scaled so
  95 % of the tiles lie within 0.42 of the map's centre `[0.04, 0.55, 0.34]` (above the section, towards you), each
  drawn 45 % of the way towards its own kind's middle so the groups read apart (illustrative: the method clusters in
  the full description). The nodes lift in a staggered wave and arc out towards you into the map, grow a little and
  drift gently there; their colour turns to their group's (the domain colour, as the wash will lay it). Then they fly
  back down to their tiles and melt into the wash.
- **Gauge**: a small slab of dark glass (0.68 x 0.26 x 0.022) above the section's left half, at `[-0.5, 0.57, 0.06]`;
  its face is a canvas (redrawn only when the shown numbers change), its edges lit. It shows "Submucosa", the live
  share, a bar with ticks at 42.9 and 34.5, and "of gut slides at 20 years": the preprint's numbers, said to be of the
  gut's slides, not of this drawn section.
- **Blending**: the wash is premultiplied (`ONE, ONE_MINUS_SRC_ALPHA`), so one material lays translucent colour over
  the slide and adds glow; the mosaics and nodes are lit solids, the links and halos additive.

## Params

| Param | Meaning | Default |
| --- | --- | --- |
| `slide_a` | fade (applied by the engine) | 1 |
| `slide_tiles` | tile outlines draw on, each traced round its edge, in a diagonal sweep from left to right with some randomness. Each tile flashes faintly as it appears. Faint from afar (a fine mesh), brighter once a tile is big on screen. Fades to half as the neighbours come in. | 0 |
| `slide_feat` | the slide darkens and every tile's mosaic lights up, in a wave from the close-up tile (each block rises over 0.45 of the param). The mosaics stay while the network shows (lower, settling to the mixed numbers) and go as the tiles lift (`slide_group` 0-0.25). | 0 |
| `slide_adj` | each tile takes its own tint (0-0.25); the network appears in a wave from the close-up tile (nodes, then links), messages run along the links, and the tints and mosaics settle to the mixed ones (0.25-0.85). The slide darkens under it. | 0 |
| `slide_group` | 0..2. 0-1: the nodes lift off (staggered) and gather in the map, taking their group's colour; the links go (0-0.25). 1-2: they fly back down to their tiles and fade into the wash. The network's nodes show whenever this is between 0 and 2. | 0 |
| `slide_domain` | tiles take their domain colours one by one (each over 0.45 of the param, the last starting at 0.55). Inside a tile the colours follow the domains to the pixel, with clean light borders where two domains meet. The slide darkens by 20 % under them, then the colour lies over it at 58 % (74 % on the small patch and vessels). Works with or without the steps before it: on its own it washes the domains straight onto the H&E (the `slide` chapter). | 0 |
| `slide_age` | age 20 (0) to 70 (1): the submucosa / muscle border rises, so the submucosa loses the same fraction of itself as in the preprint's example (about a fifth). The inner / outer muscle border rises by 0.4 of that, so both muscle layers thicken (illustrative). The change runs along the section as a gentle wave (each place over 0.7 of the param), not where the strip has no muscle (its right end). In this section, by area: submucosa 32.7 % to 26.2 %, inner muscle 14.0 % to 17.9 %, outer muscle 18.0 % to 20.5 %, mucosa 34.3 %, patch and vessels 0.5 % each. The gauge's numbers follow linearly (42.9 % to 34.5 %, 20 to 70 years). | 0 |
| `slide_focus` | 0..6: domain index + 1 (0 none). That domain shows its colour (even without `slide_domain`), glows softly and gets bright borders; the rest dim, their borders too. In-between values blend between neighbouring indices. Only the focused domain's label shows. | 0 |
| `slide_gauge` | shows the gauge (and its label) even at age 20. The gauge also shows by itself once `slide_age` > 0. | 0 |
| `slide_ghost` | harness only: draws an instance of `SETS.tissue` under the overlay (built the first time it is > 0). The engine leaves it at 0 and shows the real tissue set. | 0 |

Every param looks right in between: tiles draw on one by one, mosaics and nodes appear in waves, colours wash in per
tile, the nodes' flights are eased arcs, and the borders glide with age. `update` reads only `S`. Time (`uTime`) drives
only the messages, the nodes' drift in the map and the focus glow.

**Suggested keyframes** (a = chapter start; these are the story's):
- `slide` (14-50): with the tissue set's section and zoom views, `slide_domain` 0 to 1 over about 5 s near the end
  (cam `domains`). `slide_tiles` stays 0, so only the wash and the borders show.
- `method` (85-130). Bring `slide_domain` back to 0 first, or the method starts from the finished map.
  - `slide_tiles` 0 to 1 at a+2..8 (cam `tiles`);
  - `slide_feat` 0 to 1 at a+9.5..15.5 (cam `matrix` from a+10.5);
  - `slide_adj` 0 to 1 at a+17.5..24 (cam `close` from a+18.5; hold a few seconds for the messages);
  - `slide_group` 0 to 1 at a+26.5..31 (cam `group` from a+28), 1 to 2 at a+32..35.5 with `slide_domain` 0 to 1 at
    a+32.5..36 (cam `domains` from a+35.5). Then hand over to `atlas_umap`.
- `age` (170-215): jump `slide_tiles`, `slide_feat`, `slide_adj` and `slide_group` to 0; with `slide_domain` 1, set
  `slide_gauge` 1 (cam `age`), then `slide_age` 0 to 1 over about 6 s.
- Focus: the engine sets `slide_focus` from the Domains tab, or as `api().pick` returns.

## Anchors (local coordinates; the tissue set's frame)

- `tiles` (the top-left tiles), `feat` (over the close-up tile's mosaic, a little right of it), `listen` (the close-up
  tile's node), `close` (just over the close-up tile), `cloud` (the map's top right, for its label), `cloudC` (the
  map's centre), `gauge` (the gauge's right edge).
- Domains: `mucosa` (s = 0.22), `submucosa` (s = 0.2), `inner` (s = 0.6), `outer` (s = 1.34), each in the middle of
  its layer at 20; `lymphoid` (the patch's right part), `vessels` (the artery); plus `muscularis` (the middle of
  both muscle layers). The mucosa, submucosa and inner muscle labels stack on the left, the patch, vessels and outer
  muscle along the section: no two of the six overlap in the `domains` and `age` views at 640 x 400 (measured).

## Labels (the set's own; at most six at once)

| Text | At | Shows |
| --- | --- | --- |
| Tiles | `tiles` | `slide_tiles` 0.15-0.45, until `feat`, `adj` or `domain` start |
| Features · a list of numbers a tile | `feat` | `slide_feat` 0.45-0.75, until `adj`, `group` or `domain` |
| Each tile · listens to its neighbours | `listen` | `slide_adj` 0.3-0.6, until `slide_group` or `slide_domain` |
| Alike tiles · gather: a domain each | `cloud` | `slide_group` 0.6-0.9, out by 1.05-1.35; not with a focus |
| Mucosa / Submucosa / Muscle · inner, circular / Muscle · outer, lengthwise / Lymphoid · patch / Blood vessels | domain anchors | `slide_domain` 0.62-0.95; with a focus only the focused one; lymphoid and vessels give way to the gauge |
| Gut submucosa · thins with age | `gauge` | with the gauge (its numbers are on the gauge) |

Classes: mucosa `amb`, submucosa `mag`, both muscles `grn`, lymphoid `cyn`, the method's steps `cyn`, vessels none,
the gauge's `mag`. The submucosa's colour is red, which has no label class.

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
vessels red), which repaints the wash, the nodes' group colours and the gauge.

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
| `matrix` | `[-20.1, 20, 0.56, -0.16, 0.12, -0.02]` | the mosaics close up at a slant, so the blocks stand out of the slide |
| `close` | `[-12.4, 24, 0.66, -0.14, 0.12, -0.01]` | the network over the close-up tile and its neighbours |
| `group` | `[-14, 10, 2.15, 0.02, 0.34, 0.24]` | the section and the map above it |
| `domains` | `[5, 5, 2.85, 0.02, -0.02, 0]` | the domain map with its labels |
| `age` | `[0, 8, 3.25, -0.06, 0.12, 0]` | the domain map and the gauge |

(`tiles`, `matrix` and `close` are computed from the slab's normal at their targets; the values above are rounded.)

## Explore

Controls:
- View (`view`): Section `section`, Tiles `tiles`, Features `matrix`, Neighbours `close`, Groups `group`, Domains
  `domains`, Age `age`. The keys equal cam names.
- Age (`age`): `20`, `70`.

`explore(c)`: each view turns on its step and those before it:
- Section: nothing. Tiles: tiles. Features: tiles and features. Neighbours: tiles, features and the network.
- Groups: tiles, the network, the map (`slide_group` 1) and the domain map at once (the explore Method tab's fourth step).
- Domains: tiles, the domain map (the nodes back down: `slide_group` 2). Age: as Domains plus the gauge.

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
  stain), the nodes' group colours and the gauge.

The set also exports `textures` and `dispose()`, which frees the tile texture and the gauge canvas texture, and the
ghost if one was built; `tileCount` (372) and `linkCount` (1,348).

## For the narrator

**Can say**:
- each slide is cut into small tiles;
- a vision model turns every tile into a list of numbers that describe it (its features);
- each tile is joined to the tiles around it, and mixes in their descriptions ("listens to its neighbours"): the
  messages run along the links;
- in a map of the mixed descriptions alike tiles gather; each group is a domain;
- tiles with similar descriptions are grouped, across all slides, into domains, and a pathologist names them
  afterwards: no labels were needed;
- here the domains are the gut wall's layers: mucosa, submucosa, two muscle layers, a lymphoid patch, vessels;
- in the gut, the submucosa falls from 42.9 % of the section at 20 to 34.5 % at 70 (`MICRO_DATA.examples`).

**Must not say**:
- that this is a real slide, a GTEx image or a patient's tissue. It is the tour's drawn section, stomach-like.
- that the tiles are to scale. The real method uses far smaller tiles: 162 million over 24,945 slides, about 6,500
  per slide.
- that the numbers, the mosaics, the tints or the map are the real model's. They are made from each tile's mix of
  layers plus noise; the tint is a random projection of them, and the map their first three principal components,
  drawn towards each kind's middle. Say "a list of numbers", not how many: the 16 here are drawn.
- that the domain map was computed by H&E-UTAG. It comes from where the tissue set's layers are.
- that this section's submucosa is 42.9 % of it. Here it is 32.7 % of the area at 20 and 26.2 % at 70: it shrinks by
  the same fraction as the preprint's example (about a fifth). The gauge shows the preprint's numbers and says they
  are of gut slides.
- that the preprint says the muscle thickens with age in the gut. The shift of the others is illustrative ("the
  others take up the rest"). Connective tissue rising with age in many organs is a preprint finding.

## Performance

| Item | Value |
| --- | --- |
| Triangles | wash 14,880 (372 tiles x 20 quads); mosaics 59,520 (5,952 boxes x 10); nodes 29,760 (372 x 80); links 2,696; halos 744; gauge 12. At most about 108,000 (features with the network) |
| Points / lines | none |
| Draw calls | 0 at rest (every part is hidden, not drawn invisibly); 1 for tiles or domains; 2 with the features; 5 with the network (wash, mosaics, links, nodes, halos); 3 with the map |
| Textures | tile pages 40 x 36 (RGBA8, nearest); gauge canvas 512 x 196 |
| Build | 170-270 ms in headless Chromium on a loaded machine (load average about 15), against 96-170 ms for the version before it in the same runs (the principal components, the instanced attributes) |

- The wash shader makes 3 texture fetches per fragment (nearest, from a tiny texture) and evaluates three layer
  lines and three ellipses with their `fwidth`s. Fill rate on a Quest up close is untested.
- `update` allocates nothing per frame (the gauge's canvas redraws only when its numbers change); the nodes, links and
  mosaics move in their vertex shaders.

## Sources

- Buljan I, Bago-Horvath Z, Rendeiro AF, bioRxiv 2025 (doi 10.1101/2025.10.13.682110): H&E-UTAG; the gut submucosa
  example (`MICRO_DATA.examples`).
- The talk's atlas colours (`MICRO_DATA.figures.atlas`, the stomach and small intestine maps).
- The section and its layers: the tour's tissue set (textbook gastric wall); its visual language for the cell network.

## Screenshots

In the harness with `slide_ghost` 1 (640 x 400): the tiles drawing on (`slide_tiles` 0.6, cam `tiles`); the mosaics
(`slide_feat` 1, cam `matrix`); the network with messages (`slide_adj` 0.5 and 1, cam `close`); the map (`slide_group`
1, cam `group`), with the domain map under it (`slide_domain` 1) and on the way down (`slide_group` 1.5); the domains
(Domains view); age 70 with the gauge. The overlay sits on whichever face the camera sees, so the back works too.

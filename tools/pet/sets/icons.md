# `PET_ICONS` - organ icons (file `sets/icons.js`)

One line icon per organ of `PET_DATA.organs`, in the style of the legend of the paper's Figure 2 (Geist et al., *Med*
2025): a clean outline of one line weight, round caps and joins, a few inner lines. With `glow` the same icon is drawn
neon, as in the organ network of the vision slide (a coloured blur, a translucent fill, a light core). Vector paths
(`Path2D`) on a 2D canvas: sharp at any size, no images, no fonts.

## API (a global, loaded after `sets/data.js`)

- `PET_ICONS.ids`: the 14 ids in `PET_DATA.organs` order: brain, thyroid, lungs, heart, liver, spleen, pancreas,
  kidneys, adrenal, intestine, muscle, marrow, fat, aorta.
- `PET_ICONS.draw(ctx, id, cx, cy, size, opts)`: draws one icon centred at (cx, cy) in a square of side `size`, in the
  context's own units (its transform is respected, a canvas scaled for `devicePixelRatio` stays sharp). `opts` (all
  optional):
  - `color`: any CSS colour (default white). Hex colours (`#rgb`, `#rrggbb`, as in `PET_DATA.organs[i].col`) also get
    the gradient fill and the light neon core; other CSS colours work, with a plain fill and a white core.
  - `width`: line width in the context's units. Default: about 7 % of `size` at 24 device pixels, easing to 4 % from
    80 pixels up (bolder when small).
  - `glow`: neon (the vision slide): two blurred passes in the colour, the line, a core line mixed 70 % towards white.
  - `fill`: alpha 0..1 of the outlines' fill (a soft top-to-bottom gradient). Default 0, or 0.28 with `glow`.
  - `detail`: `true` or `false` forces the inner lines on or off. By default they appear from 40 device pixels
    (the cell textures of the thyroid from 56 and of the marrow from 64, the colon's folds from 48). Below 40 some
    icons swap in simpler shapes (a smooth pancreas, a solid adrenal cap).
  - `alpha`: 0..1, multiplied with the context's `globalAlpha`.
  An id without an icon is drawn as the old stand-in (a circle with the first two letters of its short name).
- `PET_ICONS.atlas(THREE, px = 128)` returns `{ texture, canvas, uv(id) }`: all icons white on transparent in one
  `THREE.CanvasTexture` (a 4 x 4 grid of `px`-pixel cells in `ids` order, row by row from the top left; each icon fills
  86 % of its cell; the last cells stay empty). `uv(id)` is `[u0, v0, u1, v1]` for the texture as three.js uploads it
  (`flipY`; v up); an unknown id gets the empty last cell. Tint in the shader (colour times the texture's alpha).
  `px` is rounded to a power of two (16 to 1024) so mipmaps work everywhere. Cached per `px`: calling it twice returns
  the same object, so never dispose its texture in one set (others share it). Icons in the atlas have their detail
  (cells at 128 px and up).

## The icons (100 x 100 box, y down; front view, the person's right on the viewer's left)

| id | drawing |
| --- | --- |
| brain | two scalloped hemispheres seen from above, a double line between them, gyri inside |
| thyroid | the butterfly: two lobes and the isthmus; cobblestone follicles inside (as in the legend) |
| lungs | both lungs (the cardiac notch on the viewer's right), trachea with cartilage rings, bronchi branching |
| heart | a heart with an ECG trace across it (as the spec and the legend ask) |
| liver | the big right lobe tapering to the left lobe, the falciform line, the vena cava on top, the gall bladder |
| spleen | the visceral face: convex border, a notch on the upper border, the hilum with the splenic vessels fanning in |
| pancreas | head on the viewer's left, body and tail rising to the right; lobulated outline and the duct |
| kidneys | a pair of beans, hila facing inwards, pelvis and calyces, the ureters running down |
| adrenal | one kidney with the adrenal gland as a lumpy, filled cap on its upper pole (distinct from `kidneys`) |
| intestine | the colon as a frame (cut at the rectum, folds), the small intestine as a narrow tube meandering inside |
| muscle | a flexed arm as in the legend: forearm rising to a fist with knuckles, biceps, shoulder |
| marrow | a long bone with its head, the shaft cut open: spongy marrow inside, the cut end with a filled core |
| fat | a belly (sides, navel, the fold under it, the waistband): subcutaneous fat |
| aorta | the arch as a cut vessel rising from the heart and descending, its three branches on top |

## Using them

- In a set's own canvas (labels, node discs, the scatter axes, panels): `PET_ICONS.draw(ctx, id, x, y, 48,
  { color: organ.col })`; for the vision row's neon network `{ color: organ.col, glow: true }` on a dark or transparent
  canvas (leave about 20 % of `size` around an icon for the glow).
- In 3D: `const A = PET_ICONS.atlas(THREE)`; one material with `A.texture`, per instance the `uv(id)` rectangle and the
  organ's colour. For a glowing node, a disc texture of your own made with `draw(..., { glow: true })` looks better than
  the atlas.
- Cost (headless Chromium, software): 14 icons at 24 px in about 2 ms; 14 neon icons at 160 px in about 40 ms
  (the blur dominates: draw neon icons once into a texture, not every frame); a 256 px atlas in about 9 ms. Paths are
  built once per id on first use.

## For the narrator

The icons are pictograms, not anatomy to scale. Say "the paper's organ icons" if anything; never use the adrenal icon
for the kidneys or the reverse. `marrow` is drawn as a long bone (as in the paper's legend), while the paper measures
the marrow of the lumbar vertebrae L1 to L5; `fat` is the belly, as the paper measures subcutaneous fat between L1 and
L5; `muscle` is a flexed arm, while the paper measures the gluteus maximus.

## Testing

`tools/pet/shots/icons-test.html` (served from the repository root) draws every icon at 24, 64 and 160 px, white and
neon, the atlas and tinted copies by `uv`, and times them; `?big=a,b,c` draws some at 240 px; `?final=0..3` the
640 x 400 pictures. From `tools/pet/shots`: `node icons-shot.mjs <prefix> [dpr] [big|-] [final]`. Final pictures:
`shots/icons-final-0.png` (white), `-1` (neon), `-2` (24, 40 and 64 px), `-3` (a small neon network, the atlas).

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
  - `width`: line width in the context's units. Default: about 7 % of `size` at 24 pixels, easing to 4 % from 80
    pixels up (bolder when small), never under 1.15 device pixels.
  - `glow`: neon (the vision slide): two blurred passes in the colour, the line, a core line mixed 70 % towards white.
  - `fill`: alpha 0..1 of the outlines' fill (a soft top-to-bottom gradient). Default 0, or 0.4 with `glow` (filled
    glowing bodies; pass `fill: 0.5` for the vision row if it should glow more).
  - `detail`: `true` or `false` forces the inner lines on or off. By default they appear from 40 pixels (the cell
    textures of the thyroid from 56 and of the marrow from 64). Below 40 some icons swap in simpler shapes (a smooth
    pancreas, a solid adrenal cap, a single line for the windpipe, three upright runs for the small intestine, a
    filled core in the marrow's shaft); the thyroid shows coarse cells below 56. Pixels here count a device pixel ratio
    of at most 1.25, so an icon that is small on a phone's screen stays simple; the 1.15 px minimum line and the glow's
    blur use the real device pixels.
  - `alpha`: 0..1, multiplied with the context's `globalAlpha`.
  An id without an icon (also one such as `'constructor'`) is drawn as the old stand-in (a circle with the first two
  letters of its short name).
- `PET_ICONS.atlas(THREE, px = 128, opts)` returns `{ texture, canvas, uv(id) }`: all icons white on transparent in one
  `THREE.CanvasTexture` (a 4 x 4 grid of `px`-pixel cells in `ids` order, row by row from the top left; each icon fills
  86 % of its cell; the last cells stay empty). `uv(id)` is `[u0, v0, u1, v1]` for the texture as three.js uploads it
  (`flipY`; v up); an unknown id gets the empty last cell. Tint in the shader (colour times the texture's alpha).
  `px` is rounded to a power of two from 16 to 512 (mipmaps work everywhere; 512 px cells already make a 2048 px
  texture). By default the atlas is made for small sprites (node discs of 20 to 40 pixels): bold lines (7.5 % of the
  icon) and the simple shapes, without inner lines. `opts`: `detail: true` bakes the inner lines with thin lines (4 %),
  for icons seen large or close up; `width` sets the line width as a fraction of the icon. Cached per `px` and `opts`:
  calling it again with the same ones returns the same object, so never dispose its texture in one set (others share
  it).

## The icons (100 x 100 box, y down; front view, the person's right on the viewer's left)

| id | drawing |
| --- | --- |
| brain | two scalloped hemispheres seen from above, a double line between them, gyri inside |
| thyroid | the butterfly (a bow tie): two lobes tapering to their upper poles, a narrow isthmus low down; cobblestone follicles inside (coarse when small), as in the legend |
| lungs | both lungs (the cardiac notch on the viewer's right), the windpipe a narrow tube with cartilage rings (a line when small), bronchi branching |
| heart | a heart with an ECG trace across it (as the spec and the legend ask) |
| liver | the big right lobe tapering to the left lobe, the falciform line, the vena cava passing through the top, the tip of the gall bladder under the lower edge |
| spleen | an upright bean leaning to the midline: convex outer border, the hilum a hollow in the inner face with the splenic vessels branching into it |
| pancreas | head on the viewer's left, body and tail rising to the right; lobulated outline and the duct |
| kidneys | a pair of beans, hila facing inwards, each pelvis a funnel narrowing into its ureter, the ureters running down |
| adrenal | one kidney with the adrenal gland as a lumpy, filled cap on its upper pole (distinct from `kidneys`) |
| intestine | the colon as a lumpy frame (its haustra; cut at the rectum), the small intestine winding inside (three upright runs when small) |
| muscle | a flexed arm as in the legend: the fist on top (fingers curled), the forearm a straight band down to the elbow, the biceps bulging over the upper arm |
| marrow | a long bone with its two knobs, the shaft cut open: spongy marrow inside (a filled core when small), the cut end with a filled core |
| fat | a belly: the waist, the belly bulging out below the navel, the waistband of the briefs and the legs below: subcutaneous fat |
| aorta | the arch as a cut vessel: the ascending aorta rising from its bulging root, the descending aorta running on further down; three branches on top |

## Using them

- In a set's own canvas (labels, node discs, the scatter axes, panels): `PET_ICONS.draw(ctx, id, x, y, 48,
  { color: organ.col })`; for the vision row's neon network `{ color: organ.col, glow: true }` on a dark or transparent
  canvas (leave about 20 % of `size` around an icon for the glow).
- Draw on change, not every frame: each draw allocates a little (about 1 KB, 2 KB neon), and neon icons are slow.
- Drawing large to show small (a canvas shown as a smaller `<img>`, a texture on a small sprite): the defaults follow the
  canvas's own pixels, not the size people see, so pass `detail: false` and a `width` for the shown size (about 7 %
  of the icon as it is shown, in the canvas's units). For example an icon drawn at 44 px and shown at 18 px:
  `{ detail: false, width: 44 * 0.075 }`.
- In 3D: `const A = PET_ICONS.atlas(THREE)`; one material with `A.texture`, per instance the `uv(id)` rectangle and the
  organ's colour. The default atlas suits sprites and node discs; for icons seen large use
  `PET_ICONS.atlas(THREE, 256, { detail: true })`. For a glowing node, a disc texture of your own made with
  `draw(..., { glow: true })` looks better than the atlas.
- Cost (headless Chromium, software): a white icon at 24 px in about 0.07 ms, a neon one at 160 px in about 2 ms (14 in
  about 30 to 45 ms; the blur dominates: draw neon icons once into a texture, not every frame); a 128 px atlas in about
  2 ms and a 256 px one in about 10 ms once the paths exist, the first call of all (building every path) about 15 to
  20 ms. Paths are built once per id on first use; the parts in use are kept per id and level of detail.

## For the narrator

The icons are pictograms, not anatomy to scale. Say "the paper's organ icons" if anything; never use the adrenal icon
for the kidneys or the reverse. `marrow` is drawn as a long bone (as in the paper's legend), while the paper measures
the marrow of the lumbar vertebrae L1 to L5; `fat` is the belly, as the paper measures subcutaneous fat between L1 and
L5; `muscle` is a flexed arm, while the paper measures the gluteus maximus.

## Testing

`tools/pet/shots/icons-test.html` (served from the repository root) draws every icon at 24, 64 and 160 px, white and
neon, the atlas and tinted copies by `uv`, and times them; `?big=a,b,c` draws some at 240 px; `?cmp=a,b,c` some at
200 px, at 64, 40, 28 and 24 px white and neon, and as atlas sprites in node discs of 20 to 56 px (`&adet=1`: the
detailed atlas); `?final=0..3` the 640 x 400 pictures. From `tools/pet/shots`:
`node icons-shot.mjs <prefix> [dpr] [big|cmp=a,b,c|-] [final]`. Final pictures: `shots/icons-final-0.png` (white),
`-1` (neon), `-2` (24, 40 and 64 px), `-3` (a small neon network, the atlas), `-4` (the atlas in the `organs` set's
network, from the harness: `node shot.mjs organs "p=organs_a:1,organs_net:1,organs_measures:1&t=3&cam=8,6,2.6,0.06,0.28,0.4"
icons-insitu 900 560`).

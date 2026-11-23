# `tissue`: from tissue to cells (file `sets/tissue.js`)

Slides 36-41 (Rendeiro et al., Nature 2021; Abila et al., Nature Medicine 2026). An H&E-stained section of
stomach wall built from about 18,600 cells. Zoom in and every cell is there. Join the cells to their neighbours
and the tissue becomes a network. Switch to multiplexed imaging and the cells take the colours of their types.
Then 300 tissue regions lift off into a 3D embedding with loading arrows.

## How it is built

- **The section**: a thin slab (0.008 thick) about 2.1 long and up to 0.6 deep. In its own plane it is a gently
  curved, slightly tilted strip. Both ends bend a little towards the viewer. It stands upright, facing +z: the
  lumen and mucosa are on top, the muscle is below. It is centred on the origin.
- **Layers, top to bottom**:
  - mucosa: wavy pits lined by mucous cells; gland necks with pink parietal cells; gland bases cut across as
    round acini. Close up, their cells are pale and foamy (mucus-filled cytoplasm: pale bubbles in a fine lilac
    mesh), with crisp dark nuclei at the base (slides 39-40). At low power they read deep purple (slide 37).
    Lamina propria with immune cells. One lymphoid aggregate: a dense, irregular, dark nodule of lymphocytes
    that thins out towards a lumpy edge. The matrix under it carries a diffuse haematoxylin density, so it
    also reads as a dark nodule from far away;
  - muscularis mucosae: a thin pink band of smooth muscle;
  - submucosa: loose wavy collagen with white clefts, about 30 arteries, veins and lymphatics, two fat lobules
    and spindle fibroblasts;
  - muscularis propria: an inner layer cut across (rounded profiles in polygonal fascicles) and an outer layer
    cut along (long spindles; the clefts between bundles are staggered, tapering streaks of varying width).
- **Colour**: stain colours are computed with the Beer-Lambert law, from haematoxylin and eosin optical densities
  fitted to the slides. The slab shader draws the extracellular matrix from a stain map made at load, with
  procedural fibres that only appear when the camera is close. Far away it shows a pre-averaged copy of the cells.
  Close up, every cell is drawn as an elliptical splat that lies on the slab and turns with it, with its own
  nucleus. The foam of the gland cells only shows once a cell is about 14-34 px across. Below that size the
  cells keep their base colour (the low-power look), so near and far views agree. Cells sit on whichever face
  the camera sees, so the back works too. Splats fade out where a flat projected ellipse is a poor stand-in
  (very close and edge-on). They also fade from 250 px across and are culled at 400 px, and cells nearer than
  three cell radii are culled.
- **Counts**:

  | Kind | Count |
  | --- | --- |
  | Epithelial | 7,965 |
  | Immune | 1,541 |
  | Stromal | 1,795 |
  | Endothelial | 312 |
  | Smooth muscle | 6,964 |
  | Not cells (red blood cells, gland bodies) | 53 + 1,412 |

## Params

| Param | Meaning | Default |
| --- | --- | --- |
| `tissue_a` | fade (applied by the engine) | 1 |
| `tissue_graph` | network of neighbouring cells: thin dark lines join the nuclei and draw outwards from the zoom patch (radius 0.16 around it, 4,615 edges). It is a Delaunay-like triangulation that runs right across the glands, as on slide 40. Faint pulses run outwards through it. Lines fade as an edge gets shorter than about 6 px on screen (gone below 2 px), so at a distance they never merge into a blob. | 0 |
| `tissue_mark` | multiplexed imaging: dark-field look, cells coloured by type. It spreads outwards from the zoom patch, with cells lighting up one by one, so in-between values look good. The lines turn light. | 0 |
| `tissue_embed` | 300 regions lift off and fly to a 3D embedding in front of the slab (centre `[0, 0.03, 0.6]`). Regions near the zoom patch go first. Each cell rises a little and heads sideways towards its place at once, not straight out of the slab towards a close-up camera. Once lifted, a cell is a small round spark (at most 9 px in radius; about 2 px in the `embed` view). Cells in flight fade out within about 0.06-0.22 of the camera, so the swarm never flies through the viewer. Red blood cells and gland bodies fade as their own patch lifts. The slab fades to a faint, see-through glassy ghost (15% opacity, a dim tint of its look and a cool sheen at its cut edges). It stops writing depth, so nothing behind it is hidden from any side. Lifted cells drift gently round their places and the region glows breathe. Axes and five loading arrows grow from about 0.5. | 0 |

Every param looks right at 0, 0.5 and 1 and in between. Each look is a pure function of S and t. Time only
drives the pulses on the network, the drift of lifted cells and the breathing glows (in the shaders, through
`uTime`). `update` itself reads only S.

**Suggested keyframes** (these match the current `e3_story.js`; keep them):
- `graph` 0 to 1 at a+11..16, with the camera at `zoom`;
- `mark` 0 to 1 at a+18..21, still at the zoom, because the switch starts in the zoom patch;
- `embed` 0 to 1 at a+23..28.

Leave `graph` at 1 during `mark`: the light network on the fluorescence image looks good, and `embed` fades it
out by itself.

**Camera**: the camera should already be leaving the zoom when `embed` starts, and be well on its way by about
`embed` 0.1. The current `e3_story.js` does this: `cam(a + 21, 'tissue', 'zoom', 15, 'spin')`, then
`cam(a + 25, 'tissue', 'embed', -10)`, so the camera is mid-flight when the first cells lift off at a+23.
(Review 1 suggested holding the zoom until a+23. That is withdrawn.) The lift-off is now safe from the zoom
and mark cameras too, as explore needs: see `tissue-final-8.png`.

## Anchors (local coordinates)

- `mucosa` (upper mucosa, left of centre), `submucosa` (mid-section), `muscle` (lower right), `vessel` (the largest
  vessel), `zoom` (the zoom patch on the mucosa/submucosa boundary), `embed` (centre of the embedding).
- One representative cell per type, spread over the zoom view so their labels stay apart: `epi` (top left),
  `imm` (top right), `smc` (middle), `str` (bottom left), `endo` (the artery, bottom right). The labels run to the
  right of their anchors, so the right-hand anchors sit a little inside the frame.
- Loading-arrow tips: `load0` to `load4` (epithelial, immune, stromal, endothelial, smooth muscle).

## Labels (the set's own)

- The five cell types sit on representative cells in the zoom view: 'Epithelial gland cells', 'Immune cells',
  'Stromal fibroblasts', 'Endothelial vessel lining', 'Smooth muscle'. They show when `mark` > 0.5, before
  `embed` (they fade out over `embed` 0 to 0.04), and only while the camera is close enough for them to stay
  apart. The set measures how far apart their five anchors are on screen at every render, in `onBeforeRender`
  of the cell points. It uses units of the view's tangent, so the test means the same in a headset. The labels
  fade in as that spread grows from 0.2 to 0.3: fully shown from about 0.5 away, gone beyond about 0.8. They
  never pile up: not as the story camera pulls back, not while explore flies in from the section, and not
  when someone zooms out. No param or engine change is needed. Before the first render the gate is 0.
- When `embed` > 0.75, the same five names sit at the arrow tips.

At most five are visible at once. The engine's story labels (Glands / Loose tissue with vessels / Muscle on
`mucosa` / `submucosa` / `muscle`) fit the section view: I checked them in place.

## Cam views

| View | Value | Use |
| --- | --- | --- |
| `default`, `section` | `[0, 6, 3.2, 0, 0, 0]` | the whole slab |
| `zoom` | `[-2.4, 3, 0.25, zoom]` | face-on, dist 0.25: deep glands above, muscularis mucosae across the middle, submucosa with an artery and a vein below |
| `graph` | `[5.6, 5, 0.28, zoom]` | explore close-up for the cell network |
| `mark` | `[-10.4, 5, 0.42, zoom]` | explore close-up for markers |
| `embed` | `[-18, 14, 2.4, 0, 0.03, 0.6]` | the embedding |

## Explore

One control, View (label 'View'), with options Tissue (`section`), Cell network (`graph`), Markers (`mark`) and Embedding
(`embed`). The option keys equal cam names, so the engine flies to the matching view.
- Tissue: all params 0.
- Cell network: `graph` 1.
- Markers: `graph` 1, `mark` 1.
- Embedding: `mark` 1, and `embed` 1 once `c.t` >= 0.4 s. The camera is already pulling back from the close-up
  when the cells fly. If `c.t` is missing, `embed` goes to 1 at once.

## Exports

- `cellCount` (18,577 cells of the five types; the narrator can say "about 18,600" or "some 18,000 cells").
- `regionCount` (300).
- `types`: `[{name, css}]` for the five types, in order: epithelial `#ffd84a`, immune `#ff5a4b`, stromal
  `#3ee08f`, endothelial `#ff5ad9`, smooth muscle `#4d94ff`.
- `textures`: the three stain-map DataTextures, and `dispose()`, which calls `K.dispose(set)` and then frees
  them. `K.dispose` alone does not reach textures held in uniforms. The engine's own teardown in
  `e7_app.js` already frees them as well, and disposing a texture twice is harmless.

## For the narrator

**Can say**:
- "a slice of stomach wall, stained pink and purple";
- haematoxylin colours nuclei purple and eosin colours cytoplasm and collagen pink;
- glands at the surface, loose tissue with blood vessels, muscle below;
- zoomed in, it is made of cells;
- joining each cell to its neighbours turns the tissue into a network;
- imaging dozens of proteins at once tells the cell types apart;
- every sample (here: every region) becomes a point we can compare with the others;
- the arrows show which cell types pull samples in which direction.

**Must not say**:
- that this is a real patient's section, or real data from either paper;
- that the embedding or its groups are results. The section is an illustrative model (gastric body-like mucosa).
  The regions, their mix of five cell types and the PCA (centred log-ratios, top three components, with a
  little added scatter) are computed from this model at load.
- that the network is an exact Delaunay triangulation. Each nucleus's 12 nearest neighbours (within 0.028) are
  tested for the Delaunay empty-circle property and then made planar (shortest first). Away from the edge of the
  patch it matches a Delaunay triangulation, but very long edges are left out.
- "three muscle layers": the stomach has three (oblique, circular, longitudinal); this model shows two.

## Performance

| Item | Value |
| --- | --- |
| Points | 20,342 (20,042 splats + 300 region glows) |
| Line segments | 4,618 (4,615 network + 3 axes) |
| Triangles | about 44,000 (slab 43,680 + arrows) |
| Draw calls | 2 at rest, 3 with the network, 5 in the embedding. Hidden parts (network, region glows, axes, arrows) are switched off, not drawn invisibly. |
| Textures | 3 DataTextures (1024x512 + 2 x 512x256, RGBA8, mipmapped: about 4.2 MB) |

- Build: 208-306 ms in headless Chromium (this round's shots, load average about 1-2). In Node it took
  230-325 ms, against about 220 ms for the review-2 version at the same load. The new network costs about 35 ms
  (k-nearest 11-18, Delaunay test 8-10, planar pass 12-19) instead of about 10. The broken-up septa cost about
  10 ms more.
- The splats are point sprites, capped at 400 px; lifted cells are at most 20 px. The foam adds a few
  operations per fragment, for gland cells only and only close up. Fill rate and comfort at very close range in
  a headset are untested on a device.

## Sources

- Rendeiro et al., Nature (2021): imaging mass cytometry of tissue; regions compared in a low-dimensional space.
- Abila et al., Nature Medicine (2026).
- H&E optical densities: after Ruifrok & Johnston (2001), refitted to the slide colours.
- Histology is textbook gastric wall anatomy.

## Final screenshots

`shots/tissue-final-<k>.png`:

| k | View |
| --- | --- |
| 0 | the section |
| 1 | the zoom, H&E |
| 2 | the cell network (`graph` cam) |
| 3 | markers with the five labels (`mark` cam) |
| 4 | the embedding |
| 5 | the embedding from behind |
| 6 | the lymphoid aggregate close up |
| 7 | grazing close-up with the network |
| 8 | the lift-off at `embed` 0.2 from the zoom cam |
| 9 | markers from the section view: the labels stay hidden |

## Review 2: what changed

- **Lift-off through the camera** (major): this is the reviewer's fix with two changes.
  - The path's control point is `mix(position, aEmb, 0.35) + n * 0.1`, as suggested.
  - Cells in flight fade near the camera. I used `smoothstep(0.06, 0.22, -mv.z)` and tied the weight to the
    flight (`smoothstep(0, 0.08, f)`), not to the disc morph `q`. Cells are close to the eye early in the
    flight, while `q` is still small.
  - Lifted splats are capped at 9 px in radius, not 16. At 16, the view from the mark camera was still a dense
    field of 32 px discs (`tissue-fix2-m-1.png`). The normal `embed` view uses about 2 px, and inside the cloud
    (dist 0.9) about 6 px, so neither changes.
  - Red blood cells and gland bodies now fade as their own patch lifts. Before, they faded everywhere at once by
    `embed` 0.5. The empty gland rings left at the zoom (big translucent discs) are gone.
  - Explore waits 0.4 s (`c.t`) before the lift-off.
  - Shots from the zoom and mark cams at `embed` 0.1/0.2/0.3 and from a headset-like close view (dist 0.13)
    are in `shots/tissue-fix2-z-*`, `-m-*` and `-h-*`. They show sparks, not walls of discs.
- **Labels piling up**: I took the reviewer's second option, done inside the set. The set measures the on-screen
  spread of the five anchors, instead of adding a `tissue_near` param for the story to key. This needs no
  integrator work. It also covers orbiting and zooming out in explore, which a keyed param would not
  (`tissue-final-9.png`, `tissue-fix2-l-0/1.png`).
- **Slab depth while fading**: `depthWrite` only when it is not ghosting and `S.tissue_a > 0.97`.
- **Gland contrast**: the reviewer's colours alone (chief `he(0.42, 0.38)`) made the whole mucosa pale lilac at
  every distance (`tissue-fix2-far-1.png`, against `tissue-fix2-c-1.png` now), which loses slide 37's deep
  purple. So:
  - the base cytoplasm is lightened only a little (chief `he(0.58, 0.44)`, neck `he(0.5, 0.44)`, gland bodies
    paler too);
  - nuclei are darker, as suggested (`he(1.3, 0.35)`);
  - close up, a foam pattern in the splat shader (pale bubbles in a lilac mesh) makes gland cells pale and lacy,
    as on slides 39-40.
  Every vertex of the network now sits on a crisp dark nucleus (`tissue-final-2.png`).
- **Glands as holes in the network**: I did not raise KN or relax the angle test. Either would keep every chord
  across a ring of gland cells, and the chords cross each other, so each gland would fill with a star-shaped web.
  Instead, each candidate edge passes an exact local Delaunay test (cot alpha + cot beta >= 0 over the
  neighbours both ends know, with slack for the round rings). Then a planar pass keeps the shortest edges that
  cross nothing already kept. Glands are now triangulated across, as on slide 40, with 4,615 edges.
- **Outer muscle septa**: each row of clefts wanders on its own (spacing about 0.013-0.035) and breaks into
  staggered streaks that taper at their ends (about half the length shows). The half-width varies along the
  streak from 0.0003 to 0.0011.
- **Additive arrows**: registered with base 0.96, so they never write depth.
- **Cell count**: corrected to the exported figure. The figure changed again (18,577), because the new septa
  move a few muscle cells.

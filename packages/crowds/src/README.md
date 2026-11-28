# Protein crowds: the sources

A test bed on the Experiments set (`#crowds`): a cube of up to a million balls standing for proteins' parts, drawn two
ways and culled four ways, with a read-out of what each frame costs. The brief is `SPEC.md`; the package's own notes
`../README.md`; the app's notes `docs/agents/stories.md`, "Protein crowds".

```
node packages/crowds/src/build.mjs          # writes packages/crowds/main.js (--check: is it current?)
node tools/packages/scan.mjs                # then the index
node tools/lowpoly/build.mjs --only crowds  # after a change to minis.js
node packages/crowds/src/test-cull.mjs      # the hidden-cell test makes no hole (node only, a second)
node packages/crowds/src/sweep.mjs          # the sweep below (headless Chromium, about half an hour)
```

## The files

- `build.mjs`: the template's build, pasting first three of ppicell's files, read by path (never copied or changed):
  `structs.js` (`PPI_STRUCTS`, each molecule as a few coarse balls from the Protein Data Bank), `balls.js` (`BALLS.half`,
  the points' scale in a headset or on a page) and `crowd.js` up to its set (`CROWD`: the five kinds, their shares and
  colours, the cube's side). Rebuild after a change to any of them.
- `sets/cull.js`: `CULL.erode`, `CULL.sweep`, `CULL.TAU`, the hidden-cell test's sums, plain JavaScript (node tests it).
- `sets/crowds.js`: `CROWDS` (the packed tile) and the set: building in slices, the shaders, the pools of draws, the
  culling each frame, the controls.
- `engine/`: the template's, with the Balls and Culling tabs (`e4_explore.js`, `e6_panels.js`: HTML and headset twins),
  the read-out (`readLine`, `whatLine`, `cullLine`) and a 14-second story (`e3_story.js`).

## How it works

**The balls.** *Packed proteins*: one cube of cytoplasm 100 nm across packed as crowd.js packs its own (the kinds largest
first, each molecule a random spot and turn, kept where none of its balls overlaps another's by more than 10 %, a kind
stopping at its share or after 400 misses in a row) but wrapping round the cube's faces, so copies of it meet without a
seam. It is packed while the story loads, 25 ms a step. A crowd of n balls is a cube cut from copies of it, each copy
turned one of the cube's 24 ways (so the repeat does not show), scaled to the scene's 1.2 side: the more balls, the
smaller each. *Made-up cloud*: n balls at random, a fifth of the cube filled, the same kinds and colours. Both are seeded:
every device builds the same balls. Building runs in slices in the frame's build budget (`buildMs`: a few ms on a page,
1 ms in a headset), the old crowd drawn until the new one is done (a million balls: about 3.5 s on a page here).

**The grid.** The balls are sorted into a grid of cells (2 to 10 a side, about 1,500 balls a cell), each cell's balls
contiguous, in a random order within the cell. A draw is a *run* of neighbouring cells: one range of the buffer.

**Two ways of drawing**, the same balls:

- *Impostors* (as crowd.js): one point a ball, as big as the ball on screen; the fragment shader shades its round face
  as a sphere and, near, writes the sphere's true depth (`gl_FragDepth`) so balls meet as spheres do. Far ones write the
  depth of the ball's front instead (no `gl_FragDepth`). Points are capped at 256 pixels.
- *Meshes*: an icosphere (320, 80 or 20 triangles) drawn once a ball, instanced; each instance reads its ball from data
  textures by its number (`uBase + gl_InstanceID`, WebGL 2), so any run of balls is one draw with no buffers of its own.

Each pool of draws (impostor near, far; mesh 320, 80, 20) holds slots, objects sharing the pool's geometry, each with its
own material (one program) and a run set just before it is drawn (`onBeforeRender` sets the shared geometry's
`drawRange` or `instanceCount`, nothing else).

**Shading**: lit (a key light, shine and rim), flat (the colour alone, cheapest), outline (flat with a dark ring, as in
molecular illustrations). *Ambient shading*: each ball darkened by how crowded its neighbourhood is (a fine grid's counts,
smoothed over 3 x 3 x 3, at build time: nothing a frame). Shadows: not done; a shadow pass draws every ball again, so they
are not cheap. *Colour by cell* shows the grid; *by detail* shows what detail each run is drawn at (thinned ones red).

**Culling**, each frame on the CPU, from the page's camera or a headset's two eyes (their matrices from the last frame,
read only, with a 3 degree and 2 cm margin):

1. *Cells out of view*: a cell whose bounding sphere is outside every eye's frustum is not drawn.
2. *Detail by distance*: a cell's balls' size on screen picks its detail (impostors, at the cell's nearest point: true
   depth from 4 pixels of radius, else flat; meshes, at its middle: 320 triangles from 30 pixels, 80 from 6, else 20);
   at its nearest point under 1.5 pixels only a
   share of its balls, (size / 1.5)^2, is drawn (the first ones: the cell is shuffled), each enlarged so they cover what
   all would.
3. *Front to back*: the runs drawn nearest first (`renderOrder`), so the graphics card can reject hidden pixels before
   shading them. Cells are not merged across the order, so this costs draws.
4. *Hidden cells*: `CULL.sweep` gives each cell the least optical depth in front of it from an eye: each cell's opacity
   is its balls' count times their mean cross-section over the cell's face, eroded (each cell the least of its 3 x 3 x 3
   neighbours, outside the grid counting as empty), summed outward from the eye along the 26-neighbour steps, the least
   of every way in. A cell deeper than 18 for every eye is left out (a random line of sight gets through depth 18 with
   chance e^-18, and the erosion and the step count err the safe way; at 12 the sweep found a small hole in the packed
   crowd, whose molecules leave channels). `test-cull.mjs` casts rays into random crowds and finds no ray whose first
   ball is in a hidden cell; the sweep compares pictures with the switch off and on.

*Hold the culling* (Culling tab, or `&hold`) keeps the eyes still: walk out and see what is left out.

## What the sweep says

Measured on 28 November 2026 by `sweep.mjs` (headless Chromium, 1280 x 800, WebGL in SwiftShader: software on the
CPU). The packed proteins, the jiggle stopped; a frame is the story's whole frame run and waited for (the median of up
to 12). **Software frame times only compare the cases with one another**: they say nothing about a headset's frame
rate, and they are noisy (about 10 to 15 % between runs). The sweep ran in pieces (a full run takes over half an hour;
mesh cases over 26 to 30 million triangles take minutes a frame in software and were not run): the hidden-cell rows marked
* are from the first piece, with the threshold at 12 (now 18, below), the mesh detail rows marked + with an older rule.

**Outside** (the default view: the whole cube in view). Frame in ms; in brackets, the balls drawn where culling left some out.

| Balls | Drawn as | None | Out of view | Detail | Front to back | Hidden | All four |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10k | impostors | 75 | 72 | 93 | 69 | 74 | 72 |
| 10k | meshes (80 triangles) | 694 | 688 | 658 | 675 | 676 | 596 |
| 100k | impostors | 285 | 233 | 225 | 199 | 261 | 191 |
| 100k | meshes | 6,055 | 6,051 | 2,850 (3.1M tri) | 6,061 | 6,387 | 2,627 |
| 300k | impostors | 558 | 486 | 406 | 427 | 508 | 428 |
| 300k | meshes | 18,172 | 17,585 | 5,801 | 17,997 | 17,973 | 5,682 (6.0M tri) |
| 1M | impostors | 1,277 | 1,246 | 1,145 | 1,154 | 1,224 (988k) | 1,029 (988k) |
| 1M | meshes | not run (80M triangles) | | | | | |

**Inside** (the eye at the cube's middle, the crowd all round).

| Balls | Drawn as | None | Out of view | Detail | Front to back | Hidden | All four |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10k | impostors | 154 | 131 | 140 | 106 | 136 | 129 |
| 10k | meshes | 434 | 371 | 1,026+ | 364 | 391 | 1,102+ |
| 100k | impostors | 333 | 360 (76k) | 371 | 278 | 376 | 306 (76k) |
| 100k | meshes | 3,230 | 2,859 (76k) | 5,238 (15.9M tri) | 3,417 | 3,533 | 4,800 (76k, 13.3M tri) |
| 300k | impostors | 568 | 527 (177k) | 662 | 514 | 516 (298k) | 417 (176k) |
| 300k | meshes | 9,896 | 6,193 (176k) | not run (33M tri) | 10,393 | 9,352 | 7,811 (177k, 21.5M tri) |
| 1M | impostors | 1,101 | 1,002 (409k) | 980 | 995 | 608 (705k) | 495 (283k) |
| 1M | meshes | not run (80M tri) | not run (33M) | not run (86M) | | not run (56M) | not run (28M); 4,812 (140k, 13.8M tri)* |

Front to back draws each cell on its own: 6 to 8 draws at 10k, about 60 at 100k, 200 at 300k, 729 at a million (one an
eye in a headset, so twice that).

**gl_FragDepth and early depth rejection** (impostors, inside, every cell at one detail, no thinning):

| Balls | Impostors | Front to back off | Front to back on |
| ---: | --- | ---: | ---: |
| 100k | true depth (`gl_FragDepth`) | 347 | 284 |
| 100k | flat (the front's depth, no `gl_FragDepth`) | 306 | 231 |
| 1M | true depth | 1,092 | 917 |
| 1M | flat | 842 | 771 |

**No hole** (the share of pixels that change when a switch leaves cells out, a million balls, the jiggle stopped): cells
out of view, 0 % outside (none left out), inside (433 of 729 left out) and close (60). Hidden cells at threshold 12:
0 % outside (64 left out) but 0.035 % inside (496 left out): about 170 pixels where a ball beyond a channel between near
molecules showed through. At 18: 0 % inside (216 left out) and close (28). A packed crowd is not a random one, so the
threshold is set for it; it is not a proof, and a view where it fails may exist.

### How would we cull them efficiently?

Sort the balls once into a grid of cells, each cell a contiguous range of one buffer, and decide per cell on the CPU
each frame (under a millisecond for a thousand cells): a draw is then a run of neighbouring cells, and nothing is sent
to the graphics card again. Leave out cells out of view (both eyes in a headset): free and exact, worth little from
outside but 40 to 60 % of the balls once you stand in the crowd. Leave out cells hidden behind full ones with the
grid's optical depth: the largest saving inside a dense crowd (a million balls: 705k drawn instead of 999k, 608 ms
instead of 1,101; with all four, 283k and 495 ms), but it must be conservative, since a packed crowd has channels a
random one lacks. Detail by distance pays most for meshes seen from outside (a third of the triangles) and thins
sub-pixel balls; chosen per cell, it gives the near cells round an eye inside the crowd their finest mesh, so there it
costs more than one fixed detail. Front to back saved 10 to 25 % here even with `gl_FragDepth`, at the price of a draw a
cell; the flat impostors (no `gl_FragDepth`) were 15 to 25 % cheaper still. And draw impostors, not meshes: in software
they are 10 to 20 times cheaper, and a million balls of 80 triangles is 80 million triangles, far beyond any headset.

**What a Quest is expected to change (untested on a device).** A Quest is a tile-based mobile GPU, bound by fill rate
far more than this software renderer: two eyes of about 1,800 x 1,900 pixels each at 72 to 90 Hz. Every pixel drawn
over (overdraw) costs, and its early depth test (and the low-resolution depth pass of Adreno GPUs) is switched off by a
shader that writes `gl_FragDepth` and weakened by `discard`, which every impostor uses: so true depth only near
(detail on), flat impostors elsewhere, and front to back for those and for meshes. three.js r128 draws each eye on its
own (no multiview), so every draw counts twice: keep runs to a few hundred. Points are capped at 256 pixels here; what
size a Quest allows, the frame rate at each count, and how the thinning and the outline look in a headset are all
untested. The read-out (and the shell's own, B or Y twice) is there to measure it.

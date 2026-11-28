# Protein crowds: the sources

A test bed on the Experiments set (`#crowds`): a cube of up to a million balls standing for proteins' parts, drawn two
ways and culled four ways, with a read-out of what each frame costs. The brief is `SPEC.md`; the package's own notes
`../README.md`; the app's notes `docs/agents/stories.md`, "Protein crowds".

```
node packages/crowds/src/build.mjs          # writes packages/crowds/main.js (--check: is it current?)
node tools/packages/scan.mjs                # then the index
node tools/lowpoly/build.mjs --only crowds  # after a change to minis.js
node packages/crowds/src/test-cull.mjs      # rays find no hole left by the hidden-cell test (node only, about 10 s)
node packages/crowds/src/sweep.mjs          # the sweep below (headless Chromium; see its header for the flags)
```

## The files

- `build.mjs`: the template's build, pasting first three of ppicell's files, read by path (never copied or changed):
  `structs.js` (`PPI_STRUCTS`, each molecule as a few coarse balls from the Protein Data Bank), `balls.js` (`BALLS.half`,
  the points' scale in a headset or on a page) and `crowd.js` up to its set (`CROWD`: the five kinds, their shares and
  colours, the cube's side). Rebuild after a change to any of them.
- `sets/cull.js`: `CULL.erode`, `CULL.sweep`, `CULL.tauFor`, the hidden-cell test's sums, plain JavaScript (node tests it).
- `sets/crowds.js`: `CROWDS` (the packed tile, each kind's shadow share, `build`: the balls in slices) and the set: the
  shaders, sending the balls to the card a piece a frame, the pools of draws, the culling each frame, the controls.
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
1 ms in a headset): the build yields every few hundred balls (in node here 99 % of its slices take under 1 to 1.5 ms;
the longest single ones, 3 to 13 ms, are the large allocations and garbage collection, which a slice cannot split).
Then the balls go to the graphics card a piece a frame (impostors: a buffer of 131,072 balls, 3 MB; meshes: one of the
three textures, the positions' 16 MB at a million in one go), the old crowd drawn until the last piece is up (a million
balls: about 4 to 7 s on a page here, in software).

**The grid.** The balls are sorted into a grid of cells (2 to 10 a side, about 1,500 balls a cell), each cell's balls
contiguous, in a random order within the cell. A draw is a *run* of neighbouring cells: one range of the buffer.

**Two ways of drawing**, the same balls:

- *Impostors* (as crowd.js): one point a ball, as big as the ball on screen; the fragment shader shades its round face
  as a sphere and, near, writes the sphere's true depth (`gl_FragDepth`; WebGL 1 needs `EXT_frag_depth`, else they are
  drawn flat and the pane says so) so balls meet as spheres do. Far ones write the depth of the ball's front instead (no
  `gl_FragDepth`). A point is no bigger than the card allows (`ALIASED_POINT_SIZE_RANGE`, read once: 1,023 pixels in
  SwiftShader here; a Quest's is untested): a ball so near an eye that its point would pass that is left out of the
  points by their shader and drawn as a mesh of 320 triangles instead, from attributes filled each frame (the Culling
  tab counts them; a few at most outside the crowd). A point is also cut away whole once its middle leaves the
  screen, so a very large near ball can vanish at the screen's edge before it should; the near meshes cover the nearest.
- *Meshes*: an icosphere (320, 80 or 20 triangles) drawn once a ball, instanced; each instance reads its ball from data
  textures by its number (`uBase + gl_InstanceID`, WebGL 2), so any run of balls is one draw with no buffers of its own.

Each pool of draws (impostor near, far; mesh 320, 80, 20) holds slots, objects sharing the pool's geometry, each with its
own material (one program) and a run set just before it is drawn (`onBeforeRender` sets the shared geometry's
`drawRange` or `instanceCount`, nothing else).

**Shading**: lit (a key light, shine and rim), flat (the colour alone, cheapest), outline (flat with a dark ring, as in
molecular illustrations). *Ambient shading*: each ball darkened by how crowded its neighbourhood is (a fine grid's counts,
smoothed over 3 x 3 x 3, at build time: nothing a frame). Shadows: not done; a shadow pass draws every ball again, so they
are not cheap. *Colour by cell* shows the grid; *by detail* shows what detail each run is drawn at (thinned ones red).

**Culling**, each frame on the CPU, from the page's camera or a headset's two eyes (`HOST.xrEyes`, the shell's since
v228, hence `needs` 228: their matrices as three.js wrote them drawing the last frame, read only; in a session's first
frame, before three.js has written them, the last frame's choice is drawn again). Nothing is allocated a frame.

1. *Cells out of view*: a cell whose bounding sphere is outside every eye's frustum is not drawn. The sphere is padded by
   the largest ball, its jiggle (up to sqrt(3) x 0.12 of its radius) and, with detail on, a thinned ball's enlargement
   (up to 7 times). A headset's eyes are a frame old and shown a little later still, so there the margin is 3 degrees
   and 2 cm plus twice how far the head turned and moved in the last frame (decaying over a few frames). On a page the
   camera is current: no margin.
2. *Detail by distance*: a cell's balls' size on screen picks its detail (impostors, at the cell's nearest point: true
   depth from 4 pixels of radius, else flat; meshes, at its middle: 320 triangles from 30 pixels, 80 from 6, else 20);
   at its nearest point under 1.5 pixels only a
   share of its balls, (size / 1.5)^2, is drawn (the first ones: the cell is shuffled), each enlarged so they cover what
   all would.
3. *Front to back*: the runs drawn nearest first (`renderOrder`), so the graphics card can reject hidden pixels before
   shading them. Cells are not merged across the order, so this costs draws. While the crowd fades in or out (see-through)
   the order turns back to front, as blending needs.
4. *Hidden cells*: `CULL.sweep` gives each cell the least optical depth in front of it from an eye (below). A cell deeper
   than the threshold for every eye is left out; never while the crowd fades (its balls are see-through then).

**Hidden cells: what the test does and does not guarantee.** Each cell's opacity is the optical depth of a line one
cell long through it: the balls' discs over the cell's face, for the packed proteins each disc times its kind's *shadow
share* (the area its whole molecule hides, seen from 32 directions, over its balls' discs: 0.42 to 0.70, since a
molecule's balls overlap one another). Eroded (each cell the least of its 3 x 3 x 3 neighbours, outside the grid
counting as empty) and summed outward from the eye along the 26-neighbour steps, the least of every way in, charging
nothing for the eye's own cell (the eye may stand at its far face), this is a lower bound on the depth of every line of
sight into a cell *for a crowd scattered at random*. A random line gets through depth tau with chance at most e^-tau,
and no more lines end in hidden cells than there are pixels, so the threshold is ln(pixels / 0.01): on average at most
a hundredth of a pixel a frame wrongly left empty (18.4 on a 1280 x 800 page, about 20.4 for a Quest's two eyes).
For the packed proteins this is a well-founded rule, not a proof: their molecules are not random (they exclude one
another, which in theory hides more, and leave channels). `test-cull.mjs` casts rays into random crowds and into the
real packed build (a million balls, at its size, larger, and thinned), half of them aimed at the hidden cells nearest
the edge, and finds no first hit in a hidden cell; `sweep.mjs` compares pictures with the switch off and on.

The first version charged the eye's own cell in full, counted every ball's disc (about twice the molecules' shadow),
used a fixed threshold of 18 tuned on a few views, and put a ball clamped to the cube's lower faces into the wrong cell
(a rounding gave it the index -1: the row before's far cell). Honestly counted, a cell of the packed crowd is about 2.2
deep, so even a million balls (9 cells a side) are never deep enough to hide a cell at their own size: the switch now
leaves out nothing there, and leaves cells out only for the Larger size (twice the opacity) and the made-up cloud seen
from outside. The test fails the first version's rules on its hand-worked checks and on a dense random crowd (1,996 of
12,000 rays first in a hidden cell); its packed-crowd trials did not fail on the first version's rules (the real packed
crowd is more opaque than the model says), so they show the new rule safe, not the old one unsafe.

*Hold the culling* (Culling tab, or `&hold`) keeps the eyes still: walk out and see what is left out.

## What the sweep says

Measured on 28 November 2026 by `sweep.mjs` (headless Chromium, 1280 x 800, WebGL in SwiftShader: software on the CPU),
the packed proteins, the jiggle stopped. A frame is the story's whole frame run and waited for in the page; a case's
time is the median of as many frames as come in 24 frames or 8 seconds (the Frames column; the first version's rows,
below, often 5 to 8 frames, and its mesh rows from 100k up 1 to 3). **Software frame times only compare the cases with
one another**: they say nothing about a headset's frame rate. **Noise**: one case (outside, 100k impostors, no culling)
gave 239, 277, 275 and 272 ms in four runs (about 15 % apart); the first version's table had 285. So two numbers less
than about 15 % apart are called no difference here, and only differences within one run (one page) are compared
closer than that. Culling (ms) is the culling pass's own CPU time, the mean over the same frames.

**After the fixes** (this round; impostors only: the hidden-cell rule, the cells' bounds and the near meshes changed;
`--draws 0 --cases "none,hidden cells,all four"`, one run per view):

| View | Balls | None (ms, frames) | Hidden cells | All four (drawn) | Culling, all four (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| outside | 10k | 78 (24) | 84, none hidden | 79 (10k) | 0.10 |
| outside | 100k | 239 (24) | 252, none hidden | 252 (100k) | 0.10 |
| outside | 300k | 526 (16) | 560, none hidden | 437 (299k) | 0.16 |
| outside | 1M | 1,278 (7) | 1,351, none hidden | 1,136 (1.0M) | 2.51 |
| inside | 10k | 159 (24) | 150, none hidden | 150 (10k) | 0.15 |
| inside | 100k | 370 (22) | 368, none hidden | 310 (62k) | 0.13 |
| inside | 300k | 615 (14) | 566, none hidden | 471 (116k) | 0.22 |
| inside | 1M | 1,177 (7) | 1,308, none hidden | 846 (254k) | 0.30 |
| far | 1M | 820 (10) | | 99 (87k; detail alone 105) | 0.51 |

The culling pass took 0.06 to 0.3 ms a frame on this machine's CPU in most cases, up to about 1 ms with hidden cells at
a million and 2.5 ms with all four outside at a million (729 cells, sorted and swept); a headset's CPU is slower and
untested. Hidden cells at the packed size: nothing left out, so its rows differ from none only by noise and the cost
of the sweep.

**The first version's sweep** (before the fixes; kept for the other switches and for meshes, which this round did not
run again). It ran in pieces in one session: the outside rows from the first run (09:43, before the meshes' detail was
judged at a cell's middle: their Detail and All four marked +, as the inside 10k meshes'), the inside rows from a later run, the 1M outside
impostor row's None from the depth run. Its Hidden and All four columns are superseded (the rules above; marked *:
threshold 12 for the 1M inside meshes, 18 elsewhere). Every run that opened a page of a million meshes ended with the
browser gone (`Target page, context or browser has been closed`): the page draws frames of up to 80 million triangles
while it loads; `sweep.mjs` now skips such pages. Frame in ms; in brackets, balls drawn where culling left some out.

| View | Balls | Drawn as | None | Out of view | Detail | Front to back | Hidden* | All four* |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| outside | 10k | impostors | 75 | 72 | 93 | 69 | 74 | 72 |
| outside | 10k | meshes (80 triangles) | 694 | 688 | 658+ | 675 | 676 | 596+ |
| outside | 100k | impostors | 285 | 233 | 225 | 199 | 261 | 191 |
| outside | 100k | meshes | 6,055 | 6,051 | 2,850+ | 6,061 | 6,387 | 2,627+ |
| outside | 300k | impostors | 558 | 486 | 406 | 427 | 508 | 428 |
| outside | 300k | meshes | 18,172 | 17,585 | 5,801+ | 17,997 | 17,973 | 5,682 (6.0M tri) |
| outside | 1M | impostors | 1,277 | 1,246 | 1,145 | 1,154 | 1,224 (988k) | 1,029 (988k) |
| outside | 1M | meshes | browser gone | | | | | |
| inside | 10k | impostors | 154 | 131 | 140 | 106 | 136 | 129 |
| inside | 10k | meshes | 434 | 371 | 1,026+ | 364 | 391 | 1,102+ |
| inside | 100k | impostors | 333 | 360 (76k) | 371 | 278 | 376 | 306 (76k) |
| inside | 100k | meshes | 3,230 | 2,859 (76k) | 5,238 (15.9M tri) | 3,417 | 3,533 | 4,800 (76k, 13.3M tri) |
| inside | 300k | impostors | 568 | 527 (177k) | 662 | 514 | 516 (298k) | 417 (176k) |
| inside | 300k | meshes | 9,896 | 6,193 (176k) | not run (33M tri) | 10,393 | 9,352 | 7,811 (177k, 21.5M tri) |
| inside | 1M | impostors | 1,101 | 1,002 (409k) | 980 | 995 | 608 (705k) | 495 (283k) |
| inside | 1M | meshes | not run (80M tri) | not run (33M) | not run (86M) | | not run (56M) | 4,812 (140k, 13.8M tri) |

The first version's cells were also too big: the misplaced face balls stretched some far cells' bounds over the whole
cube, so *cells out of view* left out fewer than it should (a million inside: 433 of 729 then, 573 now, the picture the
same). Front to back draws each cell on its own: 6 to 8 draws at 10k, about 60 at 100k, 200 at 300k, 729 at a million
(one an eye in a headset, so twice that).

**gl_FragDepth and early depth rejection** (the first version; impostors, inside, every cell at one detail, no thinning,
one run):

| Balls | Impostors | Front to back off | Front to back on |
| ---: | --- | ---: | ---: |
| 100k | true depth (`gl_FragDepth`) | 347 | 284 |
| 100k | flat (the front's depth, no `gl_FragDepth`) | 306 | 231 |
| 1M | true depth | 1,092 | 917 |
| 1M | flat | 842 | 771 |

**No hole** (the share of pixels that change, by more than 24 in the three colours summed, when a switch leaves cells
out: a million packed balls, the jiggle stopped, one still picture per view; `--parts holes --views
default,inside,close`). Before the fixes: cells out of view 0 % outside (none left out), inside (433 of 729 left out)
and close (58); hidden cells 0 % outside (8 left out), inside (216) and close (28). After: cells out of view 0 % outside
(none), inside (573) and close (159); hidden cells left out none in the three views, so nothing to compare. Where the
new rule does hide cells, 0 % too: the made-up cloud outside (8 left out; `--what 0`) and the Larger size
outside (8) and inside (105; `--size 1.4`). One still picture a view is a check, not a proof.

### How would we cull them efficiently?

Sort the balls once into a grid of cells, each cell a contiguous range of one buffer, and decide per cell on the CPU
each frame (here 0.1 to 0.5 ms for most cases, up to 2.5 ms for 729 cells with every switch on; a headset's CPU is
untested): a draw is then a run of neighbouring cells, and nothing is sent to the graphics card again. Leave out cells
out of view (both eyes in a headset): exact; it leaves out nothing from outside, and standing inside a big crowd up to
about three quarters of the cells (a million: 573 of 729 now; the first version left out 433 and drew 409k of the
million balls, 1,101 to 1,002 ms), but in software the frame time follows the count only loosely. Detail by distance pays most where balls are small on screen: far away it thins sub-pixel balls
(a million seen from far: 87k drawn, 820 to 105 ms), and for meshes seen from outside it drew a third of the
triangles (the first version's rows); judged per cell, it gives the near cells round an eye inside the crowd their
finest mesh, so there it cost more than one fixed detail; for impostors in the outside and inside views it was mixed
(from 27 % faster to 24 % slower).
Front to back helped impostors only: 8 to 31 % in the first version's rows (in this round's repeats at 100k outside 8
to 14 %, within the noise between runs), even with `gl_FragDepth`, at the price of a draw a cell; the flat impostors
(no `gl_FragDepth`) were 12 to 23 % cheaper still. For meshes it gained nothing or lost in software (outside 100k
6,055 to 6,061 ms, inside 100k 3,230 to 3,417). Hidden cells, counted honestly, leave out nothing in this packed crowd
at its own size: it is not deep enough. The first version's large saving there (a million inside: 705k drawn) came
from overcounting the depth. It would pay in a denser or bigger crowd, and it must stay conservative. And draw
impostors, not meshes: in software they were 3 to 33 times cheaper (the None columns), which says little about a
graphics card, where meshes are not vertex-bound on the CPU; but a million balls of 80 triangles is 80 million
triangles a frame, which we expect is beyond a headset.

**What a Quest is expected to change (all untested on a device).** We expect a Quest's tile-based mobile GPU to be bound
by fill rate far more than this software renderer: two eyes of about 1,800 x 1,900 pixels each at 72 to 90 Hz, so every
pixel drawn over (overdraw) costs. Writing `gl_FragDepth` is generally documented to switch off a GPU's early depth
test, and `discard`, which every impostor uses, to weaken it; Adreno's own low-resolution depth pass we expect to
suffer likewise. So we would try true depth only near (detail on), flat impostors elsewhere, and front to back for the
impostors; whether front to back helps meshes on a Quest is an open question (it did not here). three.js r128 draws
each eye on its own (no multiview), so every draw counts twice; a guess, to be measured: keep runs to a few hundred.
What point size a Quest allows, the frame rate at each count, the culling's CPU time there, and how the thinning, the
near meshes and the outline look in a headset are all untested. The read-out (and the shell's own, B or Y twice) is
there to measure it.

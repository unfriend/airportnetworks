# Protein crowds: the brief

The owner, 28 November 2026: "I would be interested in using instanced balls to represent proteins like we do in the
crowds scene in ppicell; let's create an example scene under Experiments that has some sliders, for example for the
number of balls/proteins and settings like shading etc. for balls that represent proteins; also how would we cull them
efficiently."

Decided with the owner:

1. **Two ways of drawing, with a switch**, the same balls: sphere impostors as `packages/ppicell/src/sets/crowd.js`
   draws them (one point a ball, a lit sphere with its true depth) and instanced low-poly spheres with a few levels of
   detail.
2. **Two contents, with a switch**: a made-up cloud (seeded: nothing random differs between devices) and the crowd's
   real packed proteins (`PPI_STRUCTS`' coarse balls: ubiquitin, calmodulin, actin, GAPDH, tubulin), packed as crowd.js
   packs them, in bigger cubes, the packing in slices. ppicell's sources are read at build time by path, never copied
   or changed.
3. **Culling, each a switch whose effect can be read**: cells out of view (both eyes in a headset; the camera's
   matrices read, never a `getWorld*` call in a draw hook); detail by distance (far balls cheaper, sub-pixel ones
   thinned with the survivors enlarged); front-to-back order of cells (and what `gl_FragDepth` does to early depth
   rejection: measured); hidden cells (a cheap conservative CPU test on the grid that never makes a visible hole).
   *As built* (`README.md`, "Hidden cells"): the test is a lower bound on the optical depth in front of each cell for a
   random crowd, its threshold set from the pixels drawn (on average at most 0.01 pixel a frame wrongly left empty, for
   a random crowd); for the packed proteins it counts molecules, not balls (each kind's shadow share), and is checked by
   rays (`test-cull.mjs`) and by pictures (`sweep.mjs`), not proved. Honestly counted, the packed crowd at its own size is
   never deep enough to hide a cell; the test leaves cells out only for the made-up cloud seen from outside and at the
   Larger size.
4. **Shading**: lit, flat, outline; a cheap ambient shading from the grid's local density at build time; shadows only
   if cheap (they are not: a shadow pass draws every ball again).
5. **A measured sweep** (`sweep.mjs`), written up in `README.md` under "What the sweep says", with a plain answer to
   "how would we cull them efficiently" and what a Quest would change (untested on a device).

Rules kept: the story rules of `AGENTS.md`; `collab.state()` holds the controls (outcomes), never the camera, Hold or the
read-out; its shape is the package's own `v` (no `FORMAT` change: `tools/packages/SPEC.md`, "Shared rooms").

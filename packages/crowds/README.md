# Protein crowds (a story package)

A test bed, not a story (kick *Measuring*, on the Experiments set): a cube of up to a million balls standing for parts
of proteins, as in the crowd of Back into the cell, drawn two ways (sphere impostors, instanced low-poly meshes) and
culled four ways (cells out of view, detail by distance, front to back, cells hidden behind full ones), with a read-out
of what is drawn and what a frame costs. It answers "how many protein balls can we draw, and how do we cull them?".

- Made by: the app's authors. Open it from the Experiments set or with `#crowds`.
- Data: the packed crowd reads the Back into the cell story's molecules at build time (`packages/ppicell/src/sets/`:
  `structs.js`, each molecule's coarse balls from the Protein Data Bank, public domain; `crowd.js`'s kinds, shares and
  colours). The made-up cloud is a seeded random draw. Nothing to ask permission for.
- Narration: none.
- Sources, the method and the measured sweep: `src/README.md`; the brief: `src/SPEC.md`.

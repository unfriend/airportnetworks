# Tissue topology: The shape of tissue (`#topo`)

Where cells sit in a slide of liver, read at every scale at once: balls grow round the cells, pieces join and loops open and close. From 123 slides, a classifier learns which scales tell cirrhosis from healthy tissue, and maps it back onto every cell.

One of the app's own stories, a story package since it moved here (docs/packages-migration.md). Made by the app's authors;
its sources, its build and its notes are in `src/` (`src/README.md`, `src/SPEC.md` where there is one): `node packages/topo/src/build.mjs`
writes `main.js`, then `node tools/packages/scan.mjs`. Its data and the permission to show it: `docs/data-and-permissions.md`.

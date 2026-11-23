# Tissue microanatomy: Tissue and time (`#micro`)

Organs are built from small working units of cells. 24,945 slides of 40 tissues show which ones there are, how they connect, and which change as we age.

One of the app's own stories, a story package since it moved here (docs/packages-migration.md). Made by the app's authors;
its sources, its build and its notes are in `src/` (`src/README.md`, `src/SPEC.md` where there is one): `node packages/micro/src/build.mjs`
writes `main.js`, then `node tools/packages/scan.mjs`. Its data and the permission to show it: `docs/data-and-permissions.md`.

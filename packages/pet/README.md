# Whole-body PET: One scan, one system (`#pet`)

A PET scan sees every organ's sugar use at once. 658 scans make a network of organs that thins and tips towards a few hubs as health erodes; the aim is to read one scan against such a network.

One of the app's own stories, a story package since it moved here (docs/packages-migration.md). Made by the app's authors;
its sources, its build and its notes are in `src/` (`src/README.md`, `src/SPEC.md` where there is one): `node packages/pet/src/build.mjs`
writes `main.js`, then `node tools/packages/scan.mjs`. Its data and the permission to show it: `docs/data-and-permissions.md`.

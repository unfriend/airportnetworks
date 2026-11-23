# Swarm robotics: Robot gang (`#robots`)

A gang of robot vacuums in your room. In a headset they find your floor and walls, follow you about and bounce off the walls.

One of the app's own stories, a story package since it moved here (docs/packages-migration.md). Made by the app's authors;
its sources, its build and its notes are in `src/` (`src/README.md`, `src/SPEC.md` where there is one): `node packages/robots/src/build.mjs`
writes `main.js`, then `node tools/packages/scan.mjs`. Its data and the permission to show it: `docs/data-and-permissions.md`.

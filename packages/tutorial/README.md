# Introduction: Your guide (`#tutorial`)

A robot guide shows you how the app works in a headset: pointing, playing a story, exploring, the menu and shared rooms. Then a few tasks to practise.

One of the app's own stories, a story package since it moved here (docs/packages-migration.md). Made by the app's authors;
its sources, its build and its notes are in `src/` (`src/README.md`, `src/SPEC.md` where there is one): `node packages/tutorial/src/build.mjs`
writes `main.js`, then `node tools/packages/scan.mjs`. Its data and the permission to show it: `docs/data-and-permissions.md`.

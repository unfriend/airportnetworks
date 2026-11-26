// Cell stress test, a story package (tools/packages/SPEC.md): the cell map story's model cell, drawn with its own shaders,
// filled with as many made-up proteins and links as explore mode asks (250 to 20,000 proteins, 375 to 80,000 links), to
// read a headset's frame rate at each size. Nothing is data: the network is a seeded random draw (src/sets/cell.js).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by src/build.mjs from the app's kit (tools/engine/kit.js), the shared engine parts (tools/engine/) and the sets and
// engine files in src/: edit those, not this file.
HOST.register('@@KEY@@', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// the package's key (its folder's name, from story.json) and its files' addresses: everything it loads goes through
// HOST.pkgUrl, which gives each file's address with its fingerprint (a changed file is fetched anew)
const KEY = '@@KEY@@';
const pkgUrl = file => (HOST.pkgUrl ? HOST.pkgUrl(KEY, file) : `packages/${KEY}/${file}`);
// what the index says about this package (its title, its files), or null
const pkgMeta = () => (HOST.packages && HOST.packages.get(KEY)) || (HOST.meta && HOST.meta(KEY)) || null;
// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades sets in and out and drives them
// through their params (see SETS.x.params); the set contract is packages/lbi/src/SPEC.md, "What a set exports".
const SETS = {};
//@@SETS@@

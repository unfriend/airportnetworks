// Hidden connections in rare diseases of nerves and muscles: the motor unit, a multiplex network of
// 71 layers, a random walk, disease modules and endotypes, and what muscle and heart share. After the
// ISMB 2026 talk by Iker Núñez-Carpintero and Philipp Friedrich (LBI Network Medicine), on their data.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by packages/nmd/src/build.mjs from the tour's kit and the data, sets and engine parts in packages/nmd/src: edit those, not this file.
HOST.register('nmd', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
// NMD_DATA (the analysis data, packages/nmd/src/sets/data.js) comes first.
const SETS = {};
//@@SETS@@

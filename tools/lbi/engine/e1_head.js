// A glimpse into the future of network medicine: a 3D tour of the Ludwig Boltzmann
// Institute for Network Medicine, from the parts of a protein machine to whole bodies.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/lbi/build.mjs from the kit, sets and engine parts in tools/lbi: edit those, not this file.
HOST.register('lbi', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// ================================================================== SETS ==
// Each set is one 3D scene of the tour, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
const SETS = {};
//@@SETS@@

// Hidden connections in rare diseases of nerves and muscles: the motor unit, a multiplex network of
// 71 layers, a random walk, disease modules and endotypes, and what muscle and heart share. After the
// ISMB 2026 talk by Iker Núñez-Carpintero and Philipp Friedrich (LBI Network Medicine), on their data.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/nmd/build.mjs from the tour's kit and the data, sets and engine parts in tools/nmd: edit those, not this file.
HOST.register('nmd', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// =================================================================== KIT ==
//@@KIT@@
const K = makeKit(THREE);
const { smooth, clamp } = K;

// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
// NMD_DATA (the analysis data, tools/nmd/sets/data.js) comes first.
const SETS = {};
//@@SETS@@

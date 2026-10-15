// A glimpse into the future of network medicine: a 3D tour of the Ludwig Boltzmann
// Institute for Network Medicine, from the parts of a protein machine to whole bodies.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/lbi/build.mjs from the kit, sets and engine parts in tools/lbi: edit those, not this file.
HOST.register('lbi', function (HOST) {
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
// Each set is one 3D scene of the tour, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
const SETS = {};
//@@SETS@@

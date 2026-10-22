// Pass it on: how warnings, viruses and signals spread through networks, at three scales (an outreach story of the
// Ludwig Boltzmann Institute for Network Medicine, LBI-NetMed). A school of fish passes on a warning; the airports'
// globe carries an outbreak; the cell map's cell passes on a signal, and a protein in the wrong place stops it.
// The globe and the cell are the airports story's and the cell map story's own, taken unchanged from
// stories/airports.js and stories/spatial.js when this file is built (PASS_AIRPORTS, PASS_SPATIAL); the fish are new.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/pass/build.mjs from the tour's kit, those two stories and the sets and engine parts in tools/pass:
// edit those, not this file.
HOST.register('pass', function (HOST) {
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
// PASS_AIRPORTS and PASS_SPATIAL (the airports story's globe and the cell map story's cell, taken from those stories
// at build time) come first, then the sets: fish, globe, cell.
const SETS = {};
//@@SETS@@

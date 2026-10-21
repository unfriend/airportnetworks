// Endotypes: one disease, many mechanisms. Congenital myasthenic syndromes, from the junction between nerve and
// muscle to the protein network: seed genes, a random walk with restart, each gene's neighbourhood, a tree that
// splits only when the data say so, and the 12 endotypes it finds. After the ISMB 2026 poster "Introducing
// EndotypY: a Python package for network-based disease endotyping" by Chloé Bûcheron, Iker Núñez-Carpintero, Enes
// Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche (LBI Network Medicine, University of Vienna), on their
// run of EndotypY (github.com/menchelab/EndotypY).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/endo/build.mjs from the tour's kit, the muscle story's motor set and the data, sets and engine parts
// in tools/endo: edit those, not this file.
HOST.register('endo', function (HOST) {
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
// ENDO_DATA (the analysis data, tools/endo/sets/data.js) comes first, then the muscle story's disease groups
// (NMD_DATA, only for its motor set).
const SETS = {};
//@@SETS@@

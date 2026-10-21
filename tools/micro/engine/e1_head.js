// Tissue and time: how the body's organs are built from small working units, and how they change as we age. One H&E
// slide and what it shows, 24,945 slides of GTEx, the authors' method (H&E-UTAG: tiles, features, neighbours, domains),
// an atlas of 218 microanatomical domains, the network of organ architecture, what changes with age and with disease,
// and the contacts between domains. After Buljan I, Bago-Horvath Z, Rendeiro AF, "Systematic mapping of human tissue
// microanatomy reveals age-associated remodeling and resilience", bioRxiv 2025, doi 10.1101/2025.10.13.682110
// (CC BY-NC), the poster "Microanatomical organization of the human body and its changes with age" and the talk
// "Microanatomical principles of tissue organization and their change with age" (Iva Buljan, Rendeiro group; LBI for
// Network Medicine, CeMM, Medical University of Vienna), with Iva Buljan's network of organ architecture.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/micro/build.mjs from the tour's kit, the tour's PET body and tissue sets, the PET story's organ icons
// and the data, sets and engine parts in tools/micro: edit those, not this file.
HOST.register('micro', function (HOST) {
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
// MICRO_DATA (the preprint's numbers and the network of organ architecture, tools/micro/sets/data.js) comes first, then
// the PET story's organ icons (PET_ICONS); the tour's PET body and tissue sets (SETS.body, SETS.tissue) are used unchanged.
const SETS = {};
//@@SETS@@

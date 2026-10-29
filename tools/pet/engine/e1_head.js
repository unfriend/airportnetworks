// One scan, one system: the body as a metabolic network. A PET scanner and how it sees sugar, the organs of 658
// whole-body FDG-PET scans and their partial-correlation network, how it thins and tips towards a few hubs from health
// to disease (the paper's networks, each of a group of scans; the poster's next step, one network per scan and an
// index, is not told yet: see HANDOVER.md item 8 and docs/pet-poster-comparison.md). After Geist
// et al., "The metabolic organ connectome: A novel approach to measure allostatic load during health-to-disease
// transition", Med (2025) (CC BY 4.0), and the poster "Shaping a New Era in Nuclear Medicine" by Barbara K Geist,
// Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker (Division
// of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/pet/build.mjs from the tour's kit, the tour's PET body set and the data, organ icons, sets and engine
// parts in tools/pet: edit those, not this file.
HOST.register('pet', function (HOST) {
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
// PET_DATA (the paper's and the poster's numbers, tools/pet/sets/data.js) comes first, then the organ icons (PET_ICONS);
// the tour's PET body set (SETS.body) is used unchanged.
const SETS = {};
//@@SETS@@

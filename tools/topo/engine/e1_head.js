// The shape of tissue: where cells sit in a slide of liver, read at every scale at once. A liver lifts out of the
// tour's body and a slice of it falls flat as a glass slide; balls grow round 110 real cells, pieces join and loops
// open and close; the radius becomes height in a tower of scales, pulled apart into bars and two curves; 123 slides'
// curves, their main shapes and their scores, a classifier's wall and the weight it gives every radius; and a slide it
// never saw, scored cell by cell and mapped back onto the tissue. After the poster "topocyte: scale-resolved
// topological phenotyping of tissue architecture across spatial modalities" by Simon Schindler, André Rendeiro and Jörg
// Menche (Evaluation of the LBI for Network Medicine 2026). Every number is topocyte's, run on the authors' GTEx liver
// cohort (TOPO_DATA, decoded and looked up by TDATA): the story computes nothing scientific. Slides are numbered, never
// named; the tissue is drawn from the cells' positions and types, never an image.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/topo/build.mjs from the tour's kit and the data, look, sets and engine parts in tools/topo: edit
// those, not this file.
HOST.register('topo', function (HOST) {
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
// TOPO_DATA (topocyte's numbers, generated), TDATA (its decoders and lookups: no science) and TLOOK (the story's glass,
// tubes, ribbons, slides and cells) come first, then the tour's body set and the microanatomy story's organ models
// (ORGAN3D: only the liver is used), then the sets: slide, map, tower, cohort.
const SETS = {};
//@@SETS@@

// Three qubits: how a gene network fits on a tiny quantum computer. Why pairs of genes, two walkers on the network as
// on a map, why the map must shrink, the bisections that give each gene a code of bits, the coarse operator A_c on a
// cube, its building blocks (Pauli strings), the toolbox a quantum computer runs well (a Lie algebra) and what falls
// outside it (the residual), and the recipe as a short circuit. After the method and the figures of Joel Hancock (his
// brief for this visualization, "Prompt: visualize network compression and the Pauli decomposition", 21 Oct 2026, his
// figure of Pauli strings on a cube and his 3-qubit card). The networks shown are examples, computed here (QMATH); the
// real run's numbers (QUBITS_DATA, on STRING) appear only where the story says "in the real network". American
// spelling in this story only, as the brief asks.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/qubits/build.mjs from the tour's kit and the maths, data, look, sets and engine parts in tools/qubits:
// edit those, not this file.
HOST.register('qubits', function (HOST) {
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
// Each set is one 3D scene of the story, centered on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
// QMATH (the maths, computed live from example networks), QUBITS_DATA (the real run's numbers, typed in) and QLOOK (the
// story's lit tubes, rings, balls and halos) come first, then the sets: pairs, cube, chart.
const SETS = {};
//@@SETS@@

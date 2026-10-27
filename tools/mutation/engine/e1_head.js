// The mutation machine: DNA's changes as a quantum circuit. DNA as a text in four letters, copied with mutations; a
// family tree in 3D whose branches are as long as the change along them; each letter in two qubits; a rule of change
// (a substitution model) as a path through a pyramid of mixes; the compiler that turns it into a machine of gears, one
// per branch (the copy, the turn and the circuit); letters that work together in an RNA stem, and the coupling that
// keeps their pairs; and the ancestor of three species rebuilt three ways. After the poster "Converting Mutation into a
// Machinery: DNA Substitution Models as Quantum Circuits" by Enes Berk Sakalli and Arndt von Haeseler (a draft of 26 Oct
// 2026) and Enes's answers to our questions. The numbers drawn are examples, computed here (MMATH), as in the authors'
// own test; the poster's own numbers (MUT_DATA) appear only where the story says "in the authors' test".
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/mutation/build.mjs from the tour's kit and the maths, data, look, sets and engine parts in
// tools/mutation: edit those, not this file.
HOST.register('mutation', function (HOST) {
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
// MMATH (the maths, computed live from example numbers), MUT_DATA (the poster's numbers, typed in) and MLOOK (the
// story's lit tubes, rings, balls, tiles, qubits and gears) come first, then the sets: letters, tree, rule, stem.
const SETS = {};
//@@SETS@@

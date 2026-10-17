// The robot gang: robot vacuums that share a room with you. They follow one rule at a time - bump and turn, follow
// you, follow the one ahead - and who follows whom is a network: a star, or a chain. In a headset the room is your
// own, read from the headset's room setup. A short story, then the gang stays for as long as you do.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/robots/build.mjs from the tour's kit and engine (adapted) and the set in tools/robots: edit those, not this file.
HOST.register('robots', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// =================================================================== KIT ==
//@@KIT@@
const K = makeKit(THREE);
const { smooth, clamp } = K;

// ================================================================== SETS ==
// The one set: the gang, its room and you, life size (1 unit is 1 m, the floor
// at y = 0). The story drives it through its params.
const SETS = {};
//@@SETS@@

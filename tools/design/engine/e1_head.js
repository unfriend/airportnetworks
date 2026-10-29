// The design room: a table standing in the room with a small low-poly model of every prop (3D set) of the stories, in
// groups by story, and a stage where the one you pick stands bigger and turns, its card on the panel: what it shows,
// its size and frame, its params, its named views, what reuses it and its source. Not one of the stories: no
// narration and no chapters, it opens straight into the table.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/design/build.mjs from the tour's kit, the engine (adapted from the flock's) and the table set in
// tools/design, and the cards from tools/design/props.json: edit those, not this file. The models are lowpoly.js's.
HOST.register('design', function (HOST) {
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

// ================================================================= CARDS ==
//@@CARDS@@
const CARD_KEYS = Object.keys(DESIGN_CARDS);
// the stories in the shell's order (their colours and titles), then any the shell does not list
const STORIES = (() => {
  const L = (HOST.list || []).filter(s => CARD_KEYS.some(k => DESIGN_CARDS[k].story === s.key)).map(s => ({ key: s.key, kick: s.kick, title: s.title, col: s.col }));
  for (const k of CARD_KEYS) { const st = DESIGN_CARDS[k].story; if (!L.some(s => s.key === st)) L.push({ key: st, kick: st, title: st, col: '#95a6bd' }); }
  return L.map(s => Object.assign(s, { keys: CARD_KEYS.filter(k => DESIGN_CARDS[k].story === s.key) }));
})();
const storyOf = k => STORIES.find(s => s.key === (DESIGN_CARDS[k] || {}).story) || { key: '', kick: '', title: '', col: '#95a6bd', keys: [] };

// ================================================================== SETS ==
// The one set: the table, life size (1 unit is 1 m, the floor at y = 0), its plates, the miniatures and the stage.
const SETS = {};
//@@SETS@@

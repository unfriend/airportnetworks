// The design room: a table standing in the room with a small low-poly model of every prop (3D set) of the stories, in
// groups by story, and a stage where the one you pick stands bigger and turns, its card on the panel: what it shows,
// its size and frame, its params, its named views, what reuses it and its source. Not one of the stories: no
// narration and no chapters, it opens straight into the table.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/design/build.mjs from the tour's kit, the engine (adapted from the flock's) and the table set in
// tools/design, and the shell's own cards from tools/design/props.json: edit those, not this file. The miniatures and
// their cards are the story packages' own (packages/<key>/minis.js: tools/packages/SPEC.md, "Miniatures"), loaded
// before the table is laid out (takeCards), so a new package's miniatures stand on the table without a rebuild here.
HOST.register('design', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// ================================================================= CARDS ==
//@@CARDS@@
let CARD_KEYS = Object.keys(DESIGN_CARDS);
// the stories in the shell's order (their colours and titles), then any the shell does not list
const storiesOf = () => {
  const L = (HOST.list || []).filter(s => CARD_KEYS.some(k => DESIGN_CARDS[k].story === s.key)).map(s => ({ key: s.key, kick: s.kick, title: s.title, col: s.col }));
  for (const k of CARD_KEYS) { const st = DESIGN_CARDS[k].story; if (!L.some(s => s.key === st)) L.push({ key: st, kick: st, title: st, col: '#95a6bd' }); }
  return L.map(s => Object.assign(s, { keys: CARD_KEYS.filter(k => DESIGN_CARDS[k].story === s.key) }));
};
let STORIES = storiesOf();
// the packages' miniatures (M: LOWPOLY_MODELS, every listed package's file loaded) taken as cards: those with a card, by
// package in the table's order before the miniatures moved into the packages (v190: so the table looks as it did; a
// package it does not name comes after them, in the index's order)
const TABLE_ORDER = ['lbi', 'nmd', 'endo', 'pet', 'micro', 'ovary', 'qubits', 'mutation', 'topo', 'soil', 'cdk5', 'pass', 'flock', 'robots', 'tutorial', 'airports', 'proteins', 'spatial'];
function takeCards(M) {
  const pk = (HOST.packages ? HOST.packages.all() : []).map(m => m.key), rank = s => { const i = TABLE_ORDER.indexOf(s); return i >= 0 ? i : TABLE_ORDER.length + (pk.includes(s) ? pk.indexOf(s) : pk.length); };
  const keys = Object.keys(M || {}).filter(k => M[k] && M[k].card && typeof M[k].card === 'object' && M[k].card.story === M[k].story && !DESIGN_CARDS[k]);
  keys.map((k, i) => [rank(M[k].story), i, k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([, , k]) => { DESIGN_CARDS[k] = M[k].card; });
  CARD_KEYS = Object.keys(DESIGN_CARDS);
  STORIES = storiesOf();
}
const storyOf = k => STORIES.find(s => s.key === (DESIGN_CARDS[k] || {}).story) || { key: '', kick: '', title: '', col: '#95a6bd', keys: [] };

// ================================================================== SETS ==
// The one set: the table, life size (1 unit is 1 m, the floor at y = 0), its plates, the miniatures and the stage.
const SETS = {};
//@@SETS@@

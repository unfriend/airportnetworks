
// ================================================================ EXPLORE ==
// Explore mode: the multiplex tower with the analysis data. Pick a disease group, search a gene, run
// your own random walk, knock layers out, and pick endotypes to see how they connect layer by layer;
// or open the motor unit and the stress test with their own controls.
const SCENES = [
  ['tower', 'Multiplex network', 'The genes of 13 groups of neuromuscular disorders in up to 71 layers of evidence: modules, the walk, endotypes and the overlap of muscle and heart.'],
  ['motor', 'Motor unit', 'Nerve cell, myelinated axon, neuromuscular junction, muscle fibre, sarcomere and heart, with the disease groups where they strike.'],
  ['hpc', 'Stress test', 'The supercomputer and 680,000 networks with layers removed at random: the disease modules keep their originally detected genes until most layers are gone (the authors\' result; the picture is illustrative).'],
];
const TABS = [['groups', 'Diseases'], ['genes', 'Genes'], ['walk', 'Walk'], ['layers', 'Layers'], ['endo', 'Endotypes'], ['scenes', 'Scenes']];
const X = { tab: 'groups', scene: 'tower', ctl: {}, t0: 0, turn: 'on', group: -1, gene: -1, pick: [], off: new Set(), egroup: 5,
  walk: null, walkFrom: 5, mine: [], walkers: true, showZ: false, colour: 'group', grid: false, room: false, err: '' };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['tower_group', 'motor_site']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);

// ------------------------------------------------------------------ data --
// the analysis data, decoded once for the panels (the tower decodes its own copy for drawing)
const ND = (() => {
  const D = NMD_DATA, b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const term = s => (s ? s.split('.').map(i => D.terms[+i]) : []);
  const genes = D.genes.map(r => {
    const c = r.split('|');
    return { sym: c[0], endo: c[1].split('.').map(Number), seed: +c[2], added: +c[3], go: term(c[4]), hpo: term(c[5]), kegg: term(c[6]), ppi: c[7] === '1' };
  });
  const N = genes.length, L = D.layers.length;
  // links per layer, and each gene's partners per layer
  const E = new Uint32Array(b64(D.edges).buffer), XE = new Uint16Array(b64(D.extra).buffer);
  const count = new Int32Array(L), nb = genes.map(() => new Map());
  const add = (i, j, l) => { count[l]++; for (const [a, b] of [[i, j], [j, i]]) { let s = nb[a].get(l); if (!s) nb[a].set(l, s = []); s.push(b); } };
  for (let k = 0; k < E.length; k += 2) { const i = E[k] >>> 16, j = E[k] & 65535; for (let m = E[k + 1], p = 0; m; m >>>= 1, p++) if (m & 1) add(i, j, D.ppi[p]); }
  for (let k = 0; k < XE.length; k += 3) add(XE[k], XE[k + 1], XE[k + 2]);
  const bySym = new Map(genes.map((g, i) => [g.sym.toUpperCase(), i]));
  return { D, genes, N, L, count, nb, bySym, groups: D.groups, layers: D.layers };
})();
const TW = () => GL.sets.tower;
const inGroup = (i, g) => (((ND.genes[i].seed | ND.genes[i].added) >> g) & 1) === 1;
const isSeed = (i, g) => ((ND.genes[i].seed >> g) & 1) === 1;
const endoOf = (g, c) => ND.groups[g].endo.find(e => e.c === c) || { c, n: 0, name: '', terms: [] };
const endoLabel = (g, c) => { const e = endoOf(g, c); return `${c}${e.name ? ' · ' + e.name : ''}`; };
const ENDO_FALLBACK = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#b07bff', '#4d94ff', '#e6d23c', '#2fc4b2', '#ff8a3d',
  '#8fa8ff', '#d77bff', '#7be0ff', '#ffd27b', '#9ef07b', '#ff9ec4', '#c4b5fd', '#5eead4', '#fca5a5', '#e7eef8'];
const endoCss = c => (TW() && TW().endoColour ? TW().endoColour(c) : ENDO_FALLBACK[(c - 1) % ENDO_FALLBACK.length]);
const CAT = { ppi: ['Protein interactions', '#46d9ff'], coex: ['Co-expression', '#3ee08f'], pheno: ['Phenotypes', '#ff5ad9'],
  path: ['Pathways', '#ffb43b'], drug: ['Drug targets', '#ff5a4b'], ess: ['Essential genes', '#b07bff'] };
const CAT_ORDER = ['ppi', 'coex', 'pheno', 'path', 'drug', 'ess'];
// a group's z-score in a layer (protein layers only; null where none was computed)
const zOf = (g, l) => { const p = ND.D.ppi.indexOf(l); return p >= 0 ? ND.groups[g].z[p] : null; };
const layersOn = () => ND.layers.map((_, l) => !X.off.has(l));

// what the chosen scene and its controls ask for: that set fully in, every other set out
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the tower follows the panels on top of its own controls (Scenes tab): the picked group, its colours and
  // grid, a walk's heat and walkers, the room view
  if (X.scene === 'tower') {
    const g = X.group;
    tg.tower_group = g + 1;
    if (g >= 0 && (c.show === 'module' || c.show === undefined)) { tg.tower_seeds = 1; tg.tower_module = 1; }
    if (g >= 0 && X.showZ) tg.tower_z = 1;
    if (g >= 0 && X.colour === 'endo') tg.tower_endo = 1;
    if (g >= 0 && X.grid) tg.tower_grid = 1;
    if (X.walk) { tg.tower_heat = 1; if (X.walkers) tg.tower_walk = 1; }
    if (X.room) tg.tower_room = 1;
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it, standing inside, or among the supercomputer's racks
  if (X.turn === 'on' && !(X.room && X.scene === 'tower') && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// the tower's own display state: the picked gene, endotypes, knocked-out layers and a walk's result
function pushState() {
  const T = TW();
  if (T && T.setState) T.setState({ group: X.group, gene: X.gene, pick: X.pick.slice(), off: new Set(X.off), heat: X.walk ? X.walk.heat : null, walk: !!(X.walk && X.walkers) });
  updateExtraLabels();
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!same) sfxAct('whoosh', k, null, { dur: 1.2 });   // (sound effects: another scene)
  if (fly && !same) flyTo(view(k, X.room && k === 'tower' ? 'inside' : 'default'));
  renderScenes();
  updateExtraLabels();
}
const needTower = () => { if (X.scene !== 'tower') openScene('tower'); };
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : null;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  if (k === 'tower' && key === 'view' && (v === 'room') !== X.room) { setRoom(v === 'room'); if (v === 'room') { renderScenes(); return; } }
  X.t0 = performance.now();
  // some views have their own best camera (cam views named like the option); leaving one goes back to the scene's own view
  if (s.cam && s.cam[v]) flyTo(view(k, v));
  else if (s.cam && was && s.cam[was]) flyTo(view(k, 'default'));
  if (c) renderScenes();
}
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now(); orbit.fast = false;
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
}

// --------------------------------------------------------------- actions --
function selectGroup(g) {
  X.group = g;
  if (g >= 0) X.egroup = X.walkFrom = g;
  needTower(); pushState(); renderAll();
  if (g >= 0) sfxAct('pick', 'tower', () => TW().anchors.group(g));   // (sound effects: a disease group picked)
}
function selectGene(i, fly = true) {
  X.gene = i;
  if (i >= 0) {
    needTower();
    const a = TW() && TW().anchors && TW().anchors.gene ? TW().anchors.gene(i) : null;
    if (fly && a && !X.room) flyTo([orbit.cur[0], 14, 2.6, a[0], a[1], a[2]]);
    if (fly && a) sfxAct('pick', 'tower', a);   // (sound effects: a gene picked)
  }
  pushState(); renderGene(i); renderWalk();
}
function togglePick(g, c) {
  const k = X.pick.findIndex(([a, b]) => a === g && b === c);
  if (k >= 0) X.pick.splice(k, 1); else if (X.pick.length < 8) X.pick.push([g, c]);
  needTower(); pushState(); renderEndo();
  if (k < 0 && X.pick.some(([a, b]) => a === g && b === c)) sfxAct('pick', 'tower', () => TW().anchors.endo(g, c));   // (sound effects: an endotype picked)
}
function clearPick() { X.pick = []; pushState(); renderEndo(); }
function setLayer(l, on) {
  if (on !== !X.off.has(l)) sfxAct(on ? 'rise' : 'knock', 'tower', () => TW().anchors.layer(l), on ? { dur: 1 } : {});   // (sound effects: a layer back, or knocked out)
  if (on) X.off.delete(l); else X.off.add(l);
  pushState(); if (X.walk) runWalk(X.walk.from, true); renderLayers();
}
function setLayers(fn) {
  const n0 = X.off.size;
  X.off = new Set(ND.layers.map((L, l) => l).filter(l => !fn(ND.layers[l], l)));
  if (X.off.size > n0) sfxAct('knock', 'tower', null); else if (X.off.size < n0) sfxAct('rise', 'tower', null, { dur: 1 });   // (sound effects: layers out, or back)
  pushState(); if (X.walk) runWalk(X.walk.from, true); renderLayers();
}
// knock out k more layers that still have links, in a fixed shuffled order (the same each time)
function knockRandom(k) {
  const live = ND.layers.map((_, l) => l).filter(l => !X.off.has(l) && ND.count[l] > 0);
  let s = 7 + X.off.size; const n0 = X.off.size;
  for (let n = 0; n < k && live.length > 1; n++) { s = (s * 9301 + 49297) % 233280; X.off.add(live.splice(Math.floor(s / 233280 * live.length), 1)[0]); }
  if (X.off.size > n0) sfxAct('knock', 'tower', null);   // (sound effects: layers knocked out, if any were)
  pushState(); if (X.walk) runWalk(X.walk.from, true); renderLayers();
}
// a random walk from a group's seeds (from = group index) or from your own genes (from = 'mine'; own: those genes
// instead of the list, as when another person in a shared room ran it)
function runWalk(from, quiet, own) {
  const T = TW();
  const seeds = from === 'mine' ? (own || X.mine).slice() : ND.genes.map((_, i) => i).filter(i => isSeed(i, from));
  X.err = '';
  if (!seeds.length) { X.walk = null; X.err = 'Add at least one gene to walk from (search a gene, then press Walk from here).'; }
  else if (!T || !T.walk) { X.walk = null; X.err = 'The walk is not available.'; }
  else {
    const weights = from === 'mine' ? null : ND.layers.map((_, l) => { const z = zOf(from, l); return z !== null && z >= 1.645 ? z : 0; });
    const r = T.walk(seeds, { on: layersOn(), weights: weights && weights.some(w => w > 0) ? weights : null, group: from === 'mine' ? -1 : from });
    X.walk = { from, seeds, heat: r.heat, top: r.top.slice(0, 15) };
  }
  if (!quiet) needTower();
  pushState(); renderWalk();
  // (sound effects: a walk started: a pulse at its seeds as the walkers set out)
  if (!quiet && X.walk) { const at = from === 'mine' ? () => TW().anchors.gene(X.walk.seeds[0]) : () => TW().anchors.group(from); sfxAct('pulse', 'tower', at); sfxAct('patter', 'tower', at, { dur: 2, pitch: 1.3, gain: 0.3, delay: 0.3 }); }
}
function clearWalk() { X.walk = null; X.err = ''; pushState(); renderWalk(); }
function addMine(i) { if (i >= 0 && !X.mine.includes(i) && X.mine.length < 12) X.mine.push(i); X.walkFrom = 'mine'; renderWalk(); }
function setRoom(on) {
  if (on && !X.room) sfxAct('rise', 'tower', 'mid', { dur: 1.5 });   // (sound effects: the tower opens round you)
  X.room = on;
  if (XR.on) xrRoom(on);
  // on screen the camera goes into the middle; in the headset the tower comes round you, and leaving it the usual view returns
  if (X.scene === 'tower') flyTo(view('tower', on ? 'inside' : 'default'));
  if (X.ctl.tower && (X.ctl.tower.view === 'room') !== on) X.ctl.tower.view = on ? 'room' : 'tower';
  document.querySelectorAll('[data-ctl="room"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and its controls, the picked group,
// gene and endotypes, the knocked-out layers, your genes, the walk and its settings. Turning and standing inside
// are each person's own view (a tower view of Room counts as Tower). The walk is worked out the same way on every
// device, so it travels as where it started: a group, or the genes it started from.
const ctlShared = (k, c) => { const v = ctlValue(k, c); return k === 'tower' && c.key === 'view' && v === 'room' ? 'tower' : v; };
const walkShared = () => (X.walk ? (X.walk.from === 'mine' ? X.walk.seeds.slice() : X.walk.from) : null);
const offShared = () => [...X.off].sort((a, b) => a - b);
// shared rooms: the scene's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere (a pick, a view arriving)
function collabView() {
  if (APP.mode !== 'explore' || orbit.to) return null;
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r((((c[0] + 180) % 360) + 360) % 360 - 180, 10), r(c[1], 10), r(c[2], 100), r(c[3], 100), r(c[4], 100), r(c[5], 100)];
}
function collabSetView(v) {
  if (APP.mode !== 'explore' || !Array.isArray(v) || v.length !== 6 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[0] += 360 * Math.round((c[0] - to[0]) / 360);
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries((GL.sets[k].controls || []).map(c => [c.key, ctlShared(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, group: X.group, gene: X.gene, pick: X.pick.map(p => p.slice()), egroup: X.egroup,
    off: offShared(), mine: X.mine.slice(), from: X.walkFrom, walk: walkShared(), walkers: X.walkers,
    colour: X.colour, grid: X.grid, z: X.showZ };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const NG = ND.groups.length, J = JSON.stringify, int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  const genes = a => (Array.isArray(a) && a.length <= 12 && a.every(i => int(i, 0, ND.N)) && new Set(a).size === a.length ? a : null);
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.group === -1 || int(v.group, 0, NG)) && v.group !== X.group) selectGroup(v.group);
  if (int(v.egroup, 0, NG) && v.egroup !== X.egroup) { X.egroup = v.egroup; renderEndo(); }
  if (['group', 'endo'].includes(v.colour) && v.colour !== X.colour) { X.colour = v.colour; renderGroups(); }
  if (typeof v.grid === 'boolean' && v.grid !== X.grid) { X.grid = v.grid; renderGroups(); }
  if (typeof v.z === 'boolean' && v.z !== X.showZ) { X.showZ = v.z; renderGroups(); }
  if ((v.gene === -1 || int(v.gene, 0, ND.N)) && v.gene !== X.gene) { $('#q').value = v.gene >= 0 ? ND.genes[v.gene].sym : ''; selectGene(v.gene, false); }
  if (Array.isArray(v.pick) && v.pick.length <= 8 && v.pick.every(p => Array.isArray(p) && int(p[0], 0, NG) && endoOf(p[0], p[1]).n) && J(v.pick) !== J(X.pick)) {
    X.pick = v.pick.map(p => [p[0], p[1]]); pushState(); renderGroups(); renderEndo();
  }
  const mine = genes(v.mine);
  if (mine && J(mine) !== J(X.mine)) { X.mine = mine.slice(); renderWalk(); }
  if ((v.from === 'mine' || int(v.from, 0, NG)) && v.from !== X.walkFrom) { X.walkFrom = v.from; renderWalk(); }
  if (Array.isArray(v.off) && v.off.every(l => int(l, 0, ND.L)) && J([...new Set(v.off)].sort((a, b) => a - b)) !== J(offShared())) {
    const off = new Set(v.off); setLayers((L, l) => !off.has(l)); renderWalk(); renderEndo();
  }
  if (typeof v.walkers === 'boolean' && v.walkers !== X.walkers) { X.walkers = v.walkers; pushState(); renderWalk(); }
  if (J(v.walk) !== J(walkShared())) {
    if (v.walk === null) clearWalk();
    else if (int(v.walk, 0, NG)) runWalk(v.walk, true);
    else if (genes(v.walk) && v.walk.length) runWalk('mine', true, v.walk);
  }
  // the scene and its controls last: the panes above bring the tower back; a control flies to its own view as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of GL.sets[k].controls || []) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (x === 'room' || !c.options.some(o => o[0] === x) || ctlShared(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
}

// ------------------------------------------------------------- search --
// genes by symbol first, then by a GO process, phenotype or pathway they carry
function matches(q, limit) {
  q = String(q == null ? '' : q).trim().toUpperCase();
  if (!q) return [];
  const res = [];
  ND.genes.forEach((g, i) => {
    const s = g.sym.toUpperCase();
    let r = -1;
    if (s === q) r = 0; else if (s.startsWith(q)) r = 1;
    else if (q.length >= 4 && [...g.go, ...g.hpo, ...g.kegg].some(t => t.toUpperCase().includes(q))) r = 3;
    if (r >= 0) res.push([r, i]);
  });
  return res.sort((a, b) => a[0] - b[0] || ND.genes[a[1]].sym.localeCompare(ND.genes[b[1]].sym)).slice(0, limit || 8).map(r => r[1]);
}
const findGene = s => { const i = ND.bySym.get(String(s || '').trim().toUpperCase()); return i === undefined ? (matches(s, 1)[0] ?? -1) : i; };
const groupsOf = i => ND.groups.map((G, g) => g).filter(g => inGroup(i, g));
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    items = matches(input.value, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(ND.genes[i].sym)}</b><span>${esc(ND.genes[i].go[0] || '')}</span><em>${esc(groupsOf(i).map(g => ND.groups[g].short).join(', '))}</em></li>`).join('');
    list.classList.add('on'); input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', () => { hi = -1; render(); });
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!items.length) return;
      hi = (hi + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; render(); ev.preventDefault();
    } else if (ev.key === 'Enter') {
      const pick = hi >= 0 ? items[hi] : null;
      close(); onPick(pick, input.value); ev.preventDefault();
    } else if (ev.key === 'Escape') close();
  });
  list.addEventListener('mousedown', ev => {
    const li = ev.target.closest('li');
    if (li) { ev.preventDefault(); close(); onPick(+li.dataset.i, input.value); }
  });
}
function runQuery(q) {
  showTab('genes');
  const i = findGene(q);
  if (i >= 0) { $('#q').value = ND.genes[i].sym; selectGene(i); } else { X.gene = -1; pushState(); renderGene(-2, q); }
}

// ------------------------------------------------------------------ panes --
const QUICK = ['TTN', 'MYH7', 'DES', 'RYR1', 'DMD', 'SCN4A', 'CHRNE', 'SOD1'];
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;
const hbar = (label, v, max, col, attrs) => `<div ${attrs || ''} style="display:grid;grid-template-columns:minmax(0,1fr) 46%;gap:8px;align-items:center;font-size:13px;margin:3px 0;${attrs ? 'cursor:pointer' : ''}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span><span style="display:block;height:9px;border-radius:2px;background:${col};width:${Math.max(2, Math.round(100 * Math.max(0, v) / (max || 1)))}%"></span></div>`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-groups" role="tabpanel"></div>
    <div class="pane" id="pane-genes" role="tabpanel">
      <div class="search"><input id="q" type="search" placeholder="Search a gene, or a process like sarcomere" autocomplete="off" spellcheck="false" aria-label="Search genes" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
      <div id="ginfo"></div>
    </div>
    <div class="pane" id="pane-walk" role="tabpanel"></div>
    <div class="pane" id="pane-layers" role="tabpanel"></div>
    <div class="pane" id="pane-endo" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  attachSuggest($('#q'), $('#qs'), (i, text) => { if (i !== null && i !== undefined) { $('#q').value = ND.genes[i].sym; selectGene(i); } else runQuery(text); });
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      group: () => selectGroup(n), z: () => { X.showZ = !X.showZ; renderGroups(); }, colour: () => { X.colour = v; renderGroups(); },
      grid: () => { X.grid = !X.grid; renderGroups(); }, gene: () => { $('#q').value = ND.genes[n].sym; showTab('genes'); selectGene(n); },
      pick: () => { const [g, c] = v.split(':').map(Number); togglePick(g, c); }, egroup: () => { X.egroup = n; renderEndo(); },
      clearpick: clearPick, layer: () => setLayer(n, X.off.has(n)), layers: () => setLayers({ all: () => true, ppi: L => L.cat === 'ppi', data: (L, l) => ND.count[l] > 0, cores: L => /_core$/.test(L.key) || !/^(ppi|coex)_/.test(L.key) }[v]),
      knock: () => knockRandom(n), from: () => { X.walkFrom = n; renderWalk(); }, run: () => runWalk(X.walkFrom), clearwalk: clearWalk,
      walkers: () => { X.walkers = !X.walkers; pushState(); renderWalk(); }, mine: () => { addMine(n); showTab('walk'); },
      unmine: () => { X.mine = X.mine.filter(i => i !== n); renderWalk(); }, scene: () => openScene(v), ctl: () => setCtl(X.scene, b.dataset.ctl, v),
      quick: () => { $('#q').value = ND.genes[n].sym; selectGene(n); },
    }[b.dataset.act] || (() => {}))();
  });
  renderAll(); renderGene(-1);
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Stand inside</span><div class="seg" data-ctl="room" role="group" aria-label="Stand inside the tower">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.room ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else { needTower(); setRoom(b.dataset.v === 'on'); }
  });
  showTab(X.tab);
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  if (k !== 'scenes') needTower();
  updateExtraLabels();
}
function renderAll() { renderGroups(); renderWalk(); renderLayers(); renderEndo(); renderScenes(); }
function renderGroups() {
  const pane = $('#pane-groups');
  if (!pane) return;
  const g = X.group, G = ND.groups[g];
  let h = `<p class="sub">The ${ND.groups.length} groups of the Gene Table of Neuromuscular Disorders (2024), each with its disease module in the tower.</p>
    <div class="chips">${chip('data-act="group" data-v="-1"', 'All groups', g < 0)}${ND.groups.map((G, k) => chip(`data-act="group" data-v="${k}"`, esc(G.short), g === k, G.col)).join('')}</div>`;
  if (G) {
    const zs = ND.D.ppi.map((l, p) => [G.z[p], l]).sort((a, b) => b[0] - a[0]), zmax = Math.max(1.645, zs[0][0]);
    h += `<h3>${esc(G.name)}</h3><p class="sub">Strikes the ${esc({ neuron: 'nerve cells', nerve: 'nerves', junction: 'neuromuscular junction', muscle: 'muscle fibres', heart: 'heart muscle' }[G.site] || G.site)}.</p>
      <dl class="stats"><dt>Known genes</dt><dd>${G.seeds}<small>seeds, from the Gene Table</small></dd>
      <dt>Added</dt><dd>${G.added}<small>${G.added >= 200 ? 'by the walk (stopped at 200)' : 'by the walk, until the module held together'}</small></dd>
      <dt>Endotypes</dt><dd>${G.endo.length}</dd></dl>
      <div class="chips">${chip('data-act="colour" data-v="group"', 'Group colour', X.colour === 'group')}${chip('data-act="colour" data-v="endo"', 'Endotype colours', X.colour === 'endo')}${chip('data-act="grid"', 'Grid by endotype', X.grid)}${chip('data-act="z"', 'Layer scores', X.showZ)}</div>
      <p class="grp-h">Endotypes (press one to pick it)</p>
      <div class="chips">${G.endo.map(e => chip(`data-act="pick" data-v="${g}:${e.c}"`, `${e.c}${e.name ? ' · ' + esc(e.name) : ''} <small>${e.n}</small>`, X.pick.some(([a, b]) => a === g && b === e.c), endoCss(e.c))).join('')}</div>
      <p class="grp-h">Protein layers where its known genes cluster most (z-score, in this map)</p>
      ${zs.slice(0, 8).map(([z, l]) => hbar(`${esc(ND.layers[l].name)} <b>${z.toFixed(1)}</b>`, z, zmax, z >= 1.645 ? G.col : 'var(--line)')).join('')}`;
  } else h += `<p class="empty">Pick a group to light up its module: its known genes (the seeds), the genes the walk added, and its endotypes.</p>`;
  pane.innerHTML = h;
}
function renderGene(i, q) {
  const pane = $('#ginfo');
  if (!pane) return;
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No gene matches “${esc(q)}”. Try a symbol like TTN, or a process like sarcomere.</p>` : `<p class="empty">Search above, or click a gene in the tower. The ${fmt(ND.N)} genes are those of the ${ND.groups.length} disease modules: their known genes and the genes the walk added.</p>`}
      <div class="quick">${QUICK.map(s => findGene(s)).filter(k => k >= 0).map(k => `<button type="button" data-act="quick" data-v="${k}">${esc(ND.genes[k].sym)}</button>`).join('')}</div>`;
    return;
  }
  const G = ND.genes[i], gs = groupsOf(i);
  const per = [...ND.nb[i]].map(([l, s]) => [l, s.length]).sort((a, b) => b[1] - a[1]);
  const cnt = new Map();
  for (const [, s] of ND.nb[i]) for (const j of s) cnt.set(j, (cnt.get(j) || 0) + 1);
  const partners = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 18);
  const byCat = {};
  for (const [l] of per) byCat[ND.layers[l].cat] = (byCat[ND.layers[l].cat] || 0) + 1;
  pane.innerHTML = `<h3>${esc(G.sym)}</h3><p class="sub">${esc(G.go.slice(0, 2).join(', ') || 'No GO process listed')}</p>
    <p class="grp-h">In ${gs.length} disease ${gs.length === 1 ? 'module' : 'modules'}</p>
    ${gs.map(g => `<div style="display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:14px"><span class="sw" style="background:${ND.groups[g].col}"></span><span style="flex:1">${esc(ND.groups[g].short)} <small style="color:var(--muted)">${isSeed(i, g) ? 'known gene' : 'added by the walk'}</small></span>
      <button class="btn" type="button" data-act="pick" data-v="${g}:${G.endo[g]}" style="padding:3px 8px;font-size:12px">${esc(endoLabel(g, G.endo[g]))}</button></div>`).join('')}
    <dl class="stats" style="margin-top:12px"><dt>Linked in</dt><dd>${per.length}<small>layers${Object.keys(byCat).length ? ': ' + CAT_ORDER.filter(c => byCat[c]).map(c => `${byCat[c]} ${CAT[c][0].toLowerCase()}`).join(', ') : ''}</small></dd>
    <dt>Partners</dt><dd>${cnt.size}<small>module genes, in any layer</small></dd></dl>
    ${per.slice(0, 6).map(([l, n]) => hbar(`${esc(ND.layers[l].name)} <b>${n}</b>`, n, per[0][1], CAT[ND.layers[l].cat][1])).join('')}
    <p class="grp-h">Partners (most layers first)</p>
    <div class="chips">${partners.map(([j]) => `<button type="button" data-act="gene" data-v="${j}">${esc(ND.genes[j].sym)}</button>`).join('')}</div>
    ${G.hpo.length ? `<p class="grp-h">Phenotypes</p><p class="sub" style="margin:0 0 8px">${esc(G.hpo.join(', '))}</p>` : ''}
    ${G.kegg.length ? `<p class="grp-h">Pathway</p><p class="sub" style="margin:0 0 8px">${esc(G.kegg.join(', '))}</p>` : ''}
    <div class="actions"><button class="btn" type="button" data-act="mine" data-v="${i}">Walk from here</button></div>`;
}
function renderWalk() {
  const pane = $('#pane-walk');
  if (!pane) return;
  const W = X.walk, off = X.off.size;
  let h = `<p class="sub">A walker starts at the chosen genes. At every step it jumps back to one of them seven times in ten, otherwise it follows a link; at a gene in several layers it changes layer half the time, preferring the layers where a disease group's genes cluster (from your own genes, all layers count the same). The genes it visits most are the most closely linked to the start genes, in this map.</p>
    <p class="grp-h">Start from</p>
    <div class="chips">${ND.groups.map((G, k) => chip(`data-act="from" data-v="${k}"`, esc(G.short), X.walkFrom === k, G.col)).join('')}${chip('data-act="from" data-v="mine"', `Your genes (${X.mine.length})`, X.walkFrom === 'mine')}</div>
    ${X.walkFrom === 'mine' ? `<div class="chips">${X.mine.length ? X.mine.map(i => `<button type="button" data-act="unmine" data-v="${i}" title="Remove">${esc(ND.genes[i].sym)} ×</button>`).join('') : '<span class="empty">Search a gene in Genes, then press Walk from here.</span>'}</div>` : ''}
    <div class="actions"><button class="btn primary" type="button" data-act="run">Run the walk</button>${W ? '<button class="btn" type="button" data-act="clearwalk">Clear</button>' : ''}${chip('data-act="walkers"', 'Show walkers', X.walkers)}</div>
    <p class="sub" style="margin-top:8px">${off ? `${off} ${off === 1 ? 'layer is' : 'layers are'} knocked out (Layers tab); the walk avoids them.` : 'All layers are on (knock some out in Layers).'}</p>`;
  if (X.err) h += `<p class="empty">${esc(X.err)}</p>`;
  if (W) {
    const mx = W.top.length ? W.heat[W.top[0]] : 1;
    h += `<p class="grp-h">Most visited genes (not counting the start genes)</p>${W.top.map(i => hbar(`<b>${esc(ND.genes[i].sym)}</b> ${esc(groupsOf(i).map(g => ND.groups[g].short).slice(0, 2).join(', '))}`, W.heat[i], mx, 'var(--cyan)', `data-act="gene" data-v="${i}"`)).join('')}`;
  }
  pane.innerHTML = h;
}
function renderLayers() {
  const pane = $('#pane-layers');
  if (!pane) return;
  const g = X.group;
  let h = `<p class="sub">Switch layers off: the tower drops them and a walk you run avoids them. (The modules are not computed again; the stress test is in the story.) Layers whose data is still to come are dotted in the tower.</p>
    <div class="chips"><button type="button" data-act="layers" data-v="all">All on</button><button type="button" data-act="layers" data-v="ppi">Proteins only</button><button type="button" data-act="layers" data-v="cores">Only the cores</button><button type="button" data-act="knock" data-v="10">Knock out 10 at random</button></div>
    <p class="sub">${ND.L - X.off.size} of ${ND.L} layers on.</p>`;
  for (const c of CAT_ORDER) {
    const ls = ND.layers.map((L, l) => [L, l]).filter(([L]) => L.cat === c);
    h += `<p class="grp-h"><span class="sw" style="background:${CAT[c][1]}"></span>${CAT[c][0]} · ${ls.length}</p><div class="chips">${ls.map(([L, l]) => {
      const z = g >= 0 ? zOf(g, l) : null, n = ND.count[l];
      return chip(`data-act="layer" data-v="${l}"`, `${esc(L.name)} <small>${n ? fmt(n) : 'to come'}${z !== null ? ` · z ${z.toFixed(1)}` : ''}</small>`, !X.off.has(l));
    }).join('')}</div>`;
  }
  pane.innerHTML = h;
}
function renderEndo() {
  const pane = $('#pane-endo');
  if (!pane) return;
  const eg = X.egroup, G = ND.groups[eg];
  let h = `<p class="sub">Pick endotypes, from one group or several, to see their genes through every layer and where they link to each other.</p>
    <div class="chips">${ND.groups.map((G, k) => chip(`data-act="egroup" data-v="${k}"`, esc(G.short), eg === k, G.col)).join('')}</div>
    <div class="chips">${G.endo.map(e => chip(`data-act="pick" data-v="${eg}:${e.c}"`, `${e.c}${e.name ? ' · ' + esc(e.name) : ''} <small>${e.n}</small>`, X.pick.some(([a, b]) => a === eg && b === e.c), endoCss(e.c))).join('')}</div>`;
  if (X.pick.length) {
    h += `<p class="grp-h">Picked (${X.pick.length}) <button class="btn" type="button" data-act="clearpick" style="padding:2px 8px;font-size:12px">Clear</button></p>
      <div class="chips">${X.pick.map(([g, c]) => chip(`data-act="pick" data-v="${g}:${c}"`, `${esc(ND.groups[g].short)} ${esc(endoLabel(g, c))}`, true, endoCss(c))).join('')}</div>`;
    const st = endoStats();
    if (st.rows.length) {
      const mx = Math.max(1, ...st.rows.map(r => r.n));
      h += `<p class="grp-h">${X.pick.length > 1 ? 'Links between the picked endotypes, by layer' : 'Links inside the endotype, by layer'}</p>
        ${st.rows.slice(0, 10).map(r => hbar(`${esc(ND.layers[r.l].name)} <b>${r.n}</b>`, r.n, mx, X.pick.length > 1 ? 'var(--amber)' : endoCss(X.pick[0][1]))).join('')}
        <p class="sub" style="margin-top:6px">${st.genes} genes; ${st.shared ? `${st.shared} of them in more than one picked endotype.` : 'none shared.'}</p>`;
    } else h += `<p class="empty">No links ${X.pick.length > 1 ? 'between them' : 'inside it'} in the layers that are on.</p>`;
  } else h += `<p class="empty">Nothing picked yet.</p>`;
  pane.innerHTML = h;
}
// per layer: links between picked endotypes (or inside the one picked), counted on the panel's own copy of the data
function endoStats() {
  const mem = ND.genes.map((G, i) => X.pick.map(([g, c]) => G.endo[g] === c));
  const any = mem.map(m => m.some(Boolean));
  const per = new Map();
  for (let i = 0; i < ND.N; i++) {
    if (!any[i]) continue;
    for (const [l, s] of ND.nb[i]) {
      if (X.off.has(l)) continue;
      for (const j of s) {
        if (j <= i || !any[j]) continue;
        let ok;
        if (X.pick.length === 1) ok = true;
        else ok = mem[i].some((a, p) => a && mem[j].some((b, q) => b && q !== p));
        if (ok) per.set(l, (per.get(l) || 0) + 1);
      }
    }
  }
  return { rows: [...per].map(([l, n]) => ({ l, n })).sort((a, b) => b.n - a.n), genes: any.filter(Boolean).length, shared: mem.filter(m => m.filter(Boolean).length > 1).length };
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${X.scene === 'tower' ? '' : (s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'tower' ? `<p class="sub">The tower answers to the other tabs: Diseases, Genes, Walk, Layers and Endotypes.</p>${(s.controls || []).filter(c => c.key !== 'colour').map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}` : ''}`;
}
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const T = TW();
  if (X.scene !== 'tower' || !T || !T.anchors) return;
  if (X.gene >= 0 && T.anchors.gene) {
    const i = X.gene, sym = ND.genes[i].sym, rest = groupsOf(i).map(g => ND.groups[g].short).slice(0, 2).join(', ');
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(sym)}</b>${esc(rest)}`, 'cyn'), set: 'tower', at: () => T.anchors.gene(i), o: -1, txt: [sym, rest, 'cyn'] });
  }
  if (T.anchors.endo) for (const [g, c] of X.pick.slice(0, 6)) {
    const b = `${ND.groups[g].short} ${c}`, rest = endoOf(g, c).name;
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(b)}</b>${esc(rest)}`, 'amb'), set: 'tower', at: () => T.anchors.endo(g, c), o: -1, txt: [b, rest, 'amb'] });
  }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _inv = new THREE.Matrix4();
// the gene under the mouse, in explore mode with the tower on show
function pickAt(mx, my) {
  if (X.scene !== 'tower' || !TW().pick) return -1;
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(TW().group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return TW().pick(_ro, _rd);
}
function bindCanvas() {
  const cv = GL.canvas, tip = $('#tip'), pts = new Map();
  let down = null, pinch = 0;
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    const explore = APP.mode === 'explore';
    if (pts.has(ev.pointerId) && explore) {
      const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.05, 40);
        pinch = d; down.moved = true; return;
      }
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
      if (down && down.moved) {
        orbit.to = null;
        orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, -80, 80);
      }
      tip.style.opacity = 0;
      return;
    }
    if (!explore || ev.pointerType === 'touch') { tip.style.opacity = 0; return; }
    const i = pickAt(ev.clientX, ev.clientY);
    cv.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (i >= 0) {
      tip.innerHTML = `<b>${esc(ND.genes[i].sym)}</b>${esc(groupsOf(i).map(g => ND.groups[g].short).slice(0, 2).join(', '))}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const i = pickAt(ev.clientX, ev.clientY);
      if (i >= 0) { $('#q').value = ND.genes[i].sym; showTab('genes'); selectGene(i, false); }
    }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.05, 40);
  }, { passive: false });
}

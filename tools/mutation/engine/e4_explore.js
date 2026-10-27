// ================================================================ EXPLORE ==
// Explore mode: a letter or a mix in two qubits and its read-outs (Letters), the rule, its path and the machine for
// one branch (Rule), the family tree and its machines (Tree), the stem rebuilt three ways (Stem); or any scene with its
// own controls (Scenes).
const SCENES = [
  ['letters', 'Letters', 'DNA\'s double helix, the ancestor\'s eight letters and two copies with swaps; then one letter in two qubits, its four codes, a mix of all four and its read-outs piling up.'],
  ['tree', 'Tree', 'A family tree in 3D, every swap simulated with the story\'s example rule; one machine per branch; and the species tree of the authors\' test.'],
  ['rule', 'Rule and machine', 'A rule of change as balls and arrows, the pyramid of mixes and the path through it; the machine for one branch (the copy and the turn) and its circuit.'],
  ['stem', 'Stem', 'An RNA stem: a pair breaking, the coupling that keeps it, the combinations a model of pairs must track; the ancestor of three species rebuilt three ways.'],
];
const SCENE_SHORT = { rule: 'Rule' };
const TABS = [['letters', 'Letters'], ['rule', 'Rule'], ['tree', 'Tree'], ['stem', 'Stem'], ['scenes', 'Scenes']];
// the branch length (time) and the pair favour (w) are sliders the panes hold themselves (X.time, X.w): the sets'
// controls of those names only say when one applies
const isNum = c => c.key === 'time' || c.key === 'w';
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !isNum(c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isNum(x) ? numOf(x.key) : ctlValue(k, x)])));
// a slider of a set's on show now
const numShown = (k, key) => { const c = (GL.sets[k].controls || []).find(x => x.key === key); return !!c && ctlShown(k, c); };
const numOf = key => (key === 'w' ? X.w : X.time);
// (explore opens on the rule's machine; each scene starts on the story's own choices)
const X = { tab: 'rule', scene: 'rule', t0: 0, turn: 'on',
  ctl: { letters: { view: 'qubits', mix: 'rule' }, rule: { view: 'path', model: M.DEFAULT, start: 'A', parent: 'G' }, tree: { view: 'tree', seed: '1', speed: '1', run: 'off' },
    stem: { view: 'rebuild', src: 'test', method: 'all' } },
  time: 1, reads: 0, rseed: 1, branch: -1, w: TD.w, sseed: 1 };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['letters_code', 'letters_target', 'letters_seed', 'rule_model', 'rule_start', 'rule_parent', 'tree_seed', 'tree_speed', 'tree_pick',
  'stem_src', 'stem_w', 'stem_seed', 'stem_method']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { letters: { copies: 'rows', qubits: 'reads' }, rule: { rule: 'rates' }, tree: { tree: 'default', machines: 'gears' },
  stem: { stem: 'default', count: 'cloud', rebuild: 'fields' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, 'view'); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the letters' chances, the rule's angles, the tree's branches and picking, the
// stem's rebuilds and picking
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// what the panes choose, by name
const letMix = () => ctlValue('letters', ctlOf('letters', 'mix'));
const ruleModel = () => Math.max(0, M.MODELS.findIndex(m => m.key === ctlValue('rule', ctlOf('rule', 'model'))));
const letterOf = key => Math.max(0, LET.indexOf(ctlValue('rule', ctlOf('rule', key))));
const ruleView = () => ctlValue('rule', ctlOf('rule', 'view'));
const machineOn = () => ['machine', 'circuit', 'steps'].includes(ruleView());
const treeView = () => ctlValue('tree', ctlOf('tree', 'view'));
const treeSeed = () => Math.max(1, parseInt(ctlValue('tree', ctlOf('tree', 'seed')), 10) || 1);
// the family tree chosen (the tree set draws the same: MMATH.familyTree by seed and speed), kept for the panes
const TREES = new Map();
function treeNow() {
  const sp = (api('tree').speeds || [0.5, 1, 2, 4])[clamp(parseInt(ctlValue('tree', ctlOf('tree', 'speed')), 10) || 0, 0, 3)], k = treeSeed() + '|' + sp;
  if (!TREES.has(k)) { if (TREES.size > 7) TREES.delete(TREES.keys().next().value); TREES.set(k, M.familyTree(treeSeed(), sp)); }
  return TREES.get(k);
}
const stemView = () => ctlValue('stem', ctlOf('stem', 'view'));
const stemLive = () => ctlValue('stem', ctlOf('stem', 'src')) === 'live';
const stemMethod = () => ctlValue('stem', ctlOf('stem', 'method'));
const READ_MAX = () => api('letters').READ_MAX || 400;
// the four chances of the letter or mix chosen, and how a read-out of it comes out (MMATH.sample by index, 1-based,
// as the letters set draws them)
const letChances = () => (api('letters').chances ? api('letters').chances(letMix(), X.time) : [1, 0, 0, 0]);
function readCounts(n = X.reads) {
  const p = letChances(), c = [0, 0, 0, 0];
  for (let k = 1; k <= n; k++) c[M.sample(p, X.rseed, k)]++;
  return c;
}

// the controls a set's explore() reads: its own, with the panes' numbers (the branch length, the pair favour, the
// read-outs and their seed)
function ctlArgs(k, now) {
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of GL.sets[k].controls || []) c[ct.key] = isNum(ct) ? numOf(ct.key) : ctlValue(k, ct);
  if (k === 'letters') { c.reads = X.reads; c.seed = X.rseed; }
  return c;
}
// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
// (the branch picked, the rebuild's seed); the species tree shows its stems, and the rebuilt fields stand under it
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = ctlArgs(k, now);
  if (s.explore) Object.assign(tg, s.explore(c));
  if (k === 'tree') {
    if (c.view !== 'species') tg.tree_pick = X.branch;
    else Object.assign(tg, { stem_a: 1, stem_strand: 0, stem_count: 0, stem_qubits: 0, stem_species: 1, stem_fields: 0, stem_sort: 0, stem_truth: 0, stem_examples: 0 });
  }
  if (k === 'stem') {
    tg.stem_seed = X.sseed;
    if (c.view === 'rebuild' || c.view === 'compare') {
      Object.assign(tg, GL.sets.tree.params, { tree_a: 1, tree_species: 1, tree_grow: 1, tree_seq: 1, tree_hi: 0, tree_gears: 1, tree_flow: 0,
        tree_q: c.view === 'rebuild' ? 1 : 0, tree_pick: -1 });
    }
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) {
    // read-outs play one by one (about one a second), many at once quickly; fewer (cleared, a new mix) at once
    if (n === 'letters_reads') { const g = tg[n], v = XS[n]; XS[n] = g <= v ? g : Math.min(g, v + dt * Math.max(0.9, (g - v) * 2.5)); continue; }
    XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  }
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets)
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, viewCam(k) || 'default'));
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, 'view', v); }
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
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also brings up the scene and the view that show it.
// the branch length (0 to 2 swaps per letter, to the hundredth): the rule's path and machine, the letters' rule mix
function setTime(v, ui = true) {
  const t = clamp(Math.round(+v * 100) / 100, 0, 2);
  if (!Number.isFinite(t) || t === X.time) return;
  X.time = t;
  if (ui && letMix() === 'rule') X.reads = 0;   // (another mix: its read-outs start again)
  syncNums();
}
// the pair favour w (1 to 30): how much more likely a matching pair is, in the example computed live
function setW(v, ui = true) {
  const w = clamp(Math.round(+v) || 1, 1, 30);
  if (w === X.w) return;
  X.w = w;
  if (ui && !stemLive()) { (X.ctl.stem = X.ctl.stem || {}).src = 'live'; renderAll(); return; }   // (the authors' test is w = 8)
  syncNums();
}
// a letter or a mix in the two qubits, from the Letters tab: its read-outs start again
function setMix(v) {
  if (!ctlOf('letters', 'mix').options.some(o => o[0] === v)) return;
  if (!(X.scene === 'letters' && viewIs('letters', 'qubits'))) showView('letters', 'qubits');
  if (v !== letMix()) X.reads = 0;
  setCtl('letters', 'mix', v);
}
// read out n more (up to the piles' most), or clear them (0); read again: a new seed, the piles cleared
function readOut(n, ui = true) {
  X.reads = n > 0 ? clamp(X.reads + n, 0, READ_MAX()) : 0;
  if (ui && !(X.scene === 'letters' && viewIs('letters', 'qubits'))) showView('letters', 'qubits');
  renderAll();
}
function readAgain() { X.rseed = X.rseed % 999 + 1; X.reads = 0; renderAll(); }
// a branch of the family tree (-1 none): lit, its rise measured, its machine lit
function selectBranch(b, ui = true) {
  const n = treeNow().branches.length;
  X.branch = Number.isInteger(b) && b >= 0 && b < n ? b : -1;
  if (ui && X.branch >= 0 && !(X.scene === 'tree' && treeView() !== 'species')) { if (X.scene !== 'tree') openScene('tree'); if (treeView() === 'species') setCtl('tree', 'view', 'tree'); }
  renderAll();
}
// a new family tree: the next of the five
function nextTree() { const o = ctlOf('tree', 'seed').options, i = o.findIndex(x => x[0] === ctlValue('tree', ctlOf('tree', 'seed'))); X.branch = -1; sceneCtl('tree', 'seed', o[(i + 1) % o.length][0]); }
// rebuild again: another 2,000 ancestors per method (this example, live)
function rebuildAgain() { X.sseed = X.sseed % 999 + 1; if (!stemLive()) (X.ctl.stem = X.ctl.stem || {}).src = 'live'; if (X.scene !== 'stem') openScene('stem'); renderAll(); }
// a control of a scene picked from a tab: its scene brought up (a new tree drops the branch picked)
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  if (k === 'tree' && (key === 'seed' || key === 'speed') && ctlValue(k, ctlOf(k, key)) !== v) X.branch = -1;
  if (k === 'letters' && key === 'mix' && letMix() !== v) X.reads = 0;
  setCtl(k, key, v);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (the letter or
// mix, the rule, its start and parent letters, the tree and how fast its letters change, the source and the method
// among them), the branch length, the read-outs and their seed, the branch picked, the pair favour and the rebuild's
// seed. The camera is each person's own, and so is how far the read-outs have played.
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
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, time: X.time, reads: X.reads, rseed: X.rseed, branch: X.branch, w: X.w, sseed: X.sseed };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the numbers and the picks
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  if (Number.isFinite(v.time) && v.time >= 0 && v.time <= 2 && v.time !== X.time) setTime(v.time, false);
  if (int(v.reads, 0, READ_MAX())) X.reads = v.reads;
  if (int(v.rseed, 1, 999)) X.rseed = v.rseed;
  if (int(v.branch, -1, 63) && v.branch !== X.branch) selectBranch(v.branch, false);
  if (int(v.w, 1, 30) && v.w !== X.w) setW(v.w, false);
  if (int(v.sseed, 1, 999)) X.sseed = v.sseed;
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// the letters and mixes the Letters tab offers, with their colours (a mix has none)
const MIXES = () => ctlOf('letters', 'mix').options;
const mixCol = v => (LET.indexOf(v) >= 0 ? LCOL[LET.indexOf(v)] : null);
const LETTER_CHIPS = LET.split('').map((l, i) => [l, l, LCOL[i]]);
// a slider the panes hold (the branch length or the pair favour), with its value; it changes in place, so a drag is not
// cut short by a redraw
const NUM = { time: { label: 'Branch length', min: 0, max: 2, step: 0.01, col: GREEN, text: v => `${v.toFixed(2)} swaps per letter` },
  w: { label: 'Pair favour', min: 1, max: 30, step: 1, col: CYAN, text: v => `matching pairs ${v} × as likely` } };
const slider = key => { const o = NUM[key], v = numOf(key);
  return `<p class="grp-h">${o.label} <b data-numv="${key}" style="margin-left:auto;color:var(--ink)">${esc(o.text(v))}</b></p>
    <input type="range" data-num="${key}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" aria-label="${o.label}" style="accent-color:${o.col}">`; };
const statsHtml = rows => `<dl class="stats">${rows.map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${more ? `<small>${esc(more)}</small>` : ''}</dd>`).join('')}</dl>`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      view: () => { const [k, w] = v.split(':'); showView(k, w); }, scene: () => openScene(v),
      ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
      mix: () => setMix(v), read: () => readOut(+v), again: () => readAgain(),
      branch: () => selectBranch(+v === X.branch ? -1 : +v), tree: () => nextTree(), rebuild: () => rebuildAgain(),
      cam: () => { if (X.scene !== 'tree') openScene('tree'); flyTo(view('tree', v)); },
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const k = ev.target.dataset.num;
    if (k === 'time') setTime(+ev.target.value, true); else if (k === 'w') setW(+ev.target.value, true);
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
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
  // (five tabs overflow a phone's panel: the row scrolls so the chosen one shows)
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'letters' && X.scene !== 'letters') showView('letters', 'qubits');
  if ((k === 'rule' || k === 'tree' || k === 'stem') && X.scene !== k) openScene(k);
}
function renderAll() { renderLetters(); renderRule(); renderTree(); renderStem(); renderScenes(); updateExtraLabels(); }
// the numbers that follow a slider, redrawn in place (the sliders themselves keep still while dragged)
function syncNums() {
  for (const k in NUM) {
    document.querySelectorAll(`[data-numv="${k}"]`).forEach(el => { el.textContent = NUM[k].text(numOf(k)); });
    document.querySelectorAll(`input[data-num="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = numOf(k); });
  }
  const live = { letters: lettersLive, rule: ruleLive, stem: stemLiveHtml };
  for (const k in live) document.querySelectorAll(`[data-live="${k}"]`).forEach(el => { el.innerHTML = live[k](); });
}

// what a letter or a mix holds: its chances, its two arrows, its read-outs so far (in words, for both panels)
function lettersInfo() {
  const p = letChances(), b = M.bloch(p), mix = letMix(), li = LET.indexOf(mix), cnt = readCounts();
  const len = k => Math.hypot(b[3 * k], b[3 * k + 2]);
  return {
    what: li >= 0 ? `${LET[li]} is ${KET[li]}: ${codeWords(li)}.` : mix === 'even' ? 'An even mix: a quarter each.' : `The rule's mix after ${X.time.toFixed(2)} swaps per letter, from A.`,
    chances: chancesText(p),
    arrows: li >= 0 ? 'both as long as the sphere' : `${len(0).toFixed(2)} and ${len(1).toFixed(2)} of the sphere`,
    reads: X.reads ? `${X.reads} read-out${X.reads === 1 ? '' : 's'}: ${LET.split('').map((l, i) => `${l} ${cnt[i]}`).join(', ')}` : 'none yet',
  };
}
const lettersLive = () => { const I = lettersInfo(); return `<p class="sub">${esc(I.what)}</p>${statsHtml([['Chances', I.chances], ['Arrows', I.arrows], ['Read out', I.reads]])}`; };
function renderLetters() {
  const pane = $('#pane-letters');
  if (!pane) return;
  const mix = letMix(), on = X.scene === 'letters' && viewIs('letters', 'qubits');
  pane.innerHTML = `<p class="sub">A quantum computer holds each letter in two qubits, drawn as arrows on spheres: up is 0, down is 1. Pick a letter or a mix, then read it out.</p>
    <p class="grp-h">Letter or mix</p><div class="chips">${MIXES().map(([v, n]) => chip(`data-act="mix" data-v="${v}"`, esc(n), on && mix === v, mixCol(v))).join('')}</div>
    ${mix === 'rule' ? slider('time') : ''}
    <div data-live="letters">${lettersLive()}</div>
    <p class="grp-h">Read out</p><div class="chips">${chip('data-act="read" data-v="1"', '1 more', false)}${chip('data-act="read" data-v="100"', '100 more', false)}${chip('data-act="read" data-v="0"', 'Clear', false)}${chip('data-act="again"', 'Read again', false)}</div>
    <p class="grp-h">Show</p><div class="chips">${[['helix', 'The helix'], ['copies', 'The copies'], ['qubits', 'The qubits']].map(([v, n]) => chip(`data-act="view" data-v="letters:${v}"`, n, X.scene === 'letters' && viewIs('letters', v))).join('')}</div>
    <p class="note">Each read-out lands on one letter, by its chance: the piles grow roughly as tall as the chances. |01⟩ means first 0, then 1; an arrow shorter than its sphere means the two qubits depend on each other.</p>`;
}

// the rule, its path and the machine, in words (computed here for the rule, branch length and letters chosen)
function ruleInfo() {
  const mi = ruleModel(), mo = M.MODELS[mi], A = api('rule'), t = X.time, v = ruleView();
  const pi = A.longRun ? A.longRun(mi) : Array.from(M.pi(mi)), r = mo.r, NAMES = ['A↔C', 'A↔G', 'A↔T', 'C↔G', 'C↔T', 'G↔T'];
  const ord = r.map((x, i) => [x, NAMES[i]]).sort((p, q) => q[0] - p[0]), even = ord[0][0] === ord[5][0];
  const rows = [['Long run', chancesText(pi)], ['Swaps', even ? 'all alike' : `${ord[0][1]} and ${ord[1][1]} most readily`, even ? '' : `${ord[5][1]} least`]];
  if (v === 'path') {
    const s = letterOf('start'), p = A.mix ? A.mix(mi, s, t) : Array.from(M.path(mi, s, t));
    rows.push(['The mix', chancesText(p), `after ${t.toFixed(2)} swaps per letter`], ['On its way', pct(wayOf(p, pi, s)), 'of the way to the long-run mix']);
  }
  if (machineOn()) {
    const par = letterOf('parent'), g = A.angles ? A.angles(mi, t, par) : { c1: 0, c0: [0, 0] }, st = A.steps ? A.steps() : { turns: 12, links: 12, copy: 2 };
    rows.push(['The child', chancesText(Array.from(M.path(mi, par, t))), `parent ${LET[par]}, after ${t.toFixed(2)}`],
      ['c1 turns', deg(g.c1)], ['c0 turns', `${deg(g.c0[0])} or ${deg(g.c0[1])}`, 'as c1 is 0 or 1'], ['The gears', deg(M.turnAngle(mi, t)), 'the turn on average']);
    if (v === 'steps') rows.push(['Simple steps', `${st.turns} turns, ${st.links} links`, `plus the copy's ${st.copy} CNOTs`]);
  }
  return { note: mo.note, rows };
}
const ruleLive = () => statsHtml(ruleInfo().rows);
function renderRule() {
  const pane = $('#pane-rule');
  if (!pane) return;
  const mi = ruleModel(), v = ruleView(), on = X.scene === 'rule';
  const ch = (key, opts, cur) => opts.map(([o, n, col]) => chip(`data-act="ctl" data-scene="rule" data-ctl="${key}" data-v="${o}"`, esc(n), cur === o, col)).join('');
  pane.innerHTML = `<p class="sub">A rule of change (a substitution model): how readily each letter swaps for another, and how common each is in the long run. The rates are examples; every number here is computed as you choose.</p>
    <p class="grp-h">Rule</p><div class="chips">${ch('model', M.MODELS.map(m => [m.key, m.name]), M.MODELS[mi].key)}</div>
    <p class="sub">${esc(M.MODELS[mi].note)}</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('rule', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="rule:${o}"`, esc(n), on && v === o)).join('')}</div>
    ${v === 'path' ? `<p class="grp-h">Start</p><div class="chips">${ch('start', LETTER_CHIPS, LET[letterOf('start')])}</div>` : ''}
    ${machineOn() ? `<p class="grp-h">Parent's letter</p><div class="chips">${ch('parent', LETTER_CHIPS, LET[letterOf('parent')])}</div>` : ''}
    ${v !== 'rule' ? slider('time') : ''}
    <div data-live="rule">${ruleLive()}</div>
    <p class="note">${machineOn() ? 'The copy is two CNOT gates. The turn is rotations of single qubits plus steps that link two qubits, so it depends on the parent\'s letter. How far each step turns depends only on the branch length; the steps are the same on every branch.' : 'Every mix of the four letters is a point in the pyramid, the pure letters at its corners; over time the rule moves it along a path towards the long-run mix. The most general standard rule is GTR.'}</p>`;
}

// a branch of the family tree in words (its length, swaps and machine), for both panels
function branchInfo(b) {
  const tr = treeNow(), B = tr.branches[b];
  if (!B) return null;
  return { head: `Branch ${b + 1} · ${f2(B.len)} swaps per letter · ${swapsN(B.muts.length)}`,
    muts: B.muts.length ? B.muts.map(m => `${LET[m.from]}→${LET[m.to]} at letter ${m.site + 1}`).join(', ') : 'no swap on this branch',
    seqs: `${tr.nodes[B.from].seq} → ${tr.nodes[B.to].seq}`, turn: `its machine turns ${deg(M.turnAngle(M.DEFAULT, B.len))} on average` };
}
function renderTree() {
  const pane = $('#pane-tree');
  if (!pane) return;
  const v = treeView(), on = X.scene === 'tree', tr = treeNow(), I = X.branch >= 0 && v !== 'species' ? branchInfo(X.branch) : null;
  const ch = (key, cur) => ctlOf('tree', key).options.map(([o, n]) => chip(`data-act="ctl" data-scene="tree" data-ctl="${key}" data-v="${o}"`, esc(n), cur === o)).join('');
  pane.innerHTML = `<p class="sub">A family tree of ${word(tr.nodes.filter(n => n.tip >= 0).length)} descendants of one ancestor, ${esc(tr.nodes[tr.root].seq)}, every swap simulated with the story's example rule. Heights are change: each branch rises by its length.</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('tree', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="tree:${o}"`, esc(n), on && v === o)).join('')}</div>
    <p class="grp-h">Tree</p><div class="chips">${ch('seed', ctlValue('tree', ctlOf('tree', 'seed')))}${chip('data-act="tree"', 'New tree', false)}</div>
    <p class="grp-h">Letters change</p><div class="chips">${ch('speed', ctlValue('tree', ctlOf('tree', 'speed')))}</div>
    ${v !== 'tree' ? `<p class="grp-h">Machines</p><div class="chips">${ch('run', ctlValue('tree', ctlOf('tree', 'run')))}</div>` : ''}
    <p class="grp-h">Look</p><div class="chips">${[['default', 'The whole tree'], ['stand', 'Stand in it'], ['up', 'Up from the root']].map(([c, n]) => chip(`data-act="cam" data-v="${c}"`, n, false)).join('')}</div>
    ${v !== 'species' ? `<p class="grp-h">Branch</p><div class="chips">${tr.branches.map((B, i) => chip(`data-act="branch" data-v="${i}"`, String(i + 1), X.branch === i, B.muts.length ? null : GREY)).join('')}</div>
      ${I ? `<h3>${esc(I.head)}</h3><p class="sub">${esc(cap(I.muts))}. ${esc(I.seqs)}; ${esc(I.turn)}.</p>` : '<p class="sub">Pick a branch (click it, or point and pull the trigger): its length, its swaps and its machine.</p>'}`
      : '<p class="sub">The species tree of the authors\' test, ((1, 2), 3), with example branch lengths, and their stems at its tips. A coupling gear on each branch. See the Stem tab.</p>'}
    <p class="note">One machine per branch: the steps are the same on every branch, only how far they turn changes with its length. Chance gives a branch more or fewer swaps than its length leads one to expect.</p>`;
}

// the rebuild in words: per method its share of intact ancestors, the true ancestor and the examples
const STEM_ORDER = ['indep', 'coupled', 'exact'];
function stemInfo() {
  const live = stemLive(), A = api('stem'), R = A.results ? A.results(live ? 1 : 0, X.w, X.sseed) : null, names = (live ? A.namesLive : A.names) || {};
  const rows = STEM_ORDER.map(m => {
    const r = R && R[m];
    return [names[m] || m, r ? (live ? `${pct(r.share)} here` : `${pct(r.share)} intact`) : '–', r && live && r.expected != null ? `exact chance ${pct(r.expected)}` : '', m];
  });
  const ex = STEM_ORDER.map(m => { const r = R && R[m]; return r ? [names[m] || m, `${r.best.top} / ${r.best.bottom}`, brokenN(r.broken), m] : null; }).filter(Boolean);
  return { live, rows, ex, truth: `${TD.truth.top} / ${TD.truth.bottom}`, truthB: brokenN(FACTS.truthBroken) };
}
const stemLiveHtml = () => { const I = stemInfo(); return `${statsHtml(I.rows.map(r => r.slice(0, 3)))}
  <p class="grp-h">The true ancestor and one rebuilt each</p>${statsHtml([['True', I.truth, I.truthB]].concat(I.ex.map(r => r.slice(0, 3))))}`; };
function renderStem() {
  const pane = $('#pane-stem');
  if (!pane) return;
  const v = stemView(), on = X.scene === 'stem', live = stemLive(), me = stemMethod();
  pane.innerHTML = `<p class="sub">Three species carry one RNA stem of ${word(TD.pairs)} pairs. Rebuild their shared ancestor ${fmt(TD.n)} times with each method, and count the ancestors whose ${word(TD.pairs)} pairs all hold.</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('stem', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="stem:${o}"`, esc(n), on && v === o)).join('')}</div>
    <p class="grp-h">Numbers</p><div class="chips">${ctlOf('stem', 'src').options.map(([o, n]) => chip(`data-act="ctl" data-scene="stem" data-ctl="src" data-v="${o}"`, esc(n), ctlValue('stem', ctlOf('stem', 'src')) === o)).join('')}</div>
    ${live ? `${slider('w')}<div class="chips">${chip('data-act="rebuild"', 'Rebuild again', false)}</div>` : `<p class="sub">The authors' test: ${fmt(TD.n)} rebuilt ancestors per method, matching pairs ${word(TD.w)} times as likely as mismatched ones.</p>`}
    <p class="grp-h">Method</p><div class="chips">${ctlOf('stem', 'method').options.map(([o, n]) => chip(`data-act="ctl" data-scene="stem" data-ctl="method" data-v="${o}"`, esc(n), me === o, METHOD_COL[o])).join('')}</div>
    <div data-live="stem">${stemLiveHtml()}</div>
    <p class="note">The coupled circuit favours matching pairs too strongly: its ancestors look believable, but its percentages are not true chances. A broken pair is normal: only ${esc(TD.allSixPrior)} of ancestors have all ${word(TD.pairs)} pairs matched (the authors). ${live ? 'Computed here with the story\'s example rule; the coupling is our stand-in for the authors\' circuit.' : 'In the authors\' test the shares are theirs; which stems are intact is drawn for the picture.'}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${Object.keys(NUM).filter(key => numShown(X.scene, key)).map(slider).join('')}`;
}
// labels the panes add (none: the sets label their own picks, the tree its branch, the stem its fields)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { branch } (of the family tree),
// { sbranch } (of the species tree), { field } (a method's field) or { stem } (a species', the truth's or a method's
// example), or null
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  const sp = X.scene === 'tree' && treeView() === 'species', fields = X.scene === 'stem' && (viewIs('stem', 'rebuild') || viewIs('stem', 'compare'));
  let r = null;
  try {
    if (sp || fields) r = api('stem').pick ? api('stem').pick(rc) : null;
    if (!r && X.scene === 'tree') r = api('tree').pick ? api('tree').pick(rc) : null;
  } catch (e) { return null; }
  if (!r) return null;
  return r.kind === 'branch' ? (r.species ? { sbranch: r.b } : { branch: r.b }) : r.kind === 'field' ? { field: r.method } : r.kind === 'stem' ? { stem: r.which } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (X.scene !== 'tree' || !api('tree').mid) return null;
  return p.branch !== undefined ? api('tree').mid(p.branch, false) : p.sbranch !== undefined ? api('tree').mid(p.sbranch, true) : null;
}
const SPECIES_NAME = { s1: 'Species 1', s2: 'Species 2', s3: 'Species 3', n1: 'The ancestor of species 1 and 2' };
function pickText(p) {
  const A = api('tree'), S = api('stem'), names = (stemLive() ? S.namesLive : S.names) || {};
  if (p.branch !== undefined) { const B = treeNow().branches[p.branch]; return B ? [`Branch ${p.branch + 1}`, `${f2(B.len)} swaps per letter · ${swapsN(B.muts.length)}`] : ['', '']; }
  if (p.sbranch !== undefined) {
    const sp = A.species(), B = sp.branches[p.sbranch], n = B && sp.nodes[B.to];
    return B ? [`To ${(SPECIES_NAME[n.name] || 'a species').replace(/^The/, 'the')}`, `${f2(B.len)} swaps per letter (an example)`] : ['', ''];
  }
  if (p.field) { const r = S.results()[p.field]; return [names[p.field] || p.field, stemLive() ? `${pct(r.share)} intact here` : `${pct(r.share)} intact in the authors' test`]; }
  if (p.stem === 'truth') return ['True ancestor', `${TD.truth.top} / ${TD.truth.bottom} · ${brokenN(FACTS.truthBroken)}`];
  if (TD.species[p.stem]) { const s = TD.species[p.stem]; return [SPECIES_NAME[p.stem], `${s.top} / ${s.bottom} · ${brokenN(M.brokenPairs(s.top, s.bottom).length)}`]; }
  const r = S.results()[p.stem];
  return r ? [names[p.stem] || p.stem, `${r.best.top} / ${r.best.bottom} · ${brokenN(r.broken)}`] : ['', ''];
}
// a click (or the trigger) on a branch picks it; on a field, lights its method (again: all three)
function choosePick(p) {
  if (!p) return;
  if (p.branch !== undefined) { if (X.tab !== 'tree') showTab('tree'); selectBranch(p.branch === X.branch ? -1 : p.branch, false); }
  else if (p.field) { if (X.tab !== 'stem') showTab('stem'); sceneCtl('stem', 'method', stemMethod() === p.field ? 'all' : p.field); }
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
    const p = pickAt(ev.clientX, ev.clientY);
    cv.style.cursor = p && !p.sdom ? 'pointer' : 'grab';
    if (p) {
      const [b, r] = pickText(p);
      tip.innerHTML = `<b>${esc(b)}</b>${esc(r)}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') choosePick(pickAt(ev.clientX, ev.clientY));
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

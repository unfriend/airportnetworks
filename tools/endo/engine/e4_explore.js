
// ================================================================ EXPLORE ==
// Explore mode: the 12 endotypes, the 393 genes of the module and the five steps of the method, shown in the
// synapse, the protein network or the tree; or any scene with its own controls.
const SCENES = [
  ['syn', 'Synapse', 'The neuromuscular junction, cut open: the nerve ending, the gap with its basement membrane, the folded muscle membrane and the fibre. With the seed genes where they act, and each endotype in its place.'],
  ['net', 'Network', `The authors' protein network: ${fmt(FACTS.genes)} proteins and their links, the ${FACTS.seeds} seeds, the walk with restart and the module of ${FACTS.module} genes.`],
  ['tree', 'Tree', `The module's genes by the cell parts around them: the ${FACTS.module} × ${FACTS.terms} matrix, the tree that splits only when the data say so, the genes by tree distance and the endotype network.`],
  ['motor', 'Motor unit', 'From nerve to muscle: the motor neuron, its axon, the neuromuscular junctions and the muscle fibres they drive.'],
];
const TABS = [['endo', 'Endotypes'], ['genes', 'Genes'], ['method', 'Method'], ['scenes', 'Scenes']];
// the method's five steps: key, name, the scene it shows
const METHOD = [['groups', 'Seed groups', 'net'], ['walk', 'The walk', 'net'], ['hood', 'Neighbourhoods', 'net'], ['tree', 'The tree', 'tree'], ['endo', 'Endotypes', 'tree']];
const K_DEF = Math.max(0, ED.groups.findIndex(g => g.k === 20));
const X = { tab: 'endo', scene: 'tree', ctl: {}, t0: 0, turn: 'on', endo: -1, gene: -1, k: K_DEF, step: 0, gap: false };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['motor_site', 'syn_place', 'tree_focus', 'net_gene', 'net_focus']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => (GL.sets[k].controls || []).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
// a view option's camera: the cam view of the same name, or one the set names otherwise (the tree's Distances and
// Endotypes are its cam views mds and meta)
const CAM_ALIAS = { tree: { dist: 'mds', endo: 'meta' } };
const camFor = (k, v) => { const c = GL.sets[k].cam || {}, a = (CAM_ALIAS[k] || {})[v] || v; return c[a] ? a : null; };
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
const STORY_IDX = () => geneIdx(STORY_GENE);
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const e = X.endo, g = X.gene;
  // the picked endotype in the tree, the synapse or the network; the picked gene's neighbourhood in the network
  if (X.scene === 'tree' && e >= 0) tg.tree_focus = e + 1;
  if (X.scene === 'syn' && e >= 0) { tg.syn_endo = 1; tg.syn_place = e + 1; }
  if (X.scene === 'net') {
    if (e >= 0) { tg.net_module = 1; tg.net_endo = 1; tg.net_focus = e + 1; tg.net_seeds = Math.min(tg.net_seeds, 0.3); }   // (white seeds would outshine its colour)
    if (g >= 0) { tg.net_gene = g; tg.net_hood = 1; }
  }
  // the Method tab shows its step on top
  if (X.tab === 'method' && METHOD[X.step][2] === X.scene) {
    const st = METHOD[X.step][0];
    const quiet = { net_endo: 0, net_focus: 0, net_gene: -1, net_hood: 0 };
    if (st === 'groups') Object.assign(tg, quiet, { net_cloud: 1, net_seeds: 1, net_k: X.k + (X.k === 0 ? 0.25 : 0), net_walk: 0, net_heat: 0, net_module: 0 });
    if (st === 'walk') Object.assign(tg, quiet, { net_seeds: 1, net_k: ED.groups.length - 1, net_heat: 1 });
    if (st === 'hood') Object.assign(tg, quiet, { net_gene: g >= 0 ? g : STORY_IDX(), net_hood: 1, net_module: 0, net_walk: 0, net_heat: 0, net_seeds: 0.4 });
    if (st === 'tree') { tg.tree_meta = 0; tg.tree_focus = 0; }
    if (st === 'endo') { tg.tree_meta = 1; tg.tree_focus = e + 1; }
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it, standing in the gap, or a set asks for stillness
  if (X.turn === 'on' && !(X.gap && X.scene === 'syn') && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, X.gap && k === 'syn' ? 'gap' : viewCam(k) || 'default'));
  renderScenes();
  updateExtraLabels();
}
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : null;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // some views have their own best camera (cam views named like the option); leaving one goes back to the scene's own view
  if (!(X.gap && k === 'syn') && k === X.scene) {
    if (camFor(k, v)) flyTo(view(k, camFor(k, v)));
    else if (was && camFor(k, was)) flyTo(view(k, 'default'));
  }
  if (c) { renderScenes(); renderMethod(); }
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
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p && !(X.gap && X.scene === 'syn')) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// pick an endotype (-1 none); the motor unit has none to show, so the tree comes up
function selectEndo(id, fly = true) {
  X.endo = id;
  if (id >= 0 && X.scene === 'motor') openScene('tree');
  pushState(); renderAll();
  if (fly && id >= 0) flyToEndo();
}
function flyToEndo() {
  const id = X.endo, s = GL.sets[X.scene], tv = ctlOf('tree', 'view');
  if (id < 0) return;
  const meta = (X.tab === 'method' && METHOD[X.step][0] === 'endo') || (tv && ctlValue('tree', tv) === optKey('tree', 'view', /meta|endo/i));
  if (X.scene === 'tree' && meta && s.cam['e' + id]) flyTo(view('tree', 'e' + id));
  else if (X.scene === 'tree' && 'focus' in s.cam) afterUpdate(() => { if (X.scene === 'tree' && X.endo === id) flyTo(view('tree', 'focus')); });   // (the set's focus view follows its focus)
  else if (X.scene === 'syn' && (s.anchors['e' + id] || s.anchors[ED.endo[id].place])) flyNear(anchorOf('syn', s.anchors['e' + id] ? 'e' + id : ED.endo[id].place), 0.45 * view('syn', 'default')[2]);   // where its cloud settles
  else if (X.scene === 'net' && s.cam.module) flyTo(view('net', 'module'));   // the module pulls together, the endotype bright in it
}
// pick a gene of the module (-1 none); picked from a list (fly), its neighbourhood shows in the network
function selectGene(i, fly = true) {
  X.gene = i;
  if (i >= 0 && (X.scene === 'motor' || (fly && X.scene !== 'net'))) openScene('net');
  pushState(); renderGene(i); renderMethod();
  if (fly && i >= 0 && X.scene === 'net') afterUpdate(flyToGene);
}
// the method's step i: its scene, and the view that suits it
function showStep(i, quiet) {
  X.step = clamp(i | 0, 0, METHOD.length - 1);
  if (!quiet) {
    const st = METHOD[X.step];
    if (X.scene !== st[2]) openScene(st[2]);
    if (st[0] === 'groups' || st[0] === 'hood') { const v = optKey('net', 'view', /net|cloud/i); if (v && ctlValue('net', ctlOf('net', 'view')) !== v) setCtl('net', 'view', v); }
    if (st[0] === 'tree') { const v = optKey('tree', 'view', /^tree$/i); if (v && ctlValue('tree', ctlOf('tree', 'view')) !== v) setCtl('tree', 'view', v); else X.t0 = performance.now(); }
    if (st[0] === 'endo') { const v = optKey('tree', 'view', /meta|endo/i); if (v && ctlValue('tree', ctlOf('tree', 'view')) !== v) setCtl('tree', 'view', v); }
    if (st[0] === 'hood' && X.scene === 'net') afterUpdate(flyToGene);
  }
  renderMethod(); updateExtraLabels();
}
// the Genes tab's buttons: the gene's neighbourhood in the network; its endotype in the endotype network
function showHood() { openScene('net'); selectGene(X.gene); }
function showInTree(i) { openScene('tree'); const t = optKey('tree', 'view', /meta|endo/i); if (t) setCtl('tree', 'view', t); selectEndo(ED.genes[i].endo); }
// the Endotypes tab's buttons: the picked endotype in another scene
function showEndoIn(k) { openScene(k); flyToEndo(); renderEndo(); renderMethod(); }
function flyToGene() {
  const A = setApi('net'), i = X.gene >= 0 ? X.gene : X.tab === 'method' && METHOD[X.step][0] === 'hood' ? STORY_IDX() : -1;
  if (X.scene === 'net' && i >= 0 && !(X.gap && X.scene === 'syn')) { if (A && A.geneView) flyTo(A.geneView(i)); else flyNear(anchorOf('net', 'gene'), 2.4); }
}
function setK(j) { X.k = clamp(j | 0, 0, ED.groups.length - 1); renderMethod(); }
// the tree's tests run each time its Tree view opens (its explore(c) follows c.t): open it, or start the clock again
function replayTests() {
  if (X.scene !== 'tree') openScene('tree');
  const v = optKey('tree', 'view', /^tree$/i);
  if (v && ctlValue('tree', ctlOf('tree', 'view')) !== v) setCtl('tree', 'view', v); else X.t0 = performance.now();
}
// Stand in the gap: on screen a view from inside the cleft; in the headset the synapse life size around you
function setGap(on) {
  X.gap = on;
  if (XR.on) xrRoom(on);
  if (on && X.scene !== 'syn') openScene('syn', false);
  if (X.scene === 'syn') flyTo(view('syn', on ? 'gap' : 'default'));
  document.querySelectorAll('[data-ctl="gap"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
  renderScenes();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the
// picked endotype and gene, the method's step and its k. Turning and standing in the gap are each person's own view.
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
  for (const [k] of SCENES) ctl[k] = Object.fromEntries((GL.sets[k].controls || []).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, endo: X.endo, gene: X.gene, k: X.k, step: X.step };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.endo === -1 || int(v.endo, 0, ED.endo.length)) && v.endo !== X.endo) selectEndo(v.endo, false);
  if ((v.gene === -1 || int(v.gene, 0, ED.M)) && v.gene !== X.gene) { $('#q').value = v.gene >= 0 ? ED.genes[v.gene].sym : ''; selectGene(v.gene, false); }
  if (int(v.k, 0, ED.groups.length) && v.k !== X.k) setK(v.k);
  if (int(v.step, 0, METHOD.length) && v.step !== X.step) showStep(v.step, true);
  // the scene and its controls last; a control flies to its own view as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of GL.sets[k].controls || []) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
}

// ------------------------------------------------------------- search --
// the module's genes by symbol first, then by a seed's protein name or a cell part in its row of the matrix
function matches(q, limit) {
  q = String(q == null ? '' : q).trim().toUpperCase();
  if (!q) return [];
  const res = [];
  ED.genes.forEach((g, i) => {
    const s = g.sym.toUpperCase();
    let r = -1;
    if (s === q) r = 0; else if (s.startsWith(q)) r = 1; else if (q.length >= 3 && s.includes(q)) r = 2;
    else if (q.length >= 4 && g.seed >= 0 && ED.seeds[g.seed][1].toUpperCase().includes(q)) r = 3;
    else if (q.length >= 4 && g.terms.some(t => ED.terms[t].toUpperCase().includes(q))) r = 4;
    if (r >= 0) res.push([r, i]);
  });
  return res.sort((a, b) => a[0] - b[0] || ED.genes[a[1]].sym.localeCompare(ED.genes[b[1]].sym)).slice(0, limit || 8).map(r => r[1]);
}
const findGene = s => { const i = geneIdx(s); return i < 0 ? (matches(s, 1)[0] ?? -1) : i; };
const endoName = id => `${id} · ${ED.endo[id].name}`;
const geneNote = i => { const g = ED.genes[i]; return `${g.seed >= 0 ? 'seed' : 'found'} · ${endoName(g.endo)}`; };
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    items = matches(input.value, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(ED.genes[i].sym)}</b><span>${esc(ED.genes[i].seed >= 0 ? ED.seeds[ED.genes[i].seed][1] : 'found by the walk')}</span><em>${esc(endoName(ED.genes[i].endo))}</em></li>`).join('');
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
  if (i >= 0) { $('#q').value = ED.genes[i].sym; selectGene(i); } else { X.gene = -1; pushState(); renderGene(-2, q); }
}

// ------------------------------------------------------------------ panes --
// seeds of the poster's endotypes, for a quick start
const QUICK = ['COLQ', 'AGRN', 'SNAP25', 'SYT2', 'SLC25A1', 'SCN4A', 'CHRNE', 'DOK7', 'MUSK', 'RAPSN'];
// genes for the neighbourhood step: a seed of each endotype that has one (its first)
const HOOD_GENES = () => ED.endo.map(e => geneIdx(e.seeds[0])).filter(i => i >= 0);
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;
// links inside an endotype, and from a gene to each endotype (the module's own links)
const linksIn = id => ED.members[id].reduce((a, i) => a + ED.genes[i].nb.filter(j => ED.genes[j].endo === id).length, 0) / 2;
const fmtP = p => (p >= 0.001 ? String(+p.toPrecision(2)) : p.toExponential(1).replace('e-', ' × 10^-').replace(/\^-(\d+)/, (m, d) => '⁻' + [...d].map(x => '⁰¹²³⁴⁵⁶⁷⁸⁹'[x]).join('')));
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-endo" role="tabpanel"></div>
    <div class="pane" id="pane-genes" role="tabpanel">
      <div class="search"><input id="q" type="search" placeholder="Search a gene of the module, or a cell part" autocomplete="off" spellcheck="false" aria-label="Search genes" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
      <div id="ginfo"></div>
    </div>
    <div class="pane" id="pane-method" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  attachSuggest($('#q'), $('#qs'), (i, text) => { if (i !== null && i !== undefined) { $('#q').value = ED.genes[i].sym; selectGene(i); } else runQuery(text); });
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      endo: () => selectEndo(n === X.endo ? -1 : n), gene: () => { $('#q').value = ED.genes[n].sym; showTab('genes'); selectGene(n); },
      quick: () => { $('#q').value = ED.genes[n].sym; selectGene(n); }, hood: showHood, intree: () => showInTree(n),
      show: () => showEndoIn(v), step: () => showStep(n), k: () => setK(n), replay: replayTests,
      hgene: () => { $('#q').value = ED.genes[n].sym; selectGene(n, false); showStep(2); },
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), gap: () => setGap(!X.gap),
    }[b.dataset.act] || (() => {}))();
  });
  renderAll(); renderGene(-1);
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Stand in the gap</span><div class="seg" data-ctl="gap" role="group" aria-label="Stand in the gap of the synapse">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.gap ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else setGap(b.dataset.v === 'on');
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
  // the Method tab shows its step's scene
  if (k === 'method' && X.scene !== METHOD[X.step][2]) openScene(METHOD[X.step][2]);
  updateExtraLabels();
}
function renderAll() { renderEndo(); renderGene(X.gene); renderMethod(); renderScenes(); }
const SHOW_IN = [['tree', 'In the tree'], ['syn', 'In the synapse'], ['net', 'In the network']];
function renderEndo() {
  const pane = $('#pane-endo');
  if (!pane) return;
  const id = X.endo, E = ED.endo[id];
  let h = `<p class="sub">The ${ED.endo.length} endotypes the authors found among the ${ED.M} genes of the CMS module. Pick one to see its genes, and where it works.</p>
    <div class="chips">${ED.endo.map(e => chip(`data-act="endo" data-v="${e.id}"`, `${e.id} · ${esc(e.name)} <small>${e.n}</small>`, id === e.id, e.col)).join('')}</div>`;
  if (E) {
    const mem = ED.members[id], seeds = mem.filter(i => ED.genes[i].seed >= 0), L = linksIn(id);
    h += `<h3><span class="sw" style="background:${E.col}"></span>${esc(endoName(id))}</h3>
      <dl class="stats"><dt>Genes</dt><dd>${mem.length}<small>${seeds.length ? `${seeds.length} of them ${seeds.length === 1 ? 'a seed' : 'seeds'}` : 'no seed: all found by the walk'}</small></dd>
      <dt>Strongest term</dt><dd style="font-size:15px">${esc(E.term)}<small>${STRONG[E.strong]} (adjusted p ${fmtP(E.p)})</small></dd>
      <dt>Place</dt><dd style="font-size:15px">${E.place ? esc(PLACE[E.place] || E.place) : 'no shared place'}</dd>
      <dt>Links inside</dt><dd>${L}<small>${L ? 'among its own genes, in the protein network' : 'none among its own genes: a loose cloud'}</small></dd></dl>
      <div class="chips">${SHOW_IN.map(([k, n]) => chip(`data-act="show" data-v="${k}"`, n, X.scene === k)).join('')}</div>
      <p class="grp-h">Its genes (seeds in bold)</p>
      <div class="chips">${seeds.concat(mem.filter(i => ED.genes[i].seed < 0)).map(i => `<button type="button" data-act="gene" data-v="${i}">${ED.genes[i].seed >= 0 ? `<b>${esc(ED.genes[i].sym)}</b>` : esc(ED.genes[i].sym)}</button>`).join('')}</div>`;
  } else h += `<p class="empty">${FACTS.clear} endotypes share a clear place in the cell, ${FACTS.weak} a weak one, ${FACTS.none} none. Colours are the same in every scene.</p>`;
  pane.innerHTML = h;
}
function renderGene(i, q) {
  const pane = $('#ginfo');
  if (!pane) return;
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No gene of the module matches “${esc(q)}”. Try a symbol like COLQ, or a cell part like synapse.</p>` : `<p class="empty">Search above, or click a gene in the network or the tree. The ${ED.M} genes are those of the CMS module: ${FACTS.seeds} seeds and ${FACTS.found} genes the walk found.</p>`}
      <div class="quick">${QUICK.map(geneIdx).filter(k => k >= 0).map(k => `<button type="button" data-act="quick" data-v="${k}">${esc(ED.genes[k].sym)}</button>`).join('')}</div>`;
    return;
  }
  const G = ED.genes[i], E = ED.endo[G.endo], S = G.seed >= 0 ? ED.seeds[G.seed] : null;
  const hood = ED.hoodOf(i), inMod = hood.filter(j => j < ED.M).length;
  pane.innerHTML = `<h3>${esc(G.sym)}</h3><p class="sub">${S ? `${esc(S[1])}. Seed: a CMS gene (Gene Table item ${esc(S[2])}).` : 'Found by the walk: not a known CMS gene, but close to the seeds.'}</p>
    <div class="chips">${chip(`data-act="endo" data-v="${G.endo}"`, `Endotype ${esc(endoName(G.endo))}`, X.endo === G.endo, E.col)}</div>
    <dl class="stats" style="margin-top:12px"><dt>Cell parts</dt><dd>${G.terms.length}<small>in its row of the matrix</small></dd>
    <dt>Links</dt><dd>${G.nb.length}<small>to other genes of the module</small></dd>
    <dt>Neighbours</dt><dd>${hood.length}<small>proteins, ${inMod} of them in the module</small></dd></dl>
    <div class="actions"><button class="btn" type="button" data-act="hood">Show its neighbourhood</button><button class="btn" type="button" data-act="intree" data-v="${i}">Show it in the tree</button></div>
    ${G.terms.length ? `<p class="grp-h">Cell parts in its row</p><p class="sub" style="margin:0 0 8px">${esc(G.terms.map(t => ED.terms[t]).join(', '))}</p>` : '<p class="sub">No cell part in its row.</p>'}
    ${G.nb.length ? `<p class="grp-h">Linked genes in the module</p><div class="chips">${G.nb.map(j => `<button type="button" data-act="gene" data-v="${j}"><span class="sw" style="background:${endoCol(ED.genes[j].endo)}"></span>${esc(ED.genes[j].sym)}</button>`).join('')}</div>` : ''}`;
}
// one sentence per step, and its control
const NOTE = `Illustrative: the endotypes are the authors' result. The steps before them were re-run on the same network with the package's default settings to show how the method works; the tree is drawn to agree with the authors' endotypes.`;
function methodText(st) {
  const F = FACTS;
  return {
    groups: `Each seed gets a neighbourhood, its k closest proteins in the network. Seeds whose neighbourhoods meet form a group: ${ED.groups[0].n} groups at k = ${ED.groups[0].k}${F.oneK ? `, one from k = ${F.oneK} on` : ''}.`,
    walk: `Walkers start at the seeds. At every step one jumps back to a seed with probability ${F.r}, otherwise it hops to a random neighbour. The most visited genes join the ${F.seeds} seeds until the module holds together: ${F.found} found, ${F.module} in all.`,
    hood: `A walk from one gene alone marks its neighbourhood, the top ${F.pct}% of the network (${F.hood} proteins). The cell parts enriched there, with the gene's own, are its row of the matrix.`,
    tree: `Genes with similar rows join into a tree. Tree2BreakSpace tests each split from the root down and keeps it only when the two sides differ: ${F.cuts} of ${F.merges} splits.`,
    endo: `The kept splits leave ${F.endotypes} endotypes: one bubble each, with bands as wide as the links between them. Pick one in Endotypes to bring it forward.`,
  }[st];
}
function renderMethod() {
  const pane = $('#pane-method');
  if (!pane) return;
  const st = METHOD[X.step][0];
  let h = `<div class="chips">${METHOD.map(([k, n], j) => chip(`data-act="step" data-v="${j}"`, `${j + 1} · ${n}`, X.step === j)).join('')}</div>
    <p>${esc(methodText(st))}</p>`;
  const ctlChips = (k, key) => { const c = ctlOf(k, key); return c ? `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-scene="${k}" data-ctl="${key}" data-v="${v}"`, esc(n), ctlValue(k, c) === v)).join('')}</div>` : ''; };
  if (st === 'groups') h += `<p class="grp-h">Neighbourhood size k</p><div class="chips">${ED.groups.map((g, j) => chip(`data-act="k" data-v="${j}"`, `k = ${g.k} <small>${g.n} ${g.n === 1 ? 'group' : 'groups'}</small>`, X.k === j)).join('')}</div>`;
  if (st === 'walk') h += ctlChips('net', 'walkers') + ctlChips('net', 'view');
  if (st === 'hood') {
    const cur = X.gene >= 0 ? X.gene : STORY_IDX(), list = [...new Set([cur, ...HOOD_GENES()])].filter(i => i >= 0);
    h += `<p class="grp-h">A gene (a seed of each endotype that has one; or search any in Genes)</p><div class="chips">${list.map(i => chip(`data-act="hgene" data-v="${i}"`, esc(ED.genes[i].sym), i === cur, endoCol(ED.genes[i].endo))).join('')}</div>`;
  }
  if (st === 'tree') h += ctlChips('tree', 'view') + `<div class="actions"><button class="btn primary" type="button" data-act="replay">Replay the tests</button></div>`;
  if (st === 'endo') h += `<div class="chips">${SHOW_IN.slice(0, 2).map(([k, n]) => chip(`data-act="show" data-v="${k}"`, n, X.scene === k)).join('')}</div>`;
  h += `<p class="note" style="margin-top:14px">${esc(NOTE)}</p>`;
  pane.innerHTML = h;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'syn' ? `<div class="actions">${chip('data-act="gap"', 'Stand in the gap', X.gap)}</div>` : ''}
    ${X.endo >= 0 || X.gene >= 0 ? `<p class="sub" style="margin-top:10px">Also shown: ${[X.endo >= 0 ? `endotype ${esc(endoName(X.endo))}` : '', X.gene >= 0 ? esc(ED.genes[X.gene].sym) : ''].filter(Boolean).join(' and ')} (Endotypes and Genes tabs).</p>` : ''}`;
}
// labels the panes add (the sets label their own picks: the gene in the network, the endotypes in the tree and synapse)
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const s = GL.sets[X.scene], own = at => (s.labels || []).some(L => L.at === at);
  // (the network labels a seed with its neighbourhood itself)
  const sym = X.gene >= 0 ? ED.genes[X.gene].sym : '', rest = X.gene >= 0 ? endoName(ED.genes[X.gene].endo) : '';
  const add = (set, at) => LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(sym)}</b>${esc(rest)}`, 'cyn'), set, at, o: -1, txt: [sym, rest, 'cyn'] });
  if (X.gene >= 0 && ED.genes[X.gene].seed < 0 && X.scene === 'net' && s.anchors.gene && !own('gene')) add('net', 'gene');
  // in the tree, where the gene is now (its row, its dot by tree distance, or in its endotype's bubble)
  const T = setApi('tree'), i = X.gene;
  if (i >= 0 && X.scene === 'tree' && T && T.genePos) add('tree', () => T.genePos(i));
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { gene } or { endo }, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !(X.scene === 'net' || X.scene === 'tree')) return null;
  const A = setApi(X.scene);
  if (!A || !A.pick) return null;
  const r = A.pick(rc);
  if (typeof r === 'number') return r >= 0 ? { gene: r } : null;
  return r && (r.gene >= 0 || r.endo >= 0) ? r : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) {
  const A = setApi(X.scene);
  if (!A || !p) return null;
  let q = null;
  if (X.scene === 'net' && p.gene >= 0 && A.geneView) q = A.geneView(p.gene).slice(3, 6);
  if (X.scene === 'tree') q = p.gene >= 0 && A.genePos ? A.genePos(p.gene) : p.endo >= 0 && A.endoPos ? A.endoPos(p.endo) : null;
  return q && Number.isFinite(q[0]) ? [q[0], q[1], q[2]] : null;
}
const pickText = p => (p.gene >= 0 ? [ED.genes[p.gene].sym, geneNote(p.gene)] : [`Endotype ${p.endo}`, ED.endo[p.endo].name]);
function choosePick(p) {
  if (!p) return;
  if (p.gene >= 0) { $('#q').value = ED.genes[p.gene].sym; if (X.tab !== 'method') showTab('genes'); selectGene(p.gene, false); if (X.tab === 'method' && X.step === 2) renderMethod(); }
  else { if (X.tab !== 'method') showTab('endo'); selectEndo(p.endo === X.endo ? -1 : p.endo, false); }
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
    cv.style.cursor = p ? 'pointer' : 'grab';
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

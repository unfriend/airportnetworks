
// ================================================================ EXPLORE ==
// Explore mode: open any scene of the tour and play with it, or search the
// curated proteins of the interactome and trace routes between them.
const SCENES = [
  ['int', 'Interactome', 'Human proteins and their interactions. Light up groups that work together, flatten it into a city map, follow diseases and a signal spreading from a patient\'s genes.'],
  ['mac', 'Computer', 'A classic computer, its parts and its wiring: the parts list alone does not tell you how it works.'],
  ['web', 'Internet and friends', 'A map of the internet and the ties between cities around the world: networks are everywhere.'],
  ['dna', 'Genome and proteins', 'DNA, the 23 chromosomes, the shapes of proteins and how many kinds there are.'],
  ['atp', 'ATP synthase', 'A rotary motor and 13 of the proteins that build it: its parts, the machine, how it runs and its network.'],
  ['crowd', 'Rare diseases', 'More than 6,000 rare diseases have a known genetic cause. Each patient asks: which gene, what mechanism, which treatment?'],
  ['sankey', 'Immunity', 'Inborn errors of immunity that mainly cause autoimmunity or autoinflammation: the clinical categories doctors use, against the clusters their genes form in the interactome.'],
  ['scale', 'Scales and team', 'Networks from molecules to people, the four research groups of the institute, and the team.'],
  ['body', 'Whole body', 'A total-body PET scan and the network of organs, in health and in disease.'],
  ['tissue', 'Tissue', 'A stained section of stomach wall, its cells, their network of neighbours, many markers at once, and an embedding.'],
];
const TABS = [['scenes', 'Scenes'], ['protein', 'Proteins']];
const X = { tab: 'scenes', scene: 'int', ctl: {}, t0: 0, turn: 'on', sel: -1, path: null, pathErr: null, pathEnds: null };
const XS = {};
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);

// what the chosen scene and its controls ask for: that set fully in, every other set out
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] += (tg[n] - XS[n]) * k;
  // a gently swaying scene (about 25 degrees either way, so flat ones never turn edge-on), unless you are steering it
  if (X.turn === 'on' && !orbit.to && !orbit.held && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!same && k !== 'int') { selectProtein(-1, false); clearRoute(); }
  if (fly && !same) flyTo(exploreView(k, 'default'));
  renderScenes();
}
// a view for explore mode: wide scenes stand clear of the side panel on wide screens
function exploreView(k, name) {
  const v = view(k, name);
  if (GL.wide && (k === 'sankey' || (k === 'tissue' && (name === 'default' || name === 'section')))) { v[2] += k === 'sankey' ? 1.0 : 0.8; v[3] += k === 'sankey' ? -0.45 : -0.2; }
  return v;
}
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : null;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // some views have their own best camera (cam views named like the option); leaving one goes back to the scene's own view
  if (s.cam && s.cam[v]) flyTo(exploreView(k, v));
  else if (s.cam && was && s.cam[was]) flyTo(exploreView(k, 'default'));
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

// ------------------------------------------------------- proteins (curated) --
const INT = () => GL.sets.int;
function matches(q, limit) {
  q = String(q == null ? '' : q).trim().toLowerCase();
  if (!q) return [];
  const res = [];
  INT().core.forEach((p, i) => {
    const c = p.sym.toLowerCase(), nm = (p.name || '').toLowerCase(), r = (p.role || '').toLowerCase();
    let s = -1;
    if (c === q) s = 0; else if (c.startsWith(q)) s = 1; else if (nm.startsWith(q)) s = 2;
    else if (nm.includes(q) || r.includes(q)) s = 3;
    if (s >= 0) res.push([s, i]);
  });
  return res.sort((a, b) => a[0] - b[0] || INT().core[b[1]].degree - INT().core[a[1]].degree).slice(0, limit || 8).map(r => r[1]);
}
const findProtein = s => { const m = matches(s, 1); return m.length ? m[0] : -1; };
const modName = i => { const m = INT().modules[INT().core[i].module]; return m ? m.name : ''; };
const modCss = i => { const m = INT().modules[INT().core[i].module]; return m ? (m.css || '#95a6bd') : '#95a6bd'; };
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    const q = input.value, C0 = INT().core;
    items = /\s(to|-|–|>)\s/i.test(q) ? [] : matches(q, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(C0[i].sym)}</b><span>${esc(C0[i].name)}</span><em>${esc(modName(i))}</em></li>`).join('');
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
  const parts = q.split(/\s+(?:to|->|-|–|—|>)\s+/i);
  showTab('protein');
  if (parts.length === 2) {
    const s = findProtein(parts[0]), t = findProtein(parts[1]);
    $('#pf').value = s >= 0 ? INT().core[s].sym : parts[0]; $('#pt').value = t >= 0 ? INT().core[t].sym : parts[1];
    runRoute(s, t);
  } else {
    const i = findProtein(q);
    if (i >= 0) selectProtein(i); else renderProtein(-2, q);
  }
}
// the interactome must be on show for anything about proteins
function needInt() { if (X.scene !== 'int') openScene('int'); }
function selectProtein(i, show = true) {
  X.sel = i;
  if (INT().select) INT().select(i);
  if (i >= 0 && show) { needInt(); if (INT().anchors.protein) { const p = INT().anchors.protein(INT().core[i].sym); if (p) flyTo([orbit.cur[0], 18, 2.2, p[0], p[1], p[2]]); } }
  renderProtein(i);
  updateExtraLabels();
}
function runRoute(s, t) {
  X.pathErr = null; X.path = null; X.pathEnds = null;
  if (INT().route) INT().route(-1, -1); // drop any earlier route, even if this query fails
  if (s < 0 || t < 0) X.pathErr = 'Pick two proteins from the suggestions, for example TP53 and BRCA1.';
  else if (s === t) X.pathErr = 'Pick two different proteins.';
  else {
    needInt();
    X.pathEnds = [s, t];
    X.path = INT().route ? INT().route(s, t) : null;
    if (!X.path) X.pathErr = 'No route between these two proteins.';
    else flyTo(view('int', 'default'));
  }
  renderRoute();
  updateExtraLabels();
}
// shared rooms: what everyone at the station sees alike: the tab, the scene and its controls, the selected protein
// and the route's two ends (the camera, its turning, the search box and the headset keyboard stay each person's own)
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
  const s = GL.sets[X.scene];
  return { tab: X.tab, scene: X.scene, ctl: Object.fromEntries((s.controls || []).map(c => [c.key, ctlValue(X.scene, c)])),
    sel: X.sel, route: X.pathEnds ? X.pathEnds.slice() : null };
}
// shows a shared state with the story's own setters, the scene first; ignores what is not valid
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const N = INT().core.length, int = x => Number.isInteger(x) && x >= -1 && x < N;
  if (SCENES.some(([k]) => k === v.scene) && GL.sets[v.scene] && X.scene !== v.scene) openScene(v.scene);
  const ctl = v.ctl && typeof v.ctl === 'object' ? v.ctl : {};
  for (const c of GL.sets[X.scene].controls || []) {
    const x = ctl[c.key];
    if (c.options.some(o => o[0] === x) && ctlValue(X.scene, c) !== x) setCtl(X.scene, c.key, x);
  }
  if (int(v.sel) && X.sel !== v.sel) {
    selectProtein(v.sel, false);
    if (v.sel >= 0 && document.activeElement !== $('#q')) $('#q').value = INT().core[v.sel].sym;
  }
  const r = v.route, cur = X.pathEnds;
  if (r === null && cur) xrClearPath();
  else if (Array.isArray(r) && r.length === 2 && r.every(x => int(x) && x >= 0) && r[0] !== r[1] && !(cur && cur[0] === r[0] && cur[1] === r[1])) xrPathPreset(r[0], r[1]);
  if (TABS.some(([k]) => k === v.tab) && X.tab !== v.tab) showTab(v.tab);
}
function clearRoute() {
  X.path = null; X.pathErr = null; X.pathEnds = null;
  if (INT().route) INT().route(-1, -1);
  renderRoute();
}
// route steps as names: curated proteins by symbol, the others as unnamed proteins
function routeNames(path) {
  return path.map(n => (typeof n === 'object' && n ? n.sym || '·' : typeof n === 'string' ? n : '·'));
}

// ------------------------------------------------------------------ panes --
const QUICK = ['TP53', 'BRCA1', 'CTNNB1', 'EGFR', 'MTOR', 'PSMA1'];
const ROUTES = [['TP53', 'BRCA1'], ['EGFR', 'CASP3'], ['PSMA1', 'POLR2A']];
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane on" id="pane-scenes" role="tabpanel"></div>
    <div class="pane" id="pane-protein" role="tabpanel">
      <div class="search"><input id="q" type="search" placeholder="Search a protein, or type TP53 to BRCA1" autocomplete="off" spellcheck="false" aria-label="Search proteins or a route" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
      <div id="pinfo"></div>
      <h3>Routes</h3><p class="sub">The fewest steps between two proteins, through the whole network.</p>
      <div class="row"><div class="field"><label for="pf">From</label><input id="pf" autocomplete="off" spellcheck="false"><ul class="sugg" id="pfs"></ul></div>
      <div class="field"><label for="pt">To</label><input id="pt" autocomplete="off" spellcheck="false"><ul class="sugg" id="pts"></ul></div></div>
      <div class="actions"><button class="btn primary" type="button" id="pgo">Find route</button>
      ${ROUTES.map(([s, t]) => `<button class="btn" type="button" data-pre="${s} ${t}">${s} to ${t}</button>`).join('')}</div><div id="presult"></div>
    </div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  attachSuggest($('#q'), $('#qs'), (i, text) => { if (i !== null && i !== undefined) { $('#q').value = INT().core[i].sym; selectProtein(i); } else runQuery(text); });
  const pickField = id => (i, text) => { const v = i !== null && i !== undefined ? i : findProtein(text); if (v >= 0) $(id).value = INT().core[v].sym; };
  attachSuggest($('#pf'), $('#pfs'), pickField('#pf'));
  attachSuggest($('#pt'), $('#pts'), pickField('#pt'));
  $('#pgo').addEventListener('click', () => runRoute(findProtein($('#pf').value), findProtein($('#pt').value)));
  $('#pane-protein').querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    const [s, t] = b.dataset.pre.split(' ');
    $('#pf').value = s; $('#pt').value = t; runRoute(findProtein(s), findProtein(t));
  }));
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.scene) openScene(b.dataset.scene);
    else if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
  });
  renderScenes(); renderProtein(-1); renderRoute();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) setTurn(b.dataset.v); });
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  if (k === 'protein') needInt();
  updateExtraLabels();
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => `<button type="button" data-scene="${k}" aria-pressed="${k === X.scene}"${k === X.scene ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>`).join('')}`;
}
function renderProtein(i, q) {
  const pane = $('#pinfo');
  if (!pane) return;
  const C0 = INT().core;
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No protein matches “${esc(q)}”. Try a gene symbol like TP53, or a name like kinase.</p>` : `<p class="empty">Search above, or click a protein in the interactome. The ${fmt(C0.length)} named proteins come from the network-medicine story; the others are drawn to suggest the rest of the map.</p>`}
      <div class="quick">${QUICK.filter(s => findProtein(s) >= 0).map(s => `<button type="button" data-c="${s}">${s} ${esc(C0[findProtein(s)].name)}</button>`).join('')}</div>`;
    pane.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => selectProtein(findProtein(b.dataset.c))));
    return;
  }
  const p = C0[i], part = INT().partners ? INT().partners(i) : [];
  pane.innerHTML = `<h3>${esc(p.sym)} ${esc(p.name)}</h3><p class="sub">${esc(p.role || '')}</p>
    <dl class="stats">
      <dt>Group</dt><dd><span class="sw" style="display:inline-block;margin-right:6px;background:${modCss(i)}"></span>${esc(modName(i))}</dd>
      <dt>Partners</dt><dd>${part.length}<small>${part.length === 1 ? 'named protein binds it' : 'named proteins bind it'}</small></dd>
      <dt>Essential</dt><dd>${p.essential ? 'Yes<small>cells cannot live without it</small>' : 'No'}</dd>
    </dl>
    <div class="chips">${part.map(j => `<button type="button" data-i="${j}">${esc(C0[j].sym)}</button>`).join('')}</div>`;
  pane.querySelectorAll('.chips [data-i]').forEach(b => b.addEventListener('click', () => selectProtein(+b.dataset.i)));
}
function renderRoute() {
  const el = $('#presult');
  if (!el) return;
  if (X.pathErr) { el.innerHTML = `<p class="empty">${esc(X.pathErr)}</p>`; return; }
  if (!X.path) { el.innerHTML = ''; return; }
  const names = routeNames(X.path), steps = names.length - 1, named = names.filter(n => n !== '·').length;
  el.innerHTML = `<div class="result"><b>${steps}</b> ${steps === 1 ? 'step' : 'steps'}<small>${named} named, ${names.length - named} unnamed proteins on the way</small></div>
    <ol class="hops">${names.map((n, k) => `<li><span>${k}</span>${esc(n === '·' ? 'unnamed protein' : n)}</li>`).join('')}</ol>`;
}
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (X.scene !== 'int' || !INT().anchors.protein) return;
  const add = (i, rest, cls) => {
    const sym = INT().core[i].sym;
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(sym)}</b>${esc(rest)}`, cls), set: 'int', at: () => INT().anchors.protein(sym), o: -1, txt: [sym, rest, cls] });
  };
  if (X.sel >= 0) add(X.sel, INT().core[X.sel].role || '', 'cyn');
  if (X.path && X.pathEnds) { add(X.pathEnds[0], 'start', 'mag'); add(X.pathEnds[1], 'end', 'mag'); }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _inv = new THREE.Matrix4();
// the curated protein under the mouse, in explore mode with the interactome on show
function pickAt(mx, my) {
  if (X.scene !== 'int' || !INT().pick) return -1;
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(INT().group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return INT().pick(_ro, _rd);
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
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.3, 40);
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
      const p = INT().core[i];
      tip.innerHTML = `<b>${esc(p.sym)}</b>${esc(p.role || p.name)}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const i = pickAt(ev.clientX, ev.clientY);
      if (i >= 0) { $('#q').value = INT().core[i].sym; showTab('protein'); selectProtein(i, false); }
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
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.3, 40);
  }, { passive: false });
}

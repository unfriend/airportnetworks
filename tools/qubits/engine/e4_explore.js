// ================================================================ EXPLORE ==
// Explore mode: the example networks and their cuts (Network), the building blocks and the toolbox (Bricks), the real
// run's residual by depth and the circuit (Depth); or any scene with its own controls (Scenes).
const SCENES = [
  ['pairs', 'Pairs and map', 'The grid of all pairs of genes, the example network as a map with two walkers in its valleys (illustrative), the chip with three qubits and the eight neighborhoods.'],
  ['cube', 'Cube', 'An example network cut in two, four and eight; its coarse operator A_c on the cube; its building blocks (Pauli strings), added up; and the toolbox, with what falls outside it.'],
  ['chart', 'Chart', 'The real network\'s residual at each depth, our cuts against random ones, with the example network\'s; and the recipe as a circuit of six gates.'],
];
const SCENE_SHORT = { pairs: 'Pairs' };
const TABS = [['network', 'Network'], ['bricks', 'Bricks'], ['depth', 'Depth'], ['scenes', 'Scenes']];
const ctlsOf = k => GL.sets[k].controls || [];
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
// (explore opens on the story's own network, at its cube)
const X = { tab: 'network', scene: 'cube', ctl: { cube: { view: 'cube', net: String(NETI) } }, t0: 0, turn: 'on', brick: null, sum: 0, gal: 'largest' };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['cube_net', 'cube_cut', 'cube_algebra', 'cube_focus', 'chart_src', 'pairs_code']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the cam view of the same name, or the one it stands for
const CAM_ALIAS = { pairs: { pairs: 'grid' }, cube: { cut: 'genes', toolbox: 'bricks' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [v, al[v]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, 'view'); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the cube's analysis, gallery and picking; the chart's series and gates
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
const NB = () => api('cube').NB || 10;
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// what the cube shows: its network, cut, bits and algebra (its own controls), and their analysis (computed here)
const cubeNet = () => clamp(parseInt(ctlValue('cube', ctlOf('cube', 'net')), 10) || 0, 0, Q.NETS.length - 1);
const cubeCut = () => (ctlValue('cube', ctlOf('cube', 'cut')) === '1' ? 'random' : 'found');
const cubeBits = () => clamp(parseInt(ctlValue('cube', ctlOf('cube', 'bits')), 10) || 3, 1, 3);
const cubeAlg = () => (ctlValue('cube', ctlOf('cube', 'alg')) === '0' ? 'tfim' : 'odd');
const curAn = () => anOf(cubeNet(), cubeCut(), cubeBits());
const inAlg = (k, L, alg) => k > 0 && Q.algebra(alg || cubeAlg(), L).set.has(k);
const chartSrc = () => (ctlValue('chart', ctlOf('chart', 'src')) === 'ex' ? 1 : 0);

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
// (the brick on the big cube, the gallery shown, the strings added up)
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  if (k === 'cube' && c.view !== 'genes' && c.view !== 'cut') {
    tg.cube_focus = brickK(X.brick, cubeBits());
    if (c.view === 'bricks' || c.view === 'toolbox') {
      tg.cube_lesson = X.gal === 'kinds' ? 1 : 0;
      if (c.view === 'bricks' && X.sum > 0 && X.gal !== 'kinds') { tg.cube_build = 1; tg.cube_sum = X.sum; }
    }
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
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
  if (fly && !same) { flyTo(view(k, viewCam(k) || 'default')); sfxAct('whoosh', k, null, { dur: 0.8 }); }   // (sound effects: another scene)
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  if (ctlValue(k, c) !== v) ctlSound(k, key, v);
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// (sound effects: a control changed: another network grows, a cut snaps, the bits step, the example's point chimes)
function ctlSound(k, key, v) {
  const o = key === 'view' ? ['whoosh', k, null, { dur: 0.7, pitch: 1.1 }] : key === 'net' ? ['grow', k, 'genes', { dur: 1.5 }]
    : key === 'cut' || key === 'alg' ? ['snap', k, 'cube', { pitch: v === '1' ? 1 : 0.8 }] : key === 'bits' ? ['step', k, 'cube', { pitch: Math.pow(2, 2 * (+v - 1) / 12) }]
    : key === 'ex' ? (v === 'on' ? ['ping', k, 'ex3'] : null) : ['step', k, null];
  if (o) sfxAct(...o);
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
// a brick (a Pauli string by name, 'X2X1'; null none), shown on the big cube; gal: the gallery it was picked from (the
// kinds of the reference figure, or this network's largest)
function selectBrick(nm, gal, ui = true) {
  const was = X.brick;
  X.brick = isBrick(nm) ? nm : null;
  if (X.brick && X.brick !== was) sfxAct('clink', 'cube', 'top');   // (sound effects: a brick picked)
  if (gal === 'kinds' || gal === 'largest') X.gal = gal;
  if (ui) {
    // (picked without its gallery: the network's largest if it is one of them, else the kinds)
    if (X.brick && !gal) X.gal = largestAt(curAn()).includes(X.brick) ? 'largest' : 'kinds';
    if (X.brick) X.sum = 0;
    if (!(X.scene === 'cube' && (viewIs('cube', 'bricks') || viewIs('cube', 'toolbox')))) showView('cube', 'bricks');
  }
  renderAll();
}
// how many of the network's largest strings are added up (0 to 10): the big cube rebuilt from them, and the error left
function setSum(n, ui = true) {
  const s0 = X.sum;
  X.sum = clamp(Math.round(+n) || 0, 0, NB());
  if (X.sum !== s0) sfxAct('step', 'cube', 'cube', { pitch: Math.pow(2, X.sum / 12) });   // (sound effects: a brick added or taken away)
  if (ui) {
    X.brick = null; X.gal = 'largest';
    if (!(X.scene === 'cube' && viewIs('cube', 'bricks'))) { showView('cube', 'bricks'); renderAll(); }
  }
  syncSum();
}
// the gallery beside the big cube: the kinds of brick (the reference figure) or this network's ten largest
function setGal(g, ui = true) {
  if (g !== 'kinds' && g !== 'largest') return;
  if (g !== X.gal) sfxAct('whoosh', 'cube', 'gallery', { dur: 0.6, pitch: 1.2 });   // (sound effects: the other gallery)
  X.gal = g;
  if (ui) { if (g === 'kinds') X.sum = 0; if (X.scene !== 'cube' || !(viewIs('cube', 'bricks') || viewIs('cube', 'toolbox'))) showView('cube', 'bricks'); }
  renderAll();
}
// a control of the cube or the chart picked from a tab: its scene brought up
function sceneCtl(k, key, v) { if (X.scene !== k) openScene(k); setCtl(k, key, v); }

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (the cube's
// network, cut, bits and algebra among them), the brick shown, how many strings are added up and the gallery. The
// camera is each person's own.
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
  return { tab: X.tab, scene: X.scene, ctl, brick: X.brick, sum: X.sum, gal: X.gal };
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
  // then the picks
  if ((v.brick === null || isBrick(v.brick)) && v.brick !== X.brick) selectBrick(v.brick, null, false);
  if ((v.gal === 'kinds' || v.gal === 'largest') && v.gal !== X.gal) setGal(v.gal, false);
  if (Number.isInteger(v.sum) && v.sum >= 0 && v.sum <= NB() && v.sum !== X.sum) setSum(v.sum, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const link = (act, v, text) => `<button type="button" data-act="${act}" data-v="${esc(v)}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${text}</button>`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// a cell's color (by its code at 3 bits: a cell at fewer bits takes its first corner's), as in the sets
const cellCol = (c, L) => Q.CELL_COLORS[c << (3 - L)];
// the cells of an analysis, in a line: '8 of 40 genes', or '8, of 21 to 62 genes'
const cellsText = A => { const lo = Math.min(...A.sizes), hi = Math.max(...A.sizes); return lo === hi ? `${A.sizes.length} of ${lo} genes` : `${A.sizes.length}, of ${lo} to ${hi} genes`; };
const algLabel = (alg, L) => Q.algebra(alg, L).label;
// the strings of the gallery now: the kinds of the reference figure at the bits shown, or this network's largest
const kindsAt = L => (api('cube').lesson ? api('cube').lesson(L) : []);
const largestAt = A => A.order.slice(0, NB()).map(k => Q.name(k, A.L));
const GATE_COL = { RX: RED, RZZ: BLUE, RZ: BLUE };
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
      brick: () => selectBrick(v === X.brick ? null : v, b.dataset.gal), gal: () => setGal(v),
      view: () => { const [k, w] = v.split(':'); showView(k, w); }, scene: () => openScene(v),
      ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
    }[b.dataset.act] || (() => {}))();
  });
  // the sum's slider changes in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => { if (ev.target.dataset.sum !== undefined) setSum(+ev.target.value, true); });
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
  if (k === 'network' && !(X.scene === 'cube' && ['genes', 'cut', 'cube'].some(v => viewIs('cube', v)))) showView('cube', 'cube');
  if (k === 'bricks' && !(X.scene === 'cube' && (viewIs('cube', 'bricks') || viewIs('cube', 'toolbox')))) showView('cube', 'bricks');
  if (k === 'depth' && X.scene !== 'chart') openScene('chart');
}
function renderAll() { renderNetwork(); renderBricks(); renderDepth(); renderScenes(); updateExtraLabels(); }
function renderNetwork() {
  const pane = $('#pane-network');
  if (!pane) return;
  const ni = cubeNet(), N = Q.NETS[ni], L = cubeBits(), A = curAn(), p3 = anOf(ni, cubeCut(), 3).purity;
  const ch = (key, opts, on) => opts.map(([v, n]) => chip(`data-act="ctl" data-scene="cube" data-ctl="${key}" data-v="${v}"`, esc(n), on(v))).join('');
  pane.innerHTML = `<p class="sub">Four example networks of ${Q.network(N.key).n} genes, made up for this story. Pick one, cut it, and see how much of it the toolbox keeps. Every number here is computed as you choose.</p>
    <p class="grp-h">Network</p><div class="chips">${ch('net', Q.NETS.map((n, i) => [String(i), n.name]), v => +v === ni)}</div>
    <p class="sub">${esc(cap(N.note))}.</p>
    <p class="grp-h">Cut</p><div class="chips">${ch('cut', [['0', 'Found'], ['1', 'Random halvings']], v => (v === '1') === (cubeCut() === 'random'))}</div>
    <p class="grp-h">Bits (cuts)</p><div class="chips">${ch('bits', [['1', '1'], ['2', '2'], ['3', '3']], v => +v === L)}</div>
    <p class="grp-h">Show</p><div class="chips">${[['genes', 'Genes'], ['cut', 'The cuts'], ['cube', 'The cube (A_c)']].map(([v, n]) => chip(`data-act="view" data-v="cube:${v}"`, n, X.scene === 'cube' && viewIs('cube', v))).join('')}</div>
    <dl class="stats"><dt>Cells</dt><dd>${cellsText(A)}</dd>
      <dt>Hidden groups</dt><dd>${p3 === null ? 'none' : pct(p3)}<small>${p3 === null ? 'this network has no groups' : 'of genes with their group, at 3 bits'}</small></dd>
      <dt>Links cut</dt><dd>${pct(A.cutShare)}<small>of links run between cells</small></dd>
      <dt>On cube edges</dt><dd>${pct(A.cubeShare)}<small>of the traffic between cells</small></dd>
      <dt>Residual</dt><dd>${f2(A.fits.odd.residual)}<small>${algLabel('odd', L)}</small> &nbsp;${f2(A.fits.tfim.residual)}<small>${algLabel('tfim', L)}</small></dd></dl>
    <div class="chips">${A.sizes.map((s, c) => chip('disabled', `${codeStr(c, L)} · ${s}`, false, cellCol(c, L))).join('')}</div>
    <p class="note">The residual is the share of A_c the toolbox drops: 0 nothing lost, 1 everything. At 1 bit it is always 0. The cut stands in for the authors' beam search. After the method and figures of Joel Hancock.</p>`;
}
function renderBricks() {
  const pane = $('#pane-bricks');
  if (!pane) return;
  const L = cubeBits(), A = curAn(), alg = cubeAlg(), k = brickK(X.brick, L);
  const one = (nm, gal, w) => { const kk = Q.parse(nm, L), out = kk > 0 && !inAlg(kk, L, alg);
    return chip(`data-act="brick" data-gal="${gal}" data-v="${nm}"`, `${sub(nm)}${w !== undefined ? ` <small>${f2(w)}</small>` : ''}`, X.brick === nm, kk === 0 ? null : out ? GRAY : PURPLE); };
  pane.innerHTML = `<p class="sub">Pauli strings, the building blocks of any traffic table between cells. Pick one to see it on the cube, or add the largest up.</p>
    <p class="grp-h">The kinds of brick (the reference figure)</p><div class="chips">${kindsAt(L).map(nm => one(nm, 'kinds')).join('')}</div>
    <p class="grp-h">This network's ${word(NB())} largest, with their weights</p><div class="chips">${largestAt(A).map(nm => one(nm, 'largest', A.c.re[Q.parse(nm, L)])).join('')}</div>
    ${k >= 0 ? `<h3>${esc(sub(X.brick))}</h3><p>${esc(cap(brickWhat(k, L)))}. Its weight here: ${f2(A.c.re[k])}. ${k === 0 ? 'The trace part: the same everywhere, kept.' : inAlg(k, L, alg) ? `Inside the toolbox, ${algLabel(alg, L)}: kept.` : `Outside the toolbox, ${algLabel(alg, L)}: dropped.`}</p>`
      : X.brick ? `<p class="sub">${esc(sub(X.brick))} needs more bits than the ${L} shown.</p>` : ''}
    <p class="grp-h">Add them up, largest first <b data-sumv style="margin-left:auto;color:var(--ink)">${X.sum}</b></p>
    <input type="range" data-sum min="0" max="${NB()}" step="1" value="${X.sum}" aria-label="Strings added up" style="accent-color:${PURPLE}">
    <p class="sub" data-errv>${errText(A)}</p>
    <p class="grp-h">The toolbox (a Lie algebra)</p><div class="chips">${[['1', 'odd'], ['0', 'tfim']].map(([v, a]) => chip(`data-act="ctl" data-scene="cube" data-ctl="alg" data-v="${v}"`, `${algLabel(a, L)} · ${Q.algebra(a, L).dim} strings`, alg === a)).join('')}</div>
    <div class="chips">${[['bricks', 'Every brick'], ['toolbox', 'Only the toolbox']].map(([v, n]) => chip(`data-act="view" data-v="cube:${v}"`, n, X.scene === 'cube' && viewIs('cube', v))).join('')}</div>
    <p class="sub">Residual: ${f2(A.fits[alg].residual)} of the table falls outside ${algLabel(alg, L)} and is dropped (its generators alone hold ${pct(A.fits[alg].gens)} of the traceless weight).</p>
    <p class="note">Purple: inside the toolbox; gray: outside, dropped; I, the trace part, is kept. Solid +, dashed −; corners red for +1, blue for −1. ${algLabel('tfim', L)} is the TFIM chain (X on each qubit, ZZ on neighbors); ${algLabel('odd', L)} adds Z on q${L - 1}.</p>`;
}
// the error left after the strings added up so far
const errText = A => (X.sum ? `Error left: ${f2(A.errors[Math.min(X.sum, A.errors.length - 1)])} (1 with none added)` : 'Error left: 1, with none added yet');
// the sum's readouts and slider, in place (a drag is not cut short)
function syncSum() {
  const A = curAn();
  document.querySelectorAll('[data-sumv]').forEach(el => { el.textContent = X.sum; });
  document.querySelectorAll('[data-errv]').forEach(el => { el.textContent = errText(A); });
  document.querySelectorAll('input[data-sum]').forEach(el => { if (document.activeElement !== el) el.value = X.sum; });
}
function renderDepth() {
  const pane = $('#pane-depth');
  if (!pane) return;
  const R = FACTS.real.R, ex = FACTS.ex.res, circ = viewIs('chart', 'circuit'), src = chartSrc(), G = (api('chart').gates || [])[src] || [];
  const td = (v, b) => `<td style="text-align:right;padding:3px 4px${b ? ';font-weight:700' : ''}">${v}</td>`;
  const row = (name, vals, col) => `<tr><th style="text-align:left;font-weight:400;padding:3px 6px 3px 0;color:${inkCol(col)}">${name}</th>${vals.map(v => td(v === null ? '' : f2(v))).join('')}</tr>`;
  pane.innerHTML = `<p class="sub">In the real network: how much of A_c the best toolbox drops at each depth, our cuts against random ones. 0 means nothing lost.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums;margin:0 0 10px">
      <tr><th style="text-align:left;font-weight:400;color:var(--muted)">Bits</th>${R.bits.map(b => td(b, true)).join('')}</tr>
      ${row('Our cuts', R.ours, '#46d9ff')}${row('Random', R.random, GRAY)}${row('Example', R.bits.map((b, i) => (i < ex.length ? ex[i] : null)), '#ffb43b')}</table>
    <p class="sub">Good at 2 to 4 bits, worse with every bit: at 8 bits ours lose ${f2(FACTS.real.ours(8))} (the best variant ${f2(R.best8)}) and random cuts ${f2(FACTS.real.rand(8))}. The example network's row is computed here.</p>
    <p class="grp-h">Show</p><div class="chips">${[['chart', 'The chart'], ['circuit', 'The circuit']].map(([v, n]) => chip(`data-act="view" data-v="chart:${v}"`, n, X.scene === 'chart' && viewIs('chart', v))).join('')}</div>
    ${circ ? `<p class="grp-h">Angles</p><div class="chips">${[['real', 'Real network'], ['ex', 'Example network']].map(([v, n]) => chip(`data-act="ctl" data-scene="chart" data-ctl="src" data-v="${v}"`, n, (v === 'ex') === !!src)).join('')}</div>`
      : `<p class="grp-h">Example network</p><div class="chips">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => chip(`data-act="ctl" data-scene="chart" data-ctl="ex" data-v="${v}"`, n, ctlValue('chart', ctlOf('chart', 'ex')) === v)).join('')}</div>`}
    <p class="grp-h">One Trotter step at 3 bits in ${FACTS.alg.odd.label} (${src ? 'the example network, computed here' : 'the real network'})</p>
    <ul class="steps">${G.map(g => `<li data-col="${GATE_COL[g.type]}" style="border-left-color:${GATE_COL[g.type]}"><b style="color:${inkCol(GATE_COL[g.type])}">${g.type} on ${g.qubits.map(q => 'q' + q).join(', ')}</b>θ = ${f3s(g.theta)}</li>`).join('')}</ul>
    <p class="note">θ = −2ct, with c = tr(P A_c)/8 and R_P(θ) = exp(−iθP/2), t = 1. Red for X-type gates, blue for Z-type. In the real network at 3 bits, ${FACTS.alg.odd.label}'s generators carry ${FACTS.real.so7.gens}% of A_c's traceless weight and the whole algebra ${FACTS.real.so7.whole}%. Real numbers: the authors' run (Joel Hancock) on ${esc(FACTS.source)}.</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'cube' && X.brick ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(sub(X.brick))} (Bricks tab).</p>` : ''}`;
}
// labels the panes add (none: the sets label their own picks, the cube its focused string)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { brick } (a string of the
// gallery) or { cell } (a corner of the big cube, by its code), or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'cube') return null;
  const A = api('cube');
  if (!A.pick) return null;
  let r = null;
  try { r = A.pick(rc); } catch (e) { return null; }
  return !r ? null : r.kind === 'brick' && isBrick(r.name) ? { brick: r.name } : r.kind === 'corner' ? { cell: r.code } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) { return null; }
const pickText = p => (p.brick ? [sub(p.brick), brickWhat(Q.parse(p.brick, cubeBits()), cubeBits())]
  : [`Cell ${p.cell}`, `${curAn().sizes[parseInt(p.cell, 2)] || 0} genes`]);
function choosePick(p) {
  if (!p || !p.brick) return;
  if (X.tab !== 'bricks') showTab('bricks');
  selectBrick(p.brick === X.brick ? null : p.brick, null, false);
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

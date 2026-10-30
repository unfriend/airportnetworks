// ================================================================ EXPLORE ==
// Explore mode: the poster's patch, its balls and the tower of scales at any radius (Patch), the 123 slides, their
// curves, scores and held-out results (Cohort), which radii tell the two classes apart and a window of radii of your own
// (Scales), the new slide scored cell by cell (Cells); or any scene with its own controls (Scenes). Every number shown
// is looked up in TOPO_DATA (through TDATA and the sets' api()): nothing is computed here.
const SCENES = [
  ['body', 'Liver', 'The tour\'s body (a PET scan) and its liver lifted out of it: the microanatomy story\'s model, and a thin slice of it drawn from the healthy tile\'s cells.'],
  ['slide', 'Section', `Real tissue drawn from its cells: a healthy tile of ${FACTS.tileSide} µm (${fmt(FACTS.tile)} cells) and the new slide's window of ${SD.side / 1000} mm (${fmt(FACTS.window)} cells), in H&E, as sketches of other modalities or as points, with the fixed scales other tools read.`],
  ['tower', 'Patch', `The poster's patch of ${FACTS.patch} cells: balls growing round them, the pieces and loops, the tower of scales and its barcode.`],
  ['cohort', 'Cohort', `The ${FACTS.slides} slides: their curves, their main shapes and scores, the classifier's wall, the held-out test, and the weight it gives every radius.`],
  ['map', 'Map', 'The new slide scored cell by cell: one cell\'s neighbourhood and its own bars, every cell a centre, the two groups and their cell types, and sketches of the next steps.'],
];
const SCENE_SHORT = {};
// the panes' closing notes, the same on the page and in the headset (a pane's intro may be shorter in the headset)
const NOTE = {
  patch: 'Pieces are H0 (connected components), loops H1 (holes). An edge appears where two balls meet, a triangle where three do: the alpha complex. The counts are the stored bars alive at this radius; the four stops are the poster\'s snapshots.',
  cohort: 'Slides are numbered, never named. The scores are how much of each main shape a slide\'s curve has; its held-out result comes from five-fold cross-validation, each slide predicted by a model that never saw it.',
  scales: 'A window\'s number is its share of the gap, the sum of topocyte\'s stored shares for its radii (fpca_scale_importance), looked up here; the odds factor is e to that share. All of them add up to the gap.',
  cells: s => (s === 'genes' || s === 'proteins' ? 'The genes and proteins are sketches of the workflow, not data.'
    : `The local radius is ${FACTS.delta} µm; at 100 µm, as in the poster's figure, only the colours and groups change. The types are the labels of the computer that found the cells, not a pathologist's.`),
};
const TABS = [['patch', 'Patch'], ['cohort', 'Cohort'], ['scales', 'Scales'], ['cells', 'Cells'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out; the
// Liver scene has the engine's own control instead (the liver in the body, lifted out, or its slice)
const HIDE_CTL = { body: ['view', 'state', 'tracer'] };
const OWN_CTL = { body: [{ key: 'liver', label: 'Liver', options: [['out', 'Lifted out'], ['in', 'In the body'], ['slice', 'A slice']] }] };
// the radii are sliders the panes hold themselves (X.r for the patch, X.mr for a cell's own network): the sets'
// controls of that name only offer a few stops
const isNum = (k, c) => c.key === 'r' && (k === 'tower' || k === 'map');
const allCtl = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key)).concat(OWN_CTL[k] || []);
const ctlsOf = k => allCtl(k).filter(c => !isNum(k, c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(allCtl(k).map(x => [x.key, isNum(k, x) ? (k === 'map' ? X.mr : X.r) : ctlValue(k, x)])));
// whether a scene's slider applies now (the map's radius only for one cell; the window only in the Scales tab)
const numShown = (k, key) => (key === 'r' && k === 'tower') || (key === 'mr' && k === 'map' && mapShow() === 'cell');
const numOf = key => X[key];
// (explore opens on the patch at the radius where the big loop has just closed; each scene starts on the story's own
// choices)
const X = { tab: 'patch', scene: 'tower', t0: 0, turn: 'on',
  ctl: { body: { liver: 'out' }, slide: { piece: 'tile', look: 'he', scale: 'none' }, map: { show: 'cell', delta: '50' },
    tower: { view: 'tower', lit: 'both' }, cohort: { view: 'rack', dim: '1' } },
  r: Math.round(FACTS.snaps[1].r * 100) / 100, mr: FACTS.delta, slide: -1, from: 5, to: 15, cell: -1 };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['tower_lit', 'cohort_dim', 'cohort_pick', 'map_pick', 'map_delta']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { tower: { balls: 'plate', tower: 'default' }, cohort: { held: 'stacks', scales: 'gamma' },
  map: { cell: 'cell', map: 'relief', split: 'split', genes: 'omics', proteins: 'omics' }, slide: { tile: 'tile', window: 'window', both: 'both', whole: 'over' },
  body: { out: 'front', in: 'front', slice: 'front' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
// the control that chooses a scene's camera: its view (the map's Show, the slide's Tissue)
const VIEW_KEY = { map: 'show', slide: 'piece', body: 'liver' };
const viewKey = k => VIEW_KEY[k] || 'view';
const viewCam = k => { const c = ctlOf(k, viewKey(k)); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, viewKey(k)); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the patch's counts and picking, the slides' numbers and picking, the cells' scores,
// bars and picking
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// what the panes choose, by name
const towerView = () => ctlValue('tower', ctlOf('tower', 'view'));
const cohortView = () => ctlValue('cohort', ctlOf('cohort', 'view'));
const cohortDim = () => (ctlValue('cohort', ctlOf('cohort', 'dim')) === '0' ? 0 : 1);
const mapShow = () => ctlValue('map', ctlOf('map', 'show'));
const mapDelta = () => (ctlValue('map', ctlOf('map', 'delta')) === '100' ? 100 : 50);
const DIMS = [['1', 'Loops'], ['0', 'Pieces']];

// the radius the patch shows for X.r (held to the hundredth): one of the poster's snapshots picked is its stored radius,
// so the patch and its counts are the poster's there (its first, 4.081 µm, is the very radius at which a piece joins:
// at 4.08 one more piece would still be apart)
const patchR = r => { const s = FACTS.snaps.find(s => Math.round(s.r * 100) / 100 === r); return s ? s.r : r; };
// the controls a set's explore() reads: its own, with the panes' radii
function ctlArgs(k, now) {
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of allCtl(k)) c[ct.key] = isNum(k, ct) ? (k === 'map' ? X.mr : patchR(X.r)) : ctlValue(k, ct);
  return c;
}
// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
// (a slide, a cell, a window of radii)
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = ctlArgs(k, now);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the Liver scene: the body's scan alone (never the tour's network or disease scan) and the liver as chosen
  if (k === 'body') Object.assign(tg, { body_net: 0, body_state: 0, liver_a: 1, liver_lift: c.liver === 'in' ? 0 : 1, liver_slice: c.liver === 'slice' ? 0.42 : 0 });
  // the map lies on the slide's window (its explore() says how the slide shows under it)
  if (k === 'map') { tg.slide_a = 1; tg.map_pick = X.cell; }
  if (k === 'cohort') {
    tg.cohort_pick = X.slide;
    // the Scales tab shows a window of radii of your own round the column (the poster's bands dim)
    if (X.tab === 'scales' && c.view === 'scales') Object.assign(tg, { cohort_win: 1, cohort_from: X.from, cohort_to: X.to });
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  // (a radius eases on the log ruler, as in the story)
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : LOG.has(n) ? logMix(XS[n], tg[n], k) : XS[n] + (tg[n] - XS[n]) * k;
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
  if (ctlValue(k, c) !== v) sfxAct(...(key === viewKey(k) ? ['whoosh', k, null, { dur: 0.7, pitch: 1.1 }] : ['step', k, null]));   // (sound effects: a view, a control)
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === viewKey(k) && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, viewKey(k), v); }
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
// the patch's radius (1.5 to 60 µm, to the hundredth): the balls, the complex, the plane of the tower
function setR(v, ui = true) {
  const r = clamp(Math.round(+v * 100) / 100, 1.5, 60);
  if (!Number.isFinite(r) || r === X.r) return;
  // (sound effects: the radius reaching or passing one of the poster's four snapshots, a tone higher each)
  FACTS.snaps.forEach((s, k) => { const q = Math.round(s.r * 100) / 100; if (X.r !== q && Math.min(X.r, r) <= q && q <= Math.max(X.r, r)) sfxAct('step', 'tower', 'plate', { pitch: Math.pow(2, 2 * k / 12) }); });
  X.r = r;
  if (ui && X.scene !== 'tower') openScene('tower');
  syncNums();
}
// the radius of a cell's own network (1.5 to 60 µm): its edges, triangles and balls, and the level on its bars
function setMR(v, ui = true) {
  const r = clamp(Math.round(+v * 100) / 100, 1.5, 60);
  if (!Number.isFinite(r) || r === X.mr) return;
  if (Math.floor(r / 10) !== Math.floor(X.mr / 10)) sfxAct('step', 'map', 'dome', { pitch: Math.pow(2, r / 60) });   // (sound effects: each 10 µm crossed)
  X.mr = r;
  if (ui && !(X.scene === 'map' && mapShow() === 'cell')) showView('map', 'cell');
  syncNums();
}
// a window of radii (on the 0.5 µm grid of the stored shares; up to 100.5, "and above"): its share of the gap
function setFrom(v) {
  const f = clamp(Math.round(+v * 2) / 2, 0, 100);
  if (!Number.isFinite(f) || f === X.from) return;
  if (Math.floor(f / 5) !== Math.floor(X.from / 5)) sfxAct('step', 'cohort', 'ruler', { pitch: Math.pow(2, f / 100) });   // (sound effects: each 5 µm crossed)
  X.from = f; if (X.to <= f) X.to = f + 0.5;
  syncNums();
}
function setTo(v) {
  const t = clamp(Math.round(+v * 2) / 2, 0.5, 100.5);
  if (!Number.isFinite(t) || t === X.to) return;
  if (Math.floor(t / 5) !== Math.floor(X.to / 5)) sfxAct('step', 'cohort', 'ruler', { pitch: Math.pow(2, t / 100) });   // (sound effects: each 5 µm crossed)
  X.to = t; if (X.from >= t) X.from = t - 0.5;
  syncNums();
}
const setNum = (key, v, ui) => ({ r: setR, mr: setMR, from: setFrom, to: setTo }[key] || (() => {}))(v, ui);
// a slide of the cohort (-1 none): its curve lit, its numbers in the Cohort tab
function selectSlide(i, ui = true) {
  const n = api('cohort').n || 0;
  const was = X.slide;
  X.slide = Number.isInteger(i) && i >= 0 && i < n ? i : -1;
  if (X.slide >= 0 && X.slide !== was) sfxAct('clink', 'cohort', 'rack');   // (sound effects: a slide picked)
  if (ui && X.slide >= 0 && X.scene !== 'cohort') openScene('cohort');
  renderAll();
}
const stepSlide = d => { const n = api('cohort').n || 1; selectSlide(X.slide < 0 ? (d > 0 ? 0 : n - 1) : (X.slide + d + n) % n); };
// a cell of the new slide's window (-1: the poster's cell v): its dome, its own network and bars, its score
function selectCell(i, ui = true) {
  const n = api('map').n || 0;
  const was = X.cell;
  X.cell = Number.isInteger(i) && i >= 0 && i < n && i !== api('map').e ? i : -1;
  if (X.cell !== was) sfxAct('pick', 'map', 'cell');   // (sound effects: a cell picked)
  if (ui) {
    if (!(X.scene === 'map' && mapShow() === 'cell')) showView('map', 'cell');
    // (fly to it once the set shows it flat again; not if another scene or view was picked meanwhile)
    NEXT.push(() => {
      if (X.scene !== 'map' || mapShow() !== 'cell') return;
      const p = api('map').pos(X.cell >= 0 ? X.cell : api('map').e); flyNear([p[0], 0.02, p[2]], Math.min(orbit.cur[2], 0.8));
    });
  }
  renderAll();
}
// a control of a scene picked from a tab: its scene brought up
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  setCtl(k, key, v);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (the tower's view
// and what is lit, the curves' dimension and the cohort's view, the map's show and its radius of 100 or 50 µm, the
// tissue on the slide and its look), the patch's radius, a cell's network radius, the slide picked, the window of radii
// and the cell picked. The camera is each person's own.
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
  return { tab: X.tab, scene: X.scene, ctl, r: X.r, mr: X.mr, slide: X.slide, from: X.from, to: X.to, cell: X.cell };
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
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi, num = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
  if (num(v.r, 1.5, 60) && v.r !== X.r) setR(v.r, false);
  if (num(v.mr, 1.5, 60) && v.mr !== X.mr) setMR(v.mr, false);
  // (the window as one: both ends rounded onto the grid first, as the sliders do, then the first below the second; so
  // state() reports what was applied and apply(state()) changes nothing)
  const grid = x => (Number.isFinite(x) ? Math.round(x * 2) / 2 : NaN), wf = grid(v.from), wt = grid(v.to);
  if (num(wf, 0, 100) && num(wt, 0.5, 100.5) && wf < wt && (wf !== X.from || wt !== X.to)) { X.from = wf; X.to = wt; syncNums(); }
  if (int(v.slide, -1, (api('cohort').n || 1) - 1) && v.slide !== X.slide) selectSlide(v.slide, false);
  if (int(v.cell, -1, (api('map').n || 1) - 1) && v.cell !== X.cell) selectCell(v.cell, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// a slider the panes hold (a radius, an end of the window), with its value; it changes in place, so a drag is not cut
// short by a redraw. A radius slides on the poster's log ruler (0 to 1000 along it)
const NUM = { r: { label: 'Radius', log: true, min: 1.5, max: 60, col: CYAN, text: v => `${fmtR2(v)} µm` },
  mr: { label: 'Its network at', log: true, min: 1.5, max: 60, col: CYAN, text: v => `${fmtR2(v)} µm` },
  from: { label: 'From', min: 0, max: 100, step: 0.5, col: CYAN, text: v => `${v} µm` },
  to: { label: 'To', min: 0.5, max: 100.5, step: 0.5, col: CYAN, text: v => (v > 100 ? 'and above' : `${v} µm`) } };
const sOf = (o, v) => (o.log ? Math.round(1000 * T.u(v)) : v), vOf = (o, s) => (o.log ? T.rOf(s / 1000) : s);
const slider = key => { const o = NUM[key], v = numOf(key);
  return `<p class="grp-h">${o.label} <b data-numv="${key}" style="margin-left:auto;color:var(--ink)">${esc(o.text(v))}</b></p>
    <input type="range" data-num="${key}" min="${o.log ? 0 : o.min}" max="${o.log ? 1000 : o.max}" step="${o.log ? 1 : o.step}" value="${sOf(o, v)}" aria-label="${o.label}" style="accent-color:${o.col}">`; };
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
      r: () => setR(+v), slide: () => (v === 'none' ? selectSlide(-1) : stepSlide(+v)), cell: () => selectCell(-1),
      cam: () => { if (X.scene !== 'tower') openScene('tower'); flyTo(view('tower', v)); },
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const k = ev.target.dataset.num;
    if (NUM[k]) setNum(k, vOf(NUM[k], +ev.target.value), true);
  });
  renderAll();
  // (the cells' own bars arrive a frame or two after load: their numbers then)
  TDATA.ready.then(() => { if (APP.mode === 'explore') syncNums(); });
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
  if (k === 'patch' && X.scene !== 'tower') openScene('tower');
  if (k === 'cohort') { if (X.scene !== 'cohort') openScene('cohort'); if (cohortView() === 'scales') setCtl('cohort', 'view', 'held'); }
  if (k === 'scales') showView('cohort', 'scales');
  if (k === 'cells' && X.scene !== 'map') openScene('map');
  renderAll();
}
function renderAll() { renderPatch(); renderCohort(); renderScales(); renderCells(); renderScenes(); updateExtraLabels(); }
// the numbers that follow a slider, redrawn in place (the sliders themselves keep still while dragged)
function syncNums() {
  for (const k in NUM) {
    document.querySelectorAll(`[data-numv="${k}"]`).forEach(el => { el.textContent = NUM[k].text(numOf(k)); });
    document.querySelectorAll(`input[data-num="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = sOf(NUM[k], numOf(k)); });
  }
  const live = { patch: patchLive, scales: scalesLive, cells: cellsLive };
  for (const k in live) document.querySelectorAll(`[data-live="${k}"]`).forEach(el => { el.innerHTML = live[k](); });
}
const oddsTxt = s => { const o = Math.exp(s); return o >= 10 ? fmt(o) : o.toFixed(2); };
const winTxt = (r0, r1) => (r1 > 100 ? `${r0} µm and above` : `${r0}–${r1} µm`);

// the patch at its radius, in words: the counts of the stored bars alive there (both panels)
function patchInfo() {
  const r = patchR(X.r), c = api('tower').counts ? api('tower').counts(r) : { pieces: 0, loops: 0 }, [lb, ld] = FACTS.loop;
  const big = r < lb ? 'the big one not yet closed' : r < ld ? 'the big one among them' : 'the big one has filled';
  return [['Radius', `${fmtR2(X.r)} µm`], ['Pieces', fmt(c.pieces), c.pieces === 1 ? 'all joined into one' : ''], ['Loops', fmt(c.loops), big]];
}
const patchLive = () => statsHtml(patchInfo());
const SNAP_CHIPS = () => FACTS.snaps.map(s => [s.r, `${fmtR2(s.r)} µm`]).concat([[60, '60 µm']]);
const LOOKS = [['default', 'The whole tower'], ['stand', 'Stand at it'], ['up', 'Up through it']];
function renderPatch() {
  const pane = $('#pane-patch');
  if (!pane) return;
  const on = X.scene === 'tower', v = towerView(), lit = ctlValue('tower', ctlOf('tower', 'lit'));
  pane.innerHTML = `<p class="sub">The poster's patch: ${FACTS.patch} real cells of a healthy liver. Grow the balls and watch pieces join and loops open and close; raise the tower to see every radius at once.</p>
    ${slider('r')}
    <div class="chips">${SNAP_CHIPS().map(([r, n]) => chip(`data-act="r" data-v="${r}"`, esc(n), Math.abs(X.r - r) < 0.006)).join('')}</div>
    <div data-live="patch">${patchLive()}</div>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('tower', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="tower:${o}"`, esc(n), on && v === o)).join('')}</div>
    <p class="grp-h">Lit</p><div class="chips">${ctlOf('tower', 'lit').options.map(([o, n]) => chip(`data-act="ctl" data-scene="tower" data-ctl="lit" data-v="${o}"`, esc(n), lit === o, o === 'pieces' ? AMBER : o === 'loops' ? ORANGE : null)).join('')}</div>
    <p class="grp-h">Look</p><div class="chips">${LOOKS.map(([c, n]) => chip(`data-act="cam" data-v="${c}"`, n, false)).join('')}</div>
    <p class="note">${esc(NOTE.patch)}</p>`;
}

// the cohort and a slide picked, in words (both panels)
function cohortInfo() {
  const dim = cohortDim(), A = api('cohort'), fv = A.fve ? A.fve(dim) : [0, 0, 0], cf = A.confusion ? A.confusion(dim) : [0, 0, 0, 0];
  const what = dim ? 'loops' : 'pieces';
  const rows = [['Shapes', `${pct(fv[0])}, ${pct(fv[1])}, ${pct(fv[2])}`, `of the variation in ${what}`],
    ['Held out', `${cf[0] + cf[3]} of ${cf.reduce((s, x) => s + x, 0)} right`, `accuracy ${(A.accuracy ? A.accuracy(dim) : 0).toFixed(3)}`],
    ['Healthy', `${cf[0]} of ${cf[0] + cf[1]} right`], ['Cirrhosis', `${cf[3]} of ${cf[2] + cf[3]} right`]];
  const s = X.slide >= 0 && A.slide ? A.slide(X.slide, dim) : null;
  return { rows, pick: s ? { head: `Slide ${s.number} · ${s.cls}`, rows: [['Scores', s.scores.map(v => f2(v)).join(', '), 'shapes 1 to 4'],
    ['Log-odds', f2s(s.logOdds), s.logOdds > 0 ? 'cirrhosis more likely' : 'healthy more likely'],
    ['Held out', s.right ? 'right' : `called ${s.held ? 'cirrhosis' : 'healthy'}`, 'by a model that never saw it']] } : null };
}
const COHORT_VIEWS = () => ctlOf('cohort', 'view').options.filter(o => o[0] !== 'scales');
function renderCohort() {
  const pane = $('#pane-cohort');
  if (!pane) return;
  const on = X.scene === 'cohort', v = cohortView(), dim = ctlValue('cohort', ctlOf('cohort', 'dim')), I = cohortInfo();
  pane.innerHTML = `<p class="sub">The ${FACTS.slides} slides, ${FACTS.healthy} healthy and ${FACTS.cirrhosis} with cirrhosis: each as its curve, then as a point by its scores, then by its held-out result. Click a slide (or point at it and pull the trigger) to pick it.</p>
    <p class="grp-h">Curves of</p><div class="chips">${DIMS.map(([o, n]) => chip(`data-act="ctl" data-scene="cohort" data-ctl="dim" data-v="${o}"`, n, dim === o, o === '1' ? ORANGE : AMBER)).join('')}</div>
    <p class="grp-h">Show</p><div class="chips">${COHORT_VIEWS().map(([o, n]) => chip(`data-act="view" data-v="cohort:${o}"`, esc(n), on && v === o)).join('')}</div>
    ${statsHtml(I.rows)}
    <p class="grp-h">Slide</p><div class="chips">${chip('data-act="slide" data-v="-1"', '‹ Previous', false)}${chip('data-act="slide" data-v="1"', 'Next ›', false)}${chip('data-act="slide" data-v="none"', 'None', X.slide < 0)}</div>
    ${I.pick ? `<h3>${esc(I.pick.head)}</h3>${statsHtml(I.pick.rows)}` : '<p class="sub">No slide picked: the classes as a whole.</p>'}
    <p class="note">${esc(NOTE.cohort)}</p>`;
}

// the windows of radii and your own, looked up (both panels)
function scalesInfo() {
  const dim = cohortDim(), A = api('cohort'), w = A.window ? A.window(X.from, X.to > 100 ? Infinity : X.to, dim) : { share: 0 }, g = A.gap ? A.gap(dim) : { gap: 0 };
  const rows = [['Your window', winTxt(X.from, X.to)], ['Adds', f2s(w.share), `odds × ${oddsTxt(w.share)}`]];
  const ws = (A.windows ? A.windows(dim) : []).map(x => [winTxt(x.r0, x.r1 === Infinity ? 101 : x.r1), f2s(x.share), x.poster ? 'the poster\'s' : '']);
  return { rows, ws: ws.concat([['The gap', f2s(g.gap), `odds × ${oddsTxt(g.gap)}`]]) };
}
const scalesLive = () => { const I = scalesInfo(); return `${statsHtml(I.rows)}<p class="grp-h">What each stretch adds</p>${statsHtml(I.ws)}`; };
function renderScales() {
  const pane = $('#pane-scales');
  if (!pane) return;
  const dim = ctlValue('cohort', ctlOf('cohort', 'dim'));
  pane.innerHTML = `<p class="sub">The classifier read back as a weight for every radius (red speaks for cirrhosis), and what each stretch of radii adds to the gap between the two groups' average log-odds. Choose a window of radii of your own.</p>
    <p class="grp-h">Curves of</p><div class="chips">${DIMS.map(([o, n]) => chip(`data-act="ctl" data-scene="cohort" data-ctl="dim" data-v="${o}"`, n, dim === o, o === '1' ? ORANGE : AMBER)).join('')}</div>
    ${slider('from')}${slider('to')}
    <div data-live="scales">${scalesLive()}</div>
    <p class="note">${esc(NOTE.scales)}</p>`;
}

// a cell of the new slide in words: its type, its score, its neighbourhood and its own bars (both panels)
function cellsInfo() {
  const A = api('map'), i = X.cell >= 0 ? X.cell : A.e, c = A.cell ? A.cell(i) : null, d = mapDelta();
  if (!c) return { head: '', rows: [], piles: [] };
  const lo = d === 100 ? c.lo100 : c.lo50, cnt = A.counts ? A.counts(i, X.mr) : null;
  const rows = [['Type', c.type, 'the cell classifier\'s label'], ['Score', Number.isFinite(lo) ? f2s(lo) : 'none', Number.isFinite(lo) ? `${d === 100 ? c.group100 : c.group50} · within ${d} µm` : 'no curve of its own'],
    // (the neighbourhood drawn, its network and its own bars are the 50 µm ones, whichever radius the map is at)
    ['Drawn round it', `${fmt(c.near)} cells`, `within ${A.delta} µm, itself included`],
    ['Its bars', c.h0 ? `${plural(c.h0.length + 1, 'piece', 'pieces')}, ${plural(c.h1.length / 2, 'loop', 'loops')}` : 'unpacking…', `of those ${A.delta} µm`],
    [`At ${fmtR2(X.mr)} µm`, cnt ? `${plural(cnt.pieces, 'piece', 'pieces')}, ${plural(cnt.loops, 'loop', 'loops')}` : '…', 'still alive']];
  const C = d === 100 ? A.comp100 : A.comp50;
  const piles = C ? C.types.map((t, k) => [t, `${pct(C.cirrhosis[k])} · ${pct(C.healthy[k])}`, 'cirrhosis-like · healthy-like']) : [];
  return { head: i === A.e ? 'Cell v · the poster\'s' : `Cell ${fmt(i + 1)}`, rows, piles, sizes: C ? C.sizes : [0, 0] };
}
const cellsLive = () => {
  const I = cellsInfo(), s = mapShow();
  if (s === 'cell') return `<h3>${esc(I.head)}</h3>${statsHtml(I.rows)}`;
  return `<p class="sub">${fmt(I.sizes[1])} cirrhosis-like and ${fmt(I.sizes[0])} healthy-like cells, at ${mapDelta()} µm.</p><p class="grp-h">Cell types (the classifier's labels)</p>${statsHtml(I.piles)}`;
};
function renderCells() {
  const pane = $('#pane-cells');
  if (!pane) return;
  const on = X.scene === 'map', s = mapShow(), d = ctlValue('map', ctlOf('map', 'delta'));
  pane.innerHTML = `<p class="sub">The new slide: a window of ${fmt(FACTS.window)} real cells, each scored by a classifier fitted on the other ${FACTS.train} slides. Click a cell (or point at it and pull the trigger) to see its neighbourhood, its own network and bars, and its score.</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('map', 'show').options.map(([o, n]) => chip(`data-act="view" data-v="map:${o}"`, esc(n), on && s === o)).join('')}</div>
    <p class="grp-h">Map at</p><div class="chips">${ctlOf('map', 'delta').options.map(([o, n]) => chip(`data-act="ctl" data-scene="map" data-ctl="delta" data-v="${o}"`, esc(n), d === o)).join('')}</div>
    ${s === 'cell' ? `${slider('mr')}<div class="chips">${chip('data-act="cell"', 'Cell v', X.cell < 0)}</div>` : ''}
    <div data-live="cells">${cellsLive()}</div>
    <p class="note">${esc(NOTE.cells(s))}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${Object.keys(NUM).filter(key => numShown(X.scene, key)).map(slider).join('')}
    <p class="grp-h">About</p><p class="credits">${esc(ABOUT)}</p>`;
}
// labels the panes add (none: the sets label their own picks, the cohort its slide, the map its cell)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { slide } (of the cohort),
// { cell } (of the new slide's window), { tcell }, { loop } or { bar, dim } (of the patch), or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !['tower', 'cohort', 'map'].includes(X.scene)) return null;
  const A = api(X.scene);
  let r = null;
  try { r = A.pick ? A.pick(rc) : null; } catch (e) { return null; }
  if (!r) return null;
  if (r.kind === 'slide') return { slide: r.i };
  if (r.kind === 'cell' && X.scene === 'map') return { cell: r.cell };
  if (r.kind === 'cell') return { tcell: r.i };
  if (r.kind === 'loop') return { loop: r.k };
  if (r.kind === 'bar') return { bar: r.i, dim: r.dim };
  return null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (p.slide !== undefined && api('cohort').mid) return api('cohort').mid(p.slide);
  if (p.cell !== undefined && api('map').pos) return api('map').pos(p.cell);
  return null;
}
const loopText = L => (L ? [L.main ? 'The big loop' : 'A loop', `alive from ${fmtR(L.b)} to ${fmtR(L.d)} µm`] : ['', '']);
function pickText(p) {
  if (p.slide !== undefined) { const s = api('cohort').slide(p.slide, cohortDim()); return s ? [`Slide ${s.number}`, `${s.cls} · held out: ${s.right ? 'right' : 'wrong'}`] : ['', '']; }
  if (p.cell !== undefined) {
    const A = api('map'), c = A.cell(p.cell), lo = mapDelta() === 100 ? c.lo100 : c.lo50;
    return [p.cell === A.e ? 'Cell v' : `Cell ${fmt(p.cell + 1)}`, `${c.type} · ${Number.isFinite(lo) ? `score ${f2s(lo)}` : 'no score'}`];
  }
  if (p.tcell !== undefined) { const q = api('tower').piece(p.tcell, patchR(X.r)); return ['A cell', `in a piece of ${plural(q.cells, 'cell', 'cells')} at ${fmtR(X.r)} µm`]; }
  if (p.loop !== undefined) return loopText(api('tower').loop(p.loop));
  if (p.bar !== undefined) {
    if (p.dim) return loopText(api('tower').loop(p.bar));
    const B = api('tower').bar(0, p.bar);
    return ['A piece', B.d === Infinity ? 'lives on: the trunk' : `joins another at ${fmtR(B.d)} µm`];
  }
  return ['', ''];
}
// a click (or the trigger) on a slide picks it (again: none); on a cell, its dome; on a loop or its bar, the radius
// goes to the middle of its life on the ruler; on a piece's bar, to just before it joins another
function choosePick(p) {
  if (!p) return;
  if (p.slide !== undefined) { if (X.tab !== 'cohort' && X.tab !== 'scales') showTab('cohort'); selectSlide(p.slide === X.slide ? -1 : p.slide, false); }
  else if (p.cell !== undefined) { if (X.tab !== 'cells') showTab('cells'); selectCell(p.cell === X.cell ? -1 : p.cell, true); }
  else if (p.loop !== undefined || (p.bar !== undefined && p.dim)) {
    const L = api('tower').loop(p.loop !== undefined ? p.loop : p.bar);
    if (L) { if (X.tab !== 'patch') showTab('patch'); setR(Math.sqrt(L.b * Math.min(L.d, 60)), false); renderAll(); }
  } else if (p.bar !== undefined) {
    const B = api('tower').bar(0, p.bar);
    if (B) { if (X.tab !== 'patch') showTab('patch'); setR(B.d === Infinity ? 60 : B.d * 0.97, false); renderAll(); }
  }
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

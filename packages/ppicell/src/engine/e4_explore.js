// ================================================================ EXPLORE ==
// Explore mode: each scene (a set) with its own controls (the set's controls, as buttons), in one tab. A story adds
// tabs of its own: an entry in TABS, a pane (render<Tab> here and draw<Tab>Pane in e6_panels.js, kept in step), and
// what it picks in X and in the shared state (collabState, collabApply).
const SCENES = [
  ['cell', 'Cell', 'The interactome of Menche and colleagues (2015) in the cell map\'s model cell, each protein where the Human Protein Atlas finds it. A link can happen only where its two proteins share a space.'],
];
const SCENE_SHORT = {};
const TABS = [['scenes', 'Cell'], ['pick', 'Pick']];
//#use ctlsOf ctlShown~2
// pp: the protein picked (PDATA's number; -1 none), pc: the place picked (0 to 12; -1 none): one at a time
const X = { tab: 'scenes', scene: SET_ORDER[0], ctl: {}, t0: 0, turn: 'on', pp: -1, pc: -1 };
//#use XS
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['cell_show', 'cell_faces', 'cell_kind', 'cell_pp', 'cell_pc']);
//#use orbit ctlValue ctlOf
// a view option's camera: the cam view of the same name, or the one it stands for ({ set: { option: view } })
const CAM_ALIAS = {};
//#use camFor viewCam viewIs~2
// what the sets know (their api())
const API = {};
//#use api NEXT

// what the chosen scene and its controls ask for: that set fully in, every other set out
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  if (k === 'cell') Object.assign(tg, { cell_pp: X.pp, cell_pc: X.pc });
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
//#use exploreStep pushState openScene setCtl
// (sound effects: a control changed)
function ctlSound(k, key, v) {
  if (key === 'view') sfxAct('whoosh', k, null, { dur: 0.7, pitch: 1.1 }); else sfxAct('step', k, null);
}
//#use showView flyTo orbitStep flyNear sceneCtl
// a pick: a protein (pp) or a place (pc), the other let go; the same again lets go (ui: picked here, with a sound)
function setPick(pp, pc, ui) {
  if (ui && pp === X.pp && pc === X.pc) pp = pc = -1;
  X.pp = pp; X.pc = pc;
  if (ui && (pp >= 0 || pc >= 0)) sfxAct('clink', 'cell', 'centre');
  pushState(); renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls. The camera is
// each person's own. v: the shape of this state (FORMAT is the app's: a package that changes its state's shape bumps
// v, and apply ignores a state of another v, from an older copy on another device).
const COLLAB_V = 1;
//#use collabView collabSetView
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl, p: X.pp, place: X.pc };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and the
// camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object' || v.v !== COLLAB_V) return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  const okP = x => Number.isInteger(x) && x >= -1 && x < PDATA.N, okC = x => Number.isInteger(x) && x >= -1 && x < 13;
  if (okP(v.p) && okC(v.place) && (v.p !== X.pp || v.place !== X.pc)) { X.pp = v.p; X.pc = v.place; }
  renderAll();
}

//#use chip cap
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler for the panes: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      scene: () => openScene(v),
      ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
      place: () => setPick(-1, +v, true),
      clear: () => setPick(-1, -1, false),
    }[b.dataset.act] || (() => {}))();
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
  });
  showTab(X.tab);
}
//#use setTurn showTab
// a tab picked by hand (a shared room's tab arriving does not come here: its scene comes with it)
function pickTab(k) { showTab(k); }
function renderAll() { renderScenes(); renderPick(); updateExtraLabels(); }
// the pick's own words: what is picked and what it shows (the twin of drawPickPane)
function pickLine() {
  const f = api('cell').focus && api('cell').focus();
  if (!f) return 'Nothing picked: the background shows the most important links of the kinds on show.';
  if (f.kind === 'protein') {
    if (f.none) return `${f.sym} has no place in the Atlas: its ${many(f.links, 'link')}${kindWords()} ${f.links === 1 ? 'is' : 'are'} drawn grey, from its dot outside the cell.`;
    const [g, a, r, n] = f.t, pl = f.places.map(x => `${x.name}${x.main ? ' (main)' : ''}, ${x.face}`);
    return `${f.sym}: ${pl.join('; ')}. ${many(f.links, 'link')}${kindWords()} to ${many(f.partners, 'partner')}: ${fmt(g)} possible, ${fmt(a)} through a gate (amber), ${fmt(r)} impossible (red)${n ? `; ${fmt(n)} not judged (grey: ${fmt(f.why[0])} not contacts, ${fmt(f.why[1])} to a protein without a place)${GL.sets.cell.stats().show >= 3 ? '' : ', not drawn'}` : ''}.${f.drawn < f.links && f.drawn >= 2000 ? ` The first ${fmt(f.drawn)} drawn.` : ''}`;
  }
  return `${f.name}: ${fmt(f.here)} proteins listed here. ${f.shown < f.inner ? `The top ${fmt(f.shown)} of its ${fmt(f.inner)} possible links${kindWords()} inside it, the most kinds of evidence first` : `All ${fmt(f.inner)} possible links${kindWords()} inside it`}.`;
}
// '1 link', '3 links'
const many = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
// a protein's links by kind of evidence (a link can have several kinds): the second line of the pick
function kindsLine() {
  const f = api('cell').focus && api('cell').focus();
  if (!f || f.kind !== 'protein') return '';
  const names = api('cell').kinds, parts = f.ev.map((n, k) => (n ? `${names[k].toLowerCase()} ${fmt(n)}` : '')).filter(x => x);
  return `Its ${fmt(f.all)} links by kind of evidence (a link can have several): ${parts.join(', ')}.`;
}
// ' with binary evidence' while a kind is chosen, else ''
function kindWords() {
  const k = GL.sets.cell && GL.sets.cell.stats().kind;
  return k >= 0 ? ` with ${api('cell').kinds[k].toLowerCase()} evidence` : '';
}
// a protein typed by its symbol (the page only): Enter picks it
function findProtein(s) {
  const p = api('cell').find(s), msg = $('#pickMsg');
  if (p >= 0) { if (msg) msg.textContent = ''; if (p !== X.pp) { setPick(p, -1, false); sfxAct('clink', 'cell', 'centre'); } }
  else if (msg) msg.textContent = String(s || '').trim() ? `No protein ${String(s).trim()} in this interactome.` : '';
}
function renderPick() {
  const pane = $('#pane-pick');
  if (!pane) return;
  // (the box is built once, so a re-render while typing keeps what is typed)
  if (!$('#pickBody')) {
    pane.innerHTML = `<p class="sub">Click a dot (in a headset: point and press) to pick a protein and see all its links, or pick a place. The same again lets go.</p>
      <form class="grp" id="pickFind" autocomplete="off"><label for="pickSym">Protein</label> <input id="pickSym" type="text" placeholder="a symbol, such as TP53" size="16" spellcheck="false"> <span class="sub" id="pickMsg"></span></form>
      <div id="pickBody"></div>`;
    $('#pickFind').addEventListener('submit', ev => { ev.preventDefault(); findProtein($('#pickSym').value); });
  }
  const names = api('cell').places || [];
  $('#pickBody').innerHTML = `<div class="chips">${names.map((n, k) => chip(`data-act="place" data-v="${k}"`, esc(n), X.pc === k)).join('')}</div>
    <p class="sub">${esc(pickLine())}</p>${kindsLine() ? `<p class="sub">${esc(kindsLine())}</p>` : ''}
    ${X.pp >= 0 || X.pc >= 0 ? `<div class="chips">${chip('data-act="clear" data-v="1"', 'Clear', false)}</div>` : ''}`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `${SCENES.length > 1 ? `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>` : ''}
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p><p class="sub">${esc(statsLine())}</p><p class="sub">${esc(readingLine())}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}`;
}
// what is drawn now and the judgement's counts for the reading and kind on show (computed by the set from PDATA)
function statsLine() {
  const s = GL.sets.cell && GL.sets.cell.stats();
  if (!s || !s.L) return '';
  const [g, a, r] = s.tally, j = g + a + r, pct = j ? (100 * r / j).toFixed(1) : '0';
  return `${fmt(s.nMain)} dots: ${fmt(s.nOwn)} at the places the Atlas lists${s.nOut ? `, ${fmt(s.nOut)} proteins without a place outside the cell` : ''} and ${fmt(s.nMain - s.nOwn - s.nOut)} where they meet others. Of the ${fmt(j + s.notC + s.unpl)} links${kindWords()}, ${fmt(j)} are judged: ${fmt(g)} possible, ${fmt(a)} through a gate and ${fmt(r)} impossible (${pct} %). Counted apart: ${fmt(s.notC)} not contacts (regulatory or metabolic only) and ${fmt(s.unpl)} with an end without a place. ${fmt(s.drawn)} drawn, the most kinds of evidence first. Built in ${s.ms} ms.`;
}
// the reading on show, in words: the twin of statsLine, in both panes
function readingLine() {
  const s = GL.sets.cell && GL.sets.cell.stats();
  if (!s || !s.L) return '';
  return s.g ? 'Generous reading: an organelle\'s protein may also sit on its membrane, facing the cytosol; the plasma membrane\'s face outside too, the nuclear envelope\'s the cytosol. The Atlas does not say which.'
    : 'Strict reading: an organelle\'s protein is inside it; the plasma membrane\'s face the cytosol, the nuclear envelope\'s the nucleoplasm. The Atlas does not say which side a protein is on.';
}
//#use updateExtraLabels

//#use _rc
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show, or null: nothing to pick here
// (a set that has things to pick says so through its api(): see the example package, packages/hello)
function pickWith(rc) {
  if (APP.mode !== 'explore' || !api('cell').pick) return null;
  const c = api('cell').pick(rc);
  return c >= 0 ? { copy: c } : null;
}
//#use pickAt
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) { const c = p && api('cell').copy(p.copy); return c ? c.pos : null; }
// a pick's tip: [bold, rest]
const pickText = p => { const c = api('cell').copy(p.copy); return c ? [c.sym, `${c.place < 13 ? api('cell').places[c.place] + ', ' : ''}${c.face} · ${fmt(c.deg)} links`] : ['', '']; };
// a pick clicked or pressed
function choosePick(p) { const c = p && api('cell').copy(p.copy); if (c) { setPick(c.prot, -1, true); if (X.tab !== 'pick') showTab('pick'); } }
//#use bindCanvas

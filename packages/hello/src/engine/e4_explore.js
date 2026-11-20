// ================================================================ EXPLORE ==
// Explore mode, one tab: rewire the ring (the ring set's own control, as chips), pick two people (on the ring, or the
// pair across it) and see the shortest chain of handshakes between them, with the network's numbers, computed as you
// choose (HELLO).
const SCENES = [
  ['ring', 'Ring', 'Sixty people, each knowing their four nearest; rewire some of the friendships at random.'],
];
const SCENE_SHORT = {};
const TABS = [['network', 'Network']];
//#use ctlsOf ctlShown~2
// a, b: the two people picked (by number, 0 to 59; null none); pickT: when the last was picked (the chain is drawn
// from then)
const X = { tab: 'network', scene: 'ring', ctl: { ring: { rw: '0.05' } }, t0: 0, turn: 'on', a: A0, b: B0, pickT: 0 };
//#use XS
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['path_from', 'path_to']);
//#use orbit ctlValue ctlOf
// a view option's camera: the cam view of the same name
const CAM_ALIAS = {};
//#use camFor viewCam viewIs~2
// what the sets know (their api()): the ring's picking
const API = {};
//#use api NEXT
const isPerson = i => Number.isInteger(i) && i >= 0 && i < HELLO.N;
// the network the chips ask for: its probability and numbers, and the chain from A to B
const rwP = () => Math.max(0, Math.min(1, +ctlValue('ring', ctlOf('ring', 'rw')) || 0));
const netNow = () => { const p = rwP(), s = HELLO.stats(p), path = isPerson(X.a) && isPerson(X.b) && X.a !== X.b ? HELLO.path(p, X.a, X.b) : null; return { p, s, path }; };

// what the scene and the picks ask for: the ring with the chips' rewiring, and over it the chain from A to B, drawn
// hop by hop from the moment it was picked
function exploreTargets(t = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (t - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  Object.assign(tg, { path_a: isPerson(X.a) ? 1 : 0, path_from: isPerson(X.a) ? X.a : -1, path_to: isPerson(X.b) ? X.b : -1, path_show: clamp((t - X.pickT) / 1500, 0, 1) });
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
//#use exploreStep pushState openScene setCtl
// (sound effects: a control changed: the links move, or the view)
function ctlSound(k, key, v) {
  if (key === 'rw') sfxAct('snap', 'ring', 'centre', { pitch: 0.8 + 0.4 * Math.sqrt(+v || 0) }); else sfxAct('whoosh', k, null, { dur: 0.7, pitch: 1.1 });
}
//#use showView flyTo orbitStep flyNear sceneCtl
// --------------------------------------------------------------- actions --
// the two people: a and b (null none). Picked by hand (ui true) the chain is drawn again from A; a shared room's pair
// arriving (ui false) shows at once.
function setPair(a, b, ui = true) {
  a = isPerson(a) ? a : null; b = isPerson(b) && b !== a ? b : null;
  if (a === X.a && b === X.b) return;
  X.a = a; X.b = b;
  X.pickT = ui ? performance.now() : 0;
  if (ui && a !== null) sfxAct('clink', 'ring', 'centre', { pitch: b === null ? 1 : 1.25 });   // (sound effects: a person picked)
  renderAll();
}
// a person picked on the ring: the first is A, the next B; a third starts again from A; picking A or B again lets go
function pickPerson(i) {
  if (!isPerson(i)) return;
  if (i === X.a) setPair(X.b, null);
  else if (i === X.b) setPair(X.a, null);
  else if (X.a === null || X.b !== null) setPair(i, null);
  else setPair(X.a, i);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene, the ring's controls (its rewiring and
// view) and the two people. The camera is each person's own. v: the shape of this state (a package changes it only
// together with v, which apply checks).
const COLLAB_V = 1;
//#use collabView collabSetView
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl, a: X.a, b: X.b };
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
  if ((v.a === null || isPerson(v.a)) && (v.b === null || isPerson(v.b))) setPair(v.a, v.b, false);
  renderAll();
}

//#use chip cap
const who = i => (isPerson(i) ? `person ${i + 1}` : 'none');
// the network's numbers, as rows [name, value, more] for both panes
function statRows() {
  const { s, path } = netNow();
  return [['Handshakes', f1(s.avg), 'between two people, on average'], ['At most', String(s.most), 'the longest way between two'],
    ['Friends\' friends', pct(s.clust), 'who know each other'], ['Shortcuts', String(s.rewired), `of ${s.links} friendships moved`],
    ['A to B', path ? String(path.length - 1) : isPerson(X.a) && isPerson(X.b) ? 'no chain' : '–', path ? 'handshakes' : 'pick two people']]
    .concat(s.apart ? [['Apart', String(s.apart), 'pairs no chain links']] : []);
}
const NOTE = 'An example network of 60 people, made and measured here. After Watts and Strogatz (Nature, 1998).';
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
      across: () => setPair(A0, B0), clear: () => setPair(null, null),
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
// a tab picked by hand
function pickTab(k) { showTab(k); }
function renderAll() { renderNetwork(); updateExtraLabels(); }
function renderNetwork() {
  const pane = $('#pane-network');
  if (!pane) return;
  const ch = c => c.options.map(([v, n]) => chip(`data-act="ctl" data-scene="ring" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue('ring', c) === v)).join('');
  pane.innerHTML = `<p class="sub">Rewire some of the friendships at random, and pick two people on the ring to see the shortest chain of handshakes between them. Every number is computed as you choose.</p>
    <p class="grp-h">Rewired links</p><div class="chips">${ch(ctlOf('ring', 'rw'))}</div>
    <p class="grp-h">Two people (click them on the ring)</p>
    <div class="chips">${chip('disabled', 'A: ' + who(X.a), false, CYAN)}${chip('disabled', 'B: ' + who(X.b), false, AMBER)}</div>
    <div class="chips">${chip('data-act="across"', 'Across the ring', X.a === A0 && X.b === B0)}${chip('data-act="clear"', 'Clear', false)}</div>
    <dl class="stats">${statRows().map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}<small>${esc(more)}</small></dd>`).join('')}</dl>
    <p class="grp-h">View</p><div class="chips">${ch(ctlOf('ring', 'view'))}</div>
    <p class="note">${esc(NOTE)}</p>`;
}
//#use updateExtraLabels

//#use _rc
// what a ray (a THREE.Raycaster in world coordinates) points at: { person } on the ring, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'ring') return null;
  const i = api('ring').pick ? api('ring').pick(rc) : -1;
  return isPerson(i) ? { person: i } : null;
}
//#use pickAt
// where a pick is, in its set's own frame (for the headset's ray and tip)
function pickPos(p) { return p && isPerson(p.person) ? HELLO.pos(p.person) : null; }
const pickText = p => {
  const i = p.person, g = HELLO.graph(rwP()), d = g.adj[i].length;
  return [`Person ${i + 1}`, `${d} friends${i === X.a ? ' · A' : i === X.b ? ' · B' : ''}`];
};
function choosePick(p) { if (p) pickPerson(p.person); }
//#use bindCanvas

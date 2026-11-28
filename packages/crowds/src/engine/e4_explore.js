// ================================================================ EXPLORE ==
// Explore mode: one scene, the crowd, with two tabs: the balls (how many, what, how drawn and shaded) and the culling
// (four switches, and holding the culling's eyes still to walk out and look). Both show the read-out: what is built,
// what is drawn and what a frame costs (computed each half second from the set's stats()).
const SCENES = [
  ['crowds', 'Crowd', 'Balls standing for proteins\' parts, drawn as impostors (one point each, shaded as a sphere) or as small meshes, and four ways of leaving out what you cannot see. Frame rate in a headset: press B or Y twice.'],
];
const SCENE_SHORT = {};
const TABS = [['scenes', 'Balls'], ['cull', 'Culling']];
//#use ctlsOf ctlShown~2
const X = { tab: 'scenes', scene: SET_ORDER[0], ctl: {}, t0: 0, turn: 'on' };
//#use XS
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['crowds_n', 'crowds_size', 'crowds_draw', 'crowds_what', 'crowds_shade', 'crowds_ao', 'crowds_col', 'crowds_grid', 'crowds_lod', 'crowds_order', 'crowds_hide']);
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
// Hold the culling: this device's own (its eyes, not the room's), so never in the shared state
function setHold(on) {
  api('crowds').hold(on);
  sfxAct('step', 'crowds', null);
  renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every control (how many balls, what,
// how drawn and shaded, the four culling switches, the view). The camera, Hold and the read-out are each person's own.
// v: the shape of this state (FORMAT is the app's: a package that changes its state's shape bumps v, and apply ignores
// a state of another v, from an older copy on another device).
const COLLAB_V = 1;
//#use collabView collabSetView
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl };
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
      hold: () => setHold(v === '1'),
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
function renderAll() { renderScenes(); renderCull(); updateExtraLabels(); }
// the controls of one tab ('cull' or the rest), as rows of chips
const ctlRows = tab => ctlsOf(X.scene).filter(c => ctlShown(X.scene, c) && (c.tab === 'cull') === (tab === 'cull'))
  .map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('');
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<p class="sub">${esc(sc[2])}</p><p class="sub crowds-read">${esc(readLine())}</p><p class="sub">${esc(whatLine())}</p>${ctlRows('scenes')}`;
}
function renderCull() {
  const pane = $('#pane-cull');
  if (!pane) return;
  const held = api('crowds').held && api('crowds').held();
  pane.innerHTML = `<p class="sub">${esc(CULL_INTRO)}</p>
    <p class="sub crowds-read">${esc(readLine())}</p><p class="sub crowds-cull">${esc(cullLine())}</p>${ctlRows('cull')}
    <p class="grp-h">Hold the culling</p><div class="chips">${chip('data-act="hold" data-v="1"', 'Hold here', held)}${chip('data-act="hold" data-v="0"', 'Follow me', !held)}</div>
    <p class="sub">Held, the cells are judged from where you were: walk or turn away and see what is left out. Yours alone.</p>`;
}
// the Culling tab's first lines (both panes)
const CULL_INTRO = 'The balls are sorted into a grid of cells; a draw is a run of neighbouring cells. Each switch leaves out what you would not see, or draws it more cheaply.';
// ------------------------------------------------------------ the read-out (both panes, page and headset)
const big = v => (v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : v >= 1e4 ? Math.round(v / 1000) + 'k' : fmt(Math.round(v)));
const cst = () => (GL.sets.crowds ? GL.sets.crowds.stats() : null);
// what is drawn and what a frame costs (computed each half second)
function readLine() {
  const s = cst();
  if (!s || !s.n) return s && s.building ? `Building ${fmt(s.building)} balls…` : 'Building the crowd…';
  const pct = s.n ? Math.round(100 * s.drawn / s.n) : 0, mesh = s.mode === 1;
  const fr = s.fps ? `${Math.round(s.fps)} frames a second (${s.mean.toFixed(1)} ms, worst ${s.worst.toFixed(0)} ms)` : 'frame rate not yet measured';
  const eyes = s.noEyes ? 'The headset\'s eyes are not known to the story: nothing is culled. ' : '';
  return `${eyes}${fmt(s.n)} balls; ${fmt(s.drawn)} drawn (${pct} %) in ${s.cellsDrawn} of ${s.cells} cells, ${s.draws} draws${s.eyes > 1 ? ' an eye' : ''}. `
    + `${mesh ? `${big(s.tris)} triangles` : `${big(s.drawn)} points`}; ${fmt(s.calls)} draw calls in all. ${fr}.${s.building ? ` Building ${fmt(s.building)}…` : ''}`;
}
// what is in the scene: the crowd's molecules, or the cloud
function whatLine() {
  const s = cst();
  if (!s || !s.n) return '';
  const names = api('crowds').kindNames || [];
  const gl = (s.gl2 ? '' : ' Meshes need WebGL 2, which this browser lacks: impostors instead.') + (s.fd ? '' : ' This browser cannot write a point\'s depth: every impostor is drawn flat.');
  if (s.what === 1) return `About ${fmt(s.mols)} protein molecules (${s.kinds.map((n, i) => `${big(n)} balls of ${names[i]}`).join(', ')}), copies of one packed cube of cytoplasm about 100 nm across, each copy turned.${gl}`;
  return `A made-up cloud: ${fmt(s.n)} balls at random, a fifth of the cube filled, coloured as the protein kinds.${gl}`;
}
// what each culling switch leaves out now
function cullLine() {
  const s = cst();
  if (!s || !s.n) return '';
  const [a, b, c] = s.perLod, mesh = s.mode === 1;
  const near = mesh ? '' : s.nearOff ? ` Points stop at ${fmt(s.ptMax)} pixels here: very near balls are drawn smaller than they are.`
    : s.near ? ` ${fmt(s.near)} very near balls drawn as meshes (points stop at ${fmt(s.ptMax)} pixels here).` : '';
  return `${s.out} cells out of view and ${s.hidden} hidden behind full cells left out${s.fading ? ' (none hidden while the crowd fades)' : ''}; ${fmt(s.thinOut)} far balls thinned out. `
    + (mesh ? `Detail: ${big(a)} balls at 320 triangles, ${big(b)} at 80, ${big(c)} at 20.` : `Detail: ${big(a)} balls with their true depth, ${big(b)} flat and cheaper.`)
    + `${near} Grid ${s.G} x ${s.G} x ${s.G}; culling ${s.cullMs.toFixed(2)} ms a frame; built in ${fmt(s.ms)} ms.`;
}
// the read-out written again (each half second, from the set): only its lines, not the panes
function readTick() {
  document.querySelectorAll('#explore .crowds-read').forEach(e => { e.textContent = readLine(); });
  document.querySelectorAll('#explore .crowds-cull').forEach(e => { e.textContent = cullLine(); });
}
//#use updateExtraLabels

//#use _rc
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show, or null: nothing to pick here
function pickWith(rc) { return null; }
//#use pickAt
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) { return null; }
// a pick's tip: [bold, rest]
const pickText = p => ['', ''];
// a pick clicked or pressed
function choosePick(p) {}
//#use bindCanvas

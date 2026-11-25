// ================================================================ EXPLORE ==
// Explore mode: each scene (a set) with its own controls (the set's controls, as buttons), and four tabs of the story's
// own (src/SPEC.md, "Explore mode"): Substances and Groups (builder B: e4b_substances.js, e6b_substances.js), Diseases
// and Countries (builder C: e4c_world.js, e6c_world.js). This file is the frame both fill (builder A's).
const SCENES = [...SCENES_B, ...SCENES_C];
const SCENE_SHORT = { cloud: 'Substances', cell: 'Cell', ppi: 'Interactome', globe: 'Europe' };
// the authors' cut for a substance and a disease's closest pairs, as printed (z below it: diseases.bin)
const Z_CUT = () => '−' + Math.abs(XDATA.meta.dis.zClose);
const TABS = [['scenes', 'Scene'], ['substances', 'Substances'], ['groups', 'Groups'], ['diseases', 'Diseases'], ['countries', 'Countries']];
//#use ctlsOf ctlShown~2
const X = { tab: 'scenes', scene: SET_ORDER[0], ctl: {}, t0: 0, turn: 'on' };
//#use XS
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set([...(typeof STEP_B !== 'undefined' ? STEP_B : []), ...(typeof STEP_C !== 'undefined' ? STEP_C : [])]);   // (each builder's)
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

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls. The camera is
// each person's own. v: the shape of this state (FORMAT is the app's: a package that changes its state's shape bumps
// v, and apply ignores a state of another v, from an older copy on another device).
const COLLAB_V = 1;
//#use collabView collabSetView
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl, b: stateB(), c: stateC() };
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
  applyB(v.b); applyC(v.c);
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
    }[b.dataset.act] || (() => actB(b) || actC(b)))();
  });
  // typing in a pane's search box (B's and C's)
  $('#explore').addEventListener('input', ev => { inputB(ev) || inputC(ev); });
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
function renderAll() { renderScenes(); renderSubstances(); renderGroups(); renderDiseases(); renderCountries(); updateExtraLabels(); }
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `${SCENES.length > 1 ? `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>` : ''}
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}`;
}
//#use updateExtraLabels

//#use _rc
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show, or null: each builder's picks
// carry k: 'b' or 'c' (B's scenes and C's), and go back to their own functions
function pickWith(rc) { return pickWithB(rc) || pickWithC(rc); }
//#use pickAt
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) { return !p ? null : p.k === 'b' ? pickPosB(p) : pickPosC(p); }
// a pick's tip: [bold, rest]
const pickText = p => (!p ? ['', ''] : p.k === 'b' ? pickTextB(p) : pickTextC(p));
// a pick clicked or pressed
function choosePick(p) { if (p) (p.k === 'b' ? chooseB : chooseC)(p); }
//#use bindCanvas

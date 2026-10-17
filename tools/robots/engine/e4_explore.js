
// ================================================================ EXPLORE ==
// Explore mode: the gang stays for as long as you do. Its controls choose the view, the rule (and so the network of
// who follows whom), how many robots, the cleaned floor and the links; buttons spill crumbs and make the floor dusty
// again. A click on the floor walks you there (in a headset the trigger on the floor spills crumbs).
const SCENES = [
  ['robots', 'The gang', 'Robot vacuums in a model living room. Click the floor to walk there; drag to look around.'],
];
const TABS = [['scenes', 'The gang']];
const X = { tab: 'scenes', scene: 'robots', ctl: {}, t0: 0, turn: 'on', g: 0 };
const XS = {};
const orbit = { cur: [35, 52, 7.8, 0, 0.1, 0.15], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const viewNow = () => ctlValue('robots', GL.sets.robots.controls[0]);

// what the controls ask for (the counters - dust, crumbs - only move when a button is pressed)
const COUNTERS = new Set(['robots_dust', 'robots_crumbs']);
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const out = {};
  for (const n in DEF) out[n] = COUNTERS.has(n) ? XS[n] : n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
const STEP = new Set(['robots_rule', 'robots_n', 'robots_walk', 'robots_dust', 'robots_crumbs']);   // whole numbers jump, they do not ease
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // the low view's target eases onto the gang
  X.g += ((viewNow() === 'low' ? 1 : 0) - X.g) * (1 - Math.exp(-dt * 2.5));
  // from above, the view drifts slowly round unless you are steering it
  if (X.turn === 'on' && viewNow() === 'default' && !orbit.to && !orbit.held) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 3 * Math.cos(X.sway * 0.15); }
  updateExploreLive();
  return XS;
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  X.scene = k; X.t0 = performance.now();
  if (fly) flyTo(view(k, 'default'));
  renderScenes();
}
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key);
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  if (key === 'view') { CAMV.hold = 0; if (s.cam && s.cam[v] && v !== 'eyes') flyTo(view(k, v)); }
  if (c) renderScenes();
}
// the buttons: a pile of crumbs 1-2 m from you (the set picks the spot), a dusty floor again
function spillCrumbs() { XS.robots_crumbs = Math.floor(XS.robots_crumbs || 0) + 1; }
function dustAgain() { XS.robots_dust = Math.floor(XS.robots_dust || 0) + 1; }
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now();
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / (orbit.dur * 1000)), f = orbit.from, t = orbit.to;
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) orbit.to = null;
}

// the live line under the buttons, as text for the page and the headset panel
const liveLine = () => `Cleaned: ${Math.round(GL.sets.robots.coverage() * 100)} % of the floor · ${GL.sets.robots.robots()} robots`;
let liveShown = '';
function updateExploreLive() {
  const s = liveLine(), el = $('#rbLive');
  if (s !== liveShown && el) { el.textContent = s; liveShown = s; }
}
function buildExplore() {
  $('#explore').innerHTML = `<div class="pane on" id="pane-scenes" role="region" aria-label="The gang"></div>`;
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
    else if (b.dataset.act === 'crumbs') spillCrumbs();
    else if (b.dataset.act === 'dust') dustAgain();
  });
  renderScenes();
  $('#viewctl').innerHTML = `<div class="grp"><span>Drift</span><div class="seg" data-ctl="turn" role="group" aria-label="Drift">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) setTurn(b.dataset.v); });
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) { X.tab = k; }
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn primary" type="button" data-act="crumbs">Spill crumbs</button> <button class="btn" type="button" data-act="dust">Dust again</button></div>
    <p class="sub" id="rbLive" aria-live="off">${esc(liveLine())}</p>`;
  liveShown = '';
}
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
// A click (no drag) on the floor walks you there; a drag turns the view (in your eyes: your head); the wheel or a
// pinch zooms. Over the floor the pointer shows you can click.
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _inv = new THREE.Matrix4(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
// where a point on the screen lands on the floor, in the set's frame: [x, z] or null
function floorAt(mx, my) {
  const F = GL.sets.robots;
  if (GL.renderer.xr.isPresenting) return null;
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  GL.camera.updateMatrixWorld();
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(F.group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return F.floorPoint(_ro.toArray(), _rd.toArray());
}
function walkHere(mx, my) {
  const p = floorAt(mx, my);
  return p ? GL.sets.robots.walkTo(p[0], p[1]) : false;
}
function bindCanvas() {
  const cv = GL.canvas, pts = new Map();
  let down = null, pinch = 0, cursor = '';
  const setCursor = c => { if (c !== cursor) { cv.style.cursor = c; cursor = c; } };
  setCursor('grab');
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) {   // hovering: a pointer over the floor
      if (ev.pointerType === 'mouse') setCursor(floorAt(ev.clientX, ev.clientY) ? 'pointer' : APP.mode === 'explore' ? 'grab' : 'default');
      return;
    }
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (APP.mode !== 'explore') return;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && viewNow() !== 'eyes') orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.4, 30);
      pinch = d; down.moved = true; return;
    }
    if (down && down.moved) {
      setCursor('grabbing');
      if (viewNow() === 'eyes' && CAMV.look) {
        // in your eyes you turn your head (drag the room along); the gaze goes back to the gang a little later
        CAMV.look.az += dx * 0.16; CAMV.look.el = clamp(CAMV.look.el + dy * 0.16, -80, 35); CAMV.hold = 3;
      } else {
        orbit.to = null;
        orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, 2, 85);
      }
    }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (down && !down.moved && ev.type === 'pointerup' && pts.size === 0) walkHere(ev.clientX, ev.clientY);
    if (!pts.size) { down = null; orbit.held = false; setCursor(APP.mode === 'explore' ? 'grab' : 'default'); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore' || viewNow() === 'eyes') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.4, 30);
  }, { passive: false });
}

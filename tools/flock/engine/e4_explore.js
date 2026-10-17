
// ================================================================ EXPLORE ==
// Explore mode: the flock flies on for as long as you stay. Its controls choose the view, how many birds, the
// network of who follows whom, and whether a falcon comes now and then; a click on the sky (or the trigger in a
// headset) sends one where you point.
const SCENES = [
  ['flock', 'Flock', 'Starlings at dusk, all around you. Each bird follows the seven nearest to it. Click the sky to send a falcon; drag to look around.'],
];
const TABS = [['scenes', 'Flock']];
const X = { tab: 'scenes', scene: 'flock', ctl: {}, t0: 0, turn: 'on' };
const XS = {};
const orbit = { cur: [0, -26, 0.25, 0, 1.6, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
// the camera follows the flock unless you look around yourself
const following = () => APP.mode === 'story' || ctlValue('flock', GL.sets.flock.controls[0]) !== 'free';

// what the controls ask for
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
const STEP = new Set(['flock_birds', 'flock_hunt']);   // counts jump, they do not ease
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  const fo = GL.sets.flock.falconOn();
  if (fo !== X.fo) { X.fo = fo; renderScenes(); }   // the falcon button follows the falcon
  // looking around by yourself, the view drifts slowly round unless you are steering it
  if (X.turn === 'on' && !following() && !orbit.to && !orbit.held) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 4 * Math.cos(X.sway * 0.2); }
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
  if (key === 'view' && s.cam && s.cam[v]) flyTo(view(k, v));
  if (c) renderScenes();
}
// send a falcon (dir: where you point, in the flock's frame; none: from anywhere); in a shared room the others
// at this station see it too (an effect); true if one went
function sendFalcon(dir) {
  if (!GL.sets.flock.scatter(dir || null)) return false;
  renderScenes();
  HOST.collab.effect('falcon', { dir: dir || null });
  return true;
}
// shared rooms: the controls everyone at the station sees alike (the view is each person's own camera)
const SHARED_CTL = ['birds', 'links', 'falcon'];
// shared rooms: life size in a headset, so no view places anything there (none to share)
function collabView() { return null; }
function collabSetView() { /* nothing to set */ }
function collabState() {
  return Object.fromEntries(GL.sets.flock.controls.filter(c => SHARED_CTL.includes(c.key)).map(c => [c.key, ctlValue('flock', c)]));
}
function collabApply(v) {
  for (const c of GL.sets.flock.controls) {
    const x = v && v[c.key];
    if (SHARED_CTL.includes(c.key) && c.options.some(o => o[0] === x) && ctlValue('flock', c) !== x) setCtl('flock', c.key, x);
  }
}
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

function buildExplore() {
  $('#explore').innerHTML = `<div class="pane on" id="pane-scenes" role="region" aria-label="The flock"></div>`;
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
    else if (b.dataset.falcon !== undefined) sendFalcon(null);
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
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene], busy = s.falconOn && s.falconOn();
  pane.innerHTML = `<h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn primary" type="button" data-falcon${busy ? ' disabled' : ''}>${busy ? 'A falcon is hunting' : 'Send a falcon'}</button></div>`;
}
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _inv = new THREE.Matrix4(), _rd = new THREE.Vector3();
// the direction a click points, in the flock's frame
function rayDir(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(GL.sets.flock.group.matrixWorld).invert();
  return _rd.copy(_rc.ray.direction).transformDirection(_inv).toArray();
}
function bindCanvas() {
  const cv = GL.canvas, pts = new Map();
  let down = null, pinch = 0;
  cv.style.cursor = 'grab';
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId) || APP.mode !== 'explore') return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.2, 60);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (down && down.moved) {
      // dragging takes the camera from the flock: from then on you look around yourself
      if (following()) { orbit.cur = followView(orbit.cur, 0, true); setCtl('flock', 'view', 'free'); }
      orbit.to = null;
      // close up you stand still and turn your head (drag the sky along); from afar you circle the flock
      const near = orbit.cur[2] < 1, s = near ? -0.18 : 0.25;
      orbit.cur[0] += dx * (near ? 0.18 : -0.25); orbit.cur[1] = clamp(orbit.cur[1] + dy * s, -80, 80);
    }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') sendFalcon(rayDir(ev.clientX, ev.clientY));
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.2, 60);
  }, { passive: false });
}

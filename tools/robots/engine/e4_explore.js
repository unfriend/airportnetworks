
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
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : v;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  // (sound effects: a new rule chimes at you, each robot added pops out of the dock, a view swings)
  if (v !== was) {
    if (key === 'rule') sfxAct('ping', k, 'you', { pitch: { follow: 1.2, chain: 0.9, flee: 0.8, bounce: 1 }[v] || 1, gain: 0.6 });
    else if (key === 'robots') for (let j = 0; j < Math.min(6, (+v || 0) - (+was || 0)); j++) sfxAct('bubble', k, 'dock', { delay: 0.09 * j, force: true, pitch: 0.9 + 0.08 * j, gain: 0.6 });
    else if (key === 'view') sfxAct('whoosh', k, null, { dur: 0.7, pitch: 1.1 });
  }
  X.t0 = performance.now();
  if (key === 'view') { CAMV.hold = 0; if (s.cam && s.cam[v] && v !== 'eyes') flyTo(view(k, v)); }
  if (c) renderScenes();
}
// the buttons: a pile of crumbs 1-2 m from you (the set picks the spot), a dusty floor again; in a shared room the
// others at the station get both too (effects: the pile at the same spot)
function spillCrumbs() { const p = GL.sets.robots.crumbsNear(); if (p) crumbsOut(p[0], p[1]); }
const dustNow = () => { XS.robots_dust = Math.floor(XS.robots_dust || 0) + 1; };
function dustAgain() { dustNow(); HOST.collab.effect('dust'); }
// shared rooms: the controls everyone at the station sees alike (the view is each person's own camera, the walk their own)
const SHARED_CTL = ['rule', 'robots', 'trails', 'links'];
// shared rooms: life size in a headset, so no view places anything there (none to share)
function collabView() { return null; }
function collabSetView(v, now) { /* nothing to set */ }
function collabState() {
  return Object.fromEntries(GL.sets.robots.controls.filter(c => SHARED_CTL.includes(c.key)).map(c => [c.key, ctlValue('robots', c)]));
}
function collabApply(v) {
  for (const c of GL.sets.robots.controls) {
    const x = v && v[c.key];
    if (SHARED_CTL.includes(c.key) && c.options.some(o => o[0] === x) && ctlValue('robots', c) !== x) setCtl('robots', c.key, x);
  }
}
// A pile spilled here, sent to the others at the station: in a headset with the room frame in room coordinates (a real
// room is the same floor for everyone), otherwise in the set's frame, which is the station's (the model room, or the
// virtual room that hangs on the rig at the station). Played there without sending it again.
const _kp = new THREE.Vector3(), _ks = new THREE.Vector3(), _kY = new THREE.Vector3(0, 1, 0);
function crumbsOut(x, z) {
  const F = GL.sets.robots;
  if (!XR.on || !HOST.room.aligned) { HOST.collab.effect('crumbs', { x, z, f: 'station' }); return; }
  const r = HOST.room.toRoom(F.group.localToWorld(_kp.set(x, 0, z)));
  HOST.collab.effect('crumbs', { x: r.x, z: r.z, f: 'room' });
}
function crumbsIn(d) {
  const F = GL.sets.robots, L = HOST.collab.live(), room = XR.on && HOST.room.aligned;
  if (!d || !isFinite(d.x) || !isFinite(d.z)) return false;
  const p = _kp.set(+d.x, 0, +d.z), spot = L ? _ks.set(L.x, 0, L.z) : null;
  if (d.f === 'room' && room) F.group.worldToLocal(p.copy(HOST.room.toLocal(p)));
  else if (d.f === 'room') { if (!spot) return false; p.sub(spot).applyAxisAngle(_kY, -L.yaw); }   // no room frame here: the station's
  else if (room && XRR.kind === 'real' && spot) F.group.worldToLocal(p.copy(HOST.room.toLocal(p.applyAxisAngle(_kY, L.yaw).add(spot))));
  return F.crumbs(p.x, p.z);
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
  const p = floorAt(mx, my), w = p ? GL.sets.robots.walkTo(p[0], p[1]) : false;
  if (w) sfxAct('pick', 'robots', [w[0], 0.05, w[1]]);   // (sound effects: where you walk to)
  return w;
}
// sound effects, live (the shared block's sfxStep calls this every frame, story and explore mode alike, unless the story is
// hidden): the two moving robots nearest you hum as vacuums (continuous sounds, their gain and pitch by speed; read every
// 100 ms, kept going every frame); each bump a small knock (at most one a robot in 0.3 s, four a second in all); a pile
// spilled (yours, the story's, explore's or another device's: watched, not hooked) a patter, a crumb eaten a "nom" (at
// most twice a second); the floor dusty again a low patter
const SFR = { t: 0, near: [], piles: new Map(), nom: 0, cov: 0, bump: [], bumpT: new Float64Array(24) };
function sfxBump(i, x, z) {
  const pn = performance.now();
  if (sfxHidden() || pn - (SFR.bumpT[i] || 0) < 300) return;
  while (SFR.bump.length && pn - SFR.bump[0] > 1000) SFR.bump.shift();
  if (SFR.bump.length >= 4) return;
  SFR.bumpT[i] = pn; SFR.bump.push(pn);
  sfxPlay('knock', 'robots', [x, 0.08, z], { pitch: 1.8, gain: 0.25 });
}
function sfxLive() {
  const s = GL.sets.robots, pn = performance.now();
  s.onBump = sfxBump;
  if (pn - SFR.t > 100) {
    SFR.t = pn;
    const st = s.state(), me = st.player;
    // the two nearest robots that are moving
    SFR.near = st.robots.filter(r => Math.abs(r.v) > 0.03).map(r => [Math.hypot(r.x - me.x, r.z - me.z), r]).sort((p, q) => p[0] - q[0]).slice(0, 2).map(p => p[1]);
    // piles: new ones, and crumbs eaten
    const seen = new Set();
    for (const p of st.piles) {
      const id = p.t.toFixed(3) + ':' + p.x.toFixed(2) + ':' + p.z.toFixed(2), left = SFR.piles.get(id);
      seen.add(id);
      if (left === undefined) sfxPlay('patter', 'robots', [p.x, 0.05, p.z], { dur: 1.2 });
      else if (p.left < left && pn - SFR.nom > 500) { SFR.nom = pn; sfxPlay('bubble', 'robots', [p.x, 0.05, p.z], { pitch: 1.6, gain: 0.5 }); }
      SFR.piles.set(id, p.left);
    }
    for (const id of [...SFR.piles.keys()]) if (!seen.has(id)) SFR.piles.delete(id);
    if (SFR.cov > 0.02 && st.coverage < SFR.cov * 0.3) sfxPlay('patter', 'robots', 'floor', { dur: 1.5, pitch: 0.6, gain: 0.6 });
    SFR.cov = st.coverage;
  }
  if (!HOST.sfx || !HOST.sfx.drone) return;
  SFR.near.forEach((r, k) => {
    const f = clamp(Math.abs(r.v) / 0.5, 0, 1);
    try { HOST.sfx.drone('robots.v' + k, 'vacuum', Object.assign(sfxWhere('robots', [r.x, 0.06, r.z]), { gain: 0.35 + 0.65 * f, pitch: 0.85 + 0.35 * f })); } catch (e) { /* an older shell */ }
  });
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

//#use head
// ================================================================ EXPLORE ==
// Explore mode is practice: seven small tasks the guide reacts to (point at the hub, send a signal, pause and play,
// another marker, open the menu, Recenter, move with the sticks or walk round it), and the network from its chest to
// point at. The ticks are this device's own (each person practises for themselves): kept in sessionStorage, never in
// the room's state. The room shares the network's look, the marker it stands at and whether practice runs.
const SCENES = [
  ['guide', 'Practice', 'Seven small tasks. I nod when you get one.'],
];
const TABS = [['scenes', 'Practice']];
const X = { tab: 'scenes', scene: 'guide', ctl: {}, t0: 0, turn: 'off' };
//#use XS
const orbit = { cur: [-8, 12, 2.48, 0.35, 1.1, -2.0], from: null, to: null, t0: 0, dur: 1.6 };
//#use ctlValue

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
const STEP = new Set(['guide_clock', 'guide_mode', 'guide_net']);   // (they jump, they do not ease)
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : Math.abs(tg[n] - XS[n]) < 1e-6 ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;   // (snapped at the end: pickMemo's key)
  return XS;
}
//#use openScene~2
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  if (ctlValue(k, c) !== v) sfxAct(v === 'grown' ? 'grow' : 'snap', 'guide', 'net', { dur: 0.8, gain: 0.4 });   // (sound effects: the network grows or shrinks back)
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  renderScenes();
}

// ---------------------------------------------------------------- practice --
const TASKS = [
  { id: 'hub', name: 'Point at the hub', hint: 'The middle node. Hold your ray on it.', page: 'The middle node. Hold the mouse over it.' },
  { id: 'signal', name: 'Send a signal', hint: 'Pull the trigger (or pinch) on any node.', page: 'Click any node.' },
  { id: 'pause', name: 'Pause me, then play', hint: 'The round button on the bar below.' },
  { id: 'marker', name: 'Send me to another marker', hint: 'The arrows on the bar.' },
  { id: 'menu', name: 'Open the menu', hint: 'Click a thumbstick, or pinch twice with your left hand.', xr: true },
  { id: 'recenter', name: 'Recenter', hint: 'On the panel, or in the menu’s settings.', xr: true },
  { id: 'move', name: 'Move with the sticks', ar: 'Walk round me', hint: 'Turn it on in the menu’s settings, then push the left stick.', arHint: 'Take a few steps.', xr: true },
];
// PR: run (practice playing: the room's), mk (the marker it stands at: -1 at home; the room's), the ticks (this
// device's), and what the tasks are measuring
const PR = { run: true, mk: -1, done: TASKS.map(() => false), hub: 0, sawPause: false, rc: 0, needRc: false, stick: 0, rig0: null, head0: null, last: 0, nudge: 0, t: 0, all: false, arrive: null };
const TICKS = 'tutorialTicks';
function ticksLoad() {
  try { const v = JSON.parse(sessionStorage.getItem(TICKS) || 'null'); if (Array.isArray(v) && v.length === TASKS.length) PR.done = v.map(Boolean); } catch (e) { /* storage blocked */ }
}
function ticksSave() { try { sessionStorage.setItem(TICKS, JSON.stringify(PR.done)); } catch (e) { /* storage blocked */ } }
const inXR = () => !!(XR.on && GL.renderer && GL.renderer.xr.isPresenting);
const isAR = () => inXR() && !XR.clear;
const WALK_WORDS = { room: 'In a shared room you walk for real', none: 'This headset cannot move you with the sticks', own: 'Not in this scene', session: 'In a headset' };
// why a task cannot be done here ('' it can): a page does tasks 1 to 4; a headset all but Recenter while anchored and
// the sticks where the shell refuses them (in VR)
function taskWhy(i) {
  const T = TASKS[i];
  if (T.xr && !inXR()) return 'in a headset';
  if (T.id === 'recenter' && HOST.anchor && HOST.anchor.on) return 'anchored: nothing moves';
  if (T.id === 'move' && !isAR()) { const w = HOST.xr && HOST.xr.walkWhy ? HOST.xr.walkWhy() : ''; if (w && w !== 'ar') return WALK_WORDS[w] || w; }
  return '';
}
const taskName = i => (TASKS[i].id === 'move' && isAR() ? TASKS[i].ar : TASKS[i].name);
const taskHint = i => (TASKS[i].id === 'move' && isAR() ? TASKS[i].arHint : !inXR() && TASKS[i].page ? TASKS[i].page : TASKS[i].hint);
const taskCount = () => { let n = 0, d = 0; TASKS.forEach((T, i) => { if (!taskWhy(i)) { n++; if (PR.done[i]) d++; } }); return [d, n]; };
// a task done: a tick, the guide's nod and its tag (Task 3 of 7: done), a ping; all of them: its full turn and a wave
function tick(id) {
  const i = TASKS.findIndex(T => T.id === id);
  if (i < 0 || PR.done[i] || taskWhy(i) || APP.mode !== 'explore') return false;
  PR.done[i] = true; ticksSave(); PR.last = PR.t;
  const [d, n] = taskCount(), g = GL.sets.guide;
  if (d >= n && !PR.all) { PR.all = true; g.react('all'); sfxAct('rise', 'guide', 'head', { gain: 0.5 }); sfxAct('ratchet', 'guide', 'head', { n: 4, gain: 0.35, delay: 0.2 }); }
  else { g.react('done', d, n); sfxAct('ping', 'guide', 'head'); }
  renderScenes();
  return true;
}
function practiceReset() {
  PR.done = TASKS.map(() => false); PR.all = false; PR.hub = 0; PR.sawPause = false; PR.stick = 0; PR.last = PR.t; PR.nudge = PR.t;
  PR.rig0 = PR.head0 = null; ticksSave(); renderScenes();
}
// the practice bar: Play and Pause, the arrows (the marker the guide walks to)
function practiceToggle(on) {
  const run = on === undefined ? !PR.run : !!on;
  if (run === PR.run) return;
  PR.run = run;
  GL.sets.guide.setRun(run);
  if (!run) PR.sawPause = true;
  else if (PR.sawPause) tick('pause');
  sfxAct(run ? 'toggleOn' : 'toggleOff', 'guide', 'head', { gain: 0.35 });
  renderScenes();
}
function practiceMark(i, quiet) {
  i = clamp(i, 0, 4);
  if (i === PR.mk) return;
  PR.mk = i;
  PR.arrive = { i, at: GL.sets.guide.walkTo(i) };
  if (!quiet) tick('marker');
  renderScenes();
}
const practiceStepBy = d => practiceMark(PR.mk < 0 ? (d > 0 ? 0 : 4) : (PR.mk + d + 5) % 5);
// every frame in explore mode: what the tasks measure (the hub held under a ray, the menu, Recenter, the sticks or a
// walk), a nudge after 15 s with nothing done, the step on arriving at a marker
function practiceStep(dt) {
  if (APP.mode !== 'explore') return;
  const g = GL.sets.guide, P = g.practice();
  PR.t = P.t;
  if (LIVE.hover === 0) { PR.hub += dt; if (PR.hub >= 0.4) tick('hub'); }
  if (inXR()) {
    if (HOST.collab && HOST.collab.menu) tick('menu');
    const need = !!XR.needRecenter;
    if ((need && !PR.needRc) || PR.rc) { PR.rc = 0; tick('recenter'); }
    PR.needRc = need;
    if (isAR()) {
      if (!PR.head0) PR.head0 = LIVE.head.slice();
      if (Math.hypot(LIVE.head[0] - PR.head0[0], LIVE.head[2] - PR.head0[2]) >= 1) tick('move');
    } else {
      const src = HOST.session && Array.from(HOST.session.inputSources || []).find(s => s.handedness === 'left' && s.gamepad);
      const ax = src ? src.gamepad.axes : null, push = ax && ax.length >= 4 ? Math.hypot(ax[2], ax[3]) : 0;
      if (xrWalking() && push > 0.3) PR.stick += dt;
      if (!PR.rig0) PR.rig0 = GL.rig.position.clone();
      if (xrWalking() && (PR.stick >= 1 || Math.hypot(GL.rig.position.x - PR.rig0.x, GL.rig.position.z - PR.rig0.z) >= 0.3)) tick('move');
    }
  }
  if (PR.arrive && P.t >= PR.arrive.at) { sfxAct('step', 'guide', 'marker' + PR.arrive.i, { pitch: [1.0, 1.12, 1.26, 1.41, 1.59][PR.arrive.i] }); PR.arrive = null; }
  // a nudge: the next task mimed, at most every 20 s, never while paused
  if (PR.run && !PR.all && P.t - PR.last > 15 && P.t - PR.nudge > 20) {
    const i = TASKS.findIndex((T, k) => !PR.done[k] && !taskWhy(k));
    if (i >= 0) { PR.nudge = P.t; g.react('nudge', i); }
  }
}
// send a signal from node i: the beads run out hop by hop; in a shared room the others at this station see it too
// (an effect, sig); remote: it came from the room
function sendSignal(i, remote) {
  const s = GL.sets.guide;
  if (!s.signal(i)) return false;
  sfxAct('pulse', 'guide', 'node' + i, { gain: 0.45 });
  if (!remote) {
    if (HOST.collab && HOST.collab.effect) HOST.collab.effect('sig', { n: i });
    if (APP.mode === 'explore') { s.react('signal', i); tick('signal'); }
  }
  return true;
}
function guideEffect(type, d) {
  if (type === 'sig' && d && typeof d === 'object' && Number.isInteger(d.n) && d.n >= 0 && d.n < 10) sendSignal(d.n, true);
}
// shared rooms: the network's look, the marker, practice running (outcomes only; never the ticks, the guide's
// reactions or its clock: each device's own)
function collabState() {
  return { net: ctlValue('guide', GL.sets.guide.controls[0]), mk: PR.mk, run: PR.run ? 1 : 0 };
}
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (v.net === 'badge' || v.net === 'grown') { if (ctlValue('guide', GL.sets.guide.controls[0]) !== v.net) setCtl('guide', 'net', v.net); }
  if (Number.isInteger(v.mk) && v.mk >= -1 && v.mk <= 4 && v.mk !== PR.mk) { if (v.mk < 0) PR.mk = -1; else practiceMark(v.mk, true); }
  if ((v.run === 0 || v.run === 1) && !!v.run !== PR.run) { PR.run = !!v.run; GL.sets.guide.setRun(PR.run); renderScenes(); }
}
//#use collabView~2 collabSetView~2
//#use flyTo orbitStep
function buildExplore() {
  $('#explore').innerHTML = `<div class="pane on" id="pane-scenes" role="region" aria-label="Practice"></div>`;
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
    else if (b.dataset.act === 'signal') sendSignal(0);
    else if (b.dataset.act === 'again') practiceReset();
    else if (b.dataset.act === 'airports') HOST.go('airports');
    else if (b.dataset.act === 'play') practiceToggle();
    else if (b.dataset.act === 'prev') practiceStepBy(-1);
    else if (b.dataset.act === 'next') practiceStepBy(1);
  });
  ticksLoad();
  renderScenes();
  $('#viewctl').innerHTML = '';
}
//#use setTurn showTab~2
const markWords = () => (PR.mk < 0 ? 'At home' : `Marker ${PR.mk + 1} of 5`);
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane || !GL.sets.guide) return;
  const sc = SCENES[0], s = GL.sets.guide, [d, n] = taskCount();
  const rows = TASKS.map((T, i) => {
    const why = taskWhy(i), done = PR.done[i] && !why;
    return `<li style="display:flex;gap:10px;align-items:flex-start;margin:0 0 8px;${why ? 'opacity:0.45' : ''}"><span aria-hidden="true" style="flex:none;width:20px;height:20px;border-radius:5px;border:2px solid ${done ? 'var(--cyan)' : 'var(--muted)'};${done ? 'background:var(--cyan);color:#04131c;' : ''}text-align:center;line-height:18px;font-weight:700">${done ? '✓' : ''}</span>
      <span aria-label="${done ? 'Done: ' : ''}${esc(taskName(i))}"><b>${i + 1}. ${esc(taskName(i))}</b><br><small style="color:var(--muted)">${esc(why ? why[0].toUpperCase() + why.slice(1) : taskHint(i))}</small></span></li>`;
  }).join('');
  const room = !!(HOST.room && HOST.room.inRoom && HOST.room.inRoom());
  pane.innerHTML = `<h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])} ${d} of ${n} done.</p>
    <ol style="list-style:none;padding:0;margin:0 0 14px">${rows}</ol>
    <div class="actions" style="display:flex;gap:8px;align-items:center;margin-bottom:14px" role="group" aria-label="Practice bar">
      <button class="btn" type="button" data-act="play" aria-label="${PR.run ? 'Pause' : 'Play'}">${PR.run ? 'Pause' : 'Play'}</button>
      <button class="btn" type="button" data-act="prev" aria-label="Previous marker">◀</button>
      <button class="btn" type="button" data-act="next" aria-label="Next marker">▶</button>
      <span style="color:var(--muted)">${markWords()}</span></div>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, nm]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(nm)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn primary" type="button" data-act="signal">Send a signal from the hub</button>
      <button class="btn" type="button" data-act="again">Start again</button>${room ? '' : '<button class="btn" type="button" data-act="airports">Start the airports story</button>'}</div>`;
}
//#use updateExtraLabels
// ----------------------------------------------------------- canvas input --
// on a page: drag to look round the guide, the wheel to come nearer; the mouse over a node lights it (and its tag),
// a click on a node sends a signal from it
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _inv = new THREE.Matrix4(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
const PH = { hit: null, x: -1, y: -1 };
function pageHit(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(GL.sets.guide.group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return GL.sets.guide.hit(_ro.toArray(), _rd.toArray());
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
    if (APP.mode === 'explore' && ev.pointerType === 'mouse' && !pts.size) { PH.hit = pageHit(ev.clientX, ev.clientY); cv.style.cursor = PH.hit && PH.hit.kind === 'node' ? 'pointer' : 'grab'; }
    if (!pts.has(ev.pointerId) || APP.mode !== 'explore') return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.6, 8);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (down && down.moved) {
      orbit.to = null;
      orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.2, -10, 70);
    }
  });
  cv.addEventListener('pointerleave', () => { PH.hit = null; });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const h = pageHit(ev.clientX, ev.clientY);
      if (h && h.kind === 'node') sendSignal(h.id);
    }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.6, 8);
  }, { passive: false });
}

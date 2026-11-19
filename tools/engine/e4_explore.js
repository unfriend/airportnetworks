// Shared parts of the built stories' engine file e4_explore.js: see tools/engine/parts.mjs. Edit a part here, then
// rebuild every story that uses it (node tools/engine/all.mjs); node tools/engine/parts.mjs lists who uses what.
//#part head

//#part ctlShown
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isAge(x) ? ageOpt(x) : ctlValue(k, x)])));
//#part AGE0
const AGE0 = FACTS.ages[0], AGE1 = FACTS.ages[1];
//#part XS
const XS = {};
//#part orbit
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
//#part ctlValue
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
//#part ctlOf
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
//#part optKey
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
//#part ageOpt
// the age slider as a set's own Age option (the one nearest X.age)
const ageOpt = c => { let b = c.options[0][0], bd = Infinity; for (const [v, n] of c.options) { const a = parseFloat(n) || parseFloat(v), d = Math.abs(a - X.age); if (d < bd) { bd = d; b = v; } } return b; };
//#part viewCam
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
//#part viewIs
// the view on show in a set, by its key or its name
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || !!(o && re.test(o[1])); };
//#part NEXT~2
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
//#part afterUpdate
const afterUpdate = f => { NEXT.push(f); };
//#part exploreStep
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
//#part pushState
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
//#part flyTo
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now(); orbit.fast = false;
}
//#part orbitStep
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
}
//#part flyNear
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

//#part collabSetView
function collabSetView(v, now) {
  if (APP.mode !== 'explore' || !Array.isArray(v) || v.length !== 6 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[0] += 360 * Math.round((c[0] - to[0]) / 360);
  if (now) { orbit.cur = to; orbit.to = null; return; }   // someone else turning it: there at once (shared.js smooths it)
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
//#part chip
// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
//#part link
const link = (act, v, text) => `<button type="button" data-act="${act}" data-v="${esc(v)}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${text}</button>`;
//#part setTurn
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
//#part showTab
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  // (five tabs overflow a phone's panel: the row scrolls so the chosen one shows)
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
//#part _rc
// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
//#part pickAt
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
//#part bindCanvas
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

//#part SCENE_SHORT
const SCENE_SHORT = {};
//#part orbitStep~2
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
}

//#part bindCanvas~2
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
    cv.style.cursor = p ? 'pointer' : 'grab';
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

//#part ctlsOf
const ctlsOf = k => GL.sets[k].controls || [];
//#part ctlShown~2
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
//#part viewIs~2
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, 'view'); return !!c && ctlValue(k, c) === v; };
//#part api
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
//#part NEXT
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
//#part pushState~2
// what the panes pick reaches the sets through their params (exploreTargets)
function pushState() { updateExtraLabels(); }
//#part openScene
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) { flyTo(view(k, viewCam(k) || 'default')); sfxAct('whoosh', k, null, { dur: 0.8 }); }   // (sound effects: another scene)
  renderAll();
}
//#part setCtl
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
//#part showView
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, 'view', v); }
//#part cap
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
//#part camFor
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
//#part statsHtml
const statsHtml = rows => `<dl class="stats">${rows.map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${more ? `<small>${esc(more)}</small>` : ''}</dd>`).join('')}</dl>`;
//#part allCtl
const allCtl = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key)).concat(OWN_CTL[k] || []);
//#part ctlsOf~2
const ctlsOf = k => allCtl(k).filter(c => !isNum(k, c));
//#part numOf
const numOf = key => X[key];
//#part viewKey
const viewKey = k => VIEW_KEY[k] || 'view';
//#part viewIs~3
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, viewKey(k)); return !!c && ctlValue(k, c) === v; };
//#part showView~2
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, viewKey(k), v); }
//#part sceneCtl
// a control of a scene picked from a tab: its scene brought up
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  setCtl(k, key, v);
}

//#part renderScenes
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
//#part setApi
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
//#part afterUpdate~2
const afterUpdate = f => { NEXT.push(f); };

//#part r2
const r2 = a => a.map(x => Math.round(x * 100) / 100);
//#part earlier
const earlier = (a, b) => a.since < b.since || (a.since === b.since && a.id < b.id);
//#part openScene~2
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  X.scene = k; X.t0 = performance.now();
  if (fly) flyTo(view(k, 'default'));
  renderScenes();
}
//#part collabView
// shared rooms: life size in a headset, so no view places anything there (none to share)
function collabView() { return null; }
//#part collabSetView~2
function collabSetView(v, now) { /* nothing to set */ }
//#part flyTo~2
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now();
}
//#part orbitStep~3
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / (orbit.dur * 1000)), f = orbit.from, t = orbit.to;
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) orbit.to = null;
}

//#part showTab~2
function showTab(k) { X.tab = k; }
//#part updateExtraLabels
function updateExtraLabels() {}

//#part ctlValue~2
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);

//#part _rc~2
// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _inv = new THREE.Matrix4();
//#part chip~2
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;

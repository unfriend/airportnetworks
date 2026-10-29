
// ================================================================ EXPLORE ==
// Explore mode is the room itself: the table with every miniature, a click (or the trigger, or a pinch) puts one on
// the stage and its card on the panel. Two tabs: Prop (the card of the prop on the stage) and All props (every
// story's props, to pick from). On a screen the camera goes round the table (drag to turn, wheel to zoom).
const TABS = [['prop', 'Prop'], ['all', 'All props']];
const X = { tab: 'all', pick: '', story: STORIES.length ? STORIES[0].key : '', viewName: 'default', minis: 'loading', t0: 0 };
const XS = {};
const orbit = { cur: [0, 38, 4.3, 0, 0.66, 0.05], from: null, to: null, t0: 0, dur: 1.4 };

function exploreTargets() {
  const out = {};
  for (const n in DEF) out[n] = n.endsWith('_a') ? 0 : XS[n];
  out.table_a = 1;
  return out;
}
function exploreStep(dt) {
  const tg = exploreTargets(), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = XS[n] + (tg[n] - XS[n]) * k;
  return XS;
}
function openScene() { /* one scene: the table */ }
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
// the camera's views: the whole table, the stage close, from above, or a story's plate
function showView(name) {
  X.viewName = name;
  const T = GL.sets.table, v = name.startsWith('group:') ? T.groupView(name.slice(6)) : view('table', name);
  if (v) flyTo(v);
  document.querySelectorAll('[data-ctl="view"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === name));
}

// ---------------------------------------------------------------- picking --
// put a prop on the stage (k: a miniature's key, '' to clear it); its card shows on the Prop tab
function pickProp(k, tab = true) {
  k = DESIGN_CARDS[k] ? k : '';
  const changed = k !== X.pick;
  X.pick = k; X.story = k ? DESIGN_CARDS[k].story : X.story;
  GL.sets.table.setPick(k || null);
  if (tab && k) X.tab = 'prop';
  if (changed || tab) renderPanes();
  updateExtraLabels();
}
function setHover(k) {
  const T = GL.sets.table;
  if ((k || null) === T.hovered()) return;
  T.setHover(k || null);
  updateExtraLabels();
}
// every miniature back on its plate (for everyone at a station: the records go out with the state)
function tidyTable() { GL.sets.table.tidy(); renderPanes(); }
function pickTab(k) { if (!TABS.some(t => t[0] === k)) return; X.tab = k; renderPanes(); }

// --------------------------------------------------------- shared rooms --
// What everyone at the station sees alike: the prop on the stage and every miniature moved by hand (its record: where
// it was put and its turn, rounded, and its size), one top-level field each, so two people moving two miniatures at once
// both keep theirs. Nothing per device (the camera, the hover, the tab). Life size in a headset: no view to share.
function collabView() { return null; }
function collabSetView() { /* nothing to set */ }
function collabState() {
  const T = GL.sets.table, s = { pick: X.pick || '' };
  for (const k of CARD_KEYS) { const r = T.recOf(k); if (r) s[k] = r; }
  return s;
}
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const T = GL.sets.table;
  if (typeof v.pick === 'string' && (v.pick === '' || DESIGN_CARDS[v.pick]) && v.pick !== X.pick) pickProp(v.pick, false);
  let moved = false;
  for (const k of CARD_KEYS) {
    const m = T.mini(k);
    if (!m) continue;
    const a = T.okRec(v[k]) ? v[k] : null, was = m.rec;
    if (JSON.stringify(a) === JSON.stringify(was)) continue;
    T.setRec(k, a); moved = true;
  }
  if (moved) renderPanes();
}
function designEffect() { /* none */ }

// ------------------------------------------------------------ the panes --
const CARD_CSS = `<style>
  .dz-kick { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin: 0 0 4px; }
  .dz-card dl.stats { grid-template-columns: 6.2em 1fr; }
  .dz-card dl.stats dd { font-size: 14px; }
  .dz-card code, .dz-params code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 12.5px; }
  .dz-params { width: 100%; border-collapse: collapse; margin: 4px 0 14px; font-size: 13px; }
  .dz-params td { border-top: 1px solid var(--line); padding: 5px 6px 5px 0; vertical-align: top; }
  .dz-params td:nth-child(2) { color: var(--muted); white-space: nowrap; max-width: 9em; overflow: hidden; text-overflow: ellipsis; }
  .dz-params .step { color: var(--amber); font-size: 11px; margin-left: 4px; }
  .dz-views { list-style: none; padding: 0; margin: 4px 0 14px; font-size: 13px; }
  .dz-views li { padding: 3px 0; } .dz-views li b { margin-right: 6px; }
  .dz-story { cursor: pointer; } .dz-story:hover { color: var(--ink); }
  .chips button[aria-pressed="true"] { border-color: var(--cyan); color: var(--cyan); }
</style>`;
function buildExplore() {
  $('#explore').innerHTML = CARD_CSS + `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({ pick: () => pickProp(v), tidy: () => tidyTable(), clear: () => pickProp(''), group: () => showView('group:' + v) })[b.dataset.act]();
  });
  renderPanes();
  $('#viewctl').innerHTML = `<div class="grp"><span>View</span><div class="seg" data-ctl="view" role="group" aria-label="View">${[['default', 'The table'], ['stage', 'The stage'], ['above', 'From above']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.viewName === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) showView(b.dataset.v); });
}
function showTab(k) { pickTab(k); }
const listOf = a => (a && a.length ? a.map(x => `<code>${esc(x)}</code>`).join(', ') : '');
function cardHTML(k) {
  const c = DESIGN_CARDS[k], s = storyOf(k), moved = GL.sets.table.moved().length;
  const rows = [['Story', `${esc(s.title)} <small>${esc(s.kick)}</small>`], c.size && ['Size', esc(c.size)], c.frame && ['Frame', esc(c.frame)],
    ['Source', `<code>${esc(c.file)}</code>${c.manifest ? `<br><small>manifest <code>${esc(c.manifest)}</code></small>` : ''}`],
    ['Reused by', listOf(c.reusedBy) || 'no other set'], c.reuses.length && ['Reuses', esc(c.reuses.join('; '))],
    ['Model', `${fmt(c.tris)} triangles in the miniature`]].filter(Boolean);
  return `<div class="dz-card" data-key="${k}" data-params="${c.params.length}" data-views="${c.views.length}">
    <p class="dz-kick" style="color:${s.col}">${esc(s.kick)} · ${esc(s.title)}</p>
    <h3>${esc(c.name)}</h3><p class="sub">${esc(c.shows)}</p>
    <dl class="stats">${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>
    ${c.note ? `<p class="sub">${esc(c.note)}</p>` : ''}
    ${c.params.length ? `<p class="grp-h">Params (${c.params.length}): names start with the set's key, <code>_a</code> is its fade</p>
    <table class="dz-params"><tbody>${c.params.map(([n, r, m, st]) => `<tr><td><code>${esc(n)}</code>${st ? '<span class="step">step</span>' : ''}</td><td title="${esc(r)}">${esc(r)}</td><td>${esc(m)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${c.views.length ? `<p class="grp-h">Views (${c.views.length})</p><ul class="dz-views">${c.views.map(([n, f]) => `<li><b>${esc(n)}</b>${esc(f)}</li>`).join('')}</ul>` : ''}
    <div class="actions"><button class="btn" type="button" data-act="clear">Clear the stage</button><button class="btn" type="button" data-act="tidy"${moved ? '' : ' disabled'}>Tidy the table</button></div>
  </div>`;
}
function renderPanes() {
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === X.tab));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + X.tab));
  const pp = $('#pane-prop'), pa = $('#pane-all');
  if (!pp || !pa) return;
  const moved = GL.sets.table.moved().length, T = GL.sets.table;
  const state = X.minis === 'failed' ? '<p class="empty">The models could not be loaded: the cards still work.</p>'
    : T.built() < T.total() ? `<p class="empty">Laying the table: ${T.built()} of ${T.total()} models.</p>` : '';
  pp.innerHTML = X.pick ? cardHTML(X.pick) + state : `<h3>The stage</h3><p class="sub">Nothing on the stage yet. Click a model on the table, or pick one under All props: it stands here bigger, and its card shows what it is made of.</p>${state}`;
  pa.innerHTML = `<h3>Every prop</h3><p class="sub">${CARD_KEYS.length} models of the 3D sets of ${STORIES.length} stories, a plate for each story. Click one to put it on the stage.</p>${state}
    ${STORIES.map(s => `<p class="grp-h dz-story" data-act="group" data-v="${s.key}" title="Look at its plate"><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.col}"></span><b style="color:${s.col}">${esc(s.title)}</b> ${esc(s.kick)}</p>
      <div class="chips">${s.keys.map(k => `<button type="button" data-act="pick" data-v="${k}" aria-pressed="${k === X.pick}">${esc(DESIGN_CARDS[k].name)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn" type="button" data-act="tidy"${moved ? '' : ' disabled'}>Tidy the table${moved ? ` (${moved} moved)` : ''}</button></div>`;
}
// the two labels: the name of what you point at, and of what stands on the stage
function updateExtraLabels() {
  const T = GL.sets.table, h = T.hovered(), [Lh, Ls] = LBL.extra;
  if (!Lh) return;
  labelSet(Lh, h ? [DESIGN_CARDS[h].name, storyOf(h).title] : null);
  labelSet(Ls, X.pick ? [DESIGN_CARDS[X.pick].name, 'on the stage'] : null);
  Lh.show = h ? 1 : 0; Ls.show = X.pick && T.stageModel() ? 1 : 0;
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// the miniature under the pointer (mx, my in the window), or null
function miniAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  GL.world.updateMatrixWorld(true);
  const hs = _rc.intersectObjects(GL.sets.table.pickables(), false);
  return hs.length ? hs[0].object.userData.key : null;
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
    if (!pts.has(ev.pointerId)) {
      // pointing without a button: the miniature under the mouse lights up and shows its name
      if (APP.mode === 'explore' && ev.pointerType !== 'touch') { const k = miniAt(ev.clientX, ev.clientY); setHover(k); cv.style.cursor = k ? 'pointer' : 'grab'; }
      return;
    }
    if (APP.mode !== 'explore') return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.5, 8);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (down && down.moved) {
      orbit.to = null;
      orbit.cur[0] -= dx * 0.3; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, 4, 86);
    }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') { const k = miniAt(ev.clientX, ev.clientY); if (k) pickProp(k); }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!pts.size) setHover(null); });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.5, 8);
  }, { passive: false });
}

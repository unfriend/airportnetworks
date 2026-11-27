// ============================================================ THE LANE VIEW ==
// A sequence's timeline on a page (v146; docs/agents/studio.md, "Sequences": "The page's lane view"): a panel docked at the
// bottom of the window while editing with a sequence selected, over the canvas and beside the side panel (never in a headset:
// its card has the bar and the event list). A 2D canvas drawn only when something changed: a ruler (a drag scrubs this
// device's preview), a lane per item the events act on, each event a block (a clip, a path or a sound with its length where it
// is known, a loop to the next stop on the item or the sequence's end with a mark) or a diamond (show, hide, picture, another
// sequence) or a square (a stop); the playhead where the sequence is now (the preview's or the room's). Events are dragged
// (snapped to 0.1 s, Shift free; Alt copies; one Undo step a drag, nothing written while it moves), selected with a click,
// Ctrl or Shift, or a marquee; Delete deletes them (one step); a double click on an event selects it on the card, on an empty
// lane spot opens Add an event for that lane's item at that time. Keys while it has focus: Space plays or holds the preview,
// Home rewinds it, the arrows nudge the selection (Shift: a second), each a step.
const SV = { el: null, cv: null, open: false, id: '', zoom: 60, t0: 0, h: 260, sel: new Set(), drag: null, sig: '', last: 0, hits: [], lanes: [], w: 0, scroll: 0, fit: '', evRef: null };
const SV_G = 150, SV_R = 24, SV_LANE = 30;   // (the labels' gutter, the ruler's height, a lane's: px)
const SV_COL = { show: '#3ee08f', hide: '#ff5a4b', tex: '#ffb43b', seq: '#4f9dff' };
CPK_T.seq = { act: 'i:sqCol', get: it => (it && it.rec.col) || SEQ_COL, ok: it => !!it && it.kind === 'q', preview() { /* its colour shows once it is written */ }, clear() { /* nothing previewed */ } };
const svSnap = (t, free) => (free ? Math.round(t * 100) / 100 : Math.round(t * 10) / 10);
const svQ = () => { const q = STU.items.get(STU.sel); return q && q.kind === 'q' ? q : null; };
const svWant = () => !!svQ() && editOn() && !XR.on && !(GL.renderer && GL.renderer.xr.isPresenting) && APP.mode === 'explore' && !HOST.picking && !VW.open && !GL.gone;
const svX = t => SV_G + (t - SV.t0) * SV.zoom, svT = x => SV.t0 + (x - SV_G) / SV.zoom;

// how long an event's block is (s), where its item's length is known
function svDur(e) {
  const t = STU.items.get(e.on);
  try {
    if (e.what === 'clip' && t && t.E && t.E.clips) { const c = t.E.clips.find(k => k.name === e.clip); if (c && c.duration > 0) return c.duration; }
    if (e.what === 'sound' && t && t.F && t.F.dur > 0) return t.F.dur;
    if (e.what === 'path' && t) { const P = pathOf(t); if (P) return pathLen(P) / (P.speed || 1) * (P.play === 'bounce' ? 2 : 1); }
    if (e.what === 'motion' && t && t.rec.motion) return 60 / Math.max(0.1, Math.abs(t.rec.motion.speed || 1));
  } catch (err) { /* length not known */ }
  return 0.6;
}
// the lanes (an item each, in order of first appearance) and each event's block: { i, lane, x0, x1 (s), kind: 'block' | 'loop' | 'stop' | 'dia' }
function svLayout(q) {
  const ev = q.rec.ev, lanes = [], at = new Map();
  ev.forEach(e => { if (!at.has(e.on)) { at.set(e.on, lanes.length); lanes.push(e.on); } });
  const items = ev.map((e, i) => {
    const lane = at.get(e.on), it = { i, e, lane, t: e.t };
    if (SEQ_RUN.includes(e.what) && e.how !== 'stop') {
      it.kind = e.how === 'loop' ? 'loop' : 'block';
      it.t1 = e.how === 'loop' ? (ev.find((o, j) => j > i && o.on === e.on && o.t > e.t && ((o.what === e.what && o.how === 'stop') || o.what === e.what)) || { t: q.rec.len }).t : e.t + svDur(e);
    } else { it.kind = e.what === 'show' || e.what === 'hide' || e.what === 'tex' || e.what === 'seq' ? (e.what === 'seq' && e.how === 'stop' ? 'stop' : 'dia') : 'stop'; it.t1 = e.t; }
    return it;
  });
  return { lanes, items };
}
const svColOf = (q, e) => SV_COL[e.what] || (q.rec.col || SEQ_COL);

// ---------------------------------------------------------------- the panel --
function svBuild() {
  const el = SV.el = document.createElement('div');
  el.id = 'stuSeq'; el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Sequence lanes');
  el.innerHTML = `<style>
    #stuSeq { position: fixed; left: 0; bottom: 0; z-index: 12; background: rgba(8, 14, 26, 0.97); border-top: 1px solid rgba(149, 166, 189, 0.4); color: #e7eef8; font: 13px/1.3 B612, "Segoe UI", Arial, sans-serif; display: flex; flex-direction: column; outline: none; }
    #stuSeq .sv-edge { position: absolute; left: 0; right: 0; top: -4px; height: 8px; cursor: ns-resize; touch-action: none; }
    #stuSeq .sv-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding: 6px 10px; }
    #stuSeq .sv-top b { margin-right: 6px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #stuSeq .sv-top span { color: #a9b8cc; font-variant-numeric: tabular-nums; margin: 0 6px; }
    #stuSeq .btn { border: 1px solid rgba(149, 166, 189, 0.4); background: rgba(22, 32, 48, 0.9); color: #e7eef8; border-radius: 6px; padding: 4px 10px; font: inherit; cursor: pointer; }
    #stuSeq .btn:hover { border-color: #a9b8cc; }
    #stuSeq .btn[aria-pressed="true"] { border-color: #46d9ff; color: #46d9ff; }
    #stuSeq .btn[disabled] { opacity: 0.45; cursor: default; }
    #stuSeq canvas { display: block; flex: 1; width: 100%; min-height: 0; touch-action: none; }
  </style>
  <div class="sv-edge" data-a="edge"></div>
  <div class="sv-top"><b data-n></b>
    <button type="button" class="btn" data-a="pv">Play here (preview)</button><button type="button" class="btn" data-a="stop">Stop</button><button type="button" class="btn" data-a="rew">Rewind</button><button type="button" class="btn" data-a="all">Play for everyone</button>
    <span data-time></span><button type="button" class="btn" data-a="zo" aria-label="Zoom out">−</button><button type="button" class="btn" data-a="zi" aria-label="Zoom in">+</button><button type="button" class="btn" data-a="close">Close</button>
  </div><canvas></canvas>`;
  SV.cv = el.querySelector('canvas');
  document.body.appendChild(el);
  el.addEventListener('click', ev => { const a = ev.target.closest && ev.target.closest('[data-a]'); if (a) svAct(a.dataset.a); });
  el.addEventListener('pointerdown', svDown);
  el.addEventListener('dblclick', svDbl);
  el.addEventListener('wheel', svWheel, { passive: false });
  el.addEventListener('keydown', svKey);
  window.addEventListener('pointermove', svMove); window.addEventListener('pointerup', svUp); window.addEventListener('pointercancel', svUp);
}
function svClose() {
  if (SV.el && SV.el.parentNode) SV.el.parentNode.removeChild(SV.el);
  window.removeEventListener('pointermove', svMove); window.removeEventListener('pointerup', svUp); window.removeEventListener('pointercancel', svUp);
  Object.assign(SV, { el: null, cv: null, open: false, id: '', drag: null, sig: '', hits: [], sel: new Set() });
}
function svAct(a) {
  const q = svQ();
  if (!q) return;
  if (a === 'close') { select(''); return; }
  if (a === 'zi') SV.zoom = Math.min(600, SV.zoom * 1.4);
  else if (a === 'zo') SV.zoom = Math.max(4, SV.zoom / 1.4);
  else if (a === 'pv') seqPreviewToggle(q);
  else if (a === 'rew') seqPreview(q, 0, false);
  else if (a === 'stop') { if (STU.qprev && STU.qprev.id === q.id) seqPreview(q, seqPrevU(q), false); else SEQ_ACT.sqStop(); }
  else if (a === 'all') SEQ_ACT.sqPlay();
  SV.sig = ''; dirty();
}
// ------------------------------------------------------------------ pointer --
const svPos = ev => { const r = SV.cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
const svHit = (x, y) => { for (let k = SV.hits.length - 1; k >= 0; k--) { const h = SV.hits[k]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h; } return null; };
function svDown(ev) {
  const q = svQ();
  if (!q) return;
  if (ev.target.closest('[data-a="edge"]')) { SV.drag = { k: 'edge', y: ev.clientY, h: SV.h }; ev.preventDefault(); return; }
  if (ev.target !== SV.cv) return;
  SV.el.focus({ preventScroll: true });
  const [x, y] = svPos(ev);
  if (y < SV_R && x >= SV_G) { SV.drag = { k: 'scrub' }; seqPreview(q, Math.min(q.rec.len, Math.max(0, svSnap(svT(x), ev.shiftKey))), false); SV.sig = ''; ev.preventDefault(); return; }
  const h = svHit(x, y);
  if (h) {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { if (SV.sel.has(h.i)) SV.sel.delete(h.i); else SV.sel.add(h.i); }
    else if (!SV.sel.has(h.i)) SV.sel = new Set([h.i]);
    STU.qsel = h.i;
    SV.drag = { k: 'ev', x, dt: 0, moved: false, alt: ev.altKey, free: ev.shiftKey, ids: [...SV.sel], i: h.i };
    try { SV.cv.setPointerCapture(ev.pointerId); } catch (e) { /* nothing to capture */ }
  } else {
    if (!(ev.ctrlKey || ev.metaKey || ev.shiftKey)) SV.sel = new Set();
    SV.drag = { k: 'box', x, y, x1: x, y1: y };
  }
  SV.sig = ''; dirty();
  ev.preventDefault();
}
function svMove(ev) {
  const d = SV.drag, q = svQ();
  if (!d || !q || !SV.cv) return;
  if (d.k === 'edge') { SV.h = Math.max(160, Math.min(480, d.h + (d.y - ev.clientY))); SV.sig = ''; return; }
  const [x, y] = svPos(ev);
  if (d.k === 'scrub') { seqPreview(q, Math.min(q.rec.len, Math.max(0, svSnap(svT(x), ev.shiftKey))), false); SV.sig = ''; }
  else if (d.k === 'ev') {
    d.free = ev.shiftKey; d.alt = ev.altKey;
    if (Math.abs(x - d.x) > 3) d.moved = true;
    if (d.moved) { d.dt = svDtFor(q, d.ids, (x - d.x) / SV.zoom, d.free); SV.sig = ''; }
  } else if (d.k === 'box') { d.x1 = x; d.y1 = y; SV.sig = ''; }
}
// a drag's offset (s), snapped, held so that no moved event leaves 0 to the sequence's length
function svDtFor(q, ids, dt, free) {
  ids = ids.filter(i => q.rec.ev[i]);
  if (!ids.length) return 0;
  const ts = ids.map(i => q.rec.ev[i].t), lo = -Math.min(...ts), hi = q.rec.len - Math.max(...ts);
  return svSnap(Math.max(lo, Math.min(Math.max(lo, hi), dt)), free);
}
function svUp() {
  const d = SV.drag, q = svQ();
  SV.drag = null;
  if (!d || !q) return;
  if (d.k === 'ev') { if (d.moved && d.dt) svCommit(q, d.ids, d.dt, d.alt); else seqPreview(q, Math.min(q.rec.len, q.rec.ev[d.i] ? q.rec.ev[d.i].t : 0), false); }
  else if (d.k === 'box') {
    const x0 = Math.min(d.x, d.x1), x1 = Math.max(d.x, d.x1), y0 = Math.min(d.y, d.y1), y1 = Math.max(d.y, d.y1);
    if (x1 - x0 > 3 || y1 - y0 > 3) for (const h of SV.hits) if (h.x1 >= x0 && h.x0 <= x1 && h.y1 >= y0 && h.y0 <= y1) SV.sel.add(h.i);
  }
  SV.sig = ''; dirty();
}
// the events moved by dt (or copied, Alt): one change, one Undo step; the selection follows them in the new order
function svCommit(q, ids, dt, copy) {
  if (q.rec.locked) return false;
  ids = ids.filter(i => q.rec.ev[i]);
  if (!ids.length) return false;
  const set = new Set(ids), rows = q.rec.ev.map((e, i) => ({ e: set.has(i) && !copy ? Object.assign({}, e, { t: r2(Math.min(600, Math.max(0, e.t + dt))) }) : e, moved: set.has(i) && !copy }));
  if (copy) for (const i of ids) rows.push({ e: Object.assign({}, q.rec.ev[i], { t: r2(Math.min(600, Math.max(0, q.rec.ev[i].t + dt))) }), moved: true });
  if (rows.length > SEQ_EV_MAX || (copy && seqEvCount() + ids.length > SEQ_EV_SCENE)) return false;
  rows.forEach((x, i) => { x.i = i; });
  rows.sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  change(() => setRec(q.id, { ev: rows.map(x => x.e) }));
  SV.evRef = q.rec.ev;
  SV.sel = new Set(rows.map((x, j) => (x.moved ? j : -1)).filter(j => j >= 0));
  STU.qsel = SV.sel.size ? [...SV.sel][0] : -1;
  SV.sig = '';
  return true;
}
// for tests: what a drag of event i by dt seconds does (selecting it unless it is in the selection): one step
function seqViewDrag(i, dt, copy) {
  const q = svQ();
  if (!q || !q.rec.ev[i]) return false;
  if (!SV.sel.has(i)) SV.sel = new Set([i]);
  const ids = [...SV.sel], d = svDtFor(q, ids, dt, false);
  return d ? svCommit(q, ids, d, !!copy) : false;
}
function svDbl(ev) {
  const q = svQ();
  if (!q || ev.target !== SV.cv) return;
  const [x, y] = svPos(ev), h = svHit(x, y);
  if (h) { STU.qsel = h.i; SV.sel = new Set([h.i]); X.tab = 'item'; dirty(true); const b = document.getElementById('sqe:' + h.i) || document.querySelector(`[data-id="sqe:${h.i}"]`); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'center' }); return; }
  const lane = Math.floor((y - SV_R) / SV_LANE), item = SV.lanes[lane], t = svSnap(Math.max(0, Math.min(q.rec.len, svT(x))), ev.shiftKey);
  if (!item || x < SV_G) return;
  // (Add an event for that lane's item at that time)
  STU.plp = null;
  itemAct('sqPick', null, q.id);
  if (STU.plp && STU.plp.seq) { itemAct('sqOn', item, q.id); if (STU.plp) STU.plp.at = t; }
  X.tab = 'item'; dirty(true);
}
function svWheel(ev) {
  const q = svQ();
  if (!q || ev.target !== SV.cv) return;
  ev.preventDefault();
  if (ev.ctrlKey) { SV.t0 = Math.max(-1, SV.t0 + ev.deltaY / SV.zoom); SV.sig = ''; return; }
  const [x] = svPos(ev), tc = svT(x), z = Math.max(4, Math.min(600, SV.zoom * Math.exp(-ev.deltaY * 0.0015)));
  SV.zoom = z; SV.t0 = tc - (x - SV_G) / z; SV.sig = '';
}
function svKey(ev) {
  const q = svQ();
  if (!q || !editOn()) return;
  const k = ev.key.toLowerCase();
  if (k === ' ') { seqPreviewToggle(q); ev.preventDefault(); }
  else if (k === 'home') { seqPreview(q, 0, false); ev.preventDefault(); }
  else if ((k === 'delete' || k === 'backspace') && SV.sel.size && !q.rec.locked) {
    const set = SV.sel; SV.sel = new Set();
    change(() => setRec(q.id, { ev: q.rec.ev.filter((e, i) => !set.has(i)) }));
    SV.evRef = q.rec.ev;
    STU.qsel = -1; ev.preventDefault();
  } else if ((k === 'arrowleft' || k === 'arrowright') && SV.sel.size && !q.rec.locked) {
    const dt = svDtFor(q, [...SV.sel], (k === 'arrowleft' ? -1 : 1) * (ev.shiftKey ? 1 : 0.1), true);
    if (dt) svCommit(q, [...SV.sel], dt, false);
    ev.preventDefault();
  } else {
    // the studio's own keys (delete, d, w, e, r, p...) never reach the scene while this view has focus; Ctrl+Z and Escape do
    if (!(ev.ctrlKey || ev.metaKey || k === 'escape')) ev.stopPropagation();
    return;
  }
  ev.stopPropagation();
  SV.sig = '';
}

// -------------------------------------------------------------------- drawing --
function svStep(now) {
  const want = svWant();
  if (!want) { if (SV.open) svClose(); return; }
  const q = svQ();
  if (!SV.open) { svBuild(); SV.open = true; SV.id = ''; }
  if (SV.id !== q.id) { SV.id = q.id; SV.sel = new Set(); SV.t0 = 0; SV.fit = ''; SV.evRef = q.rec.ev; }
  // events changed elsewhere (✕ on the card, Undo, another device, a re-sort): the indices no longer mean the same events
  if (SV.evRef !== q.rec.ev) { SV.evRef = q.rec.ev; if (SV.sel.size) { SV.sel = new Set(); SV.drag = null; } }
  // (docked beside the side panel, on the side it is not: its parent's edge)
  const ex = document.getElementById('explore'), pr = ex && ex.parentElement && window.innerWidth > 900 ? ex.parentElement.getBoundingClientRect() : null;
  let left = 0, right = 0;
  if (pr && pr.width > 0 && pr.height > 0) { if (pr.left + pr.width / 2 < window.innerWidth / 2) left = Math.max(0, Math.ceil(pr.right)); else right = Math.max(0, window.innerWidth - Math.floor(pr.left)); }
  const w = Math.max(200, window.innerWidth - left - right), st = SV.el.style;
  if (st.left !== left + 'px') st.left = left + 'px';
  if (st.width !== w + 'px') st.width = w + 'px';
  if (st.height !== SV.h + 'px') st.height = SV.h + 'px';
  const cw = SV.cv.clientWidth, ch = SV.cv.clientHeight;
  if (cw < 10 || ch < 10) return;
  if (SV.fit !== q.id) { SV.fit = q.id; SV.zoom = Math.max(4, (cw - SV_G - 24) / Math.max(0.5, q.rec.len)); SV.t0 = 0; }
  const P = seqEff(q), U = seqU(q, P, behNow()), u = U ? U.u : 0, pv = STU.qprev && STU.qprev.id === q.id;
  const D = SV.drag && SV.drag.k === 'ev' && SV.drag.moved ? SV.drag : null, B = SV.drag && SV.drag.k === 'box' ? SV.drag : null;
  const sig = [STU.rev, SV.zoom, SV.t0, SV.h, cw, ch, [...SV.sel].join(), D ? D.dt : '', B ? B.x1 + ',' + B.y1 : '', U && U.playing ? Math.round(u * 30) : u.toFixed(2), pv, U && U.playing, STU.qsel, q.rec.locked].join('|');
  if (sig === SV.sig || (U && U.playing && now - SV.last < 33)) { svTop(q, u, U, pv); return; }
  SV.sig = sig; SV.last = now;
  svTop(q, u, U, pv);
  svDraw(q, u, U, cw, ch, D, B);
}
function svTop(q, u, U, pv) {
  const e = SV.el, set = (s, v) => { const n = e.querySelector(s); if (n && n.textContent !== v) n.textContent = v; };
  set('[data-n]', q.rec.name); set('[data-time]', `${u.toFixed(2)} / ${q.rec.len.toFixed(2)} s`);
  const pb = e.querySelector('[data-a="pv"]'), txt = pv && STU.qprev.on ? 'Pause preview' : 'Play here (preview)';
  if (pb && pb.textContent !== txt) pb.textContent = txt;
  if (pb) pb.setAttribute('aria-pressed', String(!!(pv && STU.qprev.on)));
  const al = e.querySelector('[data-a="all"]'), lab = q.rec.sync === 'own' ? 'Play' : 'Play for everyone';
  if (al && al.textContent !== lab) al.textContent = lab;
  for (const a of ['stop', 'rew', 'all']) { const b = e.querySelector(`[data-a="${a}"]`); if (b) b.disabled = !seqCan(); }
}
function svDraw(q, u, U, cw, ch, D, B) {
  const cv = SV.cv, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const c = cv.getContext('2d'), L = svLayout(q);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
  c.font = '12px B612, "Segoe UI", Arial, sans-serif'; c.textBaseline = 'middle';
  SV.lanes = L.lanes; SV.hits = [];
  const len = q.rec.len, endX = svX(len), tcol = seqCol(q.rec);
  // (past the sequence's length: dimmed)
  c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(Math.max(SV_G, endX), SV_R, Math.max(0, cw - Math.max(SV_G, endX)), ch - SV_R);
  // ruler
  c.fillStyle = 'rgba(22,32,48,0.95)'; c.fillRect(0, 0, cw, SV_R);
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60], st = steps.find(s => s * SV.zoom >= 56) || 60;
  c.strokeStyle = 'rgba(149,166,189,0.35)'; c.fillStyle = '#a9b8cc'; c.lineWidth = 1;
  for (let t = Math.ceil(Math.max(SV.t0, 0) / st) * st; svX(t) < cw; t += st) {
    const x = Math.round(svX(t)) + 0.5;
    if (x < SV_G) continue;
    c.beginPath(); c.moveTo(x, SV_R - 8); c.lineTo(x, ch); c.stroke(); c.fillText((Math.round(t * 100) / 100) + ' s', x + 3, 10);
  }
  c.fillStyle = tcol; c.fillRect(Math.max(SV_G, svX(0)) - 1, 0, 2, SV_R); c.fillRect(endX - 1, 0, 2, SV_R);
  // lanes: a label each (its kind's letter, its name), the blocks
  L.lanes.forEach((id, k) => {
    const y = SV_R + k * SV_LANE, t = STU.items.get(id);
    if (y > ch) return;
    c.fillStyle = k % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.05)'; c.fillRect(0, y, cw, SV_LANE);
    c.fillStyle = t ? '#e7eef8' : '#ff7a6e'; c.textAlign = 'left';
    const nm = (t ? '▪ ' + t.rec.name : 'not in the scene'), fit = s => { while (s.length > 3 && c.measureText(s).width > SV_G - 14) s = s.slice(0, -2); return s; };
    c.fillText(fit(nm.length > 20 ? nm.slice(0, 19) + '…' : nm), 8, y + SV_LANE / 2);
  });
  c.save(); c.beginPath(); c.rect(SV_G, SV_R, cw - SV_G, ch - SV_R); c.clip();
  for (const it of L.items) {
    const moved = D && D.ids.includes(it.i), off = moved ? D.dt : 0, copyGhost = moved && D.alt, y = SV_R + it.lane * SV_LANE, e = it.e, col = svColOf(q, e), sel = SV.sel.has(it.i) || STU.qsel === it.i;
    const draw = (dt, ghost) => {
      const x0 = svX(it.t + dt), x1 = svX(it.t1 + dt), past = it.t + dt > len;
      c.globalAlpha = (past ? 0.4 : 1) * (ghost ? 0.5 : 1);
      if (it.kind === 'dia') {
        const m = y + SV_LANE / 2; c.beginPath(); c.moveTo(x0, m - 9); c.lineTo(x0 + 9, m); c.lineTo(x0, m + 9); c.lineTo(x0 - 9, m); c.closePath(); c.fillStyle = col; c.fill();
        if (sel && !ghost) { c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
      } else if (it.kind === 'stop') {
        c.fillStyle = col; c.fillRect(x0 - 6, y + SV_LANE / 2 - 6, 12, 12);
        if (sel && !ghost) { c.lineWidth = 2; c.strokeStyle = '#fff'; c.strokeRect(x0 - 6, y + SV_LANE / 2 - 6, 12, 12); }
      } else {
        const w = Math.max(10, x1 - x0);
        c.fillStyle = col; c.globalAlpha *= 0.85; c.fillRect(x0, y + 5, w, SV_LANE - 10); c.globalAlpha = (past ? 0.4 : 1) * (ghost ? 0.5 : 1);
        if (sel && !ghost) { c.lineWidth = 2; c.strokeStyle = '#fff'; c.strokeRect(x0, y + 5, w, SV_LANE - 10); }
        c.fillStyle = '#04101c'; c.textAlign = 'left';
        const lab = (it.kind === 'loop' ? '↻ ' : '') + (e.what === 'clip' ? e.clip : e.what) + (e.how === 'hold' ? ' ⏸' : '');
        if (w > 30) c.fillText(lab.slice(0, Math.max(1, Math.floor((w - 6) / 7))), x0 + 4, y + SV_LANE / 2);
      }
      c.globalAlpha = 1;
    };
    if (copyGhost) draw(0, true);
    draw(off, false);
    const x0 = svX(it.t + off), x1 = it.kind === 'dia' || it.kind === 'stop' ? x0 + 9 : Math.max(x0 + 10, svX(it.t1 + off));
    SV.hits.push({ i: it.i, x0: it.kind === 'dia' || it.kind === 'stop' ? x0 - 9 : x0, x1, y0: y + 2, y1: y + SV_LANE - 2 });
  }
  if (B) { c.strokeStyle = '#46d9ff'; c.lineWidth = 1; c.setLineDash([4, 3]); c.strokeRect(Math.min(B.x, B.x1) + 0.5, Math.min(B.y, B.y1) + 0.5, Math.abs(B.x1 - B.x), Math.abs(B.y1 - B.y)); c.setLineDash([]); }
  c.restore();
  // (the playhead)
  const px = svX(u);
  if (px >= SV_G - 2 && px <= cw) { c.fillStyle = '#ffffff'; c.fillRect(px - 1, 0, 2, ch); c.beginPath(); c.moveTo(px - 6, 0); c.lineTo(px + 6, 0); c.lineTo(px, 9); c.closePath(); c.fill(); }
  if (!L.lanes.length) { c.fillStyle = '#a9b8cc'; c.textAlign = 'left'; c.fillText('No events yet: double-click here after Add an event... on its card, or press Add an event... below.', SV_G + 12, SV_R + 24); }
  c.textAlign = 'left';
}
const seqViewState = () => ({ open: SV.open, id: SV.id, zoom: SV.zoom, t0: SV.t0, sel: [...SV.sel], h: SV.h, hits: SV.hits.map(h => Object.assign({}, h)), lanes: SV.lanes.slice(), rect: SV.cv ? [SV.cv.clientWidth, SV.cv.clientHeight] : null, g: SV_G, dom: !!SV.el });

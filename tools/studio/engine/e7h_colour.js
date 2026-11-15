// ---- the shared colour picker (v146; the owner, 15 November 2026): one picker for an object's tint, a shape's colour and
// the paint colour. A page gets a popover (a hue ring, a saturation and brightness square, the hex, the ten swatches and
// the colours used lately); a headset gets the same as a block of the card, dragged with the trigger. What it shows is
// previewed on the item on this device only and written when let go (one Undo step, through the card's own actions, so
// records stay '#rrggbb' lower case and nothing about them changed). Another lane may add a target to CPK_T
// ({ act, get(it), preview(it, hex), clear(it) }) and call cpkOpen(tgt, id, where)
// one picker open at a time, page or headset: its target, the colour as it stands (hsv, so a grey keeps its hue while
// dragged), the colour it opened with and the one last written, and whether a drag is under way
const CPK = { open: null, h: 0, s: 0, v: 1, exact: '', from: '', orig: '', drag: '', live: '', pend: '', seen: null, kt: 0, commits: 0, previews: 0, patches: 0 };
const CPK_KEY = 'studioColours', CPK_MAX = 8;
const CPKX = { h: 420, rc: null, rings: new Map(), el: null, opener: null, reveal: false, raf: 0, dr: null };
const CPK_T = {
  tint: {
    act: 'i:tint',
    get: it => { const os = tintOf(it); if (!os.length) return null; const v = os.map(o => o.rec.tint || ''); return v.every(x => x === v[0]) ? v[0] : null; },
    ok: it => !!it && (it.kind === 'o' || it.kind === 'g') && tintOf(it).length > 0,
    preview(it, hex) { for (const o of tintOf(it)) if (o.model) for (const m of o.model.meshes) for (const key of ['lit', 'scan']) for (const mat of [].concat(m.userData[key] || [])) tintMat(mat, Object.assign({}, o.rec, { tint: hex })); },
    clear(it) { if (it) for (const o of tintOf(it)) applyTint(o); },
  },
  shape: {
    act: 'i:colour',
    get: it => it.rec.colour,
    ok: it => !!it && it.kind === 'p',
    preview(it, hex) { it.look.set(Object.assign({}, it.rec, { colour: hex })); },
    clear(it) { if (it && it.look) it.look.set(it.rec); },
  },
  paint: {
    act: 'pnColour',
    get: () => PAINT.colour,
    ok: () => !!PAINT.on,
    preview(_, hex) { CPK.live = hex; if (PNV.tip) PNV.tip.material.color.set(hex); },
    clear() { CPK.live = ''; if (PNV.tip) PNV.tip.material.color.set(PAINT.colour); },
  },
};
// ---- the maths (no THREE)
const cpkNorm = t => {
  t = String(t).trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(t)) t = t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
  return /^[0-9a-f]{6}$/.test(t) ? '#' + t : '';
};
const hexOk = t => !!cpkNorm(t);
function hsv2hex(h, s, v) {
  h = (((h % 1) + 1) % 1) * 6;
  const i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return '#' + c.map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function hex2hsv(hex) {
  const n = parseInt(cpkNorm(hex).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = CPK.h;   // (a grey keeps the hue it had)
  if (d > 0) { h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, mx ? d / mx : 0, mx];
}
const cpkNow = () => CPK.exact || hsv2hex(CPK.h, CPK.s, CPK.v);
const cpkItem = () => (CPK.open && CPK.open.id ? STU.items.get(CPK.open.id) : null);
const cpkValid = () => { const o = CPK.open; if (!o) return false; const T = CPK_T[o.tgt]; return !!T && (o.tgt === 'paint' ? T.ok() : editOn() && T.ok(cpkItem())); };
const cpkPaintColour = () => CPK.live || PAINT.colour;
// ---- recent colours: this device's own, one list for all three, newest first
function cpkRecents() {
  if (CPKX.rc) return CPKX.rc;
  let a = [];
  try { a = JSON.parse(store.get(CPK_KEY) || '[]'); } catch (e) { a = []; }
  return (CPKX.rc = (Array.isArray(a) ? a : []).map(x => (typeof x === 'string' ? cpkNorm(x) : '')).filter(Boolean).slice(0, CPK_MAX));
}
function cpkRecent(hex) {
  CPKX.rc = [hex].concat(cpkRecents().filter(x => x !== hex)).slice(0, CPK_MAX);
  store.set(CPK_KEY, JSON.stringify(CPKX.rc));
}
const cpkSig = () => (CPK.open ? [CPK.open.tgt, CPK.open.id, CPK.open.where, CPK.from, cpkRecents().join('')].join() : '');
// ---- the life cycle
function cpkOpen(tgt, id, where) {
  if (!CPK_T[tgt]) return false;
  if (CPK.open) cpkCancel();
  CPKX.rc = null;
  CPK.open = { tgt, id: id || '', where };
  if (!cpkValid()) { CPK.open = null; return false; }
  const T = CPK_T[tgt], v = T.get(cpkItem());
  CPK.from = CPK.orig = v;
  const [h, s, b] = hex2hsv(v || '#ffffff');
  CPK.h = h; CPK.s = s; CPK.v = b; CPK.exact = v || '#ffffff'; CPK.drag = ''; CPK.pend = ''; CPK.seen = null;
  return true;
}
function cpkSet(h, s, v) { CPK.h = ((h % 1) + 1) % 1; CPK.s = clamp(s, 0, 1); CPK.v = clamp(v, 0, 1); CPK.exact = ''; }
function cpkHex(hex) { const [h, s, v] = hex2hsv(hex); CPK.h = h; CPK.s = s; CPK.v = v; CPK.exact = hex; }
// nothing written, nothing sent: the item shows the colour on this device alone
function cpkPreview() {
  if (!CPK.open) return;
  if (!cpkValid()) { cpkCancel(); return; }
  const hex = cpkNow();
  CPK_T[CPK.open.tgt].preview(cpkItem(), hex);
  CPK.pend = hex; CPK.previews++; CPK.seen = null;
}
// let go: the colour is written by the card's own action (one Undo step; paint's colour is a tool setting, none)
function cpkCommit(val) {
  const o = CPK.open;
  if (!o) return;
  const T = CPK_T[o.tgt];
  CPK.pend = ''; CPK.seen = null;
  try { T.clear(cpkItem()); } catch (e) { /* the item has gone */ }
  if (val === T.get(cpkItem()) || !cpkValid()) { cpkPageSync(); return; }
  CPK.from = val;
  act(T.act, val);
  CPK.commits++;
  if (val) cpkRecent(val);
  cpkPageSync(); cpkPageRecents();
}
function cpkFlush() {
  if (CPK.kt) { clearTimeout(CPK.kt); CPK.kt = 0; }
  if (CPK.open && CPK.pend && !CPK.drag) cpkCommit(cpkNow());
}
function cpkCancel() {
  const o = CPK.open;
  if (!o) return;
  try { CPK_T[o.tgt].clear(cpkItem()); } catch (e) { /* the item has gone */ }
  CPK.live = ''; CPK.pend = ''; CPK.drag = ''; CPK.open = null; CPK.seen = null;
  if (CPK.kt) { clearTimeout(CPK.kt); CPK.kt = 0; }
  cpkPageHide();
}
// every frame (after itemsStep): a preview shown again if the record or the model was made again under it; a headset
// picker whose session ended or whose controller went commits what was shown
function cpkStep() {
  const o = CPK.open;
  if (!o) return;
  if (!cpkValid()) { cpkCancel(); return; }
  if (o.where === 'xr') {
    if (!XR.on) { if (CPK.drag) cpkXrEnd(); else cpkCancel(); return; }
    if (CPK.drag && !XR.ctrls.some(c => c.press && c.press.r && c.press.r.end)) { cpkXrEnd(); return; }
  }
  if (CPK.pend) {
    const it = cpkItem(), s = CPK.seen;
    if (!s || s[0] !== (it && it.rec) || s[1] !== (it && it.model) || s[2] !== CPK.pend) { CPK_T[o.tgt].preview(it, CPK.pend); CPK.seen = [it && it.rec, it && it.model, CPK.pend]; }
  }
}
const CPK_ACT = {
  // the headset card's *Any colour...*: opens the picker as a block of the card, or closes it
  cpkOpen: tgt => {
    if (CPK.open && CPK.open.where === 'xr' && CPK.open.tgt === tgt) { cpkCancel(); return; }
    if (cpkOpen(tgt, tgt === 'paint' ? '' : STU.sel, 'xr')) CPKX.reveal = true;
  },
  cpkDone: () => cpkCancel(),
};
// ---- the page's popover
function cpkPageOpen(btn) {
  const tgt = btn.dataset.cpk;
  if (CPK.open && CPK.open.where === 'page' && CPK.open.tgt === tgt) { cpkFlush(); cpkCancel(); return; }
  if (!cpkOpen(tgt, tgt === 'paint' ? '' : STU.sel, 'page')) return;
  cpkBuild();
  CPKX.opener = btn;
  cpkPageShow();
}
function cpkBuild() {
  if (CPKX.el) return;
  const el = CPKX.el = document.createElement('div');
  el.id = 'stuCpk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Pick a colour'); el.hidden = true;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  el.innerHTML = `<canvas class="cpk-wheel" width="${Math.round(240 * dpr)}" height="${Math.round(240 * dpr)}" tabindex="0" aria-label="Hue and shade: arrow keys" style="width:240px;height:240px"></canvas>` +
    `<div class="cpk-row"><span class="cpk-new" title="The colour now"></span><button type="button" class="cpk-old" title="Back to the colour it opened with" aria-label="Back to the colour it opened with"></button>` +
    `<input id="stuCpkHex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex colour"></div>` +
    `<div class="cpk-sw">${SHAPE_COLS.map(([c, n]) => `<button type="button" data-hex="${c}" style="background:${c}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('')}</div>` +
    `<div class="cpk-rc"></div><div class="cpk-foot"><button type="button" class="btn primary cpk-done">Done</button></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), hex = el.querySelector('#stuCpkHex');
  const pos = ev => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * 240 / r.width, (ev.clientY - r.top) * 240 / r.height]; };
  const from = (part, x, y) => {
    if (part === 'ring') { let h = Math.atan2(y - 120, x - 120) / (2 * Math.PI); if (CPK.s < 0.1) CPK.s = 1; if (CPK.v < 0.1) CPK.v = 0.8; cpkSet(h, CPK.s, CPK.v); }
    else cpkSet(CPK.h, (x - 60) / 120, 1 - (y - 60) / 120);
    cpkPreview(); cpkPageSync();
  };
  cv.addEventListener('pointerdown', ev => {
    if (!CPK.open || ev.button) return;
    const [x, y] = pos(ev), d = Math.hypot(x - 120, y - 120), sq = Math.abs(x - 120) <= 60 && Math.abs(y - 120) <= 60;
    const part = sq ? 'sq' : d >= 92 && d <= 116 ? 'ring' : '';
    if (!part) return;
    ev.preventDefault(); cv.focus();
    if (CPK.kt) { clearTimeout(CPK.kt); CPK.kt = 0; }
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable */ }
    CPK.drag = part; from(part, x, y);
  });
  cv.addEventListener('pointermove', ev => {
    if (!CPK.drag || !CPK.open) return;
    const [x, y] = pos(ev); CPKX.dr = [CPK.drag, x, y];
    if (!CPKX.raf) CPKX.raf = requestAnimationFrame(() => { CPKX.raf = 0; const d = CPKX.dr; if (d && CPK.drag) from(d[0], d[1], d[2]); });
  });
  const up = ev => {
    if (!CPK.drag) return;
    const [x, y] = pos(ev);
    if (ev.type === 'pointerup') from(CPK.drag, x, y);
    CPK.drag = ''; CPKX.dr = null;
    cpkCommit(cpkNow());
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('keydown', ev => {
    const sh = ev.shiftKey ? 10 : 1;
    let ok = true;
    if (ev.key === 'ArrowLeft') cpkSet(CPK.h - sh / 360, CPK.s, CPK.v);
    else if (ev.key === 'ArrowRight') cpkSet(CPK.h + sh / 360, CPK.s, CPK.v);
    else if (ev.key === 'ArrowUp') cpkSet(CPK.h, CPK.s, CPK.v + sh / 100);
    else if (ev.key === 'ArrowDown') cpkSet(CPK.h, CPK.s, CPK.v - sh / 100);
    else if (ev.key === 'PageUp') cpkSet(CPK.h, CPK.s + 0.05, CPK.v);
    else if (ev.key === 'PageDown') cpkSet(CPK.h, CPK.s - 0.05, CPK.v);
    else ok = false;
    if (!ok) return;
    ev.preventDefault(); cpkPreview(); cpkPageSync();
    if (CPK.kt) clearTimeout(CPK.kt);
    CPK.kt = setTimeout(() => { CPK.kt = 0; if (CPK.open && CPK.pend) cpkCommit(cpkNow()); }, 400);
  });
  cv.addEventListener('blur', () => { if (CPK.kt) cpkFlush(); });
  hex.addEventListener('input', () => {
    const h = cpkNorm(hex.value);
    hex.setAttribute('aria-invalid', h || !hex.value ? 'false' : 'true');
    hex.style.outline = h ? '' : '2px solid var(--amber)';
    if (h) { cpkHex(h); cpkPreview(); cpkPageSync('hex'); }
  });
  hex.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const h = cpkNorm(hex.value); if (h) { cpkHex(h); cpkCommit(h); } } });
  hex.addEventListener('change', () => { const h = cpkNorm(hex.value); if (h) { cpkHex(h); cpkCommit(h); } else { cpkPageSync(); } });
  hex.addEventListener('blur', () => { if (!cpkNorm(hex.value)) cpkPageSync(); });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b || !CPK.open) return;
    if (b.dataset.hex) { cpkHex(b.dataset.hex); cpkCommit(b.dataset.hex); }
    else if (b.classList.contains('cpk-old')) { if (CPK.orig !== null) { cpkHex(CPK.orig || '#ffffff'); cpkCommit(CPK.orig); } }
    else if (b.classList.contains('cpk-done')) { cpkFlush(); cpkCancel(); }
  });
  el.addEventListener('keydown', ev => { ev.stopPropagation(); });   // (the studio's own keys never see a key typed here)
}
const cpkDocKey = ev => { if (ev.key === 'Escape' && CPK.open && CPK.open.where === 'page') { ev.stopPropagation(); ev.preventDefault(); cpkCancel(); } };
const cpkDocDown = ev => {
  if (!CPK.open || CPK.open.where !== 'page') return;
  const t = ev.target;
  if (t && t.closest && (t.closest('#stuCpk') || t.closest('[data-cpk]'))) return;
  cpkFlush(); cpkCancel();
};
function cpkPageShow() {
  const el = CPKX.el, b = CPKX.opener;
  el.hidden = false;
  document.addEventListener('keydown', cpkDocKey, true);
  document.addEventListener('pointerdown', cpkDocDown, true);
  const r = b.getBoundingClientRect(), w = 280, h = el.offsetHeight, W = window.innerWidth, H = window.innerHeight;
  let left = W <= 420 ? (W - w) / 2 : Math.min(Math.max(8, r.left), W - w - 8), top = r.bottom + 6;
  if (top + h > H - 8) top = r.top - h - 6;
  el.style.left = Math.max(8, left) + 'px'; el.style.top = Math.max(8, top) + 'px';
  document.querySelectorAll('[data-cpk]').forEach(x => x.setAttribute('aria-expanded', String(!!CPK.open && x.dataset.cpk === CPK.open.tgt)));
  cpkPageSync(); cpkPageRecents();
}
function cpkPageHide() {
  document.removeEventListener('keydown', cpkDocKey, true);
  document.removeEventListener('pointerdown', cpkDocDown, true);
  if (CPKX.el) CPKX.el.hidden = true;
  CPKX.opener = null;
  document.querySelectorAll('[data-cpk]').forEach(x => x.setAttribute('aria-expanded', 'false'));
}
function cpkPageRecents() {
  const el = CPKX.el;
  if (!el) return;
  const r = cpkRecents();
  el.querySelector('.cpk-rc').innerHTML = r.length ? `<span>Recent</span>` + r.map(c => `<button type="button" data-hex="${c}" style="background:${c}" title="${c}" aria-label="Recent colour ${c}"></button>`).join('') : `<span class="faint">No recent colours yet</span>`;
}
// the canvas redrawn (not the pane) when the colour changes; src: the field being typed in keeps its text
function cpkPageSync(src) {
  const el = CPKX.el;
  if (!el || el.hidden || !CPK.open) return;
  const now = cpkNow();
  el.querySelector('.cpk-new').style.background = now;
  const old = el.querySelector('.cpk-old');
  old.style.background = CPK.orig ? CPK.orig : 'transparent'; old.textContent = CPK.orig === null ? 'differ' : CPK.orig === '' ? 'none' : '';
  old.disabled = CPK.orig === null;
  const hex = el.querySelector('#stuCpkHex');
  if (src !== 'hex') { hex.value = now; hex.setAttribute('aria-invalid', 'false'); hex.style.outline = ''; }
  if (!CPKX.raf2) CPKX.raf2 = requestAnimationFrame(() => { CPKX.raf2 = 0; cpkWheel(); });
}
function cpkRing(size, ro, ri) {
  const k = size + ':' + ro + ':' + ri;
  let c = CPKX.rings.get(k);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), m = size / 2, rm = (ro + ri) / 2;
  g.lineWidth = ro - ri;
  for (let i = 0; i < 360; i++) { g.beginPath(); g.arc(m, m, rm, (i - 0.3) / 360 * 2 * Math.PI, (i + 1.3) / 360 * 2 * Math.PI); g.strokeStyle = hsv2hex(i / 360, 1, 1); g.stroke(); }
  CPKX.rings.set(k, c);
  return c;
}
// the square: the hue's full colour, white across, black down
function cpkSquare(g, x, y, side) {
  g.fillStyle = hsv2hex(CPK.h, 1, 1); g.fillRect(x, y, side, side);
  let l = g.createLinearGradient(x, 0, x + side, 0); l.addColorStop(0, '#fff'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(x, y, side, side);
  l = g.createLinearGradient(0, y, 0, y + side); l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(1, '#000'); g.fillStyle = l; g.fillRect(x, y, side, side);
}
function cpkHandle(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(x, y, r + 1.5, 0, 7); g.stroke(); }
function cpkWheel() {
  const el = CPKX.el;
  if (!el || el.hidden) return;
  const cv = el.querySelector('canvas'), k = cv.width / 240, g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 240, 240);
  g.drawImage(cpkRing(Math.round(240 * k), 116 * k, 92 * k), 0, 0, 240, 240);
  cpkSquare(g, 60, 60, 120);
  const a = CPK.h * 2 * Math.PI, now = cpkNow();
  cpkHandle(g, 120 + 104 * Math.cos(a), 120 + 104 * Math.sin(a), 8, hsv2hex(CPK.h, 1, 1));
  cpkHandle(g, 60 + CPK.s * 120, 60 + (1 - CPK.v) * 120, 7, now);
}
// ---- the headset's block (on the card, dragged with the trigger as a timeline's bar is)
const cpkQ = P => cpkNow() + '|' + CPK.drag + '|' + (P && P.hover && String(P.hover).startsWith('cpk:') ? P.hover : '') + '|' + cpkRecents().join('');
const cpkRingXR = () => cpkRing(380, 190, 150);
function drawPicker(ctx, P, b, x, y, W, dry, live, strip) {
  if (dry) return CPKX.h + 14;
  const cx = x + 200, cy = y + 200, now = cpkNow(), a = CPK.h * 2 * Math.PI, add = r => { if (live && !strip) P.regions.push(r); };
  ctx.drawImage(cpkRingXR(), cx - 190, cy - 190);
  cpkSquare(ctx, cx - 100, cy - 100, 200);
  const hr = P.hover === 'cpk:ring', hs = P.hover === 'cpk:sq';
  cpkHandle(ctx, cx + 170 * Math.cos(a), cy + 170 * Math.sin(a), hr ? 18 : 14, hsv2hex(CPK.h, 1, 1));
  cpkHandle(ctx, cx - 100 + CPK.s * 200, cy - 100 + (1 - CPK.v) * 200, hs ? 18 : 12, now);
  add({ id: 'cpk:ring', x: cx - 190, y: cy - 190, w: 380, h: 380, drag: (px, py) => cpkXrDrag('ring', px, py, cx, cy), end: () => cpkXrEnd() });
  add({ id: 'cpk:sq', x: cx - 100, y: cy - 100, w: 200, h: 200, drag: (px, py) => cpkXrDrag('sq', px, py, cx, cy), end: () => cpkXrEnd() });
  const rx = x + 420, f = live && !strip;
  rr(ctx, rx, y, 120, 60, 8); ctx.fillStyle = now; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,238,248,0.55)'; ctx.stroke();
  const o = CPK.orig;
  vButton(ctx, P, 'cpk:old', rx, y + 66, 120, 36, '', f && o !== null ? () => { cpkHex(o || '#ffffff'); cpkCommit(o); } : null, { r: 8 });
  if (o) { rr(ctx, rx + 4, y + 70, 112, 28, 5); ctx.fillStyle = o; ctx.fill(); }
  else { ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.textBaseline = 'middle'; ctx.fillText(o === null ? 'they differ' : 'none', rx + 12, y + 85); ctx.textBaseline = 'top'; }
  ctx.font = vfont(26, 700); ctx.fillStyle = VC.ink; ctx.fillText(now, rx + 140, y + 16);
  ctx.font = vfont(18); ctx.fillStyle = VC.faint; ctx.fillText('now / opened with', rx + 140, y + 56);
  const sw = (c, px, py, id) => {
    vButton(ctx, P, id, px, py, 48, 48, '', f ? () => { cpkHex(c); cpkCommit(c); } : null, { r: 8, on: c === now });
    swatch(ctx, px + 6, py + 6, 36, c);
  };
  SHAPE_COLS.forEach(([c], i) => sw(c, rx + (i % 5) * 56, y + 116 + Math.floor(i / 5) * 56, 'cpk:sw:' + c));
  const rc = cpkRecents();
  ctx.font = vfont(20, 700); ctx.fillStyle = VC.muted; ctx.fillText(rc.length ? 'Recent' : 'No recent colours yet', rx, y + 234);
  rc.slice(0, 8).forEach((c, i) => sw(c, rx + (i % 4) * 56, y + 262 + Math.floor(i / 4) * 56, 'cpk:rc:' + i));
  vButton(ctx, P, 'cpk:done', rx + 240, y + 362, 200, 48, 'Done', f ? () => cpkCancel() : null, { primary: true, px: 24 });
  if (live && !strip) P.pickers = (P.pickers || []).concat({ x, y, w: W, id: 'cpk', q: cpkQ(P), cx, cy });
  return CPKX.h + 14;
}
// the drag: the part it began on keeps it; a ring starts only on the ring itself, so the square's corners are not it
function cpkXrDrag(part, px, py, cx, cy) {
  if (!CPK.open || CPK.open.where !== 'xr') return;
  if (!CPK.drag) {
    if (part === 'ring') { const d = Math.hypot(px - cx, py - cy); if (d < 140 || d > 220) return; }
    CPK.drag = part;
    if (part === 'ring') { if (CPK.s < 0.1) CPK.s = 1; if (CPK.v < 0.1) CPK.v = 0.8; }
  }
  if (CPK.drag === 'ring') cpkSet(Math.atan2(py - cy, px - cx) / (2 * Math.PI), CPK.s, CPK.v);
  else cpkSet(CPK.h, (px - (cx - 100)) / 200, 1 - (py - (cy - 100)) / 200);
  cpkPreview();
}
// let go (or the controller gone): what was shown is written, one Undo step
function cpkXrEnd() {
  if (!CPK.drag) return;
  CPK.drag = '';
  if (CPK.open) cpkCommit(cpkNow());
}
// every frame the card is not drawn again: the picker's strip redrawn on its own when its colour or what is pointed at
// changed, at most every 50 ms, and sent to the texture alone (a patch of about 430 px tall, never the whole card)
let CPKCV = null;
function pickersTick(P, now) {
  if (now - (P.tk || 0) < 50) return;
  for (const p of P.pickers) {
    const q = cpkQ(P);
    if (q === p.q) continue;
    if (!CPK.open) { P.last = ''; return; }
    P.tk = now; p.q = q;
    const rx = Math.max(0, Math.floor(p.x - 6)), ry = Math.max(0, Math.floor(p.y - 6)), rw = Math.min(P.w - rx, Math.ceil(p.w + 12)), rh = Math.min(P.h - ry, CPKX.h + 12);
    const cv = CPKCV = CPKCV || document.createElement('canvas');
    if (cv.width !== rw || cv.height !== rh) { cv.width = rw; cv.height = rh; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, rw, rh); c.globalAlpha = 1; c.textBaseline = 'top'; c.textAlign = 'left';
    c.fillStyle = XR.clear ? VC.bg : 'rgba(8,15,28,0.97)'; c.fillRect(0, 0, rw, rh);
    c.setTransform(1, 0, 0, 1, -rx, -ry);
    const keep = [P.regions, P.drawn, P.pickers]; P.regions = []; P.drawn = null; P.pickers = [];
    try { drawPicker(c, P, { tgt: CPK.open.tgt }, p.x, p.y, p.w, false, true, true); } finally { [P.regions, P.drawn, P.pickers] = keep; }
    const ctx = P.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(rx, ry, rw, rh); ctx.drawImage(cv, rx, ry); ctx.restore();
    const n0 = P.patched || 0;
    panelPatch(P, cv, rx, ry);
    if ((P.patched || 0) > n0) CPK.patches++;
  }
}
function cpkDispose() {
  cpkCancel();
  document.removeEventListener('keydown', cpkDocKey, true);
  document.removeEventListener('pointerdown', cpkDocDown, true);
  if (CPKX.el) { CPKX.el.remove(); CPKX.el = null; }
}
// for tests: the panel pixel of a part's normalised point in the picker last drawn (the ring at angle u * 2 pi, the square at u, v)
function cpkTestPoint(part, u, v) {
  const p = XR.main && XR.main.pickers && XR.main.pickers[0];
  if (!p) return null;
  if (part === 'ring') { const a = u * 2 * Math.PI; return [p.cx + 170 * Math.cos(a), p.cy + 170 * Math.sin(a)]; }
  return [p.cx - 100 + u * 200, p.cy - 100 + (1 - v) * 200];
}

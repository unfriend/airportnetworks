
// ------------------------------------------------------------ VR panels --
// The HTML side panel can't be shown inside a headset, so it is redrawn on a
// canvas texture. Each draw records clickable regions for the controller ray.
const VC = { bg: 'rgba(8,15,28,0.95)', ink: '#e7eef8', muted: '#95a6bd', faint: '#6c7d94', line: 'rgba(149,166,189,0.22)',
  chip: 'rgba(149,166,189,0.13)', chipHi: 'rgba(149,166,189,0.30)', on: 'rgba(70,217,255,0.20)', cyan: '#46d9ff',
  magenta: '#ff5ad9', amber: '#ffb43b', red: '#ff5a4b', green: '#3ee08f' };
const vfont = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const cssColor = s => { const m = /var\(--(\w+)\)/.exec(s || ''); return m ? VC[m[1]] || VC.ink : s || VC.ink; };
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// draws wrapped text (textBaseline top), returns its height
function textBlock(ctx, text, x, y, maxW, px, lh, color, weight, maxLines) {
  ctx.font = vfont(px, weight);
  ctx.fillStyle = color || VC.ink;
  let L = wrapLines(ctx, text, maxW);
  if (maxLines && L.length > maxLines) { L = L.slice(0, maxLines); L[maxLines - 1] += '…'; }
  L.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
  return L.length * lh;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function vButton(ctx, P, id, x, y, w, h, label, fn, o = {}) {
  const hov = P.hover === id;
  rr(ctx, x, y, w, h, o.r !== undefined ? o.r : 10);
  ctx.fillStyle = o.primary ? (hov ? '#8ce9ff' : VC.cyan) : o.on ? VC.on : hov ? VC.chipHi : VC.chip;
  ctx.fill();
  if (o.on || (hov && !o.primary)) { ctx.lineWidth = 2; ctx.strokeStyle = o.on ? VC.cyan : 'rgba(149,166,189,0.55)'; ctx.stroke(); }
  if (label) {
    ctx.font = vfont(o.px || 25, o.bold || o.on || o.primary ? 700 : 400);
    ctx.fillStyle = o.primary ? '#04131c' : o.color || VC.ink;
    ctx.textBaseline = 'middle';
    if (o.left) ctx.fillText(fitText(ctx, label, w - 28), x + 16, y + h / 2 + 1);
    else { ctx.textAlign = 'center'; ctx.fillText(fitText(ctx, label, w - 16), x + w / 2, y + h / 2 + 1); ctx.textAlign = 'left'; }
    ctx.textBaseline = 'top';
  }
  if (fn) P.regions.push({ id, x, y, w, h, fn });
}
function swatch(ctx, x, y, s, color) { rr(ctx, x, y, s, s, 4); ctx.fillStyle = color; ctx.fill(); }
function makePanel(w, h, mw, draw, sig) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = Math.min(8, GL.renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw * h / w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  mesh.renderOrder = 50;
  mesh.visible = false;
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0 };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// redraw only when what the panel shows has changed (texture uploads are not free)
function panelTick(P, now) {
  const s = P.sig() + '|' + P.hover + '|' + XR.fontOK;
  if (s === P.last || now - P.t < 60) return;
  P.last = s; P.t = now;
  const ctx = P.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, P.w, P.h);
  ctx.globalAlpha = 1; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  P.regions = [];
  rr(ctx, 0, 0, P.w, P.h, 26);
  ctx.fillStyle = XR.clear ? VC.bg : 'rgba(8,15,28,0.97)';
  ctx.fill();
  P.draw(ctx, P);
  P.tex.needsUpdate = true;
}

// ------------------------------------------------------------ main panel --
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode === 'story') {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + audioLabel() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl), X.cmp, X.netX, X.organ, X.u ? X.u.join(',') : '', X.theta, X.group, X.life].join('|');
}
const XR_HERE = 'pet';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status());
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head);
  HOST.list.forEach((s, k) => {
    // cards 0.36 m wide on an arc: seven 0.31 rad apart at 1.25 m (neighbours 0.386 m apart, the outer ones 53° to the
    // side), eight 0.272 rad apart at 1.4 m (0.379 m apart, the outer ones 55° to the side), nine 0.245 rad apart at
    // 1.55 m (0.379 m apart, the outer ones 56° to the side), ten 0.225 rad
    // apart at 1.7 m (0.382 m apart, the outer ones 58° to the side)
    const n = HOST.list.length, a = (k - (n - 1) / 2) * (n > 9 ? 0.225 : n > 8 ? 0.245 : n > 7 ? 0.272 : 0.31), d = n > 9 ? 1.7 : n > 8 ? 1.55 : n > 7 ? 1.4 : 1.25;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.105, -Math.cos(a) * d);   // top edge 0.126 m up, under the header
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P);
  });
  for (const P of XR.land) XR.panels.push(P);
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => (XR.snd.mesh.visible ? 'snd' + Math.floor(performance.now() / 500) : 'off'));
  XR.snd.mesh.position.set(0, -0.17, -1.2);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  // at a shared room's station the story goes on as the room has it: a restart here would restart it for everyone
  if (!XR.inStory && !HOST.collab.mine()) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story') APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
  // anchored: where the place stands, in place of the hint
  const an = HOST.anchor.status();
  textBlock(ctx, an || 'The same ideas, very different networks. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, an ? VC.ink : VC.muted, 400, 2);
  // the sound, before a story starts: its state (press to start it, or to turn the narration off and on) and Sound check
  const sl = audioLabel() || (HOST.audio.muted ? 'Sound off' : 'Sound');
  vButton(ctx, P, 'land:sound', 48, 212, 300, 64, sl, () => audioToggle(), { on: sl === 'Sound on', px: 25 });
  vButton(ctx, P, 'land:check', 362, 212, 250, 64, 'Sound check', () => { XR.soundCheck = !XR.soundCheck; }, { on: !!XR.soundCheck, px: 25 });
  // Anchor: keep the scenes and panels at this spot in the room, for every story (pressing it lit turns it off)
  vButton(ctx, P, 'land:anchor', 626, 212, 200, 64, 'Anchor', () => HOST.anchor.set(!HOST.anchor.on), { on: HOST.anchor.on, px: 25 });
  let x = P.w - 44;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 40, w, 64, label, fn, o); x -= 14; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 110, { px: 27 });
  // anchored, Recenter becomes Place again: everything in front of you, then anchored there
  if (HOST.anchor.on) hb('again', 'Place again', () => { HOST.anchor.again(); XR.needRecenter = true; }, 210, { px: 27 });
  else hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 170, { px: 27 });
  if (XR.inStory) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
  // Repeat: all stories one after another, or the one you pick again and again (pressing a lit one turns it off)
  vButton(ctx, P, 'rep:all', P.w - 44 - 414, 212, 200, 64, 'Repeat all', () => HOST.toggleRepeat('all'), { on: HOST.repeat === 'all', px: 26 });
  vButton(ctx, P, 'rep:one', P.w - 44 - 200, 212, 200, 64, 'Repeat one', () => HOST.toggleRepeat('one'), { on: HOST.repeat === 'one', px: 26 });
}
// Sound check in the headset: test beeps through each engine, the engine choice, and what is going on
function drawSoundCheck(ctx, P) {
  const x = 48, W = P.w - 96;
  ctx.font = vfont(46, 700); ctx.fillStyle = VC.ink; ctx.fillText('Sound check', x, 36);
  vButton(ctx, P, 'snd:close', P.w - 44 - 160, 30, 160, 60, 'Close', () => { XR.soundCheck = false; }, { px: 25 });
  let y = 100 + textBlock(ctx, 'No narration? Press both beeps. If you hear only one, choose that way to play.', x, 100, W, 27, 37, VC.muted, 400, 2) + 14;
  const bw = (W - 16) / 2, cw = (W - 48) / 4, p = HOST.audio.pref;
  vButton(ctx, P, 'snd:beepW', x, y, bw, 70, 'Beep through Web Audio', () => HOST.audio.beep('webaudio'), { px: 26 });
  vButton(ctx, P, 'snd:beepM', x + bw + 16, y, bw, 70, 'Beep through an audio element', () => HOST.audio.beep('media'), { px: 26 });
  y += 86;
  [['auto', 'Automatic'], ['webaudio', 'Web Audio'], ['media', 'Audio element']].forEach(([k, l], i) =>
    vButton(ctx, P, 'snd:' + k, x + i * (cw + 16), y, cw, 62, l, () => HOST.audio.setEngine(k), { on: p === k, px: 24 }));
  vButton(ctx, P, 'snd:reset', x + 3 * (cw + 16), y, cw, 62, 'Reset', () => HOST.audio.reset(), { px: 24 });
  y += 84;
  for (const line of HOST.audio.report()) {
    if (y > P.h - 44) break;
    y += textBlock(ctx, line, x, y, W, 22, 30, VC.muted, 400, 2) + 4;
  }
}
function drawLandCard(ctx, P, s) {
  const here = s.key === XR_HERE, id = 'card', hov = P.hover === id;
  rr(ctx, 8, 8, P.w - 16, P.h - 16, 22);
  ctx.lineWidth = 4; ctx.strokeStyle = hov ? s.col : here && XR.inStory ? 'rgba(70,217,255,0.6)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
  ctx.fillStyle = s.col; ctx.fillRect(8, 8, P.w - 16, 10);
  ctx.font = vfont(28, 700); ctx.fillStyle = s.col; ctx.fillText(s.kick.toUpperCase(), 48, 64);
  ctx.font = vfont(72, 700); ctx.fillStyle = VC.ink; ctx.fillText(s.title, 46, 112);
  textBlock(ctx, s.desc, 48, 222, P.w - 96, 31, 45, VC.muted, 400, 7);
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(s.len, 48, P.h - 196);
  const label = here && XR.inStory ? 'Resume' : 'Start';
  vButton(ctx, P, 'go', 48, P.h - 140, P.w - 96, 92, label, null, { primary: true, px: 34 });
  P.regions.push({ id, x: 0, y: 0, w: P.w, h: P.h, fn: () => (here ? xrLandingClose() : HOST.go(s.key)) });
}
function drawStoriesPane(ctx, P, x, y, W) {
  y += textBlock(ctx, 'Choose a story', x, y, W, 46, 54, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The same ideas, very different networks. Pick one; you stay in the headset view.', x, y, W, 25, 35, VC.muted) + 22;
  // fit the cards above the Back button (the list grew to four)
  const h = Math.min(210, Math.floor((P.h - 96 - y) / XR_STORIES.length) - 18);
  for (const { key: k, kick, title, desc, col } of XR_STORIES) {
    const here = k === XR_HERE;
    vButton(ctx, P, 'story:' + k, x, y, W, h, '', () => { if (here) XR.stories = false; else HOST.go(k); }, { on: here, r: 14 });
    ctx.font = vfont(21, 700); ctx.fillStyle = col; ctx.fillText(kick.toUpperCase(), x + 26, y + 22);
    ctx.font = vfont(38, 700); ctx.fillStyle = VC.ink; ctx.fillText(title, x + 26, y + 54);
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; }
    textBlock(ctx, desc, x + 26, y + 100, W - 52, 24, 33, VC.muted, 400, 2);
    y += h + 18;
  }
  vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  // (Exit is on the shell's Shared panel, at hand on the left controller)
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 140); // anchored: nothing moves
  // at a shared room's station each station keeps its story: another story is another station, so no Stories button
  if (!(HOST.room && HOST.room.placing())) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, 'One scan, one system', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

// story: draw the current chapter straight from its HTML, with the same timing
const STY = {
  H1: { px: 84, lh: 90, w: 700, mb: 22 }, H2: { px: 62, lh: 70, w: 700, mb: 24 },
  p: { px: 35, lh: 50, mb: 20, c: 'ink' }, lede: { px: 39, lh: 52, mb: 24, c: 'muted' }, note: { px: 29, lh: 41, mb: 16, c: 'muted' },
  caption: { px: 25, lh: 34, mb: 12, c: 'muted' }, credits: { px: 24, lh: 34, mb: 12, c: 'muted' }, step: { px: 25, lh: 34, mb: 8, c: 'faint' },
};
function storyOpacity(el) {
  if (!XR.elInfo) { XR.elInfo = new Map(); ST.items.forEach(it => it.els.forEach(e => XR.elInfo.set(e.el, e))); }
  const e = XR.elInfo.get(el);
  return e ? Math.round(Math.max(0, e.o) * 3) / 3 : 1;
}
function drawStoryPane(ctx, P, x, y, W) {
  const it = ST.items.find(i => i.ch === curCh) || ST.items[0];
  for (const el of it.sec.children) y = drawStoryEl(ctx, P, el, x, y, W, 1);
  ctx.globalAlpha = 1;
}
function drawStoryEl(ctx, P, el, x, y, W, pa) {
  const a = pa * storyOpacity(el), tag = el.tagName.toUpperCase(), cl = el.classList;
  ctx.globalAlpha = a;
  let h = 0;
  if (tag === 'SVG') {
    // the title's route arc, drawn as it grows
    const k = 1.5, arc = el.querySelector('#titleArc'), dot = el.querySelector('#titleDot');
    const prog = arc ? clamp(1 - parseFloat(arc.getAttribute('stroke-dashoffset') || '1'), 0, 1) : 1;
    const dA = dot ? parseFloat(dot.getAttribute('opacity') || '0') : 1;
    const p0 = [x + 8 * k, y + 36 * k], c1 = [x + 180 * k, y - 16 * k], p1 = [x + 352 * k, y + 36 * k];
    const bz = (s, j) => (1 - s) * (1 - s) * p0[j] + 2 * (1 - s) * s * c1[j] + s * s * p1[j];
    ctx.strokeStyle = VC.amber; ctx.lineWidth = 3.3; ctx.lineCap = 'round';
    if (prog > 0.002) {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
      for (let n = 1; n <= 48; n++) { const s = prog * n / 48; ctx.lineTo(bz(s, 0), bz(s, 1)); }
      ctx.stroke();
    }
    ctx.fillStyle = VC.amber;
    ctx.beginPath(); ctx.arc(p0[0], p0[1], 4.5 * k, 0, 7); ctx.fill();
    ctx.globalAlpha = a * Math.round(dA * 4) / 4;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], 4.5 * k, 0, 7); ctx.fill();
    h = 44 * k + 8;
  } else if (tag === 'H1' || tag === 'H2') {
    const s = STY[tag];
    h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, VC.ink, s.w) + s.mb;
  } else if (tag === 'P') {
    const btn = el.querySelector('button');
    if (btn) {
      if (a > 0.3) vButton(ctx, P, 'goExplore', x, y, 380, 68, btn.textContent, () => APP.enterExplore(), { primary: true, px: 27 });
      h = 68 + 22;
    } else {
      const s = cl.contains('lede') ? STY.lede : cl.contains('note') ? STY.note : cl.contains('caption') ? STY.caption
        : cl.contains('credits') ? STY.credits : cl.contains('step') ? STY.step : STY.p;
      const col = ['amber', 'magenta', 'green', 'red', 'cyan'].find(c => cl.contains(c));
      h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
    }
  } else if (cl.contains('big')) {
    const col = ['magenta', 'cyan', 'green', 'amber', 'red'].find(c => cl.contains(c));
    const small = el.querySelector('small'), all = el.textContent;
    const main = (small ? all.slice(0, all.length - small.textContent.length) : all).trim();
    ctx.font = vfont(96, 700); ctx.fillStyle = col ? VC[col] : VC.ink;
    ctx.fillText(main, x, y + 2);
    if (small) { const w = ctx.measureText(main).width; ctx.font = vfont(32); ctx.fillStyle = VC.muted; ctx.fillText(small.textContent, x + w + 16, y + 52); }
    h = 112;
  } else if (cl.contains('bars')) {
    const bars = [...el.children], n = bars.length, gap = 8, bw = (W - gap * (n - 1)) / n, top = y + 28, bh = 150;
    bars.forEach((b, k) => {
      const v = b.querySelector('.v'), f = b.querySelector('.fill'), kk = b.querySelector('.k');
      const hp = parseFloat(f.style.height) || 0, m = /scaleY\(([\d.]+)\)/.exec(f.style.transform || '');
      const s = m ? Math.round(parseFloat(m[1]) * 6) / 6 : 1, full = bh * hp / 100, bx = x + k * (bw + gap);
      ctx.fillStyle = cssColor(f.style.background || f.style.backgroundColor);
      if (s > 0) ctx.fillRect(bx, top + bh - full * s, bw, full * s);
      ctx.font = vfont(21); ctx.textAlign = 'center';
      ctx.fillStyle = VC.ink;
      if (v && v.textContent) ctx.fillText(v.textContent, bx + bw / 2, top + bh - full - 24);
      ctx.fillStyle = b.classList.contains('hl') ? VC.ink : VC.muted;
      if (kk) ctx.fillText(kk.textContent, bx + bw / 2, top + bh + 8);
      ctx.textAlign = 'left';
    });
    h = 28 + bh + 44;
  } else if (tag === 'UL' && cl.contains('legend')) {
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const sw = li.querySelector('.sw');
      swatch(ctx, x, yy + 10, 24, sw ? cssColor(sw.style.background) : VC.ink);
      ctx.font = vfont(30); ctx.fillStyle = VC.ink;
      ctx.fillText(li.textContent.trim(), x + 40, yy + 5);
      yy += 46;
    }
    h = yy - y + 12;
  } else if (cl.contains('facts')) {
    // a row of big numbers, each fading in on its own
    const cells = [...el.children], cw = W / cells.length;
    cells.forEach((c, k) => {
      ctx.globalAlpha = a * storyOpacity(c);
      const b = c.querySelector('b'), sm = c.querySelector('small');
      ctx.font = vfont(50, 700); ctx.fillStyle = b && b.dataset.col ? b.dataset.col : b && b.style.color && !/\(/.test(b.style.color) ? b.style.color : VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
      if (sm) textBlock(ctx, sm.textContent, x + k * cw, y + 68, cw - 16, 25, 32, VC.muted, 400, 2);
    });
    h = 68 + 64 + 18;
  } else if (tag === 'UL' && cl.contains('steps')) {
    // points with a bold name over a line of text, each fading in on its own
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const b = li.querySelector('b'), bold = b ? b.textContent : '', rest = li.textContent.slice(bold.length).trim();
      const col = li.dataset.col || cssColor(li.style.borderLeftColor) || VC.amber;   // an organ's point in its own colour (the HTML's is mixed for a light panel)
      const hh = 36 + textBlock(ctx, rest, x + 22, yy + 40, W - 22, 28, 38, VC.ink, 400, 4);
      ctx.fillStyle = col; ctx.fillRect(x, yy + 4, 5, hh);
      ctx.font = vfont(30, 700); ctx.fillStyle = col; ctx.fillText(bold, x + 22, yy);
      yy += hh + 16;
    }
    h = yy - y + 8;
  } else if (tag === 'UL' && cl.contains('concepts')) {
    let cx = x, cy = y;
    ctx.font = vfont(27);
    for (const li of el.children) {
      const t = li.textContent, w = ctx.measureText(t).width + 28;
      if (cx + w > x + W) { cx = x; cy += 54; }
      rr(ctx, cx, cy, w, 46, 6); ctx.fillStyle = VC.chip; ctx.fill();
      ctx.fillStyle = VC.ink; ctx.fillText(t, cx + 14, cy + 9);
      cx += w + 9;
    }
    h = cy - y + 46 + 26;
  } else if (tag === 'DIV' && el.style.display === 'grid') {
    // a grid of overlapping parts (one fades out as the next fades in)
    let mh = 0;
    for (const c of el.children) mh = Math.max(mh, drawStoryEl(ctx, P, c, x, y, W, a) - y);
    h = mh;
  } else if (tag === 'DIV') {
    // one part of such a grid: its paragraphs one under another
    let yy = y;
    for (const c of el.children) yy = drawStoryEl(ctx, P, c, x, yy, W, a);
    h = yy - y;
  } else if (el.textContent.trim()) {
    h = textBlock(ctx, el.textContent, x, y, W, 26, 38, VC.ink) + 14;
  }
  ctx.globalAlpha = 1;
  return y + h;
}


// explore: tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => pickTab(k) });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
  ({ networks: drawNetsPane, organs: drawOrgansPane, one: drawOnePane, people: drawPeoplePane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, icon (an organ id), fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.icon ? h - 10 : it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.icon) PET_ICONS.draw(ctx, it.icon, cx + 8 + (h - 16) / 2, cy + h / 2, h - 14, { color: it.col || VC.ink, width: 2 });
    else if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
    ctx.font = vfont(px, it.on ? 700 : 400); ctx.fillStyle = it.ink || VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, it.label, w - 26 - sw), cx + 13 + sw, cy + h / 2 + 1); ctx.textBaseline = 'top';
    cx += w + gap;
  }
  return cy + h - y;
}
const head = (ctx, x, y, t) => { ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(t, x, y); return 34; };
// a slider: a track from lo to hi, its knob at v; dragging it calls set(value)
function vSlider(ctx, P, id, x, y, w, v, lo, hi, col, set) {
  const f = clamp((v - lo) / (hi - lo), 0, 1);
  rr(ctx, x, y + 21, w, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.3)'; ctx.fill();
  rr(ctx, x, y + 21, w * f, 6, 3); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * f, y + 24, P.hover === id ? 16 : 13, 0, 7); ctx.fillStyle = col; ctx.fill();
  P.regions.push({ id, x: x - 16, y, w: w + 32, h: 48, drag: px => set(lo + clamp((px - x) / w, 0, 1) * (hi - lo)) });
}
// a network's strength per organ as bars, sorted from high to low, the hubs marked
function drawStrength(ctx, x, y, W, id, hubs) {
  const st = strengths(id), n = st.length, gap = 6, bw = (W - gap * (n - 1)) / Math.max(1, n), bh = 110, mx = n ? st[0][1] || 1 : 1;
  st.forEach(([o, v], k) => {
    const bx = x + k * (bw + gap), hgt = bh * v / mx;
    ctx.fillStyle = organCol(o); ctx.fillRect(bx, y + bh - hgt, bw, hgt);
    if (hubs.includes(o)) { ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 3; ctx.strokeRect(bx - 1.5, y + bh - hgt - 1.5, bw + 3, hgt + 3); }
    PET_ICONS.draw(ctx, o, bx + bw / 2, y + bh + 22, Math.min(36, bw), { color: hubs.includes(o) ? '#ffb020' : VC.muted, width: 2 });
  });
  return bh + 48;
}
function drawNetsPane(ctx, P, x, y, W, bottom) {
  const T = PD.D.table2, r = T[X.cmp], id = curNet(), ni = netInfo(id);
  y += head(ctx, x, y, 'Table 2: groups of scans compared (amber: a significant difference)');
  for (const [part, name] of [['health', 'From health to disease'], ['test', 'Is it robust?']]) {
    ctx.font = vfont(20, 700); ctx.fillStyle = VC.ink; ctx.fillText(name, x, y); y += 30;
    y += flow(ctx, P, T.map((t, i) => [t, i]).filter(([t]) => t.part === part).map(([t, i]) => ({ id: 'cmp:' + i, label: rowName(t), col: t.sigD || t.sigO ? VC.amber : null, on: X.cmp === i, fn: () => selectCmp(X.cmp === i ? -1 : i) })), x, y, W, bottom - 430, { px: 18, h: 36 }) + 10;
  }
  y += 4;
  if (r) {
    const nets = rowNets(r);
    y += textBlock(ctx, `${r.what}: ${r.cohort}`, x, y, W, 25, 34, VC.ink, 700, 1) + 4;
    r.groups.forEach((g, i) => {
      const n = nets[i] && NET_ALL.includes(nets[i]) ? nets[i] : null, on = n === id && X.scene === 'organs';
      // a group the paper drew as a network: a button that shows it (as the HTML pane's link)
      if (n) vButton(ctx, P, 'gnet:' + n, x + W - 130, y - 4, 130, 36, on ? 'On show' : 'Show', () => showNet(n), { on, r: 6, px: 19 });
      y += textBlock(ctx, `${g.label}: density ${pct(g.density)}, disorder ${dis(g.disorder)}, ${g.n} scans`, x, y, n ? W - 140 : W, 22, 30, VC.muted, 400, 1) + (n ? 8 : 0);
    });
    y += textBlock(ctx, `Density ${r.pD}${r.sigD ? ', significant' : ''}. Disorder ${r.pO}${r.sigO ? ', significant' : ''}.`, x, y, W, 22, 30, r.sigD || r.sigO ? VC.amber : VC.muted, 400, 1) + 4;
    // (what was measured in plain words, the row's own note, and a comparison with no network of its own)
    const nb = [WHAT_GLOSS[r.what] ? `${r.what}: ${WHAT_GLOSS[r.what]}.` : '', r.note, noNet() ? NO_NET : ''].filter(Boolean).join(' ');
    y += (nb ? textBlock(ctx, nb, x, y, W, 20, 27, VC.faint, 400, 3) : 0) + 8;
  }
  y += head(ctx, x, y, 'Networks drawn in the paper (· not read off the figure yet)');
  y += flow(ctx, P, NET_IDS.map((n, i) => ({ id: 'net:' + n, label: NET_SHORT[i] + (hasNet(n) ? '' : ' ·'), on: n === id && X.scene === 'organs', fn: () => pickNet(n) })), x, y, W, bottom, { px: 20, h: 40 }) + 12;
  y += textBlock(ctx, `${netShort(id)}: ${netTitle(id)}.`, x, y, W, 22, 30, VC.ink, 400, 2);
  y += textBlock(ctx, `${ni.text} ${ni.hubText || ''}`, x, y, W, 22, 30, VC.muted, 400, 3) + 10;
  if (ni.ok && y + 170 < bottom - 64) y += drawStrength(ctx, x, y, W, id, ni.hubs || []) + 6;
  if (FACTS.hk2 && y + 64 < bottom) textBlock(ctx, `Gene-activity networks (Table 3): of ${FACTS.tested}, only hexokinase 2's network resembles FDG's (r = ${FACTS.hk2.r}): the HK2 and GLUT networks above.`, x, y, W, 21, 29, VC.faint, 400, 2);
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, PD.D.organs.map(o => ({ id: 'org:' + o.id, label: o.short, icon: o.id, col: o.col, on: X.organ === o.id, fn: () => selectOrgan(X.organ === o.id ? null : o.id) })), x, y, W, bottom, { px: 21, h: 48 }) + 18;
  const id = X.organ, O = PD.byId[id];
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one, or point at an organ, a bar or a node and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  PET_ICONS.draw(ctx, id, x + 22, y + 22, 44, { color: O.col, width: 3, glow: true });
  y += textBlock(ctx, O.name, x + 60, y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, `Measured: ${O.measure}.`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  y += textBlock(ctx, id === 'aorta' ? 'The unit: every organ\'s uptake is divided by the aorta\'s.' : `Typical uptake: ${O.suv} times the aorta's (illustrative).`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  const hubIn = NET_ALL.filter(n => hasNet(n) && hubsOf(n).includes(id));
  const sv = PD.D.f2.organs.includes(id) && strengths('full').find(q => q[0] === id);
  if (sv) y += textBlock(ctx, `Strength: ${sv[1].toFixed(2)} in the network of all ${fmt(FACTS.scans)} scans.`, x, y, W, 24, 33, VC.muted, 400, 1) + 2;
  y += textBlock(ctx, `Hub in: ${hubIn.length ? listOf(hubIn.map(netShort)) : 'none of the networks drawn'}.`, x, y, W, 24, 33, hubIn.length ? VC.amber : VC.muted, 400, 2) + 14;
  if (!PD.D.f2.organs.includes(id)) { textBlock(ctx, id === 'aorta' ? 'Not a node: the blood pool.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in some of Figure 3's networks.`, x, y, W, 24, 33, VC.muted, 400, 2); return; }
  const e = edgesOf('full').filter(q => q[0] === id || q[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
  y += head(ctx, x, y, `Its links among all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)`);
  flow(ctx, P, e.map(q => { const o = q[0] === id ? q[1] : q[0]; return { id: 'ol:' + o, label: `${PD.byId[o].short} ${q[2] > 0 ? '+' : '−'}${Math.abs(q[2]).toFixed(2)}`, icon: o, col: q[2] > 0 ? '#4c7cff' : '#ff4d4d', fn: () => selectOrgan(o) }; }), x, y, W, bottom, { px: 21, h: 46 });
}
function drawOnePane(ctx, P, x, y, W, bottom) {
  const p = curProfile(), u = curU(), r = measureOne(u, X.theta);
  y += flow(ctx, P, PROFILES.map(([k, n]) => ({ id: 'prof:' + k, label: n, col: GROUP_COL[k], on: !X.u && p === k, fn: () => selectProfile(k) })).concat(X.u ? [{ id: 'prof:custom', label: 'Custom', on: true, fn: showOne }] : []), x, y, W, bottom, { px: 22, h: 48 }) + 16;
  const lw = 250, vw = 90, sx = x + lw, sw = W - lw - vw - 20;
  S1.organs.forEach((o, i) => {
    PET_ICONS.draw(ctx, o, x + 16, y + 24, 30, { color: organCol(o), width: 2 });
    ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText(fitText(ctx, organName(o).replace(/ \(.*\)$/, ''), lw - 50), x + 42, y + 25);
    ctx.textAlign = 'right'; ctx.fillText(u[i].toFixed(2), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    vSlider(ctx, P, 'u:' + i, sx, y, sw, u[i], 0.1, 5, organCol(o), v => { setU(i, v); if (X.scene !== 'people' || !oneView()) showOne(); });
    y += 54;
  });
  ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText('Threshold', x + 4, y + 25);
  ctx.textAlign = 'right'; ctx.fillText(X.theta.toFixed(2), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  vSlider(ctx, P, 'theta', sx, y, sw, X.theta, 1.1, 3, VC.cyan, v => { setTheta(v); if (X.scene !== 'people' || !oneView()) showOne(); });
  y += 70;
  const cells = [['Links', String(linksOf(r))], ['Clearance', r.C.toFixed(2)], ['Heterogeneity', r.H.toFixed(2)], ['Index', r.mdi.toFixed(1)]], cw = W / 4;
  cells.forEach(([k, v], j) => {
    ctx.font = vfont(52, 700); ctx.fillStyle = j === 3 ? VC.amber : VC.ink; ctx.fillText(v, x + j * cw, y);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(k, x + j * cw, y + 62);
  });
  y += 110;
  if (y + 90 < bottom) textBlock(ctx, `${S1.note} The profiles are illustrative too.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawPeoplePane(ctx, P, x, y, W, bottom) {
  const PO = POSTER, g = PO.groups[X.group - 1];
  y += textBlock(ctx, `The poster's results: ${PO.mdiN ? fmt(PO.mdiN) + ' people' : 'people'} by their index. Pick a group.`, x, y, W, 24, 33, VC.muted, 400, 2) + 10;
  y += flow(ctx, P, PO.groups.map((q, i) => ({ id: 'grp:' + (i + 1), label: `${q.name} · ${q.n}`, col: q.col, on: X.group === i + 1, fn: () => selectGroup(X.group === i + 1 ? 0 : i + 1) })), x, y, W, bottom, { px: 22, h: 48 }) + 14;
  if (g) y += textBlock(ctx, `${g.name}: ${g.n} people, median index ${g.centre}${Array.isArray(g.err) ? ` (middle half of the group: ${g.err[0]} to ${g.err[1]})` : ''}.`, x, y, W, 24, 33, VC.ink, 400, 2) + 12;
  const views = [['people', 'People'], ['index', 'Index'], ['survival', 'Survival'], ['immunotherapy', 'Immunotherapy']].filter(([k]) => optKey('people', 'view', new RegExp('^' + k + '$', 'i')));
  if (views.length) { y += head(ctx, x, y, 'View'); y += flow(ctx, P, views.map(([k, n]) => ({ id: 'pv:' + k, label: n, on: X.scene === 'people' && viewIs('people', new RegExp('^' + k + '$', 'i')), fn: () => showPeople(new RegExp('^' + k + '$', 'i')) })), x, y, W, bottom, { px: 23, h: 52 }) + 16; }
  if (PO.thirds.length) {
    y += head(ctx, x, y, 'Survival with cancer, by the index\'s thirds (median; after one year)');
    for (const t of PO.thirds) {
      swatch(ctx, x, y + 6, 18, t.col);
      y += textBlock(ctx, `${t.name}${t.n ? ` (${t.n})` : ''}: ${t.median === undefined ? '–' : t.median === null ? 'not reached' : t.median + ' months'}${t.y1 !== null ? `; ${t.y1}%` : ''}`, x + 30, y, W - 30, 23, 32, VC.ink, 400, 1) + 2;
    }
    y += 12;
  }
  if (PO.auc.length && y + 80 < bottom) {
    y += head(ctx, x, y, `The immunotherapy test${PO.respN ? ` (${PO.respN} people)` : ''}: AUC, 0.5 is chance`);
    for (const a of PO.auc.slice().sort((p, q) => q.auc - p.auc)) {
      if (y + 34 > bottom - 130) break;
      y += textBlock(ctx, `${a.name}: ${a.auc}${a.p ? ' · ' + a.p : ''}`, x, y, W, 23, 32, a.net ? VC.amber : VC.muted, a.net ? 700 : 400, 1) + 2;
    }
    if (y + 64 < bottom - 60) y += textBlock(ctx, aucNote(), x, y + 6, W, 21, 29, VC.muted, 400, 2) + 8;
  }
  if (y + 40 < bottom) textBlock(ctx, 'Group summaries from the poster; the dots are stand-ins drawn to match them, not patients.', x, bottom - 60, W, 21, 29, VC.faint, 400, 2);
}
// the five scenes, and the chosen scene's own controls
const SCENE_SHORT = { people: 'People' };
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlLit(X.scene, c, v), fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'scan' && y + 70 < bottom) vButton(ctx, P, 'life', x, y, 300, 60, 'Life size', () => setLife(!X.life), { on: X.life, px: 24 });
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') : 'x' + X.turn;
}
function drawFoot(ctx, P) {
  if (APP.mode === 'story') {
    const playing = APP.playing, bx = 28, by = 40;
    vButton(ctx, P, 'play', bx, by, 96, 96, '', () => APP.togglePlay(), { r: 48 });
    ctx.fillStyle = VC.ink;
    if (playing) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
    else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
    const t = APP.t, ci = Math.max(0, CH.findIndex(c => t >= c.na && t < c.nb));
    const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
    vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => APP.seek(t > CH[ci].na + 2 || ci === 0 ? CH[ci].na : CH[ci - 1].na));
    ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
    vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => APP.seek(ci < CH.length - 1 ? CH[ci + 1].na : T_END - 0.01));
    ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
    const x0 = 344, x1 = P.w - 40, ty = 100;
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(CH[ci].name, x0, 40);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    rr(ctx, x0, ty, x1 - x0, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.28)'; ctx.fill();
    rr(ctx, x0, ty, (x1 - x0) * t / T_END, 6, 3); ctx.fillStyle = VC.cyan; ctx.fill();
    ctx.fillStyle = 'rgba(160,178,202,0.6)';
    for (const c of CH.slice(1)) ctx.fillRect(x0 + (x1 - x0) * c.na / T_END - 1, ty - 8, 2, 22);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Turn', 28, 58);
  vButton(ctx, P, 'turn:on', 100, 40, 90, 56, 'On', () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 198, 40, 90, 56, 'Off', () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText('Zoom', 330, 58);
  vButton(ctx, P, 'z-', 404, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 466, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 560, 40, 230, 56, 'Whole scene', () => flyTo(view(X.scene, 'default')), { px: 22 });
}


// ------------------------------------------------------------- narration --
